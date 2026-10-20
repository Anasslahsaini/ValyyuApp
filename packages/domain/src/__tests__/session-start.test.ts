import assert from 'node:assert/strict';
import test from 'node:test';
import { finishSession, startSession } from '../training/session-start';
import type { Session, Workout } from '../training/types';

const workout: Workout = {
  id: 'w',
  name: 'Corps entier',
  exercises: [
    {
      id: 'e1',
      name: 'Push-up',
      muscle: 'chest',
      equipment: 'body only',
      sets: 3,
      reps: 10,
      weight: 0,
      restSeconds: 60,
    },
    {
      id: 'e2',
      name: 'Dumbbell Bench Press',
      muscle: 'chest',
      equipment: 'dumbbell',
      sets: 3,
      reps: 10,
      weight: 20,
      restSeconds: 90,
    },
  ],
};

test('a first session uses the plan numbers, every set still to do', () => {
  const s = startSession(workout, [], {}, { id: 's1', now: '2026-10-20T10:00:00.000Z' });
  assert.equal(s.exercises.length, 2);
  assert.deepEqual(s.exercises[1]?.sets[0], { reps: 10, weight: 20, completed: false });
  assert.equal(s.exercises[0]?.restSeconds, 60);
  assert.equal(s.source, 'today');
});

test('after a session at the top of the range, the load goes up', () => {
  const past: Session = {
    id: 'old',
    workoutName: 'x',
    date: '2026-10-18T10:00:00.000Z',
    exercises: [
      {
        name: 'Dumbbell Bench Press',
        muscle: 'chest',
        sets: [1, 2, 3].map(() => ({ reps: 15, weight: 20, completed: true })),
      },
    ],
  };
  const s = startSession(workout, [past], { goal: 'general' }, { id: 's2', now: '2026-10-20T10:00:00.000Z' });
  assert.ok((s.exercises[1]?.sets[0]?.weight ?? 0) > 20);
});

test('finishing keeps only the exercises with a done set and records the duration', () => {
  const s = startSession(workout, [], {}, { id: 's3', now: '2026-10-20T10:00:00.000Z' });
  s.exercises[0]!.sets[0]!.completed = true;
  const done = finishSession(s, Date.parse('2026-10-20T10:25:00.000Z'));
  assert.ok(done);
  assert.equal(done.exercises.length, 1);
  assert.equal(done.durationSec, 25 * 60);
  assert.equal(finishSession(startSession(workout, [], {}, { id: 's4' })), null);
});
