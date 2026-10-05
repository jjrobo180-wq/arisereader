// Teacher sign-up: a school email is required, and typing the code sent to it turns the account on with no wait for the admin.
// Run with: npx tsx --test tests/teacher-signup.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkSchoolEmail } from "../shared/schoolEmail";
import {
  CODE_MINUTES, MAX_SENDS_PER_DAY, MAX_TRIES, RESEND_WAIT_SECONDS,
  confirmTeacherEmail, createTeacherEmailCodes, resendTeacherCode,
  teacherEmailCodeEmail, teacherJoinedNotifyEmail, teacherWelcomeEmail,
  type TeacherAccount, type TeacherConfirmDeps,
} from "../server/teacherSignup";

// ─── The school email rule ───────────────────────────────────────────────────

test("a teacher's email must end in .edu, .net, .org or .us", () => {
  for (const email of ["ms.rivera@lincoln.edu", "jsmith@dpsk12.net", "t.jones@cherrycreekschools.org", "a@mail.school.k12.org", "teacher@district.k12.co.us", "teacher@pueblocityschools.us"]) {
    assert.deepEqual(checkSchoolEmail(email), { ok: true, email }, email);
  }
  // tidied up: trimmed and lower case
  assert.deepEqual(checkSchoolEmail("  Ms.Rivera@Lincoln.EDU "), { ok: true, email: "ms.rivera@lincoln.edu" });
});

test("every other ending is refused, .com first of all", () => {
  for (const email of ["teacher@gmail.com", "teacher@school.com", "teacher@outlook.com", "teacher@school.co", "teacher@school.uk", "teacher@school.us.com", "teacher@school.io", "teacher@school.edu.mx", "teacher@school.academy"]) {
    const result = checkSchoolEmail(email);
    assert.equal(result.ok, false, email);
    if (!result.ok) assert.match(result.message, /\.edu, \.net, \.org or \.us/, email);
  }
  // the ending is the very end of the address, not something inside it
  assert.equal(checkSchoolEmail("teacher@school.edu.com").ok, false);
  assert.equal(checkSchoolEmail("teacher.org@gmail.com").ok, false);
  assert.equal(checkSchoolEmail("teacher@org").ok, false);
});

test("a personal mailbox that happens to end in .net or .org is not a school email", () => {
  for (const email of ["me@comcast.net", "me@att.net", "me@sbcglobal.net", "me@mail.comcast.net", "me@mailinator.org", "me@gmx.net"]) {
    const result = checkSchoolEmail(email);
    assert.equal(result.ok, false, email);
    if (!result.ok) assert.match(result.message, /personal email/, email);
  }
  // a school whose name only ends like a provider's is fine
  assert.equal(checkSchoolEmail("me@notcomcast.net").ok, true);
});

test("something that isn't an email address is refused", () => {
  for (const email of ["", "   ", null, undefined, "teacher", "teacher@", "@school.org", "a b@school.org", "a@b@school.org", "teacher@school..org", "teacher@-school.org", "teacher@school.org>", `${"a".repeat(260)}@school.org`]) {
    assert.equal(checkSchoolEmail(email).ok, false, String(email));
  }
});

// ─── The code ────────────────────────────────────────────────────────────────

function codeStore(codes: string[] = ["123456", "222222", "333333", "444444", "555555", "666666", "777777"]) {
  const settings: Record<string, string> = {};
  const clock = { now: Date.parse("2026-10-05T15:00:00Z") };
  let next = 0;
  const store = createTeacherEmailCodes({
    readSetting: async (key) => settings[key] || "",
    upsertSetting: async (key, value) => { settings[key] = value; },
    now: () => clock.now,
    makeCode: () => codes[next++ % codes.length],
  });
  return { store, settings, clock, pass: (seconds: number) => { clock.now += seconds * 1000; } };
}

test("the right code works once", async () => {
  const { store, settings } = codeStore();
  const issued = await store.issue(7);
  assert.deepEqual(issued, { ok: true, code: "123456" });
  assert.equal(await store.waiting(7), true);
  assert.equal(JSON.stringify(settings).includes("123456"), false, "the code itself is never stored");
  assert.equal(await store.check(8, "123456"), "none", "another account's code is no use");
  assert.equal(await store.check(7, " 123 456 "), "ok", "spaces typed with the code don't matter");
  assert.equal(await store.waiting(7), false);
  assert.equal(await store.check(7, "123456"), "none", "a used code is gone");
});

