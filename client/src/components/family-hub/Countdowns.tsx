// Countdowns (a Plugin Store add-on): days until birthdays, trips, holidays and anything else.
import { useState, type FormEvent } from "react";
import { Hourglass, Trash2 } from "lucide-react";
import { daysUntil } from "@shared/lifePlugins";
import { MEMBER_COLORS } from "@shared/familyHub";
import { Empty, PageHead, Panel, danger, inputClass, primary, type SectionProps } from "./ui";

const EMOJI = ["🎉", "🎂", "✈️", "🎄", "🏖️", "🎓", "💍", "🏈", "🎃", "❤️", "🏠", "⭐"];
const nice = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" });

export default function Countdowns({ family, setFamily, today, makeId, say }: SectionProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [emoji, setEmoji] = useState(EMOJI[0]);

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    const color = MEMBER_COLORS[family.countdowns.length % MEMBER_COLORS.length];
    setFamily((f) => ({ ...f, countdowns: [...f.countdowns, { id: makeId(), title: title.trim(), date, emoji, color }] }));
    say(`Counting down to ${title.trim()}.`);
    setTitle(""); setDate("");
  };
  const remove = (id: string) => setFamily((f) => ({ ...f, countdowns: f.countdowns.filter((c) => c.id !== id) }));

  const sorted = [...family.countdowns].map((c) => ({ ...c, left: daysUntil(c.date, today) })).sort((a, b) => a.left - b.left);
  const coming = sorted.filter((c) => c.left >= 0), past = sorted.filter((c) => c.left < 0).reverse();

  return <div className="space-y-6">
    <PageHead eyebrow="Countdowns" title="Something to look forward to" blurb="Birthdays, trips, holidays, the last day of school: see exactly how many days are left." />
    <Panel title="Add a countdown">
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="What are you counting down to?" className={inputClass} aria-label="Countdown name" required />
        <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className={inputClass} aria-label="Date" required />
        <button type="submit" className={primary} disabled={!title.trim() || !date}>Add</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Pick an emoji">
        {EMOJI.map((m) => <button key={m} type="button" onClick={() => setEmoji(m)} aria-pressed={emoji === m} className={`h-10 w-10 rounded-xl text-xl ${emoji === m ? "bg-violet-100 ring-2 ring-violet-400" : "hover:bg-slate-100"}`}>{m}</button>)}
      </div>
    </Panel>
    {coming.length ? <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{coming.map((c) => <li key={c.id} className="relative overflow-hidden rounded-[1.5rem] border border-[#e7e8f0] bg-white p-5 shadow-[0_8px_28px_#17152b08]">
      <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: c.color }} />
      <div className="flex items-start justify-between gap-3">
        <span className="text-3xl" aria-hidden>{c.emoji}</span>
        <button type="button" onClick={() => remove(c.id)} className={danger + " px-2"} aria-label={`Delete ${c.title}`}><Trash2 size={15} /></button>
      </div>
      <p className="mt-3 text-5xl font-black tabular-nums tracking-tight" style={{ color: c.color }}>{c.left === 0 ? "Today!" : c.left}</p>
      {c.left > 0 && <p className="text-sm font-bold text-slate-500">{c.left === 1 ? "day to go" : "days to go"}{c.left >= 14 ? ` · ${Math.floor(c.left / 7)} weeks` : ""}</p>}
      <p className="mt-3 font-extrabold text-[#232139]">{c.title}</p>
      <p className="text-xs text-slate-500">{nice(c.date)}</p>
    </li>)}</ul> : <Panel><Empty icon={<Hourglass />} title="Nothing to count down to yet.">Add a birthday, a trip or a holiday above.</Empty></Panel>}
    {past.length > 0 && <Panel title="Already happened" collapseKey="countdowns-past">
      <ul className="divide-y divide-slate-100">{past.map((c) => <li key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
        <span aria-hidden>{c.emoji}</span><span className="min-w-0 flex-1 truncate font-semibold">{c.title}</span><span className="text-xs text-slate-400">{nice(c.date)}</span>
        <button type="button" onClick={() => remove(c.id)} className={danger + " px-2"} aria-label={`Delete ${c.title}`}><Trash2 size={14} /></button>
      </li>)}</ul>
    </Panel>}
  </div>;
}
