import { normalizeColorName } from './color-names';
import type { WardrobeItem } from './life';

/** Defaults that remove typing from the wardrobe: piece names, outfit names, category guesses. */
type Cat = WardrobeItem['category'];

export const fill = (template: string, vars: Record<string, string>) =>
  template
    .replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const capital = (s: string) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);

/** "<color> <category>" (order from the localized template); just the category when no colour. */
export function defaultPieceName(o: {
  color: string;
  colorLabel?: string;
  categoryLabel: string;
  template: string;
}): string {
  const color = (o.colorLabel ?? o.color).trim().toLocaleLowerCase();
  if (!color) return capital(o.categoryLabel);
  return capital(fill(o.template, { color, category: o.categoryLabel.toLocaleLowerCase() }));
}

/** "<Weekday> outfit", localized. `date` is YYYY-MM-DD; noon avoids timezone day shifts. */
export function autoOutfitName(date: string, language: string, template: string): string {
  let day: string;
  try {
    day = new Date(`${date}T12:00:00`).toLocaleDateString(language, { weekday: 'long' });
  } catch {
    day = new Date(`${date}T12:00:00`).toLocaleDateString('en', { weekday: 'long' });
  }
  return capital(fill(template, { day }));
}

const KEYWORDS: [Cat, RegExp][] = [
  ['shoes', /(shoe|sneaker|trainer|boot|loafer|sandal|heel|chaussure|basket|botte|mocassin|escarpin)/i],
  ['outerwear', /(jacket|coat|parka|blazer|trench|puffer|anorak|veste|manteau|blouson|doudoune|imper)/i],
  ['bottom', /(jean|pant|trouser|short|skirt|chino|legging|jogger|pantalon|jupe|bermuda)/i],
  [
    'accessory',
    /(bag|belt|hat|cap|scarf|watch|sunglass|sac|ceinture|chapeau|casquette|echarpe|écharpe|montre)/i,
  ],
  [
    'top',
    /(shirt|tee|t-shirt|top|blouse|sweater|hoodie|polo|knit|jumper|cardigan|chemise|pull|sweat|débardeur|tricot)/i,
  ],
];

/**
 * Cheap category guess for a draft: file-name keywords, then strong aspect ratios
 * (very wide = shoes, very tall = bottoms), then the fallback (the active filter).
 */
export function guessCategory(o: {
  fileName?: string | null;
  width?: number;
  height?: number;
  fallback: Cat;
}): Cat {
  const name = o.fileName ?? '';
  for (const [cat, re] of KEYWORDS) if (re.test(name)) return cat;
  if (o.width && o.height) {
    const r = o.height / o.width;
    if (r < 0.75) return 'shoes';
    if (r > 1.75) return 'bottom';
  }
  return o.fallback;
}

/** Colour typed or picked by the user, as a swatch name when we recognise it. */
export const swatchKey = (color: string) => normalizeColorName(color);
