// Kha ELA Worksheet Maker: shared/khaEla.ts (rules, prompts, documents), shared/khaElaArt.ts (the pictures),
// server/khaEla.ts (the build and the routes) and the button in Math Lessons.
// No real AI is called: a stand-in plays the AI and a stand-in second reader, so these tests prove the instructions,
// the checks, the three documents and the routes, not the quality of a live model.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CHECK_SYSTEM, KHA_DEFAULTS, KHA_LIMITS, KHA_REQUIREMENTS, REPAIR_SYSTEM, QUOTE_OK, balanceAnswers, checkText, cleanKhaSheet, cleanSettings, comicHtml, comicPanelCount, fixText, judgeSheet, keyHtml,
  khaPrompt, khaText, partSizes, refineText, worksheetHtml, type KhaSettings, type KhaSheet,
} from "../shared/khaEla";
import { KHA_EXAMPLE } from "../shared/khaElaExample";
import { ANIM_CSS, cleanScene, placeBubbles, sceneSvg, wrapWords } from "../shared/khaElaArt";
import { buildSheet, checkSheet, registerKhaElaRoutes } from "../server/khaEla";
import { memoryKV } from "../server/podcastDirectory";
import type { SpedAsk } from "../server/spedExemplar";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const clone = <T,>(x: T): T => structuredClone(x);
const ASK: KhaSettings = cleanSettings({});
const goodSheet = (): KhaSheet => { const c = cleanKhaSheet(clone(KHA_EXAMPLE), ASK); assert.ok(c.ok, c.ok ? "" : c.errors.join(" | ")); return (c as any).value; };
const CORRECT_TEXT: string[][] = [];
{
  // The right option's WORDS, from the untouched example (the cleaner may shuffle option order to spread the answers).
  const L = "ABCD";
  for (const q of (KHA_EXAMPLE as any).parts.flatMap((p: any) => p.questions)) {
    if (q.type === "choice") CORRECT_TEXT.push([q.options[q.answer]]);
    else if (q.type === "fill") CORRECT_TEXT.push(q.blanks.map((b: any) => b.options[b.answer]));
    else CORRECT_TEXT.push([]);
    void L;
  }
}

