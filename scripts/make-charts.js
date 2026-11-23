/**
 * Regenerates the README charts (docs/images/*.svg) from the real eval data in Postgres.
 *   node scripts/make-charts.js you@gmail.com
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from web/.env.local. Writes numbers only, never email text.
 */
const fs = require('fs');
const path = require('path');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FONT = 'font-family="Segoe UI, Helvetica, Arial, sans-serif"';
const INK = '#202124', MUTED = '#5f6368', GRID = '#e0e3e7', BLUE = '#1a73e8', GREEN = '#188038', ORANGE = '#e37400', RED = '#d93025';
const pct = (v) => (v === null || v === undefined ? 'n/a' : `${Math.round(v * 1000) / 10}%`);

/** Line chart of precision, recall and date accuracy per eval run, with the pass/fail gate at 85%. */
function progressChart(runs) {
  const W = 860, H = 440, L = 70, R = 30, T = 70, B = 110;
  const pw = W - L - R, ph = H - T - B;
  const x = (i) => L + (runs.length === 1 ? pw / 2 : (pw * i) / (runs.length - 1));
  const y = (v) => T + ph * (1 - v);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" ${FONT}>`;
  s += `<rect width="${W}" height="${H}" rx="12" fill="#ffffff" stroke="${GRID}"/>`;
  s += `<text x="${L}" y="32" font-size="18" font-weight="700" fill="${INK}">Extraction quality over 7 evaluation runs</text>`;
  s += `<text x="${L}" y="52" font-size="12" fill="${MUTED}">Same labelled emails each time; only the prompt changed (v1 to v2). Dashed line = pass/fail gate at 85%.</text>`;
  for (let g = 0; g <= 10; g += 2) {
    const v = g / 10;
    s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${GRID}"/>`;
    s += `<text x="${L - 10}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="${MUTED}">${Math.round(v * 100)}%</text>`;
  }
  s += `<line x1="${L}" x2="${W - R}" y1="${y(0.85)}" y2="${y(0.85)}" stroke="${RED}" stroke-dasharray="6 4" stroke-width="1.5"/>`;
  s += `<text x="${W - R}" y="${y(0.85) - 6}" font-size="11" text-anchor="end" fill="${RED}">gate: 85%</text>`;
  // prompt version bands
  let start = 0;
  runs.forEach((r, i) => {
    if (i === runs.length - 1 || runs[i + 1].prompt_version !== r.prompt_version) {
      const x1 = x(start) - 20, x2 = x(i) + 20;
      s += `<rect x="${x1}" y="${T - 6}" width="${x2 - x1}" height="${ph + 12}" rx="6" fill="${r.prompt_version === 'v1' ? '#fce8e6' : '#e6f4ea'}" opacity="0.55"/>`;
      s += `<text x="${(x1 + x2) / 2}" y="${T + 14}" font-size="12" font-weight="700" text-anchor="middle" fill="${r.prompt_version === 'v1' ? RED : GREEN}">prompt ${esc(r.prompt_version)}</text>`;
      start = i + 1;
    }
  });
  const series = [['shown_precision', 'Precision', BLUE], ['shown_recall', 'Recall', ORANGE], ['date_accuracy', 'Date accuracy', GREEN]];
  series.forEach(([key, label, color], si) => {
    const pts = runs.map((r, i) => [x(i), y(Number(r[key]) || 0), r[key]]);
    s += `<polyline fill="none" stroke="${color}" stroke-width="2.5" points="${pts.map((p) => p[0] + ',' + p[1]).join(' ')}"/>`;
    pts.forEach((p) => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${color}"/>`; });
    const last = pts[pts.length - 1];
    s += `<text x="${last[0] + 8}" y="${last[1] + 4 + (si === 0 ? -8 : si === 2 ? 8 : 0)}" font-size="12" font-weight="700" fill="${color}">${pct(last[2])}</text>`;
    s += `<rect x="${L + si * 150}" y="${H - 32}" width="14" height="14" rx="3" fill="${color}"/><text x="${L + si * 150 + 20}" y="${H - 20}" font-size="12" fill="${INK}">${label}</text>`;
  });
  runs.forEach((r, i) => {
    s += `<text x="${x(i)}" y="${T + ph + 20}" font-size="11" text-anchor="middle" fill="${MUTED}">${esc(r.ts.slice(5, 10))}</text>`;
    s += `<text x="${x(i)}" y="${T + ph + 35}" font-size="11" text-anchor="middle" fill="${MUTED}">${r.rows} rows</text>`;
    s += `<text x="${x(i)}" y="${T + ph + 50}" font-size="11" font-weight="700" text-anchor="middle" fill="${r.gate ? GREEN : RED}">${r.gate ? 'PASS' : 'FAIL'}</text>`;
  });
  return s + '</svg>';
}

/** What the labelled set contains: how many emails have nothing to extract, and how the rest break down by tag. */
function setChart(c) {
  const W = 860, H = 420, L = 70, R = 30;
  const total = c.pos + c.neg, bw = W - L - R;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" ${FONT}>`;
  s += `<rect width="${W}" height="${H}" rx="12" fill="#ffffff" stroke="${GRID}"/>`;
  s += `<text x="${L}" y="32" font-size="18" font-weight="700" fill="${INK}">What the evaluation set contains</text>`;
  s += `<text x="${L}" y="52" font-size="12" fill="${MUTED}">${total} real emails, hand-labelled. Most contain nothing to extract, which is what makes false alarms measurable.</text>`;
  const wNeg = (bw * c.neg) / total;
  s += `<rect x="${L}" y="72" width="${wNeg}" height="34" fill="#dadce0"/><rect x="${L + wNeg}" y="72" width="${bw - wNeg}" height="34" fill="${BLUE}"/>`;
  s += `<text x="${L + 10}" y="94" font-size="13" font-weight="700" fill="${INK}">${c.neg} emails with nothing to extract (marketing, automated notices, everyday mail, traps)</text>`;
  s += `<text x="${L + wNeg + 6}" y="127" font-size="13" font-weight="700" fill="${BLUE}">${c.pos} with a real commitment</text>`;
  const tags = Object.entries(c.tags).sort((a, b) => b[1] - a[1]).slice(0, 9);
  const max = tags[0][1], top = 155;
  s += `<text x="${L}" y="${top - 8}" font-size="13" font-weight="700" fill="${INK}">Tags (an email can have several)</text>`;
  tags.forEach(([t, n], i) => {
    const yy = top + i * 25, w = ((bw - 150) * n) / max;
    s += `<text x="${L}" y="${yy + 15}" font-size="12" fill="${INK}">${esc(t.replace(/_/g, ' '))}</text>`;
    s += `<rect x="${L + 120}" y="${yy + 2}" width="${w}" height="16" rx="3" fill="${t === 'trap' ? ORANGE : BLUE}" opacity="0.85"/>`;
    s += `<text x="${L + 126 + w}" y="${yy + 15}" font-size="12" fill="${MUTED}">${n}</text>`;
  });
  return s + '</svg>';
}

async function main() {
  const email = process.argv[2];
  if (!email) { console.error('Usage: node scripts/make-charts.js you@gmail.com'); process.exit(1); }
  const root = path.join(__dirname, '..');
  const envFile = fs.readFileSync(path.join(root, 'web', '.env.local'), 'utf8');
  const env = Object.fromEntries(envFile.split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1)]));
  const { createClient } = require(path.join(root, 'web', 'node_modules', '@supabase', 'supabase-js'));
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: user } = await db.from('users').select('id').ilike('email', email).maybeSingle();
  if (!user) throw new Error('user not found');

  const { data: runs } = await db.from('eval_runs').select('ts,prompt_version,rows,shown_precision,shown_recall,date_accuracy,gate').eq('user_id', user.id).order('ts');
  const { data: set } = await db.from('eval_set').select('expected_json,tags').eq('user_id', user.id);
  const c = { pos: 0, neg: 0, tags: {} };
  for (const r of set) {
    if (!r.expected_json || !r.expected_json.trim()) continue;
    let a = []; try { a = JSON.parse(r.expected_json); } catch { /* skip */ }
    if (a.length) c.pos++; else c.neg++;
    (r.tags || '').split(/[,; ]+/).filter(Boolean).forEach((t) => { c.tags[t] = (c.tags[t] || 0) + 1; });
  }
  const dir = path.join(root, 'docs', 'images');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'eval-progress.svg'), progressChart(runs));
  fs.writeFileSync(path.join(dir, 'eval-set.svg'), setChart(c));
  console.log(`wrote eval-progress.svg (${runs.length} runs) and eval-set.svg (${c.pos + c.neg} labelled emails)`);
}

if (require.main === module) main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
module.exports = { progressChart, setChart };
