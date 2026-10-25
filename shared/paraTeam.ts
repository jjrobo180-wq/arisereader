// Para Team: one shared space for a teacher (the lead) and the paras and 1:1s who work with them.
//
// The teacher makes a team and sends its invite link. Whoever opens it and signs in (a free
// Arise To Duo account is enough) joins as a para. Everything the team shares is an "item":
// a message, a calendar event, a to-do, a block of the daily schedule, a student card, a data
// entry, a lesson plan, a linked doc, an uploaded file or a team note. This file says what each
// kind holds and who may change it; the server (server/paraTeam.ts) uses it on every write and
// the screens (client/src/pages/ParaTeam.tsx) use it to show only the buttons that will work.

import { cleanFamily, type Family } from "./familyHub";
import { DEFAULT_PERMS, permForKind, type ParaPerms, type ParaSettings } from "./paraApps";

export const PARA_KINDS = ["message", "event", "task", "schedule", "student", "log", "lesson", "link", "file", "note", "bulletin", "hub"] as const;
export type ParaKind = (typeof PARA_KINDS)[number];
export type ParaRole = "lead" | "para";
export const isParaKind = (k: unknown): k is ParaKind => typeof k === "string" && (PARA_KINDS as readonly string[]).includes(k);

/** Only a lead (the teacher, or anyone they make a lead) adds or changes these: the students, the
 *  staff schedule and the team notes are the teacher's plan, which paras follow. */
export const LEAD_ONLY: readonly ParaKind[] = ["student", "schedule", "note"];
/** Made only by uploading (the server fills them in), never typed. */
export const UPLOAD_ONLY: readonly ParaKind[] = ["file"];
/** The team apps' shared data (shared/paraApps.ts): one per team, saved only through its own
 *  route (PATCH …/apps/data), never added, changed or deleted as an ordinary item. */
export const SYSTEM_KINDS: readonly ParaKind[] = ["hub"];

/** The most of each kind one team keeps. Plenty for a school year; stops a runaway script. */
export const KIND_LIMIT: Record<ParaKind, number> = {
  message: 20000, event: 3000, task: 3000, schedule: 400, student: 120, log: 50000, lesson: 3000, link: 1000, file: 2000, note: 300, bulletin: 3000, hub: 1,
};
/** How many of the newest of each kind the app loads at once (older messages and data stay saved). */
export const KIND_LOAD: Record<ParaKind, number> = {
  message: 400, event: 3000, task: 3000, schedule: 400, student: 120, log: 4000, lesson: 3000, link: 1000, file: 2000, note: 300, bulletin: 500, hub: 1,
};

export const DOC_FOLDERS = ["IEPs & plans", "Schedules", "Behavior", "Curriculum", "Forms", "Bulletin board", "Other"] as const;
export type DocFolder = (typeof DOC_FOLDERS)[number];
export const EVENT_TYPES = ["event", "meeting", "absence", "duty"] as const;
export const BULLETIN_COLORS = ["yellow", "blue", "green", "pink", "orange"] as const;
export const EVENT_LABEL: Record<(typeof EVENT_TYPES)[number], string> = { event: "Event", meeting: "Meeting", absence: "Out / absent", duty: "Duty" };
export const LOG_TYPES = ["note", "behavior", "goal", "tally"] as const;
export const LOG_LABEL: Record<(typeof LOG_TYPES)[number], string> = { note: "Daily note", behavior: "Behavior (ABC)", goal: "Goal trial", tally: "Tally" };
export const GOAL_RESULTS = ["correct", "prompted", "incorrect"] as const;
export const GOAL_RESULT_LABEL: Record<(typeof GOAL_RESULTS)[number], string> = { correct: "Independent", prompted: "With prompt", incorrect: "Not yet" };
export const LESSON_STATUS = ["draft", "ready", "done"] as const;
export const LESSON_STATUS_LABEL: Record<(typeof LESSON_STATUS)[number], string> = { draft: "Draft", ready: "Ready to teach", done: "Taught" };
/** Monday to Friday, as the schedule stores them (1 = Monday). */
export const WEEKDAYS = [1, 2, 3, 4, 5] as const;
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type MessageData = { text: string; pinned: boolean };
export type EventData = { title: string; date: string; end: string; start: string; finish: string; type: (typeof EVENT_TYPES)[number]; who: number; note: string };
export type TaskData = { title: string; note: string; due: string; assignee: number; done: boolean; doneBy: number; doneAt: string };
export type ScheduleData = { days: number[]; start: string; end: string; activity: string; place: string; staffId: number; students: string; notes: string };
export type StudentData = { name: string; grade: string; communication: string; strengths: string; accommodations: string; triggers: string; strategies: string; goals: string; medical: string; notes: string };
export type LogData = { studentId: string; date: string; time: string; type: (typeof LOG_TYPES)[number]; goal: string; result: "" | (typeof GOAL_RESULTS)[number]; count: number; antecedent: string; behavior: string; consequence: string; text: string };
export type LessonData = { title: string; date: string; subject: string; students: string; objective: string; materials: string; steps: string; accommodations: string; paraRole: string; notes: string; link: string; status: (typeof LESSON_STATUS)[number] };
export type LinkData = { title: string; url: string; folder: DocFolder; note: string };
export type FileData = { name: string; path: string; size: number; contentType: string; folder: DocFolder; note: string };
export type NoteData = { title: string; body: string; pinned: boolean };
/** A bulletin on the team's board: anyone posts one for a day, a week or any dates. It shows on the
 *  board and on everyone's Today page from `from` through `until` ("" = until it's taken down). */
