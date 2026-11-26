// Life Score (LifeHub section "lifescore"): every part of a life scored from Apple Health, a one-minute check-in
// and the rest of LifeHub (shared/lifeScore.ts). Overview (the Life Score ring, today's best move, Apple Health
// today, six areas and every score with its trend, patterns), the check-in, 30-day trends, each score's page
// (history, the research, how to improve, to-dos to add), and settings (Apple Health, age, screenings, which
// scores count).
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Activity, CalendarCheck, Check, ChevronLeft, ChevronRight, Flame, Footprints, HeartPulse, Minus, Moon, Plus, RefreshCw, Settings2, Sparkles, Wind } from "lucide-react";
import { useHubTasks } from "@/lib/hubTasksBridge";
import { connectLifeHealth, lifeHealthOff, lifeHealthOn, lifeHealthPossible, readLifeHealth } from "@/lib/lifeScoreHealth";
import {
  AREAS, METRICS, SCREENINGS, emptyLifeScore, factsFor, labelFor, lifeInputFrom, lifeScore, plusDays, preventionParts, screeningStatus,
  type AreaId, type LifeCheckIn, type LifeScoreData, type MetricId, type MetricResult, type ScreeningId,
} from "@shared/lifeScore";
import { inputClass, type SectionProps } from "./ui";
import { API_BASE } from "@/lib/queryClient";
import { lastDays, type LifeInput } from "@shared/lifeScore";
import { lifeStats, type AnyTask } from "@shared/lifeStats";
import { SCALES, scoreScale, type Labs, type ScaleId } from "@shared/lifeScales";
import { ChartView, Explorer, Records, SectionPage, StatsHome } from "./LifeStatsViews";

type View = { kind: "overview" } | { kind: "checkin" } | { kind: "trends" } | { kind: "settings" } | { kind: "metric"; id: MetricId } | { kind: "area"; id: AreaId }
  | { kind: "stats" } | { kind: "section"; id: string } | { kind: "explore" } | { kind: "records" } | { kind: "measures" } | { kind: "scale"; id: ScaleId } | { kind: "labs" };
type Tab = "overview" | "stats" | "explore" | "records" | "checkin";
const TABS: { id: Tab; label: string }[] = [{ id: "overview", label: "Score" }, { id: "stats", label: "Stats" }, { id: "explore", label: "Explore" }, { id: "records", label: "Records" }, { id: "checkin", label: "Check in" }];
const tabOf = (v: View): Tab => (v.kind === "stats" || v.kind === "section" ? "stats" : v.kind === "explore" ? "explore" : v.kind === "records" ? "records" : v.kind === "checkin" || v.kind === "measures" || v.kind === "scale" || v.kind === "labs" ? "checkin" : "overview");

/** Other hubs' to-dos and records, and the Health & Fitness diary, read when Life Score opens (read only). */
type Extra = { fit?: any; work?: any; otherTasks?: any[]; otherLists?: any[] };
const FIT_KEY = "arise-fit-data";
function useExtra(token: string | null | undefined, familySpace: boolean): Extra {
  const [extra, setExtra] = useState<Extra>(() => { try { const f = JSON.parse(localStorage.getItem(FIT_KEY) || "null"); return f ? { fit: f } : {}; } catch { return {}; } });
  useEffect(() => {
    if (!token) return;
    let live = true;
    const get = (path: string) => fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    void Promise.all([get("/api/fit/data"), get("/api/teacher-hub/workspace"), get(familySpace ? "/api/arise-todo/workspace" : "/api/family-space/workspace")]).then(([fit, work, other]) => {
      if (!live) return;
      setExtra((e) => ({ fit: fit?.data ?? e.fit, work: work?.workspace ?? undefined, otherTasks: Array.isArray(other?.workspace?.tasks) ? other.workspace.tasks : [], otherLists: Array.isArray(other?.workspace?.lists) ? other.workspace.lists : [] }));
    });
    return () => { live = false; };
  }, [token, familySpace]);
  return extra;
}

const scoreColor = (s: number | null) => (s === null ? "#cbd5e1" : s >= 85 ? "#10b981" : s >= 70 ? "#22c55e" : s >= 50 ? "#f59e0b" : "#ef4444");
const areaOf = (id: AreaId) => AREAS.find((a) => a.id === id)!;
const metricDef = (id: MetricId) => METRICS.find((m) => m.id === id)!;
const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// ——— Charts (plain SVG) ————————————————————————————————————————————————————————————————————————————————————————
function Ring({ value, color, size = 64, stroke = 7, children }: { value: number | null; color: string; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.14} strokeWidth={stroke} />
        {value !== null && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} style={{ transition: "stroke-dasharray .6s ease" }} />}
      </svg>
      <span className="absolute inset-0 grid place-items-center">{children}</span>
    </span>
  );
}

/** The Life Score: six arcs, one per area, each filled to its score. */
function AreaRing({ areas, size = 196 }: { areas: { score: number | null; color: string }[]; size?: number }) {
  const stroke = 14, r = (size - stroke) / 2, c = 2 * Math.PI * r, gap = 6, seg = c / areas.length;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
      {areas.map((a, i) => {
        const len = seg - gap, fill = ((a.score ?? 0) / 100) * len, off = -(i * seg);
        return <g key={i}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={a.color} strokeOpacity={0.15} strokeWidth={stroke} strokeDasharray={`${len} ${c}`} strokeDashoffset={off} strokeLinecap="round" />
          {a.score !== null && fill > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={a.color} strokeWidth={stroke} strokeDasharray={`${fill} ${c}`} strokeDashoffset={off} strokeLinecap="round" style={{ transition: "stroke-dasharray .7s ease" }} />}
        </g>;
      })}
    </svg>
  );
}

