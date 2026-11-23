import { COLS, ROWS, HIDDEN, GARBAGE, CELLS } from './constants';

// Puyo-style scoring tables
const CHAIN_POWER = [0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512, 544, 576, 608, 640, 672];
const COLOR_BONUS = [0, 0, 3, 6, 12, 24];
const GROUP_BONUS = [0, 0, 0, 0, 0, 2, 3, 4, 5, 6, 7];

export const GARBAGE_DIVISOR = 70;

export function stepMultiplier(chain: number, groupSizes: number[], colorCount: number): number {
  const cp = CHAIN_POWER[Math.min(chain - 1, CHAIN_POWER.length - 1)];
  let m = cp + COLOR_BONUS[Math.min(colorCount, 5)];
  for (const s of groupSizes) m += s >= 11 ? 10 : GROUP_BONUS[s] || 0;
  return Math.max(1, Math.min(999, m));
}

export interface Match {
  groups: number[][];
  garbage: number[];
}

const seenBuf = new Uint8Array(CELLS);
const stackBuf: number[] = [];

/** Finds groups of >= 4 same-colored blobs in the visible area, plus garbage touching them. */
export function findMatches(cols: Uint8Array): Match | null {
  seenBuf.fill(0);
  const groups: number[][] = [];
  const stack = stackBuf;
  for (let i = HIDDEN * COLS; i < CELLS; i++) {
    const c = cols[i];
    if (c === 0 || c === GARBAGE || seenBuf[i]) continue;
    const grp: number[] = [i];
    seenBuf[i] = 1;
    stack.length = 0;
    stack.push(i);
    while (stack.length) {
      const k = stack.pop()!;
      const r = (k / COLS) | 0;
      const x = k - r * COLS;
      let n: number;
      if (x > 0) {
        n = k - 1;
        if (!seenBuf[n] && cols[n] === c) { seenBuf[n] = 1; grp.push(n); stack.push(n); }
      }
      if (x < COLS - 1) {
        n = k + 1;
        if (!seenBuf[n] && cols[n] === c) { seenBuf[n] = 1; grp.push(n); stack.push(n); }
      }
      if (r > HIDDEN) {
        n = k - COLS;
        if (!seenBuf[n] && cols[n] === c) { seenBuf[n] = 1; grp.push(n); stack.push(n); }
      }
      if (r < ROWS - 1) {
        n = k + COLS;
        if (!seenBuf[n] && cols[n] === c) { seenBuf[n] = 1; grp.push(n); stack.push(n); }
      }
    }
    if (grp.length >= 4) groups.push(grp);
  }
  if (!groups.length) return null;

  const garbage: number[] = [];
  const gseen = new Set<number>();
  const check = (n: number) => {
    if (cols[n] === GARBAGE && !gseen.has(n)) {
      gseen.add(n);
      garbage.push(n);
    }
  };
  for (const grp of groups) {
    for (const k of grp) {
      const r = (k / COLS) | 0;
      const x = k - r * COLS;
      if (x > 0) check(k - 1);
      if (x < COLS - 1) check(k + 1);
      if (r > HIDDEN) check(k - COLS);
      if (r < ROWS - 1) check(k + COLS);
    }
  }
  return { groups, garbage };
}

export function settleCols(cols: Uint8Array): void {
  for (let x = 0; x < COLS; x++) {
    let w = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      const v = cols[r * COLS + x];
      if (v) {
        if (r !== w) {
          cols[w * COLS + x] = v;
          cols[r * COLS + x] = 0;
        }
        w--;
      }
    }
  }
}

export function colHeight(cols: Uint8Array, x: number): number {
  for (let r = 0; r < ROWS; r++) if (cols[r * COLS + x]) return ROWS - r;
  return 0;
}

function popcount(n: number): number {
  let c = 0;
  while (n) { c += n & 1; n >>= 1; }
  return c;
}

export interface SimResult {
  chain: number;
  points: number;
  cleared: number;
  grid: Uint8Array;
}

/** Fully resolves a grid (gravity + chains) and returns the result. Used by the AI. */
export function simulate(src: Uint8Array): SimResult {
  const g = src.slice();
  let chain = 0;
  let points = 0;
  let cleared = 0;
  settleCols(g);
  for (;;) {
    const m = findMatches(g);
    if (!m) break;
    chain++;
    let colored = 0;
    let mask = 0;
    const sizes: number[] = [];
    for (const grp of m.groups) {
      sizes.push(grp.length);
      for (const k of grp) {
        mask |= 1 << g[k];
        g[k] = 0;
        colored++;
      }
    }
    for (const k of m.garbage) g[k] = 0;
    points += 10 * colored * stepMultiplier(chain, sizes, popcount(mask));
    cleared += colored;
    settleCols(g);
  }
  for (let i = 0; i < HIDDEN * COLS; i++) g[i] = 0;
  return { chain, points, cleared, grid: g };
}
