// Cooked: vacation mode (shared/fitVacation.ts). Plan a trip: where you'll train, how much you'll commit
// to, and what to do before and after to make up for it, for workouts and for food. Also the card that
// finishes a workout that was split across the day.
import { useState } from "react";
import { Check, ChevronRight, Dumbbell, Plane, Trash2, Utensils } from "lucide-react";
import { dayKey, type FitData } from "@shared/fit";
import { GYM_BY_ID, GYM_TYPES } from "@shared/fitGym";
import { generateWorkout } from "@shared/fitRecovery";
import { DEFAULT_VACATION, dayGoals, foodPlan, normalPerWeek, tripDays, vacationOver, vacationPhase, workoutPlan, type Commit, type Vacation } from "@shared/fitVacation";
import { PROGRAM_BY_ID } from "@shared/fit";
import { Btn, C, Card, Field, Sheet, Title, display, haptic, inputCls, inputStyle } from "./fitUi";
import { GymIcon } from "./FitIcon";
import type { Update, LibraryExercise } from "./fitStore";
import { planned, startWorkout } from "./FitTrain";
import { latestKg } from "./FitFood";

const when = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const plus = (k: string, n: number) => { const d = new Date(`${k}T12:00:00`); d.setDate(d.getDate() + n); return dayKey(d); };
const COMMITS: { id: Commit; name: string; blurb: string }[] = [
  { id: "train", name: "Keep training", blurb: "Close to my normal week" },
  { id: "light", name: "Short workouts", blurb: "A few quick ones" },
  { id: "rest", name: "Take a break", blurb: "Rest, then make it up" },
];

/** A workout for the trip (short, with the vacation gym) or a longer one for the days around it. */
export function vacationWorkout(data: FitData, list: LibraryExercise[], v: Vacation, mins: number, label: string) {
  const gear = v.gym?.gear?.length ? v.gym.gear : undefined;
  const gen = generateWorkout(data, { equip: gear ? "mygym" : data.profile.gym && label !== "Vacation" ? "mygym" : label === "Vacation" ? "bodyweight" : "gym", mins, goal: data.profile.goal, gear: gear ?? (label !== "Vacation" ? data.profile.gym?.gear : undefined) });
  return startWorkout({ name: `${label}: ${gen.title}`, programId: "vacation", dayId: dayKey(), exercises: planned(data, gen.items, list) });
}

