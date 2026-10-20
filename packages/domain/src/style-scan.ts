import {
  deltaE2000,
  hexToRgb,
  isNeutralColor,
  itemHex,
  normalizeColorName,
  rgbToLab,
  type RGB,
} from './color-names';
import type { WardrobeItem } from './life';
import { stylePalette } from './style-guide';

/**
 * "Scan before you buy": does this garment go with what the user already owns?
 * Pure and on-device: colour harmony against the wardrobe, category gaps, near-duplicates
 * and the user's style palette. Same input, same verdict.
 */
type Cat = WardrobeItem['category'];
export type ScanVerdict = 'green' | 'orange' | 'red';
export type ScanReason =
  'emptyWardrobe' | 'fillsGap' | 'goesWith' | 'clash' | 'duplicate' | 'inStyle' | 'offStyle';
export type ScanInput = {
  category: Cat;
  color: string;
  colorHex?: string;
  wardrobe: WardrobeItem[];
  vibes?: string[] | null;
};
export type ScanResult = {
  verdict: ScanVerdict;
  /** Ids of owned pieces (other categories) it can be worn with. */
  matches: string[];
  /** Ids of owned pieces of the same category and almost the same colour. */
  duplicates: string[];
  fillsGap: boolean;
  /** null when the user has not picked a style. */
  inStyle: boolean | null;
  reasons: ScanReason[];
};
type Colored = { color?: string; colorHex?: string };

/** Two accents closer than this (CIEDE2000) read as tone-on-tone; closer than DUP as the same colour. */
const TONE = 15;
const DUP = 10;
const CORE: Cat[] = ['top', 'bottom', 'shoes', 'outerwear'];

function distance(a: Colored, b: Colored): number | null {
  const na = a.color ? normalizeColorName(a.color) : null;
  const nb = b.color ? normalizeColorName(b.color) : null;
  if (na && nb && na === nb) return 0;
  const ha = itemHex(a),
    hb = itemHex(b);
  const ra = ha ? hexToRgb(ha) : null,
    rb = hb ? hexToRgb(hb) : null;
  if (!ra || !rb) return null;
  return deltaE2000(rgbToLab(ra as RGB), rgbToLab(rb as RGB));
}

/** Neutrals go with everything; two accents only when tone-on-tone. */
export function colorsGo(a: Colored, b: Colored): boolean {
  if (isNeutralColor(a) || isNeutralColor(b)) return true;
  const d = distance(a, b);
  return d !== null && d < TONE;
}

const sameColor = (a: Colored, b: Colored) => {
  const d = distance(a, b);
  return d !== null && d < DUP;
};

export function scanGarment(input: ScanInput): ScanResult {
  const owned = input.wardrobe.filter((w) => w.status !== 'away');
  const piece: Colored = { color: input.color, colorHex: input.colorHex };
  const others = owned.filter((w) => w.category !== input.category);
  const matches = others.filter((w) => colorsGo(piece, w)).map((w) => w.id);
  const duplicates =
    input.color.trim() || input.colorHex
      ? owned.filter((w) => w.category === input.category && sameColor(piece, w)).map((w) => w.id)
      : [];
  const fillsGap = CORE.includes(input.category) && !owned.some((w) => w.category === input.category);
  const palette = stylePalette(input.vibes);
  const name = normalizeColorName(input.color);
  const inStyle = palette.length ? (!!name && palette.includes(name)) || isNeutralColor(piece) : null;

  const reasons: ScanReason[] = [];
  let verdict: ScanVerdict;
  if (!owned.length) {
    reasons.push('emptyWardrobe');
    verdict = inStyle === false ? 'orange' : 'green';
  } else {
    if (fillsGap) reasons.push('fillsGap');
    reasons.push(others.length && !matches.length ? 'clash' : 'goesWith');
    if (duplicates.length) reasons.push('duplicate');
    const clash = others.length > 0 && matches.length === 0;
    const redundant = duplicates.length >= 2 && !fillsGap;
    const enough = matches.length >= Math.min(3, others.length) || (fillsGap && matches.length >= 1);
    verdict =
      clash || redundant ? 'red' : enough && !duplicates.length && inStyle !== false ? 'green' : 'orange';
  }
  if (inStyle !== null) reasons.push(inStyle ? 'inStyle' : 'offStyle');
  return { verdict, matches, duplicates, fillsGap, inStyle, reasons };
}
