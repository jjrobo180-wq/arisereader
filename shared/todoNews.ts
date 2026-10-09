// Current news for the A.R.I.S.E. To-Do: headlines read from Google News RSS feeds.
export type Headline = { title: string; source: string; link: string; published: string };
export const NEWS_TOPICS = [
  { id: "top", label: "Top stories" }, { id: "local", label: "Local" }, { id: "NATION", label: "U.S." }, { id: "WORLD", label: "World" },
  { id: "BUSINESS", label: "Business" }, { id: "TECHNOLOGY", label: "Tech" }, { id: "HEALTH", label: "Health" },
  { id: "SCIENCE", label: "Science" }, { id: "SPORTS", label: "Sports" }, { id: "ENTERTAINMENT", label: "Entertainment" },
] as const;
export type NewsTopic = typeof NEWS_TOPICS[number]["id"];
const TAIL = "hl=en-US&gl=US&ceid=US:en";

/** The feed for a topic, or for a search (a town for Local, or any words). Null when the request isn't usable. */
export function newsFeedUrl(topic: string, query = ""): string | null {
  const q = query.replace(/[^\p{L}\p{N} ,.'&-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  if (topic === "search" || topic === "local") return q ? `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${TAIL}` : null;
  if (topic === "top") return `https://news.google.com/rss?${TAIL}`;
  return NEWS_TOPICS.some((t) => t.id === topic) ? `https://news.google.com/rss/headlines/section/topic/${topic}?${TAIL}` : null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e.toLowerCase()] ?? m)
  .replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const tag = (item: string, name: string) => { const m = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i")); return m ? decode(m[1]) : ""; };

/** Reads an RSS document into headlines (newest first, at most `limit`), dropping repeats. */
export function parseNewsRss(xml: string, limit = 30): Headline[] {
  const out: Headline[] = [];
  const seen = new Set<string>();
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const item = m[1];
    const source = tag(item, "source");
    let title = tag(item, "title");
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3)).trim();
    const link = tag(item, "link");
    const time = Date.parse(tag(item, "pubDate"));
    if (!title || !/^https:\/\//.test(link) || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    out.push({ title: title.slice(0, 300), source: source.slice(0, 80), link, published: Number.isFinite(time) ? new Date(time).toISOString() : "" });
  }
  return out.sort((a, b) => b.published.localeCompare(a.published)).slice(0, limit);
}
