// Students' Advisory and Literature teachers (rules in shared/classTeachers.ts).
//
//   GET  /api/student/class-teachers   should the sign-in pop-up ask, and the school's teachers to pick from
//   POST /api/student/class-teachers   save the student's two teachers for this school year
//   GET  /api/teacher/class-teachers   the whole school's list, for every teacher at that school
//
// A teacher sees only their own school's students. The administrator, who belongs to no school,
// picks a school (?schoolId=).
import type { Express, RequestHandler } from "express";
import { isSampleAccount } from "../shared/sampleAccounts";
import { isIndependentSchoolName } from "../shared/independent";
import {
  ClassTeachersError, buildRoster, resolveChoice, schoolYearOf,
  type ClassTeachers, type PickRow, type RosterStudent, type SchoolTeacher,
} from "../shared/classTeachers";

export type ClassTeacherDeps = {
  auth: RequestHandler;
  getSchool: (id: number) => Promise<{ id: number; name: string } | null>;
  allSchools: () => Promise<Array<{ id: number; name: string }>>;
  /** Approved, not archived teacher accounts at the school. */
  schoolTeachers: (schoolId: number) => Promise<SchoolTeacher[]>;
  /** Student accounts at the school that are asked (not archived, not eye-gaze, not samples). */
  schoolStudents: (schoolId: number) => Promise<RosterStudent[]>;
  getPick: (studentId: number, year: string) => Promise<PickRow | null>;
  schoolPicks: (schoolId: number, year: string) => Promise<PickRow[]>;
  savePick: (row: Omit<PickRow, "updated_at">) => Promise<PickRow>;
  now?: () => Date;
};

const posInt = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

/** Is this signed-in account one the pop-up is for: a real student (not a preview, sample or eye-gaze account)? */
export function asksClassTeachers(req: any): boolean {
  const u = req.user;
  if (!u || req.adminPreview || u.isAdmin) return false;
  if ((u.role || "student") !== "student") return false;
  if (u.is_eye_gaze_user) return false;
  return !isSampleAccount(u);
}

export function registerClassTeacherRoutes(app: Express, deps: ClassTeacherDeps) {
  const year = () => schoolYearOf(deps.now ? deps.now() : new Date());

  /** The student's school, when it is a real one with a list to share with. */
  const realSchool = async (schoolId: unknown) => {
    const id = posInt(schoolId);
    if (!id) return null;
    const school = await deps.getSchool(id);
    return school && !isIndependentSchoolName(school.name) ? school : null;
  };

  app.get("/api/student/class-teachers", deps.auth, async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const schoolYear = year();
      if (!asksClassTeachers(req)) return res.json({ needed: false, schoolYear });
      const school = await realSchool(req.user.school_id);
      if (!school) return res.json({ needed: false, schoolYear });
      const [pick, teachers] = await Promise.all([deps.getPick(Number(req.user.id), schoolYear), deps.schoolTeachers(school.id)]);
      const current: ClassTeachers | null = pick && Number(pick.school_id) === school.id
        ? { advisory: { teacherId: pick.advisory_teacher_id, name: pick.advisory_teacher_name }, lit: { teacherId: pick.lit_teacher_id, name: pick.lit_teacher_name } }
        : null;
      // Students are placed in an advisory when their accounts are made, so only their ELA teacher is asked.
      res.json({ needed: !current || !current.lit.name.trim(), schoolYear, school: { id: school.id, name: school.name }, teachers, current });
    } catch (e: any) {
      console.error("[class-teachers] student read failed:", e?.message);
      res.status(500).json({ message: "Your teachers could not be loaded. Please try again." });
    }
  });

  app.post("/api/student/class-teachers", deps.auth, async (req: any, res) => {
    try {
      if (!asksClassTeachers(req)) return res.status(403).json({ message: "Only students choose their ELA teacher." });
      const school = await realSchool(req.user.school_id);
      if (!school) return res.status(400).json({ message: "Your account isn't linked to a school yet. Ask your teacher to add you to your school." });
      const teachers = await deps.schoolTeachers(school.id);
      // The ELA teacher comes from the student. The advisory was set when their account was made,
      // and stays as it is unless one is sent (older versions of the form send both).
      const before = await deps.getPick(Number(req.user.id), year());
      const kept = before && Number(before.school_id) === school.id ? { teacherId: before.advisory_teacher_id, name: before.advisory_teacher_name } : { teacherId: null, name: "" };
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const picked = {
        advisory: body.advisory && !kept.name ? resolveChoice(body.advisory, "advisory", teachers) : kept,
        lit: resolveChoice(body.lit, "lit", teachers),
      };
      const saved = await deps.savePick({
        student_id: Number(req.user.id),
        school_year: year(),
        school_id: school.id,
        advisory_teacher_id: picked.advisory.teacherId,
        advisory_teacher_name: picked.advisory.name,
        lit_teacher_id: picked.lit.teacherId,
        lit_teacher_name: picked.lit.name,
      });
      res.json({
        ok: true,
        schoolYear: saved.school_year,
        current: { advisory: { teacherId: saved.advisory_teacher_id, name: saved.advisory_teacher_name }, lit: { teacherId: saved.lit_teacher_id, name: saved.lit_teacher_name } },
      });
    } catch (e: any) {
      if (e instanceof ClassTeachersError) return res.status(400).json({ message: e.message });
      console.error("[class-teachers] save failed:", e?.message);
      res.status(500).json({ message: "Your teachers could not be saved. Please try again." });
    }
  });

  app.get("/api/teacher/class-teachers", deps.auth, async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const u = req.user;
      const isAdmin = !!u?.isAdmin && !req.adminPreview;
      if (!u || (!isAdmin && u.role !== "teacher")) return res.status(403).json({ message: "Teacher or admin access required" });
      if (!isAdmin && u.accountApproved === false) return res.status(403).json({ message: "Your teacher account is waiting for approval." });
      const schoolYear = year();

      let school: { id: number; name: string } | null = null;
      let schools: Array<{ id: number; name: string }> | undefined;
      if (isAdmin) {
        schools = (await deps.allSchools()).filter((s) => !isIndependentSchoolName(s.name)).sort((a, b) => a.name.localeCompare(b.name));
        const asked = posInt(req.query?.schoolId);
        school = (asked && schools.find((s) => s.id === asked)) || null;
        if (!school) return res.json({ schoolYear, school: null, schools, teachers: [], entries: [], me: null });
      } else {
        school = await realSchool(u.school_id);
        if (!school) return res.json({ schoolYear, school: null, teachers: [], entries: [], me: Number(u.id), noSchool: true });
      }

      const [teachers, students, picks] = await Promise.all([deps.schoolTeachers(school.id), deps.schoolStudents(school.id), deps.schoolPicks(school.id, schoolYear)]);
      res.json({
        schoolYear,
        school,
        ...(schools ? { schools } : {}),
        teachers,
        entries: buildRoster(students, picks, teachers, school.id, schoolYear),
        me: isAdmin ? null : Number(u.id),
      });
    } catch (e: any) {
      console.error("[class-teachers] school list failed:", e?.message);
      res.status(500).json({ message: "The Advisory & Lit list could not be loaded. Please try again." });
    }
  });
}

