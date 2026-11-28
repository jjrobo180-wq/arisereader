// Arise Wiki (LifeHub section "wiki", client/src/components/family-hub/WikiFeed.tsx): every Wikipedia article as an
// endless, full-screen swipe feed that learns what you like.
//
// How it learns (all here, pure, tested in tests/wiki-feed.test.ts):
//   • Every card is watched: how long it stayed on screen, whether it was opened, liked, saved, shared, commented on,
//     or marked "not for me". Each becomes a reward (REWARD below).
//   • An article that did well becomes a SEED: later cards come from Wikipedia's own "more like this" search on it
//     (CirrusSearch morelike:), so the feed drifts toward what holds you. Seeds fade with time and with skips.
//   • TOPICS (Wikipedia's article topics: space, music, history…) are weighted the same way, from the chips picked
//     at the start and from how cards from each topic do.
//   • SEARCHES teach it too: what you look up is kept (with a weight that grows with each search and with how the
//     results do) and its top article becomes a seed. A search opens its own swipe feed (searchFeed below).
//   • Each topic has SUBTOPICS (History → World War II, Ancient Rome…): picking one makes its article a seed.
//   • Cards come from five LANES: more like your seeds, your topics, your searches, what the world is reading today, and
//     discovery (random articles). Each lane keeps a running score of how its cards do, and the next card's lane is
//     drawn in proportion to those scores (with a floor, so discovery never stops). The more you use it, the more
//     it leans on what works for you.
//   • Nothing is shown twice (the last 4,000 cards are remembered), and stubs, lists and disambiguation pages are
//     left out. A mature-topics filter is on by default.
// Cards are fetched straight from Wikipedia's public API (CORS, origin=*), so nothing goes through Arise's server
// but likes counts and comments (server/wikiFeed.ts).

export const WIKI_HOST = "https://en.wikipedia.org";

export type Lane = "seed" | "topic" | "search" | "trend" | "explore";
export const LANES: readonly Lane[] = ["seed", "topic", "search", "trend", "explore"];

/** Wikipedia's article topics (the CirrusSearch articletopic: names), as chips to pick from. */
export const TOPICS = [
  { id: "space", label: "Space" }, { id: "physics", label: "Physics" }, { id: "biology", label: "Biology" },
  { id: "chemistry", label: "Chemistry" }, { id: "mathematics", label: "Math" }, { id: "medicine-and-health", label: "Health" },
  { id: "earth-and-environment", label: "Earth" }, { id: "history", label: "History" }, { id: "military-and-warfare", label: "Wars" },
  { id: "biography", label: "People" }, { id: "geographical", label: "Places" }, { id: "architecture", label: "Architecture" },
  { id: "visual-arts", label: "Art" }, { id: "music", label: "Music" }, { id: "films", label: "Movies" },
  { id: "television", label: "TV" }, { id: "literature", label: "Books" }, { id: "video-games", label: "Video games" },
  { id: "sports", label: "Sports" }, { id: "food-and-drink", label: "Food" }, { id: "technology", label: "Tech" },
  { id: "computing", label: "Computers" }, { id: "transportation", label: "Cars & planes" }, { id: "philosophy-and-religion", label: "Big ideas" },
  { id: "business-and-economics", label: "Money & business" }, { id: "fashion", label: "Fashion" }, { id: "comics-and-anime", label: "Comics & anime" },
  { id: "engineering", label: "Engineering" },
] as const;
export type TopicId = (typeof TOPICS)[number]["id"];
const TOPIC_IDS = new Set<string>(TOPICS.map((t) => t.id));

