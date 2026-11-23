import { useEffect, useRef, useState } from "react";
import { input } from "../game/input";
import type { HeroDef } from "../game/constants";
import { SpecialIcon } from "./Icons";

function buzz(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

function DPad() {
  const ref = useRef<HTMLDivElement>(null);
  const [dir, setDir] = useState({ l: false, r: false, u: false, d: false });

  const apply = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    const dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = dx < -0.26;
    const rr = dx > 0.26;
    const u = dy < -0.32;
    const d = dy > 0.32;
    const t = input.touch;
    if (u && !t.up) {
      input.press("jump");
      buzz(6);
    }
    t.left = l;
    t.right = rr;
    t.up = u;
    t.down = d;
    setDir((p) => (p.l === l && p.r === rr && p.u === u && p.d === d ? p : { l, r: rr, u, d }));
  };

  const release = () => {
    const t = input.touch;
    t.left = t.right = t.up = t.down = false;
    setDir({ l: false, r: false, u: false, d: false });
  };

  const arrow = (on: boolean, rot: number, style: React.CSSProperties) => (
    <svg viewBox="0 0 40 40" className="absolute h-[26%] w-[26%]" style={{ ...style, transform: `${style.transform || ""} rotate(${rot}deg)` }}>
      <path
        d="M8 26 L20 10 L32 26 Z"
        fill={on ? "#22e6ff" : "rgba(255,255,255,0.55)"}
        stroke={on ? "#ffffff" : "rgba(10,5,30,0.7)"}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div
      ref={ref}
      className="pointer-events-auto relative touch-none rounded-full"
      style={{
        width: "clamp(132px, 38vmin, 210px)",
        aspectRatio: "1",
        background: "radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(34,230,255,0.10) 70%, rgba(34,230,255,0.22) 100%)",
        border: "3px solid rgba(255,255,255,0.35)",
        boxShadow: "inset 0 0 24px rgba(34,230,255,0.18), 0 6px 20px rgba(0,0,0,0.35)",
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        apply(e);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) apply(e);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {arrow(dir.u, 0, { left: "37%", top: "6%" })}
      {arrow(dir.d, 180, { left: "37%", bottom: "6%" })}
      {arrow(dir.l, -90, { left: "5%", top: "37%" })}
      {arrow(dir.r, 90, { right: "5%", top: "37%" })}
      <div className="absolute left-1/2 top-1/2 h-[22%] w-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/15 ring-2 ring-white/25" />
    </div>
  );
}

interface BtnProps {
  label: React.ReactNode;
  sub?: string;
  icon?: boolean;
  size: string;
  color: string;
  style?: React.CSSProperties;
  onDown: () => void;
  onUp?: () => void;
  cdRef?: React.Ref<HTMLDivElement>;
}

function ActionButton({ label, sub, icon, size, color, style, onDown, onUp, cdRef }: BtnProps) {
  const [down, setDown] = useState(false);
  const end = () => {
    setDown((d) => {
      if (d) onUp?.();
      return false;
    });
  };
  return (
    <div
      className="touch-btn pointer-events-auto absolute overflow-hidden"
      data-down={down}
      style={{ width: size, height: size, background: `radial-gradient(circle at 35% 30%, ${color}, ${color}bb 60%, ${color}77)`, ...style }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDown(true);
        buzz(8);
        onDown();
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onContextMenu={(e) => e.preventDefault()}
    >
      {cdRef && <div ref={cdRef} className="pointer-events-none absolute inset-0 rounded-full" style={{ background: "conic-gradient(rgba(5,2,20,0.62) calc(var(--cd, 0) * 360deg), transparent 0)" }} />}
      <div className="relative flex flex-col items-center leading-none">
        <span className={icon ? "text-[1.7em]" : "text-[0.95em]"}>{label}</span>
        {sub && <span className="mt-1 text-[0.5em] tracking-wide opacity-90">{sub}</span>}
      </div>
    </div>
  );
}

export default function TouchControls({ hero, getCd }: { hero: HeroDef; getCd: () => number }) {
  const cdRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const el = cdRef.current;
      if (!el) return;
      const v = getCd();
      el.style.setProperty("--cd", v.toFixed(3));
      el.style.opacity = v > 0 ? "1" : "0";
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [getCd]);

  return (
    <div className="pointer-events-none absolute inset-0 touch-none select-none" style={{ ["--u" as string]: "clamp(62px, 19vmin, 98px)" }}>
      <div className="absolute" style={{ left: "max(env(safe-area-inset-left), 14px)", bottom: "max(env(safe-area-inset-bottom), 14px)" }}>
        <DPad />
      </div>
      <div
        className="absolute"
        style={{
          right: "max(env(safe-area-inset-right), 12px)",
          bottom: "max(env(safe-area-inset-bottom), 14px)",
          width: "calc(var(--u) * 2.4)",
          height: "calc(var(--u) * 2.25)",
          fontSize: "calc(var(--u) * 0.26)",
        }}
      >
        <ActionButton
          label="SAUT"
          size="var(--u)"
          color="#ffd23f"
          style={{ left: 0, bottom: 0, color: "#2a0a40", textShadow: "none" }}
          onDown={() => {
            input.touch.jump = true;
            input.press("jump");
          }}
          onUp={() => {
            input.touch.jump = false;
          }}
        />
        <ActionButton label="ATK" size="calc(var(--u) * 1.18)" color="#ff3ea5" style={{ right: 0, bottom: "calc(var(--u) * 0.08)" }} onDown={() => input.press("attack")} />
        <ActionButton
          icon
          label={<SpecialIcon id={hero.special.id} className="h-[1em] w-[1em]" />}
          sub={hero.special.name.toUpperCase()}
          size="calc(var(--u) * 0.98)"
          color="#22b8ff"
          style={{ right: "calc(var(--u) * 0.72)", top: 0 }}
          onDown={() => input.press("special")}
          cdRef={cdRef}
        />
      </div>
    </div>
  );
}
