// Wikiverse (LifeHub section "wiki", client/src/components/family-hub/WikiFeed.tsx): every Wikipedia article as an
// endless, full-screen swipe feed that learns what you like.
//
// How it learns (all here, pure, tested in tests/wiki-feed.test.ts):
//   • Every card is watched: how long it stayed on screen, whether it was opened, liked, saved, shared, commented on,
//     or marked "not for me". Each becomes a reward (REWARD below).
//   • An article that did well becomes a SEED: later cards come from Wikipedia's own "more like this" search on it
//     (CirrusSearch morelike:), so the feed drifts toward what holds you. Seeds fade with time and with skips.
//   • TOPICS (Wikipedia's article topics: space, music, history…) are weighted the same way, from the chips picked
//     at the start and from how cards from each topic do.
//   • Cards come from four LANES: more like your seeds, your topics, what the world is reading today, and pure
//     discovery (random articles). Each lane keeps a running score of how its cards do, and the next card's lane is
//     drawn in proportion to those scores (with a floor, so discovery never stops). The more you use it, the more
//     it leans on what works for you.
//   • Nothing is shown twice (the last 4,000 cards are remembered), and stubs, lists and disambiguation pages are
//     left out. A mature-topics filter is on by default.
// Cards are fetched straight from Wikipedia's public API (CORS, origin=*), so nothing goes through Arise's server
// but likes counts and comments (server/wikiFeed.ts).

export const WIKI_HOST = "https://en.wikipedia.org";

export type Lane = "seed" | "topic" | "trend" | "explore";
export const LANES: readonly Lane[] = ["seed", "topic", "trend", "explore"];

/** Wikipedia's article topics (the CirrusSearch articletopic: names), as chips to pick from. */
export const TOPICS = [
  { id: "space", label: "Space", emoji: "🪐" }, { id: "physics", label: "Physics", emoji: "⚛️" }, { id: "biology", label: "Biology", emoji: "🧬" },
  { id: "chemistry", label: "Chemistry", emoji: "🧪" }, { id: "mathematics", label: "Math", emoji: "📐" }, { id: "medicine-and-health", label: "Health", emoji: "🩺" },
  { id: "earth-and-environment", label: "Earth", emoji: "🌋" }, { id: "history", label: "History", emoji: "🏛️" }, { id: "military-and-warfare", label: "Wars", emoji: "⚔️" },
  { id: "biography", label: "People", emoji: "👤" }, { id: "geographical", label: "Places", emoji: "🗺️" }, { id: "architecture", label: "Architecture", emoji: "🏰" },
  { id: "visual-arts", label: "Art", emoji: "🎨" }, { id: "music", label: "Music", emoji: "🎵" }, { id: "films", label: "Movies", emoji: "🎬" },
  { id: "television", label: "TV", emoji: "📺" }, { id: "literature", label: "Books", emoji: "📚" }, { id: "video-games", label: "Video games", emoji: "🎮" },
  { id: "sports", label: "Sports", emoji: "🏀" }, { id: "food-and-drink", label: "Food", emoji: "🍜" }, { id: "technology", label: "Tech", emoji: "💡" },
  { id: "computing", label: "Computers", emoji: "💻" }, { id: "transportation", label: "Cars & planes", emoji: "✈️" }, { id: "philosophy-and-religion", label: "Big ideas", emoji: "🕊️" },
  { id: "business-and-economics", label: "Money & business", emoji: "📈" }, { id: "fashion", label: "Fashion", emoji: "👗" }, { id: "comics-and-anime", label: "Comics & anime", emoji: "💥" },
  { id: "engineering", label: "Engineering", emoji: "⚙️" },
] as const;
export type TopicId = (typeof TOPICS)[number]["id"];
const TOPIC_IDS = new Set<string>(TOPICS.map((t) => t.id));

/** What a card earns, by what happened to it. Dwell is in seconds. */
export const REWARD = {
  skip: -0.6,        // gone in under 1.5 s
  glance: 0,         // 1.5–4 s
  read: 0.4,         // 4–10 s
  dwell: 0.8,        // 10 s or more
  open: 1.5,         // opened the full article
  link: 1.2,         // followed a link inside it
  like: 2,
  save: 2.5,
  comment: 2,
  share: 3,
  nope: -3,          // "Not for me"
} as const;
export type Signal = keyof typeof REWARD;
export const dwellSignal = (secs: number): Signal => (secs < 1.5 ? "skip" : secs < 4 ? "glance" : secs < 10 ? "read" : "dwell");

