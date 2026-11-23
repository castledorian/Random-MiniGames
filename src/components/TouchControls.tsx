import { useEffect, useRef } from "react";
import type { InputManager } from "@/game/input";

const R = 54;

export default function TouchControls({
  input,
  getSkill,
}: {
  input: InputManager;
  getSkill: () => { name: string; color: string; remaining: number } | null;
}) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const skillRef = useRef<HTMLDivElement>(null);
  const skillLabel = useRef<HTMLSpanElement>(null);
  const joy = useRef<{ id: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      const s = getSkill();
      const el = skillRef.current;
      if (!s || !el) return;
      el.style.setProperty("--cd", String(Math.max(0, Math.min(1, s.remaining))));
      el.style.borderColor = s.remaining <= 0 ? s.color : "rgba(255,255,255,0.35)";
      el.style.boxShadow = s.remaining <= 0 ? `0 0 22px ${s.color}, 0 6px 18px rgba(0,0,0,.45)` : "0 6px 18px rgba(0,0,0,.45)";
      if (skillLabel.current) {
        skillLabel.current.textContent = s.name;
        skillLabel.current.style.fontSize = s.name.length > 11 ? "8.5px" : s.name.length > 8 ? "9.5px" : "11px";
      }
    }, 90);
    return () => window.clearInterval(id);
  }, [getSkill]);

  const place = (x: number, y: number) => {
    const b = baseRef.current;
    if (b) b.style.transform = `translate(${x - 64}px, ${y - 64}px)`;
  };

  const resetJoy = () => {
    joy.current = null;
    input.touch.dx = 0;
    input.touch.dy = 0;
    if (knobRef.current) knobRef.current.style.transform = "translate(0px,0px)";
    if (baseRef.current) {
      baseRef.current.style.opacity = "0.4";
      baseRef.current.style.transform = "";
      baseRef.current.style.left = "";
      baseRef.current.style.top = "";
      baseRef.current.style.bottom = "";
    }
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joy.current) return;
    const zone = zoneRef.current;
    if (!zone) return;
    zone.setPointerCapture(e.pointerId);
    const r = zone.getBoundingClientRect();
    const ox = e.clientX - r.left;
    const oy = e.clientY - r.top;
    joy.current = { id: e.pointerId, ox, oy };
    if (baseRef.current) {
      baseRef.current.style.opacity = "0.85";
      baseRef.current.style.left = "0px";
      baseRef.current.style.top = "0px";
      baseRef.current.style.bottom = "auto";
    }
    place(ox, oy);
    if (knobRef.current) knobRef.current.style.transform = "translate(0px,0px)";
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const j = joy.current;
    const zone = zoneRef.current;
    if (!j || j.id !== e.pointerId || !zone) return;
    const r = zone.getBoundingClientRect();
    let vx = e.clientX - r.left - j.ox;
    let vy = e.clientY - r.top - j.oy;
    const d = Math.hypot(vx, vy);
    if (d > R * 1.5) {
      const k = (d - R * 1.5) / d;
      j.ox += vx * k;
      j.oy += vy * k;
      vx = e.clientX - r.left - j.ox;
      vy = e.clientY - r.top - j.oy;
      place(j.ox, j.oy);
    }
    const dd = Math.hypot(vx, vy);
    const cl = dd > R ? R / dd : 1;
    const kx = vx * cl;
    const ky = vy * cl;
    if (knobRef.current) knobRef.current.style.transform = `translate(${kx}px, ${ky}px)`;
    if (dd < 12) {
      input.touch.dx = 0;
      input.touch.dy = 0;
    } else {
      input.touch.dx = kx / R;
      input.touch.dy = ky / R;
    }
  };

  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joy.current && joy.current.id === e.pointerId) resetJoy();
  };

  const press = (kind: "bomb" | "skill") => (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.classList.add("down");
    if (kind === "bomb") {
      input.touch.bomb = true;
      input.touch.bombEdge = true;
    } else {
      input.touch.skill = true;
      input.touch.skillEdge = true;
    }
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
  };
  const release = (kind: "bomb" | "skill") => (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove("down");
    if (kind === "bomb") input.touch.bomb = false;
    else input.touch.skill = false;
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-10" onContextMenu={(e) => e.preventDefault()}>
      <div
        ref={zoneRef}
        className="pointer-events-auto absolute bottom-0 left-0 w-[48%]"
        style={{ height: "min(62%, 340px)", touchAction: "none" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div
          ref={baseRef}
          className="absolute left-5 bottom-6 h-32 w-32 rounded-full border-4 border-white/50 bg-white/10 transition-opacity"
          style={{ opacity: 0.4 }}
        >
          <div
            ref={knobRef}
            className="absolute left-1/2 top-1/2 -ml-8 -mt-8 h-16 w-16 rounded-full border-4 border-white/70"
            style={{ background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,.7), rgba(255,255,255,.18))" }}
          />
        </div>
      </div>

      <div
        className="touch-btn pointer-events-auto"
        style={{ right: 20, bottom: 26, width: 100, height: 100, fontSize: 18, background: "radial-gradient(circle at 35% 30%, #ff9a6b, #e8412a)", borderColor: "#ffd9c9" }}
        onPointerDown={press("bomb")}
        onPointerUp={release("bomb")}
        onPointerCancel={release("bomb")}
      >
        Bombe
      </div>
      <div
        ref={skillRef}
        className="touch-btn pointer-events-auto"
        style={{
          right: 112,
          bottom: 124,
          width: 88,
          height: 88,
          fontSize: 11,
          textAlign: "center",
          lineHeight: 1.1,
          letterSpacing: 0,
          padding: 4,
          backgroundImage: "conic-gradient(rgba(5,8,25,0.72) calc(var(--cd, 0) * 1turn), transparent 0), radial-gradient(circle at 35% 30%, #8ff1ff, #1f9bc0)",
        }}
        onPointerDown={press("skill")}
        onPointerUp={release("skill")}
        onPointerCancel={release("skill")}
      >
        <span ref={skillLabel}>Skill</span>
      </div>
    </div>
  );
}
