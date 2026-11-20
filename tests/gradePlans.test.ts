import test from "node:test";
import assert from "node:assert/strict";
import { RETAKE_SLOT, byStudent, cleanGradePlans, cleanSettings, contactEmail, fillRetake, freeSlots, mailto, matchStudent, parentEmailsFor } from "../shared/gradePlans";
import { HUB_TABS, WORK_ADD_ON_TABS } from "../shared/teacherHub";
import { HUB_GROUPS } from "../shared/hubTabGroups";

test("names from the grades find the student on the caseload", () => {
  const roster = ["Ulysses Andrew Martinez", "Alonzo Fernando Martinez-Garcia", "Emani"];
  assert.equal(matchStudent("Martinez, Ulysses A.", roster), "Ulysses Andrew Martinez");
  assert.equal(matchStudent("ulysses martinez", roster), "Ulysses Andrew Martinez");
  assert.equal(matchStudent("Emani", roster), "Emani");
  assert.equal(matchStudent("Someone Else", roster), "");
});

test("open times skip weekends, busy times and the time before now", () => {
  const settings = { dayStart: "08:00", dayEnd: "11:00", minutes: 45 };
  const events = [{ date: "2026-11-20", start: "08:30", end: "09:30" }];
  const slots = freeSlots(events, "2026-11-20", settings, { days: 2, perDay: 5 }); // Friday, then Monday
  assert.ok(slots.every((s) => s.date !== "2026-11-21" && s.date !== "2026-11-22"));
  const fri = slots.filter((s) => s.date === "2026-11-20");
  assert.deepEqual(fri.map((s) => s.start), ["09:30", "10:15"]);
  assert.ok(fri.every((s) => !(s.start < "09:30" && s.end > "08:30")));
  assert.equal(slots.filter((s) => s.date === "2026-11-23")[0].start, "08:00");
  const later = freeSlots([], "2026-11-23", settings, { days: 1, nowTime: "09:10" });
  assert.equal(later[0].start, "09:30");
});

test("emails get the retake time once it is picked, and open ready to send", () => {
  const body = `Can she retake it at ${RETAKE_SLOT}?`;
  assert.match(fillRetake(body), /a time I'll confirm soon/);
  const retake = { date: "2026-11-24", start: "10:00", end: "10:45", where: "Room 12" };
  assert.equal(fillRetake(body, retake), "Can she retake it at Tuesday, November 24, 10:00 AM – 10:45 AM in Room 12?");
  assert.match(mailto({ to: "a@b.org", name: "", subject: "Retake", body }, retake), /^mailto:a@b\.org\?subject=Retake&body=Can%20she/);
});

test("parents and class teachers are found in the hub, plans and settings are cleaned", () => {
  const guides = [{ student: "Emani", parent1: "Rosa", parent1Email: "rosa@x.org", parent2: "", parent2Email: "" }] as any;
  assert.deepEqual(parentEmailsFor("Emani", guides), { names: "Rosa", emails: ["rosa@x.org"] });
  assert.equal(contactEmail("Ms. Rivera", [{ id: "1", name: "Ana Rivera", role: "Gen ed", email: "ana@x.org" }]), "ana@x.org");
  assert.equal(byStudent([{ id: "1", student: "B", assignment: "x", subject: "", teacher: "", score: "", kind: "missing", due: "" }, { id: "2", student: "A", assignment: "y", subject: "", teacher: "", score: "", kind: "failed", due: "" }])[0].student, "A");
  const [p] = cleanGradePlans([{ id: "p1", student: "Emani", concerns: [{ student: "Emani", assignment: "Unit 3 test", kind: "failed", score: "45%" }], retake: { date: "2026-11-24", start: "10:00", end: "10:45" }, status: "scheduled", todos: [{ text: "Get the test" }] }]);
  assert.equal(p.concerns[0].assignment, "Unit 3 test");
  assert.equal(p.status, "scheduled");
  assert.equal(cleanGradePlans([{ id: "x" }]).length, 0);
  assert.equal(cleanSettings({ minutes: 7, dayStart: "25:00" }).minutes, 45);
});

test("Grade Plans is a WorkHub plugin screen with its own menu item", () => {
  assert.ok(HUB_TABS.includes("gradeplans"));
  assert.ok(WORK_ADD_ON_TABS.includes("gradeplans"));
  assert.ok(HUB_GROUPS.some((g) => g.tabs.includes("gradeplans")));
});
