// Trip planner: dates and budget, a day-by-day plan, and a packing list for each person.
import { useState, type FormEvent } from "react";
import { ArrowLeft, Check, Luggage, MapPin, Pencil, Plane, Plus, Trash2, Wallet } from "lucide-react";
import { addDays, daysBetween, money, type PackItem, type Trip, type TripStop } from "@shared/familyHub";
import { Avatar, Bar, Empty, Label, Modal, PageHead, Panel, clock12, confirmed, danger, inputClass, memberOf, plain, primary, shortDate, soft, type SectionProps } from "./ui";

const BASICS = ["Clothes", "Pajamas", "Toothbrush", "Shoes", "Jacket", "Phone charger"];
const SHARED = ["Snacks", "First-aid kit", "Sunscreen", "Medications", "Tickets & IDs"];
const blankTrip = (id: string): Trip => ({ id, name: "", destination: "", start: "", end: "", budget: 0, notes: "", stops: [], packing: [] });

export default function Trips({ family, setFamily, today, makeId, say }: SectionProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [stop, setStop] = useState<TripStop>({ id: "", date: "", time: "", title: "", cost: 0 });
  const [pack, setPack] = useState({ item: "", memberId: "" });
  const trip = family.trips.find((t) => t.id === openId) || null;
  const sorted = [...family.trips].sort((a, b) => (a.start || "9999").localeCompare(b.start || "9999"));
  const upcoming = sorted.filter((t) => !t.end || t.end >= today);
  const past = sorted.filter((t) => t.end && t.end < today).reverse();

  const updateTrip = (id: string, fn: (t: Trip) => Trip) => setFamily((f) => ({ ...f, trips: f.trips.map((t) => (t.id === id ? fn(t) : t)) }));
  const saveBasics = (e: FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name.trim()) return;
    if (editing.start && editing.end && editing.end < editing.start) { say("The trip can't end before it starts."); return; }
    const clean = { ...editing, name: editing.name.trim().slice(0, 100), budget: Math.max(0, Number(editing.budget) || 0) };
    setFamily((f) => ({ ...f, trips: f.trips.some((t) => t.id === clean.id) ? f.trips.map((t) => (t.id === clean.id ? clean : t)) : [...f.trips, clean] }));
    setOpenId(clean.id);
    setEditing(null);
    say("Trip saved");
  };
  const countdown = (t: Trip) => {
    if (!t.start) return "Dates not set";
    const n = daysBetween(today, t.start);
    if (n > 1) return `${n} days to go`;
    if (n === 1) return "Tomorrow!";
    if (n === 0 || (t.end && t.end >= today)) return "Happening now";
    return "Finished";
  };
  const planned = (t: Trip) => t.stops.reduce((s, x) => s + x.cost, 0);

  const tripCard = (t: Trip) => {
    const packed = t.packing.filter((p) => p.packed).length;
    return <button key={t.id} onClick={() => setOpenId(t.id)} className="overflow-hidden rounded-[1.5rem] border border-[#e7e8f0] bg-white text-left shadow-[0_8px_28px_#17152b08] transition hover:border-violet-200">
      <div className="h-20 bg-[linear-gradient(115deg,#2b2a8f,#6d4fd8_60%,#f29a14_130%)] p-4 text-white"><p className="text-[11px] font-black uppercase tracking-wider text-white/75">{countdown(t)}</p><p className="mt-1 truncate text-lg font-black">{t.name}</p></div>
      <div className="space-y-2 p-4 text-xs font-semibold text-slate-500">
        {t.destination && <p className="flex items-center gap-1.5"><MapPin size={13} />{t.destination}</p>}
        <p>{t.start ? `${shortDate(t.start, { month: "short", day: "numeric" })}${t.end && t.end !== t.start ? ` – ${shortDate(t.end, { month: "short", day: "numeric" })}` : ""}` : "Add dates"}</p>
        <p className="flex items-center gap-3"><span className="inline-flex items-center gap-1"><Luggage size={13} />{packed}/{t.packing.length} packed</span><span>{t.stops.length} plans</span></p>
      </div>
    </button>;
  };

  if (trip) {
    const days = trip.start && trip.end ? Array.from({ length: Math.min(60, daysBetween(trip.start, trip.end) + 1) }, (_, i) => addDays(trip.start, i)) : [];
    const groups = [...new Set([...days, ...trip.stops.map((s) => s.date)])].sort((a, b) => (a || "9999").localeCompare(b || "9999"));
    const owners = ["", ...family.members.map((m) => m.id)];
    const addStop = (e: FormEvent) => {
      e.preventDefault();
      if (!stop.title.trim()) return;
      updateTrip(trip.id, (t) => ({ ...t, stops: [...t.stops, { ...stop, id: makeId(), title: stop.title.trim().slice(0, 160), cost: Math.max(0, Number(stop.cost) || 0) }].slice(0, 300) }));
      setStop({ id: "", date: stop.date, time: "", title: "", cost: 0 });
    };
    const addPack = (items: string[], memberId: string) => updateTrip(trip.id, (t) => {
      const have = new Set(t.packing.filter((p) => p.memberId === memberId).map((p) => p.item.toLowerCase()));
      const fresh: PackItem[] = items.map((i) => i.trim()).filter((i) => i && !have.has(i.toLowerCase())).map((item) => ({ id: makeId(), item: item.slice(0, 100), memberId, packed: false }));
      return { ...t, packing: [...t.packing, ...fresh].slice(0, 400) };
    });
    const spent = planned(trip);
    return <div className="space-y-6">
      <button onClick={() => setOpenId(null)} className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-slate-500 hover:text-violet-700"><ArrowLeft size={16} /> All trips</button>
      <section className="overflow-hidden rounded-[1.5rem] bg-[linear-gradient(115deg,#2b2a8f,#6d4fd8_60%,#f29a14_130%)] p-6 text-white shadow-[0_12px_24px_#2924461f]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><p className="text-xs font-black uppercase tracking-[.2em] text-white/70">{countdown(trip)}</p><h1 className="mt-1 text-3xl font-black">{trip.name}</h1>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-white/85">{trip.destination && <span className="inline-flex items-center gap-1.5"><MapPin size={15} />{trip.destination}</span>}<span>{trip.start ? `${shortDate(trip.start)}${trip.end && trip.end !== trip.start ? ` – ${shortDate(trip.end)}` : ""}` : "No dates yet"}</span></p></div>
          <button onClick={() => setEditing({ ...trip })} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/15 px-3 text-sm font-bold hover:bg-white/25"><Pencil size={15} /> Edit trip</button>
        </div>
        {trip.notes && <p className="mt-4 whitespace-pre-wrap text-sm text-white/85">{trip.notes}</p>}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel eyebrow="Itinerary" title="Day-by-day plan">
          <form onSubmit={addStop} className="mb-5 grid gap-2 sm:grid-cols-[150px_110px_minmax(0,1fr)_100px_auto]">
            <input type="date" value={stop.date} min={trip.start || undefined} max={trip.end || undefined} onChange={(e) => setStop({ ...stop, date: e.target.value })} aria-label="Day" className={inputClass} />
            <input type="time" value={stop.time} onChange={(e) => setStop({ ...stop, time: e.target.value })} aria-label="Time" className={inputClass} />
            <input value={stop.title} maxLength={160} onChange={(e) => setStop({ ...stop, title: e.target.value })} placeholder="Aquarium, check in, dinner at…" aria-label="Plan" className={inputClass} />
            <input type="number" min={0} step="0.01" value={stop.cost || ""} onChange={(e) => setStop({ ...stop, cost: Number(e.target.value) })} placeholder="$ cost" aria-label="Cost" className={inputClass} />
            <button type="submit" className={primary} aria-label="Add to plan"><Plus size={17} /></button>
          </form>
          {trip.stops.length || days.length ? <div className="space-y-5">{groups.map((d) => {
            const list = trip.stops.filter((s) => s.date === d).sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
            return <div key={d || "none"}>
              <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-violet-600">{d ? `${shortDate(d)}${days.includes(d) ? ` · Day ${days.indexOf(d) + 1}` : ""}` : "Any day"}</p>
              {list.length ? <ul className="space-y-1.5">{list.map((s) => <li key={s.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                <span className="w-16 shrink-0 text-xs font-bold text-slate-500">{s.time ? clock12(s.time) : "—"}</span>
                <span className="min-w-0 flex-1 text-sm font-semibold">{s.title}</span>
                {s.cost > 0 && <span className="text-xs font-bold text-slate-500">{money(s.cost)}</span>}
                <button onClick={() => updateTrip(trip.id, (t) => ({ ...t, stops: t.stops.filter((x) => x.id !== s.id) }))} className="rounded-lg p-1.5 text-slate-300 hover:text-rose-500" aria-label={`Remove ${s.title}`}><Trash2 size={14} /></button>
              </li>)}</ul> : <p className="text-xs text-slate-400">Nothing planned yet.</p>}
            </div>;
          })}</div> : <p className="text-sm text-slate-500">Add plans, reservations and drive times. Set trip dates to see each day.</p>}
        </Panel>

        <div className="space-y-5">
          <Panel eyebrow="Budget" title={trip.budget ? `${money(spent)} of ${money(trip.budget)}` : `${money(spent)} planned`} right={<Wallet size={18} className="text-violet-500" />}>
            {trip.budget > 0 ? <><Bar value={spent} max={trip.budget} warn={spent > trip.budget} /><p className="mt-2 text-xs font-semibold text-slate-500">{spent > trip.budget ? `${money(spent - trip.budget)} over budget` : `${money(trip.budget - spent)} left`}</p></> : <p className="text-xs text-slate-500">Set a budget in “Edit trip” to track spending against it.</p>}
          </Panel>
          <Panel eyebrow="Packing" title="Packing list" right={<span className="text-xs font-bold text-slate-500">{trip.packing.filter((p) => p.packed).length}/{trip.packing.length}</span>}>
            <form onSubmit={(e) => { e.preventDefault(); if (pack.item.trim()) { addPack([pack.item], pack.memberId); setPack({ ...pack, item: "" }); } }} className="mb-3 flex gap-2">
              <input value={pack.item} maxLength={100} onChange={(e) => setPack({ ...pack, item: e.target.value })} placeholder="Add an item" aria-label="Packing item" className={inputClass + " min-w-0"} />
              <select value={pack.memberId} onChange={(e) => setPack({ ...pack, memberId: e.target.value })} aria-label="Whose item" className={inputClass + " w-28"}><option value="">Shared</option>{family.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
              <button type="submit" className={primary} aria-label="Add packing item"><Plus size={17} /></button>
            </form>
            <button onClick={() => { addPack(SHARED, ""); family.members.forEach((m) => addPack(BASICS, m.id)); say("Starter packing list added"); }} className={soft + " mb-4 w-full"}><Luggage size={15} /> Fill in the basics for everyone</button>
            <div className="space-y-4">{owners.map((owner) => {
              const items = trip.packing.filter((p) => p.memberId === owner);
              if (!items.length) return null;
              const m = memberOf(family, owner);
              return <div key={owner || "shared"}>
                <p className="mb-1.5 flex items-center gap-2 text-xs font-black text-slate-600">{m ? <Avatar member={m} size="sm" /> : <Luggage size={14} />}{m?.name || "Shared"}</p>
                <ul className="space-y-1">{items.map((p) => <li key={p.id} className="group flex items-center gap-2">
                  <button onClick={() => updateTrip(trip.id, (t) => ({ ...t, packing: t.packing.map((x) => (x.id === p.id ? { ...x, packed: !x.packed } : x)) }))} aria-pressed={p.packed} className="flex min-h-9 flex-1 items-center gap-2 rounded-lg px-1 text-left text-sm">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${p.packed ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent"}`}><Check size={13} /></span>
                    <span className={p.packed ? "text-slate-400 line-through" : "font-medium"}>{p.item}</span>
                  </button>
                  <button onClick={() => updateTrip(trip.id, (t) => ({ ...t, packing: t.packing.filter((x) => x.id !== p.id) }))} className="rounded-lg p-1 text-slate-300 opacity-0 hover:text-rose-500 group-hover:opacity-100 focus:opacity-100" aria-label={`Remove ${p.item}`}><Trash2 size={13} /></button>
                </li>)}</ul>
              </div>;
            })}</div>
          </Panel>
          <button onClick={() => { if (confirmed(`Delete the trip "${trip.name}" and its plans and packing list?`)) { setFamily((f) => ({ ...f, trips: f.trips.filter((t) => t.id !== trip.id) })); setOpenId(null); say("Trip deleted"); } }} className={danger}><Trash2 size={15} /> Delete trip</button>
        </div>
      </div>
      {editing && <TripModal trip={editing} setTrip={setEditing} onSave={saveBasics} onClose={() => setEditing(null)} />}
    </div>;
  }

  return <div className="space-y-6">
    <PageHead eyebrow="Trips" title="Trip planner" blurb="Plan vacations and weekend getaways: dates, a day-by-day plan, a budget and a packing list for every person."
      action={<button onClick={() => setEditing(blankTrip(makeId()))} className={primary + " min-h-11 px-5"}><Plus size={18} /> Plan a trip</button>} />
    {upcoming.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{upcoming.map(tripCard)}</div>
      : <Panel><Empty icon={<Plane size={26} />} title="No trips planned" action={<button onClick={() => setEditing(blankTrip(makeId()))} className={soft}><Plus size={16} /> Plan a trip</button>}>Road trip, beach week or a visit to grandma's. Start with a name and dates.</Empty></Panel>}
    {past.length > 0 && <Panel eyebrow="Memories" title="Past trips"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{past.map(tripCard)}</div></Panel>}
    {editing && <TripModal trip={editing} setTrip={setEditing} onSave={saveBasics} onClose={() => setEditing(null)} />}
  </div>;
}

function TripModal({ trip, setTrip, onSave, onClose }: { trip: Trip; setTrip: (t: Trip) => void; onSave: (e: FormEvent) => void; onClose: () => void }) {
  return <Modal title={trip.name ? "Edit trip" : "Plan a trip"} onClose={onClose}>
    <form onSubmit={onSave} className="space-y-4">
      <Label text="Trip name"><input autoFocus required maxLength={100} value={trip.name} onChange={(e) => setTrip({ ...trip, name: e.target.value })} className={inputClass} placeholder="Summer beach week" /></Label>
      <Label text="Where"><input maxLength={120} value={trip.destination} onChange={(e) => setTrip({ ...trip, destination: e.target.value })} className={inputClass} placeholder="San Diego, CA" /></Label>
      <div className="grid grid-cols-2 gap-4">
        <Label text="Leave"><input type="date" value={trip.start} onChange={(e) => setTrip({ ...trip, start: e.target.value, end: trip.end && trip.end < e.target.value ? e.target.value : trip.end })} className={inputClass} /></Label>
        <Label text="Come home"><input type="date" min={trip.start || undefined} value={trip.end} onChange={(e) => setTrip({ ...trip, end: e.target.value })} className={inputClass} /></Label>
      </div>
      <Label text="Budget (optional)"><input type="number" min={0} step="1" value={trip.budget || ""} onChange={(e) => setTrip({ ...trip, budget: Number(e.target.value) })} className={inputClass + " max-w-[180px]"} placeholder="$" /></Label>
      <Label text="Notes"><textarea rows={3} maxLength={3000} value={trip.notes} onChange={(e) => setTrip({ ...trip, notes: e.target.value })} className={inputClass + " py-3"} placeholder="Hotel confirmation #, pet sitter, who's driving…" /></Label>
      <button type="submit" className={primary + " w-full"}><Check size={17} /> Save trip</button>
    </form>
  </Modal>;
}

