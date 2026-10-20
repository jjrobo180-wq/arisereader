// English Explorer (the student page is #/english; the teachers' screen is "English learners" in the Reader).
// An English-language-learner program from first words to academic words and idioms; the content, the
// lesson maker, the checking and the spaced repetition are in shared/ariseEnglish.ts.
//
// Rules kept here, on the server:
// - Only students a teacher or the administrator turned on can play. Staff can try it in preview mode:
//   nothing they do is saved or scored.
// - The answer key never leaves the server. Each answer is checked when it's given (so the page can cheer
//   or help right away) and only the first try counts, so the score can't be faked.
// - Points are written to manual_point_awards, which is what puts them on the regular A.R.I.S.E.
//   leaderboards (all-time, monthly and the Advisory Challenge). At most POINTS.dailyCap a day, plus
//   the level-up bonus.
// - Every teacher sees every English learner at their school (not only their own class), and the
//   administrator sees all of them. A teacher can turn it on for their own students and for students at
//   their school; the administrator for anyone.
// - Speaking: a short recording is sent to the transcription service and compared with the word. The
//   recording is never stored; only whether it matched (and what was heard) is kept for the teacher.
// Tables: migrations/arise_english.sql.
import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { createAttemptLimiter } from "./attemptLimiter";
import {
  HOME_LANGUAGES, LEVELS, MAX_LEVEL, MASTERED_BOX, POINTS, SKILL_OF, UNITS, checkAnswer, checkSpeech, denverDay, languageName,
  makeLesson, makeReview, nextProgress, pointsFor, publicItem, starsFor, streakOf, unitById, unitOpen, unlockedLevel, voiceTexts, wordById,
  wordStatus, type EnglishWord, type Item, type Rng, type Skill, type UnitProgress, type WordProgress,
} from "../shared/ariseEnglish";

/* ------------------------------------------------------------------ types */

export type LearnerRow = {
  student_id: number; enabled: boolean; start_level: number; home_language: string | null; help_on: boolean; note: string;
  enabled_by: number | null; enabled_at: string; updated_at: string;
};
/** One answer: `ok` is whether the first try was right (only that counts); `got` whether it was right in the end. */
export type AnswerRec = { ok: boolean; got?: boolean; tries: number; ms: number; heard?: string; skipped?: boolean };
export type SessionRow = {
  id: string; student_id: number; kind: "lesson" | "review"; unit_id: string | null; items: Item[]; answers: (AnswerRec | null)[];
  status: "open" | "done"; score: number; total: number; points: number; stars: number; preview: boolean;
  skills: Partial<Record<Skill, [number, number]>>; started_at: string; finished_at: string | null;
};
export interface EnglishStore {
  learner(studentId: number): Promise<LearnerRow | null>;
  learners(): Promise<LearnerRow[]>;
  saveLearner(row: LearnerRow): Promise<void>;
  words(studentId: number): Promise<WordProgress[]>;
  saveWords(studentId: number, rows: WordProgress[]): Promise<void>;
  units(studentId: number): Promise<UnitProgress[]>;
  saveUnit(studentId: number, row: UnitProgress): Promise<void>;
  createSession(row: Omit<SessionRow, "id" | "started_at" | "finished_at">): Promise<SessionRow>;
  getSession(id: string): Promise<SessionRow | null>;
  saveSession(row: SessionRow): Promise<void>;
  /** Finished, non-preview sessions of these students since a time (newest first). */
  doneSessions(studentIds: number[], sinceIso: string): Promise<SessionRow[]>;
  /** How many sessions a student started since a time (to limit runaway use). */
  startedSince(studentId: number, sinceIso: string): Promise<number>;
  /** Each student's words, for the reports. */
  wordsFor(studentIds: number[]): Promise<Map<number, WordProgress[]>>;
  unitsFor(studentIds: number[]): Promise<Map<number, UnitProgress[]>>;
  /** Puts points on the A.R.I.S.E. leaderboard. */
  awardPoints(studentId: number, points: number, reason: string, day: string): Promise<void>;
}

export type EnglishPerson = { id: number; role: "student" | "teacher" | "parent" | "admin"; displayName: string; username: string; teacherId: number | null; schoolId: number | null; archived: boolean };
export type EnglishDirectory = {
  user(id: number): Promise<EnglishPerson | null>;
  /** Every active student account. */
  students(): Promise<EnglishPerson[]>;
  gradeOf?(id: number): Promise<string | null>;
  notify?(userId: number, message: { title: string; body: string; url?: string }): Promise<unknown>;
  /** Points changed: the leaderboards should be worked out again. */
  pointsChanged?(): void;
};
export type EnglishSpeech = {
  /** The premium AI voice: mp3 of the text in English or Spanish. */
  say(text: string, lang: "en" | "es", slow: boolean): Promise<Buffer>;
  /** What a short recording says (English). */
  hear(audio: Buffer, mime: string): Promise<string>;
};
export type EnglishDeps = {
  store?: EnglishStore; directory: EnglishDirectory; speech?: EnglishSpeech; now?: () => number; random?: Rng;
  /** Reads a short audio recording into req.body as a Buffer (express.raw for audio types). */
  audioBody?: RequestHandler;
};

/* ------------------------------------------------------------------ stores */

/** Thrown when migrations/arise_english.sql has not been run yet. */
export class EnglishNotSetUp extends Error {}
const isMissingTable = (error: any) => error?.code === "42P01" || error?.code === "PGRST205" || /could not find the table|does not exist/i.test(String(error?.message || ""));

