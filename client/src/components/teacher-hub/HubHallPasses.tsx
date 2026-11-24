// WorkHub's Hall passes plugin: who's out, where, and for how long, with a live timer that turns red past the
// place's time limit. Start a pass in two taps, mark a student back in one, and see the day's and each
// student's history. Families and other staff see passes when the teacher shares them (ShareCard).
// The passes themselves are kept by server/classBehavior.ts.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock3, Download, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSavedChoice } from "@/lib/useSavedChoice";
import { API_BASE } from "@/lib/queryClient";
import { downloadCsv, shortDay } from "@/lib/records";
import { minutesOut, type BehaviorSettings } from "@shared/classBehavior";
import { HubModal } from "./HubModal";
import { Avatar, Btn, ErrorNote, Loading, Panel, PluginHead, ShareCard, ink, useRecordsSetup } from "./records/RecordsUI";

type Student = { id: number; name: string; short: string };
type Pass = { id: string; studentId: number; place: string; status: "asked" | "out" | "back" | "denied"; limit: number; askedAt: string; outAt: string | null; backAt: string | null };
type Data = { settings: BehaviorSettings; students: Student[]; passes: Pass[]; serverNow: number };
type View = "now" | "history" | "settings";

/** "4:07" (minutes:seconds). */
const clock = (min: number) => `${Math.floor(min)}:${String(Math.floor((min % 1) * 60)).padStart(2, "0")}`;

