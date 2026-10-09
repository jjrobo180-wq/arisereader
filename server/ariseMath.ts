// Arise Math (/math/): K–12 math practice built like A.R.I.S.E. Reader. Students take quizzes and
// earn points on a class leaderboard; teachers see their class, assign practice, send certificates and
// run live review games; parents follow each linked child.
//
// Rules kept here, on the server:
// - Accounts are the regular A.R.I.S.E. Reader accounts. Students show as "First L." to classmates.
// - The server makes and grades every question. Answers and solution steps reach the page only once
//   earned (after a hint, or when the question is finished), so points can't be faked.
// - A class is a teacher and their approved students. Students see only their own class's leaderboard,
//   assignments and live games. Teachers see only their own students; parents only their linked children.
// - Math points are separate from reading points, so they don't change reading competitions or prizes.
// Tables: migrations/arise_math.sql.
import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { createAttemptLimiter } from "./attemptLimiter";
import { bandForGrade } from "../shared/ariseSocial";
import {
  ACHIEVEMENTS, BANDS, CERT_TITLES, DAILY_GOAL, LEVEL_POINTS, LEVELS, LIMITS, MILESTONES, POINTS, SKILLS, STYLES,
  accuracy, addPoints, cleanCustom, cleanMathProfile, customProblem, earnedAchievements, emptyMathProfile, isBand, isRight, isSkill,
  makeProblem, mathDay, mathWeek, parseAnswer, profileNow, strength, touchStreak,
  type BandId, type CustomQuestion, type MathProfile, type Problem, type Rng, type SkillId,
} from "../shared/ariseMath";

export type MathRole = "student" | "teacher" | "parent" | "admin";
export type MathUser = { id: number; role: MathRole; displayName: string; teacherId: number | null; schoolId: number | null; approvedByTeacher: boolean; archived: boolean };

export type ItemState = Problem & { tries: number; hints: number; done: boolean; result: "first" | "solved" | "missed" | null; wrong: string[] };
export type SessionRow = {
  id: string; user_id: number; title: string; kind: "skill" | "mixed" | "assign"; skill: string | null; assignment_id: string | null;
  items: ItemState[]; cur: number; points: number; hints_any: boolean; rank_before: number | null; status: "open" | "done"; created_at: string;
};
export type ClassSettings = { band: BandId | null; board_show: boolean; board_by: "points" | "effort" };
export type AssignmentRow = {
  id: string; teacher_id: number; skill: string; n: number; due: string; title: string; band: BandId; questions: CustomQuestion[]; created_at: string;
};
export type ResultRow = { assignment_id: string; user_id: number; score: number; total: number };
export type LiveRow = {
  id: string; teacher_id: number; code: string; band: BandId; phase: "lobby" | "q" | "reveal" | "done" | "ended";
  qi: number; question: Problem | null; q_ends_at: string | null; created_at: string;
};
export type PlayerRow = { game_id: string; user_id: number; name: string; score: number; answer: string | null; answered_qi: number };

