// One client in Arise Trainer. Overview comes straight from their Arise Fit (what they chose to share);
// everything else is the trainer's plan for them, saved as it's changed.
import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardList, Copy, Dumbbell, Flag, Footprints, Lock, Pencil, Plus, Timer, Trash2, Trophy } from "lucide-react";
import { MODES, MODE_LABEL, expandProgram, type Appointment, type Assigned, type Coaching, type Habit, type Library, type Mode } from "@shared/coach";
import { fromKg, records } from "@shared/fit";
import { Chat } from "../coach/CoachUi";
import { coachApi, dayKeyOf, post, put, shortDate, usePoll, when, type ClientDetail } from "../coach/coachApi";
import { Btn, C, Card, Chips, Columns, Field, Ring, Sheet, Spark, Title, display, fmtDur, fmtNum, inputCls, inputStyle, stagger } from "../fit/fitUi";
import { DEFAULT_FORM, FormBuilder, WorkoutBuilder, newId } from "./TrainerBuilder";

type Tab = "overview" | "calendar" | "habits" | "nutrition" | "checkins" | "chat" | "sessions" | "photos" | "notes";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" }, { id: "calendar", label: "Calendar" }, { id: "chat", label: "Chat" }, { id: "habits", label: "Habits & goals" }, { id: "nutrition", label: "Nutrition" },
  { id: "checkins", label: "Check-ins" }, { id: "sessions", label: "Sessions" }, { id: "photos", label: "Photos" }, { id: "notes", label: "Notes" },
];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return dayKeyOf(x); };
const weekStart = (d: string) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() - x.getDay()); return dayKeyOf(x); };

export function ClientSheet({ token, me, linkId, name, lib, saveLib, onClose, quick }: { token: string | null; me: number; linkId: string; name: string; lib: Library; saveLib: (l: Library) => void; onClose: () => void; quick: string[] }) {
  const { data, err, setData } = usePoll(() => coachApi<ClientDetail>(token, `/links/${linkId}/client`), [linkId, token], 30_000);
  const [tab, setTab] = useState<Tab>("overview");
  const [saving, setSaving] = useState("");
  const save = async (coaching: Coaching, notify = true) => {
    if (!data) return;
    setData({ ...data, coaching }); setSaving("Saving…");
    try { const r = await put<{ coaching: Coaching }>(token, `/links/${linkId}/coaching`, { coaching, notify }); setData((d) => (d ? { ...d, coaching: r.coaching } : d)); setSaving("Saved"); window.setTimeout(() => setSaving(""), 1200); }
    catch (e: any) { setSaving(e.message); }
  };
  if (!data) return <Sheet title={name} onClose={onClose}><p className="mt-10 text-center" style={{ color: C.dim }}>{err || "Loading…"}</p></Sheet>;
  if (data.status === "requested") return <Sheet title={name} onClose={onClose} testId="tr-client"><Request token={token} linkId={linkId} name={name} data={data} onDone={onClose} /></Sheet>;
  return <Sheet title={name} onClose={onClose} testId="tr-client" right={saving ? <span className="text-[12px]" style={{ color: C.dim }}>{saving}</span> : undefined}>
    <Chips label="Section" value={tab} onChange={setTab} items={TABS} />
    <div key={tab} className="fit-in mt-4">
      {tab === "overview" && <Overview d={data} />}
      {tab === "calendar" && <Calendar c={data.coaching} lib={lib} save={save} saveLib={saveLib} />}
      {tab === "chat" && <Chat token={token} linkId={linkId} me={me} other={name} quick={quick} disabled={data.status !== "active"} />}
      {tab === "habits" && <Habits c={data.coaching} save={save} side={data.clientSide} />}
      {tab === "nutrition" && <Nutrition d={data} save={save} />}
      {tab === "checkins" && <Checkins d={data} lib={lib} save={save} saveLib={saveLib} />}
      {tab === "sessions" && <Sessions c={data.coaching} save={save} />}
      {tab === "photos" && <Photos d={data} />}
      {tab === "notes" && <Notes c={data.coaching} save={save} token={token} linkId={linkId} name={name} onEnded={onClose} />}
    </div>
  </Sheet>;
}

function Request({ token, linkId, name, data, onDone }: { token: string | null; linkId: string; name: string; data: ClientDetail; onDone: () => void }) {
  const shared = Object.entries(data.consent).filter(([, v]) => v).map(([k]) => k);
  return <div className="mt-2">
    <Card><p className="text-[26px] leading-none" style={display}>{name} wants you to coach them</p>
      <p className="mt-2 text-[14px]" style={{ color: C.steel }}>When you accept, their Arise Fit {shared.length ? shared.join(", ") : "profile"} come to you automatically. Your welcome message goes to them.</p></Card>
    <div className="mt-4 grid grid-cols-2 gap-2"><Btn kind="soft" onClick={async () => { await post(token, `/links/${linkId}/decline`); onDone(); }} testId="tr-decline">Decline</Btn><Btn onClick={async () => { await post(token, `/links/${linkId}/accept`); onDone(); }} testId="tr-accept">Accept</Btn></div>
  </div>;
}

