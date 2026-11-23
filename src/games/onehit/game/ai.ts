import type { Game } from "./game";
import type { Enemy, Proj } from "./types";
import type { EnemyKind } from "./heroes";
import { ENEMY_COLORS } from "./heroes";
import { FLOOR, GRAV, H, W } from "./levels";
import { approach, bodyRect, clamp, clearLine, makeBody, moveBody, overlap, pointInSolid, supportAt } from "./physics";

const DIM: Record<EnemyKind, { w: number; h: number }> = {
  grunt: { w: 20, h: 36 },
  shooter: { w: 20, h: 36 },
  brute: { w: 32, h: 48 },
  drone: { w: 28, h: 22 },
};

export function spawnEnemy(g: Game, kind: EnemyKind, x: number, y: number, delay: number) {
  const d = DIM[kind];
  const sy = kind === "drone" ? Math.max(90, y - 90) : y;
  const e: Enemy = {
    ...makeBody(x, sy, d.w, d.h),
    id: g.nextId(),
    kind,
    alive: true,
    state: "spawn",
    t: 0,
    cd: 0,
    spawnT: delay + 0.6,
    spawnMax: delay + 0.6,
    turnT: 0,
    flash: 0,
    ax: 1,
    ay: 0,
    jumpCd: 0,
    seed: Math.random() * 10,
    slowed: false,
    stunDur: 1.3,
    hit: false,
    lean: 0,
  };
  e.face = x < W / 2 ? 1 : -1;
  g.enemies.push(e);
  g.addFx("spawn", x, sy, 0, delay + 0.6, ENEMY_COLORS[kind], 1, 1);
}

function edgeAhead(g: Game, e: Enemy, dir: number) {
  const px = e.x + dir * (e.w / 2 + 10);
  return !supportAt(px, e.y, 14, g.platforms) || g.spikeAt(px, e.y);
}

function platformAbove(g: Game, e: Enemy, dir: number) {
  for (const p of g.platforms) {
    if (p.kind !== "oneway") continue;
    if (p.y < e.y - 20 && p.y > e.y - 150 && e.x + dir * 30 > p.x - 40 && e.x + dir * 30 < p.x + p.w + 40) return true;
  }
  return false;
}

/** Shared chase movement for grunt / brute. */
function chase(g: Game, e: Enemy, d: number, speed: number, canJump: boolean, jumpPower: number, jumpGap: number, freeFace = true) {
  const p = g.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const dir = dx >= 0 ? 1 : -1;
  const lower = dy > 70;
  let vxT = Math.abs(dx) < 14 ? 0 : dir * speed;
  if (!e.onGround) return; // keep momentum in the air
  // player is hiding below our platform: head for the nearest ledge and drop down
  if (lower && Math.abs(dx) < 90 && e.ground && e.ground.kind === "oneway" && speed > 0) {
    const gp = e.ground;
    const safe = (ex: number) => !!supportAt(ex, e.y + 10, 420, g.platforms) && !g.spikeAt(ex, e.y + 30);
    const lSafe = safe(gp.x - 14);
    const rSafe = safe(gp.x + gp.w + 14);
    let md = 0;
    if (lSafe && rSafe) md = e.x - gp.x < gp.x + gp.w - e.x ? -1 : 1;
    else if (lSafe) md = -1;
    else if (rSafe) md = 1;
    if (md !== 0) {
      vxT = md * speed * 0.9;
      if (freeFace) e.face = md as 1 | -1;
    }
  }
  if (vxT !== 0) {
    const md = vxT > 0 ? 1 : -1;
    if (edgeAhead(g, e, md)) {
      const px = e.x + md * (e.w / 2 + 10);
      const dropOk = lower && !!supportAt(px + md * 10, e.y + 10, 420, g.platforms) && !g.spikeAt(px, e.y + 12);
      if (!dropOk) {
        if (canJump && e.jumpCd <= 0 && Math.abs(dy) < 90 && supportAt(e.x + md * 95, e.y, 40, g.platforms) && !g.spikeAt(e.x + md * 95, e.y)) {
          e.vy = -jumpGap;
          e.vx = md * 190;
          e.jumpCd = 1.2;
          e.onGround = false;
          return;
        }
        vxT = 0;
      }
    }
  }
  if (canJump && e.jumpCd <= 0 && dy < -50 && Math.abs(dx) < 260 && platformAbove(g, e, dir)) {
    e.vy = -jumpPower;
    e.vx = dir * speed * 0.9;
    e.jumpCd = 1.3;
    e.onGround = false;
    return;
  }
  if (e.wallHit && canJump && e.jumpCd <= 0) {
    e.vy = -jumpPower * 0.9;
    e.jumpCd = 1.2;
    e.onGround = false;
    return;
  }
  e.vx = approach(e.vx, vxT, 2200 * d);
}

