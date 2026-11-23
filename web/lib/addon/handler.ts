import type { SupabaseClient } from '@supabase/supabase-js';
import { acceptItem, accessFor, dismissItem, editItem, markDone } from '../actions';
import { processMessage } from '../intake';
import { createNudgeDraft } from '../nudge';
import { localDateIn } from '../metrics';
import { homeCard, editCard, messageCard, replaceCard, showCard, signInCard, threadCard, toastOnly, type CardItem, type Ctx } from './cards';
import { verifyGoogleJwt } from './verify';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Kind = 'homepage' | 'message' | 'action';
export interface AddonUser { id: string; email: string; timezone: string }

export const baseUrl = () => (process.env.ADDON_BASE_URL || 'https://promise-keeper-omega.vercel.app').replace(/\/$/, '');

/** Add-on event ids ("msg-f:123..." / "thread-f:123...", decimal) -> Gmail API hex ids. */
export function apiId(eventId: unknown): string {
  const m = /^(?:msg|thread)-[a-z]:(\d+)$/i.exec(String(eventId ?? ''));
  return m ? BigInt(m[1]).toString(16) : String(eventId ?? '');
}

const COLS = 'id,type,what,due,due_text,needs_date,confidence,evidence,status,counterparty_name,task_id,event_id';
const OPEN = ['suggested', 'accepted', 'possibly_resolved'];

export type AuthResult = { ok: true; user: AddonUser } | { ok: false; reason: 'unauthorized' | 'no_account' };

/**
 * Trust nothing in the request until Google's signature is checked.
 * 1. Authorization bearer = system ID token: signed by Google, audience = one of our endpoints, email = this add-on's service account.
 * 2. userIdToken: signed by Google, audience = the add-on's OAuth client. Its `sub` maps to our user.
 * Fails closed when the expected values are not configured.
 */
export async function authenticate(req: Request, body: any, db: SupabaseClient): Promise<AuthResult> {
  const sa = process.env.ADDON_SERVICE_ACCOUNT_EMAIL, clientId = process.env.ADDON_OAUTH_CLIENT_ID;
  if (!sa || !clientId) return { ok: false, reason: 'unauthorized' };
  try {
    const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
    const sys = await verifyGoogleJwt(bearer, { audience: (a) => a.startsWith(`${baseUrl()}/api/addon/`) });
    if (String(sys.email_verified) !== 'true' || sys.email !== sa) return { ok: false, reason: 'unauthorized' };
    const idToken = body?.authorizationEventObject?.userIdToken;
    const usr = await verifyGoogleJwt(String(idToken ?? ''), { audience: (a) => a === clientId });
    const { data } = await db.from('users').select('id,email,timezone').eq('google_sub', usr.sub).maybeSingle();
    return data ? { ok: true, user: data as AddonUser } : { ok: false, reason: 'no_account' };
  } catch {
    return { ok: false, reason: 'unauthorized' };
  }
}

async function threadItems(db: SupabaseClient, userId: string, threadId: string): Promise<CardItem[]> {
  const { data, error } = await db.from('items').select(COLS).eq('user_id', userId).eq('thread_id', threadId).neq('status', 'dismissed').order('due', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CardItem[];
}

async function homeData(db: SupabaseClient, user: AddonUser) {
  const today = localDateIn(user.timezone)(new Date().toISOString());
  const { data, error } = await db.from('items').select(COLS).eq('user_id', user.id).in('status', OPEN).order('due', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  const items = (data ?? []) as CardItem[];
  const stats = {
    open: items.length,
    suggested: items.filter((i) => i.status === 'suggested').length,
    overdue: items.filter((i) => i.due && i.due < today).length,
    waiting: items.filter((i) => i.type === 'waiting_on').length,
  };
  return { stats, top: items.filter((i) => i.due).slice(0, 5), today };
}

/** Run one add-on request for an authenticated user and return the JSON to send back. */
export async function handleAddon(kind: Kind, body: any, user: AddonUser, db: SupabaseClient): Promise<object> {
  const base = baseUrl();
  const today = localDateIn(user.timezone)(new Date().toISOString());

  if (kind === 'homepage') {
    const h = await homeData(db, user);
    return showCard(homeCard(h.stats, h.top, { base }, h.today));
  }

  if (kind === 'message') {
    const ctx: Ctx = { base, threadId: apiId(body?.gmail?.threadId), msgId: apiId(body?.gmail?.messageId) };
    if (!ctx.threadId) { const h = await homeData(db, user); return showCard(homeCard(h.stats, h.top, { base }, h.today)); }
    return showCard(threadCard(await threadItems(db, user.id, ctx.threadId), ctx, today));
  }

  // kind === 'action'
  const p: Record<string, string> = body?.commonEventObject?.parameters ?? {};
  const form = body?.commonEventObject?.formInputs ?? {};
  const input = (name: string): string | undefined => form?.[name]?.stringInputs?.value?.[0];
  const ctx: Ctx = { base, threadId: p.threadId, msgId: p.msgId };
  const id = p.id;
  const refresh = async (toast: string) => replaceCard(threadCard(ctx.threadId ? await threadItems(db, user.id, ctx.threadId) : [], ctx, today), toast);

  try {
    switch (p.op) {
      case 'accept': { const r = await acceptItem(db, user.id, id); return refresh('Added to Google Tasks' + (r.event_id ? ' and Calendar' : '')); }
      case 'done': await markDone(db, user.id, id); return refresh('Marked done');
      case 'dismiss': await dismissItem(db, user.id, id); return refresh('Dismissed');
      case 'cancel': return refresh('Cancelled');
      case 'nudge': {
        const r = await createNudgeDraft(db, user.id, id);
        return refresh(r.usedFallback ? 'Draft created in Gmail (standard wording)' : 'Draft created in Gmail. Review it in Drafts.');
      }
      case 'edit': {
        const { data } = await db.from('items').select(COLS).eq('id', id).eq('user_id', user.id).maybeSingle();
        if (!data) return toastOnly('Item not found');
        return replaceCard(editCard(data as CardItem, ctx));
      }
      case 'save':
        await editItem(db, user.id, id, { what: input('what'), type: input('type'), due: input('due') ?? '', counterpartyName: input('counterpartyName') });
        return refresh('Saved');
      case 'scan': {
        if (!ctx.msgId) return toastOnly('Open an email first');
        const r = await processMessage(db, user, await accessFor(db, user.id), ctx.msgId);
        return refresh(r.newItems ? `Found ${r.newItems} new item${r.newItems === 1 ? '' : 's'}` : 'Nothing new found');
      }
      default: return toastOnly('Unknown action');
    }
  } catch (e) {
    return toastOnly('Something went wrong: ' + String((e as Error).message ?? e).slice(0, 120));
  }
}

export { signInCard, messageCard };
