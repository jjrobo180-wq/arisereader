// Mindset: the self-help plugin (client/src/components/family-hub/Mindset.tsx). A questionnaire shapes a
// full-screen swipe feed of quotes, advice, affirmations, prompts, challenges, lessons and, for people who want
// them, Bible verses and stories (shared/mindsetContent.ts). Alongside it: a dream board, a wins log, reflections,
// saved cards, and an honest look at progress (minutes, streak, badges). Saved in the LifeHub family as
// `mindset`; nothing is set until the questionnaire is done.
import {
  ADVICE, AFFIRMATIONS, BIBLE_STORIES, CHALLENGES, LESSONS, LIFE_STORIES, PROMPTS, QUOTES, TOPICS, VERSES,
  type Advice, type Challenge, type Lesson, type Line, type Quote, type Story, type Topic, type Verse,
} from "./mindsetContent";

export type Kind = "quote" | "verse" | "story" | "advice" | "affirmation" | "prompt" | "challenge" | "lesson" | "breathe";
export const KINDS: { id: Kind; name: string; emoji: string; blurb: string; faith?: boolean }[] = [
  { id: "quote", name: "Quotes", emoji: "💬", blurb: "Words from people who lived it" },
  { id: "advice", name: "Advice", emoji: "🧭", blurb: "Clear, practical life advice" },
  { id: "affirmation", name: "Affirmations", emoji: "✨", blurb: "Things to say until you believe them" },
  { id: "lesson", name: "Mind lessons", emoji: "🧠", blurb: "Big ideas from psychology and philosophy" },
  { id: "story", name: "Stories", emoji: "📖", blurb: "True stories of people who kept going" },
  { id: "prompt", name: "Reflection", emoji: "✍️", blurb: "Questions that make you think" },
  { id: "challenge", name: "Challenges", emoji: "🎯", blurb: "Small dares to do today" },
  { id: "breathe", name: "Breathing", emoji: "🌬️", blurb: "One-minute resets" },
  { id: "verse", name: "Bible verses", emoji: "✝️", blurb: "Scripture for what you're facing", faith: true },
];
export const TONES = [
  { id: "gentle", name: "Gentle", emoji: "🤍", blurb: "Kind and encouraging" },
  { id: "tough", name: "Tough love", emoji: "🔥", blurb: "Direct, no excuses" },
  { id: "wise", name: "Wise", emoji: "🦉", blurb: "Thoughtful and deep" },
  { id: "practical", name: "Practical", emoji: "🛠️", blurb: "Just tell me what to do" },
  { id: "mix", name: "A mix", emoji: "🎲", blurb: "Some of everything" },
] as const;
export type Tone = (typeof TONES)[number]["id"];
export const SEASONS = [
  { id: "thriving", name: "Doing great, want more", emoji: "🚀" },
  { id: "okay", name: "Doing okay", emoji: "🙂" },
  { id: "stuck", name: "Feeling stuck", emoji: "🧱" },
  { id: "hard", name: "Going through something hard", emoji: "🌧️" },
] as const;
export type Season = (typeof SEASONS)[number]["id"];
export type Faith = "christian" | "spiritual" | "none";

export type MindProfile = {
  name: string; goals: Topic[]; season: Season; faith: Faith; bible: boolean; tone: Tone; kinds: Kind[]; minutes: number; why: string; startedAt: string;
};
export type Dream = { id: string; title: string; emoji: string; color: string; cat: string; why: string; target: string; steps: { id: string; text: string; done: boolean }[]; done: string; at: string };
export type Win = { id: string; date: string; title: string; emoji: string; cat: string };
export type Reflection = { id: string; date: string; prompt: string; text: string };
export type MindDay = { date: string; secs: number; cards: number; affirm: number };
export type ChallengeDay = { date: string; id: string; done: boolean };
export type MindsetData = {
  profile: MindProfile; likes: string[]; seen: string[]; dreams: Dream[]; wins: Win[]; reflections: Reflection[];
  days: MindDay[]; challenges: ChallengeDay[]; intentions: { date: string; text: string }[];
};

