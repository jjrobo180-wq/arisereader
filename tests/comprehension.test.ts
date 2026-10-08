// Reading comprehension: the rules for the three answers, saving them with a proctored quiz,
// and teachers grading them for up to 10 extra points.
// Run: npx tsx --test tests/comprehension.test.ts
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  COMPREHENSION, COMPREHENSION_PROMPTS, COVER_NOTE, allowsComprehension, awardReason, cleanComprehension, cleanNote, cleanPoints,
  comprehensionState, earnedOn, gradedMessage, proctorLabel, shortAnswers,
} from "../shared/comprehension";
import { registerComprehensionRoutes } from "../server/comprehension";
import { fakeSupabase } from "./helpers/fakeSupabase";

const full = { retell: "First Stanley went to camp. Then he dug holes.", problem: "The problem was the curse. It ended when he carried Zero.", lesson: "I learned that friends help you keep going." };

test("three questions, and the student either skips them or answers all three", () => {
  assert.deepEqual(COMPREHENSION_PROMPTS.map((p) => p.id), ["retell", "problem", "lesson"]);
  assert.equal(COMPREHENSION.bonusPoints, 10);
  assert.equal(comprehensionState(undefined), "empty");
  assert.equal(comprehensionState({ retell: "  ", problem: "", lesson: "" }), "empty");
  assert.equal(comprehensionState({ ...full, lesson: "" }), "incomplete");
  assert.equal(comprehensionState({ ...full, lesson: "good" }), "incomplete", "a word or two is not enough");
  assert.deepEqual(shortAnswers({ ...full, lesson: "good" }), ["lesson"]);
  assert.equal(comprehensionState(full), "ready");
  assert.equal(cleanComprehension({ ...full, lesson: "" }), null);
  const cleaned = cleanComprehension({ ...full, retell: `  ${full.retell}\r\n\r\n\r\n\r\nMore.  `, extra: "ignored" });
  assert.deepEqual(Object.keys(cleaned!), ["retell", "problem", "lesson"]);
  assert.equal(cleaned!.retell, `${full.retell}\n\nMore.`);
  assert.equal(cleanComprehension({ ...full, problem: "x".repeat(5000) })!.problem.length, COMPREHENSION.maxChars);
});

test("a proctor code or the camera allows it; previews and sample accounts don't", () => {
  assert.equal(allowsComprehension("parent"), true);
  assert.equal(allowsComprehension("teacher"), true);
  assert.equal(allowsComprehension("camera"), true);
  assert.equal(allowsComprehension(null), false);
  assert.equal(allowsComprehension("paper"), false);
  assert.equal(proctorLabel("camera", "No proctor (camera)"), "On their own (camera on)");
  assert.equal(proctorLabel("parent", "Mom"), "Parent: Mom");
  assert.equal(proctorLabel("teacher", ""), "Teacher / staff: Teacher");
  assert.equal(COVER_NOTE, "10 extra credit points for doing the writing comprehension at the end");
});

