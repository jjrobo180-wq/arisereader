// Pod+ "Podcast of the day": a featured spot on the home page about what today is. A holiday or
// observance (worked out for any year, like the day daylight saving time ends) or, on an ordinary
// day, the biggest event that happened on this date (Wikipedia's "on this day"). The episodes are
// real ones found through the same search Pod+ uses everywhere.
import { useEffect, useState } from "react";
import { CalendarDays, History, Play } from "lucide-react";
import { hiRes, type PodEpisode } from "@shared/earshot";
import { historyTheme, onThisDayUrl, parseOnThisDay, todayThemes, type DayEvent, type DayTheme } from "@shared/podToday";

type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;

/** Episodes about a topic, the ones that name it in the title first. */
async function episodesAbout(api: Api, q: string, ex: string): Promise<PodEpisode[]> {
  const b = await api(`/api/earshot/search?q=${encodeURIComponent(q.slice(0, 70))}${ex}`);
  const eps: PodEpisode[] = b?.episodes || [];
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && !["history", "the", "and"].includes(w));
  const hits = (e: PodEpisode) => words.filter((w) => `${e.title} ${e.show}`.toLowerCase().includes(w)).length;
  return [...eps].sort((a, b2) => hits(b2) - hits(a)).slice(0, 12);
}

export function PodcastOfTheDay({ api, ex, onOpen }: { api: Api; ex: string; onOpen: (e: PodEpisode, next?: PodEpisode[]) => void }) {
  const today = new Date();
  const [events, setEvents] = useState<DayEvent[]>([]);
  const [theme, setTheme] = useState<DayTheme | null>(() => todayThemes(today)[0] ?? null);
  const [eps, setEps] = useState<PodEpisode[] | null>(null);
  const [picked, setPicked] = useState<DayEvent | null>(null);
  const [extra, setExtra] = useState<PodEpisode[] | null>(null);

  useEffect(() => {
    let live = true;
    fetch(onThisDayUrl(today)).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!live) return;
      const ev = parseOnThisDay(j, 8); setEvents(ev);
      setTheme((t) => t ?? historyTheme(ev, today));
    }).catch(() => {});
    return () => { live = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!theme) return; let live = true; setEps(null);
    episodesAbout(api, theme.query, ex).then((l) => live && setEps(l)).catch(() => live && setEps([]));
    return () => { live = false; };
  }, [api, ex, theme?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!picked) return; let live = true; setExtra(null);
    episodesAbout(api, picked.topic, ex).then((l) => live && setExtra(l)).catch(() => live && setExtra([]));
    return () => { live = false; };
  }, [api, ex, picked]);

  if (!theme) return null;
  const lead = eps?.[0];
  const dateLabel = today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  return <section aria-label="Podcast of the day" className="ps-keep mb-6 mt-1" data-testid="pod-of-the-day">
    <div className="overflow-hidden rounded-2xl bg-[#0f0f0f] text-white ring-1 ring-white/10">
      <div className="relative">
        {lead && <img src={hiRes(lead.art, 600)} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl" />}
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.18em] text-[#ff8a3d]"><CalendarDays size={14} />Podcast of the day · {dateLabel}</p>
            <h2 className="mt-2 text-[26px] font-bold leading-tight tracking-tight sm:text-[32px]">{theme.title}</h2>
            <p className="mt-1.5 max-w-xl text-[14px] leading-snug text-white/75">{theme.blurb}</p>
            {lead && <button onClick={() => onOpen(lead, eps!.slice(1))} className="mt-4 flex max-w-xl items-center gap-3 rounded-xl bg-white/10 p-2.5 pr-4 text-left hover:bg-white/15" data-testid="pod-of-the-day-play">
              <img src={hiRes(lead.art, 200)} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              <span className="min-w-0 flex-1"><span className="line-clamp-2 text-[14px] font-semibold leading-snug">{lead.title}</span><span className="line-clamp-1 text-[12px] text-white/60">{lead.show}</span></span>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#ff6a1f] text-white"><Play size={18} fill="currentColor" className="ml-0.5" /></span>
            </button>}
            {eps && !eps.length && <p className="mt-4 text-[13px] text-white/60">No episodes found for this one yet.</p>}
            {!eps && <div className="mt-4 h-[76px] max-w-xl animate-pulse rounded-xl bg-white/10" />}
          </div>
        </div>
      </div>
      {eps && eps.length > 1 && <div className="flex gap-3 overflow-x-auto px-5 pb-5 [scrollbar-width:none] sm:px-6">
        {eps.slice(1, 10).map((e, i) => <button key={e.id} onClick={() => onOpen(e, eps.slice(i + 2))} className="w-[150px] shrink-0 text-left">
          <img src={hiRes(e.art, 300)} alt="" className="aspect-square w-full rounded-lg bg-white/10 object-cover" />
          <span className="mt-1.5 line-clamp-2 block text-[13px] font-medium leading-snug">{e.title}</span>
          <span className="line-clamp-1 block text-[11px] text-white/55">{e.show}</span>
        </button>)}
      </div>}
    </div>
    {events.length > 0 && <div className="mt-3">
      <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.14em] text-[#767676]"><History size={14} />On this day</p>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {events.map((ev) => <button key={`${ev.year}${ev.topic}`} onClick={() => setPicked(picked === ev ? null : ev)} aria-pressed={picked === ev}
          className={`w-[220px] shrink-0 rounded-xl p-3 text-left ${picked === ev ? "bg-[#0f0f0f] text-white" : "bg-[#f2f2f2] hover:bg-[#e5e5e5]"}`}>
          <span className="block text-[18px] font-bold leading-none">{ev.year}</span>
          <span className={`mt-1 line-clamp-3 block text-[12px] leading-snug ${picked === ev ? "text-white/75" : "text-[#606060]"}`}>{ev.text}</span>
        </button>)}
      </div>
      {picked && <div className="mt-3">
        <p className="text-[14px] font-semibold">Podcasts about {picked.topic}</p>
        {!extra ? <div className="mt-2 h-20 animate-pulse rounded-xl bg-[#f2f2f2]" /> : extra.length ? <div className="mt-2 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
          {extra.slice(0, 10).map((e, i) => <button key={e.id} onClick={() => onOpen(e, extra.slice(i + 1))} className="w-[150px] shrink-0 text-left">
            <img src={hiRes(e.art, 300)} alt="" className="aspect-square w-full rounded-lg bg-[#f2f2f2] object-cover" />
            <span className="mt-1.5 line-clamp-2 block text-[13px] font-medium leading-snug">{e.title}</span>
            <span className="line-clamp-1 block text-[11px] text-[#606060]">{e.show}</span>
          </button>)}
        </div> : <p className="mt-2 text-[13px] text-[#606060]">No episodes found about this one.</p>}
      </div>}
      <p className="mt-2 text-[11px] text-[#909090]">“On this day” from Wikipedia (CC BY-SA).</p>
    </div>}
  </section>;
}
