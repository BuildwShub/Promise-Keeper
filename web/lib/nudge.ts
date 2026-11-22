import type { SupabaseClient } from '@supabase/supabase-js';
import { NudgeFmt } from './shared';
import { accessFor } from './actions';
import { createDraft, getThreadMeta } from './google';
import { geminiText } from './gemini';
import { localDateIn } from './metrics';

/* eslint-disable @typescript-eslint/no-explicit-any */
const header = (msg: any, name: string): string => (msg?.payload?.headers ?? []).find((h: any) => String(h.name).toLowerCase() === name.toLowerCase())?.value ?? '';
const emailOf = (h: string) => (/<([^>]+)>/.exec(h)?.[1] ?? h).trim().toLowerCase();
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

/** One-tap follow-up: creates a threaded Gmail DRAFT for a "waiting on" item. Never sends. */
export async function createNudgeDraft(db: SupabaseClient, userId: string, itemId: string): Promise<{ draftId: string; usedFallback: boolean }> {
  const { data: it, error } = await db.from('items').select('*').eq('id', itemId).eq('user_id', userId).maybeSingle();
  if (error || !it) throw new Error('Item not found');
  if (it.type !== 'waiting_on') throw new Error('Nudges are only for "waiting on" items');
  const { data: me } = await db.from('users').select('email,timezone').eq('id', userId).maybeSingle();
  const myEmail = String(me?.email ?? '').toLowerCase();

  const token = await accessFor(db, userId);
  const thread = await getThreadMeta(token, it.thread_id);
  const msgs: any[] = thread.messages ?? [];
  if (!msgs.length) throw new Error('Thread not found');
  const last = msgs[msgs.length - 1];

  // Recipient: the counterparty if known, else the sender of the latest message from someone else.
  let to: string = it.counterparty_email;
  for (let i = msgs.length - 1; i >= 0 && !to; i--) {
    const from = emailOf(header(msgs[i], 'From'));
    if (from && from !== myEmail) to = from;
  }
  if (!to) throw new Error('No recipient email for this item. Edit the counterparty first.');

  const item = { what: it.what, due: it.due ?? '', counterpartyName: it.counterparty_name, counterpartyEmail: it.counterparty_email, evidence: it.evidence, type: it.type };
  const today = localDateIn(me?.timezone ?? 'Asia/Kolkata')(new Date().toISOString());
  let body = await geminiText(NudgeFmt.nudgeSystemPrompt(), NudgeFmt.nudgeUserPrompt(item, today));
  const usedFallback = !body;
  if (usedFallback) body = NudgeFmt.template(item);

  const msgIdHeader = header(last, 'Message-ID');
  const mime = NudgeFmt.buildMime({
    to, subject: NudgeFmt.replySubject(header(msgs[0], 'Subject')), inReplyTo: msgIdHeader, references: (header(last, 'References') + ' ' + msgIdHeader).trim(), body,
  }, b64);
  const draft = await createDraft(token, Buffer.from(mime, 'utf8').toString('base64url'), it.thread_id);
  await db.from('feedback').insert({ user_id: userId, item_id: itemId, action: 'nudge', before_json: { status: it.status }, after_json: { draftId: draft.id, fallback: usedFallback } });
  return { draftId: draft.id, usedFallback };
}
