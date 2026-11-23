import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { userClient } from '@/lib/supabase';
import { computeMetrics } from '@/lib/metrics';
import MetricsView from '@/components/MetricsView';
import MetricsCharts from '@/components/MetricsCharts';
import { chartData } from '@/lib/chartdata';

export const metadata = { title: 'Metrics · Promise Keeper' };
export const dynamic = 'force-dynamic';

export default async function Metrics() {
  const s = await auth();
  const uid = (s?.user as { id?: string } | undefined)?.id;
  if (!uid) redirect('/settings');
  const db = userClient(uid);
  const { data: me } = await db.from('users').select('timezone').eq('id', uid).maybeSingle();
  const tz = me?.timezone ?? 'Asia/Kolkata';
  // Both read-only and independent: run together.
  const [{ rows }, charts] = await Promise.all([computeMetrics(db, uid, tz), chartData(db, uid, tz)]);
  return <MetricsView rows={rows}><MetricsCharts data={charts} /></MetricsView>;
}
