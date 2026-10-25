// Earshot (a LifeHub App Store app): a swipe-to-discover podcast feed of real podcasts.
//
// Shows and episodes come live from Apple's podcast directory (the iTunes Search API), fetched and
// cached by the server (server/earshot.ts). Audio plays straight from each podcast's own host, the
// same file any podcast app plays, so nothing is copied or re-hosted. Likes, comments and share
// counts are shared between everyone on Arise (migrations/earshot.sql); what someone picked, follows,
// saved and how the feed has learned their taste is saved with their LifeHub (family.earshot).
//
// This file holds what both sides need: the genres, reading Apple's answers, the feed's ranking,
// and cleaning saved data.

export type Pace = "short" | "mix" | "deep";
export type Advance = 0 | 60 | 180;

export type GenreDef = {
  id: string;
  name: string;
  /** What to search Apple's directory for. The first term is used first; the rest top up. */
  terms: string[];
  /** Apple genre names a show must carry to count (empty: trust the search). */
  apple: string[];
  /** A tile colour for the genre grid and picker. */
  color: string;
  /** Okay for student accounts and kids. */
  kidSafe?: boolean;
};

export const GENRES: readonly GenreDef[] = [
  { id: "comedy", name: "Comedy", terms: ["comedy", "funny podcast"], apple: ["Comedy", "Comedy Interviews", "Improv", "Stand-Up"], color: "#f59e0b" },
  { id: "truecrime", name: "True Crime", terms: ["true crime", "unsolved mystery"], apple: ["True Crime"], color: "#7f1d1d" },
  { id: "news", name: "News", terms: ["daily news", "news"], apple: ["News", "Daily News", "News Commentary"], color: "#1e3a8a", kidSafe: true },
  { id: "politics", name: "Politics", terms: ["politics", "government"], apple: ["Politics", "Government", "News"], color: "#334155" },
  { id: "science", name: "Science", terms: ["science", "space"], apple: ["Science", "Natural Sciences", "Astronomy", "Physics", "Life Sciences", "Chemistry", "Earth Sciences"], color: "#0e7490", kidSafe: true },
  { id: "tech", name: "Technology", terms: ["technology", "tech news"], apple: ["Technology", "Tech News"], color: "#4338ca", kidSafe: true },
  { id: "business", name: "Business", terms: ["business", "entrepreneur"], apple: ["Business", "Entrepreneurship", "Investing", "Careers", "Management", "Marketing"], color: "#166534" },
  { id: "money", name: "Money", terms: ["personal finance", "money"], apple: ["Investing", "Business", "Education", "How To"], color: "#15803d" },
  { id: "history", name: "History", terms: ["history", "history stories"], apple: ["History"], color: "#92400e", kidSafe: true },
  { id: "sports", name: "Sports", terms: ["sports", "basketball"], apple: ["Sports", "Basketball", "Football", "Soccer", "Baseball", "Fantasy Sports", "Hockey", "Running", "Wrestling", "Golf", "Tennis"], color: "#b91c1c", kidSafe: true },
  { id: "health", name: "Health & Fitness", terms: ["fitness", "health"], apple: ["Health & Fitness", "Fitness", "Nutrition", "Medicine", "Alternative Health"], color: "#dc2626" },
  { id: "mental", name: "Mental Health", terms: ["mental health", "anxiety"], apple: ["Mental Health", "Health & Fitness", "Self-Improvement"], color: "#7c3aed" },
  { id: "culture", name: "Society & Culture", terms: ["culture", "society"], apple: ["Society & Culture", "Documentary", "Personal Journals", "Philosophy", "Places & Travel"], color: "#be185d" },
  { id: "arts", name: "Arts & Design", terms: ["art", "design"], apple: ["Arts", "Design", "Visual Arts", "Performing Arts", "Fashion & Beauty"], color: "#c026d3", kidSafe: true },
  { id: "books", name: "Books", terms: ["books", "book club"], apple: ["Books", "Arts"], color: "#a16207", kidSafe: true },
  { id: "music", name: "Music", terms: ["music", "music history"], apple: ["Music", "Music Commentary", "Music History", "Music Interviews"], color: "#db2777", kidSafe: true },
  { id: "film", name: "TV & Film", terms: ["movies", "tv shows"], apple: ["TV & Film", "Film Reviews", "TV Reviews", "After Shows", "Film History", "Film Interviews"], color: "#9333ea" },
  { id: "education", name: "Education", terms: ["learn", "education"], apple: ["Education", "Courses", "How To", "Language Learning", "Self-Improvement"], color: "#2563eb", kidSafe: true },
  { id: "kids", name: "Kids & Family", terms: ["kids stories", "kids science"], apple: ["Kids & Family", "Stories for Kids", "Education for Kids", "Parenting"], color: "#0891b2", kidSafe: true },
  { id: "fiction", name: "Fiction & Drama", terms: ["audio drama", "fiction podcast"], apple: ["Fiction", "Drama", "Science Fiction", "Comedy Fiction"], color: "#4c1d95" },
  { id: "horror", name: "Horror & Paranormal", terms: ["scary stories", "paranormal"], apple: [], color: "#111827" },
  { id: "faith", name: "Faith & Spirituality", terms: ["faith", "spirituality"], apple: ["Religion & Spirituality", "Christianity", "Spirituality", "Islam", "Judaism", "Buddhism", "Hinduism", "Religion"], color: "#ca8a04", kidSafe: true },
  { id: "gaming", name: "Gaming", terms: ["video games", "gaming"], apple: ["Video Games", "Leisure", "Games"], color: "#16a34a", kidSafe: true },
  { id: "hobbies", name: "Hobbies & DIY", terms: ["hobbies", "diy"], apple: ["Hobbies", "Crafts", "Home & Garden", "Leisure", "Automotive", "Aviation"], color: "#ea580c", kidSafe: true },
  { id: "food", name: "Food", terms: ["food", "cooking"], apple: ["Food", "Arts"], color: "#e11d48", kidSafe: true },
  { id: "travel", name: "Travel", terms: ["travel", "travel stories"], apple: ["Places & Travel", "Society & Culture"], color: "#0284c7", kidSafe: true },
  { id: "relationships", name: "Relationships", terms: ["relationships", "dating advice"], apple: ["Relationships", "Society & Culture"], color: "#f43f5e" },
  { id: "parenting", name: "Parenting", terms: ["parenting", "family"], apple: ["Parenting", "Kids & Family"], color: "#0d9488" },
  { id: "nature", name: "Nature", terms: ["nature", "animals"], apple: ["Nature", "Science", "Natural Sciences"], color: "#4d7c0f", kidSafe: true },
  { id: "growth", name: "Self-Improvement", terms: ["self improvement", "motivation"], apple: ["Self-Improvement", "Education", "Business"], color: "#d97706" },
  { id: "teaching", name: "Teaching", terms: ["teaching", "teachers"], apple: ["Education"], color: "#6d28d9", kidSafe: true },
];
export const GENRE = Object.fromEntries(GENRES.map((g) => [g.id, g])) as Record<string, GenreDef>;
export const PACES: readonly Pace[] = ["short", "mix", "deep"];

