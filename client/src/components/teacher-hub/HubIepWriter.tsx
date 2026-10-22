// Arise WorkHub: the IEP Writer. Opens full screen from step 7 of the meeting steps ("Write the IEP")
// and from the IEP checklist. It asks for the student first, then walks through drop
// boxes that adjust to the student, writes the whole IEP in the order of the school's template, and
// scores it live against the IEP Quality Rubric. The rules and wording are in shared/iepWriter.
import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, ClipboardCopy, Download, FileText, ListChecks, Plus, Trash2, X } from "lucide-react";
import {
  DISABILITIES, GOAL_STATUS, IEP_LIMITS, MEASURE_FREQ, NEED_AREAS, accLabel, areaOptions, fieldOptions, fieldShown, first, iepText, newIepDraft, newNeed,
  needById, scoreRubric, suggestedAcc, visibleSteps, writeIep, type IepDraft, type IepField, type IepNeed, type IepStep, type PriorGoal,
} from "@shared/iepWriter";
import type { Workspace } from "@shared/teacherHub";
import { HubModal } from "./HubModal";
import { Field, GhostButton, PrimaryButton, Select, TextArea } from "./ui";

type Setter = (change: (p: Workspace) => Workspace) => void;

/** The draft for this meeting (or, failing that, this student). */
export function findDraft(workspace: Workspace, student: string, meetingId?: string): IepDraft | undefined {
  const drafts = workspace.iepDrafts || [];
  return (meetingId && drafts.find((d) => d.meetingId === meetingId)) || drafts.find((d) => d.student.toLowerCase() === student.trim().toLowerCase());
}

/** A small card for step 7 and the checklist: where the IEP stands, and the button that opens the writer. */
export function IepWriterLauncher({ workspace, setWorkspace, makeId, student, meetingId }: { workspace: Workspace; setWorkspace: Setter; makeId: () => string; student: string; meetingId?: string }) {
  const [open, setOpen] = useState(false);
  const draft = findDraft(workspace, student, meetingId);
  const score = draft ? scoreRubric(draft) : null;
  return (
    <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4" data-testid="iep-writer-launcher">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <b className="flex items-center gap-2 text-slate-900"><FileText className="h-4 w-4 text-teal-700" /> Write the IEP{student ? ` for ${student.split(" ")[0]}` : ""}</b>
          <span className="block text-sm text-slate-600">{score
            ? `Rubric check: ${score.score.toFixed(1)} / 10 (${score.passed} of ${score.applicable} items). ${score.band.split(":")[1]?.trim() || ""}`
            : "Pick from drop boxes and the full IEP is written for you, checked against the IEP Quality Rubric."}</span>
        </div>
        <PrimaryButton onClick={() => setOpen(true)}>{draft ? "Keep writing" : "Start the IEP"} <ChevronRight className="h-4 w-4" /></PrimaryButton>
      </div>
      {open && <HubModal title={`IEP Writer${student ? `: ${student}` : ""}`} size="full" onClose={() => setOpen(false)} label="IEP Writer">
        <IepWriter workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} student={student} meetingId={meetingId} />
      </HubModal>}
    </div>
  );
}

export default function IepWriter({ workspace, setWorkspace, makeId, student, meetingId }: { workspace: Workspace; setWorkspace: Setter; makeId: () => string; student: string; meetingId?: string }) {
  const draft = findDraft(workspace, student, meetingId);
  if (!draft) return <StartForm workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} student={student} meetingId={meetingId} />;
  return <Writer draft={draft} setWorkspace={setWorkspace} makeId={makeId} />;
}

