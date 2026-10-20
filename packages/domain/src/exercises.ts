import data from '../data/free-exercise-db/exercises.json';
import source from '../data/free-exercise-db/source.json';
import imageSizes from '../data/free-exercise-db/image-sizes.json';

export const exerciseImageRevision = source.revision;
export type ExerciseImage = { key: string; path: string; url: string; bytes: number };
export function exerciseImages(exercises: readonly Pick<CatalogueExercise, 'images'>[]): ExerciseImage[] {
  const prefix = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${source.revision}/exercises/`;
  const unique = new Map<string, ExerciseImage>();
  for (const exercise of exercises)
    for (const url of exercise.images) {
      if (!url.startsWith(prefix)) throw new Error('Unknown public exercise image.');
      const path = decodeURIComponent(url.slice(prefix.length));
      const bytes = (imageSizes as Record<string, number>)[path];
      if (bytes === undefined || !Number.isSafeInteger(bytes) || bytes <= 0)
        throw new Error('Missing image size.');
      const key = `${source.revision}/${path}`;
      unique.set(key, { key, path, url, bytes });
    }
  return [...unique.values()];
}
/** Personal workouts deliberately contain no catalogue IDs; only exact names match. */
export function catalogueForWorkout(exercises: readonly { name: string }[]) {
  const names = new Set(exercises.map((exercise) => exercise.name));
  return exerciseLibrary.filter((exercise) => names.has(exercise.name));
}

let byName: Map<string, CatalogueExercise> | null = null;
/** Catalogue entry for a personal exercise name (trimmed, case-insensitive), or null for custom ones. */
export function findCatalogueExercise(name: string): CatalogueExercise | null {
  byName ??= new Map(exerciseLibrary.map((exercise) => [exercise.name.trim().toLowerCase(), exercise]));
  return byName.get(name.trim().toLowerCase()) ?? null;
}

export type ExerciseMuscle = 'chest' | 'back' | 'shoulders' | 'arms' | 'core' | 'legs' | 'full';
export const muscleMapping: Record<string, ExerciseMuscle> = {
  abdominals: 'core',
  hamstrings: 'legs',
  adductors: 'legs',
  quadriceps: 'legs',
  biceps: 'arms',
  shoulders: 'shoulders',
  chest: 'chest',
  'middle back': 'back',
  calves: 'legs',
  glutes: 'legs',
  'lower back': 'back',
  lats: 'back',
  triceps: 'arms',
  traps: 'back',
  forearms: 'arms',
  neck: 'full',
  abductors: 'legs',
};
const equipmentNames: Record<string, string> = {
  'body only': 'Bodyweight',
  machine: 'Machine',
  other: 'Other equipment',
  'foam roll': 'Foam roller',
  kettlebells: 'Kettlebells',
  dumbbell: 'Dumbbells',
  cable: 'Cable',
  barbell: 'Barbell',
  bands: 'Resistance bands',
  'medicine ball': 'Medicine ball',
  'exercise ball': 'Exercise ball',
  'e-z curl bar': 'EZ curl bar',
};
export type CatalogueExercise = {
  id: string;
  name: string;
  muscle: ExerciseMuscle;
  equipment: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
  level: string;
  category: string;
  sourceEquipment: string | null;
  mechanic: 'compound' | 'isolation' | null;
  force: string | null;
  sets: number;
  reps: number;
  weight: number;
  restSeconds: number;
};
/** Bundled public data, never inserted into a user's workspace or backups. */
export const exerciseLibrary: CatalogueExercise[] = data.map((e) => ({
  id: e.id,
  name: e.name,
  muscle: (e.primaryMuscles[0] ? muscleMapping[e.primaryMuscles[0]] : undefined) ?? 'full',
  equipment: e.equipment ? (equipmentNames[e.equipment] ?? e.equipment) : 'Unspecified equipment',
  primaryMuscles: e.primaryMuscles,
  secondaryMuscles: e.secondaryMuscles,
  instructions: e.instructions,
  level: e.level,
  category: e.category,
  sourceEquipment: e.equipment,
  mechanic: e.mechanic === 'compound' || e.mechanic === 'isolation' ? e.mechanic : null,
  force: e.force ?? null,
  images: e.images.map(
    (path) =>
      `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${source.revision}/exercises/${path.split('/').map(encodeURIComponent).join('/')}`,
  ),
  // Editable defaults, not a new prescription or an imported workout.
  sets: 3,
  reps: 10,
  weight: 0,
  restSeconds: 90,
}));

const equipmentAliases: Record<string, string[]> = {
  bodyweight: ['body', 'none'],
  dumbbells: ['dumbbell'],
  barbell: ['barbell'],
  kettlebell: ['kettlebell'],
  bands: ['band'],
  machine: ['machine'],
  cable: ['cable'],
  bench: ['bench'],
  pullup: ['pull'],
};
/** Accessories the catalogue never lists as equipment, but that some exercises need by name. */
const namedAccessories: { chip: string; pattern: RegExp }[] = [
  { chip: 'bench', pattern: /\bbench\b/i },
  { chip: 'pullup', pattern: /\b(pull-?ups?|chin-?ups?)\b/i },
];
/** Equipment chips an exercise needs because of its name (bench, pull-up bar). */
export function namedAccessoriesFor(name: string) {
  return namedAccessories.filter((a) => a.pattern.test(name)).map((a) => a.chip);
}
/**
 * Equipment filter; does not infer missing equipment. "Body only" is always available.
 * When the exercise name is given, names that need a bench or a pull-up bar also require
 * that chip (free-exercise-db has no bench / pull-up bar equipment value).
 */
export function canDoExercise(equipment: string, mine: readonly string[], name?: string) {
  const value = (equipment || '').toLowerCase();
  const needs = name ? namedAccessoriesFor(name) : [];
  if (needs.some((chip) => !mine.includes(chip))) return false;
  if (!value || (equipmentAliases.bodyweight ?? []).some((alias) => value.includes(alias))) return true;
  // "Other"/unspecified equipment whose only stated need is the named accessory (e.g. Scapular Pull-Up).
  if (needs.length && (value === 'other equipment' || value === 'unspecified equipment')) return true;
  return mine.some((key) => (equipmentAliases[key] ?? [key]).some((alias) => value.includes(alias)));
}
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
export function workoutExerciseFromCatalogue(
  exercise: Pick<CatalogueExercise, 'name' | 'muscle' | 'equipment'>,
  id: string,
) {
  // Copy only the existing personal-workout fields: no source metadata, images or IDs.
  return {
    id,
    name: exercise.name,
    muscle: exercise.muscle,
    equipment: exercise.equipment,
    sets: 3,
    reps: 10,
    weight: 0,
    restSeconds: 90,
  };
}
export function searchExercises(
  query: string,
  muscle: ExerciseMuscle | 'all' = 'all',
  mine?: readonly string[],
) {
  const tokens = query.trim().split(/\s+/).map(normalize).filter(Boolean);
  return exerciseLibrary.filter((exercise) => {
    if (muscle !== 'all' && exercise.muscle !== muscle) return false;
    if (mine && !canDoExercise(exercise.equipment, mine, exercise.name)) return false;
    const search = normalize([exercise.name, exercise.equipment, ...exercise.primaryMuscles].join(' '));
    return tokens.every((token) => search.includes(token));
  });
}
