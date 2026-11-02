// Pod+ Wiki podcasts: search Wikipedia (or pick today's featured or most-read articles) and listen to
// any article read by an AI voice, section by section, with speed and voice choices. Wikipedia text
// is CC BY-SA 4.0: every episode credits the article with a link, on screen and in the reading.
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { BookOpenText, ChevronLeft, ExternalLink, Loader2, Pause, Play, Search, SkipBack, SkipForward } from "lucide-react";
import { AI_VOICES, stopAiVoice, type AiVoiceName } from "../client/src/lib/aiVoice";
import { closeWiki, openWiki, pauseWiki, toggleWiki, playWiki, setWikiQuick, setWikiRate, setWikiVoice, skipWiki, subscribeWiki, wikiSections, wikiState } from "./wikiPlayer";
import { WIKI_LICENSE, listenMinutes, parseArticle, parseFeatured, parseSearch, wikiArticleUrl, wikiFeaturedUrl, wikiIntro, wikiOutro, wikiSearchUrl, type FeaturedWiki, type WikiArticle, type WikiHit } from "@shared/podWiki";

const getJson = async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error("Wikipedia isn't reachable right now."); return r.json(); };

function Player({ title, onBack }: { title: string; onBack: () => void }) {
  // The reading belongs to wikiPlayer.ts, not to this screen: leaving this page doesn't stop it.
  const [, bump] = useState(0);
  useEffect(() => subscribeWiki(() => bump((n) => n + 1)), []);
  useEffect(() => { void openWiki(title); }, [title]);
  const st = wikiState();
  const mine = st.title === title;
  const art = mine ? st.art : null;
  const err = mine ? st.err : "";
  const { sec, piece, playing, loading, voice, rate, quick } = st;
  const sections = mine ? wikiSections(st) : [];
  const play = playWiki;
  const pause = pauseWiki;

  if (err) return <div className="px-4 pb-16 pt-4 sm:px-6"><button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[#606060]"><ChevronLeft size={18} />Wiki podcasts</button><p className="text-[#606060]">{err}</p></div>;
  if (!art) return <div className="grid place-items-center py-24"><Loader2 className="animate-spin text-[#909090]" /></div>;
  const mins = listenMinutes(sections.reduce((t, s) => t + s.text.split(/\s+/).length, 0), rate);
  return <div className="mx-auto max-w-3xl px-4 pb-32 pt-4 sm:px-6" data-testid="wiki-player">
    <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-[#606060]"><ChevronLeft size={18} />Wiki podcasts</button>
    <div className="ps-keep overflow-hidden rounded-2xl bg-[#0f0f0f] text-white ring-1 ring-white/10">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
        {art.image ? <img src={art.image} alt="" className="h-32 w-32 shrink-0 rounded-xl bg-white/10 object-cover" /> : <span className="grid h-32 w-32 shrink-0 place-items-center rounded-xl bg-white/10"><BookOpenText size={44} /></span>}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#ff8a3d]">Wiki podcast</p>
          <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight">{art.title}</h1>
          <p className="mt-1 text-[13px] text-white/60">{sections.length} section{sections.length === 1 ? "" : "s"} · about {mins} min · AI voice</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-5 py-4">
        <button onClick={() => skipWiki(-1)} disabled={!playing && sec <= 0} aria-label="Previous section" className="grid h-11 w-11 place-items-center rounded-full bg-white/10 disabled:opacity-30"><SkipBack size={18} /></button>
        <button onClick={() => (playing ? pause() : play(sec, piece))} aria-label={playing ? "Pause" : "Play"} className="grid h-14 w-14 place-items-center rounded-full bg-[#ff6a1f]" data-testid="wiki-play">{loading ? <Loader2 className="animate-spin" /> : playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}</button>
        <button onClick={() => skipWiki(1)} aria-label="Next section" className="grid h-11 w-11 place-items-center rounded-full bg-white/10"><SkipForward size={18} /></button>
        <div className="ml-auto flex items-center gap-2 text-[13px]">
          <select value={voice} onChange={(e) => setWikiVoice(e.target.value as AiVoiceName)} aria-label="Voice" className="h-9 rounded-lg bg-white/10 px-2 text-white">{AI_VOICES.map((v) => <option key={v.id} value={v.id} className="text-black">{v.label}</option>)}</select>
          <select value={rate} onChange={(e) => setWikiRate(Number(e.target.value))} aria-label="Speed" className="h-9 rounded-lg bg-white/10 px-2 text-white">{[0.85, 1, 1.15, 1.3, 1.5].map((r) => <option key={r} value={r} className="text-black">{r}×</option>)}</select>
        </div>
      </div>
    </div>
    <label className="mt-3 flex items-center gap-2 text-[14px]"><input type="checkbox" checked={quick} onChange={(e) => setWikiQuick(e.target.checked)} />Quick listen: just the introduction</label>
    <ol className="mt-4 space-y-1">{sections.map((s, i) => <li key={i}>
      <button onClick={() => play(i)} className={`flex w-full items-start gap-3 rounded-xl p-3 text-left ${sec === i ? "bg-[#fff1e8]" : "hover:bg-[#f2f2f2]"}`}>
        <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold ${sec === i ? "bg-[#ff6a1f] text-white" : "bg-[#f2f2f2] text-[#606060]"}`}>{i + 1}</span>
        <span className="min-w-0"><span className="block text-[15px] font-semibold">{s.title}</span><span className="line-clamp-2 block text-[13px] text-[#606060]">{s.text.slice(0, 220)}</span></span>
      </button></li>)}</ol>
    <p className="mt-6 text-[12px] leading-relaxed text-[#606060]">From the Wikipedia article <a href={art.url} target="_blank" rel="noreferrer" className="font-semibold underline">“{art.title}”<ExternalLink size={11} className="ml-0.5 inline" /></a>, by Wikipedia's contributors, licensed under <a href={WIKI_LICENSE.url} target="_blank" rel="noreferrer" className="underline">{WIKI_LICENSE.name}</a>. This reading is an AI-voiced adaptation, shared under the same license.</p>
  </div>;
}

/** A problem inside Wiki podcasts shows a message and a way back, instead of taking the whole app down. */
class WikiGuard extends Component<{ onBack: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { stopAiVoice(); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6"><p className="font-semibold">Wiki podcasts hit a problem.</p>
      <p className="mt-1 text-sm text-[#606060]">Nothing else is affected. Try again, or go back home.</p>
      <div className="mt-4 flex gap-2"><button onClick={() => this.setState({ failed: false })} className="h-10 rounded-full bg-[#ff6a1f] px-4 text-sm font-semibold text-white">Try again</button>
        <button onClick={this.props.onBack} className="h-10 rounded-full bg-[#f2f2f2] px-4 text-sm font-semibold">Home</button></div></div>;
  }
}

export function WikiView({ onBack, start }: { onBack: () => void; start?: string | null }) {
  return <WikiGuard onBack={onBack}><WikiViewInner onBack={onBack} start={start} /></WikiGuard>;
}

function WikiViewInner({ onBack, start }: { onBack: () => void; start?: string | null }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<WikiHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(start ?? (wikiState().art ? wikiState().title : null));
  const [feat, setFeat] = useState<{ today?: FeaturedWiki; popular: FeaturedWiki[] } | null>(null);
  useEffect(() => { getJson(wikiFeaturedUrl()).then((j) => setFeat(parseFeatured(j))).catch(() => setFeat({ popular: [] })); }, []);
  useEffect(() => {
    const t = q.trim(); if (t.length < 2) { setHits(null); return; }
    let live = true; setBusy(true); setErr("");
    const timer = window.setTimeout(() => getJson(wikiSearchUrl(t)).then((j) => live && setHits(parseSearch(j))).catch((e) => live && setErr(e.message)).finally(() => live && setBusy(false)), 350);
    return () => { live = false; window.clearTimeout(timer); };
  }, [q]);
  if (open) return <Player title={open} onBack={() => setOpen(null)} />;
  return <div className="mx-auto max-w-3xl px-4 pb-16 pt-4 sm:px-6" data-testid="wiki-view">
    <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-[#606060]"><ChevronLeft size={18} />Home</button>
    <h1 className="text-2xl font-bold tracking-tight">Wiki podcasts</h1>
    <p className="mt-1 text-sm text-[#606060]">Any Wikipedia article, read to you by an AI voice. Search a topic, person, place or event.</p>
    <div className="relative mt-4"><Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#909090]" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Wikipedia" className="h-12 w-full rounded-full bg-[#f2f2f2] pl-10 pr-4 text-[16px] outline-none focus:ring-2 focus:ring-[#ff6a1f]" data-testid="wiki-search" /></div>
    {err && <p className="mt-3 text-sm text-[#c0392b]">{err}</p>}
    {busy && <div className="mt-6 grid place-items-center"><Loader2 className="animate-spin text-[#909090]" /></div>}
    {hits && !busy && <ul className="mt-4 space-y-1">{hits.map((h) => <li key={h.title}><button onClick={() => setOpen(h.title)} className="flex w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-[#f2f2f2]">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#fff1e8] text-[#ff6a1f]"><Play size={16} fill="currentColor" /></span>
      <span className="min-w-0"><span className="block text-[15px] font-semibold">{h.title}</span><span className="line-clamp-2 block text-[13px] text-[#606060]">{h.snippet}</span><span className="text-[12px] text-[#909090]">about {listenMinutes(h.words)} min</span></span>
    </button></li>)}{!hits.length && <li className="p-3 text-[#606060]">No articles found.</li>}</ul>}
    {!hits && feat?.today && <button onClick={() => setOpen(feat.today!.title)} className="ps-keep mt-6 flex w-full flex-col overflow-hidden rounded-2xl bg-[#0f0f0f] text-left text-white sm:flex-row" data-testid="wiki-featured">
      {feat.today.image && <img src={feat.today.image} alt="" className="h-44 w-full object-cover sm:h-auto sm:w-48" />}
      <span className="flex-1 p-5"><span className="text-[11px] font-bold uppercase tracking-[.18em] text-[#ff8a3d]">Today's featured article</span><span className="mt-1 block text-[22px] font-bold leading-tight">{feat.today.title}</span><span className="mt-1.5 line-clamp-3 block text-[13px] text-white/70">{feat.today.extract}</span>
        <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#ff6a1f] px-4 py-2 text-[14px] font-semibold"><Play size={15} fill="currentColor" />Listen</span></span>
    </button>}
    {!hits && !!feat?.popular.length && <><h2 className="mb-2 mt-8 text-lg font-bold">Most read today</h2>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">{feat.popular.map((p) => <button key={p.title} onClick={() => setOpen(p.title)} className="text-left">
        {p.image ? <img src={p.image} alt="" className="aspect-[4/3] w-full rounded-lg bg-[#f2f2f2] object-cover" /> : <span className="grid aspect-[4/3] w-full place-items-center rounded-lg bg-[#f2f2f2]"><BookOpenText className="text-[#909090]" /></span>}
        <span className="mt-1.5 line-clamp-2 block text-[14px] font-semibold leading-snug">{p.title}</span>
      </button>)}</div></>}
    <p className="mt-8 text-[12px] text-[#909090]">Articles from Wikipedia, the free encyclopedia, by its contributors, under {WIKI_LICENSE.name}. Read by an AI voice.</p>
  </div>;
}

/** A small bar for a Wiki podcast that is playing or paused while you're elsewhere in Pod+. */
export function WikiMini({ lift, onOpen }: { lift: boolean; onOpen: (title: string) => void }) {
  const [, bump] = useState(0);
  useEffect(() => subscribeWiki(() => bump((n) => n + 1)), []);
  const st = wikiState();
  if (!st.art) return null;
  return <div role="region" aria-label="Now playing Wiki podcast" className="fixed inset-x-3 z-[41] flex items-center gap-3 rounded-2xl bg-[#0f0f0f] p-2 pr-3 text-white shadow-xl ring-1 ring-white/10"
    style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${lift ? "5.5rem" : "0.75rem"})` }} data-testid="wiki-mini">
    <button onClick={() => onOpen(st.art!.title)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Open ${st.art.title}`}>
      {st.art.image ? <img src={st.art.image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10"><BookOpenText size={18} /></span>}
      <span className="min-w-0"><span className="block truncate text-[14px] font-semibold leading-tight">{st.art.title}</span><span className="block truncate text-[12px] text-white/60">Wiki podcast</span></span>
    </button>
    <button onClick={() => toggleWiki()} aria-label={st.playing ? "Pause" : "Play"} className="grid h-10 w-10 place-items-center rounded-full bg-[#ff6a1f]">{st.loading ? <Loader2 size={18} className="animate-spin" /> : st.playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}</button>
    <button onClick={() => closeWiki()} aria-label="Close" className="text-[12px] font-semibold text-white/60">Stop</button>
  </div>;
}
