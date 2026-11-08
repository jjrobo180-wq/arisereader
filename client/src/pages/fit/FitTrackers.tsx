// Two Arise Fit health plugins: the Medicine tracker (shared/fitMeds.ts) and the Period tracker
// (shared/fitCycle.ts). Both keep their records with the rest of a person's Arise Fit data.
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Pencil, Pill, Plus, SkipForward, Trash2, TriangleAlert, Undo2, X } from "lucide-react";
import { dayKey, uid, type FitData } from "@shared/fit";
import { MED_COLORS, adherence, daysLeft, dosesOn, markDose, needsRefill, type FitMed } from "@shared/fitMeds";
import { FLOWS, SYMPTOMS, entryOn, setEntry, summaryOf, type CycleEntry } from "@shared/fitCycle";
import type { Flow } from "@shared/familyHub";
import { Btn, C, Card, Field, Sheet, Title, display, haptic, inputCls, inputStyle } from "./fitUi";
import { applyMedReminders } from "./fitNative";
import type { Update } from "./fitStore";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const clock12 = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const shift = (day: string, n: number) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + n); return dayKey(d); };
const pretty = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const chip = (on: boolean, color = C.lime) => ({ background: on ? color : C.card2, color: on ? "var(--fit-on-accent)" : C.text }) as React.CSSProperties;

