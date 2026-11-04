// Arise Fit's first-open setup and the animated tour of its features. The setup is a short wizard (goal, body,
// goal weight and pace, activity, diet, gym, calories or Arise Points, then the permissions the app likes to have),
// ending in a plan and the tour. From Settings it opens again as "Your goals" without the tour or permissions.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Activity, Apple, Bell, Check, ChevronLeft, ChevronRight, Dumbbell, Flame, HeartPulse, MapPin, Moon, Route, Sparkles, Target, Timer, Users, X } from "lucide-react";
import { dayKey, fromKg, toKg, type FitData, type Goal, type Profile, type Units } from "@shared/fit";
import { DIET_BY_ID, DIET_PLANS } from "@shared/fitNutrition";
import { GYM_BY_ID, GYM_TYPES } from "@shared/fitGym";
import { PACES, cmToFtIn, defaultPace, finishDate, ftInToCm, goalWeightFits, planFor, weeksToGoal } from "@shared/fitOnboard";
import type { Update } from "./fitStore";
import { latestKg } from "./FitFood";
import { Btn, C, Layer, display, font, glowBg, haptic, inputCls, inputStyle } from "./fitUi";
import { applyReminders, canUseNative, connectHealth, healthConnected, readHealth, readReminders } from "./fitNative";
import { mergeWeights } from "./FitHealth";
import { keepPlace, locate } from "./FitRun";

type StepId = "welcome" | "goal" | "body" | "target" | "activity" | "diet" | "gym" | "track" | "plan" | "access" | "tour";
const ORDER: StepId[] = ["welcome", "goal", "body", "target", "activity", "diet", "gym", "track", "plan", "access", "tour"];

/** A number that climbs to its value, for the plan reveal. */
function useCount(to: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return v;
}

const ONB_CSS = `
.ob-in{animation:obIn .42s cubic-bezier(.2,.9,.2,1) backwards}
@keyframes obIn{from{opacity:0;transform:translateX(34px)}to{opacity:1;transform:none}}
.ob-pop{animation:obPop .5s cubic-bezier(.2,1.4,.4,1) backwards}
@keyframes obPop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
.ob-float{animation:obFloat 5s ease-in-out infinite}
@keyframes obFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.ob-pulse{animation:obPulse 2.4s ease-out infinite}
@keyframes obPulse{0%{transform:scale(.5);opacity:.7}100%{transform:scale(1.9);opacity:0}}
.ob-spin{animation:obSpin 14s linear infinite}
@keyframes obSpin{to{transform:rotate(360deg)}}
.ob-fill{animation:obFill 1.6s cubic-bezier(.2,.9,.2,1) .3s backwards}
@keyframes obFill{from{stroke-dashoffset:var(--len)}}
.ob-rise{transform-origin:bottom;animation:obRise 1.1s cubic-bezier(.2,.9,.2,1) backwards}
@keyframes obRise{from{transform:scaleY(.05)}}
.ob-draw{stroke-dasharray:var(--len);animation:obDraw 3.2s ease-in-out infinite}
@keyframes obDraw{0%{stroke-dashoffset:var(--len)}60%,100%{stroke-dashoffset:0}}
.ob-drop{animation:obDrop 3s cubic-bezier(.3,1.3,.5,1) infinite backwards}
@keyframes obDrop{0%{transform:translateY(-60px);opacity:0}25%{opacity:1}45%,100%{transform:none;opacity:1}}
.ob-bubble{animation:obBubble 5s ease-out infinite backwards}
@keyframes obBubble{0%{opacity:0;transform:translateY(16px) scale(.9)}12%,100%{opacity:1;transform:none}}
.ob-bar{transform-origin:left;animation:obBar linear forwards}
@keyframes obBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (prefers-reduced-motion: reduce){.ob-in,.ob-pop,.ob-float,.ob-pulse,.ob-spin,.ob-fill,.ob-rise,.ob-draw,.ob-drop,.ob-bubble{animation:none!important}.ob-draw{stroke-dasharray:none}}
`;

function Choice({ on, onClick, title, sub, icon, testId }: { on: boolean; onClick: () => void; title: string; sub?: string; icon?: ReactNode; testId?: string }) {
  return <button type="button" onClick={() => { haptic("light"); onClick(); }} aria-pressed={on} data-testid={testId}
    className="flex w-full items-center gap-3 rounded-[14px] p-3.5 text-left transition-transform active:scale-[.985]"
    style={on ? { background: "linear-gradient(180deg, rgba(var(--fit-accent-rgb),.22), rgba(var(--fit-accent-rgb),.08))", boxShadow: `inset 0 0 0 2px ${C.lime}` } : { background: C.card, boxShadow: `inset 0 0 0 1px ${C.line}` }}>
    {icon && <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]" style={{ background: on ? C.lime : C.card2, color: on ? "var(--fit-on-accent)" : C.text }}>{icon}</span>}
    <span className="min-w-0 flex-1"><span className="block text-[17px] font-bold leading-tight">{title}</span>{sub && <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: C.dim }}>{sub}</span>}</span>
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full transition-all" style={on ? { background: C.lime, color: "var(--fit-on-accent)" } : { boxShadow: `inset 0 0 0 2px ${C.line}` }}>{on && <Check className="h-4 w-4" strokeWidth={3} />}</span>
  </button>;
}

