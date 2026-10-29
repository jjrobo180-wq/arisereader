// The "About this podcast" sheet on the swipe screen: what the show is, who makes it, their other
// shows, and where it ranks: Apple Podcasts' charts (already kept warm by podcastTop.ts) and
// Spotify's podcast charts. Each answer is kept 12 hours so a show is looked up once, not per tap.
import { cleanPodId, parseShow, appleSearchUrl, type PodShow } from "../shared/earshot";

export type ChartRank = { rank: number; chart: string };
export type ShowInfo = {
  show: PodShow;
  about: string;
  website: string;
  hosts: string[];
  categories: string[];
  others: PodShow[];
  ranks: { apple: ChartRank[] | null; spotify: ChartRank[] | null };
  links: { name: string; url: string }[];
};

const decode = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => { const c = Number(n); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : ""; })
  .replace(/\s+/g, " ").trim();

/** The channel part of an RSS feed (everything before the first episode): description, site, hosts, categories. */
export function parseChannel(xml: string): { about: string; website: string; hosts: string[]; categories: string[] } {
  const head = String(xml || "").split(/<item[\s>]/i)[0].slice(0, 400_000);
  const tag = (name: string) => { const m = head.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i")); return m ? decode(m[1]) : ""; };
  const about = (tag("itunes:summary") || tag("description") || tag("itunes:subtitle")).slice(0, 1500);
  const site = tag("link");
  const website = /^https?:\/\//i.test(site) ? site.slice(0, 300) : "";
  const hosts = new Set<string>();
  for (const m of head.matchAll(/<podcast:person([^>]*)>([\s\S]*?)<\/podcast:person>/gi)) {
    const role = (m[1].match(/role="([^"]*)"/i)?.[1] ?? "host").toLowerCase();
    if (role === "host" || role === "") hosts.add(decode(m[2]).slice(0, 80));
  }
  const owner = head.match(/<itunes:owner>[\s\S]*?<itunes:name>([\s\S]*?)<\/itunes:name>/i);
  if (!hosts.size && owner) { const n = decode(owner[1]); if (n) hosts.add(n.slice(0, 80)); }
  const categories = new Set<string>();
  for (const m of head.matchAll(/<itunes:category[^>]*text="([^"]+)"/gi)) categories.add(decode(m[1]));
  return { about, website, hosts: Array.from(hosts).filter(Boolean).slice(0, 6), categories: Array.from(categories).slice(0, 6) };
}

/** Lowercase letters and digits only, "The " dropped: how chart names are matched across platforms. */
export const nameKey = (s: string) => String(s || "").toLowerCase().replace(/^the\s+/, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");

export type SpotifyEntry = { name: string; publisher: string; uri: string };
/** Spotify's podcast chart (podcastcharts.byspotify.com): a list of shows in chart order. Shape is read loosely. */
export function parseSpotifyChart(body: unknown): SpotifyEntry[] {
  const list: any[] = Array.isArray(body) ? body : Array.isArray((body as any)?.items) ? (body as any).items : Array.isArray((body as any)?.shows) ? (body as any).shows : [];
  return list.map((x) => ({
    name: String(x?.showName ?? x?.name ?? "").trim(),
    publisher: String(x?.showPublisher ?? x?.publisher ?? "").trim(),
    uri: String(x?.showUri ?? x?.uri ?? ""),
  })).filter((x) => x.name);
}

/** Where a show sits in a chart, by name (and publisher when two share a name). 0 = not in it. */
export function findRank(list: { name: string; publisher?: string; author?: string }[], name: string, author = ""): number {
  const k = nameKey(name); if (!k) return 0;
  const hits = list.map((x, i) => ({ x, i })).filter(({ x }) => nameKey(x.name) === k);
  if (!hits.length) return 0;
  const a = nameKey(author);
  const best = (a && hits.find(({ x }) => { const p = nameKey(x.publisher ?? x.author ?? ""); return p && (p.includes(a) || a.includes(p)); })) || hits[0];
  return best.i + 1;
}

/** Spotify's chart ids for Pod+ genres (genre charts exist for the US). */
const SPOTIFY_GENRE: Record<string, string> = {
  comedy: "comedy", truecrime: "true-crime", news: "news", politics: "news", science: "science", tech: "technology", business: "business", money: "business",
  history: "history", sports: "sports", health: "health-fitness", mental: "health-fitness", culture: "society-culture", arts: "arts", books: "arts",
  music: "music", film: "tv-film", education: "education", fiction: "fiction", horror: "fiction", faith: "religion-spirituality",
};
const SPOTIFY_NAME: Record<string, string> = { "true-crime": "True Crime", "health-fitness": "Health & Fitness", "society-culture": "Society & Culture", "tv-film": "TV & Film", "religion-spirituality": "Religion & Spirituality" };
const spotifyLabel = (id: string) => SPOTIFY_NAME[id] ?? id.charAt(0).toUpperCase() + id.slice(1);

type Cache<T> = Map<string, { at: number; value: T }>;
const remember = async <T,>(c: Cache<T>, key: string, ttl: number, load: () => Promise<T>): Promise<T> => {
  const hit = c.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  const value = await load();
  c.set(key, { at: Date.now(), value });
  if (c.size > 800) { const old = c.keys().next().value; if (old !== undefined) c.delete(old); }
  return value;
};

export function showInfoService(o: {
  apple: (url: string) => Promise<any>;
  loadShow: (id: string) => Promise<{ show: PodShow | null }>;
  /** Apple chart positions from the charts already in memory. */
  appleRanks: (show: PodShow) => ChartRank[] | null;
  web?: typeof fetch;
}) {
  const web = o.web ?? fetch;
  const infos: Cache<ShowInfo> = new Map();
  const spotify: Cache<SpotifyEntry[]> = new Map();
  const get = async (url: string, max: number) => {
    const res = await web(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; PodPlus/1.0)", Accept: "*/*" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return (await res.text()).slice(0, max);
  };
  // Spotify's chart for one category ("top" = overall), kept 6 hours. Failure → null (unknown, not "unranked").
  const spotifyChart = (id: string) => remember(spotify, id, 6 * 3600_000, async () =>
    parseSpotifyChart(JSON.parse(await get(`https://podcastcharts.byspotify.com/api/charts/${id}?region=us`, 2_000_000))));

  async function spotifyRanks(show: PodShow, gid: string): Promise<{ ranks: ChartRank[] | null; uri: string }> {
    const ids = ["top", ...(SPOTIFY_GENRE[gid] ? [SPOTIFY_GENRE[gid]] : [])];
    const lists = await Promise.all(ids.map((id) => spotifyChart(id).catch(() => null)));
    if (lists.every((l) => !l || !l.length)) return { ranks: null, uri: "" };
    const ranks: ChartRank[] = []; let uri = "";
    lists.forEach((l, i) => {
      if (!l) return;
      const at = findRank(l, show.name, show.author);
      if (at) { ranks.push({ rank: at, chart: i === 0 ? "Top Podcasts" : spotifyLabel(ids[i]) }); uri ||= l[at - 1].uri; }
    });
    return { ranks, uri };
  }

  async function others(show: PodShow): Promise<PodShow[]> {
    if (!show.author) return [];
    try {
      const body = await o.apple(appleSearchUrl(show.author, "podcast", 25, true));
      const a = nameKey(show.author);
      return (Array.isArray(body?.results) ? body.results : [])
        .map((r: unknown) => parseShow(r)).filter((s: PodShow | null): s is PodShow => !!s && s.id !== show.id && nameKey(s.author) === a)
        .slice(0, 8);
    } catch { return []; }
  }

  return {
    async info(id: string): Promise<ShowInfo | null> {
      const sid = cleanPodId(id); if (!sid) return null;
      const hit = infos.get(sid);
      if (hit && Date.now() - hit.at < 12 * 3600_000) return { ...hit.value, ranks: { ...hit.value.ranks, apple: hit.value.show ? o.appleRanks(hit.value.show) : null } };
      const { show } = await o.loadShow(sid);
      if (!show) return null;
      const [channel, more, sp] = await Promise.all([
        show.feed ? get(show.feed, 3_000_000).then(parseChannel).catch(() => null) : Promise.resolve(null),
        others(show),
        spotifyRanks(show, show.genre).catch(() => ({ ranks: null, uri: "" })),
      ]);
      const spotifyId = sp.uri.match(/^spotify:show:([A-Za-z0-9]+)$/)?.[1];
      const links = [
        ...(show.link ? [{ name: "Apple Podcasts", url: show.link }] : []),
        { name: "Spotify", url: spotifyId ? `https://open.spotify.com/show/${spotifyId}` : `https://open.spotify.com/search/${encodeURIComponent(show.name)}/podcasts` },
        { name: "YouTube", url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${show.name} podcast`)}` },
        ...(channel?.website ? [{ name: "Website", url: channel.website }] : []),
      ];
      const value: ShowInfo = {
        show, about: channel?.about ?? "", website: channel?.website ?? "", hosts: channel?.hosts ?? [], categories: channel?.categories ?? (show.appleGenre ? [show.appleGenre] : []),
        others: more, ranks: { apple: o.appleRanks(show), spotify: sp.ranks }, links,
      };
      // Don't keep a lookup where Spotify couldn't be reached: the next tap tries again.
      if (sp.ranks) remember(infos, sid, 12 * 3600_000, async () => value);
      return value;
    },
  };
}
