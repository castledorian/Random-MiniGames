import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePartyPad } from "./usePartyPad";

/**
 * Manette téléphone commune à tous les jeux : écran de connexion, barre d'état,
 * joystick flottant (moitié gauche) et gros boutons d'action (moitié droite).
 * Pensée pour être tenue à deux mains, en paysage comme en portrait.
 */

export interface PadButtonDef {
  /** Index du bouton dans le protocole (compteur d'appuis). */
  id: number;
  label: string;
  /** Petit texte sous le libellé (ex. « maintenir = lourde »). */
  sub?: string;
  /** Couleur principale du bouton. */
  color: string;
  /** Diamètre en vmin. */
  size: number;
  /** Position (en vmin depuis le coin bas-droit de l'écran). */
  right: number;
  bottom: number;
  /** Envoie aussi l'état « maintenu » (bit `id` du masque). */
  hold?: boolean;
  /** Recharge en cours : fraction 0..1 restante (assombrit le bouton). */
  cooldown?: number;
  /** Secondes restantes à afficher pendant la recharge. */
  cdText?: string;
  /** Anneau de progression (ex. charge de l'attaque lourde), 0..1. */
  ring?: number;
}

export interface PadView {
  /** Couleur du joueur (fond, joystick). */
  color: string;
  /** Pastille « J1 », « J2 »… */
  badge?: string;
  /** Titre principal (héros). */
  title?: string;
  /** Ligne d'état (« En combat », « Appuie sur ATTAQUE pour rejoindre »…). */
  line: string;
  /** Infos à droite du titre (%, vies…). */
  extra?: ReactNode;
  buttons: PadButtonDef[];
  /** Bouton pause dans la barre du haut (index protocole). */
  pauseId?: number;
  /** Mise en avant d'un message important (ex. rejoindre). */
  callout?: string;
}

interface ShellProps<S extends Record<string, unknown>> {
  gameId: string;
  buttons: number;
  /** Titre de l'écran de connexion. */
  brand: ReactNode;
  accent: string;
  /** Joystick 4 directions (grille) ou analogique. */
  joystick: "four" | "analog";
  view: (status: S | null) => PadView;
  /** Appelé à chaque nouvel état reçu de l'écran (vibrations…). */
  onStatus?: (s: S) => void;
}

const R_FRAC = 0.13; // rayon du joystick en fraction de la plus petite dimension

