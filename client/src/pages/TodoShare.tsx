// The page family opens from a LifeHub share link. No account needed: the link is the key.
// Shows one part of someone's Family Hub as it is right now, or a poll to vote in.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRoute } from "wouter";
import { CalendarDays, Check, CheckCircle2, Crown, Loader2, MapPin, Plane, RefreshCw, Target, Vote } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import type { SharedView } from "@shared/todoShare";

const NAME_KEY = "arise-share-name";
const VOTER_KEY = "arise-share-voter";
const localDay = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-"); };
const remember = (key: string, value?: string) => { try { if (value === undefined) return localStorage.getItem(key) || ""; localStorage.setItem(key, value); } catch { /* not kept on this device */ } return value || ""; };
function voterId(): string {
  let id = remember(VOTER_KEY);
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) {
    id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    remember(VOTER_KEY, id);
  }
  return id;
}
const day = (date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) => date ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, opts) : "";
const clock = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t || "");
  if (!m) return t;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
};
const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: n % 1 ? 2 : 0 });

type Loaded = { view: SharedView; owner: string; today: string; myVote: { name: string; optionId: string } | null };

export default function TodoShare() {
  const [, params] = useRoute("/share/:token");
  const token = params?.token || "";
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const qs = new URLSearchParams({ today: localDay(), voter: voterId() });
      const response = await fetch(`${API_BASE}/api/todo-share/${encodeURIComponent(token)}?${qs}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.message || "This link isn't working."); setData(null); }
      else { setData(body); setError(""); }
    } catch { setError("Could not reach the site. Check your internet and try again."); }
    finally { setRefreshing(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);
  // A poll's results update while it's open on the screen.
  useEffect(() => {
    if (data?.view.kind !== "poll" || !data.view.open) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(true); }, 15_000);
    return () => window.clearInterval(timer);
  }, [data?.view.kind, data?.view.kind === "poll" && data.view.open, load]);

  const view = data?.view;
  return <div className="min-h-screen bg-[#f6f7fc] px-4 py-8 text-slate-900" data-testid="todo-share">
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-3 text-sm font-semibold text-slate-500">
        <span>Arise LifeHub</span>
        {data && <button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 hover:text-violet-700" aria-label="Refresh"><RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh</button>}
      </div>
      {!data && !error && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}
      {!data && error && <div role="alert" className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">{error}</div>}
      {data && view && <>
        <p className="mb-1 text-xs font-black uppercase tracking-[.18em] text-violet-600">{data.owner ? `Shared by ${data.owner}` : "Shared with you"}</p>
        <h1 className="mb-5 text-2xl font-black tracking-tight sm:text-3xl">{view.kind === "poll" ? view.question : view.title}</h1>
        {view.kind === "poll" && <PollCard token={token} data={data} onVoted={(next) => setData(next)} />}
        {view.kind === "tasks" && <TasksView view={view} today={data.today} />}
        {view.kind === "calendar" && <CalendarView view={view} today={data.today} />}
        {view.kind === "bills" && <BillsView view={view} />}
        {view.kind === "trips" && <TripsView view={view} />}
        {view.kind === "chores" && <ChoresView view={view} today={data.today} />}
        {view.kind === "goals" && <GoalsView view={view} />}
        {view.kind === "health" && <HealthView view={view} today={data.today} />}
      </>}
      <p className="mt-6 text-center text-xs text-slate-400">Anyone with this link can see this page. Only share it with people you trust.</p>
    </div>
  </div>;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-[#e7e8f0] bg-white p-5 shadow-[0_8px_28px_#17152b08] ${className}`}>{children}</section>;
}
function Empty({ children }: { children: ReactNode }) {
  return <Card><p className="text-center text-sm text-slate-500">{children}</p></Card>;
}

