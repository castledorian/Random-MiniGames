import { COLS, ROWS, HIDDEN, SPAWN_COL, GARBAGE, CELLS, type Hero, type HeroId } from './constants';
import { findMatches, stepMultiplier, GARBAGE_DIVISOR, type Match } from './sim';

export interface Blob {
  c: number;
  vy: number; // visual row (float)
  vel: number;
  sq: number; // landing squash 1 -> 0
  pop: boolean;
  flash: number;
  seed: number;
}

export interface Piece {
  a: number; // pivot color
  b: number; // satellite color
  x: number;
  y: number;
  rot: number; // satellite direction: 0 up, 1 right, 2 down, 3 left
  fall: number;
  lock: number;
  resets: number;
  vx: number;
  ang: number;
  angT: number;
  age: number;
}

export type BState = 'wait' | 'falling' | 'settling' | 'clearing' | 'skill' | 'dead';

export interface Cell {
  x: number;
  y: number;
  c: number;
}

export type BoardEvent =
  | { t: 'move' }
  | { t: 'rotate' }
  | { t: 'blocked' }
  | { t: 'spawn' }
  | { t: 'harddrop'; x: number; y0: number; y1: number; c: number }
  | { t: 'lock' }
  | { t: 'land'; n: number; strong: boolean }
  | { t: 'clearStart'; chain: number; pts: number; cells: Cell[]; groups: number; atk: number }
  | { t: 'pop'; chain: number; cells: Cell[]; skill: boolean }
  | { t: 'chainEnd'; chain: number }
  | { t: 'offset'; n: number }
  | { t: 'attack'; n: number; chain: number }
  | { t: 'garbageIn'; n: number }
  | { t: 'garbageDrop'; n: number }
  | { t: 'skill'; hero: HeroId; cells: Cell[]; kind: 'remove' | 'transform' }
  | { t: 'fizzle'; reason: 'energy' | 'nothing' }
  | { t: 'allclear' }
  | { t: 'dead' };

export interface BoardOpts {
  colors: number;
  seed: number;
  fall: number;
  startEnergy: number;
}

export function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
const G = 80; // blob gravity (rows/s^2)
const LOCK_DELAY = 0.45;
const MAX_RESETS = 14;
const SPAWN_DELAY = 0.1;
export const SOFT_SPEED = 26;

export class Board {
  g: (Blob | null)[] = new Array(CELLS).fill(null);
  state: BState = 'wait';
  stateT = 0;
  piece: Piece | null = null;
  redo: [number, number] | null = null;
  queue: [number, number][] = [];
  private rng: () => number;
  private grng: () => number;
  private startColors: number[] = [];
  private allColors: number[] = [];
  private pairCount = 0;
  t = 0;
  active = false;
  dead = false;
  deadT = 0;

  score = 0;
  chain = 0;
  maxChain = 0;
  lastChain = 0;
  lastPts = 0;
  pending = 0;
  energy: number;
  leftover = 0;
  garbageSent = 0;
  garbageReceived = 0;
  skillsUsed = 0;
  pieces = 0;
  fallSpeed: number;
  softDrop = false;
  skillBuf = 0;
  hurt = 0;
  happy = 0;
  heights: number[] = new Array(COLS).fill(0);
  maxH = 0;
  danger = 0;

  private clearList: number[] = [];
  private clearCells: Cell[] = [];
  private isSkillClear = false;
  clearDur = 0.4;
  private skillDur = 0.5;
  private minSettle = 0.1;
  private chainStartCount = 0;
  private garbageDone = false;
  private skillTurn = false;

  constructor(public hero: Hero, public opts: BoardOpts, public emit: (e: BoardEvent) => void) {
    this.rng = mulberry32(opts.seed);
    this.grng = mulberry32(opts.seed ^ 0x9e3779b9);
    this.fallSpeed = opts.fall;
    this.energy = opts.startEnergy;
    for (let c = 1; c <= opts.colors; c++) this.allColors.push(c);
    const pool = this.allColors.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = (this.rng() * (i + 1)) | 0;
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.startColors = pool.slice(0, Math.min(3, pool.length));
    while (this.queue.length < 3) this.queue.push(this.makePair());
  }

