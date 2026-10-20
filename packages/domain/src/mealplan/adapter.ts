/** Adapter: the user's free-text `recipes` collection -> normalised `PlanRecipe`. */
import { parseIngredient } from '../grocery-builder';
import type { Recipe } from '../life';
import { inferFlags, tokensOf } from './diet';
import type { Allergen, PlanIngredient, PlanRecipe, Slot } from './types';

/** Typical weight of one piece (grams) for common counted foods; EN/FR. */
const PIECE_GRAMS: Record<string, number> = {
  egg: 55,
  oeuf: 55,
  onion: 110,
  oignon: 110,
  tomato: 120,
  tomate: 120,
  pommedeterre: 170,
  potato: 170,
  carrot: 80,
  carotte: 80,
  apple: 180,
  pomme: 180,
  banana: 120,
  banane: 120,
  lemon: 80,
  citron: 80,
  orange: 150,
  avocado: 170,
  avocat: 170,
  pepper: 150,
  poivron: 150,
  courgette: 200,
  zucchini: 200,
  cucumber: 300,
  concombre: 300,
  eggplant: 300,
  aubergine: 300,
  yogurt: 125,
  yaourt: 125,
  shallot: 40,
  echalote: 40,
  bun: 80,
  tortilla: 60,
  pita: 60,
};
const STAPLE = new Set(['salt', 'sel', 'pepper', 'poivre', 'water', 'eau', 'ice', 'glacon']);
const BREAKFAST =
  /(breakfast|petit[- ]?d[eé]j|porridge|oat|avoine|pancake|crepe|crêpe|toast|omelet|omelette|granola|muesli|smoothie|yaourt|yogurt|yoghurt|gaufre|waffle|pain perdu|french toast|overnight)/i;

function toIngredient(line: string): PlanIngredient {
  const parsed = parseIngredient(line);
  const tokens = tokensOf(parsed.name);
  const f = inferFlags(parsed.name);
  const allergens: Allergen[] = [];
  if (f.gluten) allergens.push('gluten');
  if (f.dairy) allergens.push('dairy');
  if (f.egg) allergens.push('egg');
  if (f.nuts) allergens.push('nuts');
  if (f.peanut) allergens.push('peanut');
  if (f.fish) allergens.push('fish');
  if (f.shellfish) allergens.push('shellfish');
  const ing: PlanIngredient = {
    name: parsed.name,
    grams: 0,
    allergens,
    diet: {
      vegetarian: !(f.meat || f.fish || f.shellfish),
      vegan: !(f.meat || f.fish || f.shellfish || f.dairy || f.egg || f.honey),
      pescatarian: !f.meat,
      halalSafe: !f.halalBad,
      glutenFree: !f.gluten,
      dairyFree: !f.dairy,
      nutFree: !(f.nuts || f.peanut),
      eggFree: !f.egg,
    },
  };
  if (tokens.some((t) => STAPLE.has(t)) || parsed.unit === 'pinch') ing.staple = true;
  if (parsed.qty !== undefined) {
    switch (parsed.unit) {
      case 'g':
        ing.grams = parsed.qty;
        break;
      case 'ml':
        ing.grams = parsed.qty;
        ing.unit = 'ml';
        break; // density 1 by default
      case 'clove':
        ing.grams = parsed.qty * 5;
        break;
      case 'can':
        ing.grams = parsed.qty * 400;
        break;
      case 'slice':
        ing.grams = parsed.qty * 30;
        break;
      case 'pinch':
        ing.grams = parsed.qty * 0.5;
        break;
      default: {
        const per =
          tokens.map((t) => PIECE_GRAMS[t]).find((v) => v !== undefined) ??
          (tokens.join('') in PIECE_GRAMS ? PIECE_GRAMS[tokens.join('')] : undefined);
        if (per) {
          ing.grams = parsed.qty * per;
          ing.unit = 'piece';
          ing.pieceGrams = per;
        } else {
          ing.grams = parsed.qty * 100;
          ing.unit = 'piece';
          ing.pieceGrams = 100;
        }
      }
    }
  }
  return ing;
}

/**
 * Free-text user recipe -> `PlanRecipe`. Macros are the recipe's own fields (per serving); diet flags and allergens
 * are inferred from ingredient names (EN/FR keywords); cost is unknown (priced via the user's custom prices).
 */
export function fromUserRecipe(recipe: Recipe, opts: { favorite?: boolean } = {}): PlanRecipe {
  const servings = recipe.servings && recipe.servings > 0 ? recipe.servings : 1;
  const prep = recipe.prepMinutes ?? 0,
    cook = recipe.cookMinutes ?? 0;
  const total = prep + cook > 0 ? prep + cook : 30;
  const breakfast = BREAKFAST.test(recipe.name);
  const slots: Slot[] = breakfast ? ['breakfast', 'snack'] : ['lunch', 'dinner'];
  const tags: string[] = [];
  if (recipe.cookMinutes === 0 && prep > 0 && prep <= 15) tags.push('no_cook');
  if (total <= 20) tags.push('quick');
  const unknown = new Set(recipe.unknownNutrients ?? []);
  return {
    id: recipe.id,
    name: recipe.name,
    slots,
    servings,
    prepMinutes: prep > 0 || cook > 0 ? prep : total,
    cookMinutes: cook,
    tags,
    ingredients: recipe.ingredients.map(toIngredient),
    perServing: {
      calories: unknown.has('calories') ? 0 : recipe.calories,
      protein: unknown.has('protein') ? 0 : recipe.protein,
      carbs: unknown.has('carbs') ? 0 : recipe.carbs,
      fat: unknown.has('fat') ? 0 : recipe.fat,
    },
    macrosKnown: !unknown.has('calories') && recipe.calories > 0,
    leftoverDays: breakfast ? 0 : servings >= 4 ? 2 : servings >= 2 ? 1 : 0,
    source: 'user',
    favorite: opts.favorite ?? recipe.favorite,
  };
}
export const fromUserRecipes = (recipes: readonly Recipe[]): PlanRecipe[] =>
  recipes.map((r) => fromUserRecipe(r));
