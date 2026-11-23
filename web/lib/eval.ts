import type { SupabaseClient } from '@supabase/supabase-js';
import { Dates, Score, Validate } from './shared';
import { CONFIG } from './config';
import { geminiExtract } from './gemini';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface EvalOutcome { total: number; labelled: number; done: number; pending: number; finished: boolean; metrics?: any }

/**
 * Stage B version of Eval.run: re-runs the model over your labelled set and scores it with the SAME shared Score and Validate
 * modules as Stage A, so the gate means the same thing. Model answers are cached per prompt version + model, so a run that
 * hits the time budget resumes where it stopped. When nothing is pending, the result is stored in eval_runs.
 */
export async function runEval(db: SupabaseClient, user: { id: string; email: string; timezone: string }, budgetMs = 45_000, gemini: (ctx: any) => Promise<any[]> = geminiExtract): Promise<EvalOutcome> {
  const started = Date.now();
  const { data: set, error } = await db.from('eval_set').select('*').eq('user_id', user.id).order('id');
  if (error) throw new Error('eval set failed: ' + error.message);
  const rows = (set ?? []).map((r: any) => ({ r, expected: Score.parseExpected(r.expected_json) })).filter((x: any) => x.expected !== null);

  const { data: cached } = await db.from('eval_cache').select('msg_id,raw').eq('user_id', user.id).eq('prompt_version', CONFIG.PROMPT_VERSION).eq('model', CONFIG.GEMINI_MODEL);
  const raw = new Map<string, any[]>((cached ?? []).map((c: any) => [c.msg_id, c.raw]));

  const todo = rows.filter((x: any) => !raw.has(x.r.msg_id));
  let next = 0;
  const worker = async () => {
    for (;;) {
      if (Date.now() - started > budgetMs) return;
      const x: any = todo[next++];
      if (!x) return;
      const r = x.r;
      const items = await gemini({ userEmail: user.email, direction: r.direction, timezone: user.timezone, sentIso: r.sent_iso, from: r.from_addr, to: r.to_addr, cc: '', subject: r.subject, body: r.cleaned_text });
      raw.set(r.msg_id, items);
      await db.from('eval_cache').upsert({ user_id: user.id, prompt_version: CONFIG.PROMPT_VERSION, model: CONFIG.GEMINI_MODEL, msg_id: r.msg_id, raw: items }, { onConflict: 'user_id,prompt_version,model,msg_id' });
    }
  };
  // Hard stop shortly after the soft budget: Gemini rate-limit retries can sleep 5 + 10 + 20 s and would carry the run past Vercel's 60 s limit.
  // Answers already cached are kept; the next call resumes from them.
  const hardStop = new Promise<void>((r) => setTimeout(r, budgetMs + CONFIG.HARD_STOP_GRACE_MS - (Date.now() - started)));
  await Promise.race([Promise.all(Array.from({ length: Math.min(CONFIG.CONCURRENCY, todo.length) }, worker)), hardStop]);

  const done = rows.filter((x: any) => raw.has(x.r.msg_id));
  const pending = rows.length - done.length;
  const out: EvalOutcome = { total: (set ?? []).length, labelled: rows.length, done: done.length, pending, finished: pending === 0 && rows.length > 0 };
  if (!out.finished) return out;

  const scored = done.map((x: any) => {
    const v = Validate.validateItems(raw.get(x.r.msg_id), { cleanedText: x.r.cleaned_text, direction: x.r.direction, sentDate: Dates.localDateOf(x.r.sent_iso) });
    return { predicted: v.items, expected: x.expected };
  });
  const m = Score.computeMetrics(scored, { showThreshold: 0.6 });
  const sweep = Score.thresholdSweep(scored);
  await db.from('eval_runs').insert({
    user_id: user.id, prompt_version: CONFIG.PROMPT_VERSION, model: CONFIG.GEMINI_MODEL, rows: m.rows,
    shown_precision: m.shown.precision, shown_recall: m.shown.recall, overall_precision: m.overall.precision, overall_recall: m.overall.recall,
    date_accuracy: m.dateAccuracy, needs_date_accuracy: m.needsDateAccuracy, gate: !!m.gate, per_type: m.perType, sweep,
  });
  out.metrics = m;
  return out;
}
