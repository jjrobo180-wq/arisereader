// The parent invitation with a logo and pictures, to paste into an email.
// Run with: npx tsx --test tests/invite-rich.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { INVITE_PICTURES, inviteBrandHtml, inviteWordsHtml, logoUrl, richInviteHtml } from "../shared/inviteRich";
import { familyInviteText, parentProgramText } from "../server/emailFormat";

const SITE = "https://www.arisereader.com";
const student = parentProgramText({ studentName: "Dennis Flores", senderName: "Ms. Lee", signupUrl: "https://www.arisereader.com/#/parent-signup?code=AB12-CD34", code: "AB12-CD34", maxChildren: 5 });
const family = familyInviteText({ senderName: "Ms. Lee", childName: "Jordan Reyes", registerUrl: `${SITE}/#/register`, independentUrl: `${SITE}/#/register-independent`, parentSignupUrl: `${SITE}/#/parent-signup`, schoolName: "Lincoln Elementary", teacherName: "Ms. Lee", maxChildren: 5 });

test("the logo and three pictures go on top", () => {
  assert.equal(logoUrl("https://www.arisereader.com/"), "https://www.arisereader.com/icon-192.png");
  assert.deepEqual(INVITE_PICTURES.map((p) => p.label), ["Read a book", "Pass the quiz", "Earn points"]);
  const light = inviteBrandHtml(SITE), dark = inviteBrandHtml(SITE, "dark");
  for (const top of [light, dark]) {
    assert.ok(top.includes('<img src="https://www.arisereader.com/icon-192.png" width="48" height="48" alt="A.R.I.S.E. Reader logo"'));
    for (const p of INVITE_PICTURES) assert.ok(top.includes(p.picture) && top.includes(`${p.label}</div>`), p.label);
    assert.equal(top.split('<td width="33%"').length - 1, 3);
  }
  assert.ok(light.includes("color:#6d28d9") && dark.includes("color:#c4b5fd"), "its own colors on a light and on a dark email");
  assert.ok(inviteBrandHtml('https://x.example/"><script>').includes("&quot;&gt;&lt;script&gt;"), "the site address is never trusted as page code");
});

test("the words are laid out: headings, lists, numbered steps and links", () => {
  const html = inviteWordsHtml(student.text);
  assert.ok(html.startsWith('<p style="margin:0 0 12px;">Hello,</p>'));
  for (const heading of ["What it is", "What a parent account does", "How to sign up (about two minutes)"]) assert.ok(html.includes(`font-size:17px;color:#111827;">${heading}</h3>`), heading);
  assert.ok(html.includes('<ul style="margin:0 0 12px;padding-left:24px;"><li style="margin:0 0 6px;">Dennis picks a book and reads it.</li>'));
  assert.equal(html.split("<ul ").length - 1, 2, "one list under each of the first two headings");
  // The link sits inside its step, and is a real link.
  assert.ok(html.includes('<ol style="margin:0 0 12px;padding-left:24px;"><li style="margin:0 0 6px;">Open this link. Dennis&#39;s code is already filled in:<br><a href="https://www.arisereader.com/#/parent-signup?code=AB12-CD34" style="color:#6d28d9;">https://www.arisereader.com/#/parent-signup?code=AB12-CD34</a></li><li'));
  assert.equal(html.split("<ol ").length - 1, 1);
  assert.equal(html.split("<li ").length - 1, 3 + 4 + 3);
  // A bare "www." address becomes a link too, and the full stop after it stays outside.
  assert.ok(html.includes('go to <a href="https://www.arisereader.com/#/parent-signup" style="color:#6d28d9;">www.arisereader.com/#/parent-signup</a> and type the code.'));
  assert.ok(html.endsWith('<p style="margin:0 0 12px;">Thank you,<br>Ms. Lee</p>'), "the sign-off stays together");
  // The new-family message: three steps, each keeping its indented lines.
  const fam = inviteWordsHtml(family.text);
  assert.equal(fam.split("<ol ").length - 1, 1);
  assert.ok(fam.includes('Jordan makes a student account here:<br><a href="https://www.arisereader.com/#/register" style="color:#6d28d9;">https://www.arisereader.com/#/register</a><br>On that page, choose Lincoln Elementary as the school'));
  assert.ok(fam.includes('You make your parent account with that code here:<br><a href="https://www.arisereader.com/#/parent-signup"'));
});

test("whatever the teacher types in the box is shown as words, never run as page code", () => {
  const html = richInviteHtml('Hi <b>there</b> & "you"\n<script>alert(1)</script>\n- one <img src=x onerror=y>\nSee https://example.com/a?b=1&c="2".\nSEE YOU <SOON>', SITE);
  assert.ok(!/<script>|<b>there|<img src=x|onerror=y>|<SOON>/.test(html));
  for (const part of ["Hi &lt;b&gt;there&lt;/b&gt; &amp; &quot;you&quot;", "&lt;script&gt;alert(1)&lt;/script&gt;", "one &lt;img src=x onerror=y&gt;", '<a href="https://example.com/a?b=1&amp;c=" style="color:#6d28d9;">https://example.com/a?b=1&amp;c=</a>&quot;2&quot;.', "See you &lt;soon&gt;</h3>"]) assert.ok(html.includes(part), part);
  assert.equal(html.split("<img ").length - 1, 1, "the only image is the logo");
  // Odd input never breaks it.
  assert.equal(inviteWordsHtml(""), "");
  assert.equal(inviteWordsHtml("\r\n\r\n  \n"), "");
  assert.equal(inviteWordsHtml("One\r\nTwo\n\nThree"), '<p style="margin:0 0 12px;">One<br>Two</p>\n<p style="margin:0 0 12px;">Three</p>');
  assert.equal(inviteWordsHtml("1. A\n2. B\n- c\n- d\n3. E"), '<ol style="margin:0 0 12px;padding-left:24px;"><li style="margin:0 0 6px;">A</li><li style="margin:0 0 6px;">B</li></ol>\n<ul style="margin:0 0 12px;padding-left:24px;"><li style="margin:0 0 6px;">c</li><li style="margin:0 0 6px;">d</li></ul>\n<ol style="margin:0 0 12px;padding-left:24px;"><li style="margin:0 0 6px;">E</li></ol>');
  assert.ok(inviteWordsHtml("OK").startsWith("<p"), "two capital letters are not a heading");
  assert.ok(inviteWordsHtml("GO TO HTTPS://EXAMPLE.COM").startsWith("<p"), "a line with a link is not a heading");
});

test("the whole thing: logo, pictures, then the words", () => {
  const html = richInviteHtml(student.text, SITE);
  assert.ok(html.startsWith('<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;'));
  assert.ok(html.indexOf("icon-192.png") < html.indexOf("Earn points</div>") && html.indexOf("Earn points</div>") < html.indexOf("Hello,"));
  assert.ok(!/undefined|null|\[object/.test(html));
});
