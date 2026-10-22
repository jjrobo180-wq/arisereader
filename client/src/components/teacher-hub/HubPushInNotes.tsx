// Arise WorkHub: push-in class notes, the "Class notes" look on the minutes page.
// For each class (a block, a half of it, whose class it is) the teacher keeps a note per lesson: what the class's
// teacher taught, the materials (PDFs, handouts, links, worksheets), a line for each student, and scaffolded work
// made by hand or with AI. A note saves itself as it is written. The rules are in shared/pushIn.ts.
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { BookOpen, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Layers, Loader2, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { blockName, schoolBlocks } from "@shared/hubBlocks";
import { friendlyDate } from "@shared/hubDates";
import { MINUTE_SUBJECTS } from "@shared/hubSubjects";
import type { ClassGroup } from "@shared/hubClassMinutes";
import { cleanDriveFiles } from "@shared/driveApp";
import { CHECKS, CHECK_LABEL, GRADES, addDays, schoolWeek, type LessonCheck, type LessonMaterial } from "@shared/lessonPlanner";
import {
  DEFAULT_SUPPORTS, SCAFFOLD_SUPPORTS, blankScaffold, classRoster, cleanPushInNotes, entryOf, fold, isBlank, moveNote, newNote, noteFacts, noteKey,
  noteMatches, noteRoster, notesBytes, notesForStudent, notesFull, orphanNotes, PUSH_IN_LIMITS, removeNote, scaffoldName, sortNotes, studentNames,
  upsertNote, withEntry, withMaterials, wordsFrom, type PushInNote, type ScaffoldSupport,
} from "@shared/pushIn";
import type { Workspace } from "@shared/teacherHub";
import { Empty, Field, GhostButton, Labeled, PrimaryButton, Select, TextArea } from "./ui";
import { HubModal } from "./HubModal";
import { useClassGroups } from "./HubClassMinutes";
import { MaterialSlots, aiBtn, askLessonAi, smallBtn } from "./HubLessonParts";

type Setter = Dispatch<SetStateAction<Workspace>>;

const STATUS_STYLE: Record<LessonCheck, { on: string; dot: string }> = {
  mastered: { on: "border-emerald-600 bg-emerald-600 text-white", dot: "bg-emerald-500" },
  good: { on: "border-teal-600 bg-teal-600 text-white", dot: "bg-teal-500" },
  reteach: { on: "border-amber-500 bg-amber-500 text-slate-950", dot: "bg-amber-500" },
  absent: { on: "border-slate-500 bg-slate-500 text-white", dot: "bg-slate-400" },
};
const chip = (on: boolean) => `inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm font-semibold transition ${on ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;

/** "Block 2 · 1st half · Ms. Lee". */
const classTitle = (g: Pick<ClassGroup, "title" | "label">) => [g.title, g.label].filter(Boolean).join(" · ");

/** The date as a notebook margin: weekday over day of the month. */
function Margin({ date }: { date: string }) {
  const d = new Date(`${date}T00:00:00Z`);
  const ok = !Number.isNaN(d.getTime());
  return (
    <div className="w-12 shrink-0 text-center leading-none" aria-hidden>
      <div className="text-[11px] font-bold text-slate-500">{ok ? d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }) : ""}</div>
      <div className="mt-1 text-2xl font-extrabold tabular-nums text-slate-950">{ok ? d.getUTCDate() : ""}</div>
      <div className="mt-1 text-[11px] font-semibold text-slate-500">{ok ? d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) : ""}</div>
    </div>
  );
}

function StatusDot({ status }: { status?: LessonCheck }) {
  return status ? <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_STYLE[status].dot}`} title={CHECK_LABEL[status]} /> : null;
}

// ─── The look ───────────────────────────────────────────────────────────────