function groundPhysics(g: Game, e: Enemy, d: number) {
  e.vy = Math.min(e.vy + GRAV * d, 1300);
  moveBody(e, d, g.platforms);
  const env = g.envBody(e);
  if (env === "spike") g.killEnemy(e, "spike", e.vx >= 0 ? 1 : -1);
  else if (env === "out") g.killEnemy(e, "ring", e.vx >= 0 ? 1 : -1);
}

export function updateEnemies(g: Game, dt: number) {
  const diff = Math.min(g.room - 1, 14);
  let p = g.player;
  for (const e of g.enemies) {
    if (!e.alive) continue;
    // chaque ennemi vise le joueur vivant le plus proche (co-op)
    p = g.player = g.targetFor(e);
    if (e.state === "spawn") {
      e.spawnT -= dt;
      if (e.spawnT <= 0) {
        e.state = "idle";
        e.cd = e.kind === "shooter" ? 0.7 + Math.random() * 0.9 : e.kind === "drone" ? 1 + Math.random() : 0.2;
        g.burst(e.x, e.y - e.h / 2, 14, ENEMY_COLORS[e.kind], 160, 3, 0.4, 0);
        g.sfx("spawn");
      }
      continue;
    }
    const k = g.slowFactor(e.x, e.y - e.h / 2);
    e.slowed = k < 1;
    const d = dt * k;
    e.flash -= d;
    e.cd -= d;
    e.jumpCd -= d;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dir: 1 | -1 = dx >= 0 ? 1 : -1;
    e.lean += (clamp(e.vx / 200, -1, 1) - e.lean) * Math.min(1, d * 10);

    if (e.kind === "grunt") {
      const speed = Math.min(150, 96 + diff * 9);
      switch (e.state) {
        case "idle":
          if (p.alive) {
            if (e.onGround && Math.abs(dx) > 14) e.face = dir;
            chase(g, e, d, speed, true, 760, 560);
            if (e.cd <= 0 && e.onGround && Math.abs(dx) < 58 && Math.abs(dy) < 40) {
              e.state = "windup";
              e.t = 0;
              e.face = dir;
              g.sfx("warn");
            }
          } else e.vx = approach(e.vx, 0, 2000 * d);
          break;
        case "windup":
          e.t += d;
          e.vx = approach(e.vx, 0, 3000 * d);
          if (e.t >= Math.max(0.26, 0.44 - diff * 0.02)) {
            e.state = "attack";
            e.t = 0;
            e.hit = false;
            e.vx = e.face * 380;
            g.addFx("slash", e.x + e.face * 20, e.y - 20, e.face, 0.16, "#ff6b7a", 0.8, e.face);
          }
          break;
        case "attack":
          e.t += d;
          if (!e.hit) meleeCheck(g, e, 74, 44);
          if (e.t >= 0.14) {
            e.state = "recover";
            e.t = 0;
            e.cd = 0.5;
          }
          break;
        case "recover":
        case "stun":
          e.t += d;
          e.vx = approach(e.vx, 0, 1800 * d);
          if (e.t >= (e.state === "stun" ? e.stunDur : 0.5)) e.state = "idle";
          break;
        default:
          e.state = "idle";
      }
      groundPhysics(g, e, d);
    } else if (e.kind === "brute") {
      const speed = Math.min(95, 54 + diff * 4);
      switch (e.state) {
        case "idle":
          if (p.alive) {
            if (dir !== e.face && Math.abs(dx) > 14) {
              e.turnT += d;
              if (e.turnT > 0.7) {
                e.face = dir;
                e.turnT = 0;
                g.burst(e.x, e.y - 20, 6, "#9db8ff", 90, 2.5, 0.3, 0);
              }
            } else e.turnT = 0;
            chase(g, e, d, dir !== e.face && Math.abs(dx) > 14 ? 0 : speed, true, 700, 520, false);
            if (e.cd <= 0 && e.onGround && e.face === dir && Math.abs(dx) < 80 && Math.abs(dy) < 44) {
              e.state = "windup";
              e.t = 0;
              g.sfx("warn");
            }
          } else e.vx = approach(e.vx, 0, 2000 * d);
          break;
        case "windup":
          e.t += d;
          e.vx = approach(e.vx, 0, 3000 * d);
          if (e.t >= 0.62) {
            e.state = "attack";
            e.t = 0;
            e.hit = false;
            e.vx = e.face * 260;
            g.addFx("slash", e.x + e.face * 30, e.y - 24, e.face, 0.2, "#7ea0ff", 1.3, e.face);
            g.shakeBy(0.12);
          }
          break;
        case "attack":
          e.t += d;
          if (!e.hit) meleeCheck(g, e, 104, 52);
          if (e.t >= 0.2) {
            e.state = "recover";
            e.t = 0;
            e.cd = 0.8;
          }
          break;
        case "recover":
        case "stun":
          e.t += d;
          e.vx = approach(e.vx, 0, 1800 * d);
          if (e.t >= (e.state === "stun" ? e.stunDur : 0.8)) e.state = "idle";
          break;
        default:
          e.state = "idle";
      }
      groundPhysics(g, e, d);
    } else if (e.kind === "shooter") {
      switch (e.state) {
        case "idle": {
          e.face = dir;
          const dist = Math.abs(dx);
          let vxT = 0;
          if (p.alive) {
            if (dist < 180) vxT = -dir * 75;
            else if (dist > 470) vxT = dir * 65;
          }
          if (vxT !== 0 && edgeAhead(g, e, vxT > 0 ? 1 : -1)) vxT = 0;
          if (e.onGround) e.vx = approach(e.vx, vxT, 1000 * d);
          if (e.cd <= 0 && p.alive && dist < 640 && clearLine(e.x, e.y - 26, p.x, p.y - 20, g.platforms)) {
            e.state = "aim";
            e.t = 0;
            g.sfx("warn");
          }
          break;
        }
        case "aim": {
          e.t += d;
          e.vx = approach(e.vx, 0, 2500 * d);
          const aimDur = 0.8 - Math.min(0.28, diff * 0.035);
          if (e.t < aimDur - 0.22 && p.alive) {
            const ax = p.x - e.x;
            const ay = p.y - 20 - (e.y - 26);
            const l = Math.hypot(ax, ay) || 1;
            e.ax = ax / l;
            e.ay = ay / l;
          }
          e.face = e.ax >= 0 ? 1 : -1;
          if (e.t >= aimDur) {
            const spd = Math.min(560, 400 + diff * 14);
            g.projs.push(makeProj(g, "bullet", "e", e.x + e.ax * 24, e.y - 26 + e.ay * 24, e.ax * spd, e.ay * spd, 5, 4));
            g.burst(e.x + e.ax * 26, e.y - 26 + e.ay * 26, 8, "#ffd27a", 220, 2.5, 0.2, 0);
            g.addFx("ring", e.x + e.ax * 26, e.y - 26 + e.ay * 26, 0, 0.18, "#ffb02e", 0.4, 1);
            e.vx = -e.ax * 120;
            g.sfx("shoot");
            e.state = "recover";
            e.t = 0;
            e.cd = Math.max(1.0, 1.9 + Math.random() * 0.9 - diff * 0.06);
          }
          break;
        }
        default:
          e.t += d;
          e.vx = approach(e.vx, 0, 900 * d);
          if (e.t >= 0.4) e.state = "idle";
      }
      groundPhysics(g, e, d);
    } else {
      updateDrone(g, e, d, diff);
    }
  }
}

