import { Dates } from '@/lib/shared';

export interface Item {
  id: string; type: string; what: string; due: string | null; due_text: string; needs_date: boolean; confidence: number;
  evidence: string; status: string; counterparty_name: string; thread_id: string; direction: string; event_id?: string | null;
}
const TYPE_LABEL: Record<string, string> = { my_promise: 'I promised', request_to_me: 'Asked of me', deadline: 'Deadline', waiting_on: 'Waiting on them' };
const TYPES = Object.keys(TYPE_LABEL);
type Act = (form: FormData) => void | Promise<void>;

export function Info({ text, label = 'More info' }: { text: string; label?: string }) {
  return <details className="info"><summary aria-label={label} title={text}>i</summary><div role="tooltip">{text}</div></details>;
}

export default function ItemsView({ all, items: tabItems, filter, tab, edit, notice, today, link, count, acceptAction, dismissAction, doneAction, editAction }: {
  all: Item[]; items: Item[]; filter?: string; tab: string; edit?: string; notice?: string; today: string; link: (t: string) => string; count: (t: string) => number;
  acceptAction: Act; dismissAction: Act; doneAction: Act; editAction: Act;
}) {
  const STATUSES: Record<string, string[]> = { open: ['suggested', 'accepted', 'possibly_resolved'], done: ['done'], dismissed: ['dismissed'] };
  const open = all.filter((i) => STATUSES.open.includes(i.status));
  const FILTERS: Record<string, (i: Item) => boolean> = {
    overdue: (i) => !!i.due && Dates.bucket(i.due, today) === 'overdue',
    today: (i) => !!i.due && Dates.bucket(i.due, today) === 'today',
    review: (i) => i.status === 'suggested',
    waiting: (i) => i.type === 'waiting_on',
  };
  const FILTER_LABEL: Record<string, string> = { overdue: 'Overdue', today: 'Due today', review: 'To review', waiting: 'Waiting on others' };
  const active = filter && FILTERS[filter] ? filter : '';
  const items = active ? tabItems.filter(FILTERS[active]) : tabItems;
  const nOver = open.filter((i) => i.due && Dates.bucket(i.due, today) === 'overdue').length;
  const nToday = open.filter((i) => i.due && Dates.bucket(i.due, today) === 'today').length;
  const nWait = open.filter((i) => i.type === 'waiting_on').length;
  const nReview = open.filter((i) => i.status === 'suggested').length;
  const T = (key: string, n: number, l: string, c: string, tip: string) => (
    <div className={`tile${active === key ? ' sel' : ''}`} style={{ ['--c' as string]: c }}>
      <a className="tilelink" href={active === key ? '/items?tab=open' : `/items?tab=open&filter=${key}`} aria-pressed={active === key}><b style={{ color: c }}>{n}</b><span>{l}</span></a>
      <Info text={tip} label={`About ${l}`} />
    </div>
  );
  const GROUPS: { key: string; label: string; cls: string }[] = tab === 'open'
    ? [{ key: 'overdue', label: 'Overdue', cls: 'red' }, { key: 'today', label: 'Due today', cls: 'yellow' }, { key: 'week', label: 'This week', cls: 'blue' }, { key: 'later', label: 'Later', cls: 'grey' }, { key: 'none', label: 'No date', cls: 'grey' }]
    : [{ key: 'all', label: tab === 'done' ? 'Done' : 'Dismissed', cls: 'grey' }];
  const groupOf = (i: Item) => (tab === 'open' ? (i.due ? Dates.bucket(i.due, today) : 'none') : 'all');
  const dateTile = (due: string | null, cls: string) => {
    if (!due) return <div className="dtile none"><span>DATE</span><b>?</b></div>;
    const d = new Date(due + 'T00:00:00Z');
    return <div className={`dtile ${cls}`}><span>{d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase()}</span><b>{d.getUTCDate()}</b></div>;
  };
  const initial = (n: string) => (n || '?').trim()[0]?.toUpperCase() ?? '?';
  const Ico = ({ d }: { d: string }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

  return (
    <main className="flat">
      <h1>Your promises <Info text="Promise Keeper reads your Gmail (Inbox and Sent) and lists what you promised, what you were asked, deadlines, and what others owe you. Every item quotes the sentence it came from. It never sends email for you." label="About this page" /></h1>
      <p className="muted">{nReview ? `${nReview} suggestion${nReview === 1 ? '' : 's'} to review` : 'What you promised, what was asked of you, and what others owe you.'}</p>
      <div className="tiles">{T('overdue', nOver, 'Overdue', '#EA4335', 'Open items whose date has passed. Click to show only these.')}{T('today', nToday, 'Due today', '#F9AB00', 'Open items due today. Click to show only these.')}{T('review', nReview, 'To review', '#4285F4', 'Suggestions Promise Keeper found. Nothing is added to Tasks or Calendar until you press Accept.')}{T('waiting', nWait, 'Waiting on others', '#34A853', 'Things other people promised you. Click to show only these.')}</div>
      <div className="tabs">
        {Object.keys(STATUSES).map((t) => (
          <a key={t} href={`/items?tab=${t}`} className={`tab${t === tab ? ' on' : ''}`}>{t[0].toUpperCase() + t.slice(1)} ({count(t)})</a>
        ))}
      </div>

      {active && <p className="filterbar">Showing: <b>{FILTER_LABEL[active]}</b> ({items.length}) <a href="/items?tab=open">Clear filter</a></p>}
      {notice && <p className="notice">{notice}</p>}
      {items.length === 0 && <p className="muted">Nothing here.</p>}
      {GROUPS.map((g) => {
        const list = items.filter((i) => groupOf(i) === g.key);
        if (!list.length) return null;
        return (
          <div key={g.key}>
            <h2 className={`grp ${g.cls}`}>{g.label}<span>{list.length}</span></h2>
            {list.map((it) => {
              const live = it.status !== 'dismissed' && it.status !== 'done';
              const kind = it.type === 'waiting_on' ? ['Waiting on them', 'green'] : it.type === 'request_to_me' ? ['Asked of me', 'yellow'] : it.type === 'deadline' ? ['Deadline', 'red'] : ['I promised', 'blue'];
              return (
                <section key={it.id} className="item2">
                  {dateTile(it.due, g.cls)}
                  <div className="body">
                    <div className="ttl">{it.what}</div>
                    <div className="meta">
                      {it.counterparty_name && <><span className="av">{initial(it.counterparty_name)}</span><b>{it.counterparty_name}</b></>}
                      <span className={`pill ${kind[1]}`}>{kind[0]}</span>
                      {it.status === 'accepted' && <span className="pill green">✓ In Google Tasks{it.event_id ? ' + Calendar' : ''}</span>}
                      {it.status === 'possibly_resolved' && <span className="pill yellow">They may have delivered</span>}
                      {it.confidence < 0.6 && <span className="pill grey">Low confidence</span>}
                    </div>
                    <div className="strip"><i>“{it.evidence}”</i><Info text={`Found in your email with ${Math.round(it.confidence * 100)}% confidence. Nothing is added to Google Tasks or Calendar until you press Accept.`} label="Why am I seeing this?" /><a href={link(it.thread_id)} target="_blank" rel="noreferrer">Open email ↗</a></div>
                    {edit === it.id ? (
                      <form action={editAction} className="editform">
                        <input type="hidden" name="id" value={it.id} />
                        <label>Text <input name="what" defaultValue={it.what} size={50} required /></label>
                        <label>Type <select name="type" defaultValue={it.type}>{TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></label>
                        <label>Due (YYYY-MM-DD, empty for none) <input name="due" defaultValue={it.due ?? ''} pattern="\d{4}-\d{2}-\d{2}|" /></label>
                        <label>With <input name="counterpartyName" defaultValue={it.counterparty_name} /></label>
                        <div className="actions"><button type="submit" className="primary">Save</button> <a href={`/items?tab=${tab}`}>Cancel</a></div>
                      </form>
                    ) : (
                      <div className="actions">
                        {it.status === 'suggested' && <form action={acceptAction}><input type="hidden" name="id" value={it.id} /><button type="submit" className="primary">Accept</button></form>}
                        {(it.status === 'accepted' || it.status === 'possibly_resolved') && <form action={doneAction}><input type="hidden" name="id" value={it.id} /><button type="submit" className="primary">{it.status === 'possibly_resolved' ? 'They delivered' : 'Mark done'}</button></form>}
                        {live && <a className="ibtn" title="Edit" aria-label="Edit" href={`/items?tab=${tab}&edit=${it.id}`}><Ico d="M4 20l4-1 11-11-3-3L5 16l-1 4z" /></a>}
                        {live && <form action={dismissAction}><input type="hidden" name="id" value={it.id} /><button type="submit" className="ibtn" title="Dismiss" aria-label="Dismiss"><Ico d="M6 6l12 12M18 6L6 18" /></button></form>}
                        {it.type === 'waiting_on' && live && <form method="post" action="/api/nudge" className="right"><input type="hidden" name="id" value={it.id} /><input type="hidden" name="tab" value={tab} /><button type="submit">Draft follow-up</button></form>}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        );
      })}
    </main>
  );
}
