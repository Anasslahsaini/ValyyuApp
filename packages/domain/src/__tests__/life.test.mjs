import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LifeSchema,
  newLifeState,
  upsertRecord,
  deleteRecord,
  totalsForDate,
  todayKey,
  exerciseLibrary,
} from '../life.ts';

test('A new workspace contains no invented user data or personalized targets', () => {
  const state = LifeSchema.parse(newLifeState());
  for (const [key, value] of Object.entries(state))
    if (Array.isArray(value)) assert.equal(value.length, 0, key);
  assert.equal(state.settings.calorieTarget, 0);
  assert.ok(exerciseLibrary.length > 0);
});
test('Saving and editing an item upserts it rather than duplicating or changing other collections', () => {
  const initial = newLifeState();
  const saved = upsertRecord(initial, 'pantry', { id: 'milk', name: 'Milk', quantity: '1 litre' });
  const edited = upsertRecord(saved, 'pantry', { id: 'milk', name: 'Milk', quantity: '2 litres' });
  assert.equal(edited.pantry.length, 1);
  assert.equal(edited.pantry[0].quantity, '2 litres');
  assert.equal(initial.pantry.length, 0);
  assert.deepEqual(edited.meals, []);
  LifeSchema.parse(edited);
});
test('Deleting clothing removes references, preserves usable outfits, and leaves unrelated data intact', () => {
  const initial = newLifeState();
  initial.wardrobe = [
    { id: 'top', name: 'Shirt', category: 'top', color: 'white' },
    { id: 'bottom', name: 'Jeans', category: 'bottom', color: 'blue' },
  ];
  initial.outfits = [
    { id: 'both', name: 'Together', itemIds: ['top', 'bottom'] },
    { id: 'one', name: 'Only shirt', itemIds: ['top'] },
  ];
  initial.pantry = [{ id: 'rice', name: 'Rice', quantity: '1 kg' }];
  const next = deleteRecord(initial, 'wardrobe', 'top');
  assert.deepEqual(next.outfits, [{ id: 'both', name: 'Together', itemIds: ['bottom'] }]);
  assert.equal(next.wardrobe.length, 1);
  assert.deepEqual(next.pantry, initial.pantry);
  assert.equal(initial.outfits[0].itemIds.length, 2);
  LifeSchema.parse(next);
});
test('Nutrition totals respect selected day and number of servings', () => {
  const meal = {
    id: 'a',
    name: 'Rice',
    date: '2026-10-14',
    slot: 'lunch',
    calories: 100,
    protein: 3,
    carbs: 20,
    fat: 1,
    servings: 2,
    estimated: true,
  };
  const otherDay = { ...meal, id: 'b', date: '2026-10-13' };
  assert.deepEqual(totalsForDate([meal, otherDay], '2026-10-14'), {
    calories: 200,
    protein: 6,
    carbs: 40,
    fat: 2,
    unknownCount: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    incomplete: 0,
  });
  assert.equal(todayKey(new Date(2026, 9, 14, 12)), '2026-10-14');
});
test('Unknown nutrients are skipped in sums and counted, never added as zero', () => {
  const base = { date: '2026-10-14', slot: 'lunch', servings: 1, estimated: false };
  const known = { ...base, id: 'k', name: 'Rice', calories: 300, protein: 40, carbs: 10, fat: 5 };
  const partial = {
    ...base,
    id: 'p',
    name: 'Bar',
    calories: 200,
    protein: 0,
    carbs: 20,
    fat: 8,
    unknownNutrients: ['protein'],
  };
  const blank = {
    ...base,
    id: 'b',
    name: 'Mystery',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    unknownNutrients: ['calories', 'protein', 'carbs', 'fat'],
  };
  const legacy = { ...base, id: 'l', name: 'Old', calories: 0, protein: 0, carbs: 0, fat: 0, servings: 2 };
  const t = totalsForDate([known, partial, blank, legacy], '2026-10-14');
  assert.equal(t.calories, 500);
  assert.equal(t.protein, 40);
  assert.deepEqual(t.unknownCount, { calories: 2, protein: 3, carbs: 2, fat: 2 });
  assert.equal(t.incomplete, 3);
});
test('Invalid nutrition and garment data cannot be saved', () => {
  const state = newLifeState();
  state.meals = [
    {
      id: 'bad',
      name: 'Meal',
      date: '2026-10-14',
      slot: 'lunch',
      calories: -20,
      protein: 0,
      carbs: 0,
      fat: 0,
      servings: 1,
      estimated: true,
    },
  ];
  assert.equal(LifeSchema.safeParse(state).success, false);
  state.meals = [];
  state.wardrobe = [{ id: 'bad', name: '', category: 'unknown', color: 'blue' }];
  assert.equal(LifeSchema.safeParse(state).success, false);
});
test('Grocery completion changes only its record and deletion is isolated', () => {
  const initial = newLifeState();
  const saved = upsertRecord(initial, 'groceries', {
    id: 'g',
    name: 'Eggs',
    quantity: '6',
    estimatedCost: 3,
    checked: false,
  });
  const checked = upsertRecord(saved, 'groceries', { ...saved.groceries[0], checked: true });
  assert.equal(checked.groceries[0].checked, true);
  assert.equal(saved.groceries[0].checked, false);
  assert.equal(deleteRecord(checked, 'groceries', 'g').groceries.length, 0);
});
