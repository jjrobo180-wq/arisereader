// Google Docs edited on the site a paragraph at a time (shared/googleDocText.ts): reading a doc's paragraphs,
// and the edits that change, remove or add one without touching the rest of the doc.
import test from "node:test";
import assert from "node:assert/strict";
import { addAfterRequests, docParagraphs, projectNumberOf, replaceParaRequests } from "../shared/googleDocText";

const doc = { body: { content: [
  { endIndex: 1, sectionBreak: {} },
  { startIndex: 1, endIndex: 11, paragraph: { paragraphStyle: { namedStyleType: "HEADING_1" }, elements: [{ textRun: { content: "Our plans\n" } }] } },
  { startIndex: 11, endIndex: 23, paragraph: { bullet: { listId: "x" }, paragraphStyle: { namedStyleType: "NORMAL_TEXT" }, elements: [{ textRun: { content: "Buy " } }, { textRun: { content: "paint\n" } }] } },
  { startIndex: 23, endIndex: 40, table: {} },
  { startIndex: 40, endIndex: 42, paragraph: { elements: [{ inlineObjectElement: {} }, { textRun: { content: "\n" } }] } },
  { startIndex: 42, endIndex: 48, paragraph: { elements: [{ textRun: { content: "Done.\n" } }] } },
] } };

test("a doc's paragraphs: words, headings, bullets, tables and pictures", () => {
  const p = docParagraphs(doc);
  assert.equal(p.length, 5);
  assert.deepEqual(p[0], { start: 1, end: 11, text: "Our plans", style: "h1", bullet: false });
  assert.equal(p[1].text, "Buy paint");
  assert.equal(p[1].bullet, true);
  assert.equal(p[2].other, "table");
  assert.equal(p[3].other, "picture");
  assert.equal(p[4].text, "Done.");
  assert.equal(docParagraphs({}).length, 0);
});

test("changing a paragraph replaces only its words, keeping its line break", () => {
  assert.deepEqual(replaceParaRequests({ start: 11, end: 23 }, "Buy blue paint", false), [
    { deleteContentRange: { range: { startIndex: 11, endIndex: 22 } } },
    { insertText: { location: { index: 11 }, text: "Buy blue paint" } },
  ]);
  // An empty line gets words without deleting anything.
  assert.deepEqual(replaceParaRequests({ start: 5, end: 6 }, "Hi\n", false), [{ insertText: { location: { index: 5 }, text: "Hi" } }]);
});

test("removing a paragraph takes its line break too, except the doc's last", () => {
  assert.deepEqual(replaceParaRequests({ start: 11, end: 23 }, "", false), [{ deleteContentRange: { range: { startIndex: 11, endIndex: 23 } } }]);
  assert.deepEqual(replaceParaRequests({ start: 42, end: 48 }, "  \n", true), [{ deleteContentRange: { range: { startIndex: 42, endIndex: 47 } } }]);
});

test("adding a plain paragraph under one", () => {
  assert.deepEqual(addAfterRequests({ end: 11 }, " Call Sam "), [
    { insertText: { location: { index: 10 }, text: "\nCall Sam" } },
    { updateParagraphStyle: { range: { startIndex: 11, endIndex: 19 }, paragraphStyle: { namedStyleType: "NORMAL_TEXT" }, fields: "namedStyleType" } },
  ]);
  assert.deepEqual(addAfterRequests({ end: 11 }, "  "), []);
});

test("the picker's project number comes from the OAuth client id", () => {
  assert.equal(projectNumberOf("123456789012-abc123.apps.googleusercontent.com"), "123456789012");
  assert.equal(projectNumberOf("nope"), "");
});
