import { COLS, ROWS } from "./types";

/**
 * Niveaux (arènes). Pour en ajouter un : une entrée de plus dans LEVELS.
 *
 * - portalRows : lignes dont les bords gauche/droite sont reliés (tunnel « Pac-Man »).
 *   Utiliser de préférence des lignes impaires (pas de piliers dessus).
 * - portalCols : colonnes dont les bords haut/bas sont reliés.
 * - walls(x, y) : murs fixes en plus de la grille de piliers classique.
 * - density : proportion de caisses destructibles.
 */
export interface Level {
  id: string;
  name: string;
  desc: string;
  portalRows: number[];
  portalCols: number[];
  walls?: (x: number, y: number) => boolean;
  density: number;
  /** Couleurs du sol (damier) et des portails. */
  floorA: string;
  floorB: string;
  portal: string;
}

const MID_X = (COLS - 1) / 2; // 7
const MID_Y = (ROWS - 1) / 2; // 6

export const LEVELS: Level[] = [
  {
    id: "classic",
    name: "Arène classique",
    desc: "La grille d'origine, sans détour.",
    portalRows: [],
    portalCols: [],
    density: 0.76,
    floorA: "#16203d",
    floorB: "#1a2546",
    portal: "#5ee7ff",
  },
  {
    id: "tunnels",
    name: "Les Tunnels",
    desc: "Deux tunnels gauche ↔ droite. Les explosions les traversent !",
    portalRows: [3, ROWS - 4],
    portalCols: [],
    density: 0.74,
    floorA: "#1b1a3f",
    floorB: "#221f4b",
    portal: "#ff5fc4",
  },
  {
    id: "crossroads",
    name: "Carrefour",
    desc: "Un tunnel horizontal et un vertical qui se croisent au centre.",
    portalRows: [MID_Y],
    portalCols: [MID_X],
    density: 0.72,
    floorA: "#13283a",
    floorB: "#173046",
    portal: "#7cf5a1",
  },
  {
    id: "fortress",
    name: "Forteresse",
    desc: "Un fort au centre, et les coins reliés par des tunnels.",
    portalRows: [1, ROWS - 2],
    portalCols: [],
    density: 0.7,
    walls: (x, y) => {
      const onRect = (x === 5 || x === 9) && y >= 4 && y <= 8 ? true : (y === 4 || y === 8) && x >= 5 && x <= 9;
      const gap = (x === MID_X && (y === 4 || y === 8)) || (y === MID_Y && (x === 5 || x === 9));
      return onRect && !gap;
    },
    floorA: "#2a1d2c",
    floorB: "#332233",
    portal: "#ffd23f",
  },
  {
    id: "hyper",
    name: "Hyperespace",
    desc: "Portails sur les quatre bords : tout est relié à tout.",
    portalRows: [3, ROWS - 4],
    portalCols: [3, COLS - 4],
    density: 0.72,
    floorA: "#101a33",
    floorB: "#14223f",
    portal: "#b18cff",
  },
];

export function levelById(id: string | undefined): Level {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}
