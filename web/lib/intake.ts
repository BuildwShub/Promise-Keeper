import type { SupabaseClient } from '@supabase/supabase-js';
import { decrypt } from './crypto';
import { CONFIG } from './config';
import { accessTokenFor, getMessage, historyAdded, listIds, startWatch, GoogleError, ReauthError } from './google';
import { checkResolved, runExtract, storeItems } from './extract';
import { autoAdd, syncStatus } from './actions';
import { sendDigest } from './digest';

export interface UserCtx { id: string; email: string; timezone: string }

/** Put message ids on the user's queue, skipping ones already processed without error or already queued. */
export async function enqueue(db: SupabaseClient, userId: string, ids: string[]): Promise<number> {
  const unique = [...new Set(ids)];
  if (!unique.length) return 0;
  const done = new Set<string>();
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const { data, error } = await db.from('processed_messages').select('msg_id,error').eq('user_id', userId).in('msg_id', chunk);
    if (error) throw new Error('processed lookup failed: ' + error.message);
    for (const r of data ?? []) if (!r.error) done.add(r.msg_id);
  }
  const rows = unique.filter((id) => !done.has(id)).map((id) => ({ user_id: userId, msg_id: id }));
  if (!rows.length) return 0;
  const { error } = await db.from('message_queue').upsert(rows, { onConflict: 'user_id,msg_id', ignoreDuplicates: true });
  if (error) throw new Error('enqueue failed: ' + error.message);
  return rows.length;
}

/** Process one queued message: fetch, extract, store, mark processed. Throws on failure (caller records the error). */
export async function processMessage(db: SupabaseClient, user: UserCtx, token: string, msgId: string) {
  const msg = await getMessage(token, msgId);
  const row = { user_id: user.id, msg_id: msgId, thread_id: '', direction: null as string | null, internal_date: null as number | null, processed_at: new Date().toISOString(), item_count: 0, prompt_version: CONFIG.PROMPT_VERSION, error: null as string | null };
  let newItems = 0, resolved = 0, dropped = 0;
  if (msg) {
    row.thread_id = msg.threadId;
    row.direction = msg.direction;
    row.internal_date = msg.internalDate;
    const r = await runExtract(msg, user.timezone, user.email);
    dropped = r.dropped.length;
    const stored = await storeItems(db, user.id, msg, r.items);
    newItems = stored.newItems;
    row.item_count = stored.newItems;
    // Record the message as processed before resolve-checks so a retry does not redo Gemini.
    const up = await db.from('processed_messages').upsert(row, { onConflict: 'user_id,msg_id' });
    if (up.error) throw new Error('mark processed failed: ' + up.error.message);
    resolved = await checkResolved(db, user.id, msg);
  } else {
    row.thread_id = 'draft';
    const up = await db.from('processed_messages').upsert(row, { onConflict: 'user_id,msg_id' });
    if (up.error) throw new Error('mark processed failed: ' + up.error.message);
  }
  return { newItems, resolved, dropped };
}

export interface RunStats { processed: number; newItems: number; resolved: number; errors: number; remaining: number; timedOut: boolean; lastError?: string }

