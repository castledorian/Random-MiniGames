export interface DevState {
  dx: number;
  dy: number;
  bomb: boolean;
  skill: boolean;
  bombEdge: boolean;
  skillEdge: boolean;
}

export interface PhoneRaw {
  pid: string;
  name: string;
  dx: number;
  dy: number;
  b: number;
  s: number;
  age: number;
  at: number;
}

interface KbScheme {
  up: string;
  down: string;
  left: string;
  right: string;
  bomb: string[];
  skill: string[];
}

const KB: Record<"kbA" | "kbB", KbScheme> = {
  kbA: {
    up: "KeyW",
    down: "KeyS",
    left: "KeyA",
    right: "KeyD",
    bomb: ["Space", "KeyF"],
    skill: ["KeyE", "ShiftLeft", "KeyG"],
  },
  kbB: {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    bomb: ["Enter", "NumpadEnter", "Numpad0"],
    skill: ["ShiftRight", "Slash", "Numpad1"],
  },
};

const EMPTY: DevState = { dx: 0, dy: 0, bomb: false, skill: false, bombEdge: false, skillEdge: false };

export function emptyState(): DevState {
  return { ...EMPTY };
}

export class InputManager {
  states = new Map<string, DevState>();
  phones = new Map<string, PhoneRaw>();
  touch = { dx: 0, dy: 0, bomb: false, skill: false, bombEdge: false, skillEdge: false, active: false };
  pauseEdge = false;
  captureKeys = false;
  /** Appelé à chaque appui sur un bouton BOMBE (clavier, manette, téléphone). */
  onAnyInput: (() => void) | null = null;

  private stacks: Record<"kbA" | "kbB", string[]> = { kbA: [], kbB: [] };
  private held = new Set<string>();
  private latch: Record<"kbA" | "kbB", { bomb: boolean; skill: boolean }> = {
    kbA: { bomb: false, skill: false },
    kbB: { bomb: false, skill: false },
  };
  private gpPrev = new Map<string, { bomb: boolean; skill: boolean; start: boolean }>();
  private phoneSeen = new Map<string, { b: number; s: number }>();
  private attached = false;

