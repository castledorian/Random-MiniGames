import { audio } from "./audio";
import { input, emptyCtrl } from "./input";
import { FX } from "./fx";
import { Fighter } from "./fighter";
import type { ActiveAttack } from "./fighter";
import { AI } from "./ai";
import { buildBackground, renderGame } from "./render";
import { W, H, STEP, STAGES, BLAST, HEROES, HERO_LIST, type HeroDef, type HeroId, type ModeId, type StageDef, type Rect } from "./constants";

export type Status = "playing" | "paused" | "over";

export interface Projectile {
  id: number;
  owner: Fighter;
  team: 0 | 1;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  kb: number;
  growth: number;
  angle: number;
  hitstop: number;
  life: number;
  kind: "bolt" | "fire";
  color: string;
  group: number;
  grav: number;
  alive: boolean;
}

export interface Item {
  x: number;
  y: number;
  life: number;
}

export interface Banner {
  text: string;
  sub?: string;
  color: string;
  t: number;
  dur: number;
}

export interface GameConfig {
  mode: ModeId;
  hero: HeroId;
  touch: boolean;
  best: number;
}

export interface GameSummary {
  mode: ModeId;
  hero: HeroId;
  score: number;
  kos: number;
  maxCombo: number;
  time: number;
  progress: string;
  victory: boolean;
  reason: string;
}

export interface GameCallbacks {
  onStatus: (s: Status) => void;
  onOver: (s: GameSummary) => void;
}

interface SpawnSpec {
  t: number;
  hero: HeroDef;
  level: number;
  stocks: number;
  boss: boolean;
  name: string;
}

interface HitData {
  dmg: number;
  kb: number;
  growth: number;
  angle: number;
  hitstop: number;
  shake: number;
  dirX: 1 | -1;
}

