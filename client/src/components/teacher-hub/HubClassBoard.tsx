// Arise WorkHub: the Main view of the Minutes page. One day's classes as cards; tap a class to open its page:
// mark each student's minutes (usual minutes, other minutes, absent), how each did and a note for each, a note for
// the class itself (the lesson, what was taught, follow up, with files and scaffolds one tap away), and add or take
// out students. The class notes are the push-in notes (shared/pushIn.ts); the minutes are the service logs.
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Check, ChevronLeft, ChevronRight, Clock, MoreHorizontal, NotebookPen, Paperclip, Pencil, Plus, Trash2, UserMinus, UserPlus, UserX, Users } from "lucide-react";
import { schoolBlocks } from "@shared/hubBlocks";
import { friendlyDate } from "@shared/hubDates";
import { countedPlan, optionalDays, planText, serviceStatus } from "@shared/hubProgress";
import { absentLog, classLogs, dayLogs, leaveClass, startPicks, studentLog, waiting, type ClassGroup, type ClassStudent } from "@shared/hubClassMinutes";
import { CHECKS, CHECK_LABEL, addDays, schoolWeek, type LessonCheck } from "@shared/lessonPlanner";
import { cleanPushInNotes, entryOf, isBlank, newNote, noteKey, notesFull, orphanNotes, PUSH_IN_LIMITS, sortNotes, upsertNote, withEntry, type PushInNote } from "@shared/pushIn";
import type { ServiceLog, Workspace } from "@shared/teacherHub";
import { Empty, TextArea } from "./ui";
import { useClassGroups } from "./HubClassMinutes";
import { NoteEditor } from "./HubPushInNotes";

type Setter = Dispatch<SetStateAction<Workspace>>;
export type BoardProps = {
  workspace: Workspace; setWorkspace: Setter; makeId: () => string; today: string; token: string | null;
  /** The log pop-up for one student, to type other minutes. */
  onOther: (from: { student: string; kind: string; date: string; block: string }) => void;
  onEditLog: (logId: string) => void;
  onEditPlan: (planId: string) => void;
  onAddStudents: (key: string) => void;
  onDeleteClass: (key: string) => void;
  /** Opens Edit, to set the first required minutes. */
  onSetup: () => void;
  say: (msg: string) => void;
};

const title = (g: Pick<ClassGroup, "title" | "label">) => [g.title, g.label].filter(Boolean).join(" · ");
const people = (n: number) => `${n} ${n === 1 ? "student" : "students"}`;
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
const TINTS = ["bg-teal-100 text-teal-800", "bg-violet-100 text-violet-800", "bg-sky-100 text-sky-800", "bg-amber-100 text-amber-900", "bg-rose-100 text-rose-800", "bg-emerald-100 text-emerald-800"];
const tint = (name: string) => TINTS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length];
const STATUS_ON: Record<LessonCheck, string> = {
  mastered: "border-emerald-600 bg-emerald-600 text-white",
  good: "border-teal-600 bg-teal-600 text-white",
  reteach: "border-amber-500 bg-amber-500 text-slate-950",
  absent: "border-slate-500 bg-slate-500 text-white",
};
const longDay = (d: string) => { const x = new Date(`${d}T00:00:00Z`); return Number.isNaN(+x) ? d : x.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }); };

/** How far along a class is on a day: the students due, how many are logged or marked absent. */
function progress(g: ClassGroup) {
  const due = g.students.filter((s) => s.due || !waiting(s));
  const logged = g.students.filter((s) => s.logged > 0).length;
  const absent = g.students.filter((s) => s.notMet).length;
  const left = g.students.filter((s) => s.due && waiting(s)).length;
  return { due: due.length, logged, absent, left, percent: due.length ? Math.round(((due.length - left) / due.length) * 100) : 0 };
}

