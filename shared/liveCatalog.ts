// New reads and books reach the iPhone apps without an app update (November 2026).
//
// The apps carry the reads and book lists that were current when they were built. When they open they
// ask the server which reads and books exist (/api/content/catalog: names only, small), fetch just the
// ones they don't have (/api/content/catalog/items), keep those on the phone and add them to their
// lists. So a new 5-Minute Read or book shows up the next time someone opens the app, like the website.
// The books' chapters are read from the server too (client/src/main.tsx), so no files ship with them.
import { NEWS_ARTICLES, type NewsArticle } from "./ariseNews";
import { READABLE_BOOKS, type ReadableBook } from "./readsCatalog";
import { CLASSIC_BOOKS, type ClassicBook } from "./classicsCatalog";
import { NAME, bookName, okBook, okClassic, okRead } from "./liveCatalogKept";
export { NAME, bookName };

export type CatalogIndex = { reads: string[]; books: string[]; classics: string[] };
export type CatalogItems = { reads: NewsArticle[]; books: ReadableBook[]; classics: ClassicBook[] };


export const catalogIndex = (): CatalogIndex => ({
  reads: NEWS_ARTICLES.map((a) => a.slug),
  books: READABLE_BOOKS.map(bookName),
  classics: CLASSIC_BOOKS.map((c) => c.slug),
});

/** What this copy of the app is missing from the server's index. */
export function missingFrom(index: unknown): CatalogIndex {
  const i = (index && typeof index === "object" ? index : {}) as Partial<CatalogIndex>;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && NAME.test(s)) : []);
  const have = catalogIndex();
  const not = (mine: string[]) => { const s = new Set(mine); return (x: string) => !s.has(x); };
  return {
    reads: list(i.reads).filter(not(have.reads)).slice(0, MAX),
    books: list(i.books).filter(not(have.books)).slice(0, MAX),
    classics: list(i.classics).filter(not(have.classics)).slice(0, MAX),
  };
}

export const MAX = 300;

/** The full entries for the names asked for (the server's side). */
export function catalogItems(ask: Partial<CatalogIndex>): CatalogItems {
  const pick = <T,>(all: T[], name: (t: T) => string, want?: string[]) => { const w = new Set((want || []).slice(0, MAX)); return all.filter((t) => w.has(name(t))); };
  return { reads: pick(NEWS_ARTICLES, (a) => a.slug, ask.reads), books: pick(READABLE_BOOKS, bookName, ask.books), classics: pick(CLASSIC_BOOKS, (c) => c.slug, ask.classics) };
}


/** Adds entries this copy doesn't have to its lists. Returns how many were added. */
export function addToCatalog(items: unknown): number {
  const i = (items && typeof items === "object" ? items : {}) as Partial<Record<keyof CatalogItems, unknown[]>>;
  const have = catalogIndex();
  const reads = new Set(have.reads), books = new Set(have.books), classics = new Set(have.classics);
  let added = 0;
  for (const a of Array.isArray(i.reads) ? i.reads : []) if (okRead(a) && !reads.has(a.slug)) { NEWS_ARTICLES.push(a); reads.add(a.slug); added++; }
  for (const b of Array.isArray(i.books) ? i.books : []) if (okBook(b) && !books.has(bookName(b))) { READABLE_BOOKS.push(b); books.add(bookName(b)); added++; }
  for (const c of Array.isArray(i.classics) ? i.classics : []) if (okClassic(c) && !classics.has(c.slug)) { CLASSIC_BOOKS.push(c); classics.add(c.slug); added++; }
  return added;
}
