import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { encrypt } from './crypto';

/** Create or update the user row by Google subject id. Returns users.id (uuid). */
export async function upsertUser(db: SupabaseClient, p: { sub: string; email: string; name?: string | null }): Promise<string> {
  const { data, error } = await db
    .from('users')
    .upsert({ google_sub: p.sub, email: p.email, name: p.name ?? null }, { onConflict: 'google_sub' })
    .select('id')
    .single();
  if (error || !data) throw new Error('upsertUser failed: ' + (error?.message ?? 'no row'));
  return data.id as string;
}

/** Store the refresh token encrypted. Google only returns one on first consent (or prompt=consent), so keep the old one otherwise. */
export async function saveRefreshToken(db: SupabaseClient, userId: string, refreshToken: string, scopes: string): Promise<void> {
  const { error } = await db.from('oauth_tokens').upsert(
    { user_id: userId, refresh_token_enc: encrypt(refreshToken), scopes, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );
  if (error) throw new Error('saveRefreshToken failed: ' + error.message);
}

const USER_TABLES = ['items', 'processed_messages', 'feedback', 'events', 'settings', 'eval_runs', 'message_queue', 'oauth_tokens'] as const;

/** One-way hash of the user id for the deletion log (never the email). */
export function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 16);
}

/**
 * Delete everything for one user (plan.md Phase 7: account deletion removes rows and tokens).
 * Counts rows per table, writes a log row with the hash and counts only, then deletes the user (cascade removes the rest).
 */
export async function deleteUserData(db: SupabaseClient, userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const t of USER_TABLES) {
    const { count, error } = await db.from(t).select('*', { count: 'exact', head: true }).eq('user_id', userId);
    if (error) throw new Error(`count ${t} failed: ${error.message}`);
    counts[t] = count ?? 0;
  }
  const log = await db.from('deletion_log').insert({ user_hash: hashUserId(userId), rows_deleted: counts });
  if (log.error) throw new Error('deletion log failed: ' + log.error.message);
  const del = await db.from('users').delete().eq('id', userId);
  if (del.error) throw new Error('delete user failed: ' + del.error.message);
  return counts;
}
