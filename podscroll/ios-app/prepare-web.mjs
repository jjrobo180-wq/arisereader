// Run after: npx vite build --config podscroll/vite.config.ts
// The standalone website has a marketing homepage at / and the actual Pod+ app
// at /app/. Capacitor launches /index.html; put the app there for the native build.
import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const here = fileURLToPath(new URL(".", import.meta.url));
const dist = join(here, "..", "dist");
const source = join(dist, "app", "index.html");
const target = join(dist, "index.html");
let html = await readFile(source, "utf8");
if (!html.includes("<head") || !html.includes("</html>")) throw new Error("Pod+ app HTML not found or incomplete");
await stat(join(dist, "assets"));
// The /app/index.html page is lifted to /index.html for Capacitor. Vite\n// emits ../assets/* URLs from the nested /app page; fix their base depth.\nhtml = html.replace(/([="'])\\.\\.\\/assets\\//g, "$1./assets/");\nawait writeFile(target, html);
console.log("Pod+ iOS web bundle prepared:", target);