export default function PadShell<S extends Record<string, unknown>>({ gameId, buttons, brand, accent, joystick, view, onStatus }: ShellProps<S>) {
  const { pad, phase, err, room, status, name, setName, code, setCode, join } = usePartyPad<S>(gameId, buttons);
  const [, force] = useState(0);
  const [portrait, setPortrait] = useState(false);
  const zoneRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  const joy = useRef<{ id: number; ox: number; oy: number; axis: "x" | "y" | null } | null>(null);

  useEffect(() => {
    if (status && onStatus) onStatus(status);
  }, [status, onStatus]);

  useEffect(() => {
    const f = () => setPortrait(window.innerHeight > window.innerWidth);
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  useEffect(() => {
    if (phase !== "on" && phase !== "lost") return;
    const id = window.setInterval(() => force((n) => n + 1), 150);
    return () => window.clearInterval(id);
  }, [phase]);

  /* ---------------------------------------------------------------- joystick */
  const radius = () => Math.min(window.innerWidth, window.innerHeight) * R_FRAC;
  const showDir = (dx: number, dy: number) => {
    const a = arrowRef.current;
    if (!a) return;
    if (!dx && !dy) {
      a.style.opacity = "0";
      return;
    }
    a.style.opacity = "1";
    a.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  };
  const place = (x: number, y: number) => {
    const b = baseRef.current;
    if (!b) return;
    b.style.left = x + "px";
    b.style.top = y + "px";
  };
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joy.current || !zoneRef.current) return;
    e.preventDefault();
    zoneRef.current.setPointerCapture(e.pointerId);
    const r = zoneRef.current.getBoundingClientRect();
    const ox = e.clientX - r.left;
    const oy = e.clientY - r.top;
    joy.current = { id: e.pointerId, ox, oy, axis: null };
    place(ox, oy);
    if (baseRef.current) baseRef.current.dataset.on = "1";
    if (knobRef.current) knobRef.current.style.transform = "translate(-50%,-50%)";
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const j = joy.current;
    const z = zoneRef.current;
    if (!j || j.id !== e.pointerId || !z) return;
    const R = radius();
    const r = z.getBoundingClientRect();
    let vx = e.clientX - r.left - j.ox;
    let vy = e.clientY - r.top - j.oy;
    const d = Math.hypot(vx, vy);
    // le joystick suit le pouce s'il s'éloigne trop
    if (d > R * 1.35) {
      const k = (d - R * 1.35) / d;
      j.ox += vx * k;
      j.oy += vy * k;
      vx = e.clientX - r.left - j.ox;
      vy = e.clientY - r.top - j.oy;
      place(j.ox, j.oy);
    }
    const dd = Math.hypot(vx, vy);
    const cl = dd > R ? R / dd : 1;
    if (knobRef.current) knobRef.current.style.transform = `translate(calc(-50% + ${vx * cl}px), calc(-50% + ${vy * cl}px))`;
    const p = pad.current;
    if (!p) return;
    if (dd < R * 0.22) {
      j.axis = null;
      p.setDir(0, 0);
      showDir(0, 0);
      return;
    }
    if (joystick === "four") {
      const ax = Math.abs(vx);
      const ay = Math.abs(vy);
      if (j.axis === "x") {
        if (ay > ax * 1.35) j.axis = "y";
      } else if (j.axis === "y") {
        if (ax > ay * 1.35) j.axis = "x";
      } else j.axis = ax >= ay ? "x" : "y";
      const dx = j.axis === "x" ? (vx > 0 ? 1 : -1) : 0;
      const dy = j.axis === "y" ? (vy > 0 ? 1 : -1) : 0;
      p.setDir(dx, dy);
      showDir(dx, dy);
    } else {
      const q = (v: number) => Math.round(v * 4) / 4;
      const nx = q((vx * cl) / R);
      const ny = q((vy * cl) / R);
      p.setDir(nx, ny);
      showDir(nx, ny);
    }
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!joy.current || joy.current.id !== e.pointerId) return;
    joy.current = null;
    pad.current?.setDir(0, 0);
    showDir(0, 0);
    if (knobRef.current) knobRef.current.style.transform = "translate(-50%,-50%)";
    if (baseRef.current) {
      baseRef.current.dataset.on = "";
      baseRef.current.style.left = "";
      baseRef.current.style.top = "";
    }
  };

  /* ---------------------------------------------------------------- boutons */
  const btnHandlers = (b: PadButtonDef) => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.dataset.down = "1";
      pad.current?.press(b.id);
      if (b.hold) pad.current?.hold(b.id, true);
      try {
        navigator.vibrate?.(12);
      } catch {
        /* ignore */
      }
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.dataset.down = "";
      if (b.hold) pad.current?.hold(b.id, false);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.dataset.down = "";
      if (b.hold) pad.current?.hold(b.id, false);
    },
    onLostPointerCapture: (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.dataset.down = "";
      if (b.hold) pad.current?.hold(b.id, false);
    },
  });

  /* ---------------------------------------------------------------- connexion */
  if (phase === "idle" || phase === "error" || phase === "joining") {
    return (
      <div className="fixed inset-0 grid place-items-center overflow-auto p-5" style={{ background: "linear-gradient(180deg,#0d1330,#070b1a)", color: "#fff", fontFamily: FONT }}>
        <div className="w-full max-w-sm rounded-3xl border-2 p-6 text-center" style={{ borderColor: accent + "66", background: "rgba(20,28,60,0.9)" }}>
          {brand}
          <p className="mt-4 text-sm font-semibold" style={{ color: "#aab4e0" }}>
            Choisis ton pseudo et entre le code de salle affiché sur l&apos;écran (ou scanne son QR code).
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 12))}
            maxLength={12}
            placeholder="Ton pseudo"
            aria-label="Pseudo"
            className="mt-4 w-full rounded-2xl border-2 bg-black/40 py-3 text-center text-2xl font-black text-white outline-none"
            style={{ borderColor: "rgba(255,255,255,0.2)", userSelect: "text" }}
          />
          <input
            aria-label="Code de salle"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            maxLength={6}
            autoCapitalize="characters"
            placeholder="CODE"
            className="mt-3 w-full rounded-2xl border-2 bg-black/40 py-3 text-center text-4xl font-black tracking-[0.35em] outline-none"
            style={{ borderColor: "rgba(255,255,255,0.2)", color: "#ffd23f", userSelect: "text" }}
          />
          {err && <div className="mt-3 text-sm font-bold text-[#ff4d6d]">{err}</div>}
          <button
            className="mt-5 w-full rounded-2xl px-6 py-4 text-2xl font-black uppercase disabled:opacity-50"
            style={{ background: "linear-gradient(180deg,#ffe066,#ffb703)", color: "#0b1022", boxShadow: "0 6px 0 #b87400" }}
            disabled={phase === "joining" || code.length < 3}
            onClick={() => {
              void document.documentElement.requestFullscreen?.().catch(() => undefined);
              join(code);
            }}
          >
            {phase === "joining" ? "Connexion…" : "Jouer ▶"}
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- manette */
  const v = view(status);
  const stale = phase === "on" && !!pad.current && performance.now() - pad.current.lastHost > 1500;
  const bad = phase === "lost" || stale;
  const col = v.color;

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden"
      style={{
        background: `radial-gradient(120vmax 70vmax at 50% -10%, ${col}40, transparent 60%), linear-gradient(180deg,#0d1330,#070b1a)`,
        color: "#fff",
        fontFamily: FONT,
        touchAction: "none",
        WebkitUserSelect: "none",
        height: "100dvh",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <style>{CSS}</style>

      {/* barre du haut */}
      <div
        className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-3"
        style={{ height: "max(13vmin, 52px)", paddingTop: "env(safe-area-inset-top)", background: "rgba(5,8,25,0.55)", borderBottom: `3px solid ${col}` }}
      >
        {v.badge && (
          <span className="rounded-full px-3 py-1 text-lg font-black" style={{ background: col, color: "#0b1022" }}>
            {v.badge}
          </span>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-lg font-black uppercase italic" style={{ color: col }}>
            {v.title ?? name}
          </div>
          <div className="truncate text-[11px] font-bold uppercase tracking-wider text-white/70">{v.line}</div>
        </div>
        {v.extra}
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase" style={{ color: bad ? "#ff4d6d" : "#7cf5a1" }}>
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "currentColor", boxShadow: "0 0 8px currentColor" }} />
          {phase === "lost" ? "Reconnexion" : stale ? "Lent" : room}
        </span>
        {v.pauseId !== undefined && (
          <div
            className="pad-btn-s"
            {...btnHandlers({ id: v.pauseId, label: "", color: "", size: 0, right: 0, bottom: 0 })}
            aria-label="Pause"
          >
            ❚❚
          </div>
        )}
        <button
          className="pad-btn-s"
          aria-label="Plein écran"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void document.documentElement.requestFullscreen?.().catch(() => undefined);
          }}
        >
          ⛶
        </button>
      </div>

      {v.callout && (
        <div className="pointer-events-none absolute inset-x-0 z-10 px-4 text-center" style={{ top: "max(16vmin, 64px)" }}>
          <span className="inline-block rounded-2xl px-4 py-2 text-base font-black" style={{ background: "rgba(5,8,25,0.75)", border: `2px solid ${col}` }}>
            {v.callout}
          </span>
        </div>
      )}
      {portrait && (
        <div className="pointer-events-none absolute inset-x-0 z-10 text-center text-[11px] font-bold text-white/45" style={{ top: "max(26vmin, 100px)" }}>
          ↻ Tourne ton téléphone pour plus de confort
        </div>
      )}

      {/* zone joystick : toute la moitié gauche */}
      <div
        ref={zoneRef}
        className="absolute bottom-0 left-0 z-0"
        style={{ top: "max(13vmin, 52px)", width: "50%", touchAction: "none" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div ref={baseRef} className="pad-joy" style={{ ["--c" as string]: col } as CSSProperties}>
          <div ref={arrowRef} className="pad-joy-arrow" />
          <div ref={knobRef} className="pad-joy-knob" />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] font-black uppercase tracking-widest text-white/30">
          Pose ton pouce ici pour bouger
        </div>
      </div>

      {/* boutons d'action */}
      {v.buttons.map((b) => {
        const cd = b.cooldown ?? 0;
        const style: CSSProperties = {
          width: b.size + "vmin",
          height: b.size + "vmin",
          right: `calc(${b.right}vmin + env(safe-area-inset-right))`,
          bottom: `calc(${b.bottom}vmin + env(safe-area-inset-bottom))`,
          fontSize: Math.max(2.8, Math.min(b.size * 0.15, (b.size * 1.45) / Math.max(6, b.label.length))) + "vmin",
          borderColor: cd > 0 ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.85)",
          backgroundImage: `${cd > 0 ? `conic-gradient(rgba(5,8,25,0.7) ${cd}turn, transparent 0),` : ""} radial-gradient(circle at 35% 28%, #ffffffaa, ${b.color} 55%, ${b.color})`,
          boxShadow: cd > 0 ? "0 1.2vmin 0 rgba(0,0,0,0.35)" : `0 1.2vmin 0 rgba(0,0,0,0.35), 0 0 4vmin ${b.color}88`,
        };
        return (
          <div key={b.id} className="pad-btn" style={style} {...btnHandlers(b)}>
            {b.ring !== undefined && b.ring >= 0 && (
              <svg className="pointer-events-none absolute inset-0" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="47" fill="none" stroke="#ffffff" strokeWidth="6" strokeDasharray={`${b.ring * 295} 400`} transform="rotate(-90 50 50)" strokeLinecap="round" />
              </svg>
            )}
            <span className="relative leading-none">
              {b.label}
              {b.cdText ? <span className="block text-[0.8em]">{b.cdText}</span> : b.sub && <span className="block pt-[0.3em] text-[0.48em] font-bold normal-case opacity-85">{b.sub}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const FONT = '"Trebuchet MS","Segoe UI",system-ui,sans-serif';

const CSS = `
.pad-btn{position:absolute;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;
  font-weight:900;text-transform:uppercase;letter-spacing:.03em;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.45);
  border:.8vmin solid #fff;touch-action:none;-webkit-user-select:none;user-select:none;transition:transform .06s,filter .06s;overflow:hidden}
.pad-btn[data-down="1"]{transform:translateY(.8vmin) scale(.94);filter:brightness(1.3);box-shadow:0 .4vmin 0 rgba(0,0,0,.35)!important}
.pad-btn-s{min-width:44px;height:40px;padding:0 10px;border-radius:12px;border:2px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);
  color:#fff;font-weight:900;font-size:16px;display:flex;align-items:center;justify-content:center;touch-action:none}
.pad-btn-s[data-down="1"]{background:rgba(255,255,255,.3)}
.pad-joy{position:absolute;left:28%;top:62%;width:30vmin;height:30vmin;transform:translate(-50%,-50%);border-radius:50%;
  border:.7vmin solid rgba(255,255,255,.35);background:radial-gradient(circle,rgba(255,255,255,.04),rgba(255,255,255,.12));opacity:.5;transition:opacity .1s}
.pad-joy[data-on="1"]{opacity:1;border-color:var(--c)}
.pad-joy-knob{position:absolute;left:50%;top:50%;width:14vmin;height:14vmin;transform:translate(-50%,-50%);border-radius:50%;
  border:.7vmin solid var(--c);background:radial-gradient(circle at 35% 30%,#ffffffcc,var(--c));box-shadow:0 0 3vmin var(--c)}
.pad-joy-arrow{position:absolute;inset:0;opacity:0;pointer-events:none}
.pad-joy-arrow::after{content:"";position:absolute;right:-3.4vmin;top:50%;transform:translateY(-50%);border-left:3vmin solid var(--c);
  border-top:2.2vmin solid transparent;border-bottom:2.2vmin solid transparent}
`;
