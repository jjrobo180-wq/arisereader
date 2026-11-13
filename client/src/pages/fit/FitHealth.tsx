// Cooked settings for Apple Health (connect, sync steps, active calories and weigh-ins, save
// workouts back) and reminders (workout days and time, water, weigh-in, fast complete). See fitNative.ts.
import { useEffect, useState } from "react";
import { Bell, Footprints, HeartPulse, RefreshCw } from "lucide-react";
import { dayKey, mergeWeights as mergeInto, type FitData } from "@shared/fit";
import type { Update } from "./fitStore";
import { applyReminders, canUseNative, connectHealth, disconnectHealth, healthConnected, readHealth, readReminders, testNotification, type HealthSnapshot, type Reminders } from "./fitNative";
import { MEALS, type MealKey } from "@shared/fitReminders";
import { PushPrefsList, Switch, usePushPrefs } from "../coach/PushPrefs";
import { Btn, C, Card, Sheet, Title, display, fmtNum } from "./fitUi";

/** Adds Apple Health weigh-ins the app doesn't have yet (its own entries win). */
export const mergeWeights = (d: FitData, snap: HealthSnapshot): FitData => mergeInto(d, snap.weights);

let cache: HealthSnapshot | null = null;
/** Today's Apple Health numbers, read once per app open when Health is connected. */
export function useHealth(update: Update): HealthSnapshot | null {
  const [snap, setSnap] = useState<HealthSnapshot | null>(cache);
  useEffect(() => {
    if (cache || !healthConnected()) return;
    readHealth().then((s) => { cache = s; setSnap(s); update((d) => mergeWeights(d, s)); }).catch(() => {});
  }, [update]);
  return snap;
}

export function StepsCard({ data, snap }: { data: FitData; snap: HealthSnapshot }) {
  const today = snap.steps[dayKey()] ?? 0;
  const goal = data.profile.stepsGoal;
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return snap.steps[dayKey(d)] ?? 0; });
  const max = Math.max(goal, ...week);
  return <Card className="!p-4" testId="fit-steps">
    <div className="flex items-center gap-3">
      <Footprints className="h-6 w-6" style={{ color: C.lime }} />
      <div className="min-w-0 flex-1"><p className="text-[30px] leading-none tabular-nums" style={display}>{fmtNum(today)}</p><p className="text-[12px] uppercase tracking-[.1em]" style={{ color: C.dim }}>steps · goal {fmtNum(goal)}</p></div>
      <div className="flex h-12 items-end gap-1">{week.map((v, i) => <div key={i} className="w-2.5 rounded-t-[2px]" style={{ height: `${Math.max(6, (v / max) * 48)}px`, background: v >= goal ? C.lime : C.card2 }} />)}</div>
    </div>
    {snap.active[dayKey()] ? <p className="mt-2 text-[12px]" style={{ color: C.dim }}>{fmtNum(snap.active[dayKey()])} active calories today · from Apple Health</p> : null}
  </Card>;
}

export function HealthSheet({ data, update, onClose }: { data: FitData; update: Update; onClose: () => void }) {
  const [on, setOn] = useState(healthConnected());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [snap, setSnap] = useState<HealthSnapshot | null>(cache);
  const sync = async () => {
    setBusy(true); setMsg("");
    try { const s = await readHealth(); cache = s; setSnap(s); update((d) => mergeWeights(d, s)); setMsg("Synced with Apple Health."); }
    catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const connect = async () => { setBusy(true); setMsg(""); try { await connectHealth(); setOn(true); setBusy(false); await sync(); } catch (e: any) { setMsg(e.message); setBusy(false); } };
  return <Sheet title="Apple Health" onClose={onClose} testId="fit-health">
    <div className="mt-1 rounded-[14px] p-4" style={{ background: `linear-gradient(150deg, ${C.tint}, ${C.card})` }}>
      <HeartPulse className="h-8 w-8" style={{ color: "#ff375f" }} />
      <p className="mt-2 text-[24px] leading-none" style={display}>{on ? "Connected" : "Connect Apple Health"}</p>
      <p className="mt-1 text-[14px] leading-snug" style={{ color: C.steel }}>Reads your steps, active calories, sleep (with deep and REM from an Apple Watch), heart rate and weigh-ins. Saves your workouts' calories, run distances, mindful minutes and weight back to Health.</p>
    </div>
    {!on ? <Btn className="mt-4 w-full" onClick={connect} disabled={busy} testId="fit-health-connect">{busy ? "Connecting…" : "Connect"}</Btn>
      : <div className="mt-4 grid grid-cols-2 gap-2"><Btn onClick={sync} disabled={busy}><RefreshCw className="h-4 w-4" />{busy ? "Syncing…" : "Sync now"}</Btn><Btn kind="soft" onClick={() => { disconnectHealth(); setOn(false); setMsg("Disconnected. To remove access fully: Settings → Health → Data Access & Devices → Cooked."); }}>Disconnect</Btn></div>}
    {msg && <p className="mt-3 rounded-[10px] px-3 py-2 text-[13px]" style={{ background: C.card, color: C.steel }}>{msg}</p>}
    {snap && <><Title>From Health</Title><div className="grid grid-cols-3 gap-2 text-center">
      {([[fmtNum(snap.steps[dayKey()] ?? 0), "steps today"], [fmtNum(snap.active[dayKey()] ?? 0), "active kcal"], [String(snap.weights.length), "weigh-ins"]] as const).map(([v, l]) => <Card key={l} className="!px-1 !py-3"><p className="text-[24px] leading-none" style={display}>{v}</p><p className="mt-1 text-[11px] uppercase tracking-[.08em]" style={{ color: C.dim }}>{l}</p></Card>)}
    </div></>}
    <Title>Daily step goal</Title>
    <div className="grid grid-cols-4 gap-2">{[6000, 8000, 10000, 12000].map((g) => <Btn key={g} kind={data.profile.stepsGoal === g ? "primary" : "soft"} className="!px-1 text-[14px]" onClick={() => update((d) => ({ ...d, profile: { ...d.profile, stepsGoal: g } }))}>{g / 1000}k</Btn>)}</div>
  </Sheet>;
}

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const fmtTime = (t: string) => { const [h, m] = t.split(":").map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); };
const timeInput = (value: string, set: (t: string) => void, label: string) => <input type="time" value={value} aria-label={label} onChange={(e) => { if (/^\d{2}:\d{2}$/.test(e.target.value)) set(e.target.value); }} className="h-12 w-full rounded-[8px] px-3 text-[17px]" style={{ background: C.card2, color: C.text }} />;