export type PodShow = {
  id: string; name: string; author: string; art: string; genre: string; appleGenre: string;
  link: string; episodes: number; explicit: boolean; latest: string;
  /** The show's RSS feed, where transcripts and chapters are listed (Podcasting 2.0). */
  feed?: string;
};
export type PodEpisode = {
  id: string; showId: string; show: string; author: string; title: string; about: string;
  audio: string; date: string; secs: number; art: string; link: string; explicit: boolean;
};
/** What's kept about a show someone follows, so the Following feed needs no lookup to start. */
export type SavedShow = { id: string; name: string; author: string; art: string; genre: string; at: string };
/** What's kept about an episode someone liked or saved, so the Library shows it without a lookup. */
export type SavedEpisode = { id: string; showId: string; title: string; show: string; art: string; secs: number; at: string; audio?: string; date?: string };

/** Pod Modes: listening hubs for a time of day or activity (Sleep, Commute...), each a playlist that
 *  plays back to back. The built-in ones always exist; people add their own. */
export type PodMode = { id: string; name: string; icon: string; episodes: SavedEpisode[] };
export const DEFAULT_MODES: readonly { id: string; name: string; icon: string; blurb: string }[] = [
  { id: "sleep", name: "Sleep", icon: "🌙", blurb: "Calm voices to drift off to" },
  { id: "commute", name: "Commute", icon: "🚗", blurb: "Right-sized for the drive" },
  { id: "workout", name: "Workout", icon: "💪", blurb: "Energy for the gym or a run" },
  { id: "focus", name: "Focus", icon: "🎧", blurb: "Background for deep work" },
  { id: "learn", name: "Learn", icon: "📚", blurb: "Get smarter on the go" },
  { id: "chores", name: "Chores", icon: "🧺", blurb: "Keeps the dishes interesting" },
];
export const MODE_ICONS = ["🌙", "🚗", "💪", "🎧", "📚", "🧺", "☕", "🍳", "🏖️", "✈️", "🧘", "🎮", "🐶", "🚶", "🛁", "🔥", "😂", "🕵️", "🎙️", "❤️"];
/** Apple's cover art at a bigger size (the same image is served at any size). */
export const hiRes = (url: string, size = 1200) => String(url || "").replace(/\/\d{2,4}x\d{2,4}(bb|cc|sr)?\.(jpg|jpeg|png|webp)$/i, `/${size}x${size}bb.$2`);

/** Smart ad skip: auto skips ads it's sure about (and asks about the rest), ask always shows a Skip button, off does nothing. */
export type AdMode = "auto" | "ask" | "off";
export const AD_MODES: readonly AdMode[] = ["auto", "ask", "off"];
export type EarshotSettings = { speed: number; skipIntro: boolean; advance: Advance; notes: boolean; explicit: boolean; adMode: AdMode; fullCover: boolean };
export type Earshot = {
  setupDone: boolean;
  genres: string[];
  pace: Pace;
  /** How much they seem to like each genre: picks start at 3, signals move it (see SIGNALS). */
  taste: Record<string, number>;
  follows: SavedShow[];
  liked: SavedEpisode[];
  saved: SavedEpisode[];
  /** Episode ids they listened to for a while, newest first. */
  heard: string[];
  /** Shows passed over quickly, newest first (shown less for a while). */
  skipped: string[];
  /** Shows they support: ads on these are never skipped. */
  adFree: string[];
  /** Pod Modes (the built-in ones first). */
  modes: PodMode[];
  settings: EarshotSettings;
};

