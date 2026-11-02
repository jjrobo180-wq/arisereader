// Up to the Minute News (a Pod+ hub): only news episodes published in the last few hours, newest
// first. Older ones drop out on their own as the clock moves.
//
// Where the episodes come from: hourly and daily news shows (NPR News Now, CBS News Roundup, BBC...)
// plus the top shows in the News genre. Every 10 minutes, whenever Apple isn't busy with listeners,
// their newest episodes are asked for, ten shows per request. Nothing here waits on Apple when someone
// opens the hub: it answers from what the last round found.
import { appleSearchUrl, parseEpisode, parseShow, type PodEpisode, type PodShow, type PoolShow } from "../shared/earshot";

/** Hourly bulletins and big daily news shows, by name (found on Apple once a day). */
export const NOW_NEWS_SHOWS = [
  "NPR News Now", "CBS News Roundup", "ABC News Update", "BBC Global News Podcast", "Up First from NPR",
  "The Daily", "WSJ Minute Briefing", "WSJ What's News", "Fox News Rundown", "CNN 5 Things",
  "Bloomberg News Now", "AP News Minute", "Reuters World News", "NBC News Top Stories", "PBS News Hour",
  "Morning Wire", "Today, Explained", "Post Reports", "Marketplace Morning Report", "The Journal.",
  "Global News Podcast", "Apple News Today", "Consider This from NPR", "The Intelligence from The Economist",
];

export const NOW_HOURS_DEFAULT = 6;
export const NOW_HOURS_MAX = 24;
const KEEP_HOURS = 30; // remembered this long; shown only within the asked window
const ROUND_MS = 10 * 60_000;
const NAMES_MS = 24 * 3600_000;

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
/** Is this Apple result the show we asked for (not a reaction show with the same words)? */
export function sameShowName(asked: string, found: string): boolean {
  const a = norm(asked), f = norm(found);
  if (!a || !f) return false;
  return f === a || f.startsWith(`${a} `) || a.startsWith(`${f} `) || (a.length >= 8 && f.includes(a));
}

/** Newest first, within `hours`, at most `perShow` per show (an hourly bulletin shouldn't fill the page). */
export function freshNews(list: PodEpisode[], hours: number, now = Date.now(), perShow = 3): PodEpisode[] {
  const since = now - hours * 3600_000;
  const per = new Map<string, number>(); const seen = new Set<string>(); const out: PodEpisode[] = [];
  for (const e of list.slice().sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))) {
    const t = Date.parse(e.date);
    if (!Number.isFinite(t) || t < since || t > now + 15 * 60_000 || seen.has(e.id)) continue;
    if (!/^https:\/\//i.test(e.audio || "")) continue;
    const n = per.get(e.showId) ?? 0; if (n >= perShow) continue;
    per.set(e.showId, n + 1); seen.add(e.id); out.push(e);
  }
  return out;
}

