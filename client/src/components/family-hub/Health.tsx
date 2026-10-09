// Food & fitness: a MyFitnessPal-style diary for adults (calories, macros, exercise, water, steps, weight)
// and a healthy-habits tracker for kids (fruits & veggies, water, active minutes, what they ate, no numbers).
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Camera, Check, ChevronLeft, ChevronRight, Copy, Droplet, Dumbbell, Flame, Footprints, Loader2, Minus, Plus, Scale, ScanBarcode, Search, Settings2, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { canScan, estimateMeal, lookupBarcode, searchFoods, shrinkPhoto } from "@/lib/foodLookup";
import type { FoundFood } from "@shared/foodLookup";
import Intake, { profileToDraft } from "./Intake";
import { AppleHealthPanel, useAppleHealth } from "./AppleHealth";
import { MEALS, addDays, type FoodEntry, type HealthProfile, type HealthGoals, type Meal, type Member, type SavedFood } from "@shared/familyHub";
import {
  ACTIVITIES, COMMON_FOODS, healthPeople, goalsFromPlan, makePlan, DIET_STYLES, DEFAULT_WEIGHT_LB, caloriesLeft, dayTotals, entryTotals, exerciseCalories, goalsFor, latestWeight, macroGrams, recentFoods, setDay,
} from "@shared/familyHealth";
import { Bar, Label, Modal, PageHead, Panel, inputClass, plain, primary, shortDate, soft, type SectionProps } from "./ui";

const MEAL_LABEL: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks" };
const fmt = (n: number) => Math.round(n).toLocaleString();
type Pick = { name: string; serving: string; calories: number; protein: number; carbs: number; fat: number };

