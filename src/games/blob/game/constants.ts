export const COLS = 6;
export const ROWS = 14; // 2 hidden rows + 12 visible rows
export const HIDDEN = 2;
export const VISIBLE = ROWS - HIDDEN;
export const CELLS = COLS * ROWS;
export const SPAWN_COL = 2;
export const GARBAGE = 9;

export const FONT = '"Fredoka Variable", "Fredoka", system-ui, -apple-system, "Segoe UI", sans-serif';

export interface Pal {
  base: string;
  light: string;
  dark: string;
  rgb: string;
}

export const PALETTE: Pal[] = [
  { base: '#888', light: '#ccc', dark: '#444', rgb: '136,136,136' },
  { base: '#ff4d6d', light: '#ffb8c4', dark: '#9c0f35', rgb: '255,77,109' }, // 1 red
  { base: '#2fd573', light: '#b4f7cf', dark: '#0a7140', rgb: '47,213,115' }, // 2 green
  { base: '#3fa4ff', light: '#bddfff', dark: '#0e49a3', rgb: '63,164,255' }, // 3 blue
  { base: '#ffcc2e', light: '#fff1a6', dark: '#a37100', rgb: '255,204,46' }, // 4 yellow
  { base: '#b366ff', light: '#e4c8ff', dark: '#561e9e', rgb: '179,102,255' }, // 5 purple
];

export const GARBAGE_PAL: Pal = { base: '#9aa3c7', light: '#dfe4fb', dark: '#4a5280', rgb: '154,163,199' };

export function palFor(c: number): Pal {
  return c === GARBAGE ? GARBAGE_PAL : PALETTE[c] || PALETTE[0];
}

export type L2 = { en: string; fr: string };
export type HeroId = 'ember' | 'marina' | 'volt' | 'terra';

export interface Hero {
  id: HeroId;
  name: string;
  title: L2;
  color: string;
  light: string;
  dark: string;
  rgb: string;
  attackMul: number; // multiplier on attack points for chains >= 2
  incomingMul: number; // multiplier on garbage received
  energyMul: number; // skill energy gain multiplier
  garbageCap: number; // max garbage per drop
  passive: { name: L2; desc: L2 };
  active: { name: L2; desc: L2 };
}

export const HEROES: Hero[] = [
  {
    id: 'ember',
    name: 'Ember',
    title: { en: 'The Combo Fox', fr: 'Le Renard Combo' },
    color: '#ff7a3d',
    light: '#ffc08a',
    dark: '#b8320a',
    rgb: '255,122,61',
    attackMul: 1.3,
    incomingMul: 1,
    energyMul: 1,
    garbageCap: 30,
    passive: {
      name: { en: 'Chain Fury', fr: 'Furie des chaînes' },
      desc: { en: 'Chains of 2+ hit 30% harder.', fr: 'Les chaînes de 2+ frappent 30 % plus fort.' },
    },
    active: {
      name: { en: 'Cinder Burst', fr: 'Explosion de braise' },
      desc: { en: 'Blasts away your 2 bottom rows.', fr: 'Pulvérise tes 2 rangées du bas.' },
    },
  },
  {
    id: 'marina',
    name: 'Marina',
    title: { en: 'The Tide Guard', fr: 'La Gardienne des marées' },
    color: '#35b9ff',
    light: '#a8e4ff',
    dark: '#0a62a8',
    rgb: '53,185,255',
    attackMul: 1,
    incomingMul: 0.75,
    energyMul: 1,
    garbageCap: 30,
    passive: {
      name: { en: 'Tide Guard', fr: 'Garde des marées' },
      desc: { en: 'Incoming garbage reduced by 25%.', fr: 'Malus reçus réduits de 25 %.' },
    },
    active: {
      name: { en: 'Purify', fr: 'Purification' },
      desc: {
        en: 'Turns all garbage into color blobs and washes away 6 incoming.',
        fr: 'Transforme tous les malus en blobs de couleur et efface 6 malus entrants.',
      },
    },
  },
  {
    id: 'volt',
    name: 'Volt',
    title: { en: 'The Spark Imp', fr: 'Le Lutin Étincelle' },
    color: '#ffd02e',
    light: '#fff1a0',
    dark: '#a86f00',
    rgb: '255,208,46',
    attackMul: 1,
    incomingMul: 1,
    energyMul: 1.5,
    garbageCap: 30,
    passive: {
      name: { en: 'Overcharge', fr: 'Surcharge' },
      desc: { en: 'Skill meter fills 50% faster.', fr: 'La jauge de compétence se remplit 50 % plus vite.' },
    },
    active: {
      name: { en: 'Thunder Pick', fr: 'Foudre ciblée' },
      desc: {
        en: 'Zaps every blob of the most common color.',
        fr: 'Foudroie tous les blobs de la couleur la plus présente.',
      },
    },
  },
  {
    id: 'terra',
    name: 'Terra',
    title: { en: 'The Moss Golem', fr: 'Le Golem de mousse' },
    color: '#4fdc6a',
    light: '#b9f7c4',
    dark: '#12803a',
    rgb: '79,220,106',
    attackMul: 1,
    incomingMul: 1,
    energyMul: 1,
    garbageCap: 12,
    passive: {
      name: { en: 'Stone Roots', fr: 'Racines de pierre' },
      desc: { en: 'Garbage lands 2 rows max at a time.', fr: 'Les malus tombent 2 rangées max à la fois.' },
    },
    active: {
      name: { en: 'Harvest', fr: 'Récolte' },
      desc: { en: 'Pulls the top blob off every column.', fr: 'Retire le blob du dessus de chaque colonne.' },
    },
  },
];

