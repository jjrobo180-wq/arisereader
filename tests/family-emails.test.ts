// Automatic family emails: the weekly progress update and the "time to read" nudge.
// Run with: npx tsx --test tests/family-emails.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_FAMILY_EMAIL_SETTINGS, FAMILY_EMAIL_OPTOUT_KEY, FAMILY_EMAIL_SETTINGS_KEY, FAMILY_EMAIL_STATE_KEY, NUDGE_GAP_MS, SAMPLE_CHILD, SENDS_PER_PASS,
  cleanFamilyEmailSettings, monthStanding, needsNudge, nudgeDue, readFamilyEmailState, readOptOuts, readingNudgeEmail, schoolClock, standingText, weeklyDue, weeklyProgressEmail,
  type ChildProgress, type FamilyEmailSettings,
} from "../shared/familyEmails";
import { familyEmailOverview, previewFamilyEmail, readStopToken, registerFamilyEmailRoutes, runFamilyEmails, saveFamilyEmailSettings, setStopped, stopToken, type Family, type FamilyEmailDeps } from "../server/familyEmails";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const DAY = 24 * 60 * 60 * 1000;
const SITE = "https://www.arisereader.com";
// Sunday Oct 11, 2026 at 5:05 PM Mountain (MDT is six hours behind UTC).
const SUNDAY_5PM = Date.parse("2026-10-11T23:05:00Z");
const ON: FamilyEmailSettings = { ...DEFAULT_FAMILY_EMAIL_SETTINGS, enabled: true };
const child = (over: Partial<ChildProgress> = {}): ChildProgress => ({ childId: 5, name: "Dennis Flores", weekPassed: 2, weekPoints: 30, weekBooks: ["Holes", "Wonder"], totalPoints: 210, monthRank: 3, monthPoints: 60, pointsToNext: 11, band: "6-8", lastPassedAt: SUNDAY_5PM - DAY, ...over });

test("they start off, and odd settings fall back to safe ones", () => {
  assert.deepEqual(DEFAULT_FAMILY_EMAIL_SETTINGS, { enabled: false, weekly: { on: true, day: 0, hour: 17 }, nudge: { on: true, afterDays: 4, hour: 16 }, competitions: true });
  assert.deepEqual(cleanFamilyEmailSettings(""), DEFAULT_FAMILY_EMAIL_SETTINGS);
  assert.deepEqual(cleanFamilyEmailSettings("junk"), DEFAULT_FAMILY_EMAIL_SETTINGS);
  assert.equal(cleanFamilyEmailSettings({ enabled: "yes" }).enabled, false, "only a real true turns them on");
  assert.deepEqual(cleanFamilyEmailSettings({ enabled: true, weekly: { on: false, day: 9, hour: 30 }, nudge: { afterDays: 1, hour: -1 }, competitions: false }), { enabled: true, weekly: { on: false, day: 0, hour: 17 }, nudge: { on: true, afterDays: 4, hour: 16 }, competitions: false });
  assert.deepEqual(cleanFamilyEmailSettings(JSON.stringify({ enabled: true, weekly: { day: 5, hour: 8 }, nudge: { afterDays: 7, hour: 18 } })).weekly, { on: true, day: 5, hour: 8 });
});

test("the school clock decides when they go out", () => {
  assert.deepEqual(schoolClock(SUNDAY_5PM), { day: "2026-10-11", weekday: 0, hour: 17 });
  assert.deepEqual(schoolClock(Date.parse("2026-12-06T23:30:00Z")), { day: "2026-12-06", weekday: 0, hour: 16 }, "winter: seven hours behind");
  assert.deepEqual(schoolClock(Date.parse("2026-10-12T05:30:00Z")), { day: "2026-10-11", weekday: 0, hour: 23 }, "still Sunday in Denver");
  assert.equal(weeklyDue(ON, SUNDAY_5PM), true);
  assert.equal(weeklyDue(ON, SUNDAY_5PM - 10 * 60_000), false, "4:55 PM is too early");
  assert.equal(weeklyDue(ON, SUNDAY_5PM + DAY), false, "Monday");
  assert.equal(weeklyDue({ ...ON, enabled: false }, SUNDAY_5PM), false, "the main switch");
  assert.equal(weeklyDue({ ...ON, weekly: { ...ON.weekly, on: false } }, SUNDAY_5PM), false);
  const monday4pm = Date.parse("2026-10-12T22:00:00Z");
  assert.equal(nudgeDue(ON, monday4pm), true);
  assert.equal(nudgeDue(ON, monday4pm - 60 * 60_000), false, "3 PM is too early");
  assert.equal(nudgeDue(ON, SUNDAY_5PM), false, "never on the weekly update's day");
  assert.equal(nudgeDue({ ...ON, weekly: { ...ON.weekly, on: false } }, SUNDAY_5PM), true, "unless the weekly update is off");
  assert.equal(nudgeDue({ ...ON, nudge: { ...ON.nudge, on: false } }, monday4pm), false);
});