export type WikiCard = {
  /** Wikipedia's page title, the card's id. */ title: string;
  description: string; extract: string;
  image?: string; imageW?: number; imageH?: number;
  url: string; lane: Lane;
  /** The seed or topic it came from. */ from?: string;
};

export type Seed = { title: string; w: number; at: number };
export type WikiProfile = {
  v: 1;
  topics: Record<string, number>;
  seeds: Seed[];
  /** Running score per lane (an average of recent rewards), so lanes that work get picked more. */
  lanes: Record<Lane, number>;
  /** Recently shown titles, newest last; nothing here is shown again. */
  seen: string[];
  liked: string[];
  saved: { title: string; description: string; image?: string; at: number }[];
  /** "Not for me": never again, and less like it. */
  nope: string[];
  matureOff?: boolean;
  /** How many signals there have been: the feed leans on what it learned more as this grows. */
  n: number;
  updatedAt: number;
};

export const LIMITS = { seen: 4000, seeds: 60, liked: 2000, saved: 2000, nope: 1000 } as const;

export function newProfile(topics: string[] = [], now = Date.now()): WikiProfile {
  const t: Record<string, number> = {};
  for (const id of topics) if (TOPIC_IDS.has(id)) t[id] = 3;
  return { v: 1, topics: t, seeds: [], lanes: { seed: 0.6, topic: 0.5, trend: 0.3, explore: 0.2 }, seen: [], liked: [], saved: [], nope: [], n: 0, updatedAt: now };
}

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, max) : "");
const titleOf = (v: unknown) => str(v, 255);
const uniqTail = (list: string[], max: number) => { const seen = new Set<string>(); const out: string[] = []; for (let i = list.length - 1; i >= 0 && out.length < max; i--) { const t = list[i]; if (t && !seen.has(t)) { seen.add(t); out.push(t); } } return out.reverse(); };

/** A saved profile made safe to use (anything missing or broken starts fresh). */
export function cleanProfile(raw: any, now = Date.now()): WikiProfile {
  if (!raw || typeof raw !== "object") return newProfile([], now);
  const topics: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw.topics || {})) if (TOPIC_IDS.has(k)) topics[k] = Math.max(-5, Math.min(20, num(v)));
  const lanes = { ...newProfile().lanes };
  for (const l of LANES) lanes[l] = Math.max(-2, Math.min(5, num(raw.lanes?.[l], lanes[l])));
  return {
    v: 1, topics, lanes,
    seeds: (Array.isArray(raw.seeds) ? raw.seeds : []).map((s: any) => ({ title: titleOf(s?.title), w: Math.max(-5, Math.min(30, num(s?.w))), at: num(s?.at, now) })).filter((s: Seed) => s.title).slice(-LIMITS.seeds),
    seen: uniqTail((Array.isArray(raw.seen) ? raw.seen : []).map(titleOf), LIMITS.seen),
    liked: uniqTail((Array.isArray(raw.liked) ? raw.liked : []).map(titleOf), LIMITS.liked),
    nope: uniqTail((Array.isArray(raw.nope) ? raw.nope : []).map(titleOf), LIMITS.nope),
    saved: (Array.isArray(raw.saved) ? raw.saved : []).map((s: any) => ({ title: titleOf(s?.title), description: str(s?.description, 300), ...(str(s?.image, 600).startsWith("https://") ? { image: str(s.image, 600) } : {}), at: num(s?.at, now) })).filter((s: any) => s.title).slice(-LIMITS.saved),
    ...(raw.matureOff === true ? { matureOff: true } : {}),
    n: Math.max(0, Math.floor(num(raw.n))), updatedAt: num(raw.updatedAt, now),
  };
}