function meleeCheck(g: Game, e: Enemy, reach: number, height: number) {
  const r = { x: e.face > 0 ? e.x : e.x - reach, y: e.y - height + 4, w: reach, h: height };
  const target = g.player;
  let hit = false;
  for (const pl of g.players) {
    if (!pl.alive) continue;
    g.player = pl;
    if (overlap(r, g.hurtRect())) {
      hit = true;
      g.enemyHitPlayer(e);
    }
  }
  g.player = target;
  if (hit) e.hit = true;
}

function updateDrone(g: Game, e: Enemy, d: number, diff: number) {
  const p = g.player;
  const cx = e.x;
  const cy = e.y - e.h / 2;
  const t = g.time;
  switch (e.state) {
    case "idle": {
      const tx = p.x + Math.sin(t * 0.8 + e.seed) * 190;
      const ty = clamp(p.y - 130 + Math.sin(t * 1.7 + e.seed) * 20, 60, 420);
      e.vx = approach(e.vx, clamp((tx - cx) * 2.2, -180, 180), 700 * d);
      e.vy = approach(e.vy, clamp((ty - cy) * 2.2, -150, 150), 700 * d);
      e.face = p.x >= e.x ? 1 : -1;
      if (e.cd <= 0 && p.alive && Math.hypot(p.x - cx, p.y - 20 - cy) < 540) {
        e.state = "tele";
        e.t = 0;
        g.sfx("warn");
      }
      break;
    }
    case "tele": {
      e.t += d;
      e.vx = approach(e.vx, 0, 2200 * d);
      e.vy = approach(e.vy, 0, 2200 * d);
      if (e.t < 0.46 && p.alive) {
        const ax = p.x - cx;
        const ay = p.y - 20 - cy;
        const l = Math.hypot(ax, ay) || 1;
        e.ax = ax / l;
        e.ay = ay / l;
      }
      e.face = e.ax >= 0 ? 1 : -1;
      if (e.t >= 0.64) {
        const spd = 600 + diff * 14;
        e.state = "dive";
        e.t = 0;
        e.vx = e.ax * spd;
        e.vy = e.ay * spd;
        g.sfx("dash");
      }
      break;
    }
    case "dive": {
      e.t += d;
      if (e.t > 0.05 && Math.random() < 0.7) g.burst(cx, cy, 1, "#d79bff", 40, 3, 0.25, 0);
      for (const pl of g.players) {
        if (!e.alive || !pl.alive) continue;
        g.player = pl;
        if (!overlap(bodyRect(e, 2, 2), g.hurtRect())) continue;
        if (pl.parryT > 0) g.killEnemy(e, "reflect", e.vx >= 0 ? 1 : -1);
        else if (pl.inv <= 0) g.killPlayer("drone");
      }
      if (pointInSolid(cx, cy + 8, g.platforms) || e.t >= 0.6) {
        e.state = "recover";
        e.t = 0;
        e.vx *= 0.15;
        e.vy *= 0.15;
        e.cd = Math.max(1.0, 2.2 + Math.random() * 1.2 - diff * 0.07);
      }
      break;
    }
    default: {
      e.t += d;
      e.vy = approach(e.vy, -90, 500 * d);
      e.vx = approach(e.vx, 0, 500 * d);
      if (e.t >= 0.5) e.state = "idle";
    }
  }
  if (!e.alive) return;
  e.x += e.vx * d;
  e.y += e.vy * d;
  e.y = clamp(e.y, 40, H + 40);
  if (!g.level.open) e.x = clamp(e.x, 14, W - 14);
  else if (e.x < -60 || e.x > W + 60) g.killEnemy(e, "ring", 1);
  if (e.y > FLOOR + 30 && !supportAt(e.x, 400, 200, g.platforms)) e.y = FLOOR + 30;
}

