import { useCallback, useEffect, useRef, useState } from "react";
import PairDialog from "@party/PairDialog";
import type { HostState } from "@party/host";
import { audio } from "./game/audio";
import { Game, SLOT_COLORS, type CoopPlayer } from "./game/game";
import { party } from "./game/partyInput";
import { link, startPads } from "./padLink";
import { CoopLobby } from "./ui/CoopLobby";
import { HEROES, heroById, type HeroDef, type HeroId } from "./game/heroes";
import { addScore, loadSave, writeSave, type Save } from "./game/storage";
import type { Phase } from "./game/types";
import { Menu, isUnlocked } from "./ui/Menu";
import { GameOverOverlay, HelpPanel, PauseOverlay, ScoresPanel, type EndSummary } from "./ui/Panels";
import { TouchControls } from "./ui/TouchControls";
import type { Lang } from "./ui/i18n";

interface Stage {
  left: number;
  top: number;
  w: number;
  h: number;
  portrait: boolean;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);

  const [save, setSave] = useState<Save>(() => loadSave());
  const saveRef = useRef(save);
  const [phase, setPhase] = useState<Phase>("menu");
  const phaseRef = useRef<Phase>("menu");
  const [overlay, setOverlay] = useState<"scores" | "help" | null>(null);
  const overlayRef = useRef<"scores" | "help" | null>(null);
  const [summary, setSummary] = useState<EndSummary | null>(null);
  const overAt = useRef(0);
  const runUnlocks = useRef<HeroDef[]>([]);
  const [game, setGame] = useState<Game | null>(null);
  const [touch, setTouch] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches);
  const touchRef = useRef(touch);
  const [stage, setStage] = useState<Stage>({ left: 0, top: 0, w: 640, h: 360, portrait: false });
  // ---- partie en équipe (co-op locale)
  const [lobby, setLobby] = useState(false);
  const lobbyRef = useRef(false);
  const lastCoop = useRef<CoopPlayer[] | null>(null);
  const [pairOpen, setPairOpen] = useState(false);
  const [room, setRoom] = useState("----");
  const [linkState, setLinkState] = useState<HostState>("connecting");
  const [pads, setPads] = useState<{ pid: string; name: string }[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const openLobby = useCallback((v: boolean) => {
    lobbyRef.current = v;
    setLobby(v);
  }, []);

  const updateSave = useCallback((fn: (s: Save) => Save) => {
    const n = fn(saveRef.current);
    saveRef.current = n;
    setSave(n);
    writeSave(n);
  }, []);

  const setOverlayBoth = useCallback((o: "scores" | "help" | null) => {
    overlayRef.current = o;
    setOverlay(o);
  }, []);

  // ---------------------------------------------------------------- engine
  useEffect(() => {
    const canvas = canvasRef.current!;
    audio.muted = saveRef.current.muted;
    const g = new Game(canvas, {
      onPhase: (p) => {
        phaseRef.current = p;
        setPhase(p);
        if (p === "over") overAt.current = performance.now();
      },
      onOver: (s) => {
        if (s.coop) {
          setSummary({ ...s, rank: 0, id: -1, newUnlocks: [] });
          return;
        }
        const cur = saveRef.current;
        const res = addScore(cur, { name: cur.name.trim() || "PILOT", score: s.score, room: s.room, hero: s.hero });
        saveRef.current = res.save;
        setSave(res.save);
        setSummary({ ...s, rank: res.rank, id: res.id, newUnlocks: runUnlocks.current });
      },
      onBest: (cleared, unlocked) => {
        if (unlocked) runUnlocks.current = [...runUnlocks.current, unlocked];
        updateSave((s) => ({ ...s, bestRoom: Math.max(s.bestRoom, cleared) }));
      },
    });
    g.bestCleared = saveRef.current.bestRoom;
    g.heroId = saveRef.current.hero;
    g.touchMode = touchRef.current;
    g.loadMenuScene();
    gameRef.current = g;
    if (/[?&]debug\b/.test(location.search)) (window as unknown as { __onehit?: Game }).__onehit = g;
    setGame(g);
    g.start();
    void document.fonts?.load('20px "Bungee"');
    void document.fonts?.load('700 14px "Chakra Petch"');
    return () => {
      g.destroy();
      gameRef.current = null;
    };
  }, [updateSave]);

  // ---------------------------------------------------------------- layout
  useEffect(() => {
    const el = boxRef.current!;
    const layout = () => {
      const aw = el.clientWidth;
      const ah = el.clientHeight;
      const portrait = ah > aw;
      const w = Math.max(160, Math.min(aw, (ah * 16) / 9));
      const h = (w * 9) / 16;
      const left = (aw - w) / 2;
      // portrait: centre the arena in the space left above the touch controls
      const B = Math.max(58, Math.min(96, 0.155 * Math.min(aw, ah)));
      const ctrl = B * 2.6 + 48;
      const top = portrait ? Math.max(10, (ah - h - ctrl) / 2) : (ah - h) / 2;
      setStage({ left, top, w, h, portrait });
      gameRef.current?.resize(w, h);
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(el);
    window.addEventListener("orientationchange", layout);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", layout);
    };
  }, [game]);

  useEffect(() => {
    document.documentElement.lang = save.lang;
  }, [save.lang]);

  // ---------------------------------------------------------------- actions
  const startRun = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    audio.init();
    audio.startMusic();
    if (g.isCoop && lastCoop.current) {
      // revanche en équipe : mêmes joueurs, mêmes héros
      setSummary(null);
      setOverlayBoth(null);
      g.startCoop(lastCoop.current);
      return;
    }
    const s = saveRef.current;
    const h = HEROES.find((x) => x.id === s.hero && isUnlocked(x, s.bestRoom)) ?? HEROES[0];
    runUnlocks.current = [];
    setSummary(null);
    setOverlayBoth(null);
    g.touchMode = touchRef.current;
    g.bestCleared = s.bestRoom;
    g.startRun(h.id);
  }, [setOverlayBoth]);

  const toMenu = useCallback(() => {
    const wasCoop = !!gameRef.current?.isCoop;
    setSummary(null);
    setOverlayBoth(null);
    gameRef.current?.toMenu();
    audio.play("ui");
    if (wasCoop) openLobby(true);
  }, [setOverlayBoth, openLobby]);

  const startCoop = useCallback(
    (list: CoopPlayer[]) => {
      const g = gameRef.current;
      if (!g) return;
      lastCoop.current = list;
      openLobby(false);
      setSummary(null);
      setOverlayBoth(null);
      g.touchMode = false;
      g.startCoop(list);
    },
    [openLobby, setOverlayBoth],
  );

  // ---------------------------------------------------------------- téléphones manettes
  useEffect(() => {
    let tm = 0;
    const stop = startPads({
      onRoom: setRoom,
      onState: setLinkState,
      onPads: (list, fresh) => {
        setPads(list);
        if (fresh) {
          setToast(`📱 ${fresh} est connecté`);
          window.clearTimeout(tm);
          tm = window.setTimeout(() => setToast(null), 2600);
        }
      },
    });
    return () => {
      window.clearTimeout(tm);
      stop();
    };
  }, []);

  // clavier « soirée » actif pendant une partie en équipe
  const coopOn = !!game?.isCoop && phase !== "menu";
  useEffect(() => {
    if (!coopOn) return;
    party.attach();
    return () => party.detach();
  }, [coopOn]);

  // ce que voient les téléphones (hors salon)
  useEffect(() => {
    if (lobby) return;
    link.status = (pid) => {
      const g = gameRef.current;
      if (!g || !g.coop || phaseRef.current === "menu") return { state: "menu" };
      const i = g.coop.findIndex((c) => c.device === "ph:" + pid);
      if (i < 0) return { state: "spectator" };
      const p = g.players[i];
      const ph = phaseRef.current;
      return {
        state: ph === "over" ? "over" : ph === "paused" ? "paused" : "playing",
        hero: p?.hero.name,
        color: SLOT_COLORS[i % 4],
        slot: i,
        alive: !!p?.alive,
        respawn: Math.ceil(g.respawnT[i] ?? 0),
        ammo: p ? Math.floor(p.ammo + 0.001) : 0,
        maxAmmo: p?.hero.maxAmmo ?? 0,
        abil: p ? Math.max(0, Math.min(1, 1 - p.abilCd / p.hero.abilityCd)) : 0,
        lives: g.lives,
      };
    };
    link.onButton = (i) => {
      const ph = phaseRef.current;
      const g = gameRef.current;
      if (!g?.isCoop) return;
      if (ph === "paused" && i === 3) g.resume();
      else if (ph === "over" && i !== 3 && performance.now() - overAt.current > 600) startRun();
    };
    return () => {
      link.onButton = null;
    };
  }, [lobby, startRun]);

  const toggleMute = useCallback(() => {
    const m = !saveRef.current.muted;
    audio.setMuted(m);
    updateSave((s) => ({ ...s, muted: m }));
    if (!m) audio.play("ui");
  }, [updateSave]);

  const pickHero = useCallback(
    (id: HeroId) => {
      audio.init();
      audio.play("ui");
      updateSave((s) => ({ ...s, hero: id }));
      gameRef.current?.setHero(id);
    },
    [updateSave],
  );

  const toggleFullscreen = useCallback(() => {
    const d = document as Document & { webkitFullscreenElement?: Element };
    if (d.fullscreenElement || d.webkitFullscreenElement) void document.exitFullscreen?.();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, []);

  // ---------------------------------------------------------------- keyboard & focus
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      audio.init();
      audio.startMusic();
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (lobbyRef.current) return;
      const k = e.key;
      const ph = phaseRef.current;
      if (k === "m" || k === "M") {
        toggleMute();
        return;
      }
      if (ph === "playing") {
        if (k === "Escape" || k === "p" || k === "P") {
          e.preventDefault();
          g.pause();
          return;
        }
        if (k === "r" || k === "R") {
          e.preventDefault();
          startRun();
          return;
        }
        if (!g.isCoop && g.input.keyDown(e)) e.preventDefault();
      } else if (ph === "paused") {
        if (k === "Escape" || k === "p" || k === "P" || (k === "Enter" && tag !== "BUTTON")) {
          e.preventDefault();
          g.resume();
        } else if (k === "r" || k === "R") startRun();
        else if (k === "q" || k === "Q") toMenu();
      } else if (ph === "over") {
        if (performance.now() - overAt.current < 250) return;
        if ((k === "Enter" && tag !== "BUTTON") || k === "r" || k === "R") {
          e.preventDefault();
          startRun();
        } else if (k === "Escape") toMenu();
      } else {
        if (overlayRef.current) {
          if (k === "Escape") setOverlayBoth(null);
          return;
        }
        const idx = HEROES.findIndex((h) => h.id === saveRef.current.hero);
        if (e.code === "KeyV") {
          e.preventDefault();
          audio.play("ui");
          openLobby(true);
        } else if (k === "Enter" && tag !== "BUTTON") {
          e.preventDefault();
          startRun();
        } else if (k === "ArrowRight") pickHero(HEROES[(idx + 1) % HEROES.length].id);
        else if (k === "ArrowLeft") pickHero(HEROES[(idx + HEROES.length - 1) % HEROES.length].id);
        else if (k >= "1" && k <= "4") pickHero(HEROES[Number(k) - 1].id);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!gameRef.current?.isCoop) gameRef.current?.input.keyUp(e);
    };
    const onHide = () => {
      if (document.hidden && phaseRef.current === "playing") gameRef.current?.pause();
    };
    const onBlur = () => {
      gameRef.current?.input.clear();
      if (phaseRef.current === "playing") gameRef.current?.pause();
    };
    const onPointer = (e: PointerEvent) => {
      audio.init();
      audio.startMusic();
      if (e.pointerType === "touch" && !touchRef.current) {
        touchRef.current = true;
        setTouch(true);
        if (gameRef.current) gameRef.current.touchMode = true;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pointerdown", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [pickHero, setOverlayBoth, startRun, toMenu, toggleMute, openLobby]);

  // ---------------------------------------------------------------- mouse (desktop)
  const setAim = (e: React.PointerEvent) => {
    const g = gameRef.current;
    const c = canvasRef.current;
    if (!g || !c) return;
    const r = c.getBoundingClientRect();
    g.input.aim.x = ((e.clientX - r.left) / r.width) * 960;
    g.input.aim.y = ((e.clientY - r.top) / r.height) * 540;
  };
  const onCanvasDown = (e: React.PointerEvent) => {
    const g = gameRef.current;
    if (!g || e.pointerType !== "mouse" || phaseRef.current !== "playing" || g.isCoop) return;
    setAim(e);
    if (e.button === 0) g.input.press("attack");
    else if (e.button === 2) {
      g.input.aim.mouseThrow = true;
      g.input.press("throw");
    }
  };
  const onCanvasUp = (e: React.PointerEvent) => {
    const g = gameRef.current;
    if (!g || e.pointerType !== "mouse") return;
    if (e.button === 0) g.input.release("attack");
    else if (e.button === 2) g.input.release("throw");
  };

  const lang = save.lang;
  const hero = heroById(save.hero);
  const pauseSize = Math.max(26, Math.min(44, stage.w * 0.05));

  return (
    <div
      ref={boxRef}
      className="fixed inset-0 select-none overflow-hidden bg-[#07030f] font-ui text-white [touch-action:none] [-webkit-touch-callout:none]"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* arena */}
      <div
        className="absolute overflow-hidden rounded-sm shadow-[0_0_0_2px_rgba(255,255,255,0.07),0_0_70px_rgba(255,45,149,0.22)]"
        style={{ left: stage.left, top: stage.top, width: stage.w, height: stage.h }}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full [touch-action:none]"
          onPointerDown={onCanvasDown}
          onPointerUp={onCanvasUp}
          onPointerMove={(e) => e.pointerType === "mouse" && setAim(e)}
        />
        <div className="crt pointer-events-none absolute inset-0" />
      </div>

      {/* pause button */}
      {phase === "playing" && (
        <button
          tabIndex={-1}
          aria-label="Pause"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            gameRef.current?.pause();
          }}
          className="absolute z-10 flex items-center justify-center rounded border border-white/30 bg-black/50 font-title text-white/80 active:scale-90"
          style={{ left: stage.left + stage.w - pauseSize - 6, top: stage.top + 6, width: pauseSize, height: pauseSize, fontSize: pauseSize * 0.4 }}
        >
          ❚❚
        </button>
      )}

      {/* touch controls */}
      {phase === "playing" && touch && game && !game.isCoop && <TouchControls game={game} color={hero.color} />}

      {/* menu & panels */}
      {phase === "menu" && lobby && <CoopLobby onBack={() => openLobby(false)} onStart={startCoop} onPair={() => setPairOpen(true)} padCount={pads.length} />}
      {phase === "menu" && !lobby && (
        <Menu
          onCoop={() => {
            audio.init();
            audio.play("ui");
            openLobby(true);
          }}
          onPair={() => setPairOpen(true)}
          padCount={pads.length}
          save={save}
          lang={lang}
          hero={save.hero}
          onHero={pickHero}
          onPlay={startRun}
          onScores={() => {
            audio.play("ui");
            setOverlayBoth("scores");
          }}
          onHelp={() => {
            audio.play("ui");
            setOverlayBoth("help");
          }}
          onName={(n) => updateSave((s) => ({ ...s, name: n }))}
          onLang={(l: Lang) => updateSave((s) => ({ ...s, lang: l }))}
          onMute={toggleMute}
          onFullscreen={toggleFullscreen}
          canFullscreen={typeof document !== "undefined" && !!document.documentElement.requestFullscreen}
          portrait={stage.portrait}
        />
      )}
      {overlay === "scores" && <ScoresPanel save={save} lang={lang} onClose={() => setOverlayBoth(null)} />}
      {overlay === "help" && <HelpPanel lang={lang} onClose={() => setOverlayBoth(null)} />}

      {phase === "paused" && (
        <PauseOverlay
          lang={lang}
          muted={save.muted}
          onResume={() => gameRef.current?.resume()}
          onRestart={startRun}
          onMenu={toMenu}
          onMute={toggleMute}
        />
      )}
      {pairOpen && (
        <PairDialog
          room={room}
          linkState={linkState}
          pads={pads}
          accent="#ff2d95"
          hint="Chaque téléphone devient une manette : il rejoint le salon EN ÉQUIPE avec le bouton FRAPPE."
          onClose={() => setPairOpen(false)}
        />
      )}
      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-3 z-[60] -translate-x-1/2 rounded bg-[#12062b] px-4 py-2 font-ui text-sm font-bold text-white shadow-lg ring-1 ring-white/20">
          {toast}
        </div>
      )}
      {phase === "over" && summary && (
        <GameOverOverlay
          lang={lang}
          summary={summary}
          save={save}
          onRetry={startRun}
          onMenu={toMenu}
          onScores={() => setOverlayBoth("scores")}
        />
      )}
    </div>
  );
}
