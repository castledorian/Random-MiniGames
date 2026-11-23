import { Board, type BoardEvent, type Cell } from './board';
import { AIPlayer } from './ai';
import { FX } from './fx';
import { audio } from './audio';
import { COLS, HIDDEN, HEROES, PALETTE, STAGES, heroById, type HeroId, type Mode, type Stage } from './constants';
import { boardRect, drawBackground, drawBoardView, drawCompactPanel, drawHeroFace, drawPanel, drawStats, fmtTime, formatNum, outlineTxt, rrect, txt, type Mood, type StatLine } from './render';
import { L, t } from './i18n';
import { topScore } from './storage';
import { party, type DevRead } from './partyInput';

export type Action = 'left' | 'right' | 'down' | 'rotCW' | 'rotCCW' | 'drop' | 'skill';
export type Phase = 'ready' | 'playing' | 'paused' | 'ending' | 'over';

export interface PartyPlayer {
  hero: HeroId;
  /** Périphérique ("kbA", "kbB", "gpN", "ph:<pid>") ; null = bot. */
  device: string | null;
  name: string;
  /** Niveau du bot (0..1). */
  level?: number;
}

export interface GameConfig {
  mode: Mode;
  hero: HeroId;
  stage?: number;
  diff?: number;
  /** Versus entre amis (2 à 4 joueurs, humains et bots). */
  party?: PartyPlayer[];
}

export interface PartyStanding {
  idx: number;
  name: string;
  hero: HeroId;
  bot: boolean;
  score: number;
  maxChain: number;
  garbageSent: number;
  place: number;
}

export interface GameResult {
  mode: Mode;
  win: boolean | null;
  reason: 'ko' | 'time';
  score: number;
  bonus: number;
  time: number;
  maxChain: number;
  garbageSent: number;
  hero: HeroId;
  stage?: number;
  stars: number;
  /** Versus entre amis : vainqueur (index, ou null) et classement. */
  party?: { winner: number | null; standings: PartyStanding[] };
}

export interface GameCallbacks {
  onPhase: (p: 'playing' | 'paused' | 'over') => void;
  onOver: (r: GameResult) => void;
  onHud: (h: { energy: number; ready: boolean }) => void;
}

interface View {
  bx: number;
  by: number;
  c: number;
}

interface Layout {
  wide: boolean;
  c: number;
  views: View[];
  panels: ({ x: number; y: number; w: number } | null)[];
  side: { x: number; y: number; w: number } | null;
  miniHdr: { x: number; y: number; w: number; c: number } | null;
  center: { x: number; y: number } | null;
  /** 3-4 joueurs : panneaux compacts au-dessus des plateaux. */
  top?: boolean;
}

interface Ctl {
  held: { left: boolean; right: boolean; down: boolean };
  moveDir: number;
  dasT: number;
  arrT: number;
  rotBuf: { dir: 1 | -1; t: number } | null;
}

const newCtl = (): Ctl => ({ held: { left: false, right: false, down: false }, moveDir: 0, dasT: 0, arrT: 0, rotBuf: null });

/** Couleurs des joueurs J1…J4 (identiques aux autres jeux du site). */
export const SLOT_COLORS = ['#22e6ff', '#ff3e5e', '#38e08a', '#ffd23f'];

const DAS = 0.13;
const ARR = 0.04;
const CHAIN_COLORS = ['#ffffff', '#fff1a8', '#ffd04a', '#ffa23a', '#ff7a45', '#ff4f7a', '#ff4fd0', '#b36bff', '#6b9bff', '#4fe0ff'];
let gamesStarted = 0;

export class Game {
  private ctx: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private dpr = 1;
  boards: Board[] = [];
  private ais: (AIPlayer | null)[] = [];
  /** État des commandes (répétition gauche/droite…) de chaque joueur humain. */
  private ctl: Ctl[] = [newCtl()];
  /** Versus entre amis : ordre d'élimination (pour le classement). */
  private outOrder: number[] = [];
  private fx = new FX();
  phase: Phase = 'ready';
  private prevPhase: Phase = 'ready';
  private raf = 0;
  private last = 0;
  private time = 0;
  private readyT = 0;
  private readyBeep = 0;
  private elapsed = 0;
  private timeLeft = 180;
  private rainT = 12;
  private rainEvery = 12;
  private rainAmt = 4;
  private timeScale = 1;
  private hitstop = 0;
  private endT = 0;
  private endDur = 1.8;
  private result: GameResult | null = null;
  private shown: number[] = [0, 0];
  private bgPulse = 0;
  private hudT = 0;
  private hintT = 0;
  private wasReady = false;
  private lastCentroid: { x: number; y: number }[] = [];
  private L!: Layout;
  private stage: Stage | null = null;
  private best = 0;
  private touch = false;
  private ro: ResizeObserver | null = null;
  private cleanup: (() => void)[] = [];
  private pointers = new Map<number, { x: number; y: number; t: number }>();
  private destroyed = false;

