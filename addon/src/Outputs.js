/**
 * Phase 3: Accept / Edit / Dismiss / Done -> Google Tasks + Calendar, with status sync.
 * Idempotent: an item with a taskId never gets a second task.
 */
var TASKLIST_TITLE = 'Promise Keeper';

var Outputs = {
  // ---------- lookups ----------
  find_: function (itemId) {
    var it = Db.read('Items').filter(function (r) { return r.itemId === itemId; })[0];
    if (!it) throw new Error('Item not found: ' + itemId);
    return it;
  },

  snapshot_: function (it) {
    return { what: it.what, type: it.type, due: it.due, counterpartyName: it.counterpartyName, status: it.status, taskId: it.taskId, eventId: it.eventId };
  },

  feedback_: function (itemId, action, before, after) {
    Db.append('Feedback', { ts: new Date().toISOString(), itemId: itemId, action: action, beforeJson: JSON.stringify(before || {}), afterJson: JSON.stringify(after || {}) });
  },

  taskListId_: function () {
    var props = PropertiesService.getUserProperties();
    var id = props.getProperty('TASKLIST_ID');
    if (id) {
      try { Tasks.Tasklists.get(id); return id; } catch (e) { /* deleted: recreate */ }
    }
    var lists = Tasks.Tasklists.list({ maxResults: 100 }).items || [];
    var found = lists.filter(function (l) { return l.title === TASKLIST_TITLE; })[0];
    id = (found || Tasks.Tasklists.insert({ title: TASKLIST_TITLE })).id;
    props.setProperty('TASKLIST_ID', id);
    return id;
  },

  /** Run fn, ignoring "already gone" API errors. */
  safe_: function (fn) {
    try { return fn(); } catch (e) {
      var m = String(e.message || e);
      if (/not found|deleted|404|410|Resource has been deleted/i.test(m)) return null;
      throw e;
    }
  },

  withLock_: function (fn) {
    var lock = LockService.getUserLock();
    lock.waitLock(15000);
    try { return fn(); } finally { lock.releaseLock(); }
  },

  // ---------- actions ----------
  acceptItem: function (itemId) {
    return Outputs.withLock_(function () {
      var it = Outputs.find_(itemId);
      if (it.status === 'done') return it;
      if (it.status === 'accepted' && it.taskId) return it; // idempotent
      var before = Outputs.snapshot_(it);
      var listId = Outputs.taskListId_();
      var patch = { status: 'accepted', updatedAt: new Date().toISOString() };

      if (!it.taskId) {
        var task = Tasks.Tasks.insert(OutputsFmt.taskResource(it), listId);
        patch.taskId = task.id;
        Db.update('Items', 'itemId', itemId, patch); // save the id before the event call can fail
      }
      if (OutputsFmt.wantsEvent(it) && !it.eventId) {
        var ev = Calendar.Events.insert(OutputsFmt.eventResource(it), 'primary');
        patch.eventId = ev.id;
      }
      Db.update('Items', 'itemId', itemId, patch);
      var after = Outputs.find_(itemId);
      Outputs.feedback_(itemId, 'accept', before, Outputs.snapshot_(after));
      return after;
    });
  },

  /** patch: any of {what, type, due, counterpartyName}. Updates the item, its task and its event. */
  editItem: function (itemId, patch) {
    return Outputs.withLock_(function () {
      var it = Outputs.find_(itemId);
      var before = Outputs.snapshot_(it);
      var next = Object.assign({}, it);
      ['what', 'type', 'due', 'counterpartyName'].forEach(function (k) { if (patch[k] !== undefined) next[k] = String(patch[k]).trim(); });
      next.needsDate = !next.due;
      if (next.due && !Dates.isValidIso(next.due)) throw new Error('Bad date: ' + next.due);
      if (Schema.TYPES.indexOf(next.type) === -1) throw new Error('Bad type: ' + next.type);

      var row = { what: next.what, type: next.type, due: next.due, counterpartyName: next.counterpartyName, needsDate: next.needsDate, updatedAt: new Date().toISOString() };
      if (it.status === 'accepted') Object.assign(row, Outputs.syncExternal_(it, next));
      Db.update('Items', 'itemId', itemId, row);
      var after = Outputs.find_(itemId);
      Outputs.feedback_(itemId, 'edit', before, Outputs.snapshot_(after));
      return after;
    });
  },

  /** Push an edit to the task and event. Returns {taskId?, eventId?} changes for the row. */
  syncExternal_: function (oldIt, next) {
    var out = {};
    var listId = Outputs.taskListId_();
    if (oldIt.taskId) {
      // Clearing a date needs a full update (patch cannot send a null due).
      var clearing = !next.due && oldIt.due;
      var res = Outputs.safe_(function () {
        return clearing
          ? Tasks.Tasks.update(Object.assign({ id: oldIt.taskId, status: 'needsAction' }, OutputsFmt.taskResource(next)), listId, oldIt.taskId)
          : Tasks.Tasks.patch(OutputsFmt.taskResource(next), listId, oldIt.taskId);
      });
      if (res === null) out.taskId = Tasks.Tasks.insert(OutputsFmt.taskResource(next), listId).id; // user deleted it: recreate
    }
    var want = OutputsFmt.wantsEvent(next);
    if (want && oldIt.eventId) {
      var r = Outputs.safe_(function () { return Calendar.Events.patch(OutputsFmt.eventResource(next), 'primary', oldIt.eventId); });
      if (r === null) out.eventId = Calendar.Events.insert(OutputsFmt.eventResource(next), 'primary').id;
    } else if (want && !oldIt.eventId) {
      out.eventId = Calendar.Events.insert(OutputsFmt.eventResource(next), 'primary').id;
    } else if (!want && oldIt.eventId) {
      Outputs.safe_(function () { return Calendar.Events.remove('primary', oldIt.eventId); });
      out.eventId = '';
    }
    return out;
  },

  dismissItem: function (itemId) {
    return Outputs.withLock_(function () {
      var it = Outputs.find_(itemId);
      var before = Outputs.snapshot_(it);
      if (it.taskId) Outputs.safe_(function () { return Tasks.Tasks.remove(Outputs.taskListId_(), it.taskId); });
      if (it.eventId) Outputs.safe_(function () { return Calendar.Events.remove('primary', it.eventId); });
      Db.update('Items', 'itemId', itemId, { status: 'dismissed', taskId: '', eventId: '', updatedAt: new Date().toISOString() });
      var after = Outputs.find_(itemId);
      Outputs.feedback_(itemId, 'dismiss', before, Outputs.snapshot_(after));
      return after;
    });
  },

  markDone: function (itemId) {
    return Outputs.withLock_(function () {
      var it = Outputs.find_(itemId);
      var before = Outputs.snapshot_(it);
      var now = new Date().toISOString();
      if (it.taskId) Outputs.safe_(function () { return Tasks.Tasks.patch({ status: 'completed' }, Outputs.taskListId_(), it.taskId); });
      Db.update('Items', 'itemId', itemId, { status: 'done', completedAt: now, updatedAt: now });
      var after = Outputs.find_(itemId);
      Outputs.feedback_(itemId, 'done', before, Outputs.snapshot_(after));
      return after;
    });
  },

  // ---------- sync + auto-add ----------
  /** Hourly: tasks completed in Google Tasks mark their items done (feeds the on-time metric). */
  syncStatus: function () {
    var accepted = Db.read('Items').filter(function (r) { return r.status === 'accepted' && r.taskId; });
    if (!accepted.length) return { checked: 0, done: 0, missing: 0 };
    var listId = Outputs.taskListId_();
    var byId = {};
    var pageToken = null;
    do {
      var res = Tasks.Tasks.list(listId, { showCompleted: true, showHidden: true, maxResults: 100, pageToken: pageToken });
      (res.items || []).forEach(function (t) { byId[t.id] = t; });
      pageToken = res.nextPageToken;
    } while (pageToken);

    var stats = { checked: accepted.length, done: 0, missing: 0 };
    accepted.forEach(function (it) {
      var t = byId[it.taskId];
      if (!t) { stats.missing++; return; }
      if (t.status === 'completed') {
        var at = t.completed || new Date().toISOString();
        Db.update('Items', 'itemId', it.itemId, { status: 'done', completedAt: at, updatedAt: new Date().toISOString() });
        Outputs.feedback_(it.itemId, 'done', { status: 'accepted' }, { status: 'done', source: 'tasks' });
        stats.done++;
      }
    });
    Logger.log(JSON.stringify(stats));
    return stats;
  },

  /** Off by default. Setting autoAddEnabled=true accepts suggested items at or above autoAddThreshold. */
  autoAdd: function () {
    if (String(Db.getSetting('autoAddEnabled', 'false')).toLowerCase() !== 'true') return 0;
    var thr = Number(Db.getSetting('autoAddThreshold', 0.9));
    var n = 0;
    Db.read('Items').filter(function (r) { return r.status === 'suggested' && r.confidence >= thr && !r.needsDate; })
      .forEach(function (r) { Outputs.acceptItem(r.itemId); n++; });
    return n;
  }
};

