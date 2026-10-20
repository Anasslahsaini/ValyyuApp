/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WardrobeItem } from '../life';
import { suggestOutfit } from '../outfit-engine';
import {
  STYLE_GUIDES,
  STYLE_IDS,
  pickedStyles,
  styleCard,
  styleFormality,
  stylePalette,
  toggleStyle,
} from '../style-guide';
import { colorsGo, scanGarment } from '../style-scan';
import { likelySportDay, sportKit } from '../style-sport';

const item = (
  id: string,
  category: WardrobeItem['category'],
  color: string,
  extra: Partial<WardrobeItem> = {},
): WardrobeItem => ({ id, name: id, category, color, ...extra });

test('Every style has a palette and 3 rules in en, fr and ar', () => {
  for (const id of STYLE_IDS) {
    const g = STYLE_GUIDES[id];
    assert.ok(g.palette.length >= 4 && g.palette.length <= 6);
    assert.equal(g.rules.length, 3);
    for (const r of g.rules)
      for (const l of ['en', 'fr', 'ar'] as const)
        assert.ok(r[l].length > 3 && r[l].length < 70, `${id} ${l}`);
  }
});

test('Style card: unknown ids ignored, 2 styles max, 3 rules, merged palette', () => {
  assert.equal(styleCard([], 'fr'), null);
  assert.equal(styleCard(['nope'], 'fr'), null);
  assert.deepEqual(pickedStyles(['chic', 'nope', 'chic', 'casual', 'street']), ['chic', 'casual']);
  const one = styleCard(['minimal'], 'fr')!;
  assert.equal(one.name, 'Minimaliste');
  assert.equal(one.rules.length, 3);
  const two = styleCard(['casual', 'chic'], 'de')!;
  assert.equal(two.name, 'Casual · Chic');
  assert.equal(two.rules.length, 3);
  assert.equal(two.rules[2], STYLE_GUIDES.chic.rules[0].en);
  assert.ok(two.palette.length <= 6 && two.palette[0] === 'denim');
  assert.deepEqual(stylePalette(undefined), []);
});

test('Style formality and quick-pick toggle', () => {
  assert.equal(styleFormality([]), null);
  assert.equal(styleFormality(['street']), 1);
  assert.equal(styleFormality(['classic']), 2);
  assert.deepEqual(toggleStyle([], 'chic'), ['chic']);
  assert.deepEqual(toggleStyle(['chic', 'casual'], 'street'), ['casual', 'street']);
  assert.deepEqual(toggleStyle(['chic', 'casual'], 'chic'), ['casual']);
});

test('Colour harmony: neutrals go with all, accents only tone-on-tone', () => {
  assert.equal(colorsGo({ color: 'red' }, { color: 'navy' }), true);
  assert.equal(colorsGo({ color: 'red' }, { color: 'green' }), false);
  assert.equal(colorsGo({ color: 'red' }, { color: 'red' }), true);
  assert.equal(colorsGo({ color: 'pink' }, { color: 'yellow' }), false);
});

const wardrobe: WardrobeItem[] = [
  item('tee-white', 'top', 'white'),
  item('tee-black', 'top', 'black'),
  item('jeans', 'bottom', 'denim'),
  item('chino', 'bottom', 'beige'),
  item('sneakers', 'shoes', 'white'),
  item('skirt-green', 'bottom', 'green'),
];

test('Scan: a neutral top that matches everything is green', () => {
  const r = scanGarment({ category: 'top', color: 'grey', wardrobe });
  assert.equal(r.verdict, 'green');
  assert.deepEqual(r.matches.sort(), ['chino', 'jeans', 'skirt-green', 'sneakers']);
  assert.equal(r.inStyle, null);
});

test('Scan: an accent that clashes with every owned accent and no neutral is red', () => {
  const loud = [item('pants-green', 'bottom', 'green'), item('shoes-yellow', 'shoes', 'yellow')];
  const r = scanGarment({ category: 'top', color: 'red', wardrobe: loud });
  assert.equal(r.verdict, 'red');
  assert.equal(r.matches.length, 0);
  assert.ok(r.reasons.includes('clash'));
});

