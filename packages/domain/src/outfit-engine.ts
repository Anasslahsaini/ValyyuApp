import { isNeutralColor, normalizeColorName } from './color-names';
import type { Outfit, WardrobeItem } from './life';

/**
 * Deterministic, on-device outfit suggestions. No AI, no network: same inputs, same answer.
 * Higher scores are better. Every rule degrades gracefully on small wardrobes.
 */
export type Slot = WardrobeItem['category'];
export type Level = 1 | 2 | 3;
export type EngineWeather = { feelsLike: number; precipitation?: number; rain?: boolean };
export type Reason =
  | 'cold'
  | 'rain'
  | 'mild'
  | 'warm'
  | 'noWeather'
  | 'rested'
  | 'harmony'
  | 'formality'
  | 'favorite'
  | 'reusedTop'
  | 'inStyle'
  | 'missingTop'
  | 'missingBottom'
  | 'missingShoes'
  | 'missingOuterwear';
export type SuggestInput = {
  wardrobe: WardrobeItem[];
  outfits: Outfit[];
  weather?: EngineWeather | null;
  /** YYYY-MM-DD the outfit is for. */
  date: string;
  /** Target formality; defaults to settings.defaultFormality, else 2. */
  formality?: Level;
  /** Item ids that must not be suggested. */
  exclude?: string[];
  /** 0 = best; ↻ increments it to get the next-best distinct outfit. */
  seed?: number;
  /** Swatch names of the user's style palette; pieces in it get a small bonus. */
  palette?: string[];
};
export type Suggestion = {
  itemIds: string[];
  slots: Partial<Record<Slot, string>>;
  reasons: Reason[];
  score: number;
};

export const OUTERWEAR_BELOW = 16;
export const RAIN_MM = 0.5;
const RECENT_DAYS = 5;
const BASE_SLOTS: Slot[] = ['top', 'bottom', 'shoes'];
const SLOT_ORDER: Slot[] = ['outerwear', 'top', 'bottom', 'shoes', 'accessory'];
const LIMIT: Record<Slot, number> = { top: 6, bottom: 6, shoes: 4, outerwear: 3, accessory: 3 };
const MISSING: Partial<Record<Slot, Reason>> = {
  top: 'missingTop',
  bottom: 'missingBottom',
  shoes: 'missingShoes',
  outerwear: 'missingOuterwear',
};
export const INFERRED_WARMTH: Record<Slot, Level> = {
  top: 2,
  bottom: 2,
  shoes: 2,
  outerwear: 3,
  accessory: 1,
};

export const isAvailable = (item: WardrobeItem) => item.status !== 'laundry' && item.status !== 'away';
export const needsOuterwear = (w?: EngineWeather | null) =>
  !!w && (w.feelsLike < OUTERWEAR_BELOW || isRainy(w));
const isRainy = (w: EngineWeather) => !!w.rain || (w.precipitation ?? 0) >= RAIN_MM;

/** Days between two YYYY-MM-DD keys (absolute, calendar days). */
export function dayDistance(a: string, b: string): number {
  const t = (k: string) => Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)));
  return Math.round(Math.abs(t(a) - t(b)) / 86400000);
}

/** FNV-1a: stable tie-break that does not depend on array order or Math.random. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0xffffffff;
}

/** Every date (other than `date` itself) on which each item was worn or is planned. */
function wearDates(items: WardrobeItem[], outfits: Outfit[], date: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const add = (id: string, d?: string) => {
    if (!d) return;
    const k = d.slice(0, 10);
    if (k === date) return;
    const list = map.get(id) ?? [];
    list.push(k);
    map.set(id, list);
  };
  for (const it of items) add(it.id, it.lastWornAt);
  for (const o of outfits) {
    for (const d of o.wornOn ?? []) for (const id of o.itemIds) add(id, d);
    for (const id of o.itemIds) add(id, o.date);
  }
  return map;
}

