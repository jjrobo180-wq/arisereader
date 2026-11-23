// Live updates for the iPhone apps are off for good (server/ota.ts): App Review 2.5.2 / 2.5.19.
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

test("the endpoint never offers an update, to any app, whatever it's running", async () => {
  const routes: Record<string, any> = {};
  const app: any = { post: (p: string, h: any) => { routes[`POST ${p}`] = h; }, put: () => {}, get: () => {} };
  let calls = 0;
  registerOtaRoutes(app, { fetchJson: async () => { calls++; return [gh("ota-todo-1.300.0"), gh("ota-reader-1.300.0")]; } });
  const call = async (appId: string, body: any) => { let out: any; let code = 200; const res: any = { set: () => res, status: (c: number) => { code = c; return res; }, json: (b: any) => { out = b; return res; } }; await routes["POST /api/ota/:app"]({ params: { app: appId }, body }, res); return { out, code }; };
  for (const id of ["todo", "reader", "educator", "fit", "notes", "podplus"]) {
    const { out } = await call(id, { version_name: "builtin", version_build: "1.200.0" });
    assert.equal(out.error, "no_new_version_available", id);
    assert.equal(out.url, undefined, id);
  }
  assert.equal((await call("nope", {})).code, 404);
  assert.equal(calls, 0, "it doesn't even look for releases");
});

test("no app has the updater, and nothing builds or publishes web code for phones", () => {
  assert.throws(() => readFileSync(".github/workflows/ota-publish.yml", "utf8"));
  assert.throws(() => readFileSync(".github/scripts/ota_setup.py", "utf8"));
  for (const d of ["arisetodo", "reader", "educator", "eyegazer", "fit", "notes", "talk", "trainer", "podscroll", "undercover"]) {
    assert.doesNotMatch(readFileSync(`${d}/ios-app/package.json`, "utf8"), /capacitor-updater/, d);
    assert.equal(JSON.parse(readFileSync(`${d}/ios-app/capacitor.config.json`, "utf8")).plugins?.CapacitorUpdater, undefined, d);
  }
  for (const wf of ["arisereader-ios", "educator-ios", "eyegazer-ios", "fit-ios", "notes-ios", "podplus-testflight", "talk-ios", "trainer-ios", "widget-sim-diag", "widgets-ios-check", "arisetodo-signed-release"]) {
    assert.doesNotMatch(readFileSync(`.github/workflows/${wf}.yml`, "utf8"), /ota_setup/, wf);
  }
});

test("every update offered carries the zip's checksum (the phone's updater refuses one without it)", () => {
  const list = releasesFrom([gh("ota-todo-1.300.0"), gh("ota-todo-1.400.0", undefined, null), gh("ota-todo-1.500.0", undefined, "sha256:nothex")]);
  assert.deepEqual(list.map((r) => r.version), ["1.300.0"], "no checksum, not offered");
  assert.equal(list[0].checksum, SUM);
});

test("the web code never downloads or switches to new web code", () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  assert.doesNotMatch(read("client/src/lib/nativeApp.ts"), /CapacitorUpdater|liveUpdateNow|checkForUpdateNow|keepLiveUpdated|notifyAppReady/);
  assert.doesNotMatch(read("client/src/main.tsx"), /keepLiveUpdated|markAppReady/);
  assert.doesNotMatch(read("podscroll/main.tsx"), /markAppReady/);
});

test("update files are never handed out; the desktop downloads still come through our server", async () => {
  const routes: Record<string, any> = {};
  const app: any = { post: () => {}, put: () => {}, get: (p: string, h: any) => { routes[`GET ${p}`] = h; } };
  const list = [{ ...gh("ota-todo-1.300.0"), assets: [{ ...gh("ota-todo-1.300.0").assets[0], id: 77 }] },
    { tag_name: "desktop", draft: false, assets: [{ id: 5, name: "Arise-To-Duo-Setup.exe", browser_download_url: "https://github.com/jjrobo180-wq/arisereader/releases/download/desktop/Arise-To-Duo-Setup.exe" }] }];
  const asked: (number | undefined)[] = [];
  registerOtaRoutes(app, { fetchJson: async () => list, token: () => "t", resolve: async (id, url) => { asked.push(id); return id ? `https://objects.example/signed/${id}` : url; } });
  const get = async (route: string, params: any) => { let to = "", code = 200; const res: any = { set: () => res, status: (c: number) => { code = c; return res; }, json: () => res, send: () => res, redirect: (c: number, u: string) => { code = c; to = u; return res; } }; await routes[route]({ params }, res); return { code, to }; };
  assert.equal((await get("GET /api/ota-file/:app/:file", { app: "todo", file: "1.300.0.zip" })).code, 410);
  assert.deepEqual(await get("GET /download/desktop/:file", { file: "Arise-To-Duo-Setup.exe" }), { code: 302, to: "https://objects.example/signed/5" });
  assert.deepEqual(asked, [5]);
});

test("the download page and the desktop app's updates come from our server, not GitHub", () => {
  const page = readFileSync("client/public/download/index.html", "utf8");
  assert.ok(!page.includes("github.com/jjrobo180-wq/arisereader/releases"));
  assert.match(page, /https:\/\/arisetodo\.com\/download\/desktop\/Arise-To-Duo-Setup\.exe/);
  const pub = JSON.parse(readFileSync("desktop/package.json", "utf8")).build.publish[0];
  assert.equal(pub.url, "https://arisetodo.com/download/desktop");
});