export interface MathStore {
  getProfile(userId: number): Promise<MathProfile>;
  getProfiles(userIds: number[]): Promise<Map<number, MathProfile>>;
  saveProfile(userId: number, p: MathProfile): Promise<void>;
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
/** Thrown when migrations/arise_math.sql has not been run yet. */
export class MathNotSetUp extends Error {}
const isMissingTable = (error: any) => error?.code === "42P01" || error?.code === "PGRST205" || /could not find the table|does not exist/i.test(String(error?.message || ""));
const OPEN_PHASES = ["lobby", "q", "reveal"];

export function createSupabaseMathStore(client?: any): MathStore {
  const db = async () => client ?? (await loadDb());
  const fail = (error: any) => {
    if (!error) return;
    if (isMissingTable(error)) throw new MathNotSetUp(String(error.message));
    throw error;
  };
  const stamp = () => new Date().toISOString();
  return {
    async getProfile(userId) {
      const r = await (await db()).from("math_profiles").select("data").eq("user_id", userId).maybeSingle();
      fail(r.error);
      return cleanMathProfile(r.data?.data);
    },
    async getProfiles(userIds) {
      const out = new Map<number, MathProfile>();
      if (!userIds.length) return out;
      const r = await (await db()).from("math_profiles").select("user_id, data").in("user_id", userIds);
      fail(r.error);
      for (const row of r.data || []) out.set(Number(row.user_id), cleanMathProfile(row.data));
      return out;
    },
    async saveProfile(userId, p) {
      fail((await (await db()).from("math_profiles").upsert({ user_id: userId, data: p, points: p.points, updated_at: stamp() }, { onConflict: "user_id" })).error);
    },
    async createSession(row) {
      const r = await (await db()).from("math_sessions").insert(row).select("*").single();
      fail(r.error);
      return r.data as SessionRow;
    },
    async getSession(id) {
      const r = await (await db()).from("math_sessions").select("*").eq("id", id).maybeSingle();
      fail(r.error);
      return (r.data as SessionRow) || null;
    },
    async saveSession(row) {
      const { id, created_at: _c, ...rest } = row;
      fail((await (await db()).from("math_sessions").update({ ...rest, updated_at: stamp() }).eq("id", id)).error);
    },
    async getSettings(teacherId) {
      const r = await (await db()).from("math_class_settings").select("*").eq("teacher_id", teacherId).maybeSingle();
      fail(r.error);
      if (!r.data) return null;
      return { band: isBand(r.data.band) ? r.data.band : null, board_show: r.data.board_show !== false, board_by: r.data.board_by === "effort" ? "effort" : "points" };
    },
    async saveSettings(teacherId, s) {
      fail((await (await db()).from("math_class_settings").upsert({ teacher_id: teacherId, ...s, updated_at: stamp() }, { onConflict: "teacher_id" })).error);
    },
    async assignmentsFor(teacherId) {
      const r = await (await db()).from("math_assignments").select("*").eq("teacher_id", teacherId).order("created_at", { ascending: false }).limit(30);
      fail(r.error);
      return (r.data || []) as AssignmentRow[];
    },
    async getAssignment(id) {
      const r = await (await db()).from("math_assignments").select("*").eq("id", id).maybeSingle();
      fail(r.error);
      return (r.data as AssignmentRow) || null;
    },
    async createAssignment(row) {
      const r = await (await db()).from("math_assignments").insert(row).select("*").single();
      fail(r.error);
      return r.data as AssignmentRow;
    },
    async deleteAssignment(id) { fail((await (await db()).from("math_assignments").delete().eq("id", id)).error); },
    async results(ids) {
      if (!ids.length) return [];
      const r = await (await db()).from("math_assignment_results").select("assignment_id, user_id, score, total").in("assignment_id", ids);
      fail(r.error);
      return (r.data || []) as ResultRow[];
    },
    async saveResult(row) {
      fail((await (await db()).from("math_assignment_results").upsert({ ...row, finished_at: stamp() }, { onConflict: "assignment_id,user_id" })).error);
    },
    async createLive(row) {
      const r = await (await db()).from("math_live_games").insert(row).select("*").single();
      fail(r.error);
      return r.data as LiveRow;
    },
    async getLive(id) {
      const r = await (await db()).from("math_live_games").select("*").eq("id", id).maybeSingle();
      fail(r.error);
      return (r.data as LiveRow) || null;
    },
    async liveByCode(code) {
      const r = await (await db()).from("math_live_games").select("*").eq("code", code).in("phase", OPEN_PHASES).order("created_at", { ascending: false }).limit(1);
      fail(r.error);
      return ((r.data || [])[0] as LiveRow) || null;
    },
    async liveOf(teacherId) {
      const r = await (await db()).from("math_live_games").select("*").eq("teacher_id", teacherId).in("phase", OPEN_PHASES).order("created_at", { ascending: false }).limit(1);
      fail(r.error);
      return ((r.data || [])[0] as LiveRow) || null;
    },
    async saveLive(row) {
      const { id, created_at: _c, ...rest } = row;
      fail((await (await db()).from("math_live_games").update({ ...rest, updated_at: stamp() }).eq("id", id)).error);
    },
    async players(gameId) {
      const r = await (await db()).from("math_live_players").select("game_id, user_id, name, score, answer, answered_qi").eq("game_id", gameId);
      fail(r.error);
      return (r.data || []) as PlayerRow[];
    },
    async savePlayer(row) {
      fail((await (await db()).from("math_live_players").upsert(row, { onConflict: "game_id,user_id" })).error);
    },
  };
}

/** In-memory store for tests. */
export function createMemoryMathStore(now: () => number = Date.now): MathStore {
  const profiles = new Map<number, MathProfile>();
  const sessions = new Map<string, SessionRow>();
  const settings = new Map<number, ClassSettings>();
  const assignments: AssignmentRow[] = [];
  const results: ResultRow[] = [];
  const games = new Map<string, LiveRow>();
  const players: PlayerRow[] = [];
  const iso = () => new Date(now()).toISOString();
  const c = <T,>(v: T): T => structuredClone(v);
  return {
    async getProfile(id) { return c(profiles.get(id) ?? emptyMathProfile()); },
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
const roleOf = (raw: any): MathRole => (raw?.isAdmin ? "admin" : raw?.role === "teacher" ? "teacher" : raw?.role === "parent" ? "parent" : "student");
const isDay = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));
const LIVE_QUESTIONS = 5;
const LIVE_SECONDS = 20;

export type MathDirectory = {
  user(id: number): Promise<MathUser | null>;
  /** The grade a student gave at sign-up ("K", "3", "11"...), if any. */
  gradeOf(id: number): Promise<string | null>;
  /** A teacher's approved, active students. */
  studentsOf(teacherId: number): Promise<MathUser[]>;
  childrenOf(parentId: number): Promise<number[]>;
  notify?(userId: number, message: { title: string; body: string; url?: string }): Promise<unknown>;
};
export type MathDeps = { store?: MathStore; directory: MathDirectory; now?: () => number; random?: Rng };

/* ------------------------------------------------------------------ routes */

export function registerAriseMathRoutes(app: Express, auth: RequestHandler, deps: MathDeps) {
  const store = deps.store ?? createSupabaseMathStore();
  const dir = deps.directory;
  const now = deps.now ?? Date.now;
  const random = deps.random ?? Math.random;
  const quizzesToday = createAttemptLimiter({ max: LIMITS.quizzesPerDay, windowMs: 24 * 3600_000, now });
  const joinTries = createAttemptLimiter({ max: 12, windowMs: 10 * 60_000, now });
  const notify = (id: number, body: string) => { dir.notify?.(id, { title: "Arise Math", body, url: "/math/" })?.catch?.(() => {}); };
  const shortDate = () => new Date(now()).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Denver" });
  const longDate = () => new Date(now()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Denver" });

  type Viewer = MathUser & { grade: string | null; band: BandId; hasClass: boolean };
  /** The signed-in account as Arise Math sees it (an admin previewing as a student counts as that student). */
  async function viewer(req: any): Promise<Viewer> {
    const raw = req.user || {};
    const role: MathRole = req.adminPreview ? "student" : roleOf(raw);
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
      if (error instanceof MathNotSetUp) return res.status(503).json({ message: "Arise Math is still being set up. Please check back soon.", setup: true });
      console.error("[arise-math]", error?.message || error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  };
  const isStaff = (v: Viewer) => v.role === "teacher" || v.role === "admin";

  /** The band a student practices: their own pick, or the one their grade puts them in. */
  const bandFor = (p: MathProfile, v: { band: BandId }) => p.band ?? v.band;
  /** The band a teacher's class practices: their saved pick, or the most common band among their students. */
  async function classBand(teacherId: number, kids?: MathUser[]): Promise<BandId> {
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
      const p = profileNow(profiles.get(k.id) ?? emptyMathProfile(), now());
      return { id: k.id, name: studentName(k.displayName), pts: period === "week" ? p.week_points : p.points, quizzes: period === "week" ? p.week_quizzes : p.quizzes, streak: p.streak, first: p.week_first, weekQuizzes: p.week_quizzes, avatar: p.avatar, rank: 0 };
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
  function profileOut(p: MathProfile) {
    const q = profileNow(p, now());
    return { ...q, level: Math.floor(q.points / LEVEL_POINTS) };
  }

  /* ---------- catalog (public) */
  app.get("/api/math/catalog", (_req: any, res: any) => {
    res.set?.("Cache-Control", "public, max-age=300");
    res.json({
      bands: BANDS, skills: Object.fromEntries(Object.entries(SKILLS).map(([id, s]) => [id, { name: s.name, std: s.std, glyph: s.glyph, c: s.c, band: s.band }])),
      points: POINTS, levels: LEVELS, levelPoints: LEVEL_POINTS, dailyGoal: DAILY_GOAL, styles: STYLES, milestones: MILESTONES, achievements: ACHIEVEMENTS,
      certTitles: CERT_TITLES, limits: { quizLength: LIMITS.quizLength, customPerAssignment: LIMITS.customPerAssignment }, live: { questions: LIVE_QUESTIONS, seconds: LIVE_SECONDS },
    });
  });

  /* ---------- who am I */
  app.get("/api/math/me", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const teacher = v.role === "student" && v.teacherId ? await dir.user(v.teacherId) : null;
    const base = {
      user: { id: v.id, role: v.role, name: v.role === "student" ? studentName(v.displayName) : v.displayName, grade: v.grade, gradeBand: v.band, hasClass: v.hasClass, teacherName: teacher?.displayName ?? null },
      today: mathDay(now()), week: mathWeek(now()),
    };
    if (v.role !== "student") return res.json(base);
    const p = await store.getProfile(v.id);
    const band = bandFor(p, v);
    const rank = await weekRank(v);
    const s = v.hasClass && v.teacherId ? await settingsOf(v.teacherId) : null;
    res.json({ ...base, band, profile: profileOut(p), rank, achievements: earnedAchievements(profileNow(p, now()), band, rank), board: s ? { show: s.board_show, by: s.board_by } : null });
  }));

  /** Students change their band, avatar style or ways to answer. */
  app.put("/api/math/me", auth, handle(async (req, res) => {
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
    if (b.a11y && typeof b.a11y === "object") p.a11y = { choices: !!b.a11y.choices, read: !!b.a11y.read, big: !!b.a11y.big };
    await store.saveProfile(v.id, p);
    res.json({ profile: profileOut(p), band: bandFor(p, v) });
  }));

  /* ---------- quizzes (students) */
  function itemOut(it: ItemState) {
    const shown = it.done ? it.steps.length : Math.min(it.hints, it.steps.length);
    return {
      skill: it.skill, ask: it.ask, prompt: it.prompt, viz: it.viz, long: it.long, kind: it.kind, choices: it.choices,
      tries: it.tries, hints: it.hints, done: it.done, result: it.result, wrong: it.wrong,
      steps: it.steps.slice(0, shown), stepsTotal: it.steps.length, answer: it.done ? String(it.answer) : null,
    };
  }
  function sessionOut(s: SessionRow) {
    return { id: s.id, title: s.title, n: s.items.length, i: s.cur, points: s.points, status: s.status, results: s.items.map((x) => x.result), item: itemOut(s.items[Math.min(s.cur, s.items.length - 1)]) };
  }
  async function ownSession(req: any, v: Viewer) {
    const s = await store.getSession(String(req.params.id));
    return s && s.user_id === v.id ? s : null;
  }

  app.post("/api/math/quizzes", auth, handle(async (req, res) => {
    const v = await viewer(req);
    if (v.role !== "student") return res.status(403).json({ message: "Quizzes are for student accounts." });
    if (quizzesToday.retryAfter(String(v.id))) return res.status(429).json({ message: "That’s a lot of math for one day! Come back tomorrow for more quizzes." });
    const b = req.body || {};
    const p = profileNow(await store.getProfile(v.id), now());
    let items: Problem[] = [], title = "", kind: SessionRow["kind"] = "skill", skill: string | null = null, assignmentId: string | null = null;
    const mixed = (band: BandId, n: number) => {
      const ids = BANDS[band].skills;
      return Array.from({ length: n }, () => {
        const w = ids.map((k) => { const m = p.mastery[k]; return !m || !m.t ? 1.5 : 1.6 - m.r / m.t; });
        let t = random() * w.reduce((a, c) => a + c, 0), pickId = ids[0];
        for (let i = 0; i < ids.length; i++) { t -= w[i]; if (t <= 0) { pickId = ids[i]; break; } }
        return makeProblem(pickId, random);
      });
    };
    if (b.type === "skill") {
      if (!isSkill(b.skill)) return res.status(400).json({ message: "Pick a skill." });
      skill = b.skill; title = SKILLS[b.skill as SkillId].name;
      items = Array.from({ length: 5 }, () => makeProblem(b.skill, random));
    } else if (b.type === "mixed") {
      const band = isBand(b.band) ? b.band : bandFor(p, v);
      kind = "mixed"; title = "Mixed review"; items = mixed(band, 5);
    } else if (b.type === "assign") {
      const a = await store.getAssignment(String(b.assignmentId || ""));
      if (!a || !v.hasClass || a.teacher_id !== v.teacherId) return res.status(404).json({ message: "That assignment isn’t for your class." });
      kind = "assign"; assignmentId = a.id; title = a.title; skill = a.skill;
      if (a.skill === "custom") items = Array.from({ length: a.n }, (_, i) => customProblem(a.questions[i % a.questions.length], random));
      else if (a.skill === "mixed") items = mixed(a.band, a.n);
      else if (isSkill(a.skill)) items = Array.from({ length: a.n }, () => makeProblem(a.skill as SkillId, random));
      if (!items.length) return res.status(400).json({ message: "That assignment has no questions yet." });
    } else return res.status(400).json({ message: "Pick a quiz." });
    quizzesToday.fail(String(v.id));
    const s = await store.createSession({
      user_id: v.id, title, kind, skill, assignment_id: assignmentId, cur: 0, points: 0, hints_any: false, status: "open",
      rank_before: await weekRank(v), items: items.map((it) => ({ ...it, tries: 0, hints: 0, done: false, result: null, wrong: [] })),
    });
    res.status(201).json({ session: sessionOut(s) });
  }));

  app.get("/api/math/quizzes/:id", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const s = await ownSession(req, v);
    if (!s) return res.status(404).json({ message: "Quiz not found." });
    res.json({ session: sessionOut(s) });
  }));

