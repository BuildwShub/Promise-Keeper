/* Pure dedup helpers: normalization, token Jaccard, fingerprint. */
var Dedup = (function () {
  var STOP = { the: 1, a: 1, an: 1, to: 1, of: 1, for: 1, and: 1, my: 1, me: 1, on: 1, by: 1, in: 1, at: 1, is: 1, be: 1 };

  function normalizeWhat(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokens(s) {
    var out = [];
    var seen = {};
    var parts = normalizeWhat(s).split(' ');
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p && !STOP[p] && !seen[p]) { seen[p] = 1; out.push(p); }
    }
    return out;
  }

  function jaccard(a, b) {
    var ta = tokens(a), tb = tokens(b);
    if (!ta.length && !tb.length) return 1;
    var setB = {};
    for (var i = 0; i < tb.length; i++) setB[tb[i]] = 1;
    var inter = 0;
    for (var j = 0; j < ta.length; j++) if (setB[ta[j]]) inter++;
    var union = ta.length + tb.length - inter;
    return union === 0 ? 0 : inter / union;
  }

  // cyrb53: small, stable, no crypto dependency (works in Apps Script and Node).
  function hash53(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }

  function fingerprint(threadId, type, what) {
    return hash53(String(threadId) + '|' + type + '|' + normalizeWhat(what));
  }

  /**
   * Find an existing item that duplicates `candidate`.
   * existing: items with {threadId, type, what, fingerprint}.
   * Returns the matching item or null.
   */
  function findDuplicate(candidate, existing, threshold) {
    threshold = threshold === undefined ? 0.6 : threshold;
    var fp = candidate.fingerprint || fingerprint(candidate.threadId, candidate.type, candidate.what);
    for (var i = 0; i < existing.length; i++) {
      var e = existing[i];
      if (e.fingerprint === fp) return e;
    }
    for (var j = 0; j < existing.length; j++) {
      var x = existing[j];
      if (x.threadId === candidate.threadId && x.type === candidate.type && jaccard(x.what, candidate.what) >= threshold) return x;
    }
    return null;
  }

  /** Decide what to do with a duplicate: keep the first, but adopt a due date it lacked. */
  function resolveDuplicate(existing, candidate) {
    if (!existing.due && candidate.due) return { action: 'update', patch: { due: candidate.due, dueText: candidate.dueText, needsDate: false } };
    return { action: 'skip', patch: null };
  }

  return { normalizeWhat: normalizeWhat, tokens: tokens, jaccard: jaccard, fingerprint: fingerprint, findDuplicate: findDuplicate, resolveDuplicate: resolveDuplicate };
})();

if (typeof module !== 'undefined') module.exports = Dedup;