/* ------------------------------------------------------------------ Supabase storage ---- */

type Db = { from: (table: string) => any };

/** Every row a query returns, a page at a time (Supabase stops at 1,000 rows otherwise). */
async function allRows<T>(make: () => any, page = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await make().range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const rows = (data || []) as T[];
    out.push(...rows);
    if (rows.length < page) return out;
  }
}

/** The storage the routes use, on the site's Supabase database. */
export function supabaseClassTeacherStore(db: Db): Omit<ClassTeacherDeps, "auth" | "now"> {
  const PICK_COLS = "student_id, school_year, school_id, advisory_teacher_id, advisory_teacher_name, lit_teacher_id, lit_teacher_name, updated_at";
  const toPick = (r: any): PickRow => ({
    student_id: Number(r.student_id), school_year: String(r.school_year), school_id: Number(r.school_id),
    advisory_teacher_id: r.advisory_teacher_id == null ? null : Number(r.advisory_teacher_id), advisory_teacher_name: String(r.advisory_teacher_name || ""),
    lit_teacher_id: r.lit_teacher_id == null ? null : Number(r.lit_teacher_id), lit_teacher_name: String(r.lit_teacher_name || ""),
    updated_at: String(r.updated_at || ""),
  });
  return {
    async getSchool(id) {
      const { data, error } = await db.from("schools").select("id, name").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { id: Number(data.id), name: String(data.name || "") } : null;
    },
    async allSchools() {
      const rows = await allRows<any>(() => db.from("schools").select("id, name").order("id", { ascending: true }));
      return rows.map((r) => ({ id: Number(r.id), name: String(r.name || "") }));
    },
    async schoolTeachers(schoolId) {
      const rows = await allRows<any>(() => db.from("users").select("id, display_name, account_approved").eq("school_id", schoolId).eq("role", "teacher").is("archived_at", null).order("id", { ascending: true }));
      // Shared school-staff accounts (the "school_leader_ids" and "eye_gaze_staff_ids" settings) are not anyone's class teacher.
      let leaders = new Set<number>();
      try {
        const { data } = await db.from("settings").select("key, value").in("key", ["school_leader_ids", "eye_gaze_staff_ids"]);
        for (const row of (data || []) as any[]) {
          const ids = JSON.parse(row?.value || "[]");
          if (Array.isArray(ids)) for (const id of ids) leaders.add(Number(id));
        }
      } catch {}
      return rows
        .filter((r) => r.account_approved !== false && !leaders.has(Number(r.id)))
        .map((r) => ({ id: Number(r.id), displayName: String(r.display_name || "").trim() }))
        .filter((t) => t.displayName)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    },
    async schoolStudents(schoolId) {
      const rows = await allRows<any>(() => db.from("users").select("id, username, display_name, role, is_admin, is_eye_gaze_user").eq("school_id", schoolId).is("archived_at", null).order("id", { ascending: true }));
      return rows
        .filter((r) => !r.is_admin && (r.role || "student") === "student" && !r.is_eye_gaze_user && !isSampleAccount(r))
        .map((r) => ({ id: Number(r.id), username: String(r.username || ""), displayName: String(r.display_name || "") }));
    },
    async getPick(studentId, year) {
      const { data, error } = await db.from("student_class_teachers").select(PICK_COLS).eq("student_id", studentId).eq("school_year", year).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toPick(data) : null;
    },
    async schoolPicks(schoolId, year) {
      const rows = await allRows<any>(() => db.from("student_class_teachers").select(PICK_COLS).eq("school_id", schoolId).eq("school_year", year).order("student_id", { ascending: true }));
      return rows.map(toPick);
    },
    async savePick(row) {
      const { data, error } = await db.from("student_class_teachers")
        .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "student_id,school_year" })
        .select(PICK_COLS).single();
      if (error) throw new Error(error.message);
      return toPick(data);
    },
  };
}
