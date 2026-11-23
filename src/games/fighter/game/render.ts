import type { Game, Projectile, Item } from "./game";
import type { Fighter } from "./fighter";
import { W, H, HEAVY_MAX, SLOT_COLORS, type Platform } from "./constants";

export const FONT = 'Bungee, "Arial Black", Impact, system-ui, sans-serif';
const BODY_FONT = '"Chakra Petch", system-ui, sans-serif';
const OUT = "#0d0724";
const TAU = Math.PI * 2;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
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

// --------------------------------------------------------------- background

export function buildBackground(g: Game): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.round(g.cw * g.q));
  c.height = Math.max(2, Math.round(g.ch * g.q));
  const x = c.getContext("2d")!;
  const th = g.stage.theme;
  const v = g.visible();
  const rnd = mulberry(g.stage.id.length * 977 + 13);
  x.setTransform(g.q * g.scale, 0, 0, g.q * g.scale, g.q * g.offX, g.q * g.offY);

  const grd = x.createLinearGradient(0, v.y0, 0, v.y1);
  grd.addColorStop(0, th.skyTop);
  grd.addColorStop(0.55, th.skyMid);
  grd.addColorStop(1, th.skyBot);
  x.fillStyle = grd;
  x.fillRect(v.x0 - 2, v.y0 - 2, v.x1 - v.x0 + 4, v.y1 - v.y0 + 4);

  // central glow (the "rift")
  const rg = x.createRadialGradient(640, 330, 10, 640, 330, 640);
  rg.addColorStop(0, hexA(th.glow, 0.6));
  rg.addColorStop(0.35, hexA(th.glow, 0.18));
  rg.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = rg;
  x.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);

  // stars
  for (let i = 0; i < 150; i++) {
    const sx = v.x0 + rnd() * (v.x1 - v.x0);
    const sy = v.y0 + rnd() * (v.y1 - v.y0) * 0.85;
    const s = 0.5 + rnd() * 1.7;
    x.globalAlpha = 0.25 + rnd() * 0.65;
    x.fillStyle = th.star;
    x.fillRect(sx, sy, s, s);
  }
  x.globalAlpha = 1;

  // distant floating rocks
  for (let i = 0; i < 9; i++) {
    const rx = v.x0 + rnd() * (v.x1 - v.x0);
    const ry = 120 + rnd() * 460;
    const rs = 24 + rnd() * 80;
    x.fillStyle = hexA(th.rockDark, 0.55);
    x.beginPath();
    x.moveTo(rx - rs, ry);
    x.lineTo(rx + rs, ry);
    x.lineTo(rx + rs * 0.5, ry + rs * 0.4);
    x.lineTo(rx + rs * 0.1, ry + rs * (0.8 + rnd() * 0.7));
    x.lineTo(rx - rs * 0.4, ry + rs * 0.45);
    x.closePath();
    x.fill();
    x.fillStyle = hexA(th.accent, 0.16);
    x.fillRect(rx - rs, ry - 1, rs * 2, 2);
  }

  // horizon spires + mist at the bottom
  const baseY = v.y1;
  x.fillStyle = hexA(th.rockDark, 0.7);
  x.beginPath();
  x.moveTo(v.x0, baseY);
  for (let px = v.x0; px <= v.x1 + 60; px += 60) {
    x.lineTo(px, baseY - 40 - rnd() * 130);
    x.lineTo(px + 30, baseY - 20 - rnd() * 50);
  }
  x.lineTo(v.x1 + 60, baseY);
  x.closePath();
  x.fill();
  const mist = x.createLinearGradient(0, baseY - 200, 0, baseY);
  mist.addColorStop(0, "rgba(0,0,0,0)");
  mist.addColorStop(1, hexA(th.glow, 0.32));
  x.fillStyle = mist;
  x.fillRect(v.x0, baseY - 200, v.x1 - v.x0, 200);

  // motes for the dynamic layer
  g.motes = [];
  for (let i = 0; i < 46; i++) {
    g.motes.push({ x: v.x0 + rnd() * (v.x1 - v.x0), y: v.y0 + rnd() * (v.y1 - v.y0), s: 1 + rnd() * 2.2, v: 8 + rnd() * 26, a: 0.2 + rnd() * 0.6 });
  }
  return c;
}

function drawMotes(ctx: CanvasRenderingContext2D, g: Game) {
  const v = g.visible();
  const th = g.stage.theme;
  ctx.fillStyle = th.star;
  const span = v.y1 - v.y0;
  for (const m of g.motes) {
    const y = v.y1 - ((((v.y1 - m.y) + g.t * m.v) % span) + span) % span;
    ctx.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(g.t * 2 + m.x));
    ctx.fillRect(m.x + Math.sin(g.t * 0.6 + m.s * 3) * 10, y, m.s, m.s);
  }
  ctx.globalAlpha = 1;
}