export const EARSHOT_LIMITS = { follows: 200, liked: 300, saved: 300, heard: 200, skipped: 80, comment: 280, search: 80, modes: 24, modeEpisodes: 150 } as const;
export const defaultModes = (): PodMode[] => DEFAULT_MODES.map((m) => ({ id: m.id, name: m.name, icon: m.icon, episodes: [] }));
export const SPEEDS = [1, 1.25, 1.5, 2] as const;
export const defaultSettings = (): EarshotSettings => ({ speed: 1, skipIntro: true, advance: 0, notes: true, explicit: false, adMode: "auto", fullCover: false });
export const emptyEarshot = (): Earshot => ({ setupDone: false, genres: [], pace: "mix", taste: {}, follows: [], liked: [], saved: [], heard: [], skipped: [], adFree: [], modes: defaultModes(), settings: defaultSettings() });

// ---------------------------------------------------------------------------
// Reading Apple's answers
// ---------------------------------------------------------------------------

const obj = (v: unknown): Record<string, any> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : null);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\u0000/g, "").slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
export const cleanPodId = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).replace(/[^0-9]/g, "").slice(0, 20) : "");

/** An http(s) address, or "". Podcast audio is sometimes only on http; it's upgraded where the host allows. */
export function cleanUrl(v: unknown): string {
  const s = str(v, 1500).trim();
  if (!/^https?:\/\//i.test(s)) return "";
  try { const u = new URL(s); return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : ""; } catch { return ""; }
}
/** Apple's artwork addresses end in a size; ask for a bigger square. */
export const bigArt = (url: string, px = 600) => url.replace(/\/\d+x\d+(bb)?\.(jpg|png|webp)$/i, `/${px}x${px}bb.$2`);

/** Episode notes are HTML or plain text with odd spacing; this makes them short readable text. */
export function plainText(html: unknown, max = 700): string {
  let s = str(html, 20000);
  s = s.replace(/<(br|\/p|\/div|\/li)\s*\/?>/gi, " ").replace(/<[^>]+>/g, "");
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&hellip;/g, "…").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => { const c = Number(n); return c > 31 && c < 65536 ? String.fromCharCode(c) : ""; });
  s = s.replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : s;
}

const APPLE_TO_GENRE: Record<string, string> = Object.fromEntries(GENRES.flatMap((g) => g.apple.map((a) => [a, g.id])).reverse());

/** A search result for a show, or null when it can't be played or shown. */
export function parseShow(raw: unknown, genre = ""): PodShow | null {
  const r = obj(raw);
  if (!r) return null;
  const id = cleanPodId(r.collectionId ?? r.trackId);
  const name = str(r.collectionName ?? r.trackName, 200).trim();
  const art = cleanUrl(r.artworkUrl600) || (cleanUrl(r.artworkUrl100) ? bigArt(cleanUrl(r.artworkUrl100)) : "");
  if (!id || !name || !art) return null;
  if (r.kind && r.kind !== "podcast") return null;
  const appleGenre = str(r.primaryGenreName, 60);
  return {
    id, name, author: str(r.artistName, 160).trim(), art, appleGenre,
    genre: genre || APPLE_TO_GENRE[appleGenre] || "culture",
    link: cleanUrl(r.collectionViewUrl ?? r.trackViewUrl),
    episodes: Math.max(0, Math.floor(num(r.trackCount))),
    explicit: r.collectionExplicitness === "explicit" || r.trackExplicitness === "explicit",
    latest: str(r.releaseDate, 40),
    feed: cleanUrl(r.feedUrl) || undefined,
  };
}

/** An episode from a lookup or search, or null when it has no audio to play. */
export function parseEpisode(raw: unknown, show?: Pick<PodShow, "id" | "name" | "author" | "art" | "explicit"> | null): PodEpisode | null {
  const r = obj(raw);
  if (!r || (r.wrapperType && r.wrapperType !== "podcastEpisode") || (r.kind && r.kind !== "podcast-episode")) return null;
  const id = cleanPodId(r.trackId);
  const audio = cleanUrl(r.episodeUrl);
  const title = str(r.trackName, 300).trim();
  if (!id || !audio || !title) return null;
  const art = cleanUrl(r.artworkUrl600) || (cleanUrl(r.artworkUrl160) ? bigArt(cleanUrl(r.artworkUrl160)) : "") || show?.art || "";
  return {
    id, showId: cleanPodId(r.collectionId) || show?.id || "", show: str(r.collectionName, 200).trim() || show?.name || "",
    author: str(r.artistName, 160).trim() || show?.author || "", title,
    about: plainText(r.description ?? r.shortDescription),
    audio, date: str(r.releaseDate, 40), secs: Math.round(num(r.trackTimeMillis) / 1000), art,
    link: cleanUrl(r.trackViewUrl) || cleanUrl(r.collectionViewUrl), explicit: r.trackExplicitness === "explicit" || !!show?.explicit,
  };
}

