// Teacher Hub: the IEP guide (a checklist for each student's IEP or re-evaluation meeting).
// Run with: npx tsx --test tests/teacher-hub-guide.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HUB_TABS, normalizeWorkspace, updateStudent, type HubContact, type IepGuide, type Workspace } from "../shared/teacherHub";
import {
  GUIDE_LIMITS, GUIDE_ROLES, GUIDE_TEMPLATE, addStep, changeGuide, changeStep, cleanEmail, cleanLink, contactsFor, feedbackEmail, guideProgress,
  linksIn, longDate, newGuide, parentText, removeContact, removeStep, roleLabel, sectionsOf, teamMember,
} from "../shared/hubGuide";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
let serial = 0;
// Ids the way the page makes them: long, and different every time.
const makeId = () => `0000-${(++serial).toString(16).padStart(12, "0")}`;

// Made-up people. No real name belongs in this file or in the guide's code.
const contacts: HubContact[] = [
  { id: "c1", name: "Avery Stone", role: "socialWorker", email: "avery.stone@example.org" },
  { id: "c2", name: "Blake Rivers", role: "socialWorker", email: "" },
  { id: "c3", name: "Casey Moon", role: "slp", email: "casey.moon@example.org" },
  { id: "c4", name: "Devon Hart", role: "genEd", email: "devon.hart@example.org" },
];

test("a new guide is the whole checklist for that kind of meeting, with nothing done and nobody assigned", () => {
  const iep = newGuide("  Jordan   Lee ", "IEP meeting", makeId);
  assert.equal(iep.student, "Jordan Lee");
  assert.deepEqual(iep.sections.map((s) => s.title), ["Lock in the meeting schedule", "IEP document", "Between meetings", "Meeting ready"]);
  assert.deepEqual(iep.sections.map((s) => s.steps.length), [13, 8, 1, 1]);
  assert.deepEqual(guideProgress(iep), { done: 0, total: 23 });
  assert.deepEqual(iep.team, {}, "who is on the team is chosen for each student");
  for (const field of ["planningDate", "meetingDate", "meetingTime", "room", "parent1", "parent1Phone", "parent2", "parent2Phone"] as const) assert.equal(iep[field], "", field);
  assert.ok(iep.sections.every((s) => s.steps.every((step) => step.done === false && step.note === "" && step.text)));

  const reeval = newGuide("Maya Torres", "Re-evaluation", makeId);
  assert.deepEqual(reeval.sections.map((s) => s.title), ["Re-evaluation checklist", "IEP document", "Between meetings", "Meeting ready"], "a re-evaluation has its own first part in place of the scheduling one");
  assert.equal(reeval.sections[0].steps.length, 18);
  assert.equal(reeval.sections[0].steps[0].text, "Open the evaluation folder");

  // every step and part can be told apart, and a guide is small enough to keep one for every student
  for (const guide of [iep, reeval]) {
    const ids = guide.sections.flatMap((s) => [s.id, ...s.steps.map((step) => step.id)]);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(JSON.stringify(guide).length < 5000, `${guide.kind} is ${JSON.stringify(guide).length} characters`);
  }
  assert.notEqual(iep.id, reeval.id);
  assert.equal(newGuide("Sam", "Something else" as any, makeId).kind, "IEP meeting");
  // ids that keep coming out the same still end up different
  const stuck = newGuide("Sam", "IEP meeting", () => "same");
  assert.equal(new Set(stuck.sections.flatMap((s) => s.steps.map((step) => step.id))).size, 23);
});

test("no person's name or address is built into the guide", () => {
  for (const file of ["shared/hubGuide.ts", "client/src/components/teacher-hub/HubGuide.tsx"]) {
    const source = read(file);
    const addresses = (source.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi) || []);
    assert.deepEqual(addresses, [], `${file} has an email address in it`);
  }
  for (const part of GUIDE_TEMPLATE) for (const step of part.steps) assert.ok(step.length <= GUIDE_LIMITS.step && !/@/.test(step), step);
});

