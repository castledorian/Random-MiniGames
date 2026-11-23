import type { MoveDef, Rect } from "./physics";

export const W = 960;
export const H = 540;
export const FLOOR = 480;
export const GRAV = 1900;

export interface PlatDef {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "solid" | "oneway";
  move?: MoveDef;
}

export interface LevelDef {
  name: string;
  open?: boolean; // open sides => ring-outs left & right
  platforms: PlatDef[];
  spikes: Rect[];
  pads: Rect[];
  barrels: { x: number; y: number }[];
  playerSpawn: { x: number; y: number };
  slots: { x: number; y: number }[];
  sky: [string, string];
  accent: string;
  sun: string;
  seed: number;
}

const S = (x: number, y: number, w: number, h: number): PlatDef => ({ x, y, w, h, kind: "solid" });
const O = (x: number, y: number, w: number, move?: MoveDef): PlatDef => ({ x, y, w, h: 10, kind: "oneway", move });
const FLOOR_FULL = S(0, FLOOR, W, 60);

export const LEVELS: LevelDef[] = [
  {
    name: "DOJO",
    platforms: [FLOOR_FULL, O(130, 360, 200), O(630, 360, 200), O(380, 250, 200)],
    spikes: [],
    pads: [],
    barrels: [{ x: 330, y: 480 }],
    playerSpawn: { x: 480, y: 480 },
    slots: [
      { x: 70, y: 480 }, { x: 890, y: 480 }, { x: 230, y: 360 }, { x: 730, y: 360 },
      { x: 480, y: 250 }, { x: 160, y: 480 }, { x: 800, y: 480 }, { x: 420, y: 250 },
    ],
    sky: ["#14052e", "#4a0f66"], accent: "#ff2d95", sun: "#ff7a3c", seed: 11,
  },
  {
    name: "THE GAP",
    platforms: [S(0, FLOOR, 360, 60), S(600, FLOOR, 360, 60), O(400, 300, 160), O(110, 350, 170), O(680, 350, 170)],
    spikes: [],
    pads: [{ x: 300, y: 470, w: 50, h: 10 }, { x: 610, y: 470, w: 50, h: 10 }],
    barrels: [{ x: 120, y: 480 }],
    playerSpawn: { x: 160, y: 480 },
    slots: [
      { x: 880, y: 480 }, { x: 740, y: 480 }, { x: 760, y: 350 }, { x: 480, y: 300 },
      { x: 190, y: 350 }, { x: 60, y: 480 }, { x: 640, y: 480 }, { x: 450, y: 300 },
    ],
    sky: ["#06122e", "#0b4a6b"], accent: "#19e3ff", sun: "#3ef0ff", seed: 22,
  },
  {
    name: "ISLANDS",
    open: true,
    platforms: [S(60, 400, 220, 36), S(680, 400, 220, 36), S(390, 330, 180, 30), O(190, 262, 130), O(640, 262, 130), O(400, 180, 160)],
    spikes: [],
    pads: [],
    barrels: [{ x: 480, y: 330 }],
    playerSpawn: { x: 170, y: 400 },
    slots: [
      { x: 800, y: 400 }, { x: 440, y: 330 }, { x: 700, y: 262 }, { x: 480, y: 180 },
      { x: 250, y: 262 }, { x: 110, y: 400 }, { x: 870, y: 400 }, { x: 540, y: 330 },
    ],
    sky: ["#0b0a2e", "#2a2a96"], accent: "#8a8bff", sun: "#b0b3ff", seed: 33,
  },
  {
    name: "TOWER",
    platforms: [FLOOR_FULL, O(60, 390, 180), O(720, 390, 180), O(300, 310, 360), O(120, 230, 170), O(670, 230, 170), O(400, 150, 160)],
    spikes: [],
    pads: [],
    barrels: [{ x: 480, y: 480 }, { x: 600, y: 310 }],
    playerSpawn: { x: 480, y: 480 },
    slots: [
      { x: 90, y: 480 }, { x: 870, y: 480 }, { x: 150, y: 390 }, { x: 810, y: 390 },
      { x: 400, y: 310 }, { x: 200, y: 230 }, { x: 760, y: 230 }, { x: 480, y: 150 },
    ],
    sky: ["#2a0820", "#7a1840"], accent: "#ff5a7a", sun: "#ff9a6a", seed: 44,
  },
  {
    name: "THE LIFT",
    platforms: [
      FLOOR_FULL,
      O(130, 380, 150, { rx: 0, ry: 80, speed: 1.1, phase: 0 }),
      O(680, 380, 150, { rx: 0, ry: 80, speed: 1.1, phase: Math.PI }),
      O(380, 300, 200, { rx: 110, ry: 0, speed: 0.8, phase: 0 }),
      O(40, 190, 140), O(780, 190, 140), O(410, 150, 140),
    ],
    spikes: [],
    pads: [],
    barrels: [{ x: 480, y: 480 }],
    playerSpawn: { x: 480, y: 480 },
    slots: [
      { x: 70, y: 480 }, { x: 890, y: 480 }, { x: 110, y: 190 }, { x: 850, y: 190 },
      { x: 480, y: 150 }, { x: 200, y: 480 }, { x: 760, y: 480 }, { x: 540, y: 150 },
    ],
    sky: ["#07231f", "#0d5a4e"], accent: "#5dff8a", sun: "#9dffb8", seed: 55,
  },
  {
    name: "SPIKE PIT",
    platforms: [FLOOR_FULL, O(380, 340, 200), O(110, 370, 150), O(700, 370, 150), O(50, 260, 130), O(780, 260, 130)],
    spikes: [{ x: 380, y: 466, w: 200, h: 14 }],
    pads: [{ x: 330, y: 470, w: 44, h: 10 }, { x: 586, y: 470, w: 44, h: 10 }],
    barrels: [{ x: 200, y: 480 }, { x: 760, y: 480 }],
    playerSpawn: { x: 120, y: 480 },
    slots: [
      { x: 880, y: 480 }, { x: 780, y: 370 }, { x: 480, y: 340 }, { x: 115, y: 260 },
      { x: 845, y: 260 }, { x: 680, y: 480 }, { x: 230, y: 370 }, { x: 540, y: 340 },
    ],
    sky: ["#2e0b05", "#802a0a"], accent: "#ff8a2d", sun: "#ffd24a", seed: 66,
  },
  {
    name: "COLISEUM",
    platforms: [FLOOR_FULL, S(450, 330, 60, 150), O(90, 370, 180), O(690, 370, 180), O(370, 240, 220), O(30, 250, 120), O(810, 250, 120)],
    spikes: [],
    pads: [],
    barrels: [{ x: 300, y: 480 }, { x: 660, y: 480 }],
    playerSpawn: { x: 130, y: 480 },
    slots: [
      { x: 880, y: 480 }, { x: 780, y: 370 }, { x: 480, y: 240 }, { x: 90, y: 250 },
      { x: 870, y: 250 }, { x: 600, y: 480 }, { x: 200, y: 370 }, { x: 410, y: 240 },
    ],
    sky: ["#1d1305", "#5c3f0a"], accent: "#ffe14a", sun: "#ffb52a", seed: 77,
  },
  {
    name: "REACTOR",
    platforms: [S(0, FLOOR, 260, 60), S(350, FLOOR, 260, 60), S(700, FLOOR, 260, 60), O(380, 340, 200), O(60, 310, 150), O(750, 310, 150), O(410, 200, 140)],
    spikes: [],
    pads: [{ x: 205, y: 470, w: 50, h: 10 }, { x: 705, y: 470, w: 50, h: 10 }],
    barrels: [{ x: 140, y: 480 }, { x: 820, y: 480 }, { x: 480, y: 340 }],
    playerSpawn: { x: 480, y: 480 },
    slots: [
      { x: 60, y: 480 }, { x: 900, y: 480 }, { x: 130, y: 310 }, { x: 830, y: 310 },
      { x: 480, y: 200 }, { x: 760, y: 480 }, { x: 220, y: 480 }, { x: 440, y: 340 },
    ],
    sky: ["#0a1f0a", "#16632f"], accent: "#9dff3a", sun: "#d8ff6a", seed: 88,
  },
];
