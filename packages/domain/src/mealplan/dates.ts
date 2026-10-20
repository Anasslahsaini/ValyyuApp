/** Timezone-free date helpers on 'YYYY-MM-DD' strings (UTC arithmetic, so DST never shifts a day). */

export function dayNumber(date: string): number {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86400000);
}
export function addDays(date: string, n: number): string {
  const t = new Date((dayNumber(date) + n) * 86400000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}
/** 0 = Sunday ... 6 = Saturday. */
export function weekday(date: string): number {
  return new Date(dayNumber(date) * 86400000).getUTCDay();
}
export const isWeekend = (date: string) => [0, 6].includes(weekday(date));
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

/** Default per-day cooking minutes for a date range (weekday/weekend values from settings). */
export function defaultCookMinutesByDay(
  startDate: string,
  days: number,
  weekdayMinutes = 30,
  weekendMinutes = 60,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = addDays(startDate, i);
    out[d] = isWeekend(d) ? weekendMinutes : weekdayMinutes;
  }
  return out;
}

/** FNV-1a hash -> [0, 1). Deterministic seeded jitter for tie-breaking. */
export function hash01(...parts: (string | number)[]): number {
  let h = 2166136261;
  const s = parts.join('\u0001');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
