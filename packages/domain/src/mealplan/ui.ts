/** Pure helpers for the Plan screen (no React): money, plan restore/persist, ingredient amounts, pantry expiry. */
import type { PlannedMeal } from '../life';
import { addDays, dayNumber } from './dates';
import { applyPlanToPlannedMeals } from './helpers';
import { planWeek } from './planner';
import { lockMeal } from './helpers';
import { slotKey, type PlanIngredient, type PlanInput, type PlanResult } from './types';

/** "€52" / "52,00 €" in the app language; unknown or symbol-only currencies fall back to "52 XYZ". */
export function money(amount: number, currency: string, lang: string, digits = 0): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const code = (currency || 'EUR').trim().toUpperCase();
  try {
    return new Intl.NumberFormat(lang, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return `${value.toFixed(digits)} ${currency || ''}`.trim();
  }
}

/** Where the saved plan starts and how many days it spans (yesterday onwards, at most 7 days), or null when nothing current is saved. */
export function activePlanRange(
  plannedMeals: readonly PlannedMeal[],
  today: string,
): { start: string; days: number } | null {
  const from = addDays(today, -1);
  const dates = plannedMeals
    .map((m) => m.date.slice(0, 10))
    .filter((d) => d >= from)
    .sort();
  if (!dates.length) return null;
  const start = dates[0];
  const days = Math.min(7, dayNumber(dates[dates.length - 1]) - dayNumber(start) + 1);
  return { start, days };
}

/**
 * Rebuilds a full `PlanResult` (totals, shopping, warnings) from saved `plannedMeals` by re-planning with every
 * saved meal pinned. Only meals saved as locked stay locked in the result.
 */
export function restorePlan(input: PlanInput, plannedMeals: readonly PlannedMeal[]): PlanResult {
  const pinned: Record<string, string> = {};
  const lockedKeys = new Set<string>();
  const end = addDays(input.startDate, (input.days ?? 7) - 1);
  for (const p of plannedMeals) {
    const d = p.date.slice(0, 10);
    if (!p.recipeId || d < input.startDate || d > end) continue;
    const key = slotKey(d, p.slot);
    pinned[key] = p.recipeId;
    if (p.locked) lockedKeys.add(key);
  }
  let plan = planWeek({ ...input, locked: pinned });
  for (const day of plan.days)
    for (const m of day.meals) {
      const key = slotKey(day.date, m.slot);
      if (m.locked && !lockedKeys.has(key)) plan = lockMeal(plan, key, false);
    }
  return plan;
}

/** Records to write for a plan, plus the stale saved entries on the same dates that it replaces (use in ONE save). */
export function planWrites(
  existing: readonly PlannedMeal[],
  plan: PlanResult,
): { upserts: PlannedMeal[]; deletes: string[] } {
  const upserts = applyPlanToPlannedMeals(plan);
  const keep = new Set(upserts.map((m) => m.id));
  const dates = new Set(plan.days.map((d) => d.date));
  return {
    upserts,
    deletes: existing.filter((m) => dates.has(m.date.slice(0, 10)) && !keep.has(m.id)).map((m) => m.id),
  };
}

const half = (n: number) => Math.round(n * 2) / 2;
const fraction = (n: number) => (Number.isInteger(n) ? String(n) : n < 1 ? '½' : `${Math.floor(n)}½`);
const trim = (n: number) => String(Math.round(n * 10) / 10);

/** Amount of an ingredient for `factor` x the recipe as written: "2", "350 g", "1.2 l". Empty when the amount is unknown. */
export function ingredientAmount(
  ing: Pick<PlanIngredient, 'grams' | 'unit' | 'pieceGrams' | 'gramsPerMl'>,
  factor: number,
): string {
  const grams = ing.grams * factor;
  if (!(grams > 0)) return '';
  if (ing.unit === 'piece' && ing.pieceGrams && ing.pieceGrams > 0) {
    const n = Math.max(0.5, half(grams / ing.pieceGrams));
    return fraction(n);
  }
  if (ing.unit === 'ml') {
    const ml = grams / (ing.gramsPerMl && ing.gramsPerMl > 0 ? ing.gramsPerMl : 1);
    if (ml >= 1000) return `${trim(ml / 1000)} l`;
    return `${ml >= 50 ? Math.round(ml / 5) * 5 : Math.max(1, Math.round(ml))} ml`;
  }
  if (grams >= 1000) return `${trim(grams / 1000)} kg`;
  return `${grams >= 50 ? Math.round(grams / 5) * 5 : Math.max(1, Math.round(grams))} g`;
}

/* ------------------------------------------------------------------ pantry expiry */

export type ExpiryStatus = 'expired' | 'soon' | 'ok';
export const USE_SOON_DAYS = 3;
/** 'expired' before today, 'soon' within 3 days (today included), else 'ok'. Undefined when there is no (valid) date. */
export function expiryStatus(expiresOn: string | undefined, today: string): ExpiryStatus | undefined {
  if (!expiresOn || !/^\d{4}-\d{2}-\d{2}/.test(expiresOn)) return undefined;
  const left = dayNumber(expiresOn) - dayNumber(today);
  if (left < 0) return 'expired';
  return left <= USE_SOON_DAYS ? 'soon' : 'ok';
}
export type ExpiryChip = 'tomorrow' | 'threeDays' | 'week';
export const EXPIRY_CHIPS: readonly ExpiryChip[] = ['tomorrow', 'threeDays', 'week'];
export const expiryChipDate = (chip: ExpiryChip, today: string): string =>
  addDays(today, chip === 'tomorrow' ? 1 : chip === 'threeDays' ? 3 : 7);
/** Valid calendar date written as YYYY-MM-DD (the schema's date format), or an empty string. */
export function parseExpiry(text: string): string | null {
  const v = text.trim();
  if (!v) return '';
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) &&
    d.getUTCMonth() === Number(m[2]) - 1 &&
    d.getUTCDate() === Number(m[3])
    ? v
    : null;
}
