// ---------------------------------------------------------------------------
// Brawl Bistro — shared constants & data tables
// ---------------------------------------------------------------------------

export const T = 64; // tile size (logical px)
export const COLS = 13;
export const ROWS = 9;
export const MAP_W = COLS * T; // 832
export const MAP_H = ROWS * T; // 576
export const HUD_H = 96;
export const W = MAP_W;
export const H = MAP_H + HUD_H;
export const CHEF_R = 21;
export const ROUND_TIME = 120;

export const FONT = '"Lilita One", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';

export const COL = {
  navy: '#141836',
  navy2: '#1f2650',
  navy3: '#2c3566',
  cream: '#fff3d6',
  orange: '#ff8a3d',
  yellow: '#ffd23f',
  red: '#ff5470',
  green: '#4be08a',
  mint: '#5ef2c9',
  purple: '#a46bff',
  ink: '#10132b',
};

// '#' counter | b m l t p crates | c board | s stove | d plates | w window | x trash
// '1'..'4' chef spawns | '.' floor | '=' tunnel opening on the border (left ↔ right, Pac-Man style)
export interface Kitchen {
  id: string;
  name: string;
  desc: string;
  map: string[];
}

export const KITCHENS: Kitchen[] = [
  {
    id: 'bistro',
    name: 'Le Bistro',
    desc: 'La cuisine d’origine : tout est à portée de main.',
    map: [
      '#bmltp#######',
      '#...........#',
      '#..3.....4..#',
      's....#c#....w',
      's....c#c....w',
      '#....###....#',
      '#..1.....2..#',
      '#...........#',
      '#x#######d###',
    ],
  },
  {
    id: 'tunnel',
    name: 'Le Tunnel',
    desc: 'Un mur coupe la cuisine en deux : passez les plats au centre… ou par les tunnels !',
    map: [
      '#bmltp#######',
      '#.....#.....#',
      '=.....c.....=',
      's.....#.....w',
      's.....#.....w',
      '#.....c.....#',
      '=..1..#..2..=',
      '#..3..#..4..#',
      '#x#d#####d#c#',
    ],
  },
  {
    id: 'island',
    name: 'L’Îlot',
    desc: 'Un îlot au centre (J3 et J4 y commencent) et deux tunnels sur les côtés.',
    map: [
      '###bmltp#d###',
      '#...........#',
      '#..#######..#',
      '=..s.....c..=',
      'x..s.4.3.c..w',
      '=..s.....c..=',
      '#..#######..#',
      '#.1.......2.#',
      '#########w###',
    ],
  },
];

export function kitchenById(id: string | undefined): Kitchen {
  return KITCHENS.find((k) => k.id === id) ?? KITCHENS[0];
}

/** Original map, kept for code that only needs the default layout. */
export const MAP = KITCHENS[0].map;

export const HOLES: [number, number][] = [
  [1, 1],
  [11, 1],
  [1, 7],
  [11, 7],
];

export type ItemId =
  | 'bun'
  | 'patty_raw'
  | 'patty_cooked'
  | 'lettuce_raw'
  | 'lettuce_chop'
  | 'tomato_raw'
  | 'tomato_chop'
  | 'potato_raw'
  | 'potato_chop'
  | 'fries'
  | 'burnt'
  | 'plate';

export interface ItemDef {
  name: string;
  plate?: boolean;
  chop?: { to: ItemId; time: number };
  cook?: { to: ItemId; time: number };
  burn?: { to: ItemId; time: number };
}

export const ITEMS: Record<ItemId, ItemDef> = {
  bun: { name: 'Bun', plate: true },
  patty_raw: { name: 'Raw patty', cook: { to: 'patty_cooked', time: 5 } },
  patty_cooked: { name: 'Patty', plate: true, burn: { to: 'burnt', time: 6.5 } },
  lettuce_raw: { name: 'Lettuce', chop: { to: 'lettuce_chop', time: 2.2 } },
  lettuce_chop: { name: 'Chopped lettuce', plate: true },
  tomato_raw: { name: 'Tomato', chop: { to: 'tomato_chop', time: 2.2 } },
  tomato_chop: { name: 'Sliced tomato', plate: true },
  potato_raw: { name: 'Potato', chop: { to: 'potato_chop', time: 2.6 } },
  potato_chop: { name: 'Potato sticks', cook: { to: 'fries', time: 5.5 } },
  fries: { name: 'Fries', plate: true, burn: { to: 'burnt', time: 5.5 } },
  burnt: { name: 'Burnt mess' },
  plate: { name: 'Plate' },
};