test("a step can be checked off, given a note, reworded, deleted, and joined by new ones", () => {
  const start = newGuide("Jordan Lee", "IEP meeting", makeId);
  const doc = start.sections[1], first = doc.steps[0], second = doc.steps[1];

  let guide = changeStep(start, doc.id, first.id, { done: true });
  guide = changeStep(guide, doc.id, second.id, { note: "Draft: https://docs.example.org/d/abc" });
  assert.deepEqual(guide.sections[1].steps.slice(0, 2).map((s) => [s.done, s.note]), [[true, ""], [false, "Draft: https://docs.example.org/d/abc"]]);
  assert.deepEqual(guideProgress(guide), { done: 1, total: 23 });
  assert.equal(guide.sections[0], start.sections[0], "the other parts are left alone");
  assert.equal(start.sections[1].steps[0].done, false, "the guide handed in is not changed");
  assert.equal(changeStep(guide, doc.id, first.id, { done: false }).sections[1].steps[0].done, false, "a check can be taken back");

  guide = changeStep(guide, doc.id, first.id, { text: "  Copy   my own template " });
  assert.equal(guide.sections[1].steps[0].text, "Copy my own template");
  assert.equal(changeStep(guide, doc.id, first.id, { text: "   " }).sections[1].steps[0].text, "Copy my own template", "a step is not reworded to nothing");
  assert.equal(changeStep(guide, doc.id, second.id, { note: "x".repeat(5000) }).sections[1].steps[1].note.length, GUIDE_LIMITS.note);

  guide = removeStep(guide, doc.id, second.id);
  assert.equal(guide.sections[1].steps.length, 7);
  assert.ok(!guide.sections[1].steps.some((s) => s.id === second.id));

  const ready = guide.sections[3];
  guide = addStep(guide, ready.id, "  Print 5 copies of the agenda ", makeId);
  guide = addStep(guide, ready.id, "   ", makeId);
  assert.deepEqual(guide.sections[3].steps.map((s) => [s.text, s.done, s.note]), [["Complete the IEP agenda and link it here", false, ""], ["Print 5 copies of the agenda", false, ""]]);
  const ids = guide.sections.flatMap((s) => s.steps.map((step) => step.id));
  assert.equal(new Set(ids).size, ids.length, "a new step gets its own id");
  let crowded = guide;
  for (let i = 0; i < 80; i++) crowded = addStep(crowded, ready.id, `Step ${i}`, makeId);
  assert.equal(crowded.sections[3].steps.length, GUIDE_LIMITS.steps);
  // a step or part that is not there changes nothing
  assert.deepEqual(changeStep(guide, "nope", first.id, { done: true }), guide);
  assert.deepEqual(removeStep(guide, doc.id, "nope"), guide);
});

test("each student has their own guide, and changing one leaves the others alone", () => {
  const a = newGuide("Jordan Lee", "IEP meeting", makeId), b = newGuide("Maya Torres", "Re-evaluation", makeId);
  const start = normalizeWorkspace({ guides: [a, b] });
  const next = changeGuide(start, a.id, (g) => ({ ...changeStep(g, g.sections[0].id, g.sections[0].steps[0].id, { done: true }), room: "Room 12" }));
  assert.equal(next.guides[0].room, "Room 12");
  assert.deepEqual(guideProgress(next.guides[0]), { done: 1, total: 23 });
  assert.equal(next.guides[1], b, "the other student's guide is the same one");
  assert.equal(start.guides[0].room, "", "the workspace handed in is not changed");
  assert.equal(changeGuide(start, "gone", (g) => ({ ...g, room: "x" })), start);
});

