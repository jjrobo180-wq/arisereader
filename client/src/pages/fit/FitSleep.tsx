// Cooked: Sleep. Tracked five ways, so a night is never lost because you forgot to tap a button:
//   1. Apple Health: an Apple Watch, the iPhone's Sleep schedule or any sleep app that saves to Health.
//      Nights come in by themselves, with deep, REM and core sleep when the watch measured them.
//   2. Your bedtime schedule: each morning the app asks "Did you sleep 10:30 to 6:30?" One tap.
//   3. Phone down: when you put the phone down at night and picked it up in the morning (Cooked only
//      sees when it went to the background and came back, on this phone).
//   4. The "Going to sleep" / "I'm awake" button, or Siri ("Hey Siri, going to sleep").
//   5. Typed in, for any night, and naps.
// Each night gets a sleep score (shared/fitSleep.ts). Wind-down and morning reminders follow the schedule.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bed, Check, ChevronRight, Clock, HeartPulse, Moon, Pencil, Plus, Smartphone, Sun, Sunrise, Trash2, Watch, Wind, X } from "lucide-react";
import { dayKey, type FitData } from "@shared/fit";
import { SOURCE_NAME, addNap, addNight, clockOf, emptySleep, healthNight, lastDays, nightHours, phoneNight, rateNight, scheduleNight, scoreWord, sleepScore, sleepStats, type Sleep, type SleepNight, type SleepSource } from "@shared/fitSleep";
import { Btn, C, Card, Field, Ring, Sheet, Title, display, fmtNum, haptic, inputCls, inputStyle } from "./fitUi";
import { applySleepReminders, connectHealth, healthConnected, readSleepHealth } from "./fitNative";
import { isNativeApp } from "@/lib/nativeApp";
import type { Update } from "./fitStore";
import { SleepLab } from "./FitSleepLab";

export const hm = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60) % 60).padStart(2, "0")}m`;
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const dow = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString([], { weekday: "short" });
const longDay = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
const pad = (n: number) => String(n).padStart(2, "0");
const toInput = (t: number) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const STAGE = { deep: { name: "Deep", color: "#4338ca" }, rem: { name: "REM", color: "#8b5cf6" }, core: { name: "Core", color: "#60a5fa" }, awake: { name: "Awake", color: "#f59e0b" } } as const;
const SRC_ICON: Record<SleepSource, typeof Moon> = { health: Watch, schedule: Clock, phone: Smartphone, button: Moon, manual: Pencil, pillow: Bed };

/** A time of day ("23:10") on the night that ends the morning of `wakeDay`: bed the evening before when it's later than the wake time. */
export function nightFrom(wakeDay: string, bedHHMM: string, wakeHHMM: string) {
  const [wh, wm] = wakeHHMM.split(":").map(Number), [bh, bm] = bedHHMM.split(":").map(Number);
  const wake = new Date(`${wakeDay}T12:00:00`); wake.setHours(wh || 0, wm || 0, 0, 0);
  const bed = new Date(wake); bed.setHours(bh || 0, bm || 0, 0, 0);
  if (bed.getTime() >= wake.getTime()) bed.setDate(bed.getDate() - 1);
  return { bed: bed.getTime(), wake: wake.getTime() };
}
const okNight = (bed: number, wake: number) => wake - bed >= 30 * 60_000 && wake - bed <= 20 * 3_600_000 && wake <= Date.now() + 5 * 60_000;

// ——— Phone down, phone up ———————————————————————————————————————————————————————————————————————
const PHONE = "arise-fit-phone", PHONE_ON = "arise-fit-sleep-phone";
type PhoneLog = { down?: number; guess?: { bed: number; wake: number } };
const readPhone = (): PhoneLog => { try { return JSON.parse(localStorage.getItem(PHONE) || "{}"); } catch { return {}; } };
const writePhone = (p: PhoneLog) => { try { localStorage.setItem(PHONE, JSON.stringify(p)); } catch { /* not kept */ } };
export const phoneGuessOn = () => { try { return localStorage.getItem(PHONE_ON) !== "0"; } catch { return true; } };
const setPhoneGuessOn = (on: boolean) => { try { localStorage.setItem(PHONE_ON, on ? "1" : "0"); } catch { /* not kept */ } };
/** Notes when Cooked goes to the background and comes back; a long overnight gap becomes a guess. */
function notePhone(state: "down" | "up") {
  const p = readPhone(), now = Date.now();
  if (state === "down") { writePhone({ ...p, down: now }); return; }
  if (!p.down) return;
  const g = phoneNight(p.down, now);
  writePhone({ guess: g ?? p.guess });
}

/** Last night, worked out without asking: a candidate for the morning check-in (or saved straight
 *  away when Apple Health has it). Checked when the app opens and whenever it comes back. */
export type SleepGuess = { bed: number; wake: number; src: "schedule" | "phone" };
export function useSleepAuto(data: FitData, update: Update, loaded: boolean, say: (m: string) => void): { guess: SleepGuess | null; skip: () => void } {
  const [guess, setGuess] = useState<SleepGuess | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    notePhone("up");
    const vis = () => { if (document.visibilityState === "hidden") notePhone("down"); else { notePhone("up"); setTick((t) => t + 1); } };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pagehide", () => notePhone("down"));
    return () => document.removeEventListener("visibilitychange", vis);
  }, []);
  const today = dayKey();
  const has = !!data.sleep?.nights.some((n) => n.date === today);
  const skipped = !!data.sleep?.skipped?.includes(today);
  useEffect(() => {
    if (!loaded) return;
    const h = new Date().getHours();
    if (has || skipped || data.sleep?.asleepAt || h < 4 || h >= 15) { setGuess(null); return; }
    let live = true;
    (async () => {
      // 1. Apple Health: saved without asking.
      if (healthConnected() && isNativeApp()) {
        try {
          const n = healthNight(await readSleepHealth(2));
          if (n && live && dayKey(new Date(n.wake)) === today) {
            update((d) => ({ ...d, sleep: addNight(d.sleep, n.bed, n.wake, undefined, { src: "health", ...(n.stages.deep + n.stages.rem > 0 ? { stages: n.stages } : {}), asleepMin: n.asleepMin }) }));
            say(`Last night's sleep came in from Apple Health: ${hm(n.asleepMin / 60)}.`);
            setGuess(null); return;
          }
        } catch { /* fall back to a guess */ }
      }
      if (!live) return;
      // 2. Phone down and up. 3. The schedule.
      const p = readPhone().guess;
      if (phoneGuessOn() && p && dayKey(new Date(p.wake)) === today) { setGuess({ ...p, src: "phone" }); return; }
      const sc = data.sleep?.schedule;
      if (sc) { const n = scheduleNight(sc); if (n.wake <= Date.now() + 60 * 60_000) { setGuess({ ...n, src: "schedule" }); return; } }
      setGuess(null);
    })();
    return () => { live = false; };
  }, [loaded, has, skipped, tick, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const skip = useCallback(() => { setGuess(null); update((d) => ({ ...d, sleep: { ...(d.sleep ?? emptySleep()), skipped: [...(d.sleep?.skipped ?? []), today].slice(-14) } })); }, [update, today]);
  return { guess, skip };
}

