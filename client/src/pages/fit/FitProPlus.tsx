// The Pro+ layout (Fit+): every number Arise Fit knows, on Home, then a Deep analysis screen with the
// charts, what the numbers mean (shared/fitInsights.ts findings) and where they're heading. The numbers
// all come from shared/fitInsights.ts computeInsights, the same ones Ask Fit is given.
import { useState, type ReactNode } from "react";
import { BarChart3, ChevronRight, Sparkles } from "lucide-react";
import { fromKg } from "@shared/fit";
import { findings, type Insights } from "@shared/fitInsights";
import { OverallStats } from "./FitStats";
import type { FitData } from "@shared/fit";
import { C, Sheet, cardStyle, display, fmtNum, haptic } from "./fitUi";

type Open = (id: "recovery" | "sleep" | "water" | "food" | "fast" | "train") => void;
const mono = { fontFamily: "var(--fit-num)" } as const;
const MI = 1.609344;
const dist = (km: number, i: Insights) => (i.units === "lb" ? `${(km / MI).toFixed(1)} mi` : `${km.toFixed(1)} km`);
const pace = (secPerKm: number | null, i: Insights) => { if (!secPerKm) return "—"; const s = i.units === "lb" ? secPerKm * MI : secPerKm; return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}/${i.units === "lb" ? "mi" : "km"}`; };
const wt = (kg: number | null, i: Insights, sign = false) => (kg == null ? "—" : `${sign && kg > 0 ? "+" : ""}${(Math.round(fromKg(kg, i.units) * 10) / 10).toString()} ${i.units}`);
const signed = (n: number | null, unit: string) => (n == null ? "—" : `${n > 0 ? "+" : ""}${n} ${unit}`);
const day = (k: string | null) => (k ? new Date(k.length > 10 ? k : `${k}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—");
const hm = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;

/** A tiny line of the last few values. */
function Mini({ ys, color = C.lime, h = 22 }: { ys: number[]; color?: string; h?: number }) {
  const pts = ys.filter((y) => Number.isFinite(y));
  if (pts.length < 2) return null;
  const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1, w = 100;
  const d = pts.map((y, n) => `${n ? "L" : "M"}${((n / (pts.length - 1)) * w).toFixed(1)},${(h - 2 - ((y - lo) / span) * (h - 4)).toFixed(1)}`).join("");
  return <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-1 block h-[18px] w-full" aria-hidden><path d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" /></svg>;
}

/** Bars, one per value, with a label under the last and first. */
function Bars({ ys, labels, goal, color = C.lime, h = 96, fmt = (n: number) => fmtNum(n) }: { ys: number[]; labels?: string[]; goal?: number; color?: string; h?: number; fmt?: (n: number) => string }) {
  const hi = Math.max(1, goal ?? 0, ...ys);
  return <div>
    <div className="relative flex items-end gap-[3px]" style={{ height: h }}>
      {goal != null && goal > 0 && <span aria-hidden className="absolute inset-x-0 border-t border-dashed" style={{ bottom: `${(goal / hi) * 100}%`, borderColor: C.dim, opacity: 0.6 }} />}
      {ys.map((y, n) => <span key={n} className="flex-1 rounded-t-[2px]" title={`${labels?.[n] ?? ""} ${fmt(y)}`} style={{ height: `${Math.max(2, (y / hi) * 100)}%`, background: color, opacity: n === ys.length - 1 ? 1 : 0.55 }} />)}
    </div>
    {labels && <div className="mt-1 flex justify-between text-[10px]" style={{ ...mono, color: C.dim }}><span>{labels[0]}</span><span>{labels[labels.length - 1]}</span></div>}
  </div>;
}

