// Cycle tracker: log period days, symptoms, discharge, pain, energy, temperature and ovulation tests;
// see the next period and fertile window; get a daily insight, tips and foods for the phase you're in;
// and read short guides (cycle vs. period, discharge, PMS, when to see a doctor).
import { useState, type ReactNode } from "react";
import { Apple, BookOpen, CalendarHeart, ChevronDown, ChevronLeft, ChevronRight, Droplets, Dumbbell, Info, Lightbulb, Sparkles, Thermometer, XCircle } from "lucide-react";
import { DISCHARGES, FLOWS, addDays, cycleLogUsed, daysBetween, fromDay, toDay, type CycleLog, type Discharge, type Energy, type Flow, type OvTest } from "@shared/familyHub";
import { cycleSummary, predictedDays, type CycleSummary } from "@shared/familyCycle";
import { DISCHARGE, EXTRA_SYMPTOMS, PHASE_GUIDE, READINGS, dailyInsight, type PhaseId } from "@shared/cycleGuide";
import { trackerPeople } from "@shared/familyHealth";
import { useAuth } from "@/context/AuthContext";
import { PageHead, Panel, inputClass, plain, shortDate, type SectionProps } from "./ui";

const FLOW_LABEL: Record<Flow, string> = { none: "None", spotting: "Spotting", light: "Light", medium: "Medium", heavy: "Heavy" };
const FLOW_DOTS: Record<Flow, number> = { none: 0, spotting: 1, light: 1, medium: 2, heavy: 3 };
const PAIN = ["None", "Mild", "Moderate", "Severe"];
const ENERGY: { id: Energy; label: string }[] = [{ id: "low", label: "Low" }, { id: "ok", label: "OK" }, { id: "high", label: "High" }];
type View = "today" | "calendar" | "learn";

/** Which phase today is in and how many days into it. */
function phaseDay(s: CycleSummary, today: string): { phase: PhaseId; day: number } | null {
  if (!s.phase || !s.lastStart || !s.dayOfCycle) return null;
  const phase = s.phase as PhaseId;
  if (phase === "period") return { phase, day: s.dayOfCycle };
  if (phase === "fertile" && s.fertileStart) return { phase, day: daysBetween(s.fertileStart, today) + 1 };
  if (phase === "luteal" && s.fertileEnd) return { phase, day: Math.max(1, daysBetween(s.fertileEnd, today)) };
  return { phase, day: Math.max(1, s.dayOfCycle - s.periodLength) };
}

