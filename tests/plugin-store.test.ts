// The Arise Plugin Gallery: the catalog matches the hubs, and adding or removing a plugin only
// switches what shows (never deletes anything).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PLUGINS, PLUGIN_CATEGORIES, connectionNeeds, isAddable, lifeInstalled, pluginOpens, pluginsFor, searchPlugins, setLifePlugin, setWorkPlugin, workInstalled,
} from "../shared/pluginStore";
import { HUB_TABS, emptyWorkspace } from "../shared/teacherHub";
import { ALWAYS_SHOWN } from "../shared/hubTabGroups";
import { WORK_BUILT_IN_TABS } from "../shared/teacherHub";
import { RETIRED_SECTIONS, TOGGLEABLE, emptyFamily } from "../shared/familyHub";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("every plugin has a unique id, a known category and real features", () => {
  const ids = new Set<string>();
  for (const p of PLUGINS) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    assert.ok(PLUGIN_CATEGORIES[p.hub].includes(p.category), `${p.id}: unknown category ${p.category}`);
    assert.ok(p.name && p.tagline && p.description, p.id);
    assert.ok(p.features.length >= 2, `${p.id}: needs features`);
    assert.match(p.color, /^#[0-9a-f]{6}$/i, p.id);
  }
});

test("WorkHub: every App Store screen is in the store, and no built-in or always-on tab is", () => {
  // Since Oct 12, 2026 WorkHub comes with Home, Calendar, Tasks, Notes and Goals (hidden or shown
  // in Settings); the rest are added from the App Store.
  const tabs = PLUGINS.flatMap((p) => (p.target.kind === "tab" ? [p.target.tab] : []));
  const optional = HUB_TABS.filter((t) => !ALWAYS_SHOWN.includes(t) && t !== "admin" && (!WORK_BUILT_IN_TABS.includes(t) || t === "goals" || t === "start"));
  // (Goals became built-in later but keeps its listing, shown as already added and never counted.
  // Getting started is built in too, and listed so it can be added back after it is removed.)
  assert.deepEqual([...tabs].sort(), [...optional].sort());
  for (const t of tabs) assert.ok(!ALWAYS_SHOWN.includes(t), t);
});

test("LifeHub: every section a family can switch off is in the store, except the built-in Calendar and Notes and retired apps", () => {
  const sections = PLUGINS.flatMap((p) => (p.target.kind === "section" ? [p.target.section] : []));
  // Health & fitness sections are retired (Cooked covers them) but their plugin entries stay, so old installs still clean up.
  assert.deepEqual([...sections].filter((s) => !RETIRED_SECTIONS.includes(s)).sort(), TOGGLEABLE.filter((s) => s !== "calendar" && s !== "notes" && !RETIRED_SECTIONS.includes(s)).sort());
});

test("adding and removing a WorkHub tab only changes that tab", () => {
  const ws = emptyWorkspace();
  const gradebook = PLUGINS.find((p) => p.id === "work-gradebook")!;
  assert.equal(workInstalled(gradebook, ws.visibleTabs), false, "App Store screens start off");
  const on = setWorkPlugin(ws.visibleTabs, gradebook, true);
  assert.equal(workInstalled(gradebook, on), true);
  assert.deepEqual({ ...on, gradebook: false }, ws.visibleTabs, "nothing else changed");
  assert.equal(workInstalled(gradebook, setWorkPlugin(on, gradebook, false)), false);
});

test("adding and removing a LifeHub section keeps the family's data", () => {
  const family = { ...emptyFamily(), bills: [{ id: "b1", name: "Rent", amount: 1000, dueDay: 1, category: "Home", autopay: false, paid: [] }] };
  const money = PLUGINS.find((p) => p.id === "life-money")!;
  const off = setLifePlugin(family, money, false);
  assert.equal(lifeInstalled(money, off), false);
  assert.equal(off.bills, family.bills, "the bills are kept");
  assert.equal(lifeInstalled(money, setLifePlugin(off, money, true)), true);
});

test("the WorkHub calendar is for teachers, and adding it also adds the Calendar section", () => {
  const layer = PLUGINS.find((p) => p.id === "life-workhub-calendar")!;
  assert.ok(!pluginsFor("life", { teacher: false }).includes(layer));
  assert.ok(pluginsFor("life", { teacher: true }).includes(layer));
  const family = { ...emptyFamily(), sections: { calendar: false } };
  const on = setLifePlugin(family, layer, true);
  assert.equal(on.layers.hub, true);
  assert.equal(on.sections.calendar, true);
  assert.equal(setLifePlugin(on, layer, false).sections.calendar, true, "removing the layer leaves the calendar");
});

