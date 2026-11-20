// Arise WorkHub: Grade Plans (a Plugin Gallery plugin). Upload grades; the AI finds missing and failed
// work; pick what to act on; the AI writes each student's plan with emails to the class teacher (retake
// and where to find it), the parents and the advisor. Pick an open time from the calendar to pull the
// student: it goes on the calendar and Makeup tests, and the to-dos go on Tasks. The rules are
// shared/gradePlans.ts and the AI is server/gradePlans.ts.
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { CalendarPlus, Check, ClipboardCheck, Copy, FileText, ListTodo, Mail, Settings2, Sparkles, Trash2, Upload, X } from "lucide-react";
import { UPLOAD_ACCEPT, UPLOAD_LIMITS, type UploadedFile } from "@shared/uploads";
import {
  CONCERN_LABEL, byStudent, cleanGradePlans, cleanSettings, contactEmail, fillRetake, freeSlots, mailto, matchStudent, niceTime,
  parentEmailsFor, retakeWords, type Concern, type GradePlan, type GradePlanSettings, type PlanEmail, type Retake, type Slot,
} from "@shared/gradePlans";
import { cleanMakeups, type Makeup } from "@shared/hubMakeups";
import type { HubEvent, Task, Workspace } from "@shared/teacherHub";
import { API_BASE } from "@/lib/queryClient";
import { pdfsForAi } from "@/lib/pdfPages";
import { Card, Empty } from "./ui";

type Props = { workspace: Workspace; setWorkspace: Dispatch<SetStateAction<Workspace>>; token: string | null; today: string; makeId: () => string; say: (text: string) => void };

const btn = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const dark = btn + " bg-slate-950 text-white hover:bg-slate-800";
const light = btn + " border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
const ai = btn + " bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm hover:opacity-95";
const field = "block min-h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100";
const KIND_LOOK: Record<Concern["kind"], string> = { missing: "bg-amber-100 text-amber-900", failed: "bg-rose-100 text-rose-800", low: "bg-orange-100 text-orange-800" };
const STATUS_LOOK: Record<GradePlan["status"], string> = { open: "bg-amber-50 text-amber-900 ring-amber-200", scheduled: "bg-sky-50 text-sky-800 ring-sky-200", done: "bg-emerald-50 text-emerald-800 ring-emerald-200" };
const STATUS_LABEL: Record<GradePlan["status"], string> = { open: "Needs a time", scheduled: "Retake scheduled", done: "Done" };

