import test from "node:test";
import assert from "node:assert/strict";
import { accidentFreeDays, ageMonths, blankChild, buildSchedule, cleanData, dayStats, dryNights, healthFlags, predict, rhythm, sitMinutes, stageChecks, youtubeId, type Entry } from "../shared/pro/potty/model";
import { proApp } from "../shared/pro/apps";

const at = (day: string, hh: number, mm = 0) => { const [y, m, d] = day.split("-").map(Number); return new Date(y, m - 1, d, hh, mm).getTime(); };
let n = 0;
const E = (day: string, hh: number, mm: number, kind: Entry["kind"], extra: Partial<Entry> = {}): Entry => ({ id: `e${n++}`, kid: "k", at: at(day, hh, mm), kind, ...extra });
const kid = () => ({ ...blankChild("k"), name: "Ari", birth: "2024-01" });

test("old (v1) saved data moves forward without losing logs, stickers or the child", () => {
  const v1 = { kids: [{ id: "k", name: "Ari", avatar: "👧", goal: 10, prize: "Book", method: "timed", start: "2026-10-01", interval: 60, tryStickers: true }], cur: "k", logs: [{ id: "a", kid: "k", at: 1, kind: "pee" }, { id: "b", kid: "k", at: 2, kind: "bogus" }], stickers: [{ id: "s", kid: "k", s: "⭐", at: 1 }], prizes: [], ready: { k: ["dry2h"] }, plan: {}, timer: null, voice: true };
  const d = cleanData(v1);
  assert.equal(d.v, 2); assert.equal(d.kids[0].name, "Ari"); assert.equal(d.kids[0].method, "scheduled"); assert.equal(d.kids[0].stage, "launch");
  assert.equal(d.logs.length, 1, "unknown kinds are dropped"); assert.equal(d.stickers.length, 1); assert.deepEqual(d.ready.k, ["dry2h"]);
  assert.ok(d.kids[0].routine.meals.length > 0);
  assert.deepEqual(cleanData(null).kids, []);
});

test("day stats: successes, accidents, who started the trip, drinks", () => {
  const day = "2026-10-10";
  const logs = [E(day, 8, 0, "pee", { init: "self" }), E(day, 10, 0, "acc-pee"), E(day, 12, 0, "both", { init: "prompted" }), E(day, 13, 0, "try"), E(day, 9, 0, "drink", { ml: 180 }), E(day, 7, 30, "food", { size: "meal" })];
  const s = dayStats(logs, "k", day);
  assert.deepEqual([s.successes, s.accidents, s.self, s.prompted, s.tries, s.drinksMl, s.meals], [2, 1, 1, 1, 1, 180, 1]);
  assert.equal(Math.round(s.rate! * 100), 67); assert.equal(s.selfRate, 0.5);
  assert.equal(s.pees, 3, "pee events include accidents"); assert.equal(s.poops, 1);
});

test("streaks: accident-free days and dry nights", () => {
  const logs = [E("2026-10-08", 9, 0, "acc-pee"), E("2026-10-09", 9, 0, "pee"), E("2026-10-10", 9, 0, "pee"), E("2026-10-11", 9, 0, "pee"), E("2026-10-09", 6, 0, "night-wet"), E("2026-10-10", 6, 0, "night-dry"), E("2026-10-11", 6, 0, "night-dry")];
  assert.equal(accidentFreeDays(logs, "k", at("2026-10-11", 20)), 3);
  assert.equal(accidentFreeDays(logs, "k", at("2026-10-12", 7)), 3, "a fresh morning doesn't break the streak");
  assert.equal(dryNights(logs, "k"), 2);
});

