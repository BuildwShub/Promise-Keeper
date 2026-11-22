import type { SupabaseClient } from '@supabase/supabase-js';
import { Clean, Dates, Dedup, Validate } from './shared';
import { CONFIG } from './config';
import { geminiExtract } from './gemini';
import { sentIso } from './time';
import type { Msg } from './google';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ExtractResult { sentIso: string; cleaned: string; rawItems: any[]; items: any[]; dropped: any[] }

/** fetch -> clean -> Gemini -> validate. Same steps as Extract.run in the add-on. `gemini` is injectable for tests. */
export async function runExtract(msg: Msg, tz: string, userEmail: string, gemini: (ctx: any) => Promise<any[]> = geminiExtract): Promise<ExtractResult> {
  const iso = sentIso(msg.internalDate, tz);
  const cleaned: string = Clean.clean(msg.body, { maxChars: CONFIG.MAX_CLEAN_CHARS });
  const out: ExtractResult = { sentIso: iso, cleaned, rawItems: [], items: [], dropped: [] };
  if (/^\[Promise Keeper\]/.test(msg.subject)) return out; // our own digest: never scan it
  if (cleaned.length < CONFIG.MIN_BODY_CHARS) return out;
  const ctx = { userEmail, direction: msg.direction, timezone: tz, sentIso: iso, from: msg.from, to: msg.to, cc: msg.cc, subject: msg.subject, body: cleaned };
  out.rawItems = await gemini(ctx);
  const v = Validate.validateItems(out.rawItems, { cleanedText: cleaned, direction: msg.direction, sentDate: Dates.localDateOf(iso) });
  out.items = v.items;
  out.dropped = v.dropped;
  return out;
}

interface ExistingItem { itemId: string; threadId: string; type: string; what: string; due: string; fingerprint: string }

/** Load the user's existing items in one thread, in the shape Dedup expects. */
async function loadThreadItems(db: SupabaseClient, userId: string, threadId: string): Promise<ExistingItem[]> {
  const { data, error } = await db.from('items').select('id,thread_id,type,what,due,fingerprint').eq('user_id', userId).eq('thread_id', threadId);
  if (error) throw new Error('load items failed: ' + error.message);
  return (data ?? []).map((r) => ({ itemId: r.id, threadId: r.thread_id, type: r.type, what: r.what, due: r.due ?? '', fingerprint: r.fingerprint }));
}

/** Insert new items or merge into duplicates. Returns counts. */
export async function storeItems(db: SupabaseClient, userId: string, msg: Msg, items: any[]): Promise<{ newItems: number; dupes: number }> {
  const existing = await loadThreadItems(db, userId, msg.threadId);
  let newItems = 0, dupes = 0;
  for (const it of items) {
    const cand = {
      threadId: msg.threadId, type: it.type, what: it.what, due: it.due || '', dueText: it.dueText, needsDate: it.needsDate,
      fingerprint: Dedup.fingerprint(msg.threadId, it.type, it.what),
    };
    const dup = Dedup.findDuplicate(cand, existing, CONFIG.DEDUP_JACCARD);
    if (dup) {
      const res = Dedup.resolveDuplicate(dup, cand);
      if (res.action === 'update') {
        const { error } = await db.from('items').update({ due: res.patch.due, due_text: res.patch.dueText, needs_date: false, updated_at: new Date().toISOString() }).eq('id', dup.itemId).eq('user_id', userId);
        if (error) throw new Error('update item failed: ' + error.message);
        dup.due = res.patch.due;
      }
      dupes++;
      continue;
    }
    const row = {
      user_id: userId, msg_id: msg.msgId, thread_id: msg.threadId, direction: msg.direction, type: it.type, what: it.what,
      counterparty_name: it.counterpartyName ?? '', counterparty_email: it.counterpartyEmail ?? '',
      due: it.due || null, due_text: it.dueText ?? '', needs_date: !!it.needsDate, confidence: it.confidence, evidence: it.evidence,
      status: 'suggested', fingerprint: cand.fingerprint, prompt_version: CONFIG.PROMPT_VERSION,
    };
    const { data, error } = await db.from('items').upsert(row, { onConflict: 'user_id,fingerprint', ignoreDuplicates: true }).select('id');
    if (error) throw new Error('insert item failed: ' + error.message);
    if (data && data.length) {
      newItems++;
      existing.push({ itemId: data[0].id, threadId: msg.threadId, type: it.type, what: it.what, due: it.due || '', fingerprint: cand.fingerprint });
    } else dupes++; // lost a race on the unique fingerprint
  }
  return { newItems, dupes };
}

/**
 * A new inbox message from the counterparty in a waiting_on thread marks that accepted item possibly_resolved,
 * so the sidebar can ask "Did they deliver?". Skips the message that created the item.
 */
export async function checkResolved(db: SupabaseClient, userId: string, msg: Msg): Promise<number> {
  if (msg.direction !== 'inbox') return 0;
  const m = /<([^>]+)>/.exec(msg.from);
  const from = (m ? m[1] : msg.from).trim().toLowerCase();
  if (!from) return 0;
  const { data, error } = await db.from('items').select('id,msg_id,counterparty_email')
    .eq('user_id', userId).eq('thread_id', msg.threadId).eq('type', 'waiting_on').eq('status', 'accepted').neq('msg_id', msg.msgId);
  if (error) throw new Error('resolve lookup failed: ' + error.message);
  let n = 0;
  for (const it of data ?? []) {
    if (!it.counterparty_email || String(it.counterparty_email).toLowerCase() !== from) continue;
    const src = await db.from('processed_messages').select('internal_date').eq('user_id', userId).eq('msg_id', it.msg_id).maybeSingle();
    const srcMs = Number(src.data?.internal_date) || 0;
    if (srcMs > 0 && msg.internalDate > srcMs) {
      await db.from('items').update({ status: 'possibly_resolved', updated_at: new Date().toISOString() }).eq('id', it.id).eq('user_id', userId);
      n++;
    }
  }
  return n;
}
