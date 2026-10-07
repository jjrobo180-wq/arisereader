// Teacher Hub: IEP goal progress monitoring and service-minute tracking (push-in, pull-out and the rest).
// The rules are in shared/hubProgress.ts.
import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { GOAL_AREAS, SERVICE_KINDS, goalProgress, serviceStatus, weekStart, withPoint, type GoalStatus } from "@shared/hubProgress";
import { friendlyDate } from "@shared/hubDates";
import type { Goal, ServicePlan, Workspace } from "@shared/teacherHub";
import { Card, Empty, Field, GhostButton, Labeled, PrimaryButton, Select, TextArea } from "./ui";
import { HubModal } from "./HubModal";

type Setter = Dispatch<SetStateAction<Workspace>>;
type Props = { workspace: Workspace; setWorkspace: Setter; remove: (key: keyof Workspace, id: string) => void; makeId: () => string; today: string };

const num = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const chipCls = (on: boolean) => `inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${on ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;
const STATUS: Record<GoalStatus, { word: string; cls: string }> = {
  met: { word: "Goal met", cls: "bg-emerald-100 text-emerald-800" },
  "on track": { word: "On track", cls: "bg-teal-100 text-teal-800" },
  close: { word: "Close", cls: "bg-amber-100 text-amber-800" },
  behind: { word: "Behind", cls: "bg-red-100 text-red-700" },
  "no data": { word: "No data yet", cls: "bg-slate-100 text-slate-600" },
};

function Bar({ percent, label, tone = "bg-teal-600" }: { percent: number; label: string; tone?: string }) {
  return <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(percent ? 3 : 0, percent)}%` }} /></div>;
}

function Spark({ goal }: { goal: Goal }) {
  const pts = [...goal.points].sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 2) return null;
  const values = [...pts.map((p) => p.value), goal.target, goal.baseline];
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const y = (v: number) => 56 - ((v - lo) / span) * 52;
  const x = (i: number) => 6 + (i / (pts.length - 1)) * 288;
  return (
    <svg viewBox="0 0 300 60" className="mt-3 h-16 w-full" role="img" aria-label={`Trend: ${pts.map((p) => p.value).join(", ")}`}>
      <line x1="0" x2="300" y1={y(goal.target)} y2={y(goal.target)} stroke="#0d9488" strokeDasharray="4 4" strokeWidth="1.5" />
      <polyline fill="none" stroke="#0f172a" strokeWidth="2" strokeLinejoin="round" points={pts.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")} />
      {pts.map((p, i) => <circle key={p.id} cx={x(i)} cy={y(p.value)} r="3" fill="#0f172a" />)}
    </svg>
  );
}

type GoalDraft = { id: string | null; student: string; area: string; text: string; baseline: string; target: string; unit: string; direction: "up" | "down"; startDate: string; targetDate: string };

