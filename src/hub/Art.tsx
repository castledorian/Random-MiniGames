import type { GameEntry } from "./games";

/** Petites illustrations originales dessinées en SVG pour chaque carte. */
export default function Art({ kind, a, b }: { kind: GameEntry["art"]; a: string; b: string }) {
  if (kind === "bomb") {
    return (
      <svg viewBox="0 0 200 140" className="h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="bm" cx="35%" cy="30%" r="80%">
            <stop offset="0" stopColor="#6b75a8" />
            <stop offset="0.55" stopColor="#1a1f3e" />
            <stop offset="1" stopColor="#05060f" />
          </radialGradient>
          <radialGradient id="bf" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#fff6c2" />
            <stop offset="0.4" stopColor={b} />
            <stop offset="1" stopColor={a} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="72" r="62" fill="url(#bf)" opacity="0.55" />
        <g stroke={b} strokeWidth="6" strokeLinecap="round" opacity="0.9">
          <path d="M100 10v18M100 118v14M30 72H14M186 72h-16M52 24l10 12M148 24l-10 12M52 120l10-12M148 120l-10-12" />
        </g>
        <circle cx="100" cy="78" r="36" fill="url(#bm)" />
        <ellipse cx="88" cy="64" rx="9" ry="6" fill="#fff" opacity="0.25" />
        <rect x="96" y="36" width="9" height="12" rx="3" fill="#8b6a3f" transform="rotate(14 100 42)" />
        <path d="M104 38c8-10 16-8 20-18" fill="none" stroke="#c9b27c" strokeWidth="3" strokeLinecap="round" />
        <circle cx="125" cy="18" r="7" fill={b} />
        <circle cx="125" cy="18" r="3" fill="#fff" />
      </svg>
    );
  }
  if (kind === "bolt") {
    return (
      <svg viewBox="0 0 200 140" className="h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="bl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff6a0" />
            <stop offset="1" stopColor="#ffb100" />
          </linearGradient>
          <radialGradient id="bg2" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor={b} stopOpacity="0.55" />
            <stop offset="1" stopColor={a} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="70" r="66" fill="url(#bg2)" />
        <g fill={a} opacity="0.95">
          <path d="M26 112l22-8-8 22z" />
          <path d="M170 24l-16 14 22 4z" />
          <path d="M160 108l10 16-22-6z" />
        </g>
        <path d="M112 8L52 80h40l-12 54 68-80h-42z" fill="url(#bl)" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
        <g stroke={b} strokeWidth="5" strokeLinecap="round">
          <path d="M20 40l22 8M16 72l24-2M184 78l-22-4M178 50l-20 8" />
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 200 140" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="qg" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={b} stopOpacity="0.45" />
          <stop offset="1" stopColor={a} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="70" r="66" fill="url(#qg)" />
      <rect x="44" y="22" width="112" height="70" rx="18" fill="#10204a" stroke={a} strokeWidth="5" />
      <path d="M76 92l-10 22 30-22z" fill="#10204a" stroke={a} strokeWidth="5" strokeLinejoin="round" />
      <text x="100" y="76" textAnchor="middle" fontSize="54" fontWeight="900" fill={b} fontFamily="Trebuchet MS, system-ui, sans-serif">
        ?
      </text>
      <g fill={a}>
        <circle cx="26" cy="40" r="7" />
        <circle cx="176" cy="104" r="9" />
        <circle cx="170" cy="30" r="5" />
      </g>
    </svg>
  );
}
