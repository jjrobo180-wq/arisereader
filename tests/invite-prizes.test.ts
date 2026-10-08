// What a parent invitation says about prizes and competitions, and the note a sender can add.
// Run with: npx tsx --test tests/invite-prizes.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_INVITE_PRIZES, INVITE_PRIZES_KEY, PRIZE_LINES_MAX, PRIZE_LINE_MAX, cleanPrizeLines, competitionLines, invitePrizeLines, readInvitePrizes } from "../shared/invitePrizes";
import { INVITE_NOTE_MAX, PARENT_INVITE_LOG_KEY, cleanInviteNote } from "../shared/parentInvites";
import { PICTURE_LINE, inviteWordsHtml, richInviteHtml } from "../shared/inviteRich";
import { familyInviteEmail, familyInviteText, parentProgramEmail, parentProgramText } from "../server/emailFormat";
import { getInvitePrizes, inviteTemplate, saveInvitePrizes, sendFamilyInvite, sendParentInvite, type InviteSender, type ParentInviteDeps } from "../server/parentInviteEmails";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const SITE = "https://www.arisereader.com";
// Thursday Oct 8, 2026, noon Mountain: the Fall Break Competition and the chess competition are both on.
const NOW = Date.parse("2026-10-08T18:00:00Z");
const FALL = "Fall Break Competition: from Wednesday, Oct 7 at 8:00 AM to Monday, Oct 12 at 8:00 AM, the reader who earns the most points wins $5 cash or gift card. Leaderboard: https://www.arisereader.com/#/fall-break";
const CHESS = "Chess: the Crown Clash chess competition is on now (Oct 5 – Oct 19). Every finished game of Ultimate Chess earns competition points toward the crown.";
const admin: InviteSender = { id: 1, displayName: "Mr. Robinson", isAdmin: true, role: "admin", email: "jr@school.example" };
const teacher: InviteSender = { id: 20, displayName: "Ms. Lee", role: "teacher", accountApproved: true };

function site(start: { now?: number; saved?: string } = {}) {
  const settings = new Map<string, string>(start.saved !== undefined ? [[INVITE_PRIZES_KEY, start.saved]] : []);
  const sent: { to: string; html: string }[] = [];
  const deps: ParentInviteDeps = {
    getStudent: async (id) => (id === 5 ? { id: 5, displayName: "Dennis Flores", role: "student", teacherId: 20 } : null),
    getSetting: async (key) => settings.get(key) ?? "",
    saveSetting: async (key, value) => { settings.set(key, value); },
    parentCode: async () => ({ formattedCode: "AB12-CD34" }),
    linkedParentEmails: async () => [],
    parentAccountEmails: async () => [],
    invitePrizes: async () => readInvitePrizes(settings.get(INVITE_PRIZES_KEY)),
    emailConfigured: () => true,
    sendEmail: async (to, _subject, html) => { sent.push({ to, html }); return { sent: true }; },
    siteUrl: SITE,
    now: () => start.now ?? NOW,
  };
  return { deps, sent, settings };
}

test("the built-in prizes: Reader of the Year wins AirPods, Reader of the Month wins free DoorDash", () => {
  assert.deepEqual(DEFAULT_INVITE_PRIZES, ["Reader of the Year: the reader who earns the most points overall wins AirPods.", "Reader of the Month: the reader who earns the most points each month wins free DoorDash."]);
  assert.deepEqual(readInvitePrizes(""), DEFAULT_INVITE_PRIZES);
  assert.deepEqual(readInvitePrizes(undefined), DEFAULT_INVITE_PRIZES);
  assert.deepEqual(readInvitePrizes("not json"), DEFAULT_INVITE_PRIZES);
  assert.deepEqual(readInvitePrizes(JSON.stringify({ lines: ["Top reader: pizza party."] })), ["Top reader: pizza party."]);
  assert.deepEqual(readInvitePrizes(JSON.stringify({ lines: [] })), [], "the admin can clear them, and that is kept");
  assert.notEqual(readInvitePrizes(""), DEFAULT_INVITE_PRIZES, "a copy, so nothing can change the built-in list");
});