/** Today's morning check-in: last night as the app worked it out, to confirm, adjust or dismiss. */
export function SleepCheckIn({ guess, data, update, say, onSkip }: { guess: SleepGuess; data: FitData; update: Update; say: (m: string) => void; onSkip: () => void }) {
  const [edit, setEdit] = useState(false);
  const [bed, setBed] = useState(toInput(guess.bed)), [wake, setWake] = useState(toInput(guess.wake));
  const [q, setQ] = useState(0);
  const t = edit ? nightFrom(dayKey(), bed, wake) : guess;
  const save = () => {
    if (!okNight(t.bed, t.wake)) { say("Those times don't look right. Sleep is between 30 minutes and 20 hours."); return; }
    haptic("success");
    update((d) => ({ ...d, sleep: addNight(d.sleep, t.bed, t.wake, q || undefined, { src: edit ? "manual" : guess.src }) }));
    say(`Saved ${hm((t.wake - t.bed) / 3_600_000)} of sleep.`);
  };
  return <Card className="mt-3 !p-4" testId="fit-sleep-checkin" style={{ background: `linear-gradient(150deg, rgba(99,102,241,.16), ${C.card} 70%)` }}>
    <div className="flex items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]" style={{ background: "linear-gradient(145deg,#818cf8,#3730a3)", color: "#fff" }}><Sunrise className="h-6 w-6" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] tracking-[.14em]" style={{ ...display, color: C.dim }}>Good morning · how did you sleep?</p>
        <p className="mt-0.5 text-[24px] leading-none tabular-nums" style={display}>{hm((t.wake - t.bed) / 3_600_000)}</p>
        <p className="mt-1 text-[13px]" style={{ color: C.steel }}>{clock(t.bed)} to {clock(t.wake)} · {guess.src === "phone" ? "from when you put your phone down" : "from your bedtime schedule"}</p>
      </div>
      <button type="button" onClick={onSkip} aria-label="Not right, don't save" className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: C.card2, color: C.dim }}><X className="h-4 w-4" /></button>
    </div>
    {edit && <div className="mt-3 grid grid-cols-2 gap-2">
      <Field label="Went to sleep"><input type="time" value={bed} onChange={(e) => setBed(e.target.value)} className={inputCls} style={inputStyle} data-testid="fit-checkin-bed" /></Field>
      <Field label="Woke up"><input type="time" value={wake} onChange={(e) => setWake(e.target.value)} className={inputCls} style={inputStyle} /></Field></div>}
    <Rested q={q} setQ={setQ} className="mt-3" />
    <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
      <Btn onClick={save} testId="fit-checkin-save"><Check className="h-5 w-5" />{edit ? "Save" : "That's right"}</Btn>
      {!edit && <Btn kind="soft" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" />Adjust</Btn>}
    </div>
  </Card>;
}

const FACES = ["Awful", "Poor", "OK", "Good", "Great"];
function Rested({ q, setQ, className = "" }: { q: number; setQ: (n: number) => void; className?: string }) {
  return <div className={className}><p className="text-[12px] font-semibold" style={{ color: C.dim }}>How rested do you feel?</p>
    <div className="mt-1.5 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="How rested">{FACES.map((f, i) => <button key={f} type="button" role="radio" aria-checked={q === i + 1} onClick={() => { haptic("light"); setQ(q === i + 1 ? 0 : i + 1); }}
      className="h-10 rounded-[10px] text-[12px] font-semibold transition-colors" style={q === i + 1 ? { background: C.lime, color: C.ink } : { background: C.card2, color: C.text }}>{f}</button>)}</div></div>;
}

