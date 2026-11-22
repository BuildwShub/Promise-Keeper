/**
 * One-time import of the Stage A Google Sheet (exported as CSV, one file per tab) into Postgres.
 *
 *   1. In the Sheet, for each tab: File > Download > Comma Separated Values (.csv). Save into ./migration-data/ as:
 *        Items.csv  Feedback.csv  Events.csv  Processed.csv  Settings.csv  EvalSet.csv  EvalRuns.csv   (any can be skipped)
 *   2. Dry run (counts only, writes nothing):   node scripts/migrate-sheet.js you@gmail.com
 *   3. Real import:                              node scripts/migrate-sheet.js you@gmail.com --go
 *
 * The user must already exist (sign in to the web app once). Re-running is safe: rows are matched, never duplicated.
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from web/.env.local. Prints counts only, never email text.
 */
const fs = require('fs');
const path = require('path');

/** RFC 4180 CSV parser: quoted fields, doubled quotes, newlines inside quotes. Returns an array of {header: value} objects. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  const s = String(text).replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.length > 1 || row[0] !== '') rows.push(row); }
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] === undefined ? '' : r[i]])));
}

const bool = (v) => String(v).trim().toLowerCase() === 'true';
const num = (v) => (String(v).trim() === '' || isNaN(Number(v)) ? null : Number(v));
const iso = (v) => { const d = new Date(String(v).trim()); return String(v).trim() && !isNaN(d.getTime()) ? d.toISOString() : null; };
const date = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v).trim()) ? String(v).trim().slice(0, 10) : null);
const json = (v) => { try { return v ? JSON.parse(v) : {}; } catch { return {}; } };

/** Sheet row -> Postgres row (snake_case). Pure, so it can be tested. */
const map = {
  item: (r, userId) => ({
    user_id: userId, msg_id: r.msgId, thread_id: r.threadId, direction: r.direction || 'inbox', type: r.type, what: r.what,
    counterparty_name: r.counterpartyName || '', counterparty_email: r.counterpartyEmail || '', due: date(r.due), due_text: r.dueText || '',
    needs_date: bool(r.needsDate), confidence: num(r.confidence) ?? 0, evidence: r.evidence || '', status: r.status || 'suggested',
    task_id: r.taskId || null, event_id: r.eventId || null, fingerprint: r.fingerprint, prompt_version: r.promptVersion || null,
    created_at: iso(r.createdAt) || new Date().toISOString(), updated_at: iso(r.updatedAt) || new Date().toISOString(), completed_at: iso(r.completedAt),
  }),
  processed: (r, userId) => ({
    user_id: userId, msg_id: r.msgId, thread_id: r.threadId || '', direction: r.direction || null, internal_date: num(r.internalDate),
    processed_at: iso(r.processedAt) || new Date().toISOString(), item_count: num(r.itemCount) ?? 0, prompt_version: r.promptVersion || null, error: r.error || null,
  }),
  evalSet: (r, userId) => ({
    user_id: userId, msg_id: r.msgId, direction: r.direction || null, sent_iso: r.sentIso || null, from_addr: r.from || '', to_addr: r.to || '',
    subject: r.subject || '', cleaned_text: r.cleanedText || '', expected_json: r.expectedJson || '', tags: r.tags || '',
  }),
  evalRun: (r, userId) => ({
    user_id: userId, ts: iso(r.ts), prompt_version: r.promptVersion, model: r.model || null, rows: num(r.rows), shown_precision: num(r.shownPrecision),
    shown_recall: num(r.shownRecall), overall_precision: num(r.overallPrecision), overall_recall: num(r.overallRecall), date_accuracy: num(r.dateAccuracy),
    needs_date_accuracy: num(r.needsDateAccuracy), gate: bool(r.gate), per_type: json(r.perTypeJson), sweep: json(r.sweepJson),
  }),
  settings: (rows) => {
    const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const out = {};
    if (s.timezone) out.timezone = s.timezone;
    if (s.digestHour !== undefined && s.digestHour !== '') out.digest_hour = Math.min(23, Math.max(0, parseInt(s.digestHour, 10) || 0));
    if (s.autoAddEnabled !== undefined) out.auto_add_enabled = bool(s.autoAddEnabled);
    if (s.autoAddThreshold) out.auto_add_threshold = num(s.autoAddThreshold) ?? 0.9;
    if (s.shareMetrics !== undefined) out.share_metrics = bool(s.shareMetrics);
    if (s.onboarded !== undefined) out.onboarded = bool(s.onboarded);
    return out;
  },
};

