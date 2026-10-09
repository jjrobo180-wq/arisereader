// Food & fitness intake: a few questions before an adult starts their diary, turned into a personal calorie plan.
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Info } from "lucide-react";
import type { ActivityLevel, DietStyle, GoalType, HealthProfile, Member, Sex } from "@shared/familyHub";
import { ACTIVITY_LEVELS, DIET_STYLES, GAIN_RATES, LOSE_RATES, checkIntake, makePlan, maxLoseRate, minGoalWeight } from "@shared/familyHealth";
import { inputClass, plain, primary, shortDate } from "./ui";

type Draft = { sex: Sex | ""; birthYear: string; feet: string; inches: string; weight: string; goal: GoalType | ""; goalWeight: string; rate: number; activity: ActivityLevel | ""; diet: DietStyle };
const STEPS = ["About you", "Weight & goal", "Pace", "Activity", "Nutrition", "Your plan"] as const;
const fmt = (n: number) => Math.round(n).toLocaleString();

export function profileToDraft(p?: HealthProfile, latestWeight?: number): Draft {
  if (!p) return { sex: "", birthYear: "", feet: "", inches: "", weight: latestWeight ? String(latestWeight) : "", goal: "", goalWeight: "", rate: 1, activity: "", diet: "balanced" };
  return { sex: p.sex, birthYear: String(p.birthYear), feet: String(Math.floor(p.heightIn / 12)), inches: String(Math.round((p.heightIn % 12) * 10) / 10), weight: String(latestWeight || p.weight), goal: p.goal, goalWeight: p.goalWeight ? String(p.goalWeight) : "", rate: p.rate || 1, activity: p.activity, diet: p.diet };
}