test("prize lines are kept tidy", () => {
  assert.deepEqual(cleanPrizeLines("  - Top reader:   pizza <b>party</b>.\n\n* Second: a book\n• Third: a bookmark\nSecond: a book\r\n"), ["Top reader: pizza b party /b .", "Second: a book", "Third: a bookmark"]);
  assert.deepEqual(cleanPrizeLines(["A", null, 5, "  "]), ["A", "5"]);
  assert.equal(cleanPrizeLines("x".repeat(500))[0].length, PRIZE_LINE_MAX);
  assert.equal(cleanPrizeLines(Array.from({ length: 30 }, (_, i) => `Prize ${i}`)).length, PRIZE_LINES_MAX);
  assert.deepEqual(cleanPrizeLines(undefined), []);
});

test("competitions add themselves while they are on, and drop out when they end", () => {
  assert.deepEqual(competitionLines(NOW, SITE + "/"), [FALL, CHESS]);
  assert.deepEqual(invitePrizeLines(DEFAULT_INVITE_PRIZES, NOW, SITE), [...DEFAULT_INVITE_PRIZES, FALL, CHESS]);
  // Monday Oct 12 at 8:01 AM Mountain: the Fall Break Competition is over; chess still has a week.
  assert.deepEqual(competitionLines(Date.parse("2026-10-12T14:01:00Z"), SITE), [CHESS]);
  // After chess ends too, nothing is added.
  assert.deepEqual(competitionLines(Date.parse("2026-10-20T06:00:01Z"), SITE), []);
  assert.deepEqual(invitePrizeLines([], Date.parse("2026-11-15T18:00:00Z"), SITE), []);
  // Before they start they are announced, in the right words.
  const before = competitionLines(Date.parse("2026-10-03T18:00:00Z"), SITE);
  assert.equal(before[0], FALL);
  assert.equal(before[1], "Chess: the Crown Clash chess competition starts Monday, Oct 5 (Oct 5 – Oct 19). Every finished game of Ultimate Chess earns competition points toward the crown.");
});

