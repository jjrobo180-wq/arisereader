// Pod+ Music: free, legal music from the Internet Archive. Only recordings the Archive marks as
// public domain (the Public Domain Mark or CC0) are ever listed or played, so anyone may play them
// on the site: the music (Beethoven, Mozart, Bach...) and the recording itself are both free.
// The server asks the Archive and keeps answers a while; audio plays straight from the Archive.
import type { Express, RequestHandler } from "express";
import type { KV } from "./podcastDirectory";

export type Album = { id: string; title: string; artist: string; cover: string; plays: number };
export type Track = { n: number; title: string; secs: number; audio: string };
export type AlbumDetail = Album & { tracks: Track[]; about: string; license: string; link: string };
type JsonFetcher = (url: string) => Promise<any>;

const ARCHIVE = "https://archive.org";
export const ALBUM_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const DAY = 86_400_000;
const UA = "PodPlus/1.0 (music; arisereader.onrender.com)";

/** Only these licenses: the music and the recording are free for anyone to play. */
export const isFreeLicense = (u: unknown) => /creativecommons\.org\/publicdomain\/(mark|zero)\//i.test(String(u || ""));

export const MUSIC_SHELVES: Record<string, { label: string; words?: string }> = {
  all: { label: "All" },
  beethoven: { label: "Beethoven", words: "beethoven" },
  mozart: { label: "Mozart", words: "mozart" },
  bach: { label: "Bach", words: "bach" },
  chopin: { label: "Chopin", words: "chopin" },
  piano: { label: "Piano", words: "piano" },
  orchestra: { label: "Orchestra", words: "symphony OR orchestra OR concerto" },
  violin: { label: "Strings", words: "violin OR cello OR string quartet" },
  opera: { label: "Opera & voice", words: "opera OR aria OR choir" },
  jazz: { label: "Jazz", words: "jazz OR ragtime OR swing" },
  blues: { label: "Blues & folk", words: "blues OR folk" },
  calm: { label: "Calm", words: "ambient OR relaxing OR meditation OR nocturne" },
};

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const plain = (s: unknown, max: number) => String(Array.isArray(s) ? s.join(" ") : s ?? "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim().slice(0, max);
const cleanWords = (q: string) => q.replace(/[^\p{L}\p{N}' -]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80).toLowerCase();
const secsOf = (v: unknown) => {
  const s = String(v ?? "").trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s));
  const p = s.split(":").map(Number);
  return p.length >= 2 && p.length <= 3 && p.every(Number.isFinite) ? Math.round(p.reduce((t, n) => t * 60 + n, 0)) : 0;
};
const coverOf = (id: string) => `${ARCHIVE}/services/img/${encodeURIComponent(id)}`;

/** The Archive search: public domain music only (no audiobooks or talk). */
export function musicSearchUrl(shelf: string, q: string, page = 1): string {
  const words = cleanWords(q);
  let query = "mediatype:(audio) AND licenseurl:(*publicdomain*) AND -collection:(librivoxaudio) AND -collection:(podcasts) AND -collection:(radioprograms)"
    + " AND (subject:(music OR classical OR symphony OR sonata OR piano OR concerto OR jazz OR blues OR folk OR opera) OR collection:(audio_music OR netlabels OR musopen OR opensource_audio))";
  if (words) query += ` AND (title:(${words}) OR creator:(${words}) OR subject:(${words}))`;
  else if (MUSIC_SHELVES[shelf]?.words) query += ` AND (${MUSIC_SHELVES[shelf].words})`;
  const p = new URLSearchParams({ q: query, rows: "60", page: String(Math.min(Math.max(1, page), 10)), output: "json" });
  for (const f of ["identifier", "title", "creator", "downloads", "licenseurl"]) p.append("fl[]", f);
  p.append("sort[]", "downloads desc");
  return `${ARCHIVE}/advancedsearch.php?${p}`;
}

export function albumsFromSearch(body: any): Album[] {
  const docs: any[] = Array.isArray(body?.response?.docs) ? body.response.docs : [];
  return docs.filter((d) => isFreeLicense(first(d?.licenseurl)) && ALBUM_ID.test(String(first(d?.identifier) || "")) && plain(first(d?.title), 200))
    .map((d) => {
      const id = String(first(d.identifier));
      return { id, title: plain(first(d.title), 200), artist: plain(first(d.creator), 120) || "Unknown artist", cover: coverOf(id), plays: Math.max(0, Math.round(Number(first(d.downloads)) || 0)) };
    });
}

/** One album's tracks (MP3s, in order). Null unless the Archive marks it public domain. */
export function albumFromMetadata(id: string, body: any): AlbumDetail | null {
  const meta = body?.metadata || {};
  const license = String(first(meta.licenseurl) || "");
  if (!isFreeLicense(license)) return null;
  const files: any[] = Array.isArray(body?.files) ? body.files : [];
  const mp3 = files.filter((f) => /\.mp3$/i.test(String(f?.name || "")) && /mp3/i.test(String(f?.format || "")) && !/sample|_spectrogram/i.test(String(f?.name || "")));
  const pick = ["VBR MP3", "128Kbps MP3", "64Kbps MP3"].map((fmt) => mp3.filter((f) => String(f.format) === fmt)).find((l) => l.length) ?? mp3;
  if (!pick.length) return null;
  const sorted = [...pick].sort((a, b) => {
    const ta = parseInt(String(a.track || ""), 10), tb = parseInt(String(b.track || ""), 10);
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
    return String(a.name).localeCompare(String(b.name), undefined, { numeric: true });
  });
  const tracks: Track[] = sorted.slice(0, 200).map((f, i) => ({
    n: i + 1,
    title: plain(f.title, 160) || String(f.name).split("/").pop()!.replace(/\.mp3$/i, "").replace(/[_]+/g, " ").trim(),
    secs: secsOf(f.length),
    audio: `${ARCHIVE}/download/${encodeURIComponent(id)}/${String(f.name).split("/").map(encodeURIComponent).join("/")}`,
  }));
  return {
    id, title: plain(first(meta.title), 200) || "Untitled", artist: plain(first(meta.creator), 120) || "Unknown artist", cover: coverOf(id),
    plays: Math.round(Number(first(meta.downloads)) || 0), about: plain(meta.description, 800), license, link: `${ARCHIVE}/details/${encodeURIComponent(id)}`, tracks,
  };
}

export function registerMusicRoutes(app: Express, gate: RequestHandler, opts: { fetchJson?: JsonFetcher; kv?: KV; prefix?: string; now?: () => number } = {}) {
  const prefix = opts.prefix ?? "/api/podscroll";
  const now = opts.now ?? Date.now;
  const get: JsonFetcher = opts.fetchJson ?? (async (url) => {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`fetch ${r.status}`);
    return r.json();
  });
  const mem = new Map<string, { at: number; value: unknown }>();
  const cached = async <T>(key: string, ttl: number, make: () => Promise<T>): Promise<T> => {
    const hit = mem.get(key);
    if (hit && now() - hit.at < ttl) return hit.value as T;
    const d = opts.kv ? await opts.kv.get(`mu:${key}`).catch(() => null) : null;
    if (d && d.value != null && now() - d.at < ttl) { mem.set(key, { at: d.at, value: d.value }); return d.value as T; }
    const value = await make();
    mem.set(key, { at: now(), value });
    if (mem.size > 300) mem.delete(mem.keys().next().value as string);
    if (value != null && opts.kv) void opts.kv.set(`mu:${key}`, value).catch(() => {});
    return value;
  };

  app.get(`${prefix}/music`, gate, async (req: any, res) => {
    const shelf = MUSIC_SHELVES[String(req.query.shelf || "")] ? String(req.query.shelf) : "all";
    const q = String(req.query.q || "").slice(0, 80);
    const page = Math.floor(Number(req.query.page)) || 1;
    try {
      const albums = await cached(`list:${shelf}:${cleanWords(q)}:${page}`, DAY, async () => albumsFromSearch(await get(musicSearchUrl(shelf, q, page))));
      res.set("Cache-Control", "public, max-age=1800").json({ albums, shelves: Object.entries(MUSIC_SHELVES).map(([id, s]) => ({ id, label: s.label })) });
    } catch (e: any) {
      console.warn("[music] list", e?.message);
      res.status(502).json({ message: "Music isn't loading right now. Try again in a moment." });
    }
  });

  app.get(`${prefix}/music/:id`, gate, async (req: any, res) => {
    const id = String(req.params.id || "");
    if (!ALBUM_ID.test(id)) return res.status(404).json({ message: "That album doesn't exist." });
    try {
      const album = await cached(`album:${id}`, 7 * DAY, async () => albumFromMetadata(id, await get(`${ARCHIVE}/metadata/${encodeURIComponent(id)}`)));
      if (!album) return res.status(404).json({ message: "That album isn't available." });
      res.set("Cache-Control", "public, max-age=86400").json({ album });
    } catch (e: any) {
      console.warn("[music] album", e?.message);
      res.status(502).json({ message: "This album isn't loading right now. Try again in a moment." });
    }
  });
}
