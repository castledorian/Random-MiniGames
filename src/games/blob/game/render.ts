import { COLS, VISIBLE, HIDDEN, SPAWN_COL, GARBAGE, FONT, PALETTE, palFor, type Hero } from './constants';
import type { Board } from './board';
import { glowSprite } from './fx';
import { t } from './i18n';

export function formatNum(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function txt(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = 'left',
  maxW?: number,
  weight = 700
) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  if (maxW) ctx.fillText(s, x, y, maxW);
  else ctx.fillText(s, x, y);
}

export function outlineTxt(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  stroke = 'rgba(20,8,50,0.95)'
) {
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.18);
  ctx.strokeStyle = stroke;
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

// ---------------------------------------------------------------- sprites
const spriteCache = new Map<string, HTMLCanvasElement>();

export function blobSprite(c: number, S: number): HTMLCanvasElement {
  const key = `${c}:${S}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const x = cv.getContext('2d')!;
  const pal = palFor(c);
  const cx = S / 2;
  const cy = S / 2 + S * 0.01;
  const r = S * 0.465;

  // soft contact shadow
  x.fillStyle = 'rgba(0,0,0,0.18)';
  x.beginPath();
  x.ellipse(cx, cy + r * 0.12, r * 1.0, r * 0.98, 0, 0, Math.PI * 2);
  x.fill();

  const g = x.createRadialGradient(cx - r * 0.32, cy - r * 0.38, r * 0.08, cx, cy, r * 1.05);
  g.addColorStop(0, pal.light);
  g.addColorStop(0.42, pal.base);
  g.addColorStop(1, pal.dark);
  x.fillStyle = g;
  x.beginPath();
  x.arc(cx, cy, r, 0, Math.PI * 2);
  x.fill();
  x.lineWidth = Math.max(1, S * 0.03);
  x.strokeStyle = 'rgba(20,6,40,0.55)';
  x.stroke();

  // highlight
  x.fillStyle = 'rgba(255,255,255,0.6)';
  x.beginPath();
  x.ellipse(cx - r * 0.38, cy - r * 0.52, r * 0.3, r * 0.16, -0.55, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = 'rgba(255,255,255,0.35)';
  x.beginPath();
  x.arc(cx + r * 0.52, cy + r * 0.5, r * 0.07, 0, Math.PI * 2);
  x.fill();

  if (c === GARBAGE) {
    // sleepy eyes
    x.strokeStyle = 'rgba(40,40,80,0.8)';
    x.lineWidth = Math.max(1.2, S * 0.045);
    x.lineCap = 'round';
    for (const sx of [-1, 1]) {
      x.beginPath();
      x.arc(cx + sx * r * 0.36, cy + r * 0.02, r * 0.17, 0.15 * Math.PI, 0.85 * Math.PI);
      x.stroke();
    }
  } else {
    for (const sx of [-1, 1]) {
      const ex = cx + sx * r * 0.36;
      const ey = cy + r * 0.04;
      x.fillStyle = '#fff';
      x.beginPath();
      x.ellipse(ex, ey, r * 0.23, r * 0.28, 0, 0, Math.PI * 2);
      x.fill();
      x.lineWidth = Math.max(1, S * 0.02);
      x.strokeStyle = 'rgba(20,6,40,0.5)';
      x.stroke();
      x.fillStyle = '#1b0b33';
      x.beginPath();
      x.ellipse(ex - sx * r * 0.02, ey + r * 0.06, r * 0.13, r * 0.17, 0, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = '#fff';
      x.beginPath();
      x.arc(ex - r * 0.04, ey - r * 0.04, r * 0.05, 0, Math.PI * 2);
      x.fill();
    }
  }
  spriteCache.set(key, cv);
  return cv;
}

// ---------------------------------------------------------------- hero faces
export type Mood = 'idle' | 'happy' | 'hurt' | 'ko';

function flame(ctx: CanvasRenderingContext2D, cx: number, base: number, w: number, h: number, sway: number) {
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, base);
  ctx.quadraticCurveTo(cx - w / 2, base - h * 0.55, cx + sway, base - h);
  ctx.quadraticCurveTo(cx + w / 2, base - h * 0.55, cx + w / 2, base);
  ctx.closePath();
}

export function drawHeroFace(ctx: CanvasRenderingContext2D, hero: Hero, cx: number, cy: number, r: number, mood: Mood, time: number) {
  ctx.save();
  ctx.translate(cx, cy + Math.sin(time * 3 + hero.name.length) * r * 0.03);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const dark = '#2a1245';
  const lw = Math.max(1, r * 0.06);

  // accessory (behind body)
  switch (hero.id) {
    case 'ember': {
      const hs = [0.8, 1.15, 0.72];
      const xs = [-0.4, 0, 0.4];
      for (let i = 0; i < 3; i++) {
        const sway = Math.sin(time * 9 + i * 1.7) * r * 0.08;
        flame(ctx, xs[i] * r, -r * 0.6, r * 0.5, hs[i] * r, sway);
        ctx.fillStyle = '#ff5a1f';
        ctx.fill();
        flame(ctx, xs[i] * r, -r * 0.62, r * 0.28, hs[i] * r * 0.6, sway * 0.7);
        ctx.fillStyle = '#ffd23f';
        ctx.fill();
      }
      break;
    }
    case 'marina': {
      ctx.fillStyle = hero.light;
      ctx.strokeStyle = dark;
      ctx.lineWidth = lw;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * r * 0.8, -r * 0.25);
        ctx.lineTo(s * r * 1.4, -r * 0.55 + Math.sin(time * 4) * r * 0.05);
        ctx.lineTo(s * r * 1.15, r * 0.15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.5);
      ctx.bezierCurveTo(r * 0.5, -r * 1.05, r * 0.4, -r * 0.7, 0, -r * 0.7);
      ctx.bezierCurveTo(-r * 0.4, -r * 0.7, -r * 0.5, -r * 1.05, 0, -r * 1.5);
      ctx.fillStyle = '#8fe0ff';
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'volt': {
      const pts = [-0.62, -0.62, -0.5, -1.38, -0.2, -0.98, 0, -1.55, 0.2, -0.98, 0.5, -1.38, 0.62, -0.62];
      ctx.beginPath();
      ctx.moveTo(pts[0] * r, pts[1] * r);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * r, pts[i + 1] * r);
      ctx.closePath();
      ctx.fillStyle = '#fff3a0';
      ctx.fill();
      ctx.strokeStyle = dark;
      ctx.lineWidth = lw;
      ctx.stroke();
      break;
    }
    default: {
      ctx.strokeStyle = '#1d7a36';
      ctx.lineWidth = lw * 1.4;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.7);
      ctx.quadraticCurveTo(r * 0.05, -r * 1.0, 0, -r * 1.2);
      ctx.stroke();
      const wig = Math.sin(time * 3) * 0.12;
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * r * 0.05, -r * 1.2);
        ctx.rotate(s * (0.65 + wig));
        ctx.fillStyle = '#6cf08a';
        ctx.strokeStyle = '#1d7a36';
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.ellipse(s * r * 0.3, 0, r * 0.38, r * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      // mossy side bumps
      ctx.fillStyle = hero.dark;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * r * 0.92, r * 0.1, r * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // body
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.45, r * 0.1, 0, 0, r * 1.15);
  g.addColorStop(0, hero.light);
  g.addColorStop(0.45, hero.color);
  g.addColorStop(1, hero.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.05, r, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = lw * 1.2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.42, -r * 0.55, r * 0.26, r * 0.13, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // cheeks
  ctx.fillStyle = 'rgba(255,90,130,0.38)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * r * 0.58, r * 0.28, r * 0.13, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // eyes
  const blink = (time * 0.9 + hero.name.length) % 3.7 < 0.11;
  ctx.strokeStyle = dark;
  ctx.lineWidth = lw * 1.3;
  for (const s of [-1, 1]) {
    const ex = s * r * 0.36;
    const ey = -r * 0.1;
    if (mood === 'happy') {
      ctx.beginPath();
      ctx.arc(ex, ey + r * 0.1, r * 0.2, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else if (mood === 'hurt') {
      ctx.beginPath();
      ctx.moveTo(ex - s * r * 0.18, ey - r * 0.14);
      ctx.lineTo(ex + s * r * 0.12, ey);
      ctx.lineTo(ex - s * r * 0.18, ey + r * 0.14);
      ctx.stroke();
    } else if (mood === 'ko') {
      ctx.beginPath();
      ctx.moveTo(ex - r * 0.14, ey - r * 0.14);
      ctx.lineTo(ex + r * 0.14, ey + r * 0.14);
      ctx.moveTo(ex + r * 0.14, ey - r * 0.14);
      ctx.lineTo(ex - r * 0.14, ey + r * 0.14);
      ctx.stroke();
    } else if (blink) {
      ctx.beginPath();
      ctx.moveTo(ex - r * 0.18, ey + r * 0.04);
      ctx.lineTo(ex + r * 0.18, ey + r * 0.04);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(ex, ey, r * 0.22, r * 0.27, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = lw * 0.6;
      ctx.stroke();
      ctx.fillStyle = '#1b0b33';
      ctx.beginPath();
      ctx.ellipse(ex - s * r * 0.02 + Math.sin(time * 1.3) * r * 0.03, ey + r * 0.05, r * 0.12, r * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex - r * 0.04, ey - r * 0.05, r * 0.045, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = lw * 1.3;
    }
  }

  // mouth
  ctx.strokeStyle = dark;
  ctx.lineWidth = lw * 1.2;
  if (mood === 'happy') {
    ctx.fillStyle = '#5a1030';
    ctx.beginPath();
    ctx.arc(0, r * 0.26, r * 0.24, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff7a9c';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.45, r * 0.12, r * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (mood === 'hurt' || mood === 'ko') {
    ctx.beginPath();
    ctx.arc(0, r * 0.52, r * 0.15, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, r * 0.2, r * 0.17, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBolt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + s * 0.15, y - s * 0.55);
  ctx.lineTo(x - s * 0.3, y + s * 0.08);
  ctx.lineTo(x - s * 0.02, y + s * 0.08);
  ctx.lineTo(x - s * 0.15, y + s * 0.55);
  ctx.lineTo(x + s * 0.32, y - s * 0.12);
  ctx.lineTo(x + s * 0.04, y - s * 0.12);
  ctx.closePath();
  ctx.fill();
}

// ---------------------------------------------------------------- background
let bgCache: { w: number; h: number; dpr: number; cv: HTMLCanvasElement } | null = null;
const STARS = Array.from({ length: 70 }, (_, i) => ({
  x: (Math.sin(i * 12.9898) * 43758.5453) % 1,
  y: (Math.sin(i * 78.233) * 24634.6345) % 1,
  s: 0.6 + ((i * 37) % 10) / 10,
  p: i * 0.7,
}));
const ORBS = [
  { rgb: PALETTE[1].rgb, sx: 0.13, sy: 0.17, px: 0.2, py: 1.3, r: 0.38 },
  { rgb: PALETTE[3].rgb, sx: 0.11, sy: 0.14, px: 2.1, py: 0.4, r: 0.45 },
  { rgb: PALETTE[5].rgb, sx: 0.09, sy: 0.12, px: 4.2, py: 2.7, r: 0.5 },
  { rgb: PALETTE[2].rgb, sx: 0.15, sy: 0.1, px: 5.1, py: 3.9, r: 0.3 },
  { rgb: PALETTE[4].rgb, sx: 0.1, sy: 0.16, px: 3.3, py: 5.2, r: 0.28 },
];

export function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number, dpr: number, time: number, pulse: number) {
  if (!bgCache || bgCache.w !== W || bgCache.h !== H || bgCache.dpr !== dpr) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.floor(W * dpr));
    cv.height = Math.max(1, Math.floor(H * dpr));
    const x = cv.getContext('2d')!;
    x.scale(dpr, dpr);
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1c1050');
    g.addColorStop(0.55, '#150b3d');
    g.addColorStop(1, '#09051f');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    // perspective-ish floor grid
    x.strokeStyle = 'rgba(160,120,255,0.07)';
    x.lineWidth = 1;
    const hy = H * 0.62;
    for (let i = -12; i <= 12; i++) {
      x.beginPath();
      x.moveTo(W / 2 + i * W * 0.02, hy);
      x.lineTo(W / 2 + i * W * 0.2, H);
      x.stroke();
    }
    for (let i = 1; i < 9; i++) {
      const yy = hy + Math.pow(i / 9, 2.2) * (H - hy);
      x.beginPath();
      x.moveTo(0, yy);
      x.lineTo(W, yy);
      x.stroke();
    }
    const v = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,10,0.55)');
    x.fillStyle = v;
    x.fillRect(0, 0, W, H);
    bgCache = { w: W, h: H, dpr, cv };
  }
  ctx.drawImage(bgCache.cv, 0, 0, W, H);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const m = Math.max(W, H);
  for (const o of ORBS) {
    const x = W * (0.5 + 0.42 * Math.sin(time * o.sx + o.px));
    const y = H * (0.5 + 0.4 * Math.sin(time * o.sy + o.py));
    const r = m * o.r;
    ctx.globalAlpha = 0.13 + pulse * 0.12;
    ctx.drawImage(glowSprite(o.rgb), x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  for (const s of STARS) {
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(time * 0.8 + s.p));
    ctx.globalAlpha = tw * 0.55;
    const px = (Math.abs(s.x) * W) | 0;
    const py = (Math.abs(s.y) * H * 0.7) | 0;
    ctx.fillRect(px, py, s.s, s.s);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- board
export interface BoardViewOpts {
  dpr: number;
  time: number;
  ghost: boolean;
  mini: boolean;
}

export function boardRect(bx: number, by: number, c: number) {
  const strip = c * 1.1;
  const pad = c * 0.22;
  return { x: bx - pad, y: by - strip - pad, w: COLS * c + pad * 2, h: VISIBLE * c + strip + pad * 2, strip, pad };
}

export function drawBoardView(ctx: CanvasRenderingContext2D, bd: Board, bx0: number, by: number, c: number, o: BoardViewOpts) {
  const Wd = COLS * c;
  const Hd = VISIBLE * c;
  const { strip, pad } = boardRect(bx0, by, c);
  const hero = bd.hero;
  const bx = bx0 + (bd.hurt > 0 ? Math.sin(o.time * 70) * bd.hurt * c * 0.07 : 0);
  const S = Math.max(8, Math.round(c * o.dpr));
  const clearP = bd.state === 'clearing' ? Math.min(1, bd.stateT / bd.clearDur) : 0;

  ctx.save();
  // panel
  rrect(ctx, bx - pad, by - strip - pad, Wd + pad * 2, Hd + strip + pad * 2, c * 0.38);
  const pg = ctx.createLinearGradient(0, by - strip, 0, by + Hd);
  pg.addColorStop(0, 'rgba(26,16,64,0.88)');
  pg.addColorStop(1, 'rgba(10,6,34,0.9)');
  ctx.fillStyle = pg;
  ctx.fill();
  const glow = Math.min(1, bd.happy * 0.8 + bd.danger * 0.6);
  ctx.lineWidth = Math.max(1.5, c * 0.07);
  ctx.strokeStyle = bd.danger > 0.3 ? `rgba(255,70,100,${0.5 + 0.4 * Math.sin(o.time * 9)})` : `rgba(${hero.rgb},${0.45 + glow * 0.5})`;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.rect(bx, by - strip, Wd, Hd + strip);
  ctx.clip();

  // stripes and spawn zone
  ctx.fillStyle = 'rgba(255,255,255,0.028)';
  for (let x = 0; x < COLS; x += 2) ctx.fillRect(bx + x * c, by, c, Hd);
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  ctx.fillRect(bx, by - strip, Wd, strip);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(bx, by - 1, Wd, 2);

  // danger glow
  if (bd.danger > 0.02) {
    ctx.fillStyle = `rgba(255,40,80,${bd.danger * (0.06 + 0.06 * Math.sin(o.time * 8))})`;
    ctx.fillRect(bx, by, Wd, Hd);
  }
  // X marker (death cell)
  {
    const xx = bx + SPAWN_COL * c + c * 0.28;
    const yy = by + c * 0.28;
    ctx.strokeStyle = `rgba(255,90,120,${0.28 + bd.danger * 0.5})`;
    ctx.lineWidth = Math.max(1.5, c * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(xx, yy);
    ctx.lineTo(xx + c * 0.44, yy + c * 0.44);
    ctx.moveTo(xx + c * 0.44, yy);
    ctx.lineTo(xx, yy + c * 0.44);
    ctx.stroke();
  }

  // garbage indicator (behind blobs)
  if (bd.pending > 0) {
    let n = bd.pending;
    const stars = Math.floor(n / 30);
    n -= stars * 30;
    const rocks = Math.floor(n / 6);
    const smalls = n - rocks * 6;
    const icons: number[] = [];
    for (let i = 0; i < stars; i++) icons.push(30);
    for (let i = 0; i < rocks; i++) icons.push(6);
    for (let i = 0; i < smalls; i++) icons.push(1);
    const cy = by - strip + c * 0.33;
    const maxIcons = 6;
    const bounce = 1 + Math.sin(o.time * 10) * 0.05 * Math.min(1, bd.pending / 6);
    for (let i = 0; i < Math.min(icons.length, maxIcons); i++) {
      const ix = bx + c * 0.45 + i * c * 0.55;
      const kind = icons[i];
      const sz = (kind === 30 ? 0.62 : kind === 6 ? 0.5 : 0.34) * c * bounce;
      if (kind === 30) {
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const rr = k % 2 === 0 ? sz : sz * 0.45;
          const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
          ctx.lineTo(ix + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        const sp = blobSprite(GARBAGE, S);
        ctx.drawImage(sp, ix - sz, cy - sz, sz * 2, sz * 2);
      }
    }
    ctx.font = `700 ${c * 0.46}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff7a95';
    ctx.fillText(`${bd.pending}`, bx + Wd - c * 0.12, cy);
  }

  // settled blobs: sprites
  for (let i = 0; i < bd.g.length; i++) {
    const b = bd.g[i];
    if (!b) continue;
    const row = (i / COLS) | 0;
    const col = i - row * COLS;
    if (b.vy < HIDDEN - 1.2) continue;
    const x = bx + col * c;
    const y = by + (b.vy - HIDDEN) * c;
    let sx = 1;
    let sy = 1;
    let alpha = 1;
    if (b.sq > 0) {
      sy = 1 - 0.22 * b.sq;
      sx = 1 + 0.16 * b.sq;
    } else if (b.vy < row - 0.01 && b.vel > 0) {
      sy = 1 + Math.min(0.16, b.vel * 0.011);
      sx = 1 / sy;
    }
    if (b.pop) {
      if (clearP < 0.6) {
        const k = clearP / 0.6;
        const s = 1 + 0.1 * Math.sin(k * Math.PI);
        sx *= s;
        sy *= s;
      } else {
        const k = (clearP - 0.6) / 0.4;
        const s = 1 - k * 0.85;
        sx *= s * (1 + k * 0.3);
        sy *= s;
        alpha = 1 - k;
      }
    }
    const w = c * sx;
    const h = c * sy;
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(blobSprite(b.c, S), x + (c - w) / 2, y + (c - h), w, h);
    if (b.flash > 0.01 || (b.pop && clearP < 0.6 && Math.floor(clearP * 9) % 2 === 0)) {
      const fa = b.pop ? 0.65 : b.flash * 0.5;
      ctx.globalAlpha = alpha * fa;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + c / 2, y + c - h / 2, c * 0.44 * Math.max(sx, sy), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // bridges between connected blobs
  ctx.lineCap = 'butt';
  ctx.lineWidth = c * 0.5;
  for (let i = 0; i < bd.g.length; i++) {
    const b = bd.g[i];
    if (!b || b.c === GARBAGE || b.pop) continue;
    const row = (i / COLS) | 0;
    const col = i - row * COLS;
    if (row < HIDDEN || Math.abs(b.vy - row) > 0.01 || b.sq > 0.4) continue;
    const x = bx + (col + 0.5) * c;
    const y = by + (row - HIDDEN + 0.5) * c;
    if (col < COLS - 1) {
      const r = bd.g[i + 1];
      if (r && r.c === b.c && !r.pop && Math.abs(r.vy - row) < 0.01 && r.sq <= 0.4) {
        ctx.strokeStyle = palFor(b.c).base;
        ctx.beginPath();
        ctx.moveTo(x + c * 0.3, y);
        ctx.lineTo(x + c * 0.7, y);
        ctx.stroke();
      }
    }
    if (row < 13) {
      const d = bd.g[i + COLS];
      if (d && d.c === b.c && !d.pop && Math.abs(d.vy - (row + 1)) < 0.01 && d.sq <= 0.4) {
        ctx.strokeStyle = palFor(b.c).base;
        ctx.beginPath();
        ctx.moveTo(x, y + c * 0.3);
        ctx.lineTo(x, y + c * 0.7);
        ctx.stroke();
      }
    }
  }

  // ghost + active piece
  const p = bd.piece;
  if (p && bd.state === 'falling') {
    if (o.ghost) {
      const gh = bd.ghost();
      if (gh) {
        for (const cell of gh) {
          const gx = bx + (cell.x + 0.5) * c;
          const gy = by + (cell.y - HIDDEN + 0.5) * c;
          const pal = palFor(cell.c);
          ctx.fillStyle = `rgba(${pal.rgb},0.2)`;
          ctx.strokeStyle = `rgba(${pal.rgb},0.85)`;
          ctx.lineWidth = Math.max(1.5, c * 0.06);
          ctx.beginPath();
          ctx.arc(gx, gy, c * 0.36, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    }
    const k = Math.min(1, p.age / 0.12);
    const s = (0.6 + 0.4 * k) * (p.lock > 0 ? 1 + Math.sin(p.lock * 38) * 0.035 : 1);
    const px = bx + (p.vx + 0.5) * c;
    const py = by + (p.y + p.fall - HIDDEN + 0.5) * c;
    const sx = px + Math.cos(p.ang) * c * s;
    const sy = py + Math.sin(p.ang) * c * s;
    ctx.drawImage(blobSprite(p.a, S), px - (c * s) / 2, py - (c * s) / 2, c * s, c * s);
    ctx.drawImage(blobSprite(p.b, S), sx - (c * s) / 2, sy - (c * s) / 2, c * s, c * s);
    // bridge
    const dx = sx - px;
    const dy = sy - py;
    const len = Math.hypot(dx, dy) || 1;
    ctx.lineWidth = c * 0.5 * s;
    ctx.strokeStyle = palFor(p.a === p.b ? p.a : p.a).base;
    // two-tone bridge: half each
    const mx = px + dx * 0.5;
    const my = py + dy * 0.5;
    ctx.strokeStyle = palFor(p.a).base;
    ctx.beginPath();
    ctx.moveTo(px + (dx / len) * c * 0.3 * s, py + (dy / len) * c * 0.3 * s);
    ctx.lineTo(mx, my);
    ctx.stroke();
    ctx.strokeStyle = palFor(p.b).base;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(px + (dx / len) * c * 0.7 * s, py + (dy / len) * c * 0.7 * s);
    ctx.stroke();
    // pivot marker
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1, c * 0.045);
    ctx.beginPath();
    ctx.arc(px, py + c * 0.02, c * 0.44 * s, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (bd.dead) {
    ctx.fillStyle = `rgba(20,14,50,${Math.min(0.7, bd.deadT * 1.2)})`;
    ctx.fillRect(bx, by - strip, Wd, Hd + strip);
  }
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- side panel
export interface PanelOpts {
  x: number;
  y: number;
  w: number;
  c: number;
  bd: Board;
  name: string;
  time: number;
  dpr: number;
  shownScore: number;
  mood: Mood;
  showNext: boolean;
  hintKey?: string;
}

export function drawPanel(ctx: CanvasRenderingContext2D, o: PanelOpts): number {
  const { x, y, c, bd, time } = o;
  const hero = bd.hero;
  const r = c * 0.58;
  const ax = x + r + c * 0.22;
  const ay = y + r + c * 0.2;
  const ready = bd.energy >= 100;
  const ringR = r + c * 0.14;

  // energy ring
  ctx.save();
  ctx.lineWidth = c * 0.13;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.arc(ax, ay, ringR, 0, Math.PI * 2);
  ctx.stroke();
  if (bd.energy > 0.5) {
    ctx.strokeStyle = hero.color;
    ctx.beginPath();
    ctx.arc(ax, ay, ringR, -Math.PI / 2, -Math.PI / 2 + (Math.min(100, bd.energy) / 100) * Math.PI * 2);
    ctx.stroke();
  }
  if (ready) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 8);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 + pulse * 0.45;
    const gs = ringR * (2.1 + pulse * 0.3);
    ctx.drawImage(glowSprite(hero.rgb), ax - gs, ay - gs, gs * 2, gs * 2);
  }
  ctx.restore();

  drawHeroFace(ctx, hero, ax, ay + r * 0.05, r * 0.92, o.mood, time);

  const tx = ax + ringR + c * 0.22;
  const tw = o.w - (tx - x);
  txt(ctx, o.name, tx, ay - c * 0.27, c * 0.46, '#fff', 'left', tw);
  if (ready) {
    const pulse = 0.65 + 0.35 * Math.sin(time * 8);
    ctx.globalAlpha = pulse;
    drawBolt(ctx, tx + c * 0.13, ay + c * 0.27, c * 0.4, hero.light);
    txt(ctx, t('ready'), tx + c * 0.38, ay + c * 0.27, c * 0.36, hero.light, 'left', tw - c * 0.4);
    ctx.globalAlpha = 1;
  } else {
    drawBolt(ctx, tx + c * 0.13, ay + c * 0.27, c * 0.4, 'rgba(255,255,255,0.45)');
    txt(ctx, `${Math.floor(bd.energy)}%`, tx + c * 0.38, ay + c * 0.27, c * 0.36, 'rgba(255,255,255,0.6)', 'left', tw - c * 0.4);
  }

  let cy = ay + ringR + c * 0.4;
  txt(ctx, t('score'), x + c * 0.1, cy, c * 0.3, 'rgba(255,255,255,0.5)', 'left');
  cy += c * 0.5;
  txt(ctx, formatNum(o.shownScore), x + c * 0.1, cy, c * 0.7, '#fff', 'left', o.w - c * 0.1);
  cy += c * 0.62;

  if (o.showNext) {
    txt(ctx, t('next'), x + c * 0.1, cy, c * 0.3, 'rgba(255,255,255,0.5)', 'left');
    cy += c * 0.25;
    const S1 = Math.max(8, Math.round(c * 0.72 * o.dpr));
    const S2 = Math.max(8, Math.round(c * 0.56 * o.dpr));
    const n1 = bd.queue[0];
    const n2 = bd.queue[1];
    // backdrop pill
    rrect(ctx, x, cy, o.w, c * 1.6, c * 0.3);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    if (n1) {
      const cs = c * 0.72;
      const px = x + c * 0.3;
      ctx.drawImage(blobSprite(n1[1], S1), px, cy + c * 0.1, cs, cs);
      ctx.drawImage(blobSprite(n1[0], S1), px, cy + c * 0.1 + cs * 0.92, cs, cs);
    }
    if (n2) {
      const cs = c * 0.56;
      const px = x + c * 1.45;
      ctx.globalAlpha = 0.8;
      ctx.drawImage(blobSprite(n2[1], S2), px, cy + c * 0.35, cs, cs);
      ctx.drawImage(blobSprite(n2[0], S2), px, cy + c * 0.35 + cs * 0.92, cs, cs);
      ctx.globalAlpha = 1;
    }
    cy += c * 1.6 + c * 0.2;
  }
  return cy;
}

export interface StatLine {
  label: string;
  value: string;
  color?: string;
}

export function drawStats(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, c: number, lines: StatLine[], bar?: { label: string; v: number; rgb: string }): number {
  let cy = y;
  for (const l of lines) {
    txt(ctx, l.label, x + c * 0.1, cy, c * 0.28, 'rgba(255,255,255,0.5)', 'left', w);
    cy += c * 0.42;
    txt(ctx, l.value, x + c * 0.1, cy, c * 0.56, l.color || '#fff', 'left', w - c * 0.1);
    cy += c * 0.66;
  }
  if (bar) {
    txt(ctx, bar.label, x + c * 0.1, cy, c * 0.28, 'rgba(255,255,255,0.5)', 'left', w);
    cy += c * 0.35;
    rrect(ctx, x + c * 0.1, cy, w - c * 0.2, c * 0.3, c * 0.15);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();
    rrect(ctx, x + c * 0.1, cy, Math.max(c * 0.3, (w - c * 0.2) * Math.min(1, Math.max(0, bar.v))), c * 0.3, c * 0.15);
    ctx.fillStyle = `rgb(${bar.rgb})`;
    ctx.fill();
    cy += c * 0.6;
  }
  return cy;
}

/**
 * Panneau compact (3-4 joueurs) au-dessus d'un plateau : visage + jauge de pouvoir,
 * pastille J1…J4, nom, score et pièces suivantes. Hauteur ≈ 2.9 c.
 */
export function drawCompactPanel(
  ctx: CanvasRenderingContext2D,
  o: { x: number; y: number; w: number; c: number; bd: Board; name: string; badge: string; badgeColor: string; time: number; dpr: number; shownScore: number; mood: Mood },
) {
  const { x, y, w, c, bd, time } = o;
  const hero = bd.hero;
  rrect(ctx, x, y, w, c * 2.85, c * 0.3);
  ctx.fillStyle = 'rgba(20,10,50,0.72)';
  ctx.fill();
  ctx.lineWidth = Math.max(2, c * 0.07);
  ctx.strokeStyle = o.badgeColor;
  ctx.stroke();
  const r = c * 0.62;
  const ax = x + c * 0.25 + r;
  const ay = y + c * 1.45;
  const ringR = r + c * 0.12;
  ctx.save();
  ctx.lineWidth = c * 0.13;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.arc(ax, ay, ringR, 0, Math.PI * 2);
  ctx.stroke();
  if (bd.energy > 0.5) {
    ctx.strokeStyle = bd.energy >= 100 ? '#ffe66b' : hero.color;
    ctx.beginPath();
    ctx.arc(ax, ay, ringR, -Math.PI / 2, -Math.PI / 2 + (Math.min(100, bd.energy) / 100) * Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  drawHeroFace(ctx, hero, ax, ay, r * 0.9, o.mood, time);
  // pastille J1…
  const bx = x + c * 0.15;
  const by = y + c * 0.12;
  rrect(ctx, bx, by, c * 0.95, c * 0.48, c * 0.24);
  ctx.fillStyle = o.badgeColor;
  ctx.fill();
  txt(ctx, o.badge, bx + c * 0.475, by + c * 0.25, c * 0.34, '#120a2e', 'center', c * 0.9);
  const tx = ax + ringR + c * 0.2;
  const tw = w - (tx - x) - c * 1.45;
  txt(ctx, o.name, tx, y + c * 0.75, c * 0.42, '#fff', 'left', tw);
  txt(ctx, formatNum(o.shownScore), tx, y + c * 1.45, c * 0.58, '#ffe66b', 'left', tw);
  txt(ctx, bd.energy >= 100 ? t('ready') : `${Math.floor(bd.energy)}%`, tx, y + c * 2.15, c * 0.34, bd.energy >= 100 ? hero.light : 'rgba(255,255,255,0.6)', 'left', tw);
  // pièces suivantes
  const n1 = bd.queue[0];
  const n2 = bd.queue[1];
  const S = Math.max(8, Math.round(c * 0.6 * o.dpr));
  const cs = c * 0.6;
  const px = x + w - c * 1.35;
  if (n1) {
    ctx.drawImage(blobSprite(n1[1], S), px, y + c * 0.35, cs, cs);
    ctx.drawImage(blobSprite(n1[0], S), px, y + c * 0.35 + cs * 0.92, cs, cs);
  }
  if (n2) {
    ctx.globalAlpha = 0.7;
    ctx.drawImage(blobSprite(n2[1], S), px + c * 0.65, y + c * 0.75, cs * 0.8, cs * 0.8);
    ctx.drawImage(blobSprite(n2[0], S), px + c * 0.65, y + c * 0.75 + cs * 0.75, cs * 0.8, cs * 0.8);
    ctx.globalAlpha = 1;
  }
}
