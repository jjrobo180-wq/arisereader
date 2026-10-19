// Arise WorkHub: the Notes tab. A note is about a student (a check-in, a concern) or it is not about
// any one student (a staff meeting, a team meeting, a training). Notes can be searched and changed.
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Check, Lock, LockOpen, Pencil, Pin, PinOff, Plus, Search, Trash2, User, Users } from "lucide-react";
import { useLock } from "@/components/lock/PrivacyLock";
import { useSavedChoice } from "@/lib/useSavedChoice";
import { GENERAL_NOTE_KINDS, STUDENT_NOTE_KINDS, NOTE_TITLE_MAX, arrangeNotes, cleanNote, noteCounts, noteFields, noteHeading, noteScope, noteStudents, pinNote, saveNote, NOTE_CARD_COLORS, type NoteFields, type NoteFilter, type NoteScope } from "@shared/hubNotes";
import type { NoteItem, Workspace } from "@shared/teacherHub";
import { Card, Empty, Field, Labeled, PrimaryButton, Select } from "./ui";
import { localDay } from "./HubImport";
import { HubModal } from "./HubModal";
import { NoteTemplatesButton, type PickedTemplate } from "@/components/NoteTemplatePicker";
import { useRichEditor } from "@/components/notes/useRichEditor";
import { cleanNoteHtml, noteStartHtml, noteTextOf } from "@shared/richNote";
import { sanitizeHtml } from "@shared/office/docModel";

type SetWorkspace = Dispatch<SetStateAction<Workspace>>;
const SCOPES = [["student", "About a student", User], ["general", "Meeting or general", Users]] as const;
const blank = (scope: NoteScope, student = ""): NoteFields => ({ scope, student, type: scope === "student" ? "Check-in" : "Staff meeting", title: "", date: localDay(), body: "" });
/** Templates about one student start as a note about a student; the rest as a meeting or general note. */
const STUDENT_TEMPLATES: Record<string, NoteFields["type"]> = { "student-checkin": "Check-in", "iep-meeting": "Meeting note", "parent-conference": "Meeting note" };
const GENERAL_TYPE: Record<string, NoteFields["type"]> = { plc: "Team meeting", observation: "General note", "sub-plans": "General note", lesson: "General note" };
function fromTemplate(t: PickedTemplate, student = ""): NoteFields {
  const id = t.template.id;
  const studentType = STUDENT_TEMPLATES[id];
  const base = blank(studentType ? "student" : "general", studentType ? student : "");
  return { ...base, type: studentType ?? GENERAL_TYPE[id] ?? (t.template.category === "Meetings" ? "Team meeting" : "General note"), title: t.title.slice(0, NOTE_TITLE_MAX), body: t.body };
}

/** The note itself, with fonts and formatting like Arise Docs. Saves the formatted HTML and the plain text. */
function RichNoteBox({ form, setForm, placeholder }: { form: NoteFields; setForm: (next: NoteFields) => void; placeholder: string }) {
  const editor = useRichEditor({
    startHtml: noteStartHtml({ html: form.html, body: form.body }), resetKey: "note", placeholder, testId: "hub-note", label: "Note",
    toolbarClassName: "rounded-t-2xl border border-b-0 border-slate-200 bg-slate-50", pageClassName: "min-h-[45vh] px-4 py-3 sm:min-h-[50vh]",
    onChange: (html) => setForm({ ...form, html: cleanNoteHtml(html), body: noteTextOf(sanitizeHtml(html)) }),
  });
  return <div data-testid="note-body">{editor.toolbar}<div className="rounded-b-2xl border border-slate-200" style={{ background: form.color || "#ffffff" }} onClick={(e) => { if (e.target === e.currentTarget) editor.focus(); }}>{editor.page}</div></div>;
}