test("both invitations, as an email and as words to copy, mention the prizes and competitions", async () => {
  const s = site();
  await sendParentInvite(s.deps, teacher, { studentId: 5, email: "mom@example.com" }, SITE);
  await sendFamilyInvite(s.deps, teacher, { email: "dad@example.com", childName: "Jordan Reyes" }, SITE);
  const copied = [String((await inviteTemplate(s.deps, teacher, { studentId: 5 }, SITE)).body.text), String((await inviteTemplate(s.deps, teacher, { childName: "Jordan Reyes" }, SITE)).body.text)];
  for (const mail of s.sent) {
    assert.ok(mail.html.includes("🏆 Prizes and competitions</h2>"), mail.to);
    for (const part of ["wins AirPods.", "wins free DoorDash.", "Fall Break Competition: from Wednesday, Oct 7 at 8:00 AM to Monday, Oct 12 at 8:00 AM", "wins $5 cash or gift card.", '<a href="https://www.arisereader.com/#/fall-break" style="color:#c4b5fd;">https://www.arisereader.com/#/fall-break</a>', "the Crown Clash chess competition is on now (Oct 5 – Oct 19)"]) assert.ok(mail.html.includes(part), part);
    assert.ok(mail.html.indexOf("What it is") < mail.html.indexOf("Prizes and competitions") && mail.html.indexOf("Prizes and competitions") < mail.html.indexOf("How to sign up"), "after what it is, before how to sign up");
  }
  for (const text of copied) {
    assert.ok(text.includes(`\n\n🏆 PRIZES AND COMPETITIONS\n- ${DEFAULT_INVITE_PRIZES[0]}\n- ${DEFAULT_INVITE_PRIZES[1]}\n- ${FALL}\n- ${CHESS}\n\n`));
    assert.ok(text.includes(`\n\n${PICTURE_LINE}\n\nWHAT IT IS\n`), "the three pictures are in the words too, so a plain paste still has them");
    assert.equal(PICTURE_LINE, "📖 Read a book   ✅ Pass the quiz   ⭐ Earn points");
    // Laid out for an email: a heading and a list, the leaderboard a real link, and the picture row not shown twice.
    const html = richInviteHtml(text, SITE);
    assert.ok(html.includes('color:#111827;">🏆 Prizes and competitions</h3>'));
    assert.ok(html.includes('Leaderboard: <a href="https://www.arisereader.com/#/fall-break" style="color:#6d28d9;">https://www.arisereader.com/#/fall-break</a></li>'));
    assert.equal(html.split("Pass the quiz").length - 1, 1);
  }
  // Once everything is over and the admin has cleared the prizes, the section is gone, heading and all.
  const quiet = site({ now: Date.parse("2026-11-15T18:00:00Z"), saved: JSON.stringify({ lines: [] }) });
  await sendFamilyInvite(quiet.deps, teacher, { email: "dad@example.com" }, SITE);
  assert.ok(!quiet.sent[0].html.includes("Prizes and competitions"));
  assert.ok(!String((await inviteTemplate(quiet.deps, teacher, {}, SITE)).body.text).includes("PRIZES"));
  // The builders on their own, with nothing passed, say nothing about prizes.
  assert.ok(!parentProgramText({ studentName: "A B", senderName: "T", signupUrl: "u", code: "c" }).text.includes("PRIZES"));
  assert.ok(!familyInviteEmail({ senderName: "T", registerUrl: "r", independentUrl: "i", parentSignupUrl: "p" }).includes("Prizes"));
});

test("the sender can add a note in their own words, and it is in the email and the copy", async () => {
  const s = site();
  const note = "  Dennis did great on his last quiz!\r\n\r\n\r\n\r\nSee you at <conferences>.  ";
  await sendParentInvite(s.deps, teacher, { studentId: 5, email: "mom@example.com", note }, SITE);
  await sendFamilyInvite(s.deps, teacher, { email: "dad@example.com", childName: "Jordan", note }, SITE);
  for (const mail of s.sent) {
    assert.ok(mail.html.includes("A note from Ms. Lee</div>"), mail.to);
    assert.ok(mail.html.includes("Dennis did great on his last quiz!<br><br>See you at conferences ."), "line breaks kept, page code taken out");
    assert.ok(!mail.html.includes("<conferences>"));
  }
  const student = String((await inviteTemplate(s.deps, teacher, { studentId: 5, note }, SITE)).body.text);
  assert.ok(student.includes("which takes about two minutes to make.\n\nDennis did great on his last quiz!\n\nSee you at conferences .\n\n📖 Read a book"), "right after the opening, in the sender's words");
  const family = String((await inviteTemplate(s.deps, admin, { childName: "Jordan Reyes", note: "We meet Tuesdays." }, SITE)).body.text);
  assert.ok(family.includes("I'd like to invite you and Jordan Reyes to join") && family.includes("the steps are below.\n\nWe meet Tuesdays.\n\n📖 Read a book"));
  // No note, no gap and no empty box.
  assert.ok(!String((await inviteTemplate(s.deps, teacher, { studentId: 5 }, SITE)).body.text).includes("\n\n\n"));
  assert.ok(!parentProgramEmail({ studentName: "A B", senderName: "T", signupUrl: "u", code: "c", note: "   " }).includes("A note from"));
  assert.ok(!familyInviteText({ senderName: "T", registerUrl: "r", independentUrl: "i", parentSignupUrl: "p", note: "" }).text.includes("\n\n\n"));
  // The note is tidied and has a length limit.
  assert.equal(cleanInviteNote(" a \t b \n\n\n\n c\u0007 "), "a b\n\nc");
  assert.equal(cleanInviteNote("x".repeat(2000)).length, INVITE_NOTE_MAX);
  assert.equal(cleanInviteNote(null), "");
  // A note written as a list or with a link is laid out that way in the rich copy.
  const html = inviteWordsHtml("Bring:\n- a library card\n- www.example.com/form.");
  assert.ok(html.includes('<li style="margin:0 0 6px;">a library card</li>') && html.includes('<a href="https://www.example.com/form" style="color:#6d28d9;">www.example.com/form</a>.'));
});

