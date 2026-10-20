/**
 * AI coach glue (pure): the compact exercise list sent to the server (equipment, level and pain zones already
 * applied), the check of the returned programs against the app's own catalogue, the saved plans + setting for the
 * chosen program, and which program day is "today". Weights and reps then follow the local progression.
 */
import { canDoExercise, type CatalogueExercise } from '../exercises';
import { estimateMinutes, STAPLES, type TodayWorkout } from './generate';
import { exerciseKey, type LifeSettings, type Session, type Workout } from './types';

export type Injury = NonNullable<LifeSettings['injuries']>[number];
export type Level = NonNullable<LifeSettings['fitnessLevel']>;
export type ProgramSetting = NonNullable<LifeSettings['program']>;
export type ProgramKey = NonNullable<ProgramSetting['key']>;
type Ex = Pick<
  CatalogueExercise,
  'name' | 'muscle' | 'equipment' | 'primaryMuscles' | 'category' | 'level' | 'mechanic'
>;

export const PROGRAM_WEEKS = 4;
const DAY_MS = 86_400_000;
/** A new program at most once a week (asked on demand), suggested after the 4 weeks. */
export const NEW_PROGRAM_EVERY_DAYS = 7;
export const MAX_SENT_EXERCISES = 600;

/** Exercises that load a painful zone: by main muscle, or by movement name. */
const INJURY_AVOID: Record<Injury, { muscles: string[]; pattern: RegExp }> = {
  shoulder: {
    muscles: ['shoulders'],
    pattern: /press|raise|dip|pull-?ups?|chin-?ups?|overhead|snatch|jerk|upright|handstand/i,
  },
  elbow: {
    muscles: ['triceps', 'biceps', 'forearms'],
    pattern: /dip|skull|curl|extension|close-grip|kickback/i,
  },
  wrist: { muscles: ['forearms'], pattern: /push-?ups?|plank|wrist|front squat|clean|handstand/i },
  back: {
    muscles: ['lower back'],
    pattern: /deadlift|good morning|bent over|row|hyperextension|barbell squat|swing|clean|snatch/i,
  },
  neck: { muscles: ['neck', 'traps'], pattern: /shrug|neck|behind the neck|overhead/i },
  hip: { muscles: ['adductors', 'abductors'], pattern: /lunge|split|deadlift|hip|squat/i },
  knee: { muscles: [], pattern: /squat|lunge|jump|step-?up|leg extension|leg press|pistol|split|hack/i },
  ankle: { muscles: ['calves'], pattern: /jump|calf|lunge|hop|skip|box|step-?up/i },
};

/** True when the exercise avoids every painful zone. */
export function safeForInjuries(
  e: Pick<Ex, 'name' | 'primaryMuscles'>,
  injuries: readonly Injury[] = [],
): boolean {
  return injuries.every((z) => {
    const rule = INJURY_AVOID[z];
    return rule && !rule.pattern.test(e.name) && !e.primaryMuscles.some((m) => rule.muscles.includes(m));
  });
}

const stapleRank = new Map(STAPLES.map((n, k) => [exerciseKey(n), k]));

/** The usable exercises for this person, staples first, as the short list the server sends to the AI. */
export function programCatalogue(
  catalogue: readonly Ex[],
  equipment: readonly string[],
  opts: { injuries?: readonly Injury[]; level?: Level } = {},
) {
  const level = opts.level ?? 'beginner';
  return catalogue
    .filter(
      (e) =>
        (e.category === 'strength' || e.category === 'powerlifting') &&
        e.mechanic &&
        e.level !== 'expert' &&
        (level !== 'beginner' || e.level === 'beginner' || stapleRank.has(exerciseKey(e.name))) &&
        canDoExercise(e.equipment, equipment, e.name) &&
        safeForInjuries(e, opts.injuries),
    )
    .sort(
      (a, b) =>
        (stapleRank.get(exerciseKey(a.name)) ?? 999) - (stapleRank.get(exerciseKey(b.name)) ?? 999) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, MAX_SENT_EXERCISES)
    .map((e) => ({
      name: e.name,
      muscle: e.primaryMuscles[0] ?? e.muscle,
      ...(e.mechanic ? { mechanic: e.mechanic } : {}),
      level: e.level,
    }));
}

export type AiProgram = {
  key: string;
  name: string;
  summary: string;
  days: Array<{
    name: string;
    exercises: Array<{ name: string; sets: number; reps: number; restSeconds: number }>;
  }>;
};
export type CheckedProgram = {
  key: ProgramKey;
  name: string;
  summary: string;
  days: Array<{ name: string; exercises: Workout['exercises'] }>;
  minutes: number;
};

const KEYS: readonly ProgramKey[] = ['express', 'balanced', 'intense'];
const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : fallback;

/**
 * The server's programs checked again against the app catalogue: unknown or unsafe names dropped, numbers clamped,
 * days with fewer than 2 exercises dropped, programs without days dropped. `find` returns the catalogue entry.
 */
