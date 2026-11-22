// Copies shared/*.js into addon/src so `clasp push` ships them.
// Refuses case-only name clashes (Windows is case-insensitive: shared/outputs.js would overwrite addon/src/Outputs.js).
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'shared');
const dst = path.join(__dirname, '..', 'addon', 'src');
fs.mkdirSync(dst, { recursive: true });
const shared = fs.readdirSync(src).filter((n) => n.endsWith('.js'));
const existing = fs.readdirSync(dst);
for (const f of shared) {
  const clash = existing.find((e) => e.toLowerCase() === f.toLowerCase() && e !== f && !shared.includes(e));
  if (clash) throw new Error(`Name clash: shared/${f} vs addon/src/${clash}. Rename the shared file.`);
  fs.copyFileSync(path.join(src, f), path.join(dst, f));
  console.log('copied', f);
}
