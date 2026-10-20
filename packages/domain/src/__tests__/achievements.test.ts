import assert from 'node:assert/strict';
import { test } from 'node:test';
import { achievements, bestWeekStreak, hasBalancedWeek, newlyUnlocked } from '../achievements';
import { exerciseLabel, translatedExerciseCount } from '../training/exercise-names';
import { STAPLES } from '../training/generate';

const DAY = 86_400_000;
const NOW = new Date('2026-10-14T12:00:00').getTime(); // a Wednesday
const iso = (t: number) => new Date(t).toISOString();
const session = (id: string, t: number, weight = 20, reps = 10, durationSec?: number) => ({
  id,
  workoutName: 'Full body',
  date: iso(t),
  ...(durationSec ? { durationSec } : {}),
  exercises: [
    {
      name: 'Goblet Squat',
      muscle: 'legs' as const,
      sets: [
        { reps, weight, completed: true },
        { reps, weight, completed: true },
      ],
    },
  ],
});
const empty = { sessions: [], meals: [], outfits: [], weightEntries: [] };
const byId = (list: ReturnType<typeof achievements>) => Object.fromEntries(list.map((a) => [a.id, a]));

test('nothing unlocked on an empty account', () => {
  const list = achievements(empty, 3, NOW);
  assert.ok(list.length >= 10 && list.length <= 20);
  assert.equal(list.filter((a) => a.unlocked).length, 0);
  assert.equal(new Set(list.map((a) => a.id)).size, list.length);
});

test('first session, PR and week goal', () => {
  const sessions = [
    session('a', NOW - 2 * DAY, 20),
    session('b', NOW - DAY, 22.5),
    session('c', NOW, 25, 10, 50 * 60),
  ];
  const a = byId(achievements({ ...empty, sessions }, 3, NOW));
  assert.equal(a.firstSession.unlocked, true);
  assert.equal(a.firstPR.unlocked, true);
  assert.equal(a.prs10.progress, 2);
  assert.equal(a.weekGoal.unlocked, true);
  assert.equal(a.longSession.unlocked, true);
  assert.equal(a.sessions10.progress, 3);
  assert.equal(a.sessions10.unlocked, false);
});

test('sessions without a completed set do not count', () => {
  const s = session('a', NOW);
  s.exercises[0].sets = s.exercises[0].sets.map((x) => ({ ...x, completed: false }));
  assert.equal(byId(achievements({ ...empty, sessions: [s] }, 3, NOW)).firstSession.unlocked, false);
});

test('best streak survives a later break', () => {
  // Weeks 10, 9, 8 before now: 1 session each with goal 1 -> 3-week streak, then nothing.
  const sessions = [10, 9, 8].map((w) => session(`w${w}`, NOW - w * 7 * DAY));
  assert.equal(bestWeekStreak({ sessions, meals: [], outfits: [] }, 1, NOW), 3);
  assert.equal(byId(achievements({ ...empty, sessions }, 1, NOW)).streak3.unlocked, true);
});

test('balanced week needs a session, a meal and a worn outfit in the same week', () => {
  const sessions = [session('a', NOW)];
  const meals = [
    {
      id: 'm',
      name: 'Oats',
      date: iso(NOW - DAY),
      slot: 'breakfast' as const,
      calories: 300,
      protein: 10,
      carbs: 50,
      fat: 5,
      estimated: false,
      servings: 1,
    },
  ];
  const outfit = (d: string) => ({ id: 'o', name: 'Look', itemIds: ['x'], wornOn: [d] });
  assert.equal(
    hasBalancedWeek({ sessions, meals, outfits: [outfit(iso(NOW - 14 * DAY).slice(0, 10))] }),
    false,
  );
  assert.equal(hasBalancedWeek({ sessions, meals, outfits: [outfit(iso(NOW).slice(0, 10))] }), true);
});

test('newlyUnlocked lists only fresh unlocks', () => {
  const before = achievements(empty, 3, NOW);
  const after = achievements({ ...empty, sessions: [session('a', NOW)] }, 3, NOW);
  assert.deepEqual(newlyUnlocked(before, after), ['firstSession']);
  assert.deepEqual(newlyUnlocked(after, after), []);
});

test('exercise names: French for staples, original otherwise', () => {
  assert.equal(exerciseLabel('Pushups', 'fr'), 'Pompes');
  assert.equal(exerciseLabel(' pushups ', 'fr'), 'Pompes');
  assert.equal(exerciseLabel('Pushups', 'en'), 'Pushups');
  assert.equal(exerciseLabel('Some Custom Move', 'fr'), 'Some Custom Move');
  for (const name of STAPLES) assert.ok(exerciseLabel(name, 'fr') !== name || name === 'Face Pull', name);
  assert.ok(translatedExerciseCount('fr') >= STAPLES.length);
});
