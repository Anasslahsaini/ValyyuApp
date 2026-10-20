/**
 * Glue between the data layers and the planner: catalogue recipes -> `PlanRecipe`, and the workspace
 * (`LifeState`) -> `PlanInput`. Pure and deterministic; nothing here touches storage or React.
 */
import {
  ingredientCost,
  ingredientIndex,
  ingredientName,
  lineGrams,
  recipeName,
  type CatalogueData,
  type CatalogueIngredient,
  type CatalogueRecipe,
} from '../recipe-catalogue';
import type { LifeState } from '../life';
import { mealNameKey } from '../nutrition';
import { fromUserRecipes } from './adapter';
import { addDays, dayNumber, defaultCookMinutesByDay } from './dates';
import type { DietTag, PlanIngredient, PlanInput, PlanPantryItem, PlanRecipe, PriceLevel } from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;
const DIET_TAGS: readonly DietTag[] = [
  'vegetarian',
  'vegan',
  'halal',
  'gluten_free',
  'dairy_free',
  'nut_free',
  'egg_free',
  'pescatarian',
];

function toPlanIngredient(
  line: CatalogueRecipe['ingredients'][number],
  ing: CatalogueIngredient | undefined,
  data: CatalogueData,
  lang: string,
): PlanIngredient {
  if (!ing) {
    // Unknown id (the data tests make sure this does not happen): keep the line readable, with no amount or price.
    return {
      ingredientId: line.id,
      name: ingredientName(line.id, lang, data),
      grams: 0,
      optional: line.optional,
    };
  }
  const grams = lineGrams(ing, line.qty, line.unit);
  const price = data.prices.items[ing.id];
  const piece = ing.gramsPerUnit.piece;
  const density = ing.gramsPerUnit.ml;
  // Natural purchase unit follows the price table (kg -> g, l -> ml, piece -> piece); without a price it follows how the recipe counts it.
  let unit: 'g' | 'ml' | 'piece' = 'g';
  if (price?.unit === 'piece' && piece) unit = 'piece';
  else if (price?.unit === 'l') unit = 'ml';
  else if (!price && line.unit === 'piece' && piece) unit = 'piece';
  else if (
    !price &&
    (line.unit === 'ml' || line.unit === 'tbsp' || line.unit === 'tsp' || line.unit === 'cup') &&
    density
  )
    unit = 'ml';
  const out: PlanIngredient = {
    ingredientId: ing.id,
    name: ingredientName(ing.id, lang, data),
    grams: round2(grams),
    category: ing.category,
    allergens: [...ing.allergens],
    diet: { ...ing.diet },
    unit,
    cost: round2(ingredientCost(ing, grams, data, { priceLevel: 'mid' })),
  };
  if (line.optional) out.optional = true;
  if (ing.staple) out.staple = true;
  if (unit === 'piece' && piece) out.pieceGrams = piece;
  if (density && density > 0) out.gramsPerMl = density;
  if (price?.packGrams) out.packGrams = price.packGrams;
  return out;
}

/** Catalogue recipes -> planner recipes (names and ingredient names in `lang`, grams from units, macros per serving, mid-price costs in EUR). */
export function catalogueToPlanRecipes(
  data: CatalogueData,
  lang: string,
  favoriteNames: ReadonlySet<string> = new Set(),
): PlanRecipe[] {
  const idx = ingredientIndex(data);
  return data.recipes.map((r) => {
    const name = recipeName(r, lang);
    const out: PlanRecipe = {
      id: r.id,
      name,
      slots: [...r.slots],
      servings: r.servings,
      prepMinutes: r.prepMinutes,
      cookMinutes: r.cookMinutes,
      tags: [...r.tags],
      cuisine: r.cuisine,
      ingredients: r.ingredients.map((line) => toPlanIngredient(line, idx.get(line.id), data, lang)),
      perServing: {
        calories: r.macrosPerServing.kcal,
        protein: r.macrosPerServing.protein,
        carbs: r.macrosPerServing.carbs,
        fat: r.macrosPerServing.fat,
      },
      macrosKnown: true,
      costPerServing: r.costPerServing,
      leftoverDays: r.leftoverDays,
      source: 'catalogue',
    };
    if (r.activeMinutes !== undefined) out.activeMinutes = r.activeMinutes;
    if (favoriteNames.has(mealNameKey(name))) out.favorite = true;
    return out;
  });
}

