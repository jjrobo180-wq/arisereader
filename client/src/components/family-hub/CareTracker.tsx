// Home upkeep, Plant care, Car care and Pet care (Plugin Store add-ons): things that need doing
// every so often. Each shows when it's due, and checking it off starts the clock again.
import { useState, type FormEvent } from "react";
import { Car, Check, Flower2, Home, PawPrint, Sparkles, Stethoscope, Trash2 } from "lucide-react";
import { CARE_PRESETS, careDue } from "@shared/lifePlugins";
import type { CareItem, CareKind } from "@shared/familyHub";
import { Empty, PageHead, Panel, danger, inputClass, plain, primary, type SectionProps } from "./ui";

const CONFIG: Record<CareKind, { eyebrow: string; title: string; blurb: string; group: string; groupHint: string; icon: typeof Home }> = {
  upkeep: { eyebrow: "Home upkeep", title: "Keep the house happy", blurb: "Filters, alarms, gutters and the rest. See what's due and check it off when it's done.", group: "Room or area", groupHint: "Kitchen, garage… (optional)", icon: Home },
  plants: { eyebrow: "Plant care", title: "Happy plants", blurb: "Never forget to water again. Each plant gets its own schedule.", group: "Plant", groupHint: "Monstera, basil, the fern…", icon: Flower2 },
  car: { eyebrow: "Car care", title: "Keep it running", blurb: "Oil changes, tires, registration and more for every car in the family.", group: "Car", groupHint: "Honda, Mom's car…", icon: Car },
  cleaning: { eyebrow: "Cleaning schedule", title: "A tidy house, a little at a time", blurb: "Spread the cleaning out: each job by room, on its own schedule. See what's due today.", group: "Room", groupHint: "Kitchen, bathroom…", icon: Sparkles },
  checkups: { eyebrow: "Health checkups", title: "Stay on top of checkups", blurb: "Physicals, dentist, eye exams and shots for everyone in the family. See who's due.", group: "Person", groupHint: "Maya, Dad…", icon: Stethoscope },
  pets: { eyebrow: "Pet care", title: "Happy, healthy pets", blurb: "Medicine, vet visits, grooming and food for every pet.", group: "Pet", groupHint: "Biscuit, Luna…", icon: PawPrint },
};
const nice = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function CareTracker({ kind, family, setFamily, today, makeId, say }: SectionProps & { kind: CareKind }) {
  const c = CONFIG[kind], Icon = c.icon;
  const [group, setGroup] = useState("");
  const [name, setName] = useState("");
  const [every, setEvery] = useState(30);
  const items = family.care.filter((i) => i.kind === kind);
  const set = (update: (all: CareItem[]) => CareItem[]) => setFamily((f) => ({ ...f, care: update(f.care) }));

  const add = (e?: FormEvent, preset?: { name: string; everyDays: number }) => {
    e?.preventDefault();
    const n = (preset?.name ?? name).trim();
    if (!n) return;
    if (kind !== "upkeep" && !group.trim()) { say(`Type the ${c.group.toLowerCase()} first.`); return; }
    set((all) => [...all, { id: makeId(), kind, group: group.trim(), name: n, everyDays: preset?.everyDays ?? every, lastDone: "", notes: "" }]);
    if (!preset) setName("");
  };
  const done = (id: string) => { set((all) => all.map((i) => (i.id === id ? { ...i, lastDone: today } : i))); say("Checked off. The clock starts again."); };

  const withDue = items.map((i) => ({ ...i, ...careDue(i, today) })).sort((a, b) => a.days - b.days);
  const groups = [...new Set(withDue.map((i) => i.group))];
  const overdue = withDue.filter((i) => i.days <= 0).length;

  return <div className="space-y-6">
    <PageHead eyebrow={c.eyebrow} title={c.title} blurb={c.blurb} />
    {items.length > 0 && <p className={`rounded-2xl p-4 text-sm font-bold ${overdue ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}>{overdue ? `${overdue} thing${overdue === 1 ? " is" : "s are"} due now.` : "All caught up. Nice work!"}</p>}
    <Panel title="Add something">
      <form onSubmit={add} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem_auto]">
        <input value={group} onChange={(e) => setGroup(e.target.value)} maxLength={60} placeholder={c.groupHint} className={inputClass} aria-label={c.group} />
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="What needs doing" className={inputClass} aria-label="What needs doing" />
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500">Every<input type="number" min={1} max={3650} value={every} onChange={(e) => setEvery(Math.max(1, Math.min(3650, Math.trunc(Number(e.target.value) || 1))))} className={inputClass + " w-16 px-2"} aria-label="Every how many days" />days</label>
        <button type="submit" className={primary} disabled={!name.trim()}>Add</button>
      </form>
      <p className="mb-1.5 mt-4 text-xs font-bold text-slate-500">Quick add{kind !== "upkeep" ? ` (for the ${c.group.toLowerCase()} above)` : ""}</p>
      <div className="flex flex-wrap gap-1.5">{CARE_PRESETS[kind].map((p) => <button key={p.name} type="button" onClick={() => add(undefined, p)} className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-violet-50 hover:text-violet-700">+ {p.name} · {p.everyDays}d</button>)}</div>
    </Panel>
    {items.length ? groups.map((g) => <Panel key={g || "_"} title={g || "Around the house"}>
      <ul className="divide-y divide-slate-100">{withDue.filter((i) => i.group === g).map((i) => <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
        <button type="button" onClick={() => done(i.id)} aria-label={`Done: ${i.name}`} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 transition ${i.days <= 0 ? "border-amber-400 text-amber-500 hover:bg-amber-50" : "border-slate-200 text-slate-300 hover:border-emerald-400 hover:text-emerald-500"}`}><Check size={17} /></button>
        <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">{i.name}</span><span className="block text-xs text-slate-500">Every {i.everyDays} day{i.everyDays === 1 ? "" : "s"}{i.lastDone ? ` · last done ${nice(i.lastDone)}` : " · never done yet"}</span></span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${!i.lastDone ? "bg-slate-100 text-slate-500" : i.days < 0 ? "bg-rose-50 text-rose-600" : i.days === 0 ? "bg-amber-50 text-amber-700" : i.days <= 7 ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700"}`}>
          {!i.lastDone ? "Due now" : i.days < 0 ? `${-i.days} day${i.days === -1 ? "" : "s"} late` : i.days === 0 ? "Due today" : `In ${i.days} day${i.days === 1 ? "" : "s"}`}</span>
        <button type="button" onClick={() => set((all) => all.filter((x) => x.id !== i.id))} className={danger + " px-2"} aria-label={`Delete ${i.name}`}><Trash2 size={14} /></button>
      </li>)}</ul>
    </Panel>) : <Panel><Empty icon={<Icon />} title="Nothing here yet.">Add your own above, or tap a quick add.</Empty></Panel>}
    {kind === "checkups" && items.length > 0 && <p className="text-xs text-slate-500">Your doctor knows best: change the days to match what they recommend for each person.</p>}
    {kind === "car" && items.length > 0 && <p className="text-xs text-slate-500">Tip: your car's manual has the exact service schedule. Edit the days to match it.</p>}
    {items.some((i) => i.lastDone) && <button type="button" onClick={() => { if (window.confirm("Clear the 'last done' date on everything here?")) set((all) => all.map((i) => (i.kind === kind ? { ...i, lastDone: "" } : i))); }} className={plain + " text-xs"}>Reset all dates</button>}
  </div>;
}
