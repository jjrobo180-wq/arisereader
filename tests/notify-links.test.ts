// Every tapped notification opens the exact place it's about (shared/notifyLinks.ts): a meal's reminder on that
// meal's food log, a to-do on that to-do, a habit, routine, chore, pill, bill or event on that one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { billLink, checkinLink, eventLink, healthLink, pillLink, readNotifyLink, taskLink } from "../shared/notifyLinks";
import { dueDailyReminders } from "../shared/dailyCheckins";
import { readLink } from "../shared/fitLinks";

const B = "/#/lifehub";

test("a meal check-in opens Health & Fitness on that meal's food log", () => {
  const url = checkinLink(B, "cooked:dinner");
  assert.equal(url, "/#/lifehub?go=cooked&page=food&do=log-dinner");
  assert.deepEqual(readNotifyLink(url), { go: "cooked", task: undefined, focus: undefined, log: undefined, who: undefined, date: undefined, action: "log-dinner", view: undefined });
  // Health & Fitness understands it (shared/fitLinks.ts).
  assert.equal(readLink(url).action, "log-dinner");
  for (const m of ["breakfast", "lunch", "snack"]) assert.equal(readLink(checkinLink(B, `cooked:${m}`)).action, `log-${m}`);
});

test("the other check-ins open what they're about", () => {
  assert.equal(readLink(checkinLink(B, "cooked:workout")).action, "train");
  assert.equal(readLink(checkinLink(B, "cooked:weight")).action, "weigh-in");
  assert.equal(readLink(checkinLink(B, "cooked:sleep")).action, "sleep");
  assert.equal(readLink(checkinLink(B, "cooked:stretch")).action, "stretch");
  assert.equal(readLink(checkinLink(B, "cooked:fast")).action, "fast");
  assert.equal(checkinLink(B, "habit:h1"), "/#/lifehub?go=habits&focus=habit%3Ah1");
  assert.equal(checkinLink(B, "routine:r1"), "/#/lifehub?go=routines&focus=routine%3Ar1");
  assert.equal(checkinLink(B, "chore:c1"), "/#/lifehub?go=chores&focus=chore%3Ac1");
  assert.equal(checkinLink(B, "acct:t9"), "/#/lifehub?go=accountability&task=t9");
  assert.equal(readNotifyLink(checkinLink(B, "custom:x1"))!.focus, "checkin:custom:x1");
});

test("to-dos, events, pills, bills and the Food & fitness logs", () => {
  assert.equal(readNotifyLink(taskLink(B, "t1"))!.task, "t1");
  const e = readNotifyLink(eventLink(B, "e1", "2026-11-28"))!;
  assert.equal(e.go, "calendar"); assert.equal(e.date, "2026-11-28"); assert.equal(e.focus, "event:e1");
  assert.equal(readNotifyLink(pillLink(B, "p1"))!.focus, "pill:p1");
  assert.equal(readNotifyLink(billLink(B, "b1"))!.focus, "bill:b1");
  const h = readNotifyLink(healthLink(B, "dinner", "kid1"))!;
  assert.equal(h.go, "health"); assert.equal(h.log, "dinner"); assert.equal(h.who, "kid1");
  assert.equal(readNotifyLink("/#/lifehub"), null);
});

test("each daily reminder carries its own link", () => {
  const plan = [{ id: "cooked:dinner", title: "Log your dinner", body: "", time: "18:30", section: "tasks" }, { id: "habit:h1", title: "Read", body: "", time: "18:30", section: "tasks" }] as any;
  const out = dueDailyReminders(plan, { date: "2026-11-27", minutes: 18 * 60 + 31, sent: {}, keyPrefix: "todo:daily:", url: `${B}?go=tasks&view=today`, link: (id) => checkinLink(B, id), followUps: 0, every: 60, window: 30 });
  assert.deepEqual(out.map((r) => r.url), ["/#/lifehub?go=cooked&page=food&do=log-dinner", "/#/lifehub?go=habits&focus=habit%3Ah1"]);
  // Without a link function, the old shared link still works.
  assert.equal(dueDailyReminders(plan, { date: "2026-11-27", minutes: 18 * 60 + 31, sent: {}, keyPrefix: "x:", url: "/x", followUps: 0, every: 60, window: 30 })[0].url, "/x");
});
