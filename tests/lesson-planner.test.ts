// The Lesson Planner: saved lessons and classes are cleaned safely (older lessons still open),
// dates for planning ahead, the reteach tracker, bumping lessons for a snow day, and the AI route.
// Run with: npx tsx --test tests/lesson-planner.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  bumpLessons, cleanClasses, cleanLesson, cleanLessons, cleanWorksheet, copyLesson, meetsOn, mondayOf, monthWeeks, needsReteach,
  nextMeetings, planFullness, schoolWeek, studentRecords, type LessonClass, type LessonPlan,
} from "../shared/lessonPlanner";
import { cleanAsk, lessonPrompt, readAnswer, registerLessonPlannerRoutes } from "../server/lessonPlanner";
import { buildPptx, worksheetHtml, answerKeyText } from "../client/src/lib/lessonExport";

const CLASS: LessonClass = { id: "c1", name: "Period 2 ELA", block: "b2", subject: "ELA", grade: "5", color: "violet", days: ["Mon", "Tue", "Thu", "Fri"], room: "", students: ["Ava", "Ben", "Cam"] };

test("an older lesson (before the planner) still opens, with nothing lost", () => {
  const old = { id: "x1", title: "Main idea", subject: "Reading", group: "Period 2 ELA", date: "2026-10-14", objective: "Find the main idea", materials: "Passage" };
  const l = cleanLesson(old)!;
  assert.equal(l.title, "Main idea");
  assert.equal(l.objective, "Find the main idea");
  assert.equal(l.status, "draft");
  assert.deepEqual(l.files, []);
  assert.deepEqual(l.marks, {});
});

test("bad data is dropped, not trusted", () => {
  const ls = cleanLessons([null, { id: "" }, { id: "a", date: "tomorrow", status: "wild", marks: { Ava: { status: "nope" }, Ben: { status: "reteach" } }, files: [{ id: "f", kind: "worksheet" }, { id: "g", kind: "slides", url: "javascript:alert(1)" }, { id: "h", kind: "slides", url: "https://docs.google.com/x" }] }]);
  assert.equal(ls.length, 1);
  assert.equal(ls[0].date, "");
  assert.equal(ls[0].status, "draft");
  assert.deepEqual(Object.keys(ls[0].marks!), ["Ben"]);
  assert.deepEqual(ls[0].files!.map((f) => f.id), ["h"]);
  const cs = cleanClasses([{ id: "c", name: "P1", days: ["Mon", "Sun", "Mon"], color: "neon", students: ["A", "a", "B"] }, { id: "c", name: "dup" }]);
  assert.equal(cs.length, 1);
  assert.deepEqual(cs[0].days, ["Mon"]);
  assert.equal(cs[0].color, "teal");
  assert.deepEqual(cs[0].students, ["A", "B"]);
});

test("weeks and months for the planner views", () => {
  assert.equal(mondayOf("2026-10-14"), "2026-10-12");
  assert.equal(mondayOf("2026-10-18"), "2026-10-12");
  assert.deepEqual(schoolWeek("2026-10-13"), ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]);
  const weeks = monthWeeks("2026-10-20");
  assert.equal(weeks[0][0], "2026-09-28");
  assert.ok(weeks.every((w) => w.length === 5));
  assert.equal(weeks[weeks.length - 1][4], "2026-10-30");
});

test("planning ahead lands only on the days a class meets", () => {
  assert.equal(meetsOn(CLASS, "2026-10-14"), false); // Wednesday
  assert.deepEqual(nextMeetings(CLASS, "2026-10-14", 3), ["2026-10-15", "2026-10-16", "2026-10-19"]);
  assert.deepEqual(nextMeetings({ days: [] }, "2026-10-16", 2), ["2026-10-16", "2026-10-19"]);
});

