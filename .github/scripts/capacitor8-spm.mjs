// A Capacitor plugin built for Capacitor 7 (like @capacitor-community/apple-sign-in) pins its Swift
// package to capacitor-swift-pm 7.x, which can't be resolved next to Capacitor 8 and stops the iOS build.
// The plugin's code works on Capacitor 8, so its Package.swift is pointed at 8.0.0 after npm install.
// Run from an ios-app folder: node ../../.github/scripts/capacitor8-spm.mjs
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = "node_modules";
const dirs = [];
for (const name of await readdir(root).catch(() => [])) {
  if (name.startsWith("@")) for (const sub of await readdir(join(root, name)).catch(() => [])) dirs.push(join(root, name, sub));
  else dirs.push(join(root, name));
}
for (const dir of dirs) {
  const file = join(dir, "Package.swift");
  const text = await readFile(file, "utf8").catch(() => null);
  if (!text || !/capacitor-swift-pm/.test(text)) continue;
  const fixed = text.replace(/(capacitor-swift-pm(?:\.git)?"\s*,\s*from:\s*")[0-7]\.[0-9.]+(")/g, "$18.0.0$2");
  if (fixed !== text) { await writeFile(file, fixed); console.log(`Capacitor 8: ${file} now uses capacitor-swift-pm 8`); }
}
