import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase';
import { bearer, secretMatches } from '@/lib/guard';
import { sendDigest } from '@/lib/digest';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Manual digest trigger for testing: Authorization: Bearer CRON_SECRET. ?force=1 ignores the hour and the once-per-day rule. */
async function run(req: Request) {
  if (!secretMatches(bearer(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const force = new URL(req.url).searchParams.get('force') === '1';
  const db = adminClient();
  const { data: users, error } = await db.from('users').select('id,email,timezone,digest_hour');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const results: unknown[] = [];
  for (const u of users ?? []) {
    try { results.push({ user: u.id, ...(await sendDigest(db, u, { force })) }); }
    catch (e) { results.push({ user: u.id, error: String((e as Error).message ?? e).slice(0, 200) }); }
  }
  return NextResponse.json({ ok: true, results });
}

export const GET = run;
export const POST = run;
