// What every email from the site has in common, so mail services see a normal,
// complete message from a sender who says who they are.
//
// Whether an email lands in the inbox depends mostly on the domain's DNS records
// (SPF, DKIM and DMARC for the address in EMAIL_FROM). This file covers the part
// the site controls: a whole HTML page instead of a loose fragment, and a footer
// that names the site and says why the email was sent.

/** Where the site lives. Links in emails use APP_URL when it is set, and this when it is not. */
export const DEFAULT_SITE_URL = "https://www.arisereader.com";

const escapeHtml = (value: string) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "www.arisereader.com" from "https://www.arisereader.com/". */
export function siteHost(siteUrl: string): string {
  try {
    return new URL(siteUrl).host || siteUrl;
  } catch {
    return siteUrl.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  }
}

/**
 * Wraps an email's content in a complete HTML page with the site's footer.
 * Content that is already a whole page is sent as it is.
 */
export function emailDocument(subject: string, content: string, siteUrl: string = DEFAULT_SITE_URL): string {
  if (/<html[\s>]/i.test(content)) return content;
  const url = siteUrl.replace(/\/+$/, "") || DEFAULT_SITE_URL;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px 12px;background-color:#f3f4f6;">
${content.trim()}
<div style="max-width:600px;margin:16px auto 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#4b5563;text-align:center;">
A.R.I.S.E Reader is a reading site for students, teachers and families.<br>
You got this email because of an account or a request on <a href="${escapeHtml(url)}" style="color:#4b5563;text-decoration:underline;">${escapeHtml(siteHost(url))}</a>.
</div>
</body>
</html>`;
}

/** Parent invitations one student can send in a day. An invitation goes to an address the student types, so it must not become a way to flood inboxes. */
export const PARENT_INVITES_PER_DAY = 3;

/** To a parent or guardian: their student's invitation to connect. Every value must already be safe to put in HTML. */
export function parentInviteEmail(studentName: string, signupUrl: string, code: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;background-color:#0b0a16;color:#f8fafc;padding:32px;border-radius:20px;">
  <h1 style="margin:0 0 8px;color:#c4b5fd;font-size:26px;">A.R.I.S.E. Reader</h1>
  <h2 style="margin:24px 0 8px;color:#f8fafc;font-size:22px;">Connect with ${studentName}</h2>
  <p style="line-height:1.6;color:#cbd5e1;font-size:16px;">${studentName} uses A.R.I.S.E. Reader to read books and take reading quizzes, and asked us to send you this invitation.</p>
  <p style="line-height:1.6;color:#cbd5e1;font-size:16px;">Create a free Parent account to connect to ${studentName}, view reading progress, and receive your private Parent Proctor Code for quizzes.</p>
  <p style="margin:24px 0;"><a href="${signupUrl}" style="display:inline-block;background-color:#7c3aed;background-image:linear-gradient(90deg,#7c3aed,#c026d3,#06b6d4);color:#ffffff;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:12px;">Create / Connect Parent Account</a></p>
  <p style="color:#94a3b8;font-size:14px;">Student link code: <strong style="color:#ffffff;letter-spacing:.08em;">${code}</strong></p>
  <p style="color:#94a3b8;font-size:13px;margin-top:24px;">If you don't know ${studentName}, you can ignore this email.</p>
</div>`;
}

const esc = (value: unknown) => escapeHtml(String(value ?? ""));

/**
 * The email a teacher (or the admin) sends to a student's parent or guardian who has no account yet:
 * what A.R.I.S.E. Reader is, what a parent account does, and how to sign up with the student's code.
 * Every value is escaped here, so plain text is what to pass in.
 */
export function parentProgramEmail(info: { studentName: string; senderName: string; signupUrl: string; code: string; siteUrl?: string; maxChildren?: number }): string {
  const student = esc(info.studentName || "your child");
  // The full name once, so there is no doubt which child; the first name after that, the way a person would write it.
  const first = esc(String(info.studentName || "").trim().split(/\s+/)[0] || "your child");
  const sender = esc(info.senderName || "Your child's teacher");
  const url = esc(info.signupUrl);
  const site = esc(siteHost(info.siteUrl || DEFAULT_SITE_URL));
  const h2 = "margin:28px 0 10px;color:#f8fafc;font-size:18px;";
  const p = "margin:0 0 12px;line-height:1.6;color:#cbd5e1;font-size:16px;";
  const li = "margin:0 0 8px;line-height:1.55;color:#cbd5e1;font-size:16px;";
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;background-color:#0b0a16;color:#f8fafc;padding:32px;border-radius:20px;">
  <h1 style="margin:0 0 4px;color:#c4b5fd;font-size:26px;">A.R.I.S.E. Reader</h1>
  <p style="margin:0;color:#94a3b8;font-size:14px;">Read a book. Take a quiz. Earn points.</p>
  <h2 style="margin:24px 0 10px;color:#f8fafc;font-size:22px;">You're invited to follow ${student}'s reading</h2>
  <p style="${p}">${sender} uses A.R.I.S.E. Reader with ${student} and asked us to send you this. You don't need an account yet. This email explains what the program is and how to join.</p>

  <h2 style="${h2}">What it is</h2>
  <ul style="margin:0;padding-left:22px;">
    <li style="${li}">${first} picks a book and reads it.</li>
    <li style="${li}">Then comes a short quiz on the book. A score of 70% or higher earns that book's points.</li>
    <li style="${li}">Points add up, so ${first} can see the reading pay off and keep going.</li>
  </ul>

  <h2 style="${h2}">What a parent account does</h2>
  <ul style="margin:0;padding-left:22px;">
    <li style="${li}">See ${first}'s quiz history and reading growth.</li>
    <li style="${li}">Get a private Parent Proctor Code, so ${first} can take quizzes and reading tests at home with you.</li>
    <li style="${li}">Use parent controls for games and access.</li>
    <li style="${li}">It is free${info.maxChildren ? `, and one parent account can follow up to ${Number(info.maxChildren)} children` : ""}.</li>
  </ul>

  <h2 style="${h2}">How to sign up (about two minutes)</h2>
  <ol style="margin:0;padding-left:22px;">
    <li style="${li}">Tap the button below. ${first}'s code is already filled in.</li>
    <li style="${li}">Type your name, and choose a username and a password.</li>
    <li style="${li}">Log in. You are connected to ${first} right away.</li>
  </ol>
  <p style="margin:22px 0;"><a href="${url}" style="display:inline-block;background-color:#7c3aed;background-image:linear-gradient(90deg,#7c3aed,#c026d3,#06b6d4);color:#ffffff;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:12px;">Create your free parent account</a></p>
  <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;">${first}'s parent code: <strong style="color:#ffffff;letter-spacing:.08em;">${esc(info.code)}</strong></p>
  <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;">If the button does not work, go to ${site}/#/parent-signup and type the code.</p>
  <p style="margin:0;color:#94a3b8;font-size:14px;">Already have a parent account? Log in and enter the code on your dashboard to add ${first}.</p>
  <p style="color:#94a3b8;font-size:13px;margin-top:24px;">${sender} sent this through A.R.I.S.E. Reader. If you don't know ${student}, you can ignore this email.</p>
</div>`;
}