function Locked({ what }: { what: string }) {
  return <Card className="!p-3"><p className="flex items-center gap-2 text-[14px]" style={{ color: C.dim }}><Lock className="h-4 w-4" />Your client isn't sharing {what}.</p></Card>;
}

function Overview({ d }: { d: ClientDetail }) {
  const s = d.snapshot; const p = s.profile; const units = (p?.units as "lb" | "kg") || "lb";
  const weights = (s.weights ?? []).slice(-60).map((w) => ({ x: w.date.slice(5), y: Math.round(fromKg(w.kg, units) * 10) / 10 }));
  const rec = useMemo(() => [...records(s.workouts ?? []).entries()].sort((a, b) => b[1].e1rm - a[1].e1rm).slice(0, 6), [s.workouts]);
  const names = new Map((s.workouts ?? []).flatMap((w) => w.exercises.map((e) => [e.exId, e.name] as const)));
  const food7 = (s.food ?? []).slice(-7);
  const avg = (k: "kcal" | "p" | "c" | "f") => (food7.length ? Math.round(food7.reduce((t, x) => t + x[k], 0) / food7.length) : 0);
  const steps = Object.entries(d.clientSide.health.steps).sort().slice(-7);
  const ring = (label: string, v: { pct: number | null }, k: number) => <Card className="flex flex-col items-center !p-3" style={stagger(k, 0.08)}>
    <Ring value={v.pct ?? 0} goal={100} size={84} stroke={9}><span className="text-[22px] leading-none" style={display}>{v.pct ?? "—"}{v.pct !== null ? "%" : ""}</span></Ring><p className="mt-1.5 text-[11px] uppercase" style={{ color: C.dim }}>{label}</p></Card>;
  return <div>
    <div className="grid grid-cols-2 gap-2">{ring("On plan · 7 days", d.compliance, 0)}{ring("On plan · 30 days", d.compliance30, 1)}</div>
    <p className="mt-2 px-1 text-[12px]" style={{ color: C.dim }}>Last 7 days: {d.compliance.workouts[0]}/{d.compliance.workouts[1]} workouts, {d.compliance.habits[0]}/{d.compliance.habits[1]} habits.</p>
    <Title>Profile</Title>
    {p ? <Card><div className="grid grid-cols-3 gap-3 text-center">{([[p.age ?? "—", "age"], [p.heightCm ? (units === "kg" ? `${p.heightCm} cm` : `${Math.floor(p.heightCm / 2.54 / 12)}'${Math.round((p.heightCm / 2.54) % 12)}"`) : "—", "height"], [p.goal === "lose" ? "Lose fat" : p.goal === "gain" ? "Build" : "Maintain", "goal"], [fmtNum(p.kcal), "cal goal"], [`${p.p}g`, "protein"], [p.dietPlan ?? "balanced", "plan"]] as const).map(([v, l]) => <div key={l}><p className="truncate text-[20px] leading-none capitalize" style={display}>{v}</p><p className="mt-1 text-[11px] uppercase" style={{ color: C.dim }}>{l}</p></div>)}</div></Card> : <Locked what="their profile" />}
    <Title>Body weight</Title>{s.weights ? <Card><Spark points={weights} color={C.blue} label={(y) => `${y} ${units}`} /></Card> : <Locked what="body weight" />}
    <Title>Workouts</Title>
    {s.workouts ? (s.workouts.length ? <div className="space-y-2">{s.workouts.slice(-8).reverse().map((w) => <Card key={w.id} className="!p-3"><div className="flex items-center gap-3"><Dumbbell className="h-5 w-5 shrink-0" style={{ color: w.programId === "coach" ? C.lime : C.dim }} />
      <div className="min-w-0 flex-1"><p className="truncate font-semibold">{w.name}</p><p className="text-[12px]" style={{ color: C.dim }}>{shortDate(w.date)} · {fmtDur(w.secs)} · {w.exercises.reduce((t, e) => t + e.sets.length, 0)} sets{w.programId === "coach" ? " · your plan" : ""}</p></div></div>
      {w.exercises.length > 0 && <p className="mt-1.5 line-clamp-2 text-[12px]" style={{ color: C.steel }}>{w.exercises.map((e) => `${e.name} ${e.sets.map((x) => `${fmtNum(x.weight)}×${x.reps}`).join(", ")}`).join(" · ")}</p>}</Card>)}</div>
      : <p className="px-1 text-[14px]" style={{ color: C.dim }}>No workouts logged yet.</p>) : <Locked what="workouts" />}
    {rec.length > 0 && <><Title>Best lifts</Title><Card className="!p-2">{rec.map(([id, b], k) => <div key={id} className="flex items-center gap-3 px-2 py-2" style={k ? { borderTop: `1px solid ${C.line}` } : undefined}><Trophy className="h-4 w-4 shrink-0" style={{ color: C.orange }} /><span className="min-w-0 flex-1 truncate text-[14px]">{names.get(id) ?? id}</span><span className="text-[13px]" style={{ color: C.dim }}>{fmtNum(b.weight)}×{b.reps}</span><span className="w-14 text-right text-[16px]" style={display}>{fmtNum(b.e1rm)}</span></div>)}</Card></>}
    <Title>Food · 7-day average</Title>
    {s.food ? <Card><div className="grid grid-cols-4 gap-2 text-center">{([["kcal", "cal"], ["p", "protein"], ["c", "carbs"], ["f", "fat"]] as const).map(([k, l]) => <div key={k}><p className="text-[22px] leading-none" style={display}>{fmtNum(avg(k))}</p><p className="mt-1 text-[11px] uppercase" style={{ color: C.dim }}>{l}</p></div>)}</div>
      <div className="mt-3"><Columns items={food7.map((x) => ({ label: x.date.slice(8), value: x.kcal }))} color={C.orange} /></div></Card> : <Locked what="food" />}
    <Title>Steps</Title>{d.consent.health ? (steps.length ? <Card><Columns items={steps.map(([k, v]) => ({ label: k.slice(8), value: v }))} /><p className="mt-2 flex items-center gap-1 text-[12px]" style={{ color: C.dim }}><Footprints className="h-3.5 w-3.5" />From Apple Health, when they open Arise Fit</p></Card> : <p className="px-1 text-[14px]" style={{ color: C.dim }}>No steps yet (they come from Apple Health on their iPhone).</p>) : <Locked what="steps" />}
    {s.fasting && <><Title>Fasting</Title><Card className="flex items-center gap-3 !p-3"><Timer className="h-5 w-5" style={{ color: C.lime }} /><p className="text-[14px]">{s.fasting.active ? `Fasting now · started ${when(s.fasting.active)}` : "Not fasting"} · {s.fasting.protocol} · {s.fasting.log.length} fasts logged</p></Card></>}
    {s.runs && s.runs.length > 0 && <><Title>Runs</Title><Card className="!p-2">{s.runs.slice(-6).reverse().map((r, k) => <div key={r.date} className="flex justify-between px-2 py-2 text-[14px]" style={k ? { borderTop: `1px solid ${C.line}` } : undefined}><span className="capitalize">{r.trail ?? r.kind} · {shortDate(r.date)}</span><span style={{ color: C.dim }}>{(r.meters / 1609.344).toFixed(2)} mi · {fmtDur(r.secs)}</span></div>)}</Card></>}
  </div>;
}