function PollCard({ token, data, onVoted }: { token: string; data: Loaded; onVoted: (next: Loaded) => void }) {
  const view = data.view as Extract<SharedView, { kind: "poll" }>;
  const [name, setName] = useState(() => data.myVote?.name || remember(NAME_KEY));
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const mine = data.myVote?.optionId || "";
  const top = Math.max(0, ...view.options.map((o) => o.votes));

  async function vote(optionId: string) {
    const who = name.trim();
    if (!who) { setError("Type your name first so the family knows who voted."); return; }
    setSaving(optionId); setError("");
    try {
      const response = await fetch(`${API_BASE}/api/todo-share/${encodeURIComponent(token)}/vote`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voter: voterId(), name: who, optionId, today: localDay() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.message || "Could not save your vote."); return; }
      remember(NAME_KEY, who);
      onVoted({ ...data, view: body.view, myVote: body.myVote });
    } catch { setError("Could not reach the site. Try again."); }
    finally { setSaving(""); }
  }

  return <Card>
    <p className="flex items-center gap-2 text-sm font-semibold text-slate-500"><Vote size={16} className="text-violet-600" />
      {view.open ? (view.closesOn ? `Voting closes ${view.closesOn === data.today ? "today" : day(view.closesOn)}` : "Voting is open") : "Voting has closed"}</p>
    {view.open && <label className="mt-4 block text-sm font-bold text-slate-700">Your name
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Grandma" className="mt-1 w-full min-h-12 rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" data-testid="share-vote-name" />
    </label>}
    <ul className="mt-4 space-y-2">{view.options.map((o) => {
      const picked = mine === o.id;
      const win = !view.open && top > 0 && o.votes === top;
      return <li key={o.id}>
        <button type="button" disabled={!view.open || !!saving} onClick={() => vote(o.id)} aria-pressed={picked}
          className={`relative w-full overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition ${picked ? "border-violet-500 ring-2 ring-violet-200" : win ? "border-amber-300" : "border-slate-200"} ${view.open ? "hover:border-violet-300" : ""}`}>
          <span className="absolute inset-y-0 left-0 bg-violet-100/70 transition-all" style={{ width: `${view.total ? (o.votes / view.total) * 100 : 0}%` }} />
          <span className="relative flex items-center gap-2">
            {win && <Crown size={16} className="text-amber-500" />}
            <span className="min-w-0 flex-1 font-bold">{o.label}</span>
            {saving === o.id ? <Loader2 size={16} className="animate-spin" /> : picked && <Check size={16} className="text-violet-600" />}
            <span className="w-8 text-right text-sm font-black text-slate-500">{o.votes}</span>
          </span>
        </button>
      </li>;
    })}</ul>
    {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    {mine && view.open && <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16} /> Thanks, {data.myVote?.name}! Your vote is in. Tap another choice to change it.</p>}
    <p className="mt-3 text-xs text-slate-500">{view.total} vote{view.total === 1 ? "" : "s"} so far{view.guests.length ? ` · from the link: ${view.guests.slice(0, 8).join(", ")}${view.guests.length > 8 ? "…" : ""}` : ""}</p>
  </Card>;
}