export const MIND_LIMITS = { likes: 1500, seen: 700, dreams: 120, wins: 3000, reflections: 2000, days: 1500, challenges: 1500, intentions: 1000, steps: 30 };
export const DREAM_COLORS = ["#7c5cff", "#ff6b8a", "#ffb020", "#22c55e", "#06b6d4", "#3b82f6", "#ec4899", "#f97316", "#14b8a6", "#a855f7", "#ef4444", "#0f172a"];
export const DREAM_CATS = [
  { id: "travel", name: "Travel", emoji: "✈️" }, { id: "home", name: "Home", emoji: "🏡" }, { id: "career", name: "Career", emoji: "💼" },
  { id: "money", name: "Money", emoji: "💰" }, { id: "health", name: "Health", emoji: "💪" }, { id: "love", name: "Love & family", emoji: "❤️" },
  { id: "learn", name: "Learning", emoji: "🎓" }, { id: "create", name: "Create", emoji: "🎨" }, { id: "faith", name: "Faith", emoji: "🙏" },
  { id: "give", name: "Giving back", emoji: "🤲" }, { id: "adventure", name: "Adventure", emoji: "🏔️" }, { id: "self", name: "Me", emoji: "🌱" },
];
export const DREAM_IDEAS: { title: string; emoji: string; cat: string }[] = [
  { title: "Visit Japan", emoji: "🗾", cat: "travel" }, { title: "Own my own home", emoji: "🏡", cat: "home" }, { title: "Run a half marathon", emoji: "🏃", cat: "health" },
  { title: "Be completely debt free", emoji: "🧾", cat: "money" }, { title: "Start my own business", emoji: "🚀", cat: "career" }, { title: "Save a year of expenses", emoji: "🏦", cat: "money" },
  { title: "Write a book", emoji: "📚", cat: "create" }, { title: "Learn a new language", emoji: "🗣️", cat: "learn" }, { title: "Take my family to the beach", emoji: "🏖️", cat: "love" },
  { title: "Get promoted", emoji: "📈", cat: "career" }, { title: "See the Northern Lights", emoji: "🌌", cat: "adventure" }, { title: "Lose the weight for good", emoji: "⚖️", cat: "health" },
  { title: "Read the whole Bible", emoji: "📖", cat: "faith" }, { title: "Go on a mission trip", emoji: "🌍", cat: "faith" }, { title: "Pay off my car", emoji: "🚗", cat: "money" },
  { title: "Finish my degree", emoji: "🎓", cat: "learn" }, { title: "Volunteer every month", emoji: "🤲", cat: "give" }, { title: "Learn to play guitar", emoji: "🎸", cat: "create" },
  { title: "Find my person", emoji: "💞", cat: "love" }, { title: "Climb a mountain", emoji: "🏔️", cat: "adventure" }, { title: "Take a year-long sabbatical", emoji: "🌴", cat: "self" },
  { title: "Build a morning routine I love", emoji: "🌅", cat: "self" }, { title: "Retire my parents", emoji: "👵", cat: "love" }, { title: "Do a pull-up", emoji: "🧗", cat: "health" },
];
export const WIN_CATS = [
  { id: "health", name: "Health", emoji: "💪" }, { id: "work", name: "Work", emoji: "💼" }, { id: "money", name: "Money", emoji: "💰" },
  { id: "people", name: "People", emoji: "❤️" }, { id: "mind", name: "Mind", emoji: "🧠" }, { id: "faith", name: "Faith", emoji: "🙏" },
  { id: "home", name: "Home", emoji: "🏡" }, { id: "brave", name: "Brave moment", emoji: "🦁" }, { id: "other", name: "Other", emoji: "⭐" },
];

/* ─── Cleaning what's saved ─── */
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const int = (v: unknown, lo: number, hi: number, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : fallback);
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const TOPIC_IDS = new Set<string>(TOPICS.map((t) => t.id));
const KIND_IDS = new Set<string>(KINDS.map((k) => k.id));