const ARCADE = [
  { name: "RECRUE", level: 0.05, stocks: 1, boss: false },
  { name: "ROUTARD", level: 0.2, stocks: 2, boss: false },
  { name: "CHASSEUR", level: 0.36, stocks: 2, boss: false },
  { name: "GLADIATEUR", level: 0.52, stocks: 2, boss: false },
  { name: "CHAMPION", level: 0.7, stocks: 2, boss: false },
  { name: "OVERLORD", level: 0.88, stocks: 3, boss: true },
];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cfg: GameConfig;
  cb: GameCallbacks;

  cw = 1280;
  ch = 720;
  q = 1;
  scale = 1;
  offX = 0;
  offY = 0;
  bg: HTMLCanvasElement | null = null;
  overlayControls = false;
  motes: { x: number; y: number; s: number; v: number; a: number }[] = [];

  stage: StageDef = STAGES[0];
  stageIdx = 0;
  fighters: Fighter[] = [];
  player!: Fighter;
  projectiles: Projectile[] = [];
  items: Item[] = [];
  fx = new FX();

  status: Status = "playing";
  t = 0;
  elapsed = 0;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private nextId = 1;
  private nextGroup = 1;

  timeScale = 1;
  slowT = 0;
  shake = 0;
  zoomPunch = 0;
  flashA = 0;
  flashColor = "#ffffff";
  dangerA = 0;
  camX = 0;
  camY = 0;

  score = 0;
  shownScore = 0;
  scorePop = 0;
  kos = 0;
  combo = 0;
  comboT = 0;
  comboPop = 0;
  comboMult = 1;
  maxCombo = 0;

  banner: Banner | null = null;
  private bannerQ: { delay: number; text: string; sub?: string; color: string; dur: number }[] = [];
  hintT = 12;
  hintDur = 12;
  modeLabel = "";
  modeSub = "";

  private spawnQueue: SpawnSpec[] = [];
  private phase: "fight" | "clearing" | "break" | "victory" = "fight";
  private phaseT = 0;
  private round = 0;
  private wave = 0;
  timeLeft = 90;
  private overT = -1;
  private itemT = 14;
  private roundTime = 0;
  private lastSecond = 99;

  private onVis = () => {
    if (document.hidden && this.status === "playing") this.pause();
  };

  constructor(canvas: HTMLCanvasElement, cfg: GameConfig, cb: GameCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.cfg = cfg;
    this.cb = cb;
    this.reset();
    document.addEventListener("visibilitychange", this.onVis);
  }

  // ------------------------------------------------------------ lifecycle

  start() {
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    audio.startMusic();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    document.removeEventListener("visibilitychange", this.onVis);
    audio.stopMusic();
    input.reset();
  }

  resize(cssW: number, cssH: number) {
    cssW = Math.max(100, cssW);
    cssH = Math.max(60, cssH);
    const dpr = window.devicePixelRatio || 1;
    let q = Math.min(dpr, 2);
    const maxPix = 2.4e6;
    if (cssW * cssH * q * q > maxPix) q = Math.sqrt(maxPix / (cssW * cssH));
    q = Math.max(0.5, q);
    this.cw = cssW;
    this.ch = cssH;
    this.q = q;
    this.canvas.width = Math.round(cssW * q);
    this.canvas.height = Math.round(cssH * q);
    this.overlayControls = this.cfg.touch && window.innerWidth >= window.innerHeight;
    this.scale = Math.min(cssW / W, cssH / H);
    this.offX = (cssW - W * this.scale) / 2;
    this.offY = (cssH - H * this.scale) / 2;
    this.bg = buildBackground(this);
  }

  visible() {
    return { x0: -this.offX / this.scale, y0: -this.offY / this.scale, x1: (this.cw - this.offX) / this.scale, y1: (this.ch - this.offY) / this.scale };
  }

  pause() {
    if (this.status !== "playing") return;
    this.status = "paused";
    input.reset();
    audio.play("pause");
    audio.stopMusic();
    this.cb.onStatus("paused");
  }

  resume() {
    if (this.status !== "paused") return;
    this.status = "playing";
    this.last = performance.now();
    this.acc = 0;
    audio.startMusic();
    this.cb.onStatus("playing");
  }

  togglePause() {
    if (this.status === "playing") this.pause();
    else if (this.status === "paused") this.resume();
  }

  restart() {
    this.reset();
    this.last = performance.now();
    this.acc = 0;
    audio.startMusic();
    this.cb.onStatus("playing");
  }

  // ---------------------------------------------------------------- reset

  private reset() {
    this.fx.clear();
    this.projectiles = [];
    this.items = [];
    this.spawnQueue = [];
    this.bannerQ = [];
    this.banner = null;
    this.t = 0;
    this.elapsed = 0;
    this.timeScale = 1;
    this.slowT = 0;
    this.shake = 0;
    this.zoomPunch = 0;
    this.flashA = 0;
    this.dangerA = 0;
    this.camX = 0;
    this.camY = 0;
    this.score = 0;
    this.shownScore = 0;
    this.scorePop = 0;
    this.kos = 0;
    this.combo = 0;
    this.comboT = 0;
    this.comboPop = 0;
    this.comboMult = 1;
    this.maxCombo = 0;
    this.hintT = this.hintDur = 12;
    this.phase = "fight";
    this.phaseT = 0;
    this.round = 0;
    this.wave = 0;
    this.timeLeft = 90;
    this.overT = -1;
    this.itemT = 14;
    this.roundTime = 0;
    this.lastSecond = 99;
    this.stageIdx = 0;
    this.stage = STAGES[0];
    if (this.cw > 1) this.bg = buildBackground(this);

    this.player = new Fighter(HEROES[this.cfg.hero], {
      team: 0,
      stocks: this.cfg.mode === "timeattack" ? 99 : 3,
      isPlayer: true,
      name: "TOI",
    });
    const sp = this.playerSpawn();
    this.player.spawnIn(sp.x, sp.y, 0);
    this.fighters = [this.player];
    this.status = "playing";
    input.reset();

    switch (this.cfg.mode) {
      case "arcade":
        this.startRound();
        break;
      case "survival":
        this.startWave();
        break;
      case "timeattack":
        this.modeLabel = "CONTRE-LA-MONTRE";
        this.modeSub = "";
        this.say("COMBATTEZ !", "90 secondes · chaque KO ajoute du temps", "#ffd23f", 1.5);
        this.spawnQueue.push(this.makeSpec(0.9, 0.1), this.makeSpec(1.8, 0.12));
        audio.play("start");
        break;
    }
  }

  private playerSpawn() {
    const p = this.stage.platforms.find((q) => q.solid) || this.stage.platforms[0];
    return { x: p.x + p.w * 0.3, y: p.y - this.player.h / 2 };
  }

  private say(text: string, sub: string | undefined, color: string, dur = 1.1, delay = 0) {
    this.bannerQ.push({ text, sub, color, dur, delay });
  }

  // ----------------------------------------------------------- mode logic

  private enemies() {
    return this.fighters.filter((f) => f.team === 1 && !f.removed);
  }

  private makeSpec(t: number, level: number, boss = false, name = "", stocks = 1): SpawnSpec {
    const pool = HERO_LIST;
    const hero = pool[Math.floor(Math.random() * pool.length)];
    return { t, hero, level, stocks, boss, name: name || hero.name };
  }

  private changeStage(idx: number) {
    this.stageIdx = idx;
    this.stage = STAGES[idx];
    this.bg = buildBackground(this);
    this.projectiles = [];
    this.items = [];
    this.flashA = 0.9;
    this.flashColor = "#ffffff";
    const p = this.player;
    if (p.state === "alive") {
      const pct = p.percent;
      const sp = this.playerSpawn();
      p.spawnIn(sp.x, sp.y, 1.2);
      p.percent = pct;
    }
  }

  private startRound() {
    this.round++;
    const r = ARCADE[this.round - 1];
    const others = HERO_LIST.filter((h) => h.id !== this.player.hero.id).sort((a, b) => a.weight - b.weight);
    const hero = r.boss ? HERO_LIST[Math.floor(Math.random() * 4)] : this.round <= 3 ? others[(this.round - 1) % others.length] : HERO_LIST[Math.floor(Math.random() * 4)];
    const idx = (this.round - 1) % STAGES.length;
    if (idx !== this.stageIdx) this.changeStage(idx);
    this.spawnQueue.push({ t: 0.9, hero, level: r.level, stocks: r.stocks, boss: r.boss, name: r.name });
    this.modeLabel = `COMBAT ${this.round} / ${ARCADE.length}`;
    this.modeSub = `vs ${r.name} · ${hero.name}`;
    this.say(r.boss ? "COMBAT FINAL" : `COMBAT ${this.round}`, `${r.name} · ${hero.title}`, r.boss ? "#ff3e5e" : "#22e6ff", 1.1);
    this.say("COMBATTEZ !", undefined, "#ffd23f", 0.8);
    this.phase = "fight";
    this.roundTime = 0;
    audio.play("start");
  }

  private startWave() {
    this.wave++;
    const w = this.wave;
    const idx = Math.floor((w - 1) / 3) % STAGES.length;
    if (idx !== this.stageIdx) this.changeStage(idx);
    const counts = [1, 2, 2, 3, 3, 3];
    let count = counts[w - 1] ?? 4;
    const boss = w % 5 === 0;
    if (boss) count = Math.max(2, count - 1);
    const base = clamp(0.1 + 0.06 * (w - 1), 0, 0.95);
    for (let i = 0; i < count; i++) {
      const isBoss = boss && i === 0;
      const lv = clamp(base + (isBoss ? 0.12 : 0) + (Math.random() - 0.5) * 0.08, 0.03, 1);
      this.spawnQueue.push(this.makeSpec(0.9 + i * 1.0, lv, isBoss, isBoss ? "BOSS" : "", 1));
    }
    this.modeLabel = `VAGUE ${w}`;
    this.say(boss ? `VAGUE ${w} · BOSS` : `VAGUE ${w}`, `${count} adversaire${count > 1 ? "s" : ""}`, boss ? "#ff3e5e" : "#22e6ff", 1.2);
    if (w === 1) this.say("COMBATTEZ !", undefined, "#ffd23f", 0.8);
    this.phase = "fight";
    audio.play(w === 1 ? "start" : "wave");
  }

  private spawnEnemy(s: SpawnSpec) {
    const lv = s.level;
    const f = new Fighter(s.hero, {
      team: 1,
      stocks: s.stocks,
      ai: new AI(lv),
      scale: s.boss ? 1.28 : 1,
      boss: s.boss,
      dmgMult: lerp(0.72, 1.2, lv) * (s.boss ? 1.2 : 1),
      weightMult: lerp(0.85, 1.1, lv) * (s.boss ? 1.4 : 1),
      name: s.name,
      level: lv,
    });
    f.takenMult = lerp(1.6, 1.0, lv) * (s.boss ? 0.9 : 1);
    const sp = this.pickSpawn(f.h);
    f.x = sp.x;
    f.y = sp.y;
    f.state = "waiting";
    f.stateT = 0.55;
    this.fighters.push(f);
    audio.play("spawn");
  }

  private pickSpawn(h: number) {
    const solids = this.stage.platforms.filter((p) => p.solid);
    let x = 0;
    let y = 0;
    for (let i = 0; i < 8; i++) {
      const p = solids[Math.floor(Math.random() * solids.length)];
      x = p.x + 60 + Math.random() * (p.w - 120);
      y = p.y - h / 2;
      if (Math.abs(x - this.player.x) > 260) break;
    }
    return { x, y };
  }

  private updateMode(dt: number) {
    // spawn queue
    for (const s of this.spawnQueue) s.t -= dt;
    while (this.spawnQueue.length && this.spawnQueue[0].t <= 0) this.spawnEnemy(this.spawnQueue.shift()!);

    // heal orbs
    this.itemT -= dt;
    if (this.itemT <= 0) {
      this.itemT = 13 + Math.random() * 6;
      if (this.player.state === "alive" && this.player.percent >= 30 && this.items.length < 1) this.spawnItem();
    }

    const mode = this.cfg.mode;
    const alive = this.enemies().length + this.spawnQueue.length;

    if (mode === "timeattack") {
      this.timeLeft -= dt;
      const sec = Math.ceil(this.timeLeft);
      if (sec <= 5 && sec < this.lastSecond && sec > 0) audio.play("tick");
      this.lastSecond = sec;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.finish(false, "TEMPS ÉCOULÉ");
        return;
      }
      const target = this.elapsed < 35 ? 2 : 3;
      if (alive < target) {
        const lv = clamp(0.12 + this.kos * 0.03, 0.1, 0.9);
        this.spawnQueue.push(this.makeSpec(0.6, lv + (Math.random() - 0.5) * 0.1));
      }
      return;
    }

    if (mode === "survival") this.modeSub = `Restants : ${alive}`;

    this.roundTime += dt;
    if (this.phase === "fight") {
      if (alive === 0) {
        this.phase = "clearing";
        this.phaseT = 1.3;
      }
    } else if (this.phase === "clearing") {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.onClear();
    } else if (this.phase === "break") {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        if (mode === "arcade") this.startRound();
        else this.startWave();
      }
    } else if (this.phase === "victory") {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.finish(true, "VICTOIRE !");
    }
  }

  private onClear() {
    const p = this.player;
    audio.play("win");
    if (this.cfg.mode === "arcade") {
      const timeBonus = Math.round(Math.max(0, 50 - this.roundTime) * 25);
      const bonus = 1500 + this.round * 250 + timeBonus;
      this.addScore(bonus, W / 2, 330);
      if (this.round >= ARCADE.length) {
        this.say("VICTOIRE !", "Tu es le champion de l'arène", "#ffd23f", 2.4);
        this.phase = "victory";
        this.phaseT = 2.4;
        this.flashA = 0.6;
        return;
      }
      this.say("COMBAT GAGNÉ", `+${bonus.toLocaleString("fr-FR")}${timeBonus > 300 ? " · bonus vitesse" : ""}`, "#38e08a", 1.6);
      p.percent = Math.max(0, p.percent - 50);
      if (this.round === 3 && p.stocks < 3) {
        p.stocks++;
        this.fx.text(p.x, p.y - 70, "+1 VIE", "#38e08a", 36, 1.4);
      }
    } else {
      const bonus = 400 + this.wave * 150;
      this.addScore(bonus, W / 2, 330);
      this.say("VAGUE TERMINÉE", `+${bonus.toLocaleString("fr-FR")}`, "#38e08a", 1.6);
      p.percent = Math.max(0, p.percent - 25);
      if (this.wave % 5 === 0 && p.stocks < 3) {
        p.stocks++;
        this.fx.text(p.x, p.y - 70, "+1 VIE", "#38e08a", 36, 1.4);
      }
    }
    this.phase = "break";
    this.phaseT = 2.5;
  }

  private finish(victory: boolean, reason: string) {
    if (this.status === "over") return;
    if (victory) this.addScore(3000 + Math.max(0, this.player.stocks) * 1000, W / 2, 380);
    this.status = "over";
    audio.stopMusic();
    audio.play(victory || this.cfg.mode === "timeattack" ? "win" : "lose");
    input.reset();
    const mode = this.cfg.mode;
    const progress = mode === "arcade" ? `Combat ${Math.min(this.round, ARCADE.length)} / ${ARCADE.length}` : mode === "survival" ? `Vague ${this.wave}` : `${this.kos} KO`;
    const summary: GameSummary = {
      mode,
      hero: this.cfg.hero,
      score: Math.round(this.score),
      kos: this.kos,
      maxCombo: this.maxCombo,
      time: this.elapsed,
      progress,
      victory,
      reason,
    };
    this.cb.onStatus("over");
    this.cb.onOver(summary);
  }

  // ------------------------------------------------------------ main loop

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    let rdt = (now - this.last) / 1000;
    this.last = now;
    if (rdt > 0.1) rdt = 0.1;
    if (rdt <= 0) return;

    input.pollPad();
    if (input.padStartEdge) {
      input.padStartEdge = false;
      this.togglePause();
    }
    if (this.status === "paused") return;

    if (this.slowT > 0) this.slowT -= rdt;
    else if (this.timeScale < 1) this.timeScale = Math.min(1, this.timeScale + rdt * 2.5);

    this.acc += rdt;
    let steps = 0;
    while (this.acc >= STEP && steps < 10) {
      this.update(STEP * this.timeScale);
      this.acc -= STEP;
      steps++;
    }
    if (steps >= 10) this.acc = 0;
    renderGame(this.ctx, this);
  };

  private update(dt: number) {
    this.t += dt;
    if (this.status === "playing") {
      this.elapsed += dt;
      const pc = input.ctrl();
      for (const f of this.fighters) {
        if (f.state !== "alive") continue;
        const c = f.isPlayer ? pc : f.ai ? f.ai.think(f, this, dt) : emptyCtrl();
        f.update(dt, c, this);
        if (f.percent > 110 && Math.random() < dt * 9) {
          this.fx.emit("dot", f.x + (Math.random() - 0.5) * f.w, f.y + (Math.random() - 0.5) * f.h, (Math.random() - 0.5) * 40, -60, 0.5, 3, "#ff5a36", { add: true });
        }
      }
      input.clearEdges();
      this.updateProjectiles(dt);
      this.updateItems(dt);
      this.checkBlast();
      this.updateStates(dt);
      this.updateMode(dt);
      if (this.overT >= 0) {
        this.overT -= dt;
        if (this.overT < 0) this.finish(false, "ÉLIMINÉ");
      }
      this.hintT -= dt;
    }

    // banner queue
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.dur) this.banner = null;
    } else if (this.bannerQ.length) {
      const n = this.bannerQ[0];
      n.delay -= dt;
      if (n.delay <= 0) {
        this.banner = { text: n.text, sub: n.sub, color: n.color, t: 0, dur: n.dur };
        this.bannerQ.shift();
      }
    }

    // juice decays
    this.fx.update(dt);
    this.shake *= Math.exp(-10 * dt);
    if (this.shake < 0.2) this.shake = 0;
    this.zoomPunch *= Math.exp(-7 * dt);
    this.flashA = Math.max(0, this.flashA - dt * 3.2);
    this.scorePop *= Math.exp(-8 * dt);
    this.comboPop *= Math.exp(-9 * dt);
    this.shownScore += (this.score - this.shownScore) * Math.min(1, 9 * dt);
    if (Math.abs(this.score - this.shownScore) < 1) this.shownScore = this.score;
    if (this.comboT > 0 && this.status === "playing") {
      this.comboT -= dt;
      if (this.comboT <= 0) {
        this.combo = 0;
        this.comboMult = 1;
      }
    }
    for (const f of this.fighters) {
      f.shownPct += (f.percent - f.shownPct) * Math.min(1, 14 * dt);
      if (Math.abs(f.percent - f.shownPct) < 0.4) f.shownPct = f.percent;
      f.pop *= Math.exp(-9 * dt);
    }

    // camera: gentle follow of the action
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const f of this.fighters) {
      if (f.state === "alive") {
        sx += clamp(f.x, 0, W);
        sy += clamp(f.y, 0, H);
        n++;
      }
    }
    const tx = n ? clamp((sx / n - W / 2) * 0.07, -36, 36) : 0;
    const ty = n ? clamp((sy / n - H / 2) * 0.05, -22, 22) : 0;
    const k = Math.min(1, 3 * dt);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;

    // danger vignette
    const v = this.visible();
    const p = this.player;
    const out = p.state === "alive" && (p.x < v.x0 || p.x > v.x1 || p.y < v.y0 || p.y > v.y1);
    this.dangerA += ((out ? 1 : 0) - this.dangerA) * Math.min(1, 10 * dt);
  }

  // ---------------------------------------------------------- state upkeep

  private updateStates(dt: number) {
    for (const f of this.fighters) {
      if (f.state === "dead") {
        if (f.removed) continue;
        f.stateT -= dt;
        if (f.stateT <= 0) {
          if (f.isPlayer) {
            if (f.stocks > 0) {
              f.spawnIn(W / 2, 70, 2.3);
              this.fx.ring(W / 2, 70, 10, 300, 0.5, f.hero.accent);
              this.fx.sparks(W / 2, 70, 20, 0, Math.PI, 100, 500, f.hero.accent, 0.5);
              audio.play("spawn");
            }
          } else {
            const s = this.pickSpawn(f.h);
            f.x = s.x;
            f.y = s.y;
            f.state = "waiting";
            f.stateT = 0.55;
            audio.play("spawn");
          }
        }
      } else if (f.state === "waiting") {
        f.stateT -= dt;
        if (f.stateT <= 0) {
          f.spawnIn(f.x, f.y, 0.5);
          this.fx.ring(f.x, f.feet, 10, 360, 0.4, f.hero.accent);
          this.fx.sparks(f.x, f.feet, 22, -Math.PI / 2, 1.2, 150, 700, f.hero.accent, 0.5);
          this.fx.dust(f.x, f.feet, 8);
          this.addShake(5);
        }
      }
    }
    if (this.fighters.some((f) => f.removed && f.state === "dead")) {
      this.fighters = this.fighters.filter((f) => !(f.removed && f.state === "dead"));
    }
  }

  private checkBlast() {
    for (const f of this.fighters) {
      if (f.state !== "alive") continue;
      if (f.x < BLAST.l || f.x > BLAST.r || f.y < BLAST.t || f.y > BLAST.b) this.ko(f);
    }
  }

  private ko(f: Fighter) {
    const v = this.visible();
    const m = 26;
    const kx = clamp(f.x, v.x0 + m, v.x1 - m);
    const ky = clamp(f.y, v.y0 + m, v.y1 - m);
    const inward = Math.atan2(H / 2 - ky, W / 2 - kx);
    const col = f.hero.color;
    this.fx.ring(kx, ky, 20, 900, 0.7, "#ffffff");
    this.fx.ring(kx, ky, 10, 520, 0.9, col);
    this.fx.star(kx, ky, 90, 0.5, "#ffffff");
    this.fx.sparks(kx, ky, 46, inward, 0.9, 300, 1500, col, 0.9, 3.5);
    this.fx.sparks(kx, ky, 24, inward, 1.4, 200, 900, "#ffffff", 0.6, 3);
    this.fx.shards(kx, ky, 14, col, 700);
    this.addShake(30);
    this.zoomPunch = 0.07;
    this.flashA = f.isPlayer ? 0.5 : 0.65;
    this.flashColor = f.isPlayer ? "#ff3e5e" : "#ffffff";
    this.slow(f.isPlayer && f.stocks <= 1 && this.cfg.mode !== "timeattack" ? 1.0 : 0.5, 0.28);
    audio.play("ko");
    this.buzz(f.isPlayer ? [40, 40, 90] : 35);

    f.state = "dead";
    f.attack = null;
    f.shieldT = 0;
    f.dashT = 0;
    f.stocks--;

    if (f.team === 1) {
      this.kos++;
      const killer = this.t - f.lastHitT < 6 ? f.lastHitBy : null;
      let pts = 0;
      let label = "CHUTE !";
      if (killer && killer.isPlayer) {
        pts = 1000;
        label = "ÉJECTÉ !";
        if (f.percent < 60) {
          pts += 500;
          label = "KO PRÉCOCE !";
        }
        if (f.lastAngle < -30) {
          pts += 300;
          label = "SPIKE !";
        }
        if (f.boss) pts += 2000;
        pts *= this.comboMult;
      } else {
        pts = 150;
      }
      this.addScore(pts, kx, ky + (ky < H / 2 ? 190 : -110));
      this.fx.text(kx, ky + (ky < H / 2 ? 140 : -62), label, "#ffffff", 34, 1.3);
      if (this.cfg.mode === "timeattack") {
        this.timeLeft += 2;
        this.fx.text(kx, ky + (ky < H / 2 ? 235 : -160), "+2 s", "#22e6ff", 30, 1.2);
      }
      if (f.stocks <= 0) f.removed = true;
      else f.stateT = 1.5;
    } else {
      this.combo = 0;
      this.comboMult = 1;
      this.comboT = 0;
      f.stateT = 1.2;
      if (this.cfg.mode === "timeattack") {
        this.timeLeft = Math.max(0.5, this.timeLeft - 4);
        this.fx.text(kx, ky + (ky < H / 2 ? 100 : -100), "-4 s", "#ff3e5e", 34, 1.3);
      } else if (f.stocks <= 0) {
        this.overT = 1.4;
      }
    }
  }

  // ----------------------------------------------------------------- hits

  addShake(a: number) {
    this.shake = Math.min(36, Math.max(this.shake, a));
  }

  private slow(dur: number, factor: number) {
    this.slowT = Math.max(this.slowT, dur);
    this.timeScale = Math.min(this.timeScale, factor);
  }

  private buzz(p: number | number[]) {
    if (this.cfg.touch && navigator.vibrate) {
      try {
        navigator.vibrate(p);
      } catch {
        /* ignore */
      }
    }
  }

  addScore(n: number, x?: number, y?: number) {
    this.score += n;
    this.scorePop = 1;
    if (x !== undefined && y !== undefined) this.fx.text(x, y, `+${Math.round(n).toLocaleString("fr-FR")}`, "#ffd23f", 38, 1.2);
  }

  checkMelee(att: Fighter, a: ActiveAttack) {
    const d = a.def;
    if (!d.box) return;
    const s = att.scale;
    const rw = d.box.w * s * att.hero.reach;
    const bx = d.box.x * s;
    const left = att.facing === 1 ? att.x + bx : att.x - bx - rw;
    const box: Rect = { x: left, y: att.y + d.box.y * s - (d.box.h * s) / 2, w: rw, h: d.box.h * s };
    for (const v of this.fighters) {
      if (v === att || v.team === att.team || v.state !== "alive" || v.invuln > 0 || a.hit.has(v.id)) continue;
      const vr = v.rect();
      if (!overlap(box, vr)) continue;
      a.hit.add(v.id);
      const ix = (Math.max(box.x, vr.x) + Math.min(box.x + box.w, vr.x + vr.w)) / 2;
      const iy = (Math.max(box.y, vr.y) + Math.min(box.y + box.h, vr.y + vr.h)) / 2;
      this.applyHit(att, v, { dmg: d.dmg, kb: d.kb, growth: d.growth, angle: d.angle, hitstop: d.hitstop, shake: d.shake, dirX: att.facing }, ix, iy, true);
    }
  }

  checkDashHit(f: Fighter) {
    const box: Rect = { x: f.x - f.w / 2 - (f.dashDir < 0 ? 18 : 0), y: f.y - f.h / 2 - 4, w: f.w + 18, h: f.h + 8 };
    for (const v of this.fighters) {
      if (v === f || v.team === f.team || v.state !== "alive" || v.invuln > 0 || f.dashHit.has(v.id)) continue;
      const vr = v.rect();
      if (!overlap(box, vr)) continue;
      f.dashHit.add(v.id);
      this.applyHit(f, v, { dmg: 7, kb: 440, growth: 740, angle: 32, hitstop: 0.1, shake: 11, dirX: f.dashDir }, (f.x + v.x) / 2, (f.y + v.y) / 2, true);
      f.dashT = 0;
      f.vx = -f.dashDir * 170;
      f.vy = -120;
      f.cd = Math.max(0, f.cd - 0.8);
    }
  }

  shieldPulse(f: Fighter) {
    this.fx.ring(f.x, f.y, 30, 520, 0.4, f.hero.accent);
    this.fx.sparks(f.x, f.y, 14, 0, Math.PI, 200, 520, f.hero.accent, 0.35);
    audio.play("block");
    for (const v of this.fighters) {
      if (v === f || v.team === f.team || v.state !== "alive" || v.invuln > 0) continue;
      if (Math.hypot(v.x - f.x, v.y - f.y) < 130) {
        this.applyHit(f, v, { dmg: 2, kb: 380, growth: 260, angle: 38, hitstop: 0.06, shake: 5, dirX: v.x >= f.x ? 1 : -1 }, v.x, v.y, false);
      }
    }
  }

  onBounce(f: Fighter, impact: number) {
    this.fx.dust(f.x, f.feet, 8, "#ffffff", 140);
    this.fx.sparks(f.x, f.feet, 8, -Math.PI / 2, 0.8, 150, 400, "#fff3c0", 0.3);
    this.addShake(Math.min(10, impact * 0.007));
    audio.play("hit", 0.6);
  }

  onWallBounce(f: Fighter, vx: number) {
    const dir = vx > 0 ? 1 : -1;
    this.fx.sparks(f.x + dir * f.w * 0.5, f.y, 8, dir > 0 ? Math.PI : 0, 0.8, 150, 450, "#fff3c0", 0.3);
    this.addShake(6);
    audio.play("hit", 0.5);
  }

  private applyHit(att: Fighter, v: Fighter, h: HitData, px: number, py: number, melee: boolean) {
    // --- shield block
    if (v.shieldT > 0) {
      v.shieldFlash = 0.18;
      this.fx.ring(px, py, 8, 160, 0.25, "#ffffff");
      this.fx.sparks(px, py, 10, h.dirX > 0 ? Math.PI : 0, 0.9, 200, 520, v.hero.accent, 0.3);
      audio.play("block");
      this.addShake(3);
      if (melee) {
        att.vx = -h.dirX * 280;
        att.freeze = 0.07;
        att.attack = null;
      }
      v.freeze = 0.04;
      return;
    }

    const rage = att.hero.id === "ember" ? 1 + Math.min(0.5, att.percent / 220) : 1;
    const dmg = h.dmg * att.dmgMult * att.hero.dmg * rage * v.takenMult;
    v.percent += dmg;
    v.pop = 1;

    const raw = h.kb + h.growth * v.percent * 0.01;
    const kb = (raw / (v.hero.weight * v.weightMult)) * v.armor();
    let ang = h.angle;
    if (v.onGround && ang < 0) ang = 62;
    const rad = (ang * Math.PI) / 180;
    v.vx = Math.cos(rad) * kb * h.dirX;
    v.vy = -Math.sin(rad) * kb;
    if (v.vy < -60) {
      v.onGround = false;
      v.groundPlat = null;
    }
    v.hitstun = Math.max(0.14, 0.1 + kb * 0.00036);
    const strong = kb > 900;
    const hs = h.hitstop * (v.percent > 100 ? 1.25 : 1) + (strong ? 0.04 : 0);
    v.freeze = hs;
    if (melee) att.freeze = hs;
    v.flash = 0.13;
    v.attack = null;
    v.dashT = 0;
    v.shieldT = 0;
    v.fastFall = false;
    v.facing = (-h.dirX) as 1 | -1;
    v.spin = 0;
    v.spinSpeed = kb > 650 ? -h.dirX * Math.min(24, kb * 0.014) : 0;
    v.lastHitBy = att;
    v.lastHitT = this.t;
    v.lastAngle = ang;
    v.noHitT = 0;

    // --- juice
    const flightAng = Math.atan2(v.vy, v.vx);
    const n = 6 + Math.floor(dmg * 1.4);
    this.fx.sparks(px, py, n, flightAng, 0.7, 250, 650 + kb * 0.25, "#fff1b8", 0.38, 2.8);
    this.fx.sparks(px, py, Math.ceil(n / 2), flightAng, 0.9, 150, 500, att.hero.accent, 0.4, 2.6);
    this.fx.star(px, py, 16 + dmg * 3.2, 0.22, "#fff7d6");
    this.fx.ring(px, py, 6, 200 + dmg * 12, 0.26, att.hero.accent);
    if (strong) this.fx.shards(px, py, 8, att.hero.color, 520);
    this.fx.text(v.x + (Math.random() - 0.5) * 20, v.y - v.h * 0.7, String(Math.max(1, Math.round(dmg))), pctColorFor(v.percent), 20 + Math.min(22, dmg * 2.4), 0.8);
    this.addShake(h.shake + kb * 0.004);
    if (strong) {
      this.zoomPunch = Math.max(this.zoomPunch, 0.035);
      this.slow(0.14, 0.4);
    }
    audio.play(strong ? "heavy" : "hit", Math.min(1.2, kb / 900));

    // --- score & combo
    if (att.isPlayer && v.team === 1) {
      this.combo++;
      this.comboT = 1.5;
      this.comboPop = 1;
      this.comboMult = 1 + Math.min(4, Math.floor(this.combo / 3));
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.score += Math.round(dmg * 10 * this.comboMult);
      this.scorePop = Math.max(this.scorePop, 0.5);
      att.cd = Math.max(0, att.cd - 0.25);
      if (this.combo >= 3 && this.combo % 3 === 0) audio.play("combo", this.comboMult / 3);
      this.buzz(strong ? 30 : 10);
    }
    if (v.isPlayer) {
      this.combo = 0;
      this.comboMult = 1;
      this.comboT = 0;
      this.flashA = Math.max(this.flashA, strong ? 0.35 : 0.14);
      this.flashColor = "#ff3e5e";
      this.buzz(strong ? 60 : 25);
    }
  }

  // ---------------------------------------------------------- projectiles

  spawnProjectiles(o: Fighter, kind: "bolt" | "fan") {
    const dir = o.facing;
    const px = o.x + dir * (o.w / 2 + 14);
    const py = o.y - o.h * 0.08;
    const group = this.nextGroup++;
    if (kind === "bolt") {
      this.projectiles.push({
        id: this.nextId++, owner: o, team: o.team, x: px, y: py, vx: dir * 1050, vy: 0, r: 13,
        dmg: 6, kb: 320, growth: 360, angle: 18, hitstop: 0.06, life: 0.95, kind: "bolt", color: o.hero.accent, group, grav: 0, alive: true,
      });
      audio.play("bolt");
      this.fx.sparks(px, py, 10, dir > 0 ? 0 : Math.PI, 0.6, 200, 700, o.hero.accent, 0.3);
      this.fx.ring(px, py, 6, 200, 0.2, o.hero.accent);
      o.vx -= dir * 90;
      this.addShake(2.5);
    } else {
      for (const a of [-0.28, 0, 0.28]) {
        this.projectiles.push({
          id: this.nextId++, owner: o, team: o.team, x: px, y: py, vx: Math.cos(a) * dir * 680, vy: Math.sin(a) * 680 - 40, r: 11,
          dmg: 3.5, kb: 240, growth: 150, angle: 28, hitstop: 0.05, life: 0.46, kind: "fire", color: "#ff9a2e", group, grav: 520, alive: true,
        });
      }
      audio.play("fan");
      this.fx.sparks(px, py, 12, dir > 0 ? 0 : Math.PI, 0.7, 150, 560, "#ffb02e", 0.35);
      o.vx -= dir * 60;
      this.addShake(2.5);
    }
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.life -= dt;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0 || p.x < -260 || p.x > W + 260 || p.y > H + 260 || p.y < -320) {
        p.alive = false;
        if (p.kind === "fire") this.fx.sparks(p.x, p.y, 4, 0, Math.PI, 40, 160, "#ff9a2e", 0.25);
        continue;
      }
      if (Math.random() < dt * 70) {
        if (p.kind === "bolt") this.fx.emit("dot", p.x, p.y, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 0.2, p.r * 0.55, p.color, { add: true });
        else this.fx.emit("dot", p.x, p.y, (Math.random() - 0.5) * 50, -20 - Math.random() * 40, 0.3, p.r * 0.6, "#ff7a1a", { add: true });
      }
      // solid platforms
      let blocked = false;
      for (const pl of this.stage.platforms) {
        if (pl.solid && p.x > pl.x && p.x < pl.x + pl.w && p.y > pl.y && p.y < pl.y + pl.h) blocked = true;
      }
      if (blocked) {
        p.alive = false;
        this.fx.sparks(p.x, p.y, 8, 0, Math.PI, 100, 400, p.color, 0.3);
        continue;
      }
      for (const v of this.fighters) {
        if (!p.alive) break;
        if (v.team === p.team || v.state !== "alive" || v.invuln > 0 || v.hitGroups.includes(p.group)) continue;
        const r = v.rect();
        const cx = clamp(p.x, r.x, r.x + r.w);
        const cy = clamp(p.y, r.y, r.y + r.h);
        if ((p.x - cx) ** 2 + (p.y - cy) ** 2 > p.r * p.r) continue;
        if (v.shieldT > 0) {
          // reflect!
          p.owner = v;
          p.team = v.team;
          p.vx = -p.vx * 1.2;
          p.vy = -p.vy;
          p.group = this.nextGroup++;
          p.life = Math.max(p.life, 0.6);
          p.color = v.hero.accent;
          v.shieldFlash = 0.2;
          this.fx.ring(p.x, p.y, 8, 200, 0.3, "#ffffff");
          this.fx.sparks(p.x, p.y, 12, p.vx > 0 ? 0 : Math.PI, 0.8, 200, 600, "#ffffff", 0.35);
          audio.play("block");
          this.addShake(4);
          continue;
        }
        v.hitGroups.push(p.group);
        if (v.hitGroups.length > 6) v.hitGroups.shift();
        this.applyHit(p.owner, v, { dmg: p.dmg, kb: p.kb, growth: p.growth, angle: p.angle, hitstop: p.hitstop, shake: 3, dirX: p.vx >= 0 ? 1 : -1 }, p.x, p.y, false);
        p.alive = false;
      }
    }
    if (this.projectiles.length > 40) this.projectiles = this.projectiles.filter((p) => p.alive);
    else if (this.projectiles.length && !this.projectiles[0].alive) this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  // ---------------------------------------------------------------- items

  private spawnItem() {
    const plats = this.stage.platforms;
    const p = plats[Math.floor(Math.random() * plats.length)];
    const x = p.x + 40 + Math.random() * (p.w - 80);
    this.items.push({ x, y: p.y - 48, life: 12 });
    this.fx.ring(x, p.y - 48, 6, 200, 0.4, "#78ffaa");
  }

  private updateItems(dt: number) {
    for (const it of this.items) {
      it.life -= dt;
      const p = this.player;
      if (p.state === "alive" && Math.hypot(p.x - it.x, p.y - it.y) < 40) {
        it.life = 0;
        p.percent = Math.max(0, p.percent - 25);
        this.fx.ring(it.x, it.y, 10, 300, 0.45, "#78ffaa");
        this.fx.sparks(it.x, it.y, 18, -Math.PI / 2, Math.PI, 100, 400, "#78ffaa", 0.6);
        this.fx.text(it.x, it.y - 30, "-25 %", "#78ffaa", 34, 1.1);
        audio.play("heal");
      }
    }
    if (this.items.some((i) => i.life <= 0)) this.items = this.items.filter((i) => i.life > 0);
  }

  // ------------------------------------------------------- AI/world helpers

  overPlatform(x: number, feet: number) {
    return this.stage.platforms.some((p) => x >= p.x - 8 && x <= p.x + p.w + 8 && p.y >= feet - 8);
  }

  groundAt(x: number, feet: number) {
    return this.stage.platforms.some((p) => x >= p.x && x <= p.x + p.w && p.y >= feet - 6 && p.y <= feet + 26);
  }

  recoverTarget(f: Fighter) {
    let best = { x: W / 2, y: 520 };
    let bc = Infinity;
    const feet = f.feet;
    for (const p of this.stage.platforms) {
      const inX = f.x >= p.x && f.x <= p.x + p.w;
      let tx = clamp(f.x, p.x + 28, p.x + p.w - 28);
      if (p.solid && inX && feet > p.y) tx = f.x < p.x + p.w / 2 ? p.x - 40 : p.x + p.w + 40;
      const dx = Math.abs(f.x - tx);
      const dy = Math.max(0, feet - p.y);
      const cost = dx + dy * 0.9 - (p.solid ? 40 : 0);
      if (cost < bc) {
        bc = cost;
        best = { x: tx, y: p.y };
      }
    }
    return best;
  }
}

function pctColorFor(p: number) {
  if (p < 50) return "#ffffff";
  if (p < 100) return "#ffe25a";
  if (p < 150) return "#ff9a2e";
  return "#ff4d6a";
}
