import type { AudioFX } from "./audio";
import type { InputManager } from "./input";
import { HEROES, POWER_INFO, heroById, type Hero, type PowerKind } from "./heroes";
import {
  BOARD_H,
  BOARD_W,
  COLS,
  DX,
  DY,
  FLAME_TIME,
  FUSE,
  HALF,
  ROWS,
  T_BLOCK,
  T_FLOOR,
  T_WALL,
  TILE,
  VIEW_H,
  VIEW_W,
  type Bomb,
  type Cmd,
  type Dir,
  type Flame,
  type Floater,
  type GameCallbacks,
  type GameConfig,
  type GameSummary,
  type Particle,
  type Player,
  type Powerup,
  type Warning,
} from "./types";
import { makeAI, runAI } from "./ai";
import { Renderer } from "./render";

export const SPAWNS: [number, number][] = [
  [1, 1],
  [COLS - 2, 1],
  [1, ROWS - 2],
  [COLS - 2, ROWS - 2],
];

const NONE: Cmd = { dx: 0, dy: 0, bomb: false, skill: false };
const DASH_SPEED = 16;
const KICK_SPEED = 9;
const ROUNDS_TO_WIN = 2;
const MAX_PARTS = 520;
const DEBRIS = ["#c97b3a", "#a85f28", "#e39a52", "#7a4318"];

export type GameState = "countdown" | "playing" | "banner" | "over";

export interface Banner {
  title: string;
  sub: string;
  color: string;
}

export interface GameOpts {
  canvas: HTMLCanvasElement | null;
  cfg: GameConfig;
  input: InputManager;
  audio: AudioFX | null;
  cb: GameCallbacks;
}

