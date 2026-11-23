// Entrées « soirée » : chaque joueur a son périphérique.
//   "kbA"  clavier gauche : Q/D (ou A/D) bouger · S descendre · Z/W tourner · A/Q tourner ← · Espace chute · E pouvoir
//   "kbB"  clavier droit  : ← → bouger · ↓ descendre · ↑ tourner · / ou Pavé 0 tourner ← · Entrée chute · Maj droite pouvoir
//   "gpN"  manette N      : stick/croix · A tourner · B tourner ← · Y ou ↑ chute · X/RB pouvoir · Start pause
//   "ph:<pid>" téléphone  : joystick + TOURNER / CHUTE / POUVOIR / pause / TOURNER ←

export type PartyBtn = 'rot' | 'rotCCW' | 'drop' | 'skill' | 'pause';

export interface DevRead {
  left: boolean;
  right: boolean;
  down: boolean;
  /** Boutons appuyés depuis la dernière lecture. */
  edges: Set<PartyBtn>;
}

interface Scheme {
  left: string[];
  right: string[];
  down: string[];
  rot: string[];
  rotCCW: string[];
  drop: string[];
  skill: string[];
}

const SCHEMES: Record<'kbA' | 'kbB', Scheme> = {
  kbA: { left: ['KeyA'], right: ['KeyD'], down: ['KeyS'], rot: ['KeyW'], rotCCW: ['KeyQ'], drop: ['Space'], skill: ['KeyE', 'ShiftLeft'] },
  kbB: {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    down: ['ArrowDown'],
    rot: ['ArrowUp'],
    rotCCW: ['Slash', 'Numpad0', 'KeyL'],
    drop: ['Enter', 'NumpadEnter'],
    skill: ['ShiftRight', 'Numpad1', 'Semicolon'],
  },
};

const ALL_KEYS = new Set(Object.values(SCHEMES).flatMap((s) => Object.values(s).flat()));

interface Phone {
  dx: number;
  dy: number;
  btn: number[] | null;
  edges: Set<PartyBtn>;
  upHeld: boolean;
}

class PartyInput {
  private down = new Set<string>();
  private kbEdges: Record<'kbA' | 'kbB', Set<PartyBtn>> = { kbA: new Set(), kbB: new Set() };
  private phones = new Map<string, Phone>();
  private padPrev = new Map<number, boolean[]>();
  private padEdges = new Map<number, Set<PartyBtn>>();
  private padHeld = new Map<number, { left: boolean; right: boolean; down: boolean }>();
  private attached = 0;
  /** Empêche le défilement / les clics clavier sur les boutons pendant la partie. */
  capture = true;

  private onDown = (e: KeyboardEvent) => {
    const tg = e.target as HTMLElement | null;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
    if (!ALL_KEYS.has(e.code)) return;
    if (this.capture) e.preventDefault();
    if (e.repeat) return;
    this.down.add(e.code);
    for (const k of ['kbA', 'kbB'] as const) {
      const s = SCHEMES[k];
      for (const b of ['rot', 'rotCCW', 'drop', 'skill'] as const) if (s[b].includes(e.code)) this.kbEdges[k].add(b);
    }
  };
  private onUp = (e: KeyboardEvent) => this.down.delete(e.code);
  private onBlur = () => this.down.clear();

