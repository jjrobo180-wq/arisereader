// Arise History (/history/): K–12 history built like A.R.I.S.E. Reader. Students read a short true story
// (a History Read) and take a 5-question quiz on it; points go on a class leaderboard, with achievements,
// certificates and the game room. Teachers see their class, assign reads or their own questions, send
// certificates and run live review games; parents follow each linked child.
//
// Rules kept here, on the server (the same as Arise Math):
// - Accounts are the regular A.R.I.S.E. Reader accounts. Students show as "First L." to classmates.
// - The answer key never reaches the page before a quiz is turned in. The server shuffles the choices,
//   grades the whole quiz, and only then sends back what was right, so points can't be faked.
// - Retakes only earn points for improving on the best score.
// - A class is a teacher and their approved students. Students see only their own class's leaderboard,
//   assignments and live games. Teachers see only their own students; parents only their linked children.
// - History points are separate from reading and math points, so they don't change competitions or prizes.
// Tables: migrations/arise_history.sql.
import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { createAttemptLimiter } from "./attemptLimiter";
import { bandForGrade } from "../shared/ariseSocial";
import {
  ACHIEVEMENTS, BANDS, CERT_TITLES, LIMITS, MILESTONES, PASS, POINTS, READS, STYLES, WEEKLY_GOAL,
  accuracy, cleanCustom, cleanHistoryProfile, earnedAchievements, emptyHistoryProfile, gradeQuiz, historyDay, historyWeek, isBand,
  itemPublic, makeItems, passed, pointsFor, profileNow, readById, readPublic, readsFor, touchStreak,
  type BandId, type HistoryProfile, type Item, type Question, type Rng,
} from "../shared/ariseHistory";

export type HistoryRole = "student" | "teacher" | "parent" | "admin";
export type HistoryUser = { id: number; role: HistoryRole; displayName: string; teacherId: number | null; schoolId: number | null; approvedByTeacher: boolean; archived: boolean };

export type SessionRow = {
  id: string; user_id: number; title: string; kind: "read" | "assign"; read_id: string | null; assignment_id: string | null;
  items: Item[]; answers: (number | null)[] | null; score: number | null; points: number; rank_before: number | null; status: "open" | "done"; created_at: string;
};
export type ClassSettings = { band: BandId | null; board_show: boolean; board_by: "points" | "effort" };
export type AssignmentRow = {
  id: string; teacher_id: number; kind: "read" | "custom"; read_id: string | null; title: string; note: string; due: string; band: BandId; questions: Question[]; created_at: string;
};
export type ResultRow = { assignment_id: string; user_id: number; score: number; total: number };
export type LiveRow = {
  id: string; teacher_id: number; code: string; band: BandId; phase: "lobby" | "q" | "reveal" | "done" | "ended";
  qi: number; question: Item | null; used: string[]; q_ends_at: string | null; created_at: string;
};
export type PlayerRow = { game_id: string; user_id: number; name: string; score: number; answer: number | null; answered_qi: number };

export interface HistoryStore {
  getProfile(userId: number): Promise<HistoryProfile>;
  getProfiles(userIds: number[]): Promise<Map<number, HistoryProfile>>;
  saveProfile(userId: number, p: HistoryProfile): Promise<void>;
  createSession(row: Omit<SessionRow, "id" | "created_at">): Promise<SessionRow>;
  getSession(id: string): Promise<SessionRow | null>;
  saveSession(row: SessionRow): Promise<void>;
  getSettings(teacherId: number): Promise<ClassSettings | null>;
  saveSettings(teacherId: number, s: ClassSettings): Promise<void>;
  assignmentsFor(teacherId: number): Promise<AssignmentRow[]>;
  getAssignment(id: string): Promise<AssignmentRow | null>;
  createAssignment(row: Omit<AssignmentRow, "id" | "created_at">): Promise<AssignmentRow>;
  deleteAssignment(id: string): Promise<void>;
  results(assignmentIds: string[]): Promise<ResultRow[]>;
  saveResult(row: ResultRow): Promise<void>;
  createLive(row: Omit<LiveRow, "id" | "created_at">): Promise<LiveRow>;
  getLive(id: string): Promise<LiveRow | null>;
  /** An open game (not done or ended) with this code. */
  liveByCode(code: string): Promise<LiveRow | null>;
  /** The teacher's newest open game. */
  liveOf(teacherId: number): Promise<LiveRow | null>;
  saveLive(row: LiveRow): Promise<void>;
  players(gameId: string): Promise<PlayerRow[]>;
  savePlayer(row: PlayerRow): Promise<void>;
}

/* ------------------------------------------------------------------ stores */

const loadDb = async () => (await import("./supabase")).supabase;
/** Thrown when migrations/arise_history.sql has not been run yet. */
export class HistoryNotSetUp extends Error {}
const isMissingTable = (error: any) => error?.code === "42P01" || error?.code === "PGRST205" || /could not find the table|does not exist/i.test(String(error?.message || ""));
const OPEN_PHASES = ["lobby", "q", "reveal"];

