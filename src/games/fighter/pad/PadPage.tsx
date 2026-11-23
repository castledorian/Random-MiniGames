import { useEffect, useRef, useState } from "react";
import { usePartyPad } from "@party/usePartyPad";
import { GAME_ID, PAD_BUTTONS } from "../padLink";

interface Status extends Record<string, unknown> {
  state?: "menu" | "playing" | "paused" | "over" | "busy";
  hero?: string;
  color?: string;
  skill?: string;
  cd?: number;
  cdMax?: number;
}

const R = 60;
const STEP = 0.25;
const q = (v: number) => Math.round(v / STEP) * STEP;

const STATE_TEXT: Record<string, string> = {
  menu: "Menu : appuie sur ATTAQUE pour lancer le combat",
  playing: "En combat",
  paused: "Pause",
  over: "Combat terminé : ATTAQUE pour rejouer",
  busy: "Une autre manette pilote déjà ce jeu",
};

export default function PadPage() {
  const { pad, phase, err, room, status, name, setName, code, setCode, join } = usePartyPad<Status>(GAME_ID, PAD_BUTTONS);
  const [, force] = useState(0);
  const cdEnd = useRef(0);
  const cdTotal = useRef(1);
  const zoneRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const joy = useRef<{ id: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (status && typeof status.cd === "number" && typeof status.cdMax === "number") {
      cdEnd.current = Date.now() + status.cd * 1000;
      cdTotal.current = Math.max(0.1, status.cdMax);
    }
  }, [status]);

  useEffect(() => {
    if (phase !== "on" && phase !== "lost") return;
    const id = window.setInterval(() => force((n) => n + 1), 120);
    return () => window.clearInterval(id);
  }, [phase]);

  /* ------------------------------ joystick analogique ------------------------------ */
  const placeBase = (x: number, y: number) => {
    if (baseRef.current) baseRef.current.style.transform = `translate(${x - 75}px, ${y - 75}px)`;
  };
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joy.current || !zoneRef.current) return;
    zoneRef.current.setPointerCapture(e.pointerId);
    const r = zoneRef.current.getBoundingClientRect();
    const ox = e.clientX - r.left;
    const oy = e.clientY - r.top;
    joy.current = { id: e.pointerId, ox, oy };
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
    if (d > R * 1.4) {
      const k = (d - R * 1.4) / d;
      j.ox += vx * k;
      j.oy += vy * k;
      vx = e.clientX - r.left - j.ox;
      vy = e.clientY - r.top - j.oy;
      placeBase(j.ox, j.oy);
    }
    const dd = Math.hypot(vx, vy);
    const cl = dd > R ? R / dd : 1;
    if (knobRef.current) knobRef.current.style.transform = `translate(${vx * cl}px, ${vy * cl}px)`;
    if (dd < 12) pad.current?.setDir(0, 0);
    else pad.current?.setDir(q((vx * cl) / R), q((vy * cl) / R));
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!joy.current || joy.current.id !== e.pointerId) return;
    joy.current = null;
    pad.current?.setDir(0, 0);
    if (knobRef.current) knobRef.current.style.transform = "translate(0px,0px)";
    if (baseRef.current) {
      baseRef.current.style.opacity = "0.55";
      baseRef.current.style.transform = "";
      baseRef.current.style.left = "";
      baseRef.current.style.top = "";
      baseRef.current.style.bottom = "";
    }
  };

  /* ---------------------------------- boutons ---------------------------------- */
  const btn = (i: number, hold = false) => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.dataset.down = "1";
      pad.current?.press(i);
      if (hold) pad.current?.hold(i, true);
      if (navigator.vibrate) navigator.vibrate(10);
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.dataset.down = "";
      if (hold) pad.current?.hold(i, false);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.dataset.down = "";
      if (hold) pad.current?.hold(i, false);
    },
  });

  const color = status?.color || "#22e6ff";
  const remaining = Math.max(0, (cdEnd.current - Date.now()) / 1000);
  const cdFrac = Math.min(1, remaining / cdTotal.current);
  const stale = phase === "on" && !!pad.current && performance.now() - pad.current.lastHost > 1500;

  if (phase === "idle" || phase === "error" || phase === "joining") {
    return (
      <div className="fixed inset-0 grid place-items-center overflow-auto bg-[#07041a] p-5">
        <div className="w-full max-w-sm rounded-2xl border-2 border-white/15 bg-[#140a35] p-6 text-center">
          <h1 className="font-display text-4xl text-[#ff3ea5]">RIFT BRAWL</h1>
          <div className="font-display text-lg tracking-widest text-[#22e6ff]">MANETTE</div>
          <p className="mt-4 text-sm font-semibold text-white/65">Choisis ton pseudo et entre le code de salle affiché sur l&apos;écran du jeu (ou scanne son QR code).</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 12))}
            maxLength={12}
            placeholder="Pseudo"
            aria-label="Pseudo"
            className="mt-4 w-full rounded-xl border-2 border-white/20 bg-black/40 py-2 text-center text-xl font-black text-white outline-none focus:border-[#22e6ff]"
          />
          <input
            aria-label="Code de salle"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            maxLength={6}
            autoCapitalize="characters"
            placeholder="ABCD"
            className="mt-3 w-full rounded-xl border-2 border-white/20 bg-black/40 py-3 text-center text-3xl font-black tracking-[0.4em] text-[#ffd23f] outline-none focus:border-[#22e6ff]"
          />
          {err && <div className="mt-3 text-sm font-bold text-[#ff4d6d]">{err}</div>}
          <button
            className="mt-4 w-full rounded-2xl px-6 py-4 text-xl font-black uppercase text-[#0b1022] disabled:opacity-50"
            style={{ background: "linear-gradient(180deg,#ffe066,#ffb703)" }}
            disabled={phase === "joining" || code.length < 3}
            onClick={() => join(code)}
          >
            {phase === "joining" ? "Connexion…" : "Rejoindre"}
          </button>
        </div>
      </div>
    );
  }

  const bad = phase === "lost" || stale;
  const st = status?.state ?? "menu";
  const bigBtn: React.CSSProperties = {
    position: "absolute",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    touchAction: "none",
    border: "3px solid rgba(255,255,255,0.55)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
  };

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden"
      style={{ background: `radial-gradient(600px 400px at 50% 0%, ${color}33, transparent 70%), linear-gradient(180deg,#0d0830,#07041a)`, touchAction: "none" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <style>{`[data-down="1"]{transform:scale(.92);filter:brightness(1.3)}`}</style>
      <div className="flex items-center justify-between px-4 pt-3 text-xs font-black uppercase tracking-widest" style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}>
        <span className="flex items-center gap-2" style={{ color: bad ? "#ff4d6d" : "#7cf5a1" }}>
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: bad ? "#ff4d6d" : "#7cf5a1", boxShadow: "0 0 10px currentColor" }} />
          {phase === "lost" ? "Reconnexion…" : stale ? "Connexion lente…" : "Connecté"} · {room}
        </span>
        <span className="flex gap-2">
          <div className="rounded-lg border border-white/25 px-3 py-1.5 text-[11px] text-white/85" {...btn(3)}>
            ❚❚ Pause
          </div>
          <button
            className="rounded-lg border border-white/20 px-2 py-1 text-[10px] text-white/80"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else void document.documentElement.requestFullscreen?.().catch(() => undefined);
            }}
          >
            Plein écran
          </button>
        </span>
      </div>

      <div className="px-4 pt-2 text-center">
        {status?.hero && st !== "menu" && (
          <div className="font-display text-3xl" style={{ color }}>
            {status.hero}
          </div>
        )}
        <div className="text-[12px] font-bold uppercase tracking-widest text-white/60">{STATE_TEXT[st] ?? ""}</div>
      </div>

      {/* zone joystick */}
      <div ref={zoneRef} className="absolute bottom-0 left-0 w-[45%]" style={{ top: 90, touchAction: "none" }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div ref={baseRef} className="absolute bottom-[12%] left-[10%] h-[150px] w-[150px] rounded-full border-4 border-white/40 bg-white/10" style={{ opacity: 0.55 }}>
          <div ref={knobRef} className="absolute left-1/2 top-1/2 -ml-9 -mt-9 h-[72px] w-[72px] rounded-full border-4" style={{ borderColor: color, background: `radial-gradient(circle at 35% 30%, #fff9, ${color}88)` }} />
        </div>
        <div className="pointer-events-none absolute left-0 right-0 top-2 text-center text-[11px] font-bold uppercase tracking-widest text-white/35">Glisse ici · ↑ = saut</div>
      </div>

      {/* boutons d'action */}
      <div
        style={{ ...bigBtn, right: "4%", bottom: "8%", width: 120, height: 120, fontSize: 18, background: "radial-gradient(circle at 35% 30%, #ff7fc4, #e0238a)", borderColor: "#ffd1ea" }}
        {...btn(1)}
      >
        Attaque
      </div>
      <div
        style={{
          ...bigBtn,
          right: "27%",
          bottom: "12%",
          width: 96,
          height: 96,
          fontSize: 12,
          textAlign: "center",
          lineHeight: 1.1,
          padding: 6,
          borderColor: remaining <= 0 ? color : "rgba(255,255,255,0.35)",
          boxShadow: remaining <= 0 ? `0 0 26px ${color}` : "0 6px 18px rgba(0,0,0,0.45)",
          backgroundImage: `conic-gradient(rgba(5,8,25,0.72) ${cdFrac}turn, transparent 0), radial-gradient(circle at 35% 30%, #aef6ff, ${color})`,
        }}
        {...btn(2)}
      >
        <span style={{ display: "block" }}>
          {status?.skill || "Spécial"}
          {remaining > 0 && <span style={{ display: "block", fontSize: 14 }}>{remaining.toFixed(0)}s</span>}
        </span>
      </div>
      <div
        style={{ ...bigBtn, right: "9%", bottom: "42%", width: 84, height: 84, fontSize: 13, background: "radial-gradient(circle at 35% 30%, #ffe27a, #e0a000)", borderColor: "#fff2c2" }}
        {...btn(0, true)}
      >
        Saut
      </div>
    </div>
  );
}
