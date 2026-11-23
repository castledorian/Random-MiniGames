import { Board, DX, type Piece } from './board';
import { COLS, ROWS, HIDDEN, SPAWN_COL, GARBAGE } from './constants';
import { simulate, colHeight, type SimResult } from './sim';

interface Plan {
  x: number;
  rot: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class AIPlayer {
  private plan: Plan | null = null;
  private planPiece: Piece | null = null;
  private think = 0;
  private act = 0;
  private stuck = 0;
  private skillT = 1.5;

  private thinkDelay: number;
  private moveInt: number;
  private err: number;
  private want: number;

  constructor(private board: Board, private opp: Board | null, private diff: number, private colors: number) {
    // human-like tempo: even the hardest AI needs ~0.7s per piece
    this.thinkDelay = lerp(1.25, 0.42, diff);
    this.moveInt = lerp(0.38, 0.12, diff);
    this.err = lerp(0.4, 0.02, diff);
    this.want = lerp(2, 4, diff);
  }

  update(dt: number) {
    const b = this.board;
    if (b.dead || !b.active) return;

    this.skillT -= dt;
    if (b.energy >= 100 && b.state === 'falling' && this.skillT <= 0) {
      this.skillT = 0.7;
      if (this.shouldSkill()) b.requestSkill();
    }

    const p = b.piece;
    if (!p || b.state !== 'falling') {
      b.softDrop = false;
      this.plan = null;
      this.planPiece = null;
      return;
    }
    if (this.planPiece !== p) {
      this.planPiece = p;
      this.plan = null;
      this.think = this.thinkDelay * (0.6 + Math.random() * 0.8);
      this.act = 0;
      this.stuck = 0;
    }
    this.think -= dt;
    if (this.think > 0) return;
    if (!this.plan) this.plan = this.choose(p);
    this.stuck += dt;
    this.act -= dt;
    if (this.act > 0) return;
    this.act = this.moveInt * (0.8 + Math.random() * 0.5);

    const plan = this.plan;
    if (p.rot !== plan.rot) {
      const d = (plan.rot - p.rot + 4) % 4;
      if (!b.rotate(d === 3 ? -1 : 1)) this.stuck += 0.6;
    } else if (p.x !== plan.x) {
      if (!b.moveH(plan.x > p.x ? 1 : -1)) this.stuck += 0.6;
    } else if (this.diff >= 0.45 || this.stuck > 3) {
      b.hardDrop();
    } else {
      b.softDrop = true;
    }
    if (this.stuck > 4.5) b.hardDrop();
  }

  private shouldSkill(): boolean {
    const b = this.board;
    const danger = b.maxH >= 9 || b.pending >= 12;
    if (danger) return true;
    if (Math.random() > 0.35 + this.diff * 0.4) return false;
    switch (b.hero.id) {
      case 'marina': {
        let garb = 0;
        for (const bl of b.g) if (bl && bl.c === GARBAGE) garb++;
        return b.pending >= 6 || garb >= 8;
      }
      case 'volt':
        return b.maxH >= 7 && this.diff > 0.3;
      case 'ember':
        return b.maxH >= 8 || (this.opp ? this.opp.pending > 0 && b.pending >= 6 : false);
      default:
        return b.maxH >= 8;
    }
  }

  private choose(p: Piece): Plan {
    const b = this.board;
    const base = b.toColors();
    const cands: { x: number; rot: number; v: number }[] = [];
    const oppDanger = this.opp ? this.opp.maxH >= 9 : false;

    for (let rot = 0; rot < 4; rot++) {
      for (let x = 0; x < COLS; x++) {
        const sx = x + DX[rot];
        if (sx < 0 || sx >= COLS) continue;
        const g = base.slice();
        let ok = true;
        const put = (cx: number, row: number, c: number) => {
          if (row < HIDDEN) ok = false;
          else g[row * COLS + cx] = c;
        };
        if (rot === 0 || rot === 2) {
          const r = ROWS - 1 - colHeight(g, x);
          if (rot === 0) {
            put(x, r, p.a);
            put(x, r - 1, p.b);
          } else {
            put(x, r, p.b);
            put(x, r - 1, p.a);
          }
        } else {
          put(x, ROWS - 1 - colHeight(g, x), p.a);
          put(sx, ROWS - 1 - colHeight(g, sx), p.b);
        }
        if (!ok) continue;
        const res = simulate(g);
        let v = this.evaluate(res, oppDanger);
        v += (Math.random() - 0.5) * (1 - this.diff) * 24;
        cands.push({ x, rot, v });
      }
    }
    if (!cands.length) return { x: p.x, rot: p.rot };
    cands.sort((a, b2) => b2.v - a.v);
    let pick = cands[0];
    if (Math.random() < this.err) pick = cands[Math.min(cands.length - 1, (Math.random() * 5) | 0)];
    return { x: pick.x, rot: pick.rot };
  }

  private evaluate(res: SimResult, oppDanger: boolean): number {
    const g = res.grid;
    const b = this.board;
    if (g[HIDDEN * COLS + SPAWN_COL]) return -1e6;
    const hs: number[] = [];
    let maxH = 0;
    for (let x = 0; x < COLS; x++) {
      const h = colHeight(g, x);
      hs.push(h);
      if (h > maxH) maxH = h;
    }
    let v = 0;
    let bump = 0;
    for (let x = 0; x < COLS - 1; x++) bump += Math.abs(hs[x] - hs[x + 1]);
    v -= bump * 1.3;
    v -= Math.max(0, maxH - 7) ** 2 * 5;
    v -= Math.max(0, hs[SPAWN_COL] - 6) * 9;

    // small connected groups = potential
    const seen = new Uint8Array(g.length);
    let pairs = 0;
    let triples = 0;
    for (let i = HIDDEN * COLS; i < g.length; i++) {
      const c = g[i];
      if (!c || c === GARBAGE || seen[i]) continue;
      let size = 0;
      const st = [i];
      seen[i] = 1;
      while (st.length) {
        const k = st.pop()!;
        size++;
        const r = (k / COLS) | 0;
        const x = k - r * COLS;
        const nb = [x > 0 ? k - 1 : -1, x < COLS - 1 ? k + 1 : -1, r > HIDDEN ? k - COLS : -1, r < ROWS - 1 ? k + COLS : -1];
        for (const n of nb) {
          if (n >= 0 && !seen[n] && g[n] === c) {
            seen[n] = 1;
            st.push(n);
          }
        }
      }
      if (size === 2) pairs++;
      else if (size === 3) triples++;
    }
    v += pairs * 2 + triples * 6;

    if (res.chain > 0) {
      const pressure = b.pending >= 8 || b.maxH >= 9;
      const want = this.want - b.pending / 8 - (oppDanger ? 1.5 : 0);
      if (res.chain >= want || pressure) v += 60 + res.points / 12;
      else if (res.chain === 1 && this.diff < 0.4) v += 14 + (b.maxH >= 6 ? 12 : 0);
      else v += res.chain * 6 - 18;
    }

    // chain potential: would one extra blob set off a big chain?
    if (this.diff >= 0.35) {
      let bestChain = 0;
      for (let x = 0; x < COLS; x++) {
        const row = ROWS - 1 - hs[x];
        if (row < HIDDEN) continue;
        for (let c = 1; c <= this.colors; c++) {
          const g2 = g.slice();
          g2[row * COLS + x] = c;
          const s = simulate(g2);
          if (s.chain > bestChain) bestChain = s.chain;
        }
      }
      if (bestChain >= 2) v += (bestChain * bestChain * 9) * (this.diff - 0.2);
    }
    return v;
  }
}