export type BulletinData = { title: string; body: string; from: string; until: string; color: (typeof BULLETIN_COLORS)[number]; important: boolean; links?: BulletinLink[]; files?: BulletinFile[] };
/** A clickable link on a bulletin. */
export type BulletinLink = { title: string; url: string };
/** A photo or document on a bulletin: the team's uploaded file (a "file" item, kept in Documents ›
 *  Bulletin board), opened through the same short-lived signed link as any team file. */
export type BulletinFile = { id: string; name: string; contentType: string; size: number };
export const BULLETIN_MAX = { links: 10, files: 12 } as const;
export const isImageType = (contentType: string) => /^image\//i.test(contentType);

export type ParaData = {
  message: MessageData; event: EventData; task: TaskData; schedule: ScheduleData; student: StudentData;
  log: LogData; lesson: LessonData; link: LinkData; file: FileData; note: NoteData; bulletin: BulletinData; hub: Family;
};

export type ParaItem<K extends ParaKind = ParaKind> = { id: string; kind: K; data: ParaData[K]; createdBy: number | null; createdAt: string; updatedAt: string };
export type ParaMember = { userId: number; name: string; role: ParaRole; title: string; joinedAt: string; owner: boolean; /** Someone who made things here and has since left the team. */ left?: boolean };
export type ParaTeamSummary = { id: string; name: string; role: ParaRole; owner: boolean; members: number };
export type ParaTeamView = {
  id: string; name: string; role: ParaRole; owner: boolean; me: number;
  /** Only leads get the invite code back. */
  invite: { code: string; on: boolean } | null;
  members: ParaMember[];
  items: ParaItem[];
  /** What paras may change and which apps the team has (shared/paraApps.ts). Everyone gets these;
   *  only the owner changes the permissions. */
  settings: ParaSettings;
};

// ─── cleaning ─────────────────────────────────────────────────────────────────────────────────

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\r\n/g, "\n").slice(0, max).trim() : "");
const line = (v: unknown, max: number): string => str(v, max).replace(/\s+/g, " ");
const int = (v: unknown, min = 0, max = 2_147_483_647): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : min;
};
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback);

export function isDay(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
export const isTime = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const day = (v: unknown) => (isDay(v) ? v : "");
const time = (v: unknown) => (isTime(v) ? v : "");

/** A web address people can open: http(s) only, "docs.google.com/…" gets https:// added. */
export function cleanUrl(v: unknown): string {
  let u = line(v, 2000);
  if (!u) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") return "";
    return parsed.toString();
  } catch { return ""; }
}

export type CleanResult<K extends ParaKind> = { ok: true; data: ParaData[K] } | { ok: false; message: string };

