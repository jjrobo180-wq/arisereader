// Arise To Do ↔ Google: Classroom, Docs (Drive), Calendar and Gmail, from one Google sign-in.
//
// Each part is switched on by itself ("Connect Classroom", "Connect Docs"…), and Google asks only for what
// that part needs, adding it to what was already allowed (include_granted_scopes), so a family that only
// wants Classroom never sees a Gmail permission. The server keeps the Google sign-in (server/googleConnect.ts),
// never the browser; this file holds the rules both sides use.
import type { Task } from "./teacherHub";

export const GOOGLE_FEATURES = ["classroom", "classroomPost", "docs", "calendar", "gmail"] as const;
export type GoogleFeature = typeof GOOGLE_FEATURES[number];
/** What people can switch on. Gmail is left out (Nov 25, 2026): reading the inbox is a "restricted" Google
 *  permission that needs a paid outside security review before anyone but the owner can connect. Docs uses
 *  drive.file (only Docs made in, or opened from, To Do) for the same reason; neither needs that review. */
export const OFFERED_FEATURES: readonly GoogleFeature[] = GOOGLE_FEATURES.filter((f) => f !== "gmail");

const G = "https://www.googleapis.com/auth/";
export const BASE_SCOPES = ["openid", "email", "profile"];
export const FEATURE_SCOPES: Record<GoogleFeature, string[]> = {
  // Read: her classes, her own assignments and whether they're turned in, a teacher's classwork and class lists.
  classroom: [`${G}classroom.courses.readonly`, `${G}classroom.coursework.me.readonly`, `${G}classroom.coursework.students.readonly`, `${G}classroom.rosters.readonly`],
  // Write, for teachers: post an announcement or an assignment to a class.
  classroomPost: [`${G}classroom.announcements`, `${G}classroom.coursework.students`],
  // Make a new Doc from a to-do, see and add to the Docs made in To Do (drive.file: never the rest of Drive).
  docs: [`${G}drive.file`],
  // See events and put to-dos with a time on the calendar.
  calendar: [`${G}calendar.events`],
  // Read the inbox to turn an email into a to-do (never sends or deletes).
  gmail: [`${G}gmail.readonly`],
};

export const FEATURE_INFO: Record<GoogleFeature, { name: string; does: string }> = {
  classroom: { name: "Google Classroom", does: "Assignments become to-dos with their due dates, checked off when they're turned in. Teachers also see their classes and class lists." },
  classroomPost: { name: "Post to Classroom", does: "Teachers: post an announcement or an assignment to a class from To Do." },
  docs: { name: "Google Docs", does: "Make a Google Doc from a to-do, attach it, and add to it later. To Do only sees the Docs it made, never the rest of your Drive." },
  calendar: { name: "Google Calendar", does: "See what's coming up, and put to-dos that have a time on your Google Calendar." },
  gmail: { name: "Gmail", does: "Turn an email into a to-do. To Do only reads; it never sends or deletes email." },
};

/** Which features the scopes Google granted cover (all of a feature's scopes, not just some). */
export function featuresFromScopes(scope: string | string[]): GoogleFeature[] {
  const have = new Set(Array.isArray(scope) ? scope : String(scope || "").split(/\s+/));
  return GOOGLE_FEATURES.filter((f) => FEATURE_SCOPES[f].every((s) => have.has(s)));
}

/** Google's sign-in page for one feature. `state` ties the answer back to the account (signed on the server). */
export function googleAuthUrl(opts: { clientId: string; redirectUri: string; feature: GoogleFeature; state: string; email?: string }): string {
  const p = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: [...BASE_SCOPES, ...FEATURE_SCOPES[opts.feature]].join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state: opts.state,
  });
  if (opts.email) p.set("login_hint", opts.email);
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

// ——— Classroom ———

/** One Classroom assignment as To Do shows it. `dueAt` is the moment it's due (Classroom keeps due times
 *  in UTC), or "" when it has a due day but no time (`dueDay`), or neither. */
export type ClassroomItem = { key: string; title: string; course: string; link: string; dueAt: string; dueDay: string; done: boolean; notes: string };

const pad = (n: number) => String(n).padStart(2, "0");

/** Classroom's courseWork (+ this student's submission, when she is a student in the class) → an item. */
export function classroomItem(course: { id: string; name: string }, work: any, submission?: any): ClassroomItem | null {
  const title = String(work?.title || "").trim();
  if (!title || !work?.id) return null;
  const d = work.dueDate;
  let dueAt = "", dueDay = "";
  if (d?.year && d?.month && d?.day) {
    if (work.dueTime && (work.dueTime.hours != null || work.dueTime.minutes != null)) {
      dueAt = new Date(Date.UTC(d.year, d.month - 1, d.day, work.dueTime.hours || 0, work.dueTime.minutes || 0)).toISOString();
    } else dueDay = `${d.year}-${pad(d.month)}-${pad(d.day)}`;
  }
  const state = String(submission?.state || "");
  return {
    key: `classroom:${course.id}:${work.id}`,
    title: title.slice(0, 200),
    course: String(course.name || "").slice(0, 120),
    link: String(work.alternateLink || ""),
    dueAt, dueDay,
    done: state === "TURNED_IN" || state === "RETURNED",
    notes: String(work.description || "").trim().slice(0, 1000),
  };
}

