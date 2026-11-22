/* Validate + normalize raw model items. Pure. */
var Validate = (function () {
  function datesDep() { return typeof Dates !== 'undefined' ? Dates : require('./dates.js'); }
  function schemaDep() { return typeof Schema !== 'undefined' ? Schema : require('./schema.js'); }

  var EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
  // Types that cannot originate from a given direction.
  var BLOCKED = { sent: { request_to_me: 1, deadline: 1 }, inbox: { my_promise: 1 } };

  function normalizeForMatch(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[‘’‚‛]/g, "'")
      .replace(/[“”„]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/[​‌‍﻿]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function trimEvidence(s) {
    return String(s || '').replace(/^[\s"'….]+|[\s"'….]+$/g, '');
  }

  function clamp01(n) {
    n = Number(n);
    if (!isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  /**
   * rawItems: model output items. ctx: {cleanedText, direction, sentDate}
   * Returns {items, dropped:[{reason, item}]}.
   */
  function validateItems(rawItems, ctx) {
    var D = datesDep();
    var S = schemaDep();
    var items = [];
    var dropped = [];
    var haystack = normalizeForMatch(ctx.cleanedText);
    var list = Array.isArray(rawItems) ? rawItems : [];

    list.forEach(function (raw) {
      if (!raw || typeof raw !== 'object') return dropped.push({ reason: 'not_object', item: raw });
      if (S.TYPES.indexOf(raw.type) === -1) return dropped.push({ reason: 'bad_type', item: raw });
      if (BLOCKED[ctx.direction] && BLOCKED[ctx.direction][raw.type]) return dropped.push({ reason: 'type_direction', item: raw });
      var what = String(raw.what || '').trim();
      if (!what) return dropped.push({ reason: 'empty_what', item: raw });
      var ev = trimEvidence(raw.evidence);
      if (!ev) return dropped.push({ reason: 'no_evidence', item: raw });
      if (haystack.indexOf(normalizeForMatch(ev)) === -1) return dropped.push({ reason: 'evidence_not_found', item: raw });

      var clamp = D.clampDue(raw.due, { sentDate: ctx.sentDate, type: raw.type });
      var needsDate = !!raw.needs_date || clamp.needsDate;
      if (clamp.due === null && raw.type === 'deadline') needsDate = true;
      if (clamp.due !== null) needsDate = false;

      var email = String(raw.counterparty_email || '').trim().toLowerCase();
      items.push({
        type: raw.type,
        what: what,
        counterpartyName: String(raw.counterparty_name || '').trim(),
        counterpartyEmail: EMAIL_RE.test(email) ? email : '',
        due: clamp.due,
        dueText: raw.due_text ? String(raw.due_text).trim() : '',
        needsDate: needsDate,
        confidence: clamp01(raw.confidence),
        evidence: ev
      });
    });

    return { items: items, dropped: dropped };
  }

  return { validateItems: validateItems, normalizeForMatch: normalizeForMatch };
})();

if (typeof module !== 'undefined') module.exports = Validate;