/** What's inside each topic, as the Wikipedia article each one starts from (it becomes a seed when picked). */
export const SUBTOPICS: Record<TopicId, string[]> = {
  space: ["Black hole", "Mars", "Solar System", "Apollo 11", "International Space Station", "Galaxy", "Exoplanet", "James Webb Space Telescope"],
  physics: ["Quantum mechanics", "Theory of relativity", "Albert Einstein", "Nuclear fission", "Speed of light", "Dark matter", "Electricity", "Isaac Newton"],
  biology: ["Evolution", "DNA", "Dinosaur", "Shark", "Human brain", "Octopus", "Virus", "Rainforest"],
  chemistry: ["Periodic table", "Atom", "Chemical reaction", "Marie Curie", "Carbon", "Acid", "Polymer", "Crystal"],
  mathematics: ["Pi", "Prime number", "Infinity", "Fibonacci sequence", "Geometry", "Probability", "Golden ratio", "Cryptography"],
  "medicine-and-health": ["Heart", "Immune system", "Sleep", "Vaccine", "Penicillin", "Nutrition", "Exercise", "Cancer"],
  "earth-and-environment": ["Volcano", "Earthquake", "Tropical cyclone", "Climate change", "Ocean", "Mount Everest", "Plate tectonics", "Tornado"],
  history: ["World War II", "Ancient Rome", "Ancient Egypt", "Civil rights movement", "Cold War", "Middle Ages", "American Revolution", "Vikings"],
  "military-and-warfare": ["World War I", "Normandy landings", "American Civil War", "Battle of Gettysburg", "Samurai", "Napoleon", "Aircraft carrier", "United States Navy SEALs"],
  biography: ["Martin Luther King Jr.", "Abraham Lincoln", "Leonardo da Vinci", "Harriet Tubman", "Nelson Mandela", "Cleopatra", "Steve Jobs", "Frederick Douglass"],
  geographical: ["Japan", "Grand Canyon", "Amazon rainforest", "Antarctica", "New York City", "Sahara", "Great Barrier Reef", "Iceland"],
  architecture: ["Great Wall of China", "Egyptian pyramids", "Skyscraper", "Colosseum", "Taj Mahal", "Burj Khalifa", "Machu Picchu", "Gothic architecture"],
  "visual-arts": ["Vincent van Gogh", "Mona Lisa", "Pablo Picasso", "Frida Kahlo", "Street art", "Photography", "Michelangelo", "Graffiti"],
  music: ["Hip hop music", "Jazz", "Michael Jackson", "The Beatles", "Gospel music", "Rhythm and blues", "Beyoncé", "Motown"],
  films: ["Star Wars", "Marvel Cinematic Universe", "Pixar", "Academy Awards", "Alfred Hitchcock", "Horror film", "Denzel Washington", "Animation"],
  television: ["The Simpsons", "SpongeBob SquarePants", "Breaking Bad", "Saturday Night Live", "Reality television", "Sitcom", "Game of Thrones", "The Office (American TV series)"],
  literature: ["Harry Potter", "William Shakespeare", "Maya Angelou", "Toni Morrison", "Greek mythology", "The Lord of the Rings", "Edgar Allan Poe", "Poetry"],
  "video-games": ["Minecraft", "Fortnite", "Super Mario", "The Legend of Zelda", "Pokémon", "Esports", "Nintendo", "Grand Theft Auto"],
  sports: ["National Basketball Association", "LeBron James", "Michael Jordan", "National Football League", "Serena Williams", "FIFA World Cup", "Olympic Games", "Muhammad Ali"],
  "food-and-drink": ["Pizza", "Barbecue", "Chocolate", "Coffee", "Sushi", "Soul food", "Taco", "Hot sauce"],
  technology: ["Artificial intelligence", "Smartphone", "Electric vehicle", "Internet", "Robot", "3D printing", "Nikola Tesla", "Thomas Edison"],
  computing: ["Computer programming", "Apple Inc.", "Google", "Computer security", "Bitcoin", "Linux", "Alan Turing", "Microsoft"],
  transportation: ["Formula One", "Tesla, Inc.", "Boeing 747", "High-speed rail", "Titanic", "Wright brothers", "Lamborghini", "Harley-Davidson"],
  "philosophy-and-religion": ["Christianity", "Bible", "Jesus", "Stoicism", "Buddhism", "Islam", "Socrates", "Ten Commandments"],
  "business-and-economics": ["Stock market", "Warren Buffett", "Amazon (company)", "Great Depression", "Cryptocurrency", "Inflation", "Nike, Inc.", "Entrepreneurship"],
  fashion: ["Sneakers", "Air Jordan", "Streetwear", "Jeans", "Hip hop fashion", "Coco Chanel", "Supreme (brand)", "Tattoo"],
  "comics-and-anime": ["Spider-Man", "Batman", "Naruto", "Dragon Ball", "One Piece", "Black Panther (character)", "Studio Ghibli", "Superman"],
  engineering: ["Bridge", "Golden Gate Bridge", "Hoover Dam", "Rocket", "Panama Canal", "Nuclear power", "Roller coaster", "Eiffel Tower"],
};
/** A subtopic's chip label: the title without a disambiguating "(…)". */
export const subLabel = (title: string) => title.replace(/\s*\([^)]*\)\s*$/, "");

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
  /** Opened by tapping a link on this article's card. */ linkedFrom?: string;
  /** The seed or topic it came from. */ from?: string;
};