/** Results of several searches for one genre, merged: no repeats, shows carrying the genre's Apple
 *  genres first. When the filter would leave too few, the rest of the search fills in. */
export function mergeGenreShows(genreId: string, batches: unknown[][], max = 60): PodShow[] {
  const g = GENRE[genreId];
  const seen = new Set<string>();
  const all: { show: PodShow; fits: boolean }[] = [];
  for (const batch of batches) for (const raw of batch) {
    const s = parseShow(raw, genreId);
    if (!s || seen.has(s.id)) continue;
    seen.add(s.id);
    const genres = Array.isArray(obj(raw)?.genres) ? (obj(raw)!.genres as unknown[]).filter((x): x is string => typeof x === "string") : [s.appleGenre];
    all.push({ show: s, fits: !g || !g.apple.length || genres.some((x) => g.apple.includes(x)) });
  }
  const fit = all.filter((x) => x.fits).map((x) => x.show);
  const rest = all.filter((x) => !x.fits).map((x) => x.show);
  return (fit.length >= 8 ? fit : [...fit, ...rest]).slice(0, max);
}

/** Apple's search address. Explicit podcasts are left out unless asked for. */
export function appleSearchUrl(term: string, entity: "podcast" | "podcastEpisode", limit: number, explicit: boolean) {
  const p = new URLSearchParams({ term: term.slice(0, EARSHOT_LIMITS.search), media: "podcast", entity, limit: String(Math.min(200, Math.max(1, limit))), country: "US", explicit: explicit ? "Yes" : "No" });
  return `https://itunes.apple.com/search?${p}`;
}
export const appleLookupUrl = (showId: string, limit: number) => `https://itunes.apple.com/lookup?${new URLSearchParams({ id: showId, media: "podcast", entity: "podcastEpisode", limit: String(Math.min(200, Math.max(1, limit))), country: "US" })}`;

// ---------------------------------------------------------------------------
// The feed: what to show next
// ---------------------------------------------------------------------------

/** How each thing someone does moves their taste for that show's genre. */
export const SIGNALS = { like: 3, unlike: -2.5, save: 2, share: 3, comment: 2, follow: 4, unfollow: -3, listen: 1, finish: 1.5, skip: -0.6, open: 0.5 } as const;
export type Signal = keyof typeof SIGNALS;
export const tasteOf = (e: Earshot, genre: string) => e.taste[genre] ?? (e.genres.includes(genre) ? 3 : 0.3);

/** Taste after a signal: the genre moves, every other genre drifts slightly back toward neutral so the
 *  feed keeps up with what someone likes now. Clamped so no genre runs away or disappears for good. */
export function applySignal(e: Earshot, genre: string, signal: Signal): Earshot {
  if (!GENRE[genre]) return e;
  const taste: Record<string, number> = {};
  for (const [k, v] of Object.entries(e.taste)) taste[k] = Math.round(v * 995) / 1000;
  taste[genre] = Math.round(Math.max(-3, Math.min(14, tasteOf(e, genre) + SIGNALS[signal])) * 1000) / 1000;
  return { ...e, taste };
}

export type Candidate = { show: PodShow; rank: number };
export type FeedContext = { recentShows: string[]; shownShows: Set<string> | string[]; follows: Set<string> | string[] };

/** A show's score for the For You feed. rank is its place in Apple's results (0 = top). */
export function scoreShow(e: Earshot, c: Candidate, ctx: FeedContext): number {
  const shown = ctx.shownShows instanceof Set ? ctx.shownShows : new Set(ctx.shownShows);
  const follows = ctx.follows instanceof Set ? ctx.follows : new Set(ctx.follows);
  let s = 1.4 * tasteOf(e, c.show.genre);
  s += 1.4 * (1 - Math.min(c.rank, 40) / 40);                       // popular shows rise
  if (follows.has(c.show.id)) s += 1.8;
  if (shown.has(c.show.id)) s -= 4;                                  // already in this feed
  if (ctx.recentShows.includes(c.show.id)) s -= 2;
  const skips = e.skipped.slice(0, 30).filter((x) => x === c.show.id).length;
  s -= 1.2 * skips;
  const days = c.show.latest ? (Date.now() - Date.parse(c.show.latest)) / 86_400_000 : 365;
  if (Number.isFinite(days) && days < 10) s += 0.5;                  // still making new episodes
  else if (!Number.isFinite(days) || days > 400) s -= 0.6;
  return s;
}

export type FeedPick = { show: PodShow; why: string; explore: boolean };

/** Picks the next shows for the feed. About one in seven is deliberately outside their usual taste,
 *  so the feed doesn't narrow to one genre. random is injectable for tests. */