/** The boxes for a note. Which ones show depends on whether it is about a student. */
function NoteBoxes({ form, setForm, students, lockStudent = false }: { form: NoteFields; setForm: (next: NoteFields) => void; students: string[]; lockStudent?: boolean }) {
  const general = form.scope === "general";
  const switchTo = (scope: NoteScope) => setForm({ ...form, scope, type: scope === "student" ? "Check-in" : "Staff meeting" });
  // A student who has since left the caseload still has to show, or their note could not be saved again.
  const names = form.student && !students.includes(form.student) ? [form.student, ...students] : students;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {!lockStudent && (
        <div role="tablist" aria-label="What the note is about" className="flex gap-1 rounded-2xl bg-slate-100 p-1 sm:col-span-2" data-testid="note-scope">
          {SCOPES.map(([scope, label, Icon]) => (
            <button key={scope} type="button" role="tab" aria-selected={form.scope === scope} onClick={() => switchTo(scope)}
              className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-2 text-sm font-semibold ${form.scope === scope ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}><Icon className="h-4 w-4" /> {label}</button>
          ))}
        </div>
      )}
      {!general && !lockStudent && (
        <Labeled label="Student"><Select value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} required aria-label="Student"><option value="">Choose student</option>{names.map((n) => <option key={n} value={n}>{n}</option>)}</Select></Labeled>
      )}
      <Labeled label={general ? "What it was" : "Title (optional)"} className={general ? "sm:col-span-2" : ""}><Field value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={NOTE_TITLE_MAX} placeholder={general ? "Staff meeting, PLC, training..." : ""} aria-label="Title" /></Labeled>
      <Labeled label="Kind"><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} aria-label="Kind">{(general ? GENERAL_NOTE_KINDS : STUDENT_NOTE_KINDS).map((k) => <option key={k}>{k}</option>)}</Select></Labeled>
      <Labeled label="Date"><Field type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-label="Date" /></Labeled>
      <div className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Note</span>
        <RichNoteBox form={form} setForm={setForm} placeholder={general ? "What was said, what was decided, what you need to do..." : "Write note..."} /></div>
      {!general && !lockStudent && (
        <div className="sm:col-span-2" data-testid="note-more-students">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Also about <span className="font-normal normal-case">(optional, for a group or a meeting about several students)</span></span>
          <div className="flex flex-wrap gap-1.5">
            {students.filter((n) => n !== form.student).map((n) => { const on = (form.students || []).includes(n); return (
              <button key={n} type="button" aria-pressed={on} onClick={() => setForm({ ...form, students: on ? (form.students || []).filter((x) => x !== n) : [...(form.students || []), n] })}
                className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${on ? "border-teal-600 bg-teal-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{n}</button>
            ); })}
            {students.length <= 1 && <span className="text-xs text-slate-500">Add students to your caseload to attach more than one.</span>}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Colour</span>
        {NOTE_CARD_COLORS.map((c) => <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} aria-pressed={(form.color || "#ffffff") === c} aria-label={`Colour ${c}`} className={`h-8 w-8 rounded-full border-2 ${(form.color || "#ffffff") === c ? "border-teal-600" : "border-slate-200"}`} style={{ background: c }} />)}
        <button type="button" onClick={() => setForm({ ...form, pinned: !form.pinned })} aria-pressed={!!form.pinned} className={`ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold ${form.pinned ? "border-violet-300 bg-violet-50 text-violet-800" : "border-slate-200 text-slate-600"}`}>{form.pinned ? <><PinOff className="h-4 w-4" /> Unpin</> : <><Pin className="h-4 w-4" /> Pin to top</>}</button>
      </div>
    </div>
  );
}

/**
 * A note, full screen, that saves itself: a moment after each change and again on Done, so there is
 * no Save button to forget. A new note is added the first time it has something worth keeping (a
 * note about a student also needs the student). With `student`, it is a note for that student only.
 */
