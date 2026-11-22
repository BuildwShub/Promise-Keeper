/* Pure email cleaning. Runs in Apps Script (V8) and Node. */
var Clean = (function () {
  var DEFAULT_MAX_CHARS = 3000;

  // Everything from the first match onward is quoted history.
  var QUOTE_PATTERNS = [
    /^On [^\n]{3,300}?wrote:[ \t]*$/m,
    /^On [^\n]{3,200}\n[^\n]{0,200}wrote:[ \t]*$/m,
    /^-{2,}[ \t]*(?:Original Message|Forwarded message)[ \t]*-{2,}/im,
    /^Begin forwarded message:/im,
    /^From:[^\n]+\n(?:To|Sent|Date):/im,
    /^[ \t]*>/m,
    /^_{10,}[ \t]*$/m
  ];

  var SIGNATURE_PATTERNS = [
    /^-- ?$/m,
    /^Sent from my [^\n]*$/im,
    /^Get Outlook for [^\n]*$/im
  ];

  var SIGNOFF = /^(?:thanks(?: and| &) regards|thanks|thank you|many thanks|best regards|warm regards|kind regards|regards|with regards|best wishes|best|cheers|sincerely|yours (?:sincerely|truly)|dhanyavad|shukriya)[ \t]*[,!.]?[ \t]*$/im;
  var SIGNOFF_MAX_TAIL = 200; // only cut when what follows is signature-sized

  var FOOTER_PATTERNS = [
    /^[^\n]*(?:unsubscribe|view (?:this email )?in (?:your )?browser|this e-?mail (?:message )?(?:and any|is intended)|this message (?:and any|is intended)|confidentiality notice|disclaimer:)[^\n]*$/im
  ];

  function cutAtFirst(text, patterns) {
    var cut = text.length;
    for (var i = 0; i < patterns.length; i++) {
      var m = patterns[i].exec(text);
      if (m && m.index < cut) cut = m.index;
    }
    return text.slice(0, cut);
  }

  function cutSignoff(text) {
    var m = SIGNOFF.exec(text);
    if (m && text.length - m.index < SIGNOFF_MAX_TAIL) return text.slice(0, m.index);
    return text;
  }

  function collapseWhitespace(text) {
    return text
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t ]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function truncate(text, maxChars) {
    if (text.length <= maxChars) return text;
    var cut = text.slice(0, maxChars);
    var lastSpace = cut.search(/\s\S*$/);
    return (lastSpace > maxChars * 0.8 ? cut.slice(0, lastSpace) : cut).trim();
  }

  function decodeEntities(s) {
    return s
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(parseInt(n, 10)); })
      .replace(/&amp;/gi, '&');
  }

  function htmlToText(html) {
    var t = String(html || '');
    t = t.replace(/<!--[\s\S]*?-->/g, ' ');
    t = t.replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ');
    t = t.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '');
    t = t.replace(/<br\s*\/?>/gi, '\n');
    t = t.replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n');
    t = t.replace(/<[^>]+>/g, '');
    return decodeEntities(t);
  }

  /** Full pipeline: quotes, footers, signatures, whitespace, truncate. */
  function clean(text, opts) {
    var maxChars = (opts && opts.maxChars) || DEFAULT_MAX_CHARS;
    var t = String(text || '').replace(/\r\n?/g, '\n');
    t = cutAtFirst(t, QUOTE_PATTERNS);
    t = cutAtFirst(t, FOOTER_PATTERNS);
    t = cutAtFirst(t, SIGNATURE_PATTERNS);
    t = cutSignoff(t);
    return truncate(collapseWhitespace(t), maxChars);
  }

  return { clean: clean, htmlToText: htmlToText, collapseWhitespace: collapseWhitespace, truncate: truncate, DEFAULT_MAX_CHARS: DEFAULT_MAX_CHARS };
})();

if (typeof module !== 'undefined') module.exports = Clean;
