// Today: the rhythm ribbon (the day so far, plus the predicted pee and poop windows), one-tap
// logging, what to do next for the child's stage, health flags and today's entries.
import { useState } from "react";
import { Bell, ChevronRight, Info } from "lucide-react";
import { useTick } from "../kit";
import { KINDS, labelOf, accidentFreeDays, atTime, clock12, clockOf, dayOf, dayStats, dryNights, healthFlags, isPoopEvent, minsOf, predict, stageById, stageChecks, type Entry, type Kind, type Window } from "@shared/pro/potty";
import { usePotty } from "./ctx";
import { Btn2, C, Note, Panel, Section, pct } from "./theme";

function until(ms: number) { const m = Math.round((ms - Date.now()) / 60_000); return m <= 0 ? "now" : m < 60 ? `in ${m} min` : `in ${Math.floor(m / 60)} h ${m % 60} min`; }

/** The day as a ribbon: outputs on top, food and drink below, prediction windows glowing behind. */
function Ribbon({ entries, windows, wake, bed }: { entries: Entry[]; windows: Window[]; wake: string; bed: string }) {
  const day = dayOf(Date.now());
  const start = atTime(wake, day) - 60 * 60_000, end = atTime(bed, day) + 60 * 60_000;
  const pos = (t: number) => `${Math.max(0, Math.min(100, ((t - start) / (end - start)) * 100))}%`;
  const now = Date.now();
  const hours: number[] = []; for (let h = Math.ceil(minsOf(wake) / 60 - 1); h <= Math.floor(minsOf(bed) / 60 + 1); h += 2) hours.push(h);
  const top = entries.filter((e) => KINDS[e.kind].group !== "intake" && e.kind !== "note");
  const bottom = entries.filter((e) => e.kind === "food" || e.kind === "drink");
  const Mark = ({ e }: { e: Entry }) => <span title={`${KINDS[e.kind].label} · ${clockOf(e.at)}`} className="absolute -translate-x-1/2 text-[18px] leading-none sm:text-[22px]" style={{ left: pos(e.at) }}>{KINDS[e.kind].emoji}</span>;
  return <div className="relative select-none" aria-label="Today's rhythm">
    <div className="relative h-[124px] sm:h-[136px]">
      {windows.map((w) => <div key={w.kind} className="absolute inset-y-0" style={{ left: pos(w.from), width: `calc(${pos(w.to)} - ${pos(w.from)})`, minWidth: 10 }}>
        <span aria-hidden className="pt-pulse absolute inset-0 rounded-xl" style={{ background: w.kind === "pee" ? "#FFC83D40" : "#FFC83D2A", boxShadow: `inset 0 0 0 1.5px ${C.duck}` }} />
        <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-extrabold" style={{ background: C.duck, color: C.ink }}>{w.kind === "pee" ? "💧 pee" : "💩 poop"} likely</span>
      </div>)}
      <div className="absolute inset-x-0 top-[38%] h-px bg-white/15" />
      <div className="absolute inset-x-0 top-[22%]">{top.map((e) => <Mark key={e.id} e={e} />)}</div>
      <div className="absolute inset-x-0 top-[58%]">{bottom.map((e) => <Mark key={e.id} e={e} />)}</div>
      {now > start && now < end && <div className="absolute inset-y-0 w-0.5 rounded-full" style={{ left: pos(now), background: "#fff" }}><span className="absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full whitespace-nowrap text-[11px] font-bold text-white/80">now</span></div>}
    </div>
    <div className="relative mt-5 h-4 text-[11px] text-white/55">{hours.map((h) => { const t = atTime(`${String(((h % 24) + 24) % 24).padStart(2, "0")}:00`, day); return t >= start && t <= end ? <span key={h} className="absolute -translate-x-1/2" style={{ left: pos(t) }}>{h % 12 || 12}{h < 12 || h === 24 ? "a" : "p"}</span> : null; })}</div>
  </div>;
}

const QUICK: { kind: Kind; label: string; sheet?: boolean; pre?: Partial<Entry>; emoji?: string }[] = [
  { kind: "pee", label: "Pee in potty" }, { kind: "poop", label: "Poop in potty" }, { kind: "both", label: "Both" }, { kind: "try", label: "Sat, nothing" },
  { kind: "acc-pee", label: "Pee accident" }, { kind: "acc-poop", label: "Poop accident" }, { kind: "drink", label: "Bottle", sheet: true, pre: { drink: "bottle" }, emoji: "🍼" }, { kind: "drink", label: "Juice", sheet: true, pre: { drink: "juice" }, emoji: "🧃" },
  { kind: "drink", label: "Drink", sheet: true }, { kind: "food", label: "Food", sheet: true },
];

