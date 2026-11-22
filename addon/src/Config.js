var CONFIG = {
  PROMPT_VERSION: 'v2',
  GEMINI_MODEL: 'gemini-3.5-flash-lite', // id guessed from the model name; confirm in AI Studio
  SHOW_CONFIDENCE: 0.6,             // below this = "Suggestion" only
  MAX_MESSAGES_PER_RUN: 40,
  RUN_BUDGET_MS: 270000,            // stop before the 6 min execution cap
  DEFAULT_TZ: 'Asia/Kolkata',
  SCAN_QUERY: '(in:sent OR in:inbox) newer_than:2d -category:promotions -category:social -in:chats -subject:"[Promise Keeper]"',
  BACKFILL_QUERY: '(in:sent OR in:inbox) newer_than:{DAYS}d -category:promotions -category:social -in:chats -subject:"[Promise Keeper]"',
  MAX_CLEAN_CHARS: 3000,
  MIN_BODY_CHARS: 20,
  DEDUP_JACCARD: 0.6,
  GEMINI_MAX_TRIES: 3,
  GEMINI_SPACING_MS: 4500 // pause before each call; keeps free tier under ~13 requests/min
};

/** Timezone: user setting, else script/calendar default, else Asia/Kolkata. */
function getTimezone_() {
  try {
    var s = Db.getSetting('timezone', ''); // override saved from the sidebar settings
    if (s) return s;
    return CalendarApp.getDefaultCalendar().getTimeZone() || CONFIG.DEFAULT_TZ;
  } catch (e) {
    return CONFIG.DEFAULT_TZ;
  }
}
