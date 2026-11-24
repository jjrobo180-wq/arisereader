// A.R.I.S.E. class records: the WorkHub plugins teachers share with families and staff.
//   Behavior     points for chosen behaviors (server/classBehavior.ts keeps the points themselves)
//   Hall passes  who's out, where, and for how long (server/classBehavior.ts keeps the passes)
//   Attendance   present, tardy, absent or excused, day by day
//   Gradebook    weighted categories, assignments, scores, missing and excused work
//   Student wall posts, announcements and newsletters with photos, and messages with families
// Each teacher decides, plugin by plugin, what families see and what other staff at the school see
// (ShareSettings). Families see it on the parent page (pages/FamilyPortal.tsx), signed in or through a
// private link a teacher makes for one child. The rules here are pure, so they are tested on their own.

export const RECORD_PLUGINS = ["behavior", "passes", "attendance", "grades", "wall"] as const;
export type RecordPlugin = (typeof RECORD_PLUGINS)[number];
export const PLUGIN_NAMES: Record<RecordPlugin, string> = { behavior: "Behavior", passes: "Hall passes", attendance: "Attendance", grades: "Gradebook", wall: "Student wall" };

/** What a teacher shares, plugin by plugin. Families see nothing until the teacher turns a plugin on;
 *  other staff at the school see a plugin unless the teacher turns it off. Admins always see everything. */
export type ShareSettings = { parents: Record<RecordPlugin, boolean>; staff: Record<RecordPlugin, boolean> };
export const defaultShare = (): ShareSettings => ({
  parents: { behavior: false, passes: false, attendance: false, grades: false, wall: false },
  staff: { behavior: true, passes: true, attendance: true, grades: true, wall: true },
});
export function cleanShare(raw: any): ShareSettings {
  const d = defaultShare();
  const side = (r: any, def: Record<RecordPlugin, boolean>) => Object.fromEntries(RECORD_PLUGINS.map((p) => [p, typeof r?.[p] === "boolean" ? r[p] : def[p]])) as Record<RecordPlugin, boolean>;
  return { parents: side(raw?.parents, d.parents), staff: side(raw?.staff, d.staff) };
}

