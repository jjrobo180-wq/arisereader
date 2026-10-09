// A teacher or the admin emails a student's parent (who has no account yet) what the program is and how to sign up.
// Run with: npx tsx --test tests/parent-invite-email.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHILD_NAME_MAX, INVITES_PER_ADDRESS_PER_DAY, KEPT_NEW_FAMILIES, KEPT_PER_STUDENT, NEW_FAMILY_KEY, PARENT_INVITE_LOG_KEY, STAFF_INVITES_PER_DAY, cleanChildName, cleanParentEmail, inviteSummary, invitesFor, readInviteLog, recordInvite, sentInLastDay } from "../shared/parentInvites";
import { inviteTemplate, listFamilyInvites, listParentInvites, sendFamilyInvite, sendParentInvite, type InviteSender, type ParentInviteDeps } from "../server/parentInviteEmails";
import { familyInviteEmail, familyInviteText, parentProgramEmail, parentProgramText } from "../server/emailFormat";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const NOW = Date.parse("2026-10-07T16:30:00.000Z");
const ORIGIN = "https://www.arisereader.com";
const admin: InviteSender = { id: 1, displayName: "Mr. Robinson", isAdmin: true, role: "admin", email: "jrobinson@school.example" };
const teacher: InviteSender = { id: 20, displayName: "Ms. Lee", role: "teacher", accountApproved: true, email: "lee@school.example", school_id: 3 };

function site(start: { log?: string; configured?: boolean; sendOk?: boolean; linked?: string[]; parents?: string[] } = {}) {
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
    parentAccountEmails: async () => start.parents || [],
    schoolName: async (id) => (id === 3 ? "Lincoln Elementary" : null),
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
    "Dennis already has a student account. To follow along you will need a free parent account",
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
  const adminPage = read("client/src/pages/Admin.tsx"), teacherPage = read("client/src/components/teacher-hub/HubReaderTools.tsx"), routes = read("server/routes.ts"), box = read("client/src/components/ParentEmailInvite.tsx"), server = read("server/parentInviteEmails.ts");
  assert.ok(adminPage.includes("<ParentEmailInvite studentId={detailStudent.id} studentName={detailStudent.displayName} />"));
  assert.ok(teacherPage.includes('<HubParentInvite which="work" studentId={s.id} studentName={s.displayName} />'));
  assert.ok(routes.includes("registerParentInviteEmailRoutes(app, authMiddleware, {"));
  for (const part of ['app.get("/api/parent-invites/emails/:studentId", auth,', 'app.post("/api/parent-invites/email", auth,']) assert.ok(server.includes(part), part);
  for (const part of ['data-testid="parent-email-input"', "You can email a parent who hasn't signed up.", "Send invitation", "Send again"]) assert.ok(box.includes(part), part);
});

