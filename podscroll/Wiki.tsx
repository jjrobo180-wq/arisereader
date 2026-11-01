// Pod+ Wiki podcasts: search Wikipedia (or pick today's featured or most-read articles) and listen to
// any article read by an AI voice, section by section, with speed and voice choices. Wikipedia text
// is CC BY-SA 4.0: every episode credits the article with a link, on screen and in the reading.
import { useEffect, useRef, useState } from "react";
import { BookOpenText, ChevronLeft, ExternalLink, Loader2, Pause, Play, Search, SkipBack, SkipForward } from "lucide-react";
import { AI_VOICES, sayAI, stopAiVoice, voicePieces, type AiVoiceName } from "../client/src/lib/aiVoice";
import { WIKI_LICENSE, listenMinutes, parseArticle, parseFeatured, parseSearch, wikiArticleUrl, wikiFeaturedUrl, wikiIntro, wikiOutro, wikiSearchUrl, type FeaturedWiki, type WikiArticle, type WikiHit } from "@shared/podWiki";

const getJson = async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error("Wikipedia isn't reachable right now."); return r.json(); };

function Player({ title, onBack }: { title: string; onBack: () => void }) {
  const [art, setArt] = useState<WikiArticle | null>(null);
  const [err, setErr] = useState("");
  const [sec, setSec] = useState(-1); // -1 = the spoken credit before the article
  const [piece, setPiece] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [voice, setVoice] = useState<AiVoiceName>("daniel");
  const [rate, setRate] = useState(1);
  const [quick, setQuick] = useState(false);
  const run = useRef(0);

  useEffect(() => { getJson(wikiArticleUrl(title)).then((j) => { const a = parseArticle(j); if (a) setArt(a); else setErr("That article couldn't be read."); }).catch((e) => setErr(e.message)); return () => { run.current++; stopAiVoice(); }; }, [title]);

  const sections = art ? (quick ? art.sections.slice(0, 1) : art.sections) : [];
  /** Plays from a section and piece, then carries on to the end, with the credit after the last section. */
  const play = (from: number, fromPiece = 0) => {
    if (!art) return;
    const id = ++run.current; stopAiVoice(); setPlaying(true); setSec(from); setPiece(fromPiece);
    const textOf = (i: number) => (i === -1 ? wikiIntro(art.title) : i === sections.length ? wikiOutro(art.title) : `${i > 0 ? `${sections[i].title}. ` : ""}${sections[i].text}`);
    const step = (i: number, p: number) => {
      if (id !== run.current) return;
      if (i > sections.length) { setPlaying(false); setSec(-1); setPiece(0); return; }
      const pieces = voicePieces(textOf(i), 900);
      setSec(i); setLoading(true);
      void sayAI(pieces.slice(p).join(" "), { voice, rate, onStart: () => setLoading(false), onPart: (k) => id === run.current && setPiece(p + k),
        onEnd: () => step(i + 1, 0), onError: (m) => { if (id === run.current) { setErr(m); setPlaying(false); setLoading(false); } } });
    };
    step(from, fromPiece);
  };
  const pause = () => { run.current++; stopAiVoice(); setPlaying(false); setLoading(false); };

  if (err) return <div className="px-4 pb-16 pt-4 sm:px-6"><button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[#606060]"><ChevronLeft size={18} />Wiki podcasts</button><p className="text-[#606060]">{err}</p></div>;
  if (!art) return <div className="grid place-items-center py-24"><Loader2 className="animate-spin text-[#909090]" /></div>;
  const mins = listenMinutes(sections.reduce((t, s) => t + s.text.split(/\s+/).length, 0), rate);
  return <div className="mx-auto max-w-3xl px-4 pb-32 pt-4 sm:px-6" data-testid="wiki-player">
    <button onClick={() => { pause(); onBack(); }} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-[#606060]"><ChevronLeft size={18} />Wiki podcasts</button>
    <div className="overflow-hidden rounded-2xl bg-[#0f0f0f] text-white">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
        {art.image ? <img src={art.image} alt="" className="h-32 w-32 shrink-0 rounded-xl bg-white/10 object-cover" /> : <span className="grid h-32 w-32 shrink-0 place-items-center rounded-xl bg-white/10"><BookOpenText size={44} /></span>}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#ff8a3d]">Wiki podcast</p>
          <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight">{art.title}</h1>
          <p className="mt-1 text-[13px] text-white/60">{sections.length} section{sections.length === 1 ? "" : "s"} · about {mins} min · AI voice</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-5 py-4">
        <button onClick={() => play(Math.max(-1, sec - 1))} disabled={!playing && sec <= 0} aria-label="Previous section" className="grid h-11 w-11 place-items-center rounded-full bg-white/10 disabled:opacity-30"><SkipBack size={18} /></button>
        <button onClick={() => (playing ? pause() : play(sec, piece))} aria-label={playing ? "Pause" : "Play"} className="grid h-14 w-14 place-items-center rounded-full bg-[#ff6a1f]" data-testid="wiki-play">{loading ? <Loader2 className="animate-spin" /> : playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}</button>
        <button onClick={() => play(Math.min(sections.length, sec + 1))} aria-label="Next section" className="grid h-11 w-11 place-items-center rounded-full bg-white/10"><SkipForward size={18} /></button>
        <div className="ml-auto flex items-center gap-2 text-[13px]">
          <select value={voice} onChange={(e) => { setVoice(e.target.value as AiVoiceName); if (playing) pause(); }} aria-label="Voice" className="h-9 rounded-lg bg-white/10 px-2 text-white">{AI_VOICES.map((v) => <option key={v.id} value={v.id} className="text-black">{v.label}</option>)}</select>
          <select value={rate} onChange={(e) => { setRate(Number(e.target.value)); if (playing) pause(); }} aria-label="Speed" className="h-9 rounded-lg bg-white/10 px-2 text-white">{[0.85, 1, 1.15, 1.3, 1.5].map((r) => <option key={r} value={r} className="text-black">{r}×</option>)}</select>
        </div>
      </div>
    </div>
    <label className="mt-3 flex items-center gap-2 text-[14px]"><input type="checkbox" checked={quick} onChange={(e) => { setQuick(e.target.checked); pause(); setSec(-1); setPiece(0); }} />Quick listen: just the introduction</label>
    <ol className="mt-4 space-y-1">{sections.map((s, i) => <li key={i}>
      <button onClick={() => play(i)} className={`flex w-full items-start gap-3 rounded-xl p-3 text-left ${sec === i ? "bg-[#fff1e8]" : "hover:bg-[#f2f2f2]"}`}>
        <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold ${sec === i ? "bg-[#ff6a1f] text-white" : "bg-[#f2f2f2] text-[#606060]"}`}>{i + 1}</span>
        <span className="min-w-0"><span className="block text-[15px] font-semibold">{s.title}</span><span className="line-clamp-2 block text-[13px] text-[#606060]">{s.text}</span></span>
      </button></li>)}</ol>
    <p className="mt-6 text-[12px] leading-relaxed text-[#606060]">From the Wikipedia article <a href={art.url} target="_blank" rel="noreferrer" className="font-semibold underline">“{art.title}”<ExternalLink size={11} className="ml-0.5 inline" /></a>, by Wikipedia's contributors, licensed under <a href={WIKI_LICENSE.url} target="_blank" rel="noreferrer" className="underline">{WIKI_LICENSE.name}</a>. This reading is an AI-voiced adaptation, shared under the same license.</p>
  </div>;
}

export function WikiView({ onBack }: { onBack: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<WikiHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);
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
    {!hits && feat?.today && <button onClick={() => setOpen(feat.today!.title)} className="mt-6 flex w-full flex-col overflow-hidden rounded-2xl bg-[#0f0f0f] text-left text-white sm:flex-row" data-testid="wiki-featured">
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
