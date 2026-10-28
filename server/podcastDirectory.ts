// The podcast directory behind Earshot (LifeHub) and Podscroll (its own website), shared by both.
//
// Speed: Apple allows about 20 lookups a minute from this server, so nothing waits on Apple when it
// can be avoided. Every answer is kept in memory and in the database (podcast_cache), so a restart
// or deploy starts warm; a stale answer is served at once while a fresh one is fetched; and a
// background warm-up fills every genre and the top shows' episodes whenever Apple isn't busy with
// someone's request. The feed endpoint then sends each genre with episodes attached, so swiping
// never waits for a lookup.
//
// Read along and ad skip: an episode's transcript comes from the publisher when its RSS feed lists
// one (Podcasting 2.0), otherwise AI writes it from the audio in 10-minute pieces as people listen.
// AI then marks the sponsor reads so the player can skip them. Each piece is made once and kept
// for everyone; AI minutes are capped per day (EARSHOT_AI_MINUTES_PER_DAY, default 300).
import {
  GENRES, GENRE, TX_CHUNK_SECS, adsFromChapters, appleLookupUrl, appleSearchUrl, bestTranscript, chunkPlan,
  lightEpisode, mergeGenreShows, parseChaptersJson, parseCues, parseEpisode, parseShow, parseTranscriptJson, poolFromEpisodeSearch, rssExtrasFor,
  type AdRange, type Chapter, type PodEpisode, type PodShow, type PoolShow, type TranscriptChunk, type TxSegment,
} from "../shared/earshot";
import {
  AD_PROMPT_V2, INTRO_PROMPT, adPromptMessage, adsFromAiV2, combineAds, introFromAi, introPromptMessage, emptyProfile, learnFromMark, learnProfile, learnedPreroll, mp3Info, phraseAds, phraseBlocks, profileHints, sponsorsFromNotes,
  type ServerAd, type ShowProfile, type Word,
} from "../shared/earshotAds";

// ---------------------------------------------------------------------------
// Storage that survives restarts
// ---------------------------------------------------------------------------

export interface KV {
  get(key: string): Promise<{ value: any; at: number } | null>;
  set(key: string, value: any): Promise<void>;
  /** Many keys in one round trip (the feed needs dozens at once). */
  getMany?(keys: string[]): Promise<Map<string, { value: any; at: number }>>;
}
export function memoryKV(): KV {
  const m = new Map<string, { value: any; at: number }>();
  return {
    async get(k) { return m.get(k) ?? null; }, async set(k, value) { m.set(k, { value, at: Date.now() }); },
    async getMany(keys) { const out = new Map<string, { value: any; at: number }>(); for (const k of keys) { const v = m.get(k); if (v) out.set(k, v); } return out; },
  };
}
/** podcast_cache (migrations/podcast_cache.sql). Failures are quiet: the memory cache still works. */
export function supabaseKV(getDb: () => any): KV {
  let off = false;
  return {
    async get(key) {
      if (off) return null;
      try {
        const { data, error } = await getDb().from("podcast_cache").select("value,updated_at").eq("key", key).maybeSingle();
        if (error) { if (/podcast_cache/.test(String(error.message))) off = true; return null; }
        return data ? { value: data.value, at: Date.parse(data.updated_at) || 0 } : null;
      } catch { return null; }
    },
    async getMany(keys) {
      const out = new Map<string, { value: any; at: number }>();
      if (off || !keys.length) return out;
      try {
        for (let i = 0; i < keys.length; i += 100) {
          const { data, error } = await getDb().from("podcast_cache").select("key,value,updated_at").in("key", keys.slice(i, i + 100));
          if (error) { if (/podcast_cache/.test(String(error.message))) off = true; return out; }
          for (const r of data || []) out.set(String(r.key), { value: r.value, at: Date.parse(r.updated_at) || 0 });
        }
      } catch { /* memory still works */ }
      return out;
    },
    async set(key, value) {
      if (off) return;
      try { await getDb().from("podcast_cache").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" }); } catch { /* memory still has it */ }
    },
  };
}

// ---------------------------------------------------------------------------
// Apple, paced; user requests go first
// ---------------------------------------------------------------------------

export type Fetcher = (url: string) => Promise<any>;
const USER_AGENT = "Arise-Earshot/1.0 (arisetodo.com)";
/** Audio the server fetches for itself (transcripts) says it's a bot, so it isn't counted as a listen. */
const AUDIO_AGENT = "Mozilla/5.0 (compatible; AriseEarshotBot/1.0; +https://arisetodo.com)";
export const appleFetcher: Fetcher = async (url) => {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (res.status === 403 || res.status === 429) throw new Error("busy");
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json();
};

export const APPLE_PACE = 3_200;
/** One request to Apple every `pace` ms. A request that would wait more than maxWait is refused
 *  ("busy"); idle() says whether background work may use the next slot. */
export function pacedFetcher(inner: Fetcher, pace = APPLE_PACE, maxWait = 12_000, now = () => Date.now(), sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))) {
  let nextAt = 0;
  const f = (async (url: string) => {
    const t = now();
    const at = Math.max(t, nextAt);
    if (at - t > maxWait) throw new Error("busy");
    nextAt = at + pace;
    if (at > t) await sleep(at - t);
    return inner(url);
  }) as Fetcher & { idle: () => boolean };
  f.idle = () => now() >= nextAt + pace;
  return f;
}

// ---------------------------------------------------------------------------
// Two-level cache: memory, then the database, then the source
// ---------------------------------------------------------------------------

/** An episode's best ~45 seconds for Explore's previews (seconds in the host's copy). best: the AI picked it. */
export type Moment = { s: number; e: number; quote: string; hook: string; best: boolean; audio?: string; /** A stand-in while the AI is busy: not kept, picked properly later. */ temp?: boolean };
export const MOMENT_SYSTEM = `You pick the single best moment of a podcast for a 45-second preview that makes someone want the whole episode. It has to stand on its own: a complete thought, a story beat, a surprising fact, a strong opinion or a funny exchange, starting at the start of a sentence. Never an ad, sponsor read, promo, intro, outro, or a request to subscribe or rate. Lines are "#number [seconds] text". Reply with JSON only: {"start": first line number, "end": last line number, "hook": a 3-8 word teaser in plain words, "quote": the most striking sentence in it, word for word}. The stretch should run 30 to 60 seconds.`;
/** The AI's pick checked against the transcript: real lines, in order, 20-70 s long (trimmed to 60). */
export function pickMoment(segs: { s: number; e: number; t: string }[], v: any): Moment | null {
  if (typeof v === "string") { try { v = JSON.parse(v.slice(v.indexOf("{"), v.lastIndexOf("}") + 1)); } catch { return null; } }
  const a = Math.floor(Number(v?.start)), b = Math.floor(Number(v?.end));
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < a || b >= segs.length) return null;
  const s = segs[a].s; let e = segs[b].e;
  if (e - s < 20) return null;
  if (e - s > 70) e = s + 60;
  const quote = String(v?.quote || "").replace(/\s+/g, " ").trim().slice(0, 240);
  const said = segs.slice(a, b + 1).map((x) => x.t).join(" ").toLowerCase();
  const real = quote && said.includes(quote.toLowerCase().slice(0, 40));
  return { s: Math.round(s * 100) / 100, e: Math.round(e * 100) / 100, quote: real ? quote : segs[a].t.slice(0, 240), hook: String(v?.hook || "").replace(/\s+/g, " ").trim().slice(0, 60), best: true };
}

