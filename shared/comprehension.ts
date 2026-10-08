// Reading comprehension: three short written answers a student can add to any book quiz
// for up to 10 extra points. Only when a parent or teacher entered the proctor code
// (never on a no-proctor camera quiz). The student's teacher reads and grades them;
// students without a teacher are graded by the admin.

export const COMPREHENSION = {
  /** Most extra points a teacher can give. */
  bonusPoints: 10,
  /** Shortest answer that counts (a few words). */
  minChars: 15,
  /** Longest answer kept. */
  maxChars: 1500,
  /** Longest teacher note. */
  noteMax: 500,
} as const;

export type PromptId = "retell" | "problem" | "lesson";

/** The same three questions on every book, so they work for stories and for nonfiction. */
export const COMPREHENSION_PROMPTS: { id: PromptId; label: string; text: string; hint: string }[] = [
  { id: "retell", label: "Retell", text: "What was this book mostly about? Retell the most important parts in order.", hint: "First…, next…, then…, at the end…" },
  { id: "problem", label: "Problem and solution", text: "What was the main problem or big question, and how was it solved or answered? Use details from the book.", hint: "The problem was… It was solved when…" },
  { id: "lesson", label: "Big idea", text: "What lesson or big idea did you learn from this book? Why does it matter?", hint: "I learned that… This matters because…" },
];

export type ComprehensionAnswers = Record<PromptId, string>;

export const EMPTY_ANSWERS: ComprehensionAnswers = { retell: "", problem: "", lesson: "" };

/** Who proctored: only a parent or teacher who typed the proctor code allows comprehension. */
export function allowsComprehension(proctorType: string | null | undefined): boolean {
  return proctorType === "parent" || proctorType === "teacher";
}

const tidy = (value: unknown) => (typeof value === "string" ? value.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim() : "");

/** How far along the student is: nothing typed (skip it), some typed, or all three ready to send. */
export function comprehensionState(raw: unknown): "empty" | "incomplete" | "ready" {
  const answers = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const lengths = COMPREHENSION_PROMPTS.map((p) => tidy(answers[p.id]).length);
  if (lengths.every((n) => n === 0)) return "empty";
  return lengths.every((n) => n >= COMPREHENSION.minChars) ? "ready" : "incomplete";
}

/** Which answers still need more words (for the message under the boxes). */
export function shortAnswers(raw: unknown): PromptId[] {
  const answers = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return COMPREHENSION_PROMPTS.filter((p) => tidy(answers[p.id]).length < COMPREHENSION.minChars).map((p) => p.id);
}

/** All three answers, cleaned and cut to length, or null when they are not all there. */
export function cleanComprehension(raw: unknown): ComprehensionAnswers | null {
  if (comprehensionState(raw) !== "ready") return null;
  const answers = raw as Record<string, unknown>;
  const out = { ...EMPTY_ANSWERS };
  for (const p of COMPREHENSION_PROMPTS) out[p.id] = tidy(answers[p.id]).slice(0, COMPREHENSION.maxChars);
  return out;
}

/** Points a teacher gives: a whole number from 0 to 10, or null. */
export function cleanPoints(raw: unknown): number | null {
  const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= COMPREHENSION.bonusPoints ? n : null;
}

export function cleanNote(raw: unknown): string {
  return tidy(raw).slice(0, COMPREHENSION.noteMax);
}

/** The line on the student's points history. */
export function awardReason(bookTitle: string): string {
  const title = String(bookTitle || "").replace(/\s+/g, " ").trim() || "a book";
  return `Reading comprehension: ${title}`.slice(0, 200);
}

/** What the student is told when the teacher grades it. */
export function gradedMessage(bookTitle: string, points: number, note: string): string {
  const title = String(bookTitle || "").trim() || "your book";
  const got = points > 0 ? `You earned ${points} extra point${points === 1 ? "" : "s"} (out of ${COMPREHENSION.bonusPoints}).` : "No extra points this time.";
  return `Your reading comprehension for “${title}” was graded. ${got}${note ? ` Note from your teacher: ${note}` : ""}`;
}

/** The bell message for the person who grades it. */
export function submittedNotice(studentName: string, bookTitle: string): { title: string; message: string } {
  return {
    title: "Reading comprehension to grade",
    message: `${studentName || "A student"} wrote comprehension answers for “${bookTitle || "a book"}”. Grade them under Reading comprehension (up to ${COMPREHENSION.bonusPoints} extra points).`,
  };
}

/** The day the points count toward (the day the student turned it in), as YYYY-MM-DD. */
export function earnedOn(submittedAt: string | null | undefined, now = new Date()): string {
  const t = Date.parse(String(submittedAt || ""));
  return new Date(Number.isFinite(t) ? t : now.getTime()).toISOString().slice(0, 10);
}