export const text = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
const oneLine = (v: unknown, max: number) => text(v, max).replace(/\s+/g, " ");
export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`));
/** A day (YYYY-MM-DD) in the school's time zone. */
export const dayIn = (ms: number, tz = "America/Denver") => new Date(ms).toLocaleDateString("en-CA", { timeZone: tz });
export function addDays(day: string, n: number): string { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

/* ------------------------------------------------------------------ attendance */

export const ATTENDANCE = ["present", "tardy", "absent", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE)[number];
export const ATTENDANCE_NAMES: Record<AttendanceStatus, string> = { present: "Present", tardy: "Tardy", absent: "Absent", excused: "Excused" };
export type AttendanceMark = { status: AttendanceStatus; note?: string; minutesLate?: number };
/** One month of one teacher's attendance: day → student id → mark. */
export type AttendanceMonth = Record<string, Record<string, AttendanceMark>>;

export function cleanMark(raw: any): AttendanceMark | null {
  if (!raw || !(ATTENDANCE as readonly string[]).includes(raw.status)) return null;
  const m: AttendanceMark = { status: raw.status };
  const note = oneLine(raw.note, 200); if (note) m.note = note;
  if (raw.status === "tardy") { const n = Math.round(Number(raw.minutesLate)); if (Number.isFinite(n) && n > 0) m.minutesLate = Math.min(n, 240); }
  return m;
}

/** Counts and the attendance rate (present + tardy over marked school days) for each student. */
export function attendanceSummary(months: AttendanceMonth[], studentIds: number[], from = "0000-00-00", to = "9999-12-31") {
  const out: Record<number, { present: number; tardy: number; absent: number; excused: number; days: number; rate: number | null; last: Array<{ day: string } & AttendanceMark> }> = {};
  for (const id of studentIds) out[id] = { present: 0, tardy: 0, absent: 0, excused: 0, days: 0, rate: null, last: [] };
  for (const month of months) for (const [day, marks] of Object.entries(month)) {
    if (day < from || day > to) continue;
    for (const [sid, m] of Object.entries(marks)) {
      const s = out[Number(sid)]; if (!s) continue;
      s[m.status] += 1; s.days += 1;
      if (m.status !== "present") s.last.push({ day, ...m });
    }
  }
  for (const s of Object.values(out)) {
    const counted = s.days - s.excused;
    s.rate = counted > 0 ? Math.round((1000 * (s.present + s.tardy)) / counted) / 10 : null;
    s.last.sort((a, b) => b.day.localeCompare(a.day)); s.last = s.last.slice(0, 30);
  }
  return out;
}

/* ------------------------------------------------------------------ gradebook */

export type GradeCategory = { id: string; name: string; weight: number };
export type Assignment = { id: string; title: string; categoryId: string; points: number; due: string; published: boolean; note?: string; createdAt: string };
export type Score = { score?: number | null; missing?: boolean; excused?: boolean; late?: boolean; comment?: string };
export type GradeScale = Array<{ letter: string; min: number }>;
export type Gradebook = { categories: GradeCategory[]; scale: GradeScale; assignments: Assignment[]; scores: Record<string, Record<string, Score>> };

export const DEFAULT_SCALE: GradeScale = [{ letter: "A", min: 90 }, { letter: "B", min: 80 }, { letter: "C", min: 70 }, { letter: "D", min: 60 }, { letter: "F", min: 0 }];
export const emptyGradebook = (): Gradebook => ({
  categories: [{ id: "classwork", name: "Classwork", weight: 40 }, { id: "homework", name: "Homework", weight: 20 }, { id: "tests", name: "Tests and quizzes", weight: 40 }],
  scale: DEFAULT_SCALE.map((s) => ({ ...s })), assignments: [], scores: {},
});
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";

export function cleanCategories(raw: any): GradeCategory[] {
  const seen = new Set<string>();
  const out = (Array.isArray(raw) ? raw : []).slice(0, 12).map((c: any) => {
    const name = oneLine(c?.name, 40); if (!name) return null;
    let id = oneLine(c?.id, 40) || slug(name); while (seen.has(id)) id += "-2"; seen.add(id);
    const w = Number(c?.weight); return { id, name, weight: Number.isFinite(w) ? Math.max(0, Math.min(100, Math.round(w))) : 0 };
  }).filter(Boolean) as GradeCategory[];
  return out.length ? out : emptyGradebook().categories;
}
export function cleanScale(raw: any): GradeScale {
  const rows = (Array.isArray(raw) ? raw : []).slice(0, 15).map((r: any) => ({ letter: oneLine(r?.letter, 3), min: Math.max(0, Math.min(100, Number(r?.min))) })).filter((r) => r.letter && Number.isFinite(r.min));
  if (!rows.length) return DEFAULT_SCALE.map((s) => ({ ...s }));
  rows.sort((a, b) => b.min - a.min);
  if (rows[rows.length - 1].min !== 0) rows[rows.length - 1] = { ...rows[rows.length - 1], min: 0 };
  return rows;
}
export function cleanAssignment(raw: any, categories: GradeCategory[], id: string, createdAt: string): Assignment | null {
  const title = oneLine(raw?.title, 120); if (!title) return null;
  const pts = Number(raw?.points);
  return {
    id, title, createdAt,
    categoryId: categories.some((c) => c.id === raw?.categoryId) ? raw.categoryId : categories[0].id,
    points: Number.isFinite(pts) && pts > 0 ? Math.min(Math.round(pts * 100) / 100, 10000) : 100,
    due: isDay(raw?.due) ? raw.due : "",
    published: raw?.published === undefined ? true : !!raw.published,
    ...(text(raw?.note, 500) ? { note: text(raw?.note, 500) } : {}),
  };
}
export function cleanScore(raw: any, maxPoints: number): Score | null {
  if (!raw || typeof raw !== "object") return null;
  const s: Score = {};
  if (raw.score !== undefined && raw.score !== null && raw.score !== "") { const n = Number(raw.score); if (Number.isFinite(n)) s.score = Math.max(0, Math.min(Math.round(n * 100) / 100, maxPoints * 2)); }
  if (raw.missing) s.missing = true;
  if (raw.excused) s.excused = true;
  if (raw.late) s.late = true;
  const c = text(raw.comment, 300); if (c) s.comment = c;
  if (s.excused) delete s.missing;
  if (s.score !== undefined && s.missing) delete s.missing; // a score turned in is no longer missing
  return Object.keys(s).length ? s : null;
}

export const letterFor = (pct: number | null, scale: GradeScale = DEFAULT_SCALE) => (pct == null ? "" : (scale.find((s) => pct >= s.min) ?? scale[scale.length - 1]).letter);

/** A student's grade: by category (earned over possible), then weighted by the categories that have work.
 *  Missing counts as 0; excused and ungraded work doesn't count. Unpublished work is left out when asked. */
export function studentGrade(book: Gradebook, studentId: number | string, opts: { publishedOnly?: boolean } = {}) {
  const sid = String(studentId);
  const byCat: Record<string, { earned: number; possible: number }> = {};
  const missing: Assignment[] = [];
  for (const a of book.assignments) {
    if (opts.publishedOnly && !a.published) continue;
    const s = book.scores[a.id]?.[sid];
    if (!s || s.excused) continue;
    if (s.missing) missing.push(a);
    const got = s.missing ? 0 : s.score;
    if (got === undefined || got === null) continue;
    const c = (byCat[a.categoryId] ??= { earned: 0, possible: 0 });
    c.earned += got; c.possible += a.points;
  }
  const cats = book.categories.map((c) => {
    const t = byCat[c.id];
    return { id: c.id, name: c.name, weight: c.weight, percent: t && t.possible > 0 ? Math.round((1000 * t.earned) / t.possible) / 10 : null };
  });
  const counted = cats.filter((c) => c.percent !== null && c.weight > 0);
  const totalWeight = counted.reduce((n, c) => n + c.weight, 0);
  let percent: number | null = null;
  if (totalWeight > 0) percent = Math.round((10 * counted.reduce((n, c) => n + c.percent! * c.weight, 0)) / totalWeight) / 10;
  else {
    // No weights set: plain points.
    const all = Object.values(byCat).reduce((n, c) => ({ earned: n.earned + c.earned, possible: n.possible + c.possible }), { earned: 0, possible: 0 });
    if (all.possible > 0) percent = Math.round((1000 * all.earned) / all.possible) / 10;
  }
  return { percent, letter: letterFor(percent, book.scale), categories: cats, missing: missing.sort((a, b) => (a.due || "9").localeCompare(b.due || "9")) };
}

/** The class average for one assignment (scored work only), for the teacher's columns. */
export function assignmentAverage(book: Gradebook, assignmentId: string): number | null {
  const a = book.assignments.find((x) => x.id === assignmentId); if (!a) return null;
  const got = Object.values(book.scores[assignmentId] ?? {}).filter((s) => !s.excused && (s.missing || typeof s.score === "number")).map((s) => (s.missing ? 0 : s.score!));
  return got.length ? Math.round((1000 * got.reduce((n, x) => n + x, 0)) / (got.length * a.points)) / 10 : null;
}

/* ------------------------------------------------------------------ student wall */

export const POST_KINDS = ["post", "announcement", "newsletter"] as const;
export type PostKind = (typeof POST_KINDS)[number];
export const POST_KIND_NAMES: Record<PostKind, string> = { post: "Post", announcement: "Announcement", newsletter: "Newsletter" };
/** Who a post is for: the teacher's whole class, or chosen students (one or a few). */
export type Audience = { kind: "class" } | { kind: "students"; ids: number[] };
export type WallPost = { id: string; teacherId: number; kind: PostKind; title: string; body: string; audience: Audience; photos: string[]; pinned: boolean; createdAt: string; editedAt?: string };

export function cleanAudience(raw: any, myStudents: number[]): Audience | null {
  if (raw?.kind === "class") return { kind: "class" };
  const ids = [...new Set((Array.isArray(raw?.ids) ? raw.ids : []).map(Number))].filter((n) => myStudents.includes(n as number)) as number[];
  return ids.length ? { kind: "students", ids } : null;
}
export const seesPost = (p: Pick<WallPost, "audience">, studentId: number) => p.audience.kind === "class" || p.audience.ids.includes(studentId);
export function audienceLabel(a: Audience, nameOf: (id: number) => string): string {
  if (a.kind === "class") return "Whole class";
  if (a.ids.length === 1) return nameOf(a.ids[0]);
  if (a.ids.length <= 3) return a.ids.map(nameOf).join(", ");
  return `${a.ids.length} students`;
}
/** Newest first, pinned on top. */
export const wallOrder = (posts: WallPost[]) => [...posts].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));

/* ------------------------------------------------------------------ messages */

export type Message = { id: string; from: "teacher" | "family"; authorId: number | null; authorName: string; body: string; at: string };
/** One thread per student and teacher: the family and the teacher talk about one child. `readBy` holds
 *  when each side last read it. */
export type Thread = { studentId: number; teacherId: number; messages: Message[]; teacherRead: string; familyRead: string };
export const unreadFor = (t: Thread, side: "teacher" | "family") => t.messages.filter((m) => m.from !== side && m.at > (side === "teacher" ? t.teacherRead : t.familyRead)).length;

/* ------------------------------------------------------------------ the private family link */

/** A link token: 32 random bytes as URL-safe text. Anyone with it sees what a signed-in parent sees. */
export const LINK_RE = /^[A-Za-z0-9_-]{40,64}$/;
