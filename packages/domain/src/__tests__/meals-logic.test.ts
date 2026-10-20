/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeText, searchFoods, type FoodItem } from '../food-search';
import {
  copySlot,
  favoriteMeals,
  isFavoriteName,
  macrosForGrams,
  mealFromRecipe,
  recentMeals,
  relogMeal,
  slotForTime,
  toggleFavorite,
  totalLabel,
  unknownFromFields,
} from '../nutrition';
import {
  findPantryItem,
  ingredientTokens,
  inPantry,
  pantryCoverage,
  pantryItemsUsed,
  singular,
} from '../pantry-match';
import { buildGroceries, parseIngredient } from '../grocery-builder';
import { BarcodeLookupError, apiUrl, isValidBarcode, lookupBarcode, productLabel } from '../openfoodfacts';
import foods from '../../data/usda-fdc/foods.json';
import source from '../../data/usda-fdc/source.json';

type Meal = Parameters<typeof relogMeal>[0];
const meal = (o: Partial<Meal> & { id: string; name: string; date: string }): Meal => ({
  slot: 'lunch',
  calories: 100,
  protein: 1,
  carbs: 1,
  fat: 1,
  servings: 1,
  estimated: false,
  ...o,
});

test('normalizeText folds accents, case, ligatures and punctuation', () => {
  assert.equal(normalizeText('Crème Brûlée, ŒUFS'), 'creme brulee oeufs');
  assert.equal(normalizeText('  Pâtes  (sèches) '), 'pates seches');
});

test('food search: prefix tokens, accents, order-free, generic names first', () => {
  const items = [
    { name: 'Eggplant, raw' },
    { name: 'Egg, whole, raw, fresh' },
    { name: 'Egg, yolk, raw, fresh' },
    { name: 'Pâtes alimentaires' },
    { name: 'Yogurt, Greek, plain, nonfat' },
    { name: 'Banana, raw', fr: 'Banane' },
  ];
  const by = (q: string) =>
    searchFoods(items, q, (x) => [x.name, (x as { fr?: string }).fr]).map((x) => x.name);
  assert.equal(by('egg')[0], 'Egg, whole, raw, fresh');
  assert.ok(by('egg').includes('Eggplant, raw'), 'prefix still finds eggplant, ranked lower');
  assert.deepEqual(by('egg yolk'), ['Egg, yolk, raw, fresh']);
  assert.deepEqual(by('PATES'), ['Pâtes alimentaires']);
  assert.deepEqual(by('greek yog'), ['Yogurt, Greek, plain, nonfat']);
  assert.deepEqual(by('banane'), ['Banana, raw']);
  assert.deepEqual(by('xyz'), []);
  assert.deepEqual(by('   '), []);
});

test('USDA subset is well-formed, small and documented', () => {
  const list = foods as FoodItem[];
  assert.ok(list.length >= 250, `got ${list.length}`);
  assert.equal(new Set(list.map((f) => f.id)).size, list.length);
  for (const f of list) {
    assert.ok(f.name && f.id);
    for (const k of ['kcal', 'p', 'c', 'f'] as const)
      assert.ok(Number.isFinite(f[k]) && f[k] >= 0 && f[k] <= 900, `${f.name} ${k}`);
    // Energy roughly agrees with Atwater factors (catches transcription slips).
    const atwater = 4 * f.p + 4 * f.c + 9 * f.f;
    if (f.kcal > 40)
      assert.ok(Math.abs(atwater - f.kcal) / f.kcal < 0.3, `${f.name}: ${f.kcal} vs ${atwater}`);
    for (const p of f.portions ?? []) assert.ok(p.label && p.g > 0);
  }
  assert.ok(JSON.stringify(list).length < 1_500_000);
  assert.ok(source.license && source.mode);
  const egg = searchFoods(list, 'egg', (f) => [f.name, f.fr])[0];
  assert.match(egg.name, /^Egg/);
});

