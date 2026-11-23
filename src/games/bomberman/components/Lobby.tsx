import { useCallback, useEffect, useRef, useState } from "react";
import { HEROES, SLOT_COLORS, heroById, isUnlocked } from "@/game/heroes";
import { deviceLabel } from "@/game/input";
import { LEVELS } from "@/game/levels";
import type { GameConfig } from "@/game/types";
import { HeroCanvas, type AppCtx } from "./shared";

interface Slot {
  type: "human" | "bot" | "off";
  device: string | null;
  hero: string;
  ready: boolean;
}

const DEFAULT_HEROES = ["ember", "volt", "terra", "frost"];

function nextHero(slots: Slot[], i: number, dir: number, xp: number): string {
  const human = slots[i].type === "human";
  const pool = HEROES.filter((h) => (human ? isUnlocked(h, xp) : true));
  const taken = new Set(slots.filter((s, k) => k !== i && s.type !== "off").map((s) => s.hero));
  const start = Math.max(0, pool.findIndex((h) => h.id === slots[i].hero));
  for (let k = 1; k <= pool.length; k++) {
    const h = pool[(start + dir * k + pool.length * 8) % pool.length];
    if (!taken.has(h.id)) return h.id;
  }
  return slots[i].hero;
}

export default function Lobby({ app, onBack, onStart }: { app: AppCtx; onBack: () => void; onStart: (cfg: GameConfig) => void }) {
  const { input, profile } = app;
  const [slots, setSlots] = useState<Slot[]>(() =>
    DEFAULT_HEROES.map((h) => ({ type: "bot" as const, device: null, hero: h, ready: false })),
  );
  const slotsRef = useRef(slots);
  const startedRef = useRef(false);
  const prevDx = useRef(new Map<string, number>());
  const xpRef = useRef(profile.xp);
  xpRef.current = profile.xp;
  const startRef = useRef<() => void>(() => undefined);
  const [level, setLevel] = useState<string>(() => {
    try {
      return localStorage.getItem("boomb_level") || "random";
    } catch {
      return "random";
    }
  });
  const levelRef = useRef(level);
  levelRef.current = level;
  const LEVEL_IDS = ["random", ...LEVELS.map((l) => l.id)];
  const cycleLevel = (d: number) => {
    const i = LEVEL_IDS.indexOf(level);
    const next = LEVEL_IDS[(i + d + LEVEL_IDS.length) % LEVEL_IDS.length];
    setLevel(next);
    app.audio.click();
    try {
      localStorage.setItem("boomb_level", next);
    } catch {
      /* ignore */
    }
  };
  const lv = LEVELS.find((l) => l.id === level);

  const commit = useCallback((next: Slot[]) => {
    slotsRef.current = next;
    setSlots(next);
  }, []);

  const start = useCallback(() => {
    if (startedRef.current) return;
    const cur = slotsRef.current;
    const humans = cur.filter((s) => s.type === "human").length;
    const total = cur.filter((s) => s.type !== "off").length;
    if (humans < 1 || total < 2) return;
    startedRef.current = true;
    const players = cur
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.type !== "off")
      .map(({ s, i }) => ({
        slot: i,
        heroId: s.hero,
        kind: s.type === "human" ? ("human" as const) : ("bot" as const),
        device: s.type === "human" ? s.device : null,
        name: s.type === "human" ? (s.device?.startsWith("ph:") ? input.phoneName(s.device) : i === 0 ? profile.name : "J" + (i + 1)) : heroById(s.hero).name,
      }));
    onStart({ mode: "versus", players, level: levelRef.current });
  }, [onStart, profile.name, input]);
  startRef.current = start;

  // Boucle de lecture des périphériques
  useEffect(() => {
    let raf = 0;
    let alive = true;
    const loop = () => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      input.poll();
      input.consumePause();
      const next = slotsRef.current.map((s) => ({ ...s }));
      let changed = false;

      input.states.forEach((st, dev) => {
        if (dev === "touch") return;
        const si = next.findIndex((s) => s.type === "human" && s.device === dev);
        if (si === -1) {
          if (st.bombEdge) {
            let free = next.findIndex((s) => s.type === "bot");
            if (free === -1) free = next.findIndex((s) => s.type === "off");
            if (free === -1) return;
            next[free].type = "human";
            next[free].device = dev;
            next[free].ready = false;
            const xp = xpRef.current;
            const wanted = free === 0 ? profile.hero : next[free].hero;
            const taken = next.some((s, k) => k !== free && s.type !== "off" && s.hero === wanted);
            if (!taken && isUnlocked(heroById(wanted), xp)) next[free].hero = wanted;
            else next[free].hero = nextHero(next, free, 1, xp);
            prevDx.current.set(dev, st.dx);
            app.audio.pickup();
            changed = true;
          }
          return;
        }
        const s = next[si];
        const prev = prevDx.current.get(dev) ?? 0;
        if (Math.abs(st.dx) >= 0.5 && Math.abs(prev) < 0.5 && !s.ready) {
          s.hero = nextHero(next, si, st.dx > 0 ? 1 : -1, xpRef.current);
          app.audio.click();
          changed = true;
        }
        prevDx.current.set(dev, st.dx);
        if (st.bombEdge) {
          s.ready = !s.ready;
          app.audio.click();
          changed = true;
        } else if (st.skillEdge) {
          if (s.ready) s.ready = false;
          else {
            s.type = "bot";
            s.device = null;
          }
          app.audio.click();
          changed = true;
        }
      });

      // périphériques déconnectés
      next.forEach((s) => {
        if (s.type === "human" && s.device && (s.device.startsWith("gp") || s.device.startsWith("ph:")) && !input.states.has(s.device)) {
          s.type = "bot";
          s.device = null;
          s.ready = false;
          changed = true;
        }
      });

      if (changed) commit(next);

      const cur = changed ? next : slotsRef.current;
      const humans = cur.filter((s) => s.type === "human");
      const total = cur.filter((s) => s.type !== "off").length;
      if (humans.length >= 1 && humans.every((h) => h.ready) && total >= 2) startRef.current();
    };
    loop();
    input.captureKeys = true;
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      input.captureKeys = false;
    };
  }, [input, commit, app.audio, profile.hero]);

  useEffect(() => {
    app.statusRef.current = (dev) => {
      const s = slotsRef.current.find((x) => x.type === "human" && x.device === dev);
      if (!s) return { state: "lobby", joined: false };
      const h = heroById(s.hero);
      return { state: "lobby", joined: true, ready: s.ready, hero: h.id, name: h.name, color: h.color, skill: h.skill.name, slot: slotsRef.current.indexOf(s) };
    };
    return () => {
      app.statusRef.current = null;
    };
  }, [app.statusRef]);

  const cycle = (i: number, d: number) => {
    const next = slotsRef.current.map((s) => ({ ...s }));
    next[i].hero = nextHero(next, i, d, profile.xp);
    app.audio.click();
    commit(next);
  };
  const toggleType = (i: number) => {
    const next = slotsRef.current.map((s) => ({ ...s }));
    if (next[i].type === "human") return;
    if (next[i].type === "bot") next[i].type = "off";
    else {
      next[i].type = "bot";
      next[i].hero = nextHero(next, i, 1, profile.xp);
    }
    app.audio.click();
    commit(next);
  };
  const release = (i: number) => {
    const next = slotsRef.current.map((s) => ({ ...s }));
    next[i].type = "bot";
    next[i].device = null;
    next[i].ready = false;
    app.audio.click();
    commit(next);
  };
  const toggleReady = (i: number) => {
    const next = slotsRef.current.map((s) => ({ ...s }));
    next[i].ready = !next[i].ready;
    app.audio.click();
    commit(next);
  };

  const humans = slots.filter((s) => s.type === "human").length;
  const total = slots.filter((s) => s.type !== "off").length;
  const canStart = humans >= 1 && total >= 2;

  return (
    <div className="screen grid-bg">
      <div className="relative mx-auto flex min-h-full max-w-6xl flex-col px-4 pb-8 pt-4">
        <div className="flex items-center justify-between gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            ◀ Retour
          </button>
          <h2 className="text-2xl font-black uppercase italic tracking-wider text-[var(--cyan)] sm:text-3xl">Versus local</h2>
          <button className="btn btn-pink btn-sm" onClick={app.openPair}>
            📱 {app.pads.length ? app.pads.length + " connectée(s)" : "Ajouter un téléphone"}
          </button>
        </div>

        <div className="panel mt-4 px-4 py-3 text-sm font-semibold text-[var(--muted)]">
          <b className="text-[var(--ink)]">Rejoindre :</b> appuyez sur <span className="kbd">Espace</span> (clavier A · ZQSD/WASD), <span className="kbd">Entrée</span> (clavier B ·
          flèches), le bouton <span className="kbd">A</span> d&apos;une manette, ou <b className="text-[var(--pink)]">BOMBE</b> sur un téléphone connecté. Puis
          ◀ ▶ pour choisir son héros et <b>BOMBE</b> pour être prêt. <span className="kbd">Skill</span> pour quitter.
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {slots.map((s, i) => {
            const hero = heroById(s.hero);
            const col = SLOT_COLORS[i];
            return (
              <div key={i} className="panel pop-in flex flex-col items-center p-3" style={{ borderColor: s.type === "human" ? col : undefined, animationDelay: i * 0.05 + "s" }}>
                <div className="flex w-full items-center justify-between">
                  <span className="chip" style={{ color: col, borderColor: col }}>
                    J{i + 1}
                  </span>
                  <span className="chip text-[11px]">{s.type === "human" && s.device ? deviceLabel(s.device, input) : s.type === "bot" ? "🤖 Bot" : "Vide"}</span>
                </div>

                {s.type === "off" ? (
                  <div className="grid h-44 place-items-center text-center text-sm font-bold text-[var(--muted)]">
                    <div>
                      Emplacement libre
                      <br />
                      <span className="text-xs">Appuyez sur une touche pour rejoindre</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mt-1 flex items-center gap-1">
                      <button className="btn btn-ghost btn-sm" onClick={() => cycle(i, -1)} aria-label="Héros précédent">
                        ◀
                      </button>
                      <HeroCanvas hero={hero} size={78} walking={s.ready} />
                      <button className="btn btn-ghost btn-sm" onClick={() => cycle(i, 1)} aria-label="Héros suivant">
                        ▶
                      </button>
                    </div>
                    <div className="-mt-2 text-lg font-black uppercase tracking-wider" style={{ color: hero.color }}>
                      {hero.name}
                    </div>
                    <div className="text-[11px] font-bold text-[var(--muted)]">{hero.title}</div>
                    <div className="mt-2 w-full rounded-xl bg-black/30 p-2 text-[11px] leading-snug">
                      <div>
                        <b className="text-[var(--yellow)]">Passif · {hero.passive.name}</b>
                        <br />
                        <span className="text-[var(--muted)]">{hero.passive.desc}</span>
                      </div>
                      <div className="mt-1">
                        <b className="text-[var(--cyan)]">Actif · {hero.skill.name}</b>
                        <br />
                        <span className="text-[var(--muted)]">{hero.skill.desc}</span>
                      </div>
                    </div>
                  </>
                )}

                <div className="mt-2 flex w-full gap-2">
                  {s.type === "human" ? (
                    <>
                      <button className={`btn btn-sm flex-1 ${s.ready ? "" : "btn-cyan"}`} onClick={() => toggleReady(i)}>
                        {s.ready ? "✓ Prêt" : "Je suis prêt"}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => release(i)} aria-label="Quitter l'emplacement">
                        ✕
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-ghost btn-sm flex-1" onClick={() => toggleType(i)}>
                      {s.type === "bot" ? "Retirer le bot" : "Ajouter un bot"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="panel mx-auto mt-5 flex w-full max-w-xl items-center gap-3 p-3" style={{ borderColor: lv ? lv.portal + "88" : undefined }}>
          <button className="btn btn-ghost btn-sm" onClick={() => cycleLevel(-1)} aria-label="Arène précédente">
            ◀
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">Arène</div>
            <div className="text-xl font-black uppercase italic" style={{ color: lv ? lv.portal : "var(--yellow)" }}>
              {lv ? lv.name : "🎲 Aléatoire"}
            </div>
            <div className="text-xs font-semibold text-[var(--muted)]">{lv ? lv.desc : "Une arène différente à chaque manche."}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => cycleLevel(1)} aria-label="Arène suivante">
            ▶
          </button>
        </div>

        <div className="mt-5 flex flex-col items-center gap-2">
          <button className="btn btn-lg" disabled={!canStart} onClick={start}>
            ⚔ Lancer le combat
          </button>
          <div className="text-xs font-bold text-[var(--muted)]">
            {humans < 1 ? "Au moins un joueur humain doit rejoindre." : total < 2 ? "Ajoutez un adversaire (bot ou joueur)." : "Premier à 2 manches · mort subite après 85 s · le combat démarre quand tous les joueurs sont prêts."}
          </div>
        </div>
      </div>
    </div>
  );
}