test("a real code is six random digits", async () => {
  const settings: Record<string, string> = {};
  const store = createTeacherEmailCodes({ readSetting: async (k) => settings[k] || "", upsertSetting: async (k, v) => { settings[k] = v; } });
  const issued = await store.issue(1);
  assert.equal(issued.ok, true);
  if (issued.ok) assert.match(issued.code, /^\d{6}$/);
});

test("wrong guesses run out, and then even the right code needs a fresh one", async () => {
  const { store, pass } = codeStore();
  await store.issue(7);
  for (let i = 1; i < MAX_TRIES; i++) assert.equal(await store.check(7, "000000"), "wrong", `guess ${i}`);
  assert.equal(await store.check(7, "000000"), "locked");
  assert.equal(await store.check(7, "123456"), "locked");
  for (const junk of ["", null, "12345", "1234567", "abcdef"]) assert.equal(await store.check(7, junk), "locked");
  pass(RESEND_WAIT_SECONDS);
  assert.deepEqual(await store.issue(7), { ok: true, code: "222222" });
  assert.equal(await store.check(7, "123456"), "wrong", "the old code died with the new one");
  assert.equal(await store.check(7, "222222"), "ok");
});

test("two guesses sent at the same moment both count", async () => {
  const { store } = codeStore();
  await store.issue(7);
  const results = await Promise.all(Array.from({ length: MAX_TRIES + 3 }, () => store.check(7, "000000")));
  assert.equal(results.filter((r) => r === "wrong").length, MAX_TRIES - 1);
  assert.equal(results.filter((r) => r === "locked").length, 4);
});

test("a code runs out after half an hour", async () => {
  const { store, pass } = codeStore();
  await store.issue(7);
  pass(CODE_MINUTES * 60 - 1);
  assert.equal(await store.check(7, "000000"), "wrong");
  pass(2);
  assert.equal(await store.check(7, "123456"), "expired");
  assert.equal(await store.waiting(7), true, "still on the list, so the login page can offer a new code");
});

test("new codes are spaced out and capped for the day", async () => {
  const { store, pass } = codeStore();
  assert.equal((await store.issue(7)).ok, true);
  assert.deepEqual(await store.issue(7), { ok: false, why: "wait", waitSeconds: RESEND_WAIT_SECONDS });
  pass(20);
  assert.deepEqual(await store.issue(7), { ok: false, why: "wait", waitSeconds: RESEND_WAIT_SECONDS - 20 });
  for (let sent = 1; sent < MAX_SENDS_PER_DAY; sent++) { pass(RESEND_WAIT_SECONDS); assert.equal((await store.issue(7)).ok, true, `code ${sent + 1}`); }
  pass(RESEND_WAIT_SECONDS);
  assert.deepEqual(await store.issue(7), { ok: false, why: "limit" });
  assert.equal((await store.issue(8)).ok, true, "another account is not held up");
  pass(24 * 3600);
  assert.equal((await store.issue(7)).ok, true, "the count starts over the next day");
});

test("a forgotten code is gone, and old ones are cleared out", async () => {
  const { store, settings, pass } = codeStore();
  await store.issue(7);
  await store.forget(7);
  assert.equal(await store.waiting(7), false);
  assert.equal(await store.check(7, "123456"), "none");
  await store.issue(8);
  pass(8 * 24 * 3600);
  await store.issue(9);
  assert.deepEqual(Object.keys(JSON.parse(settings.teacher_email_codes)), ["9"]);
});

test("a database that can't be read is an error, never 'no code'", async () => {
  const store = createTeacherEmailCodes({ readSetting: async () => { throw new Error("database is down"); }, upsertSetting: async () => {} });
  await assert.rejects(store.check(7, "123456"), /database is down/);
  await assert.rejects(store.waiting(7), /database is down/);
  // and the store keeps working afterwards
  await assert.rejects(store.issue(7), /database is down/);
});

