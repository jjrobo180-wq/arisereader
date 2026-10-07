// Meeting polls: a teacher offers a few possible times for an IEP or re-evaluation meeting,
// emails the people who need to be there, and each person says which times work.
import { cleanDate, cleanTime, clock12 } from "./teacherHub";

export const POLL_LIMITS = {
  options: 8,
  invitees: 20,
  title: 100,
  location: 120,
  message: 600,
  name: 80,
  role: 40,
  senderName: 60,
  comment: 400,
  pollsPerDay: 20,
  emailsPerDay: 80,
  textsPerDay: 60,
} as const;

export type PollAnswer = "yes" | "maybe" | "no";
export const POLL_ANSWERS: readonly PollAnswer[] = ["yes", "maybe", "no"];
/** Who can be asked. The team labels match the IEP guide's contact roles. */
export const INVITEE_ROLES = [
  "Parent or guardian", "Student", "Gen ed teacher", "Special ed teacher", "Social worker", "OT", "Speech (SLP)", "Psych",
  "Counselor", "Nurse / health", "Sped coordinator", "Meeting leader", "Administrator", "Interpreter", "Advocate", "Other",
] as const;
/** The ones offered as one-tap buttons. */
export const QUICK_ROLES = ["Parent or guardian", "Gen ed teacher", "Social worker", "OT", "Speech (SLP)", "Psych", "Administrator", "Other"] as const;

export type PollOption = { id: string; date: string; start: string; end: string };
export type PollInvitee = { name: string; email: string; phone: string; role: string };
export type SendVia = "site" | "mailbox" | "self";
export type PollInput = { title: string; location: string; message: string; hubMeetingId: string; senderName: string; replyTo: string; sendVia: SendVia; sendText: boolean; options: PollOption[]; invitees: PollInvitee[] };

