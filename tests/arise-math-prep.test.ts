// Arise Math "Test Prep": shared/ariseMathPrep.ts and server/ariseMathPrep.ts.
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { COULD_NOT_BUILD, NO_MATH_FOUND, cleanReading, readPrompt, cleanMore, cleanPrepAsk, cleanPrepReply, cleanQuestion, daysUntil, prepPrompt } from "../shared/ariseMathPrep";
import { registerMathPrepRoutes } from "../server/ariseMathPrep";
import { memoryKV } from "../server/podcastDirectory";

const q = (n: number, choices: string[] = []) => ({ q: `What is ${n} + ${n}?`, choices, answer: String(n * 2), accept: [String(n * 2)], hint: "Double it.", steps: [{ title: "Add", work: `${n} + ${n} = ${n * 2}` }] });
const reply = { title: "Adding", grade: "2", overview: "Adding numbers.", topics: [{ name: "Doubles", standard: "2.OA.B.2", summary: "Adding a number to itself.", howTo: [{ title: "Double", work: "Add the number to itself." }], example: { problem: "4 + 4", steps: [{ title: "Add", work: "4 + 4 = 8" }], answer: "8" }, watchOut: ["Don't multiply by 4."], questions: [q(1), q(2, ["3", "4", "5"]), q(3, ["5", "7"])] }] };

test("prep: the ask is cleaned", () => {
  assert.deepEqual(cleanPrepAsk({ title: "  Unit 4 ", testDate: "2026-11-10", grade: "6", text: "6.EE.A.2" }), { title: "Unit 4", testDate: "2026-11-10", grade: "6", text: "6.EE.A.2" });
  assert.deepEqual(cleanPrepAsk({ testDate: "soon", grade: "13" }), { title: "", testDate: "", grade: "", text: "" });
});

test("prep: a question keeps its answer among its choices, or is typed", () => {
  assert.deepEqual(cleanQuestion(q(2, ["3", "4", "5"]))!.choices, ["3", "4", "5"]);
  assert.deepEqual(cleanQuestion(q(3, ["5", "7"]))!.choices, [], "the answer 6 isn't a choice, so it's typed");
  assert.equal(cleanQuestion({ q: "", answer: "1" }), null);
  assert.equal(cleanQuestion({ q: "2+2", answer: "" }), null);
});

test("prep: the AI's reply becomes a set, or says why not", () => {
  const r = cleanPrepReply(reply, { title: "", testDate: "2026-11-10", grade: "" });
  assert.ok("set" in r);
  if (!("set" in r)) return;
  assert.equal(r.set.title, "Adding");
  assert.equal(r.set.grade, "2");
  assert.equal(r.set.topics[0].questions.length, 3);
  assert.equal(r.set.topics[0].example!.answer, "8");
  assert.ok(r.set.topics[0].questions.every((x) => x.id));
  assert.ok("notMath" in cleanPrepReply({ notMath: "That's a cat." }, { title: "", testDate: "", grade: "" }));
  assert.ok("notMath" in cleanPrepReply({ topics: [{ name: "Nothing", questions: [] }] }, { title: "", testDate: "", grade: "" }), "a topic with no questions doesn't count");
  assert.match(prepPrompt({ title: "Unit 4", testDate: "", grade: "6" }), /grade 6/);
});

test("prep: more questions never repeat ones it has", () => {
  const have = [cleanQuestion(q(1))!];
  assert.deepEqual(cleanMore({ questions: [q(1), q(5)] }, have).map((x) => x.q), ["What is 5 + 5?"]);
  assert.equal(daysUntil("2026-11-05", "2026-11-03"), "in 2 days");
  assert.equal(daysUntil("2026-11-03", "2026-11-03"), "today");
  assert.equal(daysUntil("2026-11-01", "2026-11-03"), "");
});

