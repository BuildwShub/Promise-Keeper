/** ISO datetime with offset in the given timezone, e.g. 2026-11-19T10:30:00+05:30 (same as the add-on's Fetch.sentIso). */
export function sentIso(ms: number, tz: string): string {
  const d = new Date(ms);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  const off = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
    .formatToParts(d).find((p) => p.type === 'timeZoneName')!.value; // "GMT+05:30" or "GMT"
  const offset = off === 'GMT' ? '+00:00' : off.replace('GMT', '');
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}:${g('second')}${offset}`;
}
