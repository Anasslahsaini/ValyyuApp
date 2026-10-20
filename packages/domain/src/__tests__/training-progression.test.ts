import { test } from 'node:test';
import assert from 'node:assert/strict';
import { incrementFor, nextTarget, repRangeFor } from '../training/progression';
import type { Session } from '../training/types';

const set = (reps: number, weight: number) => ({ reps, weight, completed: true });
const s = (
  id: string,
  day: number,
  name: string,
  sets: { reps: number; weight: number; completed: boolean }[],
  muscle: Session['exercises'][number]['muscle'] = 'chest',
): Session => ({
  id,
  workoutName: 'T',
  date: `2026-10-${String(day).padStart(2, '0')}T10:00:00Z`,
  exercises: [{ name, muscle, sets }],
});
const bench = {
  name: 'Barbell Bench Press',
  muscle: 'chest' as const,
  equipment: 'Barbell',
  sets: 3,
  reps: 8,
  weight: 0,
};

test('rep range defaults by goal, settings override', () => {
  assert.deepEqual(repRangeFor({ goal: 'strength' }), [3, 6]);
  assert.deepEqual(repRangeFor({ goal: 'muscle' }), [8, 12]);
  assert.deepEqual(repRangeFor({}), [8, 12]);
  assert.deepEqual(repRangeFor({ goal: 'strength', repRange: [5, 8] }), [5, 8]);
});

test('no history: plan numbers', () => {
  const t = nextTarget({ ...bench, weight: 40 }, [], {});
  assert.deepEqual([t.sets, t.reps, t.weight, t.reason], [3, 8, 40, 'plan']);
});

test('all sets at the top of the range: add load and restart at the bottom', () => {
  const t = nextTarget(bench, [s('a', 1, 'barbell bench press', [set(12, 60), set(12, 60), set(12, 60)])], {
    goal: 'muscle',
  });
  assert.deepEqual([t.reps, t.weight, t.reason], [8, 62.5, 'increase']);
  const squat = nextTarget(
    { name: 'Barbell Squat', muscle: 'legs', equipment: 'Barbell', sets: 3, reps: 5, weight: 0 },
    [s('a', 1, 'Barbell Squat', [set(6, 100), set(6, 100)], 'legs')],
    { goal: 'strength' },
  );
  assert.deepEqual([squat.reps, squat.weight], [3, 105]);
});

test('otherwise hold the load and aim for one more rep', () => {
  const t = nextTarget(bench, [s('a', 1, 'Barbell Bench Press', [set(10, 60), set(9, 60), set(8, 60)])], {
    goal: 'muscle',
  });
  assert.deepEqual([t.reps, t.weight, t.reason], [10, 60, 'hold']);
});

test('below the range two sessions in a row: −10 % rounded to plates', () => {
  const history = [
    s('a', 1, 'Barbell Bench Press', [set(6, 60), set(5, 60)]),
    s('b', 4, 'Barbell Bench Press', [set(7, 60), set(6, 60)]),
  ];
  const t = nextTarget(bench, history, { goal: 'muscle' });
  assert.deepEqual([t.reps, t.weight, t.reason], [8, 55, 'deload']);
  // Only once below: hold.
  assert.equal(nextTarget(bench, [history[1]], { goal: 'muscle' }).reason, 'hold');
});

test('increments: deadlift and barbell leg compounds +5, upper body and isolation +2.5', () => {
  assert.equal(incrementFor({ name: 'Romanian Deadlift', sets: 3, reps: 8, weight: 0 }), 5);
  assert.equal(
    incrementFor({
      name: 'Barbell Squat',
      muscle: 'legs',
      equipment: 'Barbell',
      sets: 3,
      reps: 8,
      weight: 0,
    }),
    5,
  );
  assert.equal(
    incrementFor({
      name: 'Leg Extensions',
      muscle: 'legs',
      equipment: 'Machine',
      mechanic: 'isolation',
      sets: 3,
      reps: 8,
      weight: 0,
    }),
    2.5,
  );
  assert.equal(incrementFor(bench), 2.5);
});

test('custom bar and plates are respected; dumbbells round to the smallest plate', () => {
  const t = nextTarget(bench, [s('a', 1, 'Barbell Bench Press', [set(12, 40)])], {
    goal: 'muscle',
    barKg: 15,
    plates: [10, 5],
  });
  assert.equal(t.weight, 45);
  const db = nextTarget(
    { name: 'Dumbbell Curl', muscle: 'arms', equipment: 'Dumbbells', sets: 3, reps: 10, weight: 0 },
    [s('a', 1, 'Dumbbell Curl', [set(12, 12)], 'arms')],
    { goal: 'muscle' },
  );
  assert.equal(db.weight, 15);
});

test('bodyweight exercises progress by reps', () => {
  const t = nextTarget(
    { name: 'Pullups', muscle: 'back', equipment: 'Bodyweight', sets: 3, reps: 8, weight: 0 },
    [s('a', 1, 'Pullups', [set(8, 0), set(7, 0)], 'back')],
    { goal: 'muscle' },
  );
  assert.deepEqual([t.reps, t.weight], [9, 0]);
});
