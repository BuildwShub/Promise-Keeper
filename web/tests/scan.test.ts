jest.mock('../lib/google', () => ({
  listIds: jest.fn(),
  accessTokenFor: jest.fn(), getMessage: jest.fn(), historyAdded: jest.fn(), startWatch: jest.fn(),
  GoogleError: class extends Error {}, ReauthError: class extends Error {},
}));
import { listIds } from '../lib/google';
import { enqueueBackfill, scanState } from '../lib/intake';
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
