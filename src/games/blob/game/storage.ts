import type { Mode } from './constants';

const KEY = 'blobbrawl.save.v1';

export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  detail: string;
  hero: string;
  date: number;
}

export interface Save {
  scores: Record<Mode, ScoreEntry[]>;
  campaign: Record<number, { stars: number; best: number }>;
  unlocked: number;
  initials: string;
  hero: string;
  lang: string;
  sfx: boolean;
  music: boolean;
  diff: number;
  seenHelp: boolean;
}

function fresh(): Save {
  return {
    scores: { campaign: [], versus: [], score: [], survival: [] },
    campaign: {},
    unlocked: 1,
    initials: 'YOU',
    hero: 'ember',
    lang: '',
    sfx: true,
    music: true,
    diff: 0.5,
    seenHelp: false,
  };
}

let cache: Save | null = null;

export function load(): Save {
  if (cache) return cache;
  const base = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      cache = { ...base, ...p, scores: { ...base.scores, ...(p.scores || {}) } };
      return cache!;
    }
  } catch {
    /* ignore */
  }
  cache = base;
  return cache;
}

export function save(patch?: Partial<Save>): Save {
  const s = load();
  if (patch) Object.assign(s, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  return s;
}

export function topScore(mode: Mode): number {
  const l = load().scores[mode];
  return l.length ? l[0].score : 0;
}

/** Adds a score and returns its rank (1-based) or 0 if it did not make the table. */
export function addScore(mode: Mode, entry: Omit<ScoreEntry, 'id' | 'date'>): { rank: number; id: string } {
  const s = load();
  const full: ScoreEntry = { ...entry, id: Math.random().toString(36).slice(2, 9), date: Date.now() };
  const list = s.scores[mode];
  list.push(full);
  list.sort((a, b) => b.score - a.score);
  s.scores[mode] = list.slice(0, 10);
  save();
  const idx = s.scores[mode].findIndex((e) => e.id === full.id);
  return { rank: idx + 1, id: full.id };
}

export function renameEntry(mode: Mode, id: string, name: string): void {
  const s = load();
  const e = s.scores[mode].find((x) => x.id === id);
  if (e) e.name = name;
  s.initials = name;
  save();
}

export function recordStage(stage: number, stars: number, score: number): void {
  const s = load();
  const prev = s.campaign[stage];
  s.campaign[stage] = { stars: Math.max(prev?.stars || 0, stars), best: Math.max(prev?.best || 0, score) };
  s.unlocked = Math.max(s.unlocked, Math.min(8, stage + 1));
  save();
}
