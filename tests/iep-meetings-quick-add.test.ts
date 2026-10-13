// IEP meeting student entry and caseload share one persisted roster.
import test from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace, normalizeWorkspace } from "../shared/teacherHub";
import { addStudentWithTeam, emptyTeamDraft, newGuideFor, type StudentDetails } from "../shared/hubStudentTeam";
import { addMeetingWithDeadline, studentDeadline } from "../shared/meetingDeadline";
import { emptyPlan } from "../shared/meetingSteps";

const ids = () => { let n = 0; return () => "q" + (++n); };
const details = (name: string): StudentDetails => ({
  name, grade: "7", readingLevel: "3", mathLevel: "4",
  iepDate: "2026-11-20", reevalDate: "2027-02-15", accommodations: "Extra time",
  notes: "", disability1: "Specific Learning Disability (SLD)", disability2: ""
});

test("adding in IEP and Meetings populates caseload, deadlines, guide and meeting from the same record", () => {
  const makeId = ids();
  const before = normalizeWorkspace(emptyWorkspace());
  const saved = addStudentWithTeam(before, details("Taylor Rivera"), emptyTeamDraft(), makeId, 30);
  assert.ok(saved.ok);
  const workspace = saved.workspace;
  assert.equal(workspace.students.length, 1, "Caseload receives the student");
  assert.equal(workspace.students[0].accommodations, "Extra time");
  assert.equal(studentDeadline(workspace, "Taylor Rivera", "Annual IEP"), "2026-11-20");
  assert.equal(studentDeadline(workspace, "Taylor Rivera", "Reevaluation"), "2027-02-15");

  const guide = newGuideFor(workspace, "Taylor Rivera", "IEP meeting", makeId);
  assert.equal(guide.student, workspace.students[0].name);
  const after = addMeetingWithDeadline(workspace, {
    student: workspace.students[0].name, type: "Annual IEP", deadline: "2026-11-20",
    date: "", time: "", room: "", notes: ""
  }, makeId(), emptyPlan());
  assert.equal(after.meetings.length, 1);
  assert.equal(after.meetings[0].student, after.students[0].name);
  assert.equal(after.students.length, 1, "Making the meeting does not duplicate the student");
});

test("the shared IEP quick-add respects caseload seat and duplicate limits", () => {
  const makeId = ids(), start = normalizeWorkspace(emptyWorkspace());
  const one = addStudentWithTeam(start, details("Taylor Rivera"), emptyTeamDraft(), makeId, 1);
  assert.ok(one.ok);
  assert.equal(addStudentWithTeam(one.workspace, details("Taylor Rivera"), emptyTeamDraft(), makeId, 1).ok, false);
  assert.equal(addStudentWithTeam(one.workspace, details("Morgan Lee"), emptyTeamDraft(), makeId, 1).ok, false);
  assert.equal(one.workspace.students.length, 1);
});
