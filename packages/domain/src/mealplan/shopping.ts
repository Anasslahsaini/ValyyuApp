/**
 * Shopping list: needs across planned meals x servings, minus pantry stock, merged, rounded to purchase sizes,
 * priced with price level / currency index / user overrides. Pure and deterministic.
 */
import { ingredientTokens } from '../pantry-match';
import { parseIngredient } from '../grocery-builder';
import { createId, type GroceryItem } from '../life';
import { normalizeText } from '../food-search';
import { PantryLedger } from './pantry';
import type {
  IngredientCategory,
  PlanIngredient,
  PlanPantryItem,
  PlanRecipe,
  PlanWarning,
  PriceItem,
  PriceLevel,
  PriceTable,
  ShoppingLine,
} from './types';

/** One cooking session: `servings` is the TOTAL servings cooked (people x meals covered). */
export type CookEvent = { recipe: PlanRecipe; servings: number; date: string };

export type ShoppingOptions = {
  pantry: readonly PlanPantryItem[];
  prices?: PriceTable;
  priceLevel?: PriceLevel;
  currency: string;
  /** Ingredient id or name -> price per kg / l / piece in `currency`. Wins over the price table. */
  customPrices?: Record<string, number>;
  /** List staples (salt, pepper...) too. Default false. */
  includeStaples?: boolean;
};
export type ShoppingResult = {
  lines: ShoppingLine[];
  total: number;
  unpricedCount: number;
  warnings: PlanWarning[];
};

export const LEVEL_FACTOR: Record<PriceLevel, number> = { low: 0.8, mid: 1, high: 1.35 };
export const CATEGORY_ORDER: IngredientCategory[] = [
  'produce',
  'meat',
  'fish',
  'dairy',
  'bakery',
  'grain',
  'legume',
  'pantry',
  'frozen',
  'spice',
  'oil',
  'drink',
  'other',
];
const round2 = (n: number) => Math.round(n * 100) / 100;

export function currencyFactor(prices: PriceTable | undefined, currency: string): number {
  const f = prices?.currencyIndex?.[currency.toUpperCase()] ?? prices?.currencyIndex?.[currency];
  return f && f > 0 ? f : 1;
}
/** Lookup keys for a user price override: id, trimmed lower-case name, then accent-free token key. */
export function priceKeys(name: string, id?: string): string[] {
  return [
    ...new Set(
      [id, name.trim().toLowerCase(), normalizeText(name), ingredientTokens(name).join(' ')].filter(
        (k): k is string => !!k,
      ),
    ),
  ];
}
function customPriceFor(
  custom: Record<string, number> | undefined,
  name: string,
  id?: string,
): number | undefined {
  if (!custom) return undefined;
  for (const k of priceKeys(name, id)) {
    const v = custom[k];
    if (typeof v === 'number' && v >= 0) return v;
  }
  return undefined;
}

function roundUpPurchase(qty: number, unit: 'g' | 'ml' | 'piece'): number {
  if (unit === 'piece') return Math.max(1, Math.ceil(qty - 0.02));
  const step = qty <= 100 ? 25 : qty <= 500 ? 50 : qty <= 2000 ? 100 : 250;
  return Math.max(step, Math.ceil(qty / step - 0.001) * step);
}

type Agg = {
  ing: PlanIngredient;
  key: string;
  needed: number;
  pantry: number;
  remainder: number;
  recipeIds: string[];
  unknownAmount: boolean;
  fallbackCost: number;
  fallbackOk: boolean;
  firstDate: string;
};