async function main() {
  const email = process.argv[2];
  const go = process.argv.includes('--go');
  if (!email || email.startsWith('--')) { console.error('Usage: node scripts/migrate-sheet.js you@gmail.com [--go]'); process.exit(1); }

  const root = path.join(__dirname, '..');
  const envFile = fs.readFileSync(path.join(root, 'web', '.env.local'), 'utf8');
  const env = Object.fromEntries(envFile.split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1)]));
  const { createClient } = require(path.join(root, 'web', 'node_modules', '@supabase', 'supabase-js'));
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const dir = path.join(root, 'migration-data');
  const read = (name) => { const f = path.join(dir, name + '.csv'); return fs.existsSync(f) ? parseCsv(fs.readFileSync(f, 'utf8')) : null; };
  const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
  const check = (label, r) => { if (r.error) throw new Error(label + ': ' + r.error.message); return r; };

  const { data: user } = await db.from('users').select('id,email').ilike('email', email).maybeSingle();
  if (!user) { console.error('No user with that email. Sign in to the web app once first.'); process.exit(1); }
  console.log(`${go ? 'IMPORT' : 'DRY RUN'} for user ${user.id.slice(0, 8)}... (${go ? 'writing' : 'nothing is written'})`);

  const t = {
    Items: read('Items'), Feedback: read('Feedback'), Events: read('Events'), Processed: read('Processed'),
    Settings: read('Settings'), EvalSet: read('EvalSet'), EvalRuns: read('EvalRuns'),
  };
  for (const [k, v] of Object.entries(t)) console.log(`  ${k}: ${v ? v.length + ' rows' : 'file not found (skipped)'}`);
  if (!go) { console.log('Add --go to import.'); return; }

  // ---- Items: match existing rows by fingerprint, keep Stage A decisions (status, task ids), insert the rest.
  const idMap = {}; // Stage A itemId -> Postgres id (for feedback)
  if (t.Items) {
    const { data: existing } = await db.from('items').select('id,fingerprint').eq('user_id', user.id);
    const byFp = Object.fromEntries((existing || []).map((r) => [r.fingerprint, r.id]));
    let upd = 0, ins = 0;
    for (const r of t.Items) {
      if (!r.fingerprint || !r.what) continue;
      const row = map.item(r, user.id);
      if (byFp[r.fingerprint]) {
        const { id: _ignore, user_id, msg_id, thread_id, fingerprint, created_at, ...patch } = row; // never touch identity columns
        check('update item', await db.from('items').update(patch).eq('id', byFp[r.fingerprint]));
        idMap[r.itemId] = byFp[r.fingerprint]; upd++;
      } else {
        const res = check('insert item', await db.from('items').insert(row).select('id').single());
        idMap[r.itemId] = res.data.id; byFp[r.fingerprint] = res.data.id; ins++;
      }
    }
    console.log(`Items: ${ins} inserted, ${upd} updated with Stage A decisions`);
  }

  if (t.Feedback) {
    const rows = t.Feedback.filter((r) => idMap[r.itemId]).map((r) => ({ user_id: user.id, ts: iso(r.ts) || new Date().toISOString(), item_id: idMap[r.itemId], action: r.action, before_json: json(r.beforeJson), after_json: json(r.afterJson) }));
    const { data: have } = await db.from('feedback').select('ts,item_id,action').eq('user_id', user.id);
    const seen = new Set((have || []).map((x) => `${new Date(x.ts).toISOString()}|${x.item_id}|${x.action}`));
    const fresh = rows.filter((r) => !seen.has(`${r.ts}|${r.item_id}|${r.action}`));
    for (const c of chunk(fresh, 200)) check('feedback', await db.from('feedback').insert(c));
    console.log(`Feedback: ${fresh.length} inserted`);
  }

  if (t.Events) {
    const { data: have } = await db.from('events').select('ts,event').eq('user_id', user.id);
    const seen = new Set((have || []).map((x) => `${new Date(x.ts).toISOString()}|${x.event}`));
    const rows = t.Events.map((r) => ({ user_id: user.id, ts: iso(r.ts), event: r.event, meta: json(r.meta) })).filter((r) => r.ts && r.event && !seen.has(`${r.ts}|${r.event}`));
    for (const c of chunk(rows, 200)) check('events', await db.from('events').insert(c));
    console.log(`Events: ${rows.length} inserted`);
  }

  if (t.Processed) {
    const rows = t.Processed.filter((r) => r.msgId).map((r) => map.processed(r, user.id));
    for (const c of chunk(rows, 200)) check('processed', await db.from('processed_messages').upsert(c, { onConflict: 'user_id,msg_id', ignoreDuplicates: true }));
    console.log(`Processed: ${rows.length} checked (existing kept)`);
  }

  if (t.Settings) {
    const patch = map.settings(t.Settings);
    if (Object.keys(patch).length) check('settings', await db.from('users').update(patch).eq('id', user.id));
    console.log(`Settings applied: ${Object.keys(patch).join(', ') || 'none'}`);
  }

  if (t.EvalSet) {
    const rows = t.EvalSet.filter((r) => r.msgId).map((r) => map.evalSet(r, user.id));
    for (const c of chunk(rows, 50)) check('eval_set', await db.from('eval_set').upsert(c, { onConflict: 'user_id,msg_id' }));
    console.log(`EvalSet: ${rows.length} rows (${rows.filter((r) => r.expected_json).length} labelled)`);
  }

  if (t.EvalRuns) {
    const { data: have } = await db.from('eval_runs').select('ts,prompt_version').eq('user_id', user.id);
    const seen = new Set((have || []).map((x) => `${new Date(x.ts).toISOString()}|${x.prompt_version}`));
    const rows = t.EvalRuns.map((r) => map.evalRun(r, user.id)).filter((r) => r.ts && r.prompt_version && !seen.has(`${r.ts}|${r.prompt_version}`));
    if (rows.length) check('eval_runs', await db.from('eval_runs').insert(rows));
    console.log(`EvalRuns: ${rows.length} inserted`);
  }
  console.log('Done.');
}

if (require.main === module) main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
module.exports = { parseCsv, map };