/** Two profiles (this device's and the account's) made one: the newer wins for settings, lists are joined. */
export function mergeProfiles(a: WikiProfile, b: WikiProfile): WikiProfile {
  const [newer, older] = a.updatedAt >= b.updatedAt ? [a, b] : [b, a];
  const joinTitles = (x: string[], y: string[], max: number) => uniqTail([...y, ...x], max);
  const savedBy = new Map<string, WikiProfile["saved"][number]>();
  for (const s of [...older.saved, ...newer.saved]) savedBy.set(s.title, s);
  // A save undone on the newer device stays undone: only keep older saves the newer one never knew about.
  const newerKnows = new Set([...newer.seen, ...newer.saved.map((s) => s.title)]);
  const saved = [...savedBy.values()].filter((s) => newer.saved.some((x) => x.title === s.title) || !newerKnows.has(s.title)).sort((x, y) => x.at - y.at);
  return { ...newer, seen: joinTitles(newer.seen, older.seen, LIMITS.seen), nope: joinTitles(newer.nope, older.nope, LIMITS.nope), saved: saved.slice(-LIMITS.saved) };
}

/**
 * What happened to a card, learned: its seed and topic gain or lose weight, its lane's score moves toward the
 * reward, and a card that did well becomes a seed itself. Returns a new profile.
 */
export function learn(p: WikiProfile, card: Pick<WikiCard, "title" | "lane" | "from">, signal: Signal, now = Date.now()): WikiProfile {
  const r = REWARD[signal];
  const next: WikiProfile = { ...p, topics: { ...p.topics }, lanes: { ...p.lanes }, seeds: p.seeds.map((s) => ({ ...s })), n: p.n + 1, updatedAt: now };
  // Lane score: a moving average, so recent behaviour counts most.
  next.lanes[card.lane] = +(next.lanes[card.lane] * 0.92 + r * 0.08).toFixed(4);
  if (card.lane === "topic" && card.from && TOPIC_IDS.has(card.from)) next.topics[card.from] = Math.max(-5, Math.min(20, (next.topics[card.from] || 0) + r * 0.5));
  if (card.lane === "seed" && card.from) { const s = next.seeds.find((x) => x.title === card.from); if (s) s.w = Math.max(-5, Math.min(30, s.w + r * 0.4)); }
  // The card itself: a good one becomes (or grows as) a seed; a bad one that was a seed shrinks.
  const own = next.seeds.find((x) => x.title === card.title);
  if (r >= REWARD.read) {
    if (own) { own.w = Math.min(30, own.w + r); own.at = now; }
    else next.seeds.push({ title: card.title, w: r, at: now });
  } else if (own && r < 0) own.w += r;
  next.seeds = next.seeds.filter((s) => s.w > -2).sort((x, y) => x.at - y.at).slice(-LIMITS.seeds);
  if (signal === "nope") next.nope = uniqTail([...p.nope, card.title], LIMITS.nope);
  if (signal === "like" && !p.liked.includes(card.title)) next.liked = [...p.liked, card.title].slice(-LIMITS.liked);
  return next;
}
export const unlike = (p: WikiProfile, title: string, now = Date.now()): WikiProfile => ({ ...p, liked: p.liked.filter((t) => t !== title), updatedAt: now });
export const toggleSave = (p: WikiProfile, card: Pick<WikiCard, "title" | "description" | "image">, now = Date.now()): WikiProfile =>
  p.saved.some((s) => s.title === card.title)
    ? { ...p, saved: p.saved.filter((s) => s.title !== card.title), updatedAt: now }
    : { ...p, saved: [...p.saved, { title: card.title, description: card.description, ...(card.image ? { image: card.image } : {}), at: now }].slice(-LIMITS.saved), updatedAt: now };
export const markSeen = (p: WikiProfile, titles: string[]): WikiProfile => ({ ...p, seen: uniqTail([...p.seen, ...titles], LIMITS.seen) });

// ── Choosing what comes next ────────────────────────────────────────────────

