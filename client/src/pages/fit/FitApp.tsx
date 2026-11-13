// Cooked: training and nutrition in one app (the iPhone app built with VITE_NATIVE_APP=fit, and
// #/fit on the website). Tabs: Today, up to three apps you pin (Train, Food and Run to start) and Apps,
// where you add and arrange the rest (FitApps.tsx, shared/fitApps.ts). Data:
// fitStore.ts → server/fit.ts. The look and motion follow the Cooked prototype (fitUi.tsx).
import AllAccessPopup from "@/components/AllAccessPopup";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, Crown, ChevronRight, Utensils, Plus, Droplets, Footprints, HeartPulse, Flame, Home, LayoutGrid, LogOut, Mic, Moon, Play, Scale, Settings, ShieldCheck, Timer, Trophy } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import AccountPrivacy from "@/components/AccountPrivacy";
import { goToSignIn } from "@/lib/hubs";
import { CATALOG, CATALOG_BY_ID, PROGRAM_BY_ID, dayKey, fromKg, goals, nextProgramDay, records, streak, toKg, weeklySets, type FitData, type Goal, type Units } from "@shared/fit";
import { useFitData, useLibrary, type Update } from "./fitStore";
import { ExerciseDetail, LiveWorkout, TrainTab, libraryFallback, planned, readActive, startWorkout } from "./FitTrain";
import { BodyMap } from "./FitBody";
import { SmartWorkoutCard, smartWorkoutNow } from "./FitSmart";
import { CircleSheet } from "./FitCircle";
import { BuddySheet } from "./FitBuddy";
import { PlusProvider, usePlus } from "./FitPlus";
import { EatOut, NearbyGyms, RecipesSheet, prefetchNearby } from "./FitNearby";
import { SiriSheet, useDeepLinks, type SiriAction } from "./FitSiri";
import { ScanMachine } from "./FitGym";
import { programArt } from "./fitArt";
import { SoundsScreen, PillowTracker } from "./FitSleepLab";
import { CounterScreen } from "./FitMindExtras";
import { SleepCheckIn, SleepSheet, sleepLine, useSleepAuto, type SleepGuess } from "./FitSleep";
import { MedsApp, PeriodApp } from "./FitTrackers";
import { AppsTab, APP_ICONS, FriendsApp, GuidedApp, RecoveryApp, StepsApp, WaterApp, YourAppsRow } from "./FitApps";
import { FormCheck } from "./FitForm";
import { FIT_APP_BY_ID, appsOf, type FitAppId } from "@shared/fitApps";
import { readiness } from "@shared/fitReadiness";
import { addNight, emptySleep } from "@shared/fitSleep";
import { SplitCard, VacationCard, VacationSheet } from "./FitVacation";
import { dayGoals } from "@shared/fitVacation";
import { publishWidgets, watchWidgetActions } from "@/lib/widgets";
import { publishWatch, watchActions } from "@/lib/watch";
import { applyFitTaps, applyWatchActions, fitWidgetSlots } from "@/lib/fitWidgets";
import { FoodTab, latestKg, totals } from "./FitFood";
import FitChecklist from "./FitChecklist";
import { FeatureTour, Onboarding } from "./FitOnboard";
import { CoverCard, VideoPlayer } from "./FitVideo";
import { FastingSheet, endFast, startFast } from "./FitFasting";
import { CoachCard, CoachScreen, InviteJoinSheet } from "./FitCoach";
import { OutdoorHub } from "./FitRun";
import { HealthSheet, RemindersSheet, useHealth } from "./FitHealth";
import { saveToHealth } from "./fitNative";
import { DIET_BY_ID, fastingStatus, pointsBudget, pointsOf } from "@shared/fitNutrition";
import { videoOfTheDay } from "@shared/fitVideos";
import { Bar, Btn, C, Card, Columns, Field, Ring, Sheet, Spark, StatusShade, Title, cardStyle, fmtDur, fmtNum, font, glowBg, haptic, inputCls, inputStyle, display, stagger, useFitFonts, Layer, ThemePicker, PointsModeCtx, useFitLayout, useFitTheme, layoutChoice, type LayoutId } from "./fitUi";
import { BloomFlower, BloomRitual, FitNav, LayoutPicker, ProTiles, StudioTrio, ZenRows, type DayVals } from "./FitLayouts";
import { AskFitCard, FitAsk } from "./FitAsk";
import { ProPlusAnalysis, ProPlusBoard } from "./FitProPlus";
import { computeInsights } from "@shared/fitInsights";
import { TipCard } from "./FitVideo";

type Tab = "today" | "apps" | FitAppId;
/** Sheets that open over any tab (from Today, Siri or a link). */
type Over = "" | "sounds" | "counter" | "pillow" | "vacation" | "circle" | "buddy" | "gyms" | "eat" | "recipes" | "siri" | "scan";

/** Ticks once a second while `on` (live timers on Today). */
function useClock(on: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!on) return; const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, [on]);
  return now;
}
/** Guided breathing and meditation aren't workouts: they don't count toward the week or the streak. */
const isWorkout = (w: FitData["workouts"][number]) => w.programId !== "session-meditation";

