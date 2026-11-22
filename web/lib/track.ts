import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Digest links and the open pixel carry a signed token instead of a bare user id, so nobody can log events for someone else.
 * token = <userId>.<first 22 chars of HMAC-SHA256(AUTH_SECRET, "track:" + userId)>
 */
const mac = (userId: string, secret: string) => createHmac('sha256', secret).update('track:' + userId).digest('base64url').slice(0, 22);

export function trackToken(userId: string, secret: string | undefined = process.env.AUTH_SECRET): string {
  if (!secret) throw new Error('AUTH_SECRET is not set');
  return `${userId}.${mac(userId, secret)}`;
}

/** Returns the user id when the token is genuine, else null. */
export function verifyTrackToken(token: string | null | undefined, secret: string | undefined = process.env.AUTH_SECRET): string | null {
  if (!secret || !token) return null;
  const i = token.lastIndexOf('.');
  if (i < 1) return null;
  const userId = token.slice(0, i);
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const a = Buffer.from(token.slice(i + 1));
  const b = Buffer.from(mac(userId, secret));
  return a.length === b.length && timingSafeEqual(a, b) ? userId : null;
}

/** Only ever redirect to Gmail (no open redirect). */
export function safeGmailUrl(u: string | null | undefined): string | null {
  try {
    const url = new URL(String(u));
    return url.protocol === 'https:' && url.hostname === 'mail.google.com' ? url.toString() : null;
  } catch {
    return null;
  }
}