function Calendar({ c, lib, save, saveLib }: { c: Coaching; lib: Library; save: (c: Coaching) => void; saveLib: (l: Library) => void }) {
  const [start, setStart] = useState(weekStart(dayKeyOf()));
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<Assigned | null>(null);
  const [building, setBuilding] = useState<string | null>(null);
  const [program, setProgram] = useState(false);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const put1 = (a: Assigned) => save({ ...c, assigned: [...c.assigned.filter((x) => x.id !== a.id), a] });
  const copyWeek = () => { const src = c.assigned.filter((a) => a.date >= start && a.date < addDays(start, 7)); if (!src.length) return; save({ ...c, assigned: [...c.assigned, ...src.map((a) => ({ ...a, id: newId(), date: addDays(a.date, 7), done: undefined }))] }); setStart(addDays(start, 7)); };
  return <div>
    <div className="flex items-center justify-between"><button type="button" aria-label="Week before" onClick={() => setStart(addDays(start, -7))} className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card }}><ChevronLeft className="h-5 w-5" /></button>
      <p className="text-[18px]" style={display}>{shortDate(start)} – {shortDate(addDays(start, 6))}</p>
      <button type="button" aria-label="Next week" onClick={() => setStart(addDays(start, 7))} className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card }}><ChevronRight className="h-5 w-5" /></button></div>
    <div className="mt-3 space-y-2">{days.map((day, k) => { const list = c.assigned.filter((a) => a.date === day); const today = day === dayKeyOf();
      return <Card key={day} className="!p-3" style={{ ...stagger(k, 0.04), ...(today ? { boxShadow: "inset 0 0 0 1px #ff5a1f" } : {}) }}>
        <div className="flex items-center gap-2"><span className="w-12 text-[14px] font-bold" style={{ color: today ? C.lime : C.dim }}>{DOW[new Date(`${day}T12:00:00`).getDay()]} {day.slice(8)}</span>
          <div className="min-w-0 flex-1 space-y-1">{list.map((a) => <button key={a.id} type="button" onClick={() => setEditing(a)} className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left" style={{ background: a.done ? "rgba(255,90,31,.16)" : C.card2 }}>
            {a.done ? <Check className="h-4 w-4 shrink-0" style={{ color: C.lime }} strokeWidth={3} /> : <Dumbbell className="h-4 w-4 shrink-0" style={{ color: C.dim }} />}<span className="truncate text-[14px] font-semibold">{a.name}</span></button>)}
            {!list.length && <span className="text-[13px]" style={{ color: C.dim }}>Rest</span>}</div>
          <button type="button" aria-label={`Add a workout on ${day}`} onClick={() => setAdding(day)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: C.lime, color: "#0b0b0c" }} data-testid={`tr-add-${day}`}><Plus className="h-5 w-5" /></button></div></Card>; })}</div>
    <div className="mt-3 grid grid-cols-2 gap-2"><Btn kind="soft" className="!text-[15px]" onClick={copyWeek}><Copy className="h-4 w-4" />Copy to next week</Btn><Btn kind="soft" className="!text-[15px]" onClick={() => setProgram(true)} testId="tr-assign-program"><CalendarDays className="h-4 w-4" />Assign a program</Btn></div>
    {adding && <Sheet title={`Add to ${shortDate(adding)}`} onClose={() => setAdding(null)}>
      <Btn className="w-full" onClick={() => { setBuilding(adding); setAdding(null); }} testId="tr-new-workout"><Plus className="h-5 w-5" />Build a new workout</Btn>
      <Title>From your library</Title>
      {lib.workouts.length ? <div className="space-y-2">{lib.workouts.map((w) => <Card key={w.id} onClick={() => { put1({ ...w, id: newId(), date: adding }); setAdding(null); }} className="!p-3"><p className="font-semibold">{w.name}</p><p className="truncate text-[12px]" style={{ color: C.dim }}>{w.items.map((i) => i.name).join(", ")}</p></Card>)}</div> : <p className="px-1 text-[14px]" style={{ color: C.dim }}>Workouts you save to your library show up here.</p>}
    </Sheet>}
    {building && <WorkoutBuilder lib={lib} title={`Workout · ${shortDate(building)}`} onClose={() => setBuilding(null)} extra={<p className="mt-2 px-1 text-[12px]" style={{ color: C.dim }}>Also saved to your library so you can reuse it.</p>}
      onSave={(w) => { put1({ ...w, id: newId(), date: building }); saveLib({ ...lib, workouts: [...lib.workouts, w] }); setBuilding(null); }} />}
    {editing && <WorkoutBuilder lib={lib} initial={editing} title={`${shortDate(editing.date)}${editing.done ? " · done" : ""}`} onClose={() => setEditing(null)}
      extra={<div className="mt-2 grid grid-cols-2 gap-2">
        <input type="date" value={editing.date} onChange={(e) => e.target.value && setEditing({ ...editing, date: e.target.value })} className={inputCls} style={inputStyle} aria-label="Date" />
        <Btn kind="danger" onClick={() => { save({ ...c, assigned: c.assigned.filter((x) => x.id !== editing.id) }); setEditing(null); }}><Trash2 className="h-4 w-4" />Remove</Btn></div>}
      onSave={(w) => { put1({ ...editing, ...w, id: editing.id, date: editing.date }); setEditing(null); }} />}
    {program && <AssignProgram lib={lib} onClose={() => setProgram(false)} onAssign={(list, phase) => { save({ ...c, phase, assigned: [...c.assigned, ...list] }); setProgram(false); }} />}
  </div>;
}

function AssignProgram({ lib, onClose, onAssign }: { lib: Library; onClose: () => void; onAssign: (a: Assigned[], phase: string) => void }) {
  const [pid, setPid] = useState(lib.programs[0]?.id ?? ""); const [start, setStart] = useState(dayKeyOf());
  const p = lib.programs.find((x) => x.id === pid);
  return <Sheet title="Assign a program" onClose={onClose}>
    {!lib.programs.length ? <p className="mt-4 text-center" style={{ color: C.dim }}>Build a program in Library first.</p> : <div className="mt-2 space-y-4">
      <Field label="Program"><select value={pid} onChange={(e) => setPid(e.target.value)} className={inputCls} style={inputStyle}>{lib.programs.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.weeks} wk</option>)}</select></Field>
      <Field label="Starts"><input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} style={inputStyle} /></Field>
      {p && <p className="px-1 text-[13px]" style={{ color: C.dim }}>{p.days.length} workouts over {p.weeks} weeks go on their calendar from {shortDate(start)}.</p>}
      <Btn className="w-full" disabled={!p} onClick={() => p && onAssign(expandProgram(p, lib, start), p.name)}>Put it on the calendar</Btn></div>}
  </Sheet>;
}

function Habits({ c, save, side }: { c: Coaching; save: (c: Coaching) => void; side: ClientDetail["clientSide"] }) {
  const [name, setName] = useState(""); const [goal, setGoal] = useState(""); const [due, setDue] = useState("");
  const streakOf = (h: Habit) => { let n = 0; for (let i = 0; i < 60; i++) { const d = new Date(); d.setDate(d.getDate() - i); if (h.days.length && !h.days.includes(d.getDay())) continue; if (side.habitLog[dayKeyOf(d)]?.includes(h.id)) n++; else if (i > 0) break; } return n; };
  return <div>
    <Title>Daily habits</Title>
    <div className="space-y-2">{c.habits.map((h) => <Card key={h.id} className="!p-3"><div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate font-semibold">{h.name}</p><span className="text-[12px]" style={{ color: C.dim }}>{streakOf(h)} in a row</span>
      <button type="button" aria-label="Remove habit" onClick={() => save({ ...c, habits: c.habits.filter((x) => x.id !== h.id) })} className="grid h-9 w-9 place-items-center" style={{ color: C.dim }}><Trash2 className="h-4 w-4" /></button></div>
      <div className="mt-2 grid grid-cols-7 gap-1">{DOW.map((d, i) => { const on = !h.days.length || h.days.includes(i); return <button key={d} type="button" onClick={() => { const days = (h.days.length ? h.days : [0, 1, 2, 3, 4, 5, 6]); const next = on ? days.filter((x) => x !== i) : [...days, i].sort(); save({ ...c, habits: c.habits.map((x) => (x.id === h.id ? { ...x, days: next.length === 7 ? [] : next } : x)) }); }} className="h-8 rounded-[6px] text-[11px] font-bold" style={on ? { background: C.lime, color: "#0b0b0c" } : { background: C.card2, color: C.dim }}>{d[0]}</button>; })}</div></Card>)}</div>
    <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { save({ ...c, habits: [...c.habits, { id: newId(), name: name.trim().slice(0, 80), days: [] }] }); setName(""); } }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 10,000 steps, 3 L water, 8 h sleep" className={inputCls} style={inputStyle} data-testid="tr-habit-name" /><Btn type="submit" disabled={!name.trim()}><Plus className="h-5 w-5" /></Btn></form>
    <div className="mt-2 flex flex-wrap gap-1.5">{["Hit protein goal", "10,000 steps", "Drink 3 L water", "Sleep 8 hours", "Log every meal", "Stretch 10 minutes"].filter((x) => !c.habits.some((h) => h.name === x)).map((x) => <button key={x} type="button" onClick={() => save({ ...c, habits: [...c.habits, { id: newId(), name: x, days: [] }] })} className="h-8 rounded-full px-3 text-[12px] font-semibold" style={{ background: C.card }}>+ {x}</button>)}</div>
    <Title>Goals</Title>
    <Card className="!p-2">{c.goals.map((g, k) => <div key={g.id} className="flex items-center gap-2 px-1 py-1.5" style={k ? { borderTop: `1px solid ${C.line}` } : undefined}>
      <button type="button" aria-label={g.done ? "Not done" : "Done"} onClick={() => save({ ...c, goals: c.goals.map((x) => (x.id === g.id ? { ...x, done: !x.done } : x)) })} className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={g.done ? { background: C.lime, color: "#0b0b0c" } : { background: C.card2 }}>{g.done ? <Check className="h-4 w-4" strokeWidth={3} /> : <Flag className="h-4 w-4" style={{ color: C.dim }} />}</button>
      <span className="min-w-0 flex-1 text-[15px]">{g.text}</span>{g.due && <span className="text-[12px]" style={{ color: C.dim }}>{shortDate(g.due)}</span>}
      <button type="button" aria-label="Remove goal" onClick={() => save({ ...c, goals: c.goals.filter((x) => x.id !== g.id) })} className="grid h-9 w-9 place-items-center" style={{ color: C.dim }}><Trash2 className="h-4 w-4" /></button></div>)}
      {!c.goals.length && <p className="p-2 text-[14px]" style={{ color: C.dim }}>No goals yet.</p>}</Card>
    <form className="mt-2 grid grid-cols-[1fr_9rem_auto] gap-2" onSubmit={(e) => { e.preventDefault(); if (goal.trim()) { save({ ...c, goals: [...c.goals, { id: newId(), text: goal.trim().slice(0, 200), ...(due ? { due } : {}) }] }); setGoal(""); setDue(""); } }}>
      <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Bench 225, lose 10 lb…" className={inputCls} style={inputStyle} /><input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} style={inputStyle} aria-label="Due" /><Btn type="submit" disabled={!goal.trim()}><Plus className="h-5 w-5" /></Btn></form>
  </div>;
}

