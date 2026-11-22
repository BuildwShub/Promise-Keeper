import { Clean } from './shared';

export class GoogleError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
/** The refresh token was revoked or expired: the user must sign in again. */
export class ReauthError extends Error {}

export interface Msg {
  msgId: string; threadId: string; direction: 'sent' | 'inbox'; internalDate: number;
  from: string; to: string; cc: string; subject: string; body: string;
}

/** Exchange a stored refresh token for a short-lived access token. */
export async function accessTokenFor(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID ?? '',
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (res.ok && data.access_token) return data.access_token;
  if (data.error === 'invalid_grant') throw new ReauthError('Refresh token revoked or expired');
  throw new GoogleError(res.status, 'Token refresh failed: ' + (data.error ?? res.status));
}

async function gmail(token: string, path: string, init?: { method?: string; params?: Record<string, string | number | undefined>; body?: unknown }) {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/' + path);
  for (const [k, v] of Object.entries(init?.params ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method: init?.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { 'content-type': 'application/json' } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) throw new GoogleError(res.status, `Gmail ${path} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Message ids for a query, newest first, up to `limit`. */
export async function listIds(token: string, query: string, limit: number): Promise<{ id: string; threadId: string }[]> {
  const out: { id: string; threadId: string }[] = [];
  let pageToken: string | undefined;
  do {
    const r = await gmail(token, 'messages', { params: { q: query, maxResults: 100, pageToken } });
    for (const m of r.messages ?? []) if (out.length < limit) out.push({ id: m.id, threadId: m.threadId });
    pageToken = r.nextPageToken;
  } while (pageToken && out.length < limit);
  return out;
}

export async function getMessage(token: string, id: string): Promise<Msg | null> {
  return parseMessage(await gmail(token, `messages/${id}`, { params: { format: 'full' } }));
}

/** Message ids added since a history id. Throws GoogleError(404) when the history id is too old. */
export async function historyAdded(token: string, startHistoryId: string): Promise<string[]> {
  const ids = new Set<string>();
  let pageToken: string | undefined;
  do {
    const r = await gmail(token, 'history', { params: { startHistoryId, historyTypes: 'messageAdded', maxResults: 500, pageToken } });
    for (const h of r.history ?? []) for (const a of h.messagesAdded ?? []) if (a.message?.id) ids.add(a.message.id);
    pageToken = r.nextPageToken;
  } while (pageToken);
  return [...ids];
}

/** Ask Gmail to push mailbox changes to the Pub/Sub topic. Returns the new history id and expiry. */
export async function startWatch(token: string, topicName: string): Promise<{ historyId: string; expiration: Date }> {
  const r = await gmail(token, 'watch', { method: 'POST', body: { topicName, labelIds: ['INBOX', 'SENT'], labelFilterBehavior: 'INCLUDE' } });
  return { historyId: String(r.historyId), expiration: new Date(Number(r.expiration)) };
}

// ---------- parsing (mirrors addon/src/Fetch.js) ----------
type Part = { mimeType?: string; filename?: string; body?: { data?: string }; parts?: Part[]; headers?: { name: string; value: string }[] };

function decode(data: string): string {
  try { return Buffer.from(data.replace(/\s/g, ''), 'base64url').toString('utf8'); } catch { return ''; }
}

function collect(part: Part | undefined, plain: string[], html: string[]) {
  if (!part || part.filename) return; // attachments are ignored
  const data = part.body?.data;
  if (data && part.mimeType === 'text/plain') plain.push(decode(data));
  else if (data && part.mimeType === 'text/html') html.push(decode(data));
  for (const p of part.parts ?? []) collect(p, plain, html);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseMessage(m: any): Msg | null {
  const labels: string[] = m.labelIds ?? [];
  if (labels.includes('DRAFT')) return null;
  const h: Record<string, string> = {};
  for (const x of m.payload?.headers ?? []) h[String(x.name).toLowerCase()] = x.value;
  const plain: string[] = [], html: string[] = [];
  collect(m.payload, plain, html);
  const body = plain.length ? plain.join('\n') : Clean.htmlToText(html.join('\n'));
  return {
    msgId: m.id, threadId: m.threadId, direction: labels.includes('SENT') ? 'sent' : 'inbox', internalDate: Number(m.internalDate),
    from: h.from ?? '', to: h.to ?? '', cc: h.cc ?? '', subject: h.subject ?? '', body,
  };
}

// ---------- threads and drafts (nudges) ----------
/** Thread with only the headers a reply needs. */
export async function getThreadMeta(token: string, threadId: string) {
  const q = ['Message-ID', 'References', 'Subject', 'From', 'To'].map((h) => `metadataHeaders=${encodeURIComponent(h)}`).join('&');
  return gmail(token, `threads/${threadId}?format=metadata&${q}`);
}

/** Create a Gmail DRAFT (never sends). raw is base64url MIME. */
export async function createDraft(token: string, raw: string, threadId: string): Promise<{ id: string }> {
  return gmail(token, 'drafts', { method: 'POST', body: { message: { raw, threadId } } });
}