/** The data for one item, cleaned: lengths capped, dates and times checked, choices limited. */
export function cleanItemData<K extends ParaKind>(kind: K, raw: unknown): CleanResult<K> {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const ok = (data: ParaData[ParaKind]) => ({ ok: true as const, data: data as ParaData[K] });
  const no = (message: string) => ({ ok: false as const, message });
  switch (kind) {
    case "message": {
      const text = str(r.text, 2000);
      return text ? ok({ text, pinned: r.pinned === true }) : no("Write a message first.");
    }
    case "event": {
      const title = line(r.title, 120), date = day(r.date);
      if (!date) return no("Pick a date.");
      const type = oneOf(r.type, EVENT_TYPES, "event");
      if (!title && type !== "absence") return no("Give the event a name.");
      let end = day(r.end);
      if (end && end <= date) end = "";
      const start = time(r.start);
      let finish = start ? time(r.finish) : "";
      if (finish && finish <= start) finish = "";
      return ok({ title, date, end, start, finish, type, who: int(r.who), note: str(r.note, 1500) });
    }
    case "task": {
      const title = line(r.title, 200);
      if (!title) return no("Say what needs doing.");
      const done = r.done === true;
      return ok({ title, note: str(r.note, 1500), due: day(r.due), assignee: int(r.assignee), done, doneBy: done ? int(r.doneBy) : 0, doneAt: done ? line(r.doneAt, 40) : "" });
    }
    case "schedule": {
      const activity = line(r.activity, 120), start = time(r.start);
      if (!activity) return no("Say what happens in this block.");
      if (!start) return no("Give the block a start time.");
      const days = Array.isArray(r.days) ? [...new Set(r.days.map((d) => int(d)).filter((d) => d >= 1 && d <= 5))].sort() : [];
      let end = time(r.end);
      if (end && end <= start) end = "";
      return ok({ days: days.length ? days : [...WEEKDAYS], start, end, activity, place: line(r.place, 80), staffId: int(r.staffId), students: line(r.students, 200), notes: str(r.notes, 1000) });
    }
    case "student": {
      const name = line(r.name, 60);
      if (!name) return no("Add the student's name (a first name or initials is fine).");
      const f = (k: string) => str(r[k], 2000);
      return ok({ name, grade: line(r.grade, 20), communication: f("communication"), strengths: f("strengths"), accommodations: f("accommodations"), triggers: f("triggers"), strategies: f("strategies"), goals: f("goals"), medical: f("medical"), notes: f("notes") });
    }
    case "log": {
      const date = day(r.date);
      if (!date) return no("Pick a date.");
      const type = oneOf(r.type, LOG_TYPES, "note");
      const data: LogData = {
        studentId: line(r.studentId, 60), date, time: time(r.time), type,
        goal: type === "goal" || type === "tally" ? line(r.goal, 200) : "",
        result: type === "goal" ? oneOf(r.result, GOAL_RESULTS, "correct") : "",
        count: type === "tally" ? Math.max(1, int(r.count, 0, 999)) : 0,
        antecedent: type === "behavior" ? str(r.antecedent, 1000) : "",
        behavior: type === "behavior" ? str(r.behavior, 1000) : "",
        consequence: type === "behavior" ? str(r.consequence, 1000) : "",
        text: str(r.text, 3000),
      };
      if (!data.studentId) return no("Pick the student.");
      if (type === "note" && !data.text) return no("Write the note first.");
      if (type === "behavior" && !data.behavior) return no("Describe the behavior.");
      if ((type === "goal" || type === "tally") && !data.goal) return no(type === "goal" ? "Say which goal or skill." : "Say what you counted.");
      return ok(data);
    }
    case "lesson": {
      const title = line(r.title, 160);
      if (!title) return no("Give the lesson a title.");
      const f = (k: string) => str(r[k], 4000);
      return ok({ title, date: day(r.date), subject: line(r.subject, 80), students: line(r.students, 200), objective: f("objective"), materials: f("materials"), steps: f("steps"), accommodations: f("accommodations"), paraRole: f("paraRole"), notes: f("notes"), link: cleanUrl(r.link), status: oneOf(r.status, LESSON_STATUS, "draft") });
    }
    case "link": {
      const url = cleanUrl(r.url);
      if (!url) return no("Paste a web address that starts with https://.");
      const title = line(r.title, 120) || new URL(url).hostname.replace(/^www\./, "");
      return ok({ title, url, folder: oneOf(r.folder, DOC_FOLDERS, "Other"), note: str(r.note, 600) });
    }
    case "file": {
      const path = line(r.path, 300), name = line(r.name, 160);
      if (!path || !name) return no("That file is missing.");
      return ok({ name, path, size: int(r.size), contentType: line(r.contentType, 100) || "application/octet-stream", folder: oneOf(r.folder, DOC_FOLDERS, "Other"), note: str(r.note, 600) });
    }
    case "note": {
      const title = line(r.title, 120);
      if (!title) return no("Give the note a title.");
      return ok({ title, body: str(r.body, 6000), pinned: r.pinned === true });
    }
    case "bulletin": {
      const title = line(r.title, 120), body = str(r.body, 1500);
      const links: BulletinLink[] = (Array.isArray(r.links) ? r.links : []).slice(0, BULLETIN_MAX.links).flatMap((l: any) => {
        const url = cleanUrl(l?.url);
        return url ? [{ url, title: line(l?.title, 120) || new URL(url).hostname.replace(/^www\./, "") }] : [];
      });
      const files: BulletinFile[] = (Array.isArray(r.files) ? r.files : []).slice(0, BULLETIN_MAX.files).flatMap((f: any) => {
        const id = line(f?.id, 60), name = line(f?.name, 160);
        return /^[0-9a-f-]{36}$/i.test(id) && name ? [{ id, name, contentType: line(f?.contentType, 100) || "application/octet-stream", size: int(f?.size) }] : [];
      });
      if (!title && !body && !links.length && !files.length) return no("Write the bulletin first.");
      const from = day(r.from);
      if (!from) return no("Pick the day it starts.");
      let until = day(r.until);
      if (until && until < from) return no("The last day can't be before the first day.");
      return ok({ title, body, from, until, color: oneOf(r.color, BULLETIN_COLORS, "yellow"), important: r.important === true, links, files });
    }
    case "hub":
      return ok(cleanFamily(r));
  }
  return no("That isn't something a Para Team keeps.");
}