export function cleanMindset(raw: unknown): MindsetData | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as any, p = r.profile;
  if (!p || typeof p !== "object") return undefined;
  const goals = [...new Set(arr(p.goals).filter((g) => TOPIC_IDS.has(g)))].slice(0, 6) as Topic[];
  const kinds = [...new Set(arr(p.kinds).filter((k) => KIND_IDS.has(k)))] as Kind[];
  const profile: MindProfile = {
    name: str(p.name, 40).trim(), goals: goals.length ? goals : ["discipline", "confidence"],
    season: SEASONS.some((s) => s.id === p.season) ? p.season : "okay",
    faith: p.faith === "christian" || p.faith === "spiritual" ? p.faith : "none", bible: p.bible === true,
    tone: TONES.some((t) => t.id === p.tone) ? p.tone : "mix", kinds: kinds.length ? kinds : KINDS.filter((k) => !k.faith).map((k) => k.id),
    minutes: int(p.minutes, 5, 600, 20), why: str(p.why, 400), startedAt: isDay(p.startedAt) ? p.startedAt : "",
  };
  const ids = (v: unknown, max: number) => [...new Set(arr(v).filter((x) => typeof x === "string" && x.length <= 40))].slice(-max) as string[];
  const id = (v: unknown) => str(v, 60);
  return {
    profile, likes: ids(r.likes, MIND_LIMITS.likes), seen: ids(r.seen, MIND_LIMITS.seen),
    dreams: arr(r.dreams).slice(0, MIND_LIMITS.dreams).map((d) => ({
      id: id(d?.id), title: str(d?.title, 120).trim(), emoji: str(d?.emoji, 16) || "⭐", color: /^#[0-9a-f]{6}$/i.test(d?.color) ? d.color : DREAM_COLORS[0],
      cat: str(d?.cat, 20), why: str(d?.why, 600), target: isDay(d?.target) ? d.target : "", done: isDay(d?.done) ? d.done : "", at: isDay(d?.at) ? d.at : "",
      steps: arr(d?.steps).slice(0, MIND_LIMITS.steps).map((s) => ({ id: id(s?.id), text: str(s?.text, 160).trim(), done: s?.done === true })).filter((s) => s.id && s.text),
    })).filter((d) => d.id && d.title),
    wins: arr(r.wins).slice(-MIND_LIMITS.wins).map((w) => ({ id: id(w?.id), date: isDay(w?.date) ? w.date : "", title: str(w?.title, 200).trim(), emoji: str(w?.emoji, 16) || "⭐", cat: str(w?.cat, 20) || "other" })).filter((w) => w.id && w.date && w.title),
    reflections: arr(r.reflections).slice(-MIND_LIMITS.reflections).map((x) => ({ id: id(x?.id), date: isDay(x?.date) ? x.date : "", prompt: str(x?.prompt, 300), text: str(x?.text, 5000) })).filter((x) => x.id && x.date && x.text.trim()),
    days: arr(r.days).filter((d) => isDay(d?.date)).slice(-MIND_LIMITS.days).map((d) => ({ date: d.date, secs: int(d.secs, 0, 86400), cards: int(d.cards, 0, 20000), affirm: int(d.affirm, 0, 20000) })),
    challenges: arr(r.challenges).filter((c) => isDay(c?.date) && typeof c?.id === "string").slice(-MIND_LIMITS.challenges).map((c) => ({ date: c.date, id: str(c.id, 40), done: c.done === true })),
    intentions: arr(r.intentions).filter((x) => isDay(x?.date)).slice(-MIND_LIMITS.intentions).map((x) => ({ date: x.date, text: str(x.text, 300) })),
  };
}

export function newMindset(profile: MindProfile): MindsetData {
  return { profile, likes: [], seen: [], dreams: [], wins: [], reflections: [], days: [], challenges: [], intentions: [] };
}