function Tile({ k, v, sub, ys, onClick }: { k: string; v: ReactNode; sub?: ReactNode; ys?: number[]; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return <Tag type={onClick ? "button" : undefined} onClick={onClick ? () => { haptic("light"); onClick(); } : undefined} className="flex min-w-0 flex-col gap-0.5 p-2.5 text-left" style={{ background: C.card }}>
    <span className="truncate text-[9.5px] font-semibold uppercase tracking-[.12em]" style={{ ...mono, color: C.dim }}>{k}</span>
    <span className="truncate text-[18px] font-bold leading-tight tabular-nums" style={mono}>{v}</span>
    {sub != null && <span className="truncate text-[10.5px]" style={{ color: C.dim }}>{sub}</span>}
    {ys && <Mini ys={ys} />}
  </Tag>;
}
function Grid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return <div className={`grid ${cols === 4 ? "grid-cols-4" : cols === 2 ? "grid-cols-2" : "grid-cols-3"} gap-px overflow-hidden rounded-[8px]`} style={{ background: C.line, boxShadow: `0 0 0 1px ${C.line}` }}>{children}</div>;
}
function Sect({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return <section className="fit-in mt-4">
    <div className="mb-1.5 flex items-baseline justify-between px-0.5"><h2 className="text-[11px] font-bold uppercase tracking-[.16em]" style={{ ...mono, color: C.lime }}>{title}</h2>{right && <span className="text-[11px]" style={{ ...mono, color: C.dim }}>{right}</span>}</div>
    {children}
  </section>;
}

/** 12 weeks of training days, a square per day (darker = more). */
function Heat({ heat }: { heat: number[] }) {
  const cols: number[][] = []; for (let n = 0; n < heat.length; n += 7) cols.push(heat.slice(n, n + 7));
  return <div className="flex gap-[3px] rounded-[8px] p-2.5" style={{ background: C.card, boxShadow: `0 0 0 1px ${C.line}` }} aria-label="Training days, last 12 weeks">
    {cols.map((c, x) => <div key={x} className="flex flex-1 flex-col gap-[3px]">{c.map((v, y) => <span key={y} className="aspect-square w-full rounded-[2px]" style={{ background: v ? C.lime : C.track, opacity: v ? Math.min(1, 0.55 + v * 0.25) : 1 }} />)}</div>)}
  </div>;
}

/** Home in Pro+: every stat, grouped, then a way into Deep analysis and Ask Fit. */
export function ProPlusBoard({ i, open, onAnalysis, onAsk }: { i: Insights; open: Open; onAnalysis: () => void; onAsk: () => void }) {
  const t = i.train, s = i.strength, b = i.body, f = i.food, u = i.units;
  const say = findings(i);
  return <div data-testid="fit-proplus">
    <div className="fit-in mt-3 grid grid-cols-2 gap-2">
      <button type="button" onClick={() => { haptic("light"); onAnalysis(); }} className="flex items-center gap-2 rounded-[8px] p-3 text-left" style={{ background: C.lime, color: C.ink }} data-testid="fit-proplus-analysis"><BarChart3 className="h-5 w-5 shrink-0" /><span className="text-[14px] font-bold">Deep analysis</span></button>
      <button type="button" onClick={() => { haptic("light"); onAsk(); }} className="flex items-center gap-2 rounded-[8px] p-3 text-left" style={cardStyle} data-testid="fit-proplus-ask"><Sparkles className="h-5 w-5 shrink-0" style={{ color: C.lime }} /><span className="text-[14px] font-bold">Ask Fit</span></button>
    </div>
    {say.length > 0 && <button type="button" onClick={onAnalysis} className="fit-in mt-2 flex w-full items-start gap-2 rounded-[8px] p-3 text-left text-[13.5px] leading-snug" style={cardStyle}><Sparkles className="mt-0.5 h-4 w-4 shrink-0" style={{ color: C.lime }} /><span className="min-w-0 flex-1">{say[0]}</span><ChevronRight className="h-4 w-4 shrink-0" style={{ color: C.dim }} /></button>}

    <Sect title="Training" right={`${t.consistency}% consistent`}>
      <Grid cols={4}>
        <Tile k="This wk" v={t.week} sub={`${i.forecast.sessionsThisWeekLeft} to go`} onClick={() => open("train")} />
        <Tile k="Streak" v={`${t.streak}d`} sub={`best ${t.longestStreak}d`} />
        <Tile k="Rest" v={t.restDays == null ? "—" : `${t.restDays}d`} sub={`last ${day(t.lastDate)}`} />
        <Tile k="Per wk" v={t.perWeek} sub="8-wk avg" />
        <Tile k="30 days" v={t.last30} sub="workouts" />
        <Tile k="This yr" v={t.year} sub="workouts" />
        <Tile k="All time" v={t.total} sub={`${t.totalHours} h`} />
        <Tile k="Avg time" v={`${t.avgMins}m`} sub={`max ${t.longestMins}m`} />
        <Tile k="Fav day" v={t.favDay ? t.favDay.slice(0, 3) : "—"} sub="most trained" />
        <Tile k="Yoga etc" v={t.sessionsTotal} sub={`${t.sessionMins} min`} />
        <Tile k="Sets/wo" v={t.avgSets} sub={`${fmtNum(t.totalSets)} total`} />
        <Tile k="Reps" v={fmtNum(t.totalReps)} sub="all time" />
      </Grid>
      <div className="mt-px"><Heat heat={t.heat} /></div>
    </Sect>

    <Sect title="Volume" right={u}>
      <Grid>
        <Tile k="All time" v={fmtNum(t.volume)} sub={u} />
        <Tile k="30 days" v={fmtNum(t.volume30)} sub={u} ys={t.weeks.map((w) => w.volume)} />
        <Tile k="Per workout" v={fmtNum(t.avgVolume)} sub={`best ${fmtNum(t.bestVolume)}`} />
      </Grid>
    </Sect>

    <Sect title="Strength" right={`${s.prs30} PRs · 30d`}>
      {s.lifts.length ? <Grid cols={2}>{s.lifts.slice(0, 6).map((l) => <Tile key={l.exId} k={l.name} v={`${l.e1rm} ${u}`} sub={`${l.weight}×${l.reps}${l.change != null ? ` · ${l.change >= 0 ? "+" : ""}${l.change}% 8wk` : ""}`} ys={l.series} />)}</Grid>
        : <p className="text-[13px]" style={{ color: C.dim }}>Log a workout to see your lifts here.</p>}
      <div className="mt-px"><Grid>
        <Tile k="PRs ever" v={s.prsTotal} />
        <Tile k="Exercises" v={s.exercisesTried} sub="tried" />
        <Tile k="Heaviest" v={s.heaviest ? `${s.heaviest.weight}` : "—"} sub={s.heaviest ? `${s.heaviest.name} ×${s.heaviest.reps}` : undefined} />
      </Grid></div>
    </Sect>

    {i.muscles.length > 0 && <Sect title="Muscles" right="sets · 30d">
      <div className="space-y-1.5 rounded-[8px] p-3" style={{ background: C.card, boxShadow: `0 0 0 1px ${C.line}` }}>
        {i.muscles.slice(0, 10).map((m) => <div key={m.muscle} className="flex items-center gap-2 text-[12px]"><span className="w-[74px] shrink-0 truncate capitalize">{m.muscle}</span>
          <span className="h-[6px] flex-1 overflow-hidden rounded-full" style={{ background: C.track }}><span className="block h-full" style={{ width: `${Math.max(3, m.pct)}%`, background: C.lime }} /></span>
          <span className="w-[54px] shrink-0 text-right tabular-nums" style={{ ...mono, color: C.dim }}>{m.sets30} · {m.sets7}</span></div>)}
      </div>
    </Sect>}

    <Sect title="Body" right={b.entries ? `${b.entries} weigh-ins` : undefined}>
      <Grid cols={4}>
        <Tile k="Weight" v={b.kg == null ? "—" : `${Math.round(fromKg(b.kg, u) * 10) / 10}`} sub={u} ys={b.series} />
        <Tile k="7 days" v={signed(b.change7, "")} sub={u} />
        <Tile k="30 days" v={signed(b.change30, "")} sub={u} />
        <Tile k="90 days" v={signed(b.change90, "")} sub={u} />
        <Tile k="To goal" v={b.toGoalKg == null ? "—" : wt(b.toGoalKg, i, true)} sub={b.goalKg != null ? `goal ${wt(b.goalKg, i)}` : "no goal"} />
        <Tile k="Trend" v={b.weeklyKg == null ? "—" : wt(b.weeklyKg, i, true)} sub="per week" />
        <Tile k="BMI" v={b.bmi ?? "—"} />
        <Tile k="Goal by" v={i.forecast.goalDate ? day(i.forecast.goalDate) : "—"} sub="at this pace" />
      </Grid>
    </Sect>

    <Sect title="Nutrition" right={`${f.loggingStreak}d logging streak`}>
      <Grid cols={4}>
        <Tile k="Today" v={fmtNum(f.today.kcal)} sub={`of ${fmtNum(f.goal.kcal)}`} onClick={() => open("food")} />
        <Tile k="7d avg" v={fmtNum(f.avg7.kcal)} sub="cal" ys={f.kcalSeries} />
        <Tile k="Protein" v={`${f.avg7.p}g`} sub={`goal ${f.goal.p}g`} />
        <Tile k="Burn" v={fmtNum(f.goal.tdee)} sub="cal / day" />
        <Tile k="Carbs" v={`${f.avg7.c}g`} sub={`goal ${f.goal.c}g`} />
        <Tile k="Fat" v={`${f.avg7.f}g`} sub={`goal ${f.goal.f}g`} />
        <Tile k="Logged" v={`${f.daysLogged7}/7`} sub={`${f.onTarget7} on target`} />
        <Tile k="Best P" v={`${f.bestProteinDay}g`} sub="in a day" />
      </Grid>
    </Sect>

    <Sect title="Recovery">
      <Grid cols={4}>
        <Tile k="Ready" v={i.readiness.score} sub={i.readiness.word} onClick={() => open("recovery")} />
        <Tile k="Sleep 7d" v={i.sleep.avg7 ? hm(i.sleep.avg7) : "—"} sub={`goal ${i.sleep.goal}h`} ys={i.sleep.series} onClick={() => open("sleep")} />
        <Tile k="Sleep 30d" v={i.sleep.avg30 ? hm(i.sleep.avg30) : "—"} sub={`${i.sleep.hit7}/7 on goal`} />
        <Tile k="Debt" v={`${i.sleep.debt7}h`} sub="this week" />
        <Tile k="Water" v={`${Math.round((i.water.todayMl / Math.max(1, i.water.goalMl)) * 100)}%`} sub="of goal today" ys={i.water.series} onClick={() => open("water")} />
        <Tile k="Water 7d" v={`${i.water.daysHit7}/7`} sub="days on goal" />
        <Tile k="Fasts" v={i.fasting.count} sub={i.fasting.count ? `avg ${i.fasting.avgH}h` : "none yet"} onClick={() => open("fast")} />
        <Tile k="Longest" v={i.fasting.longestH ? `${i.fasting.longestH}h` : "—"} sub="fast" />
      </Grid>
    </Sect>

    {i.cardio.runs > 0 && <Sect title="Cardio" right={`${i.cardio.runs} outings`}>
      <Grid cols={4}>
        <Tile k="Total" v={dist(i.cardio.km, i)} sub={`${i.cardio.hours} h`} ys={i.cardio.kmSeries} />
        <Tile k="This wk" v={dist(i.cardio.weekKm, i)} />
        <Tile k="30 days" v={dist(i.cardio.monthKm, i)} />
        <Tile k="Pace" v={pace(i.cardio.paceSecPerKm, i)} sub="runs avg" />
        <Tile k="Longest" v={dist(i.cardio.longestKm, i)} />
        <Tile k="Climb" v={`${i.units === "lb" ? fmtNum(i.cardio.climbM * 3.281) + " ft" : fmtNum(i.cardio.climbM) + " m"}`} />
        <Tile k="Runs" v={i.cardio.byKind.run ?? 0} />
        <Tile k="Walk/hike" v={(i.cardio.byKind.walk ?? 0) + (i.cardio.byKind.hike ?? 0)} />
      </Grid>
    </Sect>}

    {(i.program || i.forecast.liftsIn4w.length > 0 || i.forecast.weightIn4w != null) && <Sect title="Forecast" right="trend, not a promise">
      <Grid cols={2}>
        {i.program && <Tile k={i.program.name} v={`${i.program.pct}%`} sub={`${i.program.done}/${i.program.total} days · wk ${i.program.weeksIn}`} />}
        {i.forecast.weightIn4w != null && <Tile k="Weight in 4 wk" v={`${i.forecast.weightIn4w} ${u}`} sub={i.forecast.onPace == null ? undefined : i.forecast.onPace ? "heading to goal" : "away from goal"} />}
        {i.forecast.liftsIn4w.map((l) => <Tile key={l.name} k={`${l.name} in 4 wk`} v={`${l.then} ${u}`} sub={`now ${l.now}`} />)}
      </Grid>
    </Sect>}
  </div>;
}

type Tab = "training" | "strength" | "body" | "food" | "recovery" | "forecast";
const TABS: [Tab, string][] = [["training", "Training"], ["strength", "Strength"], ["body", "Body"], ["food", "Food"], ["recovery", "Recovery"], ["forecast", "Ahead"]];
const Box = ({ title, children }: { title: string; children: ReactNode }) => <div className="mt-3 rounded-[10px] p-3.5" style={cardStyle}><p className="mb-2 text-[11px] font-bold uppercase tracking-[.14em]" style={{ ...mono, color: C.dim }}>{title}</p>{children}</div>;
const Row = ({ k, v }: { k: string; v: ReactNode }) => <div className="flex items-baseline justify-between gap-3 py-1.5 text-[14px]" style={{ borderBottom: `1px solid ${C.line}` }}><span style={{ color: C.dim }}>{k}</span><span className="text-right font-semibold tabular-nums" style={mono}>{v}</span></div>;

/** Deep analysis: the charts behind the numbers, and what they mean. */
export function ProPlusAnalysis({ i, data, onClose, onAsk }: { i: Insights; data: FitData; onClose: () => void; onAsk: () => void }) {
  const [tab, setTab] = useState<Tab>("training");
  const t = i.train, u = i.units, labels = t.weeks.map((w) => w.label);
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return <Sheet title="Deep analysis" onClose={onClose} testId="fit-proplus-sheet">
    <div className="space-y-2 rounded-[10px] p-3.5" style={cardStyle}>
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em]" style={{ ...mono, color: C.lime }}><Sparkles className="h-4 w-4" /> What your numbers say</p>
      {findings(i).map((line) => <p key={line} className="text-[14.5px] leading-snug">{line}</p>)}
      <button type="button" onClick={onAsk} className="mt-1 text-[14px] font-semibold" style={{ color: C.lime }}>Ask Fit a question →</button>
    </div>
    <div className="sticky top-0 z-[2] -mx-1 mt-3 flex gap-1 overflow-x-auto px-1 py-1.5" style={{ background: C.bg }} role="tablist">
      {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); haptic("light"); }} className="shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold" style={tab === id ? { background: C.lime, color: C.ink } : { background: C.card2 }}>{label}</button>)}
    </div>

    {tab === "training" && <>
      <OverallStats data={data} />
      <Box title="Workouts per week · 12 weeks"><Bars ys={t.weeks.map((w) => w.count)} labels={labels} goal={i.program ? undefined : 3} /></Box>
      <Box title={`Volume per week · ${u}`}><Bars ys={t.weeks.map((w) => w.volume)} labels={labels} /></Box>
      <Box title="Minutes per week"><Bars ys={t.weeks.map((w) => w.mins)} labels={labels} /></Box>
      <Box title="Which days you train"><Bars ys={t.byWeekday} labels={DAYS} h={70} /><div className="mt-1 flex justify-between text-[10px]" style={{ ...mono, color: C.dim }}>{DAYS.map((d) => <span key={d}>{d[0]}</span>)}</div></Box>
      <Box title="Training days · 12 weeks"><Heat heat={t.heat} /></Box>
      <Box title="Totals"><Row k="Workouts" v={t.total} /><Row k="Hours" v={t.totalHours} /><Row k="Sets" v={fmtNum(t.totalSets)} /><Row k="Reps" v={fmtNum(t.totalReps)} /><Row k={`Volume (${u})`} v={fmtNum(t.volume)} /><Row k="Yoga, meditation, mobility" v={`${t.sessionsTotal} · ${t.sessionMins} min`} /><Row k="Consistency (8 weeks)" v={`${t.consistency}%`} /></Box>
    </>}

    {tab === "strength" && <>
      {i.strength.lifts.length ? i.strength.lifts.slice(0, 12).map((l) => <Box key={l.exId} title={l.name}>
        <div className="flex items-baseline justify-between"><span className="text-[26px] font-bold tabular-nums" style={mono}>{l.e1rm} <span className="text-[13px]" style={{ color: C.dim }}>{u} est. 1RM</span></span>
          {l.change != null && <span className="text-[14px] font-bold" style={{ ...mono, color: l.change > 0 ? "#22c55e" : l.change < 0 ? "#ef4444" : C.dim }}>{l.change > 0 ? "+" : ""}{l.change}%</span>}</div>
        <Bars ys={l.series} h={60} />
        <p className="mt-1.5 text-[12.5px]" style={{ color: C.dim }}>Best set {l.weight} × {l.reps} on {day(l.date)} · {l.sessions} sessions{l.in4w != null ? ` · about ${l.in4w} ${u} in 4 weeks at this rate` : ""}</p>
      </Box>) : <Box title="Lifts"><p className="text-[14px]" style={{ color: C.dim }}>Log workouts and each lift's progress shows here.</p></Box>}
      {i.muscles.length > 0 && <Box title="Sets by muscle · 30 days">{i.muscles.map((m) => <Row key={m.muscle} k={m.muscle[0].toUpperCase() + m.muscle.slice(1)} v={`${m.sets30} (${m.pct}%) · ${m.sets7} this wk`} />)}</Box>}
    </>}

    {tab === "body" && <>
      <Box title={`Weight · last ${i.body.series.length} weigh-ins · ${u}`}>{i.body.series.length > 1 ? <Bars ys={i.body.series.map((y) => y - Math.min(...i.body.series) + 1)} fmt={(n) => String(n)} h={80} /> : <p className="text-[14px]" style={{ color: C.dim }}>Weigh in a few times to see your trend.</p>}</Box>
      <Box title="Changes"><Row k="Now" v={wt(i.body.kg, i)} /><Row k="Start" v={wt(i.body.startKg, i)} /><Row k="7 days" v={signed(i.body.change7, u)} /><Row k="30 days" v={signed(i.body.change30, u)} /><Row k="90 days" v={signed(i.body.change90, u)} /><Row k="Trend" v={i.body.weeklyKg == null ? "—" : `${wt(i.body.weeklyKg, i, true)} / wk`} /><Row k="BMI" v={i.body.bmi ?? "—"} /><Row k="Goal" v={wt(i.body.goalKg, i)} /><Row k="Left to goal" v={wt(i.body.toGoalKg, i, true)} /></Box>
    </>}

    {tab === "food" && <>
      <Box title="Calories · last 7 days"><Bars ys={i.food.kcalSeries} goal={i.food.goal.kcal} labels={["7d ago", "today"]} /></Box>
      <Box title="Averages (days logged)"><Row k="Calories" v={`${fmtNum(i.food.avg7.kcal)} / ${fmtNum(i.food.goal.kcal)}`} /><Row k="Protein" v={`${i.food.avg7.p} / ${i.food.goal.p} g`} /><Row k="Carbs" v={`${i.food.avg7.c} / ${i.food.goal.c} g`} /><Row k="Fat" v={`${i.food.avg7.f} / ${i.food.goal.f} g`} /><Row k="Daily burn (est.)" v={`${fmtNum(i.food.goal.tdee)} cal`} /><Row k="Days logged" v={`${i.food.daysLogged7} of 7`} /><Row k="Within 10% of goal" v={`${i.food.onTarget7} days`} /><Row k="Logging streak" v={`${i.food.loggingStreak} days`} /></Box>
      {Object.keys(i.food.meals).length > 0 && <Box title="Calories by meal · 30 days">{Object.entries(i.food.meals).sort((a, b) => b[1] - a[1]).map(([m, n]) => <Row key={m} k={m[0].toUpperCase() + m.slice(1)} v={fmtNum(n)} />)}</Box>}
      {i.food.topFoods.length > 0 && <Box title="What you eat most">{i.food.topFoods.map((x) => <Row key={x.name} k={x.name} v={`${x.times}×`} />)}</Box>}
    </>}

    {tab === "recovery" && <>
      <Box title={`Sleep · last ${i.sleep.series.length} nights · hours`}>{i.sleep.series.length ? <Bars ys={i.sleep.series} goal={i.sleep.goal} fmt={(n) => `${n} h`} /> : <p className="text-[14px]" style={{ color: C.dim }}>Track a night of sleep to see it here.</p>}</Box>
      <Box title="Sleep"><Row k="7-day average" v={i.sleep.avg7 ? hm(i.sleep.avg7) : "—"} /><Row k="30-day average" v={i.sleep.avg30 ? hm(i.sleep.avg30) : "—"} /><Row k="Sleep debt this week" v={`${i.sleep.debt7} h`} /><Row k="Nights on goal" v={`${i.sleep.hit7} of 7`} /><Row k="Bedtime varies by" v={i.sleep.bedSpread != null ? `${i.sleep.bedSpread} min` : "—"} /><Row k="Best / worst" v={`${i.sleep.best ?? "—"} / ${i.sleep.worst ?? "—"} h`} /></Box>
      <Box title="Water · last 7 days"><Bars ys={i.water.series} goal={i.water.goalMl} labels={["7d ago", "today"]} /></Box>
      <Box title="Readiness and fasting"><Row k="Readiness today" v={`${i.readiness.score} · ${i.readiness.word}`} /><Row k="Fasts" v={i.fasting.count} /><Row k="Average fast" v={i.fasting.avgH ? `${i.fasting.avgH} h` : "—"} /><Row k="Longest fast" v={i.fasting.longestH ? `${i.fasting.longestH} h` : "—"} /><Row k="Fasts this week" v={i.fasting.last7} /></Box>
    </>}

    {tab === "forecast" && <>
      <Box title="If your recent trend keeps going">
        <Row k="Weight in 4 weeks" v={i.forecast.weightIn4w != null ? `${i.forecast.weightIn4w} ${u}` : "—"} />
        <Row k="Goal weight reached" v={i.forecast.goalDate ? day(i.forecast.goalDate) : "—"} />
        <Row k="Workouts left this week" v={i.forecast.sessionsThisWeekLeft} />
        {i.program && <Row k={i.program.name} v={`${i.program.done} of ${i.program.total} days`} />}
        {i.forecast.liftsIn4w.map((l) => <Row key={l.name} k={`${l.name} in 4 weeks`} v={`${l.now} → ${l.then} ${u}`} />)}
      </Box>
      <p className="mt-2 px-1 text-[12px]" style={{ color: C.dim }}>Forecasts are straight-line estimates from your last few weeks, not promises. Ask Fit can explain them or plan around them.</p>
    </>}
    <div className="h-6" />
  </Sheet>;
}
