/**
 * Digest open/click tracking. Deploy as Web app (Execute as: me, Access: anyone).
 * Gmail's image proxy may block the open pixel, so clicks are the reliable signal (plan.md fallback).
 * The web app runs as the deployer, so events land in the deployer's DB.
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.e === 'open') {
      Db.logEvent('digest_open', { d: p.d || '', uid: p.uid || '' });
      return ContentService.createTextOutput('');
    }
    if (p.e === 'click') {
      Db.logEvent('digest_click', { i: p.i || '', uid: p.uid || '' });
      var url = String(p.u || '');
      // Only redirect to Gmail thread links: never an open redirect.
      if (/^https:\/\/mail\.google\.com\/mail\/u\/\d+\/#/.test(url)) {
        return HtmlService.createHtmlOutput('<script>window.top.location.href=' + JSON.stringify(url) + ';</script><a href="' + url.replace(/"/g, '') + '" target="_top">Open thread</a>');
      }
    }
  } catch (err) { /* tracking must never break the link */ }
  return ContentService.createTextOutput('ok');
}

/**
 * Collection endpoint for opted-in testers (plan.md Phase 6): receives AGGREGATE numbers only.
 * Requires Script Property METRICS_KEY (see setMetricsKey). Whitelists fields; stores nothing else.
 */
function doPost(e) {
  var out = function (t) { return ContentService.createTextOutput(t); };
  try {
    var body = JSON.parse(e.postData.contents);
    var key = PropertiesService.getScriptProperties().getProperty('METRICS_KEY');
    if (!key || body.key !== key) return out('denied');
    if (!/^[0-9a-f]{12}$/.test(String(body.uid))) return out('bad uid');
    var NUM = ['accepted', 'dismissed', 'acceptRate', 'editRate', 'onTimeRate', 'onTimeDen', 'digestSent'];
    var s = body.summary || {}, clean = {};
    NUM.forEach(function (k) { if (typeof s[k] === 'number') clean[k] = s[k]; });
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(s.firstDigestDate))) clean.firstDigestDate = s.firstDigestDate;
    ['d7', 'd30'].forEach(function (k) { if (typeof s[k] === 'boolean') clean[k] = s[k]; });
    Db.append('Collected', { ts: new Date().toISOString(), uid: body.uid, payloadJson: JSON.stringify({ summary: clean }) });
    return out('ok');
  } catch (err) {
    return out('error');
  }
}