/** A small card on Today: an icon, one number, what it means, and a ring or bar of progress. */
function Glance({ icon: Icon, color, value, label, pct, onClick, testId, delay = 0 }: { icon: typeof Home; color: string; value: string; label: string; pct?: number; onClick: () => void; testId?: string; delay?: number }) {
  return <button type="button" onClick={() => { haptic("light"); onClick(); }} className="fit-in flex min-h-[96px] flex-col justify-between rounded-[16px] p-3.5 text-left active:scale-[.98]" style={{ ...cardStyle, ...stagger(0, 0, delay) }} data-testid={testId}>
    <span className="flex w-full items-center justify-between"><span className="grid h-8 w-8 place-items-center rounded-[10px]" style={{ background: `${color}22` }}><Icon className="h-[18px] w-[18px]" style={{ color }} /></span>
      {pct != null && <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden><circle cx="13" cy="13" r="10" fill="none" strokeWidth="3.5" style={{ stroke: C.track }} /><circle cx="13" cy="13" r="10" fill="none" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={62.8} strokeDashoffset={62.8 * (1 - Math.min(1, Math.max(0, pct)))} transform="rotate(-90 13 13)" style={{ stroke: color, transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.9,.2,1)" }} /></svg>}</span>
    <span><span className="block text-[26px] leading-none tabular-nums" style={display}>{value}</span><span className="mt-1 block text-[12px] leading-tight" style={{ color: C.dim }}>{label}</span></span>
  </button>;
}

function TodayTab({ layout, data, update, onApp, onAllApps, onStartProgram, onSettings, onCoach, onStart, onOver, token, user, list, sleepGuess, onSkipSleep, say }: { layout: LayoutId; data: FitData; update: Update; onApp: (id: FitAppId) => void; onAllApps: () => void; onStartProgram: () => void; onSettings: () => void; onCoach: () => void; onStart: (a: NonNullable<ReturnType<typeof readActive>>) => void; onOver: (o: Over) => void; token: string | null; user: string; list: ReturnType<typeof libraryFallback>; sleepGuess: SleepGuess | null; onSkipSleep: () => void; say: (m: string) => void }) {
  const today = dayKey();
  const t = totals(data.foods.filter((f) => f.date === today));
  const g = dayGoals(data, latestKg(data));
  const s = streak({ ...data, workouts: data.workouts.filter(isWorkout) });
  const prog = data.program ? PROGRAM_BY_ID.get(data.program.id) : undefined;
  const next = prog && data.program ? nextProgramDay(prog, data.program.done) : null;
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
  const ready = readiness(data);
  const sl = sleepLine(data);
  const kg = data.profile.units === "kg";
  const water = data.water[today] ?? 0;
  const date = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const sleepGlance = <Glance icon={Moon} color="#818cf8" value={sl.big} label={data.sleep?.asleepAt ? sl.small : sl.score != null ? `slept · score ${sl.score}` : "sleep last night"} pct={sl.score != null ? sl.score / 100 : undefined} onClick={() => onApp("sleep")} testId="fit-today-sleep" delay={0.1} />;
  const fastGlance = fast.active ? <Glance icon={Timer} color="#f97316" value={fmtDur(fast.elapsedMs / 1000)} label={`fasting · ${data.fasting?.protocol ?? "16:8"}`} pct={fast.goalMs ? fast.elapsedMs / fast.goalMs : undefined} onClick={() => onApp("fast")} testId="fit-today-fast" delay={0.2} />
    : health ? <Glance icon={Footprints} color="#22c55e" value={fmtNum(health.steps[today] ?? 0)} label={`steps · goal ${fmtNum(data.profile.stepsGoal)}`} pct={(health.steps[today] ?? 0) / data.profile.stepsGoal} onClick={() => onApp("steps")} testId="fit-today-steps" delay={0.2} />
    : <Glance icon={Timer} color="#f97316" value="—" label={`not fasting · ${data.fasting?.protocol ?? "16:8"}`} onClick={() => onApp("fast")} testId="fit-today-fast" delay={0.2} />;
  const round = { background: C.card, boxShadow: cardStyle.boxShadow } as React.CSSProperties;
  const readyColor = ready.score >= 80 ? "#22c55e" : ready.score >= 60 ? "#84cc16" : ready.score >= 40 ? "#f59e0b" : "#ef4444";
  const waterText = (ml: number) => (kg ? `${(ml / 1000).toFixed(1)} L` : `${Math.round(ml / 29.5735)} oz`);
  const trained = data.workouts.filter(isWorkout);
  const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const v: DayVals = {
    ready: { score: ready.score, word: ready.word, color: readyColor },
    sleep: { big: sl.big, small: data.sleep?.asleepAt ? sl.small : sl.score != null ? `score ${sl.score}` : "last night", pct: sl.score != null ? sl.score / 100 : undefined },
    water: { text: waterText(water), goal: waterText(data.profile.waterGoalMl), pct: water / Math.max(1, data.profile.waterGoalMl) },
    food: points ? { left: String(Math.max(0, budget - used)), unit: "pts left", pct: used / Math.max(1, budget), protein: t.p, proteinGoal: g.p } : { left: fmtNum(Math.max(0, g.kcal - t.kcal)), unit: "cal left", pct: t.kcal / Math.max(1, g.kcal), protein: t.p, proteinGoal: g.p },
    fast: { active: fast.active, text: fmtDur(fast.elapsedMs / 1000), label: data.fasting?.protocol ?? "16:8", pct: fast.goalMs ? fast.elapsedMs / fast.goalMs : undefined },
    streak: s, weekCount: new Set(trained.filter((w) => new Date(w.date) >= monday).map((w) => dayKey(new Date(w.date)))).size, trainedToday: trained.some((w) => dayKey(new Date(w.date)) === today),
  };
  const open = (id: "recovery" | "sleep" | "water" | "food" | "fast" | "train") => onApp(id);
  const proLike = layout === "pro" || layout === "proplus";
  const [asking, setAsking] = useState(false);
  const [analysis, setAnalysis] = useState(false);
  const insights = useMemo(() => (layout === "proplus" ? computeInsights(data) : null), [layout, data]);
  const greet = hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const buttons = <div className="flex shrink-0 items-center gap-2 pt-1">
    <PlusButton />
    <button type="button" onClick={onSettings} aria-label="Settings" className="grid h-11 w-11 place-items-center rounded-full" style={round} data-testid="fit-open-settings"><Settings className="h-5 w-5" /></button>
  </div>;
  const header = proLike
    ? <div className="flex items-center justify-between gap-3 px-1"><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[.14em]" style={{ color: C.dim, fontFamily: "var(--fit-num)" }}>{date}</p><h1 className="mt-0.5 truncate text-[26px] leading-tight" style={display}>{greet}{user ? `, ${user}` : ""}</h1></div>{buttons}</div>
    : layout === "zen"
      ? <div className="flex items-start justify-between gap-3 px-1 pt-2"><div className="min-w-0"><p className="text-[13px]" style={{ color: C.dim }}>{date}</p><h1 className="mt-2 text-[44px] leading-[1.02]" style={display}>{greet}{user ? <>,<br />{user}.</> : "."}</h1></div>{buttons}</div>
      : <div className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className={layout === "athletic" ? "text-[12px] tracking-[.16em]" : "text-[13px] font-semibold"} style={layout === "athletic" ? { ...display, color: C.lime } : { color: C.lime }}>{date}</p>
          <h1 className={`mt-1 ${layout === "athletic" ? "text-[40px] leading-[.95]" : "text-[36px] leading-[1.05]"}`} style={display}>{greet}{user ? (layout === "athletic" ? <><br />{user}</> : <>,<br />{user}</>) : ""}</h1>
        </div>{buttons}</div>;
  const heroTabs = next && prog && <div className="mt-4 grid grid-cols-2 gap-1 rounded-[12px] p-1" style={{ background: C.card2 }} role="tablist" aria-label="Today's workout">
    {([["program", prog.name], ["smart", "Built for you"]] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={hero === id} onClick={() => { setHero(id); haptic("light"); }} className="h-9 truncate rounded-[9px] px-2 text-[13px] font-semibold transition-colors" style={hero === id ? { background: C.card, color: C.text, boxShadow: cardStyle.boxShadow } : { color: C.dim }} data-testid={`fit-hero-${id}`}>{label}</button>)}
  </div>;
  const heroCard = <div className="mt-3">
    {next && prog && hero === "program" ? <CoverCard art={programArt(prog)} tall={!proLike} className="fit-in" testId="fit-today-next">
      <span className="text-[12px] tracking-[.14em]" style={{ ...display, color: C.lime }}>Up next · {prog.name} · Week {next.week}</span>
      <span className="mt-0.5 block text-[32px] leading-none" style={display}>{next.day.name}</span>
      <span className="mt-1 block text-[14px]" style={{ color: C.dim }}>{next.day.items.length} exercises · about {Math.round(next.day.items.reduce((a, i) => a + i.sets * (i.rest + 45), 0) / 60)} min</span>
      <span className="mt-2 flex flex-wrap gap-1.5">{next.day.items.slice(0, 4).map((i) => <span key={i.exId} className="rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: C.card2 }}>{CATALOG_BY_ID.get(i.exId)?.name ?? i.exId}</span>)}{next.day.items.length > 4 && <span className="rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: C.card2, color: C.dim }}>+{next.day.items.length - 4}</span>}</span>
      <Btn className="relative z-[1] mt-3 w-full !min-h-[52px]" onClick={() => { haptic("medium"); onStartProgram(); }} testId="fit-today-start"><Play className="h-5 w-5" fill="currentColor" />Start workout</Btn>
    </CoverCard> : <SmartWorkoutCard data={data} list={list} onStart={onStart} testId="fit-today-smart" />}
  </div>;
  const glanceAll = <div className="mt-3 grid grid-cols-2 gap-2.5" data-testid="fit-glance">
    <Glance icon={HeartPulse} color={readyColor} value={String(ready.score)} label={ready.word} pct={ready.score / 100} onClick={() => onApp("recovery")} testId="fit-today-readiness" delay={0.05} />
    {sleepGlance}
    <Glance icon={Droplets} color="#3b82f6" value={v.water.text} label={`water · goal ${v.water.goal}`} pct={v.water.pct} onClick={() => onApp("water")} testId="fit-today-water" delay={0.15} />
    {fastGlance}
  </div>;
  const calories = <Card className="mt-3 flex items-center gap-4" onClick={() => onApp("food")} testId="fit-today-calories">
    {points
      ? <Ring value={used} goal={budget} size={112}><div><p className="text-[32px] leading-none" style={display}>{Math.max(0, budget - used)}</p><p className="mt-1 whitespace-nowrap text-[10px] uppercase tracking-[.04em]" style={{ color: C.dim }}>pts left</p></div></Ring>
      : <Ring value={t.kcal} goal={g.kcal} size={112}><div><p className="text-[30px] leading-none" style={display}>{fmtNum(Math.max(0, g.kcal - t.kcal))}</p><p className="mt-1 whitespace-nowrap text-[10px] uppercase tracking-[.04em]" style={{ color: C.dim }}>cal left</p></div></Ring>}
    <div className="min-w-0 flex-1 space-y-2.5"><Bar label="Protein" value={t.p} goal={g.p} color={C.pink} delay={0.3} /><Bar label="Carbs" value={t.c} goal={g.c} color={C.blue} delay={0.45} /><Bar label="Fat" value={t.f} goal={g.f} color={C.orange} delay={0.6} /></div>
  </Card>;
  const extras = <>
    {layout !== "proplus" && <AskFitCard onOpen={() => setAsking(true)} />}
    {g.note && <p className="mt-2 px-1 text-[13px]" style={{ color: C.steel }} data-testid="fit-vacation-note">{g.note}</p>}
    <SplitCard data={data} update={update} onStart={onStart} />
    {data.vacation && <VacationCard data={data} onOpen={() => onOver("vacation")} />}
    <div className="mt-3"><CoachCard token={token} data={data} list={list} onStart={onStart} onOpen={onCoach} /></div>
    <YourAppsRow data={data} onOpen={onApp} onAll={onAllApps} />
  </>;
  const tipCard = tip && <><Title right={<button type="button" onClick={() => setWatch(true)} className="text-[14px] font-semibold" style={{ color: C.lime }}>Cues</button>}>Form tip of the day</Title>
    <TipCard exId={tip.id} testId="fit-today-tip" /></>;
  const week = <WeekStrip data={data} streak={s} />;
  // Logging a meal is one tap from the top of Today, in every layout, whether or not Food is on the tab bar.
  const logFood = <button type="button" onClick={() => onApp("food")} className="mt-3 flex min-h-[64px] w-full items-center gap-3 rounded-[16px] px-4 text-left transition-transform active:scale-[.98]" style={{ background: "linear-gradient(150deg, var(--fit-accent), var(--fit-accent-deep))", color: "var(--fit-on-accent)" }} data-testid="fit-today-log-food">
    <Utensils className="h-6 w-6 shrink-0" />
    <span className="min-w-0 flex-1"><span className="block text-[19px] leading-tight" style={display}>Log food</span>
      <span className="block truncate text-[12.5px] opacity-90">{points ? `${Math.max(0, budget - used)} points left today` : `${fmtNum(Math.max(0, g.kcal - t.kcal))} cal left today`} · search, scan, photo or quick add</span></span>
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: "rgba(255,255,255,.22)" }}><Plus className="h-5 w-5" /></span>
  </button>;
  const dayCard = <FitChecklist data={data} update={update} steps={health ? health.steps[today] ?? 0 : null} onApp={onApp} />;
  const checkin = sleepGuess && <SleepCheckIn guess={sleepGuess} data={data} update={update} say={say} onSkip={onSkipSleep} />;
  const footer = <>
    <WeightCard data={data} update={update} />
    <p className="mt-4 px-1 text-center text-[12px]" style={{ color: C.dim }}>{DIET_BY_ID.get(data.profile.dietPlan ?? "balanced")?.name} nutrition plan · change it in Food</p>
    {watch && tip && <ExerciseDetail ex={tip} data={data} onClose={() => setWatch(false)} />}
    {asking && <FitAsk token={token} onClose={() => setAsking(false)} />}
    {analysis && insights && <ProPlusAnalysis i={insights} data={data} onClose={() => setAnalysis(false)} onAsk={() => { setAnalysis(false); setAsking(true); }} />}
  </>;
  // Each layout arranges the same pieces its own way.
  const body = layout === "studio" ? <>{checkin}{logFood}{dayCard}<StudioTrio v={v} open={open} />{heroTabs}{heroCard}{week}<div className="mt-3 grid grid-cols-2 gap-2.5">{sleepGlance}{fastGlance}</div>{extras}{tipCard}</>
    : layout === "bloom" ? <>{checkin}{logFood}{dayCard}<BloomFlower v={v} open={open} /><BloomRitual v={v} open={open} />{heroTabs}{heroCard}{week}{extras}{tipCard}</>
    : layout === "proplus" && insights ? <>{checkin}{logFood}{dayCard}<ProTiles v={v} open={open} /><ProPlusBoard i={insights} open={open} onAnalysis={() => setAnalysis(true)} onAsk={() => setAsking(true)} />{heroTabs}{heroCard}{week}{calories}{extras}{tipCard}</>
    : layout === "pro" ? <>{checkin}{logFood}{dayCard}<ProTiles v={v} open={open} />{heroTabs}{heroCard}{week}{calories}{extras}{tipCard}</>
    : layout === "zen" ? <>{checkin}{logFood}{dayCard}{heroTabs}{heroCard}<ZenRows v={v} open={open} />{week}{extras}{tipCard}</>
    : <>{week}{checkin}{logFood}{dayCard}{heroTabs}{heroCard}{glanceAll}{calories}{extras}{tipCard}</>;
  return <div data-layout={layout}>{header}{body}{footer}</div>;
}

