import type { Collection, CollectionRecord, LifeState, Outfit } from './life';

export type SaveEntry = { [K in Collection]: { collection: K; record: CollectionRecord<K> } }[Collection];

/**
 * Apply several saves as one workspace update (voice commands, batch saves). Outfits may reference garments
 * saved in the same batch; anything referencing missing clothing rejects the whole batch so nothing is half-saved.
 */
export function upsertRecords(state: LifeState, entries: SaveEntry[]): LifeState {
  const next: LifeState = { ...state };
  for (const { collection, record } of entries) {
    const list = next[collection] as { id: string }[];
    (next as Record<string, unknown>)[collection] = [...list.filter((item) => item.id !== record.id), record];
  }
  for (const { collection, record } of entries) {
    if (
      collection === 'outfits' &&
      (record as Outfit).itemIds.some((id) => !next.wardrobe.some((item) => item.id === id))
    ) {
      throw new Error('Some clothing is no longer in your wardrobe.');
    }
  }
  return next;
}
