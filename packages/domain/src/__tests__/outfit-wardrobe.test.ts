/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deflateSync } from 'node:zlib';
import type { Outfit, WardrobeItem } from '../life';
import {
  deltaE2000,
  dominantSwatch,
  hexToRgb,
  isNeutralColor,
  nearestSwatch,
  normalizeColorName,
  rgbToHex,
  rgbToLab,
  swatchHex,
} from '../color-names';
import { base64ToBytes, decodePng } from '../png-pixels';
import { allClean, bumpWear, piecesToBump, toggleLaundry, wornOutfit } from '../wear';
import { autoOutfitName, defaultPieceName, guessCategory } from '../wardrobe-drafts';

test('hex <-> rgb round trip and Lab of white/black', () => {
  assert.deepEqual(hexToRgb('#3E64B3'), [62, 100, 179]);
  assert.equal(rgbToHex([62, 100, 179]), '#3E64B3');
  assert.equal(hexToRgb('nope'), null);
  const [L] = rgbToLab([255, 255, 255]);
  assert.ok(Math.abs(L - 100) < 0.01);
  assert.ok(Math.abs(rgbToLab([0, 0, 0])[0]) < 0.01);
});

test('CIEDE2000 matches the Sharma reference pairs', () => {
  // Pairs 1 and 7 of Sharma, Wu & Dalal (2005), expected 2.0425 and 0.0000... and pair 17 (27.1492).
  assert.ok(Math.abs(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485]) - 2.0425) < 1e-4);
  assert.ok(Math.abs(deltaE2000([50, 0, 0], [50, -1, 2]) - 2.3669) < 1e-4);
  assert.ok(Math.abs(deltaE2000([50, 2.5, 0], [73, 25, -18]) - 27.1492) < 1e-4);
  assert.equal(deltaE2000([40, 10, 10], [40, 10, 10]), 0);
});

test('Nearest swatch and colour-name normalisation (en + fr)', () => {
  assert.equal(nearestSwatch('#000000'), 'black');
  assert.equal(nearestSwatch('#FFFFFF'), 'white');
  assert.equal(nearestSwatch('#1C2A4F'), 'navy');
  assert.equal(nearestSwatch('#C0392B'), 'red');
  assert.equal(normalizeColorName('Bleu marine'), 'navy');
  assert.equal(normalizeColorName('dark NAVY'), 'navy');
  assert.equal(normalizeColorName('gray'), 'grey');
  assert.equal(normalizeColorName('?'), null);
  assert.equal(swatchHex('noir'), '#22201F');
});

test('Neutrals vs accents', () => {
  assert.ok(isNeutralColor({ color: 'navy' }));
  assert.ok(isNeutralColor({ color: 'denim' }));
  assert.ok(!isNeutralColor({ color: 'red' }));
  assert.ok(isNeutralColor({ color: 'something odd' }), 'unknown counts as neutral');
  assert.ok(!isNeutralColor({ color: '', colorHex: '#E0115F' }));
  assert.ok(isNeutralColor({ color: '', colorHex: '#808080' }));
});

function png(width: number, height: number, rgb: number[][], filter = 0): Uint8Array {
  const crc = (buf: Buffer) => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rows: number[] = [];
  for (let y = 0; y < height; y++) {
    rows.push(filter);
    for (let x = 0; x < width; x++) {
      const px = rgb[y * width + x];
      for (let ch = 0; ch < 3; ch++) {
        // Filter 1 (Sub): store the difference to the pixel on the left.
        const left = filter === 1 && x > 0 ? rgb[y * width + x - 1][ch] : 0;
        rows.push((px[ch] - left + 256) & 255);
      }
    }
  }
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(Buffer.from(rows))),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

test('Decodes a tiny PNG (with filters) and finds the dominant swatch', () => {
  const pixels = [
    [30, 45, 85],
    [32, 44, 80],
    [28, 40, 82],
    [250, 250, 250],
  ];
  for (const filter of [0, 1]) {
    const { width, height, rgba } = decodePng(png(2, 2, pixels, filter));
    assert.equal(width, 2);
    assert.equal(height, 2);
    assert.deepEqual([...rgba.slice(0, 4)], [30, 45, 85, 255]);
    assert.deepEqual([...rgba.slice(12, 16)], [250, 250, 250, 255]);
    assert.equal(dominantSwatch(rgba)?.name, 'navy');
  }
  const b64 = Buffer.from(png(1, 1, [[200, 40, 40]])).toString('base64');
  assert.deepEqual([...base64ToBytes(`data:image/png;base64,${b64}`)], [...png(1, 1, [[200, 40, 40]])]);
  assert.throws(() => decodePng(new Uint8Array([1, 2, 3])));
  assert.equal(dominantSwatch([]), null);
});