export function pickNext(e: Earshot, pool: Candidate[], ctx: FeedContext, n: number, random: () => number = Math.random): FeedPick[] {
  const out: FeedPick[] = [];
  const shown = new Set(ctx.shownShows instanceof Set ? Array.from(ctx.shownShows) : ctx.shownShows);
  const follows = new Set(ctx.follows instanceof Set ? Array.from(ctx.follows) : ctx.follows);
  for (let k = 0; k < n; k++) {
    const left = pool.filter((c) => !shown.has(c.show.id));
    if (!left.length) break;
    let pick: Candidate | null = null; let explore = false;
    if (random() < 0.15) {
      const genres = Array.from(new Set(left.map((c) => c.show.genre))).sort((a, b) => tasteOf(e, a) - tasteOf(e, b));
      const low = new Set(genres.slice(0, Math.max(2, Math.ceil(genres.length / 2))));
      const cand = left.filter((c) => low.has(c.show.genre) && tasteOf(e, c.show.genre) < 6).sort((a, b) => a.rank - b.rank).slice(0, 6);
      if (cand.length) { pick = cand[Math.floor(random() * cand.length)]; explore = true; }
    }
    if (!pick) {
      const recent = [...ctx.recentShows, ...out.map((o) => o.show.id)].slice(-6);
      const scored = left.map((c) => ({ c, s: scoreShow(e, c, { recentShows: recent, shownShows: shown, follows }) })).sort((a, b) => b.s - a.s).slice(0, 20);
      const top = scored[0].s;
      const weights = scored.map((x) => Math.exp((x.s - top) / 0.9));
      let u = random() * weights.reduce((a, b) => a + b, 0);
      let i = 0;
      while (i < weights.length - 1 && u > weights[i]) { u -= weights[i]; i++; }
      pick = scored[i].c;
    }
    shown.add(pick.show.id);
    out.push({ show: pick.show, why: whyShown(e, pick, follows, explore), explore });
  }
  return out;
}

export function whyShown(e: Earshot, c: Candidate, follows: Set<string>, explore: boolean): string {
  const g = GENRE[c.show.genre]?.name ?? "Podcasts";
  if (explore) return `Something new · ${g}`;
  if (follows.has(c.show.id)) return "A show you follow";
  if (tasteOf(e, c.show.genre) >= 5) return `Because you like ${g}`;
  if (c.rank < 5) return `Top in ${g}`;
  return `Popular in ${g}`;
}

/** Which episode of a show to play: the newest one they haven't heard that suits their pace. */
export function chooseEpisode(e: Earshot, episodes: PodEpisode[]): PodEpisode | null {
  const fresh = episodes.filter((ep) => !e.heard.includes(ep.id));
  const list = fresh.length ? fresh : episodes;
  if (!list.length) return null;
  const fits = (ep: PodEpisode) => !ep.secs || (e.pace === "short" ? ep.secs <= 25 * 60 : e.pace === "deep" ? ep.secs >= 45 * 60 : true);
  return list.slice(0, 6).find(fits) ?? list[0];
}

/** Where a long episode starts when "Skip the intro" is on. */
export const introSkip = (secs: number, on: boolean) => (on && secs >= 15 * 60 ? 90 : 0);

