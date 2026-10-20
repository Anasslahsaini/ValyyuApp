/**
 * First launch, design v1 (O0-O7): the onboarding draft becomes settings, with the rules the screens promise.
 * - No health-data consent: height, weight, sex, allergies and pain are dropped, and there is no calorie target.
 * - Under 18: never a weight goal and never a calorie target ("on s'occupe de l'équilibre").
 * - Under 15: nothing is saved.
 */
import type { LifeSettings } from '../life';
import { MIN_AGE, settingsPatch, type Draft } from '../onboarding';

export type FirstLaunchDraft = Draft & { noPork?: boolean };
const ADULT_AGE = 18;

export function finishFirstLaunch(
  draft: FirstLaunchDraft,
  healthConsent: boolean,
  current: LifeSettings,
  {
    year = new Date().getFullYear(),
    now = new Date().toISOString(),
    deviceCurrency,
  }: { year?: number; now?: string; deviceCurrency?: string } = {},
): Partial<LifeSettings> {
  if (typeof draft.age !== 'number' || draft.age < MIN_AGE)
    throw new Error(`The app is for people aged ${String(MIN_AGE)} and over`);
  const minor = draft.age < ADULT_AGE;
  const { noPork, ...rest } = draft;
  const d: Draft = {
    ...rest,
    ...(minor && rest.mainGoal === 'lose' ? { mainGoal: 'maintain' as const } : {}),
    ...(noPork ? { avoidFoods: [...(rest.avoidFoods ?? []), 'porc'] } : {}),
  };
  if (!healthConsent) {
    delete d.sex;
    delete d.heightCm;
    delete d.weightKg;
    delete d.allergies;
    delete d.injuries;
  }
  const patch = settingsPatch(d, current, year, now, deviceCurrency);
  if (!healthConsent || minor) {
    delete patch.calorieTarget;
    delete patch.proteinTarget;
    delete patch.carbsTarget;
    delete patch.fatTarget;
  }
  if (healthConsent) patch.healthConsentAt = current.healthConsentAt ?? now;
  return patch;
}

export type PlanSummary = { kind: 'calories'; calories: number } | { kind: 'noConsent' } | { kind: 'minor' };

/** Which "Ton plan est prêt" card to show (O7 and its two variants). */
export function planSummary(
  draft: { age?: number },
  healthConsent: boolean,
  calories: number | undefined,
): PlanSummary {
  if ((draft.age ?? 0) < ADULT_AGE) return { kind: 'minor' };
  if (!healthConsent || !calories) return { kind: 'noConsent' };
  return { kind: 'calories', calories };
}
