import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accommodationList, accommodationText, cleanIepNotes, iepComingUp, iepReminders, newIepNote, newQuizShare, noteText, parseQuizCode, pmSheetHtml, pmStatus, publicQuiz, quizLink, scoreQuiz, NOTE_SECTIONS } from "../shared/hubIep";
import { dueHubReminders } from "../shared/hubReminders";
import { normalizeWorkspace, type Goal } from "../shared/teacherHub";

const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const goal = (over: Partial<Goal> = {}): Goal => ({ id: "g1", student: "Ava Lee", area: "Reading", text: "Read 60 wpm", baseline: 30, target: 60, unit: "wpm", direction: "up", startDate: "2026-10-01", targetDate: "2027-05-01", points: [], ...over });

test("progress checks: every 14 days from the last score, due soon within 3 days, overdue after", () => {
  assert.deepEqual([pmStatus(goal(), "2026-10-10").state, pmStatus(goal(), "2026-10-10").next], ["on schedule", "2026-10-15"]);
  assert.equal(pmStatus(goal(), "2026-10-13").state, "due soon");
  assert.equal(pmStatus(goal(), "2026-10-16").state, "overdue");
  assert.equal(pmStatus(goal({ points: [{ id: "p", date: "2026-10-14", value: 40, note: "" }] }), "2026-10-16").next, "2026-10-28");
  assert.equal(pmStatus(goal({ checkEvery: 7 }), "2026-10-05").next, "2026-10-08");
  assert.equal(pmStatus(goal({ points: [{ id: "p", date: "2026-10-14", value: 61, note: "" }] }), "2026-12-01").state, "met");
});

test("reminders: 3 days before, the day before, on the day and the day after a check; IEP dates 30/14/7/1 days out", () => {
  const w = { students: [{ id: "s", name: "Ava Lee", grade: "4", accommodations: "", iepDate: "2026-11-15", reevalDate: "", readingLevel: "", mathLevel: "", notes: "" }], goals: [goal()] };
  assert.equal(iepReminders(w, "2026-10-12").filter((r) => r.key.startsWith("pm:")).length, 1);
  assert.equal(iepReminders(w, "2026-10-11").filter((r) => r.key.startsWith("pm:")).length, 0);
  assert.equal(iepReminders(w, "2026-10-16").filter((r) => r.key.startsWith("pm:")).length, 1);
  assert.equal(iepReminders(w, "2026-11-08").filter((r) => r.key.startsWith("iepdate:")).length, 1);
  // They go out with the morning summary, once.
  const ws = normalizeWorkspace({ ...w, goals: [goal()] });
  const at = Date.parse("2026-10-12T14:00:00Z");
  const sent = dueHubReminders(ws, at, "America/Denver");
  const pm = sent.find((r) => r.key.startsWith("pm:"));
  assert.ok(pm);
  assert.ok(!dueHubReminders(ws, at, "America/Denver", { [pm!.key]: 1 }).some((r) => r.key === pm!.key));
});

test("coming up lists IEP dates, checks and meetings, soonest first", () => {
  const list = iepComingUp({ students: [{ id: "s", name: "Ava Lee", grade: "", accommodations: "", iepDate: "2026-11-20", reevalDate: "2026-12-01", readingLevel: "", mathLevel: "", notes: "" }], goals: [goal()], meetings: [] as any }, "2026-10-16");
  assert.deepEqual(list.map((d) => d.kind), ["check", "iep"]);
});

test("meeting notes start with the right headings and read back as text", () => {
  const n = newIepNote("n1", "Ava Lee", "Reevaluation", "2026-11-05");
  assert.deepEqual(Object.keys(n.sections), NOTE_SECTIONS.Reevaluation);
  n.sections["Results"] = "Average range";
  assert.match(noteText(n), /Reevaluation · Ava Lee · 2026-11-05\n\nResults\nAverage range/);
  assert.equal(cleanIepNotes([{ id: "x", kind: "Nope", sections: { a: 1 } }])[0].kind, "Other");
});

test("accommodations are kept one per line, without repeats", () => {
  assert.deepEqual(accommodationList("Extended time; read aloud\n- Extended time\n• Breaks"), ["Extended time", "read aloud", "Breaks"]);
  assert.equal(accommodationText(["A", "a", "B"]), "A\nB");
});

test("a data sheet prints the goal and blank rows", () => {
  const html = pmSheetHtml(goal(), { name: "Ava Lee", grade: "4" });
  assert.ok(html.includes("Read 60 wpm") && html.includes("Check every:</b> 14 days") && html.includes("window.print()"));
});

test("quiz links: a code, no answers shown, scored on the server, kept through a save", () => {
  const share = newQuizShare((n) => new Uint8Array(n).map((_, i) => i * 7));
  assert.equal(share.length, 24);
  assert.deepEqual(parseQuizCode(`42-${share}`), { teacherId: 42, share });
  assert.equal(parseQuizCode("42-short"), null);
  assert.equal(quizLink("capacitor://localhost", 42, share), `https://arisetodo.com/#/goal-quiz/42-${share}`);
  const q = { id: "q", title: "Check", student: "Ava Lee", share, questions: [{ prompt: "1+1", options: ["1", "2", "3", "4"], correct: 1 }, { prompt: "2+2", options: ["3", "4", "5", "6"], correct: 1 }] };
  assert.deepEqual(publicQuiz(q), { title: "Check", student: "Ava", questions: [{ prompt: "1+1", options: ["1", "2", "3", "4"] }, { prompt: "2+2", options: ["3", "4", "5", "6"] }] });
  assert.ok(!JSON.stringify(publicQuiz(q)).includes("correct"));
  assert.deepEqual(scoreQuiz(q, [1, 0]), { score: 1, total: 2 });
  assert.equal(scoreQuiz(q, [1]), null);
  const ws = normalizeWorkspace({ goalQuizzes: [{ ...q, goalIds: [], createdAt: "" }] });
  assert.equal((ws as any).goalQuizzes[0].share, share);
});

test("the IEP page puts every part in one place, with the student picked at the top", () => {
  const page = read("client/src/components/teacher-hub/HubIep.tsx"), hub = read("client/src/pages/TeacherHub.tsx"), server = read("server/teacherHub.ts"), app = read("client/src/App.tsx");
  for (const t of ['["overview", "Overview"]', '["meetings", "Meetings"]', '["notes", "Notes"]', '["profile", "Profile"]', '["accommodations", "Accommodations"]', '["progress", "Progress"]', '["minutes", "Minutes"]', 'data-testid="iep-student"', 'data-testid="iep-pm-upload"', 'data-testid="iep-pm-sheet"', 'data-testid="iep-pm-worksheet"', 'data-testid="iep-pm-quiz"', "<StudentQuizzes", "<MakeGoalQuiz"]) assert.ok(page.includes(t), t);
  assert.ok(hub.includes('{tab === "iep" && <IepPage'));
  assert.ok(server.includes('app.get("/api/goal-quiz/:code"') && server.includes('app.post("/api/goal-quiz/:code"') && server.includes("scoreQuiz(quiz, req.body?.answers)"));
  assert.ok(app.includes('<Route path="/goal-quiz/:code"><GoalQuizPage /></Route>'));
});
