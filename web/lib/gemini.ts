import { Prompt, Schema } from './shared';
import { CONFIG } from './config';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Minimum gap between Gemini call starts, shared by all parallel workers. Free tier needs ~4500 ms (about 13 calls/min);
// set GEMINI_SPACING_MS=0 once the key is on the paid tier.
let nextSlot = 0;
async function pace() {
  const gap = Number(process.env.GEMINI_SPACING_MS ?? 4500);
  if (!(gap > 0)) return;
  const at = Math.max(Date.now(), nextSlot);
  nextSlot = at + gap;
  if (at > Date.now()) await sleep(at - Date.now());
}

/** Same request as addon/src/Gemini.js. Returns the raw items array from the model. Paid-tier key in GEMINI_API_KEY. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function geminiExtract(ctx: any): Promise<any[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent`;
  const payload = {
    systemInstruction: { parts: [{ text: Prompt.buildSystemPrompt() }] },
    contents: [{ role: 'user', parts: [{ text: Prompt.buildUserPrompt(ctx) }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: Schema.RESPONSE_SCHEMA },
  };
  let lastErr = '';
  for (let attempt = 0; attempt < CONFIG.GEMINI_MAX_TRIES; attempt++) {
    await pace();
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(payload) });
    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return []; // blocked or empty: no items
      return JSON.parse(text).items ?? [];
    }
    lastErr = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
    if (res.status !== 429 && res.status < 500) break; // not retryable
    await sleep((res.status === 429 ? 5000 : 1000) * 2 ** attempt);
  }
  throw new Error('Gemini failed: ' + lastErr);
}

/** Free-text generation (nudge drafts). Returns '' on any failure so callers can fall back to a template. */
export async function geminiText(system: string, user: string): Promise<string> {
  // A person is waiting on the button, so this is one quick attempt (8 s cap): on a rate limit or any error the caller uses the template.
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return '';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent`;
    const res = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { temperature: 0.4 } }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    return String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
  } catch { /* timeout or network error: use the template */ }
  return '';
}
