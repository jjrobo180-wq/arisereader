// Pod+ Social: the small rules both the server and the app follow. Hashtags and mentions in a post,
// photos and videos (only files people uploaded to our storage), polls, the For You order, and the
// two people in a conversation. Pure functions, so they're tested on their own.

export type Media = { type: "image" | "video"; url: string; w?: number; h?: number; alt?: string; poster?: string };
export type PollData = { options: string[]; ends: string };
export type PollView = { options: { text: string; votes: number }[]; total: number; mine: number | null; ends: string; closed: boolean };

/** #tags in a post (lowercase, no #), at most 10. */
export function hashtags(text: string): string[] {
  const out: string[] = [];
  for (const m of String(text || "").matchAll(/(^|[^\w&])#([a-zA-Z0-9_]{2,30})\b/g)) { const t = m[2].toLowerCase(); if (!/^\d+$/.test(t) && !out.includes(t)) out.push(t); }
  return out.slice(0, 10);
}
/** @handles in a post or comment, at most 10. */
export function mentions(text: string): string[] {
  const out: string[] = [];
  for (const m of String(text || "").matchAll(/(^|[^\w@])@([a-zA-Z0-9_]{3,20})\b/g)) { const h = m[2].toLowerCase(); if (!out.includes(h)) out.push(h); }
  return out.slice(0, 10);
}

/** Photos (up to 4) or one video, only from our own storage and the poster's own folder. */
export function cleanMedia(raw: unknown, publicPrefix: string, folder: string): Media[] {
  if (!Array.isArray(raw) || !publicPrefix) return [];
  const mine = `${publicPrefix}${folder}/`;
  const list: Media[] = [];
  for (const r of raw.slice(0, 4) as any[]) {
    const type = r?.type === "video" ? "video" : r?.type === "image" ? "image" : null;
    const url = typeof r?.url === "string" ? r.url.trim() : "";
    if (!type || !url.startsWith(mine) || url.length > 600 || /["'<>\s]/.test(url)) continue;
    const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
    if (type === "image" && !["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) continue;
    if (type === "video" && !["mp4", "webm", "mov"].includes(ext)) continue;
    const m: Media = { type, url };
    const w = Math.round(Number(r.w)), h = Math.round(Number(r.h));
    if (w > 0 && w < 20000 && h > 0 && h < 20000) { m.w = w; m.h = h; }
    if (typeof r.alt === "string" && r.alt.trim()) m.alt = r.alt.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 200);
    list.push(m);
  }
  // One video on its own, or up to four photos.
  const video = list.find((m) => m.type === "video");
  return video ? [video] : list.filter((m) => m.type === "image").slice(0, 4);
}

/** A poll: 2 to 4 choices of up to 40 characters, open 1 to 7 days. */
export function cleanPoll(raw: unknown, now = Date.now()): PollData | null {
  const r = raw && typeof raw === "object" ? (raw as any) : null;
  if (!r || !Array.isArray(r.options)) return null;
  const options = r.options.map((o: unknown) => (typeof o === "string" ? o.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 40) : "")).filter(Boolean).slice(0, 4);
  if (options.length < 2 || new Set(options.map((o: string) => o.toLowerCase())).size !== options.length) return null;
  const days = Math.min(7, Math.max(1, Math.round(Number(r.days) || 1)));
  return { options, ends: new Date(now + days * 86_400_000).toISOString() };
}
/** What everyone sees of a poll: the counts, and which choice the viewer made. */
export function pollView(poll: PollData | null, votes: { choice: number; voter: string }[], viewer: string, now = Date.now()): PollView | null {
  if (!poll || !Array.isArray(poll.options) || poll.options.length < 2) return null;
  const counts = poll.options.map((_, i) => votes.filter((v) => v.choice === i).length);
  const mine = votes.find((v) => v.voter === viewer);
  return { options: poll.options.map((text, i) => ({ text, votes: counts[i] })), total: counts.reduce((a, b) => a + b, 0), mine: mine ? mine.choice : null, ends: poll.ends, closed: Date.parse(poll.ends) <= now };
}

/** For You: liked, talked-about and shared posts first, newer before older, people you follow and photos/videos a little ahead. */
export function forYouScore(p: { likes: number; comments: number; reposts: number; at: string; followed?: boolean; media?: boolean; mine?: boolean }, now = Date.now()): number {
  const hours = Math.max(0, (now - Date.parse(p.at)) / 3_600_000) || 0;
  const base = (1 + p.likes * 2 + p.comments * 3 + p.reposts * 4) / Math.pow(hours + 2, 1.35);
  return base * (p.followed ? 1.6 : 1) * (p.media ? 1.25 : 1) * (p.mine ? 0.8 : 1);
}

/** The two people in a conversation, in order (so a pair only ever has one). */
export const pairOf = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);

/** A website for a profile: http(s) only, shown without the scheme. */
export function cleanWebsite(v: unknown): string {
  const s = typeof v === "string" ? v.trim().slice(0, 200) : "";
  if (!s) return "";
  try { const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); return /^https?:$/.test(u.protocol) && u.hostname.includes(".") && !/["'<>\s]/.test(s) ? u.toString() : ""; } catch { return ""; }
}
/** A story's background: a #rrggbb color. */
export const cleanColor = (v: unknown, fallback = "#7c3aed") => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : fallback);

/** "3m", "5h", "2d", or a date. */
export function shortAgo(iso: string, now = Date.now()): string {
  const d = (now - Date.parse(iso)) / 1000;
  if (!Number.isFinite(d)) return "";
  if (d < 60) return "now";
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  if (d < 86400 * 7) return `${Math.floor(d / 86400)}d`;
  const dt = new Date(iso);
  return dt.toLocaleDateString(undefined, dt.getFullYear() === new Date(now).getFullYear() ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}
/** 1.2K, 3.4M. */
export const compactCount = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K` : String(n));
