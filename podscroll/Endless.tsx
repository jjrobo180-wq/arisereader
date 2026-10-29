// Endless lists for Pod+ and the Up to the Minute News hub.
//
// Every genre tab and topic tab keeps going as you scroll, like the All feed: when the bottom comes
// near, the next batch loads. A genre runs through its sub-genres and topics on Apple (/more), then
// the next newest episode of every show, then each show's whole archive (up to 200 episodes a show),
// so it doesn't run out. A topic runs a deeper search, then searches inside every show that covers it.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, RefreshCw, Zap } from "lucide-react";
import type { PodEpisode, PoolShow } from "@shared/earshot";

type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
/** The next batch, or null when there's truly nothing left. */
export type MoreFn = () => Promise<PodEpisode[] | null>;

/** A list that loads more as the bottom comes into view. `grid` draws the cards. */
export function Endless({ seed, more, grid, resetKey }: { seed: PodEpisode[]; more: MoreFn; grid: (list: PodEpisode[]) => ReactNode; resetKey: string }) {
  const [list, setList] = useState<PodEpisode[]>(seed);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const seen = useRef(new Set(seed.map((e) => e.id)));
  const loading = useRef(false);
  const empties = useRef(0);
  const moreRef = useRef(more); moreRef.current = more;
  useEffect(() => { setList(seed); setDone(false); seen.current = new Set(seed.map((e) => e.id)); empties.current = 0; }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const next = useCallback(async () => {
    if (loading.current || done) return;
    loading.current = true; setBusy(true);
    try {
      // A batch that only repeats what's shown is skipped; a few of those in a row means it's the end.
      for (let tries = 0; tries < 4; tries++) {
        const got = await moreRef.current();
        if (got === null) { setDone(true); return; }
        const fresh = got.filter((e) => e && !seen.current.has(e.id));
        fresh.forEach((e) => seen.current.add(e.id));
        if (fresh.length) { empties.current = 0; setList((l) => [...l, ...fresh]); return; }
        if (++empties.current >= 8) { setDone(true); return; }
      }
    } catch { empties.current++; if (empties.current >= 8) setDone(true); }
    finally { loading.current = false; setBusy(false); }
  }, [done]);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current; if (!el || done) return;
    const io = new IntersectionObserver((ents) => { if (ents.some((x) => x.isIntersecting)) void next(); }, { rootMargin: "900px 0px" });
    io.observe(el); return () => io.disconnect();
  }, [next, done, list.length]);
  return <>
    {grid(list)}
    {done
      ? <p className="py-10 text-center text-sm text-[#606060]">You've reached the end of what we can find. Try another genre or topic.</p>
      : <div ref={sentinel} className="flex justify-center py-10" aria-hidden={!busy}>{busy && <Loader2 className="animate-spin text-[#606060]" size={22} />}</div>}
  </>;
}

const byNewest = (a: PodEpisode, b: PodEpisode) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0);

/** A genre that never runs out: /more pages, then deeper episodes, then each show's archive. */
export function genreMore(api: Api, genre: string, ex: string, firstPool: PoolShow[]): MoreFn {
  const pool: PoolShow[] = firstPool.slice();
  const showIds = new Set(pool.map((p) => p.show.id));
  let page: number | null = 0;
  let depth = 1;
  let turn = 0;
  const archives = new Map<string, { list: PodEpisode[]; at: number } | "none">();
  const tag = (e: PodEpisode, p: PoolShow) => ({ ...e, art: e.art || p.show.art, genre } as PodEpisode);
  return async () => {
    // 1. New shows from the genre's sub-genres and topics.
    if (page !== null) {
      const b = await api(`/api/earshot/more?genre=${encodeURIComponent(genre)}&page=${page}${ex}`);
      page = typeof b.next === "number" ? b.next : null;
      const add = ((b.pool || []) as PoolShow[]).filter((p) => !showIds.has(p.show.id));
      add.forEach((p) => { showIds.add(p.show.id); pool.push(p); });
      return add.map((p) => p.episodes[0] && tag(p.episodes[0], p)).filter(Boolean) as PodEpisode[];
    }
    // 2. The next newest episode of every show already shown.
    if (depth < 3) {
      const out = pool.map((p) => p.episodes[depth] && tag(p.episodes[depth], p)).filter(Boolean) as PodEpisode[];
      depth++;
      return out;
    }
    // 3. Each show's archive, a few shows per batch, one more episode from each every time round.
    if (!pool.length) return null;
    const out: PodEpisode[] = [];
    let fetched = 0;
    for (let k = 0; k < Math.min(8, pool.length); k++) {
      const p = pool[turn % pool.length]; turn++;
      let a = archives.get(p.show.id);
      if (a === undefined) {
        if (fetched >= 2) continue;
        fetched++;
        try { const b = await api(`/api/earshot/show/${p.show.id}/search?x=1${ex}`); a = { list: ((b.episodes || []) as PodEpisode[]).sort(byNewest), at: 3 }; }
        catch { a = "none"; }
        archives.set(p.show.id, a);
      }
      if (a === "none" || a.at >= a.list.length) { if (a !== "none") archives.set(p.show.id, "none"); continue; }
      out.push(tag(a.list[a.at], p)); a.at++;
    }
    if (!out.length && [...archives.values()].length >= pool.length && [...archives.values()].every((x) => x === "none")) return null;
    return out;
  };
}

