// Pod+ "Bring your shows" (server/podcastImport.ts, podscroll/Import.tsx): reading another app's list
// of shows, and telling whether a directory result is the same show.

export type ImportItem = { title?: string; feed?: string; appleId?: string; spotify?: string };

const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;|&#39;|&#x27;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");
const attr = (tag: string, name: string) => { const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i")); return m ? decode(m[2] ?? m[3] ?? "").trim() : ""; };
const cleanTitle = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 200);
const httpUrl = (s: string) => { try { const u = new URL(s.trim()); return u.protocol === "http:" || u.protocol === "https:" ? u.href : ""; } catch { return ""; } };

/** One show from a pasted line, a link, or the app's own request (made safe). */
export function importItem(raw: any): ImportItem | null {
  if (!raw || typeof raw !== "object") return null;
  const appleId = /^\d{4,12}$/.test(String(raw.appleId || "")) ? String(raw.appleId) : "";
  const feed = httpUrl(String(raw.feed || "")).slice(0, 600);
  const spotify = /^https:\/\/open\.spotify\.com\/show\/[A-Za-z0-9]{10,40}/.test(String(raw.spotify || "")) ? String(raw.spotify).split("?")[0] : "";
  const title = cleanTitle(String(raw.title || ""));
  if (!appleId && !feed && !spotify && title.length < 2) return null;
  return { ...(title ? { title } : {}), ...(feed ? { feed } : {}), ...(appleId ? { appleId } : {}), ...(spotify ? { spotify } : {}) };
}

/** Every show in an OPML file (the export of most podcast apps). */
export function parseOpml(text: string): ImportItem[] {
  const out: ImportItem[] = [];
  for (const m of String(text || "").matchAll(/<outline\b[^>]*>/gi)) {
    const tag = m[0];
    const feed = httpUrl(attr(tag, "xmlUrl"));
    if (!feed) continue; // a folder, not a show
    const title = cleanTitle(attr(tag, "text") || attr(tag, "title"));
    out.push({ feed, ...(title ? { title } : {}) });
  }
  return dedupe(out);
}

/** Pasted text: one show per line, as a name, an Apple Podcasts or Spotify link, or a feed address. */
export function parseLines(text: string): ImportItem[] {
  if (/<opml\b/i.test(text)) return parseOpml(text);
  const out: ImportItem[] = [];
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.replace(/^[\s\-•*·\d.)]+(?=\S)/, "").trim();
    if (line.length < 2) continue;
    const url = line.match(/https?:\/\/\S+/)?.[0] || "";
    const apple = url.match(/podcasts\.apple\.com\/.*\bid(\d{4,12})/)?.[1] || url.match(/[?&]id=(\d{4,12})/)?.[1];
    if (apple) { out.push({ appleId: apple }); continue; }
    if (/open\.spotify\.com\/show\//.test(url)) { out.push({ spotify: url.split("?")[0] }); continue; }
    if (url) { const feed = httpUrl(url); if (feed) { out.push({ feed }); continue; } }
    out.push({ title: cleanTitle(line) });
  }
  return dedupe(out);
}

function dedupe(list: ImportItem[]): ImportItem[] {
  const seen = new Set<string>();
  return list.filter((i) => { const k = (i.appleId || i.spotify || (i.feed ? normFeed(i.feed) : "") || (i.title || "").toLowerCase()); if (!k || seen.has(k)) return false; seen.add(k); return true; }).slice(0, 500);
}

const normFeed = (u: string) => u.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
export const sameFeed = (a: string, b: string) => normFeed(a) === normFeed(b);

const words = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ").replace(/\b(the|a|an|podcast|show|with)\b/g, " ").split(/\s+/).filter(Boolean);
/** The search result that is the same show: the same name (small differences allowed), else none. */
export function showMatch<T extends { name: string }>(title: string, shows: T[]): T | null {
  const want = words(title);
  if (!want.length) return null;
  const key = want.join(" ");
  const exact = shows.find((s) => words(s.name).join(" ") === key);
  if (exact) return exact;
  let best: T | null = null, score = 0;
  for (const s of shows.slice(0, 10)) {
    const have = words(s.name);
    if (!have.length) continue;
    const shared = want.filter((w) => have.includes(w)).length;
    const j = shared / new Set([...want, ...have]).size;
    const contains = have.join(" ").includes(key) || key.includes(have.join(" "));
    const sc = contains ? Math.max(j, 0.75) : j;
    if (sc > score) { score = sc; best = s; }
  }
  return score >= 0.6 ? best : null;
}
