// Parent invitations sent by a teacher or the admin: the teacher types a parent's or guardian's
// email for a student, and the site sends that person an email about the program, what a parent
// account does, and how to sign up with the student's code. The parent needs no account first.
//
// What was sent is kept (per student, newest first) so staff can see who was invited and when.

export const PARENT_INVITE_LOG_KEY = "parent_invite_emails";
/** One staff member can send this many invitations in a day. A class set and then some. */
export const STAFF_INVITES_PER_DAY = 80;
/** The same address is not written to more than this many times in a day, whoever asks. */
export const INVITES_PER_ADDRESS_PER_DAY = 2;
/** How many sends are remembered for one student. */
export const KEPT_PER_STUDENT = 8;
/**
 * Invitations to families whose child has no account yet are not tied to a student. They are kept
 * together under this key, and more of them are remembered, since it is one list for everyone.
 */
export const NEW_FAMILY_KEY = 0;
export const KEPT_NEW_FAMILIES = 300;
export const CHILD_NAME_MAX = 60;
const keptFor = (studentId: number | string) => (Number(studentId) === NEW_FAMILY_KEY ? KEPT_NEW_FAMILIES : KEPT_PER_STUDENT);
const DAY_MS = 24 * 60 * 60 * 1000;

export type SentInvite = { email: string; sentAt: string; by: number; byName: string; /** For a new family: the child's name, if the sender gave one. */ child?: string };
/** Student id to what was sent for that student, newest first. */
export type InviteLog = Record<string, SentInvite[]>;

/** A typed email address tidied up (trimmed, lower case), or null when it is not one. */
export function cleanParentEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  return email.length <= 254 && /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:".]{2,}$/.test(email) ? email : null;
}

/** A child's name as typed, tidied up ("" when none was given). */
export function cleanChildName(value: unknown): string {
  return String(value ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, CHILD_NAME_MAX);
}

/** The saved log made safe to use, whatever was stored. */
export function readInviteLog(raw: unknown): InviteLog {
  let data: unknown = raw;
  if (typeof raw === "string") { try { data = JSON.parse(raw); } catch { data = null; } }
  const out: InviteLog = {};
  if (!data || typeof data !== "object" || Array.isArray(data)) return out;
  for (const [studentId, list] of Object.entries(data as Record<string, unknown>)) {
    if (!/^\d+$/.test(studentId) || !Array.isArray(list)) continue;
    const clean = list
      .filter((x: any) => x && typeof x === "object" && cleanParentEmail(x.email) && Number.isFinite(Date.parse(String(x.sentAt))))
      .map((x: any): SentInvite => ({ email: cleanParentEmail(x.email)!, sentAt: new Date(Date.parse(String(x.sentAt))).toISOString(), by: Number(x.by) || 0, byName: String(x.byName || "").slice(0, 80), ...(cleanChildName(x.child) ? { child: cleanChildName(x.child) } : {}) }))
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
      .slice(0, keptFor(studentId));
    if (clean.length) out[studentId] = clean;
  }
  return out;
}

export const invitesFor = (log: InviteLog, studentId: number): SentInvite[] => log[String(studentId)] || [];

/** The log with one more send on top of that student's list. The log handed in is not changed. */
export function recordInvite(log: InviteLog, studentId: number, invite: SentInvite): InviteLog {
  return { ...log, [String(studentId)]: [invite, ...invitesFor(log, studentId)].slice(0, keptFor(studentId)) };
}

/** How many invitations in the last day match: sent by this person, or sent to this address. */
export function sentInLastDay(log: InviteLog, match: { by?: number; email?: string }, nowMs: number): number {
  let count = 0;
  for (const list of Object.values(log)) for (const sent of list) {
    if (nowMs - Date.parse(sent.sentAt) >= DAY_MS) continue;
    if ((match.by !== undefined && sent.by === match.by) || (match.email !== undefined && sent.email === match.email)) count++;
  }
  return count;
}

/** One line per address for the screen: the latest send to it, and how many times in all. */
export function inviteSummary(invites: SentInvite[]): { email: string; sentAt: string; byName: string; times: number; child?: string }[] {
  const seen = new Map<string, { email: string; sentAt: string; byName: string; times: number; child?: string }>();
  for (const sent of [...invites].sort((a, b) => b.sentAt.localeCompare(a.sentAt))) {
    const had = seen.get(sent.email);
    if (had) { had.times++; if (!had.child && sent.child) had.child = sent.child; }
    else seen.set(sent.email, { email: sent.email, sentAt: sent.sentAt, byName: sent.byName, times: 1, ...(sent.child ? { child: sent.child } : {}) });
  }
  return [...seen.values()];
}

export const INVITE_NOTE_MAX = 600;
/** Something the sender wants to add in their own words, tidied: line breaks kept, odd characters and long gaps taken out, not too long. */
export function cleanInviteNote(value: unknown): string {
  return String(value ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f<>]/g, " ").split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, INVITE_NOTE_MAX).trim();
}
