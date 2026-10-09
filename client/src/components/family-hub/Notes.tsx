// Family notes: wifi passwords, school info, grocery lists, gift ideas. Pin the ones you need most.
import { useState, type FormEvent } from "react";
import { Check, Pin, PinOff, Plus, Search, StickyNote, Trash2 } from "lucide-react";
import { NOTE_COLORS, type Note } from "@shared/familyHub";
import { Empty, Modal, PageHead, Panel, confirmed, danger, inputClass, plain, primary, soft, type SectionProps } from "./ui";

const STARTERS = ["Grocery list", "Gift ideas", "School contacts", "Babysitter info", "Wi-Fi & codes", "Meal ideas"];

export default function Notes({ family, setFamily, makeId, say }: SectionProps) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Note | null>(null);
  const q = query.trim().toLowerCase();
  const notes = family.notes.filter((n) => !q || (n.title + " " + n.body).toLowerCase().includes(q))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  const blank = (title = ""): Note => ({ id: makeId(), title, body: "", color: NOTE_COLORS[family.notes.length % NOTE_COLORS.length], pinned: false, updatedAt: "" });

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.title.trim() && !editing.body.trim()) { setEditing(null); return; }
    const clean = { ...editing, title: editing.title.slice(0, 120), body: editing.body.slice(0, 5000), updatedAt: new Date().toISOString() };
    setFamily((f) => ({ ...f, notes: f.notes.some((n) => n.id === clean.id) ? f.notes.map((n) => (n.id === clean.id ? clean : n)) : [clean, ...f.notes].slice(0, 1000) }));
    setEditing(null);
    say("Note saved");
  };
  const pin = (n: Note) => setFamily((f) => ({ ...f, notes: f.notes.map((x) => (x.id === n.id ? { ...x, pinned: !x.pinned } : x)) }));

  return <div className="space-y-6">
    <PageHead eyebrow="Notes" title="Family notes" blurb="Everything you keep needing to look up: codes, contacts, lists and ideas. Pinned notes also show on Home."
      action={<button onClick={() => setEditing(blank())} className={primary + " min-h-11 px-5"}><Plus size={18} /> New note</button>} />
    {family.notes.length > 0 && <div className="relative max-w-md"><Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" aria-label="Search notes" className={inputClass + " pl-10"} /></div>}
    {notes.length ? <div className="columns-1 gap-4 sm:columns-2 xl:columns-3 [&>*]:mb-4">
      {notes.map((n) => <article key={n.id} className="note-card group break-inside-avoid rounded-2xl border border-black/5 p-4 shadow-[0_3px_16px_#17152b0a]" style={{ background: n.color }}>
        <div className="flex items-start gap-2">
          <button onClick={() => setEditing({ ...n })} className="min-w-0 flex-1 text-left">
            {n.title && <h3 className="break-words text-base font-black text-slate-800">{n.title}</h3>}
            {n.body && <p className="mt-1.5 line-clamp-[12] whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{n.body}</p>}
          </button>
          <button onClick={() => pin(n)} aria-pressed={n.pinned} aria-label={n.pinned ? `Unpin ${n.title || "note"}` : `Pin ${n.title || "note"}`} className={`rounded-lg p-1.5 transition ${n.pinned ? "text-violet-700" : "text-slate-400 opacity-60 hover:opacity-100"}`}>{n.pinned ? <Pin size={16} className="fill-current" /> : <Pin size={16} />}</button>
        </div>
      </article>)}
    </div> : family.notes.length ? <p className="text-sm text-slate-500">No notes match “{query}”.</p>
      : <Panel><Empty icon={<StickyNote size={26} />} title="No notes yet" action={<div className="flex flex-wrap justify-center gap-2">{STARTERS.map((s) => <button key={s} onClick={() => setEditing(blank(s))} className={soft + " min-h-9 text-xs"}>{s}</button>)}</div>}>Start with one of these, or tap “New note”.</Empty></Panel>}

    {editing && <Modal title={family.notes.some((n) => n.id === editing.id) ? "Edit note" : "New note"} onClose={() => setEditing(null)} wide>
      <form onSubmit={save} className="space-y-4">
        <input autoFocus maxLength={120} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Title" aria-label="Title" className={inputClass + " text-base font-bold"} />
        <textarea rows={10} maxLength={5000} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} placeholder="Write anything…" aria-label="Note" className={inputClass + " note-card py-3 leading-6"} style={{ background: editing.color }} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Color</span>
          {NOTE_COLORS.map((c) => <button key={c} type="button" onClick={() => setEditing({ ...editing, color: c })} aria-pressed={editing.color === c} aria-label={`Color ${c}`} className={`h-8 w-8 rounded-full border-2 ${editing.color === c ? "border-violet-500" : "border-slate-200"}`} style={{ background: c }} />)}
          <button type="button" onClick={() => setEditing({ ...editing, pinned: !editing.pinned })} aria-pressed={editing.pinned} className={plain + " ml-auto min-h-9"}>{editing.pinned ? <><PinOff size={15} /> Unpin</> : <><Pin size={15} /> Pin to Home</>}</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button type="submit" className={primary + " flex-1 px-5"}><Check size={17} /> Save note</button>
          <button type="button" onClick={() => setEditing(null)} className={plain}>Cancel</button>
          {family.notes.some((n) => n.id === editing.id) && <button type="button" onClick={() => { if (confirmed("Delete this note?")) { setFamily((f) => ({ ...f, notes: f.notes.filter((n) => n.id !== editing.id) })); setEditing(null); say("Note deleted"); } }} className={danger} aria-label="Delete note"><Trash2 size={17} /></button>}
        </div>
      </form>
    </Modal>}
  </div>;
}
