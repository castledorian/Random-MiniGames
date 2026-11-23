export type SkillKind = "detonate" | "dash" | "wall" | "freeze" | "teleport" | "barrage";

export interface Hero {
  id: string;
  name: string;
  title: string;
  color: string;
  dark: string;
  accent: string;
  lore: string;
  passive: { name: string; desc: string };
  skill: { name: string; desc: string; cd: number; kind: SkillKind };
  stats: { bombs: number; range: number; speed: number; shield: boolean; kick: boolean; magnet: boolean };
  unlockXp: number;
}

export const HEROES: Hero[] = [
  {
    id: "ember",
    name: "Ember",
    title: "La Pyromane",
    color: "#ff5a3c",
    dark: "#b82a14",
    accent: "#ffd166",
    lore: "Elle a grandi entre les cratères. Plus c'est gros, mieux c'est.",
    passive: { name: "Flammes vives", desc: "Ses explosions ont +1 de portée dès le départ." },
    skill: {
      name: "Détonation",
      desc: "Fait exploser instantanément toutes tes bombes posées.",
      cd: 7,
      kind: "detonate",
    },
    stats: { bombs: 1, range: 3, speed: 4.4, shield: false, kick: false, magnet: false },
    unlockXp: 0,
  },
  {
    id: "volt",
    name: "Volt",
    title: "L'Éclair",
    color: "#ffd23f",
    dark: "#c28f00",
    accent: "#ffffff",
    lore: "Il n'a jamais marché. Il arrive, c'est tout.",
    passive: { name: "Pieds légers", desc: "Vitesse de déplacement +20 %." },
    skill: {
      name: "Dash",
      desc: "Fonce de 3 cases dans ta direction. Invulnérable pendant l'élan.",
      cd: 5,
      kind: "dash",
    },
    stats: { bombs: 1, range: 2, speed: 5.3, shield: false, kick: false, magnet: false },
    unlockXp: 0,
  },
  {
    id: "terra",
    name: "Terra",
    title: "Le Colosse",
    color: "#4cd964",
    dark: "#1f8f36",
    accent: "#d7ffd9",
    lore: "Une armure de roche, une patience de montagne.",
    passive: { name: "Cuirasse", desc: "Commence chaque manche avec un bouclier." },
    skill: {
      name: "Muraille",
      desc: "Érige jusqu'à 3 blocs de pierre devant toi pour bloquer ou protéger.",
      cd: 8,
      kind: "wall",
    },
    stats: { bombs: 1, range: 2, speed: 4.2, shield: true, kick: false, magnet: false },
    unlockXp: 0,
  },
  {
    id: "frost",
    name: "Frost",
    title: "Le Cryo",
    color: "#4fd8ff",
    dark: "#1b8fb8",
    accent: "#e9fbff",
    lore: "Froid comme la glace, il garde toujours une bombe d'avance.",
    passive: { name: "Réserve", desc: "Peut poser 2 bombes dès le départ." },
    skill: {
      name: "Nova glacée",
      desc: "Gèle tous les ennemis proches pendant 2 secondes.",
      cd: 10,
      kind: "freeze",
    },
    stats: { bombs: 2, range: 2, speed: 4.4, shield: false, kick: false, magnet: false },
    unlockXp: 1000,
  },
  {
    id: "shade",
    name: "Shade",
    title: "Le Spectre",
    color: "#a66bff",
    dark: "#6a32c4",
    accent: "#f1e4ff",
    lore: "On ne l'entend jamais arriver. On entend la bombe rouler.",
    passive: { name: "Coup de botte", desc: "Pousse les bombes en marchant dessus." },
    skill: {
      name: "Téléportation",
      desc: "Disparaît et réapparaît sur une case sûre, loin d'ici.",
      cd: 9,
      kind: "teleport",
    },
    stats: { bombs: 1, range: 2, speed: 4.5, shield: false, kick: true, magnet: false },
    unlockXp: 2500,
  },
  {
    id: "nova",
    name: "Nova",
    title: "L'Artilleuse",
    color: "#ff5fc4",
    dark: "#b8247f",
    accent: "#ffe0f4",
    lore: "Elle ne pose pas des bombes. Elle en fait pleuvoir.",
    passive: { name: "Aimant", desc: "Attire les bonus proches comme un aimant." },
    skill: {
      name: "Barrage",
      desc: "Lance une rangée de 4 bombes devant toi (hors limite de bombes).",
      cd: 9,
      kind: "barrage",
    },
    stats: { bombs: 1, range: 2, speed: 4.4, shield: false, kick: false, magnet: true },
    unlockXp: 5000,
  },
];

export function heroById(id: string): Hero {
  return HEROES.find((h) => h.id === id) ?? HEROES[0];
}

export function isUnlocked(h: Hero, xp: number): boolean {
  return xp >= h.unlockXp;
}

export const SLOT_COLORS = ["#4da3ff", "#ff5d73", "#5dff9a", "#ffd54d"];
export const SLOT_NAMES = ["J1", "J2", "J3", "J4"];

export type PowerKind = "bomb" | "flame" | "speed" | "shield" | "kick" | "heart";

export const POWER_INFO: Record<PowerKind, { label: string; color: string }> = {
  bomb: { label: "BOMBE +1", color: "#ff9f43" },
  flame: { label: "PORTÉE +1", color: "#ff4d4d" },
  speed: { label: "VITESSE +", color: "#3dd6ff" },
  shield: { label: "BOUCLIER", color: "#7cf5a1" },
  kick: { label: "BOTTE", color: "#c58bff" },
  heart: { label: "VIE +1", color: "#ff6b9d" },
};
