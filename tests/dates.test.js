const D = require('../shared/dates.js');

describe('Dates', () => {
  test('isValidIso', () => {
    expect(D.isValidIso('2026-11-19')).toBe(true);
    expect(D.isValidIso('2026-02-30')).toBe(false);
    expect(D.isValidIso('tomorrow')).toBe(false);
    expect(D.isValidIso(null)).toBe(false);
  });
  test('addDays across month/year/leap boundaries', () => {
    expect(D.addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(D.addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(D.addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(D.addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  test('weekdayName', () => {
    expect(D.weekdayName('2026-11-19')).toBe('Thursday');
    expect(D.weekdayName('2026-11-20')).toBe('Friday');
  });
  test('daysBetween', () => expect(D.daysBetween('2026-11-19', '2026-11-27')).toBe(8));
  test('localDateOf', () => {
    expect(D.localDateOf('2026-11-19T23:30:00+05:30')).toBe('2026-11-19');
    expect(D.localDateOf('garbage')).toBeNull();
  });
  test('clampDue', () => {
    const o = { sentDate: '2026-11-19', type: 'my_promise' };
    expect(D.clampDue('2026-11-20', o)).toEqual({ due: '2026-11-20', needsDate: false, reason: null });
    expect(D.clampDue('tomorrow', o)).toMatchObject({ due: null, needsDate: true });
    expect(D.clampDue('2029-01-01', o)).toMatchObject({ due: null, needsDate: true, reason: 'too_far' });
    expect(D.clampDue('2026-11-01', o)).toMatchObject({ due: null, needsDate: true, reason: 'before_sent' });
    expect(D.clampDue('2026-11-01', { sentDate: '2026-11-19', type: 'deadline' }).due).toBe('2026-11-01');
    expect(D.clampDue(null, o)).toEqual({ due: null, needsDate: false, reason: null });
  });
  test('bucket', () => {
    const t = '2026-11-19';
    expect(D.bucket('2026-11-18', t)).toBe('overdue');
    expect(D.bucket('2026-11-19', t)).toBe('today');
    expect(D.bucket('2026-11-26', t)).toBe('week');
    expect(D.bucket('2026-11-27', t)).toBe('later');
    expect(D.bucket(null, t)).toBe('none');
  });
  test('calendarHint starts at sent day', () => {
    const c = D.calendarHint('2026-11-19', 3).split('\n');
    expect(c).toEqual(['Thu 2026-11-19 (sent day)', 'Fri 2026-11-20', 'Sat 2026-11-21']);
  });
});
