import { useCallback, useEffect, useRef, useState } from "react";
import PadShell, { type PadView } from "@party/PadShell";
import { GAME_ID, PAD_BUTTONS } from "../padLink";

interface Status extends Record<string, unknown> {
  state?: string;
  hero?: string;
  color?: string;
  skill?: string;
  cd?: number;
  cdMax?: number;
  pct?: number;
  stocks?: number;
  slot?: number;
  alive?: boolean;
  out?: boolean;
  joined?: boolean;
  ready?: boolean;
  charge?: number;
}

const SLOT = ["#22e6ff", "#ff3e5e", "#38e08a", "#ffd23f"];

function pctColor(p: number) {
  if (p < 50) return "#ffffff";
  if (p < 100) return "#ffe25a";
  if (p < 150) return "#ff9a2e";
  return "#ff4d6a";
}

/** Manette téléphone de Rift Brawl : joystick analogique, SAUT, ATTAQUE (maintenir = lourde), SPÉCIAL, pause. */
export default function PadPage() {
  const cdEnd = useRef(0);
  const cdTotal = useRef(1);
  const lastPct = useRef(0);
  const [, force] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 200);
    return () => window.clearInterval(id);
  }, []);

  const onStatus = useCallback((s: Status) => {
    if (typeof s.cd === "number" && typeof s.cdMax === "number") {
      cdEnd.current = Date.now() + s.cd * 1000;
      cdTotal.current = Math.max(0.1, s.cdMax);
    }
    // petite vibration quand on prend un coup
    if (typeof s.pct === "number") {
      if (s.pct > lastPct.current + 0.5) {
        try {
          navigator.vibrate?.(s.pct - lastPct.current > 10 ? 80 : 25);
        } catch {
          /* ignore */
        }
      }
      lastPct.current = s.pct;
    }
  }, []);

  const view = (s: Status | null): PadView => {
    const slot = typeof s?.slot === "number" && s.slot >= 0 ? s.slot : -1;
    const color = s?.color || (slot >= 0 ? SLOT[slot % 4] : "#22e6ff");
    const remaining = Math.max(0, (cdEnd.current - Date.now()) / 1000);
    const st = s?.state ?? "menu";
    let line = "En combat";
    let callout: string | undefined;
    if (st === "menu") {
      line = "Menu principal";
      callout = "ATTAQUE = versus entre amis · SPÉCIAL = solo";
    } else if (st === "lobby") {
      if (!s?.joined) {
        line = "Salon versus";
        callout = "Appuie sur ATTAQUE pour rejoindre !";
      } else line = s.ready ? "✔ Prêt — en attente des autres" : "◀ ▶ héros · ATTAQUE = prêt · SPÉCIAL = quitter";
    } else if (st === "spectator") {
      line = "Spectateur";
      callout = "Rejoins le prochain match depuis le salon";
    } else if (st === "paused") line = "Pause";
    else if (st === "over") {
      line = "Combat terminé";
      callout = "Un bouton = revanche";
    } else if (s?.out) line = "Éliminé — regarde la fin !";
    else if (s?.alive === false) line = "Éjecté ! Retour imminent…";
    const pct = typeof s?.pct === "number" ? s.pct : null;
    return {
      color,
      badge: slot >= 0 ? "J" + (slot + 1) : undefined,
      title: s?.hero,
      line,
      callout,
      pauseId: 3,
      extra:
        pct !== null && st !== "lobby" && st !== "menu" ? (
          <div className="text-right leading-none">
            <div className="text-3xl font-black italic" style={{ color: pctColor(pct), textShadow: "0 2px 0 #000" }}>
              {pct}
              <span className="text-base">%</span>
            </div>
            {typeof s?.stocks === "number" && <div className="text-xs font-black text-[#ff6b9d]">{"♥".repeat(Math.min(5, s.stocks))}</div>}
          </div>
        ) : undefined,
      buttons: [
        { id: 1, label: "Attaque", sub: "maintenir = lourde", color: "#ff3ea5", size: 36, right: 4, bottom: 5, hold: true, ring: typeof s?.charge === "number" ? s.charge : -1 },
        { id: 0, label: "Saut", color: "#ffc21a", size: 27, right: 40, bottom: 4, hold: true },
        {
          id: 2,
          label: s?.skill || "Spécial",
          color: "#22b8ff",
          size: 25,
          right: 14,
          bottom: 43,
          cooldown: remaining > 0 ? Math.min(1, remaining / cdTotal.current) : 0,
          cdText: remaining > 0 ? Math.ceil(remaining) + " s" : undefined,
        },
      ],
    };
  };

  return (
    <PadShell<Status>
      gameId={GAME_ID}
      buttons={PAD_BUTTONS}
      accent="#ff3ea5"
      joystick="analog"
      onStatus={onStatus}
      view={view}
      brand={
        <>
          <h1 className="font-display text-4xl text-[#ff3ea5]">RIFT BRAWL</h1>
          <div className="font-display text-lg tracking-widest text-[#22e6ff]">MANETTE</div>
        </>
      }
    />
  );
}
