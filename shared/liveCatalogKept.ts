// Reads and books an iPhone app picked up from the server since it was built (shared/liveCatalog.ts),
// kept on the phone. client/src/lib/liveCatalog.ts puts them on globalThis before the app starts, and
// each list (ariseNews, readsCatalog, classicsCatalog) adds them when it loads. No imports, so the app's
// first screen doesn't pull in every read (on the server there are none: nothing changes).
import type { NewsArticle } from "./ariseNews";
import type { ReadableBook } from "./readsCatalog";
import type { ClassicBook } from "./classicsCatalog";

export const NAME = /^[a-z0-9][a-z0-9-]{0,119}$/;
const str = (v: unknown, max = 20_000) => typeof v === "string" && v.length > 0 && v.length <= max;
export const okRead = (a: any): a is NewsArticle => !!a && NAME.test(String(a.slug)) && str(a.title, 300) && str(a.section, 60) && str(a.dek, 1000) && str(a.publishedOn, 20)
  && Array.isArray(a.body) && a.body.length > 0 && Array.isArray(a.questions) && Array.isArray(a.words);
export const okBook = (b: any): b is ReadableBook => !!b && Number.isInteger(b.bookId) && (b.key === null || (typeof b.key === "string" && NAME.test(b.key))) && str(b.title, 300) && str(b.author, 200) && Number.isInteger(b.chapters) && b.chapters > 0;
export const okClassic = (c: any): c is ClassicBook => !!c && NAME.test(String(c.slug)) && str(c.title, 300) && str(c.author, 200) && str(c.genre, 60) && Number.isInteger(c.chapters) && c.chapters > 0;
export const bookName = (b: ReadableBook) => b.key ?? String(b.bookId);

/** Adds the kept entries of one kind to a list (skipping broken ones and ones it has). */
export function addKept<T>(list: T[], kind: "reads" | "books" | "classics", ok: (x: any) => x is T, name: (x: T) => string): T[] {
  const kept = (globalThis as any).__ariseLiveCatalog?.[kind];
  if (!Array.isArray(kept) || !kept.length) return list;
  const have = new Set(list.map(name));
  for (const x of kept) if (ok(x) && !have.has(name(x))) { list.push(x); have.add(name(x)); }
  return list;
}