export function checkPrograms(
  raw: unknown,
  find: (name: string) => Ex | null,
  opts: { injuries?: readonly Injury[]; equipment?: readonly string[]; idPrefix?: string } = {},
): CheckedProgram[] {
  const list =
    raw && typeof raw === 'object' && Array.isArray((raw as { programs?: unknown }).programs)
      ? (raw as { programs: unknown[] }).programs
      : [];
  const out: CheckedProgram[] = [];
  for (const rp of list.slice(0, 3)) {
    const p = (rp && typeof rp === 'object' ? rp : {}) as Partial<AiProgram>;
    const key = KEYS.find((k) => k === p.key);
    if (!key || out.some((o) => o.key === key)) continue;
    const days: CheckedProgram['days'] = [];
    for (const rd of Array.isArray(p.days) ? p.days.slice(0, 7) : []) {
      const used = new Set<string>();
      const exercises: Workout['exercises'] = [];
      for (const re of Array.isArray(rd?.exercises) ? rd.exercises : []) {
        const ex = typeof re?.name === 'string' ? find(re.name) : null;
        if (
          !ex ||
          used.has(ex.name) ||
          !safeForInjuries(ex, opts.injuries) ||
          (opts.equipment && !canDoExercise(ex.equipment, opts.equipment, ex.name))
        )
          continue;
        if (exercises.length >= 8) break;
        used.add(ex.name);
        exercises.push({
          id: `${opts.idPrefix ?? 'prog'}-${key}-${days.length}-${exercises.length}`,
          name: ex.name,
          muscle: ex.muscle,
          equipment: ex.equipment,
          sets: clamp(re.sets, 1, 8, 3),
          reps: clamp(re.reps, 1, 30, 10),
          weight: 0,
          restSeconds: clamp(re.restSeconds, 15, 300, 90),
        });
      }
      if (exercises.length >= 2)
        days.push({
          name: (typeof rd?.name === 'string' && rd.name.trim()
            ? rd.name.trim()
            : String(days.length + 1)
          ).slice(0, 40),
          exercises,
        });
    }
    if (!days.length) continue;
    out.push({
      key,
      name: (typeof p.name === 'string' && p.name.trim() ? p.name.trim() : key).slice(0, 40),
      summary: (typeof p.summary === 'string' ? p.summary.trim() : '').slice(0, 160),
      days,
      minutes: Math.round(days.reduce((a, d) => a + estimateMinutes(d.exercises), 0) / days.length),
    });
  }
  return out.sort((a, b) => KEYS.indexOf(a.key) - KEYS.indexOf(b.key));
}

/** The chosen program as saved plans (one per day) and the setting that points to them. */
export function programRecords(
  p: CheckedProgram,
  programId: string,
  now: Date = new Date(),
): { workouts: Workout[]; setting: ProgramSetting } {
  const workouts = p.days.map((d, i) => ({
    id: `${programId}-d${i + 1}`,
    name: `${p.name} · ${d.name}`.slice(0, 180),
    exercises: d.exercises.map((e, k) => ({ ...e, id: `${programId}-d${i + 1}-${k}` })),
  }));
  return {
    workouts,
    setting: {
      id: programId,
      name: p.name,
      key: p.key,
      workoutIds: workouts.map((w) => w.id),
      startedAt: now.toISOString(),
      weeks: PROGRAM_WEEKS,
    },
  };
}

export type ProgramDay = { workout: Workout; day: number; days: number; week: number; finished: boolean };

/**
 * Today's day of the chosen program: the day after the last one done since the program started (sessions started from
 * one of its plans), so a missed day is simply done next time. Null when there is no program or its plans are gone.
 */
export function programToday(
  program: ProgramSetting | undefined,
  workouts: readonly Workout[],
  sessions: readonly Session[],
  now: Date = new Date(),
): ProgramDay | null {
  if (!program) return null;
  const plans = program.workoutIds
    .map((id) => workouts.find((w) => w.id === id))
    .filter((w): w is Workout => !!w && w.exercises.length > 0);
  if (!plans.length) return null;
  const ids = new Set(plans.map((w) => w.id));
  const start = new Date(program.startedAt).getTime();
  const done = sessions.filter(
    (s) =>
      s.workoutId &&
      ids.has(s.workoutId) &&
      new Date(s.date).getTime() >= start - 60_000 &&
      s.exercises.some((e) => e.sets.some((x) => x.completed)),
  );
  const last = [...done].sort((a, b) => b.date.localeCompare(a.date))[0];
  const lastIndex = last ? plans.findIndex((w) => w.id === last.workoutId) : -1;
  const day = (lastIndex + 1) % plans.length;
  const elapsed = Math.max(0, now.getTime() - (Number.isFinite(start) ? start : now.getTime()));
  return {
    workout: plans[day]!,
    day: day + 1,
    days: plans.length,
    week: Math.min(program.weeks, Math.floor(elapsed / (7 * DAY_MS)) + 1),
    finished: elapsed >= program.weeks * 7 * DAY_MS,
  };
}

/** The program day shown on the "Today" card (same shape as the generated workout). */
export const asToday = (w: Workout, name = w.name): TodayWorkout => ({
  ...w,
  name,
  split: 'full',
  minutes: estimateMinutes(w.exercises),
});

/** "New program" is allowed once a week (local rule, saves AI budget). */
export function canAskNewProgram(program: ProgramSetting | undefined, now: Date = new Date()): boolean {
  if (!program) return true;
  const start = new Date(program.startedAt).getTime();
  return !Number.isFinite(start) || now.getTime() - start >= NEW_PROGRAM_EVERY_DAYS * DAY_MS;
}

/** Plans of an older program that no session uses can be removed when a new one is chosen (keeps "Saved plans" short). */
export function stalePlanIds(old: ProgramSetting | undefined, sessions: readonly Session[]): string[] {
  if (!old) return [];
  const used = new Set(sessions.map((s) => s.workoutId).filter(Boolean));
  return old.workoutIds.filter((id) => !used.has(id));
}