export function VacationSheet({ data, update, list, onStart, onClose, say }: { data: FitData; update: Update; list: LibraryExercise[]; onStart: (a: ReturnType<typeof startWorkout>) => void; onClose: () => void; say: (m: string) => void }) {
  const today = dayKey();
  const [v, setV] = useState<Vacation>(() => data.vacation ?? DEFAULT_VACATION(plus(today, 14), plus(today, 20)));
  const [editing, setEditing] = useState(!data.vacation);
  const set = (p: Partial<Vacation>) => setV((x) => ({ ...x, ...p }));
  const normal = normalPerWeek(data, data.program ? PROGRAM_BY_ID.get(data.program.id)?.daysPerWeek : undefined);
  const plan = workoutPlan(v, normal);
  const base = dayGoals({ ...data, vacation: undefined }, latestKg(data)).kcal;
  const food = foodPlan(v, base, data.profile);
  const valid = v.end >= v.start && v.start >= today;
  const save = () => {
    if (!valid) { say(v.end < v.start ? "The trip can't end before it starts." : "Pick a start date from today on."); return; }
    haptic("success"); update((d) => ({ ...d, vacation: v })); setEditing(false); say("Vacation plan saved.");
  };
  const gymId = v.gym?.type ?? "";
  const chip = (on: boolean) => on ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card2 };

  return <Sheet title="Vacation mode" onClose={onClose} testId="fit-vacation">
    {editing ? <>
      <p className="px-1 text-[15px]" style={{ color: C.steel }}>Tell Cooked about the trip. It will plan your workouts and your food around it.</p>
      <Title>The trip</Title>
      <Card className="!p-4"><Field label="Where to (optional)"><input value={v.place ?? ""} onChange={(e) => set({ place: e.target.value.slice(0, 60) })} placeholder="Cabo, Grandma's, Disney..." className={inputCls} style={inputStyle} /></Field>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Leave"><input type="date" value={v.start} min={today} onChange={(e) => set({ start: e.target.value, end: v.end < e.target.value ? e.target.value : v.end })} className={inputCls} style={inputStyle} /></Field>
          <Field label="Come back"><input type="date" value={v.end} min={v.start} onChange={(e) => set({ end: e.target.value })} className={inputCls} style={inputStyle} /></Field></div>
        <p className="mt-2 text-[13px]" style={{ color: C.dim }}>{valid ? `${tripDays(v)} day${tripDays(v) === 1 ? "" : "s"} away` : "Check the dates"}</p></Card>

      <Title>Working out on the trip</Title>
      <div className="grid grid-cols-3 gap-2">{COMMITS.map((c) => <button key={c.id} type="button" onClick={() => set({ commit: c.id, ...(c.id === "train" ? { mins: Math.max(v.mins, 40), perWeek: Math.min(7, Math.max(v.perWeek, normal)) } : c.id === "light" ? { mins: Math.min(v.mins, 30), perWeek: Math.min(Math.max(v.perWeek, 2), 4) } : { perWeek: 0 }) })} aria-pressed={v.commit === c.id} className="rounded-[12px] p-3 text-left" style={v.commit === c.id ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card }}>
        <span className="block text-[15px] font-bold leading-tight">{c.name}</span><span className="mt-1 block text-[12px] leading-tight opacity-80">{c.blurb}</span></button>)}</div>
      {v.commit !== "rest" && <Card className="mt-3 !p-4">
        <p className="text-[13px] font-semibold" style={{ color: C.dim }}>How long is a workout?</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">{[10, 15, 20, 30, 45, 60].map((m) => <button key={m} type="button" onClick={() => set({ mins: m })} aria-pressed={v.mins === m} className="h-10 rounded-full px-4 text-[14px] font-semibold" style={chip(v.mins === m)}>{m} min</button>)}</div>
        <p className="mt-3 text-[13px] font-semibold" style={{ color: C.dim }}>How many a week?</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">{[1, 2, 3, 4, 5, 6].map((n) => <button key={n} type="button" onClick={() => set({ perWeek: n })} aria-pressed={v.perWeek === n} className="h-10 w-11 rounded-full text-[15px] font-semibold" style={chip(v.perWeek === n)}>{n}</button>)}</div>
        <p className="mt-3 text-[13px] font-semibold" style={{ color: C.dim }}>Where will you train?</p>
        <div className="mt-1.5 grid grid-cols-2 gap-2">{GYM_TYPES.filter((g) => ["hotel", "apartment", "home", "other-gym", "none"].includes(g.id)).map((g) => <button key={g.id} type="button" onClick={() => set({ gym: { type: g.id, gear: [...g.gear] } })} aria-pressed={gymId === g.id} className="flex min-h-12 items-center gap-2 rounded-[10px] px-3 text-left text-[14px] font-semibold" style={chip(gymId === g.id)}><GymIcon gym={g} className="h-4 w-4 shrink-0" />{g.id === "other-gym" ? "A gym there" : g.name}</button>)}</div>
        {v.gym && <p className="mt-2 text-[12px]" style={{ color: C.dim }}>{GYM_BY_ID.get(v.gym.type)?.blurb}</p>}</Card>}
      <Card className="mt-3 flex items-center gap-3 !p-4"><div className="min-w-0 flex-1"><p className="text-[15px] font-semibold">Make it up around the trip</p><p className="text-[13px]" style={{ color: C.dim }}>Slightly longer workouts before you leave and after you're back</p></div>
        <button type="button" role="switch" aria-checked={v.makeUp} onClick={() => set({ makeUp: !v.makeUp })} className="h-8 w-14 shrink-0 rounded-full p-1 transition" style={{ background: v.makeUp ? C.lime : C.track }}><span className="block h-6 w-6 rounded-full bg-white transition" style={{ transform: v.makeUp ? "translateX(24px)" : undefined }} /></button></Card>

      <Title>Food</Title>
      <Card className="!p-4"><div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="text-[15px] font-semibold">Eat a little less before, enjoy the trip</p><p className="text-[13px]" style={{ color: C.dim }}>A small cut each day before you leave becomes your vacation budget</p></div>
        <button type="button" role="switch" aria-checked={v.food.bank} onClick={() => set({ food: { ...v.food, bank: !v.food.bank } })} className="h-8 w-14 shrink-0 rounded-full p-1 transition" style={{ background: v.food.bank ? C.lime : C.track }}><span className="block h-6 w-6 rounded-full bg-white transition" style={{ transform: v.food.bank ? "translateX(24px)" : undefined }} /></button></div>
        {v.food.bank && <>
          <p className="mt-3 text-[13px] font-semibold" style={{ color: C.dim }}>Extra to enjoy each day on the trip</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{[200, 400, 600, 800].map((n) => <button key={n} type="button" onClick={() => set({ food: { ...v.food, extra: n } })} aria-pressed={v.food.extra === n} className="h-10 rounded-full px-4 text-[14px] font-semibold" style={chip(v.food.extra === n)}>+{n} cal</button>)}</div>
          <p className="mt-3 text-[13px] font-semibold" style={{ color: C.dim }}>Start cutting back</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{[3, 5, 7, 10, 14].map((n) => <button key={n} type="button" onClick={() => set({ leadDays: n })} aria-pressed={v.leadDays === n} className="h-10 rounded-full px-4 text-[14px] font-semibold" style={chip(v.leadDays === n)}>{n} days before</button>)}</div></>}</Card>
      <Plan v={v} normal={normal} plan={plan} food={food} />
      <Btn className="mt-5 w-full" onClick={save} testId="fit-vacation-save"><Check className="h-5 w-5" />Save vacation plan</Btn>
      {data.vacation && <button type="button" onClick={() => { setV(data.vacation!); setEditing(false); }} className="mt-3 w-full text-[14px] underline" style={{ color: C.dim }}>Cancel</button>}
    </> : data.vacation && <>
      <Card className="!p-4"><div className="flex items-center gap-3"><Plane className="h-7 w-7 shrink-0" style={{ color: C.lime }} />
        <div className="min-w-0 flex-1"><p className="text-[24px] leading-none" style={display}>{data.vacation.place || "Your trip"}</p><p className="mt-1 text-[13px]" style={{ color: C.steel }}>{when(data.vacation.start)} to {when(data.vacation.end)} · {tripDays(data.vacation)} days</p></div>
        <button type="button" onClick={() => setEditing(true)} className="text-[14px] font-semibold" style={{ color: C.lime }}>Edit</button></div></Card>
      <VacationNow data={data} update={update} list={list} onStart={(a) => { onStart(a); onClose(); }} say={say} />
      <Plan v={data.vacation} normal={normal} plan={plan} food={food} />
      <Btn kind="danger" className="mt-5 w-full" onClick={() => { update((d) => ({ ...d, vacation: undefined })); onClose(); say("Vacation plan removed."); }}><Trash2 className="h-5 w-5" />Remove vacation plan</Btn>
    </>}
  </Sheet>;
}

