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
