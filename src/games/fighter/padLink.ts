import { PartyHost, type HostState, type PadSnapshot } from "@party/host";
import { input } from "./game/input";

/** Identifiant du jeu pour le Party Kit (sert à construire l'identifiant de salle). */
export const GAME_ID = "fighter";

/** Boutons de la manette téléphone : 0 saut, 1 attaque, 2 spécial, 3 pause. */
export const PAD_BUTTONS = 4;

export const host = new PartyHost({ gameId: GAME_ID });

export type Dir = "l" | "r" | "u" | "d";

/** Points d'accroche remplis par les écrans (menu, partie). */
export const link = {
  /** Ce que la manette affiche (héros, recharge du spécial…). */
  status: (): Record<string, unknown> => ({ state: "menu" }),
  /** Appui sur un bouton du téléphone (0 saut, 1 attaque, 2 spécial, 3 pause). */
  onButton: null as ((i: number) => void) | null,
  /** Flick du joystick (navigation dans les menus). */
  onDir: null as ((d: Dir) => void) | null,
};

export interface PadLinkHandlers {
  onRoom: (room: string) => void;
  onState: (s: HostState) => void;
  onPads: (count: number, fresh: string | null) => void;
}

/**
 * Démarre la salle manettes. Une seule manette pilote le jeu à la fois
 * (c'est un jeu solo) : la première connectée ; les suivantes attendent.
 */
export function startPads(h: PadLinkHandlers): () => void {
  let active: string | null = null;
  let known: string[] = [];
  let dirHeld: Dir | null = null;

  host.onRoom = h.onRoom;
  host.onState = h.onState;
  host.onPads = (list) => {
    const ids = list.map((p) => p.pid);
    const fresh = list.find((p) => !known.includes(p.pid));
    known = ids;
    if (!active || !ids.includes(active)) {
      active = ids[0] ?? null;
      input.setPhone(null);
    }
    h.onPads(list.length, fresh ? fresh.name : null);
  };
  host.onInput = (p: PadSnapshot) => {
    if (!p.connected) {
      if (p.pid === active) input.setPhone(null);
      return;
    }
    if (!active) active = p.pid;
    if (p.pid !== active) return;
    const pressed = input.setPhone(p);
    for (const i of pressed) link.onButton?.(i);
    const d: Dir | null = p.dx < -0.6 ? "l" : p.dx > 0.6 ? "r" : p.dy < -0.6 ? "u" : p.dy > 0.6 ? "d" : null;
    if (d && d !== dirHeld) link.onDir?.(d);
    dirHeld = d;
  };

  const timer = window.setInterval(() => {
    const st = link.status();
    for (const p of host.list()) host.send(p.pid, p.pid === active ? st : { state: "busy" });
  }, 300);

  host.start();
  return () => {
    window.clearInterval(timer);
    host.stop();
    host.onRoom = host.onState = host.onPads = host.onInput = null;
    input.setPhone(null);
  };
}