test("a nudge goes to a child who hasn't passed a quiz in a while, at most once a week", () => {
  const now = SUNDAY_5PM;
  assert.equal(needsNudge({ lastPassedAt: now - 3 * DAY }, ON, now, null), false, "3 days is not 4");
  assert.equal(needsNudge({ lastPassedAt: now - 4 * DAY }, ON, now, null), true);
  assert.equal(needsNudge({ lastPassedAt: null }, ON, now, null), true, "never passed one");
  assert.equal(needsNudge({ lastPassedAt: null }, ON, now, now - 6 * DAY), false, "nudged six days ago");
  assert.equal(needsNudge({ lastPassedAt: null }, ON, now, now - NUDGE_GAP_MS), true, "a week later, again");
  assert.equal(needsNudge({ lastPassedAt: now - 5 * DAY }, { ...ON, nudge: { ...ON.nudge, afterDays: 7 } }, now, null), false);
});

test("where a child stands this month: in their grade band, ties share a place, and how far to move up", () => {
  const grades: Record<number, string> = { 1: "6-8", 2: "6-8", 3: "6-8", 4: "6-8", 5: "3-5", 6: "6-8" };
  const bandOf = (id: number) => grades[id] || null;
  const month = [{ id: 1, totalPoints: 90 }, { id: 5, totalPoints: 80 }, { id: 2, totalPoints: 60 }, { id: 3, totalPoints: 60 }, { id: 4, totalPoints: 40 }, { id: 6, totalPoints: 0 }];
  assert.deepEqual(monthStanding(month, 1, bandOf), { monthRank: 1, monthPoints: 90, pointsToNext: null, band: "6-8" });
  assert.deepEqual(monthStanding(month, 3, bandOf), { monthRank: 2, monthPoints: 60, pointsToNext: 31, band: "6-8" }, "tied with 2 for second; 31 more passes the leader");
  assert.deepEqual(monthStanding(month, 4, bandOf), { monthRank: 4, monthPoints: 40, pointsToNext: 21, band: "6-8" });
  assert.deepEqual(monthStanding(month, 5, bandOf), { monthRank: 1, monthPoints: 80, pointsToNext: null, band: "3-5" }, "the only one in the 3-5 band");
  assert.deepEqual(monthStanding(month, 6, bandOf), { monthRank: null, monthPoints: 0, pointsToNext: null, band: "6-8" }, "no points this month, no place");
  assert.deepEqual(monthStanding(month, 9, () => null), { monthRank: null, monthPoints: 0, pointsToNext: null, band: null });
  assert.equal(monthStanding([{ id: 7, totalPoints: 10 }, { id: 9, totalPoints: 30 }], 7, () => null).monthRank, 2, "no grade: against everyone");
  assert.equal(standingText(child()), "Dennis is #3 in the 6-8 grade band this month with 60 points. Just 11 more points to move up to #2!");
  assert.equal(standingText(child({ monthRank: 1, pointsToNext: null })), "Dennis is #1 in the 6-8 grade band this month! 🏆 Keep it up to stay on top.");
  assert.equal(standingText(child({ monthRank: null })), "Dennis hasn't earned points this month yet. One book and one passed quiz puts Dennis on the leaderboard!");
  assert.equal(standingText(child({ band: null, pointsToNext: 1 })), "Dennis is #3 this month with 60 points. Just 1 more point to move up to #2!");
});

const parts = { siteUrl: SITE, stopUrl: `${SITE}/api/family-emails/stop?t=5.abc`, prizes: ["Reader of the Year: AirPods.", "Fall Break: leaderboard https://www.arisereader.com/#/fall-break"], seed: 3 };

