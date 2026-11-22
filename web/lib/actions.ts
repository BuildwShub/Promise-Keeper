import type { SupabaseClient } from '@supabase/supabase-js';
import { Dates, OutputsFmt, Schema } from './shared';
import { decrypt } from './crypto';
import { accessTokenFor } from './google';
import { calendar, tasks, TASKLIST_TITLE } from './gapi';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Port of addon/src/Outputs.js. Idempotent: an item with a task_id never gets a second task.

interface Row {
  id: string; user_id: string; thread_id: string; msg_id: string; type: string; what: string; due: string | null;
  counterparty_name: string; counterparty_email: string; evidence: string; status: string; task_id: string | null; event_id: string | null;
}

/** DB row -> the camelCase item shape that OutputsFmt expects. */
function fmtItem(r: Row, accountEmail?: string) {
  return { accountEmail, type: r.type, what: r.what, due: r.due ?? '', threadId: r.thread_id, evidence: r.evidence, counterpartyName: r.counterparty_name, counterpartyEmail: r.counterparty_email };
}

async function acctEmail(db: SupabaseClient, userId: string): Promise<string | undefined> {
  const { data } = await db.from('users').select('email').eq('id', userId).maybeSingle();
  return data?.email ?? undefined;
}

const snap =(r: Row) => ({ what: r.what, type: r.type, due: r.due, counterpartyName: r.counterparty_name, status: r.status, taskId: r.task_id, eventId: r.event_id });

async function find(db: SupabaseClient, userId: string, itemId: string): Promise<Row> {
  const { data, error } = await db.from('items').select('*').eq('id', itemId).eq('user_id', userId).maybeSingle();
  if (error) throw new Error('item lookup failed: ' + error.message);
  if (!data) throw new Error('Item not found');
  return data as Row;
}

async function feedback(db: SupabaseClient, userId: string, itemId: string, action: string, before: object, after: object) {
  await db.from('feedback').insert({ user_id: userId, item_id: itemId, action, before_json: before, after_json: after });
}

/** Fresh Google access token for a user from the stored encrypted refresh token. */
export async function accessFor(db: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await db.from('oauth_tokens').select('refresh_token_enc').eq('user_id', userId).maybeSingle();
  if (error || !data) throw new Error('No Google token stored. Sign in again.');
  return accessTokenFor(decrypt(data.refresh_token_enc));
}

/** The "Promise Keeper" task list: cached id, else found by title, else created. */
export async function taskListId(db: SupabaseClient, userId: string, token: string): Promise<string> {
  const { data } = await db.from('oauth_tokens').select('tasklist_id').eq('user_id', userId).maybeSingle();
  if (data?.tasklist_id && (await tasks.listGet(token, data.tasklist_id))) return data.tasklist_id;
  const found = (await tasks.listAll(token)).find((l: any) => l.title === TASKLIST_TITLE);
  const id: string = (found ?? (await tasks.listInsert(token, TASKLIST_TITLE))).id;
  await db.from('oauth_tokens').update({ tasklist_id: id }).eq('user_id', userId);
  return id;
}

export async function acceptItem(db: SupabaseClient, userId: string, itemId: string): Promise<Row> {
  const it = await find(db, userId, itemId);
  if (it.status === 'done' || (it.status === 'accepted' && it.task_id)) return it; // idempotent
  const token = await accessFor(db, userId);
  const listId = await taskListId(db, userId, token);
  const patch: Record<string, unknown> = { status: 'accepted', updated_at: new Date().toISOString() };
  const item = fmtItem(it, await acctEmail(db, userId));
  if (!it.task_id) {
    const t = await tasks.insert(token, listId, OutputsFmt.taskResource(item));
    patch.task_id = t.id;
    await db.from('items').update(patch).eq('id', itemId).eq('user_id', userId); // save the id before the event call can fail
  }
  if (OutputsFmt.wantsEvent(item) && !it.event_id) {
    const ev = await calendar.insert(token, OutputsFmt.eventResource(item));
    patch.event_id = ev.id;
  }
  const { error } = await db.from('items').update(patch).eq('id', itemId).eq('user_id', userId);
  if (error) throw new Error('accept failed: ' + error.message);
  const after = await find(db, userId, itemId);
  await feedback(db, userId, itemId, 'accept', snap(it), snap(after));
  return after;
}

