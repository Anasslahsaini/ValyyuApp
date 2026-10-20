/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeWorkspaces } from '@workspace/life-data';
import {
  LifeSchema,
  lifeCollections,
  newLifeState,
  upsertRecord,
  deleteRecord,
  validateRestorableLife,
  type PlannedMeal,
} from '../life';
import { parseWorkspaceBackup, restorePortableWorkspace, serializeWorkspaceBackup } from '../life-backup';

const pm = (over: Partial<PlannedMeal> = {}): PlannedMeal => ({
  id: 'p1',
  date: '2026-10-19',
  slot: 'dinner',
  name: 'Shakshuka',
  servings: 2,
  recipeId: 'shakshuka',
  recipeSource: 'catalogue',
  minutes: 30,
  costEstimate: 3.2,
  ...over,
});
function withPlan() {
  let s = upsertRecord(newLifeState(), 'plannedMeals', pm());
  s = upsertRecord(s, 'plannedMeals', pm({ id: 'p2', slot: 'lunch', leftover: true, locked: true }));
  s.settings = {
    ...s.settings,
    people: 2,
    cookMinutesWeekday: 25,
    cookMinutesWeekend: 90,
    diet: ['vegan', 'gluten_free'],
    dislikes: ['coriander'],
    priceLevel: 'low',
    customPrices: { rice: 2.5, 'olive oil': 9 },
  };
  return s;
}
test('plannedMeals is a registered collection and part of a new workspace', () => {
  assert.ok(lifeCollections.includes('plannedMeals'));
  assert.deepEqual(newLifeState().plannedMeals, []);
});
test('Old stored state without plannedMeals or new settings still parses with defaults', () => {
  const old: Record<string, unknown> = { ...newLifeState() };
  delete old.plannedMeals;
  const parsed = LifeSchema.parse(old);
  assert.deepEqual(parsed.plannedMeals, []);
  assert.equal(parsed.settings.people, undefined);
});
test('Backup round trip keeps planned meals and planner settings', async () => {
  const original = withPlan();
  const backup = parseWorkspaceBackup(await serializeWorkspaceBackup(original, false, async (u) => u));
  const restored = await restorePortableWorkspace(
    backup.workspace,
    async (u) => u,
    () => {},
    async () => {},
  );
  assert.deepEqual(restored, original);
});
test('An old-format backup without plannedMeals restores with an empty plan', () => {
  const ws: Record<string, unknown> = { ...newLifeState() };
  delete ws.plannedMeals;
  const contents = JSON.stringify({
    format: 'valyyu-workspace',
    version: 2,
    exportedAt: new Date().toISOString(),
    photosIncluded: false,
    workspace: ws,
  });
  assert.deepEqual(parseWorkspaceBackup(contents).workspace.plannedMeals, []);
  assert.deepEqual(validateRestorableLife(ws).plannedMeals, []);
});
test('Settings bounds are enforced', () => {
  const bad = (patch: object) =>
    assert.throws(() =>
      LifeSchema.parse({ ...newLifeState(), settings: { ...newLifeState().settings, ...patch } }),
    );
  bad({ people: 0 });
  bad({ people: 13 });
  bad({ cookMinutesWeekday: 241 });
  bad({ diet: ['carnivore'] });
  bad({ priceLevel: 'ultra' });
  bad({ dislikes: ['x'.repeat(61)] });
  bad({ dislikes: Array(31).fill('a') });
  bad({ customPrices: { rice: -1 } });
});
test('Duplicate planned meal IDs are rejected on restore', () => {
  const s = withPlan();
  s.plannedMeals = [pm(), pm()];
  assert.throws(() => validateRestorableLife(s), /duplicate/i);
});
test('Unknown fields on planned meals are rejected in backups', () => {
  const s = JSON.parse(JSON.stringify(withPlan()));
  s.plannedMeals[0].secret = 1;
  assert.throws(() => validateRestorableLife(s));
});
test('Merge: new remote plan entries are added, identical ones ignored', () => {
  const local = withPlan(),
    remote = withPlan();
  remote.plannedMeals.push(pm({ id: 'p3', date: '2026-10-20' }));
  assert.equal(mergeWorkspaces(local, remote).plannedMeals.length, 3);
});
test('Merge: conflicting plan edits never throw; local wins, locked remote beats unlocked local', () => {
  const local = newLifeState(),
    remote = newLifeState();
  local.plannedMeals = [pm({ name: 'Local' })];
  remote.plannedMeals = [pm({ name: 'Remote' }), pm({ id: 'q', locked: true, name: 'RemoteLocked' })];
  const merged = mergeWorkspaces(local, remote);
  assert.equal(merged.plannedMeals.length, 1);
  assert.equal(merged.plannedMeals[0].name, 'RemoteLocked');
  const l2 = newLifeState();
  l2.plannedMeals = [pm({ name: 'Local' })];
  const r2 = newLifeState();
  r2.plannedMeals = [pm({ name: 'Remote' })];
  assert.equal(mergeWorkspaces(l2, r2).plannedMeals[0].name, 'Local');
});
test('Merge still refuses conflicting edits in other collections and tolerates old remote shapes', () => {
  const local = newLifeState(),
    remote = newLifeState();
  local.pantry = [{ id: 'a', name: 'Rice', quantity: '1 kg' }];
  remote.pantry = [{ id: 'a', name: 'Rice', quantity: '2 kg' }];
  assert.throws(() => mergeWorkspaces(local, remote), /Conflicting pantry/);
  const oldRemote = JSON.parse(JSON.stringify(newLifeState()));
  delete oldRemote.plannedMeals;
  assert.equal(mergeWorkspaces(withPlan(), oldRemote).plannedMeals.length, 2);
});
test('Deleting a planned meal only removes it; clearing the workspace yields an empty plan', () => {
  const s = deleteRecord(withPlan(), 'plannedMeals', 'p1');
  assert.deepEqual(
    s.plannedMeals.map((m) => m.id),
    ['p2'],
  );
  assert.deepEqual(newLifeState().plannedMeals, []);
});
test('Plan size limit is 5000 records', () => {
  const s = newLifeState();
  s.plannedMeals = Array.from({ length: 5001 }, (_, i) => pm({ id: `m${i}` }));
  assert.throws(() => LifeSchema.parse(s));
});
