import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { adminClient, userClient } from '@/lib/supabase';
import { acceptItem, dismissItem, editItem, markDone } from '@/lib/actions';
import { Dates, OutputsFmt } from '@/lib/shared';

export const metadata = { title: 'Items · Promise Keeper' };
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // item actions call Google APIs

const TYPE_LABEL: Record<string, string> = { my_promise: 'I promised', request_to_me: 'Asked of me', deadline: 'Deadline', waiting_on: 'Waiting on them' };
const TYPES = Object.keys(TYPE_LABEL);

async function uidOrNull(): Promise<string | null> {
  const s = await auth();
  return (s?.user as { id?: string } | undefined)?.id ?? null;
}

/** Run one item action as the signed-in user. Gmail/Tasks/Calendar calls need the service client (it decrypts the token); ownership is checked by user_id in every query. */
async function act(fn: (uid: string, id: string, form: FormData) => Promise<unknown>, form: FormData) {
  const uid = await uidOrNull();
  const id = String(form.get('id') ?? '');
  if (!uid || !/^[0-9a-f-]{36}$/i.test(id)) return;
  await fn(uid, id, form);
  revalidatePath('/items');
}

async function acceptAction(form: FormData) { 'use server'; await act((u, i) => acceptItem(adminClient(), u, i), form); }
async function dismissAction(form: FormData) { 'use server'; await act((u, i) => dismissItem(adminClient(), u, i), form); }
async function doneAction(form: FormData) { 'use server'; await act((u, i) => markDone(adminClient(), u, i), form); }
async function editAction(form: FormData) {
  'use server';
  await act((u, i, f) => editItem(adminClient(), u, i, {
    what: String(f.get('what') ?? ''), type: String(f.get('type') ?? ''), due: String(f.get('due') ?? ''), counterpartyName: String(f.get('counterpartyName') ?? ''),
  }), form);
}

interface Item {
  id: string; type: string; what: string; due: string | null; due_text: string; needs_date: boolean; confidence: number;
  evidence: string; status: string; counterparty_name: string; thread_id: string; direction: string; event_id?: string | null;
}

function todayIso() { return new Date().toISOString().slice(0, 10); }