/** Every notification in Cooked: food, sleep, training, and alerts from other people, with one switch to pause them all. */
export function RemindersSheet({ data, update, onClose }: { data?: FitData; update?: Update; onClose: () => void }) {
  const [r, setR] = useState<Reminders>(readReminders);
  const [msg, setMsg] = useState("");
  const push = usePushPrefs();
  const sc = data?.sleep?.schedule, rm = data?.sleep?.remind;
  const sleep = sc ? { bed: sc.bed, wake: sc.wake, windDown: rm?.windDown ?? true, morning: rm?.morning ?? true, bedtime: rm?.bedtime ?? false } : null;
  const save = async (next: Reminders, nextSleep = sleep) => { setR(next); setMsg(""); try { await applyReminders(next, nextSleep); setMsg(canUseNative() ? "Saved." : "Saved. Reminders ring on the Cooked iPhone app."); } catch (e: any) { setMsg(e.message); } };
  const setSleep = (patch: Partial<NonNullable<typeof sleep>>) => {
    if (!sleep || !update) return;
    const next = { ...sleep, ...patch };
    update((d) => ({ ...d, sleep: { ...(d.sleep ?? { goalH: 8, nights: [] }), remind: { windDown: next.windDown, morning: next.morning, bedtime: next.bedtime } } }));
    void save(r, next);
  };
  const meal = (k: MealKey, patch: Partial<{ on: boolean; time: string }>) => save({ ...r, food: { ...r.food, meals: { ...r.food.meals, [k]: { ...r.food.meals[k], ...patch } } } });
  const paused = r.paused || (push.prefs ? !push.prefs.all : false);
  const pauseAll = (on: boolean) => { void save({ ...r, paused: on }); if (push.prefs) void push.save({ ...push.prefs, all: !on }); };
  const off = r.paused;
  return <Sheet title="Notifications" onClose={onClose} testId="fit-reminders">
    <div className="mt-1 flex items-center gap-3 rounded-[14px] p-4" style={{ background: C.card2 }}><Bell className="h-6 w-6 shrink-0" style={{ color: C.lime }} /><p className="text-[14px]" style={{ color: C.steel }}>Reminders ring on this iPhone at the times you pick. Alerts from your trainer and friends come from Arise.</p></div>
    <div className="mt-3"><Switch label="Pause all" sub="Everything off for now. Medicine reminders stay on." on={paused} flip={() => pauseAll(!paused)} testId="fit-remind-pause" /></div>

    <Title>Food</Title>
    <div className={`space-y-2 ${off ? "opacity-50" : ""}`}>
      {MEALS.map((m) => { const s = r.food.meals[m.key]; return <div key={m.key}>
        <Switch label={m.label} sub={s.on ? `Every day at ${fmtTime(s.time)}` : "Off"} on={s.on} flip={() => meal(m.key, { on: !s.on })} testId={`fit-remind-${m.key}`} />
        {s.on && <Card className="mt-1 !p-3">{timeInput(s.time, (t) => meal(m.key, { time: t }), `${m.label} time`)}</Card>}
      </div>; })}
      <Switch label="Log your day" sub={r.food.recap.on ? `At ${fmtTime(r.food.recap.time)}: add anything you didn't log` : "An evening nudge to finish your food log"} on={r.food.recap.on} flip={() => save({ ...r, food: { ...r.food, recap: { ...r.food.recap, on: !r.food.recap.on } } })} testId="fit-remind-recap" />
      {r.food.recap.on && <Card className="!p-3">{timeInput(r.food.recap.time, (t) => save({ ...r, food: { ...r.food, recap: { ...r.food.recap, time: t } } }), "Log your day time")}</Card>}
      <Switch label="Fast complete" sub="When you hit your fasting goal" on={r.fasting} flip={() => save({ ...r, fasting: !r.fasting })} testId="fit-remind-fast" />
      <Switch label="Water" sub="10 AM, 1, 4 and 7 PM" on={r.water} flip={() => save({ ...r, water: !r.water })} testId="fit-remind-water" />
    </div>

    <Title>Sleep</Title>
    {sleep ? <div className={`space-y-2 ${off ? "opacity-50" : ""}`}>
      <p className="px-1 text-[13px]" style={{ color: C.dim }}>Bedtime {fmtTime(sleep.bed)} · wake {fmtTime(sleep.wake)}. Change the times in Sleep → Bedtime schedule.</p>
      <Switch label="Wind down" sub={`${fmtTime(shiftTime(sleep.bed, -30))}, 30 minutes before bed`} on={sleep.windDown} flip={() => setSleep({ windDown: !sleep.windDown })} testId="fit-remind-winddown" />
      <Switch label="Bedtime" sub={`${fmtTime(sleep.bed)}, tap to start tracking`} on={sleep.bedtime} flip={() => setSleep({ bedtime: !sleep.bedtime })} testId="fit-remind-bedtime" />
      <Switch label="Morning check-in" sub={`${fmtTime(shiftTime(sleep.wake, 15))}, how did you sleep?`} on={sleep.morning} flip={() => setSleep({ morning: !sleep.morning })} testId="fit-remind-morning" />
    </div> : <Card className="!p-4"><p className="text-[14px]" style={{ color: C.steel }}>Set a bedtime schedule in Sleep to get wind-down, bedtime and morning reminders.</p></Card>}

    <Title>Training</Title>
    <div className={`space-y-2 ${off ? "opacity-50" : ""}`}>
      <Switch label="Workout" sub={`${r.workout.days.length} days a week at ${new Date(2000, 0, 1, r.workout.hour, r.workout.minute).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`} on={r.workout.on} flip={() => save({ ...r, workout: { ...r.workout, on: !r.workout.on } })} testId="fit-remind-workout" />
      {r.workout.on && <Card className="!p-3">
        <div className="grid grid-cols-7 gap-1">{DAYS.map((d, i) => { const on = r.workout.days.includes(i); return <button key={i} type="button" onClick={() => save({ ...r, workout: { ...r.workout, days: on ? r.workout.days.filter((x) => x !== i) : [...r.workout.days, i].sort() } })} aria-pressed={on} className="h-10 rounded-[8px] text-[15px]" style={{ ...display, ...(on ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card2 }) }}>{d}</button>; })}</div>
        <div className="mt-2">{timeInput(`${String(r.workout.hour).padStart(2, "0")}:${String(r.workout.minute).padStart(2, "0")}`, (t) => { const [h, m] = t.split(":").map(Number); void save({ ...r, workout: { ...r.workout, hour: h, minute: m } }); }, "Workout reminder time")}</div>
      </Card>}
      <Switch label="Weigh-in" sub={`${fmtTime(r.weighTime)} every day`} on={r.weighIn} flip={() => save({ ...r, weighIn: !r.weighIn })} testId="fit-remind-weigh" />
      {r.weighIn && <Card className="!p-3">{timeInput(r.weighTime, (t) => save({ ...r, weighTime: t }), "Weigh-in time")}</Card>}
      <p className="px-1 text-[12px]" style={{ color: C.dim }}>Medicine reminders are set per medicine in the Medicine tracker.</p>
    </div>

    <Title>From other people</Title>
    <PushPrefsList app="fit" prefs={push.prefs} save={push.save} />
    {push.err && <p className="mt-2 px-1 text-[13px]" style={{ color: C.red }}>{push.err}</p>}

    {canUseNative() && <Btn kind="soft" className="mt-4 w-full" onClick={async () => setMsg((await testNotification()) ? "A test notification is coming in 5 seconds." : "Notifications are off for Cooked. Turn them on in Settings → Notifications → Cooked.")}>Send a test notification</Btn>}
    {msg && <p className="mt-3 rounded-[10px] px-3 py-2 text-[13px]" style={{ background: C.card, color: C.steel }}>{msg}</p>}
  </Sheet>;
}
const shiftTime = (t: string, mins: number) => { const [h, m] = t.split(":").map(Number); const x = (((h * 60 + m + mins) % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };
