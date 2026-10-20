import { z } from 'zod';
const id = z.string().min(1).max(160),
  name = z.string().trim().min(1).max(180);
const n = z.number().finite().min(0).max(100000);
const macros = { calories: n, protein: n, carbs: n, fat: n };
const unknownNutrients = z
  .array(z.enum(['calories', 'protein', 'carbs', 'fat']))
  .max(4)
  .optional();
const recipeDetails = {
  servings: z.number().int().min(1).max(100).optional(),
  prepMinutes: z.number().int().min(0).max(600).optional(),
  cookMinutes: z.number().int().min(0).max(600).optional(),
  nutritionNote: z.string().max(1000).optional(),
  estimated: z.boolean().optional(),
  unknownNutrients,
};
const muscle = z.enum(['chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'full']);
const set = z.object({
  reps: z.number().int().min(0).max(100),
  weight: z.number().min(0).max(500),
  completed: z.boolean(),
  rir: z.number().int().min(0).max(5).optional(),
  warmup: z.boolean().optional(),
});
const level = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const dietEnum = z.enum([
  'vegetarian',
  'vegan',
  'halal',
  'gluten_free',
  'dairy_free',
  'nut_free',
  'egg_free',
  'pescatarian',
]);
const date = z.string().min(10).max(35);
const per100g = z.object(macros).optional();
const foodRef = z
  .object({ source: z.enum(['usda', 'off', 'ai', 'manual']), id: z.string().min(1).max(80) })
  .optional();
const exercise = z.object({
  id,
  name,
  muscle,
  equipment: z.string().max(100),
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(100),
  weight: z.number().min(0).max(500),
  restSeconds: z.number().int().min(0).max(600),
});
/** Same persisted format on device and server. No account identity is accepted in a snapshot. */
export const LifeSchema = z.object({
  version: z.literal(1),
  wardrobe: z
    .array(
      z.object({
        id,
        name,
        category: z.enum(['top', 'bottom', 'shoes', 'outerwear', 'accessory']),
        color: z.string().max(80),
        imageUri: z.string().max(2000000).optional(),
        colorHex: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        warmth: level.optional(),
        formality: level.optional(),
        seasons: z
          .array(z.enum(['spring', 'summer', 'autumn', 'winter']))
          .max(4)
          .optional(),
        pattern: z.string().max(40).optional(),
        status: z.enum(['clean', 'laundry', 'away']).optional(),
        lastWornAt: date.optional(),
        wearCount: z.number().int().min(0).max(100000).optional(),
        favorite: z.boolean().optional(),
      }),
    )
    .max(2000),
  outfits: z
    .array(
      z.object({
        id,
        name,
        itemIds: z.array(id).min(1).max(12),
        date: z.string().optional(),
        notes: z.string().max(1000).optional(),
        wornOn: z.array(date).max(1000).optional(),
        source: z.enum(['manual', 'auto', 'assistant']).optional(),
        favorite: z.boolean().optional(),
      }),
    )
    .max(5000),
  meals: z
    .array(
      z.object({
        id,
        name,
        date,
        slot: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
        ...macros,
        estimated: z.boolean(),
        servings: z.number().min(0.1).max(100),
        unknownNutrients,
        favorite: z.boolean().optional(),
        grams: z.number().min(0).max(10000).optional(),
        foodRef,
      }),
    )
    .max(30000),
  recipes: z
    .array(
      z.object({
        id,
        name,
        ingredients: z.array(z.string().min(1).max(200)).max(30),
        steps: z.array(z.string().min(1).max(1000)).max(20),
        ...macros,
        ...recipeDetails,
        favorite: z.boolean().optional(),
      }),
    )
    .max(5000),
  pantry: z
    .array(
      z.object({
        id,
        name,
        quantity: z.string().max(100),
        barcode: z
          .string()
          .regex(/^[0-9]{6,14}$/)
          .optional(),
        per100g,
        packGrams: z.number().min(0).max(100000).optional(),
        expiresOn: date.optional(),
      }),
    )
    .max(5000),
  groceries: z
    .array(
      z.object({
        id,
        name,
        quantity: z.string().max(100),
        estimatedCost: n,
        checked: z.boolean(),
        recipeIds: z.array(id).max(50).optional(),
      }),
    )
    .max(5000),
  /** Weekly meal plan entries (written by the planner). Absent in older backups/stored state: defaults to []. */
  plannedMeals: z
    .array(
      z.object({
        id,
        date,
        slot: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
        recipeId: id.optional(),
        recipeSource: z.enum(['catalogue', 'user']).optional(),
        name,
        servings: z.number().min(0.1).max(100),
        minutes: z.number().int().min(0).max(1000).optional(),
        costEstimate: n.optional(),
        locked: z.boolean().optional(),
        leftover: z.boolean().optional(),
      }),
    )
    .max(5000)
    .default([]),
  workouts: z.array(z.object({ id, name, exercises: z.array(exercise).min(1).max(30) })).max(5000),
  sessions: z
    .array(
      z.object({
        id,
        workoutName: name,
        date,
        exercises: z
          .array(
            z.object({
              name,
              muscle,
              sets: z.array(set).max(20),
              restSeconds: z.number().int().min(0).max(600).optional(),
            }),
          )
          .max(30),
        workoutId: id.optional(),
        durationSec: z.number().int().min(0).max(86400).optional(),
        source: z.enum(['plan', 'today', 'voice', 'manual']).optional(),
      }),
    )
    .max(20000),
  weightEntries: z.array(z.object({ id, date, weight: z.number().min(20).max(400) })).max(20000),
  settings: z.object({
    calorieTarget: n,
    proteinTarget: n,
    carbsTarget: n,
    fatTarget: n,
    weeklyBudget: n,
    currency: z.string().min(1).max(8),
    equipment: z.array(z.string().min(1).max(80)).max(30),
    goal: z.enum(['strength', 'muscle', 'general']).optional(),
    unit: z.enum(['kg', 'lb']).optional(),
    barKg: z.number().min(0).max(50).optional(),
    plates: z.array(z.number().min(0.25).max(50)).max(12).optional(),
    repRange: z.tuple([z.number().int().min(1).max(50), z.number().int().min(1).max(50)]).optional(),
    minutes: z.number().int().min(10).max(180).optional(),
    defaultFormality: level.optional(),
    // Meal planner (all optional; defaults are applied by the planner: 1 person, 30/60 min, no diet, mid prices).
    people: z.number().int().min(1).max(12).optional(),
    cookMinutesWeekday: z.number().int().min(0).max(240).optional(),
    cookMinutesWeekend: z.number().int().min(0).max(240).optional(),
    diet: z.array(dietEnum).max(8).optional(),
    dislikes: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
    priceLevel: z.enum(['low', 'mid', 'high']).optional(),
    // First-launch profile (asked once, editable in Profile → Mes infos). All optional: every question can be skipped.
    firstName: z.string().trim().min(1).max(40).optional(),
    mainGoal: z.enum(['lose', 'maintain', 'muscle', 'eatBetter', 'style']).optional(),
    sex: z.enum(['female', 'male', 'other']).optional(),
    birthYear: z.number().int().min(1900).max(2100).optional(),
    heightCm: z.number().int().min(90).max(250).optional(),
    trainingPlace: z.enum(['home', 'gym', 'none']).optional(),
    sessionsPerWeek: z.number().int().min(0).max(7).optional(),
    styleVibes: z.array(z.string().min(1).max(30)).max(6).optional(),
    onboardedAt: z.string().max(40).optional(),
    // Coach and nutritionist (all optional). Session length uses `minutes` above; refused foods use `dislikes`.
    fitnessLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    injuries: z
      .array(z.enum(['shoulder', 'elbow', 'wrist', 'back', 'neck', 'hip', 'knee', 'ankle']))
      .max(8)
      .optional(),
    allergies: z
      .array(z.enum(['peanut', 'nuts', 'dairy', 'egg', 'gluten', 'fish', 'shellfish', 'soy', 'sesame']))
      .max(9)
      .optional(),
    likedFoods: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    /** Catalogue recipe ids the AI nutritionist picked (the planner prefers them) and the portion size it suggested. */
    preferredRecipeIds: z.array(z.string().min(1).max(80)).max(60).optional(),
    portionFactor: z.number().min(0.5).max(2).optional(),
    /** The chosen 4-week program: its days are saved plans in `workouts` (ids in order). */
    program: z
      .object({
        id: z.string().min(1).max(80),
        name: z.string().trim().min(1).max(60),
        key: z.enum(['express', 'balanced', 'intense']).optional(),
        workoutIds: z.array(z.string().min(1).max(160)).min(1).max(7),
        startedAt: z.string().min(10).max(40),
        weeks: z.number().int().min(1).max(12),
      })
      .optional(),
    /** Ingredient id or name -> user-entered price per kg / l / piece (in `currency`). */
    customPrices: z
      .record(z.string().min(1).max(80), z.number().finite().min(0).max(10000))
      .refine((r) => Object.keys(r).length <= 500, 'Too many custom prices')
      .optional(),
  }),
});
export type LifeState = z.infer<typeof LifeSchema>;
export const collections = [
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
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
/** Refuse conflicting IDs rather than silently discarding edits from either device. */
export function mergeWorkspaces(local: LifeState, remote: LifeState): LifeState {
  const result = clone(local);
  for (const collection of collections) {
    const localItems = new Map<string, unknown>((local[collection] ?? []).map((item) => [item.id, item]));
    if (collection === 'plannedMeals') {
      // Plans are derived data and cheap to regenerate: never block a sync on them. One entry per date+slot; local wins, locked beats unlocked.
      const slotKey = (m: { date: string; slot: string }) => `${m.date}|${m.slot}`;
      const plan = result.plannedMeals ?? (result.plannedMeals = []);
      for (const item of remote.plannedMeals ?? []) {
        if (localItems.has(item.id)) continue;
        const at = plan.findIndex((m) => slotKey(m) === slotKey(item));
        if (at < 0) plan.push(clone(item));
        else if (item.locked && !plan[at]?.locked) plan[at] = clone(item);
      }
      continue;
    }
    for (const item of remote[collection] ?? []) {
      const old = localItems.get(item.id);
      const comparable = (value: unknown) => {
        if (collection !== 'wardrobe') return value;
        const { imageUri: _photo, ...record } = value as Record<string, unknown>;
        return record;
      };
      if (old && JSON.stringify(comparable(old)) !== JSON.stringify(comparable(item)))
        throw new Error(
          `Conflicting ${collection} edits. Nothing was changed. Export your device data before choosing which copy to keep.`,
        );
      if (!old) ((result[collection] ??= []) as { id: string }[]).push(clone(item));
    }
  }
  // Existing device goals are retained; empty/new devices get the account goals.
  if (
    collections.every((key) => (local[key] ?? []).length === 0) &&
    !local.settings.calorieTarget &&
    !local.settings.proteinTarget &&
    !local.settings.carbsTarget &&
    !local.settings.fatTarget &&
    !local.settings.weeklyBudget &&
    local.settings.currency === 'USD' &&
    !local.settings.equipment.length
  )
    result.settings = clone(remote.settings);
  return LifeSchema.parse(result);
}
