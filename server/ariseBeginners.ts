// A.R.I.S.E. Beginners, inside A.R.I.S.E. Reader (the student page is #/beginners). Reader for younger readers:
// the same accounts, the same leaderboards, the same points and the same prizes. The program itself is in
// shared/beginners (curriculum, phonics, the Reading Coach's scoring and Say It Studio).
//
// Rules kept here, on the server:
// - The answer key for the story questions stays here. Each answer is checked when it's given, and only the
//   first try counts.
// - The read-aloud score is worked out here, from the recording: it's sent to the transcription service, lined up
//   with the story, and scored. The recording itself is never stored.
// - Points go to manual_point_awards, which every Reader leaderboard reads (all-time, monthly, the Advisory
//   Challenge) and which counts toward rewards. A lesson's first pass also counts as a passed quiz toward
//   prize goals (beginnersPassTimes, used by server/prizes.ts through routes.ts). At most POINTS.dailyCap a day.
// - Teachers, parents and the administrator can try everything in preview: nothing is saved or scored.
// - Progress is one small JSON record per student in the settings table (beginners_progress_<id>), so there's no
//   migration to run. Lessons in progress are kept in memory; a restart only means starting that lesson again.
import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { createAttemptLimiter } from "./attemptLimiter";
import {
  LESSONS, NAMES, POINTS, UNITS, isBeginnerGrade, lessonById, nextLesson, starsFor, unitOpen, voiceTexts, WORDS, heartWord,
} from "../shared/beginners";
import { checkWord, scoreReading, type ReadingResult } from "../shared/beginners/reading";
import { normWord, sameWord } from "../shared/beginners/phonics";
import { sayItWord, sayItCategory } from "../shared/beginners/sayit";
import type { EnglishSpeech } from "./ariseEnglish";

/* ------------------------------------------------------------------ progress */

export type LessonRecord = {
  stars: number;
  /** Best share of the story questions right (0–100). */
  best: number;
  /** Best read-aloud accuracy (0–100), or null when the story was never read out loud. */
  read: number | null;
  wcpm: number | null;
  plays: number;
  /** When it was first passed (ISO), or null. */
  first: string | null;
  last: string;
};
export type ReadingRecord = { lesson: string; at: string; accuracy: number; wcpm: number; seconds: number; words: number };
export type BeginnersProgress = {
  v: 1;
  startUnit: number;
  lessons: Record<string, LessonRecord>;
  /** Beginners points earned each Denver day (the last 60 days). */
  days: Record<string, number>;
  /** Replays rewarded each day. */
  replays: Record<string, number>;
  sayit: { day: string; right: number; tries: number; points: number };
  /** Words to practice, from the read-aloud misses (newest first). */
  practice: string[];
  /** The latest readings (newest first). */
  readings: ReadingRecord[];
  /** Every Beginners point ever earned. */
  total: number;
};

export const emptyProgress = (): BeginnersProgress => ({ v: 1, startUnit: 1, lessons: {}, days: {}, replays: {}, sayit: { day: "", right: 0, tries: 0, points: 0 }, practice: [], readings: [], total: 0 });
const num = (v: unknown, lo: number, hi: number, d = lo) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d; };
const dayKey = /^\d{4}-\d{2}-\d{2}$/;

