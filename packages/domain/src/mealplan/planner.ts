/**
 * Deterministic weekly meal planner. Pure: no I/O, no Date.now, no Math.random.
 *
 * Greedy chronological fill: for each (day, slot) every eligible recipe is scored (time fit, pantry coverage and
 * use-it-first, calorie fit, variety, favourites, repeats, cost) and the best wins; cooking a batch can cover
 * the next slots as leftovers (0 extra minutes). If a budget is set the whole plan is re-run with an escalating cost
 * weight until the shopping list fits; otherwise the cheapest plan found is returned with a warning.
 */
import { addDays, daysBetween, defaultCookMinutesByDay, hash01 } from './dates';
import { isAllowed, prepareDislikes, tokensOf } from './diet';
import { PantryLedger } from './pantry';
import { buildShoppingList, currencyFactor, LEVEL_FACTOR, type CookEvent } from './shopping';
import {
  slotKey,
  SLOT_ORDER,
  type PlanDay,
  type PlanIngredient,
  type PlanInput,
  type PlanReason,
  type PlanRecipe,
  type PlanResult,
  type PlanWarning,
  type PlannedSlot,
  type Slot,
} from './types';

const SLOT_SHARE: Record<Slot, number> = { breakfast: 0.25, lunch: 0.35, dinner: 0.4, snack: 0.1 };
const SLOT_TIME: Record<Slot, number> = { breakfast: 0.15, lunch: 0.35, dinner: 0.5, snack: 0.1 };
const MAX_EXTRA_PORTIONS = 2; // a batch covers at most 3 meals
const BATCH_TIME_GROWTH = 0.1; // cooking a bigger batch takes ~10% longer per extra meal
const COST_WEIGHTS_BUDGET = [3, 6, 12, 24, 60, 400];
const DEFAULT_KCAL = 2000;
/** Score bonus of a nutritionist pick (the first one gets the full bonus, the last one half of it). */
const PREFERRED_BONUS = 4;

export type FixedMeal = {
  date: string;
  slot: Slot;
  recipeId: string;
  leftover?: boolean;
  batchOf?: string;
  locked?: boolean;
};
export type PlanOptions = { fixed?: FixedMeal[]; avoidRecipeIds?: string[]; swappedKeys?: string[] };

type Prep = {
  r: PlanRecipe;
  id: string;
  minutes: number;
  noCook: boolean;
  kcal: number;
  protein: number;
  slotSet: Set<Slot>;
  cost1: number;
  costKnown: boolean;
  ings: { ing: PlanIngredient; idx: number }[];
  cuisine: string;
  nameKey: string;
  eligible: boolean;
  hasIngCost: boolean;
};
type Cell = { date: string; slot: Slot; d: number; key: string; order: number };
type Assigned = {
  p: Prep;
  leftover: boolean;
  locked: boolean;
  batchOf?: string;
  minutes: number;
  cost: number;
  uses: string[];
  reasons: PlanReason[];
};
type Ctx = {
  input: PlanInput;
  days: string[];
  slots: Slot[];
  cells: Cell[];
  cellByKey: Map<string, Cell>;
  preps: Map<string, Prep>;
  pool: Prep[];
  people: number;
  dayMinutes: number[];
  dayKcal: number;
  targetsAssumed: boolean;
  perMealBudget: number;
  seed: number;
  levelF: number;
  cur: number;
  share: Record<string, number>;
  history: Map<string, number>;
  medianCost: number;
  portion: number;
  preferred: Map<string, number>;
};
type RunOut = {
  assigned: Map<string, Assigned>;
  events: CookEvent[];
  warnings: PlanWarning[];
  repeated: boolean;
};

const batchMinutes = (p: Prep, portions: number) =>
  p.noCook ? 0 : Math.ceil(p.minutes * (1 + BATCH_TIME_GROWTH * (portions - 1)) - 1e-9);
const norm = (s: string) => tokensOf(s).join(' ');

