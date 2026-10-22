// Approving a quiz a student asked for, and telling the student it's ready.
//
// Teachers (Teacher Hub) and admins (Admin) approve the same pending AI quizzes, so both routes use
// approvePendingQuiz: it publishes the quiz, puts it on the student's own lists, and tells the student
// three ways: a bell notification that opens the quiz, a phone/browser push (if they turned those on),
// and the "Your quiz is ready" banner on their library, which stays until they take the quiz or close it.
import type { Express, RequestHandler } from "express";
import {
  addReadyQuiz, cleanReadyQuizzes, pendingReadyQuizzes, readyQuizNotificationType, readyQuizPath,
  type ReadyQuiz, type ReadyQuizKind,
} from "../shared/readyQuizzes";

export type PendingQuizRow = {
  id: number; student_id: number; book_title: string; author?: string | null; questions: string;
  cover_url?: string | null; age_group?: string | null; quiz_type?: string | null;
};

export type ReadyQuizDeps = {
  getSetting(key: string): Promise<string | null | undefined>;
  upsertSetting(key: string, value: string): Promise<unknown>;
  /** Makes the eye gaze quiz; returns its id. */
  createEyeGazeQuiz(p: PendingQuizRow, questions: any[]): Promise<number>;
  /** Makes (or reuses) the book and its quiz; returns the book id. */
  createBookQuiz(p: PendingQuizRow, questions: any[]): Promise<number>;
  /** Lesson pages for an iArise quiz; optional and allowed to fail. */
  iariseLesson?(p: PendingQuizRow, bookId: number): Promise<void>;
  insertNotification(row: { user_id: number; type: string; title: string; message: string }): Promise<unknown>;
  push?(userId: number, message: { title: string; body: string; url: string; tag: string }): Promise<unknown>;
  /** Which of these book / eye gaze quizzes the student has finished. */
  takenBooks(userId: number, bookIds: number[]): Promise<number[]>;
  takenCustom(userId: number, quizIds: number[]): Promise<number[]>;
  now?(): number;
};

const readyKey = (studentId: number) => `ready_quizzes_${studentId}`;
const parse = (raw: string | null | undefined): unknown => { try { return raw ? JSON.parse(raw) : []; } catch { return []; } };
const idList = (raw: string | null | undefined): number[] => {
  const v = parse(raw);
  return Array.isArray(v) ? v.map(Number).filter((n) => Number.isSafeInteger(n) && n > 0) : [];
};

async function addToList(deps: ReadyQuizDeps, key: string, id: number) {
  const ids = idList(await deps.getSetting(key));
  if (!ids.includes(id)) ids.push(id);
  await deps.upsertSetting(key, JSON.stringify(ids));
}

/** Publishes an approved quiz and tells the student. Returns where the quiz is. */
export async function approvePendingQuiz(deps: ReadyQuizDeps, pending: PendingQuizRow): Promise<ReadyQuiz> {
  const questions = JSON.parse(pending.questions);
  const now = deps.now ? deps.now() : Date.now();
  let kind: ReadyQuizKind;
  let id: number;
  if (pending.quiz_type === "eye_gaze") {
    kind = "custom";
    id = await deps.createEyeGazeQuiz(pending, questions);
  } else {
    kind = "book";
    id = await deps.createBookQuiz(pending, questions);
    try {
      const bands = parse(await deps.getSetting("book_grade_bands"));
      const map = bands && typeof bands === "object" && !Array.isArray(bands) ? bands as Record<string, string> : {};
      if (pending.age_group) map[String(id)] = pending.age_group;
      await deps.upsertSetting("book_grade_bands", JSON.stringify(map));
    } catch { /* the quiz still works without its grade band */ }
    if (pending.quiz_type === "iarise") {
      try { await deps.iariseLesson?.(pending, id); } catch { /* lesson pages are a bonus */ }
      await addToList(deps, `student_iarise_books_${pending.student_id}`, id);
    } else if (pending.quiz_type === "favorite_topic") {
      await addToList(deps, `student_favorite_books_${pending.student_id}`, id);
    }
  }

  const ready: ReadyQuiz = { kind, id, title: pending.book_title, approvedAt: new Date(now).toISOString() };
  const list = cleanReadyQuizzes(parse(await deps.getSetting(readyKey(pending.student_id))));
  await deps.upsertSetting(readyKey(pending.student_id), JSON.stringify(addReadyQuiz(list, ready)));

  const title = "Your quiz is ready!";
  const body = `Your teacher approved your quiz for "${pending.book_title}". Tap to take it now.`;
  await deps.insertNotification({ user_id: pending.student_id, type: readyQuizNotificationType(ready), title, message: body });
  try { await deps.push?.(pending.student_id, { title, body, url: readyQuizPath(ready), tag: `quiz-ready-${kind}-${id}` }); } catch { /* push is optional */ }
  return ready;
}

/** The approved quizzes this student hasn't taken or closed yet, newest first. Prunes the stored list. */
export async function readyQuizzesFor(deps: ReadyQuizDeps, studentId: number): Promise<ReadyQuiz[]> {
  const raw = await deps.getSetting(readyKey(studentId));
  const list = cleanReadyQuizzes(parse(raw));
  if (!list.length) return [];
  const [books, custom] = await Promise.all([
    deps.takenBooks(studentId, list.filter((q) => q.kind === "book").map((q) => q.id)),
    deps.takenCustom(studentId, list.filter((q) => q.kind === "custom").map((q) => q.id)),
  ]);
  const left = pendingReadyQuizzes(list, { book: new Set(books), custom: new Set(custom) });
  if (left.length !== list.length) await deps.upsertSetting(readyKey(studentId), JSON.stringify(left));
  return left;
}

/** Closes one banner without taking the quiz (the quiz stays on the student's lists). */
export async function dismissReadyQuiz(deps: ReadyQuizDeps, studentId: number, kind: ReadyQuizKind, id: number): Promise<ReadyQuiz[]> {
  const list = cleanReadyQuizzes(parse(await deps.getSetting(readyKey(studentId))));
  const left = list.filter((q) => !(q.kind === kind && q.id === id));
  if (left.length !== list.length) await deps.upsertSetting(readyKey(studentId), JSON.stringify(left));
  return left;
}

export function registerReadyQuizRoutes(app: Express, auth: RequestHandler, deps: ReadyQuizDeps) {
  app.get("/api/student/ready-quizzes", auth, async (req: any, res: any) => {
    try {
      res.set?.("Cache-Control", "no-store");
      if (req.user?.role === "teacher" || req.user?.role === "parent") return res.json({ quizzes: [] });
      const quizzes = await readyQuizzesFor(deps, Number(req.user.id));
      res.json({ quizzes: quizzes.map((q) => ({ ...q, path: readyQuizPath(q) })) });
    } catch (error: any) {
      console.error("[ready-quizzes]", error?.message || error);
      res.status(500).json({ message: "Could not load your quizzes." });
    }
  });

  app.post("/api/student/ready-quizzes/:kind/:id/dismiss", auth, async (req: any, res: any) => {
    try {
      const kind = req.params.kind === "custom" ? "custom" : req.params.kind === "book" ? "book" : null;
      const id = Number(req.params.id);
      if (!kind || !Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: "Unknown quiz." });
      const quizzes = await dismissReadyQuiz(deps, Number(req.user.id), kind, id);
      res.json({ quizzes: quizzes.map((q) => ({ ...q, path: readyQuizPath(q) })) });
    } catch (error: any) {
      console.error("[ready-quizzes]", error?.message || error);
      res.status(500).json({ message: "Could not save that." });
    }
  });
}
