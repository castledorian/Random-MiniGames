import { useEffect, useId, useState } from 'react';
import { BookOpen, Medal, Play, Users } from 'lucide-react';
import { HEROES, MODES, PALETTE, STAGES, heroById, type HeroId, type Mode } from '../game/constants';
import type { GameConfig } from '../game/game';
import { L, getLang, setLang, t, useLang, type Key } from '../game/i18n';
import { audio } from '../game/audio';
import { load, save } from '../game/storage';
import { HeroPortrait } from './HeroPortrait';
import { HowToModal, MODE_ICON, MODE_KEY, ScoresModal, StagesModal } from './Modals';
import { SoundToggles } from './ui';

function BlobIcon({ c, size = 56, className = '', style }: { c: number; size?: number; className?: string; style?: React.CSSProperties }) {
  const id = useId();
  const p = PALETTE[c];
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} style={style} aria-hidden>
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor={p.light} />
          <stop offset="0.45" stopColor={p.base} />
          <stop offset="1" stopColor={p.dark} />
        </radialGradient>
      </defs>
      <circle cx="32" cy="33" r="29" fill={`url(#${id})`} stroke="rgba(20,6,40,0.55)" strokeWidth="2" />
      <ellipse cx="21" cy="17" rx="9" ry="5" fill="rgba(255,255,255,0.55)" transform="rotate(-30 21 17)" />
      {[-1, 1].map((s) => (
        <g key={s}>
          <ellipse cx={32 + s * 11} cy="34" rx="7" ry="8.5" fill="#fff" stroke="rgba(20,6,40,0.5)" strokeWidth="1" />
          <ellipse cx={32 + s * 11 - s} cy="36" rx="4" ry="5" fill="#1b0b33" />
          <circle cx={32 + s * 11 - 2} cy="33" r="1.6" fill="#fff" />
        </g>
      ))}
    </svg>
  );
}

const MODE_DESC: Record<Mode, Key> = { campaign: 'mCampaignD', versus: 'mVersusD', score: 'mScoreD', survival: 'mSurvivalD' };
const MODE_COLOR: Record<Mode, string> = { campaign: '#ffcc2e', versus: '#ff4d6d', score: '#3fa4ff', survival: '#b366ff' };
const DIFFS: { key: Key; v: number }[] = [
  { key: 'easy', v: 0.15 },
  { key: 'normal', v: 0.5 },
  { key: 'hard', v: 0.85 },
];