/* ─── The feed ─── */
export type Card =
  | { key: string; kind: "quote"; item: Quote }
  | { key: string; kind: "verse"; item: Verse }
  | { key: string; kind: "story"; item: Story; part: number }
  | { key: string; kind: "advice"; item: Advice }
  | { key: string; kind: "affirmation"; item: Line }
  | { key: string; kind: "prompt"; item: Line }
  | { key: string; kind: "challenge"; item: Challenge }
  | { key: string; kind: "lesson"; item: Lesson }
  | { key: string; kind: "breathe" }
  | { key: string; kind: "dream"; dream: Dream }
  | { key: string; kind: "win" }
  | { key: string; kind: "goal"; minutes: number };

type Pool = { kind: Exclude<Kind, "breathe">; id: string; topics: Topic[]; item: any; tone?: string }[];

/** Everything the person's answers allow, with Bible content only when they asked for it. */
export function poolFor(p: MindProfile): Pool {
  const faithOk = (topics: Topic[]) => p.bible || !topics.includes("faith");
  const on = new Set(p.kinds);
  const out: Pool = [];
  if (on.has("quote")) for (const x of QUOTES) if (faithOk(x.topics)) out.push({ kind: "quote", id: x.id, topics: x.topics, item: x });
  if (on.has("verse") && p.bible) for (const x of VERSES) out.push({ kind: "verse", id: x.id, topics: x.topics, item: x });
  if (on.has("story")) for (const x of [...LIFE_STORIES, ...(p.bible ? BIBLE_STORIES : [])]) out.push({ kind: "story", id: `s:${x.id}`, topics: x.topics, item: x });
  if (on.has("advice")) for (const x of ADVICE) if (faithOk(x.topics)) out.push({ kind: "advice", id: x.id, topics: x.topics, item: x, tone: x.tone });
  if (on.has("affirmation")) for (const x of AFFIRMATIONS) if (faithOk(x.topics)) out.push({ kind: "affirmation", id: x.id, topics: x.topics, item: x });
  if (on.has("prompt")) for (const x of PROMPTS) if (faithOk(x.topics)) out.push({ kind: "prompt", id: x.id, topics: x.topics, item: x });
  if (on.has("challenge")) for (const x of CHALLENGES) if (faithOk(x.topics)) out.push({ kind: "challenge", id: x.id, topics: x.topics, item: x });
  if (on.has("lesson")) for (const x of LESSONS) out.push({ kind: "lesson", id: x.id, topics: x.topics, item: x });
  return out;
}

/** A small seeded random, so a feed is the same on a re-render but new each session. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** How much a card fits this person: their goals count most, then tone; what they need in a hard season. */
function weight(c: Pool[number], p: MindProfile): number {
  let w = 1;
  const goalHits = c.topics.filter((t) => p.goals.includes(t)).length;
  w += goalHits * 2.5;
  if (c.tone && p.tone !== "mix") w *= c.tone === p.tone ? 1.8 : 0.6;
  if (p.season === "hard" && c.topics.some((t) => t === "healing" || t === "calm" || t === "resilience")) w *= 1.6;
  if (p.season === "stuck" && c.topics.some((t) => t === "discipline" || t === "purpose")) w *= 1.4;
  if (p.season === "thriving" && c.topics.some((t) => t === "career" || t === "discipline" || t === "money")) w *= 1.3;
  if (p.bible && c.topics.includes("faith")) w *= 1.3;
  return w;
}

/**
 * The next `count` cards: a weighted mix that favors the person's goals, avoids what they've seen lately and
 * never repeats a kind three times in a row. Stories come as their parts in order. Every so often a breathing
 * reset, one of their dreams, or a "log a win" card.
 */
