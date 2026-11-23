import { audio, type Sfx } from "./audio";
import { Input } from "./input";
import { ENEMY_COLORS, HEROES, heroById, waveFor, type EnemyKind, type HeroDef, type HeroId } from "./heroes";
import { GRAV, H, LEVELS, W, type LevelDef } from "./levels";
import { approach, bodyRect, clamp, makeBody, moveBody, overlap, pointInSolid, updatePlatforms, type Platform, type Rect } from "./physics";
import { makeProj, spawnEnemy, updateEnemies, updateProjs } from "./ai";
import { render } from "./render";
import { party, type DevRead } from "./partyInput";
import type {
  Banner, Barrel, Bubble, Callbacks, Corpse, Enemy, Fx, FxKind, FText, Part, Phase, Player, Proj, RunSummary,
} from "./types";

export type KillCause = "slash" | "throw" | "boomer" | "dash" | "slam" | "boom" | "ring" | "spike" | "reflect";

const STEP = 1 / 120;
const JUMP = 690;
const JUMP2 = 620;
const DASH_SPEED = 950;
const DASH_TIME = 0.17;
const MAX_PARTS = 900;

/** Couleurs des joueurs J1…J4 (identiques aux autres jeux du site). */
export const SLOT_COLORS = ["#22e6ff", "#ff3e5e", "#38e08a", "#ffd23f"];

export interface CoopPlayer {
  hero: HeroId;
  /** "kbA", "kbB", "gpN", "ph:<pid>" */
  device: string;
  name: string;
}

const RESPAWN = 2.4;

export class Game {
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null = null;
  cb: Callbacks;
  input = new Input();
  scale = 1;

  phase: Phase = "menu";
  heroId: HeroId = "kage";
  level: LevelDef = LEVELS[0];
  platforms: Platform[] = [];
  spikes: Rect[] = [];
  pads: Rect[] = [];
  barrels: Barrel[] = [];
  /** Joueur « actif » : celui dont on traite l'action en ce moment. */
  player!: Player;
  /** Tous les joueurs (1 en solo, 2 à 4 en co-op). */
  players: Player[] = [];
  /** Entrées de chaque joueur (inputs[0] = clavier/tactile en solo). */
  inputs: Input[] = [];
  /** Co-op : liste des joueurs, null en solo. */
  coop: CoopPlayer[] | null = null;
  respawnT: number[] = [];
  pkills: number[] = [];
  pdeaths: number[] = [];
  enemies: Enemy[] = [];
  projs: Proj[] = [];
  corpses: Corpse[] = [];
  parts: Part[] = [];
  texts: FText[] = [];
  fx: Fx[] = [];
  bubble: Bubble | null = null;

  // run state
  room = 1;
  score = 0;
  scoreShown = 0;
  scorePop = 0;
  lives = 3;
  kills = 0;
  combo = 0;
  comboT = 0;
  comboPop = 0;
  bestCombo = 0;
  roomTime = 0;
  runTime = 0;
  roomDeaths = 0;
  cleared = 0;
  bestCleared = 0;
  roomState: "play" | "clear" | "dead" | "over" = "play";
  stateT = 0;

  // juice
  shake = 0;
  flash = 0;
  flashColor = "#ffffff";
  zoom = 0;
  zoomX = W / 2;
  zoomY = H / 2;
  hitStopT = 0;
  slowT = 0;
  slowScale = 1;
  wipe = 0;
  wipeDir = 0;
  pending: (() => void) | null = null;
  banner: Banner | null = null;
  time = 0;
  touchMode = false;
  hintT = 0;
  bgDirty = true;
  decalClear = true;
  decalQueue: { x: number; y: number; color: string; n: number }[] = [];

  private idc = 1;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private emberT = 0;
  private emptyT = 0;

  constructor(canvas: HTMLCanvasElement | null, cb: Callbacks) {
    this.inputs = [this.input];
    this.canvas = canvas;
    this.cb = cb;
    if (canvas) this.ctx = canvas.getContext("2d", { alpha: false });
    this.loadMenuScene();
  }