test("a family whose child has no account gets one email on how the child, then the parent, signs up", async () => {
  const s = site();
  const reply = await sendFamilyInvite(s.deps, teacher, { email: " New.Mom@Example.com ", childName: "  Jordan   Reyes " }, ORIGIN + "/");
  assert.equal(reply.status, 200);
  assert.equal(reply.body.message, "Invitation sent to new.mom@example.com.");
  assert.equal(s.sent.length, 1);
  const mail = s.sent[0];
  assert.equal(mail.to, "new.mom@example.com");
  assert.equal(mail.subject, "Ms. Lee invited your family to A.R.I.S.E. Reader");
  assert.deepEqual(mail.options, { fromName: "Ms. Lee", replyTo: "lee@school.example" });
  for (const part of [
    "Your family is invited to read with us", "Ms. Lee invited you and Jordan Reyes to join A.R.I.S.E. Reader", "It is free. Jordan will need a student account, and you will need a parent account.",
    "What it is", "A score of 70% or higher earns that book's points",
    "What you get as a parent", "See Jordan's quiz history and reading growth", "Parent Proctor Code", "follow up to 5 children",
    "How to sign up", "Jordan makes a student account.", ">Lincoln Elementary</strong> as the school, pick the grade, then choose", ">Ms. Lee</strong> as the teacher", "My teacher isn't listed",
    "Jordan logs in and opens Profile.", "Print / View My Parent Code", "You make your parent account</strong> with that code",
    'href="https://www.arisereader.com/#/register"', "Step 1: Create the student account",
    'href="https://www.arisereader.com/#/parent-signup"', 'href="https://www.arisereader.com/#/register-independent"', "independent reader",
    "If you don't know Ms. Lee, you can ignore this email.",
  ]) assert.ok(mail.html.includes(part), part);
  const row = { email: "new.mom@example.com", sentAt: new Date(NOW).toISOString(), byName: "Ms. Lee", times: 1, child: "Jordan Reyes" };
  assert.deepEqual(reply.body.invites, [row]);
  assert.deepEqual(invitesFor(s.log(), NEW_FAMILY_KEY), [{ email: "new.mom@example.com", sentAt: new Date(NOW).toISOString(), by: 20, byName: "Ms. Lee", child: "Jordan Reyes" }], "kept apart from any student");
  assert.deepEqual((await listFamilyInvites(s.deps, teacher)).body, { invites: [row], emailReady: true });

  // From the admin, and with no child's name, it says "your child" and names no teacher or school.
  const mine = await sendFamilyInvite(s.deps, admin, { email: "dad@example.com" }, ORIGIN);
  assert.equal(mine.status, 200);
  const plain = s.sent[1].html;
  for (const part of ["Mr. Robinson invited you and your child to join", "Your child will need a student account, and you will need a parent account.", "Your child makes a student account.", "choose the school, the grade and the teacher.", "See your child's quiz history"]) assert.ok(plain.includes(part), part);
  assert.ok(!plain.includes("Lincoln Elementary") && !plain.includes("undefined") && !plain.includes("null"));
  assert.deepEqual(invitesFor(s.log(), NEW_FAMILY_KEY)[0], { email: "dad@example.com", sentAt: new Date(NOW).toISOString(), by: 1, byName: "Mr. Robinson" });

  // The admin sees everyone's list, a teacher only their own.
  assert.deepEqual(((await listFamilyInvites(s.deps, admin)).body.invites as any[]).map((x) => x.email).sort(), ["dad@example.com", "new.mom@example.com"]);
  assert.deepEqual(((await listFamilyInvites(s.deps, teacher)).body.invites as any[]).map((x) => x.email), ["new.mom@example.com"]);
  assert.deepEqual(((await listFamilyInvites(s.deps, { ...teacher, id: 21 })).body.invites as any[]), []);
  assert.deepEqual((mine.body.invites as any[]).length, 2);
  // A teacher with no school on file still names themself.
  await sendFamilyInvite(s.deps, { ...teacher, id: 22, school_id: null }, { email: "aunt@example.com" }, ORIGIN);
  assert.ok(s.sent[2].html.includes("choose the school and the grade, then") && s.sent[2].html.includes(">Ms. Lee</strong> as the teacher"));
  assert.equal(invitesFor(s.log(), 5).length, 0, "no student's own list is touched");
});

