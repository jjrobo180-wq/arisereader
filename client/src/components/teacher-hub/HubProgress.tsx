// Teacher Hub: IEP goal progress monitoring and service-minute tracking (push-in, pull-out and the rest).
// The rules are in shared/hubProgress.ts.
import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Clock, Pencil, Plus, Trash2, Users } from "lucide-react";
import { DAY_NAMES, GOAL_AREAS, SERVICE_KINDS, WEEK_DAYS, cleanDayGuide, goalProgress, guideDays, planFields, planText, serviceStatus, sessionLog, weekStart, withPoint, type DayStatus, type GoalStatus, type WeekDay } from "@shared/hubProgress";
import { friendlyDate } from "@shared/hubDates";
import type { Goal, ServicePlan, Workspace } from "@shared/teacherHub";
import { Card, Empty, Field, GhostButton, Labeled, PrimaryButton, Select, TextArea } from "./ui";
import { HubModal } from "./HubModal";
import { BlocksModal, MinutesWeekView, type LogStart } from "./HubMinutesWeek";
import { NOT_MET_REASONS, blockLogs, notMetLogs, sessionBlockName, setPlanBlock, updateLog, type MinutesItem } from "@shared/hubMinutesWeek";
import { blockName, schoolBlocks } from "@shared/hubBlocks";
import { BulkMinutesModal, MinutesPick, type BulkStart } from "./HubMinutesBulk";
import { QUICK_MINUTES, savedText, schoolDay, withPlans, type BulkResult } from "@shared/hubMinutesBulk";

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

/** A session being logged, or (with an id) a logged one being changed. */
type LogDraft = {
  id?: string | null; student: string; date: string; kind: string; minutes: string;
  /** A note about the session, or why it did not happen. */
  note: string;
  /** The block it is in ("" for its plan's block). */
  block: string;
  /** The session did not happen. */
  notMet: boolean;
  /** "Did not meet" for this student only, or for everyone still waiting in the block or on the day. */
  scope: "one" | "block" | "day";
  others?: LogStart["others"];
};
/** The two ways to look at the minutes: each day sectioned off by block, or one card per student. */
type MinutesLook = "week" | "students";
const readLook = (): MinutesLook => { try { return localStorage.getItem("arise-hub-minutes-look") === "students" ? "students" : "week"; } catch { return "week"; } };
/** A plan being set: counted by the day (a day guide) or by the week. */
type PlanDraft = { id: string | null; student: string; kind: string; mode: "days" | "week"; perWeek: string; days: WeekDay[]; perDay: string; /** The block this service is in ("" for none). */ block: string };

const SCHOOL_DAYS: WeekDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_LOOK: Record<DayStatus["state"], string> = {
  "not met": "border-slate-200 bg-slate-100 text-slate-600",
  done: "border-emerald-200 bg-emerald-50 text-emerald-900",
  "made up": "border-emerald-200 bg-emerald-50 text-emerald-900",
  short: "border-amber-200 bg-amber-50 text-amber-900",
  today: "border-teal-500 bg-white text-slate-900",
  ahead: "border-slate-200 bg-white text-slate-600",
  extra: "border-sky-200 bg-sky-100 text-sky-800",
};
const dayWords = (d: DayStatus) => (d.state === "not met" ? "did not meet" : d.state === "extra" ? `+${d.done} extra` : d.state === "done" ? `${d.done} done` : d.state === "made up" ? `${d.done} of ${d.planned}, made up` : d.state === "short" ? `${d.done} of ${d.planned}` : d.state === "today" ? `${d.done ? `${d.done} of ` : ""}${d.planned} today` : `${d.planned}`);

