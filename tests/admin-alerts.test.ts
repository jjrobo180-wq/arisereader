// Admin alerts: switches, the in-app notifications, combined emails, the daily limit and the log.
// Run with: npx tsx --test tests/admin-alerts.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  ALERT_SETTINGS_KEY, ALERT_STATE_KEY, BUNDLE_WINDOW_MS,
  alertEmailHtml, alertEmailSubject, createAdminAlerts, dayInZone, escapeHtml,
  type AdminAlertDeps,
} from "../server/adminAlerts";
import { ALERT_EVENTS, defaultAlertSettings, normalizeAlertSettings } from "../shared/adminAlerts";

function setup(options: { settings?: unknown; emailConfigured?: boolean; sendOk?: boolean | ((n: number) => boolean); admins?: number[] } = {}) {
  let clock = Date.parse("2026-10-04T18:00:00Z");
  const store = new Map<string, string>();
  if (options.settings !== undefined) store.set(ALERT_SETTINGS_KEY, JSON.stringify(options.settings));
  const rows: any[] = [];
  const emails: { to: string[]; subject: string; html: string }[] = [];
  const timers: { fn: () => void; at: number }[] = [];
  const deps: AdminAlertDeps = {
    readSetting: async (key) => store.get(key) || "",
    upsertSetting: async (key, value) => { store.set(key, value); },
    adminIds: async () => options.admins ?? [1, 7],
    insertNotifications: async (r) => { rows.push(...r); },
    sendEmail: async (to, subject, html) => {
      emails.push({ to, subject, html });
      const ok = typeof options.sendOk === "function" ? options.sendOk(emails.length) : options.sendOk ?? true;
      return ok ? { sent: true } : { sent: false, error: "Email API error 403: domain not verified" };
    },
    emailConfigured: () => options.emailConfigured ?? true,
    fromAddress: "A.R.I.S.E Reader <alerts@arisereader.com>",
    fallbackRecipient: "Owner@Example.com",
    appUrl: "https://arisereader.com",
    now: () => clock,
    setTimer: (fn, ms) => { timers.push({ fn, at: clock + ms }); return timers.length; },
    log: () => {},
  };
  const alerts = createAdminAlerts(deps);
  const advance = async (ms: number) => {
    clock += ms;
    for (const t of timers.splice(0).filter((t) => {
      if (t.at <= clock) return true;
      timers.push(t);
      return false;
    })) t.fn();
    await new Promise((r) => setTimeout(r, 5));
  };
  const state = () => JSON.parse(store.get(ALERT_STATE_KEY) || "{}");
  return { alerts, rows, emails, store, advance, state, timers };
}

const quiz = (name: string) => ({
  title: `Quiz taken: ${name} scored 8/10 on “Frindle”`,
  summary: "Passed · 10 points",
  lines: [["Student", name], ["Score", "8/10 (80%)"], ["Empty", ""]] as [string, string][],
  ref: "u12",
});

test("settings default to every alert on, by email and in the bell, sent to the admin's address", () => {
  const s = defaultAlertSettings("Owner@Example.com");
  assert.deepEqual(s.recipients, ["owner@example.com"]);
  assert.equal(s.emailEnabled, true);
  assert.equal(s.bundle, true);
  for (const info of ALERT_EVENTS) assert.deepEqual(s.events[info.key], { email: true, inApp: true }, info.key);
});

test("saved settings are cleaned up: bad emails dropped, limits clamped, unknown events ignored", () => {
  const s = normalizeAlertSettings({
    emailEnabled: false,
    recipients: ["A@School.org", "a@school.org", "not an email", "<x>@y.com", "b@c.co", "c@d.org", "d@e.org", "e@f.org", "f@g.org"],
    dailyLimit: 5000,
    bundle: false,
    events: { quiz_completed: { email: false }, made_up: { email: true }, student_signup: "yes" },
  }, "owner@example.com");
  assert.equal(s.emailEnabled, false);
  assert.equal(s.bundle, false);
  assert.equal(s.dailyLimit, 1000);
  assert.deepEqual(s.recipients, ["a@school.org", "b@c.co", "c@d.org", "d@e.org", "e@f.org"]);
  assert.deepEqual(s.events.quiz_completed, { email: false, inApp: true });
  assert.deepEqual(s.events.student_signup, { email: true, inApp: true });
  assert.ok(!("made_up" in s.events));
  assert.equal(normalizeAlertSettings({ dailyLimit: -3 }, "x@y.org").dailyLimit, 0);
  assert.deepEqual(normalizeAlertSettings("garbage", "x@y.org"), defaultAlertSettings("x@y.org"));
});

