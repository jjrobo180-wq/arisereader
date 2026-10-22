// Journal (a Plugin Store add-on): a daily journal with a prompt for each day. Saved to the account.
import { useMemo, useState } from "react";
import { NotebookPen, Pencil, Search, Trash2 } from "lucide-react";
import { JOURNAL_MOODS, JOURNAL_PROMPTS, forDay } from "@shared/lifePlugins";
import type { JournalEntry } from "@shared/familyHub";
import { Empty, PageHead, Panel, danger, inputClass, plain, primary, type SectionProps } from "./ui";

const longDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

export default function Journal({ family, setFamily, today, makeId, say }: SectionProps) {
  const prompt = forDay(JOURNAL_PROMPTS, today);
  const blank = (): JournalEntry => ({ id: "", date: today, title: "", body: "", mood: "", createdAt: "" });
  const [draft, setDraft] = useState<JournalEntry>(blank);
  const [query, setQuery] = useState("");
  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...family.journal].filter((e) => !q || `${e.title} ${e.body}`.toLowerCase().includes(q)).sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  }, [family.journal, query]);

  const save = () => {
    if (!draft.body.trim() && !draft.title.trim()) return;
    const row = { ...draft, id: draft.id || makeId(), createdAt: draft.createdAt || new Date().toISOString() };
    setFamily((f) => ({ ...f, journal: draft.id ? f.journal.map((e) => (e.id === draft.id ? row : e)) : [...f.journal, row] }));
    say(draft.id ? "Entry updated." : "Saved to your journal.");
    setDraft(blank());
  };
  const remove = (e: JournalEntry) => {
    if (!window.confirm("Delete this journal entry? This can't be undone.")) return;
    setFamily((f) => ({ ...f, journal: f.journal.filter((x) => x.id !== e.id) }));
    if (draft.id === e.id) setDraft(blank());
  };

  return <div className="space-y-6">
    <PageHead eyebrow="Journal" title="Write it down" blurb="A few lines a day. Saved to your account, so anyone signed in to it can read it." />
    <Panel title={draft.id ? "Edit entry" : "Today's entry"} right={<input type="date" value={draft.date} max={today} onChange={(e) => setDraft({ ...draft, date: e.target.value || today })} className={inputClass + " w-auto"} aria-label="Entry date" />}>
      {!draft.id && <button type="button" onClick={() => setDraft({ ...draft, title: draft.title || prompt })} className="mb-3 w-full rounded-2xl bg-violet-50 p-4 text-left text-sm text-violet-900 hover:bg-violet-100">
        <span className="block text-[11px] font-extrabold uppercase tracking-[.15em] text-violet-600">Today's prompt</span>{prompt}
      </button>}
      <div className="space-y-3">
        <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={120} placeholder="Title (optional)" className={inputClass} aria-label="Title" />
        <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} maxLength={20000} rows={8} placeholder="What's on your mind?" className={inputClass + " min-h-40 py-3 leading-6"} aria-label="Journal entry" />
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Mood">
          <span className="mr-1 text-xs font-bold text-slate-500">Mood</span>
          {JOURNAL_MOODS.map((m) => <button key={m} type="button" onClick={() => setDraft({ ...draft, mood: draft.mood === m ? "" : m })} aria-pressed={draft.mood === m} className={`h-10 w-10 rounded-xl text-xl transition ${draft.mood === m ? "bg-violet-100 ring-2 ring-violet-400" : "hover:bg-slate-100"}`}>{m}</button>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={save} disabled={!draft.body.trim() && !draft.title.trim()} className={primary}>{draft.id ? "Save changes" : "Save entry"}</button>
          {(draft.id || draft.body) && <button type="button" onClick={() => setDraft(blank())} className={plain}>Cancel</button>}
        </div>
      </div>
    </Panel>
    <Panel title={`Past entries · ${family.journal.length}`} right={<label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className={inputClass + " w-44 pl-9"} aria-label="Search the journal" /></label>}>
      {entries.length ? <ul className="space-y-3">{entries.map((e) => <li key={e.id} className="rounded-2xl border border-slate-100 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-xs font-bold text-slate-400">{longDay(e.date)} {e.mood}</p>{e.title && <p className="mt-1 font-extrabold text-[#232139]">{e.title}</p>}</div>
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={() => { setDraft(e); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={plain + " px-2"} aria-label="Edit entry"><Pencil size={15} /></button>
            <button type="button" onClick={() => remove(e)} className={danger + " px-2"} aria-label="Delete entry"><Trash2 size={15} /></button>
          </div>
        </div>
        {e.body && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{e.body}</p>}
      </li>)}</ul> : <Empty icon={<NotebookPen />} title={query ? "No entries match." : "No entries yet."}>{query ? "Try another word." : "Your first entry will show up here."}</Empty>}
    </Panel>
  </div>;
}
