// Birthdays (a Plugin Store add-on): birthdays and anniversaries that come round every year,
// soonest first, with how old someone is turning.
import { useState, type FormEvent } from "react";
import { Cake, Trash2 } from "lucide-react";
import { nextYearly } from "@shared/lifePlugins";
import type { Birthday } from "@shared/familyHub";
import { Empty, PageHead, Panel, danger, inputClass, primary, type SectionProps } from "./ui";

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(undefined, { month: "long" }));
const ICON: Record<Birthday["kind"], string> = { birthday: "🎂", anniversary: "💍", other: "⭐" };
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;

export default function Birthdays({ family, setFamily, today, makeId, say }: SectionProps) {
  const [name, setName] = useState("");
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [day, setDay] = useState(1);
  const [year, setYear] = useState("");
  const [kind, setKind] = useState<Birthday["kind"]>("birthday");

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const y = Number(year);
    setFamily((f) => ({ ...f, birthdays: [...f.birthdays, { id: makeId(), name: name.trim(), month, day, year: y >= 1900 && y <= 2200 ? y : 0, kind }] }));
    say(`${name.trim()} added.`);
    setName(""); setYear("");
  };
  const list = family.birthdays.map((b) => ({ ...b, ...nextYearly(b.month, b.day, b.year, today) })).sort((a, b) => a.days - b.days);
  const soon = list.filter((b) => b.days <= 30);

  return <div className="space-y-6">
    <PageHead eyebrow="Birthdays" title="Never miss a big day" blurb="Birthdays and anniversaries, soonest first, with how old everyone's turning." />
    {soon.length > 0 && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{soon.map((b) => <div key={b.id} className="rounded-[1.5rem] bg-gradient-to-br from-pink-50 to-amber-50 p-5 ring-1 ring-pink-100">
      <p className="text-3xl" aria-hidden>{ICON[b.kind]}</p>
      <p className="mt-2 text-lg font-black">{b.name}</p>
      <p className="text-sm font-bold text-pink-700">{b.days === 0 ? "Today! 🎉" : b.days === 1 ? "Tomorrow" : `In ${b.days} days`}{b.turns != null && b.turns > 0 ? ` · ${b.kind === "birthday" ? `turns ${b.turns}` : `${ord(b.turns)} anniversary`}` : ""}</p>
    </div>)}</div>}
    <Panel title="Add a date">
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_5rem_6rem_auto]">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Name (Grandma, Maya & Leo)" className={inputClass} aria-label="Name" />
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={inputClass} aria-label="Month">{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
        <select value={day} onChange={(e) => setDay(Number(e.target.value))} className={inputClass} aria-label="Day">{Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
        <input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="Year?" className={inputClass} aria-label="Year (optional)" />
        <button type="submit" className={primary} disabled={!name.trim()}>Add</button>
      </form>
      <div className="mt-3 flex gap-1.5">{(["birthday", "anniversary", "other"] as const).map((k) => <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={`min-h-9 rounded-full px-3 text-xs font-bold capitalize ${kind === k ? "bg-[#292446] text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>{ICON[k]} {k}</button>)}</div>
    </Panel>
    <Panel title={`All dates · ${list.length}`}>
      {list.length ? <ul className="divide-y divide-slate-100">{list.map((b) => <li key={b.id} className="flex items-center gap-3 py-2.5">
        <span className="text-xl" aria-hidden>{ICON[b.kind]}</span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">{b.name}</span><span className="block text-xs text-slate-500">{MONTHS[b.month - 1]} {b.day}{b.year ? `, ${b.year}` : ""}</span></span>
        <span className="text-xs font-bold text-slate-500">{b.days === 0 ? "Today" : `${b.days}d`}</span>
        <button type="button" onClick={() => setFamily((f) => ({ ...f, birthdays: f.birthdays.filter((x) => x.id !== b.id) }))} className={danger + " px-2"} aria-label={`Delete ${b.name}`}><Trash2 size={14} /></button>
      </li>)}</ul> : <Empty icon={<Cake />} title="No dates yet.">Add the birthdays you never want to forget.</Empty>}
    </Panel>
  </div>;
}