// ─── Confirming, and asking for another code ─────────────────────────────────

function signup(over: Partial<TeacherAccount> = {}) {
  const { store, pass } = codeStore();
  const users: Record<string, TeacherAccount> = {
    "ms.rivera": { id: 7, username: "ms.rivera", displayName: "Ms. Rivera", role: "teacher", accountApproved: false, email: "rivera@lincoln.edu", archivedAt: null, ...over },
    "mr.early": { id: 8, username: "mr.early", displayName: "Mr. Early", role: "teacher", accountApproved: false, email: "early@gmail.com", archivedAt: null },
    "mr.j": { id: 9, username: "mr.j", displayName: "Mr. J", role: "teacher", accountApproved: true, email: "mrj@gmail.com", archivedAt: null },
    kid: { id: 10, username: "kid", displayName: "Kid", role: "student", accountApproved: true, email: null, archivedAt: null },
  };
  const log = { turnedOn: [] as number[], joined: [] as string[], sent: [] as Array<{ to: string; code: string }>, emailWorks: true };
  const deps: TeacherConfirmDeps = {
    codes: store,
    findUser: async (username) => users[username],
    turnOn: async (userId) => { log.turnedOn.push(userId); for (const u of Object.values(users)) if (u.id === userId) u.accountApproved = true; },
    sendCode: async (account, code) => { if (!log.emailWorks) return false; log.sent.push({ to: String(account.email), code }); return true; },
    joined: (account) => { log.joined.push(account.username); },
  };
  return { deps, store, users, log, pass };
}

test("typing the right code turns the account on at once", async () => {
  const { deps, store, users, log } = signup();
  await store.issue(7);
  const wrong = await confirmTeacherEmail(deps, { username: "ms.rivera", code: "999999" });
  assert.equal(wrong.status, 400);
  assert.deepEqual(log.turnedOn, []);
  const right = await confirmTeacherEmail(deps, { username: " Ms.Rivera ", code: "123456" });
  assert.equal(right.status, 200);
  assert.equal(right.body.success, true);
  assert.deepEqual(log.turnedOn, [7]);
  assert.deepEqual(log.joined, ["ms.rivera"]);
  assert.equal(users["ms.rivera"].accountApproved, true);
  // asking again is harmless
  const again = await confirmTeacherEmail(deps, { username: "ms.rivera", code: "123456" });
  assert.equal(again.status, 200);
  assert.equal(again.body.alreadyOn, true);
  assert.deepEqual(log.turnedOn, [7]);
});

test("no code, no account: guessing, a run-out code and other people's accounts all fail", async () => {
  const { deps, store, log, pass } = signup();
  assert.equal((await confirmTeacherEmail(deps, { username: "ms.rivera", code: "123456" })).status, 400, "no code was ever sent");
  await store.issue(7);
  for (const body of [{ username: "nobody", code: "123456" }, { username: "kid", code: "123456" }, { code: "123456" }, {}, null, { username: "ms.rivera" }, { username: "ms.rivera", code: "" }]) {
    assert.notEqual((await confirmTeacherEmail(deps, body)).status, 200, JSON.stringify(body));
  }
  pass(CODE_MINUTES * 60 + 1);
  const late = await confirmTeacherEmail(deps, { username: "ms.rivera", code: "123456" });
  assert.equal(late.status, 400);
  assert.match(String(late.body.message), /run out/);
  assert.deepEqual(log.turnedOn, []);
});

test("an archived account can't be turned on with a code", async () => {
  const { deps, store, log } = signup({ archivedAt: "2026-10-01T00:00:00Z" });
  await store.issue(7);
  assert.equal((await confirmTeacherEmail(deps, { username: "ms.rivera", code: "123456" })).status, 400);
  assert.deepEqual(log.turnedOn, []);
});

test("the account is still on when the welcome email fails", async () => {
  const { deps, store, log } = signup();
  deps.joined = () => { throw new Error("email is down"); };
  await store.issue(7);
  assert.equal((await confirmTeacherEmail(deps, { username: "ms.rivera", code: "123456" })).status, 200);
  assert.deepEqual(log.turnedOn, [7]);
});

