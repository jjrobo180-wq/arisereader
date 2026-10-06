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
  comment: 400,
  pollsPerDay: 20,
  emailsPerDay: 80,
} as const;

export type PollAnswer = "yes" | "maybe" | "no";
export const POLL_ANSWERS: readonly PollAnswer[] = ["yes", "maybe", "no"];
export const INVITEE_ROLES = ["Parent or guardian", "Staff", "Other"] as const;

export type PollOption = { id: string; date: string; start: string; end: string };
export type PollInvitee = { name: string; email: string; role: string };
export type PollInput = { title: string; location: string; message: string; hubMeetingId: string; options: PollOption[]; invitees: PollInvitee[] };

const EMAIL = /^[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[^\s@<>()"',;:]{2,}$/;
export const cleanEmail = (value: unknown) => {
  const email = String(value ?? "").trim().toLowerCase();
  return email.length <= 120 && EMAIL.test(email) ? email : "";
};
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

  const invitees: PollInvitee[] = [];
  const seenEmails = new Set<string>();
  for (const item of Array.isArray(raw?.invitees) ? raw.invitees : []) {
    const email = cleanEmail(item?.email);
    if (!email) return { ok: false, error: `“${oneLine(item?.email, 60) || "A blank email"}” is not a working email address.` };
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);
    const role = (INVITEE_ROLES as readonly string[]).includes(item?.role) ? String(item.role) : "Other";
    invitees.push({ name: oneLine(item?.name, POLL_LIMITS.name) || email.split("@")[0], email, role });
  }
  if (!invitees.length) return { ok: false, error: "Add at least one person to ask." };
  if (invitees.length > POLL_LIMITS.invitees) return { ok: false, error: `Ask ${POLL_LIMITS.invitees} people or fewer at a time.` };

  return {
    ok: true,
    poll: { title, location: oneLine(raw?.location, POLL_LIMITS.location), message: oneLine(raw?.message, POLL_LIMITS.message), hubMeetingId: oneLine(raw?.hubMeetingId, 60), options, invitees },
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
