// SPED Exemplar Maker: shared/spedExemplar.ts, server/spedExemplar.ts and the button in Math Lessons.
// No real AI is called: a stand-in plays the AI and a stand-in second solver, so these tests prove the
// instructions, the checks, the two documents and the routes, not the quality of a live model.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  REPAIR_SYSTEM, SPED_LIMITS, SPED_REQUIREMENTS, allProblems, cleanExemplar, cleanPractice, esc, exemplarHtml, exemplarPrompt, fixText, inline, parseJsonLoose, plainText, practiceHtml, practicePrompt, pictureSvg,
  type XExemplar, type XPractice,
} from "../shared/spedExemplar";
import { SOLVE_PROMPT, sameAnswer, wrongInSteps } from "../shared/ariseMathVerify";
import { askClean, buildPack, checkPack, registerSpedExemplarRoutes, singleNumber, SpedAiError, type SpedAsk } from "../server/spedExemplar";
import { memoryKV } from "../server/podcastDirectory";
import { GOLDEN_EXEMPLAR, GOLDEN_PRACTICE, INDEPENDENT_ANSWERS } from "./fixtures/spedExemplarGolden";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const clone = <T,>(x: T): T => structuredClone(x);
const goodExemplar = (): XExemplar => { const c = cleanExemplar(clone(GOLDEN_EXEMPLAR)); assert.ok(c.ok, c.ok ? "" : c.errors.join(" | ")); return (c as any).value; };
const goodPractice = (): XPractice => { const c = cleanPractice(clone(GOLDEN_PRACTICE)); assert.ok(c.ok, c.ok ? "" : c.errors.join(" | ")); return (c as any).value; };

/** A second solver that works every problem out itself (answers computed in the fixture, not copied from it). */
const solver = (overrides: Record<string, string> = {}) => (items: { id: string }[]) =>
  JSON.stringify({ results: items.map((i) => ({ id: i.id, solvable: true, answer: overrides[i.id] ?? INDEPENDENT_ANSWERS[i.id] ?? "?" })) });

/** Plays the AI: the guide, the practice pack, the second solver, and the repair step. */
function fakeAI(opts: { exemplar?: () => unknown; practice?: () => unknown; solve?: Record<string, string>; repair?: (asked: any[]) => unknown; log?: SpedAsk[] } = {}) {
  return async (a: SpedAsk): Promise<string> => {
    opts.log?.push(a);
    if (a.system === SOLVE_PROMPT) return solver(opts.solve)(JSON.parse(a.text));
    if (a.system === REPAIR_SYSTEM) return JSON.stringify(opts.repair ? opts.repair(JSON.parse(a.text)) : { problems: [] });
    if (a.system.includes("PRACTICE PACK")) return JSON.stringify(opts.practice ? opts.practice() : GOLDEN_PRACTICE);
    if (a.system.includes("EXEMPLAR")) return JSON.stringify(opts.exemplar ? opts.exemplar() : GOLDEN_EXEMPLAR);
    return JSON.stringify({ items: [] });
  };
}

// ─── The instructions carry what the teacher asked for ───

