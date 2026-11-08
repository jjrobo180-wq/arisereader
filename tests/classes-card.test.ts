import test from "node:test";
import assert from "node:assert/strict";
import { cleanClasses } from "../shared/lessonPlanner";

test("a class keeps its teacher and a typed subject", () => {
  const [c] = cleanClasses([{ id: "a", name: "Period 2", subject: "Art History", teacher: " Ms. Lee ", room: "12", students: ["Ava"] }]);
  assert.equal(c.teacher, "Ms. Lee");
  assert.equal(c.subject, "Art History");
});
