/**
 * AI nutritionist glue (pure): the compact catalogue sent to the server (diet, allergies and refused foods already
 * removed, so the AI can only pick safe recipes), the check of its picks, and the one recipe it may invent for
 * "What can I eat?" when nothing from the catalogue matches the fridge.
 */
import { fromUserRecipe } from './adapter';
import { isAllowed, prepareDislikes } from './diet';
import type { PlanRecipe, Slot } from './types';

export type CompactRecipe = {
  id: string;
  name: string;
  tags: string[];
  kcal: number;
  protein: number;
  cost?: number;
  ingredients: string[];
};
type Filters = { diet?: readonly string[]; dislikes?: readonly string[]; allergies?: readonly string[] };

/** Catalogue recipes this person may eat, in the short form the AI reads (main ingredients only, no staples). */
export function compactRecipes(recipes: readonly PlanRecipe[], f: Filters = {}): CompactRecipe[] {
  const dislikes = prepareDislikes(f.dislikes ?? []);
  return recipes
    .filter((r) => r.source === 'catalogue' && isAllowed(r, f.diet ?? [], dislikes, f.allergies ?? []))
    .slice(0, 400)
    .map((r) => ({
      id: r.id,
      name: r.name.slice(0, 120),
      tags: r.tags.slice(0, 20),
      kcal: Math.round(r.perServing.calories),
      protein: Math.round(r.perServing.protein),
      ...(typeof r.costPerServing === 'number' ? { cost: Math.round(r.costPerServing * 100) / 100 } : {}),
      ingredients: r.ingredients
        .filter((i) => !i.staple && !i.optional)
        .sort((a, b) => b.grams - a.grams)
        .slice(0, 6)
        .map((i) => i.name.slice(0, 60)),
    }));
}

/** The picks kept: ids that exist among the recipes sent (in the AI's order), portion factor in 0.5–2 (else 1). */
export function acceptPicks(
  raw: unknown,
  sent: readonly { id: string }[],
): { ids: string[]; portionFactor: number } {
  const r = raw && typeof raw === 'object' ? (raw as { recipeIds?: unknown; portionFactor?: unknown }) : {};
  const known = new Set(sent.map((x) => x.id));
  const ids = [
    ...new Set(
      (Array.isArray(r.recipeIds) ? r.recipeIds : []).filter(
        (x): x is string => typeof x === 'string' && known.has(x),
      ),
    ),
  ].slice(0, 60);
  const f = typeof r.portionFactor === 'number' && Number.isFinite(r.portionFactor) ? r.portionFactor : 1;
  return { ids, portionFactor: f >= 0.5 && f <= 2 ? Math.round(f * 20) / 20 : 1 };
}

/** Ask the AI for one recipe only when the fridge has food but no catalogue (or own) recipe uses any of it. */
export const needsAiIdea = (ideasFound: number, pantryCount: number) => pantryCount > 0 && ideasFound === 0;

export type AiFridgeRecipe = {
  name: string;
  servings: number;
  minutes: number;
  kcal: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  ingredients: Array<{ name: string; quantity: string }>;
  steps: string[];
};

/**
 * The invented recipe as a planner recipe (marked estimated, never stored as a catalogue recipe), or null when it is
 * unusable or breaks the person's diet / allergies / refused foods (checked again here with the same filters).
 */
export function aiRecipeToPlan(
  raw: unknown,
  f: Filters & { slot?: Slot } = {},
  id = 'ai-idea',
): PlanRecipe | null {
  const r = raw && typeof raw === 'object' ? (raw as Partial<AiFridgeRecipe>) : {};
  const name = typeof r.name === 'string' ? r.name.trim().slice(0, 80) : '';
  const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : [])
    .flatMap((i) =>
      i && typeof i.name === 'string' && i.name.trim()
        ? [
            `${typeof i.quantity === 'string' ? i.quantity.trim().slice(0, 30) : ''} ${i.name.trim().slice(0, 60)}`.trim(),
          ]
        : [],
    )
    .slice(0, 15);
  const steps = (Array.isArray(r.steps) ? r.steps : [])
    .filter((s): s is string => typeof s === 'string' && !!s.trim())
    .map((s) => s.trim().slice(0, 400))
    .slice(0, 10);
  if (!name || ingredients.length < 2 || !steps.length) return null;
  const n = (v: unknown, max: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(max, Math.round(v)) : 0;
  const minutes = Math.max(1, n(r.minutes, 240) || 20);
  const plan = fromUserRecipe({
    id,
    name,
    ingredients,
    steps,
    servings: Math.max(1, n(r.servings, 8) || 1),
    prepMinutes: minutes,
    cookMinutes: 0,
    calories: n(r.kcal, 3000),
    protein: n(r.protein, 300),
    carbs: n(r.carbs, 500),
    fat: n(r.fat, 300),
    estimated: true,
    ...(n(r.kcal, 3000) ? {} : { unknownNutrients: ['calories', 'protein', 'carbs', 'fat'] as const }),
  } as Parameters<typeof fromUserRecipe>[0]);
  const out: PlanRecipe = {
    ...plan,
    tags: plan.tags.filter((t) => t !== 'no_cook'),
    ...(f.slot ? { slots: [f.slot] } : {}),
  };
  return isAllowed(out, f.diet ?? [], prepareDislikes(f.dislikes ?? []), f.allergies ?? []) ? out : null;
}

/** The invented recipe's steps (trimmed, at most 10). */
export function aiRecipeSteps(raw: unknown): string[] {
  const r = raw && typeof raw === 'object' ? (raw as { steps?: unknown }) : {};
  return (Array.isArray(r.steps) ? r.steps : [])
    .filter((x): x is string => typeof x === 'string' && !!x.trim())
    .map((x) => x.trim().slice(0, 400))
    .slice(0, 10);
}
