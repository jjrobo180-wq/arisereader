// What people post on Pod+ Social and Earshot Social (posts, comments, replies, messages, stories,
// profiles, guestbooks) is checked before anyone else sees it, as Apple's rules for apps with
// user content ask (App Review Guideline 1.2: filter objectionable material, let people report it
// and block abusive users, and act on reports).
//
// - Words: a built-in list of slurs, sexual terms and threats is always checked (no key needed),
//   and when OPENAI_API_KEY is set, OpenAI's moderation model checks the words too.
// - Photos: OpenAI's moderation model looks at each picture; anything sexual, graphically violent
//   or about self-harm is refused. Without a key (or if the check can't run), pictures go up and
//   the report button (hidden after 3 reports) is the safety net.
// - Reports: every report is passed to the listener set by the server (an admin alert by email and
//   in the bell), so it can be looked at within 24 hours.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Express } from "express";

type Verdict = { ok: true } | { ok: false; reason: string };
const BLOCK = ["sexual", "sexual/minors", "violence/graphic", "self-harm", "self-harm/intent", "self-harm/instructions"];
const TEXT_BLOCK = ["sexual/minors", "hate/threatening", "harassment/threatening", "self-harm/instructions", "violence/graphic", "sexual"];

// Spelled-around versions ("f*ck", "n1gg3r", "s.h.i.t") are read as the word they stand for.
const LEET: Record<string, string> = { "0": "o", "1": "i", "!": "i", "3": "e", "4": "a", "@": "a", "5": "s", "$": "s", "7": "t", "8": "b", "9": "g", "+": "t" };
export function normalizeForFilter(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[01!34@5$78+9]/g, (c) => LEET[c] || c)
    // "s.h.i.t" and "s h i t": single letters split by dots, dashes, stars or spaces join back up.
    .replace(/\b(?:[a-z][\s.*_-]){2,}[a-z]\b/g, (m) => m.replace(/[\s.*_-]/g, ""))
    .replace(/[*_]/g, "")
    .replace(/(.)\1{2,}/g, "$1$1");
}

// Slurs, explicit sexual words and threats. Whole words only, so "class", "Scunthorpe" or
// "assessment" never trip it. Ordinary swearing is left to the report button.
const BANNED = [
  "nigger", "niggers", "nigga", "niggas", "faggot", "faggots", "fag", "fags", "kike", "kikes", "spic", "spics", "chink", "chinks",
  "wetback", "wetbacks", "tranny", "trannies", "retard", "retards", "gook", "gooks", "coon", "coons", "raghead", "towelhead", "beaner", "beaners",
  "dyke", "dykes", "paki", "pakis", "sandnigger", "porn", "porno", "pornhub", "xvideos", "onlyfans", "nudes", "send nudes", "blowjob", "blowjobs",
  "handjob", "cumshot", "jizz", "dildo", "pussy", "cock", "cocks", "dick pic", "dickpic",
  "pedo", "pedophile", "paedophile", "child porn", "loli", "kys", "kill yourself", "kill urself", "go die", "hang yourself",
  "i will kill you", "im going to kill you", "i'm going to kill you", "shoot up the school", "heil hitler", "white power", "1488",
];
const BANNED_RE = new RegExp(`(^|[^a-z])(${BANNED.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")).join("|")})(?=$|[^a-z])`, "i");

/** The built-in word check. Returns why it can't be posted, or null when it's fine. */
export function textProblem(text: string): string | null {
  if (!text || !text.trim()) return null;
  const plain = normalizeForFilter(text);
  if (BANNED_RE.test(plain) || BANNED_RE.test(text.toLowerCase())) return "it has words that aren't allowed on Pod+";
  return null;
}

