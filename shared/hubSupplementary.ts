// Arise WorkHub: supplementary students. They are students like any other (a profile, every student list, every
// school tab) with `supplementary: true`: not on the teacher's IEP caseload, so IEP-only lists leave them out.
// The kids in the teacher's classes who have no profile yet are found here, to add in one go.
import { cleanClasses, cleanLessons } from "./lessonPlanner";
import { cleanPushInNotes } from "./pushIn";
import { addStudent, type Student, type Workspace } from "./teacherHub";

const fold = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
export const isSupplementary = (s: Pick<Student, "supplementary"> | null | undefined) => !!s?.supplementary;
/** The students on the IEP caseload (supplementary ones left out). */
export const caseloadOnly = <T extends Pick<Student, "supplementary">>(students: T[]) => students.filter((s) => !s.supplementary);

/**
 * Names in the teacher's school tabs with no student profile: push-in class notes, lesson classes and marks,
 * schedules, behavior, attendance, grades, parent contact, minutes and incident reports. Each once, A to Z.
 */
export function studentsWithoutProfiles(w: Workspace): string[] {
  const have = new Set(w.students.map((s) => fold(s.name)));
  const found = new Map<string, string>();
  const add = (n: unknown) => {
    const name = String(n ?? "").replace(/\s+/g, " ").trim();
    if (!name || name.length > 80 || /^(whole group|class|everyone|all)$/i.test(name)) return;
    const k = fold(name);
    if (!have.has(k) && !found.has(k)) found.set(k, name);
  };
  for (const n of cleanPushInNotes(w.pushInNotes)) for (const s of n.students) add(s.student);
  for (const c of cleanClasses((w as any).lessonClasses)) for (const s of c.students || []) add(s);
  for (const l of cleanLessons(w.lessons)) { for (const k of Object.keys(l.marks || {})) add(k); for (const s of (l as any).forStudents || []) add(s); }
  const lists: unknown[] = [w.schedules, w.behavior, w.attendance, w.gradeScores, w.parentLogs, w.serviceLogs, w.services, (w as any).incidents];
  for (const list of lists) if (Array.isArray(list)) for (const r of list) add((r as any)?.student);
  return [...found.values()].sort((a, b) => a.localeCompare(b));
}

/** Adds names as supplementary students (skipping any already there). Stops when the plan's seats are full. */
export function addSupplementary(w: Workspace, names: string[], makeId: () => string, seats: number | null): { workspace: Workspace; added: number; full: boolean } {
  let next = w, added = 0;
  for (const name of names) {
    const r = addStudent(next, { name, grade: "", accommodations: "", iepDate: "", reevalDate: "", readingLevel: "", mathLevel: "", notes: "", supplementary: true }, makeId, seats);
    if (r.ok) { next = r.workspace; added++; continue; }
    if (/plan covers/i.test(r.message)) return { workspace: next, added, full: true };
  }
  return { workspace: next, added, full: false };
}
