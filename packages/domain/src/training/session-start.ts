/** Start a session from a plan (sets prefilled by double progression) and finish it (only what was done is kept). */
import { findCatalogueExercise } from '../exercises';
import { createId } from '../life';
import { nextTarget } from './progression';
import type { Session, TrainingSettings, Workout } from './types';

export function startSession(
  workout: Workout,
  history: readonly Session[],
  settings: TrainingSettings,
  opts: { id?: string; now?: string; source?: Session['source'] } = {},
): Session {
  return {
    id: opts.id ?? createId(),
    workoutName: workout.name,
    date: opts.now ?? new Date().toISOString(),
    source: opts.source ?? 'today',
    exercises: workout.exercises.map((e) => {
      const target = nextTarget(
        { ...e, mechanic: findCatalogueExercise(e.name)?.mechanic ?? null },
        history,
        settings,
      );
      return {
        name: e.name,
        muscle: e.muscle,
        restSeconds: e.restSeconds || 90,
        sets: Array.from({ length: Math.max(1, target.sets) }, () => ({
          reps: target.reps,
          weight: target.weight,
          completed: false,
        })),
      };
    }),
  };
}

/** The session to save, or null when no set was done. Exercises with no done set are dropped. */
export function finishSession(session: Session, now: number = Date.now()): Session | null {
  const exercises = session.exercises
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.completed) }))
    .filter((e) => e.sets.length > 0);
  if (!exercises.length) return null;
  const durationSec = Math.max(0, Math.min(86400, Math.round((now - Date.parse(session.date)) / 1000)));
  return { ...session, exercises, durationSec };
}