test("a snow day pushes the rest of a class's lessons back one meeting", () => {
  const ls: LessonPlan[] = [
    { id: "1", title: "A", subject: "", group: "", date: "2026-10-15", objective: "", materials: "", classId: "c1" },
    { id: "2", title: "B", subject: "", group: "", date: "2026-10-16", objective: "", materials: "", classId: "c1" },
    { id: "3", title: "Other class", subject: "", group: "", date: "2026-10-16", objective: "", materials: "", classId: "zz" },
  ];
  const out = bumpLessons(ls, [CLASS], "c1", "2026-10-15", 1);
  assert.deepEqual(out.map((l) => l.date), ["2026-10-16", "2026-10-19", "2026-10-16"]);
});

test("the reteach tracker: open until a reteach lesson shows they got it", () => {
  const first: LessonPlan = { id: "L1", title: "Main idea", subject: "", group: "", date: "2026-10-12", objective: "", materials: "", classId: "c1", standards: ["RI.5.2 — main idea"], marks: { Ava: { status: "mastered" }, Ben: { status: "reteach", note: "mixed up details" }, Cam: { status: "reteach" } } };
  const reteach: LessonPlan = { id: "L2", title: "Main idea (reteach)", subject: "", group: "", date: "2026-10-13", objective: "", materials: "", classId: "c1", reteachOf: "L1", forStudents: ["Ben", "Cam"], marks: { Ben: { status: "good" }, Cam: { status: "reteach" } } };
  assert.deepEqual(needsReteach(first, [first, reteach]), ["Cam"]);
  const recs = studentRecords([first, reteach], [CLASS], "c1");
  const ben = recs.find((r) => r.name === "Ben")!;
  assert.equal(ben.openReteach.length, 0);
  assert.equal(ben.counts.reteach, 1);
  assert.equal(ben.counts.good, 1);
  const cam = recs.find((r) => r.name === "Cam")!;
  assert.equal(cam.openReteach.length, 2);
  assert.equal(cam.openReteach.find((o) => o.lessonId === "L1")!.standards[0], "RI.5.2 — main idea");
});

test("copying a lesson leaves the student marks behind", () => {
  const l: LessonPlan = { id: "a", title: "T", subject: "", group: "", date: "2026-10-12", objective: "o", materials: "", status: "taught", marks: { Ava: { status: "good" } }, reflection: "went ok" };
  const c = copyLesson(l, "b", { date: "2026-10-20" });
  assert.equal(c.id, "b");
  assert.deepEqual(c.marks, {});
  assert.equal(c.reflection, undefined);
  assert.equal(c.status, "ready");
  assert.equal(planFullness(c).done, 1);
});

test("the AI prompt never carries student names, and answers are cleaned", () => {
  const a = cleanAsk({ mode: "reteach", state: "Michigan", grade: "5", topic: "main idea", students: 2, lesson: { objective: "find main idea", junk: "x" }, names: ["Ben"] });
  const p = lessonPrompt(a);
  assert.ok(p.user.includes("2 student(s)"));
  assert.ok(!p.user.includes("Ben"));
  assert.ok(p.system.includes("Michigan"));
  assert.equal(cleanAsk({ state: "Narnia" }).state, "");
  const plan = readAnswer("build", JSON.stringify({ title: "Main idea", hook: ["a", "b"], minutes: 45, standards: ["RI.5.2 — x"], evil: "<script>" }));
  assert.equal(plan.plan.hook, "• a\n• b");
  assert.equal(plan.plan.evil, undefined);
  assert.throws(() => readAnswer("worksheet", "{}"));
  assert.throws(() => readAnswer("ideas", "not json"));
});

test("the AI route: hub gate, needs a topic, sends back cleaned output", async () => {
  const routes: Record<string, Function> = {};
  const app: any = { post: (path: string, ..._h: Function[]) => { routes[path] = _h[_h.length - 1]; } };
  let gateOk = true;
  registerLessonPlannerRoutes(app, (() => {}) as any, {
    gate: async (_req: any, res: any) => (gateOk ? { access: true } : (res.status(402).json({}), null)),
    aiConfigured: () => true,
    ask: async () => JSON.stringify({ ideas: [{ title: "Main idea museum", summary: "s", activity: "a" }, { title: "" }] }),
  });
  const call = async (body: any) => {
    let status = 200, json: any;
    const res: any = { status(c: number) { status = c; return res; }, json(j: any) { json = j; return res; }, set() { return res; } };
    await routes["/api/teacher-hub/lessons/ai"]({ body, user: { id: 7 } }, res);
    return { status, json };
  };
  assert.equal((await call({ mode: "ideas" })).status, 400);
  const ok = await call({ mode: "ideas", topic: "main idea" });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.json.ideas.map((i: any) => i.title), ["Main idea museum"]);
  gateOk = false;
  assert.equal((await call({ mode: "ideas", topic: "x" })).status, 402);
});