/** A seeded random number generator, so a pick can be tested. */
export function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/** How strongly each lane is wanted now: its score, softened, with floors so every lane keeps a share. */
export function laneOdds(p: WikiProfile): Record<Lane, number> {
  const exp = (x: number) => Math.exp(Math.max(-3, Math.min(3, x)) * 1.2);
  const hasSeeds = p.seeds.some((s) => s.w > 0), hasTopics = Object.values(p.topics).some((w) => w > 0);
  // New to it: mostly topics, trending and discovery. As signals add up, the learned lanes take over.
  const learned = Math.min(1, p.n / 40);
  const raw: Record<Lane, number> = {
    seed: hasSeeds ? exp(p.lanes.seed) * (0.4 + learned) : 0,
    topic: hasTopics ? exp(p.lanes.topic) * (0.9 - learned * 0.3) : 0,
    trend: exp(p.lanes.trend) * 0.45,
    explore: exp(p.lanes.explore) * 0.35,
  };
  const total = Object.values(raw).reduce((a, b) => a + b, 0) || 1;
  const odds = {} as Record<Lane, number>;
  for (const l of LANES) odds[l] = raw[l] / total;
  // Floors: discovery never stops (or the feed narrows into a rut), and trending keeps it fresh. The lanes under
  // their floor are raised to it; the others share what's left in their own proportions.
  const FLOOR: Partial<Record<Lane, number>> = { explore: 0.1, trend: 0.06 };
  const low = LANES.filter((l) => FLOOR[l] !== undefined && odds[l] < FLOOR[l]!);
  if (low.length) {
    const fixed = low.reduce((a, l) => a + FLOOR[l]!, 0);
    const others = LANES.filter((l) => !low.includes(l));
    const left = others.reduce((a, l) => a + odds[l], 0) || 1;
    for (const l of low) odds[l] = FLOOR[l]!;
    for (const l of others) odds[l] = (odds[l] / left) * (1 - fixed);
  }
  return odds;
}
export function pickLane(p: WikiProfile, rand: () => number): Lane {
  const odds = laneOdds(p);
  let x = rand();
  for (const l of LANES) { if ((x -= odds[l]) <= 0) return l; }
  return "explore";
}
/** The seed to look for more like: weighted by its weight and how recent it is. */
export function pickSeed(p: WikiProfile, rand: () => number, now = Date.now()): string | null {
  const live = p.seeds.filter((s) => s.w > 0).map((s) => ({ s, w: s.w * Math.pow(0.5, (now - s.at) / (14 * 86_400_000)) }));
  const total = live.reduce((a, b) => a + b.w, 0);
  if (!total) return null;
  let x = rand() * total;
  for (const { s, w } of live) { if ((x -= w) <= 0) return s.title; }
  return live[live.length - 1].s.title;
}
export function pickTopic(p: WikiProfile, rand: () => number): string | null {
  const live = Object.entries(p.topics).filter(([, w]) => w > 0);
  const total = live.reduce((a, [, w]) => a + w, 0);
  if (!total) return null;
  let x = rand() * total;
  for (const [t, w] of live) { if ((x -= w) <= 0) return t; }
  return live[live.length - 1][0];
}

// ── Wikipedia requests and answers ──────────────────────────────────────────