function Nutrition({ d, save }: { d: ClientDetail; save: (c: Coaching) => void }) {
  const c = d.coaching; const n = c.nutrition ?? {};
  const [v, setV] = useState({ kcal: n.kcal ? String(n.kcal) : "", p: n.p ? String(n.p) : "", c: n.c ? String(n.c) : "", f: n.f ? String(n.f) : "", waterL: n.waterL ? String(n.waterL) : "", note: n.note ?? "" });
  const kcalFromMacros = (Number(v.p) || 0) * 4 + (Number(v.c) || 0) * 4 + (Number(v.f) || 0) * 9;
  const [day, setDay] = useState<string | null>(null);
  const food = d.snapshot.food ?? [];
  return <div>
    <Title>Targets</Title>
    <Card><div className="grid grid-cols-2 gap-2">{([["kcal", "Calories"], ["p", "Protein (g)"], ["c", "Carbs (g)"], ["f", "Fat (g)"], ["waterL", "Water (L)"]] as const).map(([k, l]) => <Field key={k} label={l}><input inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value.replace(/[^\d.]/g, "").slice(0, 5) })} className={inputCls} style={inputStyle} data-testid={`tr-nut-${k}`} /></Field>)}</div>
      {kcalFromMacros > 0 && <p className="mt-2 text-[12px]" style={{ color: C.dim }}>Macros add up to {fmtNum(kcalFromMacros)} calories.{d.snapshot.profile ? ` Arise Fit's estimate for them: ${fmtNum(d.snapshot.profile.kcal)}.` : ""}</p>}
      <Field label="Meal plan or notes"><textarea value={v.note} onChange={(e) => setV({ ...v, note: e.target.value.slice(0, 800) })} rows={5} placeholder="Breakfast: 4 eggs, oats… or any guidance" className="mt-2 w-full rounded-[12px] p-3 text-[17px] outline-none" style={inputStyle} /></Field>
      <Btn className="mt-3 w-full" onClick={() => save({ ...c, nutrition: { kcal: Number(v.kcal) || undefined, p: Number(v.p) || undefined, c: Number(v.c) || undefined, f: Number(v.f) || undefined, waterL: Number(v.waterL) || undefined, note: v.note || undefined } })} testId="tr-nut-save">Save targets</Btn></Card>
    <Title>What they ate</Title>
    {!d.consent.food ? <Locked what="food" /> : food.length ? <div className="space-y-2">{[...food].reverse().slice(0, 14).map((x) => <Card key={x.date} onClick={() => setDay(day === x.date ? null : x.date)} className="!p-3">
      <div className="flex items-center justify-between"><p className="font-semibold">{shortDate(x.date)}</p><p className="text-[18px]" style={{ ...display, color: n.kcal && Math.abs(x.kcal - n.kcal) <= n.kcal * 0.1 ? C.lime : C.text }}>{fmtNum(x.kcal)} cal</p></div>
      <p className="text-[12px]" style={{ color: C.dim }}>P {x.p}g · C {x.c}g · F {x.f}g{x.waterMl ? ` · water ${(x.waterMl / 1000).toFixed(1)} L` : ""}</p>
      {day === x.date && <ul className="mt-2 space-y-1">{x.items.map((i, k) => <li key={k} className="flex justify-between text-[13px]"><span className="truncate"><span className="capitalize" style={{ color: C.dim }}>{i.meal}</span> · {i.name}</span><span>{i.kcal}</span></li>)}</ul>}</Card>)}</div>
      : <p className="px-1 text-[14px]" style={{ color: C.dim }}>Nothing logged in the last 30 days.</p>}
  </div>;
}

