import { canDoExercise, type CatalogueExercise } from '../exercises';
import { DEFAULT_REP_RANGE, DEFAULT_REST, nextTarget } from './progression';
import { computeRecovery, muscleLookup, muscleRecovered, type MuscleGroup } from './recovery';
import {
  exerciseKey,
  workSets,
  type Goal,
  type Session,
  type TrainingSettings,
  type Workout,
  type WorkoutExercise,
} from './types';

export type Split = 'push' | 'pull' | 'legs' | 'full' | 'fresh';
export type GenCatalogueExercise = Pick<
  CatalogueExercise,
  'name' | 'muscle' | 'equipment' | 'primaryMuscles' | 'secondaryMuscles' | 'category' | 'level' | 'mechanic'
> & { force?: string | null };

/** Workout record plus how it was generated (strip `split`/`minutes` before saving as a plan). */
export type TodayWorkout = Workout & { split: Split; minutes: number };

type Slot = { muscles: string[]; kind?: 'compound' | 'isolation' };
const c = (...muscles: string[]): Slot => ({ muscles, kind: 'compound' });
const i = (...muscles: string[]): Slot => ({ muscles, kind: 'isolation' });

/** Ordered slots; the first `n` are used. Compound movements lead. */
export const SPLIT_SLOTS: Record<Exclude<Split, 'fresh'>, Slot[]> = {
  push: [c('chest'), c('shoulders'), c('chest'), i('triceps'), i('shoulders'), i('chest', 'triceps')],
  pull: [
    c('lats'),
    c('middle back'),
    c('lats', 'middle back'),
    i('biceps'),
    i('shoulders', 'traps'),
    i('biceps', 'forearms'),
  ],
  legs: [
    c('quadriceps'),
    c('hamstrings'),
    c('quadriceps', 'glutes'),
    i('hamstrings'),
    i('calves'),
    i('abdominals'),
  ],
  full: [
    c('quadriceps'),
    c('chest'),
    c('lats', 'middle back'),
    c('hamstrings', 'glutes'),
    c('shoulders'),
    i('abdominals'),
  ],
};
/** The catalogue muscles that decide whether a split's muscles are fresh. */
const SPLIT_MUSCLES: Record<'push' | 'pull' | 'legs', string[]> = {
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['lats', 'middle back', 'biceps'],
  legs: ['quadriceps', 'hamstrings', 'glutes'],
};
const GROUP_SLOTS: Record<MuscleGroup, Slot[]> = {
  chest: [c('chest'), i('chest')],
  back: [c('lats'), c('middle back')],
  shoulders: [c('shoulders'), i('shoulders')],
  arms: [i('triceps'), i('biceps')],
  core: [i('abdominals')],
  legs: [c('quadriceps'), c('hamstrings', 'glutes'), i('calves')],
};

/** Well-known staples, most preferred first (all exact free-exercise-db names). */
export const STAPLES = [
  'Barbell Squat',
  'Barbell Bench Press - Medium Grip',
  'Barbell Deadlift',
  'Pullups',
  'Bent Over Barbell Row',
  'Standing Military Press',
  'Dumbbell Bench Press',
  'Pushups',
  'Chin-Up',
  'Goblet Squat',
  'Romanian Deadlift',
  'One-Arm Dumbbell Row',
  'Seated Dumbbell Press',
  'Wide-Grip Lat Pulldown',
  'Seated Cable Rows',
  'Leg Press',
  'Dumbbell Squat',
  'Dumbbell Lunges',
  'Incline Dumbbell Press',
  'Machine Bench Press',
  'Machine Shoulder (Military) Press',
  'Stiff-Legged Dumbbell Deadlift',
  'Bodyweight Squat',
  'Dips - Triceps Version',
  'Bench Dips',
  'Close-Grip Barbell Bench Press',
  'Triceps Pushdown',
  'Standing Dumbbell Triceps Extension',
  'EZ-Bar Skullcrusher',
  'Side Lateral Raise',
  'Dumbbell Flyes',
  'Cable Crossover',
  'Barbell Curl',
  'Dumbbell Bicep Curl',
  'Hammer Curls',
  'Lying Leg Curls',
  'Seated Leg Curl',
  'Leg Extensions',
  'Butt Lift (Bridge)',
  'Standing Calf Raises',
  'Calf Raise On A Dumbbell',
  'Plank',
  'Crunches',
  'Cable Crunch',
  'Band Pull Apart',
  'Face Pull',
  'Dumbbell Shrug',
  'Band Assisted Pull-Up',
  'Push Up to Side Plank',
];
const stapleRank = new Map(STAPLES.map((n, k) => [exerciseKey(n), k]));

