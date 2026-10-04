// A student's activity, for the admin: sign-ins, quizzes started and taken,
// how every point was earned, reading tests and teacher-recorded quizzes.
// Also records a paper quiz as a real quiz attempt, so it counts toward game
// unlocks exactly like a quiz taken on the computer.
import { getAdminSupabase } from "./supabase";
import { completedAtFor, deviceFrom } from "../shared/activity";
export { completedAtFor, deviceFrom };

export type ActivityKind =
  | "login" | "logout" | "signup" | "quiz_started" | "quiz_taken" | "quiz_recorded" | "points_added"
  | "reading_test" | "message" | "world" | "game";

export type ActivityItem = {
  at: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
  points?: number;
  /** pass | fail | flag | info */
  tone?: "pass" | "fail" | "flag" | "info";
};

/** Notes something a student did. Never throws: activity logging must not break the app. */
export async function logActivity(userId: number, kind: ActivityKind, detail = "", meta: Record<string, unknown> = {}) {
  if (!Number.isSafeInteger(userId) || userId < 1 || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    await getAdminSupabase().from("student_activity_log").insert({ user_id: userId, kind, detail: detail.slice(0, 300), meta });
  } catch { /* table not created yet, or a hiccup: skip */ }
}

const passMark = (total: number) => Math.ceil(total * 0.7);
const safe = async <T,>(p: PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> => {
  try { const { data, error } = await p; return error ? [] : data || []; } catch { return []; }
};
const minutes = (ms: number) => (ms >= 60_000 ? `${Math.round(ms / 60_000)} min` : `${Math.max(1, Math.round(ms / 1000))} sec`);

/** Everything we know about what a student did, newest first, plus a summary. */
export async function studentActivity(userId: number, limit = 400) {
  const db = getAdminSupabase();
  const [attempts, integrity, manual, reading, logs, sessions, msgs] = await Promise.all([
    safe<any>(db.from("attempts").select("id, book_id, score, total, points_earned, completed_at, proctor_type, proctor_name, answers").eq("user_id", userId).order("completed_at", { ascending: false }).limit(500)),
    safe<any>(db.from("quiz_integrity_sessions").select("id, quiz_kind, quiz_id, status, created_at, submitted_at, score, total, points_awarded, duration_ms, leaves, away_ms, copy_attempts, camera_off, flag, flag_reasons, voided, void_reason, auto_submitted").eq("student_id", userId).order("created_at", { ascending: false }).limit(300)),
    safe<any>(db.from("manual_point_awards").select("id, points, reason, earned_on, created_at, awarded_by").eq("student_id", userId).order("created_at", { ascending: false }).limit(300)),
    safe<any>(db.from("reading_assessment_attempts").select("id, status, completed_at, created_at, score, total, estimated_grade_level, assessment_type, proctor_type").eq("user_id", userId).order("created_at", { ascending: false }).limit(100)),
    safe<any>(db.from("student_activity_log").select("kind, detail, meta, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500)),
    safe<any>(db.from("sessions").select("created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50)),
    safe<any>(db.from("messages").select("created_at, sender_type, message_text").eq("user_id", userId).eq("sender_type", "student").order("created_at", { ascending: false }).limit(50)),
  ]);

  const bookIds = [...new Set([...attempts.map((a) => Number(a.book_id)), ...integrity.filter((s) => s.quiz_kind === "book").map((s) => Number(s.quiz_id))].filter((n) => n > 0))];
  const staffIds = [...new Set(manual.map((m) => Number(m.awarded_by)).filter(Boolean))];
  const [books, staff] = await Promise.all([
    bookIds.length ? safe<any>(db.from("books").select("id, title").in("id", bookIds)) : Promise.resolve([]),
    staffIds.length ? safe<any>(db.from("users").select("id, display_name").in("id", staffIds)) : Promise.resolve([]),
  ]);
  const title = new Map(books.map((b: any) => [Number(b.id), String(b.title)]));
  const staffName = new Map(staff.map((u: any) => [Number(u.id), String(u.display_name || "Staff")]));
  const bookName = (id: number) => title.get(Number(id)) || `Book #${id}`;

  const items: ActivityItem[] = [];
  for (const a of attempts) {
    const total = Number(a.total) || 0, score = Number(a.score) || 0, passed = total > 0 && score >= passMark(total);
    const rec = a.answers && typeof a.answers === "object" ? (a.answers as any)._teacherRecorded : null;
    if (rec) {
      items.push({ at: a.completed_at, kind: "quiz_recorded", title: `Quiz recorded by ${rec.byName || "a teacher"}: ${bookName(a.book_id)}`, detail: `${score}/${total}${rec.reason ? ` · ${rec.reason}` : ""}`, points: Number(a.points_earned) || 0, tone: "pass" });
      continue;
    }
    const how = a.proctor_type === "camera" ? "on their own with the camera on" : a.proctor_type === "parent" ? `proctored by a parent${a.proctor_name ? ` (${a.proctor_name})` : ""}` : a.proctor_type === "teacher" ? `proctored by ${a.proctor_name || "a teacher"}` : "";
    items.push({ at: a.completed_at, kind: "quiz_taken", title: `${passed ? "Passed" : "Did not pass"} the quiz for ${bookName(a.book_id)}`, detail: [`${score}/${total} correct (${total ? Math.round((score / total) * 100) : 0}%)`, how].filter(Boolean).join(" · "), points: Number(a.points_earned) || 0, tone: passed ? "pass" : "fail" });
  }
  for (const s of integrity) {
    const what = s.quiz_kind === "book" ? `the quiz for ${bookName(s.quiz_id)}` : s.quiz_kind === "reading" ? "a reading test" : `a ${String(s.quiz_kind || "").replace(/_/g, " ")} quiz`;
    items.push({ at: s.created_at, kind: "quiz_started", title: `Started ${what}`, tone: "info" });
    const notes: string[] = [];
    if (s.duration_ms) notes.push(`took ${minutes(Number(s.duration_ms))}`);
    if (Number(s.leaves) > 0) notes.push(`left the quiz screen ${s.leaves}×${s.away_ms ? ` (${minutes(Number(s.away_ms))} away)` : ""}`);
    if (Number(s.copy_attempts) > 0) notes.push(`${s.copy_attempts} copy attempt${s.copy_attempts > 1 ? "s" : ""}`);
    if (s.camera_off) notes.push("camera was off");
    if (s.auto_submitted) notes.push("auto-submitted");
    if (s.voided) notes.push(`voided${s.void_reason ? `: ${s.void_reason}` : ""}`);
    if (Array.isArray(s.flag_reasons) && s.flag_reasons.length) notes.push(`flagged: ${s.flag_reasons.join(", ")}`);
    if (s.submitted_at && notes.length) items.push({ at: s.submitted_at, kind: "quiz_started", title: `Finished ${what}`, detail: notes.join(" · "), tone: s.voided || s.flag ? "flag" : "info" });
    else if (!s.submitted_at && s.status && s.status !== "active") items.push({ at: s.created_at, kind: "quiz_started", title: `Didn't finish ${what}`, detail: String(s.status), tone: "info" });
  }
  for (const m of manual) {
    items.push({ at: m.created_at, kind: "points_added", title: `${m.points} points added by ${staffName.get(Number(m.awarded_by)) || "staff"}`, detail: `${m.reason} · counts for ${m.earned_on}`, points: Number(m.points) || 0, tone: "pass" });
  }
  for (const r of reading) {
    const done = r.status === "completed" && r.completed_at;
    items.push({ at: done ? r.completed_at : r.created_at, kind: "reading_test", title: done ? `Finished a reading test${r.estimated_grade_level ? ` (grade ${r.estimated_grade_level})` : ""}` : "Started a reading test", detail: done && r.total ? `${r.score}/${r.total} correct` : undefined, tone: "info" });
  }
  const loggedLogins: number[] = [];
  for (const l of logs) {
    const meta = l.meta || {};
    const kind = l.kind as ActivityKind;
    if (kind === "login") loggedLogins.push(Date.parse(l.created_at));
    const titles: Partial<Record<ActivityKind, string>> = { login: "Signed in", logout: "Signed out", signup: "Created their account", world: l.detail ? `Entered ${l.detail}` : "Entered a game world", game: l.detail ? `Played ${l.detail}` : "Played a game" };
    items.push({ at: l.created_at, kind, title: titles[kind] || l.detail || kind, detail: [kind === "world" || kind === "game" ? "" : l.detail, meta.device].filter(Boolean).join(" · ") || undefined, tone: "info" });
  }
  // sign-ins from before the activity log existed (current sessions)
  for (const s of sessions) {
    const t = Date.parse(s.created_at);
    if (!loggedLogins.some((x) => Math.abs(x - t) < 10_000)) items.push({ at: s.created_at, kind: "login", title: "Signed in", tone: "info" });
  }
  for (const m of msgs) items.push({ at: m.created_at, kind: "message", title: "Sent a message", detail: String(m.message_text || "").slice(0, 120), tone: "info" });

  items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const passedAttempts = attempts.filter((a) => Number(a.total) > 0 && Number(a.score) >= passMark(Number(a.total)));
  const weekStart = (() => { const d = new Date(); const day = (d.getDay() + 6) % 7; d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - day); return d.getTime(); })();
  const logins = items.filter((i) => i.kind === "login");
  return {
    summary: {
      lastLogin: logins[0]?.at ?? null,
      loginsLast30: logins.filter((i) => Date.now() - Date.parse(i.at) < 30 * 86_400_000).length,
      quizzesTaken: attempts.length,
      quizzesPassed: passedAttempts.length,
      passedThisWeek: passedAttempts.filter((a) => Date.parse(a.completed_at) >= weekStart).length,
      lastQuiz: attempts[0]?.completed_at ?? null,
      points: {
        quizzes: attempts.filter((a) => !(a.answers && (a.answers as any)._teacherRecorded)).reduce((n, a) => n + (Number(a.points_earned) || 0), 0),
        recordedQuizzes: attempts.filter((a) => a.answers && (a.answers as any)._teacherRecorded).reduce((n, a) => n + (Number(a.points_earned) || 0), 0),
        manual: manual.reduce((n, m) => n + (Number(m.points) || 0), 0),
      },
      loginHistoryComplete: logs.length > 0,
    },
    items: items.slice(0, limit),
  };
}

/**
 * Records a paper (or other offline) book quiz as a real passed attempt: it gives
 * the points, shows in the student's books, and unlocks games the same way.
 */
export async function recordTeacherQuiz(o: { studentId: number; bookId: number; points: number; score: number; total: number; reason: string; earnedOn: string; by: { id: number; name: string } }) {
  const db = getAdminSupabase();
  const { data: book } = await db.from("books").select("id, title").eq("id", o.bookId).maybeSingle();
  if (!book) return { status: 404, message: "That book wasn't found." } as const;
  if (o.total < 1 || o.score < passMark(o.total) || o.score > o.total) return { status: 400, message: `A recorded quiz has to be a pass: at least ${passMark(o.total)} of ${o.total}.` } as const;
  const { data: existing } = await db.from("attempts").select("id, score, total, points_earned, completed_at").eq("user_id", o.studentId).eq("book_id", o.bookId).maybeSingle();
  if (existing && Number(existing.total) > 0 && Number(existing.score) >= passMark(Number(existing.total))) {
    return { status: 409, message: `${o.studentId ? "This student" : "They"} already passed the quiz for ${book.title} (${String(existing.completed_at).slice(0, 10)}).` } as const;
  }
  const row = {
    user_id: o.studentId, book_id: o.bookId, score: o.score, total: o.total, points_earned: o.points,
    completed_at: completedAtFor(o.earnedOn),
    proctor_type: "teacher", proctor_user_id: o.by.id, proctor_name: o.by.name,
    answers: { _teacherRecorded: { reason: o.reason, by: o.by.id, byName: o.by.name, recordedAt: new Date().toISOString(), earnedOn: o.earnedOn } },
  };
  // one attempt per book: a failed try is replaced by the recorded pass
  const saved = existing
    ? await db.from("attempts").update(row).eq("id", existing.id).select("id").single()
    : await db.from("attempts").insert(row).select("id").single();
  if (saved.error) return { status: 500, message: "Could not record the quiz." } as const;
  const { data: u } = await db.from("users").select("total_points").eq("id", o.studentId).single();
  const before = Number(existing?.points_earned) || 0;
  await db.from("users").update({ total_points: Math.round((Number(u?.total_points || 0) + o.points - before) * 10) / 10 }).eq("id", o.studentId);
  return { status: 201, attemptId: saved.data.id, title: String(book.title) } as const;
}