test("prep routes: make, open, practice, more, share with a class, and delete", async () => {
  const app = express(); app.use(express.json({ limit: "30mb" }));
  // Stands in for the sign-in: an "x-user" header plays a signed-in account ("id:role").
  const auth: any = (req: any, _res: any, next: any) => { const [id, role] = String(req.headers["x-user"] || "").split(":"); req.user = { id: Number(id), role, displayName: `User ${id}` }; next(); };
  const sent: number[] = [];
  let asks = 0;
  registerMathPrepRoutes(app, auth, {
    kv: memoryKV(), aiConfigured: () => true, skipCheck: true,
    askAI: async (a) => { asks++; return JSON.stringify(a.system.includes("NEW practice questions") ? { questions: [q(9), q(10)] } : reply); },
    studentsOf: async () => [{ id: 2 }, { id: 3 }], childrenOf: async () => [], notify: async (id) => { sent.push(id); },
  });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/math/prep`;
  const call = async (path: string, user: string, method = "GET", body?: unknown) => {
    const r = await fetch(base + path, { method, headers: { "x-user": user, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json() };
  };
  try {
    assert.equal((await call("", "1:teacher", "POST", {})).status, 400, "nothing to go on");
    assert.equal((await call("", "1:teacher", "POST", { images: ["data:text/html;base64,AAAA"] })).status, 400, "not a picture");
    const made = await call("", "1:teacher", "POST", { title: "Doubles quiz", text: "2.OA.B.2 doubles", images: ["data:image/png;base64,iVBORw0KGgo="] });
    assert.equal(made.status, 200);
    const set = made.body.set;
    assert.equal(set.title, "Doubles quiz");
    assert.equal((await call("", "1:teacher")).body.sets.length, 1);
    assert.equal((await call(`/${set.id}`, "2:student")).status, 404, "not shared yet");

    const shared = await call(`/${set.id}/share`, "1:teacher", "POST", {});
    assert.equal(shared.body.sent, 2);
    assert.deepEqual(sent.sort(), [2, 3]);
    const mine = await call("", "2:student");
    assert.equal(mine.body.sets[0].id, set.id);
    assert.equal(mine.body.sets[0].mine, false);
    assert.equal((await call(`/${set.id}/share`, "2:student", "POST", {})).status, 404, "only the maker sends it");

    const qid = set.topics[0].questions[0].id;
    const prog = await call(`/${set.id}/progress`, "2:student", "PUT", { answers: { [qid]: "right", nope: "right" } });
    assert.deepEqual(prog.body.progress, { total: 3, done: 1, right: 1 });
    assert.deepEqual((await call(`/${set.id}`, "2:student")).body.progress, { [qid]: "right" });

    const more = await call(`/${set.id}/more`, "2:student", "POST", { topicId: set.topics[0].id });
    assert.equal(more.body.questions.length, 2);
    assert.equal((await call(`/${set.id}`, "3:student")).body.set.topics[0].questions.length, 5, "everyone it's shared with gets the new ones");

    assert.equal((await call(`/${set.id}`, "1:teacher", "DELETE")).status, 200);
    assert.equal((await call("", "2:student")).body.sets.length, 0, "deleting takes it off the class's lists too");
    assert.equal(asks, 2);
  } finally { server.close(); }
});

test("a good worksheet isn't turned down: a refused picture is read, then built from what was read", async () => {
  const run = async (answers: string[], body: any = { images: ["data:image/png;base64,iVBORw0KGgo="] }) => {
    const app = express(); app.use(express.json({ limit: "30mb" }));
    const seen: { system: string; text: string; images: string[] }[] = [];
    registerMathPrepRoutes(app, ((req: any, _r: any, next: any) => { req.user = { id: 1, role: "teacher", displayName: "T" }; next(); }) as any, { kv: memoryKV(), aiConfigured: () => true, skipCheck: true, askAI: async (a) => { seen.push(a); const x = answers[seen.length - 1]; if (x === undefined) throw new Error("no more"); return x; } });
    const server = app.listen(0);
    try { const r = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/math/prep`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json(), seen }; }
    finally { server.close(); }
  };
  const refused = JSON.stringify({ notMath: "Please upload a clear photo of the math practice sheet, or type the lesson name or standard." });
  const read = JSON.stringify({ hasMath: true, types: ["doubles"], gradeGuess: "2", problems: ["3 + 3 = ?"] });
  const good = run([refused, read, JSON.stringify(reply)]);
  const made = await good;
  assert.equal(made.status, 200); assert.ok(made.body.set.topics.length);
  assert.equal(made.seen[1].system, readPrompt()); assert.equal(made.seen[1].images.length, 1);
  assert.equal(made.seen[2].images.length, 0); assert.match(made.seen[2].text, /3 \+ 3/);
  const garbled = await run(["{ cut off", read, JSON.stringify(reply)]);
  assert.equal(garbled.status, 200, "a reply cut short gets the same second look");
  const cat = await run([refused, JSON.stringify({ hasMath: false, types: [], problems: [] })]);
  assert.equal(cat.body.notMath, NO_MATH_FOUND, "only after two looks, and it never asks for the lesson name");
  const stuck = await run([refused, read, "nope"]);
  assert.equal(stuck.status, 502); assert.equal(stuck.body.message, COULD_NOT_BUILD);
  assert.equal(cleanReading({ hasMath: false, problems: ["12 x 4"] }).found, true, "numbers on the page beat a wrong no");
  const typed = await run([JSON.stringify(reply)], { text: "fractions" });
  assert.equal(typed.seen.length, 1, "no picture, nothing extra");
});

test("the built route checks questions before anyone sees them, and shows nothing if the check can't run", async () => {
  const run = async (solver: (text: string) => unknown) => {
    const app = express(); app.use(express.json({ limit: "30mb" }));
    registerMathPrepRoutes(app, ((req: any, _r: any, next: any) => { req.user = { id: 1, role: "teacher", displayName: "T" }; next(); }) as any, { kv: memoryKV(), aiConfigured: () => true, askAI: async (a) => { if (a.system.includes("checking math")) return JSON.stringify(solver(a.text)); if (a.system.includes("fixing")) return JSON.stringify({ questions: [] }); return JSON.stringify(reply); } });
    const server = app.listen(0);
    try { const r = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/math/prep`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "doubles" }) }); return { status: r.status, body: await r.json() }; }
    finally { server.close(); }
  };
  const bad = await run((text) => ({ results: JSON.parse(text).map((x: any) => ({ id: x.id, solvable: false, why: "missing" })) }));
  assert.equal(bad.status, 502, "nothing passed, nothing shown");
  const down = await run(() => "not json at all");
  assert.equal(down.status, 502, "an unusable check shows nothing either");
});
