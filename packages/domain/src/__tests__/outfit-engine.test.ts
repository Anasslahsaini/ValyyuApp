/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Outfit, WardrobeItem } from '../life';
import {
  dayDistance,
  needsOuterwear,
  planWeek,
  suggestOutfit,
  swapPiece,
  weatherForDate,
} from '../outfit-engine';

const item = (
  id: string,
  category: WardrobeItem['category'],
  color = 'black',
  extra: Partial<WardrobeItem> = {},
): WardrobeItem => ({ id, name: id, category, color, ...extra });
const DATE = '2026-10-15';
const wardrobe: WardrobeItem[] = [
  item('tee-white', 'top', 'white'),
  item('shirt-blue', 'top', 'blue'),
  item('knit-grey', 'top', 'grey', { warmth: 3 }),
  item('jeans', 'bottom', 'denim'),
  item('chino', 'bottom', 'beige'),
  item('skirt-red', 'bottom', 'red'),
  item('sneakers', 'shoes', 'white'),
  item('boots', 'shoes', 'brown', { warmth: 3 }),
  item('coat', 'outerwear', 'navy', { warmth: 3 }),
  item('rain-shell', 'outerwear', 'olive', { warmth: 1 }),
  item('cap', 'accessory', 'black'),
];
const cat = (id: string) => wardrobe.find((w) => w.id === id)?.category;

test('Suggests one top, one bottom and shoes, never accessories, without weather', () => {
  const s = suggestOutfit({ wardrobe, outfits: [], date: DATE });
  assert.deepEqual(s.itemIds.map(cat).sort(), ['bottom', 'shoes', 'top']);
  assert.ok(s.reasons.includes('noWeather'));
  assert.ok(s.slots.top && s.slots.bottom && s.slots.shoes && !s.slots.outerwear);
});

test('Adds outerwear below ~16°C feels-like or when it rains, not when warm and dry', () => {
  assert.equal(needsOuterwear({ feelsLike: 15.9 }), true);
  assert.equal(needsOuterwear({ feelsLike: 22, precipitation: 2 }), true);
  assert.equal(needsOuterwear({ feelsLike: 22, precipitation: 0 }), false);
  const cold = suggestOutfit({ wardrobe, outfits: [], date: DATE, weather: { feelsLike: 4 } });
  assert.equal(cold.slots.outerwear, 'coat', 'the warmest coat on a cold day');
  assert.equal(cold.slots.top, 'knit-grey', 'warmth 3 knit wins when it is cold');
  assert.equal(cold.slots.shoes, 'boots');
  assert.ok(cold.reasons.includes('cold'));
  const warmRain = suggestOutfit({
    wardrobe,
    outfits: [],
    date: DATE,
    weather: { feelsLike: 21, precipitation: 3 },
  });
  assert.equal(warmRain.slots.outerwear, 'rain-shell', 'light shell when warm but wet');
  assert.ok(warmRain.reasons.includes('rain'));
  const hot = suggestOutfit({
    wardrobe,
    outfits: [],
    date: DATE,
    weather: { feelsLike: 28, precipitation: 0 },
  });
  assert.equal(hot.slots.outerwear, undefined);
  assert.notEqual(hot.slots.top, 'knit-grey');
});

test('Never suggests pieces in the laundry or away, nor excluded ones', () => {
  const w = wardrobe.map((x) =>
    x.id === 'tee-white'
      ? { ...x, status: 'laundry' as const }
      : x.id === 'shirt-blue'
        ? { ...x, status: 'away' as const }
        : x,
  );
  for (let seed = 0; seed < 6; seed++) {
    const s = suggestOutfit({ wardrobe: w, outfits: [], date: DATE, seed, exclude: ['jeans'] });
    assert.equal(s.slots.top, 'knit-grey');
    assert.ok(!s.itemIds.includes('jeans'));
  }
});