// ——— Medicine tracker ——————————————————————————————————————————————————————
export function MedsApp({ data, update, say, inline, onClose }: { data: FitData; update: Update; say: (m: string) => void; inline?: boolean; onClose: () => void }) {
  const today = dayKey();
  const [date, setDate] = useState(today);
  const [editing, setEditing] = useState<FitMed | null>(null);
  const meds = data.meds;
  const list = meds?.list ?? [];
  const doses = dosesOn(meds, date);
  const week = adherence(meds, today, 7);
  const low = list.filter(needsRefill);
  const set = (fn: (m: NonNullable<FitData["meds"]>) => NonNullable<FitData["meds"]>) => update((d) => ({ ...d, meds: fn(d.meds ?? { list: [], log: {} }) }));
  const mark = (id: string, time: string, status: "taken" | "skipped" | null) => { haptic(status === "taken" ? "success" : "light"); update((d) => ({ ...d, meds: markDose(d.meds, id, date, time, status) })); };
  // Dose reminders follow the medicines (the iPhone app only; nothing happens in a browser).
  const sig = JSON.stringify(list.map((m) => [m.name, m.dose, m.times, m.days, m.remind]));
  useEffect(() => { if (list.length || sig !== "[]") void applyMedReminders(list); }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const blank = (): FitMed => ({ id: uid(), name: "", dose: "", times: ["08:00"], days: [0, 1, 2, 3, 4, 5, 6], note: "", supply: null, refillDays: 7, remind: true, color: MED_COLORS[list.length % MED_COLORS.length] });
  const save = (m: FitMed) => { set((x) => ({ ...x, list: x.list.some((y) => y.id === m.id) ? x.list.map((y) => (y.id === m.id ? m : y)) : [...x.list, m] })); setEditing(null); say(`${m.name} saved.`); };
  const remove = (id: string) => { set((x) => ({ ...x, list: x.list.filter((y) => y.id !== id) })); setEditing(null); };
  const taken = doses.filter((d) => d.status === "taken").length;

  return <Sheet title="Medicine" onClose={onClose} inline={inline} testId="fit-meds" right={<button type="button" onClick={() => setEditing(blank())} className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.lime, color: "var(--fit-on-accent)" }} aria-label="Add a medicine" data-testid="fit-meds-add"><Plus className="h-5 w-5" /></button>}>
    <div className="flex items-center justify-between gap-2">
      <button type="button" onClick={() => setDate(shift(date, -1))} aria-label="Day before" className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card }}><ChevronLeft className="h-5 w-5" /></button>
      <button type="button" onClick={() => setDate(today)} className="text-[17px] font-semibold">{date === today ? "Today" : pretty(date)}</button>
      <button type="button" onClick={() => setDate(shift(date, 1))} aria-label="Day after" className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card }}><ChevronRight className="h-5 w-5" /></button>
    </div>
    {low.length > 0 && <Card className="mt-3 !p-3" style={{ background: "rgba(251,191,36,.14)" }} testId="fit-meds-low"><div className="flex items-start gap-2 text-[14px]"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: C.orange }} /><span>{low.map((m) => `${m.name}: about ${daysLeft(m)} day${daysLeft(m) === 1 ? "" : "s"} left`).join(" · ")}. Time to refill.</span></div></Card>}
    <Card className="mt-3" testId="fit-meds-today">
      <div className="flex items-baseline justify-between"><span className="text-[13px]" style={{ ...display, color: C.dim }}>{date === today ? "TODAY'S DOSES" : "DOSES"}</span><span className="text-[14px]" style={{ color: C.dim }}>{doses.length ? `${taken} of ${doses.length} taken` : ""}</span></div>
      {doses.length ? <ul className="mt-2 divide-y" style={{ borderColor: C.line }}>{doses.map((d) => <li key={d.med.id + d.time} className="flex items-center gap-3 py-3" data-testid="fit-meds-dose">
        <span aria-hidden className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: d.med.color }} />
        <div className="min-w-0 flex-1"><div className="truncate text-[16px] font-semibold" style={d.status === "skipped" ? { textDecoration: "line-through", color: C.dim } : undefined}>{d.med.name}{d.med.dose ? <span className="font-normal" style={{ color: C.dim }}> · {d.med.dose}</span> : null}</div><div className="text-[13px]" style={{ color: C.dim }}>{clock12(d.time)}{d.status === "taken" ? " · taken" : d.status === "skipped" ? " · skipped" : ""}</div></div>
        {d.status ? <button type="button" onClick={() => mark(d.med.id, d.time, null)} aria-label="Undo" className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card2 }}><Undo2 className="h-5 w-5" /></button>
          : <><button type="button" onClick={() => mark(d.med.id, d.time, "skipped")} aria-label={`Skip ${d.med.name}`} className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card2, color: C.dim }}><SkipForward className="h-5 w-5" /></button>
            <button type="button" onClick={() => mark(d.med.id, d.time, "taken")} aria-label={`Taken: ${d.med.name}`} className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.lime, color: "var(--fit-on-accent)" }} data-testid="fit-meds-take"><Check className="h-5 w-5" /></button></>}
      </li>)}</ul> : <p className="py-5 text-center text-[14px]" style={{ color: C.dim }}>{list.length ? "Nothing due this day." : "Add a medicine or vitamin to get dose reminders and a tick-off list."}</p>}
    </Card>
    {list.length > 0 && <>
      <Title right={<span className="text-[13px]" style={{ color: C.dim }}>{week.due ? `${week.pct}% this week` : ""}</span>}>Your medicines</Title>
      <div className="space-y-2">{list.map((m) => { const left = daysLeft(m); return <Card key={m.id} onClick={() => setEditing(m)} className="!p-3" testId="fit-meds-row"><div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: m.color + "33", color: m.color }}><Pill className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="truncate text-[16px] font-semibold">{m.name}</div><div className="truncate text-[13px]" style={{ color: C.dim }}>{m.times.map(clock12).join(", ")} · {m.days.length === 7 ? "every day" : m.days.map((d) => DAY_LETTERS[d]).join(" ")}{left !== null ? ` · ${m.supply} left` : ""}</div></div><Pencil className="h-4 w-4" style={{ color: C.dim }} /></div></Card>; })}</div>
    </>}
    <p className="mt-4 px-1 text-[12px]" style={{ color: C.dim }}>Reminders come from the iPhone app. This is a helper, not medical advice: follow what your doctor and pharmacist tell you.</p>
    {editing && <MedEditor med={editing} isNew={!list.some((x) => x.id === editing.id)} onSave={save} onDelete={() => remove(editing.id)} onClose={() => setEditing(null)} />}
  </Sheet>;
}

