import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// An independent, separately deployed site. It never uses Reader's application,
// router, account cookie, or backend. The repository only supplies the build tools.
export default defineConfig({
  root: resolve(process.cwd(), "beginners-standalone"),
  base: "/",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true, assetsDir: "assets" },
});