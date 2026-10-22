// Family notes: wifi passwords, school info, grocery lists, gift ideas. Pin the ones you need most.
import { useEffect, useState } from "react";
import { Pin, Plus, Search, StickyNote } from "lucide-react";
import { NOTE_COLORS, type Note } from "@shared/familyHub";
import { NoteTemplatesButton } from "@/components/NoteTemplatePicker";
import { useStayOnRefresh } from "@/lib/useStayOnRefresh";
import FullNoteEditor from "@/components/notes/FullNoteEditor";
import { LockBadge, useLock } from "@/components/lock/PrivacyLock";
import { Empty, PageHead, Panel, confirmed, inputClass, primary, soft, type SectionProps } from "./ui";

const STARTERS = ["Grocery list", "Gift ideas", "School contacts", "Babysitter info", "Wi-Fi & codes", "Meal ideas"];

export default function Notes({ family, setFamily, makeId, say }: SectionProps) {
  const [query, setQuery] = useState("");
  // Refreshing keeps the open one open (a locked one waits for the passcode again).
  const [openId, setOpenId] = useStayOnRefresh<string | null>("life-note", null);
  const [editing, setEditing] = useState<Note | null>(() => { const n = openId ? family.notes.find((x) => x.id === openId) : undefined; return n && !n.locked ? { ...n } : null; });
  useEffect(() => { setOpenId(editing?.id ?? null); }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const lock = useLock();
  /** A locked note shows only its title until the passcode is entered. */
  const hidden = (n: Note) => !!n.locked && !!lock && !lock.unlocked;
  const open = async (n: Note) => { if (!hidden(n) || (lock && (await lock.ask(`Unlock “${n.title || "note"}”`)))) setEditing({ ...n }); };
  const q = query.trim().toLowerCase();
  const notes = family.notes.filter((n) => !q || (n.title + " " + (hidden(n) ? "" : n.body)).toLowerCase().includes(q))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  const blank = (title = ""): Note => ({ id: makeId(), title, body: "", color: NOTE_COLORS[family.notes.length % NOTE_COLORS.length], pinned: false, updatedAt: "" });

  /** Saves as you type (the editor calls this). A note with nothing in it is never kept. */
  const upsert = (note: Note) => {
    if (!note.title.trim() && !note.body.trim()) return;
    const clean = { ...note, title: note.title.slice(0, 120), body: note.body.slice(0, 5000), updatedAt: new Date().toISOString() };
    setFamily((f) => ({ ...f, notes: f.notes.some((n) => n.id === clean.id) ? f.notes.map((n) => (n.id === clean.id ? clean : n)) : [clean, ...f.notes].slice(0, 1000) }));
  };
  const pin = (n: Note) => setFamily((f) => ({ ...f, notes: f.notes.map((x) => (x.id === n.id ? { ...x, pinned: !x.pinned } : x)) }));

  return <div className="space-y-6">
    <PageHead eyebrow="Notes" title="Family notes" blurb="Everything you keep needing to look up: codes, contacts, lists and ideas. Pinned notes also show on Home."
      action={<div className="flex flex-wrap gap-2"><NoteTemplatesButton hub="life" onPick={(t) => setEditing({ ...blank(t.title), body: t.body })} /><button onClick={() => setEditing(blank())} className={primary + " min-h-11 px-5"}><Plus size={18} /> New note</button></div>} />
    {family.notes.length > 0 && <div className="relative max-w-md"><Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" aria-label="Search notes" className={inputClass + " pl-10"} /></div>}
    {notes.length ? <div className="columns-1 gap-4 sm:columns-2 xl:columns-3 [&>*]:mb-4">
      {notes.map((n) => <article key={n.id} className="note-card group break-inside-avoid rounded-2xl border border-black/5 p-4 shadow-[0_3px_16px_#17152b0a]" style={{ background: n.color }}>
        <div className="flex items-start gap-2">
          <button onClick={() => void open(n)} className="min-w-0 flex-1 text-left" data-locked={n.locked ? "" : undefined}>
            {(n.title || n.locked) && <h3 className="flex items-center gap-1.5 break-words text-base font-black text-slate-800">{n.locked && <LockBadge className="h-4 w-4 text-slate-500" />}{n.title || "Locked note"}</h3>}
            {hidden(n) ? <p className="mt-1.5 text-sm text-slate-500">Locked</p> : n.body && <p className="mt-1.5 line-clamp-[12] whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{n.body}</p>}
          </button>
          <button onClick={() => pin(n)} aria-pressed={n.pinned} aria-label={n.pinned ? `Unpin ${n.title || "note"}` : `Pin ${n.title || "note"}`} className={`rounded-lg p-1.5 transition ${n.pinned ? "text-violet-700" : "text-slate-400 opacity-60 hover:opacity-100"}`}>{n.pinned ? <Pin size={16} className="fill-current" /> : <Pin size={16} />}</button>
        </div>
      </article>)}
    </div> : family.notes.length ? <p className="text-sm text-slate-500">No notes match “{query}”.</p>
      : <Panel><Empty icon={<StickyNote size={26} />} title="No notes yet" action={<div className="flex flex-col items-center gap-3"><div className="flex flex-wrap justify-center gap-2">{STARTERS.map((s) => <button key={s} onClick={() => setEditing(blank(s))} className={soft + " min-h-9 text-xs"}>{s}</button>)}</div><NoteTemplatesButton hub="life" onPick={(t) => setEditing({ ...blank(t.title), body: t.body })} /></div>}>Start with one of these, a template for almost anything, or tap “New note”.</Empty></Panel>}

    {editing && <FullNoteEditor note={editing} colors={NOTE_COLORS} pinLabel="Pin to Home" onSave={upsert} onClose={() => setEditing(null)}
      onDelete={family.notes.some((n) => n.id === editing.id) ? () => { if (confirmed("Delete this note?")) { setFamily((f) => ({ ...f, notes: f.notes.filter((n) => n.id !== editing.id) })); setEditing(null); say("Note deleted"); } } : undefined} />}
  </div>;
}
