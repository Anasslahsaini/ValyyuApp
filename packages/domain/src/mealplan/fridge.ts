/**
 * "Frigo" helpers (pure): meal ideas from what is in the fridge, what cooking a recipe takes out of it,
 * the plan's grocery list refresh, and the day's calorie target (with the Fitness link).
 */
import type { GroceryItem, PantryItem } from '../life';
import { findPantryItem, sameIngredient } from '../pantry-match';
import { sessionKcal } from '../targets';
import { hitsAllergy } from './diet';
import { parseStockQuantity, quantityToGrams } from './pantry';
import { expiryStatus } from './ui';
import type { PlanIngredient, PlanRecipe, Slot } from './types';

export type FridgeIdea = {
  recipe: PlanRecipe;
  /** Ingredient names the fridge covers. */
  have: string[];
  /** Ingredient names to buy (staples and optional lines excluded). */
  missing: string[];
};

type PantryLike = Pick<PantryItem, 'name'> & { expiresOn?: string | undefined };

/** The ingredients that count (no salt / water / oil splash, no optional garnish). */
const counted = (r: PlanRecipe) => r.ingredients.filter((i) => !i.staple && !i.optional);
const idText = (i: PlanIngredient) => (i.ingredientId ? i.ingredientId.replace(/[-_]/g, ' ') : '');

/** Pantry item that covers an ingredient (display name first, then the catalogue id, so "eggs" works in any app language). */
export function pantryFor<P extends PantryLike>(
  ing: Pick<PlanIngredient, 'name' | 'ingredientId'>,
  pantry: P[],
): P | undefined {
  return (
    findPantryItem(ing.name, pantry) ??
    (ing.ingredientId ? findPantryItem(idText(ing as PlanIngredient), pantry) : undefined)
  );
}

const DIET_OK = (r: PlanRecipe, diet: readonly string[]) =>
  r.source !== 'catalogue' || diet.every((d) => r.tags.includes(d));
const DISLIKED = (r: PlanRecipe, dislikes: readonly string[]) =>
  dislikes.some((d) => sameIngredient(d, r.name) || r.ingredients.some((i) => sameIngredient(d, i.name)));

/**
 * Best recipes for what is in the fridge right now. Ranked by share of ingredients already there, items to use soon,
 * then the meal of the moment (`slot`). `page` rotates through the next ideas ("Other ideas").
 */
export function fridgeIdeas(
  recipes: readonly PlanRecipe[],
  pantry: readonly PantryLike[],
  opts: {
    slot?: Slot;
    diet?: readonly string[];
    dislikes?: readonly string[];
    allergies?: readonly string[];
    count?: number;
    page?: number;
    today?: string;
  } = {},
): FridgeIdea[] {
  const count = opts.count ?? 3;
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const fresh = pantry.filter((p) => expiryStatus(p.expiresOn, today) !== 'expired');
  const soon = new Set(fresh.filter((p) => expiryStatus(p.expiresOn, today) === 'soon').map((p) => p.name));
  const scored: { idea: FridgeIdea; score: number; slotOk: boolean }[] = [];
  for (const recipe of recipes) {
    if (
      !DIET_OK(recipe, opts.diet ?? []) ||
      DISLIKED(recipe, opts.dislikes ?? []) ||
      hitsAllergy(recipe, opts.allergies ?? [])
    )
      continue;
    const lines = counted(recipe);
    if (!lines.length) continue;
    const have: string[] = [],
      missing: string[] = [];
    let soonUsed = 0;
    for (const ing of lines) {
      const p = pantryFor(ing, fresh);
      if (p) {
        have.push(ing.name);
        if (soon.has(p.name)) soonUsed += 1;
      } else missing.push(ing.name);
    }
    if (pantry.length && !have.length) continue;
    const ratio = have.length / lines.length;
    const score = ratio * 10 + have.length + soonUsed * 3 - missing.length * 0.5 + (recipe.favorite ? 1 : 0);
    scored.push({
      idea: { recipe, have, missing },
      score,
      slotOk: !opts.slot || recipe.slots.includes(opts.slot),
    });
  }
  scored.sort(
    (a, b) =>
      Number(b.slotOk) - Number(a.slotOk) ||
      b.score - a.score ||
      a.idea.recipe.name.localeCompare(b.idea.recipe.name),
  );
  if (!scored.length) return [];
  const pages = Math.max(1, Math.ceil(Math.min(scored.length, count * 4) / count));
  const start = ((opts.page ?? 0) % pages) * count;
  return scored.slice(start, start + count).map((s) => s.idea);
}

