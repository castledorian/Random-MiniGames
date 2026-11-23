import {
  CHEF_R,
  COL,
  CRATE_ITEM,
  HEROES,
  HOLES,
  ITEMS,
  COLS,
  kitchenById,
  MAP_H,
  MAP_W,
  RECIPES,
  PLATE_ORDER,
  ROUND_TIME,
  T,
  canon,
  clamp,
  lerp,
  pick,
  rand,
  type HeroId,
  type ItemId,
  type Kitchen,
} from './config';
import { audio } from './audio';
import { Controls, type PlayerInput } from './input';
import { buildStatic } from './draw';
import { renderGame } from './render';
import type { Mode } from './storage';
import type {
  Banner,
  Chef,
  FloatText,
  GameResult,
  Item,
  Order,
  Particle,
  PShape,
  Rat,
  Tile,
  TileType,
} from './types';

export type Phase = 'idle' | 'countdown' | 'playing' | 'over';

export interface GameConfig {
  mode: Mode;
  /** Solo : les 2 chefs entre lesquels on alterne. Co-op : un héros par joueur (2 à 4). */
  heroes: HeroId[];
  /** Co-op : périphérique de chaque joueur ("kbA", "kbB", "gp0"…, "ph:<pid>"). */
  devices?: (string | null)[];
  /** Pseudo de chaque joueur (co-op). */
  names?: string[];
  /** Identifiant de cuisine (voir KITCHENS). */
  kitchen?: string;
}

export interface Plan {
  label: string;
  bad?: boolean;
  run: () => void;
}

interface Emit {
  n: number;
  colors: string[];
  speed?: [number, number];
  angle?: [number, number];
  life?: [number, number];
  size?: [number, number];
  grav?: number;
  drag?: number;
  shape?: PShape;
  grow?: number;
  spin?: number;
}

const ZERO: PlayerInput = { mx: 0, my: 0, grab: false, work: false, dash: false, swap: false };
const TAU = Math.PI * 2;
const COUNTDOWN = 1.35;

const TILE_TYPE: Record<string, TileType> = {
  '#': 'counter',
  b: 'crate',
  m: 'crate',
  l: 'crate',
  t: 'crate',
  p: 'crate',
  c: 'board',
  s: 'stove',
  d: 'plates',
  w: 'window',
  x: 'trash',
};

const mk = (id: ItemId): Item => ({ id, prog: 0, plate: [], pop: 1 });

export class Game {
  controls: Controls;
  cfg: GameConfig = { mode: 'solo', heroes: ['blitz', 'zap'] };
  phase: Phase = 'idle';
  t = 0;
  dt = 1 / 60;

  tiles: Tile[][] = [];
  kitchen: Kitchen = kitchenById(undefined);
  /** Lignes dont les bords gauche/droite sont reliés par un tunnel. */
  tunnelRows = new Set<number>();
  /** Plats servis par chaque chef (co-op). */
  served: number[] = [];
  flat: Tile[] = [];
  stoves: Tile[] = [];
  chefs: Chef[] = [];
  active = 0;
  orders: Order[] = [];
  rats: Rat[] = [];
  parts: Particle[] = [];
  texts: FloatText[] = [];
  banners: Banner[] = [];

  timeLeft = ROUND_TIME;
  elapsed = 0;
  score = 0;
  scorePop = 0;
  combo = 0;
  bestCombo = 0;
  delivered = 0;
  expired = 0;
  smashed = 0;

  orderTimer = 0;
  ratTimer = 0;
  orderSeq = 0;
  cd = COUNTDOWN;
  lastCdNum = 4;
  lastSec = 999;
  endT = 0;
  ended = false;
  rushShown = false;
  swapCd = 0;

  trauma = 0;
  zoom = 0;
  freeze = 0;
  flash = 0;
  flashColor: string = COL.red;
  comboPulse = 0;

  result: GameResult | null = null;
  onEnd: ((r: GameResult) => void) | null = null;

  k = 1;
  staticCanvas: HTMLCanvasElement | null = null;

  constructor(controls: Controls) {
    this.controls = controls;
    this.setIdle(this.cfg);
  }

  // -------------------------------------------------------------------------
  // lifecycle
  // -------------------------------------------------------------------------
  setIdle(cfg: GameConfig) {
    this.reset(cfg);
    this.phase = 'idle';
  }