/** Drain the user's queue until empty or the time budget ends. */
export async function drainQueue(db: SupabaseClient, user: UserCtx, token: string, deadlineMs: number): Promise<RunStats> {
  const stats: RunStats = { processed: 0, newItems: 0, resolved: 0, errors: 0, remaining: 0, timedOut: false };
  const { data, error } = await db.from('message_queue').select('msg_id,attempts').eq('user_id', user.id).order('enqueued_at').limit(CONFIG.QUEUE_BATCH);
  if (error) throw new Error('queue read failed: ' + error.message);
  const queue = data ?? [];
  let next = 0;
  // A few messages at a time: Gemini latency dominates, and the paid tier allows it.
  const worker = async () => {
    for (;;) {
      if (Date.now() > deadlineMs) { stats.timedOut = true; return; }
      const i = next++;
      if (i >= queue.length) return;
      await handleOne(queue[i]);
    }
  };
  const handleOne = async (q: { msg_id: string; attempts: number | null }) => {
    try {
      const r = await processMessage(db, user, token, q.msg_id);
      stats.processed++;
      stats.newItems += r.newItems;
      stats.resolved += r.resolved;
      await db.from('message_queue').delete().eq('user_id', user.id).eq('msg_id', q.msg_id);
    } catch (e) {
      stats.errors++;
      const attempts = (q.attempts ?? 0) + 1;
      const msg = String((e as Error).message ?? e).slice(0, 300);
      stats.lastError = msg;
      if (attempts >= CONFIG.MAX_ATTEMPTS) {
        // Give up: record the error so it shows in diagnostics, and stop retrying.
        await db.from('processed_messages').upsert({ user_id: user.id, msg_id: q.msg_id, thread_id: '', processed_at: new Date().toISOString(), error: msg, prompt_version: CONFIG.PROMPT_VERSION }, { onConflict: 'user_id,msg_id' });
        await db.from('message_queue').delete().eq('user_id', user.id).eq('msg_id', q.msg_id);
      } else {
        await db.from('message_queue').update({ attempts }).eq('user_id', user.id).eq('msg_id', q.msg_id);
      }
    }
  };
  // Hard stop: a Gemini rate-limit retry can sleep 5 + 10 + 20 s, which would carry the run past Vercel's 60 s limit.
  // Stop waiting shortly after the soft deadline. Unfinished emails stay in the queue (deleted only after success), so nothing is lost.
  const hardStop = new Promise<'hard'>((r) => setTimeout(() => r('hard'), Math.max(0, deadlineMs + CONFIG.HARD_STOP_GRACE_MS - Date.now())));
  const all = Promise.all(Array.from({ length: Math.min(CONFIG.CONCURRENCY, queue.length) }, worker));
  if ((await Promise.race([all.then(() => 'done' as const), hardStop])) === 'hard') stats.timedOut = true;
  stats.remaining = Math.max(0, queue.length - stats.processed - stats.errors);
  return stats;
}

/**
 * First scan: queue the newest 7 days first (separate insert, so they drain first), then the rest of the 30 days.
 * Same total work as before; the useful results just appear sooner.
 */
export async function enqueueBackfill(db: SupabaseClient, userId: string, access: string): Promise<number> {
  const recent = await listIds(access, CONFIG.BACKFILL_QUERY_FAST, CONFIG.BACKFILL_LIMIT);
  const a = await enqueue(db, userId, recent.map((r) => r.id));
  const all = await listIds(access, CONFIG.BACKFILL_QUERY, CONFIG.BACKFILL_LIMIT);
  const b = await enqueue(db, userId, all.map((r) => r.id));
  return a + b;
}

export interface ScanState { queued: number; processed: number }

