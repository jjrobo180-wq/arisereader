// What the admin, teacher and parent pages are divided into, and which part of
// a page each "waiting on you" item lives in. Kept apart from the pages so the
// lists can be checked by tests.

// ─── Admin ───────────────────────────────────────────────────────────────────

export type AdminSectionId = "home" | "students" | "teachers" | "parents" | "schools" | "books" | "programs" | "games" | "site" | "billing";

export type AdminSection = {
  id: AdminSectionId;
  label: string;
  /** Heading above this entry in the side list. */
  group?: string;
  /** One line under the section's name. */
  about: string;
  /** What is in the section, for the map on the Home section. */
  holds: string;
};

export const ADMIN_SECTIONS: AdminSection[] = [
  { id: "home", label: "Home", about: "", holds: "" },
  { id: "students", group: "People", label: "Students", about: "Every student account, and the students who are waiting on you.", holds: "Approvals, school not listed, grade changes, points, passwords and messages" },
  { id: "teachers", label: "Teachers", about: "Approve new teachers, add one yourself, and set each teacher's school and grades.", holds: "Approvals, adding a teacher, schools, grades and passwords" },
  { id: "parents", label: "Parents", about: "Approve parent accounts and see every parent on the site.", holds: "Approvals, passwords and archived accounts" },
  { id: "schools", label: "Schools", about: "The schools on A.R.I.S.E. and the classes inside each one.", holds: "Adding schools and classes, and matching a school to the US school list" },
  { id: "books", group: "Reading", label: "Books & quizzes", about: "Add quizzes, answer what students have asked for, and set how quizzes are made and proctored.", holds: "Adding a quiz, quiz requests and reviews, camera quizzes, book covers and the proctor password" },
  { id: "programs", label: "Leaderboard & programs", about: "The leaderboard, competition dates, Reading Club, Growth Check and Easter eggs.", holds: "Leaderboard, competition dates, Reading Club sign-ups, Growth Check and Easter eggs" },
  { id: "games", group: "Site", label: "Games & play time", about: "How long students can play, when the games close, and what is showing in the cinema.", holds: "Play time, game closing hours and the cinema" },
  { id: "site", label: "Banners & donations", about: "The messages shown across the site, and the donation goal.", holds: "Announcement, student, teacher and login banners, and the donation goal" },
  { id: "billing", label: "Plans & billing", about: "Free and Premium plans, schools that are always free, and online payment.", holds: "Plan rules, free schools, Premium by hand and Stripe" },
];

export const isAdminSection = (id: unknown): id is AdminSectionId => ADMIN_SECTIONS.some((s) => s.id === id);

/** How many of each kind of thing are waiting on the admin. */
export type AdminWaiting = {
  teachers: number;
  students: number;
  parents: number;
  unlisted: number;
  gradeChanges: number;
  eyeGazeChanges: number;
  aiQuizzes: number;
  quizReviews: number;
  quizRequests: number;
  clubSignups: number;
};

export type WaitingRow = {
  key: keyof AdminWaiting;
  count: number;
  /** A full sentence without the number: "teachers are waiting to be approved". */
  label: string;
  section: AdminSectionId;
  /** The part of that section to show, matching a data-section on the page. */
  part: string;
};

const WAITING: Array<{ key: keyof AdminWaiting; one: string; many: string; section: AdminSectionId; part: string }> = [
  { key: "teachers", one: "teacher is waiting to be approved", many: "teachers are waiting to be approved", section: "teachers", part: "teachers" },
  { key: "students", one: "student is waiting to be approved", many: "students are waiting to be approved", section: "students", part: "pending-student-approvals" },
  { key: "parents", one: "parent is waiting to be approved", many: "parents are waiting to be approved", section: "parents", part: "pending-parent-approvals" },
  { key: "unlisted", one: "student couldn't find their school or teacher", many: "students couldn't find their school or teacher", section: "students", part: "unlisted" },
  { key: "gradeChanges", one: "student asked to change grade", many: "students asked to change grade", section: "students", part: "grade-changes" },
  { key: "eyeGazeChanges", one: "student asked to change Eye Gazer access", many: "students asked to change Eye Gazer access", section: "students", part: "eye-gaze-requests" },
  { key: "aiQuizzes", one: "AI quiz is waiting for your review", many: "AI quizzes are waiting for your review", section: "books", part: "ai-quiz-review" },
  { key: "quizReviews", one: "student asked for a second look at a quiz", many: "students asked for a second look at a quiz", section: "books", part: "quiz-reviews" },
  { key: "quizRequests", one: "book needs a quiz", many: "books need a quiz", section: "books", part: "quiz-requests" },
  { key: "clubSignups", one: "Reading Club sign-up to confirm", many: "Reading Club sign-ups to confirm", section: "programs", part: "reading-club" },
];