// ───────────────────────── step 0: who is it for
function StartForm({ workspace, setWorkspace, makeId, student, meetingId }: { workspace: Workspace; setWorkspace: Setter; makeId: () => string; student: string; meetingId?: string }) {
  const known = workspace.students.find((s) => s.name.trim().toLowerCase() === student.trim().toLowerCase());
  const meeting = meetingId ? workspace.meetings.find((m) => m.id === meetingId) : undefined;
  const [f, setF] = useState({
    name: student || "", grade: known?.grade?.replace(/[^0-9Kk]/g, "").toUpperCase() || "", age: "",
    dis1: DISABILITIES.find((x) => x.toLowerCase() === (known?.disability1 || "").toLowerCase()) || "",
    dis2: DISABILITIES.find((x) => x.toLowerCase() === (known?.disability2 || "").toLowerCase()) || "None",
    type: /reeval/i.test(meeting?.type || "") ? "Triennial (after re-evaluation)" : "Annual IEP",
    meetingDate: meeting?.date || "", school: workspace.profile.school || "",
  });
  const start = () => {
    const d = newIepDraft(f.name, makeId, { ...f, prevIep: known?.iepDate || "" });
    if (meetingId) d.meetingId = meetingId;
    setWorkspace((p) => ({ ...p, iepDrafts: [d, ...(p.iepDrafts || [])].slice(0, IEP_LIMITS.drafts) }));
  };
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="mx-auto max-w-2xl space-y-4" data-testid="iep-start">
      <p className="text-sm text-slate-600">First, who is this IEP for? The drop boxes after this change to fit the student: their grade, disabilities and the kind of IEP.{known ? " Filled in from your caseload." : ""}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Box label="Student's full name"><Field value={f.name} onChange={set("name")} maxLength={80} data-autofocus /></Box>
        <Box label="School / campus"><Field value={f.school} onChange={set("school")} maxLength={120} /></Box>
        <Box label="Grade"><Select value={f.grade} onChange={set("grade")}><option value="">Pick…</option>{["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"].map((g) => <option key={g}>{g}</option>)}</Select></Box>
        <Box label="Age"><Select value={f.age} onChange={set("age")}><option value="">Pick…</option>{Array.from({ length: 18 }, (_, i) => String(i + 4)).map((a) => <option key={a}>{a}</option>)}</Select></Box>
        <Box label="Primary disability"><Select value={f.dis1} onChange={set("dis1")}><option value="">Pick…</option>{DISABILITIES.map((x) => <option key={x}>{x}</option>)}</Select></Box>
        <Box label="Secondary disability"><Select value={f.dis2} onChange={set("dis2")}><option>None</option>{DISABILITIES.map((x) => <option key={x}>{x}</option>)}</Select></Box>
        <Box label="Kind of IEP"><Select value={f.type} onChange={set("type")}>{["Annual IEP", "Initial IEP", "Triennial (after re-evaluation)"].map((x) => <option key={x}>{x}</option>)}</Select></Box>
        <Box label="IEP meeting date"><Field type="date" value={f.meetingDate} onChange={set("meetingDate")} /></Box>
      </div>
      <PrimaryButton onClick={start} disabled={!f.name.trim()}>Start the IEP <ChevronRight className="h-4 w-4" /></PrimaryButton>
    </div>
  );
}

