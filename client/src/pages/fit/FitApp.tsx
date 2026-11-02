// Arise Fit: training and nutrition in one app (the iPhone app built with VITE_NATIVE_APP=fit, and
// #/fit on the website). Tabs: Today, Train, Food, Fast, Run (Progress opens from Today). Data:
// fitStore.ts → server/fit.ts. The look and motion follow the Arise Fit prototype (fitUi.tsx).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Apple, BarChart3, Bell, Check, ChefHat, Crown, ChevronRight, Footprints, HeartPulse, Dumbbell, Flame, Home, LogOut, MapPin, Mic, Moon, Play, Route, Scale, Settings, ShieldCheck, Timer, Trophy, Utensils } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import AccountPrivacy from "@/components/AccountPrivacy";
import { goToSignIn } from "@/lib/hubs";
import { CATALOG, CATALOG_BY_ID, PROGRAM_BY_ID, dayKey, fromKg, goals, nextProgramDay, records, streak, toKg, weeklySets, type FitData, type Goal, type Units } from "@shared/fit";
import { useFitData, useLibrary, type Update } from "./fitStore";
import { ExerciseDetail, LiveWorkout, TrainTab, libraryFallback, planned, readActive, startWorkout } from "./FitTrain";
import { BodyMap, MiniBody, recColor } from "./FitBody";
import { SmartWorkoutCard, smartWorkoutNow } from "./FitSmart";
import { CircleCard, CircleSheet } from "./FitCircle";
import { BuddyCard, BuddySheet } from "./FitBuddy";
import { PlusProvider, PlusTag, usePlus } from "./FitPlus";
import { EatOut, NearbyGyms, RecipesSheet } from "./FitNearby";
import { SiriSheet, useDeepLinks, type SiriAction } from "./FitSiri";
import { ScanMachine } from "./FitGym";
import { programArt } from "./fitArt";
import { BODY_PARTS, PART_NAME, recovery } from "@shared/fitRecovery";
import { SleepSheet } from "./FitSleep";
import { SplitCard, VacationCard, VacationSheet } from "./FitVacation";
import { dayGoals } from "@shared/fitVacation";
import { publishWidgets } from "@/lib/widgets";
import { FoodTab, latestKg, totals } from "./FitFood";
import { CoverCard, VideoPlayer } from "./FitVideo";
import { FastingSheet, endFast, startFast } from "./FitFasting";
import { CoachCard, CoachScreen } from "./FitCoach";
import { OutdoorHub } from "./FitRun";
import { HealthSheet, RemindersSheet, StepsCard, useHealth } from "./FitHealth";
import { saveToHealth } from "./fitNative";
import { DIET_BY_ID, fastingStatus, pointsBudget, pointsOf } from "@shared/fitNutrition";
import { videoFor, videoOfTheDay } from "@shared/fitVideos";
import { Bar, Btn, C, Card, Columns, Field, Ring, Sheet, Spark, StatusShade, Title, cardStyle, fmtDur, fmtNum, font, glowBg, haptic, inputCls, inputStyle, display, stagger, useFitFonts, Layer, ThemePicker } from "./fitUi";

/** Today's sleep card line: last night's hours, or an invitation to log. */
function sleepToday(data: FitData) {
  const n = data.sleep?.nights[data.sleep.nights.length - 1];
  if (!n) return "Track your sleep";
  const h = (n.wake - n.bed) / 3_600_000;
  return `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m last night`;
}

type Tab = "today" | "train" | "food" | "fast" | "run";
/** Sheets that open over any tab (from Today, Siri or a link). */
type Over = "" | "vacation" | "sleep" | "circle" | "buddy" | "gyms" | "eat" | "recipes" | "siri" | "scan";

/** Ticks once a second while `on` (live timers on Today). */
function useClock(on: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!on) return; const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, [on]);
  return now;
}

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
  const pill = (on: boolean) => (on ? { background: C.lime, color: "#0b0b0c" } : { background: C.card2, color: C.text });
  return <Sheet title="Your goals" onClose={() => { update((d) => ({ ...d, onboarded: true })); onDone(); }} testId="fit-setup">
    <p className="mt-2 text-[15px]" style={{ color: C.dim }}>So Arise Fit can set your calories and macros. You can change any of it later.</p>
    <div className="mt-5 space-y-4">
      <Field label="Goal"><div className="grid grid-cols-3 gap-2">{([["lose", "Lose fat"], ["maintain", "Maintain"], ["gain", "Build muscle"]] as const).map(([v, l]) => <button key={v} type="button" onClick={() => setGoal(v)} className="h-12 rounded-[8px] text-[14px] font-semibold" style={pill(goal === v)}>{l}</button>)}</div></Field>
      <Field label="Units"><div className="grid grid-cols-2 gap-2">{(["lb", "kg"] as const).map((v) => <button key={v} type="button" onClick={() => setUnits(v)} className="h-12 rounded-[8px] text-[14px] font-semibold" style={pill(units === v)}>{v === "lb" ? "US (lb, ft, mi)" : "Metric (kg, cm, km)"}</button>)}</div></Field>
      <Field label="Sex (for the calorie formula)"><div className="grid grid-cols-2 gap-2">{([["m", "Male"], ["f", "Female"]] as const).map(([v, l]) => <button key={v} type="button" onClick={() => setSex(v)} className="h-12 rounded-[8px] text-[14px] font-semibold" style={pill(sex === v)}>{l}</button>)}</div></Field>
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

