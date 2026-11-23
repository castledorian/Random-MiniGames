import type { Game } from "./engine";
import { COLS, DX, DY, FUSE, ROWS, T_FLOOR, type AIState, type Cmd, type Player } from "./types";

const N = COLS * ROWS;

export function makeAI(lvl: number): AIState {
  return {
    think: 0.3,
    path: [],
    lvl,
    bombCd: 0,
    skillCd: 0,
    wantBomb: false,
    wantSkill: false,
    stuckT: 0,
    lastX: 0,
    lastY: 0,
    wanderT: 0,
  };
}

function sign(n: number) {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

export function runAI(g: Game, p: Player, dt: number): Cmd {
  const ai = p.ai!;
  const cmd: Cmd = { dx: 0, dy: 0, bomb: false, skill: false };
  ai.think -= dt;
  ai.bombCd -= dt;
  ai.skillCd -= dt;

  if (ai.think <= 0) {
    ai.think = 0.3 - 0.2 * ai.lvl + Math.random() * 0.06;
    decide(g, p, ai);
  }

  if (ai.wantBomb) {
    ai.wantBomb = false;
    if (g.countActive(p) < p.maxBombs) {
      cmd.bomb = true;
      ai.bombCd = 0.45;
      ai.think = 0;
    }
  }
  if (ai.wantSkill) {
    ai.wantSkill = false;
    cmd.skill = true;
    ai.skillCd = 1.5;
  }

  steer(p, ai, cmd);

  // détection de blocage
  ai.stuckT += dt;
  if (ai.stuckT > 0.7) {
    const moved = Math.hypot(p.x - ai.lastX, p.y - ai.lastY);
    if (ai.path.length && moved < 0.08 && p.frozen <= 0) {
      ai.path = [];
      ai.think = 0;
    }
    ai.lastX = p.x;
    ai.lastY = p.y;
    ai.stuckT = 0;
  }
  return cmd;
}

/** Écart signé le plus court (tient compte des tunnels qui relient les bords). */
function wd(a: number, b: number, n: number): number {
  let d = a - b;
  if (d > n / 2) d -= n;
  else if (d < -n / 2) d += n;
  return d;
}

function steer(p: Player, ai: AIState, cmd: Cmd) {
  while (ai.path.length) {
    const t = ai.path[0];
    if (Math.abs(wd(t.x + 0.5, p.x, COLS)) < 0.14 && Math.abs(wd(t.y + 0.5, p.y, ROWS)) < 0.14) ai.path.shift();
    else break;
  }
  if (!ai.path.length) return;
  const t = ai.path[0];
  const cx = Math.floor(p.x);
  const cy = Math.floor(p.y);
  const tcx = t.x + 0.5;
  const tcy = t.y + 0.5;
  if (t.x !== cx && t.y === cy) {
    const ccy = cy + 0.5;
    if (Math.abs(p.y - ccy) > 0.12) cmd.dy = sign(ccy - p.y);
    else cmd.dx = sign(wd(tcx, p.x, COLS));
  } else if (t.y !== cy && t.x === cx) {
    const ccx = cx + 0.5;
    if (Math.abs(p.x - ccx) > 0.12) cmd.dx = sign(ccx - p.x);
    else cmd.dy = sign(wd(tcy, p.y, ROWS));
  } else {
    const ddx = wd(tcx, p.x, COLS);
    const ddy = wd(tcy, p.y, ROWS);
    if (Math.abs(ddx) > Math.abs(ddy)) cmd.dx = sign(ddx);
    else cmd.dy = sign(ddy);
  }
}

function enemyTiles(g: Game, p: Player): Set<number> {
  const s = new Set<number>();
  for (const o of g.players) {
    if (o === p || !o.alive) continue;
    s.add(Math.floor(o.y) * COLS + Math.floor(o.x));
  }
  return s;
}

function bombValue(g: Game, p: Player, tx: number, ty: number, enemies: Set<number>): number {
  let score = 0;
  if (enemies.has(ty * COLS + tx)) score += 6;
  for (let d = 0; d < 4; d++) {
    let x = tx;
    let y = ty;
    for (let k = 1; k <= p.range; k++) {
      const i = g.wrapIdx(x + DX[d], y + DY[d]);
      if (i < 0) break;
      x = i % COLS;
      y = Math.floor(i / COLS);
      const t = g.grid[i];
      if (t === 1) break;
      if (t === 2) {
        score += 1;
        break;
      }
      if (enemies.has(i)) score += 6;
    }
  }
  return score;
}

function pathTo(prev: Int16Array, start: number, target: number): { x: number; y: number }[] {
  const path: { x: number; y: number }[] = [];
  let cur = target;
  let guard = 0;
  while (cur !== start && cur !== -1 && guard++ < 400) {
    path.push({ x: cur % COLS, y: Math.floor(cur / COLS) });
    cur = prev[cur];
  }
  return path.reverse();
}

function escapeExists(g: Game, p: Player, cx: number, cy: number, danger: Float32Array, stepT: number): boolean {
  const blast = new Uint8Array(N);
  for (const t of g.blastTiles(cx, cy, p.range)) blast[t] = 1;
  const start = cy * COLS + cx;
  const dist = new Int16Array(N).fill(-1);
  const q = [start];
  dist[start] = 0;
  let qi = 0;
  while (qi < q.length) {
    const cur = q[qi++];
    const d = dist[cur];
    if (d >= 9) continue;
    const x = cur % COLS;
    const y = Math.floor(cur / COLS);
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k];
      const ny = y + DY[k];
      const ni = g.wrapIdx(nx, ny);
      if (ni < 0) continue;
      if (dist[ni] !== -1 || g.grid[ni] !== T_FLOOR || g.bombGrid[ni]) continue;
      const arrival = (d + 1) * stepT;
      if (arrival > FUSE - 0.55) continue;
      const dn = danger[ni];
      if (dn !== Infinity && dn <= arrival + 0.15) continue;
      dist[ni] = d + 1;
      if (!blast[ni] && dn === Infinity) return true;
      q.push(ni);
    }
  }
  return false;
}

