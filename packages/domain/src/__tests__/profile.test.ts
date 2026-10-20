import assert from 'node:assert/strict';
import test from 'node:test';
import { editProfile, withdrawHealthConsent } from '../first-launch/profile';
import { newLifeState } from '../life';

const adult = () => {
  const s = newLifeState();
  s.settings.birthYear = 1995;
  s.settings.sex = 'male';
  s.settings.heightCm = 180;
  s.settings.healthConsentAt = '2026-10-01T00:00:00.000Z';
  s.weightEntries.push({ id: 'w1', date: '2026-10-01', weight: 80 });
  return s;
};

test('editing the goal of an adult with consent recomputes the calories', () => {
  const patch = editProfile(adult(), { mainGoal: 'lose' }, { year: 2026 });
  assert.equal(patch.mainGoal, 'lose');
  assert.ok((patch.calorieTarget ?? 0) > 1000);
});

test('a 16-year-old choosing "lose" keeps "maintain" and gets no calorie target', () => {
  const s = adult();
  s.settings.birthYear = 2010;
  const patch = editProfile(s, { mainGoal: 'lose' }, { year: 2026 });
  assert.equal(patch.mainGoal, 'maintain');
  assert.equal(patch.calorieTarget, 0);
});

test('withdrawing consent removes body data, targets and the weight history', () => {
  const s = adult();
  const { patch, writes } = withdrawHealthConsent(s);
  assert.equal(patch.healthConsentAt, undefined);
  assert.ok('heightCm' in patch && patch.heightCm === undefined);
  assert.equal(patch.calorieTarget, 0);
  assert.deepEqual(writes.deletes, [{ collection: 'weightEntries', id: 'w1' }]);
});
