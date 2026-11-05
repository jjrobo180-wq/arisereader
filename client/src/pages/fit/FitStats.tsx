// "Overall statistics": six graphs of your training over 1 month to all time (duration, volume, sets,
// reps, reps per set, workouts a week). Each shows the real line, a smooth trend line, and the period
// you're in now as an open dot on a dashed line (it isn't finished yet). Drawn in the layout's own
// accent, type and card style, so it matches every theme. Numbers: shared/fitInsights.ts statBuckets.
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { FitData } from "@shared/fit";
import { slope, statBuckets, statMetrics, type StatMetric, type StatRange } from "@shared/fitInsights";
import { C, cardStyle, haptic, numFont } from "./fitUi";

const RANGES: StatRange[] = ["1M", "3M", "6M", "1Y", "All"];
const KEY = "arise-fit-stat-range";
const short = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n * 10) / 10));

function Graph({ m, partialLast }: { m: StatMetric; partialLast: boolean }) {
  const W = 160, H = 74, padR = 26;
  const ys = m.values;
  const hi = Math.max(1, ...ys), lo = Math.min(0, ...ys);
  const x = (n: number) => (ys.length < 2 ? (W - padR) / 2 : (n / (ys.length - 1)) * (W - padR));
  const y = (v: number) => 6 + (1 - (v - lo) / (hi - lo || 1)) * (H - 12);
  const full = partialLast ? ys.slice(0, -1) : ys;
  const line = full.map((v, n) => `${n ? "L" : "M"}${x(n).toFixed(1)},${y(v).toFixed(1)}`).join("");
  // Trend: a straight best-fit line over the finished periods.
  const k = slope(full), mean = full.length ? full.reduce((a, b) => a + b, 0) / full.length : 0, mid = (full.length - 1) / 2;
  const t0 = mean - k * mid, t1 = mean + k * (full.length - 1 - mid);
  const id = `g-${m.id}`;
  return <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" aria-hidden>
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--fit-accent)" stopOpacity=".22" /><stop offset="1" stopColor="var(--fit-accent)" stopOpacity="0" /></linearGradient></defs>
    {[0, 0.5, 1].map((f) => <line key={f} x1="0" x2={W - padR + 4} y1={6 + f * (H - 12)} y2={6 + f * (H - 12)} stroke="currentColor" strokeOpacity=".12" strokeWidth="1" />)}
    <text x={W - padR + 7} y="9" fontSize="8.5" fill="currentColor" fillOpacity=".55" style={{ fontFamily: "var(--fit-num)" }}>{short(hi)}</text>
    <text x={W - padR + 7} y={H - 3} fontSize="8.5" fill="currentColor" fillOpacity=".55" style={{ fontFamily: "var(--fit-num)" }}>{short(lo)}</text>
    {full.length > 1 && <path d={`${line}L${x(full.length - 1)},${H - 6}L0,${H - 6}Z`} fill={`url(#${id})`} />}
    {full.length > 1 && <line x1={x(0)} y1={y(t0)} x2={x(full.length - 1)} y2={y(t1)} stroke="var(--fit-accent)" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" />}
    {full.length > 1 && <path d={line} fill="none" stroke="var(--fit-accent)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />}
    {full.map((v, n) => <circle key={n} cx={x(n)} cy={y(v)} r="2.3" fill="var(--fit-accent)" />)}
    {partialLast && ys.length > 1 && <>
      <line x1={x(ys.length - 2)} y1={y(ys[ys.length - 2])} x2={x(ys.length - 1)} y2={y(ys[ys.length - 1])} stroke="var(--fit-accent)" strokeWidth="1.6" strokeDasharray="3 3" />
      <circle cx={x(ys.length - 1)} cy={y(ys[ys.length - 1])} r="3.6" fill="var(--fit-card, #fff)" style={{ fill: C.card }} stroke="var(--fit-accent)" strokeWidth="2" />
    </>}
  </svg>;
}

export function OverallStats({ data, title = "Overall statistics" }: { data: FitData; title?: string }) {
  const [range, setRangeRaw] = useState<StatRange>(() => { try { const r = localStorage.getItem(KEY) as StatRange | null; return r && RANGES.includes(r) ? r : "3M"; } catch { return "3M"; } });
  const setRange = (r: StatRange) => { setRangeRaw(r); haptic("light"); try { localStorage.setItem(KEY, r); } catch { /* fine */ } };
  const buckets = useMemo(() => statBuckets(data.workouts, range), [data.workouts, range]);
  const metrics = useMemo(() => statMetrics(buckets, data.profile.units), [buckets, data.profile.units]);
  const from = buckets[0] ? new Date(`${buckets[0].start}T12:00:00`) : new Date();
  const fromText = from.toLocaleDateString(undefined, { month: "short", day: "numeric", year: from.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
  const partial = !!buckets[buckets.length - 1]?.partial;
  return <section className="fit-in mt-5 rounded-[18px] p-3" style={{ ...cardStyle, background: C.card2 }} data-testid="fit-overall-stats">
    <div className="flex items-baseline justify-between gap-2 px-1"><h2 className="text-[17px] font-semibold" style={{ color: C.dim }}>{title}</h2><p className="truncate text-[13px] tabular-nums" style={{ color: C.dim }}>{fromText} – Today</p></div>
    <div className="mt-2.5 grid grid-cols-5 gap-1 rounded-full p-1" style={{ background: C.track }} role="tablist" aria-label="Time range">
      {RANGES.map((r) => <button key={r} type="button" role="tab" aria-selected={range === r} onClick={() => setRange(r)} className="h-9 rounded-full text-[14px] font-semibold transition-colors" style={range === r ? { background: C.card, color: C.text, boxShadow: "0 1px 4px rgba(0,0,0,.12)" } : { color: C.text, opacity: 0.75 }}>{r}</button>)}
    </div>
    <div className="mt-2.5 grid grid-cols-2 gap-2.5">
      {metrics.map((m) => { const Icon = m.trend === "up" ? ArrowUpRight : m.trend === "down" ? ArrowDownRight : ArrowRight;
        return <div key={m.id} className="min-w-0 rounded-[14px] p-3" style={{ background: C.card, color: C.text }} data-testid={`fit-stat-${m.id}`}>
          <p className="truncate text-[13.5px]">{m.title}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[17px] font-bold leading-tight tabular-nums" style={numFont}><Icon className="h-[18px] w-[18px] shrink-0" style={{ color: m.trend === "down" ? C.dim : C.lime }} />{m.headline}</p>
          <div className="mt-2"><Graph m={m} partialLast={partial} /></div>
          <div className="mt-1 flex justify-between text-[10.5px]" style={{ color: C.dim }}><span>{fromText}</span><span>Today</span></div>
        </div>; })}
    </div>
    {!buckets.some((b) => b.workouts) && <p className="mt-3 px-1 text-[13px]" style={{ color: C.dim }}>Finish a workout and your graphs start here.</p>}
  </section>;
}
