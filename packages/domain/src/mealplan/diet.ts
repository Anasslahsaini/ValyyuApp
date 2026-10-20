/**
 * Diet / allergen / dislike filtering. Strict: an ingredient with an explicit catalogue flag or allergen
 * decides; when the flag is unknown (user recipes) an EN/FR keyword heuristic is used instead.
 */
import { ingredientTokens } from '../pantry-match';
import type { PlanIngredient, PlanRecipe } from './types';

const set = (s: string) => new Set(s.split(/\s+/).filter(Boolean));
const MEAT = set(
  'chicken poulet beef boeuf veal veau pork porc lamb agneau mutton turkey dinde duck canard ham jambon bacon lardon sausage saucisse saucisson chorizo merguez salami steak meat viande prosciutto pancetta gelatin gelatine lard rabbit lapin bresaola venison',
);
const FISH = set(
  'fish poisson salmon saumon tuna thon cod cabillaud sardine anchovy anchois mackerel maquereau trout truite haddock hake colin herring hareng tilapia bass',
);
const SHELL = set(
  'shrimp prawn crevette crab crabe lobster homard mussel moule oyster huitre squid calamar scallop clam seafood langoustine',
);
const DAIRY = set(
  'milk lait cheese fromage butter beurre cream creme yogurt yoghurt yaourt mozzarella parmesan feta ricotta cheddar gruyere emmental mascarpone whey kefir camembert brie chevre halloumi skyr',
);
const PLANT_MILK = set(
  'coconut coco almond amande oat avoine soy soja peanut cacahuete arachide cocoa cacao rice riz hazelnut noisette',
);
const EGG = set('egg oeuf mayonnaise mayo meringue');
const HONEY = set('honey miel');
const GLUTEN = set(
  'wheat ble flour farine bread pain pasta spaghetti penne macaroni tagliatelle couscous semoule bulgur barley orge rye seigle noodle baguette croissant biscuit cracker seitan tortilla pita semolina lasagne lasagna gnocchi spelt epeautre breadcrumb chapelure',
);
const GLUTEN_SAFE = set(
  'rice riz maize mais corn chickpea pois almond amande coconut coco buckwheat sarrasin potato',
);
const NUTS = set('almond amande walnut noix hazelnut noisette cashew pistachio pecan macadamia pignon');
const NUT_SAFE = set('muscade nutmeg coco coconut');
const PEANUT = set('peanut cacahuete arachide');
const HALAL_BAD = set(
  'pork porc ham jambon bacon lardon wine vin beer biere rum rhum alcohol gelatin gelatine chorizo saucisson prosciutto pancetta lard whisky vodka brandy cognac',
);

const memo = new Map<string, string[]>();
export function tokensOf(name: string): string[] {
  let t = memo.get(name);
  if (!t) {
    t = ingredientTokens(name);
    if (memo.size > 5000) memo.clear();
    memo.set(name, t);
  }
  return t;
}
const has = (tokens: string[], words: Set<string>) => tokens.some((t) => words.has(t));
const nameTokens = (ing: PlanIngredient) => {
  const t = tokensOf(ing.name);
  return ing.ingredientId ? [...new Set([...t, ...tokensOf(ing.ingredientId.replace(/[-_]/g, ' '))])] : t;
};

export type KeywordFlags = {
  meat: boolean;
  fish: boolean;
  shellfish: boolean;
  dairy: boolean;
  egg: boolean;
  honey: boolean;
  gluten: boolean;
  nuts: boolean;
  peanut: boolean;
  halalBad: boolean;
};
/** Keyword heuristic over an ingredient name. Also used by the user-recipe adapter. */
export function inferFlags(name: string): KeywordFlags {
  const t = tokensOf(name);
  const plantMilk = has(t, PLANT_MILK);
  const raw = name.toLowerCase();
  const glutenFree = /gluten[\s-]*free|sans gluten/.test(raw);
  return {
    meat: has(t, MEAT),
    fish: has(t, FISH),
    shellfish: has(t, SHELL),
    dairy: has(t, DAIRY) && !plantMilk,
    egg: has(t, EGG),
    honey: has(t, HONEY),
    gluten:
      has(t, GLUTEN) && !glutenFree && !(has(t, GLUTEN_SAFE) && /flour|farine|noodle|pasta|pate/.test(raw)),
    nuts: has(t, NUTS) && !has(t, NUT_SAFE),
    peanut: has(t, PEANUT),
    halalBad: has(t, HALAL_BAD),
  };
}

const ALLERGY_DIETS = new Set(['gluten_free', 'dairy_free', 'nut_free', 'egg_free']);

