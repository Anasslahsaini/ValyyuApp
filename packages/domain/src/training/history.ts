import { exerciseKey, newestFirst, sameExercise, workSets, type Session, type SetEntry } from './types';

/**
 * Estimated one-rep max, or null when it cannot be estimated sensibly.
 * - 1 rep: the lifted weight.
 * - 2–6 reps: Brzycki (1993), 1RM = w × 36 / (37 − r). More accurate at low reps.
 * - 7–12 reps: Epley (1985), 1RM = w × (1 + r / 30).
 * - Above 12 reps (or no load): no estimate; both formulas drift too far from tested maxima.
 */
export function e1rm(weight: number, reps: number): number | null {
  if (!(weight > 0) || !(reps >= 1) || reps > 12) return null;
  if (reps === 1) return weight;
  if (reps <= 6) return (weight * 36) / (37 - reps);
  return weight * (1 + reps / 30);
}

export type LastPerformance = { sessionId: string; date: string; sets: SetEntry[] };

/** Completed, non-warm-up sets of the most recent session that included this exercise. */
export function lastPerformance(
  name: string,
  sessions: readonly Session[],
  options: { excludeId?: string } = {},
): LastPerformance | null {
  return performances(name, sessions, options)[0] ?? null;
}

/** Every session (newest first) where this exercise had at least one completed work set. */
export function performances(
  name: string,
  sessions: readonly Session[],
  options: { excludeId?: string } = {},
): LastPerformance[] {
  const out: LastPerformance[] = [];
  for (const session of newestFirst(sessions)) {
    if (session.id === options.excludeId) continue;
    const sets = session.exercises.filter((e) => sameExercise(e.name, name)).flatMap(workSets);
    if (sets.length) out.push({ sessionId: session.id, date: session.date, sets });
  }
  return out;
}

export type BestSet = { weight: number; reps: number; date: string; e1rm: number | null };
export type BestSets = { heaviest: BestSet | null; mostReps: BestSet | null; bestE1rm: BestSet | null };

export function bestSets(name: string, sessions: readonly Session[]): BestSets {
  const best: BestSets = { heaviest: null, mostReps: null, bestE1rm: null };
  for (const p of performances(name, sessions).reverse()) {
    for (const s of p.sets) {
      const entry: BestSet = { weight: s.weight, reps: s.reps, date: p.date, e1rm: e1rm(s.weight, s.reps) };
      if (
        !best.heaviest ||
        s.weight > best.heaviest.weight ||
        (s.weight === best.heaviest.weight && s.reps > best.heaviest.reps)
      )
        best.heaviest = entry;
      if (
        !best.mostReps ||
        s.reps > best.mostReps.reps ||
        (s.reps === best.mostReps.reps && s.weight > best.mostReps.weight)
      )
        best.mostReps = entry;
      if (entry.e1rm !== null && (!best.bestE1rm || entry.e1rm > (best.bestE1rm.e1rm ?? 0)))
        best.bestE1rm = entry;
    }
  }
  return best;
}

export type PRFlags = { weightPR: boolean; repPR: boolean; e1rmPR: boolean };

/**
 * Personal records in `session` against earlier `history` (the session itself is ignored if present).
 * A first-ever performance is not a record. Rep PR = more reps than ever at the same or a heavier weight.
 */
export function detectPRs(session: Session, history: readonly Session[]): Record<string, PRFlags> {
  const earlier = history.filter((s) => s.id !== session.id && s.date <= session.date);
  const out: Record<string, PRFlags> = {};
  for (const exercise of session.exercises) {
    const current = workSets(exercise);
    const previous = earlier.flatMap((s) =>
      s.exercises.filter((e) => sameExercise(e.name, exercise.name)).flatMap(workSets),
    );
    const flags: PRFlags = { weightPR: false, repPR: false, e1rmPR: false };
    if (current.length && previous.length) {
      const prevMaxW = Math.max(...previous.map((s) => s.weight));
      const curMaxW = Math.max(...current.map((s) => s.weight));
      flags.weightPR = curMaxW > 0 && curMaxW > prevMaxW;
      flags.repPR = current.some((s) => {
        const comparable = previous.filter((p) => p.weight >= s.weight);
        return comparable.length > 0 && s.reps > Math.max(...comparable.map((p) => p.reps));
      });
      const best = (sets: SetEntry[]) => Math.max(0, ...sets.map((s) => e1rm(s.weight, s.reps) ?? 0));
      const prevE = best(previous);
      flags.e1rmPR = prevE > 0 && best(current) > prevE + 1e-9;
    }
    const key = exercise.name.trim();
    const old = out[key];
    out[key] = old
      ? {
          weightPR: old.weightPR || flags.weightPR,
          repPR: old.repPR || flags.repPR,
          e1rmPR: old.e1rmPR || flags.e1rmPR,
        }
      : flags;
  }
  return out;
}

