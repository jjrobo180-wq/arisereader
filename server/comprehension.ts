// Reading comprehension: the written answers a student sends with a book quiz when a
// parent or teacher typed the proctor code, and the page where teachers grade them.
// Rules shared with the pages are in shared/comprehension.ts.
import type { Express, RequestHandler } from "express";
import {
  COMPREHENSION_PROMPTS, allowsComprehension, awardReason, cleanComprehension, cleanNote, cleanPoints,
  comprehensionState, earnedOn, gradedMessage, submittedNotice,
} from "../shared/comprehension";

const TABLE = "comprehension_responses";

type Deps = {
  /** The server's Supabase client (service role). */
  db: () => any;
  getTeacherStudentIds: (teacherId: number) => Promise<number[]>;
  /** Point totals and leaderboards are cached; clear them after points change. */
  clearPointCaches: () => void;
  /** A message in the student's bell, from their teacher. */
  messageStudent: (studentId: number, text: string) => Promise<unknown>;
  adminIds: () => Promise<number[]>;
};

export type QuizComprehension = {
  student: { id: number; displayName?: string | null; username?: string | null; teacherId?: number | null; approvedByTeacher?: boolean | null };
  bookId: number;
  bookTitle: string;
  attemptId: number | null;
  proctor: { type: string; name?: string | null } | null;
  raw: unknown;
};

/** What happened to the answers sent with a quiz: none sent, saved, or not saved and why. */
export type SaveResult = null | "sent" | "not allowed" | "incomplete" | "already graded" | "failed";