test("worksheet, answer key and PowerPoint downloads", () => {
  const ws = cleanWorksheet({ title: "Main idea", instructions: "Read", sections: [{ heading: "MC", items: [{ prompt: "Pick <one>", choices: ["A1", "B1", "C1", "D1"], answer: "B1" }, { prompt: "Explain", answer: "Because", lines: 3 }] }] })!;
  const sheet = worksheetHtml(ws, { answers: false });
  assert.ok(sheet.includes("Pick &lt;one&gt;"));
  assert.ok(!sheet.includes("ANSWER KEY"));
  const key = worksheetHtml(ws, { answers: true });
  assert.ok(key.includes("ANSWER KEY") && key.includes('class="right"'));
  assert.equal(answerKeyText(ws).split("\n").slice(-2).join("|"), "1. B. B1|2. Because");
  const pptx = buildPptx("Main idea", [{ title: "Main idea", bullets: ["Grade 5"] }, { title: "I can", bullets: ["find <it> & say why"], notes: "Say it" }]);
  assert.equal(pptx[0], 0x50);
  assert.equal(pptx[1], 0x4b);
  assert.ok(Buffer.from(pptx).includes("find &lt;it&gt; &amp; say why"));
});

test("worksheets print real maths and pictures, with the answers only on the key", async () => {
  const { cleanWorksheet } = await import("../shared/lessonPlanner");
  const { renderVisual, cleanVisual, compileExpr } = await import("../shared/worksheetVisuals");
  const { mathHtml, latexToSimpleHtml } = await import("../client/src/lib/lessonExport");
  assert.ok(mathHtml("Add $\\frac{1}{2}+\\frac{1}{4}$").includes("frac-line"), "a stacked fraction, not 1/2");
  assert.equal(latexToSimpleHtml("\\frac{3}{4}"), "<sup>3</sup>&frasl;<sub>4</sub>");
  const ws = cleanWorksheet({ title: "T", sections: [{ heading: "A", columns: 3, items: [
    { kind: "graph", prompt: "Plot A(2,3)", answer: "see graph", visual: { type: "coordinate-plane", xMin: -5, xMax: 5, yMin: -5, yMax: 5 }, keyVisual: { type: "coordinate-plane", xMin: -5, xMax: 5, yMin: -5, yMax: 5, points: [{ x: 2, y: 3, label: "A" }] } },
    { prompt: "Shade", answer: "", visual: { type: "fraction-circle", parts: 8, shaded: 0 } },
    { prompt: "x", answer: "1", visual: { type: "nonsense" } },
  ] }] })!;
  assert.equal(ws.sections[0].columns, 3);
  assert.equal(ws.sections[0].items[0].keyVisual?.type, "coordinate-plane");
  assert.equal(ws.sections[0].items[2].visual, undefined);
  const student = worksheetHtml(ws, { answers: false }), key = worksheetHtml(ws, { answers: true });
  assert.ok(!student.includes(">A</text>") && key.includes(">A</text>"), "the plotted point is only on the key");
  assert.ok(key.includes("ANSWER KEY") && !student.includes("ANSWER KEY"));
  assert.ok(worksheetHtml(ws, { answers: false, both: true }).includes("break-before:page"));
  assert.ok(renderVisual(cleanVisual({ type: "number-line", min: 0, max: 1, denominator: 4 })!).includes("<svg"));
  assert.equal(compileExpr("2x+1")!(3), 7);
  assert.equal(compileExpr("alert(1)"), null);
});
