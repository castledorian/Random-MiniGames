// Core constants & data tables for the arena fighter.

export const W = 1280;
export const H = 720;
export const STEP = 1 / 120; // fixed simulation step
export const GRAV = 2300;
export const MAX_FALL = 1000;
export const FAST_FALL = 1500;

// Blast zone (outside the visible arena) — cross it and you're out.
export const BLAST = { l: -170, r: W + 170, t: -230, b: H + 150 };

export type HeroId = "volt" | "basalt" | "kira" | "ember";
export type ModeId = "arcade" | "survival" | "timeattack";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Platform extends Rect {
  solid: boolean;
}

export interface Theme {
  skyTop: string;
  skyMid: string;
  skyBot: string;
  glow: string;
  accent: string;
  accent2: string;
  rockTop: string;
  rockBody: string;
  rockDark: string;
  star: string;
}

export interface StageDef {
  id: string;
  name: string;
  platforms: Platform[];
  theme: Theme;
}

export const STAGES: StageDef[] = [
  {
    id: "nexus",
    name: "NEXUS",
    platforms: [
      { x: 290, y: 520, w: 700, h: 190, solid: true },
      { x: 330, y: 388, w: 190, h: 16, solid: false },
      { x: 760, y: 388, w: 190, h: 16, solid: false },
      { x: 545, y: 262, w: 190, h: 16, solid: false },
    ],
    theme: {
      skyTop: "#0a0620",
      skyMid: "#2a0f55",
      skyBot: "#6a1b7a",
      glow: "#ff3ea5",
      accent: "#22e6ff",
      accent2: "#ff3ea5",
      rockTop: "#2f2a63",
      rockBody: "#1a1640",
      rockDark: "#0c0a24",
      star: "#d9d2ff",
    },
  },
  {
    id: "foundry",
    name: "FONDERIE",
    platforms: [
      { x: 230, y: 540, w: 820, h: 180, solid: true },
      { x: 275, y: 408, w: 160, h: 16, solid: false },
      { x: 845, y: 408, w: 160, h: 16, solid: false },
      { x: 560, y: 292, w: 160, h: 16, solid: false },
    ],
    theme: {
      skyTop: "#150606",
      skyMid: "#4a1208",
      skyBot: "#a33a10",
      glow: "#ffb02e",
      accent: "#ffb02e",
      accent2: "#ff4d2e",
      rockTop: "#5b2a1c",
      rockBody: "#2f1410",
      rockDark: "#150706",
      star: "#ffd9a8",
    },
  },
  {
    id: "isles",
    name: "ÎLES CÉLESTES",
    platforms: [
      { x: 120, y: 505, w: 330, h: 150, solid: true },
      { x: 830, y: 505, w: 330, h: 150, solid: true },
      { x: 520, y: 430, w: 240, h: 16, solid: false },
      { x: 560, y: 292, w: 160, h: 16, solid: false },
    ],
    theme: {
      skyTop: "#041b2e",
      skyMid: "#0d4a6b",
      skyBot: "#27a6a0",
      glow: "#9bffe0",
      accent: "#9bffe0",
      accent2: "#4fb8ff",
      rockTop: "#2a6a6f",
      rockBody: "#133f4a",
      rockDark: "#071d26",
      star: "#d8fff4",
    },
  },
];

// ---------------------------------------------------------------- Attacks

export type ArcKind = "fwd" | "up" | "down" | "low" | "spin" | "none";

export interface AttackDef {
  id: string;
  startup: number;
  active: number;
  recovery: number;
  box?: { x: number; y: number; w: number; h: number };
  dmg: number;
  kb: number;
  growth: number;
  angle: number; // degrees; 0 = forward, 90 = up, -90 = down
  hitstop: number;
  shake: number;
  lunge: number;
  chain?: boolean;
  spawn?: "bolt" | "fan";
  arc: ArcKind;
  variant?: number;
  /** Attaque lourde : traverse les boucliers (Rempart de Basalt). */
  heavy?: boolean;
}

/** Attaque lourde (maintenir ATTAQUE au sol) : durée de maintien avant la charge, charge max. */
export const HEAVY_HOLD = 0.17;
export const HEAVY_MAX = 1.0;