function MedEditor({ med, isNew, onSave, onDelete, onClose }: { med: FitMed; isNew: boolean; onSave: (m: FitMed) => void; onDelete: () => void; onClose: () => void }) {
  const [m, setM] = useState(med);
  const setTime = (i: number, t: string) => setM({ ...m, times: m.times.map((x, j) => (j === i ? t : x)) });
  const toggleDay = (d: number) => setM({ ...m, days: m.days.includes(d) ? m.days.filter((x) => x !== d) : [...m.days, d].sort() });
  const ok = m.name.trim() && m.times.length && m.days.length;
  return <Sheet title={isNew ? "Add medicine" : "Edit medicine"} onClose={onClose} testId="fit-med-editor">
    <div className="space-y-4 pb-6">
      <Field label="Name"><input value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} placeholder="Vitamin D" maxLength={80} className={inputCls} style={inputStyle} data-testid="fit-med-name" /></Field>
      <Field label="Dose (optional)"><input value={m.dose} onChange={(e) => setM({ ...m, dose: e.target.value })} placeholder="1 tablet, 500 mg" maxLength={40} className={inputCls} style={inputStyle} /></Field>
      <Field label="Times each day">
        <div className="space-y-2">{m.times.map((t, i) => <div key={i} className="flex gap-2"><input type="time" value={t} onChange={(e) => setTime(i, e.target.value)} className={inputCls} style={inputStyle} />{m.times.length > 1 && <button type="button" aria-label="Remove time" onClick={() => setM({ ...m, times: m.times.filter((_, j) => j !== i) })} className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px]" style={{ background: C.card2 }}><X className="h-5 w-5" /></button>}</div>)}
          {m.times.length < 4 && <Btn kind="soft" className="w-full" onClick={() => setM({ ...m, times: [...m.times, "20:00"] })}><Plus className="h-4 w-4" /> Another time</Btn>}</div>
      </Field>
      <Field label="Days"><div className="flex gap-1.5">{DAY_LETTERS.map((l, d) => <button key={d} type="button" onClick={() => toggleDay(d)} aria-pressed={m.days.includes(d)} aria-label={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d]} className="grid h-11 min-w-0 flex-1 place-items-center rounded-full text-[15px] font-semibold" style={chip(m.days.includes(d))}>{l}</button>)}</div></Field>
      <Field label="Pills left (optional)"><input type="number" inputMode="numeric" min={0} value={m.supply ?? ""} onChange={(e) => setM({ ...m, supply: e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))) })} placeholder="Leave empty to skip counting" className={inputCls} style={inputStyle} /></Field>
      {m.supply !== null && <Field label="Warn me when this many days are left"><input type="number" inputMode="numeric" min={1} max={60} value={m.refillDays} onChange={(e) => setM({ ...m, refillDays: Math.max(1, Math.min(60, Math.round(Number(e.target.value)) || 7)) })} className={inputCls} style={inputStyle} /></Field>}
      <label className="flex min-h-12 items-center justify-between gap-3 text-[16px]"><span>Remind me at each time</span><input type="checkbox" className="h-6 w-6" checked={m.remind} onChange={(e) => setM({ ...m, remind: e.target.checked })} /></label>
      <Field label="Note (optional)"><input value={m.note} onChange={(e) => setM({ ...m, note: e.target.value })} placeholder="With food" maxLength={200} className={inputCls} style={inputStyle} /></Field>
      <Field label="Color"><div className="flex flex-wrap gap-2">{MED_COLORS.map((c) => <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => setM({ ...m, color: c })} className="h-9 w-9 rounded-full" style={{ background: c, boxShadow: m.color === c ? `0 0 0 3px ${C.bg}, 0 0 0 5px ${c}` : undefined }} />)}</div></Field>
      <Btn className="w-full" disabled={!ok} onClick={() => onSave({ ...m, name: m.name.trim() })} testId="fit-med-save">Save</Btn>
      {!isNew && <Btn kind="danger" className="w-full" onClick={onDelete}><Trash2 className="h-4 w-4" /> Delete</Btn>}
    </div>
  </Sheet>;
}

