// Workout log (a Plugin Store add-on): sets, reps and weight for each exercise, and your best so far.
import { useState, type FormEvent } from "react";
import { Dumbbell, Trash2, Trophy } from "lucide-react";
import type { Workout } from "@shared/familyHub";
import { Empty, PageHead, Panel, danger, inputClass, primary, type SectionProps } from "./ui";

const COMMON = ["Squat", "Bench press", "Deadlift", "Push-ups", "Pull-ups", "Lunges", "Plank (seconds)", "Shoulder press", "Rows", "Bicep curls"];

export default function WorkoutLog({ family, setFamily, today, makeId, say }: SectionProps) {
  const last = family.workouts[family.workouts.length - 1];
  const [exercise, setExercise] = useState("");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<Workout["unit"]>(last?.unit ?? "lb");
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!exercise.trim()) return;
    const w = Math.max(0, Number(weight) || 0);
    const best = Math.max(0, ...family.workouts.filter((x) => x.exercise.toLowerCase() === exercise.trim().toLowerCase() && x.unit === unit).map((x) => x.weight));
    setFamily((f) => ({ ...f, workouts: [...f.workouts, { id: makeId(), date: today, exercise: exercise.trim(), sets, reps, weight: w, unit }] }));
    say(w > best && best > 0 ? `🏆 New best for ${exercise.trim()}: ${w} ${unit}!` : `${exercise.trim()} logged.`);
  };
  const prs = new Map<string, Workout>();
  for (const w of family.workouts) { const k = w.exercise.toLowerCase(); const cur = prs.get(k); if (!cur || w.weight > cur.weight || (w.weight === cur.weight && w.reps > cur.reps)) prs.set(k, w); }
  const byDate = [...new Set(family.workouts.map((w) => w.date))].sort().reverse().slice(0, 20);

  return <div className="space-y-6">
    <PageHead eyebrow="Workout log" title="Get stronger" blurb="Log sets, reps and weight for each exercise. Your personal bests are kept for you." />
    <Panel title="Log an exercise">
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[minmax(0,1.5fr)_5rem_5rem_6rem_5rem_auto]">
        <input value={exercise} onChange={(e) => setExercise(e.target.value)} list="exercises" maxLength={60} placeholder="Exercise" className={inputClass} aria-label="Exercise" />
        <label className="text-[11px] font-bold text-slate-500">Sets<input type="number" min={0} value={sets} onChange={(e) => setSets(Math.max(0, Math.trunc(Number(e.target.value) || 0)))} className={inputClass + " px-2"} /></label>
        <label className="text-[11px] font-bold text-slate-500">Reps<input type="number" min={0} value={reps} onChange={(e) => setReps(Math.max(0, Math.trunc(Number(e.target.value) || 0)))} className={inputClass + " px-2"} /></label>
        <label className="text-[11px] font-bold text-slate-500">Weight<input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" placeholder="0" className={inputClass + " px-2"} /></label>
        <label className="text-[11px] font-bold text-slate-500">Unit<select value={unit} onChange={(e) => setUnit(e.target.value as Workout["unit"])} className={inputClass + " px-2"}><option>lb</option><option>kg</option></select></label>
        <button type="submit" className={primary + " self-end"} disabled={!exercise.trim()}>Log</button>
        <datalist id="exercises">{[...new Set([...family.workouts.map((w) => w.exercise), ...COMMON])].map((x) => <option key={x} value={x} />)}</datalist>
      </form>
    </Panel>
    {prs.size > 0 && <Panel title="Personal bests"><ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[...prs.values()].map((w) => <li key={w.id} className="flex items-center gap-3 rounded-2xl bg-amber-50 p-3"><Trophy size={18} className="shrink-0 text-amber-500" /><span className="min-w-0"><span className="block truncate text-sm font-extrabold">{w.exercise}</span><span className="text-xs font-bold text-amber-800">{w.weight ? `${w.weight} ${w.unit} × ${w.reps}` : `${w.reps} reps`}</span></span></li>)}</ul></Panel>}
    <Panel title="History">
      {byDate.length ? <div className="space-y-4">{byDate.map((d) => <div key={d}><p className="mb-1 text-xs font-black uppercase tracking-wide text-slate-400">{d === today ? "Today" : new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p>
        <ul className="divide-y divide-slate-100">{family.workouts.filter((w) => w.date === d).map((w) => <li key={w.id} className="flex items-center gap-3 py-2 text-sm"><span className="flex-1 font-bold">{w.exercise}</span><span className="text-slate-500">{w.sets} × {w.reps}{w.weight ? ` @ ${w.weight} ${w.unit}` : ""}</span>
          <button type="button" onClick={() => setFamily((f) => ({ ...f, workouts: f.workouts.filter((x) => x.id !== w.id) }))} className={danger + " px-2"} aria-label="Delete"><Trash2 size={13} /></button></li>)}</ul></div>)}</div>
        : <Empty icon={<Dumbbell />} title="No workouts yet.">Log your first exercise above.</Empty>}
    </Panel>
  </div>;
}
