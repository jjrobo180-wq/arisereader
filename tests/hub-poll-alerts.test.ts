// Run with: npx tsx --test tests/hub-poll-alerts.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { pollReplies } from "../shared/hubPollAlerts";

const polls = [{
  id: "p1", title: "IEP for Sam", status: "open" as const, options: [{ id: "a", label: "Tue 3:30" }, { id: "b", label: "Wed 8:15" }],
  invitees: [
    { id: "i1", name: "Ms. Lee", answers: { a: "yes", b: "no" } as any, comment: "Mornings are hard.", respondedAt: "2026-10-08T15:00:00Z" },
    { id: "i2", name: "Coach", answers: {}, comment: "", respondedAt: null },
    { id: "i3", name: "Old", answers: { b: "yes" } as any, comment: "", respondedAt: "2026-09-01T15:00:00Z" },
  ],
}];

test("replies are newest first, recent only, and unread after the last time the bell was opened", () => {
  const now = Date.parse("2026-10-08T18:00:00Z");
  const all = pollReplies(polls, 0, now);
  assert.equal(all.length, 1);
  assert.deepEqual(all[0].works, ["Tue 3:30"]);
  assert.equal(all[0].unread, true);
  assert.equal(pollReplies(polls, Date.parse("2026-10-08T16:00:00Z"), now)[0].unread, false);
});
