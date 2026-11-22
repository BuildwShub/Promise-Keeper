/* Gemini responseSchema + shared enums. */
var Schema = (function () {
  var TYPES = ['my_promise', 'request_to_me', 'deadline', 'waiting_on'];
  var STATUSES = ['suggested', 'accepted', 'dismissed', 'done', 'possibly_resolved'];

  var RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
      items: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            type: { type: 'STRING', enum: TYPES },
            what: { type: 'STRING' },
            counterparty_name: { type: 'STRING' },
            counterparty_email: { type: 'STRING' },
            due: { type: 'STRING', nullable: true },
            due_text: { type: 'STRING', nullable: true },
            needs_date: { type: 'BOOLEAN' },
            confidence: { type: 'NUMBER' },
            evidence: { type: 'STRING' }
          },
          required: ['type', 'what', 'counterparty_name', 'counterparty_email', 'due', 'due_text', 'needs_date', 'confidence', 'evidence']
        }
      }
    },
    required: ['items']
  };

  return { TYPES: TYPES, STATUSES: STATUSES, RESPONSE_SCHEMA: RESPONSE_SCHEMA };
})();

if (typeof module !== 'undefined') module.exports = Schema;
