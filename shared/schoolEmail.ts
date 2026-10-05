// Teacher sign-up takes a school email only.
//
// A teacher who signs up with an address ending in .edu, .net, .org or .us, and then
// proves the address is theirs by typing the code emailed to it, is let in at
// once with no wait for the admin. Anything else (.com and every other ending)
// is refused. Teachers who signed up before this rule keep their accounts as
// they are: the rule is only checked when a new teacher account is made.

/**
 * The only endings a teacher's sign-up email may have. .us is here for the many
 * public school districts whose addresses look like name@district.k12.co.us.
 */
export const SCHOOL_EMAIL_ENDINGS = ["edu", "net", "org", "us"] as const;

/**
 * Home internet and free mailbox companies whose addresses end in .net or .org.
 * Anyone can get one of these, so it says nothing about working at a school.
 */
const PERSONAL_PROVIDERS = new Set([
  // home internet providers
  "comcast.net", "att.net", "sbcglobal.net", "bellsouth.net", "verizon.net", "cox.net", "charter.net",
  "earthlink.net", "optonline.net", "frontiernet.net", "centurylink.net", "windstream.net", "suddenlink.net",
  "mediacombb.net", "tds.net", "cableone.net", "pacbell.net", "ameritech.net", "swbell.net", "snet.net",
  "flash.net", "prodigy.net", "netzero.net", "atlanticbb.net", "zoominternet.net", "ptd.net", "hughes.net",
  "fuse.net", "knology.net", "bresnan.net", "sonic.net", "telus.net", "epix.net",
  // free and throwaway mailboxes
  "gmx.net", "usa.net", "fastmail.net", "posteo.net", "mailbox.org", "riseup.net", "disroot.org",
  "mailinator.net", "mailinator.org", "guerrillamail.net", "guerrillamail.org", "10minutemail.net",
  "temp-mail.org", "tempmail.net", "yopmail.net", "trashmail.net", "spamgourmet.net", "spamgourmet.org",
]);

/**
 * Browser session key. The login page leaves a teacher's username here when their school
 * email still needs its code, and the teacher sign-up page picks it up to ask for the code.
 */
export const TEACHER_CONFIRM_KEY = "arise_teacher_confirm";

export type SchoolEmailCheck = { ok: true; email: string } | { ok: false; message: string };

const ENDINGS_TEXT = ".edu, .net, .org or .us";

/**
 * Checks the email a new teacher typed. Gives back the address tidied up
 * (trimmed, lower case), or the message to show them.
 */
export function checkSchoolEmail(raw: unknown): SchoolEmailCheck {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!email) return { ok: false, message: `Enter your school email address (ending in ${ENDINGS_TEXT}).` };
  // one @, something before it, and a dotted name after it made of letters, digits and hyphens
  const shaped = /^[^\s@<>()",;:\\]+@([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)$/.exec(email);
  if (!shaped || email.length > 254) return { ok: false, message: "That doesn't look like an email address. Please check it and try again." };
  const domain = shaped[1];
  const ending = domain.slice(domain.lastIndexOf(".") + 1);
  if (!(SCHOOL_EMAIL_ENDINGS as readonly string[]).includes(ending)) {
    return { ok: false, message: `Teacher accounts need your school email address, ending in ${ENDINGS_TEXT}. A personal address such as Gmail, or any other .com address, can't be used.` };
  }
  const labels = domain.split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    if (PERSONAL_PROVIDERS.has(labels.slice(i).join("."))) {
      return { ok: false, message: "That is a personal email address. Please use the email address your school gave you." };
    }
  }
  return { ok: true, email };
}
