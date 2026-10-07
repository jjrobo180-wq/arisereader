// A teacher or the admin emails a student's parent (who has no account yet) what the program is and how to sign up.
// Run with: npx tsx --test tests/parent-invite-email.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INVITES_PER_ADDRESS_PER_DAY, KEPT_PER_STUDENT, PARENT_INVITE_LOG_KEY, STAFF_INVITES_PER_DAY, cleanParentEmail, inviteSummary, invitesFor, readInviteLog, recordInvite, sentInLastDay } from "../shared/parentInvites";
import { listParentInvites, sendParentInvite, type InviteSender, type ParentInviteDeps } from "../server/parentInviteEmails";
import { parentProgramEmail } from "../server/emailFormat";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const NOW = Date.parse("2026-10-07T16:30:00.000Z");
const ORIGIN = "https://www.arisereader.com";
const admin: InviteSender = { id: 1, displayName: "Mr. Robinson", isAdmin: true, role: "admin", email: "jrobinson@school.example" };
const teacher: InviteSender = { id: 20, displayName: "Ms. Lee", role: "teacher", accountApproved: true, email: "lee@school.example" };

function site(start: { log?: string; configured?: boolean; sendOk?: boolean; linked?: string[] } = {}) {
  const settings = new Map<string, string>(start.log ? [[PARENT_INVITE_LOG_KEY, start.log]] : []);
  const sent: { to: string; subject: string; html: string; options: { replyTo?: string; fromName?: string } }[] = [];
  let clock = NOW;
  const deps: ParentInviteDeps = {
    getStudent: async (id) => ({
      5: { id: 5, displayName: "Dennis Flores", role: "student", teacherId: 20 },
      6: { id: 6, displayName: "Maya <b>Torres</b>", role: "student", teacherId: 99 },
      7: { id: 7, displayName: "A Parent", role: "parent", teacherId: null },
    } as Record<number, any>)[id] || null,
    getSetting: async (key) => settings.get(key) ?? "",
    saveSetting: async (key, value) => { settings.set(key, value); },
    parentCode: async (studentId) => ({ formattedCode: `AB12-CD34-EF56-7890-00${String(studentId).padStart(2, "0")}` }),
    linkedParentEmails: async () => start.linked || [],
    emailConfigured: () => start.configured !== false,
    sendEmail: async (to, subject, html, options) => { sent.push({ to, subject, html, options }); return start.sendOk === false ? { sent: false, error: "Email API error 500" } : { sent: true }; },
    siteUrl: ORIGIN,
    now: () => clock,
  };
  return { deps, sent, log: () => readInviteLog(settings.get(PARENT_INVITE_LOG_KEY)), later: (ms: number) => { clock += ms; } };
}

test("the parent gets one email that explains the program, the parent account and how to sign up", async () => {
  const s = site();
  const reply = await sendParentInvite(s.deps, teacher, { studentId: 5, email: "  Mom.Flores@Example.com " }, ORIGIN + "/");
  assert.equal(reply.status, 200);
  assert.equal(reply.body.message, "Invitation sent to mom.flores@example.com.");
  assert.equal(s.sent.length, 1);
  const mail = s.sent[0];
  assert.equal(mail.to, "mom.flores@example.com");
  assert.equal(mail.subject, "Ms. Lee invited you to follow Dennis Flores's reading on A.R.I.S.E. Reader");
  assert.deepEqual(mail.options, { fromName: "Ms. Lee", replyTo: "lee@school.example" }, "it comes in the teacher's name and a reply goes to the teacher");
  for (const part of [
    "Ms. Lee uses A.R.I.S.E. Reader with Dennis Flores",
    "You don't need an account yet",
    "What it is", "A score of 70% or higher earns that book's points",
    "What a parent account does", "quiz history and reading growth", "Parent Proctor Code", "parent controls", "It is free, and one parent account can follow up to 5 children",
    "How to sign up", "code is already filled in", "choose a username and a password",
    'href="https://www.arisereader.com/#/parent-signup?code=AB12-CD34-EF56-7890-0005"', "Create your free parent account",
    "AB12-CD34-EF56-7890-0005", "www.arisereader.com/#/parent-signup", "Already have a parent account?",
    "If you don't know Dennis Flores, you can ignore this email.",
  ]) assert.ok(mail.html.includes(part), part);
  assert.deepEqual(reply.body.invites, [{ email: "mom.flores@example.com", sentAt: new Date(NOW).toISOString(), byName: "Ms. Lee", times: 1 }]);
  assert.deepEqual(invitesFor(s.log(), 5), [{ email: "mom.flores@example.com", sentAt: new Date(NOW).toISOString(), by: 20, byName: "Ms. Lee" }]);
});

