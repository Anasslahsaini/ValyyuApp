import source from '../data/free-exercise-db/source.json';
export type LanguageCode = 'fr' | 'en' | 'ar' | 'es' | 'pt' | 'de';
import type { CatalogueExercise } from './exercises';

export type TranslationLanguage = Exclude<LanguageCode, 'en'>;
export type PublicExercise = Pick<CatalogueExercise, 'id' | 'name' | 'instructions'>;
const languages: Record<TranslationLanguage, string> = {
  fr: 'French',
  ar: 'Arabic',
  es: 'Spanish',
  pt: 'Portuguese',
  de: 'German',
};
export const translationKey = (exercise: PublicExercise, language: TranslationLanguage) =>
  `${source.revision}:${language}:${exercise.id}`;

/** Only public catalogue text: never profile, workspace, history, photos or voice. */
export function translationRequest(exercise: PublicExercise, language: TranslationLanguage) {
  if (!exercise.instructions.length) throw new Error('No source instructions');
  const message = `Translate these public exercise instructions into ${languages[language]}. Keep the exact step count/order, numeric tokens, units, negation and precautions. Translate only; add no advice or prescriptions and no suggestions. Your reply must be a JSON-encoded array of translated strings, without prose or markdown.\n${exercise.name}\n${JSON.stringify(exercise.instructions)}`;
  if (message.length > 4000) throw new Error('Source exceeds assistant limit');
  return { message, language, area: 'fitness' as const };
}

