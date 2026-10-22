// What's trending (a Plugin Store add-on): what people are searching for right now (Google Trends,
// United States) and the most-read stories on Wikipedia.
import { useState } from "react";
import { ExternalLink, RefreshCw, TrendingUp } from "lucide-react";
import type { MostRead, TrendingSearch } from "@shared/lifePlugins";
import { useLifeFeed } from "./useLifeFeed";
import { Empty, PageHead, Panel, plain, type SectionProps } from "./ui";

type Feed = { searches: TrendingSearch[]; mostRead: MostRead[]; updatedAt: string };

export default function Trending(_: SectionProps) {
  const [round, setRound] = useState(0);
  const [tab, setTab] = useState<"searches" | "mostRead">("searches");
  const feed = useLifeFeed<Feed>("/api/lifehub/trending", round);
  const searches = feed.data?.searches ?? [], mostRead = feed.data?.mostRead ?? [];

  return <div className="space-y-6">
    <PageHead eyebrow="What's trending" title="What everyone's talking about" blurb="Top searches in the United States right now, and the stories people are reading most."
      action={<button type="button" onClick={() => setRound((r) => r + 1)} className={plain} disabled={feed.busy}><RefreshCw size={16} className={feed.busy ? "animate-spin" : ""} />Refresh</button>} />
    <div className="flex flex-wrap gap-1.5">
      {([["searches", "Trending searches"], ["mostRead", "Most read"]] as const).map(([id, name]) => <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id} className={`min-h-10 rounded-xl px-4 text-sm font-bold ${tab === id ? "bg-[#292446] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900"}`}>{name}</button>)}
    </div>
    <Panel>
      {feed.busy && !feed.data ? <p className="flex items-center gap-2 py-8 text-sm text-slate-500"><RefreshCw size={16} className="animate-spin" />Checking what's hot…</p>
        : feed.error ? <div className="py-6 text-center"><p className="text-sm text-rose-700" role="alert">{feed.error}</p><button type="button" onClick={() => setRound((r) => r + 1)} className={plain + " mt-3"}><RefreshCw size={15} />Try again</button></div>
        : tab === "searches" ? (searches.length ? <ol className="divide-y divide-slate-100">{searches.map((t, i) => <li key={i} className="flex gap-4 py-3.5">
            <span className="w-7 shrink-0 pt-0.5 text-right text-lg font-black tabular-nums text-slate-300">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2"><a href={`https://www.google.com/search?q=${encodeURIComponent(t.title)}`} target="_blank" rel="noreferrer" className="font-extrabold text-[#232139] hover:text-violet-700">{t.title}</a>{t.traffic && <span className="text-xs font-bold text-emerald-600">{t.traffic} searches</span>}</div>
              {t.news.map((n, j) => <a key={j} href={n.url} target="_blank" rel="noreferrer" className="mt-1 flex items-start gap-1 text-sm text-slate-500 hover:text-violet-700"><span className="min-w-0">{n.title}{n.source && <span className="text-slate-400"> · {n.source}</span>}</span><ExternalLink size={12} className="mt-1 shrink-0" /></a>)}
            </div>
            {t.image && <img src={t.image} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover" />}
          </li>)}</ol> : <Empty icon={<TrendingUp />} title="No trending searches right now.">Check Most read, or refresh in a bit.</Empty>)
        : (mostRead.length ? <ol className="divide-y divide-slate-100">{mostRead.map((a, i) => <li key={i} className="flex gap-4 py-3.5">
            <span className="w-7 shrink-0 pt-0.5 text-right text-lg font-black tabular-nums text-slate-300">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <a href={a.url} target="_blank" rel="noreferrer" className="font-extrabold text-[#232139] hover:text-violet-700">{a.title}</a>
              <span className="ml-2 text-xs font-bold text-slate-400">{a.views.toLocaleString()} views</span>
              {a.extract && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{a.extract}</p>}
            </div>
            {a.image && <img src={a.image} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover" />}
          </li>)}</ol> : <Empty icon={<TrendingUp />} title="Nothing here right now.">Try again in a bit.</Empty>)}
    </Panel>
  </div>;
}
