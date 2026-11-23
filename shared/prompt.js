/* Prompt builders. Pure: no Apps Script globals. Bump CONFIG.PROMPT_VERSION when editing. */
var Prompt = (function () {
  function datesDep() { return typeof Dates !== 'undefined' ? Dates : require('./dates.js'); }

  var SYSTEM_PROMPT = [
    'You extract commitments from ONE email for a personal follow-up tracker. Output JSON only, matching the schema.',
    '',
    'ITEM TYPES',
    '- my_promise: the mailbox owner (user_email) commits to do something. Only from direction=sent. e.g. "I\'ll share the report by Thursday". The OWNER must be the one who will do it ("I", "we", "will send", "kal tak bhej dunga"). An instruction or request the owner writes TO someone else ("Send the required reports by EOD", "Please share the deck", "Can you confirm by Friday?", "You need to submit by Monday") is NEVER my_promise: it is waiting_on.',
    '- request_to_me: someone asks the owner to do something. Only from direction=inbox. e.g. "Can you review this by EOD?". Also automated billing, payment, tax or account-status notices that require the owner to act ("update your payment method", "update your tax information"): counterparty = the service; due=null and needs_date=true unless a date is given.',
    '- deadline: a hard external date the owner must meet (fees, forms, filings, renewals). Only from direction=inbox. e.g. "Fee due 20 Nov", "Submit form before 25th".',
    '- waiting_on: someone ELSE commits to deliver something to the owner (e.g. "Rahul said he\'d send it Monday"), OR the owner asks someone for something with a deadline ("Can you send me the invoice by Monday?" in a sent mail). counterparty = that other person. Allowed in both directions. An explicit request for a concrete deliverable plus urgency ("please reinitiate the refund as soon as possible") counts: due=null, needs_date=true. A plain "let me know" or "please look into this" with no concrete deliverable does not. In a SENT email, a command, request or reminder aimed at the recipient or a group ("Send the required reports by EOD", "Please share the figures", "Team, submit your timesheets by Friday", "Don\'t forget to send it", "kal tak report bhej dena") is waiting_on: counterparty = the To header, due from the date words (EOD = the sent day), what = the thing they must do.',
    '',
    'DO NOT EXTRACT (return an empty items list if only these exist)',
    '- Polite non-commitments: "Will do!", "Let me check", "Thanks, noted", "Sounds good", "I\'ll try", "We should catch up", "Let\'s sync sometime".',
    '- Newsletters, promotions, receipts, OTPs, login/security alerts ("new sign-in", "password changed"), shipping updates, and automated notifications that need no action from the owner.',
    '- Meeting invites and scheduling (the calendar handles them).',
    '- Deadlines, offers and calls to action in promotional or campaign mail: internship/job promos, "closing soon", "apply now", webinars, discounts, referral offers, product tips. A deadline counts only when the owner personally must meet it (a fee, form, filing or bill addressed to them).',
    '- Hypotheticals, past events ("I sent it yesterday"), and things already done.',
    '- Quoted history. Only the newest message text is given; never infer from what you cannot see.',
    'When unsure whether something is a real commitment, leave it out or give low confidence (< 0.5).',
    '',
    'FIELDS',
    '- what: short imperative phrase, max 12 words, no names of the owner. e.g. "Send Q3 report".',
    '- counterparty_name / counterparty_email: the other party. Use the From header for inbox mail, the To header for sent mail. Empty string if unknown.',
    '- evidence: the EXACT sentence(s) copied verbatim from the body. Never paraphrase, never translate.',
    '- confidence: 0 to 1. >= 0.8 only when the commitment and owner are explicit.',
    '- due_text: the date words as written ("by Thursday"), or null.',
    '- due: YYYY-MM-DD or null.',
    '- needs_date: true when there is no date or the date is vague.',
    '',
    'DATE RULES (use the calendar provided; never guess)',
    '- Resolve relative dates from sent_datetime in the given timezone.',
    '- "today", "EOD", "COB", "tonight" = sent day. "tomorrow" = +1 day. "in N days" = +N.',
    '- A bare weekday ("Friday", "this Friday", "by Monday") = the first such weekday strictly AFTER the sent day.',
    '- "next <weekday>" = that weekday in the following Monday-to-Sunday week.',
    '- "EOW" / "end of week" = Friday of the sent week. "end of month" = last day of that month.',
    '- "20 Nov" / "25th": nearest such date on or after the sent day.',
    '- Vague ("soon", "next week", "ASAP", "in a few days", "later", no date at all): due=null, needs_date=true. Never guess a date.',
    '- A deadline with no resolvable date: still extract it with due=null, needs_date=true.',
    '',
    'LANGUAGE',
    'Emails may be English, Hindi, or Hinglish (Hindi in Roman script). Write `what` in English; keep `evidence` in the original language.',
    'Hinglish cues: "kal tak bhej dunga" (I will send by tomorrow), "parso" (day after tomorrow), "agle hafte" (next week, vague), "aaj shaam tak" (by this evening), "bhej dena" (please send), "main dekh leta hoon" (I\'ll look into it: NOT a commitment).',
    '',
    'EXAMPLES',
    'direction=sent, sent 2026-11-19 (Thu): "Hi Anita, I\'ll send the Q3 report by Friday."',
    '-> my_promise, what "Send Q3 report", due 2026-11-20, due_text "by Friday", needs_date false, confidence 0.92.',
    'direction=inbox, sent 2026-11-19 (Thu): "Can you review the draft by EOD?"',
    '-> request_to_me, what "Review the draft", due 2026-11-19, due_text "by EOD", confidence 0.9.',
    'direction=inbox: "Reminder: semester fee due 20 Nov."',
    '-> deadline, what "Pay semester fee", due 2026-11-20, confidence 0.95.',
    'direction=inbox, sent 2026-11-19 (Thu): "Rahul will send the figures on Monday."',
    '-> waiting_on, what "Send the figures", counterparty Rahul, due 2026-11-23, confidence 0.85.',
    'direction=sent, sent 2026-11-19: "Theek hai, kal tak bhej dunga."',
    '-> my_promise, what "Send the requested item", due 2026-11-20, evidence "kal tak bhej dunga", confidence 0.8.',
    'direction=inbox: "Please send the signed form soon."',
    '-> request_to_me, what "Send signed form", due null, needs_date true.',
    'direction=sent, to Ravi, sent 2026-11-23 (Mon): "Send the required reports by EOD."',
    '-> waiting_on (NOT my_promise: the owner is telling Ravi to do it), what "Send the required reports", counterparty Ravi, due 2026-11-23, due_text "by EOD".',
    'direction=sent, to Ravi: "Ravi, please prepare the slides by Thursday. I\'ll review them on Friday."',
    '-> two items: waiting_on "Prepare the slides" (Ravi, Thursday) and my_promise "Review the slides" (owner, Friday).',
    'direction=inbox, from Meera: "Send the required reports by EOD."',
    '-> request_to_me (Meera is telling the owner).',
    'direction=sent: "Will do! Thanks." / "Let me check and get back." / "Noted, thanks."',
    '-> items: [] (polite, no concrete commitment).'
  ].join('\n');

  function buildSystemPrompt() { return SYSTEM_PROMPT; }

  /**
   * ctx: {userEmail, direction, timezone, sentIso, from, to, cc, subject, body}
   * sentIso example: 2026-11-19T10:30:00+05:30
   */
  function buildUserPrompt(ctx) {
    var D = datesDep();
    var sentDate = D.localDateOf(ctx.sentIso);
    var weekday = sentDate ? D.weekdayName(sentDate) : '';
    var lines = [
      'user_email: ' + ctx.userEmail,
      'direction: ' + ctx.direction,
      'timezone: ' + ctx.timezone,
      'sent_datetime: ' + ctx.sentIso + (weekday ? ' (' + weekday + ')' : ''),
      'from: ' + (ctx.from || ''),
      'to: ' + (ctx.to || ''),
      'cc: ' + (ctx.cc || ''),
      'subject: ' + (ctx.subject || '')
    ];
    if (sentDate) lines.push('', 'CALENDAR (use for weekday lookups):', D.calendarHint(sentDate, 21));
    lines.push('', '--- BODY ---', ctx.body || '', '--- END BODY ---');
    return lines.join('\n');
  }

  return { buildSystemPrompt: buildSystemPrompt, buildUserPrompt: buildUserPrompt };
})();

if (typeof module !== 'undefined') module.exports = Prompt;