  // ------------------------------------------------------------ lifecycle
  start() {
    if (this.raf || typeof requestAnimationFrame === "undefined") return;
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.acc += dt;
      let n = 0;
      while (this.acc >= STEP && n < 14) {
        this.tick(STEP);
        this.acc -= STEP;
        n++;
      }
      if (n === 14) this.acc = 0;
      if (this.ctx) render(this, this.ctx);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  resize(cssW: number, cssH: number) {
    if (!this.canvas) return;
    // cap the pixel budget so retina / 4K screens still hold 60fps
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.max(1, cssW * cssH);
    if (px * dpr * dpr > 2.6e6) dpr = Math.max(1, Math.sqrt(2.6e6 / px));
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.max(2, Math.round(cssW * dpr));
    this.canvas.height = Math.max(2, Math.round(cssH * dpr));
    this.scale = this.canvas.width / W;
    this.bgDirty = true;
    this.decalClear = true;
  }

  nextId() {
    return this.idc++;
  }

  sfx(n: Sfx) {
    audio.play(n);
  }

  setHero(id: HeroId) {
    this.heroId = id;
    if (this.phase === "menu") this.loadMenuScene();
  }

  loadMenuScene() {
    const L = LEVELS[Math.floor(Math.random() * LEVELS.length)];
    this.setLevel(L);
    this.resetEntities();
    const hero = heroById(this.heroId);
    const sp = L.playerSpawn;
    this.player = this.makePlayer(hero, sp.x, sp.y);
    this.player.inv = 0;
    this.players = [this.player];
    this.roomState = "over";
  }

  /** Partie en équipe : 2 à 4 joueurs sur le même écran, vies partagées. */
  startCoop(list: CoopPlayer[]) {
    this.coop = list.length ? list : null;
    this.inputs = list.map(() => new Input());
    this.input = this.inputs[0];
    party.flush();
    this.startRun(list[0]?.hero ?? this.heroId, true);
  }

  get isCoop(): boolean {
    return !!this.coop;
  }

  /** Index d'un joueur. */
  pidx(p: Player = this.player): number {
    return Math.max(0, this.players.indexOf(p));
  }

  /** Couleur d'identification d'un joueur (couleur de slot en co-op). */
  tagColor(i: number): string {
    return this.coop ? SLOT_COLORS[i % 4] : this.players[i]?.hero.color ?? "#fff";
  }

  /** Joueur vivant le plus proche (cible des ennemis). */
  targetFor(e: { x: number; y: number }): Player {
    let best: Player | null = null;
    let bd = 1e18;
    for (const p of this.players) {
      if (!p.alive) continue;
      const d = (p.x - e.x) ** 2 + (p.y - e.y) ** 2 * 1.5;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best ?? this.players[0];
  }

  startRun(id: HeroId, coop = false) {
    if (!coop) {
      this.coop = null;
      this.input = this.inputs[0] ?? this.input;
      this.inputs = [this.input];
    }
    this.pkills = (this.coop ?? [0]).map(() => 0);
    this.pdeaths = (this.coop ?? [0]).map(() => 0);
    this.heroId = id;
    this.score = 0;
    this.scoreShown = 0;
    this.lives = this.coop ? 2 + this.coop.length : 3;
    this.kills = 0;
    this.combo = 0;
    this.comboT = 0;
    this.bestCombo = 0;
    this.runTime = 0;
    this.cleared = 0;
    this.roomDeaths = 0;
    this.wipe = 0;
    this.wipeDir = 0;
    this.pending = null;
    this.hitStopT = 0;
    this.slowT = 0;
    for (const inp of this.inputs) inp.clear();
    this.phase = "playing";
    this.loadRoom(1);
    this.hintT = 9;
    this.sfx("start");
    audio.setMuffled(false);
    this.cb.onPhase("playing");
  }

  toMenu() {
    this.phase = "menu";
    this.wipe = 0;
    this.wipeDir = 0;
    this.pending = null;
    this.hitStopT = 0;
    this.slowT = 0;
    this.banner = null;
    for (const inp of this.inputs) inp.clear();
    this.coop = null;
    this.input = this.inputs[0];
    this.inputs = [this.input];
    this.loadMenuScene();
    audio.setMuffled(false);
    audio.intensity = 0;
    this.cb.onPhase("menu");
  }

  pause() {
    if (this.phase !== "playing") return;
    this.phase = "paused";
    for (const inp of this.inputs) inp.clear();
    audio.setMuffled(true);
    this.cb.onPhase("paused");
  }

  resume() {
    if (this.phase !== "paused") return;
    this.phase = "playing";
    for (const inp of this.inputs) inp.clear();
    party.flush();
    audio.setMuffled(false);
    this.cb.onPhase("playing");
  }

  private setLevel(L: LevelDef) {
    this.level = L;
    this.platforms = L.platforms.map((p) => ({ ...p, x0: p.x, y0: p.y, dx: 0, dy: 0 }));
    this.spikes = L.spikes.map((s) => ({ ...s }));
    this.pads = L.pads.map((s) => ({ ...s }));
    this.barrels = L.barrels.map((b) => ({ x: b.x, y: b.y, w: 26, h: 34, fuse: -1, flash: 0, alive: true }));
    this.bgDirty = true;
    this.decalClear = true;
  }

  private resetEntities() {
    this.enemies = [];
    this.projs = [];
    this.corpses = [];
    this.parts = [];
    this.texts = [];
    this.fx = [];
    this.bubble = null;
  }

  private makePlayer(hero: HeroDef, x: number, y: number): Player {
    return {
      ...makeBody(x, y, 22, 38),
      alive: true, hero, coyote: 0, jumpBuf: 0, jumpsLeft: 1, jumping: false,
      atkT: -1, atkCd: 0, atkBuf: 0, throwCd: 0, throwBuf: 0, abilCd: 0, ammo: hero.maxAmmo,
      dashT: 0, dashDir: 1, inv: 0.3, rush: 0, parryT: 0, slam: 0, slamT: 0, dropT: 0,
      sqx: 1, sqy: 1, runPh: 0, ghostT: 0, throwAnim: 0, hurtFlash: 0,
    };
  }

  loadRoom(n: number) {
    this.room = n;
    const L = LEVELS[(n - 1) % LEVELS.length];
    this.setLevel(L);
    this.resetEntities();
    if (this.coop) {
      const n0 = this.coop.length;
      this.players = this.coop.map((c, i) => {
        const pl = this.makePlayer(heroById(c.hero), this.spawnX(i, n0), L.playerSpawn.y);
        pl.face = i % 2 ? -1 : 1;
        return pl;
      });
      this.respawnT = this.players.map(() => 0);
      this.player = this.players[0];
    } else {
      const hero = heroById(this.heroId);
      this.player = this.makePlayer(hero, L.playerSpawn.x, L.playerSpawn.y);
      this.players = [this.player];
      this.respawnT = [0];
    }
    const kinds = waveFor(n);
    if (this.coop) {
      // plus de joueurs = plus d'ennemis (environ +40 % par joueur en plus)
      const base = kinds.slice();
      const extra = Math.round(base.length * 0.4 * (this.coop.length - 1));
      for (let i = 0; i < extra; i++) kinds.push(base[Math.floor(Math.random() * base.length)]);
    }
    const far = L.slots
      .filter((s) => Math.hypot(s.x - L.playerSpawn.x, s.y - L.playerSpawn.y) > 220)
      .sort(() => Math.random() - 0.5);
    const near = L.slots.filter((s) => !far.includes(s)).sort(() => Math.random() - 0.5);
    const order = [...far, ...near];
    kinds.forEach((k: EnemyKind, i: number) => {
      const s = order[i % order.length];
      const off = Math.floor(i / order.length) * 34;
      spawnEnemy(this, k, clamp(s.x + (i % 2 ? off : -off), 30, W - 30), s.y, i * 0.17);
    });
    this.roomTime = 0;
    this.roomState = "play";
    this.stateT = 0;
    this.combo = 0;
    this.comboT = 0;
    this.banner = { title: `SALLE ${n}`, sub: L.name, t: 0, dur: 1.5, color: L.accent };
    audio.intensity = Math.min(2, Math.floor((n - 1) / 3));
  }

  // ------------------------------------------------------------ main tick
  private tick(rdt: number) {
    this.shake = Math.max(0, this.shake - rdt * 2.4);
    this.flash = Math.max(0, this.flash - rdt * 3.2);
    this.zoom *= Math.exp(-rdt * 9);
    this.scorePop = Math.max(0, this.scorePop - rdt * 5);
    this.comboPop = Math.max(0, this.comboPop - rdt * 5);
    this.emptyT -= rdt;
    if (this.banner) {
      this.banner.t += rdt;
      if (this.banner.t > this.banner.dur) this.banner = null;
    }
    this.scoreShown += (this.score - this.scoreShown) * Math.min(1, rdt * 9);
    if (Math.abs(this.score - this.scoreShown) < 1) this.scoreShown = this.score;

    if (this.wipeDir > 0) {
      this.wipe += rdt * 4.5;
      if (this.wipe >= 1) {
        this.wipe = 1;
        const fn = this.pending;
        this.pending = null;
        this.wipeDir = -1;
        if (fn) fn();
      }
    } else if (this.wipeDir < 0) {
      this.wipe -= rdt * 3.4;
      if (this.wipe <= 0) {
        this.wipe = 0;
        this.wipeDir = 0;
      }
    }

    if (this.phase === "paused") return;
    if (this.hitStopT > 0) {
      this.hitStopT -= rdt;
      return;
    }
    let ts = 1;
    if (this.slowT > 0) {
      this.slowT -= rdt;
      ts = 1 - (1 - this.slowScale) * clamp(this.slowT / 0.22, 0, 1);
    }
    const dt = rdt * ts;
    if (this.phase === "playing" || this.phase === "over") this.updateWorld(dt, rdt);
    else this.updateAmbient(dt);
  }

  private updateAmbient(dt: number) {
    this.time += dt;
    updatePlatforms(this.platforms, this.time);
    const p = this.player;
    p.sqx += (1 - p.sqx) * Math.min(1, dt * 14);
    this.updateVisuals(dt);
  }

  private updateWorld(dt: number, rdt: number) {
    this.time += dt;
    updatePlatforms(this.platforms, this.time);
    if (this.roomState === "play" && this.phase === "playing") {
      this.roomTime += dt;
      this.runTime += dt;
      if (this.hintT > 0) this.hintT -= rdt;
    }
    if (this.bubble) {
      this.bubble.t += dt;
      if (this.bubble.t >= this.bubble.dur) {
        const bp = this.players[this.bubble.pi] ?? this.player;
        this.addFx("ring", bp.x, bp.y - 20, 0, 0.35, bp.hero.color, 1.2, 1);
        this.bubble = null;
      }
    }
    if (this.coop && this.phase === "playing") this.feedCoop();
    for (let i = 0; i < this.players.length; i++) {
      this.player = this.players[i];
      this.input = this.inputs[i] ?? this.inputs[0];
      this.updatePlayer(dt);
      if (this.coop && !this.player.alive && this.respawnT[i] > 0 && this.roomState === "play") {
        this.respawnT[i] -= dt;
        if (this.respawnT[i] <= 0) this.respawn(i);
      }
    }
    this.input = this.inputs[0];
    updateEnemies(this, dt);
    updateProjs(this, dt);
    this.updateBarrels(dt);
    this.updateVisuals(dt);
    this.comboT -= dt;
    if (this.comboT <= 0 && this.combo > 0) this.combo = 0;

    if (this.phase !== "playing" && this.phase !== "over") return;
    if (this.roomState === "play" && this.phase === "playing") {
      if (this.enemies.length > 0 && !this.enemies.some((e) => e.alive)) this.roomClear();
    } else if (this.roomState === "clear") {
      this.stateT += rdt;
      if (this.stateT > 1.9 && !this.pending && this.wipeDir === 0) {
        this.pending = () => {
          this.roomDeaths = 0;
          this.loadRoom(this.room + 1);
        };
        this.wipeDir = 1;
      }
    } else if (this.roomState === "dead") {
      this.stateT += rdt;
      if (this.stateT > 1.2 && !this.pending && this.wipeDir === 0) {
        if (this.lives > 0) {
          this.pending = () => this.loadRoom(this.room);
          this.wipeDir = 1;
        } else this.gameOver();
      }
    }
  }

  /** Co-op : applique l'état de chaque périphérique aux entrées des joueurs. */
  private feedCoop() {
    party.pollPads();
    const reads: (DevRead | null)[] = this.coop!.map((c) => party.read(c.device));
    if (reads.some((r) => r?.edges.has("pause"))) {
      this.pause();
      return;
    }
    reads.forEach((r, i) => {
      const inp = this.inputs[i];
      if (!r || !inp) return;
      const hold = (a: "left" | "right" | "down" | "jump", v: boolean) => {
        if (v && !inp.held[a]) inp.press(a);
        else if (!v && inp.held[a]) inp.release(a);
      };
      if (r.edges.has("jump") && inp.held.jump) {
        // nouvel appui alors que le saut est déjà tenu (ex. joystick puis bouton)
        inp.release("jump");
      }
      hold("left", r.left);
      hold("right", r.right);
      hold("down", r.down);
      hold("jump", r.jump || r.edges.has("jump"));
      for (const a of ["attack", "throw", "ability"] as const) {
        if (r.edges.has(a)) {
          inp.press(a);
          inp.release(a);
        }
      }
    });
  }

  private spawnX(i: number, n: number): number {
    const sx = this.level.playerSpawn.x;
    return clamp(sx + (i - (n - 1) / 2) * 44, 30, W - 30);
  }

  /** Co-op : un joueur tombé revient (si l'équipe a encore des vies). */
  private respawn(i: number) {
    const old = this.players[i];
    const pl = this.makePlayer(old.hero, this.spawnX(i, this.players.length), this.level.playerSpawn.y - 2);
    pl.inv = 2;
    this.players[i] = pl;
    this.addFx("ring", pl.x, pl.y - 20, 0, 0.5, this.tagColor(i), 1.6, 1);
    this.burst(pl.x, pl.y - 20, 18, this.tagColor(i), 300, 3, 0.5, 0);
    this.sfx("spawn");
  }

  private gameOver() {
    this.roomState = "over";
    this.phase = "over";
    for (const inp of this.inputs) inp.clear();
    const s: RunSummary = {
      score: this.score, room: this.room, cleared: this.cleared, kills: this.kills,
      bestCombo: this.bestCombo, hero: this.heroId, time: this.runTime,
      coop: this.coop
        ? this.coop.map((c, i) => ({ name: c.name, hero: c.hero, kills: this.pkills[i] ?? 0, deaths: this.pdeaths[i] ?? 0, color: SLOT_COLORS[i % 4] }))
        : undefined,
    };
    audio.setMuffled(true);
    this.cb.onOver(s);
    this.cb.onPhase("over");
  }

  private roomClear() {
    this.roomState = "clear";
    this.stateT = 0;
    this.cleared = this.room;
    const timeBonus = Math.max(0, Math.round(28 - this.roomTime)) * 20;
    const flawless = this.roomDeaths === 0 ? 300 : 0;
    const bonus = 500 + timeBonus + flawless;
    this.score += bonus;
    this.scorePop = 1;
    let sub = `+${bonus}${flawless ? "  ·  SANS FAUTE" : ""}`;
    let title = "SALLE NETTOYÉE";
    let color = this.level.accent;
    if (this.room % 4 === 0 && this.lives < 5) {
      this.lives++;
      sub += "  ·  +1 VIE";
    }
    let newly: HeroDef | null = null;
    if (this.cleared > this.bestCleared && !this.coop) {
      newly = HEROES.find((h) => h.unlockRoom > 0 && h.unlockRoom <= this.cleared && h.unlockRoom > this.bestCleared) ?? null;
      this.bestCleared = this.cleared;
      this.cb.onBest(this.cleared, newly);
    }
    if (newly) {
      title = "HÉROS DÉBLOQUÉ";
      sub = newly.name;
      color = newly.color;
      this.sfx("unlock");
    } else this.sfx("clear");
    this.banner = { title, sub, t: 0, dur: 2.0, color };
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const pr = this.projs[i];
      if (pr.owner === "e") {
        this.burst(pr.x, pr.y, 5, "#ffd27a", 120, 2.5, 0.3, 0);
        this.projs.splice(i, 1);
      }
    }
    const p = this.player;
    for (let i = 0; i < 40; i++) {
      const c = [p.hero.color, "#ffffff", this.level.accent, "#ffe14a"][i % 4];
      this.burst(p.x, p.y - 30, 1, c, 520, 3.5, 1.1, 700);
    }
    this.flashScreen(0.2, color);
  }

  // ------------------------------------------------------------ player
  hurtRect(): Rect {
    const p = this.player;
    return { x: p.x - 7, y: p.y - 34, w: 14, h: 30 };
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    const inp = this.input;
    const hero = p.hero;
    p.atkCd -= dt;
    p.throwCd -= dt;
    p.abilCd -= dt;
    p.inv -= dt;
    p.rush -= dt;
    p.coyote -= dt;
    p.jumpBuf -= dt;
    p.atkBuf -= dt;
    p.throwBuf -= dt;
    p.dropT -= dt;
    p.parryT -= dt;
    p.throwAnim -= dt;
    p.hurtFlash -= dt;
    const sk = Math.min(1, dt * 16);
    p.sqx += (1 - p.sqx) * sk;
    p.sqy += (1 - p.sqy) * sk;
    if (!p.alive) return;
    if (p.ammo < hero.maxAmmo) p.ammo = Math.min(hero.maxAmmo, p.ammo + dt / hero.reload);

    if (inp.consume("jump")) p.jumpBuf = 0.13;
    if (inp.consume("attack")) p.atkBuf = 0.14;
    if (inp.consume("throw")) p.throwBuf = 0.14;
    const wantAbility = inp.consume("ability");
    const downPress = inp.consume("down");
    const h = inp.held;
    const ix = (h.right ? 1 : 0) - (h.left ? 1 : 0);
    const plats = this.platforms;

    // ---- dash state
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashDir * DASH_SPEED;
      p.vy = 0;
      p.ghostT -= dt;
      if (p.ghostT <= 0) {
        this.addFx("ghost", p.x, p.y, 0, 0.3, hero.color, 1, p.face);
        p.ghostT = 0.024;
      }
      moveBody(p, dt, plats);
      this.dashHit();
      if (p.dashT <= 0) p.vx = p.dashDir * 320;
      this.playerEnv();
      return;
    }

    // ---- slam states (Volt)
    if (p.slam === 1) {
      p.slamT -= dt;
      p.vx = approach(p.vx, ix * hero.speed * 0.5, 1800 * dt);
      p.vy += GRAV * dt * 0.6;
      moveBody(p, dt, plats);
      if (p.slamT <= 0 || p.vy > -80) {
        p.slam = 2;
        p.vx = 0;
        p.vy = 1500;
        this.addFx("streak", p.x, p.y - 20, Math.PI / 2, 0.25, hero.color, 1, 1);
      }
      this.playerEnv();
      return;
    }
    if (p.slam === 2) {
      p.vx = 0;
      p.vy = 1500;
      p.inv = Math.max(p.inv, 0.05);
      moveBody(p, dt, plats);
      this.burst(p.x, p.y - 10, 1, hero.color, 60, 3, 0.3, 0);
      if (Math.random() < 0.6) this.addFx("ghost", p.x, p.y, 0, 0.2, hero.color, 1, p.face);
      for (const e of this.enemies) {
        if (e.alive && e.state !== "spawn" && overlap({ x: p.x - 18, y: p.y - 40, w: 36, h: 54 }, bodyRect(e))) this.killEnemy(e, "slam", p.face);
      }
      if (p.onGround) this.slamLand();
      this.playerEnv();
      return;
    }

    // ---- ability
    if (wantAbility) {
      if (p.abilCd <= 0) this.useAbility(ix);
      else if (this.emptyT <= 0) {
        this.sfx("empty");
        this.emptyT = 0.25;
      }
    }
    if (p.dashT > 0 || p.slam) return;

    // ---- horizontal movement
    const parrying = p.parryT > 0;
    const maxV = hero.speed * (p.rush > 0 ? 1.4 : 1) * (parrying ? 0.55 : 1);
    const onG = p.onGround;
    if (ix !== 0) {
      const turning = Math.sign(p.vx) === -ix && Math.abs(p.vx) > 40;
      const acc = (onG ? 3800 : 2500) * (turning ? 1.8 : 1);
      p.vx = approach(p.vx, ix * maxV, acc * dt);
      if (p.atkT < 0) p.face = ix as 1 | -1;
    } else p.vx = approach(p.vx, 0, (onG ? 3400 : 450) * dt);

    // ---- jumping
    if (onG) {
      p.coyote = 0.1;
      p.jumpsLeft = 1;
    }
    if (downPress && onG && p.ground && p.ground.kind === "oneway") {
      p.dropT = 0.22;
      p.y += 2;
      p.onGround = false;
      p.ground = null;
      p.coyote = 0;
    }
    if (p.jumpBuf > 0) {
      if (p.coyote > 0) {
        p.vy = -JUMP;
        p.coyote = 0;
        p.jumpBuf = 0;
        p.jumping = true;
        p.sqx = 0.78;
        p.sqy = 1.28;
        this.sfx("jump");
        this.burst(p.x, p.y, 6, "#ffffff", 110, 2.5, 0.3, 0);
      } else if (p.jumpsLeft > 0) {
        p.vy = -JUMP2;
        p.jumpsLeft--;
        p.jumpBuf = 0;
        p.jumping = true;
        p.sqx = 0.8;
        p.sqy = 1.25;
        this.sfx("djump");
        this.addFx("ring", p.x, p.y, 0, 0.28, hero.color, 0.55, 1);
        this.burst(p.x, p.y, 8, hero.color, 160, 2.5, 0.35, 0);
      }
    }
    if (p.jumping && !h.jump && p.vy < -260) {
      p.vy *= 0.55;
      p.jumping = false;
    }
    if (p.vy >= 0) p.jumping = false;

    // ---- attack
    if (p.atkBuf > 0 && p.atkCd <= 0 && !parrying) this.startAttack();
    if (p.atkT >= 0) {
      p.atkT += dt;
      if (p.atkT > 0.02 && p.atkT < 0.17) this.slashHit();
      if (p.atkT >= 0.22) p.atkT = -1;
    }

    // ---- throw
    if (p.throwBuf > 0 && p.throwCd <= 0) {
      if (p.ammo >= 1) this.doThrow();
      else {
        p.throwBuf = 0;
        p.throwCd = 0.25;
        this.sfx("empty");
        this.popText(p.x, p.y - 52, "PLUS DE MUNITIONS", "#ff6b7a", 13);
      }
    }

    // ---- gravity + move
    const fast = h.down && !onG;
    p.vy = Math.min(p.vy + GRAV * dt * (p.vy > 0 ? 1.18 : 1) * (fast ? 1.8 : 1), fast ? 1500 : 1050);
    const wasAir = !p.onGround;
    moveBody(p, dt, plats, p.dropT > 0);
    if (p.impactVy > 330 && wasAir) {
      p.sqx = 1.3;
      p.sqy = 0.7;
      this.sfx("land");
      this.burst(p.x, p.y, 7, "#ffffff", 130, 2.5, 0.3, 0);
    }
    if (p.onGround && Math.abs(p.vx) > 20) {
      p.runPh += dt * Math.abs(p.vx) * 0.05;
      if (Math.random() < dt * 14) this.burst(p.x - p.face * 6, p.y, 1, "#ffffff", 40, 2, 0.28, 0);
    } else if (!p.onGround) p.runPh += dt * 4;
    if (p.rush > 0 && Math.abs(p.vx) > 100) {
      p.ghostT -= dt;
      if (p.ghostT <= 0) {
        this.addFx("ghost", p.x, p.y, 0, 0.22, hero.color, 1, p.face);
        p.ghostT = 0.035;
      }
    }
    this.playerEnv();
  }

