import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newLifeState } from '../life';
import { upsertRecords } from '../assistant-target';

test('Save all is one all-or-nothing update, outfits may use garments from the same batch', () => {
  const state = newLifeState();
  const next = upsertRecords(state, [
    { collection: 'wardrobe', record: { id: 'shirt', name: 'Shirt', category: 'top', color: 'blue' } },
    { collection: 'outfits', record: { id: 'o', name: 'Look', itemIds: ['shirt'], source: 'assistant' } },
    { collection: 'pantry', record: { id: 'p', name: 'Rice', quantity: '1' } },
  ]);
  assert.equal(next.wardrobe.length, 1);
  assert.equal(next.outfits.length, 1);
  assert.equal(next.pantry.length, 1);
  assert.equal(state.wardrobe.length, 0, 'input state is not mutated');
  assert.throws(() =>
    upsertRecords(state, [{ collection: 'outfits', record: { id: 'o', name: 'Look', itemIds: ['ghost'] } }]),
  );
  const replaced = upsertRecords(next, [
    { collection: 'pantry', record: { id: 'p', name: 'Rice', quantity: '2' } },
  ]);
  assert.deepEqual(replaced.pantry, [{ id: 'p', name: 'Rice', quantity: '2' }]);
});
