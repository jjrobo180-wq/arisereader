// Family calendar: a month view with one color per calendar, a filter per person,
// and switchable layers for tasks, bills and trips.
import { useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, MapPin, Plane, Plus, Receipt, Repeat2, Trash2, Users } from "lucide-react";
import { MEMBER_COLORS, addDays, billDue, eventsOn, fromDay, toDay, type FamilyEvent, type EventRepeat } from "@shared/familyHub";
import { Avatar, Label, MemberPicker, Modal, PageHead, Panel, Toggle, clock12, confirmed, danger, inputClass, memberOf, plain, primary, shortDate, type SectionProps } from "./ui";

export type CalendarTask = { id: string; title: string; due: string; time: string; assignee: string; done: boolean };
type Item = { key: string; kind: "event" | "task" | "bill" | "trip"; title: string; time: string; color: string; event?: FamilyEvent; members: string[] };

const blankEvent = (date: string, calendarId: string, id: string): FamilyEvent =>
  ({ id, title: "", date, time: "", endTime: "", calendarId, memberIds: [], location: "", notes: "", repeat: "none" });

export default function FamilyCalendar({ family, setFamily, today, makeId, say, tasks, onOpenTasks }: SectionProps & { tasks: CalendarTask[]; onOpenTasks: () => void }) {
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [picked, setPicked] = useState(today);
  const [who, setWho] = useState<string[]>([]);
  const [editing, setEditing] = useState<FamilyEvent | null>(null);
  const [newCal, setNewCal] = useState("");
  const calColor = (id: string) => family.calendars.find((c) => c.id === id)?.color || "#94a3b8";

  const itemsOn = useMemo(() => (date: string): Item[] => {
    const out: Item[] = eventsOn(family, date)
      .filter((e) => !who.length || e.memberIds.some((m) => who.includes(m)) || !e.memberIds.length)
      .map((e) => ({ key: e.id, kind: "event", title: e.title, time: e.time, color: calColor(e.calendarId), event: e, members: e.memberIds }));
    if (family.layers.tasks) for (const t of tasks) if (!t.done && t.due === date) out.push({ key: "t" + t.id, kind: "task", title: t.title, time: t.time, color: "#64748b", members: [] });
    if (family.layers.bills) for (const b of family.bills) if (billDue(b, date.slice(0, 7)) === date) out.push({ key: "b" + b.id, kind: "bill", title: `${b.name} due`, time: "", color: b.paid.includes(date.slice(0, 7)) ? "#22c55e" : "#e0645a", members: [] });
    if (family.layers.trips) for (const t of family.trips) if (t.start && t.start <= date && (t.end || t.start) >= date) out.push({ key: "tr" + t.id, kind: "trip", title: t.start === date ? `✈️ ${t.name}` : t.name, time: "", color: "#0ea5e9", members: [] });
    return out.sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family, tasks, who]);

  const first = fromDay(`${month}-01`);
  const gridStart = addDays(`${month}-01`, -first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const shiftMonth = (n: number) => { const d = fromDay(`${month}-01`); d.setMonth(d.getMonth() + n); setMonth(toDay(d).slice(0, 7)); };
  const upcoming = Array.from({ length: 14 }, (_, i) => addDays(today, i)).flatMap((d) => itemsOn(d).filter((x) => x.kind === "event").map((x) => ({ ...x, date: d }))).slice(0, 8);

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.title.trim() || !editing.date) return;
    const clean = { ...editing, title: editing.title.trim().slice(0, 120), endTime: editing.time ? editing.endTime : "" };
    setFamily((f) => ({ ...f, events: f.events.some((x) => x.id === clean.id) ? f.events.map((x) => (x.id === clean.id ? clean : x)) : [...f.events, clean] }));
    setPicked(clean.date);
    setMonth(clean.date.slice(0, 7));
    setEditing(null);
    say("Event saved");
  };
  const remove = (ev: FamilyEvent) => {
    if (!confirmed(ev.repeat !== "none" ? `Delete "${ev.title}" and all its repeats?` : `Delete "${ev.title}"?`)) return;
    setFamily((f) => ({ ...f, events: f.events.filter((x) => x.id !== ev.id) }));
    setEditing(null);
    say("Event deleted");
  };
  const addCalendar = (e: FormEvent) => {
    e.preventDefault();
    const name = newCal.trim();
    if (!name) return;
    setFamily((f) => ({ ...f, calendars: [...f.calendars, { id: makeId(), name: name.slice(0, 40), color: MEMBER_COLORS[f.calendars.length % MEMBER_COLORS.length], show: true }] }));
    setNewCal("");
  };
  const add = (date = picked) => setEditing(blankEvent(date, family.calendars[0]?.id || "", makeId()));
  const dayItems = itemsOn(picked);

  return <div className="space-y-6">
    <PageHead eyebrow="Calendar" title="Family calendar" blurb="Everyone's practices, appointments and plans in one place. Switch calendars and people on or off to see just what you need."
      action={<button onClick={() => add()} className={primary + " min-h-11 px-5"}><Plus size={18} /> New event</button>} />

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Panel className="self-start" title={first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        right={<><button onClick={() => shiftMonth(-1)} className={plain} aria-label="Previous month"><ChevronLeft size={17} /></button><button onClick={() => { setMonth(today.slice(0, 7)); setPicked(today); }} className={plain}>Today</button><button onClick={() => shiftMonth(1)} className={plain} aria-label="Next month"><ChevronRight size={17} /></button></>}>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-slate-100 bg-slate-100 text-xs">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="bg-slate-50 py-2 text-center text-[11px] font-black uppercase tracking-wider text-slate-400"><span className="sm:hidden">{d[0]}</span><span className="hidden sm:inline">{d}</span></div>)}
          {cells.map((d) => {
            const items = itemsOn(d);
            const inMonth = d.slice(0, 7) === month;
            return <button key={d} onClick={() => setPicked(d)} onDoubleClick={() => add(d)} aria-label={`${shortDate(d)}, ${items.length} item${items.length === 1 ? "" : "s"}`} aria-pressed={picked === d}
              className={`flex min-h-[64px] flex-col gap-1 p-1.5 text-left transition sm:min-h-[96px] ${inMonth ? "bg-white" : "bg-slate-50/70 text-slate-400"} ${picked === d ? "ring-2 ring-inset ring-violet-500" : "hover:bg-violet-50/40"}`}>
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${d === today ? "bg-violet-600 text-white" : ""}`}>{Number(d.slice(8))}</span>
              <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">{items.slice(0, 3).map((it) => <span key={it.key} className="truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: it.color + "1f", color: it.color }}>{it.time && <span className="opacity-75">{clock12(it.time).replace(":00", "").replace(" ", "").toLowerCase()} </span>}{it.title}</span>)}{items.length > 3 && <span className="px-1 text-[10px] font-bold text-slate-400">+{items.length - 3} more</span>}</span>
              <span className="flex flex-wrap gap-0.5 sm:hidden">{items.slice(0, 4).map((it) => <span key={it.key} className="h-1.5 w-1.5 rounded-full" style={{ background: it.color }} />)}</span>
            </button>;
          })}
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel eyebrow={picked === today ? "Today" : "Selected day"} title={shortDate(picked, { weekday: "long", month: "long", day: "numeric" })} right={<button onClick={() => add()} className={plain} aria-label="Add event on this day"><Plus size={16} /></button>}>
          {dayItems.length ? <ul className="space-y-2">{dayItems.map((it) => <li key={it.key}>
            <button onClick={() => it.event ? setEditing({ ...it.event }) : it.kind === "task" ? onOpenTasks() : undefined} className="flex w-full items-start gap-3 rounded-xl border border-slate-100 p-3 text-left hover:border-violet-200">
              <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: it.color }} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-800">{it.title}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-500">
                  {it.kind === "task" && <span>Task</span>}{it.kind === "bill" && <span className="inline-flex items-center gap-1"><Receipt size={11} /> Bill</span>}{it.kind === "trip" && <span className="inline-flex items-center gap-1"><Plane size={11} /> Trip</span>}
                  {it.time && <span>{clock12(it.time)}{it.event?.endTime ? `–${clock12(it.event.endTime)}` : ""}</span>}
                  {it.event?.location && <span className="inline-flex items-center gap-1"><MapPin size={11} />{it.event.location}</span>}
                  {it.event && it.event.repeat !== "none" && <span className="inline-flex items-center gap-1"><Repeat2 size={11} />{it.event.repeat}</span>}
                </span>
                {it.members.length > 0 && <span className="mt-1.5 flex -space-x-1">{it.members.map((m) => <Avatar key={m} member={memberOf(family, m)} size="sm" />)}</span>}
              </span>
            </button>
          </li>)}</ul> : <p className="text-sm text-slate-500">Nothing planned. Double-click a day (or tap +) to add something.</p>}
        </Panel>

        <Panel eyebrow="Show" title="Calendars">
          <ul className="space-y-1">{family.calendars.map((c) => <li key={c.id} className="flex min-h-10 items-center gap-3">
            <span className="h-3.5 w-3.5 shrink-0 rounded" style={{ background: c.color }} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</span>
            {family.calendars.length > 1 && !family.events.some((e) => e.calendarId === c.id) && <button onClick={() => setFamily((f) => ({ ...f, calendars: f.calendars.filter((x) => x.id !== c.id) }))} className="rounded-lg p-1 text-slate-300 hover:text-rose-500" aria-label={`Remove ${c.name} calendar`}><Trash2 size={14} /></button>}
            <Toggle on={c.show} label={`Show ${c.name}`} onChange={(on) => setFamily((f) => ({ ...f, calendars: f.calendars.map((x) => (x.id === c.id ? { ...x, show: on } : x)) }))} />
          </li>)}</ul>
          <form onSubmit={addCalendar} className="mt-3 flex gap-2"><input value={newCal} onChange={(e) => setNewCal(e.target.value)} maxLength={40} placeholder="New calendar (e.g. Soccer)" aria-label="New calendar name" className={inputClass + " min-w-0"} /><button type="submit" className={primary} aria-label="Add calendar"><Plus size={17} /></button></form>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">Also show</p>
            {([["tasks", "Tasks with due dates", CalendarDays], ["bills", "Bill due dates", Receipt], ["trips", "Trips", Plane]] as const).map(([key, label, Icon]) => <div key={key} className="flex min-h-10 items-center gap-3">
              <Icon size={15} className="text-slate-400" /><span className="flex-1 text-sm font-semibold">{label}</span>
              <Toggle on={family.layers[key]} label={`Show ${label}`} onChange={(on) => setFamily((f) => ({ ...f, layers: { ...f.layers, [key]: on } }))} />
            </div>)}
          </div>
          {family.members.length > 0 && <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400"><Users size={12} /> Only show events for</p>
            <MemberPicker members={family.members} value={who} onChange={setWho} multi />
            {who.length > 0 && <button onClick={() => setWho([])} className="mt-2 text-xs font-bold text-violet-600">Show everyone</button>}
          </div>}
        </Panel>

        {upcoming.length > 0 && <Panel eyebrow="Next two weeks" title="Coming up">
          <ul className="space-y-2.5">{upcoming.map((it) => <li key={it.key + it.date}><button onClick={() => { setPicked(it.date); setMonth(it.date.slice(0, 7)); }} className="flex w-full items-center gap-3 text-left">
            <span className="w-14 shrink-0 text-[11px] font-black uppercase text-violet-600">{it.date === today ? "Today" : shortDate(it.date, { weekday: "short", day: "numeric" })}</span>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: it.color }} /><span className="min-w-0 flex-1 truncate text-xs font-semibold">{it.title}</span>
            {it.time && <span className="shrink-0 text-[11px] text-slate-400">{clock12(it.time)}</span>}
          </button></li>)}</ul>
        </Panel>}
      </div>
    </div>

    {editing && <Modal title={family.events.some((e) => e.id === editing.id) ? "Edit event" : "New event"} onClose={() => setEditing(null)}>
      <form onSubmit={save} className="space-y-4">
        <Label text="What"><input autoFocus required maxLength={120} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={inputClass} placeholder="Soccer practice" /></Label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Label text="Date"><input type="date" required value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} className={inputClass} /></Label>
          <Label text="Starts"><input type="time" value={editing.time} onChange={(e) => setEditing({ ...editing, time: e.target.value })} className={inputClass} /></Label>
          <Label text="Ends"><input type="time" disabled={!editing.time} value={editing.endTime} onChange={(e) => setEditing({ ...editing, endTime: e.target.value })} className={inputClass} /></Label>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Label text="Calendar"><select value={editing.calendarId} onChange={(e) => setEditing({ ...editing, calendarId: e.target.value })} className={inputClass}>{family.calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Label>
          <Label text="Repeats"><select value={editing.repeat} onChange={(e) => setEditing({ ...editing, repeat: e.target.value as EventRepeat })} className={inputClass}><option value="none">Does not repeat</option><option value="weekly">Every week</option><option value="monthly">Every month</option><option value="yearly">Every year (birthdays)</option></select></Label>
        </div>
        <div><p className="mb-1.5 text-xs font-bold text-slate-600">Who's going</p><MemberPicker members={family.members} value={editing.memberIds} onChange={(ids) => setEditing({ ...editing, memberIds: ids })} multi /></div>
        <Label text="Where (optional)"><input maxLength={160} value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} className={inputClass} placeholder="Field 3, Central Park" /></Label>
        <Label text="Notes (optional)"><textarea rows={2} maxLength={1000} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className={inputClass + " py-3"} placeholder="Bring shin guards and water" /></Label>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button type="submit" className={primary + " flex-1 px-5"}><Check size={17} /> Save event</button>
          <button type="button" onClick={() => setEditing(null)} className={plain}>Cancel</button>
          {family.events.some((e) => e.id === editing.id) && <button type="button" onClick={() => remove(editing)} className={danger} aria-label="Delete event"><Trash2 size={17} /></button>}
        </div>
      </form>
    </Modal>}
  </div>;
}
