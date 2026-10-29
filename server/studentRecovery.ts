// Students getting back into their own account instead of making a new one:
// - "Forgot username?": pick your school, then type your student ID number (or your first and
//   last name). If exactly one student matches, the username is shown right there.
// - "Forgot password?": find your account the same way (or type your username). Your teacher
//   gets a request ("Password help") with a button to set a new password; nothing about the
//   account changes until a teacher does that.
// Students have no email, so a teacher is the safe way to change a password.
import type { Express, RequestHandler } from "express";
import { clientAddress, createAttemptLimiter, waitWords } from "./attemptLimiter";

export type StudentRow = { id: number; username: string; displayName: string; schoolId: number | null; teacherId: number | null; studentNumber: string | null };
export type HelpRow = { id: number; studentId: number; createdAt: string };

export type StudentRecoveryDeps = {
  /** Students (not archived) at a school. */
  studentsAtSchool(schoolId: number): Promise<StudentRow[]>;
  studentByUsername(username: string): Promise<StudentRow | null>;
  /** An open request for this student, if there is one. */
  openHelp(studentId: number): Promise<HelpRow | null>;
  addHelp(row: { studentId: number; schoolId: number | null; teacherId: number | null }): Promise<void>;
  notifyTeacher(teacherId: number, studentName: string): Promise<void>;
  /** Open requests a teacher can see (their students, students at their school; admins: all). */
  helpFor(user: any): Promise<(HelpRow & { name: string; username: string; schoolId: number | null; teacherId: number | null })[]>;
  closeHelp(id: number, byUserId: number): Promise<{ studentId: number } | null>;
  canReachStudent(user: any, studentId: number): Promise<boolean>;
};

const words = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
const digits = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).replace(/\D/g, "").slice(0, 12) : "");
const text = (v: unknown, max = 40) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** The one student matching an ID number, or a first and last name, at a school. */
export function findStudent(list: StudentRow[], q: { studentNumber?: string; firstName?: string; lastName?: string }): { student: StudentRow } | { reason: "none" | "many" } {
  const num = digits(q.studentNumber);
  if (num) {
    const hits = list.filter((s) => digits(s.studentNumber ?? "") === num || (/^\d+$/.test(s.username) && s.username === num));
    const unique = [...new Map(hits.map((s) => [s.id, s])).values()];
    return unique.length === 1 ? { student: unique[0] } : { reason: unique.length ? "many" : "none" };
  }
  const first = words(q.firstName ?? "")[0], last = words(q.lastName ?? "").join(" ");
  if (!first || !last) return { reason: "none" };
  const hits = list.filter((s) => { const w = words(s.displayName); return w[0] === first && w.slice(1).join(" ").endsWith(last); });
  return hits.length === 1 ? { student: hits[0] } : { reason: hits.length ? "many" : "none" };
}

export function registerStudentRecoveryRoutes(app: Express, d: StudentRecoveryDeps & { auth: RequestHandler; teacherOrAdmin: RequestHandler }) {
  // 12 lookups per network per 15 minutes: plenty for a student, too slow to guess through a school.
  const lookups = createAttemptLimiter({ max: 12, windowMs: 15 * 60_000 });
  const tooMany = (req: any, res: any) => {
    const key = clientAddress(req);
    const wait = lookups.retryAfter(key);
    if (wait > 0) { res.status(429).json({ message: `Too many tries. Wait ${waitWords(wait)}, or ask your teacher.` }); return true; }
    lookups.fail(key);
    return false;
  };
  const NONE = "We couldn't find a student with that at your school. Check it and try again, or ask your teacher.";
  const MANY = "More than one student matches. Use your student ID number instead, or ask your teacher.";

  async function locate(body: any): Promise<{ student: StudentRow } | { message: string }> {
    const username = text(body?.username).toLowerCase();
    if (username) {
      const s = await d.studentByUsername(username);
      return s ? { student: s } : { message: "We couldn't find that username. Try \"Forgot username?\" first." };
    }
    const schoolId = Number(body?.schoolId);
    if (!Number.isInteger(schoolId) || schoolId <= 0) return { message: "Pick your school first." };
    const r = findStudent(await d.studentsAtSchool(schoolId), { studentNumber: body?.studentNumber, firstName: text(body?.firstName), lastName: text(body?.lastName) });
    return "student" in r ? r : { message: r.reason === "many" ? MANY : NONE };
  }

  app.post("/api/auth/student/find-username", async (req, res) => {
    if (tooMany(req, res)) return;
    try {
      const r = await locate({ ...req.body, username: "" });
      if (!("student" in r)) return res.status(404).json({ message: r.message });
      res.json({ username: r.student.username, firstName: words(r.student.displayName)[0] ? r.student.displayName.split(/\s+/)[0] : "" });
    } catch { res.status(500).json({ message: "That didn't work. Try again." }); }
  });

  app.post("/api/auth/student/password-help", async (req, res) => {
    if (tooMany(req, res)) return;
    try {
      const r = await locate(req.body);
      if (!("student" in r)) return res.status(404).json({ message: r.message });
      const s = r.student;
      if (!(await d.openHelp(s.id))) {
        await d.addHelp({ studentId: s.id, schoolId: s.schoolId, teacherId: s.teacherId });
        if (s.teacherId) await d.notifyTeacher(s.teacherId, s.displayName).catch(() => {});
      }
      res.json({ ok: true, username: s.username, message: `Your teacher will see your request and give you a new password. Your username is ${s.username}.` });
    } catch { res.status(500).json({ message: "That didn't work. Try again." }); }
  });

  app.get("/api/teacher/password-help", d.auth, d.teacherOrAdmin, async (req: any, res) => {
    try { res.set("Cache-Control", "no-store"); res.json({ requests: await d.helpFor(req.user) }); }
    catch { res.json({ requests: [] }); }
  });

  app.post("/api/teacher/password-help/:id/done", d.auth, d.teacherOrAdmin, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ message: "That request is gone." });
    try {
      const list = await d.helpFor(req.user);
      const hit = list.find((h) => h.id === id);
      if (!hit || !(await d.canReachStudent(req.user, hit.studentId))) return res.status(403).json({ message: "You can only help your own students." });
      await d.closeHelp(id, Number(req.user.id));
      res.json({ ok: true });
    } catch { res.status(500).json({ message: "That didn't work. Try again." }); }
  });
}