export function buildFeed(m: MindsetData, opts: { count: number; seed: number; skip?: Set<string>; start?: number }): Card[] {
  const p = m.profile, rand = rng(opts.seed);
  const seen = new Set([...m.seen.slice(-500), ...(opts.skip ?? [])]);
  let pool = poolFor(p).filter((c) => !seen.has(c.id));
  if (pool.length < opts.count) pool = poolFor(p).filter((c) => !(opts.skip ?? new Set()).has(c.id));
  const kindShare = new Map<string, number>();
  for (const c of pool) kindShare.set(c.kind, (kindShare.get(c.kind) || 0) + 1);
  const out: Card[] = [];
  const used = new Set<string>();
  const openDreams = m.dreams.filter((d) => !d.done);
  let n = opts.start ?? 0;
  while (out.length < opts.count && pool.length) {
    n += 1;
    if (p.kinds.includes("breathe") && n % 11 === 0) { out.push({ key: `breathe:${opts.seed}:${n}`, kind: "breathe" }); continue; }
    if (openDreams.length && n % 9 === 0) { const d = openDreams[Math.floor(rand() * openDreams.length)]; out.push({ key: `dream:${d.id}:${opts.seed}:${n}`, kind: "dream", dream: d }); continue; }
    if (n % 17 === 0) { out.push({ key: `win:${opts.seed}:${n}`, kind: "win" }); continue; }
    const last2 = out.slice(-2).map((c) => c.kind);
    const choices = pool.filter((c) => !used.has(c.id) && !(last2.length === 2 && last2[0] === c.kind && last2[1] === c.kind));
    if (!choices.length) break;
    // Kinds with many cards (quotes) shouldn't drown out the rest: spread by kind first.
    const weights = choices.map((c) => weight(c, p) / Math.sqrt(kindShare.get(c.kind) || 1));
    let roll = rand() * weights.reduce((s, w) => s + w, 0), i = 0;
    while (roll > weights[i] && i < weights.length - 1) roll -= weights[i++];
    const pick = choices[i];
    used.add(pick.id);
    if (pick.kind === "story") {
      const story = pick.item as Story;
      for (let part = 0; part <= story.body.length; part++) out.push({ key: `${pick.id}:${part}:${opts.seed}`, kind: "story", item: story, part });
    } else out.push({ key: `${pick.id}:${opts.seed}`, kind: pick.kind, item: pick.item } as Card);
  }
  return out;
}

/** The id saved for a card (for likes and "seen"); dreams, breathing and the rest aren't saved. */
export function cardId(c: Card): string {
  if (c.kind === "story") return `s:${c.item.id}`;
  if (c.kind === "quote" || c.kind === "verse" || c.kind === "advice" || c.kind === "affirmation" || c.kind === "prompt" || c.kind === "challenge" || c.kind === "lesson") return c.item.id;
  return "";
}

/** A liked card's content, found again by its id. */
export function findCard(id: string): Card | null {
  const hit = <T extends { id: string }>(list: T[], kind: Card["kind"]) => { const item = list.find((x) => x.id === id); return item ? ({ key: id, kind, item } as Card) : null; };
  if (id.startsWith("s:")) { const s = [...BIBLE_STORIES, ...LIFE_STORIES].find((x) => x.id === id.slice(2)); return s ? { key: id, kind: "story", item: s, part: 0 } : null; }
  return hit(QUOTES, "quote") || hit(VERSES, "verse") || hit(ADVICE, "advice") || hit(AFFIRMATIONS, "affirmation") || hit(PROMPTS, "prompt") || hit(CHALLENGES, "challenge") || hit(LESSONS, "lesson");
}

/** The card text for sharing or copying. */
export function cardText(c: Card): string {
  switch (c.kind) {
    case "quote": return `"${c.item.text}" — ${c.item.by}`;
    case "verse": return `${c.item.text} — ${c.item.ref} (KJV)`;
    case "story": return `${c.item.title}${c.item.ref ? ` (${c.item.ref})` : ""}\n\n${c.item.body.join("\n\n")}\n\n${c.item.lesson}`;
    case "advice": return `${c.item.title}\n${c.item.body}`;
    case "affirmation": case "prompt": return c.item.text;
    case "challenge": return `${c.item.title}: ${c.item.how}`;
    case "lesson": return `${c.item.title}\n${c.item.idea}\nTry: ${c.item.try}`;
    default: return "";
  }
}