// ——— Period tracker ————————————————————————————————————————————————————————
const FLOW_LABEL: Record<Flow, string> = { none: "None", spotting: "Spotting", light: "Light", medium: "Medium", heavy: "Heavy" };
export function PeriodApp({ data, update, say, inline, onClose }: { data: FitData; update: Update; say: (m: string) => void; inline?: boolean; onClose: () => void }) {
  const today = dayKey();
  const [date, setDate] = useState(today);
  const cycle = data.cycle;
  const s = useMemo(() => summaryOf(cycle, today), [cycle, today]);
  const entry = entryOn(cycle, date);
  const save = (patch: Partial<CycleEntry>) => update((d) => ({ ...d, cycle: setEntry(d.cycle, { ...entryOn(d.cycle, date), ...patch }) }));
  const [note, setNote] = useState(entry.note);
  useEffect(() => setNote(entryOn(cycle, date).note), [date]); // eslint-disable-line react-hooks/exhaustive-deps
  const days = Array.from({ length: 14 }, (_, i) => shift(today, i - 10));
  const phaseWord = s.phase === "period" ? "Period" : s.phase === "fertile" ? "Fertile window" : s.phase === "follicular" ? "Before the fertile window" : s.phase === "luteal" ? "After ovulation" : "";
  const nextLine = s.nextStart ? (s.late ? `${s.late} day${s.late === 1 ? "" : "s"} later than expected` : s.daysUntil === 0 ? "Expected today" : `Expected in ${s.daysUntil} day${s.daysUntil === 1 ? "" : "s"} (${pretty(s.nextStart)})`) : "Log the first day of your period to see predictions.";

  return <Sheet title="Period" onClose={onClose} inline={inline} testId="fit-period">
    <Card testId="fit-period-summary">
      <div className="text-[13px]" style={{ ...display, color: C.dim }}>{s.dayOfCycle ? `CYCLE DAY ${s.dayOfCycle}` : "YOUR CYCLE"}</div>
      <div className="mt-1 text-[24px] leading-tight" style={display}>{phaseWord || "No periods logged yet"}</div>
      <p className="mt-1 text-[15px]" style={{ color: C.dim }}>{nextLine}</p>
      {s.fertileStart && s.fertileEnd && <p className="mt-1 text-[14px]" style={{ color: C.dim }}>Fertile window {pretty(s.fertileStart)} to {pretty(s.fertileEnd)}. {s.fromHistory ? `Average cycle ${s.cycleLength} days.` : "Using a 28-day cycle until you've logged a few."}</p>}
      <Btn className="mt-3 w-full" onClick={() => { haptic("success"); setDate(today); save({ flow: entryOn(cycle, today).flow === "none" ? "medium" : entryOn(cycle, today).flow }); say("Period logged for today."); }} testId="fit-period-start"><Plus className="h-4 w-4" /> Period started today</Btn>
    </Card>
    <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Pick a day">
      {days.map((d) => { const e = entryOn(cycle, d), on = d === date; return <button key={d} type="button" onClick={() => setDate(d)} aria-pressed={on} className="flex w-12 shrink-0 flex-col items-center gap-1 rounded-[14px] py-2" style={{ background: on ? C.lime : C.card, color: on ? "var(--fit-on-accent)" : C.text }}>
        <span className="text-[11px] font-semibold">{new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" })}</span>
        <span className="text-[16px] font-semibold">{Number(d.slice(8))}</span>
        <span className="h-2 w-2 rounded-full" style={{ background: e.flow !== "none" ? C.pink : e.symptoms.length ? C.orange : "transparent" }} />
      </button>; })}
    </div>
    <Card className="mt-3" testId="fit-period-day">
      <div className="text-[17px] font-semibold">{date === today ? "Today" : pretty(date)}</div>
      <Field label="Flow"><div className="mt-1 grid grid-cols-5 gap-1.5">{(["none", ...FLOWS] as Flow[]).map((f) => <button key={f} type="button" onClick={() => { haptic("light"); save({ flow: f }); }} aria-pressed={entry.flow === f} className="min-h-11 rounded-[12px] px-1 text-[12.5px] font-semibold" style={chip(entry.flow === f, C.pink)} data-testid={`fit-flow-${f}`}>{FLOW_LABEL[f]}</button>)}</div></Field>
      <Field label="How you feel"><div className="mt-1 flex flex-wrap gap-1.5">{SYMPTOMS.map((x) => { const on = entry.symptoms.includes(x); return <button key={x} type="button" onClick={() => save({ symptoms: on ? entry.symptoms.filter((y) => y !== x) : [...entry.symptoms, x] })} aria-pressed={on} className="min-h-10 rounded-full px-3 text-[14px] font-semibold" style={chip(on, C.orange)}>{x}</button>; })}</div></Field>
      <Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== entry.note && save({ note })} placeholder="Anything to remember" maxLength={300} className={inputCls} style={inputStyle} /></Field>
    </Card>
    <p className="mt-4 px-1 text-[12px]" style={{ color: C.dim }}>Predictions are estimates from your own history, for planning. They are not birth control or medical advice. Your records stay in your Arise Fit account.</p>
  </Sheet>;
}
