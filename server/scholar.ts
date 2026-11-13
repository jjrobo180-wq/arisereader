// AriseScholar (arisereader.com/scholar/): teachers tap to give students academic points (work
// completed, participation, focused) and everyone sees their school's student leaderboard.
//
// Rules kept here, on the server:
// - Only teachers (and admins) give points, only to current students at their own school, one point a
//   tap, and at most MAX_SAME_PER_DAY of the same kind from one teacher to one student in a day.
// - A teacher can take back only their own tap, within a day.
// - The board shows first names and last initials only, for the viewer's own school.
// Table: migrations/scholar_points.sql.
import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { MAX_SAME_PER_DAY, POINTS_PER_TAP, UNDO_MS, buildBoard, categoryById, periodStartDay, schoolDay, type ScholarEvent, type ScholarPeriod } from "../shared/scholar";
import { dayStartMs } from "../shared/advisoryChallenge";

export type ScholarViewer = { id: number; role: "student" | "teacher" | "parent" | "admin"; displayName: string; schoolId: number | null };
export type ScholarStudent = { id: number; name: string; group: string };
export type ScholarDeps = {
  viewer: (id: number) => Promise<ScholarViewer | null>;
  /** The school's current students (no admins, sample or archived accounts), with their advisory as a group. */
  schoolStudents: (schoolId: number) => Promise<ScholarStudent[]>;
  schoolName: (schoolId: number) => Promise<string>;
  /** The first school with students, for an admin with no school of their own. */
  anySchool?: () => Promise<number | null>;
  store?: ScholarStore;
  now?: () => number;
};
export interface ScholarStore {
  add(rows: ScholarEvent[]): Promise<void>;
  events(q: { schoolId: number; since?: string; teacherId?: number; studentId?: number }): Promise<ScholarEvent[]>;
  get(id: string): Promise<ScholarEvent | null>;
  remove(id: string): Promise<void>;
}
export class ScholarNotSetUp extends Error {}

export function createMemoryScholarStore(): ScholarStore {
  let rows: ScholarEvent[] = [];
  return {
    async add(r) { rows.push(...r.map((x) => ({ ...x }))); },
    async events(q) { return rows.filter((e) => e.school_id === q.schoolId && (!q.since || e.created_at >= q.since) && (q.teacherId == null || e.teacher_id === q.teacherId) && (q.studentId == null || e.student_id === q.studentId)).map((e) => ({ ...e })); },
    async get(id) { const e = rows.find((x) => x.id === id); return e ? { ...e } : null; },
    async remove(id) { rows = rows.filter((x) => x.id !== id); },
  };
}

const isMissingTable = (e: any) => e?.code === "42P01" || e?.code === "PGRST205" || /could not find the table|does not exist/i.test(String(e?.message || ""));
export function createSupabaseScholarStore(client?: any): ScholarStore {
  const db = async () => client ?? (await import("./supabase")).supabase;
  const fail = (e: any) => { if (!e) return; if (isMissingTable(e)) throw new ScholarNotSetUp(String(e.message)); throw e; };
  const clean = (x: any): ScholarEvent => ({ ...x, teacher_id: Number(x.teacher_id), student_id: Number(x.student_id), school_id: Number(x.school_id), points: Number(x.points) });
  return {
    async add(r) { if (!r.length) return; const res = await (await db()).from("scholar_points").insert(r); fail(res.error); },
    async events(q) {
      const out: ScholarEvent[] = [];
      for (let from = 0; ; from += 1000) {
        let s = (await db()).from("scholar_points").select("*").eq("school_id", q.schoolId);
        if (q.since) s = s.gte("created_at", q.since);
        if (q.teacherId != null) s = s.eq("teacher_id", q.teacherId);
        if (q.studentId != null) s = s.eq("student_id", q.studentId);
        const res = await s.order("created_at", { ascending: true }).range(from, from + 999);
        fail(res.error);
        out.push(...(res.data || []).map(clean));
        if (!res.data || res.data.length < 1000) return out;
      }
    },
    async get(id) { const res = await (await db()).from("scholar_points").select("*").eq("id", id).maybeSingle(); fail(res.error); return res.data ? clean(res.data) : null; },
    async remove(id) { const res = await (await db()).from("scholar_points").delete().eq("id", id); fail(res.error); },
  };
}

const PERIOD_IDS: ScholarPeriod[] = ["week", "month", "year"];