export function layeredCache<T>(kv: KV, prefix: string, ttlMs: number, max = 2000) {
  const mem = new Map<string, { at: number; value: T }>();
  const missing = new Map<string, number>();
  const inflight = new Map<string, Promise<T>>();
  const remember = (key: string, value: T, at = Date.now()) => { mem.delete(key); mem.set(key, { at, value }); if (mem.size > max) mem.delete(mem.keys().next().value as string); };
  const refresh = (key: string, load: () => Promise<T>, fallback?: T): Promise<T> => {
    const running = inflight.get(key);
    if (running) return running;
    const p = load().then((value) => { remember(key, value); void kv.set(prefix + key, value); return value; })
      .catch((e) => { if (fallback !== undefined) return fallback; throw e; })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  };
  return {
    /** What's already known, fresh or not, without asking the source. */
    async peek(key: string): Promise<{ value: T; fresh: boolean } | null> {
      const m = mem.get(key);
      if (m) return { value: m.value, fresh: Date.now() - m.at < ttlMs };
      const d = await kv.get(prefix + key);
      if (d) { remember(key, d.value as T, d.at); return { value: d.value as T, fresh: Date.now() - d.at < ttlMs }; }
      return null;
    },
    peekMemory(key: string) { const m = mem.get(key); return m ? m.value : undefined; },
    /** Brings many keys into memory with one database read; keys known to be missing aren't asked again for a minute. */
    async preload(keys: string[]) {
      const now = Date.now();
      const need = keys.filter((k) => !mem.has(k) && (missing.get(k) ?? 0) < now);
      if (!need.length) return;
      const got = kv.getMany ? await kv.getMany(need.map((k) => prefix + k)) : new Map();
      for (const k of need) { const d = got.get(prefix + k); if (d) remember(k, d.value as T, d.at); else missing.set(k, now + 60_000); }
      if (missing.size > 5000) missing.clear();
    },
    /** Fresh: returned. Stale: returned at once, refreshed in the background. Missing: loaded. */
    async get(key: string, load: () => Promise<T>): Promise<T> {
      const known = await this.peek(key);
      if (known?.fresh) return known.value;
      if (known) { void refresh(key, load, known.value).catch(() => {}); return known.value; }
      return refresh(key, load);
    },
    stale: async (key: string) => { const k = await (async () => { const m = mem.get(key); return m ? m.at : (await kv.get(prefix + key))?.at ?? 0; })(); return Date.now() - k >= ttlMs; },
    refresh,
  };
}

// ---------------------------------------------------------------------------
// The directory
// ---------------------------------------------------------------------------

type ShowLookup = { show: PodShow | null; episodes: PodEpisode[] };
export type AskJson = (system: string, user: string) => Promise<string>;
export type Transcriber = (audio: Blob, name: string, prompt?: string) => Promise<{ segments: { start: number; end: number; text: string }[]; words?: { start: number; end: number; word: string }[] }>;

/** Read along from a listener's copy (playback through the server): times are "content time", the
 *  show's own audio with stitched-in ads left out, so they're the same for every copy. pieces: where
 *  the audio came from, with frame keys that find the same moments in any other copy. */
export type AnchorPiece = { ct: number; len: number; keys: [number, number][] };
export type ContentChunk = TranscriptChunk & { v: 3; pieces: AnchorPiece[] };
export type ContentSource = {
  /** Length of the show's audio (content time). */
  secs: number;
  /** The audio for content time [from, to) as one MP3, and where its pieces are. */
  extract: (from: number, to: number) => Promise<{ audio: Blob; pieces: AnchorPiece[] }>;
};

export interface DirectoryOptions {
  fetcher?: Fetcher & { idle?: () => boolean };
  kv?: KV;
  ask?: AskJson;
  transcribe?: Transcriber;
  aiOn?: () => boolean;
  /** Fetch for podcast hosts and RSS feeds (tests replace it). */
  web?: typeof fetch;
  minutesPerDay?: number;
}

