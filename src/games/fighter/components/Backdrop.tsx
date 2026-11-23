import { useEffect, useRef } from "react";

/** Lightweight animated cosmic backdrop for menus (stars, rotating rift rings, speed streaks). */
export default function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    let w = 0;
    let h = 0;
    let raf = 0;
    const stars = Array.from({ length: 130 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 1.8 + 0.4, p: Math.random() * 6 }));
    const streaks = Array.from({ length: 8 }, () => ({ x: Math.random(), y: Math.random(), l: 80 + Math.random() * 160, v: 0.05 + Math.random() * 0.09 }));

    const resize = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const t = now / 1000;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h * 0.36;
      // rings
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = i === 1 ? "rgba(255,62,165,0.16)" : "rgba(34,230,255,0.14)";
        ctx.setLineDash([40 + i * 18, 60 + i * 20]);
        ctx.lineDashOffset = -t * (22 + i * 12) * (i % 2 ? -1 : 1);
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(w, h) * (0.32 + i * 0.16), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // stars
      ctx.fillStyle = "#d9d2ff";
      for (const s of stars) {
        ctx.globalAlpha = 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.6 + s.p));
        ctx.fillRect(s.x * w, s.y * h, s.s, s.s);
      }
      // streaks
      ctx.lineCap = "round";
      for (const s of streaks) {
        s.x += s.v * 0.004;
        s.y += s.v * 0.0016;
        if (s.x > 1.2 || s.y > 1.2) {
          s.x = -0.2;
          s.y = Math.random() * 0.8;
        }
        const x = s.x * w;
        const y = s.y * h;
        const g = ctx.createLinearGradient(x, y, x - s.l, y - s.l * 0.4);
        g.addColorStop(0, "rgba(34,230,255,0.35)");
        g.addColorStop(1, "rgba(34,230,255,0)");
        ctx.globalAlpha = 1;
        ctx.strokeStyle = g;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - s.l, y - s.l * 0.4);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 28%, rgba(255,62,165,0.38), transparent 55%), radial-gradient(ellipse at 15% 85%, rgba(34,230,255,0.18), transparent 50%), radial-gradient(ellipse at 90% 70%, rgba(130,60,255,0.25), transparent 50%), linear-gradient(180deg,#0a0620 0%,#1b0b45 55%,#3a1060 100%)",
        }}
      />
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      <div
        className="absolute inset-x-0 bottom-0 h-1/3"
        style={{ background: "linear-gradient(180deg, transparent, rgba(255,62,165,0.18))" }}
      />
    </div>
  );
}
