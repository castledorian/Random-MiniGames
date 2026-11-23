import type { Game } from "./game";
import { ENEMY_COLORS } from "./heroes";
import { H, W } from "./levels";
import { pointInSolid, supportAt } from "./physics";
import type { Enemy, Player } from "./types";

export const FONT_TITLE = '"Bungee", "Impact", "Arial Black", sans-serif';
export const FONT_UI = '"Chakra Petch", "Segoe UI", system-ui, sans-serif';

// ------------------------------------------------------------------ caches
const glowCache = new Map<string, HTMLCanvasElement>();
function glow(color: string): HTMLCanvasElement {
  let c = glowCache.get(color);
  if (!c) {
    c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, color);
    g.addColorStop(0.35, color + "88");
    g.addColorStop(1, color + "00");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    glowCache.set(color, c);
  }
  return c;
}

function drawGlow(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, r: number, alpha: number) {
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(glow(color), x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let bgCanvas: HTMLCanvasElement | null = null;
let decalCanvas: HTMLCanvasElement | null = null;
let decalCtx: CanvasRenderingContext2D | null = null;

function buildBg(g: Game, cw: number, ch: number) {
  if (!bgCanvas) bgCanvas = document.createElement("canvas");
  bgCanvas.width = cw;
  bgCanvas.height = ch;
  const x = bgCanvas.getContext("2d")!;
  const s = cw / W;
  x.setTransform(s, 0, 0, s, 0, 0);
  const L = g.level;
  const rnd = mulberry(L.seed);
  const sky = x.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, L.sky[0]);
  sky.addColorStop(1, L.sky[1]);
  x.fillStyle = sky;
  x.fillRect(0, 0, W, H);
  // stars
  for (let i = 0; i < 70; i++) {
    x.globalAlpha = 0.25 + rnd() * 0.6;
    x.fillStyle = "#ffffff";
    const sz = rnd() < 0.15 ? 2 : 1;
    x.fillRect(rnd() * W, rnd() * 260, sz, sz);
  }
  x.globalAlpha = 1;
  // retro sun with cut stripes
  const R = 120;
  const sc = document.createElement("canvas");
  sc.width = sc.height = R * 2;
  const sx = sc.getContext("2d")!;
  const sg = sx.createLinearGradient(0, 0, 0, R * 2);
  sg.addColorStop(0, L.sun);
  sg.addColorStop(1, L.accent);
  sx.fillStyle = sg;
  sx.beginPath();
  sx.arc(R, R, R, 0, Math.PI * 2);
  sx.fill();
  sx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 8; i++) {
    const yy = R + 20 + i * 15;
    sx.fillRect(0, yy, R * 2, 2 + i * 1.5);
  }
  x.globalAlpha = 0.85;
  x.drawImage(sc, W / 2 - R + (L.seed % 3 - 1) * 160, 150, R * 2, R * 2);
  x.globalAlpha = 1;
  // skyline layers
  const layers = [
    { col: "#0d0820", a: 0.55, min: 70, max: 230, wMin: 36, wMax: 80 },
    { col: "#0a0618", a: 0.8, min: 50, max: 170, wMin: 40, wMax: 90 },
    { col: "#07040f", a: 1, min: 30, max: 110, wMin: 50, wMax: 110 },
  ];
  layers.forEach((l, li) => {
    let px = -20;
    while (px < W) {
      const bw = l.wMin + rnd() * (l.wMax - l.wMin);
      const bh = l.min + rnd() * (l.max - l.min);
      x.globalAlpha = l.a;
      x.fillStyle = l.col;
      x.fillRect(px, 480 - bh, bw, bh + 60);
      // windows
      x.globalAlpha = 0.5 * l.a;
      for (let wy = 480 - bh + 10; wy < 470; wy += 14) {
        for (let wx = px + 6; wx < px + bw - 8; wx += 12) {
          if (rnd() < 0.18 - li * 0.04) {
            x.fillStyle = rnd() < 0.5 ? L.accent : "#ffe9a8";
            x.fillRect(wx, wy, 5, 6);
          }
        }
      }
      px += bw + rnd() * 8;
    }
  });
  x.globalAlpha = 1;
  // horizon haze
  const hz = x.createLinearGradient(0, 330, 0, 500);
  hz.addColorStop(0, "rgba(0,0,0,0)");
  hz.addColorStop(1, L.accent + "30");
  x.fillStyle = hz;
  x.fillRect(0, 330, W, 210);
  g.bgDirty = false;
}

function drainDecals(g: Game) {
  if (!decalCanvas) {
    decalCanvas = document.createElement("canvas");
    decalCanvas.width = W;
    decalCanvas.height = H;
    decalCtx = decalCanvas.getContext("2d");
  }
  const d = decalCtx!;
  if (g.decalClear) {
    d.clearRect(0, 0, W, H);
    g.decalClear = false;
  }
  for (const q of g.decalQueue) {
    for (let i = 0; i < q.n; i++) {
      const x = q.x + (Math.random() - 0.5) * 150;
      const sup = supportAt(x, q.y - 30, 420, g.platforms);
      if (!sup) continue;
      d.globalAlpha = 0.35 + Math.random() * 0.5;
      d.fillStyle = q.color;
      d.beginPath();
      d.ellipse(x, sup.y + 0.5, 3 + Math.random() * 14, 1 + Math.random() * 2.2, 0, 0, Math.PI * 2);
      d.fill();
    }
    d.globalAlpha = 0.5;
    d.fillStyle = q.color;
    for (let i = 0; i < 4; i++) {
      d.beginPath();
      d.arc(q.x + (Math.random() - 0.5) * 30, q.y + (Math.random() - 0.5) * 24, 1 + Math.random() * 2.5, 0, Math.PI * 2);
      d.fill();
    }
  }
  d.globalAlpha = 1;
  g.decalQueue.length = 0;
}

