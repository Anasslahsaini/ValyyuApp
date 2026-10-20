import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LifeSchema } from '../life';
import { applyTags, defaultWarmth, shownTags, toggleSeason } from '../style-tags';

test('defaults come from the category and the default formality', () => {
  assert.equal(defaultWarmth('outerwear'), 3);
  assert.equal(defaultWarmth('accessory'), 1);
  assert.deepEqual(shownTags({}, 'top', 3), { warmth: 2, formality: 3, seasons: [], favorite: false });
  assert.deepEqual(shownTags({ warmth: 1, formality: 1, seasons: ['summer'], favorite: true }, 'outerwear'), {
    warmth: 1,
    formality: 1,
    seasons: ['summer'],
    favorite: true,
  });
});

test('tagging stays optional: untouched tags are not written', () => {
  const piece = { id: 'a', name: 'Shirt', category: 'top', color: 'blue' };
  assert.deepEqual(applyTags(piece, {}), piece);
  const tagged = applyTags(piece, { warmth: 3, seasons: ['winter', 'autumn'], favorite: true });
  assert.deepEqual(tagged, { ...piece, warmth: 3, seasons: ['winter', 'autumn'], favorite: true });
  // Clearing seasons or the favourite removes the field.
  assert.deepEqual(applyTags(tagged, { seasons: [], favorite: false }), { ...piece, warmth: 3 });
});

test('seasons toggle in calendar order and tagged pieces satisfy the schema', () => {
  assert.deepEqual(toggleSeason(['winter'], 'spring'), ['spring', 'winter']);
  assert.deepEqual(toggleSeason(['spring', 'winter'], 'spring'), ['winter']);
  const state = {
    version: 1,
    wardrobe: [
      applyTags(
        { id: 'a', name: 'Coat', category: 'outerwear', color: 'navy' },
        { warmth: 3, formality: 2, seasons: ['autumn', 'winter'], favorite: true },
      ),
    ],
    outfits: [],
    meals: [],
    recipes: [],
    pantry: [],
    groceries: [],
    workouts: [],
    sessions: [],
    weightEntries: [],
    settings: {
      calorieTarget: 0,
      proteinTarget: 0,
      carbsTarget: 0,
      fatTarget: 0,
      weeklyBudget: 0,
      currency: 'USD',
      equipment: [],
      defaultFormality: 3,
    },
  };
  assert.doesNotThrow(() => LifeSchema.parse(state));
});
