const Dd = require('../shared/dedup.js');

describe('Dedup', () => {
  test('normalizeWhat', () => expect(Dd.normalizeWhat('  Send Q3 report! ')).toBe('send q3 report'));
  test('jaccard ignores stopwords', () => expect(Dd.jaccard('Send Q3 report to Anita', 'send the Q3 report')).toBeCloseTo(0.75));
  test('jaccard unrelated is low', () => expect(Dd.jaccard('Pay fee', 'Review draft')).toBe(0));
  test('fingerprint stable and normalized', () => {
    expect(Dd.fingerprint('t1', 'my_promise', 'Send Q3 report!')).toBe(Dd.fingerprint('t1', 'my_promise', 'send q3 report'));
    expect(Dd.fingerprint('t1', 'my_promise', 'x')).not.toBe(Dd.fingerprint('t1', 'waiting_on', 'x'));
    expect(Dd.fingerprint('t1', 'my_promise', 'x')).not.toBe(Dd.fingerprint('t2', 'my_promise', 'x'));
  });
  test('findDuplicate by fingerprint and by similarity in same thread+type', () => {
    const ex = [{ threadId: 't1', type: 'my_promise', what: 'Send Q3 report to Anita', fingerprint: Dd.fingerprint('t1', 'my_promise', 'Send Q3 report to Anita') }];
    expect(Dd.findDuplicate({ threadId: 't1', type: 'my_promise', what: 'Send Q3 report to Anita' }, ex)).toBe(ex[0]);
    expect(Dd.findDuplicate({ threadId: 't1', type: 'my_promise', what: 'Send the Q3 report' }, ex)).toBe(ex[0]);
    expect(Dd.findDuplicate({ threadId: 't2', type: 'my_promise', what: 'Send the Q3 report' }, ex)).toBeNull();
    expect(Dd.findDuplicate({ threadId: 't1', type: 'waiting_on', what: 'Send the Q3 report' }, ex)).toBeNull();
  });
  test('resolveDuplicate adopts a missing due date, else skips', () => {
    expect(Dd.resolveDuplicate({ due: '' }, { due: '2026-11-20', dueText: 'Friday' })).toMatchObject({ action: 'update', patch: { due: '2026-11-20' } });
    expect(Dd.resolveDuplicate({ due: '2026-11-20' }, { due: '2026-11-25' }).action).toBe('skip');
  });
});
