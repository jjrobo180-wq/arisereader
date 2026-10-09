// The Notifications tab: turn phone notifications on for this device, then choose which ones
// arrive, when, and how many of each (water, news, meals, workouts, weigh-ins, recaps…).
// The choices are saved with the account (family.notify), so they apply on every device.
import { useAuth } from "@/context/AuthContext";
import type { ReactNode } from "react";
import { Bell, CalendarHeart, Droplet, Dumbbell, Pill, Minus, Moon, Newspaper, Plus, Receipt, Scale, SmilePlus, Sun, Sunset, Timer, Utensils } from "lucide-react";
import { MEALS, isOn, type Meal } from "@shared/familyHub";
import { NEWS_TOPICS } from "@shared/todoNews";
import { HEADS_UP_CHOICES, NEWS_MAX, WATER_MAX, dailyEstimate, defaultNotify, spreadTimes, type NotifyPrefs, type Weekday } from "@shared/todoNotify";
import { goalsFor, healthPeople } from "@shared/familyHealth";
import TodoNotifications from "./TodoNotifications";
import { PageHead, Panel, Toggle, clock12, inputClass, plain, type SectionProps } from "./ui";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MEAL_LABEL: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks" };
const timeInput = inputClass + " !min-h-10 !w-[7.5rem] shrink-0 px-2";

