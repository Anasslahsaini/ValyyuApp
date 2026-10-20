import type { Outfit, WardrobeItem } from './life';

/** Wear tracking and laundry, as pure record transforms the screen then saves. */

/** Items after wearing them on `date`: count +1 and lastWornAt moved forward (never back). */
export function bumpWear(items: WardrobeItem[], date: string): WardrobeItem[] {
  return items.map((it) => ({
    ...it,
    wearCount: (it.wearCount ?? 0) + 1,
    lastWornAt: it.lastWornAt && it.lastWornAt.slice(0, 10) > date ? it.lastWornAt : date,
  }));
}

/**
 * The outfit record for "Wear this": updates `existing` (keeps its id, name and notes) or
 * creates one with `date`, `source: 'auto'` and today in `wornOn`.
 */
export function wornOutfit(o: {
  existing?: Outfit | null;
  id: string;
  name: string;
  itemIds: string[];
  date: string;
}): Outfit {
  const base = o.existing ?? { id: o.id, name: o.name, source: 'auto' as const };
  const wornOn = Array.from(new Set([...(o.existing?.wornOn ?? []), o.date])).sort();
  return { ...base, name: base.name || o.name, itemIds: o.itemIds, date: o.date, wornOn };
}

export const wasWornOn = (o: Outfit | undefined | null, date: string) => !!o?.wornOn?.includes(date);

/**
 * Items to bump when an outfit is worn. When the outfit was already worn that day, only
 * pieces that were not in it before are counted, so pressing again never double-counts.
 */
export function piecesToBump(previous: Outfit | undefined | null, nextIds: string[], date: string): string[] {
  if (!wasWornOn(previous, date)) return nextIds;
  const before = new Set(previous?.itemIds ?? []);
  return nextIds.filter((id) => !before.has(id));
}

export const inLaundry = (it: WardrobeItem) => it.status === 'laundry';
export function toggleLaundry(it: WardrobeItem): WardrobeItem {
  return { ...it, status: inLaundry(it) ? 'clean' : 'laundry' };
}
/** Only the items that change, so the caller saves the minimum. */
export function allClean(items: WardrobeItem[]): WardrobeItem[] {
  return items.filter(inLaundry).map((it) => ({ ...it, status: 'clean' as const }));
}
