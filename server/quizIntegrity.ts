// No-proctor quizzes: a student takes a quiz on their own while the browser
// reports when they leave the quiz and sends a camera snapshot every 30 seconds.
// Teachers, parents and the admin review the record later; teachers and the
// admin can remove the points from a quiz that looks wrong.
import type { Express, RequestHandler } from "express";
import { randomBytes } from "node:crypto";

export const NO_PROCTOR = {
  snapshotEveryMs: 30_000,
  /** Leaving the quiz this many times turns it in (the first time is a warning). */
  leavesBeforeTurnIn: 2,
  sessionMs: 2 * 60 * 60 * 1000,
  /** A quiz turned in shortly after the session ran out is still accepted. */
  submitGraceMs: 10 * 60 * 1000,
  maxSnapshots: 160,
  minSnapshotGapMs: 1_500,
  maxSnapshotBytes: 200 * 1024,
  maxEvents: 600,
  keepSnapshotsDays: 30,
  /** How long after turning in a picture from that moment is still accepted. */
  lateSnapshotMs: 2 * 60 * 1000,
  bucket: "quiz-integrity",
} as const;

const SESSIONS = "quiz_integrity_sessions";
const EVENTS = "quiz_integrity_events";
/** Events the browser may report. "start", "snapshot" and "submitted" are written by the server. */
const CLIENT_EVENTS = new Set(["left", "returned", "warned", "copy", "camera_off", "camera_on", "resumed", "stopped"]);
const SNAPSHOT_REASONS = new Set(["start", "interval", "left", "returned", "camera", "resumed", "end"]);
const LIST_COLUMNS = "id,student_id,quiz_kind,quiz_id,status,created_at,submitted_at,score,total,points_awarded,duration_ms,leaves,away_ms,copy_attempts,camera_off,snapshot_count,auto_submitted,flag,flag_reasons,voided,void_reason,voided_at,restarts,snapshots_purged";

