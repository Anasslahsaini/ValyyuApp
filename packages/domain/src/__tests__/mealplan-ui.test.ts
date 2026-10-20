/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newLifeState } from '../life';
import {
  activePlanRange,
  applyPlanToPlannedMeals,
  buildPlanInput,
  expiryChipDate,
  expiryStatus,
  ingredientAmount,
  lockMeal,
  money,
  parseExpiry,
  planWeek,
  planWrites,
  restorePlan,
  swapMeal,
} from '../mealplan';
import { loadCatalogue } from '../recipe-catalogue';

const START = '2026-10-19';
const setup = async (settings = {}) => {
  const data = await loadCatalogue();
  const state = newLifeState();
  state.settings = { ...state.settings, ...settings };
  const input = buildPlanInput(state, data, { startDate: START, lang: 'en', overrides: { seed: 3 } });
  return { data, state, input, plan: planWeek(input) };
};

test('money formats in the app language and survives odd currency codes', () => {
  assert.match(money(52, 'EUR', 'en'), /€\s?52/);
  assert.match(money(52, 'EUR', 'fr'), /52\s?€/);
  assert.equal(money(52, '$$', 'en'), '52 $$');
  assert.equal(money(Number.NaN, 'EUR', 'en'), '€0');
});

test('activePlanRange: yesterday onwards, at most 7 days, null when nothing is current', () => {
  const pm = (date: string) => ({ id: `pm-${date}`, date, slot: 'lunch' as const, name: 'x', servings: 1 });
  assert.equal(activePlanRange([], '2026-10-22'), null);
  assert.equal(activePlanRange([pm('2026-10-01')], '2026-10-22'), null);
  assert.deepEqual(activePlanRange([pm('2026-10-19'), pm('2026-10-25')], '2026-10-22'), {
    start: '2026-10-25',
    days: 1,
  });
  assert.deepEqual(activePlanRange([pm('2026-10-21'), pm('2026-10-25')], '2026-10-22'), {
    start: '2026-10-21',
    days: 5,
  });
  assert.deepEqual(activePlanRange([pm('2026-10-21'), pm('2026-11-25')], '2026-10-22'), {
    start: '2026-10-21',
    days: 7,
  });
});

test('restorePlan reproduces a saved plan (same meals, minutes within limits, lock flags kept)', async () => {
  const { data, state, input, plan } = await setup({ weeklyBudget: 80 });
  let withLock = lockMeal(plan, `${START}|dinner`);
  withLock = lockMeal(withLock, '2026-10-21|lunch');
  const saved = applyPlanToPlannedMeals(withLock);
  const restored = restorePlan(
    buildPlanInput({ ...state, plannedMeals: saved }, data, { startDate: START, lang: 'en' }),
    saved,
  );
  const flat = (p: typeof plan) =>
    p.days.flatMap((d) =>
      d.meals.map((m) => `${d.date}|${m.slot}|${m.recipeId}|${!!m.leftover}|${!!m.locked}`),
    );
  assert.deepEqual(flat(restored), flat(withLock));
  for (const d of restored.days)
    assert.ok(d.meals.reduce((s, m) => s + m.minutes, 0) <= input.cookMinutesByDay[d.date]);
  assert.equal(restored.totals.cost, withLock.totals.cost);
});

test('planWrites replaces the dates covered and removes stale entries in the same save', async () => {
  const { plan } = await setup();
  const first = applyPlanToPlannedMeals(plan);
  const stale = {
    id: 'pm-2026-10-20-snack',
    date: '2026-10-20',
    slot: 'snack' as const,
    name: 'old',
    servings: 1,
  };
  const outside = {
    id: 'pm-2026-12-01-lunch',
    date: '2026-12-01',
    slot: 'lunch' as const,
    name: 'later',
    servings: 1,
  };
  const w = planWrites([...first, stale, outside], plan);
  assert.equal(w.upserts.length, first.length);
  assert.deepEqual(w.deletes, ['pm-2026-10-20-snack']);
});

test('swapping one meal keeps the other meals', async () => {
  const { input, plan } = await setup();
  const key = `${START}|dinner`;
  const swapped = swapMeal(plan, input, key, 77);
  const dinner = (p: typeof plan) => p.days[0].meals.find((m) => m.slot === 'dinner')!.recipeId;
  assert.notEqual(dinner(swapped), dinner(plan));
  const cells = (p: typeof plan) =>
    p.days.flatMap((d) =>
      d.meals
        .filter((m) => `${d.date}|${m.slot}` !== key && m.batchOf !== key)
        .map((m) => `${d.date}|${m.slot}|${m.recipeId}`),
    );
  const after = new Set(cells(swapped));
  const missing = cells(plan).filter((x) => !after.has(x));
  assert.deepEqual(missing, []);
});

test('a very low budget produces the budget warning and never exceeds daily minutes', async () => {
  const { input } = await setup({ weeklyBudget: 3 });
  const plan = planWeek(input);
  assert.ok(plan.warnings.includes('budget_infeasible'));
  for (const d of plan.days)
    assert.ok(d.meals.reduce((s, m) => s + m.minutes, 0) <= input.cookMinutesByDay[d.date]);
});

