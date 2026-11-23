jest.mock('../lib/google', () => ({
  listIds: jest.fn(),
  accessTokenFor: jest.fn(), getMessage: jest.fn(), historyAdded: jest.fn(), startWatch: jest.fn(),
  GoogleError: class extends Error {}, ReauthError: class extends Error {},
}));
import { listIds } from '../lib/google';
import { getMessage } from '../lib/google';
import { enqueueBackfill, scanState, drainQueue } from '../lib/intake';
import { CONFIG } from '../lib/config';

/** Minimal fake of the Supabase calls enqueue() makes. Records each upsert batch in order. */
function fakeDb(counts: { queue?: number; processed?: number } = {}) {
  const batches: string[][] = [];
  const db = {
    from: (table: string) => ({
      select: (_c?: string, opts?: { head?: boolean }) => {
        const result = opts?.head ? { count: table === 'message_queue' ? counts.queue ?? 0 : counts.processed ?? 0, error: null } : { data: [], error: null };
        const chain: any = { eq: () => chain, in: () => Promise.resolve(result), then: (r: any) => Promise.resolve(result).then(r) };
        return chain;
      },
      upsert: (rows: { msg_id: string }[]) => { batches.push(rows.map((r) => r.msg_id)); return Promise.resolve({ error: null }); },
    }),
  };
  return { db: db as any, batches };
}

describe('first scan order', () => {
  test('newest 7 days are queued in their own batch before the rest of the 30 days', async () => {
    (listIds as jest.Mock).mockImplementation(async (_t: string, q: string) =>
      (q === CONFIG.BACKFILL_QUERY_FAST ? ['n1', 'n2'] : ['n1', 'n2', 'o1', 'o2']).map((id) => ({ id, threadId: id })));
    const { db, batches } = fakeDb();
    const n = await enqueueBackfill(db, 'u1', 'tok');
    expect(batches[0]).toEqual(['n1', 'n2']);
    expect(batches[1]).toEqual(['n1', 'n2', 'o1', 'o2']); // already-queued ids are ignored by the database (ignoreDuplicates)
    expect(n).toBe(6);
  });
  test('the fast query covers 7 days, the full query 30', () => {
    expect(CONFIG.BACKFILL_QUERY_FAST).toContain('newer_than:7d');
    expect(CONFIG.BACKFILL_QUERY).toContain('newer_than:30d');
  });
});

describe('scanState', () => {
  test('returns queue and processed counts', async () => {
    const { db } = fakeDb({ queue: 12, processed: 3 });
    expect(await scanState(db, 'u1')).toEqual({ queued: 12, processed: 3 });
  });
});

describe('drainQueue hard stop', () => {
  test('returns on time when an email hangs, and leaves it queued', async () => {
    (getMessage as jest.Mock).mockImplementation(() => new Promise(() => { /* never resolves: a stuck Gemini retry */ }));
    const deletes: string[] = [];
    const db: any = {
      from: () => {
        const chain: any = {
          select: () => chain, eq: () => chain, order: () => chain,
          limit: () => Promise.resolve({ data: [{ msg_id: 'a', attempts: 0 }, { msg_id: 'b', attempts: 0 }], error: null }),
          delete: () => { deletes.push('x'); return chain; }, update: () => chain, upsert: () => Promise.resolve({ error: null }),
        };
        return chain;
      },
    };
    const saved = CONFIG.HARD_STOP_GRACE_MS;
    CONFIG.HARD_STOP_GRACE_MS = 50;
    const t0 = Date.now();
    const stats = await drainQueue(db, { id: 'u', email: 'a@b.c', timezone: 'UTC' }, 'tok', Date.now() + 50);
    CONFIG.HARD_STOP_GRACE_MS = saved;
    expect(Date.now() - t0).toBeLessThan(1500);
    expect(stats.timedOut).toBe(true);
    expect(stats.remaining).toBe(2);
    expect(deletes).toHaveLength(0); // nothing was removed from the queue
  });
});
