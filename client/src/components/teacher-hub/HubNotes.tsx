// Arise WorkHub: the Notes tab. A note is about a student (a check-in, a concern) or it is not about
// any one student (a staff meeting, a team meeting, a training). Notes can be searched and changed.
import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Check, Pencil, Plus, Trash2, User, Users } from "lucide-react";
import { GENERAL_NOTE_KINDS, STUDENT_NOTE_KINDS, NOTE_TITLE_MAX, arrangeNotes, cleanNote, noteCounts, noteFields, noteHeading, noteScope, saveNote, type NoteFields, type NoteFilter, type NoteScope } from "@shared/hubNotes";
import type { NoteItem, Workspace } from "@shared/teacherHub";
import { Card, Empty, Field, GhostButton, Labeled, PrimaryButton, Select, TextArea } from "./ui";
import { localDay } from "./HubImport";
import { HubModal } from "./HubModal";

type SetWorkspace = Dispatch<SetStateAction<Workspace>>;
const SCOPES = [["student", "About a student", User], ["general", "Meeting or general", Users]] as const;
const blank = (scope: NoteScope, student = ""): NoteFields => ({ scope, student, type: scope === "student" ? "Check-in" : "Staff meeting", title: "", date: localDay(), body: "" });

/** The boxes for a note. Which ones show depends on whether it is about a student. */
function NoteBoxes({ form, setForm, students, lockStudent = false }: { form: NoteFields; setForm: (next: NoteFields) => void; students: string[]; lockStudent?: boolean }) {
  const general = form.scope === "general";
  const switchTo = (scope: NoteScope) => setForm({ ...form, scope, type: scope === "student" ? "Check-in" : "Staff meeting" });
  // A student who has since left the caseload still has to show, or their note could not be saved again.
  const names = form.student && !students.includes(form.student) ? [form.student, ...students] : students;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
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
      <Labeled label="Note" className="sm:col-span-2"><TextArea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={general ? "What was said, what was decided, what you need to do..." : "Write note..."} required aria-label="Note" className="min-h-32" /></Labeled>
    </div>
  );
}

/** A pop-up to write a note, or to change one. With `student`, it is a note for that student and no other. */
export function NoteModal({ note, student, students, onSave, onClose }: { note?: NoteItem; student?: string; students: string[]; onSave: (fields: NoteFields) => void; onClose: () => void }) {
  const [form, setForm] = useState<NoteFields>(() => (note ? noteFields(note) : blank("student", student || "")));
  const ready = !!cleanNote(form);
  function save(e?: FormEvent) {
    e?.preventDefault();
    if (!ready) return;
    onSave(form);
    onClose();
  }
  return (
    <HubModal title={note ? "Edit note" : student ? `Note for ${student}` : "New note"} onClose={onClose}
      footer={<div className="flex gap-2"><PrimaryButton onClick={() => save()} disabled={!ready}><Check className="h-4 w-4" /> {note ? "Save changes" : "Save note"}</PrimaryButton><GhostButton onClick={onClose}>Cancel</GhostButton></div>}>
      <form onSubmit={save} data-testid="note-form"><NoteBoxes form={form} setForm={setForm} students={students} lockStudent={!note && !!student} /><button type="submit" hidden /></form>
    </HubModal>
  );
}

/** One saved note. */
export function NoteCard({ note, onEdit, onDelete }: { note: NoteItem; onEdit?: () => void; onDelete?: () => void }) {
  const general = noteScope(note) === "general";
  return (
    <div className="rounded-2xl border border-slate-200 p-4" data-testid="note-row">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="break-words font-semibold">{noteHeading(note)}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className={`rounded-full px-2 py-0.5 font-medium ${general ? "bg-sky-100 text-sky-800" : "bg-teal-50 text-teal-800"}`}>{general ? note.type : note.student}</span>
            {!general && note.title && <span>{note.type}</span>}
            <span>{note.date}</span>
          </div>
        </div>
        {(onEdit || onDelete) && (
          <div className="-m-2 flex shrink-0 items-center">
            {onEdit && <button type="button" aria-label={`Edit note: ${noteHeading(note)}`} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-950" onClick={onEdit} data-testid="note-edit"><Pencil className="h-4 w-4" /></button>}
            {onDelete && <button type="button" aria-label={`Delete note: ${noteHeading(note)}`} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={onDelete}><Trash2 className="h-4 w-4" /></button>}
          </div>
        )}
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{note.body}</p>
    </div>
  );
}

export default function HubNotes({ workspace, setWorkspace, remove, makeId }: { workspace: Workspace; setWorkspace: SetWorkspace; remove: (key: "notes", rowId: string) => void; makeId: () => string }) {
  const students = useMemo(() => workspace.students.map((s) => s.name), [workspace.students]);
  const [form, setForm] = useState<NoteFields>(() => blank("student"));
  const [filter, setFilter] = useState<NoteFilter>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<NoteItem | null>(null);
  const counts = noteCounts(workspace.notes);
  const shown = useMemo(() => arrangeNotes(workspace.notes, filter, search), [workspace.notes, filter, search]);
  const ready = !!cleanNote(form);
  function add(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setWorkspace((p) => saveNote(p, null, form, makeId));
    // The next note is most likely of the same sort, on the same day.
    setForm({ ...blank(form.scope), type: form.type, date: form.date });
  }
  const chip = (active: boolean) => `inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;
  return (
    <>
      <Card title="Add a note">
        <p className="mb-4 text-sm text-slate-600">Notes about a student go with that student. Notes from a staff meeting, a team meeting or a training don't need a student at all.</p>
        <form onSubmit={add} className="space-y-3" data-testid="note-add">
          <NoteBoxes form={form} setForm={setForm} students={students} />
          <PrimaryButton type="submit" disabled={!ready}><Plus className="h-4 w-4" /> Add note</PrimaryButton>
        </form>
      </Card>
      <Card title="Notes">
        {workspace.notes.length > 0 && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Show">
              <button type="button" className={chip(filter === "all")} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All <span className="opacity-70">{counts.all}</span></button>
              <button type="button" className={chip(filter === "student")} aria-pressed={filter === "student"} onClick={() => setFilter("student")}>Students <span className="opacity-70">{counts.student}</span></button>
              <button type="button" className={chip(filter === "general")} aria-pressed={filter === "general"} onClick={() => setFilter("general")}>Meetings &amp; general <span className="opacity-70">{counts.general}</span></button>
            </div>
            <Field type="search" placeholder="Search notes" aria-label="Search notes" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4" />
          </>
        )}
        {shown.length
          ? <div className="space-y-3">{shown.map((n) => <NoteCard key={n.id} note={n} onEdit={() => setEditing(n)} onDelete={() => remove("notes", n.id)} />)}</div>
          : <Empty>{workspace.notes.length ? "No notes match." : "No notes yet."}</Empty>}
      </Card>
      {editing && <NoteModal key={editing.id} note={editing} students={students} onSave={(fields) => setWorkspace((p) => saveNote(p, editing.id, fields, makeId))} onClose={() => setEditing(null)} />}
    </>
  );
}
