import { runEval } from '../lib/eval';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Tiny stand-in for the supabase-js builder: every filter call returns the same thenable, which resolves to the table data.
function fakeDb(tables: Record<string, any[]>) {
  const inserted: Record<string, any[]> = {};
  const db = {
    from(name: string) {
      const q: any = {
        select: () => q, eq: () => q, order: () => q,
        then: (res: any) => res({ data: tables[name] ?? [], error: null }),
        upsert: async (row: any) => { (tables[name] ??= []).push(row); return { error: null }; },
        insert: async (row: any) => { (inserted[name] ??= []).push(row); return { error: null }; },
      };
      return q;
    },
  };
  return { db: db as never, inserted, tables };
}

const user = { id: 'u1', email: 'me@x.com', timezone: 'Asia/Kolkata' };
const row = (msg_id: string, expected: object[] | '') => ({
  id: 1, msg_id, direction: 'sent', sent_iso: '2026-11-19T10:00:00+05:30', from_addr: 'me@x.com', to_addr: 'bob@y.com', subject: 's',
  cleaned_text: 'I will send you the report by Friday.', expected_json: expected === '' ? '' : JSON.stringify(expected),
});
const goodItem = { type: 'my_promise', what: 'Send the report', counterpartyName: 'Bob', counterpartyEmail: '', due: '2026-11-20', dueText: 'Friday', needsDate: false, confidence: 0.9, evidence: 'I will send you the report by Friday.' };

describe('runEval', () => {
  test('scores a finished run and stores it', async () => {
    const { db, inserted } = fakeDb({ eval_set: [row('a', [{ type: 'my_promise', what: 'Send the report', due: '2026-11-20' }]), row('b', [])], eval_cache: [] });
    const gem = jest.fn(async (ctx: any) => (ctx.subject === 's' ? [goodItem] : []));
    const r = await runEval(db, user, 5000, gem);
    expect(r.finished).toBe(true);
    expect(r.labelled).toBe(2);
    expect(inserted.eval_runs).toHaveLength(1);
    expect(inserted.eval_runs[0]).toMatchObject({ user_id: 'u1', rows: 2 });
  });

  test('skips unlabelled rows', async () => {
    const { db } = fakeDb({ eval_set: [row('a', ''), row('b', [])], eval_cache: [] });
    const gem = jest.fn(async () => []);
    const r = await runEval(db, user, 5000, gem);
    expect(r.total).toBe(2);
    expect(r.labelled).toBe(1);
    expect(gem).toHaveBeenCalledTimes(1);
  });

  test('uses cached answers instead of calling the model again', async () => {
    const { db } = fakeDb({ eval_set: [row('a', [])], eval_cache: [{ msg_id: 'a', raw: [] }] });
    const gem = jest.fn(async () => []);
    const r = await runEval(db, user, 5000, gem);
    expect(gem).not.toHaveBeenCalled();
    expect(r.finished).toBe(true);
  });

  test('stops at the time budget and reports what is pending, without storing a run', async () => {
    const { db, inserted } = fakeDb({ eval_set: [row('a', []), row('b', []), row('c', [])], eval_cache: [] });
    const r = await runEval(db, user, -1, async () => []); // budget already used up
    expect(r.finished).toBe(false);
    expect(r.pending).toBe(3);
    expect(inserted.eval_runs).toBeUndefined();
  });

  test('an empty set is not "finished"', async () => {
    const { db } = fakeDb({ eval_set: [], eval_cache: [] });
    const r = await runEval(db, user, 5000, async () => []);
    expect(r.finished).toBe(false);
    expect(r.labelled).toBe(0);
  });
});