export const ATK: Record<string, AttackDef> = {
  jab1: {
    id: "jab1", startup: 0.05, active: 0.06, recovery: 0.14,
    box: { x: 8, y: -8, w: 58, h: 36 },
    dmg: 3, kb: 230, growth: 70, angle: 28, hitstop: 0.05, shake: 2.5, lunge: 120, chain: true, arc: "fwd", variant: 0,
  },
  jab2: {
    id: "jab2", startup: 0.05, active: 0.06, recovery: 0.14,
    box: { x: 8, y: -4, w: 62, h: 38 },
    dmg: 3, kb: 250, growth: 80, angle: 34, hitstop: 0.05, shake: 3, lunge: 120, chain: true, arc: "fwd", variant: 1,
  },
  jab3: {
    id: "jab3", startup: 0.09, active: 0.08, recovery: 0.24,
    box: { x: 6, y: -6, w: 80, h: 56 },
    dmg: 6, kb: 440, growth: 700, angle: 36, hitstop: 0.11, shake: 9, lunge: 230, arc: "fwd", variant: 2,
  },
  upper: {
    id: "upper", startup: 0.08, active: 0.11, recovery: 0.22,
    box: { x: -36, y: -46, w: 76, h: 86 },
    dmg: 8, kb: 560, growth: 900, angle: 84, hitstop: 0.1, shake: 9, lunge: 0, arc: "up",
  },
  dair: {
    id: "dair", startup: 0.1, active: 0.14, recovery: 0.2,
    box: { x: -26, y: 44, w: 52, h: 58 },
    dmg: 8, kb: 400, growth: 640, angle: -78, hitstop: 0.1, shake: 8, lunge: 0, arc: "down",
  },
  sweep: {
    id: "sweep", startup: 0.07, active: 0.08, recovery: 0.2,
    box: { x: 6, y: 26, w: 88, h: 24 },
    dmg: 5, kb: 330, growth: 430, angle: 62, hitstop: 0.07, shake: 4, lunge: 70, arc: "low",
  },
  nair: {
    id: "nair", startup: 0.045, active: 0.13, recovery: 0.16,
    box: { x: -36, y: -4, w: 96, h: 66 },
    dmg: 6, kb: 350, growth: 560, angle: 42, hitstop: 0.07, shake: 5, lunge: 0, arc: "spin",
  },
  // Attaque lourde chargée, façon « smash » : dégâts et éjection selon la charge,
  // éjection qui grimpe fort avec le % de la cible. Valeurs multipliées par la charge dans fighter.ts.
  smash: {
    id: "smash", startup: 0.05, active: 0.1, recovery: 0.36,
    box: { x: 4, y: -8, w: 98, h: 64 },
    dmg: 10, kb: 280, growth: 1000, angle: 38, hitstop: 0.16, shake: 14, lunge: 260, arc: "fwd", variant: 2, heavy: true,
  },
  bolt: {
    id: "bolt", startup: 0.09, active: 0.03, recovery: 0.16,
    dmg: 0, kb: 0, growth: 0, angle: 0, hitstop: 0, shake: 0, lunge: 0, spawn: "bolt", arc: "none",
  },
  fan: {
    id: "fan", startup: 0.1, active: 0.03, recovery: 0.2,
    dmg: 0, kb: 0, growth: 0, angle: 0, hitstop: 0, shake: 0, lunge: 0, spawn: "fan", arc: "none",
  },
};

// ---------------------------------------------------------------- Heroes

export type SpecialId = "bolt" | "shield" | "dash" | "fan";

export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  color: string;
  color2: string;
  accent: string;
  speed: number;
  jump: number;
  airJump: number;
  airJumps: number;
  weight: number;
  atkSpeed: number;
  dmg: number;
  reach: number;
  w: number;
  h: number;
  special: { id: SpecialId; name: string; cd: number; desc: string };
  passive: { name: string; desc: string };
  stats: { power: number; speed: number; weight: number; air: number };
}