export default function Health({ family, setFamily, today, makeId, say }: SectionProps) {
  const { user } = useAuth();
  const people = healthPeople(family, (user?.displayName || "").split(" ")[0]);
  const [who, setWho] = useState(() => (people.find((m) => m.kind === "adult") || people[0])?.id || "");
  const [date, setDate] = useState(today);
  const [adding, setAdding] = useState<Meal | null>(null);
  const [moving, setMoving] = useState(false);
  const [editGoals, setEditGoals] = useState(false);
  const [weightDraft, setWeightDraft] = useState("");
  const health = family.health;
  const member = people.find((m) => m.id === who) || people[0];
  const solo = people.length === 1;
  const [intake, setIntake] = useState(false);
  const profile = health.profiles[member.id];
  const setHealth = (fn: (h: typeof health) => typeof health) => setFamily((f) => { const h = fn(f.health); return h === f.health ? f : { ...f, health: h }; });
  const apple = useAppleHealth(setHealth);


  const kid = member.kind === "kid";
  const needsIntake = !kid && (!profile || intake);
  const goals = goalsFor(health, member);
  const totals = dayTotals(health, member.id, date);
  const dayFood = health.food.filter((f) => f.memberId === member.id && f.date === date);
  const dayMoves = health.exercise.filter((x) => x.memberId === member.id && x.date === date);
  const yesterday = addDays(date, -1);
  const removeFood = (id: string) => setHealth((h) => ({ ...h, food: h.food.filter((f) => f.id !== id) }));
  const copyYesterday = (meal: Meal) => {
    const from = health.food.filter((f) => f.memberId === member.id && f.date === yesterday && f.meal === meal);
    setHealth((h) => ({ ...h, food: [...h.food, ...from.map((f) => ({ ...f, id: makeId(), date }))].slice(-12000) }));
    say(`Copied ${from.length} item${from.length === 1 ? "" : "s"} from yesterday's ${MEAL_LABEL[meal].toLowerCase()}`);
  };
  const dateLabel = date === today ? "Today" : date === addDays(today, -1) ? "Yesterday" : shortDate(date);

  return <div className="space-y-6">
    <PageHead eyebrow="Food & fitness" title={kid ? `${member.name}'s healthy habits` : "Food & fitness"}
      blurb={kid ? "Fruits and veggies, water and moving every day. No calorie counting for kids, just good habits." : "Log meals and workouts and see what's left of today's calories, like MyFitnessPal for the whole family."}
      action={!needsIntake && <button onClick={() => setEditGoals(true)} className={plain + " min-h-11"}><Settings2 size={16} /> Goals</button>} />

    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">{!solo && people.map((m) => <button key={m.id} onClick={() => setWho(m.id)} aria-pressed={m.id === member.id}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-2.5 pr-3 text-xs font-bold text-slate-600 ring-1 ring-slate-200"
        style={m.id === member.id ? { background: m.color, color: "#fff", boxShadow: `0 0 0 1px ${m.color}` } : undefined}><span className="text-base leading-none">{m.emoji || "🙂"}</span>{m.name}</button>)}</div>
      {!needsIntake && <div className="flex items-center gap-2">
        <button onClick={() => setDate(addDays(date, -1))} className={plain} aria-label="Previous day"><ChevronLeft size={17} /></button>
        <button onClick={() => setDate(today)} className={plain + " min-w-[120px]"}>{dateLabel}</button>
        <button onClick={() => setDate(addDays(date, 1))} disabled={date >= today} className={plain} aria-label="Next day"><ChevronRight size={17} /></button>
      </div>}
    </div>

    {needsIntake ? <Intake key={member.id} member={member} today={today} start={profileToDraft(profile, latestWeight(health, member.id).latest?.weight)}
      onCancel={profile ? () => setIntake(false) : undefined}
      onSave={(p) => {
        const plan = makePlan(p, today);
        setHealth((h) => ({
          ...h, profiles: { ...h.profiles, [member.id]: p }, goals: { ...h.goals, [member.id]: goalsFromPlan(p, plan, goalsFor(h, member)) },
          weights: h.weights.some((w) => w.memberId === member.id && w.date === today) ? h.weights : [...h.weights, { id: makeId(), memberId: member.id, date: today, weight: p.weight }].slice(-3000),
        }));
        setIntake(false);
        say(`Your plan is ready: ${plan.calories.toLocaleString()} calories a day`);
      }} /> : <>
    {!kid && profile && <PlanStrip profile={profile} goals={goals} today={today} latest={latestWeight(health, member.id).latest?.weight} onUpdate={() => setIntake(true)} />}
    {kid ? <KidDay member={member} goals={goals} totals={totals} onFruit={(n) => setHealth((h) => setDay(h, member.id, date, { fruitVeg: totals.fruitVeg + n }))} />
      : <Summary goals={goals} totals={totals} />}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Panel eyebrow={dateLabel} title="Food diary" right={!kid && <span className="text-sm font-black text-slate-700">{fmt(totals.food.calories)} cal</span>}>
          <div className="space-y-5">{MEALS.map((meal) => {
            const items = dayFood.filter((f) => f.meal === meal);
            const fromYesterday = health.food.some((f) => f.memberId === member.id && f.date === yesterday && f.meal === meal);
            const mealCal = items.reduce((s, f) => s + entryTotals(f).calories, 0);
            return <section key={meal}>
              <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <h3 className="text-sm font-black text-slate-800">{MEAL_LABEL[meal]}</h3>
                {!kid && <span className="text-xs font-bold text-slate-500">{fmt(mealCal)} cal</span>}
              </div>
              {items.length > 0 && <ul className="mb-2 space-y-1">{items.map((f) => {
                const t = entryTotals(f);
                return <li key={f.id} className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{f.name}</span>
                    {!kid && <span className="text-[11px] text-slate-500">{f.servings === 1 ? "1 serving" : `${f.servings} servings`} · P {t.protein}g · C {t.carbs}g · F {t.fat}g</span>}</span>
                  {!kid && <span className="text-sm font-bold text-slate-700">{fmt(t.calories)}</span>}
                  <button onClick={() => removeFood(f.id)} className="rounded-lg p-1.5 text-slate-300 hover:text-rose-500" aria-label={`Remove ${f.name}`}><Trash2 size={14} /></button>
                </li>;
              })}</ul>}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setAdding(meal)} className={soft + " min-h-9 text-xs"}><Plus size={14} /> Add food</button>
                {!items.length && fromYesterday && <button onClick={() => copyYesterday(meal)} className={plain + " min-h-9 text-xs"}><Copy size={13} /> Same as yesterday</button>}
              </div>
            </section>;
          })}</div>
        </Panel>

        <Panel eyebrow={dateLabel} title={kid ? "Active play" : "Exercise"} right={<button onClick={() => setMoving(true)} className={soft}><Plus size={16} /> {kid ? "Add activity" : "Add exercise"}</button>}>
          {dayMoves.length ? <ul className="space-y-1">{dayMoves.map((x) => <li key={x.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
            <Dumbbell size={16} className="shrink-0 text-violet-500" />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{x.name}</span><span className="text-[11px] text-slate-500">{x.id.startsWith("apple:") ? "From Apple Health · includes watch workouts" : `${x.minutes} min`}</span></span>
            {!kid && <span className="text-sm font-bold text-emerald-600">{fmt(x.calories)} cal burned</span>}
            <button onClick={() => setHealth((h) => ({ ...h, exercise: h.exercise.filter((e) => e.id !== x.id) }))} className="rounded-lg p-1.5 text-slate-300 hover:text-rose-500" aria-label={`Remove ${x.name}`}><Trash2 size={14} /></button>
          </li>)}</ul> : <p className="text-sm text-slate-500">{kid ? "Bike rides, recess, dance parties: it all counts." : "Logged workouts add calories back to today's budget."}</p>}
          {kid && <div className="mt-4"><div className="mb-1.5 flex justify-between text-xs font-bold text-slate-500"><span>{totals.minutes} of {goals.activeMinutes} active minutes</span></div><Bar value={totals.minutes} max={goals.activeMinutes} color={member.color} /></div>}
        </Panel>
      </div>

      <aside className="space-y-5">
        <Panel eyebrow="Water" title={`${totals.water} of ${goals.water} cups`} right={<Droplet size={18} className="text-sky-500" />}>
          <div className="grid grid-cols-8 gap-1.5">{Array.from({ length: Math.max(goals.water, totals.water) }, (_, i) => {
            const full = i < totals.water;
            return <button key={i} onClick={() => setHealth((h) => setDay(h, member.id, date, { water: full && i === totals.water - 1 ? i : i + 1 }))} aria-label={`${i + 1} cup${i ? "s" : ""}`} aria-pressed={full}
              className={`flex h-11 items-end justify-center rounded-b-xl rounded-t-md border-2 pb-1 transition ${full ? "border-sky-400 bg-sky-400 text-white" : "border-slate-200 text-slate-300 hover:border-sky-300"}`}><Droplet size={14} /></button>;
          })}</div>
          <div className="mt-3 flex gap-2"><button onClick={() => setHealth((h) => setDay(h, member.id, date, { water: totals.water + 1 }))} className={soft + " min-h-9 text-xs"}><Plus size={14} /> Cup</button>{totals.water > 0 && <button onClick={() => setHealth((h) => setDay(h, member.id, date, { water: totals.water - 1 }))} className={plain + " min-h-9 text-xs"}><Minus size={14} /></button>}</div>
        </Panel>

        {!kid && <Panel eyebrow="Steps" title={`${fmt(totals.steps)} steps`} right={<Footprints size={18} className="text-violet-500" />}>
          <Bar value={totals.steps} max={goals.steps} color="#22c55e" />
          <p className="mt-1.5 text-xs font-semibold text-slate-500">Goal {fmt(goals.steps)}</p>
          <form key={member.id + date} onSubmit={(e) => { e.preventDefault(); const v = Number((e.currentTarget.elements.namedItem("steps") as HTMLInputElement).value); if (v >= 0) setHealth((h) => setDay(h, member.id, date, { steps: v })); }} className="mt-3 flex gap-2">
            <input name="steps" type="number" min={0} defaultValue={totals.steps || ""} placeholder="Steps today" aria-label="Steps" className={inputClass + " min-w-0"} />
            <button type="submit" className={primary}>Save</button>
          </form>
        </Panel>}

        {!kid && <AppleHealthPanel member={member} apple={apple} say={say} />}

        {!kid && <WeightPanel memberId={member.id} goalWeight={goals.goalWeight} draft={weightDraft} setDraft={setWeightDraft} today={today}
          list={latestWeight(health, member.id).list}
          onLog={(w) => { setHealth((h) => ({ ...h, weights: [...h.weights.filter((x) => !(x.memberId === member.id && x.date === today)), { id: makeId(), memberId: member.id, date: today, weight: w }].slice(-3000) })); setWeightDraft(""); say("Weight logged"); }}
          onRemove={(id) => setHealth((h) => ({ ...h, weights: h.weights.filter((x) => x.id !== id) }))} />}

        {!kid && <WeekPanel days={Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((d) => ({ date: d, calories: dayTotals(health, member.id, d).food.calories }))} goal={goals.calories} today={today} />}
      </aside>
    </div>
    </>}

    {adding && <AddFood meal={adding} kid={kid} memberId={member.id} saved={health.foods} recent={recentFoods(health, member.id)} onClose={() => setAdding(null)}
      onAdd={(meal, pick, servings, save) => {
        const entry: FoodEntry = { id: makeId(), memberId: member.id, date, meal, name: pick.name, servings, calories: kid ? 0 : pick.calories, protein: kid ? 0 : pick.protein, carbs: kid ? 0 : pick.carbs, fat: kid ? 0 : pick.fat };
        setHealth((h) => ({
          ...h, food: [...h.food, entry].slice(-12000),
          foods: save && !h.foods.some((f) => f.name.toLowerCase() === pick.name.toLowerCase()) ? [...h.foods, { id: makeId(), ...pick }].slice(0, 500) : h.foods,
        }));
        say(`${pick.name} added to ${MEAL_LABEL[meal].toLowerCase()}`);
      }} />}

    {moving && <AddExercise kid={kid} pounds={latestWeight(health, member.id).latest?.weight || DEFAULT_WEIGHT_LB} knowsWeight={!!latestWeight(health, member.id).latest} onClose={() => setMoving(false)}
      onAdd={(name, minutes, calories) => {
        setHealth((h) => ({ ...h, exercise: [...h.exercise, { id: makeId(), memberId: member.id, date, name, minutes, calories: kid ? 0 : calories }].slice(-6000) }));
        setMoving(false);
        say(`${name} logged`);
      }} />}

    {editGoals && <GoalsModal member={member} goals={goals} onClose={() => setEditGoals(false)} onSave={(g) => { setHealth((h) => ({ ...h, goals: { ...h.goals, [member.id]: g } })); setEditGoals(false); say("Goals saved"); }} />}
  </div>;
}