function Plan({ v, normal, plan, food }: { v: Vacation; normal: number; plan: ReturnType<typeof workoutPlan>; food: ReturnType<typeof foodPlan> }) {
  return <>
    <Title>Your plan</Title>
    <Card className="!p-4"><div className="flex items-start gap-3"><Dumbbell className="mt-0.5 h-5 w-5 shrink-0" style={{ color: C.lime }} /><div className="text-[14px] leading-snug">
      <p className="font-semibold">Workouts</p>
      <p style={{ color: C.steel }}>Normally you do about {normal} a week. {v.commit === "rest" ? "On the trip you rest." : `On the trip: ${plan.planned} workout${plan.planned === 1 ? "" : "s"} of ${v.mins} minutes.`}</p>
      {plan.missed > 0 && <p className="mt-1" style={{ color: C.steel }}>That skips about {plan.missed}. {plan.extraMins > 0 ? `To cover it, each workout gets ${plan.extraMins} extra minutes in the ${v.leadDays} days before you leave (${plan.sessionsBefore}) and the ${v.backDays} days after you're back (${plan.sessionsAfter}).` : "Make-up is off."}</p>}
      {plan.missed === 0 && <p className="mt-1" style={{ color: C.steel }}>Your trip workouts cover your normal week.</p>}</div></div></Card>
    <Card className="mt-2 !p-4"><div className="flex items-start gap-3"><Utensils className="mt-0.5 h-5 w-5 shrink-0" style={{ color: C.lime }} /><div className="text-[14px] leading-snug">
      <p className="font-semibold">Food</p>
      {!v.food.bank ? <p style={{ color: C.steel }}>Your calorie goal stays the same all the way through.</p> : <>
        <p style={{ color: C.steel }}>For {v.leadDays} days before you leave your goal is {food.cutPerDay} calories lower ({Math.round(food.base)} down to {Math.round(food.base - food.cutPerDay)}). That banks {food.banked.toLocaleString()} calories.</p>
        <p className="mt-1" style={{ color: C.steel }}>On the trip your goal is {food.tripPerDay} calories higher each day.{food.capped ? ` You asked for ${v.food.extra} a day; a cut bigger than 15% a day isn't safe, so this is the most the plan can bank.` : ""}</p>
        <p className="mt-1" style={{ color: C.steel }}>If you go over the trip budget, your goal eases down a little (never more than 10%) for {v.backDays} days after.</p></>}</div></div></Card>
  </>;
}