test("an alert makes a notification for every admin and sends one email", async () => {
  const { alerts, rows, emails, state } = setup();
  await alerts.notify("quiz_completed", quiz("Ana"));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.user_id), [1, 7]);
  assert.equal(rows[0].type, "alert:quiz_completed:u12");
  assert.equal(rows[0].title, "Quiz taken: Ana scored 8/10 on “Frindle”");
  assert.equal(emails.length, 1);
  assert.deepEqual(emails[0].to, ["owner@example.com"]);
  assert.equal(emails[0].subject, "Quiz taken: Ana scored 8/10 on “Frindle” · A.R.I.S.E Reader");
  assert.ok(emails[0].html.includes("8/10 (80%)"));
  assert.ok(!emails[0].html.includes(">Empty<"), "empty lines are left out");
  assert.ok(emails[0].html.includes('href="https://arisereader.com/#/admin"'));
  const saved = state();
  assert.equal(saved.count, 1);
  assert.equal(saved.log[0].status, "sent");
  assert.deepEqual(saved.log[0].events, ["quiz_completed"]);
});

test("switching an alert off stops that channel only", async () => {
  const settings = defaultAlertSettings("owner@example.com");
  settings.events.quiz_completed = { email: false, inApp: true };
  settings.events.student_signup = { email: true, inApp: false };
  const { alerts, rows, emails } = setup({ settings });
  await alerts.notify("quiz_completed", quiz("Ana"));
  assert.equal(rows.length, 2);
  assert.equal(emails.length, 0);
  await alerts.notify("student_signup", { title: "New student: Bo", summary: "@bo" });
  assert.equal(rows.length, 2, "no new bell notification");
  assert.equal(emails.length, 1);
});

test("the email master switch turns off every alert email but not the bell", async () => {
  const { alerts, rows, emails } = setup({ settings: { ...defaultAlertSettings("owner@example.com"), emailEnabled: false } });
  await alerts.notify("student_signup", { title: "New student: Bo", summary: "@bo" });
  assert.equal(emails.length, 0);
  assert.equal(rows.length, 2);
});

test("alerts the bell already shows from live state make no stored notification", async () => {
  const { alerts, rows, emails } = setup();
  await alerts.notify("ai_quiz_review", { title: "AI quiz needs review: “Holes”", summary: "Ana", row: false });
  assert.equal(rows.length, 0);
  assert.equal(emails.length, 1);
});

test("alerts within a minute of an email are combined into one email", async () => {
  const { alerts, emails, advance, state } = setup();
  await alerts.notify("quiz_completed", quiz("Ana"));
  assert.equal(emails.length, 1, "the first goes straight away");
  await advance(5_000);
  await alerts.notify("quiz_completed", quiz("Ben"));
  await advance(5_000);
  await alerts.notify("student_signup", { title: "New student: Cy", summary: "@cy" });
  assert.equal(emails.length, 1, "the next ones wait");
  await advance(BUNDLE_WINDOW_MS);
  assert.equal(emails.length, 2);
  assert.equal(emails[1].subject, "2 new alerts: 1 quiz taken, 1 new student · A.R.I.S.E Reader");
  assert.ok(emails[1].html.includes("Ben") && emails[1].html.includes("Cy"));
  assert.deepEqual(state().log[0].events, ["quiz_completed", "student_signup"]);
  // after a quiet minute the next alert goes straight away again
  await advance(BUNDLE_WINDOW_MS + 1);
  await alerts.notify("quiz_completed", quiz("Dee"));
  assert.equal(emails.length, 3);
});

test("with combining off, every alert is its own email", async () => {
  const { alerts, emails } = setup({ settings: { ...defaultAlertSettings("owner@example.com"), bundle: false } });
  await alerts.notify("quiz_completed", quiz("Ana"));
  await alerts.notify("quiz_completed", quiz("Ben"));
  assert.equal(emails.length, 2);
});

test("the daily limit stops alert emails for the rest of the day and says so once", async () => {
  const { alerts, emails, advance, state } = setup({ settings: { ...defaultAlertSettings("owner@example.com"), dailyLimit: 2, bundle: false } });
  await alerts.notify("quiz_completed", quiz("Ana"));
  await alerts.notify("quiz_completed", quiz("Ben"));
  await alerts.notify("quiz_completed", quiz("Cy"));
  await alerts.notify("quiz_completed", quiz("Dee"));
  assert.equal(emails.length, 2);
  const log = state().log;
  assert.equal(log.filter((e: any) => e.status === "skipped").length, 1);
  assert.match(log[0].detail, /limit of 2/);
  // a new day in Mountain Time starts over
  await advance(24 * 60 * 60 * 1000);
  await alerts.notify("quiz_completed", quiz("Eve"));
  assert.equal(emails.length, 3);
});

