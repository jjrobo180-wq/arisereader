// Works out what to write so the database matches the built-in Eye Gazer lessons
// (shared/eyegaze/lessons.ts). Pure functions; storage.syncEyeGazeLessons does the writing.
import type { SavedQuestion } from "../shared/eyegaze/lessons";

/** JSON with object keys sorted, because jsonb comes back with its keys in its own order. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v);
}

/** Whether a saved row is missing any of the wanted values. */
export function rowDiffers(row: Record<string, unknown> | null | undefined, want: Record<string, unknown>): boolean {
  return Object.entries(want).some(([key, value]) => stableJson(row?.[key] ?? null) !== stableJson(value ?? null));
}

/** The question writes for one lesson: new question numbers, changed ones, and ones it no longer has. */
export function planQuestions(quizId: number, current: Array<Record<string, any>>, wanted: SavedQuestion[]) {
  const insert: Array<SavedQuestion & { quiz_id: number }> = [];
  const update: Array<{ id: number; values: SavedQuestion }> = [];
  for (const want of wanted) {
    const match = current.find(q => Number(q.question_order) === want.question_order);
    if (!match) insert.push({ ...want, quiz_id: quizId });
    else if (rowDiffers(match, want)) update.push({ id: Number(match.id), values: want });
  }
  const remove = current
    .filter(q => !wanted.some(w => w.question_order === Number(q.question_order)))
    .map(q => Number(q.id));
  return { insert, update, remove };
}

/** Saved lesson rows that are showing but are no longer in the lesson list. */
export function lessonsToHide(existing: Array<Record<string, any>>, keys: Set<string>): number[] {
  return existing.filter(row => row.is_active && !keys.has(String(row.lesson_key))).map(row => Number(row.id));
}
