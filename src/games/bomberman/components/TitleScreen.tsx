import { useEffect, useRef } from "react";
import { HEROES, heroById, isUnlocked } from "@/game/heroes";
import { HeroCanvas, type AppCtx } from "./shared";

interface Props {
  app: AppCtx;
  onPlay: () => void;
  onVersus: () => void;
  onHeroes: () => void;
  onScores: () => void;
  onHow: () => void;
}

export default function TitleScreen({ app, onPlay, onVersus, onHeroes, onScores, onHow }: Props) {
  const playRef = useRef(onPlay);
  playRef.current = onPlay;
  const { input, profile } = app;

  // Manette / téléphone : un appui sur BOMBE lance la partie immédiatement
  useEffect(() => {
    let raf = 0;
    let alive = true;
    const loop = () => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      input.poll();
      input.consumePause();
      input.states.forEach((st, id) => {
        if ((id.startsWith("gp") || id.startsWith("ph:")) && st.bombEdge) playRef.current();
      });
    };
    loop();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [input]);

  useEffect(() => {
    app.statusRef.current = () => ({ state: "menu" });
    return () => {
      app.statusRef.current = null;
    };
  }, [app.statusRef]);

  const unlocked = HEROES.filter((h) => isUnlocked(h, profile.xp));
  const hero = heroById(profile.hero);
  const idx = Math.max(0, unlocked.findIndex((h) => h.id === hero.id));
  const cycle = (d: number) => {
    const n = unlocked[(idx + d + unlocked.length) % unlocked.length];
    app.audio.click();
    app.updateProfile({ hero: n.id });
  };

  const next = HEROES.find((h) => !isUnlocked(h, profile.xp));

  return (
    <div className="screen grid-bg">
      <div className="bomb-deco" style={{ width: 90, height: 90, left: "6%", top: "14%", animationDelay: "0s" }} />
      <div className="bomb-deco" style={{ width: 60, height: 60, right: "9%", top: "22%", animationDelay: "-2s" }} />
      <div className="bomb-deco" style={{ width: 120, height: 120, right: "14%", bottom: "8%", animationDelay: "-4s" }} />
      <div className="bomb-deco" style={{ width: 44, height: 44, left: "12%", bottom: "14%", animationDelay: "-1s" }} />

      <div className="relative mx-auto flex min-h-full max-w-5xl flex-col items-center px-4 pb-8 pt-4">
        <div className="flex w-full items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <a className="btn btn-ghost btn-sm" href="../" title="Retour au choix du jeu">
              ◀ Tous les jeux
            </a>
            <span className="chip" title="Points d'expérience cumulés : débloquent de nouveaux héros">
              ⭐ {profile.xp.toLocaleString("fr-FR")} XP
            </span>
          </span>
          <div className="flex gap-2">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                app.audio.ensure();
                app.updateProfile({ muted: !profile.muted });
              }}
              aria-label="Activer / couper le son"
            >
              {profile.muted ? "🔇 Son coupé" : "🔊 Son"}
            </button>
          </div>
        </div>

        <header className="mt-2 text-center sm:mt-6">
          <h1 className="logo-boom text-[clamp(4rem,16vw,9rem)]">BOOM</h1>
          <div className="logo-sub -mt-1 text-[clamp(1.1rem,4.4vw,2.2rem)]">BRAWLERS</div>
          <p className="mt-3 max-w-xl text-sm font-semibold text-[var(--muted)] sm:text-base">
            L&apos;arène explosive pour 1 à 4 joueurs. Clavier, manette ou <b className="text-[var(--cyan)]">téléphone en manette</b> en
            scannant un QR code.
          </p>
        </header>

        <div className="mt-6 flex flex-col items-center gap-3 sm:mt-8">
          <div className="flex items-center gap-3">
            <button className="btn btn-ghost btn-sm" onClick={() => cycle(-1)} aria-label="Héros précédent" disabled={unlocked.length < 2}>
              ◀
            </button>
            <div className="flex w-56 flex-col items-center">
              <HeroCanvas hero={hero} size={86} walking />
              <div className="-mt-3 text-lg font-black uppercase tracking-wider" style={{ color: hero.color }}>
                {hero.name}
              </div>
              <div className="text-xs font-bold text-[var(--muted)]">
                {hero.passive.name} · <span className="text-[var(--ink)]">{hero.skill.name}</span>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => cycle(1)} aria-label="Héros suivant" disabled={unlocked.length < 2}>
              ▶
            </button>
          </div>

          <button className="btn btn-lg pulse-glow mt-1" autoFocus onClick={onPlay}>
            ▶ Jouer
          </button>
          <div className="text-xs font-bold text-[var(--muted)]">
            Solo contre des bots · <span className="kbd">Entrée</span> ou bouton <b>A</b> de la manette
          </div>

          <div className="mt-2 grid w-full max-w-md grid-cols-2 gap-3">
            <button className="btn btn-cyan" onClick={onVersus}>
              👥 Versus local
            </button>
            <button className="btn btn-pink" onClick={app.openPair}>
              📱 Manette phone
            </button>
            <button className="btn btn-ghost" onClick={onHeroes}>
              🦸 Héros
            </button>
            <button className="btn btn-ghost" onClick={onScores}>
              🏆 Scores
            </button>
            <button className="btn btn-ghost col-span-2" onClick={onHow}>
              ❓ Comment jouer
            </button>
          </div>
        </div>

        <div className="mt-8 w-full max-w-3xl">
          <div className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
            <span>Roster</span>
            {next && (
              <span>
                Prochain héros : <span className="text-[var(--ink)]">{next.name}</span> à {next.unlockXp.toLocaleString("fr-FR")} XP
              </span>
            )}
          </div>
          <div className="flex justify-between gap-1 rounded-2xl border border-white/10 bg-black/25 px-2 py-1">
            {HEROES.map((h) => (
              <div key={h.id} className="flex flex-col items-center">
                <HeroCanvas hero={h} size={44} locked={!isUnlocked(h, profile.xp)} facing={2} />
                <span className="-mt-2 text-[10px] font-black uppercase" style={{ color: isUnlocked(h, profile.xp) ? h.color : "#56608c" }}>
                  {isUnlocked(h, profile.xp) ? h.name : "🔒"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
