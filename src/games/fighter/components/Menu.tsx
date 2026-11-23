import { useEffect, useMemo, useState } from "react";
import Backdrop from "./Backdrop";
import HeroPortrait from "./HeroPortrait";
import { RecordsModal, fmt } from "./ScoreTable";
import { HERO_LIST, HEROES, MODES, type HeroId, type ModeId } from "../game/constants";
import { audio } from "../game/audio";
import { Clock, ModeIcon, Phone, Speaker, SpecialIcon, Trophy } from "./Icons";
import { bestScore, type Prefs } from "../storage";
import { link } from "../padLink";

interface Props {
  prefs: Prefs;
  onChange: (p: Prefs) => void;
  onStart: () => void;
  touch: boolean;
  onToggleTouch: () => void;
  onPair: () => void;
  onVersus: () => void;
  padCount: number;
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[4.6rem] text-[10px] font-bold uppercase tracking-wider text-white/60 sm:text-[11px]">{label}</span>
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="stat-seg" style={i <= value ? { background: color, boxShadow: `0 0 8px ${color}99` } : undefined} />
        ))}
      </div>
    </div>
  );
}

function Key({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <kbd
      className={`font-display inline-flex h-7 items-center justify-center rounded-md border-b-4 border-black/50 bg-white/90 px-2 text-[11px] text-[#1b0b45] ${wide ? "min-w-16" : "min-w-7"}`}
    >
      {children}
    </kbd>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  const rows: [React.ReactNode, string][] = [
    [<><Key>←</Key> <Key>→</Key> <span className="text-white/40">ou</span> <Key>Q</Key> <Key>D</Key></>, "Se déplacer"],
    [<><Key>↑</Key> <span className="text-white/40">/</span> <Key>Z</Key> <span className="text-white/40">/</span> <Key wide>ESPACE</Key></>, "Sauter (maintiens pour sauter plus haut, re-appuie en l'air pour le double saut)"],
    [<><Key>J</Key> <span className="text-white/40">ou</span> <Key>X</Key></>, "Frapper — appuie en rafale pour enchaîner 3 coups"],
    [<><Key>↑</Key> + <Key>J</Key></>, "Coup vers le haut — le meilleur moyen d'éjecter"],
    [<><Key>↓</Key> + <Key>J</Key></>, "Balayage au sol / attaque plongeante (spike) en l'air"],
    [<><Key>K</Key> <span className="text-white/40">ou</span> <Key>C</Key></>, "Capacité spéciale de ton héros"],
    [<><Key>↓</Key></>, "Traverser une plateforme fine / chute rapide"],
    [<><Key>Échap</Key> <span className="text-white/40">/</span> <Key>P</Key></>, "Pause"],
    [<><Key>R</Key> <span className="text-white/40">/</span> <Key>Entrée</Key></>, "Rejouer instantanément (pause / fin de partie)"],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="ui-zoom glass animate-pop thin-scroll max-h-[calc(90vh/var(--ui,1))] w-full max-w-xl overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl text-[#22e6ff]">Commandes</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <ul className="space-y-2.5">
          {rows.map(([k, d], i) => (
            <li key={i} className="flex items-center gap-3 text-sm">
              <div className="flex w-[8.5rem] shrink-0 flex-wrap items-center gap-1 sm:w-44">{k}</div>
              <span className="text-white/80">{d}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-xl bg-white/[0.06] p-3 text-sm text-white/80">
          <p className="font-display mb-1 text-[#ffd23f]">Tactile / manette</p>
          Pad à gauche (glisse le pouce, ↑ = saut) · SAUT · ATK · bouton spécial à droite. Les manettes standard sont aussi gérées (A saut, X frappe, Y spécial).
        </div>
        <div className="mt-3 rounded-xl bg-white/[0.06] p-3 text-sm text-white/80">
          <p className="font-display mb-1 text-[#ff3ea5]">Principe</p>
          Chaque coup augmente le <b>pourcentage</b> de l'adversaire : plus il est haut, plus il vole loin. Éjecte-le hors de l'écran pour marquer ! Enchaîne les coups pour monter le multiplicateur de combo.
        </div>
        <button className="btn-primary mt-4 w-full px-6 py-3 text-lg" onClick={onClose}>
          <span>Compris !</span>
        </button>
      </div>
    </div>
  );
}

export default function Menu({ prefs, onChange, onStart, onVersus, touch, onToggleTouch, onPair, padCount }: Props) {
  const [records, setRecords] = useState(false);
  const [help, setHelp] = useState(false);
  const hero = HEROES[prefs.hero];
  const modal = records || help;

  const bests = useMemo(
    () => ({ arcade: bestScore("arcade"), survival: bestScore("survival"), timeattack: bestScore("timeattack") }) as Record<ModeId, number>,
    // refresh after the records modal closes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records],
  );

  const pickHero = (id: HeroId) => {
    if (id !== prefs.hero) {
      audio.init();
      audio.play("select");
      onChange({ ...prefs, hero: id });
    }
  };
  const pickMode = (id: ModeId) => {
    if (id !== prefs.mode) {
      audio.init();
      audio.play("select");
      onChange({ ...prefs, mode: id });
    }
  };

  // Choix du héros (← →) et du mode (↑ ↓), au clavier comme au joystick du téléphone
  const nav = (d: "l" | "r" | "u" | "d") => {
    const hi = HERO_LIST.findIndex((h) => h.id === prefs.hero);
    const mi = MODES.findIndex((m) => m.id === prefs.mode);
    if (d === "l") pickHero(HERO_LIST[(hi + HERO_LIST.length - 1) % HERO_LIST.length].id);
    else if (d === "r") pickHero(HERO_LIST[(hi + 1) % HERO_LIST.length].id);
    else if (d === "u") pickMode(MODES[(mi + MODES.length - 1) % MODES.length].id);
    else pickMode(MODES[(mi + 1) % MODES.length].id);
  };

  useEffect(() => {
    link.onDir = (d) => {
      if (!modal) nav(d);
    };
    return () => {
      link.onDir = null;
    };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modal) {
        if (e.code === "Escape") {
          setRecords(false);
          setHelp(false);
        }
        return;
      }
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        nav("l");
        e.preventDefault();
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        nav("r");
        e.preventDefault();
      } else if (e.code === "ArrowUp" || e.code === "KeyW") {
        nav("u");
        e.preventDefault();
      } else if (e.code === "ArrowDown" || e.code === "KeyS") {
        nav("d");
        e.preventDefault();
      } else if (e.code === "KeyV") {
        e.preventDefault();
        onVersus();
      } else if (e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <Backdrop />

      <a
        href="../"
        className="icon-btn relative z-20 !w-auto px-3 text-xs font-bold uppercase tracking-wider sm:absolute sm:left-3 sm:top-3"
        style={{ marginLeft: 12, marginTop: "max(env(safe-area-inset-top), 12px)", width: "fit-content" }}
        title="Retour au choix du jeu"
      >
        ◀ Tous les jeux
      </a>

      {/* top-right utility buttons */}
      <div className="relative z-20 flex shrink-0 justify-end gap-2 px-3 pt-3 sm:absolute sm:right-3 sm:top-3 sm:p-0" style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}>
        <button className="icon-btn" title="Records" aria-label="Records" onClick={() => setRecords(true)}>
          <Trophy className="h-5 w-5 text-[#ffd23f]" />
        </button>
        <button className="icon-btn" title="Commandes" aria-label="Commandes" onClick={() => setHelp(true)}>
          ?
        </button>
        <button className={`icon-btn relative ${padCount ? "!border-[#7cf5a1] !bg-[#7cf5a1]/20" : ""}`} title="Manette téléphone (QR code)" aria-label="Manette téléphone" onClick={onPair}>
          <span className="text-lg leading-none">📱</span>
          {padCount > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#7cf5a1] px-1 text-[10px] font-black text-[#07041a]">{padCount}</span>}
        </button>
        <button
          className={`icon-btn ${touch ? "!border-[#22e6ff] !bg-[#22e6ff]/20" : ""}`}
          title="Commandes tactiles"
          aria-label="Commandes tactiles"
          onClick={onToggleTouch}
        >
          <Phone className="h-5 w-5" />
        </button>
        <button
          className="icon-btn"
          title={prefs.muted ? "Activer le son" : "Couper le son"}
          aria-label="Son"
          onClick={() => {
            audio.init();
            onChange({ ...prefs, muted: !prefs.muted });
          }}
        >
          <Speaker on={!prefs.muted} className="h-5 w-5" />
        </button>
      </div>

      <div className="thin-scroll relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-8 pt-2 sm:px-8 sm:pt-5">
        <div className="ui-zoom mx-auto flex max-w-6xl flex-col items-center">
          {/* title */}
          <header className="animate-slide-up mb-4 mt-2 text-center sm:mb-6">
            <h1 className="title-logo text-[2.9rem] sm:text-7xl lg:text-8xl">
              RIFT
              <br className="sm:hidden" /> <span className="sm:ml-3">BRAWL</span>
            </h1>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.3em] text-white/70 sm:text-sm">Arène · Éjection · Gloire</p>
          </header>

          <div className="grid w-full gap-5 lg:grid-cols-[1.3fr_1fr]">
            {/* ---------------- left: heroes ---------------- */}
            <section className="animate-slide-up" style={{ animationDelay: "0.08s" }}>
              <h2 className="section-label mb-2 flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[#22e6ff] text-[11px] text-[#1b0b45]">1</span> Ton combattant
              </h2>
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {HERO_LIST.map((h) => {
                  const sel = h.id === prefs.hero;
                  return (
                    <button
                      key={h.id}
                      onClick={() => pickHero(h.id)}
                      className={`group relative overflow-hidden rounded-2xl border-[3px] pb-1.5 text-center transition-all duration-150 ${sel ? "-translate-y-1 scale-[1.03]" : "opacity-80 hover:-translate-y-0.5 hover:opacity-100"}`}
                      style={{
                        borderColor: sel ? h.color : "rgba(255,255,255,0.16)",
                        background: sel ? `linear-gradient(180deg, ${h.color}33, rgba(10,5,30,0.85))` : "rgba(10,5,30,0.55)",
                        boxShadow: sel ? `0 0 28px ${h.color}66, 0 8px 24px rgba(0,0,0,0.4)` : "none",
                      }}
                    >
                      <HeroPortrait hero={h} active={sel} />
                      <div className="font-display text-[11px] leading-none sm:text-sm" style={{ color: h.color }}>
                        {h.name}
                      </div>
                      <div className="mt-0.5 hidden text-[10px] text-white/55 sm:block">{h.title}</div>
                    </button>
                  );
                })}
              </div>

              {/* detail */}
              <div key={hero.id} className="glass animate-pop mt-3 p-4">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="sm:w-[44%]">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-2xl" style={{ color: hero.color }}>
                        {hero.name}
                      </span>
                      <span className="text-xs text-white/55">{hero.title}</span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      <StatBar label="Puissance" value={hero.stats.power} color={hero.color} />
                      <StatBar label="Vitesse" value={hero.stats.speed} color={hero.color} />
                      <StatBar label="Poids" value={hero.stats.weight} color={hero.color} />
                      <StatBar label="Aérien" value={hero.stats.air} color={hero.color} />
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="rounded-xl border border-white/10 bg-white/[0.05] p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-lg text-base" style={{ background: hero.accent + "33", border: `2px solid ${hero.accent}` }}>
                          <SpecialIcon id={hero.special.id} className="h-4 w-4" />
                        </span>
                        <span className="font-display text-sm" style={{ color: hero.accent }}>
                          ACTIF · {hero.special.name}
                        </span>
                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-white/50">
                          <Clock className="h-3 w-3" /> {hero.special.cd}s
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-white/75">{hero.special.desc}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.05] p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#38e08a]/20 text-base ring-2 ring-[#38e08a]">✦</span>
                        <span className="font-display text-sm text-[#38e08a]">PASSIF · {hero.passive.name}</span>
                      </div>
                      <p className="mt-1 text-xs text-white/75">{hero.passive.desc}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ---------------- right: modes + CTA ---------------- */}
            <section className="animate-slide-up flex flex-col" style={{ animationDelay: "0.16s" }}>
              <h2 className="section-label mb-2 flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[#22e6ff] text-[11px] text-[#1b0b45]">2</span> Mode de jeu
              </h2>
              <div className="space-y-2">
                {MODES.map((m) => {
                  const sel = m.id === prefs.mode;
                  return (
                    <button
                      key={m.id}
                      onClick={() => pickMode(m.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border-[3px] p-3 text-left transition-all duration-150 ${sel ? "scale-[1.02]" : "opacity-75 hover:opacity-100"}`}
                      style={{
                        borderColor: sel ? "#22e6ff" : "rgba(255,255,255,0.14)",
                        background: sel ? "linear-gradient(90deg, rgba(34,230,255,0.22), rgba(10,5,30,0.8))" : "rgba(10,5,30,0.55)",
                        boxShadow: sel ? "0 0 24px rgba(34,230,255,0.35)" : "none",
                      }}
                    >
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl ${sel ? "bg-[#22e6ff] text-[#1b0b45]" : "bg-white/10"}`}>
                        <ModeIcon id={m.id} className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="font-display text-sm sm:text-base">{m.name}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#ff3ea5]">{m.tag}</span>
                        </span>
                        <span className="block text-[11px] leading-snug text-white/65 sm:text-xs">{m.desc}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[9px] uppercase tracking-wider text-white/40">Record</span>
                        <span className="font-display text-sm text-[#ffd23f]">{bests[m.id] ? fmt(bests[m.id]) : "—"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <button className="btn-primary animate-pulse-glow mt-5 w-full px-8 py-4 text-2xl sm:text-3xl" onClick={onStart}>
                <span>Combat solo ▶</span>
              </button>
              <button
                className="btn-ghost mt-3 w-full px-6 py-3 text-lg font-bold !border-[#ff3ea5] !text-[#ff7fc4] sm:text-xl"
                onClick={onVersus}
              >
                ⚔ Versus entre amis · 2 à 4 joueurs
              </button>
              <p className="mt-2 text-center text-[11px] text-white/45">
                {touch ? "Les commandes tactiles s'afficheront en jeu" : "Entrée / Espace : solo · V : versus · ← → héros · ↑ ↓ mode · 📱 téléphone en manette"}
              </p>

              <div className="mt-4 hidden grid-cols-3 gap-2 text-center text-[11px] text-white/60 sm:grid">
                <div className="rounded-xl bg-white/[0.05] p-2">
                  <div className="font-display text-base text-[#22e6ff]">3 modes</div>
                  Arcade · Survie · Chrono
                </div>
                <div className="rounded-xl bg-white/[0.05] p-2">
                  <div className="font-display text-base text-[#ff3ea5]">4 héros</div>
                  Actif + passif uniques
                </div>
                <div className="rounded-xl bg-white/[0.05] p-2">
                  <div className="font-display text-base text-[#ffd23f]">3 arènes</div>
                  Éjection hors zone
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {records && <RecordsModal onClose={() => setRecords(false)} initialMode={prefs.mode} />}
      {help && <HelpModal onClose={() => setHelp(false)} />}
    </div>
  );
}
