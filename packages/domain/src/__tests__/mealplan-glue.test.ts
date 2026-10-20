/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newLifeState, type LifeState } from '../life';
import { buildPlanInput, catalogueToPlanRecipes, planWeek } from '../mealplan';
import { ingredientIndex, lineGrams, loadCatalogue } from '../recipe-catalogue';

const START = '2026-10-19'; // a Monday

test('catalogue conversion: one PlanRecipe per recipe with grams, staples, flags and macros', async () => {
  const data = await loadCatalogue();
  const recipes = catalogueToPlanRecipes(data, 'en');
  assert.equal(recipes.length, data.recipes.length);
  assert.ok(recipes.length >= 200);

  const shak = recipes.find((r) => r.id === 'shakshuka')!;
  const raw = data.recipes.find((r) => r.id === 'shakshuka')!;
  assert.equal(shak.name, 'Shakshuka');
  assert.equal(shak.source, 'catalogue');
  assert.equal(shak.servings, 2);
  assert.equal(shak.prepMinutes + shak.cookMinutes, 30);
  assert.equal(shak.leftoverDays, raw.leftoverDays);
  assert.equal(shak.perServing.calories, raw.macrosPerServing.kcal);
  assert.equal(shak.perServing.protein, raw.macrosPerServing.protein);
  assert.equal(shak.costPerServing, raw.costPerServing);
  assert.deepEqual(shak.tags, raw.tags);
  assert.ok(shak.ingredients.length === raw.ingredients.length);

  const idx = ingredientIndex(data);
  const tomatoes = shak.ingredients.find((i) => i.ingredientId === 'tomatoes-canned')!;
  assert.equal(tomatoes.grams, 400);
  const eggs = shak.ingredients.find((i) => i.ingredientId === 'egg-whole-raw')!;
  assert.equal(eggs.grams, Math.round(lineGrams(idx.get('egg-whole-raw')!, 4, 'piece') * 100) / 100);
  assert.ok(eggs.grams > 150 && eggs.grams < 300);
  assert.equal(eggs.unit, 'piece');
  assert.ok(eggs.pieceGrams && eggs.pieceGrams > 30);
  assert.deepEqual(eggs.allergens, idx.get('egg-whole-raw')!.allergens);
  assert.equal(eggs.diet?.vegetarian, true);
  assert.equal(eggs.diet?.vegan, false);
  const oil = shak.ingredients.find((i) => i.ingredientId === 'olive-oil')!;
  assert.equal(oil.staple, true);
  assert.equal(oil.cost, 0);
  assert.equal(shak.ingredients.find((i) => i.ingredientId === 'harissa')!.optional, true);
  const cost = shak.ingredients.reduce((s, i) => s + (i.cost ?? 0), 0);
  assert.ok(
    cost > 0.5 && Math.abs(cost / shak.servings - shak.costPerServing) < 0.25,
    `recipe cost ${cost} vs ${shak.costPerServing}`,
  );
});

test('catalogue conversion: French names, every grams value finite, every id resolves', async () => {
  const data = await loadCatalogue();
  const fr = catalogueToPlanRecipes(data, 'fr');
  assert.equal(fr.find((r) => r.id === 'shakshuka')!.name, 'Chakchouka');
  for (const r of fr) {
    assert.ok(r.perServing.calories > 0, r.id);
    for (const i of r.ingredients) {
      assert.ok(Number.isFinite(i.grams) && i.grams > 0, `${r.id}/${i.ingredientId}`);
      assert.ok(i.name.length > 0);
    }
  }
  const vegan = catalogueToPlanRecipes(data, 'en').filter((r) => r.tags.includes('vegan'));
  assert.ok(vegan.length > 5);
  for (const r of vegan)
    for (const i of r.ingredients) assert.equal(i.diet?.vegan, true, `${r.id}/${i.ingredientId}`);
});

test('catalogue conversion: favourites by name', async () => {
  const data = await loadCatalogue();
  const r = catalogueToPlanRecipes(data, 'en', new Set(['shakshuka']));
  assert.equal(r.find((x) => x.id === 'shakshuka')!.favorite, true);
  assert.equal(r.find((x) => x.id === 'overnight-oats-berries')!.favorite, undefined);
});

const stateWith = (
  patch: Partial<LifeState> = {},
  settings: Partial<LifeState['settings']> = {},
): LifeState => {
  const s = newLifeState();
  return { ...s, ...patch, settings: { ...s.settings, ...settings } };
};

