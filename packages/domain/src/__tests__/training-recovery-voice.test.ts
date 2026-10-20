import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exerciseLibrary } from '../exercises';
import { computeRecovery, freshGroups, muscleLookup, tauHours } from '../training/recovery';
import { applyVoiceLog, parseVoiceLog } from '../training/voice-log';
import type { Session } from '../training/types';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const at = (hoursAgo: number) => new Date(NOW - hoursAgo * 3600000).toISOString();
const done = (n: number) => Array.from({ length: n }, () => ({ reps: 10, weight: 50, completed: true }));

test('recovery: primary 1, secondary 0.5, exponential decay with τ by muscle size', () => {
  const lookup = muscleLookup(exerciseLibrary);
  const sessions: Session[] = [
    {
      id: 'a',
      workoutName: 'T',
      date: at(36),
      exercises: [
        {
          name: 'barbell bench press - medium grip',
          muscle: 'chest',
          sets: [
            ...done(8),
            { reps: 5, weight: 20, completed: true, warmup: true },
            { reps: 8, weight: 50, completed: false },
          ],
        },
      ],
    },
  ];
  const r = computeRecovery(sessions, lookup, NOW);
  assert.equal(tauHours('chest'), 36);
  assert.equal(tauHours('triceps'), 24);
  assert.ok(Math.abs(r.muscles.chest - 8 * Math.exp(-1)) < 1e-9);
  assert.ok(Math.abs(r.muscles.triceps - 8 * 0.5 * Math.exp(-36 / 24)) < 1e-9);
  assert.ok(Math.abs(r.groups.chest - r.muscles.chest) < 1e-9);
  assert.ok(r.recovered.chest < r.recovered.arms);
  assert.equal(r.recovered.legs, 1);
  assert.ok(freshGroups(r).includes('legs'));
  assert.ok(!freshGroups(r).includes('chest'));
});

test('recovery: unmatched custom exercises fall back to their saved group; old sessions vanish', () => {
  const r = computeRecovery(
    [
      {
        id: 'a',
        workoutName: 'T',
        date: at(0),
        exercises: [{ name: 'My odd lift', muscle: 'legs', sets: done(8) }],
      },
      {
        id: 'b',
        workoutName: 'T',
        date: at(24 * 30),
        exercises: [{ name: 'Pushups', muscle: 'chest', sets: done(20) }],
      },
    ],
    muscleLookup(exerciseLibrary),
    NOW,
  );
  assert.equal(r.recovered.legs, 0);
  assert.equal(r.recovered.chest, 1);
});

test('voice: english and french phrases', () => {
  assert.deepEqual(parseVoiceLog('3 sets of 10 at 60 kg'), { sets: 3, reps: 10, weight: 60 });
  assert.deepEqual(parseVoiceLog('3x10 60'), { sets: 3, reps: 10, weight: 60 });
  assert.deepEqual(parseVoiceLog('trois séries de 10 à 60 kilos'), { sets: 3, reps: 10, weight: 60 });
  assert.deepEqual(parseVoiceLog('same again'), { repeat: true });
  assert.deepEqual(parseVoiceLog('plus 2.5'), { delta: 2.5 });
  assert.deepEqual(parseVoiceLog('moins 5 kilos'), { delta: -5 });
  assert.deepEqual(parseVoiceLog('8 reps 2 left'), { reps: 8, rir: 2 });
  assert.deepEqual(parseVoiceLog('12 répétitions à 22,5 kg'), { reps: 12, weight: 22.5 });
  assert.deepEqual(parseVoiceLog('vingt-cinq kilos, huit reps'), { reps: 8, weight: 25 });
  assert.deepEqual(parseVoiceLog('Ten reps at sixty two and a half'), { reps: 10, weight: 62.5 });
  assert.deepEqual(parseVoiceLog('pareil'), { repeat: true });
  assert.deepEqual(parseVoiceLog('10'), { reps: 10 });
  assert.equal(parseVoiceLog('hello'), null);
});

test('voice: applying a log fills and ticks the next unticked sets', () => {
  const exercises: Session['exercises'] = [
    {
      name: 'Bench',
      muscle: 'chest',
      sets: [
        { reps: 10, weight: 60, completed: true },
        { reps: 10, weight: 60, completed: false },
        { reps: 10, weight: 60, completed: false },
      ],
    },
    { name: 'Row', muscle: 'back', sets: [{ reps: 10, weight: 50, completed: false }] },
  ];
  const a = applyVoiceLog(exercises, { reps: 8, rir: 2 });
  assert.deepEqual(a.ticked, [{ exercise: 0, set: 1 }]);
  assert.deepEqual(a.exercises[0].sets[1], { reps: 8, weight: 60, completed: true, rir: 2 });
  assert.equal(exercises[0].sets[1].completed, false, 'input is not mutated');
  const b = applyVoiceLog(a.exercises, { delta: 2.5 });
  assert.deepEqual([b.exercises[0].sets[2].reps, b.exercises[0].sets[2].weight], [8, 62.5]);
  const c = applyVoiceLog(b.exercises, { sets: 2, reps: 12, weight: 45 });
  assert.equal(c.exercises[1].sets.length, 2, 'adds a set when needed');
  assert.ok(c.exercises[1].sets.every((s) => s.completed && s.reps === 12 && s.weight === 45));
  const d = applyVoiceLog(c.exercises, { repeat: true });
  assert.deepEqual(d.ticked, [{ exercise: 1, set: 2 }]);
  assert.equal(d.exercises[1].sets[2].weight, 45);
});
