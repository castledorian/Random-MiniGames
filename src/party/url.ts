/** Dossier où est servie la page courante (marche aussi sous /NomDuDepot/jeu/ sur GitHub Pages). */
export function currentBase(): string {
  return new URL(".", window.location.href).href;
}

/** Adresse de la page manette d'un jeu pour une salle donnée. `base` = adresse saisie à la main (facultative). */
export function padUrl(base: string, room: string, file = "pad.html"): string {
  if (typeof window === "undefined") return "";
  let root = base.trim() || currentBase();
  if (!/^https?:\/\//i.test(root)) root = "http://" + root;
  if (!root.endsWith("/")) root += "/";
  try {
    const u = new URL(file, root);
    u.searchParams.set("room", room);
    return u.href;
  } catch {
    return currentBase() + file + "?room=" + room;
  }
}
