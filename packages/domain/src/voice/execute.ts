/**
 * Voice command executor: a pure function from a parsed intent and the current workspace to
 * the records to write, an exact undo, a navigation, and a short confirmation message.
 * No React, no storage: the UI applies `changes` (via LifeContext) and keeps `undo` for the toast.
 */
import type {
  Collection,
  GroceryItem,
  LifeSettings,
  LifeState,
  MealEntry,
  PantryItem,
  WardrobeItem,
  WeightEntry,
} from '../life';
import type { SaveEntry } from '../assistant-target';
import { upsertRecords } from '../assistant-target';
import { fold } from './numbers';
import { mealForToday } from '../mealplan';
import type { ItemSlot, MealSlotName, NavTarget, ParsedIntent } from './intents';
import { examplesForArea, joinList, voiceText, type VoiceKey } from '../../constants/voice-strings';

export type Patch = {
  upserts: SaveEntry[];
  deletes: { collection: Collection; id: string }[];
  settings?: Partial<LifeSettings>;
};
export type Navigation = { pathname: string; params?: Record<string, string> };
export type ExecKind = 'done' | 'navigate' | 'unknown' | 'confirm' | 'timer' | 'error';
/** At or above this a command runs straight away; between CONFIDENCE_MIN and this the user confirms first. */
export const EXECUTE_MIN = 0.8;
export type ExecResult = {
  kind: ExecKind;
  /** Short confirmation, already translated. */
  message: string;
  changes: Patch;
  /** Reverts exactly `changes`; null when nothing was written. */
  undo: Patch | null;
  navigate?: Navigation;
  timerSeconds?: number;
  /** `unknown`: three example commands for the guessed area. */
  examples?: string[];
  /** `confirm`: the intent to run if the user taps Yes (pass it back with `confirmed: true`). */
  pending?: ParsedIntent;
};
export type ExecOptions = {
  lang?: string;
  idPrefix?: string;
  /** Skip the confidence check (the user said Yes). */ confirmed?: boolean;
};

const EMPTY: Patch = { upserts: [], deletes: [] };
export const hasChanges = (p: Patch) =>
  p.upserts.length > 0 || p.deletes.length > 0 || Boolean(p.settings && Object.keys(p.settings).length);

/* ------------------------------------------------------------------ helpers */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pad = (n: number) => String(n).padStart(2, '0');
export function dateKey(now: Date, daysAgo = 0): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Folded, singular-ish key so "oeufs"/"oeuf" and "Lait"/"lait" match. */
export function nameKey(name: string): string {
  return fold(name)
    .split(' ')
    .map((w) => (w.length > 3 ? w.replace(/(?:s|x)$/, '') : w))
    .join(' ');
}
const sameName = (a: string, b: string) => nameKey(a) === nameKey(b);

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600),
    m = Math.floor((seconds % 3600) / 60),
    s = seconds % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function makeIds(now: Date, prefix?: string) {
  const base = prefix ?? `v${now.getTime().toString(36)}`;
  let n = 0;
  return () => `${base}-${++n}`;
}

const patchOf = (upserts: SaveEntry[], deletes: Patch['deletes'] = []): Patch => ({ upserts, deletes });
const result = (r: Partial<ExecResult> & Pick<ExecResult, 'kind' | 'message'>): ExecResult => ({
  changes: EMPTY,
  undo: null,
  ...r,
});

/** Apply a patch to a state (used for undo and tests; the app applies the same patch through LifeContext). */
export function applyPatch(state: LifeState, patch: Patch): LifeState {
  let next = patch.upserts.length ? upsertRecords(state, patch.upserts) : state;
  for (const { collection, id } of patch.deletes) {
    next = {
      ...next,
      [collection]: (next[collection] as { id: string }[]).filter((item) => item.id !== id),
    } as LifeState;
  }
  if (patch.settings) next = { ...next, settings: { ...next.settings, ...patch.settings } };
  return next;
}

/* ------------------------------------------------------------------ per intent */

