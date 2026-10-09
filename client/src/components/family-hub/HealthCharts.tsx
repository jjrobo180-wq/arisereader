// Food & fitness charts, like MyFitnessPal's Progress and Nutrition screens: calories against the goal,
// macros, weight toward the goal weight, exercise, water and steps over a week, a month or three months.
// Kids get habit charts only (fruits & veggies, water, active minutes), never calories or weight.
import { useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addDays, type Health, type HealthGoals, type Member } from "@shared/familyHub";
import { healthSeries, latestWeight, macroGrams, weeklySeries, type HealthDay } from "@shared/familyHealth";
import { Panel, shortDate } from "./ui";

type Metric = "calories" | "macros" | "weight" | "exercise" | "water" | "steps" | "fruitVeg" | "active";
const RANGES = [{ days: 7, label: "1 week" }, { days: 30, label: "1 month" }, { days: 91, label: "3 months" }] as const;
const ADULT: { id: Metric; label: string }[] = [
  { id: "calories", label: "Calories" }, { id: "macros", label: "Macros" }, { id: "weight", label: "Weight" },
  { id: "exercise", label: "Exercise" }, { id: "water", label: "Water" }, { id: "steps", label: "Steps" },
];
const KID: { id: Metric; label: string }[] = [{ id: "fruitVeg", label: "Fruits & veggies" }, { id: "water", label: "Water" }, { id: "active", label: "Active minutes" }];

/* Colors: one violet for single measures; macros use a categorical set checked for color-blind separation
   (they always carry labels too). The goal line is a dashed neutral, never a data color. */
const MAIN = "#6e5ae0";
const MACRO = { protein: "#2a9d8f", carbs: "#4a7fd6", fat: "#c98a14" } as const;
const GOAL = "#64748b";
const AXIS = { fontSize: 11, fill: "#94a3b8", fontWeight: 600 } as const;
const fmt = (n: number) => Math.round(n).toLocaleString();

