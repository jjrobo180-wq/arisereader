// Pill reminders: each person's medicines and vitamins with their dose times and days, today's doses
// to check off (or skip), the last week at a glance, and a supply count that warns before it runs out.
// Phone reminders come from LifeHub's notifications at each dose time.
import { useMemo, useState, type FormEvent } from "react";
import { Bell, Check, ChevronLeft, ChevronRight, Clock3, Pencil, Pill as PillIcon, Plus, RotateCcw, SkipForward, Trash2, TriangleAlert, X } from "lucide-react";
import { PILL_COLORS, addDays, type Pill } from "@shared/familyHub";
import { adherence, daysOfSupply, dosesOn, markDose, needsRefill } from "@shared/pills";
import { trackerPeople } from "@shared/familyHealth";
import { useAuth } from "@/context/AuthContext";
import { Empty, Label, Modal, PageHead, Panel, clock12, confirmed, danger, inputClass, plain, primary, shortDate, soft, type SectionProps } from "./ui";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const nowClock = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export default function Pills({ family, setFamily, today, makeId, say }: SectionProps) {
  const { user } = useAuth();
  const people = trackerPeople(family, (user?.displayName || "").split(" ")[0]);
  const [who, setWho] = useState<string>("all");
  const [date, setDate] = useState(today);
  const [editing, setEditing] = useState<Pill | null>(null);
  const name = (id: string) => people.find((m) => m.id === id)?.name || "";
  const memberFilter = who === "all" ? undefined : who;
  const doses = dosesOn(family, date, memberFilter);
  const pills = family.pills.filter((p) => !memberFilter || p.memberId === memberFilter);
  const now = nowClock();
  const takenToday = doses.filter((d) => d.status === "taken").length;
  const low = family.pills.filter(needsRefill);
  const notifyOn = family.notify.pills.on;

  const mark = (pillId: string, time: string, status: "taken" | "skipped" | null) => setFamily((f) => markDose(f, pillId, date, time, status, new Date().toISOString()));
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)), [today]);

  const newPill = (): Pill => ({ id: makeId(), memberId: memberFilter || people[0]?.id || "me", name: "", dose: "", times: ["08:00"], days: [0, 1, 2, 3, 4, 5, 6], start: today, end: "", supply: null, perDose: 1, refillAt: 7, notes: "", color: PILL_COLORS[family.pills.length % PILL_COLORS.length], active: true });

  return <div className="space-y-6">
    <PageHead eyebrow="Pills" title="Pill reminders" blurb="Medicines and vitamins for everyone in the family, with a reminder at each dose time and a heads-up before they run out."
      action={<button type="button" onClick={() => setEditing(newPill())} className={primary + " min-h-11"}><Plus size={16} /> Add a pill</button>} />

    {people.length > 1 && <div className="flex flex-wrap gap-2" role="group" aria-label="Whose pills">
      <button type="button" onClick={() => setWho("all")} aria-pressed={who === "all"} className={`min-h-10 rounded-xl px-3 text-xs font-bold ring-1 ${who === "all" ? "bg-slate-800 text-white ring-slate-800" : "bg-white text-slate-500 ring-slate-200"}`}>Everyone</button>
      {people.map((m) => <button key={m.id} type="button" onClick={() => setWho(m.id)} aria-pressed={who === m.id} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-2.5 pr-3 text-xs font-bold text-slate-600 ring-1 ring-slate-200"
        style={who === m.id ? { background: m.color, color: "#fff", boxShadow: `0 0 0 1px ${m.color}` } : undefined}><span className="text-base leading-none">{m.emoji || "🙂"}</span>{m.name}</button>)}
    </div>}

    {!notifyOn && family.pills.length > 0 && <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><Bell size={18} /><span className="min-w-0 flex-1">Pill reminders are off, so your phone won't remind you at dose times.</span><button type="button" className={soft} onClick={() => { setFamily((f) => ({ ...f, notify: { ...f.notify, pills: { ...f.notify.pills, on: true } } })); say("Pill reminders are on"); }}>Turn them on</button></div>}
    {low.length > 0 && <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><TriangleAlert size={18} className="mt-0.5 shrink-0" /><span>Running low: {low.map((p) => `${p.name} (${p.supply} left${name(p.memberId) ? `, ${name(p.memberId)}` : ""})`).join(", ")}. Time to refill.</span></div>}

    {!family.pills.length ? <Panel><Empty icon={<PillIcon size={26} />} title="No pills yet" action={<button type="button" onClick={() => setEditing(newPill())} className={primary}><Plus size={16} /> Add a pill</button>}>
      Add a medicine or vitamin with its dose times. You'll get a reminder on your phone at each time, and you can check it off here.
    </Empty></Panel> : <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Panel eyebrow={date === today ? "Today" : shortDate(date)} title={doses.length ? `${takenToday} of ${doses.length} taken` : "No doses this day"}
        right={<><button type="button" onClick={() => setDate(addDays(date, -1))} className={plain} aria-label="Previous day"><ChevronLeft size={17} /></button><button type="button" onClick={() => setDate(today)} className={plain}>Today</button><button type="button" onClick={() => setDate(addDays(date, 1))} disabled={date >= today} className={plain} aria-label="Next day"><ChevronRight size={17} /></button></>}>
        {doses.length ? <ul className="space-y-2">{doses.map((d) => {
          const late = date === today && !d.status && d.time < now;
          return <li key={d.id} className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 ${d.status === "taken" ? "border-emerald-200 bg-emerald-50" : d.status === "skipped" ? "border-slate-200 bg-slate-50" : late ? "border-amber-200 bg-amber-50" : "border-[#ececf3] bg-white"}`}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: d.pill.color }}><PillIcon size={18} /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-800">{d.pill.name}{d.pill.dose ? <span className="font-semibold text-slate-500"> · {d.pill.dose}</span> : null}</span>
              <span className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500"><Clock3 size={12} /> {clock12(d.time)}{name(d.pill.memberId) && who === "all" ? ` · ${name(d.pill.memberId)}` : ""}{d.status === "taken" ? ` · taken ${d.at ? new Date(d.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}` : d.status === "skipped" ? " · skipped" : late ? " · not taken yet" : ""}</span></span>
            {d.status ? <button type="button" className={plain} onClick={() => mark(d.pill.id, d.time, null)} aria-label={`Undo ${d.pill.name} at ${clock12(d.time)}`}><RotateCcw size={15} /> Undo</button>
              : <span className="flex gap-1.5"><button type="button" className={primary} onClick={() => { mark(d.pill.id, d.time, "taken"); say(`${d.pill.name} taken`); }}><Check size={16} /> Taken</button><button type="button" className={plain} onClick={() => mark(d.pill.id, d.time, "skipped")} aria-label={`Skip ${d.pill.name} at ${clock12(d.time)}`}><SkipForward size={15} /></button></span>}
          </li>;
        })}</ul> : <p className="text-sm text-slate-500">Nothing is scheduled{date === today ? " today" : " on this day"}.</p>}
      </Panel>

      <div className="space-y-6">
        <Panel eyebrow="Medicines" title={`${pills.length} pill${pills.length === 1 ? "" : "s"}`}>
          <ul className="space-y-3">{pills.map((p) => {
            const a = adherence(family, p, today, 7, now), left = daysOfSupply(p);
            return <li key={p.id} className={`rounded-2xl border border-[#ececf3] p-3 ${p.active ? "" : "opacity-60"}`}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} />
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-800">{p.name}{!p.active ? " (paused)" : ""}</span>
                  <span className="block text-xs text-slate-500">{[p.dose, p.times.map(clock12).join(", "), p.days.length === 7 ? "every day" : p.days.map((d) => DAY_NAMES[d].slice(0, 3)).join(" "), who === "all" ? name(p.memberId) : ""].filter(Boolean).join(" · ")}</span>
                  {p.supply !== null && <span className={`mt-1 block text-xs font-semibold ${needsRefill(p) ? "text-rose-600" : "text-slate-500"}`}>{p.supply} left{left !== null ? ` · about ${left} day${left === 1 ? "" : "s"}` : ""}</span>}</span>
                <button type="button" onClick={() => setEditing({ ...p })} className="rounded-lg p-2 text-slate-400 hover:bg-violet-50 hover:text-violet-700" aria-label={`Edit ${p.name}`}><Pencil size={15} /></button>
              </div>
              <div className="mt-2 flex items-center gap-1" aria-label={`Last 7 days: ${a.taken} of ${a.due} taken`}>{week.map((d) => {
                const day = dosesOn({ pills: [p], pillDoses: family.pillDoses }, d);
                const done = day.filter((x) => x.status === "taken").length;
                const tone = !day.length ? "bg-slate-100" : done === day.length ? "bg-emerald-500" : done ? "bg-emerald-300" : d === today ? "bg-slate-200" : "bg-rose-300";
                return <span key={d} title={`${shortDate(d)}: ${done} of ${day.length}`} className={`h-2 flex-1 rounded-full ${tone}`} />;
              })}<span className="ml-2 text-[11px] font-bold text-slate-500">{a.due ? `${Math.round((a.taken / a.due) * 100)}%` : "–"}</span></div>
            </li>;
          })}</ul>
        </Panel>
        <p className="rounded-2xl bg-slate-50 p-4 text-[11px] leading-5 text-slate-500">Reminders help you remember; they don't replace your doctor's or pharmacist's directions. Change reminder settings in Notifications.</p>
      </div>
    </div>}

    {editing && <PillEditor pill={editing} people={people} isNew={!family.pills.some((p) => p.id === editing.id)} onClose={() => setEditing(null)}
      onSave={(p) => { setFamily((f) => ({ ...f, pills: f.pills.some((x) => x.id === p.id) ? f.pills.map((x) => (x.id === p.id ? p : x)) : [...f.pills, p] })); setEditing(null); say(`${p.name} saved`); }}
      onDelete={(p) => { if (!confirmed(`Delete ${p.name} and its history?`)) return; setFamily((f) => ({ ...f, pills: f.pills.filter((x) => x.id !== p.id), pillDoses: f.pillDoses.filter((d) => d.pillId !== p.id) })); setEditing(null); say(`${p.name} deleted`); }} />}
  </div>;
}

function PillEditor({ pill, people, isNew, onClose, onSave, onDelete }: { pill: Pill; people: { id: string; name: string; emoji: string; color: string }[]; isNew: boolean; onClose: () => void; onSave: (p: Pill) => void; onDelete: (p: Pill) => void }) {
  const [p, setP] = useState<Pill>(pill);
  const [error, setError] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!p.name.trim()) { setError("Give it a name."); return; }
    if (!p.times.length) { setError("Add at least one time."); return; }
    if (!p.days.length) { setError("Pick at least one day."); return; }
    onSave({ ...p, name: p.name.trim().slice(0, 60), dose: p.dose.trim().slice(0, 60), times: [...new Set(p.times)].sort(), notes: p.notes.slice(0, 300) });
  };
  return <Modal eyebrow="Pill reminders" title={isNew ? "Add a pill" : `Edit ${pill.name}`} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Label text="Name"><input autoFocus className={inputClass} value={p.name} maxLength={60} placeholder="Vitamin D" onChange={(e) => setP({ ...p, name: e.target.value })} /></Label>
        <Label text="Dose (optional)"><input className={inputClass} value={p.dose} maxLength={60} placeholder="1 tablet, 10 mg" onChange={(e) => setP({ ...p, dose: e.target.value })} /></Label>
      </div>
      {people.length > 1 && <div><p className="mb-1.5 text-xs font-bold text-slate-600">For</p><div className="flex flex-wrap gap-2">{people.map((m) => <button key={m.id} type="button" aria-pressed={p.memberId === m.id} onClick={() => setP({ ...p, memberId: m.id })}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-2.5 pr-3 text-xs font-bold text-slate-600 ring-1 ring-slate-200" style={p.memberId === m.id ? { background: m.color, color: "#fff", boxShadow: `0 0 0 1px ${m.color}` } : undefined}><span className="text-base leading-none">{m.emoji || "🙂"}</span>{m.name}</button>)}</div></div>}
      <div><p className="mb-1.5 text-xs font-bold text-slate-600">Times</p>
        <div className="flex flex-wrap items-center gap-2">{p.times.map((t, i) => <span key={i} className="inline-flex items-center gap-1">
          <input type="time" value={t} aria-label={`Time ${i + 1}`} className={inputClass + " !w-32"} onChange={(e) => e.target.value && setP({ ...p, times: p.times.map((x, j) => (j === i ? e.target.value : x)) })} />
          {p.times.length > 1 && <button type="button" onClick={() => setP({ ...p, times: p.times.filter((_, j) => j !== i) })} className="rounded-lg p-2 text-slate-400 hover:text-rose-500" aria-label={`Remove time ${i + 1}`}><X size={15} /></button>}
        </span>)}
          {p.times.length < 8 && <button type="button" className={soft + " min-h-10"} onClick={() => setP({ ...p, times: [...p.times, p.times.length ? "20:00" : "08:00"] })}><Plus size={14} /> Time</button>}</div></div>
      <div><p className="mb-1.5 text-xs font-bold text-slate-600">Days</p><div className="flex gap-1.5">{DAY_LETTERS.map((l, i) => { const on = p.days.includes(i); return <button key={i} type="button" aria-pressed={on} aria-label={DAY_NAMES[i]} onClick={() => setP({ ...p, days: on ? p.days.filter((d) => d !== i) : [...p.days, i].sort() })}
        className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-black ring-1 ${on ? "bg-[#6e5ae0] text-white ring-[#6e5ae0]" : "bg-white text-slate-500 ring-slate-200"}`}>{l}</button>; })}</div></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Label text="Start"><input type="date" className={inputClass} value={p.start} onChange={(e) => setP({ ...p, start: e.target.value })} /></Label>
        <Label text="End (optional)"><input type="date" className={inputClass} value={p.end} min={p.start || undefined} onChange={(e) => setP({ ...p, end: e.target.value })} /></Label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Label text="Pills left (optional)"><input type="number" min={0} max={10000} className={inputClass} value={p.supply ?? ""} placeholder="30" onChange={(e) => setP({ ...p, supply: e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value) || 0)) })} /></Label>
        <Label text="Pills per dose"><input type="number" min={1} max={20} className={inputClass} value={p.perDose} onChange={(e) => setP({ ...p, perDose: Math.max(1, Math.min(20, Math.round(Number(e.target.value) || 1))) })} /></Label>
        <Label text="Remind to refill at"><input type="number" min={0} max={1000} className={inputClass} value={p.refillAt} onChange={(e) => setP({ ...p, refillAt: Math.max(0, Math.round(Number(e.target.value) || 0)) })} /></Label>
      </div>
      <Label text="Notes (optional)"><input className={inputClass} value={p.notes} maxLength={300} placeholder="Take with food" onChange={(e) => setP({ ...p, notes: e.target.value })} /></Label>
      <div><p className="mb-1.5 text-xs font-bold text-slate-600">Color</p><div className="flex gap-2">{PILL_COLORS.map((c) => <button key={c} type="button" aria-pressed={p.color === c} aria-label={`Color ${c}`} onClick={() => setP({ ...p, color: c })} className={`h-9 w-9 rounded-full ${p.color === c ? "ring-2 ring-slate-800 ring-offset-2" : ""}`} style={{ background: c }} />)}</div></div>
      {!isNew && <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-slate-700"><input type="checkbox" className="h-5 w-5 accent-[#6e5ae0]" checked={!p.active} onChange={(e) => setP({ ...p, active: !e.target.checked })} /> Pause this pill (no reminders)</label>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <button type="submit" className={primary + " flex-1"}><Check size={16} /> Save</button>
        <button type="button" onClick={onClose} className={plain}>Cancel</button>
        {!isNew && <button type="button" onClick={() => onDelete(pill)} className={danger} aria-label="Delete"><Trash2 size={16} /></button>}
      </div>
    </form>
  </Modal>;
}
