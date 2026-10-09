// How many pages a book has, asked of Open Library (the same free catalog the
// site already uses for covers). Only the page count is read; a book's points are
// then worked out by the site's own rule in shared/bookPoints.ts.
//
// It never throws and never holds a request up for long: no answer just means
// the grade band decides the points alone.
import { cleanPages } from "../shared/bookPoints";

const SEARCH = "https://openlibrary.org/search.json";
const plain = (text: unknown) => String(text ?? "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** A title without its subtitle: "Hatchet: 30th Anniversary Edition" is "hatchet". */
const mainTitle = (text: unknown) => plain(String(text ?? "").split(/[:(]|\s[-–—]\s/)[0]);

/**
 * Reads the page count out of an Open Library search answer: a result with
 * exactly this title if there is one, otherwise one that is this title with a
 * subtitle added or left off. ("Hatchet Job" is not "Hatchet".)
 */
export function pagesFromSearch(body: any, title: string): number | null {
  const wanted = plain(title);
  if (!wanted || !Array.isArray(body?.docs)) return null;
  const counted = body.docs
    .map((doc: any) => ({ full: plain(doc?.title), main: mainTitle(doc?.title), pages: cleanPages(doc?.number_of_pages_median) }))
    .filter((doc: any) => doc.full && doc.pages !== null && doc.pages >= 8);
  const hit = counted.find((doc: any) => doc.full === wanted)
    ?? counted.find((doc: any) => doc.main === wanted || doc.full === mainTitle(title));
  return hit ? hit.pages : null;
}

type Fetch = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<any> }>;

export async function lookupPages(title: string, author: string, fetchPage: Fetch = fetch as any, timeoutMs = 4000): Promise<number | null> {
  if (!String(title || "").trim()) return null;
  try {
    const query = new URLSearchParams({ title: String(title), limit: "5", fields: "title,author_name,number_of_pages_median" });
    if (String(author || "").trim()) query.set("author", String(author));
    const response = await fetchPage(`${SEARCH}?${query}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    return pagesFromSearch(await response.json(), title);
  } catch {
    return null;
  }
}
