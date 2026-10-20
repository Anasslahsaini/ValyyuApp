/** Accent- and case-insensitive token/prefix search, shared by the food database and meal history. */

/** "Crème brûlée, Œufs" -> "creme brulee oeufs" */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function textTokens(text: string): string[] {
  const n = normalizeText(text);
  return n ? n.split(' ') : [];
}

export type FoodItem = {
  id: string;
  name: string;
  /** Optional French name, searched like the English one. */
  fr?: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  portions?: { label: string; g: number }[];
};

type Indexed<T> = { item: T; texts: string[][] };

/**
 * Score how well `query` matches a list of token lists (one per searchable text, e.g. English and
 * French names). Every query token must match the start of some token; whole-token matches and
 * matches at the start of the name rank higher. Returns 0 when it does not match.
 */
export function matchScore(queryTokens: string[], texts: string[][]): number {
  if (!queryTokens.length) return 0;
  let best = 0;
  for (const tokens of texts) {
    if (!tokens.length) continue;
    let score = 0;
    let ok = true;
    for (let qi = 0; qi < queryTokens.length; qi++) {
      const q = queryTokens[qi];
      let tokenScore = 0;
      for (let ti = 0; ti < tokens.length; ti++) {
        const t = tokens[ti];
        if (!t.startsWith(q)) continue;
        let s = t === q ? 10 : 6;
        if (ti === 0) s += 4;
        if (ti === qi) s += 1;
        tokenScore = Math.max(tokenScore, s);
      }
      if (!tokenScore) {
        ok = false;
        break;
      }
      score += tokenScore;
    }
    if (!ok) continue;
    // Prefer short, generic names ("Egg, whole, raw" over "Egg, yolk, dried, ...").
    score += Math.max(0, 6 - tokens.length) * 0.5;
    best = Math.max(best, score);
  }
  return best;
}

export function createIndex<T>(items: T[], getTexts: (item: T) => (string | undefined)[]): Indexed<T>[] {
  return items.map((item) => ({
    item,
    texts: getTexts(item)
      .filter((x): x is string => !!x)
      .map(textTokens),
  }));
}

export function searchIndex<T>(index: Indexed<T>[], query: string, limit = 20): T[] {
  const q = textTokens(query);
  if (!q.length) return [];
  const hits: { item: T; score: number; i: number }[] = [];
  index.forEach((entry, i) => {
    const score = matchScore(q, entry.texts);
    if (score > 0) hits.push({ item: entry.item, score, i });
  });
  hits.sort((a, b) => b.score - a.score || a.i - b.i);
  return hits.slice(0, limit).map((h) => h.item);
}

export function searchFoods<T>(
  items: T[],
  query: string,
  getTexts: (item: T) => (string | undefined)[],
  limit = 20,
): T[] {
  return searchIndex(createIndex(items, getTexts), query, limit);
}

let foodsPromise: Promise<FoodItem[]> | null = null;
/** The USDA subset (~1 MB) is only parsed the first time somebody searches. */
export function loadUsdaFoods(): Promise<FoodItem[]> {
  if (!foodsPromise) {
    foodsPromise = import('../data/usda-fdc/foods.json')
      .then((m) => ((m as { default?: unknown }).default ?? m) as FoodItem[])
      .catch((error: unknown) => {
        foodsPromise = null;
        throw error;
      });
  }
  return foodsPromise;
}
