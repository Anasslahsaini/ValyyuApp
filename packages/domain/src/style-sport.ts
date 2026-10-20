import { isAvailable } from './outfit-engine';
import type { WardrobeItem } from './life';

/**
 * Link with Fitness: on a likely training day, name the sport pieces to pack.
 * Pieces are recognised from their name (en + fr), so nothing new has to be tagged.
 */
const SPORTY =
  /(sport|jogg|legging|surv[eê]t|track|gym|running|training|brassi[eè]re|short|sneaker|trainer|basket|sweat(?!er)|maillot)/i;

export const isSporty = (it: WardrobeItem) => SPORTY.test(it.name);

/** One available sporty top, bottom and shoes (whatever exists), or [] when fewer than 2. */
export function sportKit(wardrobe: WardrobeItem[]): WardrobeItem[] {
  const out: WardrobeItem[] = [];
  for (const cat of ['top', 'bottom', 'shoes'] as const) {
    const it = wardrobe.find((w) => w.category === cat && isAvailable(w) && isSporty(w));
    if (it) out.push(it);
  }
  return out.length >= 2 ? out : [];
}

const mondayOf = (key: string) => {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

/**
 * A training day is likely when the user trains (place not "none", sessions per week > 0),
 * has not logged a session today and the weekly target is not reached yet.
 */
export function likelySportDay(o: {
  trainingPlace?: string;
  sessionsPerWeek?: number;
  sessions: { date: string }[];
  today: string;
}): boolean {
  if (!o.trainingPlace || o.trainingPlace === 'none' || !o.sessionsPerWeek) return false;
  if (o.sessions.some((s) => s.date.slice(0, 10) === o.today)) return false;
  const start = mondayOf(o.today);
  const done = o.sessions.filter((s) => {
    const k = s.date.slice(0, 10);
    return k >= start && k <= o.today;
  }).length;
  return done < o.sessionsPerWeek;
}
