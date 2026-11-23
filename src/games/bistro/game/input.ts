// Unified input: keyboard (solo merged map or two co-op maps), gamepads and on-screen touch.
// Presses (grab/dash/swap) are latched so a quick tap between two frames is never lost.

export interface PlayerInput {
  mx: number;
  my: number;
  grab: boolean; // edge
  work: boolean; // held
  dash: boolean; // edge
  swap: boolean; // edge
}

export type Action = 'grab' | 'work' | 'dash' | 'swap';

interface KeyMap {
  up: string[];
  down: string[];
  left: string[];
  right: string[];
  grab: string[];
  work: string[];
  dash: string[];
  swap: string[];
}

const SOLO: KeyMap = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  grab: ['Space', 'KeyE', 'KeyJ'],
  work: ['KeyF', 'KeyX', 'KeyK'],
  dash: ['ShiftLeft', 'ShiftRight', 'KeyC', 'KeyL'],
  swap: ['Tab', 'KeyQ'],
};
const P1: KeyMap = {
  up: ['KeyW'],
  down: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  grab: ['KeyE'],
  work: ['KeyF'],
  dash: ['KeyQ', 'ShiftLeft'],
  swap: [],
};
const P2: KeyMap = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  grab: ['Comma', 'Enter', 'NumpadEnter', 'KeyL'],
  work: ['Period', 'Numpad0', 'Semicolon'],
  dash: ['Slash', 'ShiftRight', 'Numpad1'],
  swap: [],
};

/** Manette téléphone : état reçu par le Party Kit. Boutons : 0 prendre, 1 couper (maintenu), 2 pouvoir, 3 pause, 4 changer. */
interface PhoneState {
  mx: number;
  my: number;
  held: number;
  btn: number[] | null;
  latch: Record<Action, boolean>;
}

const GAME_KEYS = new Set<string>([
  ...Object.values(SOLO).flat(),
  ...Object.values(P1).flat(),
  ...Object.values(P2).flat(),
]);

const empty = (): PlayerInput => ({ mx: 0, my: 0, grab: false, work: false, dash: false, swap: false });

export class Controls {
  private held = new Set<string>();
  private latched = new Set<string>();
  capture = false; // when true, game keys are preventDefault'ed
  touchActive = false; // set to true after first touch → UI hints switch to touch wording
  gamepadSeen = false;

  touch = {
    mx: 0,
    my: 0,
    held: { grab: false, work: false, dash: false, swap: false } as Record<Action, boolean>,
    latch: { grab: false, work: false, dash: false, swap: false } as Record<Action, boolean>,
    dashCd: 0, // 0..1 remaining fraction (written by the game for the touch HUD)
  };

  private padPrev: boolean[][] = [[], [], [], []];
  private phones = new Map<string, PhoneState>();
  /** Appui « pause » venu d'un téléphone (lu par l'appli). */
  phonePause = false;
  private startPrev: boolean[] = [];

