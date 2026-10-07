// Teacher Hub: what a teacher's workspace holds, and the rules for adding to it
// in bulk (from AI, a photo, a file, pasted text or a connected calendar).
//
// The page is client/src/pages/TeacherHub.tsx. The workspace is saved as one
// JSON object per teacher (server/teacherHub.ts).

import { cleanPins, type Pin } from "./hubPins";
import type { StepPlan } from "./meetingSteps";

export type Student = {
  id: string;
  name: string;
  grade: string;
  accommodations: string;
  iepDate: string;
  reevalDate: string;
  readingLevel: string;
  mathLevel: string;
  notes: string;
};

export type Meeting = { id: string; student: string; type: string; date: string; /** "HH:MM", or "". */ time?: string; end?: string; room?: string; notes: string; done: boolean; /** Progress through the ten steps (shared/meetingSteps.ts). */ plan?: StepPlan };
export type Lesson = { id: string; title: string; subject: string; group: string; date: string; objective: string; materials: string };
export type Task = { id: string; title: string; dueDate: string; recurring: string; done: boolean; /** "high" floats a to-do up when sorting by importance. */ priority?: "high"; /** The day a repeating to-do was last checked off. */ lastDone?: string;
  /** Anything worth keeping with it: details, a phone number, a link. */
  notes?: string;
  /** Set when the to-do was made from a saved email (see shared/hubEmails.ts). */
  emailId?: string;
  /** When it was checked off (a moment, not a day), so it can be offered back for a day. */
  doneAt?: string;
  /** For a repeating to-do that just moved on to its next time: where it was, so that can be undone for a day. */
  rolled?: { dueDate: string; lastDone?: string; at: string };
};
export type NoteItem = { id: string; /** "" for a note that is not about one student (a staff meeting, a training). */ student: string; type: string; body: string; date: string; /** What the note is called, if it was given a name ("Staff meeting, Oct 7"). */ title?: string };
export type AriseRecord = { id: string; student: string; book: string; score: string; points: string; date: string };
export type BehaviorEntry = { id: string; student: string; points: number; reason: string; date: string };
export type AttendanceEntry = { id: string; student: string; date: string; status: "Present" | "Absent" | "Tardy" | "Excused"; className: string };
export type Assignment = { id: string; title: string; category: string; points: number; date: string };
export type GradeScore = { id: string; assignmentId: string; student: string; score: number | null; missing: boolean; excused: boolean };
export type ParentLog = { id: string; student: string; guardian: string; message: string; status: string; date: string };
export type ScheduleEntry = { id: string; student: string; day: string; start: string; end: string; label: string };
/** One reading of how a student is doing on a goal. */
export type GoalPoint = { id: string; date: string; value: number; note: string };
/** An IEP goal tracked over time. `up` means a higher number is better (accuracy); `down` means lower is better (outbursts a week). */
export type Goal = { id: string; student: string; area: string; text: string; baseline: number; target: number; unit: string; direction: "up" | "down"; startDate: string; targetDate: string; points: GoalPoint[] };
/** Minutes of a service a student's IEP requires each week. */
export type ServicePlan = { id: string; student: string; kind: string; minutesPerWeek: number; /** The day the minutes started counting, so weeks before it are never owed. */ since?: string };
/** Minutes actually delivered on a day. */
export type ServiceLog = { id: string; student: string; date: string; kind: string; minutes: number; note: string };
export type EmailItem = { id: string; from: string; subject: string; body: string; action: string; draft: string; date: string; /** The teacher flagged it: it floats to the top. */ flagged?: boolean };

/** Something on the teacher's calendar. `start` and `end` are "HH:MM", or "" for an all-day event. */
export type HubEvent = {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  start: string;
  end: string;
  location: string;
  notes: string;
  /** Set when the event came from a connected calendar; those events are replaced each time it syncs. */
  calendarId?: string;
  /** Set when the event is the booked time of a meeting; the meeting owns it. */
  meetingId?: string;
  /** The teacher checked it off: it happened. */
  done?: boolean;
  /** How it repeats ("Weekly", "Monthly", ...). `date` is then its first day. See shared/hubRepeat.ts. */
  repeat?: string;
  /** The last day a repeating event can fall on (YYYY-MM-DD). Left out, it goes on. */
  until?: string;
  /** Days taken out of a repeating event. */
  skip?: string[];
  /** Days of a repeating event that were checked off. */
  doneOn?: string[];
  /** Only on a drawn day of a repeating event, never saved: the id of the event it comes from. */
  seriesId?: string;
};

