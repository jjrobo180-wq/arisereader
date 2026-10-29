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

export type ReportInfo = { app: string; what: "post" | "comment" | "story" | "profile" | "message"; id: string; by: string; about?: string; reason?: string; reports?: number };
let listener: ((r: ReportInfo) => void) | null = null;
/** Set once by the server: each report becomes an admin alert. */
export function onSocialReport(fn: (r: ReportInfo) => void) { listener = fn; }
/** Called by every report route. Never throws into the request. */
export function reportFiled(r: ReportInfo) { try { listener?.(r); } catch { /* the report is still saved */ } }

/** The reasons people can pick when reporting. */
export const REPORT_REASONS = ["Spam", "Hate or harassment", "Sexual content", "Violence or threats", "Self-harm", "Someone under 13", "Something else"] as const;
export const cleanReason = (v: unknown) => (typeof v === "string" && (REPORT_REASONS as readonly string[]).includes(v) ? v : "Something else");
