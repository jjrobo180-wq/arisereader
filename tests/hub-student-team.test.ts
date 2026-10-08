// Teacher Hub: a student's disabilities and the people on their IEP team
// (social worker, OT, nurse, speech pathologist, gen ed teacher).
// Run with: npx tsx --test tests/hub-student-team.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GUIDE_LIMITS, GUIDE_ROLES, removeContact, roleLabel } from "../shared/hubGuide";
import { INVITEE_ROLES } from "../shared/meetingPoll";
import { cleanHubImport, describeHubItem, mergeHubImport, normalizeWorkspace, type Student, type Workspace } from "../shared/teacherHub";
import {
  DISABILITY_SUGGESTIONS, STUDENT_TEAM_ROLES, addStudentWithTeam, assignGuideRole, cleanDisabilities, draftHasAnyone, emptyTeamDraft, meetingPeople,
  newGuideFor, teamDraft, teamMembers, teamOf, updateStudentWithTeam, type StudentDetails, type TeamDraft,
} from "../shared/hubStudentTeam";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const counter = () => { let n = 0; return () => `id-${++n}`; };

const details = (name: string, more: Partial<StudentDetails> = {}): StudentDetails => ({ name, grade: "6", accommodations: "", iepDate: "", reevalDate: "", readingLevel: "", mathLevel: "", notes: "", ...more });
const jordan: Student = { id: "s1", ...details("Jordan Lee") };
const maya: Student = { id: "s2", ...details("Maya Torres") };

function hub(more: Partial<Workspace> = {}): Workspace {
  return normalizeWorkspace({
    students: [jordan, maya],
    spedContacts: [
      { id: "c1", name: "Pat Rivera", role: "socialWorker", email: "pat@example.org" },
      { id: "c2", name: "Dana Cho", role: "slp", email: "" },
      { id: "c3", name: "Dr. Shah", role: "psych", email: "shah@example.org" },
    ],
    ...more,
  });
}
const guide = (id: string, student: string, team: Record<string, string>) => ({ id, student, kind: "IEP meeting", planningDate: "", meetingDate: "", meetingTime: "", room: "", parent1: "", parent1Phone: "", parent2: "", parent2Phone: "", team, sections: [] });
const pick = (draft: TeamDraft, change: Partial<TeamDraft>): TeamDraft => ({ ...draft, ...change });
const typed = (name: string, email = "") => ({ id: "", name, email });

test("a student can have a social worker, an OT, a nurse, a speech pathologist and a gen ed teacher", () => {
  assert.deepEqual(STUDENT_TEAM_ROLES.map((r) => r.id), ["socialWorker", "ot", "nurse", "slp", "genEd"]);
  for (const role of STUDENT_TEAM_ROLES) {
    assert.ok(GUIDE_ROLES.some((g) => g.id === role.id), `${role.id} is also a role on the IEP guide`);
    assert.ok((INVITEE_ROLES as readonly string[]).includes(roleLabel(role.id)), `${role.id} can be asked about a meeting`);
  }
  assert.deepEqual(Object.keys(emptyTeamDraft()), ["socialWorker", "ot", "nurse", "slp", "genEd"]);
  assert.equal(draftHasAnyone(emptyTeamDraft()), false);
  assert.equal(draftHasAnyone(pick(emptyTeamDraft(), { nurse: typed("  ") })), false, "spaces are nobody");
  assert.equal(draftHasAnyone(pick(emptyTeamDraft(), { nurse: typed("Nurse Okoye") })), true);
});

test("the two disabilities are optional and tidied", () => {
  assert.deepEqual(cleanDisabilities("", ""), { disability1: "", disability2: "" });
  assert.deepEqual(cleanDisabilities("  Autism   Spectrum Disorder ", "Speech or Language Impairment"), { disability1: "Autism Spectrum Disorder", disability2: "Speech or Language Impairment" });
  assert.deepEqual(cleanDisabilities("", "Other Health Impairment"), { disability1: "Other Health Impairment", disability2: "" }, "a student with only one has it as disability 1");
  assert.deepEqual(cleanDisabilities("Autism", " autism "), { disability1: "Autism", disability2: "" }, "the same thing twice is kept once");
  assert.equal(cleanDisabilities("x".repeat(500), undefined).disability1.length, 120);
  assert.deepEqual(cleanDisabilities(null, { a: 1 }), { disability1: "", disability2: "" });
  assert.ok(DISABILITY_SUGGESTIONS.length >= 13 && new Set(DISABILITY_SUGGESTIONS).size === DISABILITY_SUGGESTIONS.length);
});