test("only the admin sees and sets the prize lines", async () => {
  const s = site();
  assert.equal((await getInvitePrizes(s.deps, teacher, SITE)).status, 403);
  assert.equal((await saveInvitePrizes(s.deps, teacher, { lines: ["Free car"] }, SITE)).status, 403);
  assert.equal(s.settings.has(INVITE_PRIZES_KEY), false);
  assert.deepEqual((await getInvitePrizes(s.deps, admin, SITE)).body, { lines: DEFAULT_INVITE_PRIZES, defaults: DEFAULT_INVITE_PRIZES, automatic: [FALL, CHESS] });
  const saved = await saveInvitePrizes(s.deps, admin, { lines: "Reader of the Year: AirPods.\n- Reader of the Month: free DoorDash.\n\n" }, SITE);
  assert.deepEqual([saved.status, saved.body.lines], [200, ["Reader of the Year: AirPods.", "Reader of the Month: free DoorDash."]]);
  assert.equal(s.settings.get(INVITE_PRIZES_KEY), JSON.stringify({ lines: ["Reader of the Year: AirPods.", "Reader of the Month: free DoorDash."] }));
  // A teacher's next invitation uses them.
  const text = String((await inviteTemplate(s.deps, teacher, {}, SITE)).body.text);
  assert.ok(text.includes("- Reader of the Year: AirPods.\n- Reader of the Month: free DoorDash.\n- Fall Break Competition:") && !text.includes("most points overall"));
  assert.deepEqual((await saveInvitePrizes(s.deps, admin, { lines: [] }, SITE)).body.lines, []);
  assert.deepEqual((await getInvitePrizes(s.deps, admin, SITE)).body.lines, []);
  assert.equal(s.settings.has(PARENT_INVITE_LOG_KEY), false, "nothing else is touched");
});

test("the screens: a note box in both invitation boxes, an offer to write the copy again, and the admin's prize box", () => {
  const copy = read("client/src/components/InviteCopy.tsx"), server = read("server/parentInviteEmails.ts"), admin = read("client/src/pages/Admin.tsx"), editor = read("client/src/components/InvitePrizesEditor.tsx");
  for (const part of ['data-testid="parent-email-note"', "<InviteCopy studentId={studentId} note={note} to={email} />", "sendParentInviteEmail(studentId, address, note.trim())"]) assert.ok(read("client/src/components/ParentEmailInvite.tsx").includes(part), part);
  for (const part of ['data-testid="family-email-note"', "<InviteCopy childName={child} note={note} to={email} />", "sendFamilyInviteEmail(address, name.trim(), note.trim())"]) assert.ok(read("client/src/components/FamilyEmailInvite.tsx").includes(part), part);
  for (const part of ['data-testid="invite-copy-stale"', "Write it again", "note: note.trim()"]) assert.ok(copy.includes(part), part);
  for (const part of ['app.get("/api/parent-invites/prizes", auth,', 'app.put("/api/parent-invites/prizes", auth,']) assert.ok(server.includes(part), part);
  assert.ok(admin.includes("<FamilyEmailInvite /><InvitePrizesEditor />"));
  for (const part of ['data-testid="invite-prizes-text"', "Save prizes", "Added by themselves while they are on:", "Put the built-in ones back"]) assert.ok(editor.includes(part), part);
  assert.ok(read("server/routes.ts").includes("invitePrizes: async () => readInvitePrizes(await storage.getSetting(INVITE_PRIZES_KEY)),"));
});
