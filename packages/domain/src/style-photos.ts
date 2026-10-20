/**
 * Example photos per style (`GET /api/style/photos?style=`, Pexels behind it). One request per
 * style per app run; any failure or a server without key = [] and the card shows its palette only.
 */
export type StylePhoto = { url: string; thumb: string; alt: string; credit: string; link: string };

const cache = new Map<string, Promise<StylePhoto[]>>();

export function parseStylePhotos(json: unknown): StylePhoto[] {
  const list = (json as { photos?: unknown } | null)?.photos;
  if (!Array.isArray(list)) return [];
  return list.flatMap((raw) => {
    const p = raw as Partial<StylePhoto> | null;
    if (!p || typeof p.url !== 'string' || !/^https:\/\//.test(p.url)) return [];
    return [
      {
        url: p.url,
        thumb: typeof p.thumb === 'string' && /^https:\/\//.test(p.thumb) ? p.thumb : p.url,
        alt: typeof p.alt === 'string' ? p.alt : '',
        credit: typeof p.credit === 'string' ? p.credit : 'Pexels',
        link: typeof p.link === 'string' && /^https:\/\//.test(p.link) ? p.link : 'https://www.pexels.com',
      },
    ];
  });
}

export function stylePhotos(
  style: string,
  baseUrl: (path: string) => string,
  fetcher: typeof fetch = fetch,
): Promise<StylePhoto[]> {
  let hit = cache.get(style);
  if (!hit) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timer = setTimeout(() => ctrl?.abort(), 6_000);
    hit = fetcher(baseUrl(`/api/style/photos?style=${encodeURIComponent(style)}`), { signal: ctrl?.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then(parseStylePhotos)
      .catch(() => {
        cache.delete(style);
        return [];
      })
      .finally(() => clearTimeout(timer));
    cache.set(style, hit);
  }
  return hit;
}

/** 3–4 photos for the user's styles, taken in turn from each style (2 styles → 2 + 2). */
export function mixStylePhotos(lists: readonly StylePhoto[][], max = 4): StylePhoto[] {
  const out: StylePhoto[] = [];
  const seen = new Set<string>();
  for (let i = 0; out.length < max && lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const p = l[i];
      if (p && !seen.has(p.url) && out.length < max) {
        seen.add(p.url);
        out.push(p);
      }
    }
  }
  return out;
}
