// The "Notes" app offered as its own Arise App Store install: LifeHub Notes (installable into
// WorkHub) and Work Notes (installable into LifeHub). Same simple pinnable note-card feature as
// LifeHub's built-in Notes, but each hub's copy keeps its own separate notes — nothing is shared
// between them. Bolted onto the workspace/family the same loose way Plugin Kit records are (see
// shared/pluginKit.ts): not a typed field on Workspace or Family, just read and saved through these
// helpers, so installing or removing it never has to touch the core hub types.

import { NOTE_COLORS, type Note } from "./familyHub";

export { NOTE_COLORS };
export type { Note };

const LIMIT = 1000;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const bool = (v: unknown) => v === true;
const color = (v: unknown) => (typeof v === "string" && NOTE_COLORS.includes(v) ? v : NOTE_COLORS[0]);

/** A saved notes-app list made safe: up to 1000 notes, each with a title or a body. */
export function cleanNotesApp(raw: unknown): Note[] {
  if (!Array.isArray(raw)) return [];
  const out: Note[] = [];
  for (const r of raw.slice(0, LIMIT * 2)) {
    if (!r || typeof r !== "object") continue;
    const id = str((r as any).id, 60);
    const title = str((r as any).title, 120);
    const body = str((r as any).body, 5000);
    if (!id || (!title.trim() && !body.trim())) continue;
    out.push({ id, title, body, color: color((r as any).color), pinned: bool((r as any).pinned), updatedAt: str((r as any).updatedAt, 40) });
    if (out.length >= LIMIT) break;
  }
  return out;
}

/** Saves a note: adds it on top, or changes it in place if it already exists. */
export function saveNotesAppNote(notes: Note[], note: Note): Note[] {
  const clean: Note = { ...note, title: note.title.slice(0, 120), body: note.body.slice(0, 5000), updatedAt: new Date().toISOString() };
  return notes.some((n) => n.id === clean.id) ? notes.map((n) => (n.id === clean.id ? clean : n)) : [clean, ...notes].slice(0, LIMIT);
}

export const removeNotesAppNote = (notes: Note[], id: string): Note[] => notes.filter((n) => n.id !== id);
export const pinNotesAppNote = (notes: Note[], id: string): Note[] => notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n));
