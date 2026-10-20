/**
 * Barcode lookup through our API server (`GET /api/food/barcode/:ean`), which proxies and caches
 * Open Food Facts (ODbL). Plain fetch, so this does not depend on regenerated API clients.
 */
import { nutrientKeys, type Nutrient } from './nutrition';

export type BarcodeProduct = {
  ean: string;
  name: string;
  brand?: string;
  quantity?: string;
  packGrams?: number;
  /** Values Open Food Facts did not report are 0 here and listed in `unknownNutrients` (never shown as real zeros). */
  per100g: { calories: number; protein: number; carbs: number; fat: number };
  unknownNutrients: Nutrient[];
  servingGrams?: number;
  attribution?: string;
};

/** Same base as lib/api.ts: same-origin on web, the configured API host on native. */
export function apiUrl(path: string, platform: string, host: string | undefined): string {
  if (platform === 'web' || !host) return path;
  const base = host.startsWith('http://') || host.startsWith('https://') ? host : `https://${host}`;
  return `${base.replace(/\/+$/, '')}${path}`;
}

/** GTIN-8/12/13/14 check digit. */
export function isValidBarcode(code: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((a, d, i) => a + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);

/** Validate the server response; anything malformed is treated as "not found". */
export function parseProduct(json: unknown, ean: string): BarcodeProduct | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  if (!o.per100g || typeof o.per100g !== 'object') return null;
  const per = o.per100g as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  const macros = {
    calories: num(per.calories),
    protein: num(per.protein),
    carbs: num(per.carbs),
    fat: num(per.fat),
  };
  if (!name) return null;
  const flagged = Array.isArray(o.unknownNutrients) ? o.unknownNutrients : [];
  const unknownNutrients = nutrientKeys.filter((k) => macros[k] === undefined || flagged.includes(k));
  return {
    ean: typeof o.ean === 'string' && o.ean ? o.ean : ean,
    name: name.slice(0, 160),
    brand: typeof o.brand === 'string' && o.brand.trim() ? o.brand.trim().slice(0, 80) : undefined,
    quantity:
      typeof o.quantity === 'string' && o.quantity.trim() ? o.quantity.trim().slice(0, 60) : undefined,
    packGrams: num(o.packGrams),
    servingGrams: num(o.servingGrams) || undefined,
    per100g: {
      calories: macros.calories ?? 0,
      protein: macros.protein ?? 0,
      carbs: macros.carbs ?? 0,
      fat: macros.fat ?? 0,
    },
    unknownNutrients,
    attribution: typeof o.attribution === 'string' ? o.attribution : undefined,
  };
}

export class BarcodeLookupError extends Error {}

/** Resolves to `null` when the product is unknown; throws BarcodeLookupError when the lookup failed. */
export async function lookupBarcode(
  ean: string,
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<BarcodeProduct | null> {
  let response: Response;
  try {
    response = await fetchImpl(url, { headers: { accept: 'application/json' } });
  } catch {
    throw new BarcodeLookupError('network');
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new BarcodeLookupError(`HTTP ${response.status}`);
  try {
    return parseProduct(await response.json(), ean);
  } catch {
    throw new BarcodeLookupError('parse');
  }
}

/** "Brand Name" for the journal, without repeating the brand. */
export function productLabel(p: Pick<BarcodeProduct, 'name' | 'brand'>): string {
  if (!p.brand || p.name.toLowerCase().includes(p.brand.toLowerCase())) return p.name;
  return `${p.name} · ${p.brand}`.slice(0, 180);
}