/** The stacked stage bar for one night. */
function StageBar({ n }: { n: SleepNight }) {
  if (!n.stages) return null;
  const s = n.stages, total = s.deep + s.rem + s.core + s.awake || 1;
  return <div className="mt-3">
    <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label={`Deep ${s.deep} minutes, REM ${s.rem}, core ${s.core}, awake ${s.awake}`}>
      {(["deep", "core", "rem", "awake"] as const).map((k) => <span key={k} style={{ width: `${(s[k] / total) * 100}%`, background: STAGE[k].color }} />)}</div>
    <div className="mt-2 grid grid-cols-4 gap-1 text-center">{(["deep", "core", "rem", "awake"] as const).map((k) => <div key={k}>
      <p className="text-[15px] font-bold tabular-nums">{hm(s[k] / 60).replace(/^0h /, "")}</p>
      <p className="flex items-center justify-center gap-1 text-[11px]" style={{ color: C.dim }}><span className="h-2 w-2 rounded-full" style={{ background: STAGE[k].color }} />{STAGE[k].name}</p></div>)}</div>
  </div>;
}

export function SleepChart({ data, height = 110, days = 7 }: { data: FitData; height?: number; days?: number }) {
  const list = lastDays(data.sleep, days), goal = data.sleep?.goalH ?? 8;
  const top = Math.max(goal + 1.5, ...list.map((d) => d.h ?? 0));
  return <div className="relative" style={{ height }}>
    <div aria-hidden className="absolute inset-x-0 border-t border-dashed" style={{ bottom: `calc(18px + ${(goal / top) * (height - 18)}px)`, borderColor: C.dim, opacity: 0.5 }} />
    <div className="flex h-full items-end" style={{ gap: days > 7 ? 2 : 8 }} role="img" aria-label={`Hours slept, last ${days} days`}>
      {list.map((d) => <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
        <div className="fit-bar w-full rounded-t-[5px]" style={{ height: d.h ? Math.max(5, (d.h / top) * (height - 18)) : 3, background: d.h == null ? C.track : d.h >= goal - 0.25 ? "linear-gradient(180deg,#818cf8,#4f46e5)" : "linear-gradient(180deg,#a5b4fc,#818cf8)", opacity: d.h == null ? 0.6 : d.h >= goal - 0.25 ? 1 : 0.55, transformOrigin: "bottom" }} />
        <span className="text-[10px]" style={{ color: C.dim, height: 12 }}>{days > 7 ? (new Date(`${d.date}T12:00:00`).getDate() % 5 === 1 ? new Date(`${d.date}T12:00:00`).getDate() : "") : dow(d.date).slice(0, 1)}</span></div>)}
    </div>
  </div>;
}

/** Fills in nights from Apple Health for the last two weeks (it wins over guesses; never over a night you typed). */
async function syncHealthSleep(update: Update): Promise<number> {
  const samples = await readSleepHealth(15);
  if (!samples.length) return 0;
  let added = 0;
  const found: { bed: number; wake: number; stages: any; asleepMin: number }[] = [];
  for (let i = 0; i < 15; i++) { const d = new Date(); d.setDate(d.getDate() - i); const n = healthNight(samples, d); if (n && dayKey(new Date(n.wake)) === dayKey(d)) found.push(n); }
  update((d) => {
    let s = d.sleep;
    for (const n of found) {
      const old = s?.nights.find((x) => x.date === dayKey(new Date(n.wake)));
      if (old && (old.src === "manual" || (old.src === "health" && old.stages))) continue;
      s = addNight(s, n.bed, n.wake, old?.q, { src: "health", ...(n.stages.deep + n.stages.rem > 0 ? { stages: n.stages } : {}), asleepMin: n.asleepMin });
      added++;
    }
    return s ? { ...d, sleep: s } : d;
  });
  return added || found.length;
}

