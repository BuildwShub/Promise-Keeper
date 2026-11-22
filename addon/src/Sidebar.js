/**
 * Phase 4: Gmail sidebar (CardService), per plan.md.
 *  - Contextual trigger: items for the open thread, with Accept / Edit / Dismiss.
 *  - Edit card: what, type, due date, counterparty.
 *  - Homepage: counts, Scan now, settings, Install triggers (first run).
 * Every item action logs a Feedback row (in Outputs) and returns an ActionResponse with Navigation.updateCard.
 */
var TYPE_LABELS_ = { my_promise: 'MY PROMISE', request_to_me: 'REQUEST TO ME', deadline: 'DEADLINE', waiting_on: 'WAITING ON' };
var TYPE_OPTIONS_ = [['my_promise', 'My promise'], ['request_to_me', 'Request to me'], ['deadline', 'Deadline'], ['waiting_on', 'Waiting on']];
var TIMEZONES_ = [
  'UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Dhaka', 'Asia/Kathmandu', 'Asia/Colombo', 'Asia/Singapore',
  'Asia/Kuala_Lumpur', 'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
  'Asia/Manila', 'Asia/Riyadh', 'Asia/Tehran', 'Asia/Jerusalem', 'Europe/London', 'Europe/Dublin', 'Europe/Lisbon',
  'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Stockholm', 'Europe/Athens',
  'Europe/Istanbul', 'Europe/Moscow', 'Africa/Cairo', 'Africa/Lagos', 'Africa/Nairobi', 'Africa/Johannesburg',
  'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'America/Bogota', 'America/Mexico_City', 'America/Chicago',
  'America/New_York', 'America/Toronto', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage',
  'Pacific/Honolulu', 'Australia/Perth', 'Australia/Adelaide', 'Australia/Sydney', 'Pacific/Auckland'
];
var SCAN_NOW_BATCH_ = 5;     // upper bound per press
var CARD_BUDGET_MS_ = 12000; // stop starting new messages after 12 s: a card action must return in about 30 s

// ---------- entry points ----------
function onHomepage(e) {
  return homeEntry_();
}

function onGmailMessageOpen(e) {
  try {
    var threadId = Fetch.apiId_(e.gmail.threadId);
    var msgId = Fetch.apiId_(e.gmail.messageId);
    return threadCard_(threadId, msgId);
  } catch (err) {
    return messageCard_('Promise Keeper', 'Could not load this thread: ' + String(err.message || err).slice(0, 200));
  }
}

// ---------- helpers ----------
function escHtml_(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function messageCard_(title, text) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(title))
    .addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText(text)))
    .build();
}

function button_(label, fn, params, filled) {
  var b = CardService.newTextButton().setText(label).setOnClickAction(CardService.newAction().setFunctionName(fn).setParameters(params || {}));
  if (filled) b.setTextButtonStyle(CardService.TextButtonStyle.FILLED);
  return b;
}

function tasksLink_() {
  return CardService.newTextButton().setText('Open Tasks').setOpenLink(CardService.newOpenLink().setUrl('https://tasks.google.com/tasks'));
}

// ---------- thread card ----------
function itemSection_(it, threadId, msgId) {
  var section = CardService.newCardSection();
  var suggestion = it.confidence < CONFIG.SHOW_CONFIDENCE ? ' · Suggestion' : '';
  var due = it.due ? 'Due ' + it.due : '⚠ Needs date' + (it.dueText ? ' (' + it.dueText + ')' : '');
  section.addWidget(CardService.newDecoratedText()
    .setTopLabel((TYPE_LABELS_[it.type] || it.type) + suggestion)
    .setText('<b>' + escHtml_(it.what) + '</b>')
    .setBottomLabel((it.counterpartyName ? it.counterpartyName + ' · ' : '') + due)
    .setWrapText(true));
  if (it.evidence) section.addWidget(CardService.newTextParagraph().setText('<i>“' + escHtml_(it.evidence) + '”</i>'));

  var p = { itemId: it.itemId, threadId: threadId, msgId: msgId };
  var set = CardService.newButtonSet();
  if (it.status === 'possibly_resolved') {
    section.addWidget(CardService.newTextParagraph().setText('They replied in this thread. <b>Did they deliver?</b>'));
    set.addButton(button_('Yes', 'actResolvedYes', p, true));
    set.addButton(button_('No', 'actResolvedNo', p));
    set.addButton(button_('Draft nudge', 'actNudge', p));
    section.addWidget(set);
  } else if (it.status === 'accepted') {
    section.addWidget(CardService.newTextParagraph().setText('In Tasks ✓'));
    set.addButton(button_('Mark done', 'actDone', p, true));
    if (it.type === 'waiting_on') set.addButton(button_('Draft nudge', 'actNudge', p));
    set.addButton(button_('Edit', 'actEditOpen', p));
    set.addButton(button_('Dismiss', 'actDismiss', p));
    section.addWidget(set);
  } else if (it.status === 'done') {
    section.addWidget(CardService.newTextParagraph().setText('Done ✓'));
  } else {
    set.addButton(button_('Accept', 'actAccept', p, true));
    set.addButton(button_('Edit', 'actEditOpen', p));
    set.addButton(button_('Dismiss', 'actDismiss', p));
    section.addWidget(set);
  }
  return section;
}

