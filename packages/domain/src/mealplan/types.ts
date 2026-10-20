/**
 * Meal planner: shared types. Everything here is plain data (JSON friendly) so the planner stays pure,
 * deterministic and independent of the recipe catalogue files (it only needs `PlanRecipe` objects).
 */

export type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const SLOT_ORDER: readonly Slot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export type PriceLevel = 'low' | 'mid' | 'high';
export type DietTag =
  'vegetarian' | 'vegan' | 'halal' | 'gluten_free' | 'dairy_free' | 'nut_free' | 'egg_free' | 'pescatarian';
export type IngredientCategory =
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
export type Allergen =
  'gluten' | 'dairy' | 'egg' | 'nuts' | 'peanut' | 'fish' | 'shellfish' | 'soy' | 'sesame';

/** Ingredient diet flags as in the catalogue (`diet` object). A missing key means "unknown": the name heuristics apply. */
export type DietFlags = Partial<
  Record<
    'vegan' | 'vegetarian' | 'pescatarian' | 'halalSafe' | 'glutenFree' | 'dairyFree' | 'nutFree' | 'eggFree',
    boolean
  >
>;

export type PlanIngredient = {
  /** Catalogue ingredient id (price lookup, merge key). Absent for user recipes. */
  ingredientId?: string;
  /** Display name in the app language (also used for pantry matching and dislikes). */
  name: string;
  /** Amount for the whole recipe as written (`PlanRecipe.servings` servings), in grams (ml are converted with the density). */
  grams: number;
  optional?: boolean;
  /** Staples (salt, pepper, water, a splash of oil...) are assumed available and never shopped. */
  staple?: boolean;
  category?: IngredientCategory;
  allergens?: Allergen[];
  diet?: DietFlags;
  /** Natural purchase unit: 'g' (default), 'ml' (liquids) or 'piece'. */
  unit?: 'g' | 'ml' | 'piece';
  /** Grams of one piece (needed to buy/price by piece). */
  pieceGrams?: number;
  /** Grams per ml (liquids); default 1. */
  gramsPerMl?: number;
  /** Typical purchase size in grams (overridden by the price table when it has `packGrams`). */
  packGrams?: number;
  /** Mid-price cost of this ingredient for the whole recipe, base currency (EUR). Fallback when the price table has no entry. */
  cost?: number;
};

export type PlanRecipe = {
  id: string;
  name: string;
  slots: Slot[];
  /** Servings the ingredient list is written for. */
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  /** Hands-on minutes (defaults to prep + cook). Used for the daily time limit when present. */
  activeMinutes?: number;
  tags: string[];
  cuisine?: string;
  ingredients: PlanIngredient[];
  /** Macros per serving. */
  perServing: { calories: number; protein: number; carbs: number; fat: number };
  /** False when the macros are unknown (user recipes with unknown nutrients): no calorie fit is attempted. */
  macrosKnown?: boolean;
  /** Cost of one serving at the 'mid' price level, base currency (EUR). Undefined = unknown. */
  costPerServing?: number;
  /** Days the cooked batch keeps (0 = eat fresh). */
  leftoverDays: number;
  source: 'catalogue' | 'user';
  favorite?: boolean;
};

export type PriceItem = {
  unit: 'kg' | 'l' | 'piece';
  mid: number;
  low?: number;
  high?: number;
  packGrams?: number;
};
export type PriceTable = {
  baseCurrency?: string;
  currencyIndex?: Record<string, number>;
  items: Record<string, PriceItem>;
};

export type PlanPantryItem = { name: string; quantity: string; expiresOn?: string; packGrams?: number };