// ─── who may do what ──────────────────────────────────────────────────────────────────────────

/** May this person add an item of this kind? Leads add anything; paras everything but the lead's plan. */
export const canAdd = (role: ParaRole, kind: ParaKind): boolean => !UPLOAD_ONLY.includes(kind) && !SYSTEM_KINDS.includes(kind) && (role === "lead" || !LEAD_ONLY.includes(kind));

/** May this person change or delete this item? Leads: anything. Paras: what they made themselves,
 *  and other people's too where the team's owner has switched that on in Team › Permissions
 *  (bulletins are on out of the box). Never the lead's plan, and never the apps' shared data,
 *  which has its own route. */
export const canEdit = (role: ParaRole, me: number, item: { kind: ParaKind; createdBy: number | null }, perms: ParaPerms = DEFAULT_PERMS): boolean =>
  !SYSTEM_KINDS.includes(item.kind) && (role === "lead" || (!LEAD_ONLY.includes(item.kind) && (item.createdBy === me || permForKind(perms, item.kind))));

/** A para may tick off a to-do that is theirs or everyone's, even one the teacher made. */
export const canCheckOff = (me: number, task: TaskData): boolean => task.assignee === 0 || task.assignee === me;

/** What a para who can't edit the item may still change on it: only whether a to-do is done. */
export function checkOff(task: TaskData, done: boolean, me: number, now: string): TaskData {
  return done ? { ...task, done: true, doneBy: me, doneAt: now } : { ...task, done: false, doneBy: 0, doneAt: "" };
}

/** Saving an item: pinned messages are the lead's (a para's "pin" is ignored), and an uploaded
 *  file's storage path can never be changed by an edit. */
export function finalData<K extends ParaKind>(kind: K, role: ParaRole, data: ParaData[K], before?: ParaData[K]): ParaData[K] {
  if (kind === "message" && role !== "lead") return { ...(data as MessageData), pinned: before ? (before as MessageData).pinned : false } as ParaData[K];
  if (kind === "file" && before) {
    const b = before as FileData;
    return { ...(data as FileData), path: b.path, size: b.size, contentType: b.contentType } as ParaData[K];
  }
  return data;
}

export const cleanTeamName = (v: unknown): string => line(v, 60);
export const cleanMemberTitle = (v: unknown): string => line(v, 60);