function TodayTab({ data, update, onTab, onStartProgram, onProgress, onSettings, onCoach, onStart, onOver, token, user, list }: { data: FitData; update: Update; onTab: (t: Tab) => void; onStartProgram: () => void; onProgress: () => void; onSettings: () => void; onCoach: () => void; onStart: (a: NonNullable<ReturnType<typeof readActive>>) => void; onOver: (o: Over) => void; token: string | null; user: string; list: ReturnType<typeof libraryFallback> }) {
  const today = dayKey();
  const t = totals(data.foods.filter((f) => f.date === today));
  const g = dayGoals(data, latestKg(data));
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
  const health = useHealth(update);
  const fast = fastingStatus(data.fasting, useClock(!!data.fasting?.start));
  const points = data.profile.trackMode === "points";
  const used = data.foods.filter((f) => f.date === today).reduce((n, f) => n + pointsOf({ kcal: f.kcal * f.servings, p: f.p * f.servings, c: f.c * f.servings, f: f.f * f.servings }), 0);
  const budget = pointsBudget(g);
  const [hero, setHero] = useState<"program" | "smart">(next && prog ? "program" : "smart");
  const [body, setBody] = useState(false);
  const [open, setOpen] = useState<ReturnType<typeof libraryFallback>[number] | null>(null);
  const rec = useMemo(() => recovery(data.workouts), [data.workouts]);
  const date = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const round = { background: C.card, boxShadow: cardStyle.boxShadow } as React.CSSProperties;
  return <div>
    <div className="flex items-start justify-between gap-3 px-1">
      <div className="min-w-0">
        <p className="text-[12px] tracking-[.16em]" style={{ ...display, color: C.lime }}>{date}</p>
        <h1 className="mt-1 text-[40px] leading-[.95]" style={display}>{hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}{user ? <><br />{user}</> : ""}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-1">
        <PlusButton />
        <button type="button" onClick={onProgress} aria-label="Progress" className="grid h-11 w-11 place-items-center rounded-full" style={round} data-testid="fit-open-progress"><BarChart3 className="h-5 w-5" /></button>
        <button type="button" onClick={onSettings} aria-label="Settings" className="grid h-11 w-11 place-items-center rounded-full" style={round} data-testid="fit-open-settings"><Settings className="h-5 w-5" /></button>
      </div>
    </div>
    <WeekStrip data={data} streak={s} />
    {next && prog && <div className="mt-4 grid grid-cols-2 gap-1 rounded-[12px] p-1" style={{ background: C.card2 }} role="tablist" aria-label="Today's workout">
      {([["program", prog.name], ["smart", "Built for you"]] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={hero === id} onClick={() => { setHero(id); haptic("light"); }} className="h-9 truncate rounded-[9px] px-2 text-[13px] font-semibold transition-colors" style={hero === id ? { background: C.card, color: C.text, boxShadow: cardStyle.boxShadow } : { color: C.dim }} data-testid={`fit-hero-${id}`}>{label}</button>)}
    </div>}
    <div className="mt-3">
      {next && prog && hero === "program" ? <CoverCard art={programArt(prog)} tall className="fit-in" testId="fit-today-next">
        <span className="text-[12px] tracking-[.14em]" style={{ ...display, color: C.lime }}>Up next · {prog.name} · Week {next.week}</span>
        <span className="mt-0.5 block text-[32px] leading-none" style={display}>{next.day.name}</span>
        <span className="mt-1 block text-[14px]" style={{ color: C.dim }}>{next.day.items.length} exercises · about {Math.round(next.day.items.reduce((a, i) => a + i.sets * (i.rest + 45), 0) / 60)} min</span>
        <span className="mt-2 flex flex-wrap gap-1.5">{next.day.items.slice(0, 4).map((i) => <span key={i.exId} className="rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: C.card2 }}>{CATALOG_BY_ID.get(i.exId)?.name ?? i.exId}</span>)}{next.day.items.length > 4 && <span className="rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: C.card2, color: C.dim }}>+{next.day.items.length - 4}</span>}</span>
        <Btn className="relative z-[1] mt-3 w-full !min-h-[52px] !text-[19px]" onClick={() => { haptic("medium"); onStartProgram(); }} testId="fit-today-start"><Play className="h-5 w-5" fill="currentColor" />Start workout</Btn>
      </CoverCard> : <SmartWorkoutCard data={data} list={list} onStart={onStart} testId="fit-today-smart" />}
    </div>
    <Card className="mt-3 flex items-center gap-4 !py-3" onClick={() => setBody(true)} testId="fit-today-recovery">
      <MiniBody rec={rec} height={138} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] tracking-[.14em]" style={{ ...display, color: C.dim }}>Muscle recovery</p>
        <p className="text-[26px] leading-none" style={display}>{BODY_PARTS.filter((p) => rec[p].pct >= 85).length} of {BODY_PARTS.length} fresh</p>
        <div className="mt-2 space-y-1.5">{[...BODY_PARTS].sort((a, b) => rec[a].pct - rec[b].pct).slice(0, 3).map((p) => <div key={p} className="flex items-center gap-2 text-[12px]">
          <span className="w-[68px] shrink-0 truncate font-semibold">{PART_NAME[p]}</span>
          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: C.track }}><span className="block h-full rounded-full" style={{ width: `${rec[p].pct}%`, background: recColor(rec[p].pct) }} /></span>
          <span className="w-8 text-right tabular-nums" style={{ color: C.dim }}>{rec[p].pct}%</span></div>)}</div>
        <p className="mt-2 flex items-center gap-1 text-[13px] font-semibold" style={{ color: C.lime }}>Open body map <ChevronRight className="h-4 w-4" /></p>
      </div>
    </Card>
    <Card className="mt-3 flex items-center gap-4" onClick={() => onTab("food")} testId="fit-today-calories">
      {points
        ? <Ring value={used} goal={budget} size={118}><div><p className="text-[34px] leading-none" style={display}>{Math.max(0, budget - used)}</p><p className="mt-1 whitespace-nowrap text-[10px] uppercase tracking-[.04em]" style={{ color: C.dim }}>pts left</p></div></Ring>
        : <Ring value={t.kcal} goal={g.kcal} size={118}><div><p className="text-[32px] leading-none" style={display}>{fmtNum(Math.max(0, g.kcal - t.kcal))}</p><p className="mt-1 whitespace-nowrap text-[10px] uppercase tracking-[.04em]" style={{ color: C.dim }}>cal left</p></div></Ring>}
      <div className="min-w-0 flex-1 space-y-2.5"><Bar label="Protein" value={t.p} goal={g.p} color={C.pink} delay={0.3} /><Bar label="Carbs" value={t.c} goal={g.c} color={C.blue} delay={0.45} /><Bar label="Fat" value={t.f} goal={g.f} color={C.orange} delay={0.6} /></div>
    </Card>
    {g.note && <p className="mt-2 px-1 text-[13px]" style={{ color: C.steel }} data-testid="fit-vacation-note">{g.note}</p>}
    <div className="mt-3"><CoachCard token={token} data={data} list={list} onStart={onStart} onOpen={onCoach} /></div>
    <CircleCard token={token} onOpen={() => onOver("circle")} />
    <BuddyCard token={token} onOpen={() => onOver("buddy")} />
    <div className="mt-3 grid grid-cols-3 gap-2" data-testid="fit-near-row">
      {([["gyms", "Gyms near me", MapPin], ["eat", "Eat out", Utensils], ["recipes", "Recipes", ChefHat]] as const).map(([id, label, Icon], i) => <button key={id} type="button" onClick={() => { haptic("light"); onOver(id); }} className="fit-in flex min-h-[78px] flex-col items-start justify-between rounded-[14px] p-3 text-left active:scale-[.98]" style={{ ...cardStyle, ...stagger(i, 0.05) }} data-testid={`fit-open-${id}`}>
        <Icon className="h-5 w-5" style={{ color: C.lime }} /><span className="text-[16px] leading-[1.05]" style={display}>{label}{id !== "recipes" && <PlusTag />}</span></button>)}
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2.5">
      {health ? <Card className="!p-3.5" style={stagger(0, 0, 0.15)}><Footprints className="h-5 w-5" style={{ color: C.lime }} /><p className="mt-2 text-[28px] leading-none tabular-nums" style={display}>{fmtNum(health.steps[today] ?? 0)}</p><p className="mt-1 text-[12px]" style={{ color: C.dim }}>steps today</p></Card>
        : <Card className="!p-3.5" style={stagger(0, 0, 0.15)}><Dumbbell className="h-5 w-5" style={{ color: C.lime }} /><p className="mt-2 text-[28px] leading-none tabular-nums" style={display}>{thisWeek.length}</p><p className="mt-1 text-[12px]" style={{ color: C.dim }}>workouts · 7 days</p></Card>}
      <Card className="!p-3.5" onClick={() => onTab("fast")} style={stagger(0, 0, 0.25)} testId="fit-today-fast"><Timer className="h-5 w-5" style={{ color: C.lime }} /><p className="mt-2 text-[28px] leading-none tabular-nums" style={{ ...display, color: fast.active ? C.text : C.dim }}>{fast.active ? fmtDur(fast.elapsedMs / 1000) : "—"}</p><p className="mt-1 text-[12px]" style={{ color: C.dim }}>{fast.active ? "fasting" : "not fasting"} · {data.fasting?.protocol ?? "16:8"}</p></Card>
      <Card className="!p-3.5" style={stagger(0, 0, 0.35)}><Activity className="h-5 w-5" style={{ color: C.lime }} /><p className="mt-2 text-[28px] leading-none tabular-nums" style={display}>{fmtNum(vol)}</p><p className="mt-1 text-[12px]" style={{ color: C.dim }}>{data.profile.units} lifted · 7 days</p></Card>
      <Card className="!p-3.5" onClick={() => onTab("run")} style={stagger(0, 0, 0.45)}><Route className="h-5 w-5" style={{ color: C.lime }} /><p className="mt-2 text-[28px] leading-none" style={display}>Run</p><p className="mt-1 text-[12px]" style={{ color: C.dim }}>GPS · trails near you</p></Card>
    </div>
    <SplitCard data={data} update={update} onStart={onStart} />
    <VacationCard data={data} onOpen={() => onOver("vacation")} />
    <Card className="mt-3 flex items-center gap-3 !p-3.5" onClick={() => onOver("sleep")} testId="fit-today-sleep"><Moon className="h-5 w-5 shrink-0" style={{ color: C.lime }} />
      <span className="min-w-0 flex-1"><span className="block text-[13px]" style={{ color: C.dim }}>{data.sleep?.asleepAt ? "Sleeping now" : "Sleep"}</span><span className="block text-[22px] leading-none tabular-nums" style={display}>{data.sleep?.asleepAt ? "Tap when you wake" : sleepToday(data)}</span></span>
      <ChevronRight className="h-5 w-5 shrink-0" style={{ color: C.dim }} /></Card>
    {health && <div className="mt-3"><StepsCard data={data} snap={health} /></div>}
    {tip && <><Title right={<button type="button" onClick={() => setWatch(true)} className="text-[14px] font-semibold" style={{ color: C.lime }}>Cues</button>}>Form tip of the day</Title>
      <VideoPlayer exId={tip.id} label={tip.name} testId="fit-today-tip" /></>}
    <WeightCard data={data} update={update} />
    <p className="mt-4 px-1 text-center text-[12px]" style={{ color: C.dim }}>{DIET_BY_ID.get(data.profile.dietPlan ?? "balanced")?.name} nutrition plan · change it in Food</p>
    {watch && tip && <ExerciseDetail ex={tip} data={data} onClose={() => setWatch(false)} />}
    {body && <BodyMap data={data} list={list} onClose={() => setBody(false)} onOpen={setOpen} onStart={(name, items) => { setBody(false); onStart(startWorkout({ name, exercises: planned(data, items, list) })); }} />}
    {open && <ExerciseDetail ex={open} data={data} onClose={() => setOpen(null)} />}
  </div>;
}

