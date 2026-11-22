const M = require('../shared/metricsfmt.js');

const T = '2026-12-20';
const item = (o) => ({ itemId: 'i' + Math.random(), status: 'accepted', due: '2026-12-01', createdAt: '2026-12-01T05:00:00Z', completedAt: '', ...o });
const day = (iso) => iso.slice(0, 10);

describe('acceptStats', () => {
  test('accept rate = accepted / (accepted + dismissed); suggested ignored', () => {
    const s = M.acceptStats([item({ status: 'accepted' }), item({ status: 'done' }), item({ status: 'dismissed' }), item({ status: 'suggested' })], []);
    expect(s.accepted).toBe(2);
    expect(s.dismissed).toBe(1);
    expect(s.acceptRate).toBeCloseTo(0.667, 2);
    expect(s.suggested).toBe(1);
  });
  test('rate is null with no decisions', () => expect(M.acceptStats([item({ status: 'suggested' })], []).acceptRate).toBeNull());
  test('edit rate counts real edits once per item, not status answers', () => {
    const fb = [
      { action: 'edit', itemId: 'a', beforeJson: '{"what":"x"}' },
      { action: 'edit', itemId: 'a', beforeJson: '{"what":"y"}' },
      { action: 'edit', itemId: 'b', beforeJson: '{"status":"possibly_resolved"}' }
    ];
    const s = M.acceptStats([item({ status: 'accepted' }), item({ status: 'dismissed' })], fb);
    expect(s.edited).toBe(1);
    expect(s.editRate).toBe(0.5);
  });
});

describe('onTime', () => {
  test('counts done-by-due; skips accepted items not yet due', () => {
    const r = M.onTime([
      item({ status: 'done', due: '2026-12-05', completedAt: '2026-12-04T10:00:00Z' }), // on time
      item({ status: 'done', due: '2026-12-05', completedAt: '2026-12-06T10:00:00Z' }), // late
      item({ status: 'accepted', due: '2026-12-10' }),                                   // overdue, open
      item({ status: 'accepted', due: '2027-01-01' }),                                   // not due yet: skipped
      item({ status: 'dismissed', due: '2026-12-05' }),                                  // not accepted: skipped
      item({ status: 'accepted', due: '' })                                              // no date: skipped
    ], T, day);
    expect(r).toMatchObject({ num: 1, den: 3 });
    expect(r.rate).toBeCloseTo(0.333, 2);
  });
  test('completed on the due date counts as on time', () => {
    expect(M.onTime([item({ status: 'done', due: '2026-12-05', completedAt: '2026-12-05T20:00:00Z' })], T, day).rate).toBe(1);
  });
});

describe('onTimeByWeek', () => {
  test('splits cohorts by days since first item', () => {
    const items = [
      item({ createdAt: '2026-11-01T00:00:00Z', status: 'done', due: '2026-11-03', completedAt: '2026-11-02T00:00:00Z' }),
      item({ createdAt: '2026-11-04T00:00:00Z', status: 'accepted', due: '2026-11-06' }),
      item({ createdAt: '2026-11-23T00:00:00Z', status: 'done', due: '2026-11-25', completedAt: '2026-11-24T00:00:00Z' })
    ];
    const w = M.onTimeByWeek(items, T, day);
    expect(w.first).toBe('2026-11-01');
    expect(w.w1).toMatchObject({ num: 1, den: 2 });
    expect(w.w4).toMatchObject({ num: 1, den: 1 });
  });
  test('no items', () => expect(M.onTimeByWeek([], T, day).first).toBeNull());
});

describe('retention', () => {
  test('null until measurable', () => expect(M.retention('2026-12-15', [], 7, T)).toBeNull());
  test('retained when engaged in days 7..13', () => {
    expect(M.retention('2026-12-01', ['2026-12-09'], 7, T)).toBe(true);
    expect(M.retention('2026-12-01', ['2026-12-03'], 7, T)).toBe(false);
    expect(M.retention('2026-12-01', ['2026-12-20'], 7, T)).toBe(false);
  });
  test('no first digest', () => expect(M.retention(null, [], 7, T)).toBeNull());
});

describe('compute', () => {
  test('returns the plan metrics', () => {
    const out = M.compute({
      items: [item({ status: 'done', due: '2026-12-05', completedAt: '2026-12-04T00:00:00Z' }), item({ status: 'dismissed' })],
      feedback: [],
      events: [{ ts: '2026-12-01T03:00:00Z', event: 'digest_sent' }, { ts: '2026-12-09T03:00:00Z', event: 'digest_click' }],
      evalRuns: [{ promptVersion: 'v2', shownPrecision: 1, dateAccuracy: 1, gate: true }]
    }, { today: T, localDate: day });
    const m = Object.fromEntries(out.rows.map((r) => [r.metric, r.value]));
    expect(m.accept_rate).toBe(0.5);
    expect(m.on_time_rate).toBe(1);
    expect(m.digest_retention_d7).toBe(1);
    expect(m.digest_retention_d30).toBe('n/a');
    expect(m.extraction_precision).toBe(1);
    expect(out.summary.firstDigestDate).toBe('2026-12-01');
  });
  test('handles empty data', () => {
    const out = M.compute({ items: [], feedback: [], events: [], evalRuns: [] }, { today: T, localDate: day });
    expect(out.rows.find((r) => r.metric === 'accept_rate').value).toBe('n/a');
  });
});

describe('fleet', () => {
  test('aggregates testers and retention from events by uid', () => {
    const collected = [
      { ts: '2026-12-10T00:00:00Z', uid: 'u1', payload: { summary: { acceptRate: 0.8, editRate: 0.1, onTimeRate: 0.5, firstDigestDate: '2026-12-01' } } },
      { ts: '2026-12-11T00:00:00Z', uid: 'u1', payload: { summary: { acceptRate: 0.9, editRate: 0.1, onTimeRate: 0.5, firstDigestDate: '2026-12-01' } } },
      { ts: '2026-12-11T00:00:00Z', uid: 'u2', payload: { summary: { acceptRate: 0.5, editRate: 0.3, onTimeRate: null, firstDigestDate: '2026-12-02' } } }
    ];
    const events = [{ ts: '2026-12-09T00:00:00Z', event: 'digest_click', meta: { uid: 'u1' } }];
    const r = Object.fromEntries(M.fleet(collected, events, T, day).map((x) => [x.metric, x]));
    expect(r.testers_reporting.value).toBe(2);
    expect(r.mean_accept_rate.value).toBe(0.7);
    expect(r.digest_retention_d7.detail).toBe('1/2 eligible testers retained');
  });
});
