/** Same values as addon/src/Config.js, so Stage A and Stage B extract identically. */
export const CONFIG = {
  PROMPT_VERSION: 'v3',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  GEMINI_MAX_TRIES: 4,
  MAX_CLEAN_CHARS: 3000,
  MIN_BODY_CHARS: 20,
  DEDUP_JACCARD: 0.6,
  SCAN_QUERY: '(in:sent OR in:inbox) newer_than:2d -category:promotions -category:social -in:chats -subject:"[Promise Keeper]"',
  BACKFILL_QUERY_FAST: '(in:sent OR in:inbox) newer_than:7d -category:promotions -category:social -in:chats -subject:"[Promise Keeper]"',
  BACKFILL_QUERY: '(in:sent OR in:inbox) newer_than:30d -category:promotions -category:social -in:chats -subject:"[Promise Keeper]"',
  SCAN_LIMIT: 40,
  BACKFILL_LIMIT: 200,
  QUEUE_BATCH: 50,
  CONCURRENCY: 4,
  MAX_ATTEMPTS: 3,
  // Stop starting new emails at 28 s: with the free-tier Gemini spacing (4.5 s per call) emails already in progress can add 15 s or more, and Vercel stops a run at 60 s.
  RUN_BUDGET_MS: 28_000,
  HARD_STOP_GRACE_MS: 12_000, // after the soft deadline, how long to wait for emails already in progress before returning anyway
  WATCH_RENEW_BEFORE_MS: 2 * 24 * 3600 * 1000,
};