/** Invite codes: 12 letters and digits people can't mix up (no 0/O, 1/l/I). */
export const INVITE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const isInviteCode = (v: unknown): v is string => typeof v === "string" && new RegExp(`^[${INVITE_ALPHABET}]{12}$`).test(v);
export function makeInviteCode(random: (n: number) => Uint8Array): string {
  const bytes = random(12);
  return Array.from(bytes, (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join("");
}

// ─── helpers the screens share ────────────────────────────────────────────────────────────────

export const ofKind = <K extends ParaKind>(items: readonly ParaItem[], kind: K): ParaItem<K>[] => items.filter((i): i is ParaItem<K> => i.kind === kind);

/** "2026-10-20" for a Date, in the device's own time zone. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDaysKey(key: string, n: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** 0 = Sunday … 6 = Saturday, for a "YYYY-MM-DD". */
export const weekdayOf = (key: string): number => new Date(`${key}T12:00:00Z`).getUTCDay();

/** Is the event on this day (one day, or a run of days ending on `end`)? */
export const eventOn = (e: EventData, key: string): boolean => (e.end ? e.date <= key && key <= e.end : e.date === key);

/** The schedule blocks for a day, in time order: everyone's, or one person's (their own and the "everyone" blocks). */
export function scheduleOn(items: readonly ParaItem[], key: string, staffId?: number): ParaItem<"schedule">[] {
  const wd = weekdayOf(key);
  return ofKind(items, "schedule")
    .filter((i) => i.data.days.includes(wd) && (staffId === undefined || i.data.staffId === 0 || i.data.staffId === staffId))
    .sort((a, b) => a.data.start.localeCompare(b.data.start) || a.data.activity.localeCompare(b.data.activity));
}

/** Is the bulletin up on this day? */
export const bulletinUp = (b: BulletinData, key: string): boolean => b.from <= key && (!b.until || key <= b.until);

/** The bulletins up today: important first, then newest. */
export function bulletinsOn(items: readonly ParaItem[], key: string): ParaItem<"bulletin">[] {
  return ofKind(items, "bulletin").filter((i) => bulletinUp(i.data, key))
    .sort((a, b) => Number(b.data.important) - Number(a.data.important) || b.createdAt.localeCompare(a.createdAt));
}

/** The last school day of the week (Friday) for a day, for "this week" bulletins. */
export function weekEnd(key: string): string {
  const wd = weekdayOf(key);
  return addDaysKey(key, wd === 6 ? 6 : 5 - wd >= 0 ? 5 - wd : 0);
}

export function eventsOn(items: readonly ParaItem[], key: string): ParaItem<"event">[] {
  return ofKind(items, "event").filter((i) => eventOn(i.data, key)).sort((a, b) => (a.data.start || "00:00").localeCompare(b.data.start || "00:00"));
}

/** Open to-dos first (soonest due, then no date), then the finished ones, newest first. */
export function sortTasks(tasks: ParaItem<"task">[]): ParaItem<"task">[] {
  return [...tasks].sort((a, b) => {
    if (a.data.done !== b.data.done) return a.data.done ? 1 : -1;
    if (a.data.done) return (b.data.doneAt || "").localeCompare(a.data.doneAt || "");
    const ad = a.data.due || "9999-12-31", bd = b.data.due || "9999-12-31";
    return ad.localeCompare(bd) || a.createdAt.localeCompare(b.createdAt);
  });
}

/** "9:05 AM" for "09:05". */
export function clock(t: string): string {
  if (!isTime(t)) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Goal trials for one student and goal: how many, and the share done independently. */
export function goalSummary(logs: readonly ParaItem<"log">[], studentId: string, goal: string) {
  const trials = logs.filter((l) => l.data.type === "goal" && l.data.studentId === studentId && l.data.goal.toLowerCase() === goal.toLowerCase());
  const n = trials.length;
  const correct = trials.filter((l) => l.data.result === "correct").length;
  const prompted = trials.filter((l) => l.data.result === "prompted").length;
  return { trials: n, correct, prompted, percent: n ? Math.round((correct / n) * 100) : 0 };
}

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  // A cell starting with = + - @ would run as a formula in a spreadsheet: keep it as text.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The team's data entries as a spreadsheet file (CSV), newest first, with names instead of ids. */
export function logsCsv(logs: readonly ParaItem<"log">[], studentName: (id: string) => string, staffName: (id: number | null) => string): string {
  const head = ["Date", "Time", "Student", "Type", "Goal / what was counted", "Result", "Count", "Antecedent", "Behavior", "Consequence", "Notes", "Entered by"];
  const rows = [...logs].sort((a, b) => `${b.data.date} ${b.data.time}`.localeCompare(`${a.data.date} ${a.data.time}`)).map((l) => [
    l.data.date, clock(l.data.time), studentName(l.data.studentId), LOG_LABEL[l.data.type], l.data.goal,
    l.data.result ? GOAL_RESULT_LABEL[l.data.result] : "", l.data.count || "", l.data.antecedent, l.data.behavior, l.data.consequence, l.data.text, staffName(l.createdBy),
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}