/** This week, Monday to Sunday: a filled day for each day trained, today ringed, and the streak. */
function WeekStrip({ data, streak: s }: { data: FitData; streak: number }) {
  const now = new Date();
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const trained = new Set(data.workouts.map((w) => dayKey(new Date(w.date))));
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  const count = days.filter((d) => trained.has(dayKey(d))).length;
  return <Card className="mt-4 !px-3 !py-3" testId="fit-week">
    <div className="mb-2 flex items-center justify-between px-1 text-[13px]">
      <span className="font-semibold">{count ? `${count} ${count === 1 ? "workout" : "workouts"} this week` : "No workouts yet this week"}</span>
      {s > 0 && <span className="flex items-center gap-1 font-semibold" style={{ color: C.lime }}><Flame className="h-4 w-4" style={{ color: C.lime, fill: C.lime }} />{s}-day streak</span>}
    </div>
    <div className="flex justify-between">{days.map((d, i) => {
      const k = dayKey(d), on = trained.has(k), today = k === dayKey(now), future = d > now && !today;
      return <div key={k} className="flex flex-col items-center gap-1" style={stagger(i, 0.03)}>
        <span className="text-[11px] font-semibold" style={{ color: today ? C.lime : C.dim }}>{d.toLocaleDateString(undefined, { weekday: "narrow" })}</span>
        <span className={`grid h-9 w-9 place-items-center rounded-full text-[14px] ${on ? "fit-pop" : ""}`} style={{ ...display, ...(on ? { background: C.lime, color: "#0b0b0c" } : today ? { boxShadow: `inset 0 0 0 2px ${C.lime}`, color: C.text } : { background: C.card2, color: future ? C.dim : C.text, opacity: future ? 0.6 : 1 }) }}>{on ? <Check className="h-4 w-4" strokeWidth={3} /> : d.getDate()}</span>
      </div>;
    })}</div>
  </Card>;
}

