import { deleteUserData, hashUserId } from '../lib/users';

// Minimal fake of the supabase-js query builder: records calls, returns canned counts.
function fakeDb(counts: Record<string, number>) {
  const calls: string[] = [];
  const inserted: unknown[] = [];
  const db = {
    from(table: string) {
      return {
        select: () => ({ eq: async () => ({ count: counts[table] ?? 0, error: null }) }),
        insert: async (row: unknown) => { calls.push(`insert:${table}`); inserted.push(row); return { error: null }; },
        delete: () => ({ eq: async () => { calls.push(`delete:${table}`); return { error: null }; } }),
      };
    },
  };
  return { db: db as never, calls, inserted };
}

describe('deleteUserData', () => {
  const uid = '11111111-2222-3333-4444-555555555555';

  test('logs a hash and row counts, then deletes the user', async () => {
    const { db, calls, inserted } = fakeDb({ items: 4, oauth_tokens: 1, events: 9 });
    const counts = await deleteUserData(db, uid);
    expect(counts.items).toBe(4);
    expect(counts.oauth_tokens).toBe(1);
    expect(calls).toEqual(['insert:deletion_log', 'delete:users']);
    const row = inserted[0] as { user_hash: string; rows_deleted: Record<string, number> };
    expect(row.user_hash).toBe(hashUserId(uid));
    expect(row.rows_deleted.events).toBe(9);
  });

  test('the log never contains the raw id or an email', async () => {
    const { db, inserted } = fakeDb({});
    await deleteUserData(db, uid);
    expect(JSON.stringify(inserted)).not.toContain(uid);
    expect(JSON.stringify(inserted)).not.toContain('@');
  });
});

describe('hashUserId', () => {
  test('is stable, short and not the id', () => {
    const uid = '11111111-2222-3333-4444-555555555555';
    expect(hashUserId(uid)).toBe(hashUserId(uid));
    expect(hashUserId(uid)).toHaveLength(16);
    expect(hashUserId(uid)).not.toContain('1111');
  });
});
