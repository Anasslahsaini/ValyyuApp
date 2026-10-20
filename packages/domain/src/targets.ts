/**
 * Daily calorie and macro targets from the first-launch profile (pure).
 * Mifflin-St Jeor resting energy × activity from planned sessions, then the goal:
 * lose −15 % (adults only), muscle +10 %. Always an estimate, never medical advice.
 */
export type Sex = 'female' | 'male' | 'other';
export type MainGoal = 'lose' | 'maintain' | 'muscle' | 'eatBetter' | 'style';
export type TargetInput = {
  sex?: Sex;
  birthYear?: number;
  heightCm?: number;
  weightKg?: number;
  sessionsPerWeek?: number;
  mainGoal?: MainGoal;
  year?: number;
};
export type Targets = { calories: number; protein: number; carbs: number; fat: number };

/** Adults never get a plan below this; minors never get a deficit. */
export const ADULT_FLOOR_KCAL = 1500;

export function ageFrom(birthYear: number | undefined, year = new Date().getFullYear()): number | null {
  if (!birthYear) return null;
  const age = year - birthYear;
  return age >= 5 && age <= 110 ? age : null;
}

/** Activity factor from planned sessions per week (sedentary 1.2 → very active 1.725). */
export function activityFactor(sessions = 0): number {
  if (sessions <= 0) return 1.2;
  if (sessions <= 2) return 1.375;
  if (sessions <= 4) return 1.55;
  return 1.725;
}

/** Null when weight, height or age is missing: the app then shows no target instead of a fake one. */
export function computeTargets(i: TargetInput): Targets | null {
  const age = ageFrom(i.birthYear, i.year);
  if (!age || !i.heightCm || !i.weightKg) return null;
  // 'other' (or unknown) uses the midpoint of the two formulas.
  const sexTerm = i.sex === 'male' ? 5 : i.sex === 'female' ? -161 : -78;
  const resting = 10 * i.weightKg + 6.25 * i.heightCm - 5 * age + sexTerm;
  let calories = resting * activityFactor(i.sessionsPerWeek);
  const adult = age >= 18;
  if (i.mainGoal === 'lose' && adult) calories *= 0.85;
  if (i.mainGoal === 'muscle') calories *= 1.1;
  if (adult) calories = Math.max(ADULT_FLOOR_KCAL, calories);
  calories = Math.round(calories / 10) * 10;
  const protein = Math.round(i.weightKg * (i.mainGoal === 'muscle' ? 1.6 : 1.2));
  const fat = Math.round((calories * 0.3) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat };
}

/** Rough energy spent in a session (MET 5 ≈ moderate strength training); 250 kcal when unknown. */
export function sessionKcal(durationSec: number | undefined, weightKg: number | undefined): number {
  if (!durationSec || !weightKg) return 250;
  return Math.round(5 * weightKg * (durationSec / 3600));
}
