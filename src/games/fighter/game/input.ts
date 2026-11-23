// Unified input: keyboard (physical key codes => works on QWERTY & AZERTY), touch, gamepads, phones.
//
// Two ways to read it:
// - ctrl()          : everything merged (solo modes: any device drives the hero)
// - ctrlOf(device)  : one device only (versus): "kbA", "kbB", "gp0".."gp3", "ph:<pid>"

export interface Ctrl {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jumpHeld: boolean;
  jumpPress: boolean;
  attackPress: boolean;
  /** Attack button kept down (hold = heavy attack). */
  attackHeld: boolean;
  specialPress: boolean;
}

export const emptyCtrl = (): Ctrl => ({
  left: false, right: false, up: false, down: false,
  jumpHeld: false, jumpPress: false, attackPress: false, attackHeld: false, specialPress: false,
});

// ---- solo (merged) layout: arrows + WASD, Space jump, J/X attack, K/C special
const LEFT = ["ArrowLeft", "KeyA"];
const RIGHT = ["ArrowRight", "KeyD"];
const UP = ["ArrowUp", "KeyW"];
const DOWN = ["ArrowDown", "KeyS"];
const JUMP = ["Space"];
const ATTACK = ["KeyJ", "KeyX", "KeyF", "Enter", "NumpadEnter", "Numpad0"];
const SPECIAL = ["KeyK", "KeyC", "KeyG", "ShiftLeft", "ShiftRight", "Numpad1"];

// ---- versus layouts (two players on one keyboard)
interface Scheme {
  left: string[];
  right: string[];
  up: string[];
  down: string[];
  jump: string[];
  attack: string[];
  special: string[];
}
export const SCHEMES: Record<"kbA" | "kbB", Scheme> = {
  // ZQSD / WASD + Espace (saut) + F (attaque) + G (spécial)
  kbA: { left: ["KeyA"], right: ["KeyD"], up: ["KeyW"], down: ["KeyS"], jump: ["Space", "KeyW"], attack: ["KeyF"], special: ["KeyG", "ShiftLeft"] },
  // Flèches (↑ saut) + Entrée / L (attaque) + Maj droite / M (spécial)
  kbB: {
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
    up: ["ArrowUp"],
    down: ["ArrowDown"],
    jump: ["ArrowUp"],
    attack: ["Enter", "NumpadEnter", "Numpad0", "KeyL"],
    special: ["ShiftRight", "Numpad1", "Semicolon"],
  },
};

const GAME_KEYS = new Set<string>([
  ...LEFT, ...RIGHT, ...UP, ...DOWN, ...JUMP, ...ATTACK, ...SPECIAL,
  ...Object.values(SCHEMES).flatMap((s) => [...s.left, ...s.right, ...s.up, ...s.down, ...s.jump, ...s.attack, ...s.special]),
]);

type Edge = "jump" | "attack" | "special";
type Edges = Record<Edge, boolean>;
const noEdges = (): Edges => ({ jump: false, attack: false, special: false });

interface PadState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  attack: boolean;
  special: boolean;
  start: boolean;
}
const noPad = (): PadState => ({ left: false, right: false, up: false, down: false, jump: false, attack: false, special: false, start: false });

interface PhoneState {
  dx: number;
  dy: number;
  held: number;
  btn: number[] | null;
}

class InputState {
  private down = new Set<string>();
  touch = { left: false, right: false, up: false, down: false, jump: false, attack: false };
  /** Merged edges (solo). */
  private pressed: Edges = noEdges();
  /** Per-device edges (versus). */
  private devEdges = new Map<string, Edges>();
  private pads = new Map<number, PadState>();
  private phones = new Map<string, PhoneState>();
  padStartEdge = false;

  private edge(dev: string, e: Edge) {
    let d = this.devEdges.get(dev);
    if (!d) this.devEdges.set(dev, (d = noEdges()));
    d[e] = true;
  }

