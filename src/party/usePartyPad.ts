import { useCallback, useEffect, useRef, useState } from "react";
import { PartyPad, type PadPhase } from "./pad";
import { cleanRoomCode } from "./protocol";

/**
 * Logique commune des pages « manette » : connexion à la salle, pseudo mémorisé,
 * état envoyé par l'écran, reconnexion quand le téléphone se réveille.
 */
export function usePartyPad<S extends Record<string, unknown>>(gameId: string, buttons: number) {
  const padRef = useRef<PartyPad | null>(null);
  const [phase, setPhase] = useState<PadPhase>("idle");
  const [err, setErr] = useState("");
  const [room, setRoom] = useState("");
  const [status, setStatus] = useState<S | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const nameKey = "party_padname";

  useEffect(() => {
    const pad = new PartyPad({ gameId, buttons });
    padRef.current = pad;
    pad.onPhase = (p, e) => {
      if (p === "idle") return;
      setPhase(p);
      setErr(e);
      if (p === "on") setRoom(pad.room);
    };
    pad.onStatus = (s) => setStatus(s as S | null);
    let saved = "";
    try {
      saved = localStorage.getItem(nameKey) || "";
    } catch {
      /* ignore */
    }
    setName(saved);
    const q = new URLSearchParams(window.location.search).get("room");
    if (q) {
      setCode(cleanRoomCode(q));
      if (saved) {
        setPhase("joining");
        pad.join(q, saved);
      }
    }
    return () => {
      pad.leave(false);
      padRef.current = null;
    };
  }, [gameId, buttons]);

  // Écran allumé + relâcher les commandes quand le téléphone se verrouille
  useEffect(() => {
    if (phase !== "on") return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } };
    const req = () => nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => undefined);
    void req();
    const vis = () => {
      if (document.visibilityState === "visible") {
        void req();
        padRef.current?.wake();
      } else padRef.current?.release();
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      void lock?.release();
    };
  }, [phase]);

  const join = useCallback(
    (c: string) => {
      const pad = padRef.current;
      const clean = cleanRoomCode(c);
      if (!pad || !clean) return;
      const n = name.trim() || "Joueur " + Math.floor(Math.random() * 90 + 10);
      try {
        localStorage.setItem(nameKey, n);
      } catch {
        /* ignore */
      }
      setName(n);
      setErr("");
      setPhase("joining");
      pad.join(clean, n);
    },
    [name],
  );

  return { pad: padRef, phase, err, room, status, name, setName, code, setCode, join };
}