/**
 * Hides events by what they are called, because a connected calendar hands out new ids every time it is read.
 * With a `date` it hides the one on that day and time; without, every event with that name.
 */
export type HiddenRule = { id: string; title: string; date: string; start: string };

/** A calendar the teacher connected by its link (Google, Outlook, Apple or any calendar feed). */
export type HubCalendar = { id: string; name: string; url: string; syncedAt: string };

// The IEP guide (shared/hubGuide.ts has its checklist and rules).
/** Someone on the teacher's special education team. Every teacher keeps their own list; no names are built in. */
export type HubContact = { id: string; name: string; role: string; email: string; /** Weekly free times the teacher saved for this person (shared/availability.ts). */ free?: { day: number; start: string; end: string }[] };
/** A link the teacher uses for every IEP (a room form, a folder, a deadlines list). */
export type HubLink = { id: string; label: string; url: string };
export type GuideStep = { id: string; text: string; done: boolean; note: string };
export type GuideSection = { id: string; title: string; steps: GuideStep[] };
export type GuideKind = "IEP meeting" | "Re-evaluation";
/** One student's checklist for an IEP or re-evaluation meeting. */
export type IepGuide = {
  id: string;
  student: string;
  kind: GuideKind;
  /** YYYY-MM-DD, or "" until it is set. */
  planningDate: string;
  meetingDate: string;
  /** "HH:MM", or "". */
  meetingTime: string;
  room: string;
  parent1: string;
  parent1Phone: string;
  parent2: string;
  parent2Phone: string;
  /** Who is assigned to this student: a role's id to the id of one of the teacher's saved contacts. */
  team: Record<string, string>;
  sections: GuideSection[];
};

export const HUB_TABS = [
  "overview", "calendar", "caseload", "goals", "minutes", "iep", "guide", "lessons", "tasks", "notes", "arise", "behavior", "attendance", "gradebook", "parents", "schedules", "email",
] as const;
export type HubTab = (typeof HUB_TABS)[number];

export type Workspace = {
  version: number;
  profile: { school: string; gradeBand: string; subject: string; /** The name and reply address a teacher chose for meeting-poll emails. */ senderName?: string; replyEmail?: string };
  visibleTabs: Record<HubTab, boolean>;
  students: Student[];
  meetings: Meeting[];
  lessons: Lesson[];
  tasks: Task[];
  notes: NoteItem[];
  ariseRecords: AriseRecord[];
  behavior: BehaviorEntry[];
  attendance: AttendanceEntry[];
  assignments: Assignment[];
  gradeScores: GradeScore[];
  parentLogs: ParentLog[];
  schedules: ScheduleEntry[];
  emails: EmailItem[];
  goals: Goal[];
  services: ServicePlan[];
  serviceLogs: ServiceLog[];
  events: HubEvent[];
  calendars: HubCalendar[];
  /** Events the teacher chose not to see: on their calendar, but nothing to do with them. See shared/hubHidden.ts. */
  hiddenEvents?: HiddenRule[];
  guides: IepGuide[];
  spedContacts: HubContact[];
  guideLinks: HubLink[];
  /** Up to five pinned banners (see shared/hubPins.ts). */
  pins: Pin[];
};

export function emptyWorkspace(): Workspace {
  return {
    version: 1,
    profile: { school: "", gradeBand: "", subject: "" },
    visibleTabs: Object.fromEntries(HUB_TABS.map((tab) => [tab, true])) as Record<HubTab, boolean>,
    students: [], meetings: [], lessons: [], tasks: [], notes: [], ariseRecords: [], behavior: [], attendance: [],
    assignments: [], gradeScores: [], parentLogs: [], schedules: [], emails: [], goals: [], services: [], serviceLogs: [], events: [], calendars: [],
    guides: [], spedContacts: [], guideLinks: [], pins: [],
  };
}

const LISTS = ["students", "meetings", "lessons", "tasks", "notes", "ariseRecords", "behavior", "attendance", "assignments", "gradeScores", "parentLogs", "schedules", "emails", "goals", "services", "serviceLogs", "events", "calendars", "guides", "spedContacts", "guideLinks"] as const;

