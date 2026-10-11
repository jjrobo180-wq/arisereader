// WorkHub's Behavior tab, built like LiveSchool: tap a student (or select a few, or the whole class) and
// tap a behavior to give points, with an optional note that can go to parents. Hall passes run live: students
// ask from their own account, the teacher approves with one tap, and a timer shows who's out and for how long.
// Reports show each student's points; Settings holds the behaviors, pass places and limits.
// The server side is server/classBehavior.ts. The old Hub-only points list stays under "My notes".
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Check, CheckSquare, Clock3, DoorOpen, Plus, Send, Settings2, Trash2, Undo2, Users, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { minutesOut, positiveRate, type BehaviorSettings } from "@shared/classBehavior";
import { Card, Empty, Field, PrimaryButton } from "./ui";
import { HubModal } from "./HubModal";

type Student = { id: number; name: string; short: string; all: number; week: number; today: number; pos: number; neg: number };
type Ev = { id: string; studentId: number; points: number; label: string; note: string; share: boolean; at: string };
type Pass = { id: string; studentId: number; place: string; status: "asked" | "out" | "back" | "denied"; limit: number; askedAt: string; outAt: string | null; backAt: string | null };
type ClassData = { settings: BehaviorSettings; students: Student[]; recent: Ev[]; passes: Pass[]; serverNow: number };
type View = "class" | "passes" | "reports" | "settings" | "notes";

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const clock = (min: number) => `${Math.floor(min)}:${String(Math.round((min % 1) * 60)).padStart(2, "0")}`;

