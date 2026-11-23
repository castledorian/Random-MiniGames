import { useCallback, useEffect, useRef, useState } from 'react';
import { House, Pause, Play, RefreshCw, Star } from 'lucide-react';
import { STAGES, heroById, type Mode } from '../game/constants';
import { Game, type GameConfig, type GameResult } from '../game/game';
import { L, t, useLang } from '../game/i18n';
import { addScore, load, recordStage, renameEntry } from '../game/storage';
import { fmtTime, formatNum } from '../game/render';
import { audio } from '../game/audio';
import { LeftPad, RightPad } from './TouchControls';
import { SoundToggles, useTouch, useViewport } from './ui';
import { party } from '../game/partyInput';
import { SLOT_COLORS } from '../game/game';
import { link } from '../padLink';

interface OverInfo {
  r: GameResult;
  rank: number;
  id: string;
  name: string;
}

function buildOver(r: GameResult): OverInfo {
  if (r.party) return { r, rank: 0, id: '', name: '' };
  let rank = 0;
  let id = '';
  const name = load().initials || 'YOU';
  const solo = r.mode === 'score' || r.mode === 'survival';
  const eligible = solo ? r.score > 0 : !!r.win;
  if (r.mode === 'campaign' && r.win && r.stage) recordStage(r.stage, r.stars, r.score);
  if (eligible) {
    const detail =
      r.mode === 'campaign'
        ? `${t('stageN', { n: r.stage ?? 1 })} ${'★'.repeat(r.stars)}`
        : r.mode === 'versus'
          ? `${t('mVersus')} · x${r.maxChain} ${t('chain')}`
          : r.mode === 'score'
            ? `x${r.maxChain} ${t('chain')}`
            : `${t('survived')} ${fmtTime(r.time)}`;
    const res = addScore(r.mode, { name, score: r.score, detail, hero: r.hero });
    rank = res.rank;
    id = res.id;
  }
  return { r, rank, id, name };
}

function useCountUp(target: number, ms = 1000) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function modeLabel(cfg: GameConfig): string {
  if (cfg.party) return `Versus entre amis · ${cfg.party.length} joueurs`;
  switch (cfg.mode) {
    case 'campaign': {
      const st = STAGES[(cfg.stage ?? 1) - 1];
      return `${t('mCampaign')} · ${t('stageN', { n: st.id })} · ${st.name}`;
    }
    case 'versus':
      return t('mVersus');
    case 'score':
      return t('mScore');
    default:
      return t('mSurvival');
  }
}

