/**
 * The meal actions of Today and Repas as data writes (one atomic save each): plan the week with its
 * grocery list, swap one planned meal, log a planned meal. Same rules as the first app's WeekTab.
 */
import { createId, type Collection, type CollectionRecord, type LifeState, type PlannedMeal } from './life';
import {
  buildPlanInput,
  entryForPlannedMeal,
  planGroceries,
  planWeek,
  planWrites,
  restorePlan,
  shoppingToGroceries,
  slotKey,
  swapMeal,
  type PlanResult,
} from './mealplan';
import type { CatalogueData } from './recipe-catalogue';

export type Writes = {
  upserts: { collection: Collection; record: CollectionRecord<Collection> }[];
  deletes: { collection: Collection; id: string }[];
};

type Opts = { today: string; lang: string; seed: number };

/** Plan + its grocery list in one save: the list the previous plan wrote (unticked) is replaced. */
function persistPlan(state: LifeState, plan: PlanResult): Writes {
  const w = planWrites(state.plannedMeals, plan);
  const old = planGroceries(state.groceries);
  const oldIds = new Set(old.map((g) => g.id));
  const list = shoppingToGroceries(
    plan.shopping,
    state.groceries.filter((g) => !oldIds.has(g.id)),
  );
  return {
    upserts: [
      ...w.upserts.map((record) => ({ collection: 'plannedMeals' as const, record })),
      ...[...list.add, ...list.update].map((record) => ({ collection: 'groceries' as const, record })),
    ],
    deletes: [
      ...w.deletes.map((id) => ({ collection: 'plannedMeals' as const, id })),
      ...old.map((g) => ({ collection: 'groceries' as const, id: g.id })),
    ],
  };
}

export function makeWeekWrites(
  state: LifeState,
  catalogue: CatalogueData,
  { today, lang, seed }: Opts,
): { writes: Writes; plan: PlanResult } {
  const input = buildPlanInput(state, catalogue, { startDate: today, lang, overrides: { seed } });
  const plan = planWeek(input);
  return { writes: persistPlan(state, plan), plan };
}

export function swapPlannedWrites(
  state: LifeState,
  catalogue: CatalogueData,
  planned: PlannedMeal,
  { today, lang, seed }: Opts,
): Writes {
  const start =
    state.plannedMeals
      .map((m) => m.date.slice(0, 10))
      .filter((d) => d >= today)
      .sort()[0] ?? today;
  const input = buildPlanInput(state, catalogue, { startDate: start, lang });
  const current = restorePlan(input, state.plannedMeals);
  const next = swapMeal(current, input, slotKey(planned.date.slice(0, 10), planned.slot), seed);
  return persistPlan(state, next);
}

export function logPlannedWrites(
  state: LifeState,
  catalogue: CatalogueData,
  planned: PlannedMeal,
  id: string = createId(),
): Writes {
  const entry = entryForPlannedMeal(planned, { recipes: state.recipes, catalogue }, id);
  return { upserts: [{ collection: 'meals', record: entry }], deletes: [] };
}
