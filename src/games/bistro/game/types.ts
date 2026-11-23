import type { Hero, ItemId, Recipe } from './config';
import type { PlayerInput } from './input';

export interface Item {
  id: ItemId;
  prog: number; // progress of the current process (chop / cook / burn)
  plate: ItemId[]; // contents when id === 'plate'
  pop: number; // pop animation 1 → 0
}

export type TileType = 'floor' | 'counter' | 'crate' | 'board' | 'stove' | 'plates' | 'window' | 'trash';

export interface Tile {
  c: number;
  r: number;
  type: TileType;
  crate?: ItemId;
  item: Item | null;
  cookMul: number;
  burnMul: number;
  bounce: number; // little hop when interacted with
  busy: number; // >0 while being worked on
  fx: number; // emit timer
  warnT: number; // alarm beep timer
}

export interface Chef {
  idx: number;
  hero: Hero;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  held: Item | null;
  dashT: number;
  dashCd: number;
  dashDX: number;
  dashDY: number;
  dashSpeed: number;
  slam: boolean;
  kbT: number;
  chopping: boolean;
  autoChop: boolean;
  chopFx: number;
  target: Tile | null;
  sx: number;
  sy: number;
  svx: number;
  svy: number;
  walk: number;
  trailT: number;
  bumpCd: number;
  swapFlash: number;
  input: PlayerInput;
  auto: boolean;
  /** Co-op : périphérique qui contrôle ce chef et pseudo du joueur. */
  device: string | null;
  name: string;
}

export interface Rat {
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: 'run' | 'flee' | 'flung';
  target: Tile | null;
  origin: Tile | null;
  carry: Item | null;
  t: number;
  spin: number;
  rot: number;
  hop: number;
  holeX: number;
  holeY: number;
  born: number;
}

export interface Order {
  id: number;
  recipe: Recipe;
  t: number;
  max: number;
  age: number;
  dispX: number;
  leaving: 'done' | 'fail' | null;
  leaveT: number;
}

export type PShape = 'circle' | 'square' | 'star' | 'ring' | 'smoke';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  shape: PShape;
  grav: number;
  drag: number;
  rot: number;
  vr: number;
  grow: number;
}

export interface FloatText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  size: number;
  life: number;
  max: number;
}

export interface Banner {
  text: string;
  sub?: string;
  color: string;
  t: number;
  dur: number;
  size: number;
}

export interface GameResult {
  score: number;
  delivered: number;
  expired: number;
  bestCombo: number;
  smashed: number;
  stars: number;
  /** Co-op : plats servis par chaque joueur. */
  players?: { name: string; hero: string; served: number }[];
}