export type PlanInput = {
  startDate: string; // YYYY-MM-DD
  days?: number; // default 7
  slots?: Slot[]; // default ['breakfast', 'lunch', 'dinner']
  people: number;
  targets?: { calories: number; protein: number; carbs: number; fat: number };
  weeklyBudget: number; // 0 = none
  currency: string;
  priceLevel?: PriceLevel;
  /** Minutes available to cook, by date. Missing dates fall back to 30 (weekday) / 60 (weekend). */
  cookMinutesByDay: Record<string, number>;
  pantry: PlanPantryItem[];
  recipes: PlanRecipe[];
  diet: string[];
  dislikes: string[];
  recentMeals: { name: string; date: string }[];
  /** 'date|slot' -> recipeId. */
  locked?: Record<string, string>;
  seed?: number;
  /** Optional price data (catalogue prices.json) and user overrides; improves shopping costs. */
  prices?: PriceTable;
  customPrices?: Record<string, number>;
  /** Declared allergies (allergen keys such as 'peanut', 'gluten'): recipes that may contain one are never planned. */
  allergies?: string[];
  /** Recipe ids the nutritionist picked for this person (most suitable first): preferred when they fit. */
  preferredRecipeIds?: string[];
  /** Portion size (1 = the recipe portion): scales calories per meal and the shopping amounts. */
  portionFactor?: number;
};

export type PlanReason =
  | 'quick'
  | 'no_cook'
  | 'uses_pantry'
  | 'use_it_first'
  | 'leftover'
  | 'batch'
  | 'cheap'
  | 'favourite'
  | 'locked'
  | 'swapped';

export type PlannedSlot = {
  slot: Slot;
  recipeId: string;
  recipeName: string;
  /** Servings eaten at this meal (people x 1 portion). */
  servings: number;
  /** Minutes of cooking this meal adds to the day (0 for leftovers and no-cook recipes). */
  minutes: number;
  /** Cost of this meal in `currency` (marginal: pantry-covered ingredients excluded; leftovers carry their share). */
  costEstimate: number;
  leftover?: boolean;
  locked?: boolean;
  /** Pantry items consumed (pantry item names as the user wrote them). */
  uses: string[];
  /** Structured, language-neutral reasons the meal was picked. */
  reasons: PlanReason[];
  source: 'catalogue' | 'user';
  /** 'date|slot' of the meal that cooks the batch when this is a leftover meal. */
  batchOf?: string;
  /** Per person calories of the portion (0 when unknown). */
  calories: number;
  /** Per person grams of protein of the portion (0 when unknown). */
  protein: number;
};

export type PlanDay = { date: string; meals: PlannedSlot[] };

export type ShoppingLine = {
  ingredientId?: string;
  name: string;
  /** Purchase quantity in `unit` (already rounded up to a purchase size). */
  qty: number;
  unit: 'g' | 'ml' | 'piece';
  packs?: number;
  packGrams?: number;
  /** Grams needed by the plan, before the pantry and before rounding. */
  neededGrams: number;
  /** Grams covered by the pantry. */
  pantryGrams: number;
  category?: IngredientCategory;
  costEstimate: number;
  /** False when no price was found: the line is excluded from totals. */
  priceKnown: boolean;
  forRecipeIds: string[];
};

export type PlanWarningCode =
  | 'slot_unfilled'
  | 'few_recipes_fit_time'
  | 'budget_infeasible'
  | 'budget_too_low_for_diet'
  | 'price_missing'
  | 'locked_recipe_missing'
  | 'locked_over_time'
  | 'calories_off_target'
  | 'targets_assumed'
  | 'repeats_unavoidable'
  | 'no_recipes';
export type PlanWarning = { code: PlanWarningCode; params?: Record<string, string | number> };

export type PlanResult = {
  days: PlanDay[];
  shopping: ShoppingLine[];
  totals: {
    cost: number;
    budget: number;
    overBudgetBy?: number;
    avgCalories: number;
    avgProtein: number;
    minutesByDay: Record<string, number>;
  };
  /** Machine-readable codes (same order as `warningDetails`); translate in the UI. */
  warnings: string[];
  warningDetails: PlanWarning[];
  currency: string;
  /** Echo of the seed used (for Regenerate). */
  seed: number;
  /** Shopping lines whose price is unknown (excluded from totals). */
  unpricedCount: number;
};

export const slotKey = (date: string, slot: Slot) => `${date}|${slot}`;
