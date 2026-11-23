import { Info } from '@/components/ItemsView';

export interface MetricRow { metric: string; value: string | number; detail: string }

const GREEN = '#34A853', AMBER = '#FBBC04', RED = '#EA4335', BLUE = '#4285F4', GREY = '#9aa0a6';
/** Traffic light for rates: 90%+ green, 80% to 89% amber, under 80% red. */
export const tone = (p: number) => (p >= 0.9 ? { c: GREEN, t: '#1e6e32' } : p >= 0.8 ? { c: AMBER, t: '#b06000' } : { c: RED, t: '#c5221f' });
const pct = (v: string | number) => (typeof v === 'number' ? `${Math.round(v * 100)}%` : 'n/a');
const frac = (d: string | undefined) => /(\d+)\/(\d+)\s*(?:\(|$)/.exec(d ?? '')?.slice(1, 3).map(Number) as [number, number] | undefined;

const TIPS: Record<string, string> = {
  accept_rate: 'accepted / (accepted + dismissed). Real-world precision: how often a suggestion was worth keeping.',
  on_time_rate: 'completed by due date / items with a due date that can be judged.',
  extraction_precision: 'From the latest accuracy check on labelled emails: the share of shown items that were correct.',
  edit_rate: 'edited items / decided items. Lower is better, so it is not colour-coded.',
  on_time_rate_week1: 'On-time rate for items due in your first week of use.',
  on_time_rate_week4: 'On-time rate for items due in week 4. Needs a month of history.',
  items_total: 'Every item found: suggested, accepted, dismissed and done.',
  digests_sent: 'Morning digest emails sent to you.',
  digest_engaged_days: 'Days with a digest open or click.',
  digest_retention_d7: 'Engaged in days 7 to 13 after the first digest.',
  digest_retention_d30: 'Engaged in days 30 to 36 after the first digest.',
};

function Ring({ p }: { p: number | null }) {
  const r = 48, len = 2 * Math.PI * r, t = p === null ? { c: GREY, t: GREY } : tone(p);
  return (
    <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#e8eaed" strokeWidth="13" />
      {p !== null && <circle cx="60" cy="60" r={r} fill="none" stroke={t.c} strokeWidth="13" strokeLinecap="butt" strokeDasharray={`${len * p} ${len}`} transform="rotate(-90 60 60)" />}
    </svg>
  );
}

export default function MetricsView({ rows, children }: { rows: MetricRow[]; children?: React.ReactNode }) {
  const m = (k: string) => rows.find((r) => r.metric === k);
  const num = (k: string) => (typeof m(k)?.value === 'number' ? (m(k)!.value as number) : null);
  const acc = frac(m('accept_rate')?.detail), ot = frac(m('on_time_rate')?.detail), prec = num('extraction_precision');
  const sentence = acc && acc[1] ? `You accepted ${acc[0]} of ${acc[1]} suggestions.` : 'No decisions yet. Accept or dismiss a suggestion to see your rates.';
  const second = [
    ot && ot[1] ? `${ot[0]} of ${ot[1]} dated items were finished on time.` : '',
    prec === null ? '' : prec === 1 ? 'The latest accuracy check found no false alarms.' : `The latest accuracy check scored ${Math.round(prec * 100)}%.`,
  ].filter(Boolean).join(' ');

  const big = (k: string, label: string, sub: string) => {
    const p = num(k), t = p === null ? { c: GREY, t: GREY } : tone(p);
    return (
      <div className="mc big" key={k}>
        <div className="mc-h"><span>{label}</span><Info text={TIPS[k]} label={`How ${label} is computed`} /></div>
        <div className="ring"><Ring p={p} /><b style={{ color: t.t }}>{pct(m(k)?.value ?? 'n/a')}</b></div>
        <div className="mc-sub">{sub}</div>
      </div>
    );
  };
  const small = (k: string, label: string, sub: string, colour: boolean) => {
    const p = num(k), t = colour && p !== null ? tone(p) : { c: GREY, t: p === null ? GREY : '#202124' };
    return (
      <div className={`mc${p === null ? ' empty' : ''}`} key={k}>
        <div className="mc-h"><span>{label}</span><Info text={TIPS[k]} label={`How ${label} is computed`} /></div>
        <b className="mc-v" style={{ color: t.t }}>{p === null ? 'n/a' : pct(m(k)!.value)}</b>
        <div className="mc-sub">{p === null ? 'Needs more history' : sub}</div>
      </div>
    );
  };
  const count = (k: string, label: string, sub: string, retention = false) => {
    const v = m(k)?.value, empty = v === 'n/a' || v === undefined;
    return (
      <div className={`mc${empty ? ' empty' : ''}`} key={k}>
        <div className="mc-h"><span>{label}</span><Info text={TIPS[k]} label={`How ${label} is computed`} /></div>
        <b className="mc-v" style={{ color: empty ? GREY : BLUE }}>{empty ? 'n/a' : retention ? (v ? 'Yes' : 'No') : String(v)}</b>
        <div className="mc-sub">{empty ? 'Needs more history' : sub}</div>
      </div>
    );
  };
  const first = (k: string) => (m(k)?.detail ?? '').replace(/^first digest /, '');

  return (
    <main className="flat">
      <h1>Metrics <Info text="Computed live from your items, decisions and events. Rates show n/a until there is enough data to judge. Hover the i on any card to see how it is computed." label="About this page" /></h1>
      <div className="summary"><b>{sentence}</b>{second && <span>{second}</span>}</div>

      <div className="mrow3">
        {big('accept_rate', 'Accept rate', acc ? `${acc[0]} of ${acc[1]} suggestions accepted` : '')}
        {big('on_time_rate', 'On-time rate', ot ? `${ot[0]} of ${ot[1]} finished by their date` : '')}
        {big('extraction_precision', 'Extraction precision', m('extraction_precision')?.detail.replace('EvalRuns latest: ', 'Latest check · ').replace(/, date accuracy.*gate/, ' · gate') ?? '')}
      </div>
      <div className="mrow3">
        {small('edit_rate', 'Edit rate', (() => { const f = frac(m('edit_rate')?.detail); return f ? `${f[0]} of ${f[1]} decided items edited` : ''; })(), false)}
        {small('on_time_rate_week1', 'On-time, week 1', (() => { const f = frac(m('on_time_rate_week1')?.detail); return f ? `${f[0]} of ${f[1]} in your first week` : ''; })(), true)}
        {small('on_time_rate_week4', 'On-time, week 4', '', true)}
      </div>

      <h2 className="msec">Your items</h2>
      <div className="mc wide">
        <div className="mc-h"><span>Items found</span><Info text={TIPS.items_total} label="How Items found is computed" /></div>
        <div className="wide-row"><b className="mc-v" style={{ color: BLUE }}>{String(m('items_total')?.value ?? 0)}</b><span className="mc-sub">{m('items_total')?.detail.replace(/, /g, ' · ')}</span></div>
      </div>

      <h2 className="msec">Morning digest</h2>
      <div className="mrow4">
        {count('digests_sent', 'Digests sent', `Since ${first('digests_sent')}`)}
        {count('digest_engaged_days', 'Days engaged', 'Days you opened or clicked')}
        {count('digest_retention_d7', 'Retention, day 7', 'Back after a week', true)}
        {count('digest_retention_d30', 'Retention, day 30', 'Back after a month', true)}
      </div>

      {children}

      <p className="legend"><span><i style={{ background: GREEN }} />Green 90%+</span><span><i style={{ background: AMBER }} />Amber 80 to 89%</span><span><i style={{ background: RED }} />Red under 80%</span></p>
    </main>
  );
}