test("rhythm learns pee gaps, drink-to-pee and meal-to-poop timing, diaper poops included", () => {
  const logs: Entry[] = [];
  for (const day of ["2026-10-08", "2026-10-09", "2026-10-10"]) {
    for (const h of [8, 9.5, 11, 12.5]) logs.push(E(day, Math.floor(h), (h % 1) * 60, "pee"));
    logs.push(E(day, 7, 30, "food", { size: "meal" }), E(day, 7, 55, "diaper-dirty"));
    logs.push(E(day, 10, 0, "drink", { ml: 200 }), E(day, 10, 50, "acc-pee"), E(day, 13, 0, "drink", { ml: 200 }), E(day, 13, 50, "acc-pee"));
  }
  const r = rhythm(logs, "k", at("2026-10-10", 20));
  assert.ok(r.peeGap! >= 40 && r.peeGap! <= 90, `pee gap ${r.peeGap}`);
  assert.equal(r.mealToPoop, 25); assert.equal(r.drinkToPee, 50);
  assert.equal(r.poopsPerDay, 1); assert.deepEqual(r.poopHours, [7]);
});

test("predictions: pee after the usual gap, brought forward by a drink; poop 15–30 min after a meal", () => {
  const day = "2026-10-12"; const child = kid();
  const logs = [E(day, 8, 0, "pee")];
  const p = predict(logs, child, at(day, 8, 30)).find((w) => w.kind === "pee")!;
  assert.equal(new Date(p.center).getHours() * 60 + new Date(p.center).getMinutes(), 9 * 60 + 30, "toddler default 90 min");
  assert.equal(p.confidence, "learning");
  const withDrink = predict([...logs, E(day, 8, 20, "drink", { ml: 240 })], child, at(day, 8, 30)).find((w) => w.kind === "pee")!;
  assert.ok(withDrink.center < p.center, "a big drink brings it forward");
  const poop = predict([...logs, E(day, 8, 25, "food", { size: "meal" })], child, at(day, 8, 30)).find((w) => w.kind === "poop")!;
  assert.equal(new Date(poop.from).getMinutes(), 40); assert.equal(new Date(poop.to).getMinutes(), 55);
  assert.equal(predict(logs, child, at(day, 22, 0)).length, 0, "nothing predicted while asleep");
});

test("health flags for very frequent pees, no poop for days, and hard or painful poops", () => {
  const day = "2026-10-12"; const logs: Entry[] = [];
  for (let i = 0; i < 8; i++) logs.push(E(day, 8, i * 40 % 60 === 0 ? 0 : 40, "pee"));
  const many = Array.from({ length: 8 }, (_, i) => E(day, 8 + Math.floor((i * 40) / 60), (i * 40) % 60, "pee"));
  assert.ok(healthFlags(many, "k", at(day, 20)).some((f) => f.level === "doctor" && /once an hour/.test(f.title)));
  const old = [E("2026-10-08", 9, 0, "poop", { bristol: 1 }), E("2026-10-07", 9, 0, "poop", { bristol: 2, pain: true })];
  const f = healthFlags(old, "k", at(day, 9));
  assert.ok(f.some((x) => /No poop logged for 4 days/.test(x.title)));
  assert.ok(f.some((x) => x.title === "Hard poops")); assert.ok(f.some((x) => x.title === "Painful poops"));
});

test("stage checks read the log", () => {
  const now = at("2026-10-12", 20); const logs: Entry[] = [];
  for (const d of ["2026-10-10", "2026-10-11", "2026-10-12"]) { for (let i = 0; i < 9; i++) logs.push(E(d, 8 + i, 0, "pee", { init: i < 5 ? "self" : "prompted" })); logs.push(E(d, 18, 0, "acc-pee")); }
  assert.ok(stageChecks("habit", logs, "k", 0, now).every((c) => c.met));
  assert.ok(stageChecks("self", logs, "k", 0, now).every((c) => c.met));
  assert.equal(stageChecks("ready", logs, "k", 5, now)[0].met, false);
  assert.equal(stageChecks("nights", logs, "k", 0, now)[0].met, false);
});