export type GenerateInput = {
  equipment: readonly string[];
  sessions: readonly Session[];
  goal?: Goal;
  minutes?: number;
  catalogue: readonly GenCatalogueExercise[];
  settings?: TrainingSettings;
  /** Force a split; 'fresh' uses `focus` groups. */
  split?: Split;
  /** BodyMap groups to train (from "Train fresh muscles"). Implies split 'fresh'. */
  focus?: readonly MuscleGroup[];
  /** ↻ regenerate: picks alternative candidates. */
  variant?: number;
  names?: Partial<Record<Split, string>>;
  now?: number;
  makeId?: (index: number) => string;
};

const DEFAULT_NAMES: Record<Split, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  full: 'Full body',
  fresh: 'Fresh muscles',
};

/** Distinct training days in the last 14 days, halved. */
export function sessionsPerWeek(sessions: readonly Session[], now = Date.now()) {
  const since = now - 14 * 86400000;
  const days = new Set(
    sessions
      .filter((s) => {
        const t = new Date(s.date).getTime();
        return t >= since && t <= now + 86400000 && s.exercises.some((e) => workSets(e).length);
      })
      .map((s) => s.date.slice(0, 10)),
  );
  return days.size / 2;
}

/** Push/pull/legs by freshest muscles, or full body when training ≤ 2×/week. */
export function chooseSplit(
  sessions: readonly Session[],
  catalogue: readonly GenCatalogueExercise[],
  now = Date.now(),
): Exclude<Split, 'fresh'> {
  if (sessionsPerWeek(sessions, now) <= 2) return 'full';
  const recovery = computeRecovery(sessions, muscleLookup(catalogue), now);
  const score = (s: 'push' | 'pull' | 'legs') =>
    SPLIT_MUSCLES[s].reduce((a, m) => a + muscleRecovered(recovery, m), 0) / SPLIT_MUSCLES[s].length;
  const order: ('push' | 'pull' | 'legs')[] = ['push', 'pull', 'legs'];
  return order.reduce((best, s) => (score(s) > score(best) + 1e-6 ? s : best), order[0]);
}

export const estimateMinutes = (exercises: readonly Pick<WorkoutExercise, 'sets' | 'restSeconds'>[]) =>
  Math.round(5 + exercises.reduce((a, e) => a + (e.sets * (40 + e.restSeconds)) / 60, 0));