export const HEROES: Record<HeroId, HeroDef> = {
  volt: {
    id: "volt", name: "VOLT", title: "Le Foudroyant",
    color: "#ffd21f", color2: "#c98a00", accent: "#27e1ff",
    speed: 470, jump: 900, airJump: 880, airJumps: 2, weight: 0.9, atkSpeed: 1.12, dmg: 0.95, reach: 1,
    w: 36, h: 68,
    special: { id: "bolt", name: "Éclair", cd: 1.4, desc: "Tire un projectile électrique ultra rapide." },
    passive: { name: "Triple saut", desc: "Deux sauts aériens au lieu d'un seul." },
    stats: { power: 2, speed: 5, weight: 1, air: 5 },
  },
  basalt: {
    id: "basalt", name: "BASALT", title: "Le Colosse",
    color: "#93a4bd", color2: "#56657d", accent: "#ff8a2b",
    speed: 350, jump: 850, airJump: 830, airJumps: 1, weight: 1.3, atkSpeed: 0.82, dmg: 1.2, reach: 1.15,
    w: 46, h: 74,
    special: { id: "shield", name: "Rempart", cd: 4.5, desc: "Bouclier d'énergie : bloque tout et renvoie les projectiles." },
    passive: { name: "Armure", desc: "Recul fortement réduit à haut pourcentage." },
    stats: { power: 5, speed: 1, weight: 5, air: 2 },
  },
  kira: {
    id: "kira", name: "KIRA", title: "L'Ombre Bleue",
    color: "#4f7cff", color2: "#2a47b8", accent: "#ff3ea5",
    speed: 490, jump: 910, airJump: 900, airJumps: 1, weight: 0.95, atkSpeed: 1.2, dmg: 0.9, reach: 0.95,
    w: 36, h: 68,
    special: { id: "dash", name: "Ruée", cd: 1.9, desc: "Fonce en avant et percute tout sur son passage." },
    passive: { name: "Régénération", desc: "Les dégâts se résorbent lentement hors combat." },
    stats: { power: 3, speed: 5, weight: 2, air: 3 },
  },
  ember: {
    id: "ember", name: "EMBER", title: "La Braise",
    color: "#ff5a36", color2: "#b32a14", accent: "#ffd23f",
    speed: 405, jump: 880, airJump: 860, airJumps: 1, weight: 1.05, atkSpeed: 1.0, dmg: 1.05, reach: 1,
    w: 38, h: 70,
    special: { id: "fan", name: "Éventail", cd: 2.2, desc: "Trois boules de feu en éventail à courte portée." },
    passive: { name: "Rage", desc: "Les dégâts infligés augmentent avec ton pourcentage." },
    stats: { power: 4, speed: 3, weight: 3, air: 3 },
  },
};

export const HERO_LIST: HeroDef[] = [HEROES.volt, HEROES.basalt, HEROES.kira, HEROES.ember];

// ---------------------------------------------------------------- Versus

/** Couleurs des joueurs J1…J4 (marqueurs, cartes). */
export const SLOT_COLORS = ["#22e6ff", "#ff3e5e", "#38e08a", "#ffd23f"];

export interface VersusPlayer {
  slot: number;
  hero: HeroId;
  kind: "human" | "bot";
  /** Périphérique : "kbA", "kbB", "gp0".., "ph:<pid>" ; null pour un bot. */
  device: string | null;
  name: string;
  /** Niveau des bots, 0..1. */
  level?: number;
}

export interface VersusConfig {
  players: VersusPlayer[];
  stocks: number;
  /** Index d'arène dans STAGES, ou -1 = aléatoire. */
  stage: number;
}

export const MODES: { id: ModeId; name: string; tag: string; desc: string; icon: string }[] = [
  { id: "arcade", name: "ARCADE", tag: "6 duels", desc: "Enchaîne 6 combats contre des adversaires de plus en plus coriaces. Boss final.", icon: "★" },
  { id: "survival", name: "SURVIE", tag: "Vagues infinies", desc: "Des vagues d'IA sans fin. 3 vies. Jusqu'où iras-tu ?", icon: "☠" },
  { id: "timeattack", name: "CONTRE-LA-MONTRE", tag: "90 secondes", desc: "Éjecte un maximum d'ennemis avant la fin du chrono. Chaque KO rapporte du temps.", icon: "⏱" },
];

export const MODE_NAME: Record<ModeId, string> = {
  arcade: "Arcade",
  survival: "Survie",
  timeattack: "Contre-la-montre",
};