function threadCard_(threadId, msgId) {
  var items = Db.read('Items').filter(function (r) { return r.threadId === threadId && r.status !== 'dismissed'; });
  var card = CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle('Promise Keeper')
    .setSubtitle(items.length ? items.length + ' item(s) in this thread' : 'No items in this thread'));
  items.forEach(function (it) { card.addSection(itemSection_(it, threadId, msgId)); });

  var s = CardService.newCardSection();
  var scanned = Db.read('Processed').some(function (r) { return r.msgId === msgId && !r.error; });
  if (!scanned) {
    s.addWidget(CardService.newTextParagraph().setText('This message has not been scanned yet.'));
    s.addWidget(CardService.newButtonSet().addButton(button_('Scan this thread', 'actScanThread', { threadId: threadId, msgId: msgId }, true)));
  } else if (!items.length) {
    s.addWidget(CardService.newTextParagraph().setText('Nothing to track in this thread.'));
  }
  s.addWidget(tasksLink_());
  card.addSection(s);
  try { Db.logEvent('sidebar_open', { threadId: threadId, items: items.length }); } catch (e) { /* metrics must never break the UI */ }
  return card.build();
}

// ---------- homepage ----------
function counts_() {
  var today = Utilities.formatDate(new Date(), getTimezone_(), 'yyyy-MM-dd');
  var c = { overdue: 0, today: 0, week: 0, waiting: 0 };
  Db.read('Items').forEach(function (r) {
    if (r.status !== 'accepted' && r.status !== 'possibly_resolved') return;
    if (r.type === 'waiting_on') { c.waiting++; return; }
    var b = Dates.bucket(r.due, today);
    if (b === 'overdue' && (r.type === 'my_promise' || r.type === 'request_to_me')) c.overdue++;
    else if (b === 'today') c.today++;
    else if (b === 'week') c.week++;
  });
  return c;
}

function triggersInstalled_() {
  return Triggers.installed();
}

