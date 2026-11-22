/**
 * Phase 2 gate. Usage:
 *   Eval.exportSample(150)   -> fills EvalSet with cleaned text of your own mail
 *   (hand-fill expectedJson, e.g. [{"type":"my_promise","what":"Send deck","due":"2026-11-20"}] ; [] = no items)
 *   Eval.run()               -> scores current PROMPT_VERSION, appends to EvalRuns
 * Delete EvalSet text when done (Eval.wipeText()).
 */
var Eval = {
  exportSample: function (n) {
    n = n || 150;
    var sentN = Math.round(n / 3), inboxN = n - sentN;
    var tz = getTimezone_();
    var existing = {};
    Db.read('EvalSet').forEach(function (r) { existing[r.msgId] = true; });

    var pick = function (query, count) {
      var ids = Fetch.listIds(query, count * 4, existing);
      for (var i = ids.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = ids[i]; ids[i] = ids[j]; ids[j] = t; }
      return ids.slice(0, count);
    };
    var refs = pick('in:sent', sentN)
      .concat(pick('in:anywhere -in:sent -in:drafts -in:spam -in:trash -category:promotions -category:social -category:forums', inboxN));

    var added = 0;
    refs.forEach(function (ref) {
      var msg = Fetch.getMessage(ref.id);
      if (!msg) return;
      var cleaned = Clean.clean(msg.body, { maxChars: CONFIG.MAX_CLEAN_CHARS });
      if (cleaned.length < CONFIG.MIN_BODY_CHARS) return;
      Db.append('EvalSet', {
        msgId: msg.msgId, direction: msg.direction, sentIso: Fetch.sentIso(msg.internalDate, tz),
        from: msg.from, to: msg.to, subject: msg.subject, cleanedText: cleaned, expectedJson: '', tags: ''
      });
      added++;
    });
    Logger.log('Added ' + added + ' rows. Label expectedJson, tag hinglish/trap in `tags`.');
  },

  run: function () {
    var started = Date.now();
    var userEmail = Session.getEffectiveUser().getEmail();
    var tz = getTimezone_();
    var cache = CacheService.getUserCache();
    var rows = [];
    var pending = 0;

    var all = Db.read('EvalSet');
    for (var i = 0; i < all.length; i++) {
      var r = all[i];
      var expected = Score.parseExpected(r.expectedJson);
      if (expected === null) continue; // unlabelled
      var key = 'ev:' + CONFIG.PROMPT_VERSION + ':' + r.msgId;
      var raw = cache.get(key);
      if (raw === null) {
        if (Date.now() - started > CONFIG.RUN_BUDGET_MS) { pending++; continue; }
        var items = Gemini.extract({
          userEmail: userEmail, direction: r.direction, timezone: tz, sentIso: r.sentIso,
          from: r.from, to: r.to, cc: '', subject: r.subject, body: r.cleanedText
        });
        raw = JSON.stringify(items);
        cache.put(key, raw, 21600);
      }
      var v = Validate.validateItems(JSON.parse(raw), { cleanedText: r.cleanedText, direction: r.direction, sentDate: Dates.localDateOf(r.sentIso) });
      rows.push({ predicted: v.items, expected: expected });
    }

    if (pending) { Logger.log(pending + ' rows still pending (time budget). Run Eval.run() again to continue; scores below are partial.'); }
    var m = Score.computeMetrics(rows, { showThreshold: CONFIG.SHOW_CONFIDENCE });
    var sweep = Score.thresholdSweep(rows);
    Db.append('EvalRuns', {
      ts: new Date().toISOString(), promptVersion: CONFIG.PROMPT_VERSION, model: CONFIG.GEMINI_MODEL, rows: m.rows,
      shownPrecision: m.shown.precision, shownRecall: m.shown.recall, overallPrecision: m.overall.precision, overallRecall: m.overall.recall,
      dateAccuracy: m.dateAccuracy, needsDateAccuracy: m.needsDateAccuracy, gate: m.gate && !pending,
      perTypeJson: JSON.stringify(m.perType), sweepJson: JSON.stringify(sweep)
    });
    Logger.log(JSON.stringify({ rows: m.rows, shown: m.shown, dateAccuracy: m.dateAccuracy, gate: m.gate, pending: pending }));
    return m;
  },

  /** Privacy: remove stored email text once labelling/eval is done. */
  wipeText: function () {
    var sh = Db.sheet('EvalSet');
    var col = DB_TABS.EvalSet.indexOf('cleanedText') + 1;
    if (sh.getLastRow() > 1) sh.getRange(2, col, sh.getLastRow() - 1, 1).clearContent();
  }
};

function evalExportSample() { Eval.exportSample(150); }
function evalRun() { Eval.run(); }
function evalWipeText() { Eval.wipeText(); }

/**
 * Lists every false positive / false negative of the current PROMPT_VERSION.
 * Reads cached predictions only (no Gemini calls); rows not yet cached are skipped.
 */
Eval.diagnose = function () {
  var cache = CacheService.getUserCache();
  var out = { fp: 0, fn: 0, skipped: 0 };
  Db.read('EvalSet').forEach(function (r) {
    var expected = Score.parseExpected(r.expectedJson);
    if (expected === null) return;
    var raw = cache.get('ev:' + CONFIG.PROMPT_VERSION + ':' + r.msgId);
    if (raw === null) { out.skipped++; return; }
    var v = Validate.validateItems(JSON.parse(raw), { cleanedText: r.cleanedText, direction: r.direction, sentDate: Dates.localDateOf(r.sentIso) });
    var m = Score.matchItems(v.items, expected, 0.5);
    m.unmatchedP.forEach(function (p) {
      out.fp++;
      Logger.log('FP row ' + r._row + ' | ' + r.subject.slice(0, 50) + ' | ' + JSON.stringify({ type: p.type, what: p.what, due: p.due, conf: p.confidence, evidence: p.evidence.slice(0, 100) }));
    });
    m.unmatchedE.forEach(function (e) {
      out.fn++;
      Logger.log('FN row ' + r._row + ' | ' + r.subject.slice(0, 50) + ' | expected ' + JSON.stringify(e) + ' | predicted ' + JSON.stringify(v.items.map(function (i) { return i.type + ':' + i.what; })));
    });
  });
  Logger.log(JSON.stringify(out));
};

function evalDiagnose() { Eval.diagnose(); }
