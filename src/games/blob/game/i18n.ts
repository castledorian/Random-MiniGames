import { useSyncExternalStore } from 'react';
import type { L2 } from './constants';
import { load, save } from './storage';

export type Lang = 'en' | 'fr';

const EN = {
  // canvas
  ready: 'READY',
  readyQ: 'READY?',
  go: 'GO!',
  score: 'SCORE',
  next: 'NEXT',
  chain: 'CHAIN',
  great: 'GREAT!',
  amazing: 'AMAZING!',
  legendary: 'LEGENDARY!!',
  blocked: 'BLOCKED',
  notReady: 'Skill charging',
  noTarget: 'Nothing to hit!',
  allClear: 'ALL CLEAR!',
  skillReady: 'SKILL READY!',
  topOut: 'TOP OUT!',
  ko: 'K.O.!',
  timeUp: "TIME'S UP!",
  you: 'YOU',
  stage: 'STAGE',
  timeLeft: 'TIME LEFT',
  level: 'LEVEL',
  time: 'TIME',
  rain: 'GARBAGE RAIN',
  best: 'BEST',
  maxChain: 'MAX CHAIN',
  incoming: 'INCOMING',
  kMove: 'Move',
  kRotate: 'Rotate',
  kSoft: 'Soft drop',
  kSlam: 'Slam',
  kSkill: 'Skill',
  kPause: 'Pause',
  hK1: 'How to play',
  hK2: '← →  move   ↑  rotate   ↓  drop',
  hK3: 'Space slam  •  Shift = hero skill',
  hT1: 'How to play',
  hT2: 'Tap the board: rotate • Swipe ↓: slam',
  hT3: 'Fill the ring, then hit ⚡ for your skill',
  // menu
  tagline: 'Chain blobs. Crush rivals.',
  play: 'PLAY',
  playSub: 'Campaign · Stage {n}',
  pressEnter: 'Press Enter to play',
  heroes: 'Choose your hero',
  passive: 'Passive',
  skill: 'Skill',
  modes: 'Game modes',
  mCampaign: 'Campaign',
  mCampaignD: '8 stages against AI rivals',
  mVersus: 'Versus',
  mVersusD: 'Quick duel against the AI',
  mScore: 'Score Attack',
  mScoreD: '3 minutes. Biggest score wins.',
  mSurvival: 'Survival',
  mSurvivalD: 'Endless garbage rain. Last as long as you can.',
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  scores: 'High scores',
  howto: 'How to play',
  stars: 'Stars',
  select: 'Select a stage',
  locked: 'Locked',
  start: 'Start',
  close: 'Close',
  noScores: 'No scores yet. Go set one!',
  sound: 'Sound',
  music: 'Music',
  // game ui
  paused: 'PAUSED',
  resume: 'Resume',
  restart: 'Restart',
  menu: 'Menu',
  victory: 'VICTORY!',
  defeat: 'DEFEAT',
  gameOver: 'GAME OVER',
  finalScore: 'FINAL SCORE',
  newHigh: 'NEW HIGH SCORE',
  rank: 'Rank',
  retry: 'Retry',
  nextStage: 'Next stage',
  bonus: 'Win bonus',
  sent: 'Garbage sent',
  initials: 'Initials',
  hero: 'Hero',
  survived: 'Survived',
  stageN: 'Stage {n}',
  allDone: 'Campaign complete!',
  // controls
  cLeft: 'Left',
  cRight: 'Right',
  cDown: 'Drop',
  cRotL: 'Rotate left',
  cRotR: 'Rotate right',
  cSkill: 'Skill',
  // how to
  rules: 'Rules',
  r1: 'Drop colored blob pairs. Connect 4 or more of the same color to pop them.',
  r2: 'Pops can cascade into chains. Every link of a chain hits harder than the last.',
  r3: 'Chains send garbage blobs to your rival. Garbage pops when it touches a pop.',
  r4: 'Incoming garbage shows above your board. Chain first to cancel it!',
  r5: 'Fill your hero ring with pops, then unleash the skill. Passives are always on.',
  r6: 'Keep the red ✕ cell free. If it gets blocked, you lose.',
  controls: 'Controls',
  keyboard: 'Keyboard',
  touch: 'Touch',
  tMove: 'Left / Right buttons: move (hold to slide)',
  tRot: 'Rotate buttons — or tap the board',
  tDrop: 'Hold ▼ to drop faster — or swipe down on the board to slam',
  tSkill: '⚡ button: hero skill (glows when ready)',
  kbMove: '← → / A D : move',
  kbRot: '↑ / X : rotate right   Z : rotate left',
  kbDrop: '↓ / S : soft drop   Space : slam',
  kbSkill: 'Shift / C / E : hero skill',
  kbOther: 'P / Esc : pause   R : instant restart',
  language: 'Language',
} as const;

export type Key = keyof typeof EN;