/** A saved workspace made safe to use: every list is a list, even in one saved before a list existed. */
export function normalizeWorkspace(raw: any): Workspace {
  const base = emptyWorkspace();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const out: any = {
    ...base,
    ...raw,
    profile: { ...base.profile, ...(raw.profile || {}) },
    visibleTabs: { ...base.visibleTabs, ...(raw.visibleTabs || {}), overview: true },
  };
  for (const key of LISTS) out[key] = Array.isArray(raw[key]) ? raw[key] : [];
  out.pins = cleanPins(raw.pins);
  out.hiddenEvents = (Array.isArray(raw.hiddenEvents) ? raw.hiddenEvents : [])
    .filter((r: any) => r && typeof r === "object" && typeof r.id === "string" && typeof r.title === "string" && r.title.trim())
    .map((r: any): HiddenRule => ({ id: r.id, title: r.title, date: typeof r.date === "string" ? r.date : "", start: typeof r.start === "string" ? r.start : "" }))
    .slice(0, 200);
  return out as Workspace;
}

// ─── Adding in bulk ─────────────────────────────────────────────────────────
//
// AI, a file or pasted text all end as the same thing: a set of suggested items,
// one list per place in the Hub. The teacher checks them, then they are merged in.

type TextField = { kind: "text"; label: string; max: number; required?: boolean; long?: boolean };
type DateField = { kind: "date"; label: string; required?: boolean; today?: boolean };
type TimeField = { kind: "time"; label: string };
type ChoiceField = { kind: "choice"; label: string; options: readonly string[]; fallback: string };
type NumberField = { kind: "number"; label: string; min: number; max: number; fallback: number | null };
type FlagField = { kind: "flag"; label: string };
export type HubField = TextField | DateField | TimeField | ChoiceField | NumberField | FlagField;

const text = (label: string, max: number, extra: Partial<TextField> = {}): TextField => ({ kind: "text", label, max, ...extra });
const date = (label: string, extra: Partial<DateField> = {}): DateField => ({ kind: "date", label, ...extra });
const time = (label: string): TimeField => ({ kind: "time", label });
const choice = (label: string, options: readonly string[], fallback = options[0]): ChoiceField => ({ kind: "choice", label, options, fallback });
const student = () => text("Student", 80);

export const HUB_CHOICES = {
  recurring: ["", "Daily", "Weekly", "Monthly", "Quarterly"],
  meetingType: ["Annual IEP", "Reevaluation", "Planning meeting", "Parent meeting", "Progress review", "Other"],
  lessonSubject: ["Math", "Reading", "Writing", "Push-in", "Pull-out", "Other"],
  noteType: ["Check-in", "Concern", "Meeting note", "Teacher note", "Progress note", "Staff meeting", "Team meeting", "Department meeting", "Training", "Committee", "General note"],
  attendance: ["Present", "Absent", "Tardy", "Excused"],
  category: ["Classwork", "Quiz", "Test", "Homework", "Project"],
  parentStatus: ["Sent", "Called", "Left voicemail", "Replied", "Acknowledged", "Needs follow-up"],
  day: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
} as const;

type ListSpec = {
  /** Where these go, as the teacher sees it. */
  label: string;
  tab: HubTab;
  /** Told to the AI: what belongs in this list. */
  hint: string;
  fields: Record<string, HubField>;
};