function homeCard_() {
  var c = counts_();
  var card = CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle('Promise Keeper'));
  var s = CardService.newCardSection().setHeader('At a glance');
  [['Overdue', c.overdue], ['Due today', c.today], ['Due this week', c.week], ['Waiting on others', c.waiting]].forEach(function (x) {
    s.addWidget(CardService.newDecoratedText().setTopLabel(x[0]).setText('<b>' + x[1] + '</b>'));
  });
  s.addWidget(CardService.newButtonSet().addButton(button_('Scan now', 'actScanNow', {}, true)));
  card.addSection(s);

  var set = CardService.newCardSection().setHeader('Settings').setCollapsible(true).setNumUncollapsibleWidgets(0);
  var curTz = getTimezone_();
  var tzSel = CardService.newSelectionInput().setType(CardService.SelectionInputType.DROPDOWN).setFieldName('timezone').setTitle('Timezone');
  var tzList = TIMEZONES_.indexOf(curTz) === -1 ? [curTz].concat(TIMEZONES_) : TIMEZONES_;
  tzList.forEach(function (z) { tzSel.addItem(z.replace(/_/g, ' '), z, z === curTz); });
  set.addWidget(tzSel);
  var hours = CardService.newSelectionInput().setType(CardService.SelectionInputType.DROPDOWN).setFieldName('digestHour').setTitle('Digest hour');
  var cur = Number(Db.getSetting('digestHour', 8));
  for (var h = 0; h < 24; h++) hours.addItem((h < 10 ? '0' : '') + h + ':00', String(h), h === cur);
  set.addWidget(hours);
  var auto = String(Db.getSetting('autoAddEnabled', 'false')).toLowerCase() === 'true';
  set.addWidget(CardService.newDecoratedText().setText('Auto-add high-confidence items')
    .setBottomLabel('Off by default. Threshold ' + Db.getSetting('autoAddThreshold', 0.9))
    .setSwitchControl(CardService.newSwitch().setFieldName('autoAdd').setValue('true').setSelected(auto)));
  var share = String(Db.getSetting('shareMetrics', 'false')).toLowerCase() === 'true';
  set.addWidget(CardService.newDecoratedText().setText('Share anonymous usage numbers').setBottomLabel('Off by default. Counts and rates only: no email content, no address.')
    .setSwitchControl(CardService.newSwitch().setFieldName('shareMetrics').setValue('true').setSelected(share)));
  set.addWidget(CardService.newButtonSet().addButton(button_('Save settings', 'actSaveSettings', {}, true)));
  card.addSection(set);

  var foot = CardService.newCardSection();
  if (!triggersInstalled_()) {
    foot.addWidget(CardService.newTextParagraph().setText('Automatic scanning and the morning digest are not running yet.'));
    foot.addWidget(CardService.newButtonSet().addButton(button_('Install triggers', 'actInstallTriggers', {}, true)));
  }
  foot.addWidget(tasksLink_());
  card.addSection(foot);
  return card.build();
}

// ---------- edit card ----------
function editCard_(it, threadId, msgId) {
  var card = CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle('Edit item'));
  var s = CardService.newCardSection();
  s.addWidget(CardService.newTextInput().setFieldName('what').setTitle('What').setValue(it.what));
  var sel = CardService.newSelectionInput().setType(CardService.SelectionInputType.DROPDOWN).setFieldName('type').setTitle('Type');
  TYPE_OPTIONS_.forEach(function (o) { sel.addItem(o[1], o[0], o[0] === it.type); });
  s.addWidget(sel);
  var dp = CardService.newDatePicker().setFieldName('due').setTitle('Due date');
  if (it.due) {
    var p = it.due.split('-');
    dp.setValueInMsSinceEpoch(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12).getTime());
  }
  s.addWidget(dp);
  s.addWidget(CardService.newTextInput().setFieldName('counterparty').setTitle('Counterparty').setValue(it.counterpartyName || ''));
  s.addWidget(CardService.newButtonSet().addButton(button_('Save', 'actEditSave', { itemId: it.itemId, threadId: threadId, msgId: msgId }, true)));
  card.addSection(s);
  return card.build();
}

// ---------- actions (all return ActionResponse + Navigation.updateCard) ----------
function notify_(r, message) {
  if (message) r.setNotification(CardService.newNotification().setText(message));
  return r.build();
}

function refreshThread_(p, message, popFirst) {
  var nav = CardService.newNavigation();
  if (popFirst) nav.popCard();
  nav.updateCard(threadCard_(p.threadId, p.msgId));
  return notify_(CardService.newActionResponseBuilder().setNavigation(nav), message);
}

function refreshHome_(message) {
  return notify_(CardService.newActionResponseBuilder().setNavigation(CardService.newNavigation().updateCard(homeEntry_())), message);
}

function guard_(fn) {
  try { return fn(); } catch (err) {
    return notify_(CardService.newActionResponseBuilder(), 'Error: ' + String(err.message || err).slice(0, 150));
  }
}

function actAccept(e) { return guard_(function () { Outputs.acceptItem(e.parameters.itemId); return refreshThread_(e.parameters, 'Added to Google Tasks'); }); }
function actDismiss(e) { return guard_(function () { Outputs.dismissItem(e.parameters.itemId); return refreshThread_(e.parameters, 'Dismissed'); }); }
function actDone(e) { return guard_(function () { Outputs.markDone(e.parameters.itemId); return refreshThread_(e.parameters, 'Marked done'); }); }

function actEditOpen(e) {
  return guard_(function () {
    var it = Outputs.find_(e.parameters.itemId);
    return CardService.newActionResponseBuilder().setNavigation(CardService.newNavigation().pushCard(editCard_(it, e.parameters.threadId, e.parameters.msgId))).build();
  });
}