const wordRow = (r: any): WordProgress => ({ word_id: String(r.word_id), box: Number(r.box) || 0, right: Number(r.right_count) || 0, wrong: Number(r.wrong_count) || 0, last_at: r.last_at || null, due_at: r.due_at || null });
const unitRow = (r: any): UnitProgress => ({ unit_id: String(r.unit_id), stars: Number(r.stars) || 0, best: Number(r.best) || 0, plays: Number(r.plays) || 0, first_done_at: r.first_done_at || null, last_at: r.last_at || null });
const learnerRow = (r: any): LearnerRow => ({
  student_id: Number(r.student_id), enabled: r.enabled !== false, start_level: Math.min(MAX_LEVEL, Math.max(1, Number(r.start_level) || 1)),
  home_language: r.home_language || null, help_on: r.help_on !== false, note: String(r.note || ""), enabled_by: r.enabled_by ? Number(r.enabled_by) : null,
  enabled_at: String(r.enabled_at || ""), updated_at: String(r.updated_at || ""),
});

export function createSupabaseEnglishStore(client?: any): EnglishStore {
  const db = async () => client ?? (await import("./supabase")).getAdminSupabase();
  const fail = (error: any) => { if (!error) return; if (isMissingTable(error)) throw new EnglishNotSetUp(String(error.message)); throw new Error(error.message || String(error)); };
  /** Every row of a query, 1000 at a time. */
  async function all(make: (from: number, to: number) => any): Promise<any[]> {
    const out: any[] = [];
    for (let from = 0; ; from += 1000) {
      const r = await make(from, from + 999);
      fail(r.error);
      out.push(...(r.data || []));
      if (!r.data || r.data.length < 1000) return out;
    }
  }
  const chunks = <T,>(list: T[], n = 200) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
  return {
    async learner(id) { const r = await (await db()).from("english_learners").select("*").eq("student_id", id).maybeSingle(); fail(r.error); return r.data ? learnerRow(r.data) : null; },
    async learners() { const c = await db(); return (await all((a, b) => c.from("english_learners").select("*").order("student_id").range(a, b))).map(learnerRow); },
    async saveLearner(row) { fail((await (await db()).from("english_learners").upsert(row, { onConflict: "student_id" })).error); },
    async words(id) { const c = await db(); return (await all((a, b) => c.from("english_words").select("*").eq("student_id", id).range(a, b))).map(wordRow); },
    async saveWords(id, rows) {
      if (!rows.length) return;
      fail((await (await db()).from("english_words").upsert(rows.map((w) => ({ student_id: id, word_id: w.word_id, box: w.box, right_count: w.right, wrong_count: w.wrong, last_at: w.last_at, due_at: w.due_at })), { onConflict: "student_id,word_id" })).error);
    },
    async units(id) { const r = await (await db()).from("english_units").select("*").eq("student_id", id); fail(r.error); return (r.data || []).map(unitRow); },
    async saveUnit(id, u) { fail((await (await db()).from("english_units").upsert({ student_id: id, ...u }, { onConflict: "student_id,unit_id" })).error); },
    async createSession(row) { const r = await (await db()).from("english_sessions").insert(row).select("*").single(); fail(r.error); return r.data as SessionRow; },
    async getSession(id) { const r = await (await db()).from("english_sessions").select("*").eq("id", id).maybeSingle(); fail(r.error); return (r.data as SessionRow) || null; },
    async saveSession(row) { const { id, ...rest } = row; fail((await (await db()).from("english_sessions").update(rest).eq("id", id)).error); },
    async doneSessions(ids, since) {
      if (!ids.length) return [];
      const c = await db();
      const out: SessionRow[] = [];
      for (const part of chunks(ids)) out.push(...await all((a, b) => c.from("english_sessions").select("*").in("student_id", part).eq("status", "done").eq("preview", false).gte("started_at", since).order("started_at", { ascending: false }).range(a, b)));
      return out.sort((x, y) => y.started_at.localeCompare(x.started_at));
    },
    async startedSince(id, since) { const r = await (await db()).from("english_sessions").select("id", { count: "exact", head: true }).eq("student_id", id).gte("started_at", since); fail(r.error); return r.count || 0; },
    async wordsFor(ids) {
      const out = new Map<number, WordProgress[]>();
      const c = await db();
      for (const part of chunks(ids)) for (const r of await all((a, b) => c.from("english_words").select("*").in("student_id", part).range(a, b))) {
        const id = Number(r.student_id); if (!out.has(id)) out.set(id, []); out.get(id)!.push(wordRow(r));
      }
      return out;
    },
    async unitsFor(ids) {
      const out = new Map<number, UnitProgress[]>();
      const c = await db();
      for (const part of chunks(ids)) for (const r of await all((a, b) => c.from("english_units").select("*").in("student_id", part).range(a, b))) {
        const id = Number(r.student_id); if (!out.has(id)) out.set(id, []); out.get(id)!.push(unitRow(r));
      }
      return out;
    },
    async awardPoints(id, points, reason, day) {
      fail((await (await db()).from("manual_point_awards").insert({ student_id: id, awarded_by: null, points, reason: reason.slice(0, 200), earned_on: day })).error);
    },
  };
}