export default function HealthCharts({ health, member, goals, today }: { health: Health; member: Member; goals: HealthGoals; today: string }) {
  const kid = member.kind === "kid";
  const metrics = kid ? KID : ADULT;
  const [metric, setMetric] = useState<Metric>(metrics[0].id);
  const shown = metrics.some((m) => m.id === metric) ? metric : metrics[0].id;
  const [range, setRange] = useState<number>(7);
  const weekly = range > 30;
  const dates = useMemo(() => Array.from({ length: range }, (_, i) => addDays(today, i - range + 1)), [range, today]);
  const daily = useMemo(() => healthSeries(health, member.id, dates), [health, member.id, dates]);
  const rows = useMemo(() => (weekly ? weeklySeries(daily) : daily), [daily, weekly]);
  const tick = (d: string) => range <= 7 ? shortDate(d, { weekday: "short" }) : shortDate(d, { month: "numeric", day: "numeric" });
  const per = weekly ? "a day (weekly average)" : "a day";

  return <div className="space-y-5">
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Chart">
      {metrics.map((m) => <button key={m.id} role="tab" aria-selected={shown === m.id} onClick={() => setMetric(m.id)}
        className={`min-h-10 shrink-0 rounded-xl px-4 text-sm font-bold ring-1 transition ${shown === m.id ? "bg-[#292446] text-white ring-[#292446]" : "bg-white text-slate-600 ring-slate-200"}`}>{m.label}</button>)}
    </div>
    {shown !== "weight" && <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold" role="group" aria-label="Time range">
      {RANGES.map((r) => <button key={r.days} onClick={() => setRange(r.days)} aria-pressed={range === r.days} className={`min-h-9 rounded-lg px-3.5 ${range === r.days ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}>{r.label}</button>)}
    </div>}

    {shown === "calories" && <Calories rows={rows} daily={daily} goal={goals.calories} tick={tick} per={per} weekly={weekly} />}
    {shown === "macros" && <Macros rows={rows} daily={daily} goals={goals} tick={tick} weekly={weekly} />}
    {shown === "weight" && <Weight health={health} memberId={member.id} goalWeight={goals.goalWeight} today={today} />}
    {shown === "exercise" && <Simple rows={rows} tick={tick} field="burned" unit="cal burned" title="Calories burned" weekly={weekly}
      stats={[["Total burned", `${fmt(sum(daily, "burned"))} cal`], ["Active minutes", fmt(sum(daily, "minutes"))], ["Days active", `${daily.filter((d) => d.minutes > 0).length} of ${daily.length}`]]}
      empty="Log a workout in the diary to see it here." note={weekly ? "Each bar is a week's total." : undefined} />}
    {shown === "water" && <Simple rows={rows} tick={tick} field="water" unit="cups" title={`Water, cups ${per}`} goal={goals.water} weekly={weekly}
      stats={[["Average", `${avgOf(daily, "water")} cups`], ["Goal", `${goals.water} cups`], ["Days at goal", `${daily.filter((d) => goals.water > 0 && d.water >= goals.water).length} of ${daily.length}`]]}
      empty="Tap the cups in the diary to log water." />}
    {shown === "steps" && <Simple rows={rows} tick={tick} field="steps" unit="steps" title={`Steps ${per}`} goal={goals.steps} weekly={weekly}
      stats={[["Average", fmt(avgOf(daily, "steps"))], ["Best day", fmt(Math.max(0, ...daily.map((d) => d.steps)))], ["Days at goal", `${daily.filter((d) => goals.steps > 0 && d.steps >= goals.steps).length} of ${daily.length}`]]}
      empty="Save your steps in the diary, or connect Apple Health." />}
    {shown === "fruitVeg" && <Simple rows={rows} tick={tick} field="fruitVeg" unit="fruits & veggies" title={`Fruits & veggies ${per}`} goal={goals.fruitVeg} weekly={weekly}
      stats={[["Average", `${avgOf(daily, "fruitVeg")}`], ["Rainbow days", `${daily.filter((d) => goals.fruitVeg > 0 && d.fruitVeg >= goals.fruitVeg).length}`]]}
      empty={`Add fruits and veggies in ${member.name}'s diary to see them here.`} />}
    {shown === "active" && <Simple rows={rows} tick={tick} field="minutes" unit="minutes" title={weekly ? "Active minutes each week" : "Active minutes"} goal={weekly ? undefined : goals.activeMinutes} weekly={weekly}
      stats={[["Total", `${fmt(sum(daily, "minutes"))} min`], ["Days at goal", `${daily.filter((d) => goals.activeMinutes > 0 && d.minutes >= goals.activeMinutes).length}`]]}
      empty={`Log ${member.name}'s active play in the diary.`} />}
  </div>;
}

const sum = (rows: HealthDay[], key: keyof HealthDay) => rows.reduce((s, d) => s + (d[key] as number), 0);
function avgOf(rows: HealthDay[], key: keyof HealthDay) {
  const has = rows.filter((d) => (d[key] as number) > 0);
  return has.length ? Math.round((sum(has, key) / has.length) * 10) / 10 : 0;
}

function Stats({ items }: { items: [string, string][] }) {
  return <div className={`grid gap-2 ${items.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>{items.map(([label, value]) =>
    <div key={label} className="rounded-2xl bg-slate-50 px-3 py-2.5"><p className="truncate text-base font-black text-slate-800 sm:text-lg">{value}</p><p className="text-[11px] font-bold text-slate-500">{label}</p></div>)}</div>;
}

function Tip({ active, payload, label, unit, tick }: { active?: boolean; payload?: any[]; label?: string; unit: string; tick: (d: string) => string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl bg-[#292446] px-3 py-2 text-xs font-semibold text-white shadow-lg">
    <p className="mb-1 text-[11px] text-white/70">{label ? tick(label) : ""}</p>
    {payload.map((p) => <p key={p.dataKey} className="flex items-center gap-1.5">{payload.length > 1 && <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />}{payload.length > 1 ? `${p.name}: ` : ""}{fmt(p.value)} {unit}</p>)}
  </div>;
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-slate-200 px-6 text-center text-sm text-slate-500">{children}</div>;
}

function Calories({ rows, daily, goal, tick, per, weekly }: { rows: HealthDay[]; daily: HealthDay[]; goal: number; tick: (d: string) => string; per: string; weekly: boolean }) {
  const logged = daily.filter((d) => d.logged);
  const avg = logged.length ? Math.round(sum(logged, "calories") / logged.length) : 0;
  const net = logged.length ? Math.round(logged.reduce((s, d) => s + d.calories - d.burned, 0) / logged.length) : 0;
  const under = logged.filter((d) => d.calories - d.burned <= goal).length;
  return <Panel eyebrow={`Calories ${per}`} title={avg ? `${fmt(avg)} average` : "No meals logged yet"}>
    {logged.length ? <ChartBox label={`Calories eaten ${per}, with the daily goal of ${fmt(goal)}`}>
      <BarChart data={rows} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap={rows.length > 14 ? "18%" : "28%"}>
        <CartesianGrid vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
        <XAxis dataKey="date" tickFormatter={tick} tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={10} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={(n) => n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n)} />
        <Tooltip cursor={{ fill: "#6e5ae014" }} content={<Tip unit="cal" tick={tick} />} />
        {goal > 0 && <ReferenceLine y={goal} stroke={GOAL} strokeDasharray="5 4" strokeWidth={1.5} label={{ value: `Goal ${fmt(goal)}`, position: "insideTopRight", fontSize: 11, fill: GOAL, fontWeight: 700 }} />}
        <Bar dataKey="calories" name="Calories" radius={[4, 4, 0, 0]} maxBarSize={36}>
          {rows.map((r) => <Cell key={r.date} fill={MAIN} fillOpacity={goal > 0 && r.calories > goal ? 0.55 : 1} />)}
        </Bar>
      </BarChart>
    </ChartBox> : <Empty>Log food in the diary and your calories will show up here, day by day.</Empty>}
    <div className="mt-4"><Stats items={[["Avg net (food − exercise)", fmt(net)], ["Daily goal", fmt(goal)], ["Days at or under goal", `${under} of ${logged.length}`]]} /></div>
    {logged.length > 0 && <p className="mt-2 text-[11px] text-slate-500">{weekly ? "Each bar is the average of the days you logged that week. " : ""}Lighter bars are over the goal.</p>}
  </Panel>;
}

function Macros({ rows, daily, goals, tick, weekly }: { rows: HealthDay[]; daily: HealthDay[]; goals: HealthGoals; tick: (d: string) => string; weekly: boolean }) {
  const logged = daily.filter((d) => d.logged);
  const avg = (k: "protein" | "carbs" | "fat") => (logged.length ? Math.round(sum(logged, k) / logged.length) : 0);
  const grams = { protein: avg("protein"), carbs: avg("carbs"), fat: avg("fat") };
  const cal = { protein: grams.protein * 4, carbs: grams.carbs * 4, fat: grams.fat * 9 };
  const total = cal.protein + cal.carbs + cal.fat;
  const target = macroGrams(goals);
  const goalPct = { protein: goals.proteinPct, carbs: goals.carbsPct, fat: goals.fatPct };
  const pie = (["carbs", "fat", "protein"] as const).map((k) => ({ key: k, name: k[0].toUpperCase() + k.slice(1), value: cal[k] }));
  return <div className="space-y-5">
    <Panel eyebrow={logged.length ? `Average of ${logged.length} day${logged.length === 1 ? "" : "s"} logged` : "Macros"} title="Nutrition split">
      {total > 0 ? <div className="grid items-center gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="mx-auto h-44 w-44" role="img" aria-label={`Calories from carbs ${Math.round(cal.carbs / total * 100)}%, fat ${Math.round(cal.fat / total * 100)}%, protein ${Math.round(cal.protein / total * 100)}%`}>
          <ResponsiveContainer><PieChart>
            <Pie data={pie} dataKey="value" innerRadius="62%" outerRadius="96%" startAngle={90} endAngle={-270} paddingAngle={2} stroke="none" isAnimationActive={false}>
              {pie.map((p) => <Cell key={p.key} fill={MACRO[p.key]} />)}
            </Pie>
          </PieChart></ResponsiveContainer>
        </div>
        <ul className="space-y-3">{(["carbs", "fat", "protein"] as const).map((k) => {
          const pct = Math.round((cal[k] / total) * 100);
          return <li key={k}>
            <div className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2 font-bold text-slate-700"><span className="h-3 w-3 rounded-full" style={{ background: MACRO[k] }} />{k[0].toUpperCase() + k.slice(1)}</span>
              <span className="text-slate-800"><b>{pct}%</b> <span className="text-xs font-semibold text-slate-500">goal {goalPct[k]}%</span></span></div>
            <p className="ml-5 text-xs text-slate-500">{grams[k]} g a day · goal {target[k]} g</p>
          </li>;
        })}</ul>
      </div> : <Empty>Log meals with nutrition info to see your carbs, fat and protein.</Empty>}
    </Panel>
    {total > 0 && <Panel eyebrow={weekly ? "Grams a day, weekly average" : "Grams each day"} title="Macros over time">
      <ChartBox label="Grams of carbs, fat and protein each day">
        <BarChart data={rows} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap={rows.length > 14 ? "18%" : "28%"}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
          <XAxis dataKey="date" tickFormatter={tick} tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={10} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} />
          <Tooltip cursor={{ fill: "#6e5ae014" }} content={<Tip unit="g" tick={tick} />} />
          <Bar dataKey="carbs" name="Carbs" stackId="m" fill={MACRO.carbs} stroke="#fff" strokeWidth={1} maxBarSize={36} />
          <Bar dataKey="fat" name="Fat" stackId="m" fill={MACRO.fat} stroke="#fff" strokeWidth={1} maxBarSize={36} />
          <Bar dataKey="protein" name="Protein" stackId="m" fill={MACRO.protein} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ChartBox>
      <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-slate-600">{(["carbs", "fat", "protein"] as const).map((k) => <span key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: MACRO[k] }} />{k[0].toUpperCase() + k.slice(1)}</span>)}</div>
    </Panel>}
  </div>;
}

function Weight({ health, memberId, goalWeight, today }: { health: Health; memberId: string; goalWeight: number; today: string }) {
  const [span, setSpan] = useState<number>(91);
  const { list } = latestWeight(health, memberId);
  const since = span ? addDays(today, -span + 1) : "";
  const rows = list.filter((w) => !since || w.date >= since).map((w) => ({ date: w.date, weight: w.weight }));
  const first = rows[0], last = rows[rows.length - 1];
  const change = first && last ? Math.round((last.weight - first.weight) * 10) / 10 : 0;
  const values = rows.map((r) => r.weight).concat(goalWeight ? [goalWeight] : []);
  const lo = Math.floor(Math.min(...values) - 2), hi = Math.ceil(Math.max(...values) + 2);
  const tick = (d: string) => shortDate(d, { month: "short", day: "numeric" });
  return <div className="space-y-5">
    <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold" role="group" aria-label="Time range">
      {[[30, "1 month"], [91, "3 months"], [365, "1 year"], [0, "All"]].map(([d, label]) => <button key={d} onClick={() => setSpan(d as number)} aria-pressed={span === d} className={`min-h-9 rounded-lg px-3 ${span === d ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}>{label}</button>)}
    </div>
    <Panel eyebrow="Weight" title={last ? `${last.weight} lb` : "No weigh-ins yet"}>
      {rows.length > 1 ? <ChartBox label={`Weight over time${goalWeight ? `, goal ${goalWeight} pounds` : ""}`}>
        <LineChart data={rows} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
          <XAxis dataKey="date" tickFormatter={tick} tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis domain={[lo, hi]} tick={AXIS} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
          <Tooltip cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }} content={<Tip unit="lb" tick={tick} />} />
          {goalWeight > 0 && <ReferenceLine y={goalWeight} stroke={GOAL} strokeDasharray="5 4" strokeWidth={1.5} label={{ value: `Goal ${goalWeight}`, position: "insideBottomRight", fontSize: 11, fill: GOAL, fontWeight: 700 }} />}
          <Line type="monotone" dataKey="weight" name="Weight" stroke={MAIN} strokeWidth={2.5} dot={rows.length <= 40 ? { r: 4, fill: MAIN, stroke: "#fff", strokeWidth: 2 } : false} activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }} />
        </LineChart>
      </ChartBox> : <Empty>{rows.length ? "Log another weigh-in to start your weight chart." : "Log your weight in the diary to see it charted here."}</Empty>}
      <div className="mt-4"><Stats items={[["Start", first ? `${first.weight} lb` : "–"], [span ? "Change" : "Change overall", first && last && first !== last ? `${change > 0 ? "+" : ""}${change} lb` : "–"], ["To goal", goalWeight && last ? `${Math.abs(Math.round((last.weight - goalWeight) * 10) / 10)} lb` : "–"]]} /></div>
    </Panel>
  </div>;
}

