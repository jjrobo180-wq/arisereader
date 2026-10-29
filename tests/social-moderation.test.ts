// Pod+ / Earshot Social word filter (server/socialModeration.ts): App Review Guideline 1.2.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanReason, moderateText, normalizeForFilter, reportFiled, onSocialReport, textProblem } from "../server/socialModeration";

test("slurs, sexual words and threats are refused, spelled around or not", () => {
  for (const bad of ["you n1gger", "F A G", "send nudes pls", "go kys", "kill   yourself", "p.o.r.n link", "niggggga", "visit pornhub"]) {
    assert.ok(textProblem(bad), `should refuse: ${bad}`);
  }
});

test("ordinary words that contain a banned one inside them are fine", () => {
  for (const ok of ["Great class today", "Scunthorpe United", "assessment results", "raccoon facts", "spicy take", "cocktail hour", "summa cum laude", "This episode on true crime was intense", ""]) {
    assert.equal(textProblem(ok), null, `should allow: ${ok}`);
  }
});

test("normalizing reads leetspeak and repeated letters", () => {
  assert.equal(normalizeForFilter("h3ll0000"), "helloo");
  assert.equal(normalizeForFilter("s.h.i.t"), "shit");
});

test("moderateText refuses from the built-in list with no key, allows clean text", async () => {
  const saved = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY;
  try {
    assert.equal((await moderateText("love this show")).ok, true);
    assert.equal((await moderateText("you are a f@ggot")).ok, false);
  } finally { if (saved !== undefined) process.env.OPENAI_API_KEY = saved; }
});

test("reports reach the listener and a bad reason becomes Something else", () => {
  const got: string[] = [];
  onSocialReport((r) => got.push(`${r.what}:${r.id}:${r.reason}`));
  reportFiled({ app: "Pod+", what: "post", id: "5", by: "d1", reason: cleanReason("Spam") });
  reportFiled({ app: "Pod+", what: "profile", id: "x", by: "d1", reason: cleanReason("nonsense") });
  assert.deepEqual(got, ["post:5:Spam", "profile:x:Something else"]);
});