test('macrosForGrams scales per-100 g values', () => {
  assert.deepEqual(macrosForGrams({ calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 }, 50), {
    calories: 72,
    protein: 6.3,
    carbs: 0.4,
    fat: 4.8,
  });
  assert.deepEqual(macrosForGrams({ calories: 100, protein: 1, carbs: 1, fat: 1 }, -5), {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
});

test('blank fields are unknown, not zero; recipes keep their unknowns', () => {
  assert.deepEqual(unknownFromFields({ calories: '300', protein: ' ', carbs: '', fat: '0' }), [
    'protein',
    'carbs',
  ]);
  const m = mealFromRecipe({
    name: 'Soup',
    calories: 200,
    protein: 0,
    carbs: 0,
    fat: 0,
    unknownNutrients: ['protein'],
  });
  assert.equal(m.servings, 1);
  assert.deepEqual(m.unknownNutrients, ['protein']);
});

test('slotForTime picks the likely meal', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 15, h, m);
  assert.equal(slotForTime(at(7)), 'breakfast');
  assert.equal(slotForTime(at(12, 30)), 'lunch');
  assert.equal(slotForTime(at(16)), 'snack');
  assert.equal(slotForTime(at(19)), 'dinner');
  assert.equal(slotForTime(at(23, 30)), 'snack');
});

test('recents are unique by name, frequent first, newest template kept', () => {
  const meals = [
    meal({ id: '1', name: 'Oatmeal', date: '2026-10-10', calories: 300 }),
    meal({ id: '2', name: 'oatmeal ', date: '2026-10-12', calories: 320 }),
    meal({ id: '3', name: 'Oatmeal', date: '2026-10-13', calories: 310 }),
    meal({ id: '4', name: 'Pizza', date: '2026-10-14' }),
    meal({ id: '5', name: 'Old soup', date: '2026-08-01' }),
    meal({ id: '6', name: 'Old soup', date: '2026-08-02' }),
  ];
  const r = recentMeals(meals);
  assert.deepEqual(
    r.map((m) => m.id),
    ['3', '4', '6'],
  );
  assert.equal(recentMeals(meals, 1).length, 1);
});

test('favourites are by name; toggling clears every starred copy', () => {
  const meals = [
    meal({ id: 'a', name: 'Salad', date: '2026-10-01', favorite: true }),
    meal({ id: 'b', name: 'Salad', date: '2026-10-05', favorite: true }),
    meal({ id: 'c', name: 'Toast', date: '2026-10-05' }),
  ];
  assert.deepEqual(
    favoriteMeals(meals).map((m) => m.id),
    ['b'],
  );
  assert.ok(isFavoriteName(meals, 'salad'));
  assert.deepEqual(
    toggleFavorite(meals, meals[0]).map((m) => [m.id, m.favorite]),
    [
      ['a', false],
      ['b', false],
    ],
  );
  assert.deepEqual(
    toggleFavorite(meals, meals[2]).map((m) => [m.id, m.favorite]),
    [['c', true]],
  );
});

test('relog and copy-yesterday keep portion and macros on the new day and slot', () => {
  const src = meal({
    id: 'x',
    name: 'Rice',
    date: '2026-10-14',
    slot: 'dinner',
    grams: 150,
    foodRef: { source: 'usda', id: 'rice' },
    favorite: true,
    calories: 195,
  });
  const copy = relogMeal(src, '2026-10-15', 'lunch', 'y');
  assert.equal(copy.id, 'y');
  assert.equal(copy.slot, 'lunch');
  assert.equal(copy.grams, 150);
  assert.equal(copy.calories, 195);
  assert.equal(copy.favorite, undefined);
  let n = 0;
  const copied = copySlot(
    [src, meal({ id: 'z', name: 'Tea', date: '2026-10-14', slot: 'breakfast' })],
    '2026-10-14',
    '2026-10-15',
    'dinner',
    () => `n${++n}`,
  );
  assert.deepEqual(
    copied.map((m) => [m.id, m.date, m.name]),
    [['n1', '2026-10-15', 'Rice']],
  );
});