function Checkins({ d, lib, save, saveLib }: { d: ClientDetail; lib: Library; save: (c: Coaching) => void; saveLib: (l: Library) => void }) {
  const c = d.coaching;
  const [edit, setEdit] = useState(false);
  const answers = [...d.clientSide.checkins].reverse();
  const form = (id: string) => (c.checkin?.id === id ? c.checkin : lib.forms.find((f) => f.id === id));
  return <div>
    <Card className="!p-4">{c.checkin ? <><p className="text-[22px] leading-none" style={display}>{c.checkin.title}</p><p className="mt-1 text-[13px]" style={{ color: C.dim }}>Due every {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][c.checkin.weekday]} · {c.checkin.questions.length} questions</p>
      <div className="mt-3 grid grid-cols-2 gap-2"><Btn kind="soft" className="!text-[15px]" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" />Edit</Btn><Btn kind="danger" className="!text-[15px]" onClick={() => save({ ...c, checkin: undefined })}>Turn off</Btn></div></>
      : <><p className="text-[15px]">No weekly check-in yet.</p><div className="mt-3 space-y-2">
        <Btn className="w-full" onClick={() => setEdit(true)} testId="tr-checkin-new"><ClipboardList className="h-5 w-5" />Set up a weekly check-in</Btn>
        {lib.forms.map((f) => <Btn key={f.id} kind="soft" className="w-full !text-[15px]" onClick={() => save({ ...c, checkin: f })}>Use “{f.title}”</Btn>)}</div></>}</Card>
    <Title>Answers</Title>
    {answers.length ? <div className="space-y-2">{answers.map((a, k) => { const f = form(a.formId); return <Card key={a.date + k} className="!p-3.5"><p className="text-[18px]" style={display}>{shortDate(a.date)}</p>
      <dl className="mt-1 space-y-1.5">{Object.entries(a.answers).map(([qid, v]) => <div key={qid}><dt className="text-[12px]" style={{ color: C.dim }}>{f?.questions.find((q) => q.id === qid)?.q ?? "Question"}</dt><dd className="text-[15px] font-semibold">{String(v)}</dd></div>)}</dl></Card>; })}</div>
      : <p className="px-1 text-[14px]" style={{ color: C.dim }}>Their answers show up here.</p>}
    {edit && <FormBuilder initial={c.checkin ?? DEFAULT_FORM()} onClose={() => setEdit(false)} onSave={(f) => { save({ ...c, checkin: f }); if (!lib.forms.some((x) => x.id === f.id)) saveLib({ ...lib, forms: [...lib.forms, f] }); else saveLib({ ...lib, forms: lib.forms.map((x) => (x.id === f.id ? f : x)) }); setEdit(false); }} />}
  </div>;
}

