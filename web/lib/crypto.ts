import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for Google refresh tokens (plan.md Phase 7: encrypted with a key held in an env var).
 * Format: base64( iv[12] | authTag[16] | ciphertext ). Every call uses a fresh random IV.
 */
const IV_LEN = 12;
const TAG_LEN = 16;

export function parseKey(b64: string | undefined): Buffer {
  if (!b64) throw new Error('TOKEN_ENC_KEY is not set');
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) throw new Error('TOKEN_ENC_KEY must be 32 bytes, base64 encoded');
  return key;
}

export function encrypt(plain: string, keyB64: string | undefined = process.env.TOKEN_ENC_KEY): string {
  const key = parseKey(keyB64);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

export function decrypt(payload: string, keyB64: string | undefined = process.env.TOKEN_ENC_KEY): string {
  const key = parseKey(keyB64);
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LEN + TAG_LEN + 1) throw new Error('Encrypted value is too short');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'); // throws if tampered
}
