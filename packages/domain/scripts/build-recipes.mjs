#!/usr/bin/env node
/**
 * Validates the recipe catalogue sources in data/recipes/ and writes recipes.built.json,
 * the single file the app loads for recipes (macros and cost per serving are COMPUTED here,
 * never typed by hand).
 *
 *   node scripts/build-recipes.mjs           validate + write recipes.built.json
 *   node scripts/build-recipes.mjs --check   validate + fail if recipes.built.json is stale
 *
 * Sources: ingredients.json, prices.json, recipes.json (all hand-written, original content;
 * nutrition values from USDA SR Legacy (public domain) or marked "estimate"; prices are
 * approximate estimates, not live prices).
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(here, '..', 'data', 'recipes');
export const BUILT_FILE = join(DATA_DIR, 'recipes.built.json');

export const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
export const UNITS = ['g', 'ml', 'piece', 'tbsp', 'tsp', 'cup'];
export const CATEGORIES = [
  'produce',
  'dairy',
  'meat',
  'fish',
  'grain',
  'legume',
  'bakery',
  'pantry',
  'frozen',
  'spice',
  'oil',
  'drink',
  'other',
];
export const CUISINES = [
  'maghreb',
  'french',
  'mediterranean',
  'middle_eastern',
  'italian',
  'asian',
  'mexican',
  'american',
  'indian',
  'other',
];
export const ALLERGENS = ['gluten', 'dairy', 'egg', 'nuts', 'peanut', 'fish', 'shellfish', 'soy', 'sesame'];
export const DIET_TAGS = [
  'vegetarian',
  'vegan',
  'pescatarian',
  'gluten_free',
  'dairy_free',
  'nut_free',
  'egg_free',
  'halal',
];
export const TAGS = [
  ...DIET_TAGS,
  'one_pot',
  'batch_friendly',
  'freezer_friendly',
  'no_cook',
  'high_protein',
  'budget',
  'kid_friendly',
  'quick',
];
export const PRICE_UNITS = ['kg', 'l', 'piece'];
export const HIGH_PROTEIN_G = 30;
export const BUDGET_EUR = 1.8;
export const LIMITS = { minKcal: 120, maxKcal: 1300, maxProtein: 90, minCost: 0.2, maxCost: 15 };

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const round = (x, d) => {
  const f = 10 ** d;
  return Math.round(x * f) / f;
};

export function readSources(dir = DATA_DIR) {
  const read = (name) => readFileSync(join(dir, name), 'utf8');
  return {
    ingredientsText: read('ingredients.json'),
    pricesText: read('prices.json'),
    recipesText: read('recipes.json'),
  };
}

export function sourceHash({ ingredientsText, pricesText, recipesText }) {
  return createHash('sha256')
    .update(ingredientsText)
    .update('\0')
    .update(pricesText)
    .update('\0')
    .update(recipesText)
    .digest('hex')
    .slice(0, 16);
}

/** grams for a recipe line; throws when the unit is not defined for the ingredient. */
export function gramsOf(ingredient, qty, unit) {
  if (unit === 'g') return qty;
  if (unit === 'ml') return qty * (ingredient.gramsPerUnit.ml ?? 1);
  const g = ingredient.gramsPerUnit[unit];
  if (!isNum(g) || g <= 0) throw new Error(`unit "${unit}" is not defined for ingredient "${ingredient.id}"`);
  return qty * g;
}

/** cost in EUR of `grams` of an ingredient at the mid price (staples cost 0). */
export function costOfGrams(ingredient, price, grams) {
  if (ingredient.staple || !price) return 0;
  if (price.unit === 'kg') return (grams / 1000) * price.mid;
  if (price.unit === 'l') return (grams / (ingredient.gramsPerUnit.ml ?? 1) / 1000) * price.mid;
  return (grams / ingredient.gramsPerUnit.piece) * price.mid;
}

export function computeRecipe(recipe, ingredientMap, priceItems) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, cost: 0 };
  for (const line of recipe.ingredients) {
    const ing = ingredientMap.get(line.id);
    const g = gramsOf(ing, line.qty, line.unit);
    t.kcal += (g * ing.per100g.calories) / 100;
    t.protein += (g * ing.per100g.protein) / 100;
    t.carbs += (g * ing.per100g.carbs) / 100;
    t.fat += (g * ing.per100g.fat) / 100;
    t.cost += costOfGrams(ing, priceItems[line.id], g);
  }
  const s = recipe.servings;
  return {
    macrosPerServing: {
      kcal: Math.round(t.kcal / s),
      protein: round(t.protein / s, 1),
      carbs: round(t.carbs / s, 1),
      fat: round(t.fat / s, 1),
    },
    costPerServing: round(t.cost / s, 2),
  };
}

