/**
 * AI voice agent glue (pure, no React, no network):
 * - maps the validated tool calls returned by the server's voice agent route to the SAME `ParsedIntent`s the local parser
 *   produces, so every action runs through `executeIntent` (same records, same Undo, same navigation);
 * - decides which actions need an explicit "Yes" (destructive or big);
 * - runs several actions in order and builds one combined result with an exact undo;
 * - builds the compact summary of the user's own data sent with the request.
 * Local parser first (free, offline); the agent is only asked when it does not understand.
 */
import { totalsForDate, type LifeState } from '../life';
import {
  applyPatch,
  dateKey,
  executeIntent,
  hasChanges,
  type ExecResult,
  type Navigation,
  type Patch,
} from './execute';
import {
  slotForTime,
  type GarmentCategory,
  type IntentName,
  type MealItemSlot,
  type MealSlotName,
  type NavTarget,
  type ParsedIntent,
} from './intents';

export type AgentAction = { name: string; args: Record<string, unknown> };
export type AgentReply = { reply: string; actions: AgentAction[] };

const SLOTS: readonly MealSlotName[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const CATEGORIES: readonly GarmentCategory[] = ['top', 'bottom', 'shoes', 'outerwear', 'accessory'];
const TARGETS: readonly NavTarget[] = ['home', 'meals', 'style', 'fitness', 'fitness.history', 'profile'];
const MAX_ACTIONS = 6;
const MAX_ITEMS = 20;

/** Destructive or big: they never run without an explicit "Yes". */
export const NEEDS_YES: ReadonlySet<IntentName> = new Set<IntentName>([
  'pantry.remove',
  'plan.week',
  'targets.set',
]);
export const needsYes = (intents: ParsedIntent[]) => intents.some((i) => NEEDS_YES.has(i.intent));

const str = (v: unknown, max: number) =>
  typeof v === 'string' && v.trim() ? v.replace(/\s+/g, ' ').trim().slice(0, max) : undefined;
const num = (v: unknown, min: number, max: number) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};
const pick = <T extends string>(v: unknown, values: readonly T[]) =>
  (values as readonly unknown[]).includes(v) ? (v as T) : undefined;
const list = (v: unknown) =>
  (Array.isArray(v) ? v.slice(0, MAX_ITEMS) : []).map((r) =>
    typeof r === 'string' ? { name: r } : r && typeof r === 'object' ? (r as Record<string, unknown>) : {},
  );

