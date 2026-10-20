import type { SessionExercise } from './types';

/** What a typed or dictated set-log line means. Deterministic: no AI, no network. */
export type VoiceLog = {
  sets?: number;
  reps?: number;
  weight?: number;
  rir?: number;
  repeat?: boolean;
  delta?: number;
};

const UNITS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
};
const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  vingt: 20,
  vingts: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
  septante: 70,
  huitante: 80,
  octante: 80,
  nonante: 90,
  cent: 100,
};
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const word = (w: string) => (has(UNITS, w) ? UNITS[w] : undefined);
const SMALL = Object.keys(UNITS).filter((k) => UNITS[k] > 0 && UNITS[k] < 10);
const TENS_UNIT = new RegExp(
  `\\b(${Object.keys(TENS)
    .filter((k) => TENS[k] < 100)
    .join('|')})(?:[- ]et)?[- ](${SMALL.join('|')})\\b`,
  'g',
);

/** Lowercase, strip accents, unify decimals and turn number words (en/fr) into digits. */
export function normalizeVoice(text: string): string {
  let s = ` ${text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()} `;
  s = s
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[’']/g, ' ')
    .replace(/[!?;,]/g, ' ')
    .replace(/\.(?!\d)/g, ' ');
  s = s
    .replace(/\bquatre[- ]vingts?[- ]dix\b/g, ' 90 ')
    .replace(/\bquatre[- ]vingts?\b/g, ' 80 ')
    .replace(/\bsoixante[- ]dix\b/g, ' 70 ');
  s = s.replace(/\bsoixante[- ]et[- ]onze\b/g, ' 71 ');
  // tens + unit: "twenty-five", "vingt cinq", "vingt et un"
  s = s.replace(TENS_UNIT, (_m, a: string, b: string) => ` ${TENS[a] + (word(b) ?? 0)} `);
  s = s.replace(/\b[a-z]+\b/g, (w) =>
    has(TENS, w) ? ` ${TENS[w]} ` : word(w) !== undefined ? ` ${word(w)} ` : w,
  );
  // halves: "2 and a half", "2 et demi", "2 point 5", "2 virgule 5"
  s = s.replace(/(\d+)\s+(?:and a half|et demie?)\b/g, (_m, n: string) => ` ${Number(n) + 0.5} `);
  s = s.replace(/(\d+)\s+(?:point|virgule)\s+(\d+)/g, '$1.$2');
  return s.replace(/\s+/g, ' ').trim();
}

const NUM = '(\\d+(?:\\.\\d+)?)';
const KG = '(?:kg|kgs|kilos?|kilogrammes?|kilograms?|kilogramme)';

export function parseVoiceLog(text: string): VoiceLog | null {
  let s = ` ${normalizeVoice(text)} `;
  const out: VoiceLog = {};
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = s.match(re);
    if (m) {
      fn(m);
      s = s.replace(m[0], ' ');
    }
    return !!m;
  };
  take(/\b(?:same(?: again)?|again|repeat|pareil|meme chose|la meme|encore|idem|rebelote)\b/, () => {
    out.repeat = true;
  });
  take(new RegExp(`(?:^|\\s)(plus|\\+|add|ajoute|moins|minus|-)\\s*${NUM}\\s*${KG}?(?=\\s|$)`), (m) => {
    const sign = /moins|minus|-/.test(m[1]) ? -1 : 1;
    out.delta = sign * Number(m[2]);
  });
  // RIR: "2 left", "2 in the tank", "rir 2", "2 en reserve", "il en reste 2"
  take(
    new RegExp(
      `\\b${NUM}\\s*(?:reps?\\s*)?(?:left|in (?:the )?tank|rir|en reserve|de reserve|restantes?)\\b`,
    ),
    (m) => {
      out.rir = Number(m[1]);
    },
  ) ||
    take(new RegExp(`\\b(?:rir|reste|il en reste)\\s*${NUM}\\b`), (m) => {
      out.rir = Number(m[1]);
    });
  // 3x10, 3 × 10, 3*10
  take(/\b(\d+)\s*[x×*]\s*(\d+)\b/, (m) => {
    out.sets = Number(m[1]);
    out.reps = Number(m[2]);
  }) ||
    take(/\b(\d+)\s*(?:sets?|series?|serie|tours?)\s*(?:of|de|x|a|at)?\s*(\d+)\b/, (m) => {
      out.sets = Number(m[1]);
      out.reps = Number(m[2]);
    });
  take(new RegExp(`${NUM}\\s*${KG}\\b`), (m) => {
    out.weight = Number(m[1]);
  }) ||
    take(new RegExp(`(?:\\bat|@|\\ba|\\bavec|\\bwith)\\s*${NUM}\\b`), (m) => {
      out.weight = Number(m[1]);
    });
  if (out.reps === undefined)
    take(/\b(\d+)\s*(?:reps?|repetitions?|fois|rep)\b/, (m) => {
      out.reps = Number(m[1]);
    });
  if (out.sets === undefined)
    take(/\b(\d+)\s*(?:sets?|series?|serie)\b/, (m) => {
      out.sets = Number(m[1]);
    });
  // Leftover bare numbers: "3x10 60" → weight; "10 60" → reps + weight; a lone number → reps (≤ 30) or weight.
  const bare = [...s.matchAll(/(?:^|\s)(\d+(?:\.\d+)?)(?=\s|$)/g)].map((m) => Number(m[1]));
  if (bare.length) {
    if (out.reps !== undefined && out.weight === undefined) out.weight = bare[0];
    else if (out.reps === undefined && out.weight === undefined && bare.length >= 2) {
      out.reps = bare[0];
      out.weight = bare[1];
    } else if (out.reps === undefined && out.weight !== undefined) out.reps = bare[0];
    else if (out.reps === undefined && out.weight === undefined) {
      if (bare[0] <= 30 && Number.isInteger(bare[0])) out.reps = bare[0];
      else out.weight = bare[0];
    }
  }
  // Clamp to the stored schema's limits.
  if (out.sets !== undefined) out.sets = Math.max(1, Math.min(20, Math.round(out.sets)));
  if (out.reps !== undefined) out.reps = Math.max(0, Math.min(100, Math.round(out.reps)));
  if (out.weight !== undefined) out.weight = Math.max(0, Math.min(500, out.weight));
  if (out.rir !== undefined) out.rir = Math.max(0, Math.min(5, Math.round(out.rir)));
  return Object.keys(out).length ? out : null;
}