test("the weekly update: the week's numbers, books, leaderboard place, a note to read to the child, and prizes", () => {
  const good = weeklyProgressEmail(child(), parts);
  assert.equal(good.subject, "📚 Dennis's reading week: 2 quizzes passed, 30 points!");
  for (const part of ["Dennis had a reading week to be proud of.", ">2</div>", "quizzes passed this week", ">30</div>", ">210</div>", "points in all", "Books Dennis finished this week:</strong> Holes, Wonder.", "📊 On the leaderboard", "Dennis is #3 in the 6-8 grade band this month with 60 points. Just 11 more points to move up to #2!", "Read this to Dennis!", "🏆 Prizes and competitions", "Reader of the Year: AirPods.", '<a href="https://www.arisereader.com/#/fall-break"', "Open A.R.I.S.E. Reader", 'href="https://www.arisereader.com/api/family-emails/stop?t=5.abc"', "Stop these emails", "icon-192.png"]) assert.ok(good.html.includes(part), part);
  const one = weeklyProgressEmail(child({ weekPassed: 1, weekPoints: 12.5, weekBooks: ["A", "B", "C", "D", "E"] }), parts);
  assert.equal(one.subject, "📚 Dennis's reading week: 1 quiz passed, 12.5 points!");
  assert.ok(one.html.includes("A, B, C and 2 more."));
  const quiet = weeklyProgressEmail(child({ weekPassed: 0, weekPoints: 0, weekBooks: [] }), { ...parts, prizes: [] });
  assert.equal(quiet.subject, "📚 Dennis's reading week, and a fresh start");
  assert.ok(quiet.html.includes("didn't pass a quiz this week, and that's okay") && !quiet.html.includes("Books Dennis") && !quiet.html.includes("Prizes and competitions"));
  // Different weeks bring different cheers for the child.
  const cheers = new Set([0, 1, 2].map((seed) => /Read this to Dennis!<\/div>\s*<div[^>]*>([^<]+)</.exec(weeklyProgressEmail(child(), { ...parts, seed }).html)![1]));
  assert.equal(cheers.size, 3);
});

test("the nudge: friendly, with how close the child is to moving up", () => {
  const close = readingNudgeEmail(child({ lastPassedAt: SUNDAY_5PM - 5 * DAY }), { ...parts, nowMs: SUNDAY_5PM });
  assert.equal(close.subject, "⭐ Dennis is 11 points from moving up!");
  for (const part of ["It's been 5 days since Dennis's last passed quiz", "Dennis is #3 in the 6-8 grade band", "Read this to Dennis!", "Ten minutes of reading tonight counts!", "Stop these emails"]) assert.ok(close.html.includes(part), part);
  const never = readingNudgeEmail(child({ lastPassedAt: null, monthRank: null, pointsToNext: null }), { ...parts, nowMs: SUNDAY_5PM });
  assert.ok(["📖 Dennis's next book is waiting!", "🚀 Time to read, Dennis!", "🎯 A quick quiz for Dennis?"].includes(never.subject), never.subject);
  assert.ok(never.html.includes("Dennis hasn't taken a quiz on A.R.I.S.E. Reader yet."));
  assert.ok(!/undefined|null|NaN/.test(close.html + never.html));
});

test("names and book titles are shown as text, never as page code", () => {
  const bad = weeklyProgressEmail(child({ name: "<b>Al</b> & Co", weekBooks: ["<script>x</script>"] }), parts);
  assert.equal(bad.subject, "📚 <b>Al</b>'s reading week: 2 quizzes passed, 30 points!", "a subject line is plain text in every email app, so it is left as typed");
  assert.ok(bad.html.includes("&lt;b&gt;Al&lt;/b&gt;") && bad.html.includes("&lt;script&gt;x&lt;/script&gt;") && !bad.html.includes("<script>"));
});

// ─── The timer's pass, with a stand-in site ──────────────────────────────────

