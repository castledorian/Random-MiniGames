import { useCallback, useEffect, useRef, useState } from "react";
import Backdrop from "./Backdrop";
import HeroPortrait from "./HeroPortrait";
import { HERO_LIST, HEROES, SLOT_COLORS, STAGES, type HeroId, type VersusConfig } from "../game/constants";
import { deviceLabel, input } from "../game/input";
import { audio } from "../game/audio";
import { link, phoneName } from "../padLink";

interface Slot {
  type: "human" | "bot" | "off";
  device: string | null;
  hero: HeroId;
  ready: boolean;
}

const DEFAULT: HeroId[] = ["volt", "ember", "kira", "basalt"];
const BOT_LEVELS = [
  { name: "Facile", level: 0.25 },
  { name: "Normal", level: 0.55 },
  { name: "Difficile", level: 0.85 },
];
const PREF_KEY = "riftbrawl.versus.v1";

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || "{}");
    return { stage: typeof p.stage === "number" ? p.stage : -1, stocks: typeof p.stocks === "number" ? p.stocks : 3, bot: typeof p.bot === "number" ? p.bot : 1 };
  } catch {
    return { stage: -1, stocks: 3, bot: 1 };
  }
}

interface Props {
  onBack: () => void;
  onStart: (cfg: VersusConfig) => void;
  onPair: () => void;
  padCount: number;
}