test("connections open where they're set up, after the tab they live in", () => {
  const apple = PLUGINS.find((p) => p.id === "work-apple-reminders")!;
  assert.equal(isAddable(apple), false);
  assert.deepEqual(pluginOpens(apple), { tab: "tasks" });
  assert.equal(connectionNeeds(apple), null, "Tasks comes with every WorkHub, so there's nothing to add first");
  assert.equal(workInstalled(apple, { ...emptyWorkspace().visibleTabs, tasks: false }), false);
  const health = PLUGINS.find((p) => p.id === "life-apple-health")!;
  assert.equal(connectionNeeds(health)?.id, "life-health");
});

test("search matches names, categories and features", () => {
  const work = pluginsFor("work", { teacher: true });
  assert.ok(searchPlugins(work, "iep").some((p) => p.id === "work-meetings"));
  assert.ok(searchPlugins(work, "iphone calendar").some((p) => p.id === "work-calendar-feeds"));
  assert.equal(searchPlugins(work, "").length, work.length);
  assert.equal(searchPlugins(work, "zzzz").length, 0);
});

test("both hubs open the store and save through their own workspace", () => {
  const hub = read("client/src/pages/TeacherHub.tsx");
  assert.match(hub, /<PluginStore\s+hub="work"/);
  assert.match(hub, /setWorkPlugin\(prev\.visibleTabs, p, on\)/);
  const life = read("client/src/pages/AriseTodo.tsx");
  assert.match(life, /<PluginStore\s+hub="life"/);
  assert.match(life, /setFamily\(\(f\) => setLifePlugin\(f, p, on\)\)/);
});

test("every connection explains its setup steps before sending you anywhere", () => {
  for (const p of PLUGINS.filter((q) => q.target.kind === "connection")) {
    assert.ok((p.steps?.length ?? 0) >= 3, `${p.id}: needs setup steps`);
    assert.ok(p.needsNote, `${p.id}: needs a note`);
  }
  const store = read("client/src/components/plugin-store/PluginStore.tsx");
  assert.match(store, /setOpenId\(p\.id\); \}\} data-testid=\{`plugin-setup-/, "Set up opens the popup");
});

test("Start setup goes to the exact setup box of every connection", () => {
  const files: Record<string, string> = {
    '[data-testid="calendar-whose"]': "client/src/components/teacher-hub/HubCalendar.tsx",
    '[data-testid="apple-steps"]': "client/src/components/teacher-hub/HubApple.tsx",
    '[data-testid="hub-forwarding"]': "client/src/components/teacher-hub/HubInbox.tsx",
    '[data-plugin-anchor="apple-health"]': "client/src/components/family-hub/AppleHealth.tsx",
    '[data-plugin-anchor="email-forward"]': "client/src/components/family-hub/EmailForward.tsx",
    '[data-plugin-anchor="google"]': "client/src/components/teacher-hub/HubGoogle.tsx",
  };
  for (const p of PLUGINS.filter((q) => q.target.kind === "connection")) {
    assert.ok(p.anchor && files[p.anchor], `${p.id}: needs a known setup box`);
    const attr = p.anchor!.slice(1, -1).replace(/"/g, '"');
    assert.ok(read(files[p.anchor!]).includes(attr), `${p.id}: ${attr} is not in ${files[p.anchor!]}`);
  }
  assert.match(read("client/src/components/plugin-store/PluginStore.tsx"), /onOpen\(p\); if \(p\.anchor\) goToSetup\(p\.anchor\)/);
});

test("WorkHub's store lives in the main Hub screen, not the trial-ended screen", () => {
  const hub = read("client/src/pages/TeacherHub.tsx");
  const at = hub.indexOf("<PluginStore");
  assert.ok(at > hub.indexOf("function TeacherHubPage()"), "inside TeacherHubPage");
  assert.ok(hub.slice(hub.indexOf("function ReaderOnly("), hub.indexOf("export default function TeacherHub()")).indexOf("PluginStore") === -1, "not in ReaderOnly");
});

test("search ranks by name and category and doesn't match mid-word", () => {
  const life = pluginsFor("life", { teacher: false });
  const fit = searchPlugins(life, "fitness");
  const loose = life.filter((p) => [p.name, p.tagline, p.category, p.description, ...p.features].join(" ").toLowerCase().includes("fit"));
  assert.ok(fit.length > 0 && fit.length <= loose.length);
  assert.ok(fit.length < life.length / 3, `fitness should be tight, got ${fit.length} of ${life.length}`);
  const first = fit[0]!;
  assert.ok(/fit|health|workout|exercise|train/i.test([first.name, first.category, first.tagline].join(" ")), first.name);
  assert.equal(searchPlugins(life, "").length, life.length);
});

// ── Premium and Mini (November 2026) ──────────────────────────────────────────
import { MINI_SHELVES, PREMIUM_SHELVES } from "../shared/pluginStore";

test("the gallery splits into Premium apps and Mini plugins, and every plugin sits on exactly one shelf", () => {
  for (const [hub, teacher] of [["life", false], ["life", true], ["work", true], ["work", false]] as const) {
    const all = pluginsFor(hub, { teacher, arise: true });
    for (const p of all) {
      assert.ok(p.tier === "premium" || p.tier === "mini", `${p.id}: no tier`);
      const shelves = p.tier === "premium" ? PREMIUM_SHELVES : MINI_SHELVES[hub];
      assert.ok(shelves.includes(p.shelf!), `${hub}: ${p.name} is on "${p.shelf}", which isn't a ${p.tier} shelf`);
    }
    const premium = new Set(all.filter((p) => p.tier === "premium").map((p) => p.name));
    for (const name of ["A.R.I.S.E. Docs", "A.R.I.S.E. Sheets", "A.R.I.S.E. Slides", "Drive", "Drop", "A.R.I.S.E. Standby"]) assert.ok(premium.has(name), `${hub}: ${name} is Premium`);
    if (hub === "life") for (const name of ["Cooked", "Cooked PT", "Podster", "Arise Notes"]) assert.ok(premium.has(name), `${name} is Premium`);
    const mini = new Set(all.filter((p) => p.tier === "mini").map((p) => p.name));
    for (const name of ["Final Grade Calculator", "AI Gift Ideas", "GPA Calculator", "Widgets"]) assert.ok(mini.has(name), `${hub}: ${name} is Mini`);
    if (hub === "life") assert.ok(mini.has("Gifts & Dates"));
    assert.ok(premium.size < 25 && mini.size > 400, `${hub}: ${premium.size} premium, ${mini.size} mini`);
  }
});

