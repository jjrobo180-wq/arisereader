// Pod+ search, built like a web search: exact phrases ("quoted") and guest names ranked first, a
// "Did you mean", an AI answer above the results, refine filters (type, sort, released, length,
// show size), and search inside one show's archive (up to its 200 newest episodes, where most
// apps show 25). Results come from /api/podscroll/search?deep=1 (up to 200 episodes, 50 shows).
import { useEffect, useMemo, useState } from "react";
import { hiRes, type PodEpisode, type PodShow } from "@shared/earshot";
import { ArrowLeft, Loader2, MoreVertical, Search as SearchIcon, Sparkles } from "lucide-react";

type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
type Kind = "all" | "episodes" | "shows";
type Sort = "best" | "new" | "old" | "popular";
type When = "any" | "week" | "month" | "year" | "older";
type Len = "any" | "short" | "mid" | "long";
type Size = "any" | "big" | "indie";

const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "about", "is", "are", "podcast", "podcasts", "episode", "episodes"]);
const days = (iso: string) => (Date.now() - Date.parse(iso)) / 86_400_000;
const agoText = (iso: string) => { const d = days(iso); if (!Number.isFinite(d)) return ""; if (d < 1) return "Today"; if (d < 2) return "Yesterday"; if (d < 30) return `${Math.floor(d)} days ago`; return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); };
const mins = (s: number) => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`; };
const plain = (s: string) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/** The query as phrases ("quoted", must appear) and loose words. */
export function parseQuery(q: string) {
  const phrases: string[] = [];
  const rest = q.replace(/"([^"]+)"/g, (_, p: string) => { if (p.trim()) phrases.push(p.trim().toLowerCase()); return " "; });
  const words = rest.toLowerCase().split(/[^a-z0-9'’-]+/).filter((w) => w.length > 1 && !STOP.has(w));
  return { phrases, words, whole: q.replace(/"/g, "").trim().toLowerCase() };
}

/** How well an episode matches: exact phrases and the whole query in the title count most. */
export function scoreEpisode(e: PodEpisode, pq: ReturnType<typeof parseQuery>): number | null {
  const title = e.title.toLowerCase(), about = plain(e.about).toLowerCase(), show = `${e.show} ${e.author}`.toLowerCase();
  let s = 0;
  for (const p of pq.phrases) {
    const inTitle = title.includes(p), inAbout = about.includes(p), inShow = show.includes(p);
    if (!inTitle && !inAbout && !inShow) return null; // a quoted phrase has to be there
    s += inTitle ? 40 : inAbout ? 15 : 8;
  }
  if (pq.whole.length > 3 && title.includes(pq.whole)) s += 30;
  else if (pq.whole.length > 3 && about.includes(pq.whole)) s += 12;
  const inT = pq.words.filter((w) => title.includes(w)).length;
  if (pq.words.length && inT === pq.words.length) s += 25;
  s += inT * 6 + pq.words.filter((w) => about.includes(w)).length * 2 + pq.words.filter((w) => show.includes(w)).length * 5;
  const d = days(e.date);
  if (Number.isFinite(d)) s += Math.max(0, 5 - d / 73);
  return s;
}

function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = dp[j]; dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return dp[b.length];
}

/** "Did you mean": each long-ish word that appears nowhere in the results, swapped for the closest common word that does. */
export function didYouMean(q: string, texts: string[]): string | null {
  const count = new Map<string, number>();
  for (const t of texts) for (const w of t.toLowerCase().split(/[^a-z0-9'’]+/)) if (w.length >= 4) count.set(w, (count.get(w) ?? 0) + 1);
  let changed = false;
  const out = q.split(/(\s+)/).map((tok) => {
    const w = tok.toLowerCase().replace(/[^a-z0-9'’]/g, "");
    if (w.length < 4 || count.has(w)) return tok;
    let best = "", bestD = w.length > 6 ? 3 : 2, bestN = 0;
    for (const [v, n] of count) { const d = lev(w, v); if (d < bestD || (d === bestD && n > bestN)) { best = v; bestD = d; bestN = n; } }
    if (best && bestN >= 2) { changed = true; return best; }
    return tok;
  }).join("");
  return changed && out.toLowerCase() !== q.toLowerCase() ? out : null;
}

export function SearchPage({ q, api, ex, onOpen, onMore, onSearch }: {
  q: string; api: Api; ex: string; onOpen: (e: PodEpisode) => void; onMore: ((e: PodEpisode) => void) | null; onSearch: (q: string) => void;
}) {
  const [res, setRes] = useState<{ shows: PodShow[]; episodes: PodEpisode[] } | null>(null);
  const [err, setErr] = useState("");
  const [ai, setAi] = useState<{ summary: string; picks: { show: PodShow; why: string; episode: PodEpisode | null }[]; ai: boolean } | null | "loading">("loading");
  const [kind, setKind] = useState<Kind>("all");
  const [sort, setSort] = useState<Sort>("best");
  const [when, setWhen] = useState<When>("any");
  const [len, setLen] = useState<Len>("any");
  const [size, setSize] = useState<Size>("any");
  const [limit, setLimit] = useState(30);
  const [inShow, setInShow] = useState<PodShow | null>(null);
  const [inQ, setInQ] = useState("");
  const [archive, setArchive] = useState<{ episodes: PodEpisode[]; total: number } | null | "loading">(null);
  const pq = useMemo(() => parseQuery(q), [q]);

  useEffect(() => {
    let live = true;
    setRes(null); setErr(""); setAi("loading"); setLimit(30); setInShow(null); setArchive(null);
    api(`/api/earshot/search?deep=1&q=${encodeURIComponent(q)}${ex}`).then((b) => { if (live) setRes({ shows: b.shows || [], episodes: b.episodes || [] }); }).catch((e) => { if (live) setErr(e.message); });
    api("/api/earshot/ai-find", { method: "POST", body: { q } }).then((b) => { if (live) setAi(b && Array.isArray(b.picks) ? b : null); }).catch(() => { if (live) setAi(null); });
    return () => { live = false; };
  }, [api, q, ex]);

  const searchShow = (sh: PodShow, words: string) => {
    setInShow(sh); setInQ(words); setArchive("loading");
    api(`/api/earshot/show/${sh.id}/search?q=${encodeURIComponent(words)}${ex}`).then((b) => setArchive({ episodes: (b.episodes || []).map((e: PodEpisode) => ({ ...e, art: e.art || sh.art })), total: b.total || 0 })).catch((e) => { setArchive(null); setErr(e.message); });
  };

  const showSize = useMemo(() => new Map((res?.shows ?? []).map((s) => [s.id, s.episodes] as [string, number])), [res]);
  const episodes = useMemo(() => {
    const base = inShow ? (archive && archive !== "loading" ? archive.episodes : []) : res?.episodes ?? [];
    const scored = base.map((e) => ({ e, s: inShow ? 0 : scoreEpisode(e, pq) })).filter((x): x is { e: PodEpisode; s: number } => x.s !== null);
    const lenOk = (e: PodEpisode) => !e.secs || len === "any" || (len === "short" ? e.secs < 1200 : len === "mid" ? e.secs >= 1200 && e.secs <= 3600 : e.secs > 3600);
    const whenOk = (e: PodEpisode) => { const d = days(e.date); if (when === "any") return true; if (!Number.isFinite(d)) return false; return when === "week" ? d <= 7 : when === "month" ? d <= 31 : when === "year" ? d <= 366 : d > 366; };
    const sizeOk = (e: PodEpisode) => { const n = showSize.get(e.showId); if (size === "any" || n === undefined) return true; return size === "big" ? n >= 150 : n <= 80; };
    const list = scored.filter((x) => lenOk(x.e) && whenOk(x.e) && sizeOk(x.e));
    const t = (e: PodEpisode) => Date.parse(e.date) || 0;
    if (sort === "new") list.sort((a, b) => t(b.e) - t(a.e));
    else if (sort === "old") list.sort((a, b) => t(a.e) - t(b.e));
    else if (sort === "popular") list.sort((a, b) => (showSize.get(b.e.showId) ?? 0) - (showSize.get(a.e.showId) ?? 0) || b.s - a.s);
    else if (!inShow) list.sort((a, b) => b.s - a.s);
    return list.map((x) => x.e);
  }, [res, archive, inShow, pq, sort, when, len, size, showSize]);
  const shows = useMemo(() => {
    const list = (res?.shows ?? []).filter((s) => size === "any" || (size === "big" ? s.episodes >= 150 : s.episodes <= 80));
    return sort === "popular" ? list.slice().sort((a, b) => b.episodes - a.episodes) : list;
  }, [res, size, sort]);
  const suggestion = useMemo(() => (res ? didYouMean(q, [...res.shows.map((s) => s.name), ...res.episodes.map((e) => `${e.title} ${e.show}`)]) : null), [res, q]);
  const filtered = sort !== "best" || when !== "any" || len !== "any" || size !== "any" || kind !== "all";

  const snippet = (e: PodEpisode) => {
    const text = plain(e.about); if (!text) return null;
    const terms = [...pq.phrases, ...pq.words].filter(Boolean);
    const lower = text.toLowerCase();
    const at = terms.map((w) => lower.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
    const start = Math.max(0, at - 60); const piece = (start ? "…" : "") + text.slice(start, start + 220) + (text.length > start + 220 ? "…" : "");
    if (!terms.length) return piece;
    const re = new RegExp(`(${terms.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    return piece.split(re).map((part, i) => (i % 2 ? <b key={i} className="font-semibold text-[#0f0f0f]">{part}</b> : part));
  };
  const sel = "h-9 shrink-0 cursor-pointer rounded-full border border-[#d3d3d3] bg-transparent pl-3 pr-8 text-sm outline-none focus:border-[#1c62b9]";

  return <div className="mx-auto max-w-[920px] px-4 pb-20 pt-3 sm:px-6">
    {/* Refine */}
    <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:none]" role="group" aria-label="Refine results">
      <label className="sr-only" htmlFor="ps-s-kind">Type</label>
      <select id="ps-s-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={sel}><option value="all">Everything</option><option value="episodes">Episodes</option><option value="shows">Shows</option></select>
      <label className="sr-only" htmlFor="ps-s-sort">Sort</label>
      <select id="ps-s-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={sel}><option value="best">Best match</option><option value="new">Newest first</option><option value="old">Oldest first</option><option value="popular">Biggest shows</option></select>
      <label className="sr-only" htmlFor="ps-s-when">Released</label>
      <select id="ps-s-when" value={when} onChange={(e) => setWhen(e.target.value as When)} className={sel}><option value="any">Any time</option><option value="week">Past week</option><option value="month">Past month</option><option value="year">Past year</option><option value="older">Older than a year</option></select>
      <label className="sr-only" htmlFor="ps-s-len">Length</label>
      <select id="ps-s-len" value={len} onChange={(e) => setLen(e.target.value as Len)} className={sel}><option value="any">Any length</option><option value="short">Under 20 min</option><option value="mid">20–60 min</option><option value="long">Over an hour</option></select>
      <label className="sr-only" htmlFor="ps-s-size">Show size</label>
      <select id="ps-s-size" value={size} onChange={(e) => setSize(e.target.value as Size)} className={sel}><option value="any">Any show</option><option value="big">Big shows</option><option value="indie">Independent shows</option></select>
      {filtered && <button onClick={() => { setKind("all"); setSort("best"); setWhen("any"); setLen("any"); setSize("any"); }} className="h-9 shrink-0 rounded-full px-3 text-sm font-medium text-[#065fd4] hover:bg-[#def1ff]">Clear</button>}
    </div>

    {suggestion && !inShow && <p className="mt-2 text-[15px] text-[#606060]">Did you mean: <button onClick={() => onSearch(suggestion)} className="font-semibold italic text-[#065fd4] hover:underline">{suggestion}</button></p>}

    {/* AI answer */}
    {!inShow && kind !== "shows" && ai !== null && <section aria-label="AI answer" className="mt-4 rounded-2xl border border-[#e5e5e5] p-4">
      <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} />AI answer</p>
      {ai === "loading"
        ? <div className="mt-3 flex flex-col gap-2" role="status" aria-label="Thinking"><div className="h-3 w-11/12 rounded bg-[#f2f2f2] motion-safe:animate-pulse" /><div className="h-3 w-3/4 rounded bg-[#f2f2f2] motion-safe:animate-pulse" /></div>
        : <>
          {ai.ai && ai.summary && <p className="mt-2 text-[15px] leading-relaxed">{ai.summary}</p>}
          {!ai.ai && <p className="mt-2 text-sm text-[#606060]">The closest shows for “{q}”:</p>}
          <div className="mt-3 flex flex-col divide-y divide-[#ececec]">
            {ai.picks.slice(0, 4).map((p) => <button key={p.show.id} onClick={() => p.episode ? onOpen({ ...p.episode, art: p.episode.art || p.show.art }) : searchShow(p.show, "")} className="flex items-center gap-3 py-2.5 text-left">
              <img src={hiRes(p.show.art, 100)} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />
              <span className="min-w-0"><span className="block truncate text-sm font-semibold">{p.show.name}</span><span className="line-clamp-2 text-xs text-[#606060]">{p.why}</span></span>
            </button>)}
          </div>
        </>}
    </section>}

    {err && <p className="py-10 text-center text-[#606060]">{err}</p>}
    {!res && !err && <div className="flex justify-center py-16" role="status" aria-label="Searching"><Loader2 className="animate-spin text-[#606060]" size={26} /></div>}

    {/* Inside one show */}
    {inShow && <section className="mt-4">
      <button onClick={() => { setInShow(null); setArchive(null); }} className="inline-flex h-9 items-center gap-1.5 rounded-full pl-2 pr-3 text-sm font-medium hover:bg-[#f2f2f2]"><ArrowLeft size={16} />All results for “{q}”</button>
      <div className="mt-3 flex items-center gap-3">
        <img src={hiRes(inShow.art, 120)} alt="" className="h-14 w-14 rounded-lg object-cover" />
        <div className="min-w-0"><p className="truncate text-lg font-semibold">{inShow.name}</p><p className="text-xs text-[#606060]">Searching this show's archive{archive && archive !== "loading" ? ` · ${archive.total} episodes listed` : ""}</p></div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); searchShow(inShow, inQ); }} className="mt-3 flex max-w-lg items-center">
        <label htmlFor="ps-in-show" className="sr-only">Search in {inShow.name}</label>
        <input id="ps-in-show" value={inQ} onChange={(e) => setInQ(e.target.value)} placeholder={`Search in ${inShow.name}`} className="h-10 min-w-0 flex-1 rounded-l-full border border-r-0 border-[#d3d3d3] px-4 text-base outline-none focus:border-[#1c62b9]" />
        <button type="submit" aria-label="Search this show" className="inline-flex h-10 w-12 items-center justify-center rounded-r-full border border-[#d3d3d3] bg-[#f8f8f8]"><SearchIcon size={18} /></button>
      </form>
      {archive && archive !== "loading" && archive.total >= 200 && <p className="mt-2 text-xs text-[#767676]">Shows the 200 newest episodes this podcast lists. Some shows only keep recent episodes in their feed.</p>}
      {archive === "loading" && <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#606060]" size={24} /></div>}
    </section>}

    {/* Shows */}
    {res && !inShow && kind !== "episodes" && shows.length > 0 && <section aria-label="Shows" className="mt-6">
      <h2 className="text-base font-semibold">Shows</h2>
      <div className="mt-3 flex flex-col divide-y divide-[#ececec]">
        {shows.slice(0, kind === "shows" ? 50 : 4).map((s) => <div key={s.id} className="flex items-center gap-3 py-3">
          <img src={hiRes(s.art, 140)} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0 flex-1"><p className="truncate font-semibold">{s.name}</p><p className="truncate text-xs text-[#606060]">{[s.author, s.episodes ? `${s.episodes} episodes` : "", s.appleGenre].filter(Boolean).join(" · ")}</p></div>
          <button onClick={() => searchShow(s, pq.words.filter((w) => !s.name.toLowerCase().includes(w)).join(" "))} className="hidden h-9 shrink-0 rounded-full bg-[#f2f2f2] px-3.5 text-sm font-medium hover:bg-[#e5e5e5] sm:inline-flex sm:items-center">Search in show</button>
          <button onClick={() => searchShow(s, "")} className="h-9 shrink-0 rounded-full bg-[#0f0f0f] px-3.5 text-sm font-semibold text-white">Episodes</button>
        </div>)}
      </div>
    </section>}

    {/* Episodes */}
    {(res || inShow) && kind !== "shows" && <section aria-label="Episodes" className="mt-6">
      {!inShow && <h2 className="text-base font-semibold">Episodes <span className="font-normal text-[#606060]">· {episodes.length}</span></h2>}
      {episodes.length === 0 && (inShow ? archive !== "loading" : !!res) && <p className="py-10 text-center text-[#606060]">{inShow ? "Nothing in this show matches. Try fewer words." : filtered ? "Nothing matches with these filters. Try clearing one." : `No episodes found for “${q}”.`}</p>}
      <ol className="mt-2 flex flex-col">
        {episodes.slice(0, limit).map((e) => <li key={e.id} className="group relative flex gap-3 rounded-xl py-3 pr-9">
          <button onClick={() => onOpen(e)} className="flex min-w-0 flex-1 gap-3 text-left">
            <img src={hiRes(e.art, 160)} alt="" loading="lazy" className="h-[72px] w-[72px] shrink-0 rounded-lg bg-[#f2f2f2] object-cover sm:h-[88px] sm:w-[156px] sm:object-contain" style={{ background: "#f2f2f2" }} />
            <span className="min-w-0">
              <span className="line-clamp-2 text-[15px] font-semibold leading-snug">{e.title}</span>
              <span className="mt-0.5 block truncate text-xs text-[#606060]">{[e.show, agoText(e.date), e.secs ? mins(e.secs) : ""].filter(Boolean).join(" · ")}</span>
              {snippet(e) && <span className="mt-1 line-clamp-2 text-[13px] leading-snug text-[#606060]">{snippet(e)}</span>}
            </span>
          </button>
          {onMore && <button onClick={() => onMore(e)} aria-label={`Add “${e.title}” to a Pod Mode`} className="absolute right-0 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#f2f2f2]"><MoreVertical size={18} /></button>}
        </li>)}
      </ol>
      {episodes.length > limit && <button onClick={() => setLimit((n) => n + 30)} className="mt-2 h-10 w-full rounded-full bg-[#f2f2f2] text-sm font-medium hover:bg-[#e5e5e5]">Show more</button>}
    </section>}
  </div>;
}
