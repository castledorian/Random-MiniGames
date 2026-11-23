export interface GameEntry {
  id: string;
  name: string;
  tagline: string;
  /** Lien relatif (jeu hébergé ici) ou absolu (jeu hébergé ailleurs). */
  href: string;
  external?: boolean;
  players: string;
  /** Moyens de jouer : clavier, manette, téléphone en manette (QR code), tactile. */
  inputs: ("keyboard" | "gamepad" | "phone" | "touch")[];
  accent: string;
  accent2: string;
  art: "bomb" | "bolt" | "quiz";
}

/**
 * Pour ajouter un jeu : un dossier `monjeu/index.html` à la racine (voir README),
 * puis une entrée ici. La page d'accueil s'adapte toute seule.
 */
export const GAMES: GameEntry[] = [
  {
    id: "bomberman",
    name: "Boom Brawlers",
    tagline: "L'arène explosive : pose des bombes, esquive, élimine tes amis.",
    href: "./bomberman/",
    players: "1 à 4 joueurs",
    inputs: ["keyboard", "gamepad", "phone"],
    accent: "#ff8a2a",
    accent2: "#ffd23f",
    art: "bomb",
  },
  {
    id: "fighter",
    name: "Rift Brawl",
    tagline: "Combat d'arène à éjection façon Smash : versus entre amis ou contre l'IA.",
    href: "./fighter/",
    players: "1 à 4 joueurs",
    inputs: ["keyboard", "gamepad", "phone", "touch"],
    accent: "#ff3ea5",
    accent2: "#22e6ff",
    art: "bolt",
  },
];
