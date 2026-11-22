const F = require('../shared/outputsfmt.js');

const item = { threadId: 't1', type: 'my_promise', what: 'Send Q3 report', counterpartyName: 'Anita', counterpartyEmail: 'anita@x.com', due: '2026-11-20', evidence: "I'll send the Q3 report by Friday" };

describe('OutputsFmt', () => {
  test('threadLink', () => expect(F.threadLink('abc')).toBe('https://mail.google.com/mail/u/0/#all/abc'));
  test('taskTitle prefixes by type', () => {
    expect(F.taskTitle(item)).toBe('Promise: Send Q3 report');
    expect(F.taskTitle({ ...item, type: 'request_to_me' })).toBe('Request: Send Q3 report');
    expect(F.taskTitle({ ...item, type: 'deadline' })).toBe('Deadline: Send Q3 report');
  });
  test('waiting_on title names the counterparty', () => expect(F.taskTitle({ ...item, type: 'waiting_on' })).toBe('Waiting on: Send Q3 report (Anita)'));
  test('taskNotes has evidence and thread link', () => {
    const n = F.taskNotes(item);
    expect(n).toContain("\"I'll send the Q3 report by Friday\"");
    expect(n).toContain('anita@x.com');
    expect(n).toContain('#all/t1');
  });
  test('taskNotes puts the link first', () => expect(F.taskNotes(item).split('\n')[0]).toBe('Thread: https://mail.google.com/mail/u/0/#all/t1'));
  test('eventDescription escapes HTML in evidence', () => expect(F.eventDescription({ ...item, evidence: 'a <b> & c' })).toContain('a &lt;b&gt; &amp; c'));
  test('taskDue', () => {
    expect(F.taskDue('2026-11-20')).toBe('2026-11-20T00:00:00.000Z');
    expect(F.taskDue('')).toBeNull();
  });
  test('taskResource omits due when none', () => expect('due' in F.taskResource({ ...item, due: '' })).toBe(false));
  test('wantsEvent only for dated deadlines', () => {
    expect(F.wantsEvent({ ...item, type: 'deadline' })).toBe(true);
    expect(F.wantsEvent({ ...item, type: 'deadline', due: '' })).toBe(false);
    expect(F.wantsEvent(item)).toBe(false);
  });
  test('eventResource is all-day with exclusive end', () => {
    const e = F.eventResource({ ...item, type: 'deadline', due: '2026-11-30' });
    expect(e.start).toEqual({ date: '2026-11-30' });
    expect(e.end).toEqual({ date: '2026-12-01' });
    expect(e.description).toContain('<a href="https://mail.google.com/mail/u/0/#all/t1">Open thread in Gmail</a>');
  });
});
