import { useCallback, useEffect, useRef, useState } from "react";
import { Game, type GameSummary, type Status } from "../game/game";
import { HEROES, type HeroId, type ModeId, type VersusConfig } from "../game/constants";
import { input } from "../game/input";
import { audio } from "../game/audio";
import { link } from "../padLink";
import { addScore, bestScore, renameScore, type Prefs } from "../storage";
import TouchControls from "./TouchControls";
import { GameOverOverlay, PauseOverlay, VersusOverOverlay } from "./Overlays";
import { Speaker } from "./Icons";

interface Props {
  hero: HeroId;
  mode: ModeId;
  versus?: VersusConfig | null;
  touch: boolean;
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  onExit: () => void;
}

interface OverState {
  summary: GameSummary;
  id: string;
  rank: number;
  at: number;
}

export default function GameView({ hero, mode, versus, touch, prefs, onPrefs, onExit }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const [status, setStatus] = useState<Status>("playing");
  const [over, setOver] = useState<OverState | null>(null);
  const overRef = useRef<OverState | null>(null);
  overRef.current = over;
  const restartRef = useRef<() => void>(() => undefined);

  // ------------------------------------------------------------- game setup
  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const game = new Game(
      canvas,
      versus ? { mode: "versus", hero, touch: false, best: 0, versus } : { mode, hero, touch, best: bestScore(mode) },
      {
        onStatus: (s) => {
          setStatus(s);
          if (s === "playing") setOver(null);
        },
        onOver: (summary) => {
          if (summary.mode === "versus") {
            setOver({ summary, id: "", rank: 0, at: performance.now() });
            return;
          }
          const res = addScore({
            name: prefsRef.current.name || "JOUEUR",
            score: summary.score,
            mode: summary.mode as ModeId,
            hero: summary.hero,
            kos: summary.kos,
            detail: summary.progress,
          });
          setOver({ summary, id: res.id, rank: res.rank, at: performance.now() });
        },
      },
    );
    gameRef.current = game;
    // accès console pour le débogage : window.__rift
    (window as unknown as { __rift?: Game }).__rift = game;
    // Manette téléphone : état affiché sur le téléphone + appui pour rejouer en fin de combat
    // Ce qu'affiche chaque téléphone : son combattant (versus) ou le héros joué (solo).
    link.status = (pid) => {
      const p = game.versus ? game.roster.find((f) => f.device === "ph:" + pid) : game.player;
      if (!p) return { state: game.versus ? "spectator" : game.status };
      return {
        state: game.status,
        hero: p.hero.name,
        color: p.hero.color,
        skill: p.hero.special.name,
        cd: Math.max(0, p.cd),
        cdMax: p.hero.special.cd,
        pct: Math.floor(p.percent),
        stocks: Math.max(0, p.stocks),
        slot: p.slot,
        alive: p.state === "alive",
        out: p.removed,
        charge: p.charge >= 0 ? Math.min(1, p.charge) : -1,
      };
    };
    link.onButton = (i) => {
      const o = overRef.current;
      if (i !== 3 && game.status === "over" && o && performance.now() - o.at > 700) restartRef.current();
    };
    const fit = () => {
      const r = wrap.getBoundingClientRect();
      game.resize(r.width, r.height);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    game.start();
    setStatus("playing");
    setOver(null);
    return () => {
      link.status = () => ({ state: "menu" });
      link.onButton = null;
      ro.disconnect();
      game.destroy();
      gameRef.current = null;
    };
  }, [mode, hero, touch, versus]);

  // --------------------------------------------------------------- actions
  const restart = useCallback(() => {
    audio.init();
    audio.play("start");
    gameRef.current?.restart();
  }, []);

  restartRef.current = restart;

  const toggleMute = useCallback(() => {
    audio.init();
    onPrefs({ ...prefsRef.current, muted: !prefsRef.current.muted });
  }, [onPrefs]);

  // -------------------------------------------------------------- keyboard
  useEffect(() => {
    const isGameKey = (e: KeyboardEvent) =>
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "Tab"].includes(e.code);

    const down = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      const target = e.target as HTMLElement;
      if (target && target.tagName === "INPUT") return;
      if (e.code === "Escape" || e.code === "KeyP") {
        e.preventDefault();
        if (!e.repeat) g.togglePause();
        return;
      }
      if (e.code === "KeyM") {
        if (!e.repeat) toggleMute();
        return;
      }
      if (g.status === "paused" && (e.code === "Enter" || e.code === "KeyR")) {
        e.preventDefault();
        if (!e.repeat) restart();
        return;
      }
      if (g.status === "over") {
        const o = overRef.current;
        if ((e.code === "Enter" || e.code === "KeyR") && !e.repeat && o && performance.now() - o.at > 700) {
          e.preventDefault();
          restart();
        }
        if (isGameKey(e)) e.preventDefault();
        return;
      }
      if (g.status === "playing") {
        if (input.keyDown(e) || isGameKey(e)) e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      input.keyUp(e);
      if (isGameKey(e) && (e.target as HTMLElement)?.tagName !== "INPUT") e.preventDefault();
    };
    const blur = () => {
      input.reset();
      gameRef.current?.pause();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [restart, toggleMute]);

  const getCd = useCallback(() => {
    const p = gameRef.current?.player;
    return p && p.cd > 0 ? p.cd / p.hero.special.cd : 0;
  }, []);

  const blurTarget = (e: React.MouseEvent) => (e.currentTarget as HTMLElement).blur();

  return (
    <div
      className="fixed inset-0 flex touch-none select-none flex-col justify-center overflow-hidden bg-[#07041a] landscape:block"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={wrapRef} className="relative aspect-video w-full landscape:absolute landscape:inset-0 landscape:aspect-auto">
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />

        {/* in-game buttons */}
        <div className="absolute right-2 top-2 z-10 flex gap-1.5 sm:right-3 sm:top-3 sm:gap-2" style={{ paddingTop: "env(safe-area-inset-top)", paddingRight: "env(safe-area-inset-right)" }}>
          <button
            className="icon-btn !h-9 !w-9 sm:!h-11 sm:!w-11"
            aria-label="Son"
            onClick={(e) => {
              blurTarget(e);
              toggleMute();
            }}
          >
            <Speaker on={!prefs.muted} className="h-5 w-5" />
          </button>
          <button
            className="icon-btn !h-9 !w-9 sm:!h-11 sm:!w-11"
            aria-label="Pause"
            onClick={(e) => {
              blurTarget(e);
              gameRef.current?.pause();
            }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          </button>
        </div>
      </div>

      {touch && (
        <div className="relative min-h-0 flex-1 bg-gradient-to-b from-[#0a0620] to-[#1b0b45] landscape:pointer-events-none landscape:absolute landscape:inset-0 landscape:flex-none landscape:bg-none">
          <p className="absolute inset-x-0 top-2 text-center text-[11px] text-white/35 landscape:hidden">Astuce : le mode paysage offre un écran plus grand</p>
          <TouchControls hero={HEROES[hero]} getCd={getCd} />
        </div>
      )}

      {status === "paused" && (
        <PauseOverlay
          muted={prefs.muted}
          onResume={() => gameRef.current?.resume()}
          onRestart={restart}
          onMenu={onExit}
          onToggleMute={toggleMute}
        />
      )}
      {status === "over" && over && over.summary.mode === "versus" && <VersusOverOverlay summary={over.summary} onRestart={restart} onMenu={onExit} />}
      {status === "over" && over && over.summary.mode !== "versus" && (
        <GameOverOverlay
          summary={over.summary}
          entryId={over.id}
          rank={over.rank}
          name={prefs.name}
          onName={(n) => {
            onPrefs({ ...prefsRef.current, name: n });
            renameScore(over.id, n || "JOUEUR");
          }}
          onRestart={restart}
          onMenu={onExit}
        />
      )}
    </div>
  );
}