const numbers = (text: string) => text.match(/\d+(?:[.,/]\d+)*|[¼½¾]/g) ?? [];
const negatives: Record<TranslationLanguage, RegExp> = {
  fr: /(?<!\p{L})(?:pas|jamais|sans|aucun|éviter|évitez)(?!\p{L})|\bn['’]/iu,
  es: /\b(?:no|nunca|sin|evita|evite|evitar)\b/iu,
  pt: /\b(?:não|nunca|sem|evite|evitar)\b/iu,
  de: /\b(?:nicht|niemals|nie|ohne|kein\w*|vermeid\w*)\b/iu,
  ar: /(?:^|[\s،.؛])(?:لا|تجنب|دون|بدون|عدم|ألا|أبدا|أبدًا)(?=$|[\s،.؛])/u,
};
const units = [
  {
    source: /\binches?\b/gi,
    target: {
      fr: /\bpouces?\b/gi,
      es: /\bpulgadas?\b/gi,
      pt: /\bpolegadas?\b/gi,
      de: /\bzoll\b/gi,
      ar: /بوص(?:ة|ات|تين|تان)/g,
    },
  },
  {
    source: /\b(?:pounds?|lbs?)\b/gi,
    target: {
      fr: /\b(?:livres?|lbs?)\b/gi,
      es: /\b(?:libras?|lbs?)\b/gi,
      pt: /\b(?:libras?|lbs?)\b/gi,
      de: /\b(?:pfund|lbs?)\b/gi,
      ar: /(?:رطل|أرطال|باوند|lb)/g,
    },
  },
  {
    source: /\b(?:kg|kilograms?)\b/gi,
    target: {
      fr: /\b(?:kg|kilogrammes?)\b/gi,
      es: /\b(?:kg|kilogramos?)\b/gi,
      pt: /\b(?:kg|quilogramas?)\b/gi,
      de: /\b(?:kg|kilogramm)\b/gi,
      ar: /(?:kg|كغ|كجم|كيلوغرام|كيلوجرام)/g,
    },
  },
  {
    source: /\bseconds\b|\b(?:\d+|a|one)[ -]+second\b/gi,
    target: {
      fr: /\bsecondes?\b/gi,
      es: /\bsegundos?\b/gi,
      pt: /\bsegundos?\b/gi,
      de: /\bsekunden?\b/gi,
      ar: /(?:ثاني[ةه]|ثواني?|ثانيتين|ثانيتان)/g,
    },
  },
  {
    source: /\bminutes?\b/gi,
    target: {
      fr: /\bminutes?\b/gi,
      es: /\bminutos?\b/gi,
      pt: /\bminutos?\b/gi,
      de: /\bminuten?\b/gi,
      ar: /(?:دقيقة|دقائق|دقيقتين|دقيقتان)/g,
    },
  },
  {
    source: /\bdegrees?\b|°/gi,
    target: {
      fr: /(?<!\p{L})degrés?(?!\p{L})|°/giu,
      es: /\bgrados?\b|°/gi,
      pt: /\bgraus?\b|°/gi,
      de: /\bgrad\b|°/gi,
      ar: /(?:درجة|درجات|درجتين|درجتان)|°/g,
    },
  },
  {
    source: /\b(?:cm|centimeters?|centimetres?)\b/gi,
    target: {
      fr: /\bcm\b|(?<!\p{L})centimètres?(?!\p{L})/giu,
      es: /\b(?:cm|centímetros?)\b/gi,
      pt: /\b(?:cm|centímetros?)\b/gi,
      de: /\b(?:cm|zentimeter)\b/gi,
      ar: /(?:cm|سم|سنتيمتر|سنتيمترات)/g,
    },
  },
  {
    source: /\b(?:mm|millimeters?|millimetres?)\b/gi,
    target: {
      fr: /\bmm\b|(?<!\p{L})millimètres?(?!\p{L})/giu,
      es: /\b(?:mm|milímetros?)\b/gi,
      pt: /\b(?:mm|milímetros?)\b/gi,
      de: /\b(?:mm|millimeter)\b/gi,
      ar: /(?:mm|مم|مليمتر|ملليمتر)/g,
    },
  },
  {
    source: /\b(?:meters?|metres?)\b|\b\d+(?:\.\d+)?\s*m\b/gi,
    target: {
      fr: /(?<!\p{L})mètres?(?!\p{L})|\b\d+\s*m\b/giu,
      es: /\bmetros?\b|\b\d+\s*m\b/gi,
      pt: /\bmetros?\b|\b\d+\s*m\b/gi,
      de: /\bmeter\b|\b\d+\s*m\b/gi,
      ar: /(?<!\p{L})(?:ال)?(?:متر|أمتار|مترين)(?!\p{L})|\b\d+\s*m\b/gu,
    },
  },
  {
    source: /\b(?:\d+(?:[./]\d+)?|one|two|three|four|five|six|a)[ -]+(?:foot|feet)\b/gi,
    target: {
      fr: /\bpieds?\b/gi,
      es: /\b(?:pie|pies)\b/gi,
      pt: /(?<!\p{L})pés?(?!\p{L})/giu,
      de: /(?<!\p{L})(?:fuß|füße|fuss|füsse)(?!\p{L})/giu,
      ar: /(?:قدم|أقدام)/g,
    },
  },
] as const;

/** Conservative checks, not a medical certification. Original remains authoritative. */
export function validateTranslation(
  original: readonly string[],
  candidate: unknown,
  language: TranslationLanguage,
): string[] {
  if (!Array.isArray(candidate) || candidate.length !== original.length || !original.length)
    throw new Error('Step count changed');
  if (candidate.every((step, index) => step === original[index])) throw new Error('Not translated');
  if (
    language === 'ar' &&
    !candidate.some((step) => typeof step === 'string' && /[\u0621-\u064A]/.test(step))
  )
    throw new Error('Wrong language');
  return candidate.map((step, index) => {
    if (typeof step !== 'string' || !step.trim() || step.length > 4000) throw new Error('Invalid step');
    const from = original[index];
    if (JSON.stringify(numbers(from)) !== JSON.stringify(numbers(step))) throw new Error('Numbers changed');
    const normalized = step.replace(/[\u064B-\u065F]/g, '');
    if (
      /\b(?:no|not|never|avoid|without|cannot)\b|don['’]t|shouldn['’]t|mustn['’]t|can['’]t/i.test(from) &&
      !negatives[language].test(normalized)
    )
      throw new Error('Precaution lost');
    for (const unit of units) {
      const expected = from.match(unit.source)?.length ?? 0;
      if (expected && (normalized.match(unit.target[language])?.length ?? 0) < expected)
        throw new Error('Unit lost');
    }
    return step.trim();
  });
}

export async function translatePublicExercise(
  exercise: PublicExercise,
  language: TranslationLanguage,
  request: (body: ReturnType<typeof translationRequest>) => Promise<{ reply: string }>,
) {
  const response = await request(translationRequest(exercise, language));
  return validateTranslation(exercise.instructions, JSON.parse(response.reply), language);
}