const FR: Record<Key, string> = {
  ready: 'PRÊT',
  readyQ: 'PRÊT ?',
  go: 'GO !',
  score: 'SCORE',
  next: 'SUIVANT',
  chain: 'CHAÎNE',
  great: 'SUPER !',
  amazing: 'INCROYABLE !',
  legendary: 'LÉGENDAIRE !!',
  blocked: 'BLOQUÉ',
  notReady: 'Compétence en charge',
  noTarget: 'Aucune cible !',
  allClear: 'GRILLE VIDE !',
  skillReady: 'COMPÉTENCE PRÊTE !',
  topOut: 'DÉBORDEMENT !',
  ko: 'K.O. !',
  timeUp: 'TEMPS ÉCOULÉ !',
  you: 'TOI',
  stage: 'NIVEAU',
  timeLeft: 'TEMPS',
  level: 'NIVEAU',
  time: 'TEMPS',
  rain: 'PLUIE DE MALUS',
  best: 'RECORD',
  maxChain: 'CHAÎNE MAX',
  incoming: 'MALUS',
  kMove: 'Bouger',
  kRotate: 'Tourner',
  kSoft: 'Descente',
  kSlam: 'Chute directe',
  kSkill: 'Compétence',
  kPause: 'Pause',
  hK1: 'Comment jouer',
  hK2: '← →  bouger   ↑  tourner   ↓  descendre',
  hK3: 'Espace chute  •  Maj = compétence',
  hT1: 'Comment jouer',
  hT2: 'Touche la grille : tourner • Glisse ↓ : chute',
  hT3: 'Remplis l’anneau puis ⚡ pour ta compétence',
  tagline: 'Enchaîne les blobs. Écrase tes rivaux.',
  play: 'JOUER',
  playSub: 'Campagne · Niveau {n}',
  pressEnter: 'Appuie sur Entrée pour jouer',
  heroes: 'Choisis ton héros',
  passive: 'Passif',
  skill: 'Compétence',
  modes: 'Modes de jeu',
  mCampaign: 'Campagne',
  mCampaignD: '8 niveaux contre des rivaux IA',
  mVersus: 'Versus',
  mVersusD: 'Duel rapide contre l’IA',
  mScore: 'Score Attack',
  mScoreD: '3 minutes. Le plus gros score gagne.',
  mSurvival: 'Survie',
  mSurvivalD: 'Pluie de malus sans fin. Tiens le plus longtemps.',
  easy: 'Facile',
  normal: 'Normal',
  hard: 'Difficile',
  scores: 'Meilleurs scores',
  howto: 'Comment jouer',
  stars: 'Étoiles',
  select: 'Choisis un niveau',
  locked: 'Verrouillé',
  start: 'Lancer',
  close: 'Fermer',
  noScores: 'Aucun score. À toi de jouer !',
  sound: 'Sons',
  music: 'Musique',
  paused: 'PAUSE',
  resume: 'Reprendre',
  restart: 'Recommencer',
  menu: 'Menu',
  victory: 'VICTOIRE !',
  defeat: 'DÉFAITE',
  gameOver: 'GAME OVER',
  finalScore: 'SCORE FINAL',
  newHigh: 'NOUVEAU RECORD',
  rank: 'Rang',
  retry: 'Rejouer',
  nextStage: 'Niveau suivant',
  bonus: 'Bonus de victoire',
  sent: 'Malus envoyés',
  initials: 'Initiales',
  hero: 'Héros',
  survived: 'Survécu',
  stageN: 'Niveau {n}',
  allDone: 'Campagne terminée !',
  cLeft: 'Gauche',
  cRight: 'Droite',
  cDown: 'Descente',
  cRotL: 'Rotation gauche',
  cRotR: 'Rotation droite',
  cSkill: 'Compétence',
  rules: 'Règles',
  r1: 'Fais tomber des paires de blobs. Relie 4 blobs ou plus de la même couleur pour les faire éclater.',
  r2: 'Les éclats peuvent s’enchaîner. Chaque maillon frappe plus fort que le précédent.',
  r3: 'Les chaînes envoient des blobs-malus à ton rival. Un malus éclate s’il touche un éclat.',
  r4: 'Les malus entrants s’affichent au-dessus de ta grille. Enchaîne d’abord pour les annuler !',
  r5: 'Remplis l’anneau de ton héros puis déclenche sa compétence. Les passifs sont toujours actifs.',
  r6: 'Garde la case rouge ✕ libre. Si elle est bloquée, tu perds.',
  controls: 'Contrôles',
  keyboard: 'Clavier',
  touch: 'Tactile',
  tMove: 'Boutons Gauche / Droite : déplacer (maintiens pour glisser)',
  tRot: 'Boutons de rotation — ou touche la grille',
  tDrop: 'Maintiens ▼ pour descendre vite — ou glisse vers le bas pour la chute directe',
  tSkill: 'Bouton ⚡ : compétence du héros (brille quand prête)',
  kbMove: '← → / Q D : déplacer',
  kbRot: '↑ / X : rotation droite   Z : rotation gauche',
  kbDrop: '↓ / S : descente   Espace : chute directe',
  kbSkill: 'Maj / C / E : compétence du héros',
  kbOther: 'P / Échap : pause   R : redémarrage instantané',
  language: 'Langue',
};

const DICT: Record<Lang, Record<Key, string>> = { en: EN, fr: FR };

let lang: Lang = (() => {
  const s = load().lang;
  if (s === 'fr' || s === 'en') return s;
  try {
    return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'fr';
  } catch {
    return 'en';
  }
})();

const listeners = new Set<() => void>();

export function getLang(): Lang {
  return lang;
}

export function setLang(l: Lang) {
  lang = l;
  save({ lang: l });
  listeners.forEach((f) => f());
}

export function t(key: Key, vars?: Record<string, string | number>): string {
  let s = DICT[lang][key] ?? EN[key];
  if (vars) for (const k of Object.keys(vars)) s = s.replace(`{${k}}`, String(vars[k]));
  return s;
}

export function L(x: L2): string {
  return x[lang];
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => lang
  );
}
