// "Did you mean" for book titles. A student types a title and author; we find the real published
// book they mean, so a quiz is never made for a book that doesn't exist (like "Dog Man 2", which is
// really "Dog Man Unleashed"), and the title on the quiz is spelled the way the book spells it.
//
// Pure functions only (scoring and the risk flags shown before a quiz is approved). The lookups
// themselves (our catalog, Open Library, the AI's guess) are in server/bookLookup.ts.

export type BookCandidate = {
  title: string;
  author: string;
  /** Where it came from: one of our books, Open Library, or the AI's guess that Open Library confirmed. */
  source: "catalog" | "openlibrary" | "ai";
  coverUrl?: string | null;
  year?: number | null;
  /** Open Library work key (e.g. "/works/OL123W") or our book id as a string. */
  key?: string;
  bookId?: number;
  /** How popular it is (Open Library editions), used to break ties. */
  editions?: number;
  score?: number;
};

export type MatchStatus = "exact" | "close" | "none";
export type LookupResult = { status: MatchStatus; best: BookCandidate | null; suggestions: BookCandidate[] };

/** What we know about how a quiz's book was checked, saved with the pending quiz for the approval screen. */
export type QuizVerification = {
  typed: { title: string; author: string };
  /** exact: typed a real title; picked: chose a "Did you mean" suggestion; kept: kept their own words; none: nothing matched. */
  match: "exact" | "picked" | "kept" | "none";
  book: BookCandidate | null;
  suggestions?: BookCandidate[];
  /** Web pages the AI used to write the questions. */
  sources: string[];
  /** How many questions came back with a reference to where in the book the answer is. */
  questionsWithEvidence: number;
  questionCount: number;
  /** The AI said it couldn't find this book or wasn't sure about its details. */
  aiUnsure?: boolean;
  checkedAt: string;
};

const ARTICLES = /^(the|a|an)\s+/;