async function askGradeAi(token: string | null, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API_BASE}/api/teacher-hub/grade-plans/ai`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "The AI helper couldn't answer right now. Try again.");
  return data;
}
const fileBase64 = (file: File) => new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).replace(/^data:[^,]*,/, "")); r.onerror = () => no(new Error("read failed")); r.readAsDataURL(file); });
async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img: HTMLImageElement = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("bad image")); i.src = url; });
    const k = Math.min(1, 1800 / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally { URL.revokeObjectURL(url); }
}
const nowTime = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export default function HubGradePlans({ workspace, setWorkspace, token, today, makeId, say }: Props) {
  const plans = useMemo(() => cleanGradePlans((workspace as any).gradePlans), [(workspace as any).gradePlans]);
  const settings = useMemo(() => cleanSettings((workspace as any).gradePlanSettings), [(workspace as any).gradePlanSettings]);
  const roster = useMemo(() => workspace.students.map((s) => s.name), [workspace.students]);
  const [showSettings, setShowSettings] = useState(false);
  // Step 1: the grades.
  const [text, setText] = useState("");
  const [links, setLinks] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [photos, setPhotos] = useState<{ name: string; data: string }[]>([]);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  // Step 2: what was found, and which are picked.
  const [found, setFound] = useState<Concern[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [making, setMaking] = useState("");
  const [filter, setFilter] = useState<"open" | "all">("open");
  const hasGrades = !!(text.trim() || links.trim() || files.length || photos.length);

  const setSettings = (next: GradePlanSettings) => setWorkspace((w) => ({ ...w, gradePlanSettings: next } as Workspace));
  const savePlans = (fn: (all: GradePlan[]) => GradePlan[]) => setWorkspace((w) => ({ ...w, gradePlans: fn(cleanGradePlans((w as any).gradePlans)) } as Workspace));

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setError("");
    const f = [...files], p = [...photos];
    for (const file of [...list]) {
      if (/\.(png|jpe?g|webp)$/i.test(file.name) || file.type.startsWith("image/")) {
        if (p.length >= 6) { setError("Up to 6 photos."); continue; }
        try { p.push({ name: file.name, data: await shrinkPhoto(file) }); } catch { setError(`“${file.name}” couldn’t be read.`); }
      } else {
        if (f.length >= UPLOAD_LIMITS.files) { setError(`Up to ${UPLOAD_LIMITS.files} files at a time.`); continue; }
        if (file.size > UPLOAD_LIMITS.fileBytes) { setError(`“${file.name}” is too big.`); continue; }
        try { f.push({ name: file.name, data: await fileBase64(file) }); } catch { setError(`“${file.name}” couldn’t be read.`); }
      }
    }
    setFiles(f); setPhotos(p);
  }

  async function read() {
    setReading(true); setError(""); setFound(null);
    try {
      // PDFs are read here in the browser (the same reader as the Exemplar Maker): words as text, a scan as pictures.
      const ready = await pdfsForAi(files, Math.max(0, 6 - photos.length)).catch(() => ({ files, images: [] as string[] }));
      const data = await askGradeAi(token, { mode: "read", text, links, files: ready.files, images: [...photos.map((x) => x.data), ...ready.images] });
      const list: Concern[] = (data.concerns || []).map((c: Concern, i: number) => ({ ...c, id: `${Date.now()}-${i}`, student: matchStudent(c.student, roster) || c.student }));
      setFound(list);
      setPicked(new Set(list.filter((c) => c.kind !== "low").map((c) => c.id)));
      if (!list.length) setError("Nothing missing or failing in those grades.");
    } catch (e: any) { setError(e.message); } finally { setReading(false); }
  }

  async function makePlan(student: string, concerns: Concern[]) {
    const s = workspace.students.find((x) => x.name === student);
    const parents = parentEmailsFor(student, workspace.guides || []);
    const data = await askGradeAi(token, {
      mode: "plan", firstName: student.split(/[\s,]+/)[0], grade: s?.grade || "", accommodations: s?.accommodations || "",
      concerns: concerns.map(({ assignment, subject, teacher, score, kind, due }) => ({ assignment, subject, teacher, score, kind, due })),
      sender: workspace.profile.senderName || "", senderRole: workspace.profile.role || "", parentNames: parents.names, advisorName: settings.advisorName,
    });
    const teacherEmails: PlanEmail[] = (data.teacherEmails || []).map((e: any) => ({ to: contactEmail(e.name || "", workspace.spedContacts || []), name: e.name || "", subject: e.subject || "", body: e.body || "" }));
    const plan: GradePlan = {
      id: makeId(), student, concerns, summary: data.summary || "", steps: data.steps || [], teacherEmails,
      parentEmail: { to: parents.emails.join(", "), name: parents.names, subject: data.parentEmail?.subject || "", body: data.parentEmail?.body || "" },
      advisorEmail: { to: settings.advisorEmail, name: settings.advisorName, subject: data.advisorEmail?.subject || "", body: data.advisorEmail?.body || "" },
      todos: (data.todos || []).map((t: string) => ({ text: t })), status: "open", createdAt: new Date().toISOString(),
    };
    savePlans((all) => [plan, ...all]);
  }

  async function makePlans(groups: { student: string; concerns: Concern[] }[]) {
    setError("");
    let made = 0;
    for (const [i, g] of groups.entries()) {
      setMaking(`Writing plan ${i + 1} of ${groups.length}: ${g.student}…`);
      try { await makePlan(g.student, g.concerns); made++; } catch (e: any) { setError(`${g.student}: ${e.message}`); break; }
    }
    setMaking("");
    if (made) { say(`${made} plan${made === 1 ? "" : "s"} made.`); setFound(null); setText(""); setLinks(""); setFiles([]); setPhotos([]); }
  }

  const groups = found ? byStudent(found) : [];
  const pickedGroups = groups.map((g) => ({ student: g.student, concerns: g.concerns.filter((c) => picked.has(c.id)) })).filter((g) => g.concerns.length);
  const shown = plans.filter((p) => filter === "all" || p.status !== "done");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Grade Plans</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Upload grades. The AI finds missing and failed work, writes each student's plan and the emails, and you pick a time on your calendar to pull them for the retake.</p>
        </div>
        <button type="button" className={light} onClick={() => setShowSettings(!showSettings)} aria-expanded={showSettings}><Settings2 className="h-4 w-4" /> Settings</button>
      </div>

      {showSettings && <Card title="Settings">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-slate-600">School day starts<input type="time" value={settings.dayStart} onChange={(e) => setSettings({ ...settings, dayStart: e.target.value })} className={field + " mt-1"} /></label>
          <label className="text-xs font-semibold text-slate-600">School day ends<input type="time" value={settings.dayEnd} onChange={(e) => setSettings({ ...settings, dayEnd: e.target.value })} className={field + " mt-1"} /></label>
          <label className="text-xs font-semibold text-slate-600">Retake length<select value={settings.minutes} onChange={(e) => setSettings({ ...settings, minutes: Number(e.target.value) })} className={field + " mt-1"}>{[20, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Where retakes happen<input value={settings.where} onChange={(e) => setSettings({ ...settings, where: e.target.value })} placeholder="Room 112" className={field + " mt-1"} /></label>
          <label className="text-xs font-semibold text-slate-600">Advisor's name<input value={settings.advisorName} onChange={(e) => setSettings({ ...settings, advisorName: e.target.value })} placeholder="Ms. Lopez" className={field + " mt-1"} /></label>
          <label className="text-xs font-semibold text-slate-600">Advisor's email<input type="email" value={settings.advisorEmail} onChange={(e) => setSettings({ ...settings, advisorEmail: e.target.value })} placeholder="advisor@school.org" className={field + " mt-1"} /></label>
        </div>
        <p className="mt-2 text-xs text-slate-500">Parent emails come from each student's IEP checklist, and class teachers' emails from your saved contacts, when they're there. You can type any address on a plan.</p>
      </Card>}

      {/* 1. Grades */}
      <Card title="1. Add grades">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-bold text-white hover:bg-violet-800">
              <Upload className="h-4 w-4" /> Upload grades: export, PDF, screenshot, photo…
              <input type="file" multiple hidden accept={UPLOAD_ACCEPT} onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} data-testid="grades-upload" />
            </label>
            {[...files.map((f, i) => ({ k: `f${i}`, name: f.name, drop: () => setFiles(files.filter((_, j) => j !== i)) })), ...photos.map((p, i) => ({ k: `p${i}`, name: p.name, drop: () => setPhotos(photos.filter((_, j) => j !== i)) }))].map((x) => (
              <span key={x.k} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800"><FileText className="h-3.5 w-3.5" />{x.name}<button type="button" onClick={x.drop} aria-label={`Remove ${x.name}`} className="ml-1 text-slate-500 hover:text-rose-600"><X className="h-3 w-3" /></button></span>
            ))}
          </div>
          <details className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <summary className="cursor-pointer font-semibold text-slate-700">Or paste them, or link a Google Sheet</summary>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={20000} placeholder="Paste a gradebook, a progress report or a missing-work list" className={field + " mt-2 py-2"} />
            <input value={links} onChange={(e) => setLinks(e.target.value)} inputMode="url" placeholder="https://docs.google.com/spreadsheets/… (Anyone with the link)" className={field + " mt-2"} />
          </details>
          <button type="button" className={ai} disabled={!hasGrades || reading} onClick={() => void read()} data-testid="grades-read"><Sparkles className="h-4 w-4" />{reading ? "Reading the grades…" : "Find missing and failing work"}</button>
          {error && <p className="text-sm text-rose-700" role="alert">{error}</p>}
        </div>
      </Card>

      {/* 2. What was found */}
      {found && found.length > 0 && <Card title="2. Pick what to plan for" right={<button type="button" className={ai} disabled={!pickedGroups.length || !!making} onClick={() => void makePlans(pickedGroups)} data-testid="grades-plan-all"><Sparkles className="h-4 w-4" />{making || `Make ${pickedGroups.length} plan${pickedGroups.length === 1 ? "" : "s"}`}</button>}>
        <div className="space-y-3">
          {groups.map((g) => {
            const known = roster.includes(g.student);
            return <div key={g.student} className="rounded-2xl border border-slate-200 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-900">{g.student}</span>
                {!known && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">not on your caseload</span>}
              </div>
              <ul className="space-y-1">
                {g.concerns.map((c) => <li key={c.id}><label className="flex min-h-10 items-center gap-2 rounded-lg px-1 text-sm hover:bg-slate-50">
                  <input type="checkbox" className="h-4 w-4" checked={picked.has(c.id)} onChange={(e) => { const n = new Set(picked); if (e.target.checked) n.add(c.id); else n.delete(c.id); setPicked(n); }} />
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${KIND_LOOK[c.kind]}`}>{CONCERN_LABEL[c.kind]}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-900">{c.assignment}</span>
                  <span className="shrink-0 text-xs text-slate-500">{[c.subject, c.teacher, c.score].filter(Boolean).join(" · ")}</span>
                </label></li>)}
              </ul>
            </div>;
          })}
        </div>
      </Card>}

      {/* Plans */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-slate-950">Plans</h3>
        <div className="flex gap-1">{(["open", "all"] as const).map((f) => <button key={f} type="button" onClick={() => setFilter(f)} className={`min-h-9 rounded-full px-3 text-sm font-semibold ${filter === f ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{f === "open" ? "Open" : "All"}</button>)}</div>
      </div>
      {shown.length ? shown.map((p) => <PlanCard key={p.id} plan={p} settings={settings} workspace={workspace} setWorkspace={setWorkspace} today={today} makeId={makeId} say={say} savePlans={savePlans} />)
        : <Empty>{plans.length ? "No open plans. " : "No plans yet. "}Upload grades above to make the first one.</Empty>}
    </div>
  );
}

function PlanCard({ plan, settings, workspace, setWorkspace, today, makeId, say, savePlans }: {
  plan: GradePlan; settings: GradePlanSettings; workspace: Workspace; setWorkspace: Dispatch<SetStateAction<Workspace>>; today: string; makeId: () => string; say: (t: string) => void;
  savePlans: (fn: (all: GradePlan[]) => GradePlan[]) => void;
}) {
  const [tab, setTab] = useState<string>("t0");
  const [custom, setCustom] = useState({ date: "", start: "" });
  const [where, setWhere] = useState(settings.where);
  const patch = (p: Partial<GradePlan>) => savePlans((all) => all.map((x) => (x.id === plan.id ? { ...x, ...p } : x)));
  const slots = useMemo(() => freeSlots(workspace.events || [], today, settings, { days: 8, perDay: 3, nowTime: nowTime() }), [workspace.events, today, settings]);
  const emails: { key: string; label: string; email: PlanEmail; set: (e: PlanEmail) => void }[] = [
    ...plan.teacherEmails.map((e, i) => ({ key: `t${i}`, label: e.name ? `To ${e.name}` : "To the teacher", email: e, set: (n: PlanEmail) => patch({ teacherEmails: plan.teacherEmails.map((x, j) => (j === i ? n : x)) }) })),
    { key: "parent", label: "To parents", email: plan.parentEmail, set: (n: PlanEmail) => patch({ parentEmail: n }) },
    { key: "advisor", label: "To advisor", email: plan.advisorEmail, set: (n: PlanEmail) => patch({ advisorEmail: n }) },
  ];
  const open = emails.find((e) => e.key === tab) || emails[0];

  /** The retake goes on the calendar and on Makeup tests. */
  function schedule(slot: Slot) {
    const r: Retake = { date: slot.date, start: slot.start, end: slot.end, where };
    const what = plan.concerns.map((c) => c.assignment).join(", ");
    setWorkspace((w) => {
      const eventId = makeId(), makeupId = makeId(), at = new Date().toISOString();
      const old = plan.retake;
      const event: HubEvent = { id: eventId, title: `Retake: ${plan.student.split(" ")[0]} — ${what}`.slice(0, 160), date: r.date, start: r.start, end: r.end, location: r.where, notes: `Grade plan: pull ${plan.student} to retake or finish ${what}.`, students: [plan.student] } as HubEvent;
      const s = w.students.find((x) => x.name === plan.student);
      const makeup: Makeup = { id: makeupId, students: [plan.student], test: what.slice(0, 160), subject: plan.concerns[0]?.subject || "", missedOn: plan.concerns[0]?.due || today, reason: plan.concerns.every((c) => c.kind === "missing") ? "Other" : "Retake",
        date: r.date, start: r.start, end: r.end, where: r.where, proctor: workspace.profile.senderName || "", accommodations: s?.accommodations || "", status: "scheduled", scores: {}, notes: plan.summary, links: [], eventId, createdAt: at, updatedAt: at };
      const makeups = cleanMakeups((w as any).makeups).filter((m) => m.id !== old?.makeupId);
      const gradePlans = cleanGradePlans((w as any).gradePlans).map((x) => (x.id === plan.id ? { ...x, retake: { ...r, eventId, makeupId }, status: "scheduled" as const } : x));
      return { ...w, events: [...w.events.filter((e) => e.id !== old?.eventId), event], makeups: [makeup, ...makeups], gradePlans } as Workspace;
    });
    say(`Retake on the calendar and in Makeup tests: ${retakeWords(r)}.`);
  }
  function addTodo(i: number) {
    const t = plan.todos[i];
    if (!t || t.taskId) return;
    const id = makeId();
    const task: Task = { id, title: `${t.text} (${plan.student.split(" ")[0]})`.slice(0, 200), dueDate: plan.retake?.date || today, recurring: "", done: false, notes: `From ${plan.student}'s grade plan.` };
    setWorkspace((w) => ({ ...w, tasks: [task, ...w.tasks], gradePlans: cleanGradePlans((w as any).gradePlans).map((x) => (x.id === plan.id ? { ...x, todos: x.todos.map((y, j) => (j === i ? { ...y, taskId: id } : y)) } : x)) } as Workspace));
  }
  function addAllTodos() {
    const at = plan.todos.map((t) => (t.taskId ? t : { ...t, taskId: makeId() }));
    const tasks: Task[] = at.filter((t, i) => !plan.todos[i].taskId).map((t) => ({ id: t.taskId!, title: `${t.text} (${plan.student.split(" ")[0]})`.slice(0, 200), dueDate: plan.retake?.date || today, recurring: "", done: false, notes: `From ${plan.student}'s grade plan.` }));
    if (!tasks.length) return;
    setWorkspace((w) => ({ ...w, tasks: [...tasks, ...w.tasks], gradePlans: cleanGradePlans((w as any).gradePlans).map((x) => (x.id === plan.id ? { ...x, todos: at } : x)) } as Workspace));
    say(`${tasks.length} to-do${tasks.length === 1 ? "" : "s"} added to Tasks.`);
  }
  async function copy(e: PlanEmail) {
    const text = `${fillRetake(e.subject, plan.retake)}\n\n${fillRetake(e.body, plan.retake)}`;
    try { await navigator.clipboard.writeText(text); say("Email copied. Paste it into your email."); } catch { say("Couldn't copy on this device. Select the text and copy it."); }
  }
  const remove = () => {
    if (!window.confirm(`Delete ${plan.student}'s plan? The calendar time and to-dos stay.`)) return;
    savePlans((all) => all.filter((x) => x.id !== plan.id));
  };

  return (
    <Card title={plan.student} right={<div className="flex items-center gap-2">
      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${STATUS_LOOK[plan.status]}`}>{STATUS_LABEL[plan.status]}</span>
      {plan.status !== "done" ? <button type="button" className={light} onClick={() => patch({ status: "done" })}><Check className="h-4 w-4" /> Done</button>
        : <button type="button" className={light} onClick={() => patch({ status: plan.retake ? "scheduled" : "open" })}>Reopen</button>}
      <button type="button" className={light + " w-10 px-0"} onClick={remove} aria-label="Delete plan"><Trash2 className="h-4 w-4" /></button>
    </div>}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">{plan.concerns.map((c) => <span key={c.id} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${KIND_LOOK[c.kind]}`}>{CONCERN_LABEL[c.kind]}: {c.assignment}{c.score && c.kind !== "missing" ? ` (${c.score})` : ""}{c.teacher ? ` · ${c.teacher}` : ""}</span>)}</div>
        {plan.summary && <p className="text-sm text-slate-700">{plan.summary}</p>}
        {plan.steps.length > 0 && <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-800">{plan.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}

        {/* Retake time */}
        <section className="rounded-2xl bg-slate-50 p-3">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900"><CalendarPlus className="h-4 w-4" /> Pull {plan.student.split(" ")[0]} for the retake</h4>
          {plan.retake && <p className="mb-2 text-sm font-semibold text-sky-800">Scheduled: {retakeWords(plan.retake)}. Pick another time below to move it.</p>}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Where <input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Room" className="ml-1 inline-block h-9 w-36 rounded-lg border border-slate-200 bg-white px-2 text-sm" /></label>
            <span className="text-xs text-slate-500">Open times on your calendar ({settings.minutes} min, {niceTime(settings.dayStart)}–{niceTime(settings.dayEnd)}):</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {slots.map((s) => <button key={`${s.date}${s.start}`} type="button" onClick={() => schedule(s)} className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${plan.retake?.date === s.date && plan.retake?.start === s.start ? "border-sky-600 bg-sky-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-violet-400 hover:text-violet-700"}`}>{shortDay(s.date)} · {niceTime(s.start)}</button>)}
            {!slots.length && <span className="text-sm text-slate-500">No open times in the next two weeks. Pick one yourself:</span>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input type="date" value={custom.date} min={today} onChange={(e) => setCustom({ ...custom, date: e.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm" aria-label="Retake date" />
            <input type="time" value={custom.start} onChange={(e) => setCustom({ ...custom, start: e.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm" aria-label="Retake time" />
            <button type="button" className={light} disabled={!custom.date || !custom.start} onClick={() => { const [h, m] = custom.start.split(":").map(Number); const e = h * 60 + m + settings.minutes; schedule({ date: custom.date, start: custom.start, end: `${String(Math.floor(e / 60) % 24).padStart(2, "0")}:${String(e % 60).padStart(2, "0")}` }); }}>Use this time</button>
          </div>
        </section>

        {/* Emails */}
        <section>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900"><Mail className="h-4 w-4" /> Emails to send</h4>
          <div className="mb-2 flex flex-wrap gap-1">{emails.map((e) => <button key={e.key} type="button" onClick={() => setTab(e.key)} className={`min-h-9 rounded-full px-3 text-sm font-semibold ${open.key === e.key ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{e.label}</button>)}</div>
          {open && <div className="space-y-2 rounded-2xl border border-slate-200 p-3">
            <input value={open.email.to} onChange={(e) => open.set({ ...open.email, to: e.target.value })} placeholder="To (email address)" className={field} aria-label="To" />
            <input value={fillRetake(open.email.subject, plan.retake)} onChange={(e) => open.set({ ...open.email, subject: e.target.value })} placeholder="Subject" className={field + " font-semibold"} aria-label="Subject" />
            <textarea value={fillRetake(open.email.body, plan.retake)} onChange={(e) => open.set({ ...open.email, body: e.target.value })} rows={9} className={field + " py-2 leading-relaxed"} aria-label="Email" />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={dark} onClick={() => void copy(open.email)}><Copy className="h-4 w-4" /> Copy email</button>
              <a href={mailto(open.email, plan.retake)} className={light}><Mail className="h-4 w-4" /> Open in email</a>
            </div>
          </div>}
        </section>

        {/* To-dos */}
        {plan.todos.length > 0 && <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900"><ListTodo className="h-4 w-4" /> To-dos</h4>
            <button type="button" className={light} disabled={plan.todos.every((t) => t.taskId)} onClick={addAllTodos}><ClipboardCheck className="h-4 w-4" /> Add all to Tasks</button>
          </div>
          <ul className="space-y-1">{plan.todos.map((t, i) => <li key={i} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 text-slate-800">{t.text}</span>
            {t.taskId ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> In Tasks</span>
              : <button type="button" className="text-xs font-semibold text-violet-700 hover:underline" onClick={() => addTodo(i)}>Add to Tasks</button>}
          </li>)}</ul>
        </section>}
      </div>
    </Card>
  );
}