const round = (n: number, step: number) => Math.round(n / step) * step;

/**
 * What cooking `factor` x the recipe takes out of the fridge: items whose amount is known are reduced,
 * items used up (or with no amount) are removed. Staples are never touched.
 */
export function consumePantry(
  pantry: readonly PantryItem[],
  ingredients: readonly PlanIngredient[],
  factor = 1,
): { updates: PantryItem[]; deletes: string[] } {
  const left = new Map<string, PantryItem>();
  const deletes = new Set<string>();
  for (const ing of ingredients) {
    if (ing.staple) continue;
    const pool = pantry.filter((p) => !deletes.has(p.id)).map((p) => left.get(p.id) ?? p);
    const item = pantryFor(ing, pool);
    if (!item) continue;
    const parsed = parseStockQuantity(item.quantity);
    const stock = quantityToGrams(parsed, ing, item.packGrams);
    const need = ing.grams * factor;
    if (!parsed || stock === undefined || !(need > 0)) {
      deletes.add(item.id);
      left.delete(item.id);
      continue;
    }
    const rest = stock - need;
    if (rest <= Math.max(1, stock * 0.05)) {
      deletes.add(item.id);
      left.delete(item.id);
      continue;
    }
    let quantity: string;
    if (parsed.unit === 'g' || parsed.unit === 'ml') {
      const v = parsed.unit === 'ml' ? rest / (ing.gramsPerMl ?? 1) : rest;
      quantity = `${v >= 50 ? round(v, 5) : Math.round(v)} ${parsed.unit}`;
    } else {
      const per = stock / parsed.qty;
      quantity = String(Math.max(0.5, round(rest / per, 0.5)));
      if (parsed.unit) quantity += ` ${parsed.unit}`;
    }
    left.set(item.id, { ...item, quantity: quantity.slice(0, 100) });
  }
  return { updates: [...left.values()], deletes: [...deletes] };
}

/** Groceries the plan wrote earlier and nobody ticked yet: replaced when the week is planned again. */
export const planGroceries = (groceries: readonly GroceryItem[]) =>
  groceries.filter((g) => !g.checked && (g.recipeIds?.length ?? 0) > 0);

/** Calories burnt by the training sessions logged on `date` (0 when none). */
export function trainingKcal(
  sessions: readonly { date: string; durationSec?: number | undefined }[],
  date: string,
  weightKg?: number,
): number {
  return sessions
    .filter((s) => s.date.slice(0, 10) === date)
    .reduce((a, s) => a + sessionKcal(s.durationSec, weightKg), 0);
}

/** The day's calorie target: the profile's target plus what training burnt that day (0 = no target). */
export function dayCalorieTarget(
  base: number,
  sessions: readonly { date: string; durationSec?: number | undefined }[],
  date: string,
  weightKg?: number,
): { target: number; training: number } {
  const training = base > 0 ? trainingKcal(sessions, date, weightKg) : 0;
  return { target: base > 0 ? base + training : 0, training };
}

/** Grocery lines -> fridge items (merged into the same item when it is already there). */
export function groceriesToPantry(
  groceries: readonly GroceryItem[],
  pantry: readonly PantryItem[],
  idFactory: () => string,
): { add: PantryItem[]; update: PantryItem[] } {
  const add: PantryItem[] = [],
    update: PantryItem[] = [];
  for (const g of groceries) {
    const have = findPantryItem(g.name, [...pantry, ...add]);
    if (!have) add.push({ id: idFactory(), name: g.name.slice(0, 180), quantity: g.quantity.slice(0, 100) });
    else if (!have.quantity && g.quantity) {
      const next = { ...have, quantity: g.quantity.slice(0, 100) };
      const at = add.indexOf(have);
      if (at >= 0) add[at] = next;
      else update.push(next);
    }
  }
  return { add, update };
}