export type BuildPlanOptions = {
  startDate: string;
  lang: string;
  days?: number;
  /** Anything in here wins over the values derived from the workspace (seed, locked, slots, cookMinutesByDay...). */
  overrides?: Partial<PlanInput>;
  /** Pre-converted catalogue recipes (avoids converting 242 recipes on every swap). */
  catalogueRecipes?: PlanRecipe[];
};

/** Pantry rows -> planner pantry (expiry and pack size when known). */
function toPantry(state: LifeState): PlanPantryItem[] {
  return state.pantry.map((p) => ({
    name: p.name,
    quantity: p.quantity,
    ...(p.expiresOn ? { expiresOn: p.expiresOn.slice(0, 10) } : {}),
    ...(p.packGrams ? { packGrams: p.packGrams } : {}),
  }));
}

/** Workspace + catalogue -> planner input. Locked `plannedMeals` on the planned dates stay locked. */
export function buildPlanInput(
  state: LifeState,
  catalogue: CatalogueData,
  opts: BuildPlanOptions,
): PlanInput {
  const s = state.settings;
  const days = opts.days ?? 7;
  const start = opts.startDate;
  const favoriteNames = new Set(state.meals.filter((m) => m.favorite).map((m) => mealNameKey(m.name)));
  const catalogueRecipes =
    opts.catalogueRecipes ?? catalogueToPlanRecipes(catalogue, opts.lang, favoriteNames);
  const userRecipes = fromUserRecipes(state.recipes).map((r) =>
    favoriteNames.has(mealNameKey(r.name)) ? { ...r, favorite: true } : r,
  );
  const hasTargets = s.calorieTarget > 0 || s.proteinTarget > 0 || s.carbsTarget > 0 || s.fatTarget > 0;
  const startN = dayNumber(start);
  const recentMeals = state.meals
    .filter((m) => {
      const n = dayNumber(m.date);
      return n >= startN - 7 && n < startN;
    })
    .map((m) => ({ name: m.name, date: m.date.slice(0, 10) }));
  const end = addDays(start, days - 1);
  const locked: Record<string, string> = {};
  for (const p of state.plannedMeals) {
    const d = p.date.slice(0, 10);
    if (p.locked && p.recipeId && d >= start && d <= end) locked[`${d}|${p.slot}`] = p.recipeId;
  }
  const input: PlanInput = {
    startDate: start,
    days,
    people: s.people ?? 1,
    targets: hasTargets
      ? { calories: s.calorieTarget, protein: s.proteinTarget, carbs: s.carbsTarget, fat: s.fatTarget }
      : undefined,
    weeklyBudget: s.weeklyBudget || 0,
    currency: s.currency || 'EUR',
    priceLevel: (s.priceLevel ?? 'mid') as PriceLevel,
    cookMinutesByDay: defaultCookMinutesByDay(
      start,
      days,
      s.cookMinutesWeekday ?? 30,
      s.cookMinutesWeekend ?? 60,
    ),
    pantry: toPantry(state),
    recipes: [...catalogueRecipes, ...userRecipes],
    diet: (s.diet ?? []).filter((d): d is DietTag => (DIET_TAGS as readonly string[]).includes(d)),
    dislikes: s.dislikes ?? [],
    recentMeals,
    locked,
    prices: catalogue.prices,
    customPrices: s.customPrices,
    allergies: s.allergies ?? [],
    preferredRecipeIds: s.preferredRecipeIds ?? [],
    ...(s.portionFactor ? { portionFactor: s.portionFactor } : {}),
  };
  return { ...input, ...(opts.overrides ?? {}) };
}
