import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { groupResults, searchHub, STORE_KIND, type SearchEntry } from "../shared/hubSearch";

const E = (id: string, kind: string, title: string): SearchEntry => ({ id, kind, title });
const all = [
  E("n1", "Notes", "Potty training notes"), E("t1", "Tasks", "Buy potty seat"), E("s1", "Section", "Notes"),
  E("a1", "App", "Potty Training"), E(`x1`, STORE_KIND, "Potty Chart"), E("c1", "Calendar", "Potty party"),
];

test("like iPhone search: an app is the top hit when it's among the best, then Apps, then saved things, App Store last", () => {
  const { top, groups } = groupResults(searchHub(all, "potty"));
  assert.equal(top?.title, "Potty Training");
  assert.equal(groups[groups.length - 1].label, "In the App Gallery");
  const labels = groups.map((g) => g.label);
  assert.ok(!labels.includes("Section"), "sections show as Apps, not 'Section'");
  for (const k of ["Notes", "Tasks", "Calendar"]) assert.ok(labels.includes(k), k);
  assert.ok(groups.every((g) => g.items.every((e) => e !== top)), "the top hit isn't repeated below");
});

test("Apps come before saved things, and an empty search groups nothing", () => {
  const { top, groups } = groupResults(searchHub(all, "notes"));
  assert.equal(top?.title, "Notes");
  assert.deepEqual(groupResults([]), { top: null, groups: [] });
  const g = groupResults(searchHub([E("n1", "Notes", "Shopping notes"), E("s1", "Section", "Shopping list")], "shopping"));
  assert.equal(g.top?.kind, "Section");
  assert.equal(g.groups[0].label, "Notes");
});

test("both hubs give search their apps with icons and list apps not added yet", () => {
  for (const f of ["../client/src/pages/AriseTodo.tsx", "../client/src/pages/TeacherHub.tsx"]) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    assert.match(src, /kind: STORE_KIND, title: p\.name/, f);
    assert.match(src, /initialOpen=\{storeOpenApp \?\? undefined\}/, f);
  }
  const life = readFileSync(new URL("../client/src/pages/AriseTodo.tsx", import.meta.url), "utf8");
  assert.match(life, /entries=\{buildSearchEntries\(\)\}/, "LifeHub builds search entries at render time (after the menu exists)");
});
