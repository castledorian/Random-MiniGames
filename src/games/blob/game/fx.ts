import { FONT } from './constants';

const glowCache = new Map<string, HTMLCanvasElement>();
export function glowSprite(rgb: string): HTMLCanvasElement {
  let s = glowCache.get(rgb);
  if (s) return s;
  s = document.createElement('canvas');
  s.width = s.height = 64;
  const x = s.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, `rgba(${rgb},1)`);
  g.addColorStop(0.35, `rgba(${rgb},0.5)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  glowCache.set(rgb, s);
  return s;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  rgb: string;
  kind: 0 | 1 | 2 | 3; // glow, star, chunk, streak
  rot: number;
  vr: number;
  grav: number;
  drag: number;
}

interface FloatText {
  x: number;
  y: number;
  vy: number;
  text: string;
  size: number;
  color: string;
  stroke: string;
  life: number;
  max: number;
  pop: boolean;
}

interface Ring {
  x: number;
  y: number;
  max: number;
  life: number;
  dur: number;
  rgb: string;
  w: number;
}

interface Shot {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  t: number;
  dur: number;
  rgb: string;
  size: number;
  trail: number[];
  onArrive: () => void;
}

interface Bolt {
  pts: number[];
  life: number;
  max: number;
  rgb: string;
  w: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class FX {
  parts: Particle[] = [];
  texts: FloatText[] = [];
  rings: Ring[] = [];
  shots: Shot[] = [];
  bolts: Bolt[] = [];
  shakeMag = 0;
  flashA = 0;
  flashRgb = '255,255,255';

  clear() {
    this.parts.length = 0;
    this.texts.length = 0;
    this.rings.length = 0;
    this.shots.length = 0;
    this.bolts.length = 0;
    this.shakeMag = 0;
    this.flashA = 0;
  }

  shake(m: number) {
    this.shakeMag = Math.min(26, Math.max(this.shakeMag, m));
  }

  flash(rgb: string, a: number) {
    this.flashRgb = rgb;
    this.flashA = Math.max(this.flashA, a);
  }

  private add(p: Particle) {
    if (this.parts.length < 900) this.parts.push(p);
  }

  burst(x: number, y: number, rgb: string, n: number, speed: number, size: number, kind: 0 | 1 | 2 | 3 = 0, grav = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * rnd(0.35, 1);
      this.add({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0,
        max: rnd(0.35, 0.8),
        size: size * rnd(0.6, 1.3),
        rgb,
        kind,
        rot: Math.random() * 6.28,
        vr: rnd(-8, 8),
        grav,
        drag: 2.2,
      });
    }
  }

  popBurst(x: number, y: number, rgb: string, c: number, power = 1) {
    this.burst(x, y, rgb, 5 + Math.min(6, c), 260 * power, 0.17, 2, 900);
    this.burst(x, y, '255,255,255', 3, 300 * power, 0.12, 1, 400);
    this.add({ x, y, vx: 0, vy: 0, life: 0, max: 0.35, size: 1.8 * (0.7 + power * 0.3), rgb, kind: 0, rot: 0, vr: 0, grav: 0, drag: 0 });
  }

  ring(x: number, y: number, rgb: string, max: number, dur = 0.5, w = 4) {
    this.rings.push({ x, y, max, life: 0, dur, rgb, w });
  }

  text(x: number, y: number, text: string, size: number, color: string, stroke = 'rgba(20,10,50,0.9)', dur = 1, vy = -40, pop = true) {
    this.texts.push({ x, y, vy, text, size, color, stroke, life: 0, max: dur, pop });
  }

  shot(x0: number, y0: number, x1: number, y1: number, rgb: string, n: number, onArrive: () => void) {
    const mx = (x0 + x1) / 2;
    const my = Math.min(y0, y1) - 60 - Math.abs(x1 - x0) * 0.25;
    this.shots.push({
      x0,
      y0,
      cx: mx,
      cy: my,
      x1,
      y1,
      t: 0,
      dur: 0.55 + Math.min(0.3, Math.hypot(x1 - x0, y1 - y0) / 2400),
      rgb,
      size: 0.5 + Math.min(1, Math.log2(n + 1) / 5),
      trail: [],
      onArrive,
    });
  }

  bolt(x0: number, y0: number, x1: number, y1: number, rgb: string, w = 3, jag = 18) {
    const pts = [x0, y0];
    const segs = 7;
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      pts.push(x0 + (x1 - x0) * t + rnd(-jag, jag), y0 + (y1 - y0) * t + rnd(-jag, jag));
    }
    pts.push(x1, y1);
    this.bolts.push({ pts, life: 0, max: rnd(0.14, 0.26), rgb, w });
  }

  update(dt: number) {
    this.shakeMag *= Math.exp(-dt * 9);
    if (this.shakeMag < 0.15) this.shakeMag = 0;
    this.flashA = Math.max(0, this.flashA - dt * 2.8);

    const ps = this.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life += dt;
      if (p.life >= p.max) {
        ps[i] = ps[ps.length - 1];
        ps.pop();
        continue;
      }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d + p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    const ts = this.texts;
    for (let i = ts.length - 1; i >= 0; i--) {
      const t = ts[i];
      t.life += dt;
      t.y += t.vy * dt;
      t.vy *= Math.exp(-dt * 2.5);
      if (t.life >= t.max) ts.splice(i, 1);
    }
    const rs = this.rings;
    for (let i = rs.length - 1; i >= 0; i--) {
      rs[i].life += dt;
      if (rs[i].life >= rs[i].dur) rs.splice(i, 1);
    }
    const bs = this.bolts;
    for (let i = bs.length - 1; i >= 0; i--) {
      bs[i].life += dt;
      if (bs[i].life >= bs[i].max) bs.splice(i, 1);
    }
    const ss = this.shots;
    for (let i = ss.length - 1; i >= 0; i--) {
      const s = ss[i];
      s.t += dt;
      const u = Math.min(1, s.t / s.dur);
      const e = u * u * (3 - 2 * u) * 0.35 + u * 0.65;
      const a = (1 - e) * (1 - e);
      const b = 2 * (1 - e) * e;
      const c = e * e;
      const x = a * s.x0 + b * s.cx + c * s.x1;
      const y = a * s.y0 + b * s.cy + c * s.y1;
      s.trail.push(x, y);
      if (s.trail.length > 28) s.trail.splice(0, 2);
      if (Math.random() < 0.6) {
        this.add({ x, y, vx: rnd(-30, 30), vy: rnd(-30, 30), life: 0, max: 0.3, size: 0.5 * s.size, rgb: s.rgb, kind: 0, rot: 0, vr: 0, grav: 0, drag: 3 });
      }
      if (u >= 1) {
        ss.splice(i, 1);
        s.onArrive();
      }
    }
  }

  /** Draw particles/texts etc. `unit` is the cell size used to scale effect sizes. */
  draw(ctx: CanvasRenderingContext2D, unit: number) {
    // additive layer
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of this.rings) {
      const u = r.life / r.dur;
      const rad = r.max * (1 - Math.pow(1 - u, 3));
      ctx.globalAlpha = (1 - u) * 0.9;
      ctx.strokeStyle = `rgb(${r.rgb})`;
      ctx.lineWidth = r.w * (1 - u) + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const b of this.bolts) {
      const a = 1 - b.life / b.max;
      ctx.globalAlpha = a;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(b.pts[0], b.pts[1]);
      for (let i = 2; i < b.pts.length; i += 2) ctx.lineTo(b.pts[i], b.pts[i + 1]);
      ctx.strokeStyle = `rgba(${b.rgb},0.55)`;
      ctx.lineWidth = b.w * 3;
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = b.w;
      ctx.stroke();
    }
    for (const s of this.shots) {
      const g = glowSprite(s.rgb);
      for (let i = 0; i < s.trail.length; i += 2) {
        const k = i / s.trail.length;
        const sz = unit * 0.9 * s.size * k;
        ctx.globalAlpha = k * 0.7;
        ctx.drawImage(g, s.trail[i] - sz, s.trail[i + 1] - sz, sz * 2, sz * 2);
      }
      const n = s.trail.length;
      if (n >= 2) {
        const sz = unit * 1.3 * s.size;
        ctx.globalAlpha = 1;
        ctx.drawImage(g, s.trail[n - 2] - sz, s.trail[n - 1] - sz, sz * 2, sz * 2);
        const w = sz * 0.45;
        ctx.drawImage(glowSprite('255,255,255'), s.trail[n - 2] - w, s.trail[n - 1] - w, w * 2, w * 2);
      }
    }
    for (const p of this.parts) {
      if (p.kind !== 0) continue;
      const u = p.life / p.max;
      const sz = p.size * unit * (1 - u * 0.5);
      ctx.globalAlpha = (1 - u) * 0.9;
      ctx.drawImage(glowSprite(p.rgb), p.x - sz, p.y - sz, sz * 2, sz * 2);
    }
    ctx.restore();

    for (const p of this.parts) {
      if (p.kind === 0) continue;
      const u = p.life / p.max;
      ctx.globalAlpha = Math.min(1, (1 - u) * 1.6);
      if (p.kind === 2) {
        ctx.fillStyle = `rgb(${p.rgb})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * unit * (1 - u * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 1) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const r = p.size * unit * (1 - u * 0.5) * 1.6;
        ctx.fillStyle = `rgb(${p.rgb})`;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const rr = i % 2 === 0 ? r : r * 0.35;
          const a = (i / 8) * Math.PI * 2;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.strokeStyle = `rgb(${p.rgb})`;
        ctx.lineWidth = Math.max(1, p.size * unit * 0.3);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const t of this.texts) {
      const u = t.life / t.max;
      const age = t.life;
      let s = 1;
      if (t.pop) {
        const k = Math.min(1, age / 0.22);
        const c1 = 1.70158;
        const c3 = c1 + 1;
        s = 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
        s = 0.2 + 0.8 * s;
      }
      ctx.globalAlpha = u > 0.65 ? Math.max(0, 1 - (u - 0.65) / 0.35) : 1;
      ctx.font = `700 ${Math.max(8, t.size * s)}px ${FONT}`;
      ctx.lineWidth = Math.max(3, t.size * 0.16);
      ctx.strokeStyle = t.stroke;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  drawFlash(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (this.flashA <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = Math.min(0.6, this.flashA);
    ctx.fillStyle = `rgb(${this.flashRgb})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
