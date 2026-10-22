// A tracker made from a description: what each entry holds, the number that matters, a daily
// goal, quick-add buttons and a colour for each reading. Water, sleep, weight, steps, blood
// pressure, caffeine and more are all this one engine with their own settings.
import { useMemo, useState, type ReactNode } from "react";
import { Download, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { Btn, Card, Chart, Empty, Field, Heatmap, Modal, NumIn, Ring, Stat, Tabs, addDays, dayKey, downloadCsv, esc, fmtDay, fmtNum, fmtTime, inputCls, lastDays, nowTime, printPage, streak, today, uid, usePro } from "./kit";

export type FieldDef = {
  key: string; label: string;
  type: "number" | "text" | "select" | "scale" | "time" | "bool" | "chips";
  unit?: string; min?: number; max?: number; step?: number; options?: string[]; optional?: boolean; placeholder?: string; default?: unknown; half?: boolean;
};
export type Entry = { id: string; date: string; time: string } & Record<string, any>;
export type TrackerConfig = {
  app: string; color: string;
  fields: FieldDef[];
  /** The number shown big and charted. */
  metric: { label: string; unit: string; agg: "sum" | "avg" | "last" | "max" | "count"; decimals?: number; value: (e: Entry, s: any) => number };
  goal?: { default: number; label: string; higherIsBetter?: boolean; unitOptions?: string[] };
  quick?: { label: ReactNode; values: Record<string, unknown> }[];
  classify?: (e: Entry, s: any) => { label: string; color: string } | null;
  describe?: (e: Entry, s: any) => ReactNode;
  extraStats?: (entries: Entry[], s: any) => { label: string; value: ReactNode; sub?: ReactNode }[];
  /** Settings the person can change (height, units…). */
  settings?: FieldDef[];
  chart?: "column" | "line";
  tips?: string[];
  entryName?: string;
};

type Data = { entries: Entry[]; goal: number; settings: Record<string, any> };

export function LogTracker({ cfg, intro }: { cfg: TrackerConfig; intro?: ReactNode }) {
  const defaults: Data = { entries: [], goal: cfg.goal?.default ?? 0, settings: Object.fromEntries((cfg.settings || []).map((f) => [f.key, f.default ?? ""])) };
  const { data, setData } = usePro<Data>(cfg.app, defaults);
  const s = data.settings;
  const [editing, setEditing] = useState<Entry | null>(null);
  const [range, setRange] = useState<"14" | "30" | "90">("14");
  const [view, setView] = useState<"today" | "history" | "settings">("today");
  const value = (e: Entry) => { const v = cfg.metric.value(e, s); return Number.isFinite(v) ? v : 0; };
  const byDay = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of data.entries) (m.get(e.date) || m.set(e.date, []).get(e.date)!).push(e);
    return m;
  }, [data.entries]);
  const dayValue = (d: string) => {
    const list = byDay.get(d) || [];
    if (!list.length) return null;
    const vals = list.map(value);
    switch (cfg.metric.agg) {
      case "sum": return vals.reduce((a, b) => a + b, 0);
      case "avg": return vals.reduce((a, b) => a + b, 0) / vals.length;
      case "max": return Math.max(...vals);
      case "count": return list.length;
      default: return value([...list].sort((a, b) => (a.time > b.time ? 1 : -1))[list.length - 1]);
    }
  };
  const d0 = today();
  const todayVal = dayValue(d0);
  const goal = data.goal;
  const goalMet = (d: string) => { const v = dayValue(d); if (v === null || !cfg.goal) return v !== null; return cfg.goal.higherIsBetter === false ? v <= goal : v >= goal; };
  const days = lastDays(Number(range));
  const filled = days.map(dayValue).filter((v): v is number => v !== null);
  const avg = filled.length ? filled.reduce((a, b) => a + b, 0) / filled.length : null;
  const best = filled.length ? (cfg.goal?.higherIsBetter === false ? Math.min(...filled) : Math.max(...filled)) : null;
  const dec = cfg.metric.decimals ?? 0;
  const save = (e: Entry) => setData((dd) => ({ ...dd, entries: [e, ...dd.entries.filter((x) => x.id !== e.id)].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 5000) }));
  const quickAdd = (values: Record<string, unknown>) => save({ id: uid(), date: d0, time: nowTime(), ...values } as Entry);
  const remove = (id: string) => setData((dd) => ({ ...dd, entries: dd.entries.filter((x) => x.id !== id) }));
  const blank = (): Entry => ({ id: uid(), date: d0, time: nowTime(), ...Object.fromEntries(cfg.fields.map((f) => [f.key, f.default ?? (f.type === "bool" ? false : f.type === "chips" ? [] : "")])) } as Entry);
  const heat = useMemo(() => { const out: Record<string, number> = {}; for (const d of byDay.keys()) { const v = dayValue(d); if (v !== null) out[d] = cfg.goal ? (goalMet(d) ? 2 : 1) : v; } return out; }, [byDay, goal]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = streak(goalMet);
  const extra = cfg.extraStats?.(data.entries, s) || [];
  const exportCsv = () => downloadCsv(`${cfg.app}-log`, [["Date", "Time", ...cfg.fields.map((f) => f.label + (f.unit ? ` (${f.unit})` : ""))], ...data.entries.map((e) => [e.date, e.time, ...cfg.fields.map((f) => (Array.isArray(e[f.key]) ? e[f.key].join("; ") : e[f.key] ?? ""))])]);
  const print = () => printPage(`${cfg.metric.label} report`, `<h1>${esc(cfg.metric.label)} report</h1><p class="muted">${fmtDay(days[0])} – ${fmtDay(d0)} · average ${avg === null ? "—" : fmtNum(avg, dec)} ${esc(cfg.metric.unit)}</p><table><tr><th>Date</th><th>Time</th>${cfg.fields.map((f) => `<th>${esc(f.label)}</th>`).join("")}</tr>${data.entries.filter((e) => e.date >= days[0]).map((e) => `<tr><td>${esc(fmtDay(e.date))}</td><td>${esc(fmtTime(e.time))}</td>${cfg.fields.map((f) => `<td>${esc(Array.isArray(e[f.key]) ? e[f.key].join(", ") : f.type === "bool" ? (e[f.key] ? "Yes" : "") : e[f.key] ?? "")}${e[f.key] !== "" && f.unit && f.type === "number" ? " " + esc(f.unit) : ""}</td>`).join("")}</tr>`).join("")}</table>`);

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Tabs value={view} onChange={setView} color={cfg.color} items={[{ id: "today", label: "Today" }, { id: "history", label: "History" }, ...(cfg.settings?.length || cfg.goal ? [{ id: "settings" as const, label: "Settings" }] : [])]} />
      <div className="flex gap-2"><Btn kind="primary" color={cfg.color} onClick={() => setEditing(blank())}><Plus size={16} />Add {cfg.entryName || "entry"}</Btn></div>
    </div>
    {intro}
    {view === "today" && <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr]">
        <Card className="flex flex-col items-center justify-center gap-3 md:min-w-[240px]">
          <Ring value={todayVal ?? 0} max={cfg.goal ? goal : Math.max(1, todayVal ?? 1)} color={cfg.color} size={150}>
            <span className="text-3xl font-black" style={{ color: cfg.color }}>{todayVal === null ? "—" : fmtNum(todayVal, dec)}</span>
            <span className="text-xs font-semibold text-slate-500">{cfg.metric.unit}{cfg.goal ? ` of ${fmtNum(goal, dec)}` : ""}</span>
          </Ring>
          <p className="text-sm font-bold text-slate-700">{cfg.metric.label} today</p>
          {cfg.goal && todayVal !== null && <p className="text-xs font-semibold" style={{ color: goalMet(d0) ? "#16a34a" : "#64748b" }}>{goalMet(d0) ? "Goal reached — nice work!" : cfg.goal.higherIsBetter === false ? `${fmtNum(todayVal - goal, dec)} ${cfg.metric.unit} over` : `${fmtNum(goal - todayVal, dec)} ${cfg.metric.unit} to go`}</p>}
        </Card>
        <div className="space-y-4">
          {cfg.quick && <Card title="Quick add"><div className="flex flex-wrap gap-2">{cfg.quick.map((q, i) => <Btn key={i} kind="soft" color={cfg.color} onClick={() => quickAdd(q.values)} big>{q.label}</Btn>)}</div></Card>}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label={`${range}-day average`} value={avg === null ? "—" : fmtNum(avg, dec)} sub={cfg.metric.unit} />
            {cfg.goal && <Stat label={cfg.goal.higherIsBetter === false ? "Lowest day" : "Best day"} value={best === null ? "—" : fmtNum(best, dec)} sub={cfg.metric.unit} />}
            {cfg.goal ? <Stat label="Streak" value={`${run} day${run === 1 ? "" : "s"}`} sub="goal met" color={cfg.color} /> : <Stat label="Entries" value={data.entries.length} />}
            <Stat label="Days logged" value={new Set(data.entries.map((e) => e.date)).size} />
            {extra.map((x) => <Stat key={x.label} label={x.label} value={x.value} sub={x.sub} />)}
          </div>
        </div>
      </div>
      <Card title={<>Last {range} days{cfg.goal ? <span className="ml-2 text-xs font-semibold text-slate-500">goal {fmtNum(goal, dec)} {cfg.metric.unit}</span> : null}</>} right={<Tabs value={range} onChange={setRange} items={[{ id: "14", label: "14" }, { id: "30", label: "30" }, { id: "90", label: "90" }]} />}>
        {(() => {
          // Lines join only the days that have a reading; columns show every day.
          const shown = (cfg.chart || "column") === "line" ? days.filter((d) => dayValue(d) !== null) : days;
          if (!shown.length) return <Empty>Your chart will appear after the first entry.</Empty>;
          return <Chart kind={cfg.chart || "column"} labels={shown.map((d) => fmtDay(d, { month: "numeric", day: "numeric" }))} series={[{ name: cfg.metric.label, values: shown.map((d) => Number((dayValue(d) ?? 0).toFixed(2))) }]} colors={[cfg.color]} legend={false} />;
        })()}
      </Card>
      <Card title="Today's entries">{(byDay.get(d0) || []).length ? <EntryList list={byDay.get(d0)!} cfg={cfg} s={s} onEdit={setEditing} onRemove={remove} /> : <Empty>Nothing logged today yet.</Empty>}</Card>
      {cfg.tips && <Card title="Good to know"><ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">{cfg.tips.map((t) => <li key={t}>{t}</li>)}</ul></Card>}
    </>}
    {view === "history" && <>
      <Card title="Calendar">{Object.keys(heat).length ? <Heatmap values={heat} color={cfg.color} max={cfg.goal ? 2 : undefined} label={(d, v) => `${fmtDay(d)}: ${dayValue(d) === null ? "nothing logged" : `${fmtNum(dayValue(d)!, dec)} ${cfg.metric.unit}`}${cfg.goal && v === 2 ? " ✓ goal" : ""}`} /> : <Empty>Your days will fill in here.</Empty>}</Card>
      <Card title="All entries" right={<div className="flex gap-2"><Btn onClick={exportCsv} title="Download CSV"><Download size={15} />CSV</Btn><Btn onClick={print} title="Print report"><Printer size={15} />Print</Btn></div>}>
        {data.entries.length ? <div className="space-y-4">{[...byDay.keys()].sort().reverse().slice(0, 120).map((d) => <div key={d}>
          <p className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500"><span>{fmtDay(d, { weekday: "long", month: "short", day: "numeric", year: d.slice(0, 4) === d0.slice(0, 4) ? undefined : "numeric" })}</span><span style={{ color: cfg.color }}>{fmtNum(dayValue(d) ?? 0, dec)} {cfg.metric.unit}</span></p>
          <EntryList list={byDay.get(d)!} cfg={cfg} s={s} onEdit={setEditing} onRemove={remove} />
        </div>)}</div> : <Empty>No entries yet.</Empty>}
      </Card>
    </>}
    {view === "settings" && <Card title="Settings">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cfg.goal && <Field label={cfg.goal.label}><NumIn value={data.goal} onChange={(n) => setData((dd) => ({ ...dd, goal: n === "" ? 0 : n }))} /></Field>}
        {(cfg.settings || []).map((f) => <Field key={f.key} label={f.label + (f.unit ? ` (${f.unit})` : "")}><FieldInput f={f} value={s[f.key]} onChange={(v) => setData((dd) => ({ ...dd, settings: { ...dd.settings, [f.key]: v } }))} /></Field>)}
      </div>
      <div className="mt-4 flex justify-end"><Btn kind="danger" onClick={() => { if (window.confirm("Delete every entry? This can't be undone.")) setData((dd) => ({ ...dd, entries: [] })); }}><Trash2 size={15} />Delete all entries</Btn></div>
    </Card>}
    {editing && <EntryEditor cfg={cfg} entry={editing} onClose={() => setEditing(null)} onSave={(e) => { save(e); setEditing(null); }} isNew={!data.entries.some((x) => x.id === editing.id)} />}
  </div>;
}

