// "Did you mean" for the Create a Quiz box. While a student types a title, real books that match show
// under the box (our books and Open Library, GET /api/book-lookup?quick=1). Tapping one fills in the
// exact title and author. DidYouMeanList is shown when the server can't match what was typed.
import { useEffect, useRef, useState } from "react";
import { BookOpen, CheckCircle2 } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import type { BookCandidate, LookupResult } from "@shared/bookMatch";

export type PickedBook = Pick<BookCandidate, "title" | "author" | "source" | "bookId" | "coverUrl" | "key">;

function useQuickLookup(title: string, author: string, token: string | null | undefined, paused: boolean) {
  const [result, setResult] = useState<LookupResult | null>(null);
  const seq = useRef(0);
  useEffect(() => {
    const t = title.trim();
    if (paused || t.length < 3) { setResult(null); return; }
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const q = new URLSearchParams({ title: t, author: author.trim(), quick: "1" });
        const res = await fetch(`${API_BASE}/api/book-lookup?${q}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.ok && mine === seq.current) setResult(await res.json());
      } catch { /* suggestions are a help, not required */ }
    }, 450);
    return () => clearTimeout(timer);
  }, [title, author, token, paused]);
  return result;
}

function BookChoice({ book, onPick, label }: { book: BookCandidate; onPick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onPick} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-purple-500/10 focus:bg-purple-500/10 focus:outline-none">
      {book.coverUrl ? <img src={book.coverUrl} alt="" loading="lazy" className="h-12 w-8 shrink-0 rounded object-cover" /> : <span className="grid h-12 w-8 shrink-0 place-items-center rounded bg-muted"><BookOpen className="h-4 w-4 text-muted-foreground" /></span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{book.title}</span>
        <span className="block truncate text-xs text-muted-foreground">by {book.author}{book.year ? ` · ${book.year}` : ""}</span>
      </span>
      {label && <span className="shrink-0 text-xs font-semibold text-purple-500">{label}</span>}
    </button>
  );
}

/** Suggestions under the title box while typing, plus a Google-style "Did you mean" line. */
export function BookTitleSuggest({ title, author, token, picked, onPick }: {
  title: string; author: string; token?: string | null; picked: PickedBook | null; onPick: (b: PickedBook) => void;
}) {
  const result = useQuickLookup(title, author, token, !!picked && picked.title === title);
  if (picked && picked.title === title) {
    return <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /> Real book found: {picked.title} by {picked.author}</p>;
  }
  if (!result || !result.suggestions.length) return null;
  const best = result.best!;
  const typedIsBest = best.title.trim().toLowerCase() === title.trim().toLowerCase();
  return (
    <div className="space-y-1" data-testid="book-suggest">
      {!typedIsBest && result.status !== "none" && (
        <p className="text-sm">
          Did you mean{" "}
          <button type="button" className="font-semibold italic text-purple-500 underline underline-offset-2" onClick={() => onPick(best)}>{best.title}</button>
          {best.author ? <span className="text-muted-foreground"> by {best.author}</span> : null}?
        </p>
      )}
      <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-card p-1">
        {result.suggestions.slice(0, 5).map((b) => <BookChoice key={`${b.source}-${b.key || b.title}`} book={b} onPick={() => onPick(b)} />)}
      </div>
    </div>
  );
}

/** When the server couldn't match the title: pick the real book, or keep what was typed (the teacher is told). */
export function DidYouMeanList({ suggestions, typed, onPick, onKeep }: {
  suggestions: BookCandidate[]; typed: string; onPick: (b: PickedBook) => void; onKeep: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-purple-500/30 bg-purple-500/5 p-3" data-testid="did-you-mean">
      <p className="text-sm font-semibold">{suggestions.length ? "Did you mean one of these books?" : `We couldn't find "${typed}".`}</p>
      {suggestions.length ? <div className="space-y-0.5">{suggestions.map((b) => <BookChoice key={`${b.source}-${b.key || b.title}`} book={b} onPick={() => onPick(b)} label="This one" />)}</div>
        : <p className="text-xs text-muted-foreground">Check the spelling of the title and the author's name, then try again.</p>}
      <button type="button" onClick={onKeep} className="text-xs text-muted-foreground underline underline-offset-2">
        None of these. Make the quiz for "{typed}" anyway (your teacher will check it)
      </button>
    </div>
  );
}
