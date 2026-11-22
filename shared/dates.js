/* Pure date helpers on YYYY-MM-DD strings (UTC math, no timezone surprises). */
var Dates = (function () {
  var DAY_MS = 86400000;
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var PROMISE_TYPES = { my_promise: true };

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function parseIso(s) {
    if (typeof s !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return dt.getTime();
  }

  function isValidIso(s) { return parseIso(s) !== null; }

  function fromMs(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  function addDays(iso, n) {
    var ms = parseIso(iso);
    if (ms === null) throw new Error('bad date: ' + iso);
    return fromMs(ms + n * DAY_MS);
  }

  function daysBetween(a, b) { return Math.round((parseIso(b) - parseIso(a)) / DAY_MS); }

  function weekdayName(iso) { return WEEKDAYS[new Date(parseIso(iso)).getUTCDay()]; }

  /** "2026-11-19T10:30:00+05:30" -> "2026-11-19" (the local date as written). */
  function localDateOf(isoDateTime) {
    var m = /^(\d{4}-\d{2}-\d{2})/.exec(String(isoDateTime || ''));
    return m && isValidIso(m[1]) ? m[1] : null;
  }

  /**
   * Sanity-check a model-supplied due date.
   * Returns {due, needsDate, reason}; due is null when rejected.
   */
  function clampDue(due, opts) {
    opts = opts || {};
    var maxDays = opts.maxDays || 730;
    if (due === null || due === undefined || due === '') return { due: null, needsDate: false, reason: null };
    if (!isValidIso(due)) return { due: null, needsDate: true, reason: 'invalid_format' };
    due = due.trim();
    if (opts.sentDate && isValidIso(opts.sentDate)) {
      var delta = daysBetween(opts.sentDate, due);
      if (delta > maxDays) return { due: null, needsDate: true, reason: 'too_far' };
      if (delta < 0 && PROMISE_TYPES[opts.type]) return { due: null, needsDate: true, reason: 'before_sent' };
    }
    return { due: due, needsDate: false, reason: null };
  }

  /** overdue | today | week (next 7 days) | later | none */
  function bucket(due, today) {
    if (!isValidIso(due)) return 'none';
    var d = daysBetween(today, due);
    if (d < 0) return 'overdue';
    if (d === 0) return 'today';
    if (d <= 7) return 'week';
    return 'later';
  }

  /** Short calendar for the prompt so the model never does weekday arithmetic. */
  function calendarHint(sentDate, days) {
    var out = [];
    for (var i = 0; i < (days || 21); i++) {
      var iso = addDays(sentDate, i);
      out.push(weekdayName(iso).slice(0, 3) + ' ' + iso + (i === 0 ? ' (sent day)' : ''));
    }
    return out.join('\n');
  }

  return { isValidIso: isValidIso, addDays: addDays, daysBetween: daysBetween, weekdayName: weekdayName, localDateOf: localDateOf, clampDue: clampDue, bucket: bucket, calendarHint: calendarHint };
})();

if (typeof module !== 'undefined') module.exports = Dates;