export default function Cycle({ family, setFamily, today, say }: SectionProps) {
  const { user } = useAuth();
  const people = trackerPeople(family, (user?.displayName || "").split(" ")[0]).filter((m) => family.health.profiles[m.id]?.sex !== "male");
  const [who, setWho] = useState(people[0]?.id || "me");
  const [view, setView] = useState<View>("today");
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const member = people.find((m) => m.id === who) || people[0];
  const memberId = member?.id || "me";
  const s = cycleSummary(family.cycleLogs, memberId, today);
  const predicted = predictedDays(s);
  const logFor = (date: string) => family.cycleLogs.find((l) => l.id === `${memberId}:${date}`);
  const loggedFlow = new Set(family.cycleLogs.filter((l) => l.memberId === memberId && l.flow !== "none").map((l) => l.date));
  const now = phaseDay(s, today);
  const guide = now ? PHASE_GUIDE[now.phase] : null;

  const saveOn = (date: string) => (patch: Partial<CycleLog>) => setFamily((f) => {
    const id = `${memberId}:${date}`;
    const old = f.cycleLogs.find((l) => l.id === id);
    const next: CycleLog = { id, memberId, date, flow: "none", symptoms: [], note: "", ...old, ...patch };
    const rest = f.cycleLogs.filter((l) => l.id !== id);
    return { ...f, cycleLogs: cycleLogUsed(next) ? [...rest, next].slice(-6000) : rest };
  });
  const startToday = () => { saveOn(today)({ flow: "medium" }); setSelected(today); say("Period logged for today"); };

  const first = fromDay(`${month}-01`);
  const gridStart = addDays(`${month}-01`, -first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const shift = (n: number) => { const d = fromDay(`${month}-01`); d.setMonth(d.getMonth() + n); setMonth(toDay(d).slice(0, 7)); };

  return <div className="space-y-6">
    <PageHead eyebrow="Cycle" title="Cycle tracker" blurb="Log your period and how you feel. Get a daily insight, tips and foods for where you are in your cycle." />
    <div className="flex flex-wrap items-center justify-between gap-3">
      {people.length > 1 ? <div className="flex flex-wrap gap-2">{people.map((m) => <button key={m.id} onClick={() => setWho(m.id)} aria-pressed={m.id === memberId}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-2.5 pr-3 text-xs font-bold text-slate-600 ring-1 ring-slate-200"
        style={m.id === memberId ? { background: m.color, color: "#fff", boxShadow: `0 0 0 1px ${m.color}` } : undefined}><span className="text-base leading-none">{m.emoji || "🙂"}</span>{m.name}</button>)}</div> : <span />}
      <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm font-bold" role="tablist" aria-label="Cycle view">
        {([["today", "Today", Sparkles], ["calendar", "Calendar", CalendarHeart], ["learn", "Learn", BookOpen]] as const).map(([id, label, Icon]) =>
          <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 sm:px-4 ${view === id ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}><Icon size={16} />{label}</button>)}
      </div>
    </div>

    {view === "today" && <>
      <Hero s={s} onStart={startToday} />
      {guide && now ? <>
        <section className="rounded-[1.5rem] border p-5 sm:p-6" style={{ borderColor: guide.color + "55", background: guide.color + "12" }} data-testid="cycle-insight">
          <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.15em]" style={{ color: guide.color }}><Lightbulb size={15} /> Today's insight · {guide.name}, day {now.day}</p>
          <p className="mt-2 text-lg font-bold leading-7 text-[#232139]">{dailyInsight(now.phase, now.day)}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><p className="text-xs font-bold text-slate-500">What's happening</p><p className="mt-1 text-sm leading-6 text-slate-700">{guide.happening}</p></div>
            <div><p className="text-xs font-bold text-slate-500">How you may feel</p><p className="mt-1 text-sm leading-6 text-slate-700">{guide.feel}</p></div>
          </div>
        </section>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <Panel eyebrow={guide.name} title="Tips and tricks" right={<Sparkles size={18} style={{ color: guide.color }} />}>
              <ul className="space-y-2">{guide.tips.map((t) => <li key={t} className="flex gap-2.5 text-sm leading-6 text-slate-700"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: guide.color }} />{t}</li>)}</ul>
              <p className="mt-4 flex gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><Dumbbell size={16} className="mt-0.5 shrink-0 text-violet-500" />{guide.move}</p>
            </Panel>
            <Panel eyebrow={guide.name} title="Food for this phase" right={<Apple size={18} className="text-emerald-500" />}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FoodList title="Eat more" tone="good" items={guide.eat} />
                <FoodList title="Go easy on" tone="limit" items={guide.limit} />
              </div>
            </Panel>
          </div>
          <DayLog date={today} entry={logFor(today)} save={saveOn(today)} memberId={memberId} />
        </div>
      </> : <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel eyebrow="Getting started" title="Your daily insight starts after your first period is logged">
          <p className="text-sm leading-6 text-slate-600">Tap "Period started today", or open the Calendar and tap the first day of your last period. Then each day you'll see what's happening in your body, tips and tricks, and foods to eat and go easy on.</p>
          <button type="button" onClick={() => setView("learn")} className={plain + " mt-4"}><BookOpen size={16} /> Learn the basics</button>
        </Panel>
        <DayLog date={today} entry={logFor(today)} save={saveOn(today)} memberId={memberId} />
      </div>}
    </>}

    {view === "calendar" && <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        <Panel className="self-start" title={first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          right={<><button onClick={() => shift(-1)} className={plain} aria-label="Previous month"><ChevronLeft size={17} /></button><button onClick={() => { setMonth(today.slice(0, 7)); setSelected(today); }} className={plain}>Today</button><button onClick={() => shift(1)} className={plain} aria-label="Next month"><ChevronRight size={17} /></button></>}>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="pb-1 text-[11px] font-black text-slate-400">{d}</div>)}
            {cells.map((d) => {
              const logged = loggedFlow.has(d), pred = !logged && d > today && predicted.period.has(d), fert = predicted.fertile.has(d) || (s.fertileStart && d >= s.fertileStart && d <= (s.fertileEnd || "")), ov = predicted.ovulation.has(d) || d === s.ovulation;
              const l = logFor(d);
              const more = !!l && (l.symptoms.length > 0 || !!l.discharge || !!l.pain || !!l.energy || !!l.temp || !!l.ovTest || !!l.note.trim());
              return <button key={d} onClick={() => setSelected(d)} disabled={d > today} aria-pressed={selected === d} aria-label={`${shortDate(d)}${logged ? ", period logged" : pred ? ", predicted period" : fert ? ", fertile window" : ""}`}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-bold transition disabled:cursor-default ${d.slice(0, 7) !== month ? "opacity-35" : ""} ${selected === d ? "ring-2 ring-violet-500" : ""}`}
                style={logged ? { background: "#e0566b", color: "#fff" } : pred ? { boxShadow: "inset 0 0 0 2px #e0566b", color: "#e0566b" } : fert ? { background: "#2fa58f22", color: "#1f8f7a" } : undefined}>
                <span className={d === today && !logged ? "flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-white" : ""}>{Number(d.slice(8))}</span>
                {ov && !logged && <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-[#2fa58f]" />}
                {more && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-400" />}
              </button>;
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-semibold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#e0566b]" />Period</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ boxShadow: "inset 0 0 0 2px #e0566b" }} />Predicted period</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#2fa58f33]" />Fertile window</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#2fa58f]" />Ovulation (est.)</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Something else logged</span>
          </div>
        </Panel>
        <Averages s={s} />
      </div>
      <DayLog date={selected} entry={logFor(selected)} save={saveOn(selected)} memberId={memberId} today={today} />
    </div>}

    {view === "learn" && <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Panel eyebrow="Learn" title="Readings">
        <ul className="space-y-2">{READINGS.map((r, i) => <Reading key={r.id} title={r.title} minutes={r.minutes} open={i === 0}>{r.paragraphs.map((p, j) => <p key={j} className="text-sm leading-6 text-slate-700">{p}</p>)}</Reading>)}</ul>
      </Panel>
      <div className="space-y-6">
        <Panel eyebrow="Your numbers" title="Cycle vs. period">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl bg-violet-50 p-3"><p className="text-[11px] font-bold text-violet-700">Your cycle</p><p className="text-2xl font-black text-[#232139]">{s.cycleLength}<span className="text-sm text-slate-500"> days</span></p><p className="text-[11px] text-slate-500">first day of one period to the next</p></div>
            <div className="rounded-2xl bg-rose-50 p-3"><p className="text-[11px] font-bold text-rose-700">Your period</p><p className="text-2xl font-black text-[#232139]">{s.periodLength}<span className="text-sm text-slate-500"> days</span></p><p className="text-[11px] text-slate-500">the days you bleed</p></div>
          </div>
        </Panel>
        <Panel eyebrow="Guide" title="What discharge can tell you">
          <ul className="space-y-2">{DISCHARGE.map((d) => <li key={d.id} className={`rounded-xl p-3 text-sm ${d.id === "unusual" ? "bg-rose-50" : "bg-slate-50"}`}><b className="text-slate-800">{d.label}.</b> <span className="text-slate-600">{d.means}</span></li>)}</ul>
        </Panel>
        <Panel eyebrow="Phases" title="The four phases">
          <ul className="space-y-2">{(Object.values(PHASE_GUIDE)).map((p) => <li key={p.id} className="flex gap-3 rounded-xl bg-slate-50 p-3"><span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} /><span><b className="block text-sm text-slate-800">{p.name}</b><span className="text-xs text-slate-500">{p.days}</span><span className="mt-1 block text-sm text-slate-600">{p.happening}</span></span></li>)}</ul>
        </Panel>
      </div>
    </div>}

    <p className="flex gap-2 rounded-2xl bg-slate-50 p-4 text-[11px] leading-5 text-slate-500"><Info size={14} className="mt-0.5 shrink-0" />Predictions and tips are general information, not medical advice, and this tracker can't be used as birth control. Talk to a doctor about very painful, very heavy or missed periods, or discharge that seems unusual.</p>
  </div>;
}

function Hero({ s, onStart }: { s: CycleSummary; onStart: () => void }) {
  const color = s.phase ? PHASE_GUIDE[s.phase as PhaseId].color : "#e0566b";
  return <section className="grid gap-5 rounded-[1.5rem] bg-[#2b1f3f] p-6 text-white shadow-[0_12px_24px_#2924461f] md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
    <div className="relative mx-auto h-36 w-36">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90"><circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="10" />
        {s.dayOfCycle && <circle cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${Math.min(1, s.dayOfCycle / s.cycleLength) * 326.7} 326.7`} />}</svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{s.dayOfCycle ? <><span className="text-[11px] font-bold uppercase tracking-wider text-white/60">Cycle day</span><span className="text-4xl font-black">{s.dayOfCycle}</span><span className="text-[11px] text-white/60">of ~{s.cycleLength}</span></> : <Droplets size={34} className="text-white/50" />}</div>
    </div>
    <div className="space-y-3">
      {s.lastStart ? <>
        <p className="text-2xl font-black">{s.late ? `Period is ${s.late} day${s.late === 1 ? "" : "s"} late` : s.onPeriod ? "On your period" : s.daysUntil === 0 ? "Period expected today" : `Period in ${s.daysUntil} day${s.daysUntil === 1 ? "" : "s"}`}</p>
        <p className="text-sm text-white/75">{s.phase && <><b style={{ color }}>{PHASE_GUIDE[s.phase as PhaseId].name}</b>. </>}{!s.late && s.nextStart && !s.onPeriod && <>Next expected around {shortDate(s.nextStart, { weekday: "short", month: "short", day: "numeric" })}. </>}{s.fertileStart && s.fertileEnd && <>Fertile window {shortDate(s.fertileStart, { month: "short", day: "numeric" })} – {shortDate(s.fertileEnd, { month: "short", day: "numeric" })}.</>}</p>
      </> : <><p className="text-2xl font-black">Log your last period to start</p><p className="text-sm text-white/75">Tap "Period started today", or open the Calendar and tap the first day of your last period.</p></>}
      <button onClick={onStart} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#e0566b] px-4 text-sm font-bold text-white hover:bg-[#c84459]"><Droplets size={16} /> Period started today</button>
    </div>
  </section>;
}

