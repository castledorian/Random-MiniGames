import { useEffect, useRef } from 'react';
import type { Controls, Action } from '../game/input';

interface Props {
  controls: Controls;
  showSwap: boolean;
}

const S = 'var(--s)';

function TBtn({
  controls,
  action,
  label,
  icon,
  style,
  gradient,
  cdRef,
}: {
  controls: Controls;
  action: Action;
  label: string;
  icon: string;
  style: React.CSSProperties;
  gradient: string;
  cdRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    controls.pressTouch(action);
    ref.current?.classList.add('pressed');
    if (navigator.vibrate) navigator.vibrate(8);
  };
  const up = () => {
    controls.releaseTouch(action);
    ref.current?.classList.remove('pressed');
  };
  return (
    <div
      ref={ref}
      className="touch-btn"
      style={{ ...style, background: gradient }}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span style={{ fontSize: `calc(${style.width} * 0.34)`, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: `calc(${style.width} * 0.17)`, lineHeight: 1.1, letterSpacing: '0.04em' }}>{label}</span>
      {cdRef && <div ref={cdRef} className="cd" />}
    </div>
  );
}

export default function TouchControls({ controls, showSwap }: Props) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const cdRef = useRef<HTMLDivElement>(null);
  const pid = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });

  const MAX = 58;

  const place = (x: number, y: number, active: boolean) => {
    const b = baseRef.current;
    if (!b) return;
    b.style.transform = `translate(${x - 70}px, ${y - 70}px)`;
    b.style.opacity = active ? '1' : '0.35';
  };

  const rest = () => place(Math.max(26, 0) + 80, window.innerHeight - 130, false);

  const resetStick = () => {
    controls.touch.mx = 0;
    controls.touch.my = 0;
    pid.current = null;
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px,0px)';
    rest();
  };

  const move = (e: React.PointerEvent) => {
    let dx = e.clientX - origin.current.x;
    let dy = e.clientY - origin.current.y;
    const r = Math.hypot(dx, dy);
    if (r > MAX) {
      // floating stick: drag the base along so the thumb never leaves the ring
      const ex = (dx / r) * (r - MAX);
      const ey = (dy / r) * (r - MAX);
      origin.current.x += ex;
      origin.current.y += ey;
      dx -= ex;
      dy -= ey;
      place(origin.current.x, origin.current.y, true);
    }
    const len = Math.min(1, Math.hypot(dx, dy) / MAX);
    const ang = Math.atan2(dy, dx);
    const dz = 0.14;
    const m = len < dz ? 0 : (len - dz) / (1 - dz);
    controls.touch.mx = Math.cos(ang) * m;
    controls.touch.my = Math.sin(ang) * m;
    if (knobRef.current) knobRef.current.style.transform = `translate(${Math.cos(ang) * len * MAX}px, ${Math.sin(ang) * len * MAX}px)`;
  };

  useEffect(() => {
    controls.resetTouch();
    rest();
    window.addEventListener('resize', rest);
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      cdRef.current?.style.setProperty('--cd', String(controls.touch.dashCd));
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', rest);
      controls.resetTouch();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-20"
      style={{ ['--s' as string]: 'clamp(74px, 19vmin, 104px)', touchAction: 'none' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* joystick zone: left half, below the top strip */}
      <div
        ref={zoneRef}
        className="pointer-events-auto absolute bottom-0 left-0 top-[8%] w-[48%]"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => {
          if (pid.current !== null) return;
          e.preventDefault();
          pid.current = e.pointerId;
          try {
            zoneRef.current?.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          controls.touchActive = true;
          origin.current = { x: e.clientX, y: e.clientY };
          place(e.clientX, e.clientY, true);
          move(e);
        }}
        onPointerMove={(e) => {
          if (e.pointerId === pid.current) move(e);
        }}
        onPointerUp={(e) => {
          if (e.pointerId === pid.current) resetStick();
        }}
        onPointerCancel={(e) => {
          if (e.pointerId === pid.current) resetStick();
        }}
        onLostPointerCapture={(e) => {
          if (e.pointerId === pid.current) resetStick();
        }}
      />
      {/* stick visual */}
      <div
        ref={baseRef}
        className="pointer-events-none absolute"
        style={{
          left: 0,
          top: 0,
          width: 140,
          height: 140,
          borderRadius: 9999,
          opacity: 0.35,
          background: 'radial-gradient(circle, rgba(255,255,255,0.14), rgba(255,255,255,0.05))',
          border: '3px solid rgba(255,255,255,0.55)',
        }}
      >
        <div
          ref={knobRef}
          style={{
            position: 'absolute',
            left: 40,
            top: 40,
            width: 60,
            height: 60,
            borderRadius: 9999,
            background: 'radial-gradient(circle at 35% 30%, #fff, #c8d2ff 60%, #8f9cf0)',
            border: '3px solid rgba(16,19,43,0.9)',
            boxShadow: '0 4px 0 rgba(16,19,43,0.85)',
          }}
        />
      </div>

      {/* action buttons (right thumb) */}
      <TBtn
        controls={controls}
        action="grab"
        label="GRAB"
        icon="✋"
        gradient="linear-gradient(#ffe36a, #ff9f1c)"
        style={{ width: S, height: S, right: 'max(16px, env(safe-area-inset-right))', bottom: 'max(18px, env(safe-area-inset-bottom))' }}
      />
      <TBtn
        controls={controls}
        action="work"
        label="CHOP"
        icon="🔪"
        gradient="linear-gradient(#8ef2b8, #1fb875)"
        style={{
          width: `calc(${S} * 0.84)`,
          height: `calc(${S} * 0.84)`,
          right: `calc(max(16px, env(safe-area-inset-right)) + ${S} + 10px)`,
          bottom: 'max(18px, env(safe-area-inset-bottom))',
        }}
      />
      <TBtn
        controls={controls}
        action="dash"
        label="DASH"
        icon="⚡"
        cdRef={cdRef}
        gradient="linear-gradient(#b99bff, #6b3fe0)"
        style={{
          width: `calc(${S} * 0.84)`,
          height: `calc(${S} * 0.84)`,
          right: `calc(max(16px, env(safe-area-inset-right)) + ${S} * 0.08)`,
          bottom: `calc(max(18px, env(safe-area-inset-bottom)) + ${S} + 10px)`,
        }}
      />
      {showSwap && (
        <TBtn
          controls={controls}
          action="swap"
          label="SWAP"
          icon="🔄"
          gradient="linear-gradient(#7fd6ff, #2a8fe0)"
          style={{
            width: `calc(${S} * 0.64)`,
            height: `calc(${S} * 0.64)`,
            right: `calc(max(16px, env(safe-area-inset-right)) + ${S} + 22px + ${S} * 0.2)`,
            bottom: `calc(max(18px, env(safe-area-inset-bottom)) + ${S} * 0.84 + 16px)`,
          }}
        />
      )}
    </div>
  );
}
