import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAN_OPENS, builtinPlan, busyClash, busyFromEvents, cleanBusy, cleanLifePlan, cleanPlanRequest, duePlanReminders, markReminder, planFromAi, planUserMessage, snoozeReminder, todayItems, toMinutes, weekScore, type LifePlan,
} from "../shared/lifePlan";
import { cleanFamily, isOn, FAMILY_SECTIONS } from "../shared/familyHub";
import { dueTodoReminders } from "../shared/todoReminders";
import { pluginsFor } from "../shared/pluginStore";
import { registerLifePlanRoutes } from "../server/lifePlan";

const SUNDAY = "2026-10-18"; // a Sunday
const MONDAY = "2026-10-19";
const req = cleanPlanRequest({ vision: "Closer to God, healthier, calmer", focuses: ["faith", "eat", "sleep"], wake: "06:30", bed: "22:00", workDays: [1, 2, 3, 4, 5] });

test("the built-in planner always makes a usable plan, inside waking hours, with reasons", () => {
  const plan = builtinPlan(req, "2026-10-18T12:00:00.000Z");
  assert.equal(plan.madeBy, "builtin");
  assert.ok(plan.reminders.length >= 6);
  assert.equal(plan.pillars.length, 3);
  assert.match(plan.summary, /66 days/);
  for (const r of plan.reminders) {
    const m = toMinutes(r.time)!;
    assert.ok(m >= toMinutes("06:30")! && m <= toMinutes("22:00")!, `${r.title} at ${r.time}`);
    assert.ok(r.why.length > 20, `${r.title} has a reason`);
    if (r.opens) assert.ok(r.opens in PLAN_OPENS);
  }
  assert.ok(plan.reminders.some((r) => r.opens === "bible"));
  assert.ok(plan.reminders.some((r) => r.opens === "health"));
  // Nothing picked still gives a plan.
  assert.ok(builtinPlan(cleanPlanRequest({ vision: "be happier" })).reminders.length > 0);
});

test("the AI's answer is cleaned like saved data: bad times pulled into waking hours, unknown apps dropped, junk refused", () => {
  const ai = JSON.stringify({
    summary: "This is the life you're building: one with God at the center.\n\nSmall steps.",
    pillars: [{ area: "faith", title: "Morning with God", why: "Anchors the day." }, { area: "nonsense", title: "Rest", why: "x" }],
    reminders: [
      { title: "Read your Bible", emoji: "📖", time: "06:45", days: [0, 1, 2, 3, 4, 5, 6], area: "faith", why: "Cue-based habits stick.", opens: "bible" },
      { title: "Log lunch", emoji: "🥪", time: "12:30", days: [1, 2, 3, 4, 5], area: "food", why: "Awareness.", opens: "health" },
      { title: "Too early", time: "03:00", area: "sleep", opens: "hacker-page" },
      { title: "", time: "09:00" },
      { title: "Bad time", time: "25:99" },
    ],
  });
  const plan = planFromAi("```json\n" + ai + "\n```", req)!;
  assert.ok(plan);
  assert.equal(plan.madeBy, "ai");
  assert.equal(plan.reminders.length, 3);
  const early = plan.reminders.find((r) => r.title === "Too early")!;
  assert.equal(early.time, "06:30");
  assert.equal("opens" in early, false);
  assert.equal(plan.pillars[1].area, "mind");
  assert.equal(planFromAi("not json", req), null);
  assert.equal(planFromAi(JSON.stringify({ summary: "x", reminders: [{ title: "one", time: "08:00" }] }), req), null);
  assert.match(planUserMessage(req), /wake up around 06:30/);
  assert.match(planUserMessage(req), /Monday, Tuesday/);
});

test("today: done, skip, snooze and undo work, and snoozing moves only today's reminder", () => {
  let plan = builtinPlan(req);
  const first = todayItems(plan, MONDAY, 0)[0];
  assert.equal(first.state, "later");
  assert.equal(todayItems(plan, MONDAY, 23 * 60)[0].state, "due");
  plan = snoozeReminder(plan, first.id, MONDAY, 7 * 60, 30);
  const snoozed = todayItems(plan, MONDAY, 7 * 60 + 5).find((i) => i.id === first.id)!;
  assert.equal(snoozed.state, "snoozed");
  assert.equal(snoozed.at, 7 * 60 + 30);
  assert.equal(todayItems(plan, "2026-10-20", 0).find((i) => i.id === first.id)!.at, toMinutes(first.time)); // tomorrow is unchanged
  plan = markReminder(plan, first.id, MONDAY, "done");
  assert.equal(todayItems(plan, MONDAY, 600).find((i) => i.id === first.id)!.state, "done");
  assert.equal(plan.snoozed[first.id], undefined);
  plan = markReminder(plan, first.id, MONDAY, null);
  assert.notEqual(todayItems(plan, MONDAY, 600).find((i) => i.id === first.id)!.state, "done");
  assert.equal(snoozeReminder(plan, first.id, MONDAY, 1430, 60).snoozed[first.id].at, 1439);
  const w = weekScore(markReminder(plan, first.id, MONDAY, "done"), MONDAY);
  assert.ok(w.done === 1 && w.total > 1);
});

