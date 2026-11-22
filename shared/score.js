/* Eval scoring: match predicted items to hand-labelled ones, compute metrics. Pure. */
var Score = (function () {
  function dedupDep() { return typeof Dedup !== 'undefined' ? Dedup : require('./dedup.js'); }
  function schemaDep() { return typeof Schema !== 'undefined' ? Schema : require('./schema.js'); }

  function ratio(n, d) { return d === 0 ? null : n / d; }

  /** Greedy match: highest-confidence predictions first, same type, Jaccard(what) >= thr. */
  function matchItems(predicted, expected, thr) {
    var D = dedupDep();
    thr = thr === undefined ? 0.5 : thr;
    var used = {};
    var pairs = [];
    var unmatchedP = [];
    var order = predicted.slice().sort(function (a, b) { return (b.confidence || 0) - (a.confidence || 0); });
    order.forEach(function (p) {
      var best = -1, bestScore = 0;
      expected.forEach(function (e, i) {
        if (used[i] || e.type !== p.type) return;
        var s = D.jaccard(p.what, e.what);
        if (s >= thr && s > bestScore) { best = i; bestScore = s; }
      });
      if (best === -1) unmatchedP.push(p);
      else { used[best] = 1; pairs.push({ p: p, e: expected[best] }); }
    });
    var unmatchedE = expected.filter(function (_, i) { return !used[i]; });
    return { pairs: pairs, unmatchedP: unmatchedP, unmatchedE: unmatchedE };
  }

  function counts() { return { tp: 0, fp: 0, fn: 0 }; }
  function finish(c) { return { tp: c.tp, fp: c.fp, fn: c.fn, precision: ratio(c.tp, c.tp + c.fp), recall: ratio(c.tp, c.tp + c.fn) }; }

  /**
   * rows: [{predicted:[...], expected:[{type,what,due}]}]
   * opts: {showThreshold=0.6, matchThreshold=0.5}
   */
  function computeMetrics(rows, opts) {
    opts = opts || {};
    var show = opts.showThreshold === undefined ? 0.6 : opts.showThreshold;
    var thr = opts.matchThreshold === undefined ? 0.5 : opts.matchThreshold;
    var types = schemaDep().TYPES;
    var all = counts(), shown = counts(), perType = {};
    types.forEach(function (t) { perType[t] = counts(); });
    var dateOk = 0, dateN = 0, ndOk = 0, ndN = 0, totalExpected = 0;

    rows.forEach(function (row) {
      var exp = row.expected || [];
      totalExpected += exp.length;

      var m = matchItems(row.predicted || [], exp, thr);
      all.tp += m.pairs.length; all.fp += m.unmatchedP.length; all.fn += m.unmatchedE.length;
      m.pairs.forEach(function (x) {
        perType[x.e.type].tp++;
        ndN++;
        if (!!x.p.needsDate === !x.e.due) ndOk++;
        if (x.e.due) { dateN++; if (x.p.due === x.e.due) dateOk++; }
      });
      m.unmatchedP.forEach(function (p) { perType[p.type].fp++; });
      m.unmatchedE.forEach(function (e) { perType[e.type].fn++; });

      var vis = (row.predicted || []).filter(function (p) { return (p.confidence || 0) >= show; });
      var ms = matchItems(vis, exp, thr);
      shown.tp += ms.pairs.length; shown.fp += ms.unmatchedP.length;
    });

    var per = {};
    types.forEach(function (t) { per[t] = finish(perType[t]); });
    var sh = { tp: shown.tp, fp: shown.fp, precision: ratio(shown.tp, shown.tp + shown.fp), recall: ratio(shown.tp, totalExpected) };
    return {
      rows: rows.length,
      expectedItems: totalExpected,
      overall: finish(all),
      shown: sh,
      perType: per,
      dateAccuracy: ratio(dateOk, dateN),
      dateN: dateN,
      needsDateAccuracy: ratio(ndOk, ndN),
      gate: gate(sh.precision, ratio(dateOk, dateN))
    };
  }

  /** Phase 2 exit criteria. */
  function gate(shownPrecision, dateAccuracy) {
    return shownPrecision !== null && dateAccuracy !== null && shownPrecision >= 0.85 && dateAccuracy >= 0.85;
  }

  /** Precision of shown items at several thresholds, for calibrating the 0.6 cut-off. */
  function thresholdSweep(rows, thresholds, matchThreshold) {
    return (thresholds || [0.4, 0.5, 0.6, 0.7, 0.8, 0.9]).map(function (t) {
      var m = computeMetrics(rows, { showThreshold: t, matchThreshold: matchThreshold });
      return { threshold: t, precision: m.shown.precision, recall: m.shown.recall };
    });
  }

  function parseExpected(json) {
    if (json === '' || json === null || json === undefined) return null; // unlabelled
    var arr = typeof json === 'string' ? JSON.parse(json) : json;
    return (arr || []).map(function (e) { return { type: e.type, what: e.what || '', due: e.due || '' }; });
  }

  return { matchItems: matchItems, computeMetrics: computeMetrics, thresholdSweep: thresholdSweep, gate: gate, parseExpected: parseExpected };
})();

if (typeof module !== 'undefined') module.exports = Score;
