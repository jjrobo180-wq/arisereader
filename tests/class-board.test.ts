import test from "node:test";
import assert from "node:assert/strict";
import { absentLog, classGroups, dayLogs, leaveClass, studentLog, ABSENT_REASON } from "../shared/hubClassMinutes";

const BLOCKS = [{ id: "b1", name: "Block 1" }];
const plans: any[] = [
  { id: "p1", student: "Ava Reed", kind: "Push-in", minutesPerWeek: 60, days: { Mon: 30, Fri: 30 }, block: "b1", teacher: "Ms. Lee", subject: "Math", since: "2026-11-02" },
  { id: "p2", student: "Jon Park", kind: "Push-in", minutesPerWeek: 60, block: "b1", teacher: "Ms. Lee", since: "2026-11-02" },
];
const day = "2026-11-06"; // a Friday

test("the class page logs one student with their usual minutes, or the minutes given, in the class's place", () => {
  const [g] = classGroups(plans, BLOCKS, [], day);
  const ava = g.students.find((s) => s.student === "Ava Reed")!;
  assert.deepEqual(studentLog(g, ava, day), { student: "Ava Reed", date: day, kind: "Push-in", minutes: 30, note: "", block: "b1", teacher: "Ms. Lee", subject: "Math" });
  assert.equal(studentLog(g, ava, day, 45)!.minutes, 45);
  // Counted by the week only: no usual minutes, so the page asks for them.
  const jon = g.students.find((s) => s.student === "Jon Park")!;
  assert.equal(studentLog(g, jon, day), null);
});

test("absent, the day's sessions, and taking a student out of a class", () => {
  const [g] = classGroups(plans, BLOCKS, [], day);
  const ava = g.students[0];
  const a = absentLog(g, ava, day);
  assert.equal(a.notMet, true); assert.equal(a.note, ABSENT_REASON); assert.equal(a.minutes, 0);
  const logs: any[] = [{ id: "l1", ...a }, { id: "l2", student: "ava reed", kind: "Push-in", date: day, minutes: 10 }, { id: "l3", student: "Ava Reed", kind: "Push-in", date: "2026-11-05", minutes: 10 }];
  assert.deepEqual(dayLogs(logs, ava, day).map((l) => l.id), ["l1", "l2"]);
  const after = leaveClass(plans, "p1");
  assert.equal(after[0].block, undefined); assert.equal(after[0].teacher, undefined); assert.equal(after[0].minutesPerWeek, 60);
  assert.equal(after[1], plans[1]);
  assert.equal(classGroups(after, BLOCKS, [], day)[0].students.length, 1);
});