test("weekday-only reminders don't show on Sunday; switched-off ones never show", () => {
  const plan = cleanLifePlan({ vision: "x", summary: "y", reminders: [{ id: "a", title: "Work focus", time: "09:00", days: [1, 2, 3, 4, 5] }, { id: "b", title: "Off", time: "10:00", off: true }, { id: "c", title: "Daily", time: "11:00" }] })!;
  assert.deepEqual(todayItems(plan, SUNDAY, 0).map((i) => i.id), ["c"]);
  assert.deepEqual(todayItems(plan, MONDAY, 0).map((i) => i.id), ["a", "c"]);
});

test("phone reminders: sent at the time (or the snoozed time) once, not after done, not when off", () => {
  let plan = cleanLifePlan({ vision: "x", summary: "y", reminders: [{ id: "bible", title: "Read your Bible", emoji: "📖", time: "07:00", why: "Habits tied to a cue stick. More text." }] })!;
  assert.deepEqual(duePlanReminders(plan, MONDAY, 6 * 60 + 59, 45, "/#/lifehub"), []);
  const [push] = duePlanReminders(plan, MONDAY, 7 * 60 + 1, 45, "/#/lifehub");
  assert.equal(push.key, `todo:plan:bible:${MONDAY}:420`);
  assert.equal(push.url, "/#/lifehub?plan=bible");
  assert.match(push.title, /📖 Read your Bible/);
  assert.match(push.body, /Habits tied to a cue stick\./);
  assert.doesNotMatch(push.body, /More text/);
  assert.deepEqual(duePlanReminders(plan, MONDAY, 8 * 60, 45, "/#/lifehub"), []); // too late: stale
  const snoozed = snoozeReminder(plan, "bible", MONDAY, 7 * 60 + 5, 30);
  const [again] = duePlanReminders(snoozed, MONDAY, 7 * 60 + 36, 45, "/#/lifehub");
  assert.equal(again.key, `todo:plan:bible:${MONDAY}:455`); // a new key, so it is sent again
  assert.deepEqual(duePlanReminders(markReminder(plan, "bible", MONDAY, "done"), MONDAY, 7 * 60 + 1, 45, "/#/lifehub"), []);
  plan = { ...plan, on: false };
  assert.deepEqual(duePlanReminders(plan, MONDAY, 7 * 60 + 1, 45, "/#/lifehub"), []);
  assert.deepEqual(duePlanReminders(undefined, MONDAY, 600, 45, "/#/lifehub"), []);
});

test("the plan is saved with the family, and LifeHub sends its reminders only when the app is added", () => {
  const lifePlan: Partial<LifePlan> = { vision: "x", summary: "y", reminders: [{ id: "w", title: "Water", emoji: "💧", time: "10:00", days: [0, 1, 2, 3, 4, 5, 6], area: "food", why: "" }] };
  const added = cleanFamily({ sections: { lifeplan: true }, lifePlan });
  assert.equal(added.lifePlan?.reminders[0].title, "Water");
  assert.ok(isOn("lifeplan", added));
  assert.equal(isOn("lifeplan", cleanFamily({ lifePlan })), false);
  assert.equal(cleanFamily({}).lifePlan, undefined);
  assert.ok((FAMILY_SECTIONS as readonly string[]).includes("lifeplan"));
  // 10:05 UTC on a Monday, with quiet hours off.
  const now = Date.parse(`${MONDAY}T10:05:00Z`);
  const ws = (sections: Record<string, boolean>) => ({ family: { sections, lifePlan, notify: { quiet: { on: false } } }, tasks: [] });
  assert.ok(dueTodoReminders(ws({ lifeplan: true }), now, "UTC").some((r) => r.key.startsWith("todo:plan:w:")));
  assert.ok(!dueTodoReminders(ws({}), now, "UTC").some((r) => r.key.startsWith("todo:plan:")));
  assert.ok(!dueTodoReminders(ws({ lifeplan: true }), now, "UTC", { [`todo:plan:w:${MONDAY}:600`]: 1 }).some((r) => r.key.startsWith("todo:plan:")));
});

test("AI Reminders is in the LifeHub App Store", () => {
  const p = pluginsFor("life", { teacher: false }).find((x) => x.id === "life-lifeplan");
  assert.ok(p);
  assert.deepEqual(p!.target, { kind: "section", section: "lifeplan" });
});