/** Builds today's workout from the catalogue: 4–6 strength exercises the user's equipment allows. */
export function generateToday(input: GenerateInput): TodayWorkout {
  const now = input.now ?? Date.now();
  const goal = input.goal ?? input.settings?.goal ?? 'general';
  const minutes = input.minutes ?? input.settings?.minutes ?? 45;
  const settings: TrainingSettings = { ...input.settings, goal };
  // Up to 6 exercises, trimmed to fit `minutes` below (never under 4).
  const count = 6;
  const done = new Map<string, number>();
  for (const s of input.sessions)
    for (const e of s.exercises)
      if (workSets(e).length) done.set(exerciseKey(e.name), (done.get(exerciseKey(e.name)) ?? 0) + 1);
  const pool = input.catalogue.filter(
    (e) =>
      (e.category === 'strength' || e.category === 'powerlifting') &&
      e.level !== 'expert' &&
      e.mechanic &&
      canDoExercise(e.equipment, input.equipment, e.name),
  );
  const variant = Math.max(0, Math.floor(input.variant ?? 0));

  const pick = (split: Split) => {
    const baseSlots =
      split === 'fresh' ? roundRobin((input.focus ?? []).map((g) => GROUP_SLOTS[g])) : SPLIT_SLOTS[split];
    // Spare "any of these muscles" slots so a narrow focus still reaches 4 exercises.
    const anyMuscle: Slot = { muscles: [...new Set(baseSlots.flatMap((s) => s.muscles))] };
    const slots = [...baseSlots, ...Array.from({ length: count }, () => anyMuscle)];
    const force = split === 'push' || split === 'pull' ? split : null;
    const picked: { ex: GenCatalogueExercise; slot: number }[] = [];
    const used = new Set<string>();
    for (let k = 0; k < slots.length && picked.length < count; k++) {
      const slot = slots[k];
      const candidates = pool
        .filter(
          (e) =>
            !used.has(exerciseKey(e.name)) &&
            slot.muscles.includes(e.primaryMuscles[0] ?? '') &&
            (!force || e.force === force),
        )
        .map((e) => ({ e, score: score(e, slot, done) }))
        .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name));
      if (!candidates.length) continue;
      const top = candidates.slice(0, Math.min(3, candidates.length));
      const choice = top[variant === 0 ? 0 : (variant + k) % top.length].e;
      used.add(exerciseKey(choice.name));
      picked.push({ ex: choice, slot: k });
    }
    // Compound movements first; slot order otherwise preserved.
    return picked.sort(
      (a, b) =>
        Number(a.ex.mechanic === 'isolation') - Number(b.ex.mechanic === 'isolation') || a.slot - b.slot,
    );
  };
  let split: Split = input.focus?.length
    ? 'fresh'
    : (input.split ?? chooseSplit(input.sessions, input.catalogue, now));
  let picked = pick(split);
  // Not enough equipment for this split (e.g. pull with bodyweight only): fall back to full body.
  if (picked.length < 4 && split !== 'full') {
    const full = pick('full');
    if (full.length > picked.length) {
      split = 'full';
      picked = full;
    }
  }

  const [low, high] = settings.repRange ?? DEFAULT_REP_RANGE[goal];
  const planReps = goal === 'strength' ? low : Math.round((low + high) / 2);
  const rest = DEFAULT_REST[goal];
  const makeId = input.makeId ?? ((n: number) => `today-${now.toString(36)}-${n}`);
  let exercises: WorkoutExercise[] = picked.map(({ ex }, n) => {
    const target = nextTarget(
      {
        name: ex.name,
        muscle: ex.muscle,
        equipment: ex.equipment,
        mechanic: ex.mechanic,
        sets: 3,
        reps: planReps,
        weight: 0,
      },
      input.sessions,
      settings,
    );
    return {
      id: makeId(n),
      name: ex.name,
      muscle: ex.muscle,
      equipment: ex.equipment,
      sets: target.sets,
      reps: target.reps,
      weight: target.weight,
      restSeconds: ex.mechanic === 'isolation' ? Math.min(rest, 75) : rest,
    };
  });
  while (exercises.length > 4 && estimateMinutes(exercises) > minutes) exercises = exercises.slice(0, -1);
  const names = { ...DEFAULT_NAMES, ...input.names };
  return { id: makeId(99), name: names[split], exercises, split, minutes: estimateMinutes(exercises) };
}

function score(e: GenCatalogueExercise, slot: Slot, done: Map<string, number>) {
  const key = exerciseKey(e.name);
  let s = 0;
  const times = done.get(key) ?? 0;
  if (times) s += 100 + Math.min(times, 20);
  const rank = stapleRank.get(key);
  if (rank !== undefined) s += 60 - rank * 0.5;
  if (slot.kind && e.mechanic === slot.kind) s += 15;
  if (e.primaryMuscles[0] === slot.muscles[0]) s += 3;
  if (e.level === 'beginner') s += 2;
  return s;
}

function roundRobin<T>(lists: T[][]): T[] {
  const out: T[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let k = 0; k < max; k++) for (const l of lists) if (l[k]) out.push(l[k]);
  return out;
}

/** Strip generation metadata so the result validates as a saved plan. */
export function asPlan(today: TodayWorkout, id: string, name = today.name): Workout {
  return { id, name, exercises: today.exercises.map((e) => ({ ...e })) };
}
