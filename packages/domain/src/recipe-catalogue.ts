/**
 * Typed, lazy loader and pure helpers for the built-in recipe catalogue (data/recipes/*).
 * Data is original; nutrition comes from USDA SR Legacy (public domain) or is marked as an
 * estimate; prices are approximate estimates, never live prices.
 */

export type CatalogueSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type CatalogueUnit = 'g' | 'ml' | 'piece' | 'tbsp' | 'tsp' | 'cup';
export type CatalogueCuisine =
  | 'maghreb'
  | 'french'
  | 'mediterranean'
  | 'middle_eastern'
  | 'italian'
  | 'asian'
  | 'mexican'
  | 'american'
  | 'indian'
  | 'other';
export type CatalogueCategory =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'fish'
  | 'grain'
  | 'legume'
  | 'bakery'
  | 'pantry'
  | 'frozen'
  | 'spice'
  | 'oil'
  | 'drink'
  | 'other';
export type CatalogueAllergen =
  'gluten' | 'dairy' | 'egg' | 'nuts' | 'peanut' | 'fish' | 'shellfish' | 'soy' | 'sesame';
export type CatalogueTag =
  | 'vegetarian'
  | 'vegan'
  | 'pescatarian'
  | 'gluten_free'
  | 'dairy_free'
  | 'nut_free'
  | 'egg_free'
  | 'halal'
  | 'one_pot'
  | 'batch_friendly'
  | 'freezer_friendly'
  | 'no_cook'
  | 'high_protein'
  | 'budget'
  | 'kid_friendly'
  | 'quick';
export type CataloguePriceLevel = 'low' | 'mid' | 'high';

export type CatalogueLocalized = { en: string; fr: string };

export type CatalogueIngredient = {
  id: string;
  name: CatalogueLocalized;
  category: CatalogueCategory;
  per100g: { calories: number; protein: number; carbs: number; fat: number };
  /** Grams per unit; `ml` is the density in g per ml. Only the units that make sense are present. */
  gramsPerUnit: Partial<Record<Exclude<CatalogueUnit, 'g'>, number>>;
  /** Assumed to be at home: costs nothing in a plan. */
  staple: boolean;
  allergens: CatalogueAllergen[];
  diet: {
    vegan: boolean;
    vegetarian: boolean;
    pescatarian: boolean;
    halalSafe: boolean;
    glutenFree: boolean;
    dairyFree: boolean;
    nutFree: boolean;
    eggFree: boolean;
  };
  source: 'usda-sr-legacy' | 'estimate';
};

export type CataloguePriceItem = {
  unit: 'kg' | 'l' | 'piece';
  mid: number;
  low: number;
  high: number;
  packGrams: number;
};

export type CataloguePrices = {
  baseCurrency: 'EUR';
  note: string;
  currencyIndex: Record<string, number>;
  items: Record<string, CataloguePriceItem>;
};

export type CatalogueRecipeLine = { id: string; qty: number; unit: CatalogueUnit; optional?: boolean };

export type CatalogueRecipe = {
  id: string;
  name: CatalogueLocalized;
  slots: CatalogueSlot[];
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  activeMinutes?: number;
  tags: CatalogueTag[];
  cuisine: CatalogueCuisine;
  ingredients: CatalogueRecipeLine[];
  steps: { en: string[]; fr: string[] };
  leftoverDays: number;
  /** Computed by scripts/build-recipes.mjs (tags also include the derived diet/quick/budget ones). */
  macrosPerServing: { kcal: number; protein: number; carbs: number; fat: number };
  /** EUR per serving at the mid price, staples excluded. */
  costPerServing: number;
};

export type CatalogueData = {
  version: number;
  recipes: CatalogueRecipe[];
  ingredients: CatalogueIngredient[];
  prices: CataloguePrices;
};

export type CatalogueCostOptions = {
  priceLevel?: CataloguePriceLevel;
  /** ISO code looked up in prices.currencyIndex; unknown codes behave like EUR. */
  currency?: string;
  /** User-entered prices per kg / l / piece (in the chosen currency), keyed by ingredient id or name. */
  customPrices?: Record<string, number>;
  /** Defaults to the catalogue loaded by `loadCatalogue()`. */
  catalogue?: CatalogueData;
};

let cataloguePromise: Promise<CatalogueData> | null = null;
let loaded: CatalogueData | null = null;

function unwrap<T>(m: unknown): T {
  return ((m as { default?: unknown }).default ?? m) as T;
}

/** Recipes, ingredients and prices (~400 KB of JSON) are only parsed the first time they are needed. */
export function loadCatalogue(): Promise<CatalogueData> {
  if (!cataloguePromise) {
    cataloguePromise = Promise.all([
      import('../data/recipes/recipes.built.json'),
      import('../data/recipes/ingredients.json'),
      import('../data/recipes/prices.json'),
    ])
      .then(([r, i, p]) => {
        const built = unwrap<{ version: number; recipes: CatalogueRecipe[] }>(r);
        const data: CatalogueData = {
          version: built.version,
          recipes: built.recipes,
          ingredients: unwrap<CatalogueIngredient[]>(i),
          prices: unwrap<CataloguePrices>(p),
        };
        loaded = data;
        return data;
      })
      .catch((error: unknown) => {
        cataloguePromise = null;
        throw error;
      });
  }
  return cataloguePromise;
}

