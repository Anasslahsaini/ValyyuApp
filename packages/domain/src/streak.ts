/**
 * Kind motivation (pure): a streak counted in weeks, not days, and an estimate of time saved.
 * A week counts when the planned sessions are done, or when the user was active on 4 days
 * (meal logged, workout, outfit worn). One missed week per calendar month is forgiven (joker).
 */
import type { LifeState } from './life';

const DAY = 86_400_000;

/** Monday 00:00 (local) of the week containing `t`. */
export function weekStart(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  const shift = (d.getDay() + 6) % 7;
  return d.getTime() - shift * DAY;
}

const dayKey = (iso: string) => iso.slice(0, 10);
const inWeek = (iso: string, start: number) => {
  const t = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso).getTime();
  return t >= start && t < start + 7 * DAY;
};

type Activity = Pick<LifeState, 'meals' | 'sessions' | 'outfits'>;

export function weekStats(state: Activity, start: number) {
  const sessions = state.sessions.filter((s) => inWeek(s.date, start)).length;
  const days = new Set<string>();
  for (const m of state.meals) if (inWeek(m.date, start)) days.add(dayKey(m.date));
  for (const s of state.sessions) if (inWeek(s.date, start)) days.add(dayKey(s.date));
  for (const o of state.outfits) for (const d of o.wornOn ?? []) if (inWeek(d, start)) days.add(dayKey(d));
  return { sessions, activeDays: days.size };
}

export const weekDone = (stats: { sessions: number; activeDays: number }, sessionGoal: number) =>
  (sessionGoal > 0 && stats.sessions >= sessionGoal) || stats.activeDays >= 4;

export function weeklyStreak(state: Activity, sessionGoal: number, now = Date.now()) {
  const current = weekStart(now);
  const thisWeek = weekStats(state, current);
  const thisWeekDone = weekDone(thisWeek, sessionGoal);
  let weeks = thisWeekDone ? 1 : 0;
  const jokerUsed = new Set<string>();
  // Walk back through finished weeks; the current week can only add, never break.
  for (let i = 1; i <= 104; i++) {
    const start = current - i * 7 * DAY;
    if (weekDone(weekStats(state, start), sessionGoal)) {
      weeks++;
      continue;
    }
    const month = new Date(start).toISOString().slice(0, 7);
    // A joker only bridges two counted weeks, so check the week before it before forgiving this one.
    const before = current - (i + 1) * 7 * DAY;
    if (!jokerUsed.has(month) && weeks > 0 && weekDone(weekStats(state, before), sessionGoal)) {
      jokerUsed.add(month);
      continue;
    }
    break;
  }
  return { weeks, thisWeek, thisWeekDone, sessionGoal };
}

/** Minutes saved this week (estimate): planning and logging the app did for the user. */
export const SAVED_MINUTES = { mealLogged: 2, plannedMeal: 3, session: 10, outfitWorn: 5 } as const;

export function timeSavedThisWeek(
  state: Activity & Pick<LifeState, 'plannedMeals'>,
  now = Date.now(),
): number {
  const start = weekStart(now);
  const meals = state.meals.filter((m) => inWeek(m.date, start)).length;
  const planned = state.plannedMeals.filter((p) => inWeek(p.date, start)).length;
  const sessions = state.sessions.filter((s) => inWeek(s.date, start)).length;
  const worn = state.outfits.reduce((n, o) => n + (o.wornOn ?? []).filter((d) => inWeek(d, start)).length, 0);
  return (
    meals * SAVED_MINUTES.mealLogged +
    planned * SAVED_MINUTES.plannedMeal +
    sessions * SAVED_MINUTES.session +
    worn * SAVED_MINUTES.outfitWorn
  );
}

/** "45 min", "2 h", "2 h 15". */
export function formatSaved(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60),
    m = Math.round((minutes % 60) / 5) * 5;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}