export function PushInNotesView({ workspace, setWorkspace, makeId, today, token, classKey, onClassKey }: {
  workspace: Workspace; setWorkspace: Setter; makeId: () => string; today: string; token: string | null;
  /** The class shown: its key, or "" for every class. */
  classKey: string; onClassKey: (key: string) => void;
}) {
  const blocks = useMemo(() => schoolBlocks(workspace), [workspace.minuteBlocks]);
  /** By day: one day's classes, each with its notes. By class: every note of a class, newest first. */
  const [view, setViewState] = useState<"day" | "class">(() => (classKey ? "class" : readView()));
  const setView = (v: "day" | "class") => { setViewState(v); try { localStorage.setItem("arise-hub-notes-view", v); } catch { /* the choice just isn't remembered */ } };
  // A class card's "Class notes" button asks for that class.
  useEffect(() => { if (classKey) setViewState("class"); }, [classKey]);
  /** The day shown in By day. */
  const [day, setDay] = useState(today);
  const when = view === "day" ? day : today;
  const groups = useClassGroups(workspace, when);
  const notes = useMemo(() => sortNotes(cleanPushInNotes(workspace.pushInNotes), blocks), [workspace.pushInNotes, blocks]);
  const [student, setStudent] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<{ note: PushInNote; isNew: boolean } | null>(null);
  const [choosing, setChoosing] = useState(false);

  const keys = useMemo(() => new Set(groups.map((g) => g.key)), [groups]);
  const lost = useMemo(() => orphanNotes(notes, keys, blocks), [notes, keys, blocks]);
  const group = groups.find((g) => g.key === classKey);
  const names = useMemo(() => studentNames(notes, groups), [notes, groups]);
  const who = names.find((n) => fold(n) === fold(student)) || "";
  const full = notesFull(notes);

  const inClass = (n: PushInNote) => !classKey || (classKey === "__lost" ? lost.includes(n) : noteKey(n, blocks) === classKey);
  const shown = notes.filter((n) => inClass(n) && noteMatches(n, query, blocks) && (!who || n.students.some((s) => fold(s.student) === fold(who))));

  function start(g: ClassGroup) {
    setChoosing(false);
    setOpen({ note: newNote(g, when, makeId(), new Date().toISOString()), isNew: true });
  }
  const newHere = () => (view === "class" && group ? start(group) : groups.length === 1 ? start(groups[0]) : setChoosing(true));

  return (
    <div className="mt-3 space-y-4" data-testid="pushin-notes">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-xl text-sm text-slate-600">Write down what the class's teacher taught, keep the PDFs and handouts, note how each student did, and make scaffolded work. Notes sit with the class they belong to.</p>
          <span data-testid="pushin-new"><PrimaryButton onClick={newHere} disabled={!groups.length || full}><Plus className="h-4 w-4" /> New note</PrimaryButton></span>
        </div>
        {full && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">Class notes are full ({notes.length} notes, {(notesBytes(notes) / 1_000_000).toFixed(1)} MB). Delete old notes or their AI worksheets to add more.</p>}
        {!full && notesBytes(notes) > PUSH_IN_LIMITS.bytes * 0.8 && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">Class notes are almost full. Delete old notes or their AI worksheets to make room.</p>}

        <div role="tablist" aria-label="Notes by day or by class" className="mt-3 inline-flex gap-1 rounded-2xl bg-slate-100 p-1" data-testid="pushin-view">
          {([["day", "By day"], ["class", "By class"]] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`min-h-10 rounded-xl px-4 text-sm font-semibold ${view === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>{label}</button>
          ))}
        </div>

        {view === "class" && groups.length > 0 && (
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Class" data-testid="pushin-classes">
            <button type="button" role="tab" aria-selected={!classKey} className={chip(!classKey) + " shrink-0"} onClick={() => onClassKey("")}>All classes</button>
            {groups.map((g) => {
              const n = notes.filter((x) => noteKey(x, blocks) === g.key).length;
              return <button key={g.key} type="button" role="tab" aria-selected={classKey === g.key} className={chip(classKey === g.key) + " shrink-0"} onClick={() => onClassKey(g.key)} data-testid="pushin-class-chip">{classTitle(g)}{n > 0 && <span className={`ml-2 rounded-full px-1.5 text-xs ${classKey === g.key ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>{n}</span>}</button>;
            })}
            {lost.length > 0 && <button type="button" role="tab" aria-selected={classKey === "__lost"} className={chip(classKey === "__lost") + " shrink-0"} onClick={() => onClassKey("__lost")}>Other classes<span className={`ml-2 rounded-full px-1.5 text-xs ${classKey === "__lost" ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>{lost.length}</span></button>}
          </div>
        )}

        {view === "class" && notes.length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="relative block">
              <span className="sr-only">Search the notes</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Field value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search lessons, files, students" className="!pl-9" aria-label="Search the notes" />
            </label>
            <Select value={who} onChange={(e) => setStudent(e.target.value)} aria-label="Show one student" data-testid="pushin-student">
              <option value="">Every student</option>
              {names.map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </div>
        )}
      </div>

      {view === "day" ? (
        !groups.length && !notes.length ? <Empty>No classes yet. Give each student's required minutes a block (and, for push-in, whose class it is) with “Set required minutes” or “Add several students”, and each class gets its own notes here.</Empty>
        : <DayView notes={notes} groups={groups} blocks={blocks} day={day} today={today} full={full} onDay={setDay} onOpen={(n) => setOpen({ note: n, isNew: false })} onAdd={start} />
      ) : (
        <>
      {!groups.length && !notes.length && <Empty>No classes yet. Give each student's required minutes a block (and, for push-in, whose class it is) with “Set required minutes” or “Add several students”, and each class gets its own notes here.</Empty>}
      {groups.length > 0 && !notes.length && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
          <BookOpen className="mx-auto h-7 w-7 text-slate-400" aria-hidden />
          <p className="mt-2 text-base font-semibold text-slate-900">No class notes yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">Pick a class and write what the teacher taught today. Add the PDF or handout, a line for each student, and scaffolded work if anyone needs it.</p>
          <div className="mt-4 flex justify-center"><PrimaryButton onClick={newHere}><Plus className="h-4 w-4" /> Write the first note</PrimaryButton></div>
        </div>
      )}
      {notes.length > 0 && !shown.length && <Empty>No notes match{who ? ` for ${who}` : ""}{query ? ` “${query}”` : ""}.</Empty>}

      {who ? <StudentList notes={shown} student={who} blocks={blocks} today={today} onOpen={(n) => setOpen({ note: n, isNew: false })} /> : (
        <NoteList notes={shown} groups={groups} blocks={blocks} today={today} flat={!!classKey} onOpen={(n) => setOpen({ note: n, isNew: false })} />
      )}
        </>
      )}

      {choosing && (
        <HubModal title="Which class is the note for?" size="sm" onClose={() => setChoosing(false)}>
          <ul className="space-y-2" data-testid="pushin-choose">
            {groups.map((g) => (
              <li key={g.key}><button type="button" onClick={() => start(g)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-left hover:border-slate-400">
                <span className="min-w-0"><span className="block truncate text-base font-bold text-slate-950">{g.title}</span>{g.label && <span className="block truncate text-sm text-slate-600">{g.label}</span>}</span>
                <span className="shrink-0 text-xs font-semibold text-slate-500">{g.students.length} {g.students.length === 1 ? "student" : "students"}</span>
              </button></li>
            ))}
          </ul>
        </HubModal>
      )}
      {open && <NoteEditor key={open.note.id} workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} today={today} token={token} groups={groups} blocks={blocks} start={open.note} isNew={open.isNew} count={notes.length} onClose={() => setOpen(null)} />}
    </div>
  );
}

const readView = (): "day" | "class" => { try { return localStorage.getItem("arise-hub-notes-view") === "class" ? "class" : "day"; } catch { return "day"; } };

/** One day: a week strip to pick the day, then every class of the day in the order of the block, each with its notes and a button to add one. */
function DayView({ notes, groups, blocks, day, today, full, onDay, onOpen, onAdd }: {
  notes: PushInNote[]; groups: ClassGroup[]; blocks: ReturnType<typeof schoolBlocks>; day: string; today: string; full: boolean;
  onDay: (d: string) => void; onOpen: (n: PushInNote) => void; onAdd: (g: ClassGroup) => void;
}) {
  const week = schoolWeek(day);
  const inDay = notes.filter((n) => n.date === day);
  const keys = new Set(groups.map((g) => g.key));
  const rest = inDay.filter((n) => !keys.has(noteKey(n, blocks)));
  const heading = new Date(`${day}T00:00:00Z`);
  return (
    <div className="space-y-4" data-testid="pushin-day">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-xl font-extrabold text-slate-950" data-testid="pushin-day-title">{Number.isNaN(heading.getTime()) ? day : heading.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}</h3>
            <p className="text-sm text-slate-600">{day === today ? "Today" : friendlyDate(day, today)} · {inDay.length === 0 ? "no notes yet" : `${inDay.length} ${inDay.length === 1 ? "note" : "notes"}`}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" className={smallBtn + " min-h-11 min-w-11"} onClick={() => onDay(addDays(day, -7))} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" className={smallBtn + " min-h-11 px-3 text-sm"} onClick={() => onDay(today)} disabled={day === today} data-testid="pushin-today">Today</button>
            <button type="button" className={smallBtn + " min-h-11 min-w-11"} onClick={() => onDay(addDays(day, 7))} aria-label="Next week"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1.5" role="tablist" aria-label="Day of the week" data-testid="pushin-week">
          {week.map((d) => {
            const x = new Date(`${d}T00:00:00Z`);
            const count = notes.filter((n) => n.date === d).length;
            const on = d === day;
            return (
              <button key={d} type="button" role="tab" aria-selected={on} onClick={() => onDay(d)} data-day={d}
                className={`flex min-h-14 flex-col items-center justify-center rounded-2xl border px-1 py-1.5 text-center transition ${on ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"}`}>
                <span className={`text-[11px] font-bold ${on ? "text-white/80" : "text-slate-500"}`}>{x.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</span>
                <span className="text-lg font-extrabold leading-tight tabular-nums">{x.getUTCDate()}</span>
                <span className={`h-1.5 w-1.5 rounded-full ${count ? (on ? "bg-white" : "bg-teal-600") : "bg-transparent"}`} aria-label={count ? `${count} ${count === 1 ? "note" : "notes"}` : undefined} />
              </button>
            );
          })}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-600"><CalendarDays className="h-4 w-4" aria-hidden /> Go to a day
          <Field type="date" value={day} onChange={(e) => onDay(e.target.value || today)} aria-label="Go to a day" className="!w-auto" /></label>
      </div>

      {groups.map((g) => {
        const mine = inDay.filter((n) => noteKey(n, blocks) === g.key);
        const logged = g.students.filter((s) => s.logged > 0).length;
        const away = g.students.filter((s) => s.notMet).length;
        const minutes = [logged ? `${logged} of ${g.students.length} logged` : "", away ? `${away} did not meet` : ""].filter(Boolean).join(" · ") || "no minutes logged";
        return (
          <section key={g.key} aria-label={classTitle(g)} data-testid="pushin-day-class" className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-slate-100 px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-2"><h4 className="text-base font-extrabold text-slate-950">{g.title}</h4>{g.label && <span className="text-sm font-medium text-slate-600">{g.label}</span>}</div>
              <span className="text-xs text-slate-500">{g.students.length} {g.students.length === 1 ? "student" : "students"} · {minutes}</span>
            </div>
            {mine.length > 0 && <ul className="divide-y divide-slate-100">{mine.map((n) => <NoteRow key={n.id} note={n} blocks={blocks} today={today} showClass={false} bare onOpen={onOpen} />)}</ul>}
            <div className="px-4 py-3">
              <button type="button" onClick={() => onAdd(g)} disabled={full} data-testid="pushin-day-add"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:bg-slate-50 disabled:opacity-50">
                <Plus className="h-4 w-4" aria-hidden /> {mine.length ? "Add another note" : "Add a note for this class"}
              </button>
            </div>
          </section>
        );
      })}
      {rest.length > 0 && (
        <section aria-label="Other classes" className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" data-testid="pushin-day-class">
          <div className="border-b border-slate-100 px-4 py-3"><h4 className="text-base font-extrabold text-slate-950">Other classes</h4><p className="text-xs text-slate-500">Not in the minutes any more</p></div>
          <ul className="divide-y divide-slate-100">{rest.map((n) => <NoteRow key={n.id} note={n} blocks={blocks} today={today} showClass bare onOpen={onOpen} />)}</ul>
        </section>
      )}
      {!groups.length && !rest.length && <Empty>No classes yet.</Empty>}
    </div>
  );
}

/** The notes, a class at a time in the order of the day, each as a line of the notebook. */
function NoteList({ notes, groups, blocks, today, flat, onOpen }: { notes: PushInNote[]; groups: ClassGroup[]; blocks: ReturnType<typeof schoolBlocks>; today: string; flat: boolean; onOpen: (n: PushInNote) => void }) {
  const sections = useMemo(() => {
    const out: { key: string; title: string; label: string; notes: PushInNote[] }[] = [];
    for (const g of groups) { const mine = notes.filter((n) => noteKey(n, blocks) === g.key); if (mine.length) out.push({ key: g.key, title: g.title, label: g.label, notes: mine }); }
    const keys = new Set(groups.map((g) => g.key));
    const rest = notes.filter((n) => !keys.has(noteKey(n, blocks)));
    if (rest.length) out.push({ key: "__lost", title: "Other classes", label: "Not in the minutes any more", notes: rest });
    return out;
  }, [notes, groups, blocks]);
  return (
    <div className="space-y-5">
      {sections.map((s) => (
        <section key={s.key} aria-label={classTitle(s)} data-testid="pushin-section">
          {!flat && (
            <div className="mb-2 flex items-baseline gap-2 px-1">
              <h3 className="text-base font-extrabold text-slate-950">{s.title}</h3>
              {s.label && <span className="text-sm font-medium text-slate-600">{s.label}</span>}
            </div>
          )}
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            {s.notes.map((n) => <NoteRow key={n.id} note={n} blocks={blocks} today={today} showClass={flat && s.key === "__lost"} onOpen={onOpen} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}

function NoteRow({ note, blocks, today, showClass, bare = false, onOpen }: { note: PushInNote; blocks: ReturnType<typeof schoolBlocks>; today: string; showClass: boolean; /** In a day: no date margin, and the files are named. */ bare?: boolean; onOpen: (n: PushInNote) => void }) {
  const facts = noteFacts(note);
  const flagged = note.students.filter((s) => s.status === "reteach").length;
  return (
    <li>
      <button type="button" onClick={() => onOpen(note)} data-testid="pushin-note" className="flex w-full items-start gap-4 px-4 py-4 text-left transition hover:bg-slate-50">
        {!bare && <Margin date={note.date} />}
        <span className={`min-w-0 flex-1 ${bare ? "" : "border-l-2 border-slate-100 pl-4"}`}>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-base font-bold text-slate-950">{note.title || "Untitled lesson"}</span>
            {note.subject && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{note.subject}</span>}
            {flagged > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">{flagged} to reteach</span>}
          </span>
          {showClass && <span className="block text-xs text-slate-500">{[blockName(blocks, note.block), note.teacher].filter(Boolean).join(" · ") || "No class"}</span>}
          <span className="mt-1 block text-xs text-slate-500">{bare ? facts.join(" · ") : `${friendlyDate(note.date, today)}${facts.length ? ` · ${facts.join(" · ")}` : ""}`}</span>
          {note.taught && <span className="mt-1.5 line-clamp-2 block text-sm text-slate-700">{note.taught}</span>}
          {bare && note.materials.some((m) => m.kind !== "answerKey") && (
            <span className="mt-2 flex flex-wrap gap-1.5" data-testid="pushin-day-files">
              {note.materials.filter((m) => m.kind !== "answerKey").slice(0, 6).map((m) => <span key={m.id} className="max-w-[14rem] truncate rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{m.name}</span>)}
            </span>
          )}
          {bare && note.students.length > 0 && (
            <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              {note.students.slice(0, 8).map((s) => <span key={s.student} className="inline-flex items-center gap-1.5"><StatusDot status={s.status} />{s.student}</span>)}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

/** One student across the notes: each lesson they were in, what was written about them, and the scaffolded work they were given. */
function StudentList({ notes, student, blocks, today, onOpen }: { notes: PushInNote[]; student: string; blocks: ReturnType<typeof schoolBlocks>; today: string; onOpen: (n: PushInNote) => void }) {
  const rows = notesForStudent(notes, student);
  return (
    <section aria-label={`${student}'s notes`} data-testid="pushin-student-list">
      <h3 className="mb-2 px-1 text-base font-extrabold text-slate-950">{student}</h3>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {rows.map(({ note, entry }) => {
          const given = (entry.materialIds || []).map((id) => note.materials.find((m) => m.id === id)?.name).filter(Boolean);
          return (
            <li key={note.id}>
              <button type="button" onClick={() => onOpen(note)} data-testid="pushin-student-row" className="flex w-full items-start gap-4 px-4 py-4 text-left transition hover:bg-slate-50">
                <Margin date={note.date} />
                <span className="min-w-0 flex-1 border-l-2 border-slate-100 pl-4">
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusDot status={entry.status} />
                    <span className="text-base font-bold text-slate-950">{note.title || "Untitled lesson"}</span>
                    {entry.status && <span className="text-xs font-semibold text-slate-600">{CHECK_LABEL[entry.status]}</span>}
                  </span>
                  <span className="block text-xs text-slate-500">{friendlyDate(note.date, today)} · {[blockName(blocks, note.block), note.teacher].filter(Boolean).join(" · ") || "No class"}</span>
                  {entry.note && <span className="mt-1.5 block text-sm text-slate-800">{entry.note}</span>}
                  {entry.support && <span className="mt-1 block text-sm text-slate-600">Help: {entry.support}</span>}
                  {given.length > 0 && <span className="mt-1 block text-sm font-medium text-violet-800">Given: {given.join(", ")}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ─── Writing a note ─────────────────────────────────────────────────────────

function NoteEditor({ workspace, setWorkspace, makeId, today, token, groups, blocks, start, isNew, count, onClose }: {
  workspace: Workspace; setWorkspace: Setter; makeId: () => string; today: string; token: string | null; groups: ClassGroup[];
  blocks: ReturnType<typeof schoolBlocks>; start: PushInNote; isNew: boolean; count: number; onClose: () => void;
}) {
  const [draft, setDraft] = useState<PushInNote>(start);
  const [said, setSaid] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scaffolding, setScaffolding] = useState(false);
  // The note saves itself a moment after each change; closing saves right away. A new note nobody wrote in is not kept.
  const latest = useRef(draft);
  const kept = useRef<PushInNote | null>(isNew ? null : start);
  const gone = useRef(false);
  latest.current = draft;
  function flush() {
    const n = latest.current;
    if (gone.current || kept.current === n) return;
    if (!kept.current && isBlank(n)) return;
    kept.current = n;
    setWorkspace((w) => ({ ...w, pushInNotes: upsertNote(w.pushInNotes, n) }));
  }
  useEffect(() => { const t = setTimeout(flush, 350); return () => clearTimeout(t); }, [draft]);
  useEffect(() => () => flush(), []);
  useEffect(() => { if (!said) return; const t = setTimeout(() => setSaid(""), 6000); return () => clearTimeout(t); }, [said]);

  const stamp = () => new Date().toISOString();
  const edit = (change: Partial<PushInNote>) => setDraft((d) => ({ ...d, ...change, updatedAt: stamp() }));
  const key = noteKey(draft, blocks);
  // The class as it was on the day of the note, so each student shows what was logged for them that day.
  const dayGroups = useClassGroups(workspace, draft.date);
  const group = dayGroups.find((g) => g.key === key) || groups.find((g) => g.key === key);
  const roster = noteRoster(draft, group);
  const drive = useMemo(() => cleanDriveFiles((workspace as any).drive), [(workspace as any).drive]);
  const className = group ? classTitle(group) : [blockName(blocks, draft.block), draft.teacher].filter(Boolean).join(" · ");
  const worksheets = draft.materials.filter((m) => m.kind === "worksheet");

  function close() { flush(); onClose(); }

  async function remove() {
    gone.current = true;
    setWorkspace((w) => ({ ...w, pushInNotes: removeNote(w.pushInNotes, draft.id) }));
    await Promise.allSettled(draft.materials.filter((m) => m.path && token).map((m) => fetch(`${API_BASE}/api/lifehub/drive/delete`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ path: m.path }) })));
    onClose();
  }

  const setMaterials = (files: LessonMaterial[]) => setDraft((d) => withMaterials(d, files, stamp()));
  const setStudent = (name: string, change: Partial<ReturnType<typeof entryOf>>) => setDraft((d) => withEntry(d, name, change, stamp()));
  const aiContext = () => ({ grade: "", subject: draft.subject, topic: draft.title || draft.taught.slice(0, 120), notes: draft.taught });

  const classOptions = group || !draft.block && !draft.teacher ? groups : [...groups, { key, title: blockName(blocks, draft.block) || "No block", label: [draft.teacher].filter(Boolean).join(" · ") } as ClassGroup];

  return (
    <HubModal title={isNew ? "New class note" : "Class note"} size="lg" onClose={close}
      footer={(
        <div className="flex flex-wrap items-center gap-2">
          <span data-testid="pushin-done"><PrimaryButton onClick={close}>Done</PrimaryButton></span>
          <span className="text-xs text-slate-500" role="status" data-testid="pushin-said">{said || "Saves as you write."}</span>
          {!isNew || kept.current ? (
            confirmDelete ? (
              <span className="ml-auto flex items-center gap-2"><span className="text-sm text-slate-700">Delete this note{draft.materials.some((m) => m.path) ? " and its uploaded files" : ""}?</span><button type="button" onClick={() => void remove()} className="min-h-10 rounded-xl bg-rose-600 px-3 text-sm font-semibold text-white" data-testid="pushin-delete-yes">Delete</button><GhostButton onClick={() => setConfirmDelete(false)}>Keep</GhostButton></span>
            ) : <button type="button" onClick={() => setConfirmDelete(true)} className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-700" data-testid="pushin-delete"><Trash2 className="h-4 w-4" /> Delete note</button>
          ) : null}
        </div>
      )}>
      <div className="grid grid-cols-1 gap-5" data-testid="pushin-editor">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Labeled label="Class">
            <Select value={key} onChange={(e) => { const g = groups.find((x) => x.key === e.target.value); if (g) setDraft((d) => moveNote(d, g, stamp())); }} aria-label="Class" data-testid="pushin-class">
              {classOptions.map((g) => <option key={g.key} value={g.key}>{classTitle(g)}</option>)}
            </Select>
          </Labeled>
          <Labeled label="Day"><Field type="date" value={draft.date} onChange={(e) => edit({ date: e.target.value || today })} aria-label="Day" /></Labeled>
          <Labeled label="Subject">
            <Select value={draft.subject} onChange={(e) => edit({ subject: e.target.value })} aria-label="Subject">
              <option value="">No subject</option>
              {MINUTE_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Labeled>
        </div>

        <Labeled label="The lesson"><Field value={draft.title} maxLength={PUSH_IN_LIMITS.title} onChange={(e) => edit({ title: e.target.value })} placeholder="What was the lesson? (Adding fractions with unlike denominators)" aria-label="The lesson" data-autofocus data-testid="pushin-title" /></Labeled>

        <Labeled label="What the teacher taught">
          <TextArea value={draft.taught} maxLength={PUSH_IN_LIMITS.taught} onChange={(e) => edit({ taught: e.target.value })} rows={6} className="min-h-36" aria-label="What the teacher taught" data-testid="pushin-taught"
            placeholder={"The steps, the examples, the questions the class was asked, what the teacher said to watch for.\nVocabulary: numerator, denominator, equivalent"} />
        </Labeled>

        <section aria-label="Materials" className="space-y-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-950">Materials</h3>
            <p className="text-sm text-slate-600">Upload the teacher's PDFs, handouts and slides, or paste a link. They are kept with this class and day.</p>
          </div>
          <MaterialSlots token={token} files={draft.materials} onChange={setMaterials} makeId={makeId} drive={drive} lessonTitle={draft.title || "Class note"} color="violet" className={className} aiContext={aiContext} say={setSaid} />
        </section>

        <section aria-label="Scaffolded work" className="rounded-3xl border border-violet-200 bg-violet-50/60 p-4" data-testid="pushin-scaffold">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 max-w-lg">
              <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-950"><Layers className="h-4 w-4 text-violet-700" aria-hidden /> Scaffolded work</h3>
              <p className="mt-0.5 text-sm text-slate-700">The same lesson with a way in: word banks, sentence frames, a worked example, smaller steps. Make it with AI, or start a blank one and fill it in yourself.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={aiBtn} onClick={() => setScaffolding((v) => !v)} aria-expanded={scaffolding} data-testid="pushin-scaffold-ai"><Sparkles className="h-4 w-4" /> Make with AI</button>
              <button type="button" className={smallBtn + " min-h-10 px-3 text-sm"} data-testid="pushin-scaffold-blank" onClick={() => {
                const ws = blankScaffold({ title: draft.title, supports: DEFAULT_SUPPORTS, words: wordsFrom(draft.taught), subject: draft.subject });
                const pair = makeId(), at = stamp();
                const sheet: LessonMaterial = { id: makeId(), kind: "worksheet", name: ws.title, worksheet: ws, addedAt: at, pair };
                setDraft((d) => withMaterials(d, [...d.materials, sheet, { id: makeId(), kind: "answerKey", name: `${ws.title} — answer key`, worksheet: ws, addedAt: at, pair }], at));
                setSaid("Blank scaffold added to Worksheets. Tap “View & edit” to fill it in.");
              }}>Start a blank scaffold</button>
            </div>
          </div>
          {scaffolding && <ScaffoldMaker token={token} draft={draft} roster={roster} makeId={makeId} onDone={(materials, to, message) => {
            setDraft((d) => { let next = withMaterials(d, [...d.materials, ...materials], stamp()); const sheet = materials.find((m) => m.kind === "worksheet"); if (sheet) for (const name of to) next = withEntry(next, name, { materialIds: [...new Set([...(entryOf(next, name).materialIds || []), sheet.id])] }, stamp()); return next; });
            setSaid(message); setScaffolding(false);
          }} />}
        </section>

        <section aria-label="Students" className="space-y-3" data-testid="pushin-students">
          <div>
            <h3 className="text-base font-extrabold text-slate-950">Students</h3>
            <p className="text-sm text-slate-600">{group ? `Everyone in ${classTitle(group)}. ` : ""}Only students you write something for are kept.</p>
          </div>
          {!roster.length && <Empty>No students in this class yet.</Empty>}
          <ul className="space-y-2">
            {roster.map((name) => <StudentRow key={name} name={name} minutes={minutesText(group, name)} entry={entryOf(draft, name)} inClass={!!group && classRoster(group).some((n) => fold(n) === fold(name))} worksheets={worksheets} onChange={(c) => setStudent(name, c)} />)}
          </ul>
        </section>

        <Labeled label="Follow up"><TextArea value={draft.followUp || ""} maxLength={PUSH_IN_LIMITS.note} onChange={(e) => edit({ followUp: e.target.value })} rows={3} aria-label="Follow up" placeholder="What to do next time: reteach a step, check in with someone, bring a different example." /></Labeled>
        {count >= PUSH_IN_LIMITS.notes - 25 && <p className="text-xs text-amber-800">You are near the limit of {PUSH_IN_LIMITS.notes} class notes.</p>}
      </div>
    </HubModal>
  );
}

/** What was logged for a student on the note's day: "30 min logged", "Did not meet", or nothing. */
function minutesText(group: ClassGroup | undefined, name: string): string {
  const mine = (group?.students || []).filter((s) => fold(s.student) === fold(name));
  const logged = mine.reduce((n, s) => n + s.logged, 0);
  return logged > 0 ? `${logged} min logged` : mine.some((s) => s.notMet) ? "Did not meet" : "";
}

function StudentRow({ name, minutes, entry, inClass, worksheets, onChange }: {
  name: string; minutes: string; entry: ReturnType<typeof entryOf>; inClass: boolean; worksheets: LessonMaterial[]; onChange: (c: Partial<ReturnType<typeof entryOf>>) => void;
}) {
  const [more, setMore] = useState(false);
  const showMore = more || !!entry.support || !!entry.materialIds?.length;
  const given = new Set(entry.materialIds || []);
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3" data-testid="pushin-student-entry" data-student={name}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-[6rem] text-base font-bold text-slate-950">{name}{!inClass && <span className="ml-2 text-xs font-medium text-slate-500">not in this class</span>}{minutes && <span className="ml-2 text-xs font-medium text-slate-500" data-testid="pushin-minutes">{minutes}</span>}</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`How ${name} did`}>
          {CHECKS.map((c) => {
            const on = entry.status === c;
            return <button key={c} type="button" aria-pressed={on} onClick={() => onChange({ status: on ? undefined : c })} data-status={c}
              className={`inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold transition ${on ? STATUS_STYLE[c].on : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{CHECK_LABEL[c]}</button>;
          })}
        </div>
      </div>
      <TextArea value={entry.note || ""} maxLength={PUSH_IN_LIMITS.note} onChange={(e) => onChange({ note: e.target.value })} rows={2} className="mt-2 !min-h-[3.25rem]" aria-label={`Note about ${name}`} placeholder={`What ${name} did, said or needed`} data-testid="pushin-student-note" />
      {showMore ? (
        <div className="mt-2 space-y-2">
          <Field value={entry.support || ""} maxLength={PUSH_IN_LIMITS.support} onChange={(e) => onChange({ support: e.target.value })} aria-label={`Help given to ${name}`} placeholder="Help given: sentence frames, re-read the problem, a smaller job" />
          {worksheets.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Work given to ${name}`}>
              <span className="text-xs font-semibold text-slate-600">Work given</span>
              {worksheets.map((m) => {
                const on = given.has(m.id);
                return <button key={m.id} type="button" aria-pressed={on} onClick={() => onChange({ materialIds: on ? [...given].filter((x) => x !== m.id) : [...given, m.id] })} data-testid="pushin-give"
                  className={`inline-flex min-h-9 max-w-full items-center rounded-full border px-3 text-xs font-semibold transition ${on ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}><span className="truncate">{m.name}</span></button>;
              })}
            </div>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setMore(true)} className="mt-1 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950"><ChevronDown className="h-3.5 w-3.5" aria-hidden /> Help given and work given</button>
      )}
    </li>
  );
}

// ─── Scaffolded work made with AI ───────────────────────────────────────────

function ScaffoldMaker({ token, draft, roster, makeId, onDone }: {
  token: string | null; draft: PushInNote; roster: string[]; makeId: () => string;
  onDone: (materials: LessonMaterial[], to: string[], message: string) => void;
}) {
  const [supports, setSupports] = useState<ScaffoldSupport[]>(DEFAULT_SUPPORTS);
  const [kind, setKind] = useState("practice worksheet");
  const [count, setCount] = useState(8);
  const [grade, setGrade] = useState("");
  const [to, setTo] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hasText = !!(draft.title.trim() || draft.taught.trim());

  async function make() {
    setError(""); setBusy(true);
    try {
      const data = await askLessonAi(token, { mode: "scaffold", subject: draft.subject, grade, topic: draft.title || draft.taught.slice(0, 120), notes: draft.taught, kind, count, supports });
      const ws = { ...data.worksheet, title: draft.title ? `Scaffolded: ${draft.title}` : scaffoldName(data.worksheet.title) };
      const pair = makeId(), at = new Date().toISOString();
      onDone([
        { id: makeId(), kind: "worksheet", name: ws.title, worksheet: ws, addedAt: at, pair },
        { id: makeId(), kind: "answerKey", name: `${ws.title} — answer key`, worksheet: ws, addedAt: at, pair },
      ], to, to.length ? `Scaffold and its answer key are ready, and given to ${to.length === 1 ? to[0] : `${to.length} students`}.` : "Scaffold and its answer key are ready, under Worksheets.");
    } catch (e: any) { setError(e.message || "The AI helper couldn't answer right now. Try again."); } finally { setBusy(false); }
  }

  return (
    <div className="mt-4 space-y-4 rounded-2xl bg-white p-4 ring-1 ring-violet-100" data-testid="pushin-scaffold-maker">
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold text-slate-900">What should it have?</legend>
        <div className="flex flex-wrap gap-1.5">
          {SCAFFOLD_SUPPORTS.map((s) => {
            const on = supports.includes(s.id);
            return <button key={s.id} type="button" aria-pressed={on} onClick={() => setSupports(on ? supports.filter((x) => x !== s.id) : [...supports, s.id])} data-support={s.id}
              className={`inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm font-semibold transition ${on ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{s.label}</button>;
          })}
        </div>
      </fieldset>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Labeled label="Kind"><Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind">
          {["practice worksheet", "exit ticket", "quiz", "word problems", "reading comprehension with a passage", "vocabulary practice", "graphic organizer"].map((k) => <option key={k}>{k}</option>)}
        </Select></Labeled>
        <Labeled label="Grade"><Select value={grade} onChange={(e) => setGrade(e.target.value)} aria-label="Grade">
          <option value="">Any grade</option>{GRADES.map((g) => <option key={g} value={g}>{g === "K" ? "Kindergarten" : `Grade ${g}`}</option>)}
        </Select></Labeled>
        <Labeled label="Questions"><Field type="number" min={3} max={12} value={count} onChange={(e) => setCount(Math.min(12, Math.max(3, Number(e.target.value) || 8)))} aria-label="Questions" /></Labeled>
      </div>
      {roster.length > 0 && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-slate-900">Give it to <span className="font-normal text-slate-500">(optional)</span></legend>
          <div className="flex flex-wrap gap-1.5">
            {roster.map((n) => { const on = to.includes(n); return <button key={n} type="button" aria-pressed={on} onClick={() => setTo(on ? to.filter((x) => x !== n) : [...to, n])} className={chip(on)} data-testid="pushin-scaffold-to">{n}</button>; })}
          </div>
        </fieldset>
      )}
      <p className="text-sm text-slate-600">The AI works from the lesson name and “What the teacher taught” above, so type or paste the part you want scaffolded there. It can't read uploaded PDFs. Student names are never sent.</p>
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void make()} disabled={busy || !hasText} className={aiBtn} data-testid="pushin-scaffold-make">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {busy ? "Writing the scaffold…" : "Make scaffold + answer key"}</button>
        {!hasText && <span className="text-sm text-amber-800">Name the lesson or write what was taught first.</span>}
      </div>
    </div>
  );
}
