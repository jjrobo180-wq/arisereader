// Plugin packs in the Plugin Gallery (shared/pluginStore.ts, HUB_TEMPLATES): ready-made sets of existing
// plugins (Teacher essentials, Family, Couples, Health & wellness...) that add (or remove) all at once,
// exactly as if every plugin in it had been added on its own.
// Run: npx tsx --test tests/hub-templates.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HUB_TEMPLATES, packsFor, pluginsFor, setLifePlugin, setLifeTemplate, templateInstalledCount, templatePlugins } from "../shared/pluginStore";
import { emptyFamily } from "../shared/familyHub";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("WorkHub and LifeHub each have their packs, with unique ids, and Teacher essentials is first for teachers", () => {
  assert.equal(new Set(HUB_TEMPLATES.map((t) => t.id)).size, HUB_TEMPLATES.length, "no two packs share an id");
  const workPacks = packsFor("work", { teacher: true });
  const work = workPacks.map((t) => t.name);
  // Bundles by job come first (Nov 25, 2026), then Teacher essentials leads the other packs.
  assert.equal(workPacks.filter((t) => !t.industry)[0].name, "Teacher essentials");
  assert.ok(workPacks.findIndex((t) => !t.industry) === workPacks.filter((t) => t.industry).length, "bundles by job first");
  for (const n of ["Working with families", "Special education", "Classroom management", "Planning & prep", "Teacher wellness", "Office & meetings"]) assert.ok(work.includes(n), n);
  const life = packsFor("life", { teacher: false }).map((t) => t.name);
  for (const n of ["Family", "Couples", "Health & wellness", "Baby & toddler", "Kids & school", "Money", "Home", "Get organized", "Family fun", "Student"]) assert.ok(life.includes(n), n);
});

test("teacher packs are only shown to teachers", () => {
  const notTeacher = packsFor("work", { teacher: false }).filter((t) => !t.industry).map((t) => t.name);
  assert.deepEqual(notTeacher, ["Office & meetings"]);
});

test("every plugin in every pack is one this person can really add today, with none repeated", () => {
  for (const t of HUB_TEMPLATES) {
    assert.ok(t.plugins.length >= 5, `${t.name} should be a real handful of plugins`);
    assert.equal(new Set(t.plugins).size, t.plugins.length, `${t.name} lists an id more than once`);
    const offered = pluginsFor(t.hub, { teacher: !!t.teacherOnly, arise: false });
    const got = templatePlugins(t, offered);
    assert.deepEqual(got.map((p) => p.id), [...t.plugins], `${t.name} has a plugin that isn't offered (merged, retired or hidden)`);
    for (const s of [t.name, t.tagline, t.description]) assert.doesNotMatch(s, /\p{Extended_Pictographic}/u, s);
  }
});

test("Teacher essentials has all five class-records plugins", () => {
  const t = HUB_TEMPLATES.find((x) => x.id === "work-pack-teacher")!;
  for (const id of ["work-behavior", "work-passes", "work-attendance", "work-gradebook", "work-wall"]) assert.ok(t.plugins.includes(id), id);
});

test("adding a pack adds every one of its plugins; removing it takes every one back off, and nothing else", () => {
  const money = HUB_TEMPLATES.find((t) => t.id === "life-template-finance")!;
  const fresh = emptyFamily();
  const installed = setLifeTemplate(fresh, money, true);
  assert.equal(templateInstalledCount(money, installed), templatePlugins(money).length, "every plugin in the pack is now on");
  assert.equal(installed.sections.journal, fresh.sections.journal, "a section outside the pack is untouched");
  const removed = setLifeTemplate(installed, money, false);
  assert.equal(templateInstalledCount(money, removed), 0, "removing the pack turns off every plugin in it");
});

test("adding a pack is the same as adding each of its plugins one at a time, in order", () => {
  const home = HUB_TEMPLATES.find((t) => t.id === "life-template-home")!;
  const viaPack = setLifeTemplate(emptyFamily(), home, true);
  let oneByOne = emptyFamily();
  for (const p of templatePlugins(home)) oneByOne = setLifePlugin(oneByOne, p, true);
  assert.deepEqual(viaPack.sections, oneByOne.sections, "a pack is just its plugins, added together");
});

test("the gallery shows Packs first, adds a pack one plugin at a time, and stops when the plan is full", () => {
  const store = read("client/src/components/plugin-store/PluginStore.tsx");
  assert.match(store, /data-testid="plugin-store-templates">Packs</, "a Packs chip");
  assert.ok(store.indexOf('data-testid="plugin-store-templates"') < store.indexOf('data-testid="plugin-store-added"'), "Packs comes before Added");
  assert.match(store, /data-testid="plugin-packs-row"/, "a row of packs at the top of Browse");
  assert.match(store, /const packOf = \(t: HubTemplate\) => templatePlugins\(t, live\);/, "a pack only lists what this person is offered");
  assert.match(store, /onToggle\(todo\[i\], true\);[\s\S]*?if \(installedNow\.current\(todo\[i\]\)\) step\(i \+ 1\);[\s\S]*?else finish\(\);/, "each add waits for the last to land, and a refused add stops the rest");
  assert.match(store, /data-testid=\{`template-\$\{t\.id\}`\}/, "each pack is its own card");
  assert.match(store, /data-testid="template-detail"/, "each pack has a page listing its plugins");
});

test("bundles by job: one tap for each line of work, everyone sees them", () => {
  const jobs = packsFor("work", { teacher: false }).filter((t) => t.industry).map((t) => t.name);
  for (const n of ["Teaching", "Business owner", "Accounting & bookkeeping", "Social media creator", "Personal trainer & coach", "Real estate", "Health care", "Trades & contractors", "Salon & barber", "Restaurant & food service", "Sales", "Freelancer & creative", "Nonprofit & ministry", "Legal", "Job seeker"])
    assert.ok(jobs.includes(n), n);
  const store = read("client/src/components/plugin-store/PluginStore.tsx");
  assert.match(store, /data-testid="plugin-bundles-by-job"/);
});
