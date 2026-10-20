export type Language = 'fr' | 'en' | 'ar';

/** Languages shipped today. English and Arabic are prepared but not enabled yet. */
export const ENABLED_LANGUAGES: readonly Language[] = ['fr'];
const DEFAULT_LANGUAGE: Language = 'fr';

/** Picks the first device language we ship, or French. */
export function resolveLanguage(
  deviceLanguageCodes: readonly (string | null | undefined)[] | undefined,
): Language {
  for (const code of deviceLanguageCodes ?? []) {
    const base = code?.toLowerCase().split(/[-_]/)[0];
    const match = ENABLED_LANGUAGES.find((lang) => lang === base);
    if (match) return match;
  }
  return DEFAULT_LANGUAGE;
}

export function isRtl(lang: Language): boolean {
  return lang === 'ar';
}
