'use client';
import { useMemo, useState } from 'react';
import type { ChartData } from '@/lib/chartdata';

const BLUE = '#4285F4', GREEN = '#34A853', YELLOW = '#FBBC04', RED = '#EA4335', GREY = '#9aa0a6', LGREEN = '#81c995';
const DAY = 86400000;
const t = (d: string) => Date.parse(d + 'T00:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => iso(t(d) + n * DAY);
const short = (d: string) => new Date(t(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const STATUS: { key: string; label: string; c: string }[] = [
  { key: 'suggested', label: 'Suggested', c: BLUE }, { key: 'accepted', label: 'Accepted', c: GREEN }, { key: 'dismissed', label: 'Dismissed', c: GREY }, { key: 'done', label: 'Done', c: LGREEN },
];
const TYPES: { key: string; label: string; c: string }[] = [
  { key: 'waiting_on', label: 'Waiting on them', c: GREEN }, { key: 'my_promise', label: 'I promised', c: BLUE }, { key: 'request_to_me', label: 'Asked of me', c: YELLOW }, { key: 'deadline', label: 'Deadline', c: RED },
];

interface Tip { x: number; y: number; title: string; lines: string[] }

function Card({ n, title, q, tip, controls, children, tipState }: { n: number; title: string; q: string; tip: string; controls?: React.ReactNode; children: React.ReactNode; tipState: Tip | null }) {
  return (
    <section className="gcard">
      <div className="gh"><div><b>{n}  {title}</b><span>{q}</span></div><details className="info"><summary aria-label={`About ${title}`} title={tip}>i</summary><div role="tooltip">{tip}</div></details></div>
      {controls && <div className="gctl">{controls}</div>}
      <div className="gbody">{children}{tipState && <div className="gtip" style={{ left: tipState.x, top: tipState.y }}><b>{tipState.title}</b>{tipState.lines.map((l, i) => <div key={i}>{l}</div>)}</div>}</div>
    </section>
  );
}
const Chips = ({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) => (
  <div className="chipsel">{options.map(([k, l]) => <button type="button" key={k} className={k === value ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}</div>
);

export default function MetricsCharts({ data }: { data: ChartData }) {
  const { today } = data;
  const [preset, setPreset] = useState('14');
  const [custom, setCustom] = useState<{ from: string; to: string }>({ from: addDays(today, -13), to: today });
  const firstDate = useMemo(() => data.items.map((i) => i.c).sort()[0] ?? today, [data.items, today]);
  const range = useMemo(() => {
    if (preset === 'custom') return custom;
    if (preset === 'all') return { from: firstDate, to: today };
    return { from: addDays(today, -(Number(preset) - 1)), to: today };
  }, [preset, custom, firstDate, today]);
  const span = Math.max(1, Math.round((t(range.to) - t(range.from)) / DAY) + 1);

  // ---- 1: items per bucket (day or week)
  const [hidden, setHidden] = useState<string[]>([]);
  const [tip1, setTip1] = useState<Tip | null>(null);
  const weekly = span > 31;
  const buckets = useMemo(() => {
    const out: { start: string; label: string; counts: Record<string, number> }[] = [];
    const step = weekly ? 7 : 1;
    for (let d = range.from; t(d) <= t(range.to); d = addDays(d, step)) out.push({ start: d, label: weekly ? short(d) : String(new Date(t(d)).getUTCDate()), counts: {} });
    for (const it of data.items) {
      if (it.c < range.from || it.c > range.to) continue;
      const idx = Math.min(out.length - 1, Math.floor((t(it.c) - t(range.from)) / DAY / step));
      if (idx >= 0) out[idx].counts[it.s] = (out[idx].counts[it.s] ?? 0) + 1;
    }
    return out;
  }, [data.items, range, weekly]);
  const shown = STATUS.filter((s) => !hidden.includes(s.key));
  const maxStack = Math.max(1, ...buckets.map((b) => shown.reduce((a, s) => a + (b.counts[s.key] ?? 0), 0)));
  const W1 = 720, H1 = Math.max(70, Math.min(200, maxStack * 19 + 14)), padL = 10, bwAll = (W1 - padL) / Math.max(1, buckets.length);

  // ---- 2: donut by type
  const [hoverType, setHoverType] = useState<string | null>(null);
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of data.items) if (it.c >= range.from && it.c <= range.to) m[it.t] = (m[it.t] ?? 0) + 1;
    return m;
  }, [data.items, range]);
  const typeTotal = Object.values(typeCounts).reduce((a, b) => a + b, 0);

  // ---- 3: coming up (own horizon)
  const [horizon, setHorizon] = useState('14');
  const [tip3, setTip3] = useState<Tip | null>(null);
  const hz = Number(horizon);
  const upcoming = useMemo(() => {
    const open = data.items.filter((i) => i.due && ['suggested', 'accepted', 'possibly_resolved'].includes(i.s));
    const days: { d: string; items: string[] }[] = Array.from({ length: hz }, (_, i) => ({ d: addDays(today, i), items: [] }));
    const late: string[] = [];
    for (const it of open) { if (it.due < today) late.push(it.w); else { const k = Math.round((t(it.due) - t(today)) / DAY); if (k < hz) days[k].items.push(it.w); } }
    return { days, late };
  }, [data.items, hz, today]);
  const max3 = Math.max(1, upcoming.late.length, ...upcoming.days.map((d) => d.items.length));
  const H3 = Math.max(80, Math.min(190, max3 * 19 + 46)), base3 = H3 - 28;

  // ---- 4: digest strip
  const [tip4, setTip4] = useState<Tip | null>(null);
  const cells = useMemo(() => {
    const sent = new Set(data.digest.filter((e) => e.k === 'sent').map((e) => e.d)), eng = new Set(data.digest.filter((e) => e.k === 'engaged').map((e) => e.d));
    const days = Math.min(span, 90); const out: { d: string; k: 'engaged' | 'sent' | 'none' }[] = [];
    for (let i = days - 1; i >= 0; i--) { const d = addDays(range.to, -i); out.push({ d, k: eng.has(d) ? 'engaged' : sent.has(d) ? 'sent' : 'none' }); }
    return out;
  }, [data.digest, range, span]);
  const engagedCount = cells.filter((c) => c.k === 'engaged').length;

  // ---- 5: accuracy by version
  const [metric, setMetric] = useState<'p' | 'r' | 'da'>('p');
  const [tip5, setTip5] = useState<Tip | null>(null);
  const versions = useMemo(() => { const m = new Map<string, ChartData['evals'][number]>(); for (const e of data.evals) m.set(e.v, e); return [...m.values()]; }, [data.evals]);
  const MLAB = { p: 'Precision', r: 'Recall', da: 'Date accuracy' } as const;

  const move = (set: (t: Tip | null) => void, e: React.MouseEvent, title: string, lines: string[]) => {
    const box = (e.currentTarget as HTMLElement).closest('.gbody')!.getBoundingClientRect();
    set({ x: Math.min(box.width - 190, Math.max(0, e.clientX - box.left + 10)), y: Math.max(0, e.clientY - box.top - 56), title, lines });
  };

  return (
    <section className="trends">
      <h2 className="msec">Trends</h2>
      <div className="rangebar">
        <span>Date range</span>
        <Chips options={[['7', '7 days'], ['14', '14 days'], ['30', '30 days'], ['90', '90 days'], ['all', 'All time'], ['custom', 'Custom']]} value={preset} onChange={setPreset} />
        {preset === 'custom' && (
          <span className="daterange">
            <input type="date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} aria-label="From date" />
            <i>to</i>
            <input type="date" value={custom.to} min={custom.from} max={today} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} aria-label="To date" />
          </span>
        )}
        <em>{short(range.from)} to {short(range.to)}</em>
      </div>

      <Card n={1} title="Items found" q={weekly ? 'Per week. Click a legend item to hide it.' : 'Per day. Click a legend item to hide it.'} tip="Items created in the date range, stacked by what happened to them. Hover a bar for the counts." tipState={tip1}>
        <svg viewBox={`0 0 ${W1} ${H1 + 28}`} className="svg" onMouseLeave={() => setTip1(null)}>
          <line x1={padL} x2={W1} y1={H1} y2={H1} stroke="#e8eaed" />
          {buckets.map((b, i) => {
            const w = Math.max(6, Math.min(30, bwAll * 0.62)), x = padL + i * bwAll + (bwAll - w) / 2;
            const blk = Math.min(16, (H1 - 10) / maxStack), gap = Math.min(3, blk * 0.2);
            let y = H1 - 2;
            return (
              <g key={b.start} onMouseMove={(e) => move(setTip1, e, weekly ? `Week of ${short(b.start)}` : short(b.start), STATUS.map((s) => `${s.label}: ${b.counts[s.key] ?? 0}`))}>
                <rect x={padL + i * bwAll} y={0} width={bwAll} height={H1} fill="transparent" />
                {shown.flatMap((s) => Array.from({ length: b.counts[s.key] ?? 0 }, (_, k) => { y -= blk; return <rect key={s.key + k} x={x} y={y} width={w} height={blk - gap} rx={Math.min(4, (blk - gap) / 3)} fill={s.c} />; }))}
                {(buckets.length <= 16 || i % Math.ceil(buckets.length / 12) === 0) && <text x={x + w / 2} y={H1 + 16} fontSize="10" fill="#80868b" textAnchor="middle">{b.label}</text>}
              </g>
            );
          })}
        </svg>
        <div className="legend2">{STATUS.map((s) => <button type="button" key={s.key} className={hidden.includes(s.key) ? 'off' : ''} onClick={() => setHidden(hidden.includes(s.key) ? hidden.filter((h) => h !== s.key) : [...hidden, s.key])}><i style={{ background: s.c }} />{s.label}</button>)}</div>
      </Card>

      <div className="gpair">
        <Card n={2} title="What kind of items" q="Items found in the date range." tip="Share of items by type for the selected date range. Hover a slice or a legend line." tipState={null}>
          <div className="donutwrap">
            <svg viewBox="0 0 160 160" width="160" height="160">
              {(() => { let a0 = -Math.PI / 2; const r = 62; return typeTotal === 0 ? <circle cx="80" cy="80" r={r} fill="none" stroke="#e8eaed" strokeWidth="22" /> : TYPES.filter((x) => typeCounts[x.key]).map((x) => { const f = typeCounts[x.key] / typeTotal, a1 = a0 + f * 2 * Math.PI; const gap = Object.keys(typeCounts).length > 1 ? 0.03 : 0, s0 = a0 + gap, s1 = a1 - gap; const big = s1 - s0 > Math.PI ? 1 : 0;
                const full = f > 0.999; const q = (v: number) => Math.round(v * 100) / 100; const d = full ? '' : `M ${q(80 + r * Math.cos(s0))} ${q(80 + r * Math.sin(s0))} A ${r} ${r} 0 ${big} 1 ${q(80 + r * Math.cos(s1))} ${q(80 + r * Math.sin(s1))}`; a0 = a1;
                return full ? <circle key={x.key} cx="80" cy="80" r={r} fill="none" stroke={x.c} strokeWidth="22" /> : <path key={x.key} d={d} fill="none" stroke={x.c} strokeWidth={hoverType === x.key ? 28 : 22} onMouseEnter={() => setHoverType(x.key)} onMouseLeave={() => setHoverType(null)} />; }); })()}
              <text x="80" y="78" textAnchor="middle" fontSize="26" fontWeight="700" fill="#202124">{hoverType ? typeCounts[hoverType] : typeTotal}</text>
              <text x="80" y="98" textAnchor="middle" fontSize="11" fill="#5f6368">{hoverType ? TYPES.find((x) => x.key === hoverType)!.label : 'items'}</text>
            </svg>
            <ul>{TYPES.map((x) => <li key={x.key} onMouseEnter={() => setHoverType(x.key)} onMouseLeave={() => setHoverType(null)} className={hoverType === x.key ? 'hl' : ''}><i style={{ background: x.c }} />{x.label}<b>{typeCounts[x.key] ?? 0}</b></li>)}</ul>
          </div>
        </Card>

        <Card n={3} title="Coming up" q="Open items by due date, from today." tip="Open items by due date. Overdue items are on the left in red. Hover a day to see which items. Not affected by the date range above." controls={<Chips options={[['7', 'Next 7 days'], ['14', '14 days'], ['30', '30 days']]} value={horizon} onChange={setHorizon} />} tipState={tip3}>
          <svg viewBox={`0 0 360 ${H3}`} className="svg" onMouseLeave={() => setTip3(null)}>
            <line x1="0" x2="360" y1={base3} y2={base3} stroke="#e8eaed" />
            {(() => { const cols = [{ d: 'late', items: upcoming.late }, ...upcoming.days]; const bw = 360 / cols.length;
              return cols.map((c, i) => { const w = Math.max(6, Math.min(20, bw * 0.62)); const x = i * bw + (bw - w) / 2; const blk = Math.min(16, (base3 - 8) / max3), gap = Math.min(3, blk * 0.2);
                const col = c.d === 'late' ? RED : c.d === today ? YELLOW : BLUE;
                return <g key={c.d} onMouseMove={(e) => move(setTip3, e, c.d === 'late' ? 'Overdue' : short(c.d), c.items.length ? c.items.slice(0, 4).concat(c.items.length > 4 ? [`+${c.items.length - 4} more`] : []) : ['Nothing due'])}>
                  <rect x={i * bw} y="0" width={bw} height={H3} fill="transparent" />
                  {c.items.map((_, k) => <rect key={k} x={x} y={base3 - 2 - (k + 1) * blk} width={w} height={blk - gap} rx={Math.min(4, (blk - gap) / 3)} fill={col} />)}
                  {(i === 0 || i === 1 || i === cols.length - 1 || i === Math.floor(cols.length / 2)) && <text x={x + w / 2} y={base3 + 18} fontSize="10" fill={c.d === 'late' ? RED : '#80868b'} textAnchor="middle">{c.d === 'late' ? 'late' : i === 1 ? 'today' : '+' + (i - 1)}</text>}
                </g>; }); })()}
          </svg>
        </Card>
      </div>

      <div className="gpair">
        <Card n={4} title="Morning digest habit" q={`Last ${cells.length} days of the range.`} tip="Dark green: you opened or clicked that day's digest. Light green: a digest was sent. Grey: none." tipState={tip4}>
          <div className="strip4" onMouseLeave={() => setTip4(null)}>
            {cells.map((c) => <span key={c.d} className={`cell ${c.k}`} onMouseMove={(e) => move(setTip4, e, short(c.d), [c.k === 'engaged' ? 'Opened or clicked' : c.k === 'sent' ? 'Sent, not opened' : 'No digest'])} />)}
          </div>
          <div className="legend2 static"><span><i style={{ background: GREEN }} />Opened or clicked</span><span><i style={{ background: LGREEN }} />Sent</span><span><i style={{ background: '#e8eaed' }} />None</span></div>
          <p className="gnote"><b>{engagedCount}</b> day{engagedCount === 1 ? '' : 's'} engaged in this range</p>
        </Card>

        <Card n={5} title="Accuracy by prompt version" q="From your evaluation runs." tip="Latest run per prompt version on the labelled emails. Precision: shown items that were right. Recall: real items that were found. Date accuracy: dates that matched." controls={<Chips options={[['p', 'Precision'], ['r', 'Recall'], ['da', 'Date accuracy']]} value={metric} onChange={(v) => setMetric(v as 'p' | 'r' | 'da')} />} tipState={tip5}>
          {versions.length === 0 ? <p className="gnote">No evaluation runs yet.</p> : (
            <svg viewBox="0 0 360 170" className="svg" onMouseLeave={() => setTip5(null)}>
              <line x1="0" x2="360" y1="130" y2="130" stroke="#eef0f2" /><line x1="0" x2="360" y1="30" y2="30" stroke="#eef0f2" strokeDasharray="3 3" />
              {versions.map((v, i) => { const val = v[metric]; const bw = 360 / versions.length; const w = Math.min(70, bw * 0.5); const x = i * bw + (bw - w) / 2; const h = val === null ? 0 : val * 100;
                return <g key={v.v} onMouseMove={(e) => move(setTip5, e, `Prompt ${v.v}`, [`${MLAB[metric]}: ${val === null ? 'n/a' : Math.round(val * 100) + '%'}`, `Run: ${v.ts.slice(0, 10)}`])}>
                  <rect x={i * bw} y="0" width={bw} height="150" fill="transparent" />
                  <rect x={x} y={130 - h} width={w} height={h} rx="5" fill={metric === 'p' ? GREEN : metric === 'r' ? BLUE : YELLOW} />
                  <text x={x + w / 2} y={130 - h - 6} fontSize="12" fontWeight="600" textAnchor="middle" fill="#202124">{val === null ? 'n/a' : Math.round(val * 100) + '%'}</text>
                  <text x={x + w / 2} y="148" fontSize="11" textAnchor="middle" fill="#5f6368">{v.v}</text>
                </g>; })}
            </svg>
          )}
        </Card>
      </div>
    </section>
  );
}
