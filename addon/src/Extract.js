/** Pipeline: fetch -> clean -> Gemini -> validate -> dedup -> store. */
var Extract = {
  /** Pure-ish step shared by scan and eval: message -> {ctx, cleaned, rawItems, items, dropped}. */
  run: function (msg, tz, userEmail) {
    var sentIso = Fetch.sentIso(msg.internalDate, tz);
    var cleaned = Clean.clean(msg.body, { maxChars: CONFIG.MAX_CLEAN_CHARS });
    var out = { sentIso: sentIso, cleaned: cleaned, rawItems: [], items: [], dropped: [] };
    if (/^\[Promise Keeper\]/.test(msg.subject)) return out; // our own digest: never scan it
    if (cleaned.length < CONFIG.MIN_BODY_CHARS) return out;
    var ctx = {
      userEmail: userEmail, direction: msg.direction, timezone: tz, sentIso: sentIso,
      from: msg.from, to: msg.to, cc: msg.cc, subject: msg.subject, body: cleaned
    };
    out.rawItems = Gemini.extract(ctx);
    var v = Validate.validateItems(out.rawItems, { cleanedText: cleaned, direction: msg.direction, sentDate: Dates.localDateOf(sentIso) });
    out.items = v.items;
    out.dropped = v.dropped;
    return out;
  },

  /** Scan a Gmail query, process up to `limit` unprocessed messages within the time budget. */
  scan: function (query, limit, budgetMs) {
    var started = Date.now();
    var budget = budgetMs || CONFIG.RUN_BUDGET_MS; // sidebar buttons pass a short budget (they must return in ~30 s)
    var tz = getTimezone_();
    var userEmail = Session.getEffectiveUser().getEmail();

    var processedRows = Db.read('Processed');
    var done = {}, known = {};
    var procMs = {};
    processedRows.forEach(function (r) { known[r.msgId] = true; if (!r.error) done[r.msgId] = true; procMs[r.msgId] = Number(r.internalDate) || 0; });

    var refs = Fetch.listIds(query, limit, done);
    var items = Db.read('Items');
    var stats = { listed: refs.length, processed: 0, newItems: 0, dupes: 0, dropped: 0, rawItems: 0, shortBody: 0, resolved: 0, errors: 0, timedOut: false };

    for (var i = 0; i < refs.length; i++) {
      if (Date.now() - started > budget) { stats.timedOut = true; break; }
      var ref = refs[i];
      var row = { msgId: ref.id, threadId: ref.threadId, direction: '', internalDate: '', processedAt: new Date().toISOString(), itemCount: 0, promptVersion: CONFIG.PROMPT_VERSION, error: '' };
      try {
        var msg = Fetch.getMessage(ref.id);
        if (msg) {
          row.direction = msg.direction;
          row.internalDate = msg.internalDate;
          var r = Extract.run(msg, tz, userEmail);
          stats.dropped += r.dropped.length;
          stats.rawItems += r.rawItems.length;
          if (r.cleaned.length < CONFIG.MIN_BODY_CHARS) stats.shortBody++;
          r.items.forEach(function (it) {
            if (Extract.store_(it, msg, items, stats)) row.itemCount++;
          });
          procMs[msg.msgId] = msg.internalDate;
          stats.resolved += Extract.checkResolved_(msg, items, procMs);
        }
        stats.processed++;
      } catch (e) {
        row.error = String(e.message || e).slice(0, 300);
        stats.errors++;
      }
      if (known[ref.id]) Db.update('Processed', 'msgId', ref.id, row);
      else Db.append('Processed', row);
    }
    Db.logEvent('scan', stats);
    Logger.log(JSON.stringify(stats));
    return stats;
  },

  /** Insert a new item or merge into a duplicate. Returns true when a new row was added. */
  store_: function (it, msg, items, stats) {
    var cand = {
      threadId: msg.threadId, type: it.type, what: it.what, due: it.due || '', dueText: it.dueText, needsDate: it.needsDate,
      fingerprint: Dedup.fingerprint(msg.threadId, it.type, it.what)
    };
    var dup = Dedup.findDuplicate(cand, items, CONFIG.DEDUP_JACCARD);
    if (dup) {
      var res = Dedup.resolveDuplicate(dup, cand);
      if (res.action === 'update') {
        Db.update('Items', 'itemId', dup.itemId, Object.assign({ updatedAt: new Date().toISOString() }, res.patch));
        Object.assign(dup, res.patch);
      }
      stats.dupes++;
      return false;
    }
    var now = new Date().toISOString();
    var row = {
      itemId: Utilities.getUuid(), msgId: msg.msgId, threadId: msg.threadId, direction: msg.direction,
      type: it.type, what: it.what, counterpartyName: it.counterpartyName, counterpartyEmail: it.counterpartyEmail,
      due: it.due || '', dueText: it.dueText, needsDate: it.needsDate, confidence: it.confidence, evidence: it.evidence,
      status: 'suggested', taskId: '', eventId: '', fingerprint: cand.fingerprint, promptVersion: CONFIG.PROMPT_VERSION,
      createdAt: now, updatedAt: now, completedAt: ''
    };
    Db.append('Items', row);
    items.push(row);
    stats.newItems++;
    return true;
  }
};

