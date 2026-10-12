// Run with: npx tsx --test tests/arise-math-learn.test.ts
// Lesson videos and "Snap a problem" (photo help that teaches without giving the answer).
import test from "node:test";
import assert from "node:assert/strict";
import { SKILL_IDS } from "../shared/ariseMath";
import { VIDEO_TOPICS, SKILL_VIDEO_TOPIC, videosFor, moreVideosUrl } from "../shared/ariseMathVideos";
import { answerMatches, answerNumber, cleanTutorReply, normalizeAnswer, PHOTO_LIMITS, tutorPrompt } from "../shared/ariseMathPhoto";
import { registerMathPhotoRoutes } from "../server/ariseMathPhoto";

test("every skill has at least one lesson video, and every video id looks like a YouTube id", () => {
  for (const id of SKILL_IDS) assert.ok(videosFor(id).length >= 1, `${id} has a video`);
  for (const id of Object.keys(SKILL_VIDEO_TOPIC)) assert.ok((SKILL_IDS as readonly string[]).includes(id), `${id} is a real skill`);
  for (const [topic, list] of Object.entries(VIDEO_TOPICS)) {
    assert.ok(list.length >= 1 && list.length <= 3, `${topic} has 1–3 videos`);
    for (const v of list) {
      assert.match(v.id, /^[A-Za-z0-9_-]{11}$/, `${topic}: ${v.id}`);
      assert.ok(v.title && v.by, `${topic}: ${v.id} has a title and channel`);
    }
  }
  assert.deepEqual(videosFor("custom"), []);
  assert.match(moreVideosUrl("Add within 20"), /^https:\/\/www\.youtube\.com\/results\?search_query=/);
});

test("answers match however the student writes them", () => {
  assert.equal(normalizeAnswer(" x = −4 "), "-4");
  assert.equal(answerNumber("3/4"), 0.75);
  assert.equal(answerNumber("1 1/2"), 1.5);
  assert.equal(answerNumber("24 ft"), 24);
  assert.equal(answerNumber("1,000"), 1000);
  assert.ok(answerMatches("0.75", ["3/4"]));
  assert.ok(answerMatches("x=3/4", ["0.75"]));
  assert.ok(answerMatches("−12", ["-12"]));
  assert.ok(answerMatches("$4.50", ["4.5"]));
  assert.ok(answerMatches("3, 2", ["x = 2 or x = 3"]));
  assert.ok(answerMatches("2 and 3", ["2, 3"]));
  assert.ok(!answerMatches("2", ["2, 3"]));
  assert.ok(!answerMatches("13", ["12"]));
  assert.ok(!answerMatches("", ["12"]));
  assert.ok(answerMatches("Acute", ["acute"]));
});

const goodAI = {
  problem: "3x + 5 = 20", topic: "Two-step equations", skill: "eq2", bigIdea: "Undo things in reverse order.",
  steps: [
    { title: "Undo the + 5", explain: "Subtract 5 from both sides.", ask: "What is 20 − 5?", check: "15", hint: "Count back 5 from 20." },
    { title: "Undo the × 3", explain: "Now 3x = 15. Divide both sides by 3. So the answer is 5.", ask: "What is 15 ÷ 3?", check: "5", hint: "" },
  ],
  finish: "Divide 15 by 3 to find x.", answerForm: "x = ?", answer: "5", accept: ["5", "x=5"],
  examples: [
    { problem: "2x + 1 = 9", steps: [{ title: "Subtract 1", work: "2x = 8" }, { title: "Divide by 2", work: "x = 4" }], answer: "x = 4" },
    { problem: "4x − 3 = 13", steps: [{ title: "Add 3", work: "4x = 16" }], answer: "x = 4" },
    { problem: "broken", steps: [], answer: "" },
  ],
  videoSearch: "two step equations",
};

test("the AI's reply is cleaned, and no step gives away the final answer", () => {
  const r = cleanTutorReply(goodAI, SKILL_IDS);
  assert.ok(!("notMath" in r));
  if ("notMath" in r) return;
  assert.deepEqual(r.accept, ["5", "x=5"]);
  assert.equal(r.reply.skill, "eq2");
  assert.equal(r.reply.steps.length, 2);
  assert.equal(r.reply.steps[0].check, "15");
  // The second step's check IS the answer, so it is removed, and the sentence announcing it is dropped.
  assert.equal(r.reply.steps[1].check, "");
  assert.equal(r.reply.steps[1].ask, "");
  assert.ok(!/answer is 5/.test(r.reply.steps[1].explain), r.reply.steps[1].explain);
  assert.ok(/Divide both sides by 3/.test(r.reply.steps[1].explain));
  assert.equal(r.reply.examples.length, 2, "an example with no steps is dropped");
  assert.ok(!JSON.stringify(r.reply).includes('"answer":"5"'), "the reply never carries the answer");
  assert.equal((r.reply as any).accept, undefined);

  const unknown = cleanTutorReply({ ...goodAI, skill: "not-a-skill" }, SKILL_IDS);
  assert.ok("reply" in unknown && unknown.reply.skill === null, "an unknown skill id is dropped");
  assert.ok("notMath" in cleanTutorReply({ notMath: "That's a cat. Send a math problem!" }, SKILL_IDS));
  assert.ok("notMath" in cleanTutorReply({ problem: "2 + 2" }, SKILL_IDS), "no answer means we can't check it");
  assert.ok("notMath" in cleanTutorReply(null, SKILL_IDS));
});

