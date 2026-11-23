// Particle system + floating texts. Pooled to avoid GC hiccups on mobile.

export type PKind = "spark" | "dot" | "ring" | "smoke" | "shard" | "ghost" | "star";

export interface Particle {
  alive: boolean;
  kind: PKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  color: string;
  drag: number;
  grav: number;
  rot: number;
  vr: number;
  add: boolean;
  w: number;
  h: number;
}

export interface FloatText {
  x: number;
  y: number;
  vy: number;
  life: number;
  max: number;
  text: string;
  color: string;
  size: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class FX {
  parts: Particle[] = [];
  texts: FloatText[] = [];
  private cursor = 0;

  constructor(size = 700) {
    for (let i = 0; i < size; i++) {
      this.parts.push({
        alive: false, kind: "dot", x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, grow: 0,
        color: "#fff", drag: 0, grav: 0, rot: 0, vr: 0, add: false, w: 0, h: 0,
      });
    }
  }

  clear() {
    for (const p of this.parts) p.alive = false;
    this.texts.length = 0;
  }

  emit(kind: PKind, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, o: Partial<Particle> = {}) {
    // find a free slot (scan from cursor)
    let p: Particle | null = null;
    const n = this.parts.length;
    for (let i = 0; i < n; i++) {
      const c = this.parts[(this.cursor + i) % n];
      if (!c.alive) {
        p = c;
        this.cursor = (this.cursor + i + 1) % n;
        break;
      }
    }
    if (!p) {
      p = this.parts[this.cursor];
      this.cursor = (this.cursor + 1) % n;
    }
    p.alive = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.max = life;
    p.size = size;
    p.grow = 0;
    p.color = color;
    p.drag = 0;
    p.grav = 0;
    p.rot = 0;
    p.vr = 0;
    p.add = kind === "spark" || kind === "ring" || kind === "star";
    p.w = 0;
    p.h = 0;
    Object.assign(p, o);
    return p;
  }

  sparks(x: number, y: number, n: number, angle: number, spread: number, smin: number, smax: number, color: string, life = 0.4, size = 2.5) {
    for (let i = 0; i < n; i++) {
      const a = angle + rnd(-spread, spread);
      const s = rnd(smin, smax);
      this.emit("spark", x, y, Math.cos(a) * s, Math.sin(a) * s, rnd(life * 0.6, life), size * rnd(0.7, 1.3), color, { drag: 3.2 });
    }
  }

  ring(x: number, y: number, size: number, grow: number, life: number, color: string) {
    this.emit("ring", x, y, 0, 0, life, size, color, { grow });
  }

  star(x: number, y: number, size: number, life: number, color: string) {
    this.emit("star", x, y, 0, 0, life, size, color, { rot: rnd(0, 3), vr: rnd(-2, 2), grow: size * 2 });
  }

  dust(x: number, y: number, n: number, color = "#cfc7ff", spread = 80) {
    for (let i = 0; i < n; i++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.emit("smoke", x + rnd(-8, 8), y, dir * rnd(20, spread), rnd(-50, -5), rnd(0.25, 0.5), rnd(4, 9), color, { grow: 22, drag: 2.5 });
    }
  }

  shards(x: number, y: number, n: number, color: string, speed = 500) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2);
      const s = rnd(speed * 0.3, speed);
      this.emit("shard", x, y, Math.cos(a) * s, Math.sin(a) * s - 120, rnd(0.5, 0.9), rnd(4, 8), color, {
        grav: 1400, rot: rnd(0, 6), vr: rnd(-12, 12), drag: 0.6, w: rnd(1, 2.2),
      });
    }
  }

  text(x: number, y: number, text: string, color: string, size = 28, life = 0.9) {
    if (this.texts.length > 40) this.texts.shift();
    this.texts.push({ x, y, vy: -90, life, max: life, text, color, size });
  }

  update(dt: number) {
    for (const p of this.parts) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      if (p.drag) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.size += p.grow * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= 0.94;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (let pass = 0; pass < 2; pass++) {
      const add = pass === 1;
      ctx.globalCompositeOperation = add ? "lighter" : "source-over";
      for (const p of this.parts) {
        if (!p.alive || p.add !== add) continue;
        const k = p.life / p.max; // 1 -> 0
        switch (p.kind) {
          case "spark": {
            ctx.globalAlpha = Math.min(1, k * 1.5);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size * (0.4 + k * 0.6);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045);
            ctx.stroke();
            break;
          }
          case "dot": {
            ctx.globalAlpha = Math.min(1, k * 1.4);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.1, p.size * (0.4 + 0.6 * k)), 0, 6.283);
            ctx.fill();
            break;
          }
          case "smoke": {
            ctx.globalAlpha = k * 0.45;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.1, p.size), 0, 6.283);
            ctx.fill();
            break;
          }
          case "ring": {
            ctx.globalAlpha = k;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = Math.max(0.5, 6 * k);
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.1, p.size), 0, 6.283);
            ctx.stroke();
            break;
          }
          case "shard": {
            ctx.globalAlpha = Math.min(1, k * 1.6);
            ctx.fillStyle = p.color;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillRect(-p.size / 2, (-p.size * p.w) / 4, p.size, (p.size * p.w) / 2);
            ctx.restore();
            break;
          }
          case "ghost": {
            ctx.globalAlpha = k * 0.45;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.roundRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, 12);
            ctx.fill();
            break;
          }
          case "star": {
            ctx.globalAlpha = k;
            ctx.fillStyle = p.color;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            const r = p.size;
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
              const rr = i % 2 === 0 ? r : r * 0.18;
              const a = (i / 8) * 6.283;
              ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            break;
          }
        }
      }
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  drawTexts(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const t of this.texts) {
      const k = t.life / t.max;
      const pop = k > 0.85 ? 1 + (k - 0.85) * 4 : 1;
      ctx.globalAlpha = Math.min(1, k * 2.2);
      ctx.font = `${Math.round(t.size * pop)}px Bungee, "Arial Black", Impact, sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(10,5,30,0.9)";
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