export const PLATE_ORDER: ItemId[] = ['bun', 'patty_cooked', 'lettuce_chop', 'tomato_chop', 'fries'];

export const CRATE_ITEM: Record<string, ItemId> = {
  b: 'bun',
  m: 'patty_raw',
  l: 'lettuce_raw',
  t: 'tomato_raw',
  p: 'potato_raw',
};

export interface Recipe {
  id: string;
  name: string;
  items: ItemId[];
  value: number;
  patience: number;
  unlock: number;
  weight: number;
}

export const RECIPES: Recipe[] = [
  { id: 'burger', name: 'BURGER', items: ['bun', 'patty_cooked'], value: 20, patience: 62, unlock: 0, weight: 3 },
  { id: 'fries', name: 'FRITES', items: ['fries'], value: 16, patience: 56, unlock: 8, weight: 2 },
  { id: 'salad', name: 'SALADE', items: ['lettuce_chop', 'tomato_chop'], value: 20, patience: 56, unlock: 18, weight: 2 },
  { id: 'combo', name: 'COMBO', items: ['bun', 'patty_cooked', 'fries'], value: 42, patience: 82, unlock: 32, weight: 2 },
  {
    id: 'deluxe',
    name: 'DELUXE',
    items: ['bun', 'patty_cooked', 'lettuce_chop', 'tomato_chop'],
    value: 52,
    patience: 92,
    unlock: 48,
    weight: 2,
  },
];

export type HeroId = 'blitz' | 'zap' | 'bruno';
export type AbilityKind = 'dash' | 'blink' | 'slam';

export interface Hero {
  id: HeroId;
  name: string;
  role: string;
  color: string;
  dark: string;
  accent: string;
  speed: number;
  ability: AbilityKind;
  abilityName: string;
  abilityDesc: string;
  cd: number;
  passiveName: string;
  passiveDesc: string;
  reach: number;
  prep: number;
  cookMul: number;
  burnMul: number;
}

export const HEROES: Record<HeroId, Hero> = {
  blitz: {
    id: 'blitz',
    name: 'Blitz',
    role: 'Sprinteur',
    color: '#ff8a3d',
    dark: '#b8480f',
    accent: '#ffd23f',
    speed: 255,
    ability: 'dash',
    abilityName: 'Turbo Ruée',
    abilityDesc: 'Fonce droit devant, renverse les rats et bouscule les autres.',
    cd: 1.35,
    passiveName: 'Grands bras',
    passiveDesc: 'Prend et pose 50 % plus loin.',
    reach: 1.5,
    prep: 1,
    cookMul: 1,
    burnMul: 1,
  },
  zap: {
    id: 'zap',
    name: 'Zap',
    role: 'Mage de la découpe',
    color: '#a46bff',
    dark: '#5a2bc4',
    accent: '#52f2ff',
    speed: 262,
    ability: 'blink',
    abilityName: 'Téléportation',
    abilityDesc: 'Se téléporte de 4 cases, même à travers les comptoirs.',
    cd: 2.1,
    passiveName: 'Mains agiles',
    passiveDesc: 'Coupe 80 % plus vite.',
    reach: 1,
    prep: 1.8,
    cookMul: 1,
    burnMul: 1,
  },
  bruno: {
    id: 'bruno',
    name: 'Bruno',
    role: 'Roi du grill',
    color: '#2fc9a0',
    dark: '#0f6f58',
    accent: '#ffffff',
    speed: 240,
    ability: 'slam',
    abilityName: 'Coup d’épaule',
    abilityDesc: 'Charge puis onde de choc : assomme les rats et repousse les chefs.',
    cd: 2.3,
    passiveName: 'Maître du grill',
    passiveDesc: 'Cuit 60 % plus vite et brûle deux fois moins vite.',
    reach: 1,
    prep: 1,
    cookMul: 1.6,
    burnMul: 0.5,
  },
};

export const HERO_IDS: HeroId[] = ['blitz', 'zap', 'bruno'];

// ---------------------------------------------------------------------------
// tiny helpers
// ---------------------------------------------------------------------------
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const randi = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const pick = <X,>(arr: X[]): X => arr[Math.floor(Math.random() * arr.length)];
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function canon(items: ItemId[]): string {
  return [...items].sort().join('|');
}

export function formatTime(s: number): string {
  const n = Math.max(0, Math.ceil(s));
  const m = Math.floor(n / 60);
  const sec = n % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
