// Answer choices in a different order for each student.
//
// Many book quizzes were written with the right answer in the same spot (72 have every answer
// as "A"), and the choices were always shown in stored order, so a student could pass by
// tapping the first choice every time. Each student now sees each question's choices in their
// own order. The order comes from the student and question ids, so it is the same every time
// that student opens the quiz, and the server can turn the letter they picked back into the
// stored letter when it grades the quiz. Nothing is stored and the answer key never changes.
import { createHash } from "node:crypto";

export const LETTERS = ["A", "B", "C", "D"] as const;
export type Letter = (typeof LETTERS)[number];

type OptionFields = { optionA?: string | null; optionB?: string | null; optionC?: string | null; optionD?: string | null };

const optionText = (q: OptionFields, letter: Letter) => q[`option${letter}` as keyof OptionFields];

/** Stored letters that have a choice written for them, in stored order. */
export function filledLetters(q: OptionFields): Letter[] {
  return LETTERS.filter((l) => String(optionText(q, l) ?? "").trim() !== "");
}

/**
 * The stored letter shown at each position for this student: shown[i] is the stored letter
 * displayed as LETTERS[i]. Only filled choices move; empty ones stay at the end.
 */
export function choiceOrder(studentKey: string | number, questionId: string | number, filled: Letter[]): Letter[] {
  const order = [...filled];
  const hash = createHash("sha256").update(`arise-choices:${studentKey}:${questionId}`).digest();
  for (let i = order.length - 1; i > 0; i--) {
    const j = hash[i] % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const rest = LETTERS.filter((l) => !filled.includes(l));
  return [...order, ...rest];
}

/** The question as this student sees it: same fields, choices moved to the student's order. */
export function shuffleChoices<Q extends OptionFields & { id: number | string }>(q: Q, studentKey: string | number): Q {
  const order = choiceOrder(studentKey, q.id, filledLetters(q));
  const out: Q = { ...q };
  LETTERS.forEach((shownAs, i) => {
    (out as any)[`option${shownAs}`] = optionText(q, order[i]) ?? (q as any)[`option${shownAs}`] ?? null;
  });
  return out;
}

/** Turns the letter a student picked (as shown to them) back into the stored letter. */
export function storedLetter(q: OptionFields & { id: number | string }, studentKey: string | number, picked: string): string {
  const shown = String(picked || "").trim().toUpperCase();
  const index = LETTERS.indexOf(shown as Letter);
  if (index < 0) return shown;
  return choiceOrder(studentKey, q.id, filledLetters(q))[index];
}
