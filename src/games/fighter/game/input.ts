// Unified input: keyboard (physical key codes => works on QWERTY & AZERTY), touch, gamepad.

export interface Ctrl {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jumpHeld: boolean;
  jumpPress: boolean;
  attackPress: boolean;
  specialPress: boolean;
}

export const emptyCtrl = (): Ctrl => ({
  left: false, right: false, up: false, down: false,
  jumpHeld: false, jumpPress: false, attackPress: false, specialPress: false,
});

const LEFT = ["ArrowLeft", "KeyA"];
const RIGHT = ["ArrowRight", "KeyD"];
const UP = ["ArrowUp", "KeyW"];
const DOWN = ["ArrowDown", "KeyS"];
const JUMP = ["Space"];
const ATTACK = ["KeyJ", "KeyX"];
const SPECIAL = ["KeyK", "KeyC", "ShiftLeft", "ShiftRight"];
const GAME_KEYS = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN, ...JUMP, ...ATTACK, ...SPECIAL]);

type Edge = "jump" | "attack" | "special";

class InputState {
  private down = new Set<string>();
  touch = { left: false, right: false, up: false, down: false, jump: false };
  private pad = { left: false, right: false, up: false, down: false, jump: false, attack: false, special: false, start: false };
  private pressed: Record<Edge, boolean> = { jump: false, attack: false, special: false };
  padStartEdge = false;
  private padUp = false;
  /** Manette téléphone (Party Kit) : direction analogique, boutons maintenus, compteurs d'appuis. */
  private ph = { dx: 0, dy: 0, held: 0 };
  private phBtn: number[] | null = null;

  /**
   * État de la manette téléphone active (ou null si déconnectée).
   * Boutons : 0 saut, 1 attaque, 2 spécial, 3 pause.
   * Retourne les indices des boutons qui viennent d'être appuyés.
   */
  setPhone(p: { dx: number; dy: number; held: number; btn: number[] } | null): number[] {
    if (!p) {
      this.ph = { dx: 0, dy: 0, held: 0 };
      this.phBtn = null;
      return [];
    }
    const wasUp = this.ph.dy < -0.65;
    this.ph = { dx: p.dx, dy: p.dy, held: p.held };
    const prev = this.phBtn;
    const out: number[] = [];
    p.btn.forEach((n, i) => {
      // premier message : pas d'appui ; compteur qui redescend = manette rechargée
      const old = prev ? (prev[i] ?? 0) : n;
      if (n > old || (n < old && n > 0)) out.push(i);
    });
    this.phBtn = p.btn.slice();
    for (const i of out) {
      if (i === 0) this.press("jump");
      else if (i === 1) this.press("attack");
      else if (i === 2) this.press("special");
      else if (i === 3) this.padStartEdge = true;
    }
    if (this.ph.dy < -0.65 && !wasUp) this.press("jump");
    return out;
  }

  press(e: Edge) {
    this.pressed[e] = true;
  }

  private any(codes: string[]) {
    for (const c of codes) if (this.down.has(c)) return true;
    return false;
  }

  keyDown(e: KeyboardEvent): boolean {
    if (!GAME_KEYS.has(e.code)) return false;
    if (!e.repeat && !this.down.has(e.code)) {
      if (JUMP.includes(e.code) || UP.includes(e.code)) this.press("jump");
      if (ATTACK.includes(e.code)) this.press("attack");
      if (SPECIAL.includes(e.code)) this.press("special");
    }
    this.down.add(e.code);
    return true;
  }

  keyUp(e: KeyboardEvent) {
    this.down.delete(e.code);
  }

  ctrl(): Ctrl {
    const t = this.touch;
    const p = this.pad;
    const h = this.ph;
    const up = this.any(UP) || t.up || p.up || h.dy < -0.65;
    return {
      left: this.any(LEFT) || t.left || p.left || h.dx < -0.4,
      right: this.any(RIGHT) || t.right || p.right || h.dx > 0.4,
      up,
      down: this.any(DOWN) || t.down || p.down || h.dy > 0.65,
      jumpHeld: this.any(JUMP) || up || t.jump || p.jump || (h.held & 1) !== 0,
      jumpPress: this.pressed.jump,
      attackPress: this.pressed.attack,
      specialPress: this.pressed.special,
    };
  }

  clearEdges() {
    this.pressed.jump = false;
    this.pressed.attack = false;
    this.pressed.special = false;
  }

  reset() {
    this.down.clear();
    this.touch = { left: false, right: false, up: false, down: false, jump: false };
    this.padStartEdge = false;
    this.clearEdges();
  }

  pollPad() {
    const nav = navigator as Navigator & { getGamepads?: () => (Gamepad | null)[] };
    const list = nav.getGamepads ? Array.from(nav.getGamepads()) : [];
    const gp = list.find((g) => g && g.connected);
    const p = this.pad;
    if (!gp) {
      p.left = p.right = p.up = p.down = p.jump = p.attack = p.special = false;
      return;
    }
    const b = (i: number) => !!gp.buttons[i]?.pressed;
    const ax = gp.axes[0] || 0;
    const ay = gp.axes[1] || 0;
    p.left = ax < -0.4 || b(14);
    p.right = ax > 0.4 || b(15);
    p.up = ay < -0.65 || b(12);
    p.down = ay > 0.65 || b(13);
    const jump = b(0);
    const attack = b(2) || b(1);
    const special = b(3) || b(5) || b(7);
    const start = b(9);
    if (jump && !p.jump) this.press("jump");
    if (attack && !p.attack) this.press("attack");
    if (special && !p.special) this.press("special");
    if (p.up && !this.padUp) this.press("jump");
    this.padUp = p.up;
    if (start && !p.start) this.padStartEdge = true;
    p.jump = jump;
    p.attack = attack;
    p.special = special;
    p.start = start;
  }
}

export const input = new InputState();