export function createSupabaseHistoryStore(client?: any): HistoryStore {
  const db = async () => client ?? (await loadDb());
  const fail = (error: any) => {
    if (!error) return;
    if (isMissingTable(error)) throw new HistoryNotSetUp(String(error.message));
    throw error;
  };
  const stamp = () => new Date().toISOString();
  return {
    async getProfile(userId) {
      const r = await (await db()).from("history_profiles").select("data").eq("user_id", userId).maybeSingle();
      fail(r.error);
      return cleanHistoryProfile(r.data?.data);
    },
    async getProfiles(userIds) {
      const out = new Map<number, HistoryProfile>();
      if (!userIds.length) return out;
      const r = await (await db()).from("history_profiles").select("user_id, data").in("user_id", userIds);
      fail(r.error);
      for (const row of r.data || []) out.set(Number(row.user_id), cleanHistoryProfile(row.data));
      return out;
    },
    async saveProfile(userId, p) {
      fail((await (await db()).from("history_profiles").upsert({ user_id: userId, data: p, points: p.points, updated_at: stamp() }, { onConflict: "user_id" })).error);
    },
    async createSession(row) {
      const r = await (await db()).from("history_sessions").insert(row).select("*").single();
      fail(r.error);
      return r.data as SessionRow;
    },
    async getSession(id) {
      const r = await (await db()).from("history_sessions").select("*").eq("id", id).maybeSingle();
      fail(r.error);
      return (r.data as SessionRow) || null;
    },
    async saveSession(row) {
      const { id, created_at: _c, ...rest } = row;
      fail((await (await db()).from("history_sessions").update({ ...rest, updated_at: stamp() }).eq("id", id)).error);
    },
    async getSettings(teacherId) {
      const r = await (await db()).from("history_class_settings").select("*").eq("teacher_id", teacherId).maybeSingle();
      fail(r.error);
      if (!r.data) return null;
      return { band: isBand(r.data.band) ? r.data.band : null, board_show: r.data.board_show !== false, board_by: r.data.board_by === "effort" ? "effort" : "points" };
    },
    async saveSettings(teacherId, s) {
      fail((await (await db()).from("history_class_settings").upsert({ teacher_id: teacherId, ...s, updated_at: stamp() }, { onConflict: "teacher_id" })).error);
    },
    async assignmentsFor(teacherId) {
      const r = await (await db()).from("history_assignments").select("*").eq("teacher_id", teacherId).order("created_at", { ascending: false }).limit(30);
      fail(r.error);
      return (r.data || []) as AssignmentRow[];
    },
    async getAssignment(id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const r = await (await db()).from("history_assignments").select("*").eq("id", id).maybeSingle();
      fail(r.error);
      return (r.data as AssignmentRow) || null;
    },
    async createAssignment(row) {
      const r = await (await db()).from("history_assignments").insert(row).select("*").single();
      fail(r.error);
      return r.data as AssignmentRow;
    },
    async deleteAssignment(id) { fail((await (await db()).from("history_assignments").delete().eq("id", id)).error); },
    async results(ids) {
      if (!ids.length) return [];
      const r = await (await db()).from("history_assignment_results").select("assignment_id, user_id, score, total").in("assignment_id", ids);
      fail(r.error);
      return (r.data || []) as ResultRow[];
    },
    async saveResult(row) {
      fail((await (await db()).from("history_assignment_results").upsert({ ...row, finished_at: stamp() }, { onConflict: "assignment_id,user_id" })).error);
    },
    async createLive(row) {
      const r = await (await db()).from("history_live_games").insert(row).select("*").single();
      fail(r.error);
      return r.data as LiveRow;
    },
    async getLive(id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const r = await (await db()).from("history_live_games").select("*").eq("id", id).maybeSingle();
      fail(r.error);
      return (r.data as LiveRow) || null;
    },
    async liveByCode(code) {
      const r = await (await db()).from("history_live_games").select("*").eq("code", code).in("phase", OPEN_PHASES).order("created_at", { ascending: false }).limit(1);
      fail(r.error);
      return ((r.data || [])[0] as LiveRow) || null;
    },
    async liveOf(teacherId) {
      const r = await (await db()).from("history_live_games").select("*").eq("teacher_id", teacherId).in("phase", OPEN_PHASES).order("created_at", { ascending: false }).limit(1);
      fail(r.error);
      return ((r.data || [])[0] as LiveRow) || null;
    },
    async saveLive(row) {
      const { id, created_at: _c, ...rest } = row;
      fail((await (await db()).from("history_live_games").update({ ...rest, updated_at: stamp() }).eq("id", id)).error);
    },
    async players(gameId) {
      const r = await (await db()).from("history_live_players").select("game_id, user_id, name, score, answer, answered_qi").eq("game_id", gameId);
      fail(r.error);
      return (r.data || []) as PlayerRow[];
    },
    async savePlayer(row) {
      fail((await (await db()).from("history_live_players").upsert(row, { onConflict: "game_id,user_id" })).error);
    },
  };
}

/** In-memory store for tests. */
export function createMemoryHistoryStore(now: () => number = Date.now): HistoryStore {
  const profiles = new Map<number, HistoryProfile>();
  const sessions = new Map<string, SessionRow>();
  const settings = new Map<number, ClassSettings>();
  const assignments: AssignmentRow[] = [];
  const results: ResultRow[] = [];
  const games = new Map<string, LiveRow>();
  const players: PlayerRow[] = [];
  const iso = () => new Date(now()).toISOString();
  const c = <T,>(v: T): T => structuredClone(v);
  return {
    async getProfile(id) { return c(profiles.get(id) ?? emptyHistoryProfile()); },
    async getProfiles(ids) { return new Map(ids.filter((i) => profiles.has(i)).map((i) => [i, c(profiles.get(i)!)])); },
    async saveProfile(id, p) { profiles.set(id, c(p)); },
    async createSession(row) { const s = { ...c(row), id: randomUUID(), created_at: iso() }; sessions.set(s.id, s); return c(s); },
    async getSession(id) { return c(sessions.get(id) ?? null); },
    async saveSession(row) { sessions.set(row.id, c(row)); },
    async getSettings(id) { return c(settings.get(id) ?? null); },
    async saveSettings(id, s) { settings.set(id, c(s)); },
    async assignmentsFor(t) { return c(assignments.filter((a) => a.teacher_id === t).reverse()); },
    async getAssignment(id) { return c(assignments.find((a) => a.id === id) ?? null); },
    async createAssignment(row) { const a = { ...c(row), id: randomUUID(), created_at: iso() }; assignments.push(a); return c(a); },
    async deleteAssignment(id) { const i = assignments.findIndex((a) => a.id === id); if (i >= 0) assignments.splice(i, 1); },
    async results(ids) { return c(results.filter((r) => ids.includes(r.assignment_id))); },
    async saveResult(row) { const i = results.findIndex((r) => r.assignment_id === row.assignment_id && r.user_id === row.user_id); if (i >= 0) results.splice(i, 1); results.push(c(row)); },
    async createLive(row) { const g = { ...c(row), id: randomUUID(), created_at: iso() }; games.set(g.id, g); return c(g); },
    async getLive(id) { return c(games.get(id) ?? null); },
    async liveByCode(code) { return c([...games.values()].reverse().find((g) => g.code === code && OPEN_PHASES.includes(g.phase)) ?? null); },
    async liveOf(t) { return c([...games.values()].reverse().find((g) => g.teacher_id === t && OPEN_PHASES.includes(g.phase)) ?? null); },
    async saveLive(row) { games.set(row.id, c(row)); },
    async players(id) { return c(players.filter((p) => p.game_id === id)); },
    async savePlayer(row) { const i = players.findIndex((p) => p.game_id === row.game_id && p.user_id === row.user_id); if (i >= 0) players.splice(i, 1); players.push(c(row)); },
  };
}