/** patch: any of {what, type, due, counterpartyName}. Updates the item and, when accepted, its task and event. */
export async function editItem(db: SupabaseClient, userId: string, itemId: string, patch: { what?: string; type?: string; due?: string; counterpartyName?: string }): Promise<Row> {
  const it = await find(db, userId, itemId);
  const next = {
    what: (patch.what ?? it.what).trim(), type: (patch.type ?? it.type).trim(),
    due: patch.due === undefined ? (it.due ?? '') : patch.due.trim(), counterpartyName: (patch.counterpartyName ?? it.counterparty_name).trim(),
  };
  if (!next.what) throw new Error('Text cannot be empty');
  if (next.due && !Dates.isValidIso(next.due)) throw new Error('Bad date: ' + next.due);
  if (!Schema.TYPES.includes(next.type)) throw new Error('Bad type: ' + next.type);

  const row: Record<string, unknown> = {
    what: next.what, type: next.type, due: next.due || null, counterparty_name: next.counterpartyName, needs_date: !next.due, updated_at: new Date().toISOString(),
  };
  if (it.status === 'accepted') {
    const token = await accessFor(db, userId);
    const listId = await taskListId(db, userId, token);
    const merged = { ...fmtItem(it, await acctEmail(db, userId)), ...next, counterpartyEmail: it.counterparty_email };
    if (it.task_id) {
      const clearing = !next.due && !!it.due;
      const res = clearing
        ? await tasks.update(token, listId, it.task_id, { id: it.task_id, status: 'needsAction', ...OutputsFmt.taskResource(merged) })
        : await tasks.patch(token, listId, it.task_id, OutputsFmt.taskResource(merged));
      if (res === null) row.task_id = (await tasks.insert(token, listId, OutputsFmt.taskResource(merged))).id; // user deleted it: recreate
    }
    const want = OutputsFmt.wantsEvent(merged);
    if (want && it.event_id) {
      const r = await calendar.patch(token, it.event_id, OutputsFmt.eventResource(merged));
      if (r === null) row.event_id = (await calendar.insert(token, OutputsFmt.eventResource(merged))).id;
    } else if (want) row.event_id = (await calendar.insert(token, OutputsFmt.eventResource(merged))).id;
    else if (it.event_id) { await calendar.remove(token, it.event_id); row.event_id = null; }
  }
  const { error } = await db.from('items').update(row).eq('id', itemId).eq('user_id', userId);
  if (error) throw new Error('edit failed: ' + error.message);
  const after = await find(db, userId, itemId);
  await feedback(db, userId, itemId, 'edit', snap(it), snap(after));
  return after;
}

export async function dismissItem(db: SupabaseClient, userId: string, itemId: string): Promise<Row> {
  const it = await find(db, userId, itemId);
  if (it.task_id || it.event_id) {
    const token = await accessFor(db, userId);
    if (it.task_id) await tasks.remove(token, await taskListId(db, userId, token), it.task_id);
    if (it.event_id) await calendar.remove(token, it.event_id);
  }
  const { error } = await db.from('items').update({ status: 'dismissed', task_id: null, event_id: null, updated_at: new Date().toISOString() }).eq('id', itemId).eq('user_id', userId);
  if (error) throw new Error('dismiss failed: ' + error.message);
  const after = await find(db, userId, itemId);
  await feedback(db, userId, itemId, 'dismiss', snap(it), snap(after));
  return after;
}

export async function markDone(db: SupabaseClient, userId: string, itemId: string): Promise<Row> {
  const it = await find(db, userId, itemId);
  if (it.task_id) {
    const token = await accessFor(db, userId);
    await tasks.patch(token, await taskListId(db, userId, token), it.task_id, { status: 'completed' });
  }
  const now = new Date().toISOString();
  const { error } = await db.from('items').update({ status: 'done', completed_at: now, updated_at: now }).eq('id', itemId).eq('user_id', userId);
  if (error) throw new Error('done failed: ' + error.message);
  const after = await find(db, userId, itemId);
  await feedback(db, userId, itemId, 'done', snap(it), snap(after));
  return after;
}

/** Cron: tasks completed in Google Tasks mark their items done (feeds the on-time metric). */
export async function syncStatus(db: SupabaseClient, userId: string, token: string): Promise<{ checked: number; done: number; missing: number }> {
  const { data } = await db.from('items').select('id,task_id').eq('user_id', userId).eq('status', 'accepted').not('task_id', 'is', null);
  const accepted = data ?? [];
  if (!accepted.length) return { checked: 0, done: 0, missing: 0 };
  const byId = new Map<string, any>();
  for (const t of await tasks.listAllTasks(token, await taskListId(db, userId, token))) byId.set(t.id, t);
  const stats = { checked: accepted.length, done: 0, missing: 0 };
  for (const it of accepted) {
    const t = byId.get(it.task_id);
    if (!t) { stats.missing++; continue; }
    if (t.status === 'completed') {
      const at = t.completed || new Date().toISOString();
      await db.from('items').update({ status: 'done', completed_at: at, updated_at: new Date().toISOString() }).eq('id', it.id).eq('user_id', userId);
      await feedback(db, userId, it.id, 'done', { status: 'accepted' }, { status: 'done', source: 'tasks' });
      stats.done++;
    }
  }
  return stats;
}

/** Off by default. When the user turned auto-add on, accept suggested items at or above the threshold. */
export async function autoAdd(db: SupabaseClient, userId: string): Promise<number> {
  const { data: u } = await db.from('users').select('auto_add_enabled,auto_add_threshold').eq('id', userId).maybeSingle();
  if (!u?.auto_add_enabled) return 0;
  const { data } = await db.from('items').select('id').eq('user_id', userId).eq('status', 'suggested').eq('needs_date', false).gte('confidence', u.auto_add_threshold);
  let n = 0;
  for (const r of data ?? []) { await acceptItem(db, userId, r.id); n++; }
  return n;
}
