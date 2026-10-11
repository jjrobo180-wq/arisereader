// Today in history (a Plugin Store add-on): what happened on this day, who was born, and the
// day's observances, from Wikipedia. Pick any other day too.
import { useState } from "react";
import { ExternalLink, History, RefreshCw } from "lucide-react";
import type { HistoryEvent } from "@shared/lifePlugins";
import { useLifeFeed } from "./useLifeFeed";
import { Empty, PageHead, Panel, inputClass, plain, type SectionProps } from "./ui";

type Feed = { selected: HistoryEvent[]; events: HistoryEvent[]; births: HistoryEvent[]; holidays: HistoryEvent[]; month: number; day: number };
const TABS = [["selected", "Highlights"], ["events", "Events"], ["births", "Born today"], ["holidays", "Observances"]] as const;

export default function TodayInHistory({ today }: SectionProps) {
  const [date, setDate] = useState(today);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("selected");
  const [round, setRound] = useState(0);
  const [, m, d] = date.split("-").map(Number);
  const feed = useLifeFeed<Feed>(`/api/lifehub/history?month=${m}&day=${d}`, round);
  const list = feed.data?.[tab] ?? [];
  const label = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" });

  return <div className="space-y-6">
    <PageHead eyebrow="Today in history" title={`On ${label}`} blurb="What happened on this day over the years. From Wikipedia."
      action={<input type="date" value={date} onChange={(e) => setDate(e.target.value || today)} className={inputClass + " w-auto"} aria-label="Pick a day" />} />
    <div className="flex flex-wrap gap-1.5">{TABS.map(([id, name]) => <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id} className={`min-h-10 rounded-xl px-4 text-sm font-bold ${tab === id ? "bg-[#292446] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900"}`}>{name}</button>)}</div>
    <Panel>
      {feed.busy ? <p className="flex items-center gap-2 py-8 text-sm text-slate-500"><RefreshCw size={16} className="animate-spin" />Looking back in time…</p>
        : feed.error ? <div className="py-6 text-center"><p className="text-sm text-rose-700" role="alert">{feed.error}</p><button type="button" onClick={() => setRound((r) => r + 1)} className={plain + " mt-3"}><RefreshCw size={15} />Try again</button></div>
        : list.length ? <ol className="relative space-y-5 border-l-2 border-violet-100 pl-6">{list.map((e, i) => <li key={i} className="relative">
            <span className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-violet-500" aria-hidden />
            <div className="flex gap-4">
              <div className="min-w-0 flex-1">
                {e.year > 0 && <p className="text-sm font-black text-violet-700">{e.year}</p>}
                <p className="text-sm leading-6 text-slate-700">{e.text}</p>
                {e.url && <a href={e.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-violet-700">{e.title || "Read more"}<ExternalLink size={12} /></a>}
              </div>
              {e.image && <img src={e.image} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
            </div>
          </li>)}</ol>
        : <Empty icon={<History />} title="Nothing listed for this day.">Try another tab or another day.</Empty>}
    </Panel>
  </div>;
}