/** OpenAI said no: out of credit ("quota"), or too many at once ("busy", tried again after a moment). */
let lastSaid = 0;
async function openAiCall(send: () => Promise<Response>, what: string): Promise<Response> {
  for (let tryNo = 0; ; tryNo++) {
    const res = await send();
    if (res.ok) return res;
    const body: any = await res.json().catch(() => null);
    const code = String(body?.error?.code || body?.error?.type || "");
    if (res.status === 429 && Date.now() - lastSaid > 5 * 60_000) { lastSaid = Date.now(); console.warn(`[earshot] OpenAI ${what} 429: ${code} ${String(body?.error?.message || "").slice(0, 300)} | limit-requests=${res.headers.get("x-ratelimit-limit-requests")} remaining-requests=${res.headers.get("x-ratelimit-remaining-requests")} reset=${res.headers.get("x-ratelimit-reset-requests")}`); }
    if (res.status === 429 && /quota|billing|credit/i.test(code)) throw new Error("quota");
    // A daily or hourly allowance used up: no point waiting seconds. Says when it frees up.
    const said = String(body?.error?.message || "");
    if (res.status === 429 && /per (day|hour)|\((TPD|RPD|ASPH|ASPD)\)/i.test(said)) throw Object.assign(new Error("dry"), { retryMs: retryAfter(said) });
    // Groq answers 413 when one request is bigger than the model's per-minute allowance: the next
    // model (with its own allowance) may take it, so it counts as "busy", not as a hard failure.
    if (res.status === 413) throw new Error("busy");
    if ((res.status === 429 || res.status >= 500) && tryNo < 2) {
      const wait = Math.min(8, Number(res.headers.get("retry-after")) || 1.5 * (tryNo + 1));
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    throw new Error(res.status === 429 ? "busy" : `${what} ${res.status}${code ? ` ${code}` : ""}`);
  }
}
const FIND_STOP = new Set("a an and any about for from get give i im i'm in is it like me my of on or podcast podcasts show shows some something that the this to want with would you".split(" "));
/** The words in "find me…" worth matching against show names (no filler, nothing under 3 letters). */
export const findWords = (q: string) => [...new Set(q.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !FIND_STOP.has(w)))].slice(0, 12);
/** "Please try again in 7m46.5s" → milliseconds (10 minutes when it doesn't say). */
export function retryAfter(message: string): number {
  const m = /try again in\s+(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:([\d.]+)s)?/i.exec(message);
  const ms = m ? ((Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0)) * 1000 : 0;
  return Math.min(6 * 3600_000, Math.max(60_000, ms || 10 * 60_000));
}
// Groq gives each model its own free allowance, so when one is used up for the hour or day the next
// one answers: ad-finding keeps going instead of stopping until tomorrow.
const groqDry = new Map<string, number>();
let lastStrain = 0;
/** Whether the AI was turned away lately (extras like previews then step aside for ad-skipping). */
export const aiStrained = () => Date.now() - lastStrain < 30 * 60_000;
const uniq = (list: (string | undefined)[]) => [...new Set(list.filter((x): x is string => !!x))];
export async function onGroq<T>(models: string[], run: (model: string) => Promise<T>): Promise<T> {
  for (const m of models) {
    if ((groqDry.get(m) ?? 0) > Date.now()) continue;
    try { return await run(m); }
    catch (e: any) {
      if (e?.message !== "dry" && e?.message !== "busy") throw e;
      lastStrain = Date.now();
      groqDry.set(m, Date.now() + (e?.message === "dry" ? e.retryMs ?? 10 * 60_000 : 60_000));
    }
  }
  lastStrain = Date.now();
  throw new Error("busy");
}
const GROQ_AI = () => uniq([process.env.EARSHOT_GROQ_AD_MODEL, "openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile"]);
const GROQ_STT = () => uniq([process.env.EARSHOT_GROQ_MODEL, "whisper-large-v3-turbo", "whisper-large-v3"]);
/** Groq's hosted models (OpenAI-compatible), used when OpenAI is out of credit. */
const groqJson: AskJson = (system, user) => onGroq(GROQ_AI(), async (model) => {
  const res = await openAiCall(() => fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature: 0, max_tokens: 4000, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    signal: AbortSignal.timeout(60_000),
  }), "groq ai");
  const body: any = await res.json().catch(() => null);
  return String(body?.choices?.[0]?.message?.content || "");
});
let openAiDryUntil = 0;
export const openAiJson: AskJson = async (system, user) => {
  // Out of OpenAI credit: Groq answers instead (checking OpenAI again every 10 minutes).
  // OpenAI is off for this site (see server/aiProvider.ts): straight to Groq.
  if (process.env.GROQ_API_KEY && (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "routed-to-grok" || Date.now() < openAiDryUntil)) return groqJson(system, user);
  try { return await openAiJsonOnly(system, user); }
  catch (e: any) {
    if (process.env.GROQ_API_KEY && (e?.message === "quota" || e?.message === "busy")) { if (e?.message === "quota") openAiDryUntil = Date.now() + 10 * 60_000; return groqJson(system, user); }
    throw e;
  }
};
const openAiJsonOnly: AskJson = async (system, user) => {
  const res = await openAiCall(() => fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.EARSHOT_AD_MODEL || "gpt-4.1", temperature: 0, max_tokens: 2000, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    signal: AbortSignal.timeout(60_000),
  }), "ai");
  const body: any = await res.json().catch(() => null);
  return String(body?.choices?.[0]?.message?.content || "");
};
/** Speech to text: Groq's Whisper when GROQ_API_KEY is set (about 9x cheaper and faster), else OpenAI's. */
export const openAiTranscribe: Transcriber = (audio, name, prompt) => (process.env.GROQ_API_KEY ? onGroq(GROQ_STT(), (model) => transcribeWith(audio, name, prompt, model)) : transcribeWith(audio, name, prompt, ""));
async function transcribeWith(audio: Blob, name: string, prompt: string | undefined, groqModel: string) {
  const groq = !!groqModel;
  const form = new FormData();
  form.append("file", audio, name);
  form.append("model", groq ? groqModel : "whisper-1");
  if (prompt) form.append("prompt", prompt.slice(0, groq ? 400 : 800));
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  form.append("timestamp_granularities[]", "word");
  const url = groq ? "https://api.groq.com/openai/v1/audio/transcriptions" : "https://api.openai.com/v1/audio/transcriptions";
  const key = groq ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
  const res = await openAiCall(() => fetch(url, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(180_000) }), groq ? "groq transcribe" : "transcribe");
  const body: any = await res.json();
  return {
    segments: (Array.isArray(body?.segments) ? body.segments : []).map((s: any) => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text || "") })),
    words: (Array.isArray(body?.words) ? body.words : []).map((w: any) => ({ start: Number(w.start) || 0, end: Number(w.end) || 0, word: String(w.word || "") })),
  };
}