/** The Sleep app (a tab or a sheet). */
export function SleepSheet({ data, update, onClose, say, inline, onBreathe }: { data: FitData; update: Update; onClose: () => void; say: (m: string) => void; inline?: boolean; onBreathe?: () => void }) {
  const sleep = data.sleep ?? emptySleep();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!sleep.asleepAt) return; const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, [sleep.asleepAt]);
  const [range, setRange] = useState<7 | 30>(7);
  const [sheet, setSheet] = useState<"" | "log" | "nap" | "schedule" | "ways">("");
  const [editing, setEditing] = useState<SleepNight | null>(null);
  const [syncing, setSyncing] = useState(false);
  const st = sleepStats(data.sleep, range);
  const last = sleep.nights[sleep.nights.length - 1];
  const lastIsToday = last?.date === dayKey();
  const score = last ? sleepScore(last, data.sleep) : null;
  const native = isNativeApp();

  // Opening Sleep fills in any nights Apple Health has.
  useEffect(() => {
    if (!healthConnected() || !native) return;
    setSyncing(true);
    syncHealthSleep(update).catch(() => {}).finally(() => setSyncing(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => { haptic("light"); update((d) => ({ ...d, sleep: { ...(d.sleep ?? emptySleep()), asleepAt: Date.now() } })); say("Sleep timer started. Sleep well."); };
  const cancel = () => update((d) => ({ ...d, sleep: { ...(d.sleep ?? emptySleep()), asleepAt: undefined } }));
  const awake = () => {
    const at = sleep.asleepAt; if (!at) return;
    const end = Date.now();
    if (end - at < 30 * 60_000) { say("That was under 30 minutes, so it wasn't saved as a night."); cancel(); return; }
    haptic("success");
    update((d) => ({ ...d, sleep: addNight(d.sleep, at, end, undefined, { src: "button" }) }));
    say(`Good morning. You slept ${hm((end - at) / 3_600_000)}.`);
  };
  const setGoal = (h: number) => update((d) => ({ ...d, sleep: { ...(d.sleep ?? emptySleep()), goalH: Math.min(12, Math.max(4, h)) } }));

  return <Sheet title="Sleep" onClose={onClose} testId="fit-sleep" inline={inline}
    right={<button type="button" onClick={() => setSheet("ways")} className="flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold" style={{ background: C.card, color: C.text }} data-testid="fit-sleep-ways-open"><Watch className="h-4 w-4" style={{ color: "#818cf8" }} />Tracking</button>}>
    {/* Tonight or last night. */}
    {sleep.asleepAt
      ? <Card className="!p-6 text-center" style={{ background: "linear-gradient(170deg,#1e1b4b,#312e81)", color: "#eef" }} testId="fit-sleep-now">
          <Moon className="mx-auto h-8 w-8" style={{ color: "#c7d2fe" }} />
          <p className="mt-3 text-[52px] leading-none tabular-nums" style={display}>{hm(Math.max(0, now - sleep.asleepAt) / 3_600_000)}</p>
          <p className="mt-1 text-[13px]" style={{ color: "#c7d2fe" }}>Asleep since {clock(sleep.asleepAt)}</p>
          <button type="button" onClick={awake} className="mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[12px] text-[18px]" style={{ ...display, background: "#fde68a", color: "#1e1b4b" }} data-testid="fit-sleep-awake"><Sun className="h-5 w-5" />I'm awake</button>
          <button type="button" onClick={cancel} className="mt-3 text-[13px] underline" style={{ color: "#c7d2fe" }}>Cancel</button></Card>
      : <Card className="!p-5" testId="fit-sleep-last">
          <div className="flex items-center gap-4">
            {score ? <Ring value={score.score} goal={100} size={112} stroke={11} color="#818cf8"><div><p className="text-[36px] leading-none tabular-nums" style={display}>{score.score}</p><p className="mt-0.5 text-[10px] uppercase tracking-[.08em]" style={{ color: C.dim }}>score</p></div></Ring>
              : <span className="grid h-[112px] w-[112px] shrink-0 place-items-center rounded-full" style={{ background: C.card2 }}><Moon className="h-10 w-10" style={{ color: "#818cf8" }} /></span>}
            <div className="min-w-0 flex-1">
              <p className="text-[12px] tracking-[.14em]" style={{ ...display, color: C.dim }}>{last ? (lastIsToday ? "Last night" : longDay(last.date)) : "No sleep yet"}</p>
              <p className="mt-0.5 text-[36px] leading-none tabular-nums" style={display}>{last ? hm(nightHours(last)) : "—"}</p>
              {last && <p className="mt-1 text-[13px]" style={{ color: C.steel }}>{clock(last.bed)} to {clock(last.wake)}</p>}
              {score && <p className="mt-1 text-[13px] font-semibold" style={{ color: "#818cf8" }}>{scoreWord(score.score)}{last?.src ? ` · ${SOURCE_NAME[last.src]}` : ""}</p>}
            </div>
          </div>
          {last && <StageBar n={last} />}
          {score && <div className="mt-3 space-y-1.5">{score.parts.map((p) => <div key={p.label} className="flex items-center gap-2 text-[12px]">
            <span className="w-[104px] shrink-0 font-semibold">{p.label}</span>
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: C.track }}><span className="block h-full rounded-full" style={{ width: `${(p.got / p.of) * 100}%`, background: "#818cf8" }} /></span>
            <span className="w-10 text-right tabular-nums" style={{ color: C.dim }}>{p.got}/{p.of}</span></div>)}</div>}
          {last && !last.q && <Rested q={0} setQ={(q) => update((d) => ({ ...d, sleep: rateNight(d.sleep, last.date, q) }))} className="mt-3" />}
          <Btn className="mt-4 w-full" onClick={start} testId="fit-sleep-start"><Moon className="h-5 w-5" />Going to sleep</Btn>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Btn kind="soft" onClick={() => setSheet("log")} testId="fit-sleep-log-open"><Plus className="h-4 w-4" />Night</Btn>
            <Btn kind="soft" onClick={() => setSheet("nap")}><Plus className="h-4 w-4" />Nap</Btn>
          </div>
          {syncing && <p className="mt-2 text-center text-[12px]" style={{ color: C.dim }}>Checking Apple Health…</p>}
        </Card>}

    <SleepLab data={data} update={update} say={say} />

    {/* How it's tracked, at a glance. */}
    <Ways data={data} update={update} say={say} compact onOpen={() => setSheet("ways")} onSchedule={() => setSheet("schedule")} />

    <Title right={<div className="flex gap-1 rounded-full p-0.5" style={{ background: C.card2 }}>{([7, 30] as const).map((r) => <button key={r} type="button" onClick={() => setRange(r)} aria-pressed={range === r} className="h-7 rounded-full px-3 text-[12px] font-semibold" style={range === r ? { background: C.card, color: C.text } : { color: C.dim }}>{r} days</button>)}</div>}>Trends</Title>
    <Card className="!p-4"><SleepChart data={data} days={range} />
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat v={st.n ? hm(st.avg) : "—"} l="average" />
        <Stat v={`${st.hit}/${st.n || 0}`} l="nights at goal" />
        <Stat v={st.n ? hm(st.debt) : "—"} l="sleep debt" />
        <Stat v={st.avgBed != null ? clockOf(st.avgBed) : "—"} l="usual bedtime" />
        <Stat v={st.avgWake != null ? clockOf(st.avgWake) : "—"} l="usual wake" />
        <Stat v={st.n > 1 ? (st.bedSpread <= 30 ? "Steady" : st.bedSpread <= 60 ? "Fair" : "All over") : "—"} l={st.n > 1 ? `bedtime ±${st.bedSpread} min` : "consistency"} />
      </div></Card>
    <Tip data={data} onBreathe={onBreathe} />

    <Title>Sleep goal</Title>
    <Card className="!p-4"><div className="flex items-center justify-between">
      <Btn kind="soft" className="!min-h-10 !px-4" onClick={() => setGoal(sleep.goalH - 0.5)} disabled={sleep.goalH <= 4}>−</Btn>
      <p className="text-[28px] tabular-nums" style={display}>{fmtNum(sleep.goalH)} hours</p>
      <Btn kind="soft" className="!min-h-10 !px-4" onClick={() => setGoal(sleep.goalH + 0.5)} disabled={sleep.goalH >= 12}>+</Btn></div></Card>

    {(sleep.nights.length > 0 || (sleep.naps?.length ?? 0) > 0) && <><Title>History</Title>
      <Card className="!p-2"><ul>{[...sleep.nights].reverse().slice(0, 30).map((n, i) => { const Icon = SRC_ICON[n.src ?? "manual"]; const sc = sleepScore(n, data.sleep).score; return <li key={n.date} style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
        <button type="button" onClick={() => setEditing(n)} className="flex w-full items-center gap-3 px-2 py-2.5 text-left text-[14px]" data-testid={`fit-sleep-night-${n.date}`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-bold tabular-nums" style={{ background: C.card2, color: sc >= 70 ? "#818cf8" : C.text }}>{sc}</span>
          <span className="min-w-0 flex-1"><span className="block font-semibold">{dow(n.date)} · {hm(nightHours(n))}</span>
            <span className="flex items-center gap-1 text-[12px]" style={{ color: C.dim }}><Icon className="h-3 w-3" />{clock(n.bed)} to {clock(n.wake)}{n.q ? ` · ${FACES[n.q - 1]}` : ""}</span></span>
          <ChevronRight className="h-4 w-4 shrink-0" style={{ color: C.dim }} /></button></li>; })}</ul>
        {(sleep.naps?.length ?? 0) > 0 && <p className="px-2 pb-2 pt-1 text-[12px]" style={{ color: C.dim }}>Naps: {sleep.naps!.slice(-5).reverse().map((x) => `${dow(dayKey(new Date(x.start)))} ${Math.round((x.end - x.start) / 60_000)} min`).join(" · ")}</p>}
      </Card></>}
    <p className="mt-4 px-1 text-[12px]" style={{ color: C.dim }}>Most adults do best with 7 to 9 hours. The sleep score weighs hours against your goal, deep and REM sleep (or how rested you felt) and a steady bedtime. Not a medical measure.</p>

    {sheet === "log" && <NightEditor data={data} update={update} say={say} onClose={() => setSheet("")} />}
    {editing && <NightEditor night={editing} data={data} update={update} say={say} onClose={() => setEditing(null)} />}
    {sheet === "nap" && <NapEditor update={update} say={say} onClose={() => setSheet("")} />}
    {sheet === "schedule" && <ScheduleSheet data={data} update={update} say={say} onClose={() => setSheet("")} />}
    {sheet === "ways" && <Sheet title="How sleep is tracked" onClose={() => setSheet("")} testId="fit-sleep-ways"><Ways data={data} update={update} say={say} onSchedule={() => setSheet("schedule")} /></Sheet>}
  </Sheet>;
}

const Stat = ({ v, l }: { v: string; l: string }) => <div className="rounded-[10px] px-1 py-2" style={{ background: C.card2 }}><p className="text-[18px] leading-none tabular-nums" style={display}>{v}</p><p className="mt-1 text-[11px] leading-tight" style={{ color: C.dim }}>{l}</p></div>;

/** One tip from the last week. */
function Tip({ data, onBreathe }: { data: FitData; onBreathe?: () => void }) {
  const st = sleepStats(data.sleep, 7);
  if (st.n < 2) return null;
  const text = st.debt > 4 ? `You're ${hm(st.debt)} under your goal this week. Try going to bed 30 minutes earlier for the next few nights.`
    : st.bedSpread > 60 ? "Your bedtime moves around by over an hour. A steady bedtime, even on weekends, is one of the best ways to sleep better."
    : st.avg >= st.goal - 0.25 ? "You're hitting your goal. Keep the same bedtime and wake time and you'll recover faster from training."
    : "A short wind-down helps: dim lights, no screens and a few minutes of slow breathing before bed.";
  return <Card className="mt-2 flex items-start gap-3 !p-3.5"><Bed className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "#818cf8" }} />
    <div className="min-w-0 flex-1"><p className="text-[14px] leading-snug">{text}</p>
      {onBreathe && <button type="button" onClick={onBreathe} className="mt-2 flex items-center gap-1 text-[13px] font-semibold" style={{ color: C.lime }}><Wind className="h-4 w-4" />Sleep wind-down breathing</button>}</div></Card>;
}

