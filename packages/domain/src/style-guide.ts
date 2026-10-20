import type { SwatchName } from './color-names';
import type { Level } from './outfit-engine';

/**
 * "La culture du style": for each style the user can pick, a colour palette and three short
 * rules (en, fr, ar; other languages fall back to en). Pure data + tiny helpers, no UI.
 */
export const STYLE_IDS = ['casual', 'chic', 'sporty', 'street', 'classic', 'minimal'] as const;
export type StyleId = (typeof STYLE_IDS)[number];
type Lang3 = 'en' | 'fr' | 'ar';
type Txt = Record<Lang3, string>;

export type StyleGuide = {
  id: StyleId;
  name: Txt;
  palette: SwatchName[];
  formality: Level;
  rules: [Txt, Txt, Txt];
};

export const STYLE_GUIDES: Record<StyleId, StyleGuide> = {
  casual: {
    id: 'casual',
    formality: 1,
    palette: ['denim', 'white', 'grey', 'olive', 'tan'],
    name: { en: 'Casual', fr: 'Décontracté', ar: 'كاجوال' },
    rules: [
      {
        en: 'Jeans + plain tee + clean sneakers: your base.',
        fr: 'Jean + t-shirt uni + baskets propres : ta base.',
        ar: 'جينز + تيشيرت سادة + حذاء رياضي نظيف: هذه قاعدتك.',
      },
      {
        en: 'One bright colour max, the rest neutral.',
        fr: 'Une seule couleur vive, le reste neutre.',
        ar: 'لون قوي واحد فقط، والباقي محايد.',
      },
      {
        en: 'Fit first: right shoulders, nothing sagging.',
        fr: 'La coupe d’abord : épaules justes, rien qui pend.',
        ar: 'المقاس أولًا: كتفان مضبوطان ولا شيء متدلٍّ.',
      },
    ],
  },
  chic: {
    id: 'chic',
    formality: 2,
    palette: ['black', 'cream', 'beige', 'navy', 'burgundy'],
    name: { en: 'Chic', fr: 'Chic', ar: 'أنيق' },
    rules: [
      {
        en: 'Tone on tone: cream, beige, black.',
        fr: 'Ton sur ton : crème, beige, noir.',
        ar: 'درجات متقاربة: كريمي، بيج، أسود.',
      },
      {
        en: 'One quality piece lifts the whole look.',
        fr: 'Une pièce de qualité élève toute la tenue.',
        ar: 'قطعة واحدة جيدة ترفع الإطلالة كلها.',
      },
      {
        en: 'Leather shoes or neat loafers, never worn-out sneakers.',
        fr: 'Cuir ou mocassins nets, jamais de baskets usées.',
        ar: 'حذاء جلدي أو موكاسان أنيق، لا أحذية رياضية بالية.',
      },
    ],
  },
  sporty: {
    id: 'sporty',
    formality: 1,
    palette: ['black', 'white', 'grey', 'navy', 'red'],
    name: { en: 'Sporty', fr: 'Sport', ar: 'رياضي' },
    rules: [
      {
        en: 'Sport pieces + one city piece (jacket, jeans).',
        fr: 'Pièces sport + une pièce de ville (veste, jean).',
        ar: 'قطع رياضية + قطعة واحدة للمدينة (جاكيت أو جينز).',
      },
      {
        en: 'Same colours on top and bottom.',
        fr: 'Mêmes couleurs en haut et en bas.',
        ar: 'نفس الألوان في الأعلى والأسفل.',
      },
      {
        en: 'Clean sneakers make the outfit.',
        fr: 'Des baskets propres font la tenue.',
        ar: 'حذاء رياضي نظيف يصنع الإطلالة.',
      },
    ],
  },
  street: {
    id: 'street',
    formality: 1,
    palette: ['black', 'white', 'olive', 'grey', 'orange'],
    name: { en: 'Streetwear', fr: 'Streetwear', ar: 'ستريت' },
    rules: [
      {
        en: 'Play with volume: loose top, straight bottom.',
        fr: 'Joue les volumes : haut ample, bas droit.',
        ar: 'العب بالأحجام: قطعة علوية واسعة وبنطال مستقيم.',
      },
      {
        en: 'Sneakers are the star: build around them.',
        fr: 'Les baskets sont la star : construis autour.',
        ar: 'الحذاء الرياضي هو النجم: ابنِ الإطلالة حوله.',
      },
      {
        en: 'One graphic piece at a time.',
        fr: 'Une seule pièce graphique à la fois.',
        ar: 'قطعة واحدة بطبعة في كل مرة.',
      },
    ],
  },
  classic: {
    id: 'classic',
    formality: 2,
    palette: ['navy', 'white', 'beige', 'brown', 'burgundy'],
    name: { en: 'Classic', fr: 'Classique', ar: 'كلاسيكي' },
    rules: [
      {
        en: 'Navy, white, beige always go together.',
        fr: 'Marine, blanc, beige vont toujours ensemble.',
        ar: 'الكحلي والأبيض والبيج يتناسقون دائمًا.',
      },
      {
        en: 'Belt and shoes in the same colour.',
        fr: 'Ceinture et chaussures de la même couleur.',
        ar: 'الحزام والحذاء بنفس اللون.',
      },
      {
        en: 'Tucked shirt, straight trousers, clean lines.',
        fr: 'Chemise rentrée, pantalon droit, lignes nettes.',
        ar: 'قميص مدسوس، بنطال مستقيم، خطوط نظيفة.',
      },
    ],
  },
  minimal: {
    id: 'minimal',
    formality: 2,
    palette: ['black', 'white', 'grey', 'beige', 'cream'],
    name: { en: 'Minimal', fr: 'Minimaliste', ar: 'بسيط' },
    rules: [
      {
        en: '3 colours max per outfit.',
        fr: '3 couleurs max par tenue.',
        ar: '3 ألوان كحد أقصى في الإطلالة.',
      },
      { en: 'No logos, plain fabrics.', fr: 'Pas de logos, matières unies.', ar: 'بدون شعارات، أقمشة سادة.' },
      {
        en: 'Fewer pieces, all of them matching.',
        fr: 'Moins de pièces, qui vont toutes ensemble.',
        ar: 'قطع أقل، وكلها تتناسق معًا.',
      },
    ],
  },
};

