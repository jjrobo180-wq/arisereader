// When two book rows are the same book: same title (ignoring "The/A/An", spacing and punctuation)
// by an author with the same last name. "Harry Potter and the Chamber of Secrets" by "J.K. Rowling"
// and by "J. K. Rowling" are one book; "Crash" by Jerry Spinelli and by Lisa McMann are two.
// Used so a book quiz is only ever added once, and its points only ever earned once.

const latinOnly = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "");

export function bookKey(title: unknown, author: unknown): string {
  const t = latinOnly(String(title ?? "")).trim().replace(/^(the|a|an)\s+/i, "").replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
  if (!t) return "";
  const a = latinOnly(String(author ?? "")).trim();
  const last = (a.split(/\s+/).pop() || a).replace(/[^a-zA-Z]+/g, "").toLowerCase();
  return `${t}|${last}`;
}

export const sameBook = (a: { title?: unknown; author?: unknown }, b: { title?: unknown; author?: unknown }) => {
  const k = bookKey(a.title, a.author);
  return !!k && k === bookKey(b.title, b.author);
};

/** Which copy each duplicate merges into: { dup id → kept id }. Pure, so it can be tested. */
export function planMerge(books: { id: number; title: string; author: string }[], attemptCount: Map<number, number>, questionCount: Map<number, number>): Map<number, number> {
  const groups = new Map<string, typeof books>();
  for (const b of books) { const k = bookKey(b.title, b.author); if (!k) continue; groups.set(k, [...(groups.get(k) || []), b]); }
  const merge = new Map<number, number>();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const keep = [...list].sort((a, b) => (attemptCount.get(b.id) || 0) - (attemptCount.get(a.id) || 0) || (questionCount.get(b.id) || 0) - (questionCount.get(a.id) || 0) || a.id - b.id)[0];
    for (const b of list) if (b.id !== keep.id) merge.set(b.id, keep.id);
  }
  return merge;
}
