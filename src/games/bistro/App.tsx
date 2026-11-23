import { useCallback, useEffect, useRef, useState } from 'react';
import GameView, { type Screen } from './components/GameView';
import { GameOver, HowTo, MainMenu, PauseMenu } from './components/Screens';
import { Controls } from './game/input';
import { Game } from './game/engine';
import { audio } from './game/audio';
import { addScore, loadScores, loadSettings, saveSettings, type ScoreEntry, type Settings } from './game/storage';
import type { GameResult } from './game/types';
import type { GameConfig } from './game/engine';
import CoopLobby, { type CoopSetup } from './components/CoopLobby';
import PairDialog from '@party/PairDialog';
import type { HostState } from '@party/host';
import { link, startPads } from './padLink';

const detectTouch = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

export default function App() {
  const [controls] = useState(() => new Controls());
  const [game] = useState(() => new Game(controls));
  // accès console pour le débogage : window.__bistro
  (window as unknown as { __bistro?: Game }).__bistro = game;

  const [screen, setScreen] = useState<Screen>('menu');
  const [howto, setHowto] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [scores, setScores] = useState<ScoreEntry[]>(loadScores);
  const [result, setResult] = useState<GameResult | null>(null);
  const [rank, setRank] = useState(-1);
  const [touch, setTouch] = useState(detectTouch);
  const [portrait, setPortrait] = useState(() => window.innerHeight > window.innerWidth * 1.05);
  // salle « téléphone en manette »
  const [pairOpen, setPairOpen] = useState(false);
  const [room, setRoom] = useState('----');
  const [linkState, setLinkState] = useState<HostState>('connecting');
  const [pads, setPads] = useState<{ pid: string; name: string }[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  /** Dernière configuration jouée (pour « rejouer » / « recommencer »). */
  const lastCfg = useRef<GameConfig | null>(null);

  const screenRef = useRef(screen);
  const settingsRef = useRef(settings);
  const touchRef = useRef(touch);
  const overAt = useRef(0);
  screenRef.current = screen;
  settingsRef.current = settings;
  touchRef.current = touch;

  // ---- plumbing ---------------------------------------------------------
  useEffect(() => {
    controls.attach();
    return () => controls.detach();
  }, [controls]);

  useEffect(() => {
    controls.capture = screen === 'playing' || screen === 'lobby';
  }, [controls, screen]);

  useEffect(() => {
    let t = 0;
    const stop = startPads(controls, {
      onRoom: setRoom,
      onState: setLinkState,
      onPads: (list, fresh) => {
        setPads(list);
        if (fresh) {
          setToast('📱 Manette connectée : ' + fresh);
          window.clearTimeout(t);
          t = window.setTimeout(() => setToast(null), 2600);
        }
      },
    });
    return () => {
      window.clearTimeout(t);
      stop();
    };
  }, [controls]);

  useEffect(() => {
    controls.touchActive = touch;
  }, [controls, touch]);

  useEffect(() => {
    audio.muted = settingsRef.current.muted;
    void document.fonts?.load('24px "Lilita One"');
    const onTouch = () => setTouch(true);
    const onResize = () => setPortrait(window.innerHeight > window.innerWidth * 1.05);
    window.addEventListener('touchstart', onTouch, { passive: true, once: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('touchstart', onTouch);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // idle kitchen behind the menu follows the chosen heroes / mode
  useEffect(() => {
    if (screen === 'menu') {
      game.setIdle({ mode: 'solo', heroes: settings.heroes, kitchen: settings.kitchen });
    }
  }, [game, screen, settings.heroes, settings.kitchen]);

  // ---- game flow --------------------------------------------------------
  const updateSettings = useCallback((s: Settings) => {
    settingsRef.current = s;
    setSettings(s);
    saveSettings(s);
    audio.setMuted(s.muted);
  }, []);

  useEffect(() => {
    game.onEnd = (r: GameResult) => {
      const s = settingsRef.current;
      let rk = -1;
      if (r.score > 0) {
        const res = addScore({
          name: s.name.trim() || 'CHEF',
          score: r.score,
          mode: game.cfg.mode,
          delivered: r.delivered,
          date: Date.now(),
          heroes: game.cfg.heroes,
        });
        setScores(res.scores);
        rk = res.rank;
      }
      setRank(rk);
      setResult(r);
      overAt.current = performance.now();
      audio.stopMusic();
      setScreen('over');
    };
    return () => {
      game.onEnd = null;
    };
  }, [game]);

  /** Lance une partie : `cfg` donné (co-op depuis le salon), sinon on rejoue la dernière, sinon solo. */
  const launch = useCallback((cfg: GameConfig) => {
    const s = settingsRef.current;
    lastCfg.current = cfg;
    audio.init();
    audio.setMuted(s.muted);
    audio.stopMusic();
    game.reset(cfg);
    setResult(null);
    setRank(-1);
    setHowto(false);
    setScreen('playing');
    audio.start();
    audio.startMusic();
  }, [game]);

  const startSolo = useCallback(() => {
    const s = settingsRef.current;
    launch({ mode: 'solo', heroes: s.heroes, kitchen: s.kitchen });
  }, [launch]);

  /** Rejouer / recommencer : même configuration que la dernière partie. */
  const start = useCallback(() => {
    if (lastCfg.current) launch(lastCfg.current);
    else startSolo();
  }, [launch, startSolo]);

  const startCoop = useCallback(
    (c: CoopSetup) => {
      launch({ mode: 'coop', heroes: c.heroes, devices: c.devices, names: c.names, kitchen: c.kitchen });
    },
    [launch],
  );

  const openLobby = useCallback(() => {
    audio.init();
    audio.ui();
    setScreen('lobby');
  }, []);

  const pause = useCallback(() => {
    if (screenRef.current !== 'playing') return;
    audio.stopMusic();
    audio.ui();
    setScreen('paused');
  }, []);

  const resume = useCallback(() => {
    if (screenRef.current !== 'paused') return;
    controls.clearLatches();
    audio.ui();
    audio.startMusic();
    setScreen('playing');
  }, [controls]);

  const quit = useCallback(() => {
    audio.stopMusic();
    audio.ui();
    setScreen(lastCfg.current?.mode === 'coop' ? 'lobby' : 'menu');
  }, []);

  const toggleMute = useCallback(() => {
    updateSettings({ ...settingsRef.current, muted: !settingsRef.current.muted });
    audio.ui();
  }, [updateSettings]);

  const onPadStart = useCallback(() => {
    const sc = screenRef.current;
    if (sc === 'playing') pause();
    else if (sc === 'paused') resume();
    else if (sc === 'menu') startSolo();
    else if (sc === 'over' && performance.now() - overAt.current > 700) start();
  }, [pause, resume, start, startSolo]);

  // ce que voient les téléphones + boutons du téléphone hors partie
  useEffect(() => {
    if (screen === 'lobby') return; // le salon gère lui-même
    link.status = (pid) => {
      const sc = screenRef.current;
      if (sc === 'menu') return { state: 'menu' };
      const coop = game.coop;
      const c = coop ? game.chefs.find((x) => x.device === 'ph:' + pid) : game.chefs[game.active];
      if (!c) return { state: 'spectator' };
      return {
        state: sc,
        hero: c.hero.name,
        color: c.hero.color,
        slot: coop ? c.idx : -1,
        skill: c.hero.abilityName,
        cd: c.dashCd,
        cdMax: c.hero.cd,
        score: game.score,
        holding: c.held ? c.held.id : null,
        solo: !coop,
      };
    };
    link.onButton = (i) => {
      const sc = screenRef.current;
      if (sc === 'menu') {
        if (i === 0) openLobby();
        else if (i === 2) startSolo();
      } else if (sc === 'over' && performance.now() - overAt.current > 900 && i !== 3) start();
      else if (sc === 'paused' && i === 0) resume();
    };
    return () => {
      link.onButton = null;
    };
  }, [screen, game, openLobby, startSolo, start, resume]);

  // auto-pause when the tab/app goes to the background
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) pause();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [pause]);

  // ---- keyboard shortcuts ----------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';
      const sc = screenRef.current;

      if (typing) {
        if (e.code === 'Enter' && sc === 'menu') {
          el?.blur();
          start();
        }
        return;
      }
      if (e.code === 'KeyM') {
        toggleMute();
        return;
      }
      switch (sc) {
        case 'playing':
          if (e.code === 'Escape' || e.code === 'KeyP') pause();
          break;
        case 'paused':
          if (e.code === 'Escape' || e.code === 'KeyP') resume();
          else if (e.code === 'KeyR') start();
          break;
        case 'over':
          if (performance.now() - overAt.current < 700) break;
          if (e.code === 'Enter' || e.code === 'KeyR' || e.code === 'Space') {
            e.preventDefault();
            start();
          } else if (e.code === 'Escape') quit();
          break;
        case 'menu':
          if (howto) {
            if (e.code === 'Escape' || e.code === 'Enter') setHowto(false);
          } else if (e.code === 'Enter' && tag !== 'BUTTON') startSolo();
          else if (e.code === 'KeyC') openLobby();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [start, startSolo, openLobby, pause, resume, quit, toggleMute, howto]);

  return (
    <div className="fixed inset-0 font-game">
      <GameView game={game} screen={screen} touch={touch} onPause={pause} onPadStart={onPadStart} />

      {screen === 'menu' && (
        <MainMenu
          settings={settings}
          onChange={updateSettings}
          scores={scores}
          onPlay={startSolo}
          onCoop={openLobby}
          onPair={() => setPairOpen(true)}
          padCount={pads.length}
          onHowTo={() => {
            audio.init();
            audio.ui();
            setHowto(true);
          }}
          touch={touch}
          portrait={portrait}
          muted={settings.muted}
          onToggleMute={() => {
            audio.init();
            toggleMute();
          }}
        />
      )}
      {screen === 'menu' && howto && <HowTo onClose={() => setHowto(false)} />}
      {screen === 'lobby' && (
        <CoopLobby
          controls={controls}
          kitchen={settings.kitchen}
          onKitchen={(k) => updateSettings({ ...settingsRef.current, kitchen: k })}
          onBack={() => setScreen('menu')}
          onStart={startCoop}
          onPair={() => setPairOpen(true)}
          padCount={pads.length}
        />
      )}
      {pairOpen && (
        <PairDialog
          room={room}
          linkState={linkState}
          pads={pads}
          accent="#ffd23f"
          hint="Scannez le QR code avec l'appareil photo du téléphone : il devient une manette (joystick, prendre, couper, pouvoir, pause)."
          onClose={() => setPairOpen(false)}
        />
      )}
      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-full border-[3px] border-ink bg-mint px-4 py-1.5 text-base text-ink shadow-xl">
          {toast}
        </div>
      )}

      {screen === 'paused' && (
        <PauseMenu onResume={resume} onRestart={start} onQuit={quit} muted={settings.muted} onToggleMute={toggleMute} touch={touch} />
      )}

      {screen === 'over' && result && (
        <GameOver result={result} scores={scores} rank={rank} onRestart={start} onQuit={quit} touch={touch} />
      )}
    </div>
  );
}
