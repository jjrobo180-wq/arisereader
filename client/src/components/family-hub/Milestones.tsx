// Milestones (a Plugin Store add-on): first steps, first words, first day of school. A timeline of
// the moments you never want to forget.
import { useState, type FormEvent } from "react";
import { Star, Trash2 } from "lucide-react";
import { Empty, PageHead, Panel, danger, inputClass, primary, type SectionProps } from "./ui";

const IDEAS = ["First smile", "First word", "First steps", "First tooth", "First day of school", "Learned to ride a bike", "Lost first tooth", "Learned to swim", "First sleepover", "Learned to read"];

export default function Milestones({ family, setFamily, today, makeId, say }: SectionProps) {
  const people = [...new Set([...family.members.map((m) => m.name), ...family.milestones.map((m) => m.who).filter(Boolean)])];
  const [who, setWho] = useState(people[0] || "");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("");
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setFamily((f) => ({ ...f, milestones: [...f.milestones, { id: makeId(), who: who.trim(), title: title.trim(), date, note: note.trim() }] }));
    say("Saved to the timeline. ⭐");
    setTitle(""); setNote("");
  };
  const list = [...family.milestones].filter((m) => !filter || m.who === filter).sort((a, b) => b.date.localeCompare(a.date));
  const years = [...new Set(list.map((m) => m.date.slice(0, 4)))];

  return <div className="space-y-6">
    <PageHead eyebrow="Milestones" title="The moments that matter" blurb="First words, first steps, first day of school. A timeline of the big little moments." />
    <Panel title="Add a milestone">
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_10rem]">
        <input value={who} onChange={(e) => setWho(e.target.value)} list="milestone-people" maxLength={60} placeholder="Who" className={inputClass} aria-label="Who" />
        <input value={title} onChange={(e) => setTitle(e.target.value)} list="milestone-ideas" maxLength={120} placeholder="What happened" className={inputClass} aria-label="What happened" />
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} className={inputClass} aria-label="When" />
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} placeholder="The story (optional)" className={inputClass + " py-2 sm:col-span-3"} aria-label="The story" />
        <button type="submit" className={primary + " sm:col-span-3"} disabled={!title.trim()}><Star size={16} />Save milestone</button>
        <datalist id="milestone-people">{people.map((p) => <option key={p} value={p} />)}</datalist>
        <datalist id="milestone-ideas">{IDEAS.map((i) => <option key={i} value={i} />)}</datalist>
      </form>
    </Panel>
    {people.length > 1 && <div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => setFilter("")} aria-pressed={!filter} className={`min-h-9 rounded-full px-3 text-xs font-bold ${!filter ? "bg-[#292446] text-white" : "bg-white ring-1 ring-slate-200"}`}>Everyone</button>{people.map((p) => <button key={p} type="button" onClick={() => setFilter(p)} aria-pressed={filter === p} className={`min-h-9 rounded-full px-3 text-xs font-bold ${filter === p ? "bg-[#292446] text-white" : "bg-white ring-1 ring-slate-200"}`}>{p}</button>)}</div>}
    {list.length ? years.map((y) => <Panel key={y} title={y}>
      <ol className="relative space-y-5 border-l-2 border-amber-200 pl-6">{list.filter((m) => m.date.startsWith(y)).map((m) => <li key={m.id} className="relative">
        <span className="absolute -left-[33px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-white"><Star size={11} className="fill-current" /></span>
        <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="font-extrabold">{m.title}{m.who && <span className="font-bold text-amber-700"> · {m.who}</span>}</p><p className="text-xs text-slate-400">{new Date(`${m.date}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</p>{m.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{m.note}</p>}</div>
          <button type="button" onClick={() => { if (window.confirm("Delete this milestone?")) setFamily((f) => ({ ...f, milestones: f.milestones.filter((x) => x.id !== m.id) })); }} className={danger + " px-2"} aria-label="Delete"><Trash2 size={13} /></button></div>
      </li>)}</ol>
    </Panel>) : <Panel><Empty icon={<Star />} title="No milestones yet.">Add the first big moment above.</Empty></Panel>}
  </div>;
}
