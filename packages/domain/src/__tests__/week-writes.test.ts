import assert from 'node:assert/strict';
import test from 'node:test';
import { loadCatalogue } from '../recipe-catalogue';
import { newLifeState } from '../life';
import { logPlannedWrites, makeWeekWrites, swapPlannedWrites } from '../week-writes';

const state = () => {
  const s = newLifeState();
  s.settings.people = 2;
  s.settings.weeklyBudget = 60;
  s.settings.currency = 'EUR';
  s.settings.diet = ['vegetarian'];
  return s;
};

test('a new week plans meals for 7 days and writes its grocery list in one go', async () => {
  const catalogue = await loadCatalogue();
  const { writes, plan } = makeWeekWrites(state(), catalogue, { today: '2026-10-20', lang: 'fr', seed: 1 });
  assert.equal(plan.days.length, 7);
  const planned = writes.upserts.filter((w) => w.collection === 'plannedMeals');
  const groceries = writes.upserts.filter((w) => w.collection === 'groceries');
  assert.ok(planned.length >= 7);
  assert.ok(groceries.length > 0);
  assert.ok(planned.every((w) => (w.record as { date: string }).date.startsWith('2026-10')));
});

test('a vegetarian week has no meat recipe', async () => {
  const catalogue = await loadCatalogue();
  const { writes } = makeWeekWrites(state(), catalogue, { today: '2026-10-20', lang: 'fr', seed: 3 });
  const names = writes.upserts
    .filter((w) => w.collection === 'plannedMeals')
    .map((w) => (w.record as { name: string }).name);
  assert.ok(names.length >= 7);
  const meat = /poulet|bœuf|boeuf|porc|jambon|saumon|thon|dinde|lardons|chorizo|crevette/i;
  for (const name of names) assert.doesNotMatch(name, meat);
});

test('swapping a meal replaces only that meal', async () => {
  const catalogue = await loadCatalogue();
  const s = state();
  const first = makeWeekWrites(s, catalogue, { today: '2026-10-20', lang: 'fr', seed: 1 });
  s.plannedMeals = first.writes.upserts
    .filter((w) => w.collection === 'plannedMeals')
    .map((w) => w.record as (typeof s.plannedMeals)[number]);
  const target =
    s.plannedMeals.find((m) => m.date.startsWith('2026-10-20') && m.slot === 'lunch') ?? s.plannedMeals[0]!;
  const swapped = swapPlannedWrites(s, catalogue, target, { today: '2026-10-20', lang: 'fr', seed: 9 });
  const after = swapped.upserts
    .filter((w) => w.collection === 'plannedMeals')
    .map((w) => w.record as (typeof s.plannedMeals)[number]);
  const replaced = after.find(
    (m) => m.date.slice(0, 10) === target.date.slice(0, 10) && m.slot === target.slot,
  );
  assert.ok(replaced);
  assert.notEqual(replaced.recipeId, target.recipeId);
});

test('"OK" on a planned meal logs it in the food journal', async () => {
  const catalogue = await loadCatalogue();
  const s = state();
  const first = makeWeekWrites(s, catalogue, { today: '2026-10-20', lang: 'fr', seed: 1 });
  const planned = first.writes.upserts.find((w) => w.collection === 'plannedMeals')!
    .record as (typeof s.plannedMeals)[number];
  const writes = logPlannedWrites(s, catalogue, planned, 'meal-1');
  assert.equal(writes.upserts.length, 1);
  assert.equal(writes.upserts[0]!.collection, 'meals');
  assert.equal((writes.upserts[0]!.record as { name: string }).name, planned.name);
});
