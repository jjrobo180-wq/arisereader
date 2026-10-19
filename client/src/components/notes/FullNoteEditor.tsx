// The full-screen note editor: opens over the whole screen like the Notes app on a phone, with the
// formatting tools of Arise Docs (useRichEditor). Used by LifeHub Notes and the Notes App Store
// installs (NotesKitApp).
//
// It saves by itself a moment after you stop typing (onSave), and again when you tap Done. The
// formatted note goes in `html`; `body` is always the plain text (shared/richNote.ts).
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Pin, Trash2 } from "lucide-react";
import { DropButton } from "@/components/office/officeUi";
import { sanitizeHtml, wordCount } from "@shared/office/docModel";
import { cleanNoteHtml, noteStartHtml, noteTextOf } from "@shared/richNote";
import type { Note } from "@shared/familyHub";
import { useRichEditor } from "./useRichEditor";

export type FullNoteEditorProps = {
  note: Note;
  /** The note colours to pick from. */
  colors: readonly string[];
  /** Called a moment after each change and on Done, with the whole note. Empty notes are the caller's to skip. */
  onSave: (note: Note) => void;
  onClose: () => void;
  /** Shown as Delete when the note is already saved. */
  onDelete?: () => void;
  pinLabel?: string;
};

export default function FullNoteEditor({ note, colors, onSave, onClose, onDelete, pinLabel = "Pin to Home" }: FullNoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [color, setColor] = useState(note.color);
  const [pinned, setPinned] = useState(note.pinned);
  const [words, setWords] = useState(0);
  const [status, setStatus] = useState<"saved" | "saving" | "">("");
  const latest = useRef({ title, color, pinned, html: "" });
  latest.current = { ...latest.current, title, color, pinned };

  const current = useCallback((): Note => {
    const raw = latest.current.html;
    const html = cleanNoteHtml(raw);
    const body = noteTextOf(sanitizeHtml(raw));
    const { title: t, color: c, pinned: p } = latest.current;
    const { html: _old, ...rest } = note;
    return { ...rest, title: t.slice(0, 120), body, color: c, pinned: p, ...(html ? { html } : {}) };
  }, [note]);

  const timer = useRef<number | null>(null);
  // The latest save and read functions, so a pending save never uses an old one.
  const saveRef = useRef(onSave); saveRef.current = onSave;
  const currentRef = useRef(current); currentRef.current = current;
  const flush = useCallback(() => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    saveRef.current(currentRef.current());
    setStatus("saved");
  }, []);
  const schedule = () => {
    setStatus("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 700);
  };
  const opened = useRef(false);
  const editor = useRichEditor({
    startHtml: noteStartHtml(note), resetKey: note.id, onSaveKey: flush, testId: "full-note", label: "Note",
    toolbarClassName: "border-b border-black/5 bg-white/85 sm:justify-center", pageClassName: "min-h-[50vh]",
    onChange: (html) => {
      latest.current.html = html;
      setWords(wordCount(html).words);
      if (opened.current) schedule(); else opened.current = true; // filling the page on open isn't a change
    },
  });

  // Title, colour and pin changes save the same way as typing.
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } schedule(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, color, pinned]);
  useEffect(() => { if (!note.title && !note.body) window.setTimeout(() => document.getElementById("full-note-title")?.focus(), 30); }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Behind the editor nothing scrolls.
  useEffect(() => { const old = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = old; }; }, []);
  const done = () => { flush(); onClose(); };
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector("[data-office-float]")) { e.preventDefault(); done(); } };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  });
  // Leaving the page another way still keeps what was typed.
  useEffect(() => () => { if (timer.current) { window.clearTimeout(timer.current); timer.current = null; saveRef.current(currentRef.current()); } }, []);

  const edited = note.updatedAt ? new Date(note.updatedAt) : null;

  return createPortal(
    <div className="fixed inset-0 z-[700] flex flex-col" style={{ background: color }} role="dialog" aria-modal="true" aria-label={title || "Note"} data-testid="full-note">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-black/5 bg-white/70 px-2 pb-2 backdrop-blur sm:px-4" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <button type="button" onClick={done} className="inline-flex min-h-11 items-center gap-0.5 rounded-xl pl-1 pr-3 text-[15px] font-bold text-violet-700 hover:bg-violet-50" data-testid="full-note-done"><ChevronLeft size={22} /> Notes</button>
        <span className="min-w-0 flex-1 truncate text-center text-xs font-semibold text-slate-500" aria-live="polite">{status === "saving" ? "Saving…" : status === "saved" ? "Saved" : edited ? `Edited ${edited.toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}</span>
        <button type="button" onClick={() => setPinned((p) => !p)} aria-pressed={pinned} title={pinned ? "Unpin" : pinLabel} aria-label={pinned ? "Unpin" : pinLabel} className={`inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-black/5 ${pinned ? "text-violet-700" : "text-slate-500"}`}><Pin size={18} className={pinned ? "fill-current" : ""} /></button>
        <DropButton title="Note color" label={<span className="h-5 w-5 rounded-full border border-black/15" style={{ background: color }} />} className="h-11 px-2">
          {(close) => <div className="flex flex-wrap gap-2 p-3" style={{ width: 200 }}>{colors.map((c) => <button key={c} type="button" onClick={() => { setColor(c); close(); }} aria-label={`Color ${c}`} aria-pressed={color === c} className={`h-8 w-8 rounded-full border-2 ${color === c ? "border-violet-500" : "border-slate-200"}`} style={{ background: c }} />)}</div>}
        </DropButton>
        {onDelete && <button type="button" onClick={() => { if (timer.current) window.clearTimeout(timer.current); timer.current = null; onDelete(); }} title="Delete note" aria-label="Delete note" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-rose-600 hover:bg-rose-50"><Trash2 size={18} /></button>}
        <button type="button" onClick={done} className="hidden min-h-11 rounded-xl bg-[#6e5ae0] px-4 text-sm font-bold text-white hover:bg-[#5948c8] sm:inline-flex sm:items-center">Done</button>
      </div>
      {editor.toolbar}
      {/* The note */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" onClick={(e) => { if (e.target === e.currentTarget) editor.focus(); }}>
        <div className="mx-auto w-full max-w-3xl px-5 pb-[40vh] pt-6 sm:px-10 sm:pt-10">
          <input id="full-note-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Title" aria-label="Title"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); editor.focus(); } }}
            className="w-full border-0 bg-transparent p-0 text-[28px] font-black leading-tight text-slate-900 outline-none placeholder:text-slate-400 sm:text-[34px]" data-testid="full-note-title" />
          <p className="mb-5 mt-1 text-xs font-medium text-slate-500">{words} {words === 1 ? "word" : "words"}</p>
          {editor.page}
        </div>
      </div>
    </div>,
    document.body,
  );
}
