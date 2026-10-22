// Bible (a Plugin Store add-on): a verse for each day, look up any passage (King James Version),
// and keep the verses that matter to you.
import { useState, type FormEvent } from "react";
import { BookMarked, Bookmark, Copy, RefreshCw, Search, Trash2 } from "lucide-react";
import { VERSES, forDay, type Passage } from "@shared/lifePlugins";
import { useLifeFeed } from "./useLifeFeed";
import { Empty, PageHead, Panel, danger, inputClass, plain, primary, soft, type SectionProps } from "./ui";

const QUICK = ["Psalm 23", "John 1:1-14", "Romans 8:28-39", "1 Corinthians 13", "Matthew 5:1-12", "Proverbs 3:1-12"];

export default function Bible({ family, setFamily, today, makeId, say }: SectionProps) {
  const verse = forDay(VERSES, today);
  const [draft, setDraft] = useState("");
  const [ref, setRef] = useState("");
  const passage = useLifeFeed<Passage>(ref ? `/api/lifehub/bible?ref=${encodeURIComponent(ref)}` : null);
  const isSaved = (reference: string) => family.savedVerses.some((v) => v.reference.toLowerCase() === reference.toLowerCase());
  const save = (reference: string, text: string) => {
    if (isSaved(reference)) { say(`${reference} is already saved.`); return; }
    setFamily((f) => ({ ...f, savedVerses: [...f.savedVerses, { id: makeId(), reference, text: text.slice(0, 4000) }] }));
    say(`${reference} saved.`);
  };
  const remove = (id: string) => setFamily((f) => ({ ...f, savedVerses: f.savedVerses.filter((v) => v.id !== id) }));
  const copy = async (reference: string, text: string) => { try { await navigator.clipboard.writeText(`${text} (${reference}, KJV)`); say("Copied."); } catch { say("Couldn't copy on this device."); } };
  const look = (e: FormEvent) => { e.preventDefault(); if (draft.trim()) setRef(draft.trim()); };
  const p = passage.data;
  const passageText = p ? p.verses.map((v) => v.text).join(" ") : "";

  return <div className="space-y-6">
    <PageHead eyebrow="Bible" title="Daily word" blurb="A verse for today, any passage you want to read, and the verses you keep coming back to. King James Version." />
    <section className="rounded-[2rem] border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-7 shadow-[0_8px_28px_#17152b08] sm:p-9">
      <p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-amber-700">Verse of the day</p>
      <blockquote className="mt-3 font-serif text-2xl leading-snug text-[#2a2235] sm:text-[28px]">{verse.text}</blockquote>
      <p className="mt-3 text-sm font-black text-amber-800">{verse.reference}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => save(verse.reference, verse.text)} className={soft}><Bookmark size={15} />{isSaved(verse.reference) ? "Saved" : "Save"}</button>
        <button type="button" onClick={() => copy(verse.reference, verse.text)} className={plain}><Copy size={15} />Copy</button>
        <button type="button" onClick={() => { setDraft(verse.reference.split(":")[0]); setRef(verse.reference.split(":")[0]); }} className={plain}>Read the chapter</button>
      </div>
    </section>
    <Panel title="Read a passage">
      <form onSubmit={look} className="flex gap-2">
        <label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={60} placeholder="John 3:16, Psalm 23, Romans 8:28-39" className={inputClass + " pl-9"} aria-label="Passage" /></label>
        <button type="submit" className={primary} disabled={!draft.trim()}>Read</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-1.5">{QUICK.map((q) => <button key={q} type="button" onClick={() => { setDraft(q); setRef(q); }} className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100">{q}</button>)}</div>
      {passage.busy && <p className="mt-5 flex items-center gap-2 text-sm text-slate-500"><RefreshCw size={15} className="animate-spin" />Opening {ref}…</p>}
      {passage.error && <p className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert">{passage.error}</p>}
      {p && !passage.busy && <article className="mt-5 rounded-2xl bg-[#fbfaf6] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-black">{p.reference}</h3>
          <span className="flex gap-1.5"><button type="button" onClick={() => save(p.reference, passageText)} className={soft}><Bookmark size={15} />{isSaved(p.reference) ? "Saved" : "Save"}</button><button type="button" onClick={() => copy(p.reference, passageText)} className={plain}><Copy size={15} />Copy</button></span></div>
        <p className="mt-3 font-serif text-[17px] leading-8 text-[#2a2235]">{p.verses.map((v, i) => <span key={i}><sup className="mr-1 font-sans text-[10px] font-bold text-amber-700">{v.verse}</sup>{v.text} </span>)}</p>
        <p className="mt-3 text-xs text-slate-400">{p.translation}</p>
      </article>}
    </Panel>
    <Panel title={`Saved verses · ${family.savedVerses.length}`}>
      {family.savedVerses.length ? <ul className="space-y-3">{[...family.savedVerses].reverse().map((v) => <li key={v.id} className="rounded-2xl border border-slate-100 p-4">
        <div className="flex items-start justify-between gap-3"><p className="text-sm font-black text-amber-800">{v.reference}</p>
          <span className="flex shrink-0 gap-1"><button type="button" onClick={() => copy(v.reference, v.text)} className={plain + " px-2"} aria-label="Copy"><Copy size={14} /></button><button type="button" onClick={() => remove(v.id)} className={danger + " px-2"} aria-label={`Remove ${v.reference}`}><Trash2 size={14} /></button></span></div>
        <p className="mt-1 font-serif text-[15px] leading-7 text-[#2a2235]">{v.text}</p>
      </li>)}</ul> : <Empty icon={<BookMarked />} title="No saved verses yet.">Tap Save on a verse to keep it here.</Empty>}
    </Panel>
  </div>;
}