export default function NotificationSettings({ family, setFamily, today, say }: SectionProps) {
  const { user } = useAuth();
  const prefs = family.notify;
  const set = (fn: (p: NotifyPrefs) => NotifyPrefs) => setFamily((f) => ({ ...f, notify: fn(f.notify) }));
  const people = healthPeople(family, (user?.displayName || "").split(" ")[0]);
  const member = people.find((m) => m.id === prefs.memberId) || people.find((m) => m.kind === "adult") || people[0];
  const waterGoal = member ? goalsFor(family.health, member).water : 8;
  const healthOn = isOn("health", family);
  const moodOn = isOn("mood", family);
  const pillsOn = isOn("pills", family);
  const cycleOn = isOn("cycle", family);
  const weekday = new Date(`${today}T12:00:00`).getDay();
  const perDay = dailyEstimate(prefs, weekday);

  return <div className="space-y-6">
    <PageHead eyebrow="Notifications" title="Notifications"
      blurb="Pick the reminders you want, when they arrive and how many of each. Your choices are saved to your account and work on every device where notifications are on."
      action={<div className="rounded-2xl bg-violet-50 px-4 py-3 text-right"><p className="text-2xl font-black text-violet-800">{perDay}</p><p className="text-[11px] font-bold uppercase tracking-wider text-violet-600">a day today</p></div>} />

    <TodoNotifications />

    {people.length > 1 && (healthOn || moodOn) && <Panel eyebrow="Food & fitness" title="Whose reminders?">
      <p className="mb-3 text-sm text-slate-500">Water, meal, workout and weigh-in reminders follow this person's diary.</p>
      <div className="flex flex-wrap gap-2">{people.map((m) => <button key={m.id} type="button" onClick={() => set((p) => ({ ...p, memberId: m.id }))} aria-pressed={m.id === member?.id}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-2.5 pr-3 text-xs font-bold text-slate-600 ring-1 ring-slate-200"
        style={m.id === member?.id ? { background: m.color, color: "#fff", boxShadow: `0 0 0 1px ${m.color}` } : undefined}><span className="text-base leading-none">{m.emoji || "🙂"}</span>{m.name}</button>)}</div>
    </Panel>}

    <div className="grid gap-6 xl:grid-cols-2">
      <Panel eyebrow="Everyday" title="Your day">
        <ul className="divide-y divide-slate-100">
          <Row icon={<Sun size={18} />} tint="bg-amber-50 text-amber-600" title="Morning summary" detail="Today's tasks, events, chores and bills in one note"
            on={prefs.morning.on} onChange={(on) => set((p) => ({ ...p, morning: { ...p.morning, on } }))}>
            <Field label="Send at"><input type="time" className={timeInput} value={prefs.morning.time} onChange={(e) => e.target.value && set((p) => ({ ...p, morning: { ...p.morning, time: e.target.value } }))} /></Field>
          </Row>
          <Row icon={<Timer size={18} />} tint="bg-violet-50 text-violet-600" title="Heads-up before tasks & events" detail="For anything with a time"
            on={prefs.headsUp.on} onChange={(on) => set((p) => ({ ...p, headsUp: { ...p.headsUp, on } }))}>
            <Choices label="How early" value={prefs.headsUp.minutes} options={HEADS_UP_CHOICES.map((n) => ({ value: n, label: n === 60 ? "1 hr" : `${n} min` }))} onChange={(minutes) => set((p) => ({ ...p, headsUp: { ...p.headsUp, minutes } }))} />
          </Row>
          <Row icon={<Receipt size={18} />} tint="bg-emerald-50 text-emerald-600" title="Bills due tomorrow" detail="Skips bills on autopay"
            on={prefs.bills.on} onChange={(on) => set((p) => ({ ...p, bills: { on } }))} />
          <Row icon={<Sunset size={18} />} tint="bg-orange-50 text-orange-600" title="Evening recap" detail="Tasks done, calories left and water for the day"
            on={prefs.evening.on} onChange={(on) => set((p) => ({ ...p, evening: { ...p.evening, on } }))}>
            <Field label="Send at"><input type="time" className={timeInput} value={prefs.evening.time} onChange={(e) => e.target.value && set((p) => ({ ...p, evening: { ...p.evening, time: e.target.value } }))} /></Field>
          </Row>
          {moodOn && <Row icon={<SmilePlus size={18} />} tint="bg-pink-50 text-pink-600" title="Mood check-in" detail="Skipped when today's mood is logged"
            on={prefs.mood.on} onChange={(on) => set((p) => ({ ...p, mood: { ...p.mood, on } }))}>
            <Field label="Send at"><input type="time" className={timeInput} value={prefs.mood.time} onChange={(e) => e.target.value && set((p) => ({ ...p, mood: { ...p.mood, time: e.target.value } }))} /></Field>
          </Row>}
        </ul>
      </Panel>

      <Panel eyebrow="Headlines" title="News">
        <ul className="divide-y divide-slate-100">
          <Row icon={<Newspaper size={18} />} tint="bg-sky-50 text-sky-600" title="News headlines" detail="A current headline, spread through the day"
            on={prefs.news.on} onChange={(on) => set((p) => ({ ...p, news: { ...p.news, on } }))}>
            <Field label="How many a day"><Stepper value={prefs.news.perDay} min={1} max={NEWS_MAX} unit="headline" onChange={(perDay) => set((p) => ({ ...p, news: { ...p.news, perDay } }))} /></Field>
            <Field label="Topic"><select className={inputClass + " !min-h-10 !w-auto"} value={prefs.news.topic} onChange={(e) => set((p) => ({ ...p, news: { ...p.news, topic: e.target.value } }))}>
              {NEWS_TOPICS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select></Field>
            {prefs.news.topic === "local" && !family.news.place && <p className="text-xs font-semibold text-amber-700">Set your town in the News tab for local headlines. Until then you'll get top stories.</p>}
            <Window from={prefs.news.from} until={prefs.news.until} count={prefs.news.perDay} onChange={(from, until) => set((p) => ({ ...p, news: { ...p.news, from, until } }))} />
          </Row>
        </ul>
      </Panel>
    </div>

    {healthOn ? <Panel eyebrow="Food & fitness" title={people.length > 1 && member ? `Healthy habits for ${member.name}` : "Healthy habits"}>
      <ul className="divide-y divide-slate-100">
        <Row icon={<Droplet size={18} />} tint="bg-sky-50 text-sky-600" title="Water reminders" detail={`Your goal is ${waterGoal} cups a day`}
          on={prefs.water.on} onChange={(on) => set((p) => ({ ...p, water: { ...p.water, on } }))}>
          <Field label="How many a day"><Stepper value={prefs.water.perDay} min={1} max={WATER_MAX} unit="reminder" onChange={(perDay) => set((p) => ({ ...p, water: { ...p.water, perDay } }))} /></Field>
          {prefs.water.perDay !== waterGoal && <button type="button" onClick={() => set((p) => ({ ...p, water: { ...p.water, perDay: Math.min(WATER_MAX, Math.max(1, waterGoal)) } }))} className="text-left text-xs font-bold text-violet-700 underline underline-offset-2">Match my goal ({waterGoal})</button>}
          <Window from={prefs.water.from} until={prefs.water.until} count={prefs.water.perDay} onChange={(from, until) => set((p) => ({ ...p, water: { ...p.water, from, until } }))} />
          <Check on={prefs.water.skipWhenMet} label="Stop once I've hit my water goal" onChange={(skipWhenMet) => set((p) => ({ ...p, water: { ...p.water, skipWhenMet } }))} />
        </Row>
        <Row icon={<Utensils size={18} />} tint="bg-orange-50 text-orange-600" title="Log your meals" detail="A nudge to fill in the food diary"
          on={prefs.meals.on} onChange={(on) => set((p) => ({ ...p, meals: { ...p.meals, on } }))}>
          <div className="space-y-2">{MEALS.map((meal) => {
            const picked = prefs.meals.which.includes(meal);
            return <div key={meal} className="flex items-center justify-between gap-3">
              <Check on={picked} label={MEAL_LABEL[meal]} onChange={(on) => set((p) => ({ ...p, meals: { ...p.meals, which: MEALS.filter((m) => m === meal ? on : p.meals.which.includes(m)) } }))} />
              <input type="time" disabled={!picked} aria-label={`${MEAL_LABEL[meal]} reminder time`} className={timeInput + " disabled:opacity-40"} value={prefs.meals.times[meal]}
                onChange={(e) => e.target.value && set((p) => ({ ...p, meals: { ...p.meals, times: { ...p.meals.times, [meal]: e.target.value } } }))} />
            </div>;
          })}</div>
          <Check on={prefs.meals.skipIfLogged} label="Skip a meal I've already logged" onChange={(skipIfLogged) => set((p) => ({ ...p, meals: { ...p.meals, skipIfLogged } }))} />
        </Row>
        <Row icon={<Dumbbell size={18} />} tint="bg-violet-50 text-violet-600" title="Workout reminder" detail="On the days you pick"
          on={prefs.workout.on} onChange={(on) => set((p) => ({ ...p, workout: { ...p.workout, on } }))}>
          <Days value={prefs.workout.days} onChange={(days) => set((p) => ({ ...p, workout: { ...p.workout, days } }))} />
          <Field label="Send at"><input type="time" className={timeInput} value={prefs.workout.time} onChange={(e) => e.target.value && set((p) => ({ ...p, workout: { ...p.workout, time: e.target.value } }))} /></Field>
          <Check on={prefs.workout.skipIfLogged} label="Skip days I've already logged exercise" onChange={(skipIfLogged) => set((p) => ({ ...p, workout: { ...p.workout, skipIfLogged } }))} />
        </Row>
        {member?.kind !== "kid" && <Row icon={<Scale size={18} />} tint="bg-emerald-50 text-emerald-600" title="Weigh-in reminder" detail="Keeps your weight chart up to date"
          on={prefs.weighIn.on} onChange={(on) => set((p) => ({ ...p, weighIn: { ...p.weighIn, on } }))}>
          <Days value={prefs.weighIn.days} onChange={(days) => set((p) => ({ ...p, weighIn: { ...p.weighIn, days } }))} />
          <Field label="Send at"><input type="time" className={timeInput} value={prefs.weighIn.time} onChange={(e) => e.target.value && set((p) => ({ ...p, weighIn: { ...p.weighIn, time: e.target.value } }))} /></Field>
        </Row>}
      </ul>
    </Panel> : <Panel eyebrow="Food & fitness" title="Healthy habits"><p className="text-sm text-slate-500">Turn on Food & fitness in Family & settings to get water, meal, workout and weigh-in reminders.</p></Panel>}

    {(pillsOn || cycleOn) && <Panel eyebrow="Health" title="Pills and cycle">
      <ul className="divide-y divide-slate-100">
        {pillsOn && <Row icon={<Pill size={18} />} tint="bg-violet-50 text-violet-600" title="Pill reminders" detail="At each dose time, until it's marked taken or skipped"
          on={prefs.pills.on} onChange={(on) => set((p) => ({ ...p, pills: { ...p.pills, on } }))}>
          <Check on={prefs.pills.loud} label="Remind me even during quiet hours" onChange={(loud) => set((p) => ({ ...p, pills: { ...p.pills, loud } }))} />
          <Check on={prefs.pills.refill} label="Tell me when a pill is running low" onChange={(refill) => set((p) => ({ ...p, pills: { ...p.pills, refill } }))} />
        </Row>}
        {cycleOn && <Row icon={<CalendarHeart size={18} />} tint="bg-rose-50 text-rose-600" title="Period heads-up" detail="A morning note before a period is expected"
          on={prefs.period.on} onChange={(on) => set((p) => ({ ...p, period: { ...p.period, on } }))}>
          <Field label="How many days before"><Stepper value={prefs.period.daysBefore} min={1} max={7} unit="day" onChange={(daysBefore) => set((p) => ({ ...p, period: { ...p.period, daysBefore } }))} /></Field>
        </Row>}
      </ul>
    </Panel>}

    <Panel eyebrow="Do not disturb" title="Quiet hours">
      <ul className="divide-y divide-slate-100">
        <Row icon={<Moon size={18} />} tint="bg-indigo-50 text-indigo-600" title="Quiet hours" detail="Nothing is sent during this time, not even heads-ups"
          on={prefs.quiet.on} onChange={(on) => set((p) => ({ ...p, quiet: { ...p.quiet, on } }))}>
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
            <input type="time" aria-label="Quiet from" className={timeInput} value={prefs.quiet.from} onChange={(e) => e.target.value && set((p) => ({ ...p, quiet: { ...p.quiet, from: e.target.value } }))} />
            <span>to</span>
            <input type="time" aria-label="Quiet until" className={timeInput} value={prefs.quiet.until} onChange={(e) => e.target.value && set((p) => ({ ...p, quiet: { ...p.quiet, until: e.target.value } }))} />
          </div>
        </Row>
      </ul>
      <button type="button" onClick={() => { if (window.confirm("Put every notification setting back to how it started?")) { set(() => ({ ...defaultNotify(), memberId: prefs.memberId })); say("Notification settings reset"); } }} className={plain + " mt-4 text-xs"}><Bell size={14} /> Reset to defaults</button>
    </Panel>
  </div>;
}

function Row({ icon, tint, title, detail, on, onChange, children }: { icon: ReactNode; tint: string; title: string; detail: string; on: boolean; onChange: (on: boolean) => void; children?: ReactNode }) {
  return <li className="py-3.5 first:pt-0 last:pb-0">
    <div className="flex items-center gap-3">
      <span className={`shrink-0 rounded-xl p-2 ${on ? tint : "bg-slate-100 text-slate-400"}`}>{icon}</span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-800">{title}</span><span className="block text-xs leading-5 text-slate-500">{detail}</span></span>
      <Toggle on={on} label={title} onChange={onChange} />
    </div>
    {on && children && <div className="mt-3 space-y-3 rounded-2xl bg-slate-50 p-3 sm:ml-12">{children}</div>}
  </li>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold text-slate-600">{label}</span>{children}</div>;
}

function Stepper({ value, min, max, unit, onChange }: { value: number; min: number; max: number; unit: string; onChange: (n: number) => void }) {
  return <div className="flex items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200" role="group" aria-label={`${unit}s a day`}>
    <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${unit}s`} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30"><Minus size={16} /></button>
    <span className="min-w-[2.5rem] text-center text-base font-black text-slate-800" aria-live="polite">{value}</span>
    <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${unit}s`} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30"><Plus size={16} /></button>
  </div>;
}

function Choices<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return <div><p className="mb-1.5 text-xs font-bold text-slate-600">{label}</p><div className="flex flex-wrap gap-1.5">{options.map((o) =>
    <button key={String(o.value)} type="button" onClick={() => onChange(o.value)} aria-pressed={o.value === value}
      className={`min-h-9 rounded-xl px-3 text-xs font-bold ring-1 ${o.value === value ? "bg-[#6e5ae0] text-white ring-[#6e5ae0]" : "bg-white text-slate-600 ring-slate-200"}`}>{o.label}</button>)}</div></div>;
}

