import { HEROES, type HeroDef, type HeroId } from "../game/heroes";
import type { Save } from "../game/storage";
import { HeroIcon } from "./HeroIcon";
import { HERO_TEXT, tr, type Lang } from "./i18n";

interface Props {
  save: Save;
  lang: Lang;
  hero: HeroId;
  onHero: (id: HeroId) => void;
  onPlay: () => void;
  onScores: () => void;
  onHelp: () => void;
  onName: (n: string) => void;
  onLang: (l: Lang) => void;
  onMute: () => void;
  onFullscreen: () => void;
  canFullscreen: boolean;
  portrait: boolean;
  onCoop: () => void;
  onPair: () => void;
  padCount: number;
}

export function isUnlocked(h: HeroDef, bestRoom: number) {
  return h.unlockRoom <= bestRoom;
}

function Row({ label, color, name, text }: { label: string; color: string; name: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="mt-0.5 w-[4.6rem] shrink-0 rounded-sm px-1.5 py-0.5 text-center font-ui text-[10px] font-bold tracking-widest text-black"
        style={{ background: color }}
      >
        {label}
      </span>
      <p className="font-ui text-[13px] leading-snug text-white/80">
        <b className="font-bold text-white">{name}</b> — {text}
      </p>
    </div>
  );
}

