import { Peer, type DataConnection } from "peerjs";
import {
  MAX_PADS,
  PARTY_PROTOCOL,
  clampAxis,
  cleanPadName,
  counter,
  hostPeerId,
  randomRoomCode,
  type HostToPad,
  type PadToHost,
} from "./protocol";

export type HostState = "connecting" | "ready" | "offline";

export interface PadSnapshot {
  pid: string;
  name: string;
  dx: number;
  dy: number;
  /** Compteurs d'appuis par bouton. */
  btn: number[];
  /** performance.now() du dernier message reçu. */
  at: number;
  connected: boolean;
}

interface PadEntry extends PadSnapshot {
  conn: DataConnection | null;
  seq: number;
}

export interface PartyHostOptions {
  /** Identifiant court et unique du jeu, ex. "bomberman". */
  gameId: string;
  maxPads?: number;
  /** Clé sessionStorage pour garder le même code de salle après un rechargement. */
  storageKey?: string;
}

/** Délai sans message après lequel un téléphone est considéré déconnecté. */
const PAD_TIMEOUT = 4000;
/** Délai après lequel un téléphone parti est oublié (il perd sa place). */
const PAD_FORGET = 60000;

/**
 * Côté écran : ouvre une « salle » joignable par les téléphones.
 * Gère seul les reconnexions au serveur de signalisation et les collisions de code.
 */
export class PartyHost {
  room = "";
  state: HostState = "connecting";
  onRoom: ((room: string) => void) | null = null;
  onState: ((s: HostState) => void) | null = null;
  /** Appelé quand la liste des téléphones connectés change. */
  onPads: ((pads: PadSnapshot[]) => void) | null = null;
  /** Appelé à chaque message d'entrée d'un téléphone. */
  onInput: ((pad: PadSnapshot) => void) | null = null;

  private peer: Peer | null = null;
  private pads = new Map<string, PadEntry>();
  private gen = 0;
  private retry = 0;
  private retryTimer: number | null = null;
  private sweepTimer: number | null = null;
  private lastKey = "";
  /** Dernier code de salle effectivement obtenu auprès du serveur. */
  private ownedRoom = "";
  private idRetries = 0;
  private readonly maxPads: number;
  private readonly storageKey: string;

  constructor(private readonly opts: PartyHostOptions) {
    this.maxPads = opts.maxPads ?? MAX_PADS;
    this.storageKey = opts.storageKey ?? `party_room_${opts.gameId}`;
  }

  start() {
    if (typeof window === "undefined") return;
    this.stop();
    const gen = ++this.gen;
    this.room = this.loadRoom();
    this.onRoom?.(this.room);
    this.sweepTimer = window.setInterval(() => this.sweep(), 1000);
    this.open(gen);
  }

  stop() {
    this.gen++;
    if (this.retryTimer) window.clearTimeout(this.retryTimer);
    if (this.sweepTimer) window.clearInterval(this.sweepTimer);
    this.retryTimer = null;
    this.sweepTimer = null;
    this.pads.forEach((p) => p.conn?.close());
    this.pads.clear();
    this.peer?.destroy();
    this.peer = null;
    this.emitPads();
  }

  /** Téléphones actuellement connectés. */
  list(): PadSnapshot[] {
    const out: PadSnapshot[] = [];
    this.pads.forEach((p) => {
      if (p.connected) out.push(snap(p));
    });
    return out;
  }

  /** Envoie un état d'affichage (héros, recharge, vibration…) à un téléphone. */
  send(pid: string, status: Record<string, unknown> | null) {
    const p = this.pads.get(pid);
    if (p?.conn?.open) this.write(p.conn, { t: "status", status });
  }

  /* ------------------------------------------------------------------ */

  private loadRoom(): string {
    try {
      const saved = window.sessionStorage.getItem(this.storageKey);
      if (saved && /^[A-Z]{4}$/.test(saved)) {
        // Probablement notre salle d'avant un rechargement de page.
        this.ownedRoom = saved;
        return saved;
      }
    } catch {
      /* stockage indisponible (navigation privée) */
    }
    return this.newRoom();
  }

  private newRoom(): string {
    const code = randomRoomCode(4);
    try {
      window.sessionStorage.setItem(this.storageKey, code);
    } catch {
      /* ignore */
    }
    return code;
  }

  private setState(s: HostState) {
    if (this.state === s) return;
    this.state = s;
    this.onState?.(s);
  }