/** Lowercase, no accents or punctuation, "&" as "and", single spaces. */
export function normalizeTitle(s: string): string {
  return String(s || "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

const ratio = (a: string, b: string) => (!a && !b ? 1 : 1 - levenshtein(a, b) / Math.max(a.length, b.length));

/** Words match if they're the same, or one typo apart for longer words ("diry" ≈ "diary"). */
function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const n = Math.max(a.length, b.length);
  if (n < 4) return false;
  return levenshtein(a, b) <= (n >= 8 ? 2 : 1);
}

/** 0 to 1: how close two titles are, forgiving typos, missing "The", and word order. */
export function titleSimilarity(typed: string, title: string): number {
  const a = normalizeTitle(typed), b = normalizeTitle(title);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const a2 = a.replace(ARTICLES, ""), b2 = b.replace(ARTICLES, "");
  if (a2 === b2) return 0.99;
  const chars = ratio(a2, b2);
  const aw = a2.split(" "), bw = b2.split(" ");
  const used = new Set<number>();
  let hits = 0;
  for (const w of aw) {
    const j = bw.findIndex((x, i) => !used.has(i) && wordsMatch(w, x));
    if (j >= 0) { used.add(j); hits++; }
  }
  const words = (2 * hits) / (aw.length + bw.length);
  // All typed words found, in a longer title ("wimpy kid" → "Diary of a Wimpy Kid"): a decent match, not exact.
  const contained = hits === aw.length ? 0.15 * (aw.length / bw.length) : 0;
  return Math.min(0.98, Math.max(chars, words * 0.95 + contained));
}

export function authorSimilarity(typed: string, author: string): number {
  const a = normalizeTitle(typed).replace(/\b[a-z]\b/g, "").replace(/\s+/g, " ").trim();
  const b = normalizeTitle(author).replace(/\b[a-z]\b/g, "").replace(/\s+/g, " ").trim();
  if (!a || !b) return 0;
  if (a === b) return 1;
  // Last names are what kids usually get right ("pilkey" for "Dav Pilkey").
  const al = a.split(" ").pop()!, bl = b.split(" ").pop()!;
  const last = wordsMatch(al, bl) ? 0.85 : 0;
  return Math.max(ratio(a, b), last, titleSimilarity(a, b) * 0.9);
}

/** A candidate's full title: "Dog Man: Lord of the Fleas". */
export const fullTitle = (c: { title: string; subtitle?: string | null }) => (c.subtitle ? `${c.title}: ${c.subtitle}` : c.title);

/** Score one candidate against what was typed. */
export function scoreCandidate(typedTitle: string, typedAuthor: string, c: BookCandidate & { subtitle?: string | null }): number {
  const t = Math.max(titleSimilarity(typedTitle, c.title), c.subtitle ? titleSimilarity(typedTitle, fullTitle(c)) : 0);
  const hasAuthor = !!normalizeTitle(typedAuthor) && !!normalizeTitle(c.author);
  const a = hasAuthor ? authorSimilarity(typedAuthor, c.author) : 0.5;
  const pop = Math.min(0.04, Math.log10(1 + (c.editions || 0)) / 75);
  const aiBoost = c.source === "ai" ? 0.1 : 0;
  // "Dog Man 2" means the second book: a candidate without that number is probably not it.
  const nums = normalizeTitle(typedTitle).match(/\b\d+\b/g) || [];
  const full = normalizeTitle(fullTitle(c));
  const numberMiss = c.source !== "ai" && nums.some((n) => !new RegExp(`\\b${n}\\b`).test(full)) ? 0.08 : 0;
  return Math.round((t * 0.75 + a * 0.25 + pop + aiBoost - numberMiss) * 1000) / 1000;
}

/** Rank candidates, drop duplicates and weak ones, and say whether the typed title is a real book. */
export function rankCandidates(typedTitle: string, typedAuthor: string, candidates: (BookCandidate & { subtitle?: string | null })[], limit = 5): LookupResult {
  const seen = new Set<string>();
  const ranked = candidates
    .filter((c) => c && c.title)
    .map((c) => ({ ...c, title: fullTitle(c), score: scoreCandidate(typedTitle, typedAuthor, c) }))
    .sort((x, y) => (y.score! - x.score!) || ((y.editions || 0) - (x.editions || 0)))
    .filter((c) => {
      const k = `${normalizeTitle(c.title)}|${normalizeTitle(c.author).split(" ").pop()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return c.score! >= 0.45;
    })
    .map(({ subtitle: _s, ...c }: any) => c as BookCandidate)
    .slice(0, limit);
  const best = ranked[0] || null;
  if (!best) return { status: "none", best: null, suggestions: [] };
  const titleExact = normalizeTitle(best.title) === normalizeTitle(typedTitle) || normalizeTitle(best.title).replace(ARTICLES, "") === normalizeTitle(typedTitle).replace(ARTICLES, "");
  const authorOk = !normalizeTitle(typedAuthor) || authorSimilarity(typedAuthor, best.author) >= 0.8;
  // An exact title that is also one of several real books with that name still needs the student to pick.
  const sameTitle = ranked.filter((c) => normalizeTitle(c.title) === normalizeTitle(best.title)).length;
  const status: MatchStatus = titleExact && authorOk && sameTitle === 1 && best.source !== "ai" ? "exact" : best.score! >= 0.55 ? "close" : "none";
  return { status, best, suggestions: ranked };
}

/** What could be wrong with a pending quiz, in plain words for the person approving it. Empty means nothing found. */
export function quizRiskFlags(v: QuizVerification | null | undefined): { level: "high" | "medium"; text: string }[] {
  if (!v) return [{ level: "medium", text: "This quiz was made before book checks existed. Check the questions against the book before approving." }];
  const out: { level: "high" | "medium"; text: string }[] = [];
  if (v.match === "none") out.push({ level: "high", text: `"${v.typed.title}" didn't match any real book. The quiz may be about the wrong book or made up.` });
  if (v.match === "kept") out.push({ level: "high", text: `The student kept "${v.typed.title}" instead of picking a real book${v.suggestions?.[0] ? ` (closest: "${v.suggestions[0].title}" by ${v.suggestions[0].author})` : ""}.` });
  if (v.aiUnsure) out.push({ level: "high", text: "The AI said it couldn't find details about this book. Its questions may be guessed." });
  if (!v.sources.length) out.push({ level: "high", text: "The AI listed no sources for these questions." });
  const missing = v.questionCount - v.questionsWithEvidence;
  if (v.questionCount && missing > 0) out.push({ level: missing >= v.questionCount / 2 ? "high" : "medium", text: `${missing} of ${v.questionCount} questions don't say where in the book the answer is.` });
  return out;
}