test("Health Lite is gone from the gallery, even for anyone who had it; its tools are listed on their own", () => {
  for (const includeRetired of [false, true]) {
    const life = pluginsFor("life", { teacher: false, includeRetired });
    assert.ok(!life.some((p) => p.id === "life-healthlite"));
    assert.ok(!searchPlugins(life, "health lite").some((p) => p.id === "life-healthlite"));
  }
  const life = pluginsFor("life", { teacher: false });
  // Its tools went later too: every health & fitness plugin is gone, Cooked covers fitness and food.
  for (const id of ["life-health", "life-cycle", "life-pills", "life-mood", "life-sleep", "life-workouts", "life-meditate", "life-habits", "life-medical", "life-checkups", "life-pro-couch-5k", "life-ai-workout-plan"])
    assert.ok(!life.some((p) => p.id === id), id);
  assert.ok(life.some((p) => p.id === "life-cooked"), "Cooked stays");
  assert.ok(!read("client/src/components/DuoSetup.tsx").includes('"life-healthlite"'));
});

test("Arise Buddy (TTS Buddy) is a Premium app in both hubs' galleries", () => {
  for (const hub of ["life", "work"] as const) {
    const b = pluginsFor(hub, { teacher: true }).find((p) => p.id === `${hub}-buddy`);
    assert.ok(b, hub);
    assert.equal(b!.name, "Arise Buddy"); assert.equal(b!.tier, "premium"); assert.equal(b!.shelf, "Learning apps");
    assert.deepEqual(b!.target, { kind: "officeApp", id: `${hub}-buddy`, href: "#/buddy" });
    assert.equal(searchPlugins(pluginsFor(hub, { teacher: true }), "buddy")[0]?.name, "Arise Buddy");
  }
});

test("search finds things by what people call them, best match first", () => {
  const life = pluginsFor("life", { teacher: false, arise: true });
  const top = (q: string) => searchPlugins(life, q)[0]?.name;
  assert.equal(top("final grade"), "Final Grade Calculator");
  assert.equal(top("gift dates"), "Gifts & Dates");
  assert.equal(top("gifts & dates"), "Gifts & Dates");
  assert.equal(top("docs"), "A.R.I.S.E. Docs");
  assert.equal(top("podcast"), "Podster");
  assert.equal(top("spreadsheet")?.endsWith("Sheets"), true);
  assert.equal(top("calorie"), "Cooked");
  assert.equal(top("resume"), "Résumé Builder");
  // A plural finds the plain word, and "notes" isn't cut to "not".
  assert.ok(searchPlugins(life, "notes").every((p) => !/\bnot\b|nothing/i.test(p.name)));
  assert.ok(searchPlugins(life, "birthdays").some((p) => p.name === "Gifts & Dates"));
});

test("the gallery screen: Premium and Mini switch, shelves, grouped results, and a clear button", () => {
  const s = read("client/src/components/plugin-store/PluginStore.tsx");
  assert.match(s, /data-testid="plugin-tiers"/);
  assert.match(s, /\(\["all", "premium", "mini"\] as const\)/);
  assert.match(s, /data-testid="plugin-search-clear"/);
  assert.match(s, /data-testid=\{`plugin-results-\$\{t\}`\}/);
  assert.match(s, /includeRetired: true/);
  assert.match(s, /if \(category\) list = list\.filter\(\(p\) => p\.shelf === category\);/);
  assert.ok(!s.includes("PLUGIN_CATEGORIES"), "shelves, not the old category list, drive the chips");
});