function formValue_(e, name) {
  var fi = e.formInput || {};
  if (fi[name] !== undefined) return fi[name];
  var fis = e.formInputs && e.formInputs[name];
  return fis && fis.length ? fis[0] : undefined;
}

function dueFromForm_(e) {
  var f = e.commonEventObject && e.commonEventObject.formInputs && e.commonEventObject.formInputs.due;
  var ms = f && f.dateInput && f.dateInput.msSinceEpoch;
  return ms ? Utilities.formatDate(new Date(Number(ms)), getTimezone_(), 'yyyy-MM-dd') : undefined;
}

function actEditSave(e) {
  return guard_(function () {
    var patch = {};
    var what = formValue_(e, 'what'); if (what !== undefined && String(what).trim()) patch.what = what;
    var type = formValue_(e, 'type'); if (type) patch.type = type;
    var cp = formValue_(e, 'counterparty'); if (cp !== undefined) patch.counterpartyName = cp;
    var due = dueFromForm_(e); if (due) patch.due = due;
    Outputs.editItem(e.parameters.itemId, patch); // writes the Feedback row (before/after), updates item, task, event
    return refreshThread_(e.parameters, 'Saved', true);
  });
}

/** "Scan this thread": extraction on demand using the current message access token. */
function actScanThread(e) {
  return guard_(function () {
    var token = e.gmail && e.gmail.accessToken;
    if (!token) throw new Error('No access token. Reopen the email and try again.');
    var msg = Fetch.getMessageWithToken(e.gmail.messageId, e.gmail.threadId, token);
    var st = Extract.scanFetched(msg);
    return refreshThread_(e.parameters, st.errors ? 'Scan hit an error, try again' : (st.newItems ? 'Found ' + st.newItems + ' new item(s)' : 'No new items found'));
  });
}

function actScanNow(e) {
  return guard_(function () {
    var st = Extract.scan(CONFIG.SCAN_QUERY, SCAN_NOW_BATCH_, CARD_BUDGET_MS_);
    return refreshHome_('Scanned ' + st.processed + ' message(s), ' + st.newItems + ' new item(s)' + (st.timedOut || st.listed >= SCAN_NOW_BATCH_ ? '. Press again for more.' : ''));
  });
}