function recencyPenalty(dates: string[] | undefined, date: string): number {
  if (!dates?.length) return 0;
  const d = Math.min(...dates.map((x) => dayDistance(x, date)));
  if (d <= 1) return 6;
  if (d <= 3) return 3.5;
  if (d <= RECENT_DAYS) return 1.5;
  return 0;
}

const inPalette = (it: WardrobeItem, palette?: string[]) => {
  if (!palette?.length) return false;
  const n = normalizeColorName(it.color);
  return !!n && palette.includes(n);
};

function idealWarmth(slot: Slot, w?: EngineWeather | null): Level | null {
  if (!w) return null;
  if (slot === 'outerwear') return w.feelsLike < 8 ? 3 : w.feelsLike < OUTERWEAR_BELOW ? 2 : 1;
  return w.feelsLike < 10 ? 3 : w.feelsLike < 20 ? 2 : 1;
}
function seasonFor(w?: EngineWeather | null) {
  if (!w) return null;
  return w.feelsLike >= 22 ? 'summer' : w.feelsLike <= 8 ? 'winter' : null;
}

type Ctx = { input: SuggestInput; target: Level; worn: Map<string, string[]>; exclude: Set<string> };
function context(input: SuggestInput): Ctx {
  return {
    input,
    target: input.formality ?? 2,
    worn: wearDates(input.wardrobe, input.outfits, input.date),
    exclude: new Set(input.exclude ?? []),
  };
}

function itemScore(it: WardrobeItem, ctx: Ctx): number {
  const { input, target } = ctx;
  let s = 10;
  s -= Math.abs((it.formality ?? 2) - target) * 1.5;
  const ideal = idealWarmth(it.category, input.weather);
  if (ideal) s -= Math.abs((it.warmth ?? INFERRED_WARMTH[it.category]) - ideal) * 2;
  const season = seasonFor(input.weather);
  if (season && it.seasons?.length) s += it.seasons.includes(season) ? 0.5 : -1.5;
  s -= recencyPenalty(ctx.worn.get(it.id), input.date);
  if (it.favorite) s += 0.75;
  if (inPalette(it, input.palette)) s += 0.6;
  s -= 0.03 * Math.min(it.wearCount ?? 0, 30);
  return s;
}

