// Habit tracker (a Plugin Store add-on): tap to check off each habit each day, see the week at a
// glance, and grow a streak.
import { useState, type FormEvent } from "react";
import { Check, Flame, Repeat, Trash2 } from "lucide-react";
import { addDaysTo, streak } from "@shared/lifePlugins";
import { MEMBER_COLORS } from "@shared/familyHub";
import { Empty, PageHead, Panel, danger, inputClass, primary, type SectionProps } from "./ui";

const EMOJI = ["💧", "🏃", "📚", "🧘", "🥗", "😴", "🦷", "🙏", "✍️", "🎸", "🚭", "📵"];
const IDEAS = ["Drink 8 glasses of water", "Walk 20 minutes", "Read 10 pages", "No phone after 9pm", "Make the bed", "Floss"];

export default function Habits({ family, setFamily, today, makeId }: SectionProps) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJI[0]);
  const week = Array.from({ length: 7 }, (_, i) => addDaysTo(today, i - 6));
  const toggle = (id: string, d: string) => setFamily((f) => ({ ...f, habits: f.habits.map((h) => (h.id !== id ? h : { ...h, days: h.days.includes(d) ? h.days.filter((x) => x !== d) : [...h.days, d].sort() })) }));
  const add = (e?: FormEvent, n = name) => {
    e?.preventDefault();
    if (!n.trim()) return;
    setFamily((f) => ({ ...f, habits: [...f.habits, { id: makeId(), name: n.trim(), emoji, color: MEMBER_COLORS[f.habits.length % MEMBER_COLORS.length], days: [] }] }));
    setName("");
  };
  const doneToday = family.habits.filter((h) => h.days.includes(today)).length;

  return <div className="space-y-6">
    <PageHead eyebrow="Habits" title="Small steps, every day" blurb="Pick a few habits, tap them off each day, and watch your streaks grow." />
    {family.habits.length > 0 && <div className="rounded-2xl bg-violet-50 p-4"><div className="flex items-center justify-between text-sm font-bold text-violet-900"><span>Today</span><span>{doneToday} of {family.habits.length}</span></div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${(doneToday / family.habits.length) * 100}%` }} /></div></div>}
    {family.habits.length ? <ul className="space-y-3">{family.habits.map((h) => { const s = streak(h.days, today); return <li key={h.id} className="rounded-[1.5rem] border border-[#e7e8f0] bg-white p-4 shadow-[0_8px_28px_#17152b08]">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => toggle(h.id, today)} aria-pressed={h.days.includes(today)} aria-label={`${h.name} today`} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl transition" style={{ background: h.days.includes(today) ? h.color : "#f1f5f9" }}>{h.days.includes(today) ? <Check className="text-white" size={24} /> : h.emoji}</button>
        <span className="min-w-0 flex-1"><span className="block font-extrabold">{h.name}</span><span className="flex items-center gap-1 text-xs font-bold text-orange-600">{s > 0 && <><Flame size={13} />{s} day streak</>}{s === 0 && <span className="text-slate-400">Tap to check off today</span>}</span></span>
        <button type="button" onClick={() => { if (window.confirm(`Delete "${h.name}" and its history?`)) setFamily((f) => ({ ...f, habits: f.habits.filter((x) => x.id !== h.id) })); }} className={danger + " px-2"} aria-label={`Delete ${h.name}`}><Trash2 size={14} /></button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5">{week.map((d) => { const on = h.days.includes(d); return <button key={d} type="button" onClick={() => toggle(h.id, d)} aria-pressed={on} aria-label={`${h.name} on ${d}`} className={`flex flex-col items-center rounded-xl py-1.5 text-[11px] font-bold ${on ? "text-white" : "bg-slate-50 text-slate-400"}`} style={on ? { background: h.color } : undefined}>
        <span>{new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" })}</span><span>{Number(d.slice(8))}</span></button>; })}</div>
    </li>; })}</ul> : <Panel><Empty icon={<Repeat />} title="No habits yet.">Start with one or two. Small and doable beats big and forgotten.</Empty></Panel>}
    <Panel title="Add a habit">
      <form onSubmit={add} className="flex gap-2"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Read 10 pages" className={inputClass} aria-label="Habit" /><button type="submit" className={primary} disabled={!name.trim()}>Add</button></form>
      <div className="mt-3 flex flex-wrap gap-1.5">{EMOJI.map((m) => <button key={m} type="button" onClick={() => setEmoji(m)} aria-pressed={emoji === m} className={`h-10 w-10 rounded-xl text-xl ${emoji === m ? "bg-violet-100 ring-2 ring-violet-400" : "hover:bg-slate-100"}`}>{m}</button>)}</div>
      <div className="mt-3 flex flex-wrap gap-1.5">{IDEAS.filter((i) => !family.habits.some((h) => h.name === i)).map((i) => <button key={i} type="button" onClick={() => add(undefined, i)} className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-violet-50 hover:text-violet-700">+ {i}</button>)}</div>
    </Panel>
  </div>;
}
