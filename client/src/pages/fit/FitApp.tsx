// Arise Fit: training and nutrition in one app (the iPhone app built with VITE_NATIVE_APP=fit, and
// #/fit on the website). Tabs: Today, Train, Food, Progress. Data: fitStore.ts → server/fit.ts.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Apple, BarChart3, ChevronRight, Dumbbell, Flame, Home, LogOut, Play, Scale, Settings, ShieldCheck, Trophy } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import AccountPrivacy from "@/components/AccountPrivacy";
import { goToSignIn } from "@/lib/hubs";
import { CATALOG, CATALOG_BY_ID, PROGRAM_BY_ID, dayKey, fromKg, goals, nextProgramDay, records, streak, toKg, weeklySets, type FitData, type Goal, type Units } from "@shared/fit";
import { useFitData, useLibrary, type Update } from "./fitStore";
import { ExerciseDetail, LiveWorkout, TrainTab, libraryFallback, planned, programCover, readActive, startWorkout } from "./FitTrain";
import { FoodTab, latestKg, totals } from "./FitFood";
import { CoverCard, VideoPlayer } from "./FitVideo";
import { videoFor, videoOfTheDay } from "@shared/fitVideos";
import { Bar, Btn, C, Card, Columns, Field, Ring, Sheet, Spark, Title, fmtNum, font, inputCls, inputStyle } from "./fitUi";

type Tab = "today" | "train" | "food" | "progress";

function Setup({ data, update, onDone }: { data: FitData; update: Update; onDone: () => void }) {
  const p = data.profile;
  const [units, setUnits] = useState<Units>(p.units);
  const [goal, setGoal] = useState<Goal>(p.goal);
  const [sex, setSex] = useState(p.sex ?? "");
  const [year, setYear] = useState(p.birthYear ? String(p.birthYear) : "");
  const [height, setHeight] = useState(p.heightCm ? String(units === "kg" ? p.heightCm : Math.round(p.heightCm / 2.54)) : "");
  const [weight, setWeight] = useState(() => { const kg = latestKg(data); return kg ? String(Math.round(fromKg(kg, units))) : ""; });
  const [activity, setActivity] = useState(p.activity);
  const save = () => {
    const h = Number(height), w = Number(weight), y = Number(year);
    update((d) => ({ ...d, onboarded: true,
      profile: { ...d.profile, units, goal, activity, ...(sex ? { sex: sex as "m" | "f" } : {}), ...(y > 1900 ? { birthYear: y } : {}), ...(h > 0 ? { heightCm: units === "kg" ? h : Math.round(h * 2.54) } : {}) },
      weights: w > 0 ? [...d.weights.filter((x) => x.date !== dayKey()), { date: dayKey(), kg: Math.round(toKg(w, units) * 10) / 10 }] : d.weights }));
    onDone();
  };
  const pill = (on: boolean) => (on ? { background: C.lime, color: "#10120a" } : { background: C.card2, color: C.text });
  return <Sheet title="Your goals" onClose={() => { update((d) => ({ ...d, onboarded: true })); onDone(); }} testId="fit-setup">
    <p className="mt-2 text-[15px]" style={{ color: C.dim }}>So Arise Fit can set your calories and macros. You can change any of it later.</p>
    <div className="mt-5 space-y-4">
      <Field label="Goal"><div className="grid grid-cols-3 gap-2">{([["lose", "Lose fat"], ["maintain", "Maintain"], ["gain", "Build muscle"]] as const).map(([v, l]) => <button key={v} type="button" onClick={() => setGoal(v)} className="h-12 rounded-[12px] text-[14px] font-semibold" style={pill(goal === v)}>{l}</button>)}</div></Field>
      <Field label="Units"><div className="grid grid-cols-2 gap-2">{(["lb", "kg"] as const).map((v) => <button key={v} type="button" onClick={() => setUnits(v)} className="h-12 rounded-[12px] text-[14px] font-semibold" style={pill(units === v)}>{v === "lb" ? "Pounds, inches" : "Kilograms, cm"}</button>)}</div></Field>
      <Field label="Sex (for the calorie formula)"><div className="grid grid-cols-2 gap-2">{([["m", "Male"], ["f", "Female"]] as const).map(([v, l]) => <button key={v} type="button" onClick={() => setSex(v)} className="h-12 rounded-[12px] text-[14px] font-semibold" style={pill(sex === v)}>{l}</button>)}</div></Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Born (year)"><input inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1995" className={inputCls} style={inputStyle} /></Field>
        <Field label={`Height (${units === "kg" ? "cm" : "in"})`}><input inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder={units === "kg" ? "175" : "69"} className={inputCls} style={inputStyle} /></Field>
        <Field label={`Weight (${units})`}><input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))} placeholder={units === "kg" ? "80" : "175"} className={inputCls} style={inputStyle} /></Field>
      </div>
      <Field label="How active are you?"><select value={activity} onChange={(e) => setActivity(Number(e.target.value))} className={inputCls} style={inputStyle}>
        <option value={1.2}>Mostly sitting</option><option value={1.375}>Light: 1–3 workouts a week</option><option value={1.45}>Moderate: 3–4 a week</option><option value={1.55}>Active: 5–6 a week</option><option value={1.725}>Very active: hard training daily</option></select></Field>
    </div>
    <Btn className="mt-8 w-full" onClick={save} testId="fit-setup-save">Save my goals</Btn>
  </Sheet>;
}