test("who is on a student's team is picked from the teacher's own list", () => {
  assert.deepEqual(contactsFor("socialWorker", contacts).first.map((c) => c.name), ["Avery Stone", "Blake Rivers"], "people saved with the role come first");
  assert.deepEqual(contactsFor("socialWorker", contacts).rest.map((c) => c.name), ["Casey Moon", "Devon Hart"], "anyone else can still be picked, because one person can cover two roles");
  assert.deepEqual(contactsFor("nurse", [...contacts, { id: "c5", name: "  ", role: "nurse", email: "" }]).first, [], "a person with no name is not offered");
  assert.deepEqual(GUIDE_ROLES.map((r) => r.label), ["Gen ed teacher", "Meeting leader", "Speech (SLP)", "Social worker", "Psych", "Nurse / health", "OT", "Sped coordinator"]);
  assert.equal(roleLabel("slp"), "Speech (SLP)");
  assert.equal(roleLabel("something"), "Other");

  // two students, two different social workers
  const a: IepGuide = { ...newGuide("Jordan Lee", "IEP meeting", makeId), team: { socialWorker: "c1", slp: "c3" } };
  const b: IepGuide = { ...newGuide("Maya Torres", "IEP meeting", makeId), team: { socialWorker: "c2" } };
  assert.equal(teamMember(a, "socialWorker", contacts)?.name, "Avery Stone");
  assert.equal(teamMember(b, "socialWorker", contacts)?.name, "Blake Rivers");
  assert.equal(teamMember(b, "slp", contacts), undefined);
  assert.equal(teamMember({ team: undefined as any }, "slp", contacts), undefined);

  // a person who is renamed keeps their place; a person who is deleted leaves every team
  const renamed = contacts.map((c) => (c.id === "c1" ? { ...c, name: "Avery Stone-Park" } : c));
  assert.equal(teamMember(a, "socialWorker", renamed)?.name, "Avery Stone-Park");
  const start = normalizeWorkspace({ guides: [a, b], spedContacts: contacts });
  const next = removeContact(start, "c1");
  assert.deepEqual(next.spedContacts.map((c) => c.id), ["c2", "c3", "c4"]);
  assert.deepEqual(next.guides[0].team, { slp: "c3" });
  assert.equal(next.guides[1], b, "a guide they were not on is untouched");
  assert.equal(start.guides[0].team.socialWorker, "c1", "the workspace handed in is not changed");
});

test("links and email addresses are only used when they are safe to open", () => {
  assert.equal(cleanLink(" https://forms.example.org/room?id=1 "), "https://forms.example.org/room?id=1");
  assert.equal(cleanLink("docs.example.org/d/abc"), "https://docs.example.org/d/abc", "a link pasted without https:// still works");
  for (const bad of ["", "   ", "javascript:alert(1)", "data:text/html,hi", "file:///etc/passwd", "mailto:a@b.org", "not a link", "localhost", "https://", null, undefined]) assert.equal(cleanLink(bad), "", String(bad));
  assert.deepEqual(linksIn("Draft is at https://docs.example.org/d/abc. Old one (http://old.example.org/x), and javascript:alert(1)"), ["https://docs.example.org/d/abc", "http://old.example.org/x"]);
  assert.deepEqual(linksIn("no links here"), []);
  assert.deepEqual(linksIn("https://a.example.org https://a.example.org"), ["https://a.example.org/"], "the same link is offered once");
  assert.equal(cleanEmail(" avery.stone@example.org "), "avery.stone@example.org");
  for (const bad of ["", "avery", "avery@", "a b@example.org", "a@example.org?subject=x,b@example.org", "a@example.org,b@example.org", null]) assert.equal(cleanEmail(bad), "", String(bad));
});

