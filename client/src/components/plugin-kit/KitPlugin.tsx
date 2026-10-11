// The Plugin Kit's tools: one screen each for list, checklist, log, cards and calculator plugins,
// drawn from the plugin's definition in shared/pluginKit.ts. Used by LifeHub sections and by
// WorkHub's plugins (opened from the Plugin Store). Records are passed in and saved by the hub.
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Check, Copy, ExternalLink, Eye, Heart, Minus, Phone, Plus, RotateCcw, Shuffle, Trash2, X } from "lucide-react";
import { addDaysTo, daysUntil, forDay, nextYearly } from "@shared/lifePlugins";
import type { KitCalc, KitCards, KitChecklist, KitDef, KitList, KitLog, KitRecord } from "@shared/pluginKit";
import { Empty, PageHead, Panel, danger, inputClass, plain, primary, soft } from "@/components/family-hub/ui";
import { kitIcon } from "./kitIcons";

export type KitProps = {
  def: KitDef;
  records: KitRecord[];
  setRecords: (update: (all: KitRecord[]) => KitRecord[]) => void;
  today: string;
  makeId: () => string;
  say: (message: string) => void;
};

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });
const niceDay = (d: string) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");
const copyText = async (text: string, say: (m: string) => void) => { try { await navigator.clipboard.writeText(text); say("Copied."); } catch { say("Couldn't copy on this device."); } };
const salt = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

export default function KitPlugin(props: KitProps) {
  const { def } = props;
  const Icon = kitIcon(def.icon);
  const eyebrow = def.type === "checklist" ? "Checklist" : def.type === "log" ? "Tracker" : def.type === "calc" ? "Calculator" : def.type === "cards" ? "Daily pick" : "List";
  return <div className="space-y-6">
    <div className="flex items-start gap-3">
      <span className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ background: def.color }} aria-hidden><Icon size={24} /></span>
      <div className="min-w-0 flex-1"><PageHead eyebrow={eyebrow} title={def.name} blurb={def.description} /></div>
    </div>
    {def.type === "list" ? <ListTool {...props} def={def} />
      : def.type === "checklist" ? <ChecklistTool {...props} def={def} />
      : def.type === "log" ? <LogTool {...props} def={def} />
      : def.type === "cards" ? <CardsTool {...props} def={def} />
      : <CalcTool {...props} def={def} />}
  </div>;
}

// ── List ─────────────────────────────────────────────────────────────────────

