import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const p = (f: string) => fileURLToPath(new URL(f, import.meta.url));

export default defineConfig({
  // Chemins relatifs : le site fonctionne sur GitHub Pages (/NomDuDepot/),
  // sur un domaine perso ou dans n'importe quel sous-dossier.
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Brique commune « téléphone en manette » (QR code, salle, reconnexion)
      "@party": p("./src/party"),
      // Alias historique du moteur Boom Brawlers
      "@": p("./src/games/bomberman"),
    },
  },
  server: { host: true },
  build: {
    target: "es2020",
    rollupOptions: {
      // Une entrée par page : l'accueil + chaque jeu (+ sa page manette téléphone)
      input: {
        hub: p("./index.html"),
        bomberman: p("./bomberman/index.html"),
        bombermanPad: p("./bomberman/pad.html"),
        fighter: p("./fighter/index.html"),
        fighterPad: p("./fighter/pad.html"),
        bistro: p("./bistro/index.html"),
        bistroPad: p("./bistro/pad.html"),
        blob: p("./blob/index.html"),
        blobPad: p("./blob/pad.html"),
        onehit: p("./onehit/index.html"),
        onehitPad: p("./onehit/pad.html"),
      },
    },
  },
});
