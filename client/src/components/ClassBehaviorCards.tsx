// Class behavior for students and parents (the teacher side is WorkHub's Behavior tab).
// StudentBehaviorCard: a student's points from their teacher, and asking for a hall pass with a live timer.
// ParentBehaviorCard: what each linked child's teacher shared (points, notes) and their hall passes.
import { useCallback, useEffect, useState } from "react";
import { DoorOpen, Loader2, Send, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { minutesOut } from "@shared/classBehavior";

type Ev = { id: string; points: number; label: string; note: string; at: string };
type Pass = { id: string; place: string; status: "asked" | "out" | "back" | "denied"; limit: number; askedAt: string; outAt: string | null; backAt: string | null };
type Totals = { all: number; week: number; today: number; pos: number; neg: number };
const clock = (min: number) => `${Math.floor(min)}:${String(Math.round((min % 1) * 60)).padStart(2, "0")}`;
const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

function useApi() {
  const { token } = useAuth();
  return useCallback(async (path: string, options: RequestInit = {}) => {
    const r = await fetch(`${API_BASE}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(body.message || "Something went wrong."), { status: r.status, body });
    return body;
  }, [token]);
}

export function StudentBehaviorCard() {
  const api = useApi();
  const [d, setD] = useState<{ hasClass: boolean; points?: Totals; recent?: Ev[]; canAsk?: boolean; places?: { id: string; label: string; minutes: number }[]; pass?: Pass | null; serverNow?: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => { try { const x = await api("/api/behavior/me"); setD(x); if (x.serverNow) setOffset(x.serverNow - Date.now()); } catch { setD(null); } }, [api]);
  useEffect(() => { void load(); const t = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 8000); return () => window.clearInterval(t); }, [load]);
  useEffect(() => { if (!d?.pass) return; const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, [d?.pass]);
  if (!d?.hasClass) return null;
  const act = async (path: string, body?: object) => { setBusy(true); setMsg(""); try { await api(path, { method: "POST", body: JSON.stringify(body || {}) }); setPicking(false); await load(); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); } };
  const p = d.pass, m = p ? minutesOut({ out_at: p.outAt, back_at: null }, now + offset) : 0;
  return <section className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-sm" data-testid="student-behavior">
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-3"><span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Sparkles className="h-5 w-5" /></span>
        <div><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Class points</div><div className="text-xl font-black">{d.points?.week ?? 0} this week <span className="text-sm font-semibold text-muted-foreground">· {sign(d.points?.today ?? 0)} today</span></div></div></div>
      <div className="ml-auto flex flex-wrap gap-2">
        {p?.status === "out" ? <div className={`flex items-center gap-3 rounded-xl px-3 py-2 ${m > p.limit ? "bg-rose-100 text-rose-900" : "bg-amber-100 text-amber-950"}`}><DoorOpen className="h-5 w-5" /><span className="text-sm font-semibold">{p.place}</span><span className="text-xl font-black tabular-nums">{clock(m)}</span>
            <button type="button" disabled={busy} onClick={() => void act("/api/behavior/me/pass/back")} className="min-h-10 rounded-lg bg-black px-3 text-sm font-bold text-white">I'm back</button></div>
          : p?.status === "asked" ? <div className="flex items-center gap-2 rounded-xl bg-sky-100 px-3 py-2 text-sm font-semibold text-sky-950"><Loader2 className="h-4 w-4 animate-spin" />Asked for {p.place}. Waiting for your teacher…
            <button type="button" disabled={busy} onClick={() => void act("/api/behavior/me/pass/cancel")} className="min-h-9 rounded-lg px-2 underline">Cancel</button></div>
          : d.canAsk && <button type="button" onClick={() => setPicking((x) => !x)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-bold text-background"><DoorOpen className="h-4 w-4" />Hall pass</button>}
      </div>
    </div>
    {picking && !p && <div className="mt-3 flex flex-wrap gap-2">{d.places?.map((pl) => <button key={pl.id} type="button" disabled={busy} onClick={() => void act("/api/behavior/me/pass", { place: pl.id })} className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted">{pl.label}</button>)}</div>}
    {msg && <p className="mt-2 text-sm text-rose-600" role="alert">{msg}</p>}
    {!!d.recent?.length && <ul className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">{d.recent.slice(0, 6).map((e) => <li key={e.id} className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${e.points >= 0 ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{e.points !== 0 && `${sign(e.points)} `}{e.label}</li>)}</ul>}
  </section>;
}

type Child = { id: number; name: string; points: Totals; recent: Ev[]; passes: Pass[] };
export function ParentBehaviorCard() {
  const api = useApi();
  const [kids, setKids] = useState<Child[] | null>(null);
  const [pick, setPick] = useState(0);
  useEffect(() => { api("/api/behavior/children").then((r) => setKids(r.children)).catch(() => setKids([])); }, [api]);
  if (!kids?.length) return null;
  const k = kids[Math.min(pick, kids.length - 1)];
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="parent-behavior">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">At school</p><h2 className="text-xl font-black">{k.name}'s behavior</h2></div>
      {kids.length > 1 && <div className="flex gap-1">{kids.map((c, i) => <button key={c.id} type="button" onClick={() => setPick(i)} aria-pressed={i === pick} className={`min-h-10 rounded-full px-3 text-sm font-semibold ${i === pick ? "bg-slate-900 text-white" : "border border-slate-200"}`}>{c.name}</button>)}</div>}
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2 text-center">{([["Today", k.points.today], ["This week", k.points.week], ["Positive", `${k.points.pos + k.points.neg ? Math.round((100 * k.points.pos) / (k.points.pos + k.points.neg)) : 100}%`]] as const).map(([l, v]) =>
      <div key={l} className="rounded-2xl bg-slate-50 p-3"><div className="text-2xl font-black">{typeof v === "number" ? sign(v) : v}</div><div className="text-xs font-semibold text-slate-500">{l}</div></div>)}</div>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div><p className="mb-2 text-sm font-bold">From the teacher</p>
        {k.recent.length ? <ul className="space-y-1.5">{k.recent.slice(0, 10).map((e) => <li key={e.id} className="flex gap-2 text-sm"><span className={`w-9 shrink-0 font-bold ${e.points > 0 ? "text-emerald-600" : e.points < 0 ? "text-rose-600" : "text-slate-400"}`}>{e.points ? sign(e.points) : <Send className="h-3.5 w-3.5" />}</span><span className="min-w-0 flex-1">{e.label}{e.note && <span className="text-slate-500"> — {e.note}</span>}</span><span className="shrink-0 text-xs text-slate-400">{new Date(e.at).toLocaleDateString([], { month: "short", day: "numeric" })}</span></li>)}</ul>
          : <p className="text-sm text-slate-500">Nothing shared yet.</p>}</div>
      <div><p className="mb-2 text-sm font-bold">Hall passes</p>
        {k.passes.length ? <ul className="space-y-1.5 text-sm">{k.passes.slice(0, 8).map((p) => <li key={p.id} className="flex justify-between gap-2"><span>{p.place}</span><span className="text-slate-500">{new Date(p.askedAt).toLocaleDateString([], { weekday: "short" })} {p.outAt && new Date(p.outAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{p.status === "out" ? " · out now" : p.outAt && p.backAt ? ` · ${clock(minutesOut({ out_at: p.outAt, back_at: p.backAt }, Date.now()))}` : ""}</span></li>)}</ul>
          : <p className="text-sm text-slate-500">No passes in the last two weeks.</p>}</div>
    </div>
  </section>;
}