/** A line through the days that have a score (gaps stay gaps). */
function Spark({ series, color, width = 84, height = 28, fill = false, full = false }: { series: (number | null)[]; color: string; width?: number; height?: number; fill?: boolean; /** Stretch to the card's width. */ full?: boolean }) {
  const pts = series.map((v, i) => (v === null ? null : [(i / Math.max(1, series.length - 1)) * width, height - 2 - (v / 100) * (height - 4)] as const));
  const runs: (readonly [number, number])[][] = [];
  let cur: (readonly [number, number])[] = [];
  for (const p of pts) { if (p) cur.push(p); else if (cur.length) { runs.push(cur); cur = []; } }
  if (cur.length) runs.push(cur);
  if (!runs.length) return <svg width={width} height={height} aria-hidden="true"><line x1="0" x2={width} y1={height - 2} y2={height - 2} stroke="#e2e8f0" strokeDasharray="3 4" /></svg>;
  return (
    <svg width={full ? "100%" : width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio={full ? "none" : undefined} aria-hidden="true" className="block overflow-visible">
      {runs.map((run, i) => <g key={i}>
        {fill && run.length > 1 && <path d={`M${run[0][0]},${height} ${run.map((p) => `L${p[0]},${p[1]}`).join(" ")} L${run[run.length - 1][0]},${height} Z`} fill={color} fillOpacity={0.1} />}
        {run.length > 1 ? <polyline points={run.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" /> : <circle cx={run[0][0]} cy={run[0][1]} r={2.5} fill={color} />}
      </g>)}
      {!full && (() => { const last = [...pts].reverse().find(Boolean); return last ? <circle cx={last[0]} cy={last[1]} r={3} fill={color} stroke="white" strokeWidth={1.5} /> : null; })()}
    </svg>
  );
}

/** 30 days as bars, today on the right. */
function Bars({ series, dates, color }: { series: (number | null)[]; dates: string[]; color: string }) {
  return (
    <div>
      <div className="flex h-32 items-end gap-[3px]">
        {series.map((v, i) => <div key={i} className="group relative flex-1" style={{ height: "100%" }} title={`${shortDate(dates[i])}: ${v ?? "—"}`}>
          <div className="absolute inset-x-0 bottom-0 rounded-t-[3px]" style={{ height: v === null ? 3 : `${Math.max(4, v)}%`, background: v === null ? "#e2e8f0" : color, opacity: v === null ? 1 : i === series.length - 1 ? 1 : 0.55 }} />
        </div>)}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-medium text-slate-400"><span>{shortDate(dates[0])}</span><span>{shortDate(dates[Math.floor(dates.length / 2)])}</span><span>Today</span></div>
    </div>
  );
}

// ——— Small controls ————————————————————————————————————————————————————————————————————————————————————————————
function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const cls = `rounded-[22px] border border-slate-200/70 bg-white p-4 sm:p-5 ${className}`;
  return onClick ? <button type="button" onClick={onClick} className={`${cls} block w-full text-left transition hover:border-slate-300 active:scale-[.99]`}>{children}</button> : <div className={cls}>{children}</div>;
}
const Eyebrow = ({ children }: { children: ReactNode }) => <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{children}</p>;
const Pill = ({ s }: { s: number | null }) => <span className="inline-flex min-w-[40px] justify-center rounded-full px-2 py-0.5 text-[13px] font-bold tabular-nums" style={{ background: `${scoreColor(s)}1a`, color: s === null ? "#94a3b8" : scoreColor(s) }}>{s ?? "—"}</span>;

function Scale({ label, hint, value, onChange, low, high }: { label: string; hint?: string; value?: number; onChange: (v?: number) => void; low: string; high: string }) {
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-2"><p className="text-[15px] font-semibold text-slate-800">{label}</p>{value !== undefined && <span className="text-sm font-bold tabular-nums text-slate-900">{value}/10</span>}</div>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      <div className="mt-2 grid grid-cols-11 gap-1" role="radiogroup" aria-label={label}>
        {Array.from({ length: 11 }, (_, n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => onChange(value === n ? undefined : n)}
            className={`h-9 rounded-xl text-[13px] font-bold tabular-nums transition ${value === n ? "bg-slate-900 text-white" : value !== undefined && n < value ? "bg-slate-200 text-slate-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{n}</button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-400"><span>{low}</span><span>{high}</span></div>
    </div>
  );
}
function YesNo({ label, hint, value, onChange }: { label: string; hint?: string; value?: boolean; onChange: (v?: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0"><p className="text-[15px] font-semibold text-slate-800">{label}</p>{hint && <p className="text-xs text-slate-500">{hint}</p>}</div>
      <div className="flex shrink-0 gap-1 rounded-xl bg-slate-100 p-1">
        {([true, false] as const).map((b) => <button key={String(b)} type="button" aria-pressed={value === b} onClick={() => onChange(value === b ? undefined : b)}
          className={`min-h-9 min-w-[52px] rounded-lg px-3 text-sm font-bold transition ${value === b ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{b ? "Yes" : "No"}</button>)}
      </div>
    </div>
  );
}
function Stepper({ label, hint, value, onChange, step, unit, max }: { label: string; hint?: string; value?: number; onChange: (v?: number) => void; step: number; unit: string; max: number }) {
  const v = value ?? 0;
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0"><p className="text-[15px] font-semibold text-slate-800">{label}</p>{hint && <p className="text-xs text-slate-500">{hint}</p>}</div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" aria-label={`Less ${label}`} onClick={() => onChange(value === undefined ? 0 : Math.max(0, Math.round((v - step) * 100) / 100))} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"><Minus className="h-4 w-4" /></button>
        <button type="button" onClick={() => onChange(value === undefined ? 0 : undefined)} className={`min-w-[72px] text-center text-[15px] font-bold tabular-nums ${value === undefined ? "text-slate-300" : "text-slate-900"}`}>{value === undefined ? "—" : `${v} ${unit}`}</button>
        <button type="button" aria-label={`More ${label}`} onClick={() => onChange(Math.min(max, Math.round((v + step) * 100) / 100))} className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-white hover:bg-slate-700"><Plus className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <Card><Eyebrow>{title}</Eyebrow><div className="mt-1 divide-y divide-slate-100">{children}</div></Card>
);

// ——— The app ————————————————————————————————————————————————————————————————————————————————————————————————
type HubTask = { title: string; due: string; done: boolean; createdAt?: string; completedAt?: string; listId?: string; priority?: string; archived?: boolean; repeat?: string };
type Props = SectionProps & { token?: string | null; lifeTasks?: HubTask[]; lists?: { id: string; name: string }[]; familySpace?: boolean };

export default function LifeScoreApp({ family, setFamily, today, say, token, lifeTasks, lists, familySpace = false }: Props) {
  const bridge = useHubTasks();
  const [view, setView] = useState<View>({ kind: "overview" });
  const [syncing, setSyncing] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const data: LifeScoreData = family.lifeScore ?? emptyLifeScore();
  const update = (fn: (d: LifeScoreData) => LifeScoreData) => setFamily((f) => ({ ...f, lifeScore: fn(f.lifeScore ?? emptyLifeScore()) }));
  const extra = useExtra(token, familySpace);
  // Every hub's to-dos: this hub's (with lists and times), the other personal hub's, and WorkHub's.
  const allTasks: AnyTask[] = useMemo(() => {
    const here: AnyTask["hub"] = familySpace ? "FamilyHub" : "LifeHub", there: AnyTask["hub"] = familySpace ? "LifeHub" : "FamilyHub";
    const own = (lifeTasks ?? (bridge?.tasks ?? []).map((t) => ({ title: t.title, due: t.dueDate, done: t.done }))) as HubTask[];
    const listName = (all: { id: string; name: string }[] | undefined, id?: string) => all?.find((l) => l.id === id)?.name;
    const workLists = Array.isArray(extra.work?.taskLists) ? extra.work.taskLists : [];
    return [
      ...own.filter((t) => !t.archived).map((t) => ({ title: t.title, due: t.due || "", done: t.done, createdAt: t.createdAt, completedAt: t.completedAt, list: listName(lists, t.listId), priority: t.priority, repeat: t.repeat, hub: here })),
      ...(extra.otherTasks ?? []).filter((t: any) => t && !t.archived && t.title).map((t: any) => ({ title: String(t.title), due: String(t.due || ""), done: !!t.done, createdAt: t.createdAt, completedAt: t.completedAt, list: listName(extra.otherLists, t.listId), hub: there })),
      ...(Array.isArray(extra.work?.tasks) ? extra.work.tasks : []).filter((t: any) => t && !t.archived && t.title).map((t: any) => ({ title: String(t.title), due: String(t.dueDate || ""), done: !!t.done, completedAt: t.done && t.lastDone ? `${t.lastDone}T12:00:00` : undefined, list: listName(workLists, t.listId), priority: t.priority, hub: "WorkHub" as const })),
    ];
  }, [lifeTasks, bridge?.tasks, lists, extra, familySpace]);
  const tasks = useMemo(() => allTasks.map((t) => ({ due: t.due, done: t.done })), [allTasks]);
  const input: LifeInput = useMemo(() => ({ ...lifeInputFrom(family, tasks), fit: extra.fit }), [family, tasks, extra.fit]);
  const result = useMemo(() => lifeScore(input, today), [input, today]);
  // Stats are worked out only once one of their screens is open (they read everything).
  const tab = tabOf(view);
  const stats = useMemo(() => (tab === "stats" || tab === "explore" || tab === "records" ? lifeStats({ today, family, tasks: allTasks, work: extra.work, fit: extra.fit, ls: data, score: result }) : null), [tab, today, family, allTasks, extra, data, result]);
  const go = (v: View) => { setView(v); top.current?.scrollIntoView({ block: "start" }); };

  // Apple Health: read on opening (at most every 30 minutes) once connected.
  const sync = async (quiet = false) => {
    setSyncing(true);
    try {
      const days = await readLifeHealth(30);
      update((d) => ({ ...d, health: { ...d.health, ...days }, healthAt: new Date().toISOString() }));
      if (!quiet) say(Object.keys(days).length ? "Apple Health is up to date." : "Apple Health shared nothing yet. Check Settings → Health → Data Access & Devices → Arise To Do.");
    } catch (e: any) { if (!quiet) say(e?.message || "Couldn't read Apple Health."); }
    finally { setSyncing(false); }
  };
  useEffect(() => {
    if (!lifeHealthOn()) return;
    const last = Date.parse(data.healthAt || "") || 0;
    if (Date.now() - last > 30 * 60_000) void sync(true);
    // Read once when the section opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const connect = async () => { try { await connectLifeHealth(); await sync(); } catch (e: any) { say(e?.message || "Apple Health didn't connect."); } };
  const addTodo = (title: string) => { if (!bridge) { say("Open To-dos to add it."); return; } bridge.add(title, "From Life Score"); say(`Added "${title}" to your to-dos.`); };

  return (
    <div ref={top} className="mx-auto w-full max-w-3xl scroll-mt-24 pb-10" data-testid="life-score">
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="Life Score">
        {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => go({ kind: t.id } as View)} data-testid={`life-score-tab-${t.id}`}
          className={`min-h-10 flex-1 whitespace-nowrap rounded-xl px-3 text-[13px] font-bold transition ${tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{t.label}</button>)}
      </div>
      {view.kind === "stats" && stats && <StatsHome sections={stats.sections} insights={[...result.patterns.map((p) => p.text), ...stats.insights]} open={(id) => go({ kind: "section", id })} />}
      {view.kind === "section" && stats && (() => { const sec = stats.sections.find((x) => x.id === view.id); return sec ? <SectionPage section={sec} back={() => go({ kind: "stats" })} /> : null; })()}
      {view.kind === "explore" && stats && <Explorer series={stats.series} today={today} lastDays={lastDays} />}
      {view.kind === "records" && stats && <Records records={stats.records} insights={stats.insights} patterns={result.patterns.map((p) => p.text)} />}
      {view.kind === "measures" && <Measures data={data} today={today} back={() => go({ kind: "checkin" })} open={(id) => go({ kind: "scale", id })} />}
      {view.kind === "scale" && <ScaleForm id={view.id} data={data} today={today} update={update} back={() => go({ kind: "measures" })} />}
      {view.kind === "labs" && <LabsView data={data} today={today} update={update} back={() => go({ kind: "checkin" })} />}
      {view.kind === "overview" && <Overview data={data} result={result} today={today} go={go} syncing={syncing} sync={() => void sync()} connect={() => void connect()} addTodo={addTodo} />}
      {view.kind === "checkin" && <CheckIn data={data} today={today} update={update} back={() => go({ kind: "overview" })} openMeasures={() => go({ kind: "measures" })} openLabs={() => go({ kind: "labs" })} />}
      {view.kind === "trends" && <Trends result={result} back={() => go({ kind: "overview" })} go={go} />}
      {view.kind === "settings" && <SettingsView data={data} today={today} update={update} back={() => go({ kind: "overview" })} syncing={syncing} sync={() => void sync()} connect={() => void connect()} />}
      {view.kind === "area" && <AreaView id={view.id} result={result} back={() => go({ kind: "overview" })} go={go} />}
      {view.kind === "metric" && <MetricView id={view.id} result={result} family={family} tasks={tasks} today={today} back={() => go({ kind: "overview" })} addTodo={addTodo} openSettings={() => go({ kind: "settings" })} />}
    </div>
  );
}

function Back({ onClick, label = "Life Score" }: { onClick: () => void; label?: string }) {
  return <button type="button" onClick={onClick} className="mb-3 inline-flex min-h-10 items-center gap-1 rounded-full pr-3 text-sm font-semibold text-slate-500 hover:text-slate-900"><ChevronLeft className="h-5 w-5" />{label}</button>;
}

type R = ReturnType<typeof lifeScore>;
function Overview({ data, result, today, go, syncing, sync, connect, addTodo }: { data: LifeScoreData; result: R; today: string; go: (v: View) => void; syncing: boolean; sync: () => void; connect: () => void; addTodo: (t: string) => void }) {
  const checked = !!data.days[today];
  const focus = result.focus ? metricDef(result.focus.id) : null;
  const t = result.today;
  const healthTiles: { icon: ReactNode; label: string; value: string; color: string }[] = [
    { icon: <Footprints className="h-4 w-4" />, label: "Steps", value: t.steps !== undefined ? t.steps.toLocaleString() : "—", color: "#ff5a5f" },
    { icon: <Flame className="h-4 w-4" />, label: "Active cal", value: t.active !== undefined ? t.active.toLocaleString() : "—", color: "#f97316" },
    { icon: <Moon className="h-4 w-4" />, label: "Sleep", value: t.sleep !== undefined ? `${Math.floor(t.sleep)}h ${Math.round((t.sleep % 1) * 60)}m` : "—", color: "#6366f1" },
    { icon: <HeartPulse className="h-4 w-4" />, label: "Resting HR", value: t.rhr !== undefined ? `${t.rhr} bpm` : "—", color: "#ef4444" },
    { icon: <Activity className="h-4 w-4" />, label: "HRV", value: t.hrv !== undefined ? `${t.hrv} ms` : "—", color: "#14b8a6" },
    { icon: <Wind className="h-4 w-4" />, label: "Mindful", value: t.mindful !== undefined ? `${t.mindful} min` : "—", color: "#8b5cf6" },
    ...((): { icon: ReactNode; label: string; value: string; color: string }[] => {
      const h = data.health[today] ?? {};
      const more: [boolean, ReactNode, string, string, string][] = [
        [h.km !== undefined, <Footprints className="h-4 w-4" />, "Distance", `${Math.round((h.km ?? 0) * 0.621371 * 10) / 10} mi`, "#ff5a5f"],
        [h.flights !== undefined, <Activity className="h-4 w-4" />, "Floors", `${h.flights}`, "#f59e0b"],
        [h.exMin !== undefined, <Activity className="h-4 w-4" />, "Exercise", `${h.exMin} min`, "#10b981"],
        [h.stand !== undefined, <Activity className="h-4 w-4" />, "Stand", `${h.stand} h`, "#0ea5e9"],
        [h.basal !== undefined || h.active !== undefined, <Flame className="h-4 w-4" />, "Total burned", `${((h.basal ?? 0) + (h.active ?? 0)).toLocaleString()}`, "#f97316"],
        [t.kcal !== undefined, <Flame className="h-4 w-4" />, "Eaten", `${(t.kcal ?? 0).toLocaleString()} kcal`, "#84cc16"],
        [h.hrAvg !== undefined, <HeartPulse className="h-4 w-4" />, "Avg HR", `${h.hrAvg} bpm`, "#ef4444"],
        [h.vo2 !== undefined, <HeartPulse className="h-4 w-4" />, "VO2 max", `${h.vo2}`, "#ff5a5f"],
        [h.spo2 !== undefined, <Wind className="h-4 w-4" />, "Blood oxygen", `${h.spo2}%`, "#0ea5e9"],
        [h.resp !== undefined, <Wind className="h-4 w-4" />, "Breathing", `${h.resp}/min`, "#14b8a6"],
        [h.deep !== undefined, <Moon className="h-4 w-4" />, "Deep sleep", `${h.deep} min`, "#312e81"],
        [h.rem !== undefined, <Moon className="h-4 w-4" />, "REM sleep", `${h.rem} min`, "#818cf8"],
        [h.weight !== undefined, <Activity className="h-4 w-4" />, "Weight", `${h.weight} lb`, "#64748b"],
        [h.water !== undefined, <Wind className="h-4 w-4" />, "Water", `${Math.round((h.water ?? 0) / 29.57)} oz`, "#0ea5e9"],
      ];
      return more.filter((m) => m[0]).map(([, icon, label, value, color]) => ({ icon, label, value, color }));
    })(),
  ];
  const healthConnected = lifeHealthOn();
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <Eyebrow>{new Date(`${today}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</Eyebrow>
          <h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.02em] text-slate-900">Life Score</h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => go({ kind: "trends" })} className="min-h-10 rounded-full border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Trends</button>
          <button type="button" aria-label="Life Score settings" onClick={() => go({ kind: "settings" })} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" data-testid="life-score-settings"><Settings2 className="h-[18px] w-[18px]" /></button>
        </div>
      </div>

      {/* The Life Score */}
      <Card className="overflow-hidden">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
          <div className="relative grid place-items-center">
            <AreaRing areas={result.areas.map((a) => ({ score: a.score, color: a.color }))} />
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-[54px] font-extrabold leading-none tracking-[-0.04em] text-slate-900 tabular-nums" data-testid="life-score-number">{result.score ?? "—"}</p>
                <p className="mt-1 text-sm font-semibold" style={{ color: scoreColor(result.score) }}>{result.label}</p>
              </div>
            </div>
          </div>
          <div className="w-full min-w-0 flex-1">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {result.areas.map((a) => (
                <button key={a.id} type="button" onClick={() => go({ kind: "area", id: a.id })} className="flex items-center gap-2 rounded-xl px-1.5 py-1.5 text-left hover:bg-slate-50">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-600">{a.name}</span>
                  <span className="text-[13px] font-bold tabular-nums text-slate-900">{a.score ?? "—"}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
              <div className="text-xs text-slate-500"><span className="font-bold text-slate-900">{result.streak}</span> day check-in streak{result.best !== null && <> · best <span className="font-bold text-slate-900">{result.best}</span></>}</div>
              <Spark series={result.series} color="#0f172a" width={120} height={32} fill />
            </div>
          </div>
        </div>
      </Card>

      {/* The check-in */}
      {!checked ? (
        <Card onClick={() => go({ kind: "checkin" })} className="!border-slate-900 !bg-slate-900 text-white">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10"><CalendarCheck className="h-6 w-6" /></span>
            <div className="min-w-0 flex-1"><p className="text-[17px] font-bold">Today's check-in</p><p className="text-sm text-white/70">One minute: how you feel, people, faith, screens, food. It fills in what Apple Health can't.</p></div>
            <ChevronRight className="h-5 w-5 shrink-0 text-white/60" />
          </div>
        </Card>
      ) : (
        <button type="button" onClick={() => go({ kind: "checkin" })} className="flex w-full items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-left text-sm font-semibold text-emerald-800"><Check className="h-4 w-4" />Checked in today<span className="ml-auto text-emerald-700/70">Edit</span></button>
      )}

      {/* Today's best move */}
      {focus && result.focus && (
        <Card>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ background: `${areaOf(focus.area).color}1a`, color: areaOf(focus.area).color }}><Sparkles className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <Eyebrow>Today's best move</Eyebrow>
              <p className="mt-0.5 text-[16px] font-bold text-slate-900">Raise {focus.name} <span className="font-semibold text-slate-400">· {result.focus.score}</span></p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{focus.improve[0]}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => addTodo(focus.todos[0])} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-slate-900 px-3.5 text-[13px] font-semibold text-white"><Plus className="h-3.5 w-3.5" />{focus.todos[0]}</button>
                <button type="button" onClick={() => go({ kind: "metric", id: focus.id })} className="min-h-9 rounded-full border border-slate-200 px-3.5 text-[13px] font-semibold text-slate-700">The science</button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Apple Health today */}
      <Card>
        <div className="flex items-center justify-between gap-2">
          <Eyebrow>Today from Apple Health</Eyebrow>
          {healthConnected && <button type="button" onClick={sync} disabled={syncing} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Reading…" : "Refresh"}</button>}
        </div>
        {lifeHealthPossible() && !healthConnected ? (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 text-sm text-slate-600">Let your iPhone and Apple Watch fill in steps, calories, sleep, heart and mindful minutes.</p>
            <button type="button" onClick={connect} className="min-h-10 shrink-0 rounded-full bg-[#ff2d55] px-4 text-sm font-bold text-white" data-testid="life-score-connect-health">Connect Apple Health</button>
          </div>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {healthTiles.map((h) => (
                <div key={h.label} className="rounded-2xl bg-slate-50 p-2.5">
                  <span style={{ color: h.color }}>{h.icon}</span>
                  <p className="mt-1.5 text-[15px] font-bold tabular-nums text-slate-900">{h.value}</p>
                  <p className="text-[11px] font-medium text-slate-500">{h.label}</p>
                </div>
              ))}
            </div>
            {!lifeHealthPossible() && <p className="mt-3 text-xs text-slate-500">Apple Health connects in the Arise To Do iPhone app; what it reads shows here too.</p>}
          </>
        )}
      </Card>

      {/* Every score, by area */}
      {AREAS.map((a) => {
        const area = result.areas.find((x) => x.id === a.id)!;
        const ms = result.metrics.filter((m) => m.area === a.id);
        if (!ms.length) return null;
        return (
          <Card key={a.id}>
            <button type="button" onClick={() => go({ kind: "area", id: a.id })} className="flex w-full items-center gap-3 text-left">
              <Ring value={area.score} color={a.color} size={48} stroke={6}><span className="text-[13px] font-bold tabular-nums text-slate-900">{area.score ?? "—"}</span></Ring>
              <div className="min-w-0 flex-1"><p className="text-[17px] font-bold text-slate-900">{a.name}</p><p className="truncate text-xs text-slate-500">{a.blurb}</p></div>
              <ChevronRight className="h-5 w-5 text-slate-300" />
            </button>
            <div className="mt-2 divide-y divide-slate-100">
              {ms.map((m) => <MetricRow key={m.id} m={m} color={a.color} onClick={() => go({ kind: "metric", id: m.id })} />)}
            </div>
          </Card>
        );
      })}

      {/* Patterns */}
      <Card>
        <Eyebrow>Patterns in your days</Eyebrow>
        {result.patterns.length ? (
          <ul className="mt-2 space-y-2.5">
            {result.patterns.map((p, i) => <li key={i} className="flex gap-2.5 text-[15px] leading-6 text-slate-700"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />{p.text}</li>)}
          </ul>
        ) : <p className="mt-2 text-sm leading-6 text-slate-500">After a couple of weeks of check-ins, this shows what your best days have in common: sleep, exercise, screens, time outside, people, faith. Your own data beats general advice.</p>}
        {result.patterns.length > 0 && <p className="mt-3 text-xs text-slate-400">From your last 90 days. These go together in your days; they don't prove one causes the other.</p>}
      </Card>

      <p className="px-2 text-center text-xs leading-5 text-slate-400">Life Score is for motivation and habits. It isn't medical advice and doesn't diagnose anything; talk to your doctor about your health and screenings.</p>
    </div>
  );
}

function MetricRow({ m, color, onClick }: { m: MetricResult; color: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 py-3 text-left" data-testid={`life-score-metric-${m.id}`}>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-slate-900">{m.name}</p>
        <p className="truncate text-xs text-slate-500">{m.value}</p>
      </div>
      <Spark series={m.series.slice(-14)} color={color} width={64} height={24} />
      <Pill s={m.score} />
    </button>
  );
}

function AreaView({ id, result, back, go }: { id: AreaId; result: R; back: () => void; go: (v: View) => void }) {
  const a = areaOf(id), area = result.areas.find((x) => x.id === id)!;
  const ms = result.metrics.filter((m) => m.area === id);
  return (
    <div className="space-y-4">
      <Back onClick={back} />
      <Card>
        <div className="flex items-center gap-4">
          <Ring value={area.score} color={a.color} size={96} stroke={10}><span className="text-[28px] font-extrabold tabular-nums text-slate-900">{area.score ?? "—"}</span></Ring>
          <div><h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-slate-900">{a.name}</h1><p className="text-sm text-slate-500">{a.blurb}</p><p className="mt-1 text-sm font-semibold" style={{ color: scoreColor(area.score) }}>{labelFor(area.score)}</p></div>
        </div>
        <div className="mt-5"><Bars series={area.series} dates={result.dates} color={a.color} /></div>
      </Card>
      <Card><div className="divide-y divide-slate-100">{ms.map((m) => <MetricRow key={m.id} m={m} color={a.color} onClick={() => go({ kind: "metric", id: m.id })} />)}</div></Card>
    </div>
  );
}

function MetricView({ id, result, family, tasks, today, back, addTodo, openSettings }: { id: MetricId; result: R; family: SectionProps["family"]; tasks: { due: string; done: boolean }[]; today: string; back: () => void; addTodo: (t: string) => void; openSettings: () => void }) {
  const def = metricDef(id), m = result.metrics.find((x) => x.id === id);
  const color = areaOf(def.area).color;
  const [added, setAdded] = useState<string[]>([]);
  const parts = useMemo(() => {
    if (id !== "prevention") return [];
    const input = lifeInputFrom(family, tasks);
    const cache = new Map<string, ReturnType<typeof factsFor>>();
    return preventionParts(today, { input, today, facts: (d) => { if (!cache.has(d)) cache.set(d, factsFor(input, d)); return cache.get(d)!; } });
  }, [id, family, tasks, today]);
  if (!m) return <div><Back onClick={back} /><Card><p className="text-sm text-slate-600">{def.name} is switched off in settings.</p></Card></div>;
  const avg = (() => { const v = m.series.filter((x): x is number => x !== null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; })();
  return (
    <div className="space-y-4">
      <Back onClick={back} />
      <Card>
        <Eyebrow>{areaOf(def.area).name}</Eyebrow>
        <div className="mt-1 flex items-center gap-4">
          <Ring value={m.score} color={color} size={88} stroke={9}><span className="text-[26px] font-extrabold tabular-nums text-slate-900">{m.score ?? "—"}</span></Ring>
          <div className="min-w-0">
            <h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-slate-900">{def.name}</h1>
            <p className="text-sm text-slate-600">{m.value}</p>
            <p className="mt-0.5 text-xs text-slate-400">{m.change !== null ? `${m.change >= 0 ? "▲" : "▼"} ${Math.abs(m.change)} vs a week ago` : ""}{avg !== null ? `${m.change !== null ? " · " : ""}30-day average ${avg}` : ""}</p>
          </div>
        </div>
        <div className="mt-5"><Bars series={m.series} dates={result.dates} color={color} /></div>
      </Card>

      {id === "prevention" && (
        <Card>
          <Eyebrow>This week</Eyebrow>
          <div className="mt-1 divide-y divide-slate-100">
            {parts.map((p) => <div key={p.id} className="flex items-center gap-3 py-2.5"><div className="min-w-0 flex-1"><p className="text-[15px] font-semibold text-slate-800">{p.name}</p>{p.note && p.score !== null && <p className="text-xs text-slate-500">{p.note}</p>}</div><Pill s={p.score} /></div>)}
          </div>
          <button type="button" onClick={openSettings} className="mt-3 text-sm font-semibold text-slate-900 underline underline-offset-4">Set your age and screening dates</button>
        </Card>
      )}

      <Card>
        <Eyebrow>How to raise it</Eyebrow>
        <ol className="mt-3 space-y-3">
          {def.improve.map((s, i) => <li key={i} className="flex gap-3 text-[15px] leading-6 text-slate-700"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: color }}>{i + 1}</span><span>{s}</span></li>)}
        </ol>
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-500">Add to my to-dos</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {def.todos.map((t) => { const done = added.includes(t); return <button key={t} type="button" disabled={done} onClick={() => { addTodo(t); setAdded((a) => [...a, t]); }} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ${done ? "bg-emerald-50 text-emerald-700" : "border border-slate-200 text-slate-700 hover:bg-slate-50"}`}>{done ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{t}</button>; })}
          </div>
        </div>
      </Card>

      <Card>
        <Eyebrow>The science</Eyebrow>
        <p className="mt-2 text-[15px] leading-7 text-slate-700">{def.why}</p>
        <ul className="mt-4 space-y-2.5">
          {def.sources.map((s) => <li key={s.title} className="rounded-2xl bg-slate-50 p-3"><p className="text-[13px] font-bold text-slate-800">{s.title}</p><p className="text-[13px] leading-5 text-slate-600">{s.finding}</p></li>)}
        </ul>
      </Card>

      <Card>
        <Eyebrow>How it's scored</Eyebrow>
        <p className="mt-2 text-sm leading-6 text-slate-600">{def.measures}</p>
        <p className="mt-2 text-sm leading-6 text-slate-500"><span className="font-semibold text-slate-700">From:</span> {def.from}</p>
      </Card>
    </div>
  );
}

function Trends({ result, back, go }: { result: R; back: () => void; go: (v: View) => void }) {
  const withData = result.series.filter((v): v is number => v !== null);
  const avg = withData.length ? Math.round(withData.reduce((a, b) => a + b, 0) / withData.length) : null;
  const movers = result.metrics.filter((m) => m.change !== null && m.change !== 0).sort((a, b) => (b.change ?? 0) - (a.change ?? 0));
  return (
    <div className="space-y-4">
      <Back onClick={back} />
      <Card>
        <Eyebrow>Life Score · 30 days</Eyebrow>
        <div className="mt-1 flex items-baseline gap-3"><p className="text-[40px] font-extrabold tracking-[-0.03em] text-slate-900 tabular-nums">{result.score ?? "—"}</p><p className="text-sm text-slate-500">{avg !== null ? `average ${avg} · best ${result.best}` : "No days scored yet"}</p></div>
        <div className="mt-3 overflow-hidden"><Spark series={result.series} color="#0f172a" width={640} height={120} fill full /></div>
        <div className="mt-1.5 flex justify-between text-[11px] font-medium text-slate-400"><span>{shortDate(result.dates[0])}</span><span>Today</span></div>
      </Card>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {result.areas.map((a) => (
          <Card key={a.id} onClick={() => go({ kind: "area", id: a.id })}>
            <div className="flex items-center justify-between"><p className="text-[15px] font-bold text-slate-900">{a.name}</p><Pill s={a.score} /></div>
            <div className="mt-2"><Spark series={a.series} color={a.color} width={280} height={56} fill full /></div>
          </Card>
        ))}
      </div>
      {movers.length > 0 && (
        <Card>
          <Eyebrow>Biggest changes this week</Eyebrow>
          <div className="mt-1 divide-y divide-slate-100">
            {[...movers.slice(0, 3), ...movers.slice(-3).filter((m) => !movers.slice(0, 3).includes(m))].map((m) => (
              <button key={m.id} type="button" onClick={() => go({ kind: "metric", id: m.id })} className="flex w-full items-center gap-3 py-2.5 text-left">
                <span className="min-w-0 flex-1 text-[15px] font-semibold text-slate-800">{m.name}</span>
                <span className={`text-sm font-bold tabular-nums ${(m.change ?? 0) > 0 ? "text-emerald-600" : "text-rose-500"}`}>{(m.change ?? 0) > 0 ? "▲" : "▼"} {Math.abs(m.change ?? 0)}</span>
                <Pill s={m.score} />
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function CheckIn({ data, today, update, back, openMeasures, openLabs }: { data: LifeScoreData; today: string; update: (fn: (d: LifeScoreData) => LifeScoreData) => void; back: () => void; openMeasures: () => void; openLabs: () => void }) {
  const [day, setDay] = useState(today);
  const c: LifeCheckIn = data.days[day] ?? {};
  const h = data.health[day] ?? {};
  const set = <K extends keyof LifeCheckIn>(k: K, v: LifeCheckIn[K]) => update((d) => {
    const next = { ...(d.days[day] ?? {}), [k]: v };
    if (v === undefined) delete next[k];
    const days = { ...d.days, [day]: next };
    if (!Object.keys(next).length) delete days[day];
    return { ...d, days };
  });
  return (
    <div className="space-y-4">
      <Back onClick={back} />
      <div className="flex items-end justify-between gap-3 px-1">
        <div><Eyebrow>Check-in</Eyebrow><h1 className="mt-1 text-[26px] font-extrabold tracking-[-0.02em] text-slate-900">How was {day === today ? "today" : "yesterday"}?</h1></div>
        <div className="flex shrink-0 gap-1 rounded-xl bg-slate-100 p-1">
          {[today, plusDays(today, -1)].map((d) => <button key={d} type="button" onClick={() => setDay(d)} className={`min-h-9 rounded-lg px-3 text-sm font-bold ${day === d ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{d === today ? "Today" : "Yesterday"}</button>)}
        </div>
      </div>
      <p className="px-1 text-sm text-slate-500">Answer what you like; everything saves as you go. Skipped questions just don't count.</p>
      <div className="grid grid-cols-2 gap-3">
        <Card onClick={openMeasures}><p className="text-[15px] font-bold text-slate-900">Measures</p><p className="text-xs leading-5 text-slate-500">Well-being, mood, anxiety, loneliness, stress and life satisfaction questionnaires</p></Card>
        <Card onClick={openLabs}><p className="text-[15px] font-bold text-slate-900">Labs & vitals</p><p className="text-xs leading-5 text-slate-500">Blood pressure, cholesterol, A1c, glucose, waist</p></Card>
      </div>
      <Group title="How you feel">
        <Scale label="Happiness" value={c.happy} onChange={(v) => set("happy", v)} low="Awful" high="Wonderful" />
        <Scale label="Stress" value={c.stress} onChange={(v) => set("stress", v)} low="Calm" high="Overwhelmed" />
        <Scale label="Energy" value={c.energy} onChange={(v) => set("energy", v)} low="Drained" high="Full of energy" />
      </Group>
      <Group title="People and faith">
        <Scale label="Connection" hint="How close you felt to the people in your life" value={c.connect} onChange={(v) => set("connect", v)} low="Alone" high="Deeply connected" />
        <YesNo label="Real time with someone" hint="Undistracted, no phones" value={c.together} onChange={(v) => set("together", v)} />
        <YesNo label="Prayer, scripture or worship" value={c.faith} onChange={(v) => set("faith", v)} />
        <Scale label="Close to God" hint="Or to something greater than yourself" value={c.faithFelt} onChange={(v) => set("faithFelt", v)} low="Far" high="Very close" />
      </Group>
      <Group title="Body">
        <Stepper label="Exercise" hint="Brisk walking counts" value={c.exercise} onChange={(v) => set("exercise", v)} step={5} unit="min" max={600} />
        <YesNo label="Strength training" value={c.strength} onChange={(v) => set("strength", v)} />
        <Stepper label="Fruit and vegetables" hint="A serving is a fruit, or a cup of greens" value={c.produce} onChange={(v) => set("produce", v)} step={1} unit="servings" max={20} />
        {h.sleep === undefined && <Stepper label="Sleep" hint="Apple Health fills this in when connected" value={c.sleep} onChange={(v) => set("sleep", v)} step={0.5} unit="h" max={16} />}
        {h.mindful === undefined && <Stepper label="Meditation or prayer time" value={c.mindful} onChange={(v) => set("mindful", v)} step={5} unit="min" max={600} />}
      </Group>
      <Group title="Screens and outside">
        <Stepper label="Screen time" hint="Outside work or school. Settings → Screen Time shows it." value={c.screen} onChange={(v) => set("screen", v)} step={0.5} unit="h" max={24} />
        <Stepper label="Social media" value={c.social} onChange={(v) => set("social", v)} step={15} unit="min" max={1440} />
        <Stepper label="Time outside in nature" value={c.outdoors} onChange={(v) => set("outdoors", v)} step={10} unit="min" max={1440} />
        {(c.outdoors ?? 0) >= 30 && <YesNo label="Sunscreen or shade" value={c.sunscreen} onChange={(v) => set("sunscreen", v)} />}
      </Group>
      <Group title="Prevention habits">
        <Stepper label="Alcoholic drinks" value={c.alcohol} onChange={(v) => set("alcohol", v)} step={1} unit="" max={40} />
        <Stepper label="Processed meat" hint="Bacon, ham, hot dogs, deli meat" value={c.processed} onChange={(v) => set("processed", v)} step={1} unit="" max={20} />
        <Stepper label="Red meat" hint="Beef, pork, lamb" value={c.red} onChange={(v) => set("red", v)} step={1} unit="" max={20} />
        <Stepper label="Sugary drinks" hint="Soda, sweet tea, energy drinks" value={c.sugary} onChange={(v) => set("sugary", v)} step={1} unit="" max={30} />
        <YesNo label="Smoked or vaped" value={c.smoked} onChange={(v) => set("smoked", v)} />
      </Group>
      <Card>
        <Eyebrow>One line about the day</Eyebrow>
        <textarea value={c.note ?? ""} onChange={(e) => set("note", e.target.value.slice(0, 280) || undefined)} rows={2} placeholder="What made today good, or hard?" className={`${inputClass} mt-2 min-h-[72px] py-2`} />
      </Card>
      <button type="button" onClick={back} className="min-h-12 w-full rounded-2xl bg-slate-900 text-[15px] font-bold text-white">Done</button>
    </div>
  );
}

function SettingsView({ data, today, update, back, syncing, sync, connect }: { data: LifeScoreData; today: string; update: (fn: (d: LifeScoreData) => LifeScoreData) => void; back: () => void; syncing: boolean; sync: () => void; connect: () => void }) {
  const s = data.settings;
  const setS = (patch: Partial<LifeScoreData["settings"]>) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  const [, rerender] = useState(0);
  const due = screeningStatus(s, today);
  const numIn = (v: string) => (v.trim() === "" ? undefined : Number(v));
  return (
    <div className="space-y-4">
      <Back onClick={back} />
      <h1 className="px-1 text-[26px] font-extrabold tracking-[-0.02em] text-slate-900">Settings</h1>
      <Card>
        <Eyebrow>Apple Health</Eyebrow>
        {!lifeHealthPossible() ? <p className="mt-2 text-sm text-slate-600">Connect Apple Health in the Arise To Do iPhone app. What it reads shows here on the website too.</p>
          : lifeHealthOn() ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 text-sm text-slate-600">Connected{data.healthAt ? ` · read ${new Date(data.healthAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}</p>
              <button type="button" onClick={sync} disabled={syncing} className="min-h-9 rounded-full border border-slate-200 px-3.5 text-sm font-semibold text-slate-700 disabled:opacity-50">{syncing ? "Reading…" : "Read now"}</button>
              <button type="button" onClick={() => { lifeHealthOff(); rerender((n) => n + 1); }} className="min-h-9 rounded-full px-3 text-sm font-semibold text-rose-600">Stop reading</button>
            </div>
          ) : <button type="button" onClick={connect} className="mt-2 min-h-10 rounded-full bg-[#ff2d55] px-4 text-sm font-bold text-white">Connect Apple Health</button>}
        <p className="mt-2 text-xs leading-5 text-slate-400">Reads steps, active calories, sleep, resting heart rate, heart rate variability and mindful minutes. Nothing is written to Apple Health. To change what's shared: Settings → Health → Data Access & Devices → Arise To Do.</p>
      </Card>
      <Card>
        <Eyebrow>About you</Eyebrow>
        <p className="mt-1 text-xs text-slate-500">Used only to work out which cancer screenings apply to you.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-sm font-semibold text-slate-700">Year born<input inputMode="numeric" value={s.birthYear ?? ""} onChange={(e) => setS({ birthYear: numIn(e.target.value) })} className={`${inputClass} mt-1`} placeholder="1985" /></label>
          <label className="text-sm font-semibold text-slate-700">Sex at birth<select value={s.sex ?? ""} onChange={(e) => setS({ sex: (e.target.value || undefined) as any })} className={`${inputClass} mt-1`}><option value="">Not set</option><option value="female">Female</option><option value="male">Male</option></select></label>
        </div>
        <YesNo label="Heavy smoking history" hint="20 pack-years or more, and smoked within the last 15 years" value={s.heavySmoker} onChange={(v) => setS({ heavySmoker: v })} />
        <div className="mt-2 grid grid-cols-2 gap-3">
          <label className="text-sm font-semibold text-slate-700">Height<span className="ml-1 text-xs font-normal text-slate-400">inches</span><input inputMode="decimal" value={s.heightIn ?? ""} onChange={(e) => setS({ heightIn: numIn(e.target.value) })} className={`${inputClass} mt-1`} placeholder="70" /></label>
          <label className="text-sm font-semibold text-slate-700">Nicotine<select value={s.nicotine ?? ""} onChange={(e) => setS({ nicotine: (e.target.value || undefined) as any })} className={`${inputClass} mt-1`}><option value="">Not set</option><option value="never">Never</option><option value="quit5">Quit 5+ years ago</option><option value="quit1">Quit 1–5 years ago</option><option value="quitRecent">Quit under a year / vape</option><option value="current">Smoke now</option></select></label>
        </div>
        <YesNo label="Someone smokes at home" value={s.secondhand} onChange={(v) => setS({ secondhand: v })} />
        <YesNo label="A parent or sibling has diabetes" value={s.familyDiabetes} onChange={(v) => setS({ familyDiabetes: v })} />
        <YesNo label="Told you have high blood pressure" value={s.highBp} onChange={(v) => setS({ highBp: v })} />
        {s.sex === "female" && <YesNo label="Had diabetes during a pregnancy" value={s.gestational} onChange={(v) => setS({ gestational: v })} />}
      </Card>
      <Card>
        <Eyebrow>Money</Eyebrow>
        <p className="mt-1 text-xs text-slate-500">For net worth and savings rate in Stats. Rough numbers are fine.</p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <label className="text-sm font-semibold text-slate-700">You own<input inputMode="decimal" value={s.assets ?? ""} onChange={(e) => setS({ assets: numIn(e.target.value) })} className={`${inputClass} mt-1`} placeholder="$" /></label>
          <label className="text-sm font-semibold text-slate-700">You owe<input inputMode="decimal" value={s.debts ?? ""} onChange={(e) => setS({ debts: numIn(e.target.value) })} className={`${inputClass} mt-1`} placeholder="$" /></label>
          <label className="text-sm font-semibold text-slate-700">Take-home a month<input inputMode="decimal" value={s.income ?? ""} onChange={(e) => setS({ income: numIn(e.target.value) })} className={`${inputClass} mt-1`} placeholder="$" /></label>
        </div>
      </Card>
      {due.length > 0 && (
        <Card>
          <Eyebrow>Screenings</Eyebrow>
          <div className="mt-1 divide-y divide-slate-100">
            {due.map((x) => {
              const cur = s.screenings[x.id as ScreeningId];
              const def = SCREENINGS[x.id as ScreeningId];
              return (
                <div key={x.id} className="py-3">
                  <div className="flex items-center justify-between gap-2"><p className="text-[15px] font-semibold text-slate-800">{x.name}</p><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${x.due ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{x.due ? "Due" : `Next ${new Date(`${x.next}T12:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`}</span></div>
                  <p className="text-xs text-slate-500">{x.who}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input type="date" value={cur?.date ?? ""} max={today} onChange={(e) => update((d) => { const sc = { ...d.settings.screenings }; if (e.target.value) sc[x.id as ScreeningId] = { date: e.target.value, years: cur?.years ?? def.years }; else delete sc[x.id as ScreeningId]; return { ...d, settings: { ...d.settings, screenings: sc } }; })} className={inputClass} aria-label={`Last ${x.name}`} />
                    {def.options.length > 1 ? <select value={cur?.years ?? def.years} disabled={!cur} onChange={(e) => update((d) => ({ ...d, settings: { ...d.settings, screenings: { ...d.settings.screenings, [x.id]: { date: cur!.date, years: Number(e.target.value) } } } }))} className={inputClass}>{def.options.map((o) => <option key={o.years} value={o.years}>{o.label}</option>)}</select> : <span />}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">US Preventive Services Task Force ages and intervals for people at average risk. Your doctor may recommend something different for your history.</p>
        </Card>
      )}
      <Card>
        <Eyebrow>Goals</Eyebrow>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-sm font-semibold text-slate-700">Daily steps<input inputMode="numeric" value={s.stepGoal ?? ""} onChange={(e) => setS({ stepGoal: numIn(e.target.value) })} className={`${inputClass} mt-1`} placeholder="8000" /></label>
          <label className="text-sm font-semibold text-slate-700">Months saved<input inputMode="decimal" value={s.cushion ?? ""} onChange={(e) => setS({ cushion: numIn(e.target.value) })} className={`${inputClass} mt-1`} placeholder="0" /></label>
        </div>
      </Card>
      <Card>
        <Eyebrow>Scores that count</Eyebrow>
        <div className="mt-1 divide-y divide-slate-100">
          {METRICS.map((m) => {
            const on = !s.off.includes(m.id);
            return <label key={m.id} className="flex cursor-pointer items-center justify-between gap-3 py-2.5">
              <span className="min-w-0"><span className="text-[15px] font-semibold text-slate-800">{m.name}</span><span className="ml-2 text-xs text-slate-400">{areaOf(m.area).name}</span></span>
              <input type="checkbox" checked={on} onChange={() => setS({ off: on ? [...s.off, m.id] : s.off.filter((x) => x !== m.id) })} className="h-5 w-5 accent-slate-900" />
            </label>;
          })}
        </div>
      </Card>
    </div>
  );
}


// ——— Measures: the validated questionnaires (shared/lifeScales.ts) ——————————————————————————————————————————————
function Measures({ data, today, back, open }: { data: LifeScoreData; today: string; back: () => void; open: (id: ScaleId) => void }) {
  return (
    <div className="space-y-4">
      <Back onClick={back} label="Check in" />
      <div className="px-1"><Eyebrow>Measures</Eyebrow><h1 className="mt-1 text-[26px] font-extrabold tracking-[-0.02em] text-slate-900">How you're really doing</h1><p className="text-sm leading-6 text-slate-500">Short questionnaires used in research and by doctors. Take them weekly or monthly and watch the trend. They're screens, not diagnoses.</p></div>
      {SCALES.map((def) => {
        const list = data.scales?.[def.id] ?? [];
        const last = list[list.length - 1];
        const r = last ? scoreScale(def.id, last.answers) : null;
        const days = last ? Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${last.date}T12:00:00`)) / 864e5) : null;
        const due = days === null || days >= (def.every === "week" ? 7 : 30);
        return (
          <Card key={def.id} onClick={() => open(def.id)}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold text-slate-900">{def.name}</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">{def.about}</p>
                {r && <p className={`mt-1.5 text-sm font-semibold ${r.tone === "good" ? "text-emerald-700" : r.tone === "ok" ? "text-slate-700" : r.tone === "watch" ? "text-amber-700" : "text-rose-700"}`}>{def.id === "who5" ? `${r.score}/100` : `${r.score}/${def.max}`} · {r.label}</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${due ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}>{due ? (last ? "Due" : "Take it") : `In ${(def.every === "week" ? 7 : 30) - (days ?? 0)}d`}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function ScaleForm({ id, data, today, update, back }: { id: ScaleId; data: LifeScoreData; today: string; update: (fn: (d: LifeScoreData) => LifeScoreData) => void; back: () => void }) {
  const def = SCALES.find((x) => x.id === id)!;
  const [answers, setAnswers] = useState<(number | undefined)[]>(() => def.questions.map(() => undefined));
  const [saved, setSaved] = useState(false);
  const list = data.scales?.[id] ?? [];
  const done = answers.every((a) => a !== undefined);
  const result = done ? scoreScale(id, answers as number[]) : null;
  const save = () => {
    if (!done) return;
    update((d) => { const prev = (d.scales?.[id] ?? []).filter((a) => a.date !== today); return { ...d, scales: { ...(d.scales ?? {}), [id]: [...prev, { date: today, answers: answers as number[] }] } }; });
    setSaved(true);
  };
  return (
    <div className="space-y-4">
      <Back onClick={back} label="Measures" />
      <div className="px-1"><Eyebrow>{def.every === "week" ? "Weekly" : "Monthly"}</Eyebrow><h1 className="mt-1 text-[26px] font-extrabold tracking-[-0.02em] text-slate-900">{def.name}</h1><p className="text-sm leading-6 text-slate-500">{def.about}</p></div>
      <Card>
        <p className="text-sm font-semibold text-slate-600">{def.window}</p>
        <div className="mt-2 divide-y divide-slate-100">
          {def.questions.map((q, i) => (
            <div key={i} className="py-3">
              <p className="text-[15px] font-semibold text-slate-900">{q}</p>
              <div className={`mt-2 grid gap-1.5 ${def.choices.length > 6 ? "grid-cols-6 sm:grid-cols-11" : def.choices.length > 4 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
                {def.choices.map((c) => <button key={c.value} type="button" aria-pressed={answers[i] === c.value} onClick={() => { setSaved(false); setAnswers((a) => a.map((x, k) => (k === i ? c.value : x))); }} className={`min-h-10 rounded-xl px-2 text-[13px] font-semibold transition ${answers[i] === c.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{c.label}</button>)}
              </div>
            </div>
          ))}
        </div>
      </Card>
      {result && (
        <Card>
          <p className="text-[32px] font-extrabold tabular-nums text-slate-900">{id === "who5" ? `${result.score}/100` : `${result.score}/${def.max}`}</p>
          <p className={`text-[16px] font-bold ${result.tone === "good" ? "text-emerald-700" : result.tone === "ok" ? "text-slate-800" : result.tone === "watch" ? "text-amber-700" : "text-rose-700"}`}>{result.label}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{result.note}</p>
          <button type="button" onClick={save} disabled={saved} className="mt-3 min-h-11 w-full rounded-2xl bg-slate-900 text-[15px] font-bold text-white disabled:bg-emerald-600">{saved ? "Saved" : "Save today's answers"}</button>
        </Card>
      )}
      <p className="px-2 text-xs leading-5 text-slate-400">Source: {def.source}. A screen, not a diagnosis.</p>
      {list.length > 0 && <ChartView chart={{ kind: "list", title: "Your past results", rows: [...list].reverse().slice(0, 12).map((a) => { const r = scoreScale(id, a.answers); return { label: `${id === "who5" ? `${r.score}/100` : `${r.score}/${def.max}`} · ${r.label}`, right: new Date(`${a.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) }; }) }} />}
    </div>
  );
}

// ——— Labs & vitals ——————————————————————————————————————————————————————————————————————————————————————————————
function LabsView({ data, today, update, back }: { data: LifeScoreData; today: string; update: (fn: (d: LifeScoreData) => LifeScoreData) => void; back: () => void }) {
  const [draft, setDraft] = useState<Labs>({ date: today });
  const labs = [...(data.labs ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const field = (k: keyof Labs, label: string, unit: string, step = "1") => (
    <label className="text-sm font-semibold text-slate-700">{label}<span className="ml-1 text-xs font-normal text-slate-400">{unit}</span>
      <input inputMode="decimal" step={step} value={(draft[k] as number | undefined) ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value === "" ? undefined : Number(e.target.value) }))} className={`${inputClass} mt-1`} />
    </label>
  );
  const check = (k: keyof Labs, label: string) => <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={!!draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.checked || undefined }))} className="h-5 w-5 accent-slate-900" />{label}</label>;
  const any = Object.entries(draft).some(([k, v]) => k !== "date" && v !== undefined);
  return (
    <div className="space-y-4">
      <Back onClick={back} label="Check in" />
      <div className="px-1"><Eyebrow>Labs & vitals</Eyebrow><h1 className="mt-1 text-[26px] font-extrabold tracking-[-0.02em] text-slate-900">Your numbers</h1><p className="text-sm leading-6 text-slate-500">From a checkup, a home blood pressure cuff or a lab report. They fill in heart health (Life's Essential 8) and the diabetes risk test in Stats.</p></div>
      <Card>
        <label className="text-sm font-semibold text-slate-700">Date<input type="date" max={today} value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value || today }))} className={`${inputClass} mt-1`} /></label>
        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Blood pressure</p>
        <div className="mt-2 grid grid-cols-2 gap-3">{field("sys", "Top (systolic)", "mmHg")}{field("dia", "Bottom (diastolic)", "mmHg")}</div>
        <div className="mt-2">{check("bpMeds", "I take blood pressure medicine")}</div>
        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Cholesterol</p>
        <div className="mt-2 grid grid-cols-2 gap-3">{field("total", "Total", "mg/dL")}{field("hdl", "HDL", "mg/dL")}{field("ldl", "LDL", "mg/dL")}{field("trig", "Triglycerides", "mg/dL")}</div>
        <div className="mt-2">{check("lipidMeds", "I take cholesterol medicine")}</div>
        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Blood sugar</p>
        <div className="mt-2 grid grid-cols-2 gap-3">{field("a1c", "A1c", "%", "0.1")}{field("glucose", "Fasting glucose", "mg/dL")}</div>
        <div className="mt-2">{check("diabetes", "I have diabetes")}</div>
        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Body</p>
        <div className="mt-2 grid grid-cols-2 gap-3">{field("waist", "Waist", "in", "0.5")}</div>
        <button type="button" disabled={!any} onClick={() => { update((d) => ({ ...d, labs: [...(d.labs ?? []), draft] })); setDraft({ date: today }); }} className="mt-4 min-h-11 w-full rounded-2xl bg-slate-900 text-[15px] font-bold text-white disabled:opacity-40">Save</button>
      </Card>
      {labs.length > 0 && (
        <Card>
          <Eyebrow>Saved</Eyebrow>
          <ul className="mt-1 divide-y divide-slate-100">
            {labs.map((l, i) => (
              <li key={`${l.date}${i}`} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800">{[l.sys && `BP ${l.sys}/${l.dia}`, l.total && `Total ${l.total}`, l.hdl && `HDL ${l.hdl}`, l.ldl && `LDL ${l.ldl}`, l.trig && `Trig ${l.trig}`, l.a1c && `A1c ${l.a1c}%`, l.glucose && `Glucose ${l.glucose}`, l.waist && `Waist ${l.waist} in`].filter(Boolean).join(" · ")}</p><p className="text-xs text-slate-500">{new Date(`${l.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p></div>
                <button type="button" onClick={() => update((d) => ({ ...d, labs: (d.labs ?? []).filter((x) => x !== l && !(x.date === l.date && JSON.stringify(x) === JSON.stringify(l))) }))} className="text-xs font-semibold text-rose-600">Delete</button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="px-2 text-xs leading-5 text-slate-400">Talk to your doctor about what your numbers mean for you.</p>
    </div>
  );
}
