/**
 * Repas actions as data writes (one atomic save each): log a meal, cook a fridge idea, move the bought list to the fridge.
 */
import { createId, type LifeState, type MealEntry } from './life';
import { consumePantry, groceriesToPantry, type PlanRecipe } from './mealplan';
import type { Writes } from './week-writes';

type Slot = MealEntry['slot'];

/** A meal typed by hand: unknown macros stay 0, the entry is an estimate. */
export function mealEntry(
  input: {
    name: string;
    date: string;
    slot: Slot;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  },
  id: string = createId(),
): MealEntry {
  return {
    id,
    name: input.name.trim(),
    date: input.date,
    slot: input.slot,
    calories: input.calories ?? 0,
    protein: input.protein ?? 0,
    carbs: input.carbs ?? 0,
    fat: input.fat ?? 0,
    estimated: true,
    servings: 1,
  };
}

/** "Je l'ai cuisiné": the meal (one portion) plus what the cooked servings take out of the fridge. */
export function cookedWrites(
  state: LifeState,
  recipe: PlanRecipe,
  opts: { date: string; slot: Slot; servings: number; id?: string },
): Writes {
  const meal: MealEntry = {
    ...mealEntry({ name: recipe.name, date: opts.date, slot: opts.slot, ...recipe.perServing }, opts.id),
    foodRef: { source: 'manual', id: recipe.id.slice(0, 80) },
    ...(recipe.macrosKnown === false
      ? { unknownNutrients: ['calories', 'protein', 'carbs', 'fat'] as MealEntry['unknownNutrients'] }
      : {}),
  };
  const used = consumePantry(state.pantry, recipe.ingredients, opts.servings / (recipe.servings || 1));
  return {
    upserts: [
      { collection: 'meals', record: meal },
      ...used.updates.map((record) => ({ collection: 'pantry' as const, record })),
    ],
    deletes: used.deletes.map((id) => ({ collection: 'pantry' as const, id })),
  };
}

/** "Tout est acheté": every line goes into the fridge (merged with what is there) and the list is emptied. */
export function allBoughtWrites(state: LifeState, idFactory: () => string = createId): Writes {
  const moved = groceriesToPantry(state.groceries, state.pantry, idFactory);
  return {
    upserts: [...moved.add, ...moved.update].map((record) => ({ collection: 'pantry' as const, record })),
    deletes: state.groceries.map((g) => ({ collection: 'groceries' as const, id: g.id })),
  };
}