/** The catalogue if `loadCatalogue()` has already resolved, else null. */
export function loadedCatalogue(): CatalogueData | null {
  return loaded;
}

const indexCache = new WeakMap<CatalogueData, Map<string, CatalogueIngredient>>();
export function ingredientIndex(data: CatalogueData): Map<string, CatalogueIngredient> {
  let idx = indexCache.get(data);
  if (!idx) {
    idx = new Map(data.ingredients.map((i) => [i.id, i]));
    indexCache.set(data, idx);
  }
  return idx;
}

function pickLang(name: CatalogueLocalized, lang: string): string {
  const key = lang.toLowerCase().slice(0, 2);
  const v = (name as Record<string, string | undefined>)[key];
  return v && v.length > 0 ? v : name.en;
}

/** Localised recipe name; languages other than fr fall back to English. */
export function recipeName(recipe: Pick<CatalogueRecipe, 'name'>, lang: string): string {
  return pickLang(recipe.name, lang);
}

/** Localised ingredient name; unknown ids are shown as a readable version of the id. */
export function ingredientName(id: string, lang: string, catalogue?: CatalogueData): string {
  const data = catalogue ?? loaded;
  const ing = data ? ingredientIndex(data).get(id) : undefined;
  if (ing) return pickLang(ing.name, lang);
  const text = id.replace(/-/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Localised steps; falls back to English. */
export function recipeSteps(recipe: Pick<CatalogueRecipe, 'steps'>, lang: string): string[] {
  const key = lang.toLowerCase().slice(0, 2) as 'en' | 'fr';
  const steps = recipe.steps[key];
  return steps && steps.length > 0 ? steps : recipe.steps.en;
}

/** Grams of an ingredient for a recipe line; 0 when the unit is unknown for that ingredient. */
export function lineGrams(ing: CatalogueIngredient, qty: number, unit: CatalogueUnit): number {
  if (unit === 'g') return qty;
  if (unit === 'ml') return qty * (ing.gramsPerUnit.ml ?? 1);
  const g = ing.gramsPerUnit[unit];
  return typeof g === 'number' && g > 0 ? qty * g : 0;
}

function norm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function customPriceFor(ing: CatalogueIngredient, custom: Record<string, number>): number | undefined {
  const direct = custom[ing.id];
  if (typeof direct === 'number' && direct >= 0) return direct;
  const wanted = [norm(ing.name.en), norm(ing.name.fr), norm(ing.id)];
  for (const [key, value] of Object.entries(custom)) {
    if (typeof value === 'number' && value >= 0 && wanted.includes(norm(key))) return value;
  }
  return undefined;
}

/** Cost of `grams` of an ingredient in the requested currency (staples cost 0). */
export function ingredientCost(
  ing: CatalogueIngredient,
  grams: number,
  data: CatalogueData,
  options: CatalogueCostOptions = {},
): number {
  if (ing.staple || grams <= 0) return 0;
  const level = options.priceLevel ?? 'mid';
  const fx = data.prices.currencyIndex[options.currency ?? 'EUR'] ?? 1;
  const entry = data.prices.items[ing.id];
  const custom = options.customPrices ? customPriceFor(ing, options.customPrices) : undefined;
  if (custom !== undefined) {
    // user prices are already in their currency, per kg, l or piece like the catalogue unit
    const unit = entry?.unit ?? 'kg';
    return unitCost(ing, unit, custom, grams);
  }
  if (!entry) return 0;
  return unitCost(ing, entry.unit, entry[level], grams) * fx;
}

function unitCost(
  ing: CatalogueIngredient,
  unit: CataloguePriceItem['unit'],
  price: number,
  grams: number,
): number {
  if (unit === 'kg') return (grams / 1000) * price;
  if (unit === 'l') return (grams / (ing.gramsPerUnit.ml ?? 1) / 1000) * price;
  const piece = ing.gramsPerUnit.piece;
  return piece ? (grams / piece) * price : 0;
}

/**
 * Estimated cost of cooking `recipe` for `servings` people. Quantities scale linearly from the
 * recipe's own servings; staples are free. Result is in `options.currency` (default EUR).
 */
export function costForRecipe(
  recipe: Pick<CatalogueRecipe, 'ingredients' | 'servings'>,
  servings: number,
  options: CatalogueCostOptions = {},
): number {
  const data = options.catalogue ?? loaded;
  if (!data)
    throw new Error(
      'costForRecipe needs the catalogue: await loadCatalogue() first or pass options.catalogue',
    );
  const idx = ingredientIndex(data);
  const scale = servings / recipe.servings;
  let total = 0;
  for (const line of recipe.ingredients) {
    const ing = idx.get(line.id);
    if (!ing) continue;
    total += ingredientCost(ing, lineGrams(ing, line.qty, line.unit) * scale, data, options);
  }
  return Math.round(total * 100) / 100;
}
