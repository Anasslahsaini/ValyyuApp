import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ADULT_FLOOR_KCAL, activityFactor, ageFrom, computeTargets, sessionKcal } from '../targets';
import { formatSaved, timeSavedThisWeek, weekStart, weeklyStreak } from '../streak';

test('targets need weight, height and age', () => {
  assert.equal(computeTargets({ heightCm: 175, weightKg: 70 }), null);
  assert.equal(computeTargets({ birthYear: 2000, weightKg: 70, year: 2026 }), null);
  assert.equal(ageFrom(2000, 2026), 26);
  assert.equal(ageFrom(undefined), null);
});

test('Mifflin-St Jeor with activity and goal', () => {
  // Man, 26 y, 180 cm, 75 kg, 3 sessions/week: (750 + 1125 - 130 + 5) × 1.55 = 2712.5 → 2710.
  const base = {
    sex: 'male' as const,
    birthYear: 2000,
    heightCm: 180,
    weightKg: 75,
    sessionsPerWeek: 3,
    year: 2026,
  };
  assert.equal(computeTargets({ ...base, mainGoal: 'maintain' })!.calories, 2710);
  assert.equal(computeTargets({ ...base, mainGoal: 'lose' })!.calories, 2310);
  assert.equal(computeTargets({ ...base, mainGoal: 'muscle' })!.calories, 2980);
  assert.equal(computeTargets({ ...base, mainGoal: 'muscle' })!.protein, 120);
  const t = computeTargets({ ...base, mainGoal: 'maintain' })!;
  assert.ok(Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.calories) < 10);
});

test('safety: adult floor, no deficit for minors', () => {
  const small = computeTargets({
    sex: 'female',
    birthYear: 1990,
    heightCm: 150,
    weightKg: 42,
    sessionsPerWeek: 0,
    mainGoal: 'lose',
    year: 2026,
  })!;
  assert.equal(small.calories, ADULT_FLOOR_KCAL);
  const teen = {
    sex: 'female' as const,
    birthYear: 2012,
    heightCm: 160,
    weightKg: 50,
    sessionsPerWeek: 2,
    year: 2026,
  };
  assert.equal(
    computeTargets({ ...teen, mainGoal: 'lose' })!.calories,
    computeTargets({ ...teen, mainGoal: 'maintain' })!.calories,
  );
});

test('activity factor and session energy', () => {
  assert.equal(activityFactor(0), 1.2);
  assert.equal(activityFactor(3), 1.55);
  assert.equal(activityFactor(6), 1.725);
  assert.equal(sessionKcal(3600, 80), 400);
  assert.equal(sessionKcal(undefined, 80), 250);
});

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const empty = {
  meals: [] as never[],
  sessions: [] as never[],
  outfits: [] as never[],
  plannedMeals: [] as never[],
};
const session = (iso: string) => ({ id: iso, workoutName: 'W', date: iso, exercises: [] });

test('weeks start on Monday', () => {
  const wed = new Date(2026, 9, 14, 15).getTime(); // Wednesday 14 Oct 2026
  assert.equal(new Date(weekStart(wed)).getDate(), 12);
});

test('streak counts weeks, forgives one missed week per month, current week never breaks it', () => {
  const now = new Date(2026, 9, 14, 12).getTime(); // week of 12 Oct
  const s = [
    at(2026, 10, 5),
    at(2026, 10, 7),
    at(2026, 9, 28),
    at(2026, 9, 30),
    at(2026, 9, 14),
    at(2026, 9, 16),
  ].map(session);
  // Done: weeks of 5 Oct, 28 Sep; missed 21 Sep (joker, September); done 14 Sep. Current week not done yet.
  const r = weeklyStreak({ ...empty, sessions: s as never }, 2, now);
  assert.equal(r.thisWeekDone, false);
  assert.equal(r.weeks, 3);
  const none = weeklyStreak(empty, 2, now);
  assert.equal(none.weeks, 0);
});

test('active days also complete a week', () => {
  const now = new Date(2026, 9, 18, 12).getTime(); // Sunday
  const meals = [12, 13, 14, 15].map((d) => ({ id: String(d), name: 'm', date: at(2026, 10, d) }));
  const r = weeklyStreak({ ...empty, meals: meals as never }, 3, now);
  assert.equal(r.thisWeekDone, true);
  assert.equal(r.weeks, 1);
});

test('time saved is an estimate from real actions this week', () => {
  const now = new Date(2026, 9, 14, 12).getTime();
  const state = {
    ...empty,
    meals: [{ date: at(2026, 10, 13) }] as never,
    sessions: [session(at(2026, 10, 12))] as never,
    outfits: [{ wornOn: ['2026-10-13', '2026-09-01'] }] as never,
    plannedMeals: [{ date: '2026-10-15' }, { date: '2026-10-30' }] as never,
  };
  assert.equal(timeSavedThisWeek(state, now), 2 + 3 + 10 + 5);
  assert.equal(formatSaved(45), '45 min');
  assert.equal(formatSaved(120), '2 h');
  assert.equal(formatSaved(135), '2 h 15');
});
