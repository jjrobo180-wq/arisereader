// "About this podcast": the ⓘ button on the swipe screen. What the show is, who makes it, their
// other shows, and where it ranks on Apple Podcasts and Spotify (server/podcastInfo.ts).
import { useEffect, useState } from "react";
import { ListVideo, Loader2, X } from "lucide-react";
import { hiRes, type PodShow } from "@shared/earshot";

type Rank = { rank: number; chart: string };
type Info = {
  show: PodShow; about: string; hosts: string[]; categories: string[]; others: PodShow[];
  ranks: { apple: Rank[] | null; spotify: Rank[] | null };
  links: { name: string; url: string }[];
};

const cache = new Map<string, Info>();
const since = (d: string) => { const t = Date.parse(d); if (!Number.isFinite(t)) return ""; const days = Math.floor((Date.now() - t) / 86_400_000); return days < 1 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); };

function Ranks({ name, ranks }: { name: string; ranks: Rank[] | null }) {
  return <div className="rounded-2xl bg-white/[.06] p-3.5">
    <p className="text-[13px] font-semibold text-white/60">{name}</p>
    {ranks === null
      ? <p className="mt-1.5 text-sm text-white/45">Couldn't check right now</p>
      : ranks.length
        ? <ul className="mt-1.5 space-y-1">{ranks.map((r) => <li key={r.chart} className="flex items-baseline gap-2"><span className="text-2xl font-bold tabular-nums tracking-tight">#{r.rank}</span><span className="truncate text-sm text-white/65">{r.chart}</span></li>)}</ul>
        : <p className="mt-1.5 text-sm text-white/45">Not in the top 200</p>}
  </div>;
}

export function InfoSheet({ show, api, ex, onClose, onShow, onEpisodes }: {
  show: PodShow; api: (path: string) => Promise<any>; ex: string;
  onClose: () => void; onShow: (s: PodShow) => void; onEpisodes: () => void;
}) {
  const [info, setInfo] = useState<Info | null>(cache.get(show.id) ?? null);
  const [err, setErr] = useState("");
  const [more, setMore] = useState(false);
  useEffect(() => {
    if (cache.has(show.id)) return;
    let live = true;
    api(`/api/earshot/show/${show.id}/info?x=1${ex}`).then((b: Info) => { if (!live) return; cache.set(show.id, b); setInfo(b); }).catch((e: any) => live && setErr(e?.message || "Couldn't load this podcast."));
    return () => { live = false; };
  }, [show.id]);
  const s = info?.show ?? show;
  const facts = [s.episodes ? `${s.episodes.toLocaleString()} episodes` : "", s.latest ? `New ${since(s.latest)}` : "", ...(info?.categories.slice(0, 2) ?? [])].filter(Boolean);

  return <div className="fixed inset-0 z-50 flex flex-col justify-end">
    <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/55" />
    <div role="dialog" aria-modal="true" aria-label={`About ${s.name}`} className="relative flex max-h-[88%] flex-col rounded-t-3xl bg-[#1d1720] pb-[env(safe-area-inset-bottom,0px)] text-white shadow-2xl">
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-[1] grid h-9 w-9 place-items-center rounded-full bg-white/10"><X size={18} /></button>
      <div className="min-h-0 overflow-y-auto px-5 pb-6 pt-5">
        <div className="flex items-center gap-4 pr-10">
          <img src={hiRes(s.art, 300)} alt="" referrerPolicy="no-referrer" className="h-20 w-20 flex-none rounded-2xl object-cover" />
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-lg font-bold leading-tight">{s.name}</h3>
            {s.author && <p className="mt-0.5 truncate text-sm text-white/60">{s.author}</p>}
            {!!facts.length && <p className="mt-1 truncate text-xs text-white/45">{facts.join(" · ")}</p>}
          </div>
        </div>

        {!info && !err && <p className="mt-6 flex items-center gap-2 text-sm text-white/55"><Loader2 size={16} className="animate-spin" />Looking it up…</p>}
        {err && !info && <p className="mt-6 text-sm text-white/60">{err}</p>}

        {info && <>
          {info.about && <div className="mt-4">
            <p className={`whitespace-pre-line text-[15px] leading-relaxed text-white/80 ${more ? "" : "line-clamp-4"}`}>{info.about}</p>
            {info.about.length > 220 && <button type="button" onClick={() => setMore((m) => !m)} className="mt-1 text-sm font-semibold text-white/60 hover:text-white">{more ? "Less" : "More"}</button>}
          </div>}
          {!!info.hosts.length && <p className="mt-3 text-sm text-white/60"><span className="font-semibold text-white/80">{info.hosts.length > 1 ? "Hosts" : "Host"}:</span> {info.hosts.join(", ")}</p>}

          <h4 className="mt-6 text-[15px] font-bold">How it ranks</h4>
          <div className="mt-2 grid grid-cols-2 gap-2.5">
            <Ranks name="Apple Podcasts" ranks={info.ranks.apple} />
            <Ranks name="Spotify" ranks={info.ranks.spotify} />
          </div>
          <p className="mt-1.5 text-xs text-white/35">US charts, updated through the day.</p>

          {!!info.others.length && <>
            <h4 className="mt-6 text-[15px] font-bold">More from {s.author}</h4>
            <div className="-mx-5 mt-2 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {info.others.map((o) => <button key={o.id} type="button" onClick={() => onShow(o)} className="w-24 flex-none text-left">
                <img src={hiRes(o.art, 300)} alt="" referrerPolicy="no-referrer" loading="lazy" className="aspect-square w-full rounded-xl object-cover transition active:scale-95" />
                <span className="mt-1.5 line-clamp-2 block text-xs font-medium leading-snug text-white/80">{o.name}</span>
              </button>)}
            </div>
          </>}
        </>}

        <button type="button" onClick={onEpisodes} className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white font-semibold text-[#0e0d10]"><ListVideo size={18} />All episodes</button>
      </div>
    </div>
  </div>;
}