function Sessions({ c, save }: { c: Coaching; save: (c: Coaching) => void }) {
  const [edit, setEdit] = useState<Appointment | null>(null);
  const upcoming = c.appts.filter((a) => a.status === "booked" && Date.parse(a.at) > Date.now() - 3600e3);
  const past = c.appts.filter((a) => !upcoming.includes(a)).slice(-12).reverse();
  const local = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const row = (a: Appointment) => <Card key={a.id} onClick={() => setEdit(a)} className="!p-3" style={a.requested && a.status === "booked" ? { boxShadow: "inset 0 0 0 1px #ff5a1f" } : undefined}>
    <p className="font-semibold">{when(a.at)}</p><p className="truncate text-[12px]" style={{ color: C.dim }}>{MODE_LABEL[a.mode]} · {a.mins} min{a.requested ? " · they asked for this" : ""}{a.status !== "booked" ? ` · ${a.status}` : ""}{a.place ? ` · ${a.place}` : ""}</p></Card>;
  return <div>
    <Btn className="w-full" onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); setEdit({ id: newId(), at: d.toISOString(), mins: 60, mode: "virtual", place: "", note: "", status: "booked" }); }} testId="tr-session-new"><CalendarDays className="h-5 w-5" />Book a session</Btn>
    <Title>Coming up</Title>{upcoming.length ? <div className="space-y-2">{upcoming.map(row)}</div> : <p className="px-1 text-[14px]" style={{ color: C.dim }}>Nothing booked.</p>}
    {past.length > 0 && <><Title>Past</Title><div className="space-y-2">{past.map(row)}</div></>}
    {edit && <Sheet title="Session" onClose={() => setEdit(null)}>
      <div className="mt-2 space-y-3">
        <Field label="When"><input type="datetime-local" value={local(edit.at)} onChange={(e) => e.target.value && setEdit({ ...edit, at: new Date(e.target.value).toISOString() })} className={inputCls} style={inputStyle} /></Field>
        <Field label="How"><div className="grid grid-cols-3 gap-2">{MODES.map((m: Mode) => <button key={m} type="button" onClick={() => setEdit({ ...edit, mode: m })} className="h-11 rounded-[10px] text-[13px] font-semibold" style={edit.mode === m ? { background: C.lime, color: "#0b0b0c" } : { background: C.card2 }}>{MODE_LABEL[m]}</button>)}</div></Field>
        <Field label="Minutes"><input inputMode="numeric" value={edit.mins} onChange={(e) => setEdit({ ...edit, mins: Number(e.target.value.replace(/\D/g, "")) || 60 })} className={inputCls} style={inputStyle} /></Field>
        <Field label={edit.mode === "inPerson" ? "Where" : "Video link (Zoom, FaceTime, Meet)"}><input value={edit.place} onChange={(e) => setEdit({ ...edit, place: e.target.value.slice(0, 200) })} placeholder={edit.mode === "inPerson" ? "Gym, address" : "https://"} className={inputCls} style={inputStyle} /></Field>
        <Field label="Note"><input value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value.slice(0, 400) })} className={inputCls} style={inputStyle} /></Field>
      </div>
      <Btn className="mt-5 w-full" onClick={() => { save({ ...c, appts: [...c.appts.filter((x) => x.id !== edit.id), { ...edit, requested: false }] }); setEdit(null); }} testId="tr-session-save">{c.appts.some((x) => x.id === edit.id) ? "Save" : "Book it"}</Btn>
      {c.appts.some((x) => x.id === edit.id) && <div className="mt-2 grid grid-cols-2 gap-2"><Btn kind="soft" onClick={() => { save({ ...c, appts: c.appts.map((x) => (x.id === edit.id ? { ...x, status: "done" } : x)) }); setEdit(null); }}>Mark done</Btn><Btn kind="danger" onClick={() => { save({ ...c, appts: c.appts.map((x) => (x.id === edit.id ? { ...x, status: "cancelled" } : x)) }); setEdit(null); }}>Cancel</Btn></div>}
    </Sheet>}
  </div>;
}

