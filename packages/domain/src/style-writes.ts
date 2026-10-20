/** Style actions as data writes (one atomic save each). */
import { createId, type LifeState } from './life';
import { bumpWear, piecesToBump, wornOutfit } from './wear';
import type { Writes } from './week-writes';

/** "Je la porte": the day's outfit (created or updated) and the worn pieces counted once. */
export function wearWrites(
  state: LifeState,
  itemIds: string[],
  date: string,
  name: string,
  id: string = createId(),
): Writes {
  const existing = state.outfits.find((o) => o.date === date && o.source === 'auto');
  const outfit = wornOutfit({ existing, id, name, itemIds, date });
  const bump = new Set(piecesToBump(existing, itemIds, date));
  return {
    upserts: [
      { collection: 'outfits', record: outfit },
      ...bumpWear(
        state.wardrobe.filter((w) => bump.has(w.id)),
        date,
      ).map((record) => ({ collection: 'wardrobe' as const, record })),
    ],
    deletes: [],
  };
}