function addGroceries(items: ItemSlot[], state: LifeState, lang: string, newId: () => string): ExecResult {
  const upserts: SaveEntry[] = [],
    undoUpserts: SaveEntry[] = [],
    undoDeletes: Patch['deletes'] = [];
  const added: string[] = [],
    already: string[] = [];
  for (const item of items) {
    const existing = [...state.groceries, ...upserts.map((u) => u.record as GroceryItem)].find((g) =>
      sameName(g.name, item.name),
    );
    if (existing && !existing.checked) {
      already.push(item.name);
      continue;
    }
    if (existing) {
      // ticked off earlier: bring it back
      const prior = state.groceries.find((g) => g.id === existing.id);
      if (prior) undoUpserts.push({ collection: 'groceries', record: prior });
      upserts.push({
        collection: 'groceries',
        record: { ...existing, checked: false, ...(item.quantity ? { quantity: item.quantity } : {}) },
      });
      added.push(item.name);
      continue;
    }
    const record: GroceryItem = {
      id: newId(),
      name: cap(item.name),
      quantity: item.quantity,
      estimatedCost: 0,
      checked: false,
    };
    upserts.push({ collection: 'groceries', record });
    undoDeletes.push({ collection: 'groceries', id: record.id });
    added.push(item.name);
  }
  if (!upserts.length)
    return result({
      kind: 'done',
      message: voiceText(lang, 'groceriesAlready', { items: joinList(lang, already) }),
    });
  return result({
    kind: 'done',
    message: voiceText(lang, 'groceriesAdded', { items: joinList(lang, added) }),
    changes: patchOf(upserts),
    undo: patchOf(undoUpserts, undoDeletes),
  });
}

function parseLeadingNumber(q: string): number | null {
  const m = q.trim().match(/^(\d+(?:\.\d+)?)$/);
  return m ? Number(m[1]) : null;
}

function addPantry(items: ItemSlot[], state: LifeState, lang: string, newId: () => string): ExecResult {
  const upserts: SaveEntry[] = [],
    undoUpserts: SaveEntry[] = [],
    undoDeletes: Patch['deletes'] = [];
  const names: string[] = [],
    ticked: string[] = [];
  for (const item of items) {
    const existing = state.pantry.find((p) => sameName(p.name, item.name));
    if (existing) {
      const a = parseLeadingNumber(existing.quantity),
        b = parseLeadingNumber(item.quantity);
      const quantity = a !== null && b !== null ? String(a + b) : item.quantity || existing.quantity;
      undoUpserts.push({ collection: 'pantry', record: existing });
      upserts.push({ collection: 'pantry', record: { ...existing, quantity } });
    } else {
      const record: PantryItem = { id: newId(), name: cap(item.name), quantity: item.quantity || '1' };
      upserts.push({ collection: 'pantry', record });
      undoDeletes.push({ collection: 'pantry', id: record.id });
    }
    names.push(item.name);
    // Bought it: tick it off the shopping list.
    const onList = state.groceries.find((g) => !g.checked && sameName(g.name, item.name));
    if (onList) {
      undoUpserts.push({ collection: 'groceries', record: onList });
      upserts.push({ collection: 'groceries', record: { ...onList, checked: true } });
      ticked.push(item.name);
    }
  }
  return result({
    kind: 'done',
    message:
      voiceText(lang, 'pantryAdded', { items: joinList(lang, names) }) +
      (ticked.length ? voiceText(lang, 'pantryTicked') : ''),
    changes: patchOf(upserts),
    undo: patchOf(undoUpserts, undoDeletes),
  });
}