  app.post("/api/math/quizzes/:id/hint", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const s = await ownSession(req, v);
    if (!s || s.status !== "open") return res.status(404).json({ message: "Quiz not found." });
    const it = s.items[s.cur];
    if (!it.done && it.hints < it.steps.length) { it.hints++; s.hints_any = true; await store.saveSession(s); }
    res.json({ session: sessionOut(s) });
  }));

  app.post("/api/math/quizzes/:id/answer", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const s = await ownSession(req, v);
    if (!s || s.status !== "open") return res.status(404).json({ message: "Quiz not found." });
    const it = s.items[s.cur];
    if (it.done) return res.json({ session: sessionOut(s) });
    const value = String(req.body?.value ?? "").slice(0, 24);
    if (it.kind === "num" && !Number.isFinite(parseAnswer(value))) return res.status(400).json({ message: "Type a number, like 12, −3, or 3/4." });
    it.tries++;
    const ok = isRight(it, value);
    let gained = 0;
    const p = await store.getProfile(v.id);
    const m = it.skill !== "custom" ? (p.mastery[it.skill] ||= { r: 0, t: 0 }) : null;
    if (ok) {
      const first = it.tries === 1 && it.hints === 0;
      gained = first ? POINTS.firstTry : POINTS.withHelp;
      it.done = true; it.result = first ? "first" : "solved";
      if (m) { m.t++; m.r += first ? 1 : 0.5; }
      s.points += gained;
      await store.saveProfile(v.id, addPoints(p, gained, first, now()));
    } else {
      if (!it.wrong.includes(value)) it.wrong.push(value);
      if (it.tries >= 2) { it.done = true; it.result = "missed"; if (m) m.t++; await store.saveProfile(v.id, p); }
    }
    await store.saveSession(s);
    res.json({ session: sessionOut(s), correct: ok, gained });
  }));

  app.post("/api/math/quizzes/:id/next", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const s = await ownSession(req, v);
    if (!s || s.status !== "open") return res.status(404).json({ message: "Quiz not found." });
    if (!s.items[s.cur].done) return res.status(400).json({ message: "Answer this question first." });
    if (s.cur + 1 < s.items.length) { s.cur++; await store.saveSession(s); return res.json({ session: sessionOut(s) }); }
    // Finish: bonus, streak, history, certificate, assignment result.
    const p0 = await store.getProfile(v.id);
    const band = bandFor(p0, v);
    const before = earnedAchievements(profileNow(p0, now()), band, s.rank_before);
    let p = profileNow(p0, now());
    const score = s.items.filter((x) => x.result !== "missed").length, n = s.items.length, perfect = score === n;
    if (perfect) { s.points += POINTS.perfectBonus; p.points += POINTS.perfectBonus; p.week_points += POINTS.perfectBonus; }
    p = touchStreak(p, now());
    p.quizzes++; p.week_quizzes++; p.day_quizzes++;
    if (s.items.every((x) => x.result === "first") && !s.hints_any) p.flags = { ...p.flags, solo: true };
    if (s.skill && isSkill(s.skill) && n === 5 && score > (p.best[s.skill] ?? -1)) p.best[s.skill] = score;
    p.history = [{ d: shortDate(), title: s.title, score, of: n, pts: s.points }, ...p.history].slice(0, LIMITS.history);
    let cert = null;
    if (perfect) { cert = { t: "Perfect Score", r: `${s.title} quiz, ${score} of ${n}`, d: longDate(), by: "Arise Math" }; p.certs = [cert, ...p.certs].slice(0, LIMITS.certs); }
    await store.saveProfile(v.id, p);
    if (s.assignment_id) await store.saveResult({ assignment_id: s.assignment_id, user_id: v.id, score, total: n });
    s.status = "done";
    await store.saveSession(s);
    const rank = await weekRank(v);
    const after = earnedAchievements(p, band, rank);
    res.json({ session: sessionOut(s), result: { score, of: n, points: s.points, perfect, cert, rankBefore: s.rank_before, rank, newAchievements: after.filter((a) => !before.includes(a)) }, profile: profileOut(p) });
  }));

  /* ---------- leaderboard */
  app.get("/api/math/board", auth, handle(async (req, res) => {
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
    const top = (key: "streak" | "weekQuizzes" | "first") => { const r = [...rows].sort((a, b) => b[key] - a[key])[0]; return r && r[key] > 0 ? { name: r.name, value: r[key] } : null; };
    res.json({
      period, by: s.board_by, show: s.board_show,
      board: rows.map((r) => ({ ...(isStaff(v) ? { id: r.id } : {}), rank: r.rank, name: r.name, points: r.pts, quizzes: r.quizzes, streak: r.streak, avatar: r.avatar, me: r.id === v.id })),
      awards: { streak: top("streak"), quizzes: top("weekQuizzes"), firstTry: top("first") },
    });
  }));

  /* ---------- teacher: class */
  async function ownStudent(v: Viewer, id: number) {
    if (!isStaff(v)) return null;
    const kids = await dir.studentsOf(v.id);
    return kids.find((k) => k.id === id && !k.archived) ?? null;
  }
  function studentRow(k: MathUser, raw: MathProfile, band: BandId) {
    const p = profileNow(raw, now()), day = mathDay(now());
    const acc = accuracy(p.mastery), tried = Object.values(p.mastery).reduce((a, m) => a + m.t, 0);
    const days = p.last_active ? Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${p.last_active}T12:00:00Z`)) / 86400_000) : null;
    let status: "new" | "check" | "ok" = "ok", reason: string | null = null;
    if (days === null) { status = "new"; reason = "Hasn’t taken a math quiz yet"; }
    else if (days >= 5) { status = "check"; reason = `No math practice in ${days} days`; }
    else if (acc !== null && tried >= 10 && acc < 60) { status = "check"; reason = `${acc}% first-try accuracy`; }
    return {
      id: k.id, name: studentName(k.displayName), points: p.points, weekPoints: p.week_points, quizzes: p.quizzes, weekQuizzes: p.week_quizzes,
      accuracy: acc, lastActive: p.last_active, daysAway: days, streak: p.streak, avatar: p.avatar,
      skills: BANDS[band].skills.map((s) => strength(p.mastery, s)), status, reason,
    };
  }

  app.get("/api/math/class", auth, handle(async (req, res) => {
    const v = await viewer(req);
    if (!isStaff(v)) return res.status(403).json({ message: "Teachers only." });
    const kids = (await dir.studentsOf(v.id)).filter((k) => !k.archived);
    const band = await classBand(v.id, kids);
    const s = await settingsOf(v.id);
    const profiles = await store.getProfiles(kids.map((k) => k.id));
    const rows = kids.map((k) => studentRow(k, profiles.get(k.id) ?? emptyMathProfile(), band)).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
    const accs = rows.map((r) => r.accuracy).filter((a): a is number => a !== null);
    res.json({
      settings: { band, bandSaved: !!s.band, boardShow: s.board_show, boardBy: s.board_by },
      students: rows,
      totals: { students: rows.length, weekQuizzes: rows.reduce((a, r) => a + r.weekQuizzes, 0), check: rows.filter((r) => r.status === "check").length, accuracy: accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : null },
    });
  }));

  app.put("/api/math/class/settings", auth, handle(async (req, res) => {
    const v = await viewer(req);
    if (!isStaff(v)) return res.status(403).json({ message: "Teachers only." });
    const s = await settingsOf(v.id), b = req.body || {};
    if (b.band !== undefined) { if (!isBand(b.band)) return res.status(400).json({ message: "Unknown grade band." }); s.band = b.band; }
    if (b.boardShow !== undefined) s.board_show = !!b.boardShow;
    if (b.boardBy !== undefined) s.board_by = b.boardBy === "effort" ? "effort" : "points";
    await store.saveSettings(v.id, s);
    res.json({ settings: { band: s.band ?? (await classBand(v.id)), boardShow: s.board_show, boardBy: s.board_by } });
  }));

  app.get("/api/math/students/:id", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const k = await ownStudent(v, Number(req.params.id));
    if (!k) return res.status(404).json({ message: "That student isn’t in your class." });
    const band = await classBand(v.id);
    const p = await store.getProfile(k.id);
    res.json({ student: { ...studentRow(k, p, band), history: p.history.slice(0, 10), certs: p.certs.slice(0, 10) } });
  }));

  app.post("/api/math/students/:id/certificate", auth, handle(async (req, res) => {
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
  const assignmentOut = (a: AssignmentRow) => ({ id: a.id, skill: a.skill, n: a.n, due: a.due, title: a.title, band: a.band, questions: a.skill === "custom" ? a.questions.length : 0, createdAt: a.created_at });

  app.get("/api/math/assignments", auth, handle(async (req, res) => {
    const v = await viewer(req);
    if (isStaff(v)) {
      const list = await store.assignmentsFor(v.id);
      const rs = await store.results(list.map((a) => a.id));
      const size = (await dir.studentsOf(v.id)).filter((k) => !k.archived).length;
      return res.json({ assignments: list.map((a) => ({ ...assignmentOut(a), done: rs.filter((r) => r.assignment_id === a.id).length, classSize: size })) });
    }
    if (v.role === "student") {
      if (!v.hasClass || !v.teacherId) return res.json({ assignments: [] });
      const recent = mathDay(now() - 14 * 86400_000);
      const list = (await store.assignmentsFor(v.teacherId)).filter((a) => a.due >= recent);
      const rs = (await store.results(list.map((a) => a.id))).filter((r) => r.user_id === v.id);
      return res.json({ assignments: list.map((a) => { const r = rs.find((x) => x.assignment_id === a.id); return { ...assignmentOut(a), myScore: r ? r.score : null, myOf: r ? r.total : null }; }) });
    }
    res.status(403).json({ message: "Students and teachers only." });
  }));

  app.post("/api/math/assignments", auth, handle(async (req, res) => {
    const v = await viewer(req);
    if (!isStaff(v)) return res.status(403).json({ message: "Teachers only." });
    const b = req.body || {};
    const n = Number(b.n);
    if (!(LIMITS.quizLength as readonly number[]).includes(n)) return res.status(400).json({ message: "Pick 5 or 10 questions." });
    if (!isDay(b.due) || String(b.due) < mathDay(now())) return res.status(400).json({ message: "Pick a due date that hasn’t passed." });
    const band = await classBand(v.id);
    let title: string, questions: CustomQuestion[] = [];
    if (isSkill(b.skill)) title = SKILLS[b.skill as SkillId].name;
    else if (b.skill === "mixed") title = "Mixed review";
    else if (b.skill === "custom") {
      questions = (Array.isArray(b.questions) ? b.questions : []).slice(0, LIMITS.customPerAssignment).map(cleanCustom).filter((q: CustomQuestion | null): q is CustomQuestion => !!q);
      if (!questions.length) return res.status(400).json({ message: "Add at least one question with a number answer." });
      title = "Questions from class";
    } else return res.status(400).json({ message: "Pick a skill." });
    const a = await store.createAssignment({ teacher_id: v.id, skill: String(b.skill), n, due: String(b.due), title, band, questions });
    for (const k of await dir.studentsOf(v.id)) if (!k.archived) notify(k.id, `New math assignment: ${title}`);
    res.status(201).json({ assignment: assignmentOut(a) });
  }));

  app.delete("/api/math/assignments/:id", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const a = await store.getAssignment(String(req.params.id));
    if (!a || !(a.teacher_id === v.id && isStaff(v))) return res.status(404).json({ message: "Assignment not found." });
    await store.deleteAssignment(a.id);
    res.json({ ok: true });
  }));

  /* ---------- parents */
  app.get("/api/math/children", auth, handle(async (req, res) => {
    const v = await viewer(req);
    if (v.role !== "parent") return res.status(403).json({ message: "Parent accounts only." });
    const ids = await dir.childrenOf(v.id);
    const kids = (await Promise.all(ids.map((id) => dir.user(id)))).filter((u): u is MathUser => !!u && u.role === "student" && !u.archived);
    const profiles = await store.getProfiles(kids.map((k) => k.id));
    const out = [];
    for (const k of kids) {
      const grade = await dir.gradeOf(k.id).catch(() => null);
      const hasClass = !!k.teacherId && k.approvedByTeacher;
      const raw = profiles.get(k.id) ?? emptyMathProfile();
      const p = profileNow(raw, now());
      const band = p.band ?? (bandForGrade(grade) as BandId);
      const teacher = hasClass ? await dir.user(k.teacherId!) : null;
      const rank = await weekRank({ id: k.id, teacherId: k.teacherId, hasClass });
      const size = hasClass ? (await dir.studentsOf(k.teacherId!)).filter((x) => !x.archived).length : 0;
      out.push({
        id: k.id, name: studentName(k.displayName), firstName: k.displayName.split(/\s+/)[0] || "Your child", grade, band, hasClass, teacherName: teacher?.displayName ?? null,
        profile: profileOut(raw), accuracy: accuracy(p.mastery), skills: BANDS[band].skills.map((s) => ({ id: s, strength: strength(p.mastery, s), tried: p.mastery[s]?.t ?? 0 })),
        rank, classSize: size, achievements: earnedAchievements(p, band, rank),
      });
    }
    res.json({ children: out });
  }));

  /* ---------- live review */
  const code6 = () => String(Math.floor(random() * 900000) + 100000);
  function liveQuestion(band: BandId): Problem {
    const ids = BANDS[band].skills;
    return makeProblem(ids[Math.floor(random() * ids.length) % ids.length], random);
  }
  /** Moves a question to "reveal" once time runs out or everyone has answered. */
  async function settle(g: LiveRow, ps?: PlayerRow[]) {
    if (g.phase !== "q") return g;
    const list = ps ?? (await store.players(g.id));
    const allIn = list.length > 0 && list.every((p) => p.answered_qi === g.qi);
    if (allIn || (g.q_ends_at && Date.parse(g.q_ends_at) <= now())) { g.phase = "reveal"; await store.saveLive(g); }
    return g;
  }
  function questionOut(q: Problem, withAnswer: boolean) {
    return { skill: q.skill, ask: q.ask, prompt: q.prompt, long: q.long, kind: q.kind, choices: q.choices, answer: withAnswer ? String(q.answer) : null };
  }
  async function liveOut(g: LiveRow) {
    const ps = await store.players(g.id);
    await settle(g, ps);
    const reveal = g.phase === "reveal" || g.phase === "done";
    const counts = g.question ? g.question.choices.map((c) => ps.filter((p) => p.answered_qi === g.qi && p.answer === c.v).length) : [];
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

  app.post("/api/math/live", auth, handle(async (req, res) => {
    const v = await viewer(req);
    if (!isStaff(v)) return res.status(403).json({ message: "Teachers start live games." });
    const old = await store.liveOf(v.id);
    if (old) { old.phase = "ended"; await store.saveLive(old); }
    let code = code6();
    for (let i = 0; i < 6 && (await store.liveByCode(code)); i++) code = code6();
    const g = await store.createLive({ teacher_id: v.id, code, band: await classBand(v.id), phase: "lobby", qi: 0, question: null, q_ends_at: null });
    res.status(201).json({ game: await liveOut(g) });
  }));

  app.get("/api/math/live/current", auth, handle(async (req, res) => {
    const v = await viewer(req);
    if (!isStaff(v)) return res.status(403).json({ message: "Teachers only." });
    const g = await store.liveOf(v.id);
    res.json({ game: g ? await liveOut(g) : null });
  }));

  app.get("/api/math/live/:id", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const g = await ownGame(req, v);
    if (!g) return res.status(404).json({ message: "Game not found." });
    res.json({ game: await liveOut(g) });
  }));

  app.post("/api/math/live/:id/next", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const g = await ownGame(req, v);
    if (!g || !OPEN_PHASES.includes(g.phase)) return res.status(404).json({ message: "Game not found." });
    if (g.phase === "q") g.phase = "reveal";
    else if (g.phase === "reveal" && g.qi >= LIVE_QUESTIONS) g.phase = "done";
    else {
      if (g.phase === "lobby" && !(await store.players(g.id)).length) return res.status(400).json({ message: "Wait for at least one student to join." });
      g.qi++; g.question = liveQuestion(g.band); g.phase = "q"; g.q_ends_at = new Date(now() + LIVE_SECONDS * 1000).toISOString();
    }
    await store.saveLive(g);
    res.json({ game: await liveOut(g) });
  }));

  app.delete("/api/math/live/:id", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const g = await ownGame(req, v);
    if (!g) return res.status(404).json({ message: "Game not found." });
    g.phase = "ended";
    await store.saveLive(g);
    res.json({ ok: true });
  }));

  app.post("/api/math/live/join", auth, handle(async (req, res) => {
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

  async function joined(req: any, v: Viewer) {
    const g = await store.getLive(String(req.params.id));
    if (!g || v.role !== "student") return null;
    const me = (await store.players(g.id)).find((p) => p.user_id === v.id);
    return me ? { g, me } : null;
  }

  app.get("/api/math/live/:id/play", auth, handle(async (req, res) => {
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
        myAnswer: answered ? j.me.answer : null, myRight: reveal && answered && g.question ? isRight(g.question, j.me.answer) : null,
        myScore: ranked.find((p) => p.user_id === v.id)?.score ?? 0, myRank: ranked.findIndex((p) => p.user_id === v.id) + 1, players: ps.length,
      },
    });
  }));

  app.post("/api/math/live/:id/answer", auth, handle(async (req, res) => {
    const v = await viewer(req);
    const j = await joined(req, v);
    if (!j) return res.status(404).json({ message: "Game not found." });
    const g = await settle(j.g);
    if (g.phase !== "q" || !g.question) return res.status(409).json({ message: "Time’s up for this question." });
    if (j.me.answered_qi === g.qi) return res.status(409).json({ message: "You already answered this one." });
    const value = String(req.body?.value ?? "");
    if (!g.question.choices.some((c) => c.v === value)) return res.status(400).json({ message: "Pick one of the answers." });
    const right = isRight(g.question, value);
    await store.savePlayer({ ...j.me, answer: value, answered_qi: g.qi, score: j.me.score + (right ? 1 : 0) });
    res.json({ ok: true });
  }));
}
