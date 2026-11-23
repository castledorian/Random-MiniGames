import { useCallback, useEffect, useRef, useState } from "react";
import { GAME_ID, PAD_BUTTONS } from "@/game/padClient";
import { PartyPad } from "@/party/pad";
import { cleanRoomCode } from "@/party/protocol";

interface Status {
  state?: string;
  hero?: string;
  name?: string;
  skill?: string;
  color?: string;
  slot?: number;
  alive?: boolean;
  cd?: number;
  cdMax?: number;
  vib?: number;
  lives?: number;
  joined?: boolean;
  ready?: boolean;
}

const R = 56;

export default function PadPage() {
  const [room, setRoom] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [phase, setPhase] = useState<"ask" | "joining" | "on" | "error" | "lost">("ask");
  const [err, setErr] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [, force] = useState(0);

  const padRef = useRef<PartyPad | null>(null);
  const cdEnd = useRef(0);
  const cdTotal = useRef(1);
  const lastVib = useRef<number | null>(null);

  const zoneRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const joy = useRef<{ id: number; ox: number; oy: number; axis: "x" | "y" | null } | null>(null);

  const applyStatus = useCallback((s: Status | null) => {
    if (!s) return;
    setStatus(s);
    if (typeof s.cd === "number" && typeof s.cdMax === "number") {
      cdEnd.current = Date.now() + s.cd * 1000;
      cdTotal.current = Math.max(0.1, s.cdMax);
    }
    if (typeof s.vib === "number") {
      if (lastVib.current !== null && s.vib !== lastVib.current && navigator.vibrate) navigator.vibrate([90, 40, 160]);
      lastVib.current = s.vib;
    }
  }, []);

  // Création du client manette
  useEffect(() => {
    const pad = new PartyPad({ gameId: GAME_ID, buttons: PAD_BUTTONS });
    padRef.current = pad;
    pad.onPhase = (p, e) => {
      if (p === "idle") return;
      setPhase(p);
      setErr(e);
      if (p === "on") setRoom(pad.room);
    };
    pad.onStatus = (s) => applyStatus(s as Status | null);
    let saved = "";
    try {
      saved = localStorage.getItem("boomb_padname") || "";
    } catch {
      /* ignore */
    }
    setNameInput(saved);
    const q = new URLSearchParams(window.location.search).get("room");
    if (q) {
      setCodeInput(cleanRoomCode(q));
      if (saved) {
        setPhase("joining");
        pad.join(q, saved);
      }
    }
    // Pas de « bye » à la fermeture : un rechargement de page doit retrouver
    // la même place (la salle garde le téléphone 60 s).
    return () => {
      pad.leave(false);
      padRef.current = null;
    };
  }, [applyStatus]);

  const join = useCallback((code: string) => {
    const c = cleanRoomCode(code);
    const pad = padRef.current;
    if (!c || !pad) return;
    const name = nameInput.trim() || "Joueur " + Math.floor(Math.random() * 90 + 10);
    try {
      localStorage.setItem("boomb_padname", name);
    } catch {
      /* ignore */
    }
    setNameInput(name);
    setErr("");
    setPhase("joining");
    pad.join(c, name);
  }, [nameInput]);

  // Rafraîchissement de l'UI (recharge du skill, état du lien)
  useEffect(() => {
    if (phase !== "on" && phase !== "lost") return;
    const ui = window.setInterval(() => force((n) => n + 1), 120);
    return () => window.clearInterval(ui);
  }, [phase]);

  // Garder l'écran allumé + relâcher le joystick quand le téléphone se verrouille
  useEffect(() => {
    if (phase !== "on") return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } };
    const req = () => nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => undefined);
    void req();
    const vis = () => {
      if (document.visibilityState === "visible") {
        void req();
        padRef.current?.wake();
      } else padRef.current?.setDir(0, 0);
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      void lock?.release();
    };
  }, [phase]);

  /* ---------------- Joystick ---------------- */

  const setDir = (dx: number, dy: number) => padRef.current?.setDir(dx, dy);

  const placeBase = (x: number, y: number) => {
    if (baseRef.current) baseRef.current.style.transform = `translate(${x - 70}px, ${y - 70}px)`;
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joy.current) return;
    const z = zoneRef.current;
    if (!z) return;
    z.setPointerCapture(e.pointerId);
    const r = z.getBoundingClientRect();
    const ox = e.clientX - r.left;
    const oy = e.clientY - r.top;
    joy.current = { id: e.pointerId, ox, oy, axis: null };
    if (baseRef.current) {
      baseRef.current.style.opacity = "1";
      baseRef.current.style.left = "0px";
      baseRef.current.style.top = "0px";
      baseRef.current.style.bottom = "auto";
    }
    placeBase(ox, oy);
    if (knobRef.current) knobRef.current.style.transform = "translate(0px,0px)";
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const j = joy.current;
    const z = zoneRef.current;
    if (!j || j.id !== e.pointerId || !z) return;
    const r = z.getBoundingClientRect();
    let vx = e.clientX - r.left - j.ox;
    let vy = e.clientY - r.top - j.oy;
    const d = Math.hypot(vx, vy);
    if (d > R * 1.5) {
      const k = (d - R * 1.5) / d;
      j.ox += vx * k;
      j.oy += vy * k;
      vx = e.clientX - r.left - j.ox;
      vy = e.clientY - r.top - j.oy;
      placeBase(j.ox, j.oy);
    }
    const dd = Math.hypot(vx, vy);
    const cl = dd > R ? R / dd : 1;
    if (knobRef.current) knobRef.current.style.transform = `translate(${vx * cl}px, ${vy * cl}px)`;
    if (dd < 14) {
      j.axis = null;
      setDir(0, 0);
      return;
    }
    const ax = Math.abs(vx);
    const ay = Math.abs(vy);
    if (j.axis === "x") {
      if (ay > ax * 1.35) j.axis = "y";
    } else if (j.axis === "y") {
      if (ax > ay * 1.35) j.axis = "x";
    } else j.axis = ax >= ay ? "x" : "y";
    if (j.axis === "x") setDir(vx > 0 ? 1 : -1, 0);
    else setDir(0, vy > 0 ? 1 : -1);
  };

  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!joy.current || joy.current.id !== e.pointerId) return;
    joy.current = null;
    setDir(0, 0);
    if (knobRef.current) knobRef.current.style.transform = "translate(0px,0px)";
    if (baseRef.current) {
      baseRef.current.style.opacity = "0.55";
      baseRef.current.style.transform = "";
      baseRef.current.style.left = "";
      baseRef.current.style.top = "";
      baseRef.current.style.bottom = "";
    }
  };

  const press = (k: "b" | "s") => (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.classList.add("down");
    padRef.current?.press(k === "b" ? 0 : 1);
    if (navigator.vibrate) navigator.vibrate(12);
  };
  const release = (e: React.PointerEvent<HTMLDivElement>) => e.currentTarget.classList.remove("down");

  /* ---------------- Rendu ---------------- */

  const color = status?.color || "#5ee7ff";
  const remaining = Math.max(0, (cdEnd.current - Date.now()) / 1000);
  const cdFrac = Math.min(1, remaining / cdTotal.current);
  const stale = phase === "on" && !!padRef.current && performance.now() - padRef.current.lastHost > 1500;

  if (phase === "ask" || phase === "error" || phase === "joining") {
    return (
      <div className="screen grid place-items-center p-5">
        <div className="panel w-full max-w-sm p-6 text-center">
          <h1 className="logo-boom text-5xl">BOOM</h1>
          <div className="logo-sub text-lg">MANETTE</div>
          <p className="mt-4 text-sm font-semibold text-[var(--muted)]">Choisissez votre pseudo et entrez le code de salle affiché sur l&apos;écran du jeu (ou scannez son QR code).</p>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value.slice(0, 12))}
            maxLength={12}
            placeholder="Pseudo"
            aria-label="Pseudo"
            className="mt-4 w-full rounded-xl border-2 border-white/20 bg-black/40 py-2 text-center text-xl font-black text-white outline-none focus:border-[var(--cyan)]"
          />
          <input
            aria-label="Code de salle"
            value={codeInput}
            onChange={(e) => setCodeInput(cleanRoomCode(e.target.value))}
            maxLength={6}
            inputMode="text"
            autoCapitalize="characters"
            placeholder="ABCD"
            className="mt-4 w-full rounded-xl border-2 border-white/20 bg-black/40 py-3 text-center text-3xl font-black tracking-[0.4em] text-[var(--yellow)] outline-none focus:border-[var(--cyan)]"
          />
          {err && <div className="mt-3 text-sm font-bold text-[var(--red)]">{err}</div>}
          <button className="btn btn-lg mt-4 w-full" disabled={phase === "joining" || codeInput.length < 3} onClick={() => join(codeInput)}>
            {phase === "joining" ? "Connexion…" : "Rejoindre"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden"
      style={{ background: `radial-gradient(600px 400px at 50% 0%, ${color}33, transparent 70%), linear-gradient(180deg,#0d1330,#070b1a)`, touchAction: "none" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between px-4 pt-3 text-xs font-black uppercase tracking-widest">
        <span className="flex items-center gap-2" style={{ color: phase === "lost" || stale ? "#ff4d6d" : "#7cf5a1" }}>
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: phase === "lost" || stale ? "#ff4d6d" : "#7cf5a1", boxShadow: "0 0 10px currentColor" }} />
          {phase === "lost" ? "Reconnexion…" : stale ? "Connexion lente…" : "Connecté"} · {room}
        </span>
        <button
          className="rounded-lg border border-white/20 px-2 py-1 text-[10px] text-white/80"
          onClick={() => {
            const el = document.documentElement;
            if (document.fullscreenElement) void document.exitFullscreen();
            else void el.requestFullscreen?.().catch(() => undefined);
          }}
        >
          Plein écran
        </button>
      </div>

      <div className="px-4 pt-3 text-center">
        {status && status.hero ? (
          <>
            <div className="text-[11px] font-black uppercase tracking-[0.3em] text-white/50">
              {status.state === "lobby" ? (status.ready ? "Prêt ✓" : "Salon") : status.alive === false ? "Éliminé" : "En jeu"}
              {typeof status.slot === "number" ? " · J" + (status.slot + 1) : ""}
            </div>
            <div className="text-3xl font-black uppercase italic" style={{ color }}>
              {status.name}
            </div>
            {status.state !== "lobby" && typeof status.lives === "number" && status.lives > 1 && <div className="text-sm font-black text-[#ff6b9d]">♥ {status.lives}</div>}
          </>
        ) : (
          <div className="text-sm font-bold text-white/70">
            {status?.state === "lobby" ? (
              <>
                <b className="text-[var(--yellow)]">Salon versus</b> : appuyez sur <b className="text-[var(--pink)]">BOMBE</b> pour rejoindre !
              </>
            ) : (
              <>
                Menu principal : appuyez sur <b className="text-[var(--pink)]">BOMBE</b> pour lancer une partie solo.
              </>
            )}
          </div>
        )}
      </div>

      {/* zone joystick */}
      <div
        ref={zoneRef}
        className="absolute bottom-0 left-0 w-1/2"
        style={{ top: 96, touchAction: "none" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div
          ref={baseRef}
          className="absolute bottom-[12%] left-[10%] h-[140px] w-[140px] rounded-full border-4 border-white/40 bg-white/10"
          style={{ opacity: 0.55 }}
        >
          <div
            ref={knobRef}
            className="absolute left-1/2 top-1/2 -ml-9 -mt-9 h-[72px] w-[72px] rounded-full border-4"
            style={{ borderColor: color, background: `radial-gradient(circle at 35% 30%, #fff9, ${color}88)` }}
          />
        </div>
        <div className="pointer-events-none absolute left-0 right-0 top-2 text-center text-[11px] font-bold uppercase tracking-widest text-white/35">Glissez ici</div>
      </div>

      {/* boutons */}
      <div
        className="touch-btn"
        style={{ right: "6%", bottom: "9%", width: 124, height: 124, fontSize: 22, background: "radial-gradient(circle at 35% 30%, #ff9a6b, #e8412a)", borderColor: "#ffd9c9" }}
        onPointerDown={press("b")}
        onPointerUp={release}
        onPointerCancel={release}
      >
        Bombe
      </div>
      <div
        className="touch-btn"
        style={{
          right: "30%",
          bottom: "27%",
          width: 100,
          height: 100,
          fontSize: 12,
          textAlign: "center",
          lineHeight: 1.1,
          padding: 6,
          borderColor: remaining <= 0 ? color : "rgba(255,255,255,0.35)",
          boxShadow: remaining <= 0 ? `0 0 26px ${color}` : undefined,
          backgroundImage: `conic-gradient(rgba(5,8,25,0.72) ${cdFrac}turn, transparent 0), radial-gradient(circle at 35% 30%, #8ff1ff, ${color})`,
        }}
        onPointerDown={press("s")}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <span style={{ display: "block", fontSize: (status?.skill || "Skill").length > 11 ? 9.5 : (status?.skill || "Skill").length > 8 ? 11 : 13, letterSpacing: 0 }}>{status?.skill || "Skill"}</span>
        {remaining > 0 && <span className="block text-sm">{remaining.toFixed(0)}s</span>}
      </div>
    </div>
  );
}
