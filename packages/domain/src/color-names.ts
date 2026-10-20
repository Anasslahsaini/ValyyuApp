import { swatches } from '../constants/swatches';

/**
 * Colour helpers for the wardrobe: hex <-> swatch names, perceptual distance (CIEDE2000)
 * and a neutral/accent split used by the outfit engine. Written in-house, no dependency.
 */
export type RGB = [number, number, number];
export type Lab = [number, number, number];

/** Swatch names offered in the UI (aliases such as "gray" are accepted but not offered). */
export const SWATCH_NAMES = [
  'black',
  'white',
  'grey',
  'navy',
  'blue',
  'denim',
  'beige',
  'cream',
  'brown',
  'tan',
  'green',
  'olive',
  'red',
  'burgundy',
  'pink',
  'purple',
  'yellow',
  'orange',
] as const;
export type SwatchName = (typeof SWATCH_NAMES)[number];

/** Colours that go with anything. Denim and olive behave as neutrals in everyday dressing. */
const NEUTRAL_NAMES = new Set([
  'black',
  'white',
  'grey',
  'gray',
  'navy',
  'beige',
  'cream',
  'brown',
  'tan',
  'denim',
  'olive',
]);
/** Free-text synonyms (en + fr) users commonly type, mapped onto swatch names. */
const ALIASES: Record<string, SwatchName> = {
  gray: 'grey',
  charcoal: 'grey',
  silver: 'grey',
  ivory: 'cream',
  offwhite: 'cream',
  'off-white': 'cream',
  camel: 'tan',
  khaki: 'beige',
  sand: 'beige',
  taupe: 'beige',
  maroon: 'burgundy',
  wine: 'burgundy',
  jeans: 'denim',
  indigo: 'denim',
  teal: 'green',
  mint: 'green',
  lilac: 'purple',
  violet: 'purple',
  mustard: 'yellow',
  gold: 'yellow',
  rust: 'orange',
  coral: 'orange',
  noir: 'black',
  noire: 'black',
  blanc: 'white',
  blanche: 'white',
  gris: 'grey',
  grise: 'grey',
  marine: 'navy',
  bleu: 'blue',
  bleue: 'blue',
  jean: 'denim',
  'beige clair': 'beige',
  crème: 'cream',
  creme: 'cream',
  marron: 'brown',
  brun: 'brown',
  vert: 'green',
  verte: 'green',
  kaki: 'olive',
  rouge: 'red',
  bordeaux: 'burgundy',
  rose: 'pink',
  violette: 'purple',
  jaune: 'yellow',
};

export function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function rgbToHex([r, g, b]: RGB): string {
  return `#${[r, g, b]
    .map((c) =>
      Math.max(0, Math.min(255, Math.round(c)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`.toUpperCase();
}

/** sRGB (D65) -> CIE L*a*b*. */
export function rgbToLab([r, g, b]: RGB): Lab {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r),
    G = lin(g),
    B = lin(b);
  const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const fx = f(x),
    fy = f(y),
    fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 colour difference (Sharma et al. 2005 reference formulation). */
export function deltaE2000([L1, a1, b1]: Lab, [L2, a2, b2]: Lab): number {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1),
    C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1,
    a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1),
    C2p = Math.hypot(a2p, b2);
  const hp = (b: number, a: number) => {
    if (b === 0 && a === 0) return 0;
    const h = Math.atan2(b, a) / rad;
    return h >= 0 ? h : h + 360;
  };
  const h1p = hp(b1, a1p),
    h2p = hp(b2, a2p);
  const dLp = L2 - L1,
    dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lmp = (L1 + L2) / 2,
    Cmp = (C1p + C2p) / 2;
  let hmp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hmp = (h1p + h2p) / 2;
    else hmp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  }
  const Tt =
    1 -
    0.17 * Math.cos((hmp - 30) * rad) +
    0.24 * Math.cos(2 * hmp * rad) +
    0.32 * Math.cos((3 * hmp + 6) * rad) -
    0.2 * Math.cos((4 * hmp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hmp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lmp - 50) ** 2) / Math.sqrt(20 + (Lmp - 50) ** 2);
  const Sc = 1 + 0.045 * Cmp,
    Sh = 1 + 0.015 * Cmp * Tt;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

