import { PartyHost, type HostState, type PadSnapshot } from "@party/host";
import { input } from "./game/input";

/** Identifiant du jeu pour le Party Kit (sert à construire l'identifiant de salle). */
export const GAME_ID = "fighter";

/** Boutons de la manette téléphone : 0 saut, 1 attaque, 2 spécial, 3 pause. */
export const PAD_BUTTONS = 4;

export const host = new PartyHost({ gameId: GAME_ID });

export type Dir = "l" | "r" | "u" | "d";

/** Points d'accroche remplis par l'écran actif (menu, salon, partie). */
export const link = {
  /** Ce que le téléphone `pid` affiche (héros, %, recharge du spécial…). */
  status: (_pid: string): Record<string, unknown> => ({ state: "menu" }),
  /** Appui sur un bouton du téléphone (0 saut, 1 attaque, 2 spécial, 3 pause). */
  onButton: null as ((i: number, pid: string) => void) | null,
  /** Flick du joystick (navigation dans les menus). */
  onDir: null as ((d: Dir, pid: string) => void) | null,
};

export interface PadLinkHandlers {
  onRoom: (room: string) => void;
  onState: (s: HostState) => void;
  onPads: (pads: { pid: string; name: string }[], fresh: string | null) => void;
}

/** Nom affiché d'un téléphone connecté. */
export function phoneName(pid: string): string {
  return host.list().find((p) => p.pid === pid)?.name ?? "Téléphone";
}

/**
 * Démarre la salle manettes. Chaque téléphone est un périphérique à part
 * (« ph:<pid> ») : en solo ils pilotent tous le héros, en versus chacun son combattant.
 */
export function startPads(h: PadLinkHandlers): () => void {
  let known: string[] = [];
  const dirHeld = new Map<string, Dir | null>();

  host.onRoom = h.onRoom;
  host.onState = h.onState;
  host.onPads = (list) => {
    const ids = list.map((p) => p.pid);
    const fresh = list.find((p) => !known.includes(p.pid));
    for (const pid of known) if (!ids.includes(pid)) input.setPhone(pid, null);
    known = ids;
    h.onPads(
      list.map((p) => ({ pid: p.pid, name: p.name })),
      fresh ? fresh.name : null,
    );
  };
  host.onInput = (p: PadSnapshot) => {
    if (!p.connected) {
      input.setPhone(p.pid, null);
      return;
    }
    const pressed = input.setPhone(p.pid, p);
    for (const i of pressed) link.onButton?.(i, p.pid);
    const d: Dir | null = p.dx < -0.6 ? "l" : p.dx > 0.6 ? "r" : p.dy < -0.6 ? "u" : p.dy > 0.6 ? "d" : null;
    if (d && d !== dirHeld.get(p.pid)) link.onDir?.(d, p.pid);
    dirHeld.set(p.pid, d);
  };

  const timer = window.setInterval(() => {
    for (const p of host.list()) host.send(p.pid, link.status(p.pid));
  }, 250);

  host.start();
  return () => {
    window.clearInterval(timer);
    host.stop();
    host.onRoom = host.onState = host.onPads = host.onInput = null;
  };
}
