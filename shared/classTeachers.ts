// Students' Advisory and Literature teachers: the rules both the sign-in pop-up
// (client/src/components/ClassTeachersPopup.tsx) and the server (server/classTeachers.ts) follow,
// and the list every teacher at the school sees on the Reader page's "Advisory & Lit" tab.

export type ClassSubject = "advisory" | "lit";
export const CLASS_SUBJECTS: readonly ClassSubject[] = ["advisory", "lit"];
export const SUBJECT_LABEL: Record<ClassSubject, string> = { advisory: "Advisory", lit: "Literature" };

/** A teacher at the student's school, as the pop-up and the list show them. */
export type SchoolTeacher = { id: number; displayName: string };

/** What a student saved: a teacher at their school (id set), or a typed name (id null). */
export type TeacherChoice = { teacherId: number | null; name: string };
export type ClassTeachers = { advisory: TeacherChoice; lit: TeacherChoice };

export const NAME_MIN = 2;
export const NAME_MAX = 60;

export class ClassTeachersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClassTeachersError";
  }
}

/**
 * The school year a moment falls in, as "2026-27". A new year starts on July 1 in Mountain Time
 * (where the school is), so the pop-up asks again before the first day of school.
 */
export function schoolYearOf(at: Date = new Date(), timeZone = "America/Denver"): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric" }).formatToParts(at);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const start = month >= 7 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** A typed teacher name tidied up: spaces collapsed, curly quotes made plain. Empty when nothing usable. */
export function tidyName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.normalize("NFC").replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
}

/** Checks a typed teacher name; returns it tidied, or throws a message a student can act on. */
export function checkTypedName(raw: unknown, subject: ClassSubject): string {
  const name = tidyName(raw);
  const label = SUBJECT_LABEL[subject];
  if (!name) throw new ClassTeachersError(`Type your ${label} teacher's name.`);
  if (name.length > NAME_MAX) throw new ClassTeachersError(`That ${label} teacher's name is too long.`);
  if ((name.match(/\p{L}/gu) || []).length < NAME_MIN) throw new ClassTeachersError(`Type your ${label} teacher's name.`);
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u.test(name)) throw new ClassTeachersError(`Use just letters for your ${label} teacher's name, like "Ms. Garcia".`);
  return name;
}

const TITLES = new Set(["mr", "mrs", "ms", "miss", "mx", "dr", "coach", "professor", "prof", "sr", "sra", "srta", "teacher"]);

/** The words of a name that matter for matching: lower case, accents and titles ("Ms.", "Mr") left out. */
export function nameWords(name: string): string[] {
  return tidyName(name)
    .normalize("NFD").replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9' -]/g, " ")
    .split(/[\s-]+/)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter((w) => w && !TITLES.has(w));
}

/**
 * Teachers at the school whose name fits what the student has typed so far, best first. Every word
 * typed has to start one of the teacher's name words, so "gar" finds "Ms. Garcia" and "maria g"
 * finds "Maria Garcia". Titles are ignored on both sides.
 */
export function suggestTeachers(typed: string, teachers: readonly SchoolTeacher[], limit = 6): SchoolTeacher[] {
  const want = nameWords(typed);
  if (!want.length) return [];
  const scored: Array<{ t: SchoolTeacher; score: number }> = [];
  for (const t of teachers) {
    const have = nameWords(t.displayName);
    if (!have.length) continue;
    if (!want.every((w) => have.some((h) => h.startsWith(w)))) continue;
    // Whole words beat parts of words; a match on the last name (usually how students know a teacher) beats the first.
    let score = 0;
    for (const w of want) {
      if (have.includes(w)) score += 3;
      if (have[have.length - 1].startsWith(w)) score += 2;
    }
    scored.push({ t, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.t.displayName.localeCompare(b.t.displayName))
    .slice(0, limit)
    .map((s) => s.t);
}

/** The one teacher at the school this typed name means exactly (titles and case aside), if there is exactly one. */
export function exactTeacher(typed: string, teachers: readonly SchoolTeacher[]): SchoolTeacher | null {
  const want = nameWords(typed).join(" ");
  if (!want) return null;
  const hits = teachers.filter((t) => nameWords(t.displayName).join(" ") === want);
  return hits.length === 1 ? hits[0] : null;
}

/**
 * What the server keeps for one subject. A picked teacher must be a teacher at the student's
 * school; a typed name is linked to a teacher when it names exactly one of them, and otherwise kept
 * as typed (their teacher may not be on A.R.I.S.E. yet).
 */
export function resolveChoice(raw: unknown, subject: ClassSubject, teachers: readonly SchoolTeacher[]): TeacherChoice {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const label = SUBJECT_LABEL[subject];
  if (r.teacherId !== undefined && r.teacherId !== null && r.teacherId !== "") {
    const id = Number(r.teacherId);
    const t = Number.isInteger(id) && id > 0 ? teachers.find((x) => x.id === id) : undefined;
    if (!t) throw new ClassTeachersError(`That ${label} teacher isn't at your school. Please choose again.`);
    return { teacherId: t.id, name: tidyName(t.displayName).slice(0, NAME_MAX) || "Teacher" };
  }
  const name = checkTypedName(r.name, subject);
  const linked = exactTeacher(name, teachers);
  return linked ? { teacherId: linked.id, name: tidyName(linked.displayName).slice(0, NAME_MAX) } : { teacherId: null, name };
}

/** Both subjects from a request body, checked. */
export function resolveClassTeachers(body: unknown, teachers: readonly SchoolTeacher[]): ClassTeachers {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  return { advisory: resolveChoice(b.advisory, "advisory", teachers), lit: resolveChoice(b.lit, "lit", teachers) };
}

/* ---------------------------------------------------------------- the teachers' list ---- */

export type PickRow = {
  student_id: number;
  school_year: string;
  school_id: number;
  advisory_teacher_id: number | null;
  advisory_teacher_name: string;
  lit_teacher_id: number | null;
  lit_teacher_name: string;
  updated_at: string;
};

export type RosterStudent = { id: number; displayName: string; username: string };

/** One student on the list: who they are and, once answered, both teachers. */
export type RosterEntry = {
  studentId: number;
  name: string;
  username: string;
  answered: boolean;
  advisory: { teacherId: number | null; name: string; onSite: boolean } | null;
  lit: { teacherId: number | null; name: string; onSite: boolean } | null;
  updatedAt: string | null;
};

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });

/**
 * The school's list for the year: every student at the school, with their answers when they have
 * given them. A teacher linked by id is shown under their current name, so a renamed teacher, or one
 * who has left the school, still reads correctly.
 */
export function buildRoster(students: readonly RosterStudent[], picks: readonly PickRow[], teachers: readonly SchoolTeacher[], schoolId: number, year: string): RosterEntry[] {
  const nameOfTeacher = new Map(teachers.map((t) => [t.id, tidyName(t.displayName)]));
  const pickOf = new Map<number, PickRow>();
  for (const p of picks) if (Number(p.school_id) === schoolId && p.school_year === year) pickOf.set(Number(p.student_id), p);
  const side = (id: number | null, typed: string) => {
    const tid = id != null && Number.isFinite(Number(id)) ? Number(id) : null;
    const current = tid != null ? nameOfTeacher.get(tid) : undefined;
    return { teacherId: current ? tid : null, name: current || tidyName(typed), onSite: !!current };
  };
  return students
    .map((s): RosterEntry => {
      const p = pickOf.get(Number(s.id));
      return {
        studentId: Number(s.id),
        name: tidyName(s.displayName) || s.username,
        username: s.username,
        answered: !!p,
        advisory: p ? side(p.advisory_teacher_id, p.advisory_teacher_name) : null,
        lit: p ? side(p.lit_teacher_id, p.lit_teacher_name) : null,
        updatedAt: p ? p.updated_at : null,
      };
    })
    .sort(byName);
}

/** A key that puts the same teacher in one group however each student wrote the name. */
export function teacherKey(side: { teacherId: number | null; name: string }): string {
  return side.teacherId != null ? `id:${side.teacherId}` : `name:${nameWords(side.name).join(" ")}`;
}

/** Students grouped under each teacher for one subject, teachers in name order; unanswered students left out. */
export function groupBy(entries: readonly RosterEntry[], subject: ClassSubject): Array<{ key: string; teacher: string; onSite: boolean; students: RosterEntry[] }> {
  type Building = { key: string; teacher: string; onSite: boolean; students: RosterEntry[]; spellings: Map<string, number> };
  const groups = new Map<string, Building>();
  for (const e of entries) {
    const side = e[subject];
    if (!side) continue;
    const key = teacherKey(side);
    const g: Building = groups.get(key) || { key, teacher: side.name, onSite: side.onSite, students: [], spellings: new Map<string, number>() };
    g.students.push(e);
    g.spellings.set(side.name, (g.spellings.get(side.name) || 0) + 1);
    groups.set(key, g);
  }
  // A typed name is shown the way most students wrote it; on a tie, the neater one ("Mr. Patel" over "mr patel").
  const neatness = (s: string) => (s.match(/\p{Lu}/gu) || []).length * 2 + (s.includes(".") ? 1 : 0);
  return [...groups.values()]
    .map(({ spellings, ...g }) => ({
      ...g,
      teacher: g.onSite ? g.teacher : [...spellings.entries()].sort((a, b) => b[1] - a[1] || neatness(b[0]) - neatness(a[0]) || a[0].localeCompare(b[0]))[0][0],
    }))
    .sort((a, b) => a.teacher.localeCompare(b.teacher, "en", { sensitivity: "base" }));
}

/** Does this student list the viewing teacher for Advisory or Literature? */
export const listsTeacher = (e: RosterEntry, teacherId: number) => e.advisory?.teacherId === teacherId || e.lit?.teacherId === teacherId;

/** The list as a CSV file a teacher can open in Excel or Google Sheets. */
export function rosterCsv(entries: readonly RosterEntry[]): string {
  const cell = (v: string) => {
    const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v; // never a formula in a spreadsheet
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [["Student", "Username", "Advisory teacher", "Literature teacher"].join(",")];
  for (const e of entries) lines.push([e.name, e.username, e.advisory?.name ?? "", e.lit?.name ?? ""].map(cell).join(","));
  return lines.join("\r\n") + "\r\n";
}