export function NoteModal({ note, start, student, students, setWorkspace, makeId, onClose }: {
  note?: NoteItem; start?: NoteFields; student?: string; students: string[];
  setWorkspace: SetWorkspace; makeId: () => string; onClose: () => void;
}) {
  const [form, setForm] = useState<NoteFields>(() => (note ? noteFields(note) : start ?? blank("student", student || "")));
  const [status, setStatus] = useState<"" | "saving" | "saved" | "waiting">("");
  const lock = useLock();
  const savedId = useRef<string | null>(note?.id ?? null);
  const latest = useRef(form); latest.current = form;
  const timer = useRef<number | null>(null);
  const flush = useCallback(() => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    const fields = student ? { ...latest.current, scope: "student" as const, student } : latest.current;
    if (!cleanNote(fields)) { setStatus(savedId.current ? "saved" : "waiting"); return; }
    if (savedId.current) { const at = savedId.current; setWorkspace((p) => saveNote(p, at, fields, makeId)); }
    else { const nid = makeId(); savedId.current = nid; setWorkspace((p) => saveNote(p, null, fields, () => nid)); }
    setStatus("saved");
  }, [makeId, setWorkspace, student]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setStatus("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 700);
  }, [form, flush]);
  // Closing any way at all still keeps what was written.
  const flushRef = useRef(flush); flushRef.current = flush;
  useEffect(() => () => { if (timer.current) flushRef.current(); }, []);
  const done = () => { flush(); onClose(); };
  const general = form.scope === "general";
  const label = status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "waiting" ? (general ? "Write something to save it" : "Pick a student and write something to save it") : "Saves as you type";
  return (
    <HubModal title={note ? noteHeading(note) : student ? `Note for ${student}` : "New note"} size="full" onClose={done}
      footer={<div className="flex flex-wrap items-center gap-3"><PrimaryButton onClick={done}><Check className="h-4 w-4" /> Done</PrimaryButton>
        {lock && <button type="button" onClick={() => { if (!lock.lock) { lock.openSettings(); return; } setForm({ ...form, locked: !form.locked }); }} aria-pressed={!!form.locked} data-testid="note-lock"
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${form.locked ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>{form.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}{form.locked ? "Locked" : "Lock note"}</button>}
        <span className="text-sm text-slate-500" aria-live="polite" data-testid="note-status">{label}</span></div>}>
      <form onSubmit={(e) => { e.preventDefault(); done(); }} data-testid="note-form"><NoteBoxes form={form} setForm={setForm} students={students} lockStudent={!note && !!student} /><button type="submit" hidden /></form>
    </HubModal>
  );
}