  start() {
    this.active = true;
    this.state = 'wait';
    this.stateT = 0;
  }

  private makePair(): [number, number] {
    const pool = this.pairCount < 8 ? this.startColors : this.allColors;
    this.pairCount++;
    const a = pool[(this.rng() * pool.length) | 0];
    const b = pool[(this.rng() * pool.length) | 0];
    return [a, b];
  }

  // ---------- helpers ----------
  toColors(): Uint8Array {
    const out = new Uint8Array(CELLS);
    for (let i = 0; i < CELLS; i++) {
      const b = this.g[i];
      if (b) out[i] = b.c;
    }
    return out;
  }

  blobCount(): number {
    let n = 0;
    for (let i = 0; i < CELLS; i++) if (this.g[i]) n++;
    return n;
  }

  private free(x: number, y: number): boolean {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS && !this.g[y * COLS + x];
  }

  fits(x: number, y: number, rot: number): boolean {
    return this.free(x, y) && this.free(x + DX[rot], y + DY[rot]);
  }

  private colCount(x: number): number {
    let n = 0;
    for (let r = 0; r < ROWS; r++) if (this.g[r * COLS + x]) n++;
    return n;
  }

  /** Where the current piece will end up (landing preview). */
  ghost(): Cell[] | null {
    const p = this.piece;
    if (!p || this.state !== 'falling') return null;
    const sx = p.x + DX[p.rot];
    if (p.rot === 0) {
      const h = this.colCount(p.x);
      const r = ROWS - 1 - h;
      return [{ x: p.x, y: r, c: p.a }, { x: p.x, y: r - 1, c: p.b }];
    }
    if (p.rot === 2) {
      const h = this.colCount(p.x);
      const r = ROWS - 1 - h;
      return [{ x: p.x, y: r - 1, c: p.a }, { x: p.x, y: r, c: p.b }];
    }
    return [
      { x: p.x, y: ROWS - 1 - this.colCount(p.x), c: p.a },
      { x: sx, y: ROWS - 1 - this.colCount(sx), c: p.b },
    ];
  }

  private newBlob(c: number, vy: number): Blob {
    return { c, vy, vel: 0, sq: 0, pop: false, flash: 0, seed: this.grng() };
  }

