// On each library cover: how many other readers have taken that book's quiz (from
// /api/books/quiz-takers). The extra-credit note that used to sit here is now one line under
// each section title (ExtraCreditNote).
import { COVER_NOTE } from "@shared/comprehension";

/** The words on the cover. `count` is every student who took the quiz; `mine` is whether this reader is one of them. */
export function quizTakersText(count: number, mine: boolean): string {
  const others = Math.max(0, count - (mine ? 1 : 0));
  if (others === 0) return mine ? "You're the first reader to take this quiz" : "Be the first reader to take this quiz!";
  return `${others.toLocaleString()} ${mine ? "other " : ""}${others === 1 ? "reader" : "readers"} took this quiz`;
}

export default function QuizTakersTag({ count, mine = false }: { count: number | undefined; mine?: boolean }) {
  if (count === undefined) return null;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black/85 via-black/60 to-transparent px-2 pb-1.5 pt-5 text-left text-[10px] font-semibold leading-tight text-white sm:text-[11px]"
      data-testid="quiz-takers-tag"
    >
      <span aria-hidden="true">👥 </span>{quizTakersText(count, mine)}
    </div>
  );
}

/** One line under a section title: the extra credit for the writing at the end of every book quiz. */
export function ExtraCreditNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-muted-foreground ${className}`} data-testid="extra-credit-note">
      <span className="mr-1.5 inline-block rounded bg-emerald-400 px-1.5 text-[10px] font-black uppercase tracking-wide text-emerald-950">New!</span>
      {COVER_NOTE} of every quiz.
    </p>
  );
}