/** The five ways, with what each needs (and switches where there's a choice). */
function Ways({ data, update, say, compact, onOpen, onSchedule }: { data: FitData; update: Update; say: (m: string) => void; compact?: boolean; onOpen?: () => void; onSchedule: () => void }) {
  const [health, setHealth] = useState(healthConnected());
  const [phone, setPhone] = useState(phoneGuessOn());
  const [busy, setBusy] = useState(false);
  const native = isNativeApp();
  const sc = data.sleep?.schedule;
  const connect = async () => {
    setBusy(true);
    try { await connectHealth(); setHealth(true); const n = await syncHealthSleep(update); say(n ? `Got ${n} night${n === 1 ? "" : "s"} from Apple Health.` : "Connected. Nights will come in from Apple Health."); }
    catch (e: any) { say(e.message); } finally { setBusy(false); }
  };
  const syncNow = async () => { setBusy(true); try { const n = await syncHealthSleep(update); say(n ? `Updated ${n} night${n === 1 ? "" : "s"} from Apple Health.` : "No new sleep in Apple Health."); } catch (e: any) { say(e.message); } finally { setBusy(false); } };
  if (compact) {
    const on = [health && native ? "Apple Health" : "", sc ? "schedule" : "", phone ? "phone down" : ""].filter(Boolean);
    return <Card onClick={onOpen} className="mt-3 flex items-center gap-3 !p-3.5" testId="fit-sleep-ways-card">
      <span className="flex -space-x-1.5">{[Watch, Clock, Smartphone].map((I, i) => <span key={i} className="grid h-8 w-8 place-items-center rounded-full" style={{ background: C.card2, boxShadow: `0 0 0 2px ${C.card}` }}><I className="h-4 w-4" style={{ color: "#818cf8" }} /></span>)}</span>
      <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">Tracked automatically</span><span className="block truncate text-[12px]" style={{ color: C.dim }}>{on.length ? `On: ${on.join(", ")}` : "Set up Apple Health or a bedtime schedule"}</span></span>
      <ChevronRight className="h-5 w-5 shrink-0" style={{ color: C.dim }} /></Card>;
  }
  const Row = ({ icon: Icon, title, sub, right, testId }: { icon: typeof Moon; title: string; sub: string; right?: React.ReactNode; testId?: string }) => <Card className="!p-4" testId={testId}><div className="flex items-start gap-3">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px]" style={{ background: "rgba(129,140,248,.16)" }}><Icon className="h-5 w-5" style={{ color: "#818cf8" }} /></span>
    <div className="min-w-0 flex-1"><p className="text-[16px] font-semibold leading-tight">{title}</p><p className="mt-0.5 text-[13px] leading-snug" style={{ color: C.dim }}>{sub}</p></div>{right}</div></Card>;
  const toggle = (on: boolean, flip: () => void, label: string) => <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={flip} className="relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors" style={{ background: on ? C.lime : C.card2 }}><span className="absolute top-[3px] h-6 w-6 rounded-full bg-white shadow transition-all" style={{ left: on ? 23 : 3 }} /></button>;
  return <div className="mt-1 space-y-2">
    <p className="px-1 text-[14px]" style={{ color: C.steel }}>Cooked uses whichever of these it has, best first, so you never have to remember to tap.</p>
    <Row icon={HeartPulse} title="1. Apple Health" testId="fit-sleep-way-health" sub={native ? (health ? "Connected. Nights from your Apple Watch, the iPhone's Sleep schedule or any sleep app come in by themselves, with deep and REM sleep." : "Wear an Apple Watch to bed or use the iPhone's Sleep schedule, and nights come in by themselves.") : "In the Cooked iPhone app."}
      right={native ? (health ? <Btn kind="soft" className="!min-h-9 !px-3 !text-[13px]" onClick={() => void syncNow()} disabled={busy}>{busy ? "…" : "Sync"}</Btn> : <Btn className="!min-h-9 !px-3 !text-[13px]" onClick={() => void connect()} disabled={busy}>Connect</Btn>) : undefined} />
    <Row icon={Clock} title="2. Bedtime schedule" testId="fit-sleep-way-schedule" sub={sc ? `${clockOf(Number(sc.bed.slice(0, 2)) * 60 + Number(sc.bed.slice(3)))} to ${clockOf(Number(sc.wake.slice(0, 2)) * 60 + Number(sc.wake.slice(3)))}. Each morning Cooked asks if you slept to it: one tap to save.` : "Set your usual bedtime and wake time. Each morning, confirm last night in one tap."}
      right={<Btn kind={sc ? "soft" : "primary"} className="!min-h-9 !px-3 !text-[13px]" onClick={onSchedule}>{sc ? "Edit" : "Set"}</Btn>} />
    <Row icon={Smartphone} title="3. Phone down" testId="fit-sleep-way-phone" sub="A guess from when you last closed Cooked at night and opened it in the morning. Confirm it in the morning. Stays on this phone."
      right={toggle(phone, () => { setPhoneGuessOn(!phone); setPhone(!phone); }, "Phone down guess")} />
    <Row icon={Moon} title="4. Sleep button or Siri" sub={'Tap "Going to sleep" at night and "I\'m awake" in the morning, or say "Hey Siri, going to sleep" (Settings → Siri & Shortcuts).'} />
    <Row icon={Pencil} title="5. By hand" sub="Add or fix any night, and log naps." />
  </div>;
}