export const isStyleId = (x: string): x is StyleId => (STYLE_IDS as readonly string[]).includes(x);
/** Known style ids from settings.styleVibes, in order, at most 2. */
export const pickedStyles = (vibes?: string[] | null): StyleId[] =>
  Array.from(new Set((vibes ?? []).filter(isStyleId))).slice(0, 2);

const lang3 = (lang: string): Lang3 => (lang === 'fr' || lang === 'ar' ? lang : 'en');

/** Union of the palettes (primary style first), at most 6 swatches. */
export function stylePalette(vibes?: string[] | null): SwatchName[] {
  const out: SwatchName[] = [];
  for (const id of pickedStyles(vibes))
    for (const c of STYLE_GUIDES[id].palette) if (!out.includes(c)) out.push(c);
  return out.slice(0, 6);
}

/** Default formality for the outfit engine: the rounded mean of the picked styles, else null. */
export function styleFormality(vibes?: string[] | null): Level | null {
  const ids = pickedStyles(vibes);
  if (!ids.length) return null;
  return Math.round(ids.reduce((s, id) => s + STYLE_GUIDES[id].formality, 0) / ids.length) as Level;
}

/** What the "Your style" card shows: names, palette and 3 rules (2 from the main style + 1 from the second). */
export function styleCard(
  vibes: string[] | null | undefined,
  lang: string,
): { ids: StyleId[]; name: string; palette: SwatchName[]; rules: string[] } | null {
  const ids = pickedStyles(vibes);
  if (!ids.length) return null;
  const l = lang3(lang);
  const [a, b] = ids.map((id) => STYLE_GUIDES[id]);
  const rules = b ? [a.rules[0], a.rules[1], b.rules[0]] : a.rules;
  return {
    ids,
    name: ids.map((id) => STYLE_GUIDES[id].name[l]).join(' · '),
    palette: stylePalette(ids),
    rules: rules.map((r) => r[l]),
  };
}

export const styleName = (id: StyleId, lang: string) => STYLE_GUIDES[id].name[lang3(lang)];

/** Tapping a style in the quick pick: toggle, keeping at most 2 (the oldest drops out). */
export function toggleStyle(current: StyleId[], id: StyleId): StyleId[] {
  if (current.includes(id)) return current.filter((x) => x !== id);
  return [...current, id].slice(-2);
}
