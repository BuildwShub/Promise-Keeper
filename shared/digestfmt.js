/* Pure morning-digest builder: groups items and renders HTML + text. */
var DigestFmt = (function () {
  function datesDep() { return typeof Dates !== 'undefined' ? Dates : require('./dates.js'); }

  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function threadLink(id) { return 'https://mail.google.com/mail/u/0/#all/' + id; }
  function byDue(a, b) { return String(a.due || '9999').localeCompare(String(b.due || '9999')); }

  /**
   * items: Items rows. today: YYYY-MM-DD. opts: {trackBase} (web-app URL, optional).
   * Sections (plan.md Phase 5):
   *   Overdue promises: my_promise / request_to_me, accepted, past due.
   *   Due today / Due this week: other accepted items by due date.
   *   Waiting on others: waiting_on items, late ones flagged.
   * Returns null when every section is empty (no email), else {subject, html, text, counts}.
   */
  function buildDigest(items, today, opts) {
    opts = opts || {};
    var D = datesDep();
    var overdue = [], dueToday = [], week = [], waiting = [];
    items.forEach(function (it) {
      if (it.status !== 'accepted' && it.status !== 'possibly_resolved') return;
      if (it.type === 'waiting_on') {
        waiting.push({ it: it, late: !!it.due && D.bucket(it.due, today) === 'overdue' });
        return;
      }
      var b = D.bucket(it.due, today);
      if (b === 'overdue') { if (it.type === 'my_promise' || it.type === 'request_to_me') overdue.push({ it: it }); }
      else if (b === 'today') dueToday.push({ it: it });
      else if (b === 'week') week.push({ it: it });
    });
    [overdue, dueToday, week].forEach(function (l) { l.sort(function (a, b) { return byDue(a.it, b.it); }); });
    waiting.sort(function (a, b) { return (b.late ? 1 : 0) - (a.late ? 1 : 0) || byDue(a.it, b.it); });

    var counts = { overdue: overdue.length, today: dueToday.length, week: week.length, waiting: waiting.length };
    if (!counts.overdue && !counts.today && !counts.week && !counts.waiting) return null;

    var uidParam = opts.uid ? '&uid=' + encodeURIComponent(opts.uid) : ''; // anonymous tester id for retention
    function link(it) {
      var l = threadLink(it.threadId);
      return opts.trackBase ? opts.trackBase + '?e=click&i=' + encodeURIComponent(it.itemId) + uidParam + '&u=' + encodeURIComponent(l) : l;
    }
    function row(x) {
      var it = x.it;
      var meta = [];
      if (it.counterpartyName) meta.push(esc(it.counterpartyName));
      meta.push(it.due ? 'due ' + esc(it.due) : 'no date');
      if (x.late) meta.push('<b style="color:#c5221f">LATE</b>');
      return '<li style="margin:6px 0"><b>' + esc(it.what) + '</b> <span style="color:#5f6368">' + meta.join(' · ') + '</span> <a href="' + esc(link(it)) + '">open thread</a></li>';
    }
    function textRow(x) { return '- ' + x.it.what + (x.it.due ? ' (due ' + x.it.due + ')' : '') + (x.late ? ' LATE' : '') + ' ' + threadLink(x.it.threadId); }

    var sections = [['Overdue', overdue], ['Due today', dueToday], ['Due this week', week], ['Waiting on others', waiting]];
    var html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#202124"><h2 style="margin:0 0 8px">Promise Keeper</h2><div style="color:#5f6368">' + esc(today) + '</div>';
    var text = 'Promise Keeper ' + today + '\n';
    sections.forEach(function (s) {
      if (!s[1].length) return;
      html += '<h3 style="margin:16px 0 4px">' + s[0] + ' (' + s[1].length + ')</h3><ul style="padding-left:18px;margin:0">' + s[1].map(row).join('') + '</ul>';
      text += '\n' + s[0] + ' (' + s[1].length + ')\n' + s[1].map(textRow).join('\n') + '\n';
    });
    if (opts.trackBase) html += '<img src="' + esc(opts.trackBase + '?e=open&d=' + today + uidParam) + '" width="1" height="1" alt="">';
    html += '</div>';

    var parts = [];
    if (counts.overdue) parts.push(counts.overdue + ' overdue');
    if (counts.today) parts.push(counts.today + ' due today');
    if (!parts.length && counts.week) parts.push(counts.week + ' due this week');
    if (!parts.length) parts.push(counts.waiting + ' waiting on others');
    return { subject: '[Promise Keeper] ' + parts.join(', '), html: html, text: text, counts: counts };
  }

  return { buildDigest: buildDigest, esc: esc };
})();

if (typeof module !== 'undefined') module.exports = DigestFmt;