export default async function Items({ searchParams }: { searchParams: Promise<{ tab?: string; edit?: string; notice?: string }> }) {
  const uid = await uidOrNull();
  if (!uid) redirect('/settings');
  const { tab = 'open', edit, notice } = await searchParams;

  const { data, error } = await userClient(uid)
    .from('items')
    .select('id,type,what,due,due_text,needs_date,confidence,evidence,status,counterparty_name,thread_id,direction,event_id')
    .order('due', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) return <main><h1>Items</h1><p>Could not load items: {error.message}</p></main>;

  const { data: me } = await userClient(uid).from('users').select('email').eq('id', uid).maybeSingle();
  const link = (threadId: string) => OutputsFmt.threadLink(threadId, me?.email);
  const all = (data ?? []) as Item[];
  const STATUSES: Record<string, string[]> = { open: ['suggested', 'accepted', 'possibly_resolved'], done: ['done'], dismissed: ['dismissed'] };
  const items = all.filter((i) => (STATUSES[tab] ?? STATUSES.open).includes(i.status));
  const today = todayIso();
  const count = (t: string) => all.filter((i) => STATUSES[t].includes(i.status)).length;

  const COLOR: Record<string, string> = { my_promise: '#7b3fc4', request_to_me: '#e37400', deadline: '#d93025', waiting_on: '#1a73e8' };
  const open = all.filter((i) => STATUSES.open.includes(i.status));
  const nOver = open.filter((i) => i.due && Dates.bucket(i.due, today) === 'overdue').length;
  const nToday = open.filter((i) => i.due && Dates.bucket(i.due, today) === 'today').length;
  const nWait = open.filter((i) => i.type === 'waiting_on').length;
  const nReview = open.filter((i) => i.status === 'suggested').length;
  const T = (n: number, l: string, c: string) => <div className="tile"><b style={{ color: c }}>{n}</b><span>{l}</span></div>;

  return (
    <main className="flat">
      <h1>Your promises</h1>
      <p className="muted">What you promised, what was asked of you, deadlines, and what others owe you.</p>
      <div className="tiles">{T(nOver, 'Overdue', '#d93025')}{T(nToday, 'Due today', '#e37400')}{T(nReview, 'To review', '#1a73e8')}{T(nWait, 'Waiting on others', '#188038')}</div>
      <div className="tabs">
        {Object.keys(STATUSES).map((t) => (
          <a key={t} href={`/items?tab=${t}`} className={`tab${t === tab ? ' on' : ''}`}>{t[0].toUpperCase() + t.slice(1)} ({count(t)})</a>
        ))}
      </div>

      {notice && <p className="notice">{notice}</p>}
      {items.length === 0 && <p className="muted">Nothing here.</p>}
      {items.map((it) => {
        const overdue = it.due && it.status !== 'done' && Dates.bucket(it.due, today) === 'overdue';
        return (
          <section key={it.id} className="item" style={{ ['--c' as string]: COLOR[it.type] ?? '#1a73e8' }}>
            <div className="chips">
              <span className="chip">{TYPE_LABEL[it.type] ?? it.type}</span>
              <span className={`chip status${it.status === 'accepted' ? ' ok' : ''}`}>{it.status === 'accepted' ? 'Accepted' : it.status.replace('_', ' ')}{it.confidence < 0.6 ? ' · suggestion' : ''}</span>
            </div>
            <div className="what">{it.what}{it.counterparty_name ? ` (${it.counterparty_name})` : ''}</div>
            <div className={`due${overdue ? ' late' : ''}`}>
              {it.due ? `Due ${it.due}${overdue ? ' (overdue)' : ''}` : it.needs_date ? 'Needs a date' : 'No date'}
              {it.due_text ? ` · “${it.due_text}”` : ''}
            </div>
            <div className="quote">“{it.evidence}”</div>
            {it.status === 'accepted' && (
              <div className="synced">
                <span className="sync"><i>✓</i>Added to Google Tasks</span>
                {it.event_id && it.due && <span className="sync cal"><i>{it.due.slice(8, 10)}</i>On your Google Calendar</span>}
              </div>
            )}
            <div className="due"><a href={link(it.thread_id)} target="_blank" rel="noreferrer">Open in Gmail</a></div>

            {edit === it.id ? (
              <form action={editAction} style={{ marginTop: 8 }}>
                <input type="hidden" name="id" value={it.id} />
                <p><label>Text <input name="what" defaultValue={it.what} size={50} required /></label></p>
                <p><label>Type <select name="type" defaultValue={it.type}>{TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></label></p>
                <p><label>Due (YYYY-MM-DD, empty for none) <input name="due" defaultValue={it.due ?? ''} pattern="\d{4}-\d{2}-\d{2}|" /></label></p>
                <p><label>With <input name="counterpartyName" defaultValue={it.counterparty_name} /></label></p>
                <button type="submit">Save</button> <a href={`/items?tab=${tab}`}>Cancel</a>
              </form>
            ) : (
              <div className="actions">
                {(it.status === 'suggested') && <form action={acceptAction}><input type="hidden" name="id" value={it.id} /><button type="submit" className="primary">Accept</button></form>}
                {(it.status === 'accepted' || it.status === 'possibly_resolved') && <form action={doneAction}><input type="hidden" name="id" value={it.id} /><button type="submit" className="primary">{it.status === 'possibly_resolved' ? 'They delivered: mark done' : 'Mark done'}</button></form>}
                {it.status !== 'dismissed' && it.status !== 'done' && <a href={`/items?tab=${tab}&edit=${it.id}`}><button type="button">Edit</button></a>}
                {it.type === 'waiting_on' && it.status !== 'dismissed' && it.status !== 'done' && <form method="post" action="/api/nudge"><input type="hidden" name="id" value={it.id} /><input type="hidden" name="tab" value={tab} /><button type="submit">Draft follow-up</button></form>}
                {it.status !== 'dismissed' && it.status !== 'done' && <form action={dismissAction}><input type="hidden" name="id" value={it.id} /><button type="submit">Dismiss</button></form>}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