export function registerScholarRoutes(app: Express, auth: RequestHandler, deps: ScholarDeps) {
  const store = deps.store ?? createSupabaseScholarStore();
  const now = deps.now ?? Date.now;
  const handle = (fn: (req: any, res: any) => Promise<any>) => async (req: any, res: any) => {
    try { res.set("Cache-Control", "no-store"); await fn(req, res); }
    catch (e: any) {
      if (e?.status === 401) return res.status(401).json({ message: "Sign in again." });
      if (e instanceof ScholarNotSetUp) return res.status(503).json({ message: "AriseScholar isn't set up yet: its table is missing (migrations/scholar_points.sql)." });
      console.error("[scholar]", e?.message || e);
      res.status(500).json({ message: "Something went wrong. Try again." });
    }
  };
  const who = async (req: any) => {
    const v = await deps.viewer(Number(req.user?.id));
    if (!v) throw Object.assign(new Error("signed out"), { status: 401 });
    let schoolId = v.schoolId;
    if (!schoolId && v.role === "admin" && deps.anySchool) schoolId = await deps.anySchool();
    return { ...v, schoolId };
  };
  const giver = (v: ScholarViewer) => v.role === "teacher" || v.role === "admin";

  // Who's looking, and their school.
  app.get("/api/scholar/me", auth, handle(async (req, res) => {
    const v = await who(req);
    res.json({ id: v.id, name: v.displayName, role: v.role, canGive: giver(v) && !!v.schoolId, schoolId: v.schoolId, schoolName: v.schoolId ? await deps.schoolName(v.schoolId) : "" });
  }));

  // The school's students, with what this teacher has given each one today (for the tap screen).
  app.get("/api/scholar/students", auth, handle(async (req, res) => {
    const v = await who(req);
    if (!giver(v)) return res.status(403).json({ message: "Only teachers give points." });
    if (!v.schoolId) return res.json({ students: [], today: [] });
    const since = new Date(dayStartMs(schoolDay(now()))).toISOString();
    const [students, mine] = await Promise.all([deps.schoolStudents(v.schoolId), store.events({ schoolId: v.schoolId, teacherId: v.id, since })]);
    res.json({ students, today: mine.map((e) => ({ id: e.id, studentId: e.student_id, category: e.category, at: e.created_at })) });
  }));

  // Give points: { studentIds: number[], category }.
  app.post("/api/scholar/give", auth, handle(async (req, res) => {
    const v = await who(req);
    if (!giver(v) || !v.schoolId) return res.status(403).json({ message: "Only teachers at a school give points." });
    const cat = categoryById(String(req.body?.category || ""));
    if (!cat) return res.status(400).json({ message: "Pick work, participation or focused." });
    const ids = [...new Set((Array.isArray(req.body?.studentIds) ? req.body.studentIds : []).map(Number).filter((n: number) => Number.isSafeInteger(n) && n > 0))].slice(0, 60) as number[];
    if (!ids.length) return res.status(400).json({ message: "Pick a student." });
    const allowed = new Set((await deps.schoolStudents(v.schoolId)).map((s) => s.id));
    const since = new Date(dayStartMs(schoolDay(now()))).toISOString();
    const today = await store.events({ schoolId: v.schoolId, teacherId: v.id, since });
    const at = new Date(now()).toISOString();
    const rows: ScholarEvent[] = [], skipped: number[] = [];
    for (const id of ids) {
      const same = today.filter((e) => e.student_id === id && e.category === cat.id).length;
      if (!allowed.has(id) || same >= MAX_SAME_PER_DAY) { skipped.push(id); continue; }
      rows.push({ id: randomUUID(), teacher_id: v.id, student_id: id, school_id: v.schoolId, category: cat.id, points: POINTS_PER_TAP, created_at: at });
    }
    await store.add(rows);
    res.json({ given: rows.map((e) => ({ id: e.id, studentId: e.student_id, category: e.category, at: e.created_at })), skipped });
  }));

  // Take back one of your own taps (within a day).
  app.post("/api/scholar/undo", auth, handle(async (req, res) => {
    const v = await who(req);
    const e = await store.get(String(req.body?.id || ""));
    if (!e || e.teacher_id !== v.id) return res.status(404).json({ message: "That point isn't yours to take back." });
    if (now() - Date.parse(e.created_at) > UNDO_MS) return res.status(400).json({ message: "Points can be taken back for one day." });
    await store.remove(e.id);
    res.json({ ok: true });
  }));

  // The school's board: ?period=week|month|year. A student also gets their own row, even off the top list.
  app.get("/api/scholar/board", auth, handle(async (req, res) => {
    const v = await who(req);
    const period: ScholarPeriod = PERIOD_IDS.includes(req.query.period) ? req.query.period : "week";
    if (!v.schoolId) return res.json({ period, schoolName: "", rows: [], me: null, total: 0 });
    const since = new Date(dayStartMs(periodStartDay(period, now()))).toISOString();
    const [students, events] = await Promise.all([deps.schoolStudents(v.schoolId), store.events({ schoolId: v.schoolId, since })]);
    const board = buildBoard(events, new Map(students.map((s) => [s.id, s.name])));
    const me = v.role === "student" ? board.find((r) => r.studentId === v.id) || { rank: 0, studentId: v.id, name: "You", points: 0, work: 0, participation: 0, focused: 0 } : null;
    const top = board.slice(0, 50).map((r) => ({ ...r, studentId: v.role === "student" && r.studentId !== v.id ? 0 : r.studentId, you: r.studentId === v.id }));
    res.json({ period, schoolName: await deps.schoolName(v.schoolId), rows: top, me, total: board.length });
  }));
}