  attach() {
    if (this.attached++ > 0) return;
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach() {
    if (--this.attached > 0) return;
    this.attached = 0;
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
  }

  /** Vide les appuis en attente (début de partie, changement d'écran). */
  flush() {
    this.kbEdges.kbA.clear();
    this.kbEdges.kbB.clear();
    this.padEdges.forEach((s) => s.clear());
    this.phones.forEach((p) => p.edges.clear());
  }

  /** Téléphone (Party Kit). Boutons : 0 tourner, 1 chute, 2 pouvoir, 3 pause, 4 tourner ←. */
  setPhone(pid: string, s: { dx: number; dy: number; btn: number[] } | null): number[] {
    if (!s) {
      this.phones.delete(pid);
      return [];
    }
    const prev = this.phones.get(pid);
    const ph: Phone = prev ?? { dx: 0, dy: 0, btn: null, edges: new Set(), upHeld: false };
    const out: number[] = [];
    s.btn.forEach((n, i) => {
      const old = ph.btn ? (ph.btn[i] ?? 0) : n;
      if (n > old || (n < old && n > 0)) out.push(i);
    });
    const map: PartyBtn[] = ['rot', 'drop', 'skill', 'pause', 'rotCCW'];
    for (const i of out) if (map[i]) ph.edges.add(map[i]);
    // joystick vers le haut = chute (comme ↑ sur une manette)
    const up = s.dy < -0.6;
    if (up && !ph.upHeld) ph.edges.add('drop');
    ph.upHeld = up;
    ph.dx = s.dx;
    ph.dy = s.dy;
    ph.btn = s.btn.slice();
    this.phones.set(pid, ph);
    return out;
  }

  /** Lit les manettes (à appeler une fois par image). */
  pollPads() {
    const list = typeof navigator !== 'undefined' && navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    const seen = new Set<number>();
    for (const gp of list) {
      if (!gp || !gp.connected) continue;
      seen.add(gp.index);
      const b = (i: number) => !!gp.buttons[i]?.pressed;
      const ax = gp.axes[0] || 0;
      const ay = gp.axes[1] || 0;
      const cur = [b(0), b(1), b(3) || b(12) || ay < -0.75, b(2) || b(5) || b(7), b(9)];
      const prev = this.padPrev.get(gp.index) ?? [false, false, false, false, false];
      const ed = this.padEdges.get(gp.index) ?? new Set<PartyBtn>();
      const names: PartyBtn[] = ['rot', 'rotCCW', 'drop', 'skill', 'pause'];
      cur.forEach((v, i) => {
        if (v && !prev[i]) ed.add(names[i]);
      });
      this.padEdges.set(gp.index, ed);
      this.padPrev.set(gp.index, cur);
      this.padHeld.set(gp.index, { left: ax < -0.5 || b(14), right: ax > 0.5 || b(15), down: ay > 0.6 || b(13) });
    }
    for (const i of Array.from(this.padPrev.keys())) {
      if (!seen.has(i)) {
        this.padPrev.delete(i);
        this.padEdges.delete(i);
        this.padHeld.delete(i);
      }
    }
  }

  devices(): string[] {
    const out = ['kbA', 'kbB'];
    this.padPrev.forEach((_, i) => out.push('gp' + i));
    this.phones.forEach((_, pid) => out.push('ph:' + pid));
    return out;
  }

  /** État d'un périphérique ; consomme ses appuis. */
  read(dev: string): DevRead {
    const any = (codes: string[]) => codes.some((c) => this.down.has(c));
    if (dev === 'kbA' || dev === 'kbB') {
      const s = SCHEMES[dev];
      const edges = this.kbEdges[dev];
      this.kbEdges[dev] = new Set();
      return { left: any(s.left), right: any(s.right), down: any(s.down), edges };
    }
    if (dev.startsWith('gp')) {
      const i = Number(dev.slice(2));
      const h = this.padHeld.get(i) ?? { left: false, right: false, down: false };
      const edges = this.padEdges.get(i) ?? new Set<PartyBtn>();
      this.padEdges.set(i, new Set());
      return { ...h, edges };
    }
    if (dev.startsWith('ph:')) {
      const ph = this.phones.get(dev.slice(3));
      if (!ph) return { left: false, right: false, down: false, edges: new Set() };
      const edges = ph.edges;
      ph.edges = new Set();
      return { left: ph.dx < -0.5, right: ph.dx > 0.5, down: ph.dy > 0.6, edges };
    }
    return { left: false, right: false, down: false, edges: new Set() };
  }
}

export const party = new PartyInput();

export function deviceLabel(dev: string, phoneName: (pid: string) => string): string {
  if (dev === 'kbA') return '⌨ Clavier A';
  if (dev === 'kbB') return '⌨ Clavier B';
  if (dev.startsWith('gp')) return '🎮 Manette ' + (Number(dev.slice(2)) + 1);
  if (dev.startsWith('ph:')) return '📱 ' + phoneName(dev.slice(3));
  return dev;
}