export default function Today() {
  const { data, set, kid, log, openLog, startSit, go } = usePotty();
  const [self, setSelf] = useState(false);
  useTick(true, 30_000);
  const today = dayOf(Date.now());
  const entries = data.logs.filter((x) => x.kid === kid.id && dayOf(x.at) === today).sort((a, b) => a.at - b.at);
  const windows = predict(data.logs, kid);
  const s = dayStats(data.logs, kid.id, today);
  const flags = healthFlags(data.logs, kid.id);
  const stage = stageById(kid.stage);
  const checks = stageChecks(kid.stage, data.logs, kid.id, (data.ready[kid.id] || []).length);
  const doneSteps = data.done[kid.id] || [];
  const nextSteps = stage.steps.map((st, i) => ({ st, key: `${stage.id}:${i}` })).filter((x) => !doneSteps.includes(x.key)).slice(0, 3);
  const remind = (w: Window) => set((d) => ({ ...d, timer: { kid: kid.id, endAt: Math.max(Date.now() + 60_000, w.from - 5 * 60_000), minutes: Math.max(5, Math.round((w.from - Date.now()) / 60_000)) } }));
  const hello = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  return <div className="space-y-7">
    {/* Hero: the day's rhythm */}
    <Panel tone="night" className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm text-white/60">{hello} · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{kid.name}'s day</h1></div>
        <div className="flex gap-4 text-right">
          <div><p className="ph text-3xl font-extrabold" style={{ color: C.duck }}>{s.successes}</p><p className="text-xs text-white/60">in the potty</p></div>
          <div><p className="ph text-3xl font-extrabold">{s.accidents}</p><p className="text-xs text-white/60">accidents</p></div>
        </div>
      </div>
      <div className="mt-9"><Ribbon entries={entries} windows={windows} wake={kid.routine.wake} bed={kid.routine.bed} /></div>
      {windows.length > 0 ? <div className="mt-5 grid gap-2 sm:grid-cols-2">{windows.map((w) => <div key={w.kind} className="rounded-2xl bg-white/[.07] p-3.5">
        <div className="flex items-start justify-between gap-2"><p className="font-extrabold"><span className="mr-1">{w.kind === "pee" ? "💧" : "💩"}</span>{w.kind === "pee" ? "Pee" : "Poop"} likely {clock12(new Date(w.from).toTimeString().slice(0, 5))}–{clock12(new Date(w.to).toTimeString().slice(0, 5))}</p><span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: C.duck, color: C.ink }}>{until(w.from)}</span></div>
        <p className="mt-1 text-[13px] leading-snug text-white/65">Because {w.why}.{w.confidence === "learning" ? " Still learning your child's pattern." : ""}</p>
        <button type="button" onClick={() => remind(w)} className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: C.duck }}><Bell size={14} />Remind me 5 minutes before</button>
      </div>)}</div> : <p className="mt-5 text-sm text-white/60">Sleep time — no predictions until {clock12(kid.routine.wake)}.</p>}
    </Panel>

    {/* Logging */}
    <Section title="Log it" sub="One tap. Use “More” for any time, poop type, drink size or notes." action={<label className="inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-bold" style={{ background: self ? C.good : "#fff", color: self ? "#fff" : C.inkSoft, boxShadow: self ? undefined : `inset 0 0 0 1.5px ${C.line}` }}><input type="checkbox" checked={self} onChange={(e) => setSelf(e.target.checked)} className="sr-only" />🙋 {kid.name} started this trip</label>}>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-10">{QUICK.map((q) => <button key={q.label} type="button" onClick={() => { if (q.sheet) openLog({ kind: q.kind, ...q.pre }); else { log(q.kind, { init: self ? "self" : "" }); setSelf(false); } }}
        className="group flex min-h-[92px] flex-col items-center justify-center gap-1 rounded-[20px] bg-white px-1 py-3 text-center transition active:scale-95" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}` }}>
        <span className="flex h-11 w-11 items-center justify-center rounded-full text-2xl" style={{ background: `${KINDS[q.kind].color}1F` }}>{q.emoji || KINDS[q.kind].emoji}</span>
        <span className="text-[12px] font-bold leading-tight" style={{ color: C.ink }}>{q.label}</span></button>)}</div>
      <div className="mt-3 flex flex-wrap gap-2"><Btn2 kind="duck" onClick={startSit}>▶ Start a sit</Btn2><Btn2 onClick={() => go("agenda")}>🗒️ Agenda</Btn2><Btn2 onClick={() => openLog({})}>More…</Btn2><Btn2 kind="ghost" onClick={() => log("dry")}>✅ Dry check</Btn2><Btn2 kind="ghost" onClick={() => openLog({ kind: "diaper-wet" })}>🩲 Diaper</Btn2><Btn2 kind="ghost" onClick={() => openLog({ kind: "night-dry" })}>🌙 Night / nap</Btn2></div>
    </Section>

    {flags.filter((f) => f.level !== "info").length > 0 && <Section title="Worth a look">
      <div className="space-y-2">{flags.filter((f) => f.level !== "info").map((f) => <Note key={f.title} tone={f.level === "doctor" ? "doctor" : "warn"}><b>{f.title}.</b> {f.text} {f.article && <button type="button" onClick={() => go("learn", `a:${f.article}`)} className="font-bold underline">Read more</button>}</Note>)}</div>
    </Section>}

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* Stage */}
      <Section title={<span>{stage.emoji} {stage.title}</span>} sub={stage.summary} action={<Btn2 onClick={() => go("plan")}>Open the plan <ChevronRight size={15} /></Btn2>}>
        <Panel>
          <div className="space-y-2">{checks.map((c) => <div key={c.id} className="flex items-center gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold" style={{ background: c.met ? C.good : "#E8ECF4", color: c.met ? "#fff" : C.muted }}>{c.met ? "✓" : ""}</span><span className="flex-1 text-sm font-bold">{c.text}</span><span className="text-xs" style={{ color: C.muted }}>{c.detail}</span></div>)}</div>
          {checks.length > 0 && checks.every((c) => c.met) && <Note tone="tip">Looks ready for the next stage — open the plan to move on.</Note>}
          <p className="mb-2 mt-4 text-[13px] font-bold" style={{ color: C.muted }}>Next steps</p>
          <ol className="space-y-2">{nextSteps.map(({ st, key }) => <li key={key} className="flex gap-3"><button type="button" aria-label="Mark done" onClick={() => set((d) => ({ ...d, done: { ...d.done, [kid.id]: [...(d.done[kid.id] || []), key] } }))} className="mt-0.5 h-5 w-5 shrink-0 rounded-md" style={{ boxShadow: `inset 0 0 0 2px ${C.line}` }} /><span className="text-sm leading-snug">{st.t}</span></li>)}</ol>
          {!nextSteps.length && <p className="text-sm" style={{ color: C.muted }}>All steps checked for this stage.</p>}
        </Panel>
      </Section>
      {/* Today's numbers + entries */}
      <Section title="Today so far" action={<Btn2 kind="ghost" onClick={() => go("log")}>All views <ChevronRight size={15} /></Btn2>}>
        <div className="mb-3 grid grid-cols-3 gap-2">{[["Success", pct(s.rate)], ["Self-started", pct(s.selfRate)], ["Drinks", data.units === "oz" ? `${Math.round(s.drinksMl / 29.57)} oz` : `${s.drinksMl} ml`], ["Poops", String(s.poops)], ["No-accident days", String(accidentFreeDays(data.logs, kid.id))], ["Dry nights", String(dryNights(data.logs, kid.id))]].map(([l, v]) => <div key={l} className="rounded-2xl bg-white px-3 py-2.5" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}` }}><p className="ph text-xl font-extrabold">{v}</p><p className="text-[11px] font-bold" style={{ color: C.muted }}>{l}</p></div>)}</div>
        {entries.length ? <ul className="divide-y divide-[#E3E8F1] overflow-hidden rounded-[22px] bg-white" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}` }}>{[...entries].reverse().map((e) => <li key={e.id}><button type="button" onClick={() => openLog({ edit: e })} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
          <span className="w-16 text-[13px] font-bold tabular-nums" style={{ color: C.muted }}>{clockOf(e.at)}</span><span className="text-xl">{KINDS[e.kind].emoji}</span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{labelOf(e, KINDS[e.kind].label)}{e.kind === "drink" && e.ml ? ` · ${data.units === "oz" ? `${Math.round(e.ml / 29.57)} oz` : `${e.ml} ml`}` : ""}{isPoopEvent(e.kind) && e.bristol ? ` · type ${e.bristol}` : ""}</span>{(e.note || e.init === "self") && <span className="block text-xs leading-snug" style={{ color: C.muted }}>{e.init === "self" ? "Started by your child. " : ""}{e.note}</span>}</span>
        </button></li>)}</ul> : <p className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm" style={{ color: C.muted, boxShadow: `inset 0 0 0 1.5px ${C.line}` }}><Info size={15} />Nothing logged yet today. Log drinks and meals too — that's how the predictions learn.</p>}
      </Section>
    </div>
  </div>;
}
