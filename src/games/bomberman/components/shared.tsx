import { useEffect, useRef } from "react";
import type { AudioFX } from "@/game/audio";
import type { InputManager } from "@/game/input";
import type { PadHost, PadInfo } from "@/game/padClient";
import type { HostState } from "@party/host";
import type { Profile } from "@/game/storage";
import type { Hero } from "@/game/heroes";
import { drawHero } from "@/game/render";

export interface AppCtx {
  input: InputManager;
  audio: AudioFX;
  padHost: PadHost;
  room: string;
  /** État de la connexion au service de mise en relation des manettes. */
  linkState: HostState;
  profile: Profile;
  updateProfile: (p: Partial<Profile>) => void;
  pads: PadInfo[];
  statusRef: { current: ((dev: string) => Record<string, unknown> | null) | null };
  toast: (msg: string) => void;
  openPair: () => void;
}

export function HeroCanvas({
  hero,
  size = 96,
  facing = 2,
  walking = false,
  locked = false,
  className = "",
}: {
  hero: Hero;
  size?: number;
  facing?: number;
  walking?: boolean;
  locked?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const box = Math.round(size * 1.5);
    cv.width = box * dpr;
    cv.height = box * dpr;
    const c = cv.getContext("2d");
    if (!c) return;
    let raf = 0;
    let alive = true;
    const t0 = performance.now() + Math.random() * 3000;
    const loop = () => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      const t = (performance.now() - t0) / 1000;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, box, box);
      drawHero(c, hero, box / 2, box / 2 + size * 0.12, size, { facing, walkT: t * 4, moving: walking, t });
    };
    loop();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [hero, size, facing, walking]);

  const box = Math.round(size * 1.5);
  return (
    <canvas
      ref={ref}
      className={className}
      style={{ width: box, height: box, filter: locked ? "brightness(0) opacity(0.55)" : undefined }}
      aria-label={hero.name}
    />
  );
}

export function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--muted)]">
      <span className="w-14 uppercase tracking-wider">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/40">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

export function HeroStats({ hero }: { hero: Hero }) {
  return (
    <div className="grid gap-1">
      <StatBar label="Bombes" value={hero.stats.bombs} max={3} color={hero.color} />
      <StatBar label="Portée" value={hero.stats.range} max={4} color={hero.color} />
      <StatBar label="Vitesse" value={hero.stats.speed - 3} max={3} color={hero.color} />
    </div>
  );
}
