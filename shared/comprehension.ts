// Reading comprehension: three short written answers a student can add at the end of any
// book quiz for up to 10 extra points, whether a parent or teacher typed the proctor code
// or the student took it on their own with the camera on. The student's teacher reads and
// grades them; students without a teacher are graded by the admin.

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

/** How the quiz was watched: a parent or teacher proctor code, or the camera. Previews and sample accounts have neither. */
export function allowsComprehension(proctorType: string | null | undefined): boolean {
  return proctorType === "parent" || proctorType === "teacher" || proctorType === "camera";
}

/** The small note on each book quiz cover. */
export const COVER_NOTE = `${COMPREHENSION.bonusPoints} extra credit points for doing the writing comprehension at the end`;

/** Who watched, for the teacher's list. */
export function proctorLabel(type: string | null | undefined, name: string | null | undefined): string {
  if (type === "camera") return "On their own (camera on)";
  if (type === "parent") return `Parent: ${name || "Parent / Guardian"}`;
  return `Teacher / staff: ${name || "Teacher"}`;
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

// ─── AI grading help ────────────────────────────────────────────────────────────────────────────
// A teacher can ask the AI for a suggested score. The AI rates the answers in each area below from
// 0 to 10 and says why, then suggests overall points (0–10) and a short note to the student. It is
// only a suggestion: the teacher uses it, changes it, or gives their own grade. Nothing is saved or
// sent to the student until the teacher presses Save.

export const AI_AREAS = [
  { id: "accuracy", label: "Accuracy", what: "Facts, characters and events match the book; nothing made up." },
  { id: "comprehension", label: "Comprehension", what: "Shows they understood the main idea, the problem and the lesson, not just the surface." },
  { id: "evidence", label: "Details & evidence", what: "Uses specific details or examples from the book to back up what they say." },
  { id: "organization", label: "Organization", what: "The retell is in order and ideas connect clearly." },
  { id: "spelling", label: "Spelling & grammar", what: "Spelling, capitals, punctuation and complete sentences, judged for the student's grade." },
  { id: "effort", label: "Completeness & effort", what: "All three questions answered fully, in their own words, with real thought." },
] as const;
export type AiAreaId = (typeof AI_AREAS)[number]["id"];
export type AiArea = { id: AiAreaId; label: string; score: number; why: string };
export type AiSuggestion = {
  /** Suggested extra points, 0–10. */
  points: number;
  areas: AiArea[];
  /** Two or three sentences: why this score. */
  summary: string;
  /** A kind, specific note the teacher can send as is or change. */
  note: string;
  /** Anything the teacher should double-check (copied text, off-topic, a fact the AI isn't sure of). */
  flags: string[];
};

export const AI_GRADE_PROMPT = `You help a K-12 teacher grade a student's written reading comprehension for a book. The student answered three questions: Retell, Problem and solution, Big idea.
Rate the answers in each area from 0 to 10 (whole numbers), fairly for the student's grade level (a 2nd grader is not held to a 10th grader's spelling or depth):
${AI_AREAS.map((a) => `- ${a.id} (${a.label}): ${a.what}`).join("\n")}
Then suggest overall extra points from 0 to 10 (whole number) that reflects the areas together, weighting accuracy and comprehension most.
If you do not know the book well, judge accuracy only from what the student wrote being consistent and plausible, and say so in flags.
Flag answers that look copied, off-topic, unsafe, or that don't match the book.
Be specific and quote the student's words briefly when you explain. Be kind and encouraging in the note to the student, written to them, one or two sentences, with one thing they did well and one thing to improve.
Reply with JSON only: {"points": 0-10, "areas": [{"id": "accuracy", "score": 0-10, "why": "one or two sentences"}, ... all six areas ...], "summary": "2-3 sentences for the teacher", "note": "note to the student", "flags": ["..."]}`;

export function aiGradeMessage(input: { bookTitle: string; author?: string; about?: string; grade?: string | null; quiz?: { score: number; total: number } | null; answers: Record<string, string> }): string {
  const lines = [
    `Book: ${input.bookTitle}${input.author ? ` by ${input.author}` : ""}`,
    input.about ? `About the book: ${input.about.slice(0, 1500)}` : "",
    `Student's grade: ${input.grade ? input.grade : "not given (assume elementary or middle school)"}`,
    input.quiz ? `Book quiz score: ${input.quiz.score}/${input.quiz.total}` : "",
    "",
    ...COMPREHENSION_PROMPTS.map((p) => `${p.label} — ${p.text}\nStudent: ${String(input.answers[p.id] || "").slice(0, COMPREHENSION.maxChars)}`),
  ];
  return lines.filter((l, i) => l !== "" || i > 2).join("\n");
}

const whole = (v: unknown) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(0, Math.min(COMPREHENSION.bonusPoints, n)) : null; };
const line = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** What the AI sent back, made safe; null if it is unusable. Every area is present, in order. */
export function cleanAiSuggestion(raw: unknown): AiSuggestion | null {
  let data: any = raw;
  if (typeof raw === "string") { try { data = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { return null; } }
  if (!data || typeof data !== "object") return null;
  const given = new Map<string, any>((Array.isArray(data.areas) ? data.areas : []).filter((a: any) => a && typeof a === "object").map((a: any) => [String(a.id), a]));
  const areas: AiArea[] = [];
  for (const a of AI_AREAS) {
    const g = given.get(a.id);
    const score = whole(g?.score);
    if (score === null) return null;
    areas.push({ id: a.id, label: a.label, score, why: line(g?.why, 400) || "No reason given." });
  }
  const average = Math.round(areas.reduce((t, a) => t + a.score, 0) / areas.length);
  const points = whole(data.points) ?? average;
  return {
    points,
    areas,
    summary: line(data.summary, 600),
    note: line(data.note, COMPREHENSION.noteMax),
    flags: (Array.isArray(data.flags) ? data.flags : []).map((f: unknown) => line(f, 200)).filter(Boolean).slice(0, 5),
  };
}