export type FlagLevel = "clear" | "review" | "high";
export type FlagReason = { level: "review" | "high"; text: string };
export type FlagInput = {
  leaves: number;
  awayMs: number;
  autoSubmitted: boolean;
  copyAttempts: number;
  cameraOff: number;
  snapshotCount: number;
  durationMs: number;
  questionCount: number;
  restarts: number;
};

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${String(s % 60).padStart(2, "0")} s`;
}

const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

/** Turns what happened during a quiz into a flag and plain reasons for the reviewer. */
export function computeFlags(x: FlagInput): { flag: FlagLevel; reasons: FlagReason[] } {
  const reasons: FlagReason[] = [];
  if (x.autoSubmitted) reasons.push({ level: "high", text: `Turned in automatically after leaving the quiz ${times(Math.max(2, x.leaves))}` });
  else if (x.leaves >= 2) reasons.push({ level: "high", text: `Left the quiz ${times(x.leaves)} (${formatDuration(x.awayMs)} away)` });
  else if (x.leaves === 1) reasons.push({ level: "review", text: `Left the quiz once (${formatDuration(x.awayMs)} away)` });
  if (x.copyAttempts > 0) reasons.push({ level: "review", text: `Tried to copy or paste ${times(x.copyAttempts)}` });
  if (x.cameraOff > 0) reasons.push({ level: "review", text: "The camera turned off during the quiz" });
  const expected = Math.floor(x.durationMs / NO_PROCTOR.snapshotEveryMs) + 1;
  if (x.durationMs > 90_000 && x.snapshotCount < Math.ceil(expected * 0.5)) {
    reasons.push({ level: "review", text: `Fewer camera pictures than expected (${x.snapshotCount} of about ${expected})` });
  }
  if (x.questionCount > 0 && x.durationMs < x.questionCount * 4_000) {
    reasons.push({ level: "review", text: `Finished very fast (${formatDuration(x.durationMs)} for ${x.questionCount} questions)` });
  }
  if (x.restarts > 0) {
    reasons.push({ level: x.restarts >= 2 ? "high" : "review", text: `Started this quiz ${times(x.restarts)} before without finishing` });
  }
  const flag: FlagLevel = reasons.some((r) => r.level === "high") ? "high" : reasons.length ? "review" : "clear";
  return { flag, reasons };
}

/** Adds up a session's event log. */
export function summarizeEvents(events: { type: string; detail?: any }[]) {
  let leaves = 0, awayMs = 0, copyAttempts = 0, cameraOff = 0, snapshotCount = 0;
  for (const e of events) {
    if (e.type === "left") leaves++;
    else if (e.type === "returned") awayMs += Math.min(NO_PROCTOR.sessionMs, Math.max(0, Number(e.detail?.ms) || 0));
    else if (e.type === "copy") copyAttempts++;
    else if (e.type === "camera_off") cameraOff++;
    else if (e.type === "snapshot") snapshotCount++;
  }
  return { leaves, awayMs, copyAttempts, cameraOff, snapshotCount };
}

function cleanEvents(raw: unknown): { type: string; detail: Record<string, unknown> | null }[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 50).flatMap((e: any) => {
    const type = String(e?.type || "");
    if (!CLIENT_EVENTS.has(type)) return [];
    const detail: Record<string, unknown> = {};
    if (typeof e.kind === "string") detail.kind = e.kind.slice(0, 20);
    if (Number.isFinite(Number(e.ms))) detail.ms = Math.max(0, Math.min(NO_PROCTOR.sessionMs, Math.round(Number(e.ms))));
    if (Number.isFinite(Number(e.t))) detail.t = Math.max(0, Math.min(NO_PROCTOR.sessionMs + NO_PROCTOR.submitGraceMs, Math.round(Number(e.t))));
    return [{ type, detail: Object.keys(detail).length ? detail : null }];
  });
}

/** Per question: when it was first answered (ms after the start) and how many times the answer changed. */
function cleanAnswerTimes(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, { first: number; changes: number }> = {};
  for (const [id, v] of Object.entries(raw as Record<string, any>).slice(0, 100)) {
    if (!/^\d{1,9}$/.test(id)) continue;
    const first = Number(v?.first), changes = Number(v?.changes);
    if (!Number.isFinite(first)) continue;
    out[id] = { first: Math.max(0, Math.round(first)), changes: Math.max(0, Math.min(99, Math.round(changes) || 0)) };
  }
  return Object.keys(out).length ? out : null;
}

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const isToken = (v: string) => /^[0-9a-f]{48}$/.test(v);

type Deps = {
  /** The server's Supabase client (service role). */
  db: () => any;
  isDemoStudent: (user: any) => boolean;
  hasAttempt: (userId: number, quizKind: "book", quizId: number) => Promise<boolean>;
  getTeacherStudentIds: (teacherId: number) => Promise<number[]>;
  getParentStudentIds: (parentId: number) => Promise<number[]>;
  /** Sets an attempt's points (and the student's total) to `points`. */
  setAttemptPoints: (attemptId: number, points: number) => Promise<unknown>;
};

export type IntegritySession = { id: string; student_id: number; quiz_kind: string; quiz_id: number; created_at: string; restarts: number };

export function registerQuizIntegrityRoutes(app: Express, authMiddleware: RequestHandler, deps: Deps) {
  // One client for all of these routes (snapshots arrive every 30 seconds per student).
  let client: any = null;
  const db = () => (client ??= deps.db());

  const logEvents = async (sessionId: string, events: { type: string; detail?: unknown }[]) => {
    if (!events.length) return;
    const { error } = await db().from(EVENTS).insert(events.map((e) => ({ session_id: sessionId, type: e.type, detail: e.detail ?? null })));
    if (error) throw error;
  };
  const byToken = async (token: string) => {
    if (!isToken(token)) return null;
    const { data, error } = await db().from(SESSIONS).select("*").eq("token", token).maybeSingle();
    if (error) throw error;
    return data;
  };
  const activeByToken = async (token: string) => {
    const s = await byToken(token);
    return s && s.status === "active" && Date.parse(s.expires_at) > Date.now() ? s : null;
  };
  /** Pictures taken at the moment of turning in (or of the leave that turned it in) can land just after it. */
  const acceptsSnapshots = (s: any) => {
    if (!s) return false;
    if (s.status === "active") return Date.parse(s.expires_at) > Date.now();
    return s.status === "submitted" && !!s.submitted_at && Date.now() - Date.parse(s.submitted_at) < NO_PROCTOR.lateSnapshotMs;
  };
  const countEvents = async (sessionId: string, type?: string) => {
    let q = db().from(EVENTS).select("id", { count: "exact", head: true }).eq("session_id", sessionId);
    if (type) q = q.eq("type", type);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  };

  /** Who is looking: the admin sees everything, teachers their roster, parents their linked children. */
  const scopeFor = async (req: any): Promise<{ role: "admin" | "teacher" | "parent"; studentIds: number[] | null; canVoid: boolean } | null> => {
    const u = req.user;
    if (u?.isAdmin && !req.adminPreview) return { role: "admin", studentIds: null, canVoid: true };
    if (u?.role === "teacher") return { role: "teacher", studentIds: await deps.getTeacherStudentIds(u.id), canVoid: true };
    if (u?.role === "parent") return { role: "parent", studentIds: await deps.getParentStudentIds(u.id), canVoid: false };
    return null;
  };
  const inScope = (scope: { studentIds: number[] | null }, studentId: number) => !scope.studentIds || scope.studentIds.includes(Number(studentId));

  const namesFor = async (studentIds: number[], quizIds: number[]) => {
    const [users, books] = await Promise.all([
      studentIds.length ? db().from("users").select("id,display_name,username").in("id", studentIds) : Promise.resolve({ data: [] as any[] }),
      quizIds.length ? db().from("books").select("id,title").in("id", quizIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    return {
      student: new Map<number, string>(((users as any).data || []).map((u: any) => [Number(u.id), String(u.display_name || u.username || "Student")])),
      quiz: new Map<number, string>(((books as any).data || []).map((b: any) => [Number(b.id), String(b.title || "Book quiz")])),
    };
  };
  const listItem = (s: any, names: Awaited<ReturnType<typeof namesFor>>) => ({
    id: s.id,
    studentId: s.student_id,
    studentName: names.student.get(Number(s.student_id)) || "Student",
    quizKind: s.quiz_kind,
    quizId: s.quiz_id,
    quizTitle: names.quiz.get(Number(s.quiz_id)) || "Book quiz",
    startedAt: s.created_at,
    submittedAt: s.submitted_at,
    score: s.score,
    total: s.total,
    pointsAwarded: Number(s.points_awarded || 0),
    durationMs: s.duration_ms,
    leaves: s.leaves,
    awayMs: s.away_ms,
    autoSubmitted: !!s.auto_submitted,
    snapshotCount: s.snapshot_count,
    flag: s.flag as FlagLevel,
    reasons: Array.isArray(s.flag_reasons) ? s.flag_reasons : [],
    voided: !!s.voided,
    voidReason: s.void_reason || null,
    snapshotsPurged: !!s.snapshots_purged,
  });
  const signedUrls = async (paths: string[]) => {
    if (!paths.length) return new Map<string, string>();
    const { data } = await db().storage.from(NO_PROCTOR.bucket).createSignedUrls(paths, 15 * 60);
    return new Map<string, string>(((data || []) as any[]).filter((d) => d?.signedUrl).map((d) => [String(d.path), String(d.signedUrl)]));
  };

  // ─── Student side ──────────────────────────────────────────────────────────
  app.post("/api/integrity/start", authMiddleware, async (req: any, res) => {
    try {
      const u = req.user;
      if (req.adminPreview || deps.isDemoStudent(u)) {
        // Admin preview and sample accounts see the whole flow, but nothing is recorded.
        return res.json({
          preview: true, token: "preview", startedAt: new Date().toISOString(), restarts: 0,
          snapshotEveryMs: NO_PROCTOR.snapshotEveryMs, leavesBeforeTurnIn: NO_PROCTOR.leavesBeforeTurnIn,
        });
      }
      if (u?.isAdmin || (u?.role && u.role !== "student")) return res.status(403).json({ message: "No-proctor quizzes are for student accounts." });
      const quizKind = String(req.body?.quizKind || "book");
      const quizId = Number(req.body?.quizId);
      if (quizKind !== "book" || !Number.isSafeInteger(quizId) || quizId <= 0) return res.status(400).json({ message: "Pick a quiz first." });
      if (await deps.hasAttempt(u.id, "book", quizId)) return res.status(409).json({ message: "You have already taken this quiz." });
      // Earlier tries that were never turned in count as restarts.
      const { data: earlier, error: earlierError } = await db().from(SESSIONS).select("id,status")
        .eq("student_id", u.id).eq("quiz_kind", quizKind).eq("quiz_id", quizId).in("status", ["active", "expired"]);
      if (earlierError) throw earlierError;
      const restarts = (earlier || []).length;
      if ((earlier || []).some((s: any) => s.status === "active")) {
        await db().from(SESSIONS).update({ status: "expired" }).eq("student_id", u.id).eq("quiz_kind", quizKind).eq("quiz_id", quizId).eq("status", "active");
      }
      const token = randomBytes(24).toString("hex");
      const { data, error } = await db().from(SESSIONS).insert({
        token, student_id: u.id, quiz_kind: quizKind, quiz_id: quizId, restarts,
        expires_at: new Date(Date.now() + NO_PROCTOR.sessionMs).toISOString(),
      }).select("id,created_at").single();
      if (error) throw error;
      await logEvents(data.id, [{ type: "start", detail: { restarts, device: String(req.headers["user-agent"] || "").slice(0, 160) } }]);
      res.json({
        token, sessionId: data.id, startedAt: data.created_at, restarts,
        snapshotEveryMs: NO_PROCTOR.snapshotEveryMs, leavesBeforeTurnIn: NO_PROCTOR.leavesBeforeTurnIn,
      });
    } catch (error: any) {
      console.error("[no-proctor] start", error?.message);
      res.status(500).json({ message: "Could not start the quiz. Try again." });
    }
  });

  /** Lets a student pick up the same try after reloading the page. */
  app.get("/api/integrity/live/:token", authMiddleware, async (req: any, res) => {
    try {
      const s = await byToken(String(req.params.token));
      if (!s || s.student_id !== req.user.id) return res.status(404).json({ message: "Quiz session not found." });
      const active = s.status === "active" && Date.parse(s.expires_at) > Date.now();
      res.set("Cache-Control", "no-store");
      res.json({
        status: active ? "active" : s.status === "active" ? "expired" : s.status,
        quizKind: s.quiz_kind, quizId: s.quiz_id, startedAt: s.created_at, serverNow: new Date().toISOString(),
        leaves: active ? await countEvents(s.id, "left") : s.leaves,
        snapshotEveryMs: NO_PROCTOR.snapshotEveryMs, leavesBeforeTurnIn: NO_PROCTOR.leavesBeforeTurnIn,
      });
    } catch (error: any) {
      console.error("[no-proctor] status", error?.message);
      res.status(500).json({ message: "Could not check the quiz session." });
    }
  });

  // These two are called with the secret session token only, so the browser can
  // still report while the page is closing (sendBeacon cannot send headers).
  app.post("/api/integrity/live/:token/events", async (req: any, res) => {
    try {
      let body: any = req.body;
      if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
      const events = cleanEvents(body?.events);
      const s = await activeByToken(String(req.params.token));
      if (!s) return res.status(410).json({ message: "This quiz session has ended." });
      if (!events.length) return res.json({ ok: true });
      if ((await countEvents(s.id)) + events.length > NO_PROCTOR.maxEvents) return res.status(429).json({ message: "Too many events." });
      await logEvents(s.id, events);
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[no-proctor] events", error?.message);
      res.status(500).json({ message: "Could not save that." });
    }
  });

  app.post("/api/integrity/live/:token/snapshot", async (req: any, res) => {
    try {
      const buf: Buffer | null = Buffer.isBuffer(req.body) ? req.body : null;
      if (!buf || buf.length < 100 || buf.length > NO_PROCTOR.maxSnapshotBytes || buf[0] !== 0xff || buf[1] !== 0xd8) {
        return res.status(400).json({ message: "Snapshots must be small JPEG pictures." });
      }
      const reason = SNAPSHOT_REASONS.has(String(req.query?.reason)) ? String(req.query.reason) : "interval";
      const s = await byToken(String(req.params.token));
      if (!acceptsSnapshots(s)) return res.status(410).json({ message: "This quiz session has ended." });
      const now = Date.now();
      if (s.last_snapshot_at && now - Date.parse(s.last_snapshot_at) < NO_PROCTOR.minSnapshotGapMs) return res.status(429).json({ message: "Too soon." });
      if ((await countEvents(s.id, "snapshot")) >= NO_PROCTOR.maxSnapshots) return res.status(429).json({ message: "Enough pictures for this quiz." });
      const path = `${s.id}/${now}-${reason}.jpg`;
      const { error } = await db().storage.from(NO_PROCTOR.bucket).upload(path, buf, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
      await db().from(SESSIONS).update({ last_snapshot_at: new Date(now).toISOString() }).eq("id", s.id);
      await logEvents(s.id, [{ type: "snapshot", detail: { path, reason } }]);
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[no-proctor] snapshot", error?.message);
      res.status(500).json({ message: "Could not save the picture." });
    }
  });

  // ─── Review ────────────────────────────────────────────────────────────────
  app.get("/api/integrity/review", authMiddleware, async (req: any, res) => {
    try {
      const scope = await scopeFor(req);
      if (!scope) return res.status(403).json({ message: "Only teachers, parents and the admin can review quizzes." });
      const studentId = Number(req.query?.studentId);
      if (Number.isSafeInteger(studentId) && studentId > 0 && !inScope(scope, studentId)) return res.status(403).json({ message: "That student is not in your list." });
      res.set("Cache-Control", "no-store");
      if (scope.studentIds && !scope.studentIds.length) return res.json({ role: scope.role, canVoid: scope.canVoid, sessions: [] });
      let q = db().from(SESSIONS).select(LIST_COLUMNS).eq("status", "submitted").order("submitted_at", { ascending: false })
        .limit(Math.max(1, Math.min(200, Number(req.query?.limit) || 100)));
      if (Number.isSafeInteger(studentId) && studentId > 0) q = q.eq("student_id", studentId);
      else if (scope.studentIds) q = q.in("student_id", scope.studentIds);
      const { data, error } = await q;
      if (error) throw error;
      const rows: any[] = data || [];
      const names = await namesFor([...new Set<number>(rows.map((r) => Number(r.student_id)))], [...new Set<number>(rows.map((r) => Number(r.quiz_id)))]);
      res.json({ role: scope.role, canVoid: scope.canVoid, sessions: rows.map((r: any) => listItem(r, names)) });
    } catch (error: any) {
      console.error("[no-proctor] review list", error?.message);
      res.status(500).json({ message: "Could not load no-proctor quizzes." });
    }
  });

  app.get("/api/integrity/review/:id", authMiddleware, async (req: any, res) => {
    try {
      const scope = await scopeFor(req);
      if (!scope) return res.status(403).json({ message: "Only teachers, parents and the admin can review quizzes." });
      const id = String(req.params.id);
      if (!isUuid(id)) return res.status(404).json({ message: "Quiz record not found." });
      const { data: s, error } = await db().from(SESSIONS).select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!s || s.status !== "submitted" || !inScope(scope, s.student_id)) return res.status(404).json({ message: "Quiz record not found." });
      const { data: earlierRows } = await db().from(SESSIONS).select("id,created_at,status")
        .eq("student_id", s.student_id).eq("quiz_kind", s.quiz_kind).eq("quiz_id", s.quiz_id).eq("status", "expired").order("created_at", { ascending: true });
      const earlier = (earlierRows || []).filter((e: any) => Date.parse(e.created_at) < Date.parse(s.created_at));
      const ids = [s.id, ...earlier.map((e: any) => e.id)];
      const { data: eventRows, error: eventsError } = await db().from(EVENTS).select("session_id,at,type,detail").in("session_id", ids).order("at", { ascending: true });
      if (eventsError) throw eventsError;
      const events = eventRows || [];
      const paths = s.snapshots_purged ? [] : events.filter((e: any) => e.type === "snapshot" && typeof e.detail?.path === "string").map((e: any) => e.detail.path as string).slice(-200);
      const urls = await signedUrls(paths);
      const pictures = (sessionId: string) => events
        .filter((e: any) => e.session_id === sessionId && e.type === "snapshot" && urls.has(e.detail?.path))
        .map((e: any) => ({ at: e.at, reason: String(e.detail?.reason || "interval"), url: urls.get(e.detail.path)! }));
      const names = await namesFor([Number(s.student_id)], [Number(s.quiz_id)]);
      res.set("Cache-Control", "no-store");
      res.json({
        canVoid: scope.canVoid,
        session: { ...listItem(s, names), answerTimes: s.answer_times || null, voidedAt: s.voided_at || null },
        timeline: events.filter((e: any) => e.session_id === s.id && e.type !== "snapshot").map((e: any) => ({ at: e.at, type: e.type, detail: e.detail || null })),
        snapshots: pictures(s.id),
        earlierTries: earlier.map((e: any) => ({
          startedAt: e.created_at,
          leaves: events.filter((x: any) => x.session_id === e.id && x.type === "left").length,
          snapshots: pictures(e.id).slice(0, 12),
        })),
      });
    } catch (error: any) {
      console.error("[no-proctor] review detail", error?.message);
      res.status(500).json({ message: "Could not load this quiz record." });
    }
  });

  const setVoided = (voided: boolean) => async (req: any, res: any) => {
    try {
      const scope = await scopeFor(req);
      if (!scope?.canVoid) return res.status(403).json({ message: "Only teachers and the admin can change points." });
      const id = String(req.params.id);
      if (!isUuid(id)) return res.status(404).json({ message: "Quiz record not found." });
      const { data: s, error } = await db().from(SESSIONS).select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!s || s.status !== "submitted" || !inScope(scope, s.student_id)) return res.status(404).json({ message: "Quiz record not found." });
      if (!!s.voided === voided) return res.json({ ok: true, voided });
      if (s.attempt_id) await deps.setAttemptPoints(Number(s.attempt_id), voided ? 0 : Number(s.points_awarded || 0));
      const patch = voided
        ? { voided: true, voided_at: new Date().toISOString(), voided_by: req.user.id, void_reason: String(req.body?.reason || "").trim().slice(0, 300) || null }
        : { voided: false, voided_at: null, voided_by: null, void_reason: null };
      const { error: updateError } = await db().from(SESSIONS).update(patch).eq("id", id);
      if (updateError) throw updateError;
      res.json({ ok: true, voided });
    } catch (error: any) {
      console.error("[no-proctor] void", error?.message);
      res.status(500).json({ message: "Could not change the points." });
    }
  };
  app.post("/api/integrity/review/:id/void", authMiddleware, setVoided(true));
  app.post("/api/integrity/review/:id/restore", authMiddleware, setVoided(false));

  // ─── Housekeeping: end stale tries and delete pictures after 30 days ───────
  const purgeOld = async () => {
    await db().from(SESSIONS).update({ status: "expired" }).eq("status", "active").lt("expires_at", new Date().toISOString());
    const cutoff = new Date(Date.now() - NO_PROCTOR.keepSnapshotsDays * 24 * 60 * 60 * 1000).toISOString();
    const { data: old, error } = await db().from(SESSIONS).select("id").lt("created_at", cutoff).eq("snapshots_purged", false).limit(25);
    if (error) throw error;
    for (const row of old || []) {
      const { data: shots } = await db().from(EVENTS).select("detail").eq("session_id", row.id).eq("type", "snapshot");
      const paths = (shots || []).map((x: any) => x.detail?.path).filter((p: unknown): p is string => typeof p === "string");
      for (let i = 0; i < paths.length; i += 100) await db().storage.from(NO_PROCTOR.bucket).remove(paths.slice(i, i + 100));
      await db().from(SESSIONS).update({ snapshots_purged: true }).eq("id", row.id);
    }
  };
  const runPurge = () => { void purgeOld().catch((e) => console.error("[no-proctor] cleanup", e?.message)); };
  (setTimeout(runPurge, 90_000) as any).unref?.();
  (setInterval(runPurge, 6 * 60 * 60 * 1000) as any).unref?.();

  return {
    purgeOld,
    /**
     * Checks a no-proctor session before a quiz is graded and claims it, so two
     * turn-ins of the same try can't both be graded. Returns null if it can't be used.
     */
    async checkForSubmit(token: string, studentId: number, quizKind: "book", quizId: number): Promise<IntegritySession | null> {
      const s = await byToken(String(token || ""));
      if (!s || s.student_id !== studentId || s.quiz_kind !== quizKind || Number(s.quiz_id) !== quizId || s.status !== "active") return null;
      if (Date.parse(s.expires_at) + NO_PROCTOR.submitGraceMs < Date.now()) return null;
      const { data: claimed, error } = await db().from(SESSIONS).update({ submitted_at: new Date().toISOString() })
        .eq("id", s.id).eq("status", "active").is("submitted_at", null).select("id");
      if (error) throw error;
      return claimed?.length ? s : null;
    },
    /** Lets the try be turned in again if grading it failed after it was claimed. */
    async release(s: IntegritySession) {
      await db().from(SESSIONS).update({ submitted_at: null }).eq("id", s.id).eq("status", "active");
    },
    /** Records the result, adds up the log and sets the flag once the attempt is saved. */
    async finishAfterSubmit(s: IntegritySession, r: {
      attemptId: number | null; score: number; total: number; points: number; questionCount: number;
      answerTimes?: unknown; autoSubmitted?: boolean; events?: unknown;
    }) {
      const finalEvents = cleanEvents(r.events).slice(0, 20);
      await logEvents(s.id, [...finalEvents, { type: "submitted", detail: { auto: !!r.autoSubmitted } }]);
      const { data: events, error } = await db().from(EVENTS).select("type,detail").eq("session_id", s.id);
      if (error) throw error;
      const sum = summarizeEvents(events || []);
      const durationMs = Math.max(0, Date.now() - Date.parse(s.created_at));
      const autoSubmitted = !!r.autoSubmitted;
      const { flag, reasons } = computeFlags({ ...sum, autoSubmitted, durationMs, questionCount: r.questionCount, restarts: Number(s.restarts) || 0 });
      const { error: updateError } = await db().from(SESSIONS).update({
        status: "submitted", submitted_at: new Date().toISOString(), attempt_id: r.attemptId, score: r.score, total: r.total,
        points_awarded: r.points, duration_ms: durationMs, leaves: sum.leaves, away_ms: sum.awayMs, copy_attempts: sum.copyAttempts,
        camera_off: sum.cameraOff, snapshot_count: sum.snapshotCount, auto_submitted: autoSubmitted,
        answer_times: cleanAnswerTimes(r.answerTimes), flag, flag_reasons: reasons,
      }).eq("id", s.id).eq("status", "active");
      if (updateError) throw updateError;
      return { flag, reasons, autoSubmitted };
    },
  };
}