test("points are a whole number from 0 to 10", () => {
  assert.equal(cleanPoints(10), 10);
  assert.equal(cleanPoints(0), 0);
  assert.equal(cleanPoints("7"), 7);
  for (const bad of [11, -1, 2.5, "", "ten", null, undefined]) assert.equal(cleanPoints(bad), null, String(bad));
  assert.equal(cleanNote("x".repeat(900)).length, COMPREHENSION.noteMax);
  assert.equal(awardReason("Holes"), "Reading comprehension: Holes");
  assert.ok(awardReason("x".repeat(400)).length <= 200);
  assert.match(gradedMessage("Holes", 8, "Great details!"), /8 extra points \(out of 10\).*Great details!/);
  assert.match(gradedMessage("Holes", 1, ""), /1 extra point \(/);
  assert.match(gradedMessage("Holes", 0, ""), /No extra points/);
  assert.equal(earnedOn("2026-10-03T22:00:00.000Z"), "2026-10-03");
});

// ─── Routes ─────────────────────────────────────────────────────────────────
type Handler = (req: any, res: any) => Promise<void> | void;
const routes = new Map<string, Handler>();
const app: any = {
  get: (path: string, ...hs: any[]) => routes.set("GET " + path, hs[hs.length - 1]),
  post: (path: string, ...hs: any[]) => routes.set("POST " + path, hs[hs.length - 1]),
};
// Teacher 10 has students 1 and 2. Student 3 has no teacher, so the admin grades them.
const users: Record<number, any> = {
  1: { id: 1, role: "student", username: "ana", displayName: "Ana", teacherId: 10, approvedByTeacher: true },
  2: { id: 2, role: "student", username: "ben", displayName: "Ben", teacherId: 10, approvedByTeacher: true },
  3: { id: 3, role: "student", username: "cy", displayName: "Cy", teacherId: null },
  10: { id: 10, role: "teacher", username: "msg", displayName: "Ms. G" },
  11: { id: 11, role: "teacher", username: "mrk", displayName: "Mr. K" },
  20: { id: 20, role: "parent", username: "mom", displayName: "Mom" },
  99: { id: 99, role: "admin", isAdmin: true, username: "boss", displayName: "Admin" },
};
let db = fakeSupabase();
const messages: [number, string][] = [];
let cacheClears = 0;
const comprehension = registerComprehensionRoutes(app, (() => {}) as any, {
  // The routes keep the client they are given, so hand them one that reads this test's tables.
  db: () => ({ from: (table: string) => db.from(table) }),
  getTeacherStudentIds: async (id) => (id === 10 ? [1, 2] : []),
  clearPointCaches: () => { cacheClears++; },
  messageStudent: async (id, text) => { messages.push([id, text]); },
  adminIds: async () => [99],
});

async function call(method: "GET" | "POST", path: string, userId: number, body: any = {}, query: any = {}) {
  const [pathOnly] = path.split("?");
  const entry = [...routes.entries()].find(([key]) => {
    const [m, p] = key.split(" ");
    return m === method && new RegExp("^" + p.replace(/:[a-z]+/g, "([^/]+)") + "$").test(pathOnly);
  });
  if (!entry) throw new Error("no route " + method + " " + path);
  const p = entry[0].split(" ")[1];
  const names = (p.match(/:[a-z]+/g) || []).map((x) => x.slice(1));
  const values = pathOnly.match(new RegExp("^" + p.replace(/:[a-z]+/g, "([^/]+)") + "$"))!.slice(1);
  let status = 200, json: any;
  const res = { status(c: number) { status = c; return res; }, json(b: any) { json = b; return res; }, set() { return res; } };
  await entry[1]({ user: users[userId], body, query, params: Object.fromEntries(names.map((n, i) => [n, values[i]])) }, res);
  return { status, data: json };
}

const send = (studentId: number, bookId: number, proctor: any, raw: any = full) =>
  comprehension.saveFromQuiz({ student: users[studentId], bookId, bookTitle: bookId === 5 ? "Holes" : "Wonder", attemptId: 700 + bookId, proctor, raw });

beforeEach(() => {
  db = fakeSupabase({
    users: Object.values(users).map((u) => ({ id: u.id, display_name: u.displayName, username: u.username, total_points: 100 })),
    books: [{ id: 5, title: "Holes", cover_url: null }, { id: 6, title: "Wonder", cover_url: null }],
    attempts: [{ id: 705, score: 8, total: 10 }, { id: 706, score: 9, total: 10 }],
  }, { autoIds: ["comprehension_responses", "manual_point_awards", "notifications"], keys: { comprehension_responses: ["student_id", "book_id"] } });
  messages.length = 0;
  cacheClears = 0;
});

test("saved with a parent or teacher proctor, and the student's teacher is told", async () => {
  assert.equal(await send(1, 5, { type: "parent", name: "Mom" }), "sent");
  const rows = db.tables.comprehension_responses;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "pending");
  assert.equal(rows[0].proctor_type, "parent");
  assert.equal(rows[0].attempt_id, 705);
  assert.deepEqual(Object.keys(rows[0].answers), ["retell", "problem", "lesson"]);
  const notes = db.tables.notifications;
  assert.equal(notes.length, 1);
  assert.equal(notes[0].user_id, 10);
  assert.match(notes[0].message, /Ana wrote comprehension answers for “Holes”/);
  // No teacher: the admin is told.
  assert.equal(await send(3, 5, { type: "teacher", name: "Coach" }), "sent");
  assert.equal(db.tables.notifications[1].user_id, 99);
});

test("saved from a camera quiz too; never from a preview, half-done answers, or answers already graded", async () => {
  assert.equal(await send(2, 6, { type: "camera", name: "No proctor (camera)" }), "sent");
  assert.equal(db.tables.comprehension_responses[0].proctor_type, "camera");
  db.tables.comprehension_responses.length = 0;
  assert.equal(await send(1, 5, null), "not allowed");
  assert.equal(await send(1, 5, { type: "parent" }, { ...full, lesson: "" }), "incomplete");
  assert.equal(await send(1, 5, { type: "parent" }, null), null, "skipping it is fine");
  assert.equal(await send(1, 5, { type: "parent" }, { retell: "", problem: "", lesson: "" }), null);
  assert.equal((db.tables.comprehension_responses || []).length, 0);
  await send(1, 5, { type: "parent" });
  db.tables.comprehension_responses[0].status = "graded";
  assert.equal(await send(1, 5, { type: "parent" }), "already graded");
  assert.equal(db.tables.comprehension_responses.length, 1);
});

