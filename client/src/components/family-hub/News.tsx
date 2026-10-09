// Current news: live headlines by topic, plus local news for your town. Links open the full story.
import { useEffect, useState } from "react";
import { ExternalLink, MapPin, Newspaper, RefreshCw, Settings2 } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { NEWS_TOPICS, type Headline } from "@shared/todoNews";
import { Empty, PageHead, Panel, inputClass, plain, primary, soft, type SectionProps } from "./ui";

const ago = (iso: string) => {
  if (!iso) return "";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  return m < 60 ? `${Math.max(1, m)} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} hr ago` : new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default function News({ family, setFamily }: SectionProps) {
  const { token } = useAuth();
  const prefs = family.news;
  const tabs = NEWS_TOPICS.filter((t) => prefs.topics.includes(t.id));
  const [topic, setTopic] = useState<string>(tabs[0]?.id || "top");
  const [state, setState] = useState<{ items: Headline[]; busy: boolean; error: string; updatedAt: string }>({ items: [], busy: false, error: "", updatedAt: "" });
  const [placeDraft, setPlaceDraft] = useState(prefs.place);
  const [search, setSearch] = useState("");
  const [custom, setCustom] = useState(false);
  const [round, setRound] = useState(0);
  const needsPlace = topic === "local" && !prefs.place;

  useEffect(() => {
    if (needsPlace) { setState({ items: [], busy: false, error: "", updatedAt: "" }); return; }
    const ctrl = new AbortController();
    setState((s) => ({ ...s, busy: true, error: "" }));
    const q = topic === "local" ? prefs.place : topic === "search" ? search : "";
    fetch(`${API_BASE}/api/arise-todo/news?topic=${encodeURIComponent(topic)}&q=${encodeURIComponent(q)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: ctrl.signal })
      .then(async (r) => { const b = await r.json().catch(() => null); if (!r.ok) throw new Error(b?.message || "The news can't be reached right now."); return b; })
      .then((b) => setState({ items: b.items || [], busy: false, error: "", updatedAt: b.updatedAt || "" }))
      .catch((e: Error) => { if (!ctrl.signal.aborted) setState({ items: [], busy: false, error: e.message, updatedAt: "" }); });
    return () => ctrl.abort();
  }, [topic, prefs.place, search, round, token, needsPlace]);

  const setPrefs = (patch: Partial<typeof prefs>) => setFamily((f) => ({ ...f, news: { ...f.news, ...patch } }));
  const [lead, ...rest] = state.items;

  return <div className="space-y-6">
    <PageHead eyebrow="News" title="Today's news" blurb="Headlines from news outlets across the country, updated through the day. Tap a story to read it on the publisher's site."
      action={<button onClick={() => setCustom(!custom)} className={plain + " min-h-11"}><Settings2 size={16} /> Topics</button>} />
    {custom && <Panel title="Your topics">
      <div className="flex flex-wrap gap-1.5">{NEWS_TOPICS.map((t) => { const on = prefs.topics.includes(t.id); return <button key={t.id} onClick={() => setPrefs({ topics: on ? prefs.topics.filter((x) => x !== t.id) : [...prefs.topics, t.id] })} aria-pressed={on} disabled={on && prefs.topics.length === 1}
        className={`min-h-9 rounded-xl px-3 text-xs font-bold ring-1 ${on ? "bg-violet-600 text-white ring-violet-600" : "bg-white text-slate-600 ring-slate-200"}`}>{t.label}</button>; })}</div>
      <form onSubmit={(e) => { e.preventDefault(); setPrefs({ place: placeDraft.trim().slice(0, 60) }); }} className="mt-4 flex max-w-md gap-2"><input value={placeDraft} onChange={(e) => setPlaceDraft(e.target.value)} placeholder="Your town, e.g. Denver, CO" aria-label="Town for local news" className={inputClass} /><button type="submit" className={primary}>Save</button></form>
    </Panel>}
    <div className="flex flex-wrap items-center gap-1.5">
      {tabs.map((t) => <button key={t.id} onClick={() => setTopic(t.id)} aria-pressed={topic === t.id} className={`min-h-10 rounded-xl px-4 text-xs font-bold ring-1 ${topic === t.id ? "bg-slate-800 text-white ring-slate-800" : "bg-white text-slate-600 ring-slate-200"}`}>{t.id === "local" && prefs.place ? `📍 ${prefs.place.split(",")[0]}` : t.label}</button>)}
      <form onSubmit={(e) => { e.preventDefault(); const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim(); if (q) { setSearch(q); setTopic("search"); } }} className="ml-auto flex gap-2"><input name="q" placeholder="Search news" aria-label="Search news" className={inputClass + " min-h-10 w-44"} /><button type="submit" className={soft}>Search</button></form>
      <button onClick={() => setRound((r) => r + 1)} className={plain} aria-label="Refresh"><RefreshCw size={15} className={state.busy ? "animate-spin" : ""} /></button>
    </div>

    {needsPlace ? <Panel><Empty icon={<MapPin size={26} />} title="Where are you?" action={<form onSubmit={(e) => { e.preventDefault(); if (placeDraft.trim()) setPrefs({ place: placeDraft.trim().slice(0, 60) }); }} className="flex gap-2"><input value={placeDraft} onChange={(e) => setPlaceDraft(e.target.value)} placeholder="Denver, CO" aria-label="Your town" className={inputClass} /><button type="submit" className={primary}>Show</button></form>}>Type your town or city to see local news.</Empty></Panel>
      : state.error ? <Panel><Empty icon={<Newspaper size={26} />} title="No news right now" action={<button onClick={() => setRound((r) => r + 1)} className={soft}>Try again</button>}>{state.error}</Empty></Panel>
      : state.busy && !state.items.length ? <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />)}</div>
      : !state.items.length ? <Panel><Empty icon={<Newspaper size={26} />} title="No stories found">Try another topic or search.</Empty></Panel>
      : <div className="space-y-4">
        {lead && <a href={lead.link} target="_blank" rel="noopener noreferrer" className="block rounded-[1.5rem] bg-[#292446] p-6 text-white shadow-[0_12px_24px_#2924461f] hover:bg-[#332d57]">
          <p className="text-[11px] font-black uppercase tracking-wider text-[#bcb2ff]">{lead.source}{lead.published ? ` · ${ago(lead.published)}` : ""}</p>
          <p className="mt-2 text-2xl font-black leading-tight">{lead.title}</p>
          <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-white/70">Read the story <ExternalLink size={12} /></p></a>}
        <div className="grid gap-3 md:grid-cols-2">{rest.map((h) => <a key={h.link} href={h.link} target="_blank" rel="noopener noreferrer" className="group flex flex-col rounded-2xl border border-[#e7e8f0] bg-white p-4 shadow-[0_3px_16px_#17152b08] hover:border-violet-200">
          <p className="text-[11px] font-bold text-slate-500">{h.source}{h.published ? ` · ${ago(h.published)}` : ""}</p>
          <p className="mt-1 text-sm font-bold leading-snug text-slate-800 group-hover:text-violet-700">{h.title}</p></a>)}</div>
        <p className="text-[11px] text-slate-400">Headlines via Google News. Stories belong to their publishers.</p>
      </div>}
  </div>;
}
