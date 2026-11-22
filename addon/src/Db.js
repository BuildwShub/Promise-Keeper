/** Per-user Sheet DB. ID kept in UserProperties. Stores extracted fields only, never full bodies. */
var DB_TABS = {
  Processed: ['msgId', 'threadId', 'direction', 'internalDate', 'processedAt', 'itemCount', 'promptVersion', 'error'],
  Items: ['itemId', 'msgId', 'threadId', 'direction', 'type', 'what', 'counterpartyName', 'counterpartyEmail', 'due', 'dueText', 'needsDate', 'confidence', 'evidence', 'status', 'taskId', 'eventId', 'fingerprint', 'promptVersion', 'createdAt', 'updatedAt', 'completedAt'],
  Feedback: ['ts', 'itemId', 'action', 'beforeJson', 'afterJson'],
  Settings: ['key', 'value'],
  EvalSet: ['msgId', 'direction', 'sentIso', 'from', 'to', 'subject', 'cleanedText', 'expectedJson', 'tags'],
  EvalRuns: ['ts', 'promptVersion', 'model', 'rows', 'shownPrecision', 'shownRecall', 'overallPrecision', 'overallRecall', 'dateAccuracy', 'needsDateAccuracy', 'gate', 'perTypeJson', 'sweepJson'],
  Events: ['ts', 'event', 'meta'],
  Metrics: ['metric', 'value', 'detail', 'computedAt'],      // Phase 6: written by Metrics.compute()
  Collected: ['ts', 'uid', 'payloadJson'],                   // Phase 6: anonymous tester posts (developer's sheet)
  Fleet: ['metric', 'value', 'detail', 'computedAt']          // Phase 6: developer-side view over Collected
};

var Db = {
  getOrCreate: function () {
    var props = PropertiesService.getUserProperties();
    var id = props.getProperty('DB_ID');
    if (id) {
      try { return SpreadsheetApp.openById(id); } catch (e) { /* deleted: recreate */ }
    }
    var ss = SpreadsheetApp.create('Promise Keeper DB');
    props.setProperty('DB_ID', ss.getId());
    var first = true;
    Object.keys(DB_TABS).forEach(function (name) {
      var sh = first ? ss.getSheets()[0].setName(name) : ss.insertSheet(name);
      first = false;
      var headers = DB_TABS[name];
      sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@'); // plain text: keeps YYYY-MM-DD intact
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      sh.setFrozenRows(1);
    });
    return ss;
  },

  /** Tab by name. A tab added in a later phase (Metrics, Collected, Fleet) is created on first use. */
  sheet: function (name) {
    var ss = Db.getOrCreate();
    var sh = ss.getSheetByName(name);
    if (!sh && DB_TABS[name]) {
      sh = ss.insertSheet(name);
      var headers = DB_TABS[name];
      sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@');
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    if (!sh) throw new Error('Missing tab ' + name);
    return sh;
  },

  /** Replace all data rows of a tab (header kept). */
  replaceRows: function (name, objs) {
    var sh = Db.sheet(name);
    var headers = DB_TABS[name];
    if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
    if (!objs.length) return;
    var vals = objs.map(function (o) { return headers.map(function (h) { return Db.serialize_(o[h]); }); });
    sh.getRange(2, 1, vals.length, headers.length).setValues(vals);
  },

  /** All rows as objects (header-keyed). Booleans/numbers coerced where the schema says so. */
  read: function (name) {
    var sh = Db.sheet(name);
    var last = sh.getLastRow();
    if (last < 2) return [];
    var headers = DB_TABS[name];
    var vals = sh.getRange(2, 1, last - 1, headers.length).getValues();
    return vals.map(function (r, i) {
      var o = { _row: i + 2 };
      headers.forEach(function (h, c) { o[h] = Db.coerce_(h, r[c]); });
      return o;
    });
  },

  append: function (name, obj) {
    var headers = DB_TABS[name];
    Db.sheet(name).appendRow(headers.map(function (h) { return Db.serialize_(obj[h]); }));
  },

  /** Update the row whose `keyCol` equals `keyVal`. Returns true when found. */
  update: function (name, keyCol, keyVal, patch) {
    var rows = Db.read(name);
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][keyCol]) === String(keyVal)) {
        var headers = DB_TABS[name];
        var sh = Db.sheet(name);
        Object.keys(patch).forEach(function (k) {
          var c = headers.indexOf(k);
          if (c !== -1) sh.getRange(rows[i]._row, c + 1).setValue(Db.serialize_(patch[k]));
        });
        return true;
      }
    }
    return false;
  },

  getSetting: function (key, dflt) {
    var r = Db.read('Settings').filter(function (x) { return x.key === key; })[0];
    return r ? r.value : dflt;
  },

  /** Upsert a Settings row. */
  setSetting: function (key, value) {
    if (!Db.update('Settings', 'key', key, { value: value })) Db.append('Settings', { key: key, value: value });
  },

  logEvent: function (event, meta) {
    Db.append('Events', { ts: new Date().toISOString(), event: event, meta: meta ? JSON.stringify(meta) : '' });
  },

  serialize_: function (v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return v;
  },

  coerce_: function (header, v) {
    // Sheets may auto-convert "2026-11-20" / "20 Nov" into Date cells; turn them back into text.
    if (v instanceof Date) {
      var tz = Session.getScriptTimeZone();
      if (header === 'due') return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      if (header === 'dueText') return Utilities.formatDate(v, tz, 'd MMM');
      return v.toISOString();
    }
    if (header === 'needsDate') return String(v).toLowerCase() === 'true';
    if (header === 'confidence' || header === 'itemCount') return v === '' ? 0 : Number(v);
    return v === null || v === undefined ? '' : String(v);
  }
};

/** Run once from the editor to create the Sheet. */
function setupDb() {
  var ss = Db.getOrCreate();
  Logger.log('DB: ' + ss.getUrl());
}
