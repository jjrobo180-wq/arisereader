// Build the same React source twice, producing two independent iOS web bundles.
// Each app keeps its own native Xcode project, identifier, icon, and start route.
import { spawnSync } from "node:child_process";
import { cp, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = process.argv[2];
if (!["reader", "todo"].includes(app)) {
  console.error("Usage: node script/build-mobile.mjs reader|todo");
  process.exit(2);
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npm, ["run", "build"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, VITE_ARISE_NATIVE_APP: app },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

const source = resolve(root, "dist", "public");
const destination = resolve(root, "mobile", app, "www");
await stat(resolve(source, "index.html")); // Don't erase the last bundle if the build failed.
await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true });
console.log(`Prepared ${app} iOS web assets in ${destination}`);