/** Fin d'un versus entre amis : vainqueur + classement. */
function PartyOverPanel({ info, onRetry, onMenu }: { info: OverInfo; onRetry: () => void; onMenu: () => void }) {
  useLang();
  const pt = info.r.party!;
  const w = pt.winner !== null ? pt.standings.find((s) => s.idx === pt.winner) : null;
  return (
    <div className="ui-zoom animate-pop panel w-full max-w-md rounded-3xl p-5 text-center">
      <h2 className="logo-text text-[clamp(2.2rem,9vw,3.4rem)]" style={{ color: '#ffd23f' }}>
        {w ? t('victory') : 'ÉGALITÉ'}
      </h2>
      {w && (
        <div className="text-2xl font-bold" style={{ color: SLOT_COLORS[w.idx % 4] }}>
          {w.name} · {heroById(w.hero).name}
        </div>
      )}
      <div className="mt-3 flex flex-col gap-1.5 text-left">
        {pt.standings.map((s) => (
          <div key={s.idx} className="flex items-center gap-2 rounded-xl bg-white/[0.07] px-3 py-1.5">
            <span className="w-6 text-lg font-bold text-white/60">{s.place}</span>
            <span className="rounded-full px-2 text-xs font-bold text-[#120a2e]" style={{ background: SLOT_COLORS[s.idx % 4] }}>
              {s.bot ? 'CPU' : 'J' + (s.idx + 1)}
            </span>
            <span className="min-w-0 flex-1 truncate font-bold">{s.name}</span>
            <span className="text-sm text-white/60">x{s.maxChain} · {s.garbageSent} envoyés</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <BigBtn onClick={onRetry} primary>
          Revanche <span className="text-xs opacity-60">R / ⏎</span>
        </BigBtn>
        <button onClick={onMenu} className="rounded-full py-2 text-sm font-semibold text-white/70 transition hover:text-white">
          <House size={14} className="mr-1 inline -translate-y-px" /> Salon <span className="text-xs opacity-60">Esc</span>
        </button>
      </div>
    </div>
  );
}

function OverPanel({ info, cfg, onRetry, onNext, onMenu }: { info: OverInfo; cfg: GameConfig; onRetry: () => void; onNext: (() => void) | null; onMenu: () => void }) {
  useLang();
  const { r } = info;
  const [name, setName] = useState(info.name);
  const [, force] = useState(0);
  const score = useCountUp(r.score);
  const solo = r.mode === 'score' || r.mode === 'survival';
  const title = solo ? (r.reason === 'time' ? t('timeUp') : t('gameOver')) : r.win ? t('victory') : t('defeat');
  const good = solo ? true : !!r.win;
  const list = load().scores[r.mode as Mode].slice(0, 5);
  const finalCampaign = r.mode === 'campaign' && r.win && (r.stage ?? 0) >= STAGES.length;

  return (
    <div className="ui-zoom animate-pop panel w-full max-w-md rounded-3xl p-5 text-center">
      <h2
        className="logo-text text-[clamp(2.2rem,9vw,3.4rem)]"
        style={{ color: good ? '#ffd23f' : '#ff5f87' }}
      >
        {title}
      </h2>
      {r.mode === 'campaign' && r.win && (
        <div className="mt-1 flex justify-center gap-1">
          {[1, 2, 3].map((i) => (
            <Star
              key={i}
              size={34}
              className={`animate-pop ${r.stars >= i ? 'fill-[#ffd23f] text-[#ffd23f]' : 'text-white/20'}`}
              style={{ animationDelay: `${0.25 + i * 0.18}s` }}
            />
          ))}
        </div>
      )}
      {finalCampaign && <div className="mt-1 font-bold text-[#7fe9ff]">{t('allDone')}</div>}
      <div className="mt-2 text-xs font-bold tracking-widest text-white/50">{t('finalScore')}</div>
      <div className="text-5xl font-bold text-white tabular-nums">{formatNum(score)}</div>

      {info.rank > 0 && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${info.rank === 1 ? 'bg-[#ffd23f] text-[#3a1a00]' : 'bg-white/15 text-white'}`}>
            {info.rank === 1 ? `★ ${t('newHigh')}` : `${t('rank')} #${info.rank}`}
          </span>
          <label className="flex items-center gap-2 text-sm text-white/70">
            {t('initials')}
            <input
              value={name}
              maxLength={3}
              onChange={(e) => {
                const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
                setName(v);
                renameEntry(r.mode, info.id, v || 'YOU');
                force((n) => n + 1);
              }}
              className="w-16 rounded-lg border border-white/25 bg-black/30 px-2 py-1 text-center text-lg font-bold tracking-widest text-[#ffe66b] outline-none focus:border-[#ffe66b]"
            />
          </label>
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Stat label={t('time')} value={fmtTime(r.time)} />
        <Stat label={t('maxChain')} value={`x${r.maxChain}`} />
        {r.mode === 'campaign' || r.mode === 'versus' ? <Stat label={t('sent')} value={String(r.garbageSent)} /> : <Stat label={t('hero')} value={heroById(r.hero).name} />}
      </div>
      {r.bonus > 0 && <div className="mt-2 text-sm text-[#7fe9ff]">{t('bonus')}: +{formatNum(r.bonus)}</div>}

      {list.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-xl border border-white/10 text-left text-sm">
          {list.map((e, i) => (
            <div key={e.id} className={`flex items-center gap-2 px-3 py-1 ${e.id === info.id ? 'bg-[#ffe66b]/20' : i % 2 ? 'bg-white/[0.03]' : 'bg-white/[0.07]'}`}>
              <span className="w-5 font-bold text-white/50">{i + 1}</span>
              <span className="w-12 font-bold tracking-wider">{e.name}</span>
              <span className="flex-1 truncate text-xs text-white/50">{e.detail}</span>
              <span className="font-bold text-[#ffe66b] tabular-nums">{formatNum(e.score)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {onNext ? (
          <>
            <BigBtn onClick={onNext} primary>
              {t('nextStage')} <span className="text-xs opacity-60">⏎</span>
            </BigBtn>
            <BigBtn onClick={onRetry}>
              {t('retry')} <span className="text-xs opacity-60">R</span>
            </BigBtn>
          </>
        ) : (
          <BigBtn onClick={onRetry} primary>
            {t('retry')} <span className="text-xs opacity-60">R / ⏎</span>
          </BigBtn>
        )}
        <button onClick={onMenu} className="rounded-full py-2 text-sm font-semibold text-white/70 transition hover:text-white">
          <House size={14} className="mr-1 inline -translate-y-px" /> {t('menu')} <span className="text-xs opacity-60">Esc</span>
        </button>
      </div>
      <div className="sr-only">{cfg.mode}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.07] px-2 py-1.5">
      <div className="text-[10px] font-bold tracking-widest text-white/45 uppercase">{label}</div>
      <div className="truncate text-lg font-bold">{value}</div>
    </div>
  );
}

function BigBtn({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`btn-chunky flex items-center justify-center gap-2 rounded-full px-6 py-3 text-xl font-bold transition hover:brightness-110 ${
        primary
          ? 'bg-gradient-to-b from-[#ffe66b] to-[#ffb62e] text-[#3a1a00] shadow-[0_5px_0_#b8741a]'
          : 'border border-white/25 bg-white/10 text-white shadow-[0_5px_0_rgba(10,5,40,0.7)]'
      }`}
      style={primary ? undefined : ({ ['--sh' as string]: 'rgba(10,5,40,0.7)' } as React.CSSProperties)}
    >
      {children}
    </button>
  );
}

export function GameScreen({ cfg, onExit, onNext }: { cfg: GameConfig; onExit: () => void; onNext: (cfg: GameConfig) => void }) {
  const lang = useLang();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const skillRef = useRef<HTMLDivElement>(null);
  const touch = useTouch();
  const vp = useViewport();
  const [phase, setPhase] = useState<'playing' | 'paused' | 'over'>('playing');
  const [over, setOver] = useState<OverInfo | null>(null);
  const hero = heroById(cfg.hero);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = new Game(cv, cfg, {
      onPhase: (p) => {
        setPhase(p);
        if (p === 'playing') setOver(null);
      },
      onOver: (r) => setOver(buildOver(r)),
      onHud: (h) => {
        const el = skillRef.current;
        if (el) {
          el.style.setProperty('--p', String(h.energy));
          el.dataset.ready = String(h.ready);
        }
      },
    });
    g.setTouch(touch && !cfg.party);
    gameRef.current = g;
    // Ce que voient les téléphones pendant la partie
    link.status = (pid) => {
      const i = cfg.party ? cfg.party.findIndex((pl) => pl.device === 'ph:' + pid) : 0;
      if (i < 0) return { state: 'spectator' };
      const b = g.boards[i];
      if (!b) return { state: 'spectator' };
      return {
        state: g.phase === 'over' ? 'over' : g.phase === 'paused' ? 'paused' : 'playing',
        hero: b.hero.name,
        color: cfg.party ? SLOT_COLORS[i % 4] : b.hero.color,
        slot: cfg.party ? i : -1,
        energy: Math.floor(b.energy),
        score: b.score,
        out: b.dead,
      };
    };
    if (cfg.party) party.attach();
    if (new URLSearchParams(window.location.search).has('debug')) (window as unknown as { __blob?: Game }).__blob = g;
    return () => {
      g.destroy();
      gameRef.current = null;
      link.status = () => ({ state: 'menu' });
      if (cfg.party) party.detach();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg]);

  useEffect(() => {
    gameRef.current?.setTouch(touch);
  }, [touch]);

  const getGame = useCallback(() => gameRef.current, []);
  const retry = useCallback(() => {
    audio.play('click');
    gameRef.current?.reset(true);
  }, []);
  const nextStage = cfg.mode === 'campaign' && over?.r.win && (cfg.stage ?? 1) < STAGES.length ? (cfg.stage ?? 1) + 1 : 0;
  const goNext = useCallback(() => {
    if (nextStage) onNext({ ...cfg, stage: nextStage });
  }, [nextStage, cfg, onNext]);

  // keyboard on overlays
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement | null;
      if (tg && tg.tagName === 'INPUT') {
        if (e.key === 'Enter') (tg as HTMLInputElement).blur();
        return;
      }
      if (phase === 'over') {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (nextStage) goNext();
          else retry();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onExit();
        }
      } else if (phase === 'paused' && e.key === 'Enter') {
        e.preventDefault();
        gameRef.current?.resume();
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [phase, nextStage, goNext, retry, onExit]);

  // téléphone : un bouton (hors pause) relance en fin de partie
  useEffect(() => {
    link.onButton = (i) => {
      if (phase === 'over' && i !== 3) retry();
    };
    return () => {
      link.onButton = null;
    };
  }, [phase, retry]);

  const landscape = vp.w > vp.h * 1.15;
  const layout: 'none' | 'sides' | 'bottom' = !touch || cfg.party ? 'none' : landscape ? 'sides' : 'bottom';
  const padSize = layout === 'sides' ? 'clamp(50px, 16vh, 74px)' : 'clamp(48px, min(16vw, 10.5vh), 80px)';

  const iconBtn = 'flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:bg-white/20 active:scale-95';

  return (
    <div className="no-select fixed inset-0 flex bg-[#0b0722]" key={lang}>
      {layout === 'sides' && (
        <div className="flex shrink-0 items-end justify-center pb-3" style={{ width: `calc(${padSize} * 2 + 36px)` }}>
          <LeftPad getGame={getGame} size={padSize} stacked />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 px-3">
          <div className="min-w-0 truncate text-sm font-semibold text-white/70">{modeLabel(cfg)}</div>
          <div className="flex shrink-0 items-center gap-2">
            <button className={iconBtn} aria-label={t('restart')} title={`${t('restart')} (R)`} onClick={retry}>
              <RefreshCw size={17} />
            </button>
            <button className={iconBtn} aria-label={t('paused')} title="P / Esc" onClick={() => gameRef.current?.pause()}>
              <Pause size={17} />
            </button>
            <SoundToggles />
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
        </div>
        {layout === 'bottom' && (
          <div className="flex shrink-0 items-end justify-between px-3 pt-1 pb-[max(10px,env(safe-area-inset-bottom))]">
            <LeftPad getGame={getGame} size={padSize} />
            <RightPad getGame={getGame} size={padSize} skillRef={skillRef} heroColor={hero.color} />
          </div>
        )}
      </div>

      {layout === 'sides' && (
        <div className="flex shrink-0 items-end justify-center pb-3" style={{ width: `calc(${padSize} * 2 + 36px)` }}>
          <RightPad getGame={getGame} size={padSize} skillRef={skillRef} heroColor={hero.color} />
        </div>
      )}

      {phase === 'paused' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
          <div className="ui-zoom animate-pop panel flex w-full max-w-xs flex-col gap-3 rounded-3xl p-6 text-center">
            <h2 className="logo-text text-5xl text-[#ffe66b]">{t('paused')}</h2>
            <BigBtn onClick={() => gameRef.current?.resume()} primary>
              <Play size={20} fill="currentColor" /> {t('resume')}
            </BigBtn>
            <BigBtn
              onClick={() => {
                gameRef.current?.reset(true);
              }}
            >
              <RefreshCw size={18} /> {t('restart')} <span className="text-xs opacity-60">R</span>
            </BigBtn>
            <BigBtn onClick={onExit}>
              <House size={18} /> {t('menu')}
            </BigBtn>
            <div className="flex justify-center pt-1">
              <SoundToggles />
            </div>
            <div className="text-xs text-white/45">{L(hero.title)}</div>
          </div>
        </div>
      )}

      {phase === 'over' && over && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/75 p-3">
          {over.r.party ? (
            <PartyOverPanel info={over} onRetry={retry} onMenu={onExit} />
          ) : (
            <OverPanel info={over} cfg={cfg} onRetry={retry} onNext={nextStage ? goNext : null} onMenu={onExit} />
          )}
        </div>
      )}
    </div>
  );
}
