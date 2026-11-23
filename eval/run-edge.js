/** Runs eval/edge-cases.js through the same prompt, schema and validator as the app. Prints any case whose item types differ from expected.
 *  node eval/run-edge.js   (cache: eval/.cache-edge.json, keyed by prompt text; delete to rerun). Free tier: 4.5 s between calls. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const Clean = require('../shared/clean.js'), Dates = require('../shared/dates.js'), Prompt = require('../shared/prompt.js');
const Schema = require('../shared/schema.js'), Validate = require('../shared/validate.js');
const set = require('./edge-cases.js');
const env = Object.fromEntries(fs.readFileSync(path.join(root, 'web', '.env.local'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1)]));
const KEY = env.GEMINI_API_KEY, MODEL = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = crypto.createHash('sha1').update(Prompt.buildSystemPrompt()).digest('hex').slice(0, 10);

async function extract(ctx) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const payload = { systemInstruction: { parts: [{ text: Prompt.buildSystemPrompt() }] }, contents: [{ role: 'user', parts: [{ text: Prompt.buildUserPrompt(ctx) }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: Schema.RESPONSE_SCHEMA } };
  for (let a = 0; a < 5; a++) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY }, body: JSON.stringify(payload) });
    if (res.ok) { const d = await res.json(); const t = d.candidates?.[0]?.content?.parts?.[0]?.text; return t ? JSON.parse(t).items ?? [] : []; }
    if (res.status !== 429 && res.status < 500) throw new Error('HTTP ' + res.status);
    await sleep((res.status === 429 ? 6000 : 1000) * 2 ** a);
  }
  throw new Error('Gemini failed');
}

(async () => {
  const cp = path.join(__dirname, '.cache-edge.json');
  const cache = fs.existsSync(cp) ? JSON.parse(fs.readFileSync(cp, 'utf8')) : {};
  let calls = 0, bad = 0;
  for (const c of set.cases) {
    const k = `${hash}:${MODEL}:${c.id}`;
    const cleaned = Clean.clean(c.body, { maxChars: 3000 });
    if (!cache[k]) {
      if (calls++ > 0) await sleep(4500);
      cache[k] = await extract({ userEmail: set.owner, direction: c.direction, timezone: set.timezone, sentIso: set.sentIso, from: c.from, to: c.to, cc: '', subject: c.subject, body: cleaned });
      fs.writeFileSync(cp, JSON.stringify(cache));
    }
    const v = Validate.validateItems(cache[k], { cleanedText: cleaned, direction: c.direction, sentDate: Dates.localDateOf(set.sentIso) });
    const got = v.items.filter((i) => (i.confidence || 0) >= 0.6).map((i) => i.type).sort();
    const ok = JSON.stringify(got) === JSON.stringify([...c.expect].sort());
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.id} ${c.direction.padEnd(5)} expect [${c.expect}] got [${got}]${ok ? '' : '  <- ' + c.body.slice(0, 70).replace(/\n/g, ' ')}`);
  }
  console.log(`\n${set.cases.length - bad}/${set.cases.length} correct (prompt ${hash}, ${MODEL})`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