/** This week, Monday to Sunday: a filled day for each day trained, today ringed, and the streak. */
function WeekStrip({ data, streak: s }: { data: FitData; streak: number }) {
  const now = new Date();
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const trained = new Set(data.workouts.filter(isWorkout).map((w) => dayKey(new Date(w.date))));
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
        <span className={`grid h-9 w-9 place-items-center rounded-full text-[14px] ${on ? "fit-pop" : ""}`} style={{ ...display, ...(on ? { background: C.lime, color: "var(--fit-on-accent)" } : today ? { boxShadow: `inset 0 0 0 2px ${C.lime}`, color: C.text } : { background: C.card2, color: future ? C.dim : C.text, opacity: future ? 0.6 : 1 }) }}>{on ? <Check className="h-4 w-4" strokeWidth={3} /> : d.getDate()}</span>
      </div>;
    })}</div>
  </Card>;
}

function WeightCard({ data, update }: { data: FitData; update: Update }) {
  const u = data.profile.units;
  const [val, setVal] = useState("");
  const pts = data.weights.slice(-30).map((w) => ({ x: new Date(`${w.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }), y: Math.round(fromKg(w.kg, u) * 10) / 10 }));
  return <><Title>Weight</Title><Card>
    <Spark points={pts} color={C.blue} label={(y) => `${y} ${u}`} />
    <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = Number(val); if (n > 0) { saveToHealth("weight", Math.round(toKg(n, u) * 10) / 10); update((d) => ({ ...d, weights: [...d.weights.filter((x) => x.date !== dayKey()), { date: dayKey(), kg: Math.round(toKg(n, u) * 10) / 10 }] })); setVal(""); } }}>
      <input inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))} placeholder={`Today's weight (${u})`} className={inputCls} style={inputStyle} data-testid="fit-weight" />
      <Btn type="submit" disabled={!(Number(val) > 0)}><Scale className="h-5 w-5" /></Btn></form>
  </Card></>;
}

function ProgressSheet({ data, update, list, onSettings, onClose, inline }: { data: FitData; update: Update; list: ReturnType<typeof libraryFallback>; onSettings: () => void; onClose: () => void; inline?: boolean }) {
  const u = data.profile.units;
  const rec = useMemo(() => [...records(data.workouts).entries()].sort((a, b) => b[1].e1rm - a[1].e1rm).slice(0, 10), [data.workouts]);
  const name = (id: string) => list.find((e) => e.id === id)?.name ?? CATALOG_BY_ID.get(id)?.name ?? id;
  const muscle = (id: string) => list.find((e) => e.id === id)?.muscle ?? CATALOG_BY_ID.get(id)?.muscle ?? "other";
  const weeks = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    // Eight weeks ending today: the last column is the 7 days up to and including today.
    const end = new Date(); end.setHours(23, 59, 59, 999); end.setDate(end.getDate() - (7 - i) * 7);
    const start = new Date(end); start.setDate(start.getDate() - 7);
    const v = data.workouts.filter((w) => { const d = new Date(w.date); return d > start && d <= end; }).reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.reduce((c, x) => c + x.reps * x.weight, 0), 0), 0);
    const first = new Date(start.getTime() + 864e5);
    return { label: `${first.getMonth() + 1}/${first.getDate()}`, value: v };
  }), [data.workouts]);
  const sets = weeklySets(data.workouts, muscle);
  const food7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const k = dayKey(d); return { label: d.toLocaleDateString(undefined, { weekday: "narrow" }), value: Math.round(totals(data.foods.filter((f) => f.date === k)).kcal) }; });
  return <Sheet title="Progress" onClose={onClose} inline={inline} testId="fit-progress" right={<button type="button" onClick={onSettings} aria-label="Settings" className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card }} data-testid="fit-settings"><Settings className="h-5 w-5" /></button>}>
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