/** Salon versus : chacun rejoint avec son clavier, sa manette ou son téléphone. */
export default function VersusLobby({ onBack, onStart, onPair, padCount }: Props) {
  const [slots, setSlots] = useState<Slot[]>(() =>
    DEFAULT.map((h, i) => ({ type: i < 2 ? ("bot" as const) : ("off" as const), device: null, hero: h, ready: false })),
  );
  const slotsRef = useRef(slots);
  const [prefs, setPrefs] = useState(loadPrefs);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const startedRef = useRef(false);
  const prevDir = useRef(new Map<string, number>());

  const commit = useCallback((next: Slot[]) => {
    slotsRef.current = next;
    setSlots(next);
  }, []);

  const savePrefs = (p: typeof prefs) => {
    setPrefs(p);
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  };

  const nameFor = (s: Slot, i: number) => (s.device?.startsWith("ph:") ? phoneName(s.device.slice(3)) : "Joueur " + (i + 1));

  const start = useCallback(() => {
    if (startedRef.current) return;
    const cur = slotsRef.current;
    const players = cur
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.type !== "off")
      .map(({ s, i }) => ({
        slot: i,
        hero: s.hero,
        kind: s.type === "human" ? ("human" as const) : ("bot" as const),
        device: s.type === "human" ? s.device : null,
        name: s.type === "human" ? (s.device?.startsWith("ph:") ? phoneName(s.device.slice(3)) : "J" + (i + 1)) : HEROES[s.hero].name,
        level: BOT_LEVELS[prefsRef.current.bot]?.level ?? 0.55,
      }));
    if (players.length < 2 || !players.some((p) => p.kind === "human")) return;
    startedRef.current = true;
    audio.init();
    onStart({ players, stocks: prefsRef.current.stocks, stage: prefsRef.current.stage });
  }, [onStart]);
  const startRef = useRef(start);
  startRef.current = start;

  const nextHero = (list: Slot[], i: number, d: number): HeroId => {
    const idx = HERO_LIST.findIndex((h) => h.id === list[i].hero);
    return HERO_LIST[(idx + d + HERO_LIST.length) % HERO_LIST.length].id;
  };

  // Clavier : on transmet les touches au gestionnaire d'entrées
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Escape") {
        onBack();
        return;
      }
      if (input.keyDown(e)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => input.keyUp(e);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    input.reset();
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [onBack]);

  // Ce que voient les téléphones
  useEffect(() => {
    link.status = (pid) => {
      const i = slotsRef.current.findIndex((s) => s.type === "human" && s.device === "ph:" + pid);
      if (i < 0) return { state: "lobby", joined: false };
      const s = slotsRef.current[i];
      const h = HEROES[s.hero];
      return { state: "lobby", joined: true, ready: s.ready, hero: h.name, color: h.color, skill: h.special.name, slot: i };
    };
    return () => {
      link.status = () => ({ state: "menu" });
    };
  }, []);

  // Boucle de lecture de tous les périphériques
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      input.pollPad();
      input.padStartEdge = false;
      const next = slotsRef.current.map((s) => ({ ...s }));
      let changed = false;
      for (const dev of input.devices()) {
        const c = input.ctrlOf(dev);
        const dir = c.left ? -1 : c.right ? 1 : 0;
        const prev = prevDir.current.get(dev) ?? 0;
        prevDir.current.set(dev, dir);
        const si = next.findIndex((s) => s.type === "human" && s.device === dev);
        if (si < 0) {
          if (c.attackPress || c.jumpPress) {
            let free = next.findIndex((s) => s.type === "bot");
            if (free < 0) free = next.findIndex((s) => s.type === "off");
            if (free < 0) continue;
            next[free] = { ...next[free], type: "human", device: dev, ready: false };
            audio.play("select");
            changed = true;
          }
          continue;
        }
        const s = next[si];
        if (dir !== 0 && prev === 0 && !s.ready) {
          s.hero = nextHero(next, si, dir);
          audio.play("select");
          changed = true;
        }
        if (c.attackPress || c.jumpPress) {
          s.ready = !s.ready;
          audio.play(s.ready ? "start" : "select");
          changed = true;
        } else if (c.specialPress) {
          if (s.ready) s.ready = false;
          else next[si] = { ...s, type: "off", device: null };
          audio.play("select");
          changed = true;
        }
      }
      // périphériques débranchés
      const devs = new Set(input.devices());
      next.forEach((s, i) => {
        if (s.type === "human" && s.device && !devs.has(s.device)) {
          next[i] = { ...s, type: "off", device: null, ready: false };
          changed = true;
        }
      });
      input.clearEdges();
      if (changed) commit(next);
      const cur = changed ? next : slotsRef.current;
      const humans = cur.filter((s) => s.type === "human");
      const total = cur.filter((s) => s.type !== "off").length;
      if (humans.length >= 1 && humans.every((h) => h.ready) && total >= 2) startRef.current();
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [commit]);

  const edit = (i: number, fn: (s: Slot) => Slot) => {
    const next = slotsRef.current.map((s) => ({ ...s }));
    next[i] = fn(next[i]);
    audio.init();
    audio.play("select");
    commit(next);
  };

  const humans = slots.filter((s) => s.type === "human").length;
  const total = slots.filter((s) => s.type !== "off").length;
  const canStart = humans >= 1 && total >= 2;
  const stageName = prefs.stage < 0 ? "🎲 Aléatoire" : STAGES[prefs.stage].name;

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <Backdrop />
      <div className="thin-scroll relative z-10 min-h-0 flex-1 overflow-y-auto px-3 pb-8 pt-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <button className="btn-ghost px-4 py-2 text-sm" onClick={onBack}>
              ◀ Retour
            </button>
            <h2 className="title-logo text-3xl sm:text-5xl">VERSUS</h2>
            <button className={`btn-ghost px-4 py-2 text-sm ${padCount ? "!border-[#7cf5a1] !text-[#7cf5a1]" : ""}`} onClick={onPair}>
              📱 {padCount ? padCount + " téléphone" + (padCount > 1 ? "s" : "") : "Ajouter un téléphone"}
            </button>
          </div>

          <div className="glass p-3 text-center text-xs text-white/75 sm:text-sm">
            <b className="text-white">Rejoindre :</b> clavier A <span className="kbd-f">F</span> · clavier B <span className="kbd-f">Entrée</span> · manette{" "}
            <span className="kbd-f">A</span> · téléphone <b className="text-[#ff3ea5]">ATTAQUE</b>. Puis ◀ ▶ pour le héros, <b>ATTAQUE</b> (ou saut) pour être prêt, <b>SPÉCIAL</b> pour quitter.
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {slots.map((s, i) => {
              const h = HEROES[s.hero];
              const col = SLOT_COLORS[i];
              return (
                <div
                  key={i}
                  className="glass relative flex flex-col items-center p-3"
                  style={{ borderColor: s.type === "off" ? undefined : s.ready ? "#7cf5a1" : col, boxShadow: s.ready ? "0 0 24px #7cf5a155" : undefined }}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="font-display rounded-full px-2.5 py-0.5 text-sm text-[#0d0724]" style={{ background: col }}>
                      J{i + 1}
                    </span>
                    <span className="truncate pl-2 text-[11px] font-bold text-white/70">
                      {s.type === "human" ? deviceLabel(s.device!, phoneName) : s.type === "bot" ? "🤖 Bot" : "—"}
                    </span>
                  </div>
                  {s.type === "off" ? (
                    <div className="flex min-h-[210px] flex-col items-center justify-center gap-3 text-center text-sm text-white/50">
                      Appuie sur une touche
                      <br />
                      pour rejoindre
                      <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => edit(i, (x) => ({ ...x, type: "bot", ready: false }))}>
                        + Ajouter un bot
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex w-full items-center justify-between">
                        <button
                          className="btn-ghost px-3 py-2"
                          aria-label="Héros précédent"
                          disabled={s.ready}
                          onClick={() => edit(i, (x) => ({ ...x, hero: nextHero(slotsRef.current, i, -1) }))}
                        >
                          ◀
                        </button>
                        <HeroPortrait hero={h} active className="h-28 w-28 sm:h-32 sm:w-32" />
                        <button
                          className="btn-ghost px-3 py-2"
                          aria-label="Héros suivant"
                          disabled={s.ready}
                          onClick={() => edit(i, (x) => ({ ...x, hero: nextHero(slotsRef.current, i, 1) }))}
                        >
                          ▶
                        </button>
                      </div>
                      <div className="font-display text-xl" style={{ color: h.color }}>
                        {h.name}
                      </div>
                      <div className="text-[11px] text-white/60">
                        {s.type === "human" ? nameFor(s, i) + " · " : ""}
                        {h.special.name}
                      </div>
                      <div className="mt-2 flex w-full gap-2">
                        {s.type === "human" ? (
                          <>
                            <button className={`flex-1 px-2 py-2 text-sm ${s.ready ? "btn-primary" : "btn-ghost"}`} onClick={() => edit(i, (x) => ({ ...x, ready: !x.ready }))}>
                              <span>{s.ready ? "✔ Prêt" : "Je suis prêt"}</span>
                            </button>
                            <button className="btn-ghost px-3 py-2 text-sm" aria-label="Quitter" onClick={() => edit(i, (x) => ({ ...x, type: "off", device: null, ready: false }))}>
                              ✕
                            </button>
                          </>
                        ) : (
                          <button className="btn-ghost flex-1 px-2 py-2 text-sm" onClick={() => edit(i, (x) => ({ ...x, type: "off" }))}>
                            Retirer le bot
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "Arène",
                value: stageName,
                prev: () => savePrefs({ ...prefs, stage: prefs.stage <= -1 ? STAGES.length - 1 : prefs.stage - 1 }),
                next: () => savePrefs({ ...prefs, stage: prefs.stage >= STAGES.length - 1 ? -1 : prefs.stage + 1 }),
              },
              {
                label: "Vies",
                value: "♥ " + prefs.stocks,
                prev: () => savePrefs({ ...prefs, stocks: Math.max(1, prefs.stocks - 1) }),
                next: () => savePrefs({ ...prefs, stocks: Math.min(5, prefs.stocks + 1) }),
              },
              {
                label: "Bots",
                value: BOT_LEVELS[prefs.bot].name,
                prev: () => savePrefs({ ...prefs, bot: Math.max(0, prefs.bot - 1) }),
                next: () => savePrefs({ ...prefs, bot: Math.min(BOT_LEVELS.length - 1, prefs.bot + 1) }),
              },
            ].map((o) => (
              <div key={o.label} className="glass flex items-center gap-2 p-2">
                <button className="btn-ghost px-3 py-2" onClick={o.prev} aria-label={o.label + " : précédent"}>
                  ◀
                </button>
                <div className="min-w-0 flex-1 text-center">
                  <div className="section-label">{o.label}</div>
                  <div className="font-display truncate text-lg text-[#ffd23f]">{o.value}</div>
                </div>
                <button className="btn-ghost px-3 py-2" onClick={o.next} aria-label={o.label + " : suivant"}>
                  ▶
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-2">
            <button className="btn-primary animate-pulse-glow px-10 py-4 text-2xl disabled:opacity-40" disabled={!canStart} onClick={start}>
              <span>Combattre ▶</span>
            </button>
            <p className="text-center text-xs text-white/55">
              {humans < 1
                ? "Au moins un joueur doit rejoindre."
                : total < 2
                  ? "Ajoutez un adversaire (joueur ou bot)."
                  : "Le combat démarre tout seul quand tous les joueurs sont prêts. Maintenir ATTAQUE = attaque lourde !"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