const Seg = <T extends string>({ items, value, onChange, testId }: { items: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void; testId?: string }) =>
  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} data-testid={testId}>
    {items.map(([v, l]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => { haptic("light"); onChange(v); }} className="h-12 rounded-[12px] px-2 text-[15px] font-bold transition-transform active:scale-95" style={value === v ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card, color: C.text, boxShadow: `inset 0 0 0 1px ${C.line}` }}>{l}</button>)}
  </div>;

const Label = ({ children }: { children: ReactNode }) => <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: C.dim }}>{children}</span>;
const digits = (s: string, n: number) => s.replace(/\D/g, "").slice(0, n);
const decimal = (s: string) => s.replace(/[^\d.]/g, "").slice(0, 5);

export function Onboarding({ data, update, onDone, edit = false }: { data: FitData; update: Update; onDone: () => void; edit?: boolean }) {
  const p = data.profile;
  const start = useMemo(() => latestKg(data), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [units, setUnits] = useState<Units>(p.units);
  const [goal, setGoal] = useState<Goal>(p.goal);
  const [sex, setSex] = useState<string>(p.sex ?? "");
  const [year, setYear] = useState(p.birthYear ? String(p.birthYear) : "");
  const initFt = p.heightCm ? cmToFtIn(p.heightCm) : { ft: 0, inch: 0 };
  const [ft, setFt] = useState(p.heightCm ? String(initFt.ft) : "");
  const [inch, setInch] = useState(p.heightCm ? String(initFt.inch) : "");
  const [cm, setCm] = useState(p.heightCm ? String(p.heightCm) : "");
  const [weight, setWeight] = useState(start ? String(Math.round(fromKg(start, p.units) * 10) / 10) : "");
  const [goalW, setGoalW] = useState(p.goalKg ? String(Math.round(fromKg(p.goalKg, p.units) * 10) / 10) : "");
  const [pace, setPace] = useState<number>(p.pace ?? 0);
  const [activity, setActivity] = useState(p.activity);
  const [diet, setDiet] = useState(p.dietPlan ?? "");
  const [gymType, setGymType] = useState(p.gym?.type ?? "");
  const [track, setTrack] = useState<"calories" | "points">(p.trackMode ?? "calories");

  const steps = ORDER.filter((s) => !(s === "target" && goal === "maintain") && !(edit && (s === "welcome" || s === "access" || s === "tour")));
  const [i, setI] = useState(0);
  const step = steps[Math.min(i, steps.length - 1)];
  const last = i >= steps.length - 1;

  const heightCm = units === "kg" ? Number(cm) || 0 : Number(ft) > 0 ? ftInToCm(Number(ft), Number(inch) || 0) : 0;
  const curKg = Number(weight) > 0 ? toKg(Number(weight), units) : start ?? 0;
  const goalKg = Number(goalW) > 0 ? toKg(Number(goalW), units) : 0;
  const effPace = goal === "maintain" ? 0 : pace || defaultPace(goal);
  const draft: Profile = { ...p, units, goal, activity, ...(sex ? { sex: sex as "m" | "f" } : {}), ...(Number(year) > 1900 ? { birthYear: Number(year) } : {}), ...(heightCm > 0 ? { heightCm } : {}),
    ...(goal !== "maintain" ? { pace: effPace } : { pace: undefined }), ...(diet && DIET_BY_ID.has(diet) ? { macroSplit: DIET_BY_ID.get(diet)!.split } : {}), kcalGoal: undefined };
  const plan = planFor(draft, curKg || undefined);

  const commit = () => {
    update((d) => {
      const dp = diet ? DIET_BY_ID.get(diet) : undefined;
      const gt = gymType ? GYM_BY_ID.get(gymType) : undefined;
      const changedGoal = goal !== d.profile.goal || (goal !== "maintain" && effPace !== (d.profile.pace ?? 0));
      const profile: Profile = { ...d.profile, units, goal, activity, trackMode: track === "points" ? "points" : undefined,
        ...(sex ? { sex: sex as "m" | "f" } : {}), ...(Number(year) > 1900 ? { birthYear: Number(year) } : {}), ...(heightCm > 0 ? { heightCm } : {}),
        goalKg: goal !== "maintain" && goalKg > 0 ? Math.round(goalKg * 10) / 10 : undefined, pace: goal !== "maintain" ? effPace : undefined,
        ...(dp ? { dietPlan: dp.id, macroSplit: dp.split } : {}), ...(gt && (d.profile.gym?.type !== gt.id) ? { gym: { type: gt.id, gear: [...gt.gear] } } : {}),
        ...(changedGoal || !edit ? { kcalGoal: undefined } : {}) };
      return { ...d, onboarded: true, profile, weights: curKg > 0 && Number(weight) > 0 ? [...d.weights.filter((x) => x.date !== dayKey()), { date: dayKey(), kg: Math.round(curKg * 10) / 10 }] : d.weights };
    });
  };
  const finish = () => { commit(); haptic("success"); onDone(); };
  const skip = () => { if (sex && heightCm > 0 && Number(weight) > 0) commit(); else update((d) => ({ ...d, onboarded: true })); onDone(); };

  const canNext = step === "body" ? !!sex && Number(year) > 1900 && heightCm > 0 && Number(weight) > 0
    : step === "target" ? goalKg > 0 && goalWeightFits(goal, curKg, goalKg) : true;
  const next = () => {
    if (!canNext) return;
    haptic("light");
    // The plan is saved when you leave it, so the permission and tour steps start from a finished profile.
    if (step === "plan") commit();
    if (last) { finish(); return; }
    setI((n) => n + 1);
  };
  const back = () => { if (i > 0) setI((n) => n - 1); };

  const title: Record<StepId, string> = { welcome: "", goal: "What's your goal?", body: "About you", target: "Your target", activity: "How active are you?", diet: "How do you eat?", gym: "Where do you train?", track: "How do you want to track food?", plan: "Your plan", access: "Connect your phone", tour: "" };

  if (step === "tour") return <Layer><style>{ONB_CSS}</style><FeatureTour onClose={finish} /></Layer>;

  return <Layer><style>{ONB_CSS}</style>
    <div className="fixed inset-0 z-[80] flex flex-col" style={{ background: glowBg, backgroundColor: C.bg, color: C.text, ...font }} role="dialog" aria-modal="true" aria-label="Set up Arise Fit" data-testid="fit-setup">
      <div className="shrink-0 px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <button type="button" onClick={back} aria-label="Back" disabled={i === 0} className="grid h-10 w-10 place-items-center rounded-full transition-opacity" style={{ background: C.card, opacity: i === 0 ? 0 : 1 }}><ChevronLeft className="h-5 w-5" /></button>
          <div className="flex min-w-0 flex-1 gap-1" aria-hidden>{steps.map((s, k) => <span key={s} className="h-1.5 flex-1 rounded-full transition-colors duration-500" style={{ background: k <= i ? C.lime : C.track }} />)}</div>
          <button type="button" onClick={edit ? onDone : skip} className="h-10 rounded-full px-3 text-[14px] font-semibold" style={{ color: C.dim }} data-testid="fit-setup-skip">{edit ? "Close" : "Skip"}</button>
        </div>
      </div>
      <div key={step} className="ob-in min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-5">
        {step === "welcome" ? <Welcome /> : <h1 className="text-[40px] leading-[.95]" style={display}>{title[step]}</h1>}

        {step === "goal" && <div className="mt-6 space-y-2.5">
          <Choice on={goal === "lose"} onClick={() => setGoal("lose")} icon={<Flame className="h-5 w-5" />} title="Lose fat" sub="A calorie deficit, protein high, lifting to keep muscle." testId="fit-goal-lose" />
          <Choice on={goal === "maintain"} onClick={() => setGoal("maintain")} icon={<Target className="h-5 w-5" />} title="Stay where I am" sub="Eat at maintenance and train for strength and energy." testId="fit-goal-maintain" />
          <Choice on={goal === "gain"} onClick={() => setGoal("gain")} icon={<Dumbbell className="h-5 w-5" />} title="Build muscle" sub="A small surplus with heavy training." testId="fit-goal-gain" />
        </div>}

        {step === "body" && <div className="mt-5 space-y-4">
          <div><Label>Units</Label><Seg items={[["lb", "US · lb, ft"], ["kg", "Metric · kg, cm"]] as const} value={units} onChange={(u) => { setUnits(u); setWeight(""); setGoalW(""); }} testId="fit-units" /></div>
          <div><Label>Sex (for the calorie formula)</Label><Seg items={[["m", "Male"], ["f", "Female"]] as const} value={(sex || "") as "m" | "f"} onChange={setSex} testId="fit-sex" /></div>
          <div className="grid grid-cols-2 gap-3">
            <label><Label>Born (year)</Label><input inputMode="numeric" value={year} onChange={(e) => setYear(digits(e.target.value, 4))} placeholder="1995" className={inputCls} style={inputStyle} data-testid="fit-year" /></label>
            <label><Label>Weight ({units})</Label><input inputMode="decimal" value={weight} onChange={(e) => setWeight(decimal(e.target.value))} placeholder={units === "kg" ? "80" : "175"} className={inputCls} style={inputStyle} data-testid="fit-weight" /></label>
          </div>
          <div><Label>Height</Label>
            {units === "kg"
              ? <div className="relative"><input inputMode="numeric" value={cm} onChange={(e) => setCm(digits(e.target.value, 3))} placeholder="175" className={inputCls} style={inputStyle} aria-label="Height in centimeters" data-testid="fit-cm" /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px]" style={{ color: C.dim }}>cm</span></div>
              : <div className="grid grid-cols-2 gap-3">
                <div className="relative"><input inputMode="numeric" value={ft} onChange={(e) => setFt(digits(e.target.value, 1))} placeholder="5" className={inputCls} style={inputStyle} aria-label="Feet" data-testid="fit-ft" /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px]" style={{ color: C.dim }}>ft</span></div>
                <div className="relative"><input inputMode="numeric" value={inch} onChange={(e) => setInch(digits(e.target.value, 2))} placeholder="9" className={inputCls} style={inputStyle} aria-label="Inches" data-testid="fit-in" /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px]" style={{ color: C.dim }}>in</span></div>
              </div>}
          </div>
        </div>}

        {step === "target" && goal !== "maintain" && <div className="mt-5 space-y-5">
          <label className="block"><Label>Goal weight ({units})</Label>
            <input inputMode="decimal" value={goalW} onChange={(e) => setGoalW(decimal(e.target.value))} placeholder={units === "kg" ? "72" : "160"} className={`${inputCls} !h-16 !text-[30px] font-bold`} style={inputStyle} data-testid="fit-goal-weight" /></label>
          {goalKg > 0 && curKg > 0 && !goalWeightFits(goal, curKg, goalKg) && <p className="text-[14px]" style={{ color: C.red }} role="alert">{goal === "lose" ? "Your goal weight should be lower than your weight now." : "Your goal weight should be higher than your weight now."}</p>}
          <div><Label>{goal === "lose" ? "How fast do you want to lose it?" : "How fast do you want to gain?"}</Label>
            <div className="space-y-2">{PACES[goal].map((x) => {
              const k = planFor({ ...draft, pace: x.kgPerWeek }, curKg || undefined).kcal;
              const wk = goalKg > 0 && curKg > 0 ? weeksToGoal(curKg, goalKg, x.kgPerWeek) : null;
              return <Choice key={x.id} on={effPace === x.kgPerWeek} onClick={() => setPace(x.kgPerWeek)} title={x.name} testId={`fit-pace-${x.id}`}
                sub={`${x.blurb} About ${k.toLocaleString()} cal a day${wk ? ` · ${wk} weeks, around ${finishDate(wk).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}.`} />;
            })}</div></div>
        </div>}

        {step === "activity" && <div className="mt-6 space-y-2.5">
          {([[1.2, "Mostly sitting", "Desk job, few workouts"], [1.375, "Lightly active", "1 to 3 workouts a week"], [1.45, "Moderately active", "3 to 4 workouts a week"], [1.55, "Very active", "5 to 6 workouts a week"], [1.725, "Athlete", "Hard training every day"]] as const).map(([v, t, s]) =>
            <Choice key={v} on={Math.abs(activity - v) < 0.01} onClick={() => setActivity(v)} icon={<Activity className="h-5 w-5" />} title={t} sub={s} />)}
        </div>}

        {step === "diet" && <div className="mt-5 space-y-2.5">
          <p className="text-[14px]" style={{ color: C.dim }}>Sets your protein, carb and fat split. You can switch any time.</p>
          {DIET_PLANS.map((d) => {
            const rec = goal === "lose" ? "high-protein" : goal === "gain" ? "mass" : "balanced";
            return <Choice key={d.id} on={diet === d.id} onClick={() => setDiet(d.id)} icon={<Apple className="h-5 w-5" />} title={`${d.name}${d.id === rec ? " · Recommended" : ""}`} sub={`${d.split.p}% protein · ${d.split.c}% carbs · ${d.split.f}% fat. ${d.blurb}`} testId={`fit-diet-${d.id}`} />;
          })}
        </div>}

        {step === "gym" && <div className="mt-5 space-y-2.5">
          <p className="text-[14px]" style={{ color: C.dim }}>Workouts are built from the equipment your gym has.</p>
          {GYM_TYPES.map((g) => <Choice key={g.id} on={gymType === g.id} onClick={() => setGymType(g.id)} icon={<Dumbbell className="h-5 w-5" />} title={g.name} sub={g.blurb} testId={`fit-gym-${g.id}`} />)}
        </div>}

        {step === "track" && <div className="mt-6 space-y-3">
          <Choice on={track === "calories"} onClick={() => setTrack("calories")} icon={<Flame className="h-5 w-5" />} title="Calories" sub={`Count calories and macros. About ${plan.kcal.toLocaleString()} cal a day for you.`} testId="fit-track-calories" />
          <Choice on={track === "points"} onClick={() => setTrack("points")} icon={<Sparkles className="h-5 w-5" />} title="Arise Points" sub={`One simple number per food: calories, fat and protein in one score. About ${plan.points} points a day for you.`} testId="fit-track-points" />
          <p className="px-1 text-[13px] leading-snug" style={{ color: C.dim }}>Every food, recipe and restaurant pick shows {track === "points" ? "points" : "calories"} from now on. You can switch in Food any time.</p>
        </div>}

        {step === "plan" && <PlanReveal kcal={plan.kcal} p={plan.p} c={plan.c} f={plan.f} points={plan.points} track={track} goal={goal} weeks={goal !== "maintain" && goalKg > 0 && curKg > 0 ? weeksToGoal(curKg, goalKg, effPace) : null} units={units} curKg={curKg} goalKg={goalKg} />}

        {step === "access" && <Access update={update} />}
        {step === "welcome" && <p className="mt-2 text-[16px] leading-snug" style={{ color: C.steel }}>A minute of questions so your calories, workouts and food picks fit you.</p>}
      </div>
      <div className="shrink-0 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-2">
        <Btn className="w-full !min-h-[56px] !text-[20px]" onClick={next} disabled={!canNext} testId="fit-setup-next">{step === "welcome" ? "Let's go" : step === "plan" ? "Looks good" : step === "access" ? "Continue" : last ? "Finish" : "Continue"}<ChevronRight className="h-5 w-5" /></Btn>
        {step === "access" && <button type="button" onClick={() => setI((n) => n + 1)} className="mt-2 h-10 w-full text-[14px] font-semibold" style={{ color: C.dim }}>Not now</button>}
      </div>
    </div></Layer>;
}

function Welcome() {
  return <div className="flex flex-col items-center pt-8 text-center">
    <div className="relative grid h-44 w-44 place-items-center">
      <span className="ob-pulse absolute inset-0 rounded-full" style={{ background: C.lime, opacity: 0.25 }} />
      <span className="ob-pulse absolute inset-0 rounded-full" style={{ background: C.lime, opacity: 0.25, animationDelay: "1.2s" }} />
      <span className="ob-pop relative"><span className="ob-float grid h-28 w-28 place-items-center rounded-[32px]" style={{ background: `linear-gradient(145deg, ${C.lime}, var(--fit-accent-hi))`, boxShadow: "0 24px 50px -16px rgba(var(--fit-accent-rgb),.8)" }}><Dumbbell className="h-14 w-14" style={{ color: "var(--fit-on-accent)" }} /></span></span>
    </div>
    <h1 className="mt-8 text-[54px] leading-[.9]" style={display}>Welcome to<br /><span style={{ color: C.lime }}>Arise Fit</span></h1>
  </div>;
}

/** The finished plan: calories, macros and points count up, with the weeks to the goal. */
function PlanReveal({ kcal, p, c, f, points, track, goal, weeks, units, curKg, goalKg }: { kcal: number; p: number; c: number; f: number; points: number; track: "calories" | "points"; goal: Goal; weeks: number | null; units: Units; curKg: number; goalKg: number }) {
  const big = useCount(track === "points" ? points : kcal);
  const R = 74, L = 2 * Math.PI * R;
  const macro = (label: string, g: number, color: string, share: number) => <div key={label} className="rounded-[14px] p-3 text-center" style={{ background: C.card }}>
    <p className="text-[26px] leading-none tabular-nums" style={display}>{g}<span className="text-[13px]" style={{ color: C.dim }}> g</span></p>
    <div className="mx-auto mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: C.track }}><span className="ob-bar block h-full rounded-full" style={{ background: color, width: `${share}%`, animationDuration: "1.2s" }} /></div>
    <p className="mt-1.5 text-[12px] font-semibold" style={{ color: C.dim }}>{label}</p></div>;
  return <div className="mt-4" data-testid="fit-plan">
    <div className="relative mx-auto grid h-[200px] w-[200px] place-items-center ob-pop">
      <svg viewBox="0 0 180 180" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="90" cy="90" r={R} fill="none" stroke={C.track} strokeWidth="14" />
        <circle cx="90" cy="90" r={R} fill="none" stroke={C.lime} strokeWidth="14" strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * 0.08} className="ob-fill" style={{ ["--len" as any]: L }} />
      </svg>
      <div className="text-center"><p className="text-[56px] leading-none tabular-nums" style={display}>{big.toLocaleString()}</p><p className="mt-1 text-[13px] font-semibold" style={{ color: C.dim }}>{track === "points" ? "Arise Points a day" : "calories a day"}</p></div>
    </div>
    <p className="mt-2 text-center text-[13px]" style={{ color: C.dim }}>{track === "points" ? `${kcal.toLocaleString()} calories a day` : `${points} Arise Points a day`}</p>
    <div className="mt-5 grid grid-cols-3 gap-2">{macro("Protein", p, C.lime, 80)}{macro("Carbs", c, C.blue, 65)}{macro("Fat", f, C.orange, 45)}</div>
    {goal !== "maintain" && goalKg > 0 && <div className="mt-3 rounded-[14px] p-4" style={{ background: C.card }}>
      <p className="text-[13px] font-semibold" style={{ color: C.dim }}>Your target</p>
      <p className="mt-1 text-[22px] leading-tight" style={display}>{Math.round(fromKg(curKg, units))} → {Math.round(fromKg(goalKg, units))} {units}{weeks ? ` · about ${weeks} weeks` : ""}</p>
      {weeks ? <p className="mt-0.5 text-[13px]" style={{ color: C.steel }}>On pace to get there around {finishDate(weeks).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}. Real progress isn't a straight line; we adjust as you log.</p> : null}
    </div>}
  </div>;
}

type Perm = "idle" | "busy" | "ok" | "err";
/** Apple Health, reminders and location, each asked for with a reason. Outside the iPhone app they just say so. */
function Access({ update }: { update: Update }) {
  const native = canUseNative();
  const [health, setHealth] = useState<Perm>(healthConnected() ? "ok" : "idle");
  const [notes, setNotes] = useState<Perm>("idle");
  const [loc, setLoc] = useState<Perm>("idle");
  const [msg, setMsg] = useState("");
  const askHealth = async () => { setHealth("busy"); try { await connectHealth(); setHealth("ok"); void readHealth().then((s) => update((d) => mergeWeights(d, s))).catch(() => {}); } catch (e: any) { setHealth("err"); setMsg(e.message); } };
  const askNotes = async () => { setNotes("busy"); try { const r = readReminders(); await applyReminders({ ...r, workout: { ...r.workout, on: true } }); setNotes("ok"); } catch (e: any) { setNotes("err"); setMsg(e.message); } };
  const askLoc = async () => { setLoc("busy"); try { const ll = await locate(); keepPlace({ ll, label: "Near you" }); setLoc("ok"); } catch (e: any) { setLoc("err"); setMsg(e.message); } };
  const all = async () => { haptic("medium"); if (health !== "ok") await askHealth(); if (notes !== "ok") await askNotes(); if (loc !== "ok") await askLoc(); };
  const row = (icon: ReactNode, t: string, s: string, st: Perm, go: () => void, id: string) => <div className="flex items-center gap-3 rounded-[14px] p-3.5" style={{ background: C.card }}>
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]" style={{ background: C.card2 }}>{icon}</span>
    <span className="min-w-0 flex-1"><span className="block text-[16px] font-bold leading-tight">{t}</span><span className="mt-0.5 block text-[13px] leading-snug" style={{ color: C.dim }}>{s}</span></span>
    <button type="button" onClick={go} disabled={!native || st === "busy" || st === "ok"} className="h-10 shrink-0 rounded-full px-4 text-[14px] font-bold disabled:opacity-60" style={st === "ok" ? { background: C.green, color: "#fff" } : { background: C.lime, color: "var(--fit-on-accent)" }} data-testid={`fit-allow-${id}`}>{st === "ok" ? "On" : st === "busy" ? "…" : st === "err" ? "Retry" : "Allow"}</button>
  </div>;
  return <div className="mt-4 space-y-2.5">
    <p className="text-[14px]" style={{ color: C.dim }}>{native ? "Optional, and you can change any of these in iPhone Settings." : "These work in the Arise Fit iPhone app. You can skip them here."}</p>
    {row(<HeartPulse className="h-5 w-5" style={{ color: "#ff375f" }} />, "Apple Health", "Steps, active calories and weigh-ins in; your workouts and weight back out.", health, askHealth, "health")}
    {row(<Bell className="h-5 w-5" />, "Reminders", "A nudge for workouts. Fasting alerts too. Change them in Settings.", notes, askNotes, "notes")}
    {row(<MapPin className="h-5 w-5" />, "Location", "For food and gyms near you, and for tracking runs.", loc, askLoc, "location")}
    {native && <Btn kind="soft" className="mt-1 w-full" onClick={all} testId="fit-allow-all">Allow all</Btn>}
    {msg && <p className="rounded-[10px] px-3 py-2 text-[13px]" style={{ background: C.card, color: C.steel }} role="status">{msg}</p>}
  </div>;
}

// ——— The tour ————————————————————————————————————————————————————————————————————————————————

type Slide = { title: string; line: string; tip: string; tint: string; art: ReactNode };
const orb = (c: string, s: string, x: string, y: string, d = "0s") => <span key={x + y} className="ob-float absolute rounded-full blur-2xl" style={{ background: c, width: s, height: s, left: x, top: y, opacity: 0.45, animationDelay: d }} />;
const Ring2 = ({ pct, color, r, w = 10, delay = "0s" }: { pct: number; color: string; r: number; w?: number; delay?: string }) => { const L = 2 * Math.PI * r; return <><circle cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth={w} /><circle cx="100" cy="100" r={r} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - pct)} className="ob-fill" style={{ ["--len" as any]: L, animationDelay: delay }} /></>; };

const SLIDES: Slide[] = [
  { title: "Your day, one glance", line: "Calories, steps, water, workout and streak sit right on Today.", tip: "Tap any card to open it.", tint: "#ff5a1f",
    art: <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90"><Ring2 pct={0.78} color="#ff5a1f" r={84} w={12} /><Ring2 pct={0.55} color="#ffd24a" r={64} w={12} delay=".2s" /><Ring2 pct={0.9} color="#4fd1c5" r={44} w={12} delay=".4s" /></svg> },
  { title: "Workouts built for your gym", line: "Programs and Built-for-you sessions use only the equipment you have. Log sets, rest timers and records as you go.", tip: "Train tab → Start workout.", tint: "#ff8a3d",
    art: <div className="flex h-full items-end justify-center gap-3 pb-6">{[44, 70, 56, 92, 74].map((h, k) => <span key={k} className="ob-rise w-8 rounded-t-[10px]" style={{ height: `${h}%`, background: k === 3 ? "#fff" : "rgba(255,255,255,.45)", animationDelay: `${k * 0.12}s` }} />)}</div> },
  { title: "Log food your way", line: "Search, scan a barcode, snap a photo or describe a meal. Everything shows in your calories or Arise Points.", tip: "Food tab → + on any meal.", tint: "#ffb23f",
    art: <div className="relative h-full w-full">{["🥑", "🍗", "🍚", "🥦"].map((e, k) => <span key={k} className="ob-drop absolute text-[44px]" style={{ left: `${18 + k * 20}%`, top: `${20 + (k % 2) * 28}%`, animationDelay: `${k * 0.35}s` }}>{e}</span>)}</div> },
  { title: "Eat out without guessing", line: "Healthier picks at chains and places near you, ranked to fit what's left in your day.", tip: "Food → Eat out. Pick Match goals.", tint: "#3b82f6",
    art: <div className="relative grid h-full place-items-center"><span className="ob-pulse absolute h-24 w-24 rounded-full bg-white/40" /><span className="ob-pulse absolute h-24 w-24 rounded-full bg-white/40" style={{ animationDelay: "1.2s" }} /><MapPin className="ob-float relative h-16 w-16 text-white" fill="rgba(255,255,255,.3)" /></div> },
  { title: "Fasting made simple", line: "Pick 12:12 up to 20:4, start the clock and get an alert when the fast is done.", tip: "Fasting → Start fast.", tint: "#8b5cf6",
    art: <div className="relative grid h-full place-items-center"><svg viewBox="0 0 200 200" className="absolute h-[88%] -rotate-90"><Ring2 pct={0.66} color="#fff" r={80} w={12} /></svg><Timer className="h-14 w-14 text-white" /></div> },
  { title: "Run, walk, hike", line: "GPS routes with pace and distance, trails near you, saved to Apple Health.", tip: "Run → Start.", tint: "#10b981",
    art: <svg viewBox="0 0 200 200" className="h-full w-full"><path d="M20 160 C 50 90, 80 170, 110 100 S 160 60, 182 36" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" className="ob-draw" style={{ ["--len" as any]: 320 }} /><circle cx="182" cy="36" r="9" fill="#fff" className="ob-pop" /></svg> },
  { title: "Sleep, steps and recovery", line: "Sleep comes in from Apple Health, your bedtime schedule or one tap, with a score every night. Readiness says when to push and when to rest.", tip: "Today → Sleep or Readiness.", tint: "#6366f1",
    art: <div className="relative grid h-full place-items-center"><Moon className="ob-float h-20 w-20 text-white" fill="rgba(255,255,255,.25)" />{[[22, 24], [72, 18], [80, 62], [16, 66]].map(([x, y], k) => <Sparkles key={k} className="ob-pulse absolute h-5 w-5 text-white" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${k * 0.5}s` }} />)}</div> },
  { title: "Coach, circles and buddies", line: "Work with a real trainer, train with friends and keep each other honest.", tip: "Apps → Coach or Friends.", tint: "#ec4899",
    art: <div className="flex h-full flex-col justify-center gap-3 px-4">{[["How's my week?", "self-end bg-white text-[#111]"], ["3 workouts, protein on target. Add a walk tomorrow.", "self-start bg-white/25 text-white"], ["On it 💪", "self-end bg-white text-[#111]"]].map(([t, c], k) => <span key={k} className={`ob-bubble max-w-[78%] rounded-[16px] px-3 py-2 text-[14px] font-semibold ${c}`} style={{ animationDelay: `${k * 0.9}s` }}>{t}</span>)}</div> },
  { title: "Make it yours", line: "Add apps like Yoga, Breathe, Mobility, Intervals and Water, and pin your favorites to the tab bar.", tip: "Apps tab → Get more apps.", tint: "#a855f7",
    art: <div className="grid h-full grid-cols-3 place-content-center gap-3 px-5">{["#c084fc", "#5eead4", "#86efac", "#fb7185", "#60a5fa", "#818cf8"].map((c, k) => <span key={k} className="ob-pop grid h-16 place-items-center rounded-[18px]" style={{ background: `linear-gradient(145deg, ${c}, rgba(0,0,0,.25))`, boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)", animationDelay: `${k * 0.12}s` }}>{[Sparkles, Activity, Users, Flame, Route, Check].map((I, j) => j === k ? <I key={j} className="h-7 w-7 text-white" /> : null)}</span>)}</div> },
  { title: "Widgets, Siri and shortcuts", line: "Add Arise Fit widgets to your Home and Lock Screen, or say \"Hey Siri, log water\".", tip: "Long-press your Home Screen → +.", tint: "#0ea5e9",
    art: <div className="grid h-full grid-cols-2 place-content-center gap-3 px-6">{[Flame, Activity, Users, Route].map((I, k) => <span key={k} className="ob-pop grid h-20 place-items-center rounded-[20px] bg-white/25" style={{ animationDelay: `${k * 0.15}s` }}><I className="h-8 w-8 text-white" /></span>)}</div> },
  { title: "You're all set", line: "That's the tour. Tap the gear any time for your goals, apps, units, reminders and more.", tip: "Settings → How Arise Fit works replays this.", tint: "#ff5a1f",
    art: <div className="grid h-full place-items-center"><span className="ob-pop grid h-28 w-28 place-items-center rounded-full bg-white"><Check className="h-16 w-16" style={{ color: "#ff5a1f" }} strokeWidth={3.5} /></span></div> },
];
const SLIDE_MS = 6000;

/** Full-screen story-style walkthrough: auto-advances, tap the sides to move, press and hold to pause. */
export function FeatureTour({ onClose }: { onClose: () => void }) {
  const [k, setK] = useState(0);
  const [hold, setHold] = useState(false);
  const timer = useRef<number | null>(null);
  const s = SLIDES[k];
  const end = k === SLIDES.length - 1;
  useEffect(() => {
    if (hold || end) return;
    timer.current = window.setTimeout(() => setK((n) => Math.min(SLIDES.length - 1, n + 1)), SLIDE_MS);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [k, hold, end]);
  const go = (d: number) => { haptic("light"); setK((n) => Math.max(0, Math.min(SLIDES.length - 1, n + d))); };
  return <div className="fixed inset-0 z-[90] flex flex-col text-white" style={{ background: `linear-gradient(165deg, ${s.tint} 0%, #14110f 88%)`, transition: "background .6s", ...font }} role="dialog" aria-modal="true" aria-label="How Arise Fit works" data-testid="fit-tour">
    <style>{ONB_CSS}</style>
    {orb("rgba(255,255,255,.5)", "220px", "-60px", "8%")}{orb("rgba(255,255,255,.35)", "260px", "60%", "58%", "1.5s")}
    <div className="relative z-[2] flex gap-1.5 px-4 pt-[max(14px,env(safe-area-inset-top))]" aria-hidden>
      {SLIDES.map((_, n) => <span key={n} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">{n < k ? <span className="block h-full w-full bg-white" /> : n === k ? <span key={`${k}-${hold}`} className="ob-bar block h-full bg-white" style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: hold ? "paused" : "running"}} /> : null}</span>)}
    </div>
    <div className="relative z-[2] flex items-center justify-between px-4 pt-3">
      <span className="text-[13px] font-bold tracking-[.14em]" style={display}>How Arise Fit works</span>
      <button type="button" onClick={onClose} aria-label="Close tour" className="grid h-10 w-10 place-items-center rounded-full bg-black/25"><X className="h-5 w-5" /></button>
    </div>
    <div className="relative z-[1] min-h-0 flex-1" onPointerDown={() => setHold(true)} onPointerUp={() => setHold(false)} onPointerLeave={() => setHold(false)} onPointerCancel={() => setHold(false)}>
      <button type="button" aria-label="Previous" className="absolute inset-y-0 left-0 z-[2] w-1/3" onClick={() => go(-1)} />
      <button type="button" aria-label="Next" className="absolute inset-y-0 right-0 z-[2] w-1/3" onClick={() => go(1)} />
      <div key={k} className="ob-in flex h-full flex-col items-center px-7 pt-4">
        <div className="relative mt-2 h-[min(42vh,300px)] w-[min(78vw,300px)] shrink-0 overflow-hidden rounded-[36px] bg-black/20 shadow-[0_30px_60px_-24px_rgba(0,0,0,.6)] ring-1 ring-white/20">{s.art}</div>
        <h2 className="mt-8 text-center text-[42px] leading-[.95]" style={display}>{s.title}</h2>
        <p className="mt-3 max-w-[340px] text-center text-[17px] leading-snug text-white/85">{s.line}</p>
        <p className="mt-4 rounded-full bg-black/25 px-4 py-2 text-[13px] font-semibold text-white/90">{s.tip}</p>
      </div>
    </div>
    <div className="relative z-[3] px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-2">
      <button type="button" onClick={end ? onClose : () => go(1)} className="h-14 w-full rounded-[14px] bg-white text-[19px] text-[#111] active:scale-[.98]" style={display} data-testid="fit-tour-next">{end ? "Start training" : "Next"}</button>
    </div>
  </div>;
}
