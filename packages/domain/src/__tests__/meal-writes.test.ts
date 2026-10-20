import assert from 'node:assert/strict';
import test from 'node:test';
import { newLifeState } from '../life';
import { allBoughtWrites, cookedWrites, mealEntry } from '../meal-writes';
import type { PlanRecipe } from '../mealplan';

const recipe: PlanRecipe = {
  id: 'omelette',
  name: 'Omelette',
  slots: ['breakfast'],
  servings: 2,
  prepMinutes: 5,
  cookMinutes: 5,
  tags: ['vegetarian'],
  ingredients: [
    { ingredientId: 'egg-whole-raw', name: 'œufs', grams: 200 },
    { ingredientId: 'salt', name: 'sel', grams: 1, staple: true },
  ],
  perServing: { calories: 300, protein: 20, carbs: 2, fat: 22 },
  leftoverDays: 0,
  source: 'catalogue',
};

test('cooking a fridge idea logs the meal and takes the eggs out of the fridge', () => {
  const s = newLifeState();
  s.pantry.push({ id: 'p1', name: 'œufs', quantity: '' }, { id: 'p2', name: 'lait', quantity: '1 l' });
  const w = cookedWrites(s, recipe, { date: '2026-10-20', slot: 'breakfast', servings: 2, id: 'm1' });
  const meal = w.upserts.find((u) => u.collection === 'meals')?.record as {
    name: string;
    estimated: boolean;
  };
  assert.equal(meal.name, 'Omelette');
  assert.equal(meal.estimated, true);
  assert.deepEqual(w.deletes, [{ collection: 'pantry', id: 'p1' }]);
});

test('"everything is bought" moves the whole list to the fridge and empties it', () => {
  const s = newLifeState();
  s.groceries.push(
    { id: 'g1', name: 'tomates', quantity: '500 g', estimatedCost: 2, checked: true },
    { id: 'g2', name: 'riz', quantity: '1 kg', estimatedCost: 3, checked: false },
  );
  let n = 0;
  const w = allBoughtWrites(s, () => `id${String(++n)}`);
  assert.equal(w.upserts.filter((u) => u.collection === 'pantry').length, 2);
  assert.deepEqual(
    w.deletes.map((d) => d.id),
    ['g1', 'g2'],
  );
});

test('a meal typed by hand is kept as typed, marked as an estimate', () => {
  const m = mealEntry({ name: '  Salade ', date: '2026-10-20', slot: 'lunch', calories: 450 }, 'x');
  assert.equal(m.name, 'Salade');
  assert.equal(m.calories, 450);
  assert.equal(m.protein, 0);
  assert.equal(m.estimated, true);
  assert.equal(m.servings, 1);
});
