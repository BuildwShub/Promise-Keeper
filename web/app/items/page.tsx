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
  evidence: string; status: string; counterparty_name: string; thread_id: string; direction: string;
}

function todayIso() { return new Date().toISOString().slice(0, 10); }

export default async function Items({ searchParams }: { searchParams: Promise<{ tab?: string; edit?: string; notice?: string }> }) {
  const uid = await uidOrNull();
  if (!uid) redirect('/settings');
  const { tab = 'open', edit, notice } = await searchParams;

  const { data, error } = await userClient(uid)
    .from('items')
    .select('id,type,what,due,due_text,needs_date,confidence,evidence,status,counterparty_name,thread_id,direction')
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

  return (
    <main>
      <h1>Items</h1>
      <p className="muted">What you promised, what was asked of you, deadlines, and what others owe you.</p>
      <p>
        {Object.keys(STATUSES).map((t) => (
          <a key={t} href={`/items?tab=${t}`} style={{ marginRight: 16, fontWeight: t === tab ? 700 : 400 }}>{t[0].toUpperCase() + t.slice(1)} ({count(t)})</a>
        ))}
      </p>

      {notice && <p style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 6 }}>{notice}</p>}
      {items.length === 0 && <p className="muted">Nothing here.</p>}
      {items.map((it) => {
        const overdue = it.due && it.status !== 'done' && Dates.bucket(it.due, today) === 'overdue';
        return (
          <section key={it.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, margin: '12px 0' }}>
            <div><b>{TYPE_LABEL[it.type] ?? it.type}</b> · {it.status.replace('_', ' ')}{it.confidence < 0.6 ? ' · suggestion' : ''}</div>
            <div style={{ fontSize: '1.05rem', margin: '4px 0' }}>{it.what}{it.counterparty_name ? ` (${it.counterparty_name})` : ''}</div>
            <div className="muted">
              {it.due ? <span style={overdue ? { color: '#d93025', fontWeight: 600 } : undefined}>Due {it.due}{overdue ? ' (overdue)' : ''}</span> : it.needs_date ? 'Needs a date' : 'No date'}
              {it.due_text ? ` · “${it.due_text}”` : ''}
            </div>
            <div className="muted" style={{ fontStyle: 'italic' }}>“{it.evidence}”</div>
            <div style={{ marginTop: 6 }}>
              <a href={link(it.thread_id)} target="_blank" rel="noreferrer">Open in Gmail</a>
            </div>

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
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {(it.status === 'suggested') && <form action={acceptAction}><input type="hidden" name="id" value={it.id} /><button type="submit">Accept</button></form>}
                {(it.status === 'accepted' || it.status === 'possibly_resolved') && <form action={doneAction}><input type="hidden" name="id" value={it.id} /><button type="submit">{it.status === 'possibly_resolved' ? 'They delivered: mark done' : 'Mark done'}</button></form>}
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
