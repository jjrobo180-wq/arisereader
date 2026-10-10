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

test("WorkHub: every tab a teacher can hide is in the store, and no always-on tab is", () => {
  const tabs = PLUGINS.flatMap((p) => (p.target.kind === "tab" ? [p.target.tab] : []));
  const optional = HUB_TABS.filter((t) => !ALWAYS_SHOWN.includes(t) && t !== "admin" && t !== "arise");
  assert.deepEqual([...tabs].sort(), [...optional].sort());
  for (const t of tabs) assert.ok(!ALWAYS_SHOWN.includes(t), t);
});

test("LifeHub: every section a family can switch off is in the store", () => {
  const sections = PLUGINS.flatMap((p) => (p.target.kind === "section" ? [p.target.section] : []));
  assert.deepEqual([...sections].sort(), [...TOGGLEABLE].sort());
});

test("adding and removing a WorkHub tab only changes that tab", () => {
  const ws = emptyWorkspace();
  const gradebook = PLUGINS.find((p) => p.id === "work-gradebook")!;
  assert.equal(workInstalled(gradebook, ws.visibleTabs), true, "tabs start added");
  const off = setWorkPlugin(ws.visibleTabs, gradebook, false);
  assert.equal(workInstalled(gradebook, off), false);
  assert.deepEqual({ ...off, gradebook: true }, ws.visibleTabs, "nothing else changed");
  assert.equal(workInstalled(gradebook, setWorkPlugin(off, gradebook, true)), true);
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
  assert.equal(connectionNeeds(apple)?.id, "work-tasks");
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
