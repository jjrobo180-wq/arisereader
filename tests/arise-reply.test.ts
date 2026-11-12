import test from "node:test";
import assert from "node:assert/strict";
import { WAIT, answerHtml, clearStale, deleteReply, failReply, finishReply, mergeReply, parseAtArise, replyIds, waitingBlock } from "../shared/ariseReply";

test("parseAtArise needs @arise and a request", () => {
  assert.equal(parseAtArise("@arise summarize this"), "summarize this");
  assert.equal(parseAtArise("  @Arise: make a list"), "make a list");
  assert.equal(parseAtArise("@arise"), null);
  assert.equal(parseAtArise("hello @arise do it"), null);
  assert.equal(parseAtArise("@ariseful thing"), null);
});

const done = (id: string, lines: string[]) => finishReply(`<p>a</p>${waitingBlock(id, "q <1>")}<p>b</p>`, id, answerHtml(lines));

test("finishing keeps the prompt and the answer together", () => {
  const h = done("abc123", ["one", "two"]);
  assert.ok(h.includes('data-arise="abc123"') && !h.includes(WAIT + "abc123"));
  assert.ok(h.includes("q &lt;1&gt;") && h.includes("<li>one</li>"));
  assert.deepEqual(replyIds(h), ["abc123"]);
});

test("merge keeps only the answer", () => {
  const h = mergeReply(done("abc123", ["one", "two"]), "abc123");
  assert.equal(h, "<p>a</p><ul><li>one</li><li>two</li></ul><p>b</p>");
});

test("delete removes prompt and answer", () => {
  assert.equal(deleteReply(done("abc123", ["x"]), "abc123"), "<p>a</p><p>b</p>");
});

test("failed or stale waiting blocks go back to the typed line", () => {
  const w = `<p>a</p>${waitingBlock("zzz999", "do it")}`;
  assert.equal(failReply(w, "zzz999"), "<p>a</p><p>@arise do it</p>");
  assert.equal(clearStale(w, new Set()), "<p>a</p><p>@arise do it</p>");
  assert.equal(clearStale(w, new Set(["zzz999"])), w);
});