test("the messages fill in from the guide, and say what is still missing", () => {
  const sender = { name: "Riley Brooks", school: "Maple Middle School" };
  const blank = newGuide("Jordan Lee", "IEP meeting", makeId);
  const text = parentText(blank, sender);
  assert.equal(text.split("\n")[0], "Hey [Parent's name]! This is Riley Brooks, Jordan Lee's Case Manager at Maple Middle School. I'm currently trying to find a date and time that works well for you for Jordan Lee's upcoming IEP meeting. Would any of these options work for you?");
  assert.deepEqual(text.split("\n").slice(1), ["Date - Time", "Date - Time", "Date - Time", "Please let me know which option works best for you, or if none of these times work!"]);
  assert.ok(parentText({ ...blank, parent1: "Ms. Lee" }, { name: "Riley Brooks", school: " " }).startsWith("Hey Ms. Lee! This is Riley Brooks, Jordan Lee's Case Manager. "), "no school yet: it is left out, not left hanging");
  assert.ok(parentText({ ...blank, student: "James", kind: "Re-evaluation" }, sender).includes("James' upcoming re-evaluation meeting"));

  const email = feedbackEmail(blank, sender, contacts);
  assert.ok(email.startsWith("Hi everyone,\nThis email thread is for Jordan Lee's upcoming IEP review meeting. Although [Gen ed teacher] will be the only one attending on this thread, everyone included on this thread is currently teaching Jordan Lee this year."));
  assert.ok(email.includes("Teacher Observation Template (Feel Free to Use)\nClass/Subject:\nAcademic strengths:\nAreas of growth or concern:\nParticipation and engagement:\nBehavior, peer interactions, and work habits:\nSupports or strategies that have been helpful:\nAdditional comments or recommendations:"));
  assert.ok(email.endsWith("IEP Review Meeting\nDate: \nTime: \nLocation: \nThank you,\nRiley Brooks"));

  const set: IepGuide = { ...blank, team: { genEd: "c4" }, meetingDate: "2026-11-03", meetingTime: "14:30", room: "Room 12" };
  const filled = feedbackEmail(set, sender, contacts);
  assert.ok(filled.includes("Although Devon Hart will be the only one attending"));
  assert.ok(filled.includes("Devon Hart, I will connect with you through Teams."));
  assert.ok(filled.endsWith("IEP Review Meeting\nDate: Tuesday, November 3\nTime: 2:30 PM\nLocation: Room 12\nThank you,\nRiley Brooks"));
  assert.equal(longDate("2026-11-03"), "Tuesday, November 3");
  assert.equal(longDate(""), "");
  assert.equal(longDate("soon"), "");
});

test("a Hub saved before the guide existed still opens, and a renamed student keeps their guide", () => {
  const old = normalizeWorkspace({ students: [{ id: "s1", name: "Jordan Lee" }], visibleTabs: { email: false } });
  assert.deepEqual([old.guides, old.spedContacts, old.guideLinks], [[], [], []]);
  assert.equal(old.visibleTabs.email, false);
  assert.ok(!(HUB_TABS as readonly string[]).includes("guide"), "the guide has no tab of its own: it is part of the meeting steps");
  assert.deepEqual(sectionsOf({ sections: undefined as any }), [], "a guide saved without its parts does not break the page");

  const hub: Workspace = { ...old, guides: [newGuide("Jordan Lee", "IEP meeting", makeId)] };
  const renamed = updateStudent(hub, "s1", { name: "Jordan Lee-Park", grade: "", accommodations: "", iepDate: "", reevalDate: "", readingLevel: "", mathLevel: "", notes: "" });
  assert.ok(renamed.ok);
  assert.equal(renamed.workspace.guides[0].student, "Jordan Lee-Park");
});

test("the guide is part of the meeting steps, on one screen", () => {
  const page = read("client/src/pages/TeacherHub.tsx"), guide = read("client/src/components/teacher-hub/HubGuide.tsx"), steps = read("client/src/components/teacher-hub/HubMeetingSteps.tsx");
  assert.ok(!page.includes('id: "guide"') && !page.includes("HubGuideTab"), "no separate IEP Guide tab");
  assert.ok(steps.includes("<GuideDetails ") && steps.includes("<GuideChecklist "), "step 1 holds the team and details, step 5 the checklist");
  for (const part of ['data-testid="hub-guide-step"', 'data-testid="hub-guide-team"', 'data-testid="hub-contact-form"', 'rel="noopener noreferrer"']) assert.ok(guide.includes(part), part);
  assert.ok(!/dangerouslySetInnerHTML/.test(guide), "notes and names are shown as text, never as HTML");
});
