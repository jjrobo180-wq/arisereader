// One shape for every Eye Gazer lesson the lesson player shows: the built-in lessons
// (eye_gaze_quizzes / eye_gaze_questions, written in shared/eyegaze/lessons.ts) and the
// quizzes teachers make (custom_eye_gaze_*). Pure functions, so the tests can check them.
import type { ChoiceStyle, QuestionExtras, SavedLearnCard } from "@shared/eyegaze/lessonSteps";

export type Letter = "A" | "B" | "C" | "D";
export const LETTERS: Letter[] = ["A", "B", "C", "D"];

export type LessonChoice = { letter: Letter; text: string; picture: string | null };
export type LessonQuestion = {
  id: number;
  prompt: string;
  /** What the voice says. */
  say: string;
  /** A picture file (or an emoji, in older quizzes) shown with the question. */
  picture: string | null;
  picture2: string | null;
  count: number;
  /** A word to read, printed big. */
  word: string | null;
  sound: string | null;
  show: ChoiceStyle;
  choices: LessonChoice[];
};
export type LessonInfo = {
  id: number;
  title: string;
  description: string;
  cover: string | null;
  learn: SavedLearnCard[];
  hasCompleted: boolean;
  score: number | null;
  total: number | null;
};

/** A picture file the site can show (anything else is an emoji or text from an older quiz). */
export function isPictureFile(value: unknown): value is string {
  return typeof value === "string" && /^(\/|https?:\/\/|data:image\/)/i.test(value.trim());
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : value == null ? "" : String(value));

function styleFor(choices: LessonChoice[], wanted: unknown): ChoiceStyle {
  if (wanted === "pictures" || wanted === "both" || wanted === "words") {
    // Never ask for pictures that aren't there.
    if (wanted !== "words" && !choices.every(c => c.picture)) return "words";
    return wanted;
  }
  if (choices.length && choices.every(c => c.picture)) return choices.every(c => c.text) ? "both" : "pictures";
  return "words";
}

/** A built-in lesson question (eye_gaze_questions row, answer key left out). */
export function builtInQuestion(row: any): LessonQuestion {
  const extras: Partial<QuestionExtras> = row?.extras && typeof row.extras === "object" ? row.extras : {};
  const choices = LETTERS.map((letter): LessonChoice => {
    const key = letter.toLowerCase();
    const image = text(row?.[`option_${key}_image`]);
    return { letter, text: text(row?.[`option_${key}`]), picture: isPictureFile(image) ? image : null };
  }).filter(c => c.text || c.picture);
  const visual = text(row?.visual);
  const visualType = text(row?.visual_type);
  const prompt = text(row?.prompt);
  return {
    id: Number(row?.id),
    prompt,
    say: text(extras.say) || prompt,
    picture: visualType === "word" ? null : visual || null,
    picture2: isPictureFile(extras.picture2) ? extras.picture2 : null,
    count: Math.max(1, Math.min(10, Number(extras.count) || 1)),
    word: visualType === "word" ? visual || text(extras.word) || null : text(extras.word) || null,
    sound: isPictureFile(extras.sound) ? extras.sound : null,
    show: styleFor(choices, extras.show),
    choices,
  };
}

/** A teacher-made quiz question (custom_eye_gaze_questions row, answer key left out). */
export function customQuestion(row: any): LessonQuestion {
  const choices = LETTERS.map((letter): LessonChoice => {
    const key = letter.toLowerCase();
    const image = text(row?.[`option_${key}_image`]);
    return { letter, text: text(row?.[`option_${key}_text`]), picture: isPictureFile(image) ? image : null };
  }).filter(c => c.text || c.picture);
  const prompt = text(row?.prompt);
  return {
    id: Number(row?.id),
    prompt,
    say: prompt,
    picture: text(row?.question_image) || null,
    picture2: null,
    count: 1,
    word: null,
    sound: null,
    show: styleFor(choices, null),
    choices,
  };
}

function learnCards(raw: unknown): SavedLearnCard[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(card => card && typeof card === "object" && text(card.word) && text(card.say))
    .map(card => ({
      word: text(card.word),
      say: text(card.say),
      picture: text(card.picture),
      ...(Number(card.count) > 1 ? { count: Math.min(10, Number(card.count)) } : {}),
      ...(isPictureFile(card.picture2) ? { picture2: card.picture2 } : {}),
      ...(isPictureFile(card.sound) ? { sound: card.sound } : {}),
    }));
}

/** A lesson (built-in or teacher-made) as the player shows it before the quiz starts. */
export function lessonInfo(row: any): LessonInfo {
  return {
    id: Number(row?.id),
    title: text(row?.title) || "Lesson",
    description: text(row?.description),
    cover: text(row?.cover_visual) || null,
    learn: learnCards(row?.learn_cards),
    hasCompleted: !!row?.hasCompleted,
    score: row?.score == null ? null : Number(row.score),
    total: row?.total == null ? null : Number(row.total),
  };
}

/** Five stars for a lesson, filled for the part that was right. */
export function starsFor(score: number, total: number, stars = 5): number {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(stars, Math.round((score / total) * stars)));
}

/** The words a student hears and reads when a quiz ends. */
export function resultWords(result: { score: number; total: number; passed?: boolean; pointsEarned?: number; practice?: boolean; preview?: boolean }) {
  const { score, total } = result;
  const passed = result.passed ?? (total > 0 && score >= Math.ceil(total * 0.7));
  const headline = passed ? (score === total ? "Perfect!" : "You did it!") : "Good work!";
  const line = `You got ${score} out of ${total} right.`;
  const points = Number(result.pointsEarned || 0);
  const note = result.practice ? "Practice is just for fun. No points this time."
    : result.preview ? "This was a preview, so nothing was saved."
    : points > 0 ? `You earned ${points} points!`
    : passed ? "Great job!" : "You can practice this lesson again any time.";
  return { passed, headline, line, note, say: `${headline} ${line} ${note}` };
}

/** What the voice says right after an answer. */
export function answerWords(correct: boolean | null, rightChoice: LessonChoice | null): string {
  if (correct) return "Yes! That's right!";
  if (rightChoice?.text) return `Nice try. The answer is ${rightChoice.text}.`;
  return "Nice try!";
}

/** The lesson to offer after this one: the next one not done yet, else simply the next one. */
export function nextLessonId(list: Array<{ id: unknown; hasCompleted?: boolean }>, currentId: number): number | null {
  const at = list.findIndex(l => Number(l.id) === currentId);
  const after = at >= 0 ? list.slice(at + 1) : list;
  const open = after.find(l => !l.hasCompleted) || list.find(l => !l.hasCompleted && Number(l.id) !== currentId) || after[0];
  return open ? Number(open.id) : null;
}
