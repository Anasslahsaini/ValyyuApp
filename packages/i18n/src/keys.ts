const KEY_PATTERNS = [/\b(?:t|tKey)\(\s*['"]([\w.-]+)['"]/g, /\bi18nKey=["']([\w.-]+)["']/g];
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** Static translation keys used in a source file (dynamic keys are ignored). */
export function extractKeys(source: string): string[] {
  return KEY_PATTERNS.flatMap((pattern) => [...source.matchAll(pattern)].map((m) => m[1] ?? '')).filter(
    Boolean,
  );
}

/** Dot-separated keys of a resource object; plural forms count as one key. */
export function flattenKeys(resource: Record<string, unknown>, prefix = ''): string[] {
  const keys = Object.entries(resource).flatMap(([key, value]) => {
    const path = prefix + key.replace(PLURAL_SUFFIX, '');
    return value !== null && typeof value === 'object'
      ? flattenKeys(value as Record<string, unknown>, `${path}.`)
      : [path];
  });
  return [...new Set(keys)];
}

/** Marks a translation key stored in data, so the key check can find it. Returns the key unchanged. */
export function tKey<K extends string>(key: K): K {
  return key;
}
