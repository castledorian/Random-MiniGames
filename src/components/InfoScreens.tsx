import { useEffect, useState } from "react";
import { HEROES, POWER_INFO, heroById, isUnlocked, type PowerKind } from "@/game/heroes";
import { clearScores, loadScores, type ScoreEntry } from "@/game/storage";
import { HeroCanvas, HeroStats, type AppCtx } from "./shared";

export function HeroScreen({ app, onBack }: { app: AppCtx; onBack: () => void }) {
  const { profile } = app;
  return (
    <div className="screen grid-bg">
      <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-4">
        <div className="flex items-center justify-between gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            ◀ Retour
          </button>
          <h2 className="text-2xl font-black uppercase italic tracking-wider text-[var(--yellow)] sm:text-3xl">Les héros</h2>
          <span className="chip">⭐ {profile.xp.toLocaleString("fr-FR")} XP</span>
        </div>
        <p className="mt-3 text-center text-sm font-semibold text-[var(--muted)]">
          Chaque héros a un <b className="text-[var(--yellow)]">passif</b> permanent et une <b className="text-[var(--cyan)]">compétence active</b> avec temps de recharge.
          Gagnez de l&apos;XP en jouant (1 point de score = 1 XP) pour débloquer les héros verrouillés.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HEROES.map((h, i) => {
            const open = isUnlocked(h, profile.xp);
            const selected = profile.hero === h.id;
            return (
              <button
                key={h.id}
                disabled={!open}
                onClick={() => {
                  app.audio.click();
                  app.updateProfile({ hero: h.id });
                }}
                className="panel pop-in relative flex flex-col items-center p-4 text-left transition-transform hover:-translate-y-1 disabled:cursor-not-allowed"
                style={{ borderColor: selected ? h.color : undefined, animationDelay: i * 0.05 + "s", boxShadow: selected ? `0 0 0 2px ${h.color}, 0 20px 50px rgba(0,0,0,.45)` : undefined }}
              >
                <HeroCanvas hero={h} size={92} walking={selected} locked={!open} />
                <div className="-mt-3 text-center">
                  <div className="text-2xl font-black uppercase tracking-wider" style={{ color: open ? h.color : "#56608c" }}>
                    {open ? h.name : "???"}
                  </div>
                  <div className="text-xs font-bold text-[var(--muted)]">{h.title}</div>
                </div>
                {open ? (
                  <>
                    <p className="mt-2 text-center text-xs italic text-[var(--muted)]">« {h.lore} »</p>
                    <div className="mt-3 w-full space-y-2 rounded-xl bg-black/30 p-3 text-xs leading-snug">
                      <div>
                        <b className="text-[var(--yellow)]">Passif · {h.passive.name}</b>
                        <div className="text-[var(--muted)]">{h.passive.desc}</div>
                      </div>
                      <div>
                        <b className="text-[var(--cyan)]">Actif · {h.skill.name}</b> <span className="text-[var(--muted)]">({h.skill.cd} s)</span>
                        <div className="text-[var(--muted)]">{h.skill.desc}</div>
                      </div>
                    </div>
                    <div className="mt-3 w-full">
                      <HeroStats hero={h} />
                    </div>
                    {selected && <span className="chip mt-3" style={{ color: h.color, borderColor: h.color }}>★ Héros principal</span>}
                  </>
                ) : (
                  <div className="mt-4 w-full text-center">
                    <div className="text-sm font-black text-[var(--muted)]">🔒 Verrouillé</div>
                    <div className="mt-2 h-3 overflow-hidden rounded-full bg-black/40">
                      <div className="h-full rounded-full bg-[var(--yellow)]" style={{ width: Math.min(100, (profile.xp / h.unlockXp) * 100) + "%" }} />
                    </div>
                    <div className="mt-1 text-xs font-bold text-[var(--muted)]">
                      {profile.xp.toLocaleString("fr-FR")} / {h.unlockXp.toLocaleString("fr-FR")} XP
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ScoresScreen({ onBack }: { onBack: () => void }) {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  useEffect(() => setScores(loadScores()), []);
  return (
    <div className="screen grid-bg">
      <div className="relative mx-auto max-w-3xl px-4 pb-10 pt-4">
        <div className="flex items-center justify-between gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            ◀ Retour
          </button>
          <h2 className="text-2xl font-black uppercase italic tracking-wider text-[var(--yellow)] sm:text-3xl">🏆 Meilleurs scores</h2>
          <span className="w-16" />
        </div>
        <div className="panel mt-5 overflow-hidden">
          {scores.length === 0 ? (
            <div className="p-10 text-center font-bold text-[var(--muted)]">Aucun score pour l&apos;instant.<br />Lancez une partie pour inscrire votre nom ici !</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-black/30 text-xs uppercase tracking-widest text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Joueur</th>
                  <th className="px-3 py-2">Héros</th>
                  <th className="hidden px-3 py-2 sm:table-cell">Mode</th>
                  <th className="px-3 py-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s, i) => {
                  const h = heroById(s.hero);
                  return (
                    <tr key={s.id} className="border-t border-white/10">
                      <td className="px-3 py-2 font-black" style={{ color: i === 0 ? "#ffd23f" : i === 1 ? "#d5dcf5" : i === 2 ? "#e0955a" : "#8fa0d8" }}>
                        {i + 1}
                      </td>
                      <td className="px-3 py-2 font-black tracking-wider">{s.name}</td>
                      <td className="px-3 py-2 font-bold" style={{ color: h.color }}>
                        {h.name}
                      </td>
                      <td className="hidden px-3 py-2 text-[var(--muted)] sm:table-cell">
                        {s.mode === "solo" ? `Solo · étape ${s.stage}` : "Versus"} · {new Date(s.date).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-3 py-2 text-right text-lg font-black text-[var(--yellow)]">{s.score.toLocaleString("fr-FR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {scores.length > 0 && (
          <div className="mt-4 text-center">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                if (window.confirm("Effacer tous les scores ?")) {
                  clearScores();
                  setScores([]);
                }
              }}
            >
              Effacer les scores
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function HowToScreen({ onBack }: { onBack: () => void }) {
  const kinds = Object.keys(POWER_INFO) as PowerKind[];
  const desc: Record<PowerKind, string> = {
    bomb: "+1 bombe posable en même temps",
    flame: "+1 de portée d'explosion",
    speed: "Vitesse de déplacement accrue",
    shield: "Absorbe un coup (une fois)",
    kick: "Pousse les bombes en marchant dessus",
    heart: "Une vie de plus (mode solo)",
  };
  return (
    <div className="screen grid-bg">
      <div className="relative mx-auto max-w-4xl px-4 pb-10 pt-4">
        <div className="flex items-center justify-between gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            ◀ Retour
          </button>
          <h2 className="text-2xl font-black uppercase italic tracking-wider text-[var(--cyan)] sm:text-3xl">Comment jouer</h2>
          <span className="w-16" />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <section className="panel p-4">
            <h3 className="mb-2 text-lg font-black uppercase text-[var(--yellow)]">🎯 But du jeu</h3>
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              Posez des bombes, détruisez les caisses, ramassez des bonus et <b className="text-[var(--ink)]">éliminez vos adversaires</b>. Évitez vos propres explosions !
              En <b className="text-[var(--ink)]">Solo</b> : survivez à des étapes de plus en plus dures (3 vies). En <b className="text-[var(--ink)]">Versus</b> : premier à 2 manches.
              Passé un certain temps, la <b className="text-[var(--red)]">mort subite</b> referme l&apos;arène en spirale.
            </p>
            <h3 className="mb-2 mt-4 text-lg font-black uppercase text-[var(--yellow)]">⭐ Score</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
              <li>Caisse détruite : <b className="text-[var(--ink)]">+10</b> (combo dès 3 caisses d&apos;un coup)</li>
              <li>Bonus ramassé : <b className="text-[var(--ink)]">+50</b></li>
              <li>Élimination : <b className="text-[var(--ink)]">+500</b></li>
              <li>Étape terminée : <b className="text-[var(--ink)]">+500 × étape</b>, bonus de temps et de vies</li>
              <li>Manche gagnée (versus) : <b className="text-[var(--ink)]">+1000</b></li>
            </ul>
          </section>

          <section className="panel p-4">
            <h3 className="mb-2 text-lg font-black uppercase text-[var(--cyan)]">🎮 Contrôles</h3>
            <table className="w-full text-sm">
              <tbody className="[&_td]:py-1.5 [&_td]:align-top">
                <tr>
                  <td className="font-black">⌨ Clavier A</td>
                  <td className="text-[var(--muted)]">
                    <span className="kbd">Z</span><span className="kbd">Q</span><span className="kbd">S</span><span className="kbd">D</span> (ou WASD) · bombe <span className="kbd">Espace</span> · skill <span className="kbd">E</span> / <span className="kbd">Maj</span>
                  </td>
                </tr>
                <tr>
                  <td className="font-black">⌨ Clavier B</td>
                  <td className="text-[var(--muted)]">
                    Flèches · bombe <span className="kbd">Entrée</span> · skill <span className="kbd">Maj droite</span> / <span className="kbd">/</span>
                  </td>
                </tr>
                <tr>
                  <td className="font-black">🎮 Manette</td>
                  <td className="text-[var(--muted)]">Stick / croix · bombe <span className="kbd">A</span> · skill <span className="kbd">B</span> <span className="kbd">X</span> <span className="kbd">Y</span> ou gâchettes · pause <span className="kbd">Start</span></td>
                </tr>
                <tr>
                  <td className="font-black">📱 Téléphone</td>
                  <td className="text-[var(--muted)]">Scannez le QR code (menu « Manette phone ») : joystick + boutons BOMBE et SKILL.</td>
                </tr>
                <tr>
                  <td className="font-black">👆 Tactile</td>
                  <td className="text-[var(--muted)]">Sur mobile, joystick flottant à gauche, boutons à droite.</td>
                </tr>
                <tr>
                  <td className="font-black">⏸ Pause</td>
                  <td className="text-[var(--muted)]"><span className="kbd">Échap</span> / <span className="kbd">P</span> · rejouer : <span className="kbd">R</span></td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="panel p-4">
            <h3 className="mb-3 text-lg font-black uppercase text-[var(--pink)]">🎁 Bonus</h3>
            <div className="grid gap-2">
              {kinds.map((k) => (
                <div key={k} className="flex items-center gap-3 text-sm">
                  <span className="grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-black" style={{ borderColor: POWER_INFO[k].color, color: POWER_INFO[k].color }}>
                    {k === "bomb" ? "💣" : k === "flame" ? "🔥" : k === "speed" ? "⚡" : k === "shield" ? "🛡" : k === "kick" ? "👟" : "❤"}
                  </span>
                  <span>
                    <b style={{ color: POWER_INFO[k].color }}>{POWER_INFO[k].label}</b> <span className="text-[var(--muted)]">— {desc[k]}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-4">
            <h3 className="mb-3 text-lg font-black uppercase text-[var(--green)]">🦸 Héros</h3>
            <div className="grid gap-2">
              {HEROES.map((h) => (
                <div key={h.id} className="flex items-center gap-2 text-xs">
                  <HeroCanvas hero={h} size={34} />
                  <span>
                    <b style={{ color: h.color }}>{h.name}</b> · <span className="text-[var(--yellow)]">{h.passive.name}</span> · <span className="text-[var(--cyan)]">{h.skill.name}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">Astuce : les zones rouges au sol montrent où les bombes vont exploser. Courez !</p>
          </section>
        </div>
      </div>
    </div>
  );
}
