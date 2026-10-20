import {
  translationKey,
  validateTranslation,
  type PublicExercise,
  type TranslationLanguage,
} from './exercise-translations';

export interface TranslationStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
}
type Entry = { key: string; original: string; steps: string[] };
const LIMIT = 24;
const MAX_CHARS = 100_000; // Bounded ~200 KB even in UTF-16 browser storage.

/** Public, disposable cache. Never part of LifeState, account sync or backups. */
export function createTranslationCache(storage: TranslationStorage) {
  let queue = Promise.resolve();
  async function read(): Promise<Entry[]> {
    try {
      const raw = await storage.read();
      if (!raw || raw.length > MAX_CHARS) return [];
      const parsed = JSON.parse(raw);
      return parsed?.version === 1 && Array.isArray(parsed.entries)
        ? parsed.entries
            .filter(
              (e: Entry) =>
                e && typeof e.key === 'string' && typeof e.original === 'string' && Array.isArray(e.steps),
            )
            .slice(-LIMIT)
        : [];
    } catch {
      return [];
    }
  }
  return {
    async get(exercise: PublicExercise, language: TranslationLanguage): Promise<string[] | null> {
      await queue;
      const entries = await read();
      const entry = entries.find(
        (e) =>
          e.key === translationKey(exercise, language) &&
          e.original === JSON.stringify(exercise.instructions),
      );
      if (!entry) return null;
      try {
        return validateTranslation(exercise.instructions, entry.steps, language);
      } catch {
        return null;
      }
    },
    async set(
      exercise: PublicExercise,
      language: TranslationLanguage,
      candidate: string[],
    ): Promise<boolean> {
      const steps = validateTranslation(exercise.instructions, candidate, language);
      let saved = false;
      const pending = queue.then(async () => {
        const key = translationKey(exercise, language);
        const entries = (await read()).filter((e) => e.key !== key);
        entries.push({ key, original: JSON.stringify(exercise.instructions), steps });
        while (entries.length > LIMIT || JSON.stringify({ version: 1, entries }).length > MAX_CHARS)
          entries.shift();
        try {
          await storage.write(JSON.stringify({ version: 1, entries }));
          saved = entries.some((e) => e.key === key);
        } catch {
          /* Cache failure never affects personal data or the displayed original. */
        }
      });
      queue = pending.catch(() => {});
      await pending;
      return saved;
    },
  };
}
