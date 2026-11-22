import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase';
import { bearer, secretMatches } from '@/lib/guard';
import { createNudgeDraft } from '@/lib/nudge';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Diagnostic: create one nudge draft and report the exact result or error. Authorization: Bearer CRON_SECRET. ?item=<item id> (default: the first waiting-on item). */
async function run(req: Request) {
  if (!secretMatches(bearer(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = adminClient();
  let itemId = new URL(req.url).searchParams.get('item');
  let userId: string | undefined;
  if (itemId) {
    userId = (await db.from('items').select('user_id').eq('id', itemId).maybeSingle()).data?.user_id;
  } else {
    const it = (await db.from('items').select('id,user_id').eq('type', 'waiting_on').in('status', ['accepted', 'suggested', 'possibly_resolved']).limit(1).maybeSingle()).data;
    itemId = it?.id ?? null; userId = it?.user_id;
  }
  if (!itemId || !userId) return NextResponse.json({ error: 'no waiting-on item found' }, { status: 404 });
  try {
    return NextResponse.json({ ok: true, ...(await createNudgeDraft(db, userId, itemId)) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message ?? e).slice(0, 400) });
  }
}

export const GET = run;
export const POST = run;
