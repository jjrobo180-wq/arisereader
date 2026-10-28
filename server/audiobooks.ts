// Pod+ Audiobooks: free public domain audiobooks from LibriVox, read by volunteers. Every LibriVox
// recording is kept at the Internet Archive (collection "librivoxaudio"), which lists them (by
// listens, by date, by rating) and keeps each book's chapters as MP3 files. The server asks the
// Archive and keeps the answers a while, so the page never depends on another site letting it in.
// Audio plays straight from the Archive, or through /books/audio when Voice boost needs to shape
// the sound (a page may only shape audio a site has allowed it to read). Only items in the LibriVox
// collection are ever returned, so everything here is public domain.
//
// Also here:
//  - Other readings of the same book (LibriVox often has several: one reader, a group, a dramatic
//    reading), so a listener can pick the voice they like.
//  - Chapter names made uniform: "c1", "01 - Chapter 01: The Period", "PRIDE AND PREJUDICE Chap 1"
//    all become "Chapter 1" with "The Period" beside it.
//  - Read along: the book's original text, from Project Gutenberg (public domain, like the book;
//    Gutenberg's own header and license are left off, as its terms ask when the text is reused).
//  - AI search: "something like Sherlock Holmes but spookier" → real LibriVox books.
import type { Express, RequestHandler } from "express";
import { Readable } from "node:stream";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";

export type BookKind = "solo" | "group" | "dramatic";
export type Book = { id: string; title: string; author: string; cover: string; downloads: number; rating: number; reviews: number; about: string; reader: string; kind: BookKind; added: string };
export type BookChapter = { n: number; title: string; sub: string; secs: number; audio: string; bytes: number };
/** A line of an AI transcript: start and end (seconds into the chapter) and the words. */
export type TxLine = { s: number; e: number; t: string };
export type BookDetail = Book & { chapters: BookChapter[]; secs: number; link: string; gutenberg: number };
export type TextSection = { heading: string; text: string };

export type JsonFetcher = (url: string) => Promise<any>;
export type TextFetcher = (url: string) => Promise<string>;
export type AskJson = (system: string, user: string) => Promise<any>;
export type Transcriber = (audio: Blob, name: string, prompt?: string) => Promise<{ segments: { start: number; end: number; text: string }[] }>;
/** AI transcripts are made 10 minutes at a time, as the listener gets there. */
export const TX_PIECE_SECS = 600;