/** Every kind of thing that can be added in bulk. The order is the order the review screen shows them. */
export const HUB_IMPORT = {
  tasks: {
    label: "To-dos and reminders", tab: "tasks",
    hint: "Something the teacher has to do or remember. Use this for reminders and checklists.",
    fields: { title: text("To-do", 200, { required: true }), dueDate: date("Due"), recurring: choice("Repeats", HUB_CHOICES.recurring) },
  },
  events: {
    label: "Calendar", tab: "calendar",
    hint: "Something that happens on a day, usually at a time or a place: a class, a staff meeting, a duty, a school event, a day off.",
    fields: { title: text("Event", 200, { required: true }), date: date("Date", { required: true }), start: time("Starts"), end: time("Ends"), location: text("Where", 120), notes: text("Notes", 500, { long: true }) },
  },
  meetings: {
    label: "IEP and meetings", tab: "iep",
    hint: "An IEP, reevaluation, planning, parent or progress meeting about one student. Do not also put it in events.",
    fields: { student: student(), type: choice("Kind", HUB_CHOICES.meetingType, "Other"), date: date("Date"), notes: text("Notes", 1000, { long: true }) },
  },
  notes: {
    label: "Notes", tab: "notes",
    hint: "A check-in, a concern, meeting notes or any note worth keeping. Keep the teacher's wording. Notes from a staff meeting, a team meeting or a training are not about one student: leave the student empty for those.",
    fields: { student: student(), type: choice("Kind", HUB_CHOICES.noteType, "Teacher note"), date: date("Date", { today: true }), body: text("Note", 4000, { required: true, long: true }) },
  },
  students: {
    label: "Caseload", tab: "caseload",
    hint: "A student to add to the caseload, for example a row of a class list or roster.",
    fields: {
      name: text("Name", 80, { required: true }), grade: text("Grade", 20), readingLevel: text("Reading level", 40), mathLevel: text("Math level", 40),
      iepDate: date("IEP date"), reevalDate: date("Reevaluation date"), accommodations: text("Accommodations", 600, { long: true }), notes: text("Notes", 1000, { long: true }),
    },
  },
  lessons: {
    label: "Lessons", tab: "lessons",
    hint: "A lesson plan.",
    fields: { title: text("Lesson", 160, { required: true }), subject: choice("Subject", HUB_CHOICES.lessonSubject, "Other"), group: text("Group or class", 80), date: date("Date", { today: true }), objective: text("Objective", 1000, { long: true }), materials: text("Materials", 1000, { long: true }) },
  },
  schedules: {
    label: "Weekly schedules", tab: "schedules",
    hint: "A block in one student's weekly schedule that repeats every week (a class or a service on a weekday).",
    fields: { student: text("Student", 80, { required: true }), day: choice("Day", HUB_CHOICES.day), start: time("Starts"), end: time("Ends"), label: text("Class or service", 80) },
  },
  parentLogs: {
    label: "Parent contact log", tab: "parents",
    hint: "A record of a message, call or meeting with a parent or guardian.",
    fields: { student: student(), guardian: text("Parent or guardian", 80), status: choice("Status", HUB_CHOICES.parentStatus), date: date("Date", { today: true }), message: text("What was said", 3000, { required: true, long: true }) },
  },
  attendance: {
    label: "Attendance", tab: "attendance",
    hint: "One student's attendance on one day.",
    fields: { student: text("Student", 80, { required: true }), date: date("Date", { today: true }), className: text("Class or block", 60), status: choice("Status", HUB_CHOICES.attendance) },
  },
  behavior: {
    label: "Behavior points", tab: "behavior",
    hint: "Behavior points given to or taken from a student. Positive or negative whole numbers.",
    fields: { student: text("Student", 80, { required: true }), points: { kind: "number", label: "Points", min: -100, max: 100, fallback: 1 }, reason: text("Reason", 200), date: date("Date", { today: true }) },
  },
  grades: {
    label: "Gradebook", tab: "gradebook",
    hint: "One student's score on one assignment, for example a cell of a gradebook. points is what the assignment is out of.",
    fields: {
      assignment: text("Assignment", 120, { required: true }), student: text("Student", 80, { required: true }),
      score: { kind: "number", label: "Score", min: 0, max: 100000, fallback: null }, points: { kind: "number", label: "Out of", min: 0, max: 100000, fallback: 10 },
      category: choice("Category", HUB_CHOICES.category), date: date("Date", { today: true }), missing: { kind: "flag", label: "Missing" }, excused: { kind: "flag", label: "Excused" },
    },
  },
  ariseRecords: {
    label: "A.R.I.S.E. reading records", tab: "arise",
    hint: "A book or text a student read, with a quiz score or points if given.",
    fields: { student: text("Student", 80, { required: true }), book: text("Book", 160, { required: true }), score: text("Score", 20), points: text("Points", 20), date: date("Date", { today: true }) },
  },
  emails: {
    label: "Email organizer", tab: "email",
    hint: "An email the teacher pasted or photographed. Put what the teacher must do in action, and write a short, polite reply in draft.",
    fields: { from: text("From", 120), subject: text("Subject", 200), date: date("Date", { today: true }), body: text("Email", 6000, { long: true }), action: text("What I need to do", 600, { long: true }), draft: text("Reply draft", 3000, { long: true }) },
  },
} as const satisfies Record<string, ListSpec>;

export type HubImportKind = keyof typeof HUB_IMPORT;
export const HUB_IMPORT_KINDS = Object.keys(HUB_IMPORT) as HubImportKind[];
export type HubImportItem = Record<string, string | number | boolean | null>;
export type HubImportItems = Record<HubImportKind, HubImportItem[]>;

