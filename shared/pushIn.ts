// Arise WorkHub: push-in class notes, kept with the minutes.
//
// A teacher who pushes in to a general-education class writes down what that class's teacher taught, the
// materials used (PDFs, handouts, links, worksheets), how each student did, and the scaffolded work made
// for the students who need it. A note belongs to a class the same way the minutes do: a block, a half of
// it, and whose class it is (shared/hubBlocks.ts), so the notes line up with the "By class" cards.
//
// Everything is kept in the teacher's one Hub workspace, in `workspace.pushInNotes`. Uploaded files live in
// the Hub's Drive storage, and a note holds only where they are. The page is client/src/components/teacher-hub/HubPushInNotes.tsx.
import { cleanPart, cleanTeacher, groupText, partRank, type BlockPart, type SchoolBlock } from "./hubBlocks";
import { cleanSubject } from "./hubSubjects";
import { CHECKS, cleanMaterial, cleanWorksheet, type GenWorksheet, type LessonCheck, type LessonMaterial, type WorksheetItem, type WorksheetSection } from "./lessonPlanner";
import type { ClassGroup } from "./hubClassMinutes";

export const PUSH_IN_LIMITS = {
  /** Notes a teacher can keep. The page asks them to delete old ones before adding more. */
  notes: 1000,
  students: 60,
  materials: 30,
  title: 160,
  taught: 6000,
  note: 1500,
  support: 300,
  /** About how big the notes may get in the workspace (a whole workspace may be 5 MB), counting AI worksheets. */
  bytes: 1_800_000,
} as const;

/** One student in a note: how they did, what they were helped with, and the scaffolded work they were given. */
export type PushInStudent = {
  student: string;
  status?: LessonCheck;
  /** What the student did or said in this lesson. */
  note?: string;
  /** The help they were given: sentence frames, a re-read, a smaller job. */
  support?: string;
  /** The note's materials this student was given (ids of `materials`). */
  materialIds?: string[];
};

export type PushInNote = {
  id: string;
  /** The day of the lesson, "YYYY-MM-DD". */
  date: string;
  /** The block's id, or "" for a class that names no block. */
  block: string;
  part?: BlockPart;
  /** Whose class it is. */
  teacher?: string;
  subject: string;
  /** The lesson, in a few words. */
  title: string;
  /** What the teacher taught. */
  taught: string;
  /** What to do next time. */
  followUp?: string;
  materials: LessonMaterial[];
  students: PushInStudent[];
  createdAt: string;
  updatedAt: string;
};

// ─── Cleaning what was saved ────────────────────────────────────────────────

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\u0000/g, "").slice(0, max) : typeof v === "number" ? String(v).slice(0, max) : "");
const line = (v: unknown, max: number): string => str(v, max).replace(/\s+/g, " ").trim();
const day = (v: unknown): string => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
export const fold = (s: unknown): string => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function cleanStudent(raw: any, materialIds: Set<string>): PushInStudent | null {
  if (!raw || typeof raw !== "object") return null;
  const student = line(raw.student, 80);
  if (!student) return null;
  const status = (CHECKS as readonly string[]).includes(raw.status) ? (raw.status as LessonCheck) : undefined;
  const note = str(raw.note, PUSH_IN_LIMITS.note).trim();
  const support = str(raw.support, PUSH_IN_LIMITS.support).trim();
  const ids = [...new Set((Array.isArray(raw.materialIds) ? raw.materialIds : []).filter((x: unknown): x is string => typeof x === "string" && materialIds.has(x)))] as string[];
  // A student with nothing written is not kept: the note lists the class's students anyway.
  if (!status && !note && !support && !ids.length) return null;
  return { student, ...(status ? { status } : {}), ...(note ? { note } : {}), ...(support ? { support } : {}), ...(ids.length ? { materialIds: ids } : {}) };
}

