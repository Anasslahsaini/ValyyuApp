import assert from 'node:assert/strict';
import test from 'node:test';
import { newLifeState } from '../life';
import { wearWrites } from '../style-writes';

const state = () => {
  const s = newLifeState();
  s.wardrobe.push(
    { id: 'a', name: 'T-shirt blanc', category: 'top', color: 'white' },
    { id: 'b', name: 'Jean', category: 'bottom', color: 'denim' },
    { id: 'c', name: 'Baskets', category: 'shoes', color: 'white' },
  );
  return s;
};

test('wearing an outfit saves it for the day and counts each piece once', () => {
  const s = state();
  const w = wearWrites(s, ['a', 'b', 'c'], '2026-10-20', 'Tenue du 20 octobre', 'o1');
  const outfit = w.upserts.find((u) => u.collection === 'outfits')?.record as {
    wornOn: string[];
    itemIds: string[];
  };
  assert.deepEqual(outfit.wornOn, ['2026-10-20']);
  assert.equal(w.upserts.filter((u) => u.collection === 'wardrobe').length, 3);

  // Same day again, one piece changed: only the new piece is counted.
  s.outfits.push(outfit as never);
  s.wardrobe.push({ id: 'd', name: 'Chemise', category: 'top', color: 'blue' });
  const again = wearWrites(s, ['d', 'b', 'c'], '2026-10-20', 'Tenue', 'o2');
  const bumped = again.upserts
    .filter((u) => u.collection === 'wardrobe')
    .map((u) => (u.record as { id: string }).id);
  assert.deepEqual(bumped, ['d']);
  assert.equal((again.upserts[0]?.record as { id: string }).id, 'o1');
});