  private compact() {
    for (let x = 0; x < COLS; x++) {
      let w = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        const b = this.g[r * COLS + x];
        if (b) {
          if (r !== w) {
            this.g[w * COLS + x] = b;
            this.g[r * COLS + x] = null;
          }
          w--;
        }
      }
    }
  }

  // ---------- controls ----------
  moveH(dir: number): boolean {
    const p = this.piece;
    if (!p || this.state !== 'falling') return false;
    if (this.fits(p.x + dir, p.y, p.rot)) {
      p.x += dir;
      this.afterMove();
      this.emit({ t: 'move' });
      return true;
    }
    return false;
  }

  private afterMove() {
    const p = this.piece!;
    if (!this.fits(p.x, p.y + 1, p.rot) && p.resets < MAX_RESETS) {
      p.lock = 0;
      p.resets++;
    }
  }

  private tryRot(p: Piece, nr: number): [number, number] | null {
    if (this.fits(p.x, p.y, nr)) return [p.x, p.y];
    const dx = DX[nr];
    const dy = DY[nr];
    if (dx !== 0 && this.fits(p.x - dx, p.y, nr)) return [p.x - dx, p.y];
    if (dy === 1 && this.fits(p.x, p.y - 1, nr)) return [p.x, p.y - 1];
    return null;
  }

  rotate(dir: 1 | -1): boolean {
    const p = this.piece;
    if (!p || this.state !== 'falling') return false;
    let nr = (p.rot + dir + 4) % 4;
    let delta = (dir * Math.PI) / 2;
    let res = this.tryRot(p, nr);
    if (!res) {
      // quick-turn (180°) when boxed in on both sides
      nr = (p.rot + 2) % 4;
      delta = dir * Math.PI;
      res = this.tryRot(p, nr);
      if (!res) {
        this.emit({ t: 'blocked' });
        return false;
      }
    }
    if (res[1] !== p.y) p.fall = 0;
    p.x = res[0];
    p.y = res[1];
    p.rot = nr;
    p.angT += delta;
    this.afterMove();
    this.emit({ t: 'rotate' });
    return true;
  }

  hardDrop(): boolean {
    const p = this.piece;
    if (!p || this.state !== 'falling') return false;
    const y0 = p.y;
    let n = 0;
    while (this.fits(p.x, p.y + 1, p.rot)) {
      p.y++;
      n++;
    }
    p.fall = 0;
    this.score += n * 2;
    this.emit({ t: 'harddrop', x: p.x, y0, y1: p.y, c: p.a });
    this.lockPiece(true);
    return true;
  }

  requestSkill(): boolean {
    if (!this.active || this.dead) return false;
    if (this.energy < 100) {
      this.emit({ t: 'fizzle', reason: 'energy' });
      return false;
    }
    if (this.state !== 'falling') {
      this.skillBuf = 0.7;
      return true;
    }
    return this.fireSkill();
  }

  // ---------- update ----------
  update(dt: number) {
    this.t += dt;
    if (this.hurt > 0) this.hurt = Math.max(0, this.hurt - dt);
    if (this.happy > 0) this.happy = Math.max(0, this.happy - dt);
    for (let i = 0; i < CELLS; i++) {
      const b = this.g[i];
      if (b) {
        if (b.sq > 0) b.sq = Math.max(0, b.sq - dt * 4.2);
        if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 3.5);
      }
    }
    const p = this.piece;
    if (p) {
      p.age += dt;
      p.vx += (p.x - p.vx) * (1 - Math.exp(-dt * 42));
      p.ang += (p.angT - p.ang) * (1 - Math.exp(-dt * 34));
    }
    if (this.dead) {
      this.deadT += dt;
      return;
    }
    if (!this.active) return;

    if (this.skillBuf > 0 && this.state !== 'falling') this.skillBuf = Math.max(0, this.skillBuf - dt);

    switch (this.state) {
      case 'wait':
        this.stateT += dt;
        if (this.stateT >= SPAWN_DELAY) this.spawn();
        break;
      case 'falling':
        if (this.skillBuf > 0) {
          this.skillBuf = 0;
          if (this.fireSkill()) break;
        }
        this.updateFalling(dt);
        break;
      case 'settling':
        this.updateSettling(dt);
        break;
      case 'clearing':
        this.stateT += dt;
        if (this.stateT >= this.clearDur) this.finishClear();
        break;
      case 'skill':
        this.stateT += dt;
        if (this.stateT >= this.skillDur) {
          this.state = 'settling';
          this.stateT = 0;
          this.minSettle = 0.05;
        }
        break;
    }
    this.refreshHeights(dt);
  }

  private refreshHeights(dt: number) {
    let max = 0;
    for (let x = 0; x < COLS; x++) {
      let h = 0;
      for (let r = HIDDEN; r < ROWS; r++) {
        if (this.g[r * COLS + x]) {
          h = ROWS - r;
          break;
        }
      }
      this.heights[x] = h;
      if (h > max) max = h;
    }
    this.maxH = max;
    const target = this.heights[SPAWN_COL] >= 9 || max >= 10 ? 1 : 0;
    this.danger += (target - this.danger) * Math.min(1, dt * 6);
  }

  private spawn() {
    const [a, b] = this.redo ?? this.queue.shift()!;
    const wasRedo = !!this.redo;
    this.redo = null;
    if (!wasRedo) while (this.queue.length < 3) this.queue.push(this.makePair());
    this.piece = {
      a,
      b,
      x: SPAWN_COL,
      y: 1,
      rot: 0,
      fall: 0,
      lock: 0,
      resets: 0,
      vx: SPAWN_COL,
      ang: -Math.PI / 2,
      angT: -Math.PI / 2,
      age: 0,
    };
    this.state = 'falling';
    this.emit({ t: 'spawn' });
  }

  private updateFalling(dt: number) {
    const p = this.piece;
    if (!p) return;
    const soft = this.softDrop;
    const v = soft ? Math.max(this.fallSpeed, SOFT_SPEED) : this.fallSpeed;
    let grounded = !this.fits(p.x, p.y + 1, p.rot);
    if (!grounded) {
      p.fall += v * dt;
      while (p.fall >= 1) {
        if (this.fits(p.x, p.y + 1, p.rot)) {
          p.y++;
          p.fall -= 1;
          if (soft) this.score += 1;
        } else {
          p.fall = 0;
          break;
        }
      }
      grounded = !this.fits(p.x, p.y + 1, p.rot);
      if (grounded) p.fall = 0;
    }
    if (grounded) {
      p.lock += dt;
      const lim = soft ? 0.05 : LOCK_DELAY;
      if (p.lock >= lim) this.lockPiece(false);
    } else {
      p.lock = 0;
    }
  }

  private lockPiece(hard: boolean) {
    const p = this.piece!;
    const sx = p.x + DX[p.rot];
    const sy = p.y + DY[p.rot];
    const pb = this.newBlob(p.a, p.y + p.fall);
    this.g[p.y * COLS + p.x] = pb;
    let sb: Blob | null = null;
    if (sy >= 0) {
      sb = this.newBlob(p.b, sy + p.fall);
      this.g[sy * COLS + sx] = sb;
    }
    this.piece = null;
    this.pieces++;
    this.compact();
    // squash the ones that stay put
    for (let r = 0; r < ROWS; r++) {
      for (const bl of [pb, sb]) {
        if (bl && this.g[r * COLS + (bl === pb ? p.x : sx)] === bl && bl.vy >= r - 0.001) bl.sq = hard ? 1 : 0.8;
      }
    }
    this.addEnergy(0.6);
    this.chain = 0;
    this.state = 'settling';
    this.stateT = 0;
    this.minSettle = hard ? 0.12 : 0.1;
    this.emit({ t: 'lock' });
  }

  private updateSettling(dt: number) {
    this.stateT += dt;
    let moving = false;
    let landed = 0;
    let strong = false;
    for (let r = ROWS - 1; r >= 0; r--) {
      for (let x = 0; x < COLS; x++) {
        const b = this.g[r * COLS + x];
        if (!b) continue;
        if (b.vy < r - 1e-4) {
          b.vel += G * dt;
          b.vy += b.vel * dt;
          if (b.vy >= r) {
            b.vy = r;
            if (b.vel > 5) {
              b.sq = 1;
              landed++;
              if (b.vel > 14) strong = true;
            }
            b.vel = 0;
          } else moving = true;
        } else b.vy = r;
      }
    }
    if (landed) this.emit({ t: 'land', n: landed, strong });
    if (!moving && this.stateT >= this.minSettle) this.afterSettle();
  }

  private afterSettle() {
    const m = findMatches(this.toColors());
    if (m) this.startClear(m);
    else this.endTurn();
  }

  private addEnergy(n: number) {
    this.energy = Math.min(100, this.energy + n * this.hero.energyMul);
  }

  private startClear(m: Match) {
    this.chain++;
    if (this.chain > this.maxChain) this.maxChain = this.chain;
    if (this.chain === 1) this.chainStartCount = this.blobCount();
    const sizes = m.groups.map((gr) => gr.length);
    let colored = 0;
    let mask = 0;
    const list: number[] = [];
    for (const grp of m.groups) {
      for (const k of grp) {
        list.push(k);
        colored++;
        mask |= 1 << this.g[k]!.c;
      }
    }
    for (const k of m.garbage) list.push(k);
    let colors = 0;
    for (let c = 1; c <= 5; c++) if (mask & (1 << c)) colors++;
    const pts = 10 * colored * stepMultiplier(this.chain, sizes, colors);
    this.score += pts;
    this.lastPts = pts;

    const atkPts = pts * (this.chain >= 2 ? this.hero.attackMul : 1) + this.leftover;
    const n = Math.floor(atkPts / GARBAGE_DIVISOR);
    this.leftover = atkPts - n * GARBAGE_DIVISOR;

    this.addEnergy(colored * 2.2 + (this.chain >= 2 ? this.chain * 4 : 0));

    const cells: Cell[] = list.map((k) => ({ x: k % COLS, y: (k / COLS) | 0, c: this.g[k]!.c }));
    for (const k of list) {
      const b = this.g[k]!;
      b.pop = true;
      b.flash = 1;
    }
    this.clearList = list;
    this.clearCells = cells;
    this.isSkillClear = false;
    this.clearDur = Math.max(0.3, 0.48 - this.chain * 0.025);
    this.state = 'clearing';
    this.stateT = 0;
    this.happy = 1.4;
    this.emit({ t: 'clearStart', chain: this.chain, pts, cells, groups: sizes.length, atk: n });
    this.sendAttack(n, this.chain);
  }

  private sendAttack(n: number, chain: number) {
    if (n <= 0) return;
    const off = Math.min(this.pending, n);
    if (off > 0) {
      this.pending -= off;
      n -= off;
      this.emit({ t: 'offset', n: off });
    }
    if (n > 0) {
      this.garbageSent += n;
      this.emit({ t: 'attack', n, chain });
    }
  }

  private finishClear() {
    for (const k of this.clearList) this.g[k] = null;
    const cells = this.clearCells;
    this.clearList = [];
    this.clearCells = [];
    this.emit({ t: 'pop', chain: this.chain, cells, skill: this.isSkillClear });
    this.compact();
    this.state = 'settling';
    this.stateT = 0;
    this.minSettle = 0.05;
  }

  private endTurn() {
    const hadChain = this.chain > 0;
    if (hadChain) {
      this.lastChain = this.chain;
      this.emit({ t: 'chainEnd', chain: this.chain });
      if (this.blobCount() === 0 && this.chainStartCount >= 10) {
        this.score += 3000;
        this.emit({ t: 'allclear' });
        this.sendAttack(15, this.chain);
      }
    }
    const skip = this.skillTurn && !hadChain;
    this.chain = 0;
    for (let i = 0; i < HIDDEN * COLS; i++) this.g[i] = null;
    if (!this.garbageDone && this.pending > 0 && !skip) {
      this.dropGarbage();
      this.garbageDone = true;
      this.state = 'settling';
      this.stateT = 0;
      this.minSettle = 0.25;
      return;
    }
    this.garbageDone = false;
    this.skillTurn = false;
    if (this.g[HIDDEN * COLS + SPAWN_COL]) {
      this.die();
      return;
    }
    this.state = 'wait';
    this.stateT = 0;
  }

  receiveGarbage(n: number) {
    if (this.dead) return;
    const m = Math.max(1, Math.ceil(n * this.hero.incomingMul));
    this.pending = Math.min(120, this.pending + m);
    this.garbageReceived += m;
    this.hurt = 0.7;
    this.emit({ t: 'garbageIn', n: m });
  }

  private dropGarbage() {
    const n = Math.min(this.pending, this.hero.garbageCap);
    this.pending -= n;
    const full = Math.floor(n / COLS);
    const rem = n % COLS;
    const order = [0, 1, 2, 3, 4, 5];
    for (let i = order.length - 1; i > 0; i--) {
      const j = (this.grng() * (i + 1)) | 0;
      [order[i], order[j]] = [order[j], order[i]];
    }
    const counts = new Array(COLS).fill(full);
    for (let i = 0; i < rem; i++) counts[order[i]]++;
    for (let x = 0; x < COLS; x++) {
      const h = this.colCount(x);
      const jitter = this.grng() * 1.5;
      for (let j = 0; j < counts[x]; j++) {
        const row = ROWS - 1 - h - j;
        if (row < 0) continue;
        const b = this.newBlob(GARBAGE, -2 - j - jitter);
        b.vel = 3;
        this.g[row * COLS + x] = b;
      }
    }
    this.addEnergy(n * 0.9);
    this.emit({ t: 'garbageDrop', n });
  }

  // ---------- skills ----------
  private fireSkill(): boolean {
    const p = this.piece;
    const cells: number[] = [];
    const h = this.hero.id;
    if (h === 'ember') {
      for (const r of [ROWS - 1, ROWS - 2]) for (let x = 0; x < COLS; x++) if (this.g[r * COLS + x]) cells.push(r * COLS + x);
    } else if (h === 'marina') {
      for (let i = 0; i < CELLS; i++) if (this.g[i] && this.g[i]!.c === GARBAGE) cells.push(i);
      if (!cells.length && this.pending === 0) {
        this.emit({ t: 'fizzle', reason: 'nothing' });
        return false;
      }
    } else if (h === 'volt') {
      const counts = [0, 0, 0, 0, 0, 0];
      for (let i = 0; i < CELLS; i++) {
        const b = this.g[i];
        if (b && b.c !== GARBAGE) counts[b.c]++;
      }
      let best = 0;
      for (let c = 1; c <= 5; c++) if (counts[c] > counts[best]) best = c;
      if (best > 0 && counts[best] > 0) {
        for (let i = 0; i < CELLS; i++) if (this.g[i] && this.g[i]!.c === best) cells.push(i);
      }
    } else {
      for (let x = 0; x < COLS; x++) {
        for (let r = 0; r < ROWS; r++) {
          if (this.g[r * COLS + x]) {
            cells.push(r * COLS + x);
            break;
          }
        }
      }
    }
    if (!cells.length && h !== 'marina') {
      this.emit({ t: 'fizzle', reason: 'nothing' });
      return false;
    }

    this.energy = Math.max(0, this.energy - 100);
    this.skillsUsed++;
    if (p) this.redo = [p.a, p.b];
    this.piece = null;
    this.skillTurn = true;
    this.chain = 0;
    this.happy = 1.5;

    const out: Cell[] = cells.map((k) => ({ x: k % COLS, y: (k / COLS) | 0, c: this.g[k]!.c }));
    if (h === 'marina') {
      for (const k of cells) {
        const b = this.g[k]!;
        const x = k % COLS;
        const r = (k / COLS) | 0;
        const cnt = [0, 0, 0, 0, 0, 0];
        const look = (xx: number, rr: number) => {
          if (xx < 0 || xx >= COLS || rr < 0 || rr >= ROWS) return;
          const o = this.g[rr * COLS + xx];
          if (o && o.c !== GARBAGE) cnt[o.c]++;
        };
        look(x - 1, r);
        look(x + 1, r);
        look(x, r - 1);
        look(x, r + 1);
        let best = 0;
        for (let c = 1; c <= 5; c++) if (cnt[c] > cnt[best]) best = c;
        b.c = best > 0 && cnt[best] > 0 ? best : 1 + ((this.grng() * this.opts.colors) | 0);
        b.flash = 1;
        b.sq = 1;
      }
      this.pending = Math.max(0, this.pending - 6);
      this.state = 'skill';
      this.stateT = 0;
      this.skillDur = 0.55;
      this.emit({ t: 'skill', hero: h, cells: out, kind: 'transform' });
    } else {
      for (const k of cells) {
        const b = this.g[k]!;
        b.pop = true;
        b.flash = 1;
      }
      this.clearList = cells;
      this.clearCells = out;
      this.isSkillClear = true;
      this.clearDur = 0.5;
      this.score += cells.length * 30;
      this.state = 'clearing';
      this.stateT = 0;
      this.emit({ t: 'skill', hero: h, cells: out, kind: 'remove' });
    }
    return true;
  }

  private die() {
    this.state = 'dead';
    this.dead = true;
    this.deadT = 0;
    this.piece = null;
    this.emit({ t: 'dead' });
  }
}