function removePantry(items: ItemSlot[], state: LifeState, lang: string, newId: () => string): ExecResult {
  const deletes: Patch['deletes'] = [],
    upserts: SaveEntry[] = [],
    undoUpserts: SaveEntry[] = [],
    undoDeletes: Patch['deletes'] = [];
  const removed: string[] = [],
    listed: string[] = [],
    missing: string[] = [];
  for (const item of items) {
    const existing = state.pantry.find((p) => sameName(p.name, item.name));
    if (existing) {
      deletes.push({ collection: 'pantry', id: existing.id });
      undoUpserts.push({ collection: 'pantry', record: existing });
      removed.push(item.name);
    } else missing.push(item.name);
    // Running out means buying: put it on the shopping list (once).
    const onList = [...state.groceries, ...upserts.map((u) => u.record as GroceryItem)].find((g) =>
      sameName(g.name, item.name),
    );
    if (!onList) {
      const record: GroceryItem = {
        id: newId(),
        name: cap(item.name),
        quantity: '',
        estimatedCost: 0,
        checked: false,
      };
      upserts.push({ collection: 'groceries', record });
      undoDeletes.push({ collection: 'groceries', id: record.id });
      listed.push(item.name);
    } else if (onList.checked) {
      const prior = state.groceries.find((g) => g.id === onList.id);
      if (prior) {
        undoUpserts.push({ collection: 'groceries', record: prior });
        upserts.push({ collection: 'groceries', record: { ...prior, checked: false } });
        listed.push(item.name);
      }
    }
  }
  const parts: string[] = [];
  if (removed.length) parts.push(voiceText(lang, 'pantryRemoved', { items: joinList(lang, removed) }));
  if (listed.length) parts.push(voiceText(lang, 'pantryToList', { items: joinList(lang, listed) }));
  if (!parts.length) parts.push(voiceText(lang, 'pantryNotFound', { items: joinList(lang, missing) }));
  const changes = patchOf(upserts, deletes);
  return result({
    kind: 'done',
    message: parts.join(' · '),
    changes,
    undo: hasChanges(changes) ? patchOf(undoUpserts, undoDeletes) : null,
  });
}

type MealLogSlots = Extract<ParsedIntent, { intent: 'meal.log' }>['slots'];
const slotWord = (lang: string, slot: MealSlotName) => voiceText(lang, slot);
const whenWord = (lang: string, daysAgo: number) =>
  daysAgo === 0
    ? voiceText(lang, 'today')
    : daysAgo === 1
      ? voiceText(lang, 'yesterday')
      : voiceText(lang, 'daysAgo', { n: daysAgo });

function logMeals(
  slots: MealLogSlots,
  state: LifeState,
  now: Date,
  lang: string,
  newId: () => string,
): ExecResult {
  const date = dateKey(now, slots.daysAgo);
  const recents = [...state.meals].sort((a, b) => b.date.localeCompare(a.date));
  const upserts: SaveEntry[] = [],
    deletes: Patch['deletes'] = [];
  const names: string[] = [];
  let unknown = false;
  for (const item of slots.items) {
    const past = recents.find((m) => sameName(m.name, item.name));
    const recipe = past ? undefined : state.recipes.find((r) => sameName(r.name, item.name));
    let record: MealEntry;
    if (past) {
      record = {
        id: newId(),
        name: past.name,
        date,
        slot: slots.slot,
        calories: past.calories,
        protein: past.protein,
        carbs: past.carbs,
        fat: past.fat,
        estimated: past.estimated,
        servings: item.servings,
        ...(past.unknownNutrients?.length ? { unknownNutrients: past.unknownNutrients } : {}),
        ...(past.grams ? { grams: past.grams } : {}),
        ...(past.foodRef ? { foodRef: past.foodRef } : {}),
      };
    } else if (recipe) {
      record = {
        id: newId(),
        name: recipe.name,
        date,
        slot: slots.slot,
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: recipe.fat,
        estimated: recipe.estimated ?? false,
        servings: item.servings,
        ...(recipe.unknownNutrients?.length ? { unknownNutrients: recipe.unknownNutrients } : {}),
      };
    } else {
      // Never invent numbers: save with unknown nutrients so the screen asks for them later.
      record = {
        id: newId(),
        name: cap(item.name),
        date,
        slot: slots.slot,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        estimated: true,
        servings: item.servings,
        unknownNutrients: ['calories', 'protein', 'carbs', 'fat'],
        ...(item.grams ? { grams: item.grams } : {}),
      };
    }
    if (record.unknownNutrients?.length) unknown = true;
    upserts.push({ collection: 'meals', record });
    deletes.push({ collection: 'meals', id: record.id });
    names.push(item.name);
  }
  return result({
    kind: 'done',
    message:
      voiceText(lang, 'mealLogged', { slot: slotWord(lang, slots.slot), items: joinList(lang, names) }) +
      (unknown ? voiceText(lang, 'mealUnknownMacros') : ''),
    changes: patchOf(upserts),
    undo: patchOf([], deletes),
  });
}

