import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  cleanHelpLogs, cleanLessonPrep, cleanLiveAsk, cleanLiveCoach, lessonText, liveCoachPrompt, liveCoachSpeech, progressNote, whatWorks, whatWorksSentence, type HelpLog,
} from "../shared/hubCoach";
import { registerTeacherHubImportRoutes, type AiRequest } from "../server/teacherHubImport";
import { PLUGINS } from "../shared/pluginStore";

const log = (strategy: HelpLog["strategy"], worked: boolean, date = "2026-11-10", student = "Emani Ruiz", situation: HelpLog["situation"] = "wont-start"): HelpLog => ({ id: `${strategy}${date}${Math.random()}`, student, date, topic: "area", strategy, worked, situation });

test("the help tracker learns what works: tried twice outranks lucky once, and it reads as a sentence", () => {
  const logs = [log("choice", true), log("choice", true), log("choice", false), log("timer", true), log("model", false), log("model", false), log("choice", true, "2026-11-12", "Kieth Ames")];
  const ranked = whatWorks(logs, "emani ruiz");
  assert.deepEqual(ranked.map((w) => [w.strategy, w.worked, w.tries]), [["choice", 2, 3], ["model", 0, 2], ["timer", 1, 1]]);
  assert.equal(whatWorksSentence(logs, "Emani Ruiz"), "Emani usually gets going with: gave a choice (2 of 3 times), a short timer (1 of 1 time). Less helpful so far: showed a worked example (0 of 2 times).");
  assert.equal(whatWorksSentence([], "Emani Ruiz"), "");
});

test("an IEP progress note from the tracker, for a date range", () => {
  const logs = [log("choice", true, "2026-11-03"), log("choice", true, "2026-11-04"), log("model", false, "2026-11-05", "Emani Ruiz", "stuck"), log("choice", true, "2026-12-01")];
  const note = progressNote(logs, "Emani Ruiz", "2026-11-01", "2026-11-30");
  assert.ok(note.startsWith("From November 1, 2026 to November 30, 2026, Emani began or continued assigned work with teacher support in 2 of 3 recorded instances (67%)."), note);
  assert.ok(note.includes("When reluctant to start, Emani initiated the task after support 2 of 2 times."));
  assert.ok(note.includes("gave a choice (2/2)"));
  assert.equal(progressNote(logs, "Emani Ruiz", "2025-01-01", "2025-02-01"), "");
});

test("saved logs are cleaned: unknown strategies, bad dates and missing names are dropped", () => {
  const clean = cleanHelpLogs([log("choice", true), { ...log("choice", true), strategy: "magic" }, { ...log("timer", true), date: "today" }, { ...log("hint", false), student: " " }, "junk"]);
  assert.equal(clean.length, 1);
});

test("Live Coach: what the AI is told, and its answer kept short and safe", () => {
  const ask = cleanLiveAsk({ topic: "finding area", situation: "wont-start", student: { name: "Emani Ruiz", grade: "6", notes: "Loves basketball and Minecraft", whatWorks: "Emani usually gets going with: gave a choice." } })!;
  const prompt = liveCoachPrompt(ask);
  for (const t of ["Loves basketball and Minecraft", "What has worked before (lean on this)", "Won't start", "10 words or fewer", '"kind": "interest"', "never 'does that make sense?'"]) assert.ok(prompt.includes(t), t);
  assert.equal(cleanLiveAsk({ topic: "", student: { name: "A" } }), null);
  const coach = cleanLiveCoach({
    direction: "Count the squares inside the shape and write the number down now please okay",
    firstStep: "Put your finger on the top-left square.",
    ways: [{ kind: "hands-on", title: "Tiles", do: "Give 12 square tiles", say: "Cover it." }, { kind: "picture", title: "Grid", do: "Draw a 3 by 4 grid", say: "" }, { kind: "interest", title: "Minecraft", do: "Blocks in a floor", say: "How many blocks?" }, { kind: "hands-on", title: "dup", do: "x", say: "y" }],
    showMe: "Show me where you start counting.", ladder: ["Wait 5 seconds", "Point to the first row", "", "Count the first row together"], praise: "You started on your own.",
  })!;
  assert.equal(coach.direction, "Count the squares inside the shape and write the number.", "cut to 10 words");
  assert.equal(coach.ways.length, 3, "one of each kind");
  assert.deepEqual(coach.ladder, ["Wait 5 seconds", "Point to the first row", "Count the first row together"]);
  assert.ok(liveCoachSpeech(coach).startsWith("Say: Count the squares"));
  assert.equal(cleanLiveCoach({ nothing: true }), null);
});

