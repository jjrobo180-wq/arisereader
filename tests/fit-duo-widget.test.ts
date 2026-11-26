// Health & Fitness stats as an iPhone widget and as a To Do Home card (Nov 24, 2026).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyFit } from "../shared/fit";
import { fitDuoSlot, fitHomeStats } from "../client/src/lib/fitWidgets";

test("the To Do widget is one Health & Fitness slot that opens the plugin", () => {
  const slot = fitDuoSlot(emptyFit(), undefined);
  assert.equal(slot.id, "duo.fit.today");
  assert.equal(slot.title, "Health & Fitness");
  assert.equal(slot.open, "arisetodo://open?s=cooked");
  assert.match(slot.value, /cal$/);
  assert.ok((slot.lines ?? []).some((l) => l.startsWith("Water")));
});

test("the widget is listed for the To Do iPhone build", () => {
  const list = JSON.parse(readFileSync("arisetodo/ios-app/widgets.json", "utf8")) as [string, string][];
  assert.ok(list.some(([id]) => id === "duo.fit.today"));
});

test("Home stats carry every number the card shows", () => {
  const s = fitHomeStats(emptyFit(), undefined);
  for (const k of ["calories", "water", "protein", "workouts", "streak"] as const) assert.ok(s[k], k);
});

test("To Do Home shows the card and tile when Health & Fitness is on", () => {
  const home = readFileSync("client/src/components/family-hub/FamilyHome.tsx", "utf8");
  assert.match(home, /FitHomeCard onOpen=\{openFitness\}/);
  assert.match(home, /id: "live-fitness"/);
  const duo = readFileSync("client/src/pages/AriseTodo.tsx", "utf8");
  assert.match(duo, /openFitness=\{!familySpace && isOn\("cooked", family\)/);
});
