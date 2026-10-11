// The Plugin Kit: 100 plugins drawn by shared tools, 60 in LifeHub and 40 in WorkHub.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KIT_DEFS, KIT_LIFE_IDS, cleanKit, kitDef } from "../shared/pluginKit";
import { ADD_ON_SECTIONS, cleanFamily, emptyFamily, isOn } from "../shared/familyHub";
import { PLUGINS, PLUGIN_CATEGORIES, isAddable, setWorkKit, workInstalled } from "../shared/pluginStore";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("100 kit plugins: 60 LifeHub sections and 40 WorkHub tools, all well-formed", () => {
  assert.equal(KIT_DEFS.length, 100);
  assert.equal(new Set(KIT_DEFS.map((d) => d.id)).size, 100);
  const life = KIT_DEFS.filter((d) => d.hub === "life"), work = KIT_DEFS.filter((d) => d.hub === "work");
  assert.equal(life.length, 60);
  assert.equal(work.length, 40);
  assert.deepEqual([...KIT_LIFE_IDS].sort(), life.map((d) => d.id).sort());
  for (const d of KIT_DEFS) {
    assert.ok(PLUGIN_CATEGORIES[d.hub].includes(d.category), `${d.id}: ${d.category}`);
    assert.match(d.color, /^#[0-9a-f]{6}$/i, d.id);
    assert.ok(d.features.length >= 2, d.id);
    if (d.type === "list") assert.ok(d.fields.length >= 1 && (!d.sumField || d.fields.some((f) => f.key === d.sumField)) && (!d.dueField || d.fields.some((f) => f.key === d.dueField && f.type === "date")), d.id);
    if (d.type === "checklist") assert.ok(d.items.length >= 8 && new Set(d.items).size === d.items.length, d.id);
    if (d.type === "cards") assert.ok(d.items.length >= 12 && new Set(d.items.map((i) => i.t)).size === d.items.length, d.id);
    if (d.type === "log") assert.ok(d.step > 0 && d.max >= d.step && (d.goal === undefined || d.goal <= d.max), d.id);
  }
});

test("LifeHub kit plugins are sections that start off; WorkHub ones are added to the workspace", () => {
  const f = emptyFamily();
  for (const id of KIT_LIFE_IDS) {
    assert.ok(ADD_ON_SECTIONS.includes(id), id);
    assert.equal(isOn(id, f), false);
    assert.ok(PLUGINS.some((p) => p.target.kind === "section" && p.target.section === id), `${id} in the store`);
  }
  const work = PLUGINS.filter((p) => p.target.kind === "kit");
  assert.equal(work.length, 40);
  const p = work[0];
  assert.ok(isAddable(p));
  assert.equal(workInstalled(p, {}, []), false);
  const on = setWorkKit([], p, true);
  assert.equal(workInstalled(p, {}, on), true);
  assert.deepEqual(setWorkKit(on, p, false), []);
  assert.deepEqual(setWorkKit(on, p, true), on, "adding twice keeps one");
});

test("kit records are cleaned: known plugins only, sizes capped, family keeps them", () => {
  const rows = cleanKit([
    { id: "a", plugin: "water-log", date: "2026-10-10", data: { value: 6 } },
    { id: "b", plugin: "nope", data: {} },
    { id: "c", plugin: "pantry", date: "bad", data: { item: "x".repeat(5000), qty: 3, "bad key": 1, ok: true, obj: { no: 1 } } },
    { id: "a", plugin: "water-log", data: {} },
  ]);
  assert.deepEqual(rows.map((r) => r.id), ["a", "c"]);
  assert.equal(rows[1].date, "");
  assert.equal(String(rows[1].data.item).length, 1000);
  assert.deepEqual(Object.keys(rows[1].data).sort(), ["item", "ok", "qty"]);
  const fam = cleanFamily({ ...emptyFamily(), kit: rows });
  assert.equal(fam.kit.length, 2);
  assert.equal(kitDef("pantry")?.type, "list");
});

test("the tools are wired into LifeHub, WorkHub and the store", () => {
  assert.match(read("client/src/pages/AriseTodo.tsx"), /isKitLifeId\(shown\)/);
  const hub = read("client/src/pages/TeacherHub.tsx");
  assert.match(hub, /setWorkKit\(/);
  assert.match(hub, /kitRecords/);
  const store = read("client/src/components/plugin-store/PluginStore.tsx");
  assert.match(store, /<KitPlugin/);
  const icons = read("client/src/components/plugin-kit/kitIcons.ts");
  for (const d of KIT_DEFS) assert.ok(icons.includes(` ${d.icon},`) || icons.includes(` ${d.icon} `), `icon ${d.icon}`);
});