test('pantry matching is token based, plural aware and accent-insensitive', () => {
  assert.equal(singular('tomatoes'), 'tomato');
  assert.equal(singular('berries'), 'berry');
  assert.equal(singular('poireaux'), 'poireau');
  assert.equal(singular('asparagus'), 'asparagus');
  assert.deepEqual(ingredientTokens('2 tbsp extra-virgin Olive Oil (cold)'), [
    'extra',
    'virgin',
    'olive',
    'oil',
  ]);
  assert.deepEqual(ingredientTokens('1 c. à soupe de café moulu'), ['cafe', 'moulu']);
  const pantry = [
    { name: 'Egg' },
    { name: 'Olive oil' },
    { name: 'Crème fraîche' },
    { name: 'Chicken breast' },
    { name: 'Pommes' },
  ];
  assert.ok(inPantry('3 eggs', pantry));
  assert.ok(inPantry('2 œufs', [{ name: 'oeuf' }]));
  assert.ok(!inPantry('1 eggplant', pantry), 'egg must not match eggplant');
  assert.ok(inPantry('2 tbsp olive oil', pantry));
  assert.ok(inPantry('200 ml creme fraiche', pantry));
  assert.ok(inPantry('chicken', pantry));
  assert.ok(!inPantry('500 g pommes de terre', pantry), 'potatoes are not apples');
  assert.ok(!inPantry('salt', pantry));
  assert.equal(findPantryItem('olive oil', [{ name: 'oil' }, { name: 'olive oil' }])?.name, 'olive oil');
  assert.deepEqual(pantryCoverage(['eggs', 'salt', 'olive oil', 'eggplant'], pantry), {
    have: 2,
    total: 4,
    ratio: 0.5,
  });
  assert.deepEqual(pantryCoverage([], pantry), { have: 0, total: 0, ratio: 0 });
  const used = pantryItemsUsed(
    ['2 eggs', '1 egg yolk', 'salt'],
    [
      { id: 'e', name: 'eggs' },
      { id: 's', name: 'sugar' },
    ],
  );
  assert.deepEqual(
    used.map((p) => p.id),
    ['e'],
  );
});

test('parseIngredient reads common quantity formats', () => {
  assert.deepEqual(parseIngredient('200 g flour'), { qty: 200, unit: 'g', name: 'flour' });
  assert.deepEqual(parseIngredient('200g flour'), { qty: 200, unit: 'g', name: 'flour' });
  assert.deepEqual(parseIngredient('1,5 kg de pommes de terre'), {
    qty: 1500,
    unit: 'g',
    name: 'pommes de terre',
  });
  assert.deepEqual(parseIngredient('1 ½ cups milk'), { qty: 360, unit: 'ml', name: 'milk' });
  assert.deepEqual(parseIngredient('1/2 cup of sugar'), { qty: 120, unit: 'ml', name: 'sugar' });
  assert.deepEqual(parseIngredient('2-3 tomatoes'), { qty: 3, unit: undefined, name: 'tomatoes' });
  assert.deepEqual(parseIngredient('2 c. à soupe d’huile d’olive'), {
    qty: 30,
    unit: 'ml',
    name: 'huile d’olive',
  });
  assert.deepEqual(parseIngredient('3 cloves garlic'), { qty: 3, unit: 'clove', name: 'garlic' });
  assert.deepEqual(parseIngredient('Salt to taste'), {
    qty: undefined,
    unit: undefined,
    name: 'Salt to taste',
  });
  assert.deepEqual(parseIngredient('2 eggs'), { qty: 2, unit: undefined, name: 'eggs' });
});

test('buildGroceries merges duplicates, subtracts pantry and folds into the list', () => {
  const recipes = [
    { id: 'r1', ingredients: ['200 g flour', '2 eggs', '250 ml milk', 'salt'] },
    { id: 'r2', ingredients: ['300 g Flour', '1 egg', '1 cup milk', '2 tomatoes'] },
  ];
  const pantry = [
    { name: 'Salt', quantity: '' },
    { name: 'Milk', quantity: '1 l' },
    { name: 'Flour', quantity: '100 g' },
  ];
  const groceries = [
    { id: 'g1', name: 'Eggs', quantity: '6', checked: false },
    { id: 'g2', name: 'Tomatoes', quantity: '', checked: true },
  ];
  const out = buildGroceries(recipes, pantry, groceries);
  assert.deepEqual(out.add, [
    { name: 'Flour', quantity: '400 g', recipeIds: ['r1', 'r2'] },
    { name: 'Tomatoes', quantity: '2', recipeIds: ['r2'] },
  ]);
  assert.deepEqual(out.update, [{ id: 'g1', quantity: '9', recipeIds: ['r1', 'r2'] }]);
  assert.deepEqual(out.skipped.sort(), ['milk', 'salt']);
});

