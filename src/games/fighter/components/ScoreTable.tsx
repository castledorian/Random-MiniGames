import { useMemo, useState } from "react";
import { HEROES, MODES, type ModeId } from "../game/constants";
import { ModeIcon, Trophy } from "./Icons";
import { clearScores, loadScores, topScores, type ScoreEntry } from "../storage";

export const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");
export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

const rankStyle = (i: number) =>
  i === 0 ? "text-[#ffd23f]" : i === 1 ? "text-[#d7e2ff]" : i === 2 ? "text-[#ffa26b]" : "text-white/55";

export function ScoreRows({ entries, highlightId, startRank = 0 }: { entries: ScoreEntry[]; highlightId?: string; startRank?: number }) {
  if (entries.length === 0) {
    return <div className="py-6 text-center text-sm text-white/50">Aucun score pour l'instant — sois le premier !</div>;
  }
  return (
    <ul className="space-y-1.5">
      {entries.map((e, i) => {
        const hero = HEROES[e.hero];
        const hl = e.id === highlightId;
        return (
          <li
            key={e.id}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm ${hl ? "bg-[#ffd23f]/20 ring-2 ring-[#ffd23f]/70" : "bg-white/[0.05]"}`}
          >
            <span className={`font-display w-7 text-right text-base ${rankStyle(startRank + i)}`}>{startRank + i + 1}</span>
            <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-black/40" style={{ background: hero?.color }} />
            <span className="min-w-0 flex-1 truncate font-semibold tracking-wide">{e.name || "JOUEUR"}</span>
            <span className="hidden text-xs text-white/50 sm:inline">{e.detail}</span>
            <span className="font-display text-base text-[#ffd23f]">{fmt(e.score)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function RecordsModal({ onClose, initialMode }: { onClose: () => void; initialMode: ModeId }) {
  const [mode, setMode] = useState<ModeId>(initialMode);
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entries = useMemo(() => topScores(mode, loadScores()), [mode, version]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="glass animate-pop flex max-h-[88vh] w-full max-w-xl flex-col p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display flex items-center gap-2 text-2xl text-[#ffd23f]">
            <Trophy className="h-6 w-6" /> Records
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`font-display rounded-xl border-2 px-2 py-2 text-[11px] leading-tight sm:text-xs ${
                mode === m.id ? "border-[#22e6ff] bg-[#22e6ff]/20 text-white" : "border-white/15 bg-white/5 text-white/60 hover:text-white"
              }`}
            >
              <ModeIcon id={m.id} className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
              {m.name}
            </button>
          ))}
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto pr-1">
          <ScoreRows entries={entries} />
        </div>
        <div className="mt-4 flex justify-between">
          <button
            className="text-xs text-white/40 underline-offset-2 hover:text-[#ff3e5e] hover:underline"
            onClick={() => {
              if (window.confirm("Effacer tous les records ?")) {
                clearScores();
                setVersion((v) => v + 1);
              }
            }}
          >
            Effacer les records
          </button>
          <button className="btn-ghost px-5 py-2 text-sm" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
