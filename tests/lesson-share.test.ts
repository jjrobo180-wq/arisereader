import { test } from "node:test";
import assert from "node:assert/strict";
import { sharePlans, sharedFilePath } from "../shared/lessonShare";
import { registerLessonShareRoutes } from "../server/lessonShare";

const ws = {
  lessonClasses: [{ id: "c1", name: "Period 2 Reading", subject: "Reading", grade: "4", color: "teal", days: [], room: "12", students: ["Amani Quintana", "Diego B"] }],
  lessons: [
    { id: "l1", title: "Main idea", date: "2026-11-10", classId: "c1", status: "ready", summary: "Read the passage together, then find the main idea.", reflection: "PRIVATE went badly", objective: "Find the main idea",
      marks: { "Amani Quintana": { status: "reteach", score: "4/10" } }, forStudents: ["Diego B"],
      files: [{ id: "f1", kind: "worksheet", name: "Main idea practice.pdf", path: "7/abc.pdf", size: 10, contentType: "application/pdf" }, { id: "f2", kind: "answerKey", name: "Key", path: "7/key.pdf" }, { id: "f3", kind: "other", name: "Directions", text: "Underline the topic sentence." }, { id: "f4", kind: "slides", name: "Slides", url: "https://docs.google.com/x" }] },
    { id: "l2", title: "Just an idea", date: "2026-11-11", classId: "c1", status: "idea" },
  ],
};

test("the school link shows the plan in words and the files, never students, marks, reflections or answer keys", () => {
  const out = sharePlans(ws, "Mr. Robinson", "2026-11-01", "2026-11-30");
  const text = JSON.stringify(out);
  for (const secret of ["Amani", "Diego", "4/10", "reteach", "PRIVATE", "Key", "7/abc.pdf"]) assert.ok(!text.includes(secret), `${secret} stays private`);
  assert.equal(out.lessons.length, 1, "ideas aren't shown");
  const l = out.lessons[0];
  assert.equal(l.parts[0].label, "Plan"); assert.match(l.parts[0].text, /main idea/);
  assert.deepEqual(l.materials.map((m) => m.name), ["Main idea practice.pdf", "Directions", "Slides"]);
  assert.equal(l.materials.find((m) => m.name === "Directions")!.text, "Underline the topic sentence.");
  assert.ok(l.materials[0].file && !("path" in l.materials[0]));
  assert.equal(out.classes[0].name, "Period 2 Reading"); assert.ok(!("students" in out.classes[0]));
  assert.deepEqual(sharedFilePath(ws, 7, "l1", "f1"), { path: "7/abc.pdf", name: "Main idea practice.pdf" });
  assert.equal(sharedFilePath(ws, 7, "l1", "f2"), null, "answer keys can't be opened from the link");
  assert.equal(sharedFilePath(ws, 8, "l1", "f1"), null, "only the teacher's own files");
});

test("the link works without signing in, and turning it off or making a new one stops the old link", async () => {
  const settings = new Map<string, string>(); const routes: Record<string, Function> = {};
  const add = (m: string) => (path: string, ...h: Function[]) => { routes[`${m} ${path}`] = h[h.length - 1]; };
  const app: any = { get: add("GET"), post: add("POST") };
  registerLessonShareRoutes(app, ((_q: any, _s: any, n: any) => n()) as any, {
    getSetting: async (k) => settings.get(k) ?? "", upsertSetting: async (k, v) => { settings.set(k, v); },
    workHub: async () => ws, nameOf: async () => "Mr. Robinson", fileUrl: async (p) => `https://signed/${p}`, now: () => new Date("2026-11-09T17:00:00Z"),
  });
  const call = async (m: string, path: string, body: any = {}, params: any = {}, query: any = {}) => {
    let status = 200, out: any = null, to = "";
    const res: any = { status(c: number) { status = c; return res; }, json(b: any) { out = b; return res; }, send(b: any) { out = b; return res; }, set() { return res; }, redirect(c: number, u: string) { status = c; to = u; return res; } };
    await routes[`${m} ${path}`]({ user: { id: 7 }, body, params, query, headers: {}, ip: "1.2.3.4" }, res);
    return { status, body: out, to };
  };
  const on = await call("POST", "/api/teacher-hub/lesson-share", { on: true });
  const token = on.body.token; assert.ok(token);
  const page = await call("GET", "/api/public/lesson-plans/:token", {}, { token });
  assert.equal(page.status, 200); assert.equal(page.body.teacher, "Mr. Robinson"); assert.equal(page.body.lessons.length, 1);
  const file = await call("GET", "/api/public/lesson-plans/:token/file/:lesson/:material", {}, { token, lesson: "l1", material: "f1" });
  assert.equal(file.status, 302); assert.equal(file.to, "https://signed/7/abc.pdf");
  const fresh = await call("POST", "/api/teacher-hub/lesson-share", { on: true, fresh: true });
  assert.notEqual(fresh.body.token, token);
  assert.equal((await call("GET", "/api/public/lesson-plans/:token", {}, { token })).status, 404, "the old link stops");
  await call("POST", "/api/teacher-hub/lesson-share", { on: false });
  assert.equal((await call("GET", "/api/public/lesson-plans/:token", {}, { token: fresh.body.token })).status, 404, "off means off");
});