export function GoalsTab({ workspace, setWorkspace, remove, makeId, today }: Props) {
  const [student, setStudent] = useState("");
  const [draft, setDraft] = useState<GoalDraft | null>(null);
  const [adding, setAdding] = useState<{ goalId: string; date: string; value: string; note: string } | null>(null);
  const goals = useMemo(() => workspace.goals.filter((g) => !student || g.student === student), [workspace.goals, student]);
  const names = workspace.students.map((s) => s.name);
  const blank = (): GoalDraft => ({ id: null, student, area: "Reading", text: "", baseline: "0", target: "", unit: "%", direction: "up", startDate: today, targetDate: "" });

  function saveGoal(e: FormEvent) {
    e.preventDefault();
    if (!draft || !draft.student || !draft.text.trim()) return;
    const base = num(draft.baseline), target = num(draft.target);
    if (base === null || target === null) return;
    const fields = { student: draft.student, area: draft.area, text: draft.text.trim(), baseline: base, target, unit: draft.unit.trim(), direction: (target < base ? "down" : "up") as "up" | "down", startDate: draft.startDate, targetDate: draft.targetDate };
    setWorkspace((p) => ({ ...p, goals: draft.id ? p.goals.map((g) => (g.id === draft.id ? { ...g, ...fields } : g)) : [...p.goals, { id: makeId(), ...fields, points: [] }] }));
    setDraft(null);
  }
  function savePoint(e: FormEvent) {
    e.preventDefault();
    const value = adding ? num(adding.value) : null;
    if (!adding || value === null) return;
    setWorkspace((p) => ({ ...p, goals: p.goals.map((g) => (g.id === adding.goalId ? withPoint(g, { id: makeId(), date: adding.date || today, value, note: adding.note.trim() }) : g)) }));
    setAdding(null);
  }
  const editing = adding ? workspace.goals.find((g) => g.id === adding.goalId) : undefined;

  return (
    <>
      <Card title="Goals & progress monitoring" right={<PrimaryButton onClick={() => setDraft(blank())}><Plus className="h-4 w-4" /> New goal</PrimaryButton>}>
        <p className="text-sm text-slate-600">Track each IEP goal over time. Add a data point whenever you check progress and the trend line shows whether the student is on track for the target date.</p>
        {names.length > 1 && <div className="mt-3"><Select aria-label="Show goals for" value={student} onChange={(e) => setStudent(e.target.value)}><option value="">All students</option>{names.map((n) => <option key={n}>{n}</option>)}</Select></div>}
      </Card>
      {goals.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {goals.map((g) => {
            const pr = goalProgress(g, today);
            const st = STATUS[pr.status];
            return (
              <Card key={g.id} title={`${g.student} · ${g.area}`} right={<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>{st.word}</span>}>
                <p className="break-words text-sm font-medium text-slate-900">{g.text}</p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div><span className="text-3xl font-bold">{pr.latest ?? "—"}</span> <span className="text-sm text-slate-500">{g.unit} · goal {g.target}{g.unit && !/^[%]/.test(g.unit) ? "" : ""}</span></div>
                  <span className="text-sm font-semibold text-slate-600">{pr.percent}%</span>
                </div>
                <div className="mt-2"><Bar percent={pr.percent} label={`${g.student} progress on goal`} tone={pr.status === "behind" ? "bg-red-500" : pr.status === "close" ? "bg-amber-500" : "bg-teal-600"} /></div>
                <Spark goal={g} />
                <div className="mt-2 text-xs text-slate-500">Started at {g.baseline}{g.targetDate ? ` · target ${friendlyDate(g.targetDate, today)}` : ""}{g.points.length ? ` · last checked ${friendlyDate(g.points[g.points.length - 1].date, today)}` : ""}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PrimaryButton onClick={() => setAdding({ goalId: g.id, date: today, value: "", note: "" })}><Plus className="h-4 w-4" /> Add data</PrimaryButton>
                  <GhostButton onClick={() => setDraft({ id: g.id, student: g.student, area: g.area, text: g.text, baseline: String(g.baseline), target: String(g.target), unit: g.unit, direction: g.direction, startDate: g.startDate, targetDate: g.targetDate })}><Pencil className="h-4 w-4" /> Edit</GhostButton>
                </div>
              </Card>
            );
          })}
        </div>
      ) : <Empty>{names.length ? "No goals yet. Tap New goal to start tracking one." : "Add your students on the Caseload tab first, then add their goals here."}</Empty>}

      {draft && (
        <HubModal title={draft.id ? "Edit goal" : "New goal"} onClose={() => setDraft(null)}
          footer={<div className="flex flex-wrap gap-2"><PrimaryButton onClick={() => (document.getElementById("goal-form") as HTMLFormElement | null)?.requestSubmit()}>Save goal</PrimaryButton><GhostButton onClick={() => setDraft(null)}>Cancel</GhostButton>{draft.id && <button type="button" onClick={() => { remove("goals", draft.id!); setDraft(null); }} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete</button>}</div>}>
          <form id="goal-form" onSubmit={saveGoal} className="grid gap-3 sm:grid-cols-2">
            <Labeled label="Student"><Select value={draft.student} onChange={(e) => setDraft({ ...draft, student: e.target.value })} required><option value="">Choose student</option>{[...new Set([...names, draft.student].filter(Boolean))].map((n) => <option key={n}>{n}</option>)}</Select></Labeled>
            <Labeled label="Area"><Select value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })}>{GOAL_AREAS.map((a) => <option key={a}>{a}</option>)}</Select></Labeled>
            <Labeled label="Goal" className="sm:col-span-2"><TextArea value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder="By June, Jordan will read 60 words per minute…" required maxLength={600} /></Labeled>
            <Labeled label="Starting point"><Field type="number" inputMode="decimal" step="any" value={draft.baseline} onChange={(e) => setDraft({ ...draft, baseline: e.target.value })} required /></Labeled>
            <Labeled label="Target"><Field type="number" inputMode="decimal" step="any" value={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.value })} required /></Labeled>
            <Labeled label="Measured in" className="sm:col-span-2"><Field value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="%, words per minute, out of 4 trials…" maxLength={30} /></Labeled>
            <Labeled label="Start date"><Field type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /></Labeled>
            <Labeled label="Target date"><Field type="date" value={draft.targetDate} onChange={(e) => setDraft({ ...draft, targetDate: e.target.value })} /></Labeled>
            <p className="text-xs text-slate-500 sm:col-span-2">Lower is better? Set the target below the starting point (like 10 outbursts a week down to 2) and it is tracked that way.</p>
          </form>
        </HubModal>
      )}

      {adding && editing && (
        <HubModal title={`Add data · ${editing.student}`} onClose={() => setAdding(null)} size="sm"
          footer={<div className="flex gap-2"><PrimaryButton onClick={() => (document.getElementById("point-form") as HTMLFormElement | null)?.requestSubmit()} disabled={num(adding.value) === null}>Save</PrimaryButton><GhostButton onClick={() => setAdding(null)}>Cancel</GhostButton></div>}>
          <form id="point-form" onSubmit={savePoint} className="grid gap-3">
            <p className="text-sm text-slate-600">{editing.text}</p>
            <Labeled label={`Score${editing.unit ? ` (${editing.unit})` : ""}`}><Field data-autofocus type="number" inputMode="decimal" step="any" value={adding.value} onChange={(e) => setAdding({ ...adding, value: e.target.value })} required /></Labeled>
            <Labeled label="Date"><Field type="date" value={adding.date} onChange={(e) => setAdding({ ...adding, date: e.target.value })} /></Labeled>
            <Labeled label="Note (optional)"><Field value={adding.note} onChange={(e) => setAdding({ ...adding, note: e.target.value })} maxLength={200} /></Labeled>
            {editing.points.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Earlier data</div>
                <ul className="space-y-1">{[...editing.points].reverse().slice(0, 8).map((p) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-1 text-sm"><span className="flex-1">{friendlyDate(p.date, today)} · <strong>{p.value}</strong>{p.note ? ` · ${p.note}` : ""}</span>
                    <button type="button" aria-label={`Delete the ${p.date} score`} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setWorkspace((w) => ({ ...w, goals: w.goals.map((g) => (g.id === editing.id ? { ...g, points: g.points.filter((x) => x.id !== p.id) } : g)) }))}><Trash2 className="h-4 w-4" /></button></li>
                ))}</ul>
              </div>
            )}
          </form>
        </HubModal>
      )}
    </>
  );
}

