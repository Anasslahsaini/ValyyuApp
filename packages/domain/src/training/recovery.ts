import { exerciseKey, workSets, type Session } from './types';

/** The six shapes of the BodyMap pictogram. */
export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'core' | 'legs';
export const MUSCLE_GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'core', 'legs'];

/** free-exercise-db muscles rolled up to BodyMap groups. */
export const GROUP_OF: Record<string, MuscleGroup> = {
  chest: 'chest',
  lats: 'back',
  'middle back': 'back',
  'lower back': 'back',
  traps: 'back',
  neck: 'back',
  shoulders: 'shoulders',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  abdominals: 'core',
  quadriceps: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  adductors: 'legs',
  abductors: 'legs',
};
/** Large muscles recover more slowly (τ = 36 h); the rest use τ = 24 h. */
export const BIG_MUSCLES = new Set([
  'chest',
  'lats',
  'middle back',
  'lower back',
  'quadriceps',
  'hamstrings',
  'glutes',
]);
const BIG_GROUPS = new Set<MuscleGroup>(['chest', 'back', 'legs']);
export const tauHours = (muscle: string) => (BIG_MUSCLES.has(muscle) ? 36 : 24);

/** Effective sets at which a muscle reads as 0 % recovered. */
export const FULL_FATIGUE = 8;
const HORIZON_HOURS = 24 * 10;

export type MuscleInfo = { primaryMuscles: readonly string[]; secondaryMuscles: readonly string[] };
export type MuscleLookup = (name: string) => MuscleInfo | null;

/** Lookup by personal exercise name (case-insensitive, trimmed) into the bundled catalogue. */
export function muscleLookup(catalogue: readonly ({ name: string } & MuscleInfo)[]): MuscleLookup {
  const map = new Map(catalogue.map((e) => [exerciseKey(e.name), e] as const));
  return (name) => map.get(exerciseKey(name)) ?? null;
}

export type Recovery = {
  /** Fatigue per catalogue muscle, in effective sets. */
  muscles: Record<string, number>;
  /** Fatigue per BodyMap group (the most tired muscle in the group, plus unmatched custom exercises). */
  groups: Record<MuscleGroup, number>;
  /** 0–1 per group; 1 = fully recovered. */
  recovered: Record<MuscleGroup, number>;
};

const zero = (): Record<MuscleGroup, number> => ({
  chest: 0,
  back: 0,
  shoulders: 0,
  arms: 0,
  core: 0,
  legs: 0,
});

/**
 * fatigue(muscle) = Σ completed work sets × (1 primary | 0.5 secondary) × e^(−hours / τ).
 * Exercises missing from the catalogue fall back to their saved group (full body = 0.5 on every group).
 */
export function computeRecovery(
  sessions: readonly Session[],
  lookup: MuscleLookup,
  now = Date.now(),
): Recovery {
  const muscles: Record<string, number> = {};
  const fallback = zero();
  for (const session of sessions) {
    const hours = (now - new Date(session.date).getTime()) / 3600000;
    if (!Number.isFinite(hours) || hours > HORIZON_HOURS) continue;
    const h = Math.max(0, hours);
    for (const exercise of session.exercises) {
      const n = workSets(exercise).length;
      if (!n) continue;
      const info = lookup(exercise.name);
      if (info) {
        const add = (m: string, w: number) => {
          if (GROUP_OF[m]) muscles[m] = (muscles[m] ?? 0) + n * w * Math.exp(-h / tauHours(m));
        };
        info.primaryMuscles.forEach((m) => add(m, 1));
        info.secondaryMuscles.forEach((m) => add(m, 0.5));
      } else if (exercise.muscle === 'full') {
        for (const g of MUSCLE_GROUPS) fallback[g] += n * 0.5 * Math.exp(-h / (BIG_GROUPS.has(g) ? 36 : 24));
      } else if (exercise.muscle in fallback) {
        const g = exercise.muscle as MuscleGroup;
        fallback[g] += n * Math.exp(-h / (BIG_GROUPS.has(g) ? 36 : 24));
      }
    }
  }
  const groups = zero();
  for (const [m, f] of Object.entries(muscles)) groups[GROUP_OF[m]] = Math.max(groups[GROUP_OF[m]], f);
  for (const g of MUSCLE_GROUPS) groups[g] += fallback[g];
  const recovered = zero();
  for (const g of MUSCLE_GROUPS) recovered[g] = Math.max(0, Math.min(1, 1 - groups[g] / FULL_FATIGUE));
  return { muscles, groups, recovered };
}

/** 0–1 recovery of one catalogue muscle. */
export const muscleRecovered = (r: Recovery, muscle: string) =>
  Math.max(0, Math.min(1, 1 - (r.muscles[muscle] ?? 0) / FULL_FATIGUE));

/** Groups at or above `threshold` recovery, freshest first. */
export function freshGroups(r: Recovery, threshold = 0.8): MuscleGroup[] {
  return MUSCLE_GROUPS.filter((g) => r.recovered[g] >= threshold).sort(
    (a, b) => r.recovered[b] - r.recovered[a],
  );
}
