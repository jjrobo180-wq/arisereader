// Pod+ Audiobooks: free public domain audiobooks from LibriVox, read by volunteers. Every LibriVox
// recording is kept at the Internet Archive (collection "librivoxaudio"), which lists them by how
// many people have listened and keeps each book's chapters as MP3 files. The server asks the
// Archive (and keeps the answers a while), so the page never depends on another site letting it
// in; the audio itself plays straight from the Archive. Only items in the LibriVox collection are
// ever returned, so everything here is public domain.
import type { Express, RequestHandler } from "express";

export type Book = { id: string; title: string; author: string; cover: string; downloads: number; rating: number; reviews: number; about: string };
export type BookChapter = { n: number; title: string; secs: number; audio: string };
export type BookDetail = Book & { chapters: BookChapter[]; secs: number; link: string };

export type JsonFetcher = (url: string) => Promise<any>;

const ARCHIVE = "https://archive.org";
export const BOOK_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/** Shelves on the Audiobooks page: words searched in the books' titles, subjects and blurbs. */
export const BOOK_SHELVES: Record<string, { label: string; words?: string }> = {
  top: { label: "Top rated" },
  mystery: { label: "Mystery", words: "mystery OR detective OR sherlock" },
  adventure: { label: "Adventure", words: "adventure OR pirates OR treasure" },
  scifi: { label: "Sci-fi", words: "\"science fiction\" OR martians OR \"time machine\"" },
  horror: { label: "Horror", words: "horror OR ghost OR vampire OR gothic" },
  romance: { label: "Romance", words: "romance OR love" },
  kids: { label: "Kids", words: "children OR fairy OR \"fairy tales\"" },
  history: { label: "History", words: "history OR biography OR war" },
  philosophy: { label: "Philosophy", words: "philosophy OR stoic OR wisdom" },
  poetry: { label: "Poetry", words: "poetry OR poems OR verse" },
};

const plain = (s: unknown, max: number) => String(Array.isArray(s) ? s.join(" ") : s ?? "")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/\s+/g, " ").trim().slice(0, max);
const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const num = (v: unknown) => { const n = Number(first(v)); return Number.isFinite(n) ? n : 0; };
export const coverOf = (id: string) => `${ARCHIVE}/services/img/${encodeURIComponent(id)}`;

/** "Pride and Prejudice (version 3)" and "Pride and Prejudice" are the same book read again. */
export const baseTitle = (t: string) => t.replace(/\s*\((version|dramatic reading|abridged|unabridged)[^)]*\)\s*$/i, "").replace(/\s*[-–]\s*librivox.*$/i, "").trim();
/** LibriVox's own podcasts and anniversary collections aren't books someone sits down to hear. */
const notABook = (t: string) => /podcast|librivox community|anniversary collection|short (story|poetry) collection \d|weekly poetry|fortnightly/i.test(t);

/** The Archive's search answer, as books: one copy of each book (the most listened-to reading). */
export function booksFromSearch(body: any): Book[] {
  const docs: any[] = Array.isArray(body?.response?.docs) ? body.response.docs : [];
  const seen = new Set<string>();
  const out: Book[] = [];
  for (const d of docs) {
    const id = String(first(d?.identifier) || "");
    const title = plain(first(d?.title), 200);
    if (!BOOK_ID.test(id) || !title || notABook(title)) continue;
    const key = baseTitle(title).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id, title: baseTitle(title) || title, author: plain(first(d?.creator), 120), cover: coverOf(id),
      downloads: Math.max(0, Math.round(num(d?.downloads))), rating: Math.round(num(d?.avg_rating) * 10) / 10, reviews: Math.max(0, Math.round(num(d?.num_reviews))),
      about: plain(d?.description, 400),
    });
  }
  return out;
}

/** "1234.5", "20:34" or "1:02:03" → seconds. */
export function lengthSecs(v: unknown): number {
  const s = String(v ?? "").trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s));
  const parts = s.split(":").map(Number);
  if (parts.length >= 2 && parts.length <= 3 && parts.every((n) => Number.isFinite(n))) return Math.round(parts.reduce((t, n) => t * 60 + n, 0));
  return 0;
}

const trackNo = (v: unknown) => { const m = /^(\d+)/.exec(String(v ?? "")); return m ? Number(m[1]) : NaN; };

/** One book's chapters from the Archive's metadata answer: one MP3 per chapter, in order. The
 *  64 kbps copies are LibriVox's standard ones (small enough for a phone on data); otherwise the
 *  128 kbps or variable-rate copies. Null when it isn't a LibriVox item or has no audio. */
