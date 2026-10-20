/**
 * Text normalisation and number parsing for voice commands.
 * Pure and offline. Number vocabularies are per language so more languages can be added.
 */

/** Lowercase, strip accents, unify apostrophes/hyphens, drop punctuation except decimal separators and commas. */
export function fold(input: string): string {
  return input
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`´]/g, ' ')
    .replace(/[-–—_]/g, ' ')
    .replace(/[!?;:"«»()]/g, ' ')
    .replace(/\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type Vocab = {
  units: Record<string, number>;
  tens: Record<string, number>;
  hundred: string[];
  thousand: string[];
  fractions: Record<string, number>;
  joiners: string[];
};

const en: Vocab = {
  units: {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    dozen: 12,
  },
  tens: { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 },
  hundred: ['hundred'],
  thousand: ['thousand'],
  fractions: { half: 0.5 },
  joiners: ['and'],
};
const fr: Vocab = {
  units: {
    zero: 0,
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
    sept: 7,
    huit: 8,
    neuf: 9,
    dix: 10,
    onze: 11,
    douze: 12,
    treize: 13,
    quatorze: 14,
    quinze: 15,
    seize: 16,
    douzaine: 12,
  },
  tens: { vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60 },
  hundred: ['cent', 'cents'],
  thousand: ['mille'],
  fractions: { demi: 0.5, demie: 0.5 },
  joiners: ['et'],
};
const vocabs: Vocab[] = [en, fr];

const lookup = (key: 'units' | 'tens' | 'fractions', w: string) => {
  for (const v of vocabs) if (Object.prototype.hasOwnProperty.call(v[key], w)) return v[key][w];
  return undefined;
};
const isHundred = (w: string) => vocabs.some((v) => v.hundred.includes(w));
const isThousand = (w: string) => vocabs.some((v) => v.thousand.includes(w));
const isJoiner = (w: string) => vocabs.some((v) => v.joiners.includes(w));
const isNumberWord = (w: string) =>
  lookup('units', w) !== undefined ||
  lookup('tens', w) !== undefined ||
  lookup('fractions', w) !== undefined ||
  isHundred(w) ||
  isThousand(w);

/** Parse a run of number words (folded), e.g. ["quatre","vingt","dix"] -> 90, or null. */
function parseRun(words: string[]): number | null {
  let total = 0,
    current = 0,
    any = false;
  for (const w of words) {
    if (isJoiner(w)) continue;
    const u = lookup('units', w),
      t = lookup('tens', w),
      f = lookup('fractions', w);
    if (u !== undefined) {
      if (w === 'douzaine' || w === 'dozen') current = (current || 1) * 12;
      else current += u;
      any = true;
    } else if (t !== undefined) {
      if (t === 20 && current === 4) current = 80;
      else current += t; // French "quatre vingt"
      any = true;
    } else if (isHundred(w)) {
      current = (current || 1) * 100;
      any = true;
    } else if (isThousand(w)) {
      total += (current || 1) * 1000;
      current = 0;
      any = true;
    } else if (f !== undefined) {
      current += f;
      any = true;
    } else return null;
  }
  return any ? total + current : null;
}

/**
 * Replace number words by digits in an already folded string:
 * "deux oeufs et une banane" -> "2 oeufs et 1 banane", "quatre vingt dix" -> "90", "deux et demi" -> "2.5".
 * "un peu" is left alone.
 */
export function normalizeNumbers(folded: string): string {
  const words = folded
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\ba couple of\b/g, '2')
    .replace(/\b(?:une? )?demie? heure\b|\bhalf an? hour\b/g, '30 minutes')
    .replace(/\band a half\b/g, 'and half')
    .replace(/\bune? demie?\b/g, 'demi')
    .split(' ');
  const out: string[] = [];
  const numberAt = (k: number) =>
    k < words.length && isNumberWord(words[k]) && !(words[k] === 'un' && words[k + 1] === 'peu');
  for (let i = 0; i < words.length;) {
    if (!numberAt(i)) {
      out.push(words[i]);
      i++;
      continue;
    }
    let j = i;
    const run: string[] = [];
    while (j < words.length) {
      if (numberAt(j)) {
        run.push(words[j]);
        j++;
        continue;
      }
      // "vingt et un", "deux et demi": a joiner counts only when a number word follows.
      if (isJoiner(words[j]) && run.length && numberAt(j + 1)) {
        run.push(words[j]);
        j++;
        continue;
      }
      break;
    }
    const value = parseRun(run);
    if (value === null) {
      out.push(words[i]);
      i++;
      continue;
    }
    const prev = out.length ? out[out.length - 1] : '';
    if (value === 0.5 && /^\d+(\.\d+)?$/.test(prev)) out[out.length - 1] = String(Number(prev) + 0.5);
    else out.push(String(value));
    i = j;
  }
  return out.join(' ');
}

/** Fold + number normalisation: the canonical form the intent parser matches against. */
export function canonical(input: string): string {
  return normalizeNumbers(fold(input));
}

/** First number in a text, written as digits (comma or dot decimals) or words. */
export function parseNumber(input: string): number | null {
  const m = canonical(input).match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}
