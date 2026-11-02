import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
const root = path.resolve(__dirname, "../..");
export default defineConfig({
  root: __dirname, base: "./", mode: "development",
  plugins: [react()],
  css: { postcss: root },
  define: { "import.meta.env.DEV": "true" },
  resolve: { alias: [
    { find: /^@\/context\/AuthContext$/, replacement: path.resolve(__dirname, "auth-stub.ts") },
    { find: "@shared", replacement: path.resolve(root, "shared") },
    { find: "@", replacement: path.resolve(root, "client/src") },
  ] },
  build: { outDir: path.resolve(__dirname, "dist"), emptyOutDir: true, minify: false },
});
