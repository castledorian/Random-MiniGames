import type { HeroDef } from "../game/heroes";

export function HeroIcon({ hero, size = 64, dim = false }: { hero: HeroDef; size?: number; dim?: boolean }) {
  const c = dim ? "#4b4560" : hero.color;
  const a = dim ? "#8a84a0" : hero.accent;
  return (
    <svg viewBox="0 0 72 80" width={size} height={(size * 80) / 72} aria-hidden>
      {/* scarf */}
      <path d="M26 26 Q10 24 3 33 Q14 32 27 33 Z" fill={a} stroke="#0b0618" strokeWidth="2" strokeLinejoin="round" />
      {/* legs */}
      <rect x="27" y="52" width="7" height="20" rx="3" fill={c} stroke="#0b0618" strokeWidth="2.5" />
      <rect x="38" y="52" width="7" height="20" rx="3" fill={a} stroke="#0b0618" strokeWidth="2.5" />
      {/* torso */}
      <rect x="24" y="28" width="24" height="28" rx="6" fill={c} stroke="#0b0618" strokeWidth="3" />
      <rect x="24" y="46" width="24" height="5" fill={a} />
      {/* head */}
      <circle cx="37" cy="19" r="12" fill="#1a1230" stroke="#0b0618" strokeWidth="3" />
      <rect x="38" y="15" width="12" height="6" rx="1" fill="#fff" />
      {hero.id === "kage" && (
        <g>
          <line x1="48" y1="38" x2="68" y2="8" stroke="#0b0618" strokeWidth="6" strokeLinecap="round" />
          <line x1="48" y1="38" x2="68" y2="8" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <line x1="49" y1="39" x2="68" y2="10" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
        </g>
      )}
      {hero.id === "aegis" && (
        <g>
          <path d="M50 24 h12 q4 0 4 4 v16 q0 8 -10 12 q-10 -4 -10 -12 v-16 q0 -4 4 -4z" fill="#0b0618" />
          <path d="M52 27 h8 q2 0 2 2 v14 q0 6 -6 9 q-6 -3 -6 -9 v-14 q0 -2 2 -2z" fill={c} />
          <rect x="55" y="30" width="2" height="16" fill="#fff" />
        </g>
      )}
      {hero.id === "chrono" && (
        <g>
          <circle cx="58" cy="36" r="11" fill="#0b0618" />
          <circle cx="58" cy="36" r="8" fill="none" stroke={c} strokeWidth="2.5" />
          <line x1="58" y1="36" x2="58" y2="30" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          <line x1="58" y1="36" x2="63" y2="38" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      {hero.id === "volt" && (
        <g>
          <rect x="49" y="32" width="12" height="12" rx="2" fill="#0b0618" />
          <rect x="51" y="34" width="8" height="8" fill={c} />
          <path d="M64 22 L58 34 H64 L60 46" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
