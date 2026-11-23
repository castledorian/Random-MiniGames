// Tiny platformer physics: AABB bodies (x = centre, y = feet) vs solid / one-way platforms.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MoveDef {
  rx: number;
  ry: number;
  speed: number;
  phase: number;
}

export interface Platform extends Rect {
  kind: "solid" | "oneway";
  x0: number;
  y0: number;
  move?: MoveDef;
  dx: number;
  dy: number;
}

export interface Body {
  x: number;
  y: number; // feet
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  ground: Platform | null;
  face: 1 | -1;
  wallHit: number; // -1 / 0 / 1 when a wall cancelled our horizontal motion this step
  impactVy: number; // downward speed at the moment we landed this step (0 otherwise)
}

export function makeBody(x: number, y: number, w: number, h: number): Body {
  return { x, y, w, h, vx: 0, vy: 0, onGround: false, ground: null, face: 1, wallHit: 0, impactVy: 0 };
}

export function updatePlatforms(ps: Platform[], time: number) {
  for (const p of ps) {
    if (!p.move) continue;
    const m = p.move;
    const nx = p.x0 + Math.sin(time * m.speed + m.phase) * m.rx;
    const ny = p.y0 + Math.sin(time * m.speed + m.phase) * m.ry;
    p.dx = nx - p.x;
    p.dy = ny - p.y;
    p.x = nx;
    p.y = ny;
  }
}

export function moveBody(b: Body, dt: number, ps: Platform[], drop = false) {
  b.wallHit = 0;
  b.impactVy = 0;
  if (b.ground && b.ground.move) {
    b.x += b.ground.dx;
    b.y += b.ground.dy;
  }
  const hw = b.w / 2;

  // ---- horizontal ----
  b.x += b.vx * dt;
  for (const p of ps) {
    if (p.kind !== "solid") continue;
    if (b.y > p.y + 0.5 && b.y - b.h < p.y + p.h - 0.5 && b.x + hw > p.x && b.x - hw < p.x + p.w) {
      const fromLeft = b.vx > 0 ? true : b.vx < 0 ? false : b.x < p.x + p.w / 2;
      if (fromLeft) b.x = p.x - hw;
      else b.x = p.x + p.w + hw;
      b.wallHit = fromLeft ? 1 : -1;
      b.vx = 0;
    }
  }

  // ---- vertical ----
  const prevY = b.y;
  const prevTop = b.y - b.h;
  b.y += b.vy * dt;
  b.onGround = false;
  b.ground = null;
  for (const p of ps) {
    if (b.x + hw <= p.x || b.x - hw >= p.x + p.w) continue;
    if (b.vy >= 0) {
      if (p.kind === "oneway" && drop) continue;
      if (prevY <= p.y + 5 && b.y >= p.y) {
        if (b.vy > 0) b.impactVy = b.vy;
        b.y = p.y;
        b.vy = 0;
        b.onGround = true;
        b.ground = p;
      }
    } else if (p.kind === "solid") {
      const bottom = p.y + p.h;
      if (prevTop >= bottom - 1 && b.y - b.h < bottom) {
        b.y = bottom + b.h;
        b.vy = 0;
      }
    }
  }
}

export function overlap(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function bodyRect(b: Body, shrinkX = 0, shrinkY = 0): Rect {
  return { x: b.x - b.w / 2 + shrinkX, y: b.y - b.h + shrinkY, w: b.w - shrinkX * 2, h: b.h - shrinkY * 2 };
}

export function pointInSolid(x: number, y: number, ps: Platform[]) {
  for (const p of ps) {
    if (p.kind === "solid" && x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h) return true;
  }
  return false;
}

export function clearLine(x0: number, y0: number, x1: number, y1: number, ps: Platform[]) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.ceil(Math.hypot(dx, dy) / 12);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (pointInSolid(x0 + dx * t, y0 + dy * t, ps)) return false;
  }
  return true;
}

/** Highest platform top at x that is at/below `y - 4` and no deeper than `maxDrop`. */
export function supportAt(x: number, y: number, maxDrop: number, ps: Platform[]): Platform | null {
  let best: Platform | null = null;
  for (const p of ps) {
    if (x < p.x || x > p.x + p.w) continue;
    if (p.y >= y - 6 && p.y <= y + maxDrop) {
      if (!best || p.y < best.y) best = p;
    }
  }
  return best;
}

export function approach(v: number, target: number, delta: number) {
  if (v < target) return Math.min(v + delta, target);
  return Math.max(v - delta, target);
}

export function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}
