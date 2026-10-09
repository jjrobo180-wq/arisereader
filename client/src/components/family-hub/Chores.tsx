// Chore chart: who does what each day, check-offs, rotations and points.
import { useState, type FormEvent } from "react";
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Repeat2, Sparkles, Star, Trash2, Trophy } from "lucide-react";
import { addDays, choreDoneOn, choreDueOn, choreOwner, toggleChore, weekStart, type Chore } from "@shared/familyHub";
import { Avatar, Empty, Label, MemberPicker, MemberTag, Modal, PageHead, Panel, confirmed, danger, inputClass, memberOf, plain, primary, shortDate, soft, type SectionProps } from "./ui";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const IDEAS = ["Make bed", "Feed the pet", "Take out trash", "Unload dishwasher", "Tidy bedroom", "Fold laundry", "Set the table", "Water plants"];
type Draft = { id: string | null; title: string; mode: "one" | "rotate"; memberId: string; rotation: string[]; days: number[]; points: number };
const blank = (): Draft => ({ id: null, title: "", mode: "one", memberId: "", rotation: [], days: [], points: 1 });

export default function Chores({ family, setFamily, today, makeId, say }: SectionProps) {
  const [week, setWeek] = useState(() => weekStart(today));
  const [who, setWho] = useState<string>("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const chores = family.chores.filter((c) => !who || c.memberId === who || c.rotation.includes(who));
  const todays = family.chores.filter((c) => choreDueOn(c, today) && (!who || choreOwner(c, today) === who));
  const left = todays.filter((c) => !choreDoneOn(family, c.id, today)).length;

  const weekPoints = family.members.map((m) => ({
    member: m,
    points: family.choreDone.filter((d) => d.memberId === m.id && d.date >= week && d.date <= days[6]).reduce((s, d) => s + d.points, 0),
    done: family.choreDone.filter((d) => d.memberId === m.id && d.date >= week && d.date <= days[6]).length,
  })).sort((a, b) => b.points - a.points);

  const tick = (c: Chore, date: string) => {
    const wasDone = !!choreDoneOn(family, c.id, date);
    setFamily((f) => toggleChore(f, c, date, makeId));
    if (!wasDone) say(`${c.title} done${c.points ? ` · +${c.points} ⭐` : ""}`);
  };
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!draft || !draft.title.trim()) return;
    const chore: Chore = {
      id: draft.id || makeId(), title: draft.title.trim().slice(0, 120),
      memberId: draft.mode === "one" ? draft.memberId : "", rotation: draft.mode === "rotate" ? draft.rotation : [],
      days: draft.days, points: Math.max(0, Math.min(100, Math.round(draft.points) || 0)),
    };
    setFamily((f) => ({ ...f, chores: f.chores.some((c) => c.id === chore.id) ? f.chores.map((c) => (c.id === chore.id ? chore : c)) : [...f.chores, chore] }));
    setDraft(null);
    say("Chore saved");
  };
  const remove = (c: Chore) => {
    if (!confirmed(`Delete the chore "${c.title}"? Points already earned stay.`)) return;
    setFamily((f) => ({ ...f, chores: f.chores.filter((x) => x.id !== c.id) }));
    setDraft(null);
    say("Chore deleted");
  };
  const edit = (c: Chore) => setDraft({ id: c.id, title: c.title, mode: c.rotation.length ? "rotate" : "one", memberId: c.memberId, rotation: c.rotation, days: c.days, points: c.points });

  return <div className="space-y-6">
    <PageHead eyebrow="Chores" title="Chore chart" blurb="Give everyone their jobs, rotate the ones nobody wants, and let kids check things off to earn stars."
      action={<button onClick={() => setDraft(blank())} className={primary + " min-h-11 px-5"}><Plus size={18} /> New chore</button>} />

    {family.members.length > 0 && <div className="flex flex-wrap gap-2">
      <button onClick={() => setWho("")} aria-pressed={!who} className={`min-h-10 rounded-xl px-4 text-xs font-bold ring-1 ${!who ? "bg-slate-800 text-white ring-slate-800" : "bg-white text-slate-500 ring-slate-200"}`}>Everyone</button>
      {family.members.map((m) => <button key={m.id} onClick={() => setWho(who === m.id ? "" : m.id)} aria-pressed={who === m.id} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold ring-1" style={who === m.id ? { background: m.color, color: "#fff", boxShadow: `0 0 0 1px ${m.color}` } : { background: "#fff", color: "#475569", boxShadow: "0 0 0 1px #e2e8f0" }}><span>{m.emoji || "🙂"}</span>{m.name}</button>)}
    </div>}

    {!family.chores.length ? <Panel><Empty icon={<Sparkles size={26} />} title="No chores yet" action={<button onClick={() => setDraft(blank())} className={soft}><Plus size={16} /> Add the first chore</button>}>Start with a few daily jobs. You can rotate a chore between kids so it changes hands every week.</Empty></Panel> : <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Panel eyebrow={shortDate(today, { weekday: "long", month: "long", day: "numeric" })} title={left ? `${left} chore${left === 1 ? "" : "s"} left today` : todays.length ? "All done today! 🎉" : "Nothing due today"}>
          {todays.length ? <div className="grid gap-2 sm:grid-cols-2">
            {todays.map((c) => {
              const done = !!choreDoneOn(family, c.id, today);
              const owner = memberOf(family, choreOwner(c, today));
              return <button key={c.id} onClick={() => tick(c, today)} aria-pressed={done} className={`flex min-h-16 items-center gap-3 rounded-2xl border p-3 text-left transition ${done ? "border-emerald-200 bg-emerald-50" : "border-[#ececf3] bg-white hover:border-violet-200 hover:bg-[#fcfbff]"}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent"}`}><Check size={20} /></span>
                <span className="min-w-0 flex-1"><span className={`block truncate text-sm font-bold ${done ? "text-emerald-800 line-through" : "text-slate-800"}`}>{c.title}</span><span className="mt-1 flex items-center gap-2"><MemberTag member={owner} />{c.points > 0 && <span className="text-[11px] font-bold text-amber-600">+{c.points} ⭐</span>}</span></span>
              </button>;
            })}
          </div> : <p className="text-sm text-slate-500">Enjoy the day off.</p>}
        </Panel>
        <Panel eyebrow="This week" title="Star chart" right={<Trophy size={18} className="text-amber-500" />}>
          {weekPoints.length ? <ol className="space-y-3">{weekPoints.map((row, i) => <li key={row.member.id} className="flex items-center gap-3">
            <span className="w-4 text-xs font-black text-slate-400">{i + 1}</span><Avatar member={row.member} />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{row.member.name}</span><span className="text-[11px] text-slate-500">{row.done} chore{row.done === 1 ? "" : "s"} done</span></span>
            <span className="inline-flex items-center gap-1 text-sm font-black text-amber-600"><Star size={15} className="fill-amber-400 text-amber-400" />{row.points}</span>
          </li>)}</ol> : <p className="text-sm text-slate-500">Add family members to see who's earning stars.</p>}
        </Panel>
      </div>

      <Panel eyebrow="Week at a glance" title={`${shortDate(days[0], { month: "short", day: "numeric" })} – ${shortDate(days[6], { month: "short", day: "numeric" })}`}
        right={<><button onClick={() => setWeek(addDays(week, -7))} className={plain} aria-label="Previous week"><ChevronLeft size={17} /></button><button onClick={() => setWeek(weekStart(today))} className={plain}>This week</button><button onClick={() => setWeek(addDays(week, 7))} className={plain} aria-label="Next week"><ChevronRight size={17} /></button></>}>
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <table className="w-full min-w-[680px] border-separate border-spacing-0 text-sm">
            <thead><tr><th className="sticky left-0 z-10 bg-white pb-2 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">Chore</th>{days.map((d) => <th key={d} className={`pb-2 text-center text-[11px] font-black uppercase tracking-wider ${d === today ? "text-violet-600" : "text-slate-400"}`}>{DAY_NAMES[new Date(`${d}T12:00:00`).getDay()]}<span className="block text-xs font-bold normal-case tracking-normal">{Number(d.slice(8))}</span></th>)}</tr></thead>
            <tbody>{chores.map((c) => <tr key={c.id}>
              <td className="sticky left-0 z-10 max-w-[220px] border-t border-slate-100 bg-white py-2 pr-3">
                <button onClick={() => edit(c)} className="group flex w-full min-w-0 items-center gap-2 text-left"><span className="min-w-0 flex-1"><span className="block truncate font-bold text-slate-800 group-hover:text-violet-700">{c.title}</span><span className="flex items-center gap-1 text-[11px] text-slate-500">{c.rotation.length ? <><Repeat2 size={11} /> Rotates weekly</> : memberOf(family, c.memberId)?.name || "Anyone"}{c.points ? ` · ${c.points}⭐` : ""}</span></span><Pencil size={14} className="shrink-0 text-slate-300 group-hover:text-violet-600" /></button>
              </td>
              {days.map((d) => {
                if (!choreDueOn(c, d)) return <td key={d} className="border-t border-slate-100 py-2 text-center text-slate-200">–</td>;
                const done = !!choreDoneOn(family, c.id, d);
                const owner = memberOf(family, choreOwner(c, d));
                return <td key={d} className={`border-t border-slate-100 py-2 text-center ${d === today ? "bg-violet-50/50" : ""}`}>
                  <button onClick={() => tick(c, d)} aria-pressed={done} aria-label={`${c.title} on ${shortDate(d)}${done ? ", done" : ""}`} title={owner?.name || "Anyone"}
                    className={`mx-auto flex h-9 w-9 items-center justify-center rounded-xl border-2 text-xs font-black transition ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 bg-white hover:border-violet-400"}`}
                    style={!done && owner ? { borderColor: owner.color + "88", color: owner.color } : undefined}>
                    {done ? <Check size={17} /> : owner ? (owner.emoji || owner.name[0]) : ""}
                  </button>
                </td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>
      </Panel>
    </>}

    {draft && <Modal title={draft.id ? "Edit chore" : "New chore"} onClose={() => setDraft(null)}>
      <form onSubmit={save} className="space-y-4">
        <Label text="Chore"><input autoFocus required maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={inputClass} placeholder="Feed the dog" list="chore-ideas" /></Label>
        <datalist id="chore-ideas">{IDEAS.map((i) => <option key={i} value={i} />)}</datalist>
        <div>
          <p className="mb-1.5 text-xs font-bold text-slate-600">Who does it</p>
          <div className="mb-3 inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
            {(["one", "rotate"] as const).map((m) => <button type="button" key={m} onClick={() => setDraft({ ...draft, mode: m })} aria-pressed={draft.mode === m} className={`min-h-9 rounded-lg px-3 ${draft.mode === m ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}>{m === "one" ? "Same person" : "Take turns weekly"}</button>)}
          </div>
          {draft.mode === "one"
            ? <MemberPicker members={family.members} value={draft.memberId ? [draft.memberId] : []} onChange={(ids) => setDraft({ ...draft, memberId: ids[0] || "" })} allowNone />
            : <><MemberPicker members={family.members} value={draft.rotation} onChange={(ids) => setDraft({ ...draft, rotation: ids })} multi /><p className="mt-2 text-xs text-slate-500">The turn moves to the next person each Sunday, in the order you tap them.</p></>}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-bold text-slate-600">Which days</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setDraft({ ...draft, days: [] })} aria-pressed={!draft.days.length} className={`min-h-10 rounded-xl px-3 text-xs font-bold ring-1 ${!draft.days.length ? "bg-violet-600 text-white ring-violet-600" : "bg-white text-slate-500 ring-slate-200"}`}>Every day</button>
            {DAY_NAMES.map((n, i) => { const on = draft.days.includes(i); return <button type="button" key={n} aria-pressed={on} onClick={() => setDraft({ ...draft, days: on ? draft.days.filter((x) => x !== i) : [...draft.days, i].sort() })} className={`min-h-10 w-12 rounded-xl text-xs font-bold ring-1 ${on ? "bg-violet-600 text-white ring-violet-600" : "bg-white text-slate-500 ring-slate-200"}`}>{n}</button>; })}
          </div>
        </div>
        <Label text="Stars earned each time"><input type="number" min={0} max={100} value={draft.points} onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) })} className={inputClass + " max-w-[120px]"} /></Label>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button type="submit" className={primary + " flex-1 px-5"}><Check size={17} /> Save chore</button>
          <button type="button" onClick={() => setDraft(null)} className={plain}>Cancel</button>
          {draft.id && <button type="button" onClick={() => { const c = family.chores.find((x) => x.id === draft.id); if (c) remove(c); }} className={danger} aria-label="Delete chore"><Trash2 size={17} /></button>}
        </div>
      </form>
    </Modal>}
  </div>;
}
