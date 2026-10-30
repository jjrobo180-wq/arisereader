import test from "node:test";
import assert from "node:assert/strict";
import { liveProApps, AI_TOOL_TO_PRO } from "../shared/pro/apps";
import { GALLERY_MERGES, pluginsFor, workInstalled, lifeInstalled, officeAppPlugin, setWorkSheetsApp, setLifeSheetsApp, isAddable } from "../shared/pluginStore";
import { countsAsApp, workApps, lifeApps } from "../shared/todoPlan";
import { emptyWorkspace } from "../shared/teacherHub";
import { emptyFamily } from "../shared/familyHub";

const wanted = ["office-sheet", "office-doc", "office-slides", "ai-meeting-agenda", "ai-quiz", "ai-meal-plan"];

for (const hub of ["work", "life"] as const) {
  test(`${hub} App Store lists working, individually installable Office & AI tools`, () => {
    const catalog = pluginsFor(hub, { teacher: hub === "work" });
    const office = catalog.filter((p) => p.target.kind === "officeApp");
    const replaced = Object.values(AI_TOOL_TO_PRO).filter((id) => liveProApps().some((a) => a.id === id)).length;
    // Premium apps that do the same job as another app were combined into it (GALLERY_MERGES, Oct 2026).
    const merged = new Set(GALLERY_MERGES.flatMap((m) => m.drop));
    const kept = liveProApps().filter((a) => !merged.has(a.name));
    assert.ok(office.length >= 20 && office.length <= 23 + liveProApps().length - replaced + 3, `${office.length} office apps`);
    for (const id of [`${hub}-atmosphere`, `${hub}-sleep-studio`]) {
      const app = officeAppPlugin(hub, id);
      assert.ok(app, `${id} is discoverable and installable`);
      assert.ok(isAddable(app) && countsAsApp(hub, app));
      assert.ok(app.target.kind === "officeApp" && app.target.href.startsWith("#/ambient"), `${id} opens the real Standby app`);
    }
    assert.equal(new Set(office.map((p) => p.name)).size, office.length, "No two listings with the same name");
    for (const a of kept) assert.ok(office.some((p) => p.target.kind === "officeApp" && p.target.href === `#/pro?app=${a.id}&hub=${hub}`), a.id);
    assert.equal(new Set(office.map((p) => p.id)).size, office.length);
    for (const slug of wanted) {
      const p = officeAppPlugin(hub, `${hub}-${slug}`);
      assert.ok(p, slug);
      assert.ok(isAddable(p));
      assert.ok(countsAsApp(hub, p));
      assert.ok(p.category.startsWith("Premium"));
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