  private open(gen: number) {
    if (gen !== this.gen) return;
    this.setState("connecting");
    const peer = new Peer(hostPeerId(this.opts.gameId, this.room), { debug: 0 });
    this.peer = peer;

    peer.on("open", () => {
      if (gen !== this.gen) return;
      this.retry = 0;
      this.idRetries = 0;
      this.ownedRoom = this.room;
      this.setState("ready");
    });

    peer.on("connection", (conn) => {
      if (gen !== this.gen) {
        conn.close();
        return;
      }
      this.accept(conn);
    });

    peer.on("disconnected", () => {
      // Perte du serveur de signalisation : les manettes déjà connectées
      // continuent de fonctionner (lien direct), on tente juste de se réinscrire.
      if (gen !== this.gen || peer.destroyed) return;
      this.setState("offline");
      this.schedule(gen, () => {
        if (!peer.destroyed && peer.disconnected) peer.reconnect();
      });
    });

    peer.on("error", (err: { type?: string }) => {
      if (gen !== this.gen) return;
      const type = err?.type ?? "";
      if (type === "unavailable-id") {
        peer.destroy();
        if (this.ownedRoom === this.room && this.idRetries < 4) {
          // Notre propre ancienne session n'est pas encore libérée par le serveur :
          // on garde le même code (les QR codes affichés restent valables).
          this.idRetries++;
          this.setState("offline");
          this.schedule(gen, () => this.open(gen));
          return;
        }
        // Code déjà pris par une autre salle : on en tire un nouveau.
        this.idRetries = 0;
        this.room = this.newRoom();
        this.onRoom?.(this.room);
        this.open(gen);
        return;
      }
      if (type === "peer-unavailable") return; // concerne une connexion sortante, sans objet ici
      if (type === "browser-incompatible") {
        this.setState("offline");
        return;
      }
      // network / server-error / socket-error / socket-closed… : on recrée le pair.
      this.setState("offline");
      this.schedule(gen, () => {
        peer.destroy();
        this.open(gen);
      });
    });
  }

  private schedule(gen: number, fn: () => void) {
    if (this.retryTimer) window.clearTimeout(this.retryTimer);
    const delay = Math.min(15000, 1000 * 2 ** this.retry);
    this.retry = Math.min(this.retry + 1, 4);
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      if (gen === this.gen) fn();
    }, delay);
  }

  private accept(conn: DataConnection) {
    let pad: PadEntry | null = null;

    conn.on("data", (raw) => {
      const msg = raw as PadToHost;
      if (!msg || typeof msg !== "object") return;

      if (msg.t === "hello") {
        if (msg.v !== PARTY_PROTOCOL) {
          this.write(conn, { t: "reject", reason: "version" });
          return;
        }
        const wanted = typeof msg.pid === "string" ? msg.pid : "";
        let existing = wanted ? this.pads.get(wanted) : undefined;
        if (!existing) {
          const connected = this.list().length;
          if (connected >= this.maxPads) {
            this.write(conn, { t: "reject", reason: "full" });
            window.setTimeout(() => conn.close(), 300);
            return;
          }
          const pid = Math.random().toString(36).slice(2, 8);
          existing = { pid, name: "", dx: 0, dy: 0, btn: [], at: 0, connected: false, conn: null, seq: -1 };
          this.pads.set(pid, existing);
        } else if (existing.conn && existing.conn !== conn) {
          existing.conn.close();
        }
        pad = existing;
        pad.conn = conn;
        pad.name = cleanPadName(msg.name);
        pad.connected = true;
        pad.at = performance.now();
        pad.seq = -1;
        // La manette a pu être rechargée : ses compteurs repartent de zéro.
        pad.btn = [];
        this.write(conn, { t: "welcome", pid: pad.pid, name: pad.name });
        this.emitPads();
        return;
      }

      if (!pad || pad.conn !== conn) return;

      if (msg.t === "in") {
        pad.at = performance.now();
        if (!pad.connected) {
          pad.connected = true;
          this.emitPads();
        }
        const seq = counter(msg.seq);
        if (seq <= pad.seq) return; // message en retard
        pad.seq = seq;
        pad.dx = clampAxis(msg.dx);
        pad.dy = clampAxis(msg.dy);
        const btn = Array.isArray(msg.btn) ? msg.btn.slice(0, 8) : [];
        // Les compteurs ne peuvent qu'augmenter.
        pad.btn = btn.map((n, i) => Math.max(pad!.btn[i] ?? 0, counter(n)));
        this.onInput?.(snap(pad));
        return;
      }

      if (msg.t === "bye") {
        this.pads.delete(pad.pid);
        conn.close();
        this.emitPads();
      }
    });

    const gone = () => {
      if (pad && pad.conn === conn) {
        pad.conn = null;
        pad.connected = false;
        pad.dx = 0;
        pad.dy = 0;
        this.onInput?.(snap(pad));
        this.emitPads();
      }
    };
    conn.on("close", gone);
    conn.on("error", gone);
  }

  private sweep() {
    const now = performance.now();
    let changed = false;
    this.pads.forEach((p, pid) => {
      const idle = now - p.at;
      if (p.connected && idle > PAD_TIMEOUT) {
        p.connected = false;
        p.dx = 0;
        p.dy = 0;
        changed = true;
      }
      if (!p.connected && idle > PAD_FORGET) {
        p.conn?.close();
        this.pads.delete(pid);
        changed = true;
      }
    });
    if (changed) this.emitPads();
  }

  private emitPads() {
    const list = this.list();
    const key = list.map((p) => p.pid + ":" + p.name).join("|");
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.onPads?.(list);
  }

  private write(conn: DataConnection, msg: HostToPad) {
    try {
      if (conn.open) void conn.send(msg);
    } catch {
      /* canal fermé entre-temps */
    }
  }
}

function snap(p: PadEntry): PadSnapshot {
  return { pid: p.pid, name: p.name, dx: p.dx, dy: p.dy, btn: p.btn.slice(), at: p.at, connected: p.connected };
}
