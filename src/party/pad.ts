import { Peer, type DataConnection } from "peerjs";
import { PARTY_PROTOCOL, cleanRoomCode, hostPeerId, type HostToPad, type PadToHost } from "./protocol";

export type PadPhase = "idle" | "joining" | "on" | "lost" | "error";

export interface PartyPadOptions {
  gameId: string;
  /** Nombre de boutons (compteurs d'appuis) envoyés à l'hôte. */
  buttons: number;
}

/** Messages d'erreur affichables sur la manette. */
export const PAD_ERRORS: Record<string, string> = {
  no_room: "Salle introuvable. Vérifiez le code et que le jeu est bien ouvert sur l'écran.",
  full: "Salle pleine (8 téléphones maximum).",
  version: "Version différente du jeu : rechargez la page du jeu et celle de la manette.",
  network: "Connexion impossible. Vérifiez votre réseau puis réessayez.",
  browser: "Ce navigateur ne gère pas les connexions directes (WebRTC). Essayez Chrome ou Safari à jour.",
};

const HEARTBEAT = 400;
/** Sans nouvelles de l'hôte pendant ce délai, on considère le lien perdu. */
const HOST_TIMEOUT = 3500;

/**
 * Côté téléphone : se connecte à la salle de l'hôte et lui envoie l'état
 * de la manette (direction + compteurs d'appuis). Se reconnecte tout seul.
 */
export class PartyPad {
  phase: PadPhase = "idle";
  error = "";
  room = "";
  pid = "";
  name = "";
  /** performance.now() du dernier message reçu de l'hôte. */
  lastHost = 0;

  onPhase: ((p: PadPhase, error: string) => void) | null = null;
  onStatus: ((s: Record<string, unknown> | null) => void) | null = null;

  private st = { dx: 0, dy: 0, btn: [] as number[], held: 0, seq: 0 };
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private gen = 0;
  private hb: number | null = null;
  private retryTimer: number | null = null;
  private attempts = 0;

  constructor(private readonly opts: PartyPadOptions) {
    this.st.btn = new Array(opts.buttons).fill(0);
  }

  join(code: string, name: string) {
    const room = cleanRoomCode(code);
    if (!room) return;
    this.leave(false);
    this.room = room;
    this.name = name;
    try {
      this.pid = window.sessionStorage.getItem(this.pidKey()) || "";
    } catch {
      this.pid = "";
    }
    this.attempts = 0;
    const gen = ++this.gen;
    this.setPhase("joining");
    this.hb = window.setInterval(() => this.tick(), HEARTBEAT);
    this.connect(gen);
  }

  /** Quitte la salle (bye = libère la place côté hôte). */
  leave(bye = true) {
    this.gen++;
    if (bye) this.write({ t: "bye" });
    if (this.hb) window.clearInterval(this.hb);
    if (this.retryTimer) window.clearTimeout(this.retryTimer);
    this.hb = null;
    this.retryTimer = null;
    this.conn?.close();
    this.conn = null;
    this.peer?.destroy();
    this.peer = null;
  }

  setDir(dx: number, dy: number) {
    if (this.st.dx === dx && this.st.dy === dy) return;
    this.st.dx = dx;
    this.st.dy = dy;
    this.flush();
  }

  /** Bouton maintenu / relâché (en plus de press() qui compte les appuis). */
  hold(i: number, down: boolean) {
    const bit = 1 << i;
    const next = down ? this.st.held | bit : this.st.held & ~bit;
    if (next === this.st.held) return;
    this.st.held = next;
    this.flush();
  }

  /** Remet tout à zéro (téléphone verrouillé, onglet masqué…). */
  release() {
    this.st.dx = 0;
    this.st.dy = 0;
    this.st.held = 0;
    this.flush();
  }

  press(i: number) {
    if (i < 0 || i >= this.st.btn.length) return;
    this.st.btn[i]++;
    this.flush();
  }

  /** À appeler quand la page redevient visible (téléphone déverrouillé). */
  wake() {
    if (!this.room) return;
    if (this.phase === "lost" || !this.conn?.open) {
      this.attempts = 0;
      this.reconnectSoon(0);
    } else this.flush();
  }

  /* ------------------------------------------------------------------ */

  private pidKey() {
    return `party_pid_${this.opts.gameId}_${this.room}`;
  }

  private setPhase(p: PadPhase, error = "") {
    if (this.phase === p && this.error === error) return;
    this.phase = p;
    this.error = error;
    this.onPhase?.(p, error);
  }

