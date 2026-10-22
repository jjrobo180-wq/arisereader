// Pre-filled hub templates in the LifeHub App Store: Finance hub, Health & fitness hub, and Home &
// chores hub. Each is a ready-made bundle of existing App Store plugins that installs (or removes)
// all at once, exactly as if every plugin in it had been added on its own. See shared/pluginStore.ts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HUB_TEMPLATES, PLUGINS, setLifePlugin, setLifeTemplate, templateInstalledCount, templatePlugins } from "../shared/pluginStore";
import { emptyFamily } from "../shared/familyHub";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("there are exactly the three templates the App Store offers, each in LifeHub, with a unique id", () => {
  assert.equal(HUB_TEMPLATES.length, 3);
  const names = HUB_TEMPLATES.map((t) => t.name);
  assert.deepEqual(names, ["Finance hub", "Health & fitness hub", "Home & chores hub"]);
  assert.ok(HUB_TEMPLATES.every((t) => t.hub === "life"));
  assert.equal(new Set(HUB_TEMPLATES.map((t) => t.id)).size, 3, "no two templates share an id");
});

test("every plugin id listed in a template actually exists, in that template's hub, and none repeat within a template", () => {
  for (const t of HUB_TEMPLATES) {
    assert.ok(t.plugins.length >= 5, `${t.name} should bundle a real handful of apps, not just one or two`);
    assert.equal(new Set(t.plugins).size, t.plugins.length, `${t.name} lists an id more than once`);
    for (const id of t.plugins) {
      const p = PLUGINS.find((p) => p.id === id);
      assert.ok(p, `${t.name} references "${id}", which isn't a real plugin id`);
      assert.equal(p!.hub, t.hub, `${t.name} references "${id}", which belongs to the wrong hub`);
    }
    // templatePlugins resolves every one of them - nothing silently dropped.
    assert.equal(templatePlugins(t).length, t.plugins.length, `${t.name} has a plugin id that failed to resolve`);
  }
});

test("no plugin is bundled into more than one template, so adding every template never double-installs anything oddly", () => {
  const seen = new Map<string, string>();
  for (const t of HUB_TEMPLATES) for (const id of t.plugins) {
    assert.ok(!seen.has(id), `"${id}" is bundled into both "${seen.get(id)}" and "${t.name}"`);
    seen.set(id, t.name);
  }
});

test("installing a template adds every one of its plugins; removing it takes every one back off, and nothing else", () => {
  const finance = HUB_TEMPLATES.find((t) => t.id === "life-template-finance")!;
  const fresh = emptyFamily();
  const installed = setLifeTemplate(fresh, finance, true);
  assert.equal(templateInstalledCount(finance, installed), templatePlugins(finance).length, "every plugin in the bundle is now on");
  for (const p of templatePlugins(finance)) assert.ok(p.target.kind === "section" && installed.sections[p.target.section], `${p.name} should be switched on`);
  // A section outside the bundle is untouched.
  assert.equal(installed.sections.journal, fresh.sections.journal);
  const removed = setLifeTemplate(installed, finance, false);
  // Removing turns every one of the bundle's apps off, the same as removing any single app always
  // does - even "Budget & bills", which (like a few other core sections) happens to start on by
  // default before anyone ever touches it. That's correct: once you've added or removed something
  // through the Store, its state is yours, not the factory default.
  assert.equal(templateInstalledCount(finance, removed), 0, "removing the template turns off every app in it, with no exceptions");
  for (const p of templatePlugins(finance)) assert.ok(p.target.kind === "section" && removed.sections[p.target.section] === false, `${p.name} should be switched off`);
});

test("installing a template is the same as adding each of its plugins one at a time, in order", () => {
  const home = HUB_TEMPLATES.find((t) => t.id === "life-template-home")!;
  const viaTemplate = setLifeTemplate(emptyFamily(), home, true);
  let viaOneByOne = emptyFamily();
  for (const p of templatePlugins(home)) viaOneByOne = setLifePlugin(viaOneByOne, p, true);
  assert.deepEqual(viaTemplate.sections, viaOneByOne.sections, "no special-casing: a template is just its plugins, added together");
});

test("the App Store shows a Hubs tab with a card per template, each able to add or remove every app in it at once", () => {
  const store = read("client/src/components/plugin-store/PluginStore.tsx");
  assert.match(store, /data-testid="plugin-store-templates"/, "a chip switches to the templates view");
  assert.match(store, /const toggleTemplate = \(t: HubTemplate, on: boolean\) => \{/);
  assert.match(store, /for \(const p of templatePlugins\(t\)\) onToggle\(p, on\);/, "a template is installed by toggling each of its plugins");
  assert.match(store, /data-testid=\{`template-\$\{t\.id\}`\}/, "each template renders as its own card");
  assert.match(store, /data-testid="template-detail"/, "a template has its own detail page listing its apps");
});
