export const DEFAULT_BAR_KG = 20;
export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

// Work in 0.05 kg units so 1.25 / 2.5 plates never suffer floating-point drift.
const UNIT = 20;
const toU = (kg: number) => Math.round(kg * UNIT);
const toKg = (u: number) => u / UNIT;

function cleanPlates(plates?: readonly number[]) {
  const list = (plates?.length ? plates : DEFAULT_PLATES).filter((p) => p > 0);
  return [...new Set(list.map(toU))].sort((a, b) => b - a);
}

/** Per-side loads (in units) reachable with an unlimited number of each plate, up to `maxU`. */
function reachable(plates: number[], maxU: number) {
  const ok = new Uint8Array(maxU + 1);
  ok[0] = 1;
  for (let v = 1; v <= maxU; v++)
    for (const p of plates)
      if (p <= v && ok[v - p]) {
        ok[v] = 1;
        break;
      }
  return ok;
}

/**
 * Nearest barbell total (bar + identical plates per side) to `target`.
 * `mode` 'up' / 'down' never returns less / more than the target when possible. Never below the bar.
 */
export function roundToPlates(
  target: number,
  barKg = DEFAULT_BAR_KG,
  plates?: readonly number[],
  mode: 'nearest' | 'up' | 'down' = 'nearest',
): number {
  const list = cleanPlates(plates);
  if (!(target > barKg) || !list.length) return barKg;
  const sideU = (toU(target) - toU(barKg)) / 2;
  const maxU = Math.ceil(sideU) + list[0];
  const ok = reachable(list, maxU);
  let below = -1;
  for (let v = Math.floor(sideU); v >= 0; v--)
    if (ok[v]) {
      below = v;
      break;
    }
  let above = -1;
  for (let v = Math.ceil(sideU); v <= maxU; v++)
    if (ok[v]) {
      above = v;
      break;
    }
  let side: number;
  if (mode === 'up') side = above >= 0 ? above : below;
  else if (mode === 'down') side = below >= 0 ? below : above;
  else side = above < 0 || (below >= 0 && sideU - below <= above - sideU) ? below : above;
  return toKg(toU(barKg) + 2 * side);
}

/** Round a non-barbell load (dumbbell, machine, cable) to the smallest plate step. */
export function roundToStep(
  target: number,
  plates?: readonly number[],
  mode: 'nearest' | 'up' | 'down' = 'nearest',
): number {
  const list = cleanPlates(plates);
  const step = list.length ? list[list.length - 1] : toU(1.25);
  const u = toU(Math.max(0, target)) / step;
  const n = mode === 'up' ? Math.ceil(u - 1e-9) : mode === 'down' ? Math.floor(u + 1e-9) : Math.round(u);
  return toKg(n * step);
}

export type PlateLoad = { perSide: number[]; total: number; remainder: number };

/** Plates to put on each side for `total` (largest first). `remainder` is what could not be loaded. */
export function platesPerSide(total: number, barKg = DEFAULT_BAR_KG, plates?: readonly number[]): PlateLoad {
  const list = cleanPlates(plates);
  let sideU = Math.max(0, Math.floor((toU(total) - toU(barKg)) / 2));
  const perSideU: number[] = [];
  // Exact solution via DP when possible (greedy can fail on odd plate sets); fall back to greedy.
  const ok = reachable(list, sideU);
  if (sideU > 0 && ok[sideU]) {
    let v = sideU;
    while (v > 0) {
      const p = list.find((x) => x <= v && ok[v - x])!;
      perSideU.push(p);
      v -= p;
    }
    sideU = 0;
  } else {
    for (const p of list)
      while (sideU >= p) {
        perSideU.push(p);
        sideU -= p;
      }
  }
  perSideU.sort((a, b) => b - a);
  const loaded = toU(barKg) + 2 * perSideU.reduce((a, b) => a + b, 0);
  return {
    perSide: perSideU.map(toKg),
    total: toKg(Math.max(loaded, toU(barKg))),
    remainder: Math.max(0, toKg(toU(total) - loaded)),
  };
}