type LogDraft = { student: string; date: string; kind: string; minutes: string; note: string };
type PlanDraft = { id: string | null; student: string; kind: string; minutes: string };

export function MinutesTab({ workspace, setWorkspace, remove, makeId, today }: Props) {
  const [log, setLog] = useState<LogDraft | null>(null);
  const [plan, setPlan] = useState<PlanDraft | null>(null);
  const names = workspace.students.map((s) => s.name);
  const plans = [...workspace.services].sort((a, b) => a.student.localeCompare(b.student) || a.kind.localeCompare(b.kind));
  const recent = [...workspace.serviceLogs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);

  function quick(p: ServicePlan, minutes: number) {
    setWorkspace((w) => ({ ...w, serviceLogs: [...w.serviceLogs, { id: makeId(), student: p.student, date: today, kind: p.kind, minutes, note: "" }] }));
  }
  function saveLog(e: FormEvent) {
    e.preventDefault();
    const minutes = log ? num(log.minutes) : null;
    if (!log || !log.student || minutes === null || minutes <= 0) return;
    setWorkspace((w) => ({ ...w, serviceLogs: [...w.serviceLogs, { id: makeId(), student: log.student, date: log.date || today, kind: log.kind, minutes: Math.round(minutes), note: log.note.trim() }] }));
    setLog(null);
  }
  function savePlan(e: FormEvent) {
    e.preventDefault();
    const minutes = plan ? num(plan.minutes) : null;
    if (!plan || !plan.student || minutes === null || minutes <= 0) return;
    const fields = { student: plan.student, kind: plan.kind, minutesPerWeek: Math.round(minutes) };
    setWorkspace((w) => ({ ...w, services: plan.id ? w.services.map((s) => (s.id === plan.id ? { ...s, ...fields, since: s.since || weekStart(today) } : s)) : [...w.services.filter((s) => !(s.student === fields.student && s.kind === fields.kind)), { id: makeId(), ...fields, since: weekStart(today) }] }));
    setPlan(null);
  }

  return (
    <>
      <Card title="Service minutes" right={<PrimaryButton onClick={() => setLog({ student: "", date: today, kind: "Push-in", minutes: "", note: "" })}><Plus className="h-4 w-4" /> Log minutes</PrimaryButton>}>
        <p className="text-sm text-slate-600">Week of {friendlyDate(weekStart(today), today)}. Set the minutes each student's IEP requires, log what you deliver, and see what is left this week and what is owed from the weeks before.</p>
        <div className="mt-3"><GhostButton onClick={() => setPlan({ id: null, student: "", kind: "Push-in", minutes: "" })}><Plus className="h-4 w-4" /> Set required minutes</GhostButton></div>
      </Card>

      {plans.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {plans.map((p) => {
            const s = serviceStatus(p, workspace.serviceLogs, today);
            return (
              <Card key={p.id} title={`${p.student} · ${p.kind}`} right={<button type="button" aria-label={`Change minutes for ${p.student}`} className="-m-2 inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" onClick={() => setPlan({ id: p.id, student: p.student, kind: p.kind, minutes: String(p.minutesPerWeek) })}><Pencil className="h-4 w-4" /></button>}>
                <div className="flex items-end justify-between gap-3"><div><span className="text-3xl font-bold">{s.thisWeek}</span> <span className="text-sm text-slate-500">of {s.required} min this week</span></div><span className="text-sm font-semibold text-slate-600">{s.remaining ? `${s.remaining} left` : "Done"}</span></div>
                <div className="mt-2"><Bar percent={s.percent} label={`${p.student} minutes this week`} tone={s.remaining ? "bg-teal-600" : "bg-emerald-600"} /></div>
                {s.owed > 0 && <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="minutes-owed">{s.owed} min short over the last 4 weeks (make-up owed)</div>}
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Log minutes for ${p.student} today`}>
                  {[15, 30, 45].map((m) => <button key={m} type="button" className={chipCls(false)} onClick={() => quick(p, m)}>+{m} min</button>)}
                </div>
              </Card>
            );
          })}
        </div>
      ) : <Empty>No required minutes set yet. Tap “Set required minutes” to add a student's push-in or pull-out time.</Empty>}

      <Card title="Recent minutes">
        {recent.length ? <ul className="space-y-2">{recent.map((l) => (
          <li key={l.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm">
            <div className="min-w-0 flex-1"><div className="font-medium">{l.student} · {l.kind}</div><div className="text-xs text-slate-500">{friendlyDate(l.date, today)}{l.note ? ` · ${l.note}` : ""}</div></div>
            <strong className="shrink-0">{l.minutes} min</strong>
            <button type="button" aria-label={`Delete ${l.minutes} minutes for ${l.student}`} className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("serviceLogs", l.id)}><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}</ul> : <Empty>Minutes you log show up here.</Empty>}
      </Card>

      {log && (
        <HubModal title="Log minutes" size="sm" onClose={() => setLog(null)}
          footer={<div className="flex gap-2"><PrimaryButton onClick={() => (document.getElementById("log-form") as HTMLFormElement | null)?.requestSubmit()}>Save</PrimaryButton><GhostButton onClick={() => setLog(null)}>Cancel</GhostButton></div>}>
          <form id="log-form" onSubmit={saveLog} className="grid gap-3">
            <Labeled label="Student"><Select value={log.student} onChange={(e) => setLog({ ...log, student: e.target.value })} required><option value="">Choose student</option>{names.map((n) => <option key={n}>{n}</option>)}</Select></Labeled>
            <Labeled label="Kind"><Select value={log.kind} onChange={(e) => setLog({ ...log, kind: e.target.value })}>{SERVICE_KINDS.map((k) => <option key={k}>{k}</option>)}</Select></Labeled>
            <Labeled label="Minutes"><Field data-autofocus type="number" inputMode="numeric" min="1" max="600" value={log.minutes} onChange={(e) => setLog({ ...log, minutes: e.target.value })} required /></Labeled>
            <div className="flex flex-wrap gap-2">{[15, 20, 30, 45, 60].map((m) => <button key={m} type="button" className={chipCls(log.minutes === String(m))} onClick={() => setLog({ ...log, minutes: String(m) })}>{m}</button>)}</div>
            <Labeled label="Date"><Field type="date" value={log.date} onChange={(e) => setLog({ ...log, date: e.target.value })} /></Labeled>
            <Labeled label="Note (optional)"><Field value={log.note} onChange={(e) => setLog({ ...log, note: e.target.value })} maxLength={200} /></Labeled>
          </form>
        </HubModal>
      )}

      {plan && (
        <HubModal title={plan.id ? "Change required minutes" : "Required minutes"} size="sm" onClose={() => setPlan(null)}
          footer={<div className="flex flex-wrap gap-2"><PrimaryButton onClick={() => (document.getElementById("plan-form") as HTMLFormElement | null)?.requestSubmit()}>Save</PrimaryButton><GhostButton onClick={() => setPlan(null)}>Cancel</GhostButton>{plan.id && <button type="button" onClick={() => { remove("services", plan.id!); setPlan(null); }} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Remove</button>}</div>}>
          <form id="plan-form" onSubmit={savePlan} className="grid gap-3">
            <Labeled label="Student"><Select value={plan.student} onChange={(e) => setPlan({ ...plan, student: e.target.value })} required><option value="">Choose student</option>{[...new Set([...names, plan.student].filter(Boolean))].map((n) => <option key={n}>{n}</option>)}</Select></Labeled>
            <Labeled label="Kind"><Select value={plan.kind} onChange={(e) => setPlan({ ...plan, kind: e.target.value })}>{SERVICE_KINDS.map((k) => <option key={k}>{k}</option>)}</Select></Labeled>
            <Labeled label="Minutes each week"><Field data-autofocus type="number" inputMode="numeric" min="1" max="3000" value={plan.minutes} onChange={(e) => setPlan({ ...plan, minutes: e.target.value })} required /></Labeled>
          </form>
        </HubModal>
      )}
    </>
  );
}