// ───────────────────────── the writer
function Writer({ draft, setWorkspace, makeId }: { draft: IepDraft; setWorkspace: Setter; makeId: () => string }) {
  const steps = visibleSteps(draft);
  const [stepId, setStepId] = useState(steps[0].id);
  const [view, setView] = useState<"write" | "preview" | "rubric">("write");
  const step = steps.find((s) => s.id === stepId) || steps[0];
  const at = steps.indexOf(step);
  const score = useMemo(() => scoreRubric(draft), [draft]);

  const update = (change: (d: IepDraft) => IepDraft) =>
    setWorkspace((p) => ({ ...p, iepDrafts: (p.iepDrafts || []).map((d) => (d.id === draft.id ? { ...change(d), updatedAt: new Date().toISOString() } : d)) }));
  const setA = (k: string, v: string) => update((d) => ({ ...d, a: { ...d.a, [k]: v }, ...(k === "name" ? { student: v } : {}) }));
  const toggleM = (k: string, v: string) => update((d) => { const cur = d.m[k] || []; return { ...d, m: { ...d.m, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } }; });
  const missingIn = (s: IepStep) => score.items.filter((i) => i.step === s.id && i.result === false).length;
  const go = (id: string) => { setStepId(id); setView("write"); };

  return (
    <div className="space-y-4" data-testid="iep-writer">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <ScoreRing score={score.score} />
        <div className="min-w-0 flex-1">
          <b className="block text-slate-900">Rubric check: {score.score.toFixed(1)} / 10</b>
          <span className="block text-sm text-slate-600">{score.band} · {score.passed} of {score.applicable} items met</span>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="IEP Writer view">
          {([["write", "Write", ListChecks], ["preview", "See the IEP", FileText], ["rubric", "Rubric", Check]] as const).map(([id, label, Icon]) =>
            <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold ${view === id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}><Icon className="h-4 w-4" />{label}</button>)}
        </div>
      </div>

      {view === "write" && <>
        <nav aria-label="IEP steps" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {steps.map((s, i) => { const miss = missingIn(s); return (
            <button key={s.id} type="button" onClick={() => setStepId(s.id)} aria-current={s.id === step.id ? "step" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${s.id === step.id ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
              <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${miss ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{miss ? miss : <Check className="h-3 w-3" />}</span>
              {i + 1}. {s.title}
            </button>); })}
        </nav>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-4">
            <span className="text-xs font-bold uppercase tracking-wide text-teal-700">Rubric {step.part}</span>
            <h2 className="text-lg font-bold text-slate-900">{step.title}</h2>
            <p className="text-sm text-slate-600">{step.intro}</p>
          </div>
          {step.custom === "needs" && <NeedsEditor draft={draft} update={update} makeId={makeId} />}
          {step.custom === "prior" && <PriorEditor draft={draft} update={update} makeId={makeId} />}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {step.fields.filter((f) => fieldShown(f, draft)).map((f) => <FieldBox key={f.id} f={f} draft={draft} setA={setA} toggleM={toggleM} />)}
          </div>
          <StillNeeded items={score.items.filter((i) => i.step === step.id && i.result === false)} />
          <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4">
            {at > 0 ? <GhostButton onClick={() => setStepId(steps[at - 1].id)}><ChevronLeft className="h-4 w-4" /> Back</GhostButton> : <span />}
            {at < steps.length - 1
              ? <PrimaryButton onClick={() => setStepId(steps[at + 1].id)}>Next: {steps[at + 1].title} <ChevronRight className="h-4 w-4" /></PrimaryButton>
              : <PrimaryButton onClick={() => setView("preview")}>See the finished IEP <ChevronRight className="h-4 w-4" /></PrimaryButton>}
          </div>
        </section>
      </>}

      {view === "preview" && <Preview draft={draft} />}
      {view === "rubric" && <RubricView score={score} steps={steps} go={go} />}
    </div>
  );
}

function Box({ label, children, help }: { label: string; children: ReactNode; help?: string }) {
  return <label className="block min-w-0"><span className="mb-1 block text-sm font-semibold text-slate-800">{label}</span>{children}{help && <span className="mt-1 block text-xs text-slate-500">{help}</span>}</label>;
}

function FieldBox({ f, draft, setA, toggleM }: { f: IepField; draft: IepDraft; setA: (k: string, v: string) => void; toggleM: (k: string, v: string) => void }) {
  const v = draft.a[f.id] || "";
  if (f.kind === "multi") {
    const picked = draft.m[f.id] || [];
    const options = fieldOptions(f, draft);
    const isAcc = f.id === "accs";
    return (
      <fieldset className="min-w-0 md:col-span-2">
        <legend className="mb-1.5 text-sm font-semibold text-slate-800">{f.label} <span className="font-normal text-slate-500">({picked.length} picked)</span></legend>
        {options.length ? <div className="flex flex-wrap gap-2">
          {options.map((o) => { const on = picked.includes(o); const label = isAcc ? accLabel(o) : o; const sug = isAcc && suggestedAcc(draft, o); return (
            <button key={o} type="button" aria-pressed={on} onClick={() => toggleM(f.id, o)}
              className={`min-h-11 rounded-xl border px-3 text-left text-sm ${on ? "border-teal-700 bg-teal-700 font-semibold text-white" : sug ? "border-teal-300 bg-teal-50 text-slate-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
              {on && <Check className="mr-1 inline h-3.5 w-3.5" />}{label}{sug && !on && <span className="ml-1.5 rounded bg-teal-100 px-1 text-[10px] font-bold uppercase text-teal-800">Suggested</span>}
            </button>); })}
        </div> : <p className="text-sm text-slate-500">Nothing to pick yet. Fill in the earlier steps first.</p>}
        {f.help && <span className="mt-1 block text-xs text-slate-500">{f.help}</span>}
      </fieldset>
    );
  }
  if (f.kind === "select" || f.kind === "yesno") {
    const options = f.kind === "yesno" ? ["Yes", "No"] : fieldOptions(f, draft);
    return <Box label={f.label} help={f.help}><Select value={v} onChange={(e) => setA(f.id, e.target.value)}><option value="">Pick…</option>{options.map((o) => <option key={o} value={o}>{o}</option>)}{v && !options.includes(v) && <option value={v}>{v}</option>}</Select></Box>;
  }
  if (f.kind === "long") return <div className="md:col-span-2"><Box label={f.label} help={f.help}><TextArea value={v} maxLength={IEP_LIMITS.text} placeholder={f.placeholder} onChange={(e) => setA(f.id, e.target.value)} /></Box></div>;
  return <Box label={f.label} help={f.help}><Field type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text"} inputMode={f.kind === "number" ? "decimal" : undefined} value={v} placeholder={f.placeholder} maxLength={300} onChange={(e) => setA(f.id, e.target.value)} /></Box>;
}

// ───────────────────────── needs, goals and services
const PERCENTS = ["40", "50", "60", "65", "70", "75", "80", "85", "90", "95", "100"];
const MINUTES = ["15", "30", "45", "60", "90", "120", "150", "180", "240", "300"];

function NeedsEditor({ draft, update, makeId }: { draft: IepDraft; update: (c: (d: IepDraft) => IepDraft) => void; makeId: () => string }) {
  const options = areaOptions(draft);
  const used = new Set(draft.needs.map((n) => n.area));
  const setNeed = (id: string, change: Partial<IepNeed>) => update((d) => ({ ...d, needs: d.needs.map((n) => (n.id === id ? { ...n, ...change } : n)) }));
  const add = (area: string) => area && update((d) => ({ ...d, needs: [...d.needs, newNeed(area, makeId)].slice(0, IEP_LIMITS.needs) }));
  return (
    <div className="mb-5 space-y-4">
      {!draft.a.dis1 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Pick the disability in “Evaluation & eligibility” first, so the right areas are suggested.</p>}
      {draft.needs.map((n, i) => {
        const area = needById(n.area); if (!area) return null;
        const goal = area.goals.find((g) => g.id === n.goal) || area.goals[0];
        const pct = goal.unit.startsWith("%");
        return (
          <div key={n.id} className="rounded-2xl border border-slate-200 p-4" data-testid="iep-need">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Area of need {i + 1} · {area.kind}</span><h3 className="font-bold text-slate-900">{area.label}</h3></div>
              <button type="button" onClick={() => update((d) => ({ ...d, needs: d.needs.filter((x) => x.id !== n.id) }))} aria-label={`Remove ${area.label}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2"><Box label="Annual goal"><Select value={n.goal} onChange={(e) => setNeed(n.id, { goal: e.target.value })}>{area.goals.map((g) => <option key={g.id} value={g.id}>{first(draft)} will {g.text.replace(/his or her/g, "their")} ({g.unit})</option>)}</Select></Box></div>
              <div className="md:col-span-2"><Box label="When given… (condition)"><Select value={n.condition} onChange={(e) => setNeed(n.id, { condition: e.target.value })}>{area.conditions.map((c) => <option key={c}>{c}</option>)}</Select></Box></div>
              <Box label={`Baseline now (${goal.unit})`} help="From the data in your present levels."><Field type="number" inputMode="decimal" value={n.baseline} onChange={(e) => setNeed(n.id, { baseline: e.target.value })} /></Box>
              <Box label={`Target by next year (${goal.unit})`}>{pct
                ? <Select value={n.target} onChange={(e) => setNeed(n.id, { target: e.target.value })}><option value="">Pick…</option>{PERCENTS.map((x) => <option key={x}>{x}</option>)}</Select>
                : <Field type="number" inputMode="decimal" value={n.target} onChange={(e) => setNeed(n.id, { target: e.target.value })} />}</Box>
              <Box label="Objective 1 (mid-year)"><Select value={n.obj1} onChange={(e) => setNeed(n.id, { obj1: e.target.value })}><option value="">Pick…</option>{area.objectives.map((o) => <option key={o.id} value={o.id}>{o.text.replace(/his or her/g, "their")}</option>)}</Select></Box>
              <Box label="Objective 2 (end of year)"><Select value={n.obj2} onChange={(e) => setNeed(n.id, { obj2: e.target.value })}><option value="">Pick…</option>{area.objectives.map((o) => <option key={o.id} value={o.id}>{o.text.replace(/his or her/g, "their")}</option>)}</Select></Box>
              <Box label="Measured by"><Select value={n.method} onChange={(e) => setNeed(n.id, { method: e.target.value })}>{area.methods.map((m) => <option key={m}>{m}</option>)}</Select></Box>
              <Box label="Data collected"><Select value={n.freq} onChange={(e) => setNeed(n.id, { freq: e.target.value })}>{MEASURE_FREQ.map((m) => <option key={m}>{m}</option>)}</Select></Box>
              <Box label="Service minutes per week"><Select value={n.minutes} onChange={(e) => setNeed(n.id, { minutes: e.target.value })}><option value="">Pick…</option>{MINUTES.map((m) => <option key={m}>{m}</option>)}</Select></Box>
              <Box label="Where"><Select value={n.where} onChange={(e) => setNeed(n.id, { where: e.target.value as IepNeed["where"] })}><option value="">Pick…</option><option value="gen">In the gen ed classroom (push-in)</option><option value="sped">Special education setting (pull-out)</option></Select></Box>
            </div>
          </div>
        );
      })}
      {draft.needs.length < IEP_LIMITS.needs && (
        <Box label={draft.needs.length ? "Add another area of need" : "Add an area of need"} help="Suggested areas come from the student's disabilities and SLD areas.">
          <Select value="" onChange={(e) => add(e.target.value)} data-testid="iep-add-need">
            <option value="">Pick an area…</option>
            <optgroup label="Suggested for this student">{options.filter((o) => o.suggested && !used.has(o.id)).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</optgroup>
            <optgroup label="Other areas">{options.filter((o) => !o.suggested && !used.has(o.id)).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</optgroup>
          </Select>
        </Box>
      )}
    </div>
  );
}

function PriorEditor({ draft, update, makeId }: { draft: IepDraft; update: (c: (d: IepDraft) => IepDraft) => void; makeId: () => string }) {
  const setRow = (id: string, change: Partial<PriorGoal>) => update((d) => ({ ...d, prior: d.prior.map((g) => (g.id === id ? { ...g, ...change } : g)) }));
  return (
    <div className="mb-5 space-y-3">
      {draft.prior.map((g, i) => (
        <div key={g.id} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_1fr_auto]">
          <Box label={`Last year's goal ${i + 1}: area`}><Select value={g.area} onChange={(e) => setRow(g.id, { area: e.target.value })}><option value="">Pick…</option>{NEED_AREAS.map((a) => <option key={a.id}>{a.label}</option>)}</Select></Box>
          <Box label="Progress"><Select value={g.status} onChange={(e) => setRow(g.id, { status: e.target.value })}><option value="">Pick…</option>{GOAL_STATUS.map((s) => <option key={s}>{s}</option>)}</Select></Box>
          <button type="button" onClick={() => update((d) => ({ ...d, prior: d.prior.filter((x) => x.id !== g.id) }))} aria-label="Remove goal" className="grid h-11 w-11 place-items-center self-end rounded-xl border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
          <div className="md:col-span-3"><Box label="Progress monitoring data, in a sentence" help="e.g. Went from 30% to 45% accuracy on decoding probes (Sept to Oct)."><Field value={g.data} maxLength={400} onChange={(e) => setRow(g.id, { data: e.target.value })} /></Box></div>
        </div>
      ))}
      {draft.prior.length < IEP_LIMITS.prior && <GhostButton onClick={() => update((d) => ({ ...d, prior: [...d.prior, { id: makeId(), area: "", status: "", data: "" }] }))}><Plus className="h-4 w-4" /> Add a goal from last year</GhostButton>}
    </div>
  );
}

// ───────────────────────── rubric, preview, export
function StillNeeded({ items }: { items: { id: string; text: string; fix: string; required: boolean }[] }) {
  if (!items.length) return <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800"><Check className="h-4 w-4" /> Everything the rubric checks on this step is done.</p>;
  return (
    <div className="mt-4 rounded-xl bg-amber-50 p-3">
      <b className="text-sm text-amber-900">Still needed for the rubric</b>
      <ul className="mt-1 space-y-1 text-sm text-amber-900">{items.map((i) => <li key={i.id}>• {i.fix}{i.required && <span className="ml-1 rounded bg-amber-200 px-1 text-[10px] font-bold uppercase">Required</span>}</li>)}</ul>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 9 ? "#047857" : score >= 8 ? "#0f766e" : score >= 7 ? "#b45309" : "#b91c1c";
  return <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-sm font-black" style={{ background: `conic-gradient(${color} ${score * 36}deg, #e2e8f0 0)` }}><span className="grid h-11 w-11 place-items-center rounded-full bg-white" style={{ color }}>{score.toFixed(1)}</span></div>;
}

function RubricView({ score, steps, go }: { score: ReturnType<typeof scoreRubric>; steps: IepStep[]; go: (id: string) => void }) {
  return (
    <div className="space-y-4" data-testid="iep-rubric">
      <p className="text-sm text-slate-600">{score.bandText} Items marked N/A don't apply to this student and aren't counted, the same way the rubric scores them.</p>
      {score.byPart.map((p) => (
        <section key={p.part} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-3"><h3 className="font-bold text-slate-900">{p.part}</h3><span className="text-sm font-semibold text-slate-600">{p.applicable ? `${p.passed} / ${p.applicable}` : "N/A"}</span></div>
          <ul className="divide-y divide-slate-100">
            {score.items.filter((i) => i.part === p.part).map((i) => (
              <li key={i.id} className="flex items-start gap-3 py-2 text-sm">
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${i.result === null ? "bg-slate-100 text-slate-500" : i.result ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>{i.result === null ? "–" : i.result ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}</span>
                <span className="min-w-0 flex-1">{i.text}{i.required && <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] font-bold uppercase text-slate-600">Required</span>}{i.result === false && <span className="block text-xs text-slate-500">{i.fix}</span>}</span>
                {i.result === false && steps.some((s) => s.id === i.step) && <button type="button" onClick={() => go(i.step)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-teal-800 underline">Fix it</button>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function Preview({ draft }: { draft: IepDraft }) {
  const sections = writeIep(draft);
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(iepText(draft)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the browser said no */ } };
  const download = () => {
    const body = sections.map((s) => `<h2>${esc(s.title)}</h2>${s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}${s.bullets?.length ? `<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}${s.table ? `<table border="1" cellpadding="4" style="border-collapse:collapse">${s.table.map((r, i) => `<tr>${r.map((c) => (i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`)).join("")}</tr>`).join("")}</table>` : ""}`).join("");
    const html = `<html><head><meta charset="utf-8"><title>${esc(draft.student)} IEP</title><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt}h1{font-size:16pt}h2{font-size:13pt;margin-top:14pt}</style></head><body><h1>${esc(draft.a.name || draft.student)}: IEP draft</h1>${body}</body></html>`;
    const url = URL.createObjectURL(new Blob(["﻿", html], { type: "application/msword" }));
    const a = document.createElement("a"); a.href = url; a.download = `${(draft.a.name || draft.student || "Student").replace(/[^\w -]/g, "")} IEP draft.doc`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="space-y-4" data-testid="iep-preview">
      <div className="flex flex-wrap gap-2">
        <PrimaryButton onClick={copy}><ClipboardCopy className="h-4 w-4" /> {copied ? "Copied" : "Copy the whole IEP"}</PrimaryButton>
        <GhostButton onClick={download}><Download className="h-4 w-4" /> Download for Word</GhostButton>
        <span className="self-center text-xs text-slate-500">Blanks (____) are things still to fill in.</span>
      </div>
      <article className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 text-[15px] leading-7 text-slate-800 sm:p-6">
        {sections.map((s) => (
          <section key={s.id}>
            <h3 className="mb-1 border-b border-slate-200 pb-1 text-base font-bold text-slate-900">{s.title}</h3>
            {s.paragraphs.map((p, i) => <p key={i} className="mt-2">{p}</p>)}
            {s.bullets?.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{s.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul> : null}
            {s.table && <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead><tr>{s.table[0].map((c) => <th key={c} className="border-b border-slate-200 py-1 pr-3 font-semibold">{c}</th>)}</tr></thead><tbody>{s.table.slice(1).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-slate-100 py-1 pr-3 align-top">{c}</td>)}</tr>)}</tbody></table></div>}
          </section>
        ))}
      </article>
    </div>
  );
}
