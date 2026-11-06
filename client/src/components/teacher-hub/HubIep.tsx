// Arise WorkHub: the IEP page. One page for everything a case manager does for an IEP, with a tab for
// each part: what is coming up, meetings, meeting and class notes, the student's profile,
// accommodations, progress monitoring and minutes. Pick one student at the top to see just theirs.
// The rules are in shared/hubIep.ts.
import { useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CalendarClock, Check, ChevronDown, ChevronLeft, Copy, ListChecks, NotebookPen, Timer, TrendingUp, UserRound, FileText, Paperclip, Plus, Printer, Sparkles, Trash2, Upload, X } from "lucide-react";
import { CHECK_CHOICES, COMMON_ACCOMMODATIONS, accommodationList, accommodationText, checkEvery, cleanIepNotes, cleanPmFiles, iepComingUp, newIepNote, noteGroup, noteText, pmSheetHtml, pmStatus, type IepNote, type IepNoteKind, type NoteGroup, type PmFile, type PmState } from "@shared/hubIep";
import { friendlyDate } from "@shared/hubDates";
import { goalProgress, withPoint } from "@shared/hubProgress";
import { cleanDriveFiles, driveBytesUsed } from "@shared/driveApp";
import type { Goal, Meeting, NoteItem, Workspace } from "@shared/teacherHub";
import { API_BASE } from "@/lib/queryClient";
import { HubModal } from "./HubModal";
import { GhostButton, PrimaryButton } from "./ui";
import { MakeGoalQuiz, StudentQuizzes } from "./HubGoalQuiz";
import { WorksheetMaker } from "./HubWorksheet";

type Setter = React.Dispatch<React.SetStateAction<Workspace>>;
export type IepTab = "overview" | "meetings" | "notes" | "profile" | "accommodations" | "progress" | "minutes";
/** The parts of an IEP, as a folder of small apps: the home page shows one tile for each, and inside any of them the others are one tap away. */
const APPS: { key: Exclude<IepTab, "overview">; label: string; blurb: string; icon: ReactNode; tint: string }[] = [
  { key: "meetings", label: "Meetings", blurb: "Plan and run IEP meetings", icon: <CalendarClock className="h-5 w-5" />, tint: "bg-violet-50 text-violet-700" },
  { key: "notes", label: "Notes", blurb: "Student, class and meeting notes", icon: <NotebookPen className="h-5 w-5" />, tint: "bg-amber-50 text-amber-700" },
  { key: "profile", label: "Profile", blurb: "Who they are and their team", icon: <UserRound className="h-5 w-5" />, tint: "bg-sky-50 text-sky-700" },
  { key: "accommodations", label: "Accommodations", blurb: "What each student gets", icon: <ListChecks className="h-5 w-5" />, tint: "bg-emerald-50 text-emerald-700" },
  { key: "progress", label: "Progress", blurb: "Goals, scores and checks", icon: <TrendingUp className="h-5 w-5" />, tint: "bg-rose-50 text-rose-700" },
  { key: "minutes", label: "Minutes", blurb: "Classes, minutes and notes", icon: <Timer className="h-5 w-5" />, tint: "bg-slate-100 text-slate-700" },
];

const panel = "rounded-3xl bg-white ring-1 ring-slate-200/70";
const h3 = "text-[11px] font-semibold uppercase tracking-[.08em] text-slate-500";
const pill = (on: boolean) => `inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold ${on ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`;
const PM_LOOK: Record<PmState, { word: string; cls: string }> = {
  overdue: { word: "Overdue", cls: "bg-red-50 text-red-700" },
  "due soon": { word: "Due soon", cls: "bg-amber-50 text-amber-800" },
  "on schedule": { word: "On schedule", cls: "bg-slate-100 text-slate-600" },
  met: { word: "Goal met", cls: "bg-emerald-50 text-emerald-700" },
};
const daysWords = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : n === -1 ? "yesterday" : n < 0 ? `${-n} days ago` : `in ${n} days`);
function printHtml(html: string) { const w = window.open("", "_blank"); if (!w) return; w.document.open(); w.document.write(html); w.document.close(); }