export const HUB_IMPORT_LIMITS = {
  /** Suggested items in one go. */
  items: 300,
  /** Characters of typed or pasted text, or of text read out of a file. */
  textChars: 40_000,
  /** Photos or screenshots in one go. */
  images: 4,
  /** One photo, after the page shrinks it (characters of its data URL). */
  imageChars: 2_800_000,
  /** One uploaded file, in bytes. */
  fileBytes: 8_000_000,
  /** Times a teacher can ask the AI in a day. */
  perDay: 60,
  /** Events kept from one connected calendar (the soonest ones), so the saved workspace stays small. */
  calendarEvents: 250,
  /** Connected calendars. */
  calendars: 4,
  /** A connected calendar is read again when the Hub opens, if it was last read longer ago than this. */
  calendarStaleMs: 3 * 60 * 60_000,
} as const;

export function emptyHubImport(): HubImportItems {
  return Object.fromEntries(HUB_IMPORT_KINDS.map((kind) => [kind, []])) as unknown as HubImportItems;
}

export function hubImportCount(items: HubImportItems): number {
  return HUB_IMPORT_KINDS.reduce((n, kind) => n + (items[kind]?.length || 0), 0);
}

/** "2026-10-06" for a real day written as YYYY-MM-DD (a time after it is ignored); "" for anything else. */
export function cleanDate(value: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(String(value ?? "").trim());
  if (!m) return "";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const made = new Date(Date.UTC(y, mo - 1, d));
  const real = y >= 1990 && y <= 2100 && made.getUTCFullYear() === y && made.getUTCMonth() === mo - 1 && made.getUTCDate() === d;
  return real ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

/** "14:05" from "14:05", "2:05 PM" or "2pm"; "" for anything else. */
export function cleanTime(value: unknown): string {
  const m = /^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([ap])?\.?m?\.?$/i.exec(String(value ?? "").trim());
  if (!m || (m[2] === undefined && !m[3])) return "";
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? 0);
  if (m[3]) {
    if (hour < 1 || hour > 12) return "";
    hour = (hour % 12) + (m[3].toLowerCase() === "p" ? 12 : 0);
  }
  if (hour > 23 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function cleanField(field: HubField, value: unknown, today: string): string | number | boolean | null {
  switch (field.kind) {
    case "text": {
      const raw = value === null || value === undefined || typeof value === "object" ? "" : String(value);
      const tidy = field.long ? raw.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() : raw.replace(/\s+/g, " ").trim();
      return tidy.slice(0, field.max);
    }
    case "date":
      return cleanDate(value) || (field.today ? today : "");
    case "time":
      return cleanTime(value);
    case "choice": {
      const wanted = String(value ?? "").trim().toLowerCase();
      return field.options.find((option) => option.toLowerCase() === wanted) ?? field.fallback;
    }
    case "number": {
      const n = typeof value === "number" ? value : value === null || value === undefined || String(value).trim() === "" ? NaN : Number(String(value).replace(/[, ]/g, ""));
      return Number.isFinite(n) ? Math.max(field.min, Math.min(field.max, Math.round(n * 100) / 100)) : field.fallback;
    }
    case "flag":
      return value === true || /^(true|yes|y|1|x)$/i.test(String(value ?? "").trim());
  }
}

/**
 * Makes suggested items safe to show and save, whatever produced them: only known
 * lists and fields, real dates and times, sensible lengths, nothing without its
 * main field, and no more than the limit.
 */
export function cleanHubImport(raw: unknown, today: string): HubImportItems {
  const out = emptyHubImport();
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  let room = HUB_IMPORT_LIMITS.items;
  for (const kind of HUB_IMPORT_KINDS) {
    const list = Array.isArray(source[kind]) ? (source[kind] as unknown[]) : [];
    const fields = HUB_IMPORT[kind].fields as Record<string, HubField>;
    for (const entry of list) {
      if (room <= 0) break;
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const item: HubImportItem = {};
      let complete = true;
      for (const [name, field] of Object.entries(fields)) {
        item[name] = cleanField(field, (entry as Record<string, unknown>)[name], today);
        if ((field.kind === "text" || field.kind === "date") && field.required && !item[name]) complete = false;
      }
      if (!complete) continue;
      out[kind].push(item);
      room--;
    }
  }
  return out;
}

/** "3:30 PM" from "15:30". */
export function clock12(time: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return time;
  const hour = Number(m[1]);
  return `${hour % 12 || 12}:${m[2]} ${hour < 12 ? "AM" : "PM"}`;
}

const joined = (...parts: unknown[]) => parts.map((p) => (p === null || p === undefined || p === "" ? "" : String(p))).filter(Boolean).join(" · ");

/** Two short lines that say what a suggested item is, for the review screen. */
export function describeHubItem(kind: HubImportKind, item: HubImportItem): { title: string; detail: string } {
  const s = (name: string) => String(item[name] ?? "");
  const clock = s("start") ? (s("end") ? `${clock12(s("start"))} – ${clock12(s("end"))}` : clock12(s("start"))) : "";
  switch (kind) {
    case "tasks": return { title: s("title"), detail: joined(s("dueDate") ? `Due ${s("dueDate")}` : "No due date", s("recurring")) };
    case "events": return { title: s("title"), detail: joined(s("date"), clock || "All day", s("location")) };
    case "meetings": return { title: joined(s("student") || "No student yet", s("type")), detail: joined(s("date") || "No date", s("notes")) };
    case "notes": return { title: s("body"), detail: joined(s("student") || "General", s("type"), s("date")) };
    case "students": return { title: s("name"), detail: joined(s("grade") && `Grade ${s("grade")}`, s("iepDate") && `IEP ${s("iepDate")}`, s("reevalDate") && `Reevaluation ${s("reevalDate")}`, s("accommodations")) };
    case "lessons": return { title: s("title"), detail: joined(s("subject"), s("group"), s("date"), s("objective")) };
    case "schedules": return { title: joined(s("student"), s("label") || "Schedule block"), detail: joined(s("day"), clock) };
    case "parentLogs": return { title: s("message"), detail: joined(s("student") || "General", s("guardian"), s("status"), s("date")) };
    case "attendance": return { title: joined(s("student"), s("status")), detail: joined(s("date"), s("className")) };
    case "behavior": return { title: joined(s("student"), `${Number(item.points) > 0 ? "+" : ""}${item.points} points`), detail: joined(s("reason"), s("date")) };
    case "grades": return { title: joined(s("student"), s("assignment")), detail: joined(item.missing ? "Missing" : item.excused ? "Excused" : item.score === null ? "No score" : `${item.score} of ${item.points}`, s("category"), s("date")) };
    case "ariseRecords": return { title: joined(s("student"), s("book")), detail: joined(s("score") && `Score ${s("score")}`, s("points") && `${s("points")} points`, s("date")) };
    case "emails": return { title: s("subject") || "Email", detail: joined(s("from"), s("action") && `To do: ${s("action")}`) };
  }
}

/** When there is no AI to ask: every line of pasted text becomes a to-do. */
export function linesToTasks(textValue: string, today: string): HubImportItems {
  const tasks = textValue.split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•▪◦·]|\[[ xX]?\]|\(?\d{1,3}[.)])\s*/, "").trim())
    .filter((line) => line.length > 1)
    .map((title) => ({ title, dueDate: "", recurring: "" }));
  return cleanHubImport({ tasks }, today);
}