export function MinutesTab({ workspace, setWorkspace, remove, makeId, today, token = null }: Props & { /** For reading a screenshot into the students to tick. */ token?: string | null }) {
  const [log, setLog] = useState<LogDraft | null>(null);
  /** The pop-up for several students at once: minutes for one day, or the minutes they need every week. */
  const [bulk, setBulk] = useState<BulkStart | null>(null);
  /** What the last save for several students did, shown for a few seconds. */
  const [saved, setSaved] = useState("");
  useEffect(() => { if (!saved) return; const timer = setTimeout(() => setSaved(""), 7000); return () => clearTimeout(timer); }, [saved]);
  const [plan, setPlan] = useState<PlanDraft | null>(null);
  const [look, setLookState] = useState<MinutesLook>(readLook);
  const [settingBlocks, setSettingBlocks] = useState(false);
  const blocks = useMemo(() => schoolBlocks(workspace), [workspace.minuteBlocks]);
  const setLook = (v: MinutesLook) => { setLookState(v); try { localStorage.setItem("arise-hub-minutes-look", v); } catch { /* the choice just isn't remembered */ } };
  const names = workspace.students.map((s) => s.name);
  const plans = [...workspace.services].sort((a, b) => a.student.localeCompare(b.student) || a.kind.localeCompare(b.kind));
  const recent = [...workspace.serviceLogs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);

  /** Logs minutes for today with one tap. The session goes in the plan's block. */
  function quick(p: ServicePlan, minutes: number) {
    const session = sessionLog({ student: p.student, kind: p.kind, date: today, minutes });
    if (session) setWorkspace((w) => ({ ...w, serviceLogs: [...w.serviceLogs, { id: makeId(), ...session }] }));
  }
  /** Opens the log pop-up for one plan, with its usual minutes filled in. */
  function logFor(p: ServicePlan) {
    const guide = cleanDayGuide(p.days);
    const usual = guideDays(p).length ? String(Object.values(guide)[0] ?? "") : "";
    setLog({ ...newLog(), student: p.student, kind: p.kind, minutes: usual });
  }
  const logReady = log && !log.notMet ? sessionLog({ ...log, date: log.date || today }) : null;
  /** "Did not meet": a record for the student in the pop-up, or for everyone still waiting in the block or on the day that was tapped. */
  const notMet = !log || !log.notMet ? [] : notMetLogs(
    !log.id && log.others && log.scope !== "one" ? log.others[log.scope] : [{ student: log.student, kind: log.kind, date: log.date || today, block: log.block, state: "today" }],
    log.note,
  );
  const canSaveLog = !!log && (log.notMet ? notMet.length > 0 : !!logReady);
  function saveLog(e: FormEvent) {
    e.preventDefault();
    if (!log || !canSaveLog) return;
    const id = log.id;
    if (log.notMet) {
      // Nobody is marked twice for the same day.
      setWorkspace((w) => ({ ...w, serviceLogs: id ? updateLog(w.serviceLogs, id, notMet[0]) : [...w.serviceLogs, ...notMet.filter((made) => !w.serviceLogs.some((l) => l.notMet && l.student === made.student && l.kind === made.kind && l.date === made.date)).map((made) => ({ id: makeId(), ...made }))] }));
    } else if (logReady) {
      const session = { ...logReady, ...(log.block ? { block: log.block } : {}) };
      setWorkspace((w) => ({ ...w, serviceLogs: id ? updateLog(w.serviceLogs, id, session) : [...w.serviceLogs, { id: makeId(), ...session }] }));
    }
    setLog(null);
  }
  /** From the block grid: one tap logs the block's students as given, each with the usual time. */
  function logItems(items: MinutesItem[]) {
    const sessions = blockLogs(items);
    if (sessions.length) setWorkspace((w) => ({ ...w, serviceLogs: [...w.serviceLogs, ...sessions.map((session) => ({ id: makeId(), ...session }))] }));
  }
  /** From the block grid: the log pop-up for the student that was tapped, to type other minutes or to say they did not meet. */
  function logFrom(from: LogStart) {
    setLog({ ...newLog(), date: from.date, block: from.block || "", student: from.student || "", kind: from.kind || "Push-in", minutes: from.minutes ? String(from.minutes) : "", notMet: !!from.notMet, others: from.others });
  }
  /** From the pop-up for several students: a session for each one ticked, or each one's required minutes. */
  function saveBulk(result: BulkResult) {
    setWorkspace((w) => ({
      ...w,
      serviceLogs: result.logs.length ? [...w.serviceLogs, ...result.logs.map((session) => ({ id: makeId(), ...session }))] : w.serviceLogs,
      services: result.plans.length ? withPlans(w.services, result.plans, makeId, today) : w.services,
    }));
    setSaved(savedText(result));
    setBulk(null);
  }
  /** A logged session opened to be changed. */
  function editLog(logId: string) {
    const l = workspace.serviceLogs.find((x) => x.id === logId);
    if (l) setLog({ ...newLog(), id: l.id, student: l.student, date: l.date, kind: l.kind, minutes: l.notMet ? "" : String(l.minutes), note: l.note || "", block: l.block && blocks.some((b) => b.id === l.block) ? l.block : "", notMet: !!l.notMet });
  }
  const planReady = plan && !(plan.mode === "days" && !plan.days.length) ? planFields({ student: plan.student, kind: plan.kind, perWeek: plan.perWeek, days: plan.mode === "days" ? plan.days : [], perDay: plan.perDay }) : null;
  function editPlan(p: ServicePlan) {
    const guide = cleanDayGuide(p.days), days = guideDays(p);
    setPlan({ id: p.id, student: p.student, kind: p.kind, mode: days.length ? "days" : "week", perWeek: String(p.minutesPerWeek || ""), days, perDay: days.length ? String(guide[days[0]]) : "", block: p.block && blocks.some((b) => b.id === p.block) ? p.block : "" });
  }
  function savePlan(e: FormEvent) {
    e.preventDefault();
    if (!plan || !planReady) return;
    const fields = { ...planReady, ...(plan.block ? { block: plan.block } : {}) };
    // Written out whole, so a plan changed from a day guide to a weekly number does not keep its old days.
    setWorkspace((w) => ({
      ...w,
      services: plan.id
        ? w.services.map((s) => (s.id === plan.id ? { id: s.id, ...fields, since: s.since || weekStart(today) } : s))
        : [...w.services.filter((s) => !(s.student === fields.student && s.kind === fields.kind)), { id: makeId(), ...fields, since: weekStart(today) }],
    }));
    setPlan(null);
  }
  const newPlan = (): PlanDraft => ({ id: null, student: "", kind: "Push-in", mode: "days", perWeek: "", days: [], perDay: "", block: "" });
  const newLog = (): LogDraft => ({ student: "", date: today, kind: "Push-in", minutes: "", note: "", block: "", notMet: false, scope: "one" });

  return (
    <>
      <Card title="Service minutes" right={<PrimaryButton onClick={() => setBulk({ mode: "log", date: today, block: "" })}><Plus className="h-4 w-4" /> Log minutes</PrimaryButton>}>
        <p className="text-sm text-slate-600">{look === "students" ? `Week of ${friendlyDate(weekStart(today), today)}. ` : ""}Set the minutes each student's IEP requires and the block they are in, then log what you deliver. A session on any other day counts toward the week and is never expected again.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <GhostButton onClick={() => setPlan(newPlan())}><Plus className="h-4 w-4" /> Set required minutes</GhostButton>
          <span data-testid="minutes-several"><GhostButton onClick={() => setBulk({ mode: "plan", date: today, block: "" })}><Users className="h-4 w-4" /> Add several students</GhostButton></span>
          <div role="tablist" aria-label="How to look at the minutes" className="ml-auto flex gap-1 rounded-2xl bg-slate-100 p-1" data-testid="minutes-look">
            {([["week", "By block"], ["students", "By student"]] as const).map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={look === key} onClick={() => setLook(key)} className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${look === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>{label}</button>
            ))}
          </div>
        </div>
        {saved && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900" role="status" data-testid="minutes-saved">{saved}</p>}
      </Card>

      {look === "week" && <MinutesWeekView workspace={workspace} today={today} onLog={logItems} onEdit={editLog} onAdd={(from) => (from.student ? logFrom(from) : setBulk({ mode: "plan", date: from.date, block: from.block || "", days: schoolDay(from.date) }))} onBlocks={() => setSettingBlocks(true)} onMove={(planId, block) => setWorkspace((w) => ({ ...w, services: setPlanBlock(w.services, planId, block) }))} />}
      {look === "week" && !plans.length && <Empty>No required minutes set yet. Tap “Set required minutes” to add a student's push-in or pull-out time and block, or “Add several students” to set a whole block at once (you can tick them from a screenshot). They show up in that block on the days they are due.</Empty>}
      {bulk && <BulkMinutesModal workspace={workspace} today={today} token={token} start={bulk} onSave={saveBulk} onClose={() => setBulk(null)} />}
      {settingBlocks && <BlocksModal blocks={blocks} makeId={makeId} onClose={() => setSettingBlocks(false)} onSave={(next) => { setWorkspace((w) => ({ ...w, minuteBlocks: next })); setSettingBlocks(false); }} />}

      {look === "students" && (plans.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {plans.map((p) => {
            const s = serviceStatus(p, workspace.serviceLogs, today);
            return (
              <Card key={p.id} title={`${p.student} · ${p.kind}`} right={<button type="button" aria-label={`Change minutes for ${p.student}`} className="-m-2 inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" onClick={() => editPlan(p)}><Pencil className="h-4 w-4" /></button>}>
                <p className="mb-2 text-xs font-medium text-slate-500" data-testid="plan-text">{planText(p, blockName(blocks, p.block))}</p>
                <div className="flex items-end justify-between gap-3"><div><span className="text-3xl font-bold">{s.thisWeek}</span> <span className="text-sm text-slate-500">of {s.required} min this week</span></div><span className="text-sm font-semibold text-slate-600">{s.remaining ? `${s.remaining} left` : "Done"}</span></div>
                <div className="mt-2"><Bar percent={s.percent} label={`${p.student} minutes this week`} tone={s.remaining ? "bg-teal-600" : "bg-emerald-600"} /></div>
                {s.days.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`${p.student}: this week day by day`} data-testid="minutes-days">
                    {s.days.map((d) => <li key={d.day} className={`rounded-lg border px-2 py-1 text-xs font-semibold ${DAY_LOOK[d.state]}`} title={DAY_NAMES[d.day]}>{d.day} <span className="font-medium">{dayWords(d)}</span></li>)}
                  </ul>
                )}
                {s.extra > 0 && <p className="mt-2 text-xs text-slate-500">{s.extra} extra min this week on a day outside the guide. It counts toward the week, and that day is not expected next week.</p>}
                {s.owed > 0 && <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="minutes-owed">{s.owed} min short over the last 4 weeks (make-up owed)</div>}
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Log minutes for ${p.student} today`}>
                  {s.plannedToday > 0 && s.days.some((d) => d.date === today && d.state === "today") && <button type="button" className={chipCls(true)} onClick={() => quick(p, s.plannedToday)} data-testid="minutes-today">+{s.plannedToday} min today</button>}
                  {QUICK_MINUTES.map((m) => <button key={m} type="button" className={chipCls(false)} onClick={() => quick(p, m)}>+{m} min</button>)}
                  <button type="button" className={chipCls(false)} onClick={() => logFor(p)} data-testid="minutes-other"><Clock className="h-4 w-4" /> Other</button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : <Empty>No required minutes set yet. Tap “Set required minutes” to add a student's push-in or pull-out time.</Empty>)}

      {look === "students" && <Card title="Recent minutes">
        {recent.length ? <ul className="space-y-2">{recent.map((l) => (
          <li key={l.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm">
            <div className="min-w-0 flex-1"><div className="font-medium">{l.student} · {l.kind}</div><div className="text-xs text-slate-500">{friendlyDate(l.date, today)}{sessionBlockName(l, workspace.services, blocks) ? ` · ${sessionBlockName(l, workspace.services, blocks)}` : ""}{l.note ? ` · ${l.note}` : ""}</div></div>
            <strong className={`shrink-0 ${l.notMet ? "text-slate-500" : ""}`}>{l.notMet ? "Did not meet" : `${l.minutes} min`}</strong>
            <button type="button" aria-label={l.notMet ? `Delete "did not meet" for ${l.student}` : `Delete ${l.minutes} minutes for ${l.student}`} className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("serviceLogs", l.id)}><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}</ul> : <Empty>Minutes you log show up here.</Empty>}
      </Card>}

      {log && (() => {
        const everyone = !log.id && log.notMet && log.scope !== "one";
        const typed = (NOT_MET_REASONS as readonly string[]).includes(log.note) ? "" : log.note;
        const inBlock = log.others?.block.length || 0, onDay = log.others?.day.length || 0;
        return (
        <HubModal title={log.id ? "Change session" : log.notMet ? "Did not meet" : "Log minutes"} size="sm" onClose={() => setLog(null)}
          footer={<div className="flex flex-wrap gap-2"><PrimaryButton onClick={() => (document.getElementById("log-form") as HTMLFormElement | null)?.requestSubmit()} disabled={!canSaveLog}>{log.notMet && notMet.length > 1 ? `Save for ${notMet.length} students` : "Save"}</PrimaryButton><GhostButton onClick={() => setLog(null)}>Cancel</GhostButton>{log.id && <button type="button" onClick={() => { remove("serviceLogs", log.id!); setLog(null); }} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-red-700 hover:bg-red-50" data-testid="log-remove"><Trash2 className="h-4 w-4" /> Remove</button>}</div>}>
          <form id="log-form" onSubmit={saveLog} className="grid gap-3" data-testid="log-form">
            <div role="tablist" aria-label="Did you meet" className="flex gap-1 rounded-2xl bg-slate-100 p-1" data-testid="log-met">
              {([[false, "Met"], [true, "Did not meet"]] as const).map(([value, label]) => (
                <button key={label} type="button" role="tab" aria-selected={log.notMet === value} onClick={() => setLog({ ...log, notMet: value })} className={`min-h-11 flex-1 rounded-xl px-2 text-sm font-semibold ${log.notMet === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>{label}</button>
              ))}
            </div>
            {log.notMet && !log.id && (inBlock > 1 || onDay > 1) && (
              <div>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Who</span>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Who did not meet" data-testid="log-who">
                  <button type="button" aria-pressed={log.scope === "one"} className={chipCls(log.scope === "one")} onClick={() => setLog({ ...log, scope: "one" })}>Just {log.student}</button>
                  {inBlock > 1 && <button type="button" aria-pressed={log.scope === "block"} className={chipCls(log.scope === "block")} onClick={() => setLog({ ...log, scope: "block" })}>Everyone in {blockName(blocks, log.block) || "this block"} ({inBlock})</button>}
                  {onDay > inBlock && <button type="button" aria-pressed={log.scope === "day"} className={chipCls(log.scope === "day")} onClick={() => setLog({ ...log, scope: "day" })}>Everyone this day ({onDay})</button>}
                </div>
              </div>
            )}
            {!everyone && <Labeled label="Student"><Select value={log.student} onChange={(e) => setLog({ ...log, student: e.target.value })} required aria-label="Student"><option value="">Choose student</option>{[...new Set([...names, log.student].filter(Boolean))].map((n) => <option key={n}>{n}</option>)}</Select></Labeled>}
            {!everyone && <Labeled label="Kind"><Select value={log.kind} onChange={(e) => setLog({ ...log, kind: e.target.value })} aria-label="Kind">{SERVICE_KINDS.map((k) => <option key={k}>{k}</option>)}</Select></Labeled>}
            {!everyone && <Labeled label="Block"><Select value={log.block} onChange={(e) => setLog({ ...log, block: e.target.value })} aria-label="Block"><option value="">{log.id ? "No block of its own" : "The student's usual block"}</option>{blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Labeled>}
            {log.notMet ? (
              <div>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Why</span>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Why" data-testid="log-why">
                  {NOT_MET_REASONS.map((reason) => <button key={reason} type="button" aria-pressed={log.note === reason} className={chipCls(log.note === reason)} onClick={() => setLog({ ...log, note: log.note === reason ? "" : reason })}>{reason}</button>)}
                </div>
                <div className="mt-2"><Field value={typed} onChange={(e) => setLog({ ...log, note: e.target.value })} maxLength={200} placeholder="Another reason" aria-label="Another reason" /></div>
              </div>
            ) : <MinutesPick value={log.minutes} onChange={(minutes) => setLog({ ...log, minutes })} />}
            {!everyone && <Labeled label="Date"><Field type="date" value={log.date} onChange={(e) => setLog({ ...log, date: e.target.value })} aria-label="Date" /></Labeled>}
            {!log.notMet && <Labeled label="Note (optional)"><Field value={log.note} onChange={(e) => setLog({ ...log, note: e.target.value })} maxLength={200} aria-label="Note" /></Labeled>}
            {log.notMet && <p className="text-xs text-slate-500">No minutes are counted. The day shows “Did not meet” with the reason, and is not asked for again.</p>}
          </form>
        </HubModal>
        );
      })()}

      {plan && (
        <HubModal title={plan.id ? "Change required minutes" : "Required minutes"} size="sm" onClose={() => setPlan(null)}
          footer={<div className="flex flex-wrap gap-2"><PrimaryButton onClick={() => (document.getElementById("plan-form") as HTMLFormElement | null)?.requestSubmit()} disabled={!planReady}>Save</PrimaryButton><GhostButton onClick={() => setPlan(null)}>Cancel</GhostButton>{plan.id && <button type="button" onClick={() => { remove("services", plan.id!); setPlan(null); }} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Remove</button>}</div>}>
          <form id="plan-form" onSubmit={savePlan} className="grid gap-3" data-testid="plan-form">
            <Labeled label="Student"><Select value={plan.student} onChange={(e) => setPlan({ ...plan, student: e.target.value })} required aria-label="Student"><option value="">Choose student</option>{[...new Set([...names, plan.student].filter(Boolean))].map((n) => <option key={n}>{n}</option>)}</Select></Labeled>
            <Labeled label="Kind"><Select value={plan.kind} onChange={(e) => setPlan({ ...plan, kind: e.target.value })} aria-label="Kind">{SERVICE_KINDS.map((k) => <option key={k}>{k}</option>)}</Select></Labeled>
            <Labeled label="Block"><Select value={plan.block} onChange={(e) => setPlan({ ...plan, block: e.target.value })} aria-label="Block"><option value="">No block</option>{blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Labeled>
            <div role="tablist" aria-label="How the minutes are counted" className="flex gap-1 rounded-2xl bg-slate-100 p-1" data-testid="plan-mode">
              {([["days", "By the day"], ["week", "By the week"]] as const).map(([mode, label]) => (
                <button key={mode} type="button" role="tab" aria-selected={plan.mode === mode} onClick={() => setPlan({ ...plan, mode })} className={`min-h-11 flex-1 rounded-xl px-2 text-sm font-semibold ${plan.mode === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>{label}</button>
              ))}
            </div>
            {plan.mode === "days" ? (
              <>
                <div>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Days</span>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Days">
                    {SCHOOL_DAYS.map((d) => { const on = plan.days.includes(d); return <button key={d} type="button" aria-pressed={on} aria-label={DAY_NAMES[d]} className={chipCls(on)} onClick={() => setPlan({ ...plan, days: on ? plan.days.filter((x) => x !== d) : WEEK_DAYS.filter((x) => x === d || plan.days.includes(x)) })}>{d}</button>; })}
                  </div>
                </div>
                <Labeled label="Minutes on each of those days"><Field type="number" inputMode="numeric" min="1" max="600" value={plan.perDay} onChange={(e) => setPlan({ ...plan, perDay: e.target.value })} aria-label="Minutes each day" /></Labeled>
                <p className="-mt-1 text-xs text-slate-500" data-testid="plan-summary">{planReady?.days ? `${planText(planReady, blockName(blocks, plan.block))}. That is ${planReady.minutesPerWeek} min a week. ` : "Pick the days, then type the minutes. "}A session on any other day still counts, and is never expected.</p>
              </>
            ) : (
              <Labeled label="Minutes each week"><Field data-autofocus type="number" inputMode="numeric" min="1" max="3000" value={plan.perWeek} onChange={(e) => setPlan({ ...plan, perWeek: e.target.value })} aria-label="Minutes each week" /></Labeled>
            )}
          </form>
        </HubModal>
      )}
    </>
  );
}
