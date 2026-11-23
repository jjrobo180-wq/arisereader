import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  // True only in the Arise To Duo iPhone app's own build (vite.todo.config.ts).
  define: { __TODO_APP__: "false" },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  base: "./",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Render's build has a 2 GB machine; working out each file's gzip size for the report holds every file in
    // memory at the end and ran it out of memory (Nov 18, 2026). The sizes are only printed, never used.
    reportCompressedSize: false,
    // Not keeping Rollup's module cache after the build lowers its peak memory on that 2 GB machine (out of memory
    // again on Nov 22, 2026, while rendering chunks).
    // Two pages: the A.R.I.S.E. / Arise To Duo app, and Arise Notes on its own at /notes/.
    rollupOptions: {
      cache: false,
      input: {
        main: path.resolve(import.meta.dirname, "client", "index.html"),
        notes: path.resolve(import.meta.dirname, "client", "notes", "index.html"),
        undercover: path.resolve(import.meta.dirname, "client", "undercover", "index.html"),
        scholar: path.resolve(import.meta.dirname, "client", "scholar", "index.html"),
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
