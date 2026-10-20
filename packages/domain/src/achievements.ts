/**
 * Achievements ("Succès"), computed purely from data the app already stores: nothing is saved,
 * so they can never drift from the real history. Labels live in components/achievements/copy.ts.
 */
import type { LifeState } from './life';
import { weekDone, weekStart, weekStats, weeklyStreak } from './streak';
import { prCountsBySession } from './training/history';

const DAY = 86_400_000;

/** Sport achievements (ids are stable: the Fitness tab and the end-of-session card use them). */
export type FitnessAchievementId =
  | 'firstSession'
  | 'sessions10'
  | 'sessions25'
  | 'sessions50'
  | 'sessions100'
  | 'weekGoal'
  | 'streak3'
  | 'streak8'
  | 'streak12'
  | 'firstPR'
  | 'prs10'
  | 'balancedWeek'
  | 'sets100'
  | 'volume10t'
  | 'weighIns5'
  | 'longSession';
export type MealAchievementId =
  'firstMeal' | 'mealDays7' | 'firstPlan' | 'firstCooked' | 'fridgeCooked' | 'cooked10';
export type StyleAchievementId = 'firstWorn' | 'worn10' | 'worn30' | 'firstScan' | 'wardrobe10';
export type AnyAchievementId = FitnessAchievementId | MealAchievementId | StyleAchievementId;

export type AchievementId = AnyAchievementId;

export type Achievement = {
  id: AchievementId;
  /** Feather icon name. */
  icon: string;
  unlocked: boolean;
  /** Current value, capped at `target` (for "3/10"). */
  progress: number;
  target: number;
};

export type AchievementData = Pick<LifeState, 'sessions' | 'meals' | 'outfits' | 'weightEntries'>;

const toTime = (iso: string) => new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso).getTime();
const doneSets = (s: LifeState['sessions'][number]) =>
  s.exercises.flatMap((e) => e.sets.filter((x) => x.completed && !x.warmup));

/** Longest run of consecutive counted weeks (no joker), up to 5 years back. */
export function bestWeekStreak(
  state: Pick<LifeState, 'meals' | 'sessions' | 'outfits'>,
  sessionGoal: number,
  now = Date.now(),
): number {
  const dates = [
    ...state.sessions.map((s) => s.date),
    ...state.meals.map((m) => m.date),
    ...state.outfits.flatMap((o) => o.wornOn ?? []),
  ]
    .map(toTime)
    .filter((t) => Number.isFinite(t) && t <= now + DAY);
  if (!dates.length) return 0;
  const current = weekStart(now);
  const first = weekStart(Math.min(...dates));
  const weeks = Math.min(260, Math.round((current - first) / (7 * DAY)));
  let best = 0,
    run = 0;
  for (let i = weeks; i >= 0; i--) {
    const start = weekStart(current - i * 7 * DAY + DAY);
    if (weekDone(weekStats(state, start), sessionGoal)) {
      run++;
      best = Math.max(best, run);
    } else if (i > 0) run = 0;
  }
  return Math.max(best, weeklyStreak(state, sessionGoal, now).weeks);
}

/** True when some week has a session, a logged meal and a worn outfit: the three parts used together. */
export function hasBalancedWeek(state: Pick<LifeState, 'meals' | 'sessions' | 'outfits'>): boolean {
  const weeks = (dates: string[]) => new Set(dates.map((d) => weekStart(toTime(d))));
  const s = weeks(state.sessions.filter((x) => doneSets(x).length).map((x) => x.date));
  const m = weeks(state.meals.map((x) => x.date));
  const o = weeks(state.outfits.flatMap((x) => x.wornOn ?? []));
  for (const w of s) if (m.has(w) && o.has(w)) return true;
  return false;
}

export function achievements(state: AchievementData, sessionGoal = 3, now = Date.now()): Achievement[] {
  const real = state.sessions.filter((s) => doneSets(s).length > 0);
  const n = real.length;
  const sets = real.reduce((a, s) => a + doneSets(s).length, 0);
  const volume = real.reduce((a, s) => a + doneSets(s).reduce((b, x) => b + x.reps * x.weight, 0), 0);
  const prs = Object.values(prCountsBySession(state.sessions)).reduce((a, c) => a + c, 0);
  const goal = sessionGoal > 0 ? sessionGoal : 3;
  const perWeek = new Map<number, number>();
  for (const s of real) {
    const w = weekStart(toTime(s.date));
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  }
  const bestWeek = Math.max(0, ...perWeek.values());
  const streak = bestWeekStreak(state, goal, now);
  const longest = Math.max(0, ...real.map((s) => s.durationSec ?? 0));

  const a = (id: AchievementId, icon: string, value: number, target: number): Achievement => ({
    id,
    icon,
    unlocked: value >= target,
    progress: Math.min(target, Math.floor(value)),
    target,
  });
  return [
    a('firstSession', 'play', n, 1),
    a('weekGoal', 'check-circle', bestWeek, goal),
    a('firstPR', 'award', prs, 1),
    a('streak3', 'zap', streak, 3),
    a('sessions10', 'activity', n, 10),
    a('balancedWeek', 'sun', hasBalancedWeek(state) ? 1 : 0, 1),
    a('weighIns5', 'trending-down', state.weightEntries.length, 5),
    a('longSession', 'clock', longest / 60, 45),
    a('sets100', 'layers', sets, 100),
    a('prs10', 'star', prs, 10),
    a('sessions25', 'activity', n, 25),
    a('streak8', 'zap', streak, 8),
    a('volume10t', 'bar-chart-2', volume, 10_000),
    a('sessions50', 'activity', n, 50),
    a('streak12', 'zap', streak, 12),
    a('sessions100', 'award', n, 100),
  ];
}

/** Ids unlocked in `after` but not in `before` (for the end-of-session card). */
export function newlyUnlocked(
  before: readonly Achievement[],
  after: readonly Achievement[],
): AchievementId[] {
  const had = new Set(before.filter((x) => x.unlocked).map((x) => x.id));
  return after.filter((x) => x.unlocked && !had.has(x.id)).map((x) => x.id);
}

type Unit = (id: AchievementId, icon: string, value: number, target: number) => Achievement;
const unit: Unit = (id, icon, value, target) => ({
  id,
  icon,
  unlocked: value >= target,
  progress: Math.min(target, Math.floor(value)),
  target,
});

export type MealAchievementData = Pick<LifeState, 'meals'> & { plannedMeals?: LifeState['plannedMeals'] };

/**
 * Repas: a meal logged with "I cooked it" carries a manual food ref (a planned meal `plan-…`
 * or a fridge idea's recipe id), so cooking is told apart from a plain log without new data.
 */
export function mealAchievements(state: MealAchievementData): Achievement[] {
  const days = new Set(state.meals.map((m) => m.date.slice(0, 10))).size;
  const cooked = state.meals.filter((m) => m.foodRef?.source === 'manual');
  const fridge = cooked.filter((m) => !m.foodRef!.id.startsWith('plan-')).length;
  return [
    unit('firstMeal', 'edit-3', state.meals.length, 1),
    unit('firstPlan', 'calendar', (state.plannedMeals ?? []).length ? 1 : 0, 1),
    unit('firstCooked', 'check-circle', cooked.length, 1),
    unit('fridgeCooked', 'box', fridge, 1),
    unit('mealDays7', 'sun', days, 7),
    unit('cooked10', 'award', cooked.length, 10),
  ];
}

export type StyleAchievementData = Pick<LifeState, 'outfits' | 'wardrobe'>;

/** Style: outfits worn (wornOn dates), wardrobe size and scans made before buying (counted on the device). */
export function styleAchievements(state: StyleAchievementData, scans = 0): Achievement[] {
  const worn = state.outfits.reduce((a, o) => a + (o.wornOn?.length ?? 0), 0);
  return [
    unit('firstWorn', 'check-circle', worn, 1),
    unit('firstScan', 'camera', scans, 1),
    unit('wardrobe10', 'grid', state.wardrobe.length, 10),
    unit('worn10', 'star', worn, 10),
    unit('worn30', 'award', worn, 30),
  ];
}

export type AllAchievementData = AchievementData &
  Pick<LifeState, 'wardrobe'> & { plannedMeals?: LifeState['plannedMeals'] };
export type AchievementGroups = { fitness: Achievement[]; meals: Achievement[]; style: Achievement[] };

/** Every achievement, grouped by part (Profile "Succès X/N" and the shared list). */
export function allAchievements(
  state: AllAchievementData,
  sessionGoal = 3,
  opts: { scans?: number; now?: number } = {},
): AchievementGroups {
  return {
    fitness: achievements(state, sessionGoal, opts.now),
    meals: mealAchievements(state),
    style: styleAchievements(state, opts.scans ?? 0),
  };
}

export function achievementCount(groups: AchievementGroups): { unlocked: number; total: number } {
  const list = [...groups.fitness, ...groups.meals, ...groups.style];
  return { unlocked: list.filter((a) => a.unlocked).length, total: list.length };
}
