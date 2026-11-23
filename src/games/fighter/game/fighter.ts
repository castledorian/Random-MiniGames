import { ATK, GRAV, MAX_FALL, FAST_FALL, type AttackDef, type HeroDef, type Platform, type Rect } from "./constants";
import type { Ctrl } from "./input";
import type { AI } from "./ai";
import type { Game } from "./game";
import { audio } from "./audio";

export interface ActiveAttack {
  def: AttackDef;
  t: number;
  hit: Set<number>;
  fired: boolean;
  spd: number;
}

export interface FighterOpts {
  team: 0 | 1;
  stocks: number;
  isPlayer?: boolean;
  ai?: AI | null;
  scale?: number;
  boss?: boolean;
  dmgMult?: number;
  weightMult?: number;
  name?: string;
  level?: number;
}

const approach = (v: number, target: number, d: number) => (v < target ? Math.min(v + d, target) : Math.max(v - d, target));

let NEXT_ID = 1;

export class Fighter {
  readonly id = NEXT_ID++;
  team: 0 | 1;
  hero: HeroDef;
  ai: AI | null;
  isPlayer: boolean;
  boss: boolean;
  name: string;
  scale: number;
  dmgMult: number;
  weightMult: number;
  level: number;

  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  w: number;
  h: number;
  facing: 1 | -1 = 1;
  onGround = false;
  groundPlat: Platform | null = null;
  coyote = 0;
  jumpsLeft: number;
  jumping = false;
  lastJumpT = -9;
  fastFall = false;

  percent = 0;
  stocks: number;
  state: "alive" | "dead" | "waiting" = "alive";
  stateT = 0;
  removed = false;
  invuln = 0;
  hitstun = 0;
  freeze = 0;
  flash = 0;
  spin = 0;
  spinSpeed = 0;

  attack: ActiveAttack | null = null;
  comboStep = 0;
  comboT = 0;
  cd = 0;
  shieldT = 0;
  shieldAge = 0;
  shieldFlash = 0;
  dashT = 0;
  dashDir: 1 | -1 = 1;
  dashHit = new Set<number>();
  trailT = 0;

  bufJump = 0;
  bufAtk = 0;
  bufSpc = 0;
  dropT = 0;
  downT = 0;

  t = 0;
  runPhase = 0;
  squash = 0;
  squashV = 0;
  regenT = 0;
  noHitT = 0;
  lastHitBy: Fighter | null = null;
  lastHitT = -99;
  hitGroups: number[] = [];
  takenMult = 1;
  shownPct = 0;
  pop = 0;
  lastAngle = 0;

  constructor(hero: HeroDef, o: FighterOpts) {
    this.hero = hero;
    this.team = o.team;
    this.stocks = o.stocks;
    this.isPlayer = !!o.isPlayer;
    this.ai = o.ai || null;
    this.scale = o.scale || 1;
    this.boss = !!o.boss;
    this.dmgMult = o.dmgMult || 1;
    this.weightMult = o.weightMult || 1;
    this.name = o.name || hero.name;
    this.level = o.level || 0;
    this.w = hero.w * this.scale;
    this.h = hero.h * this.scale;
    this.jumpsLeft = hero.airJumps;
  }

  rect(): Rect {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  get feet() {
    return this.y + this.h / 2;
  }

  armor() {
    return this.hero.id === "basalt" ? 1 - Math.min(0.45, this.percent * 0.0035) : 1;
  }

  spawnIn(x: number, y: number, invuln: number) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.percent = 0;
    this.state = "alive";
    this.invuln = invuln;
    this.hitstun = 0;
    this.freeze = 0;
    this.attack = null;
    this.dashT = 0;
    this.shieldT = 0;
    this.cd = 0;
    this.jumpsLeft = this.hero.airJumps;
    this.onGround = false;
    this.groundPlat = null;
    this.spin = 0;
    this.flash = 0;
    this.comboStep = 0;
    this.comboT = 0;
    this.bufAtk = this.bufJump = this.bufSpc = 0;
    this.noHitT = 0;
    this.squash = 0;
    this.squashV = 0;
    this.fastFall = false;
    this.hitGroups.length = 0;
  }

  private isBusy() {
    const a = this.attack;
    if (!a) return false;
    return a.t < a.def.startup + a.def.active + a.def.recovery * 0.45;
  }

