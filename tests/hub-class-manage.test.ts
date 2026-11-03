// Minutes page: adding students to a class already made, and deleting a class.
// Run with: npx tsx --test tests/hub-class-manage.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { addToClass, classCandidates, classGroups, deleteClass, restorePlans } from "../shared/hubClassMinutes";
import type { ServicePlan } from "../shared/teacherHub";

const blocks = [{ id: "b1", name: "Block 1" }, { id: "b2", name: "Block 2" }] as any;
const plan = (id: string, student: string, block: string, teacher = "Ms. Lee"): ServicePlan => ({ id, student, kind: "Push-in", minutesPerWeek: 60, days: { Mon: 30, Wed: 30 }, block, teacher, subject: "Reading", since: "2026-09-01" });
const groupsOf = (s: ServicePlan[]) => classGroups(s, blocks, [], "2026-11-02");
const made = () => { let n = 0; return () => `new${++n}`; };

test("a new student joins with the class's service, days, minutes and place", () => {
  const services = [plan("a", "Amy", "b1")];
  const next = addToClass(services, groupsOf(services)[0], ["Ben"], made(), "2026-11-02");
  const ben = next.find((p) => p.student === "Ben")!;
  assert.deepEqual({ kind: ben.kind, days: ben.days, week: ben.minutesPerWeek, block: ben.block, teacher: ben.teacher, subject: ben.subject, since: ben.since, id: ben.id }, { kind: "Push-in", days: { Mon: 30, Wed: 30 }, week: 60, block: "b1", teacher: "Ms. Lee", subject: "Reading", since: "2026-11-02", id: "new1" });
  assert.equal(groupsOf(next)[0].students.length, 2);
});

test("someone in the class already isn't added twice, whatever their capitals", () => {
  const services = [plan("a", "Amy", "b1")];
  assert.equal(addToClass(services, groupsOf(services)[0], [" amy "], made(), "2026-11-02").length, 1);
});

test("a student in another class moves, says so first, and keeps their id and start date", () => {
  const services = [plan("a", "Amy", "b1"), plan("c", "Cal", "b2")];
  const groups = groupsOf(services), one = groups.find((g) => g.block === "b1")!;
  assert.equal(classCandidates(["Amy", "Cal", "Dee"], one, "Push-in", groups).find((x) => x.name === "Cal")!.movesFrom, "Block 2 · Ms. Lee");
  assert.deepEqual(classCandidates(["Amy", "Cal", "Dee"], one, "Push-in", groups).map((x) => x.name), ["Cal", "Dee"]);
  const next = addToClass(services, one, ["Cal"], made(), "2026-11-02");
  assert.equal(next.length, 2);
  const cal = next.find((p) => p.id === "c")!;
  assert.equal(cal.block, "b1");
  assert.equal(cal.since, "2026-09-01");
});

test("deleting a class keeps the students' required minutes unless asked, and touches no other class", () => {
  const services = [plan("a", "Amy", "b1"), plan("c", "Cal", "b2")];
  const one = groupsOf(services).find((g) => g.block === "b1")!;
  const kept = deleteClass(services, one, false);
  assert.equal(kept.length, 2);
  const amy = kept.find((p) => p.id === "a")!;
  assert.equal(amy.block, undefined); assert.equal(amy.teacher, undefined); assert.equal(amy.minutesPerWeek, 60);
  assert.equal(groupsOf(kept).length, 1);
  assert.deepEqual(deleteClass(services, one, true).map((p) => p.id), ["c"]);
});

test("undo puts a deleted class back without losing changes made since", () => {
  const services = [plan("a", "Amy", "b1"), plan("c", "Cal", "b2")];
  const one = groupsOf(services).find((g) => g.block === "b1")!;
  const later = [...deleteClass(services, one, true), plan("d", "Dee", "b2")];
  const back = restorePlans(later, [services[0]]);
  assert.deepEqual(back.map((p) => p.id).sort(), ["a", "c", "d"]);
  assert.equal(back.find((p) => p.id === "a")!.block, "b1");
});