/** Eligible items for a slot, best first. Formality ±1 is relaxed only if nothing else fits. */
function candidates(slot: Slot, ctx: Ctx): { item: WardrobeItem; score: number }[] {
  const pool = ctx.input.wardrobe.filter(
    (it) => it.category === slot && isAvailable(it) && !ctx.exclude.has(it.id),
  );
  const strict = pool.filter((it) => Math.abs((it.formality ?? 2) - ctx.target) <= 1);
  return (strict.length ? strict : pool)
    .map((item) => ({ item, score: itemScore(item, ctx) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        hash(`${ctx.input.date}|${a.item.id}`) - hash(`${ctx.input.date}|${b.item.id}`) ||
        a.item.id.localeCompare(b.item.id),
    );
}

/** Whole-outfit adjustments: at most one saturated accent, coherent formality. */
function harmony(items: WardrobeItem[]): number {
  const accents = items.filter((it) => !isNeutralColor(it)).length;
  let s = accents > 1 ? -6 * (accents - 1) : accents === 1 ? 0.5 : 0;
  const f = items.map((it) => it.formality ?? 2);
  if (f.length && Math.max(...f) - Math.min(...f) > 1) s -= 2;
  return s;
}

function slotsFor(w?: EngineWeather | null): Slot[] {
  return needsOuterwear(w) ? ['outerwear', ...BASE_SLOTS] : BASE_SLOTS;
}

function ranked(input: SuggestInput) {
  const ctx = context(input);
  const slots = slotsFor(input.weather);
  const lists = slots
    .map((slot) => ({ slot, list: candidates(slot, ctx).slice(0, LIMIT[slot]) }))
    .filter((x) => x.list.length);
  const combos: {
    picks: { slot: Slot; item: WardrobeItem }[];
    score: number;
    tie: number;
    clash: boolean;
  }[] = [];
  const walk = (i: number, picks: { slot: Slot; item: WardrobeItem }[], score: number) => {
    if (i === lists.length) {
      const items = picks.map((p) => p.item);
      combos.push({
        picks,
        score: score + harmony(items),
        tie: hash(`${input.date}|${items.map((x) => x.id).join(',')}`),
        clash: items.filter((x) => !isNeutralColor(x)).length > 1,
      });
      return;
    }
    for (const c of lists[i].list)
      walk(i + 1, [...picks, { slot: lists[i].slot, item: c.item }], score + c.score);
  };
  if (lists.length) walk(0, [], 0);
  combos.sort((a, b) => b.score - a.score || a.tie - b.tie);
  return { ctx, slots, combos, missing: slots.filter((s) => !lists.some((l) => l.slot === s)) };
}

function explain(input: SuggestInput, picks: WardrobeItem[], missing: Slot[], target: Level): Reason[] {
  const r: Reason[] = [];
  const w = input.weather;
  if (!w) r.push('noWeather');
  else {
    if (w.feelsLike < OUTERWEAR_BELOW) r.push('cold');
    else if (w.feelsLike >= 22) r.push('warm');
    else r.push('mild');
    if (isRainy(w)) r.push('rain');
  }
  const ctx = context(input);
  if (picks.length && picks.every((p) => recencyPenalty(ctx.worn.get(p.id), input.date) === 0))
    r.push('rested');
  if (picks.filter((p) => !isNeutralColor(p)).length <= 1 && picks.length > 1) r.push('harmony');
  if (picks.length && picks.every((p) => Math.abs((p.formality ?? 2) - target) <= 1)) r.push('formality');
  if (picks.some((p) => p.favorite)) r.push('favorite');
  if (picks.length && picks.some((p) => inPalette(p, input.palette))) r.push('inStyle');
  for (const s of missing) {
    const m = MISSING[s];
    if (m) r.push(m);
  }
  return r;
}

const order = (picks: { slot: Slot; item: WardrobeItem }[]) =>
  [...picks].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));

/**
 * Suggests top + bottom + shoes (+ outerwear when it is cold or wet).
 * `seed` walks down the ranking, preferring outfits with a different top or bottom.
 */
export function suggestOutfit(input: SuggestInput): Suggestion {
  const { ctx, combos, missing } = ranked(input);
  if (!combos.length)
    return { itemIds: [], slots: {}, reasons: explain(input, [], missing, ctx.target), score: 0 };
  const distinct: typeof combos = [];
  const seen = new Set<string>();
  // ↻ never lands on a colour clash while a harmonious outfit exists.
  const harmonious = combos.some((c) => !c.clash) ? combos.filter((c) => !c.clash) : combos;
  for (const c of harmonious) {
    const key = c.picks
      .filter((p) => p.slot === 'top' || p.slot === 'bottom')
      .map((p) => p.item.id)
      .join('|');
    if (!seen.has(key)) {
      seen.add(key);
      distinct.push(c);
    }
  }
  const seed = Math.max(0, Math.floor(input.seed ?? 0));
  const pool = distinct.length > 1 ? distinct : harmonious;
  const pick = pool[seed % pool.length];
  const picks = order(pick.picks);
  return {
    itemIds: picks.map((p) => p.item.id),
    slots: Object.fromEntries(picks.map((p) => [p.slot, p.item.id])),
    reasons: explain(
      input,
      picks.map((p) => p.item),
      missing,
      ctx.target,
    ),
    score: pick.score,
  };
}

/**
 * Next best item for `slot`, keeping the other pieces of `current`. Cycles through all
 * eligible items of that category (best first) and wraps around. Returns the new item ids.
 */