test("names are shown as text, never as part of the page", () => {
  const html = parentProgramEmail({ studentName: 'Maya <b>Torres</b>', senderName: 'Mr. "R" <script>', signupUrl: 'https://x.example/#/parent-signup?code=A&b="1"', code: "A<1>" });
  assert.ok(!/<b>Torres|<script>|"1""/.test(html));
  assert.ok(html.includes("Maya &lt;b&gt;Torres&lt;/b&gt;") && html.includes("Mr. &quot;R&quot; &lt;script&gt;") && html.includes("A&lt;1&gt;"));
  assert.ok(html.includes('href="https://x.example/#/parent-signup?code=A&amp;b=&quot;1&quot;"'));
});

test("only the admin, or the student's own teacher, can write to a student's parents", async () => {
  const s = site();
  assert.deepEqual(await sendParentInvite(s.deps, teacher, { studentId: 6, email: "a@b.com" }, ORIGIN), { status: 404, body: { message: "That student is not on your roster." } }, "another teacher's student");
  assert.equal((await sendParentInvite(s.deps, admin, { studentId: 6, email: "a@b.com" }, ORIGIN)).status, 200, "the admin can, for any student");
  assert.equal(s.sent[0].options.replyTo, "jrobinson@school.example");
  assert.equal((await sendParentInvite(s.deps, admin, { studentId: 7, email: "a@b.com" }, ORIGIN)).status, 404, "a parent account is not a student");
  assert.equal((await sendParentInvite(s.deps, admin, { studentId: 404, email: "a@b.com" }, ORIGIN)).status, 404);
  assert.equal((await sendParentInvite(s.deps, admin, { studentId: "abc", email: "a@b.com" }, ORIGIN)).status, 400);
  assert.equal((await sendParentInvite(s.deps, { id: 30, role: "student" }, { studentId: 5, email: "a@b.com" }, ORIGIN)).status, 403);
  assert.equal((await sendParentInvite(s.deps, { id: 31, role: "parent" }, { studentId: 5, email: "a@b.com" }, ORIGIN)).status, 403);
  assert.equal((await sendParentInvite(s.deps, { ...teacher, accountApproved: false }, { studentId: 5, email: "a@b.com" }, ORIGIN)).status, 403, "a teacher who is not approved yet");
  assert.equal((await listParentInvites(s.deps, teacher, 6)).status, 404);
  assert.equal(s.sent.length, 1, "nothing else went out");
});

test("a bad address, a parent who is already connected, or email being off: nothing is sent", async () => {
  const s = site({ linked: ["Mom.Flores@example.com"] });
  for (const bad of ["", "mom", "mom@", "mom@example", "a b@example.com", "mom@example.com, dad@example.com", "<mom@example.com>"]) {
    assert.equal((await sendParentInvite(s.deps, teacher, { studentId: 5, email: bad }, ORIGIN)).status, 400, bad || "(empty)");
  }
  const linked = await sendParentInvite(s.deps, teacher, { studentId: 5, email: "mom.flores@example.com" }, ORIGIN);
  assert.deepEqual(linked, { status: 409, body: { message: "mom.flores@example.com already has a parent account connected to Dennis Flores. Nothing was sent." } });
  const off = site({ configured: false });
  assert.equal((await sendParentInvite(off.deps, teacher, { studentId: 5, email: "dad@example.com" }, ORIGIN)).status, 503);
  assert.equal((await listParentInvites(off.deps, teacher, 5)).body.emailReady, false);
  const down = site({ sendOk: false });
  const failed = await sendParentInvite(down.deps, teacher, { studentId: 5, email: "dad@example.com" }, ORIGIN);
  assert.equal(failed.status, 503);
  assert.match(String(failed.body.message), /Nothing was sent/);
  assert.deepEqual(down.log(), {}, "a send that failed is not listed as sent");
  assert.equal(s.sent.length + off.sent.length, 0);
});

test("limits keep an inbox from being filled", async () => {
  const s = site();
  for (let i = 0; i < INVITES_PER_ADDRESS_PER_DAY; i++) assert.equal((await sendParentInvite(s.deps, teacher, { studentId: 5, email: "dad@example.com" }, ORIGIN)).status, 200);
  const again = await sendParentInvite(s.deps, admin, { studentId: 5, email: "dad@example.com" }, ORIGIN);
  assert.equal(again.status, 429, "the same address, whoever asks");
  assert.equal(s.sent.length, INVITES_PER_ADDRESS_PER_DAY);
  assert.deepEqual((await listParentInvites(s.deps, teacher, 5)).body.invites, [{ email: "dad@example.com", sentAt: new Date(NOW).toISOString(), byName: "Ms. Lee", times: 2 }]);
  s.later(24 * 60 * 60 * 1000);
  assert.equal((await sendParentInvite(s.deps, teacher, { studentId: 5, email: "dad@example.com" }, ORIGIN)).status, 200, "the next day it can be sent again");
  // One person's daily total.
  let log = {};
  for (let i = 0; i < STAFF_INVITES_PER_DAY; i++) log = recordInvite(log, 1000 + i, { email: `p${i}@example.com`, sentAt: new Date(NOW - 1000).toISOString(), by: 20, byName: "Ms. Lee" });
  const full = site({ log: JSON.stringify(log) });
  assert.equal((await sendParentInvite(full.deps, teacher, { studentId: 5, email: "new@example.com" }, ORIGIN)).status, 429);
  assert.equal((await sendParentInvite(full.deps, admin, { studentId: 5, email: "new@example.com" }, ORIGIN)).status, 200, "someone else still can");
});

test("the list of who was invited is kept tidy", () => {
  assert.equal(cleanParentEmail(" Mom@Example.COM "), "mom@example.com");
  for (const bad of [null, undefined, 5, "mom@example", "mom@@example.com", "mom@example.c", `${"a".repeat(250)}@example.com`]) assert.equal(cleanParentEmail(bad), null, String(bad));
  let log = {};
  for (let i = 0; i < KEPT_PER_STUDENT + 3; i++) log = recordInvite(log, 5, { email: `p${i % 2}@example.com`, sentAt: new Date(NOW + i * 1000).toISOString(), by: 20, byName: "Ms. Lee" });
  assert.equal(invitesFor(log, 5).length, KEPT_PER_STUDENT, "only the newest are kept");
  assert.equal(invitesFor(log, 5)[0].sentAt, new Date(NOW + (KEPT_PER_STUDENT + 2) * 1000).toISOString());
  assert.deepEqual(inviteSummary(invitesFor(log, 5)).map((x) => [x.email, x.times]), [["p0@example.com", 4], ["p1@example.com", 4]]);
  assert.equal(sentInLastDay(log, { by: 20 }, NOW + 60_000), KEPT_PER_STUDENT);
  assert.equal(sentInLastDay(log, { email: "p1@example.com" }, NOW + 60_000), 4);
  assert.equal(sentInLastDay(log, { by: 20 }, NOW + 25 * 60 * 60 * 1000), 0);
  // Whatever is stored, the page never breaks on it.
  assert.deepEqual(readInviteLog("not json"), {});
  assert.deepEqual(readInviteLog(JSON.stringify([1, 2])), {});
  assert.deepEqual(readInviteLog(JSON.stringify({ 5: [{ email: "x" }, null, { email: "Ok@Example.com", sentAt: "2026-10-07T16:30:00Z", by: "20" }], abc: [], 6: "no" })), { 5: [{ email: "ok@example.com", sentAt: "2026-10-07T16:30:00.000Z", by: 20, byName: "" }] });
  assert.deepEqual(readInviteLog(JSON.stringify(log)), log);
});

test("the box is on the admin's student details and the teacher's parent screen, and the routes need a sign-in", () => {
  const adminPage = read("client/src/pages/Admin.tsx"), teacherPage = read("client/src/pages/TeacherDashboard.tsx"), routes = read("server/routes.ts"), box = read("client/src/components/ParentEmailInvite.tsx"), server = read("server/parentInviteEmails.ts");
  assert.ok(adminPage.includes("<ParentEmailInvite studentId={detailStudent.id} studentName={detailStudent.displayName} />"));
  assert.ok(teacherPage.includes("<ParentEmailInvite studentId={student.id} studentName={student.displayName} />"));
  assert.ok(routes.includes("registerParentInviteEmailRoutes(app, authMiddleware, {"));
  for (const part of ['app.get("/api/parent-invites/emails/:studentId", auth,', 'app.post("/api/parent-invites/email", auth,']) assert.ok(server.includes(part), part);
  for (const part of ['data-testid="parent-email-input"', "They don't need an account.", "Send invitation", "Send again"]) assert.ok(box.includes(part), part);
});
