import { useCallback, useEffect, useState } from 'react';
import PairDialog from '@party/PairDialog';
import type { HostState } from '@party/host';
import { audio } from './game/audio';
import type { GameConfig, PartyPlayer } from './game/game';
import { Menu } from './components/Menu';
import { GameScreen } from './components/GameScreen';
import PartyLobby from './components/PartyLobby';
import { startPads } from './padLink';
import { load, save } from './game/storage';

export default function App() {
  const [run, setRun] = useState<{ cfg: GameConfig; key: number } | null>(null);
  const [lobby, setLobby] = useState(false);
  const [pairOpen, setPairOpen] = useState(false);
  const [room, setRoom] = useState('----');
  const [linkState, setLinkState] = useState<HostState>('connecting');
  const [pads, setPads] = useState<{ pid: string; name: string }[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [botLevel, setBotLevel] = useState(() => load().diff || 0.5);

  // unlock audio on first interaction
  useEffect(() => {
    const on = () => audio.init();
    window.addEventListener('pointerdown', on, { once: true });
    window.addEventListener('keydown', on, { once: true });
    return () => {
      window.removeEventListener('pointerdown', on);
      window.removeEventListener('keydown', on);
    };
  }, []);

  // salle manettes téléphone (active en permanence)
  useEffect(() => {
    let tm = 0;
    const stop = startPads({
      onRoom: setRoom,
      onState: setLinkState,
      onPads: (list, fresh) => {
        setPads(list);
        if (fresh) {
          setToast(`📱 ${fresh} est connecté`);
          window.clearTimeout(tm);
          tm = window.setTimeout(() => setToast(null), 2600);
        }
      },
    });
    return () => {
      window.clearTimeout(tm);
      stop();
    };
  }, []);

  const start = useCallback((cfg: GameConfig) => setRun({ cfg, key: Date.now() }), []);
  const exit = useCallback(() => {
    setRun((r) => {
      if (r?.cfg.party) setLobby(true);
      return null;
    });
  }, []);
  const startParty = useCallback(
    (players: PartyPlayer[]) => {
      setLobby(false);
      start({ mode: 'versus', hero: players[0].hero, party: players });
    },
    [start],
  );

  return (
    <>
      {run ? (
        <GameScreen key={run.key} cfg={run.cfg} onExit={exit} onNext={start} />
      ) : lobby ? (
        <PartyLobby
          onBack={() => setLobby(false)}
          onStart={startParty}
          onPair={() => setPairOpen(true)}
          padCount={pads.length}
          botLevel={botLevel}
          onBotLevel={(v) => {
            setBotLevel(v);
            save({ diff: v });
          }}
        />
      ) : (
        <Menu onStart={start} onParty={() => setLobby(true)} onPair={() => setPairOpen(true)} padCount={pads.length} />
      )}
      {pairOpen && (
        <PairDialog
          room={room}
          linkState={linkState}
          pads={pads}
          accent="#ffcf33"
          hint="Chaque téléphone devient une manette : il rejoint le salon VERSUS avec le bouton CHUTE."
          onClose={() => setPairOpen(false)}
        />
      )}
      {toast && (
        <div className="pointer-events-none fixed top-3 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-[#1b0f45] px-4 py-2 text-sm font-bold text-white shadow-lg ring-1 ring-white/20">
          {toast}
        </div>
      )}
    </>
  );
}