function NightEditor({ night, data, update, say, onClose }: { night?: SleepNight; data: FitData; update: Update; say: (m: string) => void; onClose: () => void }) {
  const [day, setDay] = useState(night?.date ?? dayKey());
  const [bed, setBed] = useState(night ? toInput(night.bed) : data.sleep?.schedule?.bed ?? "22:30");
  const [wake, setWake] = useState(night ? toInput(night.wake) : data.sleep?.schedule?.wake ?? "06:30");
  const [q, setQ] = useState(night?.q ?? 0);
  const t = nightFrom(day, bed, wake);
  const save = () => {
    if (!okNight(t.bed, t.wake)) { say("Those times don't look right. Sleep is between 30 minutes and 20 hours, and not in the future."); return; }
    haptic("success");
    update((d) => {
      let s = night && night.date !== day ? { ...(d.sleep ?? emptySleep()), nights: (d.sleep?.nights ?? []).filter((n) => n.date !== night.date) } : d.sleep;
      // Changing a Health night's times makes it yours (its stages no longer fit).
      const keep = night && toInput(night.bed) === bed && toInput(night.wake) === wake && night.date === day;
      s = addNight(s, t.bed, t.wake, q || undefined, keep ? { src: night!.src, stages: night!.stages, asleepMin: night!.asleepMin } : { src: "manual" });
      return { ...d, sleep: s };
    });
    say(`Saved ${hm((t.wake - t.bed) / 3_600_000)} of sleep.`); onClose();
  };
  const remove = () => { if (!night) return; update((d) => ({ ...d, sleep: { ...(d.sleep ?? emptySleep()), nights: (d.sleep?.nights ?? []).filter((n) => n.date !== night.date) } })); onClose(); };
  return <Sheet title={night ? "Edit night" : "Log a night"} onClose={onClose} testId="fit-sleep-editor">
    <Card className="!p-4">
      <Field label="Morning you woke up"><input type="date" value={day} max={dayKey()} onChange={(e) => e.target.value && setDay(e.target.value)} className={inputCls} style={inputStyle} /></Field>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Went to sleep"><input type="time" value={bed} onChange={(e) => setBed(e.target.value)} className={inputCls} style={inputStyle} data-testid="fit-sleep-bed" /></Field>
        <Field label="Woke up"><input type="time" value={wake} onChange={(e) => setWake(e.target.value)} className={inputCls} style={inputStyle} /></Field></div>
      <p className="mt-3 text-[14px] font-semibold tabular-nums">{okNight(t.bed, t.wake) ? `${hm((t.wake - t.bed) / 3_600_000)} · ${clock(t.bed)} to ${clock(t.wake)}` : "Check the times"}</p>
      <Rested q={q} setQ={setQ} className="mt-3" />
      <Btn className="mt-4 w-full" onClick={save} testId="fit-sleep-log"><Check className="h-5 w-5" />Save night</Btn>
    </Card>
    {night?.stages && <p className="mt-2 px-1 text-[12px]" style={{ color: C.dim }}>From Apple Health. Changing the times keeps your times but drops the stages.</p>}
    {night && <button type="button" onClick={remove} className="mt-4 flex h-12 w-full items-center justify-center gap-2 text-[15px] font-semibold" style={{ color: C.red }}><Trash2 className="h-4 w-4" />Delete this night</button>}
  </Sheet>;
}