  /** Press on the merged controller (touch buttons, solo). */
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
      const c = e.code;
      if (JUMP.includes(c) || UP.includes(c)) this.press("jump");
      if (ATTACK.includes(c)) this.press("attack");
      if (SPECIAL.includes(c)) this.press("special");
      for (const k of ["kbA", "kbB"] as const) {
        const s = SCHEMES[k];
        if (s.jump.includes(c)) this.edge(k, "jump");
        if (s.attack.includes(c)) this.edge(k, "attack");
        if (s.special.includes(c)) this.edge(k, "special");
      }
    }
    this.down.add(e.code);
    return true;
  }

  keyUp(e: KeyboardEvent) {
    this.down.delete(e.code);
  }

  /** All devices merged (solo modes). */
  ctrl(): Ctrl {
    const t = this.touch;
    let pl = false, pr = false, pu = false, pd = false, pj = false, pa = false;
    this.pads.forEach((p) => {
      pl ||= p.left; pr ||= p.right; pu ||= p.up; pd ||= p.down; pj ||= p.jump; pa ||= p.attack;
    });
    let hl = false, hr = false, hu = false, hd = false, hj = false, ha = false;
    this.phones.forEach((h) => {
      hl ||= h.dx < -0.4; hr ||= h.dx > 0.4; hu ||= h.dy < -0.65; hd ||= h.dy > 0.65;
      hj ||= (h.held & 1) !== 0; ha ||= (h.held & 2) !== 0;
    });
    const up = this.any(UP) || t.up || pu || hu;
    return {
      left: this.any(LEFT) || t.left || pl || hl,
      right: this.any(RIGHT) || t.right || pr || hr,
      up,
      down: this.any(DOWN) || t.down || pd || hd,
      jumpHeld: this.any(JUMP) || up || t.jump || pj || hj,
      jumpPress: this.pressed.jump,
      attackPress: this.pressed.attack,
      attackHeld: this.any(ATTACK) || t.attack || pa || ha,
      specialPress: this.pressed.special,
    };
  }

  /** One device only (versus). */
  ctrlOf(dev: string): Ctrl {
    const e = this.devEdges.get(dev) ?? noEdges();
    if (dev === "kbA" || dev === "kbB") {
      const s = SCHEMES[dev];
      const up = this.any(s.up);
      return {
        left: this.any(s.left),
        right: this.any(s.right),
        up,
        down: this.any(s.down),
        jumpHeld: this.any(s.jump) || up,
        jumpPress: e.jump,
        attackPress: e.attack,
        attackHeld: this.any(s.attack),
        specialPress: e.special,
      };
    }
    if (dev.startsWith("gp")) {
      const p = this.pads.get(Number(dev.slice(2))) ?? noPad();
      return { left: p.left, right: p.right, up: p.up, down: p.down, jumpHeld: p.jump || p.up, jumpPress: e.jump, attackPress: e.attack, attackHeld: p.attack, specialPress: e.special };
    }
    if (dev.startsWith("ph:")) {
      const h = this.phones.get(dev.slice(3));
      if (!h) return emptyCtrl();
      const up = h.dy < -0.65;
      return {
        left: h.dx < -0.4,
        right: h.dx > 0.4,
        up,
        down: h.dy > 0.65,
        jumpHeld: up || (h.held & 1) !== 0,
        jumpPress: e.jump,
        attackPress: e.attack,
        attackHeld: (h.held & 2) !== 0,
        specialPress: e.special,
      };
    }
    return emptyCtrl();
  }

  /** Devices that can join a versus match right now. */
  devices(): string[] {
    const out = ["kbA", "kbB"];
    this.pads.forEach((_, i) => out.push("gp" + i));
    this.phones.forEach((_, pid) => out.push("ph:" + pid));
    return out;
  }

  clearEdges() {
    this.pressed = noEdges();
    this.devEdges.clear();
  }

  reset() {
    this.down.clear();
    this.touch = { left: false, right: false, up: false, down: false, jump: false, attack: false };
    this.padStartEdge = false;
    this.clearEdges();
  }

  /**
   * Phone controller state (Party Kit). Buttons: 0 jump, 1 attack, 2 special, 3 pause.
   * Held mask: bit 0 jump, bit 1 attack. Returns the buttons just pressed.
   */
  setPhone(pid: string, p: { dx: number; dy: number; held: number; btn: number[] } | null): number[] {
    if (!p) {
      this.phones.delete(pid);
      return [];
    }
    const prev = this.phones.get(pid);
    const wasUp = prev ? prev.dy < -0.65 : false;
    const out: number[] = [];
    p.btn.forEach((n, i) => {
      // first message: no press ; a counter going down = the phone page was reloaded
      const old = prev?.btn ? (prev.btn[i] ?? 0) : n;
      if (n > old || (n < old && n > 0)) out.push(i);
    });
    this.phones.set(pid, { dx: p.dx, dy: p.dy, held: p.held, btn: p.btn.slice() });
    const dev = "ph:" + pid;
    for (const i of out) {
      if (i === 0) {
        this.press("jump");
        this.edge(dev, "jump");
      } else if (i === 1) {
        this.press("attack");
        this.edge(dev, "attack");
      } else if (i === 2) {
        this.press("special");
        this.edge(dev, "special");
      } else if (i === 3) this.padStartEdge = true;
    }
    if (p.dy < -0.65 && !wasUp) {
      this.press("jump");
      this.edge(dev, "jump");
    }
    return out;
  }

  pollPad() {
    const nav = navigator as Navigator & { getGamepads?: () => (Gamepad | null)[] };
    const list = nav.getGamepads ? Array.from(nav.getGamepads()) : [];
    const seen = new Set<number>();
    for (const gp of list) {
      if (!gp || !gp.connected) continue;
      seen.add(gp.index);
      const b = (i: number) => !!gp.buttons[i]?.pressed;
      const ax = gp.axes[0] || 0;
      const ay = gp.axes[1] || 0;
      const n: PadState = {
        left: ax < -0.4 || b(14),
        right: ax > 0.4 || b(15),
        up: ay < -0.65 || b(12),
        down: ay > 0.65 || b(13),
        jump: b(0),
        attack: b(2) || b(1),
        special: b(3) || b(5) || b(7),
        start: b(9),
      };
      const p = this.pads.get(gp.index) ?? noPad();
      const dev = "gp" + gp.index;
      if ((n.jump && !p.jump) || (n.up && !p.up)) {
        this.press("jump");
        this.edge(dev, "jump");
      }
      if (n.attack && !p.attack) {
        this.press("attack");
        this.edge(dev, "attack");
      }
      if (n.special && !p.special) {
        this.press("special");
        this.edge(dev, "special");
      }
      if (n.start && !p.start) this.padStartEdge = true;
      this.pads.set(gp.index, n);
    }
    this.pads.forEach((_, i) => {
      if (!seen.has(i)) this.pads.delete(i);
    });
  }
}

export const input = new InputState();

export function deviceLabel(dev: string, phoneName?: (pid: string) => string): string {
  if (dev === "kbA") return "⌨ Clavier A";
  if (dev === "kbB") return "⌨ Clavier B";
  if (dev.startsWith("gp")) return "🎮 Manette " + (Number(dev.slice(2)) + 1);
  if (dev.startsWith("ph:")) return "📱 " + (phoneName ? phoneName(dev.slice(3)) : "Téléphone");
  return dev;
}
