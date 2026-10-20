export const nutrientKeys = ['calories', 'protein', 'carbs', 'fat'] as const;
export type Nutrient = (typeof nutrientKeys)[number];
type Nutrition = Record<Nutrient, number> & { unknownNutrients?: Nutrient[] | undefined };

/** Old all-zero entries are ambiguous, not evidence of a zero-calorie meal. */
export function nutritionValue(record: Nutrition, key: Nutrient): number | undefined {
  if (record.unknownNutrients) return record.unknownNutrients.includes(key) ? undefined : record[key];
  return nutrientKeys.every((k) => record[k] === 0) ? undefined : record[key];
}
/** Calories of one logged meal (all servings), or undefined when its calories are unknown. */
export function mealKcal(meal: Nutrition & { servings: number }): number | undefined {
  const v = nutritionValue(meal, 'calories');
  return v === undefined ? undefined : v * meal.servings;
}
/** "42" or, when some meals did not report this nutrient, the lower bound "≥ 42". */
export function totalLabel(value: number, unknownCount: number, digits = 0): string {
  const text = Number.isFinite(value) ? value.toFixed(digits).replace(/\.0+$/, '') : '0';
  return unknownCount > 0 ? `≥ ${text}` : text;
}
export function unknownFromFields(fields: Record<Nutrient, string>): Nutrient[] {
  return nutrientKeys.filter((key) => !fields[key].trim());
}
export function mealFromRecipe<T extends Nutrition & { name: string; estimated?: boolean }>(recipe: T) {
  return {
    name: recipe.name,
    calories: recipe.calories,
    protein: recipe.protein,
    carbs: recipe.carbs,
    fat: recipe.fat,
    servings: 1,
    estimated: recipe.estimated ?? true,
    unknownNutrients: nutrientKeys.filter((key) => nutritionValue(recipe, key) === undefined),
  };
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type MealLike = Nutrition & {
  id: string;
  name: string;
  date: string;
  slot: MealSlot;
  servings: number;
  estimated: boolean;
  favorite?: boolean | undefined;
  grams?: number | undefined;
  foodRef?: { source: 'usda' | 'off' | 'ai' | 'manual'; id: string } | undefined;
};

/** Default slot for "now": the meal people most likely mean when they open the sheet. */
export function slotForTime(at: Date = new Date()): MealSlot {
  const h = at.getHours() + at.getMinutes() / 60;
  if (h >= 4 && h < 10.5) return 'breakfast';
  if (h >= 10.5 && h < 15) return 'lunch';
  if (h >= 18 && h < 22.5) return 'dinner';
  return 'snack';
}

const round1 = (n: number) => Math.round(n * 10) / 10;
/** Macros for `grams` of a food given per 100 g (kcal to 1, macros to 0.1 g). */
export function macrosForGrams(per100g: Record<Nutrient, number>, grams: number): Record<Nutrient, number> {
  const k = Math.max(0, grams) / 100;
  return {
    calories: Math.round(per100g.calories * k),
    protein: round1(per100g.protein * k),
    carbs: round1(per100g.carbs * k),
    fat: round1(per100g.fat * k),
  };
}

export const mealNameKey = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const day = (d: string) => d.slice(0, 10);

/**
 * Meals worth re-logging in one tap: unique by name, ranked by how often they were eaten and how
 * recently. The newest entry of each name is the template (latest portion and macros).
 */
export function recentMeals<M extends MealLike>(meals: M[], limit = 12): M[] {
  const groups = new Map<string, { latest: M; count: number }>();
  for (const meal of meals) {
    const key = mealNameKey(meal.name);
    if (!key) continue;
    const g = groups.get(key);
    if (!g) groups.set(key, { latest: meal, count: 1 });
    else {
      g.count += 1;
      if (day(meal.date) >= day(g.latest.date)) g.latest = meal;
    }
  }
  const newest = meals.reduce((a, m) => (day(m.date) > a ? day(m.date) : a), '');
  const age = (d: string) => (newest ? Math.max(0, (Date.parse(newest) - Date.parse(day(d))) / 86400000) : 0);
  return (
    [...groups.values()]
      // Frequency counts most; recency (one point per week) lets new habits surface quickly.
      .map((g) => ({ ...g, score: g.count - age(g.latest.date) / 7 }))
      .sort((a, b) => b.score - a.score || day(b.latest.date).localeCompare(day(a.latest.date)))
      .slice(0, limit)
      .map((g) => g.latest)
  );
}

/** Favourite meals, unique by name (newest version of each), alphabetical. */
export function favoriteMeals<M extends MealLike>(meals: M[]): M[] {
  const byName = new Map<string, M>();
  for (const meal of meals) {
    if (!meal.favorite) continue;
    const key = mealNameKey(meal.name);
    const old = byName.get(key);
    if (!old || day(meal.date) >= day(old.date)) byName.set(key, meal);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** A favourite is a name: starring any entry stars the meal everywhere. */
export function isFavoriteName(meals: MealLike[], name: string): boolean {
  const key = mealNameKey(name);
  return meals.some((m) => m.favorite && mealNameKey(m.name) === key);
}

/** Records to save so that `meal`'s name becomes (un)favourite. Un-starring clears every copy. */
export function toggleFavorite<M extends MealLike>(meals: M[], meal: M): M[] {
  const key = mealNameKey(meal.name);
  if (isFavoriteName(meals, meal.name)) {
    return meals
      .filter((m) => m.favorite && mealNameKey(m.name) === key)
      .map((m) => ({ ...m, favorite: false }));
  }
  return [{ ...meal, favorite: true }];
}

/** A copy of `template` on another day/slot with a new id. Portion, macros and food link are kept. */
export function relogMeal<M extends MealLike>(template: M, date: string, slot: MealSlot, id: string): M {
  const { favorite: _favorite, ...rest } = template;
  return { ...rest, id, date, slot } as M;
}

/** Entries of `slot` on `fromDate`, re-dated onto `toDate`. */
export function copySlot<M extends MealLike>(
  meals: M[],
  fromDate: string,
  toDate: string,
  slot: MealSlot,
  makeId: () => string,
): M[] {
  return meals
    .filter((m) => day(m.date) === fromDate && m.slot === slot)
    .map((m) => relogMeal(m, toDate, slot, makeId()));
}
