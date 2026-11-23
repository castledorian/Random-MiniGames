import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { HostState } from "./host";
import { currentBase, padUrl } from "./url";

interface Props {
  room: string;
  linkState: HostState;
  pads: { pid: string; name: string }[];
  /** Couleur d'accent du jeu. */
  accent?: string;
  /** Texte d'explication propre au jeu. */
  hint?: string;
  onClose: () => void;
}

const BASE_KEY = "party_pad_base";

/** Fenêtre « Manette téléphone » (QR code + code de salle), commune à tous les jeux. */
export default function PairDialog({ room, linkState, pads, accent = "#22e6ff", hint, onClose }: Props) {
  const [qr, setQr] = useState("");
  const [base, setBase] = useState(() => {
    try {
      return localStorage.getItem(BASE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const url = padUrl(base, room);
  const isLocal = /localhost|127\.0\.0\.1|\[::1\]/.test(url);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: 300, color: { dark: "#0b1022", light: "#ffffff" } })
      .then((d) => alive && setQr(d))
      .catch(() => alive && setQr(""));
    return () => {
      alive = false;
    };
  }, [url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stateColor = linkState === "ready" ? "#7cf5a1" : linkState === "connecting" ? "#ffd23f" : "#ff4d6d";
  const label =
    linkState === "ready"
      ? "● Salle ouverte : les téléphones peuvent se connecter"
      : linkState === "connecting"
        ? "◌ Ouverture de la salle…"
        : "⚠ Service de connexion injoignable, nouvel essai automatique… (vérifiez Internet)";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-black/70 p-3 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl border-2 p-5 text-white shadow-2xl"
        style={{ background: "linear-gradient(180deg,#1b2550,#111836)", borderColor: accent + "55" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black uppercase italic" style={{ color: accent }}>
              📱 Manette téléphone
            </h2>
            <p className="mt-1 text-sm font-semibold text-white/65">
              {hint ?? "Scannez le QR code avec l'appareil photo de votre smartphone : il devient une manette."} Le même Wi-Fi que cet écran donne la meilleure réactivité.
            </p>
          </div>
          <button className="rounded-lg border border-white/20 px-3 py-1 text-sm font-black" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
          <div className="mx-auto h-fit w-fit rounded-2xl bg-white p-2" style={{ boxShadow: `0 0 40px ${accent}55` }}>
            {qr ? (
              <img src={qr} alt="QR code de connexion manette" width={220} height={220} className="block h-[220px] w-[220px]" />
            ) : (
              <div className="grid h-[220px] w-[220px] place-items-center text-sm text-slate-500">Génération…</div>
            )}
          </div>

          <div className="min-w-0 space-y-3 text-sm">
            <div className="rounded-lg bg-black/30 px-2 py-1 text-xs font-bold" style={{ color: stateColor }}>
              {label}
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-white/50">Code de salle</div>
              <div className="text-4xl font-black tracking-[0.3em] text-[#ffd23f]">{room}</div>
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-white/50">Adresse de la manette</div>
              <div className="break-all rounded-lg bg-black/40 px-2 py-1.5 font-mono text-xs" style={{ color: accent }}>
                {url}
              </div>
            </div>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-widest text-white/50">Adresse de ce jeu (si besoin)</span>
              <input
                value={base}
                placeholder={currentBase()}
                onChange={(e) => setBase(e.target.value)}
                onBlur={() => {
                  try {
                    localStorage.setItem(BASE_KEY, base.trim());
                  } catch {
                    /* ignore */
                  }
                }}
                className="mt-1 w-full rounded-lg border-2 border-white/15 bg-black/40 px-2 py-1.5 font-mono text-xs text-white outline-none"
                style={{ userSelect: "text" }}
              />
            </label>
            {isLocal && (
              <div className="rounded-lg border border-orange-400/60 bg-orange-400/10 p-2 text-xs font-semibold text-orange-300">
                ⚠ Vous êtes sur « localhost » : un téléphone ne peut pas l&apos;atteindre. Saisissez l&apos;adresse IP locale de cet ordinateur dans le champ ci-dessus.
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-black/30 p-3">
          <div className="text-xs font-black uppercase tracking-widest text-white/50">Téléphones connectés ({pads.length})</div>
          {pads.length === 0 ? (
            <div className="mt-1 text-sm font-semibold text-white/55">En attente d&apos;une connexion…</div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {pads.map((p) => (
                <span key={p.pid} className="rounded-full border border-[#7cf5a1] px-3 py-1 text-xs font-black text-[#7cf5a1]">
                  ● {p.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 text-right">
          <button className="rounded-xl px-6 py-2 font-black uppercase text-[#0b1022]" style={{ background: "linear-gradient(180deg,#ffe066,#ffb703)" }} onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
