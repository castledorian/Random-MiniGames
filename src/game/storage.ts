export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  hero: string;
  mode: "solo" | "versus";
  stage: number;
  date: number;
}

export interface Profile {
  xp: number;
  name: string;
  hero: string;
  games: number;
  best: number;
  muted: boolean;
  music: boolean;
  padBase: string;
}

const K_SCORES = "boomb_scores_v1";
const K_PROFILE = "boomb_profile_v1";

const DEFAULT_PROFILE: Profile = {
  xp: 0,
  name: "JOUEUR",
  hero: "ember",
  games: 0,
  best: 0,
  muted: false,
  music: true,
  padBase: "",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible */
  }
}

export function loadProfile(): Profile {
  return { ...DEFAULT_PROFILE, ...read<Partial<Profile>>(K_PROFILE, {}) };
}

export function saveProfile(patch: Partial<Profile>): Profile {
  const next = { ...loadProfile(), ...patch };
  write(K_PROFILE, next);
  return next;
}

export function loadScores(): ScoreEntry[] {
  const list = read<ScoreEntry[]>(K_SCORES, []);
  return Array.isArray(list) ? list : [];
}

export function addScore(e: Omit<ScoreEntry, "id" | "date">): { id: string; rank: number } {
  const entry: ScoreEntry = {
    ...e,
    id: Math.random().toString(36).slice(2, 10),
    date: Date.now(),
  };
  const list = [...loadScores(), entry].sort((a, b) => b.score - a.score).slice(0, 10);
  write(K_SCORES, list);
  const rank = list.findIndex((x) => x.id === entry.id);
  return { id: entry.id, rank: rank === -1 ? -1 : rank + 1 };
}

export function renameScore(id: string, name: string) {
  const list = loadScores().map((e) => (e.id === id ? { ...e, name } : e));
  write(K_SCORES, list);
}

export function clearScores() {
  write(K_SCORES, []);
}

export function cleanName(n: string): string {
  const s = n.replace(/[^\p{L}\p{N} _\-.!]/gu, "").trim().slice(0, 12);
  return s.length ? s.toUpperCase() : "JOUEUR";
}