test("a new student is added with disabilities and a team in one save, and new people are saved once", () => {
  const start = hub();
  const draft = pick(emptyTeamDraft(), {
    socialWorker: { id: "c1", name: "Pat Rivera", email: "pat@example.org" },          // a saved person
    nurse: typed("  Nurse   Okoye ", "okoye@example.org"),                                // someone new
    ot: typed("Lee Tran"),                                                               // someone new, no email
    genEd: typed("dana cho"),                                                            // typed, but already on the list
  });
  const result = addStudentWithTeam(start, details("Riley Park", { disability1: "", disability2: "Specific Learning Disability (SLD)" }), draft, counter(), null);
  assert.ok(result.ok);
  const w = result.workspace;
  const riley = w.students[2];
  assert.equal(riley.name, "Riley Park");
  assert.deepEqual([riley.disability1, riley.disability2], ["Specific Learning Disability (SLD)", ""]);
  assert.deepEqual(w.spedContacts.map((c) => [c.name, c.role, c.email]), [
    ["Pat Rivera", "socialWorker", "pat@example.org"], ["Dana Cho", "slp", ""], ["Dr. Shah", "psych", "shah@example.org"],
    ["Lee Tran", "ot", ""], ["Nurse Okoye", "nurse", "okoye@example.org"],
  ], "two new people, each saved with the role they were typed in; Dana Cho is not saved twice");
  assert.deepEqual(teamMembers(w, "Riley Park").map(({ role, person }) => [role.id, person.name]), [["socialWorker", "Pat Rivera"], ["ot", "Lee Tran"], ["nurse", "Nurse Okoye"], ["genEd", "Dana Cho"]]);
  assert.equal(riley.team?.slp, undefined, "a role nobody holds is simply not there");
  assert.equal(start.students.length, 2, "the workspace handed in is not changed");
  assert.equal(start.spedContacts.length, 3);

  // nothing typed at all: a plain student, and no people are made up
  const plain = addStudentWithTeam(start, details("Sam Okafor"), emptyTeamDraft(), counter(), null);
  assert.ok(plain.ok);
  assert.equal(plain.workspace.spedContacts, start.spedContacts);
  assert.equal(plain.workspace.students[2].team, undefined);
  assert.deepEqual(teamOf(plain.workspace, "Sam Okafor"), {});
});

test("a student who can't be added adds nobody to the contact list either", () => {
  const start = hub();
  const draft = pick(emptyTeamDraft(), { nurse: typed("Nurse Okoye") });
  assert.deepEqual(addStudentWithTeam(start, details("jordan  lee"), draft, counter(), null), { ok: false, message: "Jordan Lee is already on your caseload." });
  assert.deepEqual(addStudentWithTeam(start, details("  "), draft, counter(), null), { ok: false, message: "A student needs a name." });
  const fullPlan = addStudentWithTeam(start, details("Riley Park"), draft, counter(), 2);
  assert.equal(fullPlan.ok, false);
  const badEmail = addStudentWithTeam(start, details("Riley Park"), pick(emptyTeamDraft(), { nurse: typed("Nurse Okoye", "okoye at school") }), counter(), null);
  assert.deepEqual(badEmail, { ok: false, message: "The email for Nurse Okoye does not look right. Fix it, or leave it empty for now." });
  // the contact list has a limit, and the message says what to do
  const many = hub({ spedContacts: Array.from({ length: GUIDE_LIMITS.contacts }, (_, i) => ({ id: `p${i}`, name: `Person ${i}`, role: "other", email: "" })) });
  const over = addStudentWithTeam(many, details("Riley Park"), draft, counter(), null);
  assert.equal(over.ok, false);
  assert.match((over as { message: string }).message, /up to 60 people/);
  assert.ok(addStudentWithTeam(many, details("Riley Park"), pick(emptyTeamDraft(), { nurse: { id: "p3", name: "Person 3", email: "" } }), counter(), null).ok, "picking someone already saved still works");
});