test("the prompt asks for steps without the answer and lists the skills", () => {
  const p = tutorPrompt([{ id: "eq2", name: "Two-step equations" }], "7");
  assert.match(p, /WITHOUT telling them the final answer/);
  assert.match(p, /grade 7/);
  assert.match(p, /eq2: Two-step equations/);
});

function photoSetup(reply: unknown = goodAI) {
  const routes: Record<string, Function> = {};
  const app: any = { post: (path: string, ...h: Function[]) => { routes[`POST ${path}`] = h[h.length - 1]; } };
  let clock = Date.parse("2026-10-11T18:00:00Z");
  const asks: any[] = [];
  registerMathPhotoRoutes(app, ((_q: any, _s: any, n: any) => n()) as any, {
    aiConfigured: () => true, now: () => clock, gradeOf: async () => "7",
    askAI: async (a) => { asks.push(a); return typeof reply === "string" ? reply : JSON.stringify(reply); },
  });
  const call = async (path: string, userId: number, body: any, params: any = {}) => {
    let status = 200, out: any = null;
    const res: any = { set() {}, status(c: number) { status = c; return res; }, json(b: any) { out = b; return res; } };
    await routes[`POST ${path}`]({ user: { id: userId, role: "student" }, body, params }, res);
    return { status, body: out };
  };
  return { call, asks, tick: (ms: number) => { clock += ms; } };
}

const IMG = "data:image/jpeg;base64," + "A".repeat(200);

test("snap a problem: help comes back without the answer, and the student checks their own", async () => {
  const { call, asks, tick } = photoSetup();
  assert.equal((await call("/api/math/photo-help", 11, {})).status, 400);
  assert.equal((await call("/api/math/photo-help", 11, { image: "data:text/html;base64,AAAA" })).status, 400);

  const r = await call("/api/math/photo-help", 11, { image: IMG });
  assert.equal(r.status, 200);
  assert.equal(asks[0].image, IMG);
  assert.match(asks[0].system, /grade 7/);
  assert.ok(r.body.id && r.body.steps.length === 2);
  assert.ok(!("accept" in r.body) && !("answer" in r.body));

  const check = (who: number, answer: string) => call("/api/math/photo-help/:id/check", who, { answer }, { id: r.body.id });
  assert.equal((await check(12, "5")).status, 404, "another student can't check this problem");
  assert.equal((await check(11, "6")).body.right, false);
  assert.equal((await check(11, "x = 5")).body.right, true);
  assert.equal((await check(11, "anything")).body.right, true, "once solved it stays solved");

  // Typed problems work too.
  const t = await call("/api/math/photo-help", 11, { text: "3x + 5 = 20" });
  assert.equal(t.status, 200);
  assert.match(asks[1].text, /typed this problem: 3x \+ 5 = 20/);
  assert.equal(asks[1].image, null);

  // Guessing is limited.
  for (let i = 0; i < PHOTO_LIMITS.checksPerProblem; i++) await call("/api/math/photo-help/:id/check", 11, { answer: String(100 + i) }, { id: t.body.id });
  assert.equal((await call("/api/math/photo-help/:id/check", 11, { answer: "5" }, { id: t.body.id })).status, 429);

  // Problems expire.
  tick(PHOTO_LIMITS.keepMs + 1000);
  assert.equal((await check(11, "5")).status, 404);
});

test("snap a problem: not math, bad AI replies, and the daily limit", async () => {
  const cat = photoSetup({ notMath: "That looks like a cat! Send one math problem." });
  const r = await cat.call("/api/math/photo-help", 11, { image: IMG });
  assert.equal(r.status, 200);
  assert.match(r.body.notMath, /cat/);

  const junk = photoSetup("not json at all");
  assert.ok((await junk.call("/api/math/photo-help", 11, { text: "help" })).body.notMath);

  const busy = photoSetup();
  for (let i = 0; i < PHOTO_LIMITS.perDay; i++) assert.equal((await busy.call("/api/math/photo-help", 14, { text: "1 + 1" })).status, 200);
  assert.equal((await busy.call("/api/math/photo-help", 14, { text: "1 + 1" })).status, 429);
  assert.equal((await busy.call("/api/math/photo-help", 15, { text: "1 + 1" })).status, 200, "the limit is per person");
});
