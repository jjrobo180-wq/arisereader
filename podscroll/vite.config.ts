import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { resolve } from "node:path";

// Podscroll: an independent website (its own address, no Arise account). It reuses the Earshot
// player and shared podcast logic from this repository, and calls the Arise server's public
// /api/podscroll routes for Apple Podcasts data, likes and comments.
const repo = process.cwd();
export default defineConfig({
  root: resolve(repo, "podscroll"),
  base: "/",
  plugins: [react()],
  resolve: { alias: { "@shared": resolve(repo, "shared") } },
  css: {
    postcss: {
      plugins: [
        tailwindcss({ content: [resolve(repo, "podscroll/**/*.{html,tsx,ts}"), resolve(repo, "client/src/components/family-hub/earshot/*.tsx")], theme: { extend: {} }, plugins: [] }),
        autoprefixer(),
      ],
    },
  },
  build: { outDir: "dist", emptyOutDir: true, assetsDir: "assets" },
});
