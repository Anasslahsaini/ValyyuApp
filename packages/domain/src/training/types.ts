import type { LifeState } from '@workspace/life-data';

export type Session = LifeState['sessions'][number];
export type SessionExercise = Session['exercises'][number];
export type SetEntry = SessionExercise['sets'][number];
export type Workout = LifeState['workouts'][number];
export type WorkoutExercise = Workout['exercises'][number];
export type LifeSettings = LifeState['settings'];
export type Goal = NonNullable<LifeSettings['goal']>;
export type TrainingSettings = Pick<
  Partial<LifeSettings>,
  'goal' | 'repRange' | 'barKg' | 'plates' | 'minutes' | 'unit'
>;

/** Personal records carry no catalogue IDs, so exercises are matched by trimmed, case-insensitive name. */
export const exerciseKey = (name: string) => name.trim().toLowerCase();
export const sameExercise = (a: string, b: string) => exerciseKey(a) === exerciseKey(b);

/** Completed sets that are not warm-ups. */
export const workSets = (exercise: Pick<SessionExercise, 'sets'>) =>
  exercise.sets.filter((s) => s.completed && !s.warmup);

/** Newest first. ISO dates sort lexicographically. */
export const newestFirst = <T extends { date: string }>(items: readonly T[]) =>
  [...items].sort((a, b) => b.date.localeCompare(a.date));