  update(dt: number, c: Ctrl, g: Game) {
    this.t += dt;
    if (this.state !== "alive") return;
    if (c.jumpPress) this.bufJump = 0.13;
    if (c.attackPress) this.bufAtk = 0.17;
    if (c.specialPress) this.bufSpc = 0.17;
    if (this.freeze > 0) {
      this.freeze -= dt;
      return;
    }
    this.invuln = Math.max(0, this.invuln - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.shieldFlash = Math.max(0, this.shieldFlash - dt);
    this.coyote = Math.max(0, this.coyote - dt);
    this.bufJump = Math.max(0, this.bufJump - dt);
    this.bufAtk = Math.max(0, this.bufAtk - dt);
    this.bufSpc = Math.max(0, this.bufSpc - dt);
    this.cd = Math.max(0, this.cd - dt);
    this.comboT = Math.max(0, this.comboT - dt);
    this.dropT = Math.max(0, this.dropT - dt);
    this.noHitT += dt;

    if (this.hitstun > 0) {
      this.hitstun -= dt;
      this.vx = approach(this.vx, 0, (this.onGround ? 2600 : 1300) * dt);
      this.spin += this.spinSpeed * dt;
      if (this.hitstun <= 0) {
        this.spin = ((this.spin + Math.PI) % (Math.PI * 2)) - Math.PI;
      }
    } else {
      this.spin -= this.spin * Math.min(1, 14 * dt);
      this.control(dt, c, g);
    }
    this.physics(dt, g);
    this.animate(dt);

    // passive: Kira slowly regenerates when out of combat
    if (this.hero.id === "kira" && this.noHitT > 2.5 && this.percent > 0) {
      this.percent = Math.max(0, this.percent - 1.8 * dt);
      this.regenT -= dt;
      if (this.regenT <= 0) {
        this.regenT = 0.22;
        g.fx.emit("dot", this.x + (Math.random() - 0.5) * this.w, this.y + this.h * 0.2, 0, -50, 0.7, 3.5, "#6dffa8", { add: true });
      }
    }
  }

  private control(dt: number, c: Ctrl, g: Game) {
    const hero = this.hero;
    const dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
    const speed = hero.speed * (this.boss ? 0.92 : 1);

    // ------------------------------------------------ dash (special)
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.dashDir * 1150;
      this.vy = 0;
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.016;
        g.fx.emit("ghost", this.x, this.y, 0, 0, 0.3, 0, hero.color, { w: this.w * 1.1, h: this.h });
      }
      g.checkDashHit(this);
      if (this.dashT <= 0) this.vx *= 0.3;
      return;
    }

    // ------------------------------------------------ shield (special)
    if (this.shieldT > 0) {
      this.shieldT -= dt;
      this.shieldAge += dt;
      if (this.bufJump > 0 || (this.bufSpc > 0 && this.shieldAge > 0.3)) {
        this.bufSpc = 0;
        this.shieldT = 0;
      } else {
        if (dir) this.facing = dir as 1 | -1;
        this.vx = approach(this.vx, dir * speed * 0.3, 3200 * dt);
        if (this.shieldT <= 0) g.shieldPulse(this);
        return;
      }
    }

    // ------------------------------------------------ attack progress
    const a = this.attack;
    let afterActive = true;
    if (a) {
      const d = a.def;
      a.t += dt * a.spd;
      const endActive = d.startup + d.active;
      const total = endActive + d.recovery;
      if (!a.fired && a.t >= d.startup) {
        a.fired = true;
        this.onAttackActive(g, a);
      }
      if (a.t >= d.startup && a.t < endActive && d.box) g.checkMelee(this, a);
      if (a.t >= total) {
        this.attack = null;
        if (d.chain) this.comboT = 0.3;
      } else {
        afterActive = a.t >= endActive;
      }
    }

    // ------------------------------------------------ jump
    if (this.bufJump > 0 && afterActive) {
      if (this.onGround || this.coyote > 0) this.doJump(g, false, dir);
      else if (this.jumpsLeft > 0) this.doJump(g, true, dir);
    }
    if (!c.jumpHeld && this.jumping && this.vy < -380) {
      this.vy *= 0.5;
      this.jumping = false;
    }

    // ------------------------------------------------ attack / special start
    const busyNow = this.isBusy();
    if (this.bufAtk > 0 && !busyNow) {
      this.startAttack(c);
    } else if (this.bufSpc > 0 && !busyNow && this.cd <= 0) {
      this.startSpecial(c, g);
      if (this.dashT > 0 || this.shieldT > 0) return;
    }

