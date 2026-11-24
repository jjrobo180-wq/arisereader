// WorkHub's Behavior plugin: points for the behaviors a teacher chooses, given to one student, a few or the
// whole class, with an optional note. Behavior only: hall passes are their own plugin (HubHallPasses.tsx).
// Each teacher decides whether families and other staff see it (records/RecordsUI.tsx, ShareCard); a note
// can also be kept private one at a time. The server side is server/classBehavior.ts.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Download, Minus, Plus, Trash2, Undo2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSavedChoice } from "@/lib/useSavedChoice";
import { API_BASE } from "@/lib/queryClient";
import { downloadCsv, shortDay } from "@/lib/records";
import { positiveRate, type BehaviorSettings } from "@shared/classBehavior";
import { HubModal } from "./HubModal";
import { Avatar, Btn, ErrorNote, Loading, Panel, PluginHead, ShareCard, Toggle, ink, useRecordsSetup } from "./records/RecordsUI";

type Student = { id: number; name: string; short: string; all: number; week: number; today: number; pos: number; neg: number };
type Ev = { id: string; studentId: number; points: number; label: string; note: string; share: boolean; at: string };
type ClassData = { settings: BehaviorSettings; students: Student[]; recent: Ev[]; serverNow: number };
type View = "class" | "reports" | "settings";

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));
const pointTone = (n: number) => (n > 0 ? "text-emerald-700 dark:text-emerald-300" : n < 0 ? "text-rose-700 dark:text-rose-300" : "text-slate-500");

