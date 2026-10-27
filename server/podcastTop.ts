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

export function topShowsService(apple: Apple, search: (term: string, entity: "podcast" | "podcastEpisode", limit: number) => string) {
  const charts: Cache<ChartShow[]> = new Map();
  const topics: Cache<PodShow[]> = new Map();
  const chartOf = (genreId?: number) => cached(charts, String(genreId ?? "all"), 6 * 3600_000, async () => parseChart(await apple(chartUrl(genreId))));

  return {
    /** All, or one genre. */
    async genre(gid?: string): Promise<PodShow[]> {
      if (!gid) return (await chartOf()).slice(0, 16);
      const id = CHART_GENRE[gid];
      if (!id) return [];
      return genreTop(await chartOf(id), gid);
    },
    /** A topic: the biggest shows that cover it. */
    async topic(q: string): Promise<PodShow[]> {
      const key = q.toLowerCase().replace(/\s+/g, " ").trim();
      return cached(topics, key, 2 * 3600_000, async () => {
        const eps = await apple(search(q, "podcastEpisode", 200));
        const mentions = new Map<string, number>();
        for (const r of Array.isArray(eps?.results) ? eps.results : []) {
          const id = cleanPodId(r?.collectionId);
          if (id) mentions.set(id, (mentions.get(id) ?? 0) + 1);
        }
        let named: PodShow[] = [];
        try { const b = await apple(search(q, "podcast", 50)); named = (Array.isArray(b?.results) ? b.results : []).map((r: unknown) => parseShow(r)).filter(Boolean) as PodShow[]; } catch { /* episode shows alone are fine */ }
        // Full details (episode counts) for the shows that cover it.
        const ids = Array.from(mentions.keys()).sort((a, b) => (mentions.get(b) ?? 0) - (mentions.get(a) ?? 0)).slice(0, 150);
        const known = new Map(named.map((s) => [s.id, s]));
        const need = ids.filter((id) => !known.has(id));
        if (need.length) {
          try {
            const b = await apple(`https://itunes.apple.com/lookup?${new URLSearchParams({ id: need.join(","), entity: "podcast", country: "US" })}`);
            for (const r of Array.isArray(b?.results) ? b.results : []) { const s = parseShow(r); if (s) known.set(s.id, s); }
          } catch { /* rank what we have */ }
        }
        // Chart positions: the overall chart, and the charts of the genres these shows are in.
        const chartPos = new Map<string, number>();
        const add = (list: ChartShow[], offset: number) => list.forEach((s) => { const at = s.chart + offset; if (!chartPos.has(s.id) || chartPos.get(s.id)! > at) chartPos.set(s.id, at); });
        try { add(await chartOf(), 0); } catch { /* no chart: size decides */ }
        const genres = new Map<number, number>();
        for (const s of known.values()) { const g = CHART_GENRE[s.genre]; if (g) genres.set(g, (genres.get(g) ?? 0) + (mentions.get(s.id) ?? 1)); }
        const busiest = Array.from(genres.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => g);
        for (const g of busiest) { try { add(await chartOf(g), 200); } catch { /* skip */ } }
        return rankTopic({ mentions, shows: Array.from(known.values()), charts: chartPos });
      });
    },
  };
}