function repeatMeal(
  slots: { slot: MealSlotName; daysAgo: number },
  state: LifeState,
  now: Date,
  lang: string,
  newId: () => string,
): ExecResult {
  const source = dateKey(now, slots.daysAgo),
    target = dateKey(now, 0);
  const found = state.meals.filter((m) => m.date.slice(0, 10) === source && m.slot === slots.slot);
  if (!found.length) {
    return result({
      kind: 'error',
      message: voiceText(lang, 'mealNothing', {
        slot: slotWord(lang, slots.slot),
        when: whenWord(lang, slots.daysAgo),
      }),
      navigate: { pathname: '/meals' },
    });
  }
  const upserts: SaveEntry[] = found.map((m) => ({
    collection: 'meals',
    record: { ...m, id: newId(), date: target },
  }));
  return result({
    kind: 'done',
    message: voiceText(lang, 'mealRepeated', {
      slot: slotWord(lang, slots.slot),
      when: whenWord(lang, slots.daysAgo),
      items: joinList(
        lang,
        found.map((m) => m.name),
      ),
    }),
    changes: patchOf(upserts),
    undo: patchOf(
      [],
      upserts.map((u) => ({ collection: 'meals' as const, id: u.record.id })),
    ),
  });
}

function startWorkout(planName: string | undefined, state: LifeState, lang: string): ExecResult {
  const key = planName ? fold(planName) : '';
  const plan =
    key.length >= 3
      ? (state.workouts.find((w) => fold(w.name) === key) ??
        state.workouts.find(
          (w) => fold(w.name).includes(key) || (key.includes(fold(w.name)) && fold(w.name).length >= 3),
        ))
      : undefined;
  if (plan) {
    return result({
      kind: 'navigate',
      message: voiceText(lang, 'workoutPlan', { name: plan.name }),
      navigate: { pathname: '/fitness', params: { action: 'startPlan', workoutId: plan.id } },
    });
  }
  return result({
    kind: 'navigate',
    message: voiceText(lang, 'workoutToday'),
    navigate: { pathname: '/fitness', params: { action: 'startToday' } },
  });
}

const NAV: Record<NavTarget, { navigate: Navigation; where: VoiceKey }> = {
  home: { navigate: { pathname: '/' }, where: 'whereHome' },
  meals: { navigate: { pathname: '/meals' }, where: 'whereMeals' },
  style: { navigate: { pathname: '/style' }, where: 'whereStyle' },
  fitness: { navigate: { pathname: '/fitness' }, where: 'whereFitness' },
  'fitness.history': {
    navigate: { pathname: '/fitness', params: { action: 'history' } },
    where: 'whereHistory',
  },
  profile: { navigate: { pathname: '/profile' }, where: 'whereProfile' },
};

function logWeight(
  slots: { value: number; unit?: 'kg' | 'lb' },
  state: LifeState,
  now: Date,
  lang: string,
  newId: () => string,
): ExecResult {
  const unit = slots.unit ?? state.settings.unit ?? 'kg';
  const kg = Math.round((unit === 'lb' ? slots.value * 0.45359237 : slots.value) * 10) / 10;
  if (!(kg >= 20 && kg <= 400)) return result({ kind: 'error', message: voiceText(lang, 'weightInvalid') });
  const date = dateKey(now);
  const today = state.weightEntries.find((w) => w.date.slice(0, 10) === date);
  const record: WeightEntry = { id: today?.id ?? newId(), date, weight: kg };
  const shown = String(kg).replace(
    '.',
    lang === 'fr' || lang === 'es' || lang === 'pt' || lang === 'de' ? ',' : '.',
  );
  return result({
    kind: 'done',
    message: voiceText(lang, 'weightLogged', { value: shown, unit: 'kg' }),
    changes: patchOf([{ collection: 'weightEntries', record }]),
    undo: today
      ? patchOf([{ collection: 'weightEntries', record: today }])
      : patchOf([], [{ collection: 'weightEntries', id: record.id }]),
  });
}

