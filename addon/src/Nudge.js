/** One-tap follow-up: creates a threaded Gmail DRAFT. Never sends. */
var Nudge = {
  headerOf_: function (msg, name) {
    var h = ((msg.payload && msg.payload.headers) || []).filter(function (x) { return x.name.toLowerCase() === name.toLowerCase(); })[0];
    return h ? h.value : '';
  },

  emailOf_: function (header) {
    var m = /<([^>]+)>/.exec(String(header || ''));
    return (m ? m[1] : String(header || '')).trim().toLowerCase();
  },

  /** Returns {draftId, usedFallback}. */
  draftFor: function (itemId) {
    var it = Outputs.find_(itemId);
    if (it.type !== 'waiting_on') throw new Error('Nudges are only for "waiting on" items');

    var thread = Gmail.Users.Threads.get('me', it.threadId, { format: 'metadata', metadataHeaders: ['Message-ID', 'References', 'Subject', 'From', 'To'] });
    var msgs = thread.messages || [];
    if (!msgs.length) throw new Error('Thread not found');
    var last = msgs[msgs.length - 1];
    var me = Session.getEffectiveUser().getEmail().toLowerCase();

    // Recipient: the counterparty if known, else the sender of the latest message from someone else.
    var to = it.counterpartyEmail;
    for (var i = msgs.length - 1; i >= 0 && !to; i--) {
      var from = Nudge.emailOf_(Nudge.headerOf_(msgs[i], 'From'));
      if (from && from !== me) to = from;
    }
    if (!to) throw new Error('No recipient email for this item. Edit the counterparty first.');

    var today = Utilities.formatDate(new Date(), getTimezone_(), 'yyyy-MM-dd');
    var body = Gemini.text(NudgeFmt.nudgeSystemPrompt(), NudgeFmt.nudgeUserPrompt(it, today));
    var usedFallback = !body;
    if (usedFallback) body = NudgeFmt.template(it);

    var msgIdHeader = Nudge.headerOf_(last, 'Message-ID');
    var refs = (Nudge.headerOf_(last, 'References') + ' ' + msgIdHeader).trim();
    var b64 = function (s) { return Utilities.base64Encode(Utilities.newBlob(s).getBytes()); };
    var mime = NudgeFmt.buildMime({
      to: to, subject: NudgeFmt.replySubject(Nudge.headerOf_(msgs[0], 'Subject')),
      inReplyTo: msgIdHeader, references: refs, body: body
    }, b64);
    var draft = Gmail.Users.Drafts.create({ message: { raw: Utilities.base64EncodeWebSafe(mime), threadId: it.threadId } }, 'me');
    Outputs.feedback_(itemId, 'nudge', { status: it.status }, { draftId: draft.id, fallback: usedFallback });
    return { draftId: draft.id, usedFallback: usedFallback };
  }
};