export function swapPiece(input: SuggestInput & { current: string[] }, slot: Slot): string[] {
  const byId = new Map(input.wardrobe.map((w) => [w.id, w]));
  const curItems = input.current.map((id) => byId.get(id)).filter(Boolean) as WardrobeItem[];
  const existing = curItems.find((it) => it.category === slot);
  const others = curItems.filter((it) => it !== existing);
  const ctx = context({ ...input, exclude: [...(input.exclude ?? []), ...others.map((o) => o.id)] });
  // Rank without knowing which item is currently in the slot, so cycling is stable.
  const list = input.wardrobe
    .filter((it) => it.category === slot && !ctx.exclude.has(it.id) && isAvailable(it))
    .map((item) => ({ item, score: itemScore(item, ctx) + harmony([...others, item]) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        hash(`${input.date}|${a.item.id}`) - hash(`${input.date}|${b.item.id}`) ||
        a.item.id.localeCompare(b.item.id),
    );
  if (!list.length) return input.current;
  const at = existing ? list.findIndex((c) => c.item.id === existing.id) : -1;
  const next = list[(at + 1) % list.length].item;
  if (existing) return input.current.map((id) => (id === existing.id ? next.id : id));
  const merged = [...curItems, next];
  return order(merged.map((item) => ({ slot: item.category, item }))).map((p) => p.item.id);
}

export type PlanDay = { date: string; weather?: EngineWeather | null };
/**
 * Fills the given days. `fixed` are outfits that stay (locked or already planned); their
 * tops are not repeated. Each new day also counts as worn for the following days.
 */
export function planWeek(
  input: Omit<SuggestInput, 'date' | 'weather' | 'seed'> & { days: PlanDay[]; fixed?: Outfit[] },
): { date: string; suggestion: Suggestion }[] {
  const byId = new Map(input.wardrobe.map((w) => [w.id, w]));
  const tops = new Set<string>();
  const addTops = (ids: string[]) =>
    ids.forEach((id) => {
      if (byId.get(id)?.category === 'top') tops.add(id);
    });
  for (const o of input.fixed ?? []) addTops(o.itemIds);
  const planned: Outfit[] = [];
  const out: { date: string; suggestion: Suggestion }[] = [];
  for (const day of [...input.days].sort((a, b) => a.date.localeCompare(b.date))) {
    const base = {
      ...input,
      outfits: [...input.outfits, ...planned],
      date: day.date,
      weather: day.weather ?? null,
    };
    let suggestion = suggestOutfit({ ...base, exclude: [...(input.exclude ?? []), ...tops] });
    if (!suggestion.slots.top && input.wardrobe.some((w) => w.category === 'top' && isAvailable(w))) {
      // Not enough tops for a full week: allow a repeat rather than an outfit without a top.
      suggestion = suggestOutfit(base);
      suggestion = {
        ...suggestion,
        reasons: [...suggestion.reasons.filter((r) => r !== 'missingTop'), 'reusedTop'],
      };
    }
    if (!suggestion.itemIds.length) continue;
    addTops(suggestion.itemIds);
    planned.push({ id: `plan-${day.date}`, name: '', itemIds: suggestion.itemIds, date: day.date });
    out.push({ date: day.date, suggestion });
  }
  return out;
}

/** Weather for a given day from the API response: daily forecast if present, else current. */
export function weatherForDate(
  w:
    | {
        apparentTemperature: number;
        precipitation: number;
        days?: { date: string; min: number; max: number; precipitation: number }[];
      }
    | null
    | undefined,
  date: string,
  today: string,
): EngineWeather | null {
  if (!w) return null;
  const day = w.days?.find((d) => d.date === date);
  if (day)
    return {
      feelsLike: day.min * 0.35 + day.max * 0.65,
      precipitation: day.precipitation,
      rain: day.precipitation >= 1,
    };
  if (date === today) return { feelsLike: w.apparentTemperature, precipitation: w.precipitation };
  return null;
}