function setTargets(
  slots: Extract<ParsedIntent, { intent: 'targets.set' }>['slots'],
  state: LifeState,
  lang: string,
): ExecResult {
  const patch: Partial<LifeSettings> = {};
  const parts: string[] = [];
  const cur = slots.currency ?? state.settings.currency;
  if (slots.calories) {
    patch.calorieTarget = slots.calories;
    parts.push(voiceText(lang, 'tCalories', { n: slots.calories }));
  }
  if (slots.protein) {
    patch.proteinTarget = slots.protein;
    parts.push(voiceText(lang, 'tProtein', { n: slots.protein }));
  }
  if (slots.carbs) {
    patch.carbsTarget = slots.carbs;
    parts.push(voiceText(lang, 'tCarbs', { n: slots.carbs }));
  }
  if (slots.fat) {
    patch.fatTarget = slots.fat;
    parts.push(voiceText(lang, 'tFat', { n: slots.fat }));
  }
  if (slots.budget) {
    patch.weeklyBudget = slots.budget;
    parts.push(voiceText(lang, 'tBudget', { n: slots.budget, cur }));
    if (slots.currency) patch.currency = slots.currency;
  }
  const previous: Partial<LifeSettings> = {};
  for (const key of Object.keys(patch) as (keyof LifeSettings)[])
    (previous as Record<string, unknown>)[key] = state.settings[key];
  return result({
    kind: 'done',
    message: voiceText(lang, 'targetsSet', { what: parts.join(', ') }),
    changes: { upserts: [], deletes: [], settings: patch },
    undo: { upserts: [], deletes: [], settings: previous },
  });
}

function planToday(slot: MealSlotName | undefined, state: LifeState, now: Date, lang: string): ExecResult {
  const today = dateKey(now);
  const meal = slot
    ? state.plannedMeals.find((m) => m.date.slice(0, 10) === today && m.slot === slot)
    : mealForToday(state.plannedMeals, now);
  if (!meal)
    return result({
      kind: 'navigate',
      message: voiceText(lang, 'planTodayNone'),
      navigate: { pathname: '/meals', params: { action: 'plan' } },
    });
  const label = voiceText(lang, `ps_${meal.slot}` as VoiceKey);
  return result({
    kind: 'done',
    message:
      meal.leftover || !meal.minutes
        ? voiceText(lang, 'planTodayLeft', { slot: label, name: meal.name })
        : voiceText(lang, 'planTodayMeal', { slot: label, name: meal.name, n: meal.minutes }),
  });
}

function addWardrobe(
  slots: Extract<ParsedIntent, { intent: 'wardrobe.add' }>['slots'],
  state: LifeState,
  lang: string,
  newId: () => string,
): ExecResult {
  const existing = state.wardrobe.find((w) => w.category === slots.category && sameName(w.name, slots.name));
  if (existing)
    return result({ kind: 'done', message: voiceText(lang, 'wardrobeAlready', { name: existing.name }) });
  const record: WardrobeItem = {
    id: newId(),
    name: cap(slots.name),
    category: slots.category,
    color: slots.color,
    status: 'clean',
  };
  return result({
    kind: 'done',
    message: voiceText(lang, 'wardrobeAdded', { name: record.name }),
    changes: patchOf([{ collection: 'wardrobe', record }]),
    undo: patchOf([], [{ collection: 'wardrobe', id: record.id }]),
  });
}

/* ------------------------------------------------------------------ entry point */

