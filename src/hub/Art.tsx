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
  if (kind === "chef") {
    return (
      <svg viewBox="0 0 200 140" className="h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="cg" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor={b} stopOpacity="0.5" />
            <stop offset="1" stopColor={a} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="72" r="64" fill="url(#cg)" />
        {/* poêle */}
        <ellipse cx="96" cy="92" rx="52" ry="16" fill="#1d2140" stroke="#0b0d20" strokeWidth="4" />
        <ellipse cx="96" cy="88" rx="44" ry="11" fill="#2c3566" />
        <rect x="146" y="84" width="44" height="10" rx="5" fill="#8b5a2b" stroke="#0b0d20" strokeWidth="3" />
        {/* burger qui saute */}
        <g transform="translate(96 46)">
          <path d="M-26 0a26 18 0 0 1 52 0z" fill={b} stroke="#0b0d20" strokeWidth="3" />
          <rect x="-28" y="1" width="56" height="7" rx="3" fill="#5ea83a" />
          <rect x="-26" y="8" width="52" height="9" rx="4" fill="#6b3a1e" />
          <rect x="-26" y="18" width="52" height="8" rx="4" fill={a} stroke="#0b0d20" strokeWidth="3" />
          <g fill="#fff3c0">
            <circle cx="-10" cy="-8" r="2" />
            <circle cx="4" cy="-11" r="2" />
            <circle cx="14" cy="-6" r="2" />
          </g>
        </g>
        <g stroke={a} strokeWidth="4" strokeLinecap="round" opacity="0.9">
          <path d="M40 34l10 8M160 30l-10 9M38 64h12M150 60h12" />
        </g>
      </svg>
    );
  }
  if (kind === "blob") {
    const blobs: [number, number, number, string][] = [
      [62, 98, 22, a],
      [104, 102, 24, b],
      [146, 96, 22, "#38e08a"],
      [84, 58, 20, "#22b8ff"],
      [126, 60, 21, a],
    ];
    return (
      <svg viewBox="0 0 200 140" className="h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="blg" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor={b} stopOpacity="0.45" />
            <stop offset="1" stopColor={a} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="74" r="66" fill="url(#blg)" />
        {blobs.map(([x, y, r, c], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={r} fill={c} stroke="#1b0b33" strokeWidth="3" />
            <ellipse cx={x - r * 0.35} cy={y - r * 0.45} rx={r * 0.3} ry={r * 0.18} fill="#fff" opacity="0.5" />
            <circle cx={x - r * 0.33} cy={y + 2} r={r * 0.22} fill="#fff" />
            <circle cx={x + r * 0.33} cy={y + 2} r={r * 0.22} fill="#fff" />
            <circle cx={x - r * 0.3} cy={y + 3} r={r * 0.11} fill="#1b0b33" />
            <circle cx={x + r * 0.3} cy={y + 3} r={r * 0.11} fill="#1b0b33" />
          </g>
        ))}
        <g stroke={b} strokeWidth="4" strokeLinecap="round" opacity="0.9">
          <path d="M30 40l12 8M170 36l-12 9M100 12v14" />
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
