/// <reference types="node" />
import assert from 'node:assert/strict';
import { statSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';
import foods from '../../data/usda-fdc/foods.json';
import {
  BUILT_FILE,
  DATA_DIR,
  LIMITS,
  buildCatalogue,
  readSources,
  serializeBuilt,
} from '../../scripts/build-recipes.mjs';
import {
  costForRecipe,
  ingredientIndex,
  ingredientName,
  loadCatalogue,
  recipeName,
  recipeSteps,
  type CatalogueData,
  type CatalogueRecipe,
} from '../recipe-catalogue';

const usda = new Map(
  (foods as { id: string; kcal: number; p: number; c: number; f: number }[]).map((f) => [f.id, f]),
);
const n = (recipes: CatalogueRecipe[], pred: (r: CatalogueRecipe) => boolean) => recipes.filter(pred).length;
const has = (r: CatalogueRecipe, tag: string) => (r.tags as string[]).includes(tag);

let cataloguePromise: Promise<CatalogueData> | undefined;
const catalogue = () => (cataloguePromise ??= loadCatalogue());

test('built file is fresh: sources validate and recipes.built.json matches a rebuild', () => {
  const sources = readSources();
  const { errors, built } = buildCatalogue(sources);
  assert.deepEqual(errors, []);
  assert.ok(built);
  const onDisk = readFileSync(BUILT_FILE, 'utf8');
  assert.equal(
    onDisk,
    serializeBuilt(built),
    'recipes.built.json is stale: run `pnpm --filter @workspace/domain run build:recipes`',
  );
});

test('the build script reports clear errors for broken data', () => {
  const sources = readSources();
  const recipes = JSON.parse(sources.recipesText);
  recipes[0].ingredients.push({ id: 'does-not-exist', qty: 1, unit: 'g' });
  recipes[1].id = recipes[0].id;
  recipes[2].steps.fr = ['seul'];
  recipes[3].tags.push('not-a-tag');
  recipes[4].ingredients[0].qty = 50000;
  const { errors, built } = buildCatalogue({ ...sources, recipesText: JSON.stringify(recipes) });
  assert.equal(built, null);
  const text = errors.join('\n');
  assert.match(text, /unknown ingredient "does-not-exist"/);
  assert.match(text, /duplicate id/);
  assert.match(text, /steps\.fr needs 3 to 7/);
  assert.match(text, /tags must be unique and in the allowed list/);
  assert.match(text, /outside|above/);
});

test('total recipe data stays small (< 700 KB)', () => {
  const total = ['ingredients.json', 'prices.json', 'recipes.json', 'recipes.built.json'].reduce(
    (sum, f) => sum + statSync(join(DATA_DIR, f)).size,
    0,
  );
  assert.ok(total < 700_000, `recipe data is ${total} bytes`);
});

test('ingredient table: size, units, provenance and diet consistency', async () => {
  const { ingredients } = await catalogue();
  assert.ok(ingredients.length >= 220 && ingredients.length <= 300, `${ingredients.length} ingredients`);
  assert.equal(new Set(ingredients.map((i) => i.id)).size, ingredients.length);
  for (const i of ingredients) {
    assert.ok(i.name.en && i.name.fr, i.id);
    assert.ok(i.source === 'usda-sr-legacy' || i.source === 'estimate');
    const u = usda.get(i.id);
    if (u) {
      // ids shared with the USDA subset must carry exactly the same macros
      assert.deepEqual(i.per100g, { calories: u.kcal, protein: u.p, carbs: u.c, fat: u.f }, i.id);
      assert.equal(i.source, 'usda-sr-legacy', i.id);
    }
    if (i.diet.vegan) assert.ok(i.diet.vegetarian, i.id);
    if (i.category === 'meat') assert.equal(i.diet.pescatarian, false, i.id);
    if (i.allergens.includes('gluten')) assert.equal(i.diet.glutenFree, false, i.id);
  }
  const byId = ingredientIndex(await catalogue());
  for (const id of ['ham-sliced', 'bacon-cooked', 'chorizo'])
    assert.equal(byId.get(id)?.diet.halalSafe, false, `${id} is not halal`);
  assert.equal(byId.get('chicken-breast-raw')?.diet.halalSafe, true);
  assert.equal(byId.get('honey')?.diet.vegan, false);
  assert.equal(byId.get('honey')?.diet.vegetarian, true);
  assert.equal(byId.get('pasta-dry')?.diet.glutenFree, false);
  assert.equal(byId.get('rice-white-raw')?.diet.glutenFree, true);
});

test('coverage: size, slots, time buckets, diets, batch and no-cook', async () => {
  const { recipes } = await catalogue();
  assert.ok(recipes.length >= 180, `${recipes.length} recipes`);
  assert.ok(n(recipes, (r) => r.slots.includes('breakfast')) >= 30);
  assert.ok(n(recipes, (r) => r.slots.includes('lunch')) >= 55);
  assert.ok(n(recipes, (r) => r.slots.includes('dinner')) >= 65);
  assert.ok(n(recipes, (r) => r.slots.includes('snack')) >= 25);

  const total = (r: CatalogueRecipe) => r.prepMinutes + r.cookMinutes;
  const quick = n(recipes, (r) => total(r) <= 15);
  const medium = n(recipes, (r) => total(r) > 15 && total(r) <= 30);
  const long = n(recipes, (r) => total(r) > 30);
  assert.ok(quick >= 45, `${quick} recipes <= 15 min`);
  assert.ok(medium >= 50, `${medium} recipes 16-30 min`);
  assert.ok(long >= 20, `${long} recipes > 30 min`);

  assert.ok(n(recipes, (r) => has(r, 'vegetarian')) / recipes.length >= 0.35);
  assert.ok(n(recipes, (r) => has(r, 'vegan')) / recipes.length >= 0.15);
  const byId = ingredientIndex(await catalogue());
  const withFish = n(
    recipes,
    (r) =>
      !has(r, 'vegetarian') &&
      has(r, 'pescatarian') &&
      r.ingredients.some((l) => byId.get(l.id)?.allergens.some((a) => a === 'fish' || a === 'shellfish')),
  );
  assert.ok(withFish >= 25, `${withFish} fish/seafood recipes`);
  assert.ok(n(recipes, (r) => has(r, 'pescatarian')) >= 25);
  assert.ok(n(recipes, (r) => has(r, 'gluten_free')) >= 40);
  assert.ok(n(recipes, (r) => has(r, 'dairy_free')) >= 40);
  assert.ok(n(recipes, (r) => has(r, 'halal')) >= 100);
  assert.ok(n(recipes, (r) => has(r, 'batch_friendly') && r.leftoverDays >= 1) >= 30);
  assert.ok(n(recipes, (r) => has(r, 'no_cook')) >= 15);
  assert.ok(n(recipes, (r) => has(r, 'freezer_friendly')) >= 10);

  for (const cuisine of [
    'maghreb',
    'french',
    'mediterranean',
    'middle_eastern',
    'italian',
    'asian',
    'mexican',
    'indian',
  ]) {
    assert.ok(n(recipes, (r) => r.cuisine === cuisine) >= 8, `cuisine ${cuisine}`);
  }
  assert.ok(n(recipes, (r) => r.cuisine === 'maghreb') >= 20);
});

test('referential integrity, units, steps and French content', async () => {
  const data = await catalogue();
  const byId = ingredientIndex(data);
  const names = new Set<string>();
  const ids = new Set<string>();
  const used = new Set<string>();
  for (const r of data.recipes) {
    assert.ok(!ids.has(r.id), `duplicate recipe id ${r.id}`);
    ids.add(r.id);
    const key = r.name.en.trim().toLowerCase();
    assert.ok(!names.has(key), `duplicate recipe name ${r.name.en}`);
    names.add(key);
    assert.ok(r.name.fr.length > 1 && r.name.fr !== '', r.id);
    assert.ok(r.steps.en.length >= 3 && r.steps.en.length <= 7, `${r.id} steps`);
    assert.equal(r.steps.fr.length, r.steps.en.length, `${r.id} fr steps`);
    assert.ok(
      r.steps.fr.every((s) => s.trim().length > 5),
      r.id,
    );
    assert.ok(r.ingredients.length >= 2, r.id);
    for (const line of r.ingredients) {
      const ing = byId.get(line.id);
      assert.ok(ing, `${r.id}: unknown ingredient ${line.id}`);
      used.add(line.id);
      assert.ok(line.qty > 0);
      if (line.unit !== 'g')
        assert.ok(
          ing.gramsPerUnit[line.unit as 'ml'] || line.unit === 'ml',
          `${r.id}: ${line.id} has no ${line.unit}`,
        );
    }
    // pantry-ish recipes must still have at least one real (non-staple) ingredient
    assert.ok(
      r.ingredients.some((l) => !byId.get(l.id)?.staple),
      r.id,
    );
    assert.ok(r.leftoverDays >= 0 && r.leftoverDays <= 7);
    assert.ok(r.slots.length >= 1);
  }
  // no dead weight in the ingredient table
  const unused = data.ingredients.filter((i) => !used.has(i.id)).map((i) => i.id);
  assert.ok(
    unused.length <= data.ingredients.length * 0.2,
    `too many unused ingredients: ${unused.join(', ')}`,
  );
  // every non-staple ingredient has a price, staples are free
  for (const i of data.ingredients) {
    const p = data.prices.items[i.id];
    assert.ok(p, `missing price ${i.id}`);
    if (i.staple) assert.equal(p.mid, 0);
    else assert.ok(p.mid > 0 && p.low <= p.mid && p.mid <= p.high && p.packGrams > 0, i.id);
  }
  assert.equal(data.prices.baseCurrency, 'EUR');
  assert.match(data.prices.note, /estimat/i);
  assert.equal(data.prices.currencyIndex.EUR, 1);
});

test('macro and cost plausibility, tags agree with the numbers', async () => {
  const { recipes } = await catalogue();
  for (const r of recipes) {
    const m = r.macrosPerServing;
    assert.ok(m.kcal >= LIMITS.minKcal && m.kcal <= LIMITS.maxKcal, `${r.id} kcal ${m.kcal}`);
    assert.ok(m.protein <= LIMITS.maxProtein, `${r.id} protein ${m.protein}`);
    assert.ok(
      r.costPerServing >= LIMITS.minCost && r.costPerServing <= LIMITS.maxCost,
      `${r.id} cost ${r.costPerServing}`,
    );
    // energy from macros should be in the ballpark of the stated calories (fibre/water make it looser)
    const atwater = m.protein * 4 + m.carbs * 4 + m.fat * 9;
    assert.ok(
      Math.abs(atwater - m.kcal) <= Math.max(60, m.kcal * 0.35),
      `${r.id}: kcal ${m.kcal} vs macros ${Math.round(atwater)}`,
    );
    if (has(r, 'no_cook')) assert.equal(r.cookMinutes, 0, r.id);
    assert.equal(has(r, 'quick'), r.prepMinutes + r.cookMinutes <= 15, r.id);
    assert.equal(has(r, 'batch_friendly'), r.leftoverDays >= 1, r.id);
    if (has(r, 'high_protein')) assert.ok(m.protein >= 30, r.id);
    if (has(r, 'budget')) assert.ok(r.costPerServing <= 1.8, r.id);
  }
});

test('spot-check: computed macros match a hand calculation from USDA values', async () => {
  const { recipes } = await catalogue();
  const get = (id: string) => {
    const r = recipes.find((x) => x.id === id);
    assert.ok(r, id);
    return r;
  };
  const u = (id: string) => {
    const f = usda.get(id);
    assert.ok(f, id);
    return f;
  };
  const near = (actual: number, expected: number, tol: number, label: string) =>
    assert.ok(Math.abs(actual - expected) <= tol, `${label}: ${actual} vs ${expected}`);

  // 1. banana cinnamon porridge: 50 g oats, 250 ml milk (1.03 g/ml), 1 banana (120 g), 0.5 tsp cinnamon (2.6 g/tsp, 247 kcal), 1 tsp honey (7 g)
  {
    const m = get('oat-porridge-banana').macrosPerServing;
    const kcal =
      0.5 * u('oats-rolled').kcal +
      2.575 * u('milk-whole').kcal +
      1.2 * u('banana').kcal +
      1.3 * 2.47 +
      0.07 * u('honey').kcal;
    near(m.kcal, kcal, 1, 'porridge kcal');
    near(
      m.protein,
      0.5 * u('oats-rolled').p +
        2.575 * u('milk-whole').p +
        1.2 * u('banana').p +
        1.3 * 0.04 +
        0.07 * u('honey').p,
      0.1,
      'porridge protein',
    );
  }
  // 2. chocolate and bread snack: 0.3 baguette (75 g) + 30 g dark chocolate
  {
    const m = get('chocolate-baguette-snack').macrosPerServing;
    near(m.kcal, 0.75 * u('bread-baguette').kcal + 0.3 * u('chocolate-dark').kcal, 1, 'choc kcal');
    near(m.carbs, 0.75 * u('bread-baguette').c + 0.3 * u('chocolate-dark').c, 0.1, 'choc carbs');
    near(m.fat, 0.75 * u('bread-baguette').f + 0.3 * u('chocolate-dark').f, 0.1, 'choc fat');
  }
  // 3. orange and almonds: 1 orange (180 g) + 30 g almonds
  {
    const m = get('orange-almonds').macrosPerServing;
    near(m.kcal, 1.8 * u('orange').kcal + 0.3 * u('almonds').kcal, 1, 'orange kcal');
    near(m.protein, 1.8 * u('orange').p + 0.3 * u('almonds').p, 0.1, 'orange protein');
  }
  // 4. apple with peanut butter: 1 apple (180 g), 2 tbsp peanut butter (16 g each), 1 tbsp raisins (10 g)
  {
    const r = get('apple-peanut-butter');
    near(
      r.macrosPerServing.kcal,
      1.8 * u('apple').kcal + 0.32 * u('peanut-butter').kcal + 0.1 * u('raisins').kcal,
      1,
      'apple kcal',
    );
    near(
      r.macrosPerServing.fat,
      1.8 * u('apple').f + 0.32 * u('peanut-butter').f + 0.1 * u('raisins').f,
      0.1,
      'apple fat',
    );
    // cost: apple 2.80 EUR/kg, peanut butter 7.00 EUR/kg, raisins 6.00 EUR/kg
    near(r.costPerServing, 0.18 * 2.8 + 0.032 * 7 + 0.01 * 6, 0.011, 'apple cost');
  }
  // 5. garlic spaghetti, 2 servings: 200 g pasta, 4 tbsp olive oil (13.7 g each), 4 garlic cloves (4 g), 0.5 tsp chili (1.8 g/tsp, 318 kcal), 2 tbsp parsley (4 g)
  {
    const r = get('spaghetti-aglio-olio');
    const total =
      2 * u('pasta-dry').kcal +
      0.548 * u('olive-oil').kcal +
      0.16 * u('garlic').kcal +
      0.009 * 318 +
      0.08 * u('parsley-fresh').kcal;
    near(r.macrosPerServing.kcal, total / 2, 1, 'aglio kcal');
    near(
      r.macrosPerServing.protein,
      (2 * u('pasta-dry').p + 0.16 * u('garlic').p + 0.009 * 12 + 0.08 * u('parsley-fresh').p) / 2,
      0.1,
      'aglio protein',
    );
  }
});

test('costForRecipe: scales with servings, price level, currency and custom prices', async () => {
  const data = await catalogue();
  const apple = data.recipes.find((r) => r.id === 'apple-peanut-butter');
  assert.ok(apple);
  // matches the build-time cost per serving
  for (const r of data.recipes) {
    near01(costForRecipe(r, r.servings, { catalogue: data }) / r.servings, r.costPerServing, `${r.id} cost`);
  }
  const one = costForRecipe(apple, 1, { catalogue: data });
  near01(costForRecipe(apple, 4, { catalogue: data }), one * 4, 'scales with servings');
  assert.ok(costForRecipe(apple, 1, { catalogue: data, priceLevel: 'low' }) < one);
  assert.ok(costForRecipe(apple, 1, { catalogue: data, priceLevel: 'high' }) > one);
  near01(costForRecipe(apple, 1, { catalogue: data, currency: 'USD' }), one * 1.1, 'USD');
  near01(
    costForRecipe(apple, 1, { catalogue: data, currency: 'XYZ' }),
    one,
    'unknown currency behaves like EUR',
  );
  // custom price for apples: 10 per kg replaces the 2.8 estimate; matched by id or by name (accent-insensitive)
  const custom = costForRecipe(apple, 1, { catalogue: data, customPrices: { apple: 10 } });
  near01(custom, 0.18 * 10 + 0.032 * 7 + 0.01 * 6, 'custom by id');
  near01(
    costForRecipe(apple, 1, { catalogue: data, customPrices: { Pomme: 10 } }),
    custom,
    'custom by French name',
  );
  // staples are free: salt-only change does not alter cost
  assert.equal(
    costForRecipe({ servings: 1, ingredients: [{ id: 'salt', qty: 100, unit: 'g' }] }, 1, {
      catalogue: data,
    }),
    0,
  );
});

function near01(actual: number, expected: number, label: string) {
  assert.ok(Math.abs(actual - expected) <= 0.011, `${label}: ${actual} vs ${expected}`);
}

test('name helpers fall back to English and to a readable id', async () => {
  const data = await catalogue();
  const r = data.recipes.find((x) => x.id === 'shakshuka');
  assert.ok(r);
  assert.equal(recipeName(r, 'fr'), 'Chakchouka');
  assert.equal(recipeName(r, 'en'), 'Shakshuka');
  assert.equal(recipeName(r, 'de'), 'Shakshuka');
  assert.equal(recipeName(r, 'fr-FR'), 'Chakchouka');
  assert.equal(ingredientName('egg-whole-raw', 'fr', data), 'Œuf');
  assert.equal(ingredientName('egg-whole-raw', 'es', data), 'Egg');
  assert.equal(ingredientName('mystery-herb', 'en', data), 'Mystery herb');
  assert.equal(recipeSteps(r, 'fr')[0], r.steps.fr[0]);
  assert.equal(recipeSteps(r, 'ar')[0], r.steps.en[0]);
  // after loadCatalogue() the module-level cache serves ingredientName without passing data
  assert.equal(ingredientName('chicken-breast-raw', 'fr'), 'Blanc de poulet');
});
