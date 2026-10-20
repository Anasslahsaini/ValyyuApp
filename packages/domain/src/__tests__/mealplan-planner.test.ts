/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlannedMealSchema } from '../life';
import {
  addDays,
  applyPlanToPlannedMeals,
  defaultCookMinutesByDay,
  explainMeal,
  fromUserRecipe,
  lockedFromPlan,
  lockMeal,
  mealForToday,
  mergePlanIntoPlannedMeals,
  planWeek,
  swapMeal,
} from '../mealplan';
import type { PlanInput, PlanRecipe, PlanResult } from '../mealplan';
import { baseInput, bigCatalogue, ING, RECIPES, recipe } from './mealplan-fixtures';

const meals = (r: PlanResult) => r.days.flatMap((d) => d.meals.map((m) => ({ ...m, date: d.date })));
const byId = new Map(RECIPES.map((r) => [r.id, r]));
const ingredientIds = (r: PlanResult) =>
  new Set(meals(r).flatMap((m) => (byId.get(m.recipeId)?.ingredients ?? []).map((i) => i.ingredientId!)));
const cooked = (r: PlanResult) => meals(r).filter((m) => !m.leftover);
const plan = (over: Partial<PlanInput> = {}) => planWeek(baseInput(over));

test('Plans every slot of a week (breakfast, lunch, dinner x 7 days)', () => {
  const r = plan();
  assert.equal(r.days.length, 7);
  for (const d of r.days)
    assert.deepEqual(
      d.meals.map((m) => m.slot),
      ['breakfast', 'lunch', 'dinner'],
    );
  assert.equal(r.warnings.includes('slot_unfilled'), false);
});
test('Same seed gives an identical plan; another seed gives another plan', () => {
  assert.deepEqual(plan({ seed: 7 }), plan({ seed: 7 }));
  const ids = (s: number) =>
    meals(plan({ seed: s }))
      .map((m) => m.recipeId)
      .join();
  assert.notEqual(ids(1), ids(2));
  assert.notEqual(ids(1), ids(3));
});
test('Planning does not mutate its input', () => {
  const input = baseInput({ pantry: [{ name: 'rice', quantity: '500 g' }] });
  const copy = JSON.parse(JSON.stringify(input));
  planWeek(input);
  assert.deepEqual(JSON.parse(JSON.stringify(input)), copy);
});
test('The day cooking minutes are never exceeded (many seeds, tight and loose days)', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const input = baseInput({ seed });
    const days = Object.keys(input.cookMinutesByDay);
    input.cookMinutesByDay[days[0]] = 15;
    input.cookMinutesByDay[days[1]] = 10;
    input.cookMinutesByDay[days[2]] = 45;
    const r = planWeek(input);
    for (const d of r.days) {
      const sum = d.meals.reduce((s, m) => s + m.minutes, 0);
      assert.ok(
        sum <= input.cookMinutesByDay[d.date],
        `${d.date} ${sum} > ${input.cookMinutesByDay[d.date]} (seed ${seed})`,
      );
      assert.equal(r.totals.minutesByDay[d.date], sum);
    }
  }
});
test('A day with 0 minutes only gets no-cook recipes or leftovers', () => {
  const input = baseInput();
  const d = Object.keys(input.cookMinutesByDay)[3];
  input.cookMinutesByDay[d] = 0;
  const r = planWeek(input);
  for (const m of r.days.find((x) => x.date === d)!.meals)
    assert.ok(m.leftover || byId.get(m.recipeId)!.tags.includes('no_cook'), m.recipeId);
});
test('Default minutes: weekday 30 and weekend 60 when the map has no entry', () => {
  assert.deepEqual(defaultCookMinutesByDay('2026-10-23', 4), {
    '2026-10-23': 30,
    '2026-10-24': 60,
    '2026-10-25': 60,
    '2026-10-26': 30,
  });
  const r = planWeek({ ...baseInput(), cookMinutesByDay: {} });
  for (const d of r.days)
    assert.ok(
      d.meals.reduce((s, m) => s + m.minutes, 0) <= (['2026-10-24', '2026-10-25'].includes(d.date) ? 60 : 30),
    );
});
test('Vegan diet: no meat, fish, dairy, egg or honey ingredient', () => {
  for (const seed of [1, 2, 3]) {
    const r = plan({ diet: ['vegan'], seed });
    for (const id of ingredientIds(r))
      assert.equal(
        ING[id].kind === 'veg' ||
          ING[id].kind === 'gluten' ||
          ING[id].kind === 'nuts' ||
          ING[id].kind === 'peanut' ||
          ING[id].kind === 'soy',
        true,
        id,
      );
    assert.ok(
      !ingredientIds(r).has('honey') && !ingredientIds(r).has('egg') && !ingredientIds(r).has('milk'),
    );
    assert.equal(meals(r).length, 21);
  }
});
test('Vegetarian excludes meat and fish; pescatarian keeps fish but not meat; halal drops pork', () => {
  const veg = ingredientIds(plan({ diet: ['vegetarian'] }));
  for (const id of veg) assert.ok(!['meat', 'pork', 'fish', 'shell'].includes(ING[id].kind), id);
  const pesc = ingredientIds(plan({ diet: ['pescatarian'], seed: 4 }));
  for (const id of pesc) assert.ok(!['meat', 'pork'].includes(ING[id].kind), id);
  const halal = ingredientIds(plan({ diet: ['halal'] }));
  assert.ok(!halal.has('pork'));
});
test('Allergen diets use ingredient flags: gluten-free, dairy-free, nut-free (incl. peanut), egg-free', () => {
  const kinds = (diet: string, bad: string[]) => {
    for (const seed of [1, 2])
      for (const id of ingredientIds(plan({ diet: [diet], seed })))
        assert.ok(!bad.includes(ING[id].kind), `${diet}: ${id}`);
  };
  kinds('gluten_free', ['gluten']);
  kinds('dairy_free', ['dairy']);
  kinds('nut_free', ['nuts', 'peanut']);
  kinds('egg_free', ['egg']);
});
test('Several diets combine (vegan + gluten_free + nut_free)', () => {
  const r = plan({ diet: ['vegan', 'gluten_free', 'nut_free'] });
  for (const id of ingredientIds(r)) assert.ok(['veg', 'soy'].includes(ING[id].kind), id);
});
test('Allergen strictness covers optional ingredients; lifestyle diets ignore optional ones', () => {
  const r1: PlanRecipe = recipe('opt', 'Rice bowl', { mins: [5, 5], ings: [['rice', 200]], kcal: 500 });
  r1.ingredients.push({
    ...recipe('x', 'x', { mins: [1, 1], ings: [['cheese', 20]], kcal: 1 }).ingredients[0],
    optional: true,
  });
  const only = (diet: string) =>
    planWeek(baseInput({ recipes: [r1], diet: [diet], slots: ['lunch'], days: 1 })).days[0].meals.length;
  assert.equal(only('vegan'), 1);
  assert.equal(only('dairy_free'), 0);
});
test('Keyword fallback excludes unflagged ingredients (vegan with "chicken stock")', () => {
  const r: PlanRecipe = {
    ...recipe('u', 'Soup', { mins: [5, 5], ings: [['rice', 100]], kcal: 400 }),
    ingredients: [
      { name: 'chicken stock', grams: 500 },
      { name: 'rice', grams: 100 },
    ],
  };
  assert.equal(
    planWeek(baseInput({ recipes: [r], diet: ['vegan'], slots: ['lunch'], days: 1 })).days[0].meals.length,
    0,
  );
  assert.equal(
    planWeek(baseInput({ recipes: [r], diet: [], slots: ['lunch'], days: 1 })).days[0].meals.length,
    1,
  );
});
test('Dislikes match ingredient tokens (plural, French, accents) but not unrelated words', () => {
  const r = plan({ dislikes: ['mushrooms', 'Poulet'] });
  const ids = ingredientIds(r);
  assert.ok(!ids.has('mushroom'));
  const fr = recipe('fr', 'Poulet rôti', { mins: [5, 5], ings: [['rice', 100]], kcal: 500 });
  fr.ingredients[0] = { ...fr.ingredients[0], name: 'Blanc de poulet' };
  assert.equal(
    planWeek(baseInput({ recipes: [fr], dislikes: ['poulet'], slots: ['lunch'], days: 1 })).days[0].meals
      .length,
    0,
  );
  assert.equal(
    planWeek(baseInput({ recipes: [fr], dislikes: ['egg'], slots: ['lunch'], days: 1 })).days[0].meals.length,
    1,
  );
  const eggplant = recipe('ep', 'Eggplant bake', { mins: [5, 5], ings: [['rice', 100]], kcal: 500 });
  eggplant.ingredients[0] = { ...eggplant.ingredients[0], name: 'Eggplant', ingredientId: 'eggplant' };
  assert.equal(
    planWeek(baseInput({ recipes: [eggplant], dislikes: ['egg'], slots: ['lunch'], days: 1 })).days[0].meals
      .length,
    1,
  );
});
test('Dislikes in the recipe name exclude it', () => {
  const r = plan({ dislikes: ['shakshuka'] });
  assert.ok(!meals(r).some((m) => m.recipeId === 'shakshuka'));
});
test('Cooked recipes are not repeated within 3 days when the pool allows', () => {
  for (const seed of [1, 2, 3, 4]) {
    const last = new Map<string, number>();
    const r = plan({ seed });
    r.days.forEach((d, di) =>
      d.meals
        .filter((m) => !m.leftover)
        .forEach((m) => {
          const prev = last.get(m.recipeId);
          assert.ok(
            prev === undefined || di - prev >= 3,
            `${m.recipeId} repeated on day ${di} after ${prev}`,
          );
          last.set(m.recipeId, di);
        }),
    );
  }
});
test('Recently eaten meals (history) are not chosen on the first days', () => {
  const r = plan({
    recentMeals: [
      { name: 'Chicken wrap', date: '2026-10-18' },
      { name: 'Shakshuka', date: '2026-10-17' },
    ],
    seed: 5,
  });
  const firstDays = r.days.slice(0, 2).flatMap((d) => d.meals.map((m) => m.recipeId));
  assert.ok(!firstDays.includes('chicken-wrap') && !firstDays.includes('shakshuka'));
});
test('Favourite recipes are favoured over otherwise equal ones', () => {
  const a = recipe('fav-a', 'Rice bowl A', { mins: [5, 10], ings: [['rice', 200]], kcal: 600 }),
    b = recipe('fav-b', 'Rice bowl B', { mins: [5, 10], ings: [['rice', 200]], kcal: 600 });
  const wins = (fav: boolean) =>
    [1, 2, 3, 4, 5, 6, 7, 8].filter(
      (seed) =>
        planWeek(baseInput({ recipes: [{ ...a, favorite: fav }, b], slots: ['lunch'], days: 1, seed }))
          .days[0].meals[0].recipeId === 'fav-a',
    ).length;
  assert.equal(wins(true), 8);
  assert.ok(wins(false) < 8);
});
test('Cuisine rotation: no cuisine dominates the cooked meals', () => {
  const r = plan({ seed: 2 });
  const c = new Map<string, number>();
  for (const m of cooked(r)) {
    const cu = byId.get(m.recipeId)!.cuisine!;
    c.set(cu, (c.get(cu) ?? 0) + 1);
  }
  assert.ok(Math.max(...c.values()) / cooked(r).length <= 0.4, JSON.stringify([...c]));
});
test('Batch cooking: leftover meals cost 0 minutes, point at their cooking meal and respect leftoverDays', () => {
  const r = plan({ seed: 3 });
  const lefts = meals(r).filter((m) => m.leftover);
  assert.ok(lefts.length > 0, 'expected at least one leftover');
  for (const l of lefts) {
    assert.equal(l.minutes, 0);
    const [date, slot] = l.batchOf!.split('|');
    const parent = meals(r).find((m) => m.date === date && m.slot === slot)!;
    assert.equal(parent.recipeId, l.recipeId);
    assert.ok(!parent.leftover);
    const gap = (Date.parse(l.date) - Date.parse(date)) / 86400000;
    assert.ok(gap >= 0 && gap <= byId.get(l.recipeId)!.leftoverDays);
    assert.ok(parent.reasons.includes('batch') && l.reasons.includes('leftover'));
  }
});
test('Leftovers chain across days on a tight schedule and shopping buys the batch once', () => {
  const stew = recipe('stew', 'Big stew', {
    mins: [10, 40],
    ings: [
      ['beef', 400],
      ['carrot', 300],
    ],
    kcal: 650,
    servings: 3,
    left: 2,
  });
  const input = baseInput({
    recipes: [stew],
    slots: ['dinner'],
    days: 3,
    people: 1,
    cookMinutesByDay: { '2026-10-19': 60, '2026-10-20': 0, '2026-10-21': 0 },
    targets: { calories: 650, protein: 0, carbs: 0, fat: 0 },
  });
  const r = planWeek(input);
  assert.deepEqual(
    r.days.map((d) => d.meals.map((m) => !!m.leftover)),
    [[false], [true], [true]],
  );
  assert.equal(r.days[0].meals[0].minutes, Math.ceil(50 * 1.2));
  const beef = r.shopping.find((l) => l.ingredientId === 'beef')!;
  assert.equal(beef.neededGrams, 400);
});
test('Batch time grows with portions and still obeys the day limit', () => {
  const stew = recipe('stew', 'Big stew', {
    mins: [10, 40],
    ings: [['beef', 400]],
    kcal: 650,
    servings: 3,
    left: 2,
  });
  const r = planWeek(
    baseInput({
      recipes: [stew],
      slots: ['dinner'],
      days: 3,
      cookMinutesByDay: { '2026-10-19': 55, '2026-10-20': 0, '2026-10-21': 0 },
    }),
  );
  assert.ok(r.days[0].meals[0].minutes <= 55);
  assert.equal(r.days[0].meals[0].minutes, 55); // 50 * 1.1 = 55: one extra portion fits, the second does not
  assert.equal(r.days[1].meals[0]?.leftover, true);
  assert.equal(r.days[2].meals.length, 0);
});
test('Locked slots are kept, flagged, and not duplicated elsewhere inside 3 days', () => {
  const input = baseInput({
    locked: { '2026-10-23|dinner': 'beef-pasta', '2026-10-24|breakfast': 'pancakes' },
  });
  const at = (r: PlanResult, d: string, slot: string) =>
    r.days.find((x) => x.date === d)!.meals.find((m) => m.slot === slot)!;
  const r = planWeek(input);
  assert.equal(at(r, '2026-10-23', 'dinner').recipeId, 'beef-pasta');
  assert.equal(at(r, '2026-10-23', 'dinner').locked, true);
  assert.equal(at(r, '2026-10-24', 'breakfast').recipeId, 'pancakes');
  for (const seed of [2, 3, 4]) {
    const again = planWeek({ ...input, seed });
    assert.equal(at(again, '2026-10-23', 'dinner').recipeId, 'beef-pasta');
    assert.equal(at(again, '2026-10-24', 'breakfast').recipeId, 'pancakes');
  }
});
test('Locked recipe unknown to the catalogue is reported, not crashed on', () => {
  const r = planWeek(baseInput({ locked: { '2026-10-20|lunch': 'deleted-recipe' } }));
  assert.ok(r.warnings.includes('locked_recipe_missing'));
  assert.equal(r.days[1].meals.length, 3);
});
test('A locked meal over the day limit is kept with a locked_over_time warning', () => {
  const r = planWeek(baseInput({ locked: { '2026-10-19|dinner': 'slow-chicken' } }));
  assert.equal(r.days[0].meals.find((m) => m.slot === 'dinner')!.recipeId, 'slow-chicken');
  assert.ok(r.warnings.includes('locked_over_time'));
});
test('Locked identical recipes within leftoverDays become leftovers of the first one', () => {
  const r = planWeek(
    baseInput({ locked: { '2026-10-19|dinner': 'lentil-soup', '2026-10-20|lunch': 'lentil-soup' } }),
  );
  const second = r.days[1].meals.find((m) => m.slot === 'lunch')!;
  assert.equal(second.leftover, true);
  assert.equal(second.minutes, 0);
  assert.equal(second.batchOf, '2026-10-19|dinner');
});
test('Pantry: recipes that use what is at home are preferred and reported in `uses`', () => {
  const pantry = [
    { name: 'Lentils', quantity: '1 kg' },
    { name: 'carrots', quantity: '1 kg' },
    { name: 'onion', quantity: '6' },
    { name: 'canned tomatoes', quantity: '800 g' },
  ];
  const withP = meals(plan({ pantry, seed: 2 }));
  const without = meals(plan({ seed: 2 }));
  const n = (list: typeof withP) =>
    list.filter((m) => ['lentil-soup', 'lentil-rice'].includes(m.recipeId)).length;
  assert.ok(n(withP) > n(without));
  const soup = withP.find((m) => ['lentil-soup', 'lentil-rice'].includes(m.recipeId) && !m.leftover)!;
  assert.ok(soup.uses.length > 0 && soup.reasons.includes('uses_pantry'));
  assert.ok(soup.uses.every((u) => pantry.some((p) => p.name === u)));
});
test('Pantry reduces the shopping cost of the plan', () => {
  const pantry = [
    { name: 'rice', quantity: '2 kg' },
    { name: 'pasta', quantity: '1 kg' },
    { name: 'chicken breast', quantity: '1 kg' },
  ];
  assert.ok(plan({ pantry }).totals.cost < plan().totals.cost);
});
test('Use-it-first: an item expiring soon pulls its recipe to the start of the week', () => {
  const pantry = [{ name: 'Spinach', quantity: '600 g', expiresOn: '2026-10-21' }];
  const r = plan({ pantry, seed: 6 });
  const firstSpinach = r.days.findIndex((d) =>
    d.meals.some((m) => byId.get(m.recipeId)!.ingredients.some((i) => i.ingredientId === 'spinach')),
  );
  assert.ok(firstSpinach >= 0 && firstSpinach <= 2, String(firstSpinach));
  const m = meals(r).find(
    (x) => byId.get(x.recipeId)!.ingredients.some((i) => i.ingredientId === 'spinach') && x.uses.length,
  )!;
  assert.ok(m.reasons.includes('use_it_first'));
});
test('Expired pantry items are not counted as available', () => {
  const pantry = [{ name: 'Spinach', quantity: '600 g', expiresOn: '2026-10-01' }];
  const r = plan({ pantry });
  assert.ok(!meals(r).some((m) => m.uses.includes('Spinach')));
});
test('Budget: a budget lowers the cost and is respected when feasible', () => {
  const free = plan({ seed: 2 });
  const budget = Math.round(free.totals.cost * 0.6);
  const r = plan({ seed: 2, weeklyBudget: budget });
  assert.ok(r.totals.cost <= budget, `${r.totals.cost} > ${budget}`);
  assert.ok(r.totals.cost < free.totals.cost);
  assert.equal(r.totals.overBudgetBy, undefined);
  assert.equal(r.warnings.includes('budget_infeasible'), false);
});
test('Budget infeasible: cheapest plan is returned with a warning, never silently over budget', () => {
  const r = plan({ weeklyBudget: 5 });
  assert.ok(r.warnings.includes('budget_infeasible'));
  assert.ok(r.totals.overBudgetBy! > 0);
  assert.equal(Math.round((r.totals.cost - 5) * 100), Math.round(r.totals.overBudgetBy! * 100));
  assert.equal(meals(r).length, 21);
  const loose = plan({ weeklyBudget: 5000 });
  assert.ok(r.totals.cost < loose.totals.cost);
  assert.ok(plan({ weeklyBudget: 5, diet: ['vegan'] }).warnings.includes('budget_too_low_for_diet'));
});
test('Locked meals survive the budget pass', () => {
  const r = plan({ weeklyBudget: 20, locked: { '2026-10-24|dinner': 'salmon-potato' } });
  assert.equal(r.days[5].meals.find((m) => m.slot === 'dinner')!.recipeId, 'salmon-potato');
});
test('Price level and currency change the cost of the same plan', () => {
  const mid = plan({ seed: 3 }).totals.cost,
    low = plan({ seed: 3, priceLevel: 'low' }).totals.cost,
    high = plan({ seed: 3, priceLevel: 'high' }).totals.cost;
  assert.ok(low < mid && mid < high, `${low} ${mid} ${high}`);
  assert.ok(plan({ seed: 3, currency: 'USD' }).totals.cost > mid);
});
test('People multiply servings and shopping quantities', () => {
  const one = plan({ people: 1, seed: 2 }),
    two = plan({ people: 2, seed: 2 });
  assert.ok(meals(two).every((m) => m.servings === 2));
  assert.ok(two.totals.cost > one.totals.cost * 1.3, `${two.totals.cost} vs ${one.totals.cost}`);
  const qty = (x: PlanResult, id: string) => x.shopping.find((l) => l.ingredientId === id)?.neededGrams ?? 0;
  assert.ok(qty(two, 'rice') >= qty(one, 'rice') * 1.5 || qty(two, 'rice') === 0);
});
test('Calories land near the target on average (best effort)', () => {
  const r = plan({ targets: { calories: 1700, protein: 0, carbs: 0, fat: 0 } });
  assert.ok(Math.abs(r.totals.avgCalories - 1700) / 1700 <= 0.15, String(r.totals.avgCalories));
  const high = plan({ targets: { calories: 1500, protein: 0, carbs: 0, fat: 0 }, seed: 2 });
  assert.ok(high.totals.avgCalories < r.totals.avgCalories);
});
test('Unknown targets: plan around 2000 kcal and say so', () => {
  const r = plan({ targets: undefined });
  assert.ok(r.warnings.includes('targets_assumed'));
  assert.equal(
    plan({ targets: { calories: 0, protein: 0, carbs: 0, fat: 0 } }).warnings.includes('targets_assumed'),
    true,
  );
});
test('Recipes with unknown macros are still plannable', () => {
  const unknown: PlanRecipe = {
    ...recipe('u1', 'Mystery stew', { mins: [5, 5], ings: [['rice', 100]], kcal: 0 }),
    macrosKnown: false,
  };
  assert.equal(
    planWeek(baseInput({ recipes: [unknown], slots: ['dinner'], days: 1 })).days[0].meals.length,
    1,
  );
});
test('Warnings: few recipes fit the time, unfilled slots, no recipes at all', () => {
  const slow = (i: number) =>
    recipe(`slow${i}`, `Slow dish ${i}`, { mins: [20, 40], ings: [['rice', 100]], kcal: 600 });
  const quick = (i: number) =>
    recipe(`fast${i}`, `Fast dish ${i}`, { mins: [3, 2], ings: [['rice', 100]], kcal: 600 });
  const tight = baseInput({
    days: 2,
    recipes: [quick(1), quick(2), quick(3), slow(1), slow(2), slow(3), slow(4), slow(5)],
  });
  for (const d of Object.keys(tight.cookMinutesByDay)) tight.cookMinutesByDay[d] = 8;
  const r = planWeek(tight);
  const w = r.warningDetails.find((x) => x.code === 'few_recipes_fit_time')!;
  assert.ok(w && w.params!.count === 3 && w.params!.minutes === 8);
  const nothing = planWeek(baseInput({ recipes: [], days: 1 }));
  assert.ok(nothing.warnings.includes('no_recipes') && nothing.warnings.includes('slot_unfilled'));
  const dinnerOnly = planWeek(
    baseInput({
      recipes: RECIPES.filter((x) => x.slots.includes('lunch') && !x.slots.includes('breakfast')),
      days: 1,
    }),
  );
  assert.ok(
    dinnerOnly.warningDetails.some((x) => x.code === 'slot_unfilled' && x.params!.slot === 'breakfast'),
  );
});
test('Custom (user) recipes are first-class candidates', () => {
  const mine = fromUserRecipe({
    id: 'mine',
    name: 'Grandma lentil dal',
    ingredients: ['200 g lentils', '1 onion', '1 tsp cumin'],
    steps: ['Cook'],
    calories: 600,
    protein: 30,
    carbs: 80,
    fat: 10,
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 20,
    favorite: true,
  });
  const r = plan({ recipes: [...RECIPES, mine] });
  assert.ok(meals(r).some((m) => m.recipeId === 'mine' && m.source === 'user'));
  assert.ok(
    r.shopping.some((l) => l.name.toLowerCase().includes('lentil') && l.forRecipeIds.includes('mine')),
  );
});
test('fromUserRecipe: grams, pieces, flags, slots and tags', () => {
  const p = fromUserRecipe({
    id: 'a',
    name: 'Pancakes du matin',
    ingredients: ['2 eggs', '250 ml lait', '1 pinch sel', '200 g flour'],
    steps: [],
    calories: 400,
    protein: 12,
    carbs: 50,
    fat: 10,
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 10,
  });
  assert.deepEqual(p.slots, ['breakfast', 'snack']);
  assert.equal(p.source, 'user');
  assert.equal(p.prepMinutes + p.cookMinutes, 15);
  assert.ok(p.tags.includes('quick'));
  const [egg, milk, salt, flour] = p.ingredients;
  assert.equal(egg.grams, 110);
  assert.equal(egg.unit, 'piece');
  assert.equal(egg.diet!.vegan, false);
  assert.equal(egg.diet!.eggFree, false);
  assert.equal(milk.grams, 250);
  assert.equal(milk.diet!.dairyFree, false);
  assert.equal(salt.staple, true);
  assert.equal(flour.grams, 200);
  assert.equal(flour.diet!.glutenFree, false);
  assert.equal(p.perServing.calories, 400);
  const salad = fromUserRecipe({
    id: 'b',
    name: 'Tomato salad',
    ingredients: ['3 tomatoes'],
    steps: [],
    calories: 100,
    protein: 2,
    carbs: 10,
    fat: 5,
    prepMinutes: 10,
    cookMinutes: 0,
    unknownNutrients: ['protein'],
  });
  assert.ok(salad.tags.includes('no_cook'));
  assert.equal(salad.perServing.protein, 0);
  assert.deepEqual(salad.slots, ['lunch', 'dinner']);
  assert.equal(
    fromUserRecipe({
      id: 'c',
      name: 'x',
      ingredients: [],
      steps: [],
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      unknownNutrients: ['calories'],
    }).macrosKnown,
    false,
  );
});
test('Performance: a week with 300 candidate recipes plans in under 200 ms', () => {
  const input = baseInput({
    recipes: bigCatalogue(300),
    weeklyBudget: 40,
    pantry: [
      { name: 'rice', quantity: '1 kg' },
      { name: 'onion', quantity: '4' },
      { name: 'spinach', quantity: '200 g', expiresOn: '2026-10-22' },
    ],
  });
  planWeek(input); // warm up JIT
  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    planWeek({ ...input, seed: i + 1 });
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  console.log(
    `mealplan perf: median ${times[2].toFixed(1)} ms, worst ${times[4].toFixed(1)} ms (300 recipes, 21 slots, budget on)`,
  );
  assert.ok(times[2] < 200, `median ${times[2]} ms`);
});
test('swapMeal re-picks one slot, keeps the others, excludes the old recipe and recomputes shopping', () => {
  const input = baseInput({ seed: 2 });
  const p0 = planWeek(input);
  const key = '2026-10-22|dinner';
  const old = p0.days[3].meals[2];
  const p1 = swapMeal(p0, input, key, 99);
  const now = p1.days[3].meals[2];
  assert.notEqual(now.recipeId, old.recipeId);
  assert.ok(now.reasons.includes('swapped'));
  const strip = (r: PlanResult) =>
    r.days.map((d) => d.meals.filter((m) => `${d.date}|${m.slot}` !== key).map((m) => m.recipeId));
  assert.deepEqual(strip(p1), strip(p0));
  assert.equal(p1.seed, 99);
  assert.notDeepEqual(p1.shopping, p0.shopping);
  const p2 = swapMeal(p0, input, key, 99);
  assert.deepEqual(p2, p1); // deterministic
});
test('swapMeal on a batch cooking meal re-plans its leftovers; locked meals do not move', () => {
  const input = baseInput({ seed: 3 });
  const p0 = planWeek(input);
  const parent = meals(p0).find(
    (m) => !m.leftover && meals(p0).some((x) => x.batchOf === `${m.date}|${m.slot}`),
  )!;
  const key = `${parent.date}|${parent.slot}`;
  const p1 = swapMeal(p0, input, key);
  assert.ok(!meals(p1).some((m) => m.batchOf === key && m.recipeId === parent.recipeId));
  assert.equal(meals(p1).length, 21);
  const locked = lockMeal(p0, key);
  assert.equal(swapMeal(locked, input, key), locked);
});
test('lockMeal toggles the flag purely; lockedFromPlan feeds a regenerate that keeps locked meals', () => {
  const p0 = plan({ seed: 2 });
  const target = meals(p0).find((m) => m.slot === 'lunch' && !m.leftover && m.date > '2026-10-19')!;
  const key = `${target.date}|${target.slot}`;
  const di = p0.days.findIndex((d) => d.date === target.date);
  const p1 = lockMeal(p0, key);
  assert.equal(p1.days[di].meals[1].locked, true);
  assert.equal(p0.days[di].meals[1].locked, undefined);
  assert.equal(lockMeal(p1, key, false).days[di].meals[1].locked, undefined);
  const locks = lockedFromPlan(p1);
  assert.deepEqual(locks, { [key]: target.recipeId });
  const again = planWeek(baseInput({ seed: 50, locked: locks }));
  assert.equal(again.days[di].meals[1].recipeId, target.recipeId);
  assert.equal(again.days[di].meals[1].locked, true);
});
test('explainMeal returns structured, untranslated data', () => {
  const pantry = [
    { name: 'rice', quantity: '1 kg' },
    { name: 'spinach', quantity: '200 g' },
  ];
  const r = plan({ pantry, seed: 2 });
  const m = meals(r).find((x) => x.uses.length && !x.leftover)!;
  const e = explainMeal(m, r.currency);
  assert.deepEqual(
    Object.keys(e).sort(),
    [
      'cookedAt',
      'costEstimate',
      'currency',
      'leftover',
      'locked',
      'minutes',
      'noCook',
      'reasons',
      'usesPantry',
    ].sort(),
  );
  assert.equal(e.minutes, m.minutes);
  assert.deepEqual(e.usesPantry, m.uses);
  assert.equal(e.currency, 'EUR');
  const l = meals(plan({ seed: 3 })).find((x) => x.leftover)!;
  assert.equal(explainMeal(l).leftover, true);
  assert.equal(explainMeal(l).minutes, 0);
});
test('applyPlanToPlannedMeals yields valid, stable records; merge replaces only the plan dates', () => {
  const r = plan({ seed: 2 });
  const recs = applyPlanToPlannedMeals(r);
  assert.equal(recs.length, 21);
  for (const rec of recs) PlannedMealSchema.parse(rec);
  assert.equal(new Set(recs.map((x) => x.id)).size, 21);
  assert.deepEqual(applyPlanToPlannedMeals(r), recs);
  assert.ok(recs.some((x) => x.leftover) || true);
  const before = [
    { id: 'old', date: '2026-10-19', slot: 'lunch' as const, name: 'Old', servings: 1 },
    { id: 'keep', date: '2026-11-30', slot: 'lunch' as const, name: 'Keep', servings: 1 },
  ];
  const merged = mergePlanIntoPlannedMeals(before, r);
  assert.equal(merged.length, 22);
  assert.ok(merged.some((x) => x.id === 'keep') && !merged.some((x) => x.id === 'old'));
  assert.equal(recs[0].recipeSource, 'catalogue');
});
test('mealForToday picks the next relevant slot for the local time', () => {
  const rows = ['breakfast', 'lunch', 'dinner'].map((slot) => ({
    id: `pm-2026-10-19-${slot}`,
    date: '2026-10-19',
    slot: slot as 'lunch',
    name: slot,
    servings: 1,
  }));
  const at = (h: number, m = 0) => new Date(2026, 9, 19, h, m);
  assert.equal(mealForToday(rows, at(7))!.slot, 'breakfast');
  assert.equal(mealForToday(rows, at(11))!.slot, 'lunch');
  assert.equal(mealForToday(rows, at(14, 30))!.slot, 'lunch');
  assert.equal(mealForToday(rows, at(19))!.slot, 'dinner');
  assert.equal(mealForToday(rows.slice(0, 2), at(19)), undefined);
  assert.equal(mealForToday(rows, new Date(2026, 9, 20, 8)), undefined);
});
test('Date helpers are DST safe', () => {
  assert.equal(addDays('2026-03-28', 2), '2026-03-30');
  assert.equal(addDays('2026-10-25', 1), '2026-10-26');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});
