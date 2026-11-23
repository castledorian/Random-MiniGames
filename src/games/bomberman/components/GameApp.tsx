import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioFX } from "@/game/audio";
import { InputManager } from "@/game/input";
import { PadHost, type PadInfo } from "@/game/padClient";
import type { HostState } from "@party/host";
import { loadProfile, saveProfile, type Profile } from "@/game/storage";
import type { GameConfig } from "@/game/types";
import GameView from "./GameView";
import { HeroScreen, HowToScreen, ScoresScreen } from "./InfoScreens";
import Lobby from "./Lobby";
import PairDialog from "@party/PairDialog";
import { type AppCtx } from "./shared";
import TitleScreen from "./TitleScreen";

type Screen = "title" | "lobby" | "heroes" | "scores" | "howto" | "game";

export default function GameApp() {
  const input = useMemo(() => new InputManager(), []);
  const audio = useMemo(() => new AudioFX(), []);
  const padHost = useMemo(() => new PadHost(input), [input]);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [room, setRoom] = useState("----");
  const [screen, setScreen] = useState<Screen>("title");
  const [cfg, setCfg] = useState<GameConfig | null>(null);
  const [pairOpen, setPairOpen] = useState(false);
  const [pads, setPads] = useState<PadInfo[]>([]);
  const [linkState, setLinkState] = useState<HostState>("connecting");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const statusRef = useRef<((dev: string) => Record<string, unknown> | null) | null>(null);
  const prevPads = useRef<string[]>([]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setProfile(saveProfile(patch));
  }, []);

  // Initialisation côté client
  useEffect(() => {
    const p = loadProfile();
    setProfile(p);
    audio.muted = p.muted;
    audio.musicOn = p.music;
    input.attach();
    padHost.onRoom = setRoom;
    padHost.onState = setLinkState;
    padHost.onChange = (list) => {
      setPads(list);
      const ids = list.map((x) => x.pid);
      const fresh = list.filter((x) => !prevPads.current.includes(x.pid));
      if (fresh.length) {
        audio.pickup();
        toast("📱 Manette connectée : " + fresh[0].name);
      }
      prevPads.current = ids;
    };
    padHost.start();
    const unlock = () => audio.ensure();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      padHost.stop();
      padHost.onChange = null;
      padHost.onRoom = null;
      padHost.onState = null;
      input.detach();
    };
  }, [audio, input, padHost, toast]);

  useEffect(() => {
    if (profile) audio.setMuted(profile.muted);
  }, [profile, audio]);

  // Envoi périodique du statut aux téléphones
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!padHost.pads.length) return;
      const f = statusRef.current;
      const statuses: Record<string, unknown> = {};
      for (const p of padHost.pads) {
        statuses[p.pid] = (f ? f("ph:" + p.pid) : null) ?? { state: "menu" };
      }
      padHost.sendStatus(statuses);
    }, 300);
    return () => window.clearInterval(id);
  }, [padHost]);

  const openPair = useCallback(() => setPairOpen(true), []);

  if (!profile) return <div className="screen" />;

  const app: AppCtx = { input, audio, padHost, room, linkState, profile, updateProfile, pads, statusRef, toast, openPair };

  const playSolo = () => {
    audio.ensure();
    audio.click();
    setCfg({
      mode: "solo",
      players: [{ slot: 0, heroId: profile.hero, kind: "human", device: null, name: profile.name }],
    });
    setScreen("game");
  };

  const startVersus = (c: GameConfig) => {
    audio.ensure();
    setCfg(c);
    setScreen("game");
  };

  const go = (s: Screen) => {
    audio.ensure();
    audio.click();
    setScreen(s);
  };

  return (
    <>
      {screen === "title" && (
        <TitleScreen app={app} onPlay={playSolo} onVersus={() => go("lobby")} onHeroes={() => go("heroes")} onScores={() => go("scores")} onHow={() => go("howto")} />
      )}
      {screen === "lobby" && <Lobby app={app} onBack={() => go("title")} onStart={startVersus} />}
      {screen === "heroes" && <HeroScreen app={app} onBack={() => go("title")} />}
      {screen === "scores" && <ScoresScreen onBack={() => go("title")} />}
      {screen === "howto" && <HowToScreen onBack={() => go("title")} />}
      {screen === "game" && cfg && <GameView app={app} cfg={cfg} onExit={() => setScreen(cfg.mode === "versus" ? "lobby" : "title")} />}

      {pairOpen && (
        <PairDialog
          room={room}
          linkState={linkState}
          pads={pads}
          accent="#ff5fc4"
          hint="Scannez le QR code avec l'appareil photo du téléphone : il devient une manette (joystick, BOMBE, compétence, pause)."
          onClose={() => setPairOpen(false)}
        />
      )}

      {toastMsg && (
        <div
          className="pointer-events-none fixed left-1/2 top-4 z-[60] rounded-full border-2 border-[var(--green)] bg-[#0f1a2e]/95 px-4 py-2 text-sm font-black text-[var(--green)] shadow-xl"
          style={{ animation: "toastIn 0.25s ease-out both" }}
        >
          {toastMsg}
        </div>
      )}
    </>
  );
}
