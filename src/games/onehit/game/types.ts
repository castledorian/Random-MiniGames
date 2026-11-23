import type { Body } from "./physics";
import type { EnemyKind, HeroDef, HeroId } from "./heroes";

export type Phase = "menu" | "playing" | "paused" | "over";

export interface Player extends Body {
  alive: boolean;
  hero: HeroDef;
  coyote: number;
  jumpBuf: number;
  jumpsLeft: number;
  jumping: boolean;
  atkT: number; // -1 when idle
  atkCd: number;
  atkBuf: number;
  throwCd: number;
  throwBuf: number;
  abilCd: number;
  ammo: number;
  dashT: number;
  dashDir: 1 | -1;
  inv: number;
  rush: number;
  parryT: number;
  slam: 0 | 1 | 2;
  slamT: number;
  dropT: number;
  sqx: number;
  sqy: number;
  runPh: number;
  ghostT: number;
  throwAnim: number;
  hurtFlash: number;
}

export type EnemyState = "spawn" | "idle" | "windup" | "attack" | "recover" | "stun" | "aim" | "tele" | "dive";

export interface Enemy extends Body {
  id: number;
  kind: EnemyKind;
  alive: boolean;
  state: EnemyState;
  t: number;
  cd: number;
  spawnT: number;
  spawnMax: number;
  turnT: number;
  flash: number;
  ax: number;
  ay: number;
  jumpCd: number;
  seed: number;
  slowed: boolean;
  stunDur: number;
  hit: boolean;
  lean: number;
}

export type ProjKind = "bullet" | "kunai" | "boomer" | "disc" | "grenade";

export interface Proj {
  id: number;
  kind: ProjKind;
  owner: "p" | "e";
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  t: number;
  phase: 0 | 1;
  pierce: number;
  bounces: number;
  near: boolean;
  reflected: boolean;
  hits: number[];
  body?: Body;
  rot: number;
  slowed: boolean;
  /** Index du joueur qui a lancé le projectile (co-op). */
  pi?: number;
}

export interface Barrel {
  x: number;
  y: number;
  w: number;
  h: number;
  fuse: number;
  flash: number;
  alive: boolean;
}

export interface Corpse {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  life: number;
  max: number;
  kind: EnemyKind | "hero";
  face: number;
  color: string;
  w: number;
  h: number;
  flash: number;
}

export interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  grav: number;
  drag: number;
  glow: boolean;
  bounce: boolean;
  line: boolean;
}

export interface FText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  size: number;
  t: number;
  life: number;
}

export type FxKind = "slash" | "ghost" | "ring" | "spawn" | "streak" | "shield" | "bolt" | "wave";

export interface Fx {
  k: FxKind;
  x: number;
  y: number;
  a: number;
  t: number;
  life: number;
  color: string;
  s: number;
  face: number;
}

export interface Bubble {
  /** Joueur au centre de la bulle (co-op). */
  pi: number;
  t: number;
  dur: number;
  r: number;
}

export interface Banner {
  title: string;
  sub: string;
  t: number;
  dur: number;
  color: string;
}

export interface RunSummary {
  score: number;
  room: number; // room reached
  cleared: number;
  kills: number;
  bestCombo: number;
  hero: HeroId;
  time: number;
  /** Co-op : détail par joueur. */
  coop?: { name: string; hero: HeroId; kills: number; deaths: number; color: string }[];
}

export interface Callbacks {
  onPhase: (p: Phase) => void;
  onOver: (s: RunSummary) => void;
  onBest: (cleared: number, unlocked: HeroDef | null) => void;
}