    // ------------------------------------------------ drop through soft platforms
    if (this.onGround && this.groundPlat && !this.groundPlat.solid && c.down && !this.attack) {
      this.downT += dt;
      if (this.downT > 0.07 && this.bufAtk <= 0) {
        this.dropT = 0.25;
        this.onGround = false;
        this.groundPlat = null;
        this.y += 2;
        this.downT = 0;
      }
    } else {
      this.downT = 0;
    }
    if (!this.onGround && c.down && this.vy > 0) this.fastFall = true;

    // ------------------------------------------------ horizontal movement
    if (!this.isBusy()) {
      if (dir !== 0) this.facing = dir as 1 | -1;
      const accel = this.onGround ? 5600 : 2800;
      if (dir !== 0) {
        const tgt = dir * speed;
        if (Math.abs(this.vx) > speed * 1.02 && Math.sign(this.vx) === dir) this.vx = approach(this.vx, tgt, 1500 * dt);
        else this.vx = approach(this.vx, tgt, accel * dt);
      } else {
        this.vx = approach(this.vx, 0, (this.onGround ? 5200 : 650) * dt);
      }
    } else {
      this.vx = approach(this.vx, 0, (this.onGround ? 700 : 450) * dt);
    }
  }

  private doJump(g: Game, air: boolean, dir: number) {
    const h = this.hero;
    this.bufJump = 0;
    this.coyote = 0;
    this.jumping = true;
    this.lastJumpT = this.t;
    this.fastFall = false;
    this.attack = null;
    this.onGround = false;
    this.groundPlat = null;
    if (air) {
      this.jumpsLeft--;
      this.vy = -h.airJump;
      if (dir !== 0 && Math.sign(this.vx) !== dir) this.vx = dir * h.speed * 0.6;
      g.fx.ring(this.x, this.feet, 10, 150, 0.32, h.accent);
      g.fx.sparks(this.x, this.feet, 6, Math.PI / 2, 1.2, 100, 260, h.accent, 0.3, 2);
      audio.play("airjump");
    } else {
      this.vy = -h.jump;
      g.fx.dust(this.x, this.feet, 5);
      audio.play("jump");
    }
    this.squash = 0.38;
    this.squashV = 0;
  }

  private startAttack(c: Ctrl) {
    this.bufAtk = 0;
    if (c.left && !c.right) this.facing = -1;
    else if (c.right && !c.left) this.facing = 1;
    const air = !this.onGround;
    const aimUp = c.up && this.t - this.lastJumpT > 0.2;
    let def: AttackDef;
    if (aimUp) {
      def = ATK.upper;
      this.comboStep = 0;
    } else if (c.down) {
      def = air ? ATK.dair : ATK.sweep;
      this.comboStep = 0;
    } else if (air) {
      def = ATK.nair;
      this.comboStep = 0;
    } else {
      const continuing = this.comboT > 0 || (this.attack !== null && !!this.attack.def.chain);
      const step = continuing ? this.comboStep % 3 : 0;
      def = step === 0 ? ATK.jab1 : step === 1 ? ATK.jab2 : ATK.jab3;
      this.comboStep = step === 2 ? 0 : step + 1;
    }
    this.attack = { def, t: 0, hit: new Set(), fired: false, spd: this.hero.atkSpeed };
    this.invuln = Math.min(this.invuln, 0.25);
  }

  private startSpecial(c: Ctrl, g: Game) {
    this.bufSpc = 0;
    const s = this.hero.special;
    if (c.left && !c.right) this.facing = -1;
    else if (c.right && !c.left) this.facing = 1;
    this.cd = s.cd;
    this.invuln = Math.min(this.invuln, 0.25);
    switch (s.id) {
      case "bolt":
        this.attack = { def: ATK.bolt, t: 0, hit: new Set(), fired: false, spd: 1 };
        break;
      case "fan":
        this.attack = { def: ATK.fan, t: 0, hit: new Set(), fired: false, spd: 1 };
        break;
      case "dash":
        this.attack = null;
        this.dashDir = this.facing;
        this.dashT = 0.2;
        this.dashHit.clear();
        this.vy = 0;
        audio.play("dash");
        g.fx.ring(this.x, this.y, 14, 200, 0.3, this.hero.accent);
        g.fx.sparks(this.x, this.y, 12, this.dashDir === 1 ? Math.PI : 0, 0.6, 200, 600, this.hero.accent, 0.35);
        g.addShake(4);
        break;
      case "shield":
        this.attack = null;
        this.shieldT = 1.5;
        this.shieldAge = 0;
        this.vx *= 0.3;
        audio.play("shield");
        g.fx.ring(this.x, this.y, 20, 260, 0.35, this.hero.accent);
        break;
    }
  }

  private onAttackActive(g: Game, a: ActiveAttack) {
    const d = a.def;
    if (d.spawn) {
      g.spawnProjectiles(this, d.spawn);
      return;
    }
    if (d.lunge && this.onGround) this.vx = this.facing * d.lunge * 1.3;
    audio.play("whoosh");
    if (d.arc === "up" && !this.onGround) this.vy = Math.min(this.vy, -120);
  }

  private applyGravity(dt: number) {
    if (this.dashT > 0) return;
    let gm = this.hitstun > 0 ? 0.62 : 1;
    if (this.hitstun <= 0 && !this.onGround && Math.abs(this.vy) < 140) gm *= 0.78;
    this.vy += GRAV * gm * dt;
    const maxFall = this.fastFall ? FAST_FALL : MAX_FALL;
    if (this.hitstun <= 0 && this.vy > maxFall) this.vy = maxFall;
  }

  private physics(dt: number, g: Game) {
    const hw = this.w / 2;
    const hh = this.h / 2;
    const plats = g.stage.platforms;
    const prevBottom = this.y + hh;
    const prevTop = this.y - hh;
    const wasGround = this.onGround;

    this.applyGravity(dt);

    // --- horizontal
    this.x += this.vx * dt;
    for (const p of plats) {
      if (!p.solid) continue;
      if (this.x + hw > p.x && this.x - hw < p.x + p.w && this.y + hh > p.y + 2 && this.y - hh < p.y + p.h) {
        if (this.x < p.x + p.w / 2) this.x = p.x - hw;
        else this.x = p.x + p.w + hw;
        if (this.hitstun > 0 && Math.abs(this.vx) > 500) {
          g.onWallBounce(this, this.vx);
          this.vx = -this.vx * 0.35;
        } else {
          this.vx = 0;
        }
      }
    }

    // --- vertical
    this.y += this.vy * dt;
    let grounded = false;
    let landSpeed = 0;
    const bottom = this.y + hh;
    const top = this.y - hh;
    for (const p of plats) {
      if (this.x + hw <= p.x + 1 || this.x - hw >= p.x + p.w - 1) continue;
      let land = false;
      if (p.solid) {
        if (bottom > p.y && top < p.y + p.h) {
          if (this.vy >= 0 && prevBottom <= p.y + 10) land = true;
          else if (this.vy < 0 && prevTop >= p.y + p.h - 10) {
            this.y = p.y + p.h + hh;
            this.vy = this.hitstun > 0 ? -this.vy * 0.3 : 0;
          }
        }
      } else if (this.vy >= 0 && this.dropT <= 0 && prevBottom <= p.y + 3 && bottom >= p.y) {
        land = true;
      }
      if (land) {
        const impact = this.vy;
        this.y = p.y - hh;
        if (this.hitstun > 0 && impact > 650) {
          this.vy = -impact * 0.4;
          g.onBounce(this, impact);
        } else {
          landSpeed = impact;
          this.vy = 0;
          grounded = true;
          this.groundPlat = p;
        }
      }
    }
    this.onGround = grounded;
    if (grounded) {
      if (!wasGround && landSpeed > 260) this.onLand(g, landSpeed);
      this.coyote = 0.09;
      this.jumpsLeft = this.hero.airJumps;
      this.fastFall = false;
      this.jumping = false;
    } else {
      this.groundPlat = null;
    }
    if (this.vy > 0) this.jumping = false;
  }

  private onLand(g: Game, speed: number) {
    const k = Math.min(1, speed / 900);
    this.squash = -0.15 - 0.2 * k;
    this.squashV = 0;
    g.fx.dust(this.x, this.feet, 3 + Math.floor(k * 5), "#cfc7ff", 60 + 80 * k);
    if (speed > 500) audio.play("land");
  }

  private animate(dt: number) {
    if (this.onGround && Math.abs(this.vx) > 30) this.runPhase += Math.abs(this.vx) * dt * 0.034;
    else if (!this.onGround) this.runPhase += dt * 4;
    this.squashV += (-this.squash * 300 - this.squashV * 17) * dt;
    this.squash += this.squashV * dt;
  }
}
