export type Action = "left" | "right" | "down" | "jump" | "attack" | "throw" | "ability";

const ACTIONS: Action[] = ["left", "right", "down", "jump", "attack", "throw", "ability"];

// Physical key positions (works for QWERTY *and* AZERTY: WASD <-> ZQSD)
const CODE_MAP: Record<string, Action> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowDown: "down",
  KeyS: "down",
  ArrowUp: "jump",
  KeyW: "jump",
  Space: "jump",
};
// Printed key labels (same on both layouts)
const KEY_MAP: Record<string, Action> = {
  j: "attack",
  z: "attack",
  k: "throw",
  x: "throw",
  l: "ability",
  c: "ability",
  Shift: "ability",
};

export class Input {
  held: Record<Action, boolean> = { left: false, right: false, down: false, jump: false, attack: false, throw: false, ability: false };
  private edge: Record<Action, boolean> = { left: false, right: false, down: false, jump: false, attack: false, throw: false, ability: false };
  aim = { x: 0, y: 0, mouseThrow: false };
  usedTouch = false;

  press(a: Action) {
    if (!this.held[a]) this.edge[a] = true;
    this.held[a] = true;
  }

  release(a: Action) {
    this.held[a] = false;
  }

  consume(a: Action) {
    const e = this.edge[a];
    this.edge[a] = false;
    return e;
  }

  clear() {
    for (const a of ACTIONS) {
      this.held[a] = false;
      this.edge[a] = false;
    }
  }

  /** returns true when the key was a game key */
  keyDown(e: KeyboardEvent): boolean {
    const a = CODE_MAP[e.code] ?? KEY_MAP[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (!a) return false;
    if (!e.repeat) this.press(a);
    return true;
  }

  keyUp(e: KeyboardEvent) {
    const a = CODE_MAP[e.code] ?? KEY_MAP[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (a) this.release(a);
  }
}
