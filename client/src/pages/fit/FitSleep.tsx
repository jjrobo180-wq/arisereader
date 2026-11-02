// Arise Fit: sleep. Tap "Going to sleep" at night and "I'm awake" in the morning, or log a night by hand.
import { useEffect, useState } from "react";
import { Moon, Sun, Check, Trash2 } from "lucide-react";
import type { FitData } from "@shared/fit";
import { addNight, emptySleep, lastDays, nightHours, sleepStats } from "@shared/fitSleep";
import { Btn, C, Card, Field, Sheet, Title, display, fmtNum, haptic, inputCls, inputStyle } from "./fitUi";
import type { Update } from "./fitStore";

const hm = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const dow = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString([], { weekday: "short" });
const pad = (n: number) => String(n).padStart(2, "0");
const toInput = (t: number) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

/** Today's time of day `hhmm`, or yesterday's if `before` is given and it would land after it. */
function when(hhmm: string, before?: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(); d.setHours(h || 0, m || 0, 0, 0);
  if (before != null && d.getTime() >= before) d.setDate(d.getDate() - 1);
  return d.getTime();
}

export function SleepChart({ data, height = 96 }: { data: FitData; height?: number }) {
  const days = lastDays(data.sleep, 7), goal = data.sleep?.goalH ?? 8;
  const top = Math.max(goal + 1, ...days.map((d) => d.h ?? 0));
  return <div className="flex items-end gap-2" style={{ height }} role="img" aria-label="Hours slept, last 7 days">
    {days.map((d) => <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
      <div className="w-full rounded-t-[6px]" style={{ height: `${d.h ? Math.max(6, (d.h / top) * 100) : 4}%`, background: d.h == null ? C.track : d.h >= goal - 0.25 ? C.lime : C.orange, opacity: d.h == null ? 0.6 : 1 }} />
      <span className="text-[11px]" style={{ color: C.dim }}>{dow(d.date).slice(0, 1)}</span></div>)}
  </div>;
}