test("a new-family invitation is held back when it should be", async () => {
  const s = site({ parents: ["Has.Account@Example.com"] });
  for (const who of [{ id: 30, role: "student" }, { id: 31, role: "parent" }, { ...teacher, accountApproved: false }]) {
    assert.equal((await sendFamilyInvite(s.deps, who, { email: "a@b.com" }, ORIGIN)).status, 403);
    assert.equal((await listFamilyInvites(s.deps, who)).status, 403);
  }
  for (const bad of ["", "mom", "mom@example", "mom@example.com, dad@example.com"]) assert.equal((await sendFamilyInvite(s.deps, teacher, { email: bad }, ORIGIN)).status, 400, bad || "(empty)");
  const has = await sendFamilyInvite(s.deps, teacher, { email: "has.account@example.com", childName: "Sam" }, ORIGIN);
  assert.equal(has.status, 409);
  assert.match(String(has.body.message), /already has a parent account.*Nothing was sent/);
  const off = site({ configured: false });
  assert.equal((await sendFamilyInvite(off.deps, teacher, { email: "a@b.com" }, ORIGIN)).status, 503);
  assert.equal((await listFamilyInvites(off.deps, teacher)).body.emailReady, false);
  const down = site({ sendOk: false });
  assert.equal((await sendFamilyInvite(down.deps, teacher, { email: "a@b.com" }, ORIGIN)).status, 503);
  assert.deepEqual(down.log(), {}, "a send that failed is not listed as sent");
  assert.equal(s.sent.length + off.sent.length, 0);

  // The limits are shared with invitations for a student: one address, and one person's day.
  const both = site();
  assert.equal((await sendParentInvite(both.deps, teacher, { studentId: 5, email: "dad@example.com" }, ORIGIN)).status, 200);
  assert.equal((await sendFamilyInvite(both.deps, teacher, { email: "dad@example.com" }, ORIGIN)).status, 200);
  assert.equal((await sendFamilyInvite(both.deps, admin, { email: "dad@example.com" }, ORIGIN)).status, 429);
  assert.equal(INVITES_PER_ADDRESS_PER_DAY, 2);
  let log = {};
  for (let i = 0; i < STAFF_INVITES_PER_DAY; i++) log = recordInvite(log, NEW_FAMILY_KEY, { email: `p${i}@example.com`, sentAt: new Date(NOW - 1000).toISOString(), by: 20, byName: "Ms. Lee" });
  const full = site({ log: JSON.stringify(log) });
  assert.equal(invitesFor(full.log(), NEW_FAMILY_KEY).length, STAFF_INVITES_PER_DAY, "the new-family list keeps more than a student's list does");
  assert.equal((await sendFamilyInvite(full.deps, teacher, { email: "new@example.com" }, ORIGIN)).status, 429);
  assert.equal((await sendFamilyInvite(full.deps, admin, { email: "new@example.com" }, ORIGIN)).status, 200);
});

