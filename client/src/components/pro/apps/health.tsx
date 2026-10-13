// Health apps: trackers for water, sleep, weight, steps, blood pressure, symptoms, food and
// caffeine; a medication schedule; a screen-break timer; first aid; medical ID cards; doctor
// visits; health calculators; and a toothbrush timer for kids.
import { useEffect, useState, type ComponentType } from "react";
import { Check, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";
import { LogTracker, type Entry, type TrackerConfig } from "../LogTracker";
import { SequencePlayer } from "../Sequence";
import { Btn, Card, Empty, Field, Modal, NumIn, Stat, Tabs, addDays, beep, chime, esc, fmtDay, fmtDuration, fmtNum, fmtTime, fit, inputCls, lastDays, printPage, today, uid, usePro, useTick, useWakeLock, speak } from "../kit";

const minutes = (hhmm: string) => { const [h, m] = (hhmm || "").split(":").map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : NaN; };
const sleepHours = (e: Entry) => { const b = minutes(e.bed), w = minutes(e.wake); if (!Number.isFinite(b) || !Number.isFinite(w)) return 0; let d = w - b; if (d <= 0) d += 1440; return d / 60; };
const QUALITY = ["😫", "😕", "😐", "🙂", "😄"];

const WATER: TrackerConfig = {
  app: "water", color: "#0ea5e9", entryName: "drink",
  fields: [{ key: "oz", label: "Amount", type: "number", unit: "oz", min: 1, max: 200 }, { key: "drink", label: "Drink", type: "select", options: ["Water", "Sparkling water", "Tea", "Milk", "Juice", "Other"], default: "Water" }],
  metric: { label: "Water", unit: "oz", agg: "sum", value: (e) => Number(e.oz) || 0 },
  goal: { default: 64, label: "Daily goal (oz)" },
  quick: [{ label: "🥛 Glass · 8 oz", values: { oz: 8, drink: "Water" } }, { label: "🥤 Can · 12 oz", values: { oz: 12, drink: "Water" } }, { label: "🍶 Bottle · 16.9 oz", values: { oz: 16.9, drink: "Water" } }, { label: "🧴 Big bottle · 32 oz", values: { oz: 32, drink: "Water" } }],
  describe: (e) => <><b>{fmtNum(Number(e.oz), 1)} oz</b> {e.drink && e.drink !== "Water" ? <span className="text-slate-500">· {e.drink}</span> : null}</>,
  tips: ["A common goal is about half your body weight (lb) in ounces each day.", "Drink more when it's hot or you exercise.", "Pale yellow is the colour to aim for."],
};
const SLEEP: TrackerConfig = {
  app: "sleep", color: "#6366f1", entryName: "night",
  fields: [{ key: "bed", label: "Went to bed", type: "time", default: "22:30", half: true }, { key: "wake", label: "Woke up", type: "time", default: "06:30", half: true }, { key: "quality", label: "How rested do you feel?", type: "scale", min: 1, max: 5, options: QUALITY, default: 4 }, { key: "notes", label: "Notes", type: "text", optional: true, placeholder: "Woke up at 3, late coffee…" }],
  metric: { label: "Sleep", unit: "hours", agg: "sum", decimals: 1, value: (e) => sleepHours(e) },
  goal: { default: 8, label: "Hours of sleep to aim for" },
  describe: (e) => <><b>{fmtNum(sleepHours(e), 1)} h</b> <span className="text-slate-500">· {fmtTime(e.bed)} → {fmtTime(e.wake)} {QUALITY[(e.quality || 3) - 1]}</span></>,
  extraStats: (entries) => {
    const recent = entries.filter((e) => e.date >= addDays(today(), -14));
    const beds = recent.map((e) => { const m = minutes(e.bed); return m < 720 ? m + 1440 : m; }).filter(Number.isFinite);
    const avg = beds.length ? beds.reduce((a, b) => a + b, 0) / beds.length : NaN;
    const sd = beds.length > 1 ? Math.sqrt(beds.reduce((a, b) => a + (b - avg) ** 2, 0) / beds.length) : NaN;
    const q = recent.map((e) => Number(e.quality)).filter((n) => n > 0);
    const hhmm = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
    return [
      { label: "Usual bedtime", value: Number.isFinite(avg) ? fmtTime(hhmm(avg)) : "—", sub: Number.isFinite(sd) ? `± ${Math.round(sd)} min` : undefined },
      { label: "Rested", value: q.length ? QUALITY[Math.round(q.reduce((a, b) => a + b, 0) / q.length) - 1] : "—", sub: "last 2 weeks" },
    ];
  },
  tips: ["Adults need 7–9 hours; teens 8–10; kids 9–12.", "Going to bed at the same time each night matters as much as how long you sleep.", "Screens off 30 minutes before bed helps you fall asleep faster."],
};
const WEIGHT: TrackerConfig = {
  app: "weight", color: "#0d9488", entryName: "weigh-in", chart: "line",
  fields: [{ key: "lb", label: "Weight", type: "number", unit: "lb", min: 20, max: 1000, step: 0.1 }, { key: "waist", label: "Waist", type: "number", unit: "in", optional: true, step: 0.1 }, { key: "notes", label: "Notes", type: "text", optional: true }],
  metric: { label: "Weight", unit: "lb", agg: "last", decimals: 1, value: (e) => Number(e.lb) || 0 },
  goal: { default: 160, label: "Goal weight (lb)", higherIsBetter: false },
  settings: [{ key: "height", label: "Height", type: "number", unit: "in", default: 66 }],
  describe: (e) => <><b>{fmtNum(Number(e.lb), 1)} lb</b>{e.waist ? <span className="text-slate-500"> · waist {e.waist} in</span> : null}</>,
  extraStats: (entries, s) => {
    const sorted = [...entries].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const last = sorted[sorted.length - 1];
    const at = (days: number) => [...sorted].reverse().find((e) => e.date <= addDays(today(), -days));
    const bmi = last && s.height ? (703 * Number(last.lb)) / Number(s.height) ** 2 : NaN;
    const w7 = at(7), w30 = at(30);
    const cat = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Healthy range" : bmi < 30 ? "Overweight" : "Obesity range";
    return [
      { label: "BMI", value: Number.isFinite(bmi) ? fmtNum(bmi, 1) : "—", sub: Number.isFinite(bmi) ? cat : "add your height in Settings" },
      { label: "7-day change", value: last && w7 ? `${Number(last.lb) - Number(w7.lb) > 0 ? "+" : ""}${fmtNum(Number(last.lb) - Number(w7.lb), 1)}` : "—", sub: "lb" },
      { label: "30-day change", value: last && w30 ? `${Number(last.lb) - Number(w30.lb) > 0 ? "+" : ""}${fmtNum(Number(last.lb) - Number(w30.lb), 1)}` : "—", sub: "lb" },
    ];
  },
  tips: ["Weigh at the same time of day, ideally after waking.", "Daily weight bounces 1–3 lb with water and food — watch the weekly trend.", "A steady 0.5–2 lb a week is a healthy pace."],
};
const STEPS: TrackerConfig = {
  app: "steps", color: "#16a34a", entryName: "day",
  fields: [{ key: "steps", label: "Steps", type: "number", min: 0, max: 200000 }, { key: "active", label: "Active minutes", type: "number", optional: true }, { key: "what", label: "What you did", type: "text", optional: true, placeholder: "Walk with the dog, PE…" }],
  metric: { label: "Steps", unit: "steps", agg: "sum", value: (e) => Number(e.steps) || 0 },
  goal: { default: 8000, label: "Daily step goal" },
  quick: [{ label: "+1,000", values: { steps: 1000 } }, { label: "+2,500", values: { steps: 2500 } }, { label: "+5,000", values: { steps: 5000 } }],
  describe: (e) => <><b>{fmtNum(Number(e.steps), 0)} steps</b>{e.active ? <span className="text-slate-500"> · {e.active} active min</span> : null}{e.what ? <span className="text-slate-500"> · {e.what}</span> : null}</>,
  extraStats: (entries) => { const wk = entries.filter((e) => e.date >= addDays(today(), -6)).reduce((a, e) => a + (Number(e.steps) || 0), 0); return [{ label: "This week", value: fmtNum(wk, 0), sub: `≈ ${fmtNum(wk / 2000, 1)} miles` }]; },
  tips: ["About 2,000 steps is a mile.", "150 active minutes a week is the adult guideline."],
};
const bpClass = (sys: number, dia: number) => (sys >= 180 || dia >= 120 ? { label: "Crisis — get help", color: "#7f1d1d" } : sys >= 140 || dia >= 90 ? { label: "Stage 2", color: "#dc2626" } : sys >= 130 || dia >= 80 ? { label: "Stage 1", color: "#f97316" } : sys >= 120 ? { label: "Elevated", color: "#eab308" } : { label: "Normal", color: "#16a34a" });
const BP: TrackerConfig = {
  app: "bp", color: "#dc2626", entryName: "reading", chart: "line",
  fields: [{ key: "sys", label: "Systolic (top)", type: "number", min: 60, max: 260, half: true }, { key: "dia", label: "Diastolic (bottom)", type: "number", min: 30, max: 160, half: true }, { key: "pulse", label: "Pulse", type: "number", unit: "bpm", optional: true, half: true }, { key: "arm", label: "Arm", type: "select", options: ["Left", "Right"], default: "Left", half: true }, { key: "notes", label: "Notes", type: "text", optional: true }],
  metric: { label: "Systolic", unit: "mmHg", agg: "avg", value: (e) => Number(e.sys) || 0 },
  classify: (e) => bpClass(Number(e.sys), Number(e.dia)),
  describe: (e) => <><b>{e.sys}/{e.dia}</b> <span className="text-slate-500">mmHg{e.pulse ? ` · ${e.pulse} bpm` : ""}{e.arm ? ` · ${e.arm.toLowerCase()} arm` : ""}</span></>,
  extraStats: (entries) => {
    const r = entries.filter((e) => e.date >= addDays(today(), -13));
    if (!r.length) return [{ label: "2-week average", value: "—" }];
    const s = Math.round(r.reduce((a, e) => a + Number(e.sys), 0) / r.length), d = Math.round(r.reduce((a, e) => a + Number(e.dia), 0) / r.length);
    const am = r.filter((e) => e.time < "12:00"), pm = r.filter((e) => e.time >= "12:00");
    const avg = (l: Entry[]) => (l.length ? `${Math.round(l.reduce((a, e) => a + Number(e.sys), 0) / l.length)}/${Math.round(l.reduce((a, e) => a + Number(e.dia), 0) / l.length)}` : "—");
    return [{ label: "2-week average", value: `${s}/${d}`, sub: bpClass(s, d).label }, { label: "Morning / evening", value: <span className="text-base">{avg(am)} · {avg(pm)}</span> }];
  },
  tips: ["Sit quietly for 5 minutes first, feet flat, arm at heart level.", "Take two readings a minute apart and log both.", "Over 180/120 with symptoms like chest pain or trouble speaking: call 911."],
};
const SYMPTOMS: TrackerConfig = {
  app: "symptoms", color: "#f97316", entryName: "symptom",
  fields: [{ key: "what", label: "Symptom", type: "text", placeholder: "Headache, stomach ache, cough…" }, { key: "sev", label: "How bad? (1–10)", type: "scale", min: 1, max: 10, default: 5 }, { key: "triggers", label: "Possible triggers", type: "chips", options: ["Poor sleep", "Stress", "Food", "Weather", "Screen time", "Exercise", "Missed meal", "Caffeine", "Allergies", "Period"] }, { key: "took", label: "What helped / medicine taken", type: "text", optional: true }, { key: "notes", label: "Notes", type: "text", optional: true }],
  metric: { label: "Worst severity", unit: "/10", agg: "max", value: (e) => Number(e.sev) || 0 },
  classify: (e) => (Number(e.sev) >= 8 ? { label: "Severe", color: "#dc2626" } : Number(e.sev) >= 5 ? { label: "Moderate", color: "#f97316" } : { label: "Mild", color: "#16a34a" }),
  describe: (e) => <><b>{e.what || "Symptom"}</b> <span className="text-slate-500">· {e.sev}/10{e.triggers?.length ? ` · ${e.triggers.join(", ")}` : ""}{e.took ? ` · ${e.took}` : ""}</span></>,
  extraStats: (entries) => {
    const c = new Map<string, number>(), t = new Map<string, number>();
    for (const e of entries.filter((x) => x.date >= addDays(today(), -30))) { const k = String(e.what || "").trim().toLowerCase(); if (k) c.set(k, (c.get(k) || 0) + 1); for (const tr of e.triggers || []) t.set(tr, (t.get(tr) || 0) + 1); }
    const top = [...c.entries()].sort((a, b) => b[1] - a[1])[0], trig = [...t.entries()].sort((a, b) => b[1] - a[1])[0];
    return [{ label: "Most common (30 days)", value: top ? <span className="text-base capitalize">{top[0]}</span> : "—", sub: top ? `${top[1]} times` : undefined }, { label: "Top trigger", value: trig ? <span className="text-base">{trig[0]}</span> : "—", sub: trig ? `${trig[1]} times` : undefined }];
  },
  tips: ["Bring the printed report to your appointment.", "Log when it starts, not just when it's worst."],
};
const FOOD: TrackerConfig = {
  app: "food", color: "#65a30d", entryName: "meal",
  fields: [{ key: "meal", label: "Meal", type: "select", options: ["Breakfast", "Snack", "Lunch", "Dinner", "Dessert"], default: "Breakfast" }, { key: "what", label: "What I ate", type: "text", placeholder: "Oatmeal with berries" }, { key: "fv", label: "Fruit & veggie servings", type: "number", default: 0, min: 0, max: 20, half: true }, { key: "water", label: "Glasses of water", type: "number", optional: true, half: true }, { key: "hunger", label: "Hunger before (1 starving – 5 not hungry)", type: "scale", min: 1, max: 5, default: 2 }, { key: "full", label: "Fullness after (1 still hungry – 5 stuffed)", type: "scale", min: 1, max: 5, default: 3 }, { key: "feel", label: "How I felt", type: "chips", options: ["Energized", "Satisfied", "Sluggish", "Rushed", "Distracted", "Mindful"] }],
  metric: { label: "Fruit & veggies", unit: "servings", agg: "sum", value: (e) => Number(e.fv) || 0 },
  goal: { default: 5, label: "Fruit & veggie servings a day" },
  describe: (e) => <><b>{e.meal}</b> <span className="text-slate-600">· {e.what}</span>{Number(e.fv) ? <span className="text-lime-700"> · {e.fv} 🥦</span> : null}</>,
  tips: ["Half the plate fruit and vegetables is a simple target.", "Eating when you're about a 2 on the hunger scale helps avoid overeating."],
};
const DRINKS: Record<string, number> = { "Coffee (8 oz)": 95, "Espresso shot": 64, "Cold brew (16 oz)": 200, "Black tea": 47, "Green tea": 28, "Cola (12 oz)": 34, "Energy drink (16 oz)": 160, "Pre-workout": 200, "Dark chocolate (1 oz)": 23, Other: 0 };
const caffeineNow = (entries: Entry[]) => { const now = Date.now(); return entries.filter((e) => e.date >= addDays(today(), -1)).reduce((a, e) => { const t = new Date(`${e.date}T${e.time}`).getTime(); const h = (now - t) / 3_600_000; return h < 0 ? a : a + Number(e.mg) * Math.pow(0.5, h / 5); }, 0); };
const CAFFEINE: TrackerConfig = {
  app: "caffeine", color: "#92400e", entryName: "drink",
  fields: [{ key: "drink", label: "Drink", type: "select", options: Object.keys(DRINKS), default: "Coffee (8 oz)" }, { key: "mg", label: "Caffeine", type: "number", unit: "mg", min: 0, max: 1000 }],
  metric: { label: "Caffeine", unit: "mg", agg: "sum", value: (e) => Number(e.mg) || 0 },
  goal: { default: 400, label: "Daily limit (mg)", higherIsBetter: false },
  quick: Object.entries(DRINKS).filter(([k]) => k !== "Other").slice(0, 7).map(([k, mg]) => ({ label: `${k} · ${mg}`, values: { drink: k, mg } })),
  describe: (e) => <><b>{e.mg} mg</b> <span className="text-slate-500">· {e.drink}</span></>,
  extraStats: (entries) => { const n = caffeineNow(entries); const hrs = n > 50 ? Math.log2(n / 50) * 5 : 0; const at = new Date(Date.now() + hrs * 3_600_000); return [{ label: "In your body now", value: `${Math.round(n)} mg`, sub: n > 50 ? `below 50 mg around ${at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : "good for sleep" }]; },
  tips: ["400 mg a day is the usual adult limit; 200 mg during pregnancy; teens 100 mg or less.", "Caffeine's half-life is about 5 hours — a 3 PM coffee is still half there at 8 PM."],
};

// ─── Medication schedule ───
type Med = { id: string; name: string; dose: string; times: string[]; withFood: boolean; left: number | ""; perDose: number; notes: string; who: string };
function Meds() {
  const { data, setData } = usePro<{ meds: Med[]; taken: Record<string, string[]> }>("meds", { meds: [], taken: {} });
  const [edit, setEdit] = useState<Med | null>(null);
  const d0 = today();
  const takenToday = data.taken[d0] || [];
  const doses = data.meds.flatMap((m) => m.times.map((t) => ({ m, t, key: `${m.id}@${t}` }))).sort((a, b) => a.t.localeCompare(b.t));
  const now = new Date(); const nowM = now.getHours() * 60 + now.getMinutes();
  const toggle = (key: string, m: Med) => setData((d) => {
    const list = d.taken[d0] || []; const on = !list.includes(key);
    return { ...d, taken: { ...d.taken, [d0]: on ? [...list, key] : list.filter((k) => k !== key) }, meds: d.meds.map((x) => (x.id === m.id && x.left !== "" ? { ...x, left: Math.max(0, Number(x.left) + (on ? -x.perDose : x.perDose)) } : x)) };
  });
  const week = lastDays(7);
  const adherence = (m: Med) => { const total = m.times.length * 7; const got = week.reduce((a, d) => a + (data.taken[d] || []).filter((k) => k.startsWith(m.id + "@")).length, 0); return total ? Math.round((got / total) * 100) : 0; };
  const print = () => printPage("Medication list", `<h1>Medication list</h1><p class="muted">Printed ${fmtDay(d0, { month: "long", day: "numeric", year: "numeric" })}</p><table><tr><th>Who</th><th>Medicine</th><th>Dose</th><th>Times</th><th>Notes</th></tr>${data.meds.map((m) => `<tr><td>${esc(m.who)}</td><td><b>${esc(m.name)}</b></td><td>${esc(m.dose)}</td><td>${m.times.map((t) => esc(fmtTime(t))).join(", ")}${m.withFood ? " (with food)" : ""}</td><td>${esc(m.notes)}</td></tr>`).join("")}</table>`);
  return <div className="space-y-4">
    <div className="flex flex-wrap justify-between gap-2"><h2 className="text-lg font-black">Today · {fmtDay(d0)}</h2><div className="flex gap-2"><Btn onClick={print}><Printer size={15} />Print list</Btn><Btn kind="primary" color="#e11d48" onClick={() => setEdit({ id: uid(), name: "", dose: "", times: ["08:00"], withFood: false, left: "", perDose: 1, notes: "", who: "" })}><Plus size={16} />Add medicine</Btn></div></div>
    {doses.length ? <Card><ul className="divide-y divide-slate-100">{doses.map(({ m, t, key }) => { const done = takenToday.includes(key); const late = !done && minutes(t) < nowM - 60; return <li key={key} className="flex items-center gap-3 py-2.5">
      <button type="button" onClick={() => toggle(key, m)} aria-label={done ? "Mark not taken" : "Mark taken"} className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-2 ${done ? "bg-emerald-500 text-white ring-emerald-500" : late ? "ring-rose-400 text-rose-500" : "ring-slate-300 text-slate-300"}`}><Check size={20} /></button>
      <div className="min-w-0 flex-1"><p className={`font-bold ${done ? "text-slate-400 line-through" : "text-slate-900"}`}>{m.name} <span className="font-normal text-slate-500">{m.dose}</span></p><p className="text-xs text-slate-500">{fmtTime(t)}{m.withFood ? " · with food" : ""}{m.who ? ` · ${m.who}` : ""}{late ? " · missed?" : ""}</p></div>
      {m.left !== "" && Number(m.left) <= m.perDose * m.times.length * 7 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">Refill soon · {m.left} left</span>}
    </li>; })}</ul></Card> : <Empty>Add your medicines and vitamins to see today's checklist.</Empty>}
    {data.meds.length > 0 && <Card title="Your medicines">
      <ul className="divide-y divide-slate-100">{data.meds.map((m) => <li key={m.id} className="flex items-center gap-3 py-2">
        <div className="min-w-0 flex-1"><p className="font-bold">{m.name} <span className="font-normal text-slate-500">{m.dose}</span></p><p className="text-xs text-slate-500">{m.times.map(fmtTime).join(", ")} · this week {adherence(m)}% taken{m.left !== "" ? ` · ${m.left} left` : ""}</p></div>
        <button type="button" onClick={() => setEdit(m)} aria-label="Edit" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><Pencil size={15} /></button>
        <button type="button" onClick={() => setData((d) => ({ ...d, meds: d.meds.filter((x) => x.id !== m.id) }))} aria-label="Delete" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
      </li>)}</ul>
    </Card>}
    {edit && <Modal title={edit.name ? "Edit medicine" : "Add medicine"} onClose={() => setEdit(null)} footer={<><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn kind="primary" color="#e11d48" disabled={!edit.name.trim() || !edit.times.length} onClick={() => { setData((d) => ({ ...d, meds: d.meds.some((x) => x.id === edit.id) ? d.meds.map((x) => (x.id === edit.id ? edit : x)) : [...d.meds, edit] })); setEdit(null); }}>Save</Btn></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Medicine or vitamin" className="col-span-2"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Vitamin D" className={inputCls} /></Field>
        <Field label="Dose"><input value={edit.dose} onChange={(e) => setEdit({ ...edit, dose: e.target.value })} placeholder="1000 IU, 1 tablet" className={inputCls} /></Field>
        <Field label="For (optional)"><input value={edit.who} onChange={(e) => setEdit({ ...edit, who: e.target.value })} placeholder="Me, Ari…" className={inputCls} /></Field>
        <div className="col-span-2"><p className="mb-1 text-xs font-bold text-slate-600">Times each day</p><div className="flex flex-wrap items-center gap-2">{edit.times.map((t, i) => <span key={i} className="flex items-center gap-1"><input type="time" value={t} onChange={(e) => setEdit({ ...edit, times: edit.times.map((x, j) => (j === i ? e.target.value : x)) })} className={`${fit("w-32")}`} /><button type="button" onClick={() => setEdit({ ...edit, times: edit.times.filter((_, j) => j !== i) })} aria-label="Remove time" className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button></span>)}<Btn onClick={() => setEdit({ ...edit, times: [...edit.times, "20:00"] })}><Plus size={14} />Time</Btn></div></div>
        <Field label="Pills left (optional)"><NumIn value={edit.left} onChange={(n) => setEdit({ ...edit, left: n })} /></Field>
        <Field label="Pills per dose"><NumIn value={edit.perDose} onChange={(n) => setEdit({ ...edit, perDose: n === "" ? 1 : n })} /></Field>
        <label className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={edit.withFood} onChange={(e) => setEdit({ ...edit, withFood: e.target.checked })} />Take with food</label>
        <Field label="Notes" className="col-span-2"><input value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} placeholder="Prescribed by…, side effects to watch" className={inputCls} /></Field>
      </div>
    </Modal>}
    <p className="text-xs text-slate-500">This is a personal checklist, not medical advice. Ask your pharmacist about timing and interactions.</p>
  </div>;
}

// ─── Screen break timer ───
const STRETCHES = ["Roll your shoulders back 10 times.", "Look out a window and find the farthest thing you can see.", "Stand up and reach for the ceiling.", "Gently tilt your head to each side for 10 seconds.", "Blink slowly 10 times.", "Stretch your wrists and fingers.", "Walk to get a glass of water.", "Squeeze your shoulder blades together for 5 seconds."];
function EyeBreak() {
  const { data, setData } = usePro<{ every: number; breakSec: number; log: Record<string, number> }>("eye-break", { every: 20, breakSec: 20, log: {} });
  const [mode, setMode] = useState<"off" | "work" | "break">("off");
  const [endAt, setEndAt] = useState(0);
  const [tip, setTip] = useState(STRETCHES[0]);
  useTick(mode !== "off", 250);
  useWakeLock(mode === "break");
  const left = Math.max(0, endAt - Date.now());
  useEffect(() => {
    if (mode === "off" || left > 0) return;
    if (mode === "work") { setMode("break"); setEndAt(Date.now() + data.breakSec * 1000); setTip(STRETCHES[Math.floor(Math.random() * STRETCHES.length)]); chime(); try { if (Notification.permission === "granted") new Notification("Time for a screen break", { body: "Look 20 feet away for 20 seconds." }); } catch { /* none */ } }
    else { setMode("work"); setEndAt(Date.now() + data.every * 60_000); beep(520, 200); setData((d) => ({ ...d, log: { ...d.log, [today()]: (d.log[today()] || 0) + 1 } })); }
  });
  const start = () => { try { void Notification.requestPermission?.(); } catch { /* none */ } setMode("work"); setEndAt(Date.now() + data.every * 60_000); };
  return <div className="space-y-4">
    <Card className={`text-center ${mode === "break" ? "bg-sky-50" : ""}`}>
      {mode === "off" ? <><p className="text-5xl">👀</p><p className="mt-2 text-lg font-black">The 20-20-20 rule</p><p className="mx-auto mt-1 max-w-md text-sm text-slate-600">Every {data.every} minutes, look at something 20 feet away for {data.breakSec} seconds. Keep this tab open and it will remind you.</p><Btn kind="primary" color="#0284c7" big className="mt-4" onClick={start}>Start reminders</Btn></>
        : mode === "work" ? <><p className="text-sm font-bold text-slate-500">Next break in</p><p className="font-mono text-6xl font-black text-sky-700">{fmtDuration(left / 1000)}</p><Btn className="mt-3" onClick={() => setMode("off")}>Stop</Btn></>
          : <><p className="text-sm font-bold text-sky-700">Break time — look far away</p><p className="font-mono text-7xl font-black text-sky-700">{Math.ceil(left / 1000)}</p><p className="mt-2 text-base font-semibold text-slate-700">{tip}</p></>}
    </Card>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Field label="Remind every (min)"><NumIn value={data.every} min={5} max={120} onChange={(n) => setData((d) => ({ ...d, every: n === "" ? 20 : Math.max(1, n) }))} /></Field>
      <Field label="Break length (sec)"><NumIn value={data.breakSec} min={10} max={600} onChange={(n) => setData((d) => ({ ...d, breakSec: n === "" ? 20 : Math.max(5, n) }))} /></Field>
      <Stat label="Breaks today" value={data.log[today()] || 0} />
      <Stat label="This week" value={lastDays(7).reduce((a, d) => a + (data.log[d] || 0), 0)} />
    </div>
  </div>;
}

// ─── First aid ───
const AID: { t: string; e: string; call?: string; steps: string[] }[] = [
  { t: "Choking (adult or child over 1)", e: "🫁", call: "Call 911 if they can't breathe, cough or talk.", steps: ["Ask “Are you choking?” If they can cough hard, let them keep coughing.", "Stand behind them, lean them forward.", "Give 5 firm back blows between the shoulder blades with the heel of your hand.", "Give 5 abdominal thrusts: fist above the belly button, pull in and up.", "Keep alternating 5 back blows and 5 thrusts until the object comes out or they become unresponsive.", "If they become unresponsive, call 911 and start CPR."] },
  { t: "CPR (adult)", e: "❤️", call: "Call 911 first (or have someone call) and get an AED.", steps: ["Check the scene is safe; tap and shout to check if they respond.", "If not breathing normally, call 911 and send someone for an AED.", "Push hard and fast in the center of the chest: 2 inches deep, 100–120 a minute.", "Let the chest come all the way back up between pushes.", "If trained, give 2 breaths after every 30 pushes; otherwise keep doing hands-only CPR.", "Use the AED as soon as it arrives and follow its voice."] },
  { t: "Bleeding / cuts", e: "🩸", call: "Call 911 for bleeding that won't stop or spurts.", steps: ["Wash your hands or wear gloves if you can.", "Press firmly on the wound with a clean cloth for 10 minutes without peeking.", "If blood soaks through, add more cloth on top — don't remove the first layer.", "Once it stops, rinse with clean water and cover with a bandage.", "Get help for deep cuts, gaping wounds, or cuts from dirty or rusty objects."] },
  { t: "Burns", e: "🔥", call: "Call 911 for large, deep, or face/hand/groin burns, or electrical burns.", steps: ["Cool the burn under cool (not ice-cold) running water for 20 minutes.", "Remove rings or tight items before it swells.", "Cover loosely with a clean, non-stick dressing or cling film.", "Don't use ice, butter or creams, and don't pop blisters.", "Take pain medicine if needed and see a doctor if it's bigger than your palm."] },
  { t: "Nosebleed", e: "👃", steps: ["Sit up and lean forward (not back).", "Pinch the soft part of the nose firmly for 10–15 minutes.", "Breathe through the mouth and spit out blood rather than swallowing.", "A cold cloth on the bridge of the nose can help.", "Get help if it lasts more than 20 minutes or followed a hard hit to the head."] },
  { t: "Sprains & strains", e: "🦶", steps: ["Rest — stop using the injured part.", "Ice for 15–20 minutes every 2–3 hours (wrap ice in a cloth).", "Compress with an elastic bandage, not too tight.", "Elevate above the heart when you can.", "See a doctor if you can't bear weight, it looks deformed, or it's numb."] },
  { t: "Allergic reaction (severe)", e: "🐝", call: "Call 911 for trouble breathing, swelling of lips/tongue/throat, or fainting.", steps: ["If they have an epinephrine auto-injector (EpiPen), help them use it in the outer thigh.", "Call 911 even if they feel better.", "Have them lie down with legs raised (or sit up if breathing is hard).", "A second dose may be given after 5–15 minutes if no improvement and a second injector is available.", "Watch breathing and be ready to start CPR."] },
  { t: "Head bump", e: "🤕", call: "Call 911 for loss of consciousness, seizures, repeated vomiting or confusion.", steps: ["Have them sit or lie still.", "Hold a cold pack on the bump for 15–20 minutes.", "Watch for 24 hours: worsening headache, vomiting, unusual sleepiness, confusion or unequal pupils need a doctor right away.", "Rest from sports and screens until checked if any concussion signs."] },
  { t: "Fever (child)", e: "🌡️", call: "Call a doctor for babies under 3 months with any fever (100.4°F+).", steps: ["Dress in light clothing and offer plenty of fluids.", "Use children's acetaminophen or ibuprofen by weight if needed (no aspirin for kids).", "Get help for a fever over 104°F, a stiff neck, rash that doesn't fade when pressed, trouble breathing, or if they seem very unwell."] },
  { t: "Bee sting", e: "🐝", steps: ["Scrape the stinger out sideways with a fingernail or card.", "Wash with soap and water.", "Apply a cold pack to reduce swelling.", "Watch for signs of severe allergic reaction (see that card)."] },
  { t: "Splinter", e: "🪵", steps: ["Wash hands and the area.", "Use clean tweezers to pull it out at the same angle it went in.", "If it's under the skin, sterilize a needle with alcohol and gently lift the skin.", "Wash again and cover with a bandage."] },
  { t: "Poisoning", e: "☠️", call: "Poison Control (US): 1-800-222-1222. Call 911 if they are unconscious or not breathing.", steps: ["Don't make them throw up.", "Take the product with you to the phone.", "Call Poison Control and follow their instructions.", "If on the skin, rinse with water for 15–20 minutes; in the eyes, rinse for 15 minutes."] },
];
function FirstAid() {
  const [q, setQ] = useState(""); const [open, setOpen] = useState<number | null>(null);
  const list = AID.map((a, i) => ({ ...a, i })).filter((a) => !q || (a.t + a.steps.join(" ")).toLowerCase().includes(q.toLowerCase()));
  return <div className="space-y-4">
    <div className="rounded-2xl bg-rose-600 p-4 text-white"><p className="text-lg font-black">In an emergency, call 911 first.</p><p className="text-sm opacity-90">Poison Control (US): 1-800-222-1222. These cards are reminders, not a substitute for training or a doctor.</p></div>
    <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: burn, choking, nosebleed…" className={`${inputCls} pl-9`} /></div>
    <div className="grid gap-3 sm:grid-cols-2">{list.map((a) => <button key={a.i} type="button" onClick={() => setOpen(a.i)} className="flex items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 hover:ring-rose-300"><span className="text-3xl">{a.e}</span><span className="font-black">{a.t}</span></button>)}</div>
    {open !== null && <Modal title={AID[open].t} onClose={() => setOpen(null)} wide>
      {AID[open].call && <p className="mb-3 rounded-xl bg-rose-50 p-3 font-bold text-rose-800 ring-1 ring-rose-200">{AID[open].call}</p>}
      <ol className="space-y-3">{AID[open].steps.map((s, i) => <li key={i} className="flex gap-3"><span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-600 font-black text-white">{i + 1}</span><span className="pt-1 text-base">{s}</span></li>)}</ol>
      <Btn className="mt-4" onClick={() => speak(AID[open].steps.join(". "))}>🔊 Read aloud</Btn>
    </Modal>}
  </div>;
}

// ─── Medical ID cards ───
type Person = { id: string; name: string; dob: string; blood: string; allergies: string; conditions: string; meds: string; contact1: string; contact2: string; doctor: string; insurance: string; notes: string };
function MedCard() {
  const { data, setData } = usePro<{ people: Person[] }>("med-card", { people: [] });
  const [edit, setEdit] = useState<Person | null>(null);
  const blank = (): Person => ({ id: uid(), name: "", dob: "", blood: "", allergies: "", conditions: "", meds: "", contact1: "", contact2: "", doctor: "", insurance: "", notes: "" });
  const print = (p: Person) => printPage(`Medical ID — ${p.name}`, `<div class="card"><div class="hd">MEDICAL ID</div><h1>${esc(p.name)}</h1>${p.dob ? `<p>Born ${esc(p.dob)}${p.blood ? ` · Blood type <b>${esc(p.blood)}</b>` : ""}</p>` : ""}<p><b>Allergies:</b> ${esc(p.allergies || "None known")}</p><p><b>Conditions:</b> ${esc(p.conditions || "—")}</p><p><b>Medicines:</b> ${esc(p.meds || "—")}</p><p><b>Emergency:</b> ${esc(p.contact1)}${p.contact2 ? `<br>${esc(p.contact2)}` : ""}</p>${p.doctor ? `<p><b>Doctor:</b> ${esc(p.doctor)}</p>` : ""}${p.insurance ? `<p><b>Insurance:</b> ${esc(p.insurance)}</p>` : ""}</div><p class="muted">Cut out and fold. Keep it in a wallet or backpack.</p>`, ".card{width:3.37in;min-height:2.12in;border:2px solid #b91c1c;border-radius:10px;padding:10px 12px;font-size:10px;line-height:1.35}.card h1{font-size:15px;margin:2px 0}.card p{margin:2px 0}.hd{background:#b91c1c;color:#fff;font-weight:800;font-size:9px;letter-spacing:.15em;margin:-10px -12px 6px;padding:4px 12px;border-radius:7px 7px 0 0}");
  const F = ([k, l, ph]: [keyof Person, string, string]) => <Field key={k} label={l}><input value={edit![k]} onChange={(e) => setEdit({ ...edit!, [k]: e.target.value })} placeholder={ph} className={inputCls} /></Field>;
  return <div className="space-y-4">
    <div className="flex justify-end"><Btn kind="primary" color="#b91c1c" onClick={() => setEdit(blank())}><Plus size={16} />Add person</Btn></div>
    {data.people.length ? <div className="grid gap-3 sm:grid-cols-2">{data.people.map((p) => <Card key={p.id} className="border-t-4 border-rose-700">
      <div className="flex items-start justify-between"><div><p className="text-[10px] font-black tracking-[0.2em] text-rose-700">MEDICAL ID</p><p className="text-lg font-black">{p.name}</p>{p.blood && <p className="text-xs text-slate-500">Blood type {p.blood}</p>}</div><div className="flex gap-1"><Btn onClick={() => print(p)} title="Print wallet card"><Printer size={15} /></Btn><Btn onClick={() => setEdit(p)} title="Edit"><Pencil size={15} /></Btn></div></div>
      <p className="mt-2 text-sm"><b>Allergies:</b> <span className={p.allergies ? "font-bold text-rose-700" : ""}>{p.allergies || "None known"}</span></p>
      {p.conditions && <p className="text-sm"><b>Conditions:</b> {p.conditions}</p>}
      {p.meds && <p className="text-sm"><b>Medicines:</b> {p.meds}</p>}
      {p.contact1 && <p className="text-sm"><b>Emergency:</b> {p.contact1}</p>}
    </Card>)}</div> : <Empty>Add each family member's allergies, conditions and emergency contacts. Print a wallet card for school bags and wallets.</Empty>}
    {edit && <Modal title={edit.name ? `Edit ${edit.name}` : "Add person"} wide onClose={() => setEdit(null)} footer={<>{data.people.some((x) => x.id === edit.id) && <Btn kind="danger" onClick={() => { setData((d) => ({ people: d.people.filter((x) => x.id !== edit.id) })); setEdit(null); }}>Delete</Btn>}<Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn kind="primary" color="#b91c1c" disabled={!edit.name.trim()} onClick={() => { setData((d) => ({ people: d.people.some((x) => x.id === edit.id) ? d.people.map((x) => (x.id === edit.id ? edit : x)) : [...d.people, edit] })); setEdit(null); }}>Save</Btn></>}>
      <div className="grid gap-3 sm:grid-cols-2">{([["name", "Name", "Ari"], ["dob", "Date of birth", "March 3, 2018"], ["blood", "Blood type", "O+"], ["allergies", "Allergies", "Peanuts, penicillin"], ["conditions", "Conditions", "Asthma"], ["meds", "Medicines", "Albuterol inhaler as needed"], ["contact1", "Emergency contact 1", "Mom · (555) 123-4567"], ["contact2", "Emergency contact 2", "Dad · (555) 765-4321"], ["doctor", "Doctor", "Dr. Lee · (555) 222-3333"], ["insurance", "Insurance", "Plan name, member ID"], ["notes", "Other notes", "Wears glasses"]] as [keyof Person, string, string][]).map(F)}</div>
    </Modal>}
  </div>;
}

// ─── Doctor visits ───
type Visit = { id: string; date: string; time: string; who: string; doctor: string; reason: string; questions: { q: string; a: string }[]; notes: string; followUp: string };
function Appointments() {
  const { data, setData } = usePro<{ visits: Visit[] }>("appointments", { visits: [] });
  const [edit, setEdit] = useState<Visit | null>(null);
  const d0 = today();
  const up = data.visits.filter((v) => v.date >= d0).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = data.visits.filter((v) => v.date < d0).sort((a, b) => b.date.localeCompare(a.date));
  const save = (v: Visit) => setData((d) => ({ visits: d.visits.some((x) => x.id === v.id) ? d.visits.map((x) => (x.id === v.id ? v : x)) : [...d.visits, v] }));
  const row = (v: Visit) => <button key={v.id} type="button" onClick={() => setEdit(v)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-slate-50">
    <span className="w-14 shrink-0 rounded-lg bg-cyan-50 py-1 text-center"><span className="block text-[10px] font-bold uppercase text-cyan-700">{fmtDay(v.date, { month: "short" })}</span><span className="block text-lg font-black text-cyan-900">{v.date.slice(8)}</span></span>
    <span className="min-w-0 flex-1"><span className="block font-bold">{v.reason || "Appointment"}{v.who ? ` · ${v.who}` : ""}</span><span className="block text-xs text-slate-500">{v.doctor}{v.time ? ` · ${fmtTime(v.time)}` : ""} · {v.questions.length} question{v.questions.length === 1 ? "" : "s"}{v.followUp ? ` · follow-up: ${v.followUp}` : ""}</span></span>
  </button>;
  return <div className="space-y-4">
    <div className="flex justify-end"><Btn kind="primary" color="#0891b2" onClick={() => setEdit({ id: uid(), date: d0, time: "09:00", who: "", doctor: "", reason: "", questions: [], notes: "", followUp: "" })}><Plus size={16} />Add visit</Btn></div>
    <Card title="Coming up">{up.length ? up.map(row) : <Empty>No upcoming visits.</Empty>}</Card>
    {past.length > 0 && <Card title="Past visits">{past.map(row)}</Card>}
    {edit && <Modal title="Visit" wide onClose={() => setEdit(null)} footer={<>{data.visits.some((x) => x.id === edit.id) && <Btn kind="danger" onClick={() => { setData((d) => ({ visits: d.visits.filter((x) => x.id !== edit.id) })); setEdit(null); }}>Delete</Btn>}<Btn onClick={() => { const v = edit; printPage("Visit", `<h1>${esc(v.reason || "Appointment")}</h1><p class="muted">${esc(fmtDay(v.date, { weekday: "long", month: "long", day: "numeric" }))} ${esc(fmtTime(v.time))} · ${esc(v.doctor)} · ${esc(v.who)}</p><h2>Questions</h2><ol>${v.questions.map((q) => `<li><b>${esc(q.q)}</b><br>${esc(q.a) || "<br><br>"}</li>`).join("")}</ol><h2>Notes</h2><p>${esc(v.notes).replace(/\n/g, "<br>")}</p>`); }}><Printer size={15} />Print</Btn><Btn kind="primary" color="#0891b2" onClick={() => { save(edit); setEdit(null); }}>Save</Btn></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date"><input type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} className={inputCls} /></Field>
        <Field label="Time"><input type="time" value={edit.time} onChange={(e) => setEdit({ ...edit, time: e.target.value })} className={inputCls} /></Field>
        <Field label="Reason"><input value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} placeholder="Check-up, ear pain…" className={inputCls} /></Field>
        <Field label="Doctor / place"><input value={edit.doctor} onChange={(e) => setEdit({ ...edit, doctor: e.target.value })} className={inputCls} /></Field>
        <Field label="For"><input value={edit.who} onChange={(e) => setEdit({ ...edit, who: e.target.value })} placeholder="Me, Ari…" className={inputCls} /></Field>
        <Field label="Follow-up"><input value={edit.followUp} onChange={(e) => setEdit({ ...edit, followUp: e.target.value })} placeholder="Recheck in 6 weeks" className={inputCls} /></Field>
      </div>
      <p className="mb-1 mt-4 text-xs font-bold text-slate-600">Questions to ask (and the answers)</p>
      <div className="space-y-2">{edit.questions.map((q, i) => <div key={i} className="rounded-xl bg-slate-50 p-2 ring-1 ring-slate-100">
        <div className="flex gap-2"><input value={q.q} onChange={(e) => setEdit({ ...edit, questions: edit.questions.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })} placeholder="Question" className={`${inputCls} font-bold`} /><button type="button" onClick={() => setEdit({ ...edit, questions: edit.questions.filter((_, j) => j !== i) })} aria-label="Remove" className="text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button></div>
        <textarea value={q.a} onChange={(e) => setEdit({ ...edit, questions: edit.questions.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} placeholder="What the doctor said" rows={2} className={`${inputCls} mt-1 h-auto py-2`} />
      </div>)}</div>
      <Btn className="mt-2" onClick={() => setEdit({ ...edit, questions: [...edit.questions, { q: "", a: "" }] })}><Plus size={14} />Add question</Btn>
      <Field label="Notes" className="mt-4"><textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} rows={4} className={`${inputCls} h-auto py-2`} /></Field>
    </Modal>}
  </div>;
}

// ─── Health calculators ───
function Calculators() {
  const [tab, setTab] = useState<"bmi" | "cal" | "hr" | "sleep" | "water">("bmi");
  const [ft, setFt] = useState<number | "">(5); const [inch, setInch] = useState<number | "">(6); const [lb, setLb] = useState<number | "">(150);
  const [age, setAge] = useState<number | "">(35); const [sex, setSex] = useState<"f" | "m">("f"); const [act, setAct] = useState(1.375);
  const [rest, setRest] = useState<number | "">(65); const [wake, setWake] = useState("06:30");
  const hIn = Number(ft || 0) * 12 + Number(inch || 0), kg = Number(lb || 0) * 0.4536, cm = hIn * 2.54;
  const bmi = hIn ? (703 * Number(lb || 0)) / hIn ** 2 : 0;
  const bmr = sex === "m" ? 10 * kg + 6.25 * cm - 5 * Number(age || 0) + 5 : 10 * kg + 6.25 * cm - 5 * Number(age || 0) - 161;
  const max = 220 - Number(age || 0), hrr = max - Number(rest || 0);
  const zones = [[0.5, 0.6, "Zone 1 · Easy", "#60a5fa"], [0.6, 0.7, "Zone 2 · Fat burn / endurance", "#34d399"], [0.7, 0.8, "Zone 3 · Aerobic", "#facc15"], [0.8, 0.9, "Zone 4 · Threshold", "#fb923c"], [0.9, 1, "Zone 5 · Max effort", "#f87171"]] as const;
  const wakeM = minutes(wake);
  const beds = [6, 5, 4].map((cycles) => { let m = wakeM - cycles * 90 - 15; m = ((m % 1440) + 1440) % 1440; return { cycles, t: `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}` }; });
  const Height = <div className="grid grid-cols-2 gap-2"><Field label="Height (ft)"><NumIn value={ft} onChange={setFt} /></Field><Field label="(in)"><NumIn value={inch} onChange={setInch} /></Field></div>;
  return <div className="space-y-4">
    <Tabs value={tab} onChange={setTab} color="#7c3aed" items={[{ id: "bmi", label: "BMI" }, { id: "cal", label: "Calories" }, { id: "hr", label: "Heart rate zones" }, { id: "sleep", label: "Bedtime" }, { id: "water", label: "Water" }]} />
    {tab === "bmi" && <Card><div className="grid gap-3 sm:grid-cols-3">{Height}<Field label="Weight (lb)"><NumIn value={lb} onChange={setLb} /></Field></div>
      <div className="mt-4 text-center"><p className="text-5xl font-black text-violet-700">{bmi ? fmtNum(bmi, 1) : "—"}</p><p className="font-bold">{bmi < 18.5 ? "Underweight" : bmi < 25 ? "Healthy weight" : bmi < 30 ? "Overweight" : "Obesity"}</p>
        <div className="relative mx-auto mt-3 h-3 max-w-md rounded-full" style={{ background: "linear-gradient(90deg,#60a5fa 0 22%,#34d399 22% 47%,#facc15 47% 72%,#f87171 72%)" }}><span className="absolute -top-1 h-5 w-1.5 rounded bg-slate-900" style={{ left: `${Math.min(100, Math.max(0, ((bmi - 12) / 28) * 100))}%` }} /></div>
        <p className="mt-2 text-xs text-slate-500">Healthy range for your height: {hIn ? `${Math.round((18.5 * hIn * hIn) / 703)}–${Math.round((24.9 * hIn * hIn) / 703)} lb` : "—"}. BMI doesn't measure muscle or body shape, and isn't used the same way for kids.</p></div></Card>}
    {tab === "cal" && <Card><div className="grid gap-3 sm:grid-cols-3">{Height}<Field label="Weight (lb)"><NumIn value={lb} onChange={setLb} /></Field><Field label="Age"><NumIn value={age} onChange={setAge} /></Field><Field label="Sex"><select value={sex} onChange={(e) => setSex(e.target.value as "f" | "m")} className={inputCls}><option value="f">Female</option><option value="m">Male</option></select></Field><Field label="Activity"><select value={act} onChange={(e) => setAct(Number(e.target.value))} className={inputCls}><option value={1.2}>Mostly sitting</option><option value={1.375}>Light (1–3 days/week)</option><option value={1.55}>Moderate (3–5 days)</option><option value={1.725}>Very active (6–7 days)</option><option value={1.9}>Athlete / physical job</option></select></Field></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="At rest (BMR)" value={fmtNum(bmr, 0)} sub="calories/day" /><Stat label="To maintain" value={fmtNum(bmr * act, 0)} sub="calories/day" color="#7c3aed" /><Stat label="Lose ~1 lb/week" value={fmtNum(bmr * act - 500, 0)} /><Stat label="Gain ~1 lb/week" value={fmtNum(bmr * act + 500, 0)} /></div>
      <p className="mt-2 text-xs text-slate-500">Mifflin–St Jeor estimate. Everyone is different — use it as a starting point.</p></Card>}
    {tab === "hr" && <Card><div className="grid gap-3 sm:grid-cols-2"><Field label="Age"><NumIn value={age} onChange={setAge} /></Field><Field label="Resting heart rate (bpm)"><NumIn value={rest} onChange={setRest} /></Field></div>
      <p className="mt-3 text-sm">Estimated max heart rate: <b>{max} bpm</b></p>
      <div className="mt-2 space-y-2">{zones.map(([lo, hi, l, c]) => <div key={l} className="flex items-center gap-3 rounded-xl p-2.5" style={{ background: `${c}22` }}><span className="h-8 w-2 rounded" style={{ background: c }} /><span className="flex-1 text-sm font-bold">{l}</span><span className="font-mono text-sm font-bold">{Math.round(Number(rest || 0) + hrr * lo)}–{Math.round(Number(rest || 0) + hrr * hi)} bpm</span></div>)}</div>
      <p className="mt-2 text-xs text-slate-500">Karvonen method using your resting heart rate.</p></Card>}
    {tab === "sleep" && <Card><Field label="I want to wake up at"><input type="time" value={wake} onChange={(e) => setWake(e.target.value)} className={`${inputCls} max-w-[200px]`} /></Field>
      <p className="mt-3 text-sm">Try to be asleep at one of these times (sleep comes in ~90-minute cycles, plus 15 minutes to fall asleep):</p>
      <div className="mt-2 grid grid-cols-3 gap-2">{beds.map((b) => <Stat key={b.cycles} label={`${b.cycles} cycles · ${b.cycles * 1.5} h`} value={fmtTime(b.t)} color={b.cycles === 6 ? "#7c3aed" : undefined} />)}</div></Card>}
    {tab === "water" && <Card><div className="grid gap-3 sm:grid-cols-2"><Field label="Weight (lb)"><NumIn value={lb} onChange={setLb} /></Field><Field label="Minutes of exercise today"><NumIn value={rest} onChange={setRest} /></Field></div>
      <p className="mt-4 text-center text-5xl font-black text-sky-600">{fmtNum(Number(lb || 0) / 2 + (Number(rest || 0) / 30) * 12, 0)} oz</p><p className="text-center text-sm text-slate-500">about {fmtNum((Number(lb || 0) / 2 + (Number(rest || 0) / 30) * 12) / 8, 0)} glasses — half your weight in ounces, plus 12 oz per 30 minutes of exercise</p></Card>}
  </div>;
}

// ─── Toothbrush timer ───
function Toothbrush() {
  const { data, setData } = usePro<{ kids: string[]; chart: Record<string, string[]> }>("toothbrush", { kids: ["Me"], chart: {} });
  const [who, setWho] = useState(data.kids[0] || "Me");
  const [playing, setPlaying] = useState(false);
  const [newKid, setNewKid] = useState("");
  const steps = [{ label: "Top left 🦷", sec: 30, color: "#06b6d4", say: "Top left teeth. Little circles!" }, { label: "Top right 🦷", sec: 30, color: "#8b5cf6", say: "Now top right!" }, { label: "Bottom left 🦷", sec: 30, color: "#f59e0b", say: "Bottom left. Don't forget the back teeth!" }, { label: "Bottom right 🦷", sec: 30, color: "#ec4899", say: "Bottom right. Almost done!" }];
  const slot = new Date().getHours() < 14 ? "AM" : "PM";
  const week = lastDays(7);
  const mark = () => setData((d) => { const k = `${today()}|${who}`; const cur = d.chart[k] || []; return { ...d, chart: { ...d.chart, [k]: cur.includes(slot) ? cur : [...cur, slot] } }; });
  return <div className="space-y-4">
    <Card className="text-center">
      <div className="mb-3 flex flex-wrap justify-center gap-2">{data.kids.map((k) => <button key={k} type="button" onClick={() => setWho(k)} className={`rounded-full px-4 py-2 text-sm font-black ${who === k ? "bg-cyan-500 text-white" : "bg-slate-100 text-slate-700"}`}>{k}</button>)}</div>
      <p className="text-6xl">🪥</p><p className="mt-2 text-xl font-black">Two minutes, four corners</p>
      <Btn kind="primary" color="#06b6d4" big className="mt-4" onClick={() => setPlaying(true)}>Start brushing</Btn>
    </Card>
    <Card title="Sticker chart">
      <div className="overflow-x-auto"><table className="w-full text-center text-sm"><thead><tr><th className="text-left">Who</th>{week.map((d) => <th key={d} className="px-1 text-xs text-slate-500">{fmtDay(d, { weekday: "short" })}</th>)}</tr></thead><tbody>{data.kids.map((k) => <tr key={k}><td className="py-1 text-left font-bold">{k}</td>{week.map((d) => { const s = data.chart[`${d}|${k}`] || []; return <td key={d} className="px-1 text-lg">{s.includes("AM") ? "⭐" : "·"}{s.includes("PM") ? "🌙" : "·"}</td>; })}</tr>)}</tbody></table></div>
      <div className="mt-3 flex gap-2"><input value={newKid} onChange={(e) => setNewKid(e.target.value)} placeholder="Add a name" className={inputCls} /><Btn onClick={() => { const n = newKid.trim(); if (n && !data.kids.includes(n)) setData((d) => ({ ...d, kids: [...d.kids, n] })); setNewKid(""); }}><Plus size={15} />Add</Btn></div>
    </Card>
    {playing && <SequencePlayer kid title={`Brushing · ${who}`} steps={steps} color="#06b6d4" onDone={mark} onClose={() => setPlaying(false)} />}
  </div>;
}

export const HEALTH: Record<string, ComponentType> = {
  water: () => <LogTracker cfg={WATER} />,
  sleep: () => <LogTracker cfg={SLEEP} />,
  weight: () => <LogTracker cfg={WEIGHT} />,
  steps: () => <LogTracker cfg={STEPS} />,
  meds: Meds,
  bp: () => <LogTracker cfg={BP} />,
  symptoms: () => <LogTracker cfg={SYMPTOMS} />,
  food: () => <LogTracker cfg={FOOD} />,
  caffeine: () => <LogTracker cfg={CAFFEINE} />,
  "eye-break": EyeBreak,
  "first-aid": FirstAid,
  "med-card": MedCard,
  appointments: Appointments,
  calculators: Calculators,
  toothbrush: Toothbrush,
};
