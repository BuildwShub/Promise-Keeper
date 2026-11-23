import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { userClient } from '@/lib/supabase';
import { computeMetrics } from '@/lib/metrics';

export const metadata = { title: 'Metrics · Promise Keeper' };
export const dynamic = 'force-dynamic';

const LABEL: Record<string, string> = {
  items_total: 'Items found',
  accept_rate: 'Accept rate',
  edit_rate: 'Edit rate',
  on_time_rate: 'On-time rate',
  on_time_rate_week1: 'On-time rate, week 1',
  on_time_rate_week4: 'On-time rate, week 4',
  digests_sent: 'Digests sent',
  digest_engaged_days: 'Days engaged with the digest',
  digest_retention_d7: 'Digest retention, day 7',
  digest_retention_d30: 'Digest retention, day 30',
  extraction_precision: 'Extraction precision (latest eval)',
};

export default async function Metrics() {
  const s = await auth();
  const uid = (s?.user as { id?: string } | undefined)?.id;
  if (!uid) redirect('/settings');
  const db = userClient(uid);
  const { data: me } = await db.from('users').select('timezone').eq('id', uid).maybeSingle();
  const { rows } = await computeMetrics(db, uid, me?.timezone ?? 'Asia/Kolkata');

  return (
    <main className="flat">
      <h1>Metrics</h1>
      <p className="muted">Computed live from your items, decisions and events. Rates show n/a until there is enough data to judge.</p>
      <div className="mgrid">
        {rows.map((r) => (
          <div key={r.metric} className="mcard">
            <span>{LABEL[r.metric] ?? r.metric}</span>
            <b>{String(r.value)}</b>
            <small>{r.detail}</small>
          </div>
        ))}
      </div>
    </main>
  );
}
