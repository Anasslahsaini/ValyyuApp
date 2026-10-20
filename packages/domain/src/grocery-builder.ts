/**
 * Recipes -> shopping list: parse simple quantities ("200 g flour", "1 ½ cups milk", "2 œufs"),
 * merge duplicates, subtract what is already in the pantry and fold into existing list items.
 */
import { findPantryItem, ingredientTokens } from './pantry-match';

export type ParsedIngredient = { qty?: number; unit?: string; name: string };

const FRACTIONS: Record<string, string> = {
  '½': ' 1/2',
  '¼': ' 1/4',
  '¾': ' 3/4',
  '⅓': ' 1/3',
  '⅔': ' 2/3',
  '⅛': ' 1/8',
};

/** [pattern, canonical unit, factor to canonical]. Volumes go to ml and masses to g so they can add up. */
const UNITS: [RegExp, string, number][] = [
  [/^(kg|kgs|kilos?|kilogrammes?|kilograms?)\b\.?/i, 'g', 1000],
  [/^(mg)\b\.?/i, 'g', 0.001],
  [/^(g|gr|grs|grams?|grammes?)\b\.?/i, 'g', 1],
  [/^(oz|ounces?)\b\.?/i, 'g', 28.35],
  [/^(lbs?|pounds?)\b\.?/i, 'g', 453.6],
  [/^(ml|millilitres?|milliliters?)\b\.?/i, 'ml', 1],
  [/^(cl)\b\.?/i, 'ml', 10],
  [/^(dl)\b\.?/i, 'ml', 100],
  [/^(l|litres?|liters?)\b\.?/i, 'ml', 1000],
  [/^(tbsp|tbs|tablespoons?|c\.? ?[àa] ?s(oupe)?\.?|cs|càs|cas|cuill[eè]res? [àa] soupe)(?=\s|$)/i, 'ml', 15],
  [/^(tsp|teaspoons?|c\.? ?[àa] ?c(af[ée])?\.?|cc|càc|cac|cuill[eè]res? [àa] caf[ée])(?=\s|$)/i, 'ml', 5],
  [/^(cups?|tasses?)\b\.?/i, 'ml', 240],
  [/^(pinch(es)?|pinc[ée]es?)(?=\s|$)/i, 'pinch', 1],
  [/^(cloves?|gousses?)(?=\s|$)/i, 'clove', 1],
  [/^(cans?|tins?|bo[iî]tes?)(?=\s|$)/i, 'can', 1],
  [/^(slices?|tranches?)(?=\s|$)/i, 'slice', 1],
];

function toNumber(raw: string): number {
  return raw
    .trim()
    .split(/\s+/)
    .reduce((sum, part) => {
      if (part.includes('/')) {
        const [a, b] = part.split('/').map(Number);
        return sum + (a !== undefined && b ? a / b : 0);
      }
      return sum + Number(part.replace(',', '.'));
    }, 0);
}

