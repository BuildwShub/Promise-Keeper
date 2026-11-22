import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase';
import { bearer, secretMatches } from '@/lib/guard';
import { runEval } from '@/lib/eval';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Run (or resume) the eval for the first user without a browser session. Authorization: Bearer CRON_SECRET. Call again until finished is true. */
async function run(req: Request) {
  if (!secretMatches(bearer(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = adminClient();
  const { data: u } = await db.from('users').select('id,email,timezone').limit(1).maybeSingle();
  if (!u) return NextResponse.json({ error: 'no user' }, { status: 404 });
  try {
    const r = await runEval(db, u, 45_000);
    return NextResponse.json({ total: r.total, labelled: r.labelled, done: r.done, pending: r.pending, finished: r.finished, gate: r.metrics?.gate, shown: r.metrics?.shown, dateAccuracy: r.metrics?.dateAccuracy });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e).slice(0, 300) }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
