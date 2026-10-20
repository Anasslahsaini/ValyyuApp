import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bestSets,
  countPRs,
  detectPRs,
  e1rm,
  exerciseProgress,
  lastPerformance,
  prCountsBySession,
  summarizeSets,
} from '../training/history';
import { platesPerSide, roundToPlates, roundToStep } from '../training/plates';
import type { Session } from '../training/types';

export const set = (
  reps: number,
  weight: number,
  extra: Partial<{ completed: boolean; warmup: boolean; rir: number }> = {},
) => ({ reps, weight, completed: true, ...extra });
export const session = (id: string, date: string, exercises: Session['exercises']): Session => ({
  id,
  workoutName: 'Test',
  date,
  exercises,
});

test('e1rm uses Brzycki up to 6 reps, Epley to 12, nothing above', () => {
  assert.equal(e1rm(100, 1), 100);
  assert.ok(Math.abs(e1rm(100, 5)! - (100 * 36) / 32) < 1e-9); // Brzycki
  assert.ok(Math.abs(e1rm(100, 10)! - 100 * (1 + 10 / 30)) < 1e-9); // Epley
  assert.ok(Math.abs(e1rm(50, 12)! - 50 * 1.4) < 1e-9);
  assert.equal(e1rm(100, 13), null);
  assert.equal(e1rm(0, 10), null);
  assert.equal(e1rm(60, 0), null);
});

test('lastPerformance returns completed work sets of the newest session, matching names loosely', () => {
  const history = [
    session('a', '2026-10-01T10:00:00Z', [
      { name: 'Bench Press', muscle: 'chest', sets: [set(10, 50), set(10, 50)] },
    ]),
    session('b', '2026-10-05T10:00:00Z', [
      {
        name: '  bench press ',
        muscle: 'chest',
        sets: [set(5, 20, { warmup: true }), set(8, 55), set(7, 55, { completed: false })],
      },
    ]),
    session('c', '2026-10-07T10:00:00Z', [{ name: 'Squat', muscle: 'legs', sets: [set(5, 80)] }]),
  ];
  const last = lastPerformance('Bench Press', history)!;
  assert.equal(last.sessionId, 'b');
  assert.deepEqual(
    last.sets.map((s) => [s.reps, s.weight]),
    [[8, 55]],
  );
  assert.equal(lastPerformance('bench press', history, { excludeId: 'b' })!.sessionId, 'a');
  assert.equal(lastPerformance('Deadlift', history), null);
});

test('bestSets and exerciseProgress track records over time', () => {
  const history = [
    session('a', '2026-10-01T10:00:00Z', [{ name: 'Row', muscle: 'back', sets: [set(10, 50), set(12, 45)] }]),
    session('b', '2026-10-05T10:00:00Z', [{ name: 'Row', muscle: 'back', sets: [set(6, 60)] }]),
  ];
  const best = bestSets('row', history);
  assert.equal(best.heaviest!.weight, 60);
  assert.equal(best.mostReps!.reps, 12);
  assert.equal(best.bestE1rm!.date, '2026-10-05T10:00:00Z');
  const [row] = exerciseProgress(history);
  assert.equal(row.name, 'Row');
  assert.equal(row.sessions, 2);
  assert.equal(row.trend.length, 2);
  assert.ok(row.trend[1].value > row.trend[0].value);
  assert.equal(row.lastDate, '2026-10-05T10:00:00Z');
});

test('detectPRs flags weight, rep and e1RM records but not first sessions', () => {
  const history = [
    session('a', '2026-10-01T10:00:00Z', [
      { name: 'Bench', muscle: 'chest', sets: [set(8, 60), set(8, 60)] },
      { name: 'Pull-up', muscle: 'back', sets: [set(8, 0)] },
    ]),
  ];
  const today = session('b', '2026-10-08T10:00:00Z', [
    { name: 'Bench', muscle: 'chest', sets: [set(5, 65), set(9, 60)] },
    { name: 'Pull-up', muscle: 'back', sets: [set(10, 0)] },
    { name: 'Dips', muscle: 'arms', sets: [set(10, 0)] },
  ]);
  const prs = detectPRs(today, [...history, today]);
  assert.deepEqual(prs.Bench, { weightPR: true, repPR: true, e1rmPR: true });
  assert.deepEqual(prs['Pull-up'], { weightPR: false, repPR: true, e1rmPR: false });
  assert.deepEqual(prs.Dips, { weightPR: false, repPR: false, e1rmPR: false });
  assert.equal(countPRs(prs), 2);
  // Editing an older session only compares with sessions before it.
  assert.equal(countPRs(detectPRs(history[0], [...history, today])), 0);
  // The one-pass History badge agrees.
  assert.deepEqual(prCountsBySession([today, ...history]), { a: 0, b: 2 });
});

test('summarizeSets renders the "Last" line', () => {
  assert.equal(summarizeSets([set(10, 57.5), set(10, 57.5), set(10, 57.5)]), '3×10 · 57.5 kg');
  assert.equal(summarizeSets([set(10, 50), set(8, 50)]), '10, 8 · 50 kg');
  assert.equal(summarizeSets([set(12, 0)]), '1×12');
});

test('plates: rounding and per-side loading', () => {
  assert.equal(roundToPlates(61, 20, undefined), 60);
  assert.equal(roundToPlates(61, 20, undefined, 'up'), 62.5);
  assert.equal(roundToPlates(10, 20), 20);
  assert.equal(roundToPlates(101, 20, [20, 10, 5]), 100);
  assert.equal(roundToStep(18.1), 17.5);
  assert.equal(roundToStep(18.1, undefined, 'up'), 18.75);
  assert.deepEqual(platesPerSide(102.5), { perSide: [25, 15, 1.25], total: 102.5, remainder: 0 });
  assert.deepEqual(platesPerSide(20).perSide, []);
  assert.equal(platesPerSide(61).remainder, 1);
});
