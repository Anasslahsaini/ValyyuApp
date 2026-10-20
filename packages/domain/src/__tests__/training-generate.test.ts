import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canDoExercise, exerciseLibrary, searchExercises } from '../exercises';
import { asPlan, chooseSplit, generateToday, STAPLES } from '../training/generate';
import { newLifeState, validateRestorableLife } from '../life';
import type { Session } from '../training/types';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const day = (d: number) => new Date(NOW - d * 86400000).toISOString();
const sess = (
  id: string,
  daysAgo: number,
  names: [string, Session['exercises'][number]['muscle'], number?][],
): Session => ({
  id,
  workoutName: 'T',
  date: day(daysAgo),
  exercises: names.map(([name, muscle, w = 40]) => ({
    name,
    muscle,
    sets: [1, 2, 3].map(() => ({ reps: 10, weight: w, completed: true })),
  })),
});

test('every staple is a real catalogue exercise', () => {
  const names = new Set(exerciseLibrary.map((e) => e.name));
  for (const n of STAPLES) assert.ok(names.has(n), n);
});

test('bench and pull-up bar chips now gate exercises by name; body only is always available', () => {
  assert.equal(canDoExercise('Bodyweight', [], 'Pushups'), true);
  assert.equal(canDoExercise('Bodyweight', [], 'Pullups'), false);
  assert.equal(canDoExercise('Bodyweight', ['pullup'], 'Pullups'), true);
  assert.equal(canDoExercise('Bodyweight', ['pullup'], 'Chin-Up'), true);
  assert.equal(canDoExercise('Dumbbells', ['dumbbells'], 'Dumbbell Bench Press'), false);
  assert.equal(canDoExercise('Dumbbells', ['dumbbells', 'bench'], 'Dumbbell Bench Press'), true);
  assert.equal(canDoExercise('Other equipment', ['bench'], 'Some Bench Thing'), true);
  const withBench = searchExercises('', 'all', ['bench']).length;
  assert.ok(withBench > searchExercises('', 'all', []).length);
  assert.ok(searchExercises('', 'all', ['pullup']).some((e) => e.name === 'Pullups'));
});

test('infrequent training gets a full-body workout of 4–6 strength exercises, compounds first', () => {
  const w = generateToday({
    equipment: ['dumbbells', 'bench'],
    sessions: [],
    goal: 'muscle',
    minutes: 45,
    catalogue: exerciseLibrary,
    now: NOW,
  });
  assert.equal(w.split, 'full');
  assert.ok(w.exercises.length >= 4 && w.exercises.length <= 6, String(w.exercises.length));
  const lib = new Map(exerciseLibrary.map((e) => [e.name, e]));
  const mech = w.exercises.map((e) => lib.get(e.name)!.mechanic);
  assert.deepEqual(
    mech,
    [...mech].sort((a, b) => Number(a === 'isolation') - Number(b === 'isolation')),
  );
  for (const e of w.exercises) {
    const c = lib.get(e.name)!;
    assert.ok(['strength', 'powerlifting'].includes(c.category));
    assert.ok(canDoExercise(c.equipment, ['dumbbells', 'bench'], c.name), e.name);
  }
  assert.equal(new Set(w.exercises.map((e) => e.name)).size, w.exercises.length);
  // Saved as a plan, it passes the workspace schema.
  const state = newLifeState();
  state.workouts.push(asPlan(w, 'plan-1'));
  assert.deepEqual(validateRestorableLife(state), state);
});

test('push/pull/legs rotation picks the freshest muscles when training often', () => {
  const sessions = [
    sess('1', 5, [['Barbell Squat', 'legs']]),
    sess('2', 4, [['Pullups', 'back']]),
    sess('3', 1, [
      ['Barbell Bench Press - Medium Grip', 'chest'],
      ['Standing Military Press', 'shoulders'],
    ]),
    sess('4', 0.2, [
      ['Bent Over Barbell Row', 'back'],
      ['Barbell Curl', 'arms'],
    ]),
    sess('5', 7, [['Barbell Squat', 'legs']]),
  ];
  assert.equal(chooseSplit(sessions, exerciseLibrary, NOW), 'legs');
  const w = generateToday({
    equipment: ['barbell', 'bench', 'pullup', 'machine'],
    sessions,
    goal: 'strength',
    minutes: 60,
    catalogue: exerciseLibrary,
    now: NOW,
  });
  assert.equal(w.split, 'legs');
  // Prefers exercises done before, with weights from progression.
  const squat = w.exercises.find((e) => e.name === 'Barbell Squat');
  assert.ok(squat, w.exercises.map((e) => e.name).join(', '));
  // Last time 3×10 at 40 kg: every set above the strength range top (6) → +5 kg for a barbell leg compound.
  assert.deepEqual([squat!.reps, squat!.weight], [3, 45]);
});

test('focus groups, equipment limits and regenerate', () => {
  const w = generateToday({
    equipment: [],
    sessions: [],
    goal: 'general',
    minutes: 30,
    catalogue: exerciseLibrary,
    focus: ['legs', 'core'],
    now: NOW,
  });
  assert.equal(w.split, 'fresh');
  assert.ok(w.exercises.length >= 4);
  const lib = new Map(exerciseLibrary.map((e) => [e.name, e]));
  for (const e of w.exercises) {
    const c = lib.get(e.name)!;
    assert.equal(
      c.sourceEquipment === 'body only' || c.sourceEquipment === null || c.sourceEquipment === 'other',
      true,
      `${e.name}: ${c.sourceEquipment}`,
    );
    assert.ok(['legs', 'core'].includes(c.muscle), e.name);
  }
  const a = generateToday({
    equipment: ['dumbbells', 'bench'],
    sessions: [],
    minutes: 45,
    catalogue: exerciseLibrary,
    now: NOW,
  });
  const b = generateToday({
    equipment: ['dumbbells', 'bench'],
    sessions: [],
    minutes: 45,
    catalogue: exerciseLibrary,
    now: NOW,
    variant: 1,
  });
  assert.notDeepEqual(
    a.exercises.map((e) => e.name),
    b.exercises.map((e) => e.name),
  );
  assert.ok(a.minutes > 0 && a.minutes <= 60);
});
