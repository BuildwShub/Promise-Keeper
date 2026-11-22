const Dg = require('../shared/digestfmt.js');
const Ng = require('../shared/nudgefmt.js');

const T = '2026-11-19';
const mk = (o) => ({ itemId: 'i' + Math.random(), threadId: 't1', status: 'accepted', type: 'my_promise', what: 'Send deck', counterpartyName: 'Anita', due: '2026-11-20', ...o });

describe('DigestFmt.buildDigest', () => {
  test('returns null when nothing is relevant', () => {
    expect(Dg.buildDigest([], T)).toBeNull();
    expect(Dg.buildDigest([mk({ status: 'suggested' }), mk({ status: 'dismissed' }), mk({ status: 'done' })], T)).toBeNull();
    expect(Dg.buildDigest([mk({ due: '2027-01-01' })], T)).toBeNull();
  });
  test('groups into the plan sections', () => {
    const d = Dg.buildDigest([
      mk({ what: 'Old', due: '2026-11-10' }),
      mk({ what: 'Asked', due: '2026-11-12', type: 'request_to_me' }),
      mk({ what: 'Today', due: T, type: 'request_to_me' }),
      mk({ what: 'Soon', due: '2026-11-22' }),
      mk({ what: 'Late wait', type: 'waiting_on', due: '2026-11-15' })
    ], T);
    expect(d.counts).toEqual({ overdue: 2, today: 1, week: 1, waiting: 1 });
    expect(d.subject).toBe('[Promise Keeper] 2 overdue, 1 due today');
    expect(d.html).toContain('LATE');
    expect(d.html).toContain('#all/t1');
  });
  test('overdue section holds only promises and requests (plan)', () => {
    const d = Dg.buildDigest([mk({ type: 'deadline', due: '2026-11-18' }), mk({ what: 'P', due: '2026-11-18' })], T);
    expect(d.counts.overdue).toBe(1);
    expect(d.html).not.toContain('Deadline');
  });
  test('late waiting_on sorts first', () => {
    const d = Dg.buildDigest([mk({ type: 'waiting_on', what: 'Soon one', due: '2026-11-25' }), mk({ type: 'waiting_on', what: 'Late one', due: '2026-11-01' })], T);
    expect(d.html.indexOf('Late one')).toBeLessThan(d.html.indexOf('Soon one'));
  });
  test('possibly_resolved waiting items still listed', () => {
    expect(Dg.buildDigest([mk({ type: 'waiting_on', status: 'possibly_resolved' })], T).counts.waiting).toBe(1);
  });
  test('escapes HTML', () => {
    const d = Dg.buildDigest([mk({ what: '<script>x</script>' })], T);
    expect(d.html).not.toContain('<script>x');
    expect(d.html).toContain('&lt;script&gt;');
  });
  test('tracking URLs carry the anonymous uid', () => {
    const d = Dg.buildDigest([mk({ itemId: 'abc' })], T, { trackBase: 'https://script.example/exec', uid: 'u123' });
    expect(d.html).toContain('&amp;uid=u123');
    expect(d.html.match(/uid=u123/g).length).toBe(2);
  });
  test('tracking wraps links and adds a pixel', () => {
    const d = Dg.buildDigest([mk({ itemId: 'abc' })], T, { trackBase: 'https://script.example/exec' });
    expect(d.html).toContain('https://script.example/exec?e=click&amp;i=abc&amp;u=');
    expect(d.html).toContain('e=open');
  });
});

describe('NudgeFmt', () => {
  const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
  test('replySubject', () => {
    expect(Ng.replySubject('Deck')).toBe('Re: Deck');
    expect(Ng.replySubject('RE: Re: Deck')).toBe('Re: Deck');
  });
  test('template uses first name, task and due date', () => {
    const t = Ng.template({ counterpartyName: 'Rahul Sharma', what: 'Send the figures', due: '2026-11-23' });
    expect(t).toContain('Hi Rahul,');
    expect(t).toContain('Send the figures');
    expect(t).toContain('2026-11-23');
  });
  test('template works without a name or date', () => expect(Ng.template({ what: 'X' })).toContain('Hi,'));
  test('buildMime sets threading headers and base64 body', () => {
    const m = Ng.buildMime({ to: 'a@x.com', subject: 'Re: Deck', inReplyTo: '<m1@x>', references: '<m0@x> <m1@x>', body: 'Hello' }, b64);
    expect(m).toContain('To: a@x.com');
    expect(m).toContain('In-Reply-To: <m1@x>');
    expect(m).toContain('References: <m0@x> <m1@x>');
    expect(m.split('\r\n\r\n')[1]).toBe(b64('Hello'));
  });
  test('non-ASCII subject is RFC 2047 encoded', () => expect(Ng.buildMime({ to: 'a@x.com', subject: 'Re: कल', body: 'x' }, b64)).toContain('Subject: =?UTF-8?B?'));
  test('prompts mention evidence and Hinglish support', () => {
    expect(Ng.nudgeUserPrompt({ what: 'X', due: '2026-11-23', evidence: 'kal bhejunga', counterpartyName: 'R' }, T)).toContain('kal bhejunga');
    expect(Ng.nudgeSystemPrompt()).toContain('Hinglish');
  });
});
