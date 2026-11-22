/* Pure formatting for Tasks + Calendar payloads. No Apps Script globals. */
var OutputsFmt = (function () {
  function datesDep() { return typeof Dates !== 'undefined' ? Dates : require('./dates.js'); }

  var PREFIX = { my_promise: 'Promise', request_to_me: 'Request', deadline: 'Deadline', waiting_on: 'Waiting on' };

  // With the account email the link opens the right Gmail account even when it is not signed-in account 0 (the web app passes it).
  function threadLink(threadId, accountEmail) {
    if (accountEmail) return 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(accountEmail) + '#all/' + threadId;
    return 'https://mail.google.com/mail/u/0/#all/' + threadId;
  }

  function taskTitle(item) {
    var t = (PREFIX[item.type] || 'Item') + ': ' + item.what;
    if (item.type === 'waiting_on' && item.counterpartyName) t += ' (' + item.counterpartyName + ')';
    return t;
  }

  // Tasks notes are plain text (not clickable), so the link goes first for easy copying.
  function taskNotes(item) {
    var lines = ['Thread: ' + threadLink(item.threadId, item.accountEmail)];
    if (item.evidence) lines.push('"' + item.evidence + '"');
    if (item.counterpartyName) lines.push('With: ' + item.counterpartyName + (item.counterpartyEmail ? ' <' + item.counterpartyEmail + '>' : ''));
    return lines.join('\n\n');
  }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /** Calendar descriptions accept HTML, so the link is clickable there. */
  function eventDescription(item) {
    var parts = ['<a href="' + threadLink(item.threadId, item.accountEmail) + '">Open thread in Gmail</a>'];
    if (item.evidence) parts.push('"' + esc(item.evidence) + '"');
    if (item.counterpartyName) parts.push('With: ' + esc(item.counterpartyName) + (item.counterpartyEmail ? ' &lt;' + esc(item.counterpartyEmail) + '&gt;' : ''));
    return parts.join('<br><br>');
  }

  /** Tasks API takes RFC3339 but only the date part matters. */
  function taskDue(due) { return due ? due + 'T00:00:00.000Z' : null; }

  /** Insert/patch body. `due` is omitted when there is no date (a null due is rejected by the API). */
  function taskResource(item) {
    var r = { title: taskTitle(item), notes: taskNotes(item) };
    if (item.due) r.due = taskDue(item.due);
    return r;
  }

  function wantsEvent(item) { return item.type === 'deadline' && !!item.due; }

  /** All-day event: end date is exclusive, so it is due + 1 day. */
  function eventResource(item) {
    var D = datesDep();
    return {
      summary: taskTitle(item),
      description: eventDescription(item),
      start: { date: item.due },
      end: { date: D.addDays(item.due, 1) }
    };
  }

  return { eventDescription: eventDescription, threadLink: threadLink, taskTitle: taskTitle, taskNotes: taskNotes, taskDue: taskDue, taskResource: taskResource, wantsEvent: wantsEvent, eventResource: eventResource };
})();

if (typeof module !== 'undefined') module.exports = OutputsFmt;