function FoodList({ title, tone, items }: { title: string; tone: "good" | "limit"; items: string[] }) {
  return <div className={`rounded-2xl p-4 ${tone === "good" ? "bg-emerald-50" : "bg-amber-50"}`}>
    <p className={`flex items-center gap-1.5 text-sm font-black ${tone === "good" ? "text-emerald-800" : "text-amber-900"}`}>{tone === "good" ? <Apple size={15} /> : <XCircle size={15} />}{title}</p>
    <ul className="mt-2 space-y-1.5">{items.map((f) => <li key={f} className="text-sm leading-5 text-slate-700">{f}</li>)}</ul>
  </div>;
}

function Reading({ title, minutes, open, children }: { title: string; minutes: number; open?: boolean; children: ReactNode }) {
  return <li><details open={open} className="group rounded-2xl border border-[#ececf3] bg-white">
    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-2"><BookOpen size={16} className="shrink-0 text-violet-500" /><span className="min-w-0 flex-1 text-sm font-bold text-slate-800">{title}</span><span className="text-[11px] font-semibold text-slate-400">{minutes} min</span><ChevronDown size={16} className="shrink-0 text-slate-400 transition group-open:rotate-180" /></summary>
    <div className="space-y-2 border-t border-slate-100 px-4 py-3">{children}</div>
  </details></li>;
}

