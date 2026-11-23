import { PartyHost, type HostState, type PadSnapshot } from "@party/host";
import type { Controls } from "./game/input";

/** Identifiant du jeu pour le Party Kit. */
export const GAME_ID = "bistro";

/** Boutons du téléphone : 0 prendre/poser, 1 couper (maintenu), 2 pouvoir, 3 pause, 4 changer de chef (solo). */
export const PAD_BUTTONS = 5;

export const host = new PartyHost({ gameId: GAME_ID });

/** Points d'accroche remplis par l'écran actif (menu, salon, partie). */
export const link = {
  status: (_pid: string): Record<string, unknown> => ({ state: "menu" }),
  onButton: null as ((i: number, pid: string) => void) | null,
};

export function phoneName(pid: string): string {
  return host.list().find((p) => p.pid === pid)?.name ?? "Téléphone";
}

export interface PadLinkHandlers {
  onRoom: (room: string) => void;
  onState: (s: HostState) => void;
  onPads: (pads: { pid: string; name: string }[], fresh: string | null) => void;
}

/** Démarre la salle manettes : chaque téléphone devient le périphérique « ph:<pid> ». */
export function startPads(controls: Controls, h: PadLinkHandlers): () => void {
  let known: string[] = [];
  host.onRoom = h.onRoom;
  host.onState = h.onState;
  host.onPads = (list) => {
    const ids = list.map((p) => p.pid);
    const fresh = list.find((p) => !known.includes(p.pid));
    for (const pid of known) if (!ids.includes(pid)) controls.setPhone(pid, null);
    known = ids;
    h.onPads(
      list.map((p) => ({ pid: p.pid, name: p.name })),
      fresh ? fresh.name : null,
    );
  };
  host.onInput = (p: PadSnapshot) => {
    if (!p.connected) {
      controls.setPhone(p.pid, null);
      return;
    }
    const pressed = controls.setPhone(p.pid, p);
    for (const i of pressed) link.onButton?.(i, p.pid);
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