test("a new code can be asked for, within the limits", async () => {
  const { deps, log, pass } = signup();
  const first = await resendTeacherCode(deps, { username: "ms.rivera" });
  assert.equal(first.status, 200);
  assert.deepEqual(log.sent, [{ to: "rivera@lincoln.edu", code: "123456" }]);
  const tooSoon = await resendTeacherCode(deps, { username: "ms.rivera" });
  assert.equal(tooSoon.status, 429);
  assert.match(String(tooSoon.body.message), /wait 60 seconds/);
  pass(RESEND_WAIT_SECONDS);
  log.emailWorks = false;
  assert.equal((await resendTeacherCode(deps, { username: "ms.rivera" })).status, 503);
  // an email that never went out doesn't make them wait: they can try again straight away
  log.emailWorks = true;
  assert.equal((await resendTeacherCode(deps, { username: "ms.rivera" })).status, 200);
  assert.equal(log.sent.length, 2);
  assert.equal((await confirmTeacherEmail(deps, { username: "ms.rivera", code: log.sent[log.sent.length - 1].code })).status, 200);
  assert.deepEqual(log.turnedOn, [7]);
});

test("teachers from before the rule are left as they were", async () => {
  const { deps, log } = signup();
  // waiting for the admin with a .com address: no code is sent, the admin still approves them
  const early = await resendTeacherCode(deps, { username: "mr.early" });
  assert.equal(early.status, 400);
  assert.match(String(early.body.message), /site admin/);
  // already approved with a .com address: nothing changes
  const approved = await resendTeacherCode(deps, { username: "mr.j" });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.alreadyOn, true);
  assert.deepEqual(log.sent, []);
  assert.deepEqual(log.turnedOn, []);
  assert.equal((await resendTeacherCode(deps, { username: "kid" })).status, 400);
});

// ─── The emails ──────────────────────────────────────────────────────────────

test("the emails carry the code and never raw HTML from a name", () => {
  const codeEmail = teacherEmailCodeEmail("<img src=x onerror=alert(1)>", "123456");
  assert.ok(codeEmail.includes("123456"));
  assert.ok(!codeEmail.includes("<img"));
  assert.ok(codeEmail.includes(`${CODE_MINUTES} minutes`));
  const welcome = teacherWelcomeEmail("Ms. Rivera", "ms.rivera", "https://arisereader.com");
  assert.ok(welcome.includes("ms.rivera") && welcome.includes('href="https://arisereader.com"'));
  const notify = teacherJoinedNotifyEmail("Ms. <b>Rivera</b>", "ms.rivera", "rivera@lincoln.edu", "https://arisereader.com");
  assert.ok(notify.includes("rivera@lincoln.edu") && !notify.includes("<b>Rivera"));
});

// ─── How the sign-up route uses all this ─────────────────────────────────────

test("the sign-up route checks the email before it makes anything, and never turns the account on by itself", () => {
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  const start = routes.indexOf('app.post("/api/auth/register-teacher"');
  const end = routes.indexOf('app.post("/api/auth/confirm-teacher-email"');
  assert.ok(start > 0 && end > start);
  const route = routes.slice(start, end);
  const at = (text: string) => { const i = route.indexOf(text); assert.ok(i >= 0, `missing: ${text}`); return i; };
  assert.ok(at("checkSchoolEmail(email)") < at("storage.getUserByUsername("));
  assert.ok(at("checkSchoolEmail(email)") < at("schoolPicker.pick("));
  assert.ok(at("schoolPicker.pick(") < at("storage.createUser("));
  assert.ok(at("accountApproved: false") > at("storage.createUser("));
  assert.ok(!route.includes("accountApproved: true"));
  assert.ok(!route.includes("approveTeacherAccount"));
  assert.ok(at("teacherEmailCodes.issue(user.id)") > at("storage.createUser("));
  // logging in still refuses an account that is off
  const login = routes.slice(routes.indexOf('app.post("/api/login"'), routes.indexOf('app.post("/api/logout"'));
  assert.ok(login.includes("(user.role === 'teacher' || user.role === 'parent') && !user.accountApproved"));
});
