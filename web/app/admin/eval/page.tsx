import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { userClient } from '@/lib/supabase';
import { CONFIG } from '@/lib/config';

export const metadata = { title: 'Eval · Promise Keeper' };
export const dynamic = 'force-dynamic';

const pct = (v: number | null) => (v === null || v === undefined ? 'n/a' : `${Math.round(Number(v) * 1000) / 10}%`);

export default async function EvalPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const s = await auth();
  const uid = (s?.user as { id?: string } | undefined)?.id;
  if (!uid) redirect('/settings');
  const { notice } = await searchParams;
  const db = userClient(uid);

  const [{ data: set }, { data: runs }] = await Promise.all([
    db.from('eval_set').select('expected_json,tags'),
    db.from('eval_runs').select('ts,prompt_version,model,rows,shown_precision,shown_recall,date_accuracy,gate').order('ts', { ascending: false }).limit(8),
  ]);
  const labelled = (set ?? []).filter((r) => r.expected_json && r.expected_json.trim() !== '').length;

  return (
    <main>
      <h1>Eval</h1>
      <p className="muted">Re-runs the model over your hand-labelled emails with the same scoring and pass/fail gate as the add-on. Use it before changing the prompt.</p>
      <p>Current prompt <b>{CONFIG.PROMPT_VERSION}</b> · model <b>{CONFIG.GEMINI_MODEL}</b> · eval set: <b>{(set ?? []).length}</b> emails, <b>{labelled}</b> labelled.</p>
      {notice && <p style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 6 }}>{notice}</p>}
      <form method="post" action="/api/eval"><button type="submit" disabled={!labelled}>Run eval</button></form>
      {!labelled && <p className="muted">The eval set is empty. Import it from your Stage A sheet with <code>scripts/migrate-sheet.js</code>.</p>}

      <h2>Recent runs</h2>
      {(runs ?? []).length === 0 ? <p className="muted">No runs yet.</p> : (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr><th align="left">When</th><th align="left">Prompt</th><th align="left">Rows</th><th align="left">Precision</th><th align="left">Recall</th><th align="left">Date acc.</th><th align="left">Gate</th></tr></thead>
          <tbody>
            {(runs ?? []).map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 8px 6px 0' }}>{new Date(r.ts).toISOString().slice(0, 16).replace('T', ' ')}</td>
                <td>{r.prompt_version}</td><td>{r.rows}</td><td>{pct(r.shown_precision)}</td><td>{pct(r.shown_recall)}</td><td>{pct(r.date_accuracy)}</td>
                <td style={{ fontWeight: 700, color: r.gate ? '#188038' : '#d93025' }}>{r.gate ? 'PASS' : 'FAIL'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