/** A saved note made safe to use, or null when it is not a note. */
export function cleanPushInNote(raw: any): PushInNote | null {
  if (!raw || typeof raw !== "object") return null;
  const id = line(raw.id, 60);
  const date = day(raw.date);
  if (!id || !date) return null;
  const seen = new Set<string>();
  const materials: LessonMaterial[] = [];
  for (const m of Array.isArray(raw.materials) ? raw.materials : []) {
    const made = cleanMaterial(m);
    if (!made || seen.has(made.id)) continue;
    seen.add(made.id);
    materials.push(made);
    if (materials.length >= PUSH_IN_LIMITS.materials) break;
  }
  const ids = new Set(materials.map((m) => m.id));
  const names = new Set<string>();
  const students: PushInStudent[] = [];
  for (const s of Array.isArray(raw.students) ? raw.students : []) {
    const made = cleanStudent(s, ids);
    if (!made || names.has(fold(made.student))) continue;
    names.add(fold(made.student));
    students.push(made);
    if (students.length >= PUSH_IN_LIMITS.students) break;
  }
  const part = cleanPart(raw.part);
  const teacher = cleanTeacher(raw.teacher);
  const followUp = str(raw.followUp, PUSH_IN_LIMITS.note).trim();
  const created = line(raw.createdAt, 40);
  return {
    id, date, block: line(raw.block, 40), ...(part ? { part } : {}), ...(teacher ? { teacher } : {}),
    subject: cleanSubject(raw.subject), title: line(raw.title, PUSH_IN_LIMITS.title), taught: str(raw.taught, PUSH_IN_LIMITS.taught).trim(),
    ...(followUp ? { followUp } : {}), materials, students,
    createdAt: created, updatedAt: line(raw.updatedAt, 40) || created,
  };
}

/** The saved notes made safe to use: no note twice, newest first. */
export function cleanPushInNotes(raw: unknown): PushInNote[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: PushInNote[] = [];
  for (const r of raw) {
    const n = cleanPushInNote(r);
    if (!n || seen.has(n.id)) continue;
    seen.add(n.id);
    out.push(n);
    if (out.length >= PUSH_IN_LIMITS.notes) break;
  }
  return sortNotes(out);
}

/** Newest day first; the notes of one day follow the order of the day (block, then half). */
export function sortNotes(notes: PushInNote[], blocks: SchoolBlock[] = []): PushInNote[] {
  const at = (id: string) => { const i = blocks.findIndex((b) => b.id === id); return i < 0 ? blocks.length : i; };
  return [...notes].sort((a, b) => b.date.localeCompare(a.date) || at(a.block) - at(b.block) || partRank(a.part) - partRank(b.part) || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
}

// ─── Aligned with the classes ───────────────────────────────────────────────

/** The key of the class a note belongs to: the same key as the minutes' class card (shared/hubClassMinutes.ts). */
export function noteKey(note: Pick<PushInNote, "block" | "part" | "teacher">, blocks: SchoolBlock[]): string {
  const block = note.block && blocks.some((b) => b.id === note.block) ? note.block : "";
  const part = block ? cleanPart(note.part) : undefined;
  return `${block}|${part || ""}|${fold(cleanTeacher(note.teacher))}`;
}

/** A new note for a class and a day, with the class's usual subject. */
export function newNote(group: Pick<ClassGroup, "block" | "part" | "teacher" | "students">, date: string, id: string, now: string): PushInNote {
  const counts = new Map<string, number>();
  for (const s of group.students) if (s.subject) counts.set(s.subject, (counts.get(s.subject) || 0) + 1);
  const subject = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "";
  return { id, date, block: group.block, ...(group.part ? { part: group.part } : {}), ...(group.teacher ? { teacher: group.teacher } : {}), subject, title: "", taught: "", materials: [], students: [], createdAt: now, updatedAt: now };
}

/** A note with the class changed to another. The day, the lesson, the materials and what was written about each student all stay. */
export function moveNote(note: PushInNote, group: Pick<ClassGroup, "block" | "part" | "teacher">, now: string): PushInNote {
  const { part: _part, teacher: _teacher, ...rest } = note;
  return { ...rest, block: group.block, ...(group.part ? { part: group.part } : {}), ...(group.teacher ? { teacher: group.teacher } : {}), updatedAt: now };
}

/** The students of a class, once each, in alphabetical order. */
export function classRoster(group: Pick<ClassGroup, "students"> | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of group?.students || []) { if (seen.has(fold(s.student))) continue; seen.add(fold(s.student)); out.push(s.student); }
  return out.sort((a, b) => a.localeCompare(b));
}

