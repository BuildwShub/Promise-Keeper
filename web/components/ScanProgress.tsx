'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Shown while the first scan is running. Keeps asking the server to read more mail, then refreshes the list. */
export default function ScanProgress({ queued, processed }: { queued: number; processed: number }) {
  const router = useRouter();
  const [state, setState] = useState({ queued, processed });
  const [status, setStatus] = useState<'running' | 'paused' | 'done'>('running');
  const started = useRef(false);
  const startTotal = useRef(queued);

  useEffect(() => {
    if (started.current) return; // one loop only (React strict mode runs effects twice in dev)
    started.current = true;
    (async () => {
      let stuck = 0;
      for (let i = 0; i < 30; i++) {
        try {
          const res = await fetch('/api/scan', { method: 'POST' });
          const j = await res.json();
          if (!res.ok || !j.ok) throw new Error(j.error || 'scan failed');
          setState({ queued: j.queued, processed: j.processed });
          if (j.queued > startTotal.current) startTotal.current = j.queued; // first run just queued the mailbox
          router.refresh(); // show items as they are found
          if (j.queued === 0) { setStatus('done'); return; }
          stuck = j.newItems === 0 && j.errors > 0 ? stuck + 1 : 0;
          if (stuck >= 3) throw new Error('no progress');
        } catch {
          try { const g = await (await fetch('/api/scan')).json(); if (typeof g.queued === 'number') setState(g); } catch { /* keep the old numbers */ }
          setStatus('paused'); // the 5-minute background scan keeps going
          return;
        }
      }
      setStatus('paused');
    })();
  }, [router]);

  if (status === 'done') return null;
  const total = Math.max(startTotal.current, state.queued, 1);
  const read = Math.max(0, total - state.queued);
  const pct = Math.min(100, Math.round((read / total) * 100));
  return (
    <div className="scanbar" role="status" aria-live="polite">
      <div className="scanrow"><b>{status === 'running' ? 'Reading your recent email' : 'Reading paused'}</b><span>{status === 'running' ? `${read} of ${total} emails` : 'It continues in the background'}</span></div>
      <div className="scantrack"><div className="scanfill" style={{ width: `${pct}%` }} /></div>
      <p>Newest mail first. Items appear below as they are found.</p>
    </div>
  );
}
