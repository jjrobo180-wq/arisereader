// The Notes app offered through the App Store: the same simple pinnable note-card feature LifeHub's
// Notes has always had, now installable as its own app into either hub. Each install keeps its own
// separate notes — installing it into WorkHub never shares or syncs with LifeHub's notes, or the
// other way around. Used by LifeHub Notes (installed into WorkHub) and Work Notes (installed into
// LifeHub). The records are passed in and saved by the hub, the same way Plugin Kit apps work.
import { useEffect, useState } from "react";
import { Pin, Plus, Search, StickyNote } from "lucide-react";
import { NOTE_COLORS, saveNotesAppNote, type Note } from "@shared/notesApp";
import { NoteTemplatesButton } from "@/components/NoteTemplatePicker";
import { useStayOnRefresh } from "@/lib/useStayOnRefresh";
import FullNoteEditor from "@/components/notes/FullNoteEditor";
import { LockBadge, useLock } from "@/components/lock/PrivacyLock";
import { Empty, PageHead, Panel, confirmed, inputClass, primary, soft } from "@/components/family-hub/ui";

const STARTERS = ["Grocery list", "Gift ideas", "Wi-Fi & codes", "Ideas", "Meeting notes", "To remember"];

export type NotesKitAppProps = {
  /** What the App Store calls this install ("LifeHub Notes" in WorkHub, "Work Notes" in LifeHub). */
  name: string;
  blurb: string;
  notes: Note[];
  setNotes: (update: (all: Note[]) => Note[]) => void;
  makeId: () => string;
  say: (message: string) => void;
};

export default function NotesKitApp({ name, blurb, notes, setNotes, makeId, say }: NotesKitAppProps) {
  const [query, setQuery] = useState("");
  // Refreshing keeps the open one open (a locked one waits for the passcode again).
  const [openId, setOpenId] = useStayOnRefresh<string | null>(`kit-note-${name}`, null);
  const [editing, setEditing] = useState<Note | null>(() => { const n = openId ? notes.find((x) => x.id === openId) : undefined; return n && !n.locked ? { ...n } : null; });
  useEffect(() => { setOpenId(editing?.id ?? null); }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const lock = useLock();
  /** A locked note shows only its title until the passcode is entered. */
  const hidden = (n: Note) => !!n.locked && !!lock && !lock.unlocked;
  const open = async (n: Note) => { if (!hidden(n) || (lock && (await lock.ask(`Unlock “${n.title || "note"}”`)))) setEditing({ ...n }); };
  const q = query.trim().toLowerCase();
  const shown = notes.filter((n) => !q || (n.title + " " + (hidden(n) ? "" : n.body)).toLowerCase().includes(q))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  const blank = (title = ""): Note => ({ id: makeId(), title, body: "", color: NOTE_COLORS[notes.length % NOTE_COLORS.length], pinned: false, updatedAt: "" });

  /** Saves as you type (the editor calls this). A note with nothing in it is never kept. */
  const upsert = (note: Note) => {
    if (!note.title.trim() && !note.body.trim()) return;
    setNotes((all) => saveNotesAppNote(all, note));
  };
  const pin = (n: Note) => setNotes((all) => all.map((x) => (x.id === n.id ? { ...x, pinned: !x.pinned } : x)));

  return <div className="space-y-6" data-kit-view>
    <PageHead eyebrow="Notes" title={name} blurb={blurb}
      action={<div className="flex flex-wrap gap-2"><NoteTemplatesButton onPick={(t) => setEditing({ ...blank(t.title), body: t.body })} /><button onClick={() => setEditing(blank())} className={primary + " min-h-11 px-5"}><Plus size={18} /> New note</button></div>} />
    {notes.length > 0 && <div className="relative max-w-md"><Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" aria-label="Search notes" className={inputClass + " pl-10"} /></div>}
    {shown.length ? <div className="columns-1 gap-4 sm:columns-2 xl:columns-3 [&>*]:mb-4">
      {shown.map((n) => <article key={n.id} className="note-card group break-inside-avoid rounded-2xl border border-black/5 p-4 shadow-[0_3px_16px_#17152b0a]" style={{ background: n.color }}>
        <div className="flex items-start gap-2">
          <button onClick={() => void open(n)} className="min-w-0 flex-1 text-left" data-locked={n.locked ? "" : undefined}>
            {(n.title || n.locked) && <h3 className="flex items-center gap-1.5 break-words text-base font-black text-slate-800">{n.locked && <LockBadge className="h-4 w-4 text-slate-500" />}{n.title || "Locked note"}</h3>}
            {hidden(n) ? <p className="mt-1.5 text-sm text-slate-500">Locked</p> : n.body && <p className="mt-1.5 line-clamp-[12] whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{n.body}</p>}
          </button>
          <button onClick={() => pin(n)} aria-pressed={n.pinned} aria-label={n.pinned ? `Unpin ${n.title || "note"}` : `Pin ${n.title || "note"}`} className={`rounded-lg p-1.5 transition ${n.pinned ? "text-violet-700" : "text-slate-400 opacity-60 hover:opacity-100"}`}>{n.pinned ? <Pin size={16} className="fill-current" /> : <Pin size={16} />}</button>
        </div>
      </article>)}
    </div> : notes.length ? <p className="text-sm text-slate-500">No notes match “{query}”.</p>
      : <Panel><Empty icon={<StickyNote size={26} />} title="No notes yet" action={<div className="flex flex-col items-center gap-3"><div className="flex flex-wrap justify-center gap-2">{STARTERS.map((s) => <button key={s} onClick={() => setEditing(blank(s))} className={soft + " min-h-9 text-xs"}>{s}</button>)}</div><NoteTemplatesButton onPick={(t) => setEditing({ ...blank(t.title), body: t.body })} /></div>}>Start with one of these, a template for almost anything, or tap “New note”.</Empty></Panel>}

    {editing && <FullNoteEditor note={editing} colors={NOTE_COLORS} pinLabel="Pin" onSave={upsert} onClose={() => setEditing(null)}
      onDelete={notes.some((n) => n.id === editing.id) ? () => { if (confirmed("Delete this note?")) { setNotes((all) => all.filter((n) => n.id !== editing.id)); setEditing(null); say("Note deleted"); } } : undefined} />}
  </div>;
}
