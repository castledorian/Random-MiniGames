import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Chemins relatifs : le site fonctionne sur GitHub Pages (/BomberMan-Random/),
  // sur un domaine perso ou dans un sous-dossier du futur site « hub ».
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { host: true },
  build: {
    target: "es2020",
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        pad: fileURLToPath(new URL("./pad.html", import.meta.url)),
      },
    },
  },
});
