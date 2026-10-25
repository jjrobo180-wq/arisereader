// When one free AI allowance runs out, the next model answers (server/podcastDirectory.ts onGroq).
import test from "node:test";
import assert from "node:assert/strict";
import { aiStrained, onGroq, retryAfter } from "../server/podcastDirectory";

test("reads how long until an allowance frees up", () => {
  assert.equal(retryAfter("Please try again in 7m46.5s. Need more tokens?"), 466_500);
  assert.equal(retryAfter("Please try again in 20.736s."), 60_000, "at least a minute");
  assert.equal(retryAfter("Please try again in 1h2m3s"), 3_723_000);
  assert.equal(retryAfter("no time given"), 600_000);
});

test("a used-up model is skipped for a while and the next one answers", async () => {
  const asked: string[] = [];
  const run = async (m: string) => { asked.push(m); if (m === "big") throw Object.assign(new Error("dry"), { retryMs: 60_000 }); return `answer from ${m}`; };
  assert.equal(await onGroq(["big", "small"], run), "answer from small");
  assert.equal(await onGroq(["big", "small"], run), "answer from small");
  assert.deepEqual(asked, ["big", "small", "small"], "the dry model isn't asked again right away");
  assert.ok(aiStrained(), "extras step aside after a model was turned away");
});

test("every model used up reads as busy; other errors pass straight through", async () => {
  await assert.rejects(onGroq(["a1", "a2"], async () => { throw Object.assign(new Error("dry"), { retryMs: 60_000 }); }), /busy/);
  await assert.rejects(onGroq(["b1", "b2"], async () => { throw new Error("groq ai 400"); }), /400/);
});
