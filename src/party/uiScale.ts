/**
 * Mise à l'échelle des menus sur les grands écrans : sur un écran 1080p ou 4K,
 * les menus (pensés pour ~1280×780) sont agrandis proportionnellement au lieu
 * de rester minuscules au milieu. Les éléments marqués `.ui-zoom` utilisent `zoom: var(--ui)`.
 */
export function installUiScale(baseW = 1280, baseH = 780, max = 1.75) {
  if (typeof window === "undefined") return;
  const apply = () => {
    const s = Math.max(1, Math.min(max, Math.min(window.innerWidth / baseW, window.innerHeight / baseH)));
    document.documentElement.style.setProperty("--ui", s.toFixed(3));
  };
  apply();
  window.addEventListener("resize", apply);
}