  private playerEnv() {
    const p = this.player;
    if (!p.alive) return;
    const r = this.envBody(p);
    if (r === "spike") this.killPlayer("spikes", true);
    else if (r === "out") this.killPlayer("pit", true);
  }

  /** wall clamp, pads, spikes & ring-out. Returns a hazard state. */
  envBody(b: { x: number; y: number; w: number; vx: number; vy: number; onGround: boolean; ground: Platform | null }): "ok" | "spike" | "out" {
    if (!this.level.open) {
      if (b.x < b.w / 2) {
        b.x = b.w / 2;
        if (b.vx < 0) b.vx = 0;
      } else if (b.x > W - b.w / 2) {
        b.x = W - b.w / 2;
        if (b.vx > 0) b.vx = 0;
      }
    }
    if (b.vy >= 0) {
      for (const pad of this.pads) {
        if (b.x > pad.x && b.x < pad.x + pad.w && b.y >= pad.y - 1 && b.y <= pad.y + pad.h + 3) {
          b.vy = -1020;
          b.onGround = false;
          b.ground = null;
          this.sfx("bounce");
          this.addFx("ring", b.x, pad.y, 0, 0.25, "#ffffff", 0.5, 1);
          this.burst(b.x, pad.y, 8, "#ffffff", 150, 2.5, 0.3, 0);
          if (b === (this.player as unknown)) {
            this.player.jumpsLeft = 1;
            this.player.sqx = 0.7;
            this.player.sqy = 1.4;
          }
        }
      }
    }
    for (const sp of this.spikes) {
      if (b.x + b.w / 2 - 4 > sp.x && b.x - b.w / 2 + 4 < sp.x + sp.w && b.y > sp.y + 3 && b.y < sp.y + sp.h + 30) return "spike";
    }
    if (b.y > H + 90 || (this.level.open && (b.x < -70 || b.x > W + 70))) return "out";
    return "ok";
  }

