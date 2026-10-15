// Simple: the whole routine on one screen. Tap Peed or Pooped (the time is taken from the clock),
// and the reminder is set for the next trip. When it rings, snooze it until she goes.
import { useState } from "react";
import { useTick, fmtDuration } from "../kit";
import { clockOf, dayOf, isPeeEvent, isPoopEvent, type Kind } from "@shared/pro/potty";
import { usePotty } from "./ctx";
import { Btn2, C, Chip, Panel } from "./theme";

type Where = "potty" | "diaper" | "accident";
const KIND: Record<Where, { pee: Kind; poop: Kind }> = {
  potty: { pee: "pee", poop: "poop" }, diaper: { pee: "diaper-wet", poop: "diaper-dirty" }, accident: { pee: "acc-pee", poop: "acc-poop" },
};
const WHERE: [Where, string][] = [["potty", "🚽 In the potty"], ["diaper", "🩲 Diaper"], ["accident", "💦 Accident"]];
const EVERY = [30, 45, 60, 90, 120];
const SNOOZE = [5, 10, 15];

export default function Simple() {
  const { data, set, kid, log, startTimer, interval, putKid } = usePotty();
  useTick(true, 1000);
  const [where, setWhere] = useState<Where>("potty");
  const [last, setLast] = useState<{ kind: Kind; at: number; next: number } | null>(null);
  const now = Date.now();
  const timer = data.timer && data.timer.kid === kid.id ? data.timer : null;
  const mine = data.logs.filter((x) => x.kid === kid.id && dayOf(x.at) === dayOf(now));
  const lastPeeAt = mine.filter((x) => isPeeEvent(x.kind)).reduce((m, x) => Math.max(m, x.at), 0), lastPoopAt = mine.filter((x) => isPoopEvent(x.kind)).reduce((m, x) => Math.max(m, x.at), 0);

  const mark = (what: "pee" | "poop") => {
    const kind = KIND[where][what], at = Date.now();
    log(kind, { at });
    startTimer(interval);
    setLast({ kind, at, next: at + interval * 60_000 });
  };
  const undo = () => {
    if (!last) return;
    set((d) => ({ ...d, logs: d.logs.filter((x) => !(x.kid === kid.id && x.kind === last.kind && x.at === last.at)) }));
    setLast(null);
  };
  const left = timer ? (timer.endAt - now) / 1000 : 0;
  const big = "flex min-h-[132px] flex-1 flex-col items-center justify-center gap-1 rounded-[28px] text-center text-2xl font-extrabold transition active:scale-95";

  return <div className="mx-auto max-w-xl space-y-5">
    <Panel tone="night" className="text-center">
      <p className="text-sm text-white/60">{kid.name}'s next trip to the toilet</p>
      {timer ? <>
        <p className="ph mt-2 text-6xl font-extrabold tabular-nums" style={{ color: C.duck }}>{fmtDuration(left)}</p>
        <p className="mt-1 text-lg font-bold">at {clockOf(timer.endAt)}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5"><span className="mr-1 text-[13px] text-white/60">Snooze</span>{SNOOZE.map((m) => <button key={m} type="button" onClick={() => startTimer(m)} className="rounded-full bg-white/15 px-3.5 py-2 text-sm font-bold text-white">{m} min</button>)}
          <button type="button" onClick={() => set((d) => ({ ...d, timer: null }))} className="rounded-full px-3.5 py-2 text-sm font-bold text-white/60">Stop</button></div>
      </> : <p className="mt-3 text-lg font-bold leading-snug">Tap Peed or Pooped below when {kid.name} goes. I'll set the timer.</p>}
    </Panel>

    <div className="flex flex-wrap justify-center gap-1.5">{WHERE.map(([id, l]) => <Chip key={id} on={where === id} onClick={() => setWhere(id)}>{l}</Chip>)}</div>

    <div className="flex gap-3">
      <button type="button" onClick={() => mark("pee")} className={big} style={{ background: C.pee, color: "#fff" }}><span className="text-5xl">💧</span>Peed</button>
      <button type="button" onClick={() => mark("poop")} className={big} style={{ background: C.poop, color: "#fff" }}><span className="text-5xl">💩</span>Pooped</button>
    </div>

    {last && <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3" style={{ background: C.duckSoft }}>
      <p className="text-sm font-bold leading-snug">✓ Saved at {clockOf(last.at)}. Next trip at {clockOf(last.next)}.</p>
      <Btn2 kind="plain" onClick={undo}>Undo</Btn2>
    </div>}

    <p className="text-center text-sm" style={{ color: C.muted }}>
      {lastPeeAt ? `Last pee ${clockOf(lastPeeAt)}` : "No pee yet today"} · {lastPoopAt ? `last poop ${clockOf(lastPoopAt)}` : "no poop yet today"}
    </p>

    <Panel>
      <p className="text-[13px] font-bold" style={{ color: C.muted }}>Remind me every</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Chip on={!kid.interval} onClick={() => putKid({ ...kid, interval: 0 })}>Auto · {kid.interval ? "…" : `${interval} min`}</Chip>
        {EVERY.map((m) => <Chip key={m} on={kid.interval === m} onClick={() => putKid({ ...kid, interval: m })}>{m} min</Chip>)}
      </div>
      <p className="mt-3 text-[13px] leading-snug" style={{ color: C.muted }}>Auto uses {kid.name}'s own usual gap once there are enough pees logged. When the timer rings, tap Snooze and it rings again until you mark a pee or poop. Keep this page open on your phone so it can ring.</p>
    </Panel>
  </div>;
}
