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
