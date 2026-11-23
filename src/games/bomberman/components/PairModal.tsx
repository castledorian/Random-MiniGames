import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { AppCtx } from "./shared";

export default function PairModal({ app, onClose }: { app: AppCtx; onClose: () => void }) {
  const [qr, setQr] = useState("");
  const [base, setBase] = useState(app.profile.padBase || "");
  const url = padUrl(base, app.room);
  const isLocal = /localhost|127\.0\.0\.1|\[::1\]/.test(url);
  const link = app.linkState;

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

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-black/70 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="panel pop-in w-full max-w-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black uppercase italic text-[var(--pink)]">📱 Manette téléphone</h2>
            <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
              Scannez le QR code avec l&apos;appareil photo de votre smartphone : il devient une manette avec joystick, bouton BOMBE et SKILL. Le même Wi-Fi que cet écran donne la meilleure réactivité.
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
          <div className="mx-auto w-fit rounded-2xl bg-white p-2 shadow-[0_0_40px_rgba(255,95,196,0.35)]">
            {qr ? (
              <img src={qr} alt="QR code de connexion manette" width={220} height={220} className="block h-[220px] w-[220px]" />
            ) : (
              <div className="grid h-[220px] w-[220px] place-items-center text-sm text-slate-500">Génération…</div>
            )}
          </div>

          <div className="min-w-0 space-y-3 text-sm">
            <div
              className="rounded-lg px-2 py-1 text-xs font-bold"
              style={{
                color: link === "ready" ? "var(--green)" : link === "connecting" ? "var(--yellow)" : "var(--red)",
                background: "rgba(0,0,0,0.3)",
              }}
            >
              {link === "ready"
                ? "● Salle ouverte : les téléphones peuvent se connecter"
                : link === "connecting"
                  ? "◌ Ouverture de la salle…"
                  : "⚠ Service de connexion injoignable, nouvel essai automatique… (vérifiez Internet)"}
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Code de salle</div>
              <div className="text-4xl font-black tracking-[0.3em] text-[var(--yellow)]">{app.room}</div>
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Adresse de la manette</div>
              <div className="break-all rounded-lg bg-black/40 px-2 py-1.5 font-mono text-xs text-[var(--cyan)]">{url}</div>
            </div>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Adresse de ce jeu (si besoin)</span>
              <input
                value={base}
                placeholder={typeof window !== "undefined" ? currentBase() : "http://192.168.1.20:5173/"}
                onChange={(e) => setBase(e.target.value)}
                onBlur={() => app.updateProfile({ padBase: base.trim() })}
                className="mt-1 w-full rounded-lg border-2 border-white/15 bg-black/40 px-2 py-1.5 font-mono text-xs text-white outline-none focus:border-[var(--cyan)]"
              />
            </label>
            {isLocal && (
              <div className="rounded-lg border border-[var(--orange)]/60 bg-[var(--orange)]/10 p-2 text-xs font-semibold text-[var(--orange)]">
                ⚠ Vous êtes sur « localhost » : un téléphone ne peut pas l&apos;atteindre. Saisissez l&apos;adresse IP locale de cet ordinateur (ex.{" "}
                <span className="font-mono">http://192.168.1.20:5173/</span>) dans le champ ci-dessus.
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-black/30 p-3">
          <div className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Téléphones connectés ({app.pads.length})</div>
          {app.pads.length === 0 ? (
            <div className="mt-1 text-sm font-semibold text-[var(--muted)]">En attente d&apos;une connexion…</div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {app.pads.map((p) => (
                <span key={p.pid} className="chip" style={{ color: "var(--green)", borderColor: "var(--green)" }}>
                  ● {p.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 text-right">
          <button className="btn" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

/** Dossier où est servi le jeu (fonctionne aussi sous /BomberMan-Random/ sur GitHub Pages). */
function currentBase(): string {
  return new URL(".", window.location.href).href;
}

export function padUrl(base: string, room: string): string {
  if (typeof window === "undefined") return "";
  let root = base.trim() || currentBase();
  if (!/^https?:\/\//i.test(root)) root = "http://" + root;
  if (!root.endsWith("/")) root += "/";
  try {
    const u = new URL("pad.html", root);
    u.searchParams.set("room", room);
    return u.href;
  } catch {
    return currentBase() + "pad.html?room=" + room;
  }
}