test("editing a student saves the team with the one Save, and changes only what changed", () => {
  const start = hub({ guides: [guide("g1", "jordan lee", { psych: "c3", slp: "c2", leader: "c3" })] as any });
  // the form opens with what the student has now: here, the speech pathologist picked on the guide long ago
  const open = teamDraft(start, "Jordan Lee");
  assert.deepEqual(open.slp, { id: "c2", name: "Dana Cho", email: "" });
  assert.deepEqual(open.nurse, { id: "", name: "", email: "" });

  const draft = pick(open, { nurse: typed("Nurse Okoye"), slp: { id: "c2", name: "Dana Cho", email: "dana@example.org" } });
  const result = updateStudentWithTeam(start, "s1", details("Jordan Lee", { grade: "7", disability1: "Autism Spectrum Disorder (ASD)", disability2: "Other Health Impairment (OHI)" }), draft, counter());
  assert.ok(result.ok);
  const w = result.workspace;
  assert.equal(w.students[0].grade, "7");
  assert.deepEqual([w.students[0].disability1, w.students[0].disability2], ["Autism Spectrum Disorder (ASD)", "Other Health Impairment (OHI)"]);
  const nurse = w.spedContacts.find((c) => c.name === "Nurse Okoye")!;
  assert.deepEqual(w.students[0].team, { nurse: nurse.id, slp: "c2" });
  assert.deepEqual(w.guides[0].team, { psych: "c3", slp: "c2", leader: "c3", nurse: nurse.id }, "the guide gains the nurse and keeps everyone it had");
  assert.equal(w.spedContacts.find((c) => c.id === "c2")!.email, "dana@example.org", "an email typed for a saved person is theirs from now on");
  assert.equal(w.students[1], start.students[1], "nobody else is touched");
  assert.deepEqual(start.guides[0].team, { psych: "c3", slp: "c2", leader: "c3" }, "the workspace handed in is not changed");

  // taking someone off: gone from the student and from the guide, still on the teacher's list
  const off = updateStudentWithTeam(w, "s1", details("Jordan Lee"), pick(teamDraft(w, "Jordan Lee"), { slp: typed("") }), counter());
  assert.ok(off.ok);
  assert.deepEqual(off.workspace.students[0].team, { nurse: nurse.id });
  assert.deepEqual(off.workspace.guides[0].team, { psych: "c3", leader: "c3", nurse: nurse.id });
  assert.equal(off.workspace.spedContacts.length, w.spedContacts.length);
  assert.deepEqual(teamOf(off.workspace, "Jordan Lee"), { nurse: nurse.id }, "and the guide does not bring them back");

  // an empty email box never wipes an email that is saved
  const kept = updateStudentWithTeam(w, "s1", details("Jordan Lee"), pick(teamDraft(w, "Jordan Lee"), { slp: { id: "c2", name: "Dana Cho", email: "" } }), counter());
  assert.ok(kept.ok);
  assert.equal(kept.workspace.spedContacts.find((c) => c.id === "c2")!.email, "dana@example.org");

  // saving with nothing changed changes nothing
  const same = updateStudentWithTeam(w, "s1", w.students[0], teamDraft(w, "Jordan Lee"), counter());
  assert.ok(same.ok);
  assert.equal(same.workspace.guides, w.guides);
  assert.equal(same.workspace.spedContacts, w.spedContacts);
});

test("a student's other details are kept when only the team is saved, and a new name carries the team along", () => {
  const start = hub({ students: [{ ...jordan, team: { socialWorker: "c1" } }, maya], guides: [guide("g1", "Jordan Lee", { socialWorker: "c1" })] as any });
  const renamed = updateStudentWithTeam(start, "s1", details("Jordan Lee-Park"), pick(teamDraft(start, "Jordan Lee"), { slp: { id: "c2", name: "Dana Cho", email: "" } }), counter());
  assert.ok(renamed.ok);
  assert.equal(renamed.moved, 1, "the guide follows the new name");
  assert.deepEqual(renamed.workspace.guides[0], { ...start.guides[0], student: "Jordan Lee-Park", team: { socialWorker: "c1", slp: "c2" } });
  assert.deepEqual(teamOf(renamed.workspace, "jordan lee-park"), { socialWorker: "c1", slp: "c2" });
  assert.deepEqual(updateStudentWithTeam(start, "s1", details("Maya Torres"), emptyTeamDraft(), counter()), { ok: false, message: "Maya Torres is already on your caseload." });
  assert.deepEqual(updateStudentWithTeam(start, "gone", details("X"), emptyTeamDraft(), counter()), { ok: false, message: "That student is no longer on your caseload." });
});