function SettingsSheet({ data, update, say, onClose, onGoals, onTour, onAccount, onSiri, onApps }: { data: FitData; update: Update; say: (m: string) => void; onClose: () => void; onGoals: () => void; onTour: () => void; onAccount: () => void; onSiri: () => void; onApps: () => void }) {
  const [sheet, setSheet] = useState<"" | "health" | "reminders">("");
  const { logout } = useAuth();
  const g = goals(data.profile, latestKg(data));
  const [kcal, setKcal] = useState(data.profile.kcalGoal ? String(data.profile.kcalGoal) : "");
  return <Sheet title="Settings" onClose={onClose}>
    <Title>Your app plugins</Title>
    <Card onClick={onApps} className="!p-4" testId="fit-settings-apps"><div className="flex items-center gap-3"><LayoutGrid className="h-5 w-5" style={{ color: C.lime }} /><span className="min-w-0 flex-1"><span className="block font-semibold">App plugins and tab bar</span><span className="block text-[13px]" style={{ color: C.dim }}>{appsOf(data.apps).added.length} app plugins added · {appsOf(data.apps).tabs.map((id) => FIT_APP_BY_ID.get(id)?.name).join(", ") || "nothing pinned"}</span></span><ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div></Card>
    <Title>Layout</Title>
    <LayoutsSetting />
    <Title>Appearance</Title>
    <ThemePicker />
    <Title>Goals</Title>
    <Card onClick={onGoals} className="!p-4"><div className="flex items-center justify-between"><div><p className="font-semibold">Body and goal</p><p className="text-[13px]" style={{ color: C.dim }}>{g.kcal} calories · P {g.p}g · C {g.c}g · F {g.f}g (maintenance about {g.tdee})</p></div><ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div></Card>
    <Card className="mt-2 !p-4"><Field label="Set my own calorie goal (blank = automatic)"><div className="flex gap-2"><input inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={String(g.kcal)} className={inputCls} style={inputStyle} />
      <Btn kind="soft" onClick={() => { const n = Number(kcal); update((d) => ({ ...d, profile: { ...d.profile, kcalGoal: n >= 900 ? n : undefined } })); say(n >= 900 ? `Calorie goal set to ${fmtNum(n)}.` : kcal ? "Goals under 900 calories aren't safe without a doctor. Using the automatic goal." : "Using the automatic calorie goal."); if (kcal && n < 900) setKcal(""); }}>Save</Btn></div></Field></Card>
    <Card onClick={onTour} className="mt-2 !p-4" testId="fit-open-tour"><div className="flex items-center gap-3"><Play className="h-5 w-5" style={{ color: C.lime }} /><span className="flex-1"><span className="block font-semibold">How Cooked works</span><span className="block text-[13px]" style={{ color: C.dim }}>A quick animated tour of every feature</span></span><ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div></Card>
    <Title>Cooked Fitness by Arise Premium</Title>
    <PlusRow />
    <Title>iPhone</Title>
    <Card onClick={() => setSheet("health")} className="!p-4" testId="fit-open-health"><div className="flex items-center gap-3"><HeartPulse className="h-5 w-5" style={{ color: "#ff375f" }} /><span className="flex-1 font-semibold">Apple Health</span><ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div></Card>
    <Card onClick={() => setSheet("reminders")} className="mt-2 !p-4" testId="fit-open-reminders"><div className="flex items-center gap-3"><Bell className="h-5 w-5" style={{ color: C.lime }} /><span className="flex-1"><span className="block font-semibold">Notifications</span><span className="block text-[13px]" style={{ color: C.dim }}>Food, sleep, workouts and alerts</span></span><ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div></Card>
    <Card onClick={onSiri} className="mt-2 !p-4" testId="fit-open-siri"><div className="flex items-center gap-3"><Mic className="h-5 w-5" style={{ color: C.lime }} /><span className="flex-1 font-semibold">Siri & Shortcuts</span><ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div></Card>
    {sheet === "health" && <HealthSheet data={data} update={update} onClose={() => setSheet("")} />}
    {sheet === "reminders" && <RemindersSheet data={data} update={update} onClose={() => setSheet("")} />}
    <Title>Measurements</Title>
    <div className="grid grid-cols-2 gap-2" data-testid="fit-units">{(["lb", "kg"] as const).map((v) => <button key={v} type="button" onClick={() => update((d) => ({ ...d, profile: { ...d.profile, units: v } }))} aria-pressed={data.profile.units === v} className="rounded-[12px] p-3 text-left" style={data.profile.units === v ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card }}>
      <span className="block text-[20px] leading-none" style={display}>{v === "lb" ? "US" : "Metric"}</span><span className="mt-1 block text-[12px] font-semibold">{v === "lb" ? "lb · miles · ft/in · oz" : "kg · km · cm · liters"}</span></button>)}</div>
    <p className="mt-2 px-1 text-[12px]" style={{ color: C.dim }}>Weights, distances, height and water all switch. Weights you've already logged keep the numbers you typed.</p>
    <Title>Account</Title>
    <Card onClick={onAccount} className="!p-4"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5" style={{ color: C.dim }} /><span className="flex-1 font-semibold">Account & privacy</span><ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div></Card>
    <Btn kind="danger" className="mt-2 w-full" onClick={() => { logout(); goToSignIn(); }} testId="fit-signout"><LogOut className="h-5 w-5" />Sign out</Btn>
    <p className="mt-8 text-center text-[11px] leading-relaxed" style={{ color: C.dim }}>How-to videos play from YouTube and belong to their creators. Exercise photos from wger.de (Creative Commons, credited on each exercise). Food data from USDA FoodData Central and Open Food Facts. Cooked isn't medical advice; check with a doctor before starting a new diet or training plan.</p>
  </Sheet>;
}

