// Cycle tracker: log period days and symptoms, see the next period and fertile window, and a month calendar.
import { useState } from "react";
import { CalendarHeart, ChevronLeft, ChevronRight, Droplets, Info } from "lucide-react";
import { FLOWS, addDays, fromDay, toDay, type CycleLog, type Flow } from "@shared/familyHub";
import { SYMPTOMS, cycleSummary, predictedDays } from "@shared/familyCycle";
import { trackerPeople } from "@shared/familyHealth";
import { useAuth } from "@/context/AuthContext";
import { PageHead, Panel, inputClass, plain, primary, shortDate, type SectionProps } from "./ui";

const FLOW_LABEL: Record<Flow, string> = { none: "None", spotting: "Spotting", light: "Light", medium: "Medium", heavy: "Heavy" };
const FLOW_DOTS: Record<Flow, number> = { none: 0, spotting: 1, light: 1, medium: 2, heavy: 3 };
const PHASE: Record<string, { label: string; detail: string; color: string }> = {
  period: { label: "Period", detail: "Rest, warmth and water can help with cramps.", color: "#e0566b" },
  follicular: { label: "Follicular phase", detail: "Energy often rises after a period.", color: "#8b7cf6" },
  fertile: { label: "Fertile window", detail: "The days pregnancy is most likely.", color: "#2fa58f" },
  luteal: { label: "Luteal phase", detail: "PMS symptoms are common in the last week.", color: "#e59b3a" },
};