export default function Intake({ member, today, start, onSave, onCancel }: {
  member: Member; today: string; start: Draft; onSave: (p: HealthProfile) => void; onCancel?: () => void;
}) {
  const [d, setD] = useState<Draft>(start);
  const [step, setStep] = useState(0);
  const heightIn = (Number(d.feet) || 0) * 12 + (Number(d.inches) || 0);
  const weight = Number(d.weight) || 0;
  const profile: HealthProfile = {
    sex: (d.sex || "female") as Sex, birthYear: Number(d.birthYear) || 0, heightIn, weight, goal: (d.goal || "maintain") as GoalType,
    goalWeight: d.goal === "maintain" ? 0 : Number(d.goalWeight) || 0, rate: d.goal === "maintain" ? 0 : d.rate, activity: (d.activity || "light") as ActivityLevel, diet: d.diet, createdAt: new Date().toISOString(),
  };
  const problem = checkIntake(profile, today);
  const skipPace = d.goal === "maintain";
  const order = STEPS.map((_, i) => i).filter((i) => !(skipPace && i === 2));
  const at = order.indexOf(step);
  const go = (dir: 1 | -1) => setStep(order[Math.max(0, Math.min(order.length - 1, at + dir))]);
  const ready = [
    !!d.sex && !!d.birthYear && heightIn > 0 && !(problem && (problem.field === "birthYear" || problem.field === "heightIn")),
    weight > 0 && !!d.goal && !(problem && (problem.field === "weight" || problem.field === "goalWeight")),
    true, !!d.activity, true, !problem,
  ][step];
  const fieldProblem = (fields: string[]) => problem && fields.includes(problem.field) ? <p className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"><Info size={15} className="mt-0.5 shrink-0" />{problem.message}</p> : null;
  const choice = (on: boolean) => `w-full rounded-2xl border-2 p-4 text-left transition ${on ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-white hover:border-violet-300"}`;
  const plan = makePlan(profile, today);
  const fastest = maxLoseRate(weight);

  return <section className="mx-auto max-w-2xl rounded-[1.5rem] border border-[#e7e8f0] bg-white p-5 shadow-[0_8px_28px_#17152b08] sm:p-7">
    <p className="text-xs font-extrabold uppercase tracking-[.18em] text-violet-600">{member.id === "me" ? "Your plan" : `${member.name}'s plan`} · step {at + 1} of {order.length}</p>
    <h2 className="mt-1 text-2xl font-black text-[#232139]">{STEPS[step]}</h2>
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${((at + 1) / order.length) * 100}%` }} /></div>

    <div className="mt-6 space-y-5">
      {step === 0 && <>
        <div><p className="mb-2 text-sm font-bold text-slate-700">Sex <span className="font-normal text-slate-500">(used in the calorie formula)</span></p>
          <div className="grid grid-cols-2 gap-3">{(["female", "male"] as const).map((s) => <button key={s} type="button" onClick={() => setD({ ...d, sex: s })} aria-pressed={d.sex === s} className={choice(d.sex === s)}><span className="text-sm font-black">{s === "female" ? "Female" : "Male"}</span></button>)}</div></div>
        <label className="block text-sm font-bold text-slate-700">Year you were born<input type="number" inputMode="numeric" min={1900} max={Number(today.slice(0, 4))} value={d.birthYear} onChange={(e) => setD({ ...d, birthYear: e.target.value })} placeholder="1990" className={inputClass + " mt-1.5 max-w-[160px]"} /></label>
        <div><p className="mb-1.5 text-sm font-bold text-slate-700">Height</p>
          <div className="flex items-center gap-2"><input type="number" inputMode="numeric" min={3} max={8} value={d.feet} onChange={(e) => setD({ ...d, feet: e.target.value })} aria-label="Feet" placeholder="5" className={inputClass + " w-20"} /><span className="text-sm font-bold text-slate-500">ft</span>
            <input type="number" inputMode="decimal" min={0} max={11.5} step={0.5} value={d.inches} onChange={(e) => setD({ ...d, inches: e.target.value })} aria-label="Inches" placeholder="6" className={inputClass + " w-20"} /><span className="text-sm font-bold text-slate-500">in</span></div></div>
        {d.birthYear.length === 4 && heightIn > 0 && fieldProblem(["birthYear", "heightIn"])}
      </>}

      {step === 1 && <>
        <label className="block text-sm font-bold text-slate-700">Current weight<div className="mt-1.5 flex items-center gap-2"><input type="number" inputMode="decimal" min={70} step={0.1} value={d.weight} onChange={(e) => setD({ ...d, weight: e.target.value })} placeholder="180" className={inputClass + " w-32"} /><span className="text-sm font-bold text-slate-500">lb</span></div></label>
        <div><p className="mb-2 text-sm font-bold text-slate-700">What's your goal?</p>
          <div className="grid gap-3 sm:grid-cols-3">{([["lose", "Lose weight"], ["maintain", "Stay where I am"], ["gain", "Gain weight"]] as const).map(([g, l]) => <button key={g} type="button" onClick={() => setD({ ...d, goal: g, rate: g === "gain" ? 0.5 : g === "lose" ? Math.min(1, fastest || 1) : 0 })} aria-pressed={d.goal === g} className={choice(d.goal === g)}><span className="text-sm font-black">{l}</span></button>)}</div></div>
        {(d.goal === "lose" || d.goal === "gain") && <label className="block text-sm font-bold text-slate-700">Goal weight<div className="mt-1.5 flex items-center gap-2"><input type="number" inputMode="decimal" min={d.goal === "lose" ? minGoalWeight(heightIn) : weight} step={0.5} value={d.goalWeight} onChange={(e) => setD({ ...d, goalWeight: e.target.value })} placeholder={d.goal === "lose" ? String(Math.max(minGoalWeight(heightIn), Math.round(weight * 0.9))) : String(Math.round(weight + 10))} className={inputClass + " w-32"} /><span className="text-sm font-bold text-slate-500">lb</span></div>
          {d.goal === "lose" && weight > 0 && Number(d.goalWeight) > 0 && Number(d.goalWeight) < weight && <span className="mt-1.5 block text-xs font-semibold text-slate-500">That's {fmt(weight - Number(d.goalWeight))} lb to lose.</span>}</label>}
        {weight > 0 && (d.goal === "maintain" || Number(d.goalWeight) > 0) && fieldProblem(["weight", "goalWeight"])}
      </>}

      {step === 2 && <>
        <p className="text-sm text-slate-600">How fast do you want to {d.goal === "gain" ? "gain" : "lose"}? Slower is easier to stick with.</p>
        <div className="grid gap-3">{(d.goal === "gain" ? GAIN_RATES : LOSE_RATES).map((r) => {
          const blocked = d.goal === "lose" && r > fastest;
          const weeks = Math.ceil(Math.abs(weight - Number(d.goalWeight)) / r);
          return <button key={r} type="button" disabled={blocked} onClick={() => setD({ ...d, rate: r })} aria-pressed={d.rate === r} className={choice(d.rate === r) + (blocked ? " cursor-not-allowed opacity-45" : "")}>
            <span className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-sm font-black">{r} lb a week{r === 0.5 ? " · gentle" : r === 1 ? " · recommended" : r === 2 ? " · fastest" : ""}</span><span className="text-xs font-semibold text-slate-500">about {fmt(r * 500)} calories a day {d.goal === "gain" ? "extra" : "less"}</span></span>
            <span className="mt-1 block text-xs text-slate-500">{blocked ? `More than 1% of your body weight a week isn't recommended.` : `About ${weeks} week${weeks === 1 ? "" : "s"} to your goal`}</span>
          </button>;
        })}</div>
      </>}

      {step === 3 && <div className="grid gap-3">{ACTIVITY_LEVELS.map((a) => <button key={a.id} type="button" onClick={() => setD({ ...d, activity: a.id })} aria-pressed={d.activity === a.id} className={choice(d.activity === a.id)}>
        <span className="block text-sm font-black">{a.label}</span><span className="mt-0.5 block text-xs text-slate-500">{a.detail}. Don't count workouts you'll log; those add calories back each day.</span></button>)}</div>}

      {step === 4 && <>
        <p className="text-sm text-slate-600">How do you like to eat? This sets your protein, carbs and fat. You can change it any time.</p>
        <div className="grid gap-3 sm:grid-cols-2">{DIET_STYLES.map((s) => <button key={s.id} type="button" onClick={() => setD({ ...d, diet: s.id })} aria-pressed={d.diet === s.id} className={choice(d.diet === s.id)}>
          <span className="block text-sm font-black">{s.label}</span><span className="mt-0.5 block text-xs text-slate-500">{s.detail}</span>
          <span className="mt-2 block text-[11px] font-bold text-violet-600">Protein {s.protein}% · Carbs {s.carbs}% · Fat {s.fat}%</span></button>)}</div>
      </>}

      {step === 5 && <>
        <div className="rounded-2xl bg-[#292446] p-5 text-white">
          <p className="text-xs font-bold uppercase tracking-wider text-[#bcb2ff]">Your daily calorie goal</p>
          <p className="mt-1 text-5xl font-black">{fmt(plan.calories)}</p>
          <p className="mt-2 text-sm text-slate-300">{profile.goal === "maintain" ? "To stay at your current weight." : `To ${profile.goal} about ${plan.rate} lb a week${plan.goalDate ? `, reaching ${profile.goalWeight} lb around ${shortDate(plan.goalDate, { month: "long", day: "numeric", year: "numeric" })}` : ""}.`}</p>
        </div>
        {plan.floored && <p className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"><Info size={15} className="mt-0.5 shrink-0" />Your plan stays at {fmt(plan.calories)} calories, the lowest we recommend without a doctor's guidance, so your weight will change a bit more slowly than you picked.</p>}
        <div className="grid grid-cols-3 gap-3 text-center">{[["Protein", plan.protein, "#36b6a5"], ["Carbs", plan.carbs, "#619ee6"], ["Fat", plan.fat, "#e5b04f"]].map(([l, g, c]) => <div key={l as string} className="rounded-2xl bg-slate-50 p-3"><p className="text-xl font-black" style={{ color: c as string }}>{g}g</p><p className="text-[11px] font-bold text-slate-500">{l}</p></div>)}</div>
        <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-100 text-sm">
          {[["Calories your body burns at rest", fmt(plan.bmr)], ["Calories you burn on a typical day", fmt(plan.tdee)], [profile.goal === "maintain" ? "Daily change" : `Daily ${profile.goal === "lose" ? "cut" : "extra"}`, `${plan.dailyChange > 0 ? "+" : ""}${fmt(plan.dailyChange)}`], ["Step goal", fmt(plan.steps)], ["Water goal", `${plan.water} cups`], ["BMI now", String(plan.bmi)]].map(([k, v]) =>
            <div key={k} className="flex justify-between gap-3 px-4 py-2.5"><dt className="text-slate-600">{k}</dt><dd className="font-bold text-slate-800">{v}</dd></div>)}
        </dl>
        <p className="text-[11px] leading-5 text-slate-500">This is an estimate from the Mifflin-St Jeor formula, the one most calorie apps use. Everyone's body is a little different: check your weight trend after 2–3 weeks and adjust. If you're pregnant, nursing, have a medical condition or a history of disordered eating, check with a doctor before following a calorie target.</p>
      </>}
    </div>

    <div className="mt-7 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-5">
      {at > 0 ? <button type="button" onClick={() => go(-1)} className={plain}><ArrowLeft size={16} /> Back</button> : onCancel && <button type="button" onClick={onCancel} className={plain}>Cancel</button>}
      {step < 5 ? <button type="button" onClick={() => go(1)} disabled={!ready} className={primary + " ml-auto px-6"}>Next <ArrowRight size={16} /></button>
        : <button type="button" onClick={() => onSave(profile)} disabled={!!problem} className={primary + " ml-auto px-6"}><Check size={17} /> Start my diary</button>}
    </div>
  </section>;
}
