import { useCallback, useEffect, useRef, useState } from "react";
import Art from "./Art";
import { GAMES, type GameEntry } from "./games";

const INPUT_LABEL: Record<GameEntry["inputs"][number], string> = {
  keyboard: "⌨ Clavier",
  gamepad: "🎮 Manette",
  phone: "📱 Téléphone",
  touch: "👆 Tactile",
};

const LAST_KEY = "party_hub_last";

function loadLast(): number {
  try {
    const id = localStorage.getItem(LAST_KEY);
    const i = GAMES.findIndex((g) => g.id === id);
    return i >= 0 ? i : 0;
  } catch {
    return 0;
  }
}

export default function Hub() {
  const [sel, setSel] = useState(loadLast);
  const [going, setGoing] = useState<string | null>(null);
  const selRef = useRef(sel);
  selRef.current = sel;
  const goingRef = useRef<string | null>(null);

  const launch = useCallback((i: number) => {
    if (goingRef.current) return;
    const g = GAMES[i];
    goingRef.current = g.id;
    setGoing(g.id);
    try {
      localStorage.setItem(LAST_KEY, g.id);
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      window.location.href = g.href;
    }, 280);
  }, []);

  const move = useCallback((d: number) => {
    setSel((s) => (s + d + GAMES.length) % GAMES.length);
  }, []);

  // Clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "ArrowUp" || e.code === "KeyA" || e.code === "KeyW") {
        move(-1);
        e.preventDefault();
      } else if (e.code === "ArrowRight" || e.code === "ArrowDown" || e.code === "KeyD" || e.code === "KeyS") {
        move(1);
        e.preventDefault();
      } else if ((e.code === "Enter" || e.code === "Space") && !e.repeat) {
        launch(selRef.current);
        e.preventDefault();
      } else if (/^Digit[1-9]$/.test(e.code)) {
        const i = Number(e.code.slice(5)) - 1;
        if (i < GAMES.length) {
          setSel(i);
          launch(i);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, launch]);

  // Manette (croix / stick gauche + A)
  useEffect(() => {
    let raf = 0;
    let prev = { l: false, r: false, a: false };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
      let l = false;
      let r = false;
      let a = false;
      for (const gp of pads) {
        if (!gp || !gp.connected) continue;
        const ax = gp.axes[0] || 0;
        const ay = gp.axes[1] || 0;
        l = l || ax < -0.5 || ay < -0.5 || !!gp.buttons[14]?.pressed || !!gp.buttons[12]?.pressed;
        r = r || ax > 0.5 || ay > 0.5 || !!gp.buttons[15]?.pressed || !!gp.buttons[13]?.pressed;
        a = a || !!gp.buttons[0]?.pressed || !!gp.buttons[9]?.pressed;
      }
      if (l && !prev.l) move(-1);
      if (r && !prev.r) move(1);
      if (a && !prev.a) launch(selRef.current);
      prev = { l, r, a };
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [move, launch]);

  return (
    <div className="hub-root">
      <div className="hub-grid" aria-hidden />
      <div className="hub-bombs" aria-hidden>
        <i style={{ left: "6%", top: "14%", width: 90, animationDelay: "0s" }} />
        <i style={{ right: "8%", top: "60%", width: 130, animationDelay: "-2s" }} />
        <i style={{ left: "44%", bottom: "-4%", width: 70, animationDelay: "-4s" }} />
      </div>

      <main className="relative z-10 mx-auto flex min-h-full max-w-6xl flex-col items-center px-4 pb-10 pt-8 sm:pt-12">
        <header className="hub-pop text-center">
          <div className="text-xs font-black uppercase tracking-[0.45em] text-[#5ee7ff] sm:text-sm">Les jeux entre amis</div>
          <h1 className="hub-logo mt-2">SOIRÉE</h1>
          <div className="hub-sub">JEUX</div>
          <p className="mx-auto mt-4 max-w-xl text-sm font-semibold text-[#8fa0d8] sm:text-base">
            Choisis ton jeu. Clavier, manette ou <b className="text-[#ff5fc4]">téléphone en manette</b> (scanne le QR code dans le jeu) : tout le monde peut jouer.
          </p>
        </header>

        <ul className="mt-8 grid w-full list-none grid-cols-1 gap-5 p-0 sm:mt-10 mx-auto max-w-4xl md:grid-cols-2" role="listbox" aria-label="Jeux">
          {GAMES.map((g, i) => {
            const on = i === sel;
            return (
              <li key={g.id} className="hub-pop" style={{ animationDelay: `${0.08 * (i + 1)}s` }}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={`hub-card ${on ? "is-on" : ""} ${going === g.id ? "is-going" : ""}`}
                  style={{ "--a": g.accent, "--b": g.accent2 } as React.CSSProperties}
                  onMouseEnter={() => setSel(i)}
                  onFocus={() => setSel(i)}
                  onClick={() => {
                    setSel(i);
                    launch(i);
                  }}
                >
                  <span className="hub-card-art">
                    <Art kind={g.art} a={g.accent} b={g.accent2} />
                  </span>
                  <span className="mt-3 block text-left">
                    <span className="flex items-center justify-between gap-2">
                      <span className="hub-card-title">{g.name}</span>
                      <span className="hub-num">{i + 1}</span>
                    </span>
                    <span className="mt-1 block min-h-[3.2em] text-sm font-semibold leading-snug text-[#c3cdf5]">{g.tagline}</span>
                    <span className="hub-players">{g.players}</span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {g.inputs.map((k) => (
                        <span key={k} className="hub-chip">
                          {INPUT_LABEL[k]}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="hub-play">{going === g.id ? "Chargement…" : g.external ? "Jouer ↗" : "Jouer ▶"}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-bold text-[#8fa0d8]">
          <span>
            <span className="hub-kbd">←</span> <span className="hub-kbd">→</span> choisir
          </span>
          <span>
            <span className="hub-kbd">Entrée</span> jouer
          </span>
          <span>🎮 croix + A</span>
          <span>👆 ou touche une carte</span>
        </footer>
      </main>
    </div>
  );
}
