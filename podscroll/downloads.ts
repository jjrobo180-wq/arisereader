// Pod+ downloads (Pod+ Membership): podcast episodes and whole audiobooks saved on this device, so
// they play with no connection. Works the same on the website, the home-screen app and the iPhone
// app (all keep the audio in IndexedDB; the iPhone app's storage isn't cleared by Safari's rules).
//
// Audio is fetched straight from its host when the host allows it, else through the Pod+ server
// (/api/podscroll/download for podcasts, /books/audio for LibriVox), both with a member's pass.
// The player plays a saved copy instead of the stream (client/.../earshot/offlineAudio.ts).
import { chapterKey, episodeKey, notifyOffline, setOfflineAudio, type DownloadState, type DownloadedEpisode, type OfflineAudio } from "../client/src/components/family-hub/earshot/offlineAudio";
import type { SavedEpisode } from "@shared/earshot";
import type { BookDetail } from "./Audiobooks";

type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
export type DownloadedBook = { kind: "book"; id: string; book: BookDetail; bytes: number; savedAt: number; chapters: number };
type Item = DownloadedEpisode | DownloadedBook;

const DB = "podplus-downloads";
const FILES = "files";
const ITEMS = "items";

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore(FILES); r.result.createObjectStore(ITEMS); };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error("Downloads aren't available in this browser."));
    });
    dbp.catch(() => { dbp = null; });
  }
  return dbp;
}
const tx = async <T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> => {
  const d = await db();
  return new Promise<T>((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? (req.result as T) : (undefined as T));
    t.onerror = () => reject(t.error || new Error("Couldn't save on this device."));
    t.onabort = () => reject(t.error || new Error("This device is out of space for downloads."));
  });
};

const urls = new Map<string, string>();      // key → blob: URL of a saved copy
const items = new Map<string, Item>();        // item id → what was saved
const states = new Map<string, DownloadState>();
const NONE: DownloadState = { status: "none", pct: 0 };

const setState = (key: string, s: DownloadState | null) => { if (s) states.set(key, s); else states.delete(key); notifyOffline(); };
const keep = (key: string, blob: Blob) => { const old = urls.get(key); if (old) URL.revokeObjectURL(old); urls.set(key, URL.createObjectURL(blob)); };

/** Loads what was saved before (blob handles only; the audio stays on disk until it plays). */
async function load() {
  try {
    const [keys, blobs, saved] = await Promise.all([
      tx<IDBValidKey[]>(FILES, "readonly", (s) => s.getAllKeys()),
      tx<Blob[]>(FILES, "readonly", (s) => s.getAll()),
      tx<Item[]>(ITEMS, "readonly", (s) => s.getAll()),
    ]);
    keys.forEach((k, i) => { if (blobs[i]) keep(String(k), blobs[i]); });
    for (const it of saved) items.set(it.id, it);
    notifyOffline();
  } catch { /* private window or no IndexedDB: downloads just aren't offered to work */ }
}

