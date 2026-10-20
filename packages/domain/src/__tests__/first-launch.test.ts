import assert from 'node:assert/strict';
import test from 'node:test';
import { finishFirstLaunch, planSummary } from '../first-launch/finish';
import { newLifeState } from '../life';

const year = 2026;
const now = '2026-10-20T10:00:00.000Z';
const adult = {
  firstName: 'Rayan',
  age: 25,
  mainGoal: 'maintain',
  sex: 'male',
  heightCm: 170,
  weightKg: 70,
  people: 2,
  weeklyBudget: 60,
  diet: [],
  trainingPlace: 'home',
  sessionsPerWeek: 3,
  allergies: ['dairy'],
} as const;
const settings = () => newLifeState().settings;

test('adult with consent: health data and calorie targets are kept', () => {
  const patch = finishFirstLaunch({ ...adult, allergies: [...adult.allergies], diet: [] }, true, settings(), {
    year,
    now,
  });
  assert.equal(patch.healthConsentAt, now);
  assert.equal(patch.heightCm, 170);
  assert.deepEqual(patch.allergies, ['dairy']);
  assert.ok((patch.calorieTarget ?? 0) > 1500);
  assert.equal(patch.onboardedAt, now);
});

test('no consent: no height, weight, allergies, pain, sex or calories', () => {
  const patch = finishFirstLaunch(
    { ...adult, allergies: ['dairy'], diet: [], injuries: ['knee'] },
    false,
    settings(),
    { year, now },
  );
  assert.equal(patch.healthConsentAt, undefined);
  for (const key of ['heightCm', 'sex', 'allergies', 'injuries', 'calorieTarget', 'proteinTarget'] as const)
    assert.equal(patch[key], undefined, key);
  assert.equal(patch.firstName, 'Rayan');
  assert.equal(patch.weeklyBudget, 60);
});

test('minor who wants to lose weight: goal becomes keep fit, and no calorie target at all', () => {
  const patch = finishFirstLaunch(
    { ...adult, age: 16, mainGoal: 'lose', allergies: [], diet: [] },
    true,
    settings(),
    { year, now },
  );
  assert.equal(patch.mainGoal, 'maintain');
  assert.equal(patch.calorieTarget, undefined);
  assert.equal(patch.heightCm, 170);
});

test('under 15: refuses to build a profile', () => {
  assert.throws(
    () => finishFirstLaunch({ ...adult, age: 13, allergies: [], diet: [] }, true, settings(), { year, now }),
    /15/,
  );
});

test('"sans porc" is kept as a food to avoid', () => {
  const patch = finishFirstLaunch({ ...adult, allergies: [], diet: [], noPork: true }, true, settings(), {
    year,
    now,
  });
  assert.ok(patch.dislikes?.includes('porc'));
});

test('planSummary says which plan card to show', () => {
  assert.equal(planSummary({ age: 25 }, true, 2250).kind, 'calories');
  assert.deepEqual(planSummary({ age: 25 }, true, 2250), { kind: 'calories', calories: 2250 });
  assert.equal(planSummary({ age: 25 }, false, undefined).kind, 'noConsent');
  assert.equal(planSummary({ age: 16 }, true, undefined).kind, 'minor');
});