// ------------------------------------------------------------------ projectiles
export function makeProj(g: Game, kind: Proj["kind"], owner: "p" | "e", x: number, y: number, vx: number, vy: number, r: number, life: number): Proj {
  return {
    id: g.nextId(), kind, owner, x, y, vx, vy, r, life, t: 0, phase: 0, pierce: 1, bounces: 0,
    near: false, reflected: false, hits: [], rot: 0, slowed: false, pi: g.players.indexOf(g.player),
  };
}

function rectDist(px: number, py: number, r: { x: number; y: number; w: number; h: number }) {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/** 0 = nothing, 1 = hit & killed, 2 = blocked by a shield */
function hitEnemies(g: Game, pr: Proj, cause: "throw" | "reflect" | "boomer"): 0 | 1 | 2 {
  let result: 0 | 1 | 2 = 0;
  for (const e of g.enemies) {
    if (!e.alive || e.state === "spawn") continue;
    if (rectDist(pr.x, pr.y, bodyRect(e)) > pr.r) continue;
    const key = e.id + pr.phase * 100000;
    if (pr.hits.includes(key)) continue;
    pr.hits.push(key);
    if (g.shieldBlocks(e, pr.x - Math.sign(pr.vx) * 8)) {
      g.blockFx(e, pr.x);
      return 2;
    }
    g.killEnemy(e, cause, Math.sign(pr.vx) || 1);
    result = 1;
    pr.pierce--;
    if (pr.pierce <= 0) return 1;
  }
  return result;
}

function hitBarrels(g: Game, pr: Proj) {
  for (const b of g.barrels) {
    if (!b.alive || b.fuse >= 0) continue;
    if (rectDist(pr.x, pr.y, { x: b.x - b.w / 2, y: b.y - b.h, w: b.w, h: b.h }) <= pr.r) {
      g.igniteBarrel(b, 0.04);
      return true;
    }
  }
  return false;
}

export function updateProjs(g: Game, dt: number) {
  let p = g.player;
  for (let i = g.projs.length - 1; i >= 0; i--) {
    const pr = g.projs[i];
    if (i >= g.projs.length) continue;
    // projectile d'un joueur : son lanceur est le joueur « actif »
    if (pr.owner === "p") p = g.player = g.players[pr.pi ?? 0] ?? g.players[0];
    const slow = pr.owner === "e" ? g.slowFactor(pr.x, pr.y) : 1;
    pr.slowed = slow < 1;
    const d = dt * slow;
    pr.life -= d;
    pr.t += d;
    pr.rot += d * 14;
    let remove = pr.life <= 0;

    if (pr.kind === "grenade") {
      const b = pr.body!;
      const ovx = b.vx;
      b.vy = Math.min(b.vy + 1500 * d, 1000);
      moveBody(b, d, g.platforms);
      if (b.wallHit) b.vx = -ovx * 0.5;
      if (b.impactVy > 110) {
        b.vy = -b.impactVy * 0.42;
        b.vx *= 0.75;
        g.sfx("land");
      } else if (b.onGround) b.vx *= 1 - Math.min(1, 6 * d);
      pr.x = b.x;
      pr.y = b.y - 5;
      if (b.y > H + 80 || b.x < -80 || b.x > W + 80) remove = true;
      else {
        for (const e of g.enemies) {
          if (e.alive && e.state !== "spawn" && overlap({ x: b.x - 6, y: b.y - 12, w: 12, h: 12 }, bodyRect(e))) {
            pr.life = 0;
            break;
          }
        }
        if (pr.life <= 0) {
          g.explode(pr.x, pr.y, 108, "grenade");
          g.projs.splice(i, 1);
        } else if (Math.random() < 0.3) g.burst(pr.x, pr.y, 1, "#ffe14a", 30, 2, 0.2, 0);
      }
      if (remove && g.projs[i] === pr) g.projs.splice(i, 1);
      continue;
    }

    if (pr.kind === "boomer") {
      if (pr.phase === 0) {
        pr.vx *= 1 - Math.min(1, 1.6 * d);
        pr.vy *= 1 - Math.min(1, 1.6 * d);
        if (pr.t > 0.34) {
          pr.phase = 1;
          pr.hits = [];
        }
      } else if (p.alive) {
        const ax = p.x - pr.x;
        const ay = p.y - 20 - pr.y;
        const l = Math.hypot(ax, ay) || 1;
        const sp = 700;
        pr.vx = approach(pr.vx, (ax / l) * sp, 4200 * d);
        pr.vy = approach(pr.vy, (ay / l) * sp, 4200 * d);
        if (l < 26) {
          p.ammo = Math.min(p.hero.maxAmmo, p.ammo + 1);
          g.sfx("catch");
          g.burst(p.x, p.y - 20, 6, p.hero.color, 120, 2.5, 0.3, 0);
          g.projs.splice(i, 1);
          continue;
        }
      }
      pr.x += pr.vx * d;
      pr.y += pr.vy * d;
      const res = hitEnemies(g, pr, "boomer");
      if (res === 2) {
        pr.phase = 1;
        pr.hits = [];
      }
      hitBarrels(g, pr);
      // eat enemy bullets
      for (let j = g.projs.length - 1; j >= 0; j--) {
        const o = g.projs[j];
        if (o.owner === "e" && Math.hypot(o.x - pr.x, o.y - pr.y) < pr.r + o.r + 6) {
          g.burst(o.x, o.y, 6, "#ffd27a", 160, 2.5, 0.25, 0);
          g.award(25, "DÉVIÉ", o.x, o.y, p.hero.color);
          g.projs.splice(j, 1);
          if (j < i) i--;
        }
      }
      if (pr.life <= 0 || pr.x < -100 || pr.x > W + 100 || pr.y > H + 100 || pr.y < -150) {
        g.projs.splice(i, 1);
        if (p.alive) p.ammo = Math.min(p.hero.maxAmmo, p.ammo + 1);
      }
      continue;
    }

    // bullet / kunai / disc : straight movers
    const nx = pr.x + pr.vx * d;
    const ny = pr.y + pr.vy * d;
    if (pr.kind === "disc") {
      let bounced = false;
      if (pointInSolid(nx, pr.y, g.platforms)) {
        pr.vx = -pr.vx;
        bounced = true;
      } else pr.x = nx;
      if (pointInSolid(pr.x, ny, g.platforms)) {
        pr.vy = -pr.vy;
        bounced = true;
      } else pr.y = ny;
      if (bounced) {
        pr.bounces--;
        g.burst(pr.x, pr.y, 6, pr.owner === "p" ? p.hero.color : "#fff", 160, 2.5, 0.25, 0);
        g.sfx("block");
        if (pr.bounces < 0) remove = true;
      } else if (!pr.near && !(pr.t % 0.05 > 0.04)) g.burst(pr.x, pr.y, 1, p.hero.color, 20, 2.5, 0.25, 0);
    } else {
      if (pointInSolid(nx, ny, g.platforms)) {
        g.burst(nx, ny, 7, pr.owner === "e" ? "#ffb02e" : p.hero.color, 170, 2.5, 0.25, 0.5);
        g.addFx("ring", nx, ny, 0, 0.15, "#fff", 0.3, 1);
        remove = true;
      } else {
        pr.x = nx;
        pr.y = ny;
      }
    }
    if (pr.x < -80 || pr.x > W + 80 || pr.y < -150 || pr.y > H + 120) remove = true;

    if (!remove) {
      if (pr.owner === "e") {
        for (const pl of g.players) {
          if (remove || pr.owner !== "e" || !pl.alive) continue;
          p = g.player = pl;
          const hr = g.hurtRect();
          const dist = rectDist(pr.x, pr.y, hr);
          if (dist < pr.r) {
            const front = Math.sign(pr.x - p.x) === p.face;
            if (p.parryT > 0 && front) {
              pr.owner = "p";
              pr.vx *= -1.4;
              pr.vy *= -1.4;
              pr.reflected = true;
              pr.life = 3;
              pr.hits = [];
              pr.pi = g.players.indexOf(p);
              g.onParry(pr.x, pr.y);
              g.award(100, "RENVOI", pr.x, pr.y - 12, p.hero.color);
            } else if (p.inv <= 0) {
              g.killPlayer("bullet");
              remove = true;
            }
          }
          if (!remove && !pr.near && pr.owner === "e" && pr.t > 0.08 && dist < 26 && dist >= pr.r) {
            pr.near = true;
            g.closeCall(pr.x, pr.y);
          }
        }
      } else {
        if (pr.kind === "bullet" || pr.kind === "kunai" || pr.kind === "disc") {
          const res = hitEnemies(g, pr, pr.reflected ? "reflect" : "throw");
          if (res === 2) {
            if (pr.kind === "disc") pr.bounces = -1;
            remove = true;
          } else if (res === 1 && pr.pierce <= 0) remove = true;
          if (!remove && hitBarrels(g, pr) && pr.kind !== "disc") remove = true;
        }
      }
    }
    if (remove) g.projs.splice(i, 1);
  }
}