function EntryList({ list, cfg, s, onEdit, onRemove }: { list: Entry[]; cfg: TrackerConfig; s: any; onEdit: (e: Entry) => void; onRemove: (id: string) => void }) {
  return <ul className="divide-y divide-slate-100">{[...list].sort((a, b) => b.time.localeCompare(a.time)).map((e) => {
    const cl = cfg.classify?.(e, s);
    return <li key={e.id} className="flex items-center gap-3 py-2">
      <span className="w-16 shrink-0 text-xs font-semibold text-slate-500">{fmtTime(e.time)}</span>
      <span className="min-w-0 flex-1 text-sm text-slate-800">{cfg.describe ? cfg.describe(e, s) : <><b>{fmtNum(cfg.metric.value(e, s), cfg.metric.decimals ?? 0)}</b> {cfg.metric.unit}</>}</span>
      {cl && <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: cl.color }}>{cl.label}</span>}
      <button type="button" onClick={() => onEdit(e)} aria-label="Edit" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={14} /></button>
      <button type="button" onClick={() => onRemove(e.id)} aria-label="Delete" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14} /></button>
    </li>;
  })}</ul>;
}

export function FieldInput({ f, value, onChange }: { f: FieldDef; value: any; onChange: (v: any) => void }) {
  if (f.type === "number") return <NumIn value={value === undefined || value === null ? "" : value} onChange={onChange} min={f.min} max={f.max} step={f.step} placeholder={f.placeholder} />;
  if (f.type === "time") return <input type="time" value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
  if (f.type === "select") return <select value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputCls}>{f.optional && <option value="">—</option>}{(f.options || []).map((o) => <option key={o}>{o}</option>)}</select>;
  if (f.type === "bool") return <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />{f.placeholder || "Yes"}</label>;
  if (f.type === "scale") { const lo = f.min ?? 1, hi = f.max ?? 5; return <div className="flex flex-wrap gap-1">{Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).map((n) => <button key={n} type="button" onClick={() => onChange(n)} className={`h-9 min-w-9 rounded-lg px-2 text-sm font-bold ring-1 ${value === n ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200"}`}>{f.options?.[n - lo] ?? n}</button>)}</div>; }
  if (f.type === "chips") { const v: string[] = Array.isArray(value) ? value : []; return <div className="flex flex-wrap gap-1.5">{(f.options || []).map((o) => <button key={o} type="button" onClick={() => onChange(v.includes(o) ? v.filter((x) => x !== o) : [...v, o])} className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${v.includes(o) ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200"}`}>{o}</button>)}</div>; }
  return <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} className={inputCls} />;
}

function EntryEditor({ cfg, entry, onClose, onSave, isNew }: { cfg: TrackerConfig; entry: Entry; onClose: () => void; onSave: (e: Entry) => void; isNew: boolean }) {
  const [e, setE] = useState<Entry>(entry);
  const missing = cfg.fields.some((f) => !f.optional && f.type === "number" && (e[f.key] === "" || e[f.key] === undefined || e[f.key] === null));
  return <Modal title={isNew ? `Add ${cfg.entryName || "entry"}` : `Edit ${cfg.entryName || "entry"}`} onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" color={cfg.color} disabled={missing} onClick={() => onSave(e)}>Save</Btn></>}>
    <div className="grid grid-cols-2 gap-3">
      <Field label="Date"><input type="date" value={e.date} max={addDays(dayKey(), 0)} onChange={(ev) => setE({ ...e, date: ev.target.value || e.date })} className={inputCls} /></Field>
      <Field label="Time"><input type="time" value={e.time} onChange={(ev) => setE({ ...e, time: ev.target.value || e.time })} className={inputCls} /></Field>
      {cfg.fields.map((f) => <Field key={f.key} label={f.label + (f.unit ? ` (${f.unit})` : "") + (f.optional ? " — optional" : "")} className={f.half ? "" : "col-span-2"}><FieldInput f={f} value={e[f.key]} onChange={(v) => setE({ ...e, [f.key]: v })} /></Field>)}
    </div>
  </Modal>;
}