export function registerComprehensionRoutes(app: Express, authMiddleware: RequestHandler, deps: Deps) {
  let client: any = null;
  const db = () => (client ??= deps.db());

  /** Who grades: the admin sees everyone, a teacher sees their own students. Parents don't grade. */
  const scopeFor = async (req: any): Promise<{ role: "admin" | "teacher"; studentIds: number[] | null } | null> => {
    const u = req.user;
    if (u?.isAdmin && !req.adminPreview) return { role: "admin", studentIds: null };
    if (u?.role === "teacher") return { role: "teacher", studentIds: await deps.getTeacherStudentIds(Number(u.id)) };
    return null;
  };
  const inScope = (scope: { studentIds: number[] | null }, studentId: number) => !scope.studentIds || scope.studentIds.includes(Number(studentId));

  /** The student's teacher hears about it; a student without one goes to the admin. */
  const tellGrader = async (q: QuizComprehension) => {
    const teacherId = Number(q.student.teacherId || 0);
    const to = teacherId > 0 && q.student.approvedByTeacher !== false ? [teacherId] : await deps.adminIds();
    if (!to.length) return;
    const notice = submittedNotice(String(q.student.displayName || q.student.username || "A student"), q.bookTitle);
    const { error } = await db().from("notifications").insert(to.map((id) => ({ user_id: id, type: "info", title: notice.title, message: notice.message })));
    if (error) throw error;
  };

  /** Called by the book quiz when it is turned in. Never stops the quiz from saving. */
  async function saveFromQuiz(q: QuizComprehension): Promise<SaveResult> {
    if (q.raw == null || comprehensionState(q.raw) === "empty") return null;
    if (!allowsComprehension(q.proctor?.type)) return "not allowed";
    const answers = cleanComprehension(q.raw);
    if (!answers) return "incomplete";
    try {
      const { data: existing, error: readError } = await db().from(TABLE).select("id,status").eq("student_id", q.student.id).eq("book_id", q.bookId).maybeSingle();
      if (readError) throw readError;
      if (existing?.status === "graded") return "already graded";
      const row = {
        attempt_id: q.attemptId, answers, proctor_type: q.proctor!.type, proctor_name: String(q.proctor?.name || "").slice(0, 120) || null,
        status: "pending", created_at: new Date().toISOString(),
      };
      const { error } = existing
        ? await db().from(TABLE).update(row).eq("id", existing.id)
        : await db().from(TABLE).insert({ student_id: q.student.id, book_id: q.bookId, ...row });
      if (error) throw error;
      await tellGrader(q).catch((e: any) => console.error("[comprehension] notify", e?.message));
      return "sent";
    } catch (error: any) {
      console.error("[comprehension] save", error?.message);
      return "failed";
    }
  }

  const names = async (studentIds: number[], bookIds: number[], userIds: number[]) => {
    const people = [...new Set([...studentIds, ...userIds])];
    const [users, books] = await Promise.all([
      people.length ? db().from("users").select("id,display_name,username").in("id", people) : Promise.resolve({ data: [] }),
      bookIds.length ? db().from("books").select("id,title,cover_url").in("id", bookIds) : Promise.resolve({ data: [] }),
    ]);
    return {
      person: new Map<number, string>(((users as any).data || []).map((u: any) => [Number(u.id), String(u.display_name || u.username || "Student")])),
      book: new Map<number, { title: string; coverUrl: string | null }>(((books as any).data || []).map((b: any) => [Number(b.id), { title: String(b.title || "Book"), coverUrl: b.cover_url || null }])),
    };
  };

  const item = (r: any, n: Awaited<ReturnType<typeof names>>, scores: Map<number, { score: number; total: number }>) => ({
    id: Number(r.id),
    studentId: Number(r.student_id),
    studentName: n.person.get(Number(r.student_id)) || "Student",
    bookId: Number(r.book_id),
    bookTitle: n.book.get(Number(r.book_id))?.title || "Book",
    coverUrl: n.book.get(Number(r.book_id))?.coverUrl || null,
    quiz: r.attempt_id ? scores.get(Number(r.attempt_id)) || null : null,
    answers: COMPREHENSION_PROMPTS.map((p) => ({ id: p.id, label: p.label, question: p.text, answer: String(r.answers?.[p.id] || "") })),
    proctor: r.proctor_type === "parent" ? `Parent: ${r.proctor_name || "Parent / Guardian"}` : `Teacher / staff: ${r.proctor_name || "Teacher"}`,
    status: r.status === "graded" ? "graded" : "pending",
    points: r.points == null ? null : Number(r.points),
    note: String(r.teacher_note || ""),
    gradedBy: r.graded_by ? n.person.get(Number(r.graded_by)) || null : null,
    gradedAt: r.graded_at || null,
    createdAt: r.created_at,
  });

  // The list to grade (pending first), and the ones already graded.
  app.get("/api/comprehension/review", authMiddleware, async (req: any, res) => {
    try {
      const scope = await scopeFor(req);
      if (!scope) return res.status(403).json({ message: "Only teachers and the admin grade reading comprehension." });
      res.set("Cache-Control", "no-store");
      if (scope.studentIds && !scope.studentIds.length) return res.json({ role: scope.role, pending: 0, items: [] });
      const status = req.query?.status === "graded" ? "graded" : req.query?.status === "all" ? "all" : "pending";
      let q = db().from(TABLE).select("*").order("created_at", { ascending: status === "pending" }).limit(Math.max(1, Math.min(200, Number(req.query?.limit) || 100)));
      if (status !== "all") q = q.eq("status", status);
      if (scope.studentIds) q = q.in("student_id", scope.studentIds);
      let pendingCount = db().from(TABLE).select("id").eq("status", "pending");
      if (scope.studentIds) pendingCount = pendingCount.in("student_id", scope.studentIds);
      const [{ data, error }, { data: pendingRows, error: countError }] = await Promise.all([q, pendingCount.limit(1000)]);
      if (error) throw error;
      if (countError) throw countError;
      const rows: any[] = data || [];
      const attemptIds = [...new Set(rows.map((r) => Number(r.attempt_id)).filter((id) => id > 0))];
      const { data: attempts } = attemptIds.length ? await db().from("attempts").select("id,score,total").in("id", attemptIds) : { data: [] };
      const scores = new Map<number, { score: number; total: number }>(((attempts as any[]) || []).map((a: any) => [Number(a.id), { score: Number(a.score || 0), total: Number(a.total || 0) }]));
      const n = await names(rows.map((r) => Number(r.student_id)), [...new Set(rows.map((r) => Number(r.book_id)))], rows.map((r) => Number(r.graded_by)).filter((id) => id > 0));
      res.json({ role: scope.role, pending: (pendingRows || []).length, items: rows.map((r) => item(r, n, scores)) });
    } catch (error: any) {
      console.error("[comprehension] list", error?.message);
      res.status(500).json({ message: "Could not load reading comprehension answers." });
    }
  });

  /** Takes back points given earlier for this answer (when the teacher changes the grade). */
  const takeBack = async (awardId: number, studentId: number) => {
    const { data, error } = await db().from("manual_point_awards").delete().eq("id", awardId).eq("student_id", studentId).select("id,points");
    if (error) throw error;
    const points = Number(data?.[0]?.points || 0);
    if (!points) return;
    // Adding an award raises the stored total; taking one back lowers it again.
    const { data: user } = await db().from("users").select("total_points").eq("id", studentId).maybeSingle();
    const total = Math.max(0, Math.round((Number(user?.total_points || 0) - points) * 10) / 10);
    await db().from("users").update({ total_points: total }).eq("id", studentId);
  };

  // Grade (or change the grade): 0 to 10 extra points and a note for the student.
  app.post("/api/comprehension/review/:id/grade", authMiddleware, async (req: any, res) => {
    try {
      const scope = await scopeFor(req);
      if (!scope) return res.status(403).json({ message: "Only teachers and the admin grade reading comprehension." });
      const id = Number(req.params.id);
      const points = cleanPoints(req.body?.points);
      if (points === null) return res.status(400).json({ message: "Give 0 to 10 points." });
      const note = cleanNote(req.body?.note);
      if (!Number.isSafeInteger(id) || id < 1) return res.status(404).json({ message: "Answers not found." });
      const { data: r, error } = await db().from(TABLE).select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!r || !inScope(scope, r.student_id)) return res.status(404).json({ message: "Answers not found." });

      const { data: book } = await db().from("books").select("title").eq("id", r.book_id).maybeSingle();
      const title = String(book?.title || "");
      const pointsChanged = !(r.status === "graded" && Number(r.points) === points);
      const noteChanged = note !== String(r.teacher_note || "");
      let awardId: number | null = r.award_id ? Number(r.award_id) : null;
      if (pointsChanged) {
        // New points first, so a failure leaves the old grade as it was.
        let newAward: number | null = null;
        if (points > 0) {
          const { data: award, error: awardError } = await db().from("manual_point_awards").insert({
            student_id: r.student_id, awarded_by: req.user.id, points, reason: awardReason(title), earned_on: earnedOn(r.created_at),
          }).select("id").single();
          if (awardError) throw awardError;
          newAward = Number(award.id);
        }
        if (awardId) await takeBack(awardId, Number(r.student_id)).catch((e: any) => console.error("[comprehension] take back", e?.message));
        awardId = newAward;
      }
      const { error: updateError } = await db().from(TABLE).update({
        status: "graded", points, teacher_note: note || null, graded_by: req.user.id, graded_at: new Date().toISOString(), award_id: awardId,
      }).eq("id", id);
      if (updateError) throw updateError;
      if (pointsChanged) deps.clearPointCaches();
      if (pointsChanged || noteChanged) {
        await deps.messageStudent(Number(r.student_id), gradedMessage(title, points, note)).catch((e: any) => console.error("[comprehension] message", e?.message));
      }
      res.json({ ok: true, points, note });
    } catch (error: any) {
      console.error("[comprehension] grade", error?.message);
      res.status(500).json({ message: "Could not save the grade. Try again." });
    }
  });

  return { saveFromQuiz };
}
