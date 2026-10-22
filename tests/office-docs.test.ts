// Arise Docs: safe HTML, word counts and Word (.docx) files in and out.
// Run with: npx tsx --test tests/office-docs.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { blankDoc, cleanDoc, readDocx, sanitizeHtml, wordCount, writeDocx } from "../shared/office/docModel";

test("only safe HTML is kept", () => {
  assert.equal(sanitizeHtml('<p onclick="x()">Hi <script>alert(1)</script><b>there</b></p>'), "<p>Hi <b>there</b></p>");
  assert.equal(sanitizeHtml('<a href="javascript:alert(1)">x</a>'), '<a target="_blank" rel="noopener noreferrer">x</a>');
  assert.equal(sanitizeHtml('<span style="color: red; position: fixed; background: url(x)">a</span>'), '<span style="color: red">a</span>');
  assert.equal(sanitizeHtml("<p>a < b"), "<p>a &lt; b</p>");
  assert.equal(sanitizeHtml('<img src="https://e.com/a.png" onerror="x">'), '<img src="https://e.com/a.png">');
  assert.equal(sanitizeHtml('<img src="javascript:x">'), "");
});

test("old plain-text docs open, word counts", () => {
  assert.equal(cleanDoc({ text: "Hello\nWorld <3" }).html, "<p>Hello</p><p>World &lt;3</p>");
  assert.equal(wordCount("<h1>Title</h1><p>One two, three.</p>").words, 4);
});

test("Word files round trip", async () => {
  const doc = blankDoc('<h1>Field trip</h1><p style="text-align: center">Dear <strong>families</strong>, <em>see</em> <a href="https://example.com">this</a>.</p><ul><li>Lunch</li><li>Water<ul><li>Bottle</li></ul></li></ul><ol><li>First</li></ol><table><tr><th>Day</th><th>Time</th></tr><tr><td>Mon</td><td>9:00</td></tr></table><p><span style="color: #dc2626; font-size: 14pt">Red</span></p>');
  doc.header = "<p>Room 12</p>"; doc.pageNumbers = true; doc.page.landscape = true;
  const back = await readDocx(writeDocx(doc, "Trip"));
  assert.match(back.html, /<h1>Field trip<\/h1>/);
  assert.match(back.html, /<p style="text-align: center">Dear <strong>families<\/strong>, <em>see<\/em> <a href="https:\/\/example.com"[^>]*>this<\/a>/);
  assert.match(back.html, /<ul><li>Lunch<\/li><li>Water<\/li><ul><li>Bottle<\/li><\/ul><\/ul><ol><li>First<\/li><\/ol>/);
  assert.match(back.html, /<td[^>]*><strong>Day<\/strong><\/td>/);
  assert.match(back.html, /color: #DC2626; font-size: 14pt/);
  assert.equal(back.page.landscape, true);
});
