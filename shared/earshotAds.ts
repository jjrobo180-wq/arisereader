// Smart ad skip for Earshot and Podscroll: the parts the server and the apps share.
//
// How ads are found, from cheapest to most expensive, all combined:
//  1. Phrases and sponsors: lines with "brought to you by", "use code", "dot com slash", "% off"...
//     and brands that sponsor podcasts all the time. Free and instant.
//  2. Show memory: each show's own sponsors, the words its ad breaks start with, and the line its
//     episodes open with once the pre-roll ads are over, learned from earlier episodes.
//  3. AI reads the transcript with 1 and 2 as hints and quotes each ad's first and last words, so
//     the cut lands on the exact word (word timings from the transcription).
//  4. Listeners: "Mark ad" ranges, Undo as a "not an ad" vote, and spots many people skip past.
//
// Podcasts often stitch different ads into each download, so ad times only line up between two
// copies of the same length. alignAds() decides which ads can be trusted for a listener's copy.
import type { AdRange, TxSegment } from "./earshot";

export type Word = { s: number; e: number; w: string };
/** dai: found by comparing copies (an ad the host stitched into this copy). */
/** splice: found from the seams in one copy; known: an ad seen before in another episode (by its frames). */
export type AdKind = "ai" | "phrase" | "learned" | "chapter" | "user" | "crowd" | "dai" | "intro" | "splice" | "known";
/** An ad as the server sends it. dur: the length of the audio its times belong to. */
export type ServerAd = {
  key: string; s: number; e: number; label: string; kind: AdKind; conf: number;
  dur: number; durMode: "exact" | "approx";
  /** Listeners who marked it (user) or skipped it (crowd). */
  support?: number;
  /** Votes: 1 + ups - downs (an ad below 1 isn't sent). */
  score?: number;
};
/** An ad as the player uses it: sure ones may be skipped automatically, the rest only on a tap. */
export type PlayAd = { key: string; s: number; e: number; label: string; kind: AdKind; sure: boolean };