/** Fetches one audio file, reporting progress; straight from the host, else through the relay. */
async function fetchAudio(direct: string, relay: () => Promise<string>, onPct: (p: number) => void, signal: AbortSignal): Promise<Blob> {
  let res: Response | null = null;
  try {
    const r = await fetch(direct, { mode: "cors", credentials: "omit", signal });
    if (r.ok && r.type !== "opaque") res = r;
  } catch (e: any) { if (e?.name === "AbortError") throw e; }
  if (!res) {
    const r = await fetch(await relay(), { credentials: "omit", signal });
    if (!r.ok) { const b = await r.json().catch(() => null); throw Object.assign(new Error(b?.message || "Couldn't download that. Try again."), { status: r.status }); }
    res = r;
  }
  const total = Number(res.headers.get("content-length") || 0);
  const type = res.headers.get("content-type") || "audio/mpeg";
  if (!res.body) { const b = await res.blob(); onPct(1); return b; }
  const reader = res.body.getReader();
  const parts: BlobPart[] = []; let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); got += value.length;
    if (total) onPct(Math.min(0.99, got / total));
  }
  onPct(1);
  return new Blob(parts, { type: /^(audio|video)\//.test(type) ? type : "audio/mpeg" });
}

export function installDownloads(opts: { api: Api; apiBase: string; isMember: () => boolean; onJoin: (why: string) => void; say: (m: string) => void }) {
  const running = new Map<string, AbortController>();
  let pass: { k: string; exp: number } | null = null;
  const getPass = async () => {
    if (pass && pass.exp > Date.now() + 5 * 60_000) return pass.k;
    const b = await opts.api("/api/earshot/books/relay-pass");
    pass = { k: String(b.pass), exp: Number(String(b.pass).split(".")[0]) * 1000 };
    return pass.k;
  };
  const member = (what: string) => {
    if (opts.isMember()) return true;
    opts.say(`Downloading ${what} is part of Pod+ Membership.`);
    opts.onJoin("downloads");
    return false;
  };
  const askToKeep = () => { try { void navigator.storage?.persist?.(); } catch { /* not supported */ } };
  const saveItem = (it: Item) => tx(ITEMS, "readwrite", (s) => s.put(it, it.id)).then(() => { items.set(it.id, it); notifyOffline(); });
  const saveFile = async (key: string, blob: Blob) => { await tx(FILES, "readwrite", (s) => s.put(blob, key)); keep(key, blob); };
  const dropFile = async (key: string) => { await tx(FILES, "readwrite", (s) => s.delete(key)).catch(() => {}); const u = urls.get(key); if (u) URL.revokeObjectURL(u); urls.delete(key); };
  const fail = (key: string, e: any) => {
    if (e?.name === "AbortError") { setState(key, null); return; }
    const msg = e?.name === "QuotaExceededError" ? "This device is out of space for downloads." : e?.status === 402 || e?.status === 403 ? "Downloads are part of Pod+ Membership. Sign in again." : e?.message || "Couldn't download that. Try again.";
    setState(key, { status: "error", pct: 0, error: msg });
    opts.say(msg);
  };

  const saveEpisode = async (ep: SavedEpisode) => {
    const key = episodeKey(ep.id);
    if (!ep.audio || running.has(key) || urls.has(key)) return;
    if (!member("episodes")) return;
    askToKeep();
    const stop = new AbortController(); running.set(key, stop);
    setState(key, { status: "saving", pct: 0 });
    try {
      const blob = await fetchAudio(ep.audio, async () => `${opts.apiBase}/api/podscroll/download?u=${encodeURIComponent(ep.audio!)}&k=${encodeURIComponent(await getPass())}`, (pct) => setState(key, { status: "saving", pct }), stop.signal);
      await saveFile(key, blob);
      await saveItem({ kind: "episode", id: key, ep, bytes: blob.size, savedAt: Date.now() });
      setState(key, null);
      opts.say("Downloaded. It plays without a connection, in Library → Downloads.");
    } catch (e) { await dropFile(key); fail(key, e); }
    finally { running.delete(key); }
  };

  const bookId = (id: string) => `book:${id}`;
  /** A whole audiobook, chapter by chapter (a chapter already saved isn't fetched again). */
  const saveBook = async (book: BookDetail) => {
    const id = bookId(book.id);
    if (running.has(id)) return;
    if (!member("audiobooks")) return;
    askToKeep();
    const stop = new AbortController(); running.set(id, stop);
    const n = book.chapters.length;
    let bytes = 0;
    setState(id, { status: "saving", pct: 0 });
    try {
      for (let i = 0; i < n; i++) {
        const c = book.chapters[i], key = chapterKey(book.id, c.n);
        if (urls.has(key)) continue;
        const blob = await fetchAudio(c.audio, async () => `${opts.apiBase}/api/podscroll/books/audio?u=${encodeURIComponent(c.audio)}&k=${encodeURIComponent(await getPass())}`,
          (p) => setState(id, { status: "saving", pct: (i + p) / n }), stop.signal);
        await saveFile(key, blob);
        bytes += blob.size;
      }
      await saveItem({ kind: "book", id, book, bytes: bytes + ((items.get(id) as DownloadedBook | undefined)?.bytes || 0), savedAt: Date.now(), chapters: n });
      setState(id, null);
      opts.say(`“${book.title}” is downloaded. It plays without a connection.`);
    } catch (e) { fail(id, e); }
    finally { running.delete(id); }
  };

  const remove = async (id: string) => {
    running.get(id)?.abort();
    const it = items.get(id);
    if (it?.kind === "book") await Promise.all(it.book.chapters.map((c) => dropFile(chapterKey(it.book.id, c.n))));
    else if (id.startsWith("book:")) { /* a book that was still downloading: drop what arrived */
      const b = id.slice(5);
      await Promise.all([...urls.keys()].filter((k) => k.startsWith(`book:${b}:`)).map(dropFile));
    } else await dropFile(id);
    await tx(ITEMS, "readwrite", (s) => s.delete(id)).catch(() => {});
    items.delete(id); setState(id, null);
  };

  const state = (key: string): DownloadState => states.get(key) || (items.has(key) || urls.has(key) ? { status: "saved", pct: 1 } : NONE);
  const api: OfflineAudio & {
    saveBook: (b: BookDetail) => Promise<void>;
    books: () => DownloadedBook[];
    bookState: (id: string) => DownloadState;
    savedBook: (id: string) => BookDetail | null;
  } = {
    url: (key) => urls.get(key) || null,
    state,
    saveEpisode,
    remove,
    episodes: () => [...items.values()].filter((x): x is DownloadedEpisode => x.kind === "episode").sort((a, b) => b.savedAt - a.savedAt),
    saveBook,
    books: () => [...items.values()].filter((x): x is DownloadedBook => x.kind === "book").sort((a, b) => b.savedAt - a.savedAt),
    bookState: (id) => state(bookId(id)),
    savedBook: (id) => { const it = items.get(bookId(id)); return it?.kind === "book" ? it.book : null; },
  };
  downloads = api;
  setOfflineAudio(api);
  void load();
  return api;
}

export type Downloads = ReturnType<typeof installDownloads>;
/** The Pod+ downloader once installed (main.tsx), for the audiobook pages. */
export let downloads: Downloads | null = null;
export const bookDownloadId = (id: string) => `book:${id}`;
export const sizeLabel = (bytes: number) => bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`;
