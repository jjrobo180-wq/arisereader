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

test("every email lists the assignments, whether or not the AI wrote them in", async () => {
  const { fillEmail, concernsFor, ASSIGNMENTS_SLOT } = await import("../shared/gradePlans");
  const concerns = [
    { id: "1", student: "Duran", assignment: "Argument Essay", subject: "English 7", teacher: "Marissa Kast", score: "", kind: "missing" as const, due: "" },
    { id: "2", student: "Duran", assignment: "Unit 2 Test", subject: "English 7", teacher: "Marissa Kast", score: "48%", kind: "failed" as const, due: "" },
    { id: "3", student: "Duran", assignment: "Lab 4", subject: "Science", teacher: "Mr. Ortiz", score: "", kind: "missing" as const, due: "" },
  ];
  // The AI left the list out, as in the email that went wrong.
  const body = "Dear Ms. Kast,\nI am reaching out regarding Duran's missing and failed English 7 assignments listed below. Could Duran retake them?\nSincerely,\nJermaine";
  const mine = concernsFor("Marissa Kast", concerns);
  assert.deepEqual(mine.map((c) => c.assignment), ["Argument Essay", "Unit 2 Test"]);
  const out = fillEmail(body, mine);
  assert.match(out, /listed below\. Could Duran retake them\?\n\n- Argument Essay \(English 7\): missing\n- Unit 2 Test \(English 7\): 48%, failed\n\nSincerely/);
  assert.doesNotMatch(out, /Lab 4/);
  // With the slot, the list goes exactly there; an email that already names them all is left alone.
  assert.match(fillEmail(`Hi,\nThese are missing:\n${ASSIGNMENTS_SLOT}\nThanks`, concerns), /missing:\n- Argument Essay[\s\S]*- Lab 4 \(Science\): missing\nThanks/);
  const named = "Argument Essay and Unit 2 Test need redoing.";
  assert.equal(fillEmail(named, mine), named);
});

test("the AI never guesses a student's gender: it uses their pronouns, or their name", async () => {
  const { pronounRule } = await import("../shared/pronouns");
  assert.match(pronounRule("he", "Emani"), /he\/him\/his/);
  assert.match(pronounRule("", "Emani"), /NOT GIVEN\. Never use he, him, his, she, her or hers for Emani/);
  const { liveCoachPrompt } = await import("../shared/hubCoach");
  assert.match(liveCoachPrompt({ student: { name: "Emani Kast", pronouns: "he" }, topic: "fractions" }), /Pronouns for Emani: he\/him\/his/);
  assert.match(liveCoachPrompt({ student: { name: "Emani Kast" }, topic: "fractions" }), /never guess from the name/);
});

test("the weekly parent update lists what is missing and failed, from the Gradebook and Grade Plans", async () => {
  const { gatherWeek, writeUpdate, DEFAULT_PARTS } = await import("../shared/parentUpdate");
  const src = {
    assignments: [{ id: "a1", title: "Fractions quiz", category: "Math", points: 20, date: "2026-11-18" }, { id: "a2", title: "Exit ticket", category: "Math", points: 10, date: "2026-11-18" }, { id: "a3", title: "Old quiz", category: "Math", points: 10, date: "2026-10-01" }],
    gradeScores: [
      { id: "g1", assignmentId: "a1", student: "Emani Kast", score: 9, missing: false, excused: false },
      { id: "g2", assignmentId: "a2", student: "Emani Kast", score: null, missing: true, excused: false },
      { id: "g3", assignmentId: "a3", student: "Emani Kast", score: null, missing: true, excused: false },
    ],
    gradePlans: [{ id: "p1", student: "Emani Kast", createdAt: "2026-11-19T10:00:00Z", status: "scheduled", concerns: [{ student: "Emani Kast", assignment: "Argument Essay", subject: "English 7", kind: "missing" }], retake: { date: "2026-11-24", start: "10:00", end: "10:45", where: "" } }],
  };
  const f = gatherWeek("Emani Kast", "2026-11-16", "2026-11-20", src as any);
  assert.deepEqual(f.grades.missing.map((g) => g.title), ["Exit ticket", "Argument Essay"]);
  assert.deepEqual(f.grades.failed, [{ title: "Fractions quiz", subject: "Math", score: "45%" }]);
  const { body } = writeUpdate(f, { format: "email", parts: DEFAULT_PARTS, teacher: "Mr. Robinson" });
  assert.match(body, /Grades to know about:\n• Missing: Exit ticket \(Math\); Argument Essay \(English 7\)\n• Below passing: Fractions quiz \(Math\): 45%\n• Emani will make it up with me on Tuesday, November 24, 10:00 AM – 10:45 AM\./);
  assert.doesNotMatch(writeUpdate(f, { format: "email", parts: { ...DEFAULT_PARTS, grades: false }, teacher: "Mr. R" }).body, /Grades to know about/);
});
