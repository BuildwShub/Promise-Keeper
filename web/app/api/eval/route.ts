import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminClient } from '@/lib/supabase';
import { runEval } from '@/lib/eval';
import { CONFIG } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** /admin/eval "Run eval" button: plain form POST (session cookie required). Resumes from cached model answers. */
export async function POST(req: Request) {
  const json = new URL(req.url).searchParams.get('json') === '1'; // used by the Run eval button, which keeps calling until finished
  const back = (notice: string) => NextResponse.redirect(new URL(`/admin/eval?notice=${encodeURIComponent(notice)}`, req.url), 303);
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) return json ? NextResponse.json({ error: 'unauthorized' }, { status: 401 }) : NextResponse.redirect(new URL('/settings', req.url), 303);
  try {
    const db = adminClient();
    const { data: u } = await db.from('users').select('id,email,timezone').eq('id', uid).single();
    if (!u) return json ? NextResponse.json({ error: 'User not found' }, { status: 404 }) : back('User not found');
    const r = await runEval(db, u, CONFIG.RUN_BUDGET_MS);
    if (json) return NextResponse.json({ ok: true, labelled: r.labelled, done: r.done, pending: r.pending, finished: r.finished, gate: r.metrics?.gate });
    if (!r.labelled) return back('No labelled rows in your eval set yet. Import it first (scripts/migrate-sheet.js).');
    return back(r.finished ? `Eval finished on ${r.done} labelled rows. See the newest run below.` : `${r.done} of ${r.labelled} rows scored, ${r.pending} pending. Click Run eval again to continue.`);
  } catch (e) {
    if (json) return NextResponse.json({ ok: false, error: String((e as Error).message ?? e).slice(0, 140) }, { status: 500 });
    return back('Eval failed: ' + String((e as Error).message ?? e).slice(0, 140));
  }
}
