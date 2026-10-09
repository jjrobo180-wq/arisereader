// Run with: npx tsx --test tests/text-messages.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { createTextService, textConfigFromEnv } from "../server/textMessages";
import { bookedEmailText, bookedSmsText, cleanPhone, cleanPollInput, inviteEmailText, inviteSmsText } from "../shared/meetingPoll";

test("phone numbers are made uniform, and junk is refused", () => {
  assert.equal(cleanPhone("(303) 555-0142"), "+13035550142");
  assert.equal(cleanPhone("303.555.0142"), "+13035550142");
  assert.equal(cleanPhone("1-303-555-0142"), "+13035550142");
  assert.equal(cleanPhone("+44 20 7946 0958"), "+442079460958");
  assert.equal(cleanPhone("555-0142"), "");
  assert.equal(cleanPhone("123-456-7890"), ""); // US area codes don't start with 1
  assert.equal(cleanPhone("call me"), "");
  assert.equal(cleanPhone(""), "");
});

test("Twilio settings: needs the account and either a messaging service or a number", () => {
  assert.equal(textConfigFromEnv({}), null);
  assert.equal(textConfigFromEnv({ TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t" }), null);
  assert.deepEqual(textConfigFromEnv({ TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_FROM_NUMBER: "(303) 555-0100" }), { accountSid: "AC1", authToken: "t", fromNumber: "+13035550100" });
  assert.deepEqual(textConfigFromEnv({ TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_MESSAGING_SERVICE_SID: "MG9" }), { accountSid: "AC1", authToken: "t", messagingServiceSid: "MG9" });
});

test("a text goes to Twilio with the right sign-in, number and words", async () => {
  let seen: any;
  const svc = createTextService({ accountSid: "AC1", authToken: "tok", messagingServiceSid: "MG9" }, (async (url: any, init: any) => { seen = { url: String(url), init }; return new Response("{}", { status: 201 }); }) as any);
  assert.deepEqual(await svc.send("(303) 555-0142", "Hello there"), { sent: true });
  assert.equal(seen.url, "https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json");
  assert.equal(seen.init.headers.Authorization, `Basic ${Buffer.from("AC1:tok").toString("base64")}`);
  const body = new URLSearchParams(seen.init.body);
  assert.equal(body.get("To"), "+13035550142");
  assert.equal(body.get("Body"), "Hello there");
  assert.equal(body.get("MessagingServiceSid"), "MG9");
  assert.equal(body.get("From"), null);
  const fromNumber = createTextService({ accountSid: "AC1", authToken: "tok", fromNumber: "+13035550100" }, (async (_u: any, init: any) => { seen = { init }; return new Response("{}", { status: 201 }); }) as any);
  await fromNumber.send("+13035550142", "x");
  assert.equal(new URLSearchParams(seen.init.body).get("From"), "+13035550100");
});

test("a text that can't be sent says why, and a bad number never reaches Twilio", async () => {
  let calls = 0;
  const svc = createTextService({ accountSid: "AC1", authToken: "t", fromNumber: "+13035550100" }, (async () => { calls++; return new Response(JSON.stringify({ code: 21610, message: "Attempt to send to unsubscribed recipient" }), { status: 400 }); }) as any);
  assert.deepEqual(await svc.send("303-555-0142", "x"), { sent: false, error: "Attempt to send to unsubscribed recipient" });
  assert.equal((await svc.send("nope", "x")).sent, false);
  assert.equal(calls, 1);
  const down = createTextService({ accountSid: "AC1", authToken: "t", fromNumber: "+13035550100" }, (async () => { throw new Error("offline"); }) as any);
  assert.deepEqual(await down.send("303-555-0142", "x"), { sent: false, error: "offline" });
});

const base = () => ({
  title: "IEP meeting for Jordan", location: "Room 4",
  options: [{ date: "2026-10-13", start: "15:30" }, { date: "2026-10-14", start: "08:15" }],
});

test("sending it yourself: a name is enough, no email needed", () => {
  const r = cleanPollInput({ ...base(), sendVia: "self", invitees: [{ name: "Ms. Lee", phone: "303 555 0142" }, { name: "Mr. Park" }, { name: "", email: "coach@school.org" }, { name: "", email: "", phone: "" }] }, "2026-10-06");
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.poll.sendVia, "self");
  assert.deepEqual(r.poll.invitees.map((i) => [i.name, i.email, i.phone]), [["Ms. Lee", "", "+13035550142"], ["Mr. Park", "", ""], ["coach", "coach@school.org", ""]]);
  const nameless = cleanPollInput({ ...base(), sendVia: "self", invitees: [{ phone: "303 555 0142" }] }, "2026-10-06");
  assert.ok(!nameless.ok && /name/.test(nameless.error));
});

test("texting: needs a phone, the teacher's OK, and still needs an email unless texting", () => {
  const people = [{ name: "Dad", phone: "303-555-0142" }];
  const off = cleanPollInput({ ...base(), invitees: people }, "2026-10-06");
  assert.ok(!off.ok && /Dad needs an email address\./.test(off.error));
  const noConsent = cleanPollInput({ ...base(), sendText: true, invitees: people }, "2026-10-06");
  assert.ok(!noConsent.ok && /OK with getting a text/.test(noConsent.error));
  const ok = cleanPollInput({ ...base(), sendText: true, textConsent: true, invitees: people }, "2026-10-06");
  assert.ok(ok.ok && ok.poll.sendText && ok.poll.invitees[0].email === "");
  const badPhone = cleanPollInput({ ...base(), sendText: true, textConsent: true, invitees: [{ name: "X", email: "x@y.org", phone: "123" }] }, "2026-10-06");
  assert.ok(!badPhone.ok && /not a working phone number/.test(badPhone.error));
  const selfIgnoresText = cleanPollInput({ ...base(), sendVia: "self", sendText: true, invitees: [{ name: "A" }] }, "2026-10-06");
  assert.ok(selfIgnoresText.ok && selfIgnoresText.poll.sendText === false);
});

test("the messages a teacher sends themselves read well and carry the person's own link", () => {
  const input = { guest: "Ms. Lee", sender: "Maria Rivera", title: "IEP meeting for Jordan", location: "Room 4", options: [{ date: "2026-10-13", start: "15:30", end: "16:30" }], link: "https://www.arisereader.com/#/meet/abc" };
  const mail = inviteEmailText(input);
  assert.equal(mail.subject, "Which times work for IEP meeting for Jordan?");
  assert.match(mail.body, /^Hi Ms\. Lee,\n\nI'm trying to find a time for IEP meeting for Jordan \(Room 4\)\./);
  assert.match(mail.body, /- Tuesday, Oct 13 · 3:30 PM – 4:30 PM/);
  assert.match(mail.body, /https:\/\/www\.arisereader\.com\/#\/meet\/abc\n\nThank you,\nMaria Rivera$/);
  assert.match(inviteEmailText({ ...input, reminder: true }).subject, /^Reminder: /);
  const sms = inviteSmsText(input);
  assert.equal(sms, "Hi Ms. Lee! Maria Rivera asks: which times work for IEP meeting for Jordan? Tap to answer (1 minute, no account): https://www.arisereader.com/#/meet/abc");
  assert.ok(inviteSmsText({ ...input, title: "x".repeat(100) }).includes("x".repeat(57) + "..."));
  assert.match(bookedSmsText({ guest: "G", sender: "M", title: "T", location: "Room 4", when: "Tue" }), /T is set for Tue \(Room 4\)\./);
  assert.match(bookedEmailText({ guest: "G", sender: "M", title: "T", location: "", when: "Tue" }).body, /T is set for:\nTue\n/);
});
