import { secretMatches } from '../lib/guard';

// The push route accepts a token whose "+" arrived as a space (query-string decoding), by mapping spaces back to "+".
const accepts = (token: string | null, secret: string) => secretMatches(token, secret) || secretMatches(token?.replace(/ /g, '+'), secret);

describe('push token handling', () => {
  const secret = 'ab+cd/ef=';
  test('accepts the exact token', () => expect(accepts('ab+cd/ef=', secret)).toBe(true));
  test('accepts a token whose + became a space', () => expect(accepts('ab cd/ef=', secret)).toBe(true));
  test('rejects a different token', () => expect(accepts('ab+cd/eg=', secret)).toBe(false));
  test('rejects a missing token', () => expect(accepts(null, secret)).toBe(false));
});
