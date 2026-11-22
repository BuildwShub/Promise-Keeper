import { safeGmailUrl, trackToken, verifyTrackToken } from '../lib/track';
import { itemSection, type CardItem } from '../lib/addon/cards';
import { DigestFmt } from '../lib/shared';

const uid = '11111111-2222-3333-4444-555555555555';

describe('track tokens', () => {
  test('round trip', () => expect(verifyTrackToken(trackToken(uid, 'secret'), 'secret')).toBe(uid));
  test('rejects a tampered user id', () => {
    const other = '99999999-2222-3333-4444-555555555555';
    const forged = other + trackToken(uid, 'secret').slice(uid.length);
    expect(verifyTrackToken(forged, 'secret')).toBeNull();
  });
  test('rejects a token made with another secret', () => expect(verifyTrackToken(trackToken(uid, 'a'), 'b')).toBeNull());
  test('rejects garbage and missing values', () => {
    expect(verifyTrackToken('nope', 'secret')).toBeNull();
    expect(verifyTrackToken(null, 'secret')).toBeNull();
    expect(verifyTrackToken(trackToken(uid, 'secret'), undefined)).toBeNull();
  });
});

describe('safeGmailUrl (no open redirect)', () => {
  test('allows Gmail', () => expect(safeGmailUrl('https://mail.google.com/mail/?authuser=a%40b.com#all/abc')).toContain('mail.google.com'));
  test('blocks other hosts, schemes and junk', () => {
    expect(safeGmailUrl('https://evil.example/x')).toBeNull();
    expect(safeGmailUrl('https://mail.google.com.evil.example/x')).toBeNull();
    expect(safeGmailUrl('http://mail.google.com/x')).toBeNull();
    expect(safeGmailUrl('javascript:alert(1)')).toBeNull();
    expect(safeGmailUrl(null)).toBeNull();
  });
});

describe('digest links name the Gmail account', () => {
  const items = [{ itemId: 'i1', threadId: 'abc', type: 'my_promise', what: 'Send deck', due: '2026-11-20', status: 'accepted', counterpartyName: 'Bob' }];
  test('html and text use authuser and tracking', () => {
    const d = DigestFmt.buildDigest(items, '2026-11-22', { trackBase: 'https://x/api/track', uid: 'tok', accountEmail: 'me@x.com' });
    expect(d.html).toContain(encodeURIComponent('https://mail.google.com/mail/?authuser=me%40x.com#all/abc'));
    expect(d.html).toContain('e=open');
    expect(d.text).toContain('authuser=me%40x.com');
    expect(d.subject).toBe('[Promise Keeper] 1 overdue');
  });
  test('returns null when there is nothing to report', () => expect(DigestFmt.buildDigest([], '2026-11-22', {})).toBeNull());
});

describe('nudge button', () => {
  const item = (type: string): CardItem => ({ id: 'i1', type, what: 'Send report', due: null, due_text: '', needs_date: false, confidence: 0.9, evidence: 'e', status: 'accepted', counterparty_name: 'Bob' });
  const labels = (it: CardItem) => itemSection(it, { base: 'https://x' }, '2026-11-22').widgets.find((w: any) => w.buttonList).buttonList.buttons.map((b: any) => b.text);
  test('only waiting-on items offer a follow-up', () => {
    expect(labels(item('waiting_on'))).toContain('Draft follow-up');
    expect(labels(item('my_promise'))).not.toContain('Draft follow-up');
  });
});
