import PadShell, { type PadView } from "@party/PadShell";
import { GAME_ID, PAD_BUTTONS } from "../padLink";

interface Status extends Record<string, unknown> {
  state?: string;
  hero?: string;
  color?: string;
  slot?: number;
  alive?: boolean;
  respawn?: number;
  ammo?: number;
  maxAmmo?: number;
  abil?: number;
  lives?: number;
  joined?: boolean;
  ready?: boolean;
}

const SLOT = ["#22e6ff", "#ff3e5e", "#38e08a", "#ffd23f"];

/** Manette téléphone de One Hit Brawl : joystick, SAUT (maintenir = plus haut), FRAPPE, LANCER, POUVOIR, pause. */
export default function PadPage() {
  const view = (s: Status | null): PadView => {
    const slot = typeof s?.slot === "number" && s.slot >= 0 ? s.slot : -1;
    const color = s?.color || (slot >= 0 ? SLOT[slot % 4] : "#ff2d95");
    const st = s?.state ?? "menu";
    const abil = typeof s?.abil === "number" ? s.abil : 1;
    let line = "◀ ▶ bouger · ▼ traverser · ▲ sauter";
    let callout: string | undefined;
    if (st === "menu") {
      line = "Menu principal";
      callout = "Choisis « En équipe » sur l'écran";
    } else if (st === "lobby") {
      if (!s?.joined) {
        line = "Salon en équipe";
        callout = "Appuie sur FRAPPE pour rejoindre !";
      } else line = s.ready ? "✔ Prêt — en attente des autres" : "◀ ▶ héros · FRAPPE = prêt · LANCER = quitter";
    } else if (st === "spectator") {
      line = "Spectateur";
      callout = "Rejoins la prochaine partie depuis le salon";
    } else if (st === "paused") {
      line = "Pause";
      callout = "Bouton pause = reprendre";
    } else if (st === "over") {
      line = "Partie terminée";
      callout = "Un bouton = rejouer";
    } else if (s && s.alive === false) {
      line = s.respawn ? `K.O. — retour dans ${s.respawn} s` : "K.O. — attends la salle suivante";
    }
    const ammo = typeof s?.ammo === "number" ? s.ammo : 0;
    const maxAmmo = typeof s?.maxAmmo === "number" ? s.maxAmmo : 0;
    return {
      color,
      badge: slot >= 0 ? "J" + (slot + 1) : undefined,
      title: s?.hero,
      line,
      callout,
      pauseId: 3,
      extra:
        st === "playing" ? (
          <div className="text-right text-xl leading-tight font-black" style={{ textShadow: "0 2px 0 #000" }}>
            <div className="text-[#ff4d6d]">♦ {s?.lives ?? 0}</div>
            <div className="text-[#ffe14a]">{"●".repeat(ammo) + "○".repeat(Math.max(0, maxAmmo - ammo))}</div>
          </div>
        ) : undefined,
      buttons: [
        { id: 0, label: "Saut", sub: "x2", color: "#22b8ff", size: 34, right: 5, bottom: 6, hold: true },
        { id: 1, label: "Frappe", color: "#ff2d95", size: 27, right: 40, bottom: 8 },
        { id: 2, label: "Lancer", sub: maxAmmo ? `${ammo}/${maxAmmo}` : undefined, color: "#ffb02e", size: 24, right: 37, bottom: 40, cooldown: st === "playing" && ammo < 1 ? 0.7 : 0 },
        {
          id: 4,
          label: "Pouvoir",
          sub: abil >= 1 ? "prêt" : undefined,
          color: abil >= 1 ? "#5dff8a" : "#7a6bff",
          size: 24,
          right: 8,
          bottom: 45,
          cooldown: st === "playing" ? 1 - abil : 0,
        },
      ],
    };
  };

  return (
    <PadShell<Status>
      gameId={GAME_ID}
      buttons={PAD_BUTTONS}
      accent="#ff2d95"
      joystick="four"
      view={view}
      brand={
        <>
          <h1 className="font-title text-4xl leading-none">
            <span className="text-[#ff2d95]">ONE HIT</span> <span className="text-[#19e3ff]">BRAWL</span>
          </h1>
          <div className="mt-1 text-lg tracking-widest text-[#ffe14a]">MANETTE</div>
        </>
      }
    />
  );
}
