/**
 * Party Kit — protocole commun « écran hôte ⇄ manettes téléphone ».
 *
 * Pensé pour être réutilisé tel quel dans d'autres jeux de soirée :
 * l'écran (PC / TV) est l'hôte, chaque téléphone ouvre une page « manette »
 * en scannant un QR code et se connecte en direct (WebRTC via PeerJS),
 * sans aucun serveur à héberger.
 */

/** Incrémenter si le format des messages change de façon incompatible. */
export const PARTY_PROTOCOL = 1;

/** Nombre maximum de téléphones par salle. */
export const MAX_PADS = 8;

/** Lettres sans ambiguïté (pas de I/O) pour les codes de salle. */
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function randomRoomCode(len = 4): string {
  let code = "";
  for (let i = 0; i < len; i++) code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  return code;
}

export function cleanRoomCode(c: string | null | undefined): string {
  return (c ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function cleanPadName(n: unknown): string {
  const s = String(n ?? "")
    .replace(/[^\p{L}\p{N} _\-.]/gu, "")
    .trim()
    .slice(0, 12);
  return s || "Téléphone";
}

/**
 * Identifiant PeerJS de l'hôte. Le préfixe évite les collisions avec
 * d'autres applications qui utilisent le même serveur PeerJS public.
 */
export function hostPeerId(gameId: string, room: string): string {
  return `castledorian-party-${gameId}-${room}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

/** Messages envoyés par un téléphone à l'hôte. */
export type PadToHost =
  | { t: "hello"; v: number; pid?: string; name: string }
  /**
   * État de la manette. `btn` contient des compteurs d'appuis (un par bouton) :
   * l'hôte détecte un appui quand un compteur augmente, ce qui rend le protocole
   * insensible aux messages perdus ou dupliqués.
   */
  | { t: "in"; seq: number; dx: number; dy: number; btn: number[] }
  | { t: "bye" };

/** Messages envoyés par l'hôte à un téléphone. */
export type HostToPad =
  | { t: "welcome"; pid: string; name: string }
  | { t: "status"; status: Record<string, unknown> | null }
  | { t: "reject"; reason: "full" | "version" };

export function clampAxis(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(-1, Math.min(1, v));
}

export function counter(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}