const whole = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** The things waiting on the admin, most urgent first. Kinds with nothing waiting are left out. */
export function adminWaitingRows(counts: Partial<AdminWaiting>): WaitingRow[] {
  return WAITING
    .map((w) => ({ key: w.key, count: whole(counts[w.key]), label: whole(counts[w.key]) === 1 ? w.one : w.many, section: w.section, part: w.part }))
    .filter((row) => row.count > 0);
}

/** How many things are waiting in each section, for the numbers on the section list. */
export function waitingBySection(rows: WaitingRow[]): Partial<Record<AdminSectionId, number>> {
  const out: Partial<Record<AdminSectionId, number>> = {};
  for (const row of rows) out[row.section] = (out[row.section] || 0) + row.count;
  return out;
}

// ─── Teacher ─────────────────────────────────────────────────────────────────

export type TeacherSectionId = "students" | "requests" | "families" | "quizzes" | "games" | "prizes" | "all";

export const TEACHER_SECTIONS: Array<{ id: TeacherSectionId; label: string; about: string }> = [
  { id: "students", label: "My students", about: "" },
  { id: "requests", label: "Requests", about: "Students waiting to join your class, grade changes, and books students have asked for." },
  { id: "families", label: "Families", about: "Parent codes and letters, and which parents are connected to your students." },
  { id: "quizzes", label: "Quizzes", about: "The proctor password, quizzes taken on camera, and Growth Check results." },
  { id: "games", label: "Games", about: "How long your students can play, and when the games are open." },
  { id: "prizes", label: "Prizes", about: "Prizes you put up for your class or your school." },
  { id: "all", label: "All students", about: "Every student at your school, with their teacher." },
];

/**
 * Where a tab from the old teacher page lives now. Other pages still ask for
 * the old names ("club-controls"), so those keep working.
 */
const OLD_TEACHER_TABS: Record<string, { section: TeacherSectionId; part?: string }> = {
  "students": { section: "students" },
  "all-students": { section: "all" },
  "pending": { section: "requests", part: "pending-students" },
  "book-requests": { section: "requests", part: "book-requests" },
  "grade-changes": { section: "requests", part: "grade-changes" },
  "parents": { section: "families" },
  "proctor": { section: "quizzes", part: "proctor" },
  "camera-quizzes": { section: "quizzes", part: "camera-quizzes" },
  "growth-check": { section: "quizzes", part: "growth-check" },
  "club-controls": { section: "games", part: "club-controls" },
  "prizes": { section: "prizes" },
};

export function teacherSectionFor(name: string | null | undefined): { section: TeacherSectionId; part?: string } {
  if (!name) return { section: "students" };
  if (Object.prototype.hasOwnProperty.call(OLD_TEACHER_TABS, name)) return OLD_TEACHER_TABS[name];
  return TEACHER_SECTIONS.some((s) => s.id === name) ? { section: name as TeacherSectionId } : { section: "students" };
}

// ─── Parent ──────────────────────────────────────────────────────────────────

export type ParentSectionId = "overview" | "controls" | "prizes" | "progress";

export const PARENT_SECTIONS: Array<{ id: ParentSectionId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "controls", label: "Game time" },
  { id: "prizes", label: "Prizes" },
  { id: "progress", label: "Quizzes" },
];

export const isParentSection = (id: unknown): id is ParentSectionId => PARENT_SECTIONS.some((s) => s.id === id);