function WeightCard({ data, update }: { data: FitData; update: Update }) {
  const u = data.profile.units;
  const [val, setVal] = useState("");
  const pts = data.weights.slice(-30).map((w) => ({ x: w.date.slice(5), y: Math.round(fromKg(w.kg, u) * 10) / 10 }));
  return <><Title>Weight</Title><Card>
    <Spark points={pts} color={C.blue} label={(y) => `${y} ${u}`} />
    <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = Number(val); if (n > 0) { saveToHealth("weight", Math.round(toKg(n, u) * 10) / 10); update((d) => ({ ...d, weights: [...d.weights.filter((x) => x.date !== dayKey()), { date: dayKey(), kg: Math.round(toKg(n, u) * 10) / 10 }] })); setVal(""); } }}>
      <input inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))} placeholder={`Today's weight (${u})`} className={inputCls} style={inputStyle} data-testid="fit-weight" />
      <Btn type="submit" disabled={!(Number(val) > 0)}><Scale className="h-5 w-5" /></Btn></form>
  </Card></>;
}

function ProgressSheet({ data, update, list, onSettings, onClose }: { data: FitData; update: Update; list: ReturnType<typeof libraryFallback>; onSettings: () => void; onClose: () => void }) {
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
  return <Sheet title="Progress" onClose={onClose} testId="fit-progress" right={<button type="button" onClick={onSettings} aria-label="Settings" className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card }} data-testid="fit-settings"><Settings className="h-5 w-5" /></button>}>
    <Title>Volume per week ({u})</Title><Card><Columns items={weeks} /></Card>
    <Title>Sets per muscle this week</Title><Card>{Object.keys(sets).length ? <ul className="space-y-2">{Object.entries(sets).sort((a, b) => b[1] - a[1]).map(([m, n]) => <li key={m} className="flex items-center gap-3"><span className="w-24 shrink-0 text-[14px] capitalize">{m}</span>
      <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: C.track }}><div className="h-full rounded-full" style={{ width: `${Math.min(100, (n / 20) * 100)}%`, background: n >= 10 ? C.lime : C.orange }} /></div><span className="w-6 text-right text-[13px] font-semibold tabular-nums">{n}</span></li>)}</ul>
      : <p className="text-[14px]" style={{ color: C.dim }}>Finish a workout to see which muscles you trained. 10–20 hard sets a week per muscle is a good target.</p>}</Card>
    <Title>Calories, last 7 days</Title><Card><Columns items={food7} color={C.orange} /></Card>
    <Title>Personal records</Title>
    {rec.length ? <div className="space-y-2">{rec.map(([id, b]) => <Card key={id} className="flex items-center gap-3 !p-3"><Trophy className="h-5 w-5 shrink-0" style={{ color: C.orange }} />
      <div className="min-w-0 flex-1"><p className="truncate font-semibold">{name(id)}</p><p className="text-[13px]" style={{ color: C.dim }}>{fmtNum(b.weight)} {u} × {b.reps} · {new Date(b.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p></div>
      <div className="text-right"><p className="text-[18px] font-bold">{fmtNum(b.e1rm)}</p><p className="text-[11px]" style={{ color: C.dim }}>est. max</p></div></Card>)}</div>
      : <p className="px-1 text-[14px]" style={{ color: C.dim }}>Your best lifts show up here.</p>}
    <WeightCard data={data} update={update} />
  </Sheet>;
}

function SettingsSheet({ data, update, onClose, onGoals, onAccount, onSiri }: { data: FitData; update: Update; onClose: () => void; onGoals: () => void; onAccount: () => void; onSiri: () => void }) {
  const [sheet, setSheet] = useState<"" | "health" | "reminders">("");
  const { logout } = useAuth();
  const g = goals(data.profile, latestKg(data));
  const [kcal, setKcal] = useState(data.profile.kcalGoal ? String(data.profile.kcalGoal) : "");
  return <Sheet title="Settings" onClose={onClose}>
    <Title>Appearance</Title>
    <ThemePicker />
    <Title>Goals</Title>
    <Card onClick={onGoals} className="!p-4"><div className="flex items-center justify-between"><div><p className="font-semibold">Body and goal</p><p className="text-[13px]" style={{ color: C.dim }}>{g.kcal} calories · P {g.p}g · C {g.c}g · F {g.f}g (maintenance about {g.tdee})</p></div><ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div></Card>
    <Card className="mt-2 !p-4"><Field label="Set my own calorie goal (blank = automatic)"><div className="flex gap-2"><input inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={String(g.kcal)} className={inputCls} style={inputStyle} />
      <Btn kind="soft" onClick={() => update((d) => ({ ...d, profile: { ...d.profile, kcalGoal: Number(kcal) >= 900 ? Number(kcal) : undefined } }))}>Save</Btn></div></Field></Card>
    <Title>Arise Fit+</Title>
    <PlusRow />
    <Title>iPhone</Title>
    <Card onClick={() => setSheet("health")} className="!p-4" testId="fit-open-health"><div className="flex items-center gap-3"><HeartPulse className="h-5 w-5" style={{ color: "#ff375f" }} /><span className="flex-1 font-semibold">Apple Health</span><ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div></Card>
    <Card onClick={() => setSheet("reminders")} className="mt-2 !p-4" testId="fit-open-reminders"><div className="flex items-center gap-3"><Bell className="h-5 w-5" style={{ color: C.lime }} /><span className="flex-1 font-semibold">Reminders</span><ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div></Card>
    <Card onClick={onSiri} className="mt-2 !p-4" testId="fit-open-siri"><div className="flex items-center gap-3"><Mic className="h-5 w-5" style={{ color: C.lime }} /><span className="flex-1 font-semibold">Siri & Shortcuts</span><ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div></Card>
    {sheet === "health" && <HealthSheet data={data} update={update} onClose={() => setSheet("")} />}
    {sheet === "reminders" && <RemindersSheet onClose={() => setSheet("")} />}
    <Title>Measurements</Title>
    <div className="grid grid-cols-2 gap-2" data-testid="fit-units">{(["lb", "kg"] as const).map((v) => <button key={v} type="button" onClick={() => update((d) => ({ ...d, profile: { ...d.profile, units: v } }))} aria-pressed={data.profile.units === v} className="rounded-[12px] p-3 text-left" style={data.profile.units === v ? { background: C.lime, color: "#0b0b0c" } : { background: C.card }}>
      <span className="block text-[20px] leading-none" style={display}>{v === "lb" ? "US" : "Metric"}</span><span className="mt-1 block text-[12px] font-semibold">{v === "lb" ? "lb · miles · ft/in · oz" : "kg · km · cm · liters"}</span></button>)}</div>
    <p className="mt-2 px-1 text-[12px]" style={{ color: C.dim }}>Weights, distances, height and water all switch. Weights you've already logged keep the numbers you typed.</p>
    <Title>Account</Title>
    <Card onClick={onAccount} className="!p-4"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5" style={{ color: C.dim }} /><span className="flex-1 font-semibold">Account & privacy</span><ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div></Card>
    <Btn kind="danger" className="mt-2 w-full" onClick={() => { logout(); goToSignIn(); }} testId="fit-signout"><LogOut className="h-5 w-5" />Sign out</Btn>
    <p className="mt-8 text-center text-[11px] leading-relaxed" style={{ color: C.dim }}>How-to videos play from YouTube and belong to their creators. Exercise photos from wger.de (Creative Commons, credited on each exercise). Food data from USDA FoodData Central and Open Food Facts. Arise Fit isn't medical advice; check with a doctor before starting a new diet or training plan.</p>
  </Sheet>;
}

/** Today's header: the Fit+ crown (filled when you have it). */
function PlusButton() {
  const { plus, ask } = usePlus();
  return <button type="button" onClick={() => ask()} aria-label={plus ? "Arise Fit+" : "Get Arise Fit+"} className="grid h-11 w-11 place-items-center rounded-full" style={plus ? { background: C.lime, color: "#0b0b0c" } : { background: C.card, boxShadow: cardStyle.boxShadow }} data-testid="fit-open-plus"><Crown className="h-5 w-5" /></button>;
}
function PlusRow() {
  const { plus, status, ask } = usePlus();
  return <Card onClick={() => ask()} className="!p-4" testId="fit-settings-plus"><div className="flex items-center gap-3"><Crown className="h-5 w-5" style={{ color: C.lime }} />
    <span className="min-w-0 flex-1"><span className="block font-semibold">{plus ? "You have Fit+" : `Get Fit+ · ${status.price}`}</span><span className="block text-[13px]" style={{ color: C.dim }}>{status.pass.role === "owner" ? (status.pass.guest ? `Guest pass: ${status.pass.guest.name}` : "Guest pass: not shared yet") : status.pass.role === "guest" ? `Guest pass from ${status.pass.owner?.name}` : "Guest pass, plans and billing"}</span></span>
    <ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div></Card>;
}

/** Arise Fit with Fit+ around it: the toast and a guest pass link live out here so the Fit+ sheet can use them. */
export default function FitApp() {
  const [toast, setToast] = useState("");
  const say = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast((t) => (t === m ? "" : t)), 2600); }, []);
  const [passCode, setPassCode] = useState<string | undefined>();
  return <PlusProvider say={say} passCode={passCode} onPassShown={() => setPassCode(undefined)}>
    <FitMain say={say} onPass={setPassCode} />
    <div role="status" aria-live="polite" className={`pointer-events-none fixed left-1/2 z-[95] -translate-x-1/2 rounded-full px-4 py-2.5 text-[14px] font-semibold shadow-xl transition ${toast ? "opacity-100" : "opacity-0"}`} style={{ top: "max(16px, env(safe-area-inset-top))", background: C.text, color: C.bg }}>{toast}</div>
  </PlusProvider>;
}