/* ------------------------------------------------------------------ helpers */

/** "Jaylen Williams" → "Jaylen W." (how students show to classmates). */
export function studentName(displayName: string): string {
  const words = String(displayName || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "Student";
  return words.length === 1 ? words[0] : `${words[0]} ${words[words.length - 1][0].toUpperCase()}.`;
}
const roleOf = (raw: any): HistoryRole => (raw?.isAdmin ? "admin" : raw?.role === "teacher" ? "teacher" : raw?.role === "parent" ? "parent" : "student");
const isDay = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));
const LIVE_QUESTIONS = 5;
const LIVE_SECONDS = 20;

export type HistoryDirectory = {
  user(id: number): Promise<HistoryUser | null>;
  /** The grade a student gave at sign-up ("K", "3", "11"...), if any. */
  gradeOf(id: number): Promise<string | null>;
  /** A teacher's approved, active students. */
  studentsOf(teacherId: number): Promise<HistoryUser[]>;
  childrenOf(parentId: number): Promise<number[]>;
  notify?(userId: number, message: { title: string; body: string; url?: string }): Promise<unknown>;
};
export type HistoryDeps = { store?: HistoryStore; directory: HistoryDirectory; now?: () => number; random?: Rng };

/* ------------------------------------------------------------------ routes */