test("schedule: wake sit, sits 20 min after meals, nap sits, drinks stop an hour before bed, last potty", () => {
  const c = { ...kid(), stage: "habit" as const };
  const s = buildSchedule(c, { months: 30, interval: 90, day: 6 });
  const at = (t: string) => s.filter((x) => x.time === t);
  assert.ok(at("07:05").some((x) => x.kind === "sit"));
  assert.ok(at("07:50").some((x) => x.kind === "sit" && /breakfast/.test(x.label)));
  assert.ok(at("12:40").some((x) => /before nap/.test(x.label)) && at("14:30").some((x) => /waking/.test(x.label)));
  assert.ok(at("19:15").some((x) => /Last potty/.test(x.label)));
  assert.ok(!s.some((x) => x.kind === "drink" && x.time > "18:30"), "no drinks in the last hour");
  assert.ok(s.some((x) => x.kind === "prompt"));
  const late = buildSchedule({ ...c, stage: "self" }, { months: 30, day: 6 });
  assert.ok(!late.some((x) => x.kind === "prompt"), "prompts fade once the child leads");
  assert.ok(buildSchedule({ ...c, stage: "launch" }, { months: 30, interval: 90, day: 6 }).filter((x) => x.kind === "prompt").length > s.filter((x) => x.kind === "prompt").length);
});

test("ages, sit length, YouTube ids, app listing", () => {
  assert.equal(ageMonths("2024-01", new Date(2026, 9, 12).getTime()), 33);
  assert.equal(ageMonths("", 0), null);
  assert.equal(sitMinutes(30), 3); assert.equal(sitMinutes(200), 10); assert.equal(sitMinutes(12), 2);
  assert.equal(youtubeId("https://www.youtube.com/watch?v=_RQFMyof650&t=3"), "_RQFMyof650");
  assert.equal(youtubeId("https://youtu.be/O0nV7hJ9qzk"), "O0nV7hJ9qzk");
  assert.equal(youtubeId("https://youtube.com/shorts/jb3J1m7Hqz0"), "jb3J1m7Hqz0");
  assert.equal(youtubeId("not a video"), null);
  assert.equal(proApp("potty")?.group, "health");
});

import { ARTICLES, METHOD_LIST, NEEDS, RESOURCES, STAGES, STRATEGIES, VIDEOS, articleById, socialStory, strategyById, videoById, defaultVisual } from "../shared/pro/potty";
import { AI_TASKS } from "../shared/pro/aiTasks";

test("program content is complete and every link inside it points at something real", () => {
  assert.equal(STAGES.length, 10);
  for (const s of STAGES) {
    assert.ok(s.steps.length >= 3 && s.daily.length >= 1 && s.stuck.length >= 1, s.id);
    for (const a of s.articles) assert.ok(articleById(a), `${s.id} → article ${a}`);
    for (const v of s.videos) assert.ok(videoById(v), `${s.id} → video ${v}`);
    for (const x of s.strategies) assert.ok(strategyById(x), `${s.id} → strategy ${x}`);
  }
  for (const n of NEEDS) for (const v of n.videos) assert.ok(videoById(v), `${n.id} → video ${v}`);
  assert.ok(STRATEGIES.length >= 50 && new Set(STRATEGIES.map((s) => s.id)).size === STRATEGIES.length);
  assert.ok(ARTICLES.length >= 20 && new Set(ARTICLES.map((a) => a.id)).size === ARTICLES.length);
  assert.ok(VIDEOS.length >= 25 && VIDEOS.every((v) => (v.playlist ? /^PL[\w-]+$/.test(v.yt) : /^[\w-]{11}$/.test(v.yt))));
  assert.ok(RESOURCES.every((r) => r.url.startsWith("https://")));
  assert.equal(METHOD_LIST.length, 5); assert.equal(NEEDS.length, 11);
  assert.ok(defaultVisual().filter((s) => s.on).length >= 9);
  const story = socialStory({ name: "Ari", sex: "girl", words: { pee: "wee", poop: "poo", potty: "potty" } });
  assert.ok(story.pages.some((p) => p.text.includes("Wee and poo go in the potty")));
  for (const t of ["potty-coach", "potty-schedule", "potty-story"]) assert.ok(AI_TASKS[t], t);
});
