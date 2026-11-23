import type { HeroId } from './config';

export type Mode = 'solo' | 'coop';

export interface ScoreEntry {
  name: string;
  score: number;
  mode: Mode;
  delivered: number;
  date: number;
  heroes: HeroId[];
}

export interface Settings {
  name: string;
  mode: Mode;
  heroes: [HeroId, HeroId];
  muted: boolean;
  /** Cuisine choisie (voir KITCHENS). */
  kitchen: string;
}

const SCORE_KEY = 'brawl-bistro:scores:v1';
const SETTINGS_KEY = 'brawl-bistro:settings:v1';

export const DEFAULT_SETTINGS: Settings = {
  name: 'CHEF',
  mode: 'solo',
  heroes: ['blitz', 'zap'],
  muted: false,
  kitchen: 'bistro',
};

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(SCORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((e) => e && typeof e.score === 'number').slice(0, 20);
  } catch {
    return [];
  }
}

/** Inserts an entry, persists, returns the new table and the 0-based rank (or -1 if it didn't place). */
export function addScore(entry: ScoreEntry): { scores: ScoreEntry[]; rank: number } {
  const all = loadScores();
  all.push(entry);
  all.sort((a, b) => b.score - a.score || a.date - b.date);
  const top = all.slice(0, 10);
  const rank = top.findIndex((e) => e === entry);
  try {
    localStorage.setItem(SCORE_KEY, JSON.stringify(top));
  } catch {
    /* storage may be unavailable (private mode) */
  }
  return { scores: top, rank };
}

export function clearScores() {
  try {
    localStorage.removeItem(SCORE_KEY);
  } catch {
    /* ignore */
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const s = JSON.parse(raw);
    return {
      name: typeof s.name === 'string' ? s.name.slice(0, 10) : DEFAULT_SETTINGS.name,
      mode: s.mode === 'coop' ? 'coop' : 'solo',
      heroes: Array.isArray(s.heroes) && s.heroes.length === 2 ? s.heroes : DEFAULT_SETTINGS.heroes,
      muted: !!s.muted,
      kitchen: typeof s.kitchen === 'string' ? s.kitchen : DEFAULT_SETTINGS.kitchen,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