/** One-line "Add milk to your list" description of what an intent would do (for the confirm card). */
export function describeIntent(intent: ParsedIntent, lang: string): string {
  const names = (items: { name: string }[]) =>
    joinList(
      lang,
      items.map((i) => i.name),
    );
  switch (intent.intent) {
    case 'groceries.add':
      return voiceText(lang, 'dGroceries', { items: names(intent.slots.items) });
    case 'pantry.add':
      return voiceText(lang, 'dPantryAdd', { items: names(intent.slots.items) });
    case 'pantry.remove':
      return voiceText(lang, 'dPantryRemove', { items: names(intent.slots.items) });
    case 'meal.log':
      return voiceText(lang, 'dMealLog', {
        items: names(intent.slots.items),
        slot: slotWord(lang, intent.slots.slot),
      });
    case 'meal.repeat':
      return voiceText(lang, 'dMealRepeat', {
        slot: slotWord(lang, intent.slots.slot),
        when: whenWord(lang, intent.slots.daysAgo),
      });
    case 'workout.start':
      return intent.slots.planName
        ? voiceText(lang, 'dWorkoutPlan', { name: intent.slots.planName })
        : voiceText(lang, 'dWorkout');
    case 'set.log':
      return voiceText(lang, 'dSet', { text: intent.slots.text });
    case 'timer.start':
      return voiceText(lang, 'dTimer', { time: formatTime(intent.slots.seconds) });
    case 'outfit.today':
      return voiceText(lang, 'dOutfit');
    case 'weight.log':
      return voiceText(lang, 'dWeight', { value: intent.slots.value, unit: intent.slots.unit ?? '' }).trim();
    case 'nav.open':
      return voiceText(lang, 'dNav', { where: voiceText(lang, NAV[intent.slots.target].where) });
    case 'targets.set':
      return voiceText(lang, 'dTargets');
    case 'plan.week':
      return voiceText(lang, 'dPlanWeek');
    case 'plan.today':
      return voiceText(lang, 'dPlanToday');
    case 'wardrobe.add':
      return voiceText(lang, 'dWardrobe', { name: intent.slots.name });
    case 'fallback':
      return intent.slots.text;
  }
}

export function executeIntent(
  intent: ParsedIntent,
  state: LifeState,
  now: Date,
  options: ExecOptions = {},
): ExecResult {
  const lang = options.lang ?? 'en';
  if (intent.intent === 'fallback') {
    // No chat fallback: say what we heard and show commands that work.
    return result({
      kind: 'unknown',
      message: voiceText(lang, 'unknownTitle'),
      examples: examplesForArea(lang, intent.slots.area),
    });
  }
  if (!options.confirmed && intent.confidence < EXECUTE_MIN) {
    return result({ kind: 'confirm', message: describeIntent(intent, lang), pending: intent });
  }
  const newId = makeIds(now, options.idPrefix);
  switch (intent.intent) {
    case 'groceries.add':
      return addGroceries(intent.slots.items, state, lang, newId);
    case 'pantry.add':
      return addPantry(intent.slots.items, state, lang, newId);
    case 'pantry.remove':
      return removePantry(intent.slots.items, state, lang, newId);
    case 'meal.log':
      return logMeals(intent.slots, state, now, lang, newId);
    case 'meal.repeat':
      return repeatMeal(intent.slots, state, now, lang, newId);
    case 'workout.start':
      return startWorkout(intent.slots.planName, state, lang);
    case 'set.log':
      return result({
        kind: 'navigate',
        message: voiceText(lang, 'setLogged'),
        navigate: { pathname: '/fitness', params: { action: 'logSet', text: intent.slots.text } },
      });
    case 'timer.start':
      return result({
        kind: 'timer',
        message: voiceText(lang, 'timerSet', { time: formatTime(intent.slots.seconds) }),
        timerSeconds: intent.slots.seconds,
      });
    case 'outfit.today':
      return result({
        kind: 'navigate',
        message: voiceText(lang, 'outfit'),
        navigate: { pathname: '/style', params: { action: 'today' } },
      });
    case 'weight.log':
      return logWeight(intent.slots, state, now, lang, newId);
    case 'nav.open': {
      const n = NAV[intent.slots.target];
      return result({
        kind: 'navigate',
        message: voiceText(lang, 'navOpen', { where: voiceText(lang, n.where) }),
        navigate: n.navigate,
      });
    }
    case 'targets.set':
      return setTargets(intent.slots, state, lang);
    case 'plan.week':
      return result({
        kind: 'navigate',
        message: voiceText(lang, 'planWeekOpen'),
        navigate: { pathname: '/meals', params: { action: 'planWeek' } },
      });
    case 'plan.today':
      return planToday(intent.slots.slot, state, now, lang);
    case 'wardrobe.add':
      return addWardrobe(intent.slots, state, lang, newId);
  }
}

export { formatTime };