/** Who a note is about: the class's students, then anyone written in who is not in the class any more. */
export function noteRoster(note: PushInNote, group: Pick<ClassGroup, "students"> | undefined): string[] {
  const names = classRoster(group);
  const known = new Set(names.map(fold));
  return [...names, ...note.students.map((s) => s.student).filter((n) => !known.has(fold(n)))];
}

/** A student's entry in a note ({student} alone when nothing is written for them). */
export const entryOf = (note: PushInNote, student: string): PushInStudent => note.students.find((s) => fold(s.student) === fold(student)) || { student };

/** A note changed for one student. An entry with nothing in it is taken out. */
export function withEntry(note: PushInNote, student: string, change: Partial<PushInStudent>, now: string): PushInNote {
  const next = { ...entryOf(note, student), ...change, student: entryOf(note, student).student };
  const kept = note.students.filter((s) => fold(s.student) !== fold(student));
  const full = cleanStudent(next, new Set(note.materials.map((m) => m.id)));
  return { ...note, students: full ? [...kept, full] : kept, updatedAt: now };
}

/** A note with its materials changed. A student keeps only the materials that are still there. */
export function withMaterials(note: PushInNote, materials: LessonMaterial[], now: string): PushInNote {
  const ids = new Set(materials.map((m) => m.id));
  return {
    ...note, materials, updatedAt: now,
    students: note.students.map((s) => (s.materialIds ? { ...s, materialIds: s.materialIds.filter((x) => ids.has(x)) } : s)).filter((s) => s.status || s.note || s.support || s.materialIds?.length),
  };
}

/** The raw saved list with a note put in: replaced if it is there, added at the end if not. Other items are left as they are. */
export function upsertNote(list: unknown[] | undefined, note: PushInNote): unknown[] {
  const all = Array.isArray(list) ? list : [];
  return all.some((x) => (x as any)?.id === note.id) ? all.map((x) => ((x as any)?.id === note.id ? note : x)) : [...all, note];
}
/** The raw saved list without a note. */
export const removeNote = (list: unknown[] | undefined, id: string): unknown[] => (Array.isArray(list) ? list : []).filter((x) => (x as any)?.id !== id);

/** Nothing written yet: a note opened and left alone is not kept. */
export const isBlank = (n: PushInNote): boolean => !n.title.trim() && !n.taught.trim() && !n.followUp && !n.materials.length && !n.students.length;

/** The notes of one class. */
export const notesForClass = (notes: PushInNote[], key: string, blocks: SchoolBlock[]): PushInNote[] => notes.filter((n) => noteKey(n, blocks) === key);

/** Notes whose class is not among the classes shown (its students were moved or its block was removed). */
export const orphanNotes = (notes: PushInNote[], keys: Set<string>, blocks: SchoolBlock[]): PushInNote[] => notes.filter((n) => !keys.has(noteKey(n, blocks)));

/** What one student has across the notes: the lessons they were in, newest first. */
export type StudentNoteRow = { note: PushInNote; entry: PushInStudent };
export function notesForStudent(notes: PushInNote[], student: string): StudentNoteRow[] {
  const rows: StudentNoteRow[] = [];
  for (const note of notes) {
    const entry = note.students.find((s) => fold(s.student) === fold(student));
    if (entry) rows.push({ note, entry });
  }
  return rows;
}