/** Hourly trigger entry + manual run. */
function runScan() { return Extract.scan(CONFIG.SCAN_QUERY, CONFIG.MAX_MESSAGES_PER_RUN); }

/** First-run backfill. Re-run until stats.timedOut is false; processed ids are skipped. */
function backfill(limit, days) {
  limit = limit || 200;
  days = days || 30;
  return Extract.scan(CONFIG.BACKFILL_QUERY.replace('{DAYS}', String(days)), limit);
}

/** Small smoke test: 20 messages, last 7 days. */
function backfillSmall() { return backfill(20, 7); }

/**
 * Diagnostic: shows what the pipeline sees for the newest `n` messages. Stores nothing.
 * Logs: direction, subject, raw/cleaned length, model output, validation drops.
 */
function debugScan(n) {
  n = n || 5;
  var tz = getTimezone_();
  var userEmail = Session.getEffectiveUser().getEmail();
  Fetch.listIds(CONFIG.BACKFILL_QUERY.replace('{DAYS}', '30'), n, null).forEach(function (ref) {
    var msg = Fetch.getMessage(ref.id);
    if (!msg) return;
    var r = Extract.run(msg, tz, userEmail);
    Logger.log(JSON.stringify({
      dir: msg.direction, subject: msg.subject.slice(0, 60), bodyLen: msg.body.length, cleanedLen: r.cleaned.length,
      cleanedStart: r.cleaned.slice(0, 120), raw: r.rawItems, kept: r.items.length,
      dropped: r.dropped.map(function (d) { return d.reason; })
    }));
  });
}

/** Diagnostic: MIME structure + decode result of the newest 3 messages. */
function debugPayload() {
  Fetch.listIds(CONFIG.BACKFILL_QUERY.replace('{DAYS}', '30'), 3, null).forEach(function (ref) {
    var m = Gmail.Users.Messages.get('me', ref.id, { format: 'full' });
    Fetch.lastDecodeError = '';
    var msg = Fetch.getMessage(ref.id);
    Logger.log(JSON.stringify({ structure: Fetch.describe_(m.payload), bodyLen: msg ? msg.body.length : -1, decodeError: Fetch.lastDecodeError }));
  });
}

/** Clears the Processed tab (and Items) so messages are re-extracted. Dev use only. */
function resetExtraction() {
  ['Processed', 'Items'].forEach(function (name) {
    var sh = Db.sheet(name);
    if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  });
  Logger.log('Processed and Items cleared.');
}

/** Wider smoke test: 60 messages from the last 90 days (re-run until timedOut is false). */
function backfillWide() { return backfill(60, 90); }

/**
 * Sidebar "Scan this thread": extract one message that was already fetched with the add-on token.
 * Marks it processed and stores items (dedup applies). Returns {newItems, dupes, errors}.
 */
Extract.scanFetched = function (msg) {
  var tz = getTimezone_();
  var userEmail = Session.getEffectiveUser().getEmail();
  var items = Db.read('Items');
  var stats = { newItems: 0, dupes: 0, errors: 0 };
  var procMs = {};
  var known = false;
  Db.read('Processed').forEach(function (r) { procMs[r.msgId] = Number(r.internalDate) || 0; if (r.msgId === msg.msgId) known = true; });
  var row = { msgId: msg.msgId, threadId: msg.threadId, direction: msg.direction, internalDate: msg.internalDate, processedAt: new Date().toISOString(), itemCount: 0, promptVersion: CONFIG.PROMPT_VERSION, error: '' };
  try {
    Extract.run(msg, tz, userEmail).items.forEach(function (it) {
      if (Extract.store_(it, msg, items, stats)) row.itemCount++;
    });
    procMs[msg.msgId] = msg.internalDate;
    Extract.checkResolved_(msg, items, procMs);
  } catch (e) {
    row.error = String(e.message || e).slice(0, 300);
    stats.errors++;
  }
  if (known) Db.update('Processed', 'msgId', msg.msgId, row); else Db.append('Processed', row);
  Db.logEvent('scan', { onDemand: true, msgId: msg.msgId, newItems: stats.newItems, errors: stats.errors });
  return stats;
};

/**
 * A new inbox message from the counterparty in a waiting_on thread marks that item possibly_resolved,
 * so the sidebar can ask "Did they deliver?". Skips the message that created the item.
 */
Extract.checkResolved_ = function (msg, items, procMs) {
  if (msg.direction !== 'inbox') return 0;
  var m = /<([^>]+)>/.exec(String(msg.from || ''));
  var from = (m ? m[1] : String(msg.from || '')).trim().toLowerCase();
  if (!from) return 0;
  var n = 0;
  items.forEach(function (it) {
    if (it.type !== 'waiting_on' || it.status !== 'accepted' || it.threadId !== msg.threadId || it.msgId === msg.msgId) return;
    if (!it.counterpartyEmail || it.counterpartyEmail.toLowerCase() !== from) return;
    var srcMs = procMs[it.msgId] || 0;
    if (srcMs > 0 && msg.internalDate > srcMs) {
      Db.update('Items', 'itemId', it.itemId, { status: 'possibly_resolved', updatedAt: new Date().toISOString() });
      it.status = 'possibly_resolved';
      n++;
    }
  });
  return n;
};
