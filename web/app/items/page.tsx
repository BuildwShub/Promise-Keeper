import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { adminClient, userClient } from '@/lib/supabase';
import { acceptItem, dismissItem, editItem, markDone } from '@/lib/actions';
import { OutputsFmt } from '@/lib/shared';
import ItemsView, { type Item } from '@/components/ItemsView';

export const metadata = { title: 'Items · Promise Keeper' };
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // item actions call Google APIs


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

  return <ItemsView all={all} items={items} tab={tab} edit={edit} notice={notice} today={today} link={link} count={count} acceptAction={acceptAction} dismissAction={dismissAction} doneAction={doneAction} editAction={editAction} />;
}