/** Counts for the sign-in progress bar. Caller has already verified the user id. */
export async function scanState(db: SupabaseClient, userId: string): Promise<ScanState> {
  const [q, p] = await Promise.all([
    db.from('message_queue').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('processed_messages').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  return { queued: q.count ?? 0, processed: p.count ?? 0 };
}

/** On-demand scan for the signed-in user (progress bar): queue the first scan if nothing was ever processed, then drain for the time budget. */
export async function scanNow(db: SupabaseClient, user: UserCtx, deadlineMs: number): Promise<RunStats & ScanState> {
  const { data: tok, error } = await db.from('oauth_tokens').select('refresh_token_enc').eq('user_id', user.id).maybeSingle();
  if (error || !tok) throw new Error('no token for user');
  const access = await accessTokenFor(decrypt(tok.refresh_token_enc));
  const before = await scanState(db, user.id);
  if (before.processed === 0 && before.queued === 0) await enqueueBackfill(db, user.id, access);
  const stats = await drainQueue(db, user, access, deadlineMs);
  return { ...stats, ...(await scanState(db, user.id)) };
}

/** Sweep: find recent unprocessed messages (safety net for missed pushes), and keep the Gmail watch alive. */
export async function sweepUser(db: SupabaseClient, user: UserCtx, deadlineMs: number, forceBackfill = false): Promise<RunStats & { enqueued: number; watch: string }> {
  const { data: tok, error } = await db.from('oauth_tokens').select('refresh_token_enc,watch_expiration,gmail_history_id').eq('user_id', user.id).maybeSingle();
  if (error || !tok) throw new Error('no token for user');
  let access: string;
  try {
    access = await accessTokenFor(decrypt(tok.refresh_token_enc));
  } catch (e) {
    if (e instanceof ReauthError) {
      await db.from('events').insert({ user_id: user.id, event: 'reauth_needed', meta: {} });
      throw e;
    }
    throw e;
  }

  let watch = 'skipped';
  const topic = process.env.PUBSUB_TOPIC;
  if (topic) {
    const exp = tok.watch_expiration ? new Date(tok.watch_expiration).getTime() : 0;
    if (exp - Date.now() < CONFIG.WATCH_RENEW_BEFORE_MS) {
      const w = await startWatch(access, topic);
      await db.from('oauth_tokens').update({ gmail_history_id: w.historyId, watch_expiration: w.expiration.toISOString(), updated_at: new Date().toISOString() }).eq('user_id', user.id);
      watch = 'renewed';
    } else watch = 'ok';
  }

  const { count } = await db.from('processed_messages').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
  const first = forceBackfill || (count ?? 0) === 0;
  const enqueued = first ? await enqueueBackfill(db, user.id, access) : await enqueue(db, user.id, (await listIds(access, CONFIG.SCAN_QUERY, CONFIG.SCAN_LIMIT)).map((r) => r.id));
  const stats = await drainQueue(db, user, access, deadlineMs);
  // Housekeeping that must not fail the sweep: Tasks completion sync, then auto-add (off unless the user enabled it).
  let sync: unknown = null, auto = 0;
  try { sync = await syncStatus(db, user.id, access); auto = await autoAdd(db, user.id); } catch (e) { sync = { error: String((e as Error).message ?? e).slice(0, 120) }; }
  // Morning digest: sent once per local day at or after the user's digest hour. A failure here must not fail the sweep.
  let digest: unknown = null;
  try { digest = await sendDigest(db, user); } catch (e) { digest = { error: String((e as Error).message ?? e).slice(0, 120) }; }
  await db.from('events').insert({ user_id: user.id, event: 'scan', meta: { ...stats, enqueued, first, sync, auto, digest } });
  return { ...stats, enqueued, watch };
}

/** Handle a Pub/Sub push for one mailbox: enqueue the messages added since the stored history id. */
export async function handlePush(db: SupabaseClient, emailAddress: string, historyId: string): Promise<{ enqueued: number }> {
  const { data: u } = await db.from('users').select('id,email,timezone').ilike('email', emailAddress).maybeSingle();
  if (!u) return { enqueued: 0 };
  // Every push and every failure is recorded in `events`, so delivery problems are visible without server logs.
  try {
    const r = await handlePushFor(db, u, historyId);
    await db.from('events').insert({ user_id: u.id, event: 'push', meta: { historyId, enqueued: r.enqueued } });
    return r;
  } catch (e) {
    await db.from('events').insert({ user_id: u.id, event: 'push_error', meta: { historyId, error: String((e as Error).message ?? e).slice(0, 300) } });
    throw e;
  }
}

async function handlePushFor(db: SupabaseClient, u: UserCtx, historyId: string): Promise<{ enqueued: number }> {
  const { data: tok } = await db.from('oauth_tokens').select('refresh_token_enc,gmail_history_id').eq('user_id', u.id).maybeSingle();
  if (!tok) return { enqueued: 0 };
  const access = await accessTokenFor(decrypt(tok.refresh_token_enc));
  let ids: string[] = [];
  if (tok.gmail_history_id) {
    try {
      ids = await historyAdded(access, tok.gmail_history_id);
    } catch (e) {
      if (!(e instanceof GoogleError && e.status === 404)) throw e;
      ids = (await listIds(access, CONFIG.SCAN_QUERY, CONFIG.SCAN_LIMIT)).map((r) => r.id); // history too old: fall back to a query
    }
  } else {
    ids = (await listIds(access, CONFIG.SCAN_QUERY, CONFIG.SCAN_LIMIT)).map((r) => r.id);
  }
  const enqueued = await enqueue(db, u.id, ids);
  // Process what was just queued so the item appears within about a minute (the 5-minute sweep is only the safety net).
  if (enqueued) await drainQueue(db, u, access, Date.now() + 20_000);
  // Only move the cursor forward.
  const next = BigInt(historyId) > BigInt(tok.gmail_history_id ?? '0') ? historyId : tok.gmail_history_id;
  await db.from('oauth_tokens').update({ gmail_history_id: next, updated_at: new Date().toISOString() }).eq('user_id', u.id);
  return { enqueued };
}
