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
  AD_PROMPT, GENRES, GENRE, TX_CHUNK_SECS, adUserMessage, adsFromAi, adsFromChapters, appleLookupUrl, appleSearchUrl, bestTranscript, chunkPlan,
  lightEpisode, mergeAds, mergeGenreShows, parseChaptersJson, parseCues, parseEpisode, parseShow, parseTranscriptJson, poolFromEpisodeSearch, rssExtrasFor,
  type AdRange, type Chapter, type PodEpisode, type PodShow, type PoolShow, type TranscriptChunk, type TxSegment,
} from "../shared/earshot";

// ---------------------------------------------------------------------------
// Storage that survives restarts
// ---------------------------------------------------------------------------

export interface KV {
  get(key: string): Promise<{ value: any; at: number } | null>;
  set(key: string, value: any): Promise<void>;
}
export function memoryKV(): KV {
  const m = new Map<string, { value: any; at: number }>();
  return { async get(k) { return m.get(k) ?? null; }, async set(k, value) { m.set(k, { value, at: Date.now() }); } };
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

export function layeredCache<T>(kv: KV, prefix: string, ttlMs: number, max = 2000) {
  const mem = new Map<string, { at: number; value: T }>();
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
export type Transcriber = (audio: Blob, name: string) => Promise<{ segments: { start: number; end: number; text: string }[] }>;

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

export const openAiJson: AskJson = async (system, user) => {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4.1-mini", temperature: 0, max_tokens: 1500, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(res.status === 429 ? "busy" : `ai ${res.status}`);
  const body: any = await res.json().catch(() => null);
  return String(body?.choices?.[0]?.message?.content || "");
};
export const openAiTranscribe: Transcriber = async (audio, name) => {
  const form = new FormData();
  form.append("file", audio, name);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form, signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(res.status === 429 ? "busy" : `transcribe ${res.status}`);
  const body: any = await res.json();
  return { segments: (Array.isArray(body?.segments) ? body.segments : []).map((s: any) => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text || "") })) };
};

