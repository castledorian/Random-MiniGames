import { useEffect, useRef, useState } from 'react';
import { HEROES, HERO_IDS, KITCHENS, RECIPES, type Hero, type HeroId, type ItemId } from '../game/config';
import { drawChefPortrait, drawItemIcon } from '../game/draw';
import { audio } from '../game/audio';
import type { GameResult } from '../game/types';
import type { Mode, ScoreEntry, Settings } from '../game/storage';

// ---------------------------------------------------------------------------
// small canvas widgets
// ---------------------------------------------------------------------------
export function ChefAvatar({ hero, size = 64, animate = false }: { hero: Hero; size?: number; animate?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const s = size / 62;
  const h = Math.round(78 * s);
  useEffect(() => {
    const cv = ref.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = size * dpr;
    cv.height = h * dpr;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, h);
      ctx.translate(size / 2, 49 * s);
      ctx.scale(s, s);
      ctx.translate(0, animate ? Math.abs(Math.sin(t * 3)) * -4 : 0);
      drawChefPortrait(ctx, hero, animate ? t : 0.4);
      if (animate) raf = requestAnimationFrame(draw);
    };
    draw(t0);
    return () => cancelAnimationFrame(raf);
  }, [hero, size, animate, s, h]);
  return <canvas ref={ref} style={{ width: size, height: h }} />;
}

export function ItemIcon({ id, size = 36 }: { id: ItemId; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = size * dpr;
    cv.height = size * dpr;
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawItemIcon(ctx, id, size / 2, size / 2, size / 2 - 3);
  }, [id, size]);
  return <canvas ref={ref} style={{ width: size, height: size, display: 'inline-block', verticalAlign: 'middle' }} />;
}

const MODE_LABEL: Record<Mode, string> = { solo: 'SOLO', coop: 'CO-OP' };

