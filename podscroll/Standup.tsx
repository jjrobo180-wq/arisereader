// Pod+ Stand-up: pick your favorite comedians and hear only their stand-up: sets, specials, live
// shows and comedy albums, never interviews or podcast chat. An AI checks every episode
// (server/podcastStandup.ts), suggests comedians like the ones you picked, and keeps search here
// to stand-up only. Favorites are kept on this device.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2, Mic2, Plus, Search, Sparkles, X } from "lucide-react";
import type { PodEpisode } from "@shared/earshot";

type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
const KEY = "podscroll.comics";
const readComics = (): string[] => { try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 20) : []; } catch { return []; } };
const tidy = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 60);

/** One comedian's stand-up, loaded on its own so the first one shows while the rest load. */
function ComicRow({ api, ex, name, grid, onRemove }: { api: Api; ex: string; name: string; grid: (list: PodEpisode[]) => ReactNode; onRemove: () => void }) {
  const [list, setList] = useState<PodEpisode[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    setList(null); setErr("");
    api(`/api/earshot/standup?comic=${encodeURIComponent(name)}${ex}`).then((b) => { if (live) setList(Array.isArray(b?.episodes) ? b.episodes : []); }).catch((e) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [api, name, ex]);
  return <section aria-label={name} className="mt-8">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-xl font-bold tracking-tight">{name}</h2>
      <button onClick={onRemove} className="h-8 rounded-full px-3 text-sm font-medium text-[#606060] hover:bg-[#f2f2f2]">Remove</button>
    </div>
    {err ? <p className="text-sm text-[#606060]">{err}</p>
      : !list ? <div className="flex items-center gap-2 py-6 text-sm text-[#606060]"><Loader2 className="animate-spin" size={18} />Finding {name}'s stand-up (only sets, no interviews)…</div>
      : list.length ? grid(list)
      : <p className="text-sm text-[#606060]">No stand-up from {name} on podcasts yet. Interviews and chats are left out, so some comedians only have a few sets here.</p>}
  </section>;
}

export function StandupHub({ api, ex, onBack, grid, say }: { api: Api; ex: string; onBack: () => void; grid: (list: PodEpisode[]) => ReactNode; say: (m: string) => void }) {
  const [comics, setComicsState] = useState<string[]>(readComics);
  const [add, setAdd] = useState("");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<PodEpisode[] | null>(null);
  const [searchErr, setSearchErr] = useState("");
  const [sampler, setSampler] = useState<PodEpisode[] | null>(null);
  const [ideas, setIdeas] = useState<{ name: string; why: string }[] | null>(null);
  const [thinking, setThinking] = useState(false);

  const setComics = useCallback((next: string[]) => { setComicsState(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private window */ } }, []);
  const addComic = (name: string) => {
    const n = tidy(name);
    if (!n) return;
    if (comics.some((c) => c.toLowerCase() === n.toLowerCase())) { say(`${n} is already one of your comedians.`); return; }
    if (comics.length >= 20) { say("You can follow up to 20 comedians here. Remove one first."); return; }
    setComics([n, ...comics]); setAdd(""); setIdeas((cur) => cur?.filter((x) => x.name.toLowerCase() !== n.toLowerCase()) ?? null);
  };

  // No favorites yet: stand-up to start with.
  useEffect(() => {
    if (comics.length || sampler) return;
    api(`/api/earshot/standup?x=1${ex}`).then((b) => setSampler(Array.isArray(b?.episodes) ? b.episodes : [])).catch(() => setSampler([]));
  }, [api, ex, comics.length, sampler]);

  // Search inside Stand-up: stand-up only, whatever the words.
  useEffect(() => {
    if (!term) { setResults(null); return; }
    let live = true;
    setResults(null); setSearchErr("");
    api(`/api/earshot/standup/search?q=${encodeURIComponent(term)}${ex}`).then((b) => { if (live) setResults(Array.isArray(b?.episodes) ? b.episodes : []); }).catch((e) => { if (live) setSearchErr(e.message); });
    return () => { live = false; };
  }, [api, ex, term]);

  const suggest = async () => {
    setThinking(true);
    try { const b = await api("/api/earshot/standup/suggest", { method: "POST", body: { comics } }); setIdeas(Array.isArray(b?.comics) ? b.comics : []); }
    catch (e: any) { say(e.message); }
    setThinking(false);
  };

  return <section aria-label="Stand-up" className="pt-3 pb-16">
    <div className="ps-keep relative overflow-hidden rounded-2xl p-5 text-[#ffffff] sm:p-6" style={{ background: "radial-gradient(120% 140% at 15% 0%, #5b1530 0%, #1a0b16 55%, #0d0910 100%)" }}>
      {/* A spotlight on a brick wall. */}
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full opacity-40 blur-3xl" style={{ background: "#ffcf6a" }} />
      <button onClick={onBack} className="relative mb-3 text-sm font-medium text-[#e9cfd8] hover:text-[#ffffff]">← Home</button>
      <p className="relative flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#ffcf6a]"><Mic2 size={14} />Stand-up</p>
      <h1 className="relative mt-2 text-[26px] font-bold leading-tight tracking-tight sm:text-[32px]">Just the sets.</h1>
      <p className="relative mt-2 max-w-xl text-[14px] text-[#f1e4e9]">Pick your favorite comedians and hear only their stand-up: specials, live sets and comedy albums. No interviews, no podcast chat. AI checks every episode before it shows up here.</p>
      <form onSubmit={(e) => { e.preventDefault(); addComic(add); }} className="relative mt-4 flex max-w-lg items-center gap-2">
        <label htmlFor="ps-comic-add" className="sr-only">Add a comedian</label>
        <input id="ps-comic-add" value={add} onChange={(e) => setAdd(e.target.value)} maxLength={60} placeholder="Add a comedian (e.g. Ali Wong)" className="h-11 min-w-0 flex-1 rounded-full border-0 bg-[#ffffff]/12 px-4 text-sm text-[#ffffff] outline-none placeholder:text-[#d8c3cb] focus:bg-[#ffffff]/20" />
        <button type="submit" disabled={!tidy(add)} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-[#ffcf6a] px-4 text-sm font-semibold text-[#1a0b16] disabled:opacity-50"><Plus size={16} />Add</button>
      </form>
      {comics.length > 0 && <div className="relative mt-3 flex flex-wrap gap-2" aria-label="Your comedians">
        {comics.map((c) => <span key={c} className="inline-flex h-8 items-center gap-1 rounded-full bg-[#ffffff]/15 pl-3 pr-1 text-sm font-medium">{c}<button onClick={() => setComics(comics.filter((x) => x !== c))} aria-label={`Remove ${c}`} className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-[#ffffff]/20"><X size={13} /></button></span>)}
      </div>}
      <button onClick={() => void suggest()} disabled={thinking} className="relative mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-[#ffffff]/10 px-4 text-sm font-semibold hover:bg-[#ffffff]/20 disabled:opacity-60">{thinking ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />}{comics.length ? "Comedians like these" : "Suggest comedians"}</button>
      {ideas && <div className="relative mt-3 grid gap-2 sm:grid-cols-2">
        {ideas.length ? ideas.map((i) => <button key={i.name} onClick={() => addComic(i.name)} className="flex items-start gap-2 rounded-xl bg-[#ffffff]/10 p-3 text-left hover:bg-[#ffffff]/15">
          <Plus size={16} className="mt-0.5 shrink-0 text-[#ffcf6a]" />
          <span className="min-w-0"><span className="block text-sm font-semibold">{i.name}</span><span className="block text-xs text-[#e3d3da]">{i.why}</span></span>
        </button>) : <p className="text-sm text-[#e3d3da]">No suggestions right now. Try again in a moment.</p>}
      </div>}
    </div>

    <form role="search" onSubmit={(e) => { e.preventDefault(); setTerm(tidy(q)); }} className="mt-5 flex max-w-lg items-center">
      <label htmlFor="ps-standup-q" className="sr-only">Search stand-up</label>
      <input id="ps-standup-q" type="search" value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setTerm(""); }} placeholder="Search stand-up only (a comedian, a topic, a special)" className="h-10 min-w-0 flex-1 rounded-l-full border border-r-0 border-[#d3d3d3] px-4 text-sm outline-none focus:border-[#1c62b9]" />
      <button type="submit" aria-label="Search stand-up" className="inline-flex h-10 w-12 shrink-0 items-center justify-center rounded-r-full border border-[#d3d3d3] bg-[#f8f8f8]"><Search size={18} /></button>
    </form>

    {term ? <section aria-label="Search results" className="mt-6">
      <h2 className="mb-3 text-xl font-bold tracking-tight">Stand-up for “{term}”</h2>
      {searchErr ? <p className="text-sm text-[#606060]">{searchErr}</p>
        : !results ? <div className="flex items-center gap-2 py-6 text-sm text-[#606060]"><Loader2 className="animate-spin" size={18} />Searching stand-up only…</div>
        : results.length ? grid(results)
        : <p className="text-sm text-[#606060]">No stand-up found for “{term}”. Only real sets and specials show here, so try a comedian's name.</p>}
    </section>
      : comics.length ? comics.map((c) => <ComicRow key={c} api={api} ex={ex} name={c} grid={grid} onRemove={() => setComics(comics.filter((x) => x !== c))} />)
      : <section aria-label="Stand-up to start with" className="mt-6">
        <h2 className="mb-1 text-xl font-bold tracking-tight">Stand-up to start with</h2>
        <p className="mb-3 text-sm text-[#606060]">Add a few comedians above to fill this page with their sets.</p>
        {!sampler ? <div className="flex items-center gap-2 py-6 text-sm text-[#606060]"><Loader2 className="animate-spin" size={18} />Finding stand-up…</div>
          : sampler.length ? grid(sampler) : <p className="text-sm text-[#606060]">Nothing to show right now. Add a comedian above.</p>}
      </section>}
  </section>;
}
