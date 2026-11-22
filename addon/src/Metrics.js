/**
 * Phase 6 metrics: accept rate, edit rate, on-time rate (week 1 vs week 4), digest retention (D7/D30),
 * extraction precision. Writes the Metrics tab. Optional, opt-in daily post of AGGREGATE numbers only.
 * Never stores or sends email content.
 */
var Metrics = {
  /** Anonymous, stable id: first 12 hex chars of SHA-256 of the user's email. The email itself is never sent. */
  userId_: function () {
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'pk:' + Session.getEffectiveUser().getEmail());
    return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('').slice(0, 12);
  },

  localDate_: function (iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    return Utilities.formatDate(d, getTimezone_(), 'yyyy-MM-dd');
  },

  parseMeta_: function (s) {
    try { return s ? JSON.parse(s) : {}; } catch (e) { return {}; }
  },

  compute: function () {
    var tz = getTimezone_();
    var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var events = Db.read('Events').map(function (e) { return { ts: e.ts, event: e.event, meta: Metrics.parseMeta_(e.meta) }; });
    var out = MetricsFmt.compute({
      items: Db.read('Items'), feedback: Db.read('Feedback'), events: events, evalRuns: Db.read('EvalRuns')
    }, { today: today, localDate: Metrics.localDate_ });
    var now = new Date().toISOString();
    Db.replaceRows('Metrics', out.rows.map(function (r) { return { metric: r.metric, value: r.value, detail: r.detail, computedAt: now }; }));
    return out;
  },

  /** Opt-in only (setting shareMetrics=true). Sends counts and rates, no email content, no email address. */
  postAggregate: function (out) {
    if (String(Db.getSetting('shareMetrics', 'false')).toLowerCase() !== 'true') return { skipped: 'not opted in' };
    var props = PropertiesService.getScriptProperties();
    var endpoint = props.getProperty('METRICS_ENDPOINT'), key = props.getProperty('METRICS_KEY');
    if (!endpoint || !key) return { skipped: 'endpoint not configured' };
    var res = UrlFetchApp.fetch(endpoint, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true, followRedirects: true,
      payload: JSON.stringify({ key: key, uid: Metrics.userId_(), summary: out.summary })
    });
    return { status: res.getResponseCode() };
  },

  /** Once per day, from the hourly job: refresh the Metrics tab and (if opted in) post the aggregate. */
  daily: function () {
    var today = Utilities.formatDate(new Date(), getTimezone_(), 'yyyy-MM-dd');
    var props = PropertiesService.getUserProperties();
    if (props.getProperty('LAST_METRICS_DATE') === today) return null;
    props.setProperty('LAST_METRICS_DATE', today);
    var out = Metrics.compute();
    try { Logger.log(JSON.stringify(Metrics.postAggregate(out))); } catch (e) { Logger.log('metrics post failed: ' + e); }
    return out;
  },

  /** Developer-side: view over testers' anonymous posts (Collected tab) plus click/open events by uid. */
  fleet: function () {
    var today = Utilities.formatDate(new Date(), getTimezone_(), 'yyyy-MM-dd');
    var collected = Db.read('Collected').map(function (c) { return { ts: c.ts, uid: c.uid, payload: Metrics.parseMeta_(c.payloadJson) }; });
    var events = Db.read('Events').map(function (e) { return { ts: e.ts, event: e.event, meta: Metrics.parseMeta_(e.meta) }; });
    var rows = MetricsFmt.fleet(collected, events, today, Metrics.localDate_);
    var now = new Date().toISOString();
    Db.replaceRows('Fleet', rows.map(function (r) { return { metric: r.metric, value: r.value, detail: r.detail, computedAt: now }; }));
    return rows;
  }
};

/** Run from the editor: refreshes the Metrics tab. */
function computeMetrics() { return Metrics.compute(); }

/** Developer only: refreshes the Fleet tab from testers' anonymous posts. */
function computeFleetMetrics() { return Metrics.fleet(); }

/**
 * Developer only: run once from the editor. Generates a random shared secret and stores it as Script Property
 * METRICS_KEY. Testers' posts carry it automatically (Script Properties are shared by all users of the script).
 */
function generateMetricsKey() {
  var key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('METRICS_KEY', key);
  Logger.log('METRICS_KEY saved in Script Properties.');
}
