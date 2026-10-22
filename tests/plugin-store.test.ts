// The Arise Plugin Store: the catalog matches the hubs, and adding or removing a plugin only
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
import { TOGGLEABLE, emptyFamily } from "../shared/familyHub";

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

test("LifeHub: every section a family can switch off is in the store, except the built-in Calendar and Notes", () => {
  const sections = PLUGINS.flatMap((p) => (p.target.kind === "section" ? [p.target.section] : []));
  assert.deepEqual([...sections].sort(), TOGGLEABLE.filter((s) => s !== "calendar" && s !== "notes").sort());
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
  assert.ok(searchPlugins(work, "google calendar").some((p) => p.id === "work-calendar-feeds"));
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
