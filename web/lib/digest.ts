import type { SupabaseClient } from '@supabase/supabase-js';
import { DigestFmt } from './shared';
import { localDateIn } from './metrics';
import { sendEmail } from './resend';
import { trackToken } from './track';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type DigestResult = { status: 'sent' | 'skipped' | 'not_due'; detail?: unknown };

const siteBase = () => (process.env.ADDON_BASE_URL || 'https://promise-keeper-omega.vercel.app').replace(/\/$/, '');

/** Hour of day (0-23) in a timezone. */
function hourIn(tz: string, d = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(d));
}

/**
 * Send the morning digest once per local day, on the first call at or after the user's digest hour.
 * Empty digests are skipped but the day still counts as handled. `force` ignores hour and day (for tests).
 */
export async function sendDigest(db: SupabaseClient, user: { id: string; email: string; timezone: string; digest_hour?: number }, opts: { force?: boolean } = {}): Promise<DigestResult> {
  const { data: u } = await db.from('users').select('digest_hour').eq('id', user.id).maybeSingle();
  const digestHour = user.digest_hour ?? u?.digest_hour ?? 8;
  const localDate = localDateIn(user.timezone);
  const today = localDate(new Date().toISOString());

  if (!opts.force) {
    if (hourIn(user.timezone) < digestHour) return { status: 'not_due' };
    const { data: last } = await db.from('events').select('ts').eq('user_id', user.id).in('event', ['digest_sent', 'digest_skipped']).order('ts', { ascending: false }).limit(1).maybeSingle();
    if (last && localDate(last.ts) === today) return { status: 'not_due' };
  }

  const { data, error } = await db.from('items').select('id,thread_id,type,what,due,status,counterparty_name').eq('user_id', user.id).in('status', ['accepted', 'possibly_resolved']);
  if (error) throw new Error('digest items failed: ' + error.message);
  const items = (data ?? []).map((r: any) => ({ itemId: r.id, threadId: r.thread_id, type: r.type, what: r.what, due: r.due ?? '', status: r.status, counterpartyName: r.counterparty_name }));

  const d = DigestFmt.buildDigest(items, today, { trackBase: `${siteBase()}/api/track`, uid: trackToken(user.id), accountEmail: user.email });
  if (!d) {
    await db.from('events').insert({ user_id: user.id, event: 'digest_skipped', meta: { reason: 'nothing to report' } });
    return { status: 'skipped', detail: 'nothing to report' };
  }
  const sent = await sendEmail({ to: user.email, subject: d.subject, html: d.html, text: d.text });
  await db.from('events').insert({ user_id: user.id, event: 'digest_sent', meta: { ...d.counts, resendId: sent.id } });
  return { status: 'sent', detail: d.counts };
}