/** One tool call → one app intent (confidence 1: the app's own executor still validates the values). Null when unusable. */
export function actionToIntent(action: AgentAction, now: Date): ParsedIntent | null {
  const a = action?.args && typeof action.args === 'object' ? action.args : {};
  const c = 1;
  switch (action?.name) {
    case 'add_groceries':
    case 'add_to_fridge':
    case 'remove_from_fridge': {
      const items = list(a.items).flatMap((r) => {
        const name = str(r.name, 60);
        return name
          ? [{ name, quantity: action.name === 'remove_from_fridge' ? '' : (str(r.quantity, 40) ?? '') }]
          : [];
      });
      if (!items.length) return null;
      const intent =
        action.name === 'add_groceries'
          ? 'groceries.add'
          : action.name === 'add_to_fridge'
            ? 'pantry.add'
            : 'pantry.remove';
      return { intent, slots: { items }, confidence: c };
    }
    case 'log_meal': {
      const items: MealItemSlot[] = list(a.items).flatMap((r) => {
        const name = str(r.name, 60);
        if (!name) return [];
        const grams = num(r.grams, 1, 10000);
        return [{ name, servings: num(r.servings, 0.1, 100) ?? 1, ...(grams ? { grams } : {}) }];
      });
      if (!items.length) return null;
      const slot = pick(a.slot, SLOTS);
      const daysAgo = Math.round(num(a.daysAgo, 0, 6) ?? 0);
      return {
        intent: 'meal.log',
        slots: { items, slot: slot ?? slotForTime(now), daysAgo, slotExplicit: Boolean(slot) },
        confidence: c,
      };
    }
    case 'repeat_meal': {
      const slot = pick(a.slot, SLOTS);
      return slot
        ? {
            intent: 'meal.repeat',
            slots: { slot, daysAgo: Math.round(num(a.daysAgo, 1, 6) ?? 1) },
            confidence: c,
          }
        : null;
    }
    case 'plan_week':
      return { intent: 'plan.week', slots: {}, confidence: c };
    case 'show_today_meal': {
      const slot = pick(a.slot, SLOTS);
      return { intent: 'plan.today', slots: slot ? { slot } : {}, confidence: c };
    }
    case 'start_workout': {
      const planName = str(a.planName, 80);
      return { intent: 'workout.start', slots: planName ? { planName } : {}, confidence: c };
    }
    case 'log_set': {
      const text = str(a.text, 120);
      return text ? { intent: 'set.log', slots: { text }, confidence: c } : null;
    }
    case 'start_timer': {
      const s = num(a.seconds, 1, 86400);
      return s ? { intent: 'timer.start', slots: { seconds: Math.round(s) }, confidence: c } : null;
    }
    case 'log_weight': {
      const unit = pick(a.unit, ['kg', 'lb'] as const);
      const value = num(a.value, 1, 1000);
      return value
        ? { intent: 'weight.log', slots: unit ? { value, unit } : { value }, confidence: c }
        : null;
    }
    case 'set_targets': {
      const slots: Extract<ParsedIntent, { intent: 'targets.set' }>['slots'] = {};
      const cal = num(a.calories, 800, 8000),
        p = num(a.protein, 10, 500),
        cb = num(a.carbs, 10, 1000),
        f = num(a.fat, 10, 400),
        b = num(a.budget, 1, 100000);
      if (cal) slots.calories = Math.round(cal);
      if (p) slots.protein = Math.round(p);
      if (cb) slots.carbs = Math.round(cb);
      if (f) slots.fat = Math.round(f);
      if (b) {
        slots.budget = b;
        const cur =
          typeof a.currency === 'string' && /^[A-Za-z]{3}$/.test(a.currency)
            ? a.currency.toUpperCase()
            : undefined;
        if (cur) slots.currency = cur;
      }
      return Object.keys(slots).length ? { intent: 'targets.set', slots, confidence: c } : null;
    }
    case 'outfit_today':
      return { intent: 'outfit.today', slots: {}, confidence: c };
    case 'add_wardrobe_item': {
      const name = str(a.name, 80),
        category = pick(a.category, CATEGORIES);
      return name && category
        ? { intent: 'wardrobe.add', slots: { name, category, color: str(a.color, 40) ?? '' }, confidence: c }
        : null;
    }
    case 'navigate': {
      const target = pick(a.target, TARGETS);
      return target ? { intent: 'nav.open', slots: { target }, confidence: c } : null;
    }
    default:
      return null;
  }
}

/** Validated intents (max 6, unknown calls dropped) for a server reply. */
export function actionsToIntents(actions: unknown, now: Date): { intents: ParsedIntent[]; dropped: number } {
  const all = Array.isArray(actions) ? actions : [];
  const intents: ParsedIntent[] = [];
  let dropped = 0;
  for (const raw of all) {
    const intent =
      intents.length < MAX_ACTIONS && raw && typeof raw === 'object'
        ? actionToIntent(raw as AgentAction, now)
        : null;
    if (intent) intents.push(intent);
    else dropped += 1;
  }
  return { intents, dropped };
}

export type AgentRun = {
  /** One message per action (already translated), joined for the toast. */
  message: string;
  /** Patches to apply in order (each was computed on the state left by the previous one). */
  changes: Patch[];
  /** Exact undo: apply in order (it is already reversed). Empty when nothing was written. */
  undo: Patch[];
  /** Last navigation asked (one screen at a time). */
  navigate?: Navigation;
  timerSeconds?: number;
  error: boolean;
};

/** Run intents one after another through the local executor (all confirmed), as one result with one Undo. */
export function runIntents(
  intents: ParsedIntent[],
  state: LifeState,
  now: Date,
  options: { lang?: string; idPrefix?: string } = {},
): AgentRun {
  const base = options.idPrefix ?? `a${now.getTime().toString(36)}`;
  let current = state;
  const messages: string[] = [],
    changes: Patch[] = [],
    undo: Patch[] = [];
  let navigate: Navigation | undefined,
    timerSeconds: number | undefined,
    error = false;
  intents.forEach((intent, i) => {
    const r: ExecResult = executeIntent(intent, current, now, {
      lang: options.lang,
      idPrefix: `${base}-${i}`,
      confirmed: true,
    });
    if (r.message) messages.push(r.message);
    if (r.kind === 'error') error = true;
    if (hasChanges(r.changes)) {
      changes.push(r.changes);
      current = applyPatch(current, r.changes);
      if (r.undo && hasChanges(r.undo)) undo.unshift(r.undo);
    }
    if (r.navigate) navigate = r.navigate;
    if (r.timerSeconds && !timerSeconds) timerSeconds = r.timerSeconds;
  });
  return {
    message: messages.join(' · '),
    changes,
    undo,
    navigate,
    timerSeconds,
    error: error && !changes.length,
  };
}