function Averages({ s }: { s: CycleSummary }) {
  return <Panel eyebrow="Your cycle" title="Averages" right={<CalendarHeart size={18} className="text-rose-500" />}>
    <dl className="grid grid-cols-2 gap-3 text-center">
      <div className="rounded-2xl bg-slate-50 p-3"><dt className="text-[11px] font-bold text-slate-500">Cycle length</dt><dd className="text-2xl font-black">{s.cycleLength}<span className="text-sm text-slate-500"> days</span></dd></div>
      <div className="rounded-2xl bg-slate-50 p-3"><dt className="text-[11px] font-bold text-slate-500">Period length</dt><dd className="text-2xl font-black">{s.periodLength}<span className="text-sm text-slate-500"> days</span></dd></div>
    </dl>
    <p className="mt-3 text-xs text-slate-500">{!s.fromHistory ? "Using a typical 28-day cycle until you've logged two periods." : s.regular === null ? "Log a few more periods to see how regular your cycle is." : s.regular ? "Your cycle has been regular (within a week)." : "Your cycle length has varied by more than a week. That's common, but worth mentioning to a doctor if it's new."}</p>
    {s.periods.length > 0 && <ul className="mt-3 space-y-1.5">{s.periods.slice(-5).reverse().map((p) => <li key={p.start} className="flex justify-between text-xs"><span className="font-semibold text-slate-700">{shortDate(p.start, { month: "short", day: "numeric", year: "numeric" })}</span><span className="text-slate-500">{p.days} day{p.days === 1 ? "" : "s"}</span></li>)}</ul>}
  </Panel>;
}