test('ingredientAmount: pieces, grams, kilograms, millilitres, unknown', () => {
  assert.equal(ingredientAmount({ grams: 220, unit: 'piece', pieceGrams: 55 }, 1), '4');
  assert.equal(ingredientAmount({ grams: 60, unit: 'piece', pieceGrams: 120 }, 1), '½');
  assert.equal(ingredientAmount({ grams: 180, unit: 'piece', pieceGrams: 120 }, 1), '1½');
  assert.equal(ingredientAmount({ grams: 400, unit: 'g' }, 1.5), '600 g');
  assert.equal(ingredientAmount({ grams: 1500, unit: 'g' }, 1), '1.5 kg');
  assert.equal(ingredientAmount({ grams: 15, unit: 'ml', gramsPerMl: 0.92 }, 1), '16 ml');
  assert.equal(ingredientAmount({ grams: 1030, unit: 'ml', gramsPerMl: 1.03 }, 1), '1 l');
  assert.equal(ingredientAmount({ grams: 0, unit: 'g' }, 2), '');
});

test('pantry expiry: statuses, chips and strict date parsing', () => {
  const today = '2026-10-15';
  assert.equal(expiryStatus(undefined, today), undefined);
  assert.equal(expiryStatus('2026-10-14', today), 'expired');
  assert.equal(expiryStatus('2026-10-15', today), 'soon');
  assert.equal(expiryStatus('2026-10-18', today), 'soon');
  assert.equal(expiryStatus('2026-10-19', today), 'ok');
  assert.equal(expiryChipDate('tomorrow', today), '2026-10-16');
  assert.equal(expiryChipDate('threeDays', today), '2026-10-18');
  assert.equal(expiryChipDate('week', today), '2026-10-22');
  assert.equal(parseExpiry(''), '');
  assert.equal(parseExpiry(' 2026-10-18 '), '2026-10-18');
  assert.equal(parseExpiry('2026-02-30'), null);
  assert.equal(parseExpiry('18/10/2026'), null);
});

test('deleting a user recipe removes its planned meals only', async () => {
  const { deleteRecord } = await import('../life');
  const state = newLifeState();
  state.plannedMeals = [
    { id: 'a', date: START, slot: 'lunch', recipeId: 'u1', recipeSource: 'user', name: 'Mine', servings: 1 },
    {
      id: 'b',
      date: START,
      slot: 'dinner',
      recipeId: 'u1',
      recipeSource: 'catalogue',
      name: 'Same id, catalogue',
      servings: 1,
    },
    {
      id: 'c',
      date: START,
      slot: 'breakfast',
      recipeId: 'u2',
      recipeSource: 'user',
      name: 'Other',
      servings: 1,
    },
  ];
  assert.deepEqual(
    deleteRecord(state, 'recipes', 'u1').plannedMeals.map((m) => m.id),
    ['b', 'c'],
  );
});

test('journal entry for a planned meal: slot, date, link, macros from catalogue or user recipe, unknown otherwise', async () => {
  const { entryForPlannedMeal, isPlannedMealDone } = await import('../mealplan');
  const { MealEntrySchema } = await import('../life');
  const data = await loadCatalogue();
  const raw = data.recipes.find((r) => r.id === 'shakshuka')!;
  const cat = entryForPlannedMeal(
    { date: START, slot: 'dinner', name: 'Shakshuka', recipeId: 'shakshuka', recipeSource: 'catalogue' },
    { recipes: [], catalogue: data },
    'e1',
  );
  assert.equal(cat.slot, 'dinner');
  assert.equal(cat.date, START);
  assert.equal(cat.calories, raw.macrosPerServing.kcal);
  assert.equal(cat.servings, 1);
  assert.deepEqual(cat.unknownNutrients, []);
  MealEntrySchema.parse(cat);
  assert.equal(isPlannedMealDone([cat], { date: START, slot: 'dinner' }), true);
  assert.equal(isPlannedMealDone([cat], { date: START, slot: 'lunch' }), false);
  const user = entryForPlannedMeal(
    { date: START, slot: 'lunch', name: 'Mine', recipeId: 'u1', recipeSource: 'user' },
    {
      recipes: [
        {
          id: 'u1',
          name: 'Mine',
          ingredients: [],
          steps: [],
          calories: 500,
          protein: 30,
          carbs: 40,
          fat: 10,
        },
      ],
      catalogue: null,
    },
    'e2',
  );
  assert.equal(user.calories, 500);
  const lost = entryForPlannedMeal(
    { date: START, slot: 'lunch', name: 'Gone', recipeId: 'zz', recipeSource: 'user' },
    { recipes: [], catalogue: null },
    'e3',
  );
  assert.equal(lost.unknownNutrients?.length, 4);
  MealEntrySchema.parse(lost);
});