export function registerAriseHistoryRoutes(app: Express, auth: RequestHandler, deps: HistoryDeps) {
  const store = deps.store ?? createSupabaseHistoryStore();
  const dir = deps.directory;
  const now = deps.now ?? Date.now;
  const random = deps.random ?? Math.random;
  const quizzesToday = createAttemptLimiter({ max: LIMITS.quizzesPerDay, windowMs: 24 * 3600_000, now });
  const joinTries = createAttemptLimiter({ max: 12, windowMs: 10 * 60_000, now });
  const notify = (id: number, body: string) => { dir.notify?.(id, { title: "Arise History", body, url: "/history/" })?.catch?.(() => {}); };
  const shortDate = () => new Date(now()).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Denver" });
  const longDate = () => new Date(now()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Denver" });

  type Viewer = HistoryUser & { grade: string | null; band: BandId; hasClass: boolean };
  /** The signed-in account as Arise History sees it (an admin previewing as a student counts as that student). */
  async function viewer(req: any): Promise<Viewer> {
    const raw = req.user || {};
    const role: HistoryRole = req.adminPreview ? "student" : roleOf(raw);
    const grade = role === "student" ? await dir.gradeOf(Number(raw.id)).catch(() => null) : null;
    const teacherId = raw.teacherId ? Number(raw.teacherId) : null;
    const approved = raw.approvedByTeacher !== false;
    return {
      id: Number(raw.id), role, displayName: String(raw.displayName || raw.display_name || raw.username || ""), teacherId,
      schoolId: raw.school_id ?? raw.schoolId ?? null, approvedByTeacher: approved, archived: !!raw.archivedAt,
      grade, band: bandForGrade(grade) as BandId, hasClass: role === "student" && !!teacherId && approved,
    };
  }
  const handle = (fn: (req: any, res: any) => Promise<unknown>) => async (req: any, res: any) => {
    try { res.set?.("Cache-Control", "no-store"); await fn(req, res); }
    catch (error: any) {
      if (error instanceof HistoryNotSetUp) return res.status(503).json({ message: "Arise History is still being set up. Please check back soon.", setup: true });
      console.error("[arise-history]", error?.message || error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  };
  const isStaff = (v: Viewer) => v.role === "teacher" || v.role === "admin";

  /** The band a student reads: their own pick, or the one their grade puts them in. */
  const bandFor = (p: HistoryProfile, v: { band: BandId }) => p.band ?? v.band;
  /** The band a teacher's class reads: their saved pick, or the most common band among their students. */
  async function classBand(teacherId: number, kids?: HistoryUser[]): Promise<BandId> {
    const s = await store.getSettings(teacherId);
    if (s?.band) return s.band;
    const list = kids ?? (await dir.studentsOf(teacherId));
    const counts: Record<string, number> = {};
    for (const k of list) { const b = bandForGrade(await dir.gradeOf(k.id).catch(() => null)); counts[b] = (counts[b] || 0) + 1; }
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as BandId) || "g35";
  }
  const settingsOf = async (teacherId: number): Promise<ClassSettings> => (await store.getSettings(teacherId)) ?? { band: null, board_show: true, board_by: "points" };

  /** The class's rows for the leaderboard (week or all time), sorted, with ranks. */
  async function boardFor(teacherId: number, period: "week" | "all", by: "points" | "effort") {
    const kids = (await dir.studentsOf(teacherId)).filter((k) => !k.archived);
    const profiles = await store.getProfiles(kids.map((k) => k.id));
    const rows = kids.map((k) => {
      const p = profileNow(profiles.get(k.id) ?? emptyHistoryProfile(), now());
      return { id: k.id, name: studentName(k.displayName), pts: period === "week" ? p.week_points : p.points, quizzes: period === "week" ? p.week_quizzes : p.quizzes, streak: p.streak, passedWeek: p.week_passed.length, avatar: p.avatar, rank: 0 };
    });
    const key = by === "effort" ? "quizzes" : "pts";
    rows.sort((a, b) => b[key] - a[key] || b.pts - a.pts || a.name.localeCompare(b.name));
    rows.forEach((r, i) => { r.rank = i + 1; });
    return rows;
  }
  async function weekRank(v: { id: number; teacherId: number | null; hasClass: boolean }): Promise<number | null> {
    if (!v.hasClass || !v.teacherId) return null;
    const row = (await boardFor(v.teacherId, "week", "points")).find((r) => r.id === v.id);
    return row && row.pts > 0 ? row.rank : null;
  }
  const profileOut = (p: HistoryProfile) => profileNow(p, now());

  /* ---------- catalog (public) */
  app.get("/api/history/catalog", (_req: any, res: any) => {
    res.set?.("Cache-Control", "public, max-age=300");
    res.json({
      bands: BANDS, reads: READS.map(readPublic), points: POINTS, pass: PASS, weeklyGoal: WEEKLY_GOAL, styles: STYLES, milestones: MILESTONES,
      achievements: ACHIEVEMENTS, certTitles: CERT_TITLES, limits: { customPerAssignment: LIMITS.customPerAssignment }, live: { questions: LIVE_QUESTIONS, seconds: LIVE_SECONDS },
    });
  });

  /* ---------- who am I */
  app.get("/api/history/me", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const teacher = v.role === "student" && v.teacherId ? await dir.user(v.teacherId) : null;
    const base = {
      user: { id: v.id, role: v.role, name: v.role === "student" ? studentName(v.displayName) : v.displayName, grade: v.grade, gradeBand: v.band, hasClass: v.hasClass, teacherName: teacher?.displayName ?? null },
      today: historyDay(now()), week: historyWeek(now()),
    };
    if (v.role !== "student") return res.json(base);
    const p = await store.getProfile(v.id);
    const band = bandFor(p, v);
    const rank = await weekRank(v);
    const s = v.hasClass && v.teacherId ? await settingsOf(v.teacherId) : null;
    res.json({ ...base, band, profile: profileOut(p), rank, achievements: earnedAchievements(profileNow(p, now()), band, rank), board: s ? { show: s.board_show, by: s.board_by } : null });
  }));

  /** Students change their band, avatar style or reading settings. */
  app.put("/api/history/me", auth, handle(async (req, res) => {
    const v = await viewer(req);
    if (v.role !== "student") return res.status(403).json({ message: "This is for student accounts." });
    const p = await store.getProfile(v.id);
    const b = req.body || {};
    if (b.band !== undefined) { if (b.band !== null && !isBand(b.band)) return res.status(400).json({ message: "Unknown grade band." }); p.band = b.band; }
    if (b.avatar !== undefined) {
      const st = STYLES.find((s) => s.id === b.avatar);
      if (!st) return res.status(400).json({ message: "Unknown avatar style." });
      if (p.points < st.at) return res.status(403).json({ message: `Reach ${st.at} points to unlock ${st.label}.` });
      p.avatar = st.id;
    }
    if (b.a11y && typeof b.a11y === "object") p.a11y = { read: !!b.a11y.read, big: !!b.a11y.big };
    await store.saveProfile(v.id, p);
    res.json({ profile: profileOut(p), band: bandFor(p, v) });
  }));

  /* ---------- quizzes (students) */
  function sessionOut(s: SessionRow) {
    const done = s.status === "done";
    return {
      id: s.id, title: s.title, kind: s.kind, readId: s.read_id, n: s.items.length, status: s.status, score: s.score, points: s.points,
      items: s.items.map((it, i) => ({ ...itemPublic(it), ...(done ? { a: it.a, why: it.why, pick: s.answers?.[i] ?? null } : {}) })),
    };
  }
  async function ownSession(req: any, v: Viewer) {
    const s = await store.getSession(String(req.params.id));
    return s && s.user_id === v.id ? s : null;
  }

  app.post("/api/history/quizzes", auth, handle(async (req, res) => {
    const v = await viewer(req);
    if (v.role !== "student") return res.status(403).json({ message: "Quizzes are for student accounts." });
    if (quizzesToday.retryAfter(String(v.id))) return res.status(429).json({ message: "That’s a lot of history for one day! Come back tomorrow for more quizzes." });
    const b = req.body || {};
    let qs: Question[] = [], title = "", kind: SessionRow["kind"] = "read", readId: string | null = null, assignmentId: string | null = null;
    if (b.type === "read") {
      const r = readById(b.readId);
      if (!r) return res.status(400).json({ message: "Pick a History Read." });
      qs = r.qs; title = r.title; readId = r.id;
    } else if (b.type === "assign") {
      const a = await store.getAssignment(String(b.assignmentId || ""));
      if (!a || !v.hasClass || a.teacher_id !== v.teacherId) return res.status(404).json({ message: "That assignment isn’t for your class." });
      kind = "assign"; assignmentId = a.id; title = a.title;
      if (a.kind === "read") { const r = readById(a.read_id); if (r) { qs = r.qs; readId = r.id; } }
      else qs = a.questions;
      if (!qs.length) return res.status(400).json({ message: "That assignment has no questions yet." });
    } else return res.status(400).json({ message: "Pick a quiz." });
    quizzesToday.fail(String(v.id));
    const s = await store.createSession({
      user_id: v.id, title, kind, read_id: readId, assignment_id: assignmentId, items: makeItems(qs, random),
      answers: null, score: null, points: 0, rank_before: await weekRank(v), status: "open",
    });
    res.status(201).json({ session: sessionOut(s) });
  }));

  app.get("/api/history/quizzes/:id", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const s = await ownSession(req, v);
    if (!s) return res.status(404).json({ message: "Quiz not found." });
    res.json({ session: sessionOut(s) });
  }));

  /** Turns in the whole quiz. The server grades it, awards points and certificates, and only then shows the answers. */
  app.post("/api/history/quizzes/:id/submit", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const s = await ownSession(req, v);
    if (!s) return res.status(404).json({ message: "Quiz not found." });
    if (s.status !== "open") return res.status(409).json({ message: "This quiz was already turned in." });
    const g = gradeQuiz(s.items, req.body?.answers);
    if (g.picks.some((x) => x === null)) return res.status(400).json({ message: "Answer every question before you turn it in." });
    const n = s.items.length, score = g.score, perfect = score === n, pass = passed(score, n);
    // A finished assignment counts once, under the assignment; a read counts under the read.
    const key = s.assignment_id ? `assign:${s.assignment_id}` : `read:${s.read_id}`;
    const p0 = await store.getProfile(v.id);
    const band = bandFor(p0, v);
    const before = earnedAchievements(profileNow(p0, now()), band, s.rank_before);
    let p = profileNow(p0, now());
    // An assigned read the student already took earns points only for beating their best on that read.
    const bests = [p.best[key], s.read_id ? p.best[`read:${s.read_id}`] : undefined].filter((x): x is number => x !== undefined);
    const prev = bests.length ? Math.max(...bests) : undefined;
    const gained = pointsFor(score, n, prev);
    p.points += gained; p.week_points += gained;
    p.best[key] = Math.max(p.best[key] ?? 0, score);
    // An assigned read also counts toward that read's best, so it shows as passed in the library.
    if (s.assignment_id && s.read_id) p.best[`read:${s.read_id}`] = Math.max(p.best[`read:${s.read_id}`] ?? 0, score);
    p.quizzes++; p.week_quizzes++; p.correct += score; p.answered += n;
    if (pass && !p.week_passed.includes(key)) p.week_passed.push(key);
    if (p.week_passed.length >= WEEKLY_GOAL) p.flags = { ...p.flags, goal: true };
    if (s.items.some((it, i) => it.t === "Source" && g.marks[i]) && !p.source_right.includes(key)) p.source_right.push(key);
    p = touchStreak(p, now());
    if (p.streak >= 5) p.flags = { ...p.flags, streak5: true };
    p.history = [{ d: shortDate(), title: s.title, score, of: n, pts: gained }, ...p.history].slice(0, LIMITS.history);
    const certs: { t: string; r: string; d: string; by: string }[] = [];
    if (perfect && (prev ?? 0) < n) certs.push({ t: "Perfect Score", r: `${s.title} quiz, ${score} of ${n}`, d: longDate(), by: "Arise History" });
    for (const m of MILESTONES) if (p.points >= m && !p.milestones.includes(m)) { p.milestones.push(m); certs.push({ t: `${m.toLocaleString("en-US")} History Points`, r: "Points milestone", d: longDate(), by: "Arise History" }); }
    if (certs.length) p.certs = [...certs.reverse(), ...p.certs].slice(0, LIMITS.certs);
    await store.saveProfile(v.id, p);
    if (s.assignment_id) await store.saveResult({ assignment_id: s.assignment_id, user_id: v.id, score, total: n });
    s.status = "done"; s.answers = g.picks; s.score = score; s.points = gained;
    await store.saveSession(s);
    const rank = await weekRank(v);
    const after = earnedAchievements(p, band, rank);
    res.json({
      session: sessionOut(s),
      result: { score, of: n, points: gained, perfect, passed: pass, improvedOnly: prev !== undefined, certs, rankBefore: s.rank_before, rank, weekPassed: p.week_passed.length, newAchievements: after.filter((a) => !before.includes(a)) },
      profile: profileOut(p),
    });
  }));

  /* ---------- leaderboard */
  app.get("/api/history/board", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const period = req.query?.period === "all" ? "all" : "week";
    let teacherId: number;
    if (v.role === "student") {
      if (!v.hasClass || !v.teacherId) return res.json({ board: null, reason: "Join a teacher’s class to see your class leaderboard." });
      teacherId = v.teacherId;
    } else if (isStaff(v)) teacherId = v.id;
    else return res.status(403).json({ message: "Parents see their child’s place on their Home page." });
    const s = await settingsOf(teacherId);
    if (v.role === "student" && !s.board_show) return res.json({ board: null, hidden: true, reason: "Your teacher turned off the leaderboard for now. Your points still count." });
    const rows = await boardFor(teacherId, period, s.board_by);
    const top = (key: "streak" | "quizzes" | "passedWeek") => { const r = [...rows].sort((a, b) => b[key] - a[key])[0]; return r && r[key] > 0 ? { name: r.name, value: r[key] } : null; };
    res.json({
      period, by: s.board_by, show: s.board_show,
      board: rows.map((r) => ({ ...(isStaff(v) ? { id: r.id } : {}), rank: r.rank, name: r.name, points: r.pts, quizzes: r.quizzes, streak: r.streak, avatar: r.avatar, me: r.id === v.id })),
      awards: { streak: top("streak"), quizzes: top("quizzes"), passed: top("passedWeek") },
    });
  }));

  /* ---------- teacher: class */
  async function ownStudent(v: Viewer, id: number) {
    if (!isStaff(v)) return null;
    const kids = await dir.studentsOf(v.id);
    return kids.find((k) => k.id === id && !k.archived) ?? null;
  }
  function studentRow(k: HistoryUser, raw: HistoryProfile, band: BandId) {
    const p = profileNow(raw, now()), day = historyDay(now());
    const acc = accuracy(p);
    const days = p.last_active ? Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${p.last_active}T12:00:00Z`)) / 86400_000) : null;
    let status: "new" | "check" | "ok" = "ok", reason: string | null = null;
    if (days === null) { status = "new"; reason = "Hasn’t taken a history quiz yet"; }
    else if (days >= 5) { status = "check"; reason = `No history quiz in ${days} days`; }
    else if (acc !== null && p.answered >= 10 && acc < 60) { status = "check"; reason = `${acc}% of answers right`; }
    const reads = readsFor(band).map((r) => ({ id: r.id, best: p.best[`read:${r.id}`] ?? null, of: r.qs.length }));
    return {
      id: k.id, name: studentName(k.displayName), points: p.points, weekPoints: p.week_points, quizzes: p.quizzes, weekQuizzes: p.week_quizzes,
      accuracy: acc, lastActive: p.last_active, daysAway: days, streak: p.streak, avatar: p.avatar, reads, status, reason,
    };
  }

  app.get("/api/history/class", auth, handle(async (req, res) => {
    const v = await viewer(req);
    if (!isStaff(v)) return res.status(403).json({ message: "Teachers only." });
    const kids = (await dir.studentsOf(v.id)).filter((k) => !k.archived);
    const band = await classBand(v.id, kids);
    const s = await settingsOf(v.id);
    const profiles = await store.getProfiles(kids.map((k) => k.id));
    const rows = kids.map((k) => studentRow(k, profiles.get(k.id) ?? emptyHistoryProfile(), band)).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
    const accs = rows.map((r) => r.accuracy).filter((a): a is number => a !== null);
    res.json({
      settings: { band, bandSaved: !!s.band, boardShow: s.board_show, boardBy: s.board_by },
      students: rows,
      totals: { students: rows.length, weekQuizzes: rows.reduce((a, r) => a + r.weekQuizzes, 0), check: rows.filter((r) => r.status === "check").length, accuracy: accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : null },
    });
  }));

  app.put("/api/history/class/settings", auth, handle(async (req, res) => {
    const v = await viewer(req);
    if (!isStaff(v)) return res.status(403).json({ message: "Teachers only." });
    const s = await settingsOf(v.id), b = req.body || {};
    if (b.band !== undefined) { if (!isBand(b.band)) return res.status(400).json({ message: "Unknown grade band." }); s.band = b.band; }
    if (b.boardShow !== undefined) s.board_show = !!b.boardShow;
    if (b.boardBy !== undefined) s.board_by = b.boardBy === "effort" ? "effort" : "points";
    await store.saveSettings(v.id, s);
    res.json({ settings: { band: s.band ?? (await classBand(v.id)), boardShow: s.board_show, boardBy: s.board_by } });
  }));

  app.get("/api/history/students/:id", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const k = await ownStudent(v, Number(req.params.id));
    if (!k) return res.status(404).json({ message: "That student isn’t in your class." });
    const band = await classBand(v.id);
    const p = await store.getProfile(k.id);
    res.json({ student: { ...studentRow(k, p, band), history: p.history.slice(0, 10), certs: p.certs.slice(0, 10) } });
  }));

  app.post("/api/history/students/:id/certificate", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const k = await ownStudent(v, Number(req.params.id));
    if (!k) return res.status(404).json({ message: "That student isn’t in your class." });
    const title = String(req.body?.title || "");
    if (!(CERT_TITLES as readonly string[]).includes(title)) return res.status(400).json({ message: "Pick a certificate." });
    const p = await store.getProfile(k.id);
    p.certs = [{ t: title, r: `Awarded by ${v.displayName}`, d: longDate(), by: v.displayName }, ...p.certs].slice(0, LIMITS.certs);
    await store.saveProfile(k.id, p);
    notify(k.id, `${v.displayName} sent you a ${title} certificate!`);
    res.json({ ok: true });
  }));

  /* ---------- assignments */
  const assignmentOut = (a: AssignmentRow) => ({ id: a.id, kind: a.kind, readId: a.read_id, title: a.title, note: a.note, due: a.due, band: a.band, questions: a.kind === "custom" ? a.questions.length : (readById(a.read_id)?.qs.length ?? 0), createdAt: a.created_at });

  app.get("/api/history/assignments", auth, handle(async (req, res) => {
    const v = await viewer(req);
    if (isStaff(v)) {
      const list = await store.assignmentsFor(v.id);
      const rs = await store.results(list.map((a) => a.id));
      const size = (await dir.studentsOf(v.id)).filter((k) => !k.archived).length;
      return res.json({ assignments: list.map((a) => { const mine = rs.filter((r) => r.assignment_id === a.id); return { ...assignmentOut(a), done: mine.length, avg: mine.length ? Math.round((100 * mine.reduce((x, r) => x + r.score / Math.max(1, r.total), 0)) / mine.length) : null, classSize: size }; }) });
    }
    if (v.role === "student") {
      if (!v.hasClass || !v.teacherId) return res.json({ assignments: [] });
      const recent = historyDay(now() - 14 * 86400_000);
      const list = (await store.assignmentsFor(v.teacherId)).filter((a) => a.due >= recent);
      const rs = (await store.results(list.map((a) => a.id))).filter((r) => r.user_id === v.id);
      return res.json({ assignments: list.map((a) => { const r = rs.find((x) => x.assignment_id === a.id); return { ...assignmentOut(a), myScore: r ? r.score : null, myOf: r ? r.total : null }; }) });
    }
    res.status(403).json({ message: "Students and teachers only." });
  }));

  app.post("/api/history/assignments", auth, handle(async (req, res) => {
    const v = await viewer(req);
    if (!isStaff(v)) return res.status(403).json({ message: "Teachers only." });
    const b = req.body || {};
    if (!isDay(b.due) || String(b.due) < historyDay(now())) return res.status(400).json({ message: "Pick a due date that hasn’t passed." });
    const band = await classBand(v.id);
    let row: Omit<AssignmentRow, "id" | "created_at">;
    if (b.kind === "read") {
      const r = readById(b.readId);
      if (!r) return res.status(400).json({ message: "Pick a History Read." });
      row = { teacher_id: v.id, kind: "read", read_id: r.id, title: r.title, note: "", due: String(b.due), band, questions: [] };
    } else if (b.kind === "custom") {
      const questions = (Array.isArray(b.questions) ? b.questions : []).slice(0, LIMITS.customPerAssignment).map(cleanCustom).filter((q: Question | null): q is Question => !!q);
      if (!questions.length) return res.status(400).json({ message: "Add at least one question with two or more different choices." });
      const title = String(b.title ?? "").replace(/\s+/g, " ").trim().slice(0, 80) || "Questions from class";
      const note = String(b.note ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
      row = { teacher_id: v.id, kind: "custom", read_id: null, title, note, due: String(b.due), band, questions };
    } else return res.status(400).json({ message: "Pick a History Read or write your own questions." });
    const a = await store.createAssignment(row);
    for (const k of await dir.studentsOf(v.id)) if (!k.archived) notify(k.id, `New history assignment: ${a.title}`);
    res.status(201).json({ assignment: assignmentOut(a) });
  }));

  app.delete("/api/history/assignments/:id", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const a = await store.getAssignment(String(req.params.id));
    if (!a || !(a.teacher_id === v.id && isStaff(v))) return res.status(404).json({ message: "Assignment not found." });
    await store.deleteAssignment(a.id);
    res.json({ ok: true });
  }));

  /* ---------- parents */
  app.get("/api/history/children", auth, handle(async (req, res) => {
    const v = await viewer(req);
    if (v.role !== "parent") return res.status(403).json({ message: "Parent accounts only." });
    const ids = await dir.childrenOf(v.id);
    const kids = (await Promise.all(ids.map((id) => dir.user(id)))).filter((u): u is HistoryUser => !!u && u.role === "student" && !u.archived);
    const profiles = await store.getProfiles(kids.map((k) => k.id));
    const out = [];
    for (const k of kids) {
      const grade = await dir.gradeOf(k.id).catch(() => null);
      const hasClass = !!k.teacherId && k.approvedByTeacher;
      const raw = profiles.get(k.id) ?? emptyHistoryProfile();
      const p = profileNow(raw, now());
      const band = p.band ?? (bandForGrade(grade) as BandId);
      const teacher = hasClass ? await dir.user(k.teacherId!) : null;
      const rank = await weekRank({ id: k.id, teacherId: k.teacherId, hasClass });
      const size = hasClass ? (await dir.studentsOf(k.teacherId!)).filter((x) => !x.archived).length : 0;
      out.push({
        id: k.id, name: studentName(k.displayName), firstName: k.displayName.split(/\s+/)[0] || "Your child", grade, band, hasClass, teacherName: teacher?.displayName ?? null,
        profile: profileOut(raw), accuracy: accuracy(p), reads: readsFor(band).map((r) => ({ id: r.id, best: p.best[`read:${r.id}`] ?? null, of: r.qs.length })),
        rank, classSize: size, achievements: earnedAchievements(p, band, rank),
      });
    }
    res.json({ children: out });
  }));

  /* ---------- live review */
  const code6 = () => String(Math.floor(random() * 900000) + 100000);
  /** A question from the class's band that this game hasn't used yet. */
  function liveQuestion(band: BandId, used: string[]): { item: Item; key: string } {
    const pool = readsFor(band).flatMap((r) => r.qs.map((q, i) => ({ key: `${r.id}:${i}`, q })));
    const fresh = pool.filter((x) => !used.includes(x.key));
    const list = fresh.length ? fresh : pool;
    const pick = list[Math.floor(random() * list.length) % list.length];
    return { item: makeItems([pick.q], random)[0], key: pick.key };
  }
  /** Moves a question to "reveal" once time runs out or everyone has answered. */
  async function settle(g: LiveRow, ps?: PlayerRow[]) {
    if (g.phase !== "q") return g;
    const list = ps ?? (await store.players(g.id));
    const allIn = list.length > 0 && list.every((p) => p.answered_qi === g.qi);
    if (allIn || (g.q_ends_at && Date.parse(g.q_ends_at) <= now())) { g.phase = "reveal"; await store.saveLive(g); }
    return g;
  }
  const questionOut = (q: Item, withAnswer: boolean) => ({ ...itemPublic(q), a: withAnswer ? q.a : null, why: withAnswer ? q.why : null });
  async function liveOut(g: LiveRow) {
    const ps = await store.players(g.id);
    await settle(g, ps);
    const reveal = g.phase === "reveal" || g.phase === "done";
    const counts = g.question ? g.question.o.map((_, i) => ps.filter((p) => p.answered_qi === g.qi && p.answer === i).length) : [];
    return {
      id: g.id, code: g.code, band: g.band, phase: g.phase, qi: g.qi, total: LIVE_QUESTIONS, endsAt: g.q_ends_at, serverNow: now(),
      question: g.question && g.phase !== "lobby" ? questionOut(g.question, reveal) : null, counts,
      answered: ps.filter((p) => p.answered_qi === g.qi).length,
      players: ps.map((p) => ({ name: p.name, score: p.score })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
    };
  }
  async function ownGame(req: any, v: Viewer) {
    const g = await store.getLive(String(req.params.id));
    return g && isStaff(v) && g.teacher_id === v.id ? g : null;
  }

  app.post("/api/history/live", auth, handle(async (req, res) => {
    const v = await viewer(req);
    if (!isStaff(v)) return res.status(403).json({ message: "Teachers start live games." });
    const old = await store.liveOf(v.id);
    if (old) { old.phase = "ended"; await store.saveLive(old); }
    let code = code6();
    for (let i = 0; i < 6 && (await store.liveByCode(code)); i++) code = code6();
    const g = await store.createLive({ teacher_id: v.id, code, band: await classBand(v.id), phase: "lobby", qi: 0, question: null, used: [], q_ends_at: null });
    res.status(201).json({ game: await liveOut(g) });
  }));

  app.get("/api/history/live/current", auth, handle(async (req, res) => {
    const v = await viewer(req);
    if (!isStaff(v)) return res.status(403).json({ message: "Teachers only." });
    const g = await store.liveOf(v.id);
    res.json({ game: g ? await liveOut(g) : null });
  }));

  app.post("/api/history/live/join", auth, handle(async (req, res) => {
    const v = await viewer(req);
    if (v.role !== "student") return res.status(403).json({ message: "Students join live games." });
    if (joinTries.retryAfter(String(v.id))) return res.status(429).json({ message: "Too many tries. Wait a few minutes, then check the code on the board." });
    const code = String(req.body?.code || "").replace(/\D/g, "");
    const g = code.length === 6 ? await store.liveByCode(code) : null;
    if (!g || !v.hasClass || g.teacher_id !== v.teacherId) { joinTries.fail(String(v.id)); return res.status(404).json({ message: "That code doesn’t match a live game for your class. Check the code on the board." }); }
    const existing = (await store.players(g.id)).find((p) => p.user_id === v.id);
    if (!existing) await store.savePlayer({ game_id: g.id, user_id: v.id, name: studentName(v.displayName), score: 0, answer: null, answered_qi: 0 });
    const p = await store.getProfile(v.id);
    if (!p.flags.live) { p.flags = { ...p.flags, live: true }; await store.saveProfile(v.id, p); }
    res.json({ gameId: g.id });
  }));

  app.get("/api/history/live/:id", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const g = await ownGame(req, v);
    if (!g) return res.status(404).json({ message: "Game not found." });
    res.json({ game: await liveOut(g) });
  }));

  app.post("/api/history/live/:id/next", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const g = await ownGame(req, v);
    if (!g || !OPEN_PHASES.includes(g.phase)) return res.status(404).json({ message: "Game not found." });
    if (g.phase === "q") g.phase = "reveal";
    else if (g.phase === "reveal" && g.qi >= LIVE_QUESTIONS) g.phase = "done";
    else {
      if (g.phase === "lobby" && !(await store.players(g.id)).length) return res.status(400).json({ message: "Wait for at least one student to join." });
      const next = liveQuestion(g.band, g.used || []);
      g.qi++; g.question = next.item; g.used = [...(g.used || []), next.key]; g.phase = "q"; g.q_ends_at = new Date(now() + LIVE_SECONDS * 1000).toISOString();
    }
    await store.saveLive(g);
    res.json({ game: await liveOut(g) });
  }));

  app.delete("/api/history/live/:id", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const g = await ownGame(req, v);
    if (!g) return res.status(404).json({ message: "Game not found." });
    g.phase = "ended";
    await store.saveLive(g);
    res.json({ ok: true });
  }));

  async function joined(req: any, v: Viewer) {
    const g = await store.getLive(String(req.params.id));
    if (!g || v.role !== "student") return null;
    const me = (await store.players(g.id)).find((p) => p.user_id === v.id);
    return me ? { g, me } : null;
  }

  app.get("/api/history/live/:id/play", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const j = await joined(req, v);
    if (!j) return res.status(404).json({ message: "Game not found." });
    const g = await settle(j.g);
    const reveal = g.phase === "reveal" || g.phase === "done";
    const answered = j.me.answered_qi === g.qi && g.qi > 0;
    const ps = await store.players(g.id);
    const ranked = ps.sort((a, b) => b.score - a.score);
    res.json({
      game: {
        phase: g.phase, qi: g.qi, total: LIVE_QUESTIONS, endsAt: g.q_ends_at, serverNow: now(),
        question: g.question && (g.phase === "q" || g.phase === "reveal") ? questionOut(g.question, reveal) : null,
        myAnswer: answered ? j.me.answer : null, myRight: reveal && answered && g.question ? j.me.answer === g.question.a : null,
        myScore: ranked.find((p) => p.user_id === v.id)?.score ?? 0, myRank: ranked.findIndex((p) => p.user_id === v.id) + 1, players: ps.length,
      },
    });
  }));

  app.post("/api/history/live/:id/answer", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const j = await joined(req, v);
    if (!j) return res.status(404).json({ message: "Game not found." });
    const g = await settle(j.g);
    if (g.phase !== "q" || !g.question) return res.status(409).json({ message: "Time’s up for this question." });
    if (j.me.answered_qi === g.qi) return res.status(409).json({ message: "You already answered this one." });
    const value = Number(req.body?.value);
    if (!Number.isInteger(value) || value < 0 || value >= g.question.o.length) return res.status(400).json({ message: "Pick one of the answers." });
    await store.savePlayer({ ...j.me, answer: value, answered_qi: g.qi, score: j.me.score + (value === g.question.a ? 1 : 0) });
    res.json({ ok: true });
  }));
}