/** A moment as this device's own day and time ("2026-11-24", "23:59"). */
export function localDayTime(iso: string): { day: string; time: string } {
  const t = new Date(iso);
  if (!Number.isFinite(t.getTime())) return { day: "", time: "" };
  return { day: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`, time: `${pad(t.getHours())}:${pad(t.getMinutes())}` };
}

export type GoogleTask = Task & { googleId?: string; dueTime?: string };

/** New assignments become to-dos (in the class's name); ones already here are kept in step: checked off when
 *  turned in, and the title and due date follow Classroom. A to-do checked off here stays checked off. */
export function mergeClassroom(tasks: GoogleTask[], items: ClassroomItem[], makeId: () => string, now: Date = new Date()): { tasks: GoogleTask[]; added: number; updated: number } {
  let added = 0, updated = 0;
  const next = [...tasks];
  const stamp = now.toISOString();
  for (const item of items) {
    const when = item.dueAt ? localDayTime(item.dueAt) : { day: item.dueDay, time: "" };
    const title = item.course ? `${item.title} (${item.course})` : item.title;
    const notes = [item.notes, item.link].filter(Boolean).join("\n\n");
    const at = next.findIndex((t) => t.googleId === item.key);
    if (at < 0) {
      if (item.done) continue; // already turned in before it was ever brought in: nothing to do
      next.push({ id: makeId(), title, dueDate: when.day, recurring: "", done: false, notes: notes || undefined, googleId: item.key, ...(when.time ? { dueTime: when.time } : {}) });
      added++;
      continue;
    }
    const t = next[at];
    const change: Partial<GoogleTask> = {};
    if (item.done && !t.done) Object.assign(change, { done: true, doneAt: stamp });
    if (title !== t.title) change.title = title;
    if (when.day && when.day !== t.dueDate) change.dueDate = when.day;
    if (when.time && when.time !== t.dueTime) change.dueTime = when.time;
    if (Object.keys(change).length) { next[at] = { ...t, ...change }; updated++; }
  }
  return { tasks: next, added, updated };
}

export const classroomSummary = (added: number, updated: number) =>
  [added ? `${added} new from Classroom` : "", updated ? `${updated} updated` : ""].filter(Boolean).join(", ");

// ——— Docs ———

export type GoogleFile = { id: string; name: string; kind: "doc" | "sheet" | "slides" | "pdf" | "file"; link: string; modified: string };

export function fileKind(mime: string): GoogleFile["kind"] {
  if (mime === "application/vnd.google-apps.document") return "doc";
  if (mime === "application/vnd.google-apps.spreadsheet") return "sheet";
  if (mime === "application/vnd.google-apps.presentation") return "slides";
  if (mime === "application/pdf") return "pdf";
  return "file";
}

export const driveFile = (f: any): GoogleFile => ({ id: String(f.id), name: String(f.name || "Untitled").slice(0, 200), kind: fileKind(String(f.mimeType || "")), link: String(f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`), modified: String(f.modifiedTime || "") });

/** A Drive search for files whose name has these words (quotes and backslashes escaped for Drive's query). */
export function driveQuery(words: string): string {
  const base = "trashed = false and (mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.google-apps.presentation' or mimeType = 'application/pdf')";
  const w = String(words || "").trim().slice(0, 100).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return w ? `${base} and name contains '${w}'` : base;
}

/** A Doc's link in a to-do's notes, on its own line, once. */
export function attachDoc(notes: string | undefined, file: Pick<GoogleFile, "name" | "link">): string {
  const line = `${file.name}: ${file.link}`;
  const now = String(notes || "");
  if (now.includes(file.link)) return now;
  return now ? `${now}\n${line}` : line;
}

// ——— Calendar ———

export type CalendarEvent = { id: string; title: string; start: string; end: string; allDay: boolean; link: string };

export const calendarEvent = (e: any): CalendarEvent => ({
  id: String(e.id), title: String(e.summary || "(No title)").slice(0, 200),
  start: String(e.start?.dateTime || e.start?.date || ""), end: String(e.end?.dateTime || e.end?.date || ""),
  allDay: !e.start?.dateTime, link: String(e.htmlLink || ""),
});

/** A to-do as a Google Calendar event: at its time for 30 minutes, or all day when it has no time. */
export function eventForTask(task: { title: string; dueDate: string; dueTime?: string; notes?: string }, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) throw new Error("Give the to-do a date first.");
  const description = task.notes ? String(task.notes).slice(0, 2000) : undefined;
  if (task.dueTime && /^\d{2}:\d{2}$/.test(task.dueTime)) {
    const [h, m] = task.dueTime.split(":").map(Number);
    const endMin = h * 60 + m + 30;
    const end = endMin >= 24 * 60 ? `${task.dueDate}T23:59:00` : `${task.dueDate}T${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}:00`;
    return { summary: task.title, description, start: { dateTime: `${task.dueDate}T${task.dueTime}:00`, timeZone }, end: { dateTime: end, timeZone } };
  }
  const next = new Date(`${task.dueDate}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  return { summary: task.title, description, start: { date: task.dueDate }, end: { date: next.toISOString().slice(0, 10) } };
}

// ——— Gmail ———

export type MailItem = { id: string; subject: string; from: string; date: string; snippet: string; link: string };

export function mailItem(m: any): MailItem {
  const headers: Array<{ name: string; value: string }> = m?.payload?.headers || [];
  const h = (name: string) => headers.find((x) => x.name?.toLowerCase() === name)?.value || "";
  const from = h("from").replace(/<[^>]*>/g, "").replace(/"/g, "").trim();
  return { id: String(m.id), subject: (h("subject") || "(No subject)").slice(0, 200), from: from.slice(0, 120), date: h("date"), snippet: String(m.snippet || "").slice(0, 300), link: `https://mail.google.com/mail/u/0/#all/${m.id}` };
}

/** An email as a to-do: its subject, with who sent it and a link back to the email. */
export const taskFromMail = (m: MailItem) => ({ title: m.subject.slice(0, 200), notes: [`From ${m.from}`, m.snippet, m.link].filter(Boolean).join("\n\n") });
