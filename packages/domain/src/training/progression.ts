import { performances, type LastPerformance } from './history';
import { DEFAULT_BAR_KG, roundToPlates, roundToStep } from './plates';
import type { Goal, Session, TrainingSettings, WorkoutExercise } from './types';

export const DEFAULT_REP_RANGE: Record<Goal, [number, number]> = {
  strength: [3, 6],
  muscle: [8, 12],
  general: [8, 12],
};
export const DEFAULT_REST: Record<Goal, number> = { strength: 150, muscle: 90, general: 75 };

export function repRangeFor(settings: TrainingSettings = {}): [number, number] {
  const r = settings.repRange;
  if (r && r[0] >= 1 && r[1] >= r[0]) return [r[0], r[1]];
  return DEFAULT_REP_RANGE[settings.goal ?? 'general'];
}

export type ProgressionExercise = Pick<WorkoutExercise, 'name' | 'sets' | 'reps' | 'weight'> &
  Partial<Pick<WorkoutExercise, 'muscle' | 'equipment'>> & { mechanic?: 'compound' | 'isolation' | null };

export type NextTarget = {
  sets: number;
  reps: number;
  weight: number;
  reason: 'plan' | 'increase' | 'hold' | 'deload';
  last: LastPerformance | null;
};

const isBarbell = (e: ProgressionExercise) => /barbell/i.test(e.equipment ?? '') || /barbell/i.test(e.name);

/** +5 kg for barbell leg compounds and any deadlift; +2.5 kg for upper body and isolation work. */
export function incrementFor(e: ProgressionExercise): number {
  if (/deadlift/i.test(e.name)) return 5;
  if (e.muscle === 'legs' && e.mechanic !== 'isolation' && isBarbell(e)) return 5;
  return 2.5;
}

/** Round to what can actually be loaded: plates per side on a barbell, the smallest plate step otherwise. */
export function roundLoad(
  weight: number,
  e: ProgressionExercise,
  settings: TrainingSettings = {},
  mode: 'nearest' | 'up' | 'down' = 'nearest',
) {
  if (!(weight > 0)) return 0;
  if (isBarbell(e)) return roundToPlates(weight, settings.barKg ?? DEFAULT_BAR_KG, settings.plates, mode);
  return roundToStep(weight, settings.plates, mode);
}

/**
 * Double progression from the last sessions of this exercise:
 * - every work set at the top of the rep range → add load (rounded up to loadable), restart at the bottom;
 * - reps under the bottom of the range in each of the last two sessions → −10 % load;
 * - otherwise hold the load and aim for one more rep.
 * With no history, the plan's numbers are returned unchanged.
 */
export function nextTarget(
  exercise: ProgressionExercise,
  history: readonly Session[],
  settings: TrainingSettings = {},
  options: { excludeId?: string } = {},
): NextTarget {
  const plan = { sets: Math.max(1, exercise.sets), reps: exercise.reps, weight: exercise.weight };
  const [low, high] = repRangeFor(settings);
  const recent = performances(exercise.name, history, options);
  const last = recent[0] ?? null;
  if (!last) return { ...plan, reason: 'plan', last: null };

  const topWeight = Math.max(...last.sets.map((s) => s.weight));
  const top = last.sets.filter((s) => s.weight === topWeight);
  const sets = plan.sets;
  const minReps = (p: LastPerformance) => Math.min(...p.sets.map((s) => s.reps));

  // Bodyweight: no load to add or remove, so keep adding reps.
  if (topWeight <= 0) {
    const reps = Math.min(100, Math.max(...top.map((s) => s.reps)) + 1);
    return { sets, reps, weight: 0, reason: 'hold', last };
  }
  if (top.every((s) => s.reps >= high)) {
    const weight = roundLoad(topWeight + incrementFor(exercise), exercise, settings, 'up');
    return {
      sets,
      reps: low,
      weight: Math.max(weight, topWeight),
      reason: weight > topWeight ? 'increase' : 'hold',
      last,
    };
  }
  if (recent.length >= 2 && minReps(recent[0]) < low && minReps(recent[1]) < low) {
    let weight = roundLoad(topWeight * 0.9, exercise, settings, 'nearest');
    if (weight >= topWeight) weight = roundLoad(topWeight * 0.9, exercise, settings, 'down');
    return { sets, reps: low, weight, reason: 'deload', last };
  }
  const avg = top.reduce((a, s) => a + s.reps, 0) / top.length;
  const reps = Math.min(high, Math.max(low, Math.floor(avg) + 1));
  return { sets, reps, weight: topWeight, reason: 'hold', last };
}