test("the child's name is tidied, shown as text, and the new-family list stays a sensible size", () => {
  assert.equal(cleanChildName("  Jordan \n  Reyes "), "Jordan Reyes");
  assert.equal(cleanChildName(null), "");
  assert.equal(cleanChildName("<b>Jo</b>"), "b Jo /b");
  assert.equal(cleanChildName("x".repeat(200)).length, CHILD_NAME_MAX);
  const html = familyInviteEmail({ senderName: 'Mr. "R" <script>', childName: "Jo & <i>Al</i>", registerUrl: 'https://x.example/#/register?a="1"', independentUrl: "https://x.example/#/register-independent", parentSignupUrl: "https://x.example/#/parent-signup", schoolName: "A <b>School</b>", teacherName: "T & Co" });
  assert.ok(!/<script>|<i>Al|<b>School|"1""/.test(html));
  for (const part of ["Mr. &quot;R&quot; &lt;script&gt;", "Mr. &quot;R&quot; &lt;script&gt; invited you and Jo &amp; &lt;i&gt;Al&lt;/i&gt; to join", "A &lt;b&gt;School&lt;/b&gt;", "T &amp; Co", 'href="https://x.example/#/register?a=&quot;1&quot;"']) assert.ok(html.includes(part), part);
  let log = {};
  for (let i = 0; i < KEPT_NEW_FAMILIES + 20; i++) log = recordInvite(log, NEW_FAMILY_KEY, { email: `p${i}@example.com`, sentAt: new Date(NOW + i * 1000).toISOString(), by: 20, byName: "Ms. Lee", child: `Kid ${i}` });
  assert.equal(invitesFor(log, NEW_FAMILY_KEY).length, KEPT_NEW_FAMILIES);
  assert.deepEqual(readInviteLog(JSON.stringify(log)), log, "the child's name survives a save and load");
  assert.equal(inviteSummary(invitesFor(log, NEW_FAMILY_KEY))[0].child, `Kid ${KEPT_NEW_FAMILIES + 19}`);
  assert.equal(readInviteLog(JSON.stringify({ 0: [{ email: "a@b.com", sentAt: "2026-10-07T16:30:00Z", by: 1, child: 7 }] }))[0][0].child, "7");
});

test("the new-family box is at the top of the admin's Students list and on the teacher's Parents screen", () => {
  const adminPage = read("client/src/pages/Admin.tsx"), teacherPage = read("client/src/components/teacher-hub/HubReaderTools.tsx"), routes = read("server/routes.ts"), box = read("client/src/components/FamilyEmailInvite.tsx"), server = read("server/parentInviteEmails.ts"), lib = read("client/src/lib/parentInvites.ts");
  const students = adminPage.slice(adminPage.indexOf('id="students"'));
  assert.ok(students.indexOf("<FamilyEmailInvite />") > 0 && students.indexOf("<FamilyEmailInvite />") < students.indexOf('<div className="relative min-w-0 flex-1">'), "above the search box");
  const parents = teacherPage.slice(teacherPage.indexOf('tab === "readerParents"'));
  assert.ok(parents.indexOf('<HubFamilyInvite which="work" />') > 0 && parents.indexOf('<HubFamilyInvite which="work" />') < parents.indexOf("Your students' families"), "above the list of students' families");
  for (const part of ['app.get("/api/parent-invites/family-emails", auth,', 'app.post("/api/parent-invites/family-email", auth,']) assert.ok(server.includes(part), part);
  for (const part of ["parentAccountEmails: async () =>", "schoolName: async (schoolId"]) assert.ok(routes.includes(part), part);
  for (const part of ["'/api/parent-invites/family-emails'", "'/api/parent-invites/family-email'", "JSON.stringify({ email, childName, note })"]) assert.ok(lib.includes(part), part);
  assert.ok(read("client/src/pages/Profile.tsx").includes("Print / View My Parent Code") && read("client/src/pages/Profile.tsx").includes("Parent Sign-Up Letter"), "the email points at the button a student really has");
  for (const part of ['data-testid="family-email-input"', 'data-testid="family-child-input"', "Invite a family that isn't signed up yet", "You can send it before either of them has signed up.", "Send invitation", "Send again"]) assert.ok(box.includes(part), part);
});

test("the invitation can be copied into the teacher's own email, with the student's code and link in it", async () => {
  const s = site({ configured: false });
  const reply = await inviteTemplate(s.deps, teacher, { studentId: 5 }, ORIGIN + "/");
  assert.equal(reply.status, 200, "it works even when the site's own email is off");
  assert.equal(reply.body.subject, "Follow Dennis Flores's reading on A.R.I.S.E. Reader");
  const text = String(reply.body.text);
  for (const part of [
    "Hello,\n\nI use A.R.I.S.E. Reader with Dennis Flores, and I'd like to invite you to follow along.", "Dennis already has a student account. You will need a free parent account, which takes about two minutes to make.",
    "WHAT IT IS\n- Dennis picks a book and reads it.", "A score of 70% or higher earns that book's points.",
    "WHAT A PARENT ACCOUNT DOES\n- See Dennis's quiz history and reading growth.", "Parent Proctor Code", "- It is free, and one parent account can follow up to 5 children.",
    "1. Open this link. Dennis's code is already filled in:\n   https://www.arisereader.com/#/parent-signup?code=AB12-CD34-EF56-7890-0005\n",
    "Dennis's parent code: AB12-CD34-EF56-7890-0005", "go to www.arisereader.com/#/parent-signup and type the code", "Already have a parent account?",
    "\n\nThank you,\nMs. Lee",
  ]) assert.ok(text.includes(part), part);
  assert.ok(!/<[a-z/]|&amp;|undefined|null/.test(text), "plain words, no page code");
  assert.ok(text.endsWith("Ms. Lee"));
  // Nothing was sent and nothing was added to the list.
  assert.equal(s.sent.length, 0);
  assert.deepEqual(s.log(), {});
  // Only for a student this person can reach.
  assert.equal((await inviteTemplate(s.deps, teacher, { studentId: 6 }, ORIGIN)).status, 404, "another teacher's student");
  assert.equal((await inviteTemplate(s.deps, admin, { studentId: 6 }, ORIGIN)).status, 200);
  assert.equal((await inviteTemplate(s.deps, admin, { studentId: 7 }, ORIGIN)).status, 404, "not a student");
  assert.equal((await inviteTemplate(s.deps, admin, { studentId: "abc" }, ORIGIN)).status, 400);
  for (const who of [{ id: 30, role: "student" }, { id: 31, role: "parent" }, { ...teacher, accountApproved: false }]) {
    assert.equal((await inviteTemplate(s.deps, who, { studentId: 5 }, ORIGIN)).status, 403);
    assert.equal((await inviteTemplate(s.deps, who, {}, ORIGIN)).status, 403);
  }
});

test("the new-family invitation can be copied too", async () => {
  const s = site();
  const reply = await inviteTemplate(s.deps, teacher, { childName: "  Jordan   Reyes " }, ORIGIN);
  assert.equal(reply.status, 200);
  assert.equal(reply.body.subject, "Your family is invited to A.R.I.S.E. Reader");
  const text = String(reply.body.text);
  for (const part of [
    "I'd like to invite you and Jordan Reyes to join A.R.I.S.E. Reader", "It is free. Jordan will need a student account, and you will need a parent account. Each takes a few minutes, and the steps are below.",
    "- Jordan picks a book and reads it.", "- See Jordan's quiz history and reading growth.", "- One parent account can follow up to 5 children.",
    "1. Jordan makes a student account here:\n   https://www.arisereader.com/#/register\n   On that page, choose Lincoln Elementary as the school, pick the grade, then choose me (Ms. Lee) as the teacher.",
    `tap "My teacher isn't listed" and type the name.`, `2. Jordan logs in and opens Profile. Under "Parent Sign-Up Letter", tap "Print / View My Parent Code".`,
    "3. You make your parent account with that code here:\n   https://www.arisereader.com/#/parent-signup\n",
    "independent reader instead: https://www.arisereader.com/#/register-independent", "\n\nThank you,\nMs. Lee",
  ]) assert.ok(text.includes(part), part);
  // No name, from the admin: "your child", and no school or teacher is named.
  const plain = String((await inviteTemplate(s.deps, admin, {}, ORIGIN)).body.text);
  for (const part of ["invite you and your child to join", "Your child will need a student account, and you will need a parent account.", "- Your child picks a book", "1. Your child makes a student account here:", "On that page, choose the school, the grade and the teacher.", "Thank you,\nMr. Robinson"]) assert.ok(plain.includes(part), part);
  assert.ok(!plain.includes("Lincoln") && !/undefined|null/.test(plain));
  assert.equal(s.sent.length, 0);
  assert.deepEqual(s.log(), {});
  // A name can't break the message into extra lines, and the two versions say the same steps.
  const odd = parentProgramText({ studentName: "Maya\nTorres\t ", senderName: " Mr.  R\n", signupUrl: "https://x.example/#/parent-signup?code=A", code: "A" });
  assert.ok(odd.text.includes("with Maya Torres, and") && odd.text.endsWith("Thank you,\nMr. R") && odd.subject === "Follow Maya Torres's reading on A.R.I.S.E. Reader");
  const page = parentProgramEmail({ studentName: "Dennis Flores", senderName: "Ms. Lee", signupUrl: "https://x.example/s", code: "A", maxChildren: 5 });
  const words = parentProgramText({ studentName: "Dennis Flores", senderName: "Ms. Lee", signupUrl: "https://x.example/s", code: "A", maxChildren: 5 }).text;
  for (const shared of ["A score of 70% or higher earns that book's points.", "Dennis picks a book and reads it.", "See Dennis's quiz history and reading growth.", "Use parent controls for games and access.", "choose a username and a password", "Already have a parent account? Log in and enter the code on your dashboard to add Dennis."]) assert.ok(page.includes(shared) && words.includes(shared), shared);
  const family = { senderName: "Ms. Lee", childName: "Jo Al", registerUrl: "https://x.example/r", independentUrl: "https://x.example/i", parentSignupUrl: "https://x.example/p" };
  for (const shared of ["Jo picks a book and reads it.", "See Jo's quiz history and reading growth.", `Under "Parent Sign-Up Letter", tap "Print / View My Parent Code". That is your code.`, `tap "My teacher isn't listed" and type the name.`]) assert.ok(familyInviteEmail(family).includes(shared) && familyInviteText(family).text.includes(shared), shared);
});

test("both invitation boxes offer the copy, and the route needs a sign-in", () => {
  const copy = read("client/src/components/InviteCopy.tsx"), server = read("server/parentInviteEmails.ts"), lib = read("client/src/lib/parentInvites.ts");
  assert.ok(read("client/src/components/ParentEmailInvite.tsx").includes("<InviteCopy studentId={studentId} note={note} to={email} />"));
  assert.ok(read("client/src/components/FamilyEmailInvite.tsx").includes("<InviteCopy childName={child} note={note} to={email} />"));
  assert.ok(server.includes('app.post("/api/parent-invites/template", auth,'));
  assert.ok(lib.includes("'/api/parent-invites/template'"));
  for (const part of ['data-testid="invite-copy-open"', "Or copy the message to send from my own email", 'data-testid="invite-copy-subject"', 'data-testid="invite-copy-text"', "Copy with logo and pictures", "Copy words only", 'data-testid="invite-copy-preview"', "richInviteHtml(text, window.location.origin)", "Open in my email app", "navigator.clipboard.writeText(value)", "mailto:"]) assert.ok(copy.includes(part), part);
});

test("no invitation says an account is not needed", () => {
  const family = { senderName: "Ms. Lee", childName: "Jordan Reyes", registerUrl: "https://x.example/r", independentUrl: "https://x.example/i", parentSignupUrl: "https://x.example/p" };
  const student = { studentName: "Dennis Flores", senderName: "Ms. Lee", signupUrl: "https://x.example/s", code: "A" };
  for (const words of [familyInviteEmail(family), familyInviteText(family).text, parentProgramEmail(student), parentProgramText(student).text]) {
    assert.ok(!/need(s)? an account yet|needs? no account|do(es)?n't need an account|account first/i.test(words), words.slice(0, 80));
    assert.match(words, /will need a (free )?(student|parent) account/);
  }
  for (const file of ["client/src/components/ParentEmailInvite.tsx", "client/src/components/FamilyEmailInvite.tsx"]) assert.ok(!/don't need an account|needs an account first|Nobody needs/.test(read(file)), file);
});

test("the emails the site sends carry the logo and the three pictures", async () => {
  const s = site();
  await sendParentInvite(s.deps, teacher, { studentId: 5, email: "mom@example.com" }, ORIGIN);
  await sendFamilyInvite(s.deps, teacher, { email: "dad@example.com", childName: "Jordan" }, ORIGIN);
  for (const mail of s.sent) {
    assert.ok(mail.html.includes('<img src="https://www.arisereader.com/icon-192.png" width="48" height="48" alt="A.R.I.S.E. Reader logo"'), "the logo, loaded from the site");
    for (const part of ["A.R.I.S.E. Reader</div>", "Read a book. Take a quiz. Earn points.", "📖", "Read a book</div>", "✅", "Pass the quiz</div>", "⭐", "Earn points</div>"]) assert.ok(mail.html.includes(part), part);
    assert.equal(mail.html.split("<img ").length - 1, 1, "one image only, so the email stays light");
  }
});