/** In-memory store for tests. */
export function createMemoryEnglishStore(now: () => number = Date.now) {
  const learners = new Map<number, LearnerRow>();
  const words = new Map<number, Map<string, WordProgress>>();
  const units = new Map<number, Map<string, UnitProgress>>();
  const sessions = new Map<string, SessionRow>();
  const awards: { student_id: number; points: number; reason: string; day: string }[] = [];
  const c = <T,>(v: T): T => structuredClone(v);
  const store: EnglishStore & { awards: typeof awards } = {
    awards,
    async learner(id) { return c(learners.get(id) ?? null); },
    async learners() { return c([...learners.values()]); },
    async saveLearner(row) { learners.set(row.student_id, c(row)); },
    async words(id) { return c([...(words.get(id)?.values() || [])]); },
    async saveWords(id, rows) { const m = words.get(id) || new Map(); for (const r of rows) m.set(r.word_id, c(r)); words.set(id, m); },
    async units(id) { return c([...(units.get(id)?.values() || [])]); },
    async saveUnit(id, u) { const m = units.get(id) || new Map(); m.set(u.unit_id, c(u)); units.set(id, m); },
    async createSession(row) { const s = { ...c(row), id: randomUUID(), started_at: new Date(now()).toISOString(), finished_at: null }; sessions.set(s.id, s); return c(s); },
    async getSession(id) { return c(sessions.get(id) ?? null); },
    async saveSession(row) { sessions.set(row.id, c(row)); },
    async doneSessions(ids, since) { return c([...sessions.values()].filter((s) => ids.includes(s.student_id) && s.status === "done" && !s.preview && s.started_at >= since).sort((a, b) => b.started_at.localeCompare(a.started_at))); },
    async startedSince(id, since) { return [...sessions.values()].filter((s) => s.student_id === id && s.started_at >= since).length; },
    async wordsFor(ids) { return new Map(ids.filter((i) => words.has(i)).map((i) => [i, c([...words.get(i)!.values()])])); },
    async unitsFor(ids) { return new Map(ids.filter((i) => units.has(i)).map((i) => [i, c([...units.get(i)!.values()])])); },
    async awardPoints(id, points, reason, day) { awards.push({ student_id: id, points, reason, day }); },
  };
  return store;
}

/* ------------------------------------------------------------------ reports */

const SKILLS: Skill[] = ["listening", "reading", "writing", "speaking"];
const minutesOf = (s: SessionRow) => s.finished_at ? Math.min(20, Math.max(0, (Date.parse(s.finished_at) - Date.parse(s.started_at)) / 60000)) : 0;
/** First-try right and total for the scored questions of some sessions, overall and by skill. */
export function tally(sessions: SessionRow[]) {
  const skills: Record<Skill, [number, number]> = { listening: [0, 0], reading: [0, 0], writing: [0, 0], speaking: [0, 0] };
  let right = 0, total = 0;
  for (const s of sessions) s.items.forEach((it, i) => {
    const a = s.answers[i];
    const skill = SKILL_OF[it.kind];
    if (it.kind === "speak") { if (a && !a.skipped) { skills.speaking[1]++; if (a.ok) skills.speaking[0]++; } return; }
    skills[skill][1]++; total++;
    if (a?.ok) { skills[skill][0]++; right++; }
  });
  return { right, total, skills };
}
const pct = (r: number, t: number) => (t ? Math.round((r / t) * 100) : null);

/** One student's line in the teachers' list. */
function summaryOf(learner: LearnerRow, person: EnglishPerson, words: WordProgress[], units: UnitProgress[], sessions: SessionRow[], nowMs: number, extra: { teacherName: string; grade: string | null; enabledBy: string }) {
  const unitMap = new Map(units.map((u) => [u.unit_id, u]));
  const level = unlockedLevel(learner.start_level, unitMap);
  const inLevel = LEVELS[level - 1].units;
  const weekAgo = new Date(nowMs - 7 * 86400_000).toISOString();
  const week = sessions.filter((s) => s.started_at >= weekAgo);
  const t7 = tally(week), tAll = tally(sessions);
  return {
    id: person.id, name: person.displayName, username: person.username, teacherId: person.teacherId, teacherName: extra.teacherName, grade: extra.grade,
    enabled: learner.enabled, startLevel: learner.start_level, homeLanguage: learner.home_language, homeLanguageName: languageName(learner.home_language), helpOn: learner.help_on,
    note: learner.note, enabledBy: extra.enabledBy, enabledAt: learner.enabled_at,
    level, levelTitle: LEVELS[level - 1].title, unitsDone: inLevel.filter((u) => (unitMap.get(u.id)?.stars || 0) > 0).length, unitsInLevel: inLevel.length,
    unitsDoneAll: units.filter((u) => u.stars > 0).length, unitsAll: UNITS.length,
    wordsMastered: words.filter((w) => w.box >= MASTERED_BOX).length, wordsLearning: words.filter((w) => w.box > 0 && w.box < MASTERED_BOX).length,
    due: words.filter((w) => w.due_at && Date.parse(w.due_at) <= nowMs).length,
    accuracy7: pct(t7.right, t7.total), accuracy: pct(tAll.right, tAll.total),
    minutes7: Math.round(week.reduce((m, s) => m + minutesOf(s), 0)), sessions7: week.length, sessions: sessions.length,
    streak: streakOf(sessions.map((s) => denverDay(Date.parse(s.finished_at || s.started_at))), nowMs),
    lastActive: sessions[0]?.finished_at || null,
    points: sessions.reduce((p, s) => p + (s.points || 0), 0),
    points7: week.reduce((p, s) => p + (s.points || 0), 0),
  };
}
export type LearnerSummary = ReturnType<typeof summaryOf>;

/* ------------------------------------------------------------------ routes */

const SESSIONS_PER_DAY = 60;
const HISTORY_DAYS = 120;

