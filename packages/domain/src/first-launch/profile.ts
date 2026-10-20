/**
 * Profile → Mes infos and Données de santé: the same rules as the first launch (minors, consent), applied to edits.
 */
import type { LifeSettings, LifeState } from '../life';
import type { Draft } from '../onboarding';
import type { Writes } from '../week-writes';
import { finishFirstLaunch } from './finish';

export type ProfileEdits = Pick<
  Draft,
  | 'firstName'
  | 'mainGoal'
  | 'people'
  | 'weeklyBudget'
  | 'trainingPlace'
  | 'sessionsPerWeek'
  | 'sex'
  | 'heightCm'
  | 'weightKg'
>;

/** Settings patch for edited answers; targets are recomputed, never set for a minor or without consent. */
export function editProfile(
  state: LifeState,
  edits: ProfileEdits,
  { year = new Date().getFullYear(), now = new Date().toISOString() } = {},
): Partial<LifeSettings> {
  const s = state.settings;
  const consent = !!s.healthConsentAt;
  const age = s.birthYear ? year - s.birthYear : 18;
  const weightKg =
    edits.weightKg ?? [...state.weightEntries].sort((a, b) => b.date.localeCompare(a.date))[0]?.weight;
  const patch = finishFirstLaunch({ ...edits, age, weightKg: consent ? weightKg : undefined }, consent, s, {
    year,
    now,
  });
  if (!consent || age < 18)
    Object.assign(patch, { calorieTarget: 0, proteinTarget: 0, carbsTarget: 0, fatTarget: 0 });
  return patch;
}

/**
 * Withdrawing the health-data consent: the consent date, body data, allergies, pain and calorie targets are
 * removed from the settings, and the weight history is deleted. Meals and sessions stay.
 */
export function withdrawHealthConsent(state: LifeState): { patch: Partial<LifeSettings>; writes: Writes } {
  return {
    patch: {
      healthConsentAt: undefined,
      sex: undefined,
      heightCm: undefined,
      allergies: undefined,
      injuries: undefined,
      calorieTarget: 0,
      proteinTarget: 0,
      carbsTarget: 0,
      fatTarget: 0,
    },
    writes: {
      upserts: [],
      deletes: state.weightEntries.map((w) => ({ collection: 'weightEntries' as const, id: w.id })),
    },
  };
}
