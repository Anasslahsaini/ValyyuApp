import { tKey } from '@workspace/i18n';

export const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealSlot = (typeof SLOTS)[number];
export const SLOT_KEY = {
  breakfast: tKey('today.slot.breakfast'),
  lunch: tKey('today.slot.lunch'),
  dinner: tKey('today.slot.dinner'),
  snack: tKey('today.slot.snack'),
} as const;

/** Local calendar day (YYYY-MM-DD). */
export const localDay = (d: Date = new Date()) =>
  `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dayOf = (m: { date: string }) => m.date.slice(0, 10);

/** "mardi 20 octobre" in the app language. Noon avoids a day shift across time zones. */
export const dayLabel = (day: string, lang: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });

export const number = (n: number, lang: string) =>
  new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(n);