export function IepPage({ workspace, setWorkspace, makeId, today, token, meetings, caseload, goals, minutes }: {
  workspace: Workspace; setWorkspace: Setter; makeId: () => string; today: string; token: string | null;
  /** The meeting timeline and its step-by-step guide. */
  meetings: ReactNode;
  /** The caseload, or one student's whole profile when `studentId` is given. */
  caseload: (studentId: string | null, onPick: (studentId: string | null) => void) => ReactNode;
  /** The goals, to add and change them. */
  goals: ReactNode;
  /** The Minutes page. */
  minutes: ReactNode;
}) {
  const [tab, setTab] = useState<IepTab>("overview");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const student = workspace.students.find((s) => s.id === studentId) ?? null;
  const name = student?.name ?? "";
  const mine = <T extends { student: string }>(list: T[]) => (student ? list.filter((x) => x.student === name) : list);
  const app = APPS.find((a) => a.key === tab);

  return (
    <div className="grid gap-3" data-testid="iep-page">
      <div className="flex items-center gap-2">
        {app && <button type="button" onClick={() => setTab("overview")} aria-label="Back to the IEP folder" className="-ml-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100" data-testid="iep-back"><ChevronLeft className="h-5 w-5" /></button>}
        <h2 className="min-w-0 flex-1 truncate text-[26px] font-semibold tracking-tight text-slate-950">{app ? <><span className="text-slate-400">IEP · </span>{app.label}</> : "IEP"}</h2>
        <div className="relative">
          <button type="button" onClick={() => setPickOpen((o) => !o)} aria-expanded={pickOpen} className="inline-flex min-h-10 max-w-[13rem] items-center gap-1 rounded-full bg-slate-100 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-200" data-testid="iep-student">
            <span className="truncate">{student ? student.name : "All students"}</span><ChevronDown className="h-4 w-4 shrink-0" />
          </button>
          {pickOpen && (
            <div className="absolute right-0 z-30 mt-1 max-h-[60vh] w-64 overflow-y-auto rounded-2xl bg-white py-1 shadow-xl ring-1 ring-slate-200" role="menu">
              {[{ id: null as string | null, name: "All students" }, ...[...workspace.students].sort((a, b) => a.name.localeCompare(b.name))].map((s) => (
                <button key={s.id ?? "all"} type="button" role="menuitem" onClick={() => { setStudentId(s.id); setPickOpen(false); }} className={`block w-full truncate px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${studentId === s.id ? "font-semibold text-slate-950" : "text-slate-700"}`}>{s.name}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      {app && (
        <div role="tablist" aria-label="IEP" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5" data-testid="iep-tabs">
          {APPS.map((a) => <button key={a.key} type="button" role="tab" aria-selected={tab === a.key} onClick={() => setTab(a.key)} className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold ${tab === a.key ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{a.label}</button>)}
        </div>
      )}

      {tab === "overview" && <Overview workspace={workspace} today={today} studentName={name} onPick={(id) => setStudentId(id)} go={setTab} />}
      {tab === "meetings" && meetings}
      {tab === "notes" && <NotesTab workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} today={today} student={name} go={setTab} />}
      {tab === "profile" && caseload(studentId, setStudentId)}
      {tab === "accommodations" && <Accommodations workspace={workspace} setWorkspace={setWorkspace} studentId={studentId} onPick={setStudentId} />}
      {tab === "progress" && <Progress workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} today={today} token={token} goals={mine(workspace.goals)} student={student} />}
      {tab === "progress" && goals}
      {tab === "minutes" && minutes}
    </div>
  );
}

// ─── The folder: one tile for each part of an IEP ────────────────────────────

function Overview({ workspace, today, studentName, onPick, go }: { workspace: Workspace; today: string; studentName: string; onPick: (id: string | null) => void; go: (t: IepTab) => void }) {
  const due = useMemo(() => iepComingUp(workspace, today).filter((d) => !studentName || d.student === studentName), [workspace.students, workspace.goals, workspace.meetings, today, studentName]);
  const students = studentName ? workspace.students.filter((s) => s.name === studentName) : [...workspace.students].sort((a, b) => a.name.localeCompare(b.name));
  const notes = cleanIepNotes(workspace.iepNotes);
  const KIND_TAB: Record<string, IepTab> = { iep: "meetings", reeval: "meetings", meeting: "meetings", check: "progress" };
  const own = <T extends { student: string }>(list: T[]) => (studentName ? list.filter((x) => x.student === studentName) : list);
  const goalsHere = own(workspace.goals);
  const late = goalsHere.filter((g) => pmStatus(g, today).state === "overdue").length;
  const soon = goalsHere.filter((g) => pmStatus(g, today).state === "due soon").length;
  const noteCount = noteEntries(workspace, studentName).length;
  const accCount = students.reduce((n, s) => n + accommodationList(s.accommodations).length, 0);
  const upcomingMeetings = own(workspace.meetings).filter((m) => !m.done && m.date >= today).length;
  const badge: Record<string, { text: string; hot?: boolean }> = {
    meetings: { text: upcomingMeetings ? `${upcomingMeetings} coming up` : "None coming up" },
    notes: { text: `${noteCount} note${noteCount === 1 ? "" : "s"}` },
    profile: { text: studentName ? "Open profile" : `${students.length} student${students.length === 1 ? "" : "s"}` },
    accommodations: { text: `${accCount} listed` },
    progress: late ? { text: `${late} check${late === 1 ? "" : "s"} late`, hot: true } : soon ? { text: `${soon} due soon`, hot: true } : { text: `${goalsHere.length} goal${goalsHere.length === 1 ? "" : "s"}` },
    minutes: { text: "This week" },
  };
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" data-testid="iep-folder">
        {APPS.map((a) => (
          <button key={a.key} type="button" onClick={() => go(a.key)} className={`${panel} flex flex-col items-start gap-3 p-4 text-left transition hover:ring-slate-300 active:scale-[.99]`} data-testid={`iep-tile-${a.key}`}>
            <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${a.tint}`}>{a.icon}</span>
            <span className="min-w-0"><span className="block text-[15px] font-semibold text-slate-950">{a.label}</span><span className="mt-0.5 block text-xs leading-4 text-slate-500">{a.blurb}</span></span>
            <span className={`mt-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge[a.key].hot ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>{badge[a.key].text}</span>
          </button>
        ))}
      </div>
      <section className={panel} data-testid="iep-coming-up">
        <div className="px-4 pt-4"><h3 className={h3}>Coming up</h3></div>
        {due.length ? <ul className="mx-2 divide-y divide-slate-100 pb-2">{due.slice(0, 12).map((d) => (
          <li key={d.key}><button type="button" onClick={() => go(KIND_TAB[d.kind])} className="flex w-full items-center gap-3 px-2 py-2.5 text-left">
            <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${d.daysLeft < 0 ? "bg-red-50 text-red-600" : d.daysLeft <= 7 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{d.daysLeft < 0 ? <AlertCircle className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium text-slate-900">{d.what}</span><span className="block truncate text-xs text-slate-500">{d.student}{d.student ? " · " : ""}{friendlyDate(d.date, today)}</span></span>
            <span className={`shrink-0 text-xs font-semibold ${d.daysLeft < 0 ? "text-red-600" : d.daysLeft <= 7 ? "text-amber-700" : "text-slate-500"}`}>{daysWords(d.daysLeft)}</span>
          </button></li>
        ))}</ul> : <p className="px-4 pb-4 pt-2 text-sm text-slate-500">Nothing due in the next 45 days.</p>}
      </section>
      <section className={panel}>
        <div className="px-4 pt-4"><h3 className={h3}>{studentName ? "Student" : `Caseload · ${students.length}`}</h3></div>
        {students.length ? <ul className="mx-2 divide-y divide-slate-100 pb-2">{students.map((s) => {
          const g = workspace.goals.filter((x) => x.student === s.name);
          const lateS = g.filter((x) => pmStatus(x, today).state === "overdue").length;
          const acc = accommodationList(s.accommodations).length;
          const last = notes.filter((n) => n.student === s.name).sort((a, b) => b.date.localeCompare(a.date))[0];
          return <li key={s.id}><button type="button" onClick={() => onPick(studentName === s.name ? null : s.id)} className="flex w-full items-center gap-3 px-2 py-3 text-left" data-testid="iep-student-row">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">{s.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-slate-900">{s.name}{s.grade ? <span className="font-normal text-slate-500"> · Grade {s.grade}</span> : null}</span>
              <span className="block truncate text-xs text-slate-500">{[s.iepDate && `IEP ${friendlyDate(s.iepDate, today)}`, s.reevalDate && `Re-eval ${friendlyDate(s.reevalDate, today)}`, `${g.length} goal${g.length === 1 ? "" : "s"}`, `${acc} accommodation${acc === 1 ? "" : "s"}`, last && `last note ${friendlyDate(last.date, today)}`].filter(Boolean).join(" · ")}</span>
            </span>
            {lateS > 0 && <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">{lateS} check{lateS === 1 ? "" : "s"} late</span>}
          </button></li>;
        })}</ul> : <p className="px-4 pb-4 pt-2 text-sm text-slate-500">Add students on the Profile tab.</p>}
      </section>
    </>
  );
}

// ─── Notes: one place for student, class and meeting notes ───────────────────

type NoteEntry = { key: string; group: NoteGroup; title: string; student: string; date: string; text: string; open: () => void };
type NoteSource = { kind: "iep"; note: IepNote } | { kind: "work"; note: NoteItem } | { kind: "meeting"; meeting: Meeting } | { kind: "pushin"; id: string };
type Entry = NoteEntry & { src: NoteSource };

/** Every note about the student (or all students), from every place notes are kept, newest first. */
function noteEntries(workspace: Workspace, student: string): Entry[] {
  const out: Entry[] = [];
  const noop = () => {};
  for (const n of cleanIepNotes(workspace.iepNotes)) if (!student || n.student === student) out.push({ key: `i${n.id}`, group: noteGroup(n.kind), title: n.kind, student: n.student, date: n.date, text: Object.values(n.sections).find((v) => v.trim()) || "", open: noop, src: { kind: "iep", note: n } });
  for (const n of workspace.notes || []) if (n.student && (!student || n.student === student || n.students?.includes(student))) out.push({ key: `w${n.id}`, group: "student", title: n.title || n.type || "Note", student: n.student, date: n.date || "", text: n.body || "", open: noop, src: { kind: "work", note: n } });
  for (const m of workspace.meetings || []) if (m.notes?.trim() && (!student || m.student === student)) out.push({ key: `m${m.id}`, group: "meeting", title: `${m.type} notes`, student: m.student, date: m.date || "", text: m.notes, open: noop, src: { kind: "meeting", meeting: m } });
  for (const p of (workspace.pushInNotes || []) as any[]) {
    if (!p || typeof p.id !== "string") continue;
    const kids: string[] = Array.isArray(p.students) ? p.students.map((x: any) => String(x?.student || "")).filter(Boolean) : [];
    if (student && !kids.includes(student)) continue;
    out.push({ key: `p${p.id}`, group: "class", title: String(p.title || p.subject || "Push-in class"), student: kids.slice(0, 2).join(", ") + (kids.length > 2 ? ` +${kids.length - 2}` : ""), date: String(p.date || ""), text: String(p.taught || ""), open: noop, src: { kind: "pushin", id: p.id } });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

const GROUP_LABEL: Record<NoteGroup, string> = { student: "Student", class: "Class", meeting: "Meeting" };
const GROUP_TINT: Record<NoteGroup, string> = { student: "bg-amber-50 text-amber-800", class: "bg-sky-50 text-sky-800", meeting: "bg-violet-50 text-violet-800" };
const NEW_CHOICES: { group: NoteGroup; label: string; blurb: string; kinds: IepNoteKind[] }[] = [
  { group: "student", label: "About a student", blurb: "What happened, what you did, what is next", kinds: ["Student note"] },
  { group: "class", label: "About a class", blurb: "A push-in or pull-out session", kinds: ["Push-in class", "Pull-out class"] },
  { group: "meeting", label: "About a meeting", blurb: "IEP, review, reevaluation, parents…", kinds: ["IEP meeting", "Annual review", "Reevaluation", "Amendment", "Eligibility", "Parent conference", "Other"] },
];

function NotesTab({ workspace, setWorkspace, makeId, today, student, go }: { workspace: Workspace; setWorkspace: Setter; makeId: () => string; today: string; student: string; go: (t: IepTab) => void }) {
  const entries = useMemo(() => noteEntries(workspace, student), [workspace.iepNotes, workspace.notes, workspace.meetings, workspace.pushInNotes, student]);
  const [group, setGroup] = useState<NoteGroup | "">("");
  const [search, setSearch] = useState("");
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<IepNote | null>(null);
  const [editingWork, setEditingWork] = useState<NoteItem | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const q = search.trim().toLowerCase();
  const shown = entries.filter((e) => (!group || e.group === group) && (!q || `${e.title} ${e.student} ${e.text}`.toLowerCase().includes(q)));
  const count = (g: NoteGroup) => entries.filter((e) => e.group === g).length;
  const save = (n: IepNote) => setWorkspace((w) => { const list = cleanIepNotes(w.iepNotes); const next = { ...n, updatedAt: new Date().toISOString() }; return { ...w, iepNotes: list.some((x) => x.id === n.id) ? list.map((x) => (x.id === n.id ? next : x)) : [next, ...list] }; });
  const start = (kind: IepNoteKind) => { setPicking(false); setEditing(newIepNote(makeId(), student || workspace.students[0]?.name || "", kind, today)); };
  const open = (e: Entry) => {
    if (e.src.kind === "iep") setEditing(e.src.note);
    else if (e.src.kind === "work") setEditingWork(e.src.note);
    else if (e.src.kind === "meeting") setEditingMeeting(e.src.meeting);
    else go("minutes");
  };
  return (
    <>
      <section className={panel} data-testid="iep-notes">
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          <h3 className={h3}>All notes{student ? ` · ${student}` : ""}</h3>
          <button type="button" onClick={() => setPicking(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white" data-testid="iep-note-new"><Plus className="h-4 w-4" />New note</button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-1 pt-3">
          <button type="button" className={pill(!group)} onClick={() => setGroup("")}>All {entries.length}</button>
          {(["student", "class", "meeting"] as NoteGroup[]).map((g) => <button key={g} type="button" className={pill(group === g)} onClick={() => setGroup(group === g ? "" : g)}>{GROUP_LABEL[g]} {count(g)}</button>)}
        </div>
        {entries.length > 4 && <div className="px-4 pt-2"><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes" aria-label="Search notes" className="min-h-10 w-full rounded-xl border border-slate-200 px-3 text-base sm:text-sm" /></div>}
        {shown.length ? <ul className="mx-2 mt-2 divide-y divide-slate-100 pb-2">{shown.map((e) => (
          <li key={e.key}><button type="button" onClick={() => open(e)} className="block w-full px-2 py-3 text-left" data-testid="iep-note-row">
            <span className="flex items-center gap-2"><span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${GROUP_TINT[e.group]}`}>{GROUP_LABEL[e.group]}</span><span className="min-w-0 flex-1 truncate text-[15px] font-medium text-slate-900">{e.title}{e.student && !student ? ` · ${e.student}` : ""}</span><span className="shrink-0 text-xs text-slate-500">{e.date ? friendlyDate(e.date, today) : ""}</span></span>
            {e.text && <span className="mt-0.5 line-clamp-2 block text-sm text-slate-500">{e.text}</span>}
            {e.src.kind === "pushin" && <span className="mt-0.5 block text-xs font-semibold text-sky-700">Opens in Minutes</span>}
          </button></li>
        ))}</ul> : <p className="px-4 pb-5 pt-3 text-sm text-slate-500">{entries.length ? "No notes match." : "No notes yet. Tap New note and pick what it is about. Every note about a student, a class or a meeting shows up here."}</p>}
      </section>
      {picking && (
        <HubModal title="New note" size="md" onClose={() => setPicking(false)}>
          <div className="grid gap-3" data-testid="iep-note-picker">
            {NEW_CHOICES.map((c) => (
              <div key={c.group} className="rounded-2xl p-3 ring-1 ring-slate-200">
                <div className="flex items-center gap-2"><span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${GROUP_TINT[c.group]}`}>{GROUP_LABEL[c.group]}</span><span className="text-[15px] font-semibold text-slate-900">{c.label}</span></div>
                <p className="mt-0.5 text-xs text-slate-500">{c.blurb}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">{c.kinds.map((k) => <button key={k} type="button" className={pill(false)} onClick={() => start(k)} data-testid="iep-note-kind">{k}</button>)}</div>
              </div>
            ))}
          </div>
        </HubModal>
      )}
      {editing && <NoteEditor note={editing} students={workspace.students.map((s) => s.name)} meetings={workspace.meetings} onSave={(n) => { save(n); setEditing(null); }} onDelete={() => { setWorkspace((w) => ({ ...w, iepNotes: cleanIepNotes(w.iepNotes).filter((x) => x.id !== editing.id) })); setEditing(null); }} onClose={() => setEditing(null)} />}
      {editingWork && <TextNoteEditor title={editingWork.title || editingWork.type || "Note"} initial={editingWork.body || ""} label="Note"
        onSave={(text) => { setWorkspace((w) => ({ ...w, notes: w.notes.map((x) => (x.id === editingWork.id ? { ...x, body: text, updatedAt: new Date().toISOString() } : x)) })); setEditingWork(null); }}
        onDelete={() => { setWorkspace((w) => ({ ...w, notes: w.notes.filter((x) => x.id !== editingWork.id) })); setEditingWork(null); }} onClose={() => setEditingWork(null)} />}
      {editingMeeting && <TextNoteEditor title={`${editingMeeting.type}${editingMeeting.student ? ` · ${editingMeeting.student}` : ""}`} initial={editingMeeting.notes || ""} label="Meeting notes"
        onSave={(text) => { setWorkspace((w) => ({ ...w, meetings: w.meetings.map((x) => (x.id === editingMeeting.id ? { ...x, notes: text } : x)) })); setEditingMeeting(null); }} onClose={() => setEditingMeeting(null)} />}
    </>
  );
}

/** A note that is one block of text: a student note written on the Notes screen, or a meeting's own notes. */
function TextNoteEditor({ title, initial, label, onSave, onDelete, onClose }: { title: string; initial: string; label: string; onSave: (text: string) => void; onDelete?: () => void; onClose: () => void }) {
  const [text, setText] = useState(initial);
  return (
    <HubModal title={title} size="lg" onClose={onClose}
      footer={<div className="flex flex-wrap items-center gap-2"><PrimaryButton onClick={() => onSave(text)}>Save</PrimaryButton><GhostButton onClick={onClose}>Cancel</GhostButton>{onDelete && <button type="button" onClick={onDelete} className="ml-auto inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-xs font-semibold text-red-700 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" />Delete</button>}</div>}>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}
        <textarea data-autofocus value={text} onChange={(e) => setText(e.target.value)} rows={10} className="mt-1 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-base font-normal normal-case tracking-normal text-slate-900 sm:text-sm" />
      </label>
    </HubModal>
  );
}

function NoteEditor({ note, students, meetings, onSave, onDelete, onClose }: { note: IepNote; students: string[]; meetings: Workspace["meetings"]; onSave: (n: IepNote) => void; onDelete: () => void; onClose: () => void }) {
  const [n, setN] = useState(note);
  const [copied, setCopied] = useState(false);
  const [heading, setHeading] = useState("");
  const theirs = meetings.filter((m) => m.student === n.student);
  const copy = async () => { try { await navigator.clipboard.writeText(noteText(n)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the clipboard is not allowed */ } };
  const print = () => { const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!); printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(n.kind)}</title><style>body{font:14px/1.5 -apple-system,Helvetica,Arial,sans-serif;margin:36px;color:#111}h1{font-size:20px;margin:0}small{color:#555}h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#444;margin:20px 0 4px}p{white-space:pre-wrap;margin:0}</style></head><body><h1>${esc(n.kind)}</h1><small>${esc(n.student)}${n.date ? ` · ${esc(n.date)}` : ""}</small>${Object.entries(n.sections).filter(([, v]) => v.trim()).map(([k, v]) => `<h2>${esc(k)}</h2><p>${esc(v)}</p>`).join("")}<script>onload=function(){setTimeout(function(){print()},250)}</script></body></html>`); };
  return (
    <HubModal title={n.kind} size="lg" onClose={onClose}
      footer={<div className="flex flex-wrap items-center gap-2"><PrimaryButton onClick={() => onSave(n)}>Save</PrimaryButton><GhostButton onClick={onClose}>Cancel</GhostButton><button type="button" onClick={() => void copy()} className={pill(false)}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy"}</button><button type="button" onClick={print} className={pill(false)}><Printer className="h-3.5 w-3.5" />Print</button><button type="button" onClick={onDelete} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete</button></div>}>
      <div className="grid gap-3" data-testid="iep-note-editor">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-slate-500">Student<select value={n.student} onChange={(e) => setN({ ...n, student: e.target.value })} className="mt-1 block min-h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-base font-normal text-slate-900 sm:text-sm"><option value="">No student</option>{[...new Set([...students, n.student].filter(Boolean))].map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-500">Date<input type="date" value={n.date} onChange={(e) => setN({ ...n, date: e.target.value })} className="mt-1 block min-h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-base font-normal text-slate-900 sm:text-sm" /></label>
        </div>
        {theirs.length > 0 && <label className="text-xs font-semibold text-slate-500">Meeting on the timeline<select value={n.meetingId || ""} onChange={(e) => setN({ ...n, meetingId: e.target.value || undefined })} className="mt-1 block min-h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-base font-normal text-slate-900 sm:text-sm"><option value="">None</option>{theirs.map((m) => <option key={m.id} value={m.id}>{m.type}{m.date ? ` · ${m.date.slice(0, 10)}` : ""}</option>)}</select></label>}
        {Object.keys(n.sections).map((k) => (
          <label key={k} className="block">
            <span className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">{k}<button type="button" onClick={() => { const { [k]: _gone, ...rest } = n.sections; setN({ ...n, sections: rest }); }} aria-label={`Remove ${k}`} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-3.5 w-3.5" /></button></span>
            <textarea value={n.sections[k]} onChange={(e) => setN({ ...n, sections: { ...n.sections, [k]: e.target.value } })} rows={3} className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-900 sm:text-sm" />
          </label>
        ))}
        <div className="flex gap-2"><input value={heading} onChange={(e) => setHeading(e.target.value)} placeholder="Add a heading" maxLength={80} className="min-h-10 flex-1 rounded-xl border border-slate-200 px-3 text-base sm:text-sm" /><button type="button" disabled={!heading.trim() || heading.trim() in n.sections} onClick={() => { setN({ ...n, sections: { ...n.sections, [heading.trim()]: "" } }); setHeading(""); }} className={pill(false) + " disabled:opacity-40"}><Plus className="h-3.5 w-3.5" />Add</button></div>
      </div>
    </HubModal>
  );
}

// ─── Accommodations ──────────────────────────────────────────────────────────

function Accommodations({ workspace, setWorkspace, studentId, onPick }: { workspace: Workspace; setWorkspace: Setter; studentId: string | null; onPick: (id: string) => void }) {
  const [typed, setTyped] = useState("");
  const student = workspace.students.find((s) => s.id === studentId);
  const setList = (id: string, list: string[]) => setWorkspace((w) => ({ ...w, students: w.students.map((s) => (s.id === id ? { ...s, accommodations: accommodationText(list) } : s)) }));
  const sheet = (list: typeof workspace.students) => {
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
    printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>Accommodations</title><style>body{font:14px/1.45 -apple-system,Helvetica,Arial,sans-serif;margin:36px;color:#111}h1{font-size:20px}section{break-inside:avoid;border:1px solid #ccc;border-radius:8px;padding:12px 14px;margin:12px 0}h2{font-size:16px;margin:0 0 6px}ul{margin:0;padding-left:18px}small{color:#666}</style></head><body><h1>Accommodations</h1><small>For general education teachers. Please keep confidential.</small>${list.map((s) => `<section><h2>${esc(s.name)}${s.grade ? ` · Grade ${esc(s.grade)}` : ""}</h2><ul>${accommodationList(s.accommodations).map((a) => `<li>${esc(a)}</li>`).join("") || "<li>None listed</li>"}</ul></section>`).join("")}<script>onload=function(){setTimeout(function(){print()},250)}</script></body></html>`);
  };
  if (!student) {
    const list = [...workspace.students].sort((a, b) => a.name.localeCompare(b.name));
    return (
      <section className={panel} data-testid="iep-accommodations">
        <div className="flex items-center justify-between gap-2 px-4 pt-4"><h3 className={h3}>Accommodations</h3>{list.length > 0 && <button type="button" onClick={() => sheet(list)} className={pill(false)}><Printer className="h-3.5 w-3.5" /> Print for teachers</button>}</div>
        {list.length ? <ul className="mx-2 divide-y divide-slate-100 pb-2">{list.map((s) => { const acc = accommodationList(s.accommodations); return (
          <li key={s.id}><button type="button" onClick={() => onPick(s.id)} className="block w-full px-2 py-3 text-left">
            <span className="block text-[15px] font-medium text-slate-900">{s.name}</span>
            <span className="mt-1 flex flex-wrap gap-1">{acc.length ? acc.slice(0, 6).map((a) => <span key={a} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">{a}</span>) : <span className="text-xs text-slate-400">None yet · tap to add</span>}{acc.length > 6 && <span className="text-[11px] text-slate-500">+{acc.length - 6}</span>}</span>
          </button></li>); })}</ul> : <p className="px-4 pb-4 pt-2 text-sm text-slate-500">Add students on the Profile tab first.</p>}
      </section>
    );
  }
  const acc = accommodationList(student.accommodations);
  const add = (a: string) => { if (a.trim()) setList(student.id, [...acc, a.trim()]); };
  return (
    <section className={`${panel} p-4`} data-testid="iep-accommodations">
      <div className="flex items-center justify-between gap-2"><h3 className={h3}>{student.name}'s accommodations</h3><button type="button" onClick={() => sheet([student])} className={pill(false)}><Printer className="h-3.5 w-3.5" /> Print</button></div>
      {acc.length ? <ul className="mt-3 divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200">{acc.map((a) => (
        <li key={a} className="flex items-center gap-2 px-3 py-2.5 text-[15px] text-slate-900"><Check className="h-4 w-4 shrink-0 text-emerald-600" /><span className="min-w-0 flex-1">{a}</span><button type="button" aria-label={`Remove ${a}`} onClick={() => setList(student.id, acc.filter((x) => x !== a))} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button></li>
      ))}</ul> : <p className="mt-3 text-sm text-slate-500">None yet.</p>}
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(typed); setTyped(""); }}><input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type an accommodation" maxLength={160} className="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 text-base sm:text-sm" /><PrimaryButton type="submit" disabled={!typed.trim()}>Add</PrimaryButton></form>
      <div className="mt-3"><span className={h3}>Common</span><div className="mt-1.5 flex flex-wrap gap-1.5">{COMMON_ACCOMMODATIONS.filter((c) => !acc.some((a) => a.toLowerCase() === c.toLowerCase())).map((c) => <button key={c} type="button" className={pill(false)} onClick={() => add(c)}><Plus className="h-3 w-3" />{c}</button>)}</div></div>
    </section>
  );
}

// ─── Progress monitoring ─────────────────────────────────────────────────────

function Progress({ workspace, setWorkspace, makeId, today, token, goals, student }: { workspace: Workspace; setWorkspace: Setter; makeId: () => string; today: string; token: string | null; goals: Goal[]; student: Workspace["students"][number] | null }) {
  const [score, setScore] = useState<{ goalId: string; date: string; value: string; note: string } | null>(null);
  const [quizFor, setQuizFor] = useState<string | null>(null);
  const [sheetFor, setSheetFor] = useState<Goal | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<Goal | null>(null);
  const files = cleanPmFiles(workspace.pmFiles);
  const rows = goals.map((g) => ({ g, s: pmStatus(g, today) })).sort((a, b) => ({ overdue: 0, "due soon": 1, "on schedule": 2, met: 3 }[a.s.state] - { overdue: 0, "due soon": 1, "on schedule": 2, met: 3 }[b.s.state]) || a.s.next.localeCompare(b.s.next));
  const counts = { overdue: rows.filter((r) => r.s.state === "overdue").length, soon: rows.filter((r) => r.s.state === "due soon").length };

  async function upload(list: FileList | null) {
    const g = uploadFor.current;
    if (!g || !list?.length) return;
    let used = driveBytesUsed(cleanDriveFiles((workspace as any).drive)) + files.reduce((n, f) => n + f.size, 0);
    const added: PmFile[] = [];
    setError("");
    for (const file of Array.from(list)) {
      setBusy(`Uploading ${file.name}…`);
      try {
        const res = await fetch(`${API_BASE}/api/lifehub/drive/upload`, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream", "x-drive-used-bytes": String(used), "x-drive-name": encodeURIComponent(file.name), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: file });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "That file could not be uploaded.");
        used += Number(data.size) || 0;
        added.push({ id: makeId(), goalId: g.id, student: g.student, date: today, name: file.name, path: data.path, size: Number(data.size) || 0, contentType: String(data.contentType || file.type || "") });
      } catch (e: any) { setError(`${file.name}: ${e.message}`); }
    }
    setBusy("");
    if (added.length) setWorkspace((w) => ({ ...w, pmFiles: [...cleanPmFiles(w.pmFiles), ...added] }));
    if (fileInput.current) fileInput.current.value = "";
  }
  async function open(f: PmFile) {
    const w = window.open("", "_blank");
    try {
      const res = await fetch(`${API_BASE}/api/lifehub/drive/url`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ path: f.path }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.message || "That file could not be opened.");
      if (w) w.location.href = data.url; else window.location.href = data.url;
    } catch (e: any) { w?.close(); setError(e.message); }
  }
  async function removeFile(f: PmFile) {
    setWorkspace((w) => ({ ...w, pmFiles: cleanPmFiles(w.pmFiles).filter((x) => x.id !== f.id) }));
    if (token) await fetch(`${API_BASE}/api/lifehub/drive/delete`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ path: f.path }) }).catch(() => {});
  }
  const value = score ? Number(score.value) : NaN;
  const quizGoals = quizFor ? workspace.goals.filter((g) => g.student === quizFor) : [];

  return (
    <>
      <section className={panel} data-testid="iep-progress">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <h3 className={h3}>Progress monitoring</h3>
          <span className="text-xs text-slate-500">{counts.overdue ? <b className="text-red-700">{counts.overdue} overdue</b> : null}{counts.overdue && counts.soon ? " · " : ""}{counts.soon ? <b className="text-amber-700">{counts.soon} due soon</b> : null}{!counts.overdue && !counts.soon && rows.length ? "All on schedule" : ""}</span>
        </div>
        <p className="px-4 pt-1 text-xs text-slate-500">You get a phone reminder 3 days before a check is due, the day before, and on the day.</p>
        {busy && <p className="px-4 pt-2 text-xs text-slate-600">{busy}</p>}
        {error && <p className="px-4 pt-2 text-xs text-red-700">{error}</p>}
        <input ref={fileInput} type="file" multiple accept="image/*,application/pdf,.doc,.docx" className="hidden" onChange={(e) => void upload(e.target.files)} />
        {rows.length ? <ul className="mx-2 divide-y divide-slate-100 pb-2">{rows.map(({ g, s }) => {
          const pr = goalProgress(g, today), look = PM_LOOK[s.state], mineFiles = files.filter((f) => f.goalId === g.id);
          return (
            <li key={g.id} className="px-2 py-3.5" data-testid="iep-pm-row" data-state={s.state}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-slate-900">{student ? g.area : `${g.student} · ${g.area}`}</div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{g.text}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${look.cls}`}>{look.word}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span>Latest <b className="text-slate-900">{pr.latest ?? "—"}</b>{g.unit ? ` ${g.unit}` : ""} · goal {g.target}</span>
                {s.state !== "met" && <span>Next check <b className={s.daysLeft < 0 ? "text-red-700" : s.daysLeft <= 3 ? "text-amber-700" : "text-slate-900"}>{friendlyDate(s.next, today)}</b> ({daysWords(s.daysLeft)})</span>}
                <label className="inline-flex items-center gap-1">Every <select value={checkEvery(g)} onChange={(e) => setWorkspace((w) => ({ ...w, goals: w.goals.map((x) => (x.id === g.id ? { ...x, checkEvery: Number(e.target.value) } : x)) }))} aria-label="How often to check" className="min-h-8 rounded-lg border border-slate-200 bg-white px-1 text-xs font-semibold text-slate-800" data-testid="iep-pm-every">{CHECK_CHOICES.map((d) => <option key={d} value={d}>{d} days</option>)}</select></label>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${pr.status === "behind" ? "bg-red-500" : pr.status === "close" ? "bg-amber-500" : "bg-slate-900"}`} style={{ width: `${pr.percent}%` }} /></div>
              {mineFiles.length > 0 && <ul className="mt-2 flex flex-wrap gap-1.5">{mineFiles.map((f) => <li key={f.id} className="inline-flex items-center gap-1 rounded-lg bg-slate-50 pl-2 text-xs text-slate-700 ring-1 ring-slate-200"><button type="button" onClick={() => void open(f)} className="inline-flex min-h-8 max-w-[12rem] items-center gap-1 truncate"><Paperclip className="h-3 w-3 shrink-0" /><span className="truncate">{f.name}</span><span className="text-slate-400">{f.date ? ` · ${f.date.slice(5)}` : ""}</span></button><button type="button" aria-label={`Remove ${f.name}`} onClick={() => void removeFile(f)} className="inline-flex h-8 w-7 items-center justify-center text-slate-400 hover:text-red-600"><X className="h-3 w-3" /></button></li>)}</ul>}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <button type="button" className={pill(s.state === "overdue" || s.state === "due soon")} onClick={() => setScore({ goalId: g.id, date: today, value: "", note: "" })} data-testid="iep-pm-score"><Plus className="h-3.5 w-3.5" /> Add score</button>
                <button type="button" className={pill(false)} onClick={() => { uploadFor.current = g; fileInput.current?.click(); }} data-testid="iep-pm-upload"><Upload className="h-3.5 w-3.5" /> Upload work</button>
                <button type="button" className={pill(false)} onClick={() => printHtml(pmSheetHtml(g, workspace.students.find((x) => x.name === g.student) ?? null))} data-testid="iep-pm-sheet"><FileText className="h-3.5 w-3.5" /> Data sheet</button>
                <button type="button" className={pill(false)} onClick={() => setSheetFor(g)} data-testid="iep-pm-worksheet"><Sparkles className="h-3.5 w-3.5" /> Worksheet</button>
                <button type="button" className={pill(false)} onClick={() => setQuizFor(g.student)} data-testid="iep-pm-quiz"><Sparkles className="h-3.5 w-3.5" /> Quiz</button>
              </div>
            </li>
          );
        })}</ul> : <p className="px-4 pb-5 pt-3 text-sm text-slate-500">No goals yet. Add one below and it gets a check every two weeks.</p>}
      </section>
      {student && <section className={`${panel} p-4`}><h3 className={`${h3} mb-2`}>{student.name}'s quizzes</h3><StudentQuizzes student={student.name} onMake={() => setQuizFor(student.name)} setWorkspace={(u) => setWorkspace((w) => u(w))} makeId={makeId} /></section>}

      {score && (() => { const g = workspace.goals.find((x) => x.id === score.goalId); if (!g) return null; return (
        <HubModal title={`Score · ${g.student}`} size="sm" onClose={() => setScore(null)}
          footer={<div className="flex gap-2"><PrimaryButton disabled={!Number.isFinite(value) || score.value.trim() === ""} onClick={() => { setWorkspace((w) => ({ ...w, goals: w.goals.map((x) => (x.id === g.id ? withPoint(x, { id: makeId(), date: score.date || today, value, note: score.note.trim() }) : x)) })); setScore(null); }}>Save</PrimaryButton><GhostButton onClick={() => setScore(null)}>Cancel</GhostButton></div>}>
          <div className="grid gap-3" data-testid="iep-pm-score-form">
            <p className="text-sm text-slate-600">{g.text}</p>
            <label className="text-xs font-semibold text-slate-500">Score{g.unit ? ` (${g.unit})` : ""}<input data-autofocus type="number" inputMode="decimal" step="any" value={score.value} onChange={(e) => setScore({ ...score, value: e.target.value })} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 px-3 text-base text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-500">Date<input type="date" value={score.date} onChange={(e) => setScore({ ...score, date: e.target.value })} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 px-3 text-base text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-500">Note<input value={score.note} onChange={(e) => setScore({ ...score, note: e.target.value })} maxLength={200} placeholder="8 of 10 trials, with prompts…" className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 px-3 text-base text-slate-900" /></label>
          </div>
        </HubModal>
      ); })()}
      {quizFor && <MakeGoalQuiz student={quizFor} grade={workspace.students.find((s) => s.name === quizFor)?.grade || ""} goals={quizGoals} token={token} setWorkspace={(u) => setWorkspace((w) => u(w))} onClose={() => setQuizFor(null)} onDone={() => setQuizFor(null)} />}
      {sheetFor && <WorksheetMaker token={token} state="" className={sheetFor.student} lessons={[]} start={{ topic: `Progress monitoring probe: ${sheetFor.text}`, kind: "quiz", level: "modified for students with IEPs (simplified language, fewer choices, bigger spaces)", count: 10, grade: workspace.students.find((s) => s.name === sheetFor.student)?.grade || "", subject: sheetFor.area === "Math" ? "Math" : sheetFor.area === "Writing" ? "Writing" : sheetFor.area === "Reading" ? "Reading" : "Other" }} onSave={() => {}} onClose={() => setSheetFor(null)} />}
    </>
  );
}
