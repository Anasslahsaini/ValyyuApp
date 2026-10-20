/**
 * Ingredient <-> pantry matching. Token based, accent-insensitive and singular/plural aware
 * (English and French basics), so "eggs" matches "Egg" but "egg" never matches "eggplant".
 */
import { normalizeText } from './food-search';

/** Words that describe amount, size or preparation rather than the ingredient itself. */
const STOP = new Set([
  // units
  'g',
  'gr',
  'gram',
  'grams',
  'gramme',
  'grammes',
  'kg',
  'kilo',
  'kilos',
  'mg',
  'ml',
  'cl',
  'dl',
  'l',
  'liter',
  'liters',
  'litre',
  'litres',
  'oz',
  'ounce',
  'ounces',
  'lb',
  'lbs',
  'pound',
  'pounds',
  'tsp',
  'tbsp',
  'teaspoon',
  'teaspoons',
  'tablespoon',
  'tablespoons',
  'cup',
  'cups',
  'tasse',
  'tasses',
  'pinch',
  'pincee',
  'pincees',
  'handful',
  'poignee',
  'can',
  'cans',
  'tin',
  'tins',
  'boite',
  'boites',
  'pack',
  'packs',
  'package',
  'sachet',
  'sachets',
  'bunch',
  'botte',
  'slice',
  'slices',
  'tranche',
  'tranches',
  'piece',
  'pieces',
  'clove',
  'cloves',
  'gousse',
  'gousses',
  'c',
  'cs',
  'cc',
  'cas',
  'cac',
  'dash',
  'splash',
  'x',
  // linking words
  'of',
  'a',
  'an',
  'the',
  'and',
  'or',
  'some',
  'for',
  'to',
  'with',
  'de',
  'du',
  'des',
  'd',
  'la',
  'le',
  'les',
  'l',
  'un',
  'une',
  'et',
  'ou',
  'en',
  'au',
  'aux',
  'a',
  'pour',
  'avec',
  // preparation / size
  'fresh',
  'frais',
  'fraiche',
  'fraiches',
  'chopped',
  'hache',
  'hachee',
  'haches',
  'hachees',
  'diced',
  'sliced',
  'minced',
  'grated',
  'rape',
  'rapee',
  'emince',
  'emincee',
  'large',
  'big',
  'small',
  'medium',
  'gros',
  'grosse',
  'grosses',
  'petit',
  'petite',
  'petits',
  'petites',
  'moyen',
  'moyenne',
  'optional',
  'facultatif',
  'taste',
  'gout',
  'about',
  'environ',
  'finely',
  'roughly',
  'peeled',
  'epluche',
  'cooked',
  'cuit',
  'cuite',
  'raw',
  'cru',
  'crue',
  'organic',
  'bio',
  'whole',
  'entier',
  'entiere',
  'ripe',
  'mur',
  'mure',
]);

/** Very small stemmer: plural -> singular for common en/fr endings. */
export function singular(token: string): string {
  if (token.length <= 3) return token;
  if (/[0-9]/.test(token)) return token;
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`; // berries -> berry
  if (token.endsWith('eaux')) return token.slice(0, -1); // poireaux -> poireau
  if (token.endsWith('oes')) return token.slice(0, -2); // tomatoes -> tomato
  if (/(ches|shes|sses|xes|zes)$/.test(token)) return token.slice(0, -2); // peaches, radishes, boxes
  if (token.endsWith('oux') || token.endsWith('eux')) return token.slice(0, -1); // choux -> chou
  if (token.endsWith('ss') || token.endsWith('us') || token.endsWith('is')) return token; // cress, asparagus, anis
  if (token.endsWith('s')) return token.slice(0, -1); // eggs, oeufs, pommes
  return token;
}

/** Core ingredient tokens: no numbers, units, linking or preparation words, singularised. */
export function ingredientTokens(text: string): string[] {
  const out: string[] = [];
  const n = normalizeText(text.replace(/\(.*?\)/g, ' '))
    // "c. à soupe", "cuillères à café": spoon measures, not soup or coffee.
    .replace(/\b(c|cs|cc|cuillere|cuilleres)( a)? (soupe|cafe)\b/g, ' ')
    .replace(/\bpommes? de terre\b/g, 'pommedeterre');
  for (const raw of n.split(' ').filter(Boolean)) {
    if (/^[0-9]+$/.test(raw) || /^[0-9]+(g|kg|ml|l|cl|oz|lb)$/.test(raw)) continue;
    if (STOP.has(raw)) continue;
    const t = singular(raw);
    if (!STOP.has(t) && !out.includes(t)) out.push(t);
  }
  return out;
}

const subset = (a: string[], b: string[]) => a.length > 0 && a.every((t) => b.includes(t));

/**
 * Same ingredient when one side's core tokens are all contained in the other's:
 * pantry "olive oil" covers "2 tbsp olive oil", pantry "chicken breast" covers "chicken".
 */
export function sameIngredient(a: string, b: string): boolean {
  const ta = ingredientTokens(a);
  const tb = ingredientTokens(b);
  return subset(ta, tb) || subset(tb, ta);
}

export function findPantryItem<P extends { name: string }>(ingredient: string, pantry: P[]): P | undefined {
  const ti = ingredientTokens(ingredient);
  if (!ti.length) return undefined;
  let best: P | undefined;
  let bestSize = -1;
  for (const p of pantry) {
    const tp = ingredientTokens(p.name);
    if (!(subset(tp, ti) || subset(ti, tp))) continue;
    // Prefer the most specific pantry item (most shared tokens).
    const shared = tp.filter((t) => ti.includes(t)).length;
    if (shared > bestSize) {
      best = p;
      bestSize = shared;
    }
  }
  return best;
}

export function inPantry(ingredient: string, pantry: { name: string }[]): boolean {
  return !!findPantryItem(ingredient, pantry);
}

/** Share of a recipe's ingredients already at home, 0..1 (0 for recipes without ingredients). */
export function pantryCoverage(
  ingredients: string[],
  pantry: { name: string }[],
): { have: number; total: number; ratio: number } {
  const total = ingredients.length;
  const have = ingredients.filter((i) => inPantry(i, pantry)).length;
  return { have, total, ratio: total ? have / total : 0 };
}

/** Pantry items a recipe would use up, without duplicates (for "Cooked → remove used items"). */
export function pantryItemsUsed<P extends { id: string; name: string }>(
  ingredients: string[],
  pantry: P[],
): P[] {
  const used = new Map<string, P>();
  for (const ing of ingredients) {
    const p = findPantryItem(ing, pantry);
    if (p) used.set(p.id, p);
  }
  return [...used.values()];
}
