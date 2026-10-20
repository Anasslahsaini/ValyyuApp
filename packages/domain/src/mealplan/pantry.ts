/**
 * Pantry ledger shared by the planner (scoring) and the shopping list (subtraction) so both agree.
 * Quantities are free text ("500 g", "1,5 l", "6", "some"); unknown quantity = available once.
 */
import { parseIngredient } from '../grocery-builder';
import { tokensOf } from './diet';
import type { PlanIngredient, PlanPantryItem } from './types';

type Parsed = { qty: number; unit: string } | undefined;
type Entry = {
  item: PlanPantryItem;
  tokens: string[];
  parsed: Parsed;
  leftGrams?: number;
  onceUsed: boolean;
};

export function parseStockQuantity(quantity: string): Parsed {
  const q = quantity.trim();
  if (!q) return undefined;
  if (/^0+(?:[.,]0*)?(?:\s|$)/.test(q)) return { qty: 0, unit: 'g' }; // "0" = used up
  const p = parseIngredient(`${q} x`);
  return p.qty === undefined ? undefined : { qty: p.qty, unit: p.unit ?? '' };
}

/** Grams for a parsed quantity, or undefined when the unit cannot be converted. */
export function quantityToGrams(
  parsed: Parsed,
  ing: Pick<PlanIngredient, 'pieceGrams' | 'gramsPerMl'> | undefined,
  packGrams?: number,
): number | undefined {
  if (!parsed) return undefined;
  if (parsed.unit === 'g') return parsed.qty;
  if (parsed.unit === 'ml') return parsed.qty * (ing?.gramsPerMl ?? 1);
  if (parsed.unit === '' || parsed.unit === 'can') {
    const per = parsed.unit === '' ? (ing?.pieceGrams ?? packGrams) : (packGrams ?? 400);
    return per ? parsed.qty * per : undefined;
  }
  return undefined;
}

const subset = (a: string[], b: string[]) => a.length > 0 && a.every((t) => b.includes(t));
const dayOnly = (d: string) => d.slice(0, 10);

export class PantryLedger {
  private entries: Entry[];
  private matchCache = new Map<string, number>();
  constructor(pantry: readonly PlanPantryItem[]) {
    this.entries = pantry.map((item) => ({
      item,
      tokens: tokensOf(item.name),
      parsed: parseStockQuantity(item.quantity),
      onceUsed: false,
    }));
  }
  get size() {
    return this.entries.length;
  }
  nameOf(idx: number) {
    return this.entries[idx].item.name;
  }
  expiryOf(idx: number) {
    return this.entries[idx].item.expiresOn;
  }

  /** Index of the best pantry item for an ingredient, -1 if none. */
  match(ing: PlanIngredient): number {
    const key = `${ing.ingredientId ?? ''}|${ing.name}`;
    const cached = this.matchCache.get(key);
    if (cached !== undefined) return cached;
    const ti = [
      ...new Set([
        ...tokensOf(ing.name),
        ...(ing.ingredientId ? tokensOf(ing.ingredientId.replace(/[-_]/g, ' ')) : []),
      ]),
    ];
    let best = -1,
      bestShared = -1;
    if (ti.length) {
      this.entries.forEach((e, i) => {
        if (!(subset(e.tokens, ti) || subset(ti, e.tokens))) return;
        const shared = e.tokens.filter((t) => ti.includes(t)).length;
        if (shared > bestShared) {
          best = i;
          bestShared = shared;
        }
      });
    }
    this.matchCache.set(key, best);
    return best;
  }

  /** Grams of this ingredient the pantry can still cover on `date` (Infinity = unknown quantity, one use). */
  available(idx: number, ing: PlanIngredient, date: string): number {
    if (idx < 0) return 0;
    const e = this.entries[idx];
    if (e.item.expiresOn && dayOnly(e.item.expiresOn) < dayOnly(date)) return 0;
    if (e.leftGrams === undefined && e.parsed) {
      const g = quantityToGrams(e.parsed, ing, e.item.packGrams ?? ing.packGrams);
      if (g !== undefined) e.leftGrams = g;
    }
    if (e.leftGrams !== undefined) return e.leftGrams;
    return e.onceUsed ? 0 : Infinity;
  }

  /** Use up to `grams`; returns grams actually covered. */
  take(idx: number, ing: PlanIngredient, grams: number, date: string): number {
    const avail = this.available(idx, ing, date);
    if (avail <= 0 || grams <= 0) return 0;
    const e = this.entries[idx];
    if (avail === Infinity) {
      e.onceUsed = true;
      return grams;
    }
    const used = Math.min(avail, grams);
    e.leftGrams = avail - used;
    return used;
  }
}
