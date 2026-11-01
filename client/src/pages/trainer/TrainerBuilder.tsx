// Arise Trainer's builders: workouts (from Arise Fit's exercise catalog plus the trainer's own exercises
// with their video links), multi-week programs made of those workouts, and check-in forms.
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, PlayCircle, Plus, Search, Trash2 } from "lucide-react";
import { CATALOG } from "@shared/fit";
import { videoFor } from "@shared/fitVideos";
import type { CheckinForm, CoachProgram, Library, OwnExercise, PlanItem, PlanWorkout, Question } from "@shared/coach";
import { Btn, C, Card, Chips, Field, Sheet, Title, display, inputCls, inputStyle } from "../fit/fitUi";

export const newId = () => Math.random().toString(36).slice(2, 12);
const MUSCLES = ["all", "chest", "back", "shoulders", "biceps", "triceps", "abs", "quads", "hamstrings", "glutes", "calves", "full body", "cardio", "mine"] as const;
const small = "h-11 w-full min-w-0 rounded-[10px] text-center text-[16px] font-semibold outline-none";

type Pickable = { id: string; name: string; muscle: string; equipment: string; video: boolean; mine: boolean };
export function allExercises(lib: Library): Pickable[] {
  return [...lib.exercises.map((e) => ({ id: e.id, name: e.name, muscle: e.muscle || "other", equipment: "your exercise", video: !!e.video, mine: true })),
    ...CATALOG.map((e) => ({ id: e.id, name: e.name, muscle: e.muscle, equipment: e.equipment, video: !!videoFor(e.id), mine: false }))];
}