function prepare(input: PlanInput): Ctx {
  const nDays = Math.max(1, Math.min(31, Math.floor(input.days ?? 7)));
  const slots = (
    input.slots?.length ? [...new Set(input.slots)] : (['breakfast', 'lunch', 'dinner'] as Slot[])
  ).sort((a, b) => SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b));
  const days = Array.from({ length: nDays }, (_, i) => addDays(input.startDate, i));
  const cells: Cell[] = [];
  days.forEach((date, d) =>
    slots.forEach((slot) => cells.push({ date, slot, d, key: slotKey(date, slot), order: cells.length })),
  );
  const defaults = defaultCookMinutesByDay(input.startDate, nDays);
  const dayMinutes = days.map((date) =>
    Math.max(0, Math.round(input.cookMinutesByDay[date] ?? defaults[date])),
  );
  const people = Math.max(1, Math.min(12, Math.round(input.people || 1)));
  const level = input.priceLevel ?? 'mid';
  const cur = currencyFactor(input.prices, input.currency);
  const levelF = LEVEL_FACTOR[level];
  const matcher = new PantryLedger(input.pantry);
  const dislikes = prepareDislikes(input.dislikes ?? []);
  const portion = Math.max(
    0.5,
    Math.min(2, input.portionFactor && Number.isFinite(input.portionFactor) ? input.portionFactor : 1),
  );
  const prefIds = [...new Set(input.preferredRecipeIds ?? [])];
  const preferred = new Map(
    prefIds.map((id, i) => [
      id,
      PREFERRED_BONUS * (1 - 0.5 * (prefIds.length > 1 ? i / (prefIds.length - 1) : 0)),
    ]),
  );
  const preps = new Map<string, Prep>();
  const costs: number[] = [];
  for (const r of [...input.recipes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (preps.has(r.id)) continue;
    const noCook = r.tags.includes('no_cook');
    const ings = r.ingredients
      .filter((i) => !i.optional && !i.staple)
      .map((ing) => ({ ing, idx: matcher.match(ing) }));
    const known = typeof r.costPerServing === 'number' && r.costPerServing >= 0;
    const ingCost = r.ingredients.some((i) => typeof i.cost === 'number');
    let c1 = known ? r.costPerServing! : NaN;
    if (!known && ingCost && r.servings > 0)
      c1 = r.ingredients.reduce((s, i) => s + (i.cost ?? 0), 0) / r.servings;
    const p: Prep = {
      r,
      id: r.id,
      minutes: Math.max(0, Math.round(r.prepMinutes + r.cookMinutes)),
      noCook,
      kcal: r.macrosKnown === false ? 0 : r.perServing.calories * portion,
      protein: r.macrosKnown === false ? 0 : r.perServing.protein * portion,
      slotSet: new Set(r.slots),
      cost1: c1 * levelF * cur,
      costKnown: !Number.isNaN(c1),
      ings,
      cuisine: r.cuisine ?? '',
      nameKey: norm(r.name),
      hasIngCost: ingCost,
      eligible: isAllowed(r, input.diet ?? [], dislikes, input.allergies ?? []),
    };
    preps.set(r.id, p);
    if (p.eligible && p.costKnown) costs.push(p.cost1);
  }
  costs.sort((a, b) => a - b);
  const medianCost = costs.length ? costs[Math.floor(costs.length / 2)] : 2 * levelF * cur;
  const pool = [...preps.values()].filter((p) => p.eligible && p.slotSet.size > 0 && p.r.servings > 0);
  for (const p of pool) if (!p.costKnown) p.cost1 = medianCost;
  const t = input.targets;
  const targetsAssumed = !t || !(t.calories > 0);
  const slotWeights = slots.reduce((s, x) => s + SLOT_SHARE[x], 0);
  const share: Record<string, number> = {};
  for (const s of slots) share[s] = SLOT_SHARE[s] / slotWeights;
  const mealCount = nDays * slots.length;
  const history = new Map<string, number>();
  for (const m of input.recentMeals ?? []) {
    const ago = daysBetween(m.date, input.startDate);
    if (ago < 1 || ago > 7) continue;
    const key = norm(m.name);
    if (!history.has(key) || history.get(key)! > ago) history.set(key, ago);
  }
  return {
    input,
    days,
    slots,
    cells,
    cellByKey: new Map(cells.map((c) => [c.key, c])),
    preps,
    pool,
    people,
    dayMinutes,
    dayKcal: targetsAssumed ? DEFAULT_KCAL : t!.calories,
    targetsAssumed,
    perMealBudget: input.weeklyBudget > 0 ? input.weeklyBudget / (people * mealCount) : 0,
    seed: input.seed ?? 1,
    levelF,
    cur,
    share,
    history,
    medianCost,
    portion,
    preferred,
  };
}

