// "Something went wrong" after an update: old code files are kept, the app reloads itself once, and every
// crash is kept where it can be read. Run with: npx tsx --test tests/error-recovery.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { oldFilesToKeep, nextList, KEEP_DAYS } from "../script/keepOldAssets";
import { crashKeeper } from "../server/clientErrors";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("each build keeps the code files the live site still lists, for a few days", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  const day = 86_400_000;
  const live = { builtAt: "", files: {
    "Home-old.js": new Date(now.getTime() - 1 * day).toISOString(),
    "Home-ancient.js": new Date(now.getTime() - (KEEP_DAYS + 1) * day).toISOString(),
    "index-same.js": new Date(now.getTime() - 2 * day).toISOString(),
    "../../etc/passwd": now.toISOString(),
    "asset-list.json": now.toISOString(),
  } };
  const kept = oldFilesToKeep(live, ["index-same.js", "Home-new.js"], now);
  assert.deepEqual(Object.keys(kept), ["Home-old.js"], "recent old files only; never this build's own, too-old or unsafe names");
  const list = nextList(live, ["index-same.js", "Home-new.js"], kept, now);
  assert.equal(list.files["index-same.js"], live.files["index-same.js"], "a file that didn't change keeps its first day");
  assert.equal(list.files["Home-new.js"], now.toISOString());
  assert.ok(list.files["Home-old.js"]);
  assert.deepEqual(oldFilesToKeep(null, ["a.js"], now), {}, "no live list: nothing to keep, and the build goes on");
});

test("the build runs it, and the list is never cached", () => {
  assert.match(read("script/build.ts"), /await keepOldAssets\(path\.resolve\("dist\/public\/assets"\)\)/);
  const stat = read("server/static.ts");
  assert.ok(stat.indexOf('app.get("/assets/asset-list.json"') < stat.indexOf('app.use("/assets", express.static('), "served before the year-long cache");
});

test("crash reports are kept, newest first, and saved in one write per burst", async () => {
  const saves: any[][] = [];
  const k = crashKeeper(async (l) => { saves.push(l); }, { keep: 3, everyMs: 5, load: async () => [{ at: "old", host: "", route: "", role: "", name: "", message: "before", where: "" }] });
  for (const m of ["a", "b", "c"]) k.add({ at: m, host: "h", route: "#/x", role: "admin", name: "Error", message: m, where: "" });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(saves.length, 1);
  assert.deepEqual(saves[0].map((e) => e.message), ["c", "b", "a"]);
  assert.match(read("server/routes.ts"), /registerClientErrorRoutes\(app, \{ keep: \(e\) => crashes\.add\(e\) \}\)/);
});

test("the app reloads itself once before showing Something went wrong, and says what broke on the web too", async () => {
  const { shouldAutoReload } = await import("../client/src/lib/crashReload");
  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
  assert.equal(shouldAutoReload("#/workhub", 1_000, store), true, "first crash: reload");
  assert.equal(shouldAutoReload("#/workhub", 20_000, store), false, "crashed again right after: show the screen");
  assert.equal(shouldAutoReload("#/workhub", 90_000, store), true, "a minute later it may reload again");
  assert.equal(shouldAutoReload("#/lifehub", 91_000, store), true, "another page");
  const eb = read("client/src/components/ErrorBoundary.tsx");
  assert.match(eb, /What went wrong/);
  assert.match(eb, /data-testid="error-recovering"/);
  assert.match(read("client/src/components/super-apps/SuperBoundary.tsx"), /shouldAutoReload/);
  assert.match(read("client/src/main.tsx"), /vite:preloadError[\s\S]*shouldAutoReload/);
});

test("LifeHub's Life Score icon is the imported one (ReferenceError: Gauge is not defined, Nov 26, 2026)", () => {
  assert.match(read("client/src/pages/AriseTodo.tsx"), /lifescore: GaugeNav2,/);
  assert.match(read("client/src/components/family-hub/Members.tsx"), /lifescore: \{[^}]*icon: <GaugeIcon2 /);
});