const it = (id: string, extra: Partial<WardrobeItem> = {}): WardrobeItem => ({
  id,
  name: id,
  category: 'top',
  color: 'black',
  ...extra,
});

test('Wearing bumps wearCount and lastWornAt, never backwards and never twice a day', () => {
  const [a, b] = bumpWear([it('a'), it('b', { wearCount: 4, lastWornAt: '2026-10-20' })], '2026-10-15');
  assert.equal(a.wearCount, 1);
  assert.equal(a.lastWornAt, '2026-10-15');
  assert.equal(b.wearCount, 5);
  assert.equal(b.lastWornAt, '2026-10-20');
  const fresh = wornOutfit({ id: 'n', name: 'Thursday outfit', itemIds: ['a', 'b'], date: '2026-10-15' });
  assert.deepEqual(fresh, {
    id: 'n',
    name: 'Thursday outfit',
    source: 'auto',
    itemIds: ['a', 'b'],
    date: '2026-10-15',
    wornOn: ['2026-10-15'],
  });
  const planned: Outfit = {
    id: 'p',
    name: 'Office',
    itemIds: ['a'],
    date: '2026-10-15',
    notes: 'meeting',
    source: 'manual',
    wornOn: ['2026-10-01'],
  };
  const worn = wornOutfit({
    existing: planned,
    id: 'ignored',
    name: 'x',
    itemIds: ['a', 'c'],
    date: '2026-10-15',
  });
  assert.equal(worn.id, 'p');
  assert.equal(worn.name, 'Office');
  assert.equal(worn.notes, 'meeting');
  assert.equal(worn.source, 'manual');
  assert.deepEqual(worn.wornOn, ['2026-10-01', '2026-10-15']);
  assert.deepEqual(piecesToBump(planned, ['a', 'c'], '2026-10-15'), ['a', 'c']);
  assert.deepEqual(piecesToBump(worn, ['a', 'c', 'd'], '2026-10-15'), ['d']);
});

test('Laundry toggle and all clean', () => {
  assert.equal(toggleLaundry(it('a')).status, 'laundry');
  assert.equal(toggleLaundry(it('a', { status: 'laundry' })).status, 'clean');
  const changed = allClean([it('a', { status: 'laundry' }), it('b'), it('c', { status: 'away' })]);
  assert.deepEqual(
    changed.map((x) => [x.id, x.status]),
    [['a', 'clean']],
  );
});

test('Default names and category guesses', () => {
  assert.equal(
    defaultPieceName({ color: 'navy', categoryLabel: 'Top', template: '{color} {category}' }),
    'Navy top',
  );
  assert.equal(
    defaultPieceName({
      color: 'navy',
      colorLabel: 'marine',
      categoryLabel: 'Haut',
      template: '{category} {color}',
    }),
    'Haut marine',
  );
  assert.equal(
    defaultPieceName({ color: '', categoryLabel: 'shoes', template: '{color} {category}' }),
    'Shoes',
  );
  assert.equal(autoOutfitName('2026-10-15', 'en', '{day} outfit'), 'Thursday outfit');
  assert.equal(autoOutfitName('2026-10-15', 'fr', 'Tenue du {day}'), 'Tenue du jeudi');
  assert.equal(guessCategory({ fileName: 'IMG_white-sneakers.jpg', fallback: 'top' }), 'shoes');
  assert.equal(guessCategory({ fileName: 'mon-jean.png', fallback: 'top' }), 'bottom');
  assert.equal(
    guessCategory({ fileName: 'IMG_0001.jpg', width: 3000, height: 4000, fallback: 'accessory' }),
    'accessory',
  );
  assert.equal(guessCategory({ fileName: null, width: 1200, height: 600, fallback: 'top' }), 'shoes');
});