/** Cleans a saved record (anything unexpected is dropped, never trusted). */
export function cleanProgress(raw: unknown): BeginnersProgress {
  const p = emptyProgress();
  const r: any = raw && typeof raw === "object" ? raw : {};
  p.startUnit = num(r.startUnit, 1, UNITS.length, 1);
  if (r.lessons && typeof r.lessons === "object") {
    for (const [id, v] of Object.entries<any>(r.lessons)) {
      if (!lessonById(id) || !v || typeof v !== "object") continue;
      p.lessons[id] = {
        stars: num(v.stars, 0, 3), best: num(v.best, 0, 100), read: v.read === null || v.read === undefined ? null : num(v.read, 0, 100),
        wcpm: v.wcpm === null || v.wcpm === undefined ? null : num(v.wcpm, 0, 400), plays: num(v.plays, 0, 100000),
        first: typeof v.first === "string" && !Number.isNaN(Date.parse(v.first)) ? v.first : null, last: typeof v.last === "string" ? v.last : "",
      };
    }
  }
  for (const key of ["days", "replays"] as const) {
    if (r[key] && typeof r[key] === "object") for (const [d, v] of Object.entries(r[key])) if (dayKey.test(d)) p[key][d] = num(v, 0, 100000);
  }
  if (r.sayit && typeof r.sayit === "object") p.sayit = { day: dayKey.test(String(r.sayit.day)) ? String(r.sayit.day) : "", right: num(r.sayit.right, 0, 100000), tries: num(r.sayit.tries, 0, 100000), points: num(r.sayit.points, 0, 1000) };
  if (Array.isArray(r.practice)) p.practice = r.practice.filter((w: unknown) => typeof w === "string" && /^[a-z']{1,20}$/i.test(w)).slice(0, 30);
  if (Array.isArray(r.readings)) {
    p.readings = r.readings.filter((x: any) => x && lessonById(String(x.lesson))).slice(0, 60).map((x: any) => ({
      lesson: String(x.lesson), at: String(x.at || ""), accuracy: num(x.accuracy, 0, 100), wcpm: num(x.wcpm, 0, 400), seconds: num(x.seconds, 0, 3600), words: num(x.words, 0, 1000),
    }));
  }
  p.total = num(r.total, 0, 10_000_000);
  return p;
}
/** Keeps only the last 60 days of daily counts. */
function trimDays(rec: Record<string, number>, today: string) {
  const keys = Object.keys(rec).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 60))) if (k !== today) delete rec[k];
}
const passedIds = (p: BeginnersProgress) => new Set(Object.entries(p.lessons).filter(([, l]) => l.first).map(([id]) => id));
export const denverDay = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/Denver" });
/** Days in a row with at least one lesson or reading, counting today or yesterday. */
export function streakOf(p: BeginnersProgress, nowMs: number): number {
  const days = new Set<string>();
  for (const l of Object.values(p.lessons)) if (l.last) days.add(denverDay(Date.parse(l.last)));
  for (const r of p.readings) if (r.at) days.add(denverDay(Date.parse(r.at)));
  let d = denverDay(nowMs);
  if (!days.has(d)) d = denverDay(nowMs - 86400_000);
  let n = 0, t = Date.parse(`${d}T12:00:00Z`);
  while (days.has(denverDay(t))) { n++; t -= 86400_000; }
  return n;
}

/* ------------------------------------------------------------------ store */

export interface BeginnersStore {
  load(studentId: number): Promise<BeginnersProgress | null>;
  save(studentId: number, p: BeginnersProgress): Promise<void>;
  loadMany(ids: number[]): Promise<Map<number, BeginnersProgress>>;
  /** Every student who has Beginners progress (for the administrator). */
  everyone(): Promise<number[]>;
  /** Puts points on the A.R.I.S.E. leaderboards. */
  awardPoints(studentId: number, points: number, reason: string, day: string): Promise<void>;
}
const KEY = (id: number) => `beginners_progress_${id}`;

