// Strict mode: notes kept only on this iPhone (IndexedDB in the Notes app). They are never sent to
// Arise's servers, so they don't use minutes, and deleting the app (or this note) deletes them.
import type { NoteSummary, NotesTemplateId, Segment } from "@shared/ariseNotes";

export type LocalNote = {
  id: string;
  title: string;
  template: NotesTemplateId;
  source: "record" | "upload";
  createdAt: string;
  durationSecs: number;
  segments: Segment[];
  highlights: number[];
  summary: NoteSummary | null;
  /** Why there's no summary yet ("" when there is one, or none was tried). */
  summaryProblem: string;
};

export const isLocalId = (id: string) => id.startsWith("local-");
export const newLocalId = () => `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const DB = "arise-notes-strict";
const STORE = "notes";
let opening: Promise<IDBDatabase> | null = null;
const db = () => (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
  const req = indexedDB.open(DB, 1);
  req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" }); };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => { opening = null; reject(new Error("Notes on this iPhone can't be opened right now.")); };
}));
const run = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const d = await db();
  return new Promise<T>((resolve, reject) => {
    const r = fn(d.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(new Error("That couldn't be saved on this iPhone."));
  });
};

/** Every Strict note on this iPhone, newest first. */
export async function listLocalNotes(): Promise<LocalNote[]> {
  try { return ((await run("readonly", (s) => s.getAll())) as LocalNote[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  catch { return []; }
}
export const getLocalNote = async (id: string) => ((await run("readonly", (s) => s.get(id))) as LocalNote | undefined) ?? null;
export const saveLocalNote = async (n: LocalNote) => { await run("readwrite", (s) => s.put(n)); };
export const removeLocalNote = async (id: string) => { await run("readwrite", (s) => s.delete(id)); };
export const removeAllLocalNotes = async () => { await run("readwrite", (s) => s.clear()); };
