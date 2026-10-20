/**
 * Optional wardrobe tags (warmth, formality, seasons, favourite). Defaults come from the category and the
 * user's default formality, and are only stored once the user taps a chip, so tagging stays optional and
 * later category changes keep using the defaults.
 */
import { INFERRED_WARMTH, type Level } from './outfit-engine';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
export const LEVELS: Level[] = [1, 2, 3];
export type Tags = { warmth?: Level; formality?: Level; seasons?: Season[]; favorite?: boolean };

export const defaultWarmth = (category: keyof typeof INFERRED_WARMTH): Level =>
  INFERRED_WARMTH[category] ?? 2;

/** What the chips show: the stored tag, else the default. */
export function shownTags(tags: Tags, category: keyof typeof INFERRED_WARMTH, defaultFormality: Level = 2) {
  return {
    warmth: tags.warmth ?? defaultWarmth(category),
    formality: tags.formality ?? defaultFormality,
    seasons: tags.seasons ?? [],
    favorite: tags.favorite === true,
  };
}

export const toggleSeason = (seasons: Season[] | undefined, season: Season): Season[] => {
  const current = seasons ?? [];
  return current.includes(season)
    ? current.filter((s) => s !== season)
    : SEASONS.filter((s) => s === season || current.includes(s));
};

/** Only tags the user set are written; untouched ones stay absent (and an empty season list is dropped). */
export function applyTags<T extends object>(record: T, tags: Tags): T {
  const out = { ...record } as Record<string, unknown>;
  if (tags.warmth !== undefined) out.warmth = tags.warmth;
  if (tags.formality !== undefined) out.formality = tags.formality;
  if (tags.seasons !== undefined) {
    if (tags.seasons.length) out.seasons = tags.seasons;
    else delete out.seasons;
  }
  if (tags.favorite !== undefined) {
    if (tags.favorite) out.favorite = true;
    else delete out.favorite;
  }
  return out as T;
}