  spikeAt(x: number, y: number) {
    for (const sp of this.spikes) if (x > sp.x - 6 && x < sp.x + sp.w + 6 && y > sp.y - 4) return true;
    return false;
  }

  slowFactor(x: number, y: number) {
    const b = this.bubble;
    if (!b) return 1;
    const r = b.r * Math.min(1, b.t / 0.18) * (b.dur - b.t < 0.3 ? (b.dur - b.t) / 0.3 : 1);
    const bp = this.players[b.pi] ?? this.player;
    const dx = x - bp.x;
    const dy = y - (bp.y - 20);
    return dx * dx + dy * dy < r * r ? 0.28 : 1;
  }

  private startAttack() {
    const p = this.player;
    p.atkT = 0;
    p.atkBuf = 0;
    p.atkCd = 0.27;
    p.vx += p.face * 150;
    p.sqx = 1.18;
    p.sqy = 0.9;
    this.sfx("slash");
    this.addFx("slash", p.x + p.face * 14, p.y - 20, p.face, 0.17, p.hero.color, 1, p.face);
  }

  private slashHit() {
    const p = this.player;
    const r: Rect = { x: p.face > 0 ? p.x + 2 : p.x - 80, y: p.y - 48, w: 78, h: 56 };
    for (const e of this.enemies) {
      if (!e.alive || e.state === "spawn") continue;
      if (!overlap(r, bodyRect(e))) continue;
      if (this.shieldBlocks(e, p.x)) {
        this.blockFx(e, p.x);
        p.vx = -p.face * 340;
        p.vy = Math.min(p.vy, -160);
        p.atkT = -1;
        p.atkCd = 0.5;
        e.vx += p.face * 120;
        return;
      }
      this.killEnemy(e, "slash", p.face);
      p.atkCd = Math.min(p.atkCd, 0.1);
    }
    for (const b of this.barrels) {
      if (b.alive && b.fuse < 0 && overlap(r, { x: b.x - b.w / 2, y: b.y - b.h, w: b.w, h: b.h })) this.igniteBarrel(b, 0.05);
    }
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const pr = this.projs[i];
      if (pr.owner === "e" && overlap(r, { x: pr.x - pr.r, y: pr.y - pr.r, w: pr.r * 2, h: pr.r * 2 })) {
        this.burst(pr.x, pr.y, 8, "#ffd27a", 240, 2.5, 0.3, 0);
        this.addFx("ring", pr.x, pr.y, 0, 0.2, "#fff", 0.45, 1);
        this.award(25, "DÉVIÉ", pr.x, pr.y - 10, p.hero.color);
        this.sfx("parry");
        this.hitStopT = Math.max(this.hitStopT, 0.03);
        this.shakeBy(0.12);
        this.projs.splice(i, 1);
      }
    }
  }

  private dashHit() {
    const p = this.player;
    const r: Rect = { x: p.x - 20, y: p.y - 44, w: 40, h: 50 };
    for (const e of this.enemies) {
      if (e.alive && e.state !== "spawn" && overlap(r, bodyRect(e))) this.killEnemy(e, "dash", p.dashDir);
    }
    for (const b of this.barrels) {
      if (b.alive && b.fuse < 0 && overlap(r, { x: b.x - b.w / 2, y: b.y - b.h, w: b.w, h: b.h })) this.igniteBarrel(b, 0.05);
    }
  }

  private slamLand() {
    const p = this.player;
    p.slam = 0;
    p.inv = 0.2;
    p.sqx = 1.5;
    p.sqy = 0.55;
    this.sfx("slam");
    this.shakeBy(0.95);
    this.flashScreen(0.35, p.hero.color);
    this.hitStopT = Math.max(this.hitStopT, 0.07);
    this.zoomPunch(p.x, p.y - 20, 0.05);
    this.addFx("wave", p.x, p.y, 0, 0.5, p.hero.color, 1, 1);
    this.addFx("ring", p.x, p.y - 4, 0, 0.45, "#ffffff", 1.8, 1);
    for (let i = 0; i < 26; i++) {
      this.burst(p.x + (Math.random() - 0.5) * 40, p.y, 1, i % 2 ? p.hero.color : "#ffffff", 420, 3.5, 0.6, 500, true);
    }
    for (const e of this.enemies) {
      if (!e.alive || e.state === "spawn") continue;
      if (Math.abs(e.x - p.x) < 150 && Math.abs(e.y - p.y) < 64) this.killEnemy(e, "slam", Math.sign(e.x - p.x) || 1);
    }
    for (const b of this.barrels) if (b.alive && b.fuse < 0 && Math.abs(b.x - p.x) < 150 && Math.abs(b.y - p.y) < 40) this.igniteBarrel(b, 0.08);
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const pr = this.projs[i];
      if (pr.owner === "e" && Math.abs(pr.x - p.x) < 150 && Math.abs(pr.y - p.y) < 70) this.projs.splice(i, 1);
    }
  }

  private aimDir(): { ax: number; ay: number } {
    const p = this.player;
    const cx = p.x;
    const cy = p.y - 22;
    const aim = this.input.aim;
    if (aim.mouseThrow) {
      aim.mouseThrow = false;
      const dx = aim.x - cx;
      const dy = aim.y - cy;
      const l = Math.hypot(dx, dy) || 1;
      p.face = dx >= 0 ? 1 : -1;
      return { ax: dx / l, ay: dy / l };
    }
    let best: Enemy | null = null;
    let bd = 1e9;
    for (const e of this.enemies) {
      if (!e.alive || e.state === "spawn") continue;
      const ex = e.x - cx;
      const ey = e.y - e.h / 2 - cy;
      if (Math.sign(ex) !== p.face && Math.abs(ex) > 26) continue;
      const dist = Math.hypot(ex, ey);
      const ang = Math.atan2(Math.abs(ey), Math.abs(ex));
      if (dist < 720 && ang < 0.62 && dist < bd) {
        bd = dist;
        best = e;
      }
    }
    if (best) {
      const ex = best.x - cx;
      const ey = best.y - best.h / 2 - cy;
      const l = Math.hypot(ex, ey) || 1;
      return { ax: ex / l, ay: ey / l };
    }
    return { ax: p.face, ay: 0 };
  }

  private doThrow() {
    const p = this.player;
    const { ax, ay } = this.aimDir();
    const hero = p.hero;
    const sx = p.x + ax * 16;
    const sy = p.y - 22 + ay * 16;
    let pr: Proj;
    switch (hero.id) {
      case "aegis":
        pr = makeProj(this, "boomer", "p", sx, sy, ax * 600, ay * 600, 13, 4.5);
        pr.pierce = 99;
        break;
      case "chrono":
        pr = makeProj(this, "disc", "p", sx, sy, ax * 680, ay * 680, 9, 1.8);
        pr.pierce = 2;
        pr.bounces = 1;
        break;
      case "volt": {
        pr = makeProj(this, "grenade", "p", sx, sy, 0, 0, 7, 1.3);
        const b = makeBody(sx, sy + 5, 10, 10);
        b.vx = ax * 480 + p.vx * 0.3;
        b.vy = ay * 480 - 230;
        pr.body = b;
        break;
      }
      default:
        pr = makeProj(this, "kunai", "p", sx, sy, ax * 820, ay * 820, 7, 1.2);
        pr.pierce = 1;
    }
    this.projs.push(pr);
    p.ammo -= 1;
    p.throwBuf = 0;
    p.throwCd = 0.2;
    p.throwAnim = 0.2;
    p.vx -= ax * 40;
    this.sfx("throw");
    this.burst(sx, sy, 5, hero.color, 160, 2.5, 0.2, 0);
  }

  private useAbility(ix: number) {
    const p = this.player;
    const hero = p.hero;
    p.abilCd = hero.abilityCd;
    switch (hero.id) {
      case "kage": {
        p.dashDir = (ix !== 0 ? ix : p.face) as 1 | -1;
        p.face = p.dashDir;
        p.dashT = DASH_TIME;
        p.inv = DASH_TIME + 0.1;
        p.vy = 0;
        p.jumpBuf = 0;
        p.atkT = -1;
        p.sqx = 1.4;
        p.sqy = 0.7;
        this.sfx("dash");
        this.shakeBy(0.18);
        this.addFx("streak", p.x, p.y - 20, p.dashDir > 0 ? 0 : Math.PI, 0.25, hero.color, 1, p.dashDir);
        this.burst(p.x, p.y - 20, 10, hero.color, 280, 3, 0.3, 0);
        break;
      }
      case "aegis":
        p.parryT = 0.42;
        p.atkT = -1;
        this.sfx("block");
        this.addFx("shield", p.x + p.face * 18, p.y - 22, 0, 0.16, hero.color, 1.2, p.face);
        break;
      case "chrono":
        this.bubble = { pi: this.pidx(p), t: 0, dur: 3.2, r: 178 };
        this.sfx("bubble");
        this.flashScreen(0.18, hero.color);
        this.addFx("ring", p.x, p.y - 20, 0, 0.5, hero.color, 3.2, 1);
        this.shakeBy(0.15);
        break;
      case "volt":
        p.inv = 0.3;
        p.atkT = -1;
        if (p.onGround) {
          p.vy = -620;
          p.onGround = false;
          p.slam = 1;
          p.slamT = 0.24;
          p.sqx = 0.75;
          p.sqy = 1.3;
          this.burst(p.x, p.y, 10, hero.color, 200, 3, 0.3, 0);
        } else {
          p.slam = 2;
          p.vx = 0;
          p.vy = 1500;
        }
        this.sfx("dash");
        break;
    }
  }

  // ------------------------------------------------------------ combat results
  shieldBlocks(e: Enemy, srcX: number) {
    return e.kind === "brute" && e.state !== "stun" && Math.sign(srcX - e.x) === e.face;
  }

  blockFx(e: Enemy, srcX: number) {
    const fx = e.x + e.face * (e.w / 2 + 6);
    this.sfx("block");
    this.shakeBy(0.2);
    this.hitStopT = Math.max(this.hitStopT, 0.04);
    this.burst(fx, e.y - 26, 12, "#9db8ff", 300, 2.5, 0.3, 0);
    this.addFx("shield", e.x + e.face * 14, e.y - 26, 0, 0.3, "#7ea0ff", 1.1, e.face);
    e.flash = 0.12;
    this.popText(e.x, e.y - e.h - 8, "BLOQUÉ", "#9db8ff", 14);
    void srcX;
  }

  onParry(x: number, y: number) {
    const p = this.player;
    this.sfx("parry");
    this.shakeBy(0.35);
    this.hitStopT = Math.max(this.hitStopT, 0.07);
    this.addFx("ring", x, y, 0, 0.3, "#ffffff", 0.8, 1);
    this.burst(x, y, 16, p.hero.color, 360, 3, 0.35, 0);
    p.abilCd = 0;
    this.flashScreen(0.12, p.hero.color);
  }

  enemyHitPlayer(e: Enemy) {
    const p = this.player;
    if (!p.alive || p.inv > 0) return;
    if (p.parryT > 0 && Math.sign(e.x - p.x) === p.face) {
      e.state = "stun";
      e.t = 0;
      e.stunDur = e.kind === "brute" ? 2.1 : 1.5;
      e.vx = p.face * 240;
      e.flash = 0.2;
      this.onParry((e.x + p.x) / 2, p.y - 24);
      this.award(75, "PARADE", e.x, e.y - e.h - 8, p.hero.color);
      return;
    }
    this.killPlayer("melee");
  }

  closeCall(x: number, y: number) {
    this.award(50, "DE JUSTESSE", x, y - 10, "#ffffff");
    this.slowmo(0.3, 0.32);
    this.sfx("close");
  }

  killEnemy(e: Enemy, cause: KillCause, dirx: number) {
    if (!e.alive) return;
    e.alive = false;
    const p = this.player;
    const cx = e.x;
    const cy = e.y - e.h / 2;
    this.kills++;
    if (this.coop) this.pkills[this.pidx(p)] = (this.pkills[this.pidx(p)] ?? 0) + 1;
    this.combo++;
    this.comboT = 2.6;
    this.comboPop = 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const mult = Math.min(8, this.combo);
    const base = { grunt: 100, shooter: 150, brute: 250, drone: 200 }[e.kind];
    let bonus = 0;
    let label = "";
    switch (cause) {
      case "dash": bonus = 25; label = "DASH"; break;
      case "slam": bonus = 50; label = "SLAM"; break;
      case "boom": bonus = 50; label = "BOOM"; break;
      case "ring": bonus = 75; label = "ÉJECTÉ"; break;
      case "spike": bonus = 75; label = "EMPALÉ"; break;
      case "reflect": bonus = 100; label = "RENVOI"; break;
      case "throw": bonus = 25; label = "SNIPÉ"; break;
      case "boomer": bonus = 25; label = "RETOUR"; break;
      default: break;
    }
    if (!e.onGround && e.kind !== "drone" && (cause === "slash" || cause === "throw" || cause === "boomer")) {
      bonus += 50;
      label = label ? `${label} · AÉRIEN` : "AÉRIEN";
    }
    const pts = (base + bonus) * mult;
    this.score += pts;
    this.scorePop = 1;
    const col = ENEMY_COLORS[e.kind];
    this.popText(cx, cy - e.h / 2 - 8, `+${pts}`, "#ffffff", 20 + Math.min(mult, 8) * 1.5);
    if (label) this.popText(cx, cy - e.h / 2 + 10, label, p.hero.color, 13);
    if (mult >= 2) this.popText(cx + 26, cy - 4, `x${mult}`, "#ffe14a", 14);

    // juice
    const remaining = this.enemies.filter((o) => o.alive).length;
    const last = remaining === 0;
    this.burst(cx, cy, 26, col, 420, 3.6, 0.7, 900, true);
    this.burst(cx, cy, 12, "#ffffff", 560, 2.2, 0.28, 0, false, true);
    this.addFx("ring", cx, cy, 0, 0.3, "#ffffff", 0.9, 1);
    this.addFx("streak", cx, cy, dirx >= 0 ? 0 : Math.PI, 0.22, "#ffffff", 1.4, 1);
    this.decalQueue.push({ x: cx, y: cy, color: col, n: 7 });
    this.corpses.push({
      x: cx, y: cy, vx: dirx * (260 + Math.random() * 160), vy: -(220 + Math.random() * 200),
      rot: 0, vr: dirx * (7 + Math.random() * 7), life: 1.5, max: 1.5, kind: e.kind, face: e.face,
      color: col, w: e.w, h: e.h, flash: 0.09,
    });
    this.sfx("kill");
    this.shakeBy(e.kind === "brute" ? 0.6 : 0.38);
    this.hitStopT = Math.max(this.hitStopT, e.kind === "brute" ? 0.09 : 0.055);
    this.zoomPunch(cx, cy, 0.026);
    this.flashScreen(0.1, "#ffffff");
    if (last) {
      this.slowmo(0.2, 0.8);
      this.zoomPunch(cx, cy, 0.08);
      this.hitStopT = Math.max(this.hitStopT, 0.12);
    }
    // passives
    if (p.alive) {
      switch (p.hero.id) {
        case "kage":
          p.rush = 3;
          if (cause === "dash") p.abilCd = 0;
          break;
        case "chrono":
          p.abilCd -= 2.5;
          break;
        case "volt":
          p.ammo = Math.min(p.hero.maxAmmo, p.ammo + 1);
          break;
        case "aegis":
          p.ammo = Math.min(p.hero.maxAmmo, p.ammo + 0.5);
          break;
      }
    }
  }

  killPlayer(cause: string, force = false) {
    const p = this.player;
    if (!p.alive || this.roomState !== "play" || this.phase !== "playing") return;
    if (p.inv > 0 && !force) return;
    p.alive = false;
    p.atkT = -1;
    p.dashT = 0;
    p.slam = 0;
    if (this.coop) {
      this.coopDeath(p, cause);
      return;
    }
    this.lives = Math.max(0, this.lives - 1);
    this.roomDeaths++;
    this.combo = 0;
    this.comboT = 0;
    this.roomState = "dead";
    this.stateT = 0;
    this.bubble = null;
    const cx = p.x;
    const cy = p.y - 19;
    this.burst(cx, cy, 36, p.hero.color, 520, 3.8, 0.9, 900, true);
    this.burst(cx, cy, 16, "#ffffff", 640, 2.2, 0.35, 0, false, true);
    this.addFx("ring", cx, cy, 0, 0.45, p.hero.color, 1.6, 1);
    this.decalQueue.push({ x: cx, y: cy, color: p.hero.color, n: 9 });
    if (cause !== "pit") {
      this.corpses.push({
        x: cx, y: cy, vx: -p.face * 200, vy: -300, rot: 0, vr: -p.face * 9, life: 2, max: 2,
        kind: "hero", face: p.face, color: p.hero.color, w: p.w, h: p.h, flash: 0.12,
      });
    }
    this.sfx("death");
    this.shakeBy(1);
    this.hitStopT = 0.15;
    this.slowmo(0.22, 1.1);
    this.flashScreen(0.5, "#ff2d4e");
    this.zoomPunch(cx, cy, 0.07);
    const tag = { melee: "TRANCHÉ", bullet: "ABATTU", spikes: "EMPALÉ", pit: "TOMBÉ", boom: "EXPLOSÉ", drone: "PERCUTÉ" }[cause as "melee"] ?? "ÉLIMINÉ";
    this.banner = {
      title: tag,
      sub: this.lives > 0 ? `${this.lives} ${this.lives === 1 ? "VIE RESTANTE" : "VIES RESTANTES"}` : "PLUS AUCUNE VIE",
      t: 0, dur: 1.4, color: "#ff3b5c",
    };
  }

  /** Co-op : un joueur tombe ; il revient si l'équipe a encore des vies, sinon il attend la salle suivante. */
  private coopDeath(p: Player, cause: string) {
    const i = this.pidx(p);
    this.pdeaths[i] = (this.pdeaths[i] ?? 0) + 1;
    if (this.bubble?.pi === i) this.bubble = null;
    const cx = p.x;
    const cy = p.y - 19;
    const col = this.tagColor(i);
    this.burst(cx, cy, 30, p.hero.color, 480, 3.6, 0.8, 900, true);
    this.burst(cx, cy, 12, "#ffffff", 600, 2.2, 0.35, 0, false, true);
    this.addFx("ring", cx, cy, 0, 0.45, col, 1.4, 1);
    this.decalQueue.push({ x: cx, y: cy, color: p.hero.color, n: 8 });
    if (cause !== "pit") {
      this.corpses.push({
        x: cx, y: cy, vx: -p.face * 200, vy: -300, rot: 0, vr: -p.face * 9, life: 2, max: 2,
        kind: "hero", face: p.face, color: p.hero.color, w: p.w, h: p.h, flash: 0.12,
      });
    }
    this.sfx("death");
    this.shakeBy(0.7);
    this.hitStopT = Math.max(this.hitStopT, 0.08);
    this.flashScreen(0.25, "#ff2d4e");
    const name = this.coop![i]?.name ?? "J" + (i + 1);
    if (this.lives > 0) {
      this.lives--;
      this.respawnT[i] = RESPAWN;
      this.popText(cx, cy - 40, `${name} K.O.`, col, 18);
    } else {
      this.respawnT[i] = 0;
      this.popText(cx, cy - 40, `${name} K.O. — plus de vies`, col, 16);
    }
    const anyAlive = this.players.some((q) => q.alive);
    const anyBack = this.respawnT.some((t, k) => t > 0 && !this.players[k].alive);
    if (!anyAlive && !anyBack) {
      this.combo = 0;
      this.comboT = 0;
      this.roomState = "dead";
      this.stateT = 0;
      this.slowmo(0.22, 1.1);
      this.banner = { title: "ÉQUIPE DÉCIMÉE", sub: "PLUS AUCUNE VIE", t: 0, dur: 1.4, color: "#ff3b5c" };
    }
  }

  // ------------------------------------------------------------ barrels & explosions
  igniteBarrel(b: Barrel, delay: number) {
    if (!b.alive || b.fuse >= 0) return;
    b.fuse = delay;
    b.flash = 1;
    this.sfx("warn");
  }

  private updateBarrels(dt: number) {
    for (const b of this.barrels) {
      if (!b.alive) continue;
      b.flash -= dt * 6;
      if (b.fuse >= 0) {
        b.fuse -= dt;
        if (b.fuse <= 0) {
          b.alive = false;
          this.explode(b.x, b.y - 17, 120, "barrel");
        }
      }
    }
  }

  explode(x: number, y: number, r: number, source: "barrel" | "grenade") {
    const p = this.player;
    this.sfx("explode");
    this.shakeBy(0.95);
    this.hitStopT = Math.max(this.hitStopT, 0.07);
    this.flashScreen(0.55, "#ffb040");
    this.zoomPunch(x, y, 0.05);
    this.addFx("ring", x, y, 0, 0.5, "#ffd27a", r / 40, 1);
    this.addFx("ring", x, y, 0, 0.35, "#ffffff", r / 70, 1);
    for (let i = 0; i < 46; i++) {
      const c = ["#ffe14a", "#ff8a2d", "#ff4b2d", "#ffffff"][i % 4];
      this.burst(x, y, 1, c, 150 + Math.random() * 520, 3 + Math.random() * 3, 0.5 + Math.random() * 0.6, 300, true);
    }
    this.decalQueue.push({ x, y: y + 16, color: "#2a1018", n: 8 });
    for (const e of this.enemies) {
      if (!e.alive || e.state === "spawn") continue;
      if (Math.hypot(e.x - x, e.y - e.h / 2 - y) < r + 6) this.killEnemy(e, "boom", Math.sign(e.x - x) || 1);
    }
    if (source === "barrel") {
      for (const pl of this.players) {
        if (pl.alive && pl.inv <= 0 && Math.hypot(pl.x - x, pl.y - 19 - y) < r) {
          this.player = pl;
          this.killPlayer("boom");
        }
      }
      this.player = p;
    }
    for (const b of this.barrels) {
      if (b.alive && b.fuse < 0 && Math.hypot(b.x - x, b.y - 17 - y) < r * 1.15) this.igniteBarrel(b, 0.09);
    }
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const pr = this.projs[i];
      if (pr.owner === "e" && Math.hypot(pr.x - x, pr.y - y) < r * 1.2) this.projs.splice(i, 1);
    }
  }

  // ------------------------------------------------------------ juice helpers
  shakeBy(v: number) {
    this.shake = Math.min(1.2, Math.max(this.shake, v) + v * 0.15);
  }

  flashScreen(a: number, color: string) {
    this.flash = Math.max(this.flash, a);
    this.flashColor = color;
  }

  zoomPunch(x: number, y: number, z: number) {
    this.zoom = Math.max(this.zoom, z);
    this.zoomX = x;
    this.zoomY = y;
  }

  slowmo(scale: number, dur: number) {
    if (this.slowT <= 0 || scale < this.slowScale) this.slowScale = scale;
    this.slowT = Math.max(this.slowT, dur);
  }

  award(points: number, label: string, x: number, y: number, color: string) {
    this.score += points;
    this.scorePop = 1;
    this.popText(x, y, `${label} +${points}`, color, 14);
    this.sfx("coin");
  }

  popText(x: number, y: number, text: string, color: string, size = 16) {
    if (this.texts.length > 40) this.texts.shift();
    this.texts.push({ x, y, vy: -46, text, color, size, t: 0, life: 1.0 });
  }

  addFx(k: FxKind, x: number, y: number, a: number, life: number, color: string, s: number, face: number) {
    if (this.fx.length > 140) return;
    this.fx.push({ k, x, y, a, t: 0, life, color, s, face });
  }

  burst(x: number, y: number, n: number, color: string, speed: number, size: number, life: number, grav: number, bounce = false, line = false) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= MAX_PARTS) return;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.25 + Math.random() * 0.75);
      const l = life * (0.6 + Math.random() * 0.6);
      this.parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (grav > 0 ? speed * 0.15 : 0),
        life: l, max: l, size: size * (0.6 + Math.random() * 0.8), color, grav, drag: line ? 3 : 1.5,
        glow: false, bounce, line,
      });
    }
  }

  // ------------------------------------------------------------ visuals
  private updateVisuals(dt: number) {
    // particles
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.life -= dt;
      if (q.life <= 0) {
        this.parts[i] = this.parts[this.parts.length - 1];
        this.parts.pop();
        continue;
      }
      q.vy += q.grav * dt;
      const dr = Math.max(0, 1 - q.drag * dt);
      q.vx *= dr;
      q.vy *= q.grav > 0 ? 1 : dr;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.bounce && q.vy > 0 && pointInSolid(q.x, q.y + 1, this.platforms)) {
        q.vy *= -0.38;
        q.vx *= 0.7;
        q.y -= 2;
      }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += dt;
      t.y += t.vy * dt;
      t.vy *= 1 - Math.min(1, 2.5 * dt);
      if (t.t >= t.life) this.texts.splice(i, 1);
    }
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      if (f.t >= f.life) this.fx.splice(i, 1);
    }
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const c = this.corpses[i];
      c.life -= dt;
      c.flash -= dt;
      c.vy += 1500 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
      if (c.vy > 0 && pointInSolid(c.x, c.y + c.h / 2, this.platforms)) {
        c.vy *= -0.3;
        c.vx *= 0.55;
        c.vr *= 0.5;
        c.y -= 3;
      }
      if (c.life <= 0 || c.y > H + 200) this.corpses.splice(i, 1);
    }
    // embers
    this.emberT -= dt;
    if (this.emberT <= 0 && this.parts.length < MAX_PARTS - 50) {
      this.emberT = 0.12;
      this.parts.push({
        x: Math.random() * W, y: H + 10, vx: (Math.random() - 0.5) * 20, vy: -(30 + Math.random() * 50),
        life: 5, max: 5, size: 1.5 + Math.random() * 1.8, color: this.level.accent, grav: 0, drag: 0,
        glow: true, bounce: false, line: false,
      });
    }
  }

  // ------------------------------------------------------------ HUD info for touch buttons
  get hud() {
    const p = this.player;
    const cdPct = p ? clamp(1 - p.abilCd / p.hero.abilityCd, 0, 1) : 1;
    return {
      ammo: p ? Math.floor(p.ammo + 0.0001) : 0,
      ammoFrac: p ? p.ammo - Math.floor(p.ammo) : 0,
      maxAmmo: p ? p.hero.maxAmmo : 0,
      abilPct: cdPct,
    };
  }
}