/** Words checked by the built-in list, then by OpenAI's moderation model when there's a key. */
export async function moderateText(text: string, fetcher: typeof fetch = fetch): Promise<Verdict> {
  const local = textProblem(text);
  if (local) return { ok: false, reason: local };
  const key = process.env.OPENAI_API_KEY;
  if (!key || key === "routed-to-grok" || !text.trim()) return { ok: true };
  try {
    const res = await fetcher("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text.slice(0, 4000) }),
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return { ok: true };
    const body = (await res.json()) as any;
    for (const r of Array.isArray(body?.results) ? body.results : []) {
      const hit = TEXT_BLOCK.find((c) => r?.categories?.[c]);
      if (hit) return { ok: false, reason: hit.startsWith("sexual") ? "sexual content" : hit.startsWith("self-harm") ? "self-harm" : hit.startsWith("violence") ? "graphic violence" : "threats or hate" };
    }
    return { ok: true };
  } catch { return { ok: true }; }
}

/** The message people see when what they wrote is refused. */
export const refusedWords = (reason: string) => `That can't be posted (${reason}). Pod+ has zero tolerance for hate, harassment, threats and sexual content.`;

export async function moderateImages(urls: string[], text = "", fetcher: typeof fetch = fetch): Promise<Verdict> {
  if (text) { const t = textProblem(text); if (t) return { ok: false, reason: t }; }
  const key = process.env.OPENAI_API_KEY;
  const pics = urls.filter((u) => /^https:\/\//.test(u) && !/\.(mp4|webm|mov)(\?|$)/i.test(u)).slice(0, 4);
  if (!key || key === "routed-to-grok" || (!pics.length && !text.trim())) return { ok: true };
  try {
    const input = [...(text.trim() ? [{ type: "text", text: text.slice(0, 2000) }] : []), ...pics.map((url) => ({ type: "image_url", image_url: { url } }))];
    const res = await fetcher("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "omni-moderation-latest", input }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { ok: true };
    const body = (await res.json()) as any;
    for (const r of Array.isArray(body?.results) ? body.results : []) {
      const hit = BLOCK.find((c) => r?.categories?.[c]);
      if (hit) return { ok: false, reason: hit.startsWith("self-harm") ? "self-harm" : hit.startsWith("violence") ? "graphic violence" : "sexual content" };
    }
    return { ok: true };
  } catch { return { ok: true }; }
}

// ---------------- reports reach the admin ----------------

export type ReportInfo = {
  app: string; what: "post" | "comment" | "story" | "profile" | "message"; id: string; by: string; about?: string; reason?: string; reports?: number;
  /** Where the reported thing is kept (a table with a "hidden" column), for the one-tap Hide link. */
  table?: HideTable;
  /** Who posted it ("d<device>" or "u<id>"), for the one-tap "hide everything they posted" link. */
  owner?: string;
};
let listener: ((r: ReportInfo) => void) | null = null;
/** Set once by the server: each report becomes an admin alert. */
export function onSocialReport(fn: (r: ReportInfo) => void) { listener = fn; }
/** Called by every report route. Never throws into the request. */
export function reportFiled(r: ReportInfo) { try { listener?.(r); } catch { /* the report is still saved */ } }

/** The reasons people can pick when reporting. */
export const REPORT_REASONS = ["Spam", "Hate or harassment", "Sexual content", "Violence or threats", "Self-harm", "Someone under 13", "Something else"] as const;
export const cleanReason = (v: unknown) => (typeof v === "string" && (REPORT_REASONS as readonly string[]).includes(v) ? v : "Something else");

// ---------------- one-tap take-down from the report email ----------------
// Each report email carries signed links: "Hide this post" and "Hide everything they posted" (their
// profile; a hidden profile hides all their posts, replies and stories). The link opens a page with
// one button, so an email scanner opening the link never hides anything by itself.

export type HideTable = "podcast_posts" | "podcast_comments" | "podcast_stories" | "podcast_profiles" | "earshot_comments" | "podscroll_comments";
const HIDE_TABLES: HideTable[] = ["podcast_posts", "podcast_comments", "podcast_stories", "podcast_profiles", "earshot_comments", "podscroll_comments"];
const HIDE_DAYS = 14;
const secret = () => process.env.SESSION_SECRET || process.env.PODCAST_ACCOUNT_SECRET || "pod+";
const b64 = (s: string) => Buffer.from(s).toString("base64url");

/** A link token for hiding one row: table, key and expiry, signed. */
export function hideToken(table: HideTable, key: string, now = Date.now()): string {
  const body = b64(JSON.stringify({ t: table, k: key, e: now + HIDE_DAYS * 86_400_000 }));
  return `${body}.${createHmac("sha256", secret()).update(body).digest("base64url")}`;
}
export function readHideToken(token: string, now = Date.now()): { table: HideTable; key: string } | null {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const want = createHmac("sha256", secret()).update(body).digest("base64url");
  if (want.length !== sig.length || !timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  try {
    const d = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!HIDE_TABLES.includes(d?.t) || typeof d?.k !== "string" || !d.k || !(Number(d.e) > now)) return null;
    return { table: d.t, key: d.k };
  } catch { return null; }
}
/** The take-down links for a report, as [label, url] pairs. */
export function hideLinks(r: ReportInfo, appUrl: string): [string, string][] {
  const out: [string, string][] = [];
  const at = (table: HideTable, key: string) => `${appUrl.replace(/\/$/, "")}/api/moderation/hide?t=${encodeURIComponent(hideToken(table, key))}`;
  if (r.table && r.table !== "podcast_profiles" && /^\d+$/.test(r.id)) out.push([`Hide this ${r.what}`, at(r.table, r.id)]);
  if (r.owner && /^[du][A-Za-z0-9_-]{1,59}$/.test(r.owner)) out.push(["Hide everything they posted (their profile)", at("podcast_profiles", r.owner)]);
  return out;
}

const page = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{font:16px/1.5 -apple-system,system-ui,sans-serif;margin:0;padding:32px 20px;color:#16151a;background:#f6f6f9}main{max-width:480px;margin:0 auto;background:#fff;border-radius:20px;padding:24px;box-shadow:0 4px 24px rgba(0,0,0,.06)}h1{font-size:22px;margin:0 0 8px}button{font:inherit;font-weight:700;min-height:48px;width:100%;border:0;border-radius:999px;background:#d93025;color:#fff;margin-top:16px}p{color:#555}</style></head><body><main>${body}</main></body></html>`;
const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const label = (t: HideTable) => (t === "podcast_profiles" ? "this person's profile and everything they posted" : t === "podcast_stories" ? "this story" : t === "podcast_posts" ? "this post" : "this reply");

export function registerModerationRoutes(app: Express, getDb: () => any) {
  app.get("/api/moderation/hide", (req: any, res) => {
    const token = String(req.query?.t || "");
    const r = readHideToken(token);
    res.set("Cache-Control", "no-store");
    if (!r) return res.status(400).type("html").send(page("Link expired", "<h1>This link has run out</h1><p>Take-down links work for 14 days. Set hidden = true on the row in Supabase instead.</p>"));
    res.type("html").send(page("Hide reported content", `<h1>Hide ${esc(label(r.table))}?</h1><p>It disappears for everyone right away. Nothing is deleted, so it can be shown again in Supabase by setting hidden back to false.</p><form method="post" action="/api/moderation/hide"><input type="hidden" name="t" value="${esc(token)}"><button type="submit">Hide it</button></form>`));
  });
  app.post("/api/moderation/hide", async (req: any, res) => {
    // The form is posted as application/x-www-form-urlencoded, which the site's JSON parser skips.
    let raw = "";
    if (req.body && typeof req.body.t === "string") raw = `t=${encodeURIComponent(req.body.t)}`;
    else await new Promise<void>((done) => { req.on("data", (c: Buffer) => { if (raw.length < 4000) raw += c.toString(); }); req.on("end", done); req.on("error", done); });
    const r = readHideToken(new URLSearchParams(raw).get("t") || "");
    res.set("Cache-Control", "no-store");
    if (!r) return res.status(400).type("html").send(page("Link expired", "<h1>This link has run out</h1><p>Set hidden = true on the row in Supabase instead.</p>"));
    try {
      const q = getDb().from(r.table).update({ hidden: true });
      const { error } = await (r.table === "podcast_profiles" ? q.eq("voter", r.key) : q.eq("id", Number(r.key)));
      if (error) throw error;
      res.type("html").send(page("Hidden", `<h1>Hidden</h1><p>${esc(label(r.table)).replace(/^./, (c) => c.toUpperCase())} is hidden for everyone now.</p>`));
    } catch (e: any) {
      console.error("[moderation] hide:", e?.message || e);
      res.status(500).type("html").send(page("Didn't work", "<h1>That didn't work</h1><p>Try again in a minute, or set hidden = true on the row in Supabase.</p>"));
    }
  });
}
