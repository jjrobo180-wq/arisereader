// Dictionary (a Plugin Store add-on): look up any English word, hear it said, learn a word a day,
// and keep a list of words you like.
import { useState, type FormEvent } from "react";
import { BookOpen, Bookmark, RefreshCw, Search, Trash2, Volume2 } from "lucide-react";
import { WORDS, forDay, type Definition } from "@shared/lifePlugins";
import { useLifeFeed } from "./useLifeFeed";
import { Empty, PageHead, Panel, danger, inputClass, plain, primary, soft, type SectionProps } from "./ui";

export default function Dictionary({ family, setFamily, today, makeId, say }: SectionProps) {
  const wotd = forDay(WORDS, today);
  const [draft, setDraft] = useState("");
  const [word, setWord] = useState("");
  const entry = useLifeFeed<Definition>(word ? `/api/lifehub/define?word=${encodeURIComponent(word)}` : null);
  const saved = (w: string) => family.savedWords.some((x) => x.word.toLowerCase() === w.toLowerCase());
  const save = (w: string, definition: string) => {
    if (saved(w)) { say(`“${w}” is already saved.`); return; }
    setFamily((f) => ({ ...f, savedWords: [...f.savedWords, { id: makeId(), word: w, definition: definition.slice(0, 500) }] }));
    say(`Saved “${w}”.`);
  };
  const look = (w: string) => { const clean = w.trim(); if (clean) { setDraft(clean); setWord(clean.toLowerCase()); } };
  const play = (url: string) => { try { void new Audio(url).play(); } catch { say("Can't play sound here."); } };
  const d = entry.data;

  return <div className="space-y-6">
    <PageHead eyebrow="Dictionary" title="Look it up" blurb="Definitions, pronunciation and examples for any English word, plus a new word every day." />
    <Panel>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); look(draft); }} className="flex gap-2">
        <label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={40} placeholder="Type a word" className={inputClass + " min-h-12 pl-9 text-base"} aria-label="Word to look up" autoCapitalize="none" /></label>
        <button type="submit" className={primary} disabled={!draft.trim()}>Define</button>
      </form>
      {entry.busy && <p className="mt-5 flex items-center gap-2 text-sm text-slate-500"><RefreshCw size={15} className="animate-spin" />Looking up “{word}”…</p>}
      {entry.error && <p className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert">{entry.error}</p>}
      {d && !entry.busy && <article className="mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-4xl font-black tracking-tight text-[#232139]">{d.word}</h2>
          {d.phonetic && <span className="text-lg text-slate-500">{d.phonetic}</span>}
          {d.audio && <button type="button" onClick={() => play(d.audio)} className={soft + " px-2.5"} aria-label="Hear it"><Volume2 size={17} /></button>}
          <button type="button" onClick={() => save(d.word, d.meanings[0]?.definitions[0]?.definition || "")} className={plain}><Bookmark size={15} />{saved(d.word) ? "Saved" : "Save"}</button>
        </div>
        <div className="mt-4 space-y-5">{d.meanings.map((m, i) => <section key={i}>
          <p className="text-sm font-black italic text-violet-700">{m.partOfSpeech}</p>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">{m.definitions.map((def, j) => <li key={j}>{def.definition}{def.example && <span className="block text-slate-500">“{def.example}”</span>}</li>)}</ol>
          {m.synonyms.length > 0 && <p className="mt-2 text-xs text-slate-500">Similar: {m.synonyms.map((s, k) => <span key={s}>{k > 0 && ", "}<button type="button" onClick={() => look(s)} className="font-bold text-violet-700 hover:underline">{s}</button></span>)}</p>}
        </section>)}</div>
      </article>}
    </Panel>
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-[1.5rem] bg-gradient-to-br from-[#2d2555] to-[#6d5ce7] p-6 text-white shadow-[0_18px_40px_#4b3fa033]">
        <p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-violet-200">Word of the day</p>
        <p className="mt-2 text-3xl font-black tracking-tight">{wotd.word} <span className="text-sm font-bold italic text-violet-200">{wotd.type}</span></p>
        <p className="mt-2 leading-6">{wotd.definition}</p>
        <p className="mt-2 text-sm italic text-violet-200">“{wotd.example}”</p>
        <div className="mt-4 flex gap-2"><button type="button" onClick={() => look(wotd.word)} className="inline-flex min-h-10 items-center rounded-xl bg-white/15 px-3 text-sm font-semibold hover:bg-white/25">Full entry</button><button type="button" onClick={() => save(wotd.word, wotd.definition)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/15 px-3 text-sm font-semibold hover:bg-white/25"><Bookmark size={15} />{saved(wotd.word) ? "Saved" : "Save"}</button></div>
      </section>
      <Panel title={`My words · ${family.savedWords.length}`}>
        {family.savedWords.length ? <ul className="divide-y divide-slate-100">{[...family.savedWords].reverse().map((w) => <li key={w.id} className="flex items-start gap-3 py-2.5">
          <button type="button" onClick={() => look(w.word)} className="min-w-0 flex-1 text-left"><span className="block font-extrabold text-[#232139]">{w.word}</span>{w.definition && <span className="line-clamp-2 block text-xs text-slate-500">{w.definition}</span>}</button>
          <button type="button" onClick={() => setFamily((f) => ({ ...f, savedWords: f.savedWords.filter((x) => x.id !== w.id) }))} className={danger + " px-2"} aria-label={`Remove ${w.word}`}><Trash2 size={14} /></button>
        </li>)}</ul> : <Empty icon={<BookOpen />} title="No saved words yet.">Save words you want to remember.</Empty>}
      </Panel>
    </div>
  </div>;
}
