// Moves students who picked "Independent Reader" in the school list over to
// independent accounts: no school, no teacher, approved, and recorded as an
// independent sign-up, the same as a student who uses the independent sign-up.
//
// Safe to run every time the server starts: once the students are moved there
// is nothing left to find. What each student had before is written to a log
// first, so the move can be undone by hand.
import { isIndependentSchoolName } from "../shared/independent";

export type TransferStudent = {
  id: number; username: string; displayName: string;
  teacherId: number | null; classId: number | null; approvedByTeacher: boolean;
};
export type TransferDeps = {
  schools(): Promise<Array<{ id: number; name: string }>>;
  /** Every student account whose school is this one. Throws if the database can't be read. */
  studentsAtSchool(schoolId: number): Promise<TransferStudent[]>;
  /** The school a teacher belongs to, or null. */
  teacherSchoolId(teacherId: number): Promise<number | null>;
  /** Clears the student's school, teacher and class, and marks them approved. */
  detach(studentId: number): Promise<void>;
  getSetting(key: string): Promise<string>;
  upsertSetting(key: string, value: string): Promise<void>;
  /** Tells the site admins what was done. */
  notifyAdmins?(title: string, message: string): Promise<void>;
  now?: () => number;
};

export type TransferLogEntry = {
  userId: number; username: string; fromSchoolId: number; fromSchoolName: string;
  fromTeacherId: number | null; fromClassId: number | null; wasApproved: boolean; at: string;
};
export const TRANSFER_LOG_KEY = "independent_transfer_log";

const readJson = async <T,>(deps: TransferDeps, key: string, fallback: T): Promise<T> => {
  try { const raw = await deps.getSetting(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
};

export async function transferIndependentStudents(deps: TransferDeps): Promise<{ moved: number; kept: number; schools: string[] }> {
  const at = new Date(deps.now ? deps.now() : Date.now()).toISOString();
  const schools = (await deps.schools()).filter((s) => isIndependentSchoolName(s.name));
  const independentIds = new Set(schools.map((s) => s.id));
  const toMove: TransferLogEntry[] = [];
  let kept = 0;

  for (const school of schools) {
    for (const student of await deps.studentsAtSchool(school.id)) {
      // A student who is in a class at a real school is not independent, whatever school they picked. Leave them be.
      const teacherSchool = student.teacherId ? await deps.teacherSchoolId(student.teacherId) : null;
      if (teacherSchool && !independentIds.has(teacherSchool)) { kept++; continue; }
      toMove.push({
        userId: student.id, username: student.username, fromSchoolId: school.id, fromSchoolName: school.name,
        fromTeacherId: student.teacherId, fromClassId: student.classId, wasApproved: student.approvedByTeacher, at,
      });
    }
  }
  if (!toMove.length) return { moved: 0, kept, schools: schools.map((s) => s.name) };

  // Write down what each student had before anything is changed.
  const log = await readJson<TransferLogEntry[]>(deps, TRANSFER_LOG_KEY, []);
  await deps.upsertSetting(TRANSFER_LOG_KEY, JSON.stringify([...(Array.isArray(log) ? log : []), ...toMove].slice(-5000)));

  const moved: TransferLogEntry[] = [];
  for (const entry of toMove) {
    try { await deps.detach(entry.userId); moved.push(entry); }
    catch (e: any) { console.error("[independent-transfer] could not move", entry.userId, e?.message); }
  }
  const movedIds = new Set(moved.map((m) => m.userId));

  // Recorded as independent sign-ups, like everyone who uses the independent sign-up.
  const types = await readJson<Record<string, string>>(deps, "student_signup_types", {});
  for (const id of movedIds) types[String(id)] = "independent";
  await deps.upsertSetting("student_signup_types", JSON.stringify(types));

  // Off any teacher's list.
  const rosters = await readJson<Record<string, number[]>>(deps, "teacher_students", {});
  let rostersChanged = false;
  for (const [teacherId, ids] of Object.entries(rosters)) {
    if (!Array.isArray(ids)) continue;
    const left = ids.filter((id) => !movedIds.has(Number(id)));
    if (left.length !== ids.length) { rosters[teacherId] = left; rostersChanged = true; }
  }
  if (rostersChanged) await deps.upsertSetting("teacher_students", JSON.stringify(rosters));

  // No longer waiting for the admin to connect them to a teacher.
  const requests = await readJson<any[]>(deps, "unlisted_signup_requests", []);
  if (Array.isArray(requests) && requests.some((r) => r && !r.resolved && movedIds.has(Number(r.userId)))) {
    for (const r of requests) {
      if (r && !r.resolved && movedIds.has(Number(r.userId))) { r.resolved = true; r.resolvedAt = at; r.resolvedTeacherId = null; r.resolvedSchoolId = null; }
    }
    await deps.upsertSetting("unlisted_signup_requests", JSON.stringify(requests));
  }

  if (moved.length && deps.notifyAdmins) {
    const names = [...new Set(moved.map((m) => m.fromSchoolName))].join(", ");
    const who = moved.length === 1 ? "1 student" : `${moved.length} students`;
    const left = kept ? ` ${kept === 1 ? "1 student was" : `${kept} students were`} left alone because they are in a class at another school.` : "";
    await deps.notifyAdmins("Students moved to independent accounts", `${who} who picked “${names}” at sign-up ${moved.length === 1 ? "is" : "are"} now ${moved.length === 1 ? "an independent student" : "independent students"}: no school and no teacher.${left}`).catch(() => undefined);
  }
  return { moved: moved.length, kept, schools: schools.map((s) => s.name) };
}
