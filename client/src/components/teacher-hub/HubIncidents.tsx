// Arise WorkHub: Incident reports (a Plugin Gallery plugin). Write up what happened with a student, what was done,
// and a check-in plan (who to check with, on which days, until when). Today's check-ins are at the top to log.
// The reports and their check-ins show on the student's profile. The rules are shared/hubIncidents.ts.
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { AlertTriangle, CalendarPlus, Check, ChevronDown, ClipboardList, Pencil, Plus, Printer, ShieldAlert, Trash2 } from "lucide-react";
import {
  CHECK_RESULTS, CHECK_RESULT_LABEL, CHECK_WITH_PRESETS, INCIDENT_STATUSES, INCIDENT_TYPES, SEVERITIES, SEVERITY_LABEL, STATUS_LABEL, WEEKDAY_NAMES,
  addDaysTo, checksDue, cleanIncidents, missedChecks, nextCheckDay, planWords,
  type CheckResult, type Incident, type IncidentStatus,
} from "@shared/hubIncidents";
import type { HubEvent, Workspace } from "@shared/teacherHub";
import { printHtml } from "@/lib/lessonExport";
import { Card, Empty, Field, Labeled, Select, TextArea } from "./ui";

const day = (d: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) : "");
const SEV_LOOK: Record<string, string> = { low: "bg-slate-100 text-slate-700", medium: "bg-amber-100 text-amber-900", high: "bg-rose-100 text-rose-800" };
const STATUS_LOOK: Record<IncidentStatus, string> = { open: "bg-rose-50 text-rose-700 ring-rose-200", monitoring: "bg-amber-50 text-amber-800 ring-amber-200", closed: "bg-slate-100 text-slate-600 ring-slate-200" };
const RESULT_LOOK: Record<CheckResult, string> = { good: "bg-emerald-600 text-white", okay: "bg-sky-600 text-white", concern: "bg-rose-600 text-white" };
const chip = (on: boolean) => `inline-flex min-h-10 items-center gap-1 rounded-full border px-3 text-sm font-semibold transition ${on ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

type Draft = Omit<Incident, "id" | "createdAt" | "updatedAt" | "checkIns"> & { addToCalendar: boolean };
const blank = (today: string, student = ""): Draft => ({
  student, date: today, time: "", type: "Bullying", severity: "medium", where: "", summary: "", others: "", actions: "", reportedTo: "", parentContacted: false,
  status: "open", checkWith: ["Student"], checkDays: [1, 3, 5], checkUntil: addDaysTo(today, 14), addToCalendar: true,
});

export default function HubIncidents({ workspace, setWorkspace, today, makeId, say, students, openStudent }: {
  workspace: Workspace; setWorkspace: Dispatch<SetStateAction<Workspace>>; today: string; makeId: () => string; say: (text: string) => void;
  students: string[]; openStudent?: (name: string) => void;
}) {
  const incidents = useMemo(() => cleanIncidents((workspace as any).incidents), [(workspace as any).incidents]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | IncidentStatus | "all">("active");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const setIncidents = (fn: (list: Incident[]) => Incident[], extra?: (w: Workspace) => Partial<Workspace>) =>
    setWorkspace((w) => { const next = fn(cleanIncidents((w as any).incidents)); return { ...w, ...(extra ? extra(w) : {}), incidents: next } as Workspace; });
  const due = checksDue(incidents, today);
  const classesOf = (student: string) => [...new Set(workspace.schedules.filter((s) => s.student.trim().toLowerCase() === student.trim().toLowerCase() && s.label.trim()).map((s) => s.label.trim()))].slice(0, 12);

  /** The repeating calendar event for a report's check-ins (Calendar's "On certain days" repeat). */
  const eventFor = (i: Pick<Incident, "student" | "date" | "checkDays" | "checkUntil" | "checkWith">, id: string): HubEvent => ({
    id, title: `Check in: ${i.student}`, date: i.date, start: "", end: "", location: "", notes: planWords(i), repeat: "Days", days: i.checkDays, ...(i.checkUntil ? { until: i.checkUntil } : {}), students: [i.student],
  } as HubEvent);

  function save() {
    if (!draft || !draft.student.trim() || !draft.summary.trim()) return;
    const now = new Date().toISOString();
    const { addToCalendar, ...fields } = draft;
    const wantsEvent = addToCalendar && fields.status !== "closed" && fields.checkWith.length > 0 && fields.checkDays.length > 0;
    if (editId) {
      setWorkspace((w) => {
        const list = cleanIncidents((w as any).incidents);
        const old = list.find((i) => i.id === editId);
        if (!old) return w;
        let events = w.events, eventId = old.eventId;
        if (wantsEvent) {
          if (eventId && events.some((e) => e.id === eventId)) events = events.map((e) => (e.id === eventId ? { ...e, ...eventFor(fields, eventId!) } : e));
          else { eventId = makeId(); events = [...events, eventFor(fields, eventId)]; }
        } else if (eventId) { events = events.filter((e) => e.id !== eventId); eventId = undefined; }
        const { eventId: _old, ...keep } = old;
        return { ...w, events, incidents: list.map((i) => (i.id === editId ? { ...keep, ...fields, ...(eventId ? { eventId } : {}), updatedAt: now } : i)) } as Workspace;
      });
      say("Incident report updated.");
    } else {
      const id = makeId(), evId = wantsEvent ? makeId() : "";
      const incident: Incident = { ...fields, id, checkIns: [], ...(evId ? { eventId: evId } : {}), createdAt: now, updatedAt: now };
      setIncidents((list) => [incident, ...list], (w) => (evId ? { events: [...w.events, eventFor(fields, evId)] } : {}));
      setOpenId(id);
      say(wantsEvent ? "Incident report saved. The check-ins are on your calendar too." : "Incident report saved.");
    }
    setDraft(null); setEditId(null);
  }

  function logCheck(incidentId: string, withWho: string, result: CheckResult, date = today) {
    const key = `${incidentId}|${withWho}|${date}`;
    const note = (notes[key] || "").trim();
    setIncidents((list) => list.map((i) => (i.id !== incidentId ? i : {
      ...i, updatedAt: new Date().toISOString(),
      checkIns: [...i.checkIns.filter((c) => !(c.date === date && c.with.toLowerCase() === withWho.toLowerCase())), { id: makeId(), date, with: withWho, result, note }],
    })));
    setNotes((n) => { const { [key]: _, ...rest } = n; return rest; });
  }
  // Closing a report takes its check-ins off the calendar.
  const setStatus = (id: string, status: IncidentStatus) => setWorkspace((w) => {
    const list = cleanIncidents((w as any).incidents);
    const ev = status === "closed" ? list.find((i) => i.id === id)?.eventId : undefined;
    return { ...w, ...(ev ? { events: w.events.filter((e) => e.id !== ev) } : {}),
      incidents: list.map((i) => { if (i.id !== id) return i; const { eventId, ...rest } = i; return { ...rest, ...(eventId && !ev ? { eventId } : {}), status, updatedAt: new Date().toISOString() }; }) } as Workspace;
  });
  const remove = (i: Incident) => {
    if (!window.confirm(`Delete this incident report for ${i.student}? Its check-ins go too.`)) return;
    setIncidents((list) => list.filter((x) => x.id !== i.id), (w) => (i.eventId ? { events: w.events.filter((e) => e.id !== i.eventId) } : {}));
  };
  const print = (i: Incident) => printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>Incident report: ${esc(i.student)}</title>
<style>body{font:14px/1.5 -apple-system,Segoe UI,Arial,sans-serif;margin:36px;color:#111}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 4px;text-transform:uppercase;letter-spacing:.04em;color:#555}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top}p{margin:0;white-space:pre-wrap}</style></head><body>
<h1>Incident report: ${esc(i.student)}</h1><p>${esc(day(i.date))}${i.time ? ` · ${esc(i.time)}` : ""} · ${esc(i.type)} · Severity: ${esc(SEVERITY_LABEL[i.severity])} · Status: ${esc(STATUS_LABEL[i.status])}</p>
${i.where ? `<h2>Where</h2><p>${esc(i.where)}</p>` : ""}<h2>What happened</h2><p>${esc(i.summary)}</p>
${i.others ? `<h2>Others involved</h2><p>${esc(i.others)}</p>` : ""}${i.actions ? `<h2>Actions taken</h2><p>${esc(i.actions)}</p>` : ""}
${i.reportedTo ? `<h2>Reported to</h2><p>${esc(i.reportedTo)}</p>` : ""}<h2>Parent/guardian contacted</h2><p>${i.parentContacted ? "Yes" : "No"}</p>
${planWords(i) ? `<h2>Check-in plan</h2><p>${esc(planWords(i))}</p>` : ""}
${i.checkIns.length ? `<h2>Check-ins</h2><table><tr><th>Date</th><th>With</th><th>How it went</th><th>Notes</th></tr>${[...i.checkIns].sort((a, b) => a.date.localeCompare(b.date)).map((c) => `<tr><td>${esc(day(c.date))}</td><td>${esc(c.with)}</td><td>${esc(CHECK_RESULT_LABEL[c.result])}</td><td>${esc(c.note)}</td></tr>`).join("")}</table>` : ""}
</body></html>`);

  const shown = incidents.filter((i) => filter === "all" || (filter === "active" ? i.status !== "closed" : i.status === filter))
    .sort((a, b) => (a.status === "closed" ? 1 : 0) - (b.status === "closed" ? 1 : 0) || b.date.localeCompare(a.date));

  return (
    <div className="space-y-5" data-testid="hub-incidents">
      <Card title="Check-ins due today">
        {due.length ? (
          <ul className="space-y-2" data-testid="incident-due">
            {due.map(({ incident: i, with: w, done }) => {
              const key = `${i.id}|${w}|${today}`;
              return (
                <li key={key} className={`rounded-xl border p-3 ${done ? "border-slate-100 bg-slate-50" : "border-slate-200 bg-white"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 text-sm"><button type="button" onClick={() => openStudent?.(i.student)} className="font-bold text-slate-900 hover:underline">{i.student}</button> <span className="text-slate-500">· check in with</span> <span className="font-semibold text-slate-900">{w}</span> <span className="text-xs text-slate-500">({i.type})</span></span>
                    {done && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${RESULT_LOOK[done.result]}`}>{CHECK_RESULT_LABEL[done.result]}</span>}
                  </div>
                  {!done && <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Field value={notes[key] || ""} onChange={(e) => setNotes((n) => ({ ...n, [key]: e.target.value }))} placeholder="Note (optional)" aria-label="Check-in note" className="min-w-[12rem] flex-1" />
                    {CHECK_RESULTS.map((r) => <button key={r} type="button" onClick={() => logCheck(i.id, w, r)} className={`min-h-11 rounded-xl px-3 text-sm font-bold ${RESULT_LOOK[r]}`} data-testid={`incident-check-${r}`}>{CHECK_RESULT_LABEL[r]}</button>)}
                  </div>}
                  {done?.note && <p className="mt-1 text-xs text-slate-600">{done.note}</p>}
                </li>
              );
            })}
          </ul>
        ) : <Empty>No check-ins due today.</Empty>}
      </Card>

      {draft ? (
        <Card title={editId ? "Edit incident report" : "New incident report"}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4" data-testid="incident-form">
            <Labeled label="Student" className="md:col-span-2">
              <Select value={draft.student} onChange={(e) => setDraft({ ...draft, student: e.target.value })} required data-testid="incident-student">
                <option value="">Choose a student</option>{students.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Labeled>
            <Labeled label="Date"><Field type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value || today })} /></Labeled>
            <Labeled label="Time (optional)"><Field type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></Labeled>
            <Labeled label="Type"><Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Incident["type"] })}>{INCIDENT_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Labeled>
            <Labeled label="Severity"><Select value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value as Incident["severity"] })}>{SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}</Select></Labeled>
            <Labeled label="Where" className="md:col-span-2"><Field value={draft.where} onChange={(e) => setDraft({ ...draft, where: e.target.value })} placeholder="Hallway, lunch, Math 7…" /></Labeled>
            <Labeled label="What happened" className="md:col-span-4"><TextArea value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} rows={4} placeholder="What you saw or were told, in plain words." data-testid="incident-summary" /></Labeled>
            <Labeled label="Others involved or who saw it" className="md:col-span-2"><TextArea value={draft.others} onChange={(e) => setDraft({ ...draft, others: e.target.value })} rows={2} /></Labeled>
            <Labeled label="Actions taken" className="md:col-span-2"><TextArea value={draft.actions} onChange={(e) => setDraft({ ...draft, actions: e.target.value })} rows={2} placeholder="Talked with the student, separated seats…" /></Labeled>
            <Labeled label="Reported to" className="md:col-span-2"><Field value={draft.reportedTo} onChange={(e) => setDraft({ ...draft, reportedTo: e.target.value })} placeholder="Counselor, assistant principal…" /></Labeled>
            <label className="flex min-h-11 items-end gap-3 pb-2 text-sm text-slate-700 md:col-span-2"><input type="checkbox" className="h-5 w-5" checked={draft.parentContacted} onChange={(e) => setDraft({ ...draft, parentContacted: e.target.checked })} /> Parent/guardian contacted</label>
          </div>

          <div className="mt-5 rounded-2xl bg-violet-50 p-4 ring-1 ring-violet-100" data-testid="incident-plan">
            <p className="flex items-center gap-2 text-sm font-bold text-violet-950"><ClipboardList className="h-4 w-4" /> Check-in plan</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-wide text-violet-900/70">Check in with</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[...new Set([...CHECK_WITH_PRESETS, ...classesOf(draft.student), ...draft.checkWith])].map((w) => {
                const on = draft.checkWith.includes(w);
                return <button key={w} type="button" aria-pressed={on} onClick={() => setDraft({ ...draft, checkWith: on ? draft.checkWith.filter((x) => x !== w) : [...draft.checkWith, w] })} className={chip(on)}>{on && <Check className="h-3.5 w-3.5" />}{w}</button>;
              })}
            </div>
            {draft.student && !classesOf(draft.student).length && <p className="mt-1.5 text-xs text-violet-900/70">Add {draft.student.split(/\s+/)[0]}'s schedule on Student schedules and their classes show here to pick.</p>}
            <form className="mt-2 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get("other") || "").trim(); if (v && !draft.checkWith.includes(v)) setDraft({ ...draft, checkWith: [...draft.checkWith, v] }); e.currentTarget.reset(); }}>
              <Field name="other" placeholder="Someone else (a teacher, a class)" aria-label="Someone else to check in with" className="max-w-xs" />
              <button type="submit" className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Plus className="h-4 w-4" /> Add</button>
            </form>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-violet-900/70">On these days</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => { const on = draft.checkDays.includes(d); return <button key={d} type="button" aria-pressed={on} onClick={() => setDraft({ ...draft, checkDays: on ? draft.checkDays.filter((x) => x !== d) : [...draft.checkDays, d].sort() })} className={chip(on)} data-testid={`incident-day-${d}`}>{WEEKDAY_NAMES[d]}</button>; })}
              <button type="button" onClick={() => setDraft({ ...draft, checkDays: [1, 2, 3, 4, 5] })} className="min-h-10 rounded-full px-3 text-xs font-semibold text-violet-800 hover:bg-violet-100">Every school day</button>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <Labeled label="Until"><Field type="date" value={draft.checkUntil} onChange={(e) => setDraft({ ...draft, checkUntil: e.target.value })} /></Labeled>
              <div className="flex gap-1.5 pb-1">{[7, 14, 30].map((n) => <button key={n} type="button" onClick={() => setDraft({ ...draft, checkUntil: addDaysTo(draft.date, n) })} className="min-h-10 rounded-full bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">{n === 7 ? "1 week" : n === 14 ? "2 weeks" : "1 month"}</button>)}</div>
              <label className="flex min-h-11 items-center gap-2 pb-1 text-sm text-slate-700"><input type="checkbox" className="h-5 w-5" checked={draft.addToCalendar} onChange={(e) => setDraft({ ...draft, addToCalendar: e.target.checked })} /><CalendarPlus className="h-4 w-4 text-violet-700" /> Put the check-ins on my calendar</label>
            </div>
            {planWords(draft) && <p className="mt-2 text-sm font-semibold text-violet-950">{planWords(draft)}.</p>}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={!draft.student || !draft.summary.trim()} data-testid="incident-save" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"><Check className="h-4 w-4" /> Save report</button>
            <button type="button" onClick={() => { setDraft(null); setEditId(null); }} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
            {!draft.summary.trim() && <span className="self-center text-xs text-slate-500">Write what happened to save.</span>}
          </div>
        </Card>
      ) : (
        <button type="button" onClick={() => { setDraft(blank(today)); setEditId(null); }} data-testid="incident-new" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-bold text-white hover:bg-slate-800"><ShieldAlert className="h-4 w-4" /> New incident report</button>
      )}

      <Card title="Incident reports">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(["active", "open", "monitoring", "closed", "all"] as const).map((f) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={chip(filter === f)}>{f === "active" ? "Open & monitoring" : f === "all" ? "All" : STATUS_LABEL[f]}</button>)}
        </div>
        {shown.length ? (
          <ul className="space-y-2">
            {shown.map((i) => {
              const open = openId === i.id;
              const missed = missedChecks(i, today);
              const next = nextCheckDay(i, today);
              return (
                <li key={i.id} className="rounded-2xl border border-slate-200 bg-white" data-testid="incident-row">
                  <button type="button" onClick={() => setOpenId(open ? null : i.id)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-2 p-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-slate-900">{i.student} <span className="font-semibold text-slate-500">· {i.type}</span></span>
                      <span className="block text-xs text-slate-500">{day(i.date)}{i.where ? ` · ${i.where}` : ""}{next ? ` · next check-in ${next === today ? "today" : day(next)}` : ""}</span>
                    </span>
                    {missed.length > 0 && i.status !== "closed" && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900"><AlertTriangle className="h-3 w-3" />{missed.length} missed</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${SEV_LOOK[i.severity]}`}>{SEVERITY_LABEL[i.severity]}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${STATUS_LOOK[i.status]}`}>{STATUS_LABEL[i.status]}</span>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "" : "-rotate-90"}`} />
                  </button>
                  {open && (
                    <div className="space-y-3 border-t border-slate-100 p-3 text-sm">
                      <p className="whitespace-pre-wrap text-slate-800">{i.summary}</p>
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-slate-600 md:grid-cols-2">
                        {i.others && <div><dt className="inline font-semibold">Others involved: </dt><dd className="inline">{i.others}</dd></div>}
                        {i.actions && <div><dt className="inline font-semibold">Actions taken: </dt><dd className="inline">{i.actions}</dd></div>}
                        {i.reportedTo && <div><dt className="inline font-semibold">Reported to: </dt><dd className="inline">{i.reportedTo}</dd></div>}
                        <div><dt className="inline font-semibold">Parent/guardian contacted: </dt><dd className="inline">{i.parentContacted ? "Yes" : "No"}</dd></div>
                        {planWords(i) && <div className="md:col-span-2"><dt className="inline font-semibold">Plan: </dt><dd className="inline">{planWords(i)}{i.eventId ? " (on your calendar)" : ""}</dd></div>}
                      </dl>
                      {missed.length > 0 && i.status !== "closed" && (
                        <div className="rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900">
                          <p className="font-bold">Missed check-ins</p>
                          <ul className="mt-1 space-y-1">{missed.slice(-6).map((m) => <li key={`${m.date}${m.with}`} className="flex flex-wrap items-center gap-1.5">{day(m.date)} · {m.with}{CHECK_RESULTS.map((r) => <button key={r} type="button" onClick={() => logCheck(i.id, m.with, r, m.date)} className="rounded-full bg-white px-2 py-0.5 font-semibold ring-1 ring-amber-200 hover:bg-amber-100">{CHECK_RESULT_LABEL[r]}</button>)}</li>)}</ul>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Check-ins ({i.checkIns.length})</p>
                        {i.checkIns.length ? <ul className="mt-1 space-y-1">{[...i.checkIns].sort((a, b) => b.date.localeCompare(a.date)).map((c) => (
                          <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs"><span className="font-semibold text-slate-800">{day(c.date)}</span><span>{c.with}</span><span className={`rounded-full px-2 py-0.5 font-bold ${RESULT_LOOK[c.result]}`}>{CHECK_RESULT_LABEL[c.result]}</span>{c.note && <span className="text-slate-600">{c.note}</span>}</li>
                        ))}</ul> : <p className="mt-1 text-xs text-slate-500">None logged yet.</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-500">Status:</span>
                        {INCIDENT_STATUSES.map((s) => <button key={s} type="button" aria-pressed={i.status === s} onClick={() => setStatus(i.id, s)} className={`min-h-9 rounded-full px-3 text-xs font-bold ring-1 ${i.status === s ? STATUS_LOOK[s] : "bg-white text-slate-500 ring-slate-200"}`}>{STATUS_LABEL[s]}</button>)}
                        <span className="flex-1" />
                        {openStudent && <button type="button" onClick={() => openStudent(i.student)} className="min-h-9 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">Student profile</button>}
                        <button type="button" onClick={() => print(i)} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"><Printer className="h-3.5 w-3.5" /> Print</button>
                        <button type="button" onClick={() => { const { id: _id, checkIns: _c, createdAt: _a, updatedAt: _u, eventId, ...rest } = i; setDraft({ ...rest, addToCalendar: !!eventId }); setEditId(i.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                        <button type="button" onClick={() => remove(i)} aria-label="Delete report" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : <Empty>{incidents.length ? "Nothing here with this filter." : "No incident reports yet."}</Empty>}
      </Card>
    </div>
  );
}
