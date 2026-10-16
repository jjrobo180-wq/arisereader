// Parent letters: which students a print covers, how the batch is ordered, and the letter itself.
// The server (POST /api/parent-invites/print) and the page that prints (client/src/lib/parentInvites.ts)
// both use these, so they can be tested without a browser or a database.

export type LetterStudent = { id: number; role?: string; teacherId?: number | null; directoryTeacherName?: string | null; displayName?: string };
/**
 * A teacher's id; "directory:mskenn" for a teacher a school lists who has no account yet (students pick them
 * from the school's list); or "none" for students with no teacher at all.
 */
export type TeacherChoice = number | "none" | `directory:${string}`;

/** The same teacher however the name was typed: "Ms. Kast" and "Ms.Kast" are one. */
export const directoryKey = (name?: string | null): string | null => {
  const key = String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 80);
  return key ? `directory:${key}` : null;
};
/** The group a student's letter belongs to. */
export const teacherGroup = (u: { teacherId?: number | null; directoryTeacherName?: string | null }): TeacherChoice =>
  u.teacherId ? u.teacherId : directoryKey(u.directoryTeacherName) || "none";
const DIRECTORY_CHOICE = /^directory:[a-z0-9]{1,80}$/;
export type Invite = { studentId?: number; studentName: string; teacherName?: string; code: string };

export const MAX_TEACHERS_PER_PRINT = 200;

/** `teacherIds` from a request body: whole numbers and "none", each once; null if it isn't a usable list. */
export function cleanTeacherChoices(input: unknown): TeacherChoice[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_TEACHERS_PER_PRINT) return null;
  const out = new Set<TeacherChoice>();
  for (const value of input) {
    if (value === "none") out.add("none");
    else if (typeof value === "string" && DIRECTORY_CHOICE.test(value)) out.add(value as TeacherChoice);
    else if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) out.add(value);
    else return null;
  }
  return Array.from(out);
}

/**
 * The students a print covers. A teacher gets their own roster. The administrator gets everyone, or just the
 * classes of the teachers picked (`choices`), or one student.
 */
export function studentsToPrint<T extends LetterStudent>(
  users: T[], who: { id: number; isAdmin: boolean }, opts: { studentId?: number; choices?: TeacherChoice[] | null } = {},
): T[] {
  const roster = users.filter((u) => u.role === "student" && (who.isAdmin || u.teacherId === who.id));
  if (opts.studentId !== undefined) return roster.filter((u) => u.id === opts.studentId);
  if (who.isAdmin && opts.choices?.length) {
    const wanted = new Set<TeacherChoice>(opts.choices);
    return roster.filter((u) => wanted.has(teacherGroup(u)));
  }
  return roster;
}

/** "Ms. Adams" sorts under A, not under M. */
export const nameForSorting = (name?: string): string => (name || "").trim().replace(/^(mr|mrs|ms|miss|mx|dr|prof)\.?\s+/i, "");

/** Classes together, in teacher order (titles ignored), each class in name order; students with no teacher last. */
export function sortInvites<T extends { studentName: string; teacherName?: string }>(invites: T[]): T[] {
  const by = (a?: string, b?: string) => (a || "").localeCompare(b || "", undefined, { sensitivity: "base" });
  return [...invites].sort((a, b) => {
    if (!!a.teacherName !== !!b.teacherName) return a.teacherName ? -1 : 1;
    return by(nameForSorting(a.teacherName), nameForSorting(b.teacherName)) || by(a.teacherName, b.teacherName) || by(a.studentName, b.studentName);
  });
}

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** One letter, ready to print. The class line is only there when the teacher is known. */
export function letterHtml(invite: Invite): string {
  return `<section class="letter">
      <div class="brand">A.R.I.S.E. READER</div>
      <h1>Your family is invited to read with us!</h1>
      <p>Dear parent or caregiver of <strong>${escapeHtml(invite.studentName)}</strong>,</p>${invite.teacherName ? `\n      <p class="class-line">Teacher: <strong>${escapeHtml(invite.teacherName)}</strong></p>` : ""}
      <p>Create a free parent account to follow your child's reading progress, see certificates, and connect with their teacher.</p>
      <div class="code-label">Your child's private parent code</div>
      <div class="code">${escapeHtml(invite.code)}</div>
      <ol><li>Go to <strong>www.arisereader.com/parent-signup</strong>.</li><li>Enter your parent code and create your account.</li><li>Log in to see your child's reading dashboard.</li></ol>
      <p>Already have a parent account without a linked student? Log in and enter this code on your dashboard.</p>
      <p class="note">Keep this code with your family. Contact your child's teacher if the code does not work.</p>
    </section>`;
}

/** "12 letters for 3 teachers" for the bar above a batch. */
export function batchSummary(invites: Array<{ teacherName?: string }>): string {
  const teachers = new Set(invites.map((i) => i.teacherName || "").filter(Boolean)).size;
  const letters = `${invites.length} letter${invites.length === 1 ? "" : "s"}`;
  return teachers > 1 ? `${letters} for ${teachers} teachers, sorted by teacher` : letters;
}