function TodayTab({ data, update, onTab, onStartProgram, user, list }: { data: FitData; update: Update; onTab: (t: Tab) => void; onStartProgram: () => void; user: string; list: ReturnType<typeof libraryFallback> }) {
  const today = dayKey();
  const t = totals(data.foods.filter((f) => f.date === today));
  const g = goals(data.profile, latestKg(data));
  const s = streak(data);
  const prog = data.program ? PROGRAM_BY_ID.get(data.program.id) : undefined;
  const next = prog && data.program ? nextProgramDay(prog, data.program.done) : null;
  const weekAgo = Date.now() - 7 * 864e5;
  const thisWeek = data.workouts.filter((w) => Date.parse(w.date) >= weekAgo);
  const vol = thisWeek.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.reduce((c, x) => c + x.reps * x.weight, 0), 0), 0);
  const hour = new Date().getHours();
  // Today's form tip: from the next workout when there is one, otherwise from the whole catalog.
  const tipId = videoOfTheDay(next ? next.day.items.map((i) => i.exId) : CATALOG.map((e) => e.id));
  const tip = tipId ? list.find((e) => e.id === tipId) : undefined;
  const [watch, setWatch] = useState(false);
  return <div>
    <div className="flex items-end justify-between px-1">
      <div><p className="text-[14px]" style={{ color: C.dim }}>{hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}{user ? `, ${user}` : ""}</p><h1 className="text-[30px] font-bold tracking-tight">Today</h1></div>
      {s > 0 && <div className="flex items-center gap-1 rounded-full px-3 py-1.5" style={{ background: C.card }} aria-label={`${s} day streak`}><Flame className="h-4 w-4" style={{ color: C.orange }} /><span className="text-[15px] font-bold">{s}</span></div>}
    </div>
    <Card className="mt-4 flex items-center gap-4 !p-4" onClick={() => onTab("food")} testId="fit-today-calories">
      <Ring value={t.kcal} goal={g.kcal} size={124}><div><p className="text-[26px] font-bold leading-none">{fmtNum(Math.max(0, g.kcal - t.kcal))}</p><p className="mt-1 text-[11px]" style={{ color: C.dim }}>calories left</p></div></Ring>
      <div className="min-w-0 flex-1 space-y-2.5"><Bar label="Protein" value={t.p} goal={g.p} color={C.pink} /><Bar label="Carbs" value={t.c} goal={g.c} color={C.blue} /><Bar label="Fat" value={t.f} goal={g.f} color={C.orange} /></div>
    </Card>
    {next && prog ? <CoverCard exId={next.day.items.find((i) => videoFor(i.exId))?.exId ?? programCover(prog)} tall className="mt-3 !p-4" testId="fit-today-next">
      <span className="text-[12px] font-bold uppercase tracking-[.14em]" style={{ color: C.lime }}>Up next · Week {next.week}</span>
      <span className="mt-1 block text-[24px] font-extrabold tracking-tight">{next.day.name}</span><span className="block text-[14px]" style={{ color: "#d6d6de" }}>{prog.name} · {next.day.items.length} exercises</span>
      <Btn className="mt-3 w-full" onClick={onStartProgram}><Play className="h-5 w-5" />Start workout</Btn>
    </CoverCard> : <CoverCard exId="back-squat" onClick={() => onTab("train")} className="mt-3"><span className="flex items-end gap-3"><Dumbbell className="h-8 w-8 shrink-0" style={{ color: C.lime }} /><span className="min-w-0 flex-1"><span className="block text-[18px] font-bold">Start training</span><span className="block text-[13px]" style={{ color: "#d6d6de" }}>Pick a program, with a how-to video for every exercise.</span></span><ChevronRight className="h-5 w-5" /></span></CoverCard>}
    <div className="mt-3 grid grid-cols-2 gap-3">
      <Card className="!p-4"><Activity className="h-5 w-5" style={{ color: C.lime }} /><p className="mt-2 text-[24px] font-bold">{thisWeek.length}</p><p className="text-[12px]" style={{ color: C.dim }}>workouts this week</p></Card>
      <Card className="!p-4"><BarChart3 className="h-5 w-5" style={{ color: C.blue }} /><p className="mt-2 text-[24px] font-bold">{fmtNum(vol)}</p><p className="text-[12px]" style={{ color: C.dim }}>{data.profile.units} lifted this week</p></Card>
    </div>
    {tip && <><Title right={<button type="button" onClick={() => setWatch(true)} className="text-[14px] font-semibold" style={{ color: C.lime }}>Cues</button>}>Form tip of the day</Title>
      <VideoPlayer exId={tip.id} label={tip.name} testId="fit-today-tip" /></>}
    <WeightCard data={data} update={update} />
    {watch && tip && <ExerciseDetail ex={tip} data={data} onClose={() => setWatch(false)} />}
  </div>;
}

