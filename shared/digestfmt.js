/* Pure morning-digest builder: groups items and renders HTML + text. */
var DigestFmt = (function () {
  function datesDep() { return typeof Dates !== 'undefined' ? Dates : require('./dates.js'); }

  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  // With the account email the link opens the right Gmail account even when it is not signed-in account 0 (the web app passes it).
  function threadLink(id, accountEmail) {
    return accountEmail ? 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(accountEmail) + '#all/' + id : 'https://mail.google.com/mail/u/0/#all/' + id;
  }
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
      var l = threadLink(it.threadId, opts.accountEmail);
      return opts.trackBase ? opts.trackBase + '?e=click&i=' + encodeURIComponent(it.itemId) + uidParam + '&u=' + encodeURIComponent(l) : l;
    }
    var COLORS = { Overdue: '#EA4335', 'Due today': '#F9AB00', 'Due this week': '#4285F4', 'Waiting on others': '#34A853' };
    function row(x, name) {
      var it = x.it, c = COLORS[name];
      var meta = [];
      if (it.counterpartyName) meta.push(esc(it.counterpartyName));
      meta.push(it.due ? 'due ' + esc(it.due) : 'no date');
      return '<tr><td style="padding:0 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dadce0;border-radius:12px;border-left:5px solid ' + c + '"><tr>' +
        '<td style="padding:12px 14px"><div style="font-size:15px;font-weight:600;color:#202124">' + esc(it.what) + (x.late ? ' <span style="background:#fce8e6;color:#c5221f;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px">LATE</span>' : '') + '</div>' +
        '<div style="font-size:13px;color:#5f6368;margin-top:2px">' + meta.join(' · ') + '</div></td>' +
        '<td align="right" style="padding:12px 14px;white-space:nowrap"><a href="' + esc(link(it)) + '" style="background:#e8f0fe;color:#1a73e8;text-decoration:none;font-size:13px;font-weight:600;padding:8px 14px;border-radius:16px">Open thread</a></td></tr></table></td></tr>';
    }
    function textRow(x) { return '- ' + x.it.what + (x.it.due ? ' (due ' + x.it.due + ')' : '') + (x.late ? ' LATE' : '') + ' ' + threadLink(x.it.threadId, opts.accountEmail); }

    var sections = [['Overdue', overdue], ['Due today', dueToday], ['Due this week', week], ['Waiting on others', waiting]];
    var tiles = [['Overdue', counts.overdue], ['Due today', counts.today], ['Due this week', counts.week], ['Waiting on others', counts.waiting]];
    var html = '<div style="background:#f1f3f4;padding:24px 12px;font-family:Roboto,Arial,sans-serif"><table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto"><tr><td style="background:#ffffff;border-radius:16px;padding:24px">' +
      '<div style="font-size:13px;font-weight:700;letter-spacing:.5px"><span style="color:#4285F4">PROMISE</span> <span style="color:#EA4335">KEEPER</span></div>' +
      '<div style="font-size:26px;font-weight:700;color:#202124;margin:6px 0 2px">Good morning</div>' +
      '<div style="font-size:14px;color:#5f6368;margin-bottom:18px">Here is what needs you today &middot; ' + esc(today) + '</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="6" style="margin:0 -6px 14px"><tr>' +
      tiles.map(function (t) { return '<td align="center" style="background:#f8f9fa;border-radius:12px;padding:12px 4px"><div style="font-size:26px;font-weight:700;color:' + COLORS[t[0]] + '">' + t[1] + '</div><div style="font-size:11px;color:#5f6368">' + t[0] + '</div></td>'; }).join('') +
      '</tr></table>';
    var text = 'Promise Keeper ' + today + '\n';
    sections.forEach(function (s) {
      if (!s[1].length) return;
      html += '<div style="font-size:15px;font-weight:700;color:' + COLORS[s[0]] + ';margin:18px 0 8px">' + s[0] + ' (' + s[1].length + ')</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + s[1].map(function (x) { return row(x, s[0]); }).join('') + '</table>';
      text += '\n' + s[0] + ' (' + s[1].length + ')\n' + s[1].map(textRow).join('\n') + '\n';
    });
    html += '<div style="font-size:12px;color:#80868b;margin-top:20px;border-top:1px solid #e8eaed;padding-top:12px">Promise Keeper never sends email for you. Items come from your own Gmail and need your Accept first.</div></td></tr></table>';
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
