// Fitness apps: a workout builder with a guided player, interval timer, run log, strength log,
// stretching and yoga flows, Couch to 5K, 30-day challenges, a scoreboard, PE station rotations,
// a step challenge and a pace calculator.
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Check, Pencil, Play, Plus, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { askAppAi } from "@/lib/cloudDocs";
import { LogTracker, type Entry, type TrackerConfig } from "../LogTracker";
import { SequencePlayer, type Step } from "../Sequence";
import { Btn, Card, Chart, Empty, Field, FullScreen, Modal, NumIn, Stat, Tabs, addDays, beep, daysBetween, fmtDay, fmtDuration, fmtNum, inputCls, today, uid, usePro, useTick, useWakeLock, chime } from "../kit";

const ORANGE = "#ea580c";

// ─── Workout builder ───
type Move = { name: string; kind: "reps" | "time"; sets: number; reps: number; sec: number; rest: number; tip?: string };
type Routine = { id: string; name: string; moves: Move[]; builtIn?: boolean };
const mv = (name: string, kind: "reps" | "time", sets: number, n: number, rest = 30, tip = ""): Move => ({ name, kind, sets, reps: kind === "reps" ? n : 0, sec: kind === "time" ? n : 0, rest, tip });
const BUILT_IN: Routine[] = [
  { id: "b-7min", name: "7-Minute Workout", builtIn: true, moves: ["Jumping jacks", "Wall sit", "Push-ups", "Crunches", "Step-ups on a chair", "Squats", "Triceps dips on a chair", "Plank", "High knees", "Lunges", "Push-up and rotation", "Side plank"].map((n) => mv(n, "time", 1, 30, 10)) },
  { id: "b-full", name: "Beginner full body", builtIn: true, moves: [mv("Bodyweight squats", "reps", 3, 12, 45, "Sit back like into a chair; knees track over toes."), mv("Knee push-ups", "reps", 3, 10, 45, "Straight line from knees to head."), mv("Glute bridges", "reps", 3, 15, 30, "Squeeze at the top for a second."), mv("Plank", "time", 3, 30, 30, "Hips level, don't let them sag."), mv("Reverse lunges", "reps", 2, 10, 45)] },
  { id: "b-core", name: "10-minute core", builtIn: true, moves: [mv("Dead bugs", "time", 2, 40, 15), mv("Bicycle crunches", "time", 2, 40, 15), mv("Side plank (left)", "time", 2, 30, 10), mv("Side plank (right)", "time", 2, 30, 10), mv("Hollow hold", "time", 2, 25, 20)] },
  { id: "b-legs", name: "Leg day (no equipment)", builtIn: true, moves: [mv("Squats", "reps", 4, 15, 45), mv("Walking lunges", "reps", 3, 20, 45), mv("Single-leg glute bridge", "reps", 3, 10, 30), mv("Calf raises", "reps", 3, 20, 30), mv("Wall sit", "time", 2, 45, 45)] },
  { id: "b-upper", name: "Upper body (dumbbells)", builtIn: true, moves: [mv("Push-ups", "reps", 3, 10, 60), mv("Bent-over rows", "reps", 3, 12, 60), mv("Shoulder press", "reps", 3, 10, 60), mv("Biceps curls", "reps", 3, 12, 45), mv("Triceps extensions", "reps", 3, 12, 45)] },
];
const routineSteps = (r: Routine): Step[] => {
  const out: Step[] = [{ label: "Get ready", sec: 10, kind: "prep", say: `Get ready. First: ${r.moves[0]?.name}` }];
  r.moves.forEach((m, mi) => { for (let s = 1; s <= m.sets; s++) {
    out.push({ label: m.kind === "reps" ? `${m.reps} × ${m.name}` : m.name, sec: m.kind === "reps" ? Math.max(20, m.reps * 3 + 5) : m.sec, kind: "work", note: `${m.sets > 1 ? `Set ${s} of ${m.sets}. ` : ""}${m.tip || (m.kind === "reps" ? "Tap next when you finish." : "")}`, say: `${m.kind === "reps" ? `${m.reps} ${m.name}` : m.name}${m.sets > 1 ? `, set ${s}` : ""}` });
    const last = mi === r.moves.length - 1 && s === m.sets;
    if (!last && m.rest > 0) out.push({ label: "Rest", sec: m.rest, kind: "rest", say: "Rest", note: s === m.sets ? `Next: ${r.moves[mi + 1]?.name}` : undefined });
  } });
  return out;
};
function Workouts() {
  const { token } = useAuth();
  const { data, setData } = usePro<{ routines: Routine[]; log: { id: string; date: string; name: string; sec: number }[] }>("workouts", { routines: [], log: [] });
  const [edit, setEdit] = useState<Routine | null>(null);
  const [play, setPlay] = useState<Routine | null>(null);
  const [ai, setAi] = useState(false);
  const all = [...data.routines, ...BUILT_IN];
  const week = data.log.filter((l) => l.date >= addDays(today(), -6));
  return <div className="space-y-4">
    <div className="grid grid-cols-3 gap-2"><Stat label="This week" value={week.length} sub="workouts" color={ORANGE} /><Stat label="Minutes this week" value={Math.round(week.reduce((a, l) => a + l.sec, 0) / 60)} /><Stat label="All time" value={data.log.length} /></div>
    <div className="flex flex-wrap justify-end gap-2"><Btn kind="soft" color="#7c3aed" onClick={() => setAi(true)}><Sparkles size={15} />AI plan</Btn><Btn kind="primary" color={ORANGE} onClick={() => setEdit({ id: uid(), name: "My workout", moves: [mv("Squats", "reps", 3, 12)] })}><Plus size={16} />New workout</Btn></div>
    <div className="grid gap-3 sm:grid-cols-2">{all.map((r) => { const mins = Math.round(routineSteps(r).reduce((a, s) => a + s.sec, 0) / 60); return <Card key={r.id}>
      <div className="flex items-start justify-between gap-2"><div><p className="font-black">{r.name}</p><p className="text-xs text-slate-500">{r.moves.length} exercises · about {mins} min{r.builtIn ? " · ready-made" : ""}</p></div>
        <div className="flex gap-1">{!r.builtIn && <Btn onClick={() => setEdit(r)} title="Edit"><Pencil size={14} /></Btn>}<Btn kind="primary" color={ORANGE} onClick={() => setPlay(r)} title="Start"><Play size={15} /></Btn></div></div>
      <ul className="mt-2 space-y-0.5 text-sm text-slate-600">{r.moves.slice(0, 6).map((m, i) => <li key={i}>• {m.name} <span className="text-slate-400">{m.sets > 1 ? `${m.sets}×` : ""}{m.kind === "reps" ? `${m.reps}` : `${m.sec}s`}</span></li>)}{r.moves.length > 6 && <li className="text-slate-400">+ {r.moves.length - 6} more</li>}</ul>
    </Card>; })}</div>
    {data.log.length > 0 && <Card title="Recent workouts"><ul className="divide-y divide-slate-100 text-sm">{data.log.slice(0, 10).map((l) => <li key={l.id} className="flex justify-between py-1.5"><span>{l.name}</span><span className="text-slate-500">{fmtDay(l.date)} · {fmtDuration(l.sec)}</span></li>)}</ul></Card>}
    {edit && <RoutineEditor r={edit} onClose={() => setEdit(null)} onDelete={() => { setData((d) => ({ ...d, routines: d.routines.filter((x) => x.id !== edit.id) })); setEdit(null); }} onSave={(r) => { setData((d) => ({ ...d, routines: d.routines.some((x) => x.id === r.id) ? d.routines.map((x) => (x.id === r.id ? r : x)) : [r, ...d.routines] })); setEdit(null); }} />}
    {play && <SequencePlayer title={play.name} steps={routineSteps(play)} color={ORANGE} onClose={() => setPlay(null)} onDone={(sec) => setData((d) => ({ ...d, log: [{ id: uid(), date: today(), name: play.name, sec }, ...d.log].slice(0, 500) }))} />}
    {ai && <AiWorkout token={token} onClose={() => setAi(false)} onMake={(rs) => { setData((d) => ({ ...d, routines: [...rs, ...d.routines] })); setAi(false); }} />}
  </div>;
}
function RoutineEditor({ r, onClose, onSave, onDelete }: { r: Routine; onClose: () => void; onSave: (r: Routine) => void; onDelete: () => void }) {
  const [x, setX] = useState<Routine>(r);
  const upd = (i: number, p: Partial<Move>) => setX({ ...x, moves: x.moves.map((m, j) => (j === i ? { ...m, ...p } : m)) });
  return <Modal title="Workout" wide onClose={onClose} footer={<><Btn kind="danger" onClick={onDelete}>Delete</Btn><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" color={ORANGE} disabled={!x.name.trim() || !x.moves.length} onClick={() => onSave(x)}>Save</Btn></>}>
    <Field label="Name"><input value={x.name} onChange={(e) => setX({ ...x, name: e.target.value })} className={inputCls} /></Field>
    <div className="mt-3 space-y-2">{x.moves.map((m, i) => <div key={i} className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-100 sm:grid-cols-6">
      <input value={m.name} onChange={(e) => upd(i, { name: e.target.value })} placeholder="Exercise" className={`${inputCls} col-span-2`} />
      <select value={m.kind} onChange={(e) => upd(i, { kind: e.target.value as Move["kind"], reps: m.reps || 10, sec: m.sec || 30 })} className={inputCls}><option value="reps">Reps</option><option value="time">Time</option></select>
      <label className="text-xs">Sets<NumIn value={m.sets} onChange={(n) => upd(i, { sets: Math.max(1, Number(n) || 1) })} /></label>
      {m.kind === "reps" ? <label className="text-xs">Reps<NumIn value={m.reps} onChange={(n) => upd(i, { reps: Math.max(1, Number(n) || 1) })} /></label> : <label className="text-xs">Seconds<NumIn value={m.sec} onChange={(n) => upd(i, { sec: Math.max(5, Number(n) || 5) })} /></label>}
      <label className="text-xs">Rest (s)<div className="flex gap-1"><NumIn value={m.rest} onChange={(n) => upd(i, { rest: Math.max(0, Number(n) || 0) })} /><button type="button" onClick={() => setX({ ...x, moves: x.moves.filter((_, j) => j !== i) })} aria-label="Remove" className="text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button></div></label>
    </div>)}</div>
    <Btn className="mt-2" onClick={() => setX({ ...x, moves: [...x.moves, mv("", "reps", 3, 10)] })}><Plus size={14} />Add exercise</Btn>
  </Modal>;
}
function AiWorkout({ token, onClose, onMake }: { token: string | null; onClose: () => void; onMake: (r: Routine[]) => void }) {
  const [f, setF] = useState({ days: "3", goal: "general fitness", level: "beginner", equipment: "none", minutes: "30", notes: "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const go = async () => {
    setBusy(true); setErr("");
    try {
      const r = await askAppAi<{ name: string; days: { title: string; focus: string; exercises: { name: string; sets: number; reps: string; rest: string; tip: string }[] }[] }>(token, "workout-plan", f);
      const routines = (r.days || []).map((d): Routine => ({ id: uid(), name: `${r.name || "Plan"} · ${d.title}`, moves: (d.exercises || []).map((e) => { const secs = /(\d+)\s*(s|sec|second)/i.exec(e.reps || ""); const reps = parseInt(e.reps, 10); return { name: e.name, kind: secs ? "time" : "reps", sets: Math.max(1, Number(e.sets) || 1), reps: secs ? 0 : Number.isFinite(reps) ? reps : 10, sec: secs ? Number(secs[1]) : 0, rest: parseInt(e.rest, 10) || 45, tip: e.tip }; }) }));
      if (!routines.length) throw new Error("No workouts came back. Try again.");
      onMake(routines);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return <Modal title="AI workout plan" onClose={onClose} footer={<Btn kind="primary" color="#7c3aed" disabled={busy} onClick={() => void go()}><Sparkles size={15} />{busy ? "Planning…" : "Make my plan"}</Btn>}>
    <div className="grid grid-cols-2 gap-3">
      <Field label="Days a week"><select value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} className={inputCls}>{["2", "3", "4", "5"].map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Minutes"><select value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} className={inputCls}>{["15", "20", "30", "45", "60"].map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Goal"><select value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} className={inputCls}>{["general fitness", "build strength", "lose weight", "run faster", "flexibility and mobility", "tone up"].map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Level"><select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} className={inputCls}>{["beginner", "intermediate", "advanced"].map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Equipment" className="col-span-2"><input value={f.equipment} onChange={(e) => setF({ ...f, equipment: e.target.value })} placeholder="none, dumbbells, bands, gym" className={inputCls} /></Field>
      <Field label="Anything else?" className="col-span-2"><input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="bad knee, short on time…" className={inputCls} /></Field>
    </div>
    {err && <p className="mt-2 text-rose-600">{err}</p>}
  </Modal>;
}

// ─── Interval timer ───
type Interval = { id: string; name: string; prep: number; work: number; rest: number; rounds: number; sets: number; setRest: number; cool: number };
const PRESETS: Interval[] = [
  { id: "tabata", name: "Tabata", prep: 10, work: 20, rest: 10, rounds: 8, sets: 1, setRest: 60, cool: 0 },
  { id: "hiit", name: "HIIT 40/20", prep: 10, work: 40, rest: 20, rounds: 10, sets: 1, setRest: 60, cool: 60 },
  { id: "3030", name: "30 on / 30 off", prep: 10, work: 30, rest: 30, rounds: 10, sets: 2, setRest: 90, cool: 60 },
  { id: "emom", name: "EMOM 10 min", prep: 10, work: 60, rest: 0, rounds: 10, sets: 1, setRest: 0, cool: 0 },
  { id: "boxing", name: "Boxing rounds", prep: 10, work: 180, rest: 60, rounds: 6, sets: 1, setRest: 0, cool: 0 },
];
const intervalSteps = (t: Interval): Step[] => {
  const out: Step[] = [];
  if (t.prep) out.push({ label: "Get ready", sec: t.prep, kind: "prep" });
  for (let s = 1; s <= t.sets; s++) {
    for (let r = 1; r <= t.rounds; r++) {
      out.push({ label: t.id === "emom" ? `Minute ${r}` : "Work", sec: t.work, kind: "work", note: `Round ${r} of ${t.rounds}${t.sets > 1 ? ` · set ${s} of ${t.sets}` : ""}`, say: t.id === "emom" ? `Minute ${r}` : "Go" });
      if (t.rest && r < t.rounds) out.push({ label: "Rest", sec: t.rest, kind: "rest", say: "Rest" });
    }
    if (s < t.sets && t.setRest) out.push({ label: "Set break", sec: t.setRest, kind: "rest", say: "Set break" });
  }
  if (t.cool) out.push({ label: "Cool down", sec: t.cool, kind: "cool" });
  return out;
};
function Intervals() {
  const { data, setData } = usePro<{ mine: Interval[]; log: { date: string; sec: number }[] }>("intervals", { mine: [], log: [] });
  const [t, setT] = useState<Interval>(PRESETS[0]);
  const [play, setPlay] = useState(false);
  const total = intervalSteps(t).reduce((a, s) => a + s.sec, 0);
  const N = (k: keyof Interval, label: string) => <Field label={label}><NumIn value={t[k] as number} min={0} onChange={(n) => setT({ ...t, [k]: Math.max(0, Number(n) || 0), id: t.id === "emom" ? "emom" : "custom" })} /></Field>;
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2">{[...PRESETS, ...data.mine].map((p) => <button key={p.id + p.name} type="button" onClick={() => setT(p)} className={`rounded-full px-3 py-1.5 text-sm font-bold ring-1 ${t.name === p.name ? "bg-orange-500 text-white ring-orange-500" : "bg-white text-slate-700 ring-slate-200"}`}>{p.name}</button>)}</div>
    <Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{N("work", "Work (sec)")}{N("rest", "Rest (sec)")}{N("rounds", "Rounds")}{N("sets", "Sets")}{N("setRest", "Rest between sets")}{N("prep", "Get ready (sec)")}{N("cool", "Cool down (sec)")}<Field label="Save as"><input value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} className={inputCls} /></Field></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Total <b className="text-lg text-slate-900">{fmtDuration(total)}</b></p>
        <div className="flex gap-2"><Btn onClick={() => setData((d) => ({ ...d, mine: [{ ...t, id: uid() }, ...d.mine.filter((m) => m.name !== t.name)] }))}>Save timer</Btn><Btn kind="primary" color={ORANGE} big onClick={() => setPlay(true)}><Play size={18} />Start</Btn></div></div>
    </Card>
    <div className="grid grid-cols-3 gap-2"><Stat label="Sessions this week" value={data.log.filter((l) => l.date >= addDays(today(), -6)).length} color={ORANGE} /><Stat label="Minutes this week" value={Math.round(data.log.filter((l) => l.date >= addDays(today(), -6)).reduce((a, l) => a + l.sec, 0) / 60)} /><Stat label="All sessions" value={data.log.length} /></div>
    {play && <SequencePlayer title={t.name} steps={intervalSteps(t)} color={ORANGE} voice={false} onClose={() => setPlay(false)} onDone={(sec) => setData((d) => ({ ...d, log: [{ date: today(), sec }, ...d.log].slice(0, 1000) }))} />}
  </div>;
}

// ─── Run & ride log ───
export const parseClock = (t: string): number => { const p = String(t || "").trim().split(":").map(Number); if (p.some((x) => !Number.isFinite(x))) return NaN; return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 60; };
const paceOf = (e: Entry) => { const sec = parseClock(e.time2), mi = Number(e.mi); return mi > 0 && sec > 0 ? sec / mi : NaN; };
const RUNS: TrackerConfig = {
  app: "runs", color: "#16a34a", entryName: "activity",
  fields: [{ key: "type", label: "Activity", type: "select", options: ["Run", "Walk", "Ride", "Hike", "Swim", "Row"], default: "Run", half: true }, { key: "mi", label: "Distance", type: "number", unit: "mi", step: 0.01, half: true }, { key: "time2", label: "Time (h:mm:ss or mm:ss)", type: "text", placeholder: "32:15" }, { key: "feel", label: "How it felt", type: "scale", min: 1, max: 5, options: ["😵", "😮‍💨", "🙂", "😃", "🔥"], default: 3, optional: true }, { key: "notes", label: "Notes", type: "text", optional: true, placeholder: "Route, weather, shoes…" }],
  metric: { label: "Distance", unit: "mi", agg: "sum", decimals: 2, value: (e) => Number(e.mi) || 0 },
  describe: (e) => { const p = paceOf(e); return <><b>{e.type} · {fmtNum(Number(e.mi), 2)} mi</b> <span className="text-slate-500">· {e.time2}{Number.isFinite(p) ? ` · ${e.type === "Ride" ? `${fmtNum(3600 / p, 1)} mph` : `${fmtDuration(p)} /mi`}` : ""}</span></>; },
  extraStats: (entries) => {
    const wk = entries.filter((e) => e.date >= addDays(today(), -6)).reduce((a, e) => a + Number(e.mi || 0), 0);
    const runs = entries.filter((e) => e.type === "Run");
    const best = (min: number) => { const ok = runs.filter((e) => Number(e.mi) >= min && Number.isFinite(paceOf(e))); if (!ok.length) return "—"; const b = ok.reduce((a, e) => (paceOf(e) < paceOf(a) ? e : a)); return fmtDuration(paceOf(b) * min); };
    return [{ label: "This week", value: `${fmtNum(wk, 1)} mi` }, { label: "Best 5K pace time", value: best(3.1), sub: "from runs ≥ 3.1 mi" }, { label: "Best mile pace", value: (() => { const p = runs.map(paceOf).filter(Number.isFinite); return p.length ? fmtDuration(Math.min(...p)) : "—"; })(), sub: "/mi" }];
  },
};

// ─── Strength log ───
type Lift = { id: string; date: string; ex: string; lb: number; reps: number };
const e1rm = (lb: number, reps: number) => (reps <= 1 ? lb : lb * (1 + reps / 30));
function Lifts() {
  const { data, setData } = usePro<{ sets: Lift[]; exercises: string[] }>("lifts", { sets: [], exercises: ["Squat", "Bench press", "Deadlift", "Overhead press", "Barbell row", "Pull-ups"] });
  const [ex, setEx] = useState(data.exercises[0] || "Squat");
  const [lb, setLb] = useState<number | "">(""); const [reps, setReps] = useState<number | "">(5);
  const [tab, setTab] = useState<"log" | "progress" | "plates">("log");
  const [target, setTarget] = useState<number | "">(185);
  const mine = data.sets.filter((s) => s.ex === ex);
  const byDay = useMemo(() => { const m = new Map<string, number>(); for (const s of mine) m.set(s.date, Math.max(m.get(s.date) || 0, e1rm(s.lb, s.reps))); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])); }, [mine]);
  const pr = mine.reduce((a, s) => Math.max(a, e1rm(s.lb, s.reps)), 0);
  const heaviest = mine.reduce((a, s) => Math.max(a, s.lb), 0);
  const todaySets = data.sets.filter((s) => s.date === today());
  const plates = (() => { let side = (Number(target || 0) - 45) / 2; const out: number[] = []; for (const p of [45, 35, 25, 10, 5, 2.5]) while (side >= p - 1e-9) { out.push(p); side -= p; } return { out, left: side }; })();
  return <div className="space-y-4">
    <Tabs value={tab} onChange={setTab} color="#b45309" items={[{ id: "log", label: "Log sets" }, { id: "progress", label: "Progress" }, { id: "plates", label: "Plate math" }]} />
    {tab !== "plates" && <div className="flex flex-wrap gap-1.5">{data.exercises.map((x) => <button key={x} type="button" onClick={() => setEx(x)} className={`rounded-full px-3 py-1 text-sm font-bold ring-1 ${ex === x ? "bg-amber-700 text-white ring-amber-700" : "bg-white text-slate-700 ring-slate-200"}`}>{x}</button>)}<button type="button" onClick={() => { const n = window.prompt("New exercise"); if (n?.trim()) { setData((d) => ({ ...d, exercises: [...d.exercises, n.trim()] })); setEx(n.trim()); } }} className="rounded-full px-3 py-1 text-sm font-bold text-amber-700 ring-1 ring-amber-200">+ Exercise</button></div>}
    {tab === "log" && <>
      <Card><div className="grid grid-cols-3 gap-2"><Field label="Weight (lb)"><NumIn value={lb} onChange={setLb} /></Field><Field label="Reps"><NumIn value={reps} onChange={setReps} /></Field><div className="flex items-end"><Btn kind="primary" color="#b45309" className="w-full" disabled={!lb || !reps} onClick={() => setData((d) => ({ ...d, sets: [{ id: uid(), date: today(), ex, lb: Number(lb), reps: Number(reps) }, ...d.sets].slice(0, 20000) }))}><Plus size={15} />Log set</Btn></div></div>
        {lb && reps ? <p className="mt-2 text-xs text-slate-500">That's an estimated 1-rep max of <b>{fmtNum(e1rm(Number(lb), Number(reps)), 0)} lb</b>{e1rm(Number(lb), Number(reps)) > pr && pr > 0 ? " — a new record! 🎉" : ""}</p> : null}</Card>
      <Card title="Today">{todaySets.length ? <ul className="divide-y divide-slate-100">{todaySets.map((s) => <li key={s.id} className="flex items-center justify-between py-1.5 text-sm"><span><b>{s.ex}</b> · {s.lb} lb × {s.reps}</span><span className="flex items-center gap-2 text-xs text-slate-500">e1RM {fmtNum(e1rm(s.lb, s.reps), 0)}<button type="button" aria-label="Delete" onClick={() => setData((d) => ({ ...d, sets: d.sets.filter((x) => x.id !== s.id) }))} className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button></span></li>)}</ul> : <Empty>No sets yet today.</Empty>}</Card>
    </>}
    {tab === "progress" && <>
      <div className="grid grid-cols-3 gap-2"><Stat label="Best est. 1RM" value={pr ? `${fmtNum(pr, 0)} lb` : "—"} color="#b45309" /><Stat label="Heaviest set" value={heaviest ? `${heaviest} lb` : "—"} /><Stat label="Sets logged" value={mine.length} /></div>
      <Card title={`${ex} — estimated 1-rep max`}>{byDay.length ? <Chart kind="line" labels={byDay.map(([d]) => fmtDay(d, { month: "numeric", day: "numeric" }))} series={[{ name: "e1RM", values: byDay.map(([, v]) => Math.round(v)) }]} colors={["#b45309"]} legend={false} /> : <Empty>Log sets to see your progress.</Empty>}</Card>
    </>}
    {tab === "plates" && <Card><Field label="Target weight (lb)"><NumIn value={target} onChange={setTarget} /></Field>
      <p className="mt-3 text-sm">With a 45 lb bar, put on <b>each side</b>:</p>
      <div className="mt-2 flex flex-wrap items-center gap-1">{plates.out.length ? plates.out.map((p, i) => <span key={i} className="inline-flex items-center justify-center rounded-md font-black text-white" style={{ height: 30 + p * 1.4, width: 22, background: { 45: "#1d4ed8", 35: "#ca8a04", 25: "#16a34a", 10: "#334155", 5: "#dc2626", 2.5: "#64748b" }[p] as string, fontSize: 10 }}>{p}</span>) : <span className="text-sm text-slate-500">Just the bar.</span>}</div>
      {plates.left > 0.01 && <p className="mt-2 text-xs text-amber-700">{fmtNum(plates.left * 2, 1)} lb can't be made with standard plates.</p>}</Card>}
  </div>;
}

// ─── Stretch and yoga ───
type Pose = { name: string; sec: number; how: string };
const STRETCH_ROUTINES: { name: string; poses: Pose[] }[] = [
  { name: "Morning wake-up (6 min)", poses: [{ name: "Neck rolls", sec: 30, how: "Slowly roll your head in a half circle, side to side." }, { name: "Shoulder rolls", sec: 30, how: "Roll shoulders backward, then forward." }, { name: "Standing side stretch (left)", sec: 30, how: "Reach your left arm over your head and lean right." }, { name: "Standing side stretch (right)", sec: 30, how: "Reach your right arm over and lean left." }, { name: "Forward fold", sec: 45, how: "Hinge at the hips and hang; knees soft." }, { name: "Cat-cow", sec: 45, how: "On hands and knees, arch then round your back with your breath." }, { name: "Child's pose", sec: 45, how: "Sit back on your heels, arms long in front." }, { name: "Hip flexor lunge (left)", sec: 40, how: "Left foot forward, right knee down, press hips forward." }, { name: "Hip flexor lunge (right)", sec: 40, how: "Switch sides." }, { name: "Reach up and breathe", sec: 30, how: "Stand tall, arms up, three deep breaths." }] },
  { name: "Desk break (4 min)", poses: [{ name: "Chin tucks", sec: 30, how: "Pull your chin straight back, hold 2 seconds, repeat." }, { name: "Seated twist (left)", sec: 30, how: "Turn your chest left, hand on the chair back." }, { name: "Seated twist (right)", sec: 30, how: "Turn right." }, { name: "Wrist stretch", sec: 30, how: "Arm out, gently pull fingers back, then down." }, { name: "Chest opener", sec: 30, how: "Clasp hands behind your back and lift." }, { name: "Seated figure-four (left)", sec: 30, how: "Left ankle on right knee; lean forward." }, { name: "Seated figure-four (right)", sec: 30, how: "Switch sides." }, { name: "Stand and shake it out", sec: 30, how: "Stand up, shake arms and legs loose." }] },
  { name: "After a run (6 min)", poses: [{ name: "Standing quad (left)", sec: 40, how: "Hold your left ankle behind you, knees together." }, { name: "Standing quad (right)", sec: 40, how: "Switch." }, { name: "Calf stretch (left)", sec: 40, how: "Hands on a wall, left leg back, heel down." }, { name: "Calf stretch (right)", sec: 40, how: "Switch." }, { name: "Hamstring (left)", sec: 40, how: "Heel on a low step, hinge forward." }, { name: "Hamstring (right)", sec: 40, how: "Switch." }, { name: "Figure-four (left)", sec: 40, how: "Lying down, ankle over knee, pull the leg in." }, { name: "Figure-four (right)", sec: 40, how: "Switch." }, { name: "Lying twist", sec: 40, how: "Knees to one side, then the other, arms wide." }] },
  { name: "Bedtime wind-down (5 min)", poses: [{ name: "Child's pose", sec: 60, how: "Sit back on heels, forehead down, breathe slowly." }, { name: "Seated forward fold", sec: 45, how: "Legs long, fold gently forward." }, { name: "Butterfly", sec: 45, how: "Soles of feet together, knees open." }, { name: "Happy baby", sec: 45, how: "On your back, hold your feet, rock gently." }, { name: "Legs up the wall", sec: 90, how: "Lie with legs up a wall; close your eyes." }] },
];
const YOGA_POSES: Pose[] = [
  { name: "Mountain", sec: 30, how: "Stand tall, feet together, arms by your sides, breathe." }, { name: "Upward salute", sec: 20, how: "Reach arms overhead." }, { name: "Forward fold", sec: 30, how: "Fold over your legs." }, { name: "Halfway lift", sec: 15, how: "Flat back, hands on shins." }, { name: "Plank", sec: 30, how: "Strong straight line." }, { name: "Chaturanga", sec: 10, how: "Lower halfway, elbows in." }, { name: "Upward dog", sec: 20, how: "Chest forward and up." }, { name: "Downward dog", sec: 45, how: "Hips high, heels toward the floor." },
  { name: "Warrior I (left)", sec: 40, how: "Left foot forward, bend the knee, arms up." }, { name: "Warrior I (right)", sec: 40, how: "Right foot forward." }, { name: "Warrior II (left)", sec: 40, how: "Arms out, gaze over the front hand." }, { name: "Warrior II (right)", sec: 40, how: "Switch sides." }, { name: "Triangle (left)", sec: 40, how: "Straight legs, reach down and up." }, { name: "Triangle (right)", sec: 40, how: "Switch sides." }, { name: "Tree (left)", sec: 30, how: "Balance on the right foot, left foot on the calf or thigh." }, { name: "Tree (right)", sec: 30, how: "Switch." }, { name: "Chair", sec: 30, how: "Sit back, arms up." },
  { name: "Cobra", sec: 30, how: "Lift your chest from the floor." }, { name: "Bridge", sec: 30, how: "On your back, lift your hips." }, { name: "Child's pose", sec: 60, how: "Rest." }, { name: "Savasana", sec: 180, how: "Lie still. Let your whole body relax." },
];
const SUN_A = ["Mountain", "Upward salute", "Forward fold", "Halfway lift", "Plank", "Chaturanga", "Upward dog", "Downward dog", "Halfway lift", "Forward fold", "Upward salute", "Mountain"];
function PoseFlows({ app, color, builtIn, library, kind }: { app: string; color: string; builtIn: { name: string; poses: Pose[] }[]; library: Pose[]; kind: string }) {
  const { data, setData } = usePro<{ flows: { id: string; name: string; poses: Pose[] }[]; log: { date: string; sec: number }[] }>(app, { flows: [], log: [] });
  const [play, setPlay] = useState<{ name: string; poses: Pose[] } | null>(null);
  const [edit, setEdit] = useState<{ id: string; name: string; poses: Pose[] } | null>(null);
  const all = [...data.flows, ...builtIn];
  return <div className="space-y-4">
    <div className="flex justify-between"><Stat label={`Sessions this week`} value={data.log.filter((l) => l.date >= addDays(today(), -6)).length} color={color} /><Btn kind="primary" color={color} onClick={() => setEdit({ id: uid(), name: `My ${kind}`, poses: [] })}><Plus size={16} />Build your own</Btn></div>
    <div className="grid gap-3 sm:grid-cols-2">{all.map((f) => <Card key={f.name}>
      <div className="flex items-start justify-between"><div><p className="font-black">{f.name}</p><p className="text-xs text-slate-500">{f.poses.length} poses · {fmtDuration(f.poses.reduce((a, p) => a + p.sec, 0))}</p></div><div className="flex gap-1">{data.flows.includes(f as any) && <Btn onClick={() => setEdit(f as any)} title="Edit"><Pencil size={14} /></Btn>}<Btn kind="primary" color={color} onClick={() => setPlay(f)}><Play size={15} /></Btn></div></div>
      <p className="mt-2 text-sm text-slate-600">{f.poses.map((p) => p.name).slice(0, 7).join(" · ")}{f.poses.length > 7 ? " …" : ""}</p>
    </Card>)}</div>
    {edit && <Modal title={`Build a ${kind}`} wide onClose={() => setEdit(null)} footer={<><Btn kind="danger" onClick={() => { setData((d) => ({ ...d, flows: d.flows.filter((x) => x.id !== edit.id) })); setEdit(null); }}>Delete</Btn><Btn kind="primary" color={color} disabled={!edit.poses.length} onClick={() => { setData((d) => ({ ...d, flows: d.flows.some((x) => x.id === edit.id) ? d.flows.map((x) => (x.id === edit.id ? edit : x)) : [edit, ...d.flows] })); setEdit(null); }}>Save</Btn></>}>
      <Field label="Name"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={inputCls} /></Field>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div><p className="mb-1 text-xs font-bold text-slate-600">Tap to add</p><div className="max-h-72 space-y-1 overflow-auto">{library.map((p) => <button key={p.name} type="button" onClick={() => setEdit({ ...edit, poses: [...edit.poses, { ...p }] })} className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50"><b>{p.name}</b> <span className="text-xs text-slate-500">{p.sec}s</span></button>)}</div></div>
        <div><p className="mb-1 text-xs font-bold text-slate-600">Your {kind}</p>{edit.poses.length ? <ol className="space-y-1">{edit.poses.map((p, i) => <li key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1 text-sm"><span className="flex-1">{i + 1}. {p.name}</span><input type="number" value={p.sec} onChange={(e) => setEdit({ ...edit, poses: edit.poses.map((x, j) => (j === i ? { ...x, sec: Math.max(5, Number(e.target.value) || 5) } : x)) })} className="h-8 w-16 rounded border border-slate-300 px-1 text-sm" aria-label="Seconds" />s<button type="button" onClick={() => setEdit({ ...edit, poses: edit.poses.filter((_, j) => j !== i) })} aria-label="Remove" className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button></li>)}</ol> : <Empty>Nothing yet.</Empty>}</div>
      </div>
    </Modal>}
    {play && <SequencePlayer title={play.name} color={color} steps={play.poses.map((p) => ({ label: p.name, sec: p.sec, note: p.how, say: `${p.name}. ${p.how}` }))} onClose={() => setPlay(null)} onDone={(sec) => setData((d) => ({ ...d, log: [{ date: today(), sec }, ...d.log].slice(0, 1000) }))} />}
  </div>;
}
const pose = (n: string) => YOGA_POSES.find((p) => p.name === n)!;
const YOGA_FLOWS = [
  { name: "Sun salutation ×3", poses: [...SUN_A, ...SUN_A, ...SUN_A].map(pose) },
  { name: "Beginner flow (15 min)", poses: ["Mountain", "Upward salute", "Forward fold", "Downward dog", "Warrior I (left)", "Warrior II (left)", "Triangle (left)", "Downward dog", "Warrior I (right)", "Warrior II (right)", "Triangle (right)", "Tree (left)", "Tree (right)", "Cobra", "Bridge", "Child's pose", "Savasana"].map(pose) },
  { name: "Balance & strength", poses: ["Mountain", "Chair", "Tree (left)", "Tree (right)", "Warrior II (left)", "Warrior II (right)", "Plank", "Downward dog", "Child's pose", "Savasana"].map(pose) },
];

// ─── Couch to 5K ───
type Seg = [("run" | "walk"), number];
const r = (m: number): Seg => ["run", m * 60], w = (m: number): Seg => ["walk", m * 60];
const rep = (n: number, ...segs: Seg[]) => Array.from({ length: n }, () => segs).flat();
const C25K: Seg[][][] = [
  [rep(8, r(1), w(1.5)), rep(8, r(1), w(1.5)), rep(8, r(1), w(1.5))],
  [rep(6, r(1.5), w(2)), rep(6, r(1.5), w(2)), rep(6, r(1.5), w(2))],
  [rep(2, r(1.5), w(1.5), r(3), w(3)), rep(2, r(1.5), w(1.5), r(3), w(3)), rep(2, r(1.5), w(1.5), r(3), w(3))],
  [[r(3), w(1.5), r(5), w(2.5), r(3), w(1.5), r(5)], [r(3), w(1.5), r(5), w(2.5), r(3), w(1.5), r(5)], [r(3), w(1.5), r(5), w(2.5), r(3), w(1.5), r(5)]],
  [[r(5), w(3), r(5), w(3), r(5)], [r(8), w(5), r(8)], [r(20)]],
  [[r(5), w(3), r(8), w(3), r(5)], [r(10), w(3), r(10)], [r(25)]],
  [[r(25)], [r(25)], [r(25)]], [[r(28)], [r(28)], [r(28)]], [[r(30)], [r(30)], [r(30)]],
];
function Couch5k() {
  const { data, setData } = usePro<{ done: string[] }>("couch-5k", { done: [] });
  const [play, setPlay] = useState<{ wk: number; d: number } | null>(null);
  const next = (() => { for (let wk = 0; wk < 9; wk++) for (let d = 0; d < 3; d++) if (!data.done.includes(`${wk}-${d}`)) return { wk, d }; return null; })();
  const steps = (wk: number, d: number): Step[] => [{ label: "Brisk warm-up walk", sec: 300, kind: "prep", say: "Warm up with a brisk walk" }, ...C25K[wk][d].map(([k, sec]): Step => ({ label: k === "run" ? `Run ${fmtDuration(sec)}` : `Walk ${fmtDuration(sec)}`, sec, kind: k === "run" ? "work" : "rest", say: k === "run" ? `Run for ${sec >= 60 ? `${sec / 60} minutes` : `${sec} seconds`}` : "Walk" })), { label: "Cool-down walk", sec: 300, kind: "cool", say: "Cool down. Walk" }];
  const desc = (wk: number, d: number) => { const segs = C25K[wk][d]; const runs = segs.filter((x) => x[0] === "run"); return `${runs.length}× run · ${Math.round(runs.reduce((a, x) => a + x[1], 0) / 60)} min running`; };
  return <div className="space-y-4">
    {next ? <Card className="text-center"><p className="text-xs font-bold uppercase tracking-wide text-rose-600">Next up</p><p className="text-2xl font-black">Week {next.wk + 1}, Day {next.d + 1}</p><p className="text-sm text-slate-500">{desc(next.wk, next.d)} · {fmtDuration(steps(next.wk, next.d).reduce((a, s) => a + s.sec, 0))} total</p><Btn kind="primary" color="#dc2626" big className="mt-3" onClick={() => setPlay(next)}><Play size={18} />Start session</Btn></Card>
      : <Card className="text-center"><p className="text-5xl">🏅</p><p className="mt-2 text-2xl font-black">You did it — 5K!</p></Card>}
    <div className="space-y-2">{C25K.map((week, wk) => <Card key={wk}><div className="flex flex-wrap items-center gap-2"><p className="w-20 font-black">Week {wk + 1}</p>{week.map((_, d) => { const k = `${wk}-${d}`, done = data.done.includes(k); return <button key={d} type="button" onClick={() => setPlay({ wk, d })} className={`flex-1 rounded-xl px-3 py-2 text-left text-xs ring-1 ${done ? "bg-emerald-50 ring-emerald-200" : "bg-white ring-slate-200 hover:ring-rose-300"}`}><span className="block font-bold">{done ? "✓ " : ""}Day {d + 1}</span><span className="text-slate-500">{desc(wk, d)}</span></button>; })}</div></Card>)}</div>
    {play && <SequencePlayer title={`Couch to 5K · Week ${play.wk + 1}, Day ${play.d + 1}`} color="#dc2626" steps={steps(play.wk, play.d)} onClose={() => setPlay(null)} onDone={() => setData((d) => ({ done: [...new Set([...d.done, `${play.wk}-${play.d}`])] }))} />}
  </div>;
}

// ─── 30-day challenges ───
type Challenge = { id: string; name: string; unit: string; start: number; step: number; restEvery: number; startDate: string; done: number[]; emoji: string };
const CH_TEMPLATES: Omit<Challenge, "id" | "startDate" | "done">[] = [
  { name: "Plank", unit: "seconds", start: 20, step: 5, restEvery: 4, emoji: "🧱" }, { name: "Push-ups", unit: "push-ups", start: 5, step: 1, restEvery: 4, emoji: "💪" },
  { name: "Squats", unit: "squats", start: 20, step: 5, restEvery: 4, emoji: "🦵" }, { name: "Sit-ups", unit: "sit-ups", start: 10, step: 2, restEvery: 4, emoji: "🌀" },
  { name: "Wall sit", unit: "seconds", start: 20, step: 5, restEvery: 5, emoji: "🧘" }, { name: "Walk", unit: "minutes", start: 10, step: 1, restEvery: 0, emoji: "🚶" },
  { name: "Jump rope", unit: "jumps", start: 50, step: 10, restEvery: 4, emoji: "🪢" }, { name: "No sugary drinks", unit: "day", start: 1, step: 0, restEvery: 0, emoji: "🚫" },
];
export const challengeTarget = (c: Pick<Challenge, "start" | "step" | "restEvery">, day: number): number | null => { if (c.restEvery && (day + 1) % c.restEvery === 0) return null; const workDays = c.restEvery ? day - Math.floor((day + 1) / c.restEvery) : day; return c.start + c.step * workDays; };
function Challenges() {
  const { data, setData } = usePro<{ list: Challenge[] }>("challenges", { list: [] });
  const [custom, setCustom] = useState<Omit<Challenge, "id" | "startDate" | "done"> | null>(null);
  const begin = (t: Omit<Challenge, "id" | "startDate" | "done">) => setData((d) => ({ list: [{ ...t, id: uid(), startDate: today(), done: [] }, ...d.list] }));
  return <div className="space-y-4">
    {data.list.map((c) => { const dayNow = Math.min(29, daysBetween(c.startDate, today())); const t = challengeTarget(c, dayNow); const doneToday = c.done.includes(dayNow); return <Card key={c.id} title={<>{c.emoji} {c.name} challenge</>} right={<button type="button" aria-label="Remove" onClick={() => { if (window.confirm("Stop this challenge?")) setData((d) => ({ list: d.list.filter((x) => x.id !== c.id) })); }} className="text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button>}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase text-slate-500">Day {dayNow + 1} of 30</p><p className="text-3xl font-black text-amber-600">{t === null ? "Rest day 😌" : c.step === 0 && c.unit === "day" ? "Today ✓?" : `${t} ${c.unit}`}</p></div>
        {t !== null && <Btn kind={doneToday ? "soft" : "primary"} color="#ca8a04" big onClick={() => setData((d) => ({ list: d.list.map((x) => (x.id === c.id ? { ...x, done: doneToday ? x.done.filter((n) => n !== dayNow) : [...x.done, dayNow] } : x)) }))}>{doneToday ? <><Check size={18} />Done!</> : "Mark done"}</Btn>}</div>
      <div className="mt-3 grid grid-cols-10 gap-1">{Array.from({ length: 30 }, (_, i) => { const tg = challengeTarget(c, i); const done = c.done.includes(i); return <div key={i} title={`Day ${i + 1}: ${tg === null ? "rest" : `${tg} ${c.unit}`}`} className={`flex aspect-square flex-col items-center justify-center rounded-lg text-[10px] font-bold ${done ? "bg-amber-500 text-white" : i === dayNow ? "bg-amber-100 ring-2 ring-amber-400" : i < dayNow && tg !== null ? "bg-rose-50 text-rose-400" : "bg-slate-50 text-slate-500"}`}><span>{i + 1}</span><span className="font-normal">{tg === null ? "rest" : c.unit === "day" ? "" : tg}</span></div>; })}</div>
      <p className="mt-2 text-xs text-slate-500">{c.done.length} days done</p>
    </Card>; })}
    <Card title="Start a challenge"><div className="grid gap-2 sm:grid-cols-4">{CH_TEMPLATES.map((t) => <button key={t.name} type="button" onClick={() => begin(t)} className="rounded-xl bg-amber-50 px-3 py-3 text-left ring-1 ring-amber-100 hover:ring-amber-300"><span className="text-2xl">{t.emoji}</span><span className="block font-black">{t.name}</span><span className="text-xs text-slate-500">{t.step ? `${t.start} → ${challengeTarget(t, 28) ?? challengeTarget(t, 27)} ${t.unit}` : "every day"}</span></button>)}<button type="button" onClick={() => setCustom({ name: "", unit: "reps", start: 10, step: 1, restEvery: 0, emoji: "⭐" })} className="rounded-xl px-3 py-3 text-left ring-1 ring-dashed ring-slate-300 hover:bg-slate-50"><span className="text-2xl">➕</span><span className="block font-black">Make your own</span></button></div></Card>
    {custom && <Modal title="Your challenge" onClose={() => setCustom(null)} footer={<Btn kind="primary" color="#ca8a04" disabled={!custom.name.trim()} onClick={() => { begin(custom); setCustom(null); }}>Start</Btn>}>
      <div className="grid grid-cols-2 gap-3"><Field label="Name" className="col-span-2"><input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} className={inputCls} /></Field><Field label="Start at"><NumIn value={custom.start} onChange={(n) => setCustom({ ...custom, start: Number(n) || 0 })} /></Field><Field label="Add each day"><NumIn value={custom.step} onChange={(n) => setCustom({ ...custom, step: Number(n) || 0 })} /></Field><Field label="Unit"><input value={custom.unit} onChange={(e) => setCustom({ ...custom, unit: e.target.value })} className={inputCls} /></Field><Field label="Rest day every (0 = none)"><NumIn value={custom.restEvery} onChange={(n) => setCustom({ ...custom, restEvery: Number(n) || 0 })} /></Field></div>
    </Modal>}
  </div>;
}

// ─── Scoreboard ───
type Board = { a: string; b: string; ca: string; cb: string; sa: number; sb: number; fa: number; fb: number; period: number; clockSec: number };
function Scoreboard() {
  const { data, setData } = usePro<Board>("scoreboard", { a: "Home", b: "Away", ca: "#2563eb", cb: "#dc2626", sa: 0, sb: 0, fa: 0, fb: 0, period: 1, clockSec: 600 });
  const [hist, setHist] = useState<Board[]>([]);
  const [full, setFull] = useState(false);
  const [endAt, setEndAt] = useState<number | null>(null); const [left, setLeft] = useState(data.clockSec * 1000);
  useTick(endAt !== null, 200);
  const ms = endAt !== null ? Math.max(0, endAt - Date.now()) : left;
  useEffect(() => { if (endAt !== null && ms <= 0) { setEndAt(null); setLeft(0); beep(330, 900, 0.3, "square"); } }, [ms, endAt]);
  const change = (p: Partial<Board>) => { setHist((h) => [...h.slice(-50), data]); setData((d) => ({ ...d, ...p })); };
  const board = (big: boolean) => <div className={`grid w-full grid-cols-2 gap-3 ${big ? "max-w-6xl px-6" : ""}`}>
    {(["a", "b"] as const).map((t) => <div key={t} className="flex flex-col items-center rounded-3xl p-4 text-white" style={{ background: t === "a" ? data.ca : data.cb }}>
      <input value={data[t]} onChange={(e) => setData((d) => ({ ...d, [t]: e.target.value }))} aria-label="Team name" className={`w-full bg-transparent text-center font-black outline-none ${big ? "text-5xl" : "text-xl"}`} />
      <p className={`font-mono font-black tabular-nums ${big ? "text-[12rem] leading-none" : "text-7xl"}`}>{data[t === "a" ? "sa" : "sb"]}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">{[1, 2, 3, 6].map((n) => <button key={n} type="button" onClick={() => change({ [t === "a" ? "sa" : "sb"]: data[t === "a" ? "sa" : "sb"] + n })} className="rounded-xl bg-white/20 px-4 py-2 text-lg font-black hover:bg-white/30">+{n}</button>)}<button type="button" onClick={() => change({ [t === "a" ? "sa" : "sb"]: Math.max(0, data[t === "a" ? "sa" : "sb"] - 1) })} className="rounded-xl bg-black/20 px-4 py-2 text-lg font-black">−1</button></div>
      <p className="mt-2 text-sm font-bold opacity-90">Fouls {data[t === "a" ? "fa" : "fb"]} <button type="button" onClick={() => change({ [t === "a" ? "fa" : "fb"]: data[t === "a" ? "fa" : "fb"] + 1 })} className="ml-1 rounded bg-white/20 px-2">+</button></p>
    </div>)}
  </div>;
  const clock = (big: boolean) => <div className="flex flex-col items-center"><p className={`font-mono font-black tabular-nums ${big ? "text-8xl text-amber-300" : "text-5xl"}`}>{fmtDuration(ms / 1000)}</p><p className={big ? "text-2xl font-bold" : "text-sm font-bold text-slate-500"}>Period {data.period}</p></div>;
  return <div className="space-y-4">
    <Card className="flex flex-col items-center gap-3">{clock(false)}<div className="flex flex-wrap justify-center gap-2"><Btn kind="primary" color="#0f172a" onClick={() => (endAt ? (setLeft(ms), setEndAt(null)) : setEndAt(Date.now() + left))}>{endAt ? "Stop clock" : "Start clock"}</Btn><Btn onClick={() => { setEndAt(null); setLeft(data.clockSec * 1000); }}>Reset clock</Btn><Btn onClick={() => change({ period: data.period + 1 })}>Next period</Btn><Btn onClick={() => setFull(true)}>Full screen</Btn></div>
      <div className="flex items-center gap-2 text-sm">Clock (min)<NumIn value={data.clockSec / 60} onChange={(n) => { const s = Math.max(1, Number(n) || 1) * 60; setData((d) => ({ ...d, clockSec: s })); if (!endAt) setLeft(s * 1000); }} className="w-20" /></div></Card>
    {board(false)}
    <div className="flex flex-wrap justify-center gap-2"><Btn disabled={!hist.length} onClick={() => { const p = hist[hist.length - 1]; setHist((h) => h.slice(0, -1)); if (p) setData(p); }}>Undo</Btn><Btn kind="danger" onClick={() => change({ sa: 0, sb: 0, fa: 0, fb: 0, period: 1 })}>New game</Btn>
      <label className="flex items-center gap-1 text-sm">Colours <input type="color" value={data.ca} onChange={(e) => setData((d) => ({ ...d, ca: e.target.value }))} /><input type="color" value={data.cb} onChange={(e) => setData((d) => ({ ...d, cb: e.target.value }))} /></label></div>
    {full && <FullScreen onClose={() => setFull(false)}>{clock(true)}<div className="mt-6 w-full">{board(true)}</div></FullScreen>}
  </div>;
}

// ─── Station rotation ───
function Stations() {
  const { data, setData } = usePro<{ stations: string[]; groups: string[]; minutes: number; move: number }>("pe-stations", { stations: ["Jump rope", "Cones dribble", "Bean bag toss", "Balance beam"], groups: ["Group 1", "Group 2", "Group 3", "Group 4"], minutes: 5, move: 30 });
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<"idle" | "work" | "move">("idle");
  const [endAt, setEndAt] = useState(0);
  const [full, setFull] = useState(false);
  useTick(phase !== "idle", 200); useWakeLock(phase !== "idle");
  const left = Math.max(0, endAt - Date.now());
  const rounds = Math.max(1, data.stations.length);
  useEffect(() => {
    if (phase === "idle" || left > 0) return;
    if (phase === "work") { if (round + 1 >= rounds) { setPhase("idle"); chime(); return; } setPhase("move"); setEndAt(Date.now() + data.move * 1000); beep(440, 700, 0.3, "square"); }
    else { setRound((r2) => r2 + 1); setPhase("work"); setEndAt(Date.now() + data.minutes * 60_000); beep(880, 300); }
  });
  const at = (g: number) => data.stations[(g + round) % rounds];
  const grid = (big: boolean) => <div className={`grid gap-3 ${big ? "w-full max-w-6xl grid-cols-2 px-6 md:grid-cols-4" : "grid-cols-2 md:grid-cols-4"}`}>{data.groups.map((g, i) => <div key={i} className={`rounded-2xl p-4 text-center ${big ? "bg-white/10" : "bg-teal-50 ring-1 ring-teal-100"}`}><p className={`font-bold ${big ? "text-2xl" : "text-sm text-teal-800"}`}>{g}</p><p className={`font-black ${big ? "text-4xl" : "text-lg"}`}>{at(i) || "—"}</p>{phase !== "idle" && <p className={`text-xs ${big ? "opacity-70" : "text-slate-500"}`}>next: {data.stations[(i + round + 1) % rounds]}</p>}</div>)}</div>;
  const status = (big: boolean) => <div className="text-center"><p className={`font-bold uppercase tracking-widest ${big ? "text-2xl text-amber-300" : "text-xs text-teal-700"}`}>{phase === "move" ? "Rotate! Move to your next station" : phase === "work" ? `Round ${round + 1} of ${rounds}` : "Ready"}</p><p className={`font-mono font-black tabular-nums ${big ? "text-9xl" : "text-6xl"}`}>{fmtDuration(phase === "idle" ? data.minutes * 60 : left / 1000)}</p></div>;
  const list = (k: "stations" | "groups", label: string) => <Card title={label}><div className="space-y-1.5">{data[k].map((s, i) => <div key={i} className="flex gap-2"><input value={s} onChange={(e) => setData((d) => ({ ...d, [k]: d[k].map((x, j) => (j === i ? e.target.value : x)) }))} className={inputCls} /><button type="button" aria-label="Remove" onClick={() => setData((d) => ({ ...d, [k]: d[k].filter((_, j) => j !== i) }))} className="text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button></div>)}</div><Btn className="mt-2" onClick={() => setData((d) => ({ ...d, [k]: [...d[k], k === "groups" ? `Group ${d[k].length + 1}` : "New station"] }))}><Plus size={14} />Add</Btn></Card>;
  return <div className="space-y-4">
    <Card>{status(false)}<div className="mt-3 flex flex-wrap justify-center gap-2">{phase === "idle" ? <Btn kind="primary" color="#0d9488" big onClick={() => { setRound(0); setPhase("work"); setEndAt(Date.now() + data.minutes * 60_000); beep(880, 300); }}><Play size={18} />Start rotations</Btn> : <Btn kind="danger" onClick={() => setPhase("idle")}>Stop</Btn>}<Btn onClick={() => setFull(true)}>Full screen</Btn></div></Card>
    {grid(false)}
    <div className="grid gap-3 md:grid-cols-3">{list("stations", "Stations")}{list("groups", "Groups")}<Card title="Timing"><div className="space-y-2"><Field label="Minutes at each station"><NumIn value={data.minutes} onChange={(n) => setData((d) => ({ ...d, minutes: Math.max(0.5, Number(n) || 1) }))} /></Field><Field label="Seconds to move"><NumIn value={data.move} onChange={(n) => setData((d) => ({ ...d, move: Math.max(0, Number(n) || 0) }))} /></Field></div></Card></div>
    {full && <FullScreen onClose={() => setFull(false)} bg="#134e4a">{status(true)}<div className="mt-8 flex w-full justify-center">{grid(true)}</div></FullScreen>}
  </div>;
}

// ─── Step challenge ───
function StepChallenge() {
  const { data, setData } = usePro<{ name: string; start: string; end: string; people: { id: string; name: string; team: string }[]; log: Record<string, number> }>("step-challenge", { name: "Step challenge", start: today(), end: addDays(today(), 13), people: [], log: {} });
  const [who, setWho] = useState(""); const [team, setTeam] = useState("");
  const [day, setDay] = useState(today());
  const total = (pid: string) => Object.entries(data.log).filter(([k]) => { const [p, d] = k.split("|"); return p === pid && d >= data.start && d <= data.end; }).reduce((a, [, v]) => a + v, 0);
  const ranked = [...data.people].sort((a, b) => total(b.id) - total(a.id));
  const teams = [...new Set(data.people.map((p) => p.team).filter(Boolean))].map((t) => ({ t, steps: data.people.filter((p) => p.team === t).reduce((a, p) => a + total(p.id), 0) })).sort((a, b) => b.steps - a.steps);
  const daysLeft = daysBetween(today(), data.end);
  return <div className="space-y-4">
    <Card><div className="grid gap-3 sm:grid-cols-3"><Field label="Challenge name"><input value={data.name} onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))} className={inputCls} /></Field><Field label="Starts"><input type="date" value={data.start} onChange={(e) => setData((d) => ({ ...d, start: e.target.value }))} className={inputCls} /></Field><Field label="Ends"><input type="date" value={data.end} onChange={(e) => setData((d) => ({ ...d, end: e.target.value }))} className={inputCls} /></Field></div><p className="mt-2 text-sm font-bold text-emerald-700">{daysLeft >= 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} to go` : "Finished!"}</p></Card>
    <Card title="Leaderboard">{ranked.length ? <ol className="space-y-2">{ranked.map((p, i) => <li key={p.id} className="flex items-center gap-3"><span className="w-8 text-center text-xl">{["🥇", "🥈", "🥉"][i] || i + 1}</span><span className="min-w-0 flex-1"><span className="font-bold">{p.name}</span>{p.team && <span className="ml-1 text-xs text-slate-500">{p.team}</span>}<span className="mt-1 block h-2 rounded-full bg-emerald-100"><span className="block h-2 rounded-full bg-emerald-500" style={{ width: `${(total(p.id) / Math.max(1, total(ranked[0].id))) * 100}%` }} /></span></span><span className="w-24 text-right font-mono font-bold">{total(p.id).toLocaleString()}</span></li>)}</ol> : <Empty>Add people below to start.</Empty>}</Card>
    {teams.length > 1 && <Card title="Teams"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{teams.map((t) => <Stat key={t.t} label={t.t} value={t.steps.toLocaleString()} />)}</div></Card>}
    <Card title="Log steps" right={<input type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2 text-sm" />}>
      <div className="grid gap-2 sm:grid-cols-2">{data.people.map((p) => <label key={p.id} className="flex items-center gap-2"><span className="w-32 truncate text-sm font-bold">{p.name}</span><NumIn value={data.log[`${p.id}|${day}`] ?? ""} onChange={(n) => setData((d) => ({ ...d, log: { ...d.log, [`${p.id}|${day}`]: Number(n) || 0 } }))} placeholder="steps" /></label>)}</div>
      <div className="mt-3 flex gap-2"><input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Name" className={inputCls} /><input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Team (optional)" className={inputCls} /><Btn onClick={() => { if (who.trim()) setData((d) => ({ ...d, people: [...d.people, { id: uid(), name: who.trim(), team: team.trim() }] })); setWho(""); }}><Plus size={15} />Add</Btn></div>
    </Card>
  </div>;
}

// ─── Pace calculator ───
function PaceCalc() {
  const [dist, setDist] = useState<number | "">(3.1); const [unit, setUnit] = useState<"mi" | "km">("mi");
  const [time, setTime] = useState("30:00"); const [pace, setPace] = useState("9:39");
  const sec = parseClock(time), p = parseClock(pace), d = Number(dist || 0);
  const RACES = [["5K", 3.10686], ["10K", 6.21371], ["Half marathon", 13.1094], ["Marathon", 26.2188]] as const;
  const perMi = unit === "mi" ? sec / d : (sec / d) * 1.609344;
  return <div className="space-y-4">
    <Card title="Pace from time and distance"><div className="grid grid-cols-3 gap-2"><Field label="Distance"><NumIn value={dist} onChange={setDist} /></Field><Field label="Unit"><select value={unit} onChange={(e) => setUnit(e.target.value as "mi" | "km")} className={inputCls}><option value="mi">miles</option><option value="km">km</option></select></Field><Field label="Time (h:mm:ss)"><input value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} /></Field></div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="Pace per mile" value={Number.isFinite(perMi) && d ? fmtDuration(perMi) : "—"} color="#2563eb" /><Stat label="Pace per km" value={Number.isFinite(perMi) && d ? fmtDuration(perMi / 1.609344) : "—"} /><Stat label="Speed" value={Number.isFinite(perMi) && d ? `${fmtNum(3600 / perMi, 2)} mph` : "—"} /><Stat label="Treadmill" value={Number.isFinite(perMi) && d ? `${fmtNum(3600 / perMi, 1)}` : "—"} sub="mph setting" /></div></Card>
    <Card title="Finish times at a pace"><Field label="Pace per mile (m:ss)"><input value={pace} onChange={(e) => setPace(e.target.value)} className={`${inputCls} max-w-[160px]`} /></Field>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{RACES.map(([n, mi]) => <Stat key={n} label={n} value={Number.isFinite(p) ? fmtDuration(p * mi) : "—"} />)}</div>
      {Number.isFinite(p) && <><p className="mb-1 mt-4 text-xs font-bold text-slate-600">Mile splits for a half marathon</p><div className="flex flex-wrap gap-1.5 text-xs">{Array.from({ length: 13 }, (_, i) => <span key={i} className="rounded-md bg-slate-100 px-2 py-1 font-mono">{i + 1}: {fmtDuration(p * (i + 1))}</span>)}</div></>}</Card>
  </div>;
}

export const FITNESS: Record<string, ComponentType> = {
  workouts: Workouts, intervals: Intervals, runs: () => <LogTracker cfg={RUNS} />, lifts: Lifts,
  stretch: () => <PoseFlows app="stretch" color="#0d9488" builtIn={STRETCH_ROUTINES} library={STRETCH_ROUTINES.flatMap((r2) => r2.poses).filter((p, i, a) => a.findIndex((x) => x.name === p.name) === i)} kind="routine" />,
  "couch-5k": Couch5k, challenges: Challenges,
  yoga: () => <PoseFlows app="yoga" color="#a855f7" builtIn={YOGA_FLOWS} library={YOGA_POSES} kind="flow" />,
  scoreboard: Scoreboard, "pe-stations": Stations, "step-challenge": StepChallenge, "pace-calc": PaceCalc,
};
