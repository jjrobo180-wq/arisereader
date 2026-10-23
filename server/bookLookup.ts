// "Did you mean" lookups for quiz requests. Three places are asked at once:
//  1. our own books (instant, forgiving of typos),
//  2. Open Library (real published books), with a few variations of what was typed so a typo in
//     one word doesn't hide the book,
//  3. the AI's best guess at the real book (it knows "Dog Man 2" is "Dog Man Unleashed"), which only
//     counts if Open Library confirms that book exists.
// Scoring and the exact/close/none decision are in shared/bookMatch.ts.
import { normalizeTitle, rankCandidates, titleSimilarity, type BookCandidate, type LookupResult } from "../shared/bookMatch";

type CatalogBook = { id: number; title: string; author?: string | null; coverUrl?: string | null; cover_url?: string | null };
export type LookupDeps = {
  fetch: typeof fetch;
  catalog: () => Promise<CatalogBook[]>;
  /** The AI's guess at the real title and author, or null. */
  aiGuess?: (title: string, author: string) => Promise<{ title: string; author: string } | null>;
};

const OL_FIELDS = "key,title,subtitle,author_name,cover_i,first_publish_year,edition_count,subject";
const cover = (id?: number | null) => (id ? `https://covers.openlibrary.org/b/id/${id}-L.jpg` : null);

async function openLibrary(f: typeof fetch, params: Record<string, string>, ms = 7000): Promise<(BookCandidate & { subtitle?: string | null })[]> {
  try {
    const q = new URLSearchParams({ ...params, fields: OL_FIELDS, limit: "8" });
    const res = await f(`https://openlibrary.org/search.json?${q}`, { signal: AbortSignal.timeout(ms), headers: { "User-Agent": "AriseReader/1.0 (arisereader.com)" } });
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    return (Array.isArray(data?.docs) ? data.docs : [])
      .filter((d: any) => d?.title && Array.isArray(d.author_name) && d.author_name.length)
      .map((d: any) => ({
        title: String(d.title), subtitle: d.subtitle ? String(d.subtitle) : null, author: String(d.author_name[0]),
        source: "openlibrary" as const, coverUrl: cover(d.cover_i), year: d.first_publish_year || null, key: d.key, editions: Number(d.edition_count) || 0,
        // A few subjects, so the approval screen can warn about adult books (shared/bookContent.ts).
        subjects: Array.isArray(d.subject) ? d.subject.slice(0, 40).map((x: unknown) => String(x).slice(0, 60)) : undefined,
      }));
  } catch { return []; }
}

/** What was typed, plus versions with one word left out (a misspelled word stops Open Library finding anything). */
export function queryVariants(title: string): string[] {
  const words = normalizeTitle(title).split(" ").filter(Boolean);
  const out = new Set<string>([words.join(" ")]);
  if (words.length >= 3) for (let i = 0; i < words.length && out.size < 5; i++) {
    if (words[i].length < 3) continue;
    out.add(words.filter((_, j) => j !== i).join(" "));
  }
  return [...out].filter((q) => q.length >= 2);
}

function fromCatalog(books: CatalogBook[], title: string): BookCandidate[] {
  return books
    .map((b) => ({ b, s: titleSimilarity(title, b.title) }))
    .filter((x) => x.s >= 0.5)
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map(({ b }) => ({ title: b.title, author: b.author || "", source: "catalog" as const, coverUrl: b.coverUrl ?? b.cover_url ?? null, bookId: b.id, key: String(b.id) }));
}

/**
 * Find the real book. `quick` (for suggestions while typing) skips the AI and uses fewer Open
 * Library searches; the full lookup runs when the student presses Create Quiz.
 */
export async function lookupBook(deps: LookupDeps, title: string, author: string, opts: { quick?: boolean } = {}): Promise<LookupResult> {
  const t = String(title || "").trim().slice(0, 200), a = String(author || "").trim().slice(0, 120);
  if (normalizeTitle(t).length < 2) return { status: "none", best: null, suggestions: [] };
  const variants = queryVariants(t).slice(0, opts.quick ? 2 : 5);
  const [catalog, ...lists] = await Promise.all([
    deps.catalog().then((books) => fromCatalog(books, t)).catch(() => [] as BookCandidate[]),
    ...variants.map((q) => openLibrary(deps.fetch, { q: a && !opts.quick ? `${q} ${a}` : q }, opts.quick ? 4000 : 7000)),
    ...(a && !opts.quick ? [openLibrary(deps.fetch, { title: t, author: a })] : []),
    ...(!opts.quick && deps.aiGuess ? [confirmAiGuess(deps, t, a)] : []),
  ]);
  return rankCandidates(t, a, [...catalog, ...lists.flat()]);
}

/** Ask the AI which real book was meant, then keep its answer only if Open Library has that book. */
async function confirmAiGuess(deps: LookupDeps, title: string, author: string): Promise<BookCandidate[]> {
  try {
    const guess = await deps.aiGuess!(title, author);
    if (!guess?.title) return [];
    const found = await openLibrary(deps.fetch, { title: guess.title, ...(guess.author ? { author: guess.author } : {}) });
    const match = found.find((c) => titleSimilarity(guess.title, c.subtitle ? `${c.title}: ${c.subtitle}` : c.title) >= 0.9 || titleSimilarity(guess.title, c.title) >= 0.95);
    if (!match) return [];
    // Keep the AI's spelling of the full title when Open Library only has the series name ("Dog Man" for every book).
    const title2 = titleSimilarity(guess.title, match.title) >= 0.95 ? (match.subtitle ? `${match.title}: ${match.subtitle}` : match.title) : guess.title;
    return [{ ...match, subtitle: null, title: title2, author: match.author || guess.author, source: "ai" }];
  } catch { return []; }
}

/** Check a book the student picked from the suggestions is real (the browser can't be trusted to say so). */
export async function confirmPicked(deps: LookupDeps, picked: { title?: unknown; author?: unknown; source?: unknown; bookId?: unknown }): Promise<BookCandidate | null> {
  const title = String(picked?.title || "").trim().slice(0, 200), author = String(picked?.author || "").trim().slice(0, 120);
  if (!title) return null;
  if (picked.source === "catalog" && Number(picked.bookId)) {
    const book = (await deps.catalog()).find((b) => b.id === Number(picked.bookId));
    return book ? { title: book.title, author: book.author || author, source: "catalog", bookId: book.id, coverUrl: book.coverUrl ?? book.cover_url ?? null } : null;
  }
  const base = title.split(":")[0].trim();
  const found = await openLibrary(deps.fetch, { title: base, ...(author ? { author } : {}) });
  const hit = found.find((c) => titleSimilarity(title, c.subtitle ? `${c.title}: ${c.subtitle}` : c.title) >= 0.9 || titleSimilarity(title, c.title) >= 0.95);
  return hit ? { ...hit, title, author: hit.author, source: picked.source === "ai" ? "ai" : "openlibrary" } : null;
}
