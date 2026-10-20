import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  exerciseLibrary,
  muscleMapping,
  searchExercises,
  canDoExercise,
  workoutExerciseFromCatalogue,
} from '../exercises';
import data from '../../data/free-exercise-db/exercises.json';
import provenance from '../../data/free-exercise-db/source.json';
import { newLifeState, upsertRecord, validateRestorableLife, muscleGroups } from '../life';

test('complete pinned public-domain catalogue preserves upstream metadata', () => {
  assert.equal(provenance.license, 'Unlicense');
  assert.match(provenance.revision, /^[a-f0-9]{40}$/);
  assert.equal(exerciseLibrary.length, 876);
  assert.equal(exerciseLibrary.length, provenance.count);
  assert.equal(new Set(exerciseLibrary.map((e) => e.id)).size, 876);
  exerciseLibrary.forEach((exercise, index) => {
    const original = data[index];
    assert.equal(exercise.id, original.id);
    assert.equal(exercise.name, original.name);
    assert.deepEqual(exercise.primaryMuscles, original.primaryMuscles);
    assert.deepEqual(exercise.secondaryMuscles, original.secondaryMuscles);
    assert.deepEqual(exercise.instructions, original.instructions);
    assert.equal(exercise.sourceEquipment, original.equipment);
    assert.equal(exercise.images.length, original.images.length);
    for (const url of exercise.images) {
      assert.ok(
        url.startsWith(
          `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${provenance.revision}/exercises/`,
        ),
      );
    }
  });
});

test('all upstream muscles map into the existing seven groups', () => {
  for (const exercise of exerciseLibrary) {
    for (const muscle of exercise.primaryMuscles) assert.ok(muscleMapping[muscle], muscle);
    assert.ok(muscleGroups.includes(exercise.muscle));
  }
});

test('full catalogue is reachable; name search handles punctuation and later entries', () => {
  assert.equal(searchExercises('').length, 876);
  assert.ok(searchExercises('push-up').length > 0);
  const last = exerciseLibrary.at(-1)!;
  assert.ok(searchExercises(last.name).some((exercise) => exercise.id === last.id));
  assert.deepEqual(searchExercises('تمرين غير موجود'), []);
  assert.deepEqual(searchExercises('no-such-exercise-987654321'), []);
});

test('muscle and equipment filters retain their previous behaviour', () => {
  for (const muscle of muscleGroups) assert.ok(searchExercises('', muscle).every((e) => e.muscle === muscle));
  assert.equal(canDoExercise('Bodyweight', []), true);
  assert.equal(canDoExercise('Dumbbells', ['dumbbells']), true);
  assert.equal(canDoExercise('Barbell', ['dumbbells']), false);
  assert.equal(canDoExercise('Resistance bands', ['bands']), true);
  assert.equal(canDoExercise('Unspecified equipment', ['bodyweight']), false);
  assert.ok(
    searchExercises('', 'all', ['dumbbells']).every((e) => ['Bodyweight', 'Dumbbells'].includes(e.equipment)),
  );
});

test('new workout exercises fit the old schema without copying source metadata', () => {
  for (const exercise of exerciseLibrary) {
    const selected = workoutExerciseFromCatalogue(exercise, 'personal-exercise');
    assert.deepEqual(
      Object.keys(selected).sort(),
      ['id', 'name', 'muscle', 'equipment', 'sets', 'reps', 'weight', 'restSeconds'].sort(),
    );
    const state = newLifeState();
    state.workouts.push({ id: 'plan', name: 'Test', exercises: [selected] });
    assert.deepEqual(validateRestorableLife(state), state);
  }
});

test('existing custom workouts, history and other areas survive an exercise addition and backup restore', () => {
  const initial = newLifeState();
  initial.workouts.push({
    id: 'old-plan',
    name: 'My original workout',
    exercises: [
      {
        id: 'my-original-id',
        name: 'My custom exercise',
        muscle: 'back',
        equipment: 'My equipment',
        sets: 4,
        reps: 8,
        weight: 32,
        restSeconds: 120,
      },
    ],
  });
  initial.sessions.push({
    id: 'old-session',
    workoutName: 'My original workout',
    date: '2026-10-14T10:00:00.000Z',
    exercises: [
      { name: 'My custom exercise', muscle: 'back', sets: [{ reps: 8, weight: 32, completed: true }] },
    ],
  });
  initial.pantry.push({ id: 'milk', name: 'Milk', quantity: '1 litre' });
  const before = structuredClone(initial);
  const plan = {
    ...initial.workouts[0],
    exercises: [
      ...initial.workouts[0].exercises,
      workoutExerciseFromCatalogue(exerciseLibrary[0], 'new-personal-id'),
    ],
  };
  const next = upsertRecord(initial, 'workouts', plan);
  const restored = validateRestorableLife(JSON.parse(JSON.stringify(next)));
  assert.deepEqual(initial, before);
  assert.deepEqual(restored.workouts[0].exercises[0], before.workouts[0].exercises[0]);
  assert.deepEqual(restored.sessions, before.sessions);
  assert.deepEqual(restored.pantry, before.pantry);
  assert.deepEqual(restored.wardrobe, before.wardrobe);
  assert.equal(restored.workouts[0].exercises.length, 2);
  assert.ok(!JSON.stringify(restored).includes('primaryMuscles'));
});

test('source omissions remain explicit, without invented instructions or images', () => {
  assert.deepEqual(
    exerciseLibrary.filter((e) => !e.instructions.length).map((e) => e.id),
    provenance.missingInstructions,
  );
  assert.deepEqual(
    exerciseLibrary.filter((e) => !e.images.length).map((e) => e.id),
    provenance.missingImages,
  );
  assert.ok(provenance.missingInstructions.length > 0);
  assert.ok(provenance.missingImages.length > 0);
});