export const durationWords = (secs: number) => {
  if (!secs) return "";
  const m = Math.round(secs / 60);
  return m < 60 ? `${Math.max(1, m)} min` : `${Math.floor(m / 60)} hr ${m % 60 ? `${m % 60} min` : ""}`.trim();
};
export const clock = (secs: number) => {
  const s = Math.max(0, Math.floor(secs || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
};
export const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K` : String(Math.max(0, n)));

/** The words someone types to share an episode. The Apple Podcasts link works for anyone. */
export function shareText(ep: Pick<PodEpisode, "title" | "show" | "link">): string {
  return `“${ep.title}” from ${ep.show}${ep.link ? ` ${ep.link}` : ""}`;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/** How a commenter is shown: first name and last initial, never a full name or username. */
export function commentAuthor(displayName: unknown): string {
  const parts = str(displayName, 80).replace(/[^\p{L}\p{N}' .-]/gu, "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Listener";
  const first = parts[0].slice(0, 20);
  return parts.length > 1 ? `${first} ${parts[parts.length - 1][0].toUpperCase()}.` : first;
}
/** A comment's text made safe to keep: trimmed, single spaces, no control characters, at most 280. */
export function cleanComment(v: unknown): string {
  return str(v, 2000).replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, EARSHOT_LIMITS.comment);
}

/** Student accounts get clean podcasts only, and don't see or post public comments. */
export const canComment = (role: unknown) => role !== "student";

// ---------------------------------------------------------------------------
// Cleaning saved data (family.earshot)
// ---------------------------------------------------------------------------

function cleanSavedShow(v: unknown): SavedShow | null {
  const r = obj(v); const id = cleanPodId(r?.id); const name = str(r?.name, 200).trim(); const art = cleanUrl(r?.art);
  return r && id && name && art ? { id, name, author: str(r.author, 160), art, genre: GENRE[str(r.genre, 20)] ? str(r.genre, 20) : "culture", at: str(r.at, 40) } : null;
}
function cleanSavedEpisode(v: unknown): SavedEpisode | null {
  const r = obj(v); const id = cleanPodId(r?.id); const title = str(r?.title, 300).trim();
  if (!(r && id && title)) return null;
  const out: SavedEpisode = { id, showId: cleanPodId(r.showId), title, show: str(r.show, 200), art: cleanUrl(r.art), secs: Math.max(0, Math.min(86_400, Math.floor(num(r.secs)))), at: str(r.at, 40) };
  const audio = cleanUrl(r.audio); if (audio) out.audio = audio;
  const date = str(r.date, 40); if (date) out.date = date;
  return out;
}
function list<T extends { id: string }>(v: unknown, max: number, clean: (x: unknown) => T | null): T[] {
  const out: T[] = [];
  for (const x of Array.isArray(v) ? v : []) { const c = clean(x); if (c && !out.some((o) => o.id === c.id)) out.push(c); if (out.length >= max) break; }
  return out;
}
const idList = (v: unknown, max: number, unique = true) => {
  const all = (Array.isArray(v) ? v : []).map(cleanPodId).filter(Boolean);
  return (unique ? Array.from(new Set(all)) : all).slice(0, max);
};

function cleanModes(v: unknown): PodMode[] {
  const out = defaultModes();
  for (const x of Array.isArray(v) ? v : []) {
    const r = obj(x); if (!r) continue;
    const id = str(r.id, 24).replace(/[^a-z0-9-]/gi, "").toLowerCase();
    if (!id) continue;
    const episodes = list(r.episodes, EARSHOT_LIMITS.modeEpisodes, cleanSavedEpisode);
    const known = out.find((m) => m.id === id);
    if (known) { known.episodes = episodes; continue; }
    const name = str(r.name, 30).replace(/\s+/g, " ").trim();
    if (!name || out.length >= EARSHOT_LIMITS.modes) continue;
    out.push({ id, name, icon: MODE_ICONS.includes(r.icon) ? r.icon : "🎙️", episodes });
  }
  return out;
}

export function cleanEarshot(v: unknown): Earshot {
  const r = obj(v);
  if (!r) return emptyEarshot();
  const taste: Record<string, number> = {};
  const t = obj(r.taste) || {};
  for (const g of GENRES) if (typeof t[g.id] === "number" && Number.isFinite(t[g.id])) taste[g.id] = Math.max(-3, Math.min(14, Math.round(t[g.id] * 1000) / 1000));
  const s = obj(r.settings) || {};
  const d = defaultSettings();
  return {
    setupDone: r.setupDone === true,
    genres: Array.from(new Set((Array.isArray(r.genres) ? r.genres : []).filter((g: unknown): g is string => typeof g === "string" && !!GENRE[g]))),
    pace: PACES.includes(r.pace) ? r.pace : "mix",
    taste,
    follows: list(r.follows, EARSHOT_LIMITS.follows, cleanSavedShow),
    liked: list(r.liked, EARSHOT_LIMITS.liked, cleanSavedEpisode),
    saved: list(r.saved, EARSHOT_LIMITS.saved, cleanSavedEpisode),
    heard: idList(r.heard, EARSHOT_LIMITS.heard),
    skipped: idList(r.skipped, EARSHOT_LIMITS.skipped, false),
    adFree: idList(r.adFree, 300),
    modes: cleanModes(r.modes),
    settings: {
      speed: (SPEEDS as readonly number[]).includes(s.speed) ? s.speed : d.speed,
      skipIntro: typeof s.skipIntro === "boolean" ? s.skipIntro : d.skipIntro,
      advance: s.advance === 60 || s.advance === 180 ? s.advance : 0,
      notes: typeof s.notes === "boolean" ? s.notes : d.notes,
      explicit: s.explicit === true,
      fullCover: s.fullCover === true,
      adMode: AD_MODES.includes(s.adMode) ? s.adMode : s.adSkip === false ? "off" : d.adMode,
    },
  };
}

// ---------------------------------------------------------------------------
// The feed endpoint: genres arrive with episodes attached, so swiping never waits
// ---------------------------------------------------------------------------

/** A show in a genre pool with its newest playable episodes. */
export type PoolShow = { show: PodShow; rank: number; episodes: PodEpisode[] };
/** Episodes made light for the feed: short notes (the show sheet has the full ones). */
export const lightEpisode = (e: PodEpisode): PodEpisode => ({ ...e, about: e.about.length > 260 ? e.about.slice(0, 259).replace(/\s+\S*$/, "") + "…" : e.about });

/** Episode search results grouped by show: the fallback pool while a genre's shows are still warming up. */
export function poolFromEpisodeSearch(genreId: string, results: unknown[], explicit: boolean): PoolShow[] {
  const by = new Map<string, PoolShow>();
  for (const raw of results) {
    const e = parseEpisode(raw); if (!e || !e.showId || (!explicit && e.explicit)) continue;
    let p = by.get(e.showId);
    if (!p) { p = { show: { id: e.showId, name: e.show, author: e.author, art: e.art, genre: genreId, appleGenre: "", link: "", episodes: 0, explicit: e.explicit, latest: e.date }, rank: by.size, episodes: [] }; by.set(e.showId, p); }
    if (p.episodes.length < 3) p.episodes.push(lightEpisode(e));
  }
  return Array.from(by.values());
}

// ---------------------------------------------------------------------------
// Read along: transcripts, chapters and ads
// ---------------------------------------------------------------------------

export type TxSegment = { s: number; e: number; t: string };
/** An ad's place in the audio. conf is how sure the finder is (0-1); kind is which finder found it. */
export type AdRange = { s: number; e: number; label: string; conf?: number; kind?: string };
export type Chapter = { s: number; title: string };
export type TranscriptChunk = {
  /** publisher: the show's own transcript. ai: written by AI from the audio. none: neither is available. */
  source: "publisher" | "ai" | "none";
  segments: TxSegment[]; ads: AdRange[]; chapters: Chapter[];
  chunk: number; chunkSecs: number; more: boolean;
  /** Why there's no transcript, in words someone can read. */
  reason?: string;
  /** How long the audio these times belong to is. exact: the server's MP3, measured. approx: a
   *  publisher transcript's last line (the audio may run a little longer). Ads only line up with
   *  a listener's audio when it's the same length (podcasts often stitch in different ads). */
  dur?: number; durMode?: "exact" | "approx";
  /** Word timings (server only; used to cut ads at the exact word). */
  words?: { s: number; e: number; w: string }[];
};
export const TX_CHUNK_SECS = 600;

/** "01:02:03.500", "02:03,5" or "63.5" in seconds; NaN when it isn't a time. */
export function parseClock(v: string): number {
  const m = String(v).trim().replace(",", ".").match(/^(?:(\d+):)?(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!m) return NaN;
  const parts = [m[1], m[2], m[3]].filter((x) => x !== undefined).map(Number);
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

const unTag = (t: string) => plainText(t.replace(/<v\s+([^>]+)>/gi, "$1: "), 2000);

/** WebVTT or SRT cues as segments. */
export function parseCues(text: string): TxSegment[] {
  const out: TxSegment[] = [];
  for (const block of String(text).replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n");
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a, b] = lines[i].split("-->");
    const s = parseClock(a), e = parseClock(String(b).trim().split(/\s+/)[0]);
    const t = unTag(lines.slice(i + 1).join(" "));
    if (Number.isFinite(s) && Number.isFinite(e) && t) out.push({ s, e: Math.max(e, s), t });
  }
  return mergeShortSegments(out);
}

/** Podcasting 2.0 JSON transcripts ({ segments: [{ startTime, endTime, body, speaker }] }). */
export function parseTranscriptJson(v: unknown): TxSegment[] {
  const segs = Array.isArray((v as any)?.segments) ? (v as any).segments : [];
  const out: TxSegment[] = [];
  for (const x of segs) {
    const s = Number(x?.startTime), e = Number(x?.endTime), t = plainText(x?.body, 2000);
    if (Number.isFinite(s) && t) out.push({ s, e: Number.isFinite(e) ? Math.max(e, s) : s, t });
  }
  return mergeShortSegments(out);
}

/** Word-level transcripts become readable lines: joined until a sentence ends or ~12 seconds pass. */
export function mergeShortSegments(list: TxSegment[]): TxSegment[] {
  const out: TxSegment[] = [];
  let cur: TxSegment | null = null;
  for (const x of list.slice().sort((a, b) => a.s - b.s)) {
    if (!cur) { cur = { ...x }; continue; }
    const ended = /[.!?…]["')\]]?$/.test(cur.t);
    if (!ended && x.s - cur.s < 12 && cur.t.length < 220) { cur.t = `${cur.t} ${x.t}`; cur.e = Math.max(cur.e, x.e); }
    else { out.push(cur); cur = { ...x }; }
  }
  if (cur) out.push(cur);
  return out;
}

/** Podcasting 2.0 JSON chapters. */
export function parseChaptersJson(v: unknown): Chapter[] {
  const list = Array.isArray((v as any)?.chapters) ? (v as any).chapters : [];
  return list.filter((c: any) => c && c.toc !== false && Number.isFinite(Number(c.startTime)) && typeof c.title === "string")
    .map((c: any) => ({ s: Number(c.startTime), title: plainText(c.title, 120) })).filter((c: Chapter) => c.title).sort((a: Chapter, b: Chapter) => a.s - b.s).slice(0, 200);
}

/** Chapters the publisher titled as ads or sponsors become ad ranges. */
export function adsFromChapters(chapters: Chapter[], duration: number): AdRange[] {
  const out: AdRange[] = [];
  chapters.forEach((c, i) => {
    if (!/\b(ads?|sponsors?|sponsored|advert(isement)?s?|promos?|commercials?|ad break)\b/i.test(c.title)) return;
    const e = chapters[i + 1]?.s ?? duration;
    if (e - c.s >= 5 && e - c.s <= 420) out.push({ s: c.s, e, label: c.title });
  });
  return out;
}

const attr = (tag: string, name: string) => { const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i")); return m ? m[1].replace(/&amp;/g, "&") : ""; };
const audioKey = (u: string) => { try { const x = new URL(u); return (x.pathname.split("/").pop() || "").toLowerCase(); } catch { return ""; } };

/** The transcript and chapters files an RSS feed lists for one episode (matched by audio file name or title). */
export function rssExtrasFor(xml: string, ep: { audio: string; title: string }): { transcripts: { url: string; type: string }[]; chapters: string } {
  const items = String(xml).split(/<item[\s>]/i).slice(1);
  const key = audioKey(ep.audio); const title = ep.title.trim().toLowerCase();
  const item = items.find((it) => { const enc = it.match(/<enclosure\b[^>]*>/i); return !!enc && !!key && audioKey(attr(enc[0], "url")) === key; })
    ?? items.find((it) => { const t = it.match(/<title>([\s\S]*?)<\/title>/i); return !!t && plainText(t[1].replace(/<!\[CDATA\[|\]\]>/g, ""), 400).toLowerCase() === title; });
  if (!item) return { transcripts: [], chapters: "" };
  const transcripts = (item.match(/<podcast:transcript\b[^>]*>/gi) || []).map((t) => ({ url: cleanUrl(attr(t, "url")), type: attr(t, "type").toLowerCase() })).filter((t) => t.url);
  const ch = item.match(/<podcast:chapters\b[^>]*>/i);
  return { transcripts, chapters: ch ? cleanUrl(attr(ch[0], "url")) : "" };
}
/** Timed formats first: JSON, then VTT, then SRT. Plain text and HTML have no times, so they aren't used. */
export function bestTranscript(list: { url: string; type: string }[]) {
  const rank = (t: string) => (/json/.test(t) ? 0 : /vtt/.test(t) ? 1 : /srt|subrip/.test(t) ? 2 : 9);
  return list.slice().sort((a, b) => rank(a.type) - rank(b.type)).find((t) => rank(t.type) < 9) ?? null;
}

/** How an episode's audio is cut into pieces small enough to transcribe (under 24 MB each). */
export function chunkPlan(totalBytes: number, secs: number) {
  const bps = secs > 0 && totalBytes > 0 ? totalBytes / secs : 16_000;
  const chunkSecs = Math.max(60, Math.min(TX_CHUNK_SECS, Math.floor(23_000_000 / bps)));
  const duration = secs > 0 ? secs : totalBytes / bps;
  return { bps, chunkSecs, chunks: Math.max(1, Math.ceil(duration / chunkSecs)), duration };
}

export const AD_PROMPT = `You find the ads in podcast transcripts so a listener can skip them.
You get numbered transcript lines. Mark every stretch that is an advertisement, sponsor read, promo for another show or product, or "this episode is brought to you by" message, including the host's own read ads and the "we'll be right back"/"and we're back" lines around a break.
Do not mark the show's real content, the host introducing the show, or asking listeners to rate, follow or subscribe.
Answer with JSON only: {"ads":[{"from":<first line number>,"to":<last line number>,"label":"<sponsor name or 'Ad break'>"}]}. Answer {"ads":[]} when there are none.`;
export const adUserMessage = (segs: TxSegment[], offset = 0) => segs.map((s, i) => `${i + offset}: ${s.t}`).join("\n").slice(0, 60_000);

/** The AI's ad answer as time ranges, checked: real line numbers, between 8 seconds and 6 minutes long. */
export function adsFromAi(raw: string, segs: TxSegment[], offset = 0): AdRange[] {
  let v: any; try { v = JSON.parse(raw); } catch { return []; }
  const out: AdRange[] = [];
  for (const a of Array.isArray(v?.ads) ? v.ads : []) {
    const from = Math.floor(Number(a?.from)) - offset, to = Math.floor(Number(a?.to)) - offset;
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to < from || to >= segs.length) continue;
    const s = segs[from].s, e = segs[to].e;
    if (e - s >= 8 && e - s <= 360) out.push({ s, e, label: plainText(a?.label, 60) || "Ad break" });
  }
  return mergeAds(out);
}
export function mergeAds(list: AdRange[]): AdRange[] {
  const out: AdRange[] = [];
  for (const a of list.slice().sort((x, y) => x.s - y.s)) {
    const last = out[out.length - 1];
    if (last && a.s <= last.e + 3) {
      last.e = Math.max(last.e, a.e);
      if ((a.conf ?? 0) > (last.conf ?? 0)) { last.conf = a.conf; last.kind = a.kind ?? last.kind; }
      if ((!last.label || last.label === "Ad break") && a.label && a.label !== "Ad break") last.label = a.label;
    } else out.push({ ...a });
  }
  return out;
}

/** Where to start an episode: where they left off (unless that's the very start or end), else past the intro. */
export function startAt(secs: number, resumeAt: number | undefined, skipIntro: boolean): number {
  if (resumeAt && resumeAt > 20 && (!secs || resumeAt < secs - 30)) return Math.floor(resumeAt);
  return introSkip(secs, skipIntro);
}
/** The ad playing at a moment, if any (ignoring the last second, so a skip never lands inside the same ad). */
export const adAt = (ads: AdRange[], t: number) => ads.find((a) => t >= a.s && t < a.e - 1) ?? null;
