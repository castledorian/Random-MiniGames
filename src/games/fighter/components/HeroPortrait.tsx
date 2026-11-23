import { useEffect, useRef } from "react";
import { Fighter } from "../game/fighter";
import { drawFighter } from "../game/render";
import { ATK, type HeroDef } from "../game/constants";

interface Props {
  hero: HeroDef;
  active?: boolean;
  className?: string;
}

/** Animated canvas portrait that reuses the in-game fighter renderer. */
export default function HeroPortrait({ hero, active = false, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const f = new Fighter(hero, { team: 0, stocks: 1 });
    f.onGround = true;
    f.facing = 1;
    let raf = 0;
    let last = performance.now();
    let cycle = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = 160;
    const H = 190;
    cv.width = W * dpr;
    cv.height = H * dpr;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // pedestal glow
      const g = ctx.createRadialGradient(W / 2, H - 26, 4, W / 2, H - 26, 70);
      g.addColorStop(0, hero.color + "88");
      g.addColorStop(1, hero.color + "00");
      ctx.fillStyle = g;
      ctx.fillRect(0, H - 100, W, 100);

      const on = activeRef.current;
      if (on) cycle += dt;
      else cycle = 0;
      f.attack = null;
      f.vx = 0;
      f.flash = 0;
      if (on) {
        const c = cycle % 3.2;
        if (c < 1.3) {
          f.vx = 340;
          f.runPhase += dt * 11;
        } else if (c < 1.3 + 0.38) {
          const a = c - 1.3;
          f.attack = { def: ATK.jab3, t: a * 0.5, hit: new Set(), fired: true, spd: 1 };
          f.facing = 1;
        } else if (c > 2.4 && c < 2.9 && hero.special.id === "shield") {
          f.shieldT = 1;
        }
      }
      if (hero.special.id !== "shield" || !(cycle % 3.2 > 2.4 && cycle % 3.2 < 2.9)) f.shieldT = 0;

      const s = 1.55;
      ctx.save();
      ctx.translate(W / 2, H - 34);
      ctx.scale(s, s);
      f.x = 0;
      f.y = -f.h / 2;
      f.onGround = true;
      f.squash = 0;
      drawFighter(ctx, f, t, false);
      ctx.restore();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hero]);

  return <canvas ref={ref} className={className} style={{ width: "100%", aspectRatio: "160 / 190" }} />;
}
