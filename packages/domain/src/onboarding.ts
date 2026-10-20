/** First-launch answers → settings (pure, shared by the onboarding screen and its tests). */
import type { LifeState } from './life';
import { computeTargets, type MainGoal, type Sex } from './targets';

type Settings = LifeState['settings'];
export type Place = NonNullable<Settings['trainingPlace']>;
export type Diet = 'vegetarian' | 'vegan' | 'halal' | 'gluten_free' | 'dairy_free' | 'pescatarian';
export const DIETS: Diet[] = ['vegetarian', 'vegan', 'halal', 'gluten_free', 'dairy_free', 'pescatarian'];
/** Equipment the workout generator may use for each place. */
export const EQUIPMENT_FOR: Record<Place, string[]> = {
  home: ['bodyweight'],
  gym: ['bodyweight', 'dumbbells', 'barbell', 'machine', 'cable', 'bench', 'pullup'],
  outside: ['bodyweight'],
  none: ['bodyweight'],
};
export type Level = NonNullable<Settings['fitnessLevel']>;
export type Injury = NonNullable<Settings['injuries']>[number];
export type Allergy = NonNullable<Settings['allergies']>[number];
export const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];
export const INJURIES: Injury[] = ['shoulder', 'elbow', 'wrist', 'back', 'neck', 'hip', 'knee', 'ankle'];
export const ALLERGIES: Allergy[] = [
  'peanut',
  'nuts',
  'dairy',
  'egg',
  'gluten',
  'fish',
  'shellfish',
  'soy',
  'sesame',
];
export const SESSION_MINUTES = [20, 30, 45, 60] as const;
/** The app is for people aged 15 and over; nothing is saved below that. */
export const MIN_AGE = 15;
export const tooYoung = (age: number | undefined) => typeof age === 'number' && age < MIN_AGE;

/** Answers kept as typed; `undefined` = skipped (the stored value is left as it was). */
export type Draft = {
  firstName?: string;
  mainGoal?: MainGoal;
  sex?: Sex;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  people?: number;
  weeklyBudget?: number;
  diet?: Diet[];
  trainingPlace?: Place;
  sessionsPerWeek?: number;
  styleVibes?: string[];
  /** Real allergies (filter recipes by ingredient) and foods the person does not eat (`dislikes`). */
  allergies?: Allergy[];
  avoidFoods?: string[];
  likedFoods?: string[];
  sessionMinutes?: number;
  fitnessLevel?: Level;
  injuries?: Injury[];
};

/** Pure: the settings patch for a finished draft. */
export function settingsPatch(
  d: Draft,
  current: Settings,
  year = new Date().getFullYear(),
  now = new Date().toISOString(),
  deviceCurrency?: string,
): Partial<Settings> {
  const patch: Partial<Settings> = { onboardedAt: current.onboardedAt ?? now };
  if (d.firstName?.trim()) patch.firstName = d.firstName.trim().slice(0, 40);
  if (d.mainGoal) {
    patch.mainGoal = d.mainGoal;
    patch.goal = d.mainGoal === 'muscle' ? 'muscle' : 'general';
  }
  if (d.sex) patch.sex = d.sex;
  if (d.age) patch.birthYear = year - d.age;
  if (d.heightCm) patch.heightCm = d.heightCm;
  if (d.people) patch.people = d.people;
  if (d.weeklyBudget) patch.weeklyBudget = d.weeklyBudget;
  if (d.diet) patch.diet = d.diet;
  if (d.trainingPlace) {
    patch.trainingPlace = d.trainingPlace;
    patch.equipment = EQUIPMENT_FOR[d.trainingPlace];
    patch.sessionsPerWeek =
      d.trainingPlace === 'none' ? 0 : (d.sessionsPerWeek ?? current.sessionsPerWeek ?? 3);
  }
  if (d.styleVibes) patch.styleVibes = d.styleVibes.slice(0, 2);
  if (d.allergies) patch.allergies = [...new Set(d.allergies)].slice(0, 9);
  if (d.avoidFoods) patch.dislikes = cleanFoods(d.avoidFoods, 30);
  if (d.likedFoods) patch.likedFoods = cleanFoods(d.likedFoods, 20);
  if (d.fitnessLevel) patch.fitnessLevel = d.fitnessLevel;
  if (d.injuries) patch.injuries = [...new Set(d.injuries)].slice(0, 8);
  if (d.sessionMinutes && d.trainingPlace !== 'none')
    patch.minutes = Math.max(10, Math.min(180, Math.round(d.sessionMinutes)));
  // A never-chosen currency follows the phone (the planner's default is USD).
  if (current.currency === 'USD' && deviceCurrency && /^[A-Z]{3}$/.test(deviceCurrency))
    patch.currency = deviceCurrency;
  const targets = computeTargets({
    sex: patch.sex ?? current.sex,
    birthYear: patch.birthYear ?? current.birthYear,
    heightCm: patch.heightCm ?? current.heightCm,
    weightKg: d.weightKg,
    sessionsPerWeek: patch.sessionsPerWeek ?? current.sessionsPerWeek,
    mainGoal: patch.mainGoal ?? current.mainGoal,
    year,
  });
  if (targets) {
    patch.calorieTarget = targets.calories;
    patch.proteinTarget = targets.protein;
    patch.carbsTarget = targets.carbs;
    patch.fatTarget = targets.fat;
  }
  return patch;
}