function sign(n: number) {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

export class Game {
  cfg: GameConfig;
  input: InputManager;
  audio: AudioFX | null;
  cb: GameCallbacks;
  canvas: HTMLCanvasElement | null;
  renderer: Renderer | null = null;

  grid = new Uint8Array(COLS * ROWS);
  hidden = new Uint8Array(COLS * ROWS);
  pop = new Float32Array(COLS * ROWS);
  bombs: Bomb[] = [];
  bombGrid: (Bomb | null)[] = new Array(COLS * ROWS).fill(null);
  flames: Flame[] = [];
  flameGrid: (Flame | null)[] = new Array(COLS * ROWS).fill(null);
  powerups: Powerup[] = [];
  players: Player[] = [];
  parts: Particle[] = [];
  floaters: Floater[] = [];
  warnings: Warning[] = [];

  state: GameState = "countdown";
  stateT = 0;
  banner: Banner | null = null;
  bannerDur = 3;
  paused = false;
  stage = 1;
  round = 1;
  time = 0;
  matchTime = 0;
  clock = 0;
  suddenAt = 100;
  suddenStarted = false;
  sdOrder: number[] = [];
  sdIndex = 0;
  sdTimer = 0;
  endT = 0;
  goPlayed = false;
  lastCount = -1;

  shakeAmp = 0;
  hitstop = 0;
  flash = 0;
  flashColor = "#fff";
  zoomPulse = 0;
  showHint = true;

  private danger = new Float32Array(COLS * ROWS);
  private dangerAt = -1;
  dangerDirty = true;

  private running = false;
  private raf = 0;
  private last = 0;
  private frameAvg = 16;
  private frameCount = 0;
  private cssW = VIEW_W;
  private cssH = VIEW_H;
  private dpr = 1;
  private nextId = 1;
  private summaryCache: GameSummary | null = null;

  constructor(o: GameOpts) {
    this.cfg = o.cfg;
    this.input = o.input;
    this.audio = o.audio;
    this.cb = o.cb;
    this.canvas = o.canvas;
    if (o.canvas) this.renderer = new Renderer(o.canvas);
    this.newMatch();
  }

  /* ---------------------------------------------------------------- *
   *  Cycle de vie
   * ---------------------------------------------------------------- */

  start() {
    if (this.running || typeof window === "undefined") return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    document.addEventListener("visibilitychange", this.onVis);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onVis);
    this.audio?.stopMusic();
  }

  private onVis = () => {
    if (document.hidden && this.state !== "over" && !this.paused) this.setPaused(true);
  };

  resize(cssW: number, cssH: number, dpr: number) {
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = dpr;
    this.applySize();
  }

  private applySize() {
    if (!this.canvas) return;
    const w = Math.max(2, Math.round(this.cssW * this.dpr));
    const h = Math.max(2, Math.round(this.cssH * this.dpr));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  }

  setPaused(p: boolean) {
    if (this.state === "over") return;
    if (this.paused === p) return;
    this.paused = p;
    this.cb.onPauseChange(p);
    this.audio?.click();
  }

  togglePause() {
    this.setPaused(!this.paused);
  }

  restart() {
    this.paused = false;
    this.cb.onPauseChange(false);
    this.newMatch();
    this.audio?.setIntensity(0);
  }

  private loop = (ts: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (dt <= 0) return;
    if (dt > 0.1) dt = 0.1;

    this.frameAvg = this.frameAvg * 0.95 + dt * 1000 * 0.05;
    if (++this.frameCount % 120 === 0 && this.frameAvg > 24 && this.dpr > 1) {
      this.dpr = 1;
      this.applySize();
    }

    this.input.poll();
    if (this.input.consumePause()) this.togglePause();
    if (!this.paused) this.step(dt);
    this.renderer?.draw(this, this.cssW, this.cssH, this.dpr);
  };

  /* ---------------------------------------------------------------- *
   *  Partie / manche
   * ---------------------------------------------------------------- */

  private makePlayer(slot: number, hero: Hero, kind: "human" | "bot", device: string | null, name: string): Player {
    const p: Player = {
      id: this.nextId++,
      slot,
      name,
      hero,
      kind,
      device,
      x: 1.5,
      y: 1.5,
      facing: 2,
      alive: true,
      walkT: 0,
      moving: false,
      lastAxis: null,
      maxBombs: 1,
      range: 2,
      speed: 4.4,
      kick: false,
      shield: false,
      invuln: 0,
      frozen: 0,
      skillCd: 0,
      dash: null,
      lives: 1,
      score: 0,
      kills: 0,
      blocks: 0,
      pickups: 0,
      wins: 0,
      respawnT: 0,
      deathT: 0,
      spawnX: 1,
      spawnY: 1,
      ai: null,
      hurtFlash: 0,
      active: 0,
      vib: 0,
      boostBombs: 0,
      boostRange: 0,
      boostSpeed: 0,
      blinkT: Math.random() * 5,
      placed: 0,
    };
    this.applyBase(p);
    return p;
  }

  private applyBase(p: Player) {
    const s = p.hero.stats;
    p.maxBombs = s.bombs;
    p.range = s.range;
    p.speed = s.speed;
    p.kick = s.kick;
    p.shield = s.shield;
    p.boostBombs = 0;
    p.boostRange = 0;
    p.boostSpeed = 0;
  }

  newMatch() {
    this.players = [];
    this.nextId = 1;
    this.stage = 1;
    this.round = 1;
    this.matchTime = 0;
    this.summaryCache = null;
    this.cfg.players.forEach((pc, i) => {
      const hero = heroById(pc.heroId);
      const p = this.makePlayer(pc.slot, hero, pc.kind, pc.device, pc.name);
      if (this.cfg.mode === "solo" && i === 0) p.lives = 3;
      this.players.push(p);
    });
    this.startRound();
  }

  private botsForStage(stage: number): Player[] {
    const human = this.players[0];
    const count = stage <= 1 ? 2 : 3;
    const pool = HEROES.filter((h) => h.id !== human.hero.id);
    const bots: Player[] = [];
    for (let i = 0; i < count; i++) {
      const hero = pool[(stage * 2 + i * 2 + i) % pool.length];
      const b = this.makePlayer(i + 1, hero, "bot", null, hero.name);
      const lvl = Math.min(1, 0.28 + 0.13 * stage);
      b.ai = makeAI(lvl);
      const bonus = Math.max(0, stage - 2);
      b.maxBombs = Math.min(4, b.maxBombs + Math.floor(bonus / 2));
      b.range = Math.min(5, b.range + Math.floor((bonus + 1) / 2));
      bots.push(b);
    }
    return bots;
  }

  private startRound() {
    const solo = this.cfg.mode === "solo";
    if (solo) {
      const human = this.players[0];
      if (human.lives <= 0) {
        this.finish(null);
        return;
      }
      this.players = [human, ...this.botsForStage(this.stage)];
    } else {
      this.players.forEach((p) => {
        if (p.kind === "bot" && !p.ai) p.ai = makeAI(0.78);
      });
    }

    this.genLevel();
    this.bombs = [];
    this.bombGrid.fill(null);
    this.flames = [];
    this.flameGrid.fill(null);
    this.powerups = [];
    this.parts = [];
    this.floaters = [];
    this.warnings = [];
    this.pop.fill(0);
    this.dangerDirty = true;

    const n = this.players.length;
    const order = n === 4 ? [0, 1, 2, 3] : [0, 3, 1, 2];
    this.players.forEach((p, i) => {
      const [sx, sy] = SPAWNS[order[i % 4]];
      p.spawnX = sx;
      p.spawnY = sy;
      p.x = sx + 0.5;
      p.y = sy + 0.5;
      p.alive = true;
      p.invuln = 0;
      p.frozen = 0;
      p.dash = null;
      p.skillCd = 0;
      p.respawnT = 0;
      p.deathT = 0;
      p.moving = false;
      p.hurtFlash = 0;
      p.facing = (sy < ROWS / 2 ? 2 : 0) as Dir;
      if (!solo) {
        this.applyBase(p);
      } else if (p.kind === "human" && this.stage > 1) {
        if (p.hero.stats.shield) p.shield = true;
      }
      if (p.ai) {
        p.ai.think = 0.3 + Math.random() * 0.5;
        p.ai.path = [];
      }
    });

    // Ordre de la mort subite (spirale)
    this.sdOrder = [];
    let x0 = 1;
    let x1 = COLS - 2;
    let y0 = 1;
    let y1 = ROWS - 2;
    while (x0 <= x1 && y0 <= y1) {
      for (let x = x0; x <= x1; x++) this.sdOrder.push(y0 * COLS + x);
      for (let y = y0 + 1; y <= y1; y++) this.sdOrder.push(y * COLS + x1);
      if (y0 < y1) for (let x = x1 - 1; x >= x0; x--) this.sdOrder.push(y1 * COLS + x);
      if (x0 < x1) for (let y = y1 - 1; y > y0; y--) this.sdOrder.push(y * COLS + x0);
      x0++;
      x1--;
      y0++;
      y1--;
    }
    this.sdIndex = 0;
    this.sdTimer = 0;
    this.suddenStarted = false;
    this.suddenAt = solo ? 110 : 85;
    this.time = 0;
    this.endT = 0;
    this.goPlayed = false;
    this.lastCount = -1;
    this.state = "countdown";
    this.stateT = 0;
    this.banner = null;
    this.summaryCache = null;
  }

  private genLevel() {
    const g = this.grid;
    this.hidden.fill(0);
    const solo = this.cfg.mode === "solo";
    const kinds: [PowerKind, number][] = solo
      ? [
          ["bomb", 26],
          ["flame", 26],
          ["speed", 18],
          ["shield", 8],
          ["kick", 8],
          ["heart", 4],
        ]
      : [
          ["bomb", 28],
          ["flame", 28],
          ["speed", 18],
          ["shield", 9],
          ["kick", 9],
        ];
    const total = kinds.reduce((a, k) => a + k[1], 0);
    const KINDS: PowerKind[] = ["bomb", "flame", "speed", "shield", "kick", "heart"];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x;
        if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 || (x % 2 === 0 && y % 2 === 0)) {
          g[i] = T_WALL;
        } else if (Math.random() < 0.76) {
          g[i] = T_BLOCK;
          if (Math.random() < 0.32) {
            let r = Math.random() * total;
            let kind: PowerKind = "bomb";
            for (const [k, w] of kinds) {
              r -= w;
              if (r <= 0) {
                kind = k;
                break;
              }
            }
            this.hidden[i] = KINDS.indexOf(kind) + 1;
          }
        } else {
          g[i] = T_FLOOR;
        }
      }
    }
    for (const [sx, sy] of SPAWNS) {
      const dx = sx < COLS / 2 ? 1 : -1;
      const dy = sy < ROWS / 2 ? 1 : -1;
      const clear: [number, number][] = [
        [sx, sy],
        [sx + dx, sy],
        [sx + 2 * dx, sy],
        [sx, sy + dy],
        [sx, sy + 2 * dy],
        [sx + 2 * dx, sy + dy],
      ];
      for (const [cx, cy] of clear) {
        g[cy * COLS + cx] = T_FLOOR;
        this.hidden[cy * COLS + cx] = 0;
      }
    }
  }

  /* ---------------------------------------------------------------- *
   *  Boucle de simulation
   * ---------------------------------------------------------------- */

  canAct(): boolean {
    return this.state === "playing" || (this.state === "countdown" && this.stateT >= 0.9);
  }

  step(dtRaw: number) {
    let dt = dtRaw;
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      dt *= 0.15;
    }
    const cmds = this.gatherCmds(dt);
    const n = Math.max(1, Math.ceil(dt / (1 / 60)));
    const sdt = dt / n;
    for (let i = 0; i < n; i++) {
      this.simulate(sdt, cmds);
      if (i === 0) {
        for (const c of cmds) {
          c.bomb = false;
          c.skill = false;
        }
      }
    }
  }

  private gatherCmds(dt: number): Cmd[] {
    const act = this.canAct();
    return this.players.map((p) => {
      if (!p.alive || !act) return { ...NONE };
      if (p.kind === "bot") return p.ai ? runAI(this, p, dt) : { ...NONE };
      const s = this.cfg.mode === "solo" ? this.input.merged() : this.input.state(p.device);
      return { dx: s.dx, dy: s.dy, bomb: s.bombEdge, skill: s.skillEdge };
    });
  }

  private simulate(dt: number, cmds: Cmd[]) {
    this.clock += dt;
    this.stateT += dt;

    if (this.state === "over") {
      this.updateFlames(dt);
      this.updatePowerups(dt);
      this.updateFx(dt);
      this.players.forEach((p) => {
        if (!p.alive) p.deathT += dt;
      });
      return;
    }

    if (this.state === "countdown") {
      const c = this.stateT < 0.9 ? 1 : 0;
      if (c !== this.lastCount) {
        this.lastCount = c;
        if (c === 1) this.audio?.tick();
      }
      if (!this.goPlayed && this.stateT >= 0.9) {
        this.goPlayed = true;
        this.audio?.go();
        this.audio?.startMusic();
      }
      if (this.stateT >= 1.5) {
        this.state = "playing";
        this.stateT = 0;
      }
    }

    if (this.state === "playing") {
      this.time += dt;
      this.matchTime += dt;
      this.updateSudden(dt);
    }

    for (let i = 0; i < this.players.length; i++) {
      this.updatePlayer(this.players[i], dt, cmds[i] ?? NONE);
    }
    this.updateBombs(dt);
    this.updateFlames(dt);
    this.updatePowerups(dt);
    this.updateFx(dt);
    this.checkRound(dt);
  }

  /* ---------------------------------------------------------------- *
   *  Joueurs
   * ---------------------------------------------------------------- */

  private pickDir(p: Player, dx: number, dy: number): [number, number] {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (ax < 0.3 && ay < 0.3) {
      p.lastAxis = null;
      return [0, 0];
    }
    let axis: "x" | "y";
    if (ax >= 0.3 && ay < 0.3) axis = "x";
    else if (ay >= 0.3 && ax < 0.3) axis = "y";
    else if (p.lastAxis === "x") axis = ay > ax * 1.4 ? "y" : "x";
    else if (p.lastAxis === "y") axis = ax > ay * 1.4 ? "x" : "y";
    else axis = ax >= ay ? "x" : "y";
    p.lastAxis = axis;
    return axis === "x" ? [sign(dx), 0] : [0, sign(dy)];
  }

  countActive(p: Player): number {
    let n = 0;
    for (const b of this.bombs) if (b.owner === p && !b.free) n++;
    return n;
  }

  private updatePlayer(p: Player, dt: number, cmd: Cmd) {
    p.blinkT += dt;
    if (p.hurtFlash > 0) p.hurtFlash -= dt;
    if (!p.alive) {
      p.deathT += dt;
      if (p.respawnT > 0) {
        p.respawnT -= dt;
        if (p.respawnT <= 0) this.respawn(p);
      }
      return;
    }
    if (p.invuln > 0) p.invuln -= dt;
    if (p.frozen > 0) {
      p.frozen -= dt;
      if (Math.random() < dt * 12) this.emit(p.x * TILE, p.y * TILE - 8, (Math.random() - 0.5) * 40, -30, 0.5, 3, "#bff3ff", 0, 0);
    }
    if (p.skillCd > 0) p.skillCd -= dt;
    p.active = this.countActive(p);

    let moved = false;
    if (p.dash) {
      const d = Math.min(DASH_SPEED * dt, p.dash.left);
      const mv = this.moveAxis(p, p.dash.dx, p.dash.dy, d);
      p.dash.left -= d;
      if (mv < d * 0.5) p.dash.left = 0;
      moved = true;
      this.emit(p.x * TILE, p.y * TILE + 6, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0.3, 0, p.hero.color, 5, 0);
      if (p.dash.left <= 0.001) p.dash = null;
    } else if (p.frozen <= 0) {
      const [mx, my] = this.pickDir(p, cmd.dx, cmd.dy);
      if (mx !== 0 || my !== 0) {
        p.facing = (my < 0 ? 0 : mx > 0 ? 1 : my > 0 ? 2 : 3) as Dir;
        const dist = p.speed * dt;
        let got = this.moveAxis(p, mx, my, dist);
        if (got < dist * 0.3) {
          const ox = mx === 0 && Math.abs(cmd.dx) >= 0.3 ? sign(cmd.dx) : 0;
          const oy = my === 0 && Math.abs(cmd.dy) >= 0.3 ? sign(cmd.dy) : 0;
          if (ox !== 0 || oy !== 0) {
            got += this.moveAxis(p, ox, oy, dist);
            if (got > 0.0001) p.facing = (oy < 0 ? 0 : ox > 0 ? 1 : oy > 0 ? 2 : 3) as Dir;
          }
        }
        moved = got > 0.0005;
      }
    }
    p.moving = moved;
    if (moved) {
      p.walkT += dt * (6 + p.speed);
      if (Math.random() < dt * 9) {
        this.emit(p.x * TILE, p.y * TILE + 16, (Math.random() - 0.5) * 20, -10 - Math.random() * 14, 0.35, 1, "#8a93b8", 0, 0);
      }
    }

    if (cmd.bomb) this.placeBomb(p);
    if (cmd.skill) this.useSkill(p);

    // Bonus
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const u = this.powerups[i];
      if (Math.abs(u.x - p.x) < 0.55 && Math.abs(u.y - p.y) < 0.55) {
        this.powerups.splice(i, 1);
        this.collect(p, u);
      }
    }

    // Flammes
    const f = this.flameGrid[Math.floor(p.y) * COLS + Math.floor(p.x)];
    if (f) this.hurt(p, f.owner);
  }

  private blockedFor(p: Player, tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
    const i = ty * COLS + tx;
    if (this.grid[i] !== T_FLOOR) return true;
    const b = this.bombGrid[i];
    return !!b && !b.pass.has(p);
  }

  private collides(p: Player, nx: number, ny: number): boolean {
    const x0 = Math.floor(nx - HALF);
    const x1 = Math.floor(nx + HALF - 1e-6);
    const y0 = Math.floor(ny - HALF);
    const y1 = Math.floor(ny + HALF - 1e-6);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.blockedFor(p, x, y)) return true;
    return false;
  }

  private moveAxis(p: Player, dx: number, dy: number, dist: number): number {
    let moved = 0;
    let remaining = dist;
    let guard = 0;
    while (remaining > 1e-5 && guard++ < 12) {
      const step = Math.min(remaining, 0.1);
      remaining -= step;
      const nx = p.x + dx * step;
      const ny = p.y + dy * step;
      if (!this.collides(p, nx, ny)) {
        p.x = nx;
        p.y = ny;
        moved += step;
        continue;
      }
      if (p.kick) this.tryKick(p, dx, dy);
      if (!this.slide(p, dx, dy, step)) break;
    }
    return moved;
  }

  private slide(p: Player, dx: number, dy: number, step: number): boolean {
    if (dx !== 0) {
      const col = Math.floor(p.x + dx * (HALF + step));
      const rowA = Math.floor(p.y - HALF + 1e-6);
      const rowB = Math.floor(p.y + HALF - 1e-6);
      if (rowA === rowB) return false;
      const bA = this.blockedFor(p, col, rowA);
      const bB = this.blockedFor(p, col, rowB);
      if (bA === bB) return false;
      const centerRow = Math.floor(p.y);
      const freeRow = bA ? rowB : rowA;
      if (freeRow !== centerRow) return false;
      const delta = centerRow + 0.5 - p.y;
      const mv = sign(delta) * Math.min(Math.abs(delta), step);
      if (this.collides(p, p.x, p.y + mv)) return false;
      p.y += mv;
      return true;
    }
    const row = Math.floor(p.y + dy * (HALF + step));
    const colA = Math.floor(p.x - HALF + 1e-6);
    const colB = Math.floor(p.x + HALF - 1e-6);
    if (colA === colB) return false;
    const bA = this.blockedFor(p, colA, row);
    const bB = this.blockedFor(p, colB, row);
    if (bA === bB) return false;
    const centerCol = Math.floor(p.x);
    const freeCol = bA ? colB : colA;
    if (freeCol !== centerCol) return false;
    const delta = centerCol + 0.5 - p.x;
    const mv = sign(delta) * Math.min(Math.abs(delta), step);
    if (this.collides(p, p.x + mv, p.y)) return false;
    p.x += mv;
    return true;
  }

  overlapsTile(p: Player, tx: number, ty: number): boolean {
    return p.x + HALF > tx && p.x - HALF < tx + 1 && p.y + HALF > ty && p.y - HALF < ty + 1;
  }

  private tryKick(p: Player, dx: number, dy: number) {
    const tx = Math.floor(p.x) + dx;
    const ty = Math.floor(p.y) + dy;
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return;
    const b = this.bombGrid[ty * COLS + tx];
    if (!b || b.pass.has(p) || b.dx !== 0 || b.dy !== 0) return;
    this.startSlide(b, dx, dy);
  }

  private bombCanEnter(nx: number, ny: number): boolean {
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return false;
    const i = ny * COLS + nx;
    if (this.grid[i] !== T_FLOOR || this.bombGrid[i]) return false;
    for (const pl of this.players) if (pl.alive && this.overlapsTile(pl, nx, ny)) return false;
    return true;
  }

  private startSlide(b: Bomb, dx: number, dy: number) {
    const nx = b.tx + dx;
    const ny = b.ty + dy;
    if (!this.bombCanEnter(nx, ny)) return;
    this.bombGrid[b.ty * COLS + b.tx] = null;
    b.tx = nx;
    b.ty = ny;
    this.bombGrid[ny * COLS + nx] = b;
    b.dx = dx;
    b.dy = dy;
    this.audio?.kick();
    this.dangerDirty = true;
    for (let i = 0; i < 5; i++) this.emit(b.fx * TILE, b.fy * TILE + 10, -dx * 60 + (Math.random() - 0.5) * 40, -dy * 60 + (Math.random() - 0.5) * 40 - 10, 0.35, 1, "#9aa3c7", 0, 0);
  }

  /* ---------------------------------------------------------------- *
   *  Bombes & explosions
   * ---------------------------------------------------------------- */

  placeBomb(p: Player, opts?: { free?: boolean; fuse?: number; tx?: number; ty?: number }): Bomb | null {
    const tx = opts?.tx ?? Math.floor(p.x);
    const ty = opts?.ty ?? Math.floor(p.y);
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return null;
    const i = ty * COLS + tx;
    if (this.bombGrid[i] || this.grid[i] !== T_FLOOR) return null;
    if (!opts?.free && this.countActive(p) >= p.maxBombs) return null;
    const pass = new Set<Player>();
    for (const pl of this.players) if (pl.alive && this.overlapsTile(pl, tx, ty)) pass.add(pl);
    const fuse = opts?.fuse ?? FUSE;
    const b: Bomb = {
      tx,
      ty,
      fx: tx + 0.5,
      fy: ty + 0.5,
      dx: 0,
      dy: 0,
      owner: p,
      range: p.range,
      fuse,
      maxFuse: fuse,
      pass,
      free: !!opts?.free,
      exploded: false,
      age: 0,
    };
    this.bombs.push(b);
    this.bombGrid[i] = b;
    p.placed++;
    this.dangerDirty = true;
    if (!opts?.free) {
      this.audio?.place();
      for (let k = 0; k < 6; k++) this.emit((tx + 0.5) * TILE, (ty + 0.5) * TILE + 12, (Math.random() - 0.5) * 90, -Math.random() * 40, 0.35, 1, "#98a2c8", 0, 0);
    }
    return b;
  }

  private updateBombs(dt: number) {
    for (const b of this.bombs) {
      b.age += dt;
      b.fuse -= dt;
      if (b.dx !== 0 || b.dy !== 0) {
        const tx = b.tx + 0.5;
        const ty = b.ty + 0.5;
        const rx = tx - b.fx;
        const ry = ty - b.fy;
        const d = Math.hypot(rx, ry);
        const mv = KICK_SPEED * dt;
        if (d <= mv) {
          b.fx = tx;
          b.fy = ty;
          const nx = b.tx + b.dx;
          const ny = b.ty + b.dy;
          if (this.bombCanEnter(nx, ny)) {
            this.bombGrid[b.ty * COLS + b.tx] = null;
            b.tx = nx;
            b.ty = ny;
            this.bombGrid[ny * COLS + nx] = b;
            this.dangerDirty = true;
          } else {
            b.dx = 0;
            b.dy = 0;
            this.audio?.thud();
            this.shake(2);
          }
        } else {
          b.fx += (rx / d) * mv;
          b.fy += (ry / d) * mv;
        }
      } else {
        b.fx = b.tx + 0.5;
        b.fy = b.ty + 0.5;
      }
      if (b.pass.size) {
        for (const pl of b.pass) if (!pl.alive || !this.overlapsTile(pl, b.tx, b.ty)) b.pass.delete(pl);
      }
      // Etincelle de mèche
      if (Math.random() < dt * 28) {
        this.emit(b.fx * TILE + 6, b.fy * TILE - 14, (Math.random() - 0.5) * 50, -40 - Math.random() * 40, 0.3, 0, Math.random() < 0.5 ? "#ffd166" : "#ff7b3c", 0, 0);
      }
    }
    for (const b of this.bombs.slice()) {
      if (!b.exploded && b.fuse <= 0) this.detonate(b);
    }
  }

  private detonate(first: Bomb) {
    const queue: Bomb[] = [first];
    const tally = new Map<Player, { n: number; x: number; y: number }>();
    const spawns: Powerup[] = [];
    let count = 0;
    while (queue.length) {
      const b = queue.pop()!;
      if (b.exploded) continue;
      b.exploded = true;
      const bi = this.bombs.indexOf(b);
      if (bi !== -1) this.bombs.splice(bi, 1);
      if (this.bombGrid[b.ty * COLS + b.tx] === b) this.bombGrid[b.ty * COLS + b.tx] = null;
      count++;
      this.boom(b, queue, tally, spawns);
    }
    tally.forEach((t, owner) => {
      const pts = t.n * 10 + (t.n >= 3 ? (t.n - 2) * 15 : 0);
      owner.score += pts;
      owner.blocks += t.n;
      this.floater(t.x, t.y - 10, "+" + pts, owner.hero.color, 15);
      if (t.n >= 3) this.floater(t.x, t.y - 34, "COMBO x" + t.n, "#ffe066", 17);
    });
    for (const s of spawns) this.powerups.push(s);
    this.shake(Math.min(15, 5 + count * 2.5));
    this.zoomPulse = Math.min(1, 0.4 + count * 0.15);
    this.audio?.explode(count);
    this.dangerDirty = true;
  }

  private boom(b: Bomb, queue: Bomb[], tally: Map<Player, { n: number; x: number; y: number }>, spawns: Powerup[]) {
    const o = b.owner;
    const cx = b.tx;
    const cy = b.ty;
    this.addFlame(cx, cy, o);
    this.burnPowerups(cx, cy);
    const px = (cx + 0.5) * TILE;
    const py = (cy + 0.5) * TILE;
    this.emit(px, py, 0, 0, 0.45, 3, "#ffd166", 0, 0, 20, 0);
    for (let k = 0; k < 14; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = 80 + Math.random() * 220;
      this.emit(px, py, Math.cos(a) * s, Math.sin(a) * s, 0.35 + Math.random() * 0.4, 0, Math.random() < 0.5 ? "#ffb347" : "#ff6b3c", 0, 0, 4 + Math.random() * 3, 0);
    }
    for (let d = 0; d < 4; d++) {
      for (let k = 1; k <= b.range; k++) {
        const x = cx + DX[d] * k;
        const y = cy + DY[d] * k;
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) break;
        const i = y * COLS + x;
        const t = this.grid[i];
        if (t === T_WALL) break;
        if (t === T_BLOCK) {
          this.breakBlock(x, y, o, tally, spawns, b);
          this.addFlame(x, y, o);
          break;
        }
        this.addFlame(x, y, o);
        this.burnPowerups(x, y);
        const other = this.bombGrid[i];
        if (other && !other.exploded) queue.push(other);
      }
    }
  }

  private breakBlock(x: number, y: number, owner: Player, tally: Map<Player, { n: number; x: number; y: number }>, spawns: Powerup[], from: Bomb) {
    const i = y * COLS + x;
    this.grid[i] = T_FLOOR;
    const px = (x + 0.5) * TILE;
    const py = (y + 0.5) * TILE;
    for (let k = 0; k < 7; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 190;
      this.emit(px, py, Math.cos(a) * s, Math.sin(a) * s - 90, 0.6 + Math.random() * 0.5, 2, DEBRIS[k % 4], Math.random() * 6, (Math.random() - 0.5) * 14, 5 + Math.random() * 4, 520);
    }
    const hk = this.hidden[i];
    if (hk) {
      const KINDS: PowerKind[] = ["bomb", "flame", "speed", "shield", "kick", "heart"];
      spawns.push({ kind: KINDS[hk - 1], x: x + 0.5, y: y + 0.5, t: 0 });
      this.hidden[i] = 0;
    }
    const t = tally.get(owner);
    if (t) t.n++;
    else tally.set(owner, { n: 1, x: (from.tx + 0.5) * TILE, y: (from.ty + 0.5) * TILE });
  }

  private addFlame(x: number, y: number, owner: Player) {
    const i = y * COLS + x;
    const ex = this.flameGrid[i];
    if (ex) {
      ex.t = FLAME_TIME;
      ex.max = FLAME_TIME;
      ex.owner = owner;
      return;
    }
    const f: Flame = { x, y, t: FLAME_TIME, max: FLAME_TIME, owner, seed: Math.random() * 6.28 };
    this.flames.push(f);
    this.flameGrid[i] = f;
    const px = (x + 0.5) * TILE;
    const py = (y + 0.5) * TILE;
    for (let k = 0; k < 2; k++) {
      this.emit(px + (Math.random() - 0.5) * 30, py + (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 50, -60 - Math.random() * 90, 0.5 + Math.random() * 0.4, 0, Math.random() < 0.5 ? "#ffd166" : "#ff8a3c", 0, 0, 3 + Math.random() * 3, 0);
    }
    this.emit(px, py, (Math.random() - 0.5) * 20, -30, 0.8, 1, "#59506e", 0, 0, 12, 0);
  }

  private burnPowerups(x: number, y: number) {
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const u = this.powerups[i];
      if (Math.floor(u.x) === x && Math.floor(u.y) === y && u.t > 0.25) {
        this.powerups.splice(i, 1);
        for (let k = 0; k < 6; k++) this.emit(u.x * TILE, u.y * TILE, (Math.random() - 0.5) * 160, (Math.random() - 0.5) * 160, 0.4, 0, "#ff8a3c", 0, 0, 3, 0);
      }
    }
  }

  private updateFlames(dt: number) {
    for (let i = this.flames.length - 1; i >= 0; i--) {
      const f = this.flames[i];
      f.t -= dt;
      if (f.t <= 0) {
        this.flames.splice(i, 1);
        if (this.flameGrid[f.y * COLS + f.x] === f) this.flameGrid[f.y * COLS + f.x] = null;
        this.dangerDirty = true;
      }
    }
  }

  /* ---------------------------------------------------------------- *
   *  Dégâts / mort / respawn
   * ---------------------------------------------------------------- */

  hurt(p: Player, by: Player | null) {
    if (!p.alive || p.invuln > 0 || p.dash) return;
    if (p.shield) {
      p.shield = false;
      p.invuln = 1.3;
      p.vib++;
      p.hurtFlash = 0.25;
      this.shake(8);
      this.audio?.shieldPop();
      this.emit(p.x * TILE, p.y * TILE, 0, 0, 0.5, 3, "#7cf5a1", 0, 0, 22, 0);
      for (let k = 0; k < 14; k++) {
        const a = Math.random() * 6.28;
        this.emit(p.x * TILE, p.y * TILE, Math.cos(a) * 200, Math.sin(a) * 200, 0.5, 0, "#b5ffd0", 0, 0, 4, 0);
      }
      this.floater(p.x * TILE, p.y * TILE - 30, "BOUCLIER !", "#7cf5a1", 14);
      return;
    }
    this.kill(p, by);
  }

  private kill(p: Player, by: Player | null) {
    if (!p.alive) return;
    p.alive = false;
    p.deathT = 0;
    p.dash = null;
    p.vib++;
    p.lives -= 1;
    const px = p.x * TILE;
    const py = p.y * TILE;
    if (by && by !== p) {
      by.score += 500;
      by.kills++;
      this.floater(px, py - 24, "+500 KO !", by.hero.color, 18);
    } else if (by === p) {
      this.floater(px, py - 24, "OUPS !", "#ff9aa8", 16);
    }
    if (this.cfg.mode === "solo" && p.kind === "human" && p.lives > 0) {
      p.respawnT = 1.8;
      this.floater(px, py - 44, "VIES : " + p.lives, "#ff6b9d", 14);
    }
    if (this.cfg.mode === "solo" && p.kind === "bot") {
      const kinds: PowerKind[] = ["bomb", "flame", "speed", "shield", "kick"];
      this.powerups.push({ kind: kinds[Math.floor(Math.random() * kinds.length)], x: Math.floor(p.x) + 0.5, y: Math.floor(p.y) + 0.5, t: 0 });
    }
    // Explosion de particules
    for (let k = 0; k < 26; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = 90 + Math.random() * 260;
      this.emit(px, py, Math.cos(a) * s, Math.sin(a) * s - 40, 0.6 + Math.random() * 0.6, k % 3 === 0 ? 4 : 0, k % 2 ? p.hero.color : "#ffffff", Math.random() * 6, 6, 4 + Math.random() * 4, 200);
    }
    this.emit(px, py, 0, 0, 0.6, 3, p.hero.color, 0, 0, 34, 0);
    this.shake(14);
    this.hitstop = Math.max(this.hitstop, 0.1);
    this.flash = 0.35;
    this.flashColor = "#ffffff";
    this.audio?.death();
    this.audio?.hit();
    this.dangerDirty = true;
  }

  private respawn(p: Player) {
    const spot = this.findFreeTile(p.spawnX, p.spawnY, 0, true);
    if (!spot) {
      p.lives = 0;
      return;
    }
    p.x = spot[0] + 0.5;
    p.y = spot[1] + 0.5;
    p.alive = true;
    p.invuln = 3;
    p.frozen = 0;
    p.dash = null;
    p.deathT = 0;
    p.skillCd = 0;
    this.emit(p.x * TILE, p.y * TILE, 0, 0, 0.6, 3, p.hero.color, 0, 0, 40, 0);
    for (let k = 0; k < 18; k++) {
      const a = Math.random() * 6.28;
      this.emit(p.x * TILE, p.y * TILE, Math.cos(a) * 180, Math.sin(a) * 180, 0.5, 4, "#ffffff", 0, 3, 5, 0);
    }
    this.audio?.pickup();
  }

  /** Cherche la case libre la plus proche (ou la plus lointaine si minDist > 0). */
  findFreeTile(sx: number, sy: number, minDist: number, nearest: boolean): [number, number] | null {
    const dng = this.getDanger();
    const cands: [number, number, number][] = [];
    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        const i = y * COLS + x;
        if (this.grid[i] !== T_FLOOR || this.bombGrid[i] || this.flameGrid[i]) continue;
        if (dng[i] !== Infinity) continue;
        let occ = false;
        for (const pl of this.players) if (pl.alive && this.overlapsTile(pl, x, y)) occ = true;
        if (occ) continue;
        const d = Math.abs(x - sx) + Math.abs(y - sy);
        if (d < minDist) continue;
        cands.push([x, y, d]);
      }
    }
    if (!cands.length) return null;
    if (nearest) {
      cands.sort((a, b) => a[2] - b[2]);
      return [cands[0][0], cands[0][1]];
    }
    const c = cands[Math.floor(Math.random() * cands.length)];
    return [c[0], c[1]];
  }

  private collect(p: Player, u: Powerup) {
    switch (u.kind) {
      case "bomb":
        if (p.maxBombs < 8) {
          p.maxBombs++;
          p.boostBombs++;
        }
        break;
      case "flame":
        if (p.range < 9) {
          p.range++;
          p.boostRange++;
        }
        break;
      case "speed":
        if (p.boostSpeed < 5) {
          p.speed += 0.5;
          p.boostSpeed++;
        }
        break;
      case "shield":
        p.shield = true;
        break;
      case "kick":
        p.kick = true;
        break;
      case "heart":
        p.lives = Math.min(p.lives + 1, 9);
        break;
    }
    p.score += 50;
    p.pickups++;
    const info = POWER_INFO[u.kind];
    const px = u.x * TILE;
    const py = u.y * TILE;
    this.floater(px, py - 24, info.label, info.color, 14);
    this.emit(px, py, 0, 0, 0.4, 3, info.color, 0, 0, 20, 0);
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * 6.28;
      this.emit(px, py, Math.cos(a) * 140, Math.sin(a) * 140, 0.5, 4, k % 2 ? info.color : "#ffffff", Math.random() * 6, 5, 4, 0);
    }
    if (u.kind === "heart") this.audio?.heart();
    else this.audio?.pickup();
  }

  private updatePowerups(dt: number) {
    for (const u of this.powerups) {
      u.t += dt;
      for (const p of this.players) {
        if (!p.alive || !p.hero.stats.magnet) continue;
        const dx = p.x - u.x;
        const dy = p.y - u.y;
        const d = Math.hypot(dx, dy);
        if (d < 3.6 && d > 0.05) {
          u.x += (dx / d) * 4.8 * dt;
          u.y += (dy / d) * 4.8 * dt;
          break;
        }
      }
    }
  }

  /* ---------------------------------------------------------------- *
   *  Compétences actives
   * ---------------------------------------------------------------- */

  useSkill(p: Player): boolean {
    if (!p.alive || p.skillCd > 0 || p.frozen > 0 || p.dash) return false;
    const kind = p.hero.skill.kind;
    const px = p.x * TILE;
    const py = p.y * TILE;
    let ok = false;
    switch (kind) {
      case "detonate": {
        let n = 0;
        for (const b of this.bombs) {
          if (b.owner === p && !b.exploded) {
            b.fuse = 0;
            n++;
          }
        }
        if (n > 0) {
          ok = true;
          this.emit(px, py, 0, 0, 0.5, 3, p.hero.color, 0, 0, 30, 0);
          this.floater(px, py - 30, "DÉTONATION !", p.hero.color, 14);
        }
        break;
      }
      case "dash": {
        p.dash = { dx: DX[p.facing], dy: DY[p.facing], left: 3.1 };
        p.invuln = Math.max(p.invuln, 0.55);
        ok = true;
        this.shake(3);
        break;
      }
      case "wall": {
        let x = Math.floor(p.x);
        let y = Math.floor(p.y);
        let placed = 0;
        for (let k = 1; k <= 3; k++) {
          x += DX[p.facing];
          y += DY[p.facing];
          if (x < 1 || y < 1 || x >= COLS - 1 || y >= ROWS - 1) break;
          const i = y * COLS + x;
          if (this.grid[i] !== T_FLOOR || this.bombGrid[i]) break;
          let occ = false;
          for (const pl of this.players) if (pl.alive && this.overlapsTile(pl, x, y)) occ = true;
          if (occ) break;
          this.grid[i] = T_BLOCK;
          this.hidden[i] = 0;
          this.pop[i] = 0.35 + k * 0.05;
          this.powerups = this.powerups.filter((u) => !(Math.floor(u.x) === x && Math.floor(u.y) === y));
          placed++;
          for (let q = 0; q < 8; q++) this.emit((x + 0.5) * TILE, (y + 0.5) * TILE + 14, (Math.random() - 0.5) * 160, -Math.random() * 60, 0.45, 1, "#a58b6b", 0, 0, 9, 0);
        }
        if (placed > 0) {
          ok = true;
          this.shake(5);
          this.dangerDirty = true;
        }
        break;
      }
      case "freeze": {
        let hit = 0;
        for (const o of this.players) {
          if (o === p || !o.alive) continue;
          if (Math.hypot(o.x - p.x, o.y - p.y) <= 4.4) {
            o.frozen = 2;
            hit++;
            for (let k = 0; k < 14; k++) {
              const a = Math.random() * 6.28;
              this.emit(o.x * TILE, o.y * TILE, Math.cos(a) * 150, Math.sin(a) * 150, 0.6, 4, "#bff3ff", Math.random() * 6, 6, 4, 0);
            }
            this.floater(o.x * TILE, o.y * TILE - 30, "GELÉ !", "#bff3ff", 14);
          }
        }
        ok = true;
        this.emit(px, py, 0, 0, 0.6, 3, "#8fe6ff", 0, 0, 4.4 * TILE, 0);
        this.flash = 0.2;
        this.flashColor = "#9eeaff";
        this.shake(hit > 0 ? 7 : 3);
        break;
      }
      case "teleport": {
        const spot = this.findFreeTile(Math.floor(p.x), Math.floor(p.y), 5, false) ?? this.findFreeTile(Math.floor(p.x), Math.floor(p.y), 2, false);
        if (spot) {
          for (let k = 0; k < 16; k++) {
            const a = Math.random() * 6.28;
            this.emit(px, py, Math.cos(a) * 140, Math.sin(a) * 140, 0.5, 4, p.hero.color, 0, 4, 5, 0);
          }
          this.emit(px, py, 0, 0, 0.45, 3, p.hero.color, 0, 0, 26, 0);
          p.x = spot[0] + 0.5;
          p.y = spot[1] + 0.5;
          p.invuln = Math.max(p.invuln, 0.4);
          const nx = p.x * TILE;
          const ny = p.y * TILE;
          this.emit(nx, ny, 0, 0, 0.45, 3, p.hero.color, 0, 0, 30, 0);
          for (let k = 0; k < 16; k++) {
            const a = Math.random() * 6.28;
            this.emit(nx, ny, Math.cos(a) * 160, Math.sin(a) * 160, 0.5, 0, "#ffffff", 0, 0, 3, 0);
          }
          ok = true;
          this.shake(3);
        }
        break;
      }
      case "barrage": {
        let x = Math.floor(p.x);
        let y = Math.floor(p.y);
        let placed = 0;
        for (let k = 1; k <= 4; k++) {
          x += DX[p.facing];
          y += DY[p.facing];
          if (x < 0 || y < 0 || x >= COLS || y >= ROWS) break;
          const i = y * COLS + x;
          if (this.grid[i] !== T_FLOOR) break;
          if (this.bombGrid[i]) continue;
          const b = this.placeBomb(p, { free: true, fuse: 0.9 + 0.2 * k, tx: x, ty: y });
          if (b) {
            placed++;
            this.emit((x + 0.5) * TILE, (y + 0.5) * TILE, 0, 0, 0.35, 3, p.hero.color, 0, 0, 16, 0);
          }
        }
        if (placed > 0) {
          ok = true;
          this.shake(4);
        }
        break;
      }
    }
    if (ok) {
      p.skillCd = p.hero.skill.cd;
      this.audio?.skill(kind);
    }
    return ok;
  }

  /* ---------------------------------------------------------------- *
   *  Mort subite
   * ---------------------------------------------------------------- */

  private updateSudden(dt: number) {
    if (this.time >= this.suddenAt) {
      if (!this.suddenStarted) {
        this.suddenStarted = true;
        this.banner = { title: "MORT SUBITE", sub: "Les murs se referment !", color: "#ff4d6d" };
        this.bannerShowUntil = this.clock + 2.2;
        this.shake(10);
        this.audio?.setIntensity(1);
        this.audio?.warn();
      }
      this.sdTimer -= dt;
      if (this.sdTimer <= 0 && this.sdIndex < this.sdOrder.length) {
        while (this.sdIndex < this.sdOrder.length && this.grid[this.sdOrder[this.sdIndex]] === T_WALL) this.sdIndex++;
        if (this.sdIndex < this.sdOrder.length) {
          const i = this.sdOrder[this.sdIndex++];
          this.warnings.push({ x: i % COLS, y: Math.floor(i / COLS), t: 0.8 });
          this.dangerDirty = true;
          this.audio?.warn();
        }
        this.sdTimer = 0.3;
      }
    }
    for (let k = this.warnings.length - 1; k >= 0; k--) {
      const w = this.warnings[k];
      w.t -= dt;
      if (w.t <= 0) {
        this.warnings.splice(k, 1);
        this.landWall(w.x, w.y);
      }
    }
  }
  bannerShowUntil = 0;

  private landWall(x: number, y: number) {
    const i = y * COLS + x;
    this.grid[i] = T_WALL;
    this.hidden[i] = 0;
    this.pop[i] = 0.3;
    const b = this.bombGrid[i];
    if (b) {
      b.exploded = true;
      const bi = this.bombs.indexOf(b);
      if (bi !== -1) this.bombs.splice(bi, 1);
      this.bombGrid[i] = null;
    }
    this.powerups = this.powerups.filter((u) => !(Math.floor(u.x) === x && Math.floor(u.y) === y));
    for (const p of this.players) {
      if (p.alive && Math.floor(p.x) === x && Math.floor(p.y) === y) this.kill(p, null);
    }
    const px = (x + 0.5) * TILE;
    const py = (y + 0.5) * TILE;
    for (let k = 0; k < 8; k++) this.emit(px + (Math.random() - 0.5) * 30, py + (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 140, -Math.random() * 90, 0.5, 1, "#8d95b8", 0, 0, 10, 0);
    this.emit(px, py, 0, 0, 0.3, 3, "#ff4d6d", 0, 0, 24, 0);
    this.shake(4);
    this.audio?.thud();
    this.dangerDirty = true;
  }

  /* ---------------------------------------------------------------- *
   *  Fin de manche / de partie
   * ---------------------------------------------------------------- */

  private checkRound(dt: number) {
    if (this.state === "banner") {
      if (this.stateT >= this.bannerDur) {
        if (this.cfg.mode === "solo") this.stage++;
        else this.round++;
        this.startRound();
      }
      return;
    }
    if (this.state !== "playing") return;

    if (this.cfg.mode === "solo") {
      const human = this.players[0];
      if (!human.alive && human.lives <= 0 && human.respawnT <= 0) {
        this.endT += dt;
        if (this.endT > 1.5) this.finish(null);
        return;
      }
      const botsAlive = this.players.some((p, i) => i > 0 && p.alive);
      if (!botsAlive && (human.alive || human.lives > 0)) {
        this.endT += dt;
        if (this.endT > 0.6) this.stageClear(human);
      } else {
        this.endT = 0;
      }
      return;
    }

    const alive = this.players.filter((p) => p.alive);
    if (alive.length <= 1) {
      this.endT += dt;
      if (this.endT > 1.3) this.roundEnd(alive[0] ?? null);
    } else {
      this.endT = 0;
    }
  }

  private stageClear(human: Player) {
    const timeBonus = Math.max(0, Math.floor(this.suddenAt - this.time)) * 10;
    const bonus = 500 * this.stage + timeBonus + human.lives * 250;
    human.score += bonus;
    this.state = "banner";
    this.stateT = 0;
    this.bannerDur = 3;
    this.banner = { title: "ÉTAPE " + this.stage + " TERMINÉE !", sub: "Bonus +" + bonus + "  (temps +" + timeBonus + ")", color: "#7cf5a1" };
    this.audio?.stageClear();
    this.audio?.setIntensity(0);
    this.shake(6);
    this.flash = 0.25;
    this.flashColor = "#9dffc0";
    for (let k = 0; k < 40; k++) {
      this.emit(human.x * TILE, human.y * TILE, (Math.random() - 0.5) * 420, -Math.random() * 380, 1.1, 4, ["#ffe066", "#7cf5a1", "#4da3ff", "#ff6b9d"][k % 4], Math.random() * 6, 7, 5, 500);
    }
  }

  private roundEnd(winner: Player | null) {
    this.state = "banner";
    this.stateT = 0;
    this.bannerDur = 3.2;
    if (winner) {
      winner.wins++;
      winner.score += 1000;
      this.banner = { title: winner.name + " GAGNE LA MANCHE !", sub: "Victoires : " + winner.wins + " / " + ROUNDS_TO_WIN, color: winner.hero.color };
      this.audio?.win();
      for (let k = 0; k < 40; k++) {
        this.emit(winner.x * TILE, winner.y * TILE, (Math.random() - 0.5) * 420, -Math.random() * 380, 1.1, 4, ["#ffe066", winner.hero.color, "#ffffff"][k % 3], Math.random() * 6, 7, 5, 500);
      }
      if (winner.wins >= ROUNDS_TO_WIN || this.round >= 5) {
        this.finish(winner.slot);
        return;
      }
    } else {
      this.banner = { title: "ÉGALITÉ !", sub: "Personne ne marque la manche", color: "#c8cff0" };
      this.audio?.lose();
      if (this.round >= 5) {
        const best = [...this.players].sort((a, b) => b.wins - a.wins || b.score - a.score)[0];
        this.finish(best.slot);
        return;
      }
    }
    this.flash = 0.2;
    this.flashColor = "#ffffff";
  }

  buildSummary(): GameSummary {
    const humans = this.players.filter((p) => p.kind === "human");
    const solo = this.cfg.mode === "solo";
    const standings = [...this.players]
      .map((p) => ({ slot: p.slot, name: p.name, heroId: p.hero.id, kind: p.kind, score: p.score, wins: p.wins, kills: p.kills }))
      .sort((a, b) => b.wins - a.wins || b.score - a.score);
    const top = solo ? humans[0] : [...humans].sort((a, b) => b.wins - a.wins || b.score - a.score)[0] ?? humans[0];
    const xp = humans.reduce((a, p) => a + p.score, 0);
    return {
      mode: this.cfg.mode,
      score: top ? top.score : 0,
      stage: this.stage,
      rounds: this.round,
      heroId: top ? top.hero.id : "ember",
      name: top ? top.name : "JOUEUR",
      winnerSlot: null,
      standings,
      blocks: humans.reduce((a, p) => a + p.blocks, 0),
      kills: humans.reduce((a, p) => a + p.kills, 0),
      pickups: humans.reduce((a, p) => a + p.pickups, 0),
      time: this.matchTime,
      xp,
    };
  }

  private finish(winnerSlot: number | null) {
    if (this.state === "over") return;
    this.state = "over";
    this.stateT = 0;
    const s = this.buildSummary();
    s.winnerSlot = winnerSlot;
    if (this.cfg.mode === "versus" && winnerSlot !== null) {
      const w = this.players.find((p) => p.slot === winnerSlot);
      if (w) s.heroId = w.hero.id;
    }
    this.summaryCache = s;
    const humanWon = this.cfg.mode === "versus" && winnerSlot !== null && this.players.find((p) => p.slot === winnerSlot)?.kind === "human";
    if (this.cfg.mode === "versus" && humanWon) this.audio?.win();
    else if (this.cfg.mode === "solo") this.audio?.lose();
    this.audio?.setIntensity(0);
    this.cb.onOver(s);
  }

  /* ---------------------------------------------------------------- *
   *  Cartes de danger (pour l'IA)
   * ---------------------------------------------------------------- */

  blastTiles(tx: number, ty: number, range: number): number[] {
    const out: number[] = [ty * COLS + tx];
    for (let d = 0; d < 4; d++) {
      for (let k = 1; k <= range; k++) {
        const x = tx + DX[d] * k;
        const y = ty + DY[d] * k;
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) break;
        const i = y * COLS + x;
        const t = this.grid[i];
        if (t === T_WALL) break;
        out.push(i);
        if (t === T_BLOCK) break;
      }
    }
    return out;
  }

  getDanger(): Float32Array {
    if (!this.dangerDirty && this.clock - this.dangerAt < 0.05) return this.danger;
    const dg = this.danger;
    dg.fill(Infinity);
    for (const f of this.flames) dg[f.y * COLS + f.x] = 0;
    const n = this.bombs.length;
    if (n) {
      const times = this.bombs.map((b) => b.fuse);
      const blasts = this.bombs.map((b) => this.blastTiles(b.tx, b.ty, b.range));
      for (let it = 0; it < n; it++) {
        let changed = false;
        for (let a = 0; a < n; a++) {
          for (const t of blasts[a]) {
            const ob = this.bombGrid[t];
            if (ob && ob !== this.bombs[a]) {
              const j = this.bombs.indexOf(ob);
              if (j !== -1 && times[j] > times[a]) {
                times[j] = times[a];
                changed = true;
              }
            }
          }
        }
        if (!changed) break;
      }
      for (let a = 0; a < n; a++) {
        const tm = Math.max(0, times[a]);
        for (const t of blasts[a]) if (tm < dg[t]) dg[t] = tm;
      }
    }
    for (const w of this.warnings) {
      const i = w.y * COLS + w.x;
      if (w.t < dg[i]) dg[i] = w.t;
    }
    this.dangerAt = this.clock;
    this.dangerDirty = false;
    return dg;
  }

  /* ---------------------------------------------------------------- *
   *  Effets
   * ---------------------------------------------------------------- */

  shake(a: number) {
    this.shakeAmp = Math.max(this.shakeAmp, a);
  }

  emit(x: number, y: number, vx: number, vy: number, life: number, type: number, color: string, rot: number, vr: number, size = 4, grav = 0) {
    if (this.parts.length >= MAX_PARTS) return;
    this.parts.push({ x, y, vx, vy, life, max: life, size, color, type, rot, vr, grav, drag: type === 1 ? 2.2 : type === 3 ? 0 : 1.2 });
  }

  floater(x: number, y: number, text: string, color: string, size: number) {
    this.floaters.push({ x, y, text, color, t: 0, max: 1.1, size });
  }

  private updateFx(dt: number) {
    const parts = this.parts;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        parts[i] = parts[parts.length - 1];
        parts.pop();
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k;
      if (p.grav === 0) p.vy *= k;
      p.rot += p.vr * dt;
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      f.y -= 38 * dt;
      if (f.t >= f.max) this.floaters.splice(i, 1);
    }
    for (let i = 0; i < this.pop.length; i++) if (this.pop[i] > 0) this.pop[i] = Math.max(0, this.pop[i] - dt);
    this.shakeAmp = Math.max(0, this.shakeAmp - dt * 34);
    this.shakeAmp *= Math.pow(0.9, dt * 60);
    if (this.flash > 0) this.flash -= dt;
    if (this.zoomPulse > 0) this.zoomPulse = Math.max(0, this.zoomPulse - dt * 3);
  }

  /* ---------------------------------------------------------------- *
   *  Accès UI
   * ---------------------------------------------------------------- */

  humanPlayer(): Player | null {
    return this.players.find((p) => p.kind === "human") ?? null;
  }

  padStatus(dev: string) {
    const p = this.cfg.mode === "solo" ? this.players[0] : this.players.find((pl) => pl.device === dev);
    if (!p) return null;
    return {
      hero: p.hero.id,
      name: p.hero.name,
      skill: p.hero.skill.name,
      color: p.hero.color,
      slot: p.slot,
      alive: p.alive,
      cd: Math.max(0, p.skillCd),
      cdMax: p.hero.skill.cd,
      vib: p.vib,
      state: this.state,
      lives: p.lives,
    };
  }

  static viewSize() {
    return { w: VIEW_W, h: VIEW_H, bw: BOARD_W, bh: BOARD_H };
  }
}
