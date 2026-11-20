import test from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { groupByLevel, levelInstruction, levelKindFor, parseLevel } from "../shared/levelWorksheets";
import { pdfToText } from "../server/pdfText";
import { googleExportUrl } from "../server/pageText";

test("levels typed or picked are read as grades", () => {
  assert.equal(parseLevel("3"), "3");
  assert.equal(parseLevel("3rd grade"), "3");
  assert.equal(parseLevel("gr 2.5"), "2");
  assert.equal(parseLevel("Kindergarten"), "K");
  assert.equal(parseLevel("pre-k"), "Pre-K");
  assert.equal(parseLevel("DRA 18"), "");
  assert.equal(parseLevel(""), "");
});

test("students are grouped by their level for the subject, easiest first", () => {
  const groups = groupByLevel([{ name: "A", mathLevel: "3" }, { name: "B", mathLevel: "K" }, { name: "C", grade: "7" }, { name: "D", mathLevel: "3" }, { name: "E" }], "math");
  assert.deepEqual(groups, [{ level: "K", students: ["B"] }, { level: "3", students: ["A", "D"] }, { level: "7", students: ["C"] }, { level: "", students: ["E"] }]);
  assert.equal(levelKindFor("Math"), "math");
  assert.equal(levelKindFor("Reading"), "reading");
  assert.match(levelInstruction("3", "reading", "7"), /Grade 3 reading level/);
  assert.equal(levelInstruction("", "math", "7"), "on grade level");
});

test("a PDF's words are read, letters placed one at a time included", () => {
  const content = "BT /F1 12 Tf 1 0 0 1 72 700 Tm (Hello) Tj 4 0 Td (!) Tj 0 -14 Td [(Second) -300 (line)] TJ ET";
  const stream = deflateSync(Buffer.from(content, "latin1"));
  const parts = [
    "%PDF-1.4\n",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj\n",
    `4 0 obj << /Length ${stream.length} /Filter /FlateDecode >> stream\n`,
  ];
  const pdf = Buffer.concat([Buffer.from(parts.join(""), "latin1"), stream, Buffer.from("\nendstream endobj\n5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n%%EOF", "latin1")]);
  assert.equal(pdfToText(pdf), "Hello!\nSecond line");
});

test("Google Docs, Slides and Sheets links become their text exports", () => {
  const id = "1LKmcpL6J6NQzcAB8eHP1M25AsHJzFQdodSHCX1GJJ9U";
  assert.equal(googleExportUrl(`https://docs.google.com/document/d/${id}/edit?tab=t.0`), `https://docs.google.com/document/d/${id}/export?format=txt`);
  assert.equal(googleExportUrl(`https://docs.google.com/presentation/d/${id}/edit`), `https://docs.google.com/presentation/d/${id}/export/txt`);
  assert.equal(googleExportUrl(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=42`), `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=42`);
  assert.equal(googleExportUrl("https://example.com/page"), "https://example.com/page");
});

test("Modify for students keeps the original's questions and asks for the student's level", async () => {
  const { cleanAsk, lessonPrompt, readAnswer } = await import("../server/lessonPlanner");
  const a = cleanAsk({ mode: "modify", subject: "ELA", grade: "3", level: levelInstruction("3", "reading", "7") });
  assert.equal(a.mode, "modify");
  const p = lessonPrompt(a, "EXAMPLE from the teacher's PDF:\n1. Write a body paragraph with two pieces of evidence.");
  assert.match(p.system, /EXACTLY the same number of questions, in the SAME order/);
  assert.match(p.system, /Never write a grade, a level/);
  assert.match(p.user, /Grade 3 reading level/);
  assert.match(p.user, /two pieces of evidence/);
  assert.ok(p.maxTokens <= 6000, "small enough for the free AI's per-minute allowance");
  const ws = readAnswer("modify", JSON.stringify({ title: "Body paragraphs", instructions: "", sections: [{ heading: "Write", directions: "", items: [{ kind: "short", prompt: "Write one sentence.", answer: "A sentence.", lines: 2 }] }] }));
  assert.equal(ws.worksheet.title, "Body paragraphs");
});

test("student copies print one strip per question with the student's name, and no grade", async () => {
  const { cutSheetsHtml } = await import("../client/src/lib/lessonExport");
  const ws = { title: "Essay Practice (Grade 2)", instructions: "", grade: "2", subject: "ELA", sections: [
    { heading: "Evidence", directions: "Circle Yes or No.", items: [
      { kind: "choice", prompt: "Use this fact?", choices: ["Yes", "No"], answer: "Yes" },
      { kind: "short", prompt: "Why? I think this helps because ___.", answer: "It shows they win.", lines: 2 },
    ] },
  ] } as any;
  const html = cutSheetsHtml([{ ws, level: "Grade 2", students: ["Amani Quintana", "Kha Nguyen"] }]);
  assert.equal((html.match(/class="cut strip"/g) || []).length, 4);
  assert.match(html, /Amani Quintana[\s\S]*Question 1[\s\S]*Question 2/);
  assert.doesNotMatch(html, /Grade 2/);
  const whole = cutSheetsHtml([{ ws, level: "Grade 2", students: ["Amani Quintana"] }], { strips: false });
  assert.equal((whole.match(/class="cut strip"/g) || []).length, 0);
});