// ---------------------------------------------------------------------------
// high-score table
// ---------------------------------------------------------------------------
export function ScoreTable({
  scores,
  highlight = -1,
  limit = 8,
}: {
  scores: ScoreEntry[];
  highlight?: number;
  limit?: number;
}) {
  const rows = scores.slice(0, limit);
  if (!rows.length) {
    return <div className="py-6 text-center text-base text-[#9aa6dd]">Pas encore de score — sois le premier chef du tableau !</div>;
  }
  return (
    <ol className="space-y-1.5">
      {rows.map((e, i) => {
        const hl = i === highlight;
        return (
          <li
            key={`${e.date}-${i}`}
            className={`flex items-center gap-2 rounded-xl border-2 px-2.5 py-1 text-base ${
              hl ? 'anim-wiggle border-sun bg-sun/25' : 'border-transparent bg-white/5'
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-ink text-sm text-ink ${
                i === 0 ? 'bg-sun' : i === 1 ? 'bg-[#dfe6ff]' : i === 2 ? 'bg-[#ffb27a]' : 'bg-[#8f9bd0]'
              }`}
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate">{e.name}</span>
            <span className="rounded-md bg-black/25 px-1.5 text-[11px] tracking-wider text-[#b9c4f2]">{MODE_LABEL[e.mode]}</span>
            <span className="w-8 text-right text-sm text-[#9aa6dd]">{e.delivered}🍔</span>
            <span className="w-14 text-right text-sun">{e.score}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// hero picker
// ---------------------------------------------------------------------------
function HeroPick({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub: string;
  value: HeroId;
  onChange: (id: HeroId) => void;
}) {
  const hero = HEROES[value];
  return (
    <div className="panel p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-lg text-sun">{label}</span>
        <span className="text-xs text-[#9aa6dd]">{sub}</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {HERO_IDS.map((id) => {
          const h = HEROES[id];
          const sel = id === value;
          return (
            <button
              key={id}
              onClick={() => {
                audio.ui();
                onChange(id);
              }}
              className={`flex flex-col items-center rounded-2xl border-[3px] px-1 pb-1 pt-1.5 transition-transform ${
                sel ? 'border-sun bg-sun/20 scale-[1.04]' : 'border-ink/70 bg-black/20 hover:bg-white/10'
              }`}
              style={{ touchAction: 'manipulation' }}
            >
              <ChefAvatar hero={h} size={46} animate={sel} />
              <span className={`text-sm leading-none ${sel ? 'text-sun' : 'text-white'}`}>{h.name}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 space-y-1 rounded-xl bg-black/25 p-2 text-[13px] leading-snug">
        <div className="text-[#b9c4f2]">
          <span className="text-white">{hero.name}</span> · {hero.role}
        </div>
        <div>
          <span className="text-grape">⚡ {hero.abilityName}</span>
          <span className="text-[#c7d0f5]"> — {hero.abilityDesc}</span>
        </div>
        <div>
          <span className="text-mint">★ {hero.passiveName}</span>
          <span className="text-[#c7d0f5]"> — {hero.passiveDesc}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// main menu
// ---------------------------------------------------------------------------
export function MainMenu({
  settings,
  onChange,
  scores,
  onPlay,
  onCoop,
  onPair,
  padCount,
  onHowTo,
  touch,
  portrait,
  muted,
  onToggleMute,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  scores: ScoreEntry[];
  onPlay: () => void;
  onCoop: () => void;
  onPair: () => void;
  padCount: number;
  onHowTo: () => void;
  touch: boolean;
  portrait: boolean;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const setHero = (slot: 0 | 1, id: HeroId) => {
    const heroes: [HeroId, HeroId] = [...settings.heroes] as [HeroId, HeroId];
    const other = heroes[1 - slot];
    if (other === id) heroes[1 - slot] = heroes[slot];
    heroes[slot] = id;
    onChange({ ...settings, heroes });
  };
  const ki = Math.max(0, KITCHENS.findIndex((k) => k.id === settings.kitchen));
  const kc = KITCHENS[ki];
  const setKitchen = (d: number) => {
    audio.ui();
    onChange({ ...settings, kitchen: KITCHENS[(ki + d + KITCHENS.length) % KITCHENS.length].id });
  };

  return (
    <div
      className="scroll-y absolute inset-0 z-40 bg-[#0d1030]/90"
      // clicking a menu button must not steal keyboard focus, so Enter always starts the game
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) e.preventDefault();
      }}
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <a href="../" className="btn btn-ghost px-3 py-1.5 text-sm">
          ◀ Tous les jeux
        </a>
        <div className="flex gap-2">
          <button onClick={onPair} className={`btn px-3 py-1.5 text-sm ${padCount ? 'btn-mint' : 'btn-ghost'}`}>
            📱 {padCount ? padCount : 'Téléphone'}
          </button>
          <button onClick={onToggleMute} className="btn btn-ghost px-3 py-1.5 text-sm" aria-label="Son">
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>
      <div className="flex min-h-[calc(100%-56px)] items-center justify-center p-3 sm:p-6">
        <div className="ui-zoom w-full max-w-5xl">
          {/* title */}
          <div className="relative mb-3 text-center sm:mb-5">
            <div className="pointer-events-none absolute -left-1 top-0 hidden sm:block">
              <div className="float-icon" style={{ ['--r' as string]: '-12deg' }}>
                <ItemIcon id="bun" size={64} />
              </div>
            </div>
            <div className="pointer-events-none absolute -right-1 top-0 hidden sm:block">
              <div className="float-icon" style={{ ['--r' as string]: '10deg', animationDelay: '-2s' }}>
                <ItemIcon id="tomato_raw" size={64} />
              </div>
            </div>
            <h1 className="title-text anim-pop text-5xl leading-none tracking-wide sm:text-7xl">BRAWL BISTRO</h1>
            <p className="mt-2 text-base text-[#cfd6ff] sm:mt-3 sm:text-xl">
              Cuisinez les commandes. <span className="text-sun">Foncez</span> dans le chaos. <span className="text-berry">Écrasez</span> les rats.
            </p>
          </div>

          {touch && portrait && (
            <div className="mb-3 rounded-xl border-2 border-sun/60 bg-sun/15 px-3 py-1.5 text-center text-sm text-sun">
              📱 Astuce : tourne ton téléphone en paysage pour une cuisine plus grande
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.35fr_1fr] sm:gap-5">
            {/* left: setup */}
            <div className="min-w-0 space-y-3">
              <button onClick={onCoop} className="btn btn-mint w-full py-3 text-left">
                <div className="text-2xl">👥 CO-OP ENTRE AMIS · 2 à 4</div>
                <div className="text-xs leading-tight opacity-85">Claviers, manettes et téléphones (QR code) — chacun son chef</div>
              </button>

              <div className="panel flex items-center gap-2 p-2">
                <button className="btn btn-ghost px-3 py-1" onClick={() => setKitchen(-1)} aria-label="Cuisine précédente">
                  ◀
                </button>
                <div className="min-w-0 flex-1 text-center">
                  <div className="text-[11px] tracking-widest text-[#9aa6dd]">CUISINE</div>
                  <div className="text-xl text-sun">{kc.name}</div>
                  <div className="truncate text-[11px] text-[#c7d0f5]">{kc.desc}</div>
                </div>
                <button className="btn btn-ghost px-3 py-1" onClick={() => setKitchen(1)} aria-label="Cuisine suivante">
                  ▶
                </button>
              </div>

              <div className="text-sm text-[#b9c4f2]">👤 SOLO : deux chefs, un seul toi — alterne entre eux à tout moment</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <HeroPick label="CHEF A" sub="tu commences avec lui" value={settings.heroes[0]} onChange={(id) => setHero(0, id)} />
                <HeroPick label="CHEF B" sub="à prendre quand tu veux" value={settings.heroes[1]} onChange={(id) => setHero(1, id)} />
              </div>
            </div>

            {/* right: play + scores */}
            <div className="flex min-w-0 flex-col gap-3">
              <div className="panel p-3">
                <label className="flex items-center gap-2 text-base text-[#b9c4f2]">
                  <span>NOM</span>
                  <input
                    value={settings.name}
                    maxLength={10}
                    onChange={(e) =>
                      onChange({ ...settings, name: e.target.value.toUpperCase().replace(/[^A-Z0-9 _!-]/g, '').slice(0, 10) })
                    }
                    onKeyDown={(e) => e.stopPropagation()}
                    className="min-w-0 flex-1 rounded-xl border-[3px] border-ink bg-cream px-3 py-1.5 text-center text-lg tracking-widest text-ink outline-none focus:ring-4 focus:ring-sun/60"
                    placeholder="CHEF"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <button onClick={onPlay} className="btn btn-sun anim-glow mt-3 w-full py-3 text-3xl">
                  ▶ SOLO
                </button>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  <button onClick={onHowTo} className="btn btn-ghost text-base">
                    ❓ Comment jouer
                  </button>
                </div>
                {!touch && (
                  <div className="mt-2.5 text-center text-xs text-[#9aa6dd]">
                    <kbd>Entrée</kbd> solo · <kbd>C</kbd> co-op · <kbd>P</kbd> pause · <kbd>R</kbd> recommencer
                  </div>
                )}
              </div>

              <div className="panel flex-1 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xl text-sun">🏆 MEILLEURS SCORES</span>
                  <span className="text-xs text-[#9aa6dd]">sur cet appareil</span>
                </div>
                <ScoreTable scores={scores} limit={6} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// how to play
// ---------------------------------------------------------------------------
export function HowTo({ onClose }: { onClose: () => void }) {
  return (
    <div className="scroll-y absolute inset-0 z-50 bg-[#0d1030]/92" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
        <div className="ui-zoom panel anim-pop w-full max-w-3xl p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="title-text text-4xl">COMMENT JOUER</h2>
            <button className="btn btn-berry px-4 py-1.5 text-xl" onClick={onClose}>
              ✕
            </button>
          </div>

          <p className="text-base leading-snug text-[#dfe5ff] sm:text-lg">
            Les commandes s’affichent en haut. <span className="text-sun">Cuisinez, coupez, dressez et servez</span>-les au guichet orange avant
            la fin du ticket. Servir vite = points bonus, enchaîner les plats = <span className="text-tangerine">combo</span>. Des rats viennent
            voler la nourriture —{' '}
            <span className="text-berry">écrasez-les avec votre pouvoir !</span> Certaines cuisines ont des <span className="text-grape">tunnels</span> sur
            les côtés : on ressort de l’autre bord !
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-black/25 p-3">
              <h3 className="mb-2 text-xl text-sun">🎮 Commandes</h3>
              <table className="w-full text-sm leading-7">
                <tbody>
                  <tr>
                    <td className="text-[#9aa6dd]">Bouger</td>
                    <td>
                      <kbd>WASD</kbd> <kbd>↑↓←→</kbd>
                    </td>
                  </tr>
                  <tr>
                    <td className="text-[#9aa6dd]">Prendre / poser</td>
                    <td>
                      <kbd>Espace</kbd> <kbd>E</kbd>
                    </td>
                  </tr>
                  <tr>
                    <td className="text-[#9aa6dd]">Couper (maintenir)</td>
                    <td>
                      <kbd>F</kbd> <kbd>X</kbd>
                    </td>
                  </tr>
                  <tr>
                    <td className="text-[#9aa6dd]">Pouvoir</td>
                    <td>
                      <kbd>Maj</kbd> <kbd>C</kbd>
                    </td>
                  </tr>
                  <tr>
                    <td className="text-[#9aa6dd]">Changer de chef (solo)</td>
                    <td>
                      <kbd>Tab</kbd> <kbd>Q</kbd>
                    </td>
                  </tr>
                  <tr>
                    <td className="text-[#9aa6dd]">Pause · Recommencer</td>
                    <td>
                      <kbd>P</kbd> <kbd>R</kbd>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-2 space-y-1 text-[13px] leading-snug text-[#c7d0f5]">
                <p>
                  <b className="text-mint">Co-op :</b> clavier A <kbd>ZQSD</kbd> <kbd>E</kbd> prendre · <kbd>F</kbd> couper · <kbd>Maj g.</kbd> pouvoir. Clavier B{' '}
                  <kbd>←↑↓→</kbd> <kbd>Entrée</kbd> prendre · <kbd>.</kbd> couper · <kbd>Maj d.</kbd> pouvoir.
                </p>
                <p>
                  <b className="text-mint">Téléphone :</b> scanne le QR code (📱) : joystick à gauche, PRENDRE / COUPER / POUVOIR à droite.
                </p>
                <p>
                  <b className="text-mint">Manette :</b> stick bouger · A prendre · X couper · B pouvoir · Y changer · Start pause.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-black/25 p-3">
              <h3 className="mb-2 text-xl text-sun">📋 Recettes</h3>
              <ul className="space-y-1.5">
                {RECIPES.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1">
                    <span className="w-16 text-sm">{r.name}</span>
                    <span className="flex flex-1 items-center">
                      {r.items.map((it, i) => (
                        <span key={it} className="flex items-center">
                          {i > 0 && <span className="px-0.5 text-[#9aa6dd]">+</span>}
                          <ItemIcon id={it} size={30} />
                        </span>
                      ))}
                    </span>
                    <span className="text-sm text-sun">{r.value}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 text-[13px] leading-snug text-[#c7d0f5]">
                Coupez <ItemIcon id="lettuce_raw" size={20} /> <ItemIcon id="tomato_raw" size={20} /> <ItemIcon id="potato_raw" size={20} />{' '}
                sur une planche. Cuisez <ItemIcon id="patty_raw" size={20} /> et les <ItemIcon id="potato_chop" size={20} /> coupées sur un fourneau —
                mais <span className="text-berry">sans les brûler !</span> Assemblez le tout sur une assiette.
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-black/25 p-2.5">
              <div className="text-grape">⚡ Chefs</div>
              <div className="text-[#c7d0f5]">Chaque chef a un pouvoir (ruée, téléportation, coup d’épaule) et un passif (portée, découpe, grill).</div>
            </div>
            <div className="rounded-xl bg-black/25 p-2.5">
              <div className="text-mint">🔄 Astuce solo</div>
              <div className="text-[#c7d0f5]">Garez le chef inactif devant une planche : il continue de couper tout seul pendant que vous jouez l’autre.</div>
            </div>
            <div className="rounded-xl bg-black/25 p-2.5">
              <div className="text-berry">🐀 Rats</div>
              <div className="text-[#c7d0f5]">Un ! rouge marque le comptoir visé. Foncez dessus avec votre pouvoir pour sauver la nourriture.</div>
            </div>
          </div>

          <button className="btn btn-sun mt-4 w-full py-2.5 text-2xl" onClick={onClose}>
            COMPRIS !
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// pause
// ---------------------------------------------------------------------------
export function PauseMenu({
  onResume,
  onRestart,
  onQuit,
  muted,
  onToggleMute,
  touch,
}: {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  muted: boolean;
  onToggleMute: () => void;
  touch: boolean;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0d1030]/88 p-4">
      <div className="ui-zoom panel anim-pop w-full max-w-sm p-5 text-center">
        <h2 className="title-text text-5xl">PAUSE</h2>
        <div className="mt-5 space-y-3">
          <button className="btn btn-sun w-full py-3 text-2xl" onClick={onResume}>
            ▶ REPRENDRE
          </button>
          <button className="btn btn-mint w-full py-2.5 text-xl" onClick={onRestart}>
            ↻ RECOMMENCER {!touch && <span className="text-sm opacity-70">(R)</span>}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn btn-ghost text-base" onClick={onToggleMute}>
              {muted ? '🔇 Son' : '🔊 Son'}
            </button>
            <button className="btn btn-berry text-base" onClick={onQuit}>
              ⌂ Menu
            </button>
          </div>
        </div>
        {!touch && (
          <div className="mt-4 text-xs text-[#9aa6dd]">
            <kbd>P</kbd> / <kbd>Échap</kbd> reprendre · <kbd>M</kbd> son
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// game over
// ---------------------------------------------------------------------------
export function GameOver({
  result,
  scores,
  rank,
  onRestart,
  onQuit,
  touch,
}: {
  result: GameResult;
  scores: ScoreEntry[];
  rank: number;
  onRestart: () => void;
  onQuit: () => void;
  touch: boolean;
}) {
  const [shown, setShown] = useState(0);
  const [stars, setStars] = useState(0);

  useEffect(() => {
    // count the score up
    let raf = 0;
    const t0 = performance.now();
    const dur = 900;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      setShown(Math.round(result.score * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // stars pop in one after another
    const timers: number[] = [];
    for (let i = 0; i < result.stars; i++) {
      timers.push(
        window.setTimeout(
          () => {
            setStars(i + 1);
            audio.star(i);
          },
          500 + i * 420,
        ),
      );
    }
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [result]);

  const best = rank === 0;
  const placed = rank >= 0;
  return (
    <div className="scroll-y absolute inset-0 z-40 bg-[#0d1030]/90">
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
        <div className="ui-zoom panel anim-pop w-full max-w-3xl p-4 sm:p-6">
          <h2 className="title-text text-center text-5xl sm:text-6xl">TEMPS ÉCOULÉ !</h2>

          <div className="mt-3 flex items-center justify-center gap-2 sm:gap-3">
            {[0, 1, 2].map((i) => (
              <svg key={i} viewBox="0 0 24 24" className={`h-12 w-12 sm:h-16 sm:w-16 ${i < stars ? 'anim-star' : ''}`}>
                <path
                  d="M12 2.2l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.1 6 20.6l1.3-6.7-5-4.7 6.8-.8z"
                  fill={i < stars ? '#ffd23f' : '#2c3566'}
                  stroke="#10132b"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            ))}
          </div>

          <div className="mt-1 text-center">
            <div className="text-sm tracking-widest text-[#9aa6dd]">SCORE FINAL</div>
            <div className="text-6xl leading-none text-sun drop-shadow-[0_4px_0_#10132b] sm:text-7xl">{shown}</div>
            {best && result.score > 0 && (
              <div className="anim-wiggle mt-2 inline-block rounded-full border-[3px] border-ink bg-berry px-4 py-1 text-lg">
                🏆 NOUVEAU RECORD !
              </div>
            )}
            {!best && placed && (
              <div className="mt-2 inline-block rounded-full border-[3px] border-ink bg-grape px-4 py-1 text-lg">
                Classé n°{rank + 1} au tableau
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr]">
            <div className="grid grid-cols-2 gap-2 text-center">
              {[
                ['🍔', 'Servis', result.delivered],
                ['⏰', 'Ratés', result.expired],
                ['🔥', 'Meilleur combo', result.bestCombo],
                ['🐀', 'Rats écrasés', result.smashed],
              ].map(([ic, label, v]) => (
                <div key={label as string} className="rounded-xl bg-black/25 p-2">
                  <div className="text-2xl">{ic}</div>
                  <div className="text-2xl leading-none">{v}</div>
                  <div className="text-xs text-[#9aa6dd]">{label}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-black/25 p-2.5">
              <div className="mb-1.5 text-lg text-sun">🏆 Meilleurs scores</div>
              <ScoreTable scores={scores} highlight={rank} limit={5} />
            </div>
          </div>

          {result.players && (
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {result.players
                .map((p, i) => ({ ...p, i }))
                .sort((x, y) => y.served - x.served)
                .map((p, k) => (
                  <div key={p.i} className="flex items-center justify-between rounded-xl bg-black/25 px-3 py-1.5">
                    <span>
                      {k === 0 && p.served > 0 ? '👑 ' : ''}
                      <span style={{ color: HEROES[p.hero as HeroId].color }}>{p.name}</span>
                      <span className="text-xs text-[#9aa6dd]"> · {HEROES[p.hero as HeroId].name}</span>
                    </span>
                    <span className="text-sun">{p.served} 🍔</span>
                  </div>
                ))}
            </div>
          )}

          <div className="mt-5 grid grid-cols-[2fr_1fr] gap-3">
            <button className="btn btn-sun anim-glow py-3 text-3xl" onClick={onRestart}>
              ↻ REJOUER {!touch && <span className="text-base opacity-70">(Entrée)</span>}
            </button>
            <button className="btn btn-ghost py-3 text-xl" onClick={onQuit}>
              ⌂ Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