test("Lesson prep: the lesson goes as text, and the answer is cleaned", () => {
  assert.equal(lessonText({ title: "Area", objective: "Find area of rectangles", iDo: "Model with tiles", junk: "x" }), "Title: Area\nObjective: Find area of rectangles\nI do: Model with tiles");
  const prep = cleanLessonPrep({ bigIdea: "Area is how many squares cover a shape.", vocab: [{ word: "area", kidWords: "squares inside" }], problems: [{ problem: "3 by 4", mistake: "Adds instead", catchIt: "Watch for 7", worked: ["Count rows", "Multiply"], partial: { problem: "2 by 5", done: ["2 rows"], left: "Multiply" }, firstStep: "Count one row", showMe: "Show me a row" }, { problem: "" }] })!;
  assert.equal(prep.problems.length, 1);
  assert.equal(prep.problems[0].partial.left, "Multiply");
  assert.equal(cleanLessonPrep({ problems: [] }), null);
});

function server(reply: string) {
  const routes: Record<string, Function> = {};
  const app: any = { post: (path: string, _a: unknown, h: Function) => { routes[path] = h; }, get: () => {} };
  const asked: AiRequest[] = [];
  registerTeacherHubImportRoutes(app, (() => {}) as any, { gate: async () => ({ access: true }), aiConfigured: () => true, askAI: async (r) => { asked.push(r); return reply; } } as any);
  const call = async (path: string, body: any) => {
    const out: any = { status: 200, body: null };
    const res: any = { set: () => res, status: (c: number) => { out.status = c; return res; }, json: (d: any) => { out.body = d; return res; } };
    await routes[path]({ body, user: { id: 1 } }, res);
    return out;
  };
  return { call, asked };
}

test("the coach routes: a live answer, lesson prep, and plain errors", async () => {
  const live = server(JSON.stringify({ direction: "Count the squares.", firstStep: "Touch one square.", ways: [{ kind: "picture", title: "Grid", do: "Draw it", say: "Count" }], ladder: ["Wait"], showMe: "Show me", watchFor: "Adding", praise: "Nice start" }));
  const r = await live.call("/api/teacher-hub/coach/live", { topic: "area", situation: "stuck", student: { name: "Emani Ruiz" } });
  assert.equal(r.status, 200);
  assert.equal(r.body.coach.direction, "Count the squares.");
  assert.ok(live.asked[0].system.includes("Started, now stuck"));
  assert.equal((await live.call("/api/teacher-hub/coach/live", { topic: "", student: { name: "A" } })).status, 400);
  const prep = server(JSON.stringify({ problems: [{ problem: "3 by 4", firstStep: "Count a row" }] }));
  const p = await prep.call("/api/teacher-hub/coach/lesson", { lesson: { title: "Area", objective: "Find area" } });
  assert.equal(p.body.prep.problems[0].firstStep, "Count a row");
  assert.equal((await prep.call("/api/teacher-hub/coach/lesson", { lesson: {} })).status, 400);
  const bad = server("not json");
  assert.equal((await bad.call("/api/teacher-hub/coach/live", { topic: "area", student: { name: "A" } })).status, 502);
});

test("Coach is a WorkHub plugin, on the menu, with What works on each student's profile", () => {
  assert.ok(PLUGINS.some((p) => p.id === "work-coach" && p.target.kind === "tab" && p.target.tab === "coach"));
  const hub = readFileSync(new URL("../client/src/pages/TeacherHub.tsx", import.meta.url), "utf8");
  assert.match(hub, /\{tab === "coach" && <HubTeachCoach /);
  const profile = readFileSync(new URL("../client/src/components/teacher-hub/HubStudentProfile.tsx", import.meta.url), "utf8");
  assert.ok(profile.includes('data-testid="profile-what-works"'));
  const page = readFileSync(new URL("../client/src/components/teacher-hub/HubCoach.tsx", import.meta.url), "utf8");
  for (const t of ['data-testid="coach-whisper"', "speechSynthesis", 'data-testid="coach-tracker"', 'data-testid="coach-progress-note"', 'data-testid="coach-prep-result"']) assert.ok(page.includes(t), t);
});