function FitMain({ say, onPass }: { say: (m: string) => void; onPass: (code: string) => void }) {
  const { user, token } = useAuth();
  const { data, update, loaded, saving } = useFitData(token);
  useFitFonts();
  const fetched = useLibrary(token);
  const list = fetched && fetched.length ? fetched : libraryFallback();
  const [tab, setTab] = useState<Tab>("today");
  const [active, setActive] = useState(readActive);
  const [setup, setSetup] = useState(false);
  const [settings, setSettings] = useState(false);
  const [progress, setProgress] = useState(false);
  const [coach, setCoach] = useState(false);
  const [account, setAccount] = useState(false);
  const { plus, ask, loaded: plusLoaded } = usePlus();
  const [over, setOverRaw] = useState<Over>("");
  // Gyms near me and Eat out are Fit+.
  const setOver = (o: Over) => { if ((o === "gyms" || o === "eat") && !plus) { ask(o === "gyms" ? "gyms" : "eat-out"); return; } setOverRaw(o); };
  const [joinCode, setJoinCode] = useState<string | undefined>();
  const [snap, setSnap] = useState(false);
  // Siri, Shortcuts and links: run once the data is here (a link can arrive before it loads).
  const [pending, setPending] = useState<SiriAction | null>(null);
  useDeepLinks((l) => { if (l.circle) { setJoinCode(l.circle); setOverRaw("circle"); } if (l.pass) onPass(l.pass); if (l.action) setPending(l.action); });
  useEffect(() => { if (loaded && !data.onboarded) setSetup(true); }, [loaded, data.onboarded]);
  // Widgets (Home Screen and Lock Screen): calories left, workouts this week, protein.
  useEffect(() => {
    if (!loaded) return;
    const today = dayKey(), t = totals(data.foods.filter((f) => f.date === today)), g = dayGoals(data, latestKg(data));
    const left = Math.round(g.kcal - t.kcal), weekAgo = Date.now() - 7 * 864e5;
    const week = data.workouts.filter((w) => Date.parse(w.date) >= weekAgo).length, s = streak(data);
    publishWidgets([
      { title: "Calories left", value: left >= 0 ? String(left) : `${-left} over`, detail: `${Math.round(t.kcal)} of ${g.kcal} eaten`, tint: "#ff5a1f", progress: g.kcal ? t.kcal / g.kcal : 0 },
      { title: "Workouts this week", value: String(week), detail: s ? `${s} day streak` : "Start a streak today", tint: "#22c55e" },
      { title: "Protein today", value: `${Math.round(t.p)} g`, detail: `Goal ${g.p} g`, tint: "#3b82f6", progress: g.p ? t.p / g.p : 0 },
    ]);
  }, [loaded, data.foods, data.workouts, data.profile, data.vacation]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const was = document.documentElement.style.background; document.documentElement.style.background = C.bg; return () => { document.documentElement.style.background = was; }; }, []);
  const startProgram = () => {
    const prog = data.program ? PROGRAM_BY_ID.get(data.program.id) : undefined; if (!prog || !data.program) return;
    const next = nextProgramDay(prog, data.program.done);
    setActive(startWorkout({ name: `${prog.name}: ${next.day.name}`, programId: prog.id, dayId: next.day.id, exercises: planned(data, next.day.items, list) }));
  };
  useEffect(() => {
    if (!pending || !loaded || !plusLoaded) return;
    const a = pending; setPending(null);
    if (a === "workout") {
      if (active) { say("Your workout is already going."); return; }
      if (data.program) startProgram(); else setActive(smartWorkoutNow(data, list));
      haptic("medium");
    } else if (a === "water") {
      const ml = data.profile.units === "kg" ? 250 : 237;
      update((d) => ({ ...d, water: { ...d.water, [dayKey()]: Math.round((d.water[dayKey()] || 0) + ml) } }));
      say(data.profile.units === "kg" ? "Added 250 ml of water." : "Added 8 oz of water.");
    } else if (a === "fast-start") { if (data.fasting?.start) say("You're already fasting."); else { startFast(update, data.fasting?.protocol); say("Fast started."); } setTab("fast"); }
    else if (a === "fast-end") { if (data.fasting?.start) { endFast(update); say("Fast ended. Nice work."); } else say("You're not fasting right now."); setTab("fast"); }
    else if (a === "run") setTab("run");
    else if (a === "meal") { setSnap(true); setTab("food"); }
    else setOver(a === "scan" ? "scan" : a === "gyms" ? "gyms" : a === "recipes" ? "recipes" : "circle");
  }, [pending, loaded, plusLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const first = String(user?.displayName || "").trim().split(/\s+/)[0] || "";
  const tabs: [Tab, string, typeof Home][] = [["today", "Today", Home], ["train", "Train", Dumbbell], ["food", "Food", Apple], ["fast", "Fast", Timer], ["run", "Run", Route]];
  const at = Math.max(0, tabs.findIndex(([id]) => id === tab));
  const go = (t: Tab) => { if (t !== tab) { haptic("light"); setTab(t); setSnap(false); document.getElementById("fit-main")?.scrollTo({ top: 0 }); } };
  return <div className="fixed inset-0 flex flex-col" style={{ background: glowBg, backgroundColor: C.bg, color: C.text, ...font }} data-testid="fit-app">
    <StatusShade />
    <main id="fit-main" className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-[max(14px,env(safe-area-inset-top))]">
      {/* key={tab}: each tab's screen re-mounts, so it slides up into place and its rings and bars fill. */}
      <div key={tab} className="fit-in">
        {tab === "today" && <TodayTab data={data} update={update} onTab={go} onStartProgram={startProgram} onProgress={() => setProgress(true)} onSettings={() => setSettings(true)} onCoach={() => setCoach(true)} onStart={(a) => { setCoach(false); setActive(a); }} onOver={setOver} token={token} user={first} list={list} />}
        {tab === "train" && <><h1 className="mb-4 px-1 text-[46px] leading-[.95]" style={display}>Train</h1><TrainTab data={data} update={update} list={list} onStart={setActive} say={say} onCoach={() => setCoach(true)} onGyms={() => setOver("gyms")} /></>}
        {tab === "food" && <><h1 className="mb-3 px-1 text-[46px] leading-[.95]" style={display}>Food</h1><FoodTab token={token} data={data} update={update} say={say} snap={snap} onRecipes={() => setOver("recipes")} onEatOut={() => setOver("eat")} /></>}
        {tab === "fast" && <FastingSheet inline data={data} update={update} onClose={() => go("today")} />}
        {tab === "run" && <OutdoorHub inline data={data} update={update} say={say} onClose={() => go("today")} />}
      </div>
      {saving === "offline" && <p className="mt-6 text-center text-[12px]" style={{ color: C.dim }}>Offline: changes are kept on this phone and will save when you're back online.</p>}
    </main>
    <nav aria-label="Arise Fit" className="fixed inset-x-3 z-[40] mx-auto flex max-w-md items-center rounded-[14px] p-1.5" style={{ bottom: "max(12px, env(safe-area-inset-bottom))", background: C.nav, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: `${C.navShadow}, inset 0 0 0 1px ${C.navBorder}` }}>
      {/* The highlight slides under the tab you pick. */}
      <span aria-hidden className="absolute bottom-1.5 top-1.5 rounded-[10px]" style={{ width: `calc((100% - 12px) / ${tabs.length})`, left: `calc(6px + ${at} * (100% - 12px) / ${tabs.length})`, background: "linear-gradient(180deg, rgba(255,90,31,.24), rgba(255,90,31,.08))", boxShadow: "inset 0 -2px 0 #ff5a1f", transition: "left .35s cubic-bezier(.2,.9,.2,1)" }} />
      {tabs.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? "page" : undefined} data-testid={`fit-tab-${id}`}
        className="relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] text-[12px] uppercase tracking-[.08em] transition-colors duration-200" style={{ fontFamily: display.fontFamily, fontWeight: 800, color: tab === id ? C.lime : C.dim }}>
        <Icon className="h-[22px] w-[22px]" />{label}</button>)}
    </nav>
    {active && <LiveWorkout active={active} setActive={setActive} data={data} update={update} list={list} say={say} />}
    {setup && <Setup data={data} update={update} onDone={() => setSetup(false)} />}
    {coach && <CoachScreen token={token} me={Number(user?.id) || 0} data={data} update={update} list={list} onStart={(a) => { setCoach(false); setActive(a); }} onClose={() => setCoach(false)} />}
    {progress && <ProgressSheet data={data} update={update} list={list} onClose={() => setProgress(false)} onSettings={() => setSettings(true)} />}
    {settings && <SettingsSheet data={data} update={update} onClose={() => setSettings(false)} onGoals={() => { setSettings(false); setProgress(false); setSetup(true); }} onAccount={() => setAccount(true)} onSiri={() => setOver("siri")} />}
    {over === "vacation" && <VacationSheet data={data} update={update} list={list} onStart={(a) => setActive(a)} say={say} onClose={() => setOver("")} />}
    {over === "sleep" && <SleepSheet data={data} update={update} say={say} onClose={() => setOver("")} />}
    {over === "circle" && <CircleSheet onClose={() => { setOver(""); setJoinCode(undefined); }} say={say} joinCode={joinCode} />}
    {over === "buddy" && <BuddySheet onClose={() => setOver("")} say={say} />}
    {over === "gyms" && <NearbyGyms data={data} update={update} say={say} onClose={() => setOver("")} />}
    {over === "eat" && <EatOut data={data} update={update} say={say} onClose={() => setOver("")} />}
    {over === "recipes" && <RecipesSheet data={data} update={update} say={say} onClose={() => setOver("")} />}
    {over === "siri" && <SiriSheet onClose={() => setOver("")} />}
    {over === "scan" && <ScanMachine data={data} update={update} onClose={() => setOver("")} />}
    {account && <Layer><div className="fixed inset-0 z-[90]"><AccountPrivacy onClose={() => setAccount(false)} /></div></Layer>}
  </div>;
}