export function buildShoppingList(events: readonly CookEvent[], opts: ShoppingOptions): ShoppingResult {
  const ledger = new PantryLedger(opts.pantry);
  const level = opts.priceLevel ?? 'mid';
  const cur = currencyFactor(opts.prices, opts.currency);
  const groups = new Map<string, Agg>();
  const sorted = events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.date.localeCompare(b.e.date) || a.i - b.i)
    .map((x) => x.e);
  for (const ev of sorted) {
    const scale = ev.recipe.servings > 0 ? ev.servings / ev.recipe.servings : 1;
    for (const ing of ev.recipe.ingredients) {
      if (ing.optional || (ing.staple && !opts.includeStaples)) continue;
      const key =
        ing.ingredientId ?? `n:${ingredientTokens(ing.name).sort().join(' ') || ing.name.toLowerCase()}`;
      const g = groups.get(key) ?? {
        ing,
        key,
        needed: 0,
        pantry: 0,
        remainder: 0,
        recipeIds: [],
        unknownAmount: false,
        fallbackCost: 0,
        fallbackOk: true,
        firstDate: ev.date,
      };
      const need = ing.grams * scale;
      const idx = ledger.match(ing);
      let rem = 0;
      if (need > 0) {
        const covered = ledger.take(idx, ing, need, ev.date);
        g.pantry += covered;
        rem = need - covered;
      } else if (ledger.available(idx, ing, ev.date) > 0) ledger.take(idx, ing, 1, ev.date);
      else g.unknownAmount = true; // free-text recipe line without a quantity and nothing at home
      g.needed += need;
      g.remainder += rem;
      if ((rem > 0 || (need <= 0 && g.unknownAmount)) && !g.recipeIds.includes(ev.recipe.id))
        g.recipeIds.push(ev.recipe.id);
      if (rem > 0) {
        if (ing.cost === undefined || !(need > 0)) g.fallbackOk = false;
        else g.fallbackCost += ing.cost * scale * (rem / need);
      }
      groups.set(key, g);
    }
  }
  const lines: ShoppingLine[] = [];
  let unpriced = 0,
    total = 0;
  for (const g of groups.values()) {
    if (g.remainder <= 0 && !g.unknownAmount) continue;
    const { ing } = g;
    const table: PriceItem | undefined = ing.ingredientId ? opts.prices?.items[ing.ingredientId] : undefined;
    const pieceOk = !!ing.pieceGrams && ing.pieceGrams > 0;
    const unit: 'g' | 'ml' | 'piece' =
      ing.unit === 'piece' && pieceOk ? 'piece' : ing.unit === 'ml' ? 'ml' : 'g';
    const gPerMl = ing.gramsPerMl && ing.gramsPerMl > 0 ? ing.gramsPerMl : 1;
    const packGrams = table?.packGrams ?? ing.packGrams;
    let buyGrams: number, qty: number, packs: number | undefined;
    if (g.remainder <= 0) {
      // quantity unknown (free-text recipe line): buy one unit
      qty = unit === 'piece' ? 1 : 250;
      buyGrams = unit === 'piece' ? ing.pieceGrams! : 250 * (unit === 'ml' ? gPerMl : 1);
    } else if (unit === 'piece') {
      qty = roundUpPurchase(g.remainder / ing.pieceGrams!, 'piece');
      buyGrams = qty * ing.pieceGrams!;
    } else if (packGrams && packGrams > 0) {
      packs = Math.max(1, Math.ceil(g.remainder / packGrams - 0.02));
      buyGrams = packs * packGrams;
      qty = unit === 'ml' ? Math.round(buyGrams / gPerMl) : buyGrams;
    } else {
      qty = roundUpPurchase(unit === 'ml' ? g.remainder / gPerMl : g.remainder, unit);
      buyGrams = unit === 'ml' ? qty * gPerMl : qty;
    }
    // Price: user override > table (level) > recipe-derived estimate > unknown.
    let cost: number | undefined;
    const custom = customPriceFor(opts.customPrices, ing.name, ing.ingredientId);
    const naturalPriceUnit: PriceItem['unit'] =
      table?.unit ?? (unit === 'piece' ? 'piece' : unit === 'ml' ? 'l' : 'kg');
    const priceFor = (pu: PriceItem['unit'], per: number): number | undefined => {
      if (pu === 'kg') return (buyGrams / 1000) * per;
      if (pu === 'l') return (buyGrams / gPerMl / 1000) * per;
      return pieceOk ? (buyGrams / ing.pieceGrams!) * per : undefined;
    };
    if (custom !== undefined) cost = priceFor(naturalPriceUnit, custom);
    if (cost === undefined && table) {
      const per = table[level] ?? table.mid;
      const c = priceFor(table.unit, per);
      if (c !== undefined) cost = c * cur;
    }
    if (cost === undefined && g.fallbackOk && g.fallbackCost > 0)
      cost = g.fallbackCost * LEVEL_FACTOR[level] * cur;
    const priceKnown = cost !== undefined;
    if (priceKnown) total += round2(cost!);
    else unpriced += 1;
    lines.push({
      ingredientId: ing.ingredientId,
      name: ing.name,
      qty,
      unit,
      packs,
      packGrams: packs ? packGrams : undefined,
      neededGrams: Math.round(g.needed),
      pantryGrams: Math.round(g.pantry),
      category: ing.category,
      costEstimate: priceKnown ? round2(cost!) : 0,
      priceKnown,
      forRecipeIds: g.recipeIds,
    });
  }
  const catRank = (c?: IngredientCategory) => {
    const i = c ? CATEGORY_ORDER.indexOf(c) : -1;
    return i < 0 ? CATEGORY_ORDER.length : i;
  };
  lines.sort(
    (a, b) =>
      catRank(a.category) - catRank(b.category) ||
      a.name.localeCompare(b.name) ||
      (a.ingredientId ?? '').localeCompare(b.ingredientId ?? ''),
  );
  return {
    lines,
    total: round2(total),
    unpricedCount: unpriced,
    warnings: unpriced ? [{ code: 'price_missing', params: { count: unpriced } }] : [],
  };
}