/** The five layouts, previewed in Light or Dark as the app is showing now. */
function LayoutsSetting() {
  const [, shown] = useFitTheme();
  const { plus, ask } = usePlus();
  return <><LayoutPicker value={layoutChoice()} mode={shown} locked={(id) => id === "proplus" && !plus} onLocked={() => ask("pro-plus")} /><p className="mt-2 px-1 text-[12px]" style={{ color: C.dim }}>Each layout changes the type, shapes, Today and the tab bar. It also picks a matching color, which you can change below.</p></>;
}

/** Today's header: the Fit+ crown (filled when you have it). */
function PlusButton() {
  const { plus, ask } = usePlus();
  return <button type="button" onClick={() => ask()} aria-label={plus ? "Cooked Fitness by Arise Premium" : "Get Cooked Fitness by Arise Premium"} className="grid h-11 w-11 place-items-center rounded-full" style={plus ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card, boxShadow: cardStyle.boxShadow }} data-testid="fit-open-plus"><Crown className="h-5 w-5" /></button>;
}
function PlusRow() {
  const { plus, status, ask } = usePlus();
  return <Card onClick={() => ask()} className="!p-4" testId="fit-settings-plus"><div className="flex items-center gap-3"><Crown className="h-5 w-5" style={{ color: C.lime }} />
    <span className="min-w-0 flex-1"><span className="block font-semibold">{plus ? "You have Fit+" : `Get Fit+ · ${status.price}`}</span><span className="block text-[13px]" style={{ color: C.dim }}>{status.pass.role === "owner" ? (status.pass.guest ? `Guest pass: ${status.pass.guest.name}` : "Guest pass: not shared yet") : status.pass.role === "guest" ? `Guest pass from ${status.pass.owner?.name}` : "Guest pass, plans and billing"}</span></span>
    <ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div></Card>;
}

