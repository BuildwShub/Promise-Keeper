import { timingSafeEqual } from 'node:crypto';

/** Constant-time check of a shared secret (CRON_SECRET). False when the secret is unset or the value differs. */
export function secretMatches(given: string | null | undefined, expected: string | undefined = process.env.CRON_SECRET): boolean {
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function bearer(req: Request): string | null {
  const h = req.headers.get('authorization') ?? '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}