const cleanFoods = (list: readonly string[], max: number) => {
  const seen = new Set<string>();
  return list
    .map((x) => x.replace(/\s+/g, ' ').trim().slice(0, 60))
    .filter((x) => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()))
    .slice(0, max);
};

/* ------------------------------------------------------------------ voice first launch */

/** What the server understood (already validated there; checked again here, the app never trusts the network). */
export type AiProfile = Partial<Record<string, unknown>>;
const pick = <T extends string>(v: unknown, list: readonly T[]) =>
  (list as readonly unknown[]).includes(v) ? (v as T) : undefined;
const many = <T extends string>(v: unknown, list: readonly T[]) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is T => (list as readonly unknown[]).includes(x)))] : [];
const range = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : undefined;
const words = (v: unknown) =>
  Array.isArray(v)
    ? cleanFoods(
        v.filter((x): x is string => typeof x === 'string'),
        20,
      )
    : [];

/** Pure: the draft with what the person just said on top (spoken answers win; nothing said = the draft value stays). */
export function mergeAiProfile(d: Draft, p: AiProfile | null | undefined): Draft {
  if (!p) return d;
  const out: Draft = { ...d };
  const name = typeof p.firstName === 'string' ? p.firstName.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
  if (name) out.firstName = name;
  const goal = pick(p.mainGoal, ['lose', 'maintain', 'muscle', 'eatBetter', 'style'] as const);
  if (goal) out.mainGoal = goal;
  const sex = pick(p.sex, ['female', 'male', 'other'] as const);
  if (sex) out.sex = sex;
  const age = range(p.age, 5, 110);
  if (age !== undefined) out.age = age;
  const h = range(p.heightCm, 100, 230);
  if (h !== undefined) out.heightCm = h;
  const w = range(p.weightKg, 30, 250);
  if (w !== undefined) out.weightKg = w;
  const people = range(p.people, 1, 12);
  if (people !== undefined) out.people = people;
  const budget = range(p.weeklyBudget, 1, 5000);
  if (budget !== undefined) out.weeklyBudget = budget;
  const diet = many(p.diet, DIETS);
  if (diet.length) out.diet = diet;
  const allergies = many(p.allergies, ALLERGIES);
  if (allergies.length) out.allergies = allergies;
  const avoid = words(p.avoidFoods);
  if (avoid.length) out.avoidFoods = avoid;
  const liked = words(p.likedFoods);
  if (liked.length) out.likedFoods = liked;
  const place = pick(p.trainingPlace, ['home', 'gym', 'none'] as const);
  if (place) out.trainingPlace = place;
  const spw = range(p.sessionsPerWeek, 0, 7);
  if (spw !== undefined) out.sessionsPerWeek = place === 'none' ? 0 : spw;
  const min = range(p.sessionMinutes, 10, 180);
  if (min !== undefined) out.sessionMinutes = min;
  const level = pick(p.fitnessLevel, LEVELS);
  if (level) out.fitnessLevel = level;
  const injuries = many(p.injuries, INJURIES);
  if (injuries.length) out.injuries = injuries;
  return out;
}

export type StepKey = 'voice' | 'name' | 'goal' | 'body' | 'food' | 'taste' | 'sport' | 'plan';
export const QUESTION_STEPS: StepKey[] = ['name', 'goal', 'body', 'food', 'taste', 'sport', 'plan'];

/** After the voice answer: only the question screens with something still missing, then the summary. */
export function stepsStillMissing(d: Draft): StepKey[] {
  const steps: StepKey[] = [];
  if (!d.firstName?.trim()) steps.push('name');
  if (!d.mainGoal) steps.push('goal');
  if (!d.sex || !d.age || !d.heightCm || !d.weightKg) steps.push('body');
  if (!d.people || !d.weeklyBudget) steps.push('food');
  if (!d.allergies && !d.avoidFoods && !d.likedFoods && !d.diet) steps.push('taste');
  if (
    !d.trainingPlace ||
    (d.trainingPlace !== 'none' && (!d.sessionsPerWeek || !d.sessionMinutes || !d.fitnessLevel))
  )
    steps.push('sport');
  steps.push('plan');
  return steps;
}
