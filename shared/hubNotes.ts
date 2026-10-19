// Arise WorkHub notes. A note is either about a student (a check-in, a concern, a progress note) or
// it is not about any one student: a staff meeting, a team meeting, a training, an idea to keep.
import { cleanLinks, type HubLink } from "./hubLinks";
import { cleanNoteHtml } from "./richNote";
import type { NoteItem, Workspace } from "./teacherHub";

/** Kinds of note about a student. */
export const STUDENT_NOTE_KINDS = ["Check-in", "Concern", "Meeting note", "Teacher note", "Progress note"] as const;
/** Kinds of note that are not about one student. */
export const GENERAL_NOTE_KINDS = ["Staff meeting", "Team meeting", "Department meeting", "Training", "Committee", "General note"] as const;

export type NoteScope = "student" | "general";
export type NoteFilter = "all" | NoteScope;
export type NoteFields = { scope: NoteScope; student: string; type: string; title: string; date: string; body: string; /** The formatted note from the editor. */ html?: string; /** More students it is about. */ students?: string[]; color?: string; pinned?: boolean; locked?: boolean; /** What it is linked to (shared/hubLinks.ts). */ links?: HubLink[] };

/** Note card colours: the same soft colours LifeHub notes use. */
export const NOTE_CARD_COLORS = ["#fff7d6", "#e9f7ef", "#e8f1fd", "#fde8ef", "#f1ecff", "#ffffff"] as const;

/** Every student a note is about: its main student, then any more attached. */
export const noteStudents = (n: Pick<NoteItem, "student" | "students">): string[] => { const out: string[] = []; for (const s of [n.student, ...(n.students || [])]) { const t = String(s || "").trim(); if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t); } return out; };

export const NOTE_TITLE_MAX = 120;
export const noteScope = (note: Pick<NoteItem, "student">): NoteScope => (String(note.student || "").trim() ? "student" : "general");

/** What a note is headed with: its title, else the student and kind, else just the kind. */
export function noteHeading(note: Pick<NoteItem, "student" | "type" | "title">): string {
  const title = String(note.title || "").trim();
  if (title) return title;
  return note.student ? `${note.student} · ${note.type}` : note.type || "Note";
}

/** The note as it will be saved, or null while it can't be (nothing written, or a student note with no student). */
export function cleanNote(fields: NoteFields): Omit<NoteItem, "id"> | null {
  const body = String(fields.body || "").trim();
  const title = String(fields.title || "").replace(/\s+/g, " ").trim().slice(0, NOTE_TITLE_MAX);
  const student = fields.scope === "student" ? String(fields.student || "").trim() : "";
  if (!body || (fields.scope === "student" && !student)) return null;
  const kinds: readonly string[] = fields.scope === "student" ? STUDENT_NOTE_KINDS : GENERAL_NOTE_KINDS;
  const type = kinds.includes(fields.type) ? fields.type : kinds[kinds.length - (fields.scope === "student" ? 2 : 1)];
  const more = fields.scope === "student" ? noteStudents({ student, students: fields.students }).slice(1, 40) : [];
  const color = (NOTE_CARD_COLORS as readonly string[]).includes(String(fields.color)) ? fields.color : undefined;
  const html = cleanNoteHtml(fields.html);
  return { student, type, body, date: fields.date || "", ...(html ? { html } : {}), ...(title ? { title } : {}), ...(more.length ? { students: more } : {}), ...(color ? { color } : {}), ...(fields.pinned ? { pinned: true } : {}), ...(fields.locked ? { locked: true } : {}), ...(fields.links?.length ? { links: cleanLinks(fields.links) } : {}) };
}

/** Adds a note on top, or changes one in place. Nothing changes when the note can't be saved or is gone. */
export function saveNote(workspace: Workspace, noteId: string | null, fields: NoteFields, makeId: () => string): Workspace {
  const note = cleanNote(fields);
  if (!note) return workspace;
  if (!noteId) return { ...workspace, notes: [{ id: makeId(), ...note }, ...workspace.notes] };
  if (!workspace.notes.some((n) => n.id === noteId)) return workspace;
  return { ...workspace, notes: workspace.notes.map((n) => (n.id === noteId ? { id: n.id, ...note } : n)) };
}

/** The boxes filled in from a saved note, to change it. */
export function noteFields(note: NoteItem): NoteFields {
  return { scope: noteScope(note), student: note.student || "", type: note.type, title: note.title || "", date: note.date || "", body: note.body || "", ...(note.html ? { html: note.html } : {}), students: note.students || [], color: note.color, pinned: !!note.pinned, locked: !!note.locked, links: cleanLinks(note.links) };
}

/** The notes to show: by kind of note, and by words in the title, the note, the student or the kind. Saved order is kept (newest first). */
export function arrangeNotes(notes: NoteItem[], filter: NoteFilter = "all", search = "", student = ""): NoteItem[] {
  const q = search.trim().toLowerCase(), who = student.trim().toLowerCase();
  const shown = notes.filter((n) => (filter === "all" || noteScope(n) === filter)
    && (!who || noteStudents(n).some((s) => s.toLowerCase() === who))
    && (!q || [n.title, n.body, n.type, ...noteStudents(n)].some((part) => String(part || "").toLowerCase().includes(q))));
  // Pinned notes first; otherwise the saved order (newest first).
  return [...shown.filter((n) => n.pinned), ...shown.filter((n) => !n.pinned)];
}

/** Pins or unpins a note. */
export const pinNote = (w: Workspace, id: string): Workspace => ({ ...w, notes: w.notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)) });

export function noteCounts(notes: NoteItem[]): { all: number; student: number; general: number } {
  const student = notes.filter((n) => noteScope(n) === "student").length;
  return { all: notes.length, student, general: notes.length - student };
}