export const isPR = (f: PRFlags) => f.weightPR || f.repPR || f.e1rmPR;

/** Number of exercises with a PR in each session (same rules as detectPRs), in one chronological pass. */
export function prCountsBySession(sessions: readonly Session[]): Record<string, number> {
  type Best = { maxW: number; bestE: number; repsAt: Map<number, number> };
  const bests = new Map<string, Best>();
  const out: Record<string, number> = {};
  for (const session of [...newestFirst(sessions)].reverse()) {
    const byKey = new Map<string, SetEntry[]>();
    for (const e of session.exercises) {
      const sets = workSets(e);
      if (sets.length) byKey.set(exerciseKey(e.name), [...(byKey.get(exerciseKey(e.name)) ?? []), ...sets]);
    }
    let count = 0;
    for (const [key, sets] of byKey) {
      const b = bests.get(key);
      if (b) {
        const curMaxW = Math.max(...sets.map((s) => s.weight));
        const curE = Math.max(0, ...sets.map((s) => e1rm(s.weight, s.reps) ?? 0));
        const repPR = sets.some((s) => {
          let best = -1;
          for (const [w, r] of b.repsAt) if (w >= s.weight && r > best) best = r;
          return best >= 0 && s.reps > best;
        });
        if ((curMaxW > 0 && curMaxW > b.maxW) || repPR || (b.bestE > 0 && curE > b.bestE + 1e-9)) count += 1;
      }
      const next = b ?? { maxW: 0, bestE: 0, repsAt: new Map<number, number>() };
      for (const s of sets) {
        next.maxW = Math.max(next.maxW, s.weight);
        next.bestE = Math.max(next.bestE, e1rm(s.weight, s.reps) ?? 0);
        next.repsAt.set(s.weight, Math.max(next.repsAt.get(s.weight) ?? 0, s.reps));
      }
      bests.set(key, next);
    }
    out[session.id] = count;
  }
  return out;
}
export const countPRs = (prs: Record<string, PRFlags>) => Object.values(prs).filter(isPR).length;

export type ExerciseProgress = {
  name: string;
  lastDate: string;
  sessions: number;
  bestE1rm: number | null;
  bestWeight: number;
  bestReps: number;
  /** One point per session, oldest first: best e1RM, else heaviest weight, else most reps. */
  trend: { date: string; value: number }[];
};

/** Per-exercise progress for the History "Exercises" list, most recently trained first. */
export function exerciseProgress(sessions: readonly Session[]): ExerciseProgress[] {
  const byKey = new Map<string, ExerciseProgress>();
  for (const session of [...newestFirst(sessions)].reverse()) {
    for (const exercise of session.exercises) {
      const sets = workSets(exercise);
      if (!sets.length) continue;
      const key = exerciseKey(exercise.name);
      const row = byKey.get(key) ?? {
        name: exercise.name.trim(),
        lastDate: session.date,
        sessions: 0,
        bestE1rm: null,
        bestWeight: 0,
        bestReps: 0,
        trend: [],
      };
      const e = Math.max(0, ...sets.map((s) => e1rm(s.weight, s.reps) ?? 0));
      const w = Math.max(...sets.map((s) => s.weight));
      const r = Math.max(...sets.map((s) => s.reps));
      const value = e || w || r;
      const last = row.trend[row.trend.length - 1];
      if (last && last.date === session.date) last.value = Math.max(last.value, value);
      else {
        row.trend.push({ date: session.date, value });
        row.sessions += 1;
      }
      row.name = exercise.name.trim();
      row.lastDate = session.date;
      if (e && e > (row.bestE1rm ?? 0)) row.bestE1rm = e;
      row.bestWeight = Math.max(row.bestWeight, w);
      row.bestReps = Math.max(row.bestReps, r);
      byKey.set(key, row);
    }
  }
  return [...byKey.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

/** "3×10 · 57.5 kg", or "10, 9, 8 · 57.5 kg" when reps differ. Weight omitted for bodyweight. */
export function summarizeSets(sets: readonly Pick<SetEntry, 'reps' | 'weight'>[], unit = 'kg'): string {
  if (!sets.length) return '';
  const reps = sets.map((s) => s.reps);
  const repText = reps.every((r) => r === reps[0]) ? `${sets.length}×${reps[0]}` : reps.join(', ');
  const top = Math.max(...sets.map((s) => s.weight));
  return top > 0 ? `${repText} · ${formatKg(top)} ${unit}` : repText;
}
export const formatKg = (w: number) => String(Math.round(w * 100) / 100);
