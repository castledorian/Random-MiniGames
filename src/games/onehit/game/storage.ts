import type { HeroId } from "./heroes";

export interface ScoreEntry {
  id: number;
  name: string;
  score: number;
  room: number;
  hero: HeroId;
  date: number;
}

export interface Save {
  scores: ScoreEntry[];
  bestRoom: number;
  name: string;
  hero: HeroId;
  muted: boolean;
  lang: "fr" | "en";
  runs: number;
}

const KEY = "onehitbrawl.save.v1";

function defaults(): Save {
  const fr = !(typeof navigator !== "undefined" && /^en/i.test(navigator.language || ""));
  return { scores: [], bestRoom: 0, name: "PILOT", hero: "kage", muted: false, lang: fr ? "fr" : "en", runs: 0 };
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    return { ...defaults(), ...parsed };
  } catch {
    return defaults();
  }
}

export function writeSave(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

/** Adds a score, keeps the top 10. Returns the rank (1-based) or 0 when it did not make the table. */
export function addScore(s: Save, entry: Omit<ScoreEntry, "id" | "date">): { save: Save; rank: number; id: number } {
  const id = Date.now() + Math.floor(Math.random() * 1000);
  const full: ScoreEntry = { ...entry, id, date: Date.now() };
  const list = [...s.scores, full].sort((a, b) => b.score - a.score);
  const rank = list.findIndex((e) => e.id === id) + 1;
  const save: Save = { ...s, scores: list.slice(0, 10), runs: s.runs + 1 };
  writeSave(save);
  return { save, rank: rank <= 10 ? rank : 0, id };
}