/* ─── Today ─── */
const dayNum = (date: string) => Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
/** The same pick all day for everyone with the same answers, a new one tomorrow. */
function ofDay<T extends { topics: Topic[] }>(list: T[], p: MindProfile, date: string, salt: number): T | null {
  const fit = list.filter((x) => x.topics.some((t) => p.goals.includes(t)));
  const from = fit.length >= 5 ? fit : list;
  return from.length ? from[(dayNum(date) * 7 + salt) % from.length] : null;
}
export function today(m: MindsetData, date: string) {
  const p = m.profile;
  const faithOk = (x: { topics: Topic[] }) => p.bible || !x.topics.includes("faith");
  return {
    quote: ofDay(QUOTES.filter(faithOk), p, date, 1),
    verse: p.bible ? ofDay(VERSES, p, date, 3) : null,
    challenge: ofDay(CHALLENGES.filter(faithOk), p, date, 5),
    affirmation: ofDay(AFFIRMATIONS.filter(faithOk), p, date, 11),
    prompt: ofDay(PROMPTS.filter(faithOk), p, date, 13),
    lesson: ofDay(LESSONS, p, date, 17),
  };
}

/* ─── Progress ─── */
export const dayOf = (m: MindsetData, date: string): MindDay => m.days.find((d) => d.date === date) ?? { date, secs: 0, cards: 0, affirm: 0 };
const addDay = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Adds time and cards to a day. */
export function logTime(m: MindsetData, date: string, secs: number, cards: number, affirm = 0): MindsetData {
  const d = dayOf(m, date), next = { date, secs: Math.min(86400, d.secs + Math.max(0, Math.round(secs))), cards: d.cards + Math.max(0, cards), affirm: d.affirm + Math.max(0, affirm) };
  return { ...m, days: [...m.days.filter((x) => x.date !== date), next].sort((a, b) => a.date.localeCompare(b.date)).slice(-MIND_LIMITS.days) };
}

/** A day counts once you've spent a minute with your mind (feed, reflection, win or challenge). */
export function activeOn(m: MindsetData, date: string): boolean {
  return dayOf(m, date).secs >= 60 || m.reflections.some((r) => r.date === date) || m.wins.some((w) => w.date === date) || m.challenges.some((c) => c.date === date && c.done);
}
export function mindStreak(m: MindsetData, date: string): { days: number; today: boolean; best: number } {
  const t = activeOn(m, date);
  let days = t ? 1 : 0;
  for (let i = 1; i < 2000 && activeOn(m, addDay(date, -i)); i++) days += 1;
  let best = days, run = 0;
  for (let i = 400; i >= 0; i--) { if (activeOn(m, addDay(date, -i))) { run += 1; best = Math.max(best, run); } else run = 0; }
  return { days, today: t, best };
}
export function totals(m: MindsetData) {
  return {
    minutes: Math.round(m.days.reduce((s, d) => s + d.secs, 0) / 60), cards: m.days.reduce((s, d) => s + d.cards, 0),
    affirm: m.days.reduce((s, d) => s + d.affirm, 0), activeDays: new Set(m.days.filter((d) => d.secs >= 60).map((d) => d.date)).size,
    reflections: m.reflections.length, words: m.reflections.reduce((s, r) => s + r.text.trim().split(/\s+/).filter(Boolean).length, 0),
    challenges: m.challenges.filter((c) => c.done).length, wins: m.wins.length, dreamsDone: m.dreams.filter((d) => d.done).length,
    steps: m.dreams.reduce((s, d) => s + d.steps.filter((x) => x.done).length, 0), likes: m.likes.length,
  };
}
/** Minutes each day for the last `n` days, oldest first. */
export const recentDays = (m: MindsetData, date: string, n: number) => Array.from({ length: n }, (_, i) => { const d = addDay(date, i - n + 1); return { date: d, mins: Math.round(dayOf(m, d).secs / 60) }; });