test("the AI's instructions contain every requirement the teacher gave, word for word", () => {
  assert.ok(SPED_REQUIREMENTS.length >= 10);
  const ids = new Set(SPED_REQUIREMENTS.map((r) => r.id));
  for (const id of ["audience", "zero", "correct", "simplest", "ladder", "recipe", "supports", "pictures", "two", "practice"]) assert.ok(ids.has(id), `requirement ${id}`);
  const p = exemplarPrompt({ title: "Percent change", grade: "7" });
  for (const r of SPED_REQUIREMENTS) assert.ok(p.includes(r.text), `the exemplar prompt carries "${r.id}"`);
  assert.match(p, /special education teacher who has NEVER taught this lesson/);
  assert.match(p, /elementary student/);
  assert.match(p, /Hint 1|2 or 3 hints/);
  assert.match(p, /finalAnswer/);
  assert.match(p, /why it works/i);
  assert.match(p, /Do NOT include the lesson's separate practice set/);
  assert.match(p, /"kind": "tape"/);
  assert.match(p, /"kind": "grid100"/);
  assert.match(p, /grade 7/);
  assert.match(p, /one fully worked|fully worked/, "carries a worked example so the AI copies the depth and voice");
  assert.ok(p.includes("8.4c") && p.includes("12 ÷ 0.75"), "the worked example is in the prompt");
});

test("the practice instructions make the practice a separate document with no answers on the sheet", () => {
  const ex = goodExemplar();
  const p = practicePrompt({ title: "", grade: "7" }, ex);
  assert.match(p, /SEPARATE document/);
  assert.match(p, /NO answers on it/);
  assert.match(p, /answer key with the steps/);
  assert.match(p, /START → UP or DOWN → PERCENT NOW → EQUATION → SOLVE and CHECK/, "practice uses the same recipe as the guide");
  assert.ok(p.includes("8.2b") && p.includes("Tyler"), "it knows what the guide already solved");
  assert.match(p, /NEW numbers/);
});

// ─── Cleaning: a reply missing anything is rejected with exactly what is missing ───

test("a complete reply is accepted and keeps every part", () => {
  const e = goodExemplar();
  assert.equal(allProblems(e, goodPractice()).length, 9);
  assert.ok(e.ideas.length >= 3 && e.recipe.steps.length === 5 && e.mistakes.length === 1);
  assert.deepEqual(Object.keys(e.supports), ["simplified", "modified", "extension"]);
  assert.ok(allProblems(e, goodPractice()).every((p) => p.hints.length >= 2 && p.steps.length >= 2 && p.why && p.check && p.answer && p.finalAnswer && p.verified === false), "nothing is marked checked until the check runs");
});

test("a reply missing hints, steps, a why, a check or an answer says exactly which", () => {
  const raw: any = clone(GOLDEN_EXEMPLAR);
  delete raw.sections[2].problems[0].hints;
  raw.sections[0].problems[0].why = "";
  raw.sections[0].problems[1].steps = ["only one"];
  raw.sections[1].problems[0].finalAnswer = "";
  const c = cleanExemplar(raw);
  assert.ok(!c.ok);
  const errs = (c as any).errors.join("\n");
  assert.match(errs, /8\.4c is missing at least 2 hints/);
  assert.match(errs, /8\.2b is missing why it works/);
  assert.match(errs, /8\.2f is missing at least 2 numbered steps/);
  assert.match(errs, /8\.3a is missing finalAnswer/);
  const fix = fixText((c as any).errors);
  assert.match(fix, /send the WHOLE JSON object again/);
  assert.ok(fix.includes("8.4c"));
});

test("too few problems, a missing recipe, no supports and duplicate ids are all caught", () => {
  const few: any = clone(GOLDEN_EXEMPLAR); few.sections = [few.sections[0]]; few.recipe.steps = few.recipe.steps.slice(0, 2); few.supports.extension = ["one"]; few.mistakes = [];
  const c = cleanExemplar(few);
  assert.ok(!c.ok);
  const errs = (c as any).errors.join("\n");
  assert.match(errs, /at least 3 fully solved problems \(found 2\)/);
  assert.match(errs, /recipe\.steps needs 3 to 7/);
  assert.match(errs, /supports\.extension needs at least 2/);
  assert.match(errs, /mistakes needs at least 1/);
  const dup: any = clone(GOLDEN_EXEMPLAR); dup.sections[1].problems[0].id = "8.2b";
  assert.match(((cleanExemplar(dup) as any).errors || []).join("\n"), /8\.2b is used twice/);
  assert.ok(!cleanExemplar(null).ok);
  const prac: any = clone(GOLDEN_PRACTICE); prac.sheet = prac.sheet.slice(0, 2);
  assert.match(((cleanPractice(prac) as any).errors || []).join("\n"), /at least 4 practice questions \(found 2\)/);
});

test("the AI's JSON is read even inside a code fence or a sentence", () => {
  assert.deepEqual(parseJsonLoose('{"a":1}'), { a: 1 });
  assert.deepEqual(parseJsonLoose('Here you go:\n```json\n{"a":2}\n```'), { a: 2 });
  assert.deepEqual(parseJsonLoose('Sure! {"a":3} Hope that helps.'), { a: 3 });
  assert.equal(parseJsonLoose("nope"), null);
  assert.equal(singleNumber("about 42.3 meters"), 42.3);
  assert.equal(singleNumber("$5,280"), 5280);
  assert.equal(singleNumber("1.23x = 52"), null);
});

// ─── The golden lesson is itself correct (every number re-derived) ───

test("every worked step in the golden lesson is true arithmetic, and an independent solver agrees with every answer", () => {
  const all = allProblems(goodExemplar(), goodPractice());
  for (const p of all) {
    const wrong = wrongInSteps([...p.steps, p.check, p.answer].map((work) => ({ title: "", work: plainText(work) })), p.hints.map(plainText).join(" "));
    assert.deepEqual(wrong, [], `${p.id} has false arithmetic`);
    const key = (p.id.startsWith("P") ? "b:" : "e:") + p.id;
    const independent = INDEPENDENT_ANSWERS[key];
    assert.ok(independent, `an independent answer exists for ${key}`);
    const close = Math.abs(Number(independent) - Number(p.finalAnswer.replace(/[$,]/g, ""))) <= Math.max(0.051, Math.abs(Number(independent)) * 0.006);
    assert.ok(close || sameAnswer(independent, p.finalAnswer), `${p.id}: ${independent} vs ${p.finalAnswer}`);
  }
  // The lesson's own numbers, from scratch.
  assert.equal(Math.round((52 / 1.23) * 10) / 10, 42.3);
  assert.equal(Math.round((52 / 0.23) * 10) / 10, 226.1);
  assert.equal(12 / 0.75, 16);
  assert.equal(6600 / 1.25, 5280);
  assert.ok(Math.abs(156 / 1.04 - 150) < 1e-9);
  assert.equal(150 * 2.05, 307.5);
});

// ─── The two documents ───

test("the exemplar and the practice pack are two separate documents", () => {
  const e = goodExemplar(), p = goodPractice();
  for (const x of allProblems(e, p)) x.verified = true;
  for (const x of p.sheet) x.verified = true;
  const ex = exemplarHtml(e), pr = practiceHtml(e, p);
  assert.notEqual(ex, pr);
  // The exemplar: ideas, recipe card, every problem with hints / steps / why / check / answer / say, mistakes, supports.
  for (const needle of ["Tiny ideas", "The PERCENT recipe", "Hint 1:", "Hint 3:", "How to solve it, step by step", "Why it works:", "Check it:", "Answer:", "Say it to the student:", "Common mistakes", "Simplified", "Modified", "Extension", "8.5", "Tyler&#39;s savings bond".replace("&#39;", "'")]) assert.ok(ex.includes(needle), `exemplar has "${needle}"`);
  assert.ok(!ex.includes("Answer key for the practice sheet") && !ex.includes('class="blank"'), "no practice sheet or answer key inside the exemplar");
  assert.ok(!ex.includes("P1") || !ex.includes("Designer sneakers"), "the lesson's practice problems are in the pack, not the exemplar");
  // The practice pack: a student sheet with NO answers, then the book's practice solved, then the key.
  const sheetAt = pr.indexOf("Give this page to the student"), bookAt = pr.indexOf("Designer sneakers"), keyAt = pr.indexOf("Answer key for the practice sheet");
  assert.ok(sheetAt > 0 && sheetAt < bookAt && bookAt < keyAt, "sheet, then solved practice, then answer key");
  const sheet = pr.slice(sheetAt, pr.indexOf('<div class="part">', sheetAt + 10));
  assert.ok(sheet.includes("A $40 backpack goes up 10%") && sheet.includes('class="blank"'));
  for (const answer of ["$44", "$50", "100 grams", "$80", "1.10", "0.90"]) assert.ok(!sheet.includes(answer), `the student sheet never shows "${answer}"`);
  assert.ok(pr.includes("Quick reference") && pr.includes("1.04x = 156"));
  assert.ok(!pr.includes("Tiny ideas"));
  for (const doc of [ex, pr]) { assert.ok(doc.startsWith("<!doctype html>") && doc.includes("Illustrative Mathematics") && doc.includes("CC BY 4.0")); }
});

test("hints appear in order and an unchecked problem is flagged in the document", () => {
  const e = goodExemplar(), p = goodPractice();
  const html = exemplarHtml(e);
  assert.ok(html.indexOf("Hint 1:") < html.indexOf("Hint 2:") && html.indexOf("Hint 2:") < html.indexOf("Hint 3:"));
  assert.ok(html.includes("Double-check this one"), "nothing is claimed as checked until it is");
  for (const x of allProblems(e, p)) x.verified = true;
  assert.ok(!exemplarHtml(e).includes("Double-check this one"));
});

test("everything the AI writes is escaped, and only **bold** and `code` become tags", () => {
  const e = goodExemplar();
  e.title = '<script>alert(1)</script> & "quotes"';
  e.sections[0].problems[0].story = 'Click <img src=x onerror=alert(1)> and **bold** and `1 + 1 = 2`';
  const html = exemplarHtml(e);
  assert.ok(!html.includes("<script>alert") && !html.includes("<img src=x"));
  assert.ok(html.includes("&lt;script&gt;") && html.includes("&lt;img src=x"));
  assert.ok(html.includes("<b>bold</b>") && html.includes("<code>1 + 1 = 2</code>"));
  assert.equal(esc('<a href="x">'), "&lt;a href=&quot;x&quot;&gt;");
  assert.equal(inline("**a** `b`"), "<b>a</b> <code>b</code>");
  assert.ok(pictureSvg({ kind: "grid100", label: "6 of 100", shaded: 6 }).includes("<svg") && pictureSvg(null) === "");
  assert.equal((pictureSvg({ kind: "tape", label: "t", pieces: 4, filled: 4, extra: 1, note: "+25%" }).match(/<rect/g) || []).length, 5);
});

// ─── Building: retries, checks, repair ───

test("a reply that is missing parts is sent back with exactly what is missing, then accepted", async () => {
  const log: SpedAsk[] = [];
  let n = 0;
  const bad: any = clone(GOLDEN_EXEMPLAR); delete bad.sections[0].problems[0].why;
  const ai = async (a: SpedAsk) => { log.push(a); return JSON.stringify(++n === 1 ? bad : GOLDEN_EXEMPLAR); };
  const e = await askClean(ai, "sys", "the lesson", [], cleanExemplar);
  assert.equal(n, 2);
  assert.ok(log[1].text.includes("the lesson") && log[1].text.includes("8.2b is missing why it works"), "the retry names the missing part and keeps the lesson");
  assert.equal(e.title, "Percent Increase and Decrease");
  // Never accepts a bad reply: after 3 tries it stops with a message.
  await assert.rejects(askClean(async () => "not json at all", "s", "t", [], cleanExemplar), (err: any) => err instanceof SpedAiError && /three tries/.test(err.message));
});

test("buildPack makes both documents from one lesson and every answer passes the check", async () => {
  const log: SpedAsk[] = [];
  const stages: string[] = [];
  const out = await buildPack({ title: "", grade: "7", text: "Lesson 8: Percent increase and decrease with equations ..." }, [], fakeAI({ log }), { setStage: async (s) => { stages.push(s); } });
  assert.deepEqual(stages, ["Writing the teacher guide", "Writing the practice pack", "Checking every answer"]);
  assert.equal(out.check.flagged, 0);
  assert.equal(out.check.checked, 13);
  assert.ok(allProblems(out.exemplar, out.practice).every((x) => x.verified) && out.practice.sheet.every((x) => x.verified));
  assert.equal(log[0].system.includes("EXEMPLAR"), true);
  assert.equal(log[1].system.includes("PRACTICE PACK"), true);
  assert.match(log[0].text, /Lesson 8: Percent increase/);
  assert.ok(!exemplarHtml(out.exemplar).includes("Double-check this one"));
});

test("a wrong answer is caught by the second solver, rewritten, and checked again", async () => {
  const wrong: any = clone(GOLDEN_EXEMPLAR);
  wrong.sections[2].problems[1].finalAnswer = "5208"; wrong.sections[2].problems[1].accept = ["5208"]; // Boom Town: should be 5,280
  let asked: any[] = [];
  const ai = fakeAI({ exemplar: () => wrong, repair: (a) => { asked = a; return { problems: [{ ...GOLDEN_EXEMPLAR.sections[2].problems[1] }] }; } });
  const out = await buildPack({ title: "", grade: "7", text: "x".repeat(40) }, [], ai);
  assert.equal(asked.length, 1);
  assert.equal(asked[0].id, "8.4d");
  assert.match(asked[0].problem, /second solver got "5280"/);
  const boom = allProblems(out.exemplar, out.practice).find((p) => p.id === "8.4d")!;
  assert.equal(boom.finalAnswer, "5280");
  assert.equal(boom.verified, true);
  assert.equal(out.check.flagged, 0);
});

test("a problem that can't be fixed is kept but marked double-check, never presented as sure", async () => {
  const wrong: any = clone(GOLDEN_EXEMPLAR);
  wrong.sections[2].problems[1].finalAnswer = "5208"; wrong.sections[2].problems[1].accept = ["5208"];
  const out = await buildPack({ title: "", grade: "7", text: "x".repeat(40) }, [], fakeAI({ exemplar: () => wrong, repair: () => ({ problems: [] }) }));
  assert.equal(out.check.flagged, 1);
  const boom = allProblems(out.exemplar, out.practice).find((p) => p.id === "8.4d")!;
  assert.equal(boom.verified, false);
  assert.equal(allProblems(out.exemplar, out.practice).filter((p) => !p.verified).length, 1, "the other answers are still confirmed");
  assert.ok(exemplarHtml(out.exemplar).includes("Double-check this one"));
});

test("false arithmetic inside a step is caught by code even when the solver agrees with the answer", async () => {
  const bad: any = clone(GOLDEN_EXEMPLAR);
  bad.sections[2].problems[1].steps[5] = "Easy way: 1.25 is 5/4. `6,600 × 4 ÷ 5 = 26,400 ÷ 5 = 5,200`.";
  const out = await buildPack({ title: "", grade: "7", text: "x".repeat(40) }, [], fakeAI({ exemplar: () => bad, repair: () => ({ problems: [] }) }));
  const boom = allProblems(out.exemplar, out.practice).find((p) => p.id === "8.4d")!;
  assert.equal(boom.verified, false, "26,400 ÷ 5 is 5,280, not 5,200");
  // A problem the solver says can't be solved from what is written is flagged too.
  const e = goodExemplar(), p = goodPractice();
  const flaggedOut = await checkPack(e, p, async (a) => (a.system === SOLVE_PROMPT ? JSON.stringify({ results: JSON.parse(a.text).map((i: any) => ({ id: i.id, solvable: false, why: "a number is missing" })) }) : JSON.stringify({ problems: [], items: [] })));
  assert.equal(flaggedOut.flagged, flaggedOut.checked);
});

// ─── Routes ───

/** A stand-in for Express (it is not installed in every environment): records the routes, then runs them with a fake request and response. */
function app(deps: Partial<Parameters<typeof registerSpedExemplarRoutes>[2]> = {}) {
  type Route = { method: string; re: RegExp; keys: string[]; handlers: ((req: any, res: any, next: any) => unknown)[] };
  const routes: Route[] = [];
  const add = (method: string) => (path: string, ...handlers: any[]) => {
    const keys: string[] = [];
    routes.push({ method, keys, handlers, re: new RegExp("^" + path.replace(/:([a-z]+)/gi, (_m, k) => { keys.push(k); return "([^/]+)"; }) + "$") });
  };
  const fake: any = { get: add("GET"), post: add("POST"), delete: add("DELETE") };
  const auth: any = (req: any, _res: any, next: any) => { const [id, role] = String(req.headers["x-user"] || "").split(":"); if (id) req.user = { id: Number(id), role, isAdmin: role === "admin" }; return next(); };
  registerSpedExemplarRoutes(fake, auth, { kv: memoryKV(), aiConfigured: () => true, askAI: fakeAI(), ...deps });
  const call = async (path: string, user: string, method = "GET", body?: unknown) => {
    const url = "/api/sped-exemplar" + path;
    const route = routes.find((r) => r.method === method && r.re.test(url));
    assert.ok(route, `no route for ${method} ${url}`);
    const m = route!.re.exec(url)!;
    const req: any = { headers: user ? { "x-user": user } : {}, body: body ?? {}, params: Object.fromEntries(route!.keys.map((k, i) => [k, m[i + 1]])) };
    let status = 200, payload: any;
    const res: any = { set() { return res; }, status(c: number) { status = c; return res; }, json(b: unknown) { payload = b; return res; } };
    // Run the handlers in order: the sign-in stand-in first, then the route itself.
    let i = 0;
    const next = async (): Promise<void> => { const h = route!.handlers[i++]; if (h) await h(req, res, next); };
    await next();
    return { status, body: payload };
  };
  return { server: { close() {} }, call };
}
const until = async (fn: () => Promise<any>, ok: (v: any) => boolean) => { for (let i = 0; i < 100; i++) { const v = await fn(); if (ok(v)) return v; await new Promise((r) => setTimeout(r, 20)); } throw new Error("timed out"); };
const LESSON = { title: "Percent change", grade: "7", text: "Lesson 8: Percent Increase and Decrease with Equations. 8.2 Interest and Depreciation ..." };

test("routes: teachers only, a clear message for each thing missing", async () => {
  const { server, call } = app();
  try {
    assert.equal((await call("", "")).status, 401, "signed out");
    assert.equal((await call("", "5:student")).status, 403);
    assert.equal((await call("", "6:parent", "POST", LESSON)).status, 403);
    assert.equal((await call("", "1:teacher", "POST", {})).status, 400, "nothing pasted");
    assert.match((await call("", "1:teacher", "POST", { text: "short" })).body.message, /Paste the lesson/);
    assert.equal((await call("", "1:teacher", "POST", { images: ["data:text/html;base64,AAAA"] })).status, 400, "not a photo");
    assert.equal((await call("", "1:teacher", "POST", { images: Array(7).fill("data:image/png;base64,iVBORw0KGgo=") })).status, 400, "too many photos");
    assert.equal((await call("/not-an-id", "1:teacher")).status, 404);
    assert.equal((await call("", "1:teacher")).status, 200);
    assert.equal((await call("", "9:admin")).status, 200, "the administrator can use it");
  } finally { server.close(); }
});

test("routes: not turned on without an AI key", async () => {
  const { server, call } = app({ aiConfigured: () => false });
  try {
    assert.equal((await call("", "1:teacher", "POST", LESSON)).status, 503);
    assert.equal((await call("", "1:teacher")).body.ai, false);
  } finally { server.close(); }
});

test("routes: a lesson goes in, two documents come out, and it is kept for the teacher only", async () => {
  const { server, call } = app();
  try {
    const started = await call("", "1:teacher", "POST", LESSON);
    assert.equal(started.status, 202);
    const id = started.body.id;
    const done = await until(() => call(`/${id}`, "1:teacher"), (r) => r.body.status !== "working");
    assert.equal(done.body.status, "done", done.body.error);
    const pack = done.body.pack;
    assert.equal(pack.title, "Percent change");
    assert.equal(pack.check.flagged, 0);
    assert.equal(pack.check.checked, 13);
    const docs = { ex: exemplarHtml(pack.exemplar), pr: practiceHtml(pack.exemplar, pack.practice) };
    assert.ok(docs.ex.includes("Hint 1:") && docs.pr.includes("Answer key"));
    assert.ok(!docs.ex.includes("Double-check this one"));
    const mine = await call("", "1:teacher");
    assert.deepEqual(mine.body.mine.map((m: any) => m.id), [id]);
    assert.equal((await call(`/${id}`, "2:teacher")).status, 404, "another teacher can't open it");
    assert.equal((await call(`/${id}`, "9:admin")).status, 200, "the administrator can");
    assert.equal((await call(`/${id}`, "1:teacher", "DELETE")).status, 200);
    assert.equal((await call(`/${id}`, "1:teacher")).status, 404);
    assert.equal((await call("", "1:teacher")).body.mine.length, 0);
  } finally { server.close(); }
});

test("routes: when the AI can't finish, the teacher gets a plain message, not a spinner", async () => {
  const { server, call } = app({ askAI: async () => "I cannot do that" });
  try {
    const { body } = await call("", "1:teacher", "POST", LESSON);
    const done = await until(() => call(`/${body.id}`, "1:teacher"), (r) => r.body.status !== "working");
    assert.equal(done.body.status, "failed");
    assert.match(done.body.error, /three tries|Tap Build again/);
    assert.equal(done.body.pack, undefined);
  } finally { server.close(); }
});

test("routes: a build that stopped moving is reported as interrupted", async () => {
  let t = 1_000_000;
  const kv = memoryKV();
  const { server, call } = app({ kv, now: () => t, askAI: () => new Promise<string>(() => {}) });
  try {
    const { body } = await call("", "1:teacher", "POST", LESSON);
    assert.equal((await call(`/${body.id}`, "1:teacher")).body.status, "working");
    t += 9 * 60_000;
    const r = await call(`/${body.id}`, "1:teacher");
    assert.equal(r.body.status, "failed");
    assert.match(r.body.error, /interrupted/);
  } finally { server.close(); }
});

test("routes: a teacher can make a limited number a day", async () => {
  const { server, call } = app({ askAI: async () => "{}" });
  try {
    for (let i = 0; i < SPED_LIMITS.perDay; i++) assert.equal((await call("", "1:teacher", "POST", LESSON)).status, 202);
    const over = await call("", "1:teacher", "POST", LESSON);
    assert.equal(over.status, 429);
    assert.match(over.body.message, /a lot of exemplars/);
    assert.equal((await call("", "2:teacher", "POST", LESSON)).status, 202, "someone else is not limited");
  } finally { server.close(); }
});

// ─── Wiring: the button, the page and the server ───

test("Math Lessons has a separate SPED Exemplar Maker button and view, wired to the route", () => {
  const page = read("client/src/pages/MathLessons.tsx");
  assert.ok(page.includes("SPED Exemplar Maker"), "the button says so");
  assert.ok(page.includes('"maker"'), "it is its own view");
  assert.ok(page.includes("SpedExemplarMaker"));
  const maker = read("client/src/pages/SpedExemplarMaker.tsx");
  assert.ok(maker.includes("/api/sped-exemplar") && maker.includes("exemplarHtml") && maker.includes("practiceHtml") && maker.includes("SPED_REQUIREMENTS"));
  assert.match(maker, /Print \/ Save as PDF/);
  assert.match(read("server/routes.ts"), /registerSpedExemplarRoutes\(app, authMiddleware/);
  assert.match(read("shared/pluginStore.ts"), /SPED Exemplar Maker/, "the store listing mentions it");
});