const fold = (...parts: unknown[]) => parts.map((p) => String(p ?? "").trim().toLowerCase().replace(/\s+/g, " ")).join("|");

/** New rows go on top in these lists, the way the Hub's own forms add them. */
const NEWEST_FIRST = new Set<keyof Workspace>(["lessons", "notes", "ariseRecords", "behavior", "attendance", "parentLogs", "emails"]);

export type HubMergeResult = {
  workspace: Workspace;
  /** Rows added to each list. */
  added: Partial<Record<HubImportKind, number>>;
  /** Suggested items left out because the same thing is already in the Hub. */
  already: number;
  /** Students left out because the plan's caseload is full. */
  overPlan: number;
};

/**
 * Adds checked items to a workspace. Anything already there is not added twice,
 * and the caseload never grows past the plan (`seats`; null means no limit).
 */
export function mergeHubImport(workspace: Workspace, items: HubImportItems, makeId: () => string, seats: number | null): HubMergeResult {
  const next: Workspace = { ...workspace };
  const added: HubMergeResult["added"] = {};
  let already = 0, overPlan = 0;

  const add = <K extends keyof Workspace>(kind: HubImportKind, list: K, rows: any[], keyOf: (row: any) => string, build: (item: any) => any) => {
    const seen = new Set((workspace[list] as any[]).map(keyOf));
    const fresh: any[] = [];
    for (const item of rows) {
      const row = build(item);
      const key = keyOf(row);
      if (seen.has(key)) { already++; continue; }
      if (list === "students" && seats !== null && workspace.students.length + fresh.length >= seats) { overPlan++; continue; }
      seen.add(key);
      fresh.push({ id: makeId(), ...row });
    }
    if (!fresh.length) return;
    (next as any)[list] = NEWEST_FIRST.has(list) ? [...fresh, ...(next[list] as any[])] : [...(next[list] as any[]), ...fresh];
    added[kind] = (added[kind] || 0) + fresh.length;
  };

  add("students", "students", items.students, (r) => fold(r.name), (i) => i);
  add("tasks", "tasks", items.tasks, (r) => fold(r.title, r.dueDate), (i) => ({ ...i, done: false }));
  add("events", "events", items.events, (r) => fold(r.title, r.date, r.start), (i) => i);
  add("meetings", "meetings", items.meetings, (r) => fold(r.student, r.type, r.date), (i) => ({ ...i, done: false }));
  add("notes", "notes", items.notes, (r) => fold(r.student, r.date, r.body), (i) => i);
  add("lessons", "lessons", items.lessons, (r) => fold(r.title, r.date), (i) => i);
  add("schedules", "schedules", items.schedules, (r) => fold(r.student, r.day, r.start, r.label), (i) => i);
  add("parentLogs", "parentLogs", items.parentLogs, (r) => fold(r.student, r.date, r.message), (i) => i);
  add("attendance", "attendance", items.attendance, (r) => fold(r.student, r.date, r.className), (i) => i);
  add("behavior", "behavior", items.behavior, (r) => fold(r.student, r.date, r.reason, r.points), (i) => ({ ...i, points: Number(i.points) || 0 }));
  add("ariseRecords", "ariseRecords", items.ariseRecords, (r) => fold(r.student, r.book, r.date), (i) => i);
  add("emails", "emails", items.emails, (r) => fold(r.subject, r.from, r.date, String(r.body ?? "").slice(0, 80)), (i) => i);

  // A grade names its assignment; the assignment is made the first time it is seen.
  if (items.grades.length) {
    const assignments = [...next.assignments];
    const byTitle = new Map(assignments.map((a) => [fold(a.title), a]));
    const scored = new Set(next.gradeScores.map((g) => fold(g.assignmentId, g.student)));
    const fresh: GradeScore[] = [];
    for (const g of items.grades) {
      let assignment = byTitle.get(fold(g.assignment));
      if (!assignment) {
        assignment = { id: makeId(), title: String(g.assignment), category: String(g.category), points: Number(g.points) || 0, date: String(g.date) };
        assignments.push(assignment);
        byTitle.set(fold(assignment.title), assignment);
      }
      const key = fold(assignment.id, g.student);
      if (scored.has(key)) { already++; continue; }
      scored.add(key);
      fresh.push({ id: makeId(), assignmentId: assignment.id, student: String(g.student), score: g.score === null ? null : Number(g.score), missing: g.missing === true, excused: g.excused === true });
    }
    if (assignments.length !== next.assignments.length) next.assignments = assignments;
    if (fresh.length) { next.gradeScores = [...next.gradeScores, ...fresh]; added.grades = fresh.length; }
  }

  return { workspace: next, added, already, overPlan };
}

