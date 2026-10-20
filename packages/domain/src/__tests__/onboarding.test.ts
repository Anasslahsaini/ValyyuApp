import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newLifeState } from '../life';
import { EQUIPMENT_FOR, settingsPatch } from '../onboarding';

const settings = () => newLifeState().settings;

test('a fully skipped onboarding only marks it done', () => {
  const p = settingsPatch({}, settings(), 2026, '2026-10-18T10:00:00.000Z');
  assert.equal(p.onboardedAt, '2026-10-18T10:00:00.000Z');
  assert.equal(p.calorieTarget, undefined);
  assert.equal(p.firstName, undefined);
});

test('answers fill targets, equipment and sessions', () => {
  const p = settingsPatch(
    {
      firstName: '  Sara ',
      mainGoal: 'muscle',
      sex: 'female',
      age: 30,
      heightCm: 165,
      weightKg: 60,
      trainingPlace: 'gym',
    },
    settings(),
    2026,
  );
  assert.equal(p.firstName, 'Sara');
  assert.equal(p.goal, 'muscle');
  assert.equal(p.birthYear, 1996);
  assert.deepEqual(p.equipment, EQUIPMENT_FOR.gym);
  assert.equal(p.sessionsPerWeek, 3);
  assert.ok(p.calorieTarget && p.calorieTarget > 1500);
  assert.equal(p.proteinTarget, 96);
});

test('no sport means 0 sessions; editing keeps the first onboarding date', () => {
  const current = { ...settings(), onboardedAt: '2026-01-01T00:00:00.000Z' };
  const p = settingsPatch(
    { trainingPlace: 'none', sessionsPerWeek: 4 },
    current,
    2026,
    '2026-10-18T00:00:00.000Z',
  );
  assert.equal(p.sessionsPerWeek, 0);
  assert.equal(p.onboardedAt, '2026-01-01T00:00:00.000Z');
});

test('currency follows the phone only while still the default', () => {
  assert.equal(settingsPatch({}, settings(), 2026, undefined, 'EUR').currency, 'EUR');
  assert.equal(
    settingsPatch({}, { ...settings(), currency: 'GBP' }, 2026, undefined, 'EUR').currency,
    undefined,
  );
});

test('minors never get a deficit', () => {
  const teen = settingsPatch(
    { mainGoal: 'lose', sex: 'male', age: 15, heightCm: 170, weightKg: 60 },
    settings(),
    2026,
  );
  const same = settingsPatch(
    { mainGoal: 'maintain', sex: 'male', age: 15, heightCm: 170, weightKg: 60 },
    settings(),
    2026,
  );
  assert.equal(teen.calorieTarget, same.calorieTarget);
});
