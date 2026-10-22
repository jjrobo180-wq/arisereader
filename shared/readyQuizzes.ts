// "Your quiz is ready": a quiz a student asked for that a teacher or admin has approved.
// The student sees it in a banner on their library and in the bell until they take it or close it.
// Shared by server/readyQuizzes.ts and the student pages.

/** book: a book quiz at /quiz/:id. custom: an eye gaze quiz at /custom-quiz/:id. */
export type ReadyQuizKind = "book" | "custom";
export type ReadyQuiz = { kind: ReadyQuizKind; id: number; title: string; approvedAt: string };

/** How many approved quizzes we keep waiting for one student. */
export const READY_QUIZ_LIMIT = 20;

/** Where the student takes the quiz. */
export function readyQuizPath(q: { kind: ReadyQuizKind; id: number }): string {
  return q.kind === "custom" ? `/custom-quiz/${q.id}` : `/quiz/${q.id}`;
}

/** The stored notification's type, which carries the link: "quiz_ready:book:123". */
export function readyQuizNotificationType(q: { kind: ReadyQuizKind; id: number }): string {
  return `quiz_ready:${q.kind}:${q.id}`;
}

/** The link a "quiz_ready:…" notification type points at, or null. */
export function parseReadyQuizType(type: unknown): { kind: ReadyQuizKind; id: number } | null {
  const m = /^quiz_ready:(book|custom):(\d+)$/.exec(String(type ?? ""));
  if (!m) return null;
  const id = Number(m[2]);
  return Number.isSafeInteger(id) && id > 0 ? { kind: m[1] as ReadyQuizKind, id } : null;
}

/** Cleans a stored list: known kinds, real ids, one entry per quiz, newest first, capped. */
export function cleanReadyQuizzes(raw: unknown): ReadyQuiz[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const out: ReadyQuiz[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const kind = (item as any).kind === "custom" ? "custom" : (item as any).kind === "book" ? "book" : null;
    const id = Number((item as any).id);
    if (!kind || !Number.isSafeInteger(id) || id <= 0) continue;
    const key = `${kind}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const approvedAt = Number.isFinite(Date.parse(String((item as any).approvedAt))) ? new Date(String((item as any).approvedAt)).toISOString() : new Date(0).toISOString();
    out.push({ kind, id, title: String((item as any).title || "Your quiz").slice(0, 200), approvedAt });
  }
  return out.sort((a, b) => b.approvedAt.localeCompare(a.approvedAt)).slice(0, READY_QUIZ_LIMIT);
}

/** Adds (or moves to the top) one approved quiz. */
export function addReadyQuiz(list: ReadyQuiz[], q: ReadyQuiz): ReadyQuiz[] {
  return cleanReadyQuizzes([q, ...list.filter((x) => !(x.kind === q.kind && x.id === q.id))]);
}

/** Drops quizzes the student already took or closed. */
export function pendingReadyQuizzes(list: ReadyQuiz[], taken: { book: Set<number>; custom: Set<number> }): ReadyQuiz[] {
  return list.filter((q) => !(q.kind === "book" ? taken.book : taken.custom).has(q.id));
}

/**
 * Approval notices sent before quizzes had links ("Quiz Approved!", type "success") name the book
 * only in the message. Returns that book title so the bell can still open the quiz, or null.
 */
export function legacyApprovedTitle(row: { type?: unknown; title?: unknown; message?: unknown }): string | null {
  if (String(row.type ?? "") !== "success" || String(row.title ?? "") !== "Quiz Approved!") return null;
  const msg = String(row.message ?? "");
  if (/eye gaze quiz/i.test(msg)) return null;
  const m = /quiz (?:for )?"([^"]+)" has been approved/i.exec(msg);
  return m ? m[1].trim() || null : null;
}