function TasksView({ view, today }: { view: Extract<SharedView, { kind: "tasks" }>; today: string }) {
  if (!view.lists.some((l) => l.tasks.length)) return <Empty>Nothing on the list right now.</Empty>;
  return <div className="space-y-4">{view.lists.filter((l) => l.tasks.length).map((l) => <Card key={l.name}>
    <h2 className="flex items-center gap-2 font-black"><span className="h-3 w-3 rounded-full" style={{ background: l.color }} />{l.name}</h2>
    <ul className="mt-3 divide-y divide-slate-100">{l.tasks.map((t, i) => <li key={i} className="flex items-start gap-3 py-2.5">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${t.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"}`}>{t.done && <Check size={12} />}</span>
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold ${t.done ? "text-slate-400 line-through" : ""}`}>{t.title}</span>
        <span className="text-xs text-slate-500">{[t.due && (t.due < today && !t.done ? `Overdue · ${day(t.due)}` : t.due === today ? "Today" : day(t.due)), t.time && clock(t.time), t.assignee, t.priority === "high" && "High priority"].filter(Boolean).join(" · ")}</span>
        {t.notes && <span className="mt-1 block whitespace-pre-wrap text-xs text-slate-500">{t.notes}</span>}
      </span>
    </li>)}</ul>
  </Card>)}</div>;
}

function CalendarView({ view, today }: { view: Extract<SharedView, { kind: "calendar" }>; today: string }) {
  if (!view.days.length) return <Empty>Nothing on the calendar for the next two months.</Empty>;
  return <div className="space-y-3">{view.days.map((d) => <Card key={d.date} className="!p-4">
    <h2 className="flex items-center gap-2 text-sm font-black"><CalendarDays size={16} className="text-violet-600" />{d.date === today ? "Today" : day(d.date, { weekday: "long", month: "long", day: "numeric" })}</h2>
    <ul className="mt-2 space-y-2">{d.items.map((e, i) => <li key={i} className="flex gap-3 rounded-xl px-3 py-2" style={{ background: e.color + "14" }}>
      <span className="w-1 shrink-0 rounded-full" style={{ background: e.color }} />
      <span className="min-w-0 flex-1"><span className="block font-bold">{e.title}</span>
        <span className="text-xs text-slate-500">{[e.time ? `${clock(e.time)}${e.endTime ? ` – ${clock(e.endTime)}` : ""}` : "All day", e.location, e.people.join(", ")].filter(Boolean).join(" · ")}</span></span>
    </li>)}</ul>
  </Card>)}</div>;
}

const BILL_STATE: Record<string, { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "bg-emerald-50 text-emerald-700" },
  late: { label: "Late", cls: "bg-rose-50 text-rose-700" },
  soon: { label: "Due soon", cls: "bg-amber-50 text-amber-700" },
  later: { label: "Upcoming", cls: "bg-slate-100 text-slate-600" },
};
function BillsView({ view }: { view: Extract<SharedView, { kind: "bills" }> }) {
  if (!view.bills.length) return <Empty>No bills yet.</Empty>;
  return <Card>
    <p className="text-sm font-semibold text-slate-500">{day(`${view.month}-01`, { month: "long", year: "numeric" })} · {money(view.paid)} of {money(view.total)} paid</p>
    <ul className="mt-3 divide-y divide-slate-100">{view.bills.map((b, i) => <li key={i} className="flex items-center gap-3 py-3">
      <span className="min-w-0 flex-1"><span className="block font-bold">{b.name}</span><span className="text-xs text-slate-500">Due {day(b.due)}{b.category ? ` · ${b.category}` : ""}{b.autopay ? " · Autopay" : ""}</span></span>
      <span className="font-black">{money(b.amount)}</span>
      <span className={`rounded-lg px-2 py-1 text-xs font-bold ${BILL_STATE[b.state]?.cls || ""}`}>{BILL_STATE[b.state]?.label || b.state}</span>
    </li>)}</ul>
  </Card>;
}

function TripsView({ view }: { view: Extract<SharedView, { kind: "trips" }> }) {
  if (!view.trips.length) return <Empty>No upcoming trips.</Empty>;
  return <div className="space-y-4">{view.trips.map((t, i) => <Card key={i}>
    <h2 className="flex items-center gap-2 text-lg font-black"><Plane size={18} className="text-violet-600" />{t.name}</h2>
    <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-slate-500">{t.destination && <span className="inline-flex items-center gap-1"><MapPin size={14} />{t.destination}</span>}<span>{t.start ? `${day(t.start)}${t.end && t.end !== t.start ? ` – ${day(t.end)}` : ""}` : "No dates yet"}</span></p>
    {t.notes && <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{t.notes}</p>}
    {t.stops.length > 0 && <><h3 className="mt-4 text-sm font-black">Plan</h3><ul className="mt-2 space-y-1.5">{t.stops.map((s, j) => <li key={j} className="text-sm"><span className="font-semibold text-slate-500">{[s.date && day(s.date), s.time && clock(s.time)].filter(Boolean).join(" ")}</span> {s.title}</li>)}</ul></>}
    {t.packing.length > 0 && <><h3 className="mt-4 text-sm font-black">Packing list</h3><div className="mt-2 grid gap-3 sm:grid-cols-2">{t.packing.map((p) => <div key={p.person} className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-wider text-slate-500">{p.person}</p>
      <ul className="mt-1 space-y-1">{p.items.map((it, k) => <li key={k} className={`flex items-center gap-2 text-sm ${it.packed ? "text-slate-400 line-through" : ""}`}>{it.packed ? <Check size={13} className="text-emerald-600" /> : <span className="h-3 w-3 rounded-sm border border-slate-300" />}{it.item}</li>)}</ul>
    </div>)}</div></>}
  </Card>)}</div>;
}

function ChoresView({ view, today }: { view: Extract<SharedView, { kind: "chores" }>; today: string }) {
  if (!view.chores.length) return <Empty>No chores yet.</Empty>;
  return <Card className="overflow-x-auto">
    <table className="w-full min-w-[520px] text-sm">
      <thead><tr><th className="py-2 pr-2 text-left font-black">Chore</th>{view.week.map((d) => <th key={d} className={`px-1 py-2 text-center text-xs font-bold ${d === today ? "text-violet-700" : "text-slate-500"}`}>{day(d, { weekday: "short" })}</th>)}</tr></thead>
      <tbody>{view.chores.map((c, i) => <tr key={i} className="border-t border-slate-100">
        <td className="py-2 pr-2 font-semibold">{c.title}{c.points ? <span className="ml-1 text-xs text-amber-600">★{c.points}</span> : null}</td>
        {c.days.map((d) => <td key={d.date} className="px-1 py-2 text-center">{d.due ? <span title={d.person} className={`inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg px-1 text-[11px] font-bold ${d.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{d.done ? <Check size={13} /> : (d.person || "—").slice(0, 6)}</span> : <span className="text-slate-200">·</span>}</td>)}
      </tr>)}</tbody>
    </table>
  </Card>;
}

function GoalsView({ view }: { view: Extract<SharedView, { kind: "goals" }> }) {
  if (!view.goals.length) return <Empty>No goals yet.</Empty>;
  return <div className="grid gap-3 sm:grid-cols-2">{view.goals.map((g, i) => <Card key={i} className="!p-4">
    <h2 className="flex items-start gap-2 font-black"><Target size={17} className={`mt-0.5 shrink-0 ${g.done ? "text-emerald-600" : "text-violet-600"}`} />{g.title}</h2>
    <p className="mt-1 text-xs text-slate-500">{[g.person, g.due && `by ${day(g.due)}`, g.done && "Done!"].filter(Boolean).join(" · ")}</p>
    {g.why && <p className="mt-2 text-sm text-slate-600">{g.why}</p>}
    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.round(g.progress * 100)}%` }} /></div>
    <p className="mt-1 text-xs font-semibold text-slate-500">{g.label}</p>
    {g.steps.length > 0 && <ul className="mt-2 space-y-1">{g.steps.map((s, j) => <li key={j} className={`flex items-center gap-2 text-sm ${s.done ? "text-slate-400 line-through" : ""}`}>{s.done ? <Check size={13} className="text-emerald-600" /> : <span className="h-3 w-3 rounded-full border border-slate-300" />}{s.title}</li>)}</ul>}
  </Card>)}</div>;
}

function HealthView({ view, today }: { view: Extract<SharedView, { kind: "health" }>; today: string }) {
  const g = view.goals;
  return <div className="space-y-3">{view.days.map((d) => <Card key={d.date} className="!p-4">
    <h2 className="text-sm font-black">{d.date === today ? "Today" : day(d.date, { weekday: "long", month: "short", day: "numeric" })}</h2>
    <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      {!view.kid && <Stat label="Calories" value={`${d.calories.toLocaleString()} / ${g.calories.toLocaleString()}`} />}
      {view.kid && <Stat label="Fruits & veggies" value={`${d.fruitVeg} / ${g.fruitVeg}`} />}
      <Stat label="Water" value={`${d.water} / ${g.water} cups`} />
      <Stat label={view.kid ? "Active play" : "Exercise"} value={`${d.minutes} min`} />
      {!view.kid && <Stat label="Steps" value={d.steps.toLocaleString()} />}
    </div>
    {d.meals.length > 0 && <ul className="mt-3 space-y-1 text-sm">{d.meals.map((m, i) => <li key={i} className="flex justify-between gap-2"><span><span className="text-xs font-bold uppercase text-slate-400">{m.meal}</span> {m.name}</span><span className="font-semibold text-slate-500">{m.calories} cal</span></li>)}</ul>}
  </Card>)}</div>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="font-black">{value}</p></div>;
}