// ---------- editor smoke tests ----------
function acceptFirstSuggested() {
  var it = Db.read('Items').filter(function (r) { return r.status === 'suggested'; })[0];
  if (!it) { Logger.log('No suggested items.'); return; }
  var res = Outputs.acceptItem(it.itemId);
  Logger.log('Accepted: ' + res.what + ' | task ' + res.taskId + ' | event ' + (res.eventId || '-'));
}

function acceptAllSuggested() {
  Db.read('Items').filter(function (r) { return r.status === 'suggested'; }).forEach(function (r) { Outputs.acceptItem(r.itemId); });
  Logger.log('Done. Check Google Tasks list "' + TASKLIST_TITLE + '".');
}

function dismissFirstAccepted() {
  var it = Db.read('Items').filter(function (r) { return r.status === 'accepted'; })[0];
  if (!it) { Logger.log('No accepted items.'); return; }
  Outputs.dismissItem(it.itemId);
  Logger.log('Dismissed: ' + it.what);
}

function syncTaskStatus() { return Outputs.syncStatus(); }

/** Diagnostic: finds which part of a task body the Tasks API rejects. Creates and deletes test tasks. */
function debugTaskInsert() {
  var listId = Outputs.taskListId_();
  var it = Db.read('Items')[0];
  if (!it) { Logger.log('No items.'); return; }
  var tries = {
    titleOnly: { title: 'PK test' },
    withNotes: { title: 'PK test', notes: OutputsFmt.taskNotes(it) },
    withDue: { title: 'PK test', due: '2026-11-20T00:00:00.000Z' },
    full: OutputsFmt.taskResource(it)
  };
  Object.keys(tries).forEach(function (k) {
    try {
      var t = Tasks.Tasks.insert(tries[k], listId);
      Tasks.Tasks.remove(listId, t.id);
      Logger.log(k + ': OK');
    } catch (e) {
      Logger.log(k + ': FAIL ' + e.message + ' | ' + JSON.stringify(tries[k]).slice(0, 300));
    }
  });
}