function ListTool({ def, records, setRecords, today, makeId, say }: KitProps & { def: KitList }) {
  const blank = () => Object.fromEntries(def.fields.map((fl) => [fl.key, ""])) as Record<string, string>;
  const [form, setForm] = useState(blank);
  const [tab, setTab] = useState(def.statuses?.[0] ?? "");
  const [picked, setPicked] = useState<string | null>(null);
  const mine = records.filter((r) => r.plugin === def.id);
  const first = def.fields[0];
  const status = (r: KitRecord) => String(r.data.status || def.statuses?.[0] || "");

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!form[first.key]?.trim()) return;
    const data: KitRecord["data"] = {};
    for (const fl of def.fields) {
      const v = (form[fl.key] || "").trim();
      if (!v) continue;
      data[fl.key] = fl.type === "number" || fl.type === "money" ? Math.max(0, Number(v.replace(/[^\d.]/g, "")) || 0) : v;
    }
    if (def.statuses) data.status = tab;
    setRecords((all) => [...all, { id: makeId(), plugin: def.id, date: "", data }]);
    setForm(blank());
  };
  const patch = (id: string, p: KitRecord["data"]) => setRecords((all) => all.map((r) => (r.id === id ? { ...r, data: { ...r.data, ...p } } : r)));

  let shown = def.statuses ? mine.filter((r) => status(r) === tab) : mine;
  shown = def.dueField ? [...shown].sort((a, b) => String(a.data[def.dueField!] || "9999").localeCompare(String(b.data[def.dueField!] || "9999"))) : [...shown].reverse();
  const sumField = def.fields.find((fl) => fl.key === def.sumField);
  const total = sumField ? shown.reduce((s, r) => s + (Number(r.data[sumField.key]) || 0), 0) : 0;

  const show = (fl: KitList["fields"][number], v: unknown): ReactNode => {
    if (v === undefined || v === "") return null;
    if (fl.type === "money") return money(Number(v));
    if (fl.type === "date") return niceDay(String(v));
    if (fl.type === "phone") return <a href={`tel:${String(v).replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline"><Phone size={12} />{String(v)}</a>;
    if (fl.type === "url") { const u = /^https?:\/\//i.test(String(v)) ? String(v) : `https://${v}`; return <a href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-violet-700 hover:underline">Link<ExternalLink size={11} /></a>; }
    return `${fl.label === "How many" ? "× " : ""}${String(v)}`;
  };

  return <>
    <Panel title="Add">
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {def.fields.map((fl) => fl.type === "select"
          ? <label key={fl.key} className="text-xs font-bold text-slate-500">{fl.label}<select value={form[fl.key]} onChange={(e) => setForm({ ...form, [fl.key]: e.target.value })} className={inputClass + " mt-1"}>{fl.options!.map((o) => <option key={o} value={o}>{o || "—"}</option>)}</select></label>
          : <label key={fl.key} className="text-xs font-bold text-slate-500">{fl.label}<input value={form[fl.key]} onChange={(e) => setForm({ ...form, [fl.key]: e.target.value })} type={fl.type === "date" ? "date" : fl.type === "time" ? "time" : "text"} inputMode={fl.type === "number" || fl.type === "money" ? "decimal" : fl.type === "phone" ? "tel" : fl.type === "url" ? "url" : undefined} maxLength={fl.type === "url" ? 1000 : 300} placeholder={fl.placeholder} className={inputClass + " mt-1"} /></label>)}
        <button type="submit" className={primary + " self-end"} disabled={!form[first.key]?.trim()}><Plus size={15} />Add{def.statuses ? ` to ${tab}` : ""}</button>
      </form>
      {def.hint && <p className="mt-3 text-xs text-slate-500">{def.hint}</p>}
    </Panel>
    {(def.statuses || sumField || def.random) && <div className="flex flex-wrap items-center gap-1.5">
      {def.statuses?.map((s) => <button key={s} type="button" onClick={() => setTab(s)} aria-pressed={tab === s} className={`min-h-10 rounded-xl px-4 text-sm font-bold ${tab === s ? "bg-[#292446] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900"}`}>{s} · {mine.filter((r) => status(r) === s).length}</button>)}
      {def.random && shown.length > 1 && <button type="button" onClick={() => { const r = shown[Math.floor(Math.random() * shown.length)]; setPicked(r.id); say(`Picked: ${r.data[first.key]}`); }} className={soft}><Shuffle size={15} />Pick one</button>}
      {sumField && shown.length > 0 && <span className="ml-auto text-sm font-bold text-slate-500">Total: <span className="text-base font-black text-slate-900">{sumField.type === "money" ? money(total) : total.toLocaleString()}</span></span>}
    </div>}
    <Panel>
      {shown.length ? <ul className="divide-y divide-slate-100">{shown.map((r) => {
        const due = def.dueField && r.data[def.dueField] ? daysUntil(String(r.data[def.dueField]), today) : null;
        return <li key={r.id} className={`flex flex-wrap items-center gap-3 py-3 ${picked === r.id ? "-mx-2 rounded-xl bg-amber-50 px-2" : ""}`}>
          <span className="min-w-0 flex-1">
            <span className="block font-extrabold text-[#232139]">{String(r.data[first.key] ?? "")}</span>
            <span className="flex flex-wrap gap-x-2 text-xs text-slate-500">{def.fields.slice(1).filter((fl) => fl.key !== def.dueField).map((fl) => { const v = show(fl, r.data[fl.key]); return v ? <span key={fl.key}>{fl.type === "money" || fl.type === "phone" || fl.type === "url" || fl.label === "How many" ? v : <>{fl.label}: {v}</>}</span> : null; })}</span>
          </span>
          {due !== null && <span className={`rounded-full px-2.5 py-1 text-xs font-black ${due < 0 ? "bg-rose-50 text-rose-600" : due <= 7 ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-500"}`}>{due < 0 ? `${-due}d ago` : due === 0 ? "Today" : `${niceDay(String(r.data[def.dueField!]))}`}</span>}
          {def.statuses && <select value={status(r)} onChange={(e) => patch(r.id, { status: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-600" aria-label="Move">{def.statuses.map((s) => <option key={s}>{s}</option>)}</select>}
          <button type="button" onClick={() => setRecords((all) => all.filter((x) => x.id !== r.id))} className={danger + " px-2"} aria-label="Delete"><Trash2 size={14} /></button>
        </li>; })}</ul> : <Empty icon={(() => { const I = kitIcon(def.icon); return <I />; })()} title="Nothing here yet.">Add the first one above.</Empty>}
    </Panel>
  </>;
}

// ── Checklist ────────────────────────────────────────────────────────────────

function ChecklistTool({ def, records, setRecords, makeId, say }: KitProps & { def: KitChecklist }) {
  const [text, setText] = useState("");
  const mine = records.filter((r) => r.plugin === def.id);
  const rec = (t: string) => mine.find((r) => r.data.text === t);
  const custom = mine.filter((r) => r.data.custom === true).map((r) => String(r.data.text));
  const items = [...def.items.filter((t) => !rec(t)?.data.hidden), ...custom];
  const isOn = (t: string) => rec(t)?.data.checked === true;
  const upsert = (t: string, p: KitRecord["data"]) => setRecords((all) => {
    const i = all.findIndex((r) => r.plugin === def.id && r.data.text === t);
    if (i >= 0) return all.map((r, j) => (j === i ? { ...r, data: { ...r.data, ...p } } : r));
    return [...all, { id: makeId(), plugin: def.id, date: "", data: { text: t, ...p } }];
  });
  const done = items.filter(isOn).length;
  const hidden = def.items.filter((t) => rec(t)?.data.hidden).length;

  return <>
    <Panel>
      <div className="flex items-center justify-between text-sm font-bold"><span>{done} of {items.length} done</span>{done > 0 && <button type="button" onClick={() => { setRecords((all) => all.map((r) => (r.plugin === def.id ? { ...r, data: { ...r.data, checked: false } } : r))); say("Checklist reset."); }} className={plain + " text-xs"}><RotateCcw size={13} />Start over</button>}</div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%`, background: def.color }} /></div>
      {done === items.length && items.length > 0 && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">All done! 🎉</p>}
    </Panel>
    <Panel>
      <ul className="space-y-1.5">{items.map((t) => <li key={t} className="flex items-center gap-2">
        <button type="button" onClick={() => upsert(t, { checked: !isOn(t) })} aria-pressed={isOn(t)} className={`flex min-h-12 flex-1 items-center gap-3 rounded-2xl px-3 text-left text-sm font-bold transition ${isOn(t) ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${isOn(t) ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent"}`}><Check size={15} /></span><span className={isOn(t) ? "line-through" : ""}>{t}</span></button>
        <button type="button" onClick={() => (custom.includes(t) ? setRecords((all) => all.filter((r) => !(r.plugin === def.id && r.data.text === t))) : upsert(t, { hidden: true, checked: false }))} className="rounded-lg p-1.5 text-slate-300 hover:text-rose-500" aria-label={`Remove ${t}`}><X size={14} /></button>
      </li>)}</ul>
      <form onSubmit={(e) => { e.preventDefault(); const t = text.trim().slice(0, 200); if (!t || items.includes(t)) return; upsert(t, { custom: true, checked: false, hidden: false }); setText(""); }} className="mt-3 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="Add your own item" className={inputClass} aria-label="Add an item" /><button type="submit" className={plain} aria-label="Add"><Plus size={16} /></button>
      </form>
      {hidden > 0 && <button type="button" onClick={() => setRecords((all) => all.map((r) => (r.plugin === def.id && r.data.hidden ? { ...r, data: { ...r.data, hidden: false } } : r)))} className="mt-3 text-xs font-bold text-violet-700 hover:underline">Bring back {hidden} removed item{hidden === 1 ? "" : "s"}</button>}
    </Panel>
  </>;
}

// ── Log ──────────────────────────────────────────────────────────────────────

function LogTool({ def, records, setRecords, today, makeId }: KitProps & { def: KitLog }) {
  const [day, setDay] = useState(today);
  const byDate = useMemo(() => new Map(records.filter((r) => r.plugin === def.id && r.date).map((r) => [r.date, r])), [records, def.id]);
  const val = (d: string) => Number(byDate.get(d)?.data.value ?? 0);
  const has = (d: string) => byDate.has(d);
  const setVal = (d: string, v: number) => {
    const clean = Math.max(0, Math.min(def.max, Math.round(v * 100) / 100));
    setRecords((all) => { const i = all.findIndex((r) => r.plugin === def.id && r.date === d); return i >= 0 ? all.map((r, j) => (j === i ? { ...r, data: { value: clean } } : r)) : [...all, { id: makeId(), plugin: def.id, date: d, data: { value: clean } }]; });
  };
  const meets = (d: string) => has(d) && (def.binary ? val(d) >= 1 : def.goal === undefined ? true : def.lower ? val(d) <= def.goal : val(d) >= def.goal);
  let streak = 0;
  for (let d = meets(today) ? today : addDaysTo(today, -1); meets(d); d = addDaysTo(d, -1)) streak++;
  const days = Array.from({ length: 14 }, (_, i) => addDaysTo(today, i - 13));
  const top = Math.max(def.goal ?? 0, ...days.map(val), def.binary ? 1 : 1);
  const logged = days.filter(has);
  const avg = logged.length ? logged.reduce((s, d) => s + val(d), 0) / logged.length : 0;
  const v = val(day);

  return <>
    <Panel title={day === today ? "Today" : niceDay(day)} right={day !== today ? <button type="button" onClick={() => setDay(today)} className={plain + " text-xs"}>Back to today</button> : undefined}>
      {def.binary
        ? <button type="button" onClick={() => setVal(day, v >= 1 ? 0 : 1)} aria-pressed={v >= 1} className={`flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl text-lg font-black transition ${v >= 1 ? "text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`} style={v >= 1 ? { background: def.color } : undefined}>{v >= 1 ? <><Check size={24} />Yes! Done</> : def.ask}</button>
        : <div className="flex flex-col items-center gap-3 py-2 sm:flex-row sm:justify-center">
            <button type="button" onClick={() => setVal(day, v - def.step)} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Less"><Minus size={22} /></button>
            <div className="text-center"><input value={has(day) ? v : ""} onChange={(e) => setVal(day, Number(e.target.value) || 0)} inputMode="decimal" placeholder="0" className="w-40 bg-transparent text-center text-5xl font-black tabular-nums outline-none" aria-label={def.ask} /><p className="text-sm font-bold text-slate-500">{def.unit}{def.goal !== undefined ? ` · ${def.lower ? "limit" : "goal"} ${def.goal}` : ""}</p></div>
            <button type="button" onClick={() => setVal(day, v + def.step)} className="flex h-14 w-14 items-center justify-center rounded-2xl text-white" style={{ background: def.color }} aria-label="More"><Plus size={22} /></button>
          </div>}
    </Panel>
    <Panel title="Last 2 weeks" right={<span className="text-sm font-bold text-slate-500">{def.goal !== undefined || def.binary ? `${streak} day streak` : logged.length ? `Avg ${Math.round(avg * 10) / 10} ${def.unit}` : ""}</span>}>
      <div className="relative flex h-40 items-end gap-1.5">
        {def.goal !== undefined && !def.binary && <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-slate-300" style={{ bottom: `${(def.goal / top) * 128 + 20}px` }} aria-hidden />}
        {days.map((d) => { const x = val(d); return <button key={d} type="button" onClick={() => setDay(d)} className={`flex flex-1 flex-col items-center gap-1 rounded-lg ${d === day ? "bg-slate-50" : ""}`} aria-label={`${niceDay(d)}: ${has(d) ? x : "nothing"} ${def.unit}`}>
          <span className="text-[10px] font-bold text-slate-500">{has(d) && !def.binary ? x : ""}</span>
          <div className="w-full rounded-t-md" style={{ height: has(d) ? `${Math.max(4, (x / top) * 128)}px` : "0px", background: meets(d) ? def.color : "#cbd5e1" }} />
          <span className="text-[10px] font-bold text-slate-400">{new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" })}</span>
        </button>; })}
      </div>
      <p className="mt-2 text-xs text-slate-500">Tap a day to change it.</p>
    </Panel>
  </>;
}

// ── Cards ────────────────────────────────────────────────────────────────────

function CardsTool({ def, records, setRecords, today, makeId, say }: KitProps & { def: KitCards }) {
  const daily = forDay(def.items, today, salt(def.id));
  const [shown, setShown] = useState(daily);
  const [revealed, setRevealed] = useState(false);
  const [browse, setBrowse] = useState(false);
  const favs = records.filter((r) => r.plugin === def.id);
  const isFav = (t: string) => favs.some((r) => r.data.ref === t);
  const toggleFav = (t: string) => setRecords((all) => (isFav(t) ? all.filter((r) => !(r.plugin === def.id && r.data.ref === t)) : [...all, { id: makeId(), plugin: def.id, date: "", data: { ref: t } }]));
  const another = () => { let n = shown; while (def.items.length > 1 && n.t === shown.t) n = def.items[Math.floor(Math.random() * def.items.length)]; setShown(n); setRevealed(false); };
  const full = (c: { t: string; a?: string }) => (c.a ? `${c.t} ${c.a}` : c.t);

  return <>
    <section className="relative overflow-hidden rounded-[2rem] p-7 text-white shadow-[0_18px_40px_#17152b33] sm:p-9" style={{ background: `linear-gradient(135deg, ${def.color}, #2d2555)` }}>
      <p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-white/70">{shown.t === daily.t ? `Today's ${def.noun}` : `Another ${def.noun}`}</p>
      <p className="mt-3 text-2xl font-black leading-snug sm:text-3xl">{shown.t}</p>
      {shown.a && (revealed ? <p className="mt-4 text-xl font-bold text-white/90">{shown.a}</p> : <button type="button" onClick={() => setRevealed(true)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/20 px-4 text-sm font-bold hover:bg-white/30"><Eye size={16} />{def.reveal || "Show answer"}</button>)}
      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={another} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/15 px-3 text-sm font-semibold hover:bg-white/25"><Shuffle size={16} />Another</button>
        <button type="button" onClick={() => toggleFav(shown.t)} aria-pressed={isFav(shown.t)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/15 px-3 text-sm font-semibold hover:bg-white/25"><Heart size={16} className={isFav(shown.t) ? "fill-current" : ""} />{isFav(shown.t) ? "Saved" : "Save"}</button>
        <button type="button" onClick={() => copyText(full(shown), say)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/15 px-3 text-sm font-semibold hover:bg-white/25"><Copy size={16} />Copy</button>
        {shown.t !== daily.t && <button type="button" onClick={() => { setShown(daily); setRevealed(false); }} className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-white/80 hover:bg-white/10">Back to today's</button>}
      </div>
    </section>
    {favs.length > 0 && <Panel title={`Saved · ${favs.length}`}><ul className="space-y-2">{def.items.filter((c) => isFav(c.t)).map((c) => <li key={c.t} className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-sm"><span className="min-w-0 flex-1"><span className="font-bold">{c.t}</span>{c.a && <span className="block text-slate-500">{c.a}</span>}</span><button type="button" onClick={() => toggleFav(c.t)} className="rounded-lg p-1 text-rose-400 hover:text-rose-600" aria-label="Remove from saved"><Heart size={14} className="fill-current" /></button></li>)}</ul></Panel>}
    <Panel title={`All ${def.items.length}`} right={<button type="button" onClick={() => setBrowse((b) => !b)} className={plain + " text-xs"}>{browse ? "Hide" : "Show all"}</button>}>
      {browse ? <ul className="divide-y divide-slate-100">{def.items.map((c) => <li key={c.t} className="py-2.5 text-sm"><button type="button" onClick={() => { setShown(c); setRevealed(false); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-left font-semibold text-slate-700 hover:text-violet-700">{c.t}</button></li>)}</ul> : <p className="text-sm text-slate-500">A new one shows up every day. Tap "Show all" to browse them.</p>}
    </Panel>
  </>;
}

// ── Calculators ──────────────────────────────────────────────────────────────

const num = (v: string) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const Field = ({ label, value, onChange, suffix, type = "number" }: { label: string; value: string; onChange: (v: string) => void; suffix?: string; type?: string }) =>
  <label className="block text-xs font-bold text-slate-500">{label}<span className="mt-1 flex items-center gap-2"><input type={type} inputMode={type === "number" ? "decimal" : undefined} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass + " text-lg font-black"} />{suffix && <span className="text-sm text-slate-400">{suffix}</span>}</span></label>;
const Result = ({ children }: { children: ReactNode }) => <section className="flex flex-col justify-center rounded-[1.5rem] bg-gradient-to-br from-[#2d2555] to-[#6d5ce7] p-7 text-white shadow-[0_18px_40px_#4b3fa033]" aria-live="polite">{children}</section>;
const Big = ({ label, value }: { label: string; value: ReactNode }) => <div><p className="text-sm font-bold text-violet-200">{label}</p><p className="text-4xl font-black tracking-tight">{value}</p></div>;

/** Reads "1 1/2", "1/2", "½", "2.5" at the start of an ingredient line. */
function leadingAmount(line: string): { n: number; rest: string } | null {
  const uni: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };
  const m = line.match(/^\s*(\d+)?\s*([½¼¾⅓⅔⅛])/);
  if (m) return { n: (m[1] ? Number(m[1]) : 0) + uni[m[2]], rest: line.slice(m[0].length) };
  const mixed = line.match(/^\s*(\d+)\s+(\d+)\/(\d+)/);
  if (mixed && Number(mixed[3])) return { n: Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]), rest: line.slice(mixed[0].length) };
  const frac = line.match(/^\s*(\d+)\/(\d+)/);
  if (frac && Number(frac[2])) return { n: Number(frac[1]) / Number(frac[2]), rest: line.slice(frac[0].length) };
  const dec = line.match(/^\s*(\d+(?:\.\d+)?)/);
  return dec ? { n: Number(dec[1]), rest: line.slice(dec[0].length) } : null;
}
function prettyAmount(n: number): string {
  const whole = Math.floor(n), part = n - whole;
  const fracs: [number, string][] = [[0, ""], [0.125, "1/8"], [0.25, "1/4"], [1 / 3, "1/3"], [0.5, "1/2"], [2 / 3, "2/3"], [0.75, "3/4"], [1, ""]];
  const [v, s] = fracs.reduce((best, f) => (Math.abs(f[0] - part) < Math.abs(best[0] - part) ? f : best));
  if (Math.abs(v - part) > 0.04) return String(Math.round(n * 100) / 100);
  const w = v === 1 ? whole + 1 : whole;
  return [w || "", s].filter(Boolean).join(" ") || "0";
}
const shuffle = <T,>(list: T[]) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function CalcTool({ def, records, setRecords, today, makeId, say }: KitProps & { def: KitCalc }) {
  const [a, setA] = useState(""), [b, setB] = useState(""), [c, setC] = useState(""), [d, setD] = useState(""), [e, setE] = useState(""), [g, setG] = useState("");
  // The class list (group maker and picker) is saved, so it doesn't need typing again.
  const saved = records.find((r) => r.plugin === def.id && typeof r.data.names === "string");
  const [names, setNamesState] = useState(String(saved?.data.names ?? ""));
  const setNames = (v: string) => { setNamesState(v); setRecords((all) => { const i = all.findIndex((r) => r.plugin === def.id && typeof r.data.names === "string"); const data = { names: v.slice(0, 1000) }; return i >= 0 ? all.map((r, j) => (j === i ? { ...r, data } : r)) : [...all, { id: makeId(), plugin: def.id, date: "", data }]; }); };
  const list = names.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
  const [groups, setGroups] = useState<string[][]>([]);
  const [pickedSet, setPickedSet] = useState<string[]>([]);
  const [pick, setPick] = useState("");
  const [right, setRight] = useState(0), [wrong, setWrong] = useState(0);

  switch (def.calc) {
    case "age": {
      const born = a; const ok = /^\d{4}-\d{2}-\d{2}$/.test(born) && born <= today;
      let y = 0, mo = 0, dd = 0;
      if (ok) { const [by, bm, bd] = born.split("-").map(Number), [ty, tm, td] = today.split("-").map(Number); y = ty - by; mo = tm - bm; dd = td - bd; if (dd < 0) { mo--; dd += new Date(Date.UTC(ty, tm - 1, 0)).getUTCDate(); } if (mo < 0) { y--; mo += 12; } }
      const next = ok ? nextYearly(Number(born.slice(5, 7)), Number(born.slice(8, 10)), Number(born.slice(0, 4)), today) : null;
      return <div className="grid gap-6 lg:grid-cols-2"><Panel><Field label="Birthday" type="date" value={a} onChange={setA} /></Panel>
        <Result>{ok ? <><Big label="Age" value={`${y} years`} /><p className="mt-1 text-lg font-bold">{mo} months, {dd} days</p><p className="mt-4 text-sm text-violet-100">{Math.abs(daysUntil(born, today)).toLocaleString()} days alive · next birthday {next!.days === 0 ? "is today! 🎉" : `in ${next!.days} days (turning ${next!.turns})`}</p></> : <p className="text-violet-200">Pick a birthday.</p>}</Result></div>;
    }
    case "datediff": {
      const ok = /^\d{4}-\d{2}-\d{2}$/.test(a) && /^\d{4}-\d{2}-\d{2}$/.test(b);
      const days = ok ? daysUntil(b, a) : 0;
      let weekdays = 0;
      if (ok && Math.abs(days) <= 40000) { const [lo, hi] = days >= 0 ? [a, b] : [b, a]; for (let x = lo; x < hi; x = addDaysTo(x, 1)) { const wd = new Date(`${x}T12:00:00Z`).getUTCDay(); if (wd && wd < 6) weekdays++; } }
      const added = /^\d{4}-\d{2}-\d{2}$/.test(a || today) && c.trim() ? addDaysTo(a || today, Math.trunc(num(c))) : "";
      return <div className="grid gap-6 lg:grid-cols-2"><Panel><div className="space-y-3"><Field label="From" type="date" value={a} onChange={setA} /><Field label="To" type="date" value={b} onChange={setB} /><Field label="Or add this many days to the first date" value={c} onChange={setC} suffix="days" /></div></Panel>
        <Result>{ok ? <><Big label="Between them" value={`${Math.abs(days).toLocaleString()} days`} /><p className="mt-1 text-lg font-bold">{Math.floor(Math.abs(days) / 7)} weeks, {Math.abs(days) % 7} days · {weekdays.toLocaleString()} weekdays</p></> : <p className="text-violet-200">Pick two dates.</p>}{added && <p className="mt-4 text-sm text-violet-100">{niceDay(a || today)} + {Math.trunc(num(c))} days = <span className="font-black text-white">{niceDay(added)}</span></p>}</Result></div>;
    }
    case "percent": {
      const r1 = (num(a) / 100) * num(b), r2 = num(d) ? (num(c) / num(d)) * 100 : 0, r3 = num(e) ? ((num(g) - num(e)) / num(e)) * 100 : 0;
      const row = (k: string, children: ReactNode, out: string) => <div key={k} className="rounded-2xl bg-slate-50 p-4"><div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-600">{children}</div><p className="mt-2 text-2xl font-black text-violet-700">{out}</p></div>;
      const box = (v: string, set: (s: string) => void, label: string) => <input value={v} onChange={(ev) => set(ev.target.value)} inputMode="decimal" className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-base font-black" aria-label={label} />;
      return <Panel><div className="grid gap-3 md:grid-cols-3">
        {row("of", <>What is {box(a, setA, "percent")}% of {box(b, setB, "number")}?</>, a && b ? String(Math.round(r1 * 100) / 100) : "—")}
        {row("what", <>{box(c, setC, "part")} is what % of {box(d, setD, "whole")}?</>, c && d ? `${Math.round(r2 * 100) / 100}%` : "—")}
        {row("change", <>From {box(e, setE, "old")} to {box(g, setG, "new")}</>, e && g ? `${r3 >= 0 ? "+" : ""}${Math.round(r3 * 100) / 100}%` : "—")}
      </div></Panel>;
    }
    case "scale": {
      const from = num(b) || 0, to = num(c) || 0, k = from && to ? to / from : 1;
      const out = a.split("\n").filter((l) => l.trim()).map((l) => { const m = leadingAmount(l); return m ? `${prettyAmount(m.n * k)}${m.rest.startsWith(" ") ? "" : " "}${m.rest.trimStart() ? m.rest : ""}`.replace(/\s+/g, " ").trim() : l.trim(); });
      return <div className="grid gap-6 lg:grid-cols-2"><Panel><div className="space-y-3"><div className="grid grid-cols-2 gap-2"><Field label="Recipe serves" value={b} onChange={setB} /><Field label="I want to serve" value={c} onChange={setC} /></div>
        <label className="block text-xs font-bold text-slate-500">Ingredients, one per line<textarea value={a} onChange={(ev) => setA(ev.target.value)} rows={8} placeholder={"2 cups flour\n1 1/2 tsp salt\n3 eggs"} className={inputClass + " mt-1 py-3 leading-6"} /></label></div></Panel>
        <Panel title={from && to ? `Scaled × ${Math.round(k * 100) / 100}` : "Scaled"} right={out.length ? <button type="button" onClick={() => copyText(out.join("\n"), say)} className={plain}><Copy size={15} />Copy</button> : undefined}>{out.length && from && to ? <ul className="space-y-1.5 text-sm">{out.map((l, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />{l}</li>)}</ul> : <p className="text-sm text-slate-500">Fill in the servings and ingredients.</p>}</Panel></div>;
    }
    case "paint": {
      const L = num(a), Wd = num(b), H = num(c) || 8, doors = Math.max(0, Math.trunc(num(d))), wins = Math.max(0, Math.trunc(num(e))), coats = Math.max(1, Math.trunc(num(g) || 2));
      const area = Math.max(0, 2 * (L + Wd) * H - doors * 21 - wins * 15), gallons = (area * coats) / 350;
      return <div className="grid gap-6 lg:grid-cols-2"><Panel><div className="grid grid-cols-2 gap-3"><Field label="Room length" value={a} onChange={setA} suffix="ft" /><Field label="Room width" value={b} onChange={setB} suffix="ft" /><Field label="Wall height" value={c} onChange={setC} suffix="ft" /><Field label="Coats" value={g} onChange={setG} /><Field label="Doors" value={d} onChange={setD} /><Field label="Windows" value={e} onChange={setE} /></div></Panel>
        <Result>{L && Wd ? <><Big label="Paint to buy" value={`${Math.ceil(gallons * 2) / 2} gal`} /><p className="mt-1 text-sm text-violet-100">{Math.round(area)} sq ft of wall × {coats} coat{coats === 1 ? "" : "s"}. Based on about 350 sq ft per gallon; check your paint can.</p></> : <p className="text-violet-200">Type the room's length and width.</p>}</Result></div>;
    }
    case "discount": {
      const price = num(a), off = num(b), extra = num(c), tax = num(d);
      const after = price * (1 - off / 100) * (1 - extra / 100), total = after * (1 + tax / 100);
      return <div className="grid gap-6 lg:grid-cols-2"><Panel><div className="grid grid-cols-2 gap-3"><Field label="Price" value={a} onChange={setA} suffix="$" /><Field label="Percent off" value={b} onChange={setB} suffix="%" /><Field label="Extra percent off" value={c} onChange={setC} suffix="%" /><Field label="Sales tax" value={d} onChange={setD} suffix="%" /></div></Panel>
        <Result>{price ? <><Big label="You pay" value={money(total)} /><p className="mt-1 text-sm text-violet-100">Sale price {money(after)} · you save {money(price - after)}{tax ? ` · tax ${money(total - after)}` : ""}</p></> : <p className="text-violet-200">Type the price.</p>}</Result></div>;
    }
    case "grade": {
      const total = num(a), earned = b.trim() ? num(b) : total - num(c), pct = total ? (earned / total) * 100 : 0;
      const letter = (p: number) => (p >= 90 ? "A" : p >= 80 ? "B" : p >= 70 ? "C" : p >= 60 ? "D" : "F");
      return <div className="space-y-6"><div className="grid gap-6 lg:grid-cols-2"><Panel><div className="space-y-3"><Field label="Total points (or questions)" value={a} onChange={setA} /><Field label="Points earned" value={b} onChange={setB} /><p className="text-center text-xs font-bold text-slate-400">or</p><Field label="Number wrong" value={c} onChange={(v) => { setC(v); setB(""); }} /></div></Panel>
        <Result>{total ? <><Big label="Score" value={`${Math.round(pct * 10) / 10}%`} /><p className="mt-1 text-2xl font-black">{letter(pct)}</p><p className="mt-2 text-sm text-violet-100">{Math.round(earned * 100) / 100} of {total} · each point is worth {Math.round((100 / total) * 100) / 100}%</p><p className="mt-2 text-xs text-violet-200">Letters use a 90/80/70/60 scale. Use your school's scale if it's different.</p></> : <p className="text-violet-200">Type the total.</p>}</Result></div>
        {total > 0 && total <= 100 && Number.isInteger(total) && <Panel title={`Quick chart for ${total}`}><div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-8">{Array.from({ length: Math.min(total, 40) + 1 }, (_, w) => <div key={w} className="rounded-lg bg-slate-50 px-2 py-1.5 text-center text-xs"><span className="font-bold text-slate-400">−{w}</span> <span className="font-black">{Math.round(((total - w) / total) * 1000) / 10}%</span></div>)}</div></Panel>}</div>;
    }
    case "trials": {
      const n = right + wrong, pct = n ? (right / n) * 100 : 0, goal = num(a);
      return <div className="grid gap-6 lg:grid-cols-2"><Panel><div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => setRight((x) => x + 1)} className="flex min-h-32 flex-col items-center justify-center rounded-2xl bg-emerald-500 text-white hover:bg-emerald-600"><Check size={32} /><span className="text-lg font-black">Correct</span><span className="text-3xl font-black">{right}</span></button>
          <button type="button" onClick={() => setWrong((x) => x + 1)} className="flex min-h-32 flex-col items-center justify-center rounded-2xl bg-rose-500 text-white hover:bg-rose-600"><X size={32} /><span className="text-lg font-black">Incorrect</span><span className="text-3xl font-black">{wrong}</span></button></div>
          <div className="mt-3 flex gap-2"><button type="button" onClick={() => { setRight(0); setWrong(0); }} className={plain}><RotateCcw size={15} />Reset</button><button type="button" onClick={() => setRight((x) => Math.max(0, x - 1))} className={plain} disabled={!right}>Undo correct</button><button type="button" onClick={() => setWrong((x) => Math.max(0, x - 1))} className={plain} disabled={!wrong}>Undo incorrect</button></div>
          <div className="mt-4"><Field label="IEP goal" value={a} onChange={setA} suffix="% correct" /></div></Panel>
        <Result>{n ? <><Big label="Correct" value={`${Math.round(pct)}%`} /><p className="mt-1 text-lg font-bold">{right} of {n} trials</p>{goal > 0 && <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-black ${pct >= goal ? "bg-emerald-400/30" : "bg-white/15"}`}>{pct >= goal ? "Goal met ✓" : `${Math.round(goal - pct)}% below goal`}</p>}<button type="button" onClick={() => copyText(`${today}: ${right}/${n} correct (${Math.round(pct)}%)${goal ? `, goal ${goal}%` : ""}`, say)} className="mt-4 inline-flex min-h-10 w-fit items-center gap-2 rounded-xl bg-white/15 px-3 text-sm font-bold hover:bg-white/25"><Copy size={15} />Copy result</button></> : <p className="text-violet-200">Tap correct or incorrect for each trial.</p>}</Result></div>;
    }
    case "groups":
    case "picker": {
      const names_ = <label className="block text-xs font-bold text-slate-500">Class list (one per line or commas){saved ? " · saved" : ""}<textarea value={names} onChange={(ev) => setNames(ev.target.value)} rows={8} placeholder={"Maya\nLeo\nAva\nNoah"} className={inputClass + " mt-1 py-3 leading-6"} /></label>;
      if (def.calc === "groups") {
        const size = Math.max(1, Math.trunc(num(a) || 4)), byCount = b === "count";
        const make = () => { const s = shuffle(list); const count = byCount ? Math.min(size, s.length) : Math.ceil(s.length / size); const out: string[][] = Array.from({ length: Math.max(1, count) }, () => []); s.forEach((nm, i) => out[i % out.length].push(nm)); setGroups(out); };
        return <div className="grid gap-6 lg:grid-cols-2"><Panel><div className="space-y-3">{names_}<div className="flex items-end gap-2"><Field label={byCount ? "Number of groups" : "Students per group"} value={a || "4"} onChange={setA} /><button type="button" onClick={() => setB(byCount ? "" : "count")} className={plain + " text-xs"}>{byCount ? "Set group size instead" : "Set number of groups instead"}</button></div><button type="button" onClick={make} disabled={list.length < 2} className={primary + " w-full"}><Shuffle size={16} />Make groups</button></div></Panel>
          <Panel title={groups.length ? `${groups.length} groups` : "Groups"} right={groups.length ? <button type="button" onClick={() => copyText(groups.map((gr, i) => `Group ${i + 1}: ${gr.join(", ")}`).join("\n"), say)} className={plain}><Copy size={15} />Copy</button> : undefined}>{groups.length ? <div className="grid gap-2 sm:grid-cols-2">{groups.map((gr, i) => <div key={i} className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-black uppercase tracking-wide" style={{ color: def.color }}>Group {i + 1}</p><p className="mt-1 text-sm font-bold">{gr.join(", ")}</p></div>)}</div> : <p className="text-sm text-slate-500">Paste your class list and tap Make groups.</p>}</Panel></div>;
      }
      const left = list.filter((nm) => !pickedSet.includes(nm));
      const doPick = () => { const pool = left.length ? left : list; if (!pool.length) return; const nm = pool[Math.floor(Math.random() * pool.length)]; setPick(nm); setPickedSet((p) => (left.length ? [...p, nm] : [nm])); };
      return <div className="grid gap-6 lg:grid-cols-2"><Panel>{names_}</Panel>
        <Result><Big label={pick ? "Your turn" : "Ready"} value={<span className="text-6xl">{pick || "?"}</span>} /><p className="mt-2 text-sm text-violet-100">{list.length ? `${left.length} of ${list.length} haven't had a turn this round` : "Add your class list"}</p>
          <div className="mt-5 flex gap-2"><button type="button" onClick={doPick} disabled={!list.length} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 text-base font-black text-[#2d2555] hover:bg-violet-50"><Shuffle size={18} />Pick</button>{pickedSet.length > 0 && <button type="button" onClick={() => { setPickedSet([]); setPick(""); }} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white/15 px-4 text-sm font-bold hover:bg-white/25"><RotateCcw size={15} />New round</button>}</div></Result></div>;
    }
    case "wcpm": {
      const words = num(a), errors = num(b), secs = num(c) || 60;
      const correct = Math.max(0, words - errors), wcpm = secs ? (correct / secs) * 60 : 0, acc = words ? (correct / words) * 100 : 0;
      return <div className="grid gap-6 lg:grid-cols-2"><Panel><div className="space-y-3"><Field label="Words read (attempted)" value={a} onChange={setA} /><Field label="Errors" value={b} onChange={setB} /><Field label="Time" value={c} onChange={setC} suffix="seconds (60 if blank)" /></div></Panel>
        <Result>{words ? <><Big label="Words correct per minute" value={Math.round(wcpm)} /><p className="mt-1 text-lg font-bold">{Math.round(acc * 10) / 10}% accuracy</p><p className="mt-2 text-sm text-violet-100">{correct} correct of {words} words in {secs} seconds</p><button type="button" onClick={() => copyText(`${today}: ${Math.round(wcpm)} WCPM, ${Math.round(acc)}% accuracy (${correct}/${words}, ${secs}s)`, say)} className="mt-4 inline-flex min-h-10 w-fit items-center gap-2 rounded-xl bg-white/15 px-3 text-sm font-bold hover:bg-white/25"><Copy size={15} />Copy result</button></> : <p className="text-violet-200">Type the words read and errors.</p>}</Result></div>;
    }
  }
}
