// All procedural vector art: items, chefs, rats, kitchen tiles.
import { COL, FONT, HOLES, MAP_H, MAP_W, T, type Hero, type ItemId } from './config';
import type { Chef, Item, Rat, Tile } from './types';

const TAU = Math.PI * 2;

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function circ(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}

export function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  fill: string,
  align: CanvasTextAlign = 'center',
  stroke: string | null = COL.ink,
  sw = 4,
) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (stroke) {
    ctx.lineWidth = sw;
    ctx.strokeStyle = stroke;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}

// ---------------------------------------------------------------------------
// Items (unit radius ≈ 18)
// ---------------------------------------------------------------------------
export function drawItemIcon(ctx: CanvasRenderingContext2D, id: ItemId, x: number, y: number, r = 18) {
  ctx.save();
  ctx.translate(x, y);
  const s = r / 18;
  ctx.scale(s, s);
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (id) {
    case 'bun': {
      ctx.fillStyle = '#f6c56e';
      ctx.strokeStyle = '#7a4414';
      rr(ctx, -16, 2, 32, 12, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ea9a33';
      ctx.beginPath();
      ctx.ellipse(0, 3, 17, 14, 0, Math.PI, TAU);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath();
      ctx.ellipse(-6, -6, 6, 3, -0.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff3cf';
      for (const [sx, sy, rot] of [
        [-6, -2, 0.3],
        [2, -8, -0.4],
        [8, -3, 0.6],
        [-1, 0, -0.2],
      ]) {
        ctx.beginPath();
        ctx.ellipse(sx, sy, 2.4, 1.3, rot, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'patty_raw':
    case 'patty_cooked': {
      const raw = id === 'patty_raw';
      ctx.fillStyle = raw ? '#ee6f84' : '#8d4b26';
      ctx.strokeStyle = raw ? '#92263c' : '#40200d';
      ctx.beginPath();
      ctx.ellipse(0, 1, 16, 13, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (raw) {
        ctx.fillStyle = '#ffb3c0';
        for (const [sx, sy] of [
          [-6, -3],
          [5, -5],
          [3, 4],
          [-7, 5],
        ]) {
          ctx.beginPath();
          ctx.ellipse(sx, sy, 3.2, 1.8, 0.5, 0, TAU);
          ctx.fill();
        }
      } else {
        ctx.strokeStyle = '#3b1c0b';
        ctx.lineWidth = 2.6;
        for (const o of [-7, 0, 7]) {
          ctx.beginPath();
          ctx.moveTo(o - 4, -8);
          ctx.lineTo(o + 4, 10);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,255,255,.28)';
        ctx.beginPath();
        ctx.ellipse(-6, -6, 5, 2.4, -0.5, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'lettuce_raw': {
      ctx.fillStyle = '#74d94c';
      ctx.strokeStyle = '#2c7a1b';
      for (const [cx, cy, rad] of [
        [-8, 3, 9],
        [8, 3, 9],
        [0, 7, 9],
        [0, -4, 11],
      ]) {
        circ(ctx, cx, cy, rad);
        ctx.fill();
        ctx.stroke();
      }
      ctx.strokeStyle = '#b9f59b';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(0, -8);
      ctx.moveTo(0, 1);
      ctx.lineTo(-6, -3);
      ctx.moveTo(0, 1);
      ctx.lineTo(6, -3);
      ctx.stroke();
      break;
    }
    case 'lettuce_chop': {
      ctx.fillStyle = '#79e04f';
      ctx.strokeStyle = '#2c7a1b';
      ctx.lineWidth = 1.6;
      for (const [cx, cy, rot, w] of [
        [-8, -6, 0.5, 10],
        [6, -8, -0.4, 11],
        [-3, 0, 1.2, 12],
        [9, 2, 0.3, 10],
        [-9, 8, -0.7, 10],
        [3, 9, 0.9, 11],
      ]) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        rr(ctx, -w / 2, -2.6, w, 5.2, 2.4);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'tomato_raw': {
      ctx.fillStyle = '#ff4d4d';
      ctx.strokeStyle = '#971a1a';
      circ(ctx, 0, 2, 14.5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.beginPath();
      ctx.ellipse(-6, -4, 4.5, 2.6, -0.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#42c24b';
      ctx.strokeStyle = '#1e7a28';
      ctx.lineWidth = 1.6;
      starPath(ctx, 0, -11, 7, 0.4);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'tomato_chop': {
      for (const [cx, cy] of [
        [-7, 5],
        [7, 5],
        [0, -6],
      ]) {
        ctx.fillStyle = '#ff5757';
        ctx.strokeStyle = '#971a1a';
        circ(ctx, cx, cy, 9);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffb4a6';
        circ(ctx, cx, cy, 5.8);
        ctx.fill();
        ctx.fillStyle = '#ffe48a';
        for (let i = 0; i < 3; i++) {
          const a = (i * TAU) / 3 + 0.5;
          circ(ctx, cx + Math.cos(a) * 3, cy + Math.sin(a) * 3, 1.1);
          ctx.fill();
        }
      }
      break;
    }
    case 'potato_raw': {
      ctx.fillStyle = '#cf9a58';
      ctx.strokeStyle = '#69421a';
      ctx.save();
      ctx.rotate(-0.35);
      ctx.beginPath();
      ctx.ellipse(0, 1, 16, 11.5, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#8c5e2a';
      for (const [sx, sy] of [
        [-6, -2],
        [4, 3],
        [8, -3],
        [-3, 5],
      ]) {
        circ(ctx, sx, sy, 1.5);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      ctx.beginPath();
      ctx.ellipse(-6, -5, 5, 2, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'potato_chop': {
      ctx.fillStyle = '#f5e29a';
      ctx.strokeStyle = '#a78b2b';
      ctx.lineWidth = 1.8;
      for (const [cx, cy, rot] of [
        [-8, -3, 0.2],
        [-1, 2, -0.15],
        [7, -2, 0.35],
        [-4, 9, 0.05],
        [6, 8, -0.3],
      ]) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        rr(ctx, -3.2, -9, 6.4, 18, 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'fries': {
      ctx.fillStyle = '#ffc93c';
      ctx.strokeStyle = '#a56a00';
      ctx.lineWidth = 1.8;
      for (const [cx, rot] of [
        [-9, -0.3],
        [-4, -0.1],
        [1, 0.05],
        [6, 0.2],
        [10, 0.35],
      ]) {
        ctx.save();
        ctx.translate(cx, -4);
        ctx.rotate(rot);
        rr(ctx, -2.8, -11, 5.6, 20, 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#ff4a5c';
      ctx.strokeStyle = '#8a1424';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-13, 0);
      ctx.lineTo(13, 0);
      ctx.lineTo(10, 14);
      ctx.lineTo(-10, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      rr(ctx, -5, 4, 10, 6, 2);
      ctx.fill();
      break;
    }
    case 'burnt': {
      ctx.fillStyle = '#2d2625';
      ctx.strokeStyle = '#0d0a0a';
      ctx.beginPath();
      ctx.ellipse(0, 2, 15, 12, 0.2, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ff7a2a';
      for (const [sx, sy] of [
        [-5, 0],
        [4, 5],
        [6, -4],
      ]) {
        circ(ctx, sx, sy, 1.6);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(180,180,200,.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-3, -10);
      ctx.bezierCurveTo(-8, -14, 2, -16, -2, -21);
      ctx.stroke();
      break;
    }
    case 'plate':
      drawPlate(ctx, 0, 0, 18, []);
      break;
  }
  ctx.restore();
}

const PLATE_SLOTS: Record<number, { p: [number, number][]; s: number }> = {
  1: { p: [[0, 0]], s: 0.78 },
  2: {
    p: [
      [-0.45, 0],
      [0.45, 0],
    ],
    s: 0.58,
  },
  3: {
    p: [
      [-0.42, -0.32],
      [0.42, -0.32],
      [0, 0.42],
    ],
    s: 0.52,
  },
  4: {
    p: [
      [-0.44, -0.4],
      [0.44, -0.4],
      [-0.44, 0.42],
      [0.44, 0.42],
    ],
    s: 0.5,
  },
};

export function drawPlate(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, contents: ItemId[]) {
  const pr = r * 1.12;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath();
  ctx.ellipse(0, 3, pr, pr * 0.85, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#8e9bbd';
  ctx.lineWidth = 2.2;
  circ(ctx, 0, 0, pr);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e8eefc';
  circ(ctx, 0, 0, pr * 0.72);
  ctx.fill();
  ctx.strokeStyle = '#c3cde8';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  const n = Math.min(4, contents.length);
  if (n > 0) {
    const slot = PLATE_SLOTS[n];
    for (let i = 0; i < n; i++) {
      drawItemIcon(ctx, contents[i], slot.p[i][0] * pr * 0.78, slot.p[i][1] * pr * 0.78, pr * slot.s);
    }
  }
  ctx.restore();
}

export function drawItem(ctx: CanvasRenderingContext2D, item: Item, x: number, y: number, r: number) {
  const k = 1 + item.pop * 0.45;
  if (item.id === 'plate') drawPlate(ctx, x, y, r * k, item.plate);
  else drawItemIcon(ctx, item.id, x, y, r * k);
}

// ---------------------------------------------------------------------------
// Chefs
// ---------------------------------------------------------------------------
function chefShape(ctx: CanvasRenderingContext2D, h: Hero, fx: number, fy: number, walk: number, open: boolean, blink: boolean) {
  const bob = Math.sin(walk * 2) * 1.4;
  const step = Math.sin(walk);

  // feet
  ctx.fillStyle = h.dark;
  ctx.strokeStyle = COL.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-8, 19 - Math.max(0, step) * 3, 7, 4.5, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(8, 19 - Math.max(0, -step) * 3, 7, 4.5, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();

  // body
  ctx.fillStyle = h.color;
  ctx.strokeStyle = COL.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, bob * 0.5 - 1, 20, 21, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // sheen
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.beginPath();
  ctx.ellipse(-8, -10 + bob * 0.5, 6, 9, 0.5, 0, TAU);
  ctx.fill();

  // apron
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = h.dark;
  ctx.lineWidth = 1.8;
  rr(ctx, -11, 5 + bob * 0.5, 22, 14, 6);
  ctx.fill();
  ctx.stroke();
  // emblem
  ctx.fillStyle = h.accent;
  ctx.strokeStyle = h.dark;
  ctx.lineWidth = 1.4;
  if (h.id === 'blitz') {
    ctx.beginPath();
    ctx.moveTo(2, 6.5 + bob * 0.5);
    ctx.lineTo(-4, 13 + bob * 0.5);
    ctx.lineTo(0, 13 + bob * 0.5);
    ctx.lineTo(-2, 18 + bob * 0.5);
    ctx.lineTo(5, 11 + bob * 0.5);
    ctx.lineTo(1, 11 + bob * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (h.id === 'zap') {
    starPath(ctx, 0, 12 + bob * 0.5, 6, 0.45);
    ctx.fill();
    ctx.stroke();
  } else {
    circ(ctx, 0, 12 + bob * 0.5, 4);
    ctx.fill();
    ctx.stroke();
  }

  // eyes
  const ex = fx * 2.6;
  const ey = -6 + fy * 1.8 + bob * 0.4;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = COL.ink;
  ctx.lineWidth = 1.8;
  for (const sx of [-7, 7]) {
    ctx.beginPath();
    ctx.ellipse(sx + ex * 0.5, ey, 5.4, blink ? 1.2 : 6.4, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  if (!blink) {
    ctx.fillStyle = COL.ink;
    for (const sx of [-7, 7]) {
      circ(ctx, sx + ex + fx * 1.2, ey + fy * 2.2, 2.7);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    for (const sx of [-7, 7]) {
      circ(ctx, sx + ex + fx * 1.2 - 0.9, ey + fy * 2.2 - 1.2, 0.9);
      ctx.fill();
    }
  }
  // mouth
  ctx.strokeStyle = COL.ink;
  ctx.fillStyle = '#7a1d2e';
  ctx.lineWidth = 2;
  const mx = fx * 2.5;
  const my = 3.5 + fy * 1.2 + bob * 0.4;
  if (open) {
    ctx.beginPath();
    ctx.ellipse(mx, my + 1, 3.6, 3.2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(mx, my - 1, 3.6, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  if (h.id === 'bruno') {
    // moustache
    ctx.fillStyle = '#2b1b12';
    ctx.beginPath();
    ctx.ellipse(mx - 4, my - 3, 4.2, 2.2, -0.3, 0, TAU);
    ctx.ellipse(mx + 4, my - 3, 4.2, 2.2, 0.3, 0, TAU);
    ctx.fill();
  }

  // hat
  const hb = bob * 0.6;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = COL.ink;
  ctx.lineWidth = 2.4;
  for (const [cx, cy, rad] of [
    [-8, -32, 8],
    [8, -32, 8],
    [0, -37, 10],
  ]) {
    circ(ctx, cx, cy + hb, rad);
    ctx.fill();
    ctx.stroke();
  }
  circ(ctx, -8, -32 + hb, 7.2);
  circ(ctx, 8, -32 + hb, 7.2);
  circ(ctx, 0, -37 + hb, 9.2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  rr(ctx, -13, -29 + hb, 26, 10, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = h.accent;
  ctx.fillRect(-12, -23 + hb, 24, 3.2);
  ctx.strokeStyle = COL.ink;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(-12, -23 + hb, 24, 3.2);

  // hands
  ctx.fillStyle = '#ffe2c2';
  ctx.strokeStyle = COL.ink;
  ctx.lineWidth = 2;
  const sw = Math.sin(walk) * 3;
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sgn * 21, 5 + sw * sgn + bob * 0.5, 5, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
}

export function drawChef(ctx: CanvasRenderingContext2D, c: Chef, t: number) {
  const bobY = Math.sin(c.walk * 2) * 1.4;
  // shadow
  ctx.fillStyle = 'rgba(15,18,50,.28)';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 20, 20 * c.sx, 8, 0, 0, TAU);
  ctx.fill();

  const held = c.held;
  const hx = c.x + c.fx * 24;
  const hy = c.y + c.fy * 15 + 2 + bobY;
  const behind = c.fy < -0.35;
  if (held && behind) drawItem(ctx, held, hx, hy - 4, held.id === 'plate' ? 17 : 15);

  ctx.save();
  ctx.translate(c.x, c.y + 20);
  ctx.scale(c.sx, c.sy);
  ctx.translate(0, -20);
  const blink = Math.sin(t * 1.7 + c.idx * 2) > 0.985 || Math.sin(t * 0.9 + c.idx) > 0.996;
  chefShape(ctx, c.hero, c.fx, c.fy, c.walk, c.dashT > 0 || c.chopping || c.kbT > 0, blink);
  ctx.restore();

  if (held && !behind) drawItem(ctx, held, hx, hy + 2, held.id === 'plate' ? 17 : 15);

  if (c.chopping) {
    // little knife flicker
    ctx.save();
    ctx.translate(c.x + c.fx * 30, c.y + c.fy * 18 - 4);
    ctx.rotate(Math.sin(t * 45) * 0.5 - 0.6);
    ctx.fillStyle = '#e8eef9';
    ctx.strokeStyle = COL.ink;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(4, -16);
    ctx.lineTo(10, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7a4a22';
    rr(ctx, -2, 0, 8, 7, 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

/** Static portrait used by menus (origin = centre, feet at +20). */
export function drawChefPortrait(ctx: CanvasRenderingContext2D, hero: Hero, t: number) {
  const walk = t * 5;
  ctx.save();
  chefShape(ctx, hero, Math.sin(t * 1.3) * 0.6, 0.8, walk * 0.4, false, Math.sin(t * 2.1) > 0.97);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Rats
// ---------------------------------------------------------------------------
export function drawRat(ctx: CanvasRenderingContext2D, r: Rat, t: number) {
  const hop = Math.abs(Math.sin(t * 16)) * 3;
  const spawn = Math.min(1, r.born * 3);
  ctx.save();
  if (r.state !== 'flung') {
    ctx.fillStyle = 'rgba(15,18,50,.25)';
    ctx.beginPath();
    ctx.ellipse(r.x, r.y + 8, 13 * spawn, 5, 0, 0, TAU);
    ctx.fill();
  }
  ctx.translate(r.x, r.y - hop - (r.state === 'flung' ? r.hop : 0));
  const heading = r.state === 'flung' ? r.rot : Math.atan2(r.vy, r.vx || 0.001);
  ctx.rotate(heading);
  ctx.scale(spawn, spawn);
  // tail
  ctx.strokeStyle = '#ff9fb4';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-11, 0);
  ctx.bezierCurveTo(-18, 7 * Math.sin(t * 14), -22, -7 * Math.sin(t * 14), -28, 4 * Math.sin(t * 14 + 1));
  ctx.stroke();
  // body
  ctx.fillStyle = '#9096ad';
  ctx.strokeStyle = COL.ink;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 8.5, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // head
  ctx.beginPath();
  ctx.ellipse(11, 0, 7, 6, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // ears
  ctx.fillStyle = '#ffb3c4';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(8, s * 6, 3.6, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  // nose + eyes
  ctx.fillStyle = '#ff7b98';
  circ(ctx, 17.5, 0, 1.8);
  ctx.fill();
  if (r.state === 'flung') {
    ctx.strokeStyle = COL.ink;
    ctx.lineWidth = 1.5;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(11, s * 3 - 1.5);
      ctx.lineTo(14, s * 3 + 1.5);
      ctx.moveTo(14, s * 3 - 1.5);
      ctx.lineTo(11, s * 3 + 1.5);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#ff2f55';
    for (const s of [-1, 1]) {
      circ(ctx, 13.5, s * 2.8, 1.6);
      ctx.fill();
    }
  }
  ctx.restore();
  if (r.carry) {
    drawItem(ctx, r.carry, r.x, r.y - 24 - hop, 10);
  }
}

// ---------------------------------------------------------------------------
// Kitchen: pre-rendered static layer
// ---------------------------------------------------------------------------
const TOPS: Record<string, [string, string]> = {
  counter: ['#8c9dc4', '#566591'],
  crate: ['#8c9dc4', '#566591'],
  board: ['#8c9dc4', '#566591'],
  stove: ['#474c68', '#2b2f47'],
  plates: ['#8c9dc4', '#566591'],
  window: ['#ffd36b', '#d98a2b'],
  trash: ['#7b839f', '#4c5370'],
};

function counterBase(ctx: CanvasRenderingContext2D, x: number, y: number, below: boolean, type: string) {
  const [top, side] = TOPS[type] ?? TOPS.counter;
  const faceH = below ? 0 : 11;
  ctx.fillStyle = top;
  ctx.fillRect(x, y, T, T - faceH);
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  ctx.fillRect(x, y, T, 3);
  ctx.strokeStyle = 'rgba(20,28,70,.28)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, T - 2, T - faceH - 2);
  if (faceH) {
    ctx.fillStyle = side;
    ctx.fillRect(x, y + T - faceH, T, faceH);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(x, y + T - 3, T, 3);
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.fillRect(x, y + T - faceH, T, 2);
  }
}

export function buildStatic(tiles: Tile[][], k: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(MAP_W * k);
  cv.height = Math.ceil(MAP_H * k);
  const ctx = cv.getContext('2d')!;
  ctx.scale(k, k);

  const rows = tiles.length;
  const cols = tiles[0].length;

  // floor
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#f6e8c9' : '#efdcb6';
      ctx.fillRect(c * T, r * T, T, T);
    }
  }
  // ambient occlusion under counters
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (tiles[r][c].type === 'floor' && tiles[r - 1][c].type !== 'floor') {
        const g = ctx.createLinearGradient(0, r * T, 0, r * T + 16);
        g.addColorStop(0, 'rgba(60,40,20,.22)');
        g.addColorStop(1, 'rgba(60,40,20,0)');
        ctx.fillStyle = g;
        ctx.fillRect(c * T, r * T, T, 16);
      }
    }
  }
  // mouse holes
  for (const [c, r] of HOLES) {
    const cx = c * T + T / 2;
    const cy = r * T + T / 2 + 4;
    ctx.fillStyle = '#9c7a4d';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 19, 11, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1d1424';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 1, 15, 8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy - 3, 7, 2, 0, 0, TAU);
    ctx.fill();
  }

  // counters & stations
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = tiles[r][c];
      if (t.type === 'floor') continue;
      const x = c * T;
      const y = r * T;
      const below = r + 1 < rows && tiles[r + 1][c].type !== 'floor';
      counterBase(ctx, x, y, below, t.type);
      const cx = x + T / 2;
      const cy = y + 28;
      switch (t.type) {
        case 'crate': {
          ctx.fillStyle = '#c98a4b';
          ctx.strokeStyle = '#6e3f16';
          ctx.lineWidth = 3;
          rr(ctx, x + 6, y + 7, 52, 42, 7);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#a2652b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + 9, y + 38);
          ctx.lineTo(x + 55, y + 38);
          ctx.moveTo(x + 9, y + 44);
          ctx.lineTo(x + 55, y + 44);
          ctx.stroke();
          ctx.fillStyle = '#e8b27a';
          ctx.fillRect(x + 8, y + 9, 48, 4);
          break;
        }
        case 'board': {
          ctx.fillStyle = '#e4b777';
          ctx.strokeStyle = '#7b4c1f';
          ctx.lineWidth = 3;
          rr(ctx, x + 7, y + 8, 50, 38, 8);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = 'rgba(120,70,20,.35)';
          ctx.lineWidth = 1.6;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(x + 12, y + 17 + i * 10);
            ctx.bezierCurveTo(x + 24, y + 13 + i * 10, x + 40, y + 21 + i * 10, x + 52, y + 17 + i * 10);
            ctx.stroke();
          }
          // knife
          ctx.save();
          ctx.translate(x + 51, y + 40);
          ctx.rotate(-0.7);
          ctx.fillStyle = '#e9eefa';
          ctx.strokeStyle = COL.ink;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(-3, 0);
          ctx.lineTo(-3, -13);
          ctx.quadraticCurveTo(4, -9, 4, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#6b3e1b';
          rr(ctx, -3, 0, 7, 8, 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'stove': {
          ctx.fillStyle = '#1c1f33';
          ctx.strokeStyle = '#6e7596';
          ctx.lineWidth = 3;
          circ(ctx, cx, cy, 23);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#3a4060';
          ctx.lineWidth = 2;
          circ(ctx, cx, cy, 15);
          ctx.stroke();
          // pan
          ctx.fillStyle = '#5a617f';
          ctx.strokeStyle = COL.ink;
          ctx.lineWidth = 2.4;
          circ(ctx, cx, cy, 18);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#2f3450';
          circ(ctx, cx, cy, 13.5);
          ctx.fill();
          ctx.fillStyle = '#5a617f';
          rr(ctx, x + 1, cy - 3.5, 12, 7, 3);
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'plates': {
          for (let i = 0; i < 4; i++) {
            const py = cy + 6 - i * 3.5;
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#8e9bbd';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(cx, py, 21, 17, 0, 0, TAU);
            ctx.fill();
            ctx.stroke();
          }
          ctx.fillStyle = '#e8eefc';
          ctx.beginPath();
          ctx.ellipse(cx, cy - 8, 13, 10, 0, 0, TAU);
          ctx.fill();
          break;
        }
        case 'window': {
          ctx.strokeStyle = '#ff7a2f';
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 6]);
          rr(ctx, x + 5, y + 5, T - 10, T - 21, 8);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#ff7a2f';
          for (const o of [-9, 7]) {
            ctx.beginPath();
            ctx.moveTo(cx + o - 7, cy - 12);
            ctx.lineTo(cx + o + 5, cy);
            ctx.lineTo(cx + o - 7, cy + 12);
            ctx.lineTo(cx + o - 2, cy);
            ctx.closePath();
            ctx.fill();
          }
          break;
        }
        case 'trash': {
          ctx.fillStyle = '#242842';
          ctx.strokeStyle = COL.ink;
          ctx.lineWidth = 3;
          circ(ctx, cx, cy + 2, 23);
          ctx.fill();
          ctx.stroke();
          break;
        }
        default:
          break;
      }
    }
  }
  return cv;
}

export function drawTrashLid(ctx: CanvasRenderingContext2D, x: number, y: number, open: number, t: number) {
  const cx = x + T / 2;
  const cy = y + 26 - open * 12;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(open * -0.5 + Math.sin(t * 40) * 0.05 * open);
  ctx.fillStyle = '#9aa3c2';
  ctx.strokeStyle = COL.ink;
  ctx.lineWidth = 3;
  circ(ctx, 0, 0, 23);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#b8c0dc';
  circ(ctx, 0, -2, 17);
  ctx.fill();
  ctx.fillStyle = '#6a7394';
  rr(ctx, -7, -5, 14, 6, 3);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

