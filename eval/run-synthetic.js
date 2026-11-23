/**
 * Runs eval/synthetic-eval.json through the SAME prompt, validation and scoring modules the app uses (shared/*.js) and the same
 * Gemini request as web/lib/gemini.ts. Writes eval/synthetic-results.json (metrics + every miss and false alarm; synthetic text only).
 *   node eval/run-synthetic.js           (resumes from eval/.cache-synthetic.json; delete it to start fresh)
 * Free tier: calls are paced 4.5 s apart. Set GEMINI_SPACING_MS=0 on a paid key.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const Clean = require('../shared/clean.js'), Dates = require('../shared/dates.js'), Prompt = require('../shared/prompt.js');
const Schema = require('../shared/schema.js'), Validate = require('../shared/validate.js'), Score = require('../shared/score.js');

const env = Object.fromEntries(fs.readFileSync(path.join(root, 'web', '.env.local'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1)]));
const KEY = env.GEMINI_API_KEY, MODEL = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const SPACING = Number(process.env.GEMINI_SPACING_MS ?? 4500);
const PROMPT_VERSION = 'v2';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function extract(ctx) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const payload = {
    systemInstruction: { parts: [{ text: Prompt.buildSystemPrompt() }] },
    contents: [{ role: 'user', parts: [{ text: Prompt.buildUserPrompt(ctx) }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: Schema.RESPONSE_SCHEMA },
  };
  let last = '';
  for (let a = 0; a < 5; a++) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY }, body: JSON.stringify(payload) });
    if (res.ok) {
      const d = await res.json();
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
      return text ? JSON.parse(text).items ?? [] : [];
    }
    last = `HTTP ${res.status}`;
    if (res.status !== 429 && res.status < 500) break;
    await sleep((res.status === 429 ? 6000 : 1000) * 2 ** a);
  }
  throw new Error('Gemini failed: ' + last);
}

async function main() {
  const set = JSON.parse(fs.readFileSync(path.join(__dirname, 'synthetic-eval.json'), 'utf8'));
  const cachePath = path.join(__dirname, '.cache-synthetic.json');
  const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};
  const key = (id) => `${PROMPT_VERSION}:${MODEL}:${id}`;

  let calls = 0;
  for (const c of set.cases) {
    if (cache[key(c.id)]) continue;
    const cleaned = Clean.clean(c.body, { maxChars: 3000 });
    if (calls++ > 0 && SPACING > 0) await sleep(SPACING);
    cache[key(c.id)] = await extract({ userEmail: set.owner, direction: c.direction, timezone: set.timezone, sentIso: c.sentIso, from: c.from, to: c.to, cc: '', subject: c.subject, body: cleaned });
    fs.writeFileSync(cachePath, JSON.stringify(cache));
    if (calls % 10 === 0) console.log(`  ${calls} calls made...`);
  }

  const rows = [], detail = [];
  for (const c of set.cases) {
    const cleaned = Clean.clean(c.body, { maxChars: 3000 });
    const v = Validate.validateItems(cache[key(c.id)], { cleanedText: cleaned, direction: c.direction, sentDate: Dates.localDateOf(c.sentIso) });
    const expected = Score.parseExpected(c.expected);
    rows.push({ predicted: v.items, expected });
    const m = Score.matchItems(v.items.filter((p) => (p.confidence || 0) >= 0.6), expected, 0.5);
    detail.push({ id: c.id, tags: c.tags, direction: c.direction, matched: m.pairs.length, falseAlarms: m.unmatchedP.map((p) => ({ type: p.type, what: p.what, due: p.due })), missed: m.unmatchedE, wrongDate: m.pairs.filter((x) => x.e.due && x.p.due !== x.e.due).map((x) => ({ id: c.id, expected: x.e.due, got: x.p.due })) });
  }
  const m = Score.computeMetrics(rows, { showThreshold: 0.6 });

  // breakdown by kind of email
  const group = (name, pred) => {
    const ids = new Set(set.cases.filter(pred).map((c) => c.id));
    const r = rows.filter((_, i) => ids.has(set.cases[i].id));
    const x = Score.computeMetrics(r, { showThreshold: 0.6 });
    return { name, emails: r.length, expectedItems: x.expectedItems, precision: x.shown.precision, recall: x.shown.recall, dateAccuracy: x.dateAccuracy, falseAlarms: x.shown.fp };
  };
  const groups = [
    group('Hinglish', (c) => c.tags.includes('hinglish')),
    group('Several items in one email', (c) => c.tags.includes('multi')),
    group('Vague or missing dates', (c) => c.tags.includes('date_vague')),
    group('Sent mail (my promises, asks)', (c) => c.direction === 'sent'),
    group('Inbox mail', (c) => c.direction === 'inbox'),
    group('Promo and campaign traps', (c) => c.tags.includes('trap')),
  ];

  const out = {
    note: 'Synthetic, developer-written emails with expected answers derived from the prompt date rules. Easier than real mail: see README.',
    promptVersion: PROMPT_VERSION, model: MODEL, emails: set.cases.length, emailsWithItems: set.cases.filter((c) => c.expected.length).length,
    expectedItems: m.expectedItems, shown: m.shown, overall: m.overall, dateAccuracy: m.dateAccuracy, dateN: m.dateN, needsDateAccuracy: m.needsDateAccuracy, gate: m.gate,
    perType: m.perType, groups,
    falseAlarms: detail.filter((d) => d.falseAlarms.length).map((d) => ({ id: d.id, items: d.falseAlarms })),
    misses: detail.filter((d) => d.missed.length).map((d) => ({ id: d.id, items: d.missed })),
    wrongDates: detail.flatMap((d) => d.wrongDate),
  };
  fs.writeFileSync(path.join(__dirname, 'synthetic-results.json'), JSON.stringify(out, null, 1));
  const p = (v) => (v === null ? 'n/a' : Math.round(v * 1000) / 10 + '%');
  console.log(`emails ${out.emails} (${out.emailsWithItems} with items, ${out.expectedItems} expected items)`);
  console.log(`precision ${p(m.shown.precision)} (${m.shown.tp} correct, ${m.shown.fp} false alarms) | recall ${p(m.shown.recall)} | date accuracy ${p(m.dateAccuracy)} (n=${m.dateN}) | gate ${m.gate ? 'PASS' : 'FAIL'}`);
  Object.entries(m.perType).forEach(([t, x]) => console.log(`  ${t.padEnd(14)} found ${x.tp}, missed ${x.fn}, false alarms ${x.fp}`));
  groups.forEach((g) => console.log(`  [${g.name}] emails ${g.emails}, precision ${p(g.precision)}, recall ${p(g.recall)}, date ${p(g.dateAccuracy)}, false alarms ${g.falseAlarms}`));
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
