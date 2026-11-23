import PadShell, { type PadView } from '@party/PadShell';
import { GAME_ID, PAD_BUTTONS } from '../padLink';

interface Status extends Record<string, unknown> {
  state?: string;
  hero?: string;
  color?: string;
  slot?: number;
  energy?: number;
  score?: number;
  out?: boolean;
  joined?: boolean;
  ready?: boolean;
}

const SLOT = ['#22e6ff', '#ff3e5e', '#38e08a', '#ffd23f'];

/** Manette téléphone de Blob Brawl : croix (◀ ▶ déplacer, ▼ accélérer, ▲ chute), TOURNER, TOURNER ←, CHUTE, POUVOIR, pause. */
export default function PadPage() {
  const view = (s: Status | null): PadView => {
    const slot = typeof s?.slot === 'number' && s.slot >= 0 ? s.slot : -1;
    const color = s?.color || (slot >= 0 ? SLOT[slot % 4] : '#ffcf33');
    const st = s?.state ?? 'menu';
    const energy = typeof s?.energy === 'number' ? s.energy : 0;
    let line = '◀ ▶ déplacer · ▼ accélérer · ▲ chute';
    let callout: string | undefined;
    if (st === 'menu') {
      line = 'Menu principal';
      callout = "Choisis « Versus entre amis » sur l'écran";
    } else if (st === 'lobby') {
      if (!s?.joined) {
        line = 'Salon versus';
        callout = 'Appuie sur CHUTE pour rejoindre !';
      } else line = s.ready ? '✔ Prêt — en attente des autres' : '◀ ▶ héros · CHUTE = prêt · POUVOIR = quitter';
    } else if (st === 'spectator') {
      line = 'Spectateur';
      callout = 'Rejoins la prochaine partie depuis le salon';
    } else if (st === 'paused') {
      line = 'Pause';
      callout = 'Bouton pause = reprendre';
    } else if (st === 'over') {
      line = 'Partie terminée';
      callout = 'Un bouton = revanche';
    } else if (s?.out) {
      line = 'K.O. !';
      callout = 'Attends la fin de la manche';
    }
    return {
      color,
      badge: slot >= 0 ? 'J' + (slot + 1) : undefined,
      title: s?.hero,
      line,
      callout,
      pauseId: 3,
      extra:
        st === 'playing' ? (
          <div className="text-right text-2xl leading-none font-bold text-[#ffe66b]" style={{ textShadow: '0 2px 0 #000' }}>
            ⚡ {energy >= 100 ? 'PRÊT' : energy + '%'}
          </div>
        ) : undefined,
      buttons: [
        { id: 0, label: 'Tourner', sub: '↻', color: '#22b8ff', size: 34, right: 5, bottom: 6 },
        { id: 4, label: 'Tourner', sub: '↺', color: '#7a6bff', size: 24, right: 40, bottom: 4 },
        { id: 1, label: 'Chute', sub: 'poser', color: '#ff8a3d', size: 24, right: 37, bottom: 36 },
        {
          id: 2,
          label: 'Pouvoir',
          sub: energy >= 100 ? 'prêt !' : undefined,
          color: energy >= 100 ? '#ffd23f' : '#a46bff',
          size: 24,
          right: 8,
          bottom: 45,
          cooldown: st === 'playing' && energy < 100 ? 1 - energy / 100 : 0,
        },
      ],
    };
  };

  return (
    <PadShell<Status>
      gameId={GAME_ID}
      buttons={PAD_BUTTONS}
      accent="#ffcf33"
      joystick="four"
      view={view}
      brand={
        <>
          <h1 className="logo-text text-4xl leading-none">
            <span className="text-[#ff5c7a]">BLOB</span> <span className="text-[#ffcf33]">BRAWL</span>
          </h1>
          <div className="mt-1 text-lg tracking-widest text-[#7fe9ff]">MANETTE</div>
        </>
      }
    />
  );
}