/** Words only: for matching quotes, first words and names. */
const norm = (t: string) => String(t).toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
/** Lower case with the punctuation ads use kept (".com/", "%", "&", "+"), for the phrase patterns. */
const normText = (t: string) => String(t).toLowerCase().replace(/[’']/g, "'").replace(/%/g, " percent").replace(/[^a-z0-9'.\/&+ ]+/g, " ").replace(/\s+/g, " ").trim();
export const firstWords = (t: string, n = 6) => norm(t).split(" ").filter(Boolean).slice(0, n).join(" ");

// ---------------------------------------------------------------------------
// 1. Phrases and sponsors
// ---------------------------------------------------------------------------

/** Wording that's almost only ever used in ads. */
const STRONG: RegExp[] = [
  /\bbrought to you by\b/, /\bsponsored by\b/, /\b(this|today's|the) (episode|show|podcast|segment) is (sponsored|supported|presented|powered) by\b/,
  /\bsupport for (this|the|today's) (podcast|show|episode|program) comes from\b/, /\b(today's|our|this week's) sponsor\b/, /\bthanks to our sponsors?\b/,
  /\b(promo|offer|discount|coupon) code\b/, /\buse (the )?code\b/, /\bdot com slash\b/, /\b[a-z0-9]+\.com\/[a-z0-9]+/,
  /\b(\d{1,2}|ten|fifteen|twenty|twenty five|thirty|forty|fifty|sixty) ?(%|percent) off\b/, /\bfree trial\b/, /\bterms (and conditions )?(may )?apply\b/,
  /\bfirst (month|order|box|year) (free|for)\b/, /\bfree shipping\b/, /\bmoney back guarantee\b/, /\brisk free\b/,
  /\b(go to|go over to|head to|head over to|visit|sign up at|get started at|check out|learn more at|text) [a-z0-9]+ ?(dot|\.) ?(com|org|io|co|net)\b/,
  /\bdownload the [a-z0-9 ]{2,20} app (today|now)\b/, /\bexclusive (offer|deal) for (our )?listeners\b/, /\bfor (our|my) listeners\b.*\b(offer|deal|off|free)\b/,
  /\blimited time (offer|only)\b/, /\bmember fdic\b/, /\bnot available in all states\b/,
  // Public radio underwriting (NPR and member stations)
  /\bthis message comes from\b/, /\bsupport for (npr|this (npr )?(podcast|program|show)|the following message) (and the following message )?comes? from\b/,
  /\bsupport (for npr )?(and the following message )?come from\b/, /\b(funding|support) for (this|the) (program|podcast|show) is provided by\b/,
  /\bthis (program|podcast|show) is (made possible|supported) (in part )?by\b/, /\bnpr ?(plus|\+)\b/, /\bsponsor[- ]free\b/,
  // Political ads and the fine print read at the end of ads
  /\bpaid for by\b/, /\bi approve this message\b/, /\bnot authorized by any candidate\b/,
  /\b(see|visit) [a-z0-9. ]{2,30} for (details|full terms|terms)\b/, /\brestrictions apply\b/, /\bvoid where prohibited\b/, /\bsubject to credit approval\b/,
  /\bequal housing (lender|opportunity)\b/, /\b(investing|investment) involves risk\b/, /\bpast performance (is not|does not)\b/, /\bmessage and data rates may apply\b/,  // More sponsor-read wording (found without AI, so ads are still caught when the AI is busy)
  /\bat checkout\b/, /\b(get|save|take) (an extra )?(\d{1,2}|ten|fifteen|twenty|twenty five|thirty|forty|fifty) ?(%|percent)\b/, /\bfree (gift|bonus|month|week|box|sample)s? (with|when|for)\b/,
  /\b(this|today's) (episode|show) is (also )?(brought to you|made possible)\b/, /\b(a )?word from (our|today's|this week's) sponsors?\b/, /\bour (friends|partners) (at|over at)\b.*\b(dot ?com|\.com|code|offer|off)\b/,
  /\b(link|code|offer) (is )?in (the |our )?(show notes|description|episode notes)\b/, /\btext [a-z0-9]+ to \d{3,6}\b/, /\bfor a limited time\b/, /\b(use|enter) (my|our) (code|link)\b/,
  /\bpaid (promotion|partnership|advertisement)\b/, /\b(and )?now back to (the|our) (show|episode|conversation)\b/, /\bthis (ad|advertisement) (was|is)\b/,
];
/** Wording that's common in ads and around ad breaks, but also in shows. */
const MEDIUM: RegExp[] = [
  /\b(we'll|we will|i'll) be right back\b/, /\b(after|right after) (the|this|a) (short |quick )?(break|word from)\b/, /\bquick (break|word)\b/, /\bshort break\b/,
  /\bstick around\b/, /\bwhen we come back\b/, /\bad[- ]free\b/, /\bsubscribe (to|on) [a-z ]+\+/, /\blisten (now|ad free|early)\b/,
  /\bwherever you (get|listen to) (your )?podcasts\b/, /\bdownload (the|our) app\b/, /\bvisit\b.*\b(dot|\.) ?com\b/, /\bsign up\b/, /\bcode [a-z0-9]{3,}\b/,
  /\bsave (up to )?\d+\b/, /\bget \d+ ?(%|percent)\b/, /\boffer ends\b/, /\bright now\b.*\b(get|save)\b/,
  // Donation asks and network promos
  /\b(make a|your) (donation|gift)\b/, /\b(donate|give) (at|today|now)\b/, /\bbecome a (member|sustainer|supporter)\b/, /\bpledge\b/,
  /\b(new|next) episodes? (every|drop|out)\b.*\b(listen|subscribe|follow)\b/, /\b(listen|binge) (to )?(the )?(whole|full|entire) (series|season)\b/,  /\b(let's|lets) take a (quick |short )?break\b/, /\b(we'll|we will) be back (after|in)\b/, /\band we're back\b/, /\bwelcome back\b/, /\bspecial (offer|deal)\b/,
  /\bsign up (today|now)\b/, /\bdownload (it )?(today|now|for free)\b/, /\bavailable (now )?(at|on) (amazon|target|walmart|costco)\b/, /\bgo to [a-z0-9]+\b.*\b(today|now)\b/,
];
/** Brands that sponsor podcasts all the time (only counted with ad wording nearby, so talking about them isn't an ad). */
export const SPONSOR_BRANDS = [
  "betterhelp", "squarespace", "hellofresh", "factor", "ag1", "athletic greens", "ziprecruiter", "nordvpn", "expressvpn", "surfshark", "shopify",
  "mint mobile", "rocket money", "indeed", "quince", "linkedin jobs", "simplisafe", "progressive", "liberty mutual", "state farm", "geico", "babbel",
  "audible", "manscaped", "doordash", "uber eats", "calm", "headspace", "native", "harry's", "dollar shave club", "casper", "purple", "helix",
  "saatva", "bombas", "meundies", "honey", "chime", "sofi", "robinhood", "acorns", "policygenius", "ethos", "ladder", "noom", "hims", "hers",
  "roman", "keeps", "cerebral", "talkspace", "wondery plus", "wondery+", "siriusxm", "peacock", "paramount plus", "grammarly", "monday.com",
  "canva", "wix", "godaddy", "mailchimp", "gusto", "netsuite", "quickbooks", "turbotax", "h&r block", "upwork", "fiverr", "rakuten", "ibotta",
  "honeylove", "cozy earth", "brooklinen", "parachute", "mack weldon", "rhone", "true classic", "chubbies", "tommy john", "warby parker",
  "visible", "tello", "us mobile", "wayfair", "chewy", "rover", "barkbox", "the farmer's dog", "farmers dog", "ollie", "butcherbox",
  "thrive market", "daily harvest", "trade coffee", "athletic brewing", "liquid iv", "liquid i.v.", "magic spoon", "olipop", "huel", "ritual",
  "seed", "thorne", "momentous", "lmnt", "element", "whoop", "oura", "eight sleep", "hatch", "masterclass", "coursera", "skillshare", "brilliant",
  "blinkist", "shortform", "ground news", "incogni", "deleteme", "delete me", "aura", "lifelock", "1password", "dashlane", "kraken", "coinbase",
  "fundrise", "masterworks", "yieldstreet", "mercury", "ramp", "brex", "vanta", "hostinger", "bluehost", "framer", "zapier", "hubspot",
  "miro", "notion", "cash app", "venmo", "experian", "credit karma", "lending tree", "lendingtree", "greenlight", "outschool", "lovevery",
  "kiwico", "hungryroot", "green chef", "home chef", "blue apron", "everyday dose", "mud wtr", "ka'chava", "kachava", "bloom", "ghost",
  "nutrafol", "ridge", "ridge wallet", "mizzen", "jones road", "function of beauty", "prose", "curology", "aspen dental", "zocdoc", "ro",
  "lume", "smalls", "pupford", "petlab", "nom nom", "stamps.com", "squarespace", "constant contact", "kajabi", "teachable", "bambee",
];
const brandPattern = new RegExp(`\\b(${SPONSOR_BRANDS.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");

export type AdHints = { sponsors?: string[]; leadins?: string[]; intro?: string | null; preroll?: number | null; show?: string; title?: string; inserted?: boolean };

/** Sites that are never a sponsor (where shows are listened to, followed or hosted). */
const NOT_SPONSORS = /^(apple|podcasts|spotify|youtube|youtu|twitter|instagram|facebook|tiktok|threads|patreon|megaphone|simplecast|art19|omny|omnystudio|acast|podtrac|libsyn|anchor|substack|www|bit|linktr|linktree|google|amazon|iheart|iheartradio|pod|chartable|pdst|feeds|soundcloud|stitcher|pocketcasts|overcast|castbox|discord|reddit|twitch|wikipedia|gmail|mailto|wondery|npr|nytimes|cnn|foxnews)$/i;
/** Sponsor names from an episode's notes: "Sponsors: A, B and C", "brought to you by X", and the
 *  promo addresses ads always give ("betterhelp.com/show"). They make the keyword rules sharper. */
export function sponsorsFromNotes(about = ""): string[] {
  const t = String(about).replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&[a-z#0-9]+;/gi, " ");
  const out = new Set<string>();
  for (const sentence of t.split(/(?<=[.!?])\s+|\n+/)) {
    for (const m of sentence.matchAll(/\b(?:https?:\/\/)?(?:www\.)?([a-z0-9][a-z0-9-]{2,30})\.(?:com|co|io|net|app|ai|us|tv|health|fit)(\/[a-z0-9_-]{2,30})?\b/gi)) {
      // A plain home page is often the show's own; with a promo path, or offered in the same sentence, it's an ad's.
      if (!NOT_SPONSORS.test(m[1]) && (m[2] || /\b(code|promo|offer|discount|sponsor|% off|percent off|free trial)\b/i.test(sentence))) out.add(m[1].toLowerCase());
    }
  }
  for (const m of t.matchAll(/\b(?:sponsors?|sponsored by|brought to you by|thanks to our sponsors?|support (?:for )?(?:this|the) (?:show|podcast|episode) (?:comes )?from)\s*[:\-–]?\s*([^\n.!?]{2,200})/gi)) {
    for (const part of m[1].split(/,|\band\b|;|\||•|\//)) {
      const name = part.trim().replace(/^(our|the|by)\s+/i, "").split(/\s+/).slice(0, 3).join(" ").replace(/[^\w&' +.-]/g, "").trim();
      if (name.length >= 3 && name.length <= 30 && /^[A-Z0-9]/.test(name) && !NOT_SPONSORS.test(name)) out.add(name.toLowerCase());
    }
  }
  return [...out].slice(0, 15);
}

/** How ad-like one line is: 3+ is a strong sign on its own. */
export function lineAdScore(text: string, hints: AdHints = {}): number {
  const t = normText(text);
  if (!t) return 0;
  let score = 0;
  for (const r of STRONG) if (r.test(t)) score += 3;
  for (const r of MEDIUM) if (r.test(t)) score += 1;
  const brand = brandPattern.test(t);
  if (brand) score += score > 0 ? 2 : 1;
  const plain = norm(text);
  for (const s of hints.sponsors ?? []) if (s.length >= 3 && new RegExp(`\\b${norm(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(plain)) { score += score > 0 ? 3 : 2; break; }
  for (const l of hints.leadins ?? []) if (l && plain.startsWith(l)) { score += 3; break; }
  return score;
}

/** Stretches of transcript that read like ads: strong lines grouped when they're under 45 seconds apart. */
export function phraseBlocks(segs: TxSegment[], hints: AdHints = {}) {
  const scores = segs.map((s) => lineAdScore(s.t, hints));
  const blocks: { from: number; to: number; score: number; strong: number }[] = [];
  let cur: { from: number; to: number; score: number; strong: number } | null = null;
  scores.forEach((sc, i) => {
    if (sc < 3) return;
    if (cur && segs[i].s - segs[cur.to].e <= 45) { for (let k = cur.to + 1; k <= i; k++) cur.score += scores[k]; cur.to = i; cur.strong++; }
    else { if (cur) blocks.push(cur); cur = { from: i, to: i, score: sc, strong: 1 }; }
  });
  if (cur) blocks.push(cur);
  // A line just before or after that also sounds like an ad belongs to it.
  for (const b of blocks) {
    if (b.from > 0 && scores[b.from - 1] >= 1 && segs[b.from].s - segs[b.from - 1].s <= 20) b.from--;
    if (b.to < segs.length - 1 && scores[b.to + 1] >= 1 && segs[b.to + 1].e - segs[b.to].e <= 25) b.to++;
  }
  return { scores, blocks };
}

/** Phrase blocks as ad ranges (used when AI isn't available, and as a safety net beside it). */
export function phraseAds(segs: TxSegment[], hints: AdHints = {}, minScore = 6): AdRange[] {
  const { blocks } = phraseBlocks(segs, hints);
  return blocks
    .filter((b) => b.score >= minScore || b.strong >= 2)
    .map((b) => ({ s: segs[b.from].s, e: segs[b.to].e, label: "Ad break",
      // Three or more ad lines together ("brought to you by", "use code", "dot com slash"...) is an ad
      // for sure: skipped by itself, without waiting for the AI.
      conf: b.strong >= 3 || b.score >= 12 ? 0.8 : Math.min(0.7, 0.35 + b.score * 0.04), kind: "phrase" }))
    .filter((a) => a.e - a.s >= 10 && a.e - a.s <= 300);
}

// ---------------------------------------------------------------------------
// 2. Show memory
// ---------------------------------------------------------------------------

export type ShowProfile = {
  /** Sponsor name -> episodes it was heard in. */
  sponsors: Record<string, number>;
  /** How this show's ad breaks start (first words) -> times seen. */
  leadins: Record<string, number>;
  /** How episodes start once any pre-roll ads are over (first words) -> times seen. */
  intros: Record<string, number>;
  /** Pre-roll lengths, newest last. */
  prerolls: number[];
  episodes: string[];
  /** Where this show's ad breaks have been heard (show time, seconds) with the episode's length,
   *  newest last: used to check those parts of new episodes first. Older profiles don't have it. */
  spots?: [number, number][];
};
export const emptyProfile = (): ShowProfile => ({ sponsors: {}, leadins: {}, intros: {}, prerolls: [], episodes: [], spots: [] });
const top = (r: Record<string, number>, n: number) => Object.fromEntries(Object.entries(r).sort((a, b) => b[1] - a[1]).slice(0, n));
const median = (xs: number[]) => { if (!xs.length) return null; const v = xs.slice().sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };

/** Learn from one analysed piece of an episode. `opening` (its first piece) also teaches pre-roll
 *  length and how episodes start; later pieces teach sponsors and how ad breaks start. */
export function learnProfile(p: ShowProfile, episodeId: string, segs: TxSegment[], ads: AdRange[], opening = true, duration = 0): ShowProfile {
  if (p.episodes.includes(episodeId) || !segs.length) return p;
  const next: ShowProfile = { sponsors: { ...p.sponsors }, leadins: { ...p.leadins }, intros: { ...p.intros }, prerolls: p.prerolls.slice(), episodes: [...p.episodes, episodeId].slice(-60), spots: (p.spots ?? []).slice() };
  const sure = ads.filter((a) => (a.conf ?? 0.8) >= 0.75);
  // Mid-roll and end ad breaks: where they sit (only from show-time pieces, which pass the length).
  if (duration > 0) for (const a of sure) if (a.s >= 30 && a.kind !== "intro" && a.kind !== "user") next.spots!.push([Math.round(a.s), Math.round(duration)]);
  next.spots = next.spots!.slice(-80);
  const seen = new Set<string>();
  for (const a of sure) {
    const label = norm(a.label || "");
    if (label && label !== "ad break" && label !== "pre roll" && label.length <= 40 && !seen.has(label)) { seen.add(label); next.sponsors[label] = (next.sponsors[label] ?? 0) + 1; }
    const first = segs.find((s) => s.s >= a.s - 1 && s.s <= a.s + 3);
    if (first) { const w = firstWords(first.t, 5); if (w.split(" ").length >= 3) next.leadins[w] = (next.leadins[w] ?? 0) + 1; }
  }
  if (opening) {
    const pre = sure.find((a) => a.s < 3);
    if (pre) next.prerolls = [...next.prerolls, Math.round(pre.e)].slice(-12);
    const first = segs.find((s) => s.s >= (pre ? pre.e - 2 : 0) && !sure.some((a) => s.s >= a.s - 1 && s.s < a.e));
    if (first && first.s < 360) { const w = firstWords(first.t, 6); if (w.split(" ").length >= 3) next.intros[w] = (next.intros[w] ?? 0) + 1; }
  }
  next.sponsors = top(next.sponsors, 40); next.leadins = top(next.leadins, 30); next.intros = top(next.intros, 12);
  return next;
}

/** What the show memory says, for the detectors and the AI. Only things seen in 2+ episodes count. */
export function profileHints(p: ShowProfile | null | undefined, show = ""): AdHints {
  if (!p) return { show };
  const often = (r: Record<string, number>) => Object.entries(r).filter(([, n]) => n >= 2).map(([k]) => k);
  const intro = Object.entries(p.intros).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { show, sponsors: often(p.sponsors).slice(0, 25), leadins: often(p.leadins).slice(0, 15), intro, preroll: median(p.prerolls) };
}

/** A pre-roll found from the show's usual opening line: everything before it is ads, when the
 *  show usually has pre-roll ads or that stretch reads like one. */
export function learnedPreroll(segs: TxSegment[], ads: AdRange[], hints: AdHints): AdRange | null {
  if (!hints.intro) return null;
  const i = segs.findIndex((s) => s.s >= 12 && s.s <= 360 && firstWords(s.t, 6) === hints.intro);
  if (i < 0) return null;
  const end = segs[i].s;
  if (ads.some((a) => a.s < end - 5 && a.e > 5 && a.e >= end - 5)) return null; // already covered
  const before = segs.slice(0, i).reduce((n, s) => n + lineAdScore(s.t, hints), 0);
  if ((hints.preroll ?? 0) < 15 && before < 3) return null;
  return { s: 0, e: end, label: "Pre-roll", conf: before >= 3 ? 0.9 : 0.8, kind: "learned" };
}

/** The pieces of a new episode (of `duration` seconds, cut every `chunkSecs`) where this show's ad
 *  breaks usually are, most likely first. Breaks near the end are matched from the end (episodes
 *  differ in length), the rest by time. A piece counts once seen twice, or once when the show has
 *  only a few episodes on record. The first piece is left out (the opening check covers it). */
export function adSpotChunks(p: ShowProfile | null | undefined, duration: number, chunkSecs: number, max = 3): number[] {
  const spots = p?.spots ?? [];
  if (!spots.length || duration <= 0 || chunkSecs <= 0) return [];
  const last = Math.max(0, Math.ceil(duration / chunkSecs - 0.01) - 1);
  const tally = new Map<number, number>();
  for (const [s, d] of spots) {
    const fromEnd = d - s;
    const t = fromEnd >= 0 && fromEnd <= 300 ? duration - fromEnd : s;
    const c = Math.min(last, Math.max(0, Math.floor(t / chunkSecs)));
    if (c > 0) tally.set(c, (tally.get(c) ?? 0) + 1);
  }
  const need = (p?.episodes.length ?? 0) >= 4 ? 2 : 1;
  return [...tally.entries()].filter(([, n]) => n >= need).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, max).map(([c]) => c);
}

/** One tap on "That's an ad": the ad around `t`, from the transcript when there is one. It starts
 *  at the first ad-sounding line just before `t` and runs until the show is back (two plain lines
 *  in a row). With no transcript there, it's the next 30 seconds (each further tap adds 30). */
export function guessAdAround(segs: TxSegment[], t: number, hints: AdHints = {}): { s: number; e: number; sure: boolean } {
  const near = segs.filter((x) => x.e >= t - 150 && x.s <= t + 240);
  const at = near.findIndex((x) => x.e >= t);
  if (at < 0 || near[at].s > t + 20) return { s: Math.max(0, Math.floor(t) - 3), e: Math.floor(t) + 30, sure: false };
  const score = near.map((x) => lineAdScore(x.t, hints));
  let a = at;
  while (a > 0 && score[a - 1] >= 1 && t - near[a - 1].s <= 120) a--;
  let b = at, plain = 0, sawAd = score[at] >= 1;
  for (let i = at + 1; i < near.length && near[i].s - t <= 180; i++) {
    if (score[i] >= 1) { sawAd = true; plain = 0; b = i; }
    else if (++plain >= 2 && (sawAd || near[i].s - t >= 30)) break;
    else if (!sawAd) b = i;
  }
  const s = Math.min(Math.floor(t) - 1, Math.floor(near[a].s));
  const e = Math.max(Math.ceil(near[b].e), Math.floor(t) + 10);
  return { s: Math.max(0, s), e: Math.min(e, Math.floor(t) + 180), sure: sawAd };
}

// ---------------------------------------------------------------------------
// 3. AI, cut at the exact word
// ---------------------------------------------------------------------------

export const AD_PROMPT_V2 = `You find the ads in podcast transcripts so a listener can skip them. Accuracy matters both ways: skipping real show content is worse than missing an ad.
You get numbered transcript lines. Lines marked ★ contain wording that often appears in ads (a hint, not proof).
Mark every advertisement: sponsor reads (including the host reading them), "brought to you by"/"support comes from" messages, promos for other podcasts, shows, movies, apps or subscriptions, network ad breaks, and the host or show selling its own things (courses, starter packs, free downloads that collect your email, memberships, Patreon, premium or ad-free versions, merch, live tour tickets, newsletters). Include the "we'll be right back"/"and we're back" lines that wrap a break.
Do not mark: the show's real content, the host introducing the show or guest, a short request to rate, review, follow or share (one or two sentences), or a guest talking about their own book or work as part of the conversation. When the episode itself is a trailer, preview or bonus promo (its title says "Introducing", "Trailer", "Preview" or "Sneak peek"), the trailer is the episode: only mark sponsor reads inside it.
For each ad give the first and last line numbers, and quote its first 4-6 words and last 4-6 words exactly as written in the transcript (so the cut lands on the exact word; an ad can start or end in the middle of a line).
Answer with JSON only: {"ads":[{"from":<line>,"to":<line>,"start":"<first words>","end":"<last words>","label":"<sponsor or product name, or 'Ad break'>","confidence":<0 to 1>}]}. Answer {"ads":[]} when there are none.`;

export function adPromptMessage(segs: TxSegment[], scores: number[], hints: AdHints, offset = 0): string {
  const head: string[] = [];
  if (hints.show) head.push(`Show: ${hints.show}`);
  if (hints.title) head.push(`Episode: ${hints.title}`);
  if (hints.sponsors?.length) head.push(`This show's sponsors in past episodes: ${hints.sponsors.slice(0, 15).join(", ")}`);
  if (hints.leadins?.length) head.push(`This show's ad breaks often start with: ${hints.leadins.slice(0, 6).map((x) => `"${x}"`).join(", ")}`);
  if (hints.intro) head.push(`After any opening ads, this show's episodes usually begin: "${hints.intro}"`);
  if (hints.inserted) head.push("Note: this audio is a slot the podcast host fills differently for each listener, so it is usually ads or promos for other shows, perhaps with a few seconds of the show at its very start or end. A promo often opens with a clip from the other show (people talking about its topic) before naming it: mark the whole promo, clip included, from its first line. Leave out only lines that clearly continue this episode.");
  const lines = segs.map((s, i) => `${i + offset}: ${scores[i] >= 2 ? "★ " : ""}${s.t}`);
  return `${head.join("\n")}${head.length ? "\n\n" : ""}${lines.join("\n")}`.slice(0, 70_000);
}

/** Where a quoted run of words sits in the word timings, near a line: start or end time, or null. */
export function quoteTime(words: Word[], quote: string, near: { s: number; e: number }, edge: "start" | "end"): number | null {
  const q = norm(quote).split(" ").filter(Boolean);
  if (q.length < 2 || !words.length) return null;
  const pool = words.filter((w) => w.s >= near.s - 20 && w.e <= near.e + 20);
  const ws = pool.map((w) => norm(w.w));
  const need = Math.max(2, Math.ceil(q.length * 0.75));
  let best: { i: number; hits: number } | null = null;
  for (let i = 0; i + 1 < ws.length; i++) {
    let hits = 0;
    for (let k = 0; k < q.length && i + k < ws.length; k++) if (ws[i + k] === q[k]) hits++;
    if (hits >= need && (!best || hits > best.hits || (hits === best.hits && Math.abs(pool[i].s - (edge === "start" ? near.s : near.e)) < Math.abs(pool[best.i].s - (edge === "start" ? near.s : near.e))))) best = { i, hits };
  }
  if (!best) return null;
  return edge === "start" ? pool[best.i].s : pool[Math.min(pool.length - 1, best.i + q.length - 1)].e;
}

/** The AI's answer as ad ranges: line numbers checked, cut at the quoted words when word timings exist. */
export function adsFromAiV2(raw: string, segs: TxSegment[], words: Word[] = [], offset = 0): AdRange[] {
  let v: any; try { v = JSON.parse(raw); } catch { return []; }
  const out: AdRange[] = [];
  for (const a of Array.isArray(v?.ads) ? v.ads : []) {
    const from = Math.floor(Number(a?.from)) - offset, to = Math.floor(Number(a?.to)) - offset;
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to < from || to >= segs.length) continue;
    let s = segs[from].s, e = segs[to].e;
    const qs = typeof a?.start === "string" ? quoteTime(words, a.start, segs[from], "start") : null;
    const qe = typeof a?.end === "string" ? quoteTime(words, a.end, segs[to], "end") : null;
    if (qs !== null && qs >= s - 12 && qs < e) s = qs;
    if (qe !== null && qe <= e + 12 && qe > s) e = qe;
    const conf = Number(a?.confidence);
    if (e - s >= 6 && e - s <= 420) out.push({ s, e, label: String(a?.label || "Ad break").replace(/\s+/g, " ").trim().slice(0, 60) || "Ad break", conf: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0.85, kind: "ai" });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The show's intro: skipped only for listeners who turn on "Skip the intro"
// ---------------------------------------------------------------------------
export const INTRO_PROMPT = `You read the opening of a podcast episode's transcript (numbered lines, ads already found are marked [AD]) and find where the episode's real content begins, so a listener can skip the intro.
The intro is what comes before that: theme-song lyrics, a "previously on" recap, a cold-open teaser (a short clip from later in the episode played first, often followed by music), the show's standard welcome ("Welcome to <show>, the podcast where…", "I'm <host>…"), housekeeping (rate and review, follow us, our socials, live tour dates) and banter before the hosts turn to the topic.
Content begins at the first line where the hosts start on this episode's actual subject or story, or greet a guest to start the interview.
Be careful: when the episode dives straight into the subject, or you can't tell, answer null. Never put real discussion of the topic in the intro.
Answer with JSON only: {"content":{"line":<first content line number>,"start":"<first few words of that line>"}} or {"content":null}.`;

export function introPromptMessage(segs: TxSegment[], ads: AdRange[], hints: AdHints): string {
  const head: string[] = [];
  if (hints.show) head.push(`Show: ${hints.show}`);
  if (hints.title) head.push(`Episode: ${hints.title}`);
  const inAd = (g: TxSegment) => ads.some((a) => g.s >= a.s - 0.5 && g.e <= a.e + 0.5);
  const lines = segs.map((g, i) => `${i}: ${inAd(g) ? "[AD] " : ""}${g.t}`);
  return `${head.join("\n")}\n\n${lines.join("\n")}`.slice(0, 30_000);
}

/** The AI's answer as the intro's range: from where the show starts (after any ads at the start)
 *  to the first content line (cut at its first words). At least 8 seconds and at most 4 minutes. */
export function introFromAi(raw: string, segs: TxSegment[], ads: AdRange[], words: Word[] = []): AdRange | null {
  let v: any; try { v = JSON.parse(raw); } catch { return null; }
  const line = Math.floor(Number(v?.content?.line));
  if (!Number.isFinite(line) || line <= 0 || line >= segs.length) return null;
  let e = segs[line].s;
  const q = typeof v.content.start === "string" ? quoteTime(words, v.content.start, segs[line], "start") : null;
  if (q !== null && Math.abs(q - e) < 8) e = q;
  // Starts where the opening ads end (they're skipped as ads either way).
  let s = 0;
  for (const a of ads.slice().sort((x, y) => x.s - y.s)) if (a.s <= s + 2 && a.e > s && a.e < e) s = a.e;
  if (e - s < 8 || e - s > 240) return null;
  return { s, e, label: "Intro", conf: 0.85, kind: "intro" };
}

/** Everything found, combined: AI first; phrase blocks the AI didn't cover only when they're very
 *  strong (and then as "ask", not auto); the learned pre-roll; publisher chapters named as ads. */
export function combineAds(ai: AdRange[] | null, phrase: AdRange[], learned: AdRange | null, chapters: AdRange[]): AdRange[] {
  const all: AdRange[] = [...(ai ?? []), ...chapters.map((c) => ({ ...c, conf: 0.9, kind: "chapter" }))];
  const covered = (a: AdRange) => all.some((b) => Math.min(a.e, b.e) - Math.max(a.s, b.s) > (a.e - a.s) * 0.4);
  for (const p of phrase) if (!covered(p) && (ai === null || (p.conf ?? 0) >= 0.6)) all.push(ai === null ? p : { ...p, conf: Math.min(p.conf ?? 0.6, 0.6) });
  if (learned && !covered(learned)) all.push(learned);
  const merged: AdRange[] = [];
  for (const a of all.slice().sort((x, y) => x.s - y.s)) {
    const last = merged[merged.length - 1];
    if (last && a.s <= last.e + 2) {
      last.e = Math.max(last.e, a.e);
      if ((a.conf ?? 0) > (last.conf ?? 0)) { last.conf = a.conf; last.kind = a.kind; }
      if ((!last.label || /^(ad break|pre-roll)$/i.test(last.label)) && a.label && !/^(ad break|pre-roll)$/i.test(a.label)) last.label = a.label;
    } else merged.push({ ...a });
  }
  return merged;
}

// ---------------------------------------------------------------------------
// 4. Listeners: marks and skips, grouped
// ---------------------------------------------------------------------------

export type Mark = { id: string; s: number; e: number; dur: number; voter: string; label?: string };
export type Skip = { from: number; to: number; dur: number; voter: string };
const sameCopy = (a: number, b: number) => Math.abs(a - b) <= 1.5;

/** Groups listeners' marks of the same ad (same-length copy, overlapping) into one range each. */
export function clusterMarks(marks: Mark[]): { key: string; s: number; e: number; dur: number; label: string; support: number; voters: string[] }[] {
  const groups: { items: Mark[] }[] = [];
  for (const m of marks.slice().sort((a, b) => a.s - b.s)) {
    const g = groups.find((x) => x.items.some((y) => sameCopy(y.dur, m.dur) && Math.min(y.e, m.e) - Math.max(y.s, m.s) >= 0.6 * Math.min(y.e - y.s, m.e - m.s)));
    if (g) g.items.push(m); else groups.push({ items: [m] });
  }
  return groups.map((g) => {
    const mid = (xs: number[]) => { const v = xs.slice().sort((a, b) => a - b); return v[Math.floor((v.length - 1) / 2)]; };
    const voters = Array.from(new Set(g.items.map((x) => x.voter)));
    const label = g.items.map((x) => x.label || "").find((x) => x && x !== "Ad break") || "Ad break";
    const ids = g.items.map((x) => Number(x.id)).filter(Number.isFinite);
    return { key: `u:${ids.length ? Math.min(...ids) : g.items[0].id}`, s: mid(g.items.map((x) => x.s)), e: mid(g.items.map((x) => x.e)), dur: mid(g.items.map((x) => x.dur)), label, support: voters.length, voters };
  });
}

/** Spots several different listeners jumped past, in the same-length copy: likely ads. */
export function clusterSkips(skips: Skip[], minVoters = 3): { key: string; s: number; e: number; dur: number; support: number }[] {
  const groups: Skip[][] = [];
  for (const k of skips.filter((x) => x.to - x.from >= 10 && x.to - x.from <= 300).sort((a, b) => a.from - b.from)) {
    const g = groups.find((x) => x.some((y) => sameCopy(y.dur, k.dur) && Math.abs(y.from - k.from) <= 8 && Math.abs(y.to - k.to) <= 12));
    if (g) g.push(k); else groups.push([k]);
  }
  return groups.map((g) => {
    const voters = new Set(g.map((x) => x.voter));
    const sorted = (f: (x: Skip) => number) => g.map(f).sort((a, b) => a - b);
    const mid = (v: number[]) => v[Math.floor((v.length - 1) / 2)];
    const s = mid(sorted((x) => x.from)), e = mid(sorted((x) => x.to)), dur = mid(sorted((x) => x.dur));
    return { key: `c:${Math.round(dur)}:${Math.round(s / 5)}:${Math.round(e / 5)}`, s, e, dur, support: voters.size };
  }).filter((c) => c.support >= minVoters);
}

// ---------------------------------------------------------------------------
// Lining ads up with a listener's copy
// ---------------------------------------------------------------------------

/** Which ads fit a copy of `D` seconds. Same-length copy: as found (sure when confident). A copy of
 *  another length has different stitched-in ads, so only the first ad of that copy is offered (its
 *  start is still right), as a "Skip?" button rather than an automatic skip. */
export function alignAds(list: ServerAd[], D: number): PlayAd[] {
  if (!Number.isFinite(D) || D <= 0) return [];
  const fits = (a: ServerAd) => a.dur > 0 && (a.durMode === "approx" ? D - a.dur >= -1.5 && D - a.dur <= 45 : sameCopy(a.dur, D));
  const out: PlayAd[] = [];
  const firstOff = new Map<number, ServerAd>();
  for (const a of list) {
    if ((a.score ?? 1) < 1 || a.e <= a.s) continue;
    if (fits(a)) {
      const sure = a.kind === "user" ? true : a.kind === "crowd" ? false : a.conf >= 0.75;
      out.push({ key: a.key, s: a.s, e: Math.min(a.e, D), label: a.label, kind: a.kind, sure });
    } else if (a.kind !== "crowd" && a.kind !== "user") {
      const b = Math.round(a.dur);
      const f = firstOff.get(b);
      if (!f || a.s < f.s) firstOff.set(b, a);
    }
  }
  for (const a of Array.from(firstOff.values())) {
    if (a.s > 600 || out.some((o) => Math.abs(o.s - a.s) < 20)) continue;
    out.push({ key: a.key, s: a.s, e: Math.min(a.e, D), label: a.label, kind: a.kind, sure: false });
  }
  // Overlaps: keep one, the sure one if there is one.
  const merged: PlayAd[] = [];
  for (const a of out.sort((x, y) => x.s - y.s)) {
    const last = merged[merged.length - 1];
    if (last && a.s < last.e - 1) { if (a.sure && !last.sure) merged[merged.length - 1] = { ...a, s: Math.min(a.s, last.s), e: Math.max(a.e, last.e) }; else last.e = Math.max(last.e, a.e); }
    else merged.push({ ...a });
  }
  return merged;
}

export const playAdAt = (ads: PlayAd[], t: number) => ads.find((a) => t >= a.s && t < a.e - 1) ?? null;

// ---------------------------------------------------------------------------
// Measuring an MP3 exactly (so the server knows which copy its ad times belong to)
// ---------------------------------------------------------------------------

const BITRATES = { 1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] } as const;
const RATES = { 1: [44100, 48000, 32000], 2: [22050, 24000, 16000], 25: [11025, 12000, 8000] } as const;

/** The duration in seconds of an MP3 of `total` bytes, from its first bytes (16 KB is plenty): the
 *  Xing/Info or VBRI frame count when present, else the constant bitrate. null when it isn't MP3. */
export function mp3Duration(head: Uint8Array, total: number): number | null { return mp3Info(head, total)?.duration ?? null; }
/** Duration, where the audio starts (after tags) and bytes per second of audio. */
export function mp3Info(head: Uint8Array, total: number): { duration: number; audioStart: number; bytesPerSec: number } | null {
  let off = 0;
  if (head.length >= 10 && head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {
    off = 10 + ((head[6] & 0x7f) << 21 | (head[7] & 0x7f) << 14 | (head[8] & 0x7f) << 7 | (head[9] & 0x7f)) + ((head[5] & 0x10) ? 10 : 0);
  }
  const u32 = (i: number) => (head[i] << 24 | head[i + 1] << 16 | head[i + 2] << 8 | head[i + 3]) >>> 0;
  const frame = (i: number) => {
    if (i + 4 > head.length || head[i] !== 0xff || (head[i + 1] & 0xe0) !== 0xe0) return null;
    const vb = (head[i + 1] >> 3) & 3, lb = (head[i + 1] >> 1) & 3, bi = head[i + 2] >> 4, si = (head[i + 2] >> 2) & 3;
    if (vb === 1 || lb !== 1 || bi === 0 || bi === 15 || si === 3) return null; // Layer III only
    const v = vb === 3 ? 1 : vb === 2 ? 2 : 25;
    const kbps = BITRATES[v === 1 ? 1 : 2][bi], rate = RATES[v][si], pad = (head[i + 2] >> 1) & 1, mono = (head[i + 3] >> 6) === 3;
    const spf = v === 1 ? 1152 : 576;
    const len = Math.floor(((v === 1 ? 144 : 72) * kbps * 1000) / rate) + pad;
    return { kbps, rate, spf, len, mono, v };
  };
  // Find the first real frame: a valid header whose next frame also starts where it should.
  let f: ReturnType<typeof frame> = null; let at = -1;
  for (let i = off; i < Math.min(head.length - 4, off + 8192); i++) {
    const a = frame(i);
    if (!a) continue;
    if (i + a.len + 4 <= head.length && !frame(i + a.len)) continue;
    f = a; at = i; break;
  }
  if (!f || at < 0) return null;
  const side = f.v === 1 ? (f.mono ? 17 : 32) : (f.mono ? 9 : 17);
  const x = at + 4 + side;
  const tag = String.fromCharCode(head[x], head[x + 1], head[x + 2], head[x + 3]);
  let duration: number | null = null;
  if ((tag === "Xing" || tag === "Info") && x + 12 <= head.length && (u32(x + 4) & 1)) duration = (u32(x + 8) * f.spf) / f.rate;
  const vb = at + 4 + 32;
  if (duration === null && vb + 18 <= head.length && String.fromCharCode(head[vb], head[vb + 1], head[vb + 2], head[vb + 3]) === "VBRI") duration = (u32(vb + 14) * f.spf) / f.rate;
  if (duration === null && total > at) duration = ((total - at) * 8) / (f.kbps * 1000);
  if (!duration || !Number.isFinite(duration) || duration <= 0) return null;
  return { duration, audioStart: at, bytesPerSec: (total - at) / duration };
}

/** A listener marked an ad: remember its sponsor (when they named one) and how it started. */
export function learnFromMark(p: ShowProfile, segs: TxSegment[], ad: { s: number; e: number; label?: string }): ShowProfile {
  const next: ShowProfile = { ...p, sponsors: { ...p.sponsors }, leadins: { ...p.leadins } };
  const label = norm(ad.label || "");
  if (label && label !== "ad break" && label.length <= 40) next.sponsors[label] = (next.sponsors[label] ?? 0) + 1;
  const first = segs.find((x) => x.s >= ad.s - 2 && x.s <= ad.s + 4);
  if (first) { const w = firstWords(first.t, 5); if (w.split(" ").length >= 3) next.leadins[w] = (next.leadins[w] ?? 0) + 1; }
  next.sponsors = top(next.sponsors, 40); next.leadins = top(next.leadins, 30);
  return next;
}