test("teachers see only their students; parents and students can't grade", async () => {
  await send(1, 5, { type: "parent", name: "Mom" });
  await send(3, 6, { type: "teacher", name: "Coach" });
  const mine = await call("GET", "/api/comprehension/review", 10);
  assert.equal(mine.status, 200);
  assert.equal(mine.data.pending, 1);
  assert.deepEqual(mine.data.items.map((i: any) => i.studentName), ["Ana"]);
  const it = mine.data.items[0];
  assert.equal(it.bookTitle, "Holes");
  assert.deepEqual(it.quiz, { score: 8, total: 10 });
  assert.equal(it.proctor, "Parent: Mom");
  assert.equal(it.answers.length, 3);
  assert.equal(it.answers[0].answer, full.retell);
  assert.equal((await call("GET", "/api/comprehension/review", 11)).data.items.length, 0, "another teacher sees none");
  assert.equal((await call("GET", "/api/comprehension/review", 99)).data.pending, 2, "the admin sees everyone");
  assert.equal((await call("GET", "/api/comprehension/review", 20)).status, 403);
  assert.equal((await call("GET", "/api/comprehension/review", 1)).status, 403);
  const cy = db.tables.comprehension_responses.find((r: any) => r.student_id === 3)!.id;
  assert.equal((await call("POST", `/api/comprehension/review/${cy}/grade`, 10, { points: 10 })).status, 404, "not their student");
  assert.equal((await call("POST", `/api/comprehension/review/${cy}/grade`, 20, { points: 10 })).status, 403);
});

test("grading gives the points, tells the student, and a new grade replaces the old points", async () => {
  await send(1, 5, { type: "parent", name: "Mom" });
  const id = db.tables.comprehension_responses[0].id;
  assert.equal((await call("POST", `/api/comprehension/review/${id}/grade`, 10, { points: 11 })).status, 400);
  assert.equal((await call("POST", `/api/comprehension/review/${id}/grade`, 10, { points: 2.5 })).status, 400);

  const first = await call("POST", `/api/comprehension/review/${id}/grade`, 10, { points: 8, note: "Great details!" });
  assert.equal(first.status, 200, JSON.stringify(first.data));
  const awards = db.tables.manual_point_awards;
  assert.equal(awards.length, 1);
  assert.deepEqual({ student: awards[0].student_id, by: awards[0].awarded_by, points: awards[0].points, reason: awards[0].reason }, { student: 1, by: 10, points: 8, reason: "Reading comprehension: Holes" });
  assert.match(awards[0].earned_on, /^\d{4}-\d{2}-\d{2}$/);
  const row = db.tables.comprehension_responses[0];
  assert.equal(row.status, "graded");
  assert.equal(row.points, 8);
  assert.equal(row.award_id, awards[0].id);
  assert.equal(messages.length, 1);
  assert.match(messages[0][1], /8 extra points.*Great details!/);
  assert.equal(cacheClears, 1);
  assert.equal((await call("GET", "/api/comprehension/review", 10)).data.pending, 0);
  const graded = await call("GET", "/api/comprehension/review", 10, {}, { status: "graded" });
  assert.equal(graded.data.items[0].points, 8);
  assert.equal(graded.data.items[0].gradedBy, "Ms. G");

  // Same points, only the note changes: no new award, the student hears the note.
  await call("POST", `/api/comprehension/review/${id}/grade`, 10, { points: 8, note: "Great details! Add the ending next time." });
  assert.equal(db.tables.manual_point_awards.length, 1);
  assert.equal(messages.length, 2);
  assert.equal(cacheClears, 1);

  // Saving again with nothing changed sends nothing.
  await call("POST", `/api/comprehension/review/${id}/grade`, 10, { points: 8, note: "Great details! Add the ending next time." });
  assert.equal(messages.length, 2);

  // A new grade: the 8 points come back off and 5 go on.
  await call("POST", `/api/comprehension/review/${id}/grade`, 10, { points: 5, note: "" });
  assert.equal(db.tables.manual_point_awards.length, 1);
  assert.equal(db.tables.manual_point_awards[0].points, 5);
  assert.equal(db.tables.users.find((u: any) => u.id === 1)!.total_points, 92, "the old 8 points were taken off the stored total");
  assert.equal(db.tables.comprehension_responses[0].award_id, db.tables.manual_point_awards[0].id);

  // Zero: no points at all.
  await call("POST", `/api/comprehension/review/${id}/grade`, 10, { points: 0 });
  assert.equal(db.tables.manual_point_awards.length, 0);
  assert.equal(db.tables.comprehension_responses[0].award_id, null);
  assert.match(messages.at(-1)![1], /No extra points/);
});

test("the admin grades a student who has no teacher", async () => {
  await send(3, 6, { type: "teacher", name: "Coach" });
  const id = db.tables.comprehension_responses[0].id;
  const r = await call("POST", `/api/comprehension/review/${id}/grade`, 99, { points: 10 });
  assert.equal(r.status, 200);
  assert.equal(db.tables.manual_point_awards[0].points, 10);
  assert.equal(db.tables.manual_point_awards[0].awarded_by, 99);
});
