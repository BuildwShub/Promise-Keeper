import type { SupabaseClient } from '@supabase/supabase-js';
import { localDateIn } from './metrics';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ChartData {
  today: string;
  items: { c: string; s: string; t: string; due: string; w: string }[];
  digest: { d: string; k: 'sent' | 'engaged' }[];
  evals: { v: string; p: number | null; r: number | null; da: number | null; ts: string }[];
}

/** Small, already-localised rows for the Metrics graphs. Runs as the signed-in user (row-level security). */
export async function chartData(db: SupabaseClient, userId: string, tz: string): Promise<ChartData> {
  const local = localDateIn(tz);
  const [items, events, evals] = await Promise.all([
    db.from('items').select('status,type,what,due,created_at').eq('user_id', userId),
    db.from('events').select('ts,event').eq('user_id', userId).in('event', ['digest_sent', 'digest_open', 'digest_click']),
    db.from('eval_runs').select('ts,prompt_version,shown_precision,shown_recall,date_accuracy').eq('user_id', userId).order('ts', { ascending: true }),
  ]);
  for (const r of [items, events, evals]) if (r.error) throw new Error('chart query failed: ' + r.error.message);
  const n = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
  return {
    today: local(new Date().toISOString()),
    items: (items.data ?? []).map((i: any) => ({ c: local(i.created_at), s: i.status, t: i.type, due: i.due ?? '', w: String(i.what ?? '').slice(0, 60) })),
    digest: (events.data ?? []).map((e: any) => ({ d: local(e.ts), k: e.event === 'digest_sent' ? 'sent' as const : 'engaged' as const })),
    evals: (evals.data ?? []).map((e: any) => ({ v: e.prompt_version, p: n(e.shown_precision), r: n(e.shown_recall), da: n(e.date_accuracy), ts: e.ts })),
  };
}