export function parseIngredient(line: string): ParsedIngredient {
  let rest = line
    .replace(/[½¼¾⅓⅔⅛]/g, (m) => FRACTIONS[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
  let qty: number | undefined;
  const q = rest.match(
    /^(\d+\/\d+|\d+(?:[.,]\d+)?(?: \d+\/\d+)?)(?: ?(?:-|–|to|à) ?(\d+(?:[.,]\d+)?))?(?:\s*x\b)?\s*/i,
  );
  if (q) {
    qty = toNumber(q[2] ?? q[1] ?? '');
    rest = rest.slice(q[0].length);
  }
  let unit: string | undefined;
  if (qty !== undefined) {
    for (const [re, canonical, factor] of UNITS) {
      const m = rest.match(re);
      if (!m) continue;
      unit = canonical;
      qty = Math.round(qty * factor * 100) / 100;
      rest = rest.slice(m[0].length).trim();
      break;
    }
  }
  rest = rest
    .replace(/^(of|de|des|du|d['’])\s*/i, '')
    .replace(/^[,\-–:]\s*/, '')
    .trim();
  return { qty: qty && qty > 0 ? qty : undefined, unit, name: rest || line.trim() };
}

const keyOf = (name: string) => [...ingredientTokens(name)].sort().join(' ');

type Amounts = Map<string, number>; // unit ('' = count) -> amount

function amountsOf(parsed: ParsedIngredient): Amounts {
  const m: Amounts = new Map();
  if (parsed.qty !== undefined) m.set(parsed.unit ?? '', parsed.qty);
  return m;
}

/** A free-text quantity such as "500 g", "1,5 l" or "6" (empty when it has no number). */
function amountsOfQuantity(quantity: string): Amounts {
  return quantity.trim() ? amountsOf(parseIngredient(`${quantity.trim()} x`)) : new Map();
}

function addAmounts(a: Amounts, b: Amounts) {
  for (const [u, n] of b) a.set(u, Math.round(((a.get(u) ?? 0) + n) * 100) / 100);
}

const nice = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
export function formatAmounts(a: Amounts): string {
  return [...a.entries()]
    .map(([u, n]) => {
      if (u === 'g' && n >= 1000) return `${nice(n / 1000)} kg`;
      if (u === 'ml' && n >= 1000) return `${nice(n / 1000)} l`;
      return u ? `${nice(n)} ${u}` : nice(n);
    })
    .join(' + ');
}

export type RecipeInput = { id: string; ingredients: string[] };
export type GroceryInput = {
  id: string;
  name: string;
  quantity: string;
  checked: boolean;
  recipeIds?: string[];
};
export type GroceryDraft = { name: string; quantity: string; recipeIds: string[] };
export type GroceryUpdate = { id: string; quantity: string; recipeIds: string[] };

/**
 * `add`: new list items. `update`: unchecked items already on the list that get the extra amount.
 * Pantry items with a comparable quantity are subtracted; otherwise having it at home is enough.
 */
export function buildGroceries(
  recipes: RecipeInput[],
  pantry: { name: string; quantity: string }[],
  groceries: GroceryInput[] = [],
): { add: GroceryDraft[]; update: GroceryUpdate[]; skipped: string[] } {
  const groups = new Map<string, { name: string; amounts: Amounts; recipeIds: string[] }>();
  for (const recipe of recipes) {
    for (const line of recipe.ingredients) {
      const parsed = parseIngredient(line);
      const key = keyOf(parsed.name);
      if (!key) continue;
      const g = groups.get(key) ?? {
        name: parsed.name,
        amounts: new Map<string, number>(),
        recipeIds: [] as string[],
      };
      addAmounts(g.amounts, amountsOf(parsed));
      if (!g.recipeIds.includes(recipe.id)) g.recipeIds.push(recipe.id);
      groups.set(key, g);
    }
  }
  const add: GroceryDraft[] = [];
  const update: GroceryUpdate[] = [];
  const skipped: string[] = [];
  for (const [key, g] of groups) {
    const home = findPantryItem(g.name, pantry);
    if (home) {
      const have = amountsOfQuantity(home.quantity);
      const unit = [...have.keys()][0];
      if (unit !== undefined && g.amounts.has(unit) && g.amounts.size === 1) {
        const left = (g.amounts.get(unit) ?? 0) - (have.get(unit) ?? 0);
        if (left <= 0) {
          skipped.push(g.name);
          continue;
        }
        g.amounts.set(unit, Math.round(left * 100) / 100);
      } else {
        skipped.push(g.name);
        continue;
      }
    }
    const existing = groceries.find((x) => !x.checked && keyOf(parseIngredient(x.name).name) === key);
    if (existing && g.recipeIds.every((id) => existing.recipeIds?.includes(id))) {
      skipped.push(g.name);
      continue;
    } // already added for these recipes
    if (existing) {
      const merged = amountsOfQuantity(existing.quantity);
      const existingParsable = merged.size > 0 || !existing.quantity.trim();
      addAmounts(merged, g.amounts);
      const quantity = existingParsable
        ? formatAmounts(merged)
        : [existing.quantity, formatAmounts(g.amounts)].filter(Boolean).join(' + ');
      update.push({
        id: existing.id,
        quantity,
        recipeIds: [...new Set([...(existing.recipeIds ?? []), ...g.recipeIds])],
      });
      continue;
    }
    add.push({
      name: g.name.charAt(0).toUpperCase() + g.name.slice(1),
      quantity: formatAmounts(g.amounts),
      recipeIds: g.recipeIds,
    });
  }
  return { add, update, skipped };
}