const swatchLab = SWATCH_NAMES.map((name) => ({ name, lab: rgbToLab(hexToRgb(swatches[name]) as RGB) }));

/** Hex for a swatch name or a known synonym ("Navy", "marine", "charcoal"). */
export function swatchHex(name: string): string | null {
  const n = normalizeColorName(name);
  return n ? swatches[n] : null;
}
/** Maps free text onto a swatch name when we recognise it. */
export function normalizeColorName(text: string): SwatchName | null {
  const k = text.trim().toLowerCase();
  if (!k) return null;
  if ((SWATCH_NAMES as readonly string[]).includes(k)) return k as SwatchName;
  if (ALIASES[k]) return ALIASES[k];
  // "dark navy", "bleu marine": use the last recognised word.
  const words = k.split(/[\s-]+/).reverse();
  for (const w of words) {
    if ((SWATCH_NAMES as readonly string[]).includes(w)) return w as SwatchName;
    if (ALIASES[w]) return ALIASES[w];
  }
  return null;
}

/** Nearest swatch name for a hex colour, by CIEDE2000. */
export function nearestSwatch(hex: string): SwatchName | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return nearestSwatchLab(rgbToLab(rgb));
}
export function nearestSwatchLab(lab: Lab): SwatchName {
  let best: SwatchName = 'grey',
    bestD = Infinity;
  for (const s of swatchLab) {
    const d = deltaE2000(lab, s.lab);
    if (d < bestD) {
      bestD = d;
      best = s.name;
    }
  }
  return best;
}

/** The hex colour that best describes an item: its stored hex, else its colour name. */
export function itemHex(item: { color?: string; colorHex?: string }): string | null {
  if (item.colorHex && hexToRgb(item.colorHex)) return item.colorHex;
  return item.color ? swatchHex(item.color) : null;
}

/**
 * Neutrals combine freely; accents are saturated colours. Unknown colours count as neutral,
 * so a free-text colour never blocks a suggestion.
 */
export function isNeutralColor(item: { color?: string; colorHex?: string }): boolean {
  const named = item.color ? normalizeColorName(item.color) : null;
  if (named) return NEUTRAL_NAMES.has(named);
  const hex = item.colorHex ? hexToRgb(item.colorHex) : null;
  if (!hex) return true;
  const [L, a, b] = rgbToLab(hex);
  const chroma = Math.hypot(a, b);
  return chroma < 22 || L < 18 || NEUTRAL_NAMES.has(nearestSwatchLab([L, a, b]));
}

/**
 * Dominant swatch from RGBA pixels (e.g. a small centre crop of a garment photo).
 * Each pixel votes for its nearest swatch; the result is the most-voted swatch and the
 * average colour of its voters.
 */
export function dominantSwatch(
  pixels: ArrayLike<number>,
  channels = 4,
): { name: SwatchName; hex: string } | null {
  const votes = new Map<SwatchName, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 2 < pixels.length; i += channels) {
    if (channels === 4 && pixels[i + 3] < 128) continue; // transparent
    const rgb: RGB = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const name = nearestSwatchLab(rgbToLab(rgb));
    const v = votes.get(name) ?? { n: 0, r: 0, g: 0, b: 0 };
    v.n += 1;
    v.r += rgb[0];
    v.g += rgb[1];
    v.b += rgb[2];
    votes.set(name, v);
  }
  let best: [SwatchName, { n: number; r: number; g: number; b: number }] | null = null;
  // Stable order: ties go to the earlier swatch in SWATCH_NAMES.
  for (const name of SWATCH_NAMES) {
    const v = votes.get(name);
    if (v && (!best || v.n > best[1].n)) best = [name, v];
  }
  if (!best) return null;
  const [name, v] = best;
  return { name, hex: rgbToHex([v.r / v.n, v.g / v.n, v.b / v.n]) };
}
