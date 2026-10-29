// Prepare the actual Pod+ application as the native launch page.
// Requires a Vite build made with PODPLUS_IOS=1 (relative asset URLs).
import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const here = fileURLToPath(new URL(".", import.meta.url));
const dist = join(here, "..", "dist");
const source = join(dist, "app", "index.html");
const target = join(dist, "index.html");
let html = await readFile(source, "utf8");
if (!html.includes("<head") || !html.includes("</html>")) throw new Error("Pod+ app HTML missing or incomplete");
await stat(join(dist, "assets"));
// Moving /app/index.html to /index.html changes the relative path depth.
html = html.replaceAll("../assets/", "./assets/");
await writeFile(target, html);
console.log("Pod+ native launch page prepared:", target);
