// Arise All Access (shared/allAccess.ts): one $10 plan for Arise To Duo, Arise Fit, Arise Notes and Pod+.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ALL_ACCESS_AI_PER_MONTH, ALL_ACCESS_AUDIO_MINUTES, ALL_ACCESS_MONTHLY_CENTS, ALL_ACCESS_SPEAKER_MINUTES, accessMonth, aiLeft, cleanAccessUsage, podEpisodeMinutes, speakerMinutesLeft } from "../shared/allAccess";
import { PLAN_KINDS, isAddonKind, priceOf, todoUnlimitedFor, type PlanGrant } from "../shared/plans";
import { NOTES_PLANS, allows } from "../shared/ariseNotes";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const now = Date.parse("2026-11-08T12:00:00Z");

test("the plan: $10 a month, one person, 1,000 AI requests and 20 audio hours (2 with speaker names)", () => {
  assert.equal(ALL_ACCESS_MONTHLY_CENTS, 1000);
  assert.ok(PLAN_KINDS.includes("all_access"));
  assert.ok(isAddonKind("all_access"));
  assert.deepEqual({ cents: priceOf("all_access").cents, interval: priceOf("all_access").interval, seats: priceOf("all_access").seats(5) }, { cents: 1000, interval: "month", seats: 1 });
  assert.equal(ALL_ACCESS_AI_PER_MONTH, 1000);
  assert.equal(ALL_ACCESS_AUDIO_MINUTES, 1200);
  assert.equal(ALL_ACCESS_SPEAKER_MINUTES, 120);
});

test("this month's use: empty in a new month, and what's left", () => {
  assert.equal(accessMonth(now), "2026-11");
  const fresh = cleanAccessUsage({ month: "2026-10", ai: 900, speakerSecs: 7200, podEpisodes: ["a"] }, now);
  assert.deepEqual(fresh, { month: "2026-11", ai: 0, speakerSecs: 0, podEpisodes: [] });
  const u = cleanAccessUsage({ month: "2026-11", ai: 990, speakerSecs: 3600, podEpisodes: ["a", 5, "b"] }, now);
  assert.equal(aiLeft(u), 10);
  assert.equal(speakerMinutesLeft(u), 60);
  assert.deepEqual(u.podEpisodes, ["a", "b"]);
  assert.equal(aiLeft(cleanAccessUsage({ month: "2026-11", ai: 5000 }, now)), 0);
});

test("a new Pod+ episode counts for its length (at most 3 hours; 45 minutes when it isn't known)", () => {
  assert.equal(podEpisodeMinutes(1800), 30);
  assert.equal(podEpisodeMinutes(61), 2);
  assert.equal(podEpisodeMinutes(6 * 3600), 180);
  assert.equal(podEpisodeMinutes(undefined), 45);
  assert.equal(podEpisodeMinutes("x"), 45);
});

test("All Access unlocks Arise To Duo Unlimited (and a lapsed one doesn't)", () => {
  const person = { id: 7, role: "parent", username: "pat" } as any;
  const grant = (endsAt: string, status: PlanGrant["status"] = "active"): PlanGrant => ({ kind: "all_access", ownerId: 7, source: "stripe", status, seats: 1, endsAt, updatedAt: "2026-11-01T00:00:00Z" } as PlanGrant);
  assert.deepEqual(todoUnlimitedFor(person, { allAccess: grant("2026-12-01T00:00:00Z") }, now), { unlimited: true, via: "all-access", endsAt: "2026-12-01T00:00:00Z" });
  assert.equal(todoUnlimitedFor(person, { allAccess: grant("2026-11-01T00:00:00Z", "canceled") }, now).unlimited, false);
  assert.equal(todoUnlimitedFor(person, {}, now).unlimited, false);
});

test("Arise Notes on All Access: 20 hours, speaker names and IEP mode, no rollover", () => {
  assert.equal(NOTES_PLANS.access.minutes, 1200);
  assert.equal(allows("access", "speakers"), true);
  assert.equal(allows("access", "iep"), true);
  assert.equal(allows("access", "rollover"), false);
  assert.equal(allows("access", "ask"), true);
});

test("the server: Fit+, Notes and Duo accept it; AI is counted in one place; Pod+ ad-free needs it", () => {
  const plans = read("server/plans.ts");
  assert.match(plans, /app\.post\("\/api\/all-access\/checkout"/);
  assert.match(plans, /\/\/ All Access includes Fit\+ \(and its guest pass\)\./);
  assert.match(plans, /plan: "access", product: null, grant: all/);
  assert.match(plans, /if \(allAccess\) \{ await countAccess\(user\.id, \{ ai: 1 \}\); return; \}/);
  const routes = read("server/routes.ts");
  assert.match(routes, /"\/api\/fit\/recipe", "\/api\/fit\/menu", "\/api\/fit\/ask", "\/api\/fit\/identify"/);
  assert.match(routes, /app\.get\("\/api\/all-access\/status"/);
  const play = read("server/podcastPlay.ts");
  assert.match(play, /code: "all_access_needed"/);
  const clean = read("server/podcastClean.ts");
  assert.match(clean, /return res\.json\(\{ ready: false, plan: "all_access" \}\)/);
});