export type ApplyResult = { exercises: SessionExercise[]; ticked: { exercise: number; set: number }[] };

/**
 * Fill and tick the next unticked sets. The current exercise is the first one with an unticked
 * set (or the last exercise when all are done; extra sets are appended, up to 20).
 * "same again" copies the last ticked set; "plus 2.5" adds to it.
 */
export function applyVoiceLog(exercises: readonly SessionExercise[], log: VoiceLog): ApplyResult {
  const next = exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) }));
  if (!next.length) return { exercises: next, ticked: [] };
  let ei = next.findIndex((e) => e.sets.some((s) => !s.completed));
  if (ei < 0) ei = next.length - 1;
  const ex = next[ei];
  const lastDone =
    [...ex.sets].reverse().find((s) => s.completed) ??
    [...next.slice(0, ei)]
      .reverse()
      .flatMap((e) => [...e.sets].reverse())
      .find((s) => s.completed);
  const ticked: ApplyResult['ticked'] = [];
  const count = log.sets ?? 1;
  for (let k = 0; k < count; k++) {
    let si = ex.sets.findIndex((s) => !s.completed);
    if (si < 0) {
      if (ex.sets.length >= 20) break;
      const template = ex.sets[ex.sets.length - 1] ?? { reps: 10, weight: 0, completed: false };
      ex.sets.push({ ...template, completed: false });
      si = ex.sets.length - 1;
    }
    const set = ex.sets[si];
    const base = (log.repeat || log.delta !== undefined) && lastDone ? lastDone : set;
    set.reps = log.reps ?? base.reps;
    set.weight = Math.max(0, Math.min(500, (log.weight ?? base.weight) + (log.delta ?? 0)));
    if (log.rir !== undefined) set.rir = log.rir;
    else if (log.repeat && lastDone?.rir !== undefined) set.rir = lastDone.rir;
    set.completed = true;
    ticked.push({ exercise: ei, set: si });
  }
  return { exercises: next, ticked };
}
