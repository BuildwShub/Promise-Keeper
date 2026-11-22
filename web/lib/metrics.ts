import type { SupabaseClient } from '@supabase/supabase-js';
import { MetricsFmt } from './shared';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Local date (yyyy-MM-dd) of a timestamp in a timezone. */
export function localDateIn(tz: string) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  return (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? String(iso).slice(0, 10) : f.format(d);
  };
}

/** Same metrics as the add-on's Metrics tab, computed from Postgres rows (snake_case mapped to the shared camelCase shape). */
export async function computeMetrics(db: SupabaseClient, userId: string, tz: string) {
  const [items, feedback, events, evals] = await Promise.all([
    db.from('items').select('status,due,completed_at,created_at').eq('user_id', userId),
    db.from('feedback').select('item_id,action,before_json').eq('user_id', userId),
    db.from('events').select('ts,event,meta').eq('user_id', userId),
    db.from('eval_runs').select('*').eq('user_id', userId).order('ts', { ascending: true }),
  ]);
  for (const r of [items, feedback, events, evals]) if (r.error) throw new Error('metrics query failed: ' + r.error.message);
  const localDate = localDateIn(tz);
  return MetricsFmt.compute(
    {
      items: (items.data ?? []).map((i: any) => ({ status: i.status, due: i.due ?? '', completedAt: i.completed_at ?? '', createdAt: i.created_at })),
      feedback: (feedback.data ?? []).map((f: any) => ({ itemId: f.item_id, action: f.action, beforeJson: JSON.stringify(f.before_json ?? {}) })),
      events: (events.data ?? []).map((e: any) => ({ ts: e.ts, event: e.event, meta: e.meta ?? {} })),
      evalRuns: (evals.data ?? []).map((e: any) => ({ promptVersion: e.prompt_version, shownPrecision: e.shown_precision, dateAccuracy: e.date_accuracy, gate: e.gate ? 'PASS' : 'FAIL' })),
    },
    { today: localDate(new Date().toISOString()), localDate },
  ) as { rows: { metric: string; value: string | number; detail: string }[]; summary: Record<string, unknown> };
}
