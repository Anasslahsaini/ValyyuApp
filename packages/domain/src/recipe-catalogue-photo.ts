/**
 * Recipe photos from our API (`GET /api/food/photo?q=`, Pexels behind it). Plain fetch, short timeout,
 * one request per dish name per app run. Any failure (offline, no server key, nothing found) = null,
 * and the screen shows its own illustration instead.
 */
export type RecipePhoto = { url: string; thumb: string; alt: string; credit: string; link: string };

const cache = new Map<string, Promise<RecipePhoto | null>>();

/** Search words for a dish: the English name when the catalogue has one (better photo results). */
export const photoQuery = (name: string) =>
  name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

export function parsePhoto(json: unknown): RecipePhoto | null {
  const p = (json as { photo?: unknown } | null)?.photo as Partial<RecipePhoto> | null | undefined;
  if (!p || typeof p.url !== 'string' || !/^https:\/\//.test(p.url)) return null;
  return {
    url: p.url,
    thumb: typeof p.thumb === 'string' && /^https:\/\//.test(p.thumb) ? p.thumb : p.url,
    alt: typeof p.alt === 'string' ? p.alt : '',
    credit: typeof p.credit === 'string' ? p.credit : 'Pexels',
    link: typeof p.link === 'string' ? p.link : 'https://www.pexels.com',
  };
}

export function recipePhoto(
  name: string,
  baseUrl: (path: string) => string,
  fetcher: typeof fetch = fetch,
): Promise<RecipePhoto | null> {
  const q = photoQuery(name);
  if (!q) return Promise.resolve(null);
  let hit = cache.get(q);
  if (!hit) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timer = setTimeout(() => ctrl?.abort(), 6_000);
    hit = fetcher(baseUrl(`/api/food/photo?q=${encodeURIComponent(q)}`), { signal: ctrl?.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then(parsePhoto)
      .catch(() => {
        cache.delete(q);
        return null;
      })
      .finally(() => clearTimeout(timer));
    cache.set(q, hit);
  }
  return hit;
}