function site(start: { settings?: Partial<FamilyEmailSettings>; families?: Family[]; progress?: Record<number, Partial<ChildProgress>>; optout?: number[]; failTo?: string[]; now?: number; configured?: boolean } = {}) {
  const settings = new Map<string, string>([[FAMILY_EMAIL_SETTINGS_KEY, JSON.stringify({ ...ON, ...start.settings })]]);
  if (start.optout) settings.set(FAMILY_EMAIL_OPTOUT_KEY, JSON.stringify({ parentIds: start.optout }));
  const sent: { to: string; subject: string; html: string }[] = [];
  let clock = start.now ?? SUNDAY_5PM;
  const fail = new Set(start.failTo || []);
  const families: Family[] = start.families ?? [
    { parentId: 100, parentName: "Mom Flores", email: "mom@example.com", children: [{ id: 5, name: "Dennis Flores" }, { id: 6, name: "Ana Flores" }] },
    { parentId: 101, parentName: "Dad Lee", email: "dad@example.com", children: [{ id: 7, name: "Jordan Lee" }] },
    { parentId: 102, parentName: "No Kids", email: "x@example.com", children: [] },
  ];
  const deps: FamilyEmailDeps = {
    getSetting: async (k) => settings.get(k) ?? "",
    saveSetting: async (k, v) => { settings.set(k, v); },
    families: async () => families,
    progress: async (kids) => new Map(kids.map((k) => [k.id, child({ childId: k.id, name: k.name, ...(start.progress?.[k.id] || {}) })])),
    prizes: async () => ["Reader of the Year: AirPods."],
    emailConfigured: () => start.configured !== false,
    sendEmail: async (to, subject, html) => { sent.push({ to, subject, html }); return { sent: !fail.has(to) }; },
    siteUrl: SITE,
    signKey: "test-secret",
    now: () => clock,
  };
  return { deps, sent, settings, state: () => readFamilyEmailState(settings.get(FAMILY_EMAIL_STATE_KEY)), at: (ms: number) => { clock = ms; }, later: (ms: number) => { clock += ms; }, unfail: () => fail.clear() };
}