export function heroById(id: HeroId): Hero {
  return HEROES.find((h) => h.id === id) || HEROES[0];
}

export interface Stage {
  id: number;
  name: string;
  hero: HeroId;
  diff: number; // 0..1 AI strength
  colors: number;
  speed: number; // fall speed multiplier
  tagline: L2;
}

export const STAGES: Stage[] = [
  { id: 1, name: 'Sprout', hero: 'terra', diff: 0.05, colors: 4, speed: 0.85, tagline: { en: 'Just a baby golem.', fr: 'Un bébé golem.' } },
  { id: 2, name: 'Drizzle', hero: 'marina', diff: 0.2, colors: 4, speed: 0.95, tagline: { en: 'Soft rain, sharp chains.', fr: 'Pluie douce, chaînes tranchantes.' } },
  { id: 3, name: 'Zap', hero: 'volt', diff: 0.32, colors: 4, speed: 1.0, tagline: { en: 'Fast hands, fast skills.', fr: 'Mains rapides, skills rapides.' } },
  { id: 4, name: 'Cinder', hero: 'ember', diff: 0.45, colors: 4, speed: 1.05, tagline: { en: 'Burns bright, burns out.', fr: 'Brille fort, s’éteint vite.' } },
  { id: 5, name: 'Tsunami', hero: 'marina', diff: 0.58, colors: 5, speed: 1.05, tagline: { en: 'Five colors, no mercy.', fr: 'Cinq couleurs, aucune pitié.' } },
  { id: 6, name: 'Static', hero: 'volt', diff: 0.7, colors: 5, speed: 1.1, tagline: { en: 'Charged and chaining.', fr: 'Chargé et en chaîne.' } },
  { id: 7, name: 'Inferno', hero: 'ember', diff: 0.85, colors: 5, speed: 1.15, tagline: { en: 'Hits like a meteor.', fr: 'Frappe comme une météorite.' } },
  { id: 8, name: 'GAIA', hero: 'terra', diff: 1.0, colors: 5, speed: 1.2, tagline: { en: 'The final boss. Good luck.', fr: 'Le boss final. Bonne chance.' } },
];

export type Mode = 'campaign' | 'versus' | 'score' | 'survival';
export const MODES: Mode[] = ['campaign', 'versus', 'score', 'survival'];
