import { createHmac } from 'node:crypto';

/**
 * Short-lived HS256 JWT for Supabase. `sub` = users.id, so the policies' auth.uid() equals the user.
 * Signed with Supabase's JWT secret; used only server-side, never sent to the browser.
 * (Plain Node crypto: no dependency, works in Jest.)
 */
const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function signUserJwt(userId: string, secret: string | undefined = process.env.SUPABASE_JWT_SECRET, ttlSeconds = 300, nowMs = Date.now()): string {
  if (!secret) throw new Error('SUPABASE_JWT_SECRET is not set');
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('userId must be a uuid');
  const iat = Math.floor(nowMs / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ sub: userId, role: 'authenticated', aud: 'authenticated', iat, exp: iat + ttlSeconds }));
  const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}
