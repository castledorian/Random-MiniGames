import { emptyCtrl, type Ctrl } from "./input";
import { HEAVY_HOLD } from "./constants";
import type { Fighter } from "./fighter";
import type { Game } from "./game";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Simple but readable AI. `level` in [0,1] tunes reaction time, aggression and recovery skill. */
export class AI {
  level: number;
  private timer: number;
  private ctrl: Ctrl = emptyCtrl();
  private jumpHold = 0;
  private atkHold = 0;
  private retreat = 0;
  private wasStunned = false;

  constructor(level: number) {
    this.level = Math.max(0, Math.min(1, level));
    this.timer = 0.5 + Math.random() * 0.4;
  }

  think(f: Fighter, g: Game, dt: number): Ctrl {
    const c = this.decide(f, g, dt);
    c.jumpHeld = this.jumpHold > 0;
    c.attackHeld = this.atkHold > 0;
    return c;
  }

  private decide(f: Fighter, g: Game, dt: number): Ctrl {
    const c = this.ctrl;
    c.jumpPress = c.attackPress = c.specialPress = false;
    this.timer -= dt;
    this.jumpHold -= dt;
    this.atkHold -= dt;
    this.retreat -= dt;
    if (f.charge >= 0 || f.pendAtk > 0) return c; // charge an attaque lourde : on maintient

    if (f.hitstun > 0) {
      this.wasStunned = true;
      return c;
    }
    if (this.wasStunned) {
      this.wasStunned = false;
      this.timer = Math.min(this.timer, 0.03 + (1 - this.level) * 0.15);
    }

    const lv = this.level;
    const recovering = this.needRecover(f, g);
    if (this.timer > 0) {
      // while recovering we still want snappy reactions
      if (!(recovering && this.timer > 0.07)) return c;
    }
    this.timer = recovering ? 0.07 : lerp(0.4, 0.1, lv) * (0.8 + Math.random() * 0.5);

    c.left = c.right = c.up = c.down = false;

    if (recovering) {
      this.recover(f, g, c);
      return c;
    }

    const target = g.targetFor(f);
    const sp = f.hero.special.id;
    if (!target) {
      const dx = 640 - f.x;
      if (Math.abs(dx) > 90) {
        c.left = dx < 0;
        c.right = dx > 0;
      }
      return c;
    }

    const dx = target.x - f.x;
    const dy = target.y - f.y;
    const adx = Math.abs(dx);
    const dir = dx > 0 ? 1 : -1;
    const range = 62 * f.scale * f.hero.reach + 18;
    const wouldFall = (d: number) => f.onGround && !g.groundAt(f.x + d * 48, f.feet);
    const careful = Math.random() < 0.3 + 0.65 * lv;
    const face = (d: number) => {
      c.left = d < 0;
      c.right = d > 0;
    };

    // --- react to incoming projectiles
    const threat = g.projectiles.find(
      (p) => p.alive && p.team !== f.team && Math.abs(p.y - f.y) < 55 && Math.abs(p.x - f.x) < 340 && Math.sign(p.vx) === Math.sign(f.x - p.x),
    );
    if (threat && Math.random() < lv * 0.8) {
      if (sp === "shield" && f.cd <= 0) {
        c.specialPress = true;
      } else if (f.onGround || f.jumpsLeft > 0) {
        c.jumpPress = true;
        this.jumpHold = 0.3;
        face(dir);
      }
      return c;
    }

    // --- shield against close attackers
    if (sp === "shield" && f.cd <= 0 && lv > 0.25 && adx < 150 && Math.abs(dy) < 80 && (target.attack || target.dashT > 0) && Math.random() < 0.5 + lv * 0.4) {
      c.specialPress = true;
      return c;
    }

    // --- retreat phase (hit & run)
    if (this.retreat > 0) {
      face(-dir);
      if (wouldFall(-dir)) {
        c.left = c.right = false;
      }
      return c;
    }

    // --- target above us
    if (dy < -95 && adx < 280) {
      if (adx < 60 && !f.onGround && dy > -170 && Math.random() < 0.4 + lv * 0.5) {
        c.up = true;
        c.attackPress = true;
        face(dir);
        return c;
      }
      face(dir);
      if ((f.onGround || (f.jumpsLeft > 0 && f.vy > -100)) && Math.random() < 0.35 + lv * 0.5) {
        c.jumpPress = true;
        this.jumpHold = 0.32;
      }
      return c;
    }

    // --- target below us on a lower platform
    if (dy > 110 && f.onGround && f.groundPlat && !f.groundPlat.solid && adx < 200) {
      c.down = true;
      face(dir);
      return c;
    }

    if (adx > range) {
      // ranged / gap closer specials
      if (f.cd <= 0 && Math.abs(dy) < 90 && Math.random() < 0.12 + 0.55 * lv) {
        const ok = (sp === "bolt" && adx > 170 && adx < 640) || (sp === "fan" && adx > 110 && adx < 330) || (sp === "dash" && adx > 150 && adx < 430);
        if (ok) {
          face(dir);
          c.specialPress = true;
          return c;
        }
      }
      // approach
      if (!(wouldFall(dir) && careful)) face(dir);
      if (lv > 0.3 && f.onGround && Math.random() < 0.07) {
        c.jumpPress = true;
        this.jumpHold = 0.25;
      }
    } else {
      // in range: strike
      face(dir);
      f.facing = dir as 1 | -1;
      // attaque lourde pour finir une cible bien entamée
      if (f.onGround && Math.abs(dy) < 50 && target.percent > 75 - 25 * lv && Math.random() < 0.18 + 0.32 * lv) {
        c.attackPress = true;
        this.atkHold = HEAVY_HOLD + 0.1 + Math.random() * (0.25 + 0.45 * lv);
        return c;
      }
      if (Math.random() < 0.35 + 0.6 * lv) {
        c.attackPress = true;
        if (dy < -55) c.up = true;
        else if (dy > 55 && !f.onGround) c.down = true;
        if (lv > 0.45 && Math.random() < 0.2) this.retreat = 0.28 + Math.random() * 0.2;
      } else if (Math.random() < 0.25) {
        face(-dir);
        if (wouldFall(-dir)) c.left = c.right = false;
      }
    }
    return c;
  }

  private needRecover(f: Fighter, g: Game): boolean {
    if (f.onGround || f.hitstun > 0 || f.dashT > 0) return false;
    if (f.vy < -120) return false;
    return !g.overPlatform(f.x, f.feet);
  }

  private recover(f: Fighter, g: Game, c: Ctrl) {
    const t = g.recoverTarget(f);
    const dx = t.x - f.x;
    c.left = dx < -10;
    c.right = dx > 10;
    const skill = 0.5 + 0.5 * this.level;
    if (f.vy > -80 && f.feet > t.y - 12) {
      if (f.jumpsLeft > 0 && Math.random() < skill) {
        c.jumpPress = true;
        this.jumpHold = 0.35;
      } else if (f.jumpsLeft <= 0 && f.cd <= 0 && f.hero.special.id === "dash" && Math.abs(dx) > 80 && Math.random() < skill) {
        c.specialPress = true;
      }
    }
  }
}