test('buildGroceries does not add the same recipe twice', () => {
  const out = buildGroceries(
    [{ id: 'r', ingredients: ['2 eggs', 'Parsley'] }],
    [],
    [{ id: 'g', name: 'Eggs', quantity: '2', checked: false, recipeIds: ['r'] }],
  );
  assert.deepEqual(out.update, []);
  assert.deepEqual(
    out.add.map((a) => a.name),
    ['Parsley'],
  );
});

test('barcode helpers: check digit, URL base, response validation', async () => {
  assert.ok(isValidBarcode('3017620422003'));
  assert.ok(isValidBarcode('96385074'));
  assert.ok(isValidBarcode('036000291452'));
  assert.ok(!isValidBarcode('3017620422004'));
  assert.ok(!isValidBarcode('12345'));
  assert.equal(apiUrl('/api/food/barcode/1', 'web', 'api.example.com'), '/api/food/barcode/1');
  assert.equal(apiUrl('/api/x', 'ios', 'api.example.com'), 'https://api.example.com/api/x');
  assert.equal(apiUrl('/api/x', 'android', 'http://10.0.2.2:3000/'), 'http://10.0.2.2:3000/api/x');
  const body = {
    ean: '3017620422003',
    name: 'Nutella',
    brand: 'Ferrero',
    quantity: '400 g',
    packGrams: 400,
    per100g: { calories: 539, protein: 6.3, carbs: 57.5, fat: 30.9 },
    servingGrams: 15,
    attribution: 'Open Food Facts',
  };
  const ok = (status: number, json: unknown) =>
    (async () => new Response(JSON.stringify(json), { status })) as unknown as typeof fetch;
  const product = await lookupBarcode('3017620422003', '/x', ok(200, body));
  assert.equal(product?.packGrams, 400);
  assert.equal(product?.per100g.calories, 539);
  assert.equal(productLabel(product!), 'Nutella · Ferrero');
  assert.deepEqual(product?.unknownNutrients, []);
  assert.equal(await lookupBarcode('1', '/x', ok(404, {})), null);
  // Missing macros stay unknown instead of becoming real zeros; the serving size is kept.
  const partial = await lookupBarcode(
    '1',
    '/x',
    ok(200, { name: 'Bar', servingGrams: 30, per100g: { calories: 400, protein: 8 } }),
  );
  assert.deepEqual(partial?.unknownNutrients, ['carbs', 'fat']);
  assert.equal(partial?.servingGrams, 30);
  const flagged = await lookupBarcode(
    '1',
    '/x',
    ok(200, {
      name: 'Bar',
      per100g: { calories: 400, protein: 0, carbs: 1, fat: 2 },
      unknownNutrients: ['protein'],
    }),
  );
  assert.deepEqual(flagged?.unknownNutrients, ['protein']);
  assert.deepEqual(
    (await lookupBarcode('1', '/x', ok(200, { name: 'No kcal', per100g: { protein: 3, carbs: 4, fat: 5 } })))
      ?.unknownNutrients,
    ['calories'],
  );
  assert.equal(await lookupBarcode('1', '/x', ok(200, { name: 'No macros' })), null);
  await assert.rejects(lookupBarcode('1', '/x', ok(502, {})), BarcodeLookupError);
  await assert.rejects(
    lookupBarcode('1', '/x', (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch),
    BarcodeLookupError,
  );
});

test('buildGroceries keeps free-text quantities it cannot add up', () => {
  const out = buildGroceries(
    [{ id: 'r', ingredients: ['2 onions', 'Parsley'] }],
    [],
    [{ id: 'g', name: 'onion', quantity: 'a bag', checked: false }],
  );
  assert.deepEqual(out.update, [{ id: 'g', quantity: 'a bag + 2', recipeIds: ['r'] }]);
  assert.deepEqual(out.add, [{ name: 'Parsley', quantity: '', recipeIds: ['r'] }]);
});

test('totalLabel shows a lower bound when meals are missing a value', () => {
  assert.equal(totalLabel(42, 0), '42');
  assert.equal(totalLabel(42, 2), '≥ 42');
  assert.equal(totalLabel(12.5, 1, 1), '≥ 12.5');
  assert.equal(totalLabel(0, 3), '≥ 0');
});