export function createSupabaseBeginnersStore(client?: any): BeginnersStore {
  const db = async () => client ?? (await import("./supabase")).getAdminSupabase();
  const fail = (error: any) => { if (error) throw new Error(error.message || String(error)); };
  const parse = (value: string | null | undefined) => { try { return value ? cleanProgress(JSON.parse(value)) : null; } catch { return null; } };
  return {
    async load(id) {
      // Read straight from the database (the cached setting read could hand back an old copy).
      const r = await (await db()).from("settings").select("value").eq("key", KEY(id)).maybeSingle();
      fail(r.error);
      return parse(r.data?.value);
    },
    async save(id, p) { fail((await (await db()).from("settings").upsert({ key: KEY(id), value: JSON.stringify(p) }, { onConflict: "key" })).error); },
    async loadMany(ids) {
      const out = new Map<number, BeginnersProgress>();
      const c = await db();
      for (let i = 0; i < ids.length; i += 200) {
        const part = ids.slice(i, i + 200);
        const r = await c.from("settings").select("key,value").in("key", part.map(KEY));
        fail(r.error);
        for (const row of r.data || []) { const p = parse(row.value); const id = Number(String(row.key).replace("beginners_progress_", "")); if (p && id) out.set(id, p); }
      }
      return out;
    },
    async everyone() {
      const r = await (await db()).from("settings").select("key").like("key", "beginners_progress_%").limit(5000);
      fail(r.error);
      return (r.data || []).map((row: any) => Number(String(row.key).replace("beginners_progress_", ""))).filter((n: number) => Number.isSafeInteger(n) && n > 0);
    },
    async awardPoints(id, points, reason, day) {
      fail((await (await db()).from("manual_point_awards").insert({ student_id: id, awarded_by: null, points, reason: reason.slice(0, 200), earned_on: day })).error);
    },
  };
}

/** In-memory store for tests. */
export function createMemoryBeginnersStore() {
  const rows = new Map<number, BeginnersProgress>();
  const awards: { student_id: number; points: number; reason: string; day: string }[] = [];
  const store: BeginnersStore & { rows: typeof rows; awards: typeof awards } = {
    rows, awards,
    async load(id) { const p = rows.get(id); return p ? cleanProgress(JSON.parse(JSON.stringify(p))) : null; },
    async save(id, p) { rows.set(id, cleanProgress(JSON.parse(JSON.stringify(p)))); },
    async loadMany(ids) { return new Map(ids.filter((id) => rows.has(id)).map((id) => [id, rows.get(id)!])); },
    async everyone() { return [...rows.keys()]; },
    async awardPoints(id, points, reason, day) { awards.push({ student_id: id, points, reason, day }); },
  };
  return store;
}

let defaultStore: BeginnersStore | null = null;
/** When each lesson was first passed (milliseconds): these count as passed quizzes toward prize goals. */
export async function beginnersPassTimes(studentId: number, store: BeginnersStore = (defaultStore ??= createSupabaseBeginnersStore())): Promise<number[]> {
  try {
    const p = await store.load(studentId);
    return p ? Object.values(p.lessons).map((l) => (l.first ? Date.parse(l.first) : NaN)).filter((t) => Number.isFinite(t)) : [];
  } catch { return []; }
}

/* ------------------------------------------------------------------ routes */

export type BeginnersPerson = { id: number; role: "student" | "teacher" | "parent" | "admin"; displayName: string; teacherId: number | null; schoolId: number | null };
export type BeginnersDirectory = {
  user(id: number): Promise<BeginnersPerson | null>;
  /** The students in a teacher's class. */
  studentsOf(teacherId: number): Promise<BeginnersPerson[]>;
  /** The children linked to a parent. */
  childrenOf(parentId: number): Promise<number[]>;
  gradeOf?(id: number): Promise<string | null>;
  /** Points changed: the leaderboards should be worked out again. */
  pointsChanged?(): void;
};
export type BeginnersDeps = {
  store?: BeginnersStore; directory: BeginnersDirectory; speech?: EnglishSpeech; now?: () => number; random?: () => number;
  /** Reads an audio recording into req.body as a Buffer (express.raw for audio types). */
  audioBody?: RequestHandler;
};

type Session = {
  id: string; studentId: number; lessonId: string; preview: boolean; startedAt: number;
  /** The choices of each question, in the order shown. */
  choices: string[][];
  answers: (boolean | null)[];
  reading: ReadingResult | null;
  reads: number;
  done: boolean;
};
const SESSION_TTL = 4 * 3600_000;
const STARTS_PER_DAY = 80;
/** A lesson finished faster than this earns no points (nobody reads a story and builds nine words in 40 seconds). */
const MIN_LESSON_MS = 40_000;
const MAX_AUDIO = 6_000_000;