export default function HubBehavior({ legacy }: { legacy: ReactNode }) {
  const { token } = useAuth();
  const [view, setView] = useState<View>(() => { try { return (sessionStorage.getItem("hub-behavior-view") as View) || "class"; } catch { return "class"; } });
  const pickView = (v: View) => { setView(v); try { sessionStorage.setItem("hub-behavior-view", v); } catch { /* not kept */ } };
  const [data, setData] = useState<ClassData | null>(null);
  const [error, setError] = useState("");
  const [setup, setSetup] = useState(false);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [flash, setFlash] = useState<{ text: string; undo?: string[] } | null>(null);

  const request = useCallback(async (path: string, options: RequestInit = {}) => {
    const r = await fetch(`${API_BASE}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(body.message || "Something went wrong."), { body, status: r.status });
    return body;
  }, [token]);
  const load = useCallback(async () => {
    try { const d = await request("/api/behavior/class"); setData(d); setOffset(d.serverNow - Date.now()); setError(""); }
    catch (e: any) { if (e.body?.setup) setSetup(true); setError(e.message); }
  }, [request]);
  useEffect(() => { void load(); const t = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 10_000); return () => window.clearInterval(t); }, [load]);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  useEffect(() => { if (!flash) return; const t = window.setTimeout(() => setFlash(null), 6000); return () => window.clearTimeout(t); }, [flash]);

  const serverNow = now + offset;
  const asked = data?.passes.filter((p) => p.status === "asked") ?? [];
  const out = data?.passes.filter((p) => p.status === "out") ?? [];
  const nameOf = (id: number) => data?.students.find((s) => s.id === id)?.name ?? "Student";

  /* ---- giving points ---- */
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [sheet, setSheet] = useState<number[] | null>(null);
  const [note, setNote] = useState("");
  const [share, setShare] = useState(true);
  const openSheet = (ids: number[]) => { setNote(""); setShare(data?.settings.shareDefault ?? true); setSheet(ids); };
  async function give(ids: number[], body: Record<string, unknown>) {
    try {
      const r = await request("/api/behavior/points", { method: "POST", body: JSON.stringify({ studentIds: ids, note: note.trim(), share, ...body }) });
      const first = r.added[0];
      setFlash({ text: `${first.points > 0 ? "+" : ""}${first.points} ${first.label} · ${ids.length === 1 ? nameOf(ids[0]) : `${ids.length} students`}${share ? " · shared with parents" : ""}`, undo: r.added.map((x: Ev) => x.id) });
      setSheet(null); setPicked([]); setSelecting(false); void load();
    } catch (e: any) { setFlash({ text: e.message }); }
  }
  async function undo(ids: string[]) {
    await Promise.all(ids.map((id) => request(`/api/behavior/events/${id}`, { method: "DELETE" }).catch(() => null)));
    setFlash({ text: "Taken back." }); void load();
  }

  /* ---- passes ---- */
  async function passAct(p: Pass, act: "approve" | "deny" | "back", force = false) {
    try { await request(`/api/behavior/passes/${p.id}/${act}`, { method: "POST", body: JSON.stringify({ force }) }); void load(); }
    catch (e: any) {
      if (e.body?.full && window.confirm(`${e.message} Let ${nameOf(p.studentId).split(" ")[0]} go anyway?`)) return passAct(p, act, true);
      setFlash({ text: e.message });
    }
  }
  async function startPass(studentId: number, place: string) {
    try { await request("/api/behavior/passes", { method: "POST", body: JSON.stringify({ studentId, place }) }); setSheet(null); setFlash({ text: `${nameOf(studentId).split(" ")[0]} is out: ${data?.settings.places.find((p) => p.id === place)?.label}.` }); void load(); }
    catch (e: any) { setFlash({ text: e.message }); }
  }

  if (setup) return <div className="space-y-4">
    <Card title="Behavior"><div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />Class behavior, hall passes and parent sharing need one more database step from the site owner: run <code>migrations/class_behavior.sql</code> in Supabase. Until then, your own points list below still works.</div></Card>
    {legacy}
  </div>;

  const tabs: { id: View; label: string; icon: ReactNode; count?: number }[] = [
    { id: "class", label: "Class", icon: <Users className="h-4 w-4" /> },
    { id: "passes", label: "Hall passes", icon: <DoorOpen className="h-4 w-4" />, count: asked.length },
    { id: "reports", label: "Reports", icon: <CheckSquare className="h-4 w-4" /> },
    { id: "settings", label: "Settings", icon: <Settings2 className="h-4 w-4" /> },
    { id: "notes", label: "My notes", icon: <Clock3 className="h-4 w-4" /> },
  ];
  const sheetStudents = sheet?.map((id) => data?.students.find((s) => s.id === id)).filter(Boolean) as Student[] | undefined;

  return <div className="space-y-4" data-testid="hub-behavior">
    <div role="tablist" className="flex gap-1.5 overflow-x-auto rounded-2xl bg-slate-100 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={view === t.id} onClick={() => pickView(t.id)}
        className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold ${view === t.id ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}>
        {t.icon}{t.label}{!!t.count && <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-bold leading-5 text-white">{t.count}</span>}</button>)}
    </div>

    {(asked.length > 0 || out.length > 0) && view !== "passes" && <button type="button" onClick={() => pickView("passes")} className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-950">
      <DoorOpen className="h-4 w-4" />{asked.length > 0 && <b>{asked.length} asking for a pass</b>}{out.length > 0 && <span>{out.map((p) => `${nameOf(p.studentId).split(" ")[0]} (${p.place}, ${clock(minutesOut({ out_at: p.outAt, back_at: null }, serverNow))})`).join(" · ")} out now</span>}
    </button>}

    {error && !data && <Card title="Behavior"><p className="text-sm text-red-700">{error}</p></Card>}
    {!data && !error && <Card title="Behavior"><Empty>Loading your class…</Empty></Card>}

    {data && view === "class" && <Card title={`Your class · ${data.students.length}`} right={<div className="flex gap-2">
      {selecting ? <>
        <button type="button" onClick={() => setPicked(picked.length === data.students.length ? [] : data.students.map((s) => s.id))} className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold">{picked.length === data.students.length ? "None" : "All"}</button>
        <button type="button" disabled={!picked.length} onClick={() => openSheet(picked)} className="min-h-10 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white disabled:opacity-40">Give points ({picked.length})</button>
        <button type="button" onClick={() => { setSelecting(false); setPicked([]); }} aria-label="Stop selecting" className="min-h-10 rounded-xl px-2 text-slate-500"><X className="h-4 w-4" /></button>
      </> : <>
        <button type="button" onClick={() => setSelecting(true)} className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold">Select</button>
        <button type="button" onClick={() => openSheet(data.students.map((s) => s.id))} disabled={!data.students.length} className="min-h-10 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white disabled:opacity-40">Whole class</button>
      </>}</div>}>
      {data.students.length ? <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{data.students.map((s) => {
        const on = picked.includes(s.id), pass = data.passes.find((p) => p.studentId === s.id && (p.status === "out" || p.status === "asked"));
        return <li key={s.id}><button type="button" onClick={() => selecting ? setPicked((x) => on ? x.filter((y) => y !== s.id) : [...x, s.id]) : openSheet([s.id])} aria-pressed={selecting ? on : undefined}
          className={`relative flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 p-3 text-center transition active:scale-95 ${on ? "border-teal-600 bg-teal-50" : "border-slate-200 hover:border-slate-300"}`}>
          {s.today !== 0 && <span className={`absolute right-2 top-2 rounded-full px-1.5 text-xs font-bold ${s.today > 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}`}>{s.today > 0 ? "+" : ""}{s.today}</span>}
          <span className={`inline-flex h-12 w-12 items-center justify-center rounded-full text-base font-bold ${on ? "bg-teal-700 text-white" : "bg-slate-900 text-white"}`}>{on ? <Check className="h-5 w-5" /> : initials(s.name)}</span>
          <span className="w-full truncate text-sm font-semibold">{s.short}</span>
          <span className="text-xs text-slate-500">{s.week} this week</span>
          {pass && <span className={`rounded-full px-2 text-[11px] font-bold ${pass.status === "out" ? "bg-amber-100 text-amber-900" : "bg-sky-100 text-sky-900"}`}>{pass.status === "out" ? `Out · ${pass.place}` : "Asking for pass"}</span>}
        </button></li>; })}</ul>
        : <Empty>No students in your class yet. Approve students in the Reader's Approvals tab and they show up here.</Empty>}
    </Card>}

    {data && view === "class" && data.recent.length > 0 && <Card title="Today and recent" collapseKey="behavior-recent">
      <ul className="space-y-1.5">{data.recent.slice(0, 12).map((e) => <li key={e.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-slate-50">
        <span className={`w-10 text-center font-bold ${e.points > 0 ? "text-emerald-600" : e.points < 0 ? "text-rose-600" : "text-slate-400"}`}>{e.points > 0 ? "+" : ""}{e.points}</span>
        <span className="min-w-0 flex-1"><b className="font-semibold">{nameOf(e.studentId)}</b> · {e.label}{e.note && <span className="text-slate-500"> — {e.note}</span>}</span>
        {e.share && <Send className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-label="Shared with parents" />}
        <span className="shrink-0 text-xs text-slate-400">{new Date(e.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
      </li>)}</ul></Card>}

    {data && view === "passes" && <>
      <Card title={`Asking${asked.length ? ` (${asked.length})` : ""}`}>
        {asked.length ? <ul className="space-y-2">{asked.map((p) => <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-3">
          <div className="min-w-0 flex-1"><b>{nameOf(p.studentId)}</b><div className="text-sm text-slate-600">{p.place} · up to {p.limit} min · asked {Math.max(0, Math.round((serverNow - Date.parse(p.askedAt)) / 60000))} min ago</div></div>
          <button type="button" onClick={() => void passAct(p, "approve")} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white"><Check className="h-4 w-4" />Let go</button>
          <button type="button" onClick={() => void passAct(p, "deny")} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold"><X className="h-4 w-4" />Not now</button>
        </li>)}</ul> : <Empty>No one is asking. Students ask from their A.R.I.S.E. account{data.settings.studentAsk ? "" : " once you turn that on in Settings"}.</Empty>}
      </Card>
      <Card title={`Out now · ${out.length} of ${data.settings.maxOut}`}>
        {out.length ? <ul className="grid gap-2 sm:grid-cols-2">{out.map((p) => { const m = minutesOut({ out_at: p.outAt, back_at: null }, serverNow), over = m > p.limit;
          return <li key={p.id} className={`flex items-center gap-3 rounded-2xl border-2 p-3 ${over ? "border-rose-400 bg-rose-50" : "border-amber-300 bg-amber-50"}`}>
            <div className="min-w-0 flex-1"><b>{nameOf(p.studentId)}</b><div className="text-sm">{p.place}</div></div>
            <div className={`text-2xl font-black tabular-nums ${over ? "text-rose-700" : "text-amber-900"}`}>{clock(m)}</div>
            <button type="button" onClick={() => void passAct(p, "back")} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white">Back</button>
          </li>; })}</ul> : <Empty>Everyone's in class.</Empty>}
      </Card>
      <Card title="Start a pass" collapseKey="behavior-start-pass"><StartPass students={data.students} places={data.settings.places} onStart={startPass} /></Card>
      <Card title="Today's passes" collapseKey="behavior-pass-log">
        {data.passes.filter((p) => p.status === "back").length ? <ul className="space-y-1 text-sm">{data.passes.filter((p) => p.status === "back").map((p) => { const m = minutesOut({ out_at: p.outAt, back_at: p.backAt }, serverNow);
          return <li key={p.id} className="flex justify-between gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-50"><span><b className="font-semibold">{nameOf(p.studentId)}</b> · {p.place}</span><span className={m > p.limit ? "font-semibold text-rose-700" : "text-slate-500"}>{p.outAt && new Date(p.outAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {clock(m)}</span></li>; })}</ul> : <Empty>No passes yet today.</Empty>}
      </Card>
    </>}

    {data && view === "reports" && <Reports students={data.students} request={request} />}
    {data && view === "settings" && <SettingsCard settings={data.settings} save={async (s) => { try { const r = await request("/api/behavior/settings", { method: "PUT", body: JSON.stringify(s) }); setData({ ...data, settings: r.settings }); setFlash({ text: "Settings saved." }); } catch (e: any) { setFlash({ text: e.message }); } }} />}
    {view === "notes" && legacy}

    {sheet && sheetStudents && data && <HubModal title={sheetStudents.length === 1 ? sheetStudents[0].name : sheetStudents.length === data.students.length ? "Whole class" : `${sheetStudents.length} students`} onClose={() => setSheet(null)} closeOnBackdrop size="lg">
      <div className="space-y-4">
        {sheetStudents.length === 1 && <p className="text-sm text-slate-500">{sheetStudents[0].today >= 0 ? "+" : ""}{sheetStudents[0].today} today · {sheetStudents[0].week} this week · {positiveRate(sheetStudents[0])}% positive</p>}
        <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-700">Great job</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{data.settings.behaviors.filter((b) => b.points >= 0).map((b) => <button key={b.id} type="button" onClick={() => void give(sheet, { behaviorId: b.id })} className="flex min-h-16 items-center gap-2 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-2.5 text-left active:scale-95"><span className="text-2xl" aria-hidden>{b.emoji}</span><span className="min-w-0 flex-1 text-sm font-semibold leading-tight">{b.label}</span><span className="font-black text-emerald-700">+{b.points}</span></button>)}</div></div>
        <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-rose-700">Needs work</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{data.settings.behaviors.filter((b) => b.points < 0).map((b) => <button key={b.id} type="button" onClick={() => void give(sheet, { behaviorId: b.id })} className="flex min-h-16 items-center gap-2 rounded-2xl border-2 border-rose-200 bg-rose-50 p-2.5 text-left active:scale-95"><span className="text-2xl" aria-hidden>{b.emoji}</span><span className="min-w-0 flex-1 text-sm font-semibold leading-tight">{b.label}</span><span className="font-black text-rose-700">{b.points}</span></button>)}</div></div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Field placeholder="Add a note (optional)" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
          <button type="button" disabled={!note.trim()} onClick={() => void give(sheet, { label: "Note", points: 0 })} className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold disabled:opacity-40">Send note only</button>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="h-5 w-5" /><span><b>Share with parents</b> · they see it in LifeHub and get a notification</span></label>
        {sheetStudents.length === 1 && <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Hall pass</p>
          <div className="flex flex-wrap gap-2">{data.settings.places.map((p) => <button key={p.id} type="button" onClick={() => void startPass(sheetStudents[0].id, p.id)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-950"><DoorOpen className="h-4 w-4" />{p.label} · {p.minutes}m</button>)}</div></div>}
      </div>
    </HubModal>}

    {flash && <div role="status" className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[700] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm text-white shadow-2xl">
      <span className="min-w-0 flex-1">{flash.text}</span>
      {flash.undo && <button type="button" onClick={() => void undo(flash.undo!)} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-white/15 px-2.5 font-semibold"><Undo2 className="h-4 w-4" />Undo</button>}
    </div>}
  </div>;
}

function StartPass({ students, places, onStart }: { students: Student[]; places: BehaviorSettings["places"]; onStart: (studentId: number, place: string) => void }) {
  const [sid, setSid] = useState(0);
  const [place, setPlace] = useState(places[0]?.id ?? "");
  return <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
    <select value={sid} onChange={(e) => setSid(Number(e.target.value))} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm" aria-label="Student"><option value={0}>Pick a student</option>{students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
    <select value={place} onChange={(e) => setPlace(e.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm" aria-label="Where">{places.map((p) => <option key={p.id} value={p.id}>{p.label} ({p.minutes} min)</option>)}</select>
    <PrimaryButton disabled={!sid} onClick={() => onStart(sid, place)}><DoorOpen className="h-4 w-4" /> Start pass</PrimaryButton>
  </div>;
}

function Reports({ students, request }: { students: Student[]; request: (p: string) => Promise<any> }) {
  const [sort, setSort] = useState<"week" | "all" | "name">("week");
  const [open, setOpen] = useState<Student | null>(null);
  const [hist, setHist] = useState<{ events: Ev[]; passes: Pass[] } | null>(null);
  useEffect(() => { if (!open) return; setHist(null); request(`/api/behavior/students/${open.id}`).then(setHist).catch(() => setHist({ events: [], passes: [] })); }, [open, request]);
  const rows = useMemo(() => [...students].sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : b[sort] - a[sort]), [students, sort]);
  return <Card title="Points by student" right={<select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-2 text-sm" aria-label="Sort"><option value="week">This week</option><option value="all">All time</option><option value="name">Name</option></select>}>
    {rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="text-xs uppercase text-slate-400"><tr><th className="pb-2">Student</th><th className="pb-2 text-right">Today</th><th className="pb-2 text-right">Week</th><th className="pb-2 text-right">All</th><th className="pb-2 text-right">Positive</th></tr></thead>
      <tbody>{rows.map((s) => <tr key={s.id} className="border-t border-slate-100"><td className="py-2"><button type="button" onClick={() => setOpen(s)} className="font-semibold text-teal-800 underline decoration-teal-200 underline-offset-4">{s.name}</button></td><td className="text-right tabular-nums">{s.today}</td><td className="text-right tabular-nums">{s.week}</td><td className="text-right tabular-nums">{s.all}</td>
        <td className="text-right"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${positiveRate(s) >= 80 ? "bg-emerald-50 text-emerald-800" : positiveRate(s) >= 60 ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-700"}`}>{positiveRate(s)}%</span></td></tr>)}</tbody></table></div> : <Empty>No students yet.</Empty>}
    {open && <HubModal title={open.name} onClose={() => setOpen(null)} closeOnBackdrop size="lg">
      {!hist ? <Empty>Loading…</Empty> : <div className="space-y-4">
        <p className="text-sm text-slate-500">{open.week} this week · {open.all} all time · {positiveRate(open)}% positive</p>
        <ul className="space-y-1.5">{hist.events.slice(0, 80).map((e) => <li key={e.id} className="flex gap-3 text-sm"><span className={`w-10 font-bold ${e.points > 0 ? "text-emerald-600" : e.points < 0 ? "text-rose-600" : "text-slate-400"}`}>{e.points > 0 ? "+" : ""}{e.points}</span><span className="min-w-0 flex-1">{e.label}{e.note && <span className="text-slate-500"> — {e.note}</span>}</span><span className="text-xs text-slate-400">{new Date(e.at).toLocaleDateString([], { month: "short", day: "numeric" })}</span></li>)}</ul>
        {hist.passes.length > 0 && <div><p className="mb-1 text-xs font-bold uppercase text-slate-500">Hall passes (60 days)</p><ul className="space-y-1 text-sm">{hist.passes.filter((p) => p.status !== "denied").map((p) => <li key={p.id}>{new Date(p.askedAt).toLocaleDateString([], { month: "short", day: "numeric" })} · {p.place}{p.outAt ? ` · ${clock(minutesOut({ out_at: p.outAt, back_at: p.backAt }, Date.now()))}` : ""}</li>)}</ul></div>}
      </div>}
    </HubModal>}
  </Card>;
}