function NapEditor({ update, say, onClose }: { update: Update; say: (m: string) => void; onClose: () => void }) {
  const [startAt, setStart] = useState(() => toInput(Date.now() - 30 * 60_000));
  const [mins, setMins] = useState(25);
  const save = () => {
    const [h, m] = startAt.split(":").map(Number); const s = new Date(); s.setHours(h, m, 0, 0);
    if (s.getTime() > Date.now()) s.setDate(s.getDate() - 1);
    update((d) => ({ ...d, sleep: addNap(d.sleep, s.getTime(), s.getTime() + mins * 60_000) }));
    haptic("success"); say(`Saved a ${mins}-minute nap.`); onClose();
  };
  return <Sheet title="Log a nap" onClose={onClose} testId="fit-sleep-nap">
    <Card className="!p-4"><Field label="Fell asleep"><input type="time" value={startAt} onChange={(e) => setStart(e.target.value)} className={inputCls} style={inputStyle} /></Field>
      <p className="mt-3 text-[13px] font-semibold" style={{ color: C.dim }}>How long</p>
      <div className="mt-1.5 grid grid-cols-5 gap-1.5">{[10, 20, 30, 60, 90].map((m) => <button key={m} type="button" onClick={() => setMins(m)} aria-pressed={mins === m} className="h-10 rounded-[10px] text-[14px] font-semibold" style={mins === m ? { background: C.lime, color: C.ink } : { background: C.card2 }}>{m}m</button>)}</div>
      <p className="mt-3 text-[12px]" style={{ color: C.dim }}>20 minutes refreshes without grogginess; 90 is a full sleep cycle.</p>
      <Btn className="mt-4 w-full" onClick={save}><Check className="h-5 w-5" />Save nap</Btn></Card>
  </Sheet>;
}

