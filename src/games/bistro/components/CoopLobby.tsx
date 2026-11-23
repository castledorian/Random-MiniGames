import { useCallback, useEffect, useRef, useState } from 'react';
import { HEROES, HERO_IDS, KITCHENS, type HeroId } from '../game/config';
import type { Controls } from '../game/input';
import { audio } from '../game/audio';
import { SLOT_COLORS } from '../game/render';
import { link, phoneName } from '../padLink';
import { ChefAvatar } from './Screens';

export interface CoopSetup {
  heroes: HeroId[];
  devices: string[];
  names: string[];
  kitchen: string;
}

interface Slot {
  device: string | null;
  hero: HeroId;
  ready: boolean;
}

function deviceLabel(dev: string): string {
  if (dev === 'kbA') return '⌨ Clavier A';
  if (dev === 'kbB') return '⌨ Clavier B';
  if (dev.startsWith('gp')) return '🎮 Manette ' + (Number(dev.slice(2)) + 1);
  if (dev.startsWith('ph:')) return '📱 ' + phoneName(dev.slice(3));
  return dev;
}

const nameOf = (dev: string, i: number) => (dev.startsWith('ph:') ? phoneName(dev.slice(3)) : 'J' + (i + 1));

/** Salon co-op : 2 à 4 cuisiniers, chacun avec son clavier, sa manette ou son téléphone. */
export default function CoopLobby({
  controls,
  kitchen,
  onKitchen,
  onBack,
  onStart,
  onPair,
  padCount,
}: {
  controls: Controls;
  kitchen: string;
  onKitchen: (id: string) => void;
  onBack: () => void;
  onStart: (s: CoopSetup) => void;
  onPair: () => void;
  padCount: number;
}) {
  const [slots, setSlots] = useState<Slot[]>(() => HERO_IDS.concat('blitz').slice(0, 4).map((h) => ({ device: null, hero: h as HeroId, ready: false })));
  const slotsRef = useRef(slots);
  const kitchenRef = useRef(kitchen);
  kitchenRef.current = kitchen;
  const prevX = useRef(new Map<string, number>());
  const started = useRef(false);

  const commit = useCallback((n: Slot[]) => {
    slotsRef.current = n;
    setSlots(n);
  }, []);

  const start = useCallback(() => {
    if (started.current) return;
    const joined = slotsRef.current.filter((s) => s.device);
    if (joined.length < 2) return;
    started.current = true;
    onStart({
      heroes: joined.map((s) => s.hero),
      devices: joined.map((s) => s.device!),
      names: joined.map((s) => nameOf(s.device!, slotsRef.current.indexOf(s))),
      kitchen: kitchenRef.current,
    });
  }, [onStart]);
  const startRef = useRef(start);
  startRef.current = start;

  const cycleHero = (h: HeroId, d: number): HeroId => HERO_IDS[(HERO_IDS.indexOf(h) + d + HERO_IDS.length) % HERO_IDS.length];

  // ce que voient les téléphones
  useEffect(() => {
    link.status = (pid) => {
      const i = slotsRef.current.findIndex((s) => s.device === 'ph:' + pid);
      if (i < 0) return { state: 'lobby', joined: false };
      const s = slotsRef.current[i];
      return { state: 'lobby', joined: true, ready: s.ready, hero: HEROES[s.hero].name, color: HEROES[s.hero].color, slot: i };
    };
    return () => {
      link.status = () => ({ state: 'menu' });
    };
  }, []);

  // lecture de tous les périphériques
  useEffect(() => {
    let raf = 0;
    controls.clearLatches();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const devs = controls.devices();
      const inputs = controls.pollDevices(devs);
      const next = slotsRef.current.map((s) => ({ ...s }));
      let changed = false;
      devs.forEach((dev, k) => {
        const inp = inputs[k];
        const dir = inp.mx < -0.6 ? -1 : inp.mx > 0.6 ? 1 : 0;
        const prev = prevX.current.get(dev) ?? 0;
        prevX.current.set(dev, dir);
        const si = next.findIndex((s) => s.device === dev);
        if (si < 0) {
          if (inp.grab) {
            const free = next.findIndex((s) => !s.device);
            if (free >= 0) {
              next[free].device = dev;
              next[free].ready = false;
              audio.ui();
              changed = true;
            }
          }
          return;
        }
        const s = next[si];
        if (dir && !prev && !s.ready) {
          s.hero = cycleHero(s.hero, dir);
          audio.ui();
          changed = true;
        }
        if (inp.grab) {
          s.ready = !s.ready;
          audio.ui();
          changed = true;
        } else if (inp.dash) {
          if (s.ready) s.ready = false;
          else s.device = null;
          audio.ui();
          changed = true;
        }
      });
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
    return () => cancelAnimationFrame(raf);
  }, [controls, commit]);

  const edit = (i: number, fn: (s: Slot) => Slot) => {
    audio.init();
    audio.ui();
    const next = slotsRef.current.map((s) => ({ ...s }));
    next[i] = fn(next[i]);
    commit(next);
  };

  const joined = slots.filter((s) => s.device).length;
  const ki = Math.max(0, KITCHENS.findIndex((k) => k.id === kitchen));
  const kc = KITCHENS[ki];

  return (
    <div className="scroll-y absolute inset-0 z-40 bg-[#0d1030]/85 backdrop-blur-[3px]">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-3 p-3 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <button className="btn btn-ghost px-4 py-1.5 text-base" onClick={onBack}>
            ◀ Retour
          </button>
          <h2 className="title-text text-4xl sm:text-5xl">CO-OP</h2>
          <button className={`btn px-4 py-1.5 text-base ${padCount ? 'btn-mint' : 'btn-berry'}`} onClick={onPair}>
            📱 {padCount ? padCount + ' téléphone' + (padCount > 1 ? 's' : '') : 'Ajouter un téléphone'}
          </button>
        </div>

        <div className="panel p-2.5 text-center text-sm text-[#dfe5ff]">
          <span className="text-sun">Rejoindre :</span> clavier A <kbd>E</kbd> · clavier B <kbd>Entrée</kbd> · manette <kbd>A</kbd> · téléphone{' '}
          <span className="text-tangerine">PRENDRE</span>. Puis ◀ ▶ pour le chef, <span className="text-tangerine">PRENDRE</span> = prêt,{' '}
          <span className="text-tangerine">POUVOIR</span> = quitter.
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {slots.map((s, i) => {
            const h = HEROES[s.hero];
            return (
              <div
                key={i}
                className="panel flex flex-col items-center p-2.5"
                style={{ borderColor: s.device ? (s.ready ? '#4be08a' : SLOT_COLORS[i]) : undefined, boxShadow: s.ready ? '0 0 22px #4be08a66' : undefined }}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="rounded-full px-2.5 py-0.5 text-sm text-ink" style={{ background: SLOT_COLORS[i] }}>
                    J{i + 1}
                  </span>
                  <span className="truncate pl-2 text-xs text-[#b9c4f2]">{s.device ? deviceLabel(s.device) : '—'}</span>
                </div>
                {s.device ? (
                  <>
                    <div className="mt-1 flex w-full items-center justify-between">
                      <button className="btn btn-ghost px-3 py-1" disabled={s.ready} onClick={() => edit(i, (x) => ({ ...x, hero: cycleHero(x.hero, -1) }))} aria-label="Chef précédent">
                        ◀
                      </button>
                      <ChefAvatar hero={h} size={70} animate />
                      <button className="btn btn-ghost px-3 py-1" disabled={s.ready} onClick={() => edit(i, (x) => ({ ...x, hero: cycleHero(x.hero, 1) }))} aria-label="Chef suivant">
                        ▶
                      </button>
                    </div>
                    <div className="text-xl" style={{ color: h.color }}>
                      {h.name}
                    </div>
                    <div className="text-center text-[11px] leading-tight text-[#b9c4f2]">
                      {h.role} · ⚡ {h.abilityName}
                    </div>
                    <div className="mt-2 flex w-full gap-1.5">
                      <button className={`btn flex-1 py-1.5 text-sm ${s.ready ? 'btn-mint' : 'btn-sun'}`} onClick={() => edit(i, (x) => ({ ...x, ready: !x.ready }))}>
                        {s.ready ? '✔ Prêt' : 'Je suis prêt'}
                      </button>
                      <button className="btn btn-ghost px-2.5 py-1.5 text-sm" onClick={() => edit(i, (x) => ({ ...x, device: null, ready: false }))} aria-label="Quitter">
                        ✕
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[190px] items-center justify-center text-center text-sm text-[#8f9bd0]">
                    Appuie sur PRENDRE
                    <br />
                    pour rejoindre
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="panel flex items-center gap-3 p-2.5">
          <button className="btn btn-ghost px-3 py-1.5" onClick={() => onKitchen(KITCHENS[(ki + KITCHENS.length - 1) % KITCHENS.length].id)} aria-label="Cuisine précédente">
            ◀
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="text-xs tracking-widest text-[#9aa6dd]">CUISINE</div>
            <div className="text-2xl text-sun">{kc.name}</div>
            <div className="text-xs text-[#c7d0f5]">{kc.desc}</div>
          </div>
          <button className="btn btn-ghost px-3 py-1.5" onClick={() => onKitchen(KITCHENS[(ki + 1) % KITCHENS.length].id)} aria-label="Cuisine suivante">
            ▶
          </button>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <button className="btn btn-sun anim-glow px-10 py-3 text-3xl disabled:opacity-40" disabled={joined < 2} onClick={start}>
            ▶ CUISINER
          </button>
          <div className="text-center text-xs text-[#9aa6dd]">
            {joined < 2 ? 'Il faut au moins 2 cuisiniers.' : 'La partie démarre toute seule quand tout le monde est prêt.'}
          </div>
        </div>
      </div>
    </div>
  );
}