export default function Cycle({ family, setFamily, today, say }: SectionProps) {
  const { user } = useAuth();
  const people = trackerPeople(family, (user?.displayName || "").split(" ")[0]).filter((m) => family.health.profiles[m.id]?.sex !== "male");
  const [who, setWho] = useState(people[0]?.id || "me");
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const member = people.find((m) => m.id === who) || people[0];
  const memberId = member?.id || "me";
  const s = cycleSummary(family.cycleLogs, memberId, today);
  const predicted = predictedDays(s);
  const logFor = (date: string) => family.cycleLogs.find((l) => l.id === `${memberId}:${date}`);
  const loggedFlow = new Set(family.cycleLogs.filter((l) => l.memberId === memberId && l.flow !== "none").map((l) => l.date));
  const entry = logFor(selected);

  const save = (patch: Partial<CycleLog>) => setFamily((f) => {
    const id = `${memberId}:${selected}`;
    const old = f.cycleLogs.find((l) => l.id === id);
    const next: CycleLog = { id, memberId, date: selected, flow: "none", symptoms: [], note: "", ...old, ...patch };
    const empty = next.flow === "none" && !next.symptoms.length && !next.note.trim();
    const rest = f.cycleLogs.filter((l) => l.id !== id);
    return { ...f, cycleLogs: empty ? rest : [...rest, next].slice(-6000) };
  });
  const startToday = () => { setSelected(today); setFamily((f) => {
    const id = `${memberId}:${today}`;
    const old = f.cycleLogs.find((l) => l.id === id);
    return { ...f, cycleLogs: [...f.cycleLogs.filter((l) => l.id !== id), { id, memberId, date: today, flow: "medium" as Flow, symptoms: old?.symptoms || [], note: old?.note || "" }] };
  }); say("Period logged for today"); };

  const first = fromDay(`${month}-01`);
  const gridStart = addDays(`${month}-01`, -first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const shift = (n: number) => { const d = fromDay(`${month}-01`); d.setMonth(d.getMonth() + n); setMonth(toDay(d).slice(0, 7)); };
  const phase = s.phase ? PHASE[s.phase] : null;

  return <div className="space-y-6">
    <PageHead eyebrow="Cycle" title="Cycle tracker" blurb="Log your period and symptoms. Predictions get more accurate after a few cycles." />
    {people.length > 1 && <div className="flex flex-wrap gap-2">{people.map((m) => <button key={m.id} onClick={() => setWho(m.id)} aria-pressed={m.id === memberId}
      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-2.5 pr-3 text-xs font-bold text-slate-600 ring-1 ring-slate-200"
      style={m.id === memberId ? { background: m.color, color: "#fff", boxShadow: `0 0 0 1px ${m.color}` } : undefined}><span className="text-base leading-none">{m.emoji || "🙂"}</span>{m.name}</button>)}</div>}

    <section className="grid gap-5 rounded-[1.5rem] bg-[#2b1f3f] p-6 text-white shadow-[0_12px_24px_#2924461f] md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
      <div className="relative mx-auto h-36 w-36">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90"><circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="10" />
          {s.dayOfCycle && <circle cx="60" cy="60" r="52" fill="none" stroke={phase?.color || "#e0566b"} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${Math.min(1, s.dayOfCycle / s.cycleLength) * 326.7} 326.7`} />}</svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{s.dayOfCycle ? <><span className="text-[11px] font-bold uppercase tracking-wider text-white/60">Day</span><span className="text-4xl font-black">{s.dayOfCycle}</span><span className="text-[11px] text-white/60">of ~{s.cycleLength}</span></> : <Droplets size={34} className="text-white/50" />}</div>
      </div>
      <div className="space-y-3">
        {s.lastStart ? <>
          <p className="text-2xl font-black">{s.late ? `Period is ${s.late} day${s.late === 1 ? "" : "s"} late` : s.onPeriod ? "On your period" : s.daysUntil === 0 ? "Period expected today" : `Period in ${s.daysUntil} day${s.daysUntil === 1 ? "" : "s"}`}</p>
          <p className="text-sm text-white/75">{phase && <><b style={{ color: phase.color }}>{phase.label}</b> · {phase.detail} </>}{!s.late && s.nextStart && !s.onPeriod && <>Next expected around {shortDate(s.nextStart, { weekday: "short", month: "short", day: "numeric" })}. </>}{s.fertileStart && s.fertileEnd && <>Fertile window {shortDate(s.fertileStart, { month: "short", day: "numeric" })} – {shortDate(s.fertileEnd, { month: "short", day: "numeric" })}.</>}</p>
        </> : <><p className="text-2xl font-black">Log your last period to start</p><p className="text-sm text-white/75">Tap the first day of your last period on the calendar below and pick a flow, or tap “Period started today”.</p></>}
        <div className="flex flex-wrap gap-2"><button onClick={startToday} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#e0566b] px-4 text-sm font-bold text-white hover:bg-[#c84459]"><Droplets size={16} /> Period started today</button></div>
      </div>
    </section>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Panel className="self-start" title={first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        right={<><button onClick={() => shift(-1)} className={plain} aria-label="Previous month"><ChevronLeft size={17} /></button><button onClick={() => { setMonth(today.slice(0, 7)); setSelected(today); }} className={plain}>Today</button><button onClick={() => shift(1)} className={plain} aria-label="Next month"><ChevronRight size={17} /></button></>}>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="pb-1 text-[11px] font-black text-slate-400">{d}</div>)}
          {cells.map((d) => {
            const logged = loggedFlow.has(d), pred = !logged && d > today && predicted.period.has(d), fert = predicted.fertile.has(d) || (s.fertileStart && d >= s.fertileStart && d <= (s.fertileEnd || "")), ov = predicted.ovulation.has(d) || d === s.ovulation;
            const l = logFor(d);
            return <button key={d} onClick={() => setSelected(d)} disabled={d > today} aria-pressed={selected === d} aria-label={`${shortDate(d)}${logged ? ", period logged" : pred ? ", predicted period" : fert ? ", fertile window" : ""}`}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-bold transition disabled:cursor-default ${d.slice(0, 7) !== month ? "opacity-35" : ""} ${selected === d ? "ring-2 ring-violet-500" : ""}`}
              style={logged ? { background: "#e0566b", color: "#fff" } : pred ? { boxShadow: "inset 0 0 0 2px #e0566b", color: "#e0566b" } : fert ? { background: "#2fa58f22", color: "#1f8f7a" } : undefined}>
              <span className={d === today && !logged ? "flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-white" : ""}>{Number(d.slice(8))}</span>
              {ov && !logged && <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-[#2fa58f]" />}
              {l && l.symptoms.length > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-400" />}
            </button>;
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-semibold text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#e0566b]" />Period</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ boxShadow: "inset 0 0 0 2px #e0566b" }} />Predicted period</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#2fa58f33]" />Fertile window</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#2fa58f]" />Ovulation (est.)</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Symptoms</span>
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel eyebrow={selected === today ? "Today" : "Selected day"} title={shortDate(selected, { weekday: "long", month: "long", day: "numeric" })}>
          <p className="mb-2 text-xs font-bold text-slate-600">Flow</p>
          <div className="grid grid-cols-5 gap-1.5">{(["none", ...FLOWS] as Flow[]).map((f) => { const on = (entry?.flow || "none") === f; return <button key={f} onClick={() => save({ flow: f })} aria-pressed={on}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold ring-1 ${on ? (f === "none" ? "bg-slate-800 text-white ring-slate-800" : "bg-[#e0566b] text-white ring-[#e0566b]") : "bg-white text-slate-600 ring-slate-200 hover:ring-rose-300"}`}>
            <span className="flex gap-0.5">{Array.from({ length: Math.max(1, FLOW_DOTS[f]) }, (_, i) => <Droplets key={i} size={11} className={FLOW_DOTS[f] ? "" : "opacity-25"} />)}</span>{FLOW_LABEL[f]}</button>; })}</div>
          <p className="mb-2 mt-4 text-xs font-bold text-slate-600">Symptoms</p>
          <div className="flex flex-wrap gap-1.5">{SYMPTOMS.map((sym) => { const on = !!entry?.symptoms.includes(sym); return <button key={sym} onClick={() => save({ symptoms: on ? (entry?.symptoms || []).filter((x) => x !== sym) : [...(entry?.symptoms || []), sym] })} aria-pressed={on}
            className={`min-h-9 rounded-xl px-3 text-xs font-bold ring-1 ${on ? "bg-violet-600 text-white ring-violet-600" : "bg-white text-slate-600 ring-slate-200"}`}>{sym}</button>; })}</div>
          <label className="mt-4 block text-xs font-bold text-slate-600">Note<input key={selected + memberId} defaultValue={entry?.note || ""} onBlur={(e) => { if (e.target.value !== (entry?.note || "")) save({ note: e.target.value.slice(0, 300) }); }} maxLength={300} placeholder="Anything to remember" className={inputClass + " mt-1.5"} /></label>
        </Panel>

        <Panel eyebrow="Your cycle" title="Averages" right={<CalendarHeart size={18} className="text-rose-500" />}>
          <dl className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl bg-slate-50 p-3"><dt className="text-[11px] font-bold text-slate-500">Cycle length</dt><dd className="text-2xl font-black">{s.cycleLength}<span className="text-sm text-slate-500"> days</span></dd></div>
            <div className="rounded-2xl bg-slate-50 p-3"><dt className="text-[11px] font-bold text-slate-500">Period length</dt><dd className="text-2xl font-black">{s.periodLength}<span className="text-sm text-slate-500"> days</span></dd></div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">{!s.fromHistory ? "Using a typical 28-day cycle until you've logged two periods." : s.regular === null ? "Log a few more periods to see how regular your cycle is." : s.regular ? "Your cycle has been regular (within a week)." : "Your cycle length has varied by more than a week. That's common, but worth mentioning to a doctor if it's new."}</p>
          {s.periods.length > 0 && <ul className="mt-3 space-y-1.5">{s.periods.slice(-5).reverse().map((p) => <li key={p.start} className="flex justify-between text-xs"><span className="font-semibold text-slate-700">{shortDate(p.start, { month: "short", day: "numeric", year: "numeric" })}</span><span className="text-slate-500">{p.days} day{p.days === 1 ? "" : "s"}</span></li>)}</ul>}
        </Panel>
        <p className="flex gap-2 rounded-2xl bg-slate-50 p-4 text-[11px] leading-5 text-slate-500"><Info size={14} className="mt-0.5 shrink-0" />Predictions are estimates from your past cycles and shouldn't be used as birth control. Talk to a doctor about very painful, very heavy, or missed periods.</p>
      </div>
    </div>
  </div>;
}
