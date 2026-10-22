// Daily quote (a Plugin Store add-on): a motivational quote for each day, more on tap, and favorites.
import { useState } from "react";
import { Copy, Heart, Quote, Shuffle } from "lucide-react";
import { QUOTES, forDay, type MotivationQuote } from "@shared/lifePlugins";
import { Empty, PageHead, Panel, plain, soft, type SectionProps } from "./ui";

export default function Quotes({ family, setFamily, today, say }: SectionProps) {
  const daily = forDay(QUOTES, today);
  const [shown, setShown] = useState<MotivationQuote>(daily);
  const saved = new Set(family.savedQuotes);
  const toggleSave = (q: MotivationQuote) => setFamily((f) => ({ ...f, savedQuotes: f.savedQuotes.includes(q.id) ? f.savedQuotes.filter((x) => x !== q.id) : [...f.savedQuotes, q.id] }));
  const another = () => { let next = shown; while (next.id === shown.id) next = QUOTES[Math.floor(Math.random() * QUOTES.length)]; setShown(next); };
  const copy = async (q: MotivationQuote) => { try { await navigator.clipboard.writeText(`“${q.text}” — ${q.by}`); say("Quote copied."); } catch { say("Couldn't copy on this device."); } };
  const favorites = QUOTES.filter((q) => saved.has(q.id));

  return <div className="space-y-6">
    <PageHead eyebrow="Daily quote" title="A little push" blurb="A new quote every day. Save the ones that stick." />
    <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#2d2555] via-[#4b3fa0] to-[#7c6be6] p-7 text-white shadow-[0_18px_40px_#4b3fa033] sm:p-10">
      <Quote className="absolute -right-4 -top-4 h-40 w-40 text-white/10" aria-hidden />
      <p className="relative text-[11px] font-extrabold uppercase tracking-[.2em] text-violet-200">{shown.id === daily.id ? "Today's quote" : "Another one"}</p>
      <blockquote className="relative mt-4 text-2xl font-black leading-snug tracking-tight sm:text-3xl">“{shown.text}”</blockquote>
      <p className="relative mt-4 text-sm font-bold text-violet-100">— {shown.by}</p>
      <div className="relative mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={() => toggleSave(shown)} aria-pressed={saved.has(shown.id)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/15 px-3 text-sm font-semibold hover:bg-white/25"><Heart size={16} className={saved.has(shown.id) ? "fill-current" : ""} />{saved.has(shown.id) ? "Saved" : "Save"}</button>
        <button type="button" onClick={another} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/15 px-3 text-sm font-semibold hover:bg-white/25"><Shuffle size={16} />Another</button>
        <button type="button" onClick={() => copy(shown)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/15 px-3 text-sm font-semibold hover:bg-white/25"><Copy size={16} />Copy</button>
        {shown.id !== daily.id && <button type="button" onClick={() => setShown(daily)} className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-violet-100 hover:bg-white/10">Back to today's</button>}
      </div>
    </section>
    <Panel title={`Saved · ${favorites.length}`}>
      {favorites.length ? <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">{favorites.map((q) => <li key={q.id} className="rounded-2xl border border-slate-100 p-4">
        <p className="text-sm font-bold leading-6 text-[#232139]">“{q.text}”</p>
        <div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs text-slate-500">— {q.by}</span>
          <span className="flex gap-1"><button type="button" onClick={() => copy(q)} className={plain + " px-2"} aria-label="Copy quote"><Copy size={14} /></button><button type="button" onClick={() => toggleSave(q)} className={soft + " px-2"} aria-label="Remove from saved"><Heart size={14} className="fill-current" /></button></span>
        </div>
      </li>)}</ul> : <Empty icon={<Heart />} title="No saved quotes yet.">Tap Save on a quote you want to keep.</Empty>}
    </Panel>
  </div>;
}
