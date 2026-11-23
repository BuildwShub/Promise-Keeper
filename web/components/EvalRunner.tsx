'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Run eval: keeps asking the server to score more rows (about 30 s each) until the run is finished, then reloads the results. */
export default function EvalRunner({ labelled }: { labelled: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  async function run() {
    if (running.current) return;
    running.current = true; setBusy(true); setMsg('Starting…');
    try {
      for (let i = 0; i < 60; i++) {
        const res = await fetch('/api/eval?json=1', { method: 'POST' });
        const j = await res.json();
        if (!res.ok || !j.ok) throw new Error(j.error || 'failed');
        if (j.finished) { setMsg(`Finished: ${j.done} rows scored. ${j.gate ? 'Gate PASS.' : 'Gate FAIL.'}`); router.refresh(); return; }
        setMsg(`${j.done} of ${j.labelled} rows scored…`);
      }
      setMsg('Stopped after 60 steps. Click Run eval to continue.');
    } catch (e) {
      setMsg('Paused (' + String((e as Error).message ?? e) + '). Click Run eval to continue where it stopped.');
    } finally { running.current = false; setBusy(false); }
  }

  return (
    <div>
      <button type="button" onClick={run} disabled={!labelled || busy}>{busy ? 'Running…' : 'Run eval'}</button>
      {msg && <p role="status" aria-live="polite" className="muted" style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  );
}