test("the IEP guide and the caseload show the same five people", () => {
  const start = hub({ students: [{ ...jordan, team: { socialWorker: "c1" } }, maya] });
  // a new guide already knows the student's team
  const makeId = counter();
  const g = newGuideFor(start, " jordan  lee ", "IEP meeting", makeId);
  assert.deepEqual(g.team, { socialWorker: "c1" });
  assert.equal(g.student, "jordan lee");
  assert.ok(g.sections.length > 0, "with its whole checklist");
  assert.deepEqual(newGuideFor(start, "Maya Torres", "Re-evaluation", makeId).team, {});
  let w: Workspace = { ...start, guides: [g, newGuideFor(start, "Jordan Lee", "Re-evaluation", makeId)] };
  assert.notEqual(w.guides[0].id, w.guides[1].id);

  // choosing the speech pathologist on one guide puts them on the student and on the student's other guide
  w = assignGuideRole(w, g.id, "slp", "c2");
  assert.deepEqual(w.students[0].team, { socialWorker: "c1", slp: "c2" });
  assert.deepEqual(w.guides.map((x) => x.team), [{ socialWorker: "c1", slp: "c2" }, { socialWorker: "c1", slp: "c2" }]);
  // a meeting leader or a psych is only for that one guide
  w = assignGuideRole(w, g.id, "leader", "c3");
  assert.deepEqual(w.students[0].team, { socialWorker: "c1", slp: "c2" });
  assert.deepEqual(w.guides.map((x) => x.team.leader), ["c3", undefined]);
  // "Not assigned" takes them off everywhere
  w = assignGuideRole(w, g.id, "socialWorker", "");
  assert.deepEqual(w.students[0].team, { slp: "c2" });
  assert.deepEqual(w.guides.map((x) => x.team.socialWorker), [undefined, undefined]);
  assert.equal(w.students[1], start.students[1], "another student is never touched");
  assert.equal(assignGuideRole(w, "no-such-guide", "slp", "c1"), w);

  // a guide whose student is not on the caseload still works
  const lone: Workspace = { ...start, guides: [{ ...newGuideFor(start, "Someone Else", "IEP meeting", counter()) }] };
  assert.deepEqual(assignGuideRole(lone, lone.guides[0].id, "nurse", "c1").guides[0].team, { nurse: "c1" });
});

test("people chosen on a guide before teams were kept on the caseload are not lost", () => {
  const start = hub({ guides: [guide("g1", "Maya Torres", { genEd: "c1", slp: "c2", psych: "c3", nurse: "deleted-long-ago" })] as any });
  assert.deepEqual(teamOf(start, "Maya Torres"), { slp: "c2", genEd: "c1" }, "someone who was deleted is not on the team");
  // changing just one of them on the guide writes the whole team down with the student
  const w = assignGuideRole(start, "g1", "ot", "c3");
  assert.deepEqual(w.students[1].team, { slp: "c2", genEd: "c1", ot: "c3" });
  // changing just one on the caseload leaves the rest of the guide alone
  const saved = updateStudentWithTeam(start, "s2", details("Maya Torres"), pick(teamDraft(start, "Maya Torres"), { socialWorker: { id: "c1", name: "Pat Rivera", email: "" } }), counter());
  assert.ok(saved.ok);
  assert.deepEqual(saved.workspace.guides[0].team, { genEd: "c1", slp: "c2", psych: "c3", nurse: "deleted-long-ago", socialWorker: "c1" });
  assert.deepEqual(saved.workspace.students[1].team, { socialWorker: "c1", slp: "c2", genEd: "c1" });
});

test("deleting a person takes them off every student's team", () => {
  const start = hub({ students: [{ ...jordan, team: { socialWorker: "c1", slp: "c2" } }, { ...maya, team: { slp: "c2" } }], guides: [guide("g1", "Jordan Lee", { socialWorker: "c1", slp: "c2" })] as any });
  const next = removeContact(start, "c1");
  assert.deepEqual(next.students.map((s) => s.team), [{ slp: "c2" }, { slp: "c2" }]);
  assert.deepEqual(next.guides[0].team, { slp: "c2" });
  assert.equal(next.students[1], start.students[1], "a student they were not on is left as it was");
  assert.deepEqual(teamMembers(next, "Jordan Lee").map(({ person }) => person.name), ["Dana Cho"]);
});

