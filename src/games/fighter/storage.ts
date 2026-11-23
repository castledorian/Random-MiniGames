import type { HeroId, ModeId } from "./game/constants";

export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  mode: ModeId;
  hero: HeroId;
  kos: number;
  detail: string;
  date: number;
}

export interface Prefs {
  hero: HeroId;
  mode: ModeId;
  name: string;
  muted: boolean;
}

const SCORE_KEY = "riftbrawl.scores.v1";
const PREF_KEY = "riftbrawl.prefs.v1";
const MAX_PER_MODE = 10;

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(SCORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveScores(list: ScoreEntry[]) {
  try {
    localStorage.setItem(SCORE_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}

export function topScores(mode: ModeId, list = loadScores()): ScoreEntry[] {
  return list.filter((s) => s.mode === mode).sort((a, b) => b.score - a.score).slice(0, MAX_PER_MODE);
}

export function bestScore(mode: ModeId): number {
  const t = topScores(mode);
  return t.length ? t[0].score : 0;
}

/** Adds a score and returns its rank (1-based) within the mode, or 0 if it didn't make the board. */
export function addScore(entry: Omit<ScoreEntry, "id" | "date">): { id: string; rank: number } {
  const id = Math.random().toString(36).slice(2, 10);
  const full: ScoreEntry = { ...entry, id, date: Date.now() };
  const all = loadScores();
  all.push(full);
  // keep only the top N per mode
  const kept: ScoreEntry[] = [];
  (["arcade", "survival", "timeattack"] as ModeId[]).forEach((m) => kept.push(...topScores(m, all)));
  saveScores(kept);
  const board = topScores(entry.mode, kept);
  const idx = board.findIndex((s) => s.id === id);
  return { id, rank: idx + 1 };
}

export function renameScore(id: string, name: string) {
  const all = loadScores();
  const s = all.find((x) => x.id === id);
  if (s) {
    s.name = name;
    saveScores(all);
  }
}

export function clearScores() {
  saveScores([]);
}

export function loadPrefs(): Prefs {
  const def: Prefs = { hero: "volt", mode: "arcade", name: "JOUEUR", muted: false };
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return def;
    return { ...def, ...JSON.parse(raw) };
  } catch {
    return def;
  }
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
