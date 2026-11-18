// Arise WorkHub: 1-on-1 meetings (a Plugin Gallery plugin). Schedule a meeting with a student (once or as a run),
// then hold it here: agenda, notes, what the student said, how they're feeling, and next steps that fill your
// to-do list. Last time's open next steps come up first. Every meeting shows on the student's profile.
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { CalendarPlus, Check, ChevronLeft, ClipboardList, ListTodo, MessagesSquare, Plus, Printer, Trash2, UserRound, X } from "lucide-react";
import {
  AGENDA_STARTERS, FEELINGS, FEELING_FACE, FEELING_LABEL, MEETING_FOCUS, addDaysTo, cleanOneOnOnes, needsWrapUp, openStepsBefore, runDates, upcoming,
  type MeetingFocus, type NextStep, type OneOnOne, type Repeat,
} from "@shared/hubOneOnOne";
import type { HubEvent, Task, Workspace } from "@shared/teacherHub";
import { printHtml } from "@/lib/lessonExport";
import { Card, Empty, Field, Labeled, Select, TextArea } from "./ui";

const day = (d: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) : "");
const clock = (t: string) => { if (!t) return ""; const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const first = (name: string) => name.trim().split(/\s+/)[0] || name;
const chip = (on: boolean) => `inline-flex min-h-10 items-center gap-1 rounded-full border px-3 text-sm font-semibold transition ${on ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Plan = { student: string; date: string; time: string; minutes: number; where: string; focus: MeetingFocus; agenda: string[]; repeat: Repeat; calendar: boolean };

export default function HubOneOnOne({ workspace, setWorkspace, today, makeId, say, students, openStudent }: {
  workspace: Workspace; setWorkspace: Dispatch<SetStateAction<Workspace>>; today: string; makeId: () => string; say: (text: string) => void;
  students: string[]; openStudent?: (name: string) => void;
}) {
  const meetings = useMemo(() => cleanOneOnOnes((workspace as any).oneOnOnes), [(workspace as any).oneOnOnes]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [who, setWho] = useState("");
  const [stepText, setStepText] = useState("");
  const [stepWho, setStepWho] = useState<NextStep["who"]>("student");
  const [stepDue, setStepDue] = useState("");
  const [fillTodos, setFillTodos] = useState(true);

  const write = (fn: (list: OneOnOne[], w: Workspace) => { list: OneOnOne[]; extra?: Partial<Workspace> }) => setWorkspace((w) => {
    const r = fn(cleanOneOnOnes((w as any).oneOnOnes), w);
    return { ...w, ...(r.extra || {}), oneOnOnes: r.list } as Workspace;
  });
  const change = (id: string, patch: Partial<OneOnOne>) => write((list) => ({ list: list.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m)) }));
  const studentId = (name: string) => workspace.students.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase())?.id;
  const taskFor = (m: OneOnOne, s: NextStep, id: string): Task => {
    const sid = studentId(m.student);
    return { id, title: `${first(m.student)}: ${s.who === "student" ? `follow up — ${s.text}` : s.text}`, dueDate: s.due || "", recurring: "", done: false,
      notes: `From the 1-on-1 on ${day(m.date)}.`, ...(sid ? { links: [{ kind: "student", id: sid }] } : {}) } as Task;
  };

  function schedule() {
    if (!plan || !plan.student) return;
    const now = new Date().toISOString();
    const dates = runDates(plan.date, plan.repeat);
    const agenda = plan.agenda.map((a) => a.trim()).filter(Boolean);
    const seriesId = dates.length > 1 ? makeId() : undefined;
    const eventId = plan.calendar ? makeId() : undefined;
    const made: OneOnOne[] = dates.map((d, i) => ({
      id: makeId(), student: plan.student, date: d, time: plan.time, minutes: plan.minutes, where: plan.where, focus: plan.focus, agenda,
      notes: "", studentSaid: "", feeling: 0, nextSteps: [], status: "scheduled", ...(seriesId ? { seriesId } : {}), ...(eventId && i === 0 ? { eventId } : {}), createdAt: now, updatedAt: now,
    }));
    const event: HubEvent | null = eventId ? ({
      id: eventId, title: `1-on-1: ${plan.student}`, date: plan.date, start: plan.time, end: plan.time && plan.minutes ? endOf(plan.time, plan.minutes) : "", location: plan.where, notes: `${plan.focus}${agenda.length ? ` — ${agenda.join("; ")}` : ""}`, students: [plan.student],
      ...(dates.length > 1 ? (plan.repeat.kind === "weekly" ? { repeat: "Weekly" } : plan.repeat.kind === "biweekly" ? { repeat: "Every 2 weeks" } : { repeat: "Days", days: plan.repeat.days.length ? plan.repeat.days : [new Date(`${plan.date}T12:00:00Z`).getUTCDay()] }) : {}),
      ...(dates.length > 1 ? { until: dates[dates.length - 1] } : {}),
    } as HubEvent) : null;
    write((list, w) => ({ list: [...list, ...made], extra: event ? { events: [...w.events, event] } : undefined }));
    say(dates.length > 1 ? `${dates.length} meetings with ${plan.student} scheduled${event ? ", and on your calendar" : ""}.` : `Meeting with ${plan.student} scheduled${event ? ", and on your calendar" : ""}.`);
    setPlan(null);
  }

  function addStep(m: OneOnOne) {
    const text = stepText.trim();
    if (!text) return;
    change(m.id, { nextSteps: [...m.nextSteps, { id: makeId(), text, who: stepWho, due: stepDue, done: false }] });
    setStepText(""); setStepDue("");
  }
  /** Puts next steps that aren't on the to-do list yet onto it, linked to the student. */
  function toTodos(m: OneOnOne, only?: string) {
    const steps = m.nextSteps.filter((s) => !s.taskId && !s.done && (!only || s.id === only));
    if (!steps.length) return 0;
    const ids = steps.map(() => makeId());
    write((list, w) => ({
      list: list.map((x) => (x.id !== m.id ? x : { ...x, nextSteps: x.nextSteps.map((s) => { const i = steps.findIndex((t) => t.id === s.id); return i < 0 ? s : { ...s, taskId: ids[i] }; }) })),
      extra: { tasks: [...steps.map((s, i) => taskFor(m, s, ids[i])), ...w.tasks] },
    }));
    return steps.length;
  }
  function finish(m: OneOnOne) {
    const n = fillTodos ? toTodos(m) : 0;
    change(m.id, { status: "done" });
    say(`Meeting with ${first(m.student)} saved${n ? `, and ${n} next ${n === 1 ? "step" : "steps"} added to your to-dos` : ""}.`);
  }
  function scheduleNext(m: OneOnOne, days: number) {
    setPlan({ student: m.student, date: addDaysTo(m.date < today ? today : m.date, days), time: m.time, minutes: m.minutes || 20, where: m.where, focus: m.focus, agenda: m.agenda, repeat: { kind: "none", days: [], until: "" }, calendar: true });
    setOpenId(null);
  }
  function remove(m: OneOnOne, series: boolean) {
    const gone = series && m.seriesId ? meetings.filter((x) => x.seriesId === m.seriesId && x.status === "scheduled" && x.date >= m.date).map((x) => x.id) : [m.id];
    if (!window.confirm(series ? `Delete ${gone.length} upcoming meetings with ${m.student}?` : `Delete this meeting with ${m.student}?`)) return;
    const eventIds = meetings.filter((x) => gone.includes(x.id) && x.eventId).map((x) => x.eventId!);
    write((list, w) => ({ list: list.filter((x) => !gone.includes(x.id)), extra: eventIds.length ? { events: w.events.filter((e) => !eventIds.includes(e.id)) } : undefined }));
    setOpenId(null);
  }
  const print = (m: OneOnOne) => printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>1-on-1: ${esc(m.student)}</title><style>body{font:14px/1.5 -apple-system,Segoe UI,Arial,sans-serif;margin:36px}h1{font-size:20px;margin:0}h2{font-size:13px;text-transform:uppercase;color:#555;margin:16px 0 4px}p{margin:0;white-space:pre-wrap}</style></head><body>
<h1>1-on-1 meeting: ${esc(m.student)}</h1><p>${esc(day(m.date))}${m.time ? ` · ${esc(clock(m.time))}` : ""}${m.where ? ` · ${esc(m.where)}` : ""} · ${esc(m.focus)}</p>
${m.feeling ? `<h2>How they're feeling</h2><p>${FEELING_FACE[m.feeling]} ${esc(FEELING_LABEL[m.feeling])}</p>` : ""}
${m.agenda.length ? `<h2>Agenda</h2><ul>${m.agenda.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}
${m.notes ? `<h2>Notes</h2><p>${esc(m.notes)}</p>` : ""}${m.studentSaid ? `<h2>In ${esc(first(m.student))}'s words</h2><p>${esc(m.studentSaid)}</p>` : ""}
${m.nextSteps.length ? `<h2>Next steps</h2><ul>${m.nextSteps.map((s) => `<li>${s.done ? "✓ " : ""}${esc(s.text)} (${s.who === "student" ? esc(first(m.student)) : "teacher"}${s.due ? `, by ${esc(day(s.due))}` : ""})</li>`).join("")}</ul>` : ""}</body></html>`);

  const open = openId ? meetings.find((m) => m.id === openId) : null;

  // ─── One meeting ─────────────────────────────────────────────────────────
  if (open) {
    const carry = openStepsBefore(meetings, open.student, open.date);
    return (
      <div className="space-y-4" data-testid="oneonone-meeting">
        <button type="button" onClick={() => setOpenId(null)} className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /> All 1-on-1s</button>
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-slate-950">{open.student}</h2>
              <p className="text-sm text-slate-600">{day(open.date)}{open.time ? ` · ${clock(open.time)}` : ""}{open.minutes ? ` · ${open.minutes} min` : ""}{open.where ? ` · ${open.where}` : ""} · {open.focus}{open.status === "done" ? " · Done" : open.status === "missed" ? " · Missed" : ""}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {openStudent && <button type="button" onClick={() => openStudent(open.student)} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><UserRound className="h-4 w-4" /> Profile</button>}
              <button type="button" onClick={() => print(open)} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Printer className="h-4 w-4" /> Print</button>
            </div>
          </div>

          {carry.length > 0 && (
            <div className="mt-4 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-100" data-testid="oneonone-carry">
              <p className="text-sm font-bold text-amber-950">From last time</p>
              <ul className="mt-1 space-y-1">{carry.map(({ meeting, step }) => (
                <li key={step.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" onChange={() => change(meeting.id, { nextSteps: meeting.nextSteps.map((s) => (s.id === step.id ? { ...s, done: true } : s)) })} aria-label={`Done: ${step.text}`} /><span>{step.text} <span className="text-xs text-amber-900/70">({step.who === "student" ? first(open.student) : "you"}, {day(meeting.date)})</span></span></li>
              ))}</ul>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><ClipboardList className="h-4 w-4" /> Agenda</p>
              <ul className="space-y-1">{open.agenda.map((a, i) => <li key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm"><span className="flex-1">{a}</span><button type="button" onClick={() => change(open.id, { agenda: open.agenda.filter((_, j) => j !== i) })} aria-label="Remove" className="text-slate-400 hover:text-rose-600"><X className="h-4 w-4" /></button></li>)}</ul>
              <form className="mt-1.5 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get("a") || "").trim(); if (v) change(open.id, { agenda: [...open.agenda, v] }); e.currentTarget.reset(); }}>
                <Field name="a" placeholder="Add to the agenda" aria-label="Add to the agenda" /><button type="submit" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold hover:bg-slate-50"><Plus className="h-4 w-4" /></button>
              </form>
              <p className="mb-1.5 mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">How {first(open.student)} is feeling</p>
              <div className="flex gap-1.5" role="group" aria-label="How the student is feeling">{FEELINGS.map((f) => (
                <button key={f} type="button" aria-pressed={open.feeling === f} title={FEELING_LABEL[f]} onClick={() => change(open.id, { feeling: open.feeling === f ? 0 : f })} className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition ${open.feeling === f ? "bg-teal-100 ring-2 ring-teal-600" : "bg-slate-50 hover:bg-slate-100"}`}>{FEELING_FACE[f]}</button>
              ))}</div>
            </div>
            <div className="space-y-3">
              <Labeled label="Notes"><TextArea value={open.notes} onChange={(e) => change(open.id, { notes: e.target.value })} rows={6} placeholder="What you talked about." data-testid="oneonone-notes" /></Labeled>
              <Labeled label={`In ${first(open.student)}'s words`}><TextArea value={open.studentSaid} onChange={(e) => change(open.id, { studentSaid: e.target.value })} rows={3} placeholder="What they said, as they said it." /></Labeled>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><ListTodo className="h-4 w-4" /> Next steps</p>
            <ul className="space-y-1">{open.nextSteps.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={s.done} onChange={(e) => change(open.id, { nextSteps: open.nextSteps.map((x) => (x.id === s.id ? { ...x, done: e.target.checked } : x)) })} aria-label={`Done: ${s.text}`} />
                <span className={`min-w-0 flex-1 ${s.done ? "text-slate-400 line-through" : ""}`}>{s.text} <span className="text-xs text-slate-500">({s.who === "student" ? first(open.student) : "you"}{s.due ? `, by ${day(s.due)}` : ""})</span></span>
                {s.taskId ? <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800">On your to-dos</span>
                  : !s.done && <button type="button" onClick={() => { if (toTodos(open, s.id)) say("Added to your to-dos."); }} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-teal-800 ring-1 ring-teal-200 hover:bg-teal-50">Add to to-dos</button>}
                <button type="button" onClick={() => change(open.id, { nextSteps: open.nextSteps.filter((x) => x.id !== s.id) })} aria-label="Remove step" className="text-slate-400 hover:text-rose-600"><X className="h-4 w-4" /></button>
              </li>
            ))}</ul>
            <form className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-[minmax(0,1fr)_9rem_10rem_auto]" onSubmit={(e) => { e.preventDefault(); addStep(open); }}>
              <Field value={stepText} onChange={(e) => setStepText(e.target.value)} placeholder="A next step: turn in the missing lab, call home…" aria-label="Next step" data-testid="oneonone-step" />
              <Select value={stepWho} onChange={(e) => setStepWho(e.target.value as NextStep["who"])} aria-label="Whose step"><option value="student">{first(open.student)}'s</option><option value="teacher">Mine</option></Select>
              <Field type="date" value={stepDue} onChange={(e) => setStepDue(e.target.value)} aria-label="By" />
              <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold hover:bg-slate-50"><Plus className="h-4 w-4" /> Add</button>
            </form>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            {open.status !== "done" ? <>
              <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-5 w-5" checked={fillTodos} onChange={(e) => setFillTodos(e.target.checked)} /> Put the next steps on my to-dos</label>
              <button type="button" onClick={() => finish(open)} data-testid="oneonone-finish" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800"><Check className="h-4 w-4" /> Meeting done</button>
              {open.status === "scheduled" && open.date < today && <button type="button" onClick={() => change(open.id, { status: "missed" })} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">Mark missed</button>}
            </> : <button type="button" onClick={() => change(open.id, { status: "scheduled" })} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">Reopen</button>}
            <span className="flex-1" />
            <button type="button" onClick={() => scheduleNext(open, 7)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold hover:bg-slate-50"><CalendarPlus className="h-4 w-4" /> Next in 1 week</button>
            <button type="button" onClick={() => scheduleNext(open, 14)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold hover:bg-slate-50">2 weeks</button>
            <button type="button" onClick={() => remove(open, false)} aria-label="Delete meeting" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
            {open.seriesId && <button type="button" onClick={() => remove(open, true)} className="min-h-11 rounded-xl px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50">Delete the rest of the run</button>}
          </div>
        </Card>
      </div>
    );
  }

  // ─── The list ────────────────────────────────────────────────────────────
  const mine = (m: OneOnOne) => !who || m.student === who;
  const soon = upcoming(meetings, today).filter(mine);
  const wrap = needsWrapUp(meetings, today).filter(mine);
  const past = meetings.filter((m) => m.status !== "scheduled" && mine(m)).sort((a, b) => b.date.localeCompare(a.date));
  const row = (m: OneOnOne) => (
    <li key={m.id}>
      <button type="button" onClick={() => setOpenId(m.id)} className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left hover:bg-slate-50" data-testid="oneonone-row">
        <span className="min-w-0 flex-1"><span className="block font-bold text-slate-900">{m.student} <span className="font-semibold text-slate-500">· {m.focus}</span></span>
          <span className="block text-xs text-slate-500">{m.date === today ? "Today" : day(m.date)}{m.time ? ` · ${clock(m.time)}` : ""}{m.where ? ` · ${m.where}` : ""}{m.nextSteps.length ? ` · ${m.nextSteps.filter((s) => !s.done).length}/${m.nextSteps.length} steps open` : ""}</span></span>
        {m.feeling > 0 && <span className="text-xl" title={FEELING_LABEL[m.feeling]}>{FEELING_FACE[m.feeling]}</span>}
        {m.status === "missed" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Missed</span>}
      </button>
    </li>
  );

  return (
    <div className="space-y-5" data-testid="hub-oneonone">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setPlan({ student: who, date: today, time: "", minutes: 20, where: "", focus: "Check-in", agenda: AGENDA_STARTERS["Check-in"], repeat: { kind: "none", days: [], until: "" }, calendar: true })}
          data-testid="oneonone-new" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-bold text-white hover:bg-slate-800"><MessagesSquare className="h-4 w-4" /> Schedule a 1-on-1</button>
        <Select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Show one student" className="!w-auto"><option value="">Every student</option>{students.map((s) => <option key={s}>{s}</option>)}</Select>
      </div>

      {plan && (
        <Card title="Schedule a 1-on-1">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4" data-testid="oneonone-form">
            <Labeled label="Student" className="md:col-span-2"><Select value={plan.student} onChange={(e) => setPlan({ ...plan, student: e.target.value })} data-testid="oneonone-student"><option value="">Choose a student</option>{students.map((s) => <option key={s}>{s}</option>)}</Select></Labeled>
            <Labeled label="Date"><Field type="date" value={plan.date} onChange={(e) => setPlan({ ...plan, date: e.target.value || today })} /></Labeled>
            <Labeled label="Time"><Field type="time" value={plan.time} onChange={(e) => setPlan({ ...plan, time: e.target.value })} /></Labeled>
            <Labeled label="Length"><Select value={String(plan.minutes)} onChange={(e) => setPlan({ ...plan, minutes: Number(e.target.value) })}>{[10, 15, 20, 30, 45, 60].map((n) => <option key={n} value={n}>{n} minutes</option>)}</Select></Labeled>
            <Labeled label="Where"><Field value={plan.where} onChange={(e) => setPlan({ ...plan, where: e.target.value })} placeholder="Room 214, lunch…" /></Labeled>
            <Labeled label="Focus" className="md:col-span-2"><Select value={plan.focus} onChange={(e) => { const focus = e.target.value as MeetingFocus; setPlan({ ...plan, focus, agenda: AGENDA_STARTERS[focus] }); }}>{MEETING_FOCUS.map((f) => <option key={f}>{f}</option>)}</Select></Labeled>
            <Labeled label="Agenda (one per line)" className="md:col-span-4"><TextArea value={plan.agenda.join("\n")} onChange={(e) => setPlan({ ...plan, agenda: e.target.value.split("\n") })} rows={4} /></Labeled>
          </div>
          <div className="mt-3 rounded-2xl bg-teal-50 p-3 ring-1 ring-teal-100">
            <p className="text-xs font-bold uppercase tracking-wide text-teal-900/70">Repeats</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{(["none", "weekly", "biweekly", "days"] as const).map((k) => <button key={k} type="button" aria-pressed={plan.repeat.kind === k} onClick={() => setPlan({ ...plan, repeat: { ...plan.repeat, kind: k, until: k === "none" ? "" : plan.repeat.until || addDaysTo(plan.date, 42), days: k === "days" && !plan.repeat.days.length ? [new Date(`${plan.date}T12:00:00Z`).getUTCDay()] : plan.repeat.days } })} className={chip(plan.repeat.kind === k)}>{k === "none" ? "Just once" : k === "weekly" ? "Every week" : k === "biweekly" ? "Every 2 weeks" : "On certain days"}</button>)}</div>
            {plan.repeat.kind === "days" && <div className="mt-2 flex flex-wrap gap-1.5">{[1, 2, 3, 4, 5].map((d) => { const on = plan.repeat.days.includes(d); return <button key={d} type="button" aria-pressed={on} onClick={() => setPlan({ ...plan, repeat: { ...plan.repeat, days: on ? plan.repeat.days.filter((x) => x !== d) : [...plan.repeat.days, d].sort() } })} className={chip(on)}>{WEEK[d]}</button>; })}</div>}
            {plan.repeat.kind !== "none" && <div className="mt-2 flex flex-wrap items-end gap-2"><Labeled label="Until"><Field type="date" value={plan.repeat.until} onChange={(e) => setPlan({ ...plan, repeat: { ...plan.repeat, until: e.target.value } })} /></Labeled><span className="pb-2 text-xs text-teal-900">{runDates(plan.date, plan.repeat).length} meetings</span></div>}
            <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-5 w-5" checked={plan.calendar} onChange={(e) => setPlan({ ...plan, calendar: e.target.checked })} /><CalendarPlus className="h-4 w-4 text-teal-700" /> Put it on my calendar</label>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={!plan.student} onClick={schedule} data-testid="oneonone-schedule" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"><Check className="h-4 w-4" /> Schedule</button>
            <button type="button" onClick={() => setPlan(null)} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
          </div>
        </Card>
      )}

      {wrap.length > 0 && <Card title="Needs notes"><p className="-mt-1 mb-2 text-sm text-slate-600">These meetings' days have passed. Add notes and mark them done, or mark them missed.</p><ul className="space-y-2">{wrap.map(row)}</ul></Card>}
      <Card title="Today & coming up">{soon.length ? <ul className="space-y-2">{soon.slice(0, 30).map(row)}</ul> : <Empty>No 1-on-1s scheduled.</Empty>}</Card>
      <Card title="Past meetings">{past.length ? <ul className="space-y-2">{past.slice(0, 60).map(row)}</ul> : <Empty>Meetings you finish show here.</Empty>}</Card>
    </div>
  );
}

/** "08:10" + 20 minutes → "08:30". */
function endOf(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const t = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
