import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildActivity, activityWords, activityDayLabel, type AcctTask, type Checkin } from "../shared/accountability";

const task = (o: Partial<AcctTask>): AcctTask => ({ id: "t1", spaceId: "s", title: "Take out the trash", notes: "", kind: "task", assignee: 2, createdBy: 1, repeat: { every: "daily" } as any, due: "18:00", nag: 30, proof: "none", review: true, worksheet: null, quiz: null, archived: false, createdAt: "2026-11-16T15:00:00.000Z", ...o });
const check = (o: Partial<Checkin>): Checkin => ({ id: "c1", taskId: "t1", spaceId: "s", day: "2026-11-17", by: 2, at: "2026-11-17T17:00:00.000Z", status: "done", note: "", proof: [], answers: {}, score: null, feedback: "", reviewedBy: null, reviewedAt: null, ...o });
const names = (id: number) => (id === 1 ? "You" : "Maria");

test("Activity shows asks, check-ins, approvals, misses and reminders, newest first", () => {
  const items = buildActivity([task({})], [check({ status: "approved", reviewedBy: 1, reviewedAt: "2026-11-17T18:00:00.000Z" })],
    [{ taskId: "t1", day: "2026-11-18", kind: "missed", at: "2026-11-19T01:05:00.000Z" }, { taskId: "t1", day: "2026-11-18", kind: "nudged", at: "2026-11-19T01:30:00.000Z", n: 3 }], "UTC");
  assert.deepEqual(items.map((x) => x.kind), ["nudged", "missed", "approved", "did", "asked"]);
  assert.equal(activityWords(items[4], names), "You asked Maria to take out the trash");
  assert.equal(activityWords(items[2], names), "You approved “Take out the trash”");
  assert.equal(activityWords(items[0], names), "Maria was reminded about “Take out the trash” 3 times");
});

test("done after the deadline reads as late, and a miss that was then done isn't shown as missed", () => {
  const items = buildActivity([task({})], [check({ day: "2026-11-18", at: "2026-11-18T19:30:00.000Z" })], [{ taskId: "t1", day: "2026-11-18", kind: "missed", at: "2026-11-18T18:05:00.000Z" }], "UTC");
  assert.deepEqual(items.map((x) => x.kind), ["late", "asked"]);
});

test("check-ins on a removed task stay in Activity by name; asking yourself isn't news", () => {
  const items = buildActivity([task({ id: "t2", assignee: 1 })], [check({ taskId: "gone1" })], [], "UTC", [{ id: "gone1", title: "Old chore" }]);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Old chore");
  assert.equal(items[0].gone, true);
});

test("day labels", () => {
  assert.equal(activityDayLabel("2026-11-18", "2026-11-18"), "Today");
  assert.equal(activityDayLabel("2026-11-17", "2026-11-18"), "Yesterday");
  assert.equal(activityDayLabel("2026-11-12", "2026-11-18"), "Thu, Nov 12");
});

test("the server sends reminders, missed deadlines and removed-task names; the app asks in the page, not with pop-ups", () => {
  const server = readFileSync(new URL("../server/accountability.ts", import.meta.url), "utf8");
  assert.ok(server.includes("events, gone"));
  const app = readFileSync(new URL("../client/src/components/family-hub/Accountability.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(app, /window\.confirm\(/);
  assert.ok(app.includes("buildActivity(") && app.includes('data-testid="acct-remove"'));
});