/** Cooked with Fit+ around it: the toast and a guest pass link live out here so the Fit+ sheet can use them. */
export default function FitApp() {
  const [toast, setToast] = useState("");
  const say = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast((t) => (t === m ? "" : t)), 2600); }, []);
  const [passCode, setPassCode] = useState<string | undefined>();
  return <PlusProvider say={say} passCode={passCode} onPassShown={() => setPassCode(undefined)}>
    <FitMain say={say} onPass={setPassCode} />
    {/* Messages: a small card just above the tab bar, clear of the clock and every close button. */}
    <div role="status" aria-live="polite" className={`pointer-events-none fixed inset-x-4 z-[95] mx-auto flex max-w-sm items-center gap-2.5 rounded-[14px] px-4 py-3 text-[14px] font-semibold leading-snug transition duration-300 ${toast ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`} style={{ bottom: "calc(max(12px, env(safe-area-inset-bottom)) + 76px)", background: C.text, color: C.bg, boxShadow: "0 14px 34px -10px rgba(0,0,0,.45)", ...font }} data-testid="fit-toast">
      {toast && <><Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={3} style={{ color: C.lime }} /><span className="min-w-0 flex-1">{toast}</span></>}</div>
  </PlusProvider>;
}

function FitMain({ say, onPass }: { say: (m: string) => void; onPass: (code: string) => void }) {
  const { user, token } = useAuth();
  useEffect(() => { prefetchNearby(token); }, [token]);
  const { data, update, loaded, saving } = useFitData(token);
  useFitFonts();
  const chosenLayout = useFitLayout();
  const fetched = useLibrary(token);
  const list = fetched && fetched.length ? fetched : libraryFallback();
  const [tab, setTab] = useState<Tab>(readTab);
  const [app, setApp] = useState<FitAppId | null>(null);
  const [active, setActive] = useState(readActive);
  const [setup, setSetup] = useState(false);
  const [tour, setTour] = useState(false);
  const [settings, setSettings] = useState(false);
  const [coach, setCoach] = useState(false);
  // Back from paying a trainer by card (#/fit?paid=cs_…): record it and say so.
  useEffect(() => {
    const m = /[?&]paid=(cs_[A-Za-z0-9_]+)/.exec(window.location.href); if (!m || !token) return;
    try { history.replaceState(null, "", `${window.location.pathname}${window.location.search}${window.location.hash.replace(/[?&]paid=[^&]*/, "").replace(/\?$/, "")}`); } catch { /* keep the address */ }
    void fetch(`${API_BASE}/api/coach/pay/confirm`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ session: m[1] }) })
      .then(async (r) => { const b = await r.json().catch(() => null); say(r.ok ? "Payment sent. Thank you!" : b?.message || "We couldn't confirm that payment yet."); }).catch(() => {});
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  // A trainer's invite link (#/fit?coach=CODE): the join sheet opens once, and the address is cleaned so a reload doesn't repeat it.
  const [invite, setInvite] = useState<string | null>(() => { const m = /[?&]coach=([0-9a-z]{1,10}-[A-Za-z0-9_-]{10})/.exec(window.location.href); return m ? m[1] : null; });
  useEffect(() => { if (!invite) return; try { history.replaceState(null, "", `${window.location.pathname}${window.location.search}${window.location.hash.replace(/[?&]coach=[^&]*/, "").replace(/\?$/, "")}`); } catch { /* keep the address */ } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [form, setForm] = useState(false);
  const [body, setBody] = useState(false);
  const [openEx, setOpenEx] = useState<ReturnType<typeof libraryFallback>[number] | null>(null);
  const [account, setAccount] = useState(false);
  const { plus, ask, loaded: plusLoaded } = usePlus();
  // Pro+ is Fit+: without it (or once it ends) the app shows the plain Pro layout.
  const layout = chosenLayout === "proplus" && !plus ? "pro" : chosenLayout;
  const [over, setOverRaw] = useState<Over>("");
  // Gyms near me and Eat out are Fit+.
  const setOver = (o: Over) => { if ((o === "gyms" || o === "eat") && !plus) { ask(o === "gyms" ? "gyms" : "eat-out"); return; } setOverRaw(o); };
  const [joinCode, setJoinCode] = useState<string | undefined>();
  const [snap, setSnap] = useState(false);
  const apps = appsOf(data.apps);
  const tabIds = apps.tabs.filter((id) => FIT_APP_BY_ID.get(id)?.tab);
  const sleepAuto = useSleepAuto(data, update, loaded, say);
  // Siri, Shortcuts and links: run once the data is here (a link can arrive before it loads).
  const [pending, setPending] = useState<SiriAction | null>(null);
  useDeepLinks((l) => { if (l.circle) { setJoinCode(l.circle); setOverRaw("circle"); } if (l.pass) onPass(l.pass); if (l.action) setPending(l.action); });
  useEffect(() => { if (loaded && !data.onboarded) setSetup(true); }, [loaded, data.onboarded]);
  // A tab that was taken off the tab bar (here or on another device) goes back to Today.
  useEffect(() => { if (tab !== "today" && tab !== "apps" && !tabIds.includes(tab)) setTab("today"); }, [tab, tabIds.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem(TAB_KEY, tab); } catch { /* not kept */ } }, [tab]);
  // Widgets (Home Screen and Lock Screen): what they show, and taps on their buttons (a glass of water).
  useEffect(() => { if (loaded) publishWidgets(fitWidgetSlots(data, latestKg(data))); }, [loaded, data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!loaded) return; return watchWidgetActions((taps) => update((d) => applyFitTaps(d, taps))); }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  // Apple Watch (native/fit-watch): today's numbers, water in a tap, and workouts tracked on the watch.
  useEffect(() => { if (loaded) publishWatch({ slots: fitWidgetSlots(data, latestKg(data)).filter((s) => ["fit.calories", "fit.water", "fit.workouts", "fit.next", "fit.streak", "fit.protein"].includes(s.id)) }); }, [loaded, data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!loaded) return; return watchActions((actions) => update((d) => applyWatchActions(d, actions))); }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const was = document.documentElement.style.background; document.documentElement.style.background = C.bg; return () => { document.documentElement.style.background = was; }; }, []);
  const startProgram = () => {
    const prog = data.program ? PROGRAM_BY_ID.get(data.program.id) : undefined; if (!prog || !data.program) return;
    const next = nextProgramDay(prog, data.program.done);
    setActive(startWorkout({ name: `${prog.name}: ${next.day.name}`, programId: prog.id, dayId: next.day.id, exercises: planned(data, next.day.items, list) }));
  };
  // Where you came from, so Back (and a swipe from the edge) returns to the screen before this one, not
  // always to Today. Opening a screen pushes the one you were on; closing pops it.
  const trail = useRef<Tab[]>([]);
  const go = (t: Tab, back = false) => {
    if (t === tab) return;
    haptic("light");
    if (!back) trail.current = [...trail.current.filter((x) => x !== t), tab].slice(-12);
    setTab(t); setSnap(false); document.getElementById("fit-main")?.scrollTo({ top: 0 });
  };
  const goBack = () => {
    let to = trail.current.pop();
    while (to && to !== "today" && to !== "apps" && !tabIds.includes(to)) to = trail.current.pop();
    go(to ?? "today", true);
  };
  // iPhone swipe-back / browser back: one entry in the history while a screen other than Today is open.
  useEffect(() => {
    if (tab === "today") return;
    window.history.pushState({ fitTab: tab }, "");
    const onPop = () => goBack();
    window.addEventListener("popstate", onPop, { once: true });
    return () => window.removeEventListener("popstate", onPop);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Opens an app: its tab when it's on the tab bar, otherwise over whatever's showing. */
  const openApp = (id: FitAppId) => {
    if (id === "sounds" || id === "pillow") { if (!plus) { ask("sleep-lab"); return; } setOverRaw(id); return; }
    if (id === "counter") { setOverRaw("counter"); return; }
    if (id === "gyms" || id === "eat" || id === "recipes" || id === "scan") { setOver(id); return; }
    if (id === "travel") { setOver("vacation"); return; }
    if (id === "coach") { setCoach(true); return; }
    if (id === "form") { setForm(true); return; }
    if (tabIds.includes(id)) { setApp(null); go(id); return; }
    setApp(id);
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
    } else if (a === "fast-start") { if (data.fasting?.start) say("You're already fasting."); else { startFast(update, data.fasting?.protocol); say("Fast started."); } openApp("fast"); }
    else if (a === "fast-end") { if (data.fasting?.start) { endFast(update); say("Fast ended. Nice work."); } else say("You're not fasting right now."); openApp("fast"); }
    else if (a === "sleep-start") { if (data.sleep?.asleepAt) say("Sleep is already being tracked."); else { update((d) => ({ ...d, sleep: { ...(d.sleep ?? emptySleep()), asleepAt: Date.now() } })); say("Sleep tracking started. Sleep well."); } }
    else if (a === "sleep-end") {
      const at = data.sleep?.asleepAt;
      if (!at) { say("Sleep wasn't being tracked. Open Sleep to add last night."); openApp("sleep"); }
      else if (Date.now() - at < 30 * 60_000) { update((d) => ({ ...d, sleep: { ...(d.sleep ?? emptySleep()), asleepAt: undefined } })); say("That was under 30 minutes, so it wasn't saved."); }
      else { update((d) => ({ ...d, sleep: addNight(d.sleep, at, Date.now(), undefined, { src: "button" }) })); say("Good morning. Last night is saved."); openApp("sleep"); }
    }
    else if (a === "sleep") openApp("sleep");
    else if (a === "yoga") openApp("yoga");
    else if (a === "breathe") openApp("mind");
    else if (a === "meds") openApp("meds");
    else if (a === "period") openApp("period");
    else if (a === "run") openApp("run");
    else if (a === "meal") { setSnap(true); openApp("food"); }
    else setOver(a === "scan" ? "scan" : a === "gyms" ? "gyms" : a === "recipes" ? "recipes" : "circle");
  }, [pending, loaded, plusLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const first = String(user?.displayName || "").trim().split(/\s+/)[0] || "";
  const tabs: [Tab, string, typeof Home][] = [["today", "Today", Home], ...tabIds.map((id): [Tab, string, typeof Home] => { const a = FIT_APP_BY_ID.get(id)!; return [id, TAB_LABEL[id] ?? a.name, APP_ICONS[a.icon] ?? LayoutGrid]; }), ["apps", "Plugins", LayoutGrid]];
  const startNow = (a: NonNullable<ReturnType<typeof readActive>>) => { setCoach(false); setActive(a); };

  /** One app's screen: as a tab (inline) or a sheet over everything. */
  const screen = (id: FitAppId, inline: boolean, close: () => void) => {
    switch (id) {
      case "train": return <Sheet inline={inline} title="Train" onClose={close} testId="fit-app-train"><TrainTab data={data} update={update} list={list} onStart={(a) => { close(); setActive(a); }} say={say} onCoach={() => setCoach(true)} onGyms={() => setOver("gyms")} /></Sheet>;
      case "food": return <Sheet inline={inline} title="Food" onClose={close} testId="fit-app-food"><FoodTab token={token} data={data} update={update} say={say} snap={snap} onRecipes={() => setOver("recipes")} onEatOut={() => setOver("eat")} /></Sheet>;
      case "fast": return <FastingSheet inline={inline} data={data} update={update} onClose={close} />;
      case "run": return <OutdoorHub inline={inline} data={data} update={update} say={say} onClose={close} />;
      case "sleep": return <SleepSheet inline={inline} data={data} update={update} say={say} onClose={close} onBreathe={() => openApp("mind")} />;
      case "yoga": case "mobility": case "hiit": case "c25k": return <GuidedApp kind={id} inline={inline} data={data} update={update} say={say} onClose={close} />;
      case "mind": return <GuidedApp kind="mind" inline={inline} data={data} update={update} say={say} onClose={close} />;
      case "water": return <WaterApp inline={inline} data={data} update={update} say={say} onClose={close} />;
      case "meds": return <MedsApp inline={inline} data={data} update={update} say={say} onClose={close} />;
      case "period": return <PeriodApp inline={inline} data={data} update={update} say={say} onClose={close} />;
      case "steps": return <StepsApp inline={inline} data={data} update={update} say={say} onClose={close} />;
      case "recovery": return <RecoveryApp inline={inline} data={data} onClose={close} onBodyMap={() => setBody(true)} onSleep={() => openApp("sleep")} onYoga={() => openApp("yoga")} />;
      case "progress": return <ProgressSheet inline={inline} data={data} update={update} list={list} onClose={close} onSettings={() => setSettings(true)} />;
      case "friends": return <FriendsApp inline={inline} token={token} onClose={close} onCircle={() => setOverRaw("circle")} onBuddy={() => setOverRaw("buddy")} />;
      default: return null;
    }
  };
  return <PointsModeCtx.Provider value={data.profile.trackMode === "points"}><div className="fixed inset-0 flex flex-col" style={{ background: glowBg, backgroundColor: C.bg, color: C.text, ...font }} data-testid="fit-app">
    <StatusShade />
    <main id="fit-main" className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-[max(14px,var(--sat,env(safe-area-inset-top,0px)))]">
      {/* key={tab}: each tab's screen re-mounts, so it slides up into place and its rings and bars fill. */}
      <div key={tab} className="fit-in">
        {tab === "today" && <TodayTab layout={layout} data={data} update={update} onApp={openApp} onAllApps={() => go("apps")} onStartProgram={startProgram} onSettings={() => setSettings(true)} onCoach={() => setCoach(true)} onStart={startNow} onOver={setOver} token={token} user={first} list={list} sleepGuess={sleepAuto.guess} onSkipSleep={sleepAuto.skip} say={say} />}
        {tab === "apps" && <AppsTab data={data} update={update} say={say} onOpen={openApp} />}
        {tab !== "today" && tab !== "apps" && screen(tab, true, goBack)}
      </div>
      {saving === "offline" && <p className="mt-6 text-center text-[12px]" style={{ color: C.dim }}>Offline: changes are kept on this phone and will save when you're back online.</p>}
    </main>
    {/* The clock and the island sit over a soft band of the page's color, so nothing scrolls under them
        unreadably; and the tab bar has a fade under it, so the page doesn't peek out below it. */}
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[39]" style={{ height: "calc(var(--sat,env(safe-area-inset-top,0px)) + 12px)", backgroundColor: C.bg, backgroundImage: glowBg, backgroundSize: "100% 100dvh", backgroundRepeat: "no-repeat", WebkitMaskImage: "linear-gradient(#000 calc(100% - 12px), transparent)", maskImage: "linear-gradient(#000 calc(100% - 12px), transparent)" }} data-testid="fit-top-shade" />
    <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 z-[39]" style={{ height: "calc(env(safe-area-inset-bottom) + 96px)", background: `linear-gradient(transparent, ${C.bg} 62%)` }} />
    <FitNav layout={layout} tabs={tabs} tab={tab} go={(id) => go(id as Tab)} />
    {app && screen(app, false, () => setApp(null))}
    {active && <LiveWorkout active={active} setActive={setActive} data={data} update={update} list={list} say={say} />}
    {setup && <Onboarding data={data} update={update} edit={!!data.onboarded} onDone={() => setSetup(false)} />}
    {tour && <Layer><FeatureTour onClose={() => setTour(false)} /></Layer>}
    {/* After setup (the first-run goals): the All Access pop-up, once. */}
    <AllAccessPopup userId={user?.id} token={token} ready={loaded && !!data.onboarded && !setup && !tour} dark intro="Cooked Fitness by Arise is free to use. Arise All Access adds Premium with a guest pass for a friend, plus the extras in To Duo, Notes and Podster." />
    {invite && token && <InviteJoinSheet token={token} code={invite} onClose={() => setInvite(null)} onJoined={() => { setInvite(null); setCoach(true); }} />}
    {coach && <CoachScreen token={token} me={Number(user?.id) || 0} data={data} update={update} list={list} onStart={startNow} onClose={() => setCoach(false)} />}
    {form && <FormCheck onClose={() => setForm(false)} />}
    {body && <BodyMap data={data} list={list} onClose={() => setBody(false)} onOpen={setOpenEx} onStart={(name, items) => { setBody(false); setApp(null); setActive(startWorkout({ name, exercises: planned(data, items, list) })); }} />}
    {openEx && <ExerciseDetail ex={openEx} data={data} onClose={() => setOpenEx(null)} />}
    {settings && <SettingsSheet data={data} update={update} say={say} onClose={() => setSettings(false)} onGoals={() => { setSettings(false); setApp(null); setSetup(true); }} onTour={() => { setSettings(false); setApp(null); setTour(true); }} onAccount={() => setAccount(true)} onSiri={() => setOver("siri")} onApps={() => { setSettings(false); setApp(null); go("apps"); }} />}
    {over === "vacation" && <VacationSheet data={data} update={update} list={list} onStart={(a) => setActive(a)} say={say} onClose={() => setOver("")} />}
    {over === "circle" && <CircleSheet onClose={() => { setOver(""); setJoinCode(undefined); }} say={say} joinCode={joinCode} />}
    {over === "buddy" && <BuddySheet onClose={() => setOver("")} say={say} />}
    {over === "gyms" && <NearbyGyms data={data} update={update} say={say} onClose={() => setOver("")} />}
    {over === "eat" && <EatOut data={data} update={update} say={say} onClose={() => setOver("")} />}
    {over === "recipes" && <RecipesSheet data={data} update={update} say={say} onClose={() => setOver("")} />}
    {over === "siri" && <SiriSheet onClose={() => setOver("")} />}
    {over === "sounds" && <SoundsScreen onClose={() => setOver("")} />}
    {over === "pillow" && <PillowTracker data={data} update={update} say={say} onClose={() => setOver("")} />}
    {over === "counter" && <CounterScreen kind="mind" update={update} say={say} onClose={() => setOver("")} />}
    {over === "scan" && <ScanMachine data={data} update={update} onClose={() => setOver("")} />}
    {account && <Layer><div className="fixed inset-0 z-[90]"><AccountPrivacy onClose={() => setAccount(false)} /></div></Layer>}
  </div></PointsModeCtx.Provider>;
}

/** Short tab bar names where an app's name is long. */
const TAB_LABEL: Partial<Record<FitAppId, string>> = { c25k: "5K", hiit: "HIIT", progress: "Stats", recovery: "Ready", meds: "Meds", period: "Period" };
const TAB_KEY = "arise-fit-tab";
/** The tab you were on (Today when the app's been away a while). */
function readTab(): Tab { try { const t = localStorage.getItem(TAB_KEY); return (t as Tab) || "today"; } catch { return "today"; } }
