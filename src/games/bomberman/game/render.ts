import type { Game } from "./engine";
import { POWER_INFO, SLOT_COLORS, type Hero, type PowerKind } from "./heroes";
import { BOARD_H, BOARD_W, COLS, FUSE, HUD_H, ROWS, SIDE_W, T_BLOCK, T_FLOOR, T_WALL, TILE, VIEW_W, type Player } from "./types";
import type { Level } from "./levels";

const FONT = (size: number, w = 800) => `${w} ${size}px "Trebuchet MS","Segoe UI",system-ui,sans-serif`;

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
}

function mk(w: number, h: number, fn: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const c = cv.getContext("2d")!;
  fn(c);
  return cv;
}

function fmt(n: number) {
  return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/* ------------------------------------------------------------------ *
 *  Icônes de bonus (réutilisées par l'UI)
 * ------------------------------------------------------------------ */

export function drawPowerIcon(c: CanvasRenderingContext2D, kind: PowerKind, color: string) {
  c.fillStyle = color;
  c.strokeStyle = "#fff";
  c.lineWidth = 1.5;
  c.lineJoin = "round";
  switch (kind) {
    case "bomb":
      c.beginPath();
      c.arc(-1, 3, 7, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(3, -2);
      c.quadraticCurveTo(7, -7, 9, -9);
      c.stroke();
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(10, -10, 2, 0, 6.3);
      c.fill();
      break;
    case "flame":
      c.beginPath();
      c.moveTo(0, -11);
      c.bezierCurveTo(9, -3, 9, 6, 0, 10);
      c.bezierCurveTo(-9, 6, -9, -3, 0, -11);
      c.fill();
      c.stroke();
      c.fillStyle = "#fff3b0";
      c.beginPath();
      c.moveTo(0, -1);
      c.bezierCurveTo(4, 2, 4, 6, 0, 8);
      c.bezierCurveTo(-4, 6, -4, 2, 0, -1);
      c.fill();
      break;
    case "speed":
      c.beginPath();
      c.moveTo(3, -11);
      c.lineTo(-7, 2);
      c.lineTo(-1, 2);
      c.lineTo(-3, 11);
      c.lineTo(7, -3);
      c.lineTo(1, -3);
      c.closePath();
      c.fill();
      c.stroke();
      break;
    case "shield":
      c.beginPath();
      c.moveTo(0, -10);
      c.lineTo(8, -6);
      c.lineTo(7, 3);
      c.quadraticCurveTo(5, 8, 0, 11);
      c.quadraticCurveTo(-5, 8, -7, 3);
      c.lineTo(-8, -6);
      c.closePath();
      c.fill();
      c.stroke();
      break;
    case "kick":
      c.beginPath();
      c.moveTo(-6, -10);
      c.lineTo(2, -10);
      c.lineTo(2, -1);
      c.lineTo(9, 3);
      c.lineTo(9, 9);
      c.lineTo(-6, 9);
      c.closePath();
      c.fill();
      c.stroke();
      break;
    case "heart":
      c.beginPath();
      c.moveTo(0, 9);
      c.bezierCurveTo(-13, -1, -7, -10, 0, -4);
      c.bezierCurveTo(7, -10, 13, -1, 0, 9);
      c.fill();
      c.stroke();
      break;
  }
}

/* ------------------------------------------------------------------ *
 *  Personnage
 * ------------------------------------------------------------------ */

export interface HeroDrawOpts {
  facing: number;
  walkT: number;
  moving: boolean;
  t: number;
  frozen?: boolean;
  alpha?: number;
}

export function drawHero(c: CanvasRenderingContext2D, hero: Hero, cx: number, cy: number, size: number, o: HeroDrawOpts) {
  const s = size / TILE;
  c.save();
  c.translate(cx, cy);
  c.scale(s, s);
  if (o.alpha !== undefined) c.globalAlpha = o.alpha;
  const walk = o.moving ? Math.sin(o.walkT * 2) : 0;
  const bob = o.moving ? -Math.abs(Math.sin(o.walkT * 2)) * 3 : Math.sin(o.t * 2.5) * 0.9;
  const sq = o.moving ? 1 + Math.sin(o.walkT * 4) * 0.05 : 1 + Math.sin(o.t * 2.5) * 0.02;

  // ombre
  c.fillStyle = "rgba(0,0,0,0.38)";
  c.beginPath();
  c.ellipse(0, 18, 14 - bob * 0.6, 5, 0, 0, Math.PI * 2);
  c.fill();

  c.translate(0, 16 + bob);
  c.scale(1 / sq, sq);
  c.translate(0, -16);

  const fdx = o.facing === 1 ? 1 : o.facing === 3 ? -1 : 0;
  const fdy = o.facing === 2 ? 1 : o.facing === 0 ? -1 : 0;

  // pieds
  c.fillStyle = hero.dark;
  c.beginPath();
  c.ellipse(-7 + walk * 3, 15, 6, 4, 0, 0, Math.PI * 2);
  c.ellipse(7 - walk * 3, 15, 6, 4, 0, 0, Math.PI * 2);
  c.fill();

  // bras
  c.fillStyle = hero.dark;
  c.beginPath();
  c.arc(-14 - fdx * 1, 4 + walk * 2.5, 4.2, 0, Math.PI * 2);
  c.arc(14 - fdx * 1, 4 - walk * 2.5, 4.2, 0, Math.PI * 2);
  c.fill();

  // torse
  const bg = c.createLinearGradient(0, -2, 0, 16);
  bg.addColorStop(0, hero.color);
  bg.addColorStop(1, hero.dark);
  c.fillStyle = bg;
  rr(c, -11.5, -2, 23, 18, 8);
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.28)";
  rr(c, -6, 3, 12, 4, 2);
  c.fill();
  c.fillStyle = hero.accent;
  c.globalAlpha = (o.alpha ?? 1) * 0.85;
  c.beginPath();
  c.arc(0, 11, 2.4, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = o.alpha ?? 1;

  // accessoires (derrière la tête)
  drawAccessory(c, hero, o.t);

  // tête
  const hg = c.createRadialGradient(-4, -17, 2, 0, -9, 18);
  hg.addColorStop(0, "#ffffff");
  hg.addColorStop(0.18, hero.color);
  hg.addColorStop(1, hero.dark);
  c.fillStyle = hg;
  c.strokeStyle = "rgba(10,12,30,0.75)";
  c.lineWidth = 2;
  c.beginPath();
  c.arc(0, -9, 15, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // visière
  c.fillStyle = "#0d1228";
  const vx = fdx * 2;
  const vy = fdy * 1.5;
  rr(c, -11 + vx, -16 + vy, 22, 13, 6);
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.12)";
  rr(c, -9 + vx, -15 + vy, 18, 3, 2);
  c.fill();

  // yeux
  const blink = Math.sin(o.t * 0.9 + hero.name.length) > 0.985 ? 0.25 : 1;
  c.fillStyle = hero.accent;
  const ex = fdx * 2.6 + vx;
  const ey = fdy * 1.8 + vy;
  if (o.facing === 0) c.globalAlpha = (o.alpha ?? 1) * 0.35;
  c.beginPath();
  c.ellipse(-4.6 + ex, -9.5 + ey, 2.4, 3.4 * blink, 0, 0, Math.PI * 2);
  c.ellipse(4.6 + ex, -9.5 + ey, 2.4, 3.4 * blink, 0, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = o.alpha ?? 1;

  if (o.frozen) {
    c.fillStyle = "rgba(160,230,255,0.45)";
    rr(c, -17, -26, 34, 46, 10);
    c.fill();
    c.strokeStyle = "rgba(230,250,255,0.9)";
    c.lineWidth = 2;
    c.stroke();
  }
  c.restore();
}

function drawAccessory(c: CanvasRenderingContext2D, hero: Hero, t: number) {
  switch (hero.id) {
    case "ember": {
      const f = Math.sin(t * 9) * 1.5;
      c.fillStyle = "#ff9b2f";
      c.beginPath();
      c.moveTo(-7, -20);
      c.quadraticCurveTo(-9, -29 + f, -3, -33 + f);
      c.quadraticCurveTo(-2, -26, 0, -23);
      c.quadraticCurveTo(2, -31 - f, 7, -34 - f);
      c.quadraticCurveTo(10, -26, 7, -20);
      c.closePath();
      c.fill();
      c.fillStyle = "#ffe08a";
      c.beginPath();
      c.moveTo(-3, -21);
      c.quadraticCurveTo(0, -30, 3, -21);
      c.closePath();
      c.fill();
      break;
    }
    case "volt": {
      c.fillStyle = "#fff6b0";
      c.strokeStyle = "#7a5800";
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(2, -36);
      c.lineTo(-4, -28);
      c.lineTo(0, -28);
      c.lineTo(-3, -21);
      c.lineTo(5, -30);
      c.lineTo(1, -30);
      c.closePath();
      c.fill();
      c.stroke();
      break;
    }
    case "terra": {
      c.fillStyle = hero.accent;
      c.strokeStyle = hero.dark;
      c.lineWidth = 1.5;
      for (const sx of [-1, 1]) {
        c.beginPath();
        c.moveTo(sx * 8, -20);
        c.lineTo(sx * 13, -31);
        c.lineTo(sx * 15, -19);
        c.closePath();
        c.fill();
        c.stroke();
      }
      break;
    }
    case "frost": {
      c.fillStyle = "#e9fbff";
      c.strokeStyle = "#1b8fb8";
      c.lineWidth = 1.2;
      const pts: [number, number, number][] = [
        [0, -31, 6],
        [-8, -26, 4.5],
        [8, -26, 4.5],
      ];
      for (const [x, y, r] of pts) {
        c.beginPath();
        c.moveTo(x, y - r * 1.4);
        c.lineTo(x + r * 0.8, y);
        c.lineTo(x, y + r * 0.9);
        c.lineTo(x - r * 0.8, y);
        c.closePath();
        c.fill();
        c.stroke();
      }
      break;
    }
    case "shade": {
      c.fillStyle = hero.dark;
      c.strokeStyle = "#2a1260";
      c.lineWidth = 1.5;
      for (const sx of [-1, 1]) {
        c.beginPath();
        c.moveTo(sx * 5, -21);
        c.lineTo(sx * 12, -34);
        c.lineTo(sx * 15, -18);
        c.closePath();
        c.fill();
        c.stroke();
      }
      break;
    }
    case "nova": {
      c.strokeStyle = hero.dark;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, -22);
      c.lineTo(2, -30);
      c.stroke();
      const g = 3.6 + Math.sin(t * 6) * 0.6;
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(2, -32, g, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = hero.color;
      c.lineWidth = 1.5;
      c.stroke();
      break;
    }
  }
}

/* ------------------------------------------------------------------ *
 *  Renderer principal
 * ------------------------------------------------------------------ */

export class Renderer {
  private c: CanvasRenderingContext2D;
  private floors = new Map<string, HTMLCanvasElement>();
  /** Décor (sol + murs + caisses) mis en cache : redessiné seulement quand la grille change. */
  private terrain: HTMLCanvasElement | null = null;
  private terrainKey = "";
  /** HUD latéral mis en cache : redessiné seulement quand une valeur affichée change. */
  private side: HTMLCanvasElement | null = null;
  private sideKey = "";
  private wall: HTMLCanvasElement;
  private block: HTMLCanvasElement;
  private flameSpr: HTMLCanvasElement;
  private vignette: HTMLCanvasElement;
  private power: Record<string, HTMLCanvasElement> = {};
  private glows = new Map<string, HTMLCanvasElement>();

  constructor(private canvas: HTMLCanvasElement) {
    this.c = canvas.getContext("2d", { alpha: false })!;

    this.wall = mk(TILE, TILE + 6, (c) => {
      c.fillStyle = "#1b2140";
      rr(c, 0, 6, TILE, TILE, 7);
      c.fill();
      const g = c.createLinearGradient(0, 0, 0, TILE);
      g.addColorStop(0, "#66739f");
      g.addColorStop(1, "#3b4672");
      c.fillStyle = g;
      rr(c, 0, 0, TILE, TILE - 2, 7);
      c.fill();
      c.strokeStyle = "rgba(110,235,255,0.6)";
      c.lineWidth = 1.5;
      rr(c, 1.5, 1.5, TILE - 3, TILE - 5, 6);
      c.stroke();
      c.fillStyle = "#2b3459";
      rr(c, 8, 8, TILE - 16, TILE - 18, 4);
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.1)";
      c.lineWidth = 1;
      c.save();
      rr(c, 8, 8, TILE - 16, TILE - 18, 4);
      c.clip();
      for (let i = -TILE; i < TILE * 2; i += 7) {
        c.beginPath();
        c.moveTo(i, TILE);
        c.lineTo(i + TILE, 0);
        c.stroke();
      }
      c.restore();
      c.fillStyle = "rgba(110,235,255,0.85)";
      for (const [x, y] of [
        [5, 5],
        [TILE - 5, 5],
        [5, TILE - 7],
        [TILE - 5, TILE - 7],
      ]) {
        c.beginPath();
        c.arc(x, y, 1.6, 0, 6.3);
        c.fill();
      }
    });

    this.block = mk(TILE, TILE + 6, (c) => {
      c.fillStyle = "#6a3815";
      rr(c, 0, 6, TILE, TILE, 7);
      c.fill();
      const g = c.createLinearGradient(0, 0, 0, TILE);
      g.addColorStop(0, "#f0aa55");
      g.addColorStop(1, "#c4742c");
      c.fillStyle = g;
      rr(c, 0, 0, TILE, TILE - 2, 7);
      c.fill();
      c.strokeStyle = "#5c3315";
      c.lineWidth = 2;
      rr(c, 1, 1, TILE - 2, TILE - 4, 6);
      c.stroke();
      c.strokeStyle = "rgba(92,51,21,0.7)";
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(7, 7);
      c.lineTo(TILE - 7, TILE - 9);
      c.moveTo(TILE - 7, 7);
      c.lineTo(7, TILE - 9);
      c.stroke();
      c.strokeStyle = "rgba(92,51,21,0.55)";
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(4, 16);
      c.lineTo(TILE - 4, 16);
      c.moveTo(4, 29);
      c.lineTo(TILE - 4, 29);
      c.stroke();
      c.fillStyle = "rgba(255,255,255,0.35)";
      c.fillRect(6, 3, TILE - 12, 2);
      c.fillStyle = "#5c3315";
      for (const [x, y] of [
        [6, 6],
        [TILE - 6, 6],
        [6, TILE - 8],
        [TILE - 6, TILE - 8],
      ]) {
        c.beginPath();
        c.arc(x, y, 2, 0, 6.3);
        c.fill();
      }
    });

    this.flameSpr = mk(TILE, TILE, (c) => {
      const g = c.createRadialGradient(TILE / 2, TILE / 2, 2, TILE / 2, TILE / 2, TILE / 2);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.3, "#fff0a0");
      g.addColorStop(0.62, "#ff9a2a");
      g.addColorStop(1, "rgba(255,60,20,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, TILE, TILE);
    });

    this.vignette = mk(BOARD_W, BOARD_H, (c) => {
      const g = c.createRadialGradient(BOARD_W / 2, BOARD_H / 2, BOARD_H * 0.35, BOARD_W / 2, BOARD_H / 2, BOARD_H * 0.85);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(3,4,14,0.45)");
      c.fillStyle = g;
      c.fillRect(0, 0, BOARD_W, BOARD_H);
    });

    (Object.keys(POWER_INFO) as PowerKind[]).forEach((k) => {
      this.power[k] = mk(40, 40, (c) => {
        c.translate(20, 20);
        c.fillStyle = "#0f1530";
        c.strokeStyle = POWER_INFO[k].color;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(0, 0, 17, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.scale(0.9, 0.9);
        drawPowerIcon(c, k, POWER_INFO[k].color);
      });
    });
  }

  /** Sol + murs + caisses immobiles, reconstruit uniquement quand la grille change. */
  private terrainFor(g: Game): HTMLCanvasElement {
    let pops = 0;
    for (let i = 0; i < g.pop.length; i++) if (g.pop[i] > 0) pops++;
    const key = g.level.id + "|" + g.gridVersion + "|" + pops;
    if (this.terrain && key === this.terrainKey) return this.terrain;
    this.terrainKey = key;
    const cv = this.terrain ?? document.createElement("canvas");
    cv.width = BOARD_W;
    cv.height = BOARD_H;
    const c = cv.getContext("2d")!;
    c.clearRect(0, 0, BOARD_W, BOARD_H);
    c.drawImage(this.floorFor(g.level), 0, 0);
    for (let r = 0; r < ROWS; r++) {
      for (let x = 0; x < COLS; x++) {
        const i = r * COLS + x;
        const tile = g.grid[i];
        if (tile === T_FLOOR) {
          if (r > 0 && g.grid[i - COLS] !== T_FLOOR) {
            c.fillStyle = "rgba(0,0,0,0.3)";
            c.fillRect(x * TILE, r * TILE, TILE, 11);
          }
          continue;
        }
        if (g.pop[i] > 0) continue; // animé : dessiné à chaque image
        c.drawImage(tile === T_WALL ? this.wall : this.block, x * TILE, r * TILE - 6);
      }
    }
    // vignette intégrée au décor (évite un grand dégradé redessiné à chaque image)
    c.drawImage(this.vignette, 0, 0);
    this.terrain = cv;
    return cv;
  }

  /** HUD des coins (écran large), mis en cache tant que rien d'affiché ne change. */
  private sideLayer(g: Game, sc: number): HTMLCanvasElement {
    const L = g.layout;
    const parts: (string | number)[] = [L.vw, sc.toFixed(3), g.cfg.mode, g.stage, g.round, g.level.id, g.suddenStarted ? "sd" + (Math.floor(g.clock * 3) % 2) : Math.ceil(Math.max(0, g.suddenAt - g.time))];
    for (const p of g.players) {
      const frac = Math.max(0, Math.min(1, 1 - p.skillCd / p.hero.skill.cd));
      parts.push(p.id, p.corner, p.score, p.wins, p.lives, p.alive ? 1 : 0, p.maxBombs, p.range, p.speed, p.kills, p.blocks, Math.round(frac * 24), p.alive ? 0 : Math.ceil(p.respawnT));
    }
    const key = parts.join(",");
    if (this.side && key === this.sideKey) return this.side;
    this.sideKey = key;
    const cv = this.side ?? document.createElement("canvas");
    const w = Math.max(1, Math.round(L.vw * sc));
    const h = Math.max(1, Math.round(L.vh * sc));
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    const c = cv.getContext("2d")!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, w, h);
    c.setTransform(sc, 0, 0, sc, 0, 0);
    this.drawSideHud(c, g);
    this.side = cv;
    return cv;
  }

  /** Sol en damier aux couleurs du niveau (mis en cache). */
  private floorFor(lv: Level): HTMLCanvasElement {
    let f = this.floors.get(lv.id);
    if (!f) {
      f = mk(BOARD_W, BOARD_H, (c) => {
        for (let y = 0; y < ROWS; y++) {
          for (let x = 0; x < COLS; x++) {
            const a = (x + y) % 2 === 0;
            c.fillStyle = a ? lv.floorA : lv.floorB;
            c.fillRect(x * TILE, y * TILE, TILE, TILE);
            c.fillStyle = "rgba(120,170,255,0.045)";
            c.fillRect(x * TILE + 2, y * TILE + 2, TILE - 4, 2);
            c.fillStyle = "rgba(0,0,0,0.12)";
            c.fillRect(x * TILE, y * TILE + TILE - 2, TILE, 2);
            if (a) {
              c.fillStyle = "rgba(94,231,255,0.05)";
              c.beginPath();
              c.arc(x * TILE + TILE / 2, y * TILE + TILE / 2, 3, 0, 6.3);
              c.fill();
            }
          }
        }
      });
      this.floors.set(lv.id, f);
    }
    return f;
  }

  /** Portails des tunnels : ovale tourbillonnant sur le bord + flèche de sortie. */
  private drawPortals(c: CanvasRenderingContext2D, g: Game) {
    const col = g.level.portal;
    const t = g.clock;
    const one = (x: number, y: number, vertical: boolean, side: number) => {
      const cx = (x + 0.5) * TILE;
      const cy = (y + 0.5) * TILE;
      // sol du tunnel
      c.fillStyle = "rgba(5,6,20,0.55)";
      c.fillRect(x * TILE, y * TILE, TILE, TILE);
      c.save();
      c.globalCompositeOperation = "lighter";
      c.globalAlpha = 0.55 + 0.2 * Math.sin(t * 4 + x + y);
      c.drawImage(this.glow(col), cx - 40, cy - 40, 80, 80);
      c.globalAlpha = 1;
      c.translate(cx, cy);
      if (!vertical) c.rotate(Math.PI / 2);
      // anneaux concentriques qui tournent
      for (let k = 0; k < 3; k++) {
        const ph = (t * 1.6 + k / 3) % 1;
        c.strokeStyle = col;
        c.globalAlpha = 0.9 * (1 - ph);
        c.lineWidth = 3;
        c.beginPath();
        c.ellipse(0, 0, 8 + ph * 10, 18 + ph * 6, 0, 0, Math.PI * 2);
        c.stroke();
      }
      c.globalAlpha = 1;
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.ellipse(0, 0, 4, 12, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
      // flèche vers l'extérieur
      c.save();
      c.translate(cx, cy);
      c.rotate(vertical ? (side < 0 ? Math.PI : 0) : side < 0 ? -Math.PI / 2 : Math.PI / 2);
      c.fillStyle = col;
      c.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 3));
      const o = 15 + 3 * Math.sin(t * 5);
      c.beginPath();
      c.moveTo(-5, o);
      c.lineTo(5, o);
      c.lineTo(0, o + 6);
      c.closePath();
      c.fill();
      c.restore();
    };
    for (const r of g.level.portalRows) {
      one(0, r, true, -1);
      one(COLS - 1, r, true, 1);
    }
    for (const cIdx of g.level.portalCols) {
      one(cIdx, 0, false, -1);
      one(cIdx, ROWS - 1, false, 1);
    }
  }

  private glow(color: string): HTMLCanvasElement {
    let g = this.glows.get(color);
    if (!g) {
      g = mk(64, 64, (c) => {
        const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, color);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = gr;
        c.fillRect(0, 0, 64, 64);
      });
      this.glows.set(color, g);
    }
    return g;
  }

  draw(g: Game, _cssW: number, _cssH: number, _dpr: number) {
    void _cssW;
    void _cssH;
    void _dpr;
    const c = this.c;
    const cv = this.canvas;
    const L = g.layout;
    const sc = Math.min(cv.width / L.vw, cv.height / L.vh);
    c.setTransform(sc, 0, 0, sc, (cv.width - L.vw * sc) / 2, (cv.height - L.vh * sc) / 2);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";

    // fond (seulement sous le plateau : visible pendant les secousses)
    c.fillStyle = "#0b1022";
    c.fillRect(L.bx, L.by, BOARD_W, BOARD_H);

    if (L.wide) {
      // on ne recopie que les deux colonnes latérales du HUD en cache
      const side = this.sideLayer(g, sc);
      const k = side.width / L.vw;
      c.drawImage(side, 0, 0, SIDE_W * k, side.height, 0, 0, SIDE_W, L.vh);
      c.drawImage(side, (L.vw - SIDE_W) * k, 0, SIDE_W * k, side.height, L.vw - SIDE_W, 0, SIDE_W, L.vh);
    } else this.drawHud(c, g);

    c.save();
    c.translate(L.bx, L.by);
    c.beginPath();
    c.rect(0, 0, BOARD_W, BOARD_H);
    c.clip();
    const amp = g.shakeAmp;
    if (amp > 0.05) c.translate((Math.random() - 0.5) * 2 * amp, (Math.random() - 0.5) * 2 * amp);
    if (g.zoomPulse > 0) {
      const z = 1 + 0.014 * g.zoomPulse;
      c.translate(BOARD_W / 2, BOARD_H / 2);
      c.scale(z, z);
      c.translate(-BOARD_W / 2, -BOARD_H / 2);
    }

    c.drawImage(this.terrainFor(g), 0, 0);
    this.drawPortals(c, g);
    this.drawDanger(c, g);
    this.drawWorld(c, g);
    c.restore();


    if (g.flash > 0) {
      c.globalAlpha = Math.min(0.5, g.flash * 1.2);
      c.fillStyle = g.flashColor;
      c.fillRect(L.bx, L.by, BOARD_W, BOARD_H);
      c.globalAlpha = 1;
    }

    this.drawOverlays(c, g);
  }

  private drawDanger(c: CanvasRenderingContext2D, g: Game) {
    const dg = g.getDanger();
    const t = g.clock;
    for (let i = 0; i < dg.length; i++) {
      const d = dg[i];
      if (d === Infinity || d <= 0 || d > FUSE + 0.2 || g.grid[i] !== T_FLOOR) continue;
      const k = 1 - Math.min(1, d / FUSE);
      const pulse = 0.5 + 0.5 * Math.sin(t * (6 + k * 20));
      c.fillStyle = `rgba(255,70,90,${(0.07 + 0.2 * k * (0.5 + 0.5 * pulse)).toFixed(3)})`;
      const x = (i % COLS) * TILE;
      const y = Math.floor(i / COLS) * TILE;
      c.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    }
    // mort subite : avertissements
    for (const w of g.warnings) {
      const k = 1 - w.t / 0.8;
      c.fillStyle = `rgba(255,50,90,${(0.25 + 0.3 * Math.abs(Math.sin(g.clock * 18))).toFixed(3)})`;
      c.fillRect(w.x * TILE, w.y * TILE, TILE, TILE);
      c.strokeStyle = "rgba(255,200,210,0.9)";
      c.lineWidth = 2;
      c.strokeRect(w.x * TILE + 3, w.y * TILE + 3, TILE - 6, TILE - 6);
      // ombre qui tombe
      c.fillStyle = `rgba(20,24,50,${(0.3 + 0.5 * k).toFixed(3)})`;
      const sz = TILE * (1.6 - 0.6 * k);
      c.fillRect(w.x * TILE + TILE / 2 - sz / 2, w.y * TILE + TILE / 2 - sz / 2, sz, sz);
    }
  }

  private drawWorld(c: CanvasRenderingContext2D, g: Game) {
    const t = g.clock;
    for (let r = 0; r < ROWS; r++) {
      for (let x = 0; x < COLS; x++) {
        const i = r * COLS + x;
        const tile = g.grid[i];
        if (tile === T_FLOOR) continue;
        const spr = tile === T_WALL ? this.wall : this.block;
        const pop = g.pop[i];
        if (pop > 0) {
          const k = pop / 0.4;
          const s = 1 + 0.3 * Math.sin(Math.min(1, k) * Math.PI) + (tile === T_WALL ? 0.25 * k : 0);
          c.save();
          c.translate(x * TILE + TILE / 2, r * TILE + TILE / 2);
          c.scale(s, s);
          c.drawImage(spr, -TILE / 2, -TILE / 2 - 6);
          c.restore();
        }
      }

      for (const u of g.powerups) {
        if (Math.floor(u.y) !== r) continue;
        const sp = Math.min(1, u.t * 5);
        const sc = sp < 1 ? 0.3 + 0.9 * sp : 1 + 0.06 * Math.sin(t * 5 + u.x);
        const px = u.x * TILE;
        const py = u.y * TILE + Math.sin(t * 4 + u.x * 2) * 3;
        c.fillStyle = "rgba(0,0,0,0.3)";
        c.beginPath();
        c.ellipse(px, u.y * TILE + 14, 12, 4, 0, 0, 6.3);
        c.fill();
        c.save();
        c.globalCompositeOperation = "lighter";
        c.globalAlpha = 0.5;
        c.drawImage(this.glow(POWER_INFO[u.kind].color), px - 30, py - 30, 60, 60);
        c.restore();
        c.save();
        c.translate(px, py - 2);
        c.scale(sc, sc);
        c.drawImage(this.power[u.kind], -20, -20);
        c.restore();
      }

      for (const b of g.bombs) {
        if (Math.floor(b.fy) !== r) continue;
        this.drawBomb(c, b, t);
      }

      for (const p of g.players) {
        if (Math.floor(p.y) !== r) continue;
        this.drawPlayer(c, g, p, t);
        // En plein passage de tunnel : on dessine aussi le joueur qui ressort de l'autre côté.
        if (p.alive && p.x < 1) this.drawPlayer(c, g, { ...p, x: p.x + COLS }, t);
        else if (p.alive && p.x > COLS - 1) this.drawPlayer(c, g, { ...p, x: p.x - COLS }, t);
      }
    }
    for (const p of g.players) {
      if (p.alive && p.y < 1) this.drawPlayer(c, g, { ...p, y: p.y + ROWS }, t);
      else if (p.alive && p.y > ROWS - 1) this.drawPlayer(c, g, { ...p, y: p.y - ROWS }, t);
    }

    // flammes
    c.save();
    c.globalCompositeOperation = "lighter";
    for (const f of g.flames) {
      const k = f.t / f.max;
      const appear = Math.min(1, (1 - k) * 9 + 0.2);
      const fade = Math.min(1, k * 2.4);
      const px = (f.x + 0.5) * TILE;
      const py = (f.y + 0.5) * TILE;
      c.globalAlpha = 0.5 * fade;
      c.drawImage(this.glow("#ff8a2a"), px - 56 * appear, py - 56 * appear, 112 * appear, 112 * appear);
      const fl = 1 + 0.08 * Math.sin(t * 38 + f.seed);
      const sz = (TILE + 4) * appear * fl;
      c.globalAlpha = Math.min(1, fade * 1.3);
      c.drawImage(this.flameSpr, px - sz / 2, py - sz / 2, sz, sz);
    }
    c.restore();

    this.drawParticles(c, g);

    // textes flottants
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (const f of g.floaters) {
      const k = f.t / f.max;
      const a = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const sc = k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.4);
      c.globalAlpha = a;
      c.font = FONT(f.size * sc);
      c.lineWidth = 4;
      c.strokeStyle = "rgba(5,8,25,0.95)";
      c.strokeText(f.text, f.x, f.y);
      c.fillStyle = f.color;
      c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;
  }

  private drawBomb(c: CanvasRenderingContext2D, b: import("./types").Bomb, t: number) {
    const x = b.fx * TILE;
    const y = b.fy * TILE;
    const frac = Math.max(0, b.fuse / b.maxFuse);
    const rate = 8 + (1 - frac) * 26;
    const pulse = 1 + 0.09 * Math.sin(b.age * rate);
    const col = b.owner.hero.color;

    c.fillStyle = "rgba(0,0,0,0.35)";
    c.beginPath();
    c.ellipse(x, y + 16, 14, 5, 0, 0, 6.3);
    c.fill();

    c.save();
    c.globalCompositeOperation = "lighter";
    c.globalAlpha = 0.35 + 0.25 * (1 - frac);
    c.drawImage(this.glow(col), x - 30 * pulse, y - 28 * pulse, 60 * pulse, 60 * pulse);
    c.restore();

    c.save();
    c.translate(x, y + 3);
    c.scale(pulse, pulse);
    const g = c.createRadialGradient(-5, -6, 2, 0, 0, 17);
    g.addColorStop(0, "#5a6396");
    g.addColorStop(0.5, "#202544");
    g.addColorStop(1, "#080a18");
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, 15, 0, 6.3);
    c.fill();
    c.strokeStyle = col;
    c.lineWidth = 2.5;
    c.globalAlpha = 0.9;
    c.beginPath();
    c.arc(0, 0, 11, Math.PI * 0.15, Math.PI * 0.85);
    c.stroke();
    c.globalAlpha = 1;
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.beginPath();
    c.ellipse(-5.5, -6, 3.5, 2.2, -0.6, 0, 6.3);
    c.fill();
    if (frac < 0.22 && Math.floor(b.age * 16) % 2 === 0) {
      c.fillStyle = "rgba(255,255,255,0.65)";
      c.beginPath();
      c.arc(0, 0, 15, 0, 6.3);
      c.fill();
    }
    // mèche
    c.strokeStyle = "#8b6a3f";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(2, -13);
    c.quadraticCurveTo(7, -17, 10, -20);
    c.stroke();
    const sp = 2.5 + Math.sin(t * 40 + b.tx) * 1.2;
    c.fillStyle = "#fff4b0";
    c.beginPath();
    c.arc(10, -21, sp, 0, 6.3);
    c.fill();
    c.restore();
  }

  private drawPlayer(c: CanvasRenderingContext2D, g: Game, p: Player, t: number) {
    const px = p.x * TILE;
    const py = p.y * TILE - 2;
    if (!p.alive) {
      if (p.deathT > 0.75) return;
      const k = p.deathT / 0.75;
      c.save();
      c.translate(px, py);
      c.rotate(k * 9);
      c.scale(1 - k * 0.6, 1 - k * 0.6);
      drawHero(c, p.hero, 0, 0, 40, { facing: p.facing, walkT: 0, moving: false, t, alpha: 1 - k });
      c.restore();
      return;
    }
    let alpha = 1;
    if (p.invuln > 0 && !p.dash && Math.floor(p.invuln * 14) % 2 === 0) alpha = 0.35;
    if (p.dash) alpha = 0.8;

    if (p.dash) {
      for (let k = 1; k <= 3; k++) {
        drawHero(c, p.hero, px - p.dash.dx * k * 14, py - p.dash.dy * k * 14, 40, { facing: p.facing, walkT: p.walkT, moving: true, t, alpha: 0.18 / k });
      }
    }

    // anneau d'identité
    const slotCol = p.kind === "human" ? SLOT_COLORS[p.slot % 4] : "#9aa3c7";
    c.strokeStyle = slotCol;
    c.globalAlpha = 0.85;
    c.lineWidth = 2.5;
    c.beginPath();
    c.ellipse(px, py + 18, 15, 5.5, 0, 0, 6.3);
    c.stroke();
    c.globalAlpha = 1;

    drawHero(c, p.hero, px, py, 44, { facing: p.facing, walkT: p.walkT, moving: p.moving, t, frozen: p.frozen > 0, alpha });

    // bouclier
    if (p.shield) {
      c.save();
      c.globalCompositeOperation = "lighter";
      c.strokeStyle = "rgba(124,245,161,0.9)";
      c.fillStyle = "rgba(124,245,161,0.14)";
      c.lineWidth = 2.5;
      const r = 24 + Math.sin(t * 6) * 1.5;
      c.beginPath();
      c.arc(px, py - 2, r, 0, 6.3);
      c.fill();
      c.stroke();
      c.restore();
    }

    // étiquette
    const label = p.kind === "human" ? "J" + (p.slot + 1) : "CPU";
    c.font = FONT(11, 900);
    c.textAlign = "center";
    c.textBaseline = "middle";
    const w = c.measureText(label).width + 10;
    c.fillStyle = "rgba(8,10,28,0.85)";
    rr(c, px - w / 2, py - 46, w, 14, 7);
    c.fill();
    c.strokeStyle = slotCol;
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = slotCol;
    c.fillText(label, px, py - 39);
    if (p.frozen > 0) {
      c.fillStyle = "#bff3ff";
      c.fillText("❄", px, py - 56);
    }
    void g;
  }

  private drawParticles(c: CanvasRenderingContext2D, g: Game) {
    const parts = g.parts;
    // passe normale
    for (const p of parts) {
      const lf = p.life / p.max;
      if (p.type === 1) {
        c.globalAlpha = lf * 0.4;
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(p.x, p.y, p.size * (1 + (1 - lf) * 1.6), 0, 6.3);
        c.fill();
      } else if (p.type === 2) {
        c.globalAlpha = Math.min(1, lf * 2);
        c.fillStyle = p.color;
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        c.restore();
      }
    }
    c.save();
    c.globalCompositeOperation = "lighter";
    for (const p of parts) {
      const lf = p.life / p.max;
      switch (p.type) {
        case 0:
          c.globalAlpha = Math.min(1, lf * 1.6);
          c.fillStyle = p.color;
          c.fillRect(p.x - p.size * lf * 0.5, p.y - p.size * lf * 0.5, p.size * lf + 1, p.size * lf + 1);
          break;
        case 3: {
          const r = p.size * (1 - lf * lf);
          c.globalAlpha = lf;
          c.strokeStyle = p.color;
          c.lineWidth = 1 + 5 * lf;
          c.beginPath();
          c.arc(p.x, p.y, r, 0, 6.3);
          c.stroke();
          break;
        }
        case 4: {
          c.globalAlpha = Math.min(1, lf * 1.5);
          c.fillStyle = p.color;
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.rot);
          const s = p.size * (0.4 + lf);
          c.beginPath();
          c.moveTo(0, -s);
          c.lineTo(s * 0.3, -s * 0.3);
          c.lineTo(s, 0);
          c.lineTo(s * 0.3, s * 0.3);
          c.lineTo(0, s);
          c.lineTo(-s * 0.3, s * 0.3);
          c.lineTo(-s, 0);
          c.lineTo(-s * 0.3, -s * 0.3);
          c.closePath();
          c.fill();
          c.restore();
          break;
        }
        case 5:
          c.globalAlpha = lf * 0.55;
          c.fillStyle = p.color;
          c.beginPath();
          c.arc(p.x, p.y, 8 * lf + 2, 0, 6.3);
          c.fill();
          break;
      }
    }
    c.restore();
    c.globalAlpha = 1;
  }

  /* ---------------------------- HUD ---------------------------- */

  private drawHud(c: CanvasRenderingContext2D, g: Game) {
    const grad = c.createLinearGradient(0, 0, 0, HUD_H);
    grad.addColorStop(0, "#151c3a");
    grad.addColorStop(1, "#0d1330");
    c.fillStyle = grad;
    c.fillRect(0, 0, VIEW_W, HUD_H);
    c.fillStyle = "rgba(94,231,255,0.35)";
    c.fillRect(0, HUD_H - 2, VIEW_W, 2);

    // gauche : coins gauches, droite : coins droits (même logique que les points d'apparition)
    const xs = [0, 400, 160, 560];
    for (const p of g.players) this.drawCard(c, g, p, xs[p.corner % 4] + 3, 5);

    // minuteur central
    c.textAlign = "center";
    c.textBaseline = "middle";
    const label = g.cfg.mode === "solo" ? "ÉTAPE " + g.stage : "MANCHE " + g.round;
    c.font = FONT(11, 800);
    c.fillStyle = "#8fa0d8";
    c.fillText(label, 360, 15);
    if (g.suddenStarted) {
      const blink = Math.floor(g.clock * 3) % 2 === 0;
      c.font = FONT(15, 900);
      c.fillStyle = blink ? "#ff4d6d" : "#ffb3c0";
      c.fillText("MORT", 360, 35);
      c.fillText("SUBITE", 360, 51);
    } else {
      const rem = Math.max(0, g.suddenAt - g.time);
      const m = Math.floor(rem / 60);
      const s = Math.floor(rem % 60);
      c.font = FONT(26, 900);
      c.fillStyle = rem < 15 ? "#ffb347" : "#ffffff";
      c.fillText(m + ":" + (s < 10 ? "0" : "") + s, 360, 38);
    }
  }

  /**
   * HUD « écran large » : chaque joueur a sa carte dans le coin de l'écran
   * qui correspond à son coin de départ sur le plateau.
   */
  private drawSideHud(c: CanvasRenderingContext2D, g: Game) {
    const L = g.layout;
    const vh = L.vh;
    for (const x0 of [0, L.vw - SIDE_W]) {
      const gr = c.createLinearGradient(x0, 0, x0 + SIDE_W, 0);
      const left = x0 === 0;
      gr.addColorStop(left ? 0 : 1, "#0d1330");
      gr.addColorStop(left ? 1 : 0, "#121a3a");
      c.fillStyle = gr;
      c.fillRect(x0, 0, SIDE_W, vh);
      c.fillStyle = "rgba(94,231,255,0.3)";
      c.fillRect(left ? SIDE_W - 2 : x0, 0, 2, vh);
    }

    const CW = SIDE_W - 20;
    const CH = 214;
    const pos = (corner: number): [number, number] => {
      const right = corner === 1 || corner === 3;
      const bottom = corner >= 2;
      return [right ? L.vw - SIDE_W + 10 : 10, bottom ? vh - CH - 10 : 10];
    };
    const used = new Set<number>();
    for (const p of g.players) {
      used.add(p.corner % 4);
      const [x, y] = pos(p.corner % 4);
      this.drawCornerCard(c, g, p, x, y, CW, CH, p.corner % 4);
    }
    for (let k = 0; k < 4; k++) {
      if (used.has(k)) continue;
      const [x, y] = pos(k);
      c.strokeStyle = "rgba(255,255,255,0.08)";
      c.setLineDash([6, 6]);
      c.lineWidth = 2;
      rr(c, x, y, CW, CH, 14);
      c.stroke();
      c.setLineDash([]);
      c.font = FONT(12, 800);
      c.fillStyle = "rgba(143,160,216,0.45)";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("Emplacement libre", x + CW / 2, y + CH / 2);
    }

    // Colonne gauche, milieu : manche + minuteur
    const midY = vh / 2;
    const lx = SIDE_W / 2;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = FONT(13, 900);
    c.fillStyle = "#8fa0d8";
    c.fillText(g.cfg.mode === "solo" ? "ÉTAPE " + g.stage : "MANCHE " + g.round, lx, midY - 42);
    if (g.suddenStarted) {
      const blink = Math.floor(g.clock * 3) % 2 === 0;
      c.font = FONT(24, 900);
      c.fillStyle = blink ? "#ff4d6d" : "#ffb3c0";
      c.fillText("MORT", lx, midY - 8);
      c.fillText("SUBITE", lx, midY + 20);
    } else {
      const rem = Math.max(0, g.suddenAt - g.time);
      const m = Math.floor(rem / 60);
      const sec = Math.floor(rem % 60);
      c.font = FONT(44, 900);
      c.lineWidth = 6;
      c.strokeStyle = "rgba(5,8,25,0.9)";
      const txt = m + ":" + (sec < 10 ? "0" : "") + sec;
      c.strokeText(txt, lx, midY + 4);
      c.fillStyle = rem < 15 ? "#ffb347" : "#ffffff";
      c.fillText(txt, lx, midY + 4);
      c.font = FONT(10, 800);
      c.fillStyle = "#8fa0d8";
      c.fillText("avant la mort subite", lx, midY + 36);
    }

    // Colonne droite, milieu : arène + objectif
    const rx = L.vw - SIDE_W / 2;
    c.font = FONT(11, 900);
    c.fillStyle = "#8fa0d8";
    c.fillText("ARÈNE", rx, midY - 42);
    c.font = FONT(18, 900);
    c.fillStyle = g.level.portal;
    const nm = g.level.name.toUpperCase();
    c.fillText(nm.length > 16 ? nm.slice(0, 15) + "…" : nm, rx, midY - 18);
    const tunnels = g.level.portalRows.length + g.level.portalCols.length;
    c.font = FONT(11, 800);
    c.fillStyle = "#c9d3ff";
    c.fillText(tunnels ? "◀ " + tunnels + " tunnel" + (tunnels > 1 ? "s" : "") + " ▶" : "Sans tunnel", rx, midY + 6);
    c.fillStyle = "#8fa0d8";
    c.fillText(g.cfg.mode === "solo" ? "Survis et nettoie l'arène" : "Premier à 2 manches", rx, midY + 28);
  }

  private drawCornerCard(c: CanvasRenderingContext2D, g: Game, p: Player, x: number, y: number, w: number, h: number, corner: number) {
    const dead = !p.alive;
    const out = !p.alive && p.lives <= 0;
    const col = p.kind === "human" ? SLOT_COLORS[p.slot % 4] : "#56608c";
    const t = g.clock;
    c.save();
    c.globalAlpha = out ? 0.45 : 1;

    // carte
    const bg = c.createLinearGradient(0, y, 0, y + h);
    bg.addColorStop(0, "rgba(27,37,80,0.95)");
    bg.addColorStop(1, "rgba(17,24,54,0.95)");
    c.fillStyle = bg;
    rr(c, x, y, w, h, 14);
    c.fill();
    c.strokeStyle = p.hero.color;
    c.lineWidth = 3;
    rr(c, x, y, w, h, 14);
    c.stroke();
    // reflet de la couleur du héros
    c.save();
    rr(c, x, y, w, h, 14);
    c.clip();
    c.globalAlpha *= 0.18;
    c.drawImage(this.glow(p.hero.color), x + w / 2 - 110, y - 40, 220, 220);
    c.restore();

    // coin « équerre » qui pointe vers le coin de départ sur le plateau
    const right = corner === 1 || corner === 3;
    const bottom = corner >= 2;
    const ex = right ? x : x + w;
    const ey = bottom ? y + h : y;
    c.strokeStyle = p.hero.color;
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(ex + (right ? 18 : -18), ey);
    c.lineTo(ex, ey);
    c.lineTo(ex, ey + (bottom ? -18 : 18));
    c.stroke();

    // étiquette joueur
    const label = p.kind === "human" ? "J" + (p.slot + 1) : "CPU";
    c.font = FONT(12, 900);
    c.textBaseline = "middle";
    c.textAlign = "left";
    const lw = c.measureText(label).width + 14;
    c.fillStyle = col;
    rr(c, x + 10, y + 10, lw, 20, 10);
    c.fill();
    c.fillStyle = "#0b1022";
    c.fillText(label, x + 17, y + 20.5);
    c.font = FONT(13, 800);
    c.fillStyle = "#e8ecff";
    const nm = p.kind === "human" ? p.name : p.hero.name;
    c.fillText(nm.length > 11 ? nm.slice(0, 10) + "…" : nm, x + 16 + lw, y + 20.5);

    // manches gagnées / vies
    c.textAlign = "right";
    if (g.cfg.mode === "solo" && p.kind === "human") {
      c.font = FONT(14, 900);
      c.fillStyle = "#ff6b9d";
      c.fillText("♥ " + Math.max(0, p.lives), x + w - 10, y + 20.5);
    } else if (g.cfg.mode === "versus") {
      for (let k = 0; k < 2; k++) {
        c.beginPath();
        c.arc(x + w - 14 - k * 16, y + 20.5, 6, 0, 6.3);
        c.fillStyle = k < p.wins ? "#ffe066" : "rgba(255,255,255,0.15)";
        c.fill();
      }
    }

    // portrait
    drawHero(c, p.hero, x + 46, y + 78, 62, { facing: 2, walkT: 0, moving: false, t: 0.4, alpha: dead ? 0.5 : 1 });
    c.textAlign = "left";
    c.font = FONT(11, 900);
    c.fillStyle = p.hero.color;
    c.fillText(p.hero.name.toUpperCase(), x + 88, y + 54);

    // score (gros)
    c.font = FONT(30, 900);
    c.lineWidth = 5;
    c.strokeStyle = "rgba(5,8,25,0.9)";
    c.strokeText(fmt(p.score), x + 86, y + 84);
    c.fillStyle = "#ffffff";
    c.fillText(fmt(p.score), x + 86, y + 84);
    c.font = FONT(10, 800);
    c.fillStyle = "#8fa0d8";
    c.fillText("POINTS", x + 88, y + 106);

    // stats
    const sy = y + 132;
    c.font = FONT(14, 900);
    c.fillStyle = "#e6ebff";
    c.drawImage(this.power.bomb, x + 12, sy - 11, 22, 22);
    c.fillText(String(p.maxBombs), x + 38, sy);
    c.drawImage(this.power.flame, x + 62, sy - 11, 22, 22);
    c.fillText(String(p.range), x + 88, sy);
    c.drawImage(this.power.speed, x + 112, sy - 11, 22, 22);
    c.fillText((p.speed / 4.4).toFixed(1), x + 138, sy);

    // compétence
    const cdMax = p.hero.skill.cd;
    const frac = Math.max(0, Math.min(1, 1 - p.skillCd / cdMax));
    const ready = frac >= 1;
    c.font = FONT(11, 900);
    c.fillStyle = ready ? p.hero.accent : "#8fa0d8";
    c.fillText((ready ? "★ " : "") + p.hero.skill.name.toUpperCase() + (ready ? " PRÊT" : ""), x + 12, y + 162);
    c.fillStyle = "rgba(0,0,0,0.45)";
    rr(c, x + 12, y + 172, w - 24, 10, 5);
    c.fill();
    c.fillStyle = ready ? p.hero.accent : p.hero.color;
    if (frac > 0.02) {
      rr(c, x + 12, y + 172, (w - 24) * frac, 10, 5);
      c.fill();
    }
    if (ready && p.alive) {
      // compétence prête : liseré blanc fixe (pas d'animation → HUD mis en cache)
      c.strokeStyle = "#ffffff";
      c.lineWidth = 2;
      rr(c, x + 11, y + 171, w - 22, 12, 6);
      c.stroke();
    }

    // statut
    c.font = FONT(11, 800);
    c.fillStyle = "#8fa0d8";
    c.fillText("KO " + p.kills + "   ·   caisses " + p.blocks, x + 12, y + 198);

    if (dead) {
      c.globalAlpha = 1;
      c.save();
      c.translate(x + w / 2, y + 92);
      c.rotate(-0.18);
      c.font = FONT(22, 900);
      c.textAlign = "center";
      c.lineWidth = 5;
      c.strokeStyle = "rgba(5,8,25,0.95)";
      const txt = p.respawnT > 0 ? "RETOUR " + Math.ceil(p.respawnT) : "ÉLIMINÉ";
      c.strokeText(txt, 0, 0);
      c.fillStyle = "#ff4d6d";
      c.fillText(txt, 0, 0);
      c.restore();
    }
    c.restore();
  }

  private drawCard(c: CanvasRenderingContext2D, g: Game, p: Player, x: number, y: number) {
    const w = 154;
    const h = 54;
    const dead = !p.alive && p.lives <= 0;
    const col = p.kind === "human" ? SLOT_COLORS[p.slot % 4] : "#56608c";
    c.globalAlpha = dead ? 0.4 : 1;
    c.fillStyle = "rgba(255,255,255,0.06)";
    rr(c, x, y, w, h, 10);
    c.fill();
    c.strokeStyle = col;
    c.lineWidth = 2;
    rr(c, x, y, w, h, 10);
    c.stroke();

    drawHero(c, p.hero, x + 24, y + 34, 38, { facing: 2, walkT: 0, moving: false, t: g.clock + p.id, alpha: dead ? 0.6 : 1 });

    c.textAlign = "left";
    c.textBaseline = "middle";
    c.font = FONT(11, 800);
    c.fillStyle = "#c9d3ff";
    const nm = (p.kind === "human" ? p.name : p.hero.name) + (p.kind === "bot" ? " · CPU" : "");
    c.fillText(nm.length > 16 ? nm.slice(0, 15) + "…" : nm, x + 48, y + 13);

    c.font = FONT(17, 900);
    c.fillStyle = p.hero.color;
    c.fillText(fmt(p.score), x + 48, y + 30);

    // vies / victoires
    c.textAlign = "right";
    if (g.cfg.mode === "solo" && p.kind === "human") {
      c.font = FONT(12, 900);
      c.fillStyle = "#ff6b9d";
      c.fillText("♥ " + Math.max(0, p.lives), x + w - 8, y + 13);
    } else if (g.cfg.mode === "versus") {
      for (let k = 0; k < 2; k++) {
        c.beginPath();
        c.arc(x + w - 12 - k * 13, y + 13, 4.5, 0, 6.3);
        c.fillStyle = k < p.wins ? "#ffe066" : "rgba(255,255,255,0.15)";
        c.fill();
      }
    }

    // stats
    if (p.alive || !dead) {
      c.font = FONT(10, 800);
      c.fillStyle = "#e6ebff";
      c.textAlign = "left";
      c.drawImage(this.power.bomb, x + 98, y + 22, 14, 14);
      c.fillText(String(p.maxBombs), x + 113, y + 30);
      c.drawImage(this.power.flame, x + 124, y + 22, 14, 14);
      c.fillText(String(p.range), x + 139, y + 30);
    }

    // jauge de compétence
    const cdMax = p.hero.skill.cd;
    const frac = Math.max(0, Math.min(1, 1 - p.skillCd / cdMax));
    c.fillStyle = "rgba(0,0,0,0.45)";
    rr(c, x + 48, y + 41, w - 58, 7, 3.5);
    c.fill();
    const ready = frac >= 1;
    c.fillStyle = ready ? p.hero.accent : p.hero.color;
    if (frac > 0.02) {
      rr(c, x + 48, y + 41, (w - 58) * frac, 7, 3.5);
      c.fill();
    }
    if (ready && p.alive) {
      c.globalAlpha = (dead ? 0.4 : 1) * (0.25 + 0.25 * Math.sin(g.clock * 8));
      c.fillStyle = "#fff";
      rr(c, x + 48, y + 41, w - 58, 7, 3.5);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  /* ------------------------- Overlays ------------------------- */

  private drawOverlays(c: CanvasRenderingContext2D, g: Game) {
    c.textAlign = "center";
    c.textBaseline = "middle";
    const L = g.layout;
    const cx = L.bx + BOARD_W / 2;
    const cy = L.by + BOARD_H / 2;

    if (g.state === "countdown") {
      const go = g.stateT >= 0.9;
      const k = go ? (g.stateT - 0.9) / 0.6 : g.stateT / 0.9;
      const label = go ? "GO !" : "PRÊT ?";
      const sc = go ? 1 + (1 - k) * 0.9 : 0.7 + Math.min(1, k * 4) * 0.35;
      c.save();
      c.translate(cx, cy);
      c.scale(sc, sc);
      c.globalAlpha = go ? Math.max(0, 1 - k * 1.2) : 1;
      c.font = FONT(go ? 96 : 64, 900);
      c.lineWidth = 10;
      c.strokeStyle = "rgba(6,8,26,0.9)";
      c.strokeText(label, 0, 0);
      c.fillStyle = go ? "#7cf5a1" : "#ffe066";
      c.fillText(label, 0, 0);
      c.restore();
      c.globalAlpha = Math.max(0, 1 - (go ? k * 2 : 0));
      c.font = FONT(22, 800);
      c.fillStyle = "#c9d3ff";
      c.fillText(g.cfg.mode === "solo" ? "ÉTAPE " + g.stage : "MANCHE " + g.round, cx, cy - 78);
      c.font = FONT(18, 900);
      c.fillStyle = g.level.portal;
      c.fillText("ARÈNE : " + g.level.name.toUpperCase(), cx, cy + 72);
      if (g.level.portalRows.length || g.level.portalCols.length) {
        c.font = FONT(13, 700);
        c.fillStyle = "#c9d3ff";
        c.fillText("Les tunnels relient les bords — les explosions aussi !", cx, cy + 96);
      }
      c.globalAlpha = 1;
    }

    let showBanner = false;
    let slide = 1;
    if (g.state === "banner" && g.banner) {
      showBanner = true;
      slide = Math.min(1, g.stateT / 0.3);
      if (g.stateT > g.bannerDur - 0.3) slide = Math.max(0, (g.bannerDur - g.stateT) / 0.3);
    } else if (g.state === "playing" && g.banner && g.clock < g.bannerShowUntil) {
      showBanner = true;
      const left = g.bannerShowUntil - g.clock;
      slide = Math.min(1, left / 0.3, (2.2 - left) / 0.25);
      slide = Math.max(0, slide);
    }
    if (showBanner && g.banner) {
      const bh = 120 * slide;
      c.fillStyle = "rgba(6,8,26,0.82)";
      c.fillRect(L.bx, cy - bh / 2, BOARD_W, bh);
      c.fillStyle = g.banner.color;
      c.fillRect(L.bx, cy - bh / 2, BOARD_W, 3);
      c.fillRect(L.bx, cy + bh / 2 - 3, BOARD_W, 3);
      if (slide > 0.6) {
        c.globalAlpha = (slide - 0.6) / 0.4;
        c.font = FONT(40, 900);
        c.lineWidth = 7;
        c.strokeStyle = "rgba(6,8,26,0.9)";
        c.strokeText(g.banner.title, cx, cy - 14);
        c.fillStyle = g.banner.color;
        c.fillText(g.banner.title, cx, cy - 14);
        c.font = FONT(18, 700);
        c.fillStyle = "#dfe6ff";
        c.fillText(g.banner.sub, cx, cy + 26);
        c.globalAlpha = 1;
      }
    }

    if (g.showHint && g.cfg.mode === "solo" && g.stage === 1 && g.matchTime < 10 && g.state !== "over" && g.players[0]) {
      const a = Math.max(0, Math.min(1, (10 - g.matchTime) / 1.5));
      const skill = g.players[0].hero.skill.name;
      const txt = "Bouger : ZQSD / ↑←↓→     Bombe : ESPACE     " + skill + " : E";
      const hy = L.by + BOARD_H - 26;
      c.globalAlpha = a;
      c.font = FONT(14, 800);
      const tw = Math.min(BOARD_W - 20, c.measureText(txt).width + 36);
      c.fillStyle = "rgba(6,8,26,0.85)";
      rr(c, cx - tw / 2, hy - 16, tw, 32, 16);
      c.fill();
      c.strokeStyle = "rgba(94,231,255,0.6)";
      c.lineWidth = 1.5;
      c.stroke();
      c.fillStyle = "#e8ecff";
      c.fillText(txt, cx, hy);
      c.globalAlpha = 1;
    }

    if (g.state === "over") {
      c.fillStyle = "rgba(6,8,26,0.45)";
      c.fillRect(L.bx, L.by, BOARD_W, BOARD_H);
    }
    c.globalAlpha = 1;
    void T_BLOCK;
  }
}
