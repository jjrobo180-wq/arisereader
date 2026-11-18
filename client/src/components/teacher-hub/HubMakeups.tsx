// Arise WorkHub: Makeup tests (a Plugin Gallery plugin). One makeup is a test or quiz for one or more students:
// missed when and why, made up when and where (and who proctors), their accommodations, each score, notes, and
// attached photos, PDFs and links. It goes on the calendar and the to-do list, its notes save to Notes (where the
// AI note tools are), and it shows on each student's profile. The rules are shared/hubMakeups.ts.
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { AlertTriangle, CalendarPlus, Check, ChevronDown, FileCheck, ListTodo, NotebookPen, Pencil, Plus, Printer, Trash2, UserPlus, X } from "lucide-react";
import {
  MAKEUP_STATUSES, MAKEUP_STATUS_LABEL, MISSED_REASONS, accommodationsOf, cleanMakeups, fromKitRecords, isClosed, makeupTitle, overdue,
  type Makeup, type MakeupStatus,
} from "@shared/hubMakeups";
import type { HubLink } from "@shared/hubLinks";
import type { HubEvent, NoteItem, Task, Workspace } from "@shared/teacherHub";
import { printHtml } from "@/lib/lessonExport";
import { LinkEditor, useHubLinks } from "./HubLinks";
import { Card, Empty, Field, Labeled, Select, TextArea } from "./ui";

