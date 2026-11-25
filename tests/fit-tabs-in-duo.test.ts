// Health & Fitness inside To Duo: its parts are tabs switched on, off and reordered in one Edit tabs sheet
// (no separate plugin store), under a To Duo-style tab bar. Also the renames and TTS Buddy in the hub.
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

test("inside To Duo: no Plugins tab, Edit tabs instead, and a To Duo tab bar", () => {
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

test("renamed in To Duo: Arise Health & Fitness, Arise Podcasts, TTS Buddy (inside the hub)", () => {
  assert.equal(superAppOf("cooked")!.name, "Arise Health & Fitness");
  assert.equal(superAppOf("podster")!.name, "Arise Podcasts");
  const buddy = pluginsFor("life", { teacher: true }).find((p) => p.id === "life-buddy")!;
  assert.equal(buddy.name, "TTS Buddy");
  assert.deepEqual(buddy.target, { kind: "officeApp", id: "life-buddy", href: "#/pro?app=buddy" });
  assert.match(readFileSync("client/src/pages/ProApps.tsx", "utf8"), /if \(id === "buddy"\) return/);
});

test("the plugin's heading is one slim row and To Duo's Move button sits in it, not above the app", () => {
  const shell = readFileSync("client/src/components/super-apps/SuperShell.tsx", "utf8");
  assert.match(shell, /useContext\(SuperHeadExtra\)/);
  assert.doesNotMatch(shell, /\{app\.tagline\}<\/p>/);
  const duo = readFileSync("client/src/pages/AriseTodo.tsx", "utf8");
  assert.equal((duo.match(/<SuperHeadExtra\.Provider value=\{moveButton\}>/g) || []).length, 4);
  assert.match(duo, /isSuperApp\(shown\) \? null : moveButton/);
});