function run(ctx: Ctx, costK: number, fixed: FixedMeal[], avoid: Set<string>, swapped: Set<string>): RunOut {
  const { input, cells, people, days } = ctx;
  const ledger = new PantryLedger(input.pantry);
  const assigned = new Map<string, Assigned>();
  const used = days.map(() => 0);
  const kcal = days.map(() => 0);
  const lastCook = new Map<string, number>();
  const eaten = new Map<string, number>();
  const cuisineLog: { d: number; c: string }[] = [];
  const events: CookEvent[] = [];
  const warnings: PlanWarning[] = [];
  let repeated = false;
  for (const p of ctx.pool) {
    const ago = ctx.history.get(p.nameKey);
    if (ago !== undefined) lastCook.set(p.id, -ago);
  }

  const commit = (
    cell: Cell,
    p: Prep,
    targets: Cell[],
    flags: { locked?: boolean; reasons?: PlanReason[] },
  ) => {
    const portions = 1 + targets.length;
    const servingsTotal = people * portions * ctx.portion;
    const minutes = batchMinutes(p, portions);
    const scale = servingsTotal / p.r.servings;
    const uses = new Set<string>();
    let cost = 0,
      coveredShare = 0,
      counted = 0,
      urgent = false;
    for (const { ing, idx } of p.ings) {
      const need = ing.grams * scale;
      const covered = need > 0 ? ledger.take(idx, ing, need, cell.date) : 0;
      if (covered > 0) {
        uses.add(ledger.nameOf(idx));
        const exp = ledger.expiryOf(idx);
        if (exp && daysBetween(cell.date, exp) <= 3) urgent = true;
      }
      if (need > 0) {
        coveredShare += covered / need;
        counted += 1;
        if (ing.cost !== undefined) cost += ing.cost * scale * (1 - covered / need);
      }
    }
    cost = p.hasIngCost
      ? cost * ctx.levelF * ctx.cur
      : p.cost1 * servingsTotal * (1 - (counted ? coveredShare / counted : 0));
    const perMeal = Math.round((cost / portions) * 100) / 100;
    used[cell.d] += minutes;
    const reasons = new Set<PlanReason>(flags.reasons ?? []);
    if (flags.locked) reasons.add('locked');
    if (p.noCook) reasons.add('no_cook');
    if (uses.size) reasons.add('uses_pantry');
    if (urgent) reasons.add('use_it_first');
    if (portions > 1) reasons.add('batch');
    if (p.r.favorite) reasons.add('favourite');
    const first: Assigned = {
      p,
      leftover: false,
      locked: !!flags.locked,
      minutes,
      cost: perMeal,
      uses: [...uses],
      reasons: [...reasons],
    };
    assigned.set(cell.key, first);
    kcal[cell.d] += p.kcal;
    for (const t of targets) {
      assigned.set(t.key, {
        p,
        leftover: true,
        locked: false,
        batchOf: cell.key,
        minutes: 0,
        cost: perMeal,
        uses: [],
        reasons: ['leftover'],
      });
      kcal[t.d] += p.kcal;
    }
    const prev = lastCook.get(p.id);
    if (prev !== undefined && cell.d - prev < 3) repeated = true;
    lastCook.set(p.id, cell.d);
    eaten.set(p.id, (eaten.get(p.id) ?? 0) + portions);
    if (p.cuisine) cuisineLog.push({ d: cell.d, c: p.cuisine });
    events.push({ recipe: p.r, servings: servingsTotal, date: cell.date });
  };

  // 1. Fixed meals (user locks, swaps): chronological, with their leftover children attached.
  const fixedByKey = new Map<string, FixedMeal>();
  for (const f of fixed) {
    const c = ctx.cellByKey.get(slotKey(f.date, f.slot));
    if (c && ctx.preps.has(f.recipeId)) fixedByKey.set(c.key, f);
  }
  const ordered = [...fixedByKey.entries()]
    .map(([key, f]) => ({ cell: ctx.cellByKey.get(key)!, f }))
    .sort((a, b) => a.cell.order - b.cell.order);
  const children = new Map<string, Cell[]>();
  const childOf = new Set<string>();
  for (const { cell, f } of ordered) {
    if (f.leftover && f.batchOf && fixedByKey.has(f.batchOf) && !fixedByKey.get(f.batchOf)!.leftover) {
      children.set(f.batchOf, [...(children.get(f.batchOf) ?? []), cell]);
      childOf.add(cell.key);
    }
  }
  for (const { cell, f } of ordered) {
    if (childOf.has(cell.key)) continue;
    const p = ctx.preps.get(f.recipeId)!;
    const kids = (children.get(cell.key) ?? []).slice(0, MAX_EXTRA_PORTIONS);
    commit(cell, p, kids, { locked: f.locked, reasons: swapped.has(cell.key) ? ['swapped'] : [] });
    for (const k of kids) {
      const a = assigned.get(k.key)!;
      a.locked = !!fixedByKey.get(k.key)!.locked;
    }
    if (f.locked && !p.noCook && used[cell.d] > ctx.dayMinutes[cell.d])
      warnings.push({ code: 'locked_over_time', params: { date: cell.date, slot: cell.slot } });
  }

  // 2. Greedy fill.
  const slotCount = ctx.slots.length;
  for (const cell of cells) {
    if (assigned.has(cell.key)) continue;
    const left = ctx.dayMinutes[cell.d] - used[cell.d];
    // allowance for this slot among the day's still-unassigned slots
    let wSum = 0;
    for (let i = 0; i < slotCount; i++) {
      const c = cells[cell.d * slotCount + i];
      if (!assigned.has(c.key)) wSum += SLOT_TIME[c.slot];
    }
    const allowance = Math.max(1, left * (SLOT_TIME[cell.slot] / (wSum || 1)));
    let remShare = 0;
    for (let i = 0; i < slotCount; i++) {
      const c = cells[cell.d * slotCount + i];
      if (!assigned.has(c.key)) remShare += ctx.share[c.slot];
    }
    const slotTarget = Math.max(150, ((ctx.dayKcal - kcal[cell.d]) * ctx.share[cell.slot]) / (remShare || 1));
    const isLast = remShare - ctx.share[cell.slot] < 1e-9;
    const protTarget =
      input.targets && input.targets.protein > 0 ? input.targets.protein * ctx.share[cell.slot] : 0;
    // upcoming free cells within 3 days (leftover targets)
    const upcoming: Cell[] = [];
    for (let j = cell.order + 1; j < cells.length && cells[j].d - cell.d <= 3; j++)
      if (!assigned.has(cells[j].key)) upcoming.push(cells[j]);

    let best: { p: Prep; targets: Cell[]; score: number } | undefined;
    const weekFill = Math.max(1, cuisineLog.length);
    for (const p of ctx.pool) {
      if (!p.slotSet.has(cell.slot) || avoid.has(p.id)) continue;
      if (!p.noCook && p.minutes > left) continue;
      // pantry coverage / use-it-first (single portion estimate)
      let cov = 0,
        urgentSum = 0;
      const scale1 = (people * ctx.portion) / p.r.servings;
      for (const { ing, idx } of p.ings) {
        if (idx < 0) continue;
        const need = ing.grams * scale1;
        const avail = ledger.available(idx, ing, cell.date);
        if (avail <= 0) continue;
        const frac = need > 0 ? Math.min(1, avail / need) : 1;
        cov += frac;
        const exp = ledger.expiryOf(idx);
        if (exp) {
          const dl = daysBetween(cell.date, exp);
          urgentSum += (dl <= 2 ? 1 : dl <= 5 ? 0.6 : dl <= 10 ? 0.3 : 0) * frac;
        }
      }
      const covRatio = p.ings.length ? cov / p.ings.length : 0;
      let score = 7 * covRatio + Math.min(10, 5 * urgentSum);
      // time fit
      if (!p.noCook) {
        const ratio = p.minutes / allowance;
        score += ratio <= 1 ? 1.5 * (1 - ratio) : -Math.min(6, 2 * (ratio - 1));
      } else score += allowance < 20 ? 2.5 : 1;
      // calories / protein
      if (p.kcal > 0) {
        const err = Math.abs(p.kcal - slotTarget) / Math.max(slotTarget, 200);
        score -= (isLast ? 14 : 11) * Math.min(err, 1.5);
      }
      if (protTarget > 0 && p.protein > 0) score += 1.5 * Math.min(1, p.protein / protTarget);
      // variety
      const last = lastCook.get(p.id);
      if (last !== undefined && cell.d - last < 3) score -= 25 - 4 * (cell.d - last);
      score -= 5 * (eaten.get(p.id) ?? 0);
      if (p.cuisine) {
        let same = 0,
          total = 0;
        for (const e of cuisineLog) {
          if (e.c === p.cuisine) {
            total += 1;
            if (cell.d - e.d <= 2) same += 1;
          }
        }
        score -= 1.5 * same + (total / weekFill > 0.4 && cuisineLog.length >= 4 ? 2 : 0);
      }
      if (p.r.favorite) score += 3;
      else if (p.r.source === 'user') score += 1;
      score += ctx.preferred.get(p.id) ?? 0;
      // cost
      const effCost = p.cost1 * (1 - 0.7 * covRatio);
      const ref = ctx.perMealBudget > 0 ? ctx.perMealBudget : 3 * ctx.levelF * ctx.cur;
      score -= costK * (effCost / ref);
      score += (hash01(ctx.seed, p.id, cell.key) - 0.5) * 2;
      // modes: fresh, or cook a batch that also covers the next slots
      const baseTargets =
        p.r.leftoverDays > 0
          ? upcoming.filter(
              (c) => c.d - cell.d <= p.r.leftoverDays && p.slotSet.has(c.slot) && !avoid.has(p.id),
            )
          : [];
      const maxExtra = Math.min(
        MAX_EXTRA_PORTIONS,
        baseTargets.length,
        Math.max(0, 3 - (eaten.get(p.id) ?? 0) - 1),
      );
      for (let extra = 0; extra <= maxExtra; extra++) {
        const targets = baseTargets.slice(0, extra);
        if (batchMinutes(p, 1 + extra) > left) break;
        let s = score;
        if (extra > 0) {
          let pressure = 0;
          for (const t of targets)
            pressure = Math.max(pressure, Math.min(1, Math.max(0, 1 - ctx.dayMinutes[t.d] / 45)));
          s += extra * (1.2 + 3 * pressure) - 0.5 * extra;
          if (!p.noCook) s += 1.5 * extra * Math.min(1, p.minutes / 30);
        }
        if (!best || s > best.score + 1e-9) best = { p, targets, score: s };
      }
    }
    if (!best) {
      warnings.push({ code: 'slot_unfilled', params: { date: cell.date, slot: cell.slot } });
      continue;
    }
    const reasons: PlanReason[] = [];
    if (!best.p.noCook && best.p.minutes <= allowance * 0.6) reasons.push('quick');
    if (costK >= 12 && best.p.cost1 <= ctx.medianCost) reasons.push('cheap');
    if (swapped.has(cell.key)) reasons.push('swapped');
    commit(cell, best.p, best.targets, { reasons });
  }
  return { assigned, events, warnings, repeated };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function finish(ctx: Ctx, out: RunOut, shopping: ReturnType<typeof buildShoppingList>): PlanResult {
  const { input } = ctx;
  const resultDays: PlanDay[] = [];
  const minutesByDay: Record<string, number> = {};
  let kcalTotal = 0,
    protTotal = 0,
    offDays = 0;
  const target = ctx.dayKcal;
  for (const date of ctx.days) {
    const meals: PlannedSlot[] = [];
    let dayKcal = 0,
      dayMin = 0,
      filled = 0;
    for (const slot of ctx.slots) {
      const a = out.assigned.get(slotKey(date, slot));
      if (!a) continue;
      filled += 1;
      meals.push({
        slot,
        recipeId: a.p.id,
        recipeName: a.p.r.name,
        servings: ctx.people,
        minutes: a.minutes,
        costEstimate: a.cost,
        ...(a.leftover ? { leftover: true } : {}),
        ...(a.locked ? { locked: true } : {}),
        uses: a.uses,
        reasons: a.reasons,
        source: a.p.r.source,
        ...(a.batchOf ? { batchOf: a.batchOf } : {}),
        calories: Math.round(a.p.kcal),
        protein: Math.round(a.p.protein),
      });
      dayKcal += a.p.kcal;
      dayMin += a.minutes;
    }
    kcalTotal += dayKcal;
    protTotal += meals.reduce((s, m) => s + m.protein, 0);
    minutesByDay[date] = dayMin;
    resultDays.push({ date, meals });
    if (
      filled === ctx.slots.length &&
      !ctx.targetsAssumed &&
      dayKcal > 0 &&
      Math.abs(dayKcal - target) / target > 0.15
    )
      offDays += 1;
  }
  const n = ctx.days.length;
  const budget = input.weeklyBudget > 0 ? input.weeklyBudget : 0;
  const totals: PlanResult['totals'] = {
    cost: shopping.total,
    budget,
    avgCalories: Math.round(kcalTotal / n),
    avgProtein: Math.round(protTotal / n),
    minutesByDay,
  };
  if (budget > 0 && shopping.total > budget) totals.overBudgetBy = round2(shopping.total - budget);
  const warningDetails: PlanWarning[] = [...out.warnings];
  if (!ctx.pool.length) warningDetails.push({ code: 'no_recipes' });
  if (ctx.targetsAssumed)
    warningDetails.push({ code: 'targets_assumed', params: { calories: DEFAULT_KCAL } });
  if (offDays) warningDetails.push({ code: 'calories_off_target', params: { days: offDays } });
  if (out.repeated) warningDetails.push({ code: 'repeats_unavoidable' });
  if (ctx.pool.length) {
    const minDay = Math.min(...ctx.dayMinutes);
    const fit = ctx.pool.filter((p) => p.noCook || p.minutes <= minDay).length;
    if (fit < 6)
      warningDetails.push({ code: 'few_recipes_fit_time', params: { count: fit, minutes: minDay } });
  }
  warningDetails.push(...shopping.warnings);
  if (totals.overBudgetBy) {
    warningDetails.push({
      code: 'budget_infeasible',
      params: { cost: shopping.total, budget, overBudgetBy: totals.overBudgetBy },
    });
    if ((input.diet ?? []).length) warningDetails.push({ code: 'budget_too_low_for_diet' });
  }
  return {
    days: resultDays,
    shopping: shopping.lines,
    totals,
    warnings: warningDetails.map((w) => w.code),
    warningDetails,
    currency: input.currency,
    seed: ctx.seed,
    unpricedCount: shopping.unpricedCount,
  };
}

/** Core entry shared by planWeek / swapMeal. */
export function planWithOptions(input: PlanInput, opts: PlanOptions = {}, prepared?: Ctx): PlanResult {
  const ctx = prepared ?? prepare(input);
  const fixed = [...(opts.fixed ?? [])];
  const avoid = new Set(opts.avoidRecipeIds ?? []);
  const swapped = new Set(opts.swappedKeys ?? []);
  const shop = (out: RunOut) =>
    buildShoppingList(out.events, {
      pantry: input.pantry,
      prices: input.prices,
      priceLevel: input.priceLevel,
      currency: input.currency,
      customPrices: input.customPrices,
    });
  const budget = input.weeklyBudget > 0 ? input.weeklyBudget : 0;
  const weights = budget > 0 ? COST_WEIGHTS_BUDGET : [0.6];
  let cheapest: { out: RunOut; shopping: ReturnType<typeof buildShoppingList> } | undefined;
  for (const k of weights) {
    const out = run(ctx, k, fixed, avoid, swapped);
    const shopping = shop(out);
    if (!cheapest || shopping.total < cheapest.shopping.total) cheapest = { out, shopping };
    if (budget === 0 || shopping.total <= budget) break;
  }
  return finish(ctx, cheapest!.out, cheapest!.shopping);
}

/** Plan a week (or `days`) of meals. Pure and deterministic for a given `seed`. */
export function planWeek(input: PlanInput): PlanResult {
  const ctx = prepare(input);
  const fixed: FixedMeal[] = [];
  const entries: { date: string; slot: Slot; recipeId: string; order: number }[] = [];
  const missing: PlanWarning[] = [];
  for (const [k, recipeId] of Object.entries(input.locked ?? {})) {
    const cell = ctx.cellByKey.get(k);
    if (!cell) continue;
    if (!ctx.preps.has(recipeId)) {
      missing.push({ code: 'locked_recipe_missing', params: { key: k, recipeId } });
      continue;
    }
    entries.push({ date: cell.date, slot: cell.slot, recipeId, order: cell.order });
  }
  entries.sort((a, b) => a.order - b.order);
  const cooks = new Map<string, { key: string; kids: number; d: number }>(); // recipeId -> latest cook
  for (const e of entries) {
    const key = slotKey(e.date, e.slot);
    const p = ctx.preps.get(e.recipeId)!;
    const prior = cooks.get(e.recipeId);
    const d = ctx.cellByKey.get(key)!.d;
    if (prior && p.r.leftoverDays > 0 && d - prior.d <= p.r.leftoverDays && prior.kids < MAX_EXTRA_PORTIONS) {
      fixed.push({
        date: e.date,
        slot: e.slot,
        recipeId: e.recipeId,
        leftover: true,
        batchOf: prior.key,
        locked: true,
      });
      prior.kids += 1;
    } else {
      fixed.push({ date: e.date, slot: e.slot, recipeId: e.recipeId, locked: true });
      cooks.set(e.recipeId, { key, kids: 0, d });
    }
  }
  const result = planWithOptions(input, { fixed }, ctx);
  if (missing.length) {
    result.warningDetails.unshift(...missing);
    result.warnings.unshift(...missing.map((m) => m.code));
  }
  return result;
}
