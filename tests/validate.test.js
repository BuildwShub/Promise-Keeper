const V = require('../shared/validate.js');
const P = require('../shared/prompt.js');
const S = require('../shared/score.js');

const text = "I'll send the Q3 report by Friday. Fee due 20 Nov.";
const base = { type: 'my_promise', what: 'Send Q3 report', counterparty_name: 'Anita', counterparty_email: 'Anita@X.com', due: '2026-11-20', due_text: 'by Friday', needs_date: false, confidence: 0.9, evidence: "I'll send the Q3 report by Friday." };
const ctx = { cleanedText: text, direction: 'sent', sentDate: '2026-11-19' };

describe('Validate.validateItems', () => {
  test('keeps a good item and normalizes email', () => {
    const r = V.validateItems([base], ctx);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ counterpartyEmail: 'anita@x.com', due: '2026-11-20', needsDate: false });
  });
  test('drops hallucinated evidence', () => {
    const r = V.validateItems([{ ...base, evidence: 'I will send the budget tomorrow' }], ctx);
    expect(r.items).toHaveLength(0);
    expect(r.dropped[0].reason).toBe('evidence_not_found');
  });
  test('evidence match tolerates curly quotes, case, whitespace', () => {
    const r = V.validateItems([{ ...base, evidence: 'I’ll  SEND the Q3 report by Friday' }], ctx);
    expect(r.items).toHaveLength(1);
  });
  test('direction guard', () => {
    expect(V.validateItems([{ ...base, type: 'request_to_me' }], ctx).dropped[0].reason).toBe('type_direction');
    expect(V.validateItems([base], { ...ctx, direction: 'inbox' }).dropped[0].reason).toBe('type_direction');
  });
  test('bad date becomes needsDate', () => {
    const r = V.validateItems([{ ...base, due: 'friday' }], ctx);
    expect(r.items[0]).toMatchObject({ due: null, needsDate: true });
  });
  test('deadline without date needs date', () => {
    const r = V.validateItems([{ ...base, type: 'deadline', due: null, evidence: 'Fee due 20 Nov.' }], { ...ctx, direction: 'inbox' });
    expect(r.items[0].needsDate).toBe(true);
  });
  test('bad type / bad email / confidence clamp', () => {
    expect(V.validateItems([{ ...base, type: 'nope' }], ctx).items).toHaveLength(0);
    const r = V.validateItems([{ ...base, counterparty_email: 'not-an-email', confidence: 7 }], ctx);
    expect(r.items[0]).toMatchObject({ counterpartyEmail: '', confidence: 1 });
  });
  test('non-array input is safe', () => expect(V.validateItems(null, ctx).items).toEqual([]));
});

describe('Prompt', () => {
  test('user prompt carries date context', () => {
    const p = P.buildUserPrompt({ userEmail: 'me@x.com', direction: 'sent', timezone: 'Asia/Kolkata', sentIso: '2026-11-19T10:30:00+05:30', from: 'Me', to: 'Anita', subject: 'Deck', body: 'hello' });
    expect(p).toContain('(Thursday)');
    expect(p).toContain('Fri 2026-11-20');
    expect(p).toContain('direction: sent');
  });
  test('system prompt covers types, negatives, Hinglish', () => {
    const s = P.buildSystemPrompt();
    ['my_promise', 'request_to_me', 'deadline', 'waiting_on', 'Will do!', 'kal tak bhej dunga', 'update your payment method', 'promotional or campaign'].forEach((k) => expect(s).toContain(k));
  });
});

describe('Score', () => {
  const exp = [{ type: 'my_promise', what: 'Send Q3 report', due: '2026-11-20' }];
  test('perfect match passes gate', () => {
    const rows = [{ predicted: [{ type: 'my_promise', what: 'Send the Q3 report', due: '2026-11-20', needsDate: false, confidence: 0.9 }], expected: exp }];
    const m = S.computeMetrics(rows);
    expect(m.shown.precision).toBe(1);
    expect(m.dateAccuracy).toBe(1);
    expect(m.gate).toBe(true);
  });
  test('false positive lowers shown precision; low-confidence FP is hidden', () => {
    const fp = { type: 'deadline', what: 'Pay something', due: null, needsDate: true, confidence: 0.9 };
    const hidden = { ...fp, confidence: 0.3 };
    const hit = { type: 'my_promise', what: 'Send Q3 report', due: '2026-11-20', needsDate: false, confidence: 0.9 };
    expect(S.computeMetrics([{ predicted: [hit, fp], expected: exp }]).shown.precision).toBe(0.5);
    expect(S.computeMetrics([{ predicted: [hit, hidden], expected: exp }]).shown.precision).toBe(1);
    expect(S.computeMetrics([{ predicted: [hit, hidden], expected: exp }]).overall.precision).toBe(0.5);
  });
  test('wrong date and missed item', () => {
    const m = S.computeMetrics([{ predicted: [{ type: 'my_promise', what: 'Send Q3 report', due: '2026-11-21', needsDate: false, confidence: 0.9 }], expected: [...exp, { type: 'waiting_on', what: 'Send figures', due: '' }] }]);
    expect(m.dateAccuracy).toBe(0);
    expect(m.overall.recall).toBe(0.5);
    expect(m.gate).toBe(false);
  });
  test('parseExpected: blank = unlabelled, [] = labelled empty', () => {
    expect(S.parseExpected('')).toBeNull();
    expect(S.parseExpected('[]')).toEqual([]);
  });
});
