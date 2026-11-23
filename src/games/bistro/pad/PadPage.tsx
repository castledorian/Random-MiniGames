import { useCallback, useEffect, useRef, useState } from 'react';
import PadShell, { type PadView } from '@party/PadShell';
import { GAME_ID, PAD_BUTTONS } from '../padLink';

interface Status extends Record<string, unknown> {
  state?: string;
  hero?: string;
  color?: string;
  slot?: number;
  skill?: string;
  cd?: number;
  cdMax?: number;
  score?: number;
  holding?: string | null;
  solo?: boolean;
  joined?: boolean;
  ready?: boolean;
}

const SLOT = ['#22e6ff', '#ff3e5e', '#38e08a', '#ffd23f'];
const HELD: Record<string, string> = {
  bun: '🍞 pain',
  patty_raw: '🥩 steak cru',
  patty_cooked: '🍖 steak cuit',
  lettuce_raw: '🥬 salade',
  lettuce_chop: '🥬 salade coupée',
  tomato_raw: '🍅 tomate',
  tomato_chop: '🍅 tomate coupée',
  potato_raw: '🥔 patate',
  potato_chop: '🥔 bâtonnets',
  fries: '🍟 frites',
  burnt: '💨 brûlé',
  plate: '🍽 assiette',
};

/** Manette téléphone de Brawl Bistro : joystick analogique, PRENDRE, COUPER (maintenu), POUVOIR, CHANGER (solo), pause. */
export default function PadPage() {
  const cdEnd = useRef(0);
  const cdTotal = useRef(1);
  const [, force] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 200);
    return () => window.clearInterval(id);
  }, []);

  const onStatus = useCallback((s: Status) => {
    if (typeof s.cd === 'number' && typeof s.cdMax === 'number') {
      cdEnd.current = Date.now() + s.cd * 1000;
      cdTotal.current = Math.max(0.1, s.cdMax);
    }
  }, []);

  const view = (s: Status | null): PadView => {
    const slot = typeof s?.slot === 'number' && s.slot >= 0 ? s.slot : -1;
    const color = s?.color || (slot >= 0 ? SLOT[slot % 4] : '#ffd23f');
    const remaining = Math.max(0, (cdEnd.current - Date.now()) / 1000);
    const st = s?.state ?? 'menu';
    let line = 'En cuisine';
    let callout: string | undefined;
    if (st === 'menu') {
      line = 'Menu principal';
      callout = 'PRENDRE = co-op entre amis · POUVOIR = solo';
    } else if (st === 'lobby') {
      if (!s?.joined) {
        line = 'Salon co-op';
        callout = 'Appuie sur PRENDRE pour rejoindre !';
      } else line = s.ready ? '✔ Prêt — en attente des autres' : '◀ ▶ chef · PRENDRE = prêt · POUVOIR = quitter';
    } else if (st === 'spectator') {
      line = 'Spectateur';
      callout = 'Rejoins la prochaine partie depuis le salon';
    } else if (st === 'paused') {
      line = 'Pause';
      callout = 'PRENDRE = reprendre';
    } else if (st === 'over') {
      line = 'Service terminé';
      callout = 'Un bouton = rejouer';
    } else if (s?.holding) line = 'Tu portes : ' + (HELD[s.holding] ?? s.holding);
    const buttons: PadView['buttons'] = [
      { id: 0, label: 'Prendre', sub: 'poser · servir', color: '#ff8a3d', size: 36, right: 4, bottom: 5 },
      { id: 1, label: 'Couper', sub: 'maintenir', color: '#4be08a', size: 26, right: 40, bottom: 4, hold: true },
      {
        id: 2,
        label: s?.skill || 'Pouvoir',
        color: '#a46bff',
        size: 25,
        right: 13,
        bottom: 43,
        cooldown: remaining > 0 ? Math.min(1, remaining / cdTotal.current) : 0,
      },
    ];
    if (s?.solo) buttons.push({ id: 4, label: 'Changer', sub: 'de chef', color: '#22b8ff', size: 19, right: 40, bottom: 34 });
    return {
      color,
      badge: slot >= 0 ? 'J' + (slot + 1) : undefined,
      title: s?.hero,
      line,
      callout,
      pauseId: 3,
      extra:
        typeof s?.score === 'number' && st !== 'lobby' && st !== 'menu' ? (
          <div className="text-right text-2xl leading-none text-[#ffd23f]" style={{ textShadow: '0 2px 0 #000' }}>
            ★ {s.score}
          </div>
        ) : undefined,
      buttons,
    };
  };

  return (
    <PadShell<Status>
      gameId={GAME_ID}
      buttons={PAD_BUTTONS}
      accent="#ffd23f"
      joystick="analog"
      onStatus={onStatus}
      view={view}
      brand={
        <>
          <h1 className="title-text text-4xl leading-none">BRAWL BISTRO</h1>
          <div className="mt-1 text-lg tracking-widest text-[#4be08a]">MANETTE</div>
        </>
      }
    />
  );
}
