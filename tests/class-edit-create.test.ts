import test from "node:test";
import assert from "node:assert/strict";
import { classGroups, createClass, editClass } from "../shared/hubClassMinutes";
import { cleanSubject } from "../shared/hubSubjects";
import type { ServicePlan } from "../shared/teacherHub";

const blocks = [{ id: "b1", name: "Block 1" }, { id: "b2", name: "Block 2" }] as any;
let n = 0; const id = () => `id${++n}`;

test("a new class gives each student the same place, teacher and subject", () => {
  const plans = createClass([], ["Ava", "Ben"], { kind: "Push-in", minutesPerWeek: 60, block: "b1", teacher: "ms. lee", subject: "science" }, id, "2026-11-02");
  assert.equal(plans.length, 2);
  assert.ok(plans.every((p) => p.block === "b1" && p.teacher === "Ms. Lee" && p.subject === "science"));
  assert.equal(classGroups(plans, blocks, [], "2026-11-09").length, 1);
});

test("changing a class moves every student and can clear the teacher", () => {
  const plans = createClass([], ["Ava", "Ben"], { kind: "Push-in", minutesPerWeek: 60, block: "b1", teacher: "Ms. Lee" }, id, "2026-11-02");
  const group = classGroups(plans, blocks, [], "2026-11-09")[0];
  const moved = editClass(plans, group, { block: "b2", part: "first", teacher: "Mr. Kim", subject: "Math" });
  assert.ok(moved.every((p: ServicePlan) => p.block === "b2" && p.part === "first" && p.teacher === "Mr. Kim" && p.subject === "Math"));
  const cleared = editClass(moved, classGroups(moved, blocks, [], "2026-11-09")[0], { block: "b2" });
  assert.ok(cleared.every((p: ServicePlan) => !p.teacher && !p.subject));
});

test("subjects can be typed", () => {
  assert.equal(cleanSubject("  Social   Studies "), "Social Studies");
  assert.equal(cleanSubject("math"), "Math");
});
