import test from "node:test";
import assert from "node:assert/strict";
import { findStudent, type StudentRow } from "../server/studentRecovery";

const s = (id: number, displayName: string, studentNumber: string | null, username = `kid${id}`): StudentRow => ({ id, username, displayName, schoolId: 1, teacherId: null, studentNumber });
const kids = [s(1, "Maya Lopez", "123456"), s(2, "Jordan Smith", "222333"), s(3, "Jordan Smith-Lee", null, "445566"), s(4, "Ana María Ruiz", "777")];

test("finds a student by ID number (or a numeric username)", () => {
  assert.equal((findStudent(kids, { studentNumber: "123456" }) as any).student.id, 1);
  assert.equal((findStudent(kids, { studentNumber: "445566" }) as any).student.id, 3);
  assert.deepEqual(findStudent(kids, { studentNumber: "999" }), { reason: "none" });
});

test("finds a student by first and last name, and never guesses between two", () => {
  assert.equal((findStudent(kids, { firstName: "maya", lastName: "LOPEZ" }) as any).student.id, 1);
  assert.equal((findStudent(kids, { firstName: "Ana", lastName: "Ruiz" }) as any).student.id, 4);
  assert.equal((findStudent([...kids, s(5, "Maya Lopez", null)], { firstName: "Maya", lastName: "Lopez" }) as any).reason, "many");
  assert.deepEqual(findStudent(kids, { firstName: "Maya", lastName: "" }), { reason: "none" });
});