function Simple({ rows, tick, field, unit, title, goal, stats, empty, note, weekly }: {
  rows: HealthDay[]; tick: (d: string) => string; field: keyof HealthDay; unit: string; title: string; goal?: number;
  stats: [string, string][]; empty: string; note?: string; weekly: boolean;
}) {
  const has = rows.some((r) => (r[field] as number) > 0);
  return <Panel eyebrow={weekly ? "Weekly" : "Daily"} title={title}>
    {has ? <ChartBox label={`${title}${goal ? `, goal ${goal}` : ""}`}>
      <BarChart data={rows} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap={rows.length > 14 ? "18%" : "28%"}>
        <CartesianGrid vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
        <XAxis dataKey="date" tickFormatter={tick} tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={10} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={(n) => n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n)} />
        <Tooltip cursor={{ fill: "#6e5ae014" }} content={<Tip unit={unit} tick={tick} />} />
        {goal ? <ReferenceLine y={goal} stroke={GOAL} strokeDasharray="5 4" strokeWidth={1.5} label={{ value: `Goal ${fmt(goal)}`, position: "insideTopRight", fontSize: 11, fill: GOAL, fontWeight: 700 }} /> : null}
        <Bar dataKey={field as string} name={title} fill={MAIN} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ChartBox> : <Empty>{empty}</Empty>}
    <div className="mt-4"><Stats items={stats} /></div>
    {note && has && <p className="mt-2 text-[11px] text-slate-500">{note}</p>}
  </Panel>;
}

function ChartBox({ label, children }: { label: string; children: ReactNode }) {
  return <div className="h-56 w-full sm:h-64" role="img" aria-label={label}><ResponsiveContainer>{children as any}</ResponsiveContainer></div>;
}