function flee(g: Game, p: Player, ai: AIState, cx: number, cy: number, danger: Float32Array, stepT: number): number {
  const start = cy * COLS + cx;
  const dist = new Int16Array(N).fill(-1);
  const prev = new Int16Array(N).fill(-1);
  const q = [start];
  dist[start] = 0;
  let qi = 0;
  let target = -1;
  let fallback = -1;
  let fbScore = -1;
  while (qi < q.length) {
    const cur = q[qi++];
    const d = dist[cur];
    if (cur !== start && danger[cur] === Infinity) {
      target = cur;
      break;
    }
    if (cur !== start && danger[cur] > fbScore) {
      fbScore = danger[cur];
      fallback = cur;
    }
    if (d >= 12) continue;
    const x = cur % COLS;
    const y = Math.floor(cur / COLS);
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k];
      const ny = y + DY[k];
      const ni = g.wrapIdx(nx, ny);
      if (ni < 0) continue;
      if (dist[ni] !== -1 || g.grid[ni] !== T_FLOOR || g.bombGrid[ni]) continue;
      const arrival = (d + 1) * stepT;
      const dn = danger[ni];
      if (dn !== Infinity && dn <= arrival + 0.12) continue;
      dist[ni] = d + 1;
      prev[ni] = cur;
      q.push(ni);
    }
  }
  const t = target !== -1 ? target : fallback;
  if (t === -1) {
    ai.path = [];
    return 99;
  }
  ai.path = pathTo(prev, start, t);
  return ai.path.length;
}

function seek(g: Game, p: Player, ai: AIState, cx: number, cy: number, danger: Float32Array, enemies: Set<number>) {
  const start = cy * COLS + cx;
  const dist = new Int16Array(N).fill(-1);
  const prev = new Int16Array(N).fill(-1);
  const q = [start];
  dist[start] = 0;
  let qi = 0;
  let best = -1;
  let bestScore = -Infinity;
  const canBomb = g.countActive(p) < p.maxBombs;
  const puTiles = new Map<number, number>();
  for (const u of g.powerups) puTiles.set(Math.floor(u.y) * COLS + Math.floor(u.x), 1);
  const wanders: number[] = [];

  while (qi < q.length) {
    const cur = q[qi++];
    const d = dist[cur];
    const x = cur % COLS;
    const y = Math.floor(cur / COLS);
    if (cur !== start) {
      let s = -Infinity;
      if (puTiles.has(cur)) s = 9 - d * 0.5;
      if (canBomb) {
        const v = bombValue(g, p, x, y, enemies);
        if (v > 0) s = Math.max(s, Math.min(v, 9) * (0.6 + 0.4 * ai.lvl) - d * 0.55);
      }
      if (s > bestScore) {
        bestScore = s;
        best = cur;
      }
      if (d >= 2 && d <= 7) wanders.push(cur);
    }
    if (d >= 24) continue;
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k];
      const ny = y + DY[k];
      const ni = g.wrapIdx(nx, ny);
      if (ni < 0) continue;
      if (dist[ni] !== -1 || g.grid[ni] !== T_FLOOR || g.bombGrid[ni]) continue;
      if (danger[ni] !== Infinity) continue;
      dist[ni] = d + 1;
      prev[ni] = cur;
      q.push(ni);
    }
  }

  if (best !== -1 && bestScore > -Infinity) {
    ai.path = pathTo(prev, start, best);
    return;
  }
  // Rien d'intéressant : se rapprocher d'un ennemi ou flâner
  if (enemies.size && Math.random() < 0.6) {
    let ebest = -1;
    let ed = 999;
    enemies.forEach((ti) => {
      if (dist[ti] !== -1 && dist[ti] < ed) {
        ed = dist[ti];
        ebest = ti;
      }
    });
    if (ebest !== -1 && ed > 2) {
      const pth = pathTo(prev, start, ebest);
      pth.pop();
      ai.path = pth.slice(0, 3);
      return;
    }
  }
  if (wanders.length && ai.wanderT <= 0) {
    const t = wanders[Math.floor(Math.random() * wanders.length)];
    ai.path = pathTo(prev, start, t);
    ai.wanderT = 1.5;
  } else {
    ai.wanderT -= 0.2;
  }
}