/** Human-friendly quantity for a line: grams -> kg, ml -> l. */
export function displayQuantity(line: Pick<ShoppingLine, 'qty' | 'unit'>): {
  value: number;
  unit: 'g' | 'kg' | 'ml' | 'l' | 'piece';
} {
  if (line.unit === 'g' && line.qty >= 1000) return { value: Math.round(line.qty / 10) / 100, unit: 'kg' };
  if (line.unit === 'ml' && line.qty >= 1000) return { value: Math.round(line.qty / 10) / 100, unit: 'l' };
  return { value: line.qty, unit: line.unit };
}
export function quantityText(line: Pick<ShoppingLine, 'qty' | 'unit'>): string {
  const d = displayQuantity(line);
  return d.unit === 'piece' ? String(d.value) : `${d.value} ${d.unit}`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const keyOfName = (name: string) => ingredientTokens(name).sort().join(' ') || name.toLowerCase().trim();

function sumQuantity(a: string, b: string): string {
  const pa = a.trim() ? parseIngredient(`${a} x`) : undefined,
    pb = parseIngredient(`${b} x`);
  if (pa?.qty !== undefined && pb.qty !== undefined && (pa.unit ?? '') === (pb.unit ?? '')) {
    const n = round2(pa.qty + pb.qty),
      u = pa.unit ?? '';
    if (u === 'g' && n >= 1000) return `${round2(n / 1000)} kg`;
    if (u === 'ml' && n >= 1000) return `${round2(n / 1000)} l`;
    return u ? `${n} ${u}` : String(n);
  }
  return [a.trim(), b.trim()].filter(Boolean).join(' + ');
}

/**
 * Lines -> grocery records. Items already on the (unchecked) list for the same ingredient are not duplicated:
 * identical recipes are skipped, new recipes top up the existing item (`update`).
 */
export function shoppingToGroceries(
  lines: readonly ShoppingLine[],
  existing: readonly GroceryItem[],
  idFactory: () => string = createId,
): { add: GroceryItem[]; update: GroceryItem[]; skipped: string[] } {
  const add: GroceryItem[] = [],
    update: GroceryItem[] = [],
    skipped: string[] = [];
  const open = new Map<string, GroceryItem>();
  for (const g of existing) if (!g.checked && !open.has(keyOfName(g.name))) open.set(keyOfName(g.name), g);
  const pending = new Map<string, GroceryItem>(); // lines of this call that map to the same key
  for (const line of lines) {
    const key = keyOfName(line.name);
    const ids = line.forRecipeIds.slice(0, 50);
    const quantity = quantityText(line);
    const prior = pending.get(key) ?? open.get(key);
    if (prior) {
      if (
        ids.every((id) => prior.recipeIds?.includes(id)) &&
        (ids.length > 0 || prior.recipeIds !== undefined)
      ) {
        skipped.push(line.name);
        continue;
      }
      const merged: GroceryItem = {
        ...prior,
        quantity: sumQuantity(prior.quantity, quantity).slice(0, 100),
        estimatedCost: round2(prior.estimatedCost + line.costEstimate),
        recipeIds: [...new Set([...(prior.recipeIds ?? []), ...ids])].slice(0, 50),
      };
      if (pending.get(key)) {
        const at = add.indexOf(prior);
        if (at >= 0) add[at] = merged;
        else update[update.findIndex((u) => u.id === prior.id)] = merged;
      } else update.push(merged);
      pending.set(key, merged);
      continue;
    }
    const rec: GroceryItem = {
      id: idFactory(),
      name: cap(line.name).slice(0, 180),
      quantity,
      estimatedCost: line.costEstimate,
      checked: false,
      recipeIds: ids,
    };
    add.push(rec);
    pending.set(key, rec);
  }
  return { add, update, skipped };
}
