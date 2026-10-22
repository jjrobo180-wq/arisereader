// Para Team: Students, Data, Lessons, Docs & files, and Team.
import { useMemo, useRef, useState } from "react";
import { Copy, Download, ExternalLink, FileText, Link2, Lock, Mail, MessageSquare, Pin, Plus, Printer, Share2, Upload } from "lucide-react";
import { HubModal } from "@/components/teacher-hub/HubModal";
import { Field, Labeled } from "@/components/teacher-hub/ui";
import { inviteLink } from "@/lib/paraTeam";
import { qrSvg } from "@shared/pro/qr";
import {
  DOC_FOLDERS, GOAL_RESULTS, GOAL_RESULT_LABEL, LESSON_STATUS, LESSON_STATUS_LABEL, LOG_LABEL, LOG_TYPES, clock, goalSummary, logsCsv, ofKind,
  type DocFolder, type LessonData, type LinkData, type LogData, type NoteData, type ParaItem, type StudentData,
} from "@shared/paraTeam";
import { Area, CARD, Choice, CHIP, DANGER, DeleteButton, EmptyNote, PRIMARY, SECOND, SMALL, SectionHead, Who, dayWords, nowTime, usePara, when } from "./kit";

function Saver({ saving, onCancel, onSave, label = "Save" }: { saving: boolean; onCancel: () => void; onSave: () => void; label?: string }) {
  return <div className="flex justify-end gap-2"><button type="button" className={SECOND} onClick={onCancel}>Cancel</button><button type="button" className={PRIMARY} disabled={saving} onClick={onSave}>{saving ? "Saving…" : label}</button></div>;
}

// ─── Students ───

const STUDENT_FIELDS: Array<{ key: keyof StudentData; label: string; hint: string }> = [
  { key: "communication", label: "How they communicate", hint: "Words, signs, a talker or AAC device, pictures, gestures." },
  { key: "strengths", label: "Strengths and interests", hint: "What they're good at and love. Great for building rapport." },
  { key: "accommodations", label: "Accommodations", hint: "Extra time, read aloud, breaks, seating, visual schedule…" },
  { key: "goals", label: "Goals we work on", hint: "The IEP goals or skills staff practice and track in Data." },
  { key: "triggers", label: "Watch for", hint: "Triggers and early signs they're getting upset." },
  { key: "strategies", label: "What helps", hint: "Calming strategies, first/then, choices, what to say and what not to." },
  { key: "medical", label: "Health and safety", hint: "Allergies, seizures, medication times, toileting, mobility. Follow the nurse's plan." },
  { key: "notes", label: "Other notes", hint: "Anything else staff should know." },
];
const blankStudent = (): StudentData => ({ name: "", grade: "", communication: "", strengths: "", accommodations: "", triggers: "", strategies: "", goals: "", medical: "", notes: "" });

export function StudentsSection({ focus }: { focus?: string }) {
  const p = usePara();
  const students = ofKind(p.team.items, "student").sort((a, b) => a.data.name.localeCompare(b.data.name));
  const [open, setOpen] = useState<string | null>(focus && students.some((s) => s.id === focus) ? focus : null);
  const [form, setForm] = useState<{ id?: string; data: StudentData } | null>(null);
  const showing = students.find((s) => s.id === open);
  const logs = ofKind(p.team.items, "log");

  return <>
    <SectionHead title="Students" line="One page per student: how to help them, what to watch for and the goals you track. Only your team sees these."
      right={p.lead && <button type="button" className={PRIMARY} onClick={() => setForm({ data: blankStudent() })}><Plus className="h-4 w-4" />Add a student</button>} />
    <p className="mb-3 flex items-start gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs leading-relaxed text-slate-600"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />Use first names or initials. Keep the full IEP in your school's system, and link it in Docs & files if your school allows.</p>
    {students.length === 0 ? <EmptyNote>{p.lead ? "No students yet. Add the students your team supports." : "Your teacher hasn't added students yet."}</EmptyNote> : (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {students.map((s) => {
          const recent = logs.filter((l) => l.data.studentId === s.id).length;
          return (
            <button key={s.id} type="button" onClick={() => setOpen(s.id)} className={`${CARD} text-left transition hover:border-teal-300 hover:shadow-sm`}>
              <span className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-100 text-base font-black text-teal-800" aria-hidden>{s.data.name.slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0"><span className="block truncate text-base font-extrabold text-slate-950">{s.data.name}</span><span className="text-xs text-slate-500">{[s.data.grade && `Grade ${s.data.grade}`, `${recent} data ${recent === 1 ? "entry" : "entries"}`].filter(Boolean).join(" · ")}</span></span>
              </span>
              {(s.data.communication || s.data.strategies) && <span className="mt-3 line-clamp-2 block text-sm text-slate-600">{s.data.strategies || s.data.communication}</span>}
            </button>
          );
        })}
      </div>
    )}
    {showing && !form && (
      <HubModal title={showing.data.name} onClose={() => setOpen(null)} size="lg"
        footer={<div className="flex flex-wrap justify-between gap-2">
          <span>{p.lead && <DeleteButton label="Delete student" onDelete={() => p.act(async () => { await p.api.remove(showing.id); setOpen(null); }, "Deleted.")} />}</span>
          <span className="flex flex-wrap gap-2">
            <button type="button" className={SECOND} onClick={() => { setOpen(null); p.go("data", `student:${showing.id}`); }}>Add data</button>
            {p.lead && <button type="button" className={PRIMARY} onClick={() => setForm({ id: showing.id, data: showing.data })}>Edit</button>}
          </span>
        </div>}>
        <StudentPage s={showing} />
      </HubModal>
    )}
    {form && (
      <StudentForm initial={form.data} id={form.id} onClose={() => setForm(null)} />
    )}
  </>;
}

