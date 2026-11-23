import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminClient } from '@/lib/supabase';
import { scanNow, scanState } from '@/lib/intake';
import { CONFIG } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function uid(): Promise<string | null> {
  const s = await auth();
  return (s?.user as { id?: string } | undefined)?.id ?? null;
}

/** Progress for the signed-in user only. */
export async function GET() {
  const id = await uid();
  if (!id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(await scanState(adminClient(), id));
}

/** Read for about 30 seconds, then report progress. The page calls this again until nothing is queued. */
export async function POST() {
  const id = await uid();
  if (!id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = adminClient();
  const { data: u } = await db.from('users').select('id,email,timezone').eq('id', id).maybeSingle();
  if (!u) return NextResponse.json({ error: 'unknown user' }, { status: 404 });
  try {
    const r = await scanNow(db, u, Date.now() + CONFIG.RUN_BUDGET_MS);
    return NextResponse.json({ ok: true, queued: r.queued, processed: r.processed, newItems: r.newItems, errors: r.errors });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message ?? e).slice(0, 200) }, { status: 500 });
  }
}
