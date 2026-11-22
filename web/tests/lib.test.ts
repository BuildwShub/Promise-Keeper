import { createHmac, randomBytes } from 'node:crypto';
import { decrypt, encrypt, parseKey } from '../lib/crypto';
import { signUserJwt } from '../lib/jwt';
import * as shared from '../lib/shared';

const key = randomBytes(32).toString('base64');

describe('crypto (AES-256-GCM)', () => {
  test('round trip, including unicode', () => {
    const t = '1//0g-refresh-token-ünïcode-कल';
    expect(decrypt(encrypt(t, key), key)).toBe(t);
  });
  test('fresh IV: same plaintext encrypts differently', () => {
    expect(encrypt('x', key)).not.toBe(encrypt('x', key));
  });
  test('never contains the plaintext', () => {
    expect(Buffer.from(encrypt('SECRET-TOKEN-VALUE', key), 'base64').toString('utf8')).not.toContain('SECRET-TOKEN-VALUE');
  });
  test('tampering is detected', () => {
    const buf = Buffer.from(encrypt('hello', key), 'base64');
    buf[buf.length - 1] ^= 0xff;
    expect(() => decrypt(buf.toString('base64'), key)).toThrow();
  });
  test('wrong key fails', () => {
    expect(() => decrypt(encrypt('hello', key), randomBytes(32).toString('base64'))).toThrow();
  });
  test('rejects missing or short keys and short payloads', () => {
    expect(() => parseKey(undefined)).toThrow('not set');
    expect(() => parseKey(Buffer.alloc(16).toString('base64'))).toThrow('32 bytes');
    expect(() => decrypt('AAAA', key)).toThrow('too short');
  });
});

describe('signUserJwt', () => {
  const uid = '123e4567-e89b-12d3-a456-426614174000';
  const secret = 'test-secret';
  test('is a valid HS256 token with the expected claims', () => {
    const t = signUserJwt(uid, secret, 300, 1_700_000_000_000);
    const [h, p, s] = t.split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(JSON.parse(Buffer.from(p, 'base64url').toString())).toEqual({ sub: uid, role: 'authenticated', aud: 'authenticated', iat: 1_700_000_000, exp: 1_700_000_300 });
    expect(s).toBe(createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url'));
  });
  test('rejects missing secret and non-uuid ids', () => {
    expect(() => signUserJwt(uid, '')).toThrow('not set');
    expect(() => signUserJwt('not-a-uuid', secret)).toThrow('uuid');
  });
});

describe('shared modules load in the web app (same code as Apps Script)', () => {
  test('all modules expose their API', () => {
    expect(typeof shared.Clean.clean).toBe('function');
    expect(typeof shared.Validate.validateItems).toBe('function');
    expect(typeof shared.Prompt.buildSystemPrompt).toBe('function');
    expect(typeof shared.DigestFmt.buildDigest).toBe('function');
    expect(typeof shared.MetricsFmt.compute).toBe('function');
    expect(shared.Schema.TYPES).toEqual(['my_promise', 'request_to_me', 'deadline', 'waiting_on']);
  });
  test('behaves identically: cleaning and date math', () => {
    expect(shared.Clean.clean("I'll send the deck by Friday.\n\nThanks,\nShubham")).toBe("I'll send the deck by Friday.");
    expect(shared.Dates.addDays('2026-01-31', 1)).toBe('2026-02-01');
  });
});
