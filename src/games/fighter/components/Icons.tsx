import type { ModeId, SpecialId } from "../game/constants";

interface P {
  className?: string;
}

const base = { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true } as const;
const line = { fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Speaker = ({ on, className }: P & { on: boolean }) => (
  <svg {...base} className={className}>
    <path d="M3 9v6h4l5 4V5L7 9H3z" />
    {on ? (
      <path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" {...line} strokeWidth={2} />
    ) : (
      <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" {...line} strokeWidth={2} />
    )}
  </svg>
);

export const Trophy = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M7 3.5h10V9a5 5 0 01-10 0V3.5z" />
    <path d="M7 5.5H3.8V8A3.2 3.2 0 007 11.2M17 5.5h3.2V8a3.2 3.2 0 01-3.2 3.2" {...line} strokeWidth={1.8} />
    <rect x="10.5" y="14" width="3" height="4" />
    <rect x="7.5" y="18" width="9" height="2.8" rx="1" />
  </svg>
);

export const Phone = ({ className }: P) => (
  <svg {...base} className={className}>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.6" {...line} strokeWidth={2} />
    <circle cx="12" cy="18" r="1.3" />
  </svg>
);

export const Bolt = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M13.5 2L5 13.5h6L10 22l9-12h-6.2L13.5 2z" />
  </svg>
);
export const Shield = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6l8-3z" />
  </svg>
);
export const Dash = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4 6l6 6-6 6M11 6l6 6-6 6M18 7l3 5-3 5" {...line} />
  </svg>
);
export const Flame = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 2c1 4 5.5 6 5.5 11a5.5 5.5 0 01-11 0c0-2 1-3.5 2.2-4.6 0 2 .9 3 2 3-.3-4-1.2-6 1.3-9.4z" />
  </svg>
);
export const Star = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 2l3 6.8 7.2.7-5.4 4.8 1.6 7.2L12 17.8 5.6 21.5l1.6-7.2L1.8 9.5l7.2-.7L12 2z" />
  </svg>
);
export const Skull = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 2.5a8.5 8.5 0 00-8.5 8.5c0 3 1.6 4.6 3.2 5.6V21h10.6v-4.4c1.6-1 3.2-2.6 3.2-5.6A8.5 8.5 0 0012 2.5z" />
    <circle cx="8.6" cy="11.2" r="2.1" fill="#0b0720" />
    <circle cx="15.4" cy="11.2" r="2.1" fill="#0b0720" />
    <path d="M10.5 16v3M13.5 16v3" stroke="#0b0720" strokeWidth="1.4" />
  </svg>
);
export const Clock = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12.5" r="8.5" {...line} strokeWidth={2.2} />
    <path d="M12 7.5v5l3.4 2M9.5 2.5h5" {...line} strokeWidth={2.2} />
  </svg>
);

export const SpecialIcon = ({ id, className }: P & { id: SpecialId }) => {
  switch (id) {
    case "bolt":
      return <Bolt className={className} />;
    case "shield":
      return <Shield className={className} />;
    case "dash":
      return <Dash className={className} />;
    default:
      return <Flame className={className} />;
  }
};

export const ModeIcon = ({ id, className }: P & { id: ModeId }) => {
  if (id === "arcade") return <Star className={className} />;
  if (id === "survival") return <Skull className={className} />;
  return <Clock className={className} />;
};
