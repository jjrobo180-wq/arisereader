import test from "node:test";
import assert from "node:assert/strict";
import { buildFeed, cardId, cleanMindset, findCard, growth, logTime, mindBadges, mindStreak, newMindset, poolFor, today, totals, type MindProfile } from "../shared/mindset";
import { ADVICE, AFFIRMATIONS, BIBLE_STORIES, CHALLENGES, LESSONS, LIFE_STORIES, PROMPTS, QUOTES, VERSES } from "../shared/mindsetContent";
import { cleanFamily, emptyFamily } from "../shared/familyHub";

const profile = (p: Partial<MindProfile> = {}): MindProfile => ({ name: "Sam", goals: ["discipline", "calm"], season: "okay", faith: "none", bible: false, tone: "mix", kinds: ["quote", "advice", "affirmation", "prompt", "challenge", "lesson", "story", "breathe", "verse"], minutes: 30, why: "", startedAt: "2026-11-01", ...p });

test("there's a lot to read, and every id is unique", () => {
  const all = [...QUOTES, ...VERSES, ...ADVICE, ...AFFIRMATIONS, ...PROMPTS, ...CHALLENGES, ...LESSONS].map((x) => x.id);
  assert.ok(all.length >= 600, `only ${all.length}`);
  assert.equal(new Set(all).size, all.length);
  assert.ok(BIBLE_STORIES.length >= 25 && LIFE_STORIES.length >= 8);
  assert.equal(new Set(QUOTES.map((q) => q.text)).size, QUOTES.length);
});

test("no Bible content unless the person asked for it", () => {
  const off = poolFor(profile());
  assert.ok(!off.some((c) => c.kind === "verse" || c.topics.includes("faith")));
  assert.ok(!off.some((c) => c.kind === "story" && (c.item as any).faith));
  const on = poolFor(profile({ faith: "christian", bible: true }));
  assert.ok(on.some((c) => c.kind === "verse") && on.some((c) => c.kind === "story" && (c.item as any).faith));
  assert.equal(today(newMindset(profile()), "2026-11-27").verse, null);
  assert.ok(today(newMindset(profile({ bible: true })), "2026-11-27").verse);
});

test("the feed favors the person's goals, mixes kinds and tells stories in order", () => {
  const m = newMindset(profile({ goals: ["money"], kinds: ["quote", "advice", "story", "lesson", "affirmation"] }));
  const feed = buildFeed(m, { count: 80, seed: 42 });
  assert.ok(feed.length >= 80);
  const topical = feed.filter((c) => "item" in c && (c.item as any).topics?.includes("money")).length;
  assert.ok(topical >= 8, `money cards: ${topical}`);
  for (let i = 2; i < feed.length; i++) {
    if (feed[i].kind === "story") continue;
    assert.ok(!(feed[i].kind === feed[i - 1].kind && feed[i].kind === feed[i - 2].kind && feed[i - 1].kind !== "story"), `three ${feed[i].kind} in a row at ${i}`);
  }
  const story = feed.findIndex((c) => c.kind === "story");
  if (story >= 0) { const s = feed[story] as any; for (let p = 0; p <= s.item.body.length; p++) assert.equal((feed[story + p] as any).part, p); }
  assert.deepEqual(buildFeed(m, { count: 10, seed: 7 }).map((c) => c.key), buildFeed(m, { count: 10, seed: 7 }).map((c) => c.key));
});

test("seen cards are skipped and liked ones can be found again", () => {
  const m = newMindset(profile({ kinds: ["quote"] }));
  const first = buildFeed(m, { count: 20, seed: 1 }).map(cardId).filter(Boolean);
  const again = buildFeed({ ...m, seen: first }, { count: 20, seed: 2 }).map(cardId);
  assert.ok(!again.some((id) => first.includes(id)));
  assert.equal((findCard(first[0]) as any).item.id, first[0]);
  assert.equal((findCard("s:david-goliath") as any).item.title, "David and Goliath");
});

test("time, streaks, growth and badges", () => {
  let m = newMindset(profile());
  m = logTime(m, "2026-11-25", 600, 30);
  m = logTime(m, "2026-11-26", 120, 5);
  m = logTime(m, "2026-11-27", 30, 2);
  assert.deepEqual(mindStreak(m, "2026-11-27"), { days: 2, today: false, best: 2 });
  m = logTime(m, "2026-11-27", 60, 2, 3);
  assert.equal(mindStreak(m, "2026-11-27").days, 3);
  assert.equal(totals(m).minutes, 14);
  assert.equal(totals(m).affirm, 3);
  assert.equal(growth(m).level, 1);
  const b = mindBadges(m, "2026-11-27");
  assert.equal(b.find((x) => x.id === "streak3")?.earned, true);
  assert.equal(b.find((x) => x.id === "goal1")?.earned, false);
});

test("mindset is kept on the family and cleaned", () => {
  const raw = { ...emptyFamily(), mindset: { profile: { ...profile(), goals: ["calm", "nonsense"], minutes: 9999 }, likes: ["q1", 5], dreams: [{ id: "d", title: "Japan", color: "red", steps: [{ id: "s", text: "Passport", done: true }] }], days: [{ date: "2026-11-27", secs: 90, cards: 3 }] } };
  const f = cleanFamily(raw);
  assert.deepEqual(f.mindset?.profile.goals, ["calm"]);
  assert.equal(f.mindset?.profile.minutes, 600);
  assert.deepEqual(f.mindset?.likes, ["q1"]);
  assert.equal(f.mindset?.dreams[0].color, "#7c5cff");
  assert.equal(f.mindset?.dreams[0].steps[0].done, true);
  assert.equal(cleanFamily(emptyFamily()).mindset, undefined);
});

test("Mindset and Chores are offered in the LifeHub plugin store", async () => {
  const { pluginsFor } = await import("../shared/pluginStore");
  for (const teacher of [false, true]) {
    const ids = pluginsFor("life", { teacher }).map((p) => p.id);
    assert.ok(ids.includes("life-mindset"), "Mindset missing");
    assert.ok(ids.includes("life-chores"), "Chores missing");
  }
});