export function registerAriseEnglishRoutes(app: Express, auth: RequestHandler, deps: EnglishDeps) {
  const store = deps.store ?? createSupabaseEnglishStore();
  const dir = deps.directory;
  const now = deps.now ?? Date.now;
  const random = deps.random ?? Math.random;
  const speech = deps.speech;
  const voiceAllowed = voiceTexts();
  const speakTries = createAttemptLimiter({ max: 40, windowMs: 10 * 60_000, now });
  const voiceTries = createAttemptLimiter({ max: 400, windowMs: 10 * 60_000, now });

  type Viewer = { id: number; role: EnglishPerson["role"]; schoolId: number | null; teacherId: number | null; preview: boolean; name: string };
  const roleOf = (u: any): EnglishPerson["role"] => (u?.isAdmin ? "admin" : u?.role === "teacher" ? "teacher" : u?.role === "parent" ? "parent" : "student");
  const viewer = (req: any): Viewer => {
    const u = req.user || {};
    const role = req.adminPreview ? "student" : roleOf(u);
    return { id: Number(u.id), role, schoolId: u.school_id ?? u.schoolId ?? null, teacherId: u.teacherId ? Number(u.teacherId) : null, preview: !!req.adminPreview || role !== "student", name: String(u.displayName || u.username || "") };
  };
  const isStaff = (v: Viewer) => v.role === "teacher" || v.role === "admin";
  const handle = (fn: (req: any, res: any) => Promise<unknown>) => async (req: any, res: any) => {
    try { res.set?.("Cache-Control", "no-store"); await fn(req, res); }
    catch (error: any) {
      if (error instanceof EnglishNotSetUp) return res.status(503).json({ message: "English Explorer is still being set up. Please check back soon.", setup: true });
      console.error("[english]", error?.message || error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  };
  const staffOnly = (fn: (req: any, res: any, v: Viewer) => Promise<unknown>) => handle(async (req, res) => {
    const v = viewer(req);
    if (!isStaff(v) || req.adminPreview) return res.status(403).json({ message: "This is for teachers and the administrator." });
    await fn(req, res, v);
  });

  /** May this teacher (or the admin) see and manage this student? Every teacher at the student's school can. */
  const canSee = (v: Viewer, s: EnglishPerson) => v.role === "admin" || (v.role === "teacher" && (s.teacherId === v.id || !v.schoolId || !s.schoolId || v.schoolId === s.schoolId));

  /** Who the student is to English Explorer, and whether they may play. */
  async function playerState(v: Viewer) {
    if (v.preview) return { learner: { student_id: v.id, enabled: true, start_level: MAX_LEVEL, home_language: "es", help_on: true, note: "", enabled_by: null, enabled_at: "", updated_at: "" } as LearnerRow, units: new Map<string, UnitProgress>(), words: [] as WordProgress[] };
    const learner = await store.learner(v.id);
    if (!learner?.enabled) return null;
    const [units, words] = await Promise.all([store.units(v.id), store.words(v.id)]);
    return { learner, units: new Map(units.map((u) => [u.unit_id, u])), words };
  }
  const dueWords = (words: WordProgress[], nowMs: number) => words.filter((w) => w.box > 0 && w.due_at && Date.parse(w.due_at) <= nowMs).sort((a, b) => a.box - b.box || String(a.due_at).localeCompare(String(b.due_at)));
  const todaysPoints = async (id: number) => {
    const today = denverDay(now());
    const since = new Date(now() - 36 * 3600_000).toISOString();
    return (await store.doneSessions([id], since)).filter((s) => denverDay(Date.parse(s.finished_at || s.started_at)) === today).reduce((p, s) => p + (s.points || 0), 0);
  };

  /* ---------- who am I, and my map */
  app.get("/api/english/me", auth, handle(async (req, res) => {
    const v = viewer(req);
    if (v.role === "parent") return res.json({ enabled: false });
    const state = await playerState(v);
    if (!state) return res.json({ enabled: false, staff: false });
    const nowMs = now();
    const sessions = v.preview ? [] : await store.doneSessions([v.id], new Date(nowMs - HISTORY_DAYS * 86400_000).toISOString());
    const today = denverDay(nowMs);
    const level = unlockedLevel(state.learner.start_level, state.units);
    res.json({
      enabled: true, staff: isStaff(v), preview: v.preview, name: v.name.split(" ")[0] || "Explorer",
      startLevel: state.learner.start_level, homeLanguage: state.learner.home_language, help: state.learner.help_on && state.learner.home_language === "es",
      level,
      units: Object.fromEntries([...state.units.values()].map((u) => [u.unit_id, { stars: u.stars, best: u.best, plays: u.plays }])),
      open: UNITS.filter((u) => v.preview || unitOpen(u, state.learner.start_level, state.units)).map((u) => u.id),
      words: Object.fromEntries(state.words.map((w) => [w.word_id, wordStatus(w)])),
      mastered: state.words.filter((w) => w.box >= MASTERED_BOX).length,
      learning: state.words.filter((w) => w.box > 0 && w.box < MASTERED_BOX).length,
      due: dueWords(state.words, nowMs).length,
      streak: streakOf(sessions.map((s) => denverDay(Date.parse(s.finished_at || s.started_at))), nowMs),
      today: { points: sessions.filter((s) => denverDay(Date.parse(s.finished_at || s.started_at)) === today).reduce((p, s) => p + s.points, 0), lessons: sessions.filter((s) => denverDay(Date.parse(s.finished_at || s.started_at)) === today).length },
      points: sessions.reduce((p, s) => p + s.points, 0),
      dailyCap: POINTS.dailyCap,
    });
  }));

  /* ---------- the premium AI voice (only for what's in the program) */
  app.post("/api/english/voice", auth, handle(async (req, res) => {
    const v = viewer(req);
    const lang: "en" | "es" = req.body?.lang === "es" ? "es" : "en";
    const text = String(req.body?.text || "").trim();
    const slow = !!req.body?.slow;
    if (!text || !voiceAllowed[lang].has(text)) return res.status(400).json({ message: "That isn't part of English Explorer." });
    if (!isStaff(v) && !(await playerState(v))) return res.status(403).json({ message: "English Explorer isn't turned on for this account." });
    if (voiceTries.retryAfter(String(v.id)) > 0) return res.status(429).json({ message: "Slow down a little, then try again." });
    voiceTries.fail(String(v.id));
    if (!speech) return res.status(503).json({ message: "The voice isn't available right now." });
    try {
      const audio = await speech.say(text, lang, slow);
      res.set?.("Cache-Control", "private, max-age=86400");
      res.type?.("audio/mpeg");
      res.send(audio);
    } catch (error: any) {
      console.error("[english-voice]", error?.message || error);
      res.status(502).json({ message: "The voice isn't available right now." });
    }
  }));

  /* ---------- a lesson or a review */
  app.post("/api/english/sessions", auth, handle(async (req, res) => {
    const v = viewer(req);
    if (v.role === "parent") return res.status(403).json({ message: "English Explorer is for students." });
    const state = await playerState(v);
    if (!state) return res.status(403).json({ message: "Ask your teacher to turn on English Explorer for you." });
    const nowMs = now();
    if (!v.preview && (await store.startedSince(v.id, new Date(nowMs - 24 * 3600_000).toISOString())) >= SESSIONS_PER_DAY) {
      return res.status(429).json({ message: "That's a lot of English for one day! Come back tomorrow." });
    }
    let items: Item[]; let unitId: string | null = null; let words: EnglishWord[];
    if (req.body?.review) {
      const due = dueWords(state.words, nowMs);
      // Nothing due yet: practice the words still being learned, weakest first.
      const list = (due.length ? due : state.words.filter((w) => w.box > 0 && w.box < MASTERED_BOX).sort((a, b) => a.box - b.box)).map((w) => wordById(w.word_id)).filter((w): w is EnglishWord => !!w);
      if (v.preview && !list.length) list.push(...LEVELS[0].units[0].words.slice(0, 6));
      if (!list.length) return res.status(409).json({ message: "Play a lesson first. Then your words come back here to review." });
      items = makeReview(list, random);
      words = list.slice(0, items.length);
    } else {
      const unit = unitById(String(req.body?.unitId || ""));
      if (!unit) return res.status(404).json({ message: "That lesson wasn't found." });
      if (!v.preview && !unitOpen(unit, state.learner.start_level, state.units)) return res.status(403).json({ message: "Finish the lesson before this one first." });
      unitId = unit.id; items = makeLesson(unit, random); words = unit.words;
    }
    const row = await store.createSession({
      student_id: v.id, kind: unitId ? "lesson" : "review", unit_id: unitId, items, answers: items.map(() => null), status: "open",
      score: 0, total: items.filter((i) => i.kind !== "speak").length, points: 0, stars: 0, preview: v.preview, skills: {},
    });
    res.json({ id: row.id, kind: row.kind, unitId, items: items.map(publicItem), words: words.map((w) => ({ id: w.id, w: w.w, e: w.e, s: w.s, es: w.es, m: w.m || null })) });
  }));

  async function ownSession(req: any, res: any): Promise<SessionRow | null> {
    const v = viewer(req);
    const s = await store.getSession(String(req.params.id));
    if (!s || s.student_id !== v.id) { res.status(404).json({ message: "That lesson wasn't found." }); return null; }
    if (s.status !== "open") { res.status(409).json({ message: "This lesson is already finished." }); return null; }
    return s;
  }
  const indexOf = (req: any, s: SessionRow) => { const i = Number(req.params.index ?? req.body?.index); return Number.isInteger(i) && i >= 0 && i < s.items.length ? i : -1; };
  const reveal = (it: Item) => {
    const w = wordById(it.wordId)!;
    return it.kind === "spell" || it.kind === "order" ? it.answer : it.kind === "blank" ? (w.k || w.w) : it.kind === "define" ? (w.m || w.w) : w.w;
  };

  app.post("/api/english/sessions/:id/answer", auth, handle(async (req, res) => {
    const s = await ownSession(req, res); if (!s) return;
    const i = indexOf(req, s);
    if (i < 0 || s.items[i].kind === "speak") return res.status(400).json({ message: "That question wasn't found." });
    const it = s.items[i];
    const ok = checkAnswer(it, String(req.body?.answer ?? ""));
    const prev = s.answers[i];
    // Only the first try counts for the score; later tries are kept so the teacher sees the effort.
    s.answers[i] = prev ? { ...prev, tries: prev.tries + 1, got: !!prev.got || ok } : { ok, got: ok, tries: 1, ms: Math.max(0, Math.min(600_000, Number(req.body?.ms) || 0)) };
    await store.saveSession(s);
    const w = wordById(it.wordId)!;
    res.json({ correct: ok, answer: it.answer, show: reveal(it), word: { id: w.id, w: w.w, e: w.e, s: w.s, es: w.es }, firstTry: !prev });
  }));

  app.post("/api/english/sessions/:id/speak/:index", auth, ...(deps.audioBody ? [deps.audioBody] : []), handle(async (req, res) => {
    const s = await ownSession(req, res); if (!s) return;
    const i = indexOf(req, s);
    if (i < 0 || s.items[i].kind !== "speak") return res.status(400).json({ message: "That question wasn't found." });
    const key = String(s.student_id);
    if (speakTries.retryAfter(key) > 0) return res.status(429).json({ message: "Let's take a short break from the microphone." });
    speakTries.fail(key);
    const audio: Buffer = req.body;
    const mime = String(req.headers?.["content-type"] || "").split(";")[0].toLowerCase();
    if (!Buffer.isBuffer(audio) || audio.length < 500 || audio.length > 2_000_000) return res.status(400).json({ message: "I didn't hear anything. Try again a little louder." });
    if (!speech) return res.status(503).json({ message: "Listening isn't available right now." });
    let heard = "";
    try { heard = (await speech.hear(audio, mime)).slice(0, 120); }
    catch (error: any) { console.error("[english-listen]", error?.message || error); return res.status(502).json({ message: "I couldn't listen that time. Please try again." }); }
    const check = checkSpeech(s.items[i].answer, heard);
    const prev = s.answers[i];
    const tries = (prev?.tries || 0) + 1;
    s.answers[i] = { ok: !!prev?.ok || check.correct, tries, ms: prev?.ms || 0, heard: check.correct || !prev?.ok ? heard : prev.heard };
    await store.saveSession(s);
    res.json({ heard, correct: check.correct, close: check.close, tries });
  }));

  app.post("/api/english/sessions/:id/skip/:index", auth, handle(async (req, res) => {
    const s = await ownSession(req, res); if (!s) return;
    const i = indexOf(req, s);
    if (i < 0 || s.items[i].kind !== "speak") return res.status(400).json({ message: "That question wasn't found." });
    if (!s.answers[i]) { s.answers[i] = { ok: false, tries: 0, ms: 0, skipped: true }; await store.saveSession(s); }
    res.json({ ok: true });
  }));

  app.post("/api/english/sessions/:id/finish", auth, handle(async (req, res) => {
    const s = await ownSession(req, res); if (!s) return;
    const v = viewer(req);
    const nowMs = now();
    const scored = s.items.map((it, i) => ({ it, a: s.answers[i] })).filter((x) => x.it.kind !== "speak");
    const score = scored.filter((x) => x.a?.ok).length;
    const total = scored.length;
    const spokenRight = s.items.filter((it, i) => it.kind === "speak" && s.answers[i]?.ok).length;
    const t = tally([s]);
    s.status = "done"; s.finished_at = new Date(nowMs).toISOString(); s.score = score; s.total = total; s.skills = t.skills;
    s.stars = starsFor(score, total);

    const learned: string[] = []; const mastered: string[] = [];
    let points = 0; let capped = false; let levelUp: number | null = null; let why = "practice";
    const unit = s.unit_id ? unitById(s.unit_id) : null;
    if (!s.preview) {
      const state = await playerState(v);
      if (!state) { await store.saveSession(s); return res.status(403).json({ message: "English Explorer was turned off for this account." }); }
      // Spaced repetition: a word answered right every time moves up a box; a missed word starts again tomorrow.
      const byWord = new Map<string, { right: number; wrong: number }>();
      for (const { it, a } of scored) {
        const r = byWord.get(it.wordId) || { right: 0, wrong: 0 };
        if (a?.ok) r.right++; else r.wrong++;
        byWord.set(it.wordId, r);
      }
      const before = new Map(state.words.map((w) => [w.word_id, w]));
      const rows: WordProgress[] = [];
      for (const [wordId, r] of byWord) {
        const prev = before.get(wordId) || null;
        const next = nextProgress(prev, r.wrong === 0, r.wrong, r.right, nowMs, wordId);
        rows.push(next);
        if (!prev?.box) learned.push(wordId);
        if (next.box >= MASTERED_BOX && (prev?.box || 0) < MASTERED_BOX) mastered.push(wordId);
      }
      await store.saveWords(v.id, rows);
      const levelBefore = unlockedLevel(state.learner.start_level, state.units);
      const prevUnit = unit ? state.units.get(unit.id) || null : null;
      const award = pointsFor({ kind: s.kind, score, total, spokenRight, before: prevUnit });
      why = award.why;
      if (unit) {
        const best = total ? Math.round((score / total) * 100) : 0;
        const nextUnit: UnitProgress = {
          unit_id: unit.id, stars: Math.max(prevUnit?.stars || 0, award.stars), best: Math.max(prevUnit?.best || 0, best), plays: (prevUnit?.plays || 0) + 1,
          first_done_at: prevUnit?.first_done_at || (award.stars > 0 ? s.finished_at : null), last_at: s.finished_at,
        };
        await store.saveUnit(v.id, nextUnit);
        state.units.set(unit.id, nextUnit);
        const levelAfter = unlockedLevel(state.learner.start_level, state.units);
        if (levelAfter > levelBefore) levelUp = levelAfter;
      }
      const already = await todaysPoints(v.id);
      points = Math.max(0, Math.min(award.points, POINTS.dailyCap - already));
      capped = points < award.points;
      if (levelUp) points += POINTS.levelUp;
      if (points > 0) {
        const reason = levelUp ? `English Explorer: reached level ${levelUp}` : unit ? `English Explorer: ${unit.title}` : "English Explorer: word review";
        await store.awardPoints(v.id, points, reason, denverDay(nowMs));
        dir.pointsChanged?.();
      }
    }
    s.points = points;
    await store.saveSession(s);
    // The next lesson to play: the first open unit without stars.
    let next: string | null = null;
    if (!s.preview) {
      const state = await playerState(v);
      if (state) {
        const fresh = (u: (typeof UNITS)[number]) => unitOpen(u, state.learner.start_level, state.units) && !(state.units.get(u.id)?.stars);
        next = (UNITS.find((u) => fresh(u) && u.level >= state.learner.start_level) || UNITS.find(fresh))?.id || null;
      }
    }
    res.json({
      score, total, stars: s.stars, points, capped, why, levelUp, preview: s.preview, next,
      spoken: { right: spokenRight, tried: s.items.filter((it, i) => it.kind === "speak" && s.answers[i] && !s.answers[i]!.skipped).length },
      learned: learned.map((id) => wordById(id)!.w), mastered: mastered.map((id) => wordById(id)!.w),
      missed: [...new Set(scored.filter((x) => !x.a?.ok).map((x) => x.it.wordId))].map((id) => { const w = wordById(id)!; return { w: w.w, e: w.e }; }),
    });
  }));

  /* ---------- teachers and the administrator */

  async function visibleLearners(v: Viewer) {
    const [rows, students] = await Promise.all([store.learners(), dir.students()]);
    const byId = new Map(students.map((s) => [s.id, s]));
    const teachers = new Map<number, string>();
    const nameOf = async (id: number | null) => {
      if (!id) return "";
      if (!teachers.has(id)) teachers.set(id, (await dir.user(id).catch(() => null))?.displayName || "");
      return teachers.get(id)!;
    };
    const out: { learner: LearnerRow; person: EnglishPerson; teacherName: string; enabledBy: string }[] = [];
    for (const r of rows) {
      const p = byId.get(r.student_id);
      if (!p || p.archived || !canSee(v, p)) continue;
      out.push({ learner: r, person: p, teacherName: await nameOf(p.teacherId), enabledBy: await nameOf(r.enabled_by) });
    }
    return out;
  }
  async function summaries(v: Viewer) {
    const list = await visibleLearners(v);
    const ids = list.map((x) => x.person.id);
    const nowMs = now();
    const [words, units, sessions] = await Promise.all([store.wordsFor(ids), store.unitsFor(ids), store.doneSessions(ids, new Date(nowMs - HISTORY_DAYS * 86400_000).toISOString())]);
    const sessionsBy = new Map<number, SessionRow[]>();
    for (const s of sessions) { if (!sessionsBy.has(s.student_id)) sessionsBy.set(s.student_id, []); sessionsBy.get(s.student_id)!.push(s); }
    const rows: LearnerSummary[] = [];
    for (const x of list) {
      const grade = dir.gradeOf ? await dir.gradeOf(x.person.id).catch(() => null) : null;
      rows.push(summaryOf(x.learner, x.person, words.get(x.person.id) || [], units.get(x.person.id) || [], sessionsBy.get(x.person.id) || [], nowMs, { teacherName: x.teacherName, grade, enabledBy: x.enabledBy }));
    }
    return { rows, sessions: sessionsBy, words, units };
  }

  app.get("/api/english/staff/overview", auth, staffOnly(async (_req, res, v) => {
    const { rows } = await summaries(v);
    const on = rows.filter((r) => r.enabled);
    const acc = on.filter((r) => r.accuracy7 !== null);
    res.json({
      viewer: { id: v.id, role: v.role },
      learners: rows.map((r) => ({ ...r, mine: r.teacherId === v.id })),
      totals: {
        learners: on.length, active7: on.filter((r) => r.sessions7 > 0).length,
        mastered: on.reduce((n, r) => n + r.wordsMastered, 0), minutes7: on.reduce((n, r) => n + r.minutes7, 0),
        accuracy7: acc.length ? Math.round(acc.reduce((n, r) => n + (r.accuracy7 || 0), 0) / acc.length) : null,
        points7: on.reduce((n, r) => n + r.points7, 0),
        levels: LEVELS.map((l) => on.filter((r) => r.level === l.n).length),
      },
      levels: LEVELS.map((l) => ({ n: l.n, title: l.title, wida: l.wida, goal: l.goal, color: l.color, units: l.units.length, words: l.units.reduce((n, u) => n + u.words.length, 0) })),
      languages: HOME_LANGUAGES,
    });
  }));

  app.get("/api/english/staff/learners/:id", auth, staffOnly(async (req, res, v) => {
    const id = Number(req.params.id);
    const person = await dir.user(id);
    if (!person || person.role !== "student" || !canSee(v, person)) return res.status(404).json({ message: "That student wasn't found." });
    const learner = await store.learner(id);
    if (!learner) return res.status(404).json({ message: "English Explorer isn't turned on for this student." });
    const nowMs = now();
    const [words, units, sessions] = await Promise.all([store.words(id), store.units(id), store.doneSessions([id], new Date(nowMs - HISTORY_DAYS * 86400_000).toISOString())]);
    const teacher = person.teacherId ? await dir.user(person.teacherId).catch(() => null) : null;
    const by = learner.enabled_by ? await dir.user(learner.enabled_by).catch(() => null) : null;
    const grade = dir.gradeOf ? await dir.gradeOf(id).catch(() => null) : null;
    const summary = summaryOf(learner, person, words, units, sessions, nowMs, { teacherName: teacher?.displayName || "", grade, enabledBy: by?.displayName || "" });
    const unitMap = new Map(units.map((u) => [u.unit_id, u]));
    const wordMap = new Map(words.map((w) => [w.word_id, w]));
    const month = sessions.filter((s) => s.started_at >= new Date(nowMs - 30 * 86400_000).toISOString());
    const days: { day: string; minutes: number; sessions: number; points: number }[] = [];
    for (let d = 13; d >= 0; d--) {
      const day = denverDay(nowMs - d * 86400_000);
      const list = sessions.filter((s) => denverDay(Date.parse(s.finished_at || s.started_at)) === day);
      days.push({ day, minutes: Math.round(list.reduce((m, s) => m + minutesOf(s), 0)), sessions: list.length, points: list.reduce((p, s) => p + s.points, 0) });
    }
    // Words missed most, that aren't mastered yet.
    const trouble = words.filter((w) => w.wrong > 0 && w.box < MASTERED_BOX).sort((a, b) => b.wrong - a.wrong || a.box - b.box).slice(0, 12)
      .map((w) => { const x = wordById(w.word_id); return x ? { w: x.w, e: x.e, es: x.es, wrong: w.wrong, right: w.right, box: w.box } : null; }).filter(Boolean);
    const speaking = sessions.flatMap((s) => s.items.map((it, i) => ({ it, a: s.answers[i], at: s.finished_at }))).filter((x) => x.it.kind === "speak" && x.a && !x.a.skipped);
    res.json({
      summary,
      skills: SKILLS.map((k) => { const m = tally(month).skills[k], a = tally(sessions).skills[k]; return { skill: k, right30: m[0], total30: m[1], right: a[0], total: a[1] }; }),
      levels: LEVELS.map((l) => ({
        n: l.n, title: l.title, wida: l.wida, color: l.color,
        units: l.units.map((u) => {
          const p = unitMap.get(u.id);
          const ws = u.words.map((w) => wordStatus(wordMap.get(w.id)));
          return { id: u.id, title: u.title, icon: u.icon, stars: p?.stars || 0, best: p?.best || 0, plays: p?.plays || 0, last: p?.last_at || null, mastered: ws.filter((x) => x === "mastered").length, learning: ws.filter((x) => x === "learning").length, words: u.words.length };
        }),
      })),
      words: {
        mastered: words.filter((w) => w.box >= MASTERED_BOX).map((w) => wordById(w.word_id)).filter(Boolean).map((w) => ({ w: w!.w, e: w!.e })),
        learning: words.filter((w) => w.box > 0 && w.box < MASTERED_BOX).map((w) => ({ x: wordById(w.word_id), box: w.box })).filter((y) => y.x).map((y) => ({ w: y.x!.w, e: y.x!.e, box: y.box })),
      },
      trouble,
      days,
      speaking: { tried: speaking.length, right: speaking.filter((x) => x.a!.ok).length, recent: speaking.slice(0, 8).map((x) => ({ word: x.it.answer, heard: x.a!.heard || "", ok: x.a!.ok, at: x.at })) },
      sessions: sessions.slice(0, 25).map((s) => ({ at: s.finished_at, kind: s.kind, unit: s.unit_id ? unitById(s.unit_id)?.title || s.unit_id : "Word review", score: s.score, total: s.total, stars: s.stars, points: s.points, minutes: Math.round(minutesOf(s) * 10) / 10 })),
    });
  }));

  app.get("/api/english/staff/students", auth, staffOnly(async (req, res, v) => {
    const q = String(req.query?.q || "").trim().toLowerCase();
    const [students, rows] = await Promise.all([dir.students(), store.learners()]);
    const on = new Map(rows.map((r) => [r.student_id, r.enabled]));
    const list = students.filter((s) => !s.archived && canSee(v, s) && (!q || s.displayName.toLowerCase().includes(q) || s.username.toLowerCase().includes(q)))
      .sort((a, b) => Number(b.teacherId === v.id) - Number(a.teacherId === v.id) || a.displayName.localeCompare(b.displayName)).slice(0, 40);
    const names = new Map<number, string>();
    for (const s of list) if (s.teacherId && !names.has(s.teacherId)) names.set(s.teacherId, (await dir.user(s.teacherId).catch(() => null))?.displayName || "");
    res.json({ students: list.map((s) => ({ id: s.id, name: s.displayName, username: s.username, teacherName: s.teacherId ? names.get(s.teacherId) || "" : "", mine: s.teacherId === v.id, enabled: on.get(s.id) === true, added: on.has(s.id) })) });
  }));

  app.post("/api/english/staff/learners/:id", auth, staffOnly(async (req, res, v) => {
    const id = Number(req.params.id);
    const person = await dir.user(id);
    if (!person || person.role !== "student" || person.archived || !canSee(v, person)) return res.status(404).json({ message: "That student wasn't found." });
    const prev = await store.learner(id);
    const b = req.body || {};
    const lang = b.homeLanguage === null || b.homeLanguage === "" ? null : HOME_LANGUAGES.some((l) => l.id === b.homeLanguage) ? String(b.homeLanguage) : prev?.home_language ?? null;
    const stamp = new Date(now()).toISOString();
    const row: LearnerRow = {
      student_id: id,
      enabled: typeof b.enabled === "boolean" ? b.enabled : prev?.enabled ?? true,
      start_level: Number.isInteger(Number(b.startLevel)) && Number(b.startLevel) >= 1 && Number(b.startLevel) <= MAX_LEVEL ? Number(b.startLevel) : prev?.start_level ?? 1,
      home_language: lang,
      help_on: typeof b.helpOn === "boolean" ? b.helpOn : prev?.help_on ?? true,
      note: typeof b.note === "string" ? b.note.trim().slice(0, 300) : prev?.note ?? "",
      enabled_by: prev?.enabled_by ?? v.id,
      enabled_at: prev?.enabled_at || stamp,
      updated_at: stamp,
    };
    if (row.enabled && prev && !prev.enabled) { row.enabled_by = v.id; row.enabled_at = stamp; }
    await store.saveLearner(row);
    if (row.enabled && !prev?.enabled) dir.notify?.(id, { title: "English Explorer", body: "English Explorer is ready for you! Learn new English words and earn points.", url: "/#/english" })?.catch?.(() => {});
    res.json({ ok: true, learner: { enabled: row.enabled, startLevel: row.start_level, homeLanguage: row.home_language, helpOn: row.help_on, note: row.note } });
  }));

  app.get("/api/english/staff/export.csv", auth, staffOnly(async (_req, res, v) => {
    const { rows } = await summaries(v);
    const cell = (x: unknown) => { const s = x === null || x === undefined ? "" : String(x); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const head = ["Student", "Username", "Teacher", "Grade", "On", "Home language", "Level", "Level name", "Units done (all levels)", "Words mastered", "Words learning", "Words due", "Accuracy last 7 days %", "Accuracy all %", "Minutes last 7 days", "Lessons last 7 days", "Streak days", "English points", "Last active", "Turned on by"];
    const lines = [head.join(",")].concat(rows.map((r) => [r.name, r.username, r.teacherName, r.grade, r.enabled ? "yes" : "no", r.homeLanguageName, r.level, r.levelTitle, `${r.unitsDoneAll}/${r.unitsAll}`, r.wordsMastered, r.wordsLearning, r.due, r.accuracy7, r.accuracy, r.minutes7, r.sessions7, r.streak, r.points, r.lastActive ? denverDay(Date.parse(r.lastActive)) : "", r.enabledBy].map(cell).join(",")));
    res.set?.("Content-Disposition", `attachment; filename="english-learners-${denverDay(now())}.csv"`);
    res.type?.("text/csv");
    res.send(lines.join("\n"));
  }));
}
