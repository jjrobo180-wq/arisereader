import test from "node:test";
import assert from "node:assert/strict";
import { cleanAiSections } from "../server/iepAi";

test("only asked-for sections come back, in order, as plain bounded text", () => {
  const out = cleanAiSections({ sections: [{ id: "b", paragraphs: ["Two"], bullets: [] }, { id: "zzz", paragraphs: ["no"] }, { id: "a", paragraphs: ["One  \n x"], bullets: ["x", 5] }, { id: "c", paragraphs: [] }] }, ["a", "b", "c"]);
  assert.deepEqual(out.map((s) => s.id), ["a", "b"]);
  assert.equal(out[0].paragraphs[0], "One x");
  assert.deepEqual(out[0].bullets, ["x", "5"]);
});
test("garbage gives nothing", () => { assert.deepEqual(cleanAiSections("nope", ["a"]), []); });