/** "9 to-dos and reminders, 3 calendar" style summary of what was added. */
export function describeHubAdded(result: Pick<HubMergeResult, "added" | "already" | "overPlan">): string {
  const parts = HUB_IMPORT_KINDS.filter((kind) => result.added[kind]).map((kind) => `${result.added[kind]} in ${HUB_IMPORT[kind].label}`);
  const lines = [parts.length ? `Added ${parts.join(", ")}.` : "Nothing new was added."];
  if (result.already) lines.push(`${result.already} ${result.already === 1 ? "was" : "were"} already in your Hub.`);
  if (result.overPlan) lines.push(`${result.overPlan} ${result.overPlan === 1 ? "student was" : "students were"} left out because your caseload is full.`);
  return lines.join(" ");
}

// ─── Changing a student ─────────────────────────────────────────────────────
//
// Every other tab files its rows under a student's name, so when a name is
// corrected on the caseload those rows have to follow it.

/** The lists whose rows name a student. */
export const STUDENT_LISTS = ["meetings", "notes", "ariseRecords", "behavior", "attendance", "gradeScores", "parentLogs", "schedules", "guides", "goals", "services", "serviceLogs"] as const;

export type StudentChange =
  /** `moved` is how many rows in the other tabs now carry the new name. */
  | { ok: true; workspace: Workspace; moved: number }
  | { ok: false; message: string };