function drawRift(ctx: CanvasRenderingContext2D, g: Game) {
  const th = g.stage.theme;
  ctx.save();
  ctx.translate(640, 330);
  ctx.lineWidth = 2;
  const rings = [260, 360, 470];
  for (let i = 0; i < rings.length; i++) {
    ctx.strokeStyle = hexA(i === 1 ? th.accent2 : th.accent, 0.13);
    ctx.setLineDash([36 + i * 16, 54 + i * 20]);
    ctx.lineDashOffset = -g.t * (28 + i * 14) * (i % 2 ? -1 : 1);
    ctx.beginPath();
    ctx.arc(0, 0, rings[i], 0, TAU);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  const pulse = 0.5 + 0.5 * Math.sin(g.t * 1.6);
  ctx.fillStyle = hexA(th.glow, 0.08 + pulse * 0.06);
  ctx.beginPath();
  ctx.arc(0, 0, 150 + pulse * 14, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ----------------------------------------------------------------- platforms

function drawSolid(ctx: CanvasRenderingContext2D, p: Platform, g: Game) {
  const th = g.stage.theme;
  const depth = p.h;
  // body with jagged underside
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + p.w, p.y);
  ctx.lineTo(p.x + p.w - 10, p.y + 46);
  const n = Math.max(3, Math.round(p.w / 70));
  for (let i = n; i >= 0; i--) {
    const px = p.x + 10 + ((p.w - 20) * i) / n;
    const k = 0.45 + 0.55 * Math.abs(Math.sin(i * 2.3 + p.x * 0.01));
    ctx.lineTo(px, p.y + 46 + (depth - 46) * k);
    if (i > 0) ctx.lineTo(px - (p.w - 20) / n / 2, p.y + 46 + (depth - 46) * 0.2);
  }
  ctx.lineTo(p.x + 10, p.y + 46);
  ctx.closePath();
  const bg = ctx.createLinearGradient(0, p.y, 0, p.y + depth);
  bg.addColorStop(0, th.rockTop);
  bg.addColorStop(0.35, th.rockBody);
  bg.addColorStop(1, th.rockDark);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUT;
  ctx.stroke();

  // glowing cracks
  ctx.strokeStyle = hexA(th.accent2, 0.38);
  ctx.lineWidth = 2;
  const r = mulberry(Math.floor(p.x) + 5);
  for (let i = 0; i < Math.round(p.w / 90); i++) {
    const cx = p.x + 30 + r() * (p.w - 60);
    ctx.beginPath();
    ctx.moveTo(cx, p.y + 18);
    ctx.lineTo(cx + (r() - 0.5) * 24, p.y + 40 + r() * 20);
    ctx.lineTo(cx + (r() - 0.5) * 30, p.y + 70 + r() * 30);
    ctx.stroke();
  }

  // glowing top surface
  const glow = ctx.createLinearGradient(0, p.y - 26, 0, p.y);
  glow.addColorStop(0, hexA(th.accent, 0));
  glow.addColorStop(1, hexA(th.accent, 0.26));
  ctx.fillStyle = glow;
  ctx.fillRect(p.x, p.y - 26, p.w, 26);
  ctx.fillStyle = th.rockTop;
  ctx.fillRect(p.x, p.y, p.w, 12);
  ctx.fillStyle = th.accent;
  ctx.fillRect(p.x, p.y, p.w, 4);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillRect(p.x + 4, p.y, p.w - 8, 1.5);
  // end caps
  ctx.fillStyle = th.accent;
  ctx.fillRect(p.x - 2, p.y - 1, 8, 6);
  ctx.fillRect(p.x + p.w - 6, p.y - 1, 8, 6);
}

function drawSoft(ctx: CanvasRenderingContext2D, p: Platform, g: Game) {
  const th = g.stage.theme;
  const bob = Math.sin(g.t * 1.4 + p.x * 0.02) * 0;
  // under glow
  const ug = ctx.createLinearGradient(0, p.y + p.h, 0, p.y + p.h + 36);
  ug.addColorStop(0, hexA(th.accent2, 0.3));
  ug.addColorStop(1, hexA(th.accent2, 0));
  ctx.fillStyle = ug;
  ctx.fillRect(p.x + 8, p.y + p.h, p.w - 16, 36);
  // slab
  ctx.fillStyle = th.rockBody;
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(p.x, p.y + bob, p.w, p.h, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = th.rockTop;
  ctx.fillRect(p.x + 3, p.y + 3, p.w - 6, 5);
  ctx.fillStyle = th.accent2;
  ctx.fillRect(p.x + 2, p.y, p.w - 4, 3);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillRect(p.x + 6, p.y, p.w - 12, 1);
  // small emitters
  ctx.fillStyle = th.accent;
  for (let i = 0; i < 3; i++) {
    const ex = p.x + p.w * (0.2 + i * 0.3);
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(g.t * 3 + i * 2);
    ctx.fillRect(ex - 3, p.y + 10, 6, 3);
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------- fighters

/** Couleur d'identification : couleur du joueur en versus, cyan / rouge en solo. */
function markColor(f: Fighter) {
  if (f.slot >= 0) return SLOT_COLORS[f.slot % 4];
  return f.isPlayer ? "#22e6ff" : "#ff3e5e";
}

/** Aura de l'attaque lourde en cours de charge. */
function drawCharge(ctx: CanvasRenderingContext2D, f: Fighter, time: number) {
  if (f.charge < 0) return;
  const k = Math.min(1, f.charge / HEAVY_MAX);
  const full = k >= 0.98;
  const pulse = 0.5 + 0.5 * Math.sin(time * (14 + 20 * k));
  const r = f.h * (0.75 + 0.35 * k) + pulse * 6;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const col = full ? "#ffffff" : f.hero.accent;
  const gr = ctx.createRadialGradient(f.x, f.y, r * 0.2, f.x, f.y, r);
  gr.addColorStop(0, hexA(col, 0.05));
  gr.addColorStop(0.7, hexA(col, 0.15 + 0.3 * k));
  gr.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(f.x, f.y, r, 0, TAU);
  ctx.fill();
  // jauge circulaire
  ctx.strokeStyle = hexA(col, 0.9);
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(f.x, f.y, f.h * 0.72, -Math.PI / 2, -Math.PI / 2 + TAU * k);
  ctx.stroke();
  ctx.restore();
  if (full) {
    ctx.font = `16px ${FONT}`;
    ctx.textAlign = "center";
    ctx.lineWidth = 4;
    ctx.strokeStyle = OUT;
    ctx.strokeText("MAX !", f.x, f.y - f.h * 0.95);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("MAX !", f.x, f.y - f.h * 0.95);
  }
}

export function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, time: number, marker = true) {
  const hero = f.hero;
  const bw = hero.w;
  const bh = hero.h;
  const flash = f.flash > 0;
  const body = flash ? "#ffffff" : hero.color;
  const dark = flash ? "#dcdcff" : hero.color2;
  const accent = flash ? "#ffffff" : hero.accent;
  const moving = f.onGround && Math.abs(f.vx) > 30;
  const bob = moving ? Math.abs(Math.sin(f.runPhase)) * 2.5 : Math.sin(time * 3 + f.id) * 1.1;
  const a = f.attack;
  const stun = f.hitstun > 0;

  // ground shadow
  if (f.onGround) {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(f.x, f.feet + 2, f.w * 0.55, 5, 0, 0, TAU);
    ctx.fill();
  }

  // respawn halo
  if (f.invuln > 0.25 && f.state === "alive") {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = hexA(hero.accent, 0.5 + 0.3 * Math.sin(time * 14));
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(f.x, f.feet + 2, f.w * 0.9, 9, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  if (f.invuln > 0 && f.state === "alive") ctx.globalAlpha = Math.floor(time * 18) % 2 ? 0.4 : 0.95;
  ctx.translate(f.x, f.feet);
  ctx.scale(f.scale, f.scale);

  // lean / tumble about the body centre
  let rot = stun ? f.spin : clamp(f.vx / 1500, -0.28, 0.28) + f.spin;
  if (f.dashT > 0) rot = 0.35 * f.dashDir;
  if (a && a.def.arc === "spin" && a.t >= a.def.startup) {
    rot += clamp((a.t - a.def.startup) / (a.def.active + a.def.recovery * 0.3), 0, 1) * TAU * f.facing;
  }
  ctx.translate(0, -bh * 0.5);
  ctx.rotate(rot);
  ctx.translate(0, bh * 0.5);
  // squash & stretch
  ctx.scale(1 - f.squash * 0.55, 1 + f.squash);
  ctx.scale(f.facing, 1);

  const hipY = -bh * 0.3;
  const lw = bw * 0.24;
  const leg = (ox: number, sw: number, lift: number, col: string) => {
    ctx.strokeStyle = OUT;
    ctx.lineWidth = lw + 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ox * 0.6, hipY - 2);
    ctx.lineTo(ox + sw, -lift - 1);
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(ox * 0.6, hipY - 2);
    ctx.lineTo(ox + sw, -lift - 1);
    ctx.stroke();
  };
  const kick = a && a.def.arc === "low" && a.t >= a.def.startup * 0.6 ? 1 : 0;

  // back arm
  const armLen = bh * 0.3;
  const tw = bw * (hero.id === "basalt" ? 1.08 : 0.9);
  const ty0 = -bh * 0.63 - bob * 0.6;
  const ty1 = -bh * 0.27;
  const shx = -tw * 0.1;
  const shy = ty0 + 8;
  const arm = (x0: number, y0: number, ang: number, len: number, col: string, glove: string) => {
    const hx = x0 + Math.cos(ang) * len;
    const hy = y0 + Math.sin(ang) * len;
    ctx.lineCap = "round";
    ctx.strokeStyle = OUT;
    ctx.lineWidth = lw * 0.85 + 3;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = lw * 0.85;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = glove;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx, hy, bw * 0.17, 0, TAU);
    ctx.fill();
    ctx.stroke();
  };
  const runSwing = Math.sin(f.runPhase);
  let backAng = moving ? 1.35 - runSwing * 0.85 : f.onGround ? 1.7 + Math.sin(time * 3) * 0.05 : 2.1;
  if (f.dashT > 0) backAng = 2.9;
  arm(shx, shy, backAng, armLen, dark, dark);

  // legs
  if (f.onGround) {
    if (moving) {
      const s1 = Math.sin(f.runPhase);
      const s2 = Math.sin(f.runPhase + Math.PI);
      leg(-bw * 0.12, s2 * bw * 0.5, Math.max(0, Math.cos(f.runPhase + Math.PI)) * bh * 0.1, dark);
      leg(bw * 0.12, s1 * bw * 0.5, Math.max(0, Math.cos(f.runPhase)) * bh * 0.1, dark);
    } else {
      leg(-bw * 0.16, 0, 0, dark);
      leg(bw * 0.16, kick ? bw * 1.0 : 0, kick ? bh * 0.12 : 0, dark);
    }
  } else {
    const up = f.vy < 0 ? bh * 0.17 : bh * 0.06;
    if (f.dashT > 0) {
      leg(-bw * 0.14, -bw * 0.7, bh * 0.08, dark);
      leg(bw * 0.14, -bw * 0.5, bh * 0.02, dark);
    } else {
      leg(-bw * 0.14, -bw * 0.12, up, dark);
      leg(bw * 0.14, bw * 0.22, up * 0.7, dark);
    }
  }

  // hero-specific back pieces
  const hr = bh * 0.2;
  const hx = bw * 0.05;
  const hy = -bh * 0.8 - bob;
  if (hero.id === "kira") {
    // scarf
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const pts: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const sp = Math.abs(f.vx) * 0.012 + (f.onGround ? 3 : 6);
      pts.push([hx - hr * 0.5 - i * (4 + sp), hy + hr * 0.3 + Math.sin(time * 11 + i * 0.9) * (2 + i * 0.6) + i * 1.4 - clamp(f.vy * 0.006, -4, 4) * i]);
    }
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
  }

  // torso
  ctx.fillStyle = body;
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.roundRect(-tw / 2, ty0, tw, ty1 - ty0, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.roundRect(-tw / 2 + 3, ty0 + 3, tw * 0.38, ty1 - ty0 - 6, 6);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.fillRect(-tw / 2 + 1.5, ty1 - 7, tw - 3, 5);

  if (hero.id === "volt") {
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(2, ty0 + 5);
    ctx.lineTo(-6, ty0 + 15);
    ctx.lineTo(0, ty0 + 15);
    ctx.lineTo(-4, ty0 + 25);
    ctx.lineTo(7, ty0 + 12);
    ctx.lineTo(1, ty0 + 12);
    ctx.lineTo(5, ty0 + 5);
    ctx.closePath();
    ctx.fill();
  } else if (hero.id === "basalt") {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-tw * 0.2, ty0 + 6);
    ctx.lineTo(-tw * 0.05, ty0 + 14);
    ctx.lineTo(-tw * 0.22, ty0 + 22);
    ctx.lineTo(tw * 0.05, ty0 + 30);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tw * 0.25, ty0 + 8);
    ctx.lineTo(tw * 0.12, ty0 + 17);
    ctx.stroke();
  } else if (hero.id === "kira") {
    ctx.fillStyle = accent;
    ctx.fillRect(-tw / 2 + 1.5, ty1 - 14, tw - 3, 3);
  } else {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, ty0 + 14, 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(0, ty0 + 14, 2.4, 0, TAU);
    ctx.fill();
  }

  if (hero.id === "basalt") {
    // shoulder rocks
    ctx.fillStyle = dark;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2.4;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * tw * 0.5 - sx * 4, ty0 - 2);
      ctx.lineTo(sx * (tw * 0.5 + 9), ty0 + 4);
      ctx.lineTo(sx * (tw * 0.5 + 8), ty0 + 16);
      ctx.lineTo(sx * tw * 0.5 - sx * 4, ty0 + 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // head
  const headR = hero.id === "basalt" ? hr * 0.92 : hr;
  if (hero.id === "volt") {
    ctx.fillStyle = accent;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2.2;
    const sw = Math.sin(time * 9) * 1.5;
    ctx.beginPath();
    ctx.moveTo(hx - headR * 0.85, hy - headR * 0.4);
    ctx.lineTo(hx - headR * 1.3 + sw, hy - headR * 1.7);
    ctx.lineTo(hx - headR * 0.15, hy - headR * 0.85);
    ctx.lineTo(hx + headR * 0.2 + sw, hy - headR * 2.05);
    ctx.lineTo(hx + headR * 0.45, hy - headR * 0.85);
    ctx.lineTo(hx + headR * 1.0 + sw, hy - headR * 1.65);
    ctx.lineTo(hx + headR * 0.95, hy - headR * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (hero.id === "ember") {
    for (let i = 0; i < 4; i++) {
      const bx = hx - headR * 0.7 + i * headR * 0.5;
      const fh = headR * (1.0 + 0.25 * Math.sin(time * 11 + i * 2.1)) * (i === 1 || i === 2 ? 1.35 : 0.95);
      const sway = Math.sin(time * 7 + i) * 2.5 - f.vx * 0.004;
      for (let layer = 0; layer < 2; layer++) {
        const k = layer ? 0.55 : 1;
        ctx.fillStyle = layer ? "#fff3a8" : flash ? "#fff" : hero.accent;
        ctx.strokeStyle = OUT;
        ctx.lineWidth = layer ? 0 : 2;
        ctx.beginPath();
        ctx.moveTo(bx - 6 * k, hy - headR * 0.6);
        ctx.quadraticCurveTo(bx - 8 * k, hy - headR - fh * 0.5 * k, bx + sway, hy - headR - fh * k);
        ctx.quadraticCurveTo(bx + 8 * k, hy - headR - fh * 0.5 * k, bx + 6 * k, hy - headR * 0.6);
        ctx.closePath();
        ctx.fill();
        if (!layer) ctx.stroke();
      }
    }
  }
  ctx.fillStyle = body;
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.6;
  if (hero.id === "basalt") {
    ctx.beginPath();
    ctx.roundRect(hx - headR, hy - headR, headR * 2, headR * 2, headR * 0.55);
  } else {
    ctx.beginPath();
    ctx.arc(hx, hy, headR, 0, TAU);
  }
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.arc(hx - headR * 0.35, hy - headR * 0.4, headR * 0.35, 0, TAU);
  ctx.fill();
  if (hero.id === "kira") {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(hx - headR * 0.95, hy - headR * 0.4);
    ctx.lineTo(hx + headR * 0.95, hy - headR * 0.4);
    ctx.stroke();
  }
  // visor + eyes
  ctx.fillStyle = "#120a2a";
  ctx.beginPath();
  ctx.roundRect(hx - headR * 0.1, hy - headR * 0.32, headR * 1.05, headR * 0.72, headR * 0.28);
  ctx.fill();
  if (stun) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx + headR * 0.08, hy - headR * 0.15);
    ctx.lineTo(hx + headR * 0.35, hy + headR * 0.1);
    ctx.moveTo(hx + headR * 0.08, hy + headR * 0.1);
    ctx.lineTo(hx + headR * 0.35, hy - headR * 0.15);
    ctx.moveTo(hx + headR * 0.5, hy - headR * 0.15);
    ctx.lineTo(hx + headR * 0.77, hy + headR * 0.1);
    ctx.moveTo(hx + headR * 0.5, hy + headR * 0.1);
    ctx.lineTo(hx + headR * 0.77, hy - headR * 0.15);
    ctx.stroke();
  } else {
    const blink = Math.sin(time * 0.9 + f.id * 2) > 0.985 ? 0.2 : 1;
    ctx.fillStyle = accent;
    ctx.fillRect(hx + headR * 0.12, hy - headR * 0.14, headR * 0.26, headR * 0.34 * blink);
    ctx.fillRect(hx + headR * 0.55, hy - headR * 0.14, headR * 0.26, headR * 0.34 * blink);
  }

  // front arm (attack aware)
  let ang = moving ? 1.3 + runSwing * 0.85 : f.onGround ? 1.3 + Math.sin(time * 3 + 1) * 0.05 : 0.7;
  let len = armLen;
  let glow = 0;
  const sx = tw * 0.22;
  if (f.dashT > 0) {
    ang = 2.9;
  }
  if (f.shieldT > 0) {
    ang = -0.2;
    len = armLen * 1.1;
  }
  if (a) {
    const d = a.def;
    const endActive = d.startup + d.active;
    const total = endActive + d.recovery;
    const strike = d.arc === "up" ? -1.55 : d.arc === "down" ? 1.55 : d.arc === "low" ? 0.7 : d.arc === "spin" ? 0.15 : -0.1;
    const wind = d.arc === "fwd" ? 2.4 : d.arc === "up" ? 0.6 : d.arc === "down" ? -0.8 : d.arc === "low" ? 1.9 : d.arc === "spin" ? 2.6 : 2.2;
    const u = clamp(a.t / d.startup, 0, 1);
    if (a.t < d.startup) {
      ang = lerp(ang, wind, u);
      len = armLen * (1 - 0.2 * u);
    } else if (a.t < endActive) {
      ang = strike;
      len = armLen * 1.75;
      glow = 1;
    } else {
      const r = clamp((a.t - endActive) / (total - endActive), 0, 1);
      ang = lerp(strike, ang, r);
      len = armLen * lerp(1.75, 1, r);
      glow = 1 - r;
    }
  }
  arm(sx, shy, ang, len, body, glow > 0.1 ? "#fff" : accent);
  if (glow > 0.1) {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = hexA(hero.accent, 0.5 * glow);
    ctx.beginPath();
    ctx.arc(sx + Math.cos(ang) * len, shy + Math.sin(ang) * len, bw * 0.45, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.restore();

  // shield bubble
  if (f.shieldT > 0) {
    const r = Math.max(bw, bh) * f.scale * 0.88;
    const cy = f.y;
    const blink = f.shieldT < 0.45 ? (Math.floor(time * 20) % 2 ? 0.5 : 1) : 1;
    ctx.save();
    ctx.globalAlpha = blink;
    const gr = ctx.createRadialGradient(f.x, cy, r * 0.2, f.x, cy, r);
    gr.addColorStop(0, hexA(hero.accent, 0.05));
    gr.addColorStop(0.75, hexA(hero.accent, 0.22 + f.shieldFlash * 2));
    gr.addColorStop(1, hexA(hero.accent, 0.6 + f.shieldFlash * 2));
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(f.x, cy, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = hexA("#ffffff", 0.7);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(f.x, cy, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = hexA("#ffffff", 0.5);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(f.x, cy, r * 0.82, time * 2, time * 2 + 1.1);
    ctx.stroke();
    ctx.restore();
  }

  // marker
  if (marker && f.state === "alive") {
    const my = f.y - f.h / 2 - 26 - Math.sin(time * 5) * 2 - (hero.id === "ember" || hero.id === "volt" ? 14 : 0);
    const mc = markColor(f);
    ctx.fillStyle = mc;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2.5;
    if (f.slot >= 0) {
      // versus : étiquette J1…J4 (ou CPU) au-dessus du combattant
      const label = f.isPlayer ? "J" + (f.slot + 1) : "CPU";
      ctx.font = `13px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.lineWidth = 4;
      ctx.strokeText(label, f.x, my - 12);
      ctx.fillText(label, f.x, my - 12);
      ctx.lineWidth = 2.5;
    }
    ctx.beginPath();
    ctx.moveTo(f.x - 8, my - 8);
    ctx.lineTo(f.x + 8, my - 8);
    ctx.lineTo(f.x, my + 4);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    if (f.boss) {
      ctx.font = `14px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.lineWidth = 4;
      ctx.strokeStyle = OUT;
      ctx.strokeText("BOSS", f.x, my - 14);
      ctx.fillStyle = "#ff3e5e";
      ctx.fillText("BOSS", f.x, my - 14);
    }
  }
}

function drawAttackFx(ctx: CanvasRenderingContext2D, f: Fighter) {
  const a = f.attack;
  if (!a || a.def.arc === "none" || a.t < a.def.startup * 0.7) return;
  const d = a.def;
  const prog = clamp((a.t - d.startup * 0.7) / (d.active + d.startup * 0.3 + 0.07), 0, 1);
  if (prog >= 1) return;
  const e = 1 - Math.pow(1 - prog, 2);
  const s = f.scale;
  const r = (d.id === "smash" ? 104 : d.id === "jab3" ? 82 : d.id === "upper" ? 66 : 60) * s * f.hero.reach;
  let cx = 0;
  let cy = -6;
  let a0 = -1.0;
  let a1 = 0.6;
  switch (d.arc) {
    case "fwd":
      if (d.variant === 1) {
        a0 = 0.9;
        a1 = -0.6;
      } else if (d.variant === 2) {
        a0 = -1.3;
        a1 = 1.1;
      }
      cx = -8;
      break;
    case "up":
      cx = 0;
      cy = -8;
      a0 = 0.4;
      a1 = -2.7;
      break;
    case "down":
      cy = 6;
      a0 = -0.6;
      a1 = 2.4;
      break;
    case "low":
      cy = 18;
      a0 = -0.35;
      a1 = 0.55;
      break;
    case "spin":
      cy = 0;
      a0 = 0;
      a1 = TAU * 0.85;
      break;
  }
  const head = lerp(a0, a1, e);
  const tail = lerp(a0, a1, Math.max(0, e - 0.6));
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(f.facing, 1);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  const anti = head < tail;
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = (1 - prog * prog) * (i === 0 ? 0.35 : i === 1 ? 0.6 : 0.95);
    ctx.strokeStyle = i === 2 ? "#ffffff" : f.hero.accent;
    ctx.lineWidth = (d.id === "smash" ? 30 + 14 * (a.power ?? 0) : d.id === "jab3" ? 22 : 15) * (1 - prog * 0.6) * (i === 0 ? 1.7 : i === 1 ? 1.1 : 0.45) * s;
    ctx.beginPath();
    ctx.arc(cx * s, cy * s, r, tail, head, anti);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// --------------------------------------------------------------- projectiles/items

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, t: number) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.globalCompositeOperation = "lighter";
  if (p.kind === "bolt") {
    ctx.rotate(Math.atan2(p.vy, p.vx));
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, p.r * 3.2);
    g.addColorStop(0, hexA(p.color, 0.8));
    g.addColorStop(1, hexA(p.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 3.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let i = 1; i <= 5; i++) ctx.lineTo(-i * 14, Math.sin(t * 60 + i * 2.1) * 7);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(0, 0, p.r * 1.15, p.r * 0.7, 0, 0, TAU);
    ctx.fill();
  } else {
    const fl = 1 + Math.sin(t * 40 + p.id) * 0.12;
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, p.r * 2.6 * fl);
    g.addColorStop(0, "rgba(255,245,170,0.95)");
    g.addColorStop(0.35, "rgba(255,150,40,0.7)");
    g.addColorStop(1, "rgba(255,60,20,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 2.6 * fl, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#fff6c0";
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 0.7, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawItem(ctx: CanvasRenderingContext2D, it: Item, t: number) {
  const bob = Math.sin(t * 3 + it.x) * 5;
  const blink = it.life < 3 ? (Math.floor(t * 10) % 2 ? 0.35 : 1) : 1;
  ctx.save();
  ctx.translate(it.x, it.y + bob);
  ctx.globalAlpha = blink;
  ctx.globalCompositeOperation = "lighter";
  const pulse = 1 + Math.sin(t * 5) * 0.12;
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 40 * pulse);
  g.addColorStop(0, "rgba(120,255,170,0.8)");
  g.addColorStop(1, "rgba(120,255,170,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 40 * pulse, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#38e08a";
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.fillRect(-2.5, -9, 5, 18);
  ctx.fillRect(-9, -2.5, 18, 5);
  ctx.restore();
}

function drawPortal(ctx: CanvasRenderingContext2D, f: Fighter) {
  const k = 1 - clamp(f.stateT / 0.55, 0, 1);
  const th = f.hero.accent;
  const feet = f.y + f.h / 2;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const w = lerp(8, 34, Math.sin(k * Math.PI)) + 4;
  const g = ctx.createLinearGradient(0, feet - 220, 0, feet);
  g.addColorStop(0, hexA(th, 0));
  g.addColorStop(1, hexA(th, 0.75));
  ctx.fillStyle = g;
  ctx.fillRect(f.x - w, feet - 220, w * 2, 220);
  ctx.strokeStyle = hexA(th, 0.9);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(f.x, feet, 70 * (1 - k * 0.5), 12, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = hexA("#ffffff", 0.8);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(f.x, feet, 40 * (1 - k), 7, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------------ HUD

function pctColor(p: number) {
  const stops: [number, number[]][] = [
    [0, [255, 255, 255]],
    [50, [255, 230, 90]],
    [100, [255, 140, 30]],
    [150, [255, 46, 77]],
    [220, [180, 0, 40]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (p <= stops[i][0]) {
      const [p0, c0] = stops[i - 1];
      const [p1, c1] = stops[i];
      const k = (p - p0) / (p1 - p0);
      return `rgb(${Math.round(lerp(c0[0], c1[0], k))},${Math.round(lerp(c0[1], c1[1], k))},${Math.round(lerp(c0[2], c1[2], k))})`;
    }
  }
  return "rgb(180,0,40)";
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "left", stroke = 5, font = FONT) {
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  if (stroke) {
    ctx.lineWidth = stroke;
    ctx.strokeStyle = "rgba(10,5,30,0.92)";
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function panel(ctx: CanvasRenderingContext2D, f: Fighter, x: number, y: number, w: number, h: number, big: boolean, g: Game) {
  const sk = 14;
  const hero = f.hero;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + sk, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - sk, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  const bg = ctx.createLinearGradient(0, y, 0, y + h);
  bg.addColorStop(0, "rgba(16,8,44,0.8)");
  bg.addColorStop(1, "rgba(8,4,26,0.8)");
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = f.state === "dead" ? "rgba(255,255,255,0.2)" : hero.color;
  ctx.stroke();
  ctx.clip();
  // colour stripe
  ctx.fillStyle = hexA(hero.color, 0.25);
  ctx.fillRect(x, y, 10, h);

  const pad = x + 26;
  const label = f.slot >= 0 ? (f.isPlayer ? f.name : hero.name) : f.isPlayer ? hero.name : f.name;
  text(ctx, label.length > 12 ? label.slice(0, 11) + "…" : label, pad, y + (big ? 24 : 20), big ? 17 : 13, hero.color, "left", 4);
  // percent
  const sp = f.shownPct;
  const pop = 1 + f.pop * 0.28;
  const shake = sp > 100 ? Math.min(3, (sp - 100) * 0.03) : 0;
  const fs = (big ? 54 : 34) * pop;
  const px = pad + (shake ? (Math.random() - 0.5) * shake * 2 : 0);
  const py = y + h - (big ? 14 : 10) + (shake ? (Math.random() - 0.5) * shake * 2 : 0);
  text(ctx, String(Math.floor(sp)), px, py, fs, pctColor(sp), "left", 6);
  const numW = (() => {
    ctx.font = `${fs}px ${FONT}`;
    return ctx.measureText(String(Math.floor(sp))).width;
  })();
  text(ctx, "%", px + numW + 3, py, big ? 22 : 15, pctColor(sp), "left", 4);

  // stocks
  const infinite = g.cfg.mode === "timeattack" && f.isPlayer;
  const sr = big ? 7 : 5;
  const sxr = x + w - sk - 16;
  if (infinite) {
    text(ctx, "∞", sxr - 8, y + 26, 26, "#fff", "right", 4);
  } else {
    for (let i = 0; i < f.stocks; i++) {
      const cx = sxr - i * (sr * 2 + 5);
      ctx.fillStyle = hero.color;
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, y + 20, sr, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
  }

  // special cooldown (player only)
  if (f.isPlayer || f.slot >= 0) {
    const bw = Math.min(110, w - 150);
    const bx = x + w - sk - 16 - bw;
    const by = y + h - 24;
    const k = 1 - f.cd / hero.special.cd;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(bx, by, bw, 8);
    const ready = f.cd <= 0;
    ctx.fillStyle = ready ? hero.accent : hexA(hero.accent, 0.55);
    ctx.fillRect(bx, by, bw * k, 8);
    if (ready) {
      ctx.fillStyle = hexA("#ffffff", 0.35 + 0.3 * Math.sin(g.t * 9));
      ctx.fillRect(bx, by, bw, 8);
    }
    text(ctx, ready && w > 230 ? `${hero.special.name.toUpperCase()} PRÊT` : hero.special.name.toUpperCase(), bx + bw, by - 5, 12, ready ? "#fff" : "rgba(255,255,255,0.6)", "right", 3, BODY_FONT);
  }
  ctx.restore();
}

/** HUD versus : une carte par joueur en bas de l'écran (%, vies, spécial). */
function drawVersusHUD(ctx: CanvasRenderingContext2D, g: Game) {
  const list = g.roster;
  const n = list.length;
  const gap = 14;
  const w = Math.min(270, (W - 56 - gap * (n - 1)) / n);
  const total = n * w + (n - 1) * gap;
  const x0 = W / 2 - total / 2;
  list.forEach((f, i) => {
    const x = x0 + i * (w + gap);
    const y = H - 100;
    const out = f.removed || (f.stocks <= 0 && f.state === "dead");
    ctx.save();
    if (out) ctx.globalAlpha = 0.4;
    panel(ctx, f, x, y, w, 80, true, g);
    // pastille de joueur
    const col = SLOT_COLORS[f.slot % 4];
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(x + w - 70, y - 14, 52, 22, 11);
    ctx.fill();
    text(ctx, f.isPlayer ? "J" + (f.slot + 1) : "CPU", x + w - 44, y + 3, 13, OUT, "center", 0);
    if (out) text(ctx, "ÉLIMINÉ", x + w / 2, y + 52, 26, "#ff3e5e", "center", 6);
    ctx.restore();
  });

  const cx = W / 2;
  text(ctx, g.modeLabel, cx, 46, 26, "#ffffff", "center", 6);
  text(ctx, g.modeSub, cx, 70, 15, "#22e6ff", "center", 4, BODY_FONT);

  if (g.hintT > 0 && g.status === "playing") {
    const alpha = clamp(g.hintT / 1.2, 0, 1);
    const msg = "Maintiens ATTAQUE pour une attaque lourde : elle éjecte selon le % et brise les boucliers !";
    ctx.globalAlpha = alpha * 0.95;
    ctx.font = `700 18px ${BODY_FONT}`;
    const tw = ctx.measureText(msg).width + 44;
    ctx.fillStyle = "rgba(10,5,30,0.7)";
    ctx.beginPath();
    ctx.roundRect(cx - tw / 2, H - 150, tw, 36, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(34,230,255,0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, msg, cx, H - 126, 18, "#ffffff", "center", 0, BODY_FONT);
    ctx.globalAlpha = 1;
  }
}

function drawHUD(ctx: CanvasRenderingContext2D, g: Game) {
  if (g.versus) {
    drawVersusHUD(ctx, g);
    return;
  }
  const p = g.player;
  // player panel + enemy panels
  const oc = g.overlayControls;
  panel(ctx, p, oc ? 262 : 28, H - 108, 262, 86, true, g);
  const enemies = g.fighters.filter((f) => f.team === 1 && !f.removed);
  if (oc) {
    // touch controls cover the bottom corners: stack enemy panels at the top-right instead
    const ew = 150;
    enemies.slice(0, 4).forEach((f, i) => panel(ctx, f, W - 22 - ew - i * (ew + 8), 96, ew, 60, false, g));
  } else {
    const ew = 168;
    enemies.slice(0, 4).forEach((f, i) => panel(ctx, f, W - 28 - ew - i * (ew + 10), H - 90, ew, 68, false, g));
  }

  // score
  text(ctx, "SCORE", 30, 36, 14, "rgba(255,255,255,0.7)", "left", 3, BODY_FONT);
  const sp = 1 + g.scorePop * 0.18;
  ctx.save();
  ctx.translate(30, 78);
  ctx.scale(sp, sp);
  text(ctx, Math.round(g.shownScore).toLocaleString("fr-FR"), 0, 0, 44, "#ffd23f", "left", 7);
  ctx.restore();
  if (g.cfg.best > 0) {
    text(ctx, `MEILLEUR ${Math.max(g.cfg.best, Math.round(g.score)).toLocaleString("fr-FR")}`, 32, 100, 13, "rgba(255,255,255,0.6)", "left", 3, BODY_FONT);
  }

  // combo
  if (g.combo >= 2) {
    const k = clamp(g.comboT / 1.5, 0, 1);
    const pop = 1 + g.comboPop * 0.35;
    ctx.save();
    ctx.translate(32, 168);
    ctx.scale(pop, pop);
    ctx.transform(1, 0, -0.12, 1, 0, 0);
    const col = g.comboMult >= 4 ? "#ff3e5e" : g.comboMult >= 3 ? "#ff8a2b" : g.comboMult >= 2 ? "#ffd23f" : "#ffffff";
    text(ctx, `${g.combo} HITS`, 0, 0, 40, col, "left", 7);
    text(ctx, `COMBO ×${g.comboMult}`, 2, 24, 16, "#22e6ff", "left", 4);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(2, 32, 150, 6);
    ctx.fillStyle = col;
    ctx.fillRect(2, 32, 150 * k, 6);
    ctx.restore();
  }

  // top-centre mode info
  const cx = W / 2;
  if (g.cfg.mode === "timeattack") {
    const tl = Math.max(0, g.timeLeft);
    const m = Math.floor(tl / 60);
    const s = Math.floor(tl % 60);
    const low = tl < 10;
    const pulse = low ? 1 + (Math.sin(g.t * 12) * 0.5 + 0.5) * 0.12 : 1;
    ctx.save();
    ctx.translate(cx, 66);
    ctx.scale(pulse, pulse);
    text(ctx, `${m}:${s.toString().padStart(2, "0")}`, 0, 0, 58, low ? "#ff3e5e" : "#ffffff", "center", 8);
    ctx.restore();
    text(ctx, `${g.kos} KO`, cx, 92, 18, "#22e6ff", "center", 4);
  } else {
    text(ctx, g.modeLabel, cx, 52, 30, "#ffffff", "center", 6);
    text(ctx, g.modeSub, cx, 78, 15, "#22e6ff", "center", 4, BODY_FONT);
  }

  // hints
  if (g.hintT > 0 && g.status === "playing") {
    const alpha = clamp(g.hintT / 1.2, 0, 1);
    const first = g.hintT > g.hintDur - 6;
    const msg = first
      ? g.cfg.touch
        ? "PAD : bouger  ·  SAUT  ·  ATTAQUE  ·  SPÉCIAL"
        : "← → bouger  ·  ↑ / ESPACE sauter  ·  J frapper (maintenir = lourde)  ·  K spécial"
      : "Maintiens ATTAQUE : attaque lourde qui éjecte selon le % et brise les boucliers !";
    ctx.globalAlpha = alpha * 0.95;
    ctx.font = `700 19px ${BODY_FONT}`;
    const tw = ctx.measureText(msg).width + 44;
    ctx.fillStyle = "rgba(10,5,30,0.7)";
    ctx.beginPath();
    ctx.roundRect(cx - tw / 2, H - 156, tw, 38, 19);
    ctx.fill();
    ctx.strokeStyle = "rgba(34,230,255,0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, msg, cx, H - 131, 19, "#ffffff", "center", 0, BODY_FONT);
    ctx.globalAlpha = 1;
  }
}

function drawIndicators(ctx: CanvasRenderingContext2D, g: Game) {
  const v = g.visible();
  const m = 30;
  for (const f of g.fighters) {
    if (f.state !== "alive") continue;
    if (f.x > v.x0 + 4 && f.x < v.x1 - 4 && f.y > v.y0 + 4 && f.y < v.y1 - 4) continue;
    const x = clamp(f.x, v.x0 + m, v.x1 - m);
    const y = clamp(f.y, v.y0 + m, v.y1 - m);
    const ang = Math.atan2(f.y - y, f.x - x);
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = f.hero.color;
    ctx.strokeStyle = markColor(f);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#0d0724";
    ctx.font = `13px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(Math.floor(f.percent)), 0, 1);
    ctx.rotate(ang);
    ctx.fillStyle = markColor(f);
    ctx.beginPath();
    ctx.moveTo(34, 0);
    ctx.lineTo(24, -8);
    ctx.lineTo(24, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawBanner(ctx: CanvasRenderingContext2D, g: Game) {
  const b = g.banner;
  if (!b) return;
  const k = b.t / b.dur;
  const tin = clamp(b.t / 0.2, 0, 1);
  const back = 1 + 2.2 * Math.pow(tin - 1, 3) + 1.2 * Math.pow(tin - 1, 2);
  const s = tin < 1 ? Math.max(0.01, back) : 1 + (k > 0.8 ? (k - 0.8) * 0.6 : 0);
  const alpha = k > 0.78 ? clamp((1 - k) / 0.22, 0, 1) : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(W / 2, 250);
  ctx.scale(s, s);
  ctx.transform(1, 0, -0.14, 1, 0, 0);
  // stripe
  const grd = ctx.createLinearGradient(-520, 0, 520, 0);
  grd.addColorStop(0, "rgba(0,0,0,0)");
  grd.addColorStop(0.2, hexA(b.color, 0.28));
  grd.addColorStop(0.8, hexA(b.color, 0.28));
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(-520, -62, 1040, b.sub ? 112 : 92);
  text(ctx, b.text, 0, 18, b.text.length > 12 ? 62 : 84, "#ffffff", "center", 10);
  ctx.globalCompositeOperation = "lighter";
  text(ctx, b.text, 0, 18, b.text.length > 12 ? 62 : 84, hexA(b.color, 0.55), "center", 0);
  ctx.globalCompositeOperation = "source-over";
  if (b.sub) text(ctx, b.sub, 0, 52, 24, b.color, "center", 5);
  ctx.restore();
}

// ---------------------------------------------------------------- main render

export function renderGame(ctx: CanvasRenderingContext2D, g: Game) {
  const { q, scale, cw, ch } = g;
  const t = g.t;

  // background (screen space, never shakes)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (g.bg) ctx.drawImage(g.bg, 0, 0);
  else {
    ctx.fillStyle = "#0a0620";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  // world transform with camera
  const z = 1 + g.zoomPunch;
  const cxs = g.offX + (W / 2) * scale;
  const cys = g.offY + (H / 2) * scale;
  const shx = g.shake > 0.2 ? (Math.random() - 0.5) * 2 * g.shake : 0;
  const shy = g.shake > 0.2 ? (Math.random() - 0.5) * 2 * g.shake : 0;
  const e = cxs - (W / 2 + g.camX) * scale * z + shx * scale;
  const f = cys - (H / 2 + g.camY) * scale * z + shy * scale;
  ctx.setTransform(q * scale * z, 0, 0, q * scale * z, q * e, q * f);
  ctx.lineJoin = "round";

  drawRift(ctx, g);
  drawMotes(ctx, g);
  for (const p of g.stage.platforms) if (!p.solid) drawSoft(ctx, p, g);
  for (const p of g.stage.platforms) if (p.solid) drawSolid(ctx, p, g);

  for (const it of g.items) drawItem(ctx, it, t);
  for (const fi of g.fighters) if (fi.state === "waiting") drawPortal(ctx, fi);

  const order = [...g.fighters].sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer));
  for (const fi of order) {
    if (fi.state !== "alive") continue;
    drawCharge(ctx, fi, t);
    if (fi.charge >= 0) {
      // tremblement pendant la charge
      const k = Math.min(1, fi.charge / HEAVY_MAX);
      const j = 1.5 + 2.5 * k;
      const ox = fi.x;
      fi.x += (Math.random() - 0.5) * j;
      drawFighter(ctx, fi, t);
      fi.x = ox;
    } else drawFighter(ctx, fi, t);
    drawAttackFx(ctx, fi);
  }
  for (const p of g.projectiles) if (p.alive) drawProjectile(ctx, p, t);
  g.fx.draw(ctx);
  g.fx.drawTexts(ctx);

  // screen-space overlays (HUD uses plain world mapping, no camera)
  ctx.setTransform(q * scale, 0, 0, q * scale, q * g.offX, q * g.offY);
  drawIndicators(ctx, g);

  // danger vignette when the player is out of view
  if (g.player.state === "alive" && g.dangerA > 0.01) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const gr = ctx.createRadialGradient(ctx.canvas.width / 2, ctx.canvas.height / 2, Math.min(cw, ch) * q * 0.35, ctx.canvas.width / 2, ctx.canvas.height / 2, Math.max(cw, ch) * q * 0.75);
    gr.addColorStop(0, "rgba(255,30,60,0)");
    gr.addColorStop(1, `rgba(255,30,60,${0.5 * g.dangerA})`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(q * scale, 0, 0, q * scale, q * g.offX, q * g.offY);
  }

  drawHUD(ctx, g);
  drawBanner(ctx, g);

  // full-screen flash
  if (g.flashA > 0.01) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = Math.min(1, g.flashA);
    ctx.fillStyle = g.flashColor;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.globalAlpha = 1;
  }
}