export function createDirectory(options: DirectoryOptions = {}) {
  const kv = options.kv ?? memoryKV();
  const apple = options.fetcher ?? pacedFetcher(appleFetcher);
  const idle = () => (typeof (apple as any).idle === "function" ? (apple as any).idle() : true);
  const web = options.web ?? fetch;
  const ask = options.ask ?? openAiJson;
  const transcribeNow = options.transcribe ?? openAiTranscribe;
  // The transcriber turns some requests away when several arrive at once ("busy"): wait a moment and
  // try once more before giving up, so a piece (and the ads in it) isn't lost to a brief rush.
  const transcribe: Transcriber = async (...args) => {
    try { return await transcribeNow(...args); }
    catch (e: any) { if (e?.message !== "busy") throw e; await new Promise((r) => setTimeout(r, 4_000)); return transcribeNow(...args); }
  };
  const aiOn = options.aiOn ?? (() => !!(process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY));
  const perDay = options.minutesPerDay ?? (Number(process.env.EARSHOT_AI_MINUTES_PER_DAY) || 900);

  const genreShows = layeredCache<PodShow[]>(kv, "g2:", 12 * 3600_000, 100);
  const genreEpisodes = layeredCache<PoolShow[]>(kv, "ge:", 12 * 3600_000, 100);
  const shows = layeredCache<ShowLookup>(kv, "s2:", 6 * 3600_000, 3000);
  const searches = layeredCache<{ shows: PodShow[]; episodes: PodEpisode[] }>(kv, "q:", 3600_000, 500);
  const extras = layeredCache<{ transcript: { url: string; type: string } | null; chapters: string }>(kv, "x:", 24 * 3600_000, 2000);
  const tx = layeredCache<TranscriptChunk>(kv, "t:", 365 * 24 * 3600_000, 1500);
  const profiles = layeredCache<ShowProfile>(kv, "sp:", 365 * 24 * 3600_000, 2000);
  const ctx = layeredCache<ContentChunk>(kv, "t3:", 365 * 24 * 3600_000, 1500);

  // ---- Apple ----
  const loadGenreShows = (gid: string) => genreShows.get(gid, async () => {
    const g = GENRE[gid];
    const body = await apple(appleSearchUrl(g.terms[0], "podcast", 60, true));
    return mergeGenreShows(gid, [Array.isArray(body?.results) ? body.results : []], 50);
  });
  const loadGenreEpisodes = (gid: string) => genreEpisodes.get(gid, async () => {
    const body = await apple(appleSearchUrl(GENRE[gid].terms[0], "podcastEpisode", 120, true));
    return poolFromEpisodeSearch(gid, Array.isArray(body?.results) ? body.results : [], true);
  });
  const loadShow = (id: string) => shows.get(id, async () => {
    const body = await apple(appleLookupUrl(id, 25));
    const results: unknown[] = Array.isArray(body?.results) ? body.results : [];
    const show = results.map((r) => parseShow(r)).find((s) => s && s.id === id) ?? null;
    const episodes = results.map((r) => parseEpisode(r, show)).filter((e): e is PodEpisode => !!e).sort((a, b) => Date.parse(b.date || "0") - Date.parse(a.date || "0"));
    return { show, episodes };
  });

  /** A genre's pool: its top shows with episodes already known, topped up by episode search while warming.
   *  Built from memory and one database read, and kept for 3 minutes, so the feed answers at once. */
  const pools = new Map<string, { at: number; value: PoolShow[] }>();
  const within = <T,>(p: Promise<T>, ms: number, fallback: T) => Promise.race([p.catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
  async function pool(gid: string, explicit: boolean): Promise<PoolShow[]> {
    const key = `${gid}:${explicit}`;
    const memo = pools.get(key);
    if (memo && Date.now() - memo.at < 3 * 60_000 && memo.value.length >= 8) return memo.value;
    const known = await genreShows.peek(gid);
    const list = known ? (known.fresh ? known.value : (void loadGenreShows(gid).catch(() => {}), known.value)) : await within(loadGenreShows(gid), 9000, [] as PodShow[]);
    await shows.preload(list.map((x) => x.id));
    const out: PoolShow[] = [];
    list.forEach((s, rank) => {
      if (!explicit && s.explicit) return;
      const eps = (shows.peekMemory(s.id)?.episodes ?? []).filter((e) => explicit || !e.explicit).slice(0, 3).map(lightEpisode);
      if (eps.length) out.push({ show: { ...s, genre: gid }, rank, episodes: eps });
    });
    if (out.length < 12) {
      // Still warming up: episode search fills in (waiting a few seconds at most; it keeps loading for next time).
      const extra = await within(loadGenreEpisodes(gid), out.length ? 2500 : 8000, [] as PoolShow[]);
      const have = new Set(out.map((p) => p.show.id));
      for (const p of extra) if (!have.has(p.show.id) && (explicit || !p.show.explicit)) { out.push({ ...p, rank: 30 + p.rank, episodes: p.episodes.filter((e) => explicit || !e.explicit) }); have.add(p.show.id); }
    }
    const value = out.filter((p) => p.episodes.length).slice(0, 40);
    if (value.length) pools.set(key, { at: Date.now(), value });
    return value;
  }

  // ---- background warm-up: genres, then each genre's top shows, whenever Apple is free ----
  let warming = false;
  async function warm(rounds = Infinity, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))) {
    if (warming) return; warming = true;
    try {
      for (let round = 0; round < rounds; round++) {
        const jobs: (() => Promise<unknown>)[] = [];
        for (const g of GENRES) { if (await genreShows.stale(g.id)) jobs.push(() => genreShows.refresh(g.id, async () => { const b = await apple(appleSearchUrl(g.terms[0], "podcast", 60, true)); return mergeGenreShows(g.id, [Array.isArray(b?.results) ? b.results : []], 50); })); }
        for (let depth = 0; depth < 15; depth++) for (const g of GENRES) {
          jobs.push(async () => { const list = (await genreShows.peek(g.id))?.value ?? []; const s = list[depth]; if (s && (await shows.stale(s.id))) await shows.refresh(s.id, async () => { const body = await apple(appleLookupUrl(s.id, 25)); const results: unknown[] = Array.isArray(body?.results) ? body.results : []; const show = results.map((r) => parseShow(r)).find((x) => x && x.id === s.id) ?? null; return { show, episodes: results.map((r) => parseEpisode(r, show)).filter((e): e is PodEpisode => !!e).sort((a, b) => Date.parse(b.date || "0") - Date.parse(a.date || "0")) }; }); });
        }
        for (const job of jobs) {
          while (!idle()) await sleep(1000);
          try { await job(); } catch (e: any) { if (e?.message === "busy") await sleep(20_000); }
        }
        await sleep(30 * 60_000);
      }
    } finally { warming = false; }
  }

  // ---- read along ----
  let dayKey = ""; let minutesToday = 0;
  const budgetLeft = () => { const d = new Date().toISOString().slice(0, 10); if (d !== dayKey) { dayKey = d; minutesToday = 0; } return perDay - minutesToday; };

  async function findEpisode(showId: string, episodeId: string) {
    const l = await loadShow(showId);
    return { show: l.show, ep: l.episodes.find((e) => e.id === episodeId) ?? null };
  }
  async function getText(url: string, max = 8_000_000) {
    const res = await web(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const len = Number(res.headers.get("content-length") || 0);
    if (len > max) throw new Error("too big");
    const text = await res.text();
    return text.slice(0, max);
  }
  async function publisherExtras(show: PodShow | null, ep: PodEpisode) {
    return extras.get(ep.id, async () => {
      if (!show?.feed) return { transcript: null, chapters: "" };
      const xml = await getText(show.feed, 12_000_000);
      const found = rssExtrasFor(xml, ep);
      return { transcript: bestTranscript(found.transcripts), chapters: found.chapters };
    }).catch(() => ({ transcript: null, chapters: "" }));
  }
  /** Ads in a stretch of transcript: phrases, the show's memory, AI cut at the exact word, chapters. */
  async function analyzeAds(o: { showId: string; showName: string; title?: string; about?: string; pieceId: string; segs: TxSegment[]; words: Word[]; chapters: Chapter[]; duration: number; from: number; to: number; opening: boolean; status?: { aiFailed?: boolean }; inserted?: boolean }): Promise<AdRange[]> {
    const prof = (await profiles.peek(o.showId))?.value ?? null;
    const known = profileHints(prof, o.showName);
    // Sponsors named in the episode's notes count like the ones the show is known for.
    const hints = { ...known, sponsors: [...new Set([...(known.sponsors ?? []), ...sponsorsFromNotes(o.about)])], title: o.title, inserted: o.inserted };
    const { scores } = phraseBlocks(o.segs, hints);
    const phrase = phraseAds(o.segs, hints);
    let ai: AdRange[] | null = null;
    if (aiOn() && o.segs.length) {
      const found: AdRange[] = [];
      let failed = false;
      for (let i = 0; i < o.segs.length; i += 350) {
        try { found.push(...adsFromAiV2(await ask(AD_PROMPT_V2, adPromptMessage(o.segs.slice(i, i + 350), scores.slice(i, i + 350), hints, i)), o.segs, o.words)); }
        catch { failed = true; }
      }
      ai = failed && !found.length ? null : found;
      if (failed && o.status) o.status.aiFailed = true;
    }
    const learned = o.opening ? learnedPreroll(o.segs, [...(ai ?? []), ...phrase], hints) : null;
    const chapterAds = adsFromChapters(o.chapters, o.duration).filter((a) => a.e > o.from && a.s < o.to);
    const ads = combineAds(ai, phrase, learned, chapterAds);
    // The opening: where the episode really begins (the intro is skipped only when the listener asks).
    if (o.opening && o.from === 0 && aiOn() && o.segs.length > 3) {
      const head = o.segs.filter((g) => g.s < 360);
      try { const intro = introFromAi(await ask(INTRO_PROMPT, introPromptMessage(head, ads, hints)), head, ads, o.words); if (intro) ads.push(intro); }
      catch { /* no intro this time */ }
    }
    void profiles.refresh(o.showId, async () => learnProfile((await profiles.peek(o.showId))?.value ?? emptyProfile(), o.pieceId, o.segs, ads.filter((x) => x.kind !== "intro"), o.opening)).catch(() => {});
    return ads;
  }

  /** The audio's size, type and exact length (from its first 16 KB). */
  async function probe(url: string) {
    const head = await web(url, { headers: { Range: "bytes=0-16383", "User-Agent": AUDIO_AGENT }, signal: AbortSignal.timeout(15_000) });
    const total = Number((head.headers.get("content-range") || "").split("/")[1]) || Number(head.headers.get("content-length") || 0);
    const type = String(head.headers.get("content-type") || "");
    const bytes = new Uint8Array(await head.arrayBuffer().catch(() => new ArrayBuffer(0)));
    let info = total ? mp3Info(bytes, total) : null;
    // Cover art longer than the first piece: read the start of the audio after it (same copy only).
    if (!info && total && bytes.length >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      const tagEnd = 10 + ((bytes[6] & 0x7f) << 21 | (bytes[7] & 0x7f) << 14 | (bytes[8] & 0x7f) << 7 | (bytes[9] & 0x7f)) + ((bytes[5] & 0x10) ? 10 : 0);
      if (tagEnd > bytes.length - 8 && tagEnd < total) {
        const more = await web(url, { headers: { Range: `bytes=${tagEnd}-${tagEnd + 16383}`, "User-Agent": AUDIO_AGENT }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
        const sameCopy = more && Number((more.headers.get("content-range") || "").split("/")[1]) === total;
        if (more && sameCopy) {
          const b2 = new Uint8Array(await more.arrayBuffer().catch(() => new ArrayBuffer(0)));
          const i2 = mp3Info(b2, total - tagEnd);
          if (i2) info = { ...i2, audioStart: i2.audioStart + tagEnd };
        }
      }
    }
    return { total, type, info };
  }

  /** One piece of an episode's transcript (publisher transcripts arrive whole, as chunk 0). */
  async function transcript(showId: string, episodeId: string, chunk: number): Promise<TranscriptChunk> {
    const none = (reason: string): TranscriptChunk => ({ source: "none", segments: [], ads: [], chapters: [], chunk, chunkSecs: TX_CHUNK_SECS, more: false, reason });
    const { show, ep } = await findEpisode(showId, episodeId);
    if (!ep) return none("This episode isn't available anymore.");
    const key = `${ep.id}:${chunk}`;
    const done = await tx.peek(key);
    if (done && (done.value as any).v === 2) return done.value;
    const ex = await publisherExtras(show, ep);
    let chapters: Chapter[] = [];
    if (ex.chapters && chunk === 0) { try { chapters = parseChaptersJson(JSON.parse(await getText(ex.chapters, 2_000_000))); } catch { /* none */ } }
    // A piece made before the smarter ad finder: find its ads again (text only, no new transcription).
    if (done && done.value.segments.length) {
      return tx.refresh(key, async () => {
        const old = done.value;
        let dur = old.dur, durMode = old.durMode;
        if (old.source === "ai" && !dur) { try { const p = await probe(ep.audio); if (p.info) { dur = p.info.duration; durMode = "exact"; } } catch { /* unknown */ } }
        if (old.source === "publisher" && !dur) { dur = old.segments[old.segments.length - 1].e; durMode = "approx"; }
        const ads = await analyzeAds({ showId, showName: show?.name ?? ep.show, title: ep.title, about: ep.about, pieceId: `${ep.id}#${old.chunk}`, segs: old.segments, words: old.words ?? [], chapters: old.chapters?.length ? old.chapters : chapters, duration: dur || ep.secs, from: old.chunk * old.chunkSecs, to: (old.chunk + 1) * old.chunkSecs, opening: old.chunk === 0 });
        return { ...old, ads, dur, durMode, v: 2 } as TranscriptChunk;
      }).catch(() => done.value);
    }
    if (ex.transcript) {
      const pub = await tx.refresh(`${ep.id}:pub`, async () => {
        const raw = await getText(ex.transcript!.url, 6_000_000);
        const segments = /json/.test(ex.transcript!.type) ? parseTranscriptJson(JSON.parse(raw)) : parseCues(raw);
        if (!segments.length) throw new Error("empty");
        const last = segments[segments.length - 1].e;
        const ads = await analyzeAds({ showId, showName: show?.name ?? ep.show, title: ep.title, about: ep.about, pieceId: `${ep.id}#pub`, segs: segments, words: [], chapters, duration: Math.max(ep.secs, last), from: 0, to: Math.max(ep.secs, last), opening: true });
        return { source: "publisher", segments, ads, chapters, chunk: 0, chunkSecs: Math.max(ep.secs, last), more: false, dur: last, durMode: "approx", v: 2 } as TranscriptChunk;
      }).catch(() => null);
      if (pub) { void tx.refresh(key, async () => pub).catch(() => {}); return pub; }
    }
    if (!aiOn()) return { ...none("This show doesn't publish a transcript."), chapters };
    return tx.refresh(key, async () => {
      const p = await probe(ep.audio);
      const isMp3 = !!p.info || /mpeg|mp3/i.test(p.type) || /\.mp3(\?|$)/i.test(ep.audio);
      if (!isMp3 || !p.total) throw Object.assign(new Error("format"), { soft: true });
      const exact = p.info?.duration ?? 0;
      const plan = chunkPlan(p.total - (p.info?.audioStart ?? 0), exact || ep.secs);
      if (chunk >= plan.chunks) return { ...none(""), source: "ai", more: false, chunkSecs: plan.chunkSecs, dur: exact || undefined, durMode: "exact", v: 2 } as TranscriptChunk;
      if (budgetLeft() < plan.chunkSecs / 60) throw Object.assign(new Error("budget"), { soft: true });
      const audioStart = p.info?.audioStart ?? 0;
      const bps = p.info?.bytesPerSec ?? plan.bps;
      const from = chunk === 0 ? 0 : Math.floor(audioStart + chunk * plan.chunkSecs * bps);
      const to = Math.min(p.total - 1, Math.floor(audioStart + (chunk + 1) * plan.chunkSecs * bps) - 1);
      const res = await web(ep.audio, { headers: { Range: `bytes=${from}-${to}`, "User-Agent": AUDIO_AGENT }, signal: AbortSignal.timeout(60_000) });
      if (!res.ok && res.status !== 206) throw new Error(`audio ${res.status}`);
      const blob = await res.blob();
      if (blob.size > 25_000_000) throw Object.assign(new Error("size"), { soft: true });
      minutesToday += plan.chunkSecs / 60;
      const out = await transcribe(blob, `piece-${chunk}.mp3`);
      const start = chunk * plan.chunkSecs;
      const segments = out.segments.map((s) => ({ s: start + s.start, e: start + s.end, t: s.text.trim() })).filter((s) => s.t);
      const words: Word[] = (out.words ?? []).map((w) => ({ s: start + w.start, e: start + w.end, w: w.word.trim() })).filter((w) => w.w);
      const ads = await analyzeAds({ showId, showName: show?.name ?? ep.show, title: ep.title, about: ep.about, pieceId: `${ep.id}#${chunk}`, segs: segments, words, chapters, duration: exact || ep.secs, from: start, to: start + plan.chunkSecs, opening: chunk <= 0 });
      return { source: "ai", segments, words, ads, chapters, chunk, chunkSecs: plan.chunkSecs, more: chunk + 1 < plan.chunks, dur: exact || undefined, durMode: "exact", v: 2 } as TranscriptChunk;
    }).catch((e: any) => {
      if (e?.message === "budget") return { ...none("Read along has hit today's limit. Try again tomorrow."), chapters };
      if (e?.message === "format") return { ...none("Read along works on MP3 podcasts, and this one isn't."), chapters };
      if (e?.message === "size") return { ...none("This episode's audio is too large to read along."), chapters };
      console.error("[earshot] transcript:", e?.message);
      return { ...none("The transcript couldn't be made right now. Try again in a minute."), chapters, retry: true };
    });
  }

  /** Words that help the transcriber spell the show and its sponsors. */
  async function transcribePrompt(showId: string, showName: string) {
    const prof = (await profiles.peek(showId))?.value;
    const sponsors = prof ? Object.entries(prof.sponsors || {}).sort((a, b) => b[1] - a[1]).slice(0, 12).map((x) => x[0]) : [];
    // Names only (a label like "Sponsors:" gets written into the transcript by some models).
    return [showName, ...sponsors].filter(Boolean).join(", ") + ".";
  }

  /** One 10-minute piece of an episode's show audio (stitched-in ads left out), transcribed from a
   *  listener's copy, with its ads. Made once and kept for everyone; the frame keys in its pieces
   *  line it up with any other copy. Publisher transcripts are already in content time. */
  async function contentTranscript(showId: string, episodeId: string, chunk: number, src: ContentSource): Promise<ContentChunk> {
    const none = (reason: string): ContentChunk => ({ v: 3, source: "none", segments: [], ads: [], chapters: [], chunk, chunkSecs: TX_CHUNK_SECS, more: false, reason, pieces: [] });
    const { show, ep } = await findEpisode(showId, episodeId);
    if (!ep) return none("This episode isn't available anymore.");
    // chunk -1: the opening (first 2.5 minutes), made right away so ads at the start are known before they play.
    const opening = chunk === -1;
    const key = opening ? `${ep.id}:o` : `${ep.id}:${chunk}`;
    const done = await ctx.peek(key);
    if (done) return done.value;
    if (opening) { const c0 = await ctx.peek(`${ep.id}:0`); if (c0) return c0.value; }
    const showName = show?.name ?? ep.show;
    const ex = await publisherExtras(show, ep);
    let chapters: Chapter[] = [];
    if (ex.chapters && chunk === 0) { try { chapters = parseChaptersJson(JSON.parse(await getText(ex.chapters, 2_000_000))); } catch { /* none */ } }
    if (ex.transcript) {
      const pub = await ctx.refresh(`${ep.id}:pub`, async () => {
        const raw = await getText(ex.transcript!.url, 6_000_000);
        const segments = /json/.test(ex.transcript!.type) ? parseTranscriptJson(JSON.parse(raw)) : parseCues(raw);
        if (!segments.length) throw new Error("empty");
        const last = segments[segments.length - 1].e;
        const ads = await analyzeAds({ showId, showName, title: ep.title, about: ep.about, pieceId: `${ep.id}#pub`, segs: segments, words: [], chapters, duration: Math.max(src.secs, last), from: 0, to: Math.max(src.secs, last), opening: true });
        return { v: 3, source: "publisher", segments, ads, chapters, chunk: 0, chunkSecs: Math.max(src.secs, last), more: false, pieces: [] } as ContentChunk;
      }).catch(() => null);
      // Only when it's timed to the show alone: some publishers time theirs to a copy with ad
      // breaks in it, and then every line after the first break would land in the wrong place.
      const end = pub?.segments.length ? pub.segments[pub.segments.length - 1].e : 0;
      if (pub && Math.abs(end - src.secs) <= Math.max(25, src.secs * 0.03)) return pub;
    }
    if (!aiOn()) return { ...none("This show doesn't publish a transcript."), chapters };
    const chunks = Math.max(1, Math.ceil(src.secs / TX_CHUNK_SECS - 0.01));
    if (chunk >= chunks) return { ...none(""), source: "ai", chapters };
    const OPENING = 150;
    return ctx.refresh(key, async () => {
      if (budgetLeft() < (opening ? OPENING : TX_CHUNK_SECS) / 60) throw Object.assign(new Error("budget"), { soft: true });
      const from = opening ? 0 : chunk * TX_CHUNK_SECS, to = Math.min(src.secs, from + (opening ? OPENING : TX_CHUNK_SECS));
      const part = await src.extract(from, to);
      if (part.audio.size > 25_000_000) throw Object.assign(new Error("size"), { soft: true });
      if (!part.audio.size) throw new Error("no audio");
      minutesToday += (to - from) / 60;
      const out = await transcribe(part.audio, `piece-${chunk}.mp3`, await transcribePrompt(showId, showName));
      const segments = out.segments.map((x) => ({ s: from + x.start, e: from + x.end, t: x.text.trim() })).filter((x) => x.t);
      const words: Word[] = (out.words ?? []).map((w) => ({ s: from + w.start, e: from + w.end, w: w.word.trim() })).filter((w) => w.w);
      const ads = await analyzeAds({ showId, showName, title: ep.title, about: ep.about, pieceId: `${ep.id}#c${chunk}`, segs: segments, words, chapters, duration: src.secs, from, to, opening: chunk <= 0 });
      return { v: 3, source: "ai", segments, words, ads, chapters, chunk, chunkSecs: opening ? OPENING : TX_CHUNK_SECS, more: !opening && chunk + 1 < chunks, pieces: part.pieces } as ContentChunk;
    }).catch((e: any) => {
      if (e?.message === "budget") return { ...none("Read along has hit today's limit. Try again tomorrow."), chapters };
      if (e?.message === "size") return { ...none("This episode's audio is too large to read along."), chapters };
      console.error("[earshot] transcript (copy):", e?.message);
      return { ...none("The transcript couldn't be made right now. Try again in a minute."), chapters, retry: true };
    });
  }
  /** In a slot the host fills per listener, an ad usually runs from where the inserted material
   *  begins: the AI often marks only a promo's sign-off, so its start moves back to the longest pause
   *  (1.5 s or more, within 90 s) before it. */
  function widenInserted(ads: AdRange[], segs: TxSegment[]): AdRange[] {
    return ads.map((a) => {
      const before = segs.filter((g) => g.e <= a.s + 0.3 && g.s >= a.s - 90);
      let best = -1, gap = 1.5;
      for (let i = 1; i < before.length; i++) { const p = before[i].s - before[i - 1].e; if (p >= gap) { gap = p; best = i; } }
      return best < 0 || before[best].s >= a.s ? a : { ...a, s: before[best].s };
    });
  }
  /** One stretch of a listener's copy that no read-along piece covers, transcribed and read for ads.
   *  Kept by its fingerprint, so another listener whose copy has the same stretch gets it at once.
   *  Ads come back in seconds from the stretch's start. */
  async function copyPieceAds(showId: string, episodeId: string, fp: string, audio: Blob, secs: number): Promise<AdRange[] | null> {
    if (!/^[0-9a-z]{1,24}$/.test(fp)) throw new Error("bad fingerprint");
    if (!aiOn()) throw new Error("ai off");
    const key = `${episodeId}:g:${fp}`;
    const done = await ctx.peek(key);
    const redo = done && (done.value as any).aiFailed && Date.now() - ((done.value as any).at ?? 0) > 5 * 60_000;
    if (done && !redo) return done.value.ads;
    // The show's name and the episode's title only help (spelling, the AI's hint): Apple being busy mustn't stop this.
    const found = await findEpisode(showId, episodeId).catch(() => null);
    const ep = found?.ep ?? null;
    const showName = found?.show?.name ?? ep?.show ?? "";
    const c = await ctx.refresh(key, async () => {
      // Transcribed already, but the AI couldn't read it then: read it again (text only).
      if (redo && done!.value.segments.length) {
        const status: { aiFailed?: boolean } = {};
        const ads = await analyzeAds({ showId, showName, title: ep?.title, about: ep?.about, pieceId: `${episodeId}#g${fp}`, segs: done!.value.segments, words: (done!.value as any).words ?? [], chapters: [], duration: secs, from: 0, to: secs, opening: false, status, inserted: true });
        return { ...done!.value, ads: widenInserted(ads, done!.value.segments), aiFailed: status.aiFailed || undefined, at: Date.now() } as ContentChunk;
      }
      if (budgetLeft() < secs / 60) throw new Error("budget");
      if (!audio.size || audio.size > 25_000_000) throw new Error("size");
      minutesToday += secs / 60;
      const out = await transcribe(audio, `gap-${fp}.mp3`, await transcribePrompt(showId, showName));
      const segments = out.segments.map((x) => ({ s: x.start, e: x.end, t: x.text.trim() })).filter((x) => x.t);
      const words: Word[] = (out.words ?? []).map((w) => ({ s: w.start, e: w.end, w: w.word.trim() })).filter((w) => w.w);
      const status: { aiFailed?: boolean } = {};
      const ads = segments.length ? await analyzeAds({ showId, showName, title: ep?.title, about: ep?.about, pieceId: `${episodeId}#g${fp}`, segs: segments, words, chapters: [], duration: secs, from: 0, to: secs, opening: false, status, inserted: true }) : [];
      return { v: 3, source: "ai", segments, words, ads: widenInserted(ads, segments), chapters: [], chunk: -2, chunkSecs: secs, more: false, pieces: [], aiFailed: status.aiFailed || undefined, at: Date.now() } as ContentChunk;
    });
    return c.ads;
  }
  /** Content-time pieces already made for an episode (nothing new is made). */
  async function contentChunks(episodeId: string): Promise<ContentChunk[]> {
    const keys = [`${episodeId}:pub`, `${episodeId}:o`, ...Array.from({ length: 24 }, (_, i) => `${episodeId}:${i}`)];
    await ctx.preload(keys);
    return keys.map((k) => ctx.peekMemory(k)).filter((c): c is ContentChunk => !!c && c.source !== "none");
  }

  /** The ads already found for an episode (from saved transcript pieces), without making anything new. */
  async function foundAds(episodeId: string): Promise<ServerAd[]> {
    const keys = [`${episodeId}:pub`, ...Array.from({ length: 24 }, (_, i) => `${episodeId}:${i}`)];
    await tx.preload(keys);
    const out: ServerAd[] = [];
    const seen = new Set<string>();
    for (const k of keys) {
      const c = tx.peekMemory(k);
      if (!c || !c.ads?.length) continue;
      const dur = c.dur ?? 0;
      for (const a of c.ads) {
        const key = `a:${episodeId}:${Math.round(dur)}:${Math.round(a.s)}:${Math.round(a.e)}`;
        if (seen.has(key)) continue; seen.add(key);
        out.push({ key, s: a.s, e: a.e, label: a.label || "Ad break", kind: (a.kind as ServerAd["kind"]) || "ai", conf: a.conf ?? 0.8, dur, durMode: c.durMode ?? "exact" });
      }
    }
    return out;
  }

  /** A listener marked an ad: the show remembers its sponsor and how it started. */
  async function learnMark(showId: string, episodeId: string, mark: { s: number; e: number; label?: string; dur: number }) {
    const keys = [`${episodeId}:pub`, ...Array.from({ length: 24 }, (_, i) => `${episodeId}:${i}`)];
    await tx.preload(keys);
    const piece = keys.map((k) => tx.peekMemory(k)).find((c) => c && c.segments.length && (!c.dur || Math.abs(c.dur - mark.dur) <= 1.5 || c.durMode === "approx") && c.segments[0].s <= mark.s && c.segments[c.segments.length - 1].e >= mark.s);
    await profiles.refresh(showId, async () => learnFromMark((await profiles.peek(showId))?.value ?? emptyProfile(), piece?.segments ?? [], mark)).catch(() => {});
  }

  /** "Find me a podcast": AI reads what someone wants and picks real shows, mostly from the shows the
   *  server already knows (so they play at once), searching Apple for up to two it names besides.
   *  The AI only sees the few hundred known shows that best match the words asked for, so the request
   *  stays small enough for the free backup models. If no AI can answer, a plain search does: it
   *  never comes back empty-handed just because the AI is busy or out of credit. */
  async function aiFind(q: string, o: { explicit: boolean; kidOnly: boolean }): Promise<{ picks: { show: PodShow; why: string; episode: PodEpisode | null }[]; summary: string; ai: boolean }> {
    const genres = GENRES.filter((g) => !o.kidOnly || g.kidSafe);
    const pools = await Promise.all(genres.map((g) => within(pool(g.id, o.explicit), 4000, [] as PoolShow[])));
    const known = new Map<string, PoolShow>();
    pools.forEach((list, gi) => list.forEach((p) => { if (!known.has(p.show.id)) known.set(p.show.id, { ...p, show: { ...p.show, genre: p.show.genre || genres[gi].id } }); }));
    const words = findWords(q);
    // Score each known show by the asked-for words in its name, host, genre and newest episodes.
    const scored = Array.from(known.values()).map((p) => {
      const g = GENRE[p.show.genre];
      const hay = `${p.show.name} ${p.show.author} ${g?.name ?? ""} ${p.episodes.slice(0, 3).map((e) => `${e.title} ${e.about.slice(0, 160)}`).join(" ")}`.toLowerCase();
      const score = words.reduce((n, w) => n + (hay.includes(w) ? (p.show.name.toLowerCase().includes(w) ? 3 : 1) : 0) + (g && g.name.toLowerCase().includes(w) ? 2 : 0), 0);
      return { p, score };
    });
    const best = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.p.rank - b.p.rank).slice(0, 160).map((x) => x.p);
    // Plus the most popular few of every genre, so a mood ("something cozy") still has choices.
    const popular = pools.flatMap((list) => list.slice(0, 4)).filter((p) => !best.includes(p));
    const shortlist = [...best, ...popular].slice(0, 260);
    const catalog = shortlist.map((p) => `${p.show.id}|${p.show.name}|${GENRE[p.show.genre]?.name ?? ""}`).join("\n").slice(0, 14_000);
    const fallback = async () => {
      // No AI: Apple's own search for the words, then the best matches among the known shows.
      const out: { show: PodShow; why: string; episode: PodEpisode | null }[] = [];
      try {
        const res = await searches.get(q.toLowerCase(), async () => {
          const shows = await apple(appleSearchUrl(q, "podcast", 25, true));
          return { shows: (Array.isArray(shows?.results) ? shows.results : []).map((r: unknown) => parseShow(r)).filter(Boolean) as PodShow[], episodes: [] };
        });
        for (const show of res.shows) if ((o.explicit || !show.explicit) && (!o.kidOnly || GENRE[show.genre]?.kidSafe)) out.push({ show, why: `Matches "${q.slice(0, 60)}".`, episode: known.get(show.id)?.episodes[0] ?? null });
      } catch { /* Apple busy: the known shows below still answer */ }
      for (const p of best.slice(0, 10)) out.push({ show: p.show, why: `A popular ${GENRE[p.show.genre]?.name ?? ""} show that fits what you asked for.`.replace("  ", " "), episode: p.episodes[0] ?? null });
      const seen = new Set<string>();
      const picks = out.filter((p) => !seen.has(p.show.id) && (seen.add(p.show.id), true)).slice(0, 10);
      return { summary: picks.length ? "Here are shows that match what you asked for." : "", picks, ai: false };
    };
    if (!aiOn()) return fallback();
    const system = `You help people find podcasts they'll love. Pick 6 to 10 real podcasts that fit the request best. Prefer shows from the catalog (id|name|genre) and give their id; you may also name up to 2 real, well-known podcasts not in the catalog (no id). For each, write one short sentence on why it fits, in second person. ${o.kidOnly ? "The listener is a student: only pick shows suitable for kids and teens. " : ""}Answer with JSON only: {"summary":"<one short sentence>","picks":[{"id":"<catalog id or empty>","name":"<podcast name>","why":"<reason>"}]}`;
    let raw = "";
    try { raw = await ask(system, `Request: ${q}\n\nCatalog:\n${catalog}`); }
    catch (e: any) { console.warn("[earshot] ai-find falling back to search:", e?.message); return fallback(); }
    let v: any; try { v = JSON.parse(raw); } catch { v = null; }
    const out: { show: PodShow; why: string; episode: PodEpisode | null }[] = [];
    let searched = 0;
    for (const pk of Array.isArray(v?.picks) ? v.picks.slice(0, 10) : []) {
      const why = String(pk?.why || "").slice(0, 200);
      const hit = known.get(String(pk?.id || "")) ?? Array.from(known.values()).find((p) => p.show.name.toLowerCase() === String(pk?.name || "").toLowerCase());
      if (hit) { out.push({ show: hit.show, why, episode: hit.episodes[0] ?? null }); continue; }
      const name = String(pk?.name || "").trim();
      if (!name || searched >= 2) continue;
      searched++;
      try {
        const res = await searches.get(name.toLowerCase(), async () => {
          const shows = await apple(appleSearchUrl(name, "podcast", 5, true));
          return { shows: (Array.isArray(shows?.results) ? shows.results : []).map((r: unknown) => parseShow(r)).filter(Boolean) as PodShow[], episodes: [] };
        });
        const show = res.shows.find((x) => (o.explicit || !x.explicit) && (!o.kidOnly || GENRE[x.genre]?.kidSafe));
        if (show) out.push({ show, why, episode: null });
      } catch { /* Apple busy: skip it */ }
    }
    if (!out.length) return fallback();
    const seen = new Set<string>();
    return { summary: String(v?.summary || "").slice(0, 200), picks: out.filter((p) => !seen.has(p.show.id) && (seen.add(p.show.id), true)), ai: true };
  }

  // ---- Explore previews: each episode's best ~45 seconds ----
  const moments = layeredCache<Moment>(kv, "m1:", 365 * 24 * 3600_000, 3000);
  const MOMENT_WINDOW = 180, MOMENTS_PER_DAY = Number(process.env.EARSHOT_MOMENTS_PER_DAY) || 150;
  let momentDay = ""; let momentsToday = 0;
  /** Where an MP3 episode's audio starts and how many bytes a second takes (from the host's copy, as a bot). */
  async function audioMap(showId: string, episodeId: string) {
    const { ep } = await findEpisode(showId, episodeId);
    if (!ep) throw Object.assign(new Error("gone"), { soft: true });
    const p = await probe(ep.audio);
    if (!p.info || !p.total) throw Object.assign(new Error("format"), { soft: true });
    return { ep, total: p.total, start: p.info.audioStart, bps: p.info.bytesPerSec, dur: p.info.duration || ep.secs };
  }
  /** The audio between s and e seconds of an episode (the host's copy, as fetched for its transcript). */
  async function cutRange(showId: string, episodeId: string, s: number, e: number): Promise<Blob> {
    const m = await audioMap(showId, episodeId);
    const from = Math.floor(m.start + Math.max(0, s) * m.bps), to = Math.min(m.total - 1, Math.floor(m.start + e * m.bps) - 1);
    if (!(to > from) || to - from > 4_000_000) throw Object.assign(new Error("range"), { soft: true });
    const res = await web(m.ep.audio, { headers: { Range: `bytes=${from}-${to}`, "User-Agent": AUDIO_AGENT }, signal: AbortSignal.timeout(30_000) });
    if (res.status !== 206 && !res.ok) throw new Error(`audio ${res.status}`);
    const blob = await res.blob();
    // A host that ignores Range sends the whole file: never pass that on as a clip.
    if (res.status !== 206 || blob.size > 4_000_000) throw Object.assign(new Error("range"), { soft: true });
    return new Blob([blob], { type: "audio/mpeg" });
  }
  /** The best ~45 seconds of an episode for a preview. Three minutes from about a third of the way in
   *  (past intros and pre-rolls) are transcribed and the AI picks the strongest stretch that stands on
   *  its own, never an ad. Without AI, or past today's limit, it's 45 seconds from that point. Kept for
   *  everyone, so each episode is only read once. */
  async function moment(showId: string, episodeId: string): Promise<Moment> {
    const known = await moments.peek(episodeId);
    if (known) return known.value;
    if (aiStrained() && !options.transcribe) {
      const m = await audioMap(showId, episodeId);
      const w0 = Math.max(0, Math.min(Math.round(m.dur * 0.33), Math.round(m.dur - MOMENT_WINDOW - 5)));
      return { s: w0 + 15, e: Math.min(m.dur, w0 + 60), quote: "", hook: "", best: false, temp: true };
    }
    return moments.refresh(episodeId, async () => {
      const m = await audioMap(showId, episodeId);
      const w0 = Math.max(0, Math.min(Math.round(m.dur * 0.33), Math.round(m.dur - MOMENT_WINDOW - 5)));
      const plain: Moment = { s: w0 + 15, e: Math.min(m.dur, w0 + 60), quote: "", hook: "", best: false };
      const today = new Date().toISOString().slice(0, 10);
      if (today !== momentDay) { momentDay = today; momentsToday = 0; }
      if (!aiOn() || momentsToday >= MOMENTS_PER_DAY || budgetLeft() < MOMENT_WINDOW / 60) return plain;
      momentsToday++;
      const audio = await cutRange(showId, episodeId, w0, w0 + MOMENT_WINDOW);
      minutesToday += MOMENT_WINDOW / 60;
      const out = await transcribe(audio, `moment-${episodeId}.mp3`);
      const segs = out.segments.map((x) => ({ s: w0 + x.start, e: w0 + x.end, t: x.text.trim() })).filter((x) => x.t);
      if (segs.length < 3) return plain;
      const pick = pickMoment(segs, await ask(MOMENT_SYSTEM, segs.map((x, i) => `#${i} [${Math.round(x.s - w0)}s] ${x.t}`).join("\n")).catch(() => null));
      return pick ?? { ...plain, quote: segs.find((x) => x.s >= plain.s)?.t ?? "" };
    });
  }
  /** Keeps where a moment's audio is stored, once it's been cut and saved. */
  const keepMomentAudio = (episodeId: string, m: Moment, audio: string) => moments.refresh(episodeId, async () => ({ ...m, audio }));

  return { aiFind, pool, loadShow, loadGenreShows, searches, apple, warm, transcript, contentTranscript, contentChunks, copyPieceAds, foundAds, learnMark, profiles, idle, budgetLeft, cutRange, moment, keepMomentAudio };
}
export type Directory = ReturnType<typeof createDirectory>;
