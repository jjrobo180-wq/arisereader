// Admin Stats tab: days in the school's time zone, visits, sign-ins, growth, quizzes and the people lists.
// Run with: npx tsx --test tests/admin-stats.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY_KEY_PREFIX, addDays, buildAdminStats, createPresenceTracker, dayKey, parseActivityDay, weekStart, weekdayOf, withUnsaved, zoneParts,
  type StatsInput,
} from "../server/adminStats";

const NOW = Date.parse("2026-10-05T18:00:00Z"); // noon on Monday, October 5 in Denver
const MIN = 60_000, DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

function input(over: Partial<StatsInput> = {}): StatsInput {
  return {
    users: [
      { id: 1, username: "admin", displayName: "Admin", role: "admin", isAdmin: true, createdAt: "2026-09-01T12:00:00Z", schoolId: null, archived: false },
      { id: 2, username: "sample-reader", displayName: "Sample", role: "student", isAdmin: false, createdAt: "2026-09-01T12:00:00Z", schoolId: 3, archived: false },
      { id: 3, username: "gone", displayName: "Gone", role: "student", isAdmin: false, createdAt: "2026-09-01T12:00:00Z", schoolId: 3, archived: true },
      { id: 10, username: "ada", displayName: "Ada", role: "student", isAdmin: false, createdAt: "2026-09-01T16:00:00Z", schoolId: 3, archived: false },
      { id: 11, username: "ben", displayName: "Ben", role: "student", isAdmin: false, createdAt: "2026-10-02T16:00:00Z", schoolId: null, archived: false },
      { id: 12, username: "cy", displayName: "Cy", role: "student", isAdmin: false, createdAt: "2026-09-01T16:00:00Z", schoolId: 3, archived: false },
      { id: 50, username: "msnew", displayName: "Ms. New", role: "teacher", isAdmin: false, createdAt: "2026-09-10T16:00:00Z", schoolId: 3, archived: false },
      { id: 80, username: "parent", displayName: "Parent", role: "parent", isAdmin: false, createdAt: "2026-09-30T16:00:00Z", schoolId: null, archived: false },
    ],
    schools: [{ id: 3, name: "Lincoln Middle" }, { id: 4, name: "Empty School" }],
    grades: { "10": "4", "11": "K" },
    sessions: [
      { userId: 10, at: iso(NOW - 2 * DAY + 3_000) }, // the same sign-in as the logged one below
      { userId: 10, at: iso(NOW - 4 * DAY) },
      { userId: 50, at: iso(NOW - 1 * DAY) },
      { userId: 1, at: iso(NOW - 1 * DAY) }, // admin: not counted
      { userId: 2, at: iso(NOW - 1 * DAY) }, // sample: not counted
    ],
    loginLogs: [
      { userId: 10, at: iso(NOW - 2 * DAY), device: "Chromebook · Chrome" },
      { userId: 11, at: iso(NOW - 3 * DAY), device: "iPad · Safari" },
    ],
    activityDays: {},
    bookQuizzes: [
      { userId: 10, at: "2026-10-05T16:00:00Z", score: 8, total: 10, points: 2 }, // 10am local, passed
      { userId: 11, at: "2026-10-03T22:00:00Z", score: 5, total: 10, points: 0 }, // not passed
      { userId: 10, at: "2026-09-20T16:00:00Z", score: 9, total: 10, points: 3 }, // before the range
    ],
    eyeGazeQuizzes: [],
    readingChecks: [{ userId: 10, at: "2026-10-04T16:00:00Z", score: 12, total: 15, level: "4.5" }],
    growthChecks: [],
    pointAwards: [{ userId: 11, at: "2026-10-04T16:00:00Z", points: 5, reason: "Science fair" }],
    feedEvents: [{ userId: 11, at: "2026-10-04T15:00:00Z", type: "view" }, { userId: 11, at: "2026-10-04T15:01:00Z", type: "dwell" }],
    games: [],
    messages: [],
    liveJoins: [],
    ...over,
  };
}

test("days and hours are counted in Denver time", () => {
  assert.deepEqual(zoneParts(Date.parse("2026-10-05T03:00:00Z")), { day: "2026-10-04", hour: 21 }, "9pm on the 4th, not the 5th");
  assert.equal(dayKey(Date.parse("2026-12-01T06:59:00Z")), "2026-11-30", "winter time is 7 hours behind");
  assert.equal(dayKey(Date.parse("2026-12-01T07:00:00Z")), "2026-12-01");
  assert.equal(addDays("2026-10-30", 3), "2026-11-02");
  assert.equal(weekdayOf("2026-10-05"), 0, "a Monday");
  assert.equal(weekdayOf("2026-10-04"), 6, "a Sunday");
  assert.equal(weekStart("2026-10-04"), "2026-09-28");
});

