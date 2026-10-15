// Sleep log (a Plugin Store add-on): bedtime, wake time and how it felt, with the last two weeks
// as a bar chart and a weekly average.
import { useState, type FormEvent } from "react";
import { Moon, Trash2 } from "lucide-react";
import { addDaysTo, sleepHours } from "@shared/lifePlugins";
import { Empty, PageHead, Panel, danger, inputClass, primary, type SectionProps } from "./ui";

const FACES = ["😫", "😕", "😐", "🙂", "😄"];

export default function SleepLog({ family, setFamily, today, makeId, say }: SectionProps) {
  const [date, setDate] = useState(today);
  const [bed, setBed] = useState("22:30");
  const [wake, setWake] = useState("06:30");
  const [quality, setQuality] = useState(4);
  const add = (e: FormEvent) => {
    e.preventDefault();
    setFamily((f) => ({ ...f, sleep: [...f.sleep.filter((s) => s.date !== date), { id: makeId(), date, bed, wake, quality }].sort((a, b) => a.date.localeCompare(b.date)) }));
    say(`Logged ${sleepHours(bed, wake)} hours.`);
  };
  const days = Array.from({ length: 14 }, (_, i) => addDaysTo(today, i - 13));
  const byDay = new Map(family.sleep.map((s) => [s.date, s]));
  const week = family.sleep.filter((s) => s.date > addDaysTo(today, -7));
  const avg = week.length ? week.reduce((t, s) => t + sleepHours(s.bed, s.wake), 0) / week.length : 0;
  const max = 12;

  return <div className="space-y-6">
    <PageHead eyebrow="Sleep log" title="How you're sleeping" blurb="Log when you went to bed and woke up. Most adults do best with 7 to 9 hours." />
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Panel title="Last 2 weeks" right={avg ? <span className="text-sm font-black text-indigo-700">Avg {avg.toFixed(1)} h this week</span> : undefined}>
        <div className="flex h-48 items-end gap-1.5" role="img" aria-label="Hours slept each night for two weeks">
          {days.map((d) => { const s = byDay.get(d); const h = s ? sleepHours(s.bed, s.wake) : 0; return <div key={d} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-bold text-slate-500">{h ? h : ""}</span>
            <div className="w-full rounded-t-md" style={{ height: `${(h / max) * 150}px`, background: !h ? "transparent" : h < 6 ? "#f87171" : h < 7 ? "#fbbf24" : "#818cf8" }} />
            <span className="text-[10px] font-bold text-slate-400">{new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" })}</span>
          </div>; })}
        </div>
        <p className="mt-3 flex gap-4 text-[11px] font-bold text-slate-500"><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-indigo-400" />7+ h</span><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />6–7 h</span><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-400" />under 6 h</span></p>
      </Panel>
      <Panel title="Log a night">
        <form onSubmit={add} className="space-y-3">
          <label className="block text-xs font-bold text-slate-500">Woke up on<input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} className={inputClass + " mt-1"} /></label>
          <div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold text-slate-500">Bedtime<input type="time" value={bed} onChange={(e) => setBed(e.target.value)} className={inputClass + " mt-1"} required /></label><label className="text-xs font-bold text-slate-500">Woke up<input type="time" value={wake} onChange={(e) => setWake(e.target.value)} className={inputClass + " mt-1"} required /></label></div>
          <div><p className="text-xs font-bold text-slate-500">How did you sleep?</p><div className="mt-1 flex gap-1">{FACES.map((f, i) => <button key={f} type="button" onClick={() => setQuality(i + 1)} aria-pressed={quality === i + 1} className={`h-10 w-10 rounded-xl text-xl ${quality === i + 1 ? "bg-indigo-100 ring-2 ring-indigo-400" : "hover:bg-slate-100"}`}>{f}</button>)}</div></div>
          <p className="text-sm font-bold text-indigo-700">{bed && wake ? `${sleepHours(bed, wake)} hours` : ""}</p>
          <button type="submit" className={primary + " w-full"} disabled={!bed || !wake}>Save</button>
        </form>
      </Panel>
    </div>
    <Panel title="Recent nights" collapseKey="sleep-recent">
      {family.sleep.length ? <ul className="divide-y divide-slate-100">{[...family.sleep].reverse().slice(0, 30).map((s) => <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
        <span className="w-28 font-bold">{new Date(`${s.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
        <span className="flex-1 text-slate-500">{s.bed} → {s.wake}</span><span className="font-black">{sleepHours(s.bed, s.wake)} h</span><span aria-label={`Quality ${s.quality} of 5`}>{FACES[s.quality - 1] || ""}</span>
        <button type="button" onClick={() => setFamily((f) => ({ ...f, sleep: f.sleep.filter((x) => x.id !== s.id) }))} className={danger + " px-2"} aria-label="Delete"><Trash2 size={13} /></button>
      </li>)}</ul> : <Empty icon={<Moon />} title="No nights logged yet.">Log last night to get started.</Empty>}
    </Panel>
  </div>;
}
