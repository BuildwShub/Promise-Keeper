import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase';
import { secretMatches } from '@/lib/guard';
import { handlePush } from '@/lib/intake';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Gmail push notifications arrive here from a Pub/Sub push subscription.
 * Subscription endpoint: https://<site>/api/gmail/push?token=<CRON_SECRET>
 * Body: { message: { data: base64('{"emailAddress":"...","historyId":"..."}') } }
 * It only enqueues message ids; the sweep (or the next push) processes them.
 */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  if (!secretMatches(token)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const data = JSON.parse(Buffer.from(String(body?.message?.data ?? ''), 'base64').toString('utf8'));
    if (!data.emailAddress || !data.historyId) return new NextResponse(null, { status: 204 }); // not ours: ack so Pub/Sub stops retrying
    const r = await handlePush(adminClient(), String(data.emailAddress), String(data.historyId));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e).slice(0, 200) }, { status: 500 }); // 500 makes Pub/Sub retry
  }
}
