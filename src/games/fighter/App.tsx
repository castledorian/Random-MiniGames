import { useCallback, useEffect, useState } from "react";
import Menu from "./components/Menu";
import GameView from "./components/GameView";
import { audio } from "./game/audio";
import { HEROES } from "./game/constants";
import PairDialog from "@party/PairDialog";
import type { HostState } from "@party/host";
import { host, link, startPads } from "./padLink";
import { loadPrefs, savePrefs, type Prefs } from "./storage";

function detectTouch() {
  try {
    return window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  } catch {
    return false;
  }
}

export default function App() {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [touch, setTouch] = useState(detectTouch);
  const [session, setSession] = useState(0);
  const [pairOpen, setPairOpen] = useState(false);
  const [room, setRoom] = useState("----");
  const [linkState, setLinkState] = useState<HostState>("connecting");
  const [pads, setPads] = useState<{ pid: string; name: string }[]>([]);
  const [padCount, setPadCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  // Salle manettes téléphone (QR code)
  useEffect(() => {
    let t = 0;
    const stop = startPads({
      onRoom: setRoom,
      onState: setLinkState,
      onPads: (n, fresh) => {
        setPadCount(n);
        setPads(host.list().map((p) => ({ pid: p.pid, name: p.name })));
        if (fresh) {
          setToast("📱 Manette connectée : " + fresh);
          window.clearTimeout(t);
          t = window.setTimeout(() => setToast(null), 2600);
        }
      },
    });
    return () => {
      window.clearTimeout(t);
      stop();
    };
  }, []);

  useEffect(() => {
    audio.setMuted(prefs.muted);
    savePrefs(prefs);
  }, [prefs]);

  const start = useCallback(() => {
    audio.init();
    audio.play("start");
    setSession((s) => s + 1);
    setScreen("game");
  }, []);

  // Menu : un appui sur un bouton du téléphone lance le combat
  useEffect(() => {
    if (screen !== "menu") return;
    const f = (i: number) => {
      if (i < 3) start();
    };
    link.onButton = f;
    link.status = () => ({ state: "menu", hero: HEROES[prefs.hero].name, color: HEROES[prefs.hero].color });
    return () => {
      if (link.onButton === f) link.onButton = null;
    };
  }, [screen, start, prefs.hero]);

  return (
    <div className="h-full w-full overflow-hidden bg-void">
      {screen === "menu" ? (
        <Menu prefs={prefs} onChange={setPrefs} onStart={start} touch={touch} onToggleTouch={() => setTouch((t) => !t)} onPair={() => setPairOpen(true)} padCount={padCount} />
      ) : (
        <GameView
          key={session}
          hero={prefs.hero}
          mode={prefs.mode}
          touch={touch}
          prefs={prefs}
          onPrefs={setPrefs}
          onExit={() => setScreen("menu")}
        />
      )}
      {pairOpen && (
        <PairDialog
          room={room}
          linkState={linkState}
          pads={pads}
          accent="#22e6ff"
          hint="Scannez le QR code avec l'appareil photo de votre smartphone : il devient une manette (joystick, saut, attaque, spécial, pause)."
          onClose={() => setPairOpen(false)}
        />
      )}
      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-full border-2 border-[#7cf5a1] bg-[#0f1a2e]/95 px-4 py-2 text-sm font-black text-[#7cf5a1] shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