test("the last 7 days: totals, sign-ins and who counts", () => {
  const s = buildAdminStats(input(), { range: "7d", now: NOW });
  assert.equal(s.from, "2026-09-29");
  assert.equal(s.to, "2026-10-05");
  assert.equal(s.bucket, "day");
  assert.equal(s.buckets.length, 7);
  // admins, sample accounts and archived profiles are left out
  assert.deepEqual([s.totals.students, s.totals.teachers, s.totals.parents], [3, 1, 1]);
  assert.deepEqual(s.totals.newStudents, { now: 1, before: 0 });
  assert.deepEqual(s.totals.newParents, { now: 1, before: 0 });
  // a logged sign-in and a session 3 seconds later are one sign-in
  assert.deepEqual(s.totals.logins, { now: 4, before: 0 });
  assert.equal(s.recentLogins[0].name, "Ms. New");
  assert.equal(s.recentLogins.find((l) => l.userId === 10)?.device, "Chromebook · Chrome");
  assert.deepEqual(s.devices, [{ name: "Chromebook", count: 1 }, { name: "iPad", count: 1 }]);
  // quizzes, passing and points in the range
  assert.deepEqual(s.totals.quizzes, { now: 3, before: 0 }, "two book quizzes and a reading check");
  assert.equal(s.totals.passed, 1);
  assert.equal(s.totals.passRate, 50);
  assert.deepEqual(s.totals.points, { now: 7, before: 0 }, "2 from a quiz and 5 added by staff");
  assert.equal(s.totals.feedViews, 1);
  assert.equal(s.reading.assessments, 1);
  assert.equal(s.reading.averagePercent, 80);
});

test("growth over time: new accounts per day and the running total", () => {
  const s = buildAdminStats(input(), { range: "7d", now: NOW });
  const day = (k: string) => s.buckets.find((b) => b.key === k)!;
  assert.equal(day("2026-09-29").totalStudents, 2);
  assert.equal(day("2026-10-02").newStudents, 1);
  assert.equal(day("2026-10-02").totalStudents, 3);
  assert.equal(day("2026-09-30").newParents, 1);
  assert.equal(day("2026-10-05").totalTeachers, 1);
  assert.equal(day("2026-10-05").bookQuizzes, 1);
  assert.equal(day("2026-10-05").passed, 1);
  assert.equal(day("2026-10-03").bookQuizzes, 1, "4pm on the 3rd in Denver");
  assert.equal(day("2026-10-01").studentLogins, 1);
  assert.equal(day("2026-10-04").staffLogins, 1);
});

test("visits count students as active, and show when they use the app", () => {
  const visits = { "2026-10-05": { "12": [NOW - 3 * 3_600_000, NOW - 2 * 3_600_000] as [number, number] } }; // Cy, 9am to 10am
  const s = buildAdminStats(input({ activityDays: visits }), { range: "7d", now: NOW });
  assert.equal(s.visitsSince, "2026-10-05");
  assert.equal(s.totals.activeToday, 2, "Ada took a quiz today and Cy visited");
  assert.equal(s.totals.activeStudents.now, 3);
  assert.equal(s.buckets.at(-1)!.activeStudents, 2);
  assert.equal(s.hours[9], 2, "Cy's first visit, and Ben scrolling the book feed on Sunday");
  assert.equal(s.hours[10], 3, "Ada's quiz and Cy's last visit today, and Ada's reading check on Sunday");
  assert.equal(s.hours[12], 3, "sign-ins");
  assert.equal(s.weekdays[0], 2, "two students on Monday");
  assert.ok(!s.quietStudents.some((q) => q.userId === 12));
});

test("quiet students, online now and the most active", () => {
  const heard = new Map([[10, NOW - 2 * MIN], [50, NOW - 30 * MIN], [1, NOW - MIN]]);
  const s = buildAdminStats(input(), { range: "7d", now: NOW, heardFrom: heard });
  assert.deepEqual(s.onlineNow.map((p) => p.name), ["Ada"], "the teacher left 30 minutes ago and the admin isn't counted");
  assert.equal(s.totals.onlineNow, 1);
  // Cy joined more than two weeks ago and hasn't been seen; Ben joined 3 days ago
  assert.deepEqual(s.quietStudents.map((q) => [q.name, q.daysAway]), [["Cy", null]]);
  assert.equal(s.quietCount, 1);
  assert.deepEqual(s.topStudents.map((t) => t.name), ["Ada", "Ben"]);
  const ada = s.topStudents[0];
  assert.deepEqual([ada.logins, ada.quizzes, ada.passed, ada.points], [2, 2, 1, 2]);
  assert.equal(ada.school, "Lincoln Middle");
});

test("schools and grades", () => {
  const s = buildAdminStats(input(), { range: "7d", now: NOW });
  assert.deepEqual(s.schools.map((r) => [r.name, r.students, r.teachers]), [["Lincoln Middle", 2, 1], ["No school", 1, 0]]);
  assert.deepEqual(s.grades, [{ grade: "K", students: 1 }, { grade: "4", students: 1 }, { grade: "Not set", students: 1 }]);
});

