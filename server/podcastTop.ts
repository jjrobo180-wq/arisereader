// "Top shows": the round, numbered row on Pod+. Real popularity, not name matches:
//  - a genre: Apple Podcasts' own Top Podcasts chart for that genre (US);
//  - All: the overall Top Podcasts chart;
//  - a topic (Obama, WW2...): the shows whose episodes cover it, ranked by where they sit in Apple's
//    charts, then by how big and established they are. Shows with a handful of episodes don't make
//    it unless they chart, so a one-episode "Obama" show never lands at number one.
// Charts are kept 6 hours and topics 2 hours, so Apple is asked rarely.
import { cleanPodId, parseShow, type PodShow } from "../shared/earshot";

/** Apple's genre ids for the charts. Sub-genres use their parent chart, filtered by `apple` names. */
export const CHART_GENRE: Record<string, number> = {
  comedy: 1303, truecrime: 1488, news: 1489, politics: 1489, science: 1533, tech: 1318, business: 1321, money: 1321,
  history: 1487, sports: 1545, health: 1512, mental: 1512, culture: 1324, arts: 1301, books: 1301, music: 1310, film: 1309,
  education: 1304, kids: 1305, fiction: 1483, horror: 1483, faith: 1314, gaming: 1502, hobbies: 1502, food: 1301,
  travel: 1324, relationships: 1324, parenting: 1305, nature: 1533, growth: 1304, teaching: 1304,
};
export const chartUrl = (genreId?: number) => `https://itunes.apple.com/us/rss/toppodcasts/limit=200${genreId ? `/genre=${genreId}` : ""}/json`;

export type ChartShow = PodShow & { chart: number; category: string };

/** Apple's chart feed (feed.entry[]) as shows, in chart order. Anything unexpected is skipped. */
export function parseChart(body: unknown, genre = ""): ChartShow[] {
  const entries = (body as any)?.feed?.entry;
  const list: any[] = Array.isArray(entries) ? entries : entries ? [entries] : [];
  const out: ChartShow[] = [];
  list.forEach((e, i) => {
    const id = cleanPodId(e?.id?.attributes?.["im:id"]);
    const name = String(e?.["im:name"]?.label ?? "").trim();
    const imgs = Array.isArray(e?.["im:image"]) ? e["im:image"] : [];
    const art = String(imgs[imgs.length - 1]?.label ?? "");
    if (!id || !name || !/^https:\/\//.test(art)) return;
    const category = String(e?.category?.attributes?.label ?? e?.category?.attributes?.term ?? "");
    out.push({
      id, name, author: String(e?.["im:artist"]?.label ?? "").trim(), art, appleGenre: category, genre, link: "", episodes: 0,
      explicit: false, latest: String(e?.["im:releaseDate"]?.label ?? ""), chart: i + 1, category,
    });
  });
  return out;
}

/** Pod+ genres that are sub-genres in Apple's charts, and the chart category that marks their shows. */
const SUB_CATEGORY: Record<string, string> = {
  money: "Investing", politics: "Politics", mental: "Mental Health", books: "Books", food: "Food", travel: "Places & Travel",
  relationships: "Relationships", parenting: "Parenting", nature: "Nature", growth: "Self-Improvement", gaming: "Video Games", hobbies: "Hobbies",
};
/** A genre's chart: for a sub-genre (Money in Business...), the parent chart's matching shows when there are enough. */
export function genreTop(chart: ChartShow[], gid: string, max = 16): PodShow[] {
  const sub = SUB_CATEGORY[gid];
  if (sub) {
    const own = chart.filter((s) => s.category === sub);
    if (own.length >= 8) return own.slice(0, max);
  }
  return chart.slice(0, max);
}

/** A topic's top shows: shows whose episodes mention it (and shows named for it), ranked by chart
 *  position, then size and how much they cover it. Small shows need to chart to be in the row. */
export function rankTopic(input: { mentions: Map<string, number>; shows: PodShow[]; charts: Map<string, number> }, max = 16): PodShow[] {
  const scored = input.shows.map((s) => {
    const chart = input.charts.get(s.id);
    const mentions = input.mentions.get(s.id) ?? 0;
    const established = s.episodes >= 25;
    if (chart === undefined && (!established || (mentions === 0 && s.episodes < 100))) return null;
    const score = (chart !== undefined ? 1_000_000 - chart * 100 : 0) + Math.log10(1 + s.episodes) * 1000 + Math.min(mentions, 10) * 400;
    return { s, score };
  }).filter((x): x is { s: PodShow; score: number } => !!x);
  return scored.sort((a, b) => b.score - a.score).slice(0, max).map((x) => x.s);
}

type Apple = (url: string) => Promise<any>;
type Cache<T> = Map<string, { at: number; value: T }>;
const cached = async <T,>(c: Cache<T>, key: string, ttl: number, load: () => Promise<T>): Promise<T> => {
  const hit = c.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  const value = await load();
  c.set(key, { at: Date.now(), value });
  if (c.size > 500) { const old = c.keys().next().value; if (old !== undefined) c.delete(old); }
  return value;
};

const peek = <T,>(c: Cache<T>, key: string, ttl: number): T | undefined => { const hit = c.get(key); return hit && Date.now() - hit.at < ttl ? hit.value : undefined; };
const CHART_TTL = 6 * 3600_000, TOPIC_TTL = 2 * 3600_000;

/** idle: whether Apple's slot is free for background work. These rows are extras: they never take
 *  a slot someone's search or feed is waiting for. Not ready yet → null (the page asks again). */
export function topShowsService(apple: Apple, search: (term: string, entity: "podcast" | "podcastEpisode", limit: number) => string, idle: () => boolean = () => true) {
  const charts: Cache<ChartShow[]> = new Map();
  const topics: Cache<PodShow[]> = new Map();
  const chartOf = (genreId?: number) => cached(charts, String(genreId ?? "all"), CHART_TTL, async () => parseChart(await apple(chartUrl(genreId))));
  const ready = (genreId?: number) => peek(charts, String(genreId ?? "all"), CHART_TTL);

  return {
    /** All, or one genre. null: not loaded yet and Apple is busy with people's own requests. */
    async genre(gid?: string): Promise<PodShow[] | null> {
      const id = gid ? CHART_GENRE[gid] : undefined;
      if (gid && !id) return [];
      const have = ready(id);
      if (!have && !idle()) return null;
      const chart = have ?? await chartOf(id);
      return gid ? genreTop(chart, gid) : chart.slice(0, 16);
    },
    /** A topic: the biggest shows that cover it (two requests: its episodes, then those shows). */
    async topic(q: string): Promise<PodShow[] | null> {
      const key = q.toLowerCase().replace(/\s+/g, " ").trim();
      const have = peek(topics, key, TOPIC_TTL);
      if (have) return have;
      if (!idle()) return null;
      return cached(topics, key, TOPIC_TTL, async () => {
        const eps = await apple(search(q, "podcastEpisode", 200));
        const mentions = new Map<string, number>();
        for (const r of Array.isArray(eps?.results) ? eps.results : []) {
          const id = cleanPodId(r?.collectionId);
          if (id) mentions.set(id, (mentions.get(id) ?? 0) + 1);
        }
        const ids = Array.from(mentions.keys()).sort((a, b) => (mentions.get(b) ?? 0) - (mentions.get(a) ?? 0)).slice(0, 150);
        const known = new Map<string, PodShow>();
        if (ids.length) {
          try {
            const b = await apple(`https://itunes.apple.com/lookup?${new URLSearchParams({ id: ids.join(","), entity: "podcast", country: "US" })}`);
            for (const r of Array.isArray(b?.results) ? b.results : []) { const s = parseShow(r); if (s) known.set(s.id, s); }
          } catch { /* nothing to rank */ }
        }
        // Chart positions from the charts already loaded (the warm-up keeps them loaded).
        const chartPos = new Map<string, number>();
        const add = (list: ChartShow[] | undefined, offset: number) => (list ?? []).forEach((s) => { const at = s.chart + offset; if (!chartPos.has(s.id) || chartPos.get(s.id)! > at) chartPos.set(s.id, at); });
        add(ready(), 0);
        for (const g of new Set(Object.values(CHART_GENRE))) add(ready(g), 200);
        return rankTopic({ mentions, shows: Array.from(known.values()), charts: chartPos });
      });
    },
    /** Loads one missing or stale chart when Apple's slot is free. Called on a timer. */
    async warmOne(): Promise<boolean> {
      if (!idle()) return false;
      for (const id of [undefined, ...Array.from(new Set(Object.values(CHART_GENRE)))]) {
        if (ready(id)) continue;
        try { await chartOf(id); } catch { /* next time */ }
        return true;
      }
      return false;
    },
  };
}
