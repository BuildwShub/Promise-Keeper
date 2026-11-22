import { sentIso } from '../lib/time';
import { secretMatches } from '../lib/guard';
import { parseMessage } from '../lib/google';
import { runExtract } from '../lib/extract';

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url');

describe('sentIso', () => {
  test('Asia/Kolkata is +05:30', () => {
    expect(sentIso(Date.UTC(2026, 10, 19, 5, 0, 0), 'Asia/Kolkata')).toBe('2026-11-19T10:30:00+05:30');
  });
  test('UTC is +00:00', () => {
    expect(sentIso(Date.UTC(2026, 10, 19, 5, 0, 0), 'UTC')).toBe('2026-11-19T05:00:00+00:00');
  });
  test('America/New_York in winter is -05:00', () => {
    expect(sentIso(Date.UTC(2026, 10, 19, 5, 0, 0), 'America/New_York')).toBe('2026-11-19T00:00:00-05:00');
  });
});

describe('secretMatches', () => {
  test('accepts the exact secret only', () => {
    expect(secretMatches('abc', 'abc')).toBe(true);
    expect(secretMatches('abd', 'abc')).toBe(false);
    expect(secretMatches('abcd', 'abc')).toBe(false);
  });
  test('rejects when either side is missing', () => {
    expect(secretMatches(null, 'abc')).toBe(false);
    expect(secretMatches('abc', undefined)).toBe(false);
    expect(secretMatches('', '')).toBe(false);
  });
});

describe('parseMessage', () => {
  const base = { id: 'm1', threadId: 't1', internalDate: '1700000000000' };
  test('reads plain text, headers and direction', () => {
    const m = parseMessage({
      ...base, labelIds: ['SENT'],
      payload: { headers: [{ name: 'From', value: 'Me <me@x.com>' }, { name: 'Subject', value: 'Hi' }], mimeType: 'text/plain', body: { data: b64('I will send it Friday.') } },
    })!;
    expect(m.direction).toBe('sent');
    expect(m.subject).toBe('Hi');
    expect(m.body).toBe('I will send it Friday.');
    expect(m.internalDate).toBe(1700000000000);
  });
  test('skips drafts', () => {
    expect(parseMessage({ ...base, labelIds: ['DRAFT'], payload: {} })).toBeNull();
  });
  test('ignores attachments and falls back to html', () => {
    const m = parseMessage({
      ...base, labelIds: ['INBOX'],
      payload: { mimeType: 'multipart/mixed', headers: [], parts: [
        { mimeType: 'text/html', body: { data: b64('<p>Please send the report</p>') } },
        { mimeType: 'text/plain', filename: 'a.txt', body: { data: b64('ATTACHMENT TEXT') } },
      ] },
    })!;
    expect(m.direction).toBe('inbox');
    expect(m.body).toContain('Please send the report');
    expect(m.body).not.toContain('ATTACHMENT');
  });
});

describe('runExtract', () => {
  const msg = (over = {}) => ({
    msgId: 'm1', threadId: 't1', direction: 'sent' as const, internalDate: Date.UTC(2026, 10, 19, 5, 0, 0),
    from: 'me@x.com', to: 'bob@y.com', cc: '', subject: 'Report', body: 'Hi Bob, I will send you the report by Friday.', ...over,
  });

  test('keeps a grounded item', async () => {
    const gem = async () => [{ type: 'my_promise', what: 'Send the report', counterpartyName: 'Bob', counterpartyEmail: 'bob@y.com', due: '2026-11-20', dueText: 'Friday', needsDate: false, confidence: 0.9, evidence: 'I will send you the report by Friday.' }];
    const r = await runExtract(msg(), 'Asia/Kolkata', 'me@x.com', gem);
    expect(r.items).toHaveLength(1);
    expect(r.sentIso).toBe('2026-11-19T10:30:00+05:30');
  });

  test('drops an item whose evidence is not in the message', async () => {
    const gem = async () => [{ type: 'my_promise', what: 'Call Bob', counterpartyName: 'Bob', counterpartyEmail: '', due: null, dueText: '', needsDate: false, confidence: 0.9, evidence: 'I will call you tomorrow morning.' }];
    const r = await runExtract(msg(), 'Asia/Kolkata', 'me@x.com', gem);
    expect(r.items).toHaveLength(0);
    expect(r.dropped.length).toBe(1);
  });

  test('never calls Gemini for our own digest or tiny bodies', async () => {
    let calls = 0;
    const gem = async () => { calls++; return []; };
    await runExtract(msg({ subject: '[Promise Keeper] Your morning digest' }), 'UTC', 'me@x.com', gem);
    await runExtract(msg({ body: 'ok' }), 'UTC', 'me@x.com', gem);
    expect(calls).toBe(0);
  });
});
