import { useEffect, useMemo, useState } from "react";
import { HEROES, MODE_NAME, type ModeId } from "../game/constants";
import type { GameSummary } from "../game/game";
import { loadScores, topScores } from "../storage";
import { Speaker, Trophy } from "./Icons";
import { ScoreRows, fmt, fmtTime } from "./ScoreTable";

function useCountUp(target: number, ms = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function PauseOverlay({
  muted,
  onResume,
  onRestart,
  onMenu,
  onToggleMute,
}: {
  muted: boolean;
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  onToggleMute: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#07041a]/88 p-4">
      <div className="ui-zoom glass animate-pop w-full max-w-sm p-6 text-center">
        <h2 className="title-logo mb-1 text-5xl">PAUSE</h2>
        <p className="mb-5 text-xs uppercase tracking-[0.25em] text-white/55">Reprends ton souffle</p>
        <div className="space-y-3">
          <button className="btn-primary w-full px-6 py-3.5 text-xl" onClick={onResume}>
            <span>Reprendre</span>
          </button>
          <button className="btn-ghost w-full px-6 py-3 text-base" onClick={onRestart}>
            ↻ Recommencer <span className="ml-1 text-xs text-white/50">(R)</span>
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-ghost px-4 py-3 text-sm" onClick={onToggleMute}>
              <span className="inline-flex items-center gap-2">
                <Speaker on={!muted} className="h-4 w-4" /> {muted ? "Son coupé" : "Son activé"}
              </span>
            </button>
            <button className="btn-ghost px-4 py-3 text-sm" onClick={onMenu}>
              ⌂ Menu
            </button>
          </div>
        </div>
        <p className="mt-4 text-[11px] text-white/45">Échap : reprendre · R : recommencer · M : son</p>
      </div>
    </div>
  );
}

export function GameOverOverlay({
  summary,
  entryId,
  rank,
  name,
  onName,
  onRestart,
  onMenu,
}: {
  summary: GameSummary;
  entryId: string;
  rank: number;
  name: string;
  onName: (n: string) => void;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const shown = useCountUp(summary.score);
  const hero = HEROES[summary.hero];
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const board = useMemo(() => topScores(summary.mode as ModeId, loadScores()), [summary.mode, entryId, version]);
  const top = board.slice(0, 5);
  const own = board.find((b) => b.id === entryId);
  const showOwn = own && rank > 5;
  const good = summary.victory || summary.mode === "timeattack";
  const record = rank === 1;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[#07041a]/90 p-3">
      <div className="ui-zoom glass animate-pop thin-scroll my-auto max-h-full w-full max-w-lg overflow-y-auto p-5 sm:p-6">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/55">
            {MODE_NAME[summary.mode as ModeId]} · {hero.name}
          </p>
          <h2 className={`title-logo mt-1 text-4xl sm:text-5xl ${good ? "" : "[background-image:linear-gradient(180deg,#fff,#ff8aa0_45%,#ff3e5e)]"}`}>{summary.reason}</h2>
        </div>

        <div className="mt-4 rounded-2xl bg-black/30 py-3 text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">Score</div>
          <div className="font-display text-5xl text-[#ffd23f] drop-shadow-[0_3px_0_rgba(0,0,0,0.5)] sm:text-6xl">{fmt(shown)}</div>
          <div className="mt-1 h-6 text-sm font-bold">
            {record ? (
              <span className="inline-flex animate-pulse items-center gap-1.5 text-[#ffd23f]">
                <Trophy className="h-4 w-4" /> NOUVEAU RECORD !
              </span>
            ) : rank > 0 ? (
              <span className="text-[#22e6ff]">#{rank} au classement</span>
            ) : (
              <span className="text-white/50">Hors du top 10</span>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          {[
            ["Progrès", summary.progress],
            ["KO", String(summary.kos)],
            ["Combo max", `${summary.maxCombo}`],
            ["Temps", fmtTime(summary.time)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-white/[0.06] px-1 py-2">
              <div className="text-[9px] font-bold uppercase tracking-wider text-white/45 sm:text-[10px]">{k}</div>
              <div className="font-display text-xs text-white sm:text-sm">{v}</div>
            </div>
          ))}
        </div>

        {rank > 0 && (
          <label className="mt-3 flex items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2 text-sm">
            <span className="text-white/60">Ton nom</span>
            <input
              value={name}
              maxLength={10}
              spellCheck={false}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              onKeyUp={(e) => e.stopPropagation()}
              onChange={(e) => {
                onName(e.target.value.toUpperCase());
                setVersion((v) => v + 1);
              }}
              className="font-display min-w-0 flex-1 rounded-lg border-2 border-white/20 bg-black/30 px-3 py-1.5 text-[#22e6ff] outline-none focus:border-[#22e6ff]"
            />
          </label>
        )}

        <div className="mt-3">
          <div className="section-label mb-1.5">Top {MODE_NAME[summary.mode as ModeId]}</div>
          <ScoreRows entries={top} highlightId={entryId} />
          {showOwn && own && (
            <div className="mt-1.5">
              <div className="mb-1 text-center text-xs text-white/35">···</div>
              <ScoreRows entries={[own]} highlightId={entryId} startRank={rank - 1} />
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-[1fr_auto] gap-3">
          <button className="btn-primary px-6 py-4 text-xl sm:text-2xl" onClick={onRestart}>
            <span>↻ Rejouer</span>
          </button>
          <button className="btn-ghost px-5 py-3 text-sm" onClick={onMenu}>
            ⌂ Menu
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] text-white/45">Entrée ou R : rejouer instantanément</p>
      </div>
    </div>
  );
}

/** Fin d'un match versus : vainqueur + classement. */
export function VersusOverOverlay({ summary, onRestart, onMenu }: { summary: GameSummary; onRestart: () => void; onMenu: () => void }) {
  const w = summary.winner;
  const st = summary.standings ?? [];
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[#07041a]/90 p-3">
      <div className="ui-zoom glass animate-pop thin-scroll my-auto max-h-full w-full max-w-lg overflow-y-auto p-5 sm:p-6">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/55">Versus · fin du match</p>
          <h2 className="title-logo mt-1 text-4xl sm:text-5xl">{w ? "VICTOIRE !" : "ÉGALITÉ"}</h2>
          {w && (
            <div className="font-display mt-1 text-2xl" style={{ color: HEROES[w.hero].color }}>
              {w.name} · {HEROES[w.hero].name}
            </div>
          )}
        </div>
        <div className="mt-4 grid gap-1.5">
          {st.map((x, i) => (
            <div key={x.slot} className="flex items-center justify-between rounded-xl bg-white/[0.06] px-3 py-2 text-sm">
              <span className="font-display" style={{ color: HEROES[x.hero].color }}>
                {i + 1}. {x.name}
                <span className="ml-2 text-[11px] text-white/50">{HEROES[x.hero].name}</span>
              </span>
              <span className="text-white/70">
                {x.kos} KO · {x.falls} chute{x.falls > 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-[1fr_auto] gap-3">
          <button className="btn-primary px-6 py-4 text-xl sm:text-2xl" onClick={onRestart}>
            <span>↻ Revanche</span>
          </button>
          <button className="btn-ghost px-5 py-3 text-sm" onClick={onMenu}>
            ⌂ Salon
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] text-white/45">Entrée, R ou un bouton du téléphone : revanche</p>
      </div>
    </div>
  );
}