export function ExercisePicker({ lib, onPick, onClose }: { lib: Library; onPick: (e: Pickable) => void; onClose: () => void }) {
  const [q, setQ] = useState(""); const [m, setM] = useState<(typeof MUSCLES)[number]>("all");
  const all = useMemo(() => allExercises(lib), [lib]);
  const shown = all.filter((e) => (m === "all" || (m === "mine" ? e.mine : e.muscle === m)) && (!q.trim() || e.name.toLowerCase().includes(q.trim().toLowerCase()))).slice(0, 200);
  return <Sheet title="Add exercise" onClose={onClose} testId="tr-picker">
    <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: C.dim }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${all.length} exercises`} className={`${inputCls} pl-10`} style={inputStyle} /></div>
    <div className="mt-3"><Chips label="Muscle" value={m} onChange={setM} items={MUSCLES.map((x) => ({ id: x, label: x === "all" ? "All" : x === "mine" ? "My exercises" : x[0].toUpperCase() + x.slice(1) }))} /></div>
    <ul className="mt-3 space-y-1.5">{shown.map((e) => <li key={e.id}><button type="button" onClick={() => onPick(e)} className="flex w-full items-center gap-3 rounded-[12px] p-3 text-left active:scale-[.99]" style={{ background: C.card }} data-testid={`tr-pick-${e.id}`}>
      <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{e.name}</span><span className="block truncate text-[12px] capitalize" style={{ color: C.dim }}>{e.muscle} · {e.equipment}</span></span>
      {e.video && <PlayCircle className="h-4 w-4 shrink-0" style={{ color: C.lime }} />}<Plus className="h-5 w-5 shrink-0" style={{ color: C.lime }} /></button></li>)}</ul>
  </Sheet>;
}

export function WorkoutBuilder({ initial, lib, title = "Workout", onSave, onClose, extra }: { initial?: PlanWorkout; lib: Library; title?: string; onSave: (w: PlanWorkout) => void; onClose: () => void; extra?: React.ReactNode }) {
  const [w, setW] = useState<PlanWorkout>(initial ?? { id: newId(), name: "", items: [] });
  const [picking, setPicking] = useState(false);
  const setItem = (i: number, p: Partial<PlanItem>) => setW({ ...w, items: w.items.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const move = (i: number, d: number) => { const items = [...w.items]; const j = i + d; if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; setW({ ...w, items }); };
  return <Sheet title={title} onClose={onClose} testId="tr-workout" right={<Btn className="!min-h-10 !px-3 !text-[15px]" disabled={!w.name.trim() || !w.items.length} onClick={() => onSave({ ...w, name: w.name.trim() })} testId="tr-workout-save">Save</Btn>}>
    <input value={w.name} onChange={(e) => setW({ ...w, name: e.target.value.slice(0, 80) })} placeholder="Workout name (e.g. Upper body A)" aria-label="Workout name" className={`${inputCls} mt-1`} style={inputStyle} data-testid="tr-workout-name" />
    <div className="mt-2 grid grid-cols-[1fr_7rem] gap-2">
      <input value={w.note ?? ""} onChange={(e) => setW({ ...w, note: e.target.value.slice(0, 600) })} placeholder="Note to the client (optional)" className={inputCls} style={inputStyle} />
      <input inputMode="numeric" value={w.mins ?? ""} onChange={(e) => setW({ ...w, mins: Number(e.target.value.replace(/\D/g, "")) || undefined })} placeholder="Minutes" className={inputCls} style={inputStyle} />
    </div>
    {extra}
    <div className="mt-4 space-y-2">{w.items.map((it, i) => <Card key={i} className="!p-3">
      <div className="flex items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold" style={{ background: C.lime, color: "#0b0b0c" }}>{i + 1}</span>
        <p className="min-w-0 flex-1 truncate text-[18px] leading-none" style={display}>{it.name}</p>
        <button type="button" aria-label="Move up" onClick={() => move(i, -1)} className="grid h-9 w-9 place-items-center" style={{ color: C.dim }}><ArrowUp className="h-4 w-4" /></button>
        <button type="button" aria-label="Move down" onClick={() => move(i, 1)} className="grid h-9 w-9 place-items-center" style={{ color: C.dim }}><ArrowDown className="h-4 w-4" /></button>
        <button type="button" aria-label="Remove" onClick={() => setW({ ...w, items: w.items.filter((_, k) => k !== i) })} className="grid h-9 w-9 place-items-center" style={{ color: C.dim }}><Trash2 className="h-4 w-4" /></button></div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] uppercase" style={{ color: C.dim }}>
        <label>Sets<input inputMode="numeric" value={it.sets} onChange={(e) => setItem(i, { sets: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} className={`${small} mt-1`} style={inputStyle} /></label>
        <label>Reps / time<input value={it.reps} onChange={(e) => setItem(i, { reps: e.target.value.slice(0, 16) })} placeholder="8-12, 30s" className={`${small} mt-1`} style={inputStyle} /></label>
        <label>Rest (s)<input inputMode="numeric" value={it.rest} onChange={(e) => setItem(i, { rest: Math.max(0, Math.min(900, Number(e.target.value) || 0)) })} className={`${small} mt-1`} style={inputStyle} /></label>
      </div>
      <input value={it.note ?? ""} onChange={(e) => setItem(i, { note: e.target.value.slice(0, 200) })} placeholder="Coaching cue (tempo, weight, RPE…)" className="mt-2 h-10 w-full rounded-[10px] px-3 text-[15px] outline-none" style={inputStyle} />
    </Card>)}</div>
    <Btn kind="soft" className="mt-3 w-full" onClick={() => setPicking(true)} testId="tr-add-exercise"><Plus className="h-5 w-5" />Add exercise</Btn>
    {picking && <ExercisePicker lib={lib} onClose={() => setPicking(false)} onPick={(e) => { setW({ ...w, items: [...w.items, { exId: e.id, name: e.name, sets: 3, reps: e.muscle === "cardio" ? "10 min" : "8-12", rest: 90 }] }); setPicking(false); }} />}
  </Sheet>;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function ProgramBuilder({ initial, lib, onSave, onClose }: { initial?: CoachProgram; lib: Library; onSave: (p: CoachProgram) => void; onClose: () => void }) {
  const [p, setP] = useState<CoachProgram>(initial ?? { id: newId(), name: "", weeks: 4, days: [] });
  const at = (day: number) => p.days.find((d) => d.day === day)?.workoutId ?? "";
  const set = (day: number, workoutId: string) => setP({ ...p, days: [...p.days.filter((d) => d.day !== day), ...(workoutId ? [{ day, workoutId }] : [])].sort((a, b) => a.day - b.day) });
  const copyWeek1 = () => setP({ ...p, days: Array.from({ length: p.weeks }, (_, w) => p.days.filter((d) => d.day < 7).map((d) => ({ day: d.day + w * 7, workoutId: d.workoutId }))).flat() });
  return <Sheet title="Program" onClose={onClose} testId="tr-program" right={<Btn className="!min-h-10 !px-3 !text-[15px]" disabled={!p.name.trim() || !p.days.length} onClick={() => onSave({ ...p, name: p.name.trim() })}>Save</Btn>}>
    {!lib.workouts.length && <p className="mb-3 rounded-[10px] p-3 text-[14px]" style={{ background: C.card2 }}>Build a few workouts in your library first, then lay them out here.</p>}
    <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value.slice(0, 80) })} placeholder="Program name (e.g. 12-week strength)" className={inputCls} style={inputStyle} />
    <div className="mt-2 grid grid-cols-[1fr_8rem] gap-2"><input value={p.note ?? ""} onChange={(e) => setP({ ...p, note: e.target.value.slice(0, 600) })} placeholder="Note" className={inputCls} style={inputStyle} />
      <select value={p.weeks} onChange={(e) => setP({ ...p, weeks: Number(e.target.value), days: p.days.filter((d) => d.day < Number(e.target.value) * 7) })} className={inputCls} style={inputStyle}>{Array.from({ length: 24 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} week{n > 1 ? "s" : ""}</option>)}</select></div>
    {p.weeks > 1 && <Btn kind="soft" className="mt-2 w-full !text-[15px]" onClick={copyWeek1}>Repeat week 1 every week</Btn>}
    {Array.from({ length: p.weeks }, (_, w) => <div key={w}><Title>Week {w + 1}</Title><Card className="!p-2">{DAYS.map((dn, d) => { const day = w * 7 + d; return <div key={d} className="flex items-center gap-2 px-1 py-1">
      <span className="w-10 shrink-0 text-[13px] font-semibold" style={{ color: C.dim }}>Day {d + 1}</span>
      <select value={at(day)} onChange={(e) => set(day, e.target.value)} className="h-10 min-w-0 flex-1 rounded-[8px] px-2 text-[15px] outline-none" style={inputStyle} aria-label={`Week ${w + 1} day ${d + 1}`}>
        <option value="">Rest</option>{lib.workouts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>; })}</Card></div>)}
  </Sheet>;
}

export const DEFAULT_FORM = (): CheckinForm => ({ id: newId(), title: "Weekly check-in", weekday: 0, questions: [
  { id: newId(), q: "How was your week overall? (1 = rough, 10 = great)", kind: "scale" },
  { id: newId(), q: "Current body weight", kind: "number" },
  { id: newId(), q: "How many of your workouts did you finish?", kind: "number" },
  { id: newId(), q: "Energy and sleep (1–10)", kind: "scale" },
  { id: newId(), q: "Did you hit your nutrition targets most days?", kind: "yesno" },
  { id: newId(), q: "Wins, struggles, anything I should know?", kind: "text" },
] });

export function FormBuilder({ initial, onSave, onClose }: { initial?: CheckinForm; onSave: (f: CheckinForm) => void; onClose: () => void }) {
  const [f, setF] = useState<CheckinForm>(initial ?? DEFAULT_FORM());
  const setQ = (i: number, p: Partial<Question>) => setF({ ...f, questions: f.questions.map((q, k) => (k === i ? { ...q, ...p } : q)) });
  return <Sheet title="Check-in form" onClose={onClose} testId="tr-form" right={<Btn className="!min-h-10 !px-3 !text-[15px]" disabled={!f.title.trim() || !f.questions.some((q) => q.q.trim())} onClick={() => onSave({ ...f, questions: f.questions.filter((q) => q.q.trim()) })}>Save</Btn>}>
    <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value.slice(0, 80) })} placeholder="Form title" className={inputCls} style={inputStyle} />
    <Field label="Due every"><select value={f.weekday} onChange={(e) => setF({ ...f, weekday: Number(e.target.value) })} className={`${inputCls} mt-2`} style={inputStyle}>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => <option key={d} value={i}>{d}</option>)}</select></Field>
    <div className="mt-4 space-y-2">{f.questions.map((q, i) => <Card key={q.id} className="!p-3"><div className="flex gap-2">
      <input value={q.q} onChange={(e) => setQ(i, { q: e.target.value.slice(0, 200) })} placeholder="Question" className="h-11 min-w-0 flex-1 rounded-[10px] px-3 text-[16px] outline-none" style={inputStyle} />
      <button type="button" aria-label="Remove question" onClick={() => setF({ ...f, questions: f.questions.filter((_, k) => k !== i) })} className="grid h-11 w-9 place-items-center" style={{ color: C.dim }}><Trash2 className="h-4 w-4" /></button></div>
      <div className="mt-2"><Chips label="Answer type" value={q.kind} onChange={(kind) => setQ(i, { kind })} items={[{ id: "text", label: "Words" }, { id: "scale", label: "1–10" }, { id: "number", label: "Number" }, { id: "yesno", label: "Yes / no" }]} /></div></Card>)}</div>
    <Btn kind="soft" className="mt-3 w-full" onClick={() => setF({ ...f, questions: [...f.questions, { id: newId(), q: "", kind: "text" }] })}><Plus className="h-5 w-5" />Add question</Btn>
  </Sheet>;
}

export function OwnExerciseSheet({ initial, onSave, onClose, onDelete }: { initial?: OwnExercise; onSave: (e: OwnExercise) => void; onClose: () => void; onDelete?: () => void }) {
  const [e, setE] = useState<OwnExercise>(initial ?? { id: `own-${newId()}`, name: "", muscle: "", video: "", cues: "" });
  return <Sheet title={initial ? "Edit exercise" : "New exercise"} onClose={onClose} right={<Btn className="!min-h-10 !px-3 !text-[15px]" disabled={!e.name.trim()} onClick={() => onSave({ ...e, name: e.name.trim() })}>Save</Btn>}>
    <div className="mt-1 space-y-3">
      <Field label="Name"><input value={e.name} onChange={(x) => setE({ ...e, name: x.target.value.slice(0, 80) })} className={inputCls} style={inputStyle} /></Field>
      <Field label="Muscle"><select value={e.muscle} onChange={(x) => setE({ ...e, muscle: x.target.value })} className={inputCls} style={inputStyle}><option value="">Choose</option>{MUSCLES.filter((m) => m !== "all" && m !== "mine").map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
      <Field label="Demo video link (YouTube, Vimeo, Instagram…)"><input value={e.video} onChange={(x) => setE({ ...e, video: x.target.value.slice(0, 300) })} placeholder="https://" className={inputCls} style={inputStyle} /></Field>
      <Field label="How to do it"><textarea value={e.cues} onChange={(x) => setE({ ...e, cues: x.target.value.slice(0, 1200) })} rows={5} className="w-full rounded-[12px] p-3 text-[17px] outline-none" style={inputStyle} /></Field>
    </div>
    {onDelete && <button type="button" onClick={onDelete} className="mt-6 h-12 w-full font-semibold" style={{ color: C.red }}>Delete exercise</button>}
  </Sheet>;
}