export function SleepSheet({ data, update, onClose, say }: { data: FitData; update: Update; onClose: () => void; say: (m: string) => void }) {
  const sleep = data.sleep ?? emptySleep();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!sleep.asleepAt) return; const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, [sleep.asleepAt]);
  const [bed, setBed] = useState("22:30"), [wake, setWake] = useState("06:30"), [q, setQ] = useState(0);
  const st = sleepStats(data.sleep, 7);
  const last = sleep.nights[sleep.nights.length - 1];

  const start = () => { haptic("light"); update((d) => ({ ...d, sleep: { ...(d.sleep ?? emptySleep()), asleepAt: Date.now() } })); say("Sleep timer started. Tap I'm awake in the morning."); };
  const cancel = () => update((d) => ({ ...d, sleep: { ...(d.sleep ?? emptySleep()), asleepAt: undefined } }));
  const awake = () => {
    const at = sleep.asleepAt; if (!at) return;
    const end = Date.now();
    if (end - at < 30 * 60_000) { say("That was under 30 minutes, so it wasn't saved as a night."); cancel(); return; }
    haptic("success");
    update((d) => ({ ...d, sleep: addNight(d.sleep, at, end) }));
    say(`Good morning. You slept ${hm((end - at) / 3_600_000)}.`);
  };
  const logIt = () => {
    const w = when(wake, Date.now() + 1), b = when(bed, w);
    if (w - b < 30 * 60_000 || w - b > 20 * 3_600_000) { say("Those times don't look right. Sleep is between 30 minutes and 20 hours."); return; }
    haptic("success");
    update((d) => ({ ...d, sleep: addNight(d.sleep, b, w, q || undefined) }));
    say(`Saved ${hm((w - b) / 3_600_000)} of sleep.`);
  };
  const setGoal = (h: number) => update((d) => ({ ...d, sleep: { ...(d.sleep ?? emptySleep()), goalH: Math.min(12, Math.max(4, h)) } }));
  const remove = (date: string) => update((d) => ({ ...d, sleep: { ...(d.sleep ?? emptySleep()), nights: (d.sleep?.nights ?? []).filter((n) => n.date !== date) } }));

  return <Sheet title="Sleep" onClose={onClose} testId="fit-sleep">
    {sleep.asleepAt
      ? <Card className="!p-5 text-center"><Moon className="mx-auto h-7 w-7" style={{ color: C.lime }} />
          <p className="mt-2 text-[44px] leading-none tabular-nums" style={display}>{hm(Math.max(0, now - sleep.asleepAt) / 3_600_000)}</p>
          <p className="mt-1 text-[13px]" style={{ color: C.dim }}>Asleep since {clock(sleep.asleepAt)}</p>
          <Btn className="mt-4 w-full" onClick={awake} testId="fit-sleep-awake"><Sun className="h-5 w-5" />I'm awake</Btn>
          <button type="button" onClick={cancel} className="mt-3 text-[13px] underline" style={{ color: C.dim }}>Cancel</button></Card>
      : <Card className="!p-5"><div className="flex items-center gap-4"><div className="min-w-0 flex-1">
          <p className="text-[13px]" style={{ color: C.dim }}>{last ? `Last night, ${clock(last.bed)} to ${clock(last.wake)}` : "No sleep logged yet"}</p>
          <p className="mt-1 text-[44px] leading-none tabular-nums" style={display}>{last ? hm(nightHours(last)) : "—"}</p></div>
          <Moon className="h-8 w-8 shrink-0" style={{ color: C.lime }} /></div>
          <Btn className="mt-4 w-full" onClick={start} testId="fit-sleep-start"><Moon className="h-5 w-5" />Going to sleep</Btn></Card>}

    <Title>Last 7 days</Title>
    <Card className="!p-4"><SleepChart data={data} />
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div><p className="text-[22px] leading-none tabular-nums" style={display}>{st.n ? hm(st.avg) : "—"}</p><p className="mt-1 text-[11px]" style={{ color: C.dim }}>average</p></div>
        <div><p className="text-[22px] leading-none tabular-nums" style={display}>{st.hit}/{st.n || 0}</p><p className="mt-1 text-[11px]" style={{ color: C.dim }}>nights at goal</p></div>
        <div><p className="text-[22px] leading-none tabular-nums" style={display}>{st.n ? hm(st.debt) : "—"}</p><p className="mt-1 text-[11px]" style={{ color: C.dim }}>sleep debt</p></div></div></Card>

    <Title>Sleep goal</Title>
    <Card className="!p-4"><div className="flex items-center justify-between">
      <Btn kind="soft" className="!min-h-10 !px-4" onClick={() => setGoal(sleep.goalH - 0.5)} disabled={sleep.goalH <= 4}>−</Btn>
      <p className="text-[28px] tabular-nums" style={display}>{fmtNum(sleep.goalH)} hours</p>
      <Btn kind="soft" className="!min-h-10 !px-4" onClick={() => setGoal(sleep.goalH + 0.5)} disabled={sleep.goalH >= 12}>+</Btn></div></Card>

    {!sleep.asleepAt && <>
      <Title>Log a night</Title>
      <Card className="!p-4"><div className="grid grid-cols-2 gap-3">
        <Field label="Went to bed"><input type="time" value={bed} onChange={(e) => setBed(e.target.value)} className={inputCls} style={inputStyle} /></Field>
        <Field label="Woke up"><input type="time" value={wake} onChange={(e) => setWake(e.target.value)} className={inputCls} style={inputStyle} /></Field></div>
        <p className="mt-3 text-[13px] font-semibold" style={{ color: C.dim }}>How rested do you feel? (optional)</p>
        <div className="mt-1.5 grid grid-cols-5 gap-1.5">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setQ(q === n ? 0 : n)} aria-pressed={q === n} className="h-10 rounded-[10px] text-[15px] font-semibold" style={q === n ? { background: C.lime, color: "#0b0b0c" } : { background: C.card2 }}>{n}</button>)}</div>
        <Btn className="mt-4 w-full" onClick={logIt} testId="fit-sleep-log"><Check className="h-5 w-5" />Save night</Btn></Card></>}

    {sleep.nights.length > 0 && <><Title>History</Title>
      <Card className="!p-3"><ul className="divide-y" style={{ borderColor: C.track }}>{[...sleep.nights].reverse().slice(0, 14).map((n) => <li key={n.date} className="flex items-center gap-3 py-2.5 text-[14px]">
        <span className="w-10 font-semibold">{dow(n.date)}</span>
        <span className="min-w-0 flex-1" style={{ color: C.dim }}>{clock(n.bed)} to {clock(n.wake)}{n.q ? ` · rested ${n.q}/5` : ""}</span>
        <span className="tabular-nums font-semibold">{hm(nightHours(n))}</span>
        <button type="button" onClick={() => remove(n.date)} aria-label={`Delete ${dow(n.date)}`} className="grid h-8 w-8 place-items-center rounded-full" style={{ color: C.dim }}><Trash2 className="h-4 w-4" /></button></li>)}</ul></Card></>}
    <p className="mt-4 px-1 text-[12px]" style={{ color: C.dim }}>Most adults do best with 7 to 9 hours. Sleep debt is how far under your goal you were across the last 7 days.</p>
  </Sheet>;
}