const PROPS = "prop=extracts|pageimages|description|info|pageprops&exintro=1&explaintext=1&exchars=700&exlimit=max&piprop=thumbnail&pithumbsize=900&pilimit=max&inprop=url&ppprop=disambiguation";
const api = (q: string) => `${WIKI_HOST}/w/api.php?action=query&format=json&formatversion=2&origin=*&redirects=1&${PROPS}&${q}`;
/** The request for a batch of cards from one lane. */
export function laneUrl(lane: Lane, from: string | null, rand: () => number): string {
  if (lane === "seed" && from) return api(`generator=search&gsrnamespace=0&gsrlimit=12&gsroffset=${Math.floor(rand() * 4) * 12}&gsrsearch=${encodeURIComponent(`morelike:${from}`)}`);
  if (lane === "topic" && from) return api(`generator=search&gsrnamespace=0&gsrlimit=12&gsrsort=random&gsrsearch=${encodeURIComponent(`articletopic:${from} -intitle:List`)}`);
  return api("generator=random&grnnamespace=0&grnlimit=20");
}
/** Today's most-read articles (for the trend lane): the titles, from Wikipedia's featured feed. */
export const trendUrl = (day: Date) => `https://en.wikipedia.org/api/rest_v1/feed/featured/${day.getUTCFullYear()}/${String(day.getUTCMonth() + 1).padStart(2, "0")}/${String(day.getUTCDate()).padStart(2, "0")}`;
export const titlesUrl = (titles: string[]) => api(`titles=${titles.slice(0, 20).map(encodeURIComponent).join("|")}`);
export const searchUrl = (q: string) => api(`generator=search&gsrnamespace=0&gsrlimit=20&gsrsearch=${encodeURIComponent(q)}`);
/** The full article, as Wikipedia's mobile HTML. */
export const articleUrl = (title: string) => `${WIKI_HOST}/w/api.php?action=parse&format=json&formatversion=2&origin=*&redirects=1&prop=text|displaytitle&mobileformat=1&disableeditsection=1&disabletoc=1&page=${encodeURIComponent(title)}`;
export const pageUrl = (title: string) => `${WIKI_HOST}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

/** Words that keep an article out while the mature-topics filter is on (title, description or opening). */
const MATURE = /\b(porn\w*|pornograph\w*|sex(ual(ity)?|ually)? (act|position|intercourse|toy)s?|erotic\w*|nudity|nude|fetish\w*|bdsm|hentai|prostitut\w*|escort agenc\w*|strip club|onlyfans|masturbat\w*|orgasm\w*|genital\w*|incest|rape|sexual (abuse|assault|violence)|child (sexual|abuse)|suicide method\w*|self-harm|beheading|torture method\w*|snuff|gore film|serial kill\w*|mass shooting|cannibal\w*|necrophil\w*|bestiality|zoophil\w*|drug (use|injection)|heroin|methamphetamine|cocaine)\b/i;
export const isMature = (c: Pick<WikiCard, "title" | "description" | "extract">) => MATURE.test(`${c.title} ${c.description} ${c.extract.slice(0, 400)}`);

/** Wikipedia's answer made into cards: stubs, lists, disambiguation pages, already-seen and "not for me" left out. */
export function toCards(json: any, lane: Lane, from: string | undefined, p: Pick<WikiProfile, "seen" | "nope" | "matureOff">): WikiCard[] {
  const pages: any[] = Array.isArray(json?.query?.pages) ? json.query.pages : [];
  const skip = new Set([...p.seen, ...p.nope]);
  const order = (x: any) => num(x?.index, 0);
  return pages.slice().sort((a, b) => order(a) - order(b)).flatMap((pg): WikiCard[] => {
    const title = titleOf(pg?.title);
    const extract = str(pg?.extract, 900).replace(/\s*\n+\s*/g, "\n");
    if (!title || pg?.missing || pg?.ns !== 0 || pg?.pageprops?.disambiguation !== undefined) return [];
    if (/^(List|Lists|Index|Outline|Timeline) of /i.test(title) || /\(disambiguation\)$/i.test(title)) return [];
    if (extract.length < 140 || skip.has(title)) return [];
    const card: WikiCard = { title, description: str(pg?.description, 200), extract, url: str(pg?.fullurl, 600) || pageUrl(title), lane, ...(from ? { from } : {}) };
    const t = pg?.thumbnail;
    if (typeof t?.source === "string" && t.source.startsWith("https://")) { card.image = t.source; card.imageW = num(t.width) || undefined; card.imageH = num(t.height) || undefined; }
    if (!p.matureOff && isMature(card)) return [];
    return [card];
  });
}
/** The titles in Wikipedia's featured feed answer (most read today, then the day's featured article). */
export function trendTitles(json: any): string[] {
  const most = Array.isArray(json?.mostread?.articles) ? json.mostread.articles : [];
  const out = [str(json?.tfa?.title, 255), ...most.map((a: any) => str(a?.title, 255))].filter((t) => t && !/^(Main_Page|Special:|Wikipedia:|File:|Portal:)/.test(t));
  return [...new Set(out.map((t) => t.replace(/_/g, " ")))];
}

/**
 * Cards from different lanes woven together so the feed doesn't come in clumps: at most two in a row from one lane
 * or one seed, and an article with a picture every few cards when there is one.
 */
export function weave(pool: WikiCard[], take: number): { out: WikiCard[]; rest: WikiCard[] } {
  const rest = pool.slice();
  const out: WikiCard[] = [];
  while (out.length < take && rest.length) {
    const a = out[out.length - 1], b = out[out.length - 2];
    const clumped = (c: WikiCard) => !!a && !!b && ((a.lane === c.lane && b.lane === c.lane) || (!!c.from && a.from === c.from && b.from === c.from));
    const noPics = out.length >= 2 && !out.slice(-2).some((c) => c.image);
    let i = rest.findIndex((c) => !clumped(c) && (!noPics || !!c.image));
    if (i < 0) i = rest.findIndex((c) => !clumped(c));
    if (i < 0) i = 0;
    out.push(rest.splice(i, 1)[0]);
  }
  return { out, rest };
}

export const short = (n: number) => (n < 1000 ? String(n) : n < 1e6 ? `${(n / 1000).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, "")}K` : `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`);