export function bookFromMetadata(id: string, body: any): BookDetail | null {
  const meta = body?.metadata || {};
  const collections = ([] as unknown[]).concat(meta.collection ?? []).map(String);
  if (!collections.includes("librivoxaudio")) return null;
  const files: any[] = Array.isArray(body?.files) ? body.files : [];
  const mp3 = files.filter((f) => /\.mp3$/i.test(String(f?.name || "")) && /mp3/i.test(String(f?.format || "")) && !/\/|_spoken|sample/i.test(String(f?.name || "")));
  const pick = ["64Kbps MP3", "128Kbps MP3", "VBR MP3"].map((fmt) => mp3.filter((f) => String(f.format) === fmt)).find((l) => l.length) ?? mp3;
  if (!pick.length) return null;
  const sorted = [...pick].sort((a, b) => {
    const ta = trackNo(a.track), tb = trackNo(b.track);
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
    return String(a.name).localeCompare(String(b.name), undefined, { numeric: true });
  });
  const chapters: BookChapter[] = sorted.slice(0, 400).map((f, i) => ({
    n: i + 1,
    title: plain(f.title, 160) || `Chapter ${i + 1}`,
    secs: lengthSecs(f.length),
    audio: `${ARCHIVE}/download/${encodeURIComponent(id)}/${String(f.name).split("/").map(encodeURIComponent).join("/")}`,
  }));
  const title = plain(first(meta.title), 200);
  return {
    id, title: baseTitle(title) || title || "Audiobook", author: plain(first(meta.creator), 120), cover: coverOf(id),
    downloads: Math.round(num(meta.downloads)), rating: 0, reviews: 0, about: plain(meta.description, 1500),
    chapters, secs: chapters.reduce((t, c) => t + c.secs, 0), link: `${ARCHIVE}/details/${encodeURIComponent(id)}`,
  };
}

/** The Archive search for a shelf, or for what someone typed. Most listened-to first. */
export function searchUrl(shelf: string, q: string, page: number): string {
  const words = q.replace(/[^\p{L}\p{N}' -]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80).toLowerCase();
  let query = "collection:(librivoxaudio) AND mediatype:(audio)";
  if (words) query += ` AND (title:(${words}) OR creator:(${words}))`;
  else if (BOOK_SHELVES[shelf]?.words) query += ` AND (${BOOK_SHELVES[shelf].words})`;
  const p = new URLSearchParams({ q: query, rows: "80", page: String(Math.min(Math.max(1, page), 10)), output: "json" });
  for (const f of ["identifier", "title", "creator", "downloads", "avg_rating", "num_reviews", "description"]) p.append("fl[]", f);
  p.append("sort[]", "downloads desc");
  return `${ARCHIVE}/advancedsearch.php?${p}`;
}

const defaultFetch: JsonFetcher = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": "PodPlus/1.0 (audiobooks; arisereader.onrender.com)" }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`archive ${r.status}`);
  return r.json();
};

export function registerAudiobookRoutes(app: Express, gate: RequestHandler, opts: { fetchJson?: JsonFetcher; prefix?: string; now?: () => number } = {}) {
  const prefix = opts.prefix ?? "/api/podscroll";
  const get = opts.fetchJson ?? defaultFetch;
  const now = opts.now ?? Date.now;
  // Lists change slowly (a day); a book's chapters never do (a week). Kept small.
  const cache = new Map<string, { at: number; ttl: number; value: unknown }>();
  const cached = async <T>(key: string, ttl: number, make: () => Promise<T>): Promise<T> => {
    const hit = cache.get(key);
    if (hit && now() - hit.at < hit.ttl) return hit.value as T;
    const value = await make();
    cache.set(key, { at: now(), ttl, value });
    if (cache.size > 600) { const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 100); for (const [k] of oldest) cache.delete(k); }
    return value;
  };

  app.get(`${prefix}/books`, gate, async (req: any, res) => {
    const shelf = BOOK_SHELVES[String(req.query.shelf || "")] ? String(req.query.shelf) : "top";
    const q = String(req.query.q || "").slice(0, 80);
    const page = Math.floor(Number(req.query.page)) || 1;
    try {
      const books = await cached(`list:${shelf}:${q.toLowerCase()}:${page}`, 24 * 3600_000, async () => booksFromSearch(await get(searchUrl(shelf, q, page))));
      res.set("Cache-Control", "public, max-age=3600").json({ books, shelves: Object.entries(BOOK_SHELVES).map(([id, s]) => ({ id, label: s.label })) });
    } catch (e: any) {
      console.error("[audiobooks] list:", e?.message || e);
      res.status(502).json({ message: "Audiobooks aren't loading right now. Try again in a moment." });
    }
  });

  app.get(`${prefix}/books/:id`, gate, async (req: any, res) => {
    const id = String(req.params.id || "");
    if (!BOOK_ID.test(id)) return res.status(404).json({ message: "That audiobook doesn't exist." });
    try {
      const book = await cached(`book:${id}`, 7 * 24 * 3600_000, async () => bookFromMetadata(id, await get(`${ARCHIVE}/metadata/${encodeURIComponent(id)}`)));
      if (!book) return res.status(404).json({ message: "That audiobook isn't available." });
      res.set("Cache-Control", "public, max-age=86400").json({ book });
    } catch (e: any) {
      console.error("[audiobooks] book:", e?.message || e);
      res.status(502).json({ message: "This audiobook isn't loading right now. Try again in a moment." });
    }
  });
}