function PlanStrip({ profile, goals, today, latest, onUpdate }: { profile: HealthProfile; goals: HealthGoals; today: string; latest?: number; onUpdate: () => void }) {
  const plan = makePlan({ ...profile, weight: latest || profile.weight }, today);
  const style = DIET_STYLES.find((d) => d.id === profile.diet)?.label || "Balanced";
  const drift = latest && Math.abs(latest - profile.weight) >= 5;
  const what = profile.goal === "maintain" ? "Maintain weight" : `${profile.goal === "lose" ? "Lose" : "Gain"} ${profile.rate} lb/week to ${profile.goalWeight} lb`;
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-violet-50 px-4 py-3 text-sm">
    <span className="font-black text-violet-900">{what}</span>
    {plan.goalDate && <span className="font-semibold text-violet-700">around {shortDate(plan.goalDate, { month: "short", day: "numeric", year: "numeric" })}</span>}
    <span className="text-violet-700">{fmt(goals.calories)} cal · {style}</span>
    {drift && <span className="font-semibold text-amber-700">You've changed {Math.round(Math.abs((latest as number) - profile.weight))} lb since your plan was made.</span>}
    <button onClick={onUpdate} className="ml-auto text-xs font-bold text-violet-700 underline underline-offset-2">{drift ? "Update my plan" : "Change plan"}</button>
  </div>;
}

function Summary({ goals, totals }: { goals: HealthGoals; totals: ReturnType<typeof dayTotals> }) {
  const left = caloriesLeft(goals.calories, totals);
  const budget = goals.calories + totals.exercise;
  const pct = budget > 0 ? Math.min(1, totals.food.calories / budget) : 0;
  const grams = macroGrams(goals);
  const over = left < 0;
  return <section className="grid gap-5 rounded-[1.5rem] border border-[#e7e8f0] bg-white p-5 shadow-[0_8px_28px_#17152b08] md:grid-cols-[auto_minmax(0,1fr)] md:items-center sm:p-6">
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0 -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="12" className="text-slate-100" />
        <circle cx="60" cy="60" r="50" fill="none" stroke={over ? "#e0645a" : "#6e5ae0"} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${pct * 314.16} 314.16`} />
      </svg>
      <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{over ? "Over by" : "Calories remaining"}</p><p className={`text-4xl font-black ${over ? "text-rose-600" : "text-[#232139]"}`}>{fmt(Math.abs(left))}</p></div>
    </div>
    <div className="space-y-4">
      <div className="grid grid-cols-4 items-end gap-2 text-center">
        {[["Goal", goals.calories, ""], ["Food", totals.food.calories, "−"], ["Exercise", totals.exercise, "+"], ["Remaining", left, "="]].map(([label, value, sign]) =>
          <div key={label as string}><p className="text-lg font-black text-slate-800 sm:text-xl"><span className="mr-0.5 text-slate-400">{sign}</span>{fmt(value as number)}</p><p className="text-[11px] font-bold text-slate-500">{label}</p></div>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {([["Protein", totals.food.protein, grams.protein, "#36b6a5"], ["Carbs", totals.food.carbs, grams.carbs, "#619ee6"], ["Fat", totals.food.fat, grams.fat, "#e5b04f"]] as const).map(([label, value, target, color]) =>
          <div key={label}><div className="mb-1.5 flex justify-between text-xs font-bold"><span className="text-slate-600">{label}</span><span className="text-slate-500">{fmt(value)} / {target}g</span></div><Bar value={value} max={target} color={color} /></div>)}
      </div>
    </div>
  </section>;
}

function KidDay({ member, goals, totals, onFruit }: { member: Member; goals: HealthGoals; totals: ReturnType<typeof dayTotals>; onFruit: (n: number) => void }) {
  const fv = totals.fruitVeg;
  return <section className="grid gap-5 rounded-[1.5rem] border border-[#e7e8f0] bg-white p-5 shadow-[0_8px_28px_#17152b08] sm:p-6 md:grid-cols-3">
    <div className="md:col-span-2">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Fruits & veggies</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {Array.from({ length: Math.max(goals.fruitVeg, fv) }, (_, i) => <span key={i} className={`flex h-11 w-11 items-center justify-center rounded-full text-xl ${i < fv ? "bg-emerald-50" : "bg-slate-50 opacity-40 grayscale"}`} aria-hidden="true">{["🍎", "🥕", "🍌", "🥦", "🍓", "🌽", "🍇", "🥒"][i % 8]}</span>)}
        <button onClick={() => onFruit(1)} className={primary + " ml-1"} aria-label="Add a fruit or veggie"><Plus size={17} /></button>
        {fv > 0 && <button onClick={() => onFruit(-1)} className={plain} aria-label="Remove one"><Minus size={17} /></button>}
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-600">{fv >= goals.fruitVeg ? `Rainbow complete, ${member.name}! 🌈` : `${fv} of ${goals.fruitVeg} today`}</p>
    </div>
    <div className="grid gap-3 self-start">
      <div className="rounded-2xl bg-violet-50 p-3"><p className="text-[11px] font-bold text-violet-600">Active</p><p className="text-xl font-black text-slate-800">{totals.minutes}/{goals.activeMinutes} <span className="text-xs font-bold text-slate-500">min</span></p></div>
    </div>
  </section>;
}

function WeightPanel({ goalWeight, draft, setDraft, list, onLog, onRemove, today }: {
  memberId: string; goalWeight: number; draft: string; setDraft: (v: string) => void; today: string;
  list: { id: string; date: string; weight: number }[]; onLog: (w: number) => void; onRemove: (id: string) => void;
}) {
  const recent = list.slice(-30);
  const latest = list[list.length - 1];
  const first = list[0];
  const values = recent.map((w) => w.weight).concat(goalWeight ? [goalWeight] : []);
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = Math.max(1, hi - lo);
  const point = (w: number, i: number) => `${recent.length === 1 ? 150 : (i / (recent.length - 1)) * 290 + 5},${8 + (1 - (w - lo) / span) * 64}`;
  return <Panel eyebrow="Weight" title={latest ? `${latest.weight} lb` : "No weigh-ins yet"} right={<Scale size={18} className="text-violet-500" />}>
    {latest && <p className="-mt-2 mb-3 text-xs font-semibold text-slate-500">
      {first && first.id !== latest.id ? `${latest.weight - first.weight > 0 ? "+" : ""}${Math.round((latest.weight - first.weight) * 10) / 10} lb since ${shortDate(first.date, { month: "short", day: "numeric" })}` : `Logged ${latest.date === today ? "today" : shortDate(latest.date, { month: "short", day: "numeric" })}`}
      {goalWeight ? ` · goal ${goalWeight} lb` : ""}</p>}
    {recent.length > 1 && <svg viewBox="0 0 300 80" className="mb-3 h-20 w-full" role="img" aria-label="Weight over time">
      {goalWeight > 0 && <line x1="5" x2="295" y1={8 + (1 - (goalWeight - lo) / span) * 64} y2={8 + (1 - (goalWeight - lo) / span) * 64} stroke="#22c55e" strokeDasharray="4 4" strokeWidth="1.5" />}
      <polyline fill="none" stroke="#6e5ae0" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={recent.map((w, i) => point(w.weight, i)).join(" ")} />
      {recent.map((w, i) => { const [x, y] = point(w.weight, i).split(","); return <circle key={w.id} cx={x} cy={y} r="3" fill="#6e5ae0" />; })}
    </svg>}
    <form onSubmit={(e) => { e.preventDefault(); const w = Number(draft); if (w > 0 && w < 1500) onLog(Math.round(w * 10) / 10); }} className="flex gap-2">
      <input type="number" min={1} step="0.1" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Today's weight (lb)" aria-label="Weight in pounds" className={inputClass + " min-w-0"} />
      <button type="submit" className={primary} disabled={!(Number(draft) > 0)}>Log</button>
    </form>
    {list.length > 0 && <ul className="mt-3 space-y-1">{list.slice(-3).reverse().map((w) => <li key={w.id} className="flex items-center justify-between text-xs"><span className="text-slate-500">{shortDate(w.date, { month: "short", day: "numeric" })}</span><span className="flex items-center gap-2 font-bold text-slate-700">{w.weight} lb<button onClick={() => onRemove(w.id)} className="text-slate-300 hover:text-rose-500" aria-label="Remove weigh-in"><Trash2 size={12} /></button></span></li>)}</ul>}
  </Panel>;
}

function WeekPanel({ days, goal, today }: { days: { date: string; calories: number }[]; goal: number; today: string }) {
  const peak = Math.max(goal, ...days.map((d) => d.calories), 1);
  const logged = days.filter((d) => d.calories > 0);
  const avg = logged.length ? Math.round(logged.reduce((s, d) => s + d.calories, 0) / logged.length) : 0;
  return <Panel eyebrow="Last 7 days" title={avg ? `${fmt(avg)} cal average` : "This week"} right={<Flame size={18} className="text-orange-500" />}>
    <div className="relative flex h-28 items-end gap-2">
      <div className="absolute inset-x-0 border-t-2 border-dashed border-emerald-400" style={{ bottom: `${(goal / peak) * 100}%` }} title={`Goal ${goal}`} />
      {days.map((d) => <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${shortDate(d.date)}: ${fmt(d.calories)} cal`}>
        <div className="w-full rounded-md" style={{ height: `${(d.calories / peak) * 100}%`, minHeight: d.calories ? 3 : 0, background: d.calories > goal ? "#f3a19a" : "#a99bf5" }} />
      </div>)}
    </div>
    <div className="mt-1.5 flex gap-2">{days.map((d) => <span key={d.date} className={`flex-1 text-center text-[10px] font-bold ${d.date === today ? "text-violet-600" : "text-slate-400"}`}>{shortDate(d.date, { weekday: "narrow" })}</span>)}</div>
    <p className="mt-2 text-[11px] text-slate-500">Dashed line: daily goal of {fmt(goal)}</p>
  </Panel>;
}

