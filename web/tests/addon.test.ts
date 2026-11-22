import { createSign, generateKeyPairSync } from 'node:crypto';
import { verifyGoogleJwt, type Jwk } from '../lib/addon/verify';
import { apiId, authenticate } from '../lib/addon/handler';
import { editCard, homeCard, itemSection, replaceCard, showCard, threadCard, type CardItem } from '../lib/addon/cards';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...(publicKey.export({ format: 'jwk' }) as object), kid: 'k1', alg: 'RS256' } as Jwk;
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

function sign(payload: object, header: object = { alg: 'RS256', kid: 'k1' }, key = privateKey) {
  const data = `${b64(header)}.${b64(payload)}`;
  return `${data}.${createSign('RSA-SHA256').update(data).sign(key).toString('base64url')}`;
}
const now = Math.floor(Date.now() / 1000);
const good = { iss: 'https://accounts.google.com', aud: 'https://x/api/addon/message', exp: now + 600, sub: '123', email: 'sa@x.iam', email_verified: true };
const aud = (a: string) => a.startsWith('https://x/api/addon/');

describe('verifyGoogleJwt', () => {
  test('accepts a valid token', async () => {
    const p = await verifyGoogleJwt(sign(good), { audience: aud, keys: [jwk] });
    expect(p.sub).toBe('123');
  });
  test('rejects a wrong audience', async () => {
    await expect(verifyGoogleJwt(sign({ ...good, aud: 'https://evil/' }), { audience: aud, keys: [jwk] })).rejects.toThrow('audience');
  });
  test('rejects an expired token', async () => {
    await expect(verifyGoogleJwt(sign({ ...good, exp: now - 5 }), { audience: aud, keys: [jwk] })).rejects.toThrow('expired');
  });
  test('rejects a wrong issuer', async () => {
    await expect(verifyGoogleJwt(sign({ ...good, iss: 'https://evil.example' }), { audience: aud, keys: [jwk] })).rejects.toThrow('issuer');
  });
  test('rejects a token signed with another key', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    await expect(verifyGoogleJwt(sign(good, undefined, other), { audience: aud, keys: [jwk] })).rejects.toThrow('signature');
  });
  test('rejects alg none and unknown key ids', async () => {
    const none = `${b64({ alg: 'none' })}.${b64(good)}.`;
    await expect(verifyGoogleJwt(none, { audience: aud, keys: [jwk] })).rejects.toThrow('algorithm');
    await expect(verifyGoogleJwt(sign(good, { alg: 'RS256', kid: 'nope' }), { audience: aud, keys: [jwk] })).rejects.toThrow('key');
  });
  test('rejects garbage', async () => {
    await expect(verifyGoogleJwt('abc', { audience: aud, keys: [jwk] })).rejects.toThrow('Malformed');
  });
});

describe('authenticate fails closed', () => {
  const req = (auth?: string) => new Request('https://x/api/addon/message', { method: 'POST', headers: auth ? { authorization: auth } : {} });
  test('without configured service account and client id', async () => {
    delete process.env.ADDON_SERVICE_ACCOUNT_EMAIL;
    delete process.env.ADDON_OAUTH_CLIENT_ID;
    expect(await authenticate(req('Bearer abc'), {}, {} as never)).toEqual({ ok: false, reason: 'unauthorized' });
  });
  test('with configuration but a missing or bad token', async () => {
    process.env.ADDON_SERVICE_ACCOUNT_EMAIL = 'sa@x.iam';
    process.env.ADDON_OAUTH_CLIENT_ID = 'client';
    expect(await authenticate(req(), {}, {} as never)).toEqual({ ok: false, reason: 'unauthorized' });
    expect(await authenticate(req('Bearer not.a.jwt'), {}, {} as never)).toEqual({ ok: false, reason: 'unauthorized' });
  });
});

describe('apiId', () => {
  test('converts add-on decimal ids to Gmail hex ids', () => {
    expect(apiId('msg-f:1234567')).toBe((1234567).toString(16));
    expect(apiId('thread-a:255')).toBe('ff');
    expect(apiId('abc123')).toBe('abc123');
    expect(apiId(undefined)).toBe('');
  });
});

describe('cards', () => {
  const ctx = { base: 'https://x', threadId: 't1', msgId: 'm1' };
  const item = (over: Partial<CardItem> = {}): CardItem => ({ id: 'i1', type: 'deadline', what: 'Pay <fee>', due: '2026-11-20', due_text: '20 Nov', needs_date: false, confidence: 0.9, evidence: 'Fee due "20 Nov"', status: 'suggested', counterparty_name: '', ...over });
  const buttons = (s: any) => s.widgets.find((w: any) => w.buttonList).buttonList.buttons.map((b: any) => b.text);

  test('suggested items offer Accept, Edit, Dismiss', () => expect(buttons(itemSection(item(), ctx, '2026-11-22'))).toEqual(['Accept', 'Edit', 'Dismiss']));
  test('accepted items offer Done instead of Accept', () => expect(buttons(itemSection(item({ status: 'accepted' }), ctx, '2026-11-22'))).toEqual(['Done', 'Edit', 'Dismiss']));
  test('possibly resolved items ask if they delivered', () => expect(buttons(itemSection(item({ status: 'possibly_resolved' }), ctx, '2026-11-22'))[0]).toBe('They delivered'));
  test('done items have no buttons', () => expect(itemSection(item({ status: 'done' }), ctx, '2026-11-22').widgets.some((w: any) => w.buttonList)).toBe(false));
  test('text is HTML-escaped', () => expect(JSON.stringify(itemSection(item(), ctx, '2026-11-22'))).toContain('Pay &lt;fee&gt;'));
  test('overdue is flagged', () => expect(JSON.stringify(itemSection(item(), ctx, '2026-11-22'))).toContain('(overdue)'));
  test('button actions point at the action endpoint with ids', () => {
    const b = itemSection(item(), ctx, '2026-11-22').widgets.find((w: any) => w.buttonList).buttonList.buttons[0];
    expect(b.onClick.action.function).toBe('https://x/api/addon/action');
    expect(b.onClick.action.parameters).toEqual(expect.arrayContaining([{ key: 'op', value: 'accept' }, { key: 'id', value: 'i1' }, { key: 'threadId', value: 't1' }]));
  });
  test('empty thread offers a scan button', () => expect(buttons(threadCard([], ctx, '2026-11-22').sections[0])).toEqual(['Scan this email']));
  test('edit form has the four inputs and Save/Cancel', () => {
    const w = editCard(item(), ctx).sections[0].widgets;
    expect(w.filter((x: any) => x.textInput || x.selectionInput)).toHaveLength(4);
    expect(buttons(editCard(item(), ctx).sections[0])).toEqual(['Save', 'Cancel']);
  });
  test('home card shows counts', () => expect(JSON.stringify(homeCard({ open: 3, overdue: 1, waiting: 2, suggested: 2 }, [], ctx, '2026-11-22'))).toContain('2 to review'));
  test('response wrappers', () => {
    expect(showCard({ a: 1 })).toEqual({ action: { navigations: [{ pushCard: { a: 1 } }] } });
    expect(replaceCard({ a: 1 }, 'hi')).toEqual({ renderActions: { action: { navigations: [{ updateCard: { a: 1 } }], notification: { text: 'hi' } } } });
  });
});