  private isTyping(t: EventTarget | null): boolean {
    const el = t as HTMLElement | null;
    if (!el || !el.tagName) return false;
    return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isTyping(e.target)) return;
    const code = e.code;
    let mapped = false;
    (["kbA", "kbB"] as const).forEach((k) => {
      const s = KB[k];
      const stack = this.stacks[k];
      if (code === s.up || code === s.down || code === s.left || code === s.right) {
        mapped = true;
        if (!stack.includes(code)) stack.push(code);
      }
      if (s.bomb.includes(code)) {
        mapped = true;
        if (!e.repeat) this.latch[k].bomb = true;
        this.held.add(k + ":bomb:" + code);
      }
      if (s.skill.includes(code)) {
        mapped = true;
        if (!e.repeat) this.latch[k].skill = true;
        this.held.add(k + ":skill:" + code);
      }
    });
    if ((code === "Escape" || code === "KeyP") && !e.repeat) {
      this.pauseEdge = true;
    }
    if (mapped && this.captureKeys) e.preventDefault();
    if (!e.repeat && this.onAnyInput && (this.latch.kbA.bomb || this.latch.kbB.bomb)) this.onAnyInput();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const code = e.code;
    (["kbA", "kbB"] as const).forEach((k) => {
      const stack = this.stacks[k];
      const i = stack.indexOf(code);
      if (i !== -1) stack.splice(i, 1);
      this.held.delete(k + ":bomb:" + code);
      this.held.delete(k + ":skill:" + code);
    });
  };

  private onBlur = () => {
    this.stacks.kbA.length = 0;
    this.stacks.kbB.length = 0;
    this.held.clear();
    this.touch.dx = 0;
    this.touch.dy = 0;
    this.touch.bomb = false;
    this.touch.skill = false;
  };

  attach() {
    if (this.attached || typeof window === "undefined") return;
    this.attached = true;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  detach() {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
  }

  setPhones(list: PhoneRaw[]) {
    const next = new Map<string, PhoneRaw>();
    for (const p of list) next.set(p.pid, p);
    this.phones = next;
  }

  private kbState(k: "kbA" | "kbB"): DevState {
    const s = KB[k];
    const stack = this.stacks[k];
    let dx = 0;
    let dy = 0;
    const top = stack[stack.length - 1];
    if (top === s.left) dx = -1;
    else if (top === s.right) dx = 1;
    else if (top === s.up) dy = -1;
    else if (top === s.down) dy = 1;
    let bomb = false;
    let skill = false;
    s.bomb.forEach((c) => {
      if (this.held.has(k + ":bomb:" + c)) bomb = true;
    });
    s.skill.forEach((c) => {
      if (this.held.has(k + ":skill:" + c)) skill = true;
    });
    const L = this.latch[k];
    const st: DevState = { dx, dy, bomb: bomb || L.bomb, skill: skill || L.skill, bombEdge: L.bomb, skillEdge: L.skill };
    L.bomb = false;
    L.skill = false;
    return st;
  }

  /** À appeler une fois par frame. */
  poll() {
    const out = new Map<string, DevState>();
    out.set("kbA", this.kbState("kbA"));
    out.set("kbB", this.kbState("kbB"));

    // Manettes
    if (typeof navigator !== "undefined" && navigator.getGamepads) {
      const pads = navigator.getGamepads();
      for (let i = 0; i < pads.length; i++) {
        const gp = pads[i];
        if (!gp || !gp.connected) continue;
        const id = "gp" + gp.index;
        let ax = gp.axes[0] || 0;
        let ay = gp.axes[1] || 0;
        if (Math.abs(ax) < 0.3) ax = 0;
        if (Math.abs(ay) < 0.3) ay = 0;
        const b = gp.buttons;
        const pressed = (n: number) => !!b[n] && b[n].pressed;
        if (pressed(14)) ax = -1;
        else if (pressed(15)) ax = 1;
        if (pressed(12)) ay = -1;
        else if (pressed(13)) ay = 1;
        const bomb = pressed(0);
        const skill = pressed(1) || pressed(2) || pressed(3) || pressed(4) || pressed(5) || pressed(6) || pressed(7);
        const start = pressed(9);
        const prev = this.gpPrev.get(id) ?? { bomb: false, skill: false, start: false };
        out.set(id, {
          dx: ax,
          dy: ay,
          bomb,
          skill,
          bombEdge: bomb && !prev.bomb,
          skillEdge: skill && !prev.skill,
        });
        if (start && !prev.start) this.pauseEdge = true;
        if (bomb && !prev.bomb) this.onAnyInput?.();
        this.gpPrev.set(id, { bomb, skill, start });
      }
    }

    // Téléphones
    const now = performance.now();
    this.phones.forEach((p, pid) => {
      const stale = p.age + (now - p.at) > 4000;
      if (stale) return;
      const seen = this.phoneSeen.get(pid) ?? { b: p.b, s: p.s };
      // Un compteur qui redescend = manette rechargée (compteurs remis à zéro).
      const bombEdge = p.b > seen.b || (p.b < seen.b && p.b > 0);
      const skillEdge = p.s > seen.s || (p.s < seen.s && p.s > 0);
      this.phoneSeen.set(pid, { b: p.b, s: p.s });
      if (bombEdge) this.onAnyInput?.();
      out.set("ph:" + pid, {
        dx: p.dx,
        dy: p.dy,
        bomb: bombEdge,
        skill: skillEdge,
        bombEdge,
        skillEdge,
      });
    });

    // Tactile local
    if (this.touch.active) {
      const t = this.touch;
      out.set("touch", {
        dx: t.dx,
        dy: t.dy,
        bomb: t.bomb || t.bombEdge,
        skill: t.skill || t.skillEdge,
        bombEdge: t.bombEdge,
        skillEdge: t.skillEdge,
      });
      t.bombEdge = false;
      t.skillEdge = false;
    }
    this.states = out;
  }

  state(dev: string | null): DevState {
    if (!dev) return EMPTY;
    return this.states.get(dev) ?? EMPTY;
  }

  devices(): string[] {
    return Array.from(this.states.keys());
  }

  /** Fusion de tous les périphériques (mode solo). */
  merged(): DevState {
    let dx = 0;
    let dy = 0;
    let bomb = false;
    let skill = false;
    let bombEdge = false;
    let skillEdge = false;
    this.states.forEach((s) => {
      if (dx === 0 && dy === 0 && (s.dx !== 0 || s.dy !== 0)) {
        dx = s.dx;
        dy = s.dy;
      }
      bomb = bomb || s.bomb;
      skill = skill || s.skill;
      bombEdge = bombEdge || s.bombEdge;
      skillEdge = skillEdge || s.skillEdge;
    });
    return { dx, dy, bomb, skill, bombEdge, skillEdge };
  }

  consumePause(): boolean {
    const p = this.pauseEdge;
    this.pauseEdge = false;
    return p;
  }

  phoneName(dev: string): string {
    const pid = dev.slice(3);
    return this.phones.get(pid)?.name ?? "Téléphone";
  }
}

export function deviceLabel(dev: string, input?: InputManager): string {
  if (dev === "kbA") return "⌨ Clavier A · ZQSD + Espace";
  if (dev === "kbB") return "⌨ Clavier B · Flèches + Entrée";
  if (dev === "touch") return "👆 Écran tactile";
  if (dev.startsWith("gp")) return "🎮 Manette " + (Number(dev.slice(2)) + 1);
  if (dev.startsWith("ph:")) return "📱 " + (input ? input.phoneName(dev) : "Téléphone");
  return dev;
}
