/** Gemini call. Key lives in Script Properties (GEMINI_API_KEY). Use the PAID tier. */
var Gemini = {
  /** ctx: see Prompt.buildUserPrompt. Returns the raw items array from the model. */
  extract: function (ctx) {
    var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!key) throw new Error('GEMINI_API_KEY not set in Script Properties');
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + CONFIG.GEMINI_MODEL + ':generateContent';
    var payload = {
      systemInstruction: { parts: [{ text: Prompt.buildSystemPrompt() }] },
      contents: [{ role: 'user', parts: [{ text: Prompt.buildUserPrompt(ctx) }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: Schema.RESPONSE_SCHEMA
      }
    };
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': key },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    Utilities.sleep(CONFIG.GEMINI_SPACING_MS);
    var lastErr;
    for (var attempt = 0; attempt < CONFIG.GEMINI_MAX_TRIES; attempt++) {
      var res = UrlFetchApp.fetch(url, options);
      var code = res.getResponseCode();
      if (code === 200) {
        var data = JSON.parse(res.getContentText());
        var cand = data.candidates && data.candidates[0];
        var text = cand && cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
        if (!text) return []; // blocked or empty: treat as no items
        var parsed = JSON.parse(text);
        return parsed.items || [];
      }
      lastErr = 'HTTP ' + code + ': ' + res.getContentText().slice(0, 200);
      if (code !== 429 && code < 500) break; // non-retryable
      Utilities.sleep(1000 * Math.pow(2, attempt)); // 1s, 2s, 4s
    }
    throw new Error('Gemini failed: ' + lastErr);
  }
};

/** Free-text generation (nudge drafts). Returns '' on any failure so callers can fall back to a template. */
Gemini.text = function (system, user) {
  try {
    var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!key) return '';
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + CONFIG.GEMINI_MODEL + ':generateContent';
    Utilities.sleep(CONFIG.GEMINI_SPACING_MS);
    for (var attempt = 0; attempt < CONFIG.GEMINI_MAX_TRIES; attempt++) {
      var res = UrlFetchApp.fetch(url, {
        method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key }, muteHttpExceptions: true,
        payload: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature: 0.4 }
        })
      });
      var code = res.getResponseCode();
      if (code === 200) {
        var data = JSON.parse(res.getContentText());
        var p = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
        return (p && p[0] && p[0].text ? String(p[0].text) : '').trim();
      }
      if (code !== 429 && code < 500) return '';
      Utilities.sleep(1000 * Math.pow(2, attempt));
    }
  } catch (e) { /* fall through */ }
  return '';
};
