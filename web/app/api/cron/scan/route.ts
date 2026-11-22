import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase';
import { bearer, secretMatches } from '@/lib/guard';
import { sweepUser } from '@/lib/intake';
import { CONFIG } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Scheduled sweep (plan.md Phase 7): safety net for missed pushes, queue drain, watch renewal. Header: Authorization: Bearer CRON_SECRET. */
async function run(req: Request) {
  if (!secretMatches(bearer(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const backfill = new URL(req.url).searchParams.get('backfill') === '1'; // rescan the 30-day window (retries earlier failures)
  const db = adminClient();
  const deadline = Date.now() + CONFIG.RUN_BUDGET_MS;
  const { data: users, error } = await db.from('users').select('id,email,timezone');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const results: Record<string, unknown>[] = [];
  for (const u of users ?? []) {
    if (Date.now() > deadline) { results.push({ user: u.id, skipped: 'budget' }); continue; }
    try {
      results.push({ user: u.id, ...(await sweepUser(db, u, deadline, backfill)) });
    } catch (e) {
      results.push({ user: u.id, error: String((e as Error).message ?? e).slice(0, 200) });
    }
  }
  return NextResponse.json({ ok: true, users: results.length, results });
}

export const GET = run;
export const POST = run;