export default function HubBehavior({ legacy }: { legacy?: ReactNode }) {
  const { token } = useAuth();
  const [view, setView] = useSavedChoice<View>("hub-behavior-view-2", "class", ["class", "reports", "settings"]);
  const [data, setData] = useState<ClassData | null>(null);
  const [error, setError] = useState("");
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [flash, setFlash] = useState<{ text: string; undo?: string[] } | null>(null);
  const records = useRecordsSetup();

  const request = useCallback(async (path: string, options: RequestInit = {}) => {
    const r = await fetch(`${API_BASE}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(body.message || "Something went wrong."), { body, status: r.status });
    return body;
  }, [token]);
  const load = useCallback(async () => {
    try { setData(await request("/api/behavior/class")); setError(""); }
    catch (e: any) { if (e.body?.setup) setSetupNeeded(true); setError(e.message); }
  }, [request]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!flash) return; const t = window.setTimeout(() => setFlash(null), 6000); return () => window.clearTimeout(t); }, [flash]);
  const nameOf = (id: number) => data?.students.find((s) => s.id === id)?.name ?? "Student";
  const familiesSee = !!records.setup?.share.parents.behavior;

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
      setFlash({ text: `${sign(first.points)} ${first.label} · ${ids.length === 1 ? nameOf(ids[0]) : `${ids.length} students`}`, undo: r.added.map((x: Ev) => x.id) });
      setSheet(null); setPicked([]); setSelecting(false); void load();
    } catch (e: any) { setFlash({ text: e.message }); }
  }
  async function undo(ids: string[]) {
    await Promise.all(ids.map((id) => request(`/api/behavior/events/${id}`, { method: "DELETE" }).catch(() => null)));
    setFlash({ text: "Taken back." }); void load();
  }

  if (setupNeeded) return <ErrorNote text="Behavior needs one database step from the site owner: run migrations/class_behavior.sql in Supabase." />;
  const sheetStudents = sheet?.map((id) => data?.students.find((s) => s.id === id)).filter(Boolean) as Student[] | undefined;
  const classToday = data ? data.students.reduce((n, s) => n + s.today, 0) : 0;

  return <div className="space-y-5" data-testid="hub-behavior">
    <PluginHead title="Behavior" blurb="Points for the behaviors you choose, with an optional note." shared={records.setup ? familiesSee : undefined}
      tabs={[{ id: "class", label: "Class" }, { id: "reports", label: "Reports" }, { id: "settings", label: "Settings and sharing" }]} tab={view} setTab={setView} />

    <ErrorNote text={error && !data ? error : ""} retry={() => void load()} />
    {!data && !error && <Loading label="Loading your class…" />}

    {data && view === "class" && <>
      <div className="grid grid-cols-3 gap-3">
        {[["Class today", sign(classToday)], ["Students", String(data.students.length)], ["Positive this week", `${positiveRate({ pos: data.students.reduce((n, s) => n + s.pos, 0), neg: data.students.reduce((n, s) => n + s.neg, 0) })}%`]].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-[#e7e8f0] bg-white p-4 dark:border-white/10 dark:bg-white/[.03]"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{k}</p><p className={`mt-1 text-2xl font-bold tabular-nums ${ink}`}>{v}</p></div>
        ))}
      </div>
      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className={`text-base font-bold ${ink}`}>Your class</h3>
          <div className="flex flex-wrap gap-2">
            {selecting ? <>
              <Btn onClick={() => setPicked(picked.length === data.students.length ? [] : data.students.map((s) => s.id))}>{picked.length === data.students.length ? "Select none" : "Select all"}</Btn>
              <Btn kind="primary" disabled={!picked.length} onClick={() => openSheet(picked)}>Give points to {picked.length}</Btn>
              <Btn onClick={() => { setSelecting(false); setPicked([]); }} title="Stop selecting"><X className="h-4 w-4" /></Btn>
            </> : <>
              <Btn onClick={() => setSelecting(true)} disabled={!data.students.length}>Select students</Btn>
              <Btn kind="primary" onClick={() => openSheet(data.students.map((s) => s.id))} disabled={!data.students.length}>Whole class</Btn>
            </>}
          </div>
        </div>
        {data.students.length ? <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{data.students.map((s) => {
          const on = picked.includes(s.id);
          return <li key={s.id}><button type="button" onClick={() => (selecting ? setPicked((x) => (on ? x.filter((y) => y !== s.id) : [...x, s.id])) : openSheet([s.id]))} aria-pressed={selecting ? on : undefined}
            className={`flex w-full flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition ${on ? "border-[#6e5ae0] bg-[#f4f2ff] ring-1 ring-[#6e5ae0] dark:bg-violet-500/15" : "border-slate-200 hover:border-slate-300 dark:border-white/10"}`}>
            {on ? <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#6e5ae0] text-white"><Check className="h-5 w-5" /></span> : <Avatar id={s.id} name={s.name} size={44} />}
            <span className={`w-full truncate text-sm font-semibold ${ink}`}>{s.short}</span>
            <span className="text-xs tabular-nums text-slate-500"><span className={`font-semibold ${pointTone(s.today)}`}>{sign(s.today)}</span> today · {sign(s.week)} week</span>
          </button></li>;
        })}</ul> : <p className="py-6 text-center text-sm text-slate-500">No students yet. Approve students in the Reader's Approvals and they show up here.</p>}
      </Panel>
      {data.recent.length > 0 && <Panel>
        <h3 className={`mb-3 text-base font-bold ${ink}`}>Recent</h3>
        <ul className="divide-y divide-slate-100 dark:divide-white/10">{data.recent.slice(0, 15).map((e) => <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
          <span className={`w-9 text-right font-bold tabular-nums ${pointTone(e.points)}`}>{sign(e.points)}</span>
          <span className="min-w-0 flex-1"><span className={`font-semibold ${ink}`}>{nameOf(e.studentId)}</span><span className="text-slate-600 dark:text-white/70"> · {e.label}</span>{e.note && <span className="text-slate-500"> · {e.note}</span>}</span>
          <span className="shrink-0 text-xs text-slate-500">{e.share && familiesSee ? "Shared · " : e.share ? "" : "Private · "}{new Date(e.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
          <button type="button" onClick={() => void undo([e.id])} aria-label={`Remove ${e.label} for ${nameOf(e.studentId)}`} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
        </li>)}</ul>
      </Panel>}
    </>}

    {data && view === "reports" && <Reports students={data.students} request={request} legacy={legacy} />}
    {data && view === "settings" && <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <SettingsCard settings={data.settings} save={async (s) => { try { const r = await request("/api/behavior/settings", { method: "PUT", body: JSON.stringify(s) }); setData({ ...data, settings: r.settings }); setFlash({ text: "Behaviors saved." }); } catch (e: any) { setFlash({ text: e.message }); } }} />
      <div className="space-y-5">
        <ShareCard plugin="behavior" share={records.setup?.share} onChange={records.saveShare} />
        <Panel>
          <label className="flex items-center gap-4">
            <span className="min-w-0 flex-1"><span className={`block font-semibold ${ink}`}>Share each new note</span><span className="block text-sm text-slate-500">When families see Behavior, new points and notes go to them unless you switch a note to private.</span></span>
            <Toggle on={data.settings.shareDefault} label="Share new notes with families" onChange={async (v) => { const s = { ...data.settings, shareDefault: v }; setData({ ...data, settings: s }); await request("/api/behavior/settings", { method: "PUT", body: JSON.stringify(s) }).catch(() => null); }} />
          </label>
        </Panel>
      </div>
    </div>}

    {sheet && sheetStudents && data && <HubModal title={sheetStudents.length === 1 ? sheetStudents[0].name : sheetStudents.length === data.students.length ? "Whole class" : `${sheetStudents.length} students`} onClose={() => setSheet(null)} closeOnBackdrop size="lg">
      <div className="space-y-5">
        {sheetStudents.length === 1 && <p className="text-sm text-slate-500">{sign(sheetStudents[0].today)} today · {sign(sheetStudents[0].week)} this week · {positiveRate(sheetStudents[0])}% positive</p>}
        {[{ title: "Positive", list: data.settings.behaviors.filter((b) => b.points >= 0), tone: "border-emerald-200 hover:bg-emerald-50 dark:border-emerald-400/30 dark:hover:bg-emerald-500/10", badge: "bg-emerald-600" },
          { title: "Needs work", list: data.settings.behaviors.filter((b) => b.points < 0), tone: "border-rose-200 hover:bg-rose-50 dark:border-rose-400/30 dark:hover:bg-rose-500/10", badge: "bg-rose-600" }].map((g) => g.list.length > 0 && (
          <div key={g.title}><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{g.title}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{g.list.map((b) => (
              <button key={b.id} type="button" onClick={() => void give(sheet, { behaviorId: b.id })} className={`flex min-h-14 items-center gap-3 rounded-xl border bg-white p-3 text-left transition dark:bg-transparent ${g.tone}`}>
                <span className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-bold tabular-nums text-white ${g.badge}`}>{sign(b.points)}</span>
                <span className={`font-semibold ${ink}`}>{b.label}</span>
              </button>
            ))}</div>
          </div>
        ))}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500" htmlFor="behavior-note">Note (optional)</label>
          <div className="flex gap-2">
            <input id="behavior-note" placeholder="What happened" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[15px] dark:border-white/15 dark:bg-white/5 dark:text-white" />
            <Btn disabled={!note.trim()} onClick={() => void give(sheet, { label: "Note", points: 0 })}>Note only</Btn>
          </div>
        </div>
        <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
          <span className="min-w-0 flex-1 text-sm"><span className={`block font-semibold ${ink}`}>Families see this</span><span className="text-slate-500">{familiesSee ? "The family gets a notification." : "Behavior isn't shared with families yet (Settings and sharing)."}</span></span>
          <Toggle on={share} onChange={setShare} label="Share this with families" />
        </label>
      </div>
    </HubModal>}

    {flash && <div role="status" className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[700] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl">
      <span className="min-w-0 flex-1">{flash.text}</span>
      {flash.undo && <button type="button" onClick={() => void undo(flash.undo!)} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-white/15 px-2.5 font-semibold"><Undo2 className="h-4 w-4" />Undo</button>}
    </div>}
  </div>;
}

