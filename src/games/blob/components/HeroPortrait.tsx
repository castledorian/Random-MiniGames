import { useEffect, useRef } from 'react';
import type { Hero } from '../game/constants';
import { drawHeroFace, type Mood } from '../game/render';

interface Props {
  hero: Hero;
  size: number;
  mood?: Mood;
  className?: string;
}

export function HeroPortrait({ hero, size, mood = 'idle', className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(size * dpr);
    cv.height = Math.round(size * dpr);
    let raf = 0;
    const loop = (ts: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      drawHeroFace(ctx, hero, size / 2, size * 0.6, size * 0.3, mood, ts / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hero, size, mood]);

  return <canvas ref={ref} className={className} style={{ width: size, height: size }} />;
}
