import type { Hero, PowerKind } from "./heroes";

export const COLS = 15;
export const ROWS = 13;
export const TILE = 48;
export const BOARD_W = COLS * TILE;
export const BOARD_H = ROWS * TILE;
export const HUD_H = 64;
export const VIEW_W = BOARD_W;
export const VIEW_H = BOARD_H + HUD_H;
/** Largeur des colonnes de scores en disposition « écran large » (PC). */
export const SIDE_W = 200;

/** Disposition de l'écran : bandeau en haut (téléphone, portrait) ou scores dans les 4 coins (PC). */
export interface Layout {
  wide: boolean;
  /** Taille totale de la vue. */
  vw: number;
  vh: number;
  /** Position du plateau dans la vue. */
  bx: number;
  by: number;
}

export function layoutFor(wide: boolean): Layout {
  return wide
    ? { wide, vw: BOARD_W + SIDE_W * 2, vh: BOARD_H, bx: SIDE_W, by: 0 }
    : { wide, vw: VIEW_W, vh: VIEW_H, bx: 0, by: HUD_H };
}

export const T_FLOOR = 0;
export const T_WALL = 1;
export const T_BLOCK = 2;

export const FUSE = 2.5;
export const FLAME_TIME = 0.55;
export const HALF = 0.36;

export type Dir = 0 | 1 | 2 | 3; // haut, droite, bas, gauche
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

export interface Cmd {
  dx: number;
  dy: number;
  bomb: boolean;
  skill: boolean;
}

export interface AIState {
  think: number;
  path: { x: number; y: number }[];
  lvl: number;
  bombCd: number;
  skillCd: number;
  wantBomb: boolean;
  wantSkill: boolean;
  stuckT: number;
  lastX: number;
  lastY: number;
  wanderT: number;
}

export interface Player {
  id: number;
  slot: number;
  name: string;
  hero: Hero;
  kind: "human" | "bot";
  device: string | null;
  x: number;
  y: number;
  facing: Dir;
  alive: boolean;
  walkT: number;
  moving: boolean;
  lastAxis: "x" | "y" | null;
  maxBombs: number;
  range: number;
  speed: number;
  kick: boolean;
  shield: boolean;
  invuln: number;
  frozen: number;
  skillCd: number;
  dash: { dx: number; dy: number; left: number } | null;
  lives: number;
  score: number;
  kills: number;
  blocks: number;
  pickups: number;
  wins: number;
  respawnT: number;
  deathT: number;
  spawnX: number;
  spawnY: number;
  ai: AIState | null;
  hurtFlash: number;
  active: number;
  vib: number;
  boostBombs: number;
  boostRange: number;
  boostSpeed: number;
  blinkT: number;
  placed: number;
  /** Coin d'apparition : 0 haut-gauche, 1 haut-droite, 2 bas-gauche, 3 bas-droite. */
  corner: number;
}

export interface Bomb {
  tx: number;
  ty: number;
  fx: number;
  fy: number;
  dx: number;
  dy: number;
  owner: Player;
  range: number;
  fuse: number;
  maxFuse: number;
  pass: Set<Player>;
  free: boolean;
  exploded: boolean;
  age: number;
}

export interface Flame {
  x: number;
  y: number;
  t: number;
  max: number;
  owner: Player;
  seed: number;
}

export interface Powerup {
  kind: PowerKind;
  x: number;
  y: number;
  t: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  type: number; // 0 etincelle, 1 fumee, 2 debris, 3 anneau, 4 etoile
  rot: number;
  vr: number;
  grav: number;
  drag: number;
}

export interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
  max: number;
  size: number;
}

export interface Warning {
  x: number;
  y: number;
  t: number;
}

export interface PlayerConfig {
  slot: number;
  heroId: string;
  kind: "human" | "bot";
  device: string | null;
  name: string;
}

export interface GameConfig {
  mode: "solo" | "versus";
  players: PlayerConfig[];
  /** Identifiant du niveau (voir levels.ts), ou "random" pour en changer à chaque manche. */
  level?: string;
}

export interface Standing {
  slot: number;
  name: string;
  heroId: string;
  kind: "human" | "bot";
  score: number;
  wins: number;
  kills: number;
}

export interface GameSummary {
  mode: "solo" | "versus";
  score: number;
  stage: number;
  rounds: number;
  heroId: string;
  name: string;
  winnerSlot: number | null;
  standings: Standing[];
  blocks: number;
  kills: number;
  pickups: number;
  time: number;
  xp: number;
}

export interface GameCallbacks {
  onPauseChange: (paused: boolean) => void;
  onOver: (summary: GameSummary) => void;
}
