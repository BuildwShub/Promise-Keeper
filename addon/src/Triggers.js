/** Time triggers. Workspace add-ons allow time-driven triggers at most once per hour. */
var Triggers = {
  HANDLERS: ['hourlyJob', 'sendDigest'],

  remove: function () {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (Triggers.HANDLERS.indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
    });
  },

  installed: function () {
    return ScriptApp.getProjectTriggers().some(function (t) { return Triggers.HANDLERS.indexOf(t.getHandlerFunction()) !== -1; });
  },

  /**
   * Creates the ONE time-based trigger a Workspace add-on may have per user (hourly).
   * The daily digest runs inside it: first run at or after digestHour (in the user's timezone) each day.
   */
  install: function () {
    Triggers.remove();
    ScriptApp.newTrigger('hourlyJob').timeBased().everyHours(1).create();
    Db.logEvent('triggers_installed', { digestHour: Number(Db.getSetting('digestHour', 8)) });
  }
};

/** Hourly: scan new mail (runScan), sync completed tasks, optional auto-add, daily digest. Each step is isolated. */
function hourlyJob() {
  [runScan, function () { return Outputs.syncStatus(); }, function () { return Outputs.autoAdd(); }, function () { return Digest.sendIfDue(); }, function () { return Metrics.daily(); }].forEach(function (fn) {
    try { fn(); } catch (e) { Logger.log('hourlyJob step failed: ' + e); }
  });
}

function installTriggers() { Triggers.install(); }
function removeTriggers() { Triggers.remove(); }

/** Runs when the add-on is installed: prepare the DB only. Triggers are installed by the user's button click. */
function onInstall(e) {
  try { Db.getOrCreate(); } catch (err) { Logger.log(err); }
}