function Chips<T extends string | number>({ value, options, onChange, tone = "violet" }: { value: T | undefined; options: { id: T; label: string }[]; onChange: (v: T | undefined) => void; tone?: "violet" | "rose" | "teal" }) {
  const on = tone === "rose" ? "bg-[#e0566b] text-white ring-[#e0566b]" : tone === "teal" ? "bg-[#2fa58f] text-white ring-[#2fa58f]" : "bg-violet-600 text-white ring-violet-600";
  return <div className="flex flex-wrap gap-1.5">{options.map((o) => { const active = value === o.id; return <button key={String(o.id)} type="button" aria-pressed={active} onClick={() => onChange(active ? undefined : o.id)}
    className={`min-h-9 rounded-xl px-3 text-xs font-bold ring-1 ${active ? on : "bg-white text-slate-600 ring-slate-200"}`}>{o.label}</button>; })}</div>;
}

function DayLog({ date, entry, save, memberId, today }: { date: string; entry?: CycleLog; save: (patch: Partial<CycleLog>) => void; memberId: string; today?: string }) {
  const discharge = DISCHARGE.find((d) => d.id === entry?.discharge);
  return <Panel className="self-start" eyebrow={!today || date === today ? "Today" : "Selected day"} title={shortDate(date, { weekday: "long", month: "long", day: "numeric" })}>
    <div className="space-y-4">
      <div><p className="mb-2 text-xs font-bold text-slate-600">Flow</p>
        <div className="grid grid-cols-5 gap-1.5">{(["none", ...FLOWS] as Flow[]).map((f) => { const on = (entry?.flow || "none") === f; return <button key={f} onClick={() => save({ flow: f })} aria-pressed={on}
          className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold ring-1 ${on ? (f === "none" ? "bg-slate-800 text-white ring-slate-800" : "bg-[#e0566b] text-white ring-[#e0566b]") : "bg-white text-slate-600 ring-slate-200 hover:ring-rose-300"}`}>
          <span className="flex gap-0.5">{Array.from({ length: Math.max(1, FLOW_DOTS[f]) }, (_, i) => <Droplets key={i} size={11} className={FLOW_DOTS[f] ? "" : "opacity-25"} />)}</span>{FLOW_LABEL[f]}</button>; })}</div></div>

      <div><p className="mb-2 text-xs font-bold text-slate-600">Discharge</p>
        <Chips value={entry?.discharge || undefined} options={DISCHARGES.map((d) => ({ id: d, label: DISCHARGE.find((x) => x.id === d)!.label }))} onChange={(v) => save({ discharge: (v || "") as Discharge })} tone="teal" />
        {discharge && <p className={`mt-2 rounded-xl p-2.5 text-xs leading-5 ${discharge.id === "unusual" ? "bg-rose-50 text-rose-800" : "bg-slate-50 text-slate-600"}`}>{discharge.means}</p>}</div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <div><p className="mb-2 text-xs font-bold text-slate-600">Pain</p><Chips value={entry?.pain || undefined} options={PAIN.slice(1).map((label, i) => ({ id: i + 1, label }))} onChange={(v) => save({ pain: v || 0 })} tone="rose" /></div>
        <div><p className="mb-2 text-xs font-bold text-slate-600">Energy</p><Chips value={entry?.energy || undefined} options={ENERGY} onChange={(v) => save({ energy: (v || "") as Energy })} /></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <label className="block text-xs font-bold text-slate-600"><span className="flex items-center gap-1.5"><Thermometer size={14} /> Basal temperature (°F)</span>
          <input key={`t${date}${memberId}`} type="number" step="0.01" min={90} max={105} inputMode="decimal" defaultValue={entry?.temp || ""} placeholder="97.8"
            onBlur={(e) => { const v = Number(e.target.value); const t = v >= 90 && v <= 105 ? Math.round(v * 100) / 100 : 0; if (t !== (entry?.temp || 0)) save({ temp: t }); }} className={inputClass + " mt-1.5"} /></label>
        <div><p className="mb-2 text-xs font-bold text-slate-600">Ovulation test</p><Chips value={entry?.ovTest || undefined} options={[{ id: "negative" as OvTest, label: "Negative" }, { id: "positive" as OvTest, label: "Positive" }]} onChange={(v) => save({ ovTest: (v || "") as OvTest })} tone="teal" /></div>
      </div>

      <div><p className="mb-2 text-xs font-bold text-slate-600">Symptoms</p>
        <div className="flex flex-wrap gap-1.5">{EXTRA_SYMPTOMS.map((sym) => { const on = !!entry?.symptoms.includes(sym); return <button key={sym} onClick={() => save({ symptoms: on ? (entry?.symptoms || []).filter((x) => x !== sym) : [...(entry?.symptoms || []), sym] })} aria-pressed={on}
          className={`min-h-9 rounded-xl px-3 text-xs font-bold ring-1 ${on ? "bg-violet-600 text-white ring-violet-600" : "bg-white text-slate-600 ring-slate-200"}`}>{sym}</button>; })}</div></div>

      <label className="block text-xs font-bold text-slate-600">Note<input key={`n${date}${memberId}`} defaultValue={entry?.note || ""} onBlur={(e) => { if (e.target.value !== (entry?.note || "")) save({ note: e.target.value.slice(0, 300) }); }} maxLength={300} placeholder="Anything to remember" className={inputClass + " mt-1.5"} /></label>
    </div>
  </Panel>;
}