export function Menu(p: Props) {
  const { save, lang } = p;
  const hero = HEROES.find((h) => h.id === p.hero) ?? HEROES[0];
  const txt = HERO_TEXT[lang][hero.id];
  const best = save.scores[0]?.score ?? 0;

  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-gradient-to-b from-[#07030f]/80 via-[#12062b]/70 to-[#07030f]/90 [touch-action:pan-y]">
      {/* top bar */}
      <a
        href="../"
        className="fixed left-3 top-3 z-30 rounded border border-white/20 bg-black/50 px-3 py-1.5 font-ui text-xs font-bold tracking-widest text-white hover:border-neon-cyan hover:text-neon-cyan"
      >
        ◀ TOUS LES JEUX
      </a>
      <div className="fixed right-3 top-3 z-30 flex items-center gap-2">
        <button
          onClick={p.onPair}
          className={`rounded border px-2.5 py-1.5 font-ui text-xs font-bold ${p.padCount ? "border-[#38e08a] bg-[#38e08a] text-[#07210f]" : "border-white/20 bg-black/50 text-white hover:border-neon-green"}`}
          aria-label="Téléphones manettes"
          title="Téléphones manettes"
        >
          📱{p.padCount ? " " + p.padCount : ""}
        </button>
        <button
          onClick={() => p.onLang(lang === "fr" ? "en" : "fr")}
          className="rounded border border-white/20 bg-black/50 px-2.5 py-1.5 font-ui text-xs font-bold tracking-widest text-white hover:border-neon-cyan hover:text-neon-cyan"
          aria-label="Language"
        >
          <span className={lang === "fr" ? "text-neon-cyan" : "text-white/50"}>FR</span>
          <span className="text-white/30"> | </span>
          <span className={lang === "en" ? "text-neon-cyan" : "text-white/50"}>EN</span>
        </button>
        <button
          onClick={p.onMute}
          className="rounded border border-white/20 bg-black/50 px-2.5 py-1.5 font-ui text-xs font-bold tracking-widest text-white hover:border-neon-pink"
          aria-label={tr(lang, "sound")}
        >
          {save.muted ? "🔇" : "🔊"}
        </button>
        {p.canFullscreen && (
          <button
            onClick={p.onFullscreen}
            className="rounded border border-white/20 bg-black/50 px-2.5 py-1.5 font-ui text-xs font-bold text-white hover:border-neon-green"
            aria-label={tr(lang, "fullscreen")}
          >
            ⛶
          </button>
        )}
      </div>

      <div className="ui-zoom mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center gap-4 px-4 pb-6 pt-14 sm:gap-5">
        <header className="select-none text-center">
          <h1 className="font-title leading-[0.88]">
            <span className="block animate-[flicker_7s_infinite] text-[clamp(3.2rem,13vw,6.5rem)] text-neon-pink [text-shadow:0_0_10px_#ff2d95,0_0_36px_#ff2d9588,4px_4px_0_#07030f]">
              ONE HIT
            </span>
            <span className="block text-[clamp(2.6rem,10.5vw,5.2rem)] text-neon-cyan [text-shadow:0_0_10px_#19e3ff,0_0_36px_#19e3ff88,4px_4px_0_#07030f]">
              BRAWL
            </span>
          </h1>
          <p className="mt-2 font-ui text-sm font-semibold uppercase tracking-[0.25em] text-white/70 sm:text-base">{tr(lang, "tagline")}</p>
        </header>

        {/* hero picker */}
        <section className="w-full rounded-lg border border-white/10 bg-black/45 p-3 sm:p-4">
          <h2 className="mb-2 text-center font-ui text-[11px] font-bold tracking-[0.3em] text-white/50">{tr(lang, "chooseHero")}</h2>
          <div className="grid grid-cols-4 gap-2">
            {HEROES.map((h) => {
              const ok = isUnlocked(h, save.bestRoom);
              const sel = h.id === p.hero;
              return (
                <button
                  key={h.id}
                  onClick={() => p.onHero(h.id)}
                  className="group relative flex flex-col items-center rounded-md border-2 px-1 pb-1.5 pt-2 transition-transform active:scale-95"
                  style={{
                    borderColor: sel ? h.color : "rgba(255,255,255,0.12)",
                    background: sel ? `linear-gradient(180deg, ${h.color}30, transparent)` : "rgba(255,255,255,0.03)",
                    boxShadow: sel ? `0 0 22px ${h.color}55` : "none",
                  }}
                >
                  <div className={sel && ok ? "animate-[float-y_2.2s_ease-in-out_infinite]" : ""}>
                    <HeroIcon hero={h} size={52} dim={!ok} />
                  </div>
                  <span className="mt-0.5 font-title text-[11px] sm:text-sm" style={{ color: ok ? h.color : "#6b6580" }}>
                    {h.name}
                  </span>
                  {!ok && (
                    <span className="absolute right-1 top-1 rounded bg-black/70 px-1 font-ui text-[9px] font-bold text-white/70">🔒 {h.unlockRoom}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-md bg-black/40 p-3">
            <div className="mb-2 flex items-baseline gap-2">
              <span className="font-title text-lg" style={{ color: hero.color }}>
                {hero.name}
              </span>
              <span className="font-ui text-[11px] font-bold tracking-[0.25em] text-white/40">{txt.role}</span>
            </div>
            {isUnlocked(hero, save.bestRoom) ? (
              <div className="flex flex-col gap-2">
                <Row label={tr(lang, "active")} color={hero.color} name={txt.active[0]} text={txt.active[1]} />
                <Row label={tr(lang, "throwL")} color="#ffe14a" name={txt.throwL[0]} text={txt.throwL[1]} />
                <Row label={tr(lang, "passive")} color="#c9b8ff" name={txt.passive[0]} text={txt.passive[1]} />
              </div>
            ) : (
              <p className="py-3 text-center font-ui text-sm font-semibold text-white/60">
                🔒 {tr(lang, "lockedHint", { n: hero.unlockRoom })}
                <span className="mt-1 block text-xs text-white/40">
                  {tr(lang, "bestRoom")}: {save.bestRoom} / {hero.unlockRoom}
                </span>
              </p>
            )}
          </div>
        </section>

        {/* name + stats */}
        <section className="flex w-full flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2">
            <span className="font-ui text-[11px] font-bold tracking-[0.25em] text-white/50">{tr(lang, "pilot")}</span>
            <input
              value={save.name}
              maxLength={10}
              onChange={(e) => p.onName(e.target.value.toUpperCase())}
              className="w-32 rounded border border-white/20 bg-black/50 px-2 py-1 font-title text-sm uppercase text-neon-yellow outline-none focus:border-neon-yellow"
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <div className="flex gap-4 font-ui text-xs text-white/60">
            <span>
              {tr(lang, "best")} <b className="font-title text-sm text-white">{best.toLocaleString()}</b>
            </span>
            <span>
              {tr(lang, "bestRoom")} <b className="font-title text-sm text-white">{save.bestRoom}</b>
            </span>
          </div>
        </section>

        {/* actions */}
        <div className="grid w-full grid-cols-2 gap-3">
          <button
            onClick={p.onPlay}
            disabled={!isUnlocked(hero, save.bestRoom)}
            className="col-span-2 animate-[pulse-ring_1.6s_infinite] rounded-md sm:col-span-1 bg-neon-pink px-6 py-4 font-title text-3xl tracking-wider text-[#07030f] shadow-[0_6px_0_#a3105f] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_2px_0_#a3105f] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ▶ {tr(lang, "play")}
          </button>
          <button
            onClick={p.onCoop}
            className="col-span-2 rounded-md border-2 border-neon-green bg-neon-green/15 px-4 py-3 font-title text-2xl sm:col-span-1 tracking-wide text-neon-green transition-colors hover:bg-neon-green/25"
          >
            👥 {lang === "fr" ? "EN ÉQUIPE" : "CO-OP"}
            <span className="block font-ui text-xs tracking-widest opacity-75">2 À 4 · CLAVIERS, MANETTES, TÉLÉPHONES · V</span>
          </button>
          <button
            onClick={p.onScores}
            className="rounded-md border-2 border-neon-cyan/70 bg-black/40 px-4 py-3 font-ui text-sm font-bold tracking-widest text-neon-cyan transition-colors hover:bg-neon-cyan/15"
          >
            🏆 {tr(lang, "scores")}
          </button>
          <button
            onClick={p.onHelp}
            className="rounded-md border-2 border-neon-yellow/70 bg-black/40 px-4 py-3 font-ui text-sm font-bold tracking-widest text-neon-yellow transition-colors hover:bg-neon-yellow/15"
          >
            ? {tr(lang, "howto")}
          </button>
        </div>

        <p className="text-center font-ui text-xs tracking-widest text-white/40">{tr(lang, "pressEnter")}</p>
        {p.portrait && <p className="text-center font-ui text-xs text-neon-yellow/80">📱 {tr(lang, "rotate")}</p>}
      </div>
    </div>
  );
}
