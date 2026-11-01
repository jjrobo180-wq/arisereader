// Arise Fit settings for Apple Health (connect, sync steps, active calories and weigh-ins, save
// workouts back) and reminders (workout days and time, water, weigh-in, fast complete). See fitNative.ts.
import { useEffect, useState } from "react";
import { Bell, Footprints, HeartPulse, RefreshCw } from "lucide-react";
import { dayKey, mergeWeights as mergeInto, type FitData } from "@shared/fit";
import type { Update } from "./fitStore";
import { applyReminders, connectHealth, disconnectHealth, healthConnected, readHealth, readReminders, type HealthSnapshot, type Reminders } from "./fitNative";
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
    <div className="mt-1 rounded-[14px] p-4" style={{ background: "linear-gradient(150deg, #3a0f17, #141518)" }}>
      <HeartPulse className="h-8 w-8" style={{ color: "#ff375f" }} />
      <p className="mt-2 text-[24px] leading-none" style={display}>{on ? "Connected" : "Connect Apple Health"}</p>
      <p className="mt-1 text-[14px] leading-snug" style={{ color: C.steel }}>Reads your steps, active calories, heart rate and weigh-ins. Saves your workouts' calories, run distances and weight back to Health.</p>
    </div>
    {!on ? <Btn className="mt-4 w-full" onClick={connect} disabled={busy} testId="fit-health-connect">{busy ? "Connecting…" : "Connect"}</Btn>
      : <div className="mt-4 grid grid-cols-2 gap-2"><Btn onClick={sync} disabled={busy}><RefreshCw className="h-4 w-4" />{busy ? "Syncing…" : "Sync now"}</Btn><Btn kind="soft" onClick={() => { disconnectHealth(); setOn(false); setMsg("Disconnected. To remove access fully: Settings → Health → Data Access & Devices → Arise Fit."); }}>Disconnect</Btn></div>}
    {msg && <p className="mt-3 rounded-[10px] px-3 py-2 text-[13px]" style={{ background: C.card, color: C.steel }}>{msg}</p>}
    {snap && <><Title>From Health</Title><div className="grid grid-cols-3 gap-2 text-center">
      {([[fmtNum(snap.steps[dayKey()] ?? 0), "steps today"], [fmtNum(snap.active[dayKey()] ?? 0), "active kcal"], [String(snap.weights.length), "weigh-ins"]] as const).map(([v, l]) => <Card key={l} className="!px-1 !py-3"><p className="text-[24px] leading-none" style={display}>{v}</p><p className="mt-1 text-[11px] uppercase tracking-[.08em]" style={{ color: C.dim }}>{l}</p></Card>)}
    </div></>}
    <Title>Daily step goal</Title>
    <div className="grid grid-cols-4 gap-2">{[6000, 8000, 10000, 12000].map((g) => <Btn key={g} kind={data.profile.stepsGoal === g ? "primary" : "soft"} className="!px-1 text-[14px]" onClick={() => update((d) => ({ ...d, profile: { ...d.profile, stepsGoal: g } }))}>{g / 1000}k</Btn>)}</div>
  </Sheet>;
}

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
export function RemindersSheet({ onClose }: { onClose: () => void }) {
  const [r, setR] = useState<Reminders>(readReminders);
  const [msg, setMsg] = useState("");
  const save = async (next: Reminders) => { setR(next); setMsg(""); try { await applyReminders(next); setMsg("Saved."); } catch (e: any) { setMsg(e.message); } };
  const row = (label: string, sub: string, on: boolean, flip: () => void, id: string) => <button type="button" onClick={flip} aria-pressed={on} className="flex w-full items-center gap-3 rounded-[12px] p-4 text-left" style={{ background: C.card }} data-testid={`fit-remind-${id}`}>
    <span className="min-w-0 flex-1"><span className="block text-[19px] leading-none" style={display}>{label}</span><span className="mt-1 block text-[12px]" style={{ color: C.dim }}>{sub}</span></span>
    <span className="relative h-7 w-12 shrink-0 rounded-full transition" style={{ background: on ? C.lime : C.card2 }}><span className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all" style={{ left: on ? 24 : 4 }} /></span>
  </button>;
  return <Sheet title="Reminders" onClose={onClose} testId="fit-reminders">
    <div className="mt-1 flex items-center gap-3 rounded-[14px] p-4" style={{ background: C.card2 }}><Bell className="h-6 w-6 shrink-0" style={{ color: C.lime }} /><p className="text-[14px]" style={{ color: C.steel }}>Notifications on this iPhone. Nothing is sent from a server.</p></div>
    <div className="mt-3 space-y-2">
      {row("Workout", `${r.workout.days.length} days a week at ${new Date(2000, 0, 1, r.workout.hour, r.workout.minute).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`, r.workout.on, () => save({ ...r, workout: { ...r.workout, on: !r.workout.on } }), "workout")}
      {r.workout.on && <Card className="!p-3">
        <div className="grid grid-cols-7 gap-1">{DAYS.map((d, i) => { const on = r.workout.days.includes(i); return <button key={i} type="button" onClick={() => save({ ...r, workout: { ...r.workout, days: on ? r.workout.days.filter((x) => x !== i) : [...r.workout.days, i].sort() } })} aria-pressed={on} className="h-10 rounded-[8px] text-[15px]" style={{ ...display, ...(on ? { background: C.lime, color: "#0b0b0c" } : { background: C.card2 }) }}>{d}</button>; })}</div>
        <input type="time" value={`${String(r.workout.hour).padStart(2, "0")}:${String(r.workout.minute).padStart(2, "0")}`} onChange={(e) => { const [h, m] = e.target.value.split(":").map(Number); if (Number.isFinite(h)) void save({ ...r, workout: { ...r.workout, hour: h, minute: m || 0 } }); }} aria-label="Reminder time" className="mt-2 h-12 w-full rounded-[8px] px-3 text-[17px]" style={{ background: C.card2, color: C.text }} />
      </Card>}
      {row("Water", "10 AM, 1, 4 and 7 PM", r.water, () => save({ ...r, water: !r.water }), "water")}
      {row("Weigh-in", "7:15 AM every day", r.weighIn, () => save({ ...r, weighIn: !r.weighIn }), "weigh")}
      {row("Fast complete", "When you hit your fasting goal", r.fasting, () => save({ ...r, fasting: !r.fasting }), "fast")}
    </div>
    {msg && <p className="mt-3 rounded-[10px] px-3 py-2 text-[13px]" style={{ background: C.card, color: C.steel }}>{msg}</p>}
  </Sheet>;
}