/** True when this ingredient is incompatible with the given diet tag. */
export function ingredientViolates(ing: PlanIngredient, diet: string): boolean {
  const f = ing.diet ?? {};
  const a = ing.allergens;
  const k = inferFlags(ing.name + (ing.ingredientId ? ` ${ing.ingredientId.replace(/[-_]/g, ' ')}` : ''));
  switch (diet) {
    case 'vegetarian':
      return f.vegetarian === false || (f.vegetarian === undefined && (k.meat || k.fish || k.shellfish));
    case 'vegan':
      return (
        f.vegan === false ||
        (f.vegan === undefined && (k.meat || k.fish || k.shellfish || k.dairy || k.egg || k.honey))
      );
    case 'pescatarian':
      return f.pescatarian === false || (f.pescatarian === undefined && k.meat);
    case 'halal':
      return f.halalSafe === false || (f.halalSafe === undefined && k.halalBad);
    case 'gluten_free':
      return (
        f.glutenFree === false ||
        !!a?.includes('gluten') ||
        (f.glutenFree === undefined && a === undefined && k.gluten)
      );
    case 'dairy_free':
      return (
        f.dairyFree === false ||
        !!a?.includes('dairy') ||
        (f.dairyFree === undefined && a === undefined && k.dairy)
      );
    case 'nut_free':
      return (
        f.nutFree === false ||
        !!a?.includes('nuts') ||
        !!a?.includes('peanut') ||
        (f.nutFree === undefined && a === undefined && (k.nuts || k.peanut))
      );
    case 'egg_free':
      return (
        f.eggFree === false || !!a?.includes('egg') || (f.eggFree === undefined && a === undefined && k.egg)
      );
    default:
      return false;
  }
}

export function violatesDiet(recipe: PlanRecipe, diet: readonly string[]): boolean {
  for (const d of diet) {
    const strictAll = ALLERGY_DIETS.has(d);
    for (const ing of recipe.ingredients) {
      if (ing.optional && !strictAll) continue;
      if (ingredientViolates(ing, d)) return true;
    }
  }
  return false;
}

/** Prepared dislike token sets; a dislike matches when all its tokens appear in an ingredient (or recipe) name. */
export function prepareDislikes(dislikes: readonly string[]): string[][] {
  return dislikes.map((d) => ingredientTokens(d)).filter((t) => t.length > 0);
}
export function hitsDislike(recipe: PlanRecipe, dislikes: string[][]): boolean {
  if (!dislikes.length) return false;
  const nameT = tokensOf(recipe.name);
  for (const dl of dislikes) {
    if (dl.every((t) => nameT.includes(t))) return true;
    for (const ing of recipe.ingredients) {
      if (ing.optional) continue;
      const t = nameTokens(ing);
      if (dl.every((x) => t.includes(x))) return true;
    }
  }
  return false;
}

const SOY = set('soy soja tofu tempeh edamame miso');
const SESAME = set('sesame sesame tahini tahina halva gomasio');
/** Allergy key -> the strict diet rule that already covers it (catalogue flags + name heuristics). */
const ALLERGY_DIET: Record<string, string> = {
  gluten: 'gluten_free',
  dairy: 'dairy_free',
  egg: 'egg_free',
  nuts: 'nut_free',
};

/**
 * True when one ingredient (optional ones included: an allergy is never "optional") may contain an allergen the
 * person declared. Catalogue allergens decide when present; names are checked as well. This is a filter, not a
 * promise: the recipe sheet always says to check the labels.
 */
export function hitsAllergy(recipe: PlanRecipe, allergies: readonly string[]): boolean {
  for (const a of allergies) {
    for (const ing of recipe.ingredients) {
      if (ing.allergens?.includes(a as never)) return true;
      if (ALLERGY_DIET[a] && ingredientViolates(ing, ALLERGY_DIET[a])) return true;
      const t = nameTokens(ing);
      const k = inferFlags(ing.name);
      if (a === 'peanut' && k.peanut) return true;
      if (a === 'nuts' && (k.nuts || k.peanut)) return true;
      if (a === 'fish' && k.fish) return true;
      if (a === 'shellfish' && k.shellfish) return true;
      if (a === 'soy' && has(t, SOY)) return true;
      if (a === 'sesame' && has(t, SESAME)) return true;
    }
  }
  return false;
}

export function isAllowed(
  recipe: PlanRecipe,
  diet: readonly string[],
  dislikes: string[][],
  allergies: readonly string[] = [],
): boolean {
  return !violatesDiet(recipe, diet) && !hitsDislike(recipe, dislikes) && !hitsAllergy(recipe, allergies);
}
