// Run after: npx vite build --config podscroll/vite.config.ts
// The standalone website has a marketing homepage at / and the actual Pod+ app
// at /app/. Capacitor launches /index.html; put the app there for the native build.
import { copyFile, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const here = fileURLToPath(new URL(".", import.meta.url));
const dist = join(here, "..", "dist");
const source = join(dist, "app", "index.html");
const target = join(dist, "index.html");
const html = await readFile(source, "utf8");
if (!html.includes("<head") || !html.includes("</html>")) throw new Error("Pod+ app HTML not found or incomplete");
await stat(join(dist, "assets"));
await copyFile(source, target);
console.log("Pod+ iOS web bundle prepared:", target);
