// Health & Fitness inside To Do: its parts are tabs switched on, off and reordered in one Edit tabs sheet
// (no separate plugin store), under a To Do-style tab bar. Also the renames and TTS Buddy in the hub.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { appsOf, moveAdded, setAdded } from "../shared/fitApps";
import { superAppOf } from "../shared/superApps";
import { pluginsFor } from "../shared/pluginStore";

test("tabs turn on and off, and move, keeping everything else", () => {
  let a = appsOf(undefined);
  a = setAdded(a, "yoga", false);
  assert.ok(!a.added.includes("yoga"));
  a = setAdded(a, "meds", true);
  assert.equal(a.added.at(-1), "meds");
  const before = a.added.filter((x) => ["train", "maxes"].includes(x));
  assert.deepEqual(before, ["train", "maxes"]);
  a = moveAdded(a, "maxes", -1);
  assert.deepEqual(a.added.filter((x) => ["train", "maxes"].includes(x)), ["maxes", "train"]);
  assert.deepEqual(moveAdded(a, "maxes", -1), a, "the first can't go earlier");
});

test("inside To Do: no Plugins tab, Edit tabs instead, and a To Do tab bar", () => {
  const app = readFileSync("client/src/pages/fit/FitApp.tsx", "utf8");
  assert.match(app, /if \(embed && t === "apps"\) \{ setEditTabs\(true\); return; \}/);
  assert.match(app, /\{editTabs && <FitTabsEditor /);
  const shell = readFileSync("client/src/components/super-apps/SuperShell.tsx", "utf8");
  assert.match(shell, /className="sx-tabs"/);
  const css = readFileSync("client/src/components/super-apps/super-shell.css", "utf8");
  assert.match(css, /\.sx-tab\[aria-selected="true"\] \{ background: var\(--an-card/);
  assert.match(css, /\.hub-night \.sx-tabs/);
  assert.match(readFileSync("client/src/components/super-apps/CookedInDuo.tsx", "utf8"), /onEdit=\{editTabs\}/);
});

test("renamed in To Do: Arise Health & Fitness, Arise Podcasts, TTS Buddy (inside the hub)", () => {
  assert.equal(superAppOf("cooked")!.name, "Arise Health & Fitness");
  assert.equal(superAppOf("podster")!.name, "Arise Podcasts");
  const buddy = pluginsFor("life", { teacher: true }).find((p) => p.id === "life-buddy")!;
  assert.equal(buddy.name, "TTS Buddy");
  assert.deepEqual(buddy.target, { kind: "officeApp", id: "life-buddy", href: "#/pro?app=buddy" });
  assert.match(readFileSync("client/src/pages/ProApps.tsx", "utf8"), /if \(id === "buddy"\) return/);
});

test("the plugin's heading is one slim row and To Do's Move button sits in it, not above the app", () => {
  const shell = readFileSync("client/src/components/super-apps/SuperShell.tsx", "utf8");
  assert.match(shell, /useContext\(SuperHeadExtra\)/);
  assert.doesNotMatch(shell, /\{app\.tagline\}<\/p>/);
  const duo = readFileSync("client/src/pages/AriseTodo.tsx", "utf8");
  assert.equal((duo.match(/<SuperHeadExtra\.Provider value=\{moveButton\}>/g) || []).length, 4);
  assert.match(duo, /isSuperApp\(shown\) \? null : moveButton/);
});

test("plugins start at the top: no logo, the tabs share the name's row, less space above", () => {
  const shell = readFileSync("client/src/components/super-apps/SuperShell.tsx", "utf8");
  assert.doesNotMatch(shell, /sx-head-icon|superIcon\(app\.icon\)/);
  assert.match(shell, /\{tabs && <div className="sx-head-tabs">\{tabs\}<\/div>\}/);
  for (const f of ["NotesInDuo", "PodsterInDuo", "CookedInDuo", "CookedPtInDuo", "NotesInWork"])
    assert.match(readFileSync(`client/src/components/super-apps/${f}.tsx`, "utf8"), /<SuperHead [^\n]*tabs=\{<PageStrip /, f);
  assert.match(readFileSync("client/src/pages/AriseTodo.tsx", "utf8"), /\$\{isSuperApp\(shown\) \? "pt-2 sm:pt-3 lg:pt-4" : "pt-4 sm:pt-6 lg:pt-10"\}/);
});

test("inside To Do, Health & Fitness is a few tabs of grouped parts (Nov 25, 2026)", async () => {
  const g = await import("../shared/fitGroups");
  const ids = (id: string) => g.FIT_GROUP_BY_ID.get(id as never)!.parts.map((p) => p.id);
  for (const x of ["water", "meds", "period", "mind", "sleep", "fast"]) assert.ok(ids("g-daily").includes(x as never), x);
  for (const x of ["food", "prep", "grocery", "recipes", "eat"]) assert.ok(ids("g-food").includes(x as never), x);
  assert.ok(ids("g-train").includes("train" as never) && ids("g-yoga").includes("yoga" as never));
  // Every part of Cooked has a home.
  const { FIT_APPS } = await import("../shared/fitApps");
  for (const a of FIT_APPS) assert.ok(g.groupOf(a.id), a.id);
  // Period starts off unless it was added; tabs and parts switch off and on.
  const p = g.defaultGroupPrefs(["train"]);
  assert.ok(p.partsOff.includes("period"));
  assert.ok(!g.defaultGroupPrefs(["period"]).partsOff.includes("period"));
  const off = g.setGroupOn(p, "g-yoga", false);
  assert.ok(!g.groupsOn(off).some((x) => x.id === "g-yoga"));
  assert.deepEqual(g.moveGroup(p, "g-food", -1).order.slice(0, 2), ["g-food", "g-daily"]);
  assert.deepEqual(g.cleanGroupPrefs({ order: ["g-yoga", "bad"], off: ["g-friends"], partsOff: ["period", "x"] }), { order: ["g-yoga", "g-daily", "g-food", "g-train", "g-progress", "g-friends"], off: ["g-friends"], partsOff: ["period"] });
  const app = readFileSync("client/src/pages/fit/FitApp.tsx", "utf8");
  assert.match(app, /<FitGroupPage group=\{g\} parts=\{partsOn\(gprefs, g\)\}/);
  assert.match(app, /case "prep": return <MealPrep inline=\{inline\}/);
});

test("plugin settings use To Do's own sheets: Edit Tabs on the tab row, the gear for the plugin's settings", () => {
  const app = readFileSync("client/src/pages/fit/FitApp.tsx", "utf8");
  assert.match(app, /return duo \? <DuoSettings \{\.\.\.p\} \/> : <AppSettings \{\.\.\.p\} \/>;/);
  const duo = app.slice(app.indexOf("function DuoSettings"), app.indexOf("function SettingsSheet"));
  assert.match(duo, /<NativeSheet title="Health & Fitness"/);
  for (const gone of ["LayoutsSetting", "ThemePicker", "fit-signout"]) assert.ok(!duo.includes(gone), gone);
  assert.match(readFileSync("client/src/components/super-apps/NotesInDuo.tsx", "utf8"), /onSettings=\{\(\) => go\("settings"\)\}[^\n]*onEdit=\{\(\) => setPicking\(true\)\}/);
  assert.match(readFileSync("client/src/components/super-apps/PodsterInDuo.tsx", "utf8"), /onSettings=\{\(\) => setEditing\(true\)\}[^\n]*onEdit=\{\(\) => setPicking\(true\)\}/);
});