test("all time uses weeks once the history is long", () => {
  const old = input();
  old.users[3] = { ...old.users[3], createdAt: iso(NOW - 200 * DAY) };
  const s = buildAdminStats(old, { range: "all", now: NOW });
  assert.equal(s.bucket, "week");
  assert.equal(s.totals.newStudents.before, null, "nothing to compare all time with");
  assert.ok(s.buckets.every((b) => weekdayOf(b.key) === 0), "weeks start on Monday");
  assert.equal(s.buckets.at(-1)!.key, "2026-10-05");
  assert.equal(s.buckets.at(-1)!.totalStudents, 3);
  assert.equal(s.buckets[0].totalStudents, 1);
});

test("the previous period is the same number of days just before", () => {
  const s = buildAdminStats(input(), { range: "30d", now: NOW });
  assert.equal(s.from, "2026-09-06");
  assert.deepEqual(s.totals.quizzes, { now: 4, before: 0 });
  assert.deepEqual(s.totals.newStudents, { now: 1, before: 2 }, "Ada and Cy joined on September 1");
});

function presenceSetup(opts: { failSaves?: number } = {}) {
  let clock = NOW;
  const store = new Map<string, string>();
  const timers: (() => void)[] = [];
  let failures = opts.failSaves ?? 0;
  const tracker = createPresenceTracker({
    readSetting: async (k) => store.get(k) ?? "",
    upsertSetting: async (k, v) => { if (failures > 0) { failures--; throw new Error("database unreachable"); } store.set(k, v); },
    now: () => clock,
    setTimer: (fn) => { timers.push(fn); return 1; },
    log: () => {},
  });
  const runTimers = async () => { while (timers.length) timers.shift()!(); await tracker.flush(); };
  return { tracker, store, timers, runTimers, tick: (ms: number) => { clock += ms; } };
}

test("visits: noted at most every 5 minutes, saved together, merged with what's stored", async () => {
  const { tracker, store, timers, runTimers, tick } = presenceSetup();
  const key = ACTIVITY_KEY_PREFIX + "2026-10-05";
  store.set(key, JSON.stringify({ "10": [NOW - 3_600_000, NOW - 3_600_000], "77": [NOW - 10, NOW - 5] })); // another server saved earlier visits
  tracker.touch({ id: 10, role: "student", username: "ada" });
  tracker.touch({ id: 1, isAdmin: true, username: "admin" });
  tracker.touch({ id: 2, username: "sample-reader" });
  tracker.touch({ id: 0 });
  tracker.touch(null);
  assert.equal(timers.length, 1, "one save is scheduled");
  tick(2 * MIN);
  tracker.touch({ id: 10, role: "student", username: "ada" });
  assert.deepEqual(tracker.unsaved()["2026-10-05"]["10"], [NOW, NOW], "a second visit within 5 minutes isn't noted again");
  assert.equal(tracker.lastSeen().get(10), NOW + 2 * MIN, "but online-now still sees it");
  await runTimers();
  const saved = parseActivityDay(store.get(key));
  assert.deepEqual(saved["10"], [NOW - 3_600_000, NOW]);
  assert.deepEqual(saved["77"], [NOW - 10, NOW - 5]);
  assert.equal(saved["1"], undefined);
  assert.equal(saved["2"], undefined);
  tick(4 * MIN);
  tracker.touch({ id: 10, role: "student", username: "ada" });
  await runTimers();
  assert.deepEqual(parseActivityDay(store.get(key))["10"], [NOW - 3_600_000, NOW + 6 * MIN]);
});

test("visits: a failed save is kept and tried again, and a new day gets its own record", async () => {
  const { tracker, store, runTimers, tick } = presenceSetup({ failSaves: 1 });
  tracker.touch({ id: 10, username: "ada" });
  await tracker.flush();
  assert.equal(store.size, 0);
  assert.ok(tracker.unsaved()["2026-10-05"]["10"], "still waiting to be saved");
  await runTimers();
  assert.deepEqual(parseActivityDay(store.get(ACTIVITY_KEY_PREFIX + "2026-10-05"))["10"], [NOW, NOW]);
  tick(13 * 3_600_000); // 1am on the 6th in Denver
  tracker.touch({ id: 10, username: "ada" });
  await runTimers();
  assert.ok(store.has(ACTIVITY_KEY_PREFIX + "2026-10-06"));
  assert.deepEqual(parseActivityDay("not json"), {});
  assert.deepEqual(parseActivityDay('{"5":[1,"x"],"6":[1,2]}'), { "6": [1, 2] });
});

test("unsaved visits are folded into what the database returned", () => {
  const base = input({ activityDays: { "2026-10-05": { "10": [NOW - 100, NOW - 50] } } });
  const merged = withUnsaved(base, { "2026-10-05": { "10": [NOW - 200, NOW], "11": [NOW, NOW] } });
  assert.deepEqual(merged.activityDays["2026-10-05"], { "10": [NOW - 200, NOW], "11": [NOW, NOW] });
  assert.deepEqual(base.activityDays["2026-10-05"], { "10": [NOW - 100, NOW - 50] }, "the original is left alone");
});
