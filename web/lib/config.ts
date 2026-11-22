/** Same values as addon/src/Config.js, so Stage A and Stage B extract identically. */
export const CONFIG = {
  PROMPT_VERSION: 'v2',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  GEMINI_MAX_TRIES: 4,
  MAX_CLEAN_CHARS: 3000,
  MIN_BODY_CHARS: 20,
  DEDUP_JACCARD: 0.6,
  SCAN_QUERY: '(in:sent OR in:inbox) newer_than:2d -category:promotions -category:social -in:chats -subject:"[Promise Keeper]"',
  BACKFILL_QUERY: '(in:sent OR in:inbox) newer_than:30d -category:promotions -category:social -in:chats -subject:"[Promise Keeper]"',
  SCAN_LIMIT: 40,
  BACKFILL_LIMIT: 200,
  QUEUE_BATCH: 50,
  CONCURRENCY: 4,
  MAX_ATTEMPTS: 3,
  RUN_BUDGET_MS: 45_000,
  WATCH_RENEW_BEFORE_MS: 2 * 24 * 3600 * 1000,
};