/** A topic that keeps going: a deeper search, then a search inside every show that covers it. */
export function topicMore(api: Api, topic: string, ex: string): MoreFn {
  let stage: "deep" | "shows" | "done" = "deep";
  let shows: { id: string; art: string }[] = [];
  let i = 0;
  return async () => {
    if (stage === "deep") {
      stage = "shows";
      const b = await api(`/api/earshot/search?deep=1&q=${encodeURIComponent(topic)}${ex}`);
      shows = ((b.shows || []) as { id: string; art: string }[]).slice(0, 50);
      return ((b.episodes || []) as PodEpisode[]).sort(byNewest);
    }
    if (stage === "shows") {
      if (i >= shows.length) { stage = "done"; return null; }
      const batch = shows.slice(i, i + 2); i += 2;
      const lists = await Promise.all(batch.map((s) => api(`/api/earshot/show/${s.id}/search?q=${encodeURIComponent(topic)}${ex}`)
        .then((b) => ((b.episodes || []) as PodEpisode[]).map((e) => ({ ...e, art: e.art || s.art }))).catch(() => [] as PodEpisode[])));
      return lists.flat().sort(byNewest);
    }
    return null;
  };
}

// ---------------------------------------------------------------------------
// Up to the Minute News
// ---------------------------------------------------------------------------
const minutesAgo = (iso: string, now: number) => {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} hr ${r} min ago` : `${h} hr ago`;
};

/** The hub page: only news from the last few hours, newest first, refreshed every 3 minutes. */
export function NewsNow({ api, ex, onOpen, onBack, grid }: { api: Api; ex: string; onOpen: (e: PodEpisode) => void; onBack: () => void; grid: (list: PodEpisode[]) => ReactNode }) {
  const [hours, setHours] = useState(() => { try { return Number(localStorage.getItem("podscroll.nowHours")) || 6; } catch { return 6; } });
  const [data, setData] = useState<{ episodes: PodEpisode[]; updatedAt: string | null; warming: boolean } | null>(null);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(Date.now());
  const pull = useCallback(() => {
    api(`/api/earshot/now?hours=${hours}${ex}`).then((b) => { setData({ episodes: b.episodes || [], updatedAt: b.updatedAt, warming: !!b.warming }); setErr(""); }).catch((e) => setErr(e.message));
  }, [api, hours, ex]);
  useEffect(() => { setData(null); pull(); }, [pull]);
  // New episodes every 3 minutes; the "min ago" labels and the cut-off move every 30 seconds.
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === "visible") pull(); }, 180_000); return () => clearInterval(t); }, [pull]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!data?.warming) return; const t = setTimeout(pull, 20_000); return () => clearTimeout(t); }, [data, pull]);
  const pick = (h: number) => { setHours(h); try { localStorage.setItem("podscroll.nowHours", String(h)); } catch { /* private window */ } };
  const since = now - hours * 3600_000;
  const list = (data?.episodes || []).filter((e) => Date.parse(e.date) >= since);
  return <section aria-label="Up to the Minute News" className="pt-3">
    <div className="ps-keep relative overflow-hidden rounded-2xl p-5 text-[#ffffff] sm:p-6" style={{ background: "linear-gradient(135deg,#1e3a8a,#0f172a)" }}>
      <button onClick={onBack} className="mb-3 text-sm font-medium text-[#c9d3e8] hover:text-[#ffffff]">← Home</button>
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#ffb37a]"><span className="h-2 w-2 rounded-full bg-[#ff3b30] motion-safe:animate-pulse" />Live news hub</p>
      <h1 className="mt-2 flex items-center gap-2 text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]"><Zap size={26} className="text-[#ffb37a]" />Up to the Minute News</h1>
      <p className="mt-2 max-w-xl text-[14px] text-[#e6ebf5]">Only news published in the last {hours} hours, newest first. Older episodes drop off on their own, and new ones show up every few minutes.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="How far back">
        {[2, 4, 6, 12].map((h) => <button key={h} onClick={() => pick(h)} aria-pressed={hours === h} className={`h-9 rounded-full px-4 text-sm font-semibold ${hours === h ? "bg-[#ffb37a] text-[#1a1206]" : "bg-[#ffffff]/10 text-[#ffffff] hover:bg-[#ffffff]/20"}`}>Last {h} hours</button>)}
        <button onClick={pull} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-[#e6ebf5] hover:bg-[#ffffff]/10"><RefreshCw size={15} />Refresh</button>
      </div>
      {data?.updatedAt && <p className="mt-3 text-xs text-[#aab6cf]">Checked {minutesAgo(data.updatedAt, now).toLowerCase()}</p>}
    </div>
    {err ? <p className="py-16 text-center text-[#606060]">{err}</p>
      : !data ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#606060]" size={24} /></div>
      : list.length ? grid(list)
      : <p className="py-16 text-center text-[#606060]">{data.warming ? "Gathering the latest news. This takes about a minute the first time." : `No news in the last ${hours} hours yet. Try a longer window.`}</p>}
  </section>;
}