test('buildPlanInput: defaults and settings', async () => {
  const data = await loadCatalogue();
  const base = buildPlanInput(stateWith(), data, { startDate: START, lang: 'en' });
  assert.equal(base.people, 1);
  assert.equal(base.weeklyBudget, 0);
  assert.equal(base.targets, undefined);
  assert.equal(base.days, 7);
  assert.equal(base.cookMinutesByDay[START], 30);
  assert.equal(base.cookMinutesByDay['2026-10-24'], 60); // Saturday
  assert.deepEqual(base.diet, []);
  assert.equal(base.recipes.length, data.recipes.length);
  assert.ok(base.prices);

  const custom = buildPlanInput(
    stateWith(
      {},
      {
        people: 3,
        cookMinutesWeekday: 20,
        cookMinutesWeekend: 90,
        weeklyBudget: 75,
        currency: 'USD',
        priceLevel: 'low',
        diet: ['vegetarian', 'halal'],
        dislikes: ['olive'],
        calorieTarget: 2200,
        proteinTarget: 110,
        customPrices: { rice: 2 },
      },
    ),
    data,
    { startDate: START, lang: 'fr' },
  );
  assert.equal(custom.people, 3);
  assert.equal(custom.cookMinutesByDay[START], 20);
  assert.equal(custom.cookMinutesByDay['2026-10-25'], 90);
  assert.equal(custom.weeklyBudget, 75);
  assert.equal(custom.currency, 'USD');
  assert.equal(custom.priceLevel, 'low');
  assert.deepEqual(custom.diet, ['vegetarian', 'halal']);
  assert.deepEqual(custom.dislikes, ['olive']);
  assert.equal(custom.targets?.calories, 2200);
  assert.deepEqual(custom.customPrices, { rice: 2 });
  assert.equal(custom.recipes.find((r) => r.id === 'shakshuka')!.name, 'Chakchouka');
});

test('buildPlanInput: pantry with expiry, user recipes with favourites, recent meals and locks', async () => {
  const data = await loadCatalogue();
  const state = stateWith({
    pantry: [
      { id: 'p1', name: 'Rice', quantity: '1 kg', expiresOn: '2026-10-21', packGrams: 1000 },
      { id: 'p2', name: 'Milk', quantity: '1 l' },
    ],
    recipes: [
      {
        id: 'u1',
        name: 'Mum lentil soup',
        ingredients: ['200 g lentils', '1 onion'],
        steps: ['Cook'],
        calories: 400,
        protein: 20,
        carbs: 50,
        fat: 8,
        servings: 2,
        cookMinutes: 25,
        prepMinutes: 5,
      },
    ],
    meals: [
      {
        id: 'm1',
        name: 'Mum lentil soup',
        date: '2026-10-17',
        slot: 'dinner',
        calories: 400,
        protein: 20,
        carbs: 50,
        fat: 8,
        servings: 1,
        estimated: false,
        favorite: true,
      },
      {
        id: 'm2',
        name: 'Old pizza',
        date: '2026-10-01',
        slot: 'dinner',
        calories: 800,
        protein: 20,
        carbs: 90,
        fat: 30,
        servings: 1,
        estimated: false,
      },
      {
        id: 'm3',
        name: 'Future',
        date: START,
        slot: 'dinner',
        calories: 100,
        protein: 1,
        carbs: 1,
        fat: 1,
        servings: 1,
        estimated: false,
      },
    ],
    plannedMeals: [
      {
        id: 'pm1',
        date: '2026-10-20',
        slot: 'dinner',
        recipeId: 'shakshuka',
        recipeSource: 'catalogue',
        name: 'Shakshuka',
        servings: 1,
        locked: true,
      },
      { id: 'pm2', date: '2026-10-21', slot: 'dinner', recipeId: 'x', name: 'x', servings: 1 },
      { id: 'pm3', date: '2026-12-01', slot: 'dinner', recipeId: 'y', name: 'y', servings: 1, locked: true },
    ],
  });
  const input = buildPlanInput(state, data, { startDate: START, lang: 'en', overrides: { seed: 9 } });
  assert.deepEqual(input.pantry[0], {
    name: 'Rice',
    quantity: '1 kg',
    expiresOn: '2026-10-21',
    packGrams: 1000,
  });
  assert.deepEqual(input.pantry[1], { name: 'Milk', quantity: '1 l' });
  const user = input.recipes.find((r) => r.id === 'u1')!;
  assert.equal(user.source, 'user');
  assert.equal(user.favorite, true);
  assert.deepEqual(input.recentMeals, [{ name: 'Mum lentil soup', date: '2026-10-17' }]);
  assert.deepEqual(input.locked, { '2026-10-20|dinner': 'shakshuka' });
  assert.equal(input.seed, 9);
});

test('end to end: a week from the real catalogue respects minutes, diet and the locked meal', async () => {
  const data = await loadCatalogue();
  const state = stateWith(
    {
      pantry: [
        { id: 'p1', name: 'Rice', quantity: '1 kg' },
        { id: 'p2', name: 'Eggs', quantity: '6' },
      ],
      plannedMeals: [
        {
          id: 'pm1',
          date: '2026-10-20',
          slot: 'dinner',
          recipeId: 'shakshuka',
          name: 'Shakshuka',
          servings: 1,
          locked: true,
        },
      ],
    },
    { cookMinutesWeekday: 30, weeklyBudget: 60, currency: 'EUR', diet: ['vegetarian'], people: 2 },
  );
  const input = buildPlanInput(state, data, { startDate: START, lang: 'en' });
  const plan = planWeek(input);
  assert.equal(plan.days.length, 7);
  for (const d of plan.days)
    assert.ok(d.meals.reduce((s, m) => s + m.minutes, 0) <= input.cookMinutesByDay[d.date], d.date);
  const tue = plan.days.find((d) => d.date === '2026-10-20')!;
  assert.equal(tue.meals.find((m) => m.slot === 'dinner')!.recipeId, 'shakshuka');
  const byId = new Map(data.recipes.map((r) => [r.id, r]));
  for (const d of plan.days)
    for (const m of d.meals) assert.ok(byId.get(m.recipeId)!.tags.includes('vegetarian'), m.recipeId);
  assert.ok(plan.shopping.length > 0);
});