  constructor(private canvas: HTMLCanvasElement, public cfg: GameConfig, private cb: GameCallbacks) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.reset(false);
    this.bindEvents();
    this.raf = requestAnimationFrame(this.loop);
  }

  setTouch(b: boolean) {
    this.touch = b;
  }

  // ------------------------------------------------------------ lifecycle
  reset(quick: boolean) {
    const cfg = this.cfg;
    const hero = heroById(cfg.hero);
    this.fx.clear();
    this.stage = cfg.mode === 'campaign' ? STAGES[Math.min(STAGES.length, Math.max(1, cfg.stage ?? 1)) - 1] : null;
    const vs = cfg.mode === 'campaign' || cfg.mode === 'versus';
    const diff = this.stage ? this.stage.diff : cfg.diff ?? 0.5;
    const colors = this.stage ? this.stage.colors : cfg.mode === 'versus' && diff > 0.8 ? 5 : 4;
    const speedMul = this.stage ? this.stage.speed : 1;
    const seed = (Math.random() * 1e9) | 0;
    const base = vs ? 2.2 * speedMul : 2.2;
    this.boards = [new Board(hero, { colors, seed, fall: base, startEnergy: 40 }, (e) => this.onEvent(0, e))];
    this.ais = [null];
    this.outOrder = [];
    if (cfg.party && cfg.party.length >= 2) {
      // versus entre amis : un plateau par joueur, même tirage de pièces pour tous
      this.boards = cfg.party.map((pl, i) => new Board(heroById(pl.hero), { colors: 4, seed, fall: 2.2, startEnergy: 40 }, (e) => this.onEvent(i, e)));
      this.ais = cfg.party.map((pl, i) => (pl.device ? null : new AIPlayer(this.boards[i], this.boards[i === 0 ? 1 : 0], pl.level ?? 0.5, 4)));
    } else if (vs) {
      let oh = this.stage ? heroById(this.stage.hero) : HEROES[(Math.random() * HEROES.length) | 0];
      if (!this.stage && oh.id === hero.id) oh = HEROES[(HEROES.indexOf(oh) + 1 + ((Math.random() * 3) | 0)) % HEROES.length];
      const ob = new Board(oh, { colors, seed, fall: base, startEnergy: 25 }, (e) => this.onEvent(1, e));
      this.boards.push(ob);
      this.ais.push(new AIPlayer(ob, this.boards[0], diff, colors));
    }
    this.ctl = this.boards.map(() => newCtl());
    this.lastCentroid = this.boards.map(() => ({ x: 0, y: 0 }));
    party.flush();
    this.elapsed = 0;
    this.timeLeft = 180;
    this.rainEvery = 13;
    this.rainT = 11;
    this.rainAmt = 4;
    this.timeScale = 1;
    this.hitstop = 0;
    this.endT = 0;
    this.result = null;
    this.shown = this.boards.map(() => 0);
    this.hudT = 0;
    this.hintT = 0;
    this.wasReady = false;
    this.best = cfg.mode === 'campaign' || this.isParty ? 0 : topScore(cfg.mode);
    this.readyT = quick ? 0.7 : 1.6;
    this.readyBeep = 0;
    this.phase = 'ready';
    gamesStarted++;
    audio.setDuck(1);
    audio.intensity = 0;
    this.cb.onPhase('playing');
    if (this.W > 0) this.computeLayout();
  }

  pause() {
    if (this.phase !== 'playing' && this.phase !== 'ready') return;
    this.prevPhase = this.phase;
    this.phase = 'paused';
    this.releaseAll();
    audio.setDuck(0.25);
    this.cb.onPhase('paused');
  }

  resume() {
    if (this.phase !== 'paused') return;
    this.phase = this.prevPhase;
    audio.setDuck(1);
    this.last = performance.now();
    this.cb.onPhase('playing');
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
  }

  private releaseAll() {
    this.ctl.forEach((k, i) => {
      k.held = { left: false, right: false, down: false };
      k.moveDir = 0;
      if (this.boards[i]) this.boards[i].softDrop = false;
    });
  }

  /** Versus entre amis (2 à 4 joueurs locaux / bots). */
  get isParty(): boolean {
    return !!this.cfg.party && this.cfg.party.length >= 2;
  }

  /** Plateau contrôlé par un humain sur cet écran ? (sons, vibrations) */
  private isHuman(i: number): boolean {
    return this.isParty ? !!this.cfg.party![i]?.device : i === 0;
  }

  /** Cible des attaques : l'adversaire en vie qui mène au score (2 joueurs : l'autre). */
  private pickTarget(i: number): number {
    let best = -1;
    for (let j = 0; j < this.boards.length; j++) {
      if (j === i || this.boards[j].dead) continue;
      if (best < 0 || this.boards[j].score > this.boards[best].score) best = j;
    }
    return best;
  }

  /** Applique l'état d'un périphérique au joueur i (versus entre amis). */
  private applyDevice(i: number, r: DevRead) {
    const k = this.ctl[i];
    for (const d of ['left', 'right', 'down'] as const) {
      if (r[d] && !k.held[d]) this.press(d, i);
      else if (!r[d] && k.held[d]) this.release(d, i);
    }
    if (r.edges.has('rot')) this.press('rotCW', i);
    if (r.edges.has('rotCCW')) this.press('rotCCW', i);
    if (r.edges.has('drop')) this.press('drop', i);
    if (r.edges.has('skill')) this.press('skill', i);
  }

  // ------------------------------------------------------------ input
  press(a: Action, i = 0) {
    if (this.phase === 'paused' || this.phase === 'over') return;
    const p = this.boards[i];
    const k = this.ctl[i];
    if (!p || !k || p.dead) return;
    switch (a) {
      case 'left':
      case 'right': {
        k.held[a] = true;
        k.moveDir = a === 'left' ? -1 : 1;
        k.dasT = 0;
        k.arrT = 0;
        if (this.phase === 'playing') p.moveH(k.moveDir);
        break;
      }
      case 'down':
        k.held.down = true;
        break;
      case 'rotCW':
      case 'rotCCW':
        if (this.phase !== 'playing') break;
        if (!p.rotate(a === 'rotCW' ? 1 : -1) && p.state !== 'falling') k.rotBuf = { dir: a === 'rotCW' ? 1 : -1, t: 0.3 };
        break;
      case 'drop':
        if (this.phase === 'playing') p.hardDrop();
        break;
      case 'skill':
        if (this.phase === 'playing') p.requestSkill();
        break;
    }
  }

  release(a: Action, i = 0) {
    const k = this.ctl[i];
    if (!k) return;
    if (a === 'left' || a === 'right') {
      k.held[a] = false;
      if (k.moveDir === (a === 'left' ? -1 : 1)) {
        k.moveDir = k.held.left ? -1 : k.held.right ? 1 : 0;
        k.dasT = 0;
        k.arrT = 0;
      }
    } else if (a === 'down') {
      k.held.down = false;
    }
  }

  private bindEvents() {
    const keyMap: Record<string, Action> = {
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
      ArrowDown: 'down',
      KeyS: 'down',
      ArrowUp: 'rotCW',
      KeyW: 'rotCW',
      KeyX: 'rotCW',
      KeyZ: 'rotCCW',
      Space: 'drop',
      ShiftLeft: 'skill',
      ShiftRight: 'skill',
      KeyC: 'skill',
      KeyE: 'skill',
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement | null;
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (e.repeat) return;
        e.preventDefault();
        if (this.phase === 'paused') this.resume();
        else this.pause();
        return;
      }
      if (e.code === 'KeyR') {
        if (e.repeat) return;
        e.preventDefault();
        this.reset(true);
        return;
      }
      const a = this.isParty ? undefined : keyMap[e.code];
      if (a) {
        e.preventDefault();
        if (e.repeat) return;
        this.press(a);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (this.isParty) return;
      const a = keyMap[e.code];
      if (a) this.release(a);
    };
    const onBlur = () => {
      this.releaseAll();
      if (this.phase === 'playing') this.pause();
    };
    const onVis = () => {
      if (document.hidden) onBlur();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);
    this.cleanup.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVis);
    });

    // touch gestures on the canvas: tap = rotate, swipe down = slam
    const cv = this.canvas;
    cv.style.touchAction = 'none';
    const pd = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
    };
    const pu = (e: PointerEvent) => {
      const s = this.pointers.get(e.pointerId);
      if (!s) return;
      this.pointers.delete(e.pointerId);
      if (this.phase !== 'playing') return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      const dt = performance.now() - s.t;
      if (Math.hypot(dx, dy) < 14 && dt < 320) this.press('rotCW');
      else if (dy > 48 && dy > Math.abs(dx) * 1.4 && dt < 450) this.press('drop');
    };
    const pc = (e: PointerEvent) => this.pointers.delete(e.pointerId);
    cv.addEventListener('pointerdown', pd);
    cv.addEventListener('pointerup', pu);
    cv.addEventListener('pointercancel', pc);
    this.cleanup.push(() => {
      cv.removeEventListener('pointerdown', pd);
      cv.removeEventListener('pointerup', pu);
      cv.removeEventListener('pointercancel', pc);
    });

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(cv.parentElement || cv);
    this.resize();
  }

  // ------------------------------------------------------------ layout
  private resize() {
    const par = this.canvas.parentElement || this.canvas;
    const W = Math.max(100, Math.floor(par.clientWidth));
    const H = Math.max(100, Math.floor(par.clientHeight));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = W;
    this.H = H;
    this.canvas.width = Math.floor(W * this.dpr);
    this.canvas.height = Math.floor(H * this.dpr);
    this.computeLayout();
  }

  private computeLayout() {
    const W = this.W;
    const H = this.H;
    const n = this.boards.length;
    if (n > 2) {
      // 3 ou 4 joueurs : un plateau par joueur, côte à côte, chacun avec son panneau au-dessus
      const m = Math.max(6, Math.min(W, H) * 0.018);
      const unitW = 6.44 + 0.7; // plateau + espace
      const hs = 12 + 1.1 + 0.44 + 3.1; // plateau + bandeau + marges + panneau compact
      const c = Math.max(8, Math.floor(Math.min((W - 2 * m) / (n * unitW), (H - 2 * m) / hs)));
      const pad = 0.22 * c;
      const strip = 1.1 * c;
      const bvw = 6 * c + 2 * pad;
      const gap = 0.7 * c;
      const totalW = n * bvw + (n - 1) * gap;
      const x0 = (W - totalW) / 2;
      const ph = 3.1 * c;
      const y0 = (H - (12 * c + strip + 2 * pad + ph)) / 2 + ph;
      const L: Layout = { wide: true, c, views: [], panels: [], side: null, miniHdr: null, center: null, top: true };
      for (let i = 0; i < n; i++) {
        const bx = x0 + i * (bvw + gap);
        L.views.push({ bx: bx + pad, by: y0 + pad + strip, c });
        L.panels.push({ x: bx, y: y0 - ph, w: bvw });
      }
      this.L = L;
      return;
    }
    const vs = this.boards.length > 1;
    const m = Math.max(6, Math.min(W, H) * 0.018);
    const hs = 13.6;
    const cCompact = Math.floor(Math.min((W - 2 * m) / 10.0, (H - 2 * m) / hs));
    const wideUnits = vs ? 21.4 : 14.0;
    const cWide = Math.floor(Math.min((W - 2 * m) / wideUnits, (H - 2 * m) / hs));
    const wide = cWide >= cCompact * 0.97;
    const c = Math.max(8, wide ? cWide : cCompact);
    const pad = 0.22 * c;
    const strip = 1.1 * c;
    const bvw = 6 * c + 2 * pad;
    const bvh = 12 * c + strip + 2 * pad;
    const y0 = (H - bvh) / 2;
    const L: Layout = { wide, c, views: [], panels: [null, null], side: null, miniHdr: null, center: null };

    if (wide) {
      const pw = 3.4 * c;
      const gap = 0.3 * c;
      const cg = 1.0 * c;
      const totalW = vs ? 2 * (pw + gap + bvw) + cg : 2 * pw + 2 * gap + bvw;
      const x0 = (W - totalW) / 2;
      const pvl = x0 + pw + gap;
      L.views.push({ bx: pvl + pad, by: y0 + pad + strip, c });
      L.panels[0] = { x: x0, y: y0, w: pw };
      if (vs) {
        const ovl = pvl + bvw + cg;
        L.views.push({ bx: ovl + pad, by: y0 + pad + strip, c });
        L.panels[1] = { x: ovl + bvw + gap, y: y0, w: pw };
        L.center = { x: pvl + bvw + cg / 2, y: y0 + bvh / 2 };
      } else {
        L.side = { x: pvl + bvw + gap, y: y0, w: pw };
      }
    } else {
      const sw = 3.3 * c;
      const gap = 0.25 * c;
      const totalW = bvw + gap + sw;
      const x0 = (W - totalW) / 2;
      L.views.push({ bx: x0 + pad, by: y0 + pad + strip, c });
      const sx = x0 + bvw + gap;
      L.panels[0] = { x: sx, y: y0, w: sw };
      if (vs) {
        const cm = 0.48 * c;
        const mvw = 6 * cm + 2 * 0.22 * cm;
        const mx = sx + (sw - mvw) / 2;
        const hdrY = y0 + 5.15 * c;
        const vTop = y0 + 6.1 * c;
        L.views.push({ bx: mx + 0.22 * cm, by: vTop + 0.22 * cm + 1.1 * cm, c: cm });
        L.miniHdr = { x: sx, y: hdrY, w: sw, c };
      } else {
        L.side = { x: sx, y: y0 + 5.2 * c, w: sw };
      }
    }
    this.L = L;
  }

  // ------------------------------------------------------------ events / FX
  private cellPos(i: number, x: number, y: number) {
    const v = this.L.views[i];
    return { x: v.bx + (x + 0.5) * v.c, y: v.by + (y - HIDDEN + 0.5) * v.c };
  }

  private vibrate(ms: number) {
    if (!this.touch) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* ignore */
    }
  }

  private centroid(i: number, cells: Cell[]) {
    let sx = 0;
    let sy = 0;
    for (const c of cells) {
      const p = this.cellPos(i, c.x, c.y);
      sx += p.x;
      sy += p.y;
    }
    const n = Math.max(1, cells.length);
    return { x: sx / n, y: sy / n };
  }

  private onEvent(i: number, e: BoardEvent) {
    if (!this.L) return;
    const bd = this.boards[i] || null;
    const v = this.L.views[i];
    if (!v || !bd) return;
    const isP = this.isHuman(i);
    const fx = this.fx;
    const rgb = bd.hero.rgb;
    const scale = v.c / 48;
    const mid = { x: v.bx + 3 * v.c, y: v.by + 5 * v.c };

    switch (e.t) {
      case 'move':
        if (isP) audio.play('move');
        break;
      case 'rotate':
        if (isP) audio.play('rotate');
        break;
      case 'blocked':
        if (isP) audio.play('blocked');
        break;
      case 'harddrop': {
        if (isP) audio.play('harddrop');
        const x = v.bx + (e.x + 0.5) * v.c;
        for (let r = e.y0; r <= e.y1; r++) {
          const y = v.by + (r - HIDDEN + 0.5) * v.c;
          fx.burst(x + (Math.random() - 0.5) * v.c * 0.6, y, '255,255,255', 1, 20, 0.18, 0);
        }
        fx.shake(isP ? 3 : 1);
        break;
      }
      case 'lock':
        if (isP) {
          audio.play('lock');
          fx.shake(0.8);
        }
        break;
      case 'land':
        if (isP && e.strong) audio.play('land');
        break;
      case 'clearStart': {
        const cen = this.centroid(i, e.cells);
        this.lastCentroid[i] = cen;
        if (isP) audio.play('charge', e.chain);
        const cx = Math.max(v.bx + 1.3 * v.c, Math.min(v.bx + 4.7 * v.c, cen.x));
        if (e.chain >= 2) {
          const col = CHAIN_COLORS[Math.min(e.chain - 1, CHAIN_COLORS.length - 1)];
          fx.text(cx, cen.y, `${e.chain} ${t('chain')}!`, v.c * Math.min(1.5, 0.78 + e.chain * 0.1), col, 'rgba(30,8,70,0.95)', 1.2, -34);
          fx.ring(cen.x, cen.y, `${255},${220},${120}`, v.c * (2 + e.chain * 0.5), 0.55, 5 * scale + 2);
          fx.flash(rgb, 0.08 + Math.min(0.2, e.chain * 0.03));
          this.bgPulse = Math.min(1.4, this.bgPulse + e.chain * 0.18);
          if (e.chain >= 4) {
            const praise = e.chain >= 8 ? t('legendary') : e.chain >= 6 ? t('amazing') : t('great');
            fx.text(mid.x, v.by + 2.5 * v.c, praise, v.c * 0.8, '#ffe66b', 'rgba(60,10,70,0.95)', 1.5, -20);
          }
          if (isP) this.hitstop = Math.max(this.hitstop, Math.min(0.09, 0.025 * e.chain));
        }
        fx.text(cx, cen.y + v.c * (e.chain >= 2 ? 0.95 : 0), `+${formatNum(e.pts)}`, v.c * 0.46, '#ffffff', 'rgba(30,8,70,0.9)', 0.9, -26, false);
        if (!isP) audio.play('charge', e.chain);
        break;
      }
      case 'pop': {
        for (const c of e.cells) {
          const p = this.cellPos(i, c.x, c.y);
          const pal = PALETTE[c.c];
          fx.popBurst(p.x, p.y, pal ? pal.rgb : '200,205,235', c.c, scale * (0.8 + Math.min(1.2, e.chain * 0.12)));
        }
        fx.shake((1.5 + Math.min(12, e.chain * 2.2)) * (isP ? 1 : 0.55));
        audio.play('pop', e.chain);
        if (isP) this.vibrate(10 + e.chain * 8);
        break;
      }
      case 'offset': {
        audio.play('offset');
        const p = { x: v.bx + 3 * v.c, y: v.by - 0.5 * v.c };
        fx.text(p.x, p.y, `${t('blocked')} -${e.n}`, v.c * 0.55, '#7fe9ff', 'rgba(5,30,60,0.95)', 1.1, -22);
        fx.ring(p.x, p.y, '127,233,255', v.c * 2, 0.5, 3);
        break;
      }
      case 'attack': {
        const ti = this.pickTarget(i);
        const target = this.boards[ti];
        const tv = this.L.views[ti];
        if (!target || !tv) break;
        audio.play('attack');
        const from = this.lastCentroid[i];
        const to = { x: tv.bx + 3 * tv.c, y: tv.by - 0.5 * tv.c };
        const n = e.n;
        fx.shot(from.x, from.y, to.x, to.y, rgb, n, () => {
          if (target.dead) return;
          target.receiveGarbage(n);
          const tp = this.L.views[ti];
          if (!tp) return;
          fx.ring(tp.bx + 3 * tp.c, tp.by - 0.5 * tp.c, '255,120,150', tp.c * 2.2, 0.45, 4);
          fx.burst(tp.bx + 3 * tp.c, tp.by - 0.5 * tp.c, '255,160,180', 10, 200 * (tp.c / 48), 0.18, 2, 500);
          fx.shake(this.isHuman(ti) ? 5 : 2);
          audio.play('hurt');
          if (this.isHuman(ti)) this.vibrate(30);
        });
        break;
      }
      case 'garbageIn':
        break;
      case 'garbageDrop': {
        audio.play('garbageDrop');
        fx.shake((isP ? 4 : 2) + Math.min(10, e.n * 0.5));
        for (let k = 0; k < Math.min(14, e.n); k++) {
          fx.burst(v.bx + Math.random() * 6 * v.c, v.by + (Math.random() * 2 + 0.2) * v.c, '154,163,199', 1, 120 * scale, 0.2, 2, 300);
        }
        if (isP) this.vibrate(40);
        break;
      }
      case 'skill': {
        audio.play(`skill:${e.hero}`);
        fx.flash(rgb, 0.4);
        fx.shake(isP ? 11 : 6);
        this.bgPulse = 1.2;
        if (isP) this.vibrate(60);
        const hero = bd.hero;
        fx.text(mid.x, v.by + 3.2 * v.c, L(hero.active.name).toUpperCase(), v.c * 0.8, hero.light, 'rgba(30,8,70,0.95)', 1.4, -24);
        fx.ring(mid.x, v.by + 6 * v.c, rgb, v.c * 6, 0.7, 7);
        for (const c of e.cells) {
          const p = this.cellPos(i, c.x, c.y);
          if (e.hero === 'volt') {
            fx.bolt(p.x + (Math.random() - 0.5) * v.c, v.by - v.c * 1.2, p.x, p.y, '255,230,120', 2 + scale * 2, v.c * 0.45);
            fx.burst(p.x, p.y, '255,230,120', 4, 280 * scale, 0.2, 3);
          } else if (e.hero === 'ember') {
            fx.burst(p.x, p.y, '255,140,50', 5, 300 * scale, 0.22, 0);
            fx.burst(p.x, p.y, '255,220,90', 3, 260 * scale, 0.2, 3);
          } else if (e.hero === 'marina') {
            fx.ring(p.x, p.y, '140,225,255', v.c * 1.2, 0.5, 2.5);
            fx.burst(p.x, p.y, '170,235,255', 4, 200 * scale, 0.2, 1, -80);
          } else {
            fx.burst(p.x, p.y, '110,240,140', 5, 220 * scale, 0.2, 1, 200);
            fx.burst(p.x, p.y, '60,200,90', 3, 180 * scale, 0.16, 2, 400);
          }
        }
        break;
      }
      case 'fizzle':
        if (isP) {
          audio.play('fizzle');
          fx.text(mid.x, v.by + 9.5 * v.c, e.reason === 'energy' ? `${t('notReady')} ${Math.floor(bd.energy)}%` : t('noTarget'), v.c * 0.5, '#ff9fb2', 'rgba(40,5,30,0.95)', 0.9, -20, false);
        }
        break;
      case 'allclear':
        audio.play('allclear');
        fx.flash('255,225,120', 0.5);
        fx.shake(8);
        fx.text(mid.x, v.by + 5.5 * v.c, t('allClear'), v.c * 1.0, '#ffe66b', 'rgba(70,20,10,0.95)', 2, -10);
        for (let k = 0; k < 40; k++) fx.burst(v.bx + Math.random() * 6 * v.c, v.by + Math.random() * 12 * v.c, '255,225,120', 1, 160 * scale, 0.22, 1, 100);
        break;
      case 'dead': {
        for (let r = 0; r < 12; r++) {
          for (let x = 0; x < COLS; x++) {
            const col = PALETTE[1 + ((Math.random() * 5) | 0)];
            const p = { x: v.bx + (x + 0.5) * v.c, y: v.by + (r + 0.5) * v.c };
            if (Math.random() < 0.55) fx.burst(p.x, p.y, col.rgb, 1, 380 * scale, 0.2, 2, 900);
          }
        }
        fx.shake(18);
        fx.flash('255,70,110', 0.4);
        break;
      }
      default:
        break;
    }
  }

  // ------------------------------------------------------------ main loop
  private loop = (ts: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (!this.last) this.last = ts;
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    this.update(dt);
    this.render();
  };

  private update(dt: number) {
    this.time += dt;
    this.bgPulse *= Math.exp(-dt * 2.2);
    let reads: (DevRead | null)[] = [];
    if (this.isParty) {
      party.pollPads();
      reads = this.cfg.party!.map((pl) => (pl.device ? party.read(pl.device) : null));
      if (reads.some((r) => r?.edges.has('pause')) && this.phase !== 'ending' && this.phase !== 'over') {
        if (this.phase === 'paused') this.resume();
        else this.pause();
        return;
      }
    }
    if (this.phase === 'paused') return;
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }
    // smooth slow-mo release
    if (this.phase === 'ending' && this.endT > 0.9 && this.result?.reason === 'ko') this.timeScale = Math.min(1, this.timeScale + dt * 1.5);
    const sdt = dt * this.timeScale;
    this.fx.update(sdt);
    for (let i = 0; i < this.boards.length; i++) {
      const diff = this.boards[i].score - this.shown[i];
      this.shown[i] += Math.abs(diff) < 1 ? diff : diff * Math.min(1, dt * 9) + Math.sign(diff);
    }

    if (this.phase === 'ready') {
      const prev = this.readyT;
      this.readyT -= dt;
      this.boards.forEach((b) => b.update(sdt));
      if (this.readyBeep === 0 && prev > 0) {
        this.readyBeep = 1;
        audio.play('ready');
      }
      if (this.readyT <= 0) this.startPlay();
      return;
    }

    if (this.phase === 'playing') {
      this.elapsed += dt;
      this.hintT += dt;
      if (this.isParty) reads.forEach((r, i) => r && this.applyDevice(i, r));
      this.handleInput(sdt);
      this.modeLogic(dt);
      for (const ai of this.ais) ai?.update(sdt);
    }
    for (const b of this.boards) b.update(sdt);

    if (this.phase === 'playing' && this.isParty) {
      this.boards.forEach((b, i) => {
        if (b.dead && !this.outOrder.includes(i)) {
          this.outOrder.push(i);
          const v = this.L.views[i];
          if (v) this.fx.text(v.bx + 3 * v.c, v.by + 5 * v.c, t('ko'), v.c * 1.4, '#ff5f87', 'rgba(40,5,30,0.95)', 2, -6);
          audio.play('ko');
        }
      });
      const alive = this.boards.map((b, i) => i).filter((i) => !this.boards[i].dead);
      if (alive.length <= 1) this.beginPartyEnding(alive[0] ?? null);
    } else if (this.phase === 'playing') {
      const p = this.boards[0];
      const o = this.boards[1];
      if (p.dead) this.beginEnding(false, 'ko');
      else if (o && o.dead) this.beginEnding(true, 'ko');
      audio.intensity = Math.max(p.danger, 0);
      const ready = p.energy >= 100;
      if (ready && !this.wasReady) {
        audio.play('skillReady');
        const v = this.L.views[0];
        this.fx.text(v.bx + 3 * v.c, v.by + 9.8 * v.c, t('skillReady'), v.c * 0.62, p.hero.light, 'rgba(30,8,70,0.95)', 1.2, -16);
      }
      this.wasReady = ready;
    } else if (this.phase === 'ending') {
      this.endT += dt;
      if (this.endT >= this.endDur) this.finish();
    }

    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.08;
      const p = this.boards[0];
      this.cb.onHud({ energy: p.energy, ready: p.energy >= 100 });
    }
  }

  private startPlay() {
    this.phase = 'playing';
    this.boards.forEach((b) => b.start());
    audio.play('go');
    this.fx.flash('255,255,255', 0.18);
    this.fx.text(this.W / 2, this.H * 0.4, t('go'), Math.min(this.W, this.H) * 0.16, '#ffe66b', 'rgba(40,10,80,0.95)', 0.8, -10);
  }

  private handleInput(dt: number) {
    this.ctl.forEach((k, i) => {
      const p = this.boards[i];
      if (!p || this.ais[i] || p.dead) return;
      p.softDrop = k.held.down && !!p.piece && p.piece.age > 0.1;
      if (k.moveDir !== 0) {
        k.dasT += dt;
        if (k.dasT >= DAS) {
          k.arrT += dt;
          while (k.arrT >= ARR) {
            p.moveH(k.moveDir);
            k.arrT -= ARR;
          }
        }
      }
      if (k.rotBuf) {
        k.rotBuf.t -= dt;
        if (p.state === 'falling' && p.piece) {
          p.rotate(k.rotBuf.dir);
          k.rotBuf = null;
        } else if (k.rotBuf.t <= 0) k.rotBuf = null;
      }
    });
  }

  /** Fin d'un versus entre amis : il ne reste qu'un joueur (ou aucun). */
  private beginPartyEnding(winner: number | null) {
    if (this.phase !== 'playing') return;
    this.phase = 'ending';
    this.releaseAll();
    this.endT = 0;
    const order = [...(winner !== null ? [winner] : []), ...this.outOrder.slice().reverse()];
    for (let i = 0; i < this.boards.length; i++) if (!order.includes(i)) order.push(i);
    const standings: PartyStanding[] = order.map((i, k) => ({
      idx: i,
      name: this.cfg.party![i].name,
      hero: this.boards[i].hero.id,
      bot: !this.cfg.party![i].device,
      score: this.boards[i].score,
      maxChain: this.boards[i].maxChain,
      garbageSent: this.boards[i].garbageSent,
      place: k + 1,
    }));
    const w = winner !== null ? this.boards[winner] : null;
    this.result = {
      mode: this.cfg.mode,
      win: null,
      reason: 'ko',
      score: w ? w.score : 0,
      bonus: 0,
      time: this.elapsed,
      maxChain: w ? w.maxChain : 0,
      garbageSent: w ? w.garbageSent : 0,
      hero: w ? w.hero.id : this.cfg.hero,
      stars: 0,
      party: { winner, standings },
    };
    this.timeScale = 0.28;
    this.endDur = 2.2;
    audio.play('win');
    if (winner !== null) {
      const v = this.L.views[winner];
      if (v) this.fx.text(v.bx + 3 * v.c, v.by + 5 * v.c, t('victory'), v.c * 1.2, '#ffe66b', 'rgba(40,10,80,0.95)', 2.2, -6);
      this.fx.flash('255,230,140', 0.3);
    }
    audio.setDuck(0.35);
  }

  private modeLogic(dt: number) {
    const p = this.boards[0];
    const mode = this.cfg.mode;
    if (mode === 'score') {
      this.timeLeft -= dt;
      p.fallSpeed = Math.min(7, 2.2 + this.elapsed * 0.026);
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.beginEnding(null, 'time');
      }
    } else if (mode === 'survival') {
      p.fallSpeed = Math.min(6, 2.0 + this.elapsed * 0.014);
      this.rainT -= dt;
      if (this.rainT <= 0) {
        this.rainEvery = Math.max(6, 13 - this.elapsed / 22);
        this.rainT = this.rainEvery;
        this.rainAmt = Math.min(16, 4 + Math.floor(this.elapsed / 30));
        p.receiveGarbage(this.rainAmt);
        const v = this.L.views[0];
        this.fx.text(v.bx + 3 * v.c, v.by - 0.4 * v.c, `${t('incoming')} +${this.rainAmt}`, v.c * 0.55, '#ff8aa0', 'rgba(50,5,30,0.95)', 1.2, -20);
        audio.play('hurt');
        this.fx.shake(3);
      }
    } else {
      const sp = (this.stage ? this.stage.speed : 1) * (2.2 + Math.min(2.4, this.elapsed * 0.012));
      for (const b of this.boards) b.fallSpeed = sp;
    }
  }

  private beginEnding(win: boolean | null, reason: 'ko' | 'time') {
    if (this.phase !== 'playing') return;
    const p = this.boards[0];
    this.phase = 'ending';
    this.releaseAll();
    this.endT = 0;
    const mode = this.cfg.mode;
    let stars = 0;
    let bonus = 0;
    if (win && (mode === 'campaign' || mode === 'versus')) {
      stars = 1 + (p.maxChain >= 3 ? 1 : 0) + (p.maxChain >= 5 || this.elapsed < 90 ? 1 : 0);
      bonus = 5000 + Math.max(0, Math.floor(150 - this.elapsed)) * 50 + stars * 1000;
    }
    this.result = {
      mode,
      win,
      reason,
      score: p.score + bonus,
      bonus,
      time: this.elapsed,
      maxChain: p.maxChain,
      garbageSent: p.garbageSent,
      hero: p.hero.id,
      stage: this.cfg.stage,
      stars,
    };
    if (reason === 'ko') {
      this.timeScale = 0.28;
      this.endDur = 2.0;
      audio.play(win ? 'win' : 'ko');
      const loser = win ? 1 : 0;
      const v = this.L.views[loser];
      const label = mode === 'score' || mode === 'survival' ? t('topOut') : t('ko');
      if (v) this.fx.text(v.bx + 3 * v.c, v.by + 5 * v.c, label, v.c * 1.7, '#ff5f87', 'rgba(40,5,30,0.95)', 2.2, -6);
      if (win) this.fx.flash('255,230,140', 0.3);
    } else {
      audio.play('timeup');
      this.endDur = 1.5;
      this.fx.flash('255,255,255', 0.3);
      this.fx.text(this.W / 2, this.H * 0.4, t('timeUp'), Math.min(this.W, this.H) * 0.13, '#ffe66b', 'rgba(40,10,80,0.95)', 1.6, -6);
    }
    audio.setDuck(0.35);
  }

  private finish() {
    if (this.phase !== 'ending' || !this.result) return;
    this.phase = 'over';
    this.cb.onPhase('over');
    this.cb.onOver(this.result);
  }

  // ------------------------------------------------------------ render
  private render() {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    const dpr = this.dpr;
    const time = this.time;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(ctx, W, H, dpr, time, this.bgPulse);
    const Ly = this.L;
    if (!Ly) return;

    ctx.save();
    const sm = this.fx.shakeMag;
    if (sm > 0) ctx.translate((Math.random() - 0.5) * 2 * sm, (Math.random() - 0.5) * 2 * sm);

    const mood = (b: Board): Mood => (b.dead ? 'ko' : b.hurt > 0 ? 'hurt' : b.happy > 0 ? 'happy' : 'idle');
    const p = this.boards[0];
    const o = this.boards[1];

    // boards
    for (let i = 0; i < this.boards.length; i++) {
      const v = Ly.views[i];
      drawBoardView(ctx, this.boards[i], v.bx, v.by, v.c, { dpr, time, ghost: this.isHuman(i), mini: i > 0 && !Ly.wide });
    }

    // panels
    const c = Ly.c;
    if (Ly.top && this.isParty) {
      // 3-4 joueurs : panneau compact au-dessus de chaque plateau
      this.boards.forEach((b, i) => {
        const pn = Ly.panels[i];
        if (!pn) return;
        const pl = this.cfg.party![i];
        drawCompactPanel(ctx, { x: pn.x, y: pn.y, w: pn.w, c, bd: b, name: pl.name, badge: pl.device ? 'J' + (i + 1) : 'CPU', badgeColor: SLOT_COLORS[i % 4], time, dpr, shownScore: this.shown[i], mood: mood(b) });
      });
      this.fx.draw(ctx, Ly.c);
      ctx.restore();
      this.fx.drawFlash(ctx, W, H);
      if (this.phase === 'ready' || (this.phase === 'paused' && this.prevPhase === 'ready')) {
        const k = 1 + Math.sin(this.time * 10) * 0.04;
        outlineTxt(ctx, t('readyQ'), W / 2, H * 0.4, Math.min(W, H) * 0.12 * k, '#ffffff');
      }
      return;
    }
    const pp = Ly.panels[0]!;
    const pName = this.isParty ? this.cfg.party![0].name : this.cfg.mode === 'campaign' || this.cfg.mode === 'versus' ? t('you') : p.hero.name;
    const pBottom = drawPanel(ctx, { x: pp.x, y: pp.y, w: pp.w, c, bd: p, name: pName, time, dpr, shownScore: this.shown[0], mood: mood(p), showNext: true });
    if (o) {
      const op = Ly.panels[1];
      const oname = this.isParty ? this.cfg.party![1].name : this.stage ? this.stage.name : o.hero.name;
      if (op) {
        drawPanel(ctx, { x: op.x, y: op.y, w: op.w, c, bd: o, name: oname, time, dpr, shownScore: this.shown[1], mood: mood(o), showNext: true });
      } else if (Ly.miniHdr) {
        const h = Ly.miniHdr;
        const r = c * 0.36;
        drawHeroFace(ctx, o.hero, h.x + r + c * 0.1, h.y + r + c * 0.05, r, mood(o), time);
        txt(ctx, oname, h.x + r * 2 + c * 0.3, h.y + c * 0.3, c * 0.4, '#fff', 'left', h.w - r * 2 - c * 0.4);
        txt(ctx, formatNum(this.shown[1]), h.x + r * 2 + c * 0.3, h.y + c * 0.72, c * 0.34, 'rgba(255,255,255,0.65)', 'left', h.w - r * 2 - c * 0.4);
      }
      if (Ly.center) {
        const cx = Ly.center.x;
        outlineTxt(ctx, 'VS', cx, Ly.center.y - c * 0.5, c * 0.8, '#ffe66b');
        txt(ctx, fmtTime(this.elapsed), cx, Ly.center.y + c * 0.3, c * 0.42, 'rgba(255,255,255,0.75)', 'center', c * 1.1);
        if (this.stage) txt(ctx, `${t('stage')} ${this.stage.id}`, cx, Ly.center.y + c * 0.85, c * 0.3, 'rgba(255,255,255,0.5)', 'center', c * 1.2);
      }
    }
    // solo stats
    if (Ly.side) {
      const s = Ly.side;
      const y = Ly.wide ? s.y + c * 0.6 : s.y;
      const lines: StatLine[] = [];
      let bar: { label: string; v: number; rgb: string } | undefined;
      if (this.cfg.mode === 'score') {
        lines.push({ label: t('timeLeft'), value: fmtTime(this.timeLeft), color: this.timeLeft < 15 ? '#ff7a95' : '#fff' });
        lines.push({ label: t('level'), value: String(1 + Math.floor(this.elapsed / 20)) });
      } else {
        lines.push({ label: t('time'), value: fmtTime(this.elapsed) });
        bar = { label: `${t('rain')} +${Math.min(16, 4 + Math.floor(this.elapsed / 30))}`, v: 1 - this.rainT / Math.max(1, this.rainEvery), rgb: '255,110,140' };
      }
      lines.push({ label: t('best'), value: formatNum(Math.max(this.best, p.score)) });
      lines.push({ label: t('maxChain'), value: String(p.maxChain) });
      const fits = Ly.wide ? true : y + c * 4 < this.H;
      if (fits) {
        const sy = Ly.wide ? y : Math.max(y, pBottom + c * 0.1);
        drawStats(ctx, s.x, sy + c * 0.3, s.w, c, lines, bar);
      }
      if (Ly.wide && !this.touch) this.drawKeyHelp(ctx, s.x, s.y + c * 9.4, s.w, c);
    }

    this.fx.draw(ctx, Ly.c);
    ctx.restore();
    this.fx.drawFlash(ctx, W, H);

    // hint
    if (this.phase === 'playing' && gamesStarted <= 2 && this.hintT < 7 && !this.isParty) this.drawHint(ctx);

    // READY
    if (this.phase === 'ready' || (this.phase === 'paused' && this.prevPhase === 'ready')) {
      const k = 1 + Math.sin(this.time * 10) * 0.04;
      outlineTxt(ctx, t('readyQ'), W / 2, H * 0.4, Math.min(W, H) * 0.12 * k, '#ffffff');
    }
  }

  private drawKeyHelp(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, c: number) {
    const rows: [string, string][] = [
      ['← →', t('kMove')],
      ['↑ / Z', t('kRotate')],
      ['↓', t('kSoft')],
      ['Space', t('kSlam')],
      ['Shift', t('kSkill')],
      ['P', t('kPause')],
    ];
    rrect(ctx, x, y - c * 0.3, w, rows.length * c * 0.5 + c * 0.45, c * 0.25);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fill();
    rows.forEach((r, i) => {
      txt(ctx, r[0], x + c * 0.15, y + i * c * 0.5, c * 0.3, '#ffe66b', 'left', w * 0.4);
      txt(ctx, r[1], x + w * 0.42, y + i * c * 0.5, c * 0.3, 'rgba(255,255,255,0.7)', 'left', w * 0.56);
    });
  }

  private drawHint(ctx: CanvasRenderingContext2D) {
    const v = this.L.views[0];
    const c = v.c;
    const a = this.hintT < 5.5 ? Math.min(1, this.hintT / 0.4) : Math.max(0, 1 - (this.hintT - 5.5) / 1.5);
    const lines = this.touch ? [t('hT1'), t('hT2'), t('hT3')] : [t('hK1'), t('hK2'), t('hK3')];
    const br = boardRect(v.bx, v.by, c);
    const w = br.w * 0.92;
    const x = br.x + (br.w - w) / 2;
    const y = v.by + c * 3.3;
    ctx.save();
    ctx.globalAlpha = a * 0.8;
    rrect(ctx, x, y, w, c * 2.5, c * 0.3);
    ctx.fillStyle = 'rgba(12,6,40,0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    lines.forEach((l, i) => txt(ctx, l, x + w / 2, y + c * (0.55 + i * 0.7), c * 0.4, i === 0 ? '#ffe66b' : '#fff', 'center', w - c * 0.4));
    ctx.restore();
  }
}