/** One saved note: a coloured card like LifeHub's notes, with the students it is about. */
export function NoteCard({ note, onEdit, onDelete, onPin, onStudent }: { note: NoteItem; onEdit?: () => void; onDelete?: () => void; onPin?: () => void; onStudent?: (name: string) => void }) {
  const general = noteScope(note) === "general";
  const who = noteStudents(note);
  const lock = useLock();
  // A locked note shows only its heading until the passcode is entered.
  const hidden = !!note.locked && !!lock && !lock.unlocked;
  const edit = onEdit && (async () => { if (!hidden || (await lock!.ask(`Unlock “${noteHeading(note)}”`))) onEdit(); });
  return (
    <article className="note-card group break-inside-avoid rounded-2xl border border-black/5 p-4 text-slate-900 shadow-[0_3px_16px_#17152b0a]" style={{ background: note.color || "#ffffff" }} data-testid="note-row">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 break-words text-base font-black text-slate-800">{note.locked && <Lock className="h-4 w-4 shrink-0 text-slate-500" aria-label="Locked" />}{noteHeading(note)}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            {general ? <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-800">{note.type}</span>
              : who.map((n) => onStudent
                ? <button key={n} type="button" onClick={() => onStudent(n)} title={`Only ${n}'s notes`} className="rounded-full bg-teal-600/10 px-2 py-0.5 font-semibold text-teal-800 hover:bg-teal-600/20">{n}</button>
                : <span key={n} className="rounded-full bg-teal-600/10 px-2 py-0.5 font-semibold text-teal-800">{n}</span>)}
            {!general && <span>{note.type}</span>}
            {note.date && <span>{note.date}</span>}
          </div>
        </div>
        {(onEdit || onDelete || onPin) && (
          <div className="-m-1.5 flex shrink-0 items-center">
            {onPin && <button type="button" aria-pressed={!!note.pinned} aria-label={note.pinned ? `Unpin ${noteHeading(note)}` : `Pin ${noteHeading(note)}`} onClick={onPin} className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${note.pinned ? "text-violet-700" : "text-slate-400 opacity-70 hover:opacity-100"}`}><Pin className={`h-4 w-4 ${note.pinned ? "fill-current" : ""}`} /></button>}
            {onEdit && <button type="button" aria-label={`Edit note: ${noteHeading(note)}`} className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-black/5 hover:text-slate-950" onClick={edit} data-testid="note-edit"><Pencil className="h-4 w-4" /></button>}
            {onDelete && <button type="button" aria-label={`Delete note: ${noteHeading(note)}`} className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={onDelete}><Trash2 className="h-4 w-4" /></button>}
          </div>
        )}
      </div>
      <button type="button" onClick={edit} disabled={!onEdit} className="mt-2 block w-full text-left">{hidden ? <p className="text-sm text-slate-500">Locked</p> : <p className="line-clamp-[12] whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{note.body}</p>}</button>
    </article>
  );
}

export default function HubNotes({ workspace, setWorkspace, remove, makeId }: { workspace: Workspace; setWorkspace: SetWorkspace; remove: (key: "notes", rowId: string) => void; makeId: () => string }) {
  const students = useMemo(() => workspace.students.map((s) => s.name), [workspace.students]);
  const [form, setForm] = useState<NoteFields>(() => blank("student"));
  /** The new note open now (a number, so each new one starts fresh), or 0. */
  const [adding, setAdding] = useState(0);
  const [filter, setFilter] = useSavedChoice<NoteFilter>("hub-notes-filter", "all", ["all", "student", "general"] as NoteFilter[]);
  const [search, setSearch] = useState("");
  const [who, setWho] = useSavedChoice<string>("hub-notes-student", "");
  const [editing, setEditing] = useState<NoteItem | null>(null);
  const counts = noteCounts(workspace.notes);
  const student = who && students.includes(who) ? who : "";
  const shown = useMemo(() => arrangeNotes(workspace.notes, filter, search, student), [workspace.notes, filter, search, student]);
  const chip = (active: boolean) => `inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;
  return (
    <>
      <section className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
          <h2 className="hub-card-title font-semibold text-slate-900">Notes</h2>
          <div className="flex flex-wrap items-center gap-2">
            <NoteTemplatesButton hub="work" className="rounded-full" onPick={(t) => { setForm(fromTemplate(t, student)); setAdding(Date.now()); }} />
            <button type="button" onClick={() => { setForm(blank("student", student)); setAdding(Date.now()); }} data-testid="add-card-add-note"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-teal-600 px-4 text-sm font-semibold text-white transition hover:bg-teal-700">
              <Plus className="h-4 w-4" /> Add note
            </button>
          </div>
        </div>
      </section>
      <Card>
        {workspace.notes.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Show">
              <button type="button" className={chip(filter === "all")} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All <span className="opacity-70">{counts.all}</span></button>
              <button type="button" className={chip(filter === "student")} aria-pressed={filter === "student"} onClick={() => setFilter("student")}>Students <span className="opacity-70">{counts.student}</span></button>
              <button type="button" className={chip(filter === "general")} aria-pressed={filter === "general"} onClick={() => setFilter("general")}>Meetings &amp; general <span className="opacity-70">{counts.general}</span></button>
            </div>
            {students.length > 0 && (
              <select value={student} onChange={(e) => { setWho(e.target.value); if (e.target.value) setFilter("student"); }} aria-label="Notes about" className="min-h-11 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" data-testid="note-student-filter">
                <option value="">Every student</option>{students.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Field type="search" placeholder="Search notes" aria-label="Search notes" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        )}
        {shown.length
          ? <div className="columns-1 gap-4 sm:columns-2 xl:columns-3 [&>*]:mb-4">{shown.map((n) => <NoteCard key={n.id} note={n} onEdit={() => setEditing(n)} onDelete={() => remove("notes", n.id)} onPin={() => setWorkspace((p) => pinNote(p, n.id))} onStudent={(name) => { setWho(name); setFilter("student"); }} />)}</div>
          : <Empty>{workspace.notes.length ? "No notes match." : "No notes yet. Tap “Add note” to write the first one. Notes save as you type."}</Empty>}
      </Card>
      {adding && <NoteModal key={adding} start={form} students={students} setWorkspace={setWorkspace} makeId={makeId} onClose={() => setAdding(0)} />}
      {editing && <NoteModal key={editing.id} note={editing} students={students} setWorkspace={setWorkspace} makeId={makeId} onClose={() => setEditing(null)} />}
    </>
  );
}
