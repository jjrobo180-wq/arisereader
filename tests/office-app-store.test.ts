import test from "node:test";
import assert from "node:assert/strict";
import { pluginsFor, workInstalled, lifeInstalled, officeAppPlugin, setWorkSheetsApp, setLifeSheetsApp, isAddable } from "../shared/pluginStore";
import { countsAsApp, workApps, lifeApps } from "../shared/todoPlan";
import { emptyWorkspace } from "../shared/teacherHub";
import { emptyFamily } from "../shared/familyHub";

const wanted = ["office-sheet", "office-doc", "office-slides", "ai-meeting-agenda", "ai-quiz", "ai-meal-plan"];

for (const hub of ["work", "life"] as const) {
  test(`${hub} App Store lists working, individually installable Office & AI tools`, () => {
    const catalog = pluginsFor(hub, { teacher: hub === "work" });
    const office = catalog.filter((p) => p.target.kind === "officeApp");
    assert.equal(office.length, 23, "Three editors plus twenty AI apps");
    assert.equal(new Set(office.map((p) => p.id)).size, office.length);
    for (const slug of wanted) {
      const p = officeAppPlugin(hub, `${hub}-${slug}`);
      assert.ok(p, slug);
      assert.ok(isAddable(p));
      assert.ok(countsAsApp(hub, p));
      assert.equal(p.category, "Premium");
      assert.ok(p.target.kind === "officeApp" && p.target.href.startsWith("#/"));
    }
  });
}

test("WorkHub install/remove uses existing synced list and free slot counter", () => {
  const p = officeAppPlugin("work", "work-office-doc")!;
  const list = setWorkSheetsApp([], p, true);
  assert.deepEqual(list, ["work-office-doc"]);
  assert.equal(workInstalled(p, emptyWorkspace().visibleTabs, [], false, false, [], false, list), true);
  assert.deepEqual(workApps({ ...emptyWorkspace(), sheetsInstalled: list }).filter((v) => v.startsWith("sheets:")), ["sheets:work-office-doc"]);
  assert.deepEqual(setWorkSheetsApp(list, p, false), []);
});
test("LifeHub install/remove uses existing synced list and free slot counter", () => {
  const p = officeAppPlugin("life", "life-ai-quiz")!;
  const list = setLifeSheetsApp([], p, true);
  assert.deepEqual(list, ["life-ai-quiz"]);
  assert.equal(lifeInstalled(p, { ...emptyFamily(), sheetsInstalled: list }, [], list), true);
  assert.deepEqual(lifeApps({ family: { ...emptyFamily(), sheetsInstalled: list } }).filter((v) => v.startsWith("sheets:")), ["sheets:life-ai-quiz"]);
  assert.deepEqual(setLifeSheetsApp(list, p, false), []);
});