function WeekStrip({ day, today, notes, onDay }: { day: string; today: string; notes: PushInNote[]; onDay: (d: string) => void }) {
  return (
    <div className="flex items-center gap-1.5" data-testid="board-week">
      <button type="button" onClick={() => onDay(addDays(day, -7))} aria-label="Week before" className="grid h-11 w-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
      <div className="grid flex-1 grid-cols-5 gap-1.5" role="tablist" aria-label="Day of the week">
        {schoolWeek(day).map((d) => {
          const x = new Date(`${d}T00:00:00Z`), on = d === day, isToday = d === today, has = notes.some((n) => n.date === d);
          return (
            <button key={d} type="button" role="tab" aria-selected={on} onClick={() => onDay(d)} data-day={d}
              className={`flex min-h-[3.4rem] flex-col items-center justify-center rounded-2xl text-center transition ${on ? "bg-slate-950 text-white shadow-md" : isToday ? "bg-teal-50 text-teal-900 ring-1 ring-teal-200" : "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${on ? "text-white/70" : "text-slate-500"}`}>{x.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</span>
              <span className="text-lg font-extrabold leading-tight tabular-nums">{x.getUTCDate()}</span>
              <span className={`h-1 w-1 rounded-full ${has ? (on ? "bg-white" : "bg-teal-600") : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => onDay(addDays(day, 7))} aria-label="Week after" className="grid h-11 w-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
    </div>
  );
}

export function ClassBoard(props: BoardProps) {
  const { workspace, today } = props;
  const [day, setDay] = useState(today);
  const [openKey, setOpenKey] = useState<string | null>(() => { try { return sessionStorage.getItem("arise-hub-class-open"); } catch { return null; } });
  useEffect(() => { try { if (openKey) sessionStorage.setItem("arise-hub-class-open", openKey); else sessionStorage.removeItem("arise-hub-class-open"); } catch { /* not kept */ } }, [openKey]);
  const [editing, setEditing] = useState<{ note: PushInNote; isNew: boolean } | null>(null);
  const [version, setVersion] = useState(0);
  const groups = useClassGroups(workspace, day);
  const blocks = useMemo(() => schoolBlocks(workspace), [workspace.minuteBlocks]);
  const notes = useMemo(() => sortNotes(cleanPushInNotes(workspace.pushInNotes), blocks), [workspace.pushInNotes, blocks]);
  const lost = useMemo(() => orphanNotes(notes, new Set(groups.map((g) => g.key)), blocks), [notes, groups, blocks]);
  const group = openKey ? groups.find((g) => g.key === openKey) : undefined;
  const openEditor = (note: PushInNote, isNew: boolean) => setEditing({ note, isNew });
  const editor = editing && <NoteEditor key={editing.note.id} workspace={workspace} setWorkspace={props.setWorkspace} makeId={props.makeId} today={today} token={props.token} groups={groups} blocks={blocks}
    start={editing.note} isNew={editing.isNew} count={notes.length} onClose={() => { setEditing(null); setVersion((v) => v + 1); }} />;

  if (group) return <>
    <ClassPage key={`${group.key}|${day}|${version}`} {...props} group={group} day={day} onDay={setDay} notes={notes} blocks={blocks} onBack={() => setOpenKey(null)} onOpenNote={openEditor} />
    {editor}
  </>;

  const totals = groups.reduce((t, g) => { const p = progress(g); return { due: t.due + p.due, left: t.left + p.left }; }, { due: 0, left: 0 });
  const dayNotes = notes.filter((n) => n.date === day);
  return (
    <div className="space-y-4" data-testid="class-board">
      <section className="rounded-[1.75rem] bg-gradient-to-br from-slate-950 via-slate-900 to-teal-900 p-5 text-white shadow-[0_20px_40px_-28px_rgba(15,23,42,.9)]">
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-white/55">{day === today ? "Today" : friendlyDate(day, today)}</p>
        <h3 className="mt-1 text-2xl font-extrabold tracking-tight" data-testid="board-day">{longDay(day)}</h3>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-white/10 px-3 py-1 font-semibold">{groups.length} {groups.length === 1 ? "class" : "classes"}</span>
          {totals.due > 0 && <span className="rounded-full bg-white/10 px-3 py-1 font-semibold">{totals.left ? `${totals.left} of ${totals.due} still to mark` : "Everyone marked"}</span>}
          <span className="rounded-full bg-white/10 px-3 py-1 font-semibold">{dayNotes.length} {dayNotes.length === 1 ? "note" : "notes"}</span>
        </div>
        {day !== today && <button type="button" onClick={() => setDay(today)} className="mt-3 rounded-full bg-white px-3.5 py-1.5 text-sm font-bold text-slate-950" data-testid="board-today">Back to today</button>}
      </section>
      <WeekStrip day={day} today={today} notes={notes} onDay={setDay} />

      {!groups.length ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
          <p className="mt-2 text-base font-bold text-slate-900">No classes yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">Add students to a block (and whose class you push in to). Each class then shows up here to mark minutes and keep notes.</p>
          <button type="button" onClick={props.onSetup} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Set up classes</button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="board-classes">
          {groups.map((g) => {
            const p = progress(g), done = p.due > 0 && p.left === 0;
            const lesson = notes.find((n) => n.date === day && noteKey(n, blocks) === g.key);
            return (
              <li key={g.key}>
                <button type="button" onClick={() => setOpenKey(g.key)} data-testid="board-class" className={`group flex w-full flex-col gap-3 rounded-3xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${done ? "border-emerald-200" : "border-slate-200"}`}>
                  <span className="flex items-start gap-3">
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${done ? "bg-emerald-600 text-white" : "bg-slate-950 text-white"}`} aria-hidden>{done ? <Check className="h-5 w-5" /> : <Users className="h-5 w-5" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-extrabold text-slate-950">{g.title}</span>
                      <span className="block truncate text-sm text-slate-600">{g.label || people(g.students.length)}</span>
                    </span>
                    <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-slate-500" aria-hidden />
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="flex -space-x-2">{g.students.slice(0, 5).map((s) => <span key={s.planId} className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-extrabold ring-2 ring-white ${tint(s.student)}`} title={s.student}>{initials(s.student)}</span>)}</span>
                    {g.students.length > 5 && <span className="text-xs font-semibold text-slate-500">+{g.students.length - 5}</span>}
                    <span className="ml-auto text-xs font-bold text-slate-600">{p.due ? (done ? "All marked" : `${p.due - p.left}/${p.due} marked`) : "None due"}</span>
                  </span>
                  {p.due > 0 && <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${done ? "bg-emerald-500" : "bg-teal-600"}`} style={{ width: `${p.percent}%` }} /></span>}
                  <span className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm ${lesson ? "bg-violet-50 text-violet-900" : "bg-slate-50 text-slate-500"}`}>
                    <NotebookPen className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">{lesson ? lesson.title || lesson.taught.slice(0, 60) || "Class note" : "No class note yet"}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {lost.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-4" data-testid="board-old">
          <h4 className="text-sm font-extrabold text-slate-950">Notes from old classes</h4>
          <p className="text-xs text-slate-500">These classes are no longer in your minutes.</p>
          <ul className="mt-2 divide-y divide-slate-100">{lost.slice(0, 20).map((n) => <li key={n.id}><button type="button" onClick={() => openEditor(n, false)} className="flex w-full items-center gap-3 py-2.5 text-left text-sm"><span className="w-16 shrink-0 text-xs font-semibold text-slate-500">{friendlyDate(n.date, today)}</span><span className="truncate font-semibold text-slate-900">{n.title || "Untitled lesson"}</span></button></li>)}</ul>
        </section>
      )}
      {editor}
    </div>
  );
}

/** One class on one day. */
function ClassPage({ workspace, setWorkspace, makeId, today, group, day, onDay, notes, blocks, onBack, onOpenNote, onOther, onEditLog, onEditPlan, onAddStudents, onDeleteClass, say }: BoardProps & {
  group: ClassGroup; day: string; onDay: (d: string) => void; notes: PushInNote[]; blocks: ReturnType<typeof schoolBlocks>;
  onBack: () => void; onOpenNote: (note: PushInNote, isNew: boolean) => void;
}) {
  const mine = notes.filter((n) => noteKey(n, blocks) === group.key);
  const todays = mine.filter((n) => n.date === day);
  const earlier = mine.filter((n) => n.date !== day).slice(0, 8);
  const full = notesFull(notes);
  const [menu, setMenu] = useState(false);
  const [leaving, setLeaving] = useState<string | null>(null);
  const optional = useMemo(() => optionalDays(workspace), [workspace.minuteOptionalDays]);

  // The day's class note, written in place. It saves itself a moment after each change, and on leaving the page.
  const [draft, setDraft] = useState<PushInNote>(() => todays[0] || newNote(group, day, makeId(), new Date().toISOString()));
  const latest = useRef(draft), kept = useRef<PushInNote | null>(todays[0] || null);
  latest.current = draft;
  const flush = () => {
    const n = latest.current;
    if (kept.current === n || (!kept.current && isBlank(n))) return;
    kept.current = n;
    setWorkspace((w) => ({ ...w, pushInNotes: upsertNote(w.pushInNotes, n) }));
  };
  useEffect(() => { const t = setTimeout(flush, 400); return () => clearTimeout(t); }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const stamp = () => new Date().toISOString();
  const edit = (change: Partial<PushInNote>) => setDraft((d) => ({ ...d, ...change, updatedAt: stamp() }));
  const setEntry = (name: string, change: Parameters<typeof withEntry>[2]) => setDraft((d) => withEntry(d, name, change, stamp()));
  const openFull = () => { flush(); onOpenNote(latest.current, !kept.current); };

  const add = (logs: Omit<ServiceLog, "id">[]) =>
    setWorkspace((w) => ({ ...w, serviceLogs: [...w.serviceLogs, ...logs.map((l) => ({ id: makeId(), ...l }))] }));
  const logOne = (s: ClassStudent, minutes?: number) => {
    const l = studentLog(group, s, day, minutes);
    if (!l) { onOther({ student: s.student, kind: s.kind, date: day, block: group.block }); return; }
    add([l]);
  };
  const markAbsent = (s: ClassStudent) => { add([absentLog(group, s, day)]); setEntry(s.student, { status: "absent" }); };
  const logEveryone = () => {
    const r = classLogs(group, startPicks(group), { date: day, minutes: "", absent: false });
    if (r.logs.length) add(r.logs);
    say(r.missing.length ? `${r.missing.join(", ")} ${r.missing.length === 1 ? "has" : "have"} no usual minutes. Tap Other to log them.` : r.given ? `Logged ${people(r.given)} with their usual minutes.` : "Everyone is already marked.");
  };
  const p = progress(group);

  return (
    <div className="space-y-4" data-testid="class-page">
      {/* Top: back, the class, and its menu */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => { flush(); onBack(); }} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-slate-100 pl-2 pr-3.5 text-sm font-bold text-slate-800 hover:bg-slate-200" data-testid="class-back"><ChevronLeft className="h-4 w-4" /> Classes</button>
        <div className="relative ml-auto">
          <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Class options" className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200" data-testid="class-menu"><MoreHorizontal className="h-5 w-5" /></button>
          {menu && <div className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-2xl bg-white py-1 shadow-xl ring-1 ring-slate-200" role="menu">
            <button type="button" role="menuitem" onClick={() => { setMenu(false); onAddStudents(group.key); }} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"><UserPlus className="h-4 w-4" /> Add students</button>
            <button type="button" role="menuitem" onClick={() => { setMenu(false); onDeleteClass(group.key); }} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete class</button>
          </div>}
        </div>
      </div>

      <section className="rounded-[1.75rem] bg-gradient-to-br from-slate-950 via-slate-900 to-teal-900 p-5 text-white">
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-white/55">{day === today ? "Today" : longDay(day)}</p>
        <h3 className="mt-1 text-[26px] font-extrabold leading-tight tracking-tight" data-testid="class-title">{group.title}</h3>
        {group.label && <p className="text-sm font-medium text-white/75">{group.label}</p>}
        <div className="mt-4 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex justify-between text-xs font-semibold text-white/75"><span>{p.due ? `${p.due - p.left} of ${p.due} marked` : "No one due this day"}</span>{p.absent > 0 && <span>{p.absent} absent</span>}</div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-teal-300 to-emerald-300" style={{ width: `${p.percent}%` }} /></div>
          </div>
          {p.left > 0 && <button type="button" onClick={logEveryone} className="shrink-0 rounded-2xl bg-white px-3.5 py-2.5 text-sm font-extrabold text-slate-950 hover:bg-white/90" data-testid="class-log-all">Log everyone</button>}
        </div>
      </section>
      <WeekStrip day={day} today={today} notes={mine} onDay={(d) => { flush(); onDay(d); }} />

      {/* The class's own note */}
      <section className="rounded-3xl border border-violet-200 bg-gradient-to-b from-violet-50 to-white p-4" aria-label="Class note" data-testid="class-note">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-5 w-5 text-violet-700" aria-hidden />
          <h4 className="flex-1 text-base font-extrabold text-slate-950">Class note</h4>
          <span className="text-xs text-slate-500">Saves as you type</span>
        </div>
        <input value={draft.title} maxLength={PUSH_IN_LIMITS.title} onChange={(e) => edit({ title: e.target.value })} placeholder="Today's lesson (Adding fractions)" aria-label="The lesson"
          className="mt-3 w-full rounded-2xl border border-violet-100 bg-white px-3.5 py-3 text-[16px] font-bold text-slate-950 outline-none placeholder:font-medium placeholder:text-slate-400 focus:border-violet-400" data-testid="class-note-title" />
        <TextArea value={draft.taught} maxLength={PUSH_IN_LIMITS.taught} onChange={(e) => edit({ taught: e.target.value })} rows={3} aria-label="What the teacher taught" placeholder="What the teacher taught, how the class went…" className="mt-2 !bg-white" data-testid="class-note-taught" />
        <TextArea value={draft.followUp || ""} maxLength={PUSH_IN_LIMITS.note} onChange={(e) => edit({ followUp: e.target.value })} rows={2} aria-label="Follow up" placeholder="Follow up next time (optional)" className="mt-2 !bg-white" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={openFull} disabled={!kept.current && full} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-3 text-sm font-bold text-violet-800 ring-1 ring-violet-200 hover:bg-violet-50" data-testid="class-note-more">
            <Paperclip className="h-4 w-4" /> Files and scaffolds{draft.materials.length ? ` (${draft.materials.filter((m) => m.kind !== "answerKey").length})` : ""}
          </button>
          {todays.length > 1 && todays.slice(1).map((n) => <button key={n.id} type="button" onClick={() => onOpenNote(n, false)} className="inline-flex min-h-10 items-center rounded-xl bg-white px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">{n.title || "Another note"}</button>)}
        </div>
      </section>

      {/* Students */}
      <section aria-label="Students" data-testid="class-students">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h4 className="text-base font-extrabold text-slate-950">Students <span className="font-semibold text-slate-400">{group.students.length}</span></h4>
          <button type="button" onClick={() => onAddStudents(group.key)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-teal-700 hover:bg-teal-50" data-testid="class-add-students"><UserPlus className="h-4 w-4" /> Add</button>
        </div>
        <ul className="space-y-3">
          {group.students.map((s) => {
            const plan = workspace.services.find((x) => x.id === s.planId);
            const week = plan ? serviceStatus(countedPlan(plan, optional), workspace.serviceLogs, day) : null;
            const logs = dayLogs(workspace.serviceLogs, s, day);
            const entry = entryOf(draft, s.student);
            const dup = group.students.filter((x) => x.student === s.student).length > 1;
            return (
              <li key={s.planId} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="class-student-card" data-student={s.student}>
                <div className="flex items-start gap-3">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-extrabold ${tint(s.student)}`} aria-hidden>{initials(s.student)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-extrabold text-slate-950">{s.student}{dup ? ` · ${s.kind}` : ""}</p>
                    <p className="truncate text-xs text-slate-500">{[s.subject, s.kind, plan ? planText(countedPlan(plan, optional)) : "", !s.due ? "not usually this day" : ""].filter(Boolean).join(" · ")}</p>
                    {week && week.required > 0 && <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${week.remaining ? "bg-teal-600" : "bg-emerald-500"}`} style={{ width: `${week.percent}%` }} /></div>
                      <span className="whitespace-nowrap text-[11px] font-semibold tabular-nums text-slate-500">{week.thisWeek}/{week.required} min this week</span>
                    </div>}
                  </div>
                  <button type="button" onClick={() => onEditPlan(s.planId)} aria-label={`Change ${s.student}'s required minutes`} className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setLeaving(leaving === s.planId ? null : s.planId)} aria-label={`Take ${s.student} out of this class`} className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" data-testid="class-student-remove"><UserMinus className="h-4 w-4" /></button>
                </div>
                {leaving === s.planId && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-900">
                  <span className="flex-1">Take {s.student} out of this class? Their required minutes and logged minutes stay.</span>
                  <button type="button" onClick={() => { setWorkspace((w) => ({ ...w, services: leaveClass(w.services, s.planId) })); setLeaving(null); say(`${s.student} taken out of ${title(group)}.`); }} className="min-h-9 rounded-xl bg-red-700 px-3 font-bold text-white" data-testid="class-student-remove-yes">Take out</button>
                  <button type="button" onClick={() => setLeaving(null)} className="min-h-9 rounded-xl px-3 font-semibold text-red-900">Keep</button>
                </div>}

                {/* Minutes */}
                <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={`Minutes for ${s.student}`}>
                  {logs.map((l) => <button key={l.id} type="button" onClick={() => onEditLog(l.id)} data-testid="class-student-logged"
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold ${l.notMet ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-900"}`}>
                    {l.notMet ? <UserX className="h-4 w-4" /> : <Check className="h-4 w-4" />}{l.notMet ? (l.note || "Did not meet") : `${l.minutes} min`}<Pencil className="h-3 w-3 opacity-50" /></button>)}
                  {waiting(s) ? <>
                    <button type="button" onClick={() => logOne(s)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-teal-600 px-4 text-sm font-extrabold text-white hover:bg-teal-700" data-testid="class-student-log">
                      <Clock className="h-4 w-4" />{s.minutes ? `Log ${s.minutes} min` : "Log minutes"}</button>
                    <button type="button" onClick={() => onOther({ student: s.student, kind: s.kind, date: day, block: group.block })} className="inline-flex min-h-10 items-center rounded-full bg-slate-100 px-3.5 text-sm font-bold text-slate-700 hover:bg-slate-200" data-testid="class-student-other">Other</button>
                    <button type="button" onClick={() => markAbsent(s)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-slate-100 px-3.5 text-sm font-bold text-slate-700 hover:bg-slate-200" data-testid="class-student-absent"><UserX className="h-4 w-4" />Absent</button>
                  </> : !s.notMet && <button type="button" onClick={() => onOther({ student: s.student, kind: s.kind, date: day, block: group.block })} className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-bold text-slate-500 hover:bg-slate-100"><Plus className="h-4 w-4" /> More</button>}
                </div>

                {/* How they did, and a note */}
                <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={`How ${s.student} did`}>
                  {CHECKS.filter((c) => c !== "absent" || entry.status === "absent").map((c) => {
                    const on = entry.status === c;
                    return <button key={c} type="button" aria-pressed={on} onClick={() => setEntry(s.student, { status: on ? undefined : c })} data-status={c}
                      className={`inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-bold transition ${on ? STATUS_ON[c] : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{CHECK_LABEL[c]}</button>;
                  })}
                </div>
                <TextArea value={entry.note || ""} maxLength={PUSH_IN_LIMITS.note} onChange={(e) => setEntry(s.student, { note: e.target.value })} rows={2} aria-label={`Note about ${s.student}`} placeholder={`A note about ${s.student.split(" ")[0]}`} className="mt-2 !min-h-[3rem]" data-testid="class-student-note" />
              </li>
            );
          })}
        </ul>
        {!group.students.length && <Empty>No students in this class.</Empty>}
        <button type="button" onClick={() => onAddStudents(group.key)} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-200 text-sm font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700"><UserPlus className="h-4 w-4" /> Add students to this class</button>
      </section>

      {earlier.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-4" data-testid="class-earlier">
          <h4 className="text-sm font-extrabold text-slate-950">Earlier notes</h4>
          <ul className="mt-1 divide-y divide-slate-100">
            {earlier.map((n) => <li key={n.id}><button type="button" onClick={() => onOpenNote(n, false)} className="flex w-full items-center gap-3 py-3 text-left">
              <span className="w-20 shrink-0 text-xs font-bold text-slate-500">{friendlyDate(n.date, today)}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-900">{n.title || "Untitled lesson"}</span>{n.taught && <span className="block truncate text-xs text-slate-500">{n.taught}</span>}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </button></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