function StudentPage({ s }: { s: ParaItem<"student"> }) {
  const p = usePara();
  const logs = ofKind(p.team.items, "log").filter((l) => l.data.studentId === s.id).sort((a, b) => `${b.data.date}${b.data.time}`.localeCompare(`${a.data.date}${a.data.time}`));
  const goals = [...new Set(logs.filter((l) => l.data.type === "goal").map((l) => l.data.goal))];
  return (
    <div className="space-y-4">
      {s.data.grade && <p className="text-sm font-semibold text-slate-600">Grade {s.data.grade}</p>}
      <dl className="grid gap-3 sm:grid-cols-2">
        {STUDENT_FIELDS.filter((f) => s.data[f.key]).map((f) => (
          <div key={f.key} className={`rounded-xl px-3 py-2.5 ${f.key === "medical" ? "bg-rose-50" : f.key === "triggers" ? "bg-amber-50" : f.key === "strategies" ? "bg-teal-50" : "bg-slate-50"}`}>
            <dt className="text-xs font-bold text-slate-600">{f.label}</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">{s.data[f.key]}</dd>
          </div>
        ))}
      </dl>
      {STUDENT_FIELDS.every((f) => !s.data[f.key]) && <p className="text-sm text-slate-500">Nothing written about {s.data.name} yet.</p>}
      {goals.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-extrabold text-slate-900">Goal trials</h3>
          <ul className="space-y-1.5">{goals.map((g) => { const sum = goalSummary(logs, s.id, g); return (
            <li key={g} className="flex items-center gap-3 text-sm"><span className="min-w-0 flex-1 truncate">{g}</span><span className="h-2 w-24 overflow-hidden rounded-full bg-slate-200"><span className="block h-full bg-teal-600" style={{ width: `${sum.percent}%` }} /></span><span className="w-28 text-right text-xs font-bold text-slate-600">{sum.percent}% of {sum.trials}</span></li>
          ); })}</ul>
        </section>
      )}
      <section>
        <h3 className="mb-2 text-sm font-extrabold text-slate-900">Latest data</h3>
        {logs.length === 0 ? <p className="text-sm text-slate-500">No data yet.</p> : <ul className="space-y-2">{logs.slice(0, 8).map((l) => <LogLine key={l.id} l={l} />)}</ul>}
      </section>
    </div>
  );
}

function StudentForm({ initial, id, onClose }: { initial: StudentData; id?: string; onClose: () => void }) {
  const p = usePara();
  const [d, setD] = useState(initial);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const ok = await p.act(() => (id ? p.api.update(id, d) : p.api.add("student", d)), id ? "Saved." : "Student added.");
    setSaving(false);
    if (ok) onClose();
  };
  return (
    <HubModal title={id ? `Edit ${initial.name}` : "Add a student"} onClose={onClose} size="lg" footer={<Saver saving={saving} onCancel={onClose} onSave={save} />}>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <Labeled label="Name (first name or initials)"><Field data-autofocus value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} maxLength={60} /></Labeled>
        <Labeled label="Grade"><Field value={d.grade} onChange={(e) => setD({ ...d, grade: e.target.value })} maxLength={20} /></Labeled>
        {STUDENT_FIELDS.map((f) => (
          <Labeled key={f.key} label={f.label} className="sm:col-span-2">
            <Area h="min-h-20" value={d[f.key]} onChange={(e) => setD({ ...d, [f.key]: e.target.value })} placeholder={f.hint} maxLength={2000} />
          </Labeled>
        ))}
      </div>
    </HubModal>
  );
}

// ─── Data ───

const blankLog = (today: string, studentId = ""): LogData => ({ studentId, date: today, time: nowTime(), type: "note", goal: "", result: "correct", count: 1, antecedent: "", behavior: "", consequence: "", text: "" });

function LogLine({ l, onEdit }: { l: ParaItem<"log">; onEdit?: () => void }) {
  const p = usePara();
  const d = l.data;
  const student = ofKind(p.team.items, "student").find((s) => s.id === d.studentId)?.data.name || "A student";
  return (
    <li className="rounded-xl border border-slate-200 px-3 py-2">
      <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold text-slate-500">
        <span className={`${CHIP} ${d.type === "behavior" ? "bg-amber-100 text-amber-900" : d.type === "goal" ? "bg-teal-100 text-teal-900" : d.type === "tally" ? "bg-sky-100 text-sky-900" : "bg-slate-100 text-slate-700"}`}>{LOG_LABEL[d.type]}</span>
        <span className="font-bold text-slate-800">{student}</span>{dayWords(d.date)}{d.time && ` · ${clock(d.time)}`}
      </p>
      {d.type === "goal" && <p className="mt-1 text-sm text-slate-900"><b>{d.goal}</b>: {d.result ? GOAL_RESULT_LABEL[d.result] : ""}</p>}
      {d.type === "tally" && <p className="mt-1 text-sm text-slate-900"><b>{d.goal}</b>: {d.count}</p>}
      {d.type === "behavior" && (
        <dl className="mt-1 grid gap-1 text-sm sm:grid-cols-3">
          {d.antecedent && <div><dt className="text-xs font-bold text-slate-500">Before</dt><dd className="whitespace-pre-wrap">{d.antecedent}</dd></div>}
          <div><dt className="text-xs font-bold text-slate-500">Behavior</dt><dd className="whitespace-pre-wrap">{d.behavior}</dd></div>
          {d.consequence && <div><dt className="text-xs font-bold text-slate-500">After</dt><dd className="whitespace-pre-wrap">{d.consequence}</dd></div>}
        </dl>
      )}
      {d.text && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{d.text}</p>}
      <div className="mt-1 flex flex-wrap items-center gap-1"><Who id={l.createdBy} />{onEdit && p.mayEdit(l) && <><button type="button" className={SMALL} onClick={onEdit}>Edit</button><DeleteButton onDelete={() => p.act(() => p.api.remove(l.id))} /></>}</div>
    </li>
  );
}

