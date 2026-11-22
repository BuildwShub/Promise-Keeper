/** Gmail search + message fetch via the Advanced Gmail service (narrow scopes, no GmailApp). */
var Fetch = {
  /** Message IDs for a query, newest first, up to `limit`, skipping ids in `skipSet`. */
  listIds: function (query, limit, skipSet) {
    var ids = [];
    var pageToken = null;
    do {
      var res = Gmail.Users.Messages.list('me', { q: query, maxResults: 100, pageToken: pageToken });
      (res.messages || []).forEach(function (m) {
        if (ids.length < limit && !(skipSet && skipSet[m.id])) ids.push({ id: m.id, threadId: m.threadId });
      });
      pageToken = res.nextPageToken;
    } while (pageToken && ids.length < limit);
    return ids;
  },

  /** One message -> {msgId, threadId, direction, internalDate, from, to, cc, subject, body}. Null for drafts. */
  getMessage: function (id) {
    return Fetch.parse_(Gmail.Users.Messages.get('me', id, { format: 'full' }));
  },

  /** The sidebar's "Scan this thread": reads the open message with the add-on's current-message access token. */
  // The token only grants the open message and is only valid via GmailApp.setCurrentMessageAccessToken
  // (it is rejected as a Bearer token on the REST API).
  getMessageWithToken: function (eventMsgId, eventThreadId, token) {
    GmailApp.setCurrentMessageAccessToken(token);
    var gm = GmailApp.getMessageById(eventMsgId);
    var from = gm.getFrom();
    var m = /<([^>]+)>/.exec(from);
    var fromEmail = (m ? m[1] : from).trim().toLowerCase();
    return {
      msgId: Fetch.apiId_(eventMsgId),
      threadId: Fetch.apiId_(eventThreadId),
      direction: fromEmail === Session.getEffectiveUser().getEmail().toLowerCase() ? 'sent' : 'inbox',
      internalDate: gm.getDate().getTime(),
      from: from,
      to: gm.getTo(),
      cc: gm.getCc(),
      subject: gm.getSubject(),
      body: gm.getPlainBody()
    };
  },

  /** Add-on event ids ("msg-f:123..." / "thread-f:123...", decimal) -> Gmail API hex ids. */
  apiId_: function (eventId) {
    var m = /^(?:msg|thread)-[a-z]:(\d+)$/i.exec(String(eventId || ''));
    return m ? BigInt(m[1]).toString(16) : String(eventId || '');
  },

  parse_: function (m) {
    var labels = m.labelIds || [];
    if (labels.indexOf('DRAFT') !== -1) return null;
    var h = Fetch.headers_(m.payload);
    var plain = [], html = [];
    Fetch.collectParts_(m.payload, plain, html);
    var body = plain.length ? plain.join('\n') : Clean.htmlToText(html.join('\n'));
    return {
      msgId: m.id,
      threadId: m.threadId,
      direction: labels.indexOf('SENT') !== -1 ? 'sent' : 'inbox',
      internalDate: Number(m.internalDate),
      from: h.from || '',
      to: h.to || '',
      cc: h.cc || '',
      subject: h.subject || '',
      body: body
    };
  },

  headers_: function (payload) {
    var out = {};
    (payload.headers || []).forEach(function (x) { out[x.name.toLowerCase()] = x.value; });
    return out;
  },

  // Walk MIME tree; attachments (parts with a filename) are ignored.
  collectParts_: function (part, plain, html) {
    if (!part) return;
    if (part.filename) return;
    var data = part.body && part.body.data;
    if (data && part.mimeType === 'text/plain') plain.push(Fetch.decode_(data));
    else if (data && part.mimeType === 'text/html') html.push(Fetch.decode_(data));
    (part.parts || []).forEach(function (p) { Fetch.collectParts_(p, plain, html); });
  },

  // Gmail sends base64url, sometimes unpadded or with stray whitespace; normalize before decoding.
  // A part that still fails is skipped so one bad part cannot fail the whole message.
  decode_: function (b64url) {
    try {
      // Some runtimes hand back bytes instead of a base64 string.
      if (Array.isArray(b64url)) return Utilities.newBlob(b64url).getDataAsString('UTF-8');
      var s = String(b64url).replace(/[\s\r\n]/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
      while (s.length % 4) s += '=';
      return Utilities.newBlob(Utilities.base64Decode(s)).getDataAsString('UTF-8');
    } catch (e) {
      Fetch.lastDecodeError = String(e.message || e) + ' | type=' + typeof b64url + ' sample=' + String(b64url).slice(0, 40);
      return '';
    }
  },

  /** Diagnostic: MIME tree shape of a message (no content). */
  describe_: function (part) {
    var d = part.body && part.body.data;
    return {
      mime: part.mimeType, file: part.filename || '', dataType: d === undefined ? 'none' : (Array.isArray(d) ? 'array' : typeof d),
      dataLen: d ? d.length : 0, sample: typeof d === 'string' ? d.slice(0, 24) : '', attachmentId: !!(part.body && part.body.attachmentId),
      parts: (part.parts || []).map(Fetch.describe_)
    };
  },

  /** ISO datetime with offset in the given timezone, e.g. 2026-11-19T10:30:00+05:30 */
  sentIso: function (internalDate, tz) {
    return Utilities.formatDate(new Date(internalDate), tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
};
