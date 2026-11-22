/** Morning digest email to self. Sections: overdue, due today, due this week, waiting on others. */
var Digest = {
  trackBase_: function () {
    try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
  },

  send: function () {
    var today = Utilities.formatDate(new Date(), getTimezone_(), 'yyyy-MM-dd');
    var d = DigestFmt.buildDigest(Db.read('Items'), today, { trackBase: Digest.trackBase_(), uid: Metrics.userId_() });
    if (!d) { Logger.log('Digest skipped: nothing to report.'); return null; }
    MailApp.sendEmail({
      to: Session.getEffectiveUser().getEmail(), subject: d.subject, body: d.text, htmlBody: d.html, name: 'Promise Keeper'
    });
    Db.logEvent('digest_sent', d.counts);
    Logger.log('Digest sent: ' + d.subject);
    return d;
  }
};

/**
 * Called by the hourly job. Sends the digest once per day, on the first run at or after digestHour
 * in the user's timezone. The day is marked handled even when the digest was empty and skipped.
 */
Digest.sendIfDue = function () {
  var tz = getTimezone_();
  var hour = Number(Utilities.formatDate(new Date(), tz, 'H'));
  var digestHour = Number(Db.getSetting('digestHour', 8));
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var props = PropertiesService.getUserProperties();
  if (hour < digestHour || props.getProperty('LAST_DIGEST_DATE') === today) return null;
  props.setProperty('LAST_DIGEST_DATE', today);
  return Digest.send();
};

/** Manual run (always sends if there is something to report). */
function sendDigest() { return Digest.send(); }