test("the build route returns the AI's plan, and a clear error the app falls back from otherwise", async () => {
  const run = async (ask: (s: string, u: string) => Promise<string>, body: unknown, configured = true) => {
    const routes: Record<string, Function> = {};
    const app: any = { post: (path: string, ...h: Function[]) => { routes[path] = h[h.length - 1]; } };
    registerLifePlanRoutes(app, ((_q: any, _s: any, n: any) => n()) as any, ask, () => configured);
    let status = 200, out: any = null;
    const res: any = { status(c: number) { status = c; return res; }, json(b: any) { out = b; return res; }, set() { return res; } };
    await routes["/api/life-plan/build"]({ body, user: { id: Math.floor(Math.random() * 1e9) } }, res);
    return { status, body: out };
  };
  const good = JSON.stringify({ summary: "This is the life you're building.", pillars: [], reminders: [{ title: "A", time: "08:00" }, { title: "B", time: "09:00" }] });
  let seen = "";
  const ok = await run(async (system, user) => { seen = system + user; return good; }, req);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.plan.reminders.length, 2);
  assert.match(seen, /Never invent study names/);
  assert.equal((await run(async () => "garbage", req)).status, 502);
  assert.equal((await run(async () => { throw new Error("busy"); }, req)).status, 503);
  assert.equal((await run(async () => good, req, false)).body.code, "ai_off");
  assert.equal((await run(async () => good, {})).status, 400);
});

test("the week score only counts days since the plan started, and the overview never lowercases God", () => {
  const plan = cleanLifePlan({ vision: "x", summary: "y", createdAt: `${MONDAY}T08:00:00.000Z`, reminders: [{ id: "a", title: "Daily", time: "09:00" }] })!;
  assert.deepEqual(weekScore(markReminder(plan, "a", MONDAY, "done"), MONDAY), { done: 1, total: 1 });
  const s = builtinPlan(cleanPlanRequest({ focuses: ["faith"] })).summary;
  assert.match(s, /with God/);
  assert.doesNotMatch(s, /with god/);
});

test("works at 6 PM: nothing lands during the shift, family time moves before work, and AI answers are fixed too", () => {
  const busy = [{ label: "Work", from: "18:00", to: "23:00", days: [1, 2, 3, 4, 5] }];
  const r = cleanPlanRequest({ vision: "More time with my wife", focuses: ["family", "eat", "sleep"], wake: "08:00", bed: "23:30", workDays: [1, 2, 3, 4, 5], busy });
  const plan = builtinPlan(r);
  for (const rem of plan.reminders.filter((x) => !x.off)) {
    const m = toMinutes(rem.time)!;
    const weekdayClash = rem.days.some((d) => d >= 1 && d <= 5) && m >= 18 * 60 && m < 23 * 60;
    assert.ok(!weekdayClash, `${rem.title} at ${rem.time} lands in the work shift`);
  }
  const dinner = plan.reminders.find((x) => x.title === "Phone-free dinner")!;
  assert.ok(toMinutes(dinner.time)! < 18 * 60, `dinner moved before work, got ${dinner.time}`);
  assert.deepEqual(plan.busy, busy);
  assert.match(plan.summary, /busy times \(Work\)/);
  assert.match(planUserMessage(r), /Work: 18:00–23:00 on Monday, Tuesday, Wednesday, Thursday, Friday/);
  const ai = planFromAi(JSON.stringify({ summary: "This is the life you're building.", pillars: [], reminders: [{ title: "Date night", time: "19:00", days: [1, 2, 3, 4, 5, 6, 0] }, { title: "Read", time: "10:00" }] }), r)!;
  const date = ai.reminders.find((x) => x.title === "Date night")!;
  assert.equal(busyClash(busy, date), "", `AI's date night was left in the shift at ${date.time}`);
});

test("busy times: overnight shifts split at midnight, calendar events become a weekly pattern, clashes are named", () => {
  assert.deepEqual(cleanBusy([{ label: "Night shift", from: "22:00", to: "06:00", days: [5] }]), [
    { label: "Night shift", from: "22:00", to: "23:59", days: [5] }, { label: "Night shift", from: "00:00", to: "06:00", days: [6] },
  ]);
  assert.deepEqual(cleanBusy([{ from: "bad", to: "10:00" }, { from: "10:00", to: "10:00" }]), []);
  const week = busyFromEvents([
    { date: "2026-10-19", events: [{ title: "Work", time: "18:00", endTime: "23:00" }, { title: "No time", time: "" }] },
    { date: "2026-10-20", events: [{ title: "Work", time: "18:00", endTime: "23:00" }, { title: "Dentist", time: "09:00" }] },
  ]);
  assert.deepEqual(week, [{ label: "Work", from: "18:00", to: "23:00", days: [1, 2] }, { label: "Dentist", from: "09:00", to: "10:00", days: [2] }]);
  assert.equal(busyClash(week, { time: "18:30", days: [1] }), "Work");
  assert.equal(busyClash(week, { time: "18:30", days: [0] }), "");
  assert.equal(cleanLifePlan({ vision: "x", summary: "y", busy: week, reminders: [{ id: "a", title: "A", time: "09:00" }] })!.busy.length, 2);
});