export function Menu({ onStart, onParty, onPair, padCount }: { onStart: (cfg: GameConfig) => void; onParty: () => void; onPair: () => void; padCount: number }) {
  const lang = useLang();
  const [heroId, setHeroId] = useState<HeroId>(() => {
    const h = load().hero as HeroId;
    return HEROES.some((x) => x.id === h) ? h : 'ember';
  });
  const [diff, setDiff] = useState(() => load().diff || 0.5);
  const [modal, setModal] = useState<null | 'scores' | 'howto' | 'stages'>(null);
  const hero = heroById(heroId);
  const sv = load();
  const nextStage = Math.min(STAGES.length, sv.unlocked);

  const go = (cfg: Omit<GameConfig, 'hero'>) => {
    audio.init();
    audio.play('click');
    save({ hero: heroId, diff: cfg.diff ?? diff });
    onStart({ ...cfg, hero: heroId });
  };

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (modal) return;
      if (e.code === 'KeyV') {
        e.preventDefault();
        audio.init();
        onParty();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        go({ mode: 'campaign', stage: nextStage });
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, heroId, nextStage]);

  const pick = (id: HeroId) => {
    audio.init();
    audio.play('click');
    setHeroId(id);
    save({ hero: id });
  };

  return (
    <div className="menu-bg no-select relative h-full overflow-x-hidden overflow-y-auto">
      {/* ambient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-40">
        {[1, 2, 3, 4, 5, 3, 1].map((c, i) => (
          <BlobIcon
            key={i}
            c={c}
            size={50 + ((i * 37) % 60)}
            className="animate-float absolute"
            style={{ left: `${(i * 15 + 4) % 95}%`, top: `${(i * 23 + 8) % 90}%`, animationDelay: `${i * 0.6}s`, ['--r' as string]: `${i * 20}deg`, opacity: 0.55 }}
          />
        ))}
      </div>

      <div className="ui-zoom relative mx-auto flex min-h-full w-full max-w-5xl flex-col gap-6 px-4 pt-4 pb-10">
        {/* top bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <a href="../" className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-bold transition hover:bg-white/20">
            ◀ Tous les jeux
          </a>
          <div className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 p-1 text-sm font-bold">
            {(['en', 'fr'] as const).map((l) => (
              <button
                key={l}
                onClick={() => {
                  audio.play('click');
                  setLang(l);
                }}
                className={`rounded-full px-3 py-1 transition ${getLang() === l ? 'bg-[#ffe66b] text-[#2a1060]' : 'text-white/70 hover:text-white'}`}
                aria-label={`${t('language')}: ${l}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onPair}
              className={`rounded-full px-3 py-1.5 text-sm font-bold transition hover:brightness-110 ${padCount ? 'bg-[#38e08a] text-[#0b2a18]' : 'border border-white/20 bg-white/10'}`}
              title="Téléphones manettes"
            >
              📱{padCount ? ' ' + padCount : ''}
            </button>
            <SoundToggles />
          </div>
        </div>

        {/* logo */}
        <header className="flex flex-col items-center gap-3 pt-2 text-center">
          <div className="flex items-end justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((c, i) => (
              <BlobIcon key={c} c={c} size={44 + (i % 2) * 10} className="animate-float" style={{ animationDelay: `${i * 0.35}s`, ['--r' as string]: `${(i - 2) * 6}deg` }} />
            ))}
          </div>
          <h1 className="logo-text text-[clamp(3.4rem,14vw,7.5rem)]">
            <span className="text-[#ff5c7a]">BLOB</span> <span className="text-[#ffcf33]">BRAWL</span>
          </h1>
          <p className="text-lg font-medium text-[#cdb8ff] sm:text-xl">{t('tagline')}</p>
        </header>

        {/* play */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => go({ mode: 'campaign', stage: nextStage })}
            className="btn-chunky animate-glow flex items-center gap-3 rounded-full bg-gradient-to-b from-[#ffe66b] to-[#ffb62e] px-12 py-4 text-3xl font-bold text-[#3a1a00] shadow-[0_6px_0_#b8741a] hover:brightness-110 sm:px-16 sm:text-4xl"
          >
            <Play fill="currentColor" size={30} /> {t('play')}
          </button>
          <div className="text-sm text-white/70">
            {t('playSub', { n: nextStage })}
            <span className="hidden sm:inline"> · {t('pressEnter')}</span>
          </div>
          <button
            onClick={() => {
              audio.init();
              audio.play('click');
              onParty();
            }}
            className="btn-chunky mt-2 flex items-center gap-2 rounded-full bg-gradient-to-b from-[#ff6d8a] to-[#e0335a] px-6 py-3 text-xl whitespace-nowrap sm:px-8 sm:text-2xl font-bold text-white shadow-[0_5px_0_#8c1530] hover:brightness-110"
          >
            <Users size={24} /> Versus entre amis <span className="hidden text-sm opacity-70 sm:inline">2-4 · V</span>
          </button>
          <div className="text-xs text-white/55">Claviers, manettes et téléphones (QR code)</div>
        </div>

        {/* heroes */}
        <section key={lang}>
          <h2 className="mb-3 text-sm font-bold tracking-widest text-[#7fe9ff] uppercase">{t('heroes')}</h2>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {HEROES.map((h) => {
              const sel = h.id === heroId;
              return (
                <button
                  key={h.id}
                  onClick={() => pick(h.id)}
                  aria-pressed={sel}
                  className={`relative flex flex-col items-center rounded-2xl border-2 px-1 pt-2 pb-2 transition duration-150 ${
                    sel ? '-translate-y-1 scale-[1.04]' : 'opacity-75 hover:opacity-100 hover:-translate-y-0.5'
                  }`}
                  style={{
                    borderColor: sel ? h.color : 'rgba(255,255,255,0.14)',
                    background: sel ? `linear-gradient(180deg, rgba(${h.rgb},0.28), rgba(${h.rgb},0.08))` : 'rgba(255,255,255,0.05)',
                    boxShadow: sel ? `0 0 28px rgba(${h.rgb},0.45)` : 'none',
                  }}
                >
                  <HeroPortrait hero={h} size={96} mood={sel ? 'happy' : 'idle'} />
                  <span className="-mt-1 text-lg font-bold" style={{ color: sel ? h.light : '#fff' }}>
                    {h.name}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="panel mt-3 grid gap-3 rounded-2xl p-4 sm:grid-cols-2" style={{ borderColor: `rgba(${hero.rgb},0.5)` }}>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-[#3fa4ff]/25 px-2 py-0.5 text-xs font-bold tracking-wider text-[#9fd2ff] uppercase">{t('passive')}</span>
                <b style={{ color: hero.light }}>{L(hero.passive.name)}</b>
              </div>
              <p className="text-sm leading-snug text-white/80">{L(hero.passive.desc)}</p>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-[#ffcc2e]/25 px-2 py-0.5 text-xs font-bold tracking-wider text-[#ffe08a] uppercase">⚡ {t('skill')}</span>
                <b style={{ color: hero.light }}>{L(hero.active.name)}</b>
              </div>
              <p className="text-sm leading-snug text-white/80">{L(hero.active.desc)}</p>
            </div>
          </div>
        </section>

        {/* modes */}
        <section>
          <h2 className="mb-3 text-sm font-bold tracking-widest text-[#7fe9ff] uppercase">{t('modes')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODES.map((m) => {
              const Icon = MODE_ICON[m];
              const col = MODE_COLOR[m];
              const body = (
                <div className="flex items-center gap-3 text-left">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${col}33`, color: col }}>
                    <Icon size={26} />
                  </span>
                  <span>
                    <span className="block text-xl leading-tight font-bold">{t(MODE_KEY[m])}</span>
                    <span className="block text-sm leading-snug text-white/65">{t(MODE_DESC[m])}</span>
                  </span>
                </div>
              );
              if (m === 'versus') {
                return (
                  <div key={m} className="rounded-2xl border border-white/15 bg-white/[0.06] p-3.5" style={{ borderColor: `${col}55` }}>
                    {body}
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {DIFFS.map((d) => (
                        <button
                          key={d.v}
                          onClick={() => {
                            setDiff(d.v);
                            go({ mode: 'versus', diff: d.v });
                          }}
                          className={`rounded-xl border px-2 py-2 text-sm font-bold transition hover:-translate-y-0.5 ${
                            Math.abs(diff - d.v) < 0.01 ? 'border-[#ff4d6d] bg-[#ff4d6d]/25' : 'border-white/15 bg-white/10 hover:bg-white/20'
                          }`}
                        >
                          {t(d.key)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <button
                  key={m}
                  onClick={() => {
                    if (m === 'campaign') {
                      audio.init();
                      audio.play('click');
                      setModal('stages');
                    } else go({ mode: m });
                  }}
                  className="rounded-2xl border border-white/15 bg-white/[0.06] p-3.5 transition hover:-translate-y-1 hover:bg-white/[0.12]"
                  style={{ borderColor: `${col}55` }}
                >
                  {body}
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => {
              audio.init();
              audio.play('click');
              setModal('scores');
            }}
            className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 font-semibold transition hover:bg-white/20"
          >
            <Medal size={18} className="text-[#ffd23f]" /> {t('scores')}
          </button>
          <button
            onClick={() => {
              audio.init();
              audio.play('click');
              setModal('howto');
            }}
            className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 font-semibold transition hover:bg-white/20"
          >
            <BookOpen size={18} className="text-[#7fe9ff]" /> {t('howto')}
          </button>
        </div>
      </div>

      {modal === 'scores' && <ScoresModal onClose={() => setModal(null)} />}
      {modal === 'howto' && <HowToModal onClose={() => setModal(null)} />}
      {modal === 'stages' && (
        <StagesModal
          onClose={() => setModal(null)}
          onStart={(stage) => {
            setModal(null);
            go({ mode: 'campaign', stage });
          }}
        />
      )}
    </div>
  );
}
