/* Pure product metrics (plan.md Phase 6). No Apps Script globals. */
var MetricsFmt = (function () {
  function datesDep() { return typeof Dates !== 'undefined' ? Dates : require('./dates.js'); }

  var ACCEPTED = { accepted: 1, done: 1, possibly_resolved: 1 };

  function ratio(n, d) { return d === 0 ? null : n / d; }
  function round(x) { return x === null || x === undefined ? null : Math.round(x * 1000) / 1000; }
  function slice10(iso) { return String(iso || '').slice(0, 10); }

  /** Accept rate = accepted / (accepted + dismissed): the real-world precision. Edit rate = edited / decided. */
  function acceptStats(items, feedback) {
    var acc = 0, dis = 0, sug = 0, done = 0;
    items.forEach(function (i) {
      if (ACCEPTED[i.status]) acc++;
      if (i.status === 'dismissed') dis++;
      if (i.status === 'suggested') sug++;
      if (i.status === 'done') done++;
    });
    var edited = {};
    feedback.forEach(function (f) {
      if (f.action !== 'edit') return;
      var b;
      try { b = JSON.parse(f.beforeJson || '{}'); } catch (e) { return; }
      if (b && b.what !== undefined) edited[f.itemId] = 1; // real edits only (not status answers)
    });
    var ed = Object.keys(edited).length;
    return { total: items.length, suggested: sug, accepted: acc, dismissed: dis, done: done, edited: ed, acceptRate: round(ratio(acc, acc + dis)), editRate: round(ratio(ed, acc + dis)) };
  }

  /**
   * On-time rate = completed by the due date / items with a due date.
   * Only items that can already be judged count: done, or due date passed.
   */
  function onTime(items, today, localDate) {
    var num = 0, den = 0;
    items.forEach(function (i) {
      if (!i.due || !ACCEPTED[i.status]) return;
      var done = i.status === 'done' && i.completedAt;
      if (!done && i.due >= today) return;
      den++;
      if (done && localDate(i.completedAt) <= i.due) num++;
    });
    return { num: num, den: den, rate: round(ratio(num, den)) };
  }

  /** Week 1 vs week 4 of use, measured from the first item's creation date. */
  function onTimeByWeek(items, today, localDate) {
    var D = datesDep();
    var dates = items.map(function (i) { return localDate(i.createdAt); }).filter(Boolean).sort();
    if (!dates.length) return { w1: onTime([], today, localDate), w4: onTime([], today, localDate), first: null };
    var first = dates[0];
    function cohort(from, to) {
      return onTime(items.filter(function (i) {
        var d = localDate(i.createdAt);
        var n = D.daysBetween(first, d);
        return n >= from && n <= to;
      }), today, localDate);
    }
    return { w1: cohort(0, 6), w4: cohort(21, 27), first: first };
  }

  /** Retained on day N if there is any engagement in days N..N+6 after the first digest. Null while not yet measurable. */
  function retention(firstSent, engagedDates, offset, today) {
    var D = datesDep();
    if (!firstSent) return null;
    if (D.daysBetween(firstSent, today) < offset) return null;
    return engagedDates.some(function (d) {
      var n = D.daysBetween(firstSent, d);
      return n >= offset && n <= offset + 6;
    });
  }

  function digestStats(events, today, localDate) {
    var sent = [], engaged = [];
    events.forEach(function (e) {
      var d = localDate(e.ts);
      if (e.event === 'digest_sent') sent.push(d);
      else if (e.event === 'digest_open' || e.event === 'digest_click') engaged.push(d);
    });
    sent.sort();
    var first = sent[0] || null;
    var uniq = {};
    engaged.forEach(function (d) { uniq[d] = 1; });
    return { sent: sent.length, engagedDays: Object.keys(uniq).length, first: first, d7: retention(first, engaged, 7, today), d30: retention(first, engaged, 30, today) };
  }

  function latestEval(evalRuns) {
    return evalRuns.length ? evalRuns[evalRuns.length - 1] : null;
  }

  function show(v) { return v === null || v === undefined ? 'n/a' : v; }
  function frac(n, d) { return n + '/' + d; }

  /** data: {items, feedback, events, evalRuns}; opts: {today, localDate}. Returns [{metric, value, detail}]. */
  function compute(data, opts) {
    var localDate = opts.localDate || slice10;
    var a = acceptStats(data.items, data.feedback);
    var ot = onTime(data.items, opts.today, localDate);
    var wk = onTimeByWeek(data.items, opts.today, localDate);
    var dg = digestStats(data.events, opts.today, localDate);
    var ev = latestEval(data.evalRuns || []);
    var rows = [
      { metric: 'items_total', value: a.total, detail: 'suggested ' + a.suggested + ', accepted ' + a.accepted + ', dismissed ' + a.dismissed + ', done ' + a.done },
      { metric: 'accept_rate', value: show(a.acceptRate), detail: 'accepted / (accepted + dismissed) = ' + frac(a.accepted, a.accepted + a.dismissed) + ' (real-world precision)' },
      { metric: 'edit_rate', value: show(a.editRate), detail: 'edited items / decided items = ' + frac(a.edited, a.accepted + a.dismissed) },
      { metric: 'on_time_rate', value: show(ot.rate), detail: 'completed by due date / items with a due date that can be judged = ' + frac(ot.num, ot.den) },
      { metric: 'on_time_rate_week1', value: show(wk.w1.rate), detail: frac(wk.w1.num, wk.w1.den) + ' (first item ' + show(wk.first) + ')' },
      { metric: 'on_time_rate_week4', value: show(wk.w4.rate), detail: frac(wk.w4.num, wk.w4.den) },
      { metric: 'digests_sent', value: dg.sent, detail: 'first digest ' + show(dg.first) },
      { metric: 'digest_engaged_days', value: dg.engagedDays, detail: 'days with a digest open or click' },
      { metric: 'digest_retention_d7', value: dg.d7 === null ? 'n/a' : (dg.d7 ? 1 : 0), detail: 'engaged in days 7 to 13 after the first digest' },
      { metric: 'digest_retention_d30', value: dg.d30 === null ? 'n/a' : (dg.d30 ? 1 : 0), detail: 'engaged in days 30 to 36 after the first digest' },
      { metric: 'extraction_precision', value: ev ? show(ev.shownPrecision) : 'n/a', detail: ev ? 'EvalRuns latest: prompt ' + ev.promptVersion + ', date accuracy ' + show(ev.dateAccuracy) + ', gate ' + ev.gate : 'no eval run yet' }
    ];
    return { rows: rows, summary: { accepted: a.accepted, dismissed: a.dismissed, acceptRate: a.acceptRate, editRate: a.editRate, onTimeRate: ot.rate, onTimeDen: ot.den, firstDigestDate: dg.first, digestSent: dg.sent, d7: dg.d7, d30: dg.d30 } };
  }

  /**
   * Developer-side view over testers' anonymous posts.
   * collected: [{ts, uid, payload:{summary}}]; events: [{ts, event, meta:{uid}}].
   */
  function fleet(collected, events, today, localDate) {
    localDate = localDate || slice10;
    var latest = {};
    collected.forEach(function (c) { if (!latest[c.uid] || c.ts > latest[c.uid].ts) latest[c.uid] = c; });
    var uids = Object.keys(latest);
    function mean(key) {
      var v = uids.map(function (u) { return latest[u].payload && latest[u].payload.summary ? latest[u].payload.summary[key] : null; }).filter(function (x) { return typeof x === 'number'; });
      return v.length ? round(v.reduce(function (s, x) { return s + x; }, 0) / v.length) : null;
    }
    var elig7 = 0, ret7 = 0, elig30 = 0, ret30 = 0;
    uids.forEach(function (u) {
      var first = latest[u].payload && latest[u].payload.summary && latest[u].payload.summary.firstDigestDate;
      var eng = events.filter(function (e) { return (e.event === 'digest_open' || e.event === 'digest_click') && e.meta && e.meta.uid === u; }).map(function (e) { return localDate(e.ts); });
      var r7 = retention(first, eng, 7, today), r30 = retention(first, eng, 30, today);
      if (r7 !== null) { elig7++; if (r7) ret7++; }
      if (r30 !== null) { elig30++; if (r30) ret30++; }
    });
    return [
      { metric: 'testers_reporting', value: uids.length, detail: 'anonymous ids with at least one post' },
      { metric: 'mean_accept_rate', value: show(mean('acceptRate')), detail: 'mean of each tester\'s accept rate' },
      { metric: 'mean_edit_rate', value: show(mean('editRate')), detail: '' },
      { metric: 'mean_on_time_rate', value: show(mean('onTimeRate')), detail: '' },
      { metric: 'digest_retention_d7', value: show(round(ratio(ret7, elig7))), detail: frac(ret7, elig7) + ' eligible testers retained' },
      { metric: 'digest_retention_d30', value: show(round(ratio(ret30, elig30))), detail: frac(ret30, elig30) + ' eligible testers retained' }
    ];
  }

  return { acceptStats: acceptStats, onTime: onTime, onTimeByWeek: onTimeByWeek, retention: retention, digestStats: digestStats, compute: compute, fleet: fleet };
})();

if (typeof module !== 'undefined') module.exports = MetricsFmt;
