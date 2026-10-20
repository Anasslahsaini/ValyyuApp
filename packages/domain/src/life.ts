import type { z } from 'zod';
import { LifeSchema } from '@workspace/life-data';
export { LifeSchema } from '@workspace/life-data';
import { nutrientKeys, nutritionValue, type Nutrient } from './nutrition';

export const muscleGroups = ['chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'full'] as const;
export const garmentCategories = ['top', 'bottom', 'shoes', 'outerwear', 'accessory'] as const;
export const mealSlots = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
// Record schemas come from the shared LifeSchema so device, backup and server never drift apart.
const shape = LifeSchema.shape;
export const WardrobeItemSchema = shape.wardrobe.element;
export const OutfitSchema = shape.outfits.element;
export const MealEntrySchema = shape.meals.element;
export const RecipeSchema = shape.recipes.element;
export const PantryItemSchema = shape.pantry.element;
export const GroceryItemSchema = shape.groceries.element;
export const PlannedMealSchema = shape.plannedMeals.removeDefault().element;
export const WorkoutSchema = shape.workouts.element;
export const WorkoutExerciseSchema = WorkoutSchema.shape.exercises.element;
export const SessionSchema = shape.sessions.element;
export const WeightEntrySchema = shape.weightEntries.element;
export const LifeSettingsSchema = shape.settings;
export type WardrobeItem = z.infer<typeof WardrobeItemSchema>;
export type Outfit = z.infer<typeof OutfitSchema>;
export type MealEntry = z.infer<typeof MealEntrySchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
export type PantryItem = z.infer<typeof PantryItemSchema>;
export type GroceryItem = z.infer<typeof GroceryItemSchema>;
export type PlannedMeal = z.infer<typeof PlannedMealSchema>;
export type WorkoutExercise = z.infer<typeof WorkoutExerciseSchema>;
export type Workout = z.infer<typeof WorkoutSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type WeightEntry = z.infer<typeof WeightEntrySchema>;
export type LifeSettings = z.infer<typeof LifeSettingsSchema>;
export type LifeState = z.infer<typeof LifeSchema>;
export type Collection = Exclude<keyof LifeState, 'version' | 'settings'>;
export type CollectionRecord<K extends Collection> = LifeState[K][number];

export const lifeCollections = [
  'wardrobe',
  'outfits',
  'meals',
  'recipes',
  'pantry',
  'groceries',
  'plannedMeals',
  'workouts',
  'sessions',
  'weightEntries',
] as const;
export const newLifeState = (): LifeState => ({
  version: 1,
  wardrobe: [],
  outfits: [],
  meals: [],
  recipes: [],
  pantry: [],
  groceries: [],
  plannedMeals: [],
  workouts: [],
  sessions: [],
  weightEntries: [],
  settings: {
    calorieTarget: 0,
    proteinTarget: 0,
    carbsTarget: 0,
    fatTarget: 0,
    weeklyBudget: 0,
    currency: 'USD',
    equipment: [],
  },
});
export function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
export function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export type DayTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Meals of the day whose value for this nutrient is unknown (they are skipped, not counted as 0). */
  unknownCount: Record<Nutrient, number>;
  /** Meals with at least one unknown nutrient. */
  incomplete: number;
};
/** Day totals over known values only; `unknownCount` says how many meals the sums are missing. */
export function totalsForDate(meals: MealEntry[], date: string): DayTotals {
  const out: DayTotals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    unknownCount: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    incomplete: 0,
  };
  for (const meal of meals) {
    if (meal.date.slice(0, 10) !== date) continue;
    let partial = false;
    for (const key of nutrientKeys) {
      const value = nutritionValue(meal, key);
      if (value === undefined) {
        out.unknownCount[key] += 1;
        partial = true;
        continue;
      }
      out[key] += value * meal.servings;
    }
    if (partial) out.incomplete += 1;
  }
  return out;
}
export function upsertRecord<K extends Collection>(
  state: LifeState,
  collection: K,
  record: CollectionRecord<K>,
): LifeState {
  return { ...state, [collection]: [...state[collection].filter((item) => item.id !== record.id), record] };
}
export function deleteRecord(state: LifeState, collection: Collection, id: string): LifeState {
  const next = { ...state, [collection]: state[collection].filter((item) => item.id !== id) };
  if (collection === 'wardrobe') {
    next.outfits = state.outfits
      .map((outfit) => ({ ...outfit, itemIds: outfit.itemIds.filter((itemId) => itemId !== id) }))
      .filter((outfit) => outfit.itemIds.length > 0);
  }
  // A deleted user recipe must not stay in the weekly plan.
  if (collection === 'recipes')
    next.plannedMeals = state.plannedMeals.filter((m) => !(m.recipeSource === 'user' && m.recipeId === id));
  return next;
}
export { exerciseLibrary } from './exercises';

/** Backups must not silently drop unknown fields or broken relationships. */
export function validateRestorableLife(input: unknown): LifeState {
  const state = LifeSchema.parse(input);
  function checkFields(raw: unknown, parsed: unknown) {
    if (Array.isArray(raw) && Array.isArray(parsed)) {
      raw.forEach((value, index) => checkFields(value, parsed[index]));
    } else if (raw && parsed && typeof raw === 'object' && typeof parsed === 'object') {
      for (const key of Object.keys(raw)) {
        if (!Object.prototype.hasOwnProperty.call(parsed, key)) throw new Error('Unsupported backup field.');
        checkFields((raw as Record<string, unknown>)[key], (parsed as Record<string, unknown>)[key]);
      }
    }
  }
  checkFields(input, state);
  for (const collection of lifeCollections) {
    const ids = state[collection].map((record) => record.id);
    if (ids.length > 30000 || new Set(ids).size !== ids.length)
      throw new Error('Too many records or duplicate IDs.');
  }
  const clothing = new Set(state.wardrobe.map((item) => item.id));
  if (state.outfits.some((outfit) => outfit.itemIds.some((id) => !clothing.has(id)))) {
    throw new Error('An outfit refers to missing clothing.');
  }
  for (const workout of state.workouts) {
    if (new Set(workout.exercises.map((exercise) => exercise.id)).size !== workout.exercises.length) {
      throw new Error('Duplicate exercise IDs.');
    }
  }
  return state;
}
