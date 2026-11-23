import { PartyHost, type HostState, type PadSnapshot } from "@party/host";
import type { InputManager, PhoneRaw } from "./input";

export interface PadInfo {
  pid: string;
  name: string;
}

/** Identifiant du jeu pour le Party Kit (sert à construire l'identifiant de salle). */
export const GAME_ID = "bomberman";

/** Boutons de la manette téléphone : 0 = BOMBE, 1 = SKILL, 2 = PAUSE. */
export const PAD_BUTTONS = 3;

/**
 * Adaptateur entre le Party Kit (connexion directe téléphone ⇄ écran)
 * et le gestionnaire d'entrées du jeu.
 */
export class PadHost {
  room = "----";
  state: HostState = "connecting";
  pads: PadInfo[] = [];
  onChange: ((pads: PadInfo[]) => void) | null = null;
  onRoom: ((room: string) => void) | null = null;
  onState: ((s: HostState) => void) | null = null;

  private host = new PartyHost({ gameId: GAME_ID });
  private raw = new Map<string, PhoneRaw>();

  constructor(private input: InputManager) {
    this.host.onRoom = (r) => {
      this.room = r;
      this.onRoom?.(r);
    };
    this.host.onState = (s) => {
      this.state = s;
      this.onState?.(s);
    };
    this.host.onPads = (list) => {
      this.pads = list.map((p) => ({ pid: p.pid, name: p.name }));
      const alive = new Set(list.map((p) => p.pid));
      this.raw.forEach((_, pid) => {
        if (!alive.has(pid)) this.raw.delete(pid);
      });
      this.push();
      this.onChange?.(this.pads);
    };
    this.host.onInput = (p) => this.update(p);
  }

  start() {
    this.host.start();
  }

  stop() {
    this.host.stop();
    this.raw.clear();
    this.push();
  }

  sendStatus(statuses: Record<string, unknown>) {
    for (const [pid, st] of Object.entries(statuses)) {
      this.host.send(pid, (st as Record<string, unknown> | null) ?? null);
    }
  }

  private update(p: PadSnapshot) {
    if (!p.connected) {
      this.raw.delete(p.pid);
    } else {
      this.raw.set(p.pid, {
        pid: p.pid,
        name: p.name,
        dx: p.dx,
        dy: p.dy,
        b: p.btn[0] ?? 0,
        s: p.btn[1] ?? 0,
        pz: p.btn[2] ?? 0,
        age: 0,
        at: p.at,
      });
    }
    this.push();
  }

  private push() {
    this.input.setPhones(Array.from(this.raw.values()));
  }
}
