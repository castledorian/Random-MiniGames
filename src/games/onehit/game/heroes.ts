export type HeroId = "kage" | "aegis" | "chrono" | "volt";
export type EnemyKind = "grunt" | "shooter" | "brute" | "drone";

export interface HeroDef {
  id: HeroId;
  name: string;
  color: string;
  accent: string;
  unlockRoom: number; // rooms cleared (best run) needed to unlock
  speed: number;
  maxAmmo: number;
  reload: number; // seconds per ammo (auto-reload)
  abilityCd: number;
}

export const HEROES: HeroDef[] = [
  { id: "kage", name: "KAGE", color: "#ff2d95", accent: "#ffd1ea", unlockRoom: 0, speed: 255, maxAmmo: 2, reload: 3.4, abilityCd: 1.0 },
  { id: "aegis", name: "AEGIS", color: "#19e3ff", accent: "#d6faff", unlockRoom: 3, speed: 238, maxAmmo: 2, reload: 1.5, abilityCd: 1.3 },
  { id: "chrono", name: "CHRONO", color: "#5dff8a", accent: "#e0ffe9", unlockRoom: 6, speed: 248, maxAmmo: 3, reload: 2.6, abilityCd: 7.5 },
  { id: "volt", name: "VOLT", color: "#ffe14a", accent: "#fffbe0", unlockRoom: 10, speed: 244, maxAmmo: 2, reload: 3.2, abilityCd: 2.3 },
];

export const heroById = (id: HeroId) => HEROES.find((h) => h.id === id) ?? HEROES[0];

export const ENEMY_COLORS: Record<EnemyKind, string> = {
  grunt: "#ff3b4e",
  shooter: "#ffb02e",
  brute: "#4a7bff",
  drone: "#b04bff",
};

/** Enemies composition per room. */
export function waveFor(n: number): EnemyKind[] {
  const table: Record<number, EnemyKind[]> = {
    1: ["grunt", "grunt"],
    2: ["grunt", "grunt", "grunt"],
    3: ["grunt", "shooter", "grunt"],
    4: ["shooter", "shooter", "grunt", "grunt"],
    5: ["brute", "grunt", "grunt"],
    6: ["brute", "shooter", "grunt", "grunt"],
    7: ["drone", "drone", "grunt", "shooter"],
    8: ["brute", "brute", "shooter", "drone"],
  };
  if (table[n]) return table[n];
  const kinds: EnemyKind[] = ["grunt", "shooter", "brute", "drone"];
  const cost: Record<EnemyKind, number> = { grunt: 1, shooter: 1.5, brute: 2, drone: 1.5 };
  let budget = Math.min(11, 7 + (n - 8) * 0.9);
  const out: EnemyKind[] = [];
  while (budget > 0.9 && out.length < 9) {
    const k = kinds[Math.floor(Math.random() * kinds.length)];
    if (cost[k] <= budget + 0.4) {
      out.push(k);
      budget -= cost[k];
    }
  }
  return out;
}