test('Keeps formality within ±1 of the target, relaxing only when nothing else fits', () => {
  const w = [
    item('suit-shirt', 'top', 'white', { formality: 3 }),
    item('gym-tee', 'top', 'white', { formality: 1 }),
    item('trousers', 'bottom', 'black', { formality: 3 }),
    item('shorts', 'bottom', 'black', { formality: 1 }),
    item('derbies', 'shoes', 'black', { formality: 3 }),
  ];
  const formal = suggestOutfit({ wardrobe: w, outfits: [], date: DATE, formality: 3 });
  assert.deepEqual(
    [formal.slots.top, formal.slots.bottom, formal.slots.shoes],
    ['suit-shirt', 'trousers', 'derbies'],
  );
  for (let seed = 0; seed < 4; seed++) {
    const casual = suggestOutfit({ wardrobe: w, outfits: [], date: DATE, formality: 1, seed });
    assert.equal(casual.slots.top, 'gym-tee', 'formality 3 is out of range for target 1');
    assert.equal(casual.slots.shoes, 'derbies', 'relaxed: the only shoes are still used');
  }
});

test('Penalizes pieces worn in the last days (lastWornAt and outfit wornOn)', () => {
  const fresh = suggestOutfit({ wardrobe, outfits: [], date: DATE });
  const worn: Outfit = {
    id: 'o1',
    name: 'Yesterday',
    itemIds: [fresh.slots.top!, fresh.slots.bottom!],
    wornOn: ['2026-10-14'],
  };
  const next = suggestOutfit({ wardrobe, outfits: [worn], date: DATE });
  assert.notEqual(next.slots.top, fresh.slots.top);
  assert.notEqual(next.slots.bottom, fresh.slots.bottom);
  const w2 = wardrobe.map((x) => (x.id === next.slots.top ? { ...x, lastWornAt: '2026-10-13' } : x));
  const third = suggestOutfit({ wardrobe: w2, outfits: [worn], date: DATE });
  assert.ok(![fresh.slots.top, next.slots.top].includes(third.slots.top));
  // A week later everything is rested again.
  const later = suggestOutfit({ wardrobe, outfits: [worn], date: '2026-10-24' });
  assert.ok(later.reasons.includes('rested'));
});

test('Colour harmony: at most one saturated accent when neutrals are available', () => {
  const w = [
    item('red-top', 'top', 'red', { favorite: true }),
    item('white-top', 'top', 'white'),
    item('green-pants', 'bottom', 'green', { favorite: true }),
    item('black-pants', 'bottom', 'black'),
    item('orange-shoes', 'shoes', 'orange'),
    item('white-shoes', 'shoes', 'white'),
  ];
  for (let seed = 0; seed < 5; seed++) {
    const s = suggestOutfit({ wardrobe: w, outfits: [], date: DATE, seed });
    const accents = s.itemIds.filter((id) => ['red-top', 'green-pants', 'orange-shoes'].includes(id));
    assert.ok(accents.length <= 1, `seed ${seed}: ${s.itemIds.join(',')}`);
  }
  // colorHex without a known name is classified by chroma.
  const hex = [
    item('t', 'top', 'my favourite', { colorHex: '#E0115F' }),
    item('b', 'bottom', 'whatever', { colorHex: '#1F7A1F' }),
    item('b2', 'bottom', 'mystery', { colorHex: '#2B2B2B' }),
    item('s', 'shoes', 'white'),
  ];
  assert.equal(suggestOutfit({ wardrobe: hex, outfits: [], date: DATE }).slots.bottom, 'b2');
});

test('Deterministic: same input, same output; ↻ seed walks to the next-best distinct outfit', () => {
  const a = suggestOutfit({ wardrobe, outfits: [], date: DATE, seed: 0 });
  const b = suggestOutfit({ wardrobe: [...wardrobe].reverse(), outfits: [], date: DATE, seed: 0 });
  assert.deepEqual(a, b, 'independent of wardrobe order');
  const seen = new Set<string>();
  for (let seed = 0; seed < 4; seed++) {
    const s = suggestOutfit({ wardrobe, outfits: [], date: DATE, seed });
    seen.add(`${s.slots.top}|${s.slots.bottom}`);
  }
  assert.equal(seen.size, 4, 'each ↻ changes the top or the bottom');
  const first = suggestOutfit({ wardrobe, outfits: [], date: DATE, seed: 1 });
  assert.ok(first.score <= a.score, 'next-best is not better than best');
});