/**
 * Saves changes to a student who is already on the caseload. When the name
 * changes, the meetings, notes, grades and other rows filed under the old name
 * are filed under the new one, so nothing is left behind. Two students can't
 * end up with the same name, because their rows could not be told apart.
 */
export function updateStudent(workspace: Workspace, studentId: string, changes: Omit<Student, "id">): StudentChange {
  const current = workspace.students.find((s) => s.id === studentId);
  if (!current) return { ok: false, message: "That student is no longer on your caseload." };
  const name = String(changes.name ?? "").replace(/\s+/g, " ").trim();
  if (!name) return { ok: false, message: "A student needs a name." };
  const was = fold(current.name);
  const others = workspace.students.filter((s) => s.id !== studentId);
  const taken = fold(name) !== was ? others.find((s) => fold(s.name) === fold(name)) : undefined;
  if (taken) return { ok: false, message: `${taken.name} is already on your caseload.` };
  const next: Workspace = { ...workspace, students: workspace.students.map((s) => (s.id === studentId ? { ...s, ...changes, id: s.id, name } : s)) };
  let moved = 0;
  // If another student already shares the old name, there is no telling whose rows are whose, so they stay put.
  if (name !== current.name && was && !others.some((s) => fold(s.name) === was)) {
    for (const list of STUDENT_LISTS) {
      const rows = workspace[list] as Array<{ student: string }>;
      if (!rows.some((row) => fold(row.student) === was && row.student !== name)) continue;
      (next as any)[list] = rows.map((row) => {
        if (fold(row.student) !== was || row.student === name) return row;
        moved++;
        return { ...row, student: name };
      });
    }
  }
  return { ok: true, workspace: next, moved };
}

export type StudentAdd =
  | { ok: true; workspace: Workspace }
  | { ok: false; message: string };

/**
 * Adds a student to the caseload. The name has to be new, because the other tabs file their rows
 * under it, and the caseload never grows past the plan (`seats`; null means no limit).
 */
export function addStudent(workspace: Workspace, input: Omit<Student, "id">, makeId: () => string, seats: number | null): StudentAdd {
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim();
  if (!name) return { ok: false, message: "A student needs a name." };
  const taken = workspace.students.find((s) => fold(s.name) === fold(name));
  if (taken) return { ok: false, message: `${taken.name} is already on your caseload.` };
  if (seats !== null && workspace.students.length >= seats) return { ok: false, message: `Your plan covers ${seats.toLocaleString("en-US")} students, and your caseload is full.` };
  return { ok: true, workspace: { ...workspace, students: [...workspace.students, { ...input, id: makeId(), name }] } };
}

/** Puts a calendar's fresh events in place of its old ones. Events the teacher typed in are untouched. */
export function replaceCalendarEvents(workspace: Workspace, calendar: HubCalendar, events: Omit<HubEvent, "id" | "calendarId">[], makeId: () => string): Workspace {
  const kept = workspace.events.filter((event) => event.calendarId !== calendar.id);
  // A fresh read hands every event a new id, so a check mark is carried over by what the event is.
  const key = (e: Pick<HubEvent, "title" | "date" | "start">) => `${e.title}\n${e.date}\n${e.start}`;
  const checked = new Set(workspace.events.filter((e) => e.calendarId === calendar.id && e.done).map(key));
  const fresh = events.slice(0, HUB_IMPORT_LIMITS.calendarEvents).map((event): HubEvent => ({ id: makeId(), ...event, calendarId: calendar.id, ...(checked.has(key(event)) ? { done: true } : {}) }));
  const calendars = workspace.calendars.some((c) => c.id === calendar.id)
    ? workspace.calendars.map((c) => (c.id === calendar.id ? calendar : c))
    : [...workspace.calendars, calendar];
  return { ...workspace, events: [...kept, ...fresh], calendars };
}

/** Takes a connected calendar, and every event that came from it, out of the workspace. */
export function removeCalendar(workspace: Workspace, calendarId: string): Workspace {
  return { ...workspace, calendars: workspace.calendars.filter((c) => c.id !== calendarId), events: workspace.events.filter((e) => e.calendarId !== calendarId) };
}