export function registerBeginnersRoutes(app: Express, auth: RequestHandler, deps: BeginnersDeps) {
  const store = deps.store ?? (defaultStore ??= createSupabaseBeginnersStore());
  const dir = deps.directory;
  const now = deps.now ?? Date.now;
  const random = deps.random ?? Math.random;
  const speech = deps.speech;
  const voiceOk = voiceTexts();
  const voiceTries = createAttemptLimiter({ max: 900, windowMs: 10 * 60_000, now });
  const listenTries = createAttemptLimiter({ max: 60, windowMs: 10 * 60_000, now });
  const readTries = createAttemptLimiter({ max: 20, windowMs: 10 * 60_000, now });
  const starts = new Map<number, number[]>();
  const sessions = new Map<string, Session>();
  const audio = deps.audioBody ? [deps.audioBody] : [];

  type Viewer = { id: number; role: BeginnersPerson["role"]; preview: boolean; name: string };
  const roleOf = (u: any): BeginnersPerson["role"] => (u?.isAdmin ? "admin" : u?.role === "teacher" ? "teacher" : u?.role === "parent" ? "parent" : "student");
  const viewer = (req: any): Viewer => {
    const u = req.user || {};
    const role = req.adminPreview ? "student" : roleOf(u);
    return { id: Number(u.id), role, preview: !!req.adminPreview || role !== "student", name: String(u.displayName || u.username || "") };
  };
  const handle = (fn: (req: any, res: any) => Promise<unknown>) => async (req: any, res: any) => {
    try { res.set?.("Cache-Control", "no-store"); await fn(req, res); }
    catch (error: any) { console.error("[beginners]", error?.message || error); res.status(500).json({ message: "Something went wrong. Please try again." }); }
  };
  const prune = () => {
    const cutoff = now() - SESSION_TTL;
    for (const [id, s] of sessions) if (s.startedAt < cutoff) sessions.delete(id);
    while (sessions.size > 20_000) sessions.delete(sessions.keys().next().value as string);
  };
  const loadOrNew = async (id: number) => (await store.load(id)) || emptyProgress();
  const audioOf = (req: any): { buf: Buffer; mime: string } | null => {
    const buf: Buffer = req.body;
    const mime = String(req.headers?.["content-type"] || "").split(";")[0].toLowerCase();
    if (!Buffer.isBuffer(buf) || buf.length < 400 || buf.length > MAX_AUDIO) return null;
    return { buf, mime };
  };
  /** Awards points within the daily cap; returns what was actually given. */
  async function award(v: Viewer, p: BeginnersProgress, want: number, reason: string): Promise<{ points: number; capped: boolean }> {
    const today = denverDay(now());
    trimDays(p.days, today);
    const room = Math.max(0, POINTS.dailyCap - (p.days[today] || 0));
    const points = Math.max(0, Math.min(want, room));
    if (points > 0) {
      await store.awardPoints(v.id, points, reason, today);
      p.days[today] = (p.days[today] || 0) + points;
      p.total += points;
      dir.pointsChanged?.();
    }
    return { points, capped: points < want };
  }

  /* ---------- who am I, and my map */
  app.get("/api/beginners/me", auth, handle(async (req, res) => {
    const v = viewer(req);
    const p = v.preview ? emptyProgress() : await loadOrNew(v.id);
    const nowMs = now();
    const today = denverDay(nowMs);
    const done = passedIds(p);
    const grade = v.role === "student" && dir.gradeOf ? await dir.gradeOf(v.id).catch(() => null) : null;
    res.json({
      name: v.name.split(" ")[0] || "Reader", role: v.role, preview: v.preview, staff: v.role === "teacher" || v.role === "admin", parent: v.role === "parent",
      grade, beginnerGrade: isBeginnerGrade(grade),
      startUnit: p.startUnit,
      lessons: p.lessons,
      open: UNITS.filter((u) => v.preview || unitOpen(u.n, done, p.startUnit)).map((u) => u.n),
      next: nextLesson(done, p.startUnit)?.id || null,
      nextTitle: nextLesson(done, p.startUnit)?.title || null,
      today: { points: p.days[today] || 0, cap: POINTS.dailyCap },
      total: p.total,
      streak: streakOf(p, nowMs),
      practice: p.practice,
      readings: p.readings.slice(0, 12),
      sayit: { right: p.sayit.day === today ? p.sayit.right : 0, points: p.sayit.day === today ? p.sayit.points : 0, max: POINTS.sayItMax, every: POINTS.sayItWords },
    });
  }));

  /* ---------- the premium AI voice (only what's in the program) */
  app.post("/api/beginners/voice", auth, handle(async (req, res) => {
    const v = viewer(req);
    const text = String(req.body?.text || "").trim();
    const slow = !!req.body?.slow;
    if (!text || !voiceOk.has(text.toLowerCase())) return res.status(400).json({ message: "That isn't part of Beginners." });
    if (voiceTries.retryAfter(String(v.id)) > 0) return res.status(429).json({ message: "Slow down a little, then try again." });
    voiceTries.fail(String(v.id));
    if (!speech) return res.status(503).json({ message: "The voice isn't available right now." });
    try {
      const mp3 = await speech.say(text, "en", slow);
      res.set?.("Cache-Control", "private, max-age=86400");
      res.type?.("audio/mpeg");
      res.send(mp3);
    } catch (error: any) {
      console.error("[beginners-voice]", error?.message || error);
      res.status(502).json({ message: "The voice isn't available right now." });
    }
  }));

  /* ---------- a lesson */
  app.post("/api/beginners/lessons/:id/start", auth, handle(async (req, res) => {
    const v = viewer(req);
    const lesson = lessonById(String(req.params.id));
    if (!lesson) return res.status(404).json({ message: "That lesson wasn't found." });
    if (!v.preview) {
      const p = await loadOrNew(v.id);
      if (!unitOpen(lesson.unit, passedIds(p), p.startUnit)) return res.status(403).json({ message: "Finish the lessons before this one first." });
      const recent = (starts.get(v.id) || []).filter((t) => t > now() - 86400_000);
      if (recent.length >= STARTS_PER_DAY) return res.status(429).json({ message: "That's a lot of reading for one day! Come back tomorrow." });
      recent.push(now()); starts.set(v.id, recent);
    }
    prune();
    const choices = lesson.questions.map((q) => {
      const list = [q.right, ...q.wrong];
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      return list;
    });
    const s: Session = { id: randomUUID(), studentId: v.id, lessonId: lesson.id, preview: v.preview, startedAt: now(), choices, answers: choices.map(() => null), reading: null, reads: 0, done: false };
    sessions.set(s.id, s);
    res.json({ id: s.id, lesson: lesson.id, questions: lesson.questions.map((q, i) => ({ q: q.q, choices: choices[i] })) });
  }));

  const own = (req: any, res: any): Session | null => {
    const v = viewer(req);
    const s = sessions.get(String(req.params.id));
    if (!s || s.studentId !== v.id) { res.status(404).json({ message: "That lesson has ended. Please start it again." }); return null; }
    if (s.done) { res.status(409).json({ message: "This lesson is already finished." }); return null; }
    return s;
  };

  app.post("/api/beginners/sessions/:id/answer", auth, handle(async (req, res) => {
    const s = own(req, res); if (!s) return;
    const lesson = lessonById(s.lessonId)!;
    const i = Number(req.body?.index);
    if (!Number.isInteger(i) || i < 0 || i >= lesson.questions.length) return res.status(400).json({ message: "That question wasn't found." });
    const correct = String(req.body?.answer ?? "") === lesson.questions[i].right;
    const first = s.answers[i] === null;
    if (first) s.answers[i] = correct;
    res.json({ correct, right: lesson.questions[i].right, firstTry: first });
  }));

  /* ---------- reading the story out loud (the Reading Coach) */
  app.post("/api/beginners/sessions/:id/read", auth, ...audio, handle(async (req, res) => {
    const s = own(req, res); if (!s) return;
    const key = String(s.studentId);
    if (readTries.retryAfter(key) > 0) return res.status(429).json({ message: "Let's take a short break from the microphone." });
    const a = audioOf(req);
    if (!a) return res.status(400).json({ message: "I didn't hear anything. Try again a little louder." });
    readTries.fail(key);
    if (!speech) return res.status(503).json({ message: "Listening isn't available right now." });
    const lesson = lessonById(s.lessonId)!;
    const seconds = num(req.query?.seconds ?? req.headers?.["x-seconds"], 2, 600, 30);
    let heard = "";
    try { heard = (await speech.hear(a.buf, a.mime)).slice(0, 4000); }
    catch (error: any) { console.error("[beginners-read]", error?.message || error); return res.status(502).json({ message: "I couldn't listen that time. Please try again." }); }
    const result = scoreReading(lesson.text, heard, seconds, NAMES);
    s.reads++;
    // Keep the best reading of this lesson: more words read, then more accurate.
    const better = !s.reading || result.correct > s.reading.correct || (result.correct === s.reading.correct && result.accuracy > s.reading.accuracy);
    if (better) s.reading = result;
    res.json({ ...result, transcript: heard });
  }));

  /* ---------- saying one word (Say It, practice words and Say It Studio) */
  app.post("/api/beginners/say", auth, ...audio, handle(async (req, res) => {
    const v = viewer(req);
    const word = String(req.query?.word || "").trim().slice(0, 40);
    const setId = String(req.query?.set || "").trim();
    const studio = setId ? sayItWord(setId, word) : null;
    const known = studio || WORDS.has(normWord(word)) || !!heartWord(normWord(word)) || LESSONS.some((l) => l.text.toLowerCase().includes(word.toLowerCase()));
    if (!word || !known) return res.status(400).json({ message: "That word isn't part of Beginners." });
    if (setId && (!studio || !sayItCategory(setId)?.check)) return res.status(400).json({ message: "That word is practiced with the voice bar only." });
    const key = String(v.id);
    if (listenTries.retryAfter(key) > 0) return res.status(429).json({ message: "Let's take a short break from the microphone." });
    const a = audioOf(req);
    if (!a) return res.status(400).json({ message: "I didn't hear anything. Try again a little louder." });
    listenTries.fail(key);
    if (!speech) return res.status(503).json({ message: "Listening isn't available right now." });
    let heard = "";
    try { heard = (await speech.hear(a.buf, a.mime)).slice(0, 200); }
    catch (error: any) { console.error("[beginners-say]", error?.message || error); return res.status(502).json({ message: "I couldn't listen that time. Please try again." }); }
    const check = checkWord(word, heard);
    const alt = studio?.alt || [];
    const correct = check.correct || alt.some((x) => heard.toLowerCase().split(/[^a-z0-9']+/).map(normWord).some((h) => sameWord(h, normWord(x)) || h === normWord(x)));
    let points = 0;
    if (studio && !v.preview) {
      const p = await loadOrNew(v.id);
      const today = denverDay(now());
      if (p.sayit.day !== today) p.sayit = { day: today, right: 0, tries: 0, points: 0 };
      p.sayit.tries++;
      if (correct) {
        p.sayit.right++;
        const earned = Math.min(POINTS.sayItMax, Math.floor(p.sayit.right / POINTS.sayItWords));
        if (earned > p.sayit.points) {
          const got = await award(v, p, earned - p.sayit.points, "Beginners: Say It Studio");
          // Counted as given even when the daily cap held some back, so the same words never pay twice.
          p.sayit.points = earned;
          points = got.points;
        }
      }
      await store.save(v.id, p);
    }
    res.json({ heard: check.heard, correct, close: !correct && check.close, points });
  }));

  /* ---------- finishing a lesson */
  app.post("/api/beginners/sessions/:id/finish", auth, handle(async (req, res) => {
    const s = own(req, res); if (!s) return;
    const v = viewer(req);
    const lesson = lessonById(s.lessonId)!;
    const nowMs = now();
    s.done = true;
    sessions.delete(s.id);
    const right = s.answers.filter((a) => a === true).length;
    const total = lesson.questions.length;
    const readAccuracy = s.reading && s.reading.attempted >= Math.min(8, s.reading.total) ? s.reading.accuracy : null;
    const stars = starsFor({ right, total, readAccuracy });
    const out = {
      stars, right, total, readAccuracy, wcpm: readAccuracy !== null ? s.reading!.wcpm : null, points: 0, capped: false, firstPass: false,
      tooFast: false, preview: s.preview, next: null as string | null, unitDone: false, nextUnitOpen: null as number | null, streak: 0, totalPoints: 0,
    };
    if (s.preview) return res.json(out);
    const p = await loadOrNew(v.id);
    const before = passedIds(p);
    const prev = p.lessons[lesson.id];
    const iso = new Date(nowMs).toISOString();
    // Too fast to be real: nothing counts as passed, so the lesson's points are still there to earn properly.
    const tooFast = nowMs - s.startedAt < MIN_LESSON_MS;
    const rec: LessonRecord = {
      stars: Math.max(prev?.stars || 0, stars), best: Math.max(prev?.best || 0, Math.round((right / total) * 100)),
      read: readAccuracy === null ? prev?.read ?? null : Math.max(prev?.read ?? 0, readAccuracy),
      wcpm: readAccuracy === null ? prev?.wcpm ?? null : Math.max(prev?.wcpm ?? 0, s.reading!.wcpm),
      plays: (prev?.plays || 0) + 1, first: prev?.first || (stars > 0 && !tooFast ? iso : null), last: iso,
    };
    p.lessons[lesson.id] = rec;
    if (s.reading && s.reading.attempted > 0) {
      p.readings.unshift({ lesson: lesson.id, at: iso, accuracy: s.reading.accuracy, wcpm: s.reading.wcpm, seconds: s.reading.seconds, words: s.reading.attempted });
      p.readings = p.readings.slice(0, 60);
      const missed = s.reading.practice.map((w) => w.toLowerCase());
      p.practice = [...new Set([...missed, ...p.practice])].slice(0, 30);
    }
    out.tooFast = tooFast;
    const today = denverDay(nowMs);
    if (stars > 0 && !tooFast) {
      if (!prev?.first) {
        out.firstPass = true;
        const want = lesson.points + (readAccuracy !== null && readAccuracy >= 90 ? POINTS.readBonus : 0);
        const got = await award(v, p, want, `Beginners: ${lesson.title}`);
        out.points = got.points; out.capped = got.capped;
      } else if ((p.replays[today] || 0) < POINTS.replaysPerDay) {
        p.replays[today] = (p.replays[today] || 0) + 1;
        trimDays(p.replays, today);
        const got = await award(v, p, POINTS.replay, `Beginners: practiced ${lesson.title}`);
        out.points = got.points; out.capped = got.capped;
      }
    }
    await store.save(v.id, p);
    const after = passedIds(p);
    const unit = UNITS.find((u) => u.n === lesson.unit)!;
    out.unitDone = unit.lessons.every((l) => after.has(l.id)) && !unit.lessons.every((l) => before.has(l.id));
    const nextUnit = UNITS.find((u) => u.n === lesson.unit + 1);
    out.nextUnitOpen = out.unitDone && nextUnit && unitOpen(nextUnit.n, after, p.startUnit) ? nextUnit.n : null;
    out.next = nextLesson(after, p.startUnit)?.id || null;
    out.streak = streakOf(p, nowMs);
    out.totalPoints = p.total;
    res.json(out);
  }));

  /* ---------- teachers, parents and the administrator */

  /** The students this person may see: a teacher's class, a parent's children, or (administrator) everyone with progress. */
  async function visibleStudents(v: Viewer): Promise<BeginnersPerson[]> {
    if (v.role === "teacher") return dir.studentsOf(v.id);
    if (v.role === "parent") return (await Promise.all((await dir.childrenOf(v.id)).map((id) => dir.user(id)))).filter((u): u is BeginnersPerson => !!u && u.role === "student");
    if (v.role === "admin") return (await Promise.all((await store.everyone()).slice(0, 2000).map((id) => dir.user(id)))).filter((u): u is BeginnersPerson => !!u && u.role === "student");
    return [];
  }
  const summary = (person: BeginnersPerson, p: BeginnersProgress | undefined, grade: string | null) => {
    const prog = p || emptyProgress();
    const done = passedIds(prog);
    const next = nextLesson(done, prog.startUnit);
    const recent = prog.readings.slice(0, 5);
    const lastAt = [...Object.values(prog.lessons).map((l) => l.last), ...prog.readings.map((r) => r.at)].filter(Boolean).sort().pop() || null;
    return {
      id: person.id, name: person.displayName, grade, startUnit: prog.startUnit, passed: done.size, lessons: LESSONS.length,
      stars: Object.values(prog.lessons).reduce((t, l) => t + l.stars, 0), points: prog.total,
      next: next ? { id: next.id, title: next.title, unit: next.unit } : null,
      reading: recent.length ? { accuracy: Math.round(recent.reduce((t, r) => t + r.accuracy, 0) / recent.length), wcpm: Math.round(recent.reduce((t, r) => t + r.wcpm, 0) / recent.length), count: prog.readings.length } : null,
      readings: prog.readings.slice(0, 8), practice: prog.practice.slice(0, 8), lastAt,
    };
  };

  app.get("/api/beginners/students", auth, handle(async (req, res) => {
    const v = viewer(req);
    if (req.adminPreview || v.role === "student") return res.status(403).json({ message: "This is for teachers, parents and the administrator." });
    const people = await visibleStudents(v);
    const rows = await store.loadMany(people.map((s) => s.id));
    const grades = await Promise.all(people.map((s) => (dir.gradeOf ? dir.gradeOf(s.id).catch(() => null) : Promise.resolve(null))));
    res.json({ students: people.map((s, i) => summary(s, rows.get(s.id), grades[i])).sort((a, b) => a.name.localeCompare(b.name)), units: UNITS.map((u) => ({ n: u.n, title: u.title, grade: u.grade })) });
  }));

  app.post("/api/beginners/students/:id/start-unit", auth, handle(async (req, res) => {
    const v = viewer(req);
    if (req.adminPreview || v.role === "student") return res.status(403).json({ message: "This is for teachers, parents and the administrator." });
    const id = Number(req.params.id);
    const unit = Number(req.body?.unit);
    if (!Number.isSafeInteger(id) || !Number.isInteger(unit) || unit < 1 || unit > UNITS.length) return res.status(400).json({ message: "Pick a unit from 1 to 18." });
    const person = await dir.user(id);
    const allowed = !!person && person.role === "student" && (v.role === "admin" || (v.role === "teacher" && person.teacherId === v.id) || (v.role === "parent" && (await dir.childrenOf(v.id)).includes(id)));
    if (!allowed) return res.status(403).json({ message: "You can only change this for your own students or children." });
    const p = await loadOrNew(id);
    p.startUnit = unit;
    await store.save(id, p);
    res.json({ ok: true, startUnit: unit });
  }));
}