function ScheduleSheet({ data, update, say, onClose }: { data: FitData; update: Update; say: (m: string) => void; onClose: () => void }) {
  const sc = data.sleep?.schedule;
  const [bed, setBed] = useState(sc?.bed ?? "22:30"), [wake, setWake] = useState(sc?.wake ?? "06:30");
  const [windDown, setWind] = useState(data.sleep?.remind?.windDown ?? true), [morning, setMorning] = useState(data.sleep?.remind?.morning ?? true);
  const hours = useMemo(() => { const t = nightFrom(dayKey(), bed, wake); return (t.wake - t.bed) / 3_600_000; }, [bed, wake]);
  const goal = data.sleep?.goalH ?? 8;
  const save = async () => {
    update((d) => ({ ...d, sleep: { ...(d.sleep ?? emptySleep()), schedule: { bed, wake }, remind: { windDown, morning } } }));
    try { await applySleepReminders({ bed, wake }, { windDown, morning }); say("Schedule saved."); } catch (e: any) { say(e.message); }
    onClose();
  };
  const clear = async () => { update((d) => ({ ...d, sleep: { ...(d.sleep ?? emptySleep()), schedule: undefined, remind: undefined } })); try { await applySleepReminders(undefined, { windDown: false, morning: false }); } catch { /* none */ } onClose(); };
  const toggleRow = (label: string, sub: string, on: boolean, flip: () => void) => <button type="button" role="switch" aria-checked={on} onClick={flip} className="flex w-full items-center gap-3 rounded-[12px] p-3.5 text-left" style={{ background: C.card2 }}>
    <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">{label}</span><span className="block text-[12px]" style={{ color: C.dim }}>{sub}</span></span>
    <span className="relative h-[30px] w-[50px] shrink-0 rounded-full" style={{ background: on ? C.lime : C.card }}><span className="absolute top-[3px] h-6 w-6 rounded-full bg-white shadow transition-all" style={{ left: on ? 23 : 3 }} /></span></button>;
  return <Sheet title="Bedtime schedule" onClose={onClose} testId="fit-sleep-schedule">
    <Card className="!p-4"><div className="grid grid-cols-2 gap-3">
      <Field label="Bedtime"><input type="time" value={bed} onChange={(e) => setBed(e.target.value)} className={inputCls} style={inputStyle} data-testid="fit-schedule-bed" /></Field>
      <Field label="Wake up"><input type="time" value={wake} onChange={(e) => setWake(e.target.value)} className={inputCls} style={inputStyle} /></Field></div>
      <p className="mt-3 text-[14px] font-semibold">{hm(hours)} in bed {hours < goal - 0.25 ? <span style={{ color: C.orange }}>· under your {fmtNum(goal)}-hour goal</span> : <span style={{ color: C.green }}>· meets your goal</span>}</p></Card>
    <Title>Reminders</Title>
    <div className="space-y-2">
      {toggleRow("Wind down", "30 minutes before bedtime", windDown, () => setWind(!windDown))}
      {toggleRow("Morning check-in", "15 minutes after you wake, to save last night", morning, () => setMorning(!morning))}
    </div>
    {!isNativeApp() && <p className="mt-2 px-1 text-[12px]" style={{ color: C.dim }}>Reminders come from the Cooked iPhone app.</p>}
    <Btn className="mt-4 w-full" onClick={() => void save()} testId="fit-schedule-save"><Check className="h-5 w-5" />Save schedule</Btn>
    {sc && <button type="button" onClick={() => void clear()} className="mt-3 h-11 w-full text-[14px] font-semibold" style={{ color: C.red }}>Turn off the schedule</button>}
  </Sheet>;
}

/** Today's Sleep tile line: last night's hours and score, or how to start. */
export function sleepLine(data: FitData): { big: string; small: string; score?: number } {
  const s: Sleep | undefined = data.sleep;
  if (s?.asleepAt) return { big: "Sleeping", small: "Tap when you wake" };
  const n = s?.nights.find((x) => x.date === dayKey());
  if (!n) return { big: "—", small: "last night" };
  const score = sleepScore(n, s).score;
  return { big: hm(nightHours(n)), small: `score ${score}`, score };
}