function actSaveSettings(e) {
  return guard_(function () {
    var tz = String(formValue_(e, 'timezone') || '').trim();
    if (tz) {
      try { Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'); } catch (err) { throw new Error('Unknown timezone: ' + tz); }
      Db.setSetting('timezone', tz);
    }
    var hour = formValue_(e, 'digestHour');
    if (hour !== undefined) Db.setSetting('digestHour', String(hour));
    Db.setSetting('autoAddEnabled', formValue_(e, 'autoAdd') === 'true' ? 'true' : 'false');
    Db.setSetting('shareMetrics', formValue_(e, 'shareMetrics') === 'true' ? 'true' : 'false');
    return refreshHome_('Settings saved');
  });
}

// ---------- Phase 5 actions ----------
function actNudge(e) {
  return guard_(function () {
    var r = Nudge.draftFor(e.parameters.itemId);
    return refreshThread_(e.parameters, 'Draft created — open Drafts to review' + (r.usedFallback ? ' (template used)' : ''));
  });
}

function actInstallTriggers(e) {
  return guard_(function () {
    Triggers.install();
    return refreshHome_('Hourly scan and daily digest installed');
  });
}

function actResolvedYes(e) { return guard_(function () { Outputs.markDone(e.parameters.itemId); return refreshThread_(e.parameters, 'Marked done'); }); }

function actResolvedNo(e) {
  return guard_(function () {
    var it = Outputs.find_(e.parameters.itemId);
    Db.update('Items', 'itemId', it.itemId, { status: 'accepted', updatedAt: new Date().toISOString() });
    Outputs.feedback_(it.itemId, 'edit', { status: 'possibly_resolved' }, { status: 'accepted', answer: 'not delivered' });
    return refreshThread_(e.parameters, 'Still waiting');
  });
}

// ---------- Phase 6: onboarding (privacy notice -> backfill last 7 days -> install trigger) ----------
var ONBOARD_BATCH_ = 5; // card actions must return quickly; press again for more

var PRIVACY_SENT_ = 'Sent to Gemini (Google\'s AI), one email at a time: the cleaned message text (quoted replies, signatures and footers removed, at most about 3,000 characters), the sender and recipient names and addresses, the subject and the send date. Never attachments. The developer\'s paid Gemini tier is used, where inputs are not used to improve Google\'s products.';
var PRIVACY_STORED_ = 'Stored in a Google Sheet named "Promise Keeper DB" in YOUR Drive, visible only to you: the extracted items (what, who, due date, confidence) and the one sentence that triggered each. Full email bodies are never stored. Tasks and Calendar entries are created only when you press Accept.';

function onboardStep_() {
  return String(Db.getSetting('onboarded', ''));
}

function homeEntry_() {
  return onboardStep_() === 'done' ? homeCard_() : onboardCard_();
}

function onboardCard_() {
  var step = onboardStep_();
  var card = CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle('Welcome to Promise Keeper'));
  var s = CardService.newCardSection();
  if (step === '') {
    s.setHeader('Step 1 of 3: Privacy');
    s.addWidget(CardService.newTextParagraph().setText('<b>What is sent</b><br>' + escHtml_(PRIVACY_SENT_)));
    s.addWidget(CardService.newTextParagraph().setText('<b>What is stored</b><br>' + escHtml_(PRIVACY_STORED_)));
    s.addWidget(CardService.newDecoratedText().setText('Share anonymous usage numbers').setBottomLabel('Optional. Counts and rates only: no email content, no address.')
      .setSwitchControl(CardService.newSwitch().setFieldName('shareMetrics').setValue('true').setSelected(false)));
    s.addWidget(CardService.newButtonSet().addButton(button_('I understand, continue', 'actOnboardAgree', {}, true)));
  } else if (step === 'privacy_ok') {
    var left = Fetch.listIds(CONFIG.BACKFILL_QUERY.replace('{DAYS}', '7'), 200, Sidebar_doneIds_()).length;
    s.setHeader('Step 2 of 3: Scan the last 7 days');
    s.addWidget(CardService.newTextParagraph().setText(left ? left + ' message(s) left to scan. Each press scans up to ' + ONBOARD_BATCH_ + ' and takes about 30 seconds.' : 'Nothing left to scan.'));
    var set = CardService.newButtonSet();
    if (left) set.addButton(button_('Scan ' + Math.min(left, ONBOARD_BATCH_) + ' more', 'actOnboardScan', {}, true));
    set.addButton(button_(left ? 'Skip' : 'Continue', 'actOnboardNext', {}, !left));
    s.addWidget(set);
  } else {
    s.setHeader('Step 3 of 3: Turn on automatic scanning');
    s.addWidget(CardService.newTextParagraph().setText('Installs one hourly job. It scans new mail, syncs completed tasks and sends your morning digest. You can change the digest hour later in Settings.'));
    s.addWidget(CardService.newButtonSet().addButton(button_('Install and finish', 'actOnboardFinish', {}, true)));
  }
  card.addSection(s);
  return card.build();
}

function Sidebar_doneIds_() {
  var done = {};
  Db.read('Processed').forEach(function (r) { if (!r.error) done[r.msgId] = true; });
  return done;
}

function actOnboardAgree(e) {
  return guard_(function () {
    Db.setSetting('shareMetrics', formValue_(e, 'shareMetrics') === 'true' ? 'true' : 'false');
    Db.setSetting('onboarded', 'privacy_ok');
    return refreshHome_('Thanks');
  });
}

function actOnboardScan(e) {
  return guard_(function () {
    var st = Extract.scan(CONFIG.BACKFILL_QUERY.replace('{DAYS}', '7'), ONBOARD_BATCH_, CARD_BUDGET_MS_);
    return refreshHome_('Scanned ' + st.processed + ' message(s), ' + st.newItems + ' new item(s)');
  });
}

function actOnboardNext(e) {
  return guard_(function () { Db.setSetting('onboarded', 'backfill_ok'); return refreshHome_(''); });
}

function actOnboardFinish(e) {
  return guard_(function () {
    Triggers.install();
    Db.setSetting('onboarded', 'done');
    return refreshHome_('All set. Open an email to see your items.');
  });
}

/** Run once from the editor on the developer's own account to skip the onboarding card. */
function markOnboarded() { Db.setSetting('onboarded', 'done'); Logger.log('Onboarding marked done.'); }

/** Run from the editor to see the onboarding card again. */
function resetOnboarding() { Db.setSetting('onboarded', ''); Logger.log('Onboarding reset.'); }