function AddFood({ meal: startMeal, kid, saved, recent, onAdd, onClose }: {
  meal: Meal; kid: boolean; memberId: string; saved: SavedFood[]; recent: FoodEntry[];
  onAdd: (meal: Meal, pick: Pick, servings: number, save: boolean) => void; onClose: () => void;
}) {
  const { token } = useAuth();
  const [meal, setMeal] = useState<Meal>(startMeal);
  const [tab, setTab] = useState<"search" | "recent" | "scan" | "ai" | "quick">("search");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Pick | null>(null);
  const [servings, setServings] = useState("1");
  const [quick, setQuick] = useState({ name: "", serving: "", calories: "", protein: "", carbs: "", fat: "", save: true });
  const [online, setOnline] = useState<{ q: string; foods: FoundFood[]; busy: boolean; error: string }>({ q: "", foods: [], busy: false, error: "" });
  const [ai, setAi] = useState<{ text: string; image: string | null; busy: boolean; error: string; foods: FoundFood[]; done: boolean }>({ text: "", image: null, busy: false, error: "", foods: [], done: false });
  const [code, setCode] = useState("");
  const [scan, setScan] = useState<{ busy: boolean; error: string; camera: boolean }>({ busy: false, error: "", camera: false });
  const video = useRef<HTMLVideoElement>(null);
  const library = useMemo(() => [...saved.map((f) => ({ ...f, mine: true })), ...COMMON_FOODS.map((f) => ({ ...f, mine: false }))], [saved]);
  const term = q.trim().toLowerCase();
  const results = library.filter((f) => !term || f.name.toLowerCase().includes(term)).slice(0, term ? 8 : 40);
  const add = (p: Pick, n: number, save = false) => { onAdd(meal, p, n, save); setPicked(null); setServings("1"); };
  const fromFound = (f: FoundFood): Pick => ({ name: (f.brand && !f.name.toLowerCase().includes(f.brand.toLowerCase()) ? `${f.name} (${f.brand})` : f.name).slice(0, 100), serving: f.serving, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat });

  // Search the food databases as you type (after a short pause).
  useEffect(() => {
    if (tab !== "search" || term.length < 2) { setOnline((o) => ({ ...o, busy: false })); return; }
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      setOnline((o) => ({ ...o, busy: true, error: "" }));
      searchFoods(token, term, ctrl.signal)
        .then((foods) => setOnline({ q: term, foods, busy: false, error: "" }))
        .catch((e: Error) => { if (!ctrl.signal.aborted) setOnline({ q: term, foods: [], busy: false, error: e.message }); });
    }, 450);
    return () => { window.clearTimeout(timer); ctrl.abort(); };
  }, [term, tab, token]);

  // Camera barcode scanning where the browser supports it.
  useEffect(() => {
    if (!scan.camera) return;
    let stream: MediaStream | null = null;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const detector = new (window as any).BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
        while (!stopped && video.current) {
          const found = await detector.detect(video.current).catch(() => []);
          const value = found?.[0]?.rawValue;
          if (value && /^\d{8,14}$/.test(value)) { stopped = true; setScan((s) => ({ ...s, camera: false })); void findBarcode(value); break; }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        setScan({ busy: false, camera: false, error: "The camera couldn't start. Type the numbers under the barcode instead." });
      }
    })();
    return () => { stopped = true; stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan.camera]);

  const findBarcode = async (value: string) => {
    setCode(value);
    setScan({ busy: true, error: "", camera: false });
    try { const food = await lookupBarcode(token, value); setScan({ busy: false, error: "", camera: false }); setPicked(fromFound(food)); setServings("1"); }
    catch (e: any) { setScan({ busy: false, error: e?.message || "That product wasn't found.", camera: false }); }
  };
  const estimate = async () => {
    setAi((a) => ({ ...a, busy: true, error: "", foods: [], done: false }));
    try { const foods = await estimateMeal(token, ai.text.trim(), ai.image); setAi((a) => ({ ...a, busy: false, foods, done: true, error: foods.length ? "" : "No food found. Try describing it in more detail." })); }
    catch (e: any) { setAi((a) => ({ ...a, busy: false, error: e?.message || "The meal couldn't be estimated." })); }
  };

  const row = (p: Pick & { mine?: boolean; tag?: string }, key: string) => <li key={key}>
    <button onClick={() => { setPicked(p); setServings("1"); }} className="flex w-full items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-left hover:border-violet-200 hover:bg-[#fcfbff]">
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-800">{p.name}{p.mine && <span className="ml-2 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-600">My food</span>}</span>
        <span className="block truncate text-[11px] text-slate-500">{p.serving}{!kid && ` · P ${p.protein}g · C ${p.carbs}g · F ${p.fat}g`}{p.tag ? ` · ${p.tag}` : ""}</span></span>
      {!kid && <span className="text-sm font-black text-slate-700">{fmt(p.calories)}</span>}
      <Plus size={16} className="shrink-0 text-violet-500" />
    </button>
  </li>;
  const tabs = ([["search", "Search"], ["recent", "Recent"], ["scan", "Barcode"], ...(kid ? [] : [["ai", "Describe or photo"]]), ["quick", kid ? "Type it in" : "Quick add"]] as [typeof tab, string][]);

  return <Modal title="Add food" eyebrow={MEAL_LABEL[meal]} onClose={onClose} wide>
    <div className="mb-4 flex flex-wrap gap-1.5">{MEALS.map((m) => <button key={m} onClick={() => setMeal(m)} aria-pressed={meal === m} className={`min-h-9 rounded-xl px-3 text-xs font-bold ring-1 ${meal === m ? "bg-violet-600 text-white ring-violet-600" : "bg-white text-slate-500 ring-slate-200"}`}>{MEAL_LABEL[m]}</button>)}</div>
    {picked ? <div className="space-y-4">
      <div className="rounded-2xl bg-slate-50 p-4"><p className="text-base font-black">{picked.name}</p><p className="text-xs text-slate-500">{picked.serving || "1 serving"}</p></div>
      <Label text="Number of servings"><input autoFocus type="number" min={0.25} step={0.25} value={servings} onChange={(e) => setServings(e.target.value)} className={inputClass + " max-w-[140px]"} /></Label>
      {!kid && Number(servings) > 0 && <div className="grid grid-cols-4 gap-2 text-center">{[["Calories", picked.calories, ""], ["Protein", picked.protein, "g"], ["Carbs", picked.carbs, "g"], ["Fat", picked.fat, "g"]].map(([l, v, u]) => <div key={l as string} className="rounded-xl bg-slate-50 py-2"><p className="text-base font-black">{l === "Calories" ? Math.round((v as number) * Number(servings)) : Math.round((v as number) * Number(servings) * 10) / 10}{u}</p><p className="text-[10px] font-bold text-slate-500">{l}</p></div>)}</div>}
      <div className="flex gap-2"><button onClick={() => Number(servings) > 0 && add(picked, Math.round(Number(servings) * 100) / 100)} disabled={!(Number(servings) > 0)} className={primary + " flex-1"}><Check size={17} /> Add to {MEAL_LABEL[meal].toLowerCase()}</button><button onClick={() => setPicked(null)} className={plain}>Back</button></div>
    </div> : <>
      <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold">
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className={`min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 ${tab === k ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}>{l}</button>)}
      </div>

      {tab === "search" && <>
        <div className="relative mb-3"><Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any food, brand or restaurant item" aria-label="Search foods" className={inputClass + " pl-10"} /></div>
        <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
          {results.length > 0 && <div>{term && <p className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">Common foods</p>}<ul className="space-y-1.5">{results.map((f, i) => row(f, f.name + i))}</ul></div>}
          {term.length >= 2 && <div>
            <p className="mb-1.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-400">Food database {online.busy && <Loader2 size={13} className="animate-spin" />}</p>
            {online.error ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{online.error}</p>
              : online.q === term && !online.busy && !online.foods.length ? <p className="text-xs text-slate-500">No matches. Try a simpler name, or use “{kid ? "Type it in" : "Describe or photo"}”.</p>
              : <ul className="space-y-1.5">{(online.q === term ? online.foods : []).map((f, i) => row({ ...fromFound(f), tag: f.source === "usda" ? "USDA" : "Open Food Facts" }, `o${i}`))}</ul>}
          </div>}
        </div>
        {!kid && <p className="mt-3 text-[11px] text-slate-400">Nutrition comes from the USDA food database and Open Food Facts. Check the package label for exact numbers.</p>}
      </>}

      {tab === "recent" && (recent.length ? <ul className="space-y-1.5">{recent.map((f) => row({ name: f.name, serving: f.servings === 1 ? "1 serving" : `${f.servings} servings`, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat }, f.id))}</ul> : <p className="text-sm text-slate-500">Foods you add will show up here for one-tap logging.</p>)}

      {tab === "scan" && <div className="space-y-4">
        {scan.camera ? <div className="overflow-hidden rounded-2xl bg-black"><video ref={video} className="aspect-video w-full object-cover" muted playsInline /><button onClick={() => setScan((s) => ({ ...s, camera: false }))} className="w-full bg-black/80 py-2 text-xs font-bold text-white">Stop camera</button></div>
          : canScan() && <button onClick={() => setScan({ busy: false, error: "", camera: true })} className={primary + " w-full min-h-12"}><ScanBarcode size={18} /> Scan with camera</button>}
        <form onSubmit={(e) => { e.preventDefault(); const v = code.replace(/\D/g, ""); if (/^\d{8,14}$/.test(v)) void findBarcode(v); }} className="flex gap-2">
          <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Numbers under the barcode" aria-label="Barcode number" className={inputClass + " min-w-0"} />
          <button type="submit" className={plain} disabled={scan.busy || !/^\d{8,14}$/.test(code.replace(/\D/g, ""))}>{scan.busy ? <Loader2 size={16} className="animate-spin" /> : "Look up"}</button>
        </form>
        {scan.error && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{scan.error}</p>}
        {!canScan() && <p className="text-xs text-slate-500">This browser can't scan with the camera, so type the numbers printed under the barcode.</p>}
      </div>}

      {tab === "ai" && <div className="space-y-3">
        <textarea autoFocus rows={3} maxLength={600} value={ai.text} onChange={(e) => setAi({ ...ai, text: e.target.value })} placeholder="What did you eat? e.g. “2 slices of pepperoni pizza, a side salad with ranch and a Coke”" aria-label="Describe the meal" className={inputClass + " py-3"} />
        <div className="flex flex-wrap items-center gap-2">
          <label className={plain + " cursor-pointer"}><Camera size={16} /> {ai.image ? "Change photo" : "Add a photo"}<input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { const image = await shrinkPhoto(f); setAi((a) => ({ ...a, image })); } catch (err: any) { setAi((a) => ({ ...a, error: err.message })); } }} /></label>
          {ai.image && <span className="relative"><img src={ai.image} alt="Meal photo" className="h-12 w-12 rounded-lg object-cover" /><button onClick={() => setAi({ ...ai, image: null })} className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-800 px-1.5 text-[10px] font-bold text-white" aria-label="Remove photo">×</button></span>}
          <button onClick={() => void estimate()} disabled={ai.busy || (!ai.text.trim() && !ai.image)} className={primary + " ml-auto"}>{ai.busy ? <><Loader2 size={16} className="animate-spin" /> Estimating…</> : <><Sparkles size={16} /> Estimate calories</>}</button>
        </div>
        {ai.error && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{ai.error}</p>}
        {ai.foods.length > 0 && <div className="space-y-2 rounded-2xl border border-slate-100 p-3">
          <div className="flex items-center justify-between gap-2"><p className="text-sm font-black">About {fmt(ai.foods.reduce((s, f) => s + f.calories, 0))} calories</p>
            <button onClick={() => { ai.foods.forEach((f) => onAdd(meal, fromFound(f), 1, false)); setAi({ text: "", image: null, busy: false, error: "", foods: [], done: false }); }} className={soft + " min-h-9 text-xs"}><Plus size={14} /> Add all to {MEAL_LABEL[meal].toLowerCase()}</button></div>
          <ul className="space-y-1.5">{ai.foods.map((f, i) => row({ ...fromFound(f), tag: "estimate" }, `a${i}`))}</ul>
          <p className="text-[11px] text-slate-400">AI estimates can be off, especially for portions. Tap an item to adjust servings before adding.</p>
        </div>}
      </div>}

      {tab === "quick" && <form onSubmit={(e) => {
        e.preventDefault();
        const name = quick.name.trim();
        if (!name) return;
        const n = (v: string) => Math.max(0, Number(v) || 0);
        add({ name: name.slice(0, 100), serving: quick.serving.trim().slice(0, 60) || "1 serving", calories: n(quick.calories), protein: n(quick.protein), carbs: n(quick.carbs), fat: n(quick.fat) }, 1, !kid && quick.save);
        setQuick({ name: "", serving: "", calories: "", protein: "", carbs: "", fat: "", save: quick.save });
      }} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Label text="Food"><input autoFocus required maxLength={100} value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} className={inputClass} placeholder={kid ? "Apple slices" : "Grandma's lasagna"} /></Label>
          {!kid && <Label text="Serving"><input maxLength={60} value={quick.serving} onChange={(e) => setQuick({ ...quick, serving: e.target.value })} className={inputClass} placeholder="1 piece" /></Label>}
        </div>
        {!kid && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{(["calories", "protein", "carbs", "fat"] as const).map((k) => <Label key={k} text={k === "calories" ? "Calories" : `${k[0].toUpperCase()}${k.slice(1)} (g)`}><input type="number" min={0} step="0.1" value={quick[k]} onChange={(e) => setQuick({ ...quick, [k]: e.target.value })} className={inputClass} /></Label>)}</div>}
        {!kid && <label className="flex items-center gap-2 text-sm font-semibold text-slate-600"><input type="checkbox" checked={quick.save} onChange={(e) => setQuick({ ...quick, save: e.target.checked })} className="h-5 w-5" /> Save to my foods</label>}
        <button type="submit" className={primary + " w-full"}><Plus size={17} /> Add to {MEAL_LABEL[meal].toLowerCase()}</button>
      </form>}
    </>}
  </Modal>;
}

function AddExercise({ kid, pounds, knowsWeight, onAdd, onClose }: { kid: boolean; pounds: number; knowsWeight: boolean; onAdd: (name: string, minutes: number, calories: number) => void; onClose: () => void }) {
  const [activity, setActivity] = useState(ACTIVITIES[0].name);
  const [other, setOther] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [calories, setCalories] = useState<string | null>(null);
  const met = ACTIVITIES.find((a) => a.name === activity)?.met;
  const estimate = met ? exerciseCalories(met, Number(minutes) || 0, pounds) : 0;
  const name = activity === "other" ? other.trim() : activity;
  return <Modal title={kid ? "Add activity" : "Add exercise"} onClose={onClose}>
    <form onSubmit={(e) => { e.preventDefault(); const m = Math.round(Number(minutes)); if (!name || !(m > 0)) return; onAdd(name.slice(0, 80), Math.min(1440, m), Math.max(0, Math.round(Number(calories ?? estimate) || 0))); }} className="space-y-4">
      <Label text="Activity"><select value={activity} onChange={(e) => { setActivity(e.target.value); setCalories(null); }} className={inputClass}>{ACTIVITIES.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}<option value="other">Something else…</option></select></Label>
      {activity === "other" && <Label text="What did you do?"><input autoFocus required maxLength={80} value={other} onChange={(e) => setOther(e.target.value)} className={inputClass} placeholder={kid ? "Trampoline" : "Pickleball"} /></Label>}
      <Label text="Minutes"><input type="number" min={1} max={1440} value={minutes} onChange={(e) => { setMinutes(e.target.value); setCalories(null); }} className={inputClass + " max-w-[140px]"} /></Label>
      {!kid && <Label text="Calories burned"><input type="number" min={0} value={calories ?? (met ? String(estimate) : "")} onChange={(e) => setCalories(e.target.value)} className={inputClass + " max-w-[140px]"} placeholder="Calories" /></Label>}
      {!kid && met && <p className="-mt-2 text-[11px] text-slate-500">Estimated for {pounds} lb{knowsWeight ? "" : " (log your weight for a better estimate)"}. You can change it.</p>}
      <button type="submit" className={primary + " w-full"} disabled={!name || !(Number(minutes) > 0)}><Check size={17} /> Save</button>
    </form>
  </Modal>;
}

function GoalsModal({ member, goals, onSave, onClose }: { member: Member; goals: HealthGoals; onSave: (g: HealthGoals) => void; onClose: () => void }) {
  const [g, setG] = useState(goals);
  const kid = member.kind === "kid";
  const sum = g.proteinPct + g.carbsPct + g.fatPct;
  const field = (key: keyof HealthGoals, label: string, max: number, step = 1) => <Label text={label}><input type="number" min={0} max={max} step={step} value={g[key] || ""} onChange={(e) => setG({ ...g, [key]: Math.max(0, Math.min(max, Number(e.target.value) || 0)) })} className={inputClass} /></Label>;
  const grams = macroGrams(g);
  return <Modal title={`${member.name}'s goals`} eyebrow="Food & fitness" onClose={onClose}>
    <form onSubmit={(e) => { e.preventDefault(); if (!kid && sum !== 100) return; onSave(g); }} className="space-y-4">
      {kid ? <div className="grid grid-cols-2 gap-4">{field("fruitVeg", "Fruits & veggies a day", 20)}{field("water", "Cups of water", 40)}{field("activeMinutes", "Active minutes", 600)}</div> : <>
        <div className="grid grid-cols-2 gap-4">{field("calories", "Daily calories", 10000, 10)}{field("goalWeight", "Goal weight (lb, optional)", 1500, 0.5)}</div>
        <div><p className="mb-1.5 text-xs font-bold text-slate-600">Macros (% of calories)</p>
          <div className="grid grid-cols-3 gap-3">{field("proteinPct", `Protein · ${grams.protein}g`, 100)}{field("carbsPct", `Carbs · ${grams.carbs}g`, 100)}{field("fatPct", `Fat · ${grams.fat}g`, 100)}</div>
          {sum !== 100 && <p className="mt-1.5 text-xs font-bold text-rose-600">These add up to {sum}%. Make them add up to 100%.</p>}</div>
        <div className="grid grid-cols-2 gap-4">{field("water", "Cups of water", 40)}{field("steps", "Daily steps", 100000, 500)}</div>
        <p className="text-[11px] leading-5 text-slate-500">Not sure what to aim for? Many adults need about 1,600–3,000 calories a day depending on size and activity. A doctor or dietitian can help you set the right number.</p>
      </>}
      <button type="submit" className={primary + " w-full"} disabled={!kid && sum !== 100}><Check size={17} /> Save goals</button>
    </form>
  </Modal>;
}