export function DataSection({ focus }: { focus?: string }) {
  const p = usePara();
  const students = ofKind(p.team.items, "student").sort((a, b) => a.data.name.localeCompare(b.data.name));
  const focusStudent = focus?.startsWith("student:") ? focus.slice(8) : "";
  const [student, setStudent] = useState(focusStudent);
  const [type, setType] = useState<"" | LogData["type"]>("");
  const [form, setForm] = useState<{ id?: string; data: LogData } | null>(() => (focus === "new" || focusStudent ? { data: blankLog(p.today, focusStudent || (students.length === 1 ? students[0].id : "")) } : null));
  const [limit, setLimit] = useState(50);
  const logs = ofKind(p.team.items, "log")
    .filter((l) => (!student || l.data.studentId === student) && (!type || l.data.type === type))
    .sort((a, b) => `${b.data.date}${b.data.time}${b.createdAt}`.localeCompare(`${a.data.date}${a.data.time}${a.createdAt}`));
  const goals = useMemo(() => {
    const all = ofKind(p.team.items, "log").filter((l) => l.data.type === "goal" && (!student || l.data.studentId === student));
    const keys = new Map<string, { studentId: string; goal: string }>();
    for (const l of all) keys.set(`${l.data.studentId}|${l.data.goal.toLowerCase()}`, { studentId: l.data.studentId, goal: l.data.goal });
    return [...keys.values()].map((k) => ({ ...k, ...goalSummary(all, k.studentId, k.goal) }));
  }, [p.team.items, student]);
  const nameOfStudent = (id: string) => students.find((s) => s.id === id)?.data.name || "Removed student";

  const exportCsv = () => {
    const csv = logsCsv(logs, nameOfStudent, (id) => p.nameOf(id));
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${p.team.name.replace(/[^\w -]+/g, "").trim() || "Para Team"} data ${p.today}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return <>
    <SectionHead title="Data" line="Quick notes, behavior (what happened before, the behavior, what happened after), goal trials and tallies. Everything lands in one list the teacher can download."
      right={<>
        <button type="button" className={SECOND} onClick={exportCsv} disabled={!logs.length}><Download className="h-4 w-4" />Download</button>
        <button type="button" className={PRIMARY} disabled={!students.length} onClick={() => setForm({ data: blankLog(p.today, student || (students.length === 1 ? students[0].id : "")) })}><Plus className="h-4 w-4" />Add data</button>
      </>} />
    {students.length === 0 ? <EmptyNote>{p.lead ? "Add your students first (in Students), then everyone can take data on them here." : "Your teacher needs to add students before data can be taken."}</EmptyNote> : <>
      <div className="mb-3 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="data-student">Student</label>
        <Choice id="data-student" w="w-full sm:w-56" value={student} onChange={(e) => setStudent(e.target.value)}><option value="">All students</option>{students.map((s) => <option key={s.id} value={s.id}>{s.data.name}</option>)}</Choice>
        <label className="sr-only" htmlFor="data-type">Kind</label>
        <Choice id="data-type" w="w-full sm:w-56" value={type} onChange={(e) => setType(e.target.value as any)}><option value="">Every kind</option>{LOG_TYPES.map((t) => <option key={t} value={t}>{LOG_LABEL[t]}</option>)}</Choice>
      </div>
      {goals.length > 0 && (
        <section className={`${CARD} mb-4`} aria-labelledby="goal-progress">
          <h2 id="goal-progress" className="mb-2 text-base font-extrabold text-slate-950">Goal progress</h2>
          <ul className="space-y-2">{goals.map((g) => (
            <li key={`${g.studentId}|${g.goal}`} className="grid grid-cols-[minmax(0,1fr)_6rem_7rem] items-center gap-3 text-sm">
              <span className="min-w-0 truncate"><b>{nameOfStudent(g.studentId)}</b> · {g.goal}</span>
              <span className="h-2 overflow-hidden rounded-full bg-slate-200"><span className="block h-full bg-teal-600" style={{ width: `${g.percent}%` }} /></span>
              <span className="text-right text-xs font-bold text-slate-600">{g.percent}% independent of {g.trials}</span>
            </li>
          ))}</ul>
        </section>
      )}
      {logs.length === 0 ? <EmptyNote>No data yet{student ? ` for ${nameOfStudent(student)}` : ""}.</EmptyNote> : (
        <ul className="space-y-2">{logs.slice(0, limit).map((l) => <LogLine key={l.id} l={l} onEdit={() => setForm({ id: l.id, data: l.data })} />)}</ul>
      )}
      {logs.length > limit && <button type="button" className={`${SECOND} mt-3 w-full`} onClick={() => setLimit(limit + 100)}>Show more</button>}
    </>}
    {form && <LogForm initial={form.data} id={form.id} onClose={() => setForm(null)} />}
  </>;
}

function LogForm({ initial, id, onClose }: { initial: LogData; id?: string; onClose: () => void }) {
  const p = usePara();
  const students = ofKind(p.team.items, "student").sort((a, b) => a.data.name.localeCompare(b.data.name));
  const [d, setD] = useState(initial);
  const [saving, setSaving] = useState(false);
  const knownGoals = [...new Set(ofKind(p.team.items, "log").filter((l) => l.data.studentId === d.studentId && (l.data.type === d.type)).map((l) => l.data.goal).filter(Boolean))];
  const set = <K extends keyof LogData>(k: K, v: LogData[K]) => setD((x) => ({ ...x, [k]: v }));
  const save = async (again = false) => {
    setSaving(true);
    const ok = await p.act(() => (id ? p.api.update(id, d) : p.api.add("log", d)), id ? "Saved." : "Saved. Thanks!");
    setSaving(false);
    if (!ok) return;
    if (again) setD((x) => ({ ...x, time: nowTime(), text: "", antecedent: "", behavior: "", consequence: "" }));
    else onClose();
  };
  return (
    <HubModal title={id ? "Edit data" : "Add data"} onClose={onClose}
      footer={<div className="flex flex-wrap justify-end gap-2"><button type="button" className={SECOND} onClick={onClose}>Cancel</button>{!id && <button type="button" className={SECOND} disabled={saving} onClick={() => save(true)}>Save and add another</button>}<button type="button" className={PRIMARY} disabled={saving} onClick={() => save()}>{saving ? "Saving…" : "Save"}</button></div>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="Student"><Choice data-autofocus value={d.studentId} onChange={(e) => set("studentId", e.target.value)}><option value="">Choose…</option>{students.map((s) => <option key={s.id} value={s.id}>{s.data.name}</option>)}</Choice></Labeled>
        <Labeled label="Kind"><Choice value={d.type} onChange={(e) => set("type", e.target.value as LogData["type"])}>{LOG_TYPES.map((t) => <option key={t} value={t}>{LOG_LABEL[t]}</option>)}</Choice></Labeled>
        <Labeled label="Date"><Field type="date" value={d.date} onChange={(e) => set("date", e.target.value)} /></Labeled>
        <Labeled label="Time"><Field type="time" value={d.time} onChange={(e) => set("time", e.target.value)} /></Labeled>
        {(d.type === "goal" || d.type === "tally") && <>
          <Labeled label={d.type === "goal" ? "Goal or skill" : "What you counted"} className="sm:col-span-2">
            <Field value={d.goal} onChange={(e) => set("goal", e.target.value)} list="para-goals" maxLength={200} placeholder={d.type === "goal" ? "Reads CVC words, asks for a break…" : "Hand raises, outbursts, times out of seat…"} />
            <datalist id="para-goals">{knownGoals.map((g) => <option key={g} value={g} />)}</datalist>
          </Labeled>
          {d.type === "goal" ? (
            <fieldset className="sm:col-span-2"><legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">How it went</legend>
              <div className="grid grid-cols-3 gap-2">{GOAL_RESULTS.map((r) => (
                <button key={r} type="button" aria-pressed={d.result === r} onClick={() => set("result", r)} className={`min-h-12 rounded-xl border text-sm font-bold ${d.result === r ? (r === "correct" ? "border-teal-600 bg-teal-600 text-white" : r === "prompted" ? "border-amber-500 bg-amber-400 text-amber-950" : "border-slate-500 bg-slate-600 text-white") : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>{GOAL_RESULT_LABEL[r]}</button>
              ))}</div>
            </fieldset>
          ) : (
            <Labeled label="How many"><span className="flex items-center gap-2">
              <button type="button" className={SECOND} onClick={() => set("count", Math.max(1, d.count - 1))} aria-label="One less">−</button>
              <span className="w-20"><Field type="number" min={1} max={999} value={d.count} onChange={(e) => set("count", Math.max(1, Math.min(999, Number(e.target.value) || 1)))} className="text-center" aria-label="How many" /></span>
              <button type="button" className={SECOND} onClick={() => set("count", Math.min(999, d.count + 1))} aria-label="One more">+</button>
            </span></Labeled>
          )}
        </>}
        {d.type === "behavior" && <>
          <Labeled label="Before: what was happening" className="sm:col-span-2"><Area h="min-h-16" value={d.antecedent} onChange={(e) => set("antecedent", e.target.value)} maxLength={1000}  placeholder="Asked to start writing, loud lunchroom, a change in routine…" /></Labeled>
          <Labeled label="The behavior" className="sm:col-span-2"><Area h="min-h-16" value={d.behavior} onChange={(e) => set("behavior", e.target.value)} maxLength={1000}  placeholder="What you saw and heard, and for how long." /></Labeled>
          <Labeled label="After: what happened next" className="sm:col-span-2"><Area h="min-h-16" value={d.consequence} onChange={(e) => set("consequence", e.target.value)} maxLength={1000}  placeholder="Offered a break card, calm corner for 5 minutes, back to work…" /></Labeled>
        </>}
        <Labeled label={d.type === "note" ? "Note" : "Anything else (optional)"} className="sm:col-span-2"><Area h={d.type === "note" ? "min-h-24" : "min-h-16"} value={d.text} onChange={(e) => set("text", e.target.value)} maxLength={3000} placeholder={d.type === "note" ? "How the day went, wins, what to try tomorrow." : ""} /></Labeled>
      </div>
    </HubModal>
  );
}

// ─── Lessons ───

const blankLesson = (date: string): LessonData => ({ title: "", date, subject: "", students: "", objective: "", materials: "", steps: "", accommodations: "", paraRole: "", notes: "", link: "", status: "draft" });
const LESSON_FIELDS: Array<{ key: "objective" | "materials" | "steps" | "accommodations" | "paraRole" | "notes"; label: string; hint: string }> = [
  { key: "objective", label: "Goal for the lesson", hint: "Students will be able to…" },
  { key: "materials", label: "Materials", hint: "Books, manipulatives, visuals, devices, copies." },
  { key: "steps", label: "Steps", hint: "Warm-up, teach, practice together, practice alone, check for understanding." },
  { key: "accommodations", label: "Supports and changes", hint: "Read aloud, fewer problems, word bank, visuals, breaks." },
  { key: "paraRole", label: "What the para does", hint: "Who you sit with, what to prompt, what data to take." },
  { key: "notes", label: "Notes and how it went", hint: "" },
];

export function LessonsSection() {
  const p = usePara();
  const [status, setStatus] = useState<"" | LessonData["status"]>("");
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<{ id?: string; data: LessonData } | null>(null);
  const lessons = ofKind(p.team.items, "lesson")
    .filter((l) => !status || l.data.status === status)
    .sort((a, b) => (b.data.date || "0").localeCompare(a.data.date || "0") || b.createdAt.localeCompare(a.createdAt));
  const showing = lessons.find((l) => l.id === open) || ofKind(p.team.items, "lesson").find((l) => l.id === open);

  return <>
    <SectionHead title="Lesson plans" line="Plan lessons together. Anyone can write one; say what the para does so everyone walks in ready."
      right={<button type="button" className={PRIMARY} onClick={() => setForm({ data: blankLesson(p.today) })}><Plus className="h-4 w-4" />New lesson</button>} />
    <div className="mb-3 inline-flex flex-wrap rounded-xl bg-slate-100 p-1 text-sm font-bold" role="group" aria-label="Which lessons">
      {(["", ...LESSON_STATUS] as const).map((s) => <button key={s || "all"} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className={`min-h-9 rounded-lg px-3 ${status === s ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}>{s ? LESSON_STATUS_LABEL[s] : "All"}</button>)}
    </div>
    {lessons.length === 0 ? <EmptyNote>No lessons here yet.</EmptyNote> : (
      <div className="grid gap-3 md:grid-cols-2">
        {lessons.map((l) => (
          <button key={l.id} type="button" onClick={() => setOpen(l.id)} className={`${CARD} text-left transition hover:border-teal-300`}>
            <span className="flex flex-wrap items-center gap-2">
              <span className={`${CHIP} ${l.data.status === "ready" ? "bg-teal-100 text-teal-900" : l.data.status === "done" ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-900"}`}>{LESSON_STATUS_LABEL[l.data.status]}</span>
              <span className="text-xs font-semibold text-slate-500">{[l.data.date && dayWords(l.data.date), l.data.subject].filter(Boolean).join(" · ")}</span>
            </span>
            <span className="mt-1.5 block text-base font-extrabold text-slate-950">{l.data.title}</span>
            {l.data.objective && <span className="mt-1 line-clamp-2 block text-sm text-slate-600">{l.data.objective}</span>}
            <span className="mt-2 block"><Who id={l.createdBy} at={l.updatedAt} /></span>
          </button>
        ))}
      </div>
    )}
    {showing && !form && (
      <HubModal title={showing.data.title} onClose={() => setOpen(null)} size="lg"
        footer={<div className="flex flex-wrap justify-between gap-2">
          <span>{p.mayEdit(showing) && <DeleteButton onDelete={() => p.act(async () => { await p.api.remove(showing.id); setOpen(null); }, "Deleted.")} />}</span>
          <span className="flex flex-wrap gap-2">
            <button type="button" className={SECOND} onClick={() => printLesson(showing, p.team.name, p.nameOf(showing.createdBy))}><Printer className="h-4 w-4" />Print</button>
            {p.mayEdit(showing) && <button type="button" className={PRIMARY} onClick={() => setForm({ id: showing.id, data: showing.data })}>Edit</button>}
          </span>
        </div>}>
        <div className="space-y-3">
          <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className={`${CHIP} ${showing.data.status === "ready" ? "bg-teal-100 text-teal-900" : showing.data.status === "done" ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-900"}`}>{LESSON_STATUS_LABEL[showing.data.status]}</span>
            {[showing.data.date && dayWords(showing.data.date, true), showing.data.subject, showing.data.students].filter(Boolean).join(" · ")}
          </p>
          {LESSON_FIELDS.filter((f) => showing.data[f.key]).map((f) => (
            <section key={f.key} className={`rounded-xl px-3 py-2.5 ${f.key === "paraRole" ? "bg-teal-50" : "bg-slate-50"}`}>
              <h3 className="text-xs font-bold text-slate-600">{f.label}</h3>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">{showing.data[f.key]}</p>
            </section>
          ))}
          {showing.data.link && <a href={showing.data.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-teal-800 underline underline-offset-4"><ExternalLink className="h-4 w-4" />Open the linked doc or slides</a>}
          <Who id={showing.createdBy} at={showing.updatedAt} />
        </div>
      </HubModal>
    )}
    {form && <LessonForm initial={form.data} id={form.id} onClose={() => setForm(null)} onSaved={(id) => setOpen(id)} />}
  </>;
}

function LessonForm({ initial, id, onClose, onSaved }: { initial: LessonData; id?: string; onClose: () => void; onSaved: (id: string) => void }) {
  const p = usePara();
  const [d, setD] = useState(initial);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    let savedId = id || "";
    const ok = await p.act(async () => { const it = id ? await p.api.update(id, d) : await p.api.add("lesson", d); savedId = it.id; }, "Lesson saved.");
    setSaving(false);
    if (ok) { onClose(); onSaved(savedId); }
  };
  return (
    <HubModal title={id ? "Edit lesson" : "New lesson"} onClose={onClose} size="lg" footer={<Saver saving={saving} onCancel={onClose} onSave={save} />}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="Title" className="sm:col-span-2"><Field data-autofocus value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} maxLength={160} placeholder="Short vowel sounds with picture cards" /></Labeled>
        <Labeled label="Date"><Field type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} /></Labeled>
        <Labeled label="Subject"><Field value={d.subject} onChange={(e) => setD({ ...d, subject: e.target.value })} maxLength={80} placeholder="Reading, math, life skills…" /></Labeled>
        <Labeled label="Students or group"><Field value={d.students} onChange={(e) => setD({ ...d, students: e.target.value })} maxLength={200} /></Labeled>
        <Labeled label="Status"><Choice value={d.status} onChange={(e) => setD({ ...d, status: e.target.value as LessonData["status"] })}>{LESSON_STATUS.map((s) => <option key={s} value={s}>{LESSON_STATUS_LABEL[s]}</option>)}</Choice></Labeled>
        {LESSON_FIELDS.map((f) => <Labeled key={f.key} label={f.label} className="sm:col-span-2"><Area h="min-h-20" value={d[f.key]} onChange={(e) => setD({ ...d, [f.key]: e.target.value })} maxLength={4000} placeholder={f.hint} /></Labeled>)}
        <Labeled label="Link to a doc or slides (optional)" className="sm:col-span-2"><Field value={d.link} onChange={(e) => setD({ ...d, link: e.target.value })} placeholder="https://docs.google.com/…" inputMode="url" /></Labeled>
      </div>
    </HubModal>
  );
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function printLesson(l: ParaItem<"lesson">, teamName: string, by: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  const d = l.data;
  const parts = LESSON_FIELDS.filter((f) => d[f.key]).map((f) => `<h2>${esc(f.label)}</h2><p>${esc(d[f.key])}</p>`).join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.title)}</title><style>
    body{font:15px/1.5 system-ui,sans-serif;max-width:720px;margin:32px auto;padding:0 16px;color:#0f172a}
    h1{font-size:24px;margin:0 0 4px} .meta{color:#475569;margin:0 0 20px} h2{font-size:13px;color:#0f766e;margin:18px 0 4px}
    p{white-space:pre-wrap;margin:0} footer{margin-top:28px;color:#64748b;font-size:12px}
  </style></head><body><h1>${esc(d.title)}</h1><p class="meta">${esc([d.date && dayWords(d.date, true), d.subject, d.students, LESSON_STATUS_LABEL[d.status]].filter(Boolean).join(" · "))}</p>${parts}${d.link ? `<h2>Linked</h2><p>${esc(d.link)}</p>` : ""}<footer>${esc(teamName)} · written by ${esc(by)}</footer></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

// ─── Docs & files ───

export function DocsSection({ focus }: { focus?: string }) {
  const p = usePara();
  const [folder, setFolder] = useState<"" | DocFolder>("");
  const [linkForm, setLinkForm] = useState<{ id?: string; data: LinkData } | null>(null);
  const [noteForm, setNoteForm] = useState<{ id?: string; data: NoteData } | null>(null);
  const [openNote, setOpenNote] = useState<string | null>(focus || null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [uploadFolder, setUploadFolder] = useState<DocFolder>("Other");
  const picker = useRef<HTMLInputElement>(null);
  const notes = ofKind(p.team.items, "note").sort((a, b) => Number(b.data.pinned) - Number(a.data.pinned) || a.data.title.localeCompare(b.data.title));
  const links = ofKind(p.team.items, "link").filter((l) => !folder || l.data.folder === folder).sort((a, b) => a.data.title.localeCompare(b.data.title));
  const files = ofKind(p.team.items, "file").filter((f) => !folder || f.data.folder === folder).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const note = notes.find((n) => n.id === openNote);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    const chosen = Array.from(list);
    for (const f of chosen) {
      if (f.size > 25 * 1024 * 1024) { p.say(`${f.name} is over 25 MB. Share big videos as a link instead.`); continue; }
      setUploading((u) => [...u, f.name]);
      await p.act(() => p.api.upload(f, uploadFolder), `${f.name} uploaded.`);
      setUploading((u) => u.filter((n) => n !== f.name));
    }
    if (picker.current) picker.current.value = "";
  };

  return <>
    <SectionHead title="Docs & files" line="The team binder: routines and emergency plans, links to shared docs, and files anyone can upload from a phone or computer."
      right={<>
        <button type="button" className={SECOND} onClick={() => setLinkForm({ data: { title: "", url: "", folder: folder || "Other", note: "" } })}><Link2 className="h-4 w-4" />Add a link</button>
        <button type="button" className={PRIMARY} onClick={() => picker.current?.click()}><Upload className="h-4 w-4" />Upload</button>
      </>} />
    <input ref={picker} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} aria-label="Choose files to upload" />

    <section className={`${CARD} mb-4`} aria-labelledby="team-notes">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="team-notes" className="text-lg font-extrabold text-slate-950">Team notes</h2>
        {p.lead && <button type="button" className={SMALL} onClick={() => setNoteForm({ data: { title: "", body: "", pinned: false } })}><Plus className="h-3.5 w-3.5" />Add a note</button>}
      </div>
      {notes.length === 0 ? <p className="text-sm text-slate-500">{p.lead ? "Write down the things every para needs: daily routines, fire and lockdown plans, who to call, where things are kept." : "Your teacher hasn't written any team notes yet."}</p> : (
        <ul className="grid gap-2 sm:grid-cols-2">{notes.map((n) => (
          <li key={n.id}><button type="button" onClick={() => setOpenNote(n.id)} className="flex w-full items-start gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-left hover:bg-slate-50">
            {n.data.pinned ? <Pin className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" /> : <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
            <span className="min-w-0"><span className="block font-bold text-slate-900">{n.data.title}</span><span className="line-clamp-1 text-sm text-slate-500">{n.data.body}</span></span>
          </button></li>
        ))}</ul>
      )}
    </section>

    <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Folder">
      {(["", ...DOC_FOLDERS] as const).map((f) => <button key={f || "all"} type="button" aria-pressed={folder === f} onClick={() => setFolder(f)} className={`min-h-9 rounded-full border px-3 text-sm font-semibold ${folder === f ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{f || "Everything"}</button>)}
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <section className={CARD} aria-labelledby="team-links">
        <h2 id="team-links" className="mb-2 text-lg font-extrabold text-slate-950">Links</h2>
        {links.length === 0 ? <p className="text-sm text-slate-500">Link Google Docs, Sheets, Slides, OneDrive files or websites the team uses.</p> : (
          <ul className="divide-y divide-slate-100">{links.map((l) => (
            <li key={l.id} className="flex items-start gap-2 py-2.5">
              <Link2 className="mt-1 h-4 w-4 shrink-0 text-teal-700" />
              <div className="min-w-0 flex-1">
                <a href={l.data.url} target="_blank" rel="noopener noreferrer" className="break-words font-bold text-slate-900 underline-offset-4 hover:underline">{l.data.title}</a>
                <p className="truncate text-xs text-slate-500">{l.data.folder} · {new URL(l.data.url).hostname.replace(/^www\./, "")}</p>
                {l.data.note && <p className="mt-0.5 text-sm text-slate-600">{l.data.note}</p>}
              </div>
              {p.mayEdit(l) && <span className="flex shrink-0 items-center"><button type="button" className={SMALL} onClick={() => setLinkForm({ id: l.id, data: l.data })}>Edit</button><DeleteButton onDelete={() => p.act(() => p.api.remove(l.id))} /></span>}
            </li>
          ))}</ul>
        )}
      </section>
      <section className={CARD} aria-labelledby="team-files">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="team-files" className="text-lg font-extrabold text-slate-950">Files</h2>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">Upload into
            <Choice w="w-40" value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value as DocFolder)}>{DOC_FOLDERS.map((f) => <option key={f}>{f}</option>)}</Choice>
          </label>
        </div>
        {uploading.length > 0 && <p className="mb-2 rounded-lg bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-900" role="status">Uploading {uploading.join(", ")}…</p>}
        {files.length === 0 ? <p className="text-sm text-slate-500">Upload PDFs, photos of work samples, Word, Excel or PowerPoint files, up to 25 MB each.</p> : (
          <ul className="divide-y divide-slate-100">{files.map((f) => (
            <li key={f.id} className="flex items-start gap-2 py-2.5">
              <FileText className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => p.act(() => p.api.openFile(f.id))} className="break-words text-left font-bold text-slate-900 underline-offset-4 hover:underline">{f.data.name}</button>
                <p className="text-xs text-slate-500">{f.data.folder} · {size(f.data.size)} · {p.nameOf(f.createdBy)} · {when(f.createdAt)}</p>
              </div>
              <span className="flex shrink-0 items-center">
                <button type="button" className={SMALL} onClick={() => p.act(() => p.api.openFile(f.id, true))} aria-label={`Download ${f.data.name}`}><Download className="h-3.5 w-3.5" /></button>
                {p.mayEdit(f) && <DeleteButton onDelete={() => p.act(() => p.api.remove(f.id), "File deleted.")} />}
              </span>
            </li>
          ))}</ul>
        )}
      </section>
    </div>

    {linkForm && <LinkForm initial={linkForm.data} id={linkForm.id} onClose={() => setLinkForm(null)} />}
    {noteForm && <NoteForm initial={noteForm.data} id={noteForm.id} onClose={() => setNoteForm(null)} />}
    {note && !noteForm && (
      <HubModal title={note.data.title} onClose={() => setOpenNote(null)} size="lg"
        footer={p.lead ? <div className="flex justify-between gap-2"><DeleteButton onDelete={() => p.act(async () => { await p.api.remove(note.id); setOpenNote(null); }, "Deleted.")} /><span className="flex gap-2"><button type="button" className={SECOND} onClick={() => p.act(() => p.api.update(note.id, { pinned: !note.data.pinned }), note.data.pinned ? "Unpinned." : "Pinned to Today.")}>{note.data.pinned ? "Unpin" : "Pin to Today"}</button><button type="button" className={PRIMARY} onClick={() => setNoteForm({ id: note.id, data: note.data })}>Edit</button></span></div> : undefined}>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-900">{note.data.body || "Nothing written yet."}</p>
        <p className="mt-4"><Who id={note.createdBy} at={note.updatedAt} /></p>
      </HubModal>
    )}
  </>;
}

const size = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function LinkForm({ initial, id, onClose }: { initial: LinkData; id?: string; onClose: () => void }) {
  const p = usePara();
  const [d, setD] = useState(initial);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const ok = await p.act(() => (id ? p.api.update(id, d) : p.api.add("link", d)), id ? "Saved." : "Link added.");
    setSaving(false);
    if (ok) onClose();
  };
  return (
    <HubModal title={id ? "Edit link" : "Add a link"} onClose={onClose} footer={<Saver saving={saving} onCancel={onClose} onSave={save} />}>
      <div className="grid gap-3">
        <Labeled label="Web address"><Field data-autofocus value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} placeholder="https://docs.google.com/…" inputMode="url" /></Labeled>
        <Labeled label="Name"><Field value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} maxLength={120} placeholder="Daily schedule, behavior plan for J., sub binder…" /></Labeled>
        <Labeled label="Folder"><Choice value={d.folder} onChange={(e) => setD({ ...d, folder: e.target.value as DocFolder })}>{DOC_FOLDERS.map((f) => <option key={f}>{f}</option>)}</Choice></Labeled>
        <Labeled label="Note (optional)"><Area h="min-h-16" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} maxLength={600} /></Labeled>
        <p className="text-xs text-slate-500">Make sure the doc is shared with your team in Google Drive or OneDrive, or they won't be able to open it.</p>
      </div>
    </HubModal>
  );
}

function NoteForm({ initial, id, onClose }: { initial: NoteData; id?: string; onClose: () => void }) {
  const p = usePara();
  const [d, setD] = useState(initial);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const ok = await p.act(() => (id ? p.api.update(id, d) : p.api.add("note", d)), "Saved.");
    setSaving(false);
    if (ok) onClose();
  };
  return (
    <HubModal title={id ? "Edit note" : "New team note"} onClose={onClose} size="lg" footer={<Saver saving={saving} onCancel={onClose} onSave={save} />}>
      <div className="grid gap-3">
        <Labeled label="Title"><Field data-autofocus value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} maxLength={120} placeholder="Morning routine, fire drill plan, who to call…" /></Labeled>
        <Labeled label="Note"><Area h="min-h-48" value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} maxLength={6000} /></Labeled>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" className="h-4 w-4 accent-teal-700" checked={d.pinned} onChange={(e) => setD({ ...d, pinned: e.target.checked })} />Pin it to everyone's Today page</label>
      </div>
    </HubModal>
  );
}

// ─── Team ───

export function TeamSection({ onLeft }: { onLeft: () => void }) {
  const p = usePara();
  const { team, lead, me } = p;
  const [name, setName] = useState(team.name);
  const [myTitle, setMyTitle] = useState(team.members.find((m) => m.userId === me)?.title || "");
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState("");
  const link = team.invite ? inviteLink(team.invite.code) : "";
  const qr = useMemo(() => (link ? qrSvg(link, "M", { px: 4, margin: 2 }) : ""), [link]);
  const people = team.members.filter((m) => !m.left);
  const message = `Join our Para Team on Arise WorkHub. It has our schedule, calendar, to-dos, student pages, lesson plans and files in one place. Open this link and sign in or make a free account: ${link}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); p.say("Invite link copied."); } catch { p.say("Couldn't copy. Press and hold the link to copy it."); }
  };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: `Join ${team.name}`, text: message }); return; } catch { return; } }
    void copy();
  };

  return <>
    <SectionHead title="Team" line={lead ? "Invite your paras and 1:1s, and choose who helps run the team." : "The people on your team."} />
    {lead && team.invite && (
      <section className={`${CARD} mb-4 border-teal-200 bg-teal-50/60`} aria-labelledby="invite-head">
        <h2 id="invite-head" className="text-lg font-extrabold text-slate-950">Invite your paras</h2>
        <p className="mt-1 text-sm text-slate-700">Send this link by text or email. They open it, sign in (or make a free account in a minute) and they're on the team.</p>
        {team.invite.on ? <>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="break-all rounded-xl border border-teal-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-900" data-testid="para-invite-link">{link}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={PRIMARY} onClick={copy}><Copy className="h-4 w-4" />Copy link</button>
                <button type="button" className={SECOND} onClick={share}><Share2 className="h-4 w-4" />Share</button>
                <a className={SECOND} href={`sms:?&body=${encodeURIComponent(message)}`}><MessageSquare className="h-4 w-4" />Text</a>
                <a className={SECOND} href={`mailto:?subject=${encodeURIComponent(`Join ${team.name} on Arise WorkHub`)}&body=${encodeURIComponent(message)}`}><Mail className="h-4 w-4" />Email</a>
              </div>
              <div className="flex flex-wrap gap-1 pt-1 text-sm">
                <button type="button" className={SMALL} onClick={() => p.act(() => p.api.teamCall("/invite/new", { method: "POST" }), "New link made. The old one no longer works.")}>Make a new link</button>
                <button type="button" className={SMALL} onClick={() => p.act(() => p.api.teamCall("", { method: "PATCH", body: JSON.stringify({ inviteOn: false }) }), "Invites are off.")}>Turn invites off</button>
              </div>
              <p className="text-xs text-slate-500">Paras can also scan the code with a phone camera.</p>
            </div>
            {qr && <div className="w-36 shrink-0 self-center rounded-xl bg-white p-2" aria-label="QR code for the invite link" role="img" dangerouslySetInnerHTML={{ __html: qr }} />}
          </div>
        </> : (
          <div className="mt-3 flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-slate-700">Invites are off, so nobody new can join.</p><button type="button" className={PRIMARY} onClick={() => p.act(() => p.api.teamCall("", { method: "PATCH", body: JSON.stringify({ inviteOn: true }) }), "Invites are on.")}>Turn invites on</button></div>
        )}
      </section>
    )}

    <section className={`${CARD} mb-4`} aria-labelledby="people-head">
      <h2 id="people-head" className="mb-2 text-lg font-extrabold text-slate-950">{people.length} {people.length === 1 ? "person" : "people"}</h2>
      <ul className="divide-y divide-slate-100">{people.map((m) => (
        <li key={m.userId} className="flex flex-wrap items-center gap-3 py-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-700" aria-hidden>{m.name.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900">{m.name}{m.userId === me ? " (you)" : ""}</p>
            <p className="text-sm text-slate-600">{[m.title, m.role === "lead" ? (m.owner ? "Teacher · made the team" : "Lead") : "Para"].filter(Boolean).join(" · ")}</p>
          </div>
          {lead && !m.owner && m.userId !== me && (
            <span className="flex flex-wrap items-center gap-1">
              <button type="button" className={SMALL} onClick={() => p.act(() => p.api.teamCall(`/members/${m.userId}`, { method: "PATCH", body: JSON.stringify({ role: m.role === "lead" ? "para" : "lead" }) }), m.role === "lead" ? `${m.name} is a para now.` : `${m.name} can now edit students, the schedule and notes.`)}>{m.role === "lead" ? "Make a para" : "Make a lead"}</button>
              <DeleteButton label="Remove" onDelete={() => p.act(() => p.api.teamCall(`/members/${m.userId}`, { method: "DELETE" }), `${m.name} was removed.`)} />
            </span>
          )}
        </li>
      ))}</ul>
      {lead && <p className="mt-2 text-xs text-slate-500">Leads can add and change students, the schedule and team notes, and pin messages. Paras can add messages, to-dos, calendar events, data, lessons, links and files, and change their own.</p>}
    </section>

    <section className={`${CARD} mb-4`} aria-labelledby="me-head">
      <h2 id="me-head" className="mb-2 text-lg font-extrabold text-slate-950">Your job on this team</h2>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void p.act(() => p.api.teamCall(`/members/${me}`, { method: "PATCH", body: JSON.stringify({ title: myTitle }) }), "Saved."); }}>
        <label htmlFor="my-title" className="sr-only">Your job</label>
        <Field id="my-title" value={myTitle} onChange={(e) => setMyTitle(e.target.value)} maxLength={60} placeholder="Para, 1:1 for J., speech para, teacher…" className="max-w-sm" />
        <button type="submit" className={SECOND}>Save</button>
      </form>
    </section>

    {lead && (
      <section className={`${CARD} mb-4`} aria-labelledby="name-head">
        <h2 id="name-head" className="mb-2 text-lg font-extrabold text-slate-950">Team name</h2>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void p.act(() => p.api.teamCall("", { method: "PATCH", body: JSON.stringify({ name }) }), "Renamed."); }}>
          <label htmlFor="team-name" className="sr-only">Team name</label>
          <Field id="team-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="max-w-sm" />
          <button type="submit" className={SECOND}>Rename</button>
        </form>
      </section>
    )}

    <section className={`${CARD} border-rose-200`} aria-labelledby="leave-head">
      <h2 id="leave-head" className="mb-2 text-lg font-extrabold text-slate-950">{team.owner ? "Delete this team" : "Leave this team"}</h2>
      {team.owner ? (!deleting ? <>
        <p className="mb-3 text-sm text-slate-600">Deletes every message, schedule block, student page, data entry, lesson, link and file on the team, for everyone. This can't be undone.</p>
        <button type="button" className={DANGER} onClick={() => setDeleting(true)}>Delete the team…</button>
      </> : <>
        <p className="mb-2 text-sm text-slate-700">Type the team's name, <b>{team.name}</b>, to delete it.</p>
        <div className="flex flex-wrap gap-2">
          <label htmlFor="confirm-delete" className="sr-only">Team name</label>
          <Field id="confirm-delete" value={typed} onChange={(e) => setTyped(e.target.value)} className="max-w-sm" />
          <button type="button" className={DANGER} disabled={typed.trim() !== team.name} onClick={() => p.act(async () => { await p.api.teamCall("", { method: "DELETE" }); onLeft(); }, "Team deleted.")}>Delete forever</button>
          <button type="button" className={SECOND} onClick={() => { setDeleting(false); setTyped(""); }}>Keep it</button>
        </div>
      </>) : <>
        <p className="mb-3 text-sm text-slate-600">You'll stop seeing this team. What you added stays for the rest of the team. You can rejoin with a new invite link.</p>
        <LeaveButton onLeave={() => p.act(async () => { await p.api.teamCall(`/members/${me}`, { method: "DELETE" }); onLeft(); }, "You left the team.")} />
      </>}
    </section>
  </>;
}

function LeaveButton({ onLeave }: { onLeave: () => void }) {
  const [sure, setSure] = useState(false);
  return sure
    ? <span className="flex flex-wrap gap-2"><button type="button" className={DANGER} onClick={onLeave}>Yes, leave</button><button type="button" className={SECOND} onClick={() => setSure(false)}>Stay</button></span>
    : <button type="button" className={DANGER} onClick={() => setSure(true)}>Leave the team…</button>;
}
