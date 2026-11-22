import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase';
import { bearer, secretMatches } from '@/lib/guard';
import { createNudgeDraft } from '@/lib/nudge';
import { accessFor } from '@/lib/actions';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Diagnostic: create one nudge draft and report the exact result or error. Authorization: Bearer CRON_SECRET. ?item=<item id> (default: the first waiting-on item). */
async function run(req: Request) {
  if (!secretMatches(bearer(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = adminClient();
  if (new URL(req.url).searchParams.get('list') === '1') {
    // List the newest drafts (recipient, subject, thread and a text snippet) to confirm what was created.
    const uid = (await db.from('users').select('id').limit(1).maybeSingle()).data?.id;
    if (!uid) return NextResponse.json({ error: 'no user' }, { status: 404 });
    const token = await accessFor(db, uid);
    const H = { Authorization: `Bearer ${token}` };
    const list = await (await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts?maxResults=5', { headers: H })).json();
    const out = [];
    for (const d of list.drafts ?? []) {
      const m = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${d.id}?format=metadata&metadataHeaders=To&metadataHeaders=Subject`, { headers: H })).json();
      const h = (n: string) => (m.message?.payload?.headers ?? []).find((x: { name: string }) => x.name === n)?.value;
      out.push({ id: d.id, messageId: m.message?.id, thread: m.message?.threadId, to: h('To'), subject: h('Subject'), snippet: String(m.message?.snippet ?? '').slice(0, 120) });
    }
    return NextResponse.json({ drafts: out });
  }
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