function Reports({ students, request, legacy }: { students: Student[]; request: (p: string) => Promise<any>; legacy?: ReactNode }) {
  const [sort, setSort] = useSavedChoice<"week" | "all" | "name">("hub-behavior-sort", "week", ["week", "all", "name"]);
  const [open, setOpen] = useState<Student | null>(null);
  const [hist, setHist] = useState<{ events: Ev[] } | null>(null);
  const [showLegacy, setShowLegacy] = useState(false);
  useEffect(() => { if (!open) return; setHist(null); request(`/api/behavior/students/${open.id}`).then(setHist).catch(() => setHist({ events: [] })); }, [open, request]);
  const rows = useMemo(() => [...students].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : b[sort] - a[sort])), [students, sort]);
  const exportCsv = () => downloadCsv("behavior.csv", [["Student", "Today", "This week", "All time", "Positive points", "Needs-work points", "Positive %"], ...rows.map((s) => [s.name, s.today, s.week, s.all, s.pos, s.neg, positiveRate(s)])]);
  return <div className="space-y-5">
    <Panel>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className={`text-base font-bold ${ink}`}>Points by student</h3>
        <div className="flex gap-2">
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white" aria-label="Sort"><option value="week">This week</option><option value="all">All time</option><option value="name">Name</option></select>
          <Btn onClick={exportCsv}><Download className="h-4 w-4" />CSV</Btn>
        </div>
      </div>
      {rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-slate-500"><tr><th className="pb-2 font-semibold">Student</th><th className="pb-2 text-right font-semibold">Today</th><th className="pb-2 text-right font-semibold">Week</th><th className="pb-2 text-right font-semibold">All</th><th className="pb-2 text-right font-semibold">Positive</th></tr></thead>
        <tbody>{rows.map((s) => <tr key={s.id} className="border-t border-slate-100 dark:border-white/10">
          <td className="py-2.5"><button type="button" onClick={() => setOpen(s)} className={`font-semibold underline decoration-slate-300 underline-offset-4 hover:decoration-[#6e5ae0] ${ink}`}>{s.name}</button></td>
          <td className={`text-right tabular-nums ${pointTone(s.today)}`}>{sign(s.today)}</td><td className="text-right tabular-nums">{sign(s.week)}</td><td className="text-right tabular-nums">{sign(s.all)}</td>
          <td className="text-right"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${positiveRate(s) >= 80 ? "bg-emerald-50 text-emerald-800" : positiveRate(s) >= 60 ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-700"}`}>{positiveRate(s)}%</span></td>
        </tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">No students yet.</p>}
    </Panel>
    {legacy && <Panel><button type="button" onClick={() => setShowLegacy((v) => !v)} className={`text-sm font-semibold ${ink}`}>{showLegacy ? "Hide" : "Show"} the earlier points list</button>{showLegacy && <div className="mt-4">{legacy}</div>}</Panel>}
    {open && <HubModal title={open.name} onClose={() => setOpen(null)} closeOnBackdrop size="lg">
      {!hist ? <Loading /> : <div className="space-y-3">
        <p className="text-sm text-slate-500">{sign(open.week)} this week · {sign(open.all)} all time · {positiveRate(open)}% positive</p>
        {hist.events.length ? <ul className="divide-y divide-slate-100 dark:divide-white/10">{hist.events.slice(0, 100).map((e) => <li key={e.id} className="flex gap-3 py-2 text-sm">
          <span className={`w-9 text-right font-bold tabular-nums ${pointTone(e.points)}`}>{sign(e.points)}</span>
          <span className="min-w-0 flex-1">{e.label}{e.note && <span className="text-slate-500"> · {e.note}</span>}</span>
          <span className="shrink-0 text-xs text-slate-500">{shortDay(e.at, true)}</span>
        </li>)}</ul> : <p className="text-sm text-slate-500">Nothing yet this year.</p>}
      </div>}
    </HubModal>}
  </div>;
}

function SettingsCard({ settings, save }: { settings: BehaviorSettings; save: (s: BehaviorSettings) => void }) {
  const [s, setS] = useState(settings);
  useEffect(() => setS(settings), [settings]);
  const setB = (i: number, patch: Partial<BehaviorSettings["behaviors"][number]>) => setS({ ...s, behaviors: s.behaviors.map((b, k) => (k === i ? { ...b, ...patch } : b)) });
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);
  return <Panel>
    <h3 className={`text-base font-bold ${ink}`}>Behaviors</h3>
    <p className="mt-1 text-sm text-slate-500">Name each behavior and its points: positive to reward, negative for needs work.</p>
    <ul className="mt-4 space-y-2">{s.behaviors.map((b, i) => <li key={`${b.id}-${i}`} className="flex items-center gap-2">
      <input aria-label="Behavior" value={b.label} maxLength={40} onChange={(e) => setB(i, { label: e.target.value })} className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[15px] dark:border-white/15 dark:bg-white/5 dark:text-white" />
      <div className="flex items-center rounded-xl border border-slate-200 dark:border-white/15">
        <button type="button" aria-label="One point less" onClick={() => setB(i, { points: Math.max(-10, b.points - 1) })} className="flex h-11 w-10 items-center justify-center text-slate-600 dark:text-white/70"><Minus className="h-4 w-4" /></button>
        <span className={`w-9 text-center font-bold tabular-nums ${pointTone(b.points)}`}>{sign(b.points)}</span>
        <button type="button" aria-label="One point more" onClick={() => setB(i, { points: Math.min(10, b.points + 1) })} className="flex h-11 w-10 items-center justify-center text-slate-600 dark:text-white/70"><Plus className="h-4 w-4" /></button>
      </div>
      <button type="button" onClick={() => setS({ ...s, behaviors: s.behaviors.filter((_, k) => k !== i) })} aria-label={`Remove ${b.label}`} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
    </li>)}</ul>
    <div className="mt-4 flex flex-wrap gap-2">
      <Btn onClick={() => setS({ ...s, behaviors: [...s.behaviors, { id: "", label: "New behavior", points: 1, emoji: "" }] })}><Plus className="h-4 w-4" />Add a behavior</Btn>
      <Btn kind="primary" disabled={!dirty} onClick={() => save(s)}><Check className="h-4 w-4" />Save behaviors</Btn>
    </div>
  </Panel>;
}
