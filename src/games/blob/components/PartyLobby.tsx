import { useCallback, useEffect, useRef, useState } from 'react';
import { HEROES, heroById, type HeroId } from '../game/constants';
import { L } from '../game/i18n';
import { audio } from '../game/audio';
import { SLOT_COLORS, type PartyPlayer } from '../game/game';
import { deviceLabel, party } from '../game/partyInput';
import { link, phoneName } from '../padLink';
import { HeroPortrait } from './HeroPortrait';

const L_DIFF = [
  { label: 'Facile', v: 0.15 },
  { label: 'Normal', v: 0.5 },
  { label: 'Difficile', v: 0.85 },
];

interface Slot {
  device: string | null;
  hero: HeroId;
  ready: boolean;
  /** Bot ajouté à la souris (device null mais présent). */
  bot: boolean;
}

const nameOf = (dev: string, i: number) => (dev.startsWith('ph:') ? phoneName(dev.slice(3)) : 'J' + (i + 1));
const cycle = (h: HeroId, d: number): HeroId => {
  const ids = HEROES.map((x) => x.id);
  return ids[(ids.indexOf(h) + d + ids.length) % ids.length];
};

/** Salon du versus entre amis : 2 à 4 joueurs (claviers, manettes, téléphones) + bots. */
export default function PartyLobby({
  onBack,
  onStart,
  onPair,
  padCount,
  botLevel,
  onBotLevel,
}: {
  onBack: () => void;
  onStart: (players: PartyPlayer[]) => void;
  onPair: () => void;
  padCount: number;
  botLevel: number;
  onBotLevel: (v: number) => void;
}) {
  const [slots, setSlots] = useState<Slot[]>(() => HEROES.slice(0, 4).map((h) => ({ device: null, hero: h.id, ready: false, bot: false })));
  const slotsRef = useRef(slots);
  const levelRef = useRef(botLevel);
  levelRef.current = botLevel;
  const prevX = useRef(new Map<string, number>());
  const started = useRef(false);

  const commit = useCallback((n: Slot[]) => {
    slotsRef.current = n;
    setSlots(n);
  }, []);

  const start = useCallback(() => {
    if (started.current) return;
    const list = slotsRef.current.map((s, i) => ({ s, i })).filter(({ s }) => s.device || s.bot);
    if (list.length < 2 || !list.some(({ s }) => s.device)) return;
    started.current = true;
    onStart(
      list.map(({ s, i }) => ({
        hero: s.hero,
        device: s.device,
        name: s.device ? nameOf(s.device, i) : 'Bot ' + heroById(s.hero).name,
        level: levelRef.current,
      })),
    );
  }, [onStart]);
  const startRef = useRef(start);
  startRef.current = start;

  // ce que voient les téléphones
  useEffect(() => {
    link.status = (pid) => {
      const i = slotsRef.current.findIndex((s) => s.device === 'ph:' + pid);
      if (i < 0) return { state: 'lobby', joined: false };
      const s = slotsRef.current[i];
      const h = heroById(s.hero);
      return { state: 'lobby', joined: true, ready: s.ready, hero: h.name, color: SLOT_COLORS[i], slot: i };
    };
    return () => {
      link.status = () => ({ state: 'menu' });
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
          if (r.edges.has('drop') || r.edges.has('rot')) {
            const free = next.findIndex((s) => !s.device);
            if (free >= 0) {
              next[free] = { ...next[free], device: dev, ready: false, bot: false };
              audio.play('click');
              changed = true;
            }
          }
          continue;
        }
        const s = next[si];
        if (dir && !prev && !s.ready) {
          s.hero = cycle(s.hero, dir);
          audio.play('click');
          changed = true;
        }
        if (r.edges.has('drop') || r.edges.has('rot')) {
          s.ready = !s.ready;
          audio.play('click');
          changed = true;
        } else if (r.edges.has('skill')) {
          if (s.ready) s.ready = false;
          else s.device = null;
          audio.play('click');
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
      const humans = cur.filter((s) => s.device);
      const total = cur.filter((s) => s.device || s.bot).length;
      if (humans.length >= 1 && total >= 2 && humans.every((s) => s.ready)) startRef.current();
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      party.detach();
    };
  }, [commit]);

  const edit = (i: number, fn: (s: Slot) => Slot) => {
    audio.init();
    audio.play('click');
    const next = slotsRef.current.map((s) => ({ ...s }));
    next[i] = fn(next[i]);
    commit(next);
  };

  const humans = slots.filter((s) => s.device).length;
  const total = slots.filter((s) => s.device || s.bot).length;
  const canStart = humans >= 1 && total >= 2;

  return (
    <div className="menu-bg no-select fixed inset-0 z-30 overflow-y-auto">
      <div className="ui-zoom mx-auto flex min-h-full max-w-5xl flex-col gap-3 p-3 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <button className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 font-semibold transition hover:bg-white/20" onClick={onBack}>
            ◀ Retour
          </button>
          <h2 className="logo-text text-center text-4xl text-[#ffcf33] sm:text-5xl">VERSUS</h2>
          <button
            className={`rounded-full px-4 py-1.5 font-semibold transition hover:brightness-110 ${padCount ? 'bg-[#38e08a] text-[#0b2a18]' : 'bg-[#ff5c7a] text-white'}`}
            onClick={onPair}
          >
            📱 {padCount ? padCount + ' téléphone' + (padCount > 1 ? 's' : '') : 'Ajouter un téléphone'}
          </button>
        </div>

        <div className="panel rounded-2xl p-2.5 text-center text-sm text-white/85">
          <b className="text-[#ffe66b]">Rejoindre :</b> clavier A <kbd>Espace</kbd> · clavier B <kbd>Entrée</kbd> · manette <kbd>A</kbd> · téléphone{' '}
          <b className="text-[#ffb62e]">CHUTE</b>. Puis ◀ ▶ pour le héros, <b className="text-[#ffb62e]">CHUTE</b> = prêt, <b className="text-[#ffb62e]">POUVOIR</b> = quitter.
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {slots.map((s, i) => {
            const h = heroById(s.hero);
            const on = !!s.device || s.bot;
            return (
              <div
                key={i}
                className="panel flex min-w-0 flex-col items-center rounded-2xl border-2 p-2.5"
                style={{ borderColor: on ? (s.ready || s.bot ? '#38e08a' : SLOT_COLORS[i]) : 'rgba(255,255,255,0.12)' }}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="rounded-full px-2.5 py-0.5 text-sm font-bold text-[#120a2e]" style={{ background: SLOT_COLORS[i] }}>
                    {s.bot ? 'CPU' : 'J' + (i + 1)}
                  </span>
                  <span className="truncate pl-2 text-xs text-white/60">{s.device ? deviceLabel(s.device, phoneName) : s.bot ? '🤖 Bot' : '—'}</span>
                </div>
                {on ? (
                  <>
                    <div className="mt-1 flex w-full items-center justify-between">
                      <button className="rounded-lg bg-white/10 px-2.5 py-1 disabled:opacity-30" disabled={s.ready && !s.bot} onClick={() => edit(i, (x) => ({ ...x, hero: cycle(x.hero, -1) }))} aria-label="Héros précédent">
                        ◀
                      </button>
                      <HeroPortrait hero={h} size={84} mood={s.ready ? 'happy' : 'idle'} />
                      <button className="rounded-lg bg-white/10 px-2.5 py-1 disabled:opacity-30" disabled={s.ready && !s.bot} onClick={() => edit(i, (x) => ({ ...x, hero: cycle(x.hero, 1) }))} aria-label="Héros suivant">
                        ▶
                      </button>
                    </div>
                    <div className="text-xl font-bold" style={{ color: h.light }}>
                      {h.name}
                    </div>
                    <div className="line-clamp-2 min-h-[2.4em] text-center text-[11px] leading-tight text-white/65">⚡ {L(h.active.name)}</div>
                    <div className="mt-2 flex w-full gap-1.5">
                      {s.bot ? (
                        <div className="flex-1 rounded-full bg-white/10 py-1.5 text-center text-sm font-bold text-white/70">Bot</div>
                      ) : (
                        <button
                          className={`flex-1 rounded-full py-1.5 text-sm font-bold ${s.ready ? 'bg-[#38e08a] text-[#0b2a18]' : 'bg-[#ffd23f] text-[#3a1a00]'}`}
                          onClick={() => edit(i, (x) => ({ ...x, ready: !x.ready }))}
                        >
                          {s.ready ? '✔ Prêt' : 'Je suis prêt'}
                        </button>
                      )}
                      <button className="rounded-full bg-white/10 px-2.5 py-1.5 text-sm" onClick={() => edit(i, (x) => ({ ...x, device: null, ready: false, bot: false }))} aria-label="Retirer">
                        ✕
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center text-sm text-white/55">
                    <span>
                      Appuie sur CHUTE
                      <br />
                      pour rejoindre
                    </span>
                    <button className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/20" onClick={() => edit(i, (x) => ({ ...x, bot: true, ready: true }))}>
                      + Ajouter un bot
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="panel flex flex-wrap items-center justify-center gap-2 rounded-2xl p-2.5">
          <span className="text-xs font-bold tracking-widest text-white/60">NIVEAU DES BOTS</span>
          {L_DIFF.map((d) => (
            <button
              key={d.v}
              onClick={() => {
                audio.play('click');
                onBotLevel(d.v);
              }}
              className={`rounded-xl border px-3 py-1.5 text-sm font-bold ${Math.abs(botLevel - d.v) < 0.01 ? 'border-[#ff4d6d] bg-[#ff4d6d]/25' : 'border-white/15 bg-white/10 hover:bg-white/20'}`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <button
            className="btn-chunky flex items-center gap-2 rounded-full bg-gradient-to-b from-[#ffe66b] to-[#ffb62e] px-10 py-3 text-3xl font-bold text-[#3a1a00] shadow-[0_6px_0_#b8741a] disabled:opacity-40"
            disabled={!canStart}
            onClick={start}
          >
            ▶ COMBAT
          </button>
          <div className="text-center text-xs text-white/60">
            {!canStart ? 'Il faut au moins 2 joueurs (dont 1 humain) — ajoute un ami ou un bot.' : 'La partie démarre toute seule quand tous les humains sont prêts.'}
          </div>
        </div>
      </div>
    </div>
  );
}