test("asking for meeting times starts with the student's team", () => {
  const start = hub({
    students: [{ ...jordan, team: { socialWorker: "c1", slp: "c2" } }, maya],
    guides: [guide("g1", "Jordan Lee", { socialWorker: "c1", slp: "c2", leader: "c3", psych: "c3" })] as any,
  });
  assert.deepEqual(meetingPeople(start, "Jordan Lee").map(({ person, role }) => [person.name, role]), [["Pat Rivera", "socialWorker"], ["Dana Cho", "slp"], ["Dr. Shah", "leader"]], "the team first, then the guide's own people, nobody twice");
  // with no guide at all, the team from the caseload is still asked
  assert.deepEqual(meetingPeople({ ...start, guides: [] }, "jordan lee").map(({ person }) => person.name), ["Pat Rivera", "Dana Cho"]);
  assert.deepEqual(meetingPeople(start, "Maya Torres"), []);
  assert.deepEqual(meetingPeople(start, ""), []);
});

test("disabilities can come in with a caseload added in bulk", () => {
  const items = cleanHubImport({ students: [{ name: "Riley Park", grade: 6, disability2: "  Autism Spectrum  Disorder " }, { name: "Sam Okafor", disability1: "SLD", disability2: "OHI" }] }, "2026-10-08");
  assert.equal(describeHubItem("students", items.students[1]).detail, "SLD · OHI");
  const merged = mergeHubImport(hub(), items, counter(), null);
  assert.deepEqual(merged.workspace.students.slice(2).map((s) => [s.name, s.disability1, s.disability2]), [["Riley Park", "Autism Spectrum Disorder", ""], ["Sam Okafor", "SLD", "OHI"]]);
});

test("the screens: one save, nothing hidden behind a second button", () => {
  const caseload = read("client/src/pages/TeacherHub.tsx");
  const fields = read("client/src/components/teacher-hub/HubStudentTeam.tsx");
  const profile = read("client/src/components/teacher-hub/HubStudentProfile.tsx");
  const guidePage = read("client/src/components/teacher-hub/HubGuide.tsx");
  const steps = read("client/src/components/teacher-hub/HubMeetingSteps.tsx");
  const poll = read("client/src/components/teacher-hub/HubMeetingPoll.tsx");
  // the add form and the edit form both save the student and the team together
  for (const part of ["addStudentWithTeam(workspace, form, formTeam, id, seats)", "updateStudentWithTeam(workspace, editing.id, editing.form, editing.team, id)", 'data-testid="hub-student-more-toggle"', 'data-testid="hub-student-add-team"', "<StudentTeamSummary workspace={workspace} student={s.name} />"]) assert.ok(caseload.includes(part), part);
  assert.equal(caseload.split("<StudentTeamFields").length - 1, 2, "the same fields in the add form and the edit form");
  // the fields have no button that submits or saves by itself, and no <details> that can start closed
  assert.ok(!/type="submit"/.test(fields) && !/<details/.test(fields) && !/Save person/.test(fields) && !/setWorkspace/.test(fields));
  for (const part of ['label="Disability 1"', 'label="Disability 2"', "<datalist", "+ Add someone new…", "Email (optional)", 'data-testid="student-team-summary"']) assert.ok(fields.includes(part), part);
  // night mode has colors for every background the new screens use
  const night = read("client/src/components/teacher-hub/hubNight.css");
  for (const bg of new Set([...fields.matchAll(/\bbg-[a-z]+-\d+(?:\/\d+)?/g)].map((m) => m[0]))) assert.ok(night.includes("." + bg.replace("/", "\\/")), `${bg} has a night color`);
  assert.ok(profile.includes("<StudentTeamSummary workspace={workspace} student={s.name} emails />"));
  assert.ok(guidePage.includes("assignGuideRole(p, guide.id, role.id, contactId)") && guidePage.includes("newGuideFor(workspace, form.student, form.kind, makeId)"));
  assert.ok(steps.includes("newGuideFor(workspace, meeting.student"));
  assert.ok(poll.includes("meetingPeople(workspace, meeting.student)"));
});
