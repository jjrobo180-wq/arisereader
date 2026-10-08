// Teacher Hub: the IEP deadline on step 1 of the meeting steps, and the same date on the caseload.
// Run: npx tsx --test tests/meeting-deadline.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { addMeetingWithDeadline, deadlineField, deadlineLabel, deadlineWords, meetingDeadline, savesToStudent, studentDeadline } from "../shared/meetingDeadline";
import { emptyWorkspace, normalizeWorkspace } from "../shared/teacherHub";
import { markDone, emptyPlan } from "../shared/meetingSteps";

const student = (id: string, name: string, iepDate = "", reevalDate = "") => ({ id, name, grade: "4", accommodations: "", iepDate, reevalDate, readingLevel: "", mathLevel: "", notes: "" });
const ws = () => normalizeWorkspace({ ...emptyWorkspace(), students: [student("s1", "Jordan Lee", "2026-11-20", "2027-03-01"), student("s2", "Ava Cruz")] });
const form = (patch: Partial<Parameters<typeof addMeetingWithDeadline>[1]> = {}) => ({ student: "Jordan Lee", type: "Annual IEP", deadline: "", date: "", time: "", room: "", notes: "", ...patch });

test("step 1 asks for the IEP deadline, or the reevaluation deadline for a reevaluation", () => {
  assert.equal(deadlineLabel("Annual IEP"), "IEP deadline date");
  assert.equal(deadlineLabel("Reevaluation"), "Reevaluation deadline date");
  assert.equal(deadlineLabel("Parent meeting"), "IEP deadline date");
  assert.equal(deadlineField("Re-evaluation"), "reevalDate");
  assert.equal(savesToStudent("Annual IEP"), true);
  assert.equal(savesToStudent("Reevaluation"), true);
  assert.equal(savesToStudent("Parent meeting"), false);
  assert.equal(deadlineWords("2026-11-20"), "Fri, Nov 20");
  assert.equal(deadlineWords("soon"), "");
});

test("the deadline fills in from the student's caseload date", () => {
  assert.equal(studentDeadline(ws(), "Jordan Lee", "Annual IEP"), "2026-11-20");
  assert.equal(studentDeadline(ws(), "  jordan lee ", "Annual IEP"), "2026-11-20", "names match without case or spaces");
  assert.equal(studentDeadline(ws(), "Jordan Lee", "Reevaluation"), "2027-03-01");
  assert.equal(studentDeadline(ws(), "Ava Cruz", "Annual IEP"), "", "no date saved yet");
  assert.equal(studentDeadline(ws(), "Someone New", "Annual IEP"), "", "not on the caseload");
});

test("a deadline typed on step 1 is saved on the meeting and on the student", () => {
  const plan = markDone(emptyPlan(), 1);
  let w = addMeetingWithDeadline(ws(), form({ student: "Ava Cruz", deadline: "2026-12-04" }), "m1", plan);
  assert.equal(w.meetings[0].deadline, "2026-12-04");
  assert.equal(w.meetings[0].date, "", "no meeting date until a time is booked");
  assert.equal(w.students.find((s) => s.id === "s2")!.iepDate, "2026-12-04", "the caseload gets the same date");
  assert.equal(studentDeadline(w, "Ava Cruz", "Annual IEP"), "2026-12-04", "and the next meeting for Ava fills it in");
  // A reevaluation saves to the reevaluation deadline.
  w = addMeetingWithDeadline(w, form({ type: "Reevaluation", deadline: "2027-02-15" }), "m2", plan);
  assert.equal(w.students.find((s) => s.id === "s1")!.reevalDate, "2027-02-15");
  assert.equal(w.students.find((s) => s.id === "s1")!.iepDate, "2026-11-20", "the IEP deadline is left alone");
  // A parent meeting keeps its own date only.
  w = addMeetingWithDeadline(w, form({ type: "Parent meeting", deadline: "2026-10-30" }), "m3", plan);
  assert.equal(w.students.find((s) => s.id === "s1")!.iepDate, "2026-11-20");
  assert.equal(w.meetings[2].deadline, "2026-10-30");
  // A student who is not on the caseload: the meeting keeps it.
  w = addMeetingWithDeadline(w, form({ student: "Sam Typed", deadline: "2026-11-02" }), "m4", plan);
  assert.equal(w.meetings[3].deadline, "2026-11-02");
  assert.equal(w.students.length, 2);
  // No deadline: nothing is added anywhere.
  w = addMeetingWithDeadline(w, form({ deadline: "" }), "m5", plan);
  assert.equal("deadline" in w.meetings[4], false);
  assert.equal(w.students.find((s) => s.id === "s1")!.iepDate, "2026-11-20");
  // A known meeting time can still be added.
  w = addMeetingWithDeadline(w, form({ deadline: "2026-11-20", date: "2026-11-10", time: "09:30" }), "m6", plan);
  assert.deepEqual([w.meetings[5].date, w.meetings[5].time], ["2026-11-10", "09:30"]);
});

test("the scheduler uses the caseload date, so a later change there counts", () => {
  let w = addMeetingWithDeadline(ws(), form({ deadline: "2026-11-20" }), "m1", emptyPlan());
  assert.equal(meetingDeadline(w, w.meetings[0]), "2026-11-20");
  w = { ...w, students: w.students.map((s) => (s.id === "s1" ? { ...s, iepDate: "2026-11-13" } : s)) };
  assert.equal(meetingDeadline(w, w.meetings[0]), "2026-11-13", "changed on the student's page");
  w = { ...w, students: w.students.map((s) => (s.id === "s1" ? { ...s, iepDate: "" } : s)) };
  assert.equal(meetingDeadline(w, w.meetings[0]), "2026-11-20", "cleared there: the meeting's own date");
  assert.equal(meetingDeadline(w, { student: "Jordan Lee", type: "Parent meeting", deadline: "2026-10-30" }), "2026-10-30");
  assert.equal(meetingDeadline(w, { student: "Jordan Lee", type: "Annual IEP" }), "", "an older meeting with no deadline");
  assert.equal(meetingDeadline(w, { student: "X", type: "Annual IEP", deadline: "not a date" }), "");
});
