const { parseCsv, map } = require('../scripts/migrate-sheet');

describe('parseCsv', () => {
  test('simple rows with headers', () => {
    expect(parseCsv('a,b\n1,2\n3,4')).toEqual([{ a: '1', b: '2' }, { a: '3', b: '4' }]);
  });
  test('quoted commas, doubled quotes and newlines inside quotes', () => {
    const r = parseCsv('id,text\n1,"Hello, ""world""\nsecond line"\n2,plain');
    expect(r[0].text).toBe('Hello, "world"\nsecond line');
    expect(r[1].text).toBe('plain');
  });
  test('CRLF line endings and a BOM', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n')).toEqual([{ a: '1', b: '2' }]);
  });
  test('empty fields and short rows', () => {
    expect(parseCsv('a,b,c\n1,,\n2')).toEqual([{ a: '1', b: '', c: '' }, { a: '2', b: '', c: '' }]);
  });
  test('empty input', () => expect(parseCsv('')).toEqual([]));
});

describe('row mapping', () => {
  const sheet = { itemId: 'x', msgId: 'm', threadId: 't', direction: 'sent', type: 'my_promise', what: 'Send deck', due: '2026-11-20', needsDate: 'FALSE', confidence: '0.9', evidence: 'e', status: 'accepted', taskId: 'tk', eventId: '', fingerprint: 'fp', createdAt: '2026-11-19T04:00:00.000Z', completedAt: '' };
  test('item', () => {
    const r = map.item(sheet, 'u1');
    expect(r).toMatchObject({ user_id: 'u1', thread_id: 't', due: '2026-11-20', needs_date: false, confidence: 0.9, status: 'accepted', task_id: 'tk', event_id: null, completed_at: null });
  });
  test('bad values become null instead of throwing', () => {
    const r = map.item({ ...sheet, due: 'soon', confidence: 'n/a', createdAt: 'garbage' }, 'u1');
    expect(r.due).toBeNull();
    expect(r.confidence).toBe(0);
    expect(typeof r.created_at).toBe('string');
  });
  test('settings map to user columns and clamp the hour', () => {
    expect(map.settings([{ key: 'timezone', value: 'Asia/Kolkata' }, { key: 'digestHour', value: '31' }, { key: 'autoAddEnabled', value: 'TRUE' }]))
      .toEqual({ timezone: 'Asia/Kolkata', digest_hour: 23, auto_add_enabled: true });
  });
  test('eval run', () => {
    const r = map.evalRun({ ts: '2026-11-20T10:00:00.000Z', promptVersion: 'v2', gate: 'TRUE', shownPrecision: '0.9', perTypeJson: '{"a":1}', sweepJson: 'bad' }, 'u1');
    expect(r).toMatchObject({ gate: true, shown_precision: 0.9, per_type: { a: 1 }, sweep: {} });
  });
});