/** Everyone named in the notes or in the classes, once each. */
export function studentNames(notes: PushInNote[], groups: Pick<ClassGroup, "students">[]): string[] {
  const seen = new Map<string, string>();
  for (const g of groups) for (const s of g.students) if (!seen.has(fold(s.student))) seen.set(fold(s.student), s.student);
  for (const n of notes) for (const s of n.students) if (!seen.has(fold(s.student))) seen.set(fold(s.student), s.student);
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** Words that find notes: the lesson, what was taught, the class, the students' notes and the materials' names. */
export function noteMatches(note: PushInNote, query: string, blocks: SchoolBlock[]): boolean {
  const q = fold(query);
  if (!q) return true;
  const hay = [note.title, note.taught, note.followUp, note.subject, note.teacher, blocks.find((b) => b.id === note.block)?.name, groupText(note),
    ...note.materials.map((m) => m.name), ...note.students.flatMap((s) => [s.student, s.note, s.support])];
  return fold(hay.filter(Boolean).join(" ")).includes(q);
}

/** About how many bytes the notes take up in the workspace. */
export const notesBytes = (notes: PushInNote[]): number => JSON.stringify(notes).length;
export const notesFull = (notes: PushInNote[]): boolean => notes.length >= PUSH_IN_LIMITS.notes || notesBytes(notes) >= PUSH_IN_LIMITS.bytes;

/** A few words on a note, for its card. */
export function noteFacts(n: PushInNote): string[] {
  const scaffolded = (m: LessonMaterial) => m.kind === "worksheet" && /^scaffold/i.test(m.name);
  const files = n.materials.filter((m) => m.kind !== "answerKey" && !scaffolded(m));
  const scaffolds = n.materials.filter(scaffolded).length;
  return [
    files.length ? `${files.length} ${files.length === 1 ? "file" : "files"}` : "",
    scaffolds ? `${scaffolds} scaffolded` : "",
    n.students.length ? `${n.students.length} ${n.students.length === 1 ? "student" : "students"} noted` : "",
  ].filter(Boolean);
}

// ─── Scaffolded work ────────────────────────────────────────────────────────
//
// A scaffold lowers the barriers to the same work without lowering the thinking. The teacher picks the supports;
// the AI writes the worksheet with them (server/lessonPlanner.ts, mode "scaffold"), or a blank scaffold with the
// same supports is made here, for the teacher to fill in by hand.

export const SCAFFOLD_SUPPORTS = [
  { id: "frames", label: "Sentence frames", ai: "sentence frames and starters for every written answer (\"The first step is ___\")" },
  { id: "wordbank", label: "Word bank", ai: "a word bank of the key words, with a short plain meaning beside each" },
  { id: "chunk", label: "Small steps", ai: "the work broken into small numbered steps, one thing at a time" },
  { id: "example", label: "Worked example first", ai: "a fully worked example before the first question, with each step explained" },
  { id: "fewer", label: "Fewer questions", ai: "fewer questions, each one carrying the same skill" },
  { id: "simple", label: "Simpler words", ai: "shorter sentences and simpler words, with the same ideas" },
  { id: "visuals", label: "Pictures and diagrams", ai: "a picture, diagram or model with the questions wherever one helps" },
  { id: "choices", label: "Pick the answer", ai: "choices to pick from in place of open writing where it is fair" },
  { id: "space", label: "Extra room to write", ai: "plenty of room to write and show work" },
] as const;
export type ScaffoldSupport = (typeof SCAFFOLD_SUPPORTS)[number]["id"];
export const DEFAULT_SUPPORTS: ScaffoldSupport[] = ["frames", "wordbank", "chunk", "example"];

/** Supports made safe: only known ones, once each, in the order they are listed. */
export const cleanSupports = (raw: unknown): ScaffoldSupport[] => {
  const asked = new Set(Array.isArray(raw) ? raw : []);
  return SCAFFOLD_SUPPORTS.filter((s) => asked.has(s.id)).map((s) => s.id);
};
/** The supports as the AI is told them. */
export const supportWords = (ids: unknown): string[] => cleanSupports(ids).map((id) => SCAFFOLD_SUPPORTS.find((s) => s.id === id)!.ai);

/** What the scaffold is called: it starts with "Scaffolded", so the note can count them. */
export const scaffoldName = (title: string): string => `Scaffolded: ${line(title, 120) || "worksheet"}`;

/**
 * A blank scaffold for the teacher to fill in by hand (and change in the worksheet editor). It has the same supports the AI
 * is asked for: key words, a worked example, a guided try with frames, then a few to do alone.
 */
export function blankScaffold(opts: { title: string; supports: unknown; words?: string[]; subject?: string; grade?: string }): GenWorksheet {
  const supports = new Set(cleanSupports(opts.supports));
  const words = (opts.words || []).map((w) => line(w, 60)).filter(Boolean);
  const sections: WorksheetSection[] = [];
  const mark = (text: string): WorksheetItem => ({ prompt: text, kind: "work", answer: "", space: "small" });
  if (supports.has("wordbank")) {
    sections.push({
      heading: "Key words", directions: "These words will help you. Look back at them as you work.",
      wordBank: words.length ? words.slice(0, 12) : ["[key word 1]", "[key word 2]", "[key word 3]", "[key word 4]"],
      items: [{ prompt: "Say each word out loud. Which one are you not sure about? Circle it.", kind: "short", answer: "", lines: 1 }],
    });
  }
  if (supports.has("example")) {
    sections.push({
      heading: "Watch how it is done", directions: "Read the example. Each step is shown.",
      items: [{ prompt: "[Type a worked example here, one step per line.]", kind: "work", answer: "", space: "small" }],
    });
  }
  const guided: WorksheetItem[] = supports.has("frames")
    ? [{ prompt: "The first thing I do is ______.", kind: "blank", answer: "" }, { prompt: "Then I ______.", kind: "blank", answer: "" }, { prompt: "My answer is ______ because ______.", kind: "blank", answer: "" }]
    : [mark("[Type the first guided question.]"), mark("[Type the second guided question.]")];
  sections.push({ heading: supports.has("chunk") ? "Step by step, with help" : "Try it with help", directions: supports.has("chunk") ? "Do one step at a time. Stop and check after each step." : "Use the help to get started.", items: guided });
  const count = supports.has("fewer") ? 3 : 5;
  const own: WorksheetItem[] = Array.from({ length: count }, (_v, i) => (supports.has("choices")
    ? { prompt: `[Question ${i + 1}]`, kind: "choice", choices: ["[choice A]", "[choice B]", "[choice C]"], answer: "" }
    : { prompt: `[Question ${i + 1}]`, kind: "work", answer: "", space: supports.has("space") ? "large" : "medium" }) as WorksheetItem);
  sections.push({ heading: "Your turn", directions: "You can do this. Use your words and your steps.", items: own });
  const ws = cleanWorksheet({
    title: scaffoldName(opts.title), instructions: "Name: ____________________    Date: ______________",
    sections, large: supports.has("simple"), grade: opts.grade, subject: opts.subject,
  });
  return ws as GenWorksheet;
}

/** Key words picked out of the lesson's text: the capitalised or repeated words are not guessed; only a "Vocabulary:" line is read. */
export function wordsFrom(taught: string): string[] {
  const m = /(?:^|\n)\s*(?:vocab(?:ulary)?|key words?|words?)\s*[:\-–]\s*([^\n]+)/i.exec(taught || "");
  if (!m) return [];
  return m[1].split(/[,;]+/).map((w) => line(w, 60)).filter(Boolean).slice(0, 12);
}