  private connect(gen: number) {
    if (gen !== this.gen) return;
    this.attempts++;
    const ensurePeer = (): Peer => {
      if (this.peer && !this.peer.destroyed) return this.peer;
      const peer = new Peer({ debug: 0 });
      this.peer = peer;
      peer.on("error", (err: { type?: string }) => {
        if (gen !== this.gen) return;
        const type = err?.type ?? "";
        if (type === "peer-unavailable") {
          // L'hôte n'existe pas (encore) : mauvais code ou écran fermé.
          if (this.phase === "joining" && this.attempts >= 2) {
            this.fail("no_room");
            return;
          }
        } else if (type === "browser-incompatible") {
          this.fail("browser");
          return;
        } else {
          // Problème de serveur de signalisation : on repart de zéro.
          peer.destroy();
          if (this.peer === peer) this.peer = null;
        }
        this.reconnectSoon();
      });
      peer.on("disconnected", () => {
        if (gen !== this.gen || peer.destroyed) return;
        // Le lien direct éventuel continue de marcher ; on se réinscrit en fond.
        window.setTimeout(() => {
          if (gen === this.gen && !peer.destroyed && peer.disconnected) peer.reconnect();
        }, 1500);
      });
      return peer;
    };

    const peer = ensurePeer();
    const go = () => {
      if (gen !== this.gen) return;
      this.conn?.close();
      const conn = peer.connect(hostPeerId(this.opts.gameId, this.room), { serialization: "json", reliable: true });
      this.conn = conn;
      conn.on("open", () => {
        if (gen !== this.gen || this.conn !== conn) return;
        this.write({ t: "hello", v: PARTY_PROTOCOL, pid: this.pid || undefined, name: this.name });
      });
      conn.on("data", (raw) => {
        if (gen !== this.gen || this.conn !== conn) return;
        this.onHostMessage(raw as HostToPad);
      });
      const lost = () => {
        if (gen !== this.gen || this.conn !== conn) return;
        this.conn = null;
        if (this.phase === "on") this.setPhase("lost");
        this.reconnectSoon();
      };
      conn.on("close", lost);
      conn.on("error", lost);
      // Un lien WebRTC qui ne s'établit jamais ne lève pas toujours d'erreur.
      window.setTimeout(() => {
        if (gen === this.gen && this.conn === conn && !conn.open) {
          conn.close();
          lost();
        }
      }, 9000);
    };
    if (peer.open) go();
    else {
      let started = false;
      peer.on("open", () => {
        if (started) return;
        started = true;
        go();
      });
    }
  }

  private onHostMessage(msg: HostToPad) {
    if (!msg || typeof msg !== "object") return;
    this.lastHost = performance.now();
    if (msg.t === "welcome") {
      this.pid = msg.pid;
      this.name = msg.name;
      this.attempts = 0;
      try {
        window.sessionStorage.setItem(this.pidKey(), msg.pid);
      } catch {
        /* ignore */
      }
      this.setPhase("on");
      this.flush();
    } else if (msg.t === "status") {
      if (this.phase === "lost") this.setPhase("on");
      this.onStatus?.(msg.status);
    } else if (msg.t === "reject") {
      this.fail(msg.reason);
    }
  }

  private fail(reason: string) {
    this.leave(false);
    this.setPhase("error", PAD_ERRORS[reason] ?? PAD_ERRORS.network);
  }

  private reconnectSoon(delay?: number) {
    const gen = this.gen;
    if (this.retryTimer) return;
    const d = delay ?? Math.min(5000, 600 * this.attempts);
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      if (gen !== this.gen) return;
      if (this.phase === "joining" && this.attempts >= 6) {
        this.fail("network");
        return;
      }
      this.connect(gen);
    }, d);
  }

  private tick() {
    if (this.phase === "on" || this.phase === "lost") {
      if (this.phase === "on" && performance.now() - this.lastHost > HOST_TIMEOUT) {
        this.setPhase("lost");
        this.attempts = 0;
        this.reconnectSoon(0);
      }
      this.flush();
    }
  }

  private flush() {
    if (this.phase !== "on" && this.phase !== "lost") return;
    this.st.seq++;
    this.write({ t: "in", seq: this.st.seq, dx: this.st.dx, dy: this.st.dy, btn: this.st.btn.slice(), held: this.st.held });
  }

  private write(msg: PadToHost) {
    const c = this.conn;
    try {
      if (c?.open) void c.send(msg);
    } catch {
      /* canal fermé entre-temps */
    }
  }
}