function WeightCard({ data, update }: { data: FitData; update: Update }) {
  const u = data.profile.units;
  const [val, setVal] = useState("");
  const pts = data.weights.slice(-30).map((w) => ({ x: w.date.slice(5), y: Math.round(fromKg(w.kg, u) * 10) / 10 }));
  return <><Title>Weight</Title><Card>
    <Spark points={pts} color={C.blue} label={(y) => `${y} ${u}`} />
    <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = Number(val); if (n > 0) { update((d) => ({ ...d, weights: [...d.weights.filter((x) => x.date !== dayKey()), { date: dayKey(), kg: Math.round(toKg(n, u) * 10) / 10 }] })); setVal(""); } }}>
      <input inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))} placeholder={`Today's weight (${u})`} className={inputCls} style={inputStyle} data-testid="fit-weight" />
      <Btn type="submit" disabled={!(Number(val) > 0)}><Scale className="h-5 w-5" /></Btn></form>
  </Card></>;
}

function ProgressTab({ data, update, list, onSettings }: { data: FitData; update: Update; list: ReturnType<typeof libraryFallback>; onSettings: () => void }) {
  const u = data.profile.units;
  const rec = useMemo(() => [...records(data.workouts).entries()].sort((a, b) => b[1].e1rm - a[1].e1rm).slice(0, 10), [data.workouts]);
  const name = (id: string) => list.find((e) => e.id === id)?.name ?? CATALOG_BY_ID.get(id)?.name ?? id;
  const muscle = (id: string) => list.find((e) => e.id === id)?.muscle ?? CATALOG_BY_ID.get(id)?.muscle ?? "other";
  const weeks = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    const end = new Date(); end.setHours(23, 59, 59); end.setDate(end.getDate() - (7 - i) * 7 + 7);
    const start = new Date(end); start.setDate(start.getDate() - 7);
    const v = data.workouts.filter((w) => { const d = new Date(w.date); return d > start && d <= end; }).reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.reduce((c, x) => c + x.reps * x.weight, 0), 0), 0);
    const first = new Date(start.getTime() + 864e5);
    return { label: `${first.getMonth() + 1}/${first.getDate()}`, value: v };
  }), [data.workouts]);
  const sets = weeklySets(data.workouts, muscle);
  const food7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const k = dayKey(d); return { label: d.toLocaleDateString(undefined, { weekday: "narrow" }), value: Math.round(totals(data.foods.filter((f) => f.date === k)).kcal) }; });
  return <div>
    <div className="flex items-end justify-between px-1"><h1 className="text-[30px] font-bold tracking-tight">Progress</h1>
      <button type="button" onClick={onSettings} aria-label="Settings" className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card }} data-testid="fit-settings"><Settings className="h-5 w-5" /></button></div>
    <Title>Volume per week ({u})</Title><Card><Columns items={weeks} /></Card>
    <Title>Sets per muscle this week</Title><Card>{Object.keys(sets).length ? <ul className="space-y-2">{Object.entries(sets).sort((a, b) => b[1] - a[1]).map(([m, n]) => <li key={m} className="flex items-center gap-3"><span className="w-24 shrink-0 text-[14px] capitalize">{m}</span>
      <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.08)" }}><div className="h-full rounded-full" style={{ width: `${Math.min(100, (n / 20) * 100)}%`, background: n >= 10 ? C.lime : C.orange }} /></div><span className="w-6 text-right text-[13px] font-semibold tabular-nums">{n}</span></li>)}</ul>
      : <p className="text-[14px]" style={{ color: C.dim }}>Finish a workout to see which muscles you trained. 10–20 hard sets a week per muscle is a good target.</p>}</Card>
    <Title>Calories, last 7 days</Title><Card><Columns items={food7} color={C.orange} /></Card>
    <Title>Personal records</Title>
    {rec.length ? <div className="space-y-2">{rec.map(([id, b]) => <Card key={id} className="flex items-center gap-3 !p-3"><Trophy className="h-5 w-5 shrink-0" style={{ color: C.orange }} />
      <div className="min-w-0 flex-1"><p className="truncate font-semibold">{name(id)}</p><p className="text-[13px]" style={{ color: C.dim }}>{fmtNum(b.weight)} {u} × {b.reps} · {new Date(b.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p></div>
      <div className="text-right"><p className="text-[18px] font-bold">{fmtNum(b.e1rm)}</p><p className="text-[11px]" style={{ color: C.dim }}>est. max</p></div></Card>)}</div>
      : <p className="px-1 text-[14px]" style={{ color: C.dim }}>Your best lifts show up here.</p>}
    <WeightCard data={data} update={update} />
  </div>;
}

function SettingsSheet({ data, update, onClose, onGoals, onAccount }: { data: FitData; update: Update; onClose: () => void; onGoals: () => void; onAccount: () => void }) {
  const { logout } = useAuth();
  const g = goals(data.profile, latestKg(data));
  const [kcal, setKcal] = useState(data.profile.kcalGoal ? String(data.profile.kcalGoal) : "");
  return <Sheet title="Settings" onClose={onClose}>
    <Title>Goals</Title>
    <Card onClick={onGoals} className="!p-4"><div className="flex items-center justify-between"><div><p className="font-semibold">Body and goal</p><p className="text-[13px]" style={{ color: C.dim }}>{g.kcal} calories · P {g.p}g · C {g.c}g · F {g.f}g (maintenance about {g.tdee})</p></div><ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div></Card>
    <Card className="mt-2 !p-4"><Field label="Set my own calorie goal (blank = automatic)"><div className="flex gap-2"><input inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={String(g.kcal)} className={inputCls} style={inputStyle} />
      <Btn kind="soft" onClick={() => update((d) => ({ ...d, profile: { ...d.profile, kcalGoal: Number(kcal) >= 900 ? Number(kcal) : undefined } }))}>Save</Btn></div></Field></Card>
    <Title>Units</Title>
    <div className="grid grid-cols-2 gap-2">{(["lb", "kg"] as const).map((v) => <Btn key={v} kind={data.profile.units === v ? "primary" : "soft"} onClick={() => update((d) => ({ ...d, profile: { ...d.profile, units: v } }))}>{v === "lb" ? "Pounds" : "Kilograms"}</Btn>)}</div>
    <p className="mt-2 px-1 text-[12px]" style={{ color: C.dim }}>Weights you've already logged keep the numbers you typed.</p>
    <Title>Account</Title>
    <Card onClick={onAccount} className="!p-4"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5" style={{ color: C.dim }} /><span className="flex-1 font-semibold">Account & privacy</span><ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div></Card>
    <Btn kind="danger" className="mt-2 w-full" onClick={() => { logout(); goToSignIn(); }} testId="fit-signout"><LogOut className="h-5 w-5" />Sign out</Btn>
    <p className="mt-8 text-center text-[11px] leading-relaxed" style={{ color: C.dim }}>How-to videos play from YouTube and belong to their creators. Exercise photos from wger.de (Creative Commons, credited on each exercise). Food data from USDA FoodData Central and Open Food Facts. Arise Fit isn't medical advice; check with a doctor before starting a new diet or training plan.</p>
  </Sheet>;
}

export default function FitApp() {
  const { user, token } = useAuth();
  const { data, update, loaded, saving } = useFitData(token);
  const fetched = useLibrary(token);
  const list = fetched && fetched.length ? fetched : libraryFallback();
  const [tab, setTab] = useState<Tab>("today");
  const [active, setActive] = useState(readActive);
  const [setup, setSetup] = useState(false);
  const [settings, setSettings] = useState(false);
  const [account, setAccount] = useState(false);
  const [toast, setToast] = useState("");
  const say = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast((t) => (t === m ? "" : t)), 2600); }, []);
  useEffect(() => { if (loaded && !data.onboarded) setSetup(true); }, [loaded, data.onboarded]);
  useEffect(() => { const was = document.documentElement.style.background; document.documentElement.style.background = C.bg; return () => { document.documentElement.style.background = was; }; }, []);
  const startProgram = () => {
    const prog = data.program ? PROGRAM_BY_ID.get(data.program.id) : undefined; if (!prog || !data.program) return;
    const next = nextProgramDay(prog, data.program.done);
    setActive(startWorkout({ name: `${prog.name}: ${next.day.name}`, programId: prog.id, dayId: next.day.id, exercises: planned(data, next.day.items, list) }));
  };
  const first = String(user?.displayName || "").trim().split(/\s+/)[0] || "";
  const tabs: [Tab, string, typeof Home][] = [["today", "Today", Home], ["train", "Train", Dumbbell], ["food", "Food", Apple], ["progress", "Progress", BarChart3]];
  return <div className="fixed inset-0 flex flex-col" style={{ background: C.bg, color: C.text, ...font }} data-testid="fit-app">
    <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-[max(14px,env(safe-area-inset-top))]">
      {tab === "today" && <TodayTab data={data} update={update} onTab={setTab} onStartProgram={startProgram} user={first} list={list} />}
      {tab === "train" && <><h1 className="mb-4 px-1 text-[30px] font-bold tracking-tight">Train</h1><TrainTab data={data} update={update} list={list} onStart={setActive} say={say} /></>}
      {tab === "food" && <><h1 className="mb-3 px-1 text-[30px] font-bold tracking-tight">Food</h1><FoodTab token={token} data={data} update={update} say={say} /></>}
      {tab === "progress" && <ProgressTab data={data} update={update} list={list} onSettings={() => setSettings(true)} />}
      {saving === "offline" && <p className="mt-6 text-center text-[12px]" style={{ color: C.dim }}>Offline: changes are kept on this phone and will save when you're back online.</p>}
    </main>
    <nav aria-label="Arise Fit" className="fixed inset-x-3 z-[40] mx-auto flex max-w-md items-center rounded-[26px] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,.5)]" style={{ bottom: "max(12px, env(safe-area-inset-bottom))", background: "rgba(28,28,36,.92)", backdropFilter: "blur(16px)" }}>
      {tabs.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined} data-testid={`fit-tab-${id}`}
        className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] font-semibold transition" style={tab === id ? { background: "rgba(196,245,58,.14)", color: C.lime } : { color: C.dim }}>
        <Icon className="h-[22px] w-[22px]" />{label}</button>)}
    </nav>
    {active && <LiveWorkout active={active} setActive={setActive} data={data} update={update} list={list} say={say} />}
    {setup && <Setup data={data} update={update} onDone={() => setSetup(false)} />}
    {settings && <SettingsSheet data={data} update={update} onClose={() => setSettings(false)} onGoals={() => { setSettings(false); setSetup(true); }} onAccount={() => setAccount(true)} />}
    {account && <div className="fixed inset-0 z-[90]"><AccountPrivacy onClose={() => setAccount(false)} /></div>}
    <div role="status" aria-live="polite" className={`pointer-events-none fixed left-1/2 z-[95] -translate-x-1/2 rounded-full px-4 py-2.5 text-[14px] font-semibold shadow-xl transition ${toast ? "opacity-100" : "opacity-0"}`} style={{ top: "max(16px, env(safe-area-inset-top))", background: C.text, color: C.bg }}>{toast}</div>
  </div>;
}