test("a failed email is logged with the reason and doesn't count toward the limit", async () => {
  const { alerts, rows, state } = setup({ sendOk: false });
  await alerts.notify("student_signup", { title: "New student: Bo", summary: "@bo" });
  assert.equal(rows.length, 2, "the bell still gets it");
  const saved = state();
  assert.equal(saved.count, 0);
  assert.equal(saved.log[0].status, "failed");
  assert.match(saved.log[0].detail, /403/);
});

test("nothing is emailed when the server has no email key, and no addresses means no email", async () => {
  const off = setup({ emailConfigured: false });
  await off.alerts.notify("student_signup", { title: "New student: Bo", summary: "@bo" });
  assert.equal(off.emails.length, 0);
  assert.equal(off.rows.length, 2);
  const none = setup({ settings: { ...defaultAlertSettings("owner@example.com"), recipients: [] } });
  await none.alerts.notify("student_signup", { title: "New student: Bo", summary: "@bo" });
  assert.equal(none.emails.length, 0);
});

test("a broken database or email service never throws into the request", async () => {
  const { alerts } = setup();
  const broken = createAdminAlerts({
    readSetting: async () => { throw new Error("db down"); },
    upsertSetting: async () => { throw new Error("db down"); },
    adminIds: async () => { throw new Error("db down"); },
    insertNotifications: async () => { throw new Error("db down"); },
    sendEmail: async () => { throw new Error("network"); },
    emailConfigured: () => true,
    fromAddress: "x", fallbackRecipient: "owner@example.com", appUrl: "https://a.b", log: () => {},
  });
  await broken.notify("quiz_completed", quiz("Ana"));
  await alerts.notify("quiz_completed", quiz("Ana"));
});

test("the test email goes out whatever the switches say, and explains what's missing", async () => {
  const { alerts, emails, state } = setup({ settings: { ...defaultAlertSettings("owner@example.com"), emailEnabled: false } });
  const result = await alerts.sendTest();
  assert.equal(result.sent, true);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].subject, "Test alert · A.R.I.S.E Reader");
  assert.equal(state().log[0].events[0], "test");
  const noKey = setup({ emailConfigured: false });
  assert.match((await noKey.alerts.sendTest()).error || "", /RESEND_API_KEY/);
  const noAddress = setup({ settings: { recipients: [] } });
  assert.match((await noAddress.alerts.sendTest()).error || "", /email address/);
});

test("saving settings takes effect at once and status reports today's count", async () => {
  const { alerts, emails } = setup();
  await alerts.saveSettings({ ...defaultAlertSettings("owner@example.com"), recipients: ["new@school.org"] });
  await alerts.notify("parent_signup", { title: "New parent: Pat", summary: "@pat" });
  assert.deepEqual(emails[0].to, ["new@school.org"]);
  const status = await alerts.status();
  assert.equal(status.email.sentToday, 1);
  assert.equal(status.email.configured, true);
  assert.equal(status.log.length, 1);
});

test("names in emails are escaped, never sent as HTML", () => {
  const html = alertEmailHtml([{ event: "student_signup", alert: { title: "New student: <img src=x onerror=alert(1)>", summary: "", lines: [["Name", "<b>Bo</b>"]] } }], "https://a.b");
  assert.ok(!html.includes("<img") && !html.includes("<b>Bo"));
  assert.equal(escapeHtml(`"&'<>`), "&quot;&amp;&#39;&lt;&gt;");
  const subject = alertEmailSubject(Array.from({ length: 5 }, (_, i) => ({ event: (["quiz_completed", "student_signup", "parent_signup", "club_signup", "quiz_completed"] as const)[i], alert: { title: "t", summary: "" } })));
  assert.equal(subject, "5 new alerts: 2 quizzes taken, 1 new student, 1 new parent, and more · A.R.I.S.E Reader");
});

test("the day rolls over at midnight Mountain Time", () => {
  assert.equal(dayInZone(Date.parse("2026-10-05T05:59:00Z"), "America/Denver"), "2026-10-04");
  assert.equal(dayInZone(Date.parse("2026-10-05T06:01:00Z"), "America/Denver"), "2026-10-05");
});
