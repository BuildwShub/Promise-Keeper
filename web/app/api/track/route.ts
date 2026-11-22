import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase';
import { safeGmailUrl, verifyTrackToken } from '@/lib/track';

export const dynamic = 'force-dynamic';

// 1x1 transparent GIF
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

/**
 * Digest tracking. ?e=open (pixel) or ?e=click&u=<gmail url>. The user token is signed, so events cannot be forged for others.
 * Clicks only ever redirect to mail.google.com.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const userId = verifyTrackToken(q.get('uid'));
  const e = q.get('e');

  if (userId && (e === 'open' || e === 'click')) {
    try {
      await adminClient().from('events').insert({ user_id: userId, event: e === 'open' ? 'digest_open' : 'digest_click', meta: { item: q.get('i') ?? undefined, d: q.get('d') ?? undefined } });
    } catch { /* tracking must never break the page */ }
  }

  if (e === 'click') {
    const target = safeGmailUrl(q.get('u'));
    return target ? NextResponse.redirect(target, 302) : new NextResponse('Link not allowed', { status: 400 });
  }
  return new NextResponse(PIXEL, { headers: { 'content-type': 'image/gif', 'cache-control': 'no-store, max-age=0' } });
}
