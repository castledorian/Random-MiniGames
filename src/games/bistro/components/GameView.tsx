import { useEffect, useRef, useState } from 'react';
import { H, W } from '../game/config';
import type { Game } from '../game/engine';
import TouchControls from './TouchControls';

export type Screen = 'menu' | 'lobby' | 'playing' | 'paused' | 'over';

interface Props {
  game: Game;
  screen: Screen;
  touch: boolean;
  onPause: () => void;
  onPadStart: () => void;
}

export default function GameView({ game, screen, touch, onPause, onPadStart }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenRef = useRef(screen);
  const padRef = useRef(onPadStart);
  const [box, setBox] = useState({ w: W, h: H, portrait: false });

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);
  useEffect(() => {
    padRef.current = onPadStart;
  }, [onPadStart]);

  // ---- layout: fit the 832x672 logical canvas to the viewport ----
  useEffect(() => {
    const canvas = canvasRef.current!;
    const layout = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const portrait = vh > vw * 1.05;
      let cssW: number;
      let cssH: number;
      if (portrait) {
        cssW = vw;
        cssH = (vw * H) / W;
      } else {
        const s = Math.min(vw / W, vh / H);
        cssW = Math.floor(W * s);
        cssH = Math.floor(H * s);
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.round(cssW * dpr);
      const ph = Math.round((cssW * dpr * H) / W);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
        game.resize(pw / W);
      }
      setBox({ w: cssW, h: cssH, portrait });
    };
    layout();
    window.addEventListener('resize', layout);
    window.addEventListener('orientationchange', layout);
    return () => {
      window.removeEventListener('resize', layout);
      window.removeEventListener('orientationchange', layout);
    };
  }, [game]);

  // ---- main loop ----
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.1) dt = 0.1;
      const sc = screenRef.current;
      if (game.controls.padStart() || takePhonePause(game)) padRef.current();
      if (sc === 'playing' || sc === 'over') game.update(dt);
      else if (sc === 'menu' || sc === 'lobby') game.updateIdle(dt);
      game.render(ctx);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [game]);

  const showControls = touch && screen === 'playing' && !game.coop;
  const pauseStyle: React.CSSProperties = box.portrait
    ? { top: box.h + 10, right: 12 }
    : { top: 'max(8px, env(safe-area-inset-top))', right: 'max(8px, env(safe-area-inset-right))' };

  return (
    <div className="backdrop fixed inset-0 overflow-hidden" style={{ touchAction: 'none' }}>
      <div
        className="absolute left-1/2"
        style={{
          width: box.w,
          height: box.h,
          top: box.portrait ? 'max(0px, env(safe-area-inset-top))' : '50%',
          transform: box.portrait ? 'translateX(-50%)' : 'translate(-50%, -50%)',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: box.w,
            height: box.h,
            borderRadius: box.portrait ? 0 : 14,
            boxShadow: box.portrait ? 'none' : '0 12px 40px rgba(0,0,0,.55)',
          }}
        />
      </div>

      {screen === 'playing' && (
        <button
          className="pause-btn"
          style={pauseStyle}
          aria-label="Pause"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.currentTarget.blur();
            onPause();
          }}
        >
          <i />
          <i />
        </button>
      )}

      {showControls && <TouchControls controls={game.controls} showSwap={!game.coop} />}
    </div>
  );
}

/** Bouton pause d'un téléphone : agit comme Start sur une manette. */
function takePhonePause(game: Game): boolean {
  if (!game.controls.phonePause) return false;
  game.controls.phonePause = false;
  return true;
}