/* ------------------------------------------------------------------ data summary */

const MAX_SUMMARY = 7500;
const r0 = (n: number) => Math.round(n);

/** Compact JSON summary of the user's own data (no photos, no ids except names) for questions like "how many calories left?". */
export function buildSummary(state: LifeState, now: Date): string {
  const today = dateKey(now);
  const s = state.settings;
  const t = totalsForDate(state.meals, today);
  const weights = [...state.weightEntries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map((w) => [w.date.slice(0, 10), w.weight]);
  const plan = state.plannedMeals
    .filter((m) => m.date.slice(0, 10) >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 14)
    .map((m) => `${m.date.slice(0, 10)} ${m.slot}: ${m.name}`);
  const data = {
    today,
    profile: {
      firstName: s.firstName,
      goal: s.mainGoal,
      trainingPlace: s.trainingPlace,
      sessionsPerWeek: s.sessionsPerWeek,
      styleVibes: s.styleVibes,
      diet: s.diet,
    },
    targets: {
      calories: s.calorieTarget,
      protein: s.proteinTarget,
      carbs: s.carbsTarget,
      fat: s.fatTarget,
      weeklyBudget: s.weeklyBudget,
      currency: s.currency,
    },
    eatenToday: {
      calories: r0(t.calories),
      protein: r0(t.protein),
      carbs: r0(t.carbs),
      fat: r0(t.fat),
      mealsWithUnknownNutrition: t.incomplete,
      meals: state.meals
        .filter((m) => m.date.slice(0, 10) === today)
        .map((m) => `${m.slot}: ${m.name}`)
        .slice(0, 12),
    },
    plan,
    fridge: state.pantry.slice(0, 60).map((p) => (p.quantity ? `${p.name} (${p.quantity})` : p.name)),
    shoppingList: state.groceries
      .filter((g) => !g.checked)
      .slice(0, 60)
      .map((g) => g.name),
    workouts: state.workouts.slice(0, 12).map((w) => w.name),
    lastSessions: [...state.sessions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 4)
      .map((x) => `${x.date.slice(0, 10)} ${x.workoutName}`),
    weightKg: weights,
    wardrobe: state.wardrobe
      .slice(0, 80)
      .map(
        (w) =>
          `${w.name} (${w.category}${w.color ? `, ${w.color}` : ''}${w.status === 'laundry' ? ', laundry' : ''})`,
      ),
  };
  let json = JSON.stringify(data);
  // Too long: shorten the biggest lists until it fits.
  const lists = ['wardrobe', 'fridge', 'shoppingList', 'plan', 'workouts'] as const;
  while (json.length > MAX_SUMMARY) {
    const biggest = lists.reduce((a, b) => (data[a].length >= data[b].length ? a : b));
    if (!data[biggest].length) break;
    (data[biggest] as unknown[]).splice(Math.floor(data[biggest].length / 2));
    json = JSON.stringify(data);
  }
  return json.slice(0, MAX_SUMMARY);
}

/** Why the agent could not help, from an HTTP status (0 = network). */
export type AgentFailure = 'off' | 'limit' | 'down' | 'budget';
export function failureFromStatus(status: number | undefined): AgentFailure {
  if (status === 503) return 'off';
  if (status === 429 || status === 402 || status === 401) return 'limit';
  return 'down';
}

/** Same, from the thrown API error; `budget` = this month's AI budget is used (server answers `code: ai_budget`). */
export function failureFromError(error: unknown): AgentFailure {
  const e = error as { status?: number; data?: unknown } | null | undefined;
  const code = e?.data && typeof e.data === 'object' ? (e.data as { code?: unknown }).code : undefined;
  if (code === 'ai_budget') return 'budget';
  return failureFromStatus(e?.status);
}
