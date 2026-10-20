/** Plan -> journal: the entry written when the user cooks / eats a planned meal (pure; the caller saves it). */
import type { MealEntry, PlannedMeal, Recipe } from '../life';
import { mealFromRecipe } from '../nutrition';
import type { CatalogueData } from '../recipe-catalogue';

/** Stable link between a journal entry and the planned meal it came from (also how the plan shows a meal as done). */
export const planMealRef = (date: string, slot: string) => `plan-${date.slice(0, 10)}-${slot}`;

export const isPlannedMealDone = (
  meals: readonly Pick<MealEntry, 'foodRef'>[],
  planned: Pick<PlannedMeal, 'date' | 'slot'>,
): boolean => {
  const ref = planMealRef(planned.date, planned.slot);
  return meals.some((m) => m.foodRef?.id === ref);
};

/**
 * One portion of the planned recipe for that date and slot. Macros come from the user recipe or the catalogue (labelled as an
 * estimate); a recipe that cannot be found is still logged, with unknown nutrients rather than invented numbers.
 */
export function entryForPlannedMeal(
  planned: Pick<PlannedMeal, 'date' | 'slot' | 'name' | 'recipeId' | 'recipeSource'>,
  sources: { recipes: readonly Recipe[]; catalogue: CatalogueData | null },
  id: string,
  /** Portion size from My info (the nutritionist's suggestion); 1 = one recipe portion. */
  portion = 1,
): MealEntry {
  const servings = Math.max(0.5, Math.min(2, Number.isFinite(portion) ? Math.round(portion * 100) / 100 : 1));
  const base = {
    id,
    date: planned.date.slice(0, 10),
    slot: planned.slot,
    foodRef: { source: 'manual' as const, id: planMealRef(planned.date, planned.slot) },
    ...(servings !== 1 ? { servings } : {}),
  };
  const user =
    planned.recipeSource !== 'catalogue' ? sources.recipes.find((r) => r.id === planned.recipeId) : undefined;
  if (user) return { ...mealFromRecipe(user), ...base, name: planned.name.slice(0, 180) } as MealEntry;
  const cat = sources.catalogue?.recipes.find((r) => r.id === planned.recipeId);
  if (cat) {
    const m = cat.macrosPerServing;
    return {
      ...mealFromRecipe({
        name: planned.name,
        calories: m.kcal,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        estimated: true,
      }),
      ...base,
      name: planned.name.slice(0, 180),
    } as MealEntry;
  }
  return {
    servings: 1,
    ...base,
    name: planned.name.slice(0, 180),
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    estimated: true,
    unknownNutrients: ['calories', 'protein', 'carbs', 'fat'],
  } as MealEntry;
}
