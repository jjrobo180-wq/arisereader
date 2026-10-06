// What every email from the site has in common: a whole page, a footer that says who sent it,
// links on the site's own domain, nothing hidden, and a limit on invitations a student can send.
// Run with: npx tsx --test tests/email-format.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_SITE_URL, PARENT_INVITES_PER_DAY, emailDocument, parentInviteEmail, siteHost } from "../server/emailFormat";
import { teacherEmailCodeEmail, teacherWelcomeEmail } from "../server/teacherSignup";
import { alertEmailHtml } from "../server/adminAlerts";
import { createAttemptLimiter } from "../server/attemptLimiter";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("an email goes out as a complete page with the site's footer", () => {
  const page = emailDocument("123456 is your A.R.I.S.E Reader code", teacherEmailCodeEmail("Ms. Rivera", "123456"), "https://www.arisereader.com/");
  assert.ok(page.startsWith("<!doctype html>\n<html lang=\"en\">"));
  assert.ok(page.trimEnd().endsWith("</html>"));
  assert.equal((page.match(/<html/g) || []).length, 1);
  assert.equal((page.match(/<body/g) || []).length, 1);
  assert.ok(page.includes('<meta charset="utf-8">'));
  assert.ok(page.includes("<title>123456 is your A.R.I.S.E Reader code</title>"));
  assert.ok(page.includes("123456") && page.includes("Ms. Rivera"), "the email's own content is kept");
  // the footer says who sent it and why, and links to the site itself
  assert.ok(page.includes("A.R.I.S.E Reader is a reading site for students, teachers and families."));
  assert.ok(page.includes('You got this email because of an account or a request on <a href="https://www.arisereader.com"'));
  assert.ok(page.includes(">www.arisereader.com</a>"));
  assert.ok(page.indexOf("Ms. Rivera") < page.indexOf("You got this email"), "the footer comes after the content");
});

test("a subject cannot break the page, and a whole page is left alone", () => {
  const page = emailDocument('Book Request from <b>"Sam"</b> & co', "<div>hello</div>");
  assert.ok(page.includes("<title>Book Request from &lt;b&gt;&quot;Sam&quot;&lt;/b&gt; &amp; co</title>"));
  assert.ok(page.includes(`href="${DEFAULT_SITE_URL}"`), "with no address given, the footer links to the site");
  const whole = "<!DOCTYPE html><HTML><body><p>already a page</p></body></HTML>";
  assert.equal(emailDocument("x", whole, "https://www.arisereader.com"), whole);
  assert.equal(siteHost("https://www.arisereader.com/"), "www.arisereader.com");
  assert.equal(siteHost("www.arisereader.com/path"), "www.arisereader.com");
});

test("links in emails stay on the site's own domain", () => {
  assert.equal(DEFAULT_SITE_URL, "https://www.arisereader.com");
  const routes = read("server/routes.ts");
  assert.ok(routes.includes("const APP_URL = process.env.APP_URL || DEFAULT_SITE_URL;"));
  assert.equal(/pplx\.app["'`/]/.test(routes.replace(/\/\/.*$/gm, "")), false, "no link falls back to the old pplx.app address");
  assert.ok(routes.includes("html: emailDocument(subject, html, APP_URL)"), "every email is sent through emailDocument");
  // the site's own emails link where they are told to
  assert.ok(teacherWelcomeEmail("Ms. Rivera", "ms.rivera", DEFAULT_SITE_URL).includes(`href="${DEFAULT_SITE_URL}"`));
  assert.ok(alertEmailHtml([{ event: "student_message", alert: { title: "Hi", summary: "", lines: [] } }], DEFAULT_SITE_URL).includes(`href="${DEFAULT_SITE_URL}/#/admin"`));
});

test("no email hides text or leaves a heading invisible", () => {
  const invite = parentInviteEmail("Sam R.", "https://www.arisereader.com/#/parent-signup?code=AB12-CD34", "AB12-CD34");
  const samples = [
    invite,
    teacherEmailCodeEmail("Ms. Rivera", "123456"),
    teacherWelcomeEmail("Ms. Rivera", "ms.rivera", DEFAULT_SITE_URL),
    emailDocument("Subject", "<div>content</div>"),
    read("server/routes.ts"),
    read("server/adminAlerts.ts"),
  ];
  for (const html of samples) {
    // see-through text is invisible in Outlook and is a classic junk-mail trick
    assert.equal(/color:\s*transparent/i.test(html), false);
    assert.equal(/font-size:\s*0(px)?\s*[;"]/i.test(html), false);
    assert.equal(/display:\s*none|visibility:\s*hidden/i.test(html), false);
  }
  // the invitation says who asked for it, has a button that shows without gradients, and offers a way out
  assert.ok(invite.includes("Sam R. uses A.R.I.S.E. Reader") && invite.includes("asked us to send you this invitation"));
  assert.ok(invite.includes("background-color:#7c3aed;"), "the button has a plain color under its gradient");
  assert.ok(invite.includes('href="https://www.arisereader.com/#/parent-signup?code=AB12-CD34"'));
  assert.ok(invite.includes("AB12-CD34</strong>"));
  assert.ok(invite.includes("If you don't know Sam R., you can ignore this email."));
});

test("a student can send only a few parent invitations a day", () => {
  assert.equal(PARENT_INVITES_PER_DAY, 3);
  const routes = read("server/routes.ts");
  const route = routes.slice(routes.indexOf('app.post("/api/student/parent-invite-email"'));
  const end = route.indexOf("\n  });");
  const body = route.slice(0, end);
  assert.ok(routes.includes("createAttemptLimiter({ max: PARENT_INVITES_PER_DAY, windowMs: 24 * 60 * 60_000 })"));
  // checked before anything is sent, counted only when an email really went out
  assert.ok(body.indexOf("parentInviteSends.retryAfter(inviteKey) > 0") > 0);
  assert.ok(body.indexOf("parentInviteSends.retryAfter(inviteKey) > 0") < body.indexOf("await sendEmail("));
  assert.ok(body.includes("res.status(429)"));
  assert.ok(body.indexOf("if (!result.sent) return res.status(503)") < body.indexOf("parentInviteSends.fail(inviteKey)"));
  assert.ok(body.includes("safe(String(req.user.displayName") && body.includes("safe(signupUrl)"), "nothing a student types reaches the email as HTML");
  // the same counter the route uses: three in a day, a fourth must wait, and the day rolls on
  let now = Date.parse("2026-10-06T15:00:00Z");
  const sends = createAttemptLimiter({ max: PARENT_INVITES_PER_DAY, windowMs: 24 * 60 * 60_000, now: () => now });
  for (let i = 0; i < 3; i++) { assert.equal(sends.retryAfter("7"), 0); sends.fail("7"); now += 60_000; }
  assert.ok(sends.retryAfter("7") > 0);
  assert.equal(sends.retryAfter("8"), 0, "another student is not held back");
  now += 24 * 60 * 60_000;
  assert.equal(sends.retryAfter("7"), 0);
});