test('Scan: a near-duplicate is flagged; two of them make it red', () => {
  const one = scanGarment({ category: 'top', color: 'white', wardrobe });
  assert.deepEqual(one.duplicates, ['tee-white']);
  assert.equal(one.verdict, 'orange');
  const two = scanGarment({
    category: 'top',
    color: 'white',
    wardrobe: [...wardrobe, item('shirt-white', 'top', 'cream', { colorHex: '#F6F3EC' })],
  });
  assert.equal(two.verdict, 'red');
  assert.ok(two.reasons.includes('duplicate'));
});

test('Scan: filling a missing category is green; style palette is checked', () => {
  const r = scanGarment({ category: 'outerwear', color: 'red', wardrobe, vibes: ['classic'] });
  assert.equal(r.fillsGap, true);
  assert.equal(r.inStyle, false);
  assert.equal(r.verdict, 'orange');
  const ok = scanGarment({ category: 'outerwear', color: 'navy', wardrobe, vibes: ['classic'] });
  assert.equal(ok.verdict, 'green');
  assert.ok(ok.reasons.includes('fillsGap') && ok.reasons.includes('inStyle'));
});

test('Scan: empty wardrobe gives a soft answer, away pieces are ignored', () => {
  assert.equal(scanGarment({ category: 'top', color: 'black', wardrobe: [] }).verdict, 'green');
  assert.deepEqual(scanGarment({ category: 'top', color: 'black', wardrobe: [] }).reasons, ['emptyWardrobe']);
  const away = scanGarment({
    category: 'top',
    color: 'black',
    wardrobe: [item('jeans', 'bottom', 'denim', { status: 'away' })],
  });
  assert.deepEqual(away.reasons, ['emptyWardrobe']);
});

test('Engine: the style palette breaks ties and adds the inStyle reason', () => {
  const w = [
    item('t-red', 'top', 'red'),
    item('t-navy', 'top', 'navy'),
    item('jeans', 'bottom', 'denim'),
    item('sn', 'shoes', 'white'),
  ];
  const s = suggestOutfit({
    wardrobe: w,
    outfits: [],
    date: '2026-10-18',
    palette: stylePalette(['classic']),
  });
  assert.ok(s.itemIds.includes('t-navy'));
  assert.ok(s.reasons.includes('inStyle'));
  assert.ok(!suggestOutfit({ wardrobe: w, outfits: [], date: '2026-10-18' }).reasons.includes('inStyle'));
});

test('Sport day and sport kit', () => {
  const today = '2026-10-21'; // Wednesday
  assert.equal(likelySportDay({ trainingPlace: 'none', sessionsPerWeek: 3, sessions: [], today }), false);
  assert.equal(likelySportDay({ trainingPlace: 'gym', sessionsPerWeek: 3, sessions: [], today }), true);
  assert.equal(
    likelySportDay({ trainingPlace: 'gym', sessionsPerWeek: 3, sessions: [{ date: today }], today }),
    false,
  );
  assert.equal(
    likelySportDay({
      trainingPlace: 'home',
      sessionsPerWeek: 2,
      sessions: [{ date: '2026-10-19' }, { date: '2026-10-20' }],
      today,
    }),
    false,
  );
  assert.equal(
    likelySportDay({
      trainingPlace: 'home',
      sessionsPerWeek: 2,
      sessions: [{ date: '2026-10-17' }, { date: '2026-10-18' }],
      today,
    }),
    true,
  );
  const kit = sportKit([
    item('Jogger noir', 'bottom', 'black'),
    item('Baskets running', 'shoes', 'white'),
    item('Chemise', 'top', 'white'),
    item('Sweater', 'top', 'grey'),
  ]);
  assert.deepEqual(
    kit.map((k) => k.name),
    ['Jogger noir', 'Baskets running'],
  );
  assert.deepEqual(sportKit([item('Jogger', 'bottom', 'black')]), []);
});