/** What to do right now: a trip workout, a longer prep workout, or a note. */
function VacationNow({ data, update, list, onStart, say }: { data: FitData; update: Update; list: LibraryExercise[]; onStart: (a: ReturnType<typeof startWorkout>) => void; say: (m: string) => void }) {
  const v = data.vacation!;
  const { phase, n } = vacationPhase(v);
  const normal = normalPerWeek(data, data.program ? PROGRAM_BY_ID.get(data.program.id)?.daysPerWeek : undefined);
  const plan = workoutPlan(v, normal);
  const g = dayGoals(data, latestKg(data));
  void update; void say;
  return <div className="mt-3 space-y-2">
    {phase === "during" && v.commit !== "rest" && <Btn className="w-full" onClick={() => onStart(vacationWorkout(data, list, v, v.mins, "Vacation"))} testId="fit-vacation-workout"><Plane className="h-5 w-5" />Start a {v.mins}-minute vacation workout</Btn>}
    {(phase === "before" || phase === "after") && v.makeUp && plan.extraMins > 0 && <Btn className="w-full" onClick={() => onStart(vacationWorkout(data, list, v, 45 + plan.extraMins, phase === "before" ? "Trip prep" : "Back on track"))} testId="fit-vacation-prep"><Dumbbell className="h-5 w-5" />Start a {45 + plan.extraMins}-minute workout</Btn>}
    {g.note && <p className="rounded-[10px] px-3 py-2 text-[14px]" style={{ background: C.tint }}>{g.note}. Today: {g.kcal} calories.</p>}
    {phase === "none" && <p className="px-1 text-[13px]" style={{ color: C.dim }}>{dayKey() < v.start ? `Your plan starts ${v.leadDays} days before you leave (${when(plus(v.start, -v.leadDays))}).` : "Welcome back."} {n ? "" : ""}</p>}
  </div>;
}

/** On Today: the trip, counting down, with what to do about it. Hidden once the trip and the days after are over. */
export function VacationCard({ data, onOpen }: { data: FitData; onOpen: () => void }) {
  const v = data.vacation;
  if (v && vacationOver(v)) return null;
  const { phase, n } = vacationPhase(v);
  const line = !v ? "Plan a trip: workouts and food, before and after"
    : phase === "before" ? `${v.place || "Your trip"} in ${n} day${n === 1 ? "" : "s"}. Prep mode is on`
    : phase === "during" ? `${v.place || "Vacation"}, day ${n} of ${tripDays(v)}`
    : phase === "after" ? `Welcome back. Easing back in, day ${n} of ${v.backDays}`
    : `${v.place || "Your trip"} starts ${when(v.start)}`;
  return <button type="button" onClick={onOpen} className="fit-in mt-3 flex w-full items-center gap-3 rounded-[14px] p-3.5 text-left active:scale-[.98]" style={{ background: C.card, boxShadow: "inset 0 0 0 1px rgba(var(--fit-accent-rgb),.2)" }} data-testid="fit-today-vacation">
    <Plane className="h-5 w-5 shrink-0" style={{ color: C.lime }} />
    <span className="min-w-0 flex-1"><span className="block text-[13px]" style={{ color: C.dim }}>{v ? "Vacation mode" : "Going on a trip?"}</span><span className="block text-[15px] font-semibold leading-snug">{line}</span></span>
    <ChevronRight className="h-5 w-5 shrink-0" style={{ color: C.dim }} /></button>;
}

/** On Today: the rest of a workout that was saved part-way. */
export function SplitCard({ data, update, onStart }: { data: FitData; update: Update; onStart: (a: ReturnType<typeof startWorkout>) => void }) {
  const s = data.splitLeft;
  if (!s) return null;
  const sets = s.exercises.reduce((t, e) => t + e.sets.length, 0);
  const old = s.date !== dayKey();
  return <div className="fit-in mt-3 rounded-[14px] p-3.5" style={{ background: C.card, boxShadow: "inset 0 0 0 1px rgba(var(--fit-accent-rgb),.35)" }} data-testid="fit-today-split">
    <p className="text-[13px]" style={{ color: C.dim }}>{old ? "Left over from before" : "Finish your workout"}</p>
    <p className="text-[18px] font-semibold leading-snug">{s.name}, part {s.part}: {s.exercises.length} exercise{s.exercises.length === 1 ? "" : "s"}, {sets} set{sets === 1 ? "" : "s"} to go</p>
    <div className="mt-3 flex gap-2">
      <Btn className="flex-1" onClick={() => { haptic("medium"); onStart(startWorkout({ name: s.name, part: s.part, ...(s.programId ? { programId: s.programId, dayId: s.dayId } : {}), exercises: s.exercises })); update((d) => ({ ...d, splitLeft: undefined })); }} testId="fit-split-resume">Do it now</Btn>
      <Btn kind="soft" onClick={() => update((d) => ({ ...d, splitLeft: undefined }))}>Skip it</Btn></div>
  </div>;
}