export const MIND_LEVELS = ["Seeker", "Learner", "Builder", "Steady", "Grounded", "Rising", "Strong", "Wise", "Unshakable", "Transformed"];
/** Growth points: a point per minute, 5 per reflection, 10 per challenge, 5 per win, 25 per dream reached. */
export function growth(m: MindsetData) {
  const t = totals(m), pts = t.minutes + t.reflections * 5 + t.challenges * 10 + t.wins * 5 + t.dreamsDone * 25 + t.steps * 3;
  let level = 1, rest = pts;
  while (rest >= 60 + (level - 1) * 40 && level < 999) { rest -= 60 + (level - 1) * 40; level += 1; }
  const need = 60 + (level - 1) * 40;
  return { pts, level, title: MIND_LEVELS[Math.min(MIND_LEVELS.length - 1, Math.floor((level - 1) / 3))], into: rest, need };
}

export type MindBadge = { id: string; name: string; emoji: string; blurb: string; have: number; goal: number; earned: boolean };
export function mindBadges(m: MindsetData, date: string): MindBadge[] {
  const t = totals(m), st = mindStreak(m, date), best = Math.max(st.best, st.days), lvl = growth(m).level;
  const maxDay = Math.max(0, ...m.days.map((d) => Math.round(d.secs / 60)));
  const goalDays = m.days.filter((d) => d.secs >= m.profile.minutes * 60).length;
  const b = (id: string, name: string, emoji: string, blurb: string, have: number, goal: number): MindBadge => ({ id, name, emoji, blurb, have: Math.min(have, goal), goal, earned: have >= goal });
  return [
    b("start", "Day One", "🌱", "Finish your first session.", t.activeDays, 1),
    b("streak3", "Three in a Row", "🔥", "A 3-day streak.", best, 3),
    b("streak7", "One Week Strong", "📆", "A 7-day streak.", best, 7),
    b("streak21", "New Habit", "🧠", "A 21-day streak.", best, 21),
    b("streak66", "Rewired", "⚡", "A 66-day streak.", best, 66),
    b("streak100", "Hundred Days", "💯", "A 100-day streak.", best, 100),
    b("goal1", "Goal Hit", "🎯", "Reach your daily time goal.", goalDays, 1),
    b("goal10", "Committed", "🏅", "Hit your daily goal on 10 days.", goalDays, 10),
    b("hour", "Deep Dive", "🌊", "Spend an hour in one day.", maxDay, 60),
    b("hours10", "Ten Hours In", "⏳", "10 hours of mental training.", Math.floor(t.minutes / 60), 10),
    b("hours50", "Fifty Hours", "🕰️", "50 hours of mental training.", Math.floor(t.minutes / 60), 50),
    b("hours100", "Mind Athlete", "🏆", "100 hours of mental training.", Math.floor(t.minutes / 60), 100),
    b("cards500", "Well Read", "📚", "Read 500 cards.", t.cards, 500),
    b("cards5000", "Library Mind", "🏛️", "Read 5,000 cards.", t.cards, 5000),
    b("reflect1", "First Thought", "✍️", "Write your first reflection.", t.reflections, 1),
    b("reflect30", "Self-Aware", "🪞", "Write 30 reflections.", t.reflections, 30),
    b("words10k", "Ten Thousand Words", "📝", "Write 10,000 words of reflection.", t.words, 10000),
    b("challenge1", "Dared", "🎲", "Complete a challenge.", t.challenges, 1),
    b("challenge30", "Challenge Accepted", "🎯", "Complete 30 challenges.", t.challenges, 30),
    b("affirm100", "Speak It", "🗣️", "Claim 100 affirmations.", t.affirm, 100),
    b("win10", "Winning", "⭐", "Log 10 wins.", t.wins, 10),
    b("win100", "Proof", "🌟", "Log 100 wins.", t.wins, 100),
    b("dream1", "Dreamer", "☁️", "Add a dream to your board.", m.dreams.length, 1),
    b("dreamdone", "Dream Made Real", "🎉", "Mark a dream achieved.", t.dreamsDone, 1),
    b("level10", "Level 10", "🥇", "Reach growth level 10.", lvl, 10),
  ];
}