// ---- The shows' own RSS feeds: Apple's episode lookup can run many hours behind an hourly bulletin
// (NPR News Now showed yesterday's 4pm news the next morning), so the named shows are also read
// straight from their feeds every round. ----
const tag = (xml: string, name: string) => { const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i")); return m ? m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").trim() : ""; };
const attr = (xml: string, name: string, a: string) => { const m = xml.match(new RegExp(`<${name}\\s[^>]*\\b${a}=["']([^"']+)["']`, "i")); return m ? m[1].replace(/&amp;/g, "&") : ""; };
const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, "&");
/** Plain text from feed text (often HTML, escaped once or twice). */
const unescape = (s: string) => decode(decode(s).replace(/<[^>]+>/g, " ")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
function durationSecs(v: string): number {
  if (!v) return 0;
  const p = v.trim().split(":").map(Number);
  if (p.some((n) => !Number.isFinite(n))) return 0;
  return Math.round(p.reduce((t, n) => t * 60 + n, 0));
}
/** A number id for a feed episode (episode ids are numbers everywhere): 19 digits starting with 9,
 *  so it never meets one of Apple's (13 digits or fewer). */
export function feedEpisodeId(showId: string, guid: string): string {
  let a = 0x811c9dc5, b = 0x01000193;
  for (const c of `${showId}|${guid}`) { const k = c.charCodeAt(0); a = Math.imul(a ^ k, 16777619) >>> 0; b = Math.imul(b ^ k, 2246822519) >>> 0; }
  return `9${String(a).padStart(10, "0")}${String(b % 1e8).padStart(8, "0")}`.slice(0, 19);
}
/** The newest `max` episodes in a show's RSS feed. */
export function feedEpisodes(xml: string, show: PodShow, max = 4): PodEpisode[] {
  const out: PodEpisode[] = [];
  for (const raw of String(xml).split(/<item[\s>]/i).slice(1)) {
    const item = raw.split(/<\/item>/i)[0];
    let audio = attr(item, "enclosure", "url");
    if (/^http:\/\//i.test(audio)) audio = audio.replace(/^http:/i, "https:");
    const title = unescape(tag(item, "title")).slice(0, 300);
    const t = Date.parse(tag(item, "pubDate"));
    if (!/^https:\/\//i.test(audio) || !title || !Number.isFinite(t)) continue;
    const guid = tag(item, "guid") || audio;
    out.push({
      id: feedEpisodeId(show.id, guid), showId: show.id, show: show.name, author: show.author, title,
      about: unescape(tag(item, "description") || tag(item, "itunes:summary")).slice(0, 2000),
      audio, date: new Date(t).toISOString(), secs: durationSecs(tag(item, "itunes:duration")),
      art: attr(item, "itunes:image", "href") || show.art, link: tag(item, "link") || show.link, explicit: show.explicit,
    });
    if (out.length >= max) break;
  }
  return out;
}
/** Feed episodes that Apple already has (same show, same title) are dropped: Apple's ids are kept. */
export function mergeFeed(apple: PodEpisode[], feed: PodEpisode[]): PodEpisode[] {
  const key = (e: PodEpisode) => `${e.showId}|${norm(e.title)}`;
  const have = new Set(apple.map(key));
  return [...apple, ...feed.filter((e) => !have.has(key(e)))];
}

export type NowDeps = {
  /** A show's RSS feed, as text (tests). */
  feed?: (url: string) => Promise<string>;
  apple: (url: string) => Promise<any>;
  idle: () => boolean;
  /** The News genre's top shows. */
  newsPool: () => Promise<PoolShow[]>;
  /** New episodes go into the show cache too, so opening one finds it at once. */
  remember?: (show: PodShow | null, episodes: PodEpisode[]) => void;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export function nowNewsService(d: NowDeps) {
  const now = d.now ?? (() => Date.now());
  const sleep = d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const shows = new Map<string, PodShow>();
  const named = new Set<string>();
  const readFeed = d.feed ?? (async (url: string) => {
    const r = await fetch(url, { signal: AbortSignal.timeout(8_000), headers: { "User-Agent": "PodPlus/1.0 (+https://arisetodo.com)" } });
    if (!r.ok) throw new Error(`feed ${r.status}`);
    return (await r.text()).slice(0, 3_000_000);
  });
  let namesAt = 0;
  let episodes: PodEpisode[] = [];
  let lastRound = 0;
  let running = false;

  const waitIdle = async (maxMs = 60_000) => { const until = now() + maxMs; while (!d.idle() && now() < until) await sleep(1000); };

  async function findNamedShows() {
    for (const name of NOW_NEWS_SHOWS) {
      await waitIdle();
      try {
        const b = await d.apple(appleSearchUrl(name, "podcast", 5, true));
        const found = (Array.isArray(b?.results) ? b.results : []).map((r: unknown) => parseShow(r, "news")).filter(Boolean) as PodShow[];
        const hit = found.find((s) => sameShowName(name, s.name));
        if (hit) { shows.set(hit.id, { ...hit, genre: "news" }); named.add(hit.id); }
      } catch (e: any) { if (e?.message === "busy") await sleep(15_000); }
    }
    namesAt = now();
  }

  /** One round: the newest episodes of every news show, ten shows per Apple request. */
  async function round() {
    if (running) return;
    running = true;
    try {
      if (now() - namesAt > NAMES_MS) await findNamedShows();
      try { for (const p of (await d.newsPool()).slice(0, 30)) if (!shows.has(p.show.id)) shows.set(p.show.id, { ...p.show, genre: "news" }); } catch { /* the named shows still work */ }
      const ids = [...shows.keys()];
      const found: PodEpisode[] = [];
      for (let i = 0; i < ids.length; i += 10) {
        const batch = ids.slice(i, i + 10);
        await waitIdle();
        try {
          const url = `https://itunes.apple.com/lookup?${new URLSearchParams({ id: batch.join(","), media: "podcast", entity: "podcastEpisode", limit: "60", country: "US" })}`;
          const b = await d.apple(url);
          const results: unknown[] = Array.isArray(b?.results) ? b.results : [];
          const missed: string[] = [];
          for (const id of batch) {
            const show = shows.get(id) ?? null;
            const eps = results.filter((r: any) => String(r?.collectionId ?? "") === id).map((r) => parseEpisode(r, show)).filter(Boolean) as PodEpisode[];
            if (eps.length) { found.push(...eps.map((e) => ({ ...e, art: e.art || show?.art || "" }))); d.remember?.(show, eps); } else missed.push(id);
          }
          // Apple shares one limit across a batch: shows it left out are asked for one at a time.
          for (const id of missed) {
            await waitIdle();
            try {
              const one = await d.apple(`https://itunes.apple.com/lookup?${new URLSearchParams({ id, media: "podcast", entity: "podcastEpisode", limit: "6", country: "US" })}`);
              const show = shows.get(id) ?? null;
              const eps = (Array.isArray(one?.results) ? one.results : []).map((r: unknown) => parseEpisode(r, show)).filter(Boolean) as PodEpisode[];
              if (eps.length) { found.push(...eps.map((e) => ({ ...e, art: e.art || show?.art || "" }))); d.remember?.(show, eps); }
            } catch (e: any) { if (e?.message === "busy") await sleep(15_000); }
          }
        } catch (e: any) { if (e?.message === "busy") await sleep(15_000); }
      }
      // The named bulletins straight from their feeds (a few at a time; a slow feed only misses this round).
      const feeds = [...named].map((id) => shows.get(id)).filter((s): s is PodShow => !!s?.feed && /^https?:\/\//i.test(s.feed));
      const fromFeeds: PodEpisode[] = [];
      for (let i = 0; i < feeds.length; i += 6) {
        await Promise.all(feeds.slice(i, i + 6).map(async (show) => {
          try { fromFeeds.push(...feedEpisodes(await readFeed(show.feed!), show)); } catch { /* Apple's copy still counts */ }
        }));
      }
      found.push(...mergeFeed(found, fromFeeds).slice(found.length));
      if (found.length) {
        const since = now() - KEEP_HOURS * 3600_000;
        const byId = new Map(episodes.map((e) => [e.id, e] as [string, PodEpisode]));
        for (const e of found) byId.set(e.id, e);
        // One copy of each episode: Apple's once it has caught up with the feed.
        const all = [...byId.values()].filter((e) => (Date.parse(e.date) || 0) >= since);
        episodes = mergeFeed(all.filter((e) => e.id.length < 19), all.filter((e) => e.id.length >= 19));
      }
      lastRound = now();
    } finally { running = false; }
  }

  return {
    round,
    /** Starts the rounds: one now, then every 10 minutes. */
    start() { void round().catch(() => {}); const t = setInterval(() => { void round().catch(() => {}); }, ROUND_MS); t.unref?.(); return t; },
    /** What's fresh right now. `warming` while the first round hasn't finished. */
    list(hours = NOW_HOURS_DEFAULT, explicit = false) {
      const h = Math.min(NOW_HOURS_MAX, Math.max(1, hours || NOW_HOURS_DEFAULT));
      const all = freshNews(explicit ? episodes : episodes.filter((e) => !e.explicit), h, now());
      return { episodes: all, hours: h, updatedAt: lastRound ? new Date(lastRound).toISOString() : null, warming: !lastRound };
    },
    /** Tests. */
    _shows: shows,
  };
}
