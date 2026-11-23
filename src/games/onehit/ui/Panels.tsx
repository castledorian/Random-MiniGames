import { useEffect, useState, type ReactNode } from "react";
import { HEROES, heroById, type HeroDef } from "../game/heroes";
import type { RunSummary } from "../game/types";
import type { Save, ScoreEntry } from "../game/storage";
import { tr, type Lang } from "./i18n";

export type EndSummary = RunSummary & { rank: number; id: number; newUnlocks: HeroDef[] };

function Modal({ children, onClose, lang, title, color }: { children: ReactNode; onClose: () => void; lang: Lang; title: string; color: string }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/75 p-3 [touch-action:pan-y]" onClick={onClose}>
      <div
        className="ui-zoom my-auto w-full max-w-2xl animate-[pop-in_0.25s_ease-out] rounded-lg border-2 bg-[#0d0620] p-4 shadow-2xl sm:p-6"
        style={{ borderColor: color, boxShadow: `0 0 40px ${color}40` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-title text-2xl sm:text-3xl" style={{ color }}>
            {title}
          </h2>
          <button onClick={onClose} className="rounded border border-white/25 px-3 py-1 font-ui text-xs font-bold tracking-widest text-white hover:bg-white/10">
            {tr(lang, "close")} ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ScoreTable({ scores, highlight, limit = 10, lang }: { scores: ScoreEntry[]; highlight?: number; limit?: number; lang: Lang }) {
  if (scores.length === 0) return <p className="py-6 text-center font-ui text-sm text-white/50">{tr(lang, "noScores")}</p>;
  return (
    <div className="overflow-hidden rounded-md border border-white/10 font-ui text-sm">
      <div className="grid grid-cols-[2rem_1fr_3.2rem_5.5rem] gap-2 bg-white/5 px-3 py-1.5 text-[10px] font-bold tracking-widest text-white/50 sm:grid-cols-[2.5rem_1fr_5rem_3.5rem_6rem]">
        <span>#</span>
        <span>{tr(lang, "pilot")}</span>
        <span className="hidden sm:block">{tr(lang, "hero")}</span>
        <span className="text-right">{tr(lang, "room")}</span>
        <span className="text-right">{tr(lang, "score")}</span>
      </div>
      {scores.slice(0, limit).map((s, i) => {
        const h = heroById(s.hero);
        const hl = s.id === highlight;
        return (
          <div
            key={s.id}
            className={`grid grid-cols-[2rem_1fr_3.2rem_5.5rem] items-center gap-2 px-3 py-1.5 sm:grid-cols-[2.5rem_1fr_5rem_3.5rem_6rem] ${hl ? "animate-pulse bg-neon-yellow/15" : i % 2 ? "bg-white/[0.03]" : ""}`}
          >
            <span className="font-title text-white/60" style={i < 3 ? { color: ["#ffe14a", "#d6e0ff", "#ff9a5c"][i] } : undefined}>
              {i + 1}
            </span>
            <span className="truncate font-bold text-white">{s.name || "—"}</span>
            <span className="hidden font-bold sm:block" style={{ color: h.color }}>
              {h.name}
            </span>
            <span className="text-right text-white/70">{s.room}</span>
            <span className="text-right font-title text-white">{s.score.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ScoresPanel({ save, lang, onClose }: { save: Save; lang: Lang; onClose: () => void }) {
  return (
    <Modal lang={lang} onClose={onClose} title={`🏆 ${tr(lang, "scores")}`} color="#19e3ff">
      <ScoreTable scores={save.scores} lang={lang} />
      <div className="mt-3 grid grid-cols-4 gap-2">
        {HEROES.map((h) => (
          <div key={h.id} className="rounded border px-2 py-1.5 text-center font-ui text-[11px]" style={{ borderColor: h.unlockRoom <= save.bestRoom ? h.color : "#3a3450", color: h.unlockRoom <= save.bestRoom ? h.color : "#6b6580" }}>
            <b className="font-title">{h.name}</b>
            <div>{h.unlockRoom <= save.bestRoom ? "✔" : `🔒 ${h.unlockRoom}`}</div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function Key({ children }: { children: ReactNode }) {
  return <kbd className="mx-0.5 inline-block min-w-[1.6rem] rounded border border-white/30 bg-white/10 px-1.5 py-0.5 text-center font-ui text-[11px] font-bold text-white shadow-[0_2px_0_rgba(255,255,255,0.2)]">{children}</kbd>;
}

export function HelpPanel({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const rows: [string, ReactNode][] = [
    [tr(lang, "move"), <><Key>A</Key><Key>D</Key> / <Key>←</Key><Key>→</Key></>],
    [tr(lang, "jump"), <><Key>W</Key> / <Key>↑</Key> / <Key>Space</Key></>],
    [tr(lang, "drop"), <><Key>S</Key> / <Key>↓</Key></>],
    [tr(lang, "slash"), <><Key>J</Key> / <Key>Z</Key> / LMB</>],
    [tr(lang, "throwA"), <><Key>K</Key> / <Key>X</Key> / RMB</>],
    [tr(lang, "ability"), <><Key>L</Key> / <Key>C</Key> / <Key>Shift</Key></>],
    [tr(lang, "pause"), <><Key>P</Key> / <Key>Esc</Key></>],
    [tr(lang, "restartKey"), <Key>R</Key>],
    [tr(lang, "mute"), <Key>M</Key>],
  ];
  return (
    <Modal lang={lang} onClose={onClose} title={`? ${tr(lang, "howto")}`} color="#ffe14a">
      <div className="grid gap-4 font-ui text-[13px] text-white/80 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-[11px] font-bold tracking-[0.3em] text-neon-yellow">{tr(lang, "controls")}</h3>
          <ul className="flex flex-col gap-1.5">
            {rows.map(([a, b], i) => (
              <li key={i} className="flex items-center justify-between gap-2 border-b border-white/5 pb-1">
                <span>{a}</span>
                <span className="whitespace-nowrap">{b}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-white/50">{tr(lang, "azerty")}</p>
          <p className="mt-1 text-xs text-white/50">📱 {tr(lang, "touch")}</p>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="mb-2 text-[11px] font-bold tracking-[0.3em] text-neon-pink">{tr(lang, "enemies")}</h3>
            <ul className="flex flex-col gap-1.5 text-xs">
              <li><span className="mr-1.5 inline-block h-2.5 w-2.5 bg-[#ff3b4e]" />{tr(lang, "eGrunt")}</li>
              <li><span className="mr-1.5 inline-block h-2.5 w-2.5 bg-[#ffb02e]" />{tr(lang, "eShooter")}</li>
              <li><span className="mr-1.5 inline-block h-2.5 w-2.5 bg-[#4a7bff]" />{tr(lang, "eBrute")}</li>
              <li><span className="mr-1.5 inline-block h-2.5 w-2.5 bg-[#b04bff]" />{tr(lang, "eDrone")}</li>
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-[11px] font-bold tracking-[0.3em] text-neon-cyan">{tr(lang, "tips")}</h3>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-xs">
              <li>{tr(lang, "tip1")}</li>
              <li>{tr(lang, "tip2")}</li>
              <li>{tr(lang, "tip3")}</li>
              <li>{tr(lang, "tip4")}</li>
              <li>{tr(lang, "tip5")}</li>
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function PauseOverlay(p: { lang: Lang; muted: boolean; onResume: () => void; onRestart: () => void; onMenu: () => void; onMute: () => void }) {
  const btn = "w-full rounded-md border-2 px-5 py-3 font-title text-xl tracking-wide transition-transform active:scale-95";
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
      <div className="ui-zoom w-full max-w-xs animate-[pop-in_0.2s_ease-out] text-center">
        <h2 className="mb-5 font-title text-5xl text-neon-cyan [text-shadow:0_0_14px_#19e3ff,3px_3px_0_#07030f]">{tr(p.lang, "paused")}</h2>
        <div className="flex flex-col gap-3">
          <button onClick={p.onResume} className={`${btn} border-neon-cyan bg-neon-cyan text-[#07030f] hover:brightness-110`}>▶ {tr(p.lang, "resume")}</button>
          <button onClick={p.onRestart} className={`${btn} border-neon-pink bg-transparent text-neon-pink hover:bg-neon-pink/15`}>↻ {tr(p.lang, "restart")}</button>
          <button onClick={p.onMenu} className={`${btn} border-white/40 bg-transparent text-white hover:bg-white/10`}>☰ {tr(p.lang, "menu")}</button>
          <button onClick={p.onMute} className="font-ui text-xs font-bold tracking-widest text-white/60 hover:text-white">
            {p.muted ? "🔇" : "🔊"} {tr(p.lang, "sound")}
          </button>
        </div>
        <p className="mt-4 font-ui text-xs tracking-widest text-white/40">{tr(p.lang, "pause_hint")}</p>
      </div>
    </div>
  );
}

function fmtTime(t: number) {
  const s = Math.floor(t);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function GameOverOverlay(p: { lang: Lang; summary: EndSummary; save: Save; onRetry: () => void; onMenu: () => void; onScores: () => void }) {
  const s = p.summary;
  const hero = heroById(s.hero);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      const k = Math.min(1, (now - t0) / 900);
      setShown(Math.round(s.score * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [s.score]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/70 p-3 [touch-action:pan-y]">
      <div className="ui-zoom my-auto w-full max-w-lg animate-[pop-in_0.3s_ease-out] text-center">
        <h2 className="font-title text-5xl text-neon-pink [text-shadow:0_0_16px_#ff2d95,4px_4px_0_#07030f] sm:text-6xl">{tr(p.lang, "gameOver")}</h2>
        <div className="mt-3 rounded-lg border-2 bg-[#0d0620]/95 p-4" style={{ borderColor: hero.color, boxShadow: `0 0 36px ${hero.color}40` }}>
          {s.coop && <div className="mb-1 font-ui text-xs font-bold tracking-[0.3em] text-white/60">ÉQUIPE DE {s.coop.length}</div>}
          {s.rank > 0 && !s.coop && (
            <div className="mb-2 inline-block animate-bounce rounded bg-neon-yellow px-3 py-1 font-title text-sm text-[#07030f]">
              {s.rank === 1 ? "★ " + tr(p.lang, "newBest") : `${tr(p.lang, "rank")} #${s.rank}`}
            </div>
          )}
          <div className="font-ui text-[11px] font-bold tracking-[0.3em] text-white/50">{tr(p.lang, "score")}</div>
          <div className="font-title text-6xl text-white sm:text-7xl">{shown.toLocaleString()}</div>
          <div className="mt-3 grid grid-cols-4 gap-2 font-ui">
            {[
              [tr(p.lang, "room"), s.room],
              [tr(p.lang, "kills"), s.kills],
              [tr(p.lang, "combo"), `x${Math.min(8, s.bestCombo)}`],
              [tr(p.lang, "time"), fmtTime(s.time)],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded bg-white/5 px-1 py-2">
                <div className="truncate text-[9px] font-bold tracking-widest text-white/45">{k}</div>
                <div className="font-title text-lg" style={{ color: hero.color }}>{v}</div>
              </div>
            ))}
          </div>
          {s.newUnlocks.map((h) => (
            <div key={h.id} className="mt-3 animate-pulse rounded border-2 px-3 py-2 font-title text-sm" style={{ borderColor: h.color, color: h.color }}>
              🔓 {tr(p.lang, "unlocked")}: {h.name}
            </div>
          ))}
          {s.coop ? (
            <div className="mt-4 flex flex-col gap-1.5 text-left font-ui">
              {s.coop.map((c, i) => (
                <div key={i} className="flex items-center gap-2 rounded bg-white/5 px-3 py-1.5">
                  <span className="rounded px-1.5 font-title text-xs text-[#07030f]" style={{ background: c.color }}>
                    J{i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-bold">{c.name}</span>
                  <span className="font-title text-sm" style={{ color: heroById(c.hero).color }}>
                    {heroById(c.hero).name}
                  </span>
                  <span className="w-28 text-right text-sm text-white/70">
                    ✖ {c.kills} · K.O. {c.deaths}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-left">
              <div className="mb-1 font-ui text-[11px] font-bold tracking-[0.3em] text-white/50">{tr(p.lang, "scores")}</div>
              <ScoreTable scores={p.save.scores} highlight={s.id} limit={5} lang={p.lang} />
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={p.onRetry}
            className="flex-[2] rounded-md bg-neon-pink px-6 py-3.5 font-title text-2xl tracking-wide text-[#07030f] shadow-[0_5px_0_#a3105f] active:translate-y-1 active:shadow-[0_1px_0_#a3105f]"
          >
            ↻ {tr(p.lang, "retry")}
          </button>
          <button onClick={p.onMenu} className="flex-1 rounded-md border-2 border-white/40 px-4 py-3 font-title text-lg text-white hover:bg-white/10">
            ☰ {s.coop ? "SALON" : tr(p.lang, "menu")}
          </button>
        </div>
        <p className="mt-3 font-ui text-xs tracking-widest text-white/40">{s.coop ? "ENTRÉE ou R pour rejouer · un bouton du téléphone aussi" : tr(p.lang, "retryHint")}</p>
      </div>
    </div>
  );
}
