// Live updates for the iPhone apps (server/ota.ts, .github/scripts/ota_setup.py, ota-publish.yml).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync as rf } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseVersion, pickUpdate, registerOtaRoutes, releasesFrom } from "../server/ota";

const SUM = "57174f5b05dedc217c735f3bf297a0baeaee63e281b7fa5adbccb7429d7461f0";
const gh = (tag: string, file = `${tag}.zip`, digest: string | null = `sha256:${SUM}`) => ({ tag_name: tag, draft: false, assets: [{ name: file, browser_download_url: `https://github.com/jjrobo180-wq/arisereader/releases/download/${tag}/${file}`, ...(digest ? { digest } : {}) }] });

test("versions: native level, then build minute", () => {
  assert.deepEqual(parseVersion("1.29876543.0"), { level: 1, built: 29876543 });
  assert.equal(parseVersion("builtin"), null);
  assert.equal(parseVersion("1.0"), null);
});

test("an app only gets newer web code made for its own native shell", () => {
  const list = releasesFrom([gh("ota-todo-1.100.0"), gh("ota-todo-1.300.0"), gh("ota-todo-2.400.0"), gh("ota-podplus-1.500.0"), gh("not-ota"), { ...gh("ota-todo-1.900.0"), draft: true }, { tag_name: "ota-fit-1.50.0", assets: [] }]);
  assert.deepEqual(list.map((r) => r.version), ["1.100.0", "1.300.0", "2.400.0", "1.500.0"]);
  assert.equal(pickUpdate(list, "todo", "1.200.0")?.version, "1.300.0");
  assert.equal(pickUpdate(list, "todo", "1.300.0"), null); // already the newest
  assert.equal(pickUpdate(list, "todo", "1.350.0"), null); // its own build is newer than any update
  assert.equal(pickUpdate(list, "todo", "2.1.0")?.version, "2.400.0");
  assert.equal(pickUpdate(list, "todo", "builtin"), null);
  assert.equal(pickUpdate(list, "fit", "1.1.0"), null);
});

test("the endpoint answers the updater's way, and reads GitHub at most every 5 minutes", async () => {
  const routes: Record<string, any> = {};
  const app: any = { post: (p: string, h: any) => { routes[`POST ${p}`] = h; }, put: () => {}, get: () => {} };
  let calls = 0;
  registerOtaRoutes(app, { fetchJson: async () => { calls++; return [gh("ota-todo-1.300.0")]; } });
  const call = async (appId: string, body: any) => { let out: any; let code = 200; const res: any = { set: () => res, status: (c: number) => { code = c; return res; }, json: (b: any) => { out = b; return res; } }; await routes["POST /api/ota/:app"]({ params: { app: appId }, body }, res); return { code, out }; };
  assert.deepEqual((await call("todo", { version_name: "builtin", version_build: "1.200.0" })).out, { version: "1.300.0", url: "https://github.com/jjrobo180-wq/arisereader/releases/download/ota-todo-1.300.0/ota-todo-1.300.0.zip", checksum: SUM });
  assert.equal((await call("todo", { version_name: "1.300.0" })).out.error, "no_new_version_available");
  assert.equal((await call("nope", {})).code, 404);
  assert.equal(calls, 1);
});

test("signed builds set the updater up; the apps say they started fine; master publishes", () => {
  const dir = mkdtempSync(join(tmpdir(), "ota-"));
  writeFileSync(join(dir, "capacitor.config.json"), JSON.stringify({ appId: "x", plugins: {} }));
  execFileSync("python3", [join(process.cwd(), ".github/scripts/ota_setup.py"), "todo"], { cwd: dir });
  const cfg = JSON.parse(rf(join(dir, "capacitor.config.json"), "utf8")).plugins.CapacitorUpdater;
  assert.equal(cfg.updateUrl, "https://arisetodo.com/api/ota/todo");
  assert.equal(cfg.statsUrl, "");
  assert.equal(cfg.autoUpdate, true);
  assert.match(cfg.version, /^1\.\d+\.0$/);
  for (const [wf, app] of [["arisetodo-signed-release", "todo"], ["podplus-testflight", "podplus"], ["fit-ios", "fit"], ["educator-ios", "educator"], ["arisereader-ios", "reader"]]) {
    assert.match(readFileSync(`.github/workflows/${wf}.yml`, "utf8"), new RegExp(`ota_setup\\.py ${app}\\n\\s+npx cap add ios`));
  }
  for (const d of ["arisetodo", "podscroll", "reader", "educator", "fit"]) {
    assert.match(readFileSync(`${d}/ios-app/package.json`, "utf8"), /"@capgo\/capacitor-updater": "\^8/);
    // Only our own server, never an outside one.
    const c = JSON.parse(readFileSync(`${d}/ios-app/capacitor.config.json`, "utf8")).plugins.CapacitorUpdater;
    assert.match(c.updateUrl, /^https:\/\/arisetodo\.com\/api\/ota\//); assert.equal(c.statsUrl, ""); assert.match(c.channelUrl, /^https:\/\/arisetodo\.com\//);
  }
  // Every app tells the updater it started fine, retrying, without needing Capacitor's plugin list
  // (that check failed silently and every downloaded update was rolled back after 15 seconds).
  assert.match(readFileSync("client/src/main.tsx", "utf8"), /markAppReadyWhenDrawn\(\)/);
  assert.match(readFileSync("podscroll/main.tsx", "utf8"), /markAppReadyWhenDrawn\(\)/);
  const nat = readFileSync("client/src/lib/nativeApp.ts", "utf8");
  assert.doesNotMatch(nat.slice(nat.indexOf("export async function markAppReady")), /^[^\n]*hasNativePlugin/m, "the ready signal doesn't depend on the plugin list");
  assert.match(nat, /Plugins\?\.CapacitorUpdater/);
  const pub = readFileSync(".github/workflows/ota-publish.yml", "utf8");
  assert.match(pub, /branches: \[master\]/);
  assert.match(pub, /gh release create "\$TAG" "\$ZIP"/);
});

test("every update offered carries the zip's checksum (the phone's updater refuses one without it)", () => {
  const list = releasesFrom([gh("ota-todo-1.300.0"), gh("ota-todo-1.400.0", undefined, null), gh("ota-todo-1.500.0", undefined, "sha256:nothex")]);
  assert.deepEqual(list.map((r) => r.version), ["1.300.0"], "no checksum, not offered");
  assert.equal(list[0].checksum, SUM);
  assert.match(readFileSync("server/ota.ts", "utf8"), /checksum: next\.checksum/);
});
