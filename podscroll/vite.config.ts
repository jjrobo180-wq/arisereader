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
  // A native Capacitor WebView loads bundled files from capacitor://localhost.
  base: process.env.PODPLUS_IOS === "1" ? "./" : "/",
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
  // Pages: the A.R.I.S.E Pod+ homepage at /, Pod+ for Creators at /creators/, and the player itself at /app/.
  build: { outDir: "dist", emptyOutDir: true, assetsDir: "assets", rollupOptions: { input: { home: resolve(repo, "podscroll/index.html"), app: resolve(repo, "podscroll/app/index.html"), creators: resolve(repo, "podscroll/creators/index.html") } } },
});