  reset(cfg: GameConfig) {
    this.cfg = cfg;
    this.tiles = [];
    this.flat = [];
    this.stoves = [];
    this.chefs = [];
    this.kitchen = kitchenById(cfg.kitchen);
    const MAP = this.kitchen.map;
    this.tunnelRows = new Set();
    const spawns: [number, number][] = [];
    for (let r = 0; r < MAP.length; r++) {
      const row: Tile[] = [];
      for (let c = 0; c < MAP[r].length; c++) {
        const ch = MAP[r][c];
        if (ch === '=' && (c === 0 || c === COLS - 1)) this.tunnelRows.add(r);
        const type: TileType = TILE_TYPE[ch] ?? 'floor';
        const tile: Tile = {
          c,
          r,
          type,
          crate: CRATE_ITEM[ch],
          item: null,
          cookMul: 1,
          burnMul: 1,
          bounce: 0,
          busy: 0,
          fx: 0,
          warnT: 0,
        };
        if (ch >= '1' && ch <= '4') spawns[Number(ch) - 1] = [c, r];
        row.push(tile);
        if (type !== 'floor') this.flat.push(tile);
        if (type === 'stove') this.stoves.push(tile);
      }
      this.tiles.push(row);
    }
    const n = this.coop ? Math.max(2, Math.min(4, cfg.heroes.length)) : 2;
    this.served = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const [sc, sr] = spawns[i] ?? spawns[i % 2];
      this.chefs.push({
        idx: i,
        hero: HEROES[cfg.heroes[i] ?? cfg.heroes[i % 2] ?? 'blitz'],
        device: this.coop ? (cfg.devices?.[i] ?? null) : null,
        name: cfg.names?.[i] ?? 'J' + (i + 1),
        x: (sc + 0.5) * T,
        y: (sr + 0.5) * T,
        vx: 0,
        vy: 0,
        fx: i % 2 === 0 ? 0.3 : -0.3,
        fy: -0.95,
        held: null,
        dashT: 0,
        dashCd: 0,
        dashDX: 0,
        dashDY: 0,
        dashSpeed: 0,
        slam: false,
        kbT: 0,
        chopping: false,
        autoChop: false,
        chopFx: 0,
        target: null,
        sx: 1,
        sy: 1,
        svx: 0,
        svy: 0,
        walk: 0,
        trailT: 0,
        bumpCd: 0,
        swapFlash: 0,
        input: ZERO,
        auto: false,
      });
    }
    this.active = 0;
    this.orders = [];
    this.rats = [];
    this.parts = [];
    this.texts = [];
    this.banners = [];
    this.timeLeft = ROUND_TIME;
    this.elapsed = 0;
    this.score = 0;
    this.scorePop = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.delivered = 0;
    this.expired = 0;
    this.smashed = 0;
    this.orderTimer = 0.4;
    this.ratTimer = 17;
    this.orderSeq = 0;
    this.cd = COUNTDOWN;
    this.lastCdNum = 4;
    this.lastSec = 999;
    this.endT = 0;
    this.ended = false;
    this.rushShown = false;
    this.swapCd = 0;
    this.trauma = 0;
    this.zoom = 0;
    this.freeze = 0;
    this.flash = 0;
    this.comboPulse = 0;
    this.result = null;
    this.phase = 'countdown';
    this.controls.clearLatches();
    this.staticCanvas = buildStatic(this.tiles, this.k);
  }

  resize(k: number) {
    this.k = k;
    this.staticCanvas = buildStatic(this.tiles, k);
  }

  get coop() {
    return this.cfg.mode === 'coop';
  }

  // -------------------------------------------------------------------------
  // fx helpers
  // -------------------------------------------------------------------------
  shake(a: number) {
    this.trauma = Math.min(1, this.trauma + a);
  }

  emit(x: number, y: number, o: Emit) {
    if (this.parts.length > 650) return;
    const sp = o.speed ?? [40, 160];
    const an = o.angle ?? [0, TAU];
    const li = o.life ?? [0.4, 0.8];
    const sz = o.size ?? [3, 6];
    for (let i = 0; i < o.n; i++) {
      const a = rand(an[0], an[1]);
      const s = rand(sp[0], sp[1]);
      const life = rand(li[0], li[1]);
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        max: life,
        size: rand(sz[0], sz[1]),
        color: pick(o.colors),
        shape: o.shape ?? 'circle',
        grav: o.grav ?? 0,
        drag: o.drag ?? 0,
        rot: rand(0, TAU),
        vr: rand(-1, 1) * (o.spin ?? 8),
        grow: o.grow ?? 0,
      });
    }
  }

  ring(x: number, y: number, size: number, grow: number, color: string, life = 0.4) {
    this.parts.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life,
      max: life,
      size,
      color,
      shape: 'ring',
      grav: 0,
      drag: 0,
      rot: 0,
      vr: 0,
      grow,
    });
  }

  text(x: number, y: number, s: string, color: string, size = 24, life = 0.95) {
    this.texts.push({ x, y, vy: -70, text: s, color, size, life, max: life });
  }

  banner(text: string, color: string, size = 72, dur = 1.2, sub?: string) {
    this.banners.push({ text, color, t: 0, dur, size, sub });
  }

  // -------------------------------------------------------------------------
  // main update
  // -------------------------------------------------------------------------
  update(rawDt: number) {
    const dt = Math.min(rawDt, 1 / 30);
    this.dt = dt;
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    this.zoom = Math.max(0, this.zoom - dt * 0.35);
    this.flash = Math.max(0, this.flash - dt * 2.4);
    this.scorePop = Math.max(0, this.scorePop - dt * 4);
    this.comboPulse = Math.max(0, this.comboPulse - dt * 2);
    this.swapCd = Math.max(0, this.swapCd - dt);

    if (this.freeze > 0) {
      this.freeze -= dt;
      return;
    }

    // ----- inputs -----
    const live = this.phase === 'playing' || this.phase === 'countdown';
    if (live) {
      if (this.coop) {
        // chaque chef lit son propre périphérique (clavier A/B, manette, téléphone)
        const inputs = this.controls.pollDevices(this.chefs.map((c) => c.device));
        this.chefs.forEach((c, i) => {
          c.input = inputs[i];
          c.auto = false;
        });
      } else {
        const inputs = this.controls.poll(false);
        const inp = inputs[0];
        if (inp.swap) this.swap();
        this.chefs.forEach((c, i) => {
          if (i === this.active) {
            c.input = inp;
            c.auto = false;
          } else {
            c.input = ZERO;
            c.auto = true;
          }
        });
      }
    } else {
      for (const c of this.chefs) {
        c.input = ZERO;
        c.auto = false;
      }
    }

    // ----- phases -----
    if (this.phase === 'countdown') {
      this.cd -= dt;
      const n = Math.max(0, Math.ceil(this.cd / (COUNTDOWN / 3)));
      if (n !== this.lastCdNum && n > 0) {
        this.lastCdNum = n;
        audio.tick();
      }
      if (this.cd <= 0) {
        this.phase = 'playing';
        this.lastCdNum = 0;
        audio.go();
        this.banner('GO !', COL.yellow, 96, 0.8);
        this.shake(0.25);
        this.zoom = 0.03;
      }
    } else if (this.phase === 'playing') {
      this.timeLeft -= dt;
      this.elapsed += dt;
      this.updateOrders(dt);
      this.updateRatSpawner(dt);
      audio.setIntensity(this.timeLeft < 25 ? 1 - this.timeLeft / 25 : 0);
      const sec = Math.ceil(this.timeLeft);
      if (this.timeLeft <= 10 && sec !== this.lastSec) {
        this.lastSec = sec;
        audio.warn();
        this.flashColor = COL.red;
        this.flash = Math.max(this.flash, 0.12);
      }
      if (!this.rushShown && this.elapsed >= 60) {
        this.rushShown = true;
        this.banner('COUP DE FEU !', COL.orange, 80, 1.5, 'les commandes s’accélèrent');
        this.shake(0.3);
        audio.alarm();
      }
      if (this.timeLeft <= 0) this.finish();
    } else if (this.phase === 'over') {
      this.endT += dt;
      if (!this.ended && this.endT > 1.5) {
        this.ended = true;
        if (this.result) this.onEnd?.(this.result);
      }
    }

    // ----- entities -----
    const act = this.phase === 'playing';
    for (const c of this.chefs) this.updateChef(c, dt, act);
    this.chefVsChef();
    this.updateTiles(dt);
    this.updateRats(dt);
    this.updateFx(dt);

    // touch dash HUD
    const ac = this.chefs[this.active];
    this.controls.touch.dashCd = ac.dashCd / ac.hero.cd;
  }

  /** Idle animation (menus): only visuals. */
  updateIdle(dt: number) {
    this.dt = Math.min(dt, 1 / 30);
    this.t += dt;
    this.updateFx(Math.min(dt, 1 / 30));
    for (const c of this.chefs) this.updateChef(c, Math.min(dt, 1 / 30), false);
  }

  private updateFx(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.parts[i] = this.parts[this.parts.length - 1];
        this.parts.pop();
        continue;
      }
      if (p.drag) {
        const f = Math.exp(-p.drag * dt);
        p.vx *= f;
        p.vy *= f;
      }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.size = Math.max(0, p.size + p.grow * dt);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const f = this.texts[i];
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= Math.exp(-2.2 * dt);
      if (f.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.banners.length - 1; i >= 0; i--) {
      const b = this.banners[i];
      b.t += dt;
      if (b.t >= b.dur) this.banners.splice(i, 1);
    }
  }

  // -------------------------------------------------------------------------
  // solo swap
  // -------------------------------------------------------------------------
  swap() {
    if (this.coop || this.swapCd > 0) return;
    this.swapCd = 0.15;
    this.active = 1 - this.active;
    const n = this.chefs[this.active];
    n.swapFlash = 0.7;
    n.sx = 1.35;
    n.sy = 0.75;
    this.ring(n.x, n.y + 6, 10, 220, n.hero.color, 0.45);
    this.emit(n.x, n.y, {
      n: 10,
      colors: [n.hero.color, '#fff', n.hero.accent],
      speed: [60, 180],
      life: [0.3, 0.5],
      size: [3, 5],
      shape: 'star',
    });
    audio.swap();
  }

  // -------------------------------------------------------------------------
  // chefs
  // -------------------------------------------------------------------------
  private updateChef(c: Chef, dt: number, act: boolean) {
    const inp = c.input;
    const h = c.hero;
    c.dashCd = Math.max(0, c.dashCd - dt);
    c.bumpCd = Math.max(0, c.bumpCd - dt);
    c.swapFlash = Math.max(0, c.swapFlash - dt);
    c.kbT = Math.max(0, c.kbT - dt);
    if (c.held) c.held.pop = Math.max(0, c.held.pop - dt * 5);

    const ml = Math.hypot(inp.mx, inp.my);
    if (ml > 0.25) {
      c.fx = inp.mx / ml;
      c.fy = inp.my / ml;
    }

    if (c.dashT > 0) {
      c.dashT -= dt;
      c.vx = c.dashDX * c.dashSpeed;
      c.vy = c.dashDY * c.dashSpeed;
      c.trailT -= dt;
      if (c.trailT <= 0) {
        c.trailT = 0.02;
        this.parts.push({
          x: c.x,
          y: c.y,
          vx: 0,
          vy: 0,
          life: 0.22,
          max: 0.22,
          size: 19,
          color: h.color,
          shape: 'circle',
          grav: 0,
          drag: 0,
          rot: 0,
          vr: 0,
          grow: -60,
        });
      }
      if (c.dashT <= 0) {
        c.dashT = 0;
        this.endDash(c);
      }
    } else if (c.kbT > 0) {
      const f = Math.exp(-5 * dt);
      c.vx *= f;
      c.vy *= f;
    } else {
      const sp = h.speed * (c.held ? 0.94 : 1) * (c.chopping ? 0.45 : 1);
      const acc = ml > 0.05 ? 19 : 28;
      const k = 1 - Math.exp(-acc * dt);
      c.vx += (inp.mx * sp - c.vx) * k;
      c.vy += (inp.my * sp - c.vy) * k;
    }

    if (act && inp.dash && c.dashCd <= 0 && c.dashT <= 0 && c.kbT <= 0) {
      const dx = ml > 0.25 ? inp.mx / ml : c.fx;
      const dy = ml > 0.25 ? inp.my / ml : c.fy;
      this.useAbility(c, dx, dy);
    }

    this.moveChef(c, dt);

    // dash vs rats
    if (c.dashT > 0) {
      for (const r of this.rats) {
        if (r.state !== 'flung' && Math.hypot(r.x - c.x, r.y - c.y) < 36) this.smashRat(r, c.x - c.dashDX * 20, c.y - c.dashDY * 20);
      }
    }

    // walk cycle + dust
    const spd = Math.hypot(c.vx, c.vy);
    if (spd > 25) {
      c.walk += dt * spd * 0.05;
      c.trailT -= c.dashT > 0 ? 0 : dt;
      if (spd > 150 && c.dashT <= 0 && Math.random() < dt * 9) {
        this.emit(c.x - c.vx * 0.04, c.y + 18, {
          n: 1,
          colors: ['rgba(120,90,50,.45)'],
          speed: [5, 20],
          life: [0.25, 0.4],
          size: [3, 5],
          grow: 14,
          shape: 'smoke',
        });
      }
    }
    // squash & stretch spring
    const kx = (1 - c.sx) * 340 - c.svx * 15;
    const ky = (1 - c.sy) * 340 - c.svy * 15;
    c.svx += kx * dt;
    c.svy += ky * dt;
    c.sx += c.svx * dt;
    c.sy += c.svy * dt;

    // targeting + actions
    c.target = this.findTarget(c);
    if (act) {
      if (inp.grab) this.doGrab(c);
      this.doWork(c, dt, inp.work);
    } else {
      c.chopping = false;
    }
  }

  private useAbility(c: Chef, dx: number, dy: number) {
    const h = c.hero;
    c.chopping = false;
    c.fx = dx;
    c.fy = dy;
    if (h.ability === 'blink') {
      if (!this.blink(c, dx, dy)) {
        c.dashCd = 0.35;
        this.text(c.x, c.y - 44, 'BLOQUÉ', COL.red, 20, 0.6);
        audio.deny();
        return;
      }
    } else {
      c.dashDX = dx;
      c.dashDY = dy;
      c.slam = h.ability === 'slam';
      c.dashT = c.slam ? 0.15 : 0.2;
      c.dashSpeed = c.slam ? 700 : 880;
      c.trailT = 0;
      this.stretch(c, dx, dy);
      this.emit(c.x - dx * 14, c.y + 14, {
        n: 10,
        colors: ['rgba(120,90,50,.55)', 'rgba(255,255,255,.6)'],
        angle: [Math.atan2(-dy, -dx) - 0.7, Math.atan2(-dy, -dx) + 0.7],
        speed: [60, 220],
        life: [0.25, 0.5],
        size: [3, 7],
        grow: 14,
        shape: 'smoke',
      });
      this.shake(c.slam ? 0.18 : 0.14);
      audio.dash();
    }
    c.dashCd = h.cd;
  }

  private stretch(c: Chef, dx: number, dy: number) {
    if (Math.abs(dx) > Math.abs(dy)) {
      c.sx = 1.4;
      c.sy = 0.72;
    } else {
      c.sx = 0.74;
      c.sy = 1.32;
    }
  }

  private endDash(c: Chef) {
    c.vx *= 0.35;
    c.vy *= 0.35;
    if (c.slam) {
      c.slam = false;
      this.slamWave(c);
    }
  }

  private slamWave(c: Chef) {
    const R = 140;
    audio.slam();
    this.shake(0.75);
    this.zoom = 0.045;
    this.freeze = 0.06;
    c.sx = 1.4;
    c.sy = 0.6;
    this.ring(c.x, c.y + 8, 20, 640, '#ffffff', 0.35);
    this.ring(c.x, c.y + 8, 10, 480, c.hero.color, 0.45);
    this.ring(c.x, c.y + 8, 4, 330, c.hero.accent, 0.55);
    this.emit(c.x, c.y + 12, {
      n: 26,
      colors: ['rgba(140,110,70,.6)', 'rgba(255,255,255,.7)', '#ffe08a'],
      speed: [120, 360],
      life: [0.35, 0.7],
      size: [4, 9],
      grow: 10,
      drag: 3,
      shape: 'smoke',
    });
    for (const r of this.rats) {
      if (r.state !== 'flung' && Math.hypot(r.x - c.x, r.y - c.y) < R) this.smashRat(r, c.x, c.y);
    }
    for (const o of this.chefs) {
      if (o === c) continue;
      const dx = o.x - c.x;
      const dy = o.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < R) {
        o.vx = (dx / d) * 620;
        o.vy = (dy / d) * 620;
        o.kbT = 0.28;
        o.chopping = false;
        o.sx = 0.7;
        o.sy = 1.3;
        this.text(o.x, o.y - 46, 'OUPS !', c.hero.color, 24, 0.7);
      }
    }
    for (const t of this.flat) {
      const d = Math.hypot((t.c + 0.5) * T - c.x, (t.r + 0.5) * T - c.y);
      if (d < R + 40) t.bounce = Math.max(t.bounce, 1 - d / (R + 40));
    }
  }

  private blink(c: Chef, dx: number, dy: number): boolean {
    const maxD = 256;
    let best = -1;
    for (let d = maxD; d >= 72; d -= 8) {
      const nx = c.x + dx * d;
      const ny = c.y + dy * d;
      if (!this.validPos(nx, ny, CHEF_R)) continue;
      if (this.chefs.some((o) => o !== c && Math.hypot(nx - o.x, ny - o.y) < CHEF_R * 2 + 2)) continue;
      best = d;
      break;
    }
    if (best < 0) return false;
    const ox = c.x;
    const oy = c.y;
    const nx = ox + dx * best;
    const ny = oy + dy * best;
    // vanish fx
    this.emit(ox, oy, {
      n: 18,
      colors: [c.hero.color, c.hero.accent, '#fff'],
      speed: [40, 240],
      life: [0.3, 0.6],
      size: [3, 7],
      shape: 'star',
      grav: -40,
    });
    this.ring(ox, oy + 8, 8, 280, c.hero.accent, 0.4);
    // sparkle trail
    const steps = Math.floor(best / 18);
    for (let i = 0; i <= steps; i++) {
      const px = ox + dx * (best * (i / steps));
      const py = oy + dy * (best * (i / steps));
      this.emit(px, py, {
        n: 1,
        colors: [c.hero.color, c.hero.accent],
        speed: [10, 50],
        life: [0.25, 0.6],
        size: [4, 9],
        shape: 'circle',
        grow: -14,
      });
    }
    c.x = nx;
    c.y = ny;
    c.vx = dx * 160;
    c.vy = dy * 160;
    this.emit(nx, ny, {
      n: 22,
      colors: [c.hero.color, c.hero.accent, '#fff'],
      speed: [60, 280],
      life: [0.3, 0.6],
      size: [3, 7],
      shape: 'star',
    });
    this.ring(nx, ny + 8, 8, 320, '#fff', 0.35);
    this.ring(nx, ny + 8, 4, 220, c.hero.color, 0.5);
    c.sx = 0.55;
    c.sy = 1.5;
    this.shake(0.28);
    audio.blink();
    // rats on the path or at arrival
    for (const r of this.rats) {
      if (r.state === 'flung') continue;
      const t = clamp(((r.x - ox) * dx + (r.y - oy) * dy) / best, 0, 1);
      const px = ox + dx * best * t;
      const py = oy + dy * best * t;
      if (Math.hypot(r.x - px, r.y - py) < 40) this.smashRat(r, px - dx * 10, py - dy * 10);
    }
    return true;
  }

  private chefVsChef() {
    for (let i = 0; i < this.chefs.length; i++) {
      for (let j = i + 1; j < this.chefs.length; j++) this.chefPair(this.chefs[i], this.chefs[j]);
    }
  }

  private chefPair(a: Chef, b: Chef) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    const min = CHEF_R * 2;
    if (d < min) {
      const nx = d > 0.001 ? dx / d : 1;
      const ny = d > 0.001 ? dy / d : 0;
      const o = (min - d) / 2;
      a.x -= nx * o;
      a.y -= ny * o;
      b.x += nx * o;
      b.y += ny * o;
      this.resolveTiles(a);
      this.resolveTiles(b);
      if (a.dashT > 0 && b.bumpCd <= 0) this.bump(a, b);
      else if (b.dashT > 0 && a.bumpCd <= 0) this.bump(b, a);
    }
  }

  private bump(att: Chef, vic: Chef) {
    const dx = vic.x - att.x;
    const dy = vic.y - att.y;
    const d = Math.hypot(dx, dy) || 1;
    vic.vx = (dx / d) * 560;
    vic.vy = (dy / d) * 560;
    vic.kbT = 0.24;
    vic.bumpCd = 0.45;
    vic.chopping = false;
    vic.sx = 0.7;
    vic.sy = 1.3;
    att.vx *= 0.4;
    att.vy *= 0.4;
    this.shake(0.35);
    this.freeze = 0.05;
    audio.bump();
    this.text(vic.x, vic.y - 46, 'BONK !', att.hero.color, 26, 0.7);
    this.emit((att.x + vic.x) / 2, (att.y + vic.y) / 2, {
      n: 12,
      colors: ['#fff', COL.yellow, att.hero.color],
      speed: [80, 260],
      life: [0.25, 0.5],
      size: [4, 8],
      shape: 'star',
    });
  }

  private solid(c: number, r: number): boolean {
    // au-delà du bord d'une ligne-tunnel : passage libre (on ressort de l'autre côté)
    if ((c < 0 || c >= COLS) && this.tunnelRows.has(r)) return false;
    const t = this.tiles[r]?.[c];
    return !t || t.type !== 'floor';
  }

  private resolveTiles(c: Chef) {
    const R = CHEF_R;
    for (let it = 0; it < 2; it++) {
      const cc = Math.floor(c.x / T);
      const rr = Math.floor(c.y / T);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const tc = cc + dc;
          const tr = rr + dr;
          if (!this.solid(tc, tr)) continue;
          const tx = tc * T;
          const ty = tr * T;
          const px = clamp(c.x, tx, tx + T);
          const py = clamp(c.y, ty, ty + T);
          const dx = c.x - px;
          const dy = c.y - py;
          const d2 = dx * dx + dy * dy;
          if (d2 >= R * R) continue;
          if (d2 < 1e-6) {
            const l = c.x - tx;
            const rgt = tx + T - c.x;
            const tp = c.y - ty;
            const bt = ty + T - c.y;
            const m = Math.min(l, rgt, tp, bt);
            if (m === l) c.x = tx - R;
            else if (m === rgt) c.x = tx + T + R;
            else if (m === tp) c.y = ty - R;
            else c.y = ty + T + R;
          } else {
            const d = Math.sqrt(d2);
            const nx = dx / d;
            const ny = dy / d;
            c.x += nx * (R - d);
            c.y += ny * (R - d);
            const vn = c.vx * nx + c.vy * ny;
            if (vn < 0) {
              c.vx -= vn * nx;
              c.vy -= vn * ny;
            }
          }
        }
      }
    }
    const row = Math.floor(c.y / T);
    if (this.tunnelRows.has(row)) {
      // tunnel : on ressort par le bord opposé
      if (c.x < 0) c.x += MAP_W;
      else if (c.x >= MAP_W) c.x -= MAP_W;
    } else c.x = clamp(c.x, R, MAP_W - R);
    c.y = clamp(c.y, R, MAP_H - R);
  }

  private validPos(x: number, y: number, R: number): boolean {
    if (x < R || y < R || x > MAP_W - R || y > MAP_H - R) return false;
    const cc = Math.floor(x / T);
    const rr = Math.floor(y / T);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!this.solid(cc + dc, rr + dr)) continue;
        const tx = (cc + dc) * T;
        const ty = (rr + dr) * T;
        const px = clamp(x, tx, tx + T);
        const py = clamp(y, ty, ty + T);
        if ((x - px) * (x - px) + (y - py) * (y - py) < R * R) return false;
      }
    }
    return true;
  }

  private moveChef(c: Chef, dt: number) {
    const steps = Math.max(1, Math.ceil((Math.hypot(c.vx, c.vy) * dt) / 10));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      c.x += c.vx * sdt;
      c.y += c.vy * sdt;
      this.resolveTiles(c);
    }
  }

  // -------------------------------------------------------------------------
  // targeting & interactions
  // -------------------------------------------------------------------------
  private findTarget(c: Chef): Tile | null {
    const reach = T * 0.95 * c.hero.reach;
    const px = c.x + c.fx * T * 0.5;
    const py = c.y + c.fy * T * 0.5;
    const cc = Math.floor(c.x / T);
    const rr = Math.floor(c.y / T);
    const span = c.hero.reach > 1.2 ? 3 : 2;
    let best: Tile | null = null;
    let bd = Infinity;
    for (let r = rr - span; r <= rr + span; r++) {
      for (let q = cc - span; q <= cc + span; q++) {
        const t = this.tiles[r]?.[q];
        if (!t || t.type === 'floor') continue;
        const d = Math.hypot(px - (q + 0.5) * T, py - (r + 0.5) * T);
        if (d < reach && d < bd) {
          bd = d;
          best = t;
        }
      }
    }
    return best;
  }

  private canAdd(plate: Item, id: ItemId): boolean {
    if (!ITEMS[id].plate || plate.plate.includes(id)) return false;
    const next = [...plate.plate, id];
    return RECIPES.some((r) => next.every((x) => r.items.includes(x)));
  }

  private addToPlate(plate: Item, id: ItemId) {
    plate.plate.push(id);
    plate.plate.sort((a, b) => PLATE_ORDER.indexOf(a) - PLATE_ORDER.indexOf(b));
    plate.pop = 1;
  }

  private accepts(tile: Tile, it: Item): boolean {
    if (tile.type === 'counter') return true;
    const d = ITEMS[it.id];
    if (tile.type === 'board') return !!d.chop || it.id.endsWith('_chop');
    if (tile.type === 'stove') return !!d.cook;
    return false;
  }

  /** What would pressing GRAB do for this chef on this tile? (used for labels + execution) */
  plan(c: Chef, tile: Tile): Plan | null {
    const h = c.held;
    const deny = () => this.deny(c, tile);
    switch (tile.type) {
      case 'crate':
        if (h) return { label: 'MAINS PLEINES', bad: true, run: deny };
        return {
          label: 'PRENDRE',
          run: () => {
            c.held = mk(tile.crate!);
            this.tileFx(c, tile, true);
            audio.take();
          },
        };
      case 'plates':
        if (h) return { label: 'MAINS PLEINES', bad: true, run: deny };
        return {
          label: 'ASSIETTE',
          run: () => {
            c.held = mk('plate');
            this.tileFx(c, tile, true);
            audio.take();
          },
        };
      case 'trash':
        if (!h) return null;
        return { label: 'JETER', run: () => this.trashIt(c, tile) };
      case 'window':
        if (!h) return null;
        if (h.id !== 'plate') return { label: 'IL FAUT UNE ASSIETTE', bad: true, run: deny };
        if (h.plate.length === 0) return { label: 'ASSIETTE VIDE', bad: true, run: deny };
        return { label: 'SERVIR', run: () => this.serve(c, tile) };
      default: {
        const s = tile.item;
        if (h && !s) {
          if (!this.accepts(tile, h)) {
            return { label: tile.type === 'stove' ? "CAN'T COOK" : "CAN'T CHOP", bad: true, run: deny };
          }
          return { label: 'POSER', run: () => this.putOn(c, tile) };
        }
        if (!h && s) {
          const chopable = tile.type === 'board' && !!ITEMS[s.id].chop;
          return { label: chopable ? 'MAINTENIR : COUPER' : 'PRENDRE', run: () => this.takeFrom(c, tile) };
        }
        if (h && s) {
          if (h.id === 'plate' && s.id !== 'plate' && this.canAdd(h, s.id)) {
            return {
              label: 'AJOUTER',
              run: () => {
                this.addToPlate(h, s.id);
                tile.item = null;
                tile.cookMul = 1;
                tile.burnMul = 1;
                this.tileFx(c, tile, false);
                audio.pickup();
              },
            };
          }
          if (s.id === 'plate' && h.id !== 'plate' && this.canAdd(s, h.id)) {
            return {
              label: 'AJOUTER',
              run: () => {
                this.addToPlate(s, h.id);
                c.held = null;
                tile.bounce = 1;
                this.tileFx(c, tile, false);
                audio.place();
              },
            };
          }
          return { label: 'PLEIN', bad: true, run: deny };
        }
        return null;
      }
    }
  }

  private doGrab(c: Chef) {
    const tile = c.target;
    if (!tile) {
      if (c.held) this.deny(c, null);
      return;
    }
    const p = this.plan(c, tile);
    if (p) p.run();
  }

  private deny(c: Chef, tile: Tile | null) {
    audio.deny();
    c.sx = 1.2;
    c.sy = 0.86;
    this.shake(0.06);
    const x = tile ? (tile.c + 0.5) * T : c.x;
    const y = tile ? tile.r * T - 6 : c.y - 40;
    this.text(x, y, '✗', COL.red, 28, 0.5);
  }

  private tileFx(c: Chef, tile: Tile, crate: boolean) {
    tile.bounce = 1;
    c.sx = 0.82;
    c.sy = 1.2;
    this.emit((tile.c + 0.5) * T, (tile.r + 0.5) * T, {
      n: crate ? 8 : 5,
      colors: ['#fff', COL.yellow, c.hero.accent],
      speed: [40, 130],
      life: [0.25, 0.45],
      size: [2, 4.5],
      grav: 120,
    });
  }

  private takeFrom(c: Chef, tile: Tile) {
    const it = tile.item!;
    tile.item = null;
    tile.cookMul = 1;
    tile.burnMul = 1;
    tile.busy = 0;
    it.pop = 0.7;
    c.held = it;
    this.tileFx(c, tile, false);
    audio.pickup();
  }

  private putOn(c: Chef, tile: Tile) {
    const it = c.held!;
    c.held = null;
    tile.item = it;
    it.pop = 1;
    if (tile.type === 'stove') {
      tile.cookMul = c.hero.cookMul;
      tile.burnMul = c.hero.burnMul;
    }
    this.tileFx(c, tile, false);
    audio.place();
  }

  private trashIt(c: Chef, tile: Tile) {
    const h = c.held!;
    const burnt = h.id === 'burnt';
    if (h.id === 'plate' && h.plate.length > 0) h.plate = [];
    else c.held = null;
    tile.bounce = 1.2;
    this.shake(0.08);
    audio.trash();
    this.emit((tile.c + 0.5) * T, (tile.r + 0.5) * T, {
      n: burnt ? 10 : 14,
      colors: burnt ? ['#2d2625', '#555', '#ff7a2a'] : ['#74d94c', '#ff5757', '#f6c56e', '#ee6f84'],
      speed: [60, 200],
      angle: [-Math.PI * 0.95, -Math.PI * 0.05],
      life: [0.3, 0.6],
      size: [3, 6],
      grav: 500,
      shape: 'square',
    });
  }

  private doWork(c: Chef, dt: number, workHeld: boolean) {
    const tile = c.target;
    const h = c.hero;
    const def = tile && tile.type === 'board' && tile.item ? ITEMS[tile.item.id].chop : undefined;
    const want = !!def && (workHeld || c.auto) && c.dashT <= 0 && c.kbT <= 0;
    c.chopping = want;
    c.autoChop = want && c.auto;
    if (!want || !tile || !tile.item || !def) return;
    const rate = c.auto ? 0.6 : 1;
    tile.item.prog += (dt * h.prep * rate) / def.time;
    tile.busy = 0.12;
    c.chopFx -= dt;
    if (c.chopFx <= 0) {
      c.chopFx = clamp(0.15 / (h.prep * rate), 0.07, 0.3);
      tile.bounce = 0.45;
      c.sy = 0.88;
      c.sx = 1.08;
      audio.chop();
      const id = tile.item.id;
      const cols =
        id === 'lettuce_raw' ? ['#74d94c', '#b9f59b'] : id === 'tomato_raw' ? ['#ff4d4d', '#ffb4a6'] : ['#f5e29a', '#cf9a58'];
      this.emit((tile.c + 0.5) * T, (tile.r + 0.5) * T, {
        n: 4,
        colors: cols,
        speed: [60, 190],
        angle: [-Math.PI * 0.95, -Math.PI * 0.05],
        life: [0.25, 0.5],
        size: [2, 4.5],
        grav: 520,
        shape: 'square',
      });
    }
    if (tile.item.prog >= 1) {
      tile.item.id = def.to;
      tile.item.prog = 0;
      tile.item.pop = 1;
      tile.bounce = 1;
      audio.chopDone();
      this.text((tile.c + 0.5) * T, tile.r * T - 4, 'COUPÉ !', COL.mint, 20, 0.7);
      this.emit((tile.c + 0.5) * T, (tile.r + 0.5) * T, {
        n: 10,
        colors: ['#fff', COL.yellow, COL.mint],
        speed: [60, 200],
        life: [0.3, 0.55],
        size: [3, 6],
        shape: 'star',
      });
    }
  }

  // -------------------------------------------------------------------------
  // stations: stove processing
  // -------------------------------------------------------------------------
  private updateTiles(dt: number) {
    for (const t of this.flat) {
      if (t.bounce > 0) t.bounce = Math.max(0, t.bounce - dt * 4.5);
      if (t.busy > 0) t.busy -= dt;
      if (t.item && t.item.pop > 0) t.item.pop = Math.max(0, t.item.pop - dt * 5);
    }
    for (const t of this.stoves) {
      const it = t.item;
      if (!it) {
        t.warnT = 0;
        continue;
      }
      if (this.phase !== 'playing') continue;
      const d = ITEMS[it.id];
      const cx = (t.c + 0.5) * T;
      const cy = (t.r + 0.5) * T;
      if (d.cook) {
        it.prog += (dt * t.cookMul) / d.cook.time;
        t.fx -= dt;
        if (t.fx <= 0) {
          t.fx = 0.11;
          this.emit(cx + rand(-8, 8), cy - 8, {
            n: 1,
            colors: ['rgba(255,255,255,.75)'],
            speed: [10, 30],
            angle: [-Math.PI * 0.7, -Math.PI * 0.3],
            life: [0.5, 0.9],
            size: [4, 7],
            grow: 12,
            shape: 'smoke',
          });
        }
        if (it.prog >= 1) {
          it.id = d.cook.to;
          it.prog = 0;
          it.pop = 1;
          t.bounce = 1;
          audio.ding();
          this.text(cx, t.r * T - 6, 'PRÊT !', COL.mint, 24, 0.9);
          this.ring(cx, cy, 10, 200, COL.mint, 0.4);
          this.emit(cx, cy, {
            n: 12,
            colors: ['#fff', COL.yellow, COL.mint],
            speed: [60, 220],
            life: [0.3, 0.6],
            size: [3, 6],
            shape: 'star',
          });
        }
      } else if (d.burn) {
        it.prog += (dt * t.burnMul) / d.burn.time;
        t.fx -= dt;
        if (t.fx <= 0) {
          const hot = it.prog > 0.6;
          t.fx = hot ? 0.06 : 0.12;
          this.emit(cx + rand(-8, 8), cy - 8, {
            n: 1,
            colors: hot ? ['rgba(40,35,40,.8)', 'rgba(70,60,70,.7)'] : ['rgba(255,255,255,.55)'],
            speed: [10, 40],
            angle: [-Math.PI * 0.75, -Math.PI * 0.25],
            life: [0.5, 1],
            size: [4, 8],
            grow: hot ? 18 : 10,
            shape: 'smoke',
          });
        }
        if (it.prog > 0.6) {
          t.warnT -= dt;
          if (t.warnT <= 0) {
            t.warnT = 0.5;
            audio.alarm();
          }
        }
        if (it.prog >= 1) {
          it.id = 'burnt';
          it.prog = 0;
          it.pop = 1;
          t.bounce = 1;
          audio.burn();
          this.shake(0.3);
          this.flashColor = COL.red;
          this.flash = 0.25;
          this.text(cx, t.r * T - 6, 'BRÛLÉ !', COL.red, 26, 1);
          this.emit(cx, cy, {
            n: 16,
            colors: ['rgba(30,26,30,.85)', 'rgba(80,70,80,.7)', '#ff7a2a'],
            speed: [40, 180],
            life: [0.5, 1],
            size: [5, 10],
            grow: 14,
            shape: 'smoke',
          });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // orders & scoring
  // -------------------------------------------------------------------------
  private updateOrders(dt: number) {
    const solo = !this.coop;
    const live = this.orders.filter((o) => !o.leaving).length;
    this.orderTimer -= dt;
    const players = this.chefs.length;
    const maxOrders = solo ? 4 : Math.min(6, 3 + players);
    if (live === 0 && this.orderTimer > 2.2) this.orderTimer = 2.2;
    if (this.orderTimer <= 0 && live < maxOrders) {
      this.spawnOrder();
      const base = lerp(12.5, 7, clamp(this.elapsed / 100, 0, 1));
      const pace = solo ? 1.3 : players >= 4 ? 0.72 : players === 3 ? 0.85 : 1;
      this.orderTimer = base * pace * (this.orderSeq === 1 ? 0.5 : 1);
    }
    for (const o of this.orders) {
      o.age += dt;
      if (o.leaving) {
        o.leaveT += dt;
        continue;
      }
      o.t -= dt;
      if (o.t <= 0) this.expireOrder(o);
    }
    this.orders = this.orders.filter((o) => !(o.leaving && o.leaveT > 0.55));
  }

  private spawnOrder() {
    const solo = !this.coop;
    const avail = RECIPES.filter((r) => this.elapsed >= r.unlock);
    const active = this.orders.filter((o) => !o.leaving);
    const novel = avail.filter((r) => !active.some((o) => o.recipe.id === r.id));
    const pool = novel.length && Math.random() < 0.75 ? novel : avail;
    let recipe = RECIPES[0];
    if (this.orderSeq > 0) {
      const total = pool.reduce((s, r) => s + r.weight, 0);
      let roll = Math.random() * total;
      for (const r of pool) {
        roll -= r.weight;
        if (roll <= 0) {
          recipe = r;
          break;
        }
      }
    }
    const pat = recipe.patience * (solo ? 1.18 : 1);
    this.orders.push({
      id: this.orderSeq++,
      recipe,
      t: pat,
      max: pat,
      age: 0,
      dispX: -1,
      leaving: null,
      leaveT: 0,
    });
    audio.newOrder();
  }

  private expireOrder(o: Order) {
    o.leaving = 'fail';
    o.leaveT = 0;
    this.expired++;
    this.combo = 0;
    this.score = Math.max(0, this.score - 10);
    this.scorePop = 1;
    this.shake(0.4);
    this.flashColor = COL.red;
    this.flash = 0.35;
    audio.expire();
    this.banner('COMMANDE PERDUE !', COL.red, 54, 0.9, '-10');
  }

  private serve(c: Chef, tile: Tile) {
    const plate = c.held!;
    const key = canon(plate.plate);
    let best: Order | null = null;
    for (const o of this.orders) {
      if (o.leaving) continue;
      if (canon(o.recipe.items) !== key) continue;
      if (!best || o.t < best.t) best = o;
    }
    const cx = (tile.c + 0.5) * T;
    const cy = (tile.r + 0.5) * T;
    if (!best) {
      audio.wrong();
      this.shake(0.15);
      c.sx = 1.25;
      c.sy = 0.8;
      this.text(cx - 30, cy - 26, 'PERSONNE N’A COMMANDÉ ÇA !', COL.red, 20, 1);
      return;
    }
    best.leaving = 'done';
    best.leaveT = 0;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const frac = best.t / best.max;
    const bonus = Math.round(best.recipe.value * 0.6 * frac);
    const mult = 1 + 0.2 * Math.min(this.combo - 1, 5);
    const pts = Math.round((best.recipe.value + bonus) * mult);
    this.score += pts;
    this.delivered++;
    this.served[c.idx] = (this.served[c.idx] ?? 0) + 1;
    this.scorePop = 1;
    this.comboPulse = 1;
    c.held = null;
    tile.bounce = 1;
    c.sx = 0.8;
    c.sy = 1.25;

    audio.deliver(this.combo);
    this.shake(0.32);
    this.freeze = 0.045;
    this.zoom = 0.02;
    this.flashColor = '#ffffff';
    this.flash = 0.18;
    this.text(cx - 40, cy - 10, `+${pts}`, COL.yellow, 38, 1.1);
    if (frac > 0.6) this.text(cx - 40, cy - 46, 'RAPIDE !', COL.mint, 22, 0.9);
    if (this.combo >= 2) this.text(cx - 40, cy + 22, `COMBO x${mult.toFixed(1)}`, COL.orange, 22, 1);
    this.ring(cx, cy, 10, 300, COL.yellow, 0.45);
    this.emit(cx, cy, {
      n: 34,
      colors: [COL.yellow, COL.orange, COL.mint, COL.red, '#fff', COL.purple],
      speed: [120, 420],
      angle: [Math.PI * 0.55, Math.PI * 1.45],
      life: [0.6, 1.2],
      size: [4, 8],
      grav: 520,
      drag: 0.6,
      shape: 'square',
      spin: 14,
    });
    this.emit(cx, cy, {
      n: 10,
      colors: [COL.yellow, '#fff'],
      speed: [80, 260],
      life: [0.4, 0.8],
      size: [5, 9],
      shape: 'star',
    });
  }

  // -------------------------------------------------------------------------
  // rats (the "smash" part of the kitchen brawl)
  // -------------------------------------------------------------------------
  private updateRatSpawner(dt: number) {
    this.ratTimer -= dt;
    const maxRats = this.coop ? Math.min(4, this.chefs.length + 1) : 2;
    if (this.ratTimer > 0 || this.rats.length >= maxRats) return;
    if (this.spawnRat()) {
      const k = lerp(1, 0.62, clamp(this.elapsed / ROUND_TIME, 0, 1));
      this.ratTimer = rand(9, 14) * k * (this.coop ? 1 : 1.2);
    } else {
      this.ratTimer = 2.5;
    }
  }

  private spawnRat(): boolean {
    const taken = new Set(this.rats.map((r) => r.target));
    const cands = this.flat.filter((t) => t.item && !taken.has(t));
    if (!cands.length) return false;
    const target = pick(cands);
    const [hc, hr] = pick(HOLES);
    const hx = (hc + 0.5) * T;
    const hy = (hr + 0.5) * T + 4;
    this.rats.push({
      x: hx,
      y: hy,
      vx: 0,
      vy: 1,
      state: 'run',
      target,
      origin: null,
      carry: null,
      t: 0,
      spin: 0,
      rot: 0,
      hop: 0,
      holeX: hx,
      holeY: hy,
      born: 0,
    });
    audio.squeak();
    this.emit(hx, hy, {
      n: 8,
      colors: ['rgba(120,90,50,.6)', '#fff'],
      speed: [30, 120],
      life: [0.25, 0.5],
      size: [3, 6],
      grow: 10,
      shape: 'smoke',
    });
    return true;
  }

  private updateRats(dt: number) {
    for (let i = this.rats.length - 1; i >= 0; i--) {
      const r = this.rats[i];
      r.born += dt;
      r.t += dt;
      if (r.carry && r.carry.pop > 0) r.carry.pop = Math.max(0, r.carry.pop - dt * 5);
      if (r.state === 'run') {
        let tile = r.target;
        if (!tile || !tile.item) {
          const taken = new Set(this.rats.map((q) => q.target));
          const alt = this.flat.filter((t) => t.item && !taken.has(t));
          if (alt.length) {
            tile = pick(alt);
            r.target = tile;
          } else {
            r.state = 'flee';
            r.target = null;
            continue;
          }
        }
        const tx = (tile.c + 0.5) * T;
        const ty = (tile.r + 0.5) * T;
        const dx = tx - r.x;
        const dy = ty - r.y;
        const d = Math.hypot(dx, dy);
        if (d < 30) {
          // steal!
          r.carry = tile.item;
          r.origin = tile;
          tile.item = null;
          tile.cookMul = 1;
          tile.burnMul = 1;
          tile.bounce = 0.8;
          r.state = 'flee';
          audio.squeak();
          this.shake(0.12);
          this.text(tx, tile.r * T - 6, 'VOLÉ !', COL.red, 24, 0.9);
          this.emit(tx, ty, {
            n: 8,
            colors: ['#fff', COL.red],
            speed: [60, 180],
            life: [0.25, 0.45],
            size: [3, 5],
            shape: 'star',
          });
        } else {
          const sp = 118 + this.elapsed * 0.35;
          r.vx = (dx / d) * sp;
          r.vy = (dy / d) * sp;
          r.x += r.vx * dt;
          r.y += r.vy * dt;
        }
      } else if (r.state === 'flee') {
        const dx = r.holeX - r.x;
        const dy = r.holeY - r.y;
        const d = Math.hypot(dx, dy);
        if (d < 14) {
          if (r.carry) this.text(r.holeX, r.holeY - 20, 'PERDU !', COL.red, 22, 0.8);
          this.rats.splice(i, 1);
          continue;
        }
        const sp = 175 + this.elapsed * 0.4;
        r.vx = (dx / d) * sp;
        r.vy = (dy / d) * sp;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
      } else {
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.vx *= Math.exp(-1.4 * dt);
        r.vy *= Math.exp(-1.4 * dt);
        r.rot += r.spin * dt;
        r.hop = Math.sin(Math.min(1, r.t / 0.75) * Math.PI) * 44;
        if (r.t > 0.75) this.rats.splice(i, 1);
      }
    }
  }

  private smashRat(r: Rat, fx: number, fy: number) {
    if (r.state === 'flung') return;
    const dx = r.x - fx;
    const dy = r.y - fy;
    const d = Math.hypot(dx, dy) || 1;
    r.vx = (dx / d) * 520;
    r.vy = (dy / d) * 520;
    r.state = 'flung';
    r.t = 0;
    r.spin = rand(14, 22) * (Math.random() < 0.5 ? -1 : 1);
    r.rot = Math.atan2(r.vy, r.vx);
    if (r.carry) {
      if (r.origin && !r.origin.item) {
        r.origin.item = r.carry;
        r.carry.pop = 1;
        r.origin.bounce = 1;
        this.text((r.origin.c + 0.5) * T, r.origin.r * T - 6, 'SAUVÉ !', COL.mint, 24, 0.9);
        this.ring((r.origin.c + 0.5) * T, (r.origin.r + 0.5) * T, 8, 180, COL.mint, 0.4);
      }
      r.carry = null;
    }
    this.smashed++;
    this.score += 5;
    this.scorePop = 1;
    this.freeze = 0.07;
    this.shake(0.45);
    audio.smash();
    this.text(r.x, r.y - 30, 'SMASH! +5', COL.yellow, 28, 0.9);
    this.ring(r.x, r.y, 8, 260, '#fff', 0.3);
    this.emit(r.x, r.y, {
      n: 16,
      colors: [COL.yellow, '#fff', COL.orange, COL.red],
      speed: [100, 340],
      life: [0.3, 0.6],
      size: [4, 9],
      shape: 'star',
    });
  }

  // -------------------------------------------------------------------------
  // end of round
  // -------------------------------------------------------------------------
  private finish() {
    this.phase = 'over';
    this.timeLeft = 0;
    this.endT = 0;
    this.ended = false;
    audio.stopMusic();
    audio.over();
    this.banner('TEMPS ÉCOULÉ !', COL.yellow, 76, 1.6);
    this.shake(0.7);
    this.zoom = 0.04;
    const mul = this.coop ? [1, 1, 1, 1.25, 1.5][this.chefs.length] : 1;
    const th = (this.coop ? [200, 420, 650] : [140, 290, 450]).map((v) => Math.round(v * mul));
    const stars = this.score >= th[2] ? 3 : this.score >= th[1] ? 2 : this.score >= th[0] ? 1 : 0;
    this.result = {
      score: this.score,
      delivered: this.delivered,
      expired: this.expired,
      bestCombo: this.bestCombo,
      smashed: this.smashed,
      stars,
      players: this.coop ? this.chefs.map((c, i) => ({ name: c.name, hero: c.hero.id, served: this.served[i] ?? 0 })) : undefined,
    };
    for (const c of this.chefs) {
      c.chopping = false;
      this.emit(c.x, c.y, {
        n: 14,
        colors: [COL.yellow, '#fff', c.hero.color],
        speed: [80, 300],
        life: [0.5, 1],
        size: [4, 8],
        shape: 'star',
        grav: 200,
      });
    }
  }

  // -------------------------------------------------------------------------
  render(ctx: CanvasRenderingContext2D) {
    renderGame(this, ctx);
  }
}