export function createDirectory(options: DirectoryOptions = {}) {
  const kv = options.kv ?? memoryKV();
  const apple = options.fetcher ?? pacedFetcher(appleFetcher);
  const idle = () => (typeof (apple as any).idle === "function" ? (apple as any).idle() : true);
  const web = options.web ?? fetch;
  const ask = options.ask ?? openAiJson;
  const transcribe = options.transcribe ?? openAiTranscribe;
  const aiOn = options.aiOn ?? (() => !!process.env.OPENAI_API_KEY);
  const perDay = options.minutesPerDay ?? (Number(process.env.EARSHOT_AI_MINUTES_PER_DAY) || 300);

  const genreShows = layeredCache<PodShow[]>(kv, "g2:", 12 * 3600_000, 100);
  const genreEpisodes = layeredCache<PoolShow[]>(kv, "ge:", 12 * 3600_000, 100);
  const shows = layeredCache<ShowLookup>(kv, "s2:", 6 * 3600_000, 3000);
  const searches = layeredCache<{ shows: PodShow[]; episodes: PodEpisode[] }>(kv, "q:", 3600_000, 500);
  const extras = layeredCache<{ transcript: { url: string; type: string } | null; chapters: string }>(kv, "x:", 24 * 3600_000, 2000);
  const tx = layeredCache<TranscriptChunk>(kv, "t:", 365 * 24 * 3600_000, 1500);

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

  /** A genre's pool: its top shows with episodes already known, topped up by episode search while warming. */
  async function pool(gid: string, explicit: boolean): Promise<PoolShow[]> {
    const list = await loadGenreShows(gid).catch(async () => (await genreShows.peek(gid))?.value ?? []);
    const out: PoolShow[] = [];
    for (let rank = 0; rank < list.length; rank++) {
      const s = list[rank];
      if (!explicit && s.explicit) continue;
      const known = shows.peekMemory(s.id) ?? (await shows.peek(s.id))?.value;
      const eps = (known?.episodes ?? []).filter((e) => explicit || !e.explicit).slice(0, 3).map(lightEpisode);
      if (eps.length) out.push({ show: { ...s, genre: gid }, rank, episodes: eps });
    }
    if (out.length < 12) {
      const extra = await loadGenreEpisodes(gid).catch(() => [] as PoolShow[]);
      const have = new Set(out.map((p) => p.show.id));
      for (const p of extra) if (!have.has(p.show.id) && (explicit || !p.show.explicit)) { out.push({ ...p, rank: 30 + p.rank, episodes: p.episodes.filter((e) => explicit || !e.explicit) }); have.add(p.show.id); }
    }
    return out.filter((p) => p.episodes.length).slice(0, 40);
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
  async function findAds(segs: TxSegment[]): Promise<AdRange[]> {
    if (!aiOn() || !segs.length) return [];
    const out: AdRange[] = [];
    for (let i = 0; i < segs.length; i += 400) {
      const part = segs.slice(i, i + 400);
      try { out.push(...adsFromAi(await ask(AD_PROMPT, adUserMessage(part, i)), segs, 0)); } catch { /* no ads marked beats no transcript */ }
    }
    return mergeAds(out);
  }

  /** One piece of an episode's transcript (publisher transcripts arrive whole, as chunk 0). */
  async function transcript(showId: string, episodeId: string, chunk: number): Promise<TranscriptChunk> {
    const none = (reason: string): TranscriptChunk => ({ source: "none", segments: [], ads: [], chapters: [], chunk, chunkSecs: TX_CHUNK_SECS, more: false, reason });
    const { show, ep } = await findEpisode(showId, episodeId);
    if (!ep) return none("This episode isn't available anymore.");
    const key = `${ep.id}:${chunk}`;
    const done = await tx.peek(key);
    if (done) return done.value;
    const ex = await publisherExtras(show, ep);
    let chapters: Chapter[] = [];
    if (ex.chapters && chunk === 0) { try { chapters = parseChaptersJson(JSON.parse(await getText(ex.chapters, 2_000_000))); } catch { /* none */ } }
    if (ex.transcript) {
      const pub = await tx.refresh(`${ep.id}:pub`, async () => {
        const raw = await getText(ex.transcript!.url, 6_000_000);
        const segments = /json/.test(ex.transcript!.type) ? parseTranscriptJson(JSON.parse(raw)) : parseCues(raw);
        if (!segments.length) throw new Error("empty");
        const ads = mergeAds([...adsFromChapters(chapters, ep.secs), ...(await findAds(segments))]);
        return { source: "publisher", segments, ads, chapters, chunk: 0, chunkSecs: Math.max(ep.secs, segments[segments.length - 1].e), more: false };
      }).catch(() => null);
      if (pub) { void tx.refresh(key, async () => pub).catch(() => {}); return pub; }
    }
    if (!aiOn()) return { ...none("This show doesn't publish a transcript."), chapters };
    return tx.refresh(key, async () => {
      // How big the file is, so a piece can be cut by bytes.
      const head = await web(ep.audio, { headers: { Range: "bytes=0-1", "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(15_000) });
      const total = Number((head.headers.get("content-range") || "").split("/")[1]) || Number(head.headers.get("content-length") || 0);
      const type = String(head.headers.get("content-type") || "");
      try { await head.body?.cancel(); } catch { /* fine */ }
      const isMp3 = /mpeg|mp3/i.test(type) || /\.mp3(\?|$)/i.test(ep.audio);
      if (!isMp3 || !total) throw Object.assign(new Error("format"), { soft: true });
      const plan = chunkPlan(total, ep.secs);
      if (chunk >= plan.chunks) return { ...none(""), source: "ai", more: false, chunkSecs: plan.chunkSecs };
      if (budgetLeft() < plan.chunkSecs / 60) throw Object.assign(new Error("budget"), { soft: true });
      const from = Math.floor(chunk * plan.chunkSecs * plan.bps), to = Math.min(total - 1, Math.floor((chunk + 1) * plan.chunkSecs * plan.bps) - 1);
      const res = await web(ep.audio, { headers: { Range: `bytes=${from}-${to}`, "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60_000) });
      if (!res.ok && res.status !== 206) throw new Error(`audio ${res.status}`);
      const blob = await res.blob();
      if (blob.size > 25_000_000) throw Object.assign(new Error("size"), { soft: true });
      minutesToday += plan.chunkSecs / 60;
      const out = await transcribe(blob, `piece-${chunk}.mp3`);
      const start = chunk * plan.chunkSecs;
      const segments = out.segments.map((s) => ({ s: start + s.start, e: start + s.end, t: s.text.trim() })).filter((s) => s.t);
      const ads = mergeAds([...adsFromChapters(chapters, ep.secs).filter((a) => a.e > start && a.s < start + plan.chunkSecs), ...(await findAds(segments))]);
      return { source: "ai", segments, ads, chapters, chunk, chunkSecs: plan.chunkSecs, more: chunk + 1 < plan.chunks };
    }).catch((e: any) => {
      if (e?.message === "budget") return { ...none("Read along has hit today's limit. Try again tomorrow."), chapters };
      if (e?.message === "format") return { ...none("Read along works on MP3 podcasts, and this one isn't."), chapters };
      if (e?.message === "size") return { ...none("This episode's audio is too large to read along."), chapters };
      console.error("[earshot] transcript:", e?.message);
      return { ...none("The transcript couldn't be made right now. Try again in a minute."), chapters };
    });
  }

  return { pool, loadShow, loadGenreShows, searches, apple, warm, transcript, idle, budgetLeft };
}
export type Directory = ReturnType<typeof createDirectory>;