export default function HubHallPasses() {
  const { token } = useAuth();
  const [view, setView] = useSavedChoice<View>("hub-passes-view", "now", ["now", "history", "settings"]);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [flash, setFlash] = useState("");
  const records = useRecordsSetup();

  const request = useCallback(async (path: string, options: RequestInit = {}) => {
    const r = await fetch(`${API_BASE}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(body.message || "Something went wrong."), { body, status: r.status });
    return body;
  }, [token]);
  const load = useCallback(async () => {
    try { const d = await request("/api/behavior/class"); setData(d); setOffset(d.serverNow - Date.now()); setError(""); }
    catch (e: any) { setError(e.message); }
  }, [request]);
  useEffect(() => { void load(); const t = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15_000); return () => window.clearInterval(t); }, [load]);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  useEffect(() => { if (!flash) return; const t = window.setTimeout(() => setFlash(""), 5000); return () => window.clearTimeout(t); }, [flash]);

  const serverNow = now + offset;
  const out = data?.passes.filter((p) => p.status === "out") ?? [];
  const backToday = data?.passes.filter((p) => p.status === "back") ?? [];
  const nameOf = (id: number) => data?.students.find((s) => s.id === id)?.name ?? "Student";
  const firstOf = (id: number) => nameOf(id).split(" ")[0];

  const [starting, setStarting] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  async function start(studentId: number, place: string) {
    try { await request("/api/behavior/passes", { method: "POST", body: JSON.stringify({ studentId, place }) }); setStarting(null); setSearch(""); setFlash(`${firstOf(studentId)} is out: ${data?.settings.places.find((p) => p.id === place)?.label}.`); void load(); }
    catch (e: any) { setFlash(e.message); }
  }
  async function back(p: Pass) {
    try { await request(`/api/behavior/passes/${p.id}/back`, { method: "POST", body: "{}" }); setFlash(`${firstOf(p.studentId)} is back.`); void load(); }
    catch (e: any) { setFlash(e.message); }
  }
  const filtered = useMemo(() => (data?.students ?? []).filter((s) => !search.trim() || s.name.toLowerCase().includes(search.trim().toLowerCase())), [data, search]);
  const outIds = new Set(out.map((p) => p.studentId));

  return <div className="space-y-5" data-testid="hub-hall-passes">
    <PluginHead title="Hall passes" blurb="Who's out of class, where, and for how long." shared={records.setup ? !!records.setup.share.parents.passes : undefined}
      tabs={[{ id: "now", label: "Out now", count: out.filter((p) => minutesOut({ out_at: p.outAt, back_at: null }, serverNow) > p.limit).length }, { id: "history", label: "History" }, { id: "settings", label: "Settings and sharing" }]} tab={view} setTab={setView} />
    <ErrorNote text={error && !data ? error : ""} retry={() => void load()} />
    {!data && !error && <Loading label="Loading passes…" />}

    {data && view === "now" && <>
      <Panel>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className={`text-base font-bold ${ink}`}>Out now <span className="font-normal text-slate-500">· {out.length} of {data.settings.maxOut} allowed</span></h3>
        </div>
        {out.length ? <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{out.map((p) => {
          const m = minutesOut({ out_at: p.outAt, back_at: null }, serverNow), over = m > p.limit;
          return <li key={p.id} className={`flex items-center gap-3 rounded-2xl border p-4 ${over ? "border-rose-300 bg-rose-50 dark:border-rose-400/40 dark:bg-rose-500/10" : "border-slate-200 dark:border-white/10"}`}>
            <Avatar id={p.studentId} name={nameOf(p.studentId)} size={42} />
            <div className="min-w-0 flex-1"><p className={`truncate font-semibold ${ink}`}>{nameOf(p.studentId)}</p><p className="text-sm text-slate-500">{p.place} · {p.limit} min limit</p></div>
            <div className="text-right"><p className={`text-2xl font-bold tabular-nums ${over ? "text-rose-700" : ink}`} aria-label={`${Math.floor(m)} minutes out`}>{clock(m)}</p>{over && <p className="text-xs font-semibold text-rose-700">Over time</p>}</div>
            <Btn kind="primary" onClick={() => void back(p)}><Check className="h-4 w-4" />Back</Btn>
          </li>;
        })}</ul> : <p className="py-4 text-sm text-slate-500">Everyone's in class.</p>}
      </Panel>
      <Panel>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className={`text-base font-bold ${ink}`}>Start a pass</h3>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a student" aria-label="Find a student" className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm sm:w-64 dark:border-white/15 dark:bg-white/5 dark:text-white" />
        </div>
        {data.students.length ? <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{filtered.map((s) => (
          <li key={s.id}><button type="button" disabled={outIds.has(s.id)} onClick={() => setStarting(s.id)} className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 p-2.5 text-left transition hover:border-slate-300 disabled:opacity-45 dark:border-white/10">
            <Avatar id={s.id} name={s.name} size={32} /><span className={`min-w-0 flex-1 truncate text-sm font-semibold ${ink}`}>{s.short}</span>{outIds.has(s.id) && <span className="text-[11px] font-semibold text-slate-500">Out</span>}
          </button></li>
        ))}</ul> : <p className="text-sm text-slate-500">No students yet.</p>}
      </Panel>
      {backToday.length > 0 && <Panel>
        <h3 className={`mb-3 text-base font-bold ${ink}`}>Back today</h3>
        <PassTable passes={backToday} nameOf={nameOf} serverNow={serverNow} />
      </Panel>}
    </>}

    {data && view === "history" && <History students={data.students} request={request} />}

    {data && view === "settings" && <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Places settings={data.settings} save={async (s) => { try { const r = await request("/api/behavior/settings", { method: "PUT", body: JSON.stringify(s) }); setData({ ...data, settings: r.settings }); setFlash("Pass settings saved."); } catch (e: any) { setFlash(e.message); } }} />
      <ShareCard plugin="passes" share={records.setup?.share} onChange={records.saveShare} />
    </div>}

    {starting !== null && data && <HubModal title={`Pass for ${nameOf(starting)}`} onClose={() => setStarting(null)} closeOnBackdrop size="md">
      <p className="mb-3 text-sm text-slate-500">Where to? The timer starts now.</p>
      <div className="grid grid-cols-2 gap-2">{data.settings.places.map((pl) => (
        <button key={pl.id} type="button" onClick={() => void start(starting, pl.id)} className="flex min-h-16 flex-col items-start justify-center rounded-xl border border-slate-200 px-4 text-left transition hover:border-[#6e5ae0] hover:bg-[#f4f2ff] dark:border-white/10 dark:hover:bg-violet-500/10">
          <span className={`font-semibold ${ink}`}>{pl.label}</span><span className="text-sm text-slate-500">{pl.minutes} min</span>
        </button>
      ))}</div>
      {out.length >= data.settings.maxOut && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{out.length} already out. Your limit is {data.settings.maxOut}; you can still start this one.</p>}
    </HubModal>}

    {flash && <div role="status" className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[700] mx-auto max-w-md rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl">{flash}</div>}
  </div>;
}

function PassTable({ passes, nameOf, serverNow }: { passes: Pass[]; nameOf?: (id: number) => string; serverNow: number }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm">
    <thead className="text-xs uppercase tracking-wider text-slate-500"><tr>{nameOf && <th className="pb-2 font-semibold">Student</th>}<th className="pb-2 font-semibold">Where</th><th className="pb-2 font-semibold">Out</th><th className="pb-2 font-semibold">Back</th><th className="pb-2 text-right font-semibold">Minutes</th></tr></thead>
    <tbody>{passes.map((p) => { const m = minutesOut({ out_at: p.outAt, back_at: p.backAt }, serverNow), over = m > p.limit; return <tr key={p.id} className="border-t border-slate-100 dark:border-white/10">
      {nameOf && <td className={`py-2.5 font-semibold ${ink}`}>{nameOf(p.studentId)}</td>}<td className="py-2.5">{p.place}</td>
      <td>{p.outAt ? shortDay(p.outAt, true) : ""}</td><td>{p.backAt ? new Date(p.backAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Still out"}</td>
      <td className={`text-right tabular-nums ${over ? "font-semibold text-rose-700" : ""}`}>{m.toFixed(1)}{over ? ` (limit ${p.limit})` : ""}</td>
    </tr>; })}</tbody></table></div>;
}

function History({ students, request }: { students: Student[]; request: (p: string) => Promise<any> }) {
  const [sid, setSid] = useState(students[0]?.id ?? 0);
  const [passes, setPasses] = useState<Pass[] | null>(null);
  useEffect(() => { if (!sid) return; setPasses(null); request(`/api/behavior/students/${sid}`).then((r) => setPasses((r.passes as Pass[]).filter((p) => p.status === "back" || p.status === "out"))).catch(() => setPasses([])); }, [sid, request]);
  const name = students.find((s) => s.id === sid)?.name || "student";
  const total = (passes ?? []).reduce((n, p) => n + minutesOut({ out_at: p.outAt, back_at: p.backAt }, Date.now()), 0);
  return <Panel>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h3 className={`text-base font-bold ${ink}`}>Passes by student <span className="font-normal text-slate-500">· last 60 days</span></h3>
      <div className="flex gap-2">
        <select value={sid} onChange={(e) => setSid(Number(e.target.value))} aria-label="Student" className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white">{students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <Btn disabled={!passes?.length} onClick={() => downloadCsv(`hall-passes-${name.replace(/\s+/g, "-").toLowerCase()}.csv`, [["Where", "Out", "Back", "Minutes", "Limit"], ...(passes ?? []).map((p) => [p.place, p.outAt, p.backAt, minutesOut({ out_at: p.outAt, back_at: p.backAt }, Date.now()), p.limit])])}><Download className="h-4 w-4" />CSV</Btn>
      </div>
    </div>
    {!passes ? <Loading /> : passes.length ? <>
      <p className="mb-3 flex items-center gap-2 text-sm text-slate-500"><Clock3 className="h-4 w-4" />{passes.length} {passes.length === 1 ? "pass" : "passes"} · {Math.round(total)} minutes out of class · {passes.filter((p) => minutesOut({ out_at: p.outAt, back_at: p.backAt }, Date.now()) > p.limit).length} over the limit</p>
      <PassTable passes={passes} serverNow={Date.now()} />
    </> : <p className="text-sm text-slate-500">No passes for {name.split(" ")[0]} in the last 60 days.</p>}
  </Panel>;
}

function Places({ settings, save }: { settings: BehaviorSettings; save: (s: BehaviorSettings) => void }) {
  const [s, setS] = useState(settings);
  useEffect(() => setS(settings), [settings]);
  const setP = (i: number, patch: Partial<BehaviorSettings["places"][number]>) => setS({ ...s, places: s.places.map((p, k) => (k === i ? { ...p, ...patch } : p)) });
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);
  const field = "min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-[15px] dark:border-white/15 dark:bg-white/5 dark:text-white";
  return <Panel>
    <h3 className={`text-base font-bold ${ink}`}>Places and time limits</h3>
    <p className="mt-1 text-sm text-slate-500">A pass turns red once it's out longer than its place's limit.</p>
    <ul className="mt-4 space-y-2">{s.places.map((p, i) => <li key={`${p.id}-${i}`} className="flex items-center gap-2">
      <input aria-label="Place" value={p.label} maxLength={30} onChange={(e) => setP(i, { label: e.target.value })} className={`min-w-0 flex-1 ${field}`} />
      <label className="flex items-center gap-2 text-sm text-slate-500"><input aria-label={`Minutes for ${p.label}`} type="number" min={1} max={60} value={p.minutes} onChange={(e) => setP(i, { minutes: Number(e.target.value) })} className={`w-20 ${field}`} />min</label>
      <button type="button" onClick={() => setS({ ...s, places: s.places.filter((_, k) => k !== i) })} aria-label={`Remove ${p.label}`} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
    </li>)}</ul>
    <label className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
      <span><span className={`block font-semibold ${ink}`}>Students out at once</span><span className="text-sm text-slate-500">You're warned past this; you can still let someone go.</span></span>
      <input type="number" min={1} max={30} value={s.maxOut} onChange={(e) => setS({ ...s, maxOut: Number(e.target.value) })} aria-label="Students out at once" className={`w-20 ${field}`} />
    </label>
    <div className="mt-4 flex flex-wrap gap-2">
      <Btn onClick={() => setS({ ...s, places: [...s.places, { id: "", label: "New place", minutes: 5 }] })}><Plus className="h-4 w-4" />Add a place</Btn>
      <Btn kind="primary" disabled={!dirty} onClick={() => save(s)}><Check className="h-4 w-4" />Save</Btn>
      {dirty && <Btn onClick={() => setS(settings)}><X className="h-4 w-4" />Undo changes</Btn>}
    </div>
  </Panel>;
}
