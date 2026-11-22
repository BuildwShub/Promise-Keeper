import { createPublicKey, verify } from 'node:crypto';

export interface Jwk { kid: string; kty: string; n: string; e: string; alg?: string }
export interface JwtPayload { iss: string; aud: string; exp: number; sub: string; email?: string; email_verified?: boolean | string }

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
let cache: { keys: Jwk[]; at: number } | null = null;

/** Google's public signing keys (cached for an hour). */
export async function googleKeys(force = false): Promise<Jwk[]> {
  if (!force && cache && Date.now() - cache.at < 3600_000) return cache.keys;
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error('Could not load Google signing keys');
  const keys = ((await res.json()) as { keys: Jwk[] }).keys;
  cache = { keys, at: Date.now() };
  return keys;
}

const b64json = (s: string) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

/**
 * Verify a Google-signed RS256 JWT: signature, issuer, expiry and audience. Throws on any failure.
 * `keys` can be passed in (tests); otherwise Google's current keys are fetched.
 */
export async function verifyGoogleJwt(token: string, opts: { audience: (aud: string) => boolean; keys?: Jwk[]; nowMs?: number }): Promise<JwtPayload> {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const header = b64json(parts[0]);
  if (header.alg !== 'RS256') throw new Error('Unexpected algorithm');
  let keys = opts.keys ?? (await googleKeys());
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk && !opts.keys) { keys = await googleKeys(true); jwk = keys.find((k) => k.kid === header.kid); } // keys rotate
  if (!jwk) throw new Error('Unknown signing key');
  const ok = verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk as never, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new Error('Bad signature');
  const p = b64json(parts[1]) as JwtPayload;
  if (p.iss !== 'https://accounts.google.com' && p.iss !== 'accounts.google.com') throw new Error('Bad issuer');
  if (!(p.exp > Math.floor((opts.nowMs ?? Date.now()) / 1000))) throw new Error('Token expired');
  if (!opts.audience(String(p.aud))) throw new Error('Bad audience');
  return p;
}
