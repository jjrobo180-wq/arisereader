// Family Hub home: today across every switched-on part of the hub.
import { Apple, CalendarDays, Check, ChevronRight, ListTodo, Plane, Receipt, Sparkles, Star, StickyNote, Sun, UserPlus, Vote } from "lucide-react";
import { addDays, billDue, billState, choreDoneOn, choreDueOn, choreOwner, daysBetween, eventsOn, isOn, money, starBalance, tally, toggleChore, type FamilySection } from "@shared/familyHub";
import { pollIsOpen } from "./Polls";
import { caloriesLeft, dayTotals, goalsFor, healthPeople } from "@shared/familyHealth";
import type { CalendarTask } from "./FamilyCalendar";
import { Avatar, Bar, Panel, Stat, clock12, memberOf, primary, shortDate, type SectionProps } from "./ui";

export default function FamilyHome({ family, setFamily, today, makeId, say, tasks, go, onToggleTask, name }: SectionProps & {
  tasks: CalendarTask[]; go: (section: FamilySection) => void; onToggleTask: (id: string) => void; name: string;
}) {
  const on = (s: FamilySection) => isOn(s, family);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const events = on("calendar") ? eventsOn(family, today, true) : [];
  const dueTasks = tasks.filter((t) => !t.done && t.due && t.due <= today).sort((a, b) => (a.due + a.time).localeCompare(b.due + b.time));
  const chores = on("chores") ? family.chores.filter((c) => choreDueOn(c, today)) : [];
  const choresLeft = chores.filter((c) => !choreDoneOn(family, c.id, today));
  const month = today.slice(0, 7);
  const nextMonth = addDays(`${month}-28`, 7).slice(0, 7);
  const bills = on("money") ? family.bills.flatMap((b) => [month, nextMonth].map((m) => ({ b, m, due: billDue(b, m), state: billState(b, m, today) })))
    .filter((x) => x.state !== "paid" && daysBetween(today, x.due) <= 7).sort((a, b) => a.due.localeCompare(b.due)) : [];
  const polls = on("polls") ? family.polls.filter((p) => pollIsOpen(p, today)) : [];
  const trip = on("trips") ? [...family.trips].filter((t) => t.start && (t.end || t.start) >= today).sort((a, b) => a.start.localeCompare(b.start))[0] : undefined;
  const pinned = on("notes") ? family.notes.filter((n) => n.pinned).slice(0, 4) : [];
  const kids = family.members.filter((m) => m.kind === "kid");

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 text-xs font-extrabold uppercase tracking-[.2em] text-[#7869d7]">{shortDate(today, { weekday: "long", month: "long", day: "numeric" })}</p><h1 className="text-3xl font-black tracking-tight text-[#232139] sm:text-4xl">{greeting}{name ? `, ${name}` : ""}<span className="text-[#7866e1]">.</span></h1><p className="mt-2 text-sm leading-6 text-slate-500">Here's what's happening with your family today.</p></div>
    </header>

    {!family.members.length && <section className="flex flex-col gap-4 rounded-[1.5rem] bg-[#292446] p-5 text-white sm:flex-row sm:items-center">
      <span className="rounded-2xl bg-white/10 p-3 text-[#bcb2ff]"><UserPlus size={26} /></span>
      <div className="min-w-0 flex-1"><p className="text-lg font-black">Set up your family</p><p className="mt-1 text-sm text-slate-300">Add each person once. Then you can assign tasks and chores, track stars, and let everyone vote.</p></div>
      <button onClick={() => go("family")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#a38cfa] px-5 text-sm font-bold text-[#1d1838] hover:bg-[#b6a4ff]">Add your family <ChevronRight size={16} /></button>
    </section>}

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <button onClick={() => go("tasks")} className="text-left"><Stat label="Tasks due" value={dueTasks.length} icon={<ListTodo size={17} />} tint="bg-violet-50 text-violet-600" /></button>
      {on("chores") && <button onClick={() => go("chores")} className="text-left"><Stat label="Chores left today" value={choresLeft.length} icon={<Sparkles size={17} />} tint="bg-emerald-50 text-emerald-600" /></button>}
      {on("calendar") && <button onClick={() => go("calendar")} className="text-left"><Stat label="Events today" value={events.length} icon={<CalendarDays size={17} />} tint="bg-sky-50 text-sky-600" /></button>}
      {on("money") && <button onClick={() => go("money")} className="text-left"><Stat label="Bills due this week" value={bills.length} icon={<Receipt size={17} />} tint="bg-rose-50 text-rose-600" /></button>}
    </div>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <Panel eyebrow="Today" title="Agenda" right={<Sun size={18} className="text-amber-500" />}>
          {events.length || dueTasks.length ? <ul className="space-y-2">
            {events.map((e) => <li key={e.id}><button onClick={() => go("calendar")} className="flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3 text-left hover:border-violet-200">
              <span className="w-16 shrink-0 text-xs font-black text-violet-600">{e.time ? clock12(e.time) : "All day"}</span>
              <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: family.calendars.find((c) => c.id === e.calendarId)?.color || "#94a3b8" }} />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{e.title}</span>{e.location && <span className="block truncate text-[11px] text-slate-500">{e.location}</span>}</span>
              <span className="flex -space-x-1">{e.memberIds.slice(0, 4).map((m) => <Avatar key={m} member={memberOf(family, m)} size="sm" />)}</span>
            </button></li>)}
            {dueTasks.slice(0, 8).map((t) => <li key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
              <button onClick={() => onToggleTask(t.id)} aria-label={`Complete ${t.title}`} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-slate-300 text-transparent hover:border-violet-500 hover:text-violet-500"><Check size={14} /></button>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{t.title}</span><span className="text-[11px] font-semibold text-slate-500">{t.due < today ? <span className="text-rose-600">Overdue · {shortDate(t.due, { month: "short", day: "numeric" })}</span> : t.time ? clock12(t.time) : "Today"}{t.assignee ? ` · ${t.assignee}` : ""}</span></span>
            </li>)}
          </ul> : <p className="text-sm text-slate-500">A clear day. Nothing scheduled and no tasks due.</p>}
        </Panel>

        {on("chores") && chores.length > 0 && <Panel eyebrow="Chores" title={choresLeft.length ? `${choresLeft.length} left today` : "All chores done! 🎉"} right={<button onClick={() => go("chores")} className="text-xs font-bold text-violet-600">Chore chart</button>}>
          <div className="grid gap-2 sm:grid-cols-2">{chores.map((c) => {
            const done = !!choreDoneOn(family, c.id, today);
            const owner = memberOf(family, choreOwner(c, today));
            return <button key={c.id} onClick={() => { setFamily((f) => toggleChore(f, c, today, makeId)); if (!done) say(`${c.title} done${c.points ? ` · +${c.points} ⭐` : ""}`); }} aria-pressed={done} className={`flex items-center gap-3 rounded-xl border p-2.5 text-left ${done ? "border-emerald-200 bg-emerald-50" : "border-slate-100 hover:border-violet-200"}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent"}`}><Check size={14} /></span>
              <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${done ? "text-emerald-800 line-through" : ""}`}>{c.title}</span>
              {owner ? <Avatar member={owner} size="sm" /> : <span className="text-[11px] font-bold text-slate-400">Anyone</span>}
            </button>;
          })}</div>
        </Panel>}

        {polls.length > 0 && <Panel eyebrow="Vote" title="Open polls" right={<button onClick={() => go("polls")} className="text-xs font-bold text-violet-600">All polls</button>}>
          <ul className="space-y-2">{polls.slice(0, 3).map((p) => {
            const t = tally(p);
            const waiting = family.members.filter((m) => !p.votes[m.id]);
            return <li key={p.id}><button onClick={() => go("polls")} className="flex w-full items-center gap-3 rounded-xl bg-slate-50 p-3 text-left hover:bg-violet-50">
              <Vote size={18} className="shrink-0 text-violet-500" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{p.question}</span><span className="text-[11px] text-slate-500">{t.leaders[0] ? `Leading: ${t.leaders[0].label}` : "No votes yet"}{waiting.length ? ` · ${waiting.length} still to vote` : " · everyone voted"}</span></span>
              <ChevronRight size={16} className="text-slate-400" />
            </button></li>;
          })}</ul>
        </Panel>}
      </div>

      <aside className="space-y-5">
        {trip && <button onClick={() => go("trips")} className="block w-full overflow-hidden rounded-[1.5rem] bg-[linear-gradient(115deg,#2b2a8f,#6d4fd8_60%,#f29a14_130%)] p-5 text-left text-white shadow-[0_12px_24px_#2924461f]">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-white/75"><Plane size={14} /> Next trip</p>
          <p className="mt-2 text-xl font-black">{trip.name}</p>
          <p className="mt-1 text-sm text-white/80">{daysBetween(today, trip.start) > 0 ? `${daysBetween(today, trip.start)} day${daysBetween(today, trip.start) === 1 ? "" : "s"} to go` : "Happening now"} · {shortDate(trip.start, { month: "short", day: "numeric" })}</p>
          {trip.packing.length > 0 && <div className="mt-3"><div className="h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{ width: `${(trip.packing.filter((p) => p.packed).length / trip.packing.length) * 100}%` }} /></div><p className="mt-1 text-[11px] text-white/70">{trip.packing.filter((p) => p.packed).length} of {trip.packing.length} packed</p></div>}
        </button>}

        {on("health") && <Panel eyebrow="Food & fitness" title="Today" right={<button onClick={() => go("health")} className="text-xs font-bold text-violet-600">Diary</button>}>
          <ul className="space-y-2.5">{healthPeople(family, name).map((m) => {
            const t = dayTotals(family.health, m.id, today);
            const g = goalsFor(family.health, m);
            const left = caloriesLeft(g.calories, t);
            return <li key={m.id} className="flex items-center gap-3"><Avatar member={m} />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{m.name}</span>
                <span className="text-[11px] text-slate-500">{m.kind === "kid" ? `${t.fruitVeg}/${g.fruitVeg} fruits & veggies · ${t.water}/${g.water} water` : t.items ? `${t.food.calories.toLocaleString()} eaten · ${t.water}/${g.water} water` : "Nothing logged yet"}</span></span>
              {m.kind === "kid" ? <Apple size={16} className={t.fruitVeg >= g.fruitVeg ? "text-emerald-500" : "text-slate-300"} />
                : <span className={`text-right text-xs font-black ${left < 0 ? "text-rose-600" : "text-slate-700"}`}>{Math.abs(left).toLocaleString()}<span className="block text-[10px] font-bold text-slate-400">{left < 0 ? "over" : "cal left"}</span></span>}
            </li>;
          })}</ul>
        </Panel>}

        {on("behavior") && kids.length > 0 && <Panel eyebrow="Stars" title="Kids' stars" right={<button onClick={() => go("behavior")} className="text-xs font-bold text-violet-600">Tracker</button>}>
          <ul className="space-y-2.5">{kids.map((k) => <li key={k.id} className="flex items-center gap-3"><Avatar member={k} /><span className="min-w-0 flex-1 truncate text-sm font-bold">{k.name}</span><span className="inline-flex items-center gap-1 text-sm font-black text-amber-600"><Star size={15} className="fill-amber-400 text-amber-400" />{starBalance(family, k.id).balance}</span></li>)}</ul>
        </Panel>}

        {on("money") && <Panel eyebrow="Bills" title="Due soon" right={<button onClick={() => go("money")} className="text-xs font-bold text-violet-600">Money hub</button>}>
          {bills.length ? <ul className="space-y-2">{bills.slice(0, 5).map(({ b, due, state }) => <li key={b.id + due} className="flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 shrink-0 rounded-full ${state === "late" ? "bg-rose-500" : "bg-amber-400"}`} /><span className="min-w-0 flex-1 truncate font-semibold">{b.name}</span>
            <span className={`text-xs font-bold ${state === "late" ? "text-rose-600" : "text-slate-500"}`}>{state === "late" ? "Past due" : due === today ? "Today" : shortDate(due, { month: "short", day: "numeric" })}</span><span className="w-16 text-right text-xs font-black">{money(b.amount)}</span>
          </li>)}</ul> : <p className="text-xs text-slate-500">No bills due in the next week.</p>}
          {family.bills.length > 0 && <div className="mt-4 border-t border-slate-100 pt-3"><p className="mb-1.5 text-[11px] font-bold text-slate-500">Paid this month</p><Bar value={family.bills.filter((b) => b.paid.includes(month)).length} max={family.bills.length} color="#22c55e" /></div>}
        </Panel>}

        {pinned.length > 0 && <Panel eyebrow="Pinned" title="Notes" right={<StickyNote size={17} className="text-violet-500" />}>
          <div className="space-y-2">{pinned.map((n) => <button key={n.id} onClick={() => go("notes")} className="note-card block w-full rounded-xl p-3 text-left" style={{ background: n.color }}>
            {n.title && <p className="truncate text-sm font-black">{n.title}</p>}{n.body && <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-xs text-slate-600">{n.body}</p>}
          </button>)}</div>
        </Panel>}

        {on("polls") && !polls.length && family.members.length > 1 && <button onClick={() => go("polls")} className={primary + " w-full"}><Vote size={16} /> Start a dinner poll</button>}
      </aside>
    </div>
  </div>;
}
