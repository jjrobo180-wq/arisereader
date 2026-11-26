// Life Score's Stats, Explore and Records screens (data from shared/lifeStats.ts): every chart kind, a page per
// part of life, the Explorer (any two daily numbers side by side, how they move together, a 26-week heatmap,
// weekday pattern and totals) and the records and insights across everything. Plain SVG and CSS, no libraries.
import { useMemo, useState, type ReactNode } from "react";
import { Activity, Brain, Briefcase, ChevronLeft, ChevronRight, ClipboardList, Clock, DollarSign, Heart, HeartPulse, Home, ListTodo, Moon, Scale, Shield, Sparkles, Target, Trophy, User, Users, Utensils } from "lucide-react";
import { correlate, type Chart, type Series, type StatSection } from "@shared/lifeStats";

const ICONS: Record<string, typeof Activity> = { user: User, list: ListTodo, food: Utensils, activity: Activity, moon: Moon, heart: HeartPulse, scale: Scale, brain: Brain, clipboard: ClipboardList, people: Users, target: Target, money: DollarSign, clock: Clock, home: Home, work: Briefcase, shield: Shield };
const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : (Math.round(v * 10) / 10).toLocaleString());
const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const cls = `rounded-[22px] border border-slate-200/70 bg-white p-4 sm:p-5 ${className}`;
  return onClick ? <button type="button" onClick={onClick} className={`${cls} block w-full text-left transition hover:border-slate-300 active:scale-[.99]`}>{children}</button> : <div className={cls}>{children}</div>;
}
export const Eyebrow = ({ children }: { children: ReactNode }) => <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{children}</p>;
export function Back({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return <button type="button" onClick={onClick} className="mb-3 inline-flex min-h-10 items-center gap-1 rounded-full pr-3 text-sm font-semibold text-slate-500 hover:text-slate-900"><ChevronLeft className="h-5 w-5" />{label}</button>;
}

// ——— Charts ——————————————————————————————————————————————————————————————————————————————————————————————————
function Picked({ text }: { text: string }) {
  return <p className="h-5 text-[13px] font-semibold tabular-nums text-slate-700">{text}</p>;
}

function BarsChart({ values, dates, unit, goal, color = "#0f172a", line = false }: { values: (number | null)[]; dates: string[]; unit: string; goal?: number; color?: string; line?: boolean }) {
  const [pick, setPick] = useState<number | null>(null);
  const nums = values.filter((v): v is number => v !== null);
  const max = Math.max(1, ...nums, goal ?? 0), min = line ? Math.min(...nums, goal ?? Infinity) : 0;
  const lo = line && nums.length ? min - (max - min) * 0.15 : 0, span = Math.max(1e-9, max - lo);
  const y = (v: number) => 100 - ((v - lo) / span) * 100;
  const shown = pick ?? (() => { for (let i = values.length - 1; i >= 0; i--) if (values[i] !== null) return i; return null; })();
  const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  return (
    <div>
      <Picked text={shown !== null && values[shown] !== null ? `${pick === null ? "Latest · " : ""}${shortDate(dates[shown])}: ${fmt(values[shown]!)} ${unit}` : nums.length ? `Average ${fmt(avg)} ${unit}` : "No data yet"} />
      <div className="relative mt-1 h-36" onMouseLeave={() => setPick(null)}>
        {goal !== undefined && <div className="absolute inset-x-0 border-t border-dashed border-slate-300" style={{ top: `${y(goal)}%` }}><span className="absolute -top-4 right-0 text-[10px] font-semibold text-slate-400">goal {fmt(goal)}</span></div>}
        {line ? (
          <svg viewBox={`0 0 ${values.length - 1 || 1} 100`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            <path d={values.map((v, i) => (v === null ? "" : `${i === 0 || values[i - 1] === null ? "M" : "L"}${i},${y(v)}`)).join(" ")} fill="none" stroke={color} strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        ) : null}
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {values.map((v, i) => (
            <button key={i} type="button" aria-label={`${shortDate(dates[i])}: ${v === null ? "no data" : `${fmt(v)} ${unit}`}`} onMouseEnter={() => setPick(i)} onClick={() => setPick(pick === i ? null : i)} className="relative h-full flex-1">
              {!line && <span className="absolute inset-x-0 bottom-0 rounded-t-[3px]" style={{ height: v === null ? 2 : `${Math.max(2, ((v - lo) / span) * 100)}%`, background: v === null ? "#e2e8f0" : color, opacity: v === null ? 1 : shown === i ? 1 : 0.5 }} />}
              {line && v !== null && shown === i && <span className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" style={{ top: `${y(v)}%`, background: color }} />}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-medium text-slate-400"><span>{shortDate(dates[0])}</span><span>{shortDate(dates[dates.length - 1])}</span></div>
    </div>
  );
}

function Donut({ parts, unit }: { parts: { label: string; value: number; color: string }[]; unit: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const r = 52, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
      <svg width={140} height={140} viewBox="0 0 140 140" className="-rotate-90 shrink-0" aria-hidden="true">
        <circle cx={70} cy={70} r={r} fill="none" stroke="#f1f5f9" strokeWidth={18} />
        {parts.map((p, i) => { const len = (p.value / total) * c; const el = <circle key={i} cx={70} cy={70} r={r} fill="none" stroke={p.color} strokeWidth={18} strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-off} />; off += len; return el; })}
      </svg>
      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {parts.map((p) => <li key={p.label} className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} /><span className="min-w-0 flex-1 truncate text-slate-700">{p.label}</span><span className="shrink-0 text-xs tabular-nums text-slate-400">{fmt(p.value)} {unit}</span><span className="w-10 shrink-0 text-right font-bold tabular-nums text-slate-900">{Math.round((p.value / total) * 100)}%</span></li>)}
      </ul>
    </div>
  );
}

function HBars({ rows, unit }: { rows: { label: string; value: number; sub?: string; color?: string }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={`${r.label}${i}`}>
          <div className="flex items-baseline justify-between gap-2 text-sm"><span className="min-w-0 truncate font-semibold text-slate-800">{r.label}</span><span className="shrink-0 font-bold tabular-nums text-slate-900">{unit === "$" ? `$${fmt(r.value)}` : `${fmt(r.value)} ${unit}`}</span></div>
          <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${(Math.abs(r.value) / max) * 100}%`, background: r.color ?? "#0f172a" }} /></div>
          {r.sub && <p className="mt-0.5 text-[11px] text-slate-400">{r.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

function Columns({ values, labels, names = labels, unit, color = "#0f172a" }: { values: (number | null)[]; labels: string[]; /** What a picked column is called (the labels may be shortened). */ names?: string[]; unit: string; color?: string }) {
  const [pick, setPick] = useState<number | null>(null);
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  const top = values.reduce<number>((b, v, i) => ((v ?? -1) > (values[b] ?? -1) ? i : b), 0);
  const shown = pick ?? top;
  return (
    <div>
      <Picked text={values[shown] !== null ? `${names[shown]}: ${fmt(values[shown] ?? 0)} ${unit}${pick === null ? " (highest)" : ""}` : ""} />
      <div className="mt-1 flex h-28 items-end gap-1.5">
        {values.map((v, i) => <button key={i} type="button" onClick={() => setPick(pick === i ? null : i)} onMouseEnter={() => setPick(i)} className="flex h-full flex-1 flex-col justify-end"><span className="block rounded-t-md" style={{ height: `${Math.max(3, ((v ?? 0) / max) * 100)}%`, background: v === null ? "#e2e8f0" : color, opacity: i === shown ? 1 : 0.45 }} /></button>)}
      </div>
      <div className="mt-1.5 flex gap-1.5">{labels.map((l, i) => <span key={i} className="flex-1 text-center text-[10px] font-semibold text-slate-400">{l}</span>)}</div>
    </div>
  );
}

function Heat({ values, dates, color = "#0f172a" }: { values: (number | null)[]; dates: string[]; color?: string }) {
  const [pick, setPick] = useState<number | null>(null);
  const nums = values.filter((v): v is number => v !== null);
  const max = Math.max(1, ...nums), min = nums.length ? Math.min(...nums) : 0;
  // Columns are weeks (Monday at the top); the first column is padded to start on a Monday.
  const first = (new Date(`${dates[0]}T12:00:00`).getDay() + 6) % 7;
  const cells = [...Array(first).fill(-1), ...values.map((_, i) => i)];
  const weeks = Math.ceil(cells.length / 7);
  return (
    <div>
      <Picked text={pick !== null && pick >= 0 ? `${shortDate(dates[pick])}: ${values[pick] === null ? "no data" : fmt(values[pick]!)}` : `${nums.length} days with data`} />
      <div className="mt-1 overflow-x-auto"><div className="grid gap-[3px]" style={{ gridTemplateRows: "repeat(7, 12px)", gridAutoFlow: "column", gridAutoColumns: "12px", width: weeks * 15 }}>
        {cells.map((i, k) => i < 0 ? <span key={k} /> : <button key={k} type="button" onClick={() => setPick(i)} onMouseEnter={() => setPick(i)} aria-label={`${dates[i]}: ${values[i] ?? "no data"}`} className="rounded-[3px]" style={{ background: values[i] === null ? "#f1f5f9" : color, opacity: values[i] === null ? 1 : 0.18 + 0.82 * ((values[i]! - min) / Math.max(1e-9, max - min)) }} />)}
      </div></div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-400">Less{[0.2, 0.45, 0.7, 1].map((o) => <span key={o} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color, opacity: o }} />)}More</div>
    </div>
  );
}

function Progress({ rows }: { rows: { label: string; value: number; sub?: string; color?: string }[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={`${r.label}${i}`}>
          <div className="flex items-baseline justify-between gap-2 text-sm"><span className="min-w-0 truncate font-semibold text-slate-800">{r.label}</span><span className="shrink-0 font-bold tabular-nums text-slate-900">{Math.round(r.value * 100)}%</span></div>
          <div className="mt-1 h-2.5 rounded-full bg-slate-100"><div className="h-2.5 rounded-full transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(1, r.value)) * 100}%`, background: r.color ?? "#0f172a" }} /></div>
          {r.sub && <p className="mt-0.5 text-[11px] text-slate-500">{r.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

function ListRows({ rows }: { rows: { label: string; sub?: string; right?: string }[] }) {
  return <ul className="divide-y divide-slate-100">{rows.map((r, i) => <li key={i} className="flex items-center gap-3 py-2.5"><div className="min-w-0 flex-1"><p className="truncate text-[15px] font-semibold text-slate-800">{r.label}</p>{r.sub && <p className="truncate text-xs text-slate-500">{r.sub}</p>}</div>{r.right && <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-600">{r.right}</span>}</li>)}</ul>;
}

export function ChartView({ chart }: { chart: Chart }) {
  const body = (() => {
    switch (chart.kind) {
      case "bars": return <BarsChart values={chart.values} dates={chart.dates} unit={chart.unit} goal={chart.goal} color={chart.color} />;
      case "line": return <BarsChart values={chart.values} dates={chart.dates} unit={chart.unit} goal={chart.goal} color={chart.color} line />;
      case "donut": return <Donut parts={chart.parts} unit={chart.unit} />;
      case "hbars": return <HBars rows={chart.rows} unit={chart.unit} />;
      case "weekday": return <Columns values={chart.values} labels={WD} unit={chart.unit} color={chart.color} />;
      case "hours": return <Columns values={chart.values} labels={chart.values.map((_, i) => (i % 6 === 0 ? `${((i + 11) % 12) + 1}${i < 12 ? "a" : "p"}` : ""))} names={chart.values.map((_, i) => `${((i + 11) % 12) + 1} ${i < 12 ? "AM" : "PM"}`)} unit={chart.unit} color={chart.color} />;
      case "heat": return <Heat values={chart.values} dates={chart.dates} color={chart.color} />;
      case "progress": return <Progress rows={chart.rows} />;
      case "list": return <ListRows rows={chart.rows} />;
    }
  })();
  return <Card><Eyebrow>{chart.title}</Eyebrow><div className="mt-2">{body}</div></Card>;
}

// ——— Stats: the sections ——————————————————————————————————————————————————————————————————————————————————————
export function StatsHome({ sections, open, insights }: { sections: StatSection[]; open: (id: string) => void; insights: string[] }) {
  const total = sections.reduce((a, s) => a + s.stats.length + s.charts.length, 0);
  return (
    <div className="space-y-4">
      <div className="px-1"><Eyebrow>Everything you track</Eyebrow><h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.02em] text-slate-900">Stats</h1><p className="text-sm text-slate-500">{total} numbers and charts across {sections.length} parts of your life. Tap any bar or day to see it.</p></div>
      {insights.length > 0 && (
        <Card>
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" /><Eyebrow>What your data says</Eyebrow></div>
          <ul className="mt-2 space-y-2">{insights.slice(0, 5).map((t, i) => <li key={i} className="flex gap-2.5 text-[15px] leading-6 text-slate-700"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />{t}</li>)}</ul>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sections.map((s) => {
          const Icon = ICONS[s.icon] ?? Sparkles;
          return (
            <Card key={s.id} onClick={() => open(s.id)}>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ background: `${s.color}1a`, color: s.color }}><Icon className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1"><p className="text-[16px] font-bold text-slate-900">{s.name}</p><p className="truncate text-xs text-slate-500">{s.blurb}</p></div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
              </div>
              {s.stats.length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {s.stats.slice(0, 4).map((st) => <div key={st.label} className="min-w-0 rounded-xl bg-slate-50 px-2.5 py-2"><p className="truncate text-[15px] font-bold tabular-nums text-slate-900">{st.value}</p><p className="truncate text-[11px] text-slate-500">{st.label}</p></div>)}
                </div>
              ) : <p className="mt-3 text-xs leading-5 text-slate-400">{s.empty}</p>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function SectionPage({ section, back }: { section: StatSection; back: () => void }) {
  const Icon = ICONS[section.icon] ?? Sparkles;
  return (
    <div className="space-y-4">
      <Back onClick={back} label="Stats" />
      <div className="flex items-center gap-3 px-1">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: `${section.color}1a`, color: section.color }}><Icon className="h-6 w-6" /></span>
        <div className="min-w-0"><h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-slate-900">{section.name}</h1><p className="text-sm text-slate-500">{section.blurb}</p></div>
      </div>
      {section.stats.length === 0 && section.empty && <Card><p className="text-sm leading-6 text-slate-600">{section.empty}</p></Card>}
      {section.stats.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {section.stats.map((st) => (
            <div key={st.label} className="min-w-0 rounded-[18px] border border-slate-200/70 bg-white p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">{st.label}</p>
              <p className="mt-1 text-[22px] font-extrabold leading-tight tracking-[-0.02em] tabular-nums text-slate-900">{st.value}</p>
              {st.sub && <p className="mt-0.5 text-xs leading-4 text-slate-500">{st.sub}</p>}
            </div>
          ))}
        </div>
      )}
      {section.insights.length > 0 && <Card><Eyebrow>Insights</Eyebrow><ul className="mt-2 space-y-2">{section.insights.map((t, i) => <li key={i} className="text-[15px] leading-6 text-slate-700">{t}</li>)}</ul></Card>}
      {section.charts.map((c, i) => <ChartView key={`${c.title}${i}`} chart={c} />)}
    </div>
  );
}

// ——— Explore: any two numbers ———————————————————————————————————————————————————————————————————————————————
export function Explorer({ series, today, lastDays }: { series: Series[]; today: string; lastDays: (t: string, n: number) => string[] }) {
  const groups = useMemo(() => [...new Set(series.map((s) => s.group))], [series]);
  const pickDefault = (ids: string[], not?: string) => ids.find((id) => id !== not && series.some((s) => s.id === id)) ?? series.find((s) => s.id !== not)?.id ?? "";
  const [a, setA] = useState(() => pickDefault(["sleep", "steps", "tasksdone"]));
  const [b, setB] = useState(() => pickDefault(["happy", "mood", "energy", "tasksdone"], a));
  const [lag, setLag] = useState(0);
  const [range, setRange] = useState(90);
  const A = series.find((s) => s.id === a), B = series.find((s) => s.id === b);
  if (series.length < 1) return <Card><p className="text-sm text-slate-600">Once you've tracked a few days (check-ins, Apple Health, mood, food, to-dos), you can compare any two of them here.</p></Card>;
  const dates = lastDays(today, range);
  const select = (val: string, set: (v: string) => void, label: string) => (
    <label className="block min-w-0 flex-1 text-xs font-semibold text-slate-500">{label}
      <select value={val} onChange={(e) => set(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900">
        {groups.map((g) => <optgroup key={g} label={g}>{series.filter((s) => s.group === g).map((s) => <option key={s.id} value={s.id}>{s.name} ({Object.keys(s.values).length} days)</option>)}</optgroup>)}
      </select>
    </label>
  );
  const cor = A && B ? correlate(A, B, lag) : null;
  const statsOf = (s: Series) => { const v = dates.map((d) => s.values[d]).filter((x): x is number => x !== undefined); return v.length ? { avg: v.reduce((x, y) => x + y, 0) / v.length, min: Math.min(...v), max: Math.max(...v), total: v.reduce((x, y) => x + y, 0), n: v.length } : null; };
  const norm = (s: Series) => { const v = dates.map((d) => s.values[d] ?? null); const nums = v.filter((x): x is number => x !== null); const lo = Math.min(...nums), hi = Math.max(...nums); return v.map((x) => (x === null ? null : hi > lo ? ((x - lo) / (hi - lo)) * 100 : 50)); };
  const wd = (s: Series) => { const bk: number[][] = [[], [], [], [], [], [], []]; for (const d of dates) if (d in s.values) bk[(new Date(`${d}T12:00:00`).getDay() + 6) % 7].push(s.values[d]); return bk.map((x) => (x.length ? Math.round((x.reduce((p, q) => p + q, 0) / x.length) * 10) / 10 : null)); };
  return (
    <div className="space-y-4">
      <div className="px-1"><Eyebrow>Explore</Eyebrow><h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.02em] text-slate-900">Compare anything</h1><p className="text-sm text-slate-500">{series.length} things you track, day by day. Pick two and see how they move together.</p></div>
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row">{select(a, setA, "This")}{select(b, setB, "With")}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[[0, "Same day"], [1, "Next day"]].map(([v, l]) => <button key={v} type="button" onClick={() => setLag(v as number)} className={`min-h-9 rounded-full px-3.5 text-[13px] font-semibold ${lag === v ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600"}`}>{l}</button>)}
          <span className="mx-1 self-center text-slate-300">|</span>
          {[30, 90, 182, 365].map((r) => <button key={r} type="button" onClick={() => setRange(r)} className={`min-h-9 rounded-full px-3.5 text-[13px] font-semibold ${range === r ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600"}`}>{r === 182 ? "6 mo" : r === 365 ? "1 yr" : `${r} d`}</button>)}
        </div>
      </Card>
      {A && B && cor && (
        <Card>
          <Eyebrow>How they move together</Eyebrow>
          <p className="mt-2 text-[17px] font-bold leading-7 text-slate-900">{cor.words}</p>
          {cor.r !== null && <div className="mt-3"><div className="relative h-2 rounded-full bg-gradient-to-r from-rose-300 via-slate-200 to-emerald-300"><span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow" style={{ left: `${((cor.r + 1) / 2) * 100}%` }} /></div><div className="mt-1 flex justify-between text-[10px] font-semibold text-slate-400"><span>Opposite</span><span>No link</span><span>Together</span></div></div>}
          {cor.points.length >= 3 && (
            <svg viewBox="0 0 100 70" className="mt-4 w-full rounded-xl bg-slate-50" aria-label="Scatter plot">
              {(() => { const xs = cor.points.map((p) => p[0]), ys = cor.points.map((p) => p[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); return cor.points.map(([px, py], i) => <circle key={i} cx={6 + (x1 > x0 ? ((px - x0) / (x1 - x0)) * 88 : 44)} cy={64 - (y1 > y0 ? ((py - y0) / (y1 - y0)) * 58 : 29)} r={1.3} fill="#0f172a" fillOpacity={0.55} />); })()}
              <text x="98" y="68" fontSize="3" textAnchor="end" fill="#94a3b8">{A.name} →</text>
              <text x="2" y="5" fontSize="3" fill="#94a3b8">↑ {B.name}</text>
            </svg>
          )}
          <p className="mt-3 text-xs text-slate-400">Things that move together don't always cause each other, but your own pattern is worth trying to change.</p>
        </Card>
      )}
      {A && B && (
        <Card>
          <Eyebrow>Side by side (each scaled to its own range)</Eyebrow>
          <svg viewBox={`0 0 ${dates.length - 1} 100`} preserveAspectRatio="none" className="mt-3 h-36 w-full overflow-visible">
            {[[norm(A), "#0f172a"], [norm(B), "#ff5a5f"]].map(([vals, col], k) => <path key={k} d={(vals as (number | null)[]).map((v, i, all) => (v === null ? "" : `${i === 0 || all[i - 1] === null ? "M" : "L"}${i},${100 - v}`)).join(" ")} fill="none" stroke={col as string} strokeWidth={2} vectorEffect="non-scaling-stroke" />)}
          </svg>
          <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold"><span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-slate-900" />{A.name}</span><span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-[#ff5a5f]" />{B.name}</span></div>
        </Card>
      )}
      {[A, B].filter((s): s is Series => !!s).map((s, k) => {
        const st = statsOf(s);
        return (
          <div key={`${s.id}${k}`} className="space-y-4">
            <Card>
              <Eyebrow>{s.name}</Eyebrow>
              {st ? <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Average", st.avg], ["Lowest", st.min], ["Highest", st.max], [["min", "steps", "kcal", "$", "to-dos", "items", "words", "drinks", "servings", "floors", "g", "oz"].includes(s.unit) ? "Total" : "Days", ["min", "steps", "kcal", "$", "to-dos", "items", "words", "drinks", "servings", "floors", "g", "oz"].includes(s.unit) ? st.total : st.n]].map(([l, v]) => <div key={l as string} className="rounded-xl bg-slate-50 px-2.5 py-2"><p className="text-[15px] font-bold tabular-nums text-slate-900">{fmt(v as number)}</p><p className="text-[11px] text-slate-500">{l} {l !== "Days" && s.unit !== "$" ? s.unit : ""}</p></div>)}</div> : <p className="mt-2 text-sm text-slate-500">Nothing in this range.</p>}
            </Card>
            <ChartView chart={{ kind: "weekday", title: `${s.name} by day of the week`, values: wd(s), unit: s.unit, color: k ? "#ff5a5f" : "#0f172a" }} />
            <ChartView chart={{ kind: "heat", title: `${s.name}, 26 weeks`, values: lastDays(today, 182).map((d) => s.values[d] ?? null), dates: lastDays(today, 182), color: k ? "#ff5a5f" : "#0f172a" }} />
          </div>
        );
      })}
    </div>
  );
}

// ——— Records and insights ————————————————————————————————————————————————————————————————————————————————————
export function Records({ records, insights, patterns }: { records: { label: string; value: string; when: string }[]; insights: string[]; patterns: string[] }) {
  return (
    <div className="space-y-4">
      <div className="px-1"><Eyebrow>Your bests</Eyebrow><h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.02em] text-slate-900">Records & insights</h1></div>
      <Card>
        <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /><Eyebrow>Personal records</Eyebrow></div>
        {records.length ? <ul className="mt-2 divide-y divide-slate-100">{records.map((r, i) => <li key={i} className="flex items-center gap-3 py-2.5"><div className="min-w-0 flex-1"><p className="text-[15px] font-semibold text-slate-800">{r.label}</p>{r.when && <p className="text-xs text-slate-500">{r.when}</p>}</div><span className="shrink-0 text-[15px] font-extrabold tabular-nums text-slate-900">{r.value}</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">Records show up as you track.</p>}
      </Card>
      <Card>
        <div className="flex items-center gap-2"><Heart className="h-4 w-4 text-rose-500" /><Eyebrow>Every insight</Eyebrow></div>
        {[...patterns, ...insights].length ? <ul className="mt-2 space-y-2.5">{[...patterns, ...insights].map((t, i) => <li key={i} className="flex gap-2.5 text-[15px] leading-6 text-slate-700"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />{t}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">After a couple of weeks of tracking, this fills with what your data shows.</p>}
      </Card>
    </div>
  );
}
