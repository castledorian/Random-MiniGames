import { useEffect, useRef, type ReactNode } from "react";
import type { Game } from "../game/game";
import type { Action } from "../game/input";

interface BtnProps {
  game: Game;
  action: Action;
  size: string;
  color: string;
  className?: string;
  pos?: React.CSSProperties;
  children: ReactNode;
  refCb?: (el: HTMLButtonElement | null) => void;
  label?: string;
}

function ActionButton({ game, action, size, color, className = "", pos, children, refCb, label }: BtnProps) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    game.input.press(action);
    game.input.usedTouch = true;
    ref.current?.setAttribute("data-down", "1");
    if (navigator.vibrate) navigator.vibrate(6);
  };
  const up = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    game.input.release(action);
    ref.current?.removeAttribute("data-down");
  };
  return (
    <button
      ref={(el) => {
        ref.current = el;
        refCb?.(el);
      }}
      aria-label={label ?? action}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
      className={`pointer-events-auto absolute flex select-none items-center justify-center rounded-full border-[3px] bg-[#0b0618]/70 font-title text-white transition-transform duration-75 [touch-action:none] data-[down]:scale-90 data-[down]:bg-white/25 ${className}`}
      style={{ width: size, height: size, borderColor: color, boxShadow: `0 0 18px ${color}55, inset 0 0 14px ${color}33`, ...pos }}
    >
      {children}
    </button>
  );
}

const Icon = {
  jump: (c: string) => (
    <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke={c} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 15l7-8 7 8" />
      <path d="M5 21l7-8 7 8" opacity=".55" />
    </svg>
  ),
  slash: (c: string) => (
    <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round">
      <path d="M5 20L19 4" />
      <path d="M9 21c5-2 10-7 12-13" opacity=".5" />
    </svg>
  ),
  throwI: (c: string) => (
    <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill={c} stroke="none">
      <path d="M22 12L9 7l2 5-2 5z" />
      <rect x="1" y="11" width="6" height="2" rx="1" opacity=".5" />
    </svg>
  ),
  ability: (c: string) => (
    <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill={c} stroke="none">
      <path d="M13 2L4 14h6l-1 8 9-12h-6z" />
    </svg>
  ),
};

export function TouchControls({ game, color }: { game: Game; color: string }) {
  const padRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const abilRef = useRef<HTMLButtonElement | null>(null);
  const ammoRef = useRef<HTMLSpanElement>(null);
  const activePad = useRef<number | null>(null);

  // poll the HUD for cooldown / ammo (no React re-render)
  useEffect(() => {
    let raf = 0;
    let lastAmmo = -1;
    let lastPct = -1;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const h = game.hud;
      const pct = Math.round(h.abilPct * 100);
      if (pct !== lastPct && abilRef.current) {
        lastPct = pct;
        abilRef.current.style.setProperty("--p", `${pct}%`);
        abilRef.current.style.opacity = pct >= 100 ? "1" : "0.75";
      }
      if (h.ammo !== lastAmmo && ammoRef.current) {
        lastAmmo = h.ammo;
        ammoRef.current.textContent = String(h.ammo);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game]);

  const setDir = (l: boolean, r: boolean, d: boolean) => {
    const inp = game.input;
    if (l) inp.press("left");
    else inp.release("left");
    if (r) inp.press("right");
    else inp.release("right");
    if (d) inp.press("down");
    else inp.release("down");
  };

  const handlePad = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const R = rect.width / 2;
    let dx = (e.clientX - cx) / R;
    let dy = (e.clientY - cy) / R;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx * R * 0.55}px, ${dy * R * 0.55}px)`;
    setDir(dx < -0.22, dx > 0.22, dy > 0.6 && Math.abs(dx) < 0.85);
  };

  const padDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    activePad.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    game.input.usedTouch = true;
    handlePad(e);
  };
  const padMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePad.current !== e.pointerId) return;
    handlePad(e);
  };
  const padUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePad.current !== e.pointerId) return;
    activePad.current = null;
    setDir(false, false, false);
    if (knobRef.current) knobRef.current.style.transform = "translate(0,0)";
  };

  const B = "clamp(58px, 15.5vmin, 96px)";
  const gap = "clamp(6px, 1.6vmin, 14px)";
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none [touch-action:none]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* pad */}
      <div
        ref={padRef}
        onPointerDown={padDown}
        onPointerMove={padMove}
        onPointerUp={padUp}
        onPointerCancel={padUp}
        className="pointer-events-auto absolute rounded-full border-[3px] bg-[#0b0618]/55 [touch-action:none]"
        style={{
          left: "clamp(10px, 3vmin, 28px)",
          bottom: "clamp(12px, 4vmin, 34px)",
          width: `calc(${B} * 2.35)`,
          height: `calc(${B} * 2.35)`,
          borderColor: `${color}aa`,
          boxShadow: `0 0 20px ${color}33, inset 0 0 22px ${color}22`,
        }}
      >
        <div className="absolute left-2 top-1/2 -translate-y-1/2 font-title text-lg text-white/30">◀</div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 font-title text-lg text-white/30">▶</div>
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 font-title text-sm text-white/30">▼</div>
        <div
          ref={knobRef}
          className="absolute left-1/2 top-1/2 -ml-[22%] -mt-[22%] h-[44%] w-[44%] rounded-full border-[3px] transition-transform duration-75"
          style={{ borderColor: color, background: `radial-gradient(circle at 35% 30%, ${color}aa, ${color}33)`, boxShadow: `0 0 16px ${color}77` }}
        />
      </div>

      {/* buttons */}
      <div
        className="absolute"
        style={{
          right: "clamp(10px, 3vmin, 28px)",
          bottom: "clamp(12px, 4vmin, 34px)",
          width: `calc(${B} * 2.6 + ${gap} * 2)`,
          height: `calc(${B} * 2.6 + ${gap} * 2)`,
        }}
      >
        <ActionButton game={game} action="jump" size={`calc(${B} * 1.2)`} color="#ffffff" pos={{ right: 0, bottom: 0 }} label="jump">
          {Icon.jump("#fff")}
        </ActionButton>
        <ActionButton game={game} action="attack" size={`calc(${B} * 1.05)`} color={color} pos={{ left: 0, bottom: `calc(${B} * 0.08)` }} label="slash">
          {Icon.slash(color)}
        </ActionButton>
        <ActionButton game={game} action="throw" size={`calc(${B} * 0.95)`} color="#ffe14a" pos={{ left: `calc(${B} * 0.62)`, top: 0 }} label="throw">
          {Icon.throwI("#ffe14a")}
          <span ref={ammoRef} className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ffe14a] px-1 font-ui text-[11px] font-bold text-black">
            2
          </span>
        </ActionButton>
        <ActionButton
          game={game}
          action="ability"
          size={`calc(${B} * 0.95)`}
          color={color}
          className="overflow-hidden"
          pos={{ right: 0, top: `calc(${B} * 0.1)` }}
          refCb={(el) => (abilRef.current = el)}
          label="ability"
        >
          <span className="absolute inset-x-0 bottom-0 bg-white/20" style={{ height: "var(--p, 100%)" }} />
          <span className="relative flex h-full w-full items-center justify-center">{Icon.ability(color)}</span>
        </ActionButton>
      </div>
    </div>
  );
}
