// Cooked: workout buddies matched with a stranger.
import test from "node:test";
import assert from "node:assert/strict";
import { emptyFit } from "../shared/fit";
import { AVATARS, PRESETS, adultCheck, bestMatch, buddyRecord, cleanPrefs, makeTag, matchScore, weekStart, weeklyCounts, type BuddyProfile } from "../shared/fitBuddy";
import { createBuddies } from "../server/fitBuddy";
import { createMemoryKv } from "../server/fitKv";

const prof = (o: Partial<BuddyProfile> = {}): BuddyProfile => ({ tag: "A", avatar: "🦊", focus: "strength", level: 2, perWeek: 3, mode: "coop", tz: 0, at: 0, ...o });
const adult = { ...emptyFit(), profile: { ...emptyFit().profile, birthYear: 1990 } };
const minor = { ...emptyFit(), profile: { ...emptyFit().profile, birthYear: new Date().getFullYear() - 15 } };

function setup(data: Record<number, any>) {
  const sent: { to: number; body: string }[] = [];
  const b = createBuddies({ kv: createMemoryKv(), getData: async (id) => data[id] ?? null, notify: async (to, m) => { sent.push({ to, body: m.body }); } });
  return { b, sent };
}

test("only presets exist, and cleaning input keeps it to the allowed choices", () => {
  assert.ok(PRESETS.length >= 8);
  const p = cleanPrefs({ avatar: "<script>", focus: "x", level: 99, perWeek: 50, mode: "?", tz: 99999 });
  assert.ok(AVATARS.includes(p.avatar)); assert.equal(p.level, 3); assert.equal(p.perWeek, 7); assert.equal(p.mode, "coop"); assert.equal(p.tz, 840);
  assert.match(makeTag(), /^[A-Z][a-z]+[A-Z][a-z]+\d\d$/);
});

test("18 and over only", () => {
  assert.equal(adultCheck(undefined).ok, false);
  assert.equal(adultCheck({ birthYear: new Date().getFullYear() - 17 }).ok, false);
  assert.equal(adultCheck({ birthYear: 1990 }).ok, true);
});

test("matching prefers similar goals and never pairs far-apart time zones", () => {
  const me = prof();
  assert.ok(matchScore(me, prof({ perWeek: 3 }))! > matchScore(me, prof({ perWeek: 6, focus: "cardio" }))!);
  assert.equal(matchScore(me, prof({ tz: 600 })), null);
  assert.equal(bestMatch(me, [{ id: 1, p: prof({ tz: 600 }) }]), null);
  assert.equal(bestMatch(me, [{ id: 1, p: prof({ perWeek: 6 }) }, { id: 2, p: prof() }])?.id, 2);
});

test("weeks and records", () => {
  const mon = Date.parse("2026-11-02T12:00:00Z");
  assert.equal(new Date(weekStart(mon)).getUTCDay(), 1);
  const ws = [{ date: "2026-11-02T10:00:00Z", exercises: [{}] }, { date: "2026-10-27T10:00:00Z", exercises: [{}] }, { date: "2026-10-28T10:00:00Z", exercises: [{}] }] as any;
  const c = weeklyCounts(ws, mon, 3);
  assert.deepEqual(c, [0, 2, 1]);
  assert.equal(buddyRecord([3, 3, 1], [3, 4, 2], { perWeek: 3, mode: "coop" }).streak, 2);
  assert.deepEqual(buddyRecord([3, 1, 0], [1, 1, 0], { perWeek: 3, mode: "duel" }), { streak: 0, won: 1, lost: 0, tied: 1 });
});

test("two strangers match, talk in presets, set a goal, and part", async () => {
  const { b, sent } = setup({ 1: adult, 2: adult });
  const prefs = { avatar: "🦊", focus: "strength", level: 2, perWeek: 3, mode: "coop", tz: 0 };
  assert.equal((await b.join(1, prefs) as any).status, "searching");
  assert.equal((await b.join(2, { ...prefs, avatar: "🐺" }) as any).status, "matched");
  assert.equal((await b.view(1) as any).status, "matched");
  assert.ok(sent.some((s) => s.to === 1));
  assert.deepEqual(await b.send(1, "gg"), { ok: true });
  assert.equal(((await b.view(2)) as any).inbox[0].kind, "gg");
  assert.equal((await b.send(1, "hello there") as any).error, 404);
  await b.goal(1, { perWeek: 5, mode: "duel" });
  assert.equal(((await b.view(2)) as any).proposal.perWeek, 5);
  assert.equal(((await b.view(1)) as any).proposal.mine, true);
  assert.equal((await b.accept(1) as any).error, 404);
  const v = await b.accept(2) as any;
  assert.deepEqual(v.goal, { perWeek: 5, mode: "duel" });
  await b.leave(1);
  assert.equal(((await b.view(2)) as any).status, "none");
});

test("minors can't join, and a report ends it and blocks a rematch", async () => {
  const { b } = setup({ 1: adult, 2: adult, 3: minor });
  const prefs = { focus: "strength", level: 2, perWeek: 3, mode: "coop", tz: 0 };
  assert.equal((await b.join(3, prefs) as any).error, 403);
  await b.join(1, prefs); await b.join(2, prefs);
  await b.report(1, "inappropriate");
  assert.equal(((await b.view(1)) as any).status, "none");
  assert.equal(((await b.join(1, prefs)) as any).status, "searching");
  assert.equal(((await b.join(2, prefs)) as any).status, "searching");
});
