import { useCallback, useEffect, useRef, useState } from "react";
import { audio } from "../game/audio";
import { SLOT_COLORS, type CoopPlayer } from "../game/game";
import { HEROES, heroById, type HeroId } from "../game/heroes";
import { deviceLabel, party } from "../game/partyInput";
import { link, phoneName } from "../padLink";
import { HeroIcon } from "./HeroIcon";
import { HERO_TEXT } from "./i18n";

interface Slot {
  device: string | null;
  hero: HeroId;
  ready: boolean;
}

const nameOf = (dev: string, i: number) => (dev.startsWith("ph:") ? phoneName(dev.slice(3)) : "J" + (i + 1));
const cycle = (h: HeroId, d: number): HeroId => {
  const ids = HEROES.map((x) => x.id);
  return ids[(ids.indexOf(h) + d + ids.length) % ids.length];
};

/** Salon de la partie en équipe : 1 à 4 joueurs (claviers, manettes, téléphones). */
export function CoopLobby({ onBack, onStart, onPair, padCount }: { onBack: () => void; onStart: (players: CoopPlayer[]) => void; onPair: () => void; padCount: number }) {
  const [slots, setSlots] = useState<Slot[]>(() => HEROES.map((h) => ({ device: null, hero: h.id, ready: false })));
  const slotsRef = useRef(slots);
  const prevX = useRef(new Map<string, number>());
  const started = useRef(false);

  const commit = useCallback((n: Slot[]) => {
    slotsRef.current = n;
    setSlots(n);
  }, []);

  const start = useCallback(() => {
    if (started.current) return;
    const list = slotsRef.current.map((s, i) => ({ s, i })).filter(({ s }) => s.device);
    if (list.length < 1) return;
    started.current = true;
    audio.init();
    audio.startMusic();
    onStart(list.map(({ s, i }) => ({ hero: s.hero, device: s.device!, name: nameOf(s.device!, i) })));
  }, [onStart]);
  const startRef = useRef(start);
  startRef.current = start;

  // ce que voient les téléphones
  useEffect(() => {
    link.status = (pid) => {
      const i = slotsRef.current.findIndex((s) => s.device === "ph:" + pid);
      if (i < 0) return { state: "lobby", joined: false };
      const s = slotsRef.current[i];
      return { state: "lobby", joined: true, ready: s.ready, hero: heroById(s.hero).name, color: SLOT_COLORS[i], slot: i };
    };
    return () => {
      link.status = () => ({ state: "menu" });
    };
  }, []);

  // lecture de tous les périphériques
  useEffect(() => {
    party.attach();
    party.flush();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      party.pollPads();
      const devs = party.devices();
      const next = slotsRef.current.map((s) => ({ ...s }));
      let changed = false;
      for (const dev of devs) {
        const r = party.read(dev);
        const dir = r.left ? -1 : r.right ? 1 : 0;
        const prev = prevX.current.get(dev) ?? 0;
        prevX.current.set(dev, dir);
        const si = next.findIndex((s) => s.device === dev);
        if (si < 0) {
          if (r.edges.has("attack") || r.edges.has("jump")) {
            const free = next.findIndex((s) => !s.device);
            if (free >= 0) {
              next[free] = { ...next[free], device: dev, ready: false };
              audio.play("ui");
              changed = true;
            }
          }
          continue;
        }
        const s = next[si];
        if (dir && !prev && !s.ready) {
          s.hero = cycle(s.hero, dir);
          audio.play("ui");
          changed = true;
        }
        if (r.edges.has("attack")) {
          s.ready = !s.ready;
          audio.play("ui");
          changed = true;
        } else if (r.edges.has("throw")) {
          if (s.ready) s.ready = false;
          else s.device = null;
          audio.play("ui");
          changed = true;
        }
      }
      const live = new Set(devs);
      next.forEach((s) => {
        if (s.device && !live.has(s.device)) {
          s.device = null;
          s.ready = false;
          changed = true;
        }
      });
      if (changed) commit(next);
      const cur = changed ? next : slotsRef.current;
      const joined = cur.filter((s) => s.device);
      if (joined.length >= 2 && joined.every((s) => s.ready)) startRef.current();
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      party.detach();
    };
  }, [commit]);

  // Échap : retour au menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  const edit = (i: number, fn: (s: Slot) => Slot) => {
    audio.init();
    audio.play("ui");
    const next = slotsRef.current.map((s) => ({ ...s }));
    next[i] = fn(next[i]);
    commit(next);
  };

  const joined = slots.filter((s) => s.device).length;

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#07030f]/92 [touch-action:pan-y]">
      <div className="ui-zoom mx-auto flex min-h-full max-w-5xl flex-col gap-3 p-3 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <button onClick={onBack} className="rounded border border-white/25 bg-black/50 px-3 py-1.5 font-ui text-sm font-bold tracking-widest text-white hover:bg-white/10">
            ◀ RETOUR
          </button>
          <h2 className="text-center font-title text-3xl text-neon-cyan [text-shadow:0_0_12px_#19e3ff,3px_3px_0_#07030f] sm:text-4xl">EN ÉQUIPE</h2>
          <button
            onClick={onPair}
            className={`rounded px-3 py-1.5 font-ui text-sm font-bold tracking-wide ${padCount ? "bg-[#38e08a] text-[#07210f]" : "bg-neon-pink text-[#07030f]"}`}
          >
            📱 {padCount ? `${padCount} téléphone${padCount > 1 ? "s" : ""}` : "AJOUTER UN TÉLÉPHONE"}
          </button>
        </div>

        <div className="rounded-md border border-white/10 bg-black/50 p-2.5 text-center font-ui text-sm text-white/85">
          <b className="text-neon-yellow">Rejoindre :</b> clavier A <kbd className="rounded bg-white/10 px-1.5">F</kbd> · clavier B{" "}
          <kbd className="rounded bg-white/10 px-1.5">L</kbd> · manette <kbd className="rounded bg-white/10 px-1.5">X</kbd> · téléphone <b className="text-neon-yellow">FRAPPE</b>.
          Puis ◀ ▶ pour le héros, <b className="text-neon-yellow">FRAPPE</b> = prêt, <b className="text-neon-yellow">LANCER</b> = quitter.
          <span className="mt-1 block text-xs text-white/55">Tous les héros sont disponibles · vies partagées · un joueur K.O. revient tant qu'il reste des vies.</span>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {slots.map((s, i) => {
            const h = heroById(s.hero);
            const on = !!s.device;
            const ht = HERO_TEXT.fr[h.id];
            return (
              <div
                key={i}
                className="flex min-w-0 flex-col items-center rounded-md border-2 bg-black/55 p-2.5"
                style={{ borderColor: on ? (s.ready ? "#38e08a" : SLOT_COLORS[i]) : "rgba(255,255,255,0.12)" }}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="rounded px-2 py-0.5 font-title text-sm text-[#07030f]" style={{ background: SLOT_COLORS[i] }}>
                    J{i + 1}
                  </span>
                  <span className="truncate pl-2 font-ui text-xs text-white/60">{s.device ? deviceLabel(s.device, phoneName) : "—"}</span>
                </div>
                {on ? (
                  <>
                    <div className="mt-1 flex w-full items-center justify-between">
                      <button className="rounded bg-white/10 px-2.5 py-1 disabled:opacity-30" disabled={s.ready} onClick={() => edit(i, (x) => ({ ...x, hero: cycle(x.hero, -1) }))} aria-label="Héros précédent">
                        ◀
                      </button>
                      <HeroIcon hero={h} size={64} />
                      <button className="rounded bg-white/10 px-2.5 py-1 disabled:opacity-30" disabled={s.ready} onClick={() => edit(i, (x) => ({ ...x, hero: cycle(x.hero, 1) }))} aria-label="Héros suivant">
                        ▶
                      </button>
                    </div>
                    <div className="font-title text-lg" style={{ color: h.color }}>
                      {h.name}
                    </div>
                    <div className="font-ui text-[10px] font-bold tracking-[0.2em] text-white/45">{ht.role}</div>
                    <div className="mt-0.5 line-clamp-2 min-h-[2.4em] text-center font-ui text-[11px] leading-tight text-white/70">
                      ⚡ {ht.active[0]} · 🎯 {ht.throwL[0]}
                    </div>
                    <div className="mt-2 flex w-full gap-1.5">
                      <button
                        className={`flex-1 rounded py-1.5 font-ui text-sm font-bold ${s.ready ? "bg-[#38e08a] text-[#07210f]" : "bg-neon-yellow text-[#07030f]"}`}
                        onClick={() => edit(i, (x) => ({ ...x, ready: !x.ready }))}
                      >
                        {s.ready ? "✔ PRÊT" : "JE SUIS PRÊT"}
                      </button>
                      <button className="rounded bg-white/10 px-2.5 py-1.5 text-sm" onClick={() => edit(i, (x) => ({ ...x, device: null, ready: false }))} aria-label="Retirer">
                        ✕
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[190px] items-center justify-center text-center font-ui text-sm text-white/50">
                    Appuie sur FRAPPE
                    <br />
                    pour rejoindre
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <button
            className="rounded-md bg-neon-pink px-10 py-3 font-title text-2xl tracking-wider text-[#07030f] shadow-[0_6px_0_#a3105f] active:translate-y-1 disabled:opacity-40"
            disabled={joined < 1}
            onClick={start}
          >
            ▶ COMBATTRE
          </button>
          <div className="text-center font-ui text-xs text-white/55">
            {joined < 1 ? "Personne n'a encore rejoint." : joined < 2 ? "Seul ? Tu peux lancer maintenant, ou attendre un ami." : "La partie démarre toute seule quand tout le monde est prêt."}
          </div>
        </div>
      </div>
    </div>
  );
}
