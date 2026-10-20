/**
 * Learn the user's real prices from checked grocery items that have both a quantity and a user-entered cost.
 * Conservative: bounded plausible range, median of observations, and an existing price moves at most 40% per update.
 * Prices are per kg (weights), per l (volumes) or per piece (counts), the same natural units the shopping list uses.
 * Keys are the accent-free ingredient tokens ("olive oil"), which `buildShoppingList` looks up after the ingredient id.
 */
import { parseIngredient } from '../grocery-builder';
import { ingredientTokens } from '../pantry-match';

export const PRICE_BOUNDS = { perKg: [0.2, 200], perL: [0.2, 200], perPiece: [0.05, 50] } as const;
export const MAX_CUSTOM_PRICES = 500;
const MAX_MOVE = 0.4;
const round2 = (n: number) => Math.round(n * 100) / 100;

export type PricedGrocery = { name: string; quantity: string; estimatedCost: number; checked: boolean };

export function learnCustomPrices(
  groceries: readonly PricedGrocery[],
  existing: Record<string, number> = {},
): Record<string, number> {
  const seen = new Map<string, number[]>();
  for (const g of groceries) {
    if (!g.checked || !(g.estimatedCost > 0) || !g.quantity.trim()) continue;
    const key = ingredientTokens(g.name).join(' ').slice(0, 80);
    if (!key) continue;
    const q = parseIngredient(`${g.quantity.trim()} x`);
    if (q.qty === undefined || !(q.qty > 0)) continue;
    let price: number, lo: number, hi: number;
    if (q.unit === 'g' && q.qty >= 20) {
      price = g.estimatedCost / (q.qty / 1000);
      [lo, hi] = PRICE_BOUNDS.perKg;
    } else if (q.unit === 'ml' && q.qty >= 20) {
      price = g.estimatedCost / (q.qty / 1000);
      [lo, hi] = PRICE_BOUNDS.perL;
    } else if (q.unit === undefined && q.qty >= 1 && q.qty <= 100) {
      price = g.estimatedCost / q.qty;
      [lo, hi] = PRICE_BOUNDS.perPiece;
    } else continue;
    if (!Number.isFinite(price) || price < lo || price > hi) continue;
    seen.set(key, [...(seen.get(key) ?? []), price]);
  }
  const out: Record<string, number> = { ...existing };
  for (const key of [...seen.keys()].sort()) {
    const obs = seen.get(key)!.sort((a, b) => a - b);
    const median =
      obs.length % 2 ? obs[(obs.length - 1) / 2] : (obs[obs.length / 2 - 1] + obs[obs.length / 2]) / 2;
    const prev = existing[key];
    if (typeof prev === 'number' && prev > 0) {
      const blended = (prev + median) / 2;
      out[key] = round2(Math.min(prev * (1 + MAX_MOVE), Math.max(prev * (1 - MAX_MOVE), blended)));
    } else if (Object.keys(out).length < MAX_CUSTOM_PRICES) out[key] = round2(median);
  }
  return out;
}