function Window({ from, until, count, onChange }: { from: string; until: string; count: number; onChange: (from: string, until: string) => void }) {
  const times = spreadTimes(from, until, count);
  return <div>
    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
      <span>Between</span>
      <input type="time" aria-label="First reminder" className={timeInput} value={from} onChange={(e) => e.target.value && onChange(e.target.value, until)} />
      <span>and</span>
      <input type="time" aria-label="Last reminder" className={timeInput} value={until} onChange={(e) => e.target.value && onChange(from, e.target.value)} />
    </div>
    <div className="mt-2 flex flex-wrap gap-1">{times.map((t, i) => <span key={i} className="rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200">{clock12(t)}</span>)}</div>
  </div>;
}

function Days({ value, onChange }: { value: Weekday[]; onChange: (days: Weekday[]) => void }) {
  return <div className="flex gap-1.5" role="group" aria-label="Days">{DAY_LETTERS.map((letter, i) => {
    const day = i as Weekday;
    const on = value.includes(day);
    return <button key={i} type="button" aria-pressed={on} aria-label={DAY_NAMES[i]} onClick={() => onChange((on ? value.filter((d) => d !== day) : [...value, day]).sort() as Weekday[])}
      className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-black ring-1 ${on ? "bg-[#6e5ae0] text-white ring-[#6e5ae0]" : "bg-white text-slate-500 ring-slate-200"}`}>{letter}</button>;
  })}</div>;
}

function Check({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
    <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 rounded accent-[#6e5ae0]" />{label}
  </label>;
}
