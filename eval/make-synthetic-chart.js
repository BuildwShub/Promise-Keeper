/** Draws docs/images/synthetic-results.svg from eval/synthetic-results.json.   node eval/make-synthetic-chart.js */
const fs = require('fs');
const path = require('path');
const r = require('./synthetic-results.json');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FONT = 'font-family="Segoe UI, Helvetica, Arial, sans-serif"';
const INK = '#202124', MUTED = '#5f6368', GRID = '#e0e3e7', BLUE = '#1a73e8', ORANGE = '#e37400', GREEN = '#188038';
const pct = (v) => (v === null || v === undefined ? 'n/a' : `${Math.round(v * 1000) / 10}%`);

const rows = [
  { name: `All ${r.emails} emails`, p: r.shown.precision, rc: r.shown.recall, n: `${r.expectedItems} items`, bold: true },
  ...r.groups.filter((g) => g.precision !== null || g.recall !== null).map((g) => ({ name: g.name, p: g.precision, rc: g.recall, n: `${g.expectedItems} items` })),
];
const W = 860, L = 250, R = 110, rowH = 46, T = 84, H = T + rows.length * rowH + 64;
const bw = W - L - R;
let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" ${FONT}>`;
s += `<rect width="${W}" height="${H}" rx="12" fill="#ffffff" stroke="${GRID}"/>`;
s += `<text x="30" y="32" font-size="18" font-weight="700" fill="${INK}">Second test: ${r.emails} synthetic emails, ${r.expectedItems} expected items</text>`;
s += `<text x="30" y="52" font-size="12" fill="${MUTED}">Invented emails with worked-out answers (easier than real mail). Strict word-overlap scoring, shown items only.</text>`;
for (let g = 0; g <= 10; g += 2) {
  const x = L + (bw * g) / 10;
  s += `<line x1="${x}" x2="${x}" y1="${T - 8}" y2="${T + rows.length * rowH - 6}" stroke="${GRID}"/><text x="${x}" y="${T - 14}" font-size="10" text-anchor="middle" fill="${MUTED}">${g * 10}%</text>`;
}
rows.forEach((row, i) => {
  const y = T + i * rowH;
  s += `<text x="${L - 12}" y="${y + 17}" font-size="12" ${row.bold ? 'font-weight="700"' : ''} text-anchor="end" fill="${INK}">${esc(row.name)}</text>`;
  s += `<text x="${L - 12}" y="${y + 32}" font-size="10" text-anchor="end" fill="${MUTED}">${esc(row.n)}</text>`;
  [[row.p, BLUE, 4], [row.rc, ORANGE, 22]].forEach(([v, color, off]) => {
    const w = bw * (v || 0);
    s += `<rect x="${L}" y="${y + off - 2}" width="${w}" height="14" rx="3" fill="${color}"/><text x="${L + w + 6}" y="${y + off + 9}" font-size="11" font-weight="700" fill="${color}">${pct(v)}</text>`;
  });
});
const ly = H - 26;
s += `<rect x="30" y="${ly - 11}" width="14" height="14" rx="3" fill="${BLUE}"/><text x="50" y="${ly}" font-size="12" fill="${INK}">Precision</text>`;
s += `<rect x="140" y="${ly - 11}" width="14" height="14" rx="3" fill="${ORANGE}"/><text x="160" y="${ly}" font-size="12" fill="${INK}">Recall</text>`;
s += `<text x="${W - 30}" y="${ly}" font-size="12" text-anchor="end" fill="${GREEN}" font-weight="700">date accuracy ${pct(r.dateAccuracy)} (${r.dateN} dated items)</text>`;
s += '</svg>';
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'images', 'synthetic-results.svg'), s);
console.log('wrote docs/images/synthetic-results.svg');