function botSkill(g: Game, p: Player, ai: AIState, cx: number, cy: number, danger: Float32Array, fleeing: boolean, fleeLen: number) {
  if (p.skillCd > 0 || ai.skillCd > 0 || p.frozen > 0 || p.dash) return;
  const kind = p.hero.skill.kind;
  const here = danger[cy * COLS + cx];
  const foes = g.players.filter((o) => o !== p && o.alive);
  const chance = 0.45 + 0.5 * ai.lvl;
  if (Math.random() > chance) return;
  switch (kind) {
    case "detonate": {
      if (here !== Infinity) return;
      for (const b of g.bombs) {
        if (b.owner !== p || b.fuse < 0.5) continue;
        const blast = g.blastTiles(b.tx, b.ty, b.range);
        for (const o of foes) {
          if (blast.includes(Math.floor(o.y) * COLS + Math.floor(o.x))) {
            ai.wantSkill = true;
            return;
          }
        }
      }
      return;
    }
    case "dash":
      if (fleeing && here < 0.9 && fleeLen >= 2) ai.wantSkill = true;
      return;
    case "teleport":
      if (fleeing && here < 0.7 && fleeLen >= 3) ai.wantSkill = true;
      return;
    case "wall":
      for (const o of foes) {
        const dx = Math.floor(o.x) - cx;
        const dy = Math.floor(o.y) - cy;
        if (dx === DX[p.facing] * Math.abs(dx) && dy === DY[p.facing] * Math.abs(dy) && Math.abs(dx) + Math.abs(dy) <= 3 && Math.abs(dx) + Math.abs(dy) >= 2) {
          ai.wantSkill = true;
          return;
        }
      }
      return;
    case "freeze":
      if (fleeing) return;
      for (const o of foes) {
        if (Math.hypot(o.x - p.x, o.y - p.y) <= 4 && g.countActive(p) < p.maxBombs) {
          ai.wantSkill = true;
          return;
        }
      }
      return;
    case "barrage":
      if (fleeing) return;
      for (const o of foes) {
        const dx = Math.floor(o.x) - cx;
        const dy = Math.floor(o.y) - cy;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist >= 3 && dist <= 6 && ((dx === 0 && dy === DY[p.facing] * Math.abs(dy)) || (dy === 0 && dx === DX[p.facing] * Math.abs(dx)))) {
          ai.wantSkill = true;
          return;
        }
      }
      return;
  }
}

function decide(g: Game, p: Player, ai: AIState) {
  const cx = Math.floor(p.x);
  const cy = Math.floor(p.y);
  const danger = g.getDanger();
  const stepT = 1 / p.speed;
  const here = danger[cy * COLS + cx];
  const fleeTime = 0.9 + 1.7 * ai.lvl;

  if (here < fleeTime) {
    const len = flee(g, p, ai, cx, cy, danger, stepT);
    botSkill(g, p, ai, cx, cy, danger, true, len);
    return;
  }

  const enemies = enemyTiles(g, p);
  const idx = cy * COLS + cx;
  const canBomb = g.countActive(p) < p.maxBombs && ai.bombCd <= 0 && !g.bombGrid[idx];
  if (canBomb) {
    const v = bombValue(g, p, cx, cy, enemies);
    if (v > 0 && escapeExists(g, p, cx, cy, danger, stepT)) {
      if (Math.random() < 0.55 + 0.45 * ai.lvl) {
        ai.wantBomb = true;
        ai.path = [];
        botSkill(g, p, ai, cx, cy, danger, false, 0);
        return;
      }
    }
  }
  botSkill(g, p, ai, cx, cy, danger, false, 0);
  seek(g, p, ai, cx, cy, danger, enemies);
}