  private onKeyDown = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (this.capture && GAME_KEYS.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.held.add(e.code);
    this.latched.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code);
  };
  private onBlur = () => {
    this.held.clear();
    this.latched.clear();
    this.resetTouch();
  };

  attach() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('gamepadconnected', () => (this.gamepadSeen = true));
  }
  detach() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  clearLatches() {
    this.latched.clear();
    this.phones.forEach((ph) => {
      ph.latch.grab = ph.latch.work = ph.latch.dash = ph.latch.swap = false;
    });
    (Object.keys(this.touch.latch) as Action[]).forEach((a) => (this.touch.latch[a] = false));
  }

  resetTouch() {
    this.touch.mx = 0;
    this.touch.my = 0;
    (Object.keys(this.touch.held) as Action[]).forEach((a) => {
      this.touch.held[a] = false;
      this.touch.latch[a] = false;
    });
  }

  /** Met à jour l'état d'un téléphone ; renvoie les boutons qui viennent d'être appuyés. */
  setPhone(pid: string, p: { dx: number; dy: number; held: number; btn: number[] } | null): number[] {
    if (!p) {
      this.phones.delete(pid);
      return [];
    }
    const prev = this.phones.get(pid);
    const out: number[] = [];
    p.btn.forEach((n, i) => {
      const old = prev?.btn ? (prev.btn[i] ?? 0) : n;
      if (n > old || (n < old && n > 0)) out.push(i);
    });
    const latch = prev?.latch ?? { grab: false, work: false, dash: false, swap: false };
    for (const i of out) {
      if (i === 0) latch.grab = true;
      else if (i === 1) latch.work = true;
      else if (i === 2) latch.dash = true;
      else if (i === 3) this.phonePause = true;
      else if (i === 4) latch.swap = true;
    }
    let mx = p.dx;
    let my = p.dy;
    const l = Math.hypot(mx, my);
    if (l > 1) {
      mx /= l;
      my /= l;
    }
    this.phones.set(pid, { mx, my, held: p.held, btn: p.btn.slice(), latch });
    return out;
  }

  /** Périphériques pouvant rejoindre une partie co-op. */
  devices(): string[] {
    const out = ['kbA', 'kbB'];
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const pads = navigator.getGamepads();
      for (let i = 0; i < pads.length; i++) if (pads[i]?.connected) out.push('gp' + i);
    }
    this.phones.forEach((_, pid) => out.push('ph:' + pid));
    return out;
  }

  private readPhone(ph: PhoneState, out: PlayerInput) {
    out.mx += ph.mx;
    out.my += ph.my;
    out.grab = out.grab || ph.latch.grab;
    out.work = out.work || (ph.held & 2) !== 0;
    out.dash = out.dash || ph.latch.dash;
    out.swap = out.swap || ph.latch.swap;
  }

  /** Co-op : une entrée par périphérique ("kbA", "kbB", "gpN", "ph:<pid>"). */
  pollDevices(devs: (string | null)[]): PlayerInput[] {
    const outs = devs.map(() => empty());
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    devs.forEach((d, i) => {
      const o = outs[i];
      if (!d) return;
      if (d === 'kbA') this.readKeys(P1, o);
      else if (d === 'kbB') this.readKeys(P2, o);
      else if (d.startsWith('gp')) {
        const pad = pads[Number(d.slice(2))];
        if (pad && pad.connected) {
          this.gamepadSeen = true;
          this.readPad(Number(d.slice(2)), pad, o);
        }
      } else if (d.startsWith('ph:')) {
        const ph = this.phones.get(d.slice(3));
        if (ph) this.readPhone(ph, o);
      }
      const l = Math.hypot(o.mx, o.my);
      if (l > 1) {
        o.mx /= l;
        o.my /= l;
      }
    });
    this.clearLatches();
    return outs;
  }

  pressTouch(a: Action) {
    this.touchActive = true;
    this.touch.held[a] = true;
    this.touch.latch[a] = true;
  }
  releaseTouch(a: Action) {
    this.touch.held[a] = false;
  }

  private anyHeld(codes: string[]) {
    for (const c of codes) if (this.held.has(c)) return true;
    return false;
  }
  private anyLatched(codes: string[]) {
    for (const c of codes) if (this.latched.has(c)) return true;
    return false;
  }

  private readKeys(map: KeyMap, out: PlayerInput) {
    let mx = (this.anyHeld(map.right) ? 1 : 0) - (this.anyHeld(map.left) ? 1 : 0);
    let my = (this.anyHeld(map.down) ? 1 : 0) - (this.anyHeld(map.up) ? 1 : 0);
    if (mx && my) {
      mx *= Math.SQRT1_2;
      my *= Math.SQRT1_2;
    }
    out.mx += mx;
    out.my += my;
    out.grab = out.grab || this.anyLatched(map.grab);
    out.work = out.work || this.anyHeld(map.work);
    out.dash = out.dash || this.anyLatched(map.dash);
    out.swap = out.swap || this.anyLatched(map.swap);
  }

  private readPad(i: number, pad: Gamepad, out: PlayerInput) {
    const dz = 0.22;
    let ax = pad.axes[0] ?? 0;
    let ay = pad.axes[1] ?? 0;
    const len = Math.hypot(ax, ay);
    if (len < dz) {
      ax = 0;
      ay = 0;
    } else {
      const k = Math.min(1, (len - dz) / (1 - dz)) / len;
      ax *= k;
      ay *= k;
    }
    const b = (n: number) => !!pad.buttons[n]?.pressed;
    if (b(14)) ax = -1;
    if (b(15)) ax = 1;
    if (b(12)) ay = -1;
    if (b(13)) ay = 1;
    out.mx += ax;
    out.my += ay;
    const cur = [b(0), b(2), b(1) || b(7) || b(5), b(3) || b(4)];
    const prev = this.padPrev[i];
    out.grab = out.grab || (cur[0] && !prev[0]);
    out.work = out.work || cur[1];
    out.dash = out.dash || (cur[2] && !prev[2]);
    out.swap = out.swap || (cur[3] && !prev[3]);
    this.padPrev[i] = cur;
  }

  /** Returns 1 input in solo mode (merged sources) or 2 in co-op. */
  poll(coop: boolean): PlayerInput[] {
    const p1 = empty();
    const p2 = empty();
    if (coop) {
      this.readKeys(P1, p1);
      this.readKeys(P2, p2);
    } else {
      this.readKeys(SOLO, p1);
    }
    // touch → player 1
    p1.mx += this.touch.mx;
    p1.my += this.touch.my;
    p1.grab = p1.grab || this.touch.latch.grab;
    p1.work = p1.work || this.touch.held.work;
    p1.dash = p1.dash || this.touch.latch.dash;
    p1.swap = p1.swap || this.touch.latch.swap;

    // téléphones → joueur 1 en solo
    if (!coop) this.phones.forEach((ph) => this.readPhone(ph, p1));

    // gamepads
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const pads = navigator.getGamepads();
      let n = 0;
      for (let i = 0; i < pads.length; i++) {
        const pad = pads[i];
        if (!pad || !pad.connected) continue;
        this.gamepadSeen = true;
        const target = coop ? (n === 0 ? p1 : p2) : p1;
        this.readPad(i, pad, target);
        n++;
        if (coop && n >= 2) break;
      }
    }

    const fin = (p: PlayerInput) => {
      const l = Math.hypot(p.mx, p.my);
      if (l > 1) {
        p.mx /= l;
        p.my /= l;
      }
    };
    fin(p1);
    fin(p2);
    this.clearLatches();
    return coop ? [p1, p2] : [p1];
  }

  /** Any gamepad start button pressed this frame? (used by the app for pause) */
  padStart(): boolean {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return false;
    const pads = navigator.getGamepads();
    let pressed = false;
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (!p) continue;
      const cur = !!p.buttons[9]?.pressed;
      const prev = this.startPrev[i] ?? false;
      if (cur && !prev) pressed = true;
      this.startPrev[i] = cur;
    }
    return pressed;
  }
}