function Photos({ d }: { d: ClientDetail }) {
  const [pose, setPose] = useState<"front" | "side" | "back" | "other">("front");
  if (!d.consent.photos) return <Locked what="progress photos" />;
  const list = d.clientSide.photos.filter((p) => p.pose === pose).sort((a, b) => a.date.localeCompare(b.date));
  const first = list[0], last = list[list.length - 1];
  return <div>
    <Chips label="Pose" value={pose} onChange={setPose} items={[{ id: "front", label: "Front" }, { id: "side", label: "Side" }, { id: "back", label: "Back" }, { id: "other", label: "Other" }]} />
    {first && last && first !== last && <><Title>Before and now</Title><div className="grid grid-cols-2 gap-2">{[first, last].map((p) => <figure key={p.id} className="m-0"><img src={p.img} alt="" className="aspect-[3/4] w-full rounded-[12px] object-cover" /><figcaption className="mt-1 text-center text-[12px]" style={{ color: C.dim }}>{shortDate(p.date)}</figcaption></figure>)}</div></>}
    <Title>All</Title>
    {list.length ? <div className="grid grid-cols-3 gap-2">{[...list].reverse().map((p) => <figure key={p.id} className="m-0"><img src={p.img} alt="" className="aspect-[3/4] w-full rounded-[10px] object-cover" /><figcaption className="mt-0.5 text-center text-[11px]" style={{ color: C.dim }}>{shortDate(p.date)}</figcaption></figure>)}</div> : <p className="px-1 text-[14px]" style={{ color: C.dim }}>No {pose} photos yet.</p>}
  </div>;
}

function Notes({ c, save, token, linkId, name, onEnded }: { c: Coaching; save: (c: Coaching, notify?: boolean) => void; token: string | null; linkId: string; name: string; onEnded: () => void }) {
  const [notes, setNotes] = useState(c.notes); const [phase, setPhase] = useState(c.phase ?? ""); const [tags, setTags] = useState(c.tags.join(", "));
  return <div>
    <Field label="Current phase (they see this)"><input value={phase} onChange={(e) => setPhase(e.target.value.slice(0, 80))} placeholder="e.g. Cut · week 3" className={inputCls} style={inputStyle} /></Field>
    <div className="mt-3"><Field label="Tags (only you see these, for sorting clients)"><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="online, beginner, wedding" className={inputCls} style={inputStyle} /></Field></div>
    <div className="mt-3"><Field label="Private notes (never shown to your client)"><textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 8000))} rows={10} placeholder="Injuries, preferences, what's working…" className="w-full rounded-[12px] p-3 text-[17px] outline-none" style={inputStyle} data-testid="tr-notes" /></Field></div>
    <Btn className="mt-3 w-full" onClick={() => save({ ...c, notes, phase: phase || undefined, tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10) }, false)} testId="tr-notes-save">Save</Btn>
    <button type="button" onClick={async () => { if (window.confirm(`Stop coaching ${name}? Their Arise Fit data stops coming to you.`)) { await post(token, `/links/${linkId}/end`); onEnded(); } }} className="mt-8 h-12 w-full text-[15px] font-semibold" style={{ color: C.red }}>Stop coaching {name}</button>
  </div>;
}
