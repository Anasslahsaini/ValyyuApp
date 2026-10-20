/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GroceryItem, PantryItem } from '../life';
import {
  catalogueToPlanRecipes,
  consumePantry,
  dayCalorieTarget,
  fridgeIdeas,
  groceriesToPantry,
  planGroceries,
  type PlanIngredient,
} from '../mealplan';
import { loadCatalogue } from '../recipe-catalogue';
import { parsePhoto, photoQuery, recipePhoto } from '../recipe-catalogue-photo';

const TODAY = '2026-10-18';
let n = 0;
const id = () => `id-${++n}`;

test('fridge ideas: recipes that use what is in the fridge come first, 3 at a time', async () => {
  const data = await loadCatalogue();
  const recipes = catalogueToPlanRecipes(data, 'fr');
  const pantry = [{ name: 'Œuf' }, { name: 'Tomate' }, { name: 'Oignon' }, { name: 'Poivron rouge' }];
  const ideas = fridgeIdeas(recipes, pantry, { today: TODAY });
  assert.equal(ideas.length, 3);
  for (const i of ideas) assert.ok(i.have.length >= 1, `${i.recipe.name} uses the fridge`);
  assert.ok(ideas[0].have.length >= 2);
  const next = fridgeIdeas(recipes, pantry, { today: TODAY, page: 1 });
  assert.notDeepEqual(
    next.map((i) => i.recipe.id),
    ideas.map((i) => i.recipe.id),
  );
});

test('fridge ideas: English pantry names match French recipes through the ingredient id', async () => {
  const data = await loadCatalogue();
  const recipes = catalogueToPlanRecipes(data, 'fr');
  const ideas = fridgeIdeas(recipes, [{ name: 'eggs' }], { today: TODAY });
  assert.ok(ideas.length > 0);
  assert.ok(ideas.every((i) => i.recipe.ingredients.some((g) => g.ingredientId === 'egg-whole-raw')));
});

test('fridge ideas: diet, expired items and the meal of the moment are respected', async () => {
  const data = await loadCatalogue();
  const recipes = catalogueToPlanRecipes(data, 'en');
  const veg = fridgeIdeas(recipes, [{ name: 'Onion' }, { name: 'Chicken breast' }], {
    diet: ['vegetarian'],
    today: TODAY,
  });
  assert.ok(veg.every((i) => i.recipe.tags.includes('vegetarian')));
  assert.deepEqual(fridgeIdeas(recipes, [{ name: 'Egg', expiresOn: '2026-10-01' }], { today: TODAY }), []);
  const breakfast = fridgeIdeas(recipes, [{ name: 'Milk' }, { name: 'Banana' }, { name: 'Oats' }], {
    slot: 'breakfast',
    today: TODAY,
  });
  assert.ok(breakfast[0].recipe.slots.includes('breakfast'));
});

const ing = (over: Partial<PlanIngredient>): PlanIngredient => ({ name: 'x', grams: 0, ...over });

test('cooking takes the used amounts out of the fridge; unknown amounts and staples', () => {
  const pantry: PantryItem[] = [
    { id: 'rice', name: 'Rice', quantity: '1 kg' },
    { id: 'eggs', name: 'Eggs', quantity: '6' },
    { id: 'milk', name: 'Milk', quantity: '' },
    { id: 'salt', name: 'Salt', quantity: '500 g' },
    { id: 'feta', name: 'Feta', quantity: '200 g' },
  ];
  const used = consumePantry(
    pantry,
    [
      ing({ name: 'Rice', grams: 150 }),
      ing({ name: 'Egg', grams: 110, unit: 'piece', pieceGrams: 55 }),
      ing({ name: 'Milk', grams: 200 }),
      ing({ name: 'Salt', grams: 2, staple: true }),
      ing({ name: 'Feta', grams: 100 }),
    ],
    2,
  );
  const by = new Map(used.updates.map((p) => [p.id, p.quantity]));
  assert.equal(by.get('rice'), '700 g');
  assert.equal(by.get('eggs'), '2');
  assert.deepEqual(used.deletes.sort(), ['feta', 'milk']);
  assert.ok(!by.has('salt') && !used.deletes.includes('salt'));
});

test('day calorie target adds the training sessions of that day only', () => {
  const sessions = [
    { date: `${TODAY}T08:00:00.000Z`, durationSec: 3600 },
    { date: '2026-10-17', durationSec: 3600 },
  ];
  assert.deepEqual(dayCalorieTarget(2000, sessions, TODAY, 70), { target: 2350, training: 350 });
  assert.deepEqual(dayCalorieTarget(2000, [], TODAY, 70), { target: 2000, training: 0 });
  assert.deepEqual(dayCalorieTarget(0, sessions, TODAY, 70), { target: 0, training: 0 });
});

test('everything bought: groceries become fridge items, merged with what is already there', () => {
  const groceries: GroceryItem[] = [
    { id: 'g1', name: 'Tomatoes', quantity: '1 kg', estimatedCost: 3, checked: false, recipeIds: ['r'] },
    { id: 'g2', name: 'Milk', quantity: '1 l', estimatedCost: 1, checked: true },
    { id: 'g3', name: 'Tomato', quantity: '', estimatedCost: 0, checked: false },
  ];
  const moved = groceriesToPantry(groceries, [{ id: 'p1', name: 'milk', quantity: '' }], id);
  assert.deepEqual(
    moved.add.map((p) => [p.name, p.quantity]),
    [['Tomatoes', '1 kg']],
  );
  assert.deepEqual(moved.update, [{ id: 'p1', name: 'milk', quantity: '1 l' }]);
  assert.deepEqual(
    planGroceries(groceries).map((g) => g.id),
    ['g1'],
  );
});

test('recipe photo: no key / offline / bad answers give null, good answers are kept', async () => {
  assert.equal(photoQuery('  Porridge banane-cannelle! '), 'porridge banane-cannelle');
  assert.equal(parsePhoto({ photo: null }), null);
  assert.equal(parsePhoto({ photo: { url: 'http://insecure' } }), null);
  assert.deepEqual(parsePhoto({ photo: { url: 'https://x/y.jpg', credit: 'Ann' } }), {
    url: 'https://x/y.jpg',
    thumb: 'https://x/y.jpg',
    alt: '',
    credit: 'Ann',
    link: 'https://www.pexels.com',
  });
  const offline = (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
  assert.equal(await recipePhoto('Shakshuka offline', (p) => p, offline), null);
  let url = '';
  const ok = ((u: string) => {
    url = u;
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ photo: { url: 'https://img/1.jpg' } }),
    });
  }) as unknown as typeof fetch;
  assert.equal((await recipePhoto('Shakshuka', (p) => `https://api${p}`, ok))?.url, 'https://img/1.jpg');
  assert.equal(url, 'https://api/api/food/photo?q=shakshuka');
});