const day = (d: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) : "");
const clock = (t: string) => { if (!t) return ""; const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const STATUS_LOOK: Record<MakeupStatus, string> = { "to-schedule": "bg-amber-50 text-amber-900 ring-amber-200", scheduled: "bg-sky-50 text-sky-800 ring-sky-200", done: "bg-emerald-50 text-emerald-800 ring-emerald-200", excused: "bg-slate-100 text-slate-600 ring-slate-200" };
const pill = (on: boolean) => `inline-flex min-h-10 items-center gap-1 rounded-full border px-3 text-sm font-semibold transition ${on ? "border-violet-700 bg-violet-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;

type Draft = Omit<Makeup, "id" | "createdAt" | "updatedAt" | "scores" | "links" | "noteId" | "eventId" | "taskId"> & { calendar: boolean; todo: boolean };
const blank = (today: string): Draft => ({ students: [], test: "", subject: "", missedOn: today, reason: "Absent", date: "", start: "", end: "", where: "", proctor: "", accommodations: "", status: "to-schedule", notes: "", calendar: true, todo: true });

export default function HubMakeups({ workspace, setWorkspace, today, makeId, say, openStudent }: {
  workspace: Workspace; setWorkspace: Dispatch<SetStateAction<Workspace>>; today: string; makeId: () => string; say: (text: string) => void; openStudent?: (name: string) => void;
}) {
  const links = useHubLinks();
  const makeups = useMemo(() => cleanMakeups((workspace as any).makeups), [(workspace as any).makeups]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | MakeupStatus | "all">("open");
  const [who, setWho] = useState("");
  const [newName, setNewName] = useState("");
  const [asSupplementary, setAsSupplementary] = useState(true);
  const names = useMemo(() => workspace.students.map((s) => s.name).sort((a, b) => a.localeCompare(b)), [workspace.students]);
  const oldRows = ((workspace as any).kitRecords || []).filter((r: any) => r?.plugin === "makeup-tests");
  const imported = (workspace as any).makeupsImported === true;

  const idsOf = (students: string[]) => students.map((n) => workspace.students.find((s) => s.name.trim().toLowerCase() === n.trim().toLowerCase())?.id).filter((x): x is string => !!x);
  /** The makeup's calendar event and to-do, made, changed or taken away to match it. */
  function sideEffects(w: Workspace, m: Makeup, want: { calendar: boolean; todo: boolean }): { w: Workspace; m: Makeup } {
    let events = w.events, tasks = w.tasks, next = { ...m };
    const title = makeupTitle(m);
    if (want.calendar && m.date && m.status !== "excused") {
      const ev = { title, date: m.date, start: m.start, end: m.end, location: m.where, notes: [m.proctor && `Proctor: ${m.proctor}`, m.accommodations].filter(Boolean).join("\n"), students: m.students } as Partial<HubEvent>;
      if (m.eventId && events.some((e) => e.id === m.eventId)) events = events.map((e) => (e.id === m.eventId ? { ...e, ...ev } : e));
      else { next.eventId = makeId(); events = [...events, { id: next.eventId, ...ev } as HubEvent]; }
    } else if (m.eventId) { events = events.filter((e) => e.id !== m.eventId); delete next.eventId; }
    if (want.todo) {
      const sids = idsOf(m.students);
      const t = { title: `Give ${title.replace(/^Makeup: /, "makeup: ")}`, dueDate: m.date, done: isClosed(m), ...(sids.length ? { links: sids.map((id) => ({ kind: "student" as const, id })) } : {}) };
      if (m.taskId && tasks.some((x) => x.id === m.taskId)) tasks = tasks.map((x) => (x.id === m.taskId ? { ...x, ...t } : x));
      else { next.taskId = makeId(); tasks = [{ id: next.taskId, recurring: "", ...t } as Task, ...tasks]; }
    } else if (m.taskId) { tasks = tasks.filter((x) => x.id !== m.taskId); delete next.taskId; }
    return { w: { ...w, events, tasks }, m: next };
  }
  const writeOne = (id: string, change: (m: Makeup) => Makeup, keep = true) => setWorkspace((w) => {
    const list = cleanMakeups((w as any).makeups);
    const old = list.find((x) => x.id === id);
    if (!old) return w;
    let m = { ...change(old), updatedAt: new Date().toISOString() };
    let next = w;
    if (keep) { const r = sideEffects(w, m, { calendar: !!old.eventId, todo: !!old.taskId }); next = r.w; m = r.m; }
    return { ...next, makeups: list.map((x) => (x.id === id ? m : x)) } as Workspace;
  });

  function save() {
    if (!draft || !draft.students.length || !draft.test.trim()) return;
    const { calendar, todo, ...fields } = draft;
    const now = new Date().toISOString();
    const status: MakeupStatus = fields.status === "to-schedule" && fields.date ? "scheduled" : fields.status;
    const newId = editId ? "" : makeId();
    setWorkspace((w) => {
      const list = cleanMakeups((w as any).makeups);
      const old = editId ? list.find((x) => x.id === editId) : undefined;
      const base: Makeup = old ? { ...old, ...fields, status, test: fields.test.trim(), updatedAt: now }
        : { ...fields, status, test: fields.test.trim(), id: newId, scores: {}, links: [], createdAt: now, updatedAt: now };
      const r = sideEffects(w, base, { calendar, todo });
      return { ...r.w, makeups: old ? list.map((x) => (x.id === old.id ? r.m : x)) : [r.m, ...list] } as Workspace;
    });
    if (newId) setOpenId(newId);
    say(editId ? "Makeup updated." : `Makeup saved${calendar && draft.date ? ", on your calendar" : ""}${todo ? " and on your to-dos" : ""}.`);
    setDraft(null); setEditId(null);
  }
  function addNewStudent() {
    const name = newName.replace(/\s+/g, " ").trim();
    if (!name || !draft) return;
    const known = names.find((n) => n.toLowerCase() === name.toLowerCase());
    if (!known && asSupplementary) setWorkspace((w) => (w.students.some((s) => s.name.toLowerCase() === name.toLowerCase()) ? w : { ...w, students: [...w.students, { id: makeId(), name, grade: "", accommodations: "", iepDate: "", reevalDate: "", readingLevel: "", mathLevel: "", notes: "", supplementary: true }] }));
    const pick = known || name;
    if (!draft.students.includes(pick)) setDraft({ ...draft, students: [...draft.students, pick] });
    setNewName("");
  }
  /** The makeup's notes saved as a note in Notes (with the students and the attachments linked), made or kept up to date. */
  function saveToNotes(m: Makeup) {
    const body = [`${m.test}${m.subject ? ` (${m.subject})` : ""}`, m.missedOn ? `Missed ${day(m.missedOn)}${m.reason ? ` · ${m.reason}` : ""}` : "", m.date ? `Makeup ${day(m.date)}${m.start ? ` ${clock(m.start)}` : ""}${m.where ? ` · ${m.where}` : ""}${m.proctor ? ` · Proctor: ${m.proctor}` : ""}` : "",
      m.accommodations ? `Accommodations:\n${m.accommodations}` : "", Object.keys(m.scores).length ? `Scores: ${Object.entries(m.scores).map(([n, s]) => `${n} ${s}`).join(", ")}` : "", m.notes].filter(Boolean).join("\n\n");
    const sids = idsOf(m.students);
    const noteLinks: HubLink[] = [...sids.map((id) => ({ kind: "student" as const, id })), ...m.links.filter((l) => l.kind === "file")];
    const noteId = m.noteId || makeId();
    setWorkspace((w) => {
      const note: NoteItem = { ...(w.notes.find((n) => n.id === noteId) || {}), id: noteId, student: m.students[0], ...(m.students.length > 1 ? { students: m.students } : {}), type: "Makeup test", title: `Makeup: ${m.test}`, body, date: today, links: noteLinks, updatedAt: new Date().toISOString() } as NoteItem;
      const notes = w.notes.some((n) => n.id === noteId) ? w.notes.map((n) => (n.id === noteId ? note : n)) : [note, ...w.notes];
      return { ...w, notes, makeups: cleanMakeups((w as any).makeups).map((x) => (x.id === m.id ? { ...x, noteId } : x)) } as Workspace;
    });
    say(m.noteId ? "The note in Notes is up to date." : "Saved to Notes. Open it there to use the AI note tools.");
  }
  function remove(m: Makeup) {
    if (!window.confirm(`Delete the makeup "${m.test}" for ${m.students.join(", ")}? Its calendar event and to-do go too (the note in Notes stays).`)) return;
    setWorkspace((w) => ({ ...w, events: w.events.filter((e) => e.id !== m.eventId), tasks: w.tasks.filter((t) => t.id !== m.taskId), makeups: cleanMakeups((w as any).makeups).filter((x) => x.id !== m.id) } as Workspace));
  }
  const print = (m: Makeup) => printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(m.test)}</title><style>body{font:14px/1.5 -apple-system,Segoe UI,Arial,sans-serif;margin:36px}h1{font-size:20px;margin:0}h2{font-size:13px;text-transform:uppercase;color:#555;margin:16px 0 4px}p{margin:0;white-space:pre-wrap}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px 10px;text-align:left}</style></head><body>
<h1>Makeup: ${esc(m.test)}</h1><p>${esc([m.subject, m.date && `${day(m.date)}${m.start ? ` ${clock(m.start)}` : ""}${m.end ? `–${clock(m.end)}` : ""}`, m.where, m.proctor && `Proctor: ${m.proctor}`].filter(Boolean).join(" · "))}</p>
<h2>Students</h2><table><tr><th>Student</th><th>Score</th></tr>${m.students.map((n) => `<tr><td>${esc(n)}</td><td>${esc(m.scores[n] || "")}</td></tr>`).join("")}</table>
${m.missedOn ? `<h2>Missed</h2><p>${esc(day(m.missedOn))}${m.reason ? ` · ${esc(m.reason)}` : ""}</p>` : ""}${m.accommodations ? `<h2>Accommodations</h2><p>${esc(m.accommodations)}</p>` : ""}${m.notes ? `<h2>Notes</h2><p>${esc(m.notes)}</p>` : ""}</body></html>`);
  const edit = (m: Makeup) => { const { id: _i, createdAt: _c, updatedAt: _u, scores: _s, links: _l, noteId: _n, eventId, taskId, ...rest } = m; setDraft({ ...rest, calendar: !!eventId, todo: !!taskId }); setEditId(m.id); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const shown = makeups.filter((m) => (filter === "all" || (filter === "open" ? !isClosed(m) : m.status === filter)) && (!who || m.students.includes(who)))
    .sort((a, b) => Number(isClosed(a)) - Number(isClosed(b)) || Number(overdue(b, today)) - Number(overdue(a, today)) || (a.date || "9999").localeCompare(b.date || "9999"));
  const lateCount = makeups.filter((m) => overdue(m, today)).length;

  return (
    <div className="space-y-5" data-testid="hub-makeups">
      {!imported && oldRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-violet-50 p-4 text-sm text-violet-950 ring-1 ring-violet-100">
          <span className="flex-1">You have {oldRows.length} {oldRows.length === 1 ? "makeup" : "makeups"} in the old Makeup tests list. Bring them in here?</span>
          <button type="button" onClick={() => { setWorkspace((w) => ({ ...w, makeups: [...fromKitRecords((w as any).kitRecords || [], makeId, new Date().toISOString()), ...cleanMakeups((w as any).makeups)], makeupsImported: true } as Workspace)); say("Brought in from the old list."); }} className="min-h-11 rounded-xl bg-violet-700 px-4 font-bold text-white hover:bg-violet-800" data-testid="makeups-import">Bring them in</button>
          <button type="button" onClick={() => setWorkspace((w) => ({ ...w, makeupsImported: true } as Workspace))} className="min-h-11 rounded-xl px-3 font-semibold text-violet-800 hover:bg-violet-100">No thanks</button>
        </div>
      )}

      {draft ? (
        <Card title={editId ? "Edit makeup" : "New makeup"}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4" data-testid="makeup-form">
            <div className="md:col-span-4">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Students</p>
              <div className="flex flex-wrap gap-1.5">
                {draft.students.map((n) => <span key={n} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-violet-100 pl-3 pr-1 text-sm font-semibold text-violet-900">{n}<button type="button" onClick={() => setDraft({ ...draft, students: draft.students.filter((x) => x !== n) })} aria-label={`Remove ${n}`} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-violet-200"><X className="h-3.5 w-3.5" /></button></span>)}
                {!draft.students.length && <span className="text-sm text-slate-500">Pick one or more students.</span>}
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Select value="" onChange={(e) => { const v = e.target.value; if (v && !draft.students.includes(v)) setDraft({ ...draft, students: [...draft.students, v] }); }} aria-label="Add a student" data-testid="makeup-student-pick">
                  <option value="">Add a student…</option>{names.filter((n) => !draft.students.includes(n)).map((n) => <option key={n}>{n}</option>)}
                </Select>
                <Field value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNewStudent(); } }} placeholder="Or type a new student's name" aria-label="New student's name" />
                <button type="button" onClick={addNewStudent} disabled={!newName.trim()} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"><UserPlus className="h-4 w-4" /> Add</button>
              </div>
              <label className="mt-1 flex min-h-10 items-center gap-2 text-xs text-slate-600"><input type="checkbox" className="h-4 w-4" checked={asSupplementary} onChange={(e) => setAsSupplementary(e.target.checked)} /> Give a new student a profile (as a supplementary student)</label>
            </div>
            <Labeled label="Test or quiz" className="md:col-span-2"><Field value={draft.test} onChange={(e) => setDraft({ ...draft, test: e.target.value })} placeholder="Unit 3 test" data-testid="makeup-test" /></Labeled>
            <Labeled label="Class / subject"><Field value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="Math 7" /></Labeled>
            <Labeled label="Status"><Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as MakeupStatus })}>{MAKEUP_STATUSES.map((s) => <option key={s} value={s}>{MAKEUP_STATUS_LABEL[s]}</option>)}</Select></Labeled>
            <Labeled label="Missed on"><Field type="date" value={draft.missedOn} onChange={(e) => setDraft({ ...draft, missedOn: e.target.value })} /></Labeled>
            <Labeled label="Why"><Select value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })}>{MISSED_REASONS.map((r) => <option key={r}>{r}</option>)}</Select></Labeled>
            <Labeled label="Makeup day"><Field type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></Labeled>
            <div className="grid grid-cols-2 gap-2"><Labeled label="Starts"><Field type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} /></Labeled><Labeled label="Ends"><Field type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} /></Labeled></div>
            <Labeled label="Where" className="md:col-span-2"><Field value={draft.where} onChange={(e) => setDraft({ ...draft, where: e.target.value })} placeholder="Room 214, testing center, lunch…" /></Labeled>
            <Labeled label="Proctor" className="md:col-span-2"><Field value={draft.proctor} onChange={(e) => setDraft({ ...draft, proctor: e.target.value })} placeholder="Who gives it" /></Labeled>
            <div className="md:col-span-4">
              <div className="mb-1 flex items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Accommodations</span>
                <button type="button" onClick={() => setDraft({ ...draft, accommodations: accommodationsOf(draft.students, workspace.students) || draft.accommodations })} disabled={!draft.students.length} className="text-xs font-semibold text-violet-800 underline disabled:opacity-40">Fill from their profiles</button></div>
              <TextArea value={draft.accommodations} onChange={(e) => setDraft({ ...draft, accommodations: e.target.value })} rows={2} placeholder="Extended time, small group, read aloud…" />
            </div>
            <Labeled label="Notes" className="md:col-span-4"><TextArea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3} placeholder="Anything to remember about this makeup." /></Labeled>
            <div className="flex flex-wrap gap-x-5 md:col-span-4">
              <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-5 w-5" checked={draft.calendar} onChange={(e) => setDraft({ ...draft, calendar: e.target.checked })} /><CalendarPlus className="h-4 w-4 text-violet-700" /> On my calendar (once it has a day)</label>
              <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-5 w-5" checked={draft.todo} onChange={(e) => setDraft({ ...draft, todo: e.target.checked })} /><ListTodo className="h-4 w-4 text-violet-700" /> On my to-dos</label>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={!draft.students.length || !draft.test.trim()} data-testid="makeup-save" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"><Check className="h-4 w-4" /> Save makeup</button>
            <button type="button" onClick={() => { setDraft(null); setEditId(null); }} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => { setDraft(blank(today)); setEditId(null); }} data-testid="makeup-new" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-bold text-white hover:bg-slate-800"><FileCheck className="h-4 w-4" /> New makeup</button>
          <Select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Show one student" className="!w-auto"><option value="">Every student</option>{[...new Set(makeups.flatMap((m) => m.students))].sort().map((n) => <option key={n}>{n}</option>)}</Select>
          {lateCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900"><AlertTriangle className="h-3.5 w-3.5" /> {lateCount} past due</span>}
        </div>
      )}

      <Card title="Makeup tests">
        <div className="mb-3 flex flex-wrap gap-1.5">{(["open", "to-schedule", "scheduled", "done", "excused", "all"] as const).map((f) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={pill(filter === f)}>{f === "open" ? "Still to give" : f === "all" ? "All" : MAKEUP_STATUS_LABEL[f]}</button>)}</div>
        {shown.length ? <ul className="space-y-2">{shown.map((m) => {
          const open = openId === m.id;
          return (
            <li key={m.id} className="rounded-2xl border border-slate-200 bg-white" data-testid="makeup-row">
              <button type="button" onClick={() => setOpenId(open ? null : m.id)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-2 p-3 text-left">
                <span className="min-w-0 flex-1"><span className="block font-bold text-slate-900">{m.test}{m.subject ? <span className="font-semibold text-slate-500"> · {m.subject}</span> : null}</span>
                  <span className="block text-xs text-slate-500">{m.students.join(", ")} · {m.date ? `${day(m.date)}${m.start ? ` ${clock(m.start)}` : ""}${m.where ? ` · ${m.where}` : ""}` : "No day yet"}{m.links.length ? ` · ${m.links.length} attached` : ""}</span></span>
                {overdue(m, today) && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900"><AlertTriangle className="h-3 w-3" /> Past due</span>}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${STATUS_LOOK[m.status]}`}>{MAKEUP_STATUS_LABEL[m.status]}</span>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "" : "-rotate-90"}`} />
              </button>
              {open && (
                <div className="space-y-4 border-t border-slate-100 p-3 text-sm">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-slate-600 md:grid-cols-2">
                    {m.missedOn && <div><dt className="inline font-semibold">Missed: </dt><dd className="inline">{day(m.missedOn)}{m.reason ? ` · ${m.reason}` : ""}</dd></div>}
                    {m.proctor && <div><dt className="inline font-semibold">Proctor: </dt><dd className="inline">{m.proctor}</dd></div>}
                    {m.accommodations && <div className="md:col-span-2"><dt className="font-semibold">Accommodations</dt><dd className="whitespace-pre-wrap">{m.accommodations}</dd></div>}
                    <div className="md:col-span-2"><dt className="inline font-semibold">Also on: </dt><dd className="inline">{[m.eventId && "your calendar", m.taskId && "your to-dos", m.noteId && "Notes"].filter(Boolean).join(", ") || "nowhere else yet"}</dd></div>
                  </dl>
                  <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Scores</p>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{m.students.map((n) => (
                      <label key={n} className="flex items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-1.5"><button type="button" onClick={() => openStudent?.(n)} className="min-w-0 flex-1 truncate text-left font-semibold text-slate-800 hover:underline">{n}</button>
                        <Field value={m.scores[n] || ""} onChange={(e) => writeOne(m.id, (x) => ({ ...x, scores: { ...x.scores, [n]: e.target.value.slice(0, 20) } }), false)} placeholder="Score" aria-label={`${n}'s score`} className="!w-28" /></label>
                    ))}</div>
                  </div>
                  <Labeled label="Notes"><TextArea value={m.notes} onChange={(e) => writeOne(m.id, (x) => ({ ...x, notes: e.target.value }), false)} rows={4} placeholder="How it went, what they needed, anything to follow up on." data-testid="makeup-notes" /></Labeled>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => saveToNotes(m)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-violet-700 px-3 text-sm font-bold text-white hover:bg-violet-800" data-testid="makeup-to-notes"><NotebookPen className="h-4 w-4" /> {m.noteId ? "Update the note in Notes" : "Save to Notes"}</button>
                    {m.noteId && links?.openLink && <button type="button" onClick={() => links.openLink({ kind: "note", id: m.noteId! })} className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Open in Notes (AI tools)</button>}
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="mb-2 text-xs text-slate-600">Attach photos and PDFs (the test, a student's work, a note from home), or link a note, goal or anything else.</p>
                    <LinkEditor workspace={workspace} links={m.links} onChange={(next) => writeOne(m.id, (x) => ({ ...x, links: next }), false)} text={`${m.test} ${m.notes}`} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
                    <span className="text-xs font-semibold text-slate-500">Status:</span>
                    {MAKEUP_STATUSES.map((s) => <button key={s} type="button" aria-pressed={m.status === s} onClick={() => writeOne(m.id, (x) => ({ ...x, status: s }))} className={`min-h-9 rounded-full px-3 text-xs font-bold ring-1 ${m.status === s ? STATUS_LOOK[s] : "bg-white text-slate-500 ring-slate-200"}`}>{MAKEUP_STATUS_LABEL[s]}</button>)}
                    <span className="flex-1" />
                    <button type="button" onClick={() => print(m)} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"><Printer className="h-3.5 w-3.5" /> Print</button>
                    <button type="button" onClick={() => edit(m)} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                    <button type="button" onClick={() => remove(m)} aria-label="Delete makeup" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </li>
          );
        })}</ul> : <Empty>{makeups.length ? "Nothing here with this filter." : <span className="inline-flex items-center gap-1">No makeups yet. Tap <Plus className="h-3.5 w-3.5" /> New makeup.</span>}</Empty>}
      </Card>
    </div>
  );
}
