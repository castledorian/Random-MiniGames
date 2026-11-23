import { useCallback, useEffect, useRef, useState } from "react";
import { Game } from "@/game/engine";
import { HEROES, heroById } from "@/game/heroes";
import { addScore, cleanName, renameScore } from "@/game/storage";
import { VIEW_H, VIEW_W, layoutFor, type GameConfig, type GameSummary } from "@/game/types";
import TouchControls from "./TouchControls";
import { HeroCanvas, type AppCtx } from "./shared";

interface OverInfo {
  summary: GameSummary;
  rank: number;
  id: string;
  xpBefore: number;
  xpAfter: number;
  unlocked: string[];
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return m + ":" + (r < 10 ? "0" : "") + r;
}

export default function GameView({ app, cfg, onExit }: { app: AppCtx; cfg: GameConfig; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const appRef = useRef(app);
  appRef.current = app;
  const bankedRef = useRef(false);
  const overRef = useRef<OverInfo | null>(null);
  const overAtRef = useRef(0);
  const restartRef = useRef<() => void>(() => undefined);
  const layoutRef = useRef<() => void>(() => undefined);

  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState<OverInfo | null>(null);
  const [touch, setTouch] = useState(false);
  const [size, setSize] = useState({ w: VIEW_W, h: VIEW_H, top: -1, wide: false });
  const [nameDraft, setNameDraft] = useState("");

  const bank = useCallback((s: GameSummary): Omit<OverInfo, "summary"> | null => {
    if (bankedRef.current) return null;
    bankedRef.current = true;
    const a = appRef.current;
    let rank = -1;
    let id = "";
    if (s.score > 0) {
      const r = addScore({ name: cleanName(s.name || a.profile.name), score: s.score, hero: s.heroId, mode: s.mode, stage: s.stage });
      rank = r.rank;
      id = r.id;
    }
    const xpBefore = a.profile.xp;
    const xpAfter = xpBefore + s.xp;
    const unlocked = HEROES.filter((h) => h.unlockXp > xpBefore && h.unlockXp <= xpAfter).map((h) => h.id);
    a.updateProfile({ xp: xpAfter, games: a.profile.games + 1, best: Math.max(a.profile.best, s.score) });
    return { rank, id, xpBefore, xpAfter, unlocked };
  }, []);

  const restart = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    if (!bankedRef.current && g.state !== "over") {
      const s = g.buildSummary();
      if (s.score > 0 || s.xp > 0) bank(s);
    }
    bankedRef.current = false;
    overRef.current = null;
    setOver(null);
    setPaused(false);
    g.restart();
  }, [bank]);
  restartRef.current = restart;

  // Création / destruction du jeu
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = appRef.current;
    a.audio.ensure();
    a.audio.setMusic(a.profile.music);
    bankedRef.current = false;

    const game = new Game({
      canvas,
      cfg,
      input: a.input,
      audio: a.audio,
      cb: {
        onPauseChange: (p) => setPaused(p),
        onOver: (summary) => {
          const res = bank(summary) ?? { rank: -1, id: "", xpBefore: 0, xpAfter: 0, unlocked: [] };
          const info: OverInfo = { summary, ...res };
          overRef.current = info;
          overAtRef.current = performance.now();
          setNameDraft(appRef.current.profile.name);
          setOver(info);
        },
      },
    });
    gameRef.current = game;
    // accès console pour le débogage : window.__boom
    (window as unknown as { __boom?: Game }).__boom = game;
    a.input.captureKeys = true;
    a.input.onAnyInput = () => {
      if (overRef.current && performance.now() - overAtRef.current > 900) restartRef.current();
    };
    (document.activeElement as HTMLElement | null)?.blur?.();
    a.statusRef.current = (dev) => game.padStatus(dev);

    const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    if (coarse) {
      a.input.touch.active = true;
      setTouch(true);
      game.showHint = false;
    }
    const onTouchStart = () => {
      if (!a.input.touch.active) {
        a.input.touch.active = true;
        game.showHint = false;
        setTouch(true);
        layoutRef.current();
      }
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });

    const layout = () => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      let aw = W;
      let ah = H;
      if (a.input.touch.active) {
        if (H > W) ah = H - 240;
        else aw = W - 330;
      }
      // Écran large (PC) : scores des joueurs dans les 4 coins ; sinon bandeau en haut.
      // pas de colonnes latérales sur écran tactile (les commandes occupent les côtés)
      const wide = !a.input.touch.active && aw / ah >= 1.3;
      game.setWide(wide);
      const L = layoutFor(wide);
      const sc = Math.max(0.2, Math.min(aw / L.vw, ah / L.vh));
      const w = Math.floor(L.vw * sc);
      const h = Math.floor(L.vh * sc);
      // densité de pixels plafonnée (~3,5 Mpx) pour rester fluide sur les écrans 4K / Retina
      const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(3.5e6 / Math.max(1, w * h)));
      game.resize(w, h, Math.max(1, dpr));
      const portraitTouch = a.input.touch.active && H > W;
      setSize({ w, h, top: portraitTouch ? Math.max(8, Math.floor((H - 240 - h) / 2)) : -1, wide });
    };
    layoutRef.current = layout;
    layout();
    window.addEventListener("resize", layout);
    window.addEventListener("orientationchange", layout);

    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.code === "KeyR" && !e.repeat) {
        const g = gameRef.current;
        if (!g) return;
        if (g.paused || (overRef.current && performance.now() - overAtRef.current > 350)) restartRef.current();
      }
    };
    window.addEventListener("keydown", onKey);

    game.start();

    return () => {
      game.destroy();
      gameRef.current = null;
      a.input.captureKeys = false;
      a.input.onAnyInput = null;
      a.input.touch.active = false;
      a.input.touch.dx = 0;
      a.input.touch.dy = 0;
      a.statusRef.current = null;
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("resize", layout);
      window.removeEventListener("orientationchange", layout);
      window.removeEventListener("keydown", onKey);
    };
  }, [cfg, bank]);

  const getSkill = useCallback(() => {
    const p = gameRef.current?.humanPlayer();
    if (!p) return null;
    return { name: p.hero.skill.name, color: p.hero.color, remaining: Math.max(0, p.skillCd) / p.hero.skill.cd };
  }, []);

  const exit = () => {
    const g = gameRef.current;
    if (g && !bankedRef.current && g.state !== "over") {
      const s = g.buildSummary();
      if (s.score > 0 || s.xp > 0) bank(s);
    }
    onExit();
  };

  const commitName = () => {
    if (!over || over.rank < 0) return;
    const n = cleanName(nameDraft);
    setNameDraft(n);
    renameScore(over.id, n);
    app.updateProfile({ name: n });
  };

  const sum = over?.summary;
  const winner = sum && sum.winnerSlot !== null ? sum.standings.find((s) => s.slot === sum.winnerSlot) : null;
  const nextLocked = over ? HEROES.find((h) => h.unlockXp > over.xpAfter) : null;

  return (
    <div className="game-root" onContextMenu={(e) => e.preventDefault()}>
      <div style={{ position: "relative", alignSelf: size.top >= 0 ? "flex-start" : "center", marginTop: size.top >= 0 ? size.top : 0 }}>
        <canvas
          ref={canvasRef}
          style={{ width: size.w, height: size.h, display: "block", borderRadius: 10, boxShadow: "0 0 60px rgba(94,231,255,0.12)" }}
        />
      </div>

      {/* Boutons haut-droite */}
      <div className={size.wide ? "absolute left-1/2 top-1 z-20 flex -translate-x-1/2 gap-2 opacity-70 hover:opacity-100" : "absolute right-2 top-2 z-20 flex gap-2"}>
        <button
          className="btn btn-ghost btn-sm"
          aria-label="Son"
          onClick={() => {
            app.audio.ensure();
            app.updateProfile({ muted: !app.profile.muted });
          }}
        >
          {app.profile.muted ? "🔇" : "🔊"}
        </button>
        <button className="btn btn-ghost btn-sm" aria-label="Pause" onClick={() => gameRef.current?.togglePause()}>
          ⏸
        </button>
      </div>

      {touch && !paused && !over && <TouchControls input={app.input} getSkill={getSkill} />}

      {paused && !over && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/75 p-3">
          <div className="ui-zoom panel pop-in w-full max-w-sm p-6 text-center">
            <h2 className="logo-boom text-5xl">PAUSE</h2>
            <div className="mt-5 grid gap-3">
              <button className="btn" onClick={() => gameRef.current?.setPaused(false)}>
                ▶ Reprendre
              </button>
              <button className="btn btn-cyan" onClick={restart}>
                ↻ Recommencer <span className="kbd">R</span>
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    app.audio.ensure();
                    app.updateProfile({ muted: !app.profile.muted });
                  }}
                >
                  {app.profile.muted ? "🔇 Son coupé" : "🔊 Son actif"}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const m = !app.profile.music;
                    app.updateProfile({ music: m });
                    app.audio.setMusic(m);
                    if (m) app.audio.startMusic();
                  }}
                >
                  {app.profile.music ? "🎵 Musique" : "🎵 Coupée"}
                </button>
              </div>
              <button className="btn btn-ghost" onClick={exit}>
                ⌂ Menu principal
              </button>
            </div>
            <p className="mt-4 text-xs font-semibold text-[var(--muted)]">
              <span className="kbd">Échap</span> / <span className="kbd">P</span> / <b>Start</b> pour reprendre
            </p>
          </div>
        </div>
      )}

      {over && sum && (
        <div className="absolute inset-0 z-30 grid place-items-center overflow-auto bg-black/80 p-3">
          <div className="ui-zoom panel pop-in my-auto w-full max-w-xl p-5 text-center">
            <div className="text-xs font-black uppercase tracking-[0.3em] text-[var(--muted)]">{sum.mode === "solo" ? "Partie terminée" : "Match terminé"}</div>
            {sum.mode === "solo" ? (
              <h2 className="logo-boom text-[clamp(2.6rem,10vw,4.2rem)]">GAME OVER</h2>
            ) : winner ? (
              <>
                <h2 className="logo-boom text-[clamp(2.2rem,9vw,3.6rem)]">VICTOIRE !</h2>
                <div className="flex items-center justify-center gap-2 text-xl font-black uppercase" style={{ color: heroById(winner.heroId).color }}>
                  <HeroCanvas hero={heroById(winner.heroId)} size={50} walking />
                  {winner.kind === "human" ? "J" + (winner.slot + 1) + " · " : "CPU · "}
                  {heroById(winner.heroId).name}
                </div>
              </>
            ) : (
              <h2 className="logo-boom text-5xl">ÉGALITÉ</h2>
            )}

            <div className="mt-2 text-xs font-black uppercase tracking-widest text-[var(--muted)]">Score</div>
            <div className="text-5xl font-black text-[var(--yellow)]" style={{ textShadow: "0 4px 0 #8a5a00" }}>
              {sum.score.toLocaleString("fr-FR")}
            </div>

            {over.rank > 0 ? (
              <div className="mt-2">
                <span className="chip pulse-glow" style={{ color: "var(--yellow)", borderColor: "var(--yellow)" }}>
                  🏆 {over.rank === 1 ? "NOUVEAU RECORD !" : "Classement n°" + over.rank}
                </span>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <input
                    className="name-input"
                    value={nameDraft}
                    maxLength={12}
                    aria-label="Votre nom"
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      e.stopPropagation();
                    }}
                  />
                  <span className="text-xs font-bold text-[var(--muted)]">← votre nom</span>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-xs font-bold text-[var(--muted)]">Hors du top 10 — retentez votre chance !</div>
            )}

            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              {[
                [sum.mode === "solo" ? "Étape" : "Manches", sum.mode === "solo" ? String(sum.stage) : String(sum.rounds)],
                ["Caisses", String(sum.blocks)],
                ["KO", String(sum.kills)],
                ["Temps", fmtTime(sum.time)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-black/30 px-1 py-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">{k}</div>
                  <div className="text-xl font-black">{v}</div>
                </div>
              ))}
            </div>

            {sum.mode === "versus" && (
              <div className="mt-3 grid gap-1 text-left text-sm">
                {sum.standings.map((s, i) => (
                  <div key={s.slot} className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-1.5">
                    <span className="font-black" style={{ color: heroById(s.heroId).color }}>
                      {i + 1}. {s.kind === "human" ? "J" + (s.slot + 1) : "CPU"} · {heroById(s.heroId).name}
                    </span>
                    <span className="font-bold text-[var(--muted)]">
                      {s.wins} manche{s.wins > 1 ? "s" : ""} · {s.score.toLocaleString("fr-FR")} pts
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 rounded-xl bg-black/30 p-3 text-left">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                <span>⭐ +{sum.xp.toLocaleString("fr-FR")} XP</span>
                {nextLocked && (
                  <span>
                    Prochain : {nextLocked.name} ({over.xpAfter.toLocaleString("fr-FR")} / {nextLocked.unlockXp.toLocaleString("fr-FR")})
                  </span>
                )}
              </div>
              {nextLocked && (
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/40">
                  <div className="h-full rounded-full bg-[var(--yellow)]" style={{ width: Math.min(100, (over.xpAfter / nextLocked.unlockXp) * 100) + "%" }} />
                </div>
              )}
              {over.unlocked.map((id) => {
                const h = heroById(id);
                return (
                  <div key={id} className="pop-in mt-3 flex items-center gap-3 rounded-xl border-2 p-2" style={{ borderColor: h.color, background: "rgba(255,255,255,0.05)" }}>
                    <HeroCanvas hero={h} size={50} walking />
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-[var(--yellow)]">🔓 Nouveau héros débloqué !</div>
                      <div className="text-lg font-black uppercase" style={{ color: h.color }}>
                        {h.name} · {h.title}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {h.passive.name} / {h.skill.name}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button className="btn btn-lg" onClick={restart}>
                ↻ Rejouer
              </button>
              <button className="btn btn-ghost" onClick={onExit}>
                ⌂ Menu
              </button>
            </div>
            <div className="mt-3 text-xs font-semibold text-[var(--muted)]">
              Rejouer instantanément : <span className="kbd">R</span> · bouton BOMBE · <b>A</b>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