const ARCHIVE = "https://archive.org";
export const BOOK_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/** Shelves: words searched in the books' titles, subjects and blurbs. */
export const BOOK_SHELVES: Record<string, { label: string; words?: string }> = {
  all: { label: "All" },
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
/** How a shelf is ordered. */
export const BOOK_SORTS: Record<string, { label: string; sort: string; also?: string }> = {
  popular: { label: "Most popular", sort: "downloads desc" },
  trending: { label: "Trending this week", sort: "week desc" },
  new: { label: "Newest", sort: "addeddate desc" },
  rated: { label: "Top rated", sort: "avg_rating desc", also: "num_reviews:[3 TO 100000]" },
  az: { label: "A to Z", sort: "titleSorter asc" },
};

const ENT: Record<string, string> = { nbsp: " ", amp: "&", quot: "\"", "#39": "'", apos: "'", lt: "<", gt: ">", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", mdash: "—", ndash: "–", hellip: "…" };
const plain = (s: unknown, max: number) => String(Array.isArray(s) ? s.join(" ") : s ?? "")
  .replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&([a-z#0-9]+);/gi, (m, e) => ENT[e.toLowerCase()] ?? m)
  .replace(/\s+/g, " ").trim().slice(0, max);
const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const num = (v: unknown) => { const n = Number(first(v)); return Number.isFinite(n) ? n : 0; };
export const coverOf = (id: string) => `${ARCHIVE}/services/img/${encodeURIComponent(id)}`;

/** "Pride and Prejudice (version 3)" and "Pride and Prejudice" are the same book read again. */
export const baseTitle = (t: string) => t.replace(/\s*\((version|dramatic reading|abridged|unabridged|dramatized)[^)]*\)\s*/gi, " ").replace(/\s*[-–]\s*librivox.*$/i, "").replace(/\s+/g, " ").trim();
/** LibriVox's own podcasts and anniversary collections aren't books someone sits down to hear. */
const notABook = (t: string) => /podcast|librivox community|anniversary collection|short (story|poetry) collection \d|weekly poetry|fortnightly/i.test(t);

/** Who reads it, and how: one reader, a group taking turns, or a cast (a dramatic reading). */
export function readerOf(title: string, description: string): { reader: string; kind: BookKind } {
  const d = plain(description, 3000);
  if (/dramati[cz]/i.test(title) || /dramatic reading|full cast|cast list/i.test(d)) return { reader: "Full cast", kind: "dramatic" };
  const m = /\bread by:?\s+([^.;:()\n]{2,80})/i.exec(d);
  const who = (m?.[1] || "").replace(/\s+(for librivox|in \d{4}).*$/i, "").trim();
  if (!who || /volunteers|various|librivox|readers/i.test(who) || /,|\band\b|&/.test(who)) return { reader: "Group of readers", kind: "group" };
  return { reader: who.slice(0, 60), kind: "solo" };
}

/** The Archive's search answer, as books. `oneEach`: one copy of each book (the first one, which
 *  is the most listened-to on the popular shelf). */
export function booksFromSearch(body: any, oneEach = true): Book[] {
  const docs: any[] = Array.isArray(body?.response?.docs) ? body.response.docs : [];
  const seen = new Set<string>();
  const out: Book[] = [];
  for (const d of docs) {
    const id = String(first(d?.identifier) || "");
    const title = plain(first(d?.title), 200);
    if (!BOOK_ID.test(id) || !title || notABook(title)) continue;
    const key = baseTitle(title).toLowerCase();
    if (oneEach && seen.has(key)) continue;
    seen.add(key);
    out.push({
      id, title: baseTitle(title) || title, author: plain(first(d?.creator), 120), cover: coverOf(id),
      downloads: Math.max(0, Math.round(num(d?.downloads))), rating: Math.round(num(d?.avg_rating) * 10) / 10, reviews: Math.max(0, Math.round(num(d?.num_reviews))),
      about: plain(d?.description, 400), ...readerOf(title, String(first(d?.description) ?? "")), added: String(first(d?.addeddate) || "").slice(0, 10),
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

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
export function roman(s: string): number {
  if (!/^[IVXLCDM]+$/.test(s)) return 0;
  let t = 0;
  for (let i = 0; i < s.length; i++) { const v = ROMAN[s[i]], n = ROMAN[s[i + 1]] || 0; t += v < n ? -v : v; }
  return t > 0 && t < 400 ? t : 0;
}
const numberOf = (s: string) => (/^\d+$/.test(s) ? Number(s) : roman(s.toUpperCase() === s ? s : ""));
const capWord = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
/** ALL-CAPS headings read as shouting: "THE PERIOD" → "The Period". */
const unshout = (s: string) => (/[a-z]/.test(s) || !/[A-Z]{3}/.test(s) ? s : s.toLowerCase().replace(/(^|[\s"“(—-])([a-z])/g, (_, a, b) => a + b.toUpperCase())
  .replace(/\b(Chapter|Book|Part|Stave|Letter|Section|Canto|Act|Lecture|Volume) ([ivxlcdm]+)\b/gi, (_, w, n) => `${w} ${n.toUpperCase()}`));
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One chapter's name, made uniform: { title: "Chapter 1", sub: "The Period" }. Names that aren't
 *  numbered parts ("Preface", "The Red-Headed League") keep their name as the title. */
export function tidyChapter(raw: string, bookTitle: string): { title: string; sub: string } {
  let s = plain(raw, 200).replace(/_/g, " ");
  const bt = baseTitle(bookTitle);
  if (bt.length > 3) s = s.replace(new RegExp(`^${escapeRe(bt)}\\b[\\s:.,\\-–—]*`, "i"), "");
  s = s.replace(/^(\d{1,3})\s*[-–—.:)]\s+(?=\S)/, "").replace(/\s*[-–—(]?\s*(read by|librivox).*$/i, "").trim();
  const sep = "[\\s:.,\\-–—]*";
  const part = new RegExp(`^(chapter|chap|ch|c|book|part|section|volume|vol|letter|act|scene|canto|stave|lecture|essay|story|poem|episode)\\.?${sep}(\\d{1,3}|[IVXLCDMivxlcdm]{1,8})\\b${sep}(.*)$`, "i").exec(s);
  if (part) {
    const n = numberOf(part[2]);
    if (n) {
      const word = /^(c|ch|chap)$/i.test(part[1]) ? "Chapter" : /^vol$/i.test(part[1]) ? "Volume" : capWord(part[1]);
      const rest = unshout(part[3].replace(/^[\s:.,\-–—]+/, "").trim());
      return { title: `${word} ${n}`, sub: rest };
    }
  }
  if (/^\d{1,3}$/.test(s)) return { title: `Chapter ${Number(s)}`, sub: "" };
  return { title: unshout(s) || "", sub: "" };
}

const trackNo = (v: unknown) => { const m = /^(\d+)/.exec(String(v ?? "")); return m ? Number(m[1]) : NaN; };

/** The Project Gutenberg book a LibriVox recording was read from, when its page says so. */
export function gutenbergIdOf(meta: any): number {
  const text = [meta?.description, meta?.source, meta?.["url_text_source"], meta?.notes].flat().filter(Boolean).join(" ");
  const m = /gutenberg\.org\/(?:ebooks|etext|files|cache\/epub)\/(\d{1,6})/i.exec(String(text));
  return m ? Number(m[1]) : 0;
}

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
  const rawTitle = plain(first(meta.title), 200);
  const title = baseTitle(rawTitle) || rawTitle || "Audiobook";
  const chapters: BookChapter[] = sorted.slice(0, 400).map((f, i) => {
    const t = tidyChapter(String(f.title || String(f.name).replace(/\.mp3$/i, "")), title);
    return {
      n: i + 1, title: t.title || `Part ${i + 1}`, sub: t.sub, secs: lengthSecs(f.length), bytes: Math.max(0, Math.round(num(f.size))),
      audio: `${ARCHIVE}/download/${encodeURIComponent(id)}/${String(f.name).split("/").map(encodeURIComponent).join("/")}`,
    };
  });
  return {
    id, title, author: plain(first(meta.creator), 120), cover: coverOf(id),
    downloads: Math.round(num(meta.downloads)), rating: 0, reviews: 0, about: plain(meta.description, 1500),
    ...readerOf(rawTitle, String(first(meta.description) ?? "")), added: String(first(meta.addeddate) || "").slice(0, 10),
    chapters, secs: chapters.reduce((t, c) => t + c.secs, 0), link: `${ARCHIVE}/details/${encodeURIComponent(id)}`, gutenberg: gutenbergIdOf(meta),
  };
}

const cleanWords = (q: string) => q.replace(/[^\p{L}\p{N}' -]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80).toLowerCase();
const FIELDS = ["identifier", "title", "creator", "downloads", "avg_rating", "num_reviews", "description", "addeddate"];
function archiveSearch(query: string, sort: string, rows: number, page = 1): string {
  const p = new URLSearchParams({ q: query, rows: String(rows), page: String(Math.min(Math.max(1, page), 10)), output: "json" });
  for (const f of FIELDS) p.append("fl[]", f);
  p.append("sort[]", sort);
  return `${ARCHIVE}/advancedsearch.php?${p}`;
}

/** The Archive search for a shelf in an order, or for what someone typed. */
export function searchUrl(shelf: string, q: string, page: number, sort = "popular"): string {
  const words = cleanWords(q);
  const order = BOOK_SORTS[sort] ?? BOOK_SORTS.popular;
  let query = "collection:(librivoxaudio) AND mediatype:(audio)";
  if (words) query += ` AND (title:(${words}) OR creator:(${words}))`;
  else if (BOOK_SHELVES[shelf]?.words) query += ` AND (${BOOK_SHELVES[shelf].words})`;
  if (order.also) query += ` AND ${order.also}`;
  return archiveSearch(query, order.sort, 80, page);
}

/** Every LibriVox reading of one book (same title, same author). */
export function versionsUrl(title: string, author: string): string {
  const t = cleanWords(baseTitle(title)), a = cleanWords(author).split(" ").filter((w) => w.length > 2).slice(-1)[0] || "";
  return archiveSearch(`collection:(librivoxaudio) AND title:(${t})${a ? ` AND creator:(${a})` : ""}`, "downloads desc", 40);
}

/** Splits a Project Gutenberg plain text into its parts: what's between "*** START" and "*** END",
 *  cut at chapter-like headings. */
export function sectionsOf(raw: string): TextSection[] {
  let body = raw.replace(/\r\n?/g, "\n");
  const start = /\*{3}\s*START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i.exec(body);
  if (start) body = body.slice(start.index + start[0].length);
  const end = /\*{3}\s*END OF (THE|THIS) PROJECT GUTENBERG/i.exec(body);
  if (end) body = body.slice(0, end.index);
  body = body.slice(0, 2_000_000);
  const lines = body.split("\n");
  const head = /^\s{0,8}(chapter|book|part|stave|letter|section|canto|act|lecture|volume)\s+(\d{1,3}|[IVXLCDM]{1,8})\b[.:]?\s*.{0,80}$/i;
  const out: TextSection[] = [];
  let cur: TextSection = { heading: "Beginning", text: "" };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (head.test(l) && (i === 0 || !lines[i - 1].trim())) {
      if (cur.text.trim()) out.push(cur);
      cur = { heading: unshout(l.trim()), text: "" };
      // A title on the next line ("CHAPTER I." then "THE PERIOD") belongs to the heading.
      const next = (lines[i + 1] || "").trim();
      const after = (lines[i + 2] || "").trim();
      if (next && next.length < 70 && !/[,;!?"”]$/.test(next) && !after) { cur.heading += ` · ${unshout(next.replace(/\.$/, ""))}`; i++; }
      continue;
    }
    cur.text += l + "\n";
  }
  if (cur.text.trim()) out.push(cur);
  // Paragraphs: lines joined, blank lines kept as breaks.
  return out.slice(0, 600).map((s) => ({ heading: s.heading.slice(0, 120), text: s.text.replace(/[ \t]+\n/g, "\n").replace(/([^\n])\n(?=[^\n])/g, "$1 ").replace(/\n{3,}/g, "\n\n").trim() }));
}

const UA = "PodPlus/1.0 (audiobooks; arisereader.onrender.com)";
const defaultFetch: JsonFetcher = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`fetch ${r.status}`);
  return r.json();
};
const defaultText: TextFetcher = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`fetch ${r.status}`);
  return r.text();
};

/** An Archive download link for one LibriVox MP3, and nothing else, may go through /books/audio. */
export const isBookAudio = (u: string) => {
  try { const x = new URL(u); return x.protocol === "https:" && x.hostname === "archive.org" && /^\/download\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}\/[^?#]+\.mp3$/i.test(x.pathname); } catch { return false; }
};

const clientIp = (req: any) => { const f = String(req.headers["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean); return f[f.length - 1] || String(req.socket?.remoteAddress || ""); };

/** The bytes of one 10-minute piece of a chapter's MP3 (LibriVox MP3s are a steady bitrate, so
 *  time and bytes line up). Null past the end. */
export function pieceRange(c: Pick<BookChapter, "secs" | "bytes">, piece: number): { from: number; to: number; at: number } | null {
  const rate = c.secs > 0 && c.bytes > 0 ? c.bytes / c.secs : 8000; // 64 kbps
  const at = piece * TX_PIECE_SECS;
  if (piece < 0 || (c.secs && at >= c.secs)) return null;
  const from = Math.floor(at * rate), to = Math.floor((at + TX_PIECE_SECS) * rate) - 1;
  return { from, to: c.bytes ? Math.min(to, c.bytes - 1) : to, at };
}

/** Pod+ Membership: AI transcripts, Ask AI and Voice boost are for members (signed in with their
 *  email; the gate marks req.creator). Everything else in Audiobooks is free. */
const isMember = (req: any) => !!req.creator;
const membersOnly = (res: any, what: string) => res.status(402).json({ message: `${what} is part of Pod+ Membership.`, needSignIn: true, members: true });

/** Voice boost's audio relay can't be sent a session (an audio player sends no headers), so a member
 *  gets a signed pass for it, good for 12 hours. */
export function relayPass(key: Buffer, at: number): string {
  const exp = Math.floor(at / 1000) + 12 * 3600;
  return `${exp}.${createHmac("sha256", key).update(String(exp)).digest("base64url").slice(0, 32)}`;
}
export function relayPassOk(key: Buffer, pass: string, at: number): boolean {
  const [exp, sig] = String(pass || "").split(".");
  if (!/^\d{9,11}$/.test(exp || "") || !sig || Number(exp) * 1000 < at) return false;
  const want = Buffer.from(createHmac("sha256", key).update(exp).digest("base64url").slice(0, 32));
  const got = Buffer.from(sig);
  return got.length === want.length && timingSafeEqual(got, want);
}

export function registerAudiobookRoutes(app: Express, gate: RequestHandler, opts: { fetchJson?: JsonFetcher; fetchText?: TextFetcher; ask?: AskJson; transcribe?: Transcriber; minutesPerDay?: number; prefix?: string; now?: () => number; relayKey?: Buffer } = {}) {
  const prefix = opts.prefix ?? "/api/podscroll";
  const get = opts.fetchJson ?? defaultFetch;
  const getText = opts.fetchText ?? defaultText;
  const now = opts.now ?? Date.now;
  const cache = new Map<string, { at: number; ttl: number; value: unknown }>();
  const cached = async <T>(key: string, ttl: number, make: () => Promise<T>): Promise<T> => {
    const hit = cache.get(key);
    if (hit && now() - hit.at < hit.ttl) return hit.value as T;
    const value = await make();
    cache.set(key, { at: now(), ttl, value });
    if (cache.size > 800) { const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 150); for (const [k] of oldest) cache.delete(k); }
    return value;
  };
  const DAY = 24 * 3600_000;
  const relayKey = opts.relayKey ?? (process.env.SESSION_SECRET ? createHmac("sha256", process.env.SESSION_SECRET).update("pod+ book relay").digest() : randomBytes(32));
  const bookOf = (id: string) => cached(`book:${id}`, 7 * DAY, async () => bookFromMetadata(id, await get(`${ARCHIVE}/metadata/${encodeURIComponent(id)}`)));
  const down = (res: any, where: string, e: any, message: string) => { console.error(`[audiobooks] ${where}:`, e?.message || e); res.status(502).json({ message }); };

  // Voice boost: a chapter's audio relayed from the Archive, so the page may shape its sound.
  // Audio players can't send the device header, so this is limited by address instead.
  const audioIp = createAttemptLimiter({ max: 2000, windowMs: 10 * 60_000 });
  app.get(`${prefix}/books/audio`, async (req: any, res) => {
    const u = String(req.query.u || "");
    if (!isBookAudio(u)) return res.status(400).end();
    if (!relayPassOk(relayKey, String(req.query.k || ""), now())) return res.status(403).end();
    const ip = clientIp(req);
    if (audioIp.retryAfter(ip) > 0) return res.status(429).end();
    audioIp.fail(ip);
    try {
      const range = String(req.headers.range || "");
      const r = await fetch(u, { headers: { "User-Agent": UA, ...(range ? { Range: range } : {}) }, redirect: "follow", signal: AbortSignal.timeout(30_000) });
      if (!r.ok || !r.body) return res.status(r.status === 416 ? 416 : 502).end();
      res.status(r.status);
      for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"]) { const v = r.headers.get(h); if (v) res.setHeader(h, v); }
      res.setHeader("Cache-Control", "public, max-age=604800");
      const stream = Readable.fromWeb(r.body as any);
      req.on("close", () => stream.destroy());
      stream.on("error", () => res.end());
      stream.pipe(res);
    } catch { if (!res.headersSent) res.status(502).end(); else res.end(); }
  });

  app.get(`${prefix}/books/relay-pass`, gate, (req: any, res) => {
    if (!isMember(req)) return membersOnly(res, "Voice boost");
    res.set("Cache-Control", "no-store").json({ pass: relayPass(relayKey, now()) });
  });

  app.get(`${prefix}/books`, gate, async (req: any, res) => {
    const shelf = BOOK_SHELVES[String(req.query.shelf || "")] ? String(req.query.shelf) : "all";
    const sort = BOOK_SORTS[String(req.query.sort || "")] ? String(req.query.sort) : "popular";
    const q = String(req.query.q || "").slice(0, 80);
    const page = Math.floor(Number(req.query.page)) || 1;
    try {
      const books = await cached(`list:${shelf}:${sort}:${cleanWords(q)}:${page}`, sort === "new" || sort === "trending" ? 3 * 3600_000 : DAY, async () => booksFromSearch(await get(searchUrl(shelf, q, page, sort))));
      res.set("Cache-Control", "public, max-age=1800").json({
        books,
        shelves: Object.entries(BOOK_SHELVES).map(([id, s]) => ({ id, label: s.label })),
        sorts: Object.entries(BOOK_SORTS).map(([id, s]) => ({ id, label: s.label })),
      });
    } catch (e) { down(res, "list", e, "Audiobooks aren't loading right now. Try again in a moment."); }
  });

  app.get(`${prefix}/books/:id`, gate, async (req: any, res) => {
    const id = String(req.params.id || "");
    if (!BOOK_ID.test(id)) return res.status(404).json({ message: "That audiobook doesn't exist." });
    try {
      const book = await bookOf(id);
      if (!book) return res.status(404).json({ message: "That audiobook isn't available." });
      res.set("Cache-Control", "public, max-age=86400").json({ book });
    } catch (e) { down(res, "book", e, "This audiobook isn't loading right now. Try again in a moment."); }
  });

  // Other readings of the same book: one reader, a group, a full cast.
  app.get(`${prefix}/books/:id/versions`, gate, async (req: any, res) => {
    const id = String(req.params.id || "");
    if (!BOOK_ID.test(id)) return res.status(404).json({ message: "That audiobook doesn't exist." });
    try {
      const book = await bookOf(id);
      if (!book) return res.status(404).json({ message: "That audiobook isn't available." });
      const want = baseTitle(book.title).toLowerCase();
      const versions = await cached(`versions:${id}`, 3 * DAY, async () => {
        const list = booksFromSearch(await get(versionsUrl(book.title, book.author)), false).filter((b) => baseTitle(b.title).toLowerCase() === want);
        return list.some((b) => b.id === id) ? list : [{ ...book, chapters: undefined } as unknown as Book, ...list];
      });
      res.set("Cache-Control", "public, max-age=86400").json({ versions: versions.slice(0, 20) });
    } catch (e) { down(res, "versions", e, "Other readings aren't loading right now."); }
  });

  // Read along: the book's own text, cut into its chapters.
  app.get(`${prefix}/books/:id/text`, gate, async (req: any, res) => {
    const id = String(req.params.id || "");
    if (!BOOK_ID.test(id)) return res.status(404).json({ message: "That audiobook doesn't exist." });
    try {
      const book = await bookOf(id);
      if (!book) return res.status(404).json({ message: "That audiobook isn't available." });
      const out = await cached(`text:${id}`, 7 * DAY, async () => {
        let gid = book.gutenberg;
        if (!gid) {
          // Not linked from its page: look the book up by title and author.
          const g = await get(`https://gutendex.com/books/?search=${encodeURIComponent(`${baseTitle(book.title)} ${book.author.split(" ").slice(-1)[0] || ""}`.trim())}`).catch(() => null);
          const hit = (Array.isArray(g?.results) ? g.results : []).find((r: any) => baseTitle(String(r?.title || "")).toLowerCase().startsWith(baseTitle(book.title).toLowerCase().slice(0, 30)));
          gid = Number(hit?.id) || 0;
        }
        if (!gid) return null;
        const sections = sectionsOf(await getText(`https://www.gutenberg.org/cache/epub/${gid}/pg${gid}.txt`));
        return sections.length ? { sections, source: `https://www.gutenberg.org/ebooks/${gid}` } : null;
      });
      if (!out) return res.status(404).json({ message: "The text of this book isn't available to read along." });
      res.set("Cache-Control", "public, max-age=86400").json(out);
    } catch (e) { down(res, "text", e, "The book's text isn't loading right now. Try again in a moment."); }
  });

  // AI transcript of a chapter, 10 minutes at a time (for books whose text isn't available, or
  // when the reading wanders from the text). Kept once made; a daily cap keeps the cost in check.
  const txLimit = createAttemptLimiter({ max: 60, windowMs: 10 * 60_000 });
  let txDay = "", txMinutes = 0;
  const making = new Map<string, Promise<TxLine[]>>();
  app.get(`${prefix}/books/:id/transcript`, gate, async (req: any, res) => {
    const id = String(req.params.id || "");
    const ch = Math.floor(Number(req.query.ch)), piece = Math.floor(Number(req.query.piece)) || 0;
    if (!BOOK_ID.test(id) || !(ch >= 0)) return res.status(404).json({ message: "That chapter doesn't exist." });
    if (!isMember(req)) return membersOnly(res, "The AI transcript");
    if (!opts.transcribe) return res.status(503).json({ message: "Transcripts aren't available right now." });
    try {
      const book = await bookOf(id);
      const c = book?.chapters[ch];
      const range = c && pieceRange(c, piece);
      if (!c || !range) return res.status(404).json({ message: "That chapter doesn't exist." });
      const key = `tx:${id}:${ch}:${piece}`;
      const more = !!c.secs && range.at + TX_PIECE_SECS < c.secs;
      const hit = cache.get(key);
      if (hit) return res.json({ lines: hit.value, more });
      const who = String(req.user?.id || clientIp(req));
      const wait = txLimit.retryAfter(who);
      if (wait) return res.status(429).json({ message: `Too many transcripts at once. Try again in ${waitWords(wait)}.` });
      const today = new Date(now()).toISOString().slice(0, 10);
      if (today !== txDay) { txDay = today; txMinutes = 0; }
      if (txMinutes >= (opts.minutesPerDay ?? (Number(process.env.BOOK_AI_MINUTES_PER_DAY) || 600))) return res.status(503).json({ message: "Today's transcripts are used up. Try again tomorrow, or read the book's text." });
      let job = making.get(key);
      if (!job) {
        txLimit.fail(who);
        txMinutes += TX_PIECE_SECS / 60;
        job = (async () => {
          const r = await fetch(c.audio, { headers: { "User-Agent": UA, Range: `bytes=${range.from}-${range.to}` }, redirect: "follow", signal: AbortSignal.timeout(60_000) });
          if (!r.ok) throw new Error(`audio ${r.status}`);
          const blob = new Blob([await r.arrayBuffer()], { type: "audio/mpeg" });
          const out = await opts.transcribe!(blob, `${id}-${ch}-${piece}.mp3`, `${book!.title} by ${book!.author}. ${c.title}${c.sub ? `: ${c.sub}` : ""}.`);
          return out.segments.map((x) => ({ s: Math.round((range.at + x.start) * 10) / 10, e: Math.round((range.at + x.end) * 10) / 10, t: x.text.trim() })).filter((x) => x.t);
        })();
        making.set(key, job);
        job.finally(() => making.delete(key)).catch(() => {});
      }
      const lines = await job;
      cache.set(key, { at: now(), ttl: 30 * DAY, value: lines });
      res.json({ lines, more });
    } catch (e) { down(res, "transcript", e, "The transcript isn't ready right now. Try again in a moment."); }
  });

  // AI search: describe a book, get real LibriVox audiobooks back.
  const aiLimit = createAttemptLimiter({ max: 20, windowMs: 10 * 60_000 });
  app.post(`${prefix}/books/ai`, gate, async (req: any, res) => {
    const q = String(req.body?.q || "").replace(/\s+/g, " ").trim().slice(0, 300);
    if (!isMember(req)) return membersOnly(res, "Ask AI");
    if (q.length < 3) return res.status(400).json({ message: "Describe the kind of book you'd like." });
    if (!opts.ask) return res.status(503).json({ message: "AI search isn't available right now. Try the search box." });
    const who = String(req.user?.id || clientIp(req));
    const wait = aiLimit.retryAfter(who);
    if (wait) return res.status(429).json({ message: `That's a lot of AI searches. Try again in ${waitWords(wait)}.` });
    aiLimit.fail(who);
    try {
      const books = await cached(`ai:${q.toLowerCase()}`, DAY, async () => {
        const answer = await opts.ask!(
          "You recommend audiobooks from LibriVox, which only has public domain books (mostly published before 1930). Reply with JSON: {\"books\":[{\"title\":string,\"author\":string,\"why\":string}]}, 8 books, best match first. Only real books that LibriVox is likely to have. \"why\" is one short sentence (under 20 words) saying why it fits the request, written to the listener.",
          `What the listener wants: ${q}`,
        );
        const picks: Array<{ title: string; author: string; why: string }> = (Array.isArray(answer?.books) ? answer.books : [])
          .map((b: any) => ({ title: plain(b?.title, 120), author: plain(b?.author, 80), why: plain(b?.why, 160) }))
          .filter((b: { title: string }) => b.title).slice(0, 8);
        const found = await Promise.all(picks.map(async (p) => {
          const hit = booksFromSearch(await get(versionsUrl(p.title, p.author)).catch(() => null))[0];
          return hit ? { ...hit, why: p.why } : null;
        }));
        const seen = new Set<string>();
        return found.filter((b): b is Book & { why: string } => !!b && !seen.has(b.id) && !!seen.add(b.id));
      });
      res.json({ books });
    } catch (e) { down(res, "ai", e, "AI search isn't working right now. Try the search box."); }
  });

}