// ------------------------------------------------------------------ text helper
function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "left", font = FONT_TITLE, stroke = 4) {
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  if (stroke) {
    ctx.strokeStyle = "rgba(8,4,20,0.9)";
    ctx.lineWidth = stroke;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

// ------------------------------------------------------------------ main
export function render(g: Game, ctx: CanvasRenderingContext2D) {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  if (g.bgDirty || !bgCanvas || bgCanvas.width !== cw || bgCanvas.height !== ch) buildBg(g, cw, ch);
  drainDecals(g);
  const s = g.scale;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(bgCanvas!, 0, 0);

  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.save();
  const sh = g.shake * g.shake;
  if (sh > 0.001) {
    ctx.translate((Math.random() - 0.5) * 2 * sh * 18, (Math.random() - 0.5) * 2 * sh * 18);
    ctx.translate(W / 2, H / 2);
    ctx.rotate((Math.random() - 0.5) * sh * 0.025);
    ctx.translate(-W / 2, -H / 2);
  }
  if (g.zoom > 0.001) {
    const z = 1 + g.zoom;
    ctx.translate(g.zoomX, g.zoomY);
    ctx.scale(z, z);
    ctx.translate(-g.zoomX, -g.zoomY);
  }
  const t = g.time;

  drawAbyss(g, ctx, t);
  drawLevel(g, ctx, t);
  ctx.drawImage(decalCanvas!, 0, 0, W, H);
  drawBarrels(g, ctx, t);
  drawCorpses(g, ctx);
  if (g.bubble) drawBubble(g, ctx);
  for (const e of g.enemies) if (e.alive) drawEnemy(g, ctx, e);
  const act = g.player;
  for (let i = 0; i < g.players.length; i++) {
    const pl = g.players[i];
    if (!pl.alive) continue;
    g.player = pl;
    drawPlayer(g, ctx);
    if (g.coop) drawTag(g, ctx, pl, i);
  }
  g.player = act;
  drawProjs(g, ctx);
  drawFx(g, ctx);
  drawParts(g, ctx);
  drawTexts(g, ctx);
  ctx.restore();

  ctx.setTransform(s, 0, 0, s, 0, 0);
  if (g.flash > 0.01) {
    ctx.globalAlpha = Math.min(0.7, g.flash);
    ctx.fillStyle = g.flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (g.phase !== "menu") drawHud(g, ctx);
  if (g.banner) drawBanner(g, ctx);
  if (g.wipe > 0.001) drawWipe(g, ctx);
}

// ------------------------------------------------------------------ world
function drawAbyss(g: Game, ctx: CanvasRenderingContext2D, t: number) {
  const L = g.level;
  const grd = ctx.createLinearGradient(0, H - 140, 0, H + 40);
  grd.addColorStop(0, L.accent + "00");
  grd.addColorStop(1, L.accent + "66");
  ctx.fillStyle = grd;
  ctx.globalAlpha = 0.65 + Math.sin(t * 2) * 0.12;
  ctx.fillRect(0, H - 140, W, 180);
  ctx.globalAlpha = 1;
}

function drawLevel(g: Game, ctx: CanvasRenderingContext2D, t: number) {
  const acc = g.level.accent;
  for (const p of g.platforms) {
    if (p.kind === "solid") {
      ctx.fillStyle = "#130c28";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      for (let x = p.x + 28; x < p.x + p.w - 4; x += 56) ctx.fillRect(x, p.y + 8, 2, p.h - 8);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(p.x, p.y + p.h - 8, p.w, 8);
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = acc;
      ctx.fillRect(p.x, p.y - 7, p.w, 7);
      ctx.globalAlpha = 0.22;
      ctx.fillRect(p.x, p.y - 3, p.w, 3);
      ctx.globalAlpha = 1;
      ctx.fillRect(p.x, p.y, p.w, 3);
      if (p.h < 59) {
        ctx.fillStyle = acc;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(p.x, p.y, 2, p.h);
        ctx.fillRect(p.x + p.w - 2, p.y, 2, p.h);
        ctx.globalAlpha = 1;
      }
    } else {
      ctx.fillStyle = "#2b2058";
      ctx.fillRect(p.x, p.y + 2, p.w, p.h - 3);
      ctx.fillStyle = "#e9e2ff";
      ctx.globalAlpha = 0.9;
      ctx.fillRect(p.x, p.y, p.w, 3);
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = acc;
      ctx.fillRect(p.x, p.y - 5, p.w, 5);
      ctx.globalAlpha = 0.7;
      for (let x = p.x + 10; x < p.x + p.w - 6; x += 22) ctx.fillRect(x, p.y + 6, 8, 2);
      ctx.globalAlpha = 1;
      if (p.move) {
        drawGlow(ctx, acc, p.x + p.w / 2, p.y + 12, 38, 0.35 + Math.sin(t * 8) * 0.1);
        ctx.fillStyle = acc;
        ctx.fillRect(p.x + 2, p.y + 2, 6, 6);
        ctx.fillRect(p.x + p.w - 8, p.y + 2, 6, 6);
      }
    }
  }
  // spikes
  for (const sp of g.spikes) {
    ctx.fillStyle = "#ff3b5c";
    for (let x = sp.x; x < sp.x + sp.w - 4; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, sp.y + sp.h);
      ctx.lineTo(x + 7, sp.y - 2);
      ctx.lineTo(x + 14, sp.y + sp.h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.6;
    for (let x = sp.x; x < sp.x + sp.w - 4; x += 14) ctx.fillRect(x + 6, sp.y + 1, 2, 4);
    ctx.globalAlpha = 1;
    drawGlow(ctx, "#ff3b5c", sp.x + sp.w / 2, sp.y + 6, sp.w * 0.6, 0.25 + Math.sin(t * 5) * 0.08);
  }
  // pads
  for (const pd of g.pads) {
    const k = 0.5 + Math.sin(t * 6) * 0.5;
    drawGlow(ctx, "#ffffff", pd.x + pd.w / 2, pd.y, pd.w * 0.8, 0.15 + k * 0.2);
    ctx.fillStyle = "#1c1340";
    ctx.fillRect(pd.x, pd.y + 4, pd.w, pd.h - 4);
    ctx.fillStyle = acc;
    ctx.fillRect(pd.x - 2, pd.y + 2, pd.w + 4, 4);
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.6 + k * 0.4;
    for (let x = pd.x + 6; x < pd.x + pd.w - 6; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, pd.y + 1);
      ctx.lineTo(x + 4, pd.y - 4 - k * 2);
      ctx.lineTo(x + 8, pd.y + 1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawBarrels(g: Game, ctx: CanvasRenderingContext2D, t: number) {
  for (const b of g.barrels) {
    if (!b.alive) continue;
    const x = b.x - b.w / 2;
    const y = b.y - b.h;
    const lit = b.fuse >= 0;
    ctx.fillStyle = lit && Math.floor(t * 40) % 2 === 0 ? "#ffffff" : "#c9352a";
    ctx.fillRect(x, y + 2, b.w, b.h - 4);
    ctx.fillStyle = lit ? "#fff" : "#7d1a14";
    ctx.fillRect(x - 1, y, b.w + 2, 4);
    ctx.fillRect(x - 1, y + b.h - 4, b.w + 2, 4);
    ctx.fillStyle = "#ffd23f";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 9, y + 14);
      ctx.lineTo(x + i * 9 + 5, y + 14);
      ctx.lineTo(x + i * 9 + 9, y + 22);
      ctx.lineTo(x + i * 9 + 4, y + 22);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(x + 3, y + 4, 3, b.h - 8);
    drawGlow(ctx, "#ff8a2d", b.x, y + b.h / 2, 34, 0.18 + Math.sin(t * 4 + b.x) * 0.06);
  }
}

function drawCorpses(g: Game, ctx: CanvasRenderingContext2D) {
  for (const c of g.corpses) {
    const a = Math.min(1, c.life / (c.max * 0.5));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    const col = c.flash > 0 ? "#ffffff" : c.color;
    ctx.fillStyle = col;
    if (c.kind === "drone") {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) ctx.lineTo(Math.cos((i * Math.PI) / 3) * 14, Math.sin((i * Math.PI) / 3) * 11);
      ctx.fill();
    } else {
      const k = c.kind === "brute" ? 1.35 : 1;
      ctx.fillRect(-8 * k, -14 * k, 16 * k, 20 * k);
      ctx.beginPath();
      ctx.arc(0, -19 * k, 8 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0b0618";
      ctx.fillRect(-9 * k, 4 * k, 7 * k, 9 * k);
      ctx.fillRect(2 * k, 4 * k, 7 * k, 9 * k);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** Co-op : pastille J1…J4 au-dessus du joueur (et clignotement d'invincibilité au retour). */
function drawTag(g: Game, ctx: CanvasRenderingContext2D, p: Player, i: number) {
  const col = g.tagColor(i);
  const y = p.y - p.h - 22;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(p.x - 5, y + 9);
  ctx.lineTo(p.x + 5, y + 9);
  ctx.lineTo(p.x, y + 15);
  ctx.closePath();
  ctx.fill();
  txt(ctx, "J" + (i + 1), p.x, y, 13, col, "center", FONT_TITLE, 4);
  if (p.inv > 0.3 && g.phase === "playing") {
    ctx.globalAlpha = 0.35 + Math.sin(g.time * 30) * 0.25;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 20, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawBubble(g: Game, ctx: CanvasRenderingContext2D) {
  const b = g.bubble!;
  const p = g.players[b.pi] ?? g.player;
  const fade = b.dur - b.t < 0.3 ? (b.dur - b.t) / 0.3 : 1;
  const r = b.r * Math.min(1, b.t / 0.18) * fade;
  const cx = p.x;
  const cy = p.y - 20;
  const gr = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
  gr.addColorStop(0, p.hero.color + "00");
  gr.addColorStop(0.8, p.hero.color + "22");
  gr.addColorStop(1, p.hero.color + "55");
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = p.hero.color;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.9 * fade;
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -g.time * 40;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // clock hands
  ctx.globalAlpha = 0.35 * fade;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(g.time * 1.5) * r * 0.9, cy + Math.sin(g.time * 1.5) * r * 0.9);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(g.time * 0.2) * r * 0.55, cy + Math.sin(g.time * 0.2) * r * 0.55);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ characters
interface BStyle {
  body: string;
  trim: string;
  head: string;
  visor: string;
  k: number;
}

function biped(
  ctx: CanvasRenderingContext2D, x: number, y: number, face: number, st: BStyle, ph: number, air: boolean, vy: number,
  sqx: number, sqy: number, lean: number, white: boolean, arm: (c: CanvasRenderingContext2D) => void, tail = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face * sqx * st.k, sqy * st.k);
  ctx.translate(0, -15);
  ctx.rotate(lean * 0.14);
  ctx.translate(0, 15);
  const body = white ? "#ffffff" : st.body;
  const trim = white ? "#ffffff" : st.trim;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "#0b0618";
  // tail / scarf
  ctx.fillStyle = trim;
  ctx.beginPath();
  const wv = Math.sin(ph * 0.8) * 2;
  ctx.moveTo(-5, -29);
  ctx.quadraticCurveTo(-14 - tail, -27 + wv, -20 - tail * 1.4, -22 + wv * 2 + (air ? vy * 0.01 : 0));
  ctx.quadraticCurveTo(-13 - tail, -24, -4, -24);
  ctx.fill();
  // legs
  const legs = (side: number) => {
    let fx: number;
    let fy: number;
    if (air) {
      fx = side * 5 + (vy < 0 ? side * 2 : -side * 3);
      fy = vy < 0 ? -4 : 0;
    } else {
      fx = Math.sin(ph + (side > 0 ? 0 : Math.PI)) * 8;
      fy = -Math.max(0, Math.cos(ph + (side > 0 ? 0 : Math.PI))) * 5;
    }
    ctx.lineWidth = 6.5;
    ctx.strokeStyle = "#0b0618";
    ctx.beginPath();
    ctx.moveTo(side * 2, -13);
    ctx.lineTo(fx, fy - 1);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = side > 0 ? trim : body;
    ctx.beginPath();
    ctx.moveTo(side * 2, -13);
    ctx.lineTo(fx, fy - 1);
    ctx.stroke();
  };
  legs(-1);
  // torso
  ctx.fillStyle = body;
  ctx.strokeStyle = "#0b0618";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-8, -30, 16, 19, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = trim;
  ctx.fillRect(-8, -16, 16, 3);
  // head
  ctx.fillStyle = white ? "#fff" : st.head;
  ctx.beginPath();
  ctx.arc(1, -35, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (!white) {
    ctx.fillStyle = st.visor;
    ctx.fillRect(2, -38, 8, 4);
  }
  legs(1);
  arm(ctx);
  ctx.restore();
}

function armAndBlade(ctx: CanvasRenderingContext2D, theta: number, len: number, bodyCol: string, drawTool: (c: CanvasRenderingContext2D) => void) {
  ctx.save();
  ctx.translate(3, -25);
  ctx.rotate(theta);
  ctx.strokeStyle = "#0b0618";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  ctx.strokeStyle = bodyCol;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  ctx.translate(len, 0);
  drawTool(ctx);
  ctx.restore();
}

function drawPlayer(g: Game, ctx: CanvasRenderingContext2D) {
  const p: Player = g.player;
  const hero = p.hero;
  const t = g.time;
  const fast = p.rush > 0;
  drawGlow(ctx, hero.color, p.x, p.y - 20, fast ? 54 : 40, fast ? 0.4 : 0.22);
  const attacking = p.atkT >= 0;
  const a = attacking ? Math.min(1, p.atkT / 0.2) : 0;
  const ease = 1 - Math.pow(1 - a, 3);
  let theta = 0.95 + Math.sin(t * 3) * 0.04;
  if (attacking) theta = -2.0 + ease * 3.1;
  else if (p.throwAnim > 0) theta = -0.35;
  else if (p.parryT > 0) theta = -0.15;
  else if (p.dashT > 0) theta = 0.2;
  else if (g.phase === "menu") theta = 0.95;
  const lean = p.dashT > 0 ? 1 : p.slam === 2 ? 0.2 : Math.max(-1, Math.min(1, p.vx / 260));
  const white = p.hurtFlash > 0 || (g.roomState === "dead" && !p.alive);
  const ph = p.runPh;
  const st: BStyle = { body: hero.color, trim: hero.accent, head: "#1a1230", visor: "#ffffff", k: 1 };
  let sx = p.sqx;
  let sy = p.sqy;
  if (p.dashT > 0) {
    sx = 1.35;
    sy = 0.8;
  } else if (p.slam === 2) {
    sx = 0.75;
    sy = 1.3;
  }
  const idle = g.phase === "menu" ? 1 + Math.sin(t * 2.5) * 0.02 : 1;
  biped(ctx, p.x, p.y, p.face, st, ph, !p.onGround, p.vy, sx, sy * idle, lean, white, (c) => {
    armAndBlade(c, theta, 9, hero.color, (cc) => {
      switch (hero.id) {
        case "kage": {
          cc.fillStyle = "#0b0618";
          cc.fillRect(-2, -2.5, 6, 5);
          cc.strokeStyle = "#0b0618";
          cc.lineWidth = 5;
          cc.beginPath();
          cc.moveTo(3, 0);
          cc.lineTo(30, 0);
          cc.stroke();
          cc.strokeStyle = "#ffffff";
          cc.lineWidth = 2.5;
          cc.beginPath();
          cc.moveTo(3, 0);
          cc.lineTo(30, 0);
          cc.stroke();
          cc.strokeStyle = hero.color;
          cc.lineWidth = 1;
          cc.beginPath();
          cc.moveTo(5, 1.6);
          cc.lineTo(30, 1.6);
          cc.stroke();
          break;
        }
        case "aegis": {
          cc.fillStyle = "#0b0618";
          cc.beginPath();
          cc.roundRect(-2, -13, 9, 26, 4);
          cc.fill();
          cc.fillStyle = hero.color;
          cc.beginPath();
          cc.roundRect(-0.5, -11, 6, 22, 3);
          cc.fill();
          cc.fillStyle = "#fff";
          cc.fillRect(1.5, -6, 2, 12);
          break;
        }
        case "chrono": {
          cc.fillStyle = "#0b0618";
          cc.beginPath();
          cc.arc(5, 0, 8, 0, Math.PI * 2);
          cc.fill();
          cc.strokeStyle = hero.color;
          cc.lineWidth = 2;
          cc.beginPath();
          cc.arc(5, 0, 6, 0, Math.PI * 2);
          cc.stroke();
          cc.beginPath();
          cc.moveTo(5, 0);
          cc.lineTo(5 + Math.cos(t * 5) * 5, Math.sin(t * 5) * 5);
          cc.stroke();
          break;
        }
        default: {
          cc.fillStyle = "#0b0618";
          cc.fillRect(-3, -5, 10, 10);
          cc.fillStyle = hero.color;
          cc.fillRect(-1, -3, 6, 6);
          if (Math.random() < 0.4) {
            cc.strokeStyle = "#fff";
            cc.lineWidth = 1.5;
            cc.beginPath();
            cc.moveTo(6, 0);
            cc.lineTo(12 + Math.random() * 6, (Math.random() - 0.5) * 12);
            cc.stroke();
          }
        }
      }
    });
  }, fast ? 6 : 0);

  // parry shield
  if (p.parryT > 0) {
    const k = Math.min(1, (0.42 - p.parryT) / 0.08 + 0.2);
    ctx.save();
    ctx.translate(p.x + p.face * 12, p.y - 22);
    ctx.scale(p.face, 1);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = hero.color;
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.6 + Math.sin(t * 40) * 0.2;
    ctx.beginPath();
    ctx.arc(-6, 0, 34 * k, -1.15, 1.15);
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-6, 0, 34 * k, -1.15, 1.15);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
}

function drawEnemy(g: Game, ctx: CanvasRenderingContext2D, e: Enemy) {
  const col = ENEMY_COLORS[e.kind];
  const t = g.time;
  if (e.state === "spawn") {
    if (e.spawnT > 0.25) return;
    ctx.globalAlpha = 1 - e.spawnT / 0.25;
  }
  if (e.slowed) drawGlow(ctx, (g.bubble ? g.players[g.bubble.pi] ?? g.player : g.player).hero.color, e.x, e.y - e.h / 2, 40, 0.3);
  const white = e.flash > 0;
  const telegraph = (e.state === "windup" || e.state === "aim" || e.state === "tele") && Math.floor(t * 18) % 2 === 0;

  if (e.kind === "drone") {
    const cx = e.x;
    const cy = e.y - e.h / 2;
    drawGlow(ctx, col, cx, cy, 36, 0.3);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineJoin = "round";
    // rotors
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    const rot = t * 40;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 19 - Math.cos(rot) * 9, -9 - Math.sin(rot) * 1.5);
      ctx.lineTo(s * 19 + Math.cos(rot) * 9, -9 + Math.sin(rot) * 1.5);
      ctx.stroke();
    }
    ctx.fillStyle = white || telegraph ? "#fff" : col;
    ctx.strokeStyle = "#0b0618";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) ctx.lineTo(Math.cos((i * Math.PI) / 3) * 15, Math.sin((i * Math.PI) / 3) * 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#0b0618";
    ctx.beginPath();
    ctx.arc(e.face * 3, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = e.state === "tele" || e.state === "dive" ? "#ff3b4e" : "#ffffff";
    ctx.beginPath();
    ctx.arc(e.face * 4 + e.ax * 2, e.ay * 2, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (e.state === "tele") {
      ctx.save();
      ctx.strokeStyle = "#ff3b4e";
      ctx.globalAlpha = 0.35 + (e.t / 0.64) * 0.6;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + e.ax * 420, cy + e.ay * 420);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    return;
  }

  const k = e.kind === "brute" ? 1.35 : 1;
  const st: BStyle = {
    body: col,
    trim: e.kind === "grunt" ? "#ff9aa5" : e.kind === "shooter" ? "#ffe0a8" : "#a9c0ff",
    head: e.kind === "grunt" ? "#f4f0ff" : e.kind === "shooter" ? "#2a1a10" : "#0e1a3a",
    visor: e.kind === "grunt" ? "#0b0618" : e.kind === "shooter" ? "#ffb02e" : "#4ae6ff",
    k,
  };
  const phase = Math.abs(e.vx) > 10 ? (g.time * Math.abs(e.vx) * 0.05) % (Math.PI * 2) : 0;
  let squashX = 1;
  let squashY = 1;
  if (e.state === "windup") {
    squashY = 0.92;
    squashX = 1.06;
  }
  biped(ctx, e.x, e.y, e.face, st, phase, !e.onGround, e.vy, squashX, squashY, e.lean, white || (telegraph && e.kind !== "shooter"), (c) => {
    if (e.kind === "shooter") {
      const th = Math.atan2(e.state === "aim" || e.state === "recover" ? e.ay : 0.1, (e.state === "aim" || e.state === "recover" ? e.ax * e.face : 1));
      armAndBlade(c, th, 8, st.trim, (cc) => {
        cc.fillStyle = "#0b0618";
        cc.fillRect(-2, -4, 20, 8);
        cc.fillStyle = "#ffb02e";
        cc.fillRect(0, -2.5, 17, 5);
        cc.fillStyle = "#fff";
        cc.fillRect(12, -1.5, 5, 3);
      });
      return;
    }
    let th = 1.0;
    if (e.state === "windup") th = -2.1;
    else if (e.state === "attack") th = -2.1 + Math.min(1, e.t / (e.kind === "brute" ? 0.15 : 0.1)) * 3.4;
    else if (e.state === "stun") th = 1.4;
    armAndBlade(c, th, 9, st.trim, (cc) => {
      if (e.kind === "grunt") {
        cc.strokeStyle = "#0b0618";
        cc.lineWidth = 5;
        cc.beginPath();
        cc.moveTo(0, 0);
        cc.lineTo(20, 0);
        cc.stroke();
        cc.strokeStyle = "#ffffff";
        cc.lineWidth = 2.4;
        cc.beginPath();
        cc.moveTo(1, 0);
        cc.lineTo(20, 0);
        cc.stroke();
      } else {
        cc.fillStyle = "#0b0618";
        cc.fillRect(-2, -6, 24, 12);
        cc.fillStyle = "#6f8fff";
        cc.fillRect(0, -4, 20, 8);
      }
    });
    if (e.kind === "brute") {
      // shield (local, already-transformed coordinates)
      const up = e.state !== "stun";
      c.save();
      c.globalAlpha = up ? 1 : 0.4;
      c.fillStyle = "#0b0618";
      c.beginPath();
      c.roundRect(8, -42, 10, 34, 4);
      c.fill();
      c.fillStyle = "#4ae6ff";
      c.beginPath();
      c.roundRect(10, -40, 6, 30, 3);
      c.fill();
      c.fillStyle = "#fff";
      c.fillRect(11.5, -34, 2, 18);
      c.restore();
    }
  }, 0);
  if (e.kind === "brute" && e.state === "idle" && e.turnT > 0.05) {
    // turning indicator
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.6;
    ctx.fillRect(e.x - 14, e.y - 70, 28 * Math.min(1, e.turnT / 0.7), 3);
    ctx.globalAlpha = 1;
  }
  const top = e.y - e.h * 1.18 - 10;
  if (e.state === "windup") {
    txt(ctx, "!", e.x, top - 4, 24, "#ffe14a", "center", FONT_TITLE, 5);
  } else if (e.state === "aim") {
    // laser
    const mx = e.x + e.ax * 24;
    const my = e.y - 26 + e.ay * 24;
    let len = 0;
    while (len < 1100) {
      len += 10;
      const lx = mx + e.ax * len;
      const ly = my + e.ay * len;
      if (pointInSolid(lx, ly, g.platforms) || lx < -20 || lx > W + 20 || ly < -50 || ly > H + 50) break;
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "#ff3b4e";
    ctx.globalAlpha = 0.25 + Math.min(1, e.t / 0.6) * 0.65;
    ctx.lineWidth = 1.5 + Math.min(1, e.t / 0.6) * 1.5;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + e.ax * len, my + e.ay * len);
    ctx.stroke();
    ctx.restore();
    drawGlow(ctx, "#ff3b4e", mx + e.ax * len, my + e.ay * len, 12, 0.8);
  } else if (e.state === "stun") {
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + (i * Math.PI * 2) / 3;
      ctx.fillStyle = "#ffe14a";
      ctx.fillRect(e.x + Math.cos(a) * 14 - 2, top + 8 + Math.sin(a) * 4 - 2, 4, 4);
    }
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ projectiles & fx
function drawProjs(g: Game, ctx: CanvasRenderingContext2D) {
  for (const pr of g.projs) {
    const hc = (g.players[pr.pi ?? 0] ?? g.player).hero.color;
    const mine = pr.owner === "p";
    const col = mine ? hc : "#ff7a3c";
    if (pr.kind === "bullet") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = col;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(pr.x, pr.y);
      ctx.lineTo(pr.x - pr.vx * 0.03, pr.y - pr.vy * 0.03);
      ctx.stroke();
      ctx.restore();
      drawGlow(ctx, col, pr.x, pr.y, 16, 0.9);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      if (pr.slowed) drawGlow(ctx, hc, pr.x, pr.y, 22, 0.3);
    } else if (pr.kind === "kunai") {
      const a = Math.atan2(pr.vy, pr.vx);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = col;
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(pr.x, pr.y);
      ctx.lineTo(pr.x - pr.vx * 0.035, pr.y - pr.vy * 0.035);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.rotate(a);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.lineTo(-4, -4);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      drawGlow(ctx, col, pr.x, pr.y, 14, 0.6);
    } else if (pr.kind === "boomer") {
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.rotate(pr.rot * 1.6);
      ctx.fillStyle = "#0b0618";
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 10.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(7, 0);
      ctx.moveTo(0, -7);
      ctx.lineTo(0, 7);
      ctx.stroke();
      ctx.restore();
      drawGlow(ctx, col, pr.x, pr.y, 30, 0.5);
    } else if (pr.kind === "disc") {
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.rotate(pr.rot * 2);
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.fillStyle = "#0b0618";
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? 7 : 12;
        ctx.lineTo(Math.cos((i * Math.PI) / 4) * r, Math.sin((i * Math.PI) / 4) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      drawGlow(ctx, col, pr.x, pr.y, 26, 0.55);
    } else {
      const blink = Math.floor((1.3 - pr.life) * (6 + (1.3 - pr.life) * 14)) % 2 === 0;
      ctx.fillStyle = "#0b0618";
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = blink ? "#ff3b4e" : hc;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(pr.x - 1, pr.y - 6, 2, 3);
      drawGlow(ctx, hc, pr.x, pr.y, 20, blink ? 0.6 : 0.25);
    }
  }
}

function drawFx(g: Game, ctx: CanvasRenderingContext2D) {
  for (const f of g.fx) {
    const k = f.t / f.life;
    const inv = 1 - k;
    switch (f.k) {
      case "slash": {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.scale(f.face, 1);
        ctx.globalCompositeOperation = "lighter";
        const R = 46 * f.s;
        const sweep = Math.min(1, k * 2.8);
        const a0 = -1.25;
        const a1 = a0 + 2.5 * sweep;
        ctx.globalAlpha = inv;
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(-8, 0, R, a0, a1);
        ctx.arc(-8 - 5, 0, R - 14 * (1 - k * 0.5), a1, a0, true);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = inv * 0.9;
        ctx.beginPath();
        ctx.arc(-8, 0, R, a0 + 0.2 * sweep, a1);
        ctx.arc(-8 - 2.5, 0, R - 5, a1, a0 + 0.2 * sweep, true);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
      case "ghost": {
        ctx.globalAlpha = inv * 0.45;
        ctx.fillStyle = f.color;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.scale(f.face, 1);
        ctx.fillRect(-8, -30, 16, 19);
        ctx.beginPath();
        ctx.arc(1, -35, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-6, -12, 5, 12);
        ctx.fillRect(2, -12, 5, 12);
        ctx.restore();
        ctx.globalAlpha = 1;
        break;
      }
      case "ring": {
        const r = (1 - Math.pow(inv, 3)) * 70 * f.s;
        ctx.globalAlpha = inv;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = Math.max(0.5, 6 * inv * Math.min(1.5, f.s));
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case "spawn": {
        // contracting ring + light column
        const r = 46 * inv + 4;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.25 + k * 0.6;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 2 + k * 3;
        ctx.beginPath();
        ctx.arc(f.x, f.y - 18, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = f.color;
        ctx.globalAlpha = 0.18 + k * 0.5;
        const w = 4 + k * 16;
        ctx.fillRect(f.x - w / 2, f.y - 70 * (0.4 + k * 0.6), w, 70 * (0.4 + k * 0.6));
        ctx.restore();
        ctx.globalAlpha = 1;
        break;
      }
      case "streak": {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.translate(f.x, f.y);
        ctx.rotate(f.a);
        ctx.globalAlpha = inv;
        ctx.fillStyle = f.color;
        const l = 150 * f.s * (0.4 + k * 0.6);
        ctx.fillRect(-l * 0.1, -2 * inv - 0.5, l, 4 * inv + 1);
        ctx.restore();
        break;
      }
      case "shield": {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.scale(f.face, 1);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = inv;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 5 * inv + 1;
        ctx.beginPath();
        ctx.arc(-6, 0, 30 * f.s * (0.8 + k * 0.4), -1.1, 1.1);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "wave": {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const w = 20 + (1 - inv * inv) * 190;
        ctx.globalAlpha = inv;
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y - 2, w, 12 * inv + 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = inv * 0.8;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y - 2, w * 0.7, 4 * inv + 1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      default:
        break;
    }
  }
}

function drawParts(g: Game, ctx: CanvasRenderingContext2D) {
  let last = "";
  for (const q of g.parts) {
    const k = q.life / q.max;
    if (q.glow) {
      drawGlow(ctx, q.color, q.x, q.y, q.size * 4, Math.min(0.5, k * 0.5, (1 - k) * 2));
      continue;
    }
    ctx.globalAlpha = Math.min(1, k * 1.6);
    if (q.color !== last) {
      ctx.fillStyle = q.color;
      ctx.strokeStyle = q.color;
      last = q.color;
    }
    if (q.line) {
      ctx.lineWidth = Math.max(1, q.size * k);
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(q.x - q.vx * 0.035, q.y - q.vy * 0.035);
      ctx.stroke();
    } else {
      const s = q.size * (0.4 + k * 0.6);
      ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
    }
  }
  ctx.globalAlpha = 1;
}

function drawTexts(g: Game, ctx: CanvasRenderingContext2D) {
  for (const t of g.texts) {
    const k = t.t / t.life;
    const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : 1.15 - Math.min(0.15, (k - 0.12) * 0.5);
    ctx.globalAlpha = Math.min(1, (1 - k) * 2.2);
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(pop, pop);
    txt(ctx, t.text, 0, 0, t.size, t.color, "center", FONT_TITLE, 4);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ HUD
function drawHud(g: Game, ctx: CanvasRenderingContext2D) {
  const p = g.player;
  const hero = p.hero;
  const pop = 1 + g.scorePop * 0.18;
  ctx.save();
  ctx.translate(20, 38);
  ctx.scale(pop, pop);
  txt(ctx, String(Math.round(g.scoreShown)).padStart(6, "0"), 0, 0, 34, "#ffffff", "left", FONT_TITLE, 6);
  ctx.restore();
  txt(ctx, "SCORE", 22, 14, 11, hero.color, "left", FONT_UI, 0);

  if (g.coop) {
    drawCoopCards(g, ctx);
  } else {
  // ammo pips
  const ammoFull = Math.floor(p.ammo + 0.001);
  for (let i = 0; i < hero.maxAmmo; i++) {
    const x = 24 + i * 20;
    ctx.fillStyle = "rgba(10,5,25,0.8)";
    ctx.fillRect(x - 2, 62, 16, 12);
    if (i < ammoFull) {
      ctx.fillStyle = hero.color;
      ctx.fillRect(x, 64, 12, 8);
    } else if (i === ammoFull) {
      ctx.fillStyle = hero.color;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x, 64, 12 * (p.ammo - ammoFull), 8);
      ctx.globalAlpha = 1;
    }
  }
  // ability bar
  const pct = Math.max(0, Math.min(1, 1 - p.abilCd / hero.abilityCd));
  const bx = 24 + hero.maxAmmo * 20 + 10;
  ctx.fillStyle = "rgba(10,5,25,0.8)";
  ctx.fillRect(bx - 2, 62, 74, 12);
  ctx.fillStyle = pct >= 1 ? "#ffffff" : hero.color;
  ctx.globalAlpha = pct >= 1 ? 0.9 + Math.sin(g.time * 10) * 0.1 : 0.7;
  ctx.fillRect(bx, 64, 70 * pct, 8);
  ctx.globalAlpha = 1;
  if (p.rush > 0) txt(ctx, "FRÉNÉSIE", 24, 90, 11, "#ff2d95", "left", FONT_UI, 0);
  }

  // room
  const rem = g.enemies.filter((e) => e.alive).length;
  txt(ctx, `SALLE ${g.room}  ·  ${g.level.name}`, W / 2, 22, 15, "#ffffff", "center", FONT_UI, 4);
  for (let i = 0; i < g.enemies.length; i++) {
    const x = W / 2 - (g.enemies.length * 14) / 2 + i * 14 + 3;
    ctx.fillStyle = g.enemies[i].alive ? ENEMY_COLORS[g.enemies[i].kind] : "rgba(255,255,255,0.15)";
    ctx.fillRect(x, 38, 9, 9);
  }
  void rem;

  // lives (leave room for the pause button)
  for (let i = 0; i < g.lives; i++) {
    const x = W - 96 - i * 22;
    ctx.fillStyle = g.coop ? "#ff4d6d" : hero.color;
    ctx.beginPath();
    ctx.moveTo(x, 18);
    ctx.lineTo(x + 8, 28);
    ctx.lineTo(x, 38);
    ctx.lineTo(x - 8, 28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#0b0618";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // combo
  if (g.combo >= 2 && g.comboT > 0) {
    const mult = Math.min(8, g.combo);
    const sc = 1 + g.comboPop * 0.35;
    ctx.save();
    ctx.translate(W - 90, 66);
    ctx.scale(sc, sc);
    txt(ctx, `x${mult}`, 0, 0, 34, mult >= 6 ? "#ff2d95" : "#ffe14a", "right", FONT_TITLE, 6);
    ctx.restore();
    ctx.fillStyle = "rgba(10,5,25,0.8)";
    ctx.fillRect(W - 190, 88, 100, 6);
    ctx.fillStyle = "#ffe14a";
    ctx.fillRect(W - 190, 88, 100 * Math.max(0, g.comboT / 2.6), 6);
  }

  // first-room hint
  if (g.room === 1 && g.hintT > 0 && g.phase === "playing") {
    ctx.globalAlpha = Math.min(1, g.hintT);
    const lines = g.coop
      ? ["EN ÉQUIPE : VIES PARTAGÉES  ·  UN K.O. REVIENT TANT QU'IL RESTE DES VIES", "UN COUP = UN MORT  ·  VOUS AUSSI"]
      : g.touchMode
        ? ["GLISSE LE PAD POUR BOUGER  ·  TOUCHE LES BOUTONS POUR COMBATTRE", "UN COUP = UN MORT  ·  TOI AUSSI"]
        : ["A/D BOUGER · W SAUT (x2) · J FRAPPE · K LANCER · L POUVOIR", "UN COUP = UN MORT  ·  TOI AUSSI"];
    ctx.fillStyle = "rgba(8,4,20,0.55)";
    ctx.fillRect(W / 2 - 330, 78, 660, 52);
    txt(ctx, lines[0], W / 2, 94, 17, "#ffffff", "center", FONT_UI, 0);
    txt(ctx, lines[1], W / 2, 116, 13, hero.color, "center", FONT_UI, 0);
    ctx.globalAlpha = 1;
  }
}

/** Co-op : une carte par joueur en bas de l'écran (munitions, pouvoir, éliminations). */
function drawCoopCards(g: Game, ctx: CanvasRenderingContext2D) {
  const n = g.players.length;
  const cw = 210;
  const gap = 12;
  const x0 = (W - (n * cw + (n - 1) * gap)) / 2;
  const y = H - 40;
  for (let i = 0; i < n; i++) {
    const p = g.players[i];
    const hero = p.hero;
    const col = g.tagColor(i);
    const x = x0 + i * (cw + gap);
    ctx.fillStyle = "rgba(8,4,20,0.78)";
    ctx.fillRect(x, y, cw, 34);
    ctx.fillStyle = col;
    ctx.fillRect(x, y, 4, 34);
    txt(ctx, "J" + (i + 1), x + 20, y + 17, 15, col, "center", FONT_TITLE, 0);
    const name = (g.coop![i]?.name ?? "").toUpperCase().slice(0, 10);
    txt(ctx, name, x + 36, y + 10, 12, "#ffffff", "left", FONT_UI, 0);
    txt(ctx, hero.name, x + 36, y + 25, 10, hero.color, "left", FONT_UI, 0);
    const kills = g.pkills[i] ?? 0;
    txt(ctx, `✖${kills}`, x + cw - 8, y + 10, 11, "#ffe14a", "right", FONT_UI, 0);
    if (!p.alive) {
      const rt = g.respawnT[i] ?? 0;
      txt(ctx, rt > 0 ? `K.O. · retour ${Math.ceil(rt)}` : "K.O.", x + cw - 8, y + 25, 11, "#ff6b7a", "right", FONT_UI, 0);
      continue;
    }
    // munitions
    const ammoFull = Math.floor(p.ammo + 0.001);
    const ax = x + 112;
    for (let k = 0; k < hero.maxAmmo; k++) {
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(ax + k * 11, y + 21, 8, 7);
      ctx.fillStyle = hero.color;
      if (k < ammoFull) ctx.fillRect(ax + k * 11, y + 21, 8, 7);
      else if (k === ammoFull) ctx.fillRect(ax + k * 11, y + 21, 8 * (p.ammo - ammoFull), 7);
    }
    // pouvoir
    const pct = Math.max(0, Math.min(1, 1 - p.abilCd / hero.abilityCd));
    const bx = ax + hero.maxAmmo * 11 + 4;
    const bw = x + cw - 8 - bx;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(bx, y + 21, bw, 7);
    ctx.fillStyle = pct >= 1 ? "#ffffff" : hero.color;
    ctx.fillRect(bx, y + 21, bw * pct, 7);
  }
}

function drawBanner(g: Game, ctx: CanvasRenderingContext2D) {
  const b = g.banner!;
  const k = b.t / b.dur;
  const inA = Math.min(1, b.t / 0.18);
  const outA = Math.min(1, (b.dur - b.t) / 0.3);
  const a = Math.min(inA, outA);
  const sc = 1 + (1 - inA) * 0.5;
  const cy = H * 0.36;
  ctx.save();
  ctx.globalAlpha = a * 0.62;
  ctx.fillStyle = "#07030f";
  ctx.fillRect(0, cy - 52 * inA, W, 104 * inA);
  ctx.globalAlpha = a;
  ctx.fillStyle = b.color;
  ctx.fillRect(0, cy - 52 * inA, W * (0.35 + k * 0.1) * inA, 3);
  ctx.fillRect(W - W * (0.35 + k * 0.1) * inA, cy + 52 * inA - 3, W * (0.35 + k * 0.1) * inA, 3);
  ctx.translate(W / 2, cy - 10);
  ctx.scale(sc, sc);
  txt(ctx, b.title, 0, 0, 50, "#ffffff", "center", FONT_TITLE, 8);
  ctx.restore();
  ctx.globalAlpha = a;
  txt(ctx, b.sub, W / 2, cy + 32, 20, b.color, "center", FONT_UI, 4);
  ctx.globalAlpha = 1;
}

function drawWipe(g: Game, ctx: CanvasRenderingContext2D) {
  const n = 9;
  const bh = H / n + 1;
  ctx.fillStyle = "#07030f";
  for (let i = 0; i < n; i++) {
    const delay = (i % 2 ? 0 : 0.15) + i * 0.02;
    const k = Math.max(0, Math.min(1, (g.wipe - delay) / (1 - 0.35)));
    const w = W * k;
    if (i % 2) ctx.fillRect(0, i * (H / n), w, bh);
    else ctx.fillRect(W - w, i * (H / n), w, bh);
  }
  ctx.fillStyle = g.level.accent;
  for (let i = 0; i < n; i++) {
    const delay = (i % 2 ? 0 : 0.15) + i * 0.02;
    const k = Math.max(0, Math.min(1, (g.wipe - delay) / (1 - 0.35)));
    if (k <= 0 || k >= 1) continue;
    const w = W * k;
    if (i % 2) ctx.fillRect(w - 4, i * (H / n), 4, bh);
    else ctx.fillRect(W - w, i * (H / n), 4, bh);
  }
}