function nonEmptyText(x) {
  return typeof x === 'string' && x.trim().length > 0;
}

/** Pure: validates the parsed sources and returns { errors, built }. */
export function buildCatalogue(sources) {
  const errors = [];
  const err = (m) => errors.push(m);
  let ingredients;
  let prices;
  let recipes;
  try {
    ingredients = JSON.parse(sources.ingredientsText);
  } catch (e) {
    return { errors: [`ingredients.json is not valid JSON: ${e.message}`], built: null };
  }
  try {
    prices = JSON.parse(sources.pricesText);
  } catch (e) {
    return { errors: [`prices.json is not valid JSON: ${e.message}`], built: null };
  }
  try {
    recipes = JSON.parse(sources.recipesText);
  } catch (e) {
    return { errors: [`recipes.json is not valid JSON: ${e.message}`], built: null };
  }
  if (!Array.isArray(ingredients) || !Array.isArray(recipes))
    return { errors: ['ingredients.json and recipes.json must be arrays'], built: null };

  // ---- ingredients
  const ingMap = new Map();
  for (const ing of ingredients) {
    const where = `ingredient "${ing?.id}"`;
    if (typeof ing?.id !== 'string' || !SLUG.test(ing.id)) {
      err(`${where}: id must be a lowercase slug`);
      continue;
    }
    if (ingMap.has(ing.id)) {
      err(`${where}: duplicate id`);
      continue;
    }
    ingMap.set(ing.id, ing);
    if (!nonEmptyText(ing.name?.en) || !nonEmptyText(ing.name?.fr))
      err(`${where}: name.en and name.fr are required`);
    if (!CATEGORIES.includes(ing.category)) err(`${where}: invalid category "${ing.category}"`);
    const p = ing.per100g;
    if (!p || !['calories', 'protein', 'carbs', 'fat'].every((k) => isNum(p[k]) && p[k] >= 0))
      err(`${where}: per100g needs non-negative calories, protein, carbs, fat`);
    else {
      if (p.calories > 900) err(`${where}: calories ${p.calories} per 100 g is implausible`);
      if (p.protein + p.carbs + p.fat > 100.5) err(`${where}: macros add up to more than 100 g per 100 g`);
    }
    for (const [u, v] of Object.entries(ing.gramsPerUnit ?? {})) {
      if (!UNITS.includes(u) || u === 'g') err(`${where}: gramsPerUnit has invalid unit "${u}"`);
      else if (!isNum(v) || v <= 0) err(`${where}: gramsPerUnit.${u} must be > 0`);
    }
    if (typeof ing.staple !== 'boolean') err(`${where}: staple must be boolean`);
    if (!Array.isArray(ing.allergens) || ing.allergens.some((a) => !ALLERGENS.includes(a)))
      err(`${where}: invalid allergens`);
    const d = ing.diet;
    const flags = [
      'vegan',
      'vegetarian',
      'pescatarian',
      'halalSafe',
      'glutenFree',
      'dairyFree',
      'nutFree',
      'eggFree',
    ];
    if (!d || flags.some((k) => typeof d[k] !== 'boolean')) err(`${where}: diet needs all boolean flags`);
    else {
      if (d.vegan && !d.vegetarian) err(`${where}: vegan implies vegetarian`);
      if (d.vegetarian && !d.pescatarian) err(`${where}: vegetarian implies pescatarian`);
      const al = ing.allergens ?? [];
      if (al.includes('gluten') === d.glutenFree) err(`${where}: glutenFree contradicts allergens`);
      if (al.includes('dairy') === d.dairyFree) err(`${where}: dairyFree contradicts allergens`);
      if (al.includes('egg') === d.eggFree) err(`${where}: eggFree contradicts allergens`);
      if ((al.includes('nuts') || al.includes('peanut')) === d.nutFree)
        err(`${where}: nutFree contradicts allergens`);
      if (
        d.vegan &&
        (al.includes('dairy') || al.includes('egg') || al.includes('fish') || al.includes('shellfish'))
      )
        err(`${where}: vegan with animal allergens`);
      if (ing.category === 'meat' && d.pescatarian) err(`${where}: meat cannot be pescatarian`);
    }
    if (!['usda-sr-legacy', 'estimate'].includes(ing.source))
      err(`${where}: source must be usda-sr-legacy or estimate`);
  }

  // ---- prices
  if (prices?.baseCurrency !== 'EUR') err('prices.json: baseCurrency must be EUR');
  if (!nonEmptyText(prices?.note) || !/estimat/i.test(prices.note))
    err('prices.json: note must say these are estimates');
  if (
    !prices?.currencyIndex ||
    prices.currencyIndex.EUR !== 1 ||
    Object.values(prices.currencyIndex).some((v) => !isNum(v) || v <= 0)
  )
    err('prices.json: currencyIndex needs EUR = 1 and positive multipliers');
  const items = prices?.items ?? {};
  for (const [id, pr] of Object.entries(items)) {
    const ing = ingMap.get(id);
    if (!ing) {
      err(`prices.json: price for unknown ingredient "${id}"`);
      continue;
    }
    if (!PRICE_UNITS.includes(pr.unit)) err(`prices.json "${id}": invalid unit "${pr.unit}"`);
    if (![pr.mid, pr.low, pr.high].every((v) => isNum(v) && v >= 0))
      err(`prices.json "${id}": mid/low/high must be numbers >= 0`);
    else if (!(pr.low <= pr.mid && pr.mid <= pr.high)) err(`prices.json "${id}": need low <= mid <= high`);
    if (!isNum(pr.packGrams) || pr.packGrams <= 0) err(`prices.json "${id}": packGrams must be > 0`);
    if (pr.unit === 'piece' && !ing.gramsPerUnit.piece)
      err(`prices.json "${id}": piece price needs gramsPerUnit.piece`);
    if (ing.staple && pr.mid !== 0) err(`prices.json "${id}": staples must have price 0`);
    if (!ing.staple && pr.mid <= 0) err(`prices.json "${id}": non-staple price must be > 0`);
  }
  for (const ing of ingMap.values()) if (!items[ing.id]) err(`prices.json: missing price for "${ing.id}"`);

  // ---- recipes
  const ids = new Set();
  const names = new Set();
  const builtRecipes = [];
  for (const r of recipes) {
    const where = `recipe "${r?.id}"`;
    if (typeof r?.id !== 'string' || !SLUG.test(r.id)) {
      err(`${where}: id must be a lowercase slug`);
      continue;
    }
    if (ids.has(r.id)) {
      err(`${where}: duplicate id`);
      continue;
    }
    ids.add(r.id);
    if (!nonEmptyText(r.name?.en) || !nonEmptyText(r.name?.fr))
      err(`${where}: name.en and name.fr are required`);
    else {
      const key = r.name.en.trim().toLowerCase();
      if (names.has(key)) err(`${where}: duplicate English name "${r.name.en}"`);
      names.add(key);
    }
    if (!Array.isArray(r.slots) || r.slots.length === 0 || r.slots.some((s) => !SLOTS.includes(s)))
      err(`${where}: slots must be a non-empty subset of ${SLOTS.join(', ')}`);
    if (!Number.isInteger(r.servings) || r.servings < 1 || r.servings > 12)
      err(`${where}: servings must be an integer 1-12`);
    if (!Number.isInteger(r.prepMinutes) || r.prepMinutes < 0 || r.prepMinutes > 120)
      err(`${where}: prepMinutes must be an integer 0-120`);
    if (!Number.isInteger(r.cookMinutes) || r.cookMinutes < 0 || r.cookMinutes > 240)
      err(`${where}: cookMinutes must be an integer 0-240`);
    const total = (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);
    if (total < 1 || total > 300) err(`${where}: total time ${total} min is not sane`);
    if (
      r.activeMinutes !== undefined &&
      (!Number.isInteger(r.activeMinutes) || r.activeMinutes < 0 || r.activeMinutes > total)
    )
      err(`${where}: activeMinutes must be an integer between 0 and the total time`);
    if (!CUISINES.includes(r.cuisine)) err(`${where}: invalid cuisine "${r.cuisine}"`);
    if (
      !Array.isArray(r.tags) ||
      r.tags.some((t) => !TAGS.includes(t)) ||
      new Set(r.tags).size !== r.tags.length
    )
      err(`${where}: tags must be unique and in the allowed list (${TAGS.join(', ')})`);
    if (!Number.isInteger(r.leftoverDays) || r.leftoverDays < 0 || r.leftoverDays > 7)
      err(`${where}: leftoverDays must be an integer 0-7`);
    for (const lang of ['en', 'fr']) {
      const steps = r.steps?.[lang];
      if (
        !Array.isArray(steps) ||
        steps.length < 3 ||
        steps.length > 7 ||
        steps.some((s) => !nonEmptyText(s))
      )
        err(`${where}: steps.${lang} needs 3 to 7 non-empty steps`);
    }
    if (r.steps?.en?.length !== r.steps?.fr?.length)
      err(`${where}: steps.en and steps.fr must have the same length`);

    if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) {
      err(`${where}: needs ingredients`);
      continue;
    }
    const seen = new Set();
    let ok = true;
    const used = [];
    for (const line of r.ingredients) {
      const ing = ingMap.get(line?.id);
      if (!ing) {
        err(`${where}: unknown ingredient "${line?.id}"`);
        ok = false;
        continue;
      }
      if (seen.has(line.id)) err(`${where}: ingredient "${line.id}" listed twice`);
      seen.add(line.id);
      if (!UNITS.includes(line.unit)) {
        err(`${where}: invalid unit "${line.unit}" for "${line.id}"`);
        ok = false;
        continue;
      }
      if (!isNum(line.qty) || line.qty <= 0) {
        err(`${where}: qty for "${line.id}" must be > 0`);
        ok = false;
        continue;
      }
      if (line.optional !== undefined && line.optional !== true)
        err(`${where}: optional must be true when present`);
      try {
        gramsOf(ing, line.qty, line.unit);
      } catch (e) {
        err(`${where}: ${e.message}`);
        ok = false;
        continue;
      }
      used.push(ing);
    }
    if (!ok) continue;

    // Derived tags are computed here from the ingredients, time, leftovers and numbers, so they can never
    // go stale. The source file only needs the hand-set tags (one_pot, freezer_friendly, no_cook, kid_friendly).
    const computed = computeRecipe(r, ingMap, items);
    const m = computed.macrosPerServing;
    const derived = {
      vegan: used.every((i) => i.diet.vegan),
      vegetarian: used.every((i) => i.diet.vegetarian),
      pescatarian: used.every((i) => i.diet.pescatarian),
      gluten_free: used.every((i) => i.diet.glutenFree),
      dairy_free: used.every((i) => i.diet.dairyFree),
      nut_free: used.every((i) => i.diet.nutFree),
      egg_free: used.every((i) => i.diet.eggFree),
      halal: used.every((i) => i.diet.halalSafe),
      quick: total <= 15,
      batch_friendly: r.leftoverDays >= 1,
      high_protein: m.protein >= HIGH_PROTEIN_G,
      budget: computed.costPerServing <= BUDGET_EUR,
    };
    for (const [tag, value] of Object.entries(derived)) {
      if (!value && r.tags?.includes(tag))
        err(`${where}: tag "${tag}" is set but does not apply (it is computed; remove it from the source)`);
    }
    if (m.kcal < LIMITS.minKcal || m.kcal > LIMITS.maxKcal)
      err(`${where}: ${m.kcal} kcal per serving is outside ${LIMITS.minKcal}-${LIMITS.maxKcal}`);
    if (m.protein > LIMITS.maxProtein)
      err(`${where}: ${m.protein} g protein per serving is above ${LIMITS.maxProtein}`);
    if (computed.costPerServing < LIMITS.minCost || computed.costPerServing > LIMITS.maxCost)
      err(
        `${where}: cost ${computed.costPerServing} EUR per serving is outside ${LIMITS.minCost}-${LIMITS.maxCost}`,
      );
    if (r.tags?.includes('no_cook') && r.cookMinutes !== 0) err(`${where}: no_cook requires cookMinutes 0`);
    const tags = TAGS.filter((t) => r.tags?.includes(t) || derived[t] === true);
    builtRecipes.push({ ...r, tags, ...computed });
  }

  if (errors.length) return { errors, built: null };
  const built = {
    version: 1,
    sourceHash: sourceHash(sources),
    priceBase: prices.baseCurrency,
    recipes: builtRecipes,
  };
  return { errors, built };
}

/** One recipe per line keeps diffs readable while staying compact. */
export function serializeBuilt(built) {
  const { recipes, ...head } = built;
  return `${JSON.stringify(head).slice(0, -1)},"recipes":[\n${recipes.map((r) => JSON.stringify(r)).join(',\n')}\n]}\n`;
}

function main() {
  const check = process.argv.includes('--check');
  const sources = readSources();
  const { errors, built } = buildCatalogue(sources);
  if (errors.length) {
    console.error(`Recipe catalogue is invalid (${errors.length} problem${errors.length === 1 ? '' : 's'}):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  const text = serializeBuilt(built);
  if (check) {
    const current = existsSync(BUILT_FILE) ? readFileSync(BUILT_FILE, 'utf8') : '';
    if (current !== text) {
      console.error('recipes.built.json is stale. Run: pnpm --filter @workspace/domain run build:recipes');
      process.exit(1);
    }
    console.log(`recipes.built.json is up to date (${built.recipes.length} recipes).`);
    return;
  }
  writeFileSync(BUILT_FILE, text);
  console.log(
    `Wrote ${BUILT_FILE}: ${built.recipes.length} recipes, ${(text.length / 1024).toFixed(0)} KB, hash ${built.sourceHash}.`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