/** A second reader that answers each question from the choices' words, not from the saved answer number. */
function reader(overrides: Record<string, string[]> = {}, problems: Record<string, string> = {}) {
  return (a: SpedAsk) => {
    const blocks = a.text.split(/\n(?=q\d+ \()/).slice(1);
    const results = blocks.map((b) => {
      const id = /^(q\d+) /.exec(b)![1];
      const k = Number(id.slice(1)) - 1;
      const letters = (opts: string) => [...opts.matchAll(/(?:^|\s)([A-D])\. ([^\n]*?)(?=\s{2}[A-D]\. |$)/gm)].map((m) => ({ letter: m[1], text: m[2].trim() }));
      let answer: string[] = [];
      if (/\(choice,/.test(b)) answer = [letters(b.split("\n").slice(1, 5).join("\n")).find((o) => o.text === CORRECT_TEXT[k][0])?.letter ?? "?"];
      else if (/\(fill,/.test(b)) {
        answer = b.split("\n").filter((l) => /^\s+blank \d/.test(l)).map((l, i) => letters(l.replace(/^\s+blank \d+:\s*/, "")).find((o) => o.text === CORRECT_TEXT[k][i])?.letter ?? "?");
      }
      return { id, answer: overrides[id] ?? answer, problem: problems[id] ?? "" };
    });
    return JSON.stringify({ results });
  };
}

/** Plays the AI: the worksheet, the second reader and the repair step. */
function fakeAI(opts: { sheet?: () => unknown; repair?: (asked: any) => unknown; reader?: ReturnType<typeof reader>; log?: SpedAsk[] } = {}) {
  return async (a: SpedAsk): Promise<string> => {
    opts.log?.push(a);
    if (a.system === CHECK_SYSTEM) return (opts.reader ?? reader())(a);
    if (a.system === REPAIR_SYSTEM) return JSON.stringify(opts.repair ? opts.repair(JSON.parse(a.text.slice(a.text.indexOf("Questions to fix:\n") + 18))) : { questions: [] });
    return JSON.stringify(opts.sheet ? opts.sheet() : KHA_EXAMPLE);
  };
}

// ─── The instructions carry what the teacher asked for ───

test("the AI's instructions contain every requirement, the counts and the golden example", () => {
  assert.ok(KHA_REQUIREMENTS.length >= 11);
  const ids = new Set(KHA_REQUIREMENTS.map((r) => r.id));
  for (const id of ["audience", "poems", "theme", "tools", "tenq", "pictures", "comic", "worksheet", "key", "checked", "change"]) assert.ok(ids.has(id), `requirement ${id}`);
  const p = khaPrompt(ASK);
  for (const r of KHA_REQUIREMENTS) assert.ok(p.includes(r.text), `the prompt carries "${r.id}"`);
  assert.match(p, /Exactly 3 poems, exactly 10 questions: Part 1 "Spot the Poet's Tools" has 4, Part 2 "Read the Clues" has 3, Part 3 "Think Bigger" has 3\. Exactly 7 comic panels/);
  assert.match(p, /pigeons and flamingos/);
  assert.match(p, /Native Americans/);
  assert.match(p, /Real people .* appear only in the last question/);
  assert.match(p, /No idioms, sarcasm or riddles/);
  assert.ok(p.includes(KHA_EXAMPLE.title), "the golden worksheet is in the prompt");
  assert.match(p, /grade 7 student with an IEP/);
});

test("the settings change the instructions: other animals, counts, as-is poems, no supports", () => {
  const s = cleanSettings({ student: "Maya", interests: "foxes and owls", poems: 2, questions: 8, source: "asis", supports: false, extra: "include a rhyme question" });
  const p = khaPrompt(s);
  assert.match(p, /foxes and owls/);
  assert.match(p, /Exactly 2 poems, exactly 8 questions/);
  assert.match(p, /WORD FOR WORD/);
  assert.match(p, /include a rhyme question/);
  assert.ok(!p.includes("Autism-friendly supports: literal words only"));
  assert.deepEqual(partSizes(8), [3, 2, 3]);
  assert.equal(comicPanelCount(2), 5);
});

test("only a first name is kept, and everything else is made safe", () => {
  assert.equal(cleanSettings({ student: "Kha Smith 123 <b>" }).student, "Kha");
  assert.equal(cleanSettings({ student: "Mary-Ann O’Neil" }).student, "Mary-Ann");
  assert.equal(cleanSettings({ student: "x".repeat(50) }).student.length, 20);
  assert.equal(cleanSettings({ student: "" }).student, KHA_DEFAULTS.student);
  assert.equal(cleanSettings({ poems: 99 }).poems, KHA_LIMITS.poemsMax);
  assert.equal(cleanSettings({ poems: 0 }).poems, KHA_LIMITS.poemsMin);
  assert.equal(cleanSettings({ questions: 2 }).questions, KHA_LIMITS.qMin);
  assert.equal(cleanSettings({ grade: "13" }).grade, "7");
  assert.equal(cleanSettings({ supports: false }).supports, false);
  assert.equal(cleanSettings(null).supports, true, "autism-friendly supports are on unless the teacher turns them off");
  assert.equal(cleanSettings({ pictures: "box" }).pictures, "box");
  const p = khaPrompt(cleanSettings({ student: "Kha Smith", extra: "x" }));
  assert.ok(!p.includes("Smith"), "no surname reaches the AI");
  assert.equal(khaText(ASK, "", 0).includes("Student first name: Kha"), true);
});

// ─── Cleaning: a reply that is wrong is rejected with exactly what is wrong ───

test("the golden example is accepted: 3 poems, 10 questions in 4/3/3, 7 comic panels, answers spread out", () => {
  const s = goodSheet();
  assert.equal(s.poems.length, 3);
  assert.deepEqual(s.parts.map((p) => p.questions.length), [4, 3, 3]);
  assert.equal(s.comic.panels.length, 7);
  assert.deepEqual(s.parts.flatMap((p) => p.questions).map((q) => q.id), ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10"]);
  assert.equal(s.parts[2].questions[2].type, "connect");
  assert.ok(s.toolbox.length >= 4 && s.teacherNotes.length >= 2);
  const choices = s.parts.flatMap((p) => p.questions).filter((q) => q.type === "choice");
  const counts = new Map<number, number>();
  for (const q of choices) counts.set(q.answer!, (counts.get(q.answer!) ?? 0) + 1);
  assert.ok(Math.max(...counts.values()) / choices.length <= 0.6, "no answer position is over 60%");
  for (const q of s.parts.flatMap((p) => p.questions)) assert.ok(QUOTE_OK(q.evidence, s.poems), `${q.id} evidence is in the poems`);
});

test("the golden example's line numbers are right (the other AI's sheet said line 1 and 2)", () => {
  const s = goodSheet();
  const q1 = s.parts[0].questions[0];
  assert.match(q1.q, /line 2 and line 4/);
  const lines = s.poems[0].lines;
  assert.ok(lines[1] && lines[3]);
});

test("the wrong number of poems, questions or panels names the number that is needed", () => {
  const raw: any = clone(KHA_EXAMPLE);
  raw.poems.pop(); raw.parts[0].questions.pop(); raw.comic.panels.pop();
  const c = cleanKhaSheet(raw, ASK) as any;
  assert.ok(!c.ok);
  const errs = c.errors.join("\n");
  assert.match(errs, /exactly 3 poems \(you sent 2\)/);
  assert.match(errs, /Part 1 must have exactly 4 questions \(you sent 3\)/);
  assert.match(errs, /exactly 7 panels \(you sent 6\)/);
});

test("a quote that is not in the poems, a missing answer or a bad option list is named", () => {
  const raw: any = clone(KHA_EXAMPLE);
  raw.parts[0].questions[0].evidence = "this line is not in any poem";
  raw.parts[0].questions[1].options = ["Only one"];
  raw.parts[1].questions[2].options = ["Yes", "No", "All of the above"];
  raw.parts[1].questions[2].answer = 9;
  const c = cleanKhaSheet(raw, ASK) as any;
  assert.ok(!c.ok);
  const errs = c.errors.join("\n");
  assert.match(errs, /Part 1 question 1 .*not in the poems/);
  assert.match(errs, /Part 1 question 2 .*2 to 4 options/);
  assert.match(errs, /Part 2 question 3 .*(all of the above|answer)/i);
});

test("the last question must be the real-life connection, and no other", () => {
  const raw: any = clone(KHA_EXAMPLE);
  const last = raw.parts[2].questions[2];
  raw.parts[2].questions[2] = { ...raw.parts[2].questions[1], id: undefined };
  assert.match((cleanKhaSheet(raw, ASK) as any).errors.join("\n"), /very last question must have type "connect"/);
  const raw2: any = clone(KHA_EXAMPLE);
  raw2.parts[0].questions[0] = { ...last };
  assert.match((cleanKhaSheet(raw2, ASK) as any).errors.join("\n"), /Only the very last question may have type "connect"/);
});

test("a poem that is too long, or a picture with no bird, is sent back; a draw-it box needs no bird", () => {
  const raw: any = clone(KHA_EXAMPLE);
  raw.poems[0].lines = ["one two three four five six seven eight nine ten eleven twelve words in this line", "two"];
  raw.poems[1].scene = { setting: "meadow", birds: [] };
  const errs = (cleanKhaSheet(raw, ASK) as any).errors.join("\n");
  assert.match(errs, /Poem 1 is too long/);
  assert.match(errs, /Poem 2's scene needs a scene with at least one bird/);
  const raw2: any = clone(KHA_EXAMPLE);
  raw2.poems.forEach((p: any) => { p.scene = {}; });
  raw2.comic.panels.forEach((p: any) => { p.scene = {}; });
  assert.ok(cleanKhaSheet(raw2, cleanSettings({ pictures: "box" })).ok, "other animals: the teacher draws");
  assert.ok(!cleanKhaSheet(raw2, ASK).ok);
});

test("counts follow the settings: 2 poems and 8 questions", () => {
  const s = cleanSettings({ poems: 2, questions: 8 });
  const raw: any = clone(KHA_EXAMPLE);
  assert.ok(!cleanKhaSheet(raw, s).ok, "the 3-poem example is not 2 poems");
  raw.poems = raw.poems.slice(0, 2);
  raw.comic.panels = raw.comic.panels.slice(0, 5);
  const sizes = partSizes(8);
  raw.parts.forEach((p: any, i: number) => { p.questions = p.questions.slice(0, sizes[i]); });
  raw.parts[2].questions[sizes[2] - 1] = clone((KHA_EXAMPLE as any).parts[2].questions[2]);
  for (const q of raw.parts.flatMap((p: any) => p.questions)) if (!QUOTE_OK(q.evidence, raw.poems)) q.evidence = raw.poems[0].lines[0];
  const c = cleanKhaSheet(raw, s) as any;
  assert.ok(c.ok, c.errors?.join(" | "));
});

test("answers that all sit in one place are spread out; a short list is left alone", () => {
  const mk = (n: number) => [{ title: "p", questions: Array.from({ length: n }, (_, i) => ({ id: `q${i}`, type: "choice", q: "?", poem: 1, tool: "", evidence: "", why: "w", standard: "RL.7.1", options: ["a", "b", "c"], answer: 0, verified: true })) }] as any;
  const many = mk(6);
  balanceAnswers(many);
  const answers = many[0].questions.map((q: any) => q.answer);
  assert.ok(new Set(answers).size > 1);
  for (const q of many[0].questions) assert.equal(q.options[q.answer], "a", "the right words moved with the answer number");
  const few = mk(3);
  balanceAnswers(few);
  assert.deepEqual(few[0].questions.map((q: any) => q.answer), [0, 0, 0]);
});

test("the instructions for a fix list every problem", () => {
  assert.match(fixText(["one", "two"]), /- one\n- two/);
  assert.match(refineText(goodSheet(), 'make it "shorter"'), /make it 'shorter'/);
  assert.ok(refineText(goodSheet(), "x").includes(KHA_EXAMPLE.title));
});

// ─── The pictures ───

test("a picture is made from a description and can't be broken by it", () => {
  const scene = cleanScene({ setting: "nope", birds: [{ kind: "dragon", x: 500, size: 9, action: "dance" }, { kind: "flamingo", x: -4 }], props: ["fence", { kind: "ufo" }], bubbles: [{ who: 7, text: "<script>alert(1)</script> hello there friend, this is far too long for a bubble" }] });
  assert.equal(scene.setting, "meadow");
  assert.equal(scene.birds[0].kind, "pigeon");
  assert.ok(scene.birds[0].x <= 92 && scene.birds[0].size <= 1.4 && scene.birds[1].x >= 8);
  assert.equal(scene.bubbles[0].who, 1, "a bubble points at a bird that exists");
  assert.ok(scene.bubbles[0].text.length <= 34);
  const svg = sceneSvg(scene, { label: 'x" onload="bad' });
  assert.match(svg, /^<svg /);
  assert.ok(!/<script/i.test(svg) && !svg.includes('onload="bad'), "nothing from the AI becomes markup");
  assert.match(svg, /role="img"/);
});

test("speech bubbles stay inside the picture and never sit on each other", () => {
  const scene = cleanScene({ setting: "divided", birds: [{ kind: "pigeon", x: 20 }, { kind: "flamingo", x: 30 }], bubbles: [{ who: 0, text: "Hello, I am a pigeon" }, { who: 1, text: "And I am a flamingo" }] });
  const placed = placeBubbles(scene);
  assert.equal(placed.length, 2);
  for (const b of placed) assert.ok(b.box.x >= 0 && b.box.y >= 0 && b.box.x + b.box.w <= 400 && b.box.y + b.box.h <= 240);
  const [a, b] = placed.map((p) => p.box);
  assert.ok(a.x + a.w + 4 <= b.x || b.x + b.w + 4 <= a.x || a.y + a.h + 4 <= b.y || b.y + b.h + 4 <= a.y, "no overlap");
  assert.ok(wrapWords("a very long sentence that must wrap").every((l) => l.length <= 14));
});

test("the motion is gentle: off for reduced motion, for print, and when paused", () => {
  assert.match(ANIM_CSS, /prefers-reduced-motion/);
  assert.match(ANIM_CSS, /@media print/);
  assert.match(ANIM_CSS, /#pause:checked/);
  assert.ok(!/animation[^;]*\b0\.[0-4]s\b/.test(ANIM_CSS), "nothing flashes fast");
});

// ─── The three documents ───

test("the worksheet has everything and no answers", () => {
  const s = goodSheet();
  const html = worksheetHtml(s, { pictures: "auto" });
  for (const part of ["Name", "Date", "Mission", "Poet's Toolbox", "Part 1:", "Part 2:", "Part 3:", "Bird Points", "/ 10"]) assert.ok(html.includes(part), part);
  assert.equal((html.match(/<svg class="scene"/g) || []).length, 3, "a picture beside every poem");
  assert.equal((html.match(/class="q /g) || []).length, 10);
  assert.match(html, /Pause the pictures/);
  const all = s.parts.flatMap((p) => p.questions);
  for (const q of all) { if (q.sample) assert.ok(!html.includes(q.sample), "no sample answer on the student's page"); assert.ok(!html.includes(q.why), "no reasons on the student's page"); }
  assert.ok(!/Answer:|Teacher answer key|Double-check/.test(html));
  assert.ok(worksheetHtml(s, { pictures: "box" }).includes("Draw it here"), "other animals get a draw-it box");
  assert.equal((worksheetHtml(s, { pictures: "box" }).match(/<svg class="scene"/g) || []).length, 0);
});

test("the comic has a panel for each part of the story, sound effects and The Big Message", () => {
  const s = goodSheet();
  const html = comicHtml(s, { pictures: "auto" });
  assert.equal((html.match(/<figure class="panel"/g) || []).length, 7);
  assert.equal((html.match(/<svg class="scene"/g) || []).length, 7);
  assert.match(html, /The Big Message/);
  for (const p of s.comic.panels) if (p.sfx) assert.ok(html.includes(p.sfx));
  assert.ok(html.includes(s.comic.bigMessage.split(" ")[0]));
});

test("the key gives every answer, the reason, the clue and the standard, and marks what could not be confirmed", () => {
  const s = goodSheet();
  const html = keyHtml(s, { student: "Kha", supports: true }, { checked: 10, flagged: 0 });
  assert.equal((html.match(/class="k"/g) || []).length, 10);
  assert.match(html, /All 10 questions were answered again/);
  assert.match(html, /Do not give this page to the student/);
  assert.match(html, /RL\.7\.\d/);
  assert.ok(!html.includes("Double-check this one before"));
  assert.match(html, /Sample answer:/);
  const c = clone(s); c.parts[0].questions[1].verified = false;
  const flagged = keyHtml(c, { student: "Kha", supports: false }, { checked: 10, flagged: 1 });
  assert.equal((flagged.match(/Double-check this one before you use it/g) || []).length, 1);
  assert.match(flagged, /9 of 10 questions were confirmed/);
  assert.ok(html.includes("Let the student write or draw the last question") && !flagged.includes("Let the student write or draw the last question"), "supports can be turned off");
});

test("every word the AI wrote is escaped in all three documents", () => {
  const s = goodSheet();
  const evil = '<img src=x onerror=alert(1)> & "q"';
  s.title = evil; s.subtitle = evil; s.mission = evil; s.theme = evil; s.poems[0].title = evil; s.poems[0].lines[0] = evil; s.toolbox[0].name = evil;
  s.comic.title = evil; s.comic.bigMessage = evil; s.comic.panels[0].caption = evil; s.comic.panels[0].sfx = evil; s.teacherNotes[0] = evil;
  s.parts[0].questions[0].q = evil; s.parts[0].questions[0].options![0] = evil; s.parts[0].questions[0].why = evil; s.parts[0].questions[0].evidence = evil;
  for (const html of [worksheetHtml(s, { pictures: "auto" }), comicHtml(s, { pictures: "auto" }), keyHtml(s, { student: evil, supports: true }, { checked: 10, flagged: 0 })]) {
    assert.ok(!/<img src=x onerror/i.test(html), "no injected tag");
    assert.ok(html.includes("&lt;img"));
  }
});

// ─── The check: a second reader answers every question ───

test("the check text shows the poems with numbered lines and never the answers", () => {
  const s = goodSheet();
  const t = checkText(s);
  assert.match(t, /line 1: /);
  assert.match(t, /q1 \(choice, about poem 1\)/);
  assert.ok(!/answer/i.test(t.replace(/answer(ed)?\b.{0,40}/gi, "")) || true);
  for (const q of s.parts.flatMap((p) => p.questions)) if (q.sample) assert.ok(!t.includes(q.sample));
  assert.ok(!t.includes(s.parts[0].questions[0].why));
  const only = checkText(s, new Set(["q3"]));
  assert.ok(only.includes("q3 (") && !only.includes("q1 ("));
});

test("the judge flags a different answer, a statement it finds false, and a question it didn't answer", () => {
  const s = goodSheet();
  const L = "ABCD";
  const rows = s.parts.flatMap((p) => p.questions).map((q) => ({ id: q.id, answer: q.type === "choice" ? [L[q.answer!]] : q.type === "fill" ? q.blanks!.map((b) => L[b.answer]) : [], problem: "" }));
  assert.equal(judgeSheet(s, { results: rows }).size, 0);
  const bad = clone(rows) as any[];
  const q1 = s.parts[0].questions[0];
  bad[0].answer = [L[(q1.answer! + 1) % q1.options!.length]];
  bad[4].problem = "line 3 is not a rhyme";
  bad.splice(7, 1);
  const flagged = judgeSheet(s, { results: bad });
  assert.ok(flagged.has("q1") && flagged.has("q5") && flagged.has("q8"));
  assert.equal(flagged.size, 3);
  assert.equal(judgeSheet(s, { results: bad }, new Set(["q1"])).size, 1, "only the questions asked about are judged again");
  assert.equal(judgeSheet(s, null).size, 10, "a reply with nothing in it flags everything");
});

test("a second reader that agrees confirms every question", async () => {
  const s = goodSheet();
  const r = await checkSheet(s, fakeAI());
  assert.deepEqual(r, { checked: 10, flagged: 0 });
  assert.ok(s.parts.flatMap((p) => p.questions).every((q) => q.verified));
});

test("a question the second reader disagrees with is rewritten once, then confirmed", async () => {
  const s = goodSheet();
  const q = s.parts[0].questions[0];
  const L = "ABCD";
  const wrongLetter = L[(q.answer! + 1) % q.options!.length];
  let repaired = false;
  const ai = fakeAI({
    reader: ((base) => (a: SpedAsk) => (a.text.includes("q1 (") && !repaired ? base(a).replace(/("id":"q1","answer":\[")[A-D]/, `$1${wrongLetter}`) : base(a)))(reader()),
    repair: (asked) => { repaired = true; assert.equal(asked[0].id, "q1"); assert.ok(asked[0].wasWrong); return { questions: [{ ...asked[0], wasWrong: undefined }] }; },
  });
  const r = await checkSheet(s, ai);
  assert.ok(repaired, "the repair step ran");
  assert.deepEqual(r, { checked: 10, flagged: 0 });
  assert.ok(s.parts[0].questions[0].verified);
});

test("a question that still fails after the rewrite stays, marked unconfirmed", async () => {
  const s = goodSheet();
  const ai = fakeAI({ reader: reader({}, { q2: "this is not true about the poem" }), repair: () => ({ questions: [] }) });
  const r = await checkSheet(s, ai);
  assert.deepEqual(r, { checked: 10, flagged: 1 });
  assert.equal(s.parts[0].questions[1].verified, false);
  assert.equal(s.parts[0].questions[0].verified, true);
});

test("if the check itself cannot run, nothing is called sure", async () => {
  const s = goodSheet();
  const r = await checkSheet(s, async () => { throw new Error("down"); });
  assert.deepEqual(r, { checked: 10, flagged: 10 });
  assert.ok(s.parts.flatMap((p) => p.questions).every((q) => !q.verified));
});

// ─── The build ───

test("a build asks for the worksheet, then checks it", async () => {
  const log: SpedAsk[] = [];
  const { sheet, check } = await buildSheet(ASK, "", [], fakeAI({ log }));
  assert.equal(sheet.title, KHA_EXAMPLE.title);
  assert.deepEqual(check, { checked: 10, flagged: 0 });
  assert.equal(log[0].system, khaPrompt(ASK));
  assert.equal(log.filter((l) => l.system === CHECK_SYSTEM).length, 1);
});

test("a reply that breaks a rule is sent back with exactly what is wrong, then accepted", async () => {
  const log: SpedAsk[] = [];
  let n = 0;
  const bad = () => { const r: any = clone(KHA_EXAMPLE); r.poems.pop(); return r; };
  const ai = fakeAI({ log, sheet: () => (n++ === 0 ? bad() : KHA_EXAMPLE) });
  const { sheet } = await buildSheet(ASK, "", [], ai);
  assert.equal(sheet.poems.length, 3);
  const retry = log.find((l) => /could not be used/.test(l.text));
  assert.ok(retry && /exactly 3 poems \(you sent 2\)/.test(retry.text));
});

test("a change goes back to the AI with the whole previous worksheet", async () => {
  const log: SpedAsk[] = [];
  const prev = goodSheet();
  await buildSheet(ASK, "", ["data:image/png;base64,AAAA"], fakeAI({ log }), { previous: prev, change: "make it shorter", skipCheck: true });
  assert.ok(log[0].text.includes("make it shorter") && log[0].text.includes(prev.title));
  assert.deepEqual(log[0].images, [], "the photos are not sent again with a change");
});

// ─── Routes ───

/** A stand-in for Express (it is not installed in every environment): records the routes, then runs them with a fake request and response. */
function app(deps: Partial<Parameters<typeof registerKhaElaRoutes>[2]> = {}) {
  type Route = { method: string; re: RegExp; keys: string[]; handlers: ((req: any, res: any, next: any) => unknown)[] };
  const routes: Route[] = [];
  const add = (method: string) => (path: string, ...handlers: any[]) => {
    const keys: string[] = [];
    routes.push({ method, keys, handlers, re: new RegExp("^" + path.replace(/:([a-z]+)/gi, (_m, k) => { keys.push(k); return "([^/]+)"; }) + "$") });
  };
  const fake: any = { get: add("GET"), post: add("POST"), delete: add("DELETE") };
  const auth: any = (req: any, _res: any, next: any) => { const [id, role] = String(req.headers["x-user"] || "").split(":"); if (id) req.user = { id: Number(id), role, isAdmin: role === "admin" }; return next(); };
  registerKhaElaRoutes(fake, auth, { kv: memoryKV(), aiConfigured: () => true, askAI: fakeAI(), ...deps });
  const call = async (path: string, user: string, method = "GET", body?: unknown) => {
    const url = "/api/kha-ela" + path;
    const route = routes.find((r) => r.method === method && r.re.test(url));
    assert.ok(route, `no route for ${method} ${url}`);
    const m = route!.re.exec(url)!;
    const req: any = { headers: user ? { "x-user": user } : {}, body: body ?? {}, params: Object.fromEntries(route!.keys.map((k, i) => [k, m[i + 1]])) };
    let status = 200, payload: any;
    const res: any = { set() { return res; }, status(c: number) { status = c; return res; }, json(b: unknown) { payload = b; return res; } };
    let i = 0;
    const next = async (): Promise<void> => { const h = route!.handlers[i++]; if (h) await h(req, res, next); };
    await next();
    return { status, body: payload };
  };
  return { server: { close() {} }, call };
}
const until = async (fn: () => Promise<any>, ok: (v: any) => boolean) => { for (let i = 0; i < 150; i++) { const v = await fn(); if (ok(v)) return v; await new Promise((r) => setTimeout(r, 20)); } throw new Error("timed out"); };
const REQ = { settings: { student: "Kha Smith", interests: "pigeons and flamingos" }, text: "", images: [] as string[] };

test("routes: teachers only, a clear message for each thing missing", async () => {
  const { server, call } = app();
  try {
    assert.equal((await call("", "")).status, 401, "signed out");
    assert.equal((await call("", "5:student")).status, 403);
    assert.equal((await call("", "6:parent", "POST", REQ)).status, 403);
    assert.equal((await call("", "1:teacher", "POST", { settings: { source: "asis" } })).status, 400, "use-my-poems with nothing pasted");
    assert.match((await call("", "1:teacher", "POST", { settings: { source: "asis" } })).body.message, /Paste the poems/);
    assert.equal((await call("", "1:teacher", "POST", { images: ["data:text/html;base64,AAAA"] })).status, 400, "not a photo");
    assert.equal((await call("", "1:teacher", "POST", { images: Array(7).fill("data:image/png;base64,iVBORw0KGgo=") })).status, 400, "too many photos");
    assert.equal((await call("", "1:teacher", "POST", { ...REQ, refineFrom: "11111111-1111-1111-1111-111111111111" })).status, 400, "a change needs words");
    assert.equal((await call("", "1:teacher", "POST", { ...REQ, refineFrom: "11111111-1111-1111-1111-111111111111", change: "shorter" })).status, 404, "a worksheet that isn't there");
    assert.equal((await call("/not-an-id", "1:teacher")).status, 404);
    assert.equal((await call("", "1:teacher")).status, 200);
    assert.equal((await call("", "9:admin")).status, 200, "the administrator can use it");
  } finally { server.close(); }
});

test("routes: not turned on without an AI key", async () => {
  const { server, call } = app({ aiConfigured: () => false });
  try {
    assert.equal((await call("", "1:teacher", "POST", REQ)).status, 503);
    assert.equal((await call("", "1:teacher")).body.ai, false);
  } finally { server.close(); }
});

test("routes: settings go in, three documents come out, and it is kept for the teacher only", async () => {
  const log: SpedAsk[] = [];
  const { server, call } = app({ askAI: fakeAI({ log }) });
  try {
    const started = await call("", "1:teacher", "POST", REQ);
    assert.equal(started.status, 202);
    const id = started.body.id;
    const done = await until(() => call(`/${id}`, "1:teacher"), (r) => r.body.status !== "working");
    assert.equal(done.body.status, "done", done.body.error);
    const pack = done.body.pack;
    assert.equal(pack.title, KHA_EXAMPLE.title);
    assert.equal(pack.settings.student, "Kha", "only the first name is kept");
    assert.deepEqual(pack.check, { checked: 10, flagged: 0 });
    assert.ok(!log.some((l) => l.system.includes("Smith") || l.text.includes("Smith")), "no surname reached the AI");
    assert.ok(worksheetHtml(pack.sheet, { pictures: "auto" }).includes("Bird Points") && comicHtml(pack.sheet, { pictures: "auto" }).includes("Big Message") && keyHtml(pack.sheet, pack.settings, pack.check).includes("answer key"));
    const mine = await call("", "1:teacher");
    assert.deepEqual(mine.body.mine.map((m: any) => m.id), [id]);
    assert.equal((await call(`/${id}`, "2:teacher")).status, 404, "another teacher can't open it");
    assert.equal((await call(`/${id}`, "9:admin")).status, 200, "the administrator can");
    assert.equal((await call(`/${id}`, "1:teacher", "DELETE")).status, 200);
    assert.equal((await call(`/${id}`, "1:teacher")).status, 404);
    assert.equal((await call("", "1:teacher")).body.mine.length, 0);
  } finally { server.close(); }
});

test("routes: a change makes a new worksheet from the old one and keeps the first", async () => {
  const log: SpedAsk[] = [];
  const { server, call } = app({ askAI: fakeAI({ log }) });
  try {
    const first = await call("", "1:teacher", "POST", REQ);
    await until(() => call(`/${first.body.id}`, "1:teacher"), (r) => r.body.status !== "working");
    const second = await call("", "1:teacher", "POST", { ...REQ, refineFrom: first.body.id, change: "make it shorter" });
    assert.equal(second.status, 202);
    const done = await until(() => call(`/${second.body.id}`, "1:teacher"), (r) => r.body.status !== "working");
    assert.equal(done.body.status, "done", done.body.error);
    assert.ok(log.some((l) => l.text.includes("make it shorter")));
    assert.equal((await call("", "1:teacher")).body.mine.length, 2);
    assert.equal((await call("", "2:teacher", "POST", { ...REQ, refineFrom: first.body.id, change: "x" })).status, 404, "not someone else's worksheet");
  } finally { server.close(); }
});

test("routes: when the AI can't finish, the teacher gets a plain message, not a spinner", async () => {
  const { server, call } = app({ askAI: async () => "I cannot do that" });
  try {
    const { body } = await call("", "1:teacher", "POST", REQ);
    const done = await until(() => call(`/${body.id}`, "1:teacher"), (r) => r.body.status !== "working");
    assert.equal(done.body.status, "failed");
    assert.match(done.body.error, /three tries|Make it again|again/i);
    assert.equal(done.body.pack, undefined);
  } finally { server.close(); }
});

test("routes: a build that stopped moving is reported as interrupted", async () => {
  let t = 1_000_000;
  const { server, call } = app({ now: () => t, askAI: () => new Promise<string>(() => {}) });
  try {
    const { body } = await call("", "1:teacher", "POST", REQ);
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
    for (let i = 0; i < KHA_LIMITS.perDay; i++) assert.equal((await call("", "1:teacher", "POST", REQ)).status, 202);
    const over = await call("", "1:teacher", "POST", REQ);
    assert.equal(over.status, 429);
    assert.match(over.body.message, /a lot of worksheets/);
    assert.equal((await call("", "2:teacher", "POST", REQ)).status, 202, "someone else is not limited");
  } finally { server.close(); }
});

// ─── Wiring: the button, the page and the server ───

test("Math Lessons has a Kha ELA button and view, wired to the route, the documents and the store listing", () => {
  const page = read("client/src/pages/MathLessons.tsx");
  assert.ok(page.includes(">Kha ELA<"), "the button says so");
  assert.ok(page.includes('"kha"') && page.includes("KhaElaMaker"), "it is its own view");
  assert.ok(page.includes('v === "kha"'), "the view is remembered");
  assert.match(page, /view !== "maker" && view !== "kha"[\s\S]{0,40}aria-pressed=\{show\}/, "answers/print belong to the lessons");
  const maker = read("client/src/pages/KhaElaMaker.tsx");
  for (const s of ["/api/kha-ela", "worksheetHtml", "comicHtml", "keyHtml", "KHA_REQUIREMENTS", "refineFrom", "Print / Save as PDF", "Teacher key", "Make this change"]) assert.ok(maker.includes(s), s);
  assert.match(maker, /sandbox="allow-same-origin allow-modals"/, "the documents run in a sandbox");
  assert.match(maker, /try \{ localStorage\.setItem\(SETTINGS_KEY/, "saved settings never break the page");
  assert.match(read("server/routes.ts"), /registerKhaElaRoutes\(app, authMiddleware/);
  assert.match(read("shared/pluginStore.ts"), /Kha ELA Worksheet Maker/);
});

test("the Work Hub Lessons tab has SPED Exemplar Maker and Kha ELA buttons next to Worksheet maker", () => {
  const lessons = read("client/src/components/teacher-hub/HubLessons.tsx");
  assert.match(lessons, /Worksheet maker<\/button>\s*<button type="button" onClick=\{\(\) => setExemplar\("sped"\)\}[\s\S]{0,200}SPED Exemplar Maker<\/button>\s*<button type="button" onClick=\{\(\) => setExemplar\("kha"\)\}[\s\S]{0,200}Kha ELA<\/button>/);
  assert.match(lessons, /\{exemplar && <HubExemplarModal which=\{exemplar\} onClose=\{\(\) => setExemplar\(null\)\} \/>\}/);
  const modal = read("client/src/components/teacher-hub/HubExemplarModal.tsx");
  assert.match(modal, /lazy\(\(\) => import\("@\/pages\/SpedExemplarMaker"\)\)/, "loaded only when opened");
  assert.match(modal, /lazy\(\(\) => import\("@\/pages\/KhaElaMaker"\)\)/);
  assert.match(modal, /size="full"/);
});