test("on its day and hour, every connected parent gets one update per child, once", async () => {
  const s = site();
  assert.deepEqual(await runFamilyEmails(s.deps), { weekly: 0 + 3, nudges: 0, failed: 0 });
  assert.deepEqual(s.sent.map((m) => [m.to, m.subject]), [["mom@example.com", "📚 Dennis's reading week: 2 quizzes passed, 30 points!"], ["mom@example.com", "📚 Ana's reading week: 2 quizzes passed, 30 points!"], ["dad@example.com", "📚 Jordan's reading week: 2 quizzes passed, 30 points!"]]);
  assert.ok(s.sent[0].html.includes("Reader of the Year: AirPods."));
  // The stop link is this parent's own.
  const token = /stop\?t=([^"]+)"/.exec(s.sent[0].html)![1];
  assert.equal(readStopToken("test-secret", decodeURIComponent(token)), 100);
  // Ten minutes later, nothing again.
  s.later(10 * 60_000);
  assert.deepEqual(await runFamilyEmails(s.deps), { weekly: 0, nudges: 0, failed: 0, skipped: "nothing due" });
  assert.equal(s.sent.length, 3);
  assert.deepEqual(s.state().lastRun, { at: SUNDAY_5PM, weekly: 3, nudges: 0, failed: 0 });
  // The next Sunday, again.
  s.at(SUNDAY_5PM + 7 * DAY);
  assert.equal((await runFamilyEmails(s.deps)).weekly, 3);
});

test("nothing goes out when they are off, email is not set up, it is not time, or a parent stopped them", async () => {
  const off = site({ settings: { enabled: false } });
  assert.deepEqual(await runFamilyEmails(off.deps), { weekly: 0, nudges: 0, failed: 0, skipped: "off" });
  const noEmail = site({ configured: false });
  assert.equal((await runFamilyEmails(noEmail.deps)).skipped, "email not set up");
  const early = site({ now: SUNDAY_5PM - 2 * 60 * 60_000 });
  assert.equal((await runFamilyEmails(early.deps)).skipped, "not time", "Sunday at 3 PM: too early for both");
  const stopped = site({ optout: [100] });
  assert.equal((await runFamilyEmails(stopped.deps)).weekly, 1);
  assert.deepEqual(stopped.sent.map((m) => m.to), ["dad@example.com"]);
  assert.equal(off.sent.length + noEmail.sent.length + early.sent.length, 0);
});

test("a send that fails is tried again on a later pass", async () => {
  const s = site({ failTo: ["dad@example.com"] });
  assert.deepEqual(await runFamilyEmails(s.deps), { weekly: 2, nudges: 0, failed: 1 });
  assert.equal(s.state().lastRun?.note, "Some emails could not be sent and will be tried again.");
  s.unfail(); s.later(10 * 60_000);
  assert.deepEqual(await runFamilyEmails(s.deps), { weekly: 1, nudges: 0, failed: 0 });
  assert.deepEqual(s.sent.map((m) => m.to), ["mom@example.com", "mom@example.com", "dad@example.com", "dad@example.com"]);
});

test("nudges go out on other days, only to children who need one, and at most once a week", async () => {
  const monday4pm = Date.parse("2026-10-12T22:05:00Z");
  const s = site({ now: monday4pm, progress: { 5: { lastPassedAt: monday4pm - 6 * DAY }, 6: { lastPassedAt: monday4pm - DAY }, 7: { lastPassedAt: null } } });
  assert.deepEqual(await runFamilyEmails(s.deps), { weekly: 0, nudges: 2, failed: 0 });
  assert.deepEqual(s.sent.map((m) => m.to), ["mom@example.com", "dad@example.com"]);
  assert.ok(s.sent[0].subject.includes("Dennis") && s.sent[1].subject.includes("Jordan"));
  // Through the week: Ana, who passed one on Sunday, gets hers once four days have gone by (Thursday); nobody gets a second.
  const byDay: string[][] = [];
  for (const day of [1, 2, 3, 4, 5]) { s.at(monday4pm + day * DAY); const before = s.sent.length; await runFamilyEmails(s.deps); byDay.push(s.sent.slice(before).map((m) => m.subject)); }
  assert.deepEqual(byDay.map((list) => list.length), [0, 0, 1, 0, 0]);
  assert.ok(byDay[2][0].includes("Ana"));
  s.at(monday4pm + 7 * DAY);
  assert.equal((await runFamilyEmails(s.deps)).nudges, 2, "a week later, Dennis and Jordan again (Ana's week isn't up)");
});

test("one pass sends at most a set number, and the rest go out on the next pass", async () => {
  const many: Family[] = Array.from({ length: SENDS_PER_PASS + 5 }, (_, i) => ({ parentId: 1000 + i, parentName: "", email: `p${i}@example.com`, children: [{ id: 5000 + i, name: `Kid ${i}` }] }));
  const s = site({ families: many });
  assert.equal((await runFamilyEmails(s.deps)).weekly, SENDS_PER_PASS);
  s.later(10 * 60_000);
  assert.equal((await runFamilyEmails(s.deps)).weekly, 5);
  assert.equal(new Set(s.sent.map((m) => m.to)).size, SENDS_PER_PASS + 5, "no one twice");
});

test("the stop link: a page with a button, then stopped, and can be turned back on", async () => {
  const s = site();
  const token = stopToken("test-secret", 100);
  assert.equal(readStopToken("test-secret", token), 100);
  for (const bad of ["", "100", "100.short", token.replace(/^100/, "101"), `${token}x`, stopToken("other-secret", 100)]) assert.equal(readStopToken("test-secret", bad), null, bad);
  const routes: Record<string, any> = {};
  const app: any = { get: (p: string, ...h: any[]) => { routes[`GET ${p}`] = h.at(-1); }, put: (p: string, ...h: any[]) => { routes[`PUT ${p}`] = h.at(-1); }, post: (p: string, ...h: any[]) => { routes[`POST ${p}`] = h.at(-1); } };
  registerFamilyEmailRoutes(app, () => {}, s.deps, { startTimer: false });
  const call = async (key: string, req: any) => { const out: any = { status: 200 }; const res: any = { status: (n: number) => { out.status = n; return res; }, type: () => res, set: () => res, send: (b: string) => { out.body = b; return res; }, json: (b: unknown) => { out.body = b; return res; } }; await routes[key](req, res); return out; };
  const page = await call("GET /api/family-emails/stop", { query: { t: token } });
  assert.ok(page.body.includes('<form method="post" action="/api/family-emails/stop">') && page.body.includes("Stop these emails</button>"), "a mail app that opens the link doesn't stop anything");
  assert.deepEqual(readOptOuts(s.settings.get(FAMILY_EMAIL_OPTOUT_KEY)), []);
  const stopped = await call("POST /api/family-emails/stop", { body: { t: token } });
  assert.ok(stopped.body.includes("You won't get progress updates or reading reminders anymore.") && stopped.body.includes("Turn them back on"));
  assert.deepEqual(readOptOuts(s.settings.get(FAMILY_EMAIL_OPTOUT_KEY)), [100]);
  assert.equal((await runFamilyEmails(s.deps)).weekly, 1, "only the other parent");
  await call("POST /api/family-emails/resume", { body: { t: token } });
  assert.deepEqual(readOptOuts(s.settings.get(FAMILY_EMAIL_OPTOUT_KEY)), []);
  assert.equal((await call("GET /api/family-emails/stop", { query: { t: "nope" } })).status, 400);
  assert.equal((await setStopped(s.deps, "nope", true)).status, 400);
});

test("the admin's screen: only the admin, the counts, saving, and previews", async () => {
  const s = site({ optout: [101] });
  const admin = { id: 1, isAdmin: true, email: "me@school.example" }, teacher = { id: 2, isAdmin: false };
  assert.equal((await familyEmailOverview(s.deps, teacher)).status, 403);
  assert.equal((await saveFamilyEmailSettings(s.deps, teacher, { enabled: true })).status, 403);
  assert.equal((await previewFamilyEmail(s.deps, teacher, {})).status, 403);
  const view = await familyEmailOverview(s.deps, admin);
  assert.deepEqual(view.body.counts, { parents: 1, children: 2, stopped: 1 }, "a parent with no children gets nothing");
  assert.deepEqual(view.body.schedule, { weekly: "Sundays from 5:00 PM", nudge: "after 4 days without a passed quiz, from 4:00 PM" });
  assert.deepEqual((view.body.children as any[]).map((c) => c.name), ["Ana Flores", "Dennis Flores", "Jordan Lee"]);
  const saved = await saveFamilyEmailSettings(s.deps, admin, { enabled: false, weekly: { day: 5, hour: 15 } });
  assert.equal(saved.body.message, "Saved. Automatic emails are off.");
  assert.deepEqual(cleanFamilyEmailSettings(s.settings.get(FAMILY_EMAIL_SETTINGS_KEY)).weekly, { on: true, day: 5, hour: 15 });
  // Previews: a made-up student, a real one, and one emailed to the admin.
  const sample = await previewFamilyEmail(s.deps, admin, { kind: "weekly" });
  assert.ok(String(sample.body.subject).includes(SAMPLE_CHILD.name.split(" ")[0]) && String(sample.body.html).startsWith("<!doctype html>"));
  const real = await previewFamilyEmail(s.deps, admin, { kind: "nudge", childId: 7 });
  assert.ok(String(real.body.subject).includes("Jordan"));
  assert.equal((await previewFamilyEmail(s.deps, admin, { childId: 999 })).status, 404);
  const mailed = await previewFamilyEmail(s.deps, admin, { kind: "weekly", childId: 5, sendToMe: true });
  assert.equal(mailed.body.message, "Preview sent to me@school.example.");
  assert.deepEqual([s.sent.at(-1)!.to, s.sent.at(-1)!.subject], ["me@school.example", "[Preview] 📚 Dennis's reading week: 2 quizzes passed, 30 points!"]);
  assert.equal((await previewFamilyEmail(s.deps, { id: 1, isAdmin: true, email: "" }, { sendToMe: true })).status, 400);
});

test("the pieces are connected: routes, the timer, and the admin's Settings tab", () => {
  const routes = read("server/routes.ts"), admin = read("client/src/pages/Admin.tsx"), box = read("client/src/components/FamilyEmailSettings.tsx");
  for (const part of ["registerFamilyEmailRoutes(app, authMiddleware, {", "readParentStudentLinks()", "storage.getMonthlyLeaderboard(schoolYearMonth(nowMs))", "monthStanding(month, c.id, bandOf)", 'hkdfSync("sha256", source, "arise-family-email"']) assert.ok(routes.includes(part), part);
  for (const part of ['{ value: "family-emails", label: "Family emails", icon: Mail }', '{settingsSection === "family-emails" && (', "<FamilyEmailSettings />"]) assert.ok(admin.includes(part), part);
  for (const part of ['testId="family-emails-main"', "Weekly progress update", '"Time to read" reminder', "Email it to me", 'sandbox=""', "Students don't have email addresses on the site"]) assert.ok(box.includes(part), part);
  assert.ok(read("server/familyEmails.ts").includes("if (options.startTimer !== false) startFamilyEmailTimer(deps);"));
});
