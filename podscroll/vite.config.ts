import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { resolve } from "node:path";

// Podscroll: an independent website (its own address, no Arise account). It reuses the Earshot
// player and shared podcast logic from this repository, and calls the Arise server's public
// /api/podscroll routes for Apple Podcasts data, likes and comments.
const repo = process.cwd();

// The pages link to each other as /app/, /creators/ and /. Under a folder base, point them inside it.
function podsterLinks(): Plugin {
  const base = process.env.PODPLUS_IOS === "1" ? "/" : (process.env.PODSTER_BASE || "/");
  return {
    name: "podster-links",
    transformIndexHtml: {
      order: "post",
      handler: (html) => base === "/" ? html : html.replace(/(href|src)="\/(?!\/)/g, (m, attr, off) => html.startsWith(base, off + attr.length + 2) ? m : `${attr}="${base}`),
    },
  };
}
export default defineConfig({
  root: resolve(repo, "podscroll"),
  // A native Capacitor WebView loads bundled files from capacitor://localhost.
  // On arisetodo.com Podster lives at /podster/ (PODSTER_BASE=/podster/, built by script/build.ts).
  base: process.env.PODPLUS_IOS === "1" ? "./" : (process.env.PODSTER_BASE || "/"),
  plugins: [react(), podsterLinks()],
  resolve: { alias: { "@shared": resolve(repo, "shared"), "@": resolve(repo, "client/src") } },
  css: {
    postcss: {
      plugins: [
        tailwindcss({ content: [resolve(repo, "podscroll/**/*.{html,tsx,ts}"), resolve(repo, "client/src/components/family-hub/earshot/**/*.tsx"), resolve(repo, "client/src/components/AllAccess*.tsx")], theme: { extend: {} }, plugins: [] }),
        autoprefixer(),
      ],
    },
  },
  // Pages: the Podster homepage at /, Podster for Creators at /creators/, and the player itself at /app/.
  build: { outDir: "dist", emptyOutDir: true, assetsDir: "assets", rollupOptions: { input: { home: resolve(repo, "podscroll/index.html"), app: resolve(repo, "podscroll/app/index.html"), creators: resolve(repo, "podscroll/creators/index.html") } } },
});
