/* Pure helpers for follow-up nudges: prompt, fallback template, MIME builder. */
var NudgeFmt = (function () {
  function firstName(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }

  function replySubject(s) { return 'Re: ' + String(s || '').replace(/^(\s*(re|fwd?):\s*)+/i, '').trim(); }

  /** Fallback when Gemini fails: short, polite, English. */
  function template(item) {
    var name = firstName(item.counterpartyName);
    var when = item.due ? ' It was due on ' + item.due + '.' : '';
    return (name ? 'Hi ' + name + ',' : 'Hi,') + '\n\nJust a gentle follow-up on "' + item.what + '".' + when + ' Could you let me know where it stands?\n\nThanks!';
  }

  function nudgeSystemPrompt() {
    return [
      'You write a short, polite follow-up email body (2 to 4 sentences) nudging someone about something they said they would do.',
      'Write in the same language and tone as the original sentence (English, Hindi or Hinglish). Be warm, never pushy or accusatory.',
      'Mention what was expected and, if given, the date it was due. Ask for a quick status or an updated date.',
      'Output the email body only: no subject line, no placeholders, no markdown. Start with a greeting using the first name if known. End with a brief thanks.'
    ].join('\n');
  }

  function nudgeUserPrompt(item, today) {
    return [
      'Today: ' + today,
      'Counterparty: ' + (item.counterpartyName || 'unknown'),
      'What they said they would do: ' + item.what,
      'Due date: ' + (item.due || 'none given'),
      'Their original sentence: "' + (item.evidence || '') + '"'
    ].join('\n');
  }

  /**
   * RFC 2822 message (headers + base64 body). b64(str) must return standard base64 of the UTF-8 bytes.
   * o: {to, subject, inReplyTo, references, body}
   */
  function buildMime(o, b64) {
    var asciiSubject = /^[\x20-\x7e]*$/.test(o.subject) ? o.subject : '=?UTF-8?B?' + b64(o.subject) + '?=';
    var h = ['To: ' + o.to, 'Subject: ' + asciiSubject];
    if (o.inReplyTo) h.push('In-Reply-To: ' + o.inReplyTo);
    if (o.references) h.push('References: ' + o.references);
    h.push('MIME-Version: 1.0', 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64');
    var body = b64(o.body).replace(/(.{76})/g, '$1\r\n');
    return h.join('\r\n') + '\r\n\r\n' + body;
  }

  return { firstName: firstName, replySubject: replySubject, template: template, nudgeSystemPrompt: nudgeSystemPrompt, nudgeUserPrompt: nudgeUserPrompt, buildMime: buildMime };
})();

if (typeof module !== 'undefined') module.exports = NudgeFmt;
