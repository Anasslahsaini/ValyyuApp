/** UI-facing helpers on top of the planner: swap, lock, explain, persist, "what's for today". */
import type { PlannedMeal } from '../life';
import { planWithOptions, type FixedMeal } from './planner';
import {
  slotKey,
  type PlanInput,
  type PlanReason,
  type PlanResult,
  type PlannedSlot,
  type Slot,
} from './types';

const findMeal = (plan: PlanResult, key: string): { date: string; meal: PlannedSlot } | undefined => {
  for (const day of plan.days)
    for (const meal of day.meals) if (slotKey(day.date, meal.slot) === key) return { date: day.date, meal };
  return undefined;
};

/**
 * Re-pick one slot ('date|slot'), keeping every other meal as it is. Leftover meals fed by the swapped batch are re-planned too.
 * The previous recipe is excluded. A locked meal is returned unchanged. `seed` defaults to `plan.seed + 1`.
 */
export function swapMeal(
  plan: PlanResult,
  input: PlanInput,
  dateSlotKey: string,
  seed: number = plan.seed + 1,
): PlanResult {
  const target = findMeal(plan, dateSlotKey);
  if (!target || target.meal.locked) return plan;
  const fixed: FixedMeal[] = [];
  for (const day of plan.days) {
    for (const m of day.meals) {
      const key = slotKey(day.date, m.slot);
      if (key === dateSlotKey || m.batchOf === dateSlotKey) continue;
      fixed.push({
        date: day.date,
        slot: m.slot,
        recipeId: m.recipeId,
        leftover: m.leftover,
        batchOf: m.batchOf,
        locked: m.locked,
      });
    }
  }
  // Leftovers of the swapped meal may also have been the only reason for the same recipe elsewhere: avoid it for the target only.
  return planWithOptions(
    { ...input, seed },
    { fixed, avoidRecipeIds: [target.meal.recipeId], swappedKeys: [dateSlotKey] },
  );
}

/** Lock / unlock a meal (pure; no re-plan needed). */
export function lockMeal(plan: PlanResult, dateSlotKey: string, locked = true): PlanResult {
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      meals: day.meals.map((m) => {
        if (slotKey(day.date, m.slot) !== dateSlotKey) return m;
        const { locked: _old, ...rest } = m;
        return locked
          ? {
              ...rest,
              locked: true,
              reasons: m.reasons.includes('locked') ? m.reasons : [...m.reasons, 'locked' as PlanReason],
            }
          : { ...rest, reasons: m.reasons.filter((r) => r !== 'locked') };
      }),
    })),
  };
}

/** `locked` map for `planWeek` (e.g. "Regenerate" keeps locked meals). A locked leftover also locks the meal that cooks it. */
export function lockedFromPlan(plan: PlanResult): Record<string, string> {
  const out: Record<string, string> = {};
  for (const day of plan.days) {
    for (const m of day.meals) {
      if (!m.locked) continue;
      out[slotKey(day.date, m.slot)] = m.recipeId;
      if (m.batchOf) {
        const parent = findMeal(plan, m.batchOf);
        if (parent) out[m.batchOf] = parent.meal.recipeId;
      }
    }
  }
  return out;
}

export type MealExplanation = {
  minutes: number;
  noCook: boolean;
  leftover: boolean;
  locked: boolean;
  /** Pantry items consumed (as the user named them). */
  usesPantry: string[];
  costEstimate: number;
  currency?: string;
  reasons: PlanReason[];
  /** 'date|slot' of the meal that cooks this batch, for leftovers. */
  cookedAt?: string;
};
/** Structured "why this meal" data, e.g. { minutes: 25, usesPantry: ['rice','spinach'], costEstimate: 2.4 }. The UI formats and translates it. */
export function explainMeal(meal: PlannedSlot, currency?: string): MealExplanation {
  return {
    minutes: meal.minutes,
    noCook: meal.reasons.includes('no_cook'),
    leftover: !!meal.leftover,
    locked: !!meal.locked,
    usesPantry: meal.uses,
    costEstimate: meal.costEstimate,
    currency,
    reasons: meal.reasons,
    cookedAt: meal.batchOf,
  };
}

/** Plan -> `plannedMeals` records (ids are stable: `pm-<date>-<slot>`, so re-saving a plan replaces entries). */
export function applyPlanToPlannedMeals(plan: PlanResult): PlannedMeal[] {
  const out: PlannedMeal[] = [];
  for (const day of plan.days) {
    for (const m of day.meals) {
      out.push({
        id: `pm-${day.date}-${m.slot}`,
        date: day.date,
        slot: m.slot,
        recipeId: m.recipeId,
        recipeSource: m.source,
        name: m.recipeName,
        servings: m.servings,
        minutes: Math.round(m.minutes),
        costEstimate: m.costEstimate,
        ...(m.locked ? { locked: true } : {}),
        ...(m.leftover ? { leftover: true } : {}),
      });
    }
  }
  return out;
}

/** Existing records minus those on the dates the new plan covers, plus the new plan (use this when saving a plan). */
export function mergePlanIntoPlannedMeals(existing: readonly PlannedMeal[], plan: PlanResult): PlannedMeal[] {
  const dates = new Set(plan.days.map((d) => d.date));
  return [...existing.filter((m) => !dates.has(m.date.slice(0, 10))), ...applyPlanToPlannedMeals(plan)];
}

const RANK: Record<Slot, number> = { breakfast: 0, lunch: 1, snack: 2, dinner: 3 };
const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Next meal today: the first planned meal whose time window has not passed (breakfast <10h, lunch <15h, snack <18h, then dinner). */
export function mealForToday(
  plannedMeals: readonly PlannedMeal[],
  now: Date = new Date(),
): PlannedMeal | undefined {
  const today = localDate(now),
    h = now.getHours() + now.getMinutes() / 60;
  const current = h < 10 ? 0 : h < 15 ? 1 : h < 18 ? 2 : 3;
  return plannedMeals
    .filter((m) => m.date.slice(0, 10) === today && RANK[m.slot] >= current)
    .sort((a, b) => RANK[a.slot] - RANK[b.slot] || a.id.localeCompare(b.id))[0];
}