const EMAIL = /^[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[^\s@<>()"',;:]{2,}$/;
export const cleanEmail = (value: unknown) => {
  const email = String(value ?? "").trim().toLowerCase();
  return email.length <= 120 && EMAIL.test(email) ? email : "";
};
/** A phone number as +15551234567 (US numbers may be typed any usual way), or "" when it isn't one. */
export function cleanPhone(value: unknown): string {
  const text = String(value ?? "").trim();
  const digits = text.replace(/\D/g, "");
  if (text.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : "";
  if (digits.length === 10 && /^[2-9]/.test(digits)) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1") && /^[2-9]/.test(digits[1])) return `+${digits}`;
  return "";
}
const oneLine = (value: unknown, max: number) => String(value ?? "").replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f<>]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** Checks what a teacher typed. Returns the cleaned poll, or one plain sentence saying what to fix. */
export function cleanPollInput(raw: any, today: string): { ok: true; poll: PollInput } | { ok: false; error: string } {
  const title = oneLine(raw?.title, POLL_LIMITS.title);
  if (!title) return { ok: false, error: "Give the meeting a name, like “IEP meeting for Jordan”." };

  const seenOptions = new Set<string>();
  const options: PollOption[] = [];
  for (const item of Array.isArray(raw?.options) ? raw.options : []) {
    const date = cleanDate(item?.date);
    const start = cleanTime(item?.start);
    const end = cleanTime(item?.end);
    if (!date || !start) return { ok: false, error: "Every time needs a date and a start time." };
    if (date < today) return { ok: false, error: "A time you offered is already in the past." };
    if (end && end <= start) return { ok: false, error: "A time ends before it starts." };
    const key = `${date} ${start}`;
    if (seenOptions.has(key)) continue;
    seenOptions.add(key);
    options.push({ id: `o${options.length + 1}`, date, start, end });
  }
  if (options.length < 2) return { ok: false, error: "Offer at least two times so people have a choice." };
  if (options.length > POLL_LIMITS.options) return { ok: false, error: `Offer ${POLL_LIMITS.options} times or fewer.` };

  const sendVia: SendVia = raw?.sendVia === "mailbox" ? "mailbox" : raw?.sendVia === "self" ? "self" : "site";
  const sendText = sendVia !== "self" && raw?.sendText === true;
  if (sendText && raw?.textConsent !== true) return { ok: false, error: "Please confirm these people are OK with getting a text about the meeting." };

  const invitees: PollInvitee[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(raw?.invitees) ? raw.invitees : []) {
    const typedEmail = String(item?.email ?? "").trim();
    const typedPhone = String(item?.phone ?? "").trim();
    const typedName = oneLine(item?.name, POLL_LIMITS.name);
    if (!typedEmail && !typedPhone && !typedName) continue; // a blank row
    const email = typedEmail ? cleanEmail(typedEmail) : "";
    if (typedEmail && !email) return { ok: false, error: `“${oneLine(typedEmail, 60)}” is not a working email address.` };
    const phone = typedPhone ? cleanPhone(typedPhone) : "";
    if (typedPhone && !phone) return { ok: false, error: `“${oneLine(typedPhone, 40)}” is not a working phone number.` };
    if (sendVia === "self") {
      if (!typedName && !email) return { ok: false, error: "Give each person a name, so you know who is who." };
    } else if (!email && !(phone && sendText)) {
      return { ok: false, error: `${typedName || "Someone"} needs an email address${sendText ? " or a phone number" : ""}.` };
    }
    const key = email ? `e:${email}` : phone ? `p:${phone}` : "";
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    const role = oneLine(item?.role, POLL_LIMITS.role) || "Other";
    invitees.push({ name: typedName || (email ? email.split("@")[0] : "Guest"), email, phone, role });
  }
  if (!invitees.length) return { ok: false, error: "Add at least one person to ask." };
  if (invitees.length > POLL_LIMITS.invitees) return { ok: false, error: `Ask ${POLL_LIMITS.invitees} people or fewer at a time.` };

  // The name shown on the email, and where replies go. Quotes and angle brackets would break the "From" line.
  const senderName = oneLine(raw?.senderName, POLL_LIMITS.senderName).replace(/["@]/g, "").trim();
  const replyRaw = String(raw?.replyTo ?? "").trim();
  const replyTo = replyRaw ? cleanEmail(replyRaw) : "";
  if (replyRaw && !replyTo) return { ok: false, error: `“${oneLine(replyRaw, 60)}” is not a working email address for replies.` };

  return {
    ok: true,
    poll: { senderName, replyTo, sendVia, sendText, title, location: oneLine(raw?.location, POLL_LIMITS.location), message: oneLine(raw?.message, POLL_LIMITS.message), hubMeetingId: oneLine(raw?.hubMeetingId, 60), options, invitees },
  };
}

/** Answers from a reply, kept to this poll's times. A time left out counts as no answer. */
export function cleanAnswers(raw: any, options: PollOption[]): Record<string, PollAnswer> {
  const out: Record<string, PollAnswer> = {};
  for (const option of options) {
    const value = raw?.[option.id];
    if (POLL_ANSWERS.includes(value)) out[option.id] = value;
  }
  return out;
}
export const cleanComment = (value: unknown) => oneLine(value, POLL_LIMITS.comment);

/** "Tuesday, Oct 13 · 3:30 – 4:30 PM" */
export function describeOption(option: Pick<PollOption, "date" | "start" | "end">): string {
  const day = new Date(`${option.date}T12:00:00Z`);
  const label = Number.isNaN(day.getTime())
    ? option.date
    : day.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
  const time = option.end ? `${clock12(option.start)} – ${clock12(option.end)}` : clock12(option.start);
  return `${label} · ${time}`;
}

export type PollPerson = { name: string; answers: Record<string, PollAnswer>; respondedAt: string | null };
export type OptionTally = { id: string; yes: number; maybe: number; no: number; waiting: number; everyone: boolean };

/** Per time: how many said yes, maybe, no, or have not answered. */
export function tallyPoll(options: PollOption[], people: PollPerson[]): { options: OptionTally[]; best: string | null } {
  const tallies = options.map((option) => {
    const t: OptionTally = { id: option.id, yes: 0, maybe: 0, no: 0, waiting: 0, everyone: false };
    for (const person of people) {
      const answer = person.respondedAt ? person.answers[option.id] : undefined;
      if (answer) t[answer]++;
      else t.waiting++;
    }
    t.everyone = people.length > 0 && t.yes === people.length;
    return t;
  });
  // Best = nobody said no, then the most yes, then the most maybe; the earliest time wins a tie.
  const ranked = tallies
    .map((t, index) => ({ t, index }))
    .filter(({ t }) => t.yes + t.maybe > 0)
    .sort((a, b) => a.t.no - b.t.no || b.t.yes - a.t.yes || b.t.maybe - a.t.maybe || a.index - b.index);
  return { options: tallies, best: ranked[0]?.t.id ?? null };
}

// ---- Messages a teacher can send from their own email or phone -----------------

export type PollMessageInput = { guest: string; sender: string; title: string; location: string; options: Pick<PollOption, "date" | "start" | "end">[]; link: string; reminder?: boolean; note?: string };

/** The email a teacher sends themselves: a subject and a body (plain text, with the person's own link). */
export function inviteEmailText(m: PollMessageInput): { subject: string; body: string } {
  const where = m.location ? ` (${m.location})` : "";
  return {
    subject: `${m.reminder ? "Reminder: " : ""}Which times work for ${m.title}?`,
    body: [
      `Hi ${m.guest},`, "",
      `${m.reminder ? "Just a reminder: " : ""}I'm trying to find a time for ${m.title}${where}. These times are possible:`, "",
      ...m.options.map((o) => `- ${describeOption(o)}`), "",
      ...(m.note ? [m.note, ""] : []),
      `Please tap here to tell me which times work. It takes about a minute and you don't need an account:`, m.link, "",
      "Thank you,", m.sender,
    ].join("\n"),
  };
}

/** A short text message version. */
export function inviteSmsText(m: Pick<PollMessageInput, "guest" | "sender" | "title" | "link" | "reminder">): string {
  const title = m.title.length > 60 ? `${m.title.slice(0, 57)}...` : m.title;
  return `${m.reminder ? "Reminder: " : ""}Hi ${m.guest}! ${m.sender} asks: which times work for ${title}? Tap to answer (1 minute, no account): ${m.link}`;
}

export function bookedEmailText(m: { guest: string; sender: string; title: string; location: string; when: string }): { subject: string; body: string } {
  return {
    subject: `The time is set: ${m.title}`,
    body: [`Hi ${m.guest},`, "", `Thank you for answering. ${m.title} is set for:`, m.when + (m.location ? ` (${m.location})` : ""), "", "Thank you,", m.sender].join("\n"),
  };
}

export function bookedSmsText(m: { guest: string; sender: string; title: string; location: string; when: string }): string {
  return `Hi ${m.guest}! ${m.sender}: ${m.title} is set for ${m.when}${m.location ? ` (${m.location})` : ""}. Thank you!`;
}