export type Seed = { title: string; w: number; at: number };
export type SearchTerm = { q: string; w: number; at: number };
export type WikiProfile = {
  v: 1;
  topics: Record<string, number>;
  seeds: Seed[];
  /** What you've searched for, weighted like seeds. */
  searches: SearchTerm[];
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

export const LIMITS = { seen: 4000, seeds: 60, searches: 40, liked: 2000, saved: 2000, nope: 1000 } as const;

export function newProfile(topics: string[] = [], now = Date.now(), seeds: string[] = []): WikiProfile {
  const t: Record<string, number> = {};
  for (const id of topics) if (TOPIC_IDS.has(id)) t[id] = 3;
  return { v: 1, topics: t, seeds: seeds.slice(0, LIMITS.seeds).map((title) => ({ title, w: 4, at: now })), searches: [], lanes: { seed: 0.6, topic: 0.5, search: 0.6, trend: 0.3, explore: 0.2 }, seen: [], liked: [], saved: [], nope: [], n: 0, updatedAt: now };
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
    searches: (Array.isArray(raw.searches) ? raw.searches : []).map((s: any) => ({ q: str(s?.q, 120), w: Math.max(-5, Math.min(30, num(s?.w))), at: num(s?.at, now) })).filter((s: SearchTerm) => s.q).slice(-LIMITS.searches),
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
  next.searches = p.searches.map((x) => ({ ...x }));
  if (card.lane === "search" && card.from) { const q = next.searches.find((x) => x.q.toLowerCase() === card.from!.toLowerCase()); if (q) q.w = Math.max(-5, Math.min(30, q.w + r * 0.4)); }
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
/** A search: kept (or strengthened) as a search term, and its top article becomes a strong seed. */
export function learnSearch(p: WikiProfile, q: string, top: string | null, now = Date.now()): WikiProfile {
  const term = q.trim().slice(0, 120);
  if (!term) return p;
  const searches = p.searches.filter((x) => x.q.toLowerCase() !== term.toLowerCase());
  const old = p.searches.find((x) => x.q.toLowerCase() === term.toLowerCase());
  searches.push({ q: term, w: Math.min(30, (old?.w ?? 0) + 4), at: now });
  let seeds = p.seeds.map((s) => ({ ...s }));
  if (top) { const s = seeds.find((x) => x.title === top); if (s) { s.w = Math.min(30, s.w + 3); s.at = now; } else seeds.push({ title: top, w: 4, at: now }); }
  seeds = seeds.sort((x, y) => x.at - y.at).slice(-LIMITS.seeds);
  return { ...p, searches: searches.slice(-LIMITS.searches), seeds, n: p.n + 1, updatedAt: now };
}
/** A subtopic tapped (or picked at the start): its article becomes a strong seed. */
export function learnSubtopic(p: WikiProfile, title: string, now = Date.now()): WikiProfile {
  const w = Math.min(30, (p.seeds.find((s) => s.title === title)?.w ?? 0) + 4);
  return { ...p, seeds: [...p.seeds.filter((s) => s.title !== title), { title, w, at: now }].slice(-LIMITS.seeds), n: p.n + 1, updatedAt: now };
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
  const hasSeeds = p.seeds.some((s) => s.w > 0), hasTopics = Object.values(p.topics).some((w) => w > 0), hasSearches = p.searches.some((s) => s.w > 0);
  // New to it: mostly topics, trending and discovery. As signals add up, the learned lanes take over.
  const learned = Math.min(1, p.n / 40);
  const raw: Record<Lane, number> = {
    seed: hasSeeds ? exp(p.lanes.seed) * (0.4 + learned) : 0,
    topic: hasTopics ? exp(p.lanes.topic) * (0.9 - learned * 0.3) : 0,
    search: hasSearches ? exp(p.lanes.search) * 0.7 : 0,
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
export function pickSearch(p: WikiProfile, rand: () => number, now = Date.now()): string | null {
  const live = p.searches.filter((s) => s.w > 0).map((s) => ({ s, w: s.w * Math.pow(0.5, (now - s.at) / (10 * 86_400_000)) }));
  const total = live.reduce((a, b) => a + b.w, 0);
  if (!total) return null;
  let x = rand() * total;
  for (const { s, w } of live) { if ((x -= w) <= 0) return s.q; }
  return live[live.length - 1].s.q;
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
const search = (q: string, offset: number) => api(`generator=search&gsrnamespace=0&gsrlimit=20&gsroffset=${offset}&gsrsearch=${encodeURIComponent(q)}`);
// A topic with no other words is ranked by how well-known and well-linked its articles are, so a random spot in its
// top ~1,500 gives real articles, not stubs.
const topicQuery = (id: string) => `articletopic:${id} -intitle:List -intitle:Timeline`;
export function laneUrl(lane: Lane, from: string | null, rand: () => number): string {
  if (lane === "seed" && from) return search(`morelike:${from}`, Math.floor(rand() * 3) * 20);
  if (lane === "topic" && from) return search(topicQuery(from), Math.floor(rand() * 75) * 20);
  if (lane === "search" && from) return search(from, Math.floor(rand() * 4) * 20);
  // Discovery: mostly a random topic's well-known articles, sometimes a truly random one.
  if (rand() < 0.65) return search(topicQuery(TOPICS[Math.floor(rand() * TOPICS.length)].id), Math.floor(rand() * 50) * 20);
  return api("generator=random&grnnamespace=0&grnlimit=20");
}
/** A search's own feed: its results page by page (in Wikipedia's order, best first). */
export const searchPageUrl = (q: string, page: number) => search(q, page * 20);
/** More like one article, page by page. */
export const relatedUrl = (title: string, page: number) => search(`morelike:${title}`, page * 20);
/** Title suggestions as you type. */
export const suggestUrl = (q: string) => `${WIKI_HOST}/w/api.php?action=opensearch&format=json&origin=*&namespace=0&limit=8&search=${encodeURIComponent(q)}`;
export const suggestions = (json: any): string[] => (Array.isArray(json?.[1]) ? json[1].filter((t: unknown) => typeof t === "string").slice(0, 8) : []);
/** The smallest article (in bytes) each lane keeps, so the feed isn't full of stubs. Searches keep everything. */
export const MIN_BYTES: Record<Lane, number> = { seed: 2500, topic: 6000, search: 0, trend: 0, explore: 7000 };
/** Today's most-read articles (for the trend lane): the titles, from Wikipedia's featured feed. */
export const trendUrl = (day: Date) => `https://en.wikipedia.org/api/rest_v1/feed/featured/${day.getUTCFullYear()}/${String(day.getUTCMonth() + 1).padStart(2, "0")}/${String(day.getUTCDate()).padStart(2, "0")}`;
export const titlesUrl = (titles: string[]) => api(`titles=${titles.slice(0, 20).map(encodeURIComponent).join("|")}`);
/** The full article's HTML (the desktop version: the mobile one hides pictures behind placeholders). */
export const articleUrl = (title: string) => `${WIKI_HOST}/w/api.php?action=parse&format=json&formatversion=2&origin=*&redirects=1&prop=text|displaytitle&disableeditsection=1&disablelimitreport=1&disabletoc=1&page=${encodeURIComponent(title)}`;
export const pageUrl = (title: string) => `${WIKI_HOST}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

/** Words that keep an article out while the mature-topics filter is on (title, description or opening). */
const MATURE = /\b(porn\w*|pornograph\w*|sex(ual(ity)?|ually)? (act|position|intercourse|toy)s?|erotic\w*|nudity|nude|fetish\w*|bdsm|hentai|prostitut\w*|escort agenc\w*|strip club|onlyfans|masturbat\w*|orgasm\w*|genital\w*|incest|rape|sexual (abuse|assault|violence)|child (sexual|abuse)|suicide method\w*|self-harm|beheading|torture method\w*|snuff|gore film|serial kill\w*|mass shooting|cannibal\w*|necrophil\w*|bestiality|zoophil\w*|drug (use|injection)|heroin|methamphetamine|cocaine)\b/i;
export const isMature = (c: Pick<WikiCard, "title" | "description" | "extract">) => MATURE.test(`${c.title} ${c.description} ${c.extract.slice(0, 400)}`);

/** Wikipedia's answer made into cards: stubs, lists, disambiguation pages, already-seen and "not for me" left out. */
export function toCards(json: any, lane: Lane, from: string | undefined, p: Pick<WikiProfile, "seen" | "nope" | "matureOff">, minBytes = MIN_BYTES[lane]): WikiCard[] {
  const pages: any[] = Array.isArray(json?.query?.pages) ? json.query.pages : [];
  const skip = new Set([...p.seen, ...p.nope]);
  const order = (x: any) => num(x?.index, 0);
  return pages.slice().sort((a, b) => order(a) - order(b)).flatMap((pg): WikiCard[] => {
    const title = titleOf(pg?.title);
    const extract = str(pg?.extract, 900).replace(/\s*\n+\s*/g, "\n");
    if (!title || pg?.missing || pg?.ns !== 0 || pg?.pageprops?.disambiguation !== undefined) return [];
    if (/^(List|Lists|Index|Outline|Timeline) of /i.test(title) || /\(disambiguation\)$/i.test(title)) return [];
    if (extract.length < 140 || skip.has(title)) return [];
    if (typeof pg?.length === "number" && pg.length < minBytes) return [];
    const card: WikiCard = { title, description: str(pg?.description, 200), extract, url: str(pg?.fullurl, 600) || pageUrl(title), lane, ...(from ? { from } : {}) };
    const t = pg?.thumbnail;
    if (typeof t?.source === "string" && t.source.startsWith("https://") && !boringImage(t.source)) { card.image = t.source; card.imageW = num(t.width) || undefined; card.imageH = num(t.height) || undefined; }
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

/** A search or subtopic feed: two of what you asked for, then one related, in order (no shuffling: best first). */
export function interleave(primary: WikiCard[], related: WikiCard[]): WikiCard[] {
  const out: WikiCard[] = [], seen = new Set<string>();
  const add = (c: WikiCard | undefined) => { if (c && !seen.has(c.title)) { seen.add(c.title); out.push(c); } };
  let i = 0, j = 0;
  while (i < primary.length || j < related.length) { add(primary[i++]); add(primary[i++]); add(related[j++]); }
  return out;
}


// ── Reading an article on its cards ─────────────────────────────────────────
// A card is the article itself: its picture, title and opening, then swipe sideways for the rest, page after page.
// Only what's worth reading goes on the pages: prose, short lists and real photos. Tables, infoboxes, charts, maps,
// diagrams, flags, logos, references and "See also"-type sections are left out.

/** Sections that are lists of sources or links, not reading. */
export const SKIP_SECTIONS = /^(see also|references|notes|notes and references|references and notes|external links|further reading|bibliography|select(ed)? bibliography|sources|citations|footnotes|explanatory notes|works cited|general (and cited )?references|gallery|images|discography|filmography|videography|bibliography and filmography|awards and nominations|awards|accolades|honou?rs|track listing|personnel|credits|career statistics|statistics|records|works|publications|list of works|selected works|charts|weekly charts|year-end charts|certifications|tour dates|box office|release history|episodes|cast|results|standings|medal table|squad|roster|demographics|climate|geography and climate)$/i;
export const skipSection = (heading: string) => SKIP_SECTIONS.test(heading.replace(/\s+/g, " ").trim());
/** Pictures that are data, not something to look at. */
export const BORING_IMAGE = /(\b|_)(graph|graphs|chart|charts|plot|diagram|map|maps|locator|distribution|population|percent|statistics?|logo|wordmark|signature|coat[ _]of[ _]arms|flag[ _]of|seal[ _]of|emblem|infographic|schematic|blank)(\b|_|\.)/i;
export const boringImage = (srcOrCaption: string) => BORING_IMAGE.test(srcOrCaption) || /\.svg(\.png)?$/i.test(srcOrCaption.split("?")[0]);

/** One piece of an article: a heading, a paragraph (or part of one), a list item, or a photo. html is already safe. */
export type Block = { kind: "h" | "p" | "li" | "img"; html: string; text: number; src?: string; caption?: string };

/** How much a block takes up on a page, in characters. */
export const weight = (b: Block, budget: number) => (b.kind === "h" ? 90 : b.kind === "img" ? Math.round(budget * 0.5) : b.kind === "li" ? b.text + 30 : b.text + 20);

/**
 * The article's blocks laid out as pages: the first page (under the card's picture and title) holds firstBudget
 * characters, the rest budget each. A heading never ends a page (it moves with what it heads), and a page has at
 * most one photo. At most maxPages pages.
 */
export function paginate(blocks: Block[], firstBudget: number, budget: number, maxPages = 80): Block[][] {
  const pages: Block[][] = [];
  let cur: Block[] = [], used = 0, cap = Math.max(120, firstBudget);
  const flush = () => { if (cur.length) { pages.push(cur); cur = []; used = 0; cap = budget; } };
  for (let i = 0; i < blocks.length && pages.length < maxPages; i++) {
    const b = blocks[i];
    // The first page already has the card's picture; after that, one photo a page.
    if (b.kind === "img" && (pages.length === 0 || cur.some((x) => x.kind === "img"))) continue;
    let w = weight(b, budget);
    if (b.kind === "h") { const next = blocks[i + 1]; if (next) w += Math.min(weight(next, budget), budget * 0.3); }
    if (used + w > cap && cur.length) flush();
    // A photo that won't fit beside what's on a page waits for a page of its own (it's dropped if the page is full).
    if (b.kind === "img" && used + weight(b, budget) > cap) continue;
    cur.push(b);
    used += weight(b, budget);
  }
  if (pages.length < maxPages) flush();
  // A heading never ends a page: it moves to the top of the next one (or goes, at the very end).
  for (let i = 0; i < pages.length; i++) {
    while (pages[i].length && pages[i][pages[i].length - 1].kind === "h") { const h = pages[i].pop()!; if (pages[i + 1]) pages[i + 1].unshift(h); }
  }
  return pages.filter((pg) => pg.length);
}

/** How many characters fit in a text area this big (17px type, 1.6 line height). */
export function budgetFor(width: number, height: number) {
  const perLine = Math.max(20, width / 8.6), lines = Math.max(3, height / 27.5);
  return Math.floor(perLine * lines * 0.8);
}
