import { useCallback, useEffect, useRef, useState } from "react";
import { GAME_ID, PAD_BUTTONS } from "@/game/padClient";
import PadShell, { type PadView } from "@party/PadShell";

interface Status extends Record<string, unknown> {
  state?: string;
  hero?: string;
  name?: string;
  skill?: string;
  color?: string;
  slot?: number;
  alive?: boolean;
  cd?: number;
  cdMax?: number;
  vib?: number;
  lives?: number;
  score?: number;
  wins?: number;
  joined?: boolean;
  ready?: boolean;
}

const SLOT = ["#5ee7ff", "#ff5fc4", "#7cf5a1", "#ffd23f"];

/** Manette téléphone de Boom Brawlers : joystick 4 directions, BOMBE, compétence. */
export default function PadPage() {
  const cdEnd = useRef(0);
  const cdTotal = useRef(1);
  const lastVib = useRef<number | null>(null);
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
    if (typeof s.vib === "number") {
      if (lastVib.current !== null && s.vib !== lastVib.current) {
        try {
          navigator.vibrate?.([90, 40, 160]);
        } catch {
          /* ignore */
        }
      }
      lastVib.current = s.vib;
    }
  }, []);

  const view = (s: Status | null): PadView => {
    const slot = typeof s?.slot === "number" ? s.slot : -1;
    const color = s?.color || (slot >= 0 ? SLOT[slot % 4] : "#5ee7ff");
    const remaining = Math.max(0, (cdEnd.current - Date.now()) / 1000);
    const st = s?.state ?? "menu";
    let line = "En jeu";
    let callout: string | undefined;
    if (st === "menu") {
      line = "Menu principal";
      callout = "BOMBE = lancer une partie solo · ou ouvre le Versus sur l'écran";
    } else if (st === "lobby") {
      if (!s?.joined) {
        line = "Salon versus";
        callout = "Appuie sur BOMBE pour rejoindre !";
      } else {
        line = s.ready ? "✔ Prêt — en attente des autres" : "◀ ▶ héros · BOMBE = prêt · compétence = quitter";
      }
    } else if (s?.alive === false) line = "Éliminé… attends la prochaine manche";
    else if (st === "countdown") line = "Prêt ? GO !";
    else if (st === "over") {
      line = "Partie terminée";
      callout = "BOMBE = rejouer";
    }
    return {
      color,
      pauseId: 2,
      badge: slot >= 0 ? "J" + (slot + 1) : undefined,
      title: s?.name || s?.hero ? String(s?.name ?? s?.hero) : undefined,
      line,
      callout,
      extra:
        st !== "lobby" && st !== "menu" && (typeof s?.lives === "number" || typeof s?.score === "number") ? (
          <div className="text-right leading-tight">
            {typeof s?.score === "number" && <div className="text-base font-black text-white">{s.score.toLocaleString("fr-FR")}</div>}
            {typeof s?.lives === "number" && s.lives > 1 && <div className="text-xs font-black text-[#ff6b9d]">♥ {s.lives}</div>}
            {typeof s?.wins === "number" && s.wins > 0 && <div className="text-xs font-black text-[#ffe066]">{"★".repeat(s.wins)}</div>}
          </div>
        ) : undefined,
      buttons: [
        { id: 0, label: "Bombe", color: "#ff5a2a", size: 38, right: 5, bottom: 6 },
        {
          id: 1,
          label: s?.skill || "Skill",
          color: "#3a7bff",
          size: 27,
          right: 42,
          bottom: 22,
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
      accent="#ffd23f"
      joystick="four"
      onStatus={onStatus}
      view={view}
      brand={
        <>
          <h1 className="logo-boom text-5xl">BOOM</h1>
          <div className="logo-sub text-lg">MANETTE</div>
        </>
      }
    />
  );
}