function SettingsCard({ settings, save }: { settings: BehaviorSettings; save: (s: BehaviorSettings) => void }) {
  const [s, setS] = useState(settings);
  useEffect(() => setS(settings), [settings]);
  const setB = (i: number, patch: Partial<BehaviorSettings["behaviors"][number]>) => setS({ ...s, behaviors: s.behaviors.map((b, k) => (k === i ? { ...b, ...patch } : b)) });
  const setP = (i: number, patch: Partial<BehaviorSettings["places"][number]>) => setS({ ...s, places: s.places.map((p, k) => (k === i ? { ...p, ...patch } : p)) });
  return <div className="space-y-4">
    <Card title="Behaviors">
      <ul className="space-y-2">{s.behaviors.map((b, i) => <li key={b.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)_5rem_auto] gap-2">
        <Field aria-label="Emoji" value={b.emoji} maxLength={4} onChange={(e) => setB(i, { emoji: e.target.value })} />
        <Field aria-label="Behavior" value={b.label} maxLength={40} onChange={(e) => setB(i, { label: e.target.value })} />
        <Field aria-label="Points" type="number" min={-10} max={10} value={b.points} onChange={(e) => setB(i, { points: Number(e.target.value) })} />
        <button type="button" onClick={() => setS({ ...s, behaviors: s.behaviors.filter((_, k) => k !== i) })} aria-label={`Remove ${b.label}`} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
      </li>)}</ul>
      <button type="button" onClick={() => setS({ ...s, behaviors: [...s.behaviors, { id: "", label: "New behavior", points: 1, emoji: "⭐" }] })} className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-teal-800"><Plus className="h-4 w-4" />Add a behavior</button>
    </Card>
    <Card title="Hall passes">
      <ul className="space-y-2">{s.places.map((p, i) => <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_6rem_auto] gap-2">
        <Field aria-label="Place" value={p.label} maxLength={30} onChange={(e) => setP(i, { label: e.target.value })} />
        <Field aria-label="Minutes" type="number" min={1} max={60} value={p.minutes} onChange={(e) => setP(i, { minutes: Number(e.target.value) })} />
        <button type="button" onClick={() => setS({ ...s, places: s.places.filter((_, k) => k !== i) })} aria-label={`Remove ${p.label}`} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
      </li>)}</ul>
      <button type="button" onClick={() => setS({ ...s, places: [...s.places, { id: "", label: "New place", minutes: 5 }] })} className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-teal-800"><Plus className="h-4 w-4" />Add a place</button>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold">Students out at once<Field type="number" min={1} max={30} value={s.maxOut} onChange={(e) => setS({ ...s, maxOut: Number(e.target.value) })} className="mt-1" /></label>
      </div>
      <label className="mt-3 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={s.studentAsk} onChange={(e) => setS({ ...s, studentAsk: e.target.checked })} />Students can ask for a pass from their own A.R.I.S.E. account</label>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={s.shareDefault} onChange={(e) => setS({ ...s, shareDefault: e.target.checked })} />Share points and notes with parents unless I turn it off</label>
    </Card>
    <div><PrimaryButton onClick={() => save(s)}><Check className="h-4 w-4" /> Save settings</PrimaryButton></div>
  </div>;
}