test('Small wardrobes: missing categories are skipped and reported', () => {
  assert.deepEqual(suggestOutfit({ wardrobe: [], outfits: [], date: DATE }).itemIds, []);
  const s = suggestOutfit({
    wardrobe: [item('only-top', 'top')],
    outfits: [],
    date: DATE,
    weather: { feelsLike: 5 },
  });
  assert.deepEqual(s.itemIds, ['only-top']);
  assert.ok(
    s.reasons.includes('missingBottom') &&
      s.reasons.includes('missingShoes') &&
      s.reasons.includes('missingOuterwear'),
  );
  const one = suggestOutfit({ wardrobe: [item('only-top', 'top')], outfits: [], date: DATE, seed: 7 });
  assert.deepEqual(one.itemIds, ['only-top'], 'any seed works with a single combination');
});

test('swapPiece cycles through the same category and keeps the other pieces', () => {
  const s = suggestOutfit({ wardrobe, outfits: [], date: DATE });
  const seen = new Set([s.slots.top]);
  let cur = s.itemIds;
  for (let i = 0; i < 2; i++) {
    cur = swapPiece({ wardrobe, outfits: [], date: DATE, current: cur }, 'top');
    const top = cur.find((id) => cat(id) === 'top')!;
    assert.ok(!seen.has(top), 'a new top each time');
    seen.add(top);
    assert.equal(cur.length, s.itemIds.length);
    assert.equal(
      cur.find((id) => cat(id) === 'bottom'),
      s.slots.bottom,
    );
  }
  cur = swapPiece({ wardrobe, outfits: [], date: DATE, current: cur }, 'top');
  assert.equal(
    cur.find((id) => cat(id) === 'top'),
    s.slots.top,
    'wraps around after the last top',
  );
  const withLaundry = wardrobe.map((x) =>
    x.category === 'shoes' && x.id !== s.slots.shoes ? { ...x, status: 'laundry' as const } : x,
  );
  assert.deepEqual(
    swapPiece({ wardrobe: withLaundry, outfits: [], date: DATE, current: s.itemIds }, 'shoes'),
    s.itemIds,
    'nothing else to swap to',
  );
  const added = swapPiece({ wardrobe, outfits: [], date: DATE, current: s.itemIds }, 'outerwear');
  assert.equal(added.length, s.itemIds.length + 1);
  assert.equal(cat(added[0]), 'outerwear', 'outerwear is placed first');
});

test('planWeek fills days without repeating a top and spreads wear', () => {
  const days = Array.from({ length: 3 }, (_, i) => ({
    date: `2026-10-${15 + i}`,
    weather: i === 2 ? { feelsLike: 5 } : { feelsLike: 19 },
  }));
  const plan = planWeek({ wardrobe, outfits: [], days });
  assert.equal(plan.length, 3);
  const tops = plan.map((p) => p.suggestion.slots.top);
  assert.equal(new Set(tops).size, 3);
  assert.ok(plan[2].suggestion.slots.outerwear, 'cold day gets outerwear');
  // A fixed (locked) outfit keeps its top out of the new days.
  const fixed: Outfit = { id: 'f', name: 'Locked', itemIds: ['knit-grey', 'jeans'], date: '2026-10-16' };
  const plan2 = planWeek({ wardrobe, outfits: [fixed], days: [days[0], days[2]], fixed: [fixed] });
  assert.ok(plan2.every((p) => p.suggestion.slots.top !== 'knit-grey'));
  // More days than tops: tops repeat instead of leaving days empty.
  const small = [item('t1', 'top'), item('b1', 'bottom'), item('s1', 'shoes')];
  const plan3 = planWeek({
    wardrobe: small,
    outfits: [],
    days: Array.from({ length: 4 }, (_, i) => ({ date: `2026-10-${15 + i}` })),
  });
  assert.equal(plan3.length, 4);
  assert.ok(plan3.slice(1).every((p) => p.suggestion.reasons.includes('reusedTop')));
});

test('weatherForDate prefers the daily forecast, falls back to current for today only', () => {
  const w = {
    apparentTemperature: 12,
    precipitation: 0,
    days: [{ date: '2026-10-16', min: 2, max: 8, precipitation: 4 }],
  };
  assert.deepEqual(weatherForDate(w, DATE, DATE), { feelsLike: 12, precipitation: 0 });
  const tomorrow = weatherForDate(w, '2026-10-16', DATE)!;
  assert.ok(tomorrow.feelsLike > 2 && tomorrow.feelsLike < 8 && tomorrow.rain);
  assert.equal(weatherForDate(w, '2026-10-20', DATE), null);
  assert.equal(weatherForDate(null, DATE, DATE), null);
  assert.equal(dayDistance('2026-10-31', '2026-11-02'), 2);
});
