// Simple: the whole routine on one screen. Tap Peed or Pooped (the time is taken from the clock),
// or add what she ate or drank, and the reminder is set for the next sit, with an estimate of
// when to expect the pee or poop. When it rings, snooze it until she goes.
import { useState } from "react";
import { useTick, fmtDuration } from "../kit";
import { DRINK_TYPES, clockOf, dayOf, isPeeEvent, isPoopEvent, mlToOz, nextRing, ozToMl, planSits, sitText, type DrinkType, type Entry, type Kind } from "@shared/pro/potty";
import { usePotty } from "./ctx";
import { Btn2, C, Chip, Panel } from "./theme";

type Where = "potty" | "diaper" | "accident";
const KIND: Record<Where, { pee: Kind; poop: Kind }> = {
  potty: { pee: "pee", poop: "poop" }, diaper: { pee: "diaper-wet", poop: "diaper-dirty" }, accident: { pee: "acc-pee", poop: "acc-poop" },
};
const WHERE: [Where, string][] = [["potty", "🚽 In the potty"], ["diaper", "🩲 Diaper"], ["accident", "💦 Accident"]];
const EVERY = [30, 45, 60, 90, 120];
const SNOOZE = [5, 10, 15];
type Pick = DrinkType | "meal" | "snack";
const PICKS: { id: Pick; label: string; emoji: string }[] = [
  ...DRINK_TYPES.filter((d) => ["bottle", "juice", "water", "milk"].includes(d.id)).map((d) => ({ id: d.id as Pick, label: d.label, emoji: d.emoji })),
  { id: "meal", label: "Meal", emoji: "🍽️" }, { id: "snack", label: "Snack", emoji: "🍎" },
];
const OZ = [1, 2, 3, 4, 6, 8, 10, 12], ML = [30, 60, 90, 120, 180, 240, 300, 360];
const FOODS = ["Fruit", "Vegetables", "Whole grains", "Beans", "Dairy", "Meat/fish", "Snack food"];
const AGO: [string, number][] = [["Just now", 0], ["15 min ago", 15], ["30 min ago", 30], ["1 hour ago", 60]];

export default function Simple() {
  const { data, set, kid, log, startTimer, interval, putKid } = usePotty();
  useTick(true, 1000);
  const [where, setWhere] = useState<Where>("potty");
  const [last, setLast] = useState<{ kind: Kind; at: number; text: string } | null>(null);
  const [pick, setPick] = useState<Pick>("bottle");
  const [ml, setMl] = useState<number | undefined>();
  const [foods, setFoods] = useState<string[]>([]);
  const [what, setWhat] = useState("");
  const [ago, setAgo] = useState(0);
  const units = data.units;
  const now = Date.now();
  const timer = data.timer && data.timer.kid === kid.id ? data.timer : null;
  const mine = data.logs.filter((x) => x.kid === kid.id && dayOf(x.at) === dayOf(now));
  const lastPeeAt = mine.filter((x) => isPeeEvent(x.kind)).reduce((m, x) => Math.max(m, x.at), 0), lastPoopAt = mine.filter((x) => isPoopEvent(x.kind)).reduce((m, x) => Math.max(m, x.at), 0);

  /** Sets the reminder for whichever comes first: the regular trip or a planned sit. */
  const arm = (fake: Entry) => {
    const r = nextRing([...data.logs, fake], kid, interval, Date.now());
    startTimer(r.minutes);
    return { at: Date.now() + r.minutes * 60_000, sit: r.sit };
  };
  const mark = (w: "pee" | "poop") => {
    const kind = KIND[where][w], at = Date.now();
    log(kind, { at });
    const r = arm({ id: "tmp", kid: kid.id, at, kind });
    setLast({ kind, at, text: `Saved at ${clockOf(at)}. ${r.sit ? sitText(r.sit) : `Next trip at ${clockOf(r.at)}.`}` });
  };
  const isDrink = pick !== "meal" && pick !== "snack";
  const add = () => {
    const at = Date.now() - ago * 60_000;
    const kind: Kind = isDrink ? "drink" : "food";
    const note = [...foods, what.trim()].filter(Boolean).join(", ") || undefined;
    const extra: Partial<Entry> = isDrink ? { at, drink: pick as DrinkType, ml } : { at, size: pick as "meal" | "snack", note };
    log(kind, extra);
    const r = arm({ id: "tmp", kid: kid.id, at, kind, ...extra });
    setLast({ kind, at, text: `Saved at ${clockOf(at)}. ${r.sit ? sitText(r.sit) : `Next trip at ${clockOf(r.at)}.`}` });
    setMl(undefined); setFoods([]); setWhat(""); setAgo(0);
  };
  const coming = planSits(data.logs, kid, now).filter((s) => s.state === "upcoming" || s.state === "due");
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
      </> : <p className="mt-3 text-lg font-bold leading-snug">Tap Peed or Pooped below when {kid.name} goes, or add what she ate or drank. I'll set the timer.</p>}
    </Panel>

    <div className="flex flex-wrap justify-center gap-1.5">{WHERE.map(([id, l]) => <Chip key={id} on={where === id} onClick={() => setWhere(id)}>{l}</Chip>)}</div>

    <div className="flex gap-3">
      <button type="button" onClick={() => mark("pee")} className={big} style={{ background: C.pee, color: "#fff" }}><span className="text-5xl">💧</span>Peed</button>
      <button type="button" onClick={() => mark("poop")} className={big} style={{ background: C.poop, color: "#fff" }}><span className="text-5xl">💩</span>Pooped</button>
    </div>

    {last && <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3" style={{ background: C.duckSoft }}>
      <p className="min-w-0 flex-1 text-sm font-bold leading-snug">✓ {last.text}</p>
      <Btn2 kind="plain" onClick={undo}>Undo</Btn2>
    </div>}

    <Panel>
      <p className="ph text-lg font-extrabold">She ate or drank</p>
      <div className="mt-3 flex flex-wrap gap-1.5">{PICKS.map((p) => <Chip key={p.id} on={pick === p.id} onClick={() => { setPick(p.id); setMl(undefined); setFoods([]); setWhat(""); }}><span>{p.emoji}</span>{p.label}</Chip>)}</div>
      {isDrink
        ? <div className="mt-3 flex flex-wrap items-center gap-1.5"><span className="mr-1 text-[13px] font-bold" style={{ color: C.muted }}>How much?</span>{(units === "oz" ? OZ : ML).map((v) => { const m = units === "oz" ? ozToMl(v) : v; return <Chip key={v} on={ml === m} onClick={() => setMl(ml === m ? undefined : m)}>{v} {units}</Chip>; })}</div>
        : <div className="mt-3"><p className="mb-1.5 text-[13px] font-bold" style={{ color: C.muted }}>What did she eat?</p>
            <div className="flex flex-wrap gap-1.5">{FOODS.map((f) => <Chip key={f} on={foods.includes(f)} onClick={() => setFoods(foods.includes(f) ? foods.filter((x) => x !== f) : [...foods, f])}>{f}</Chip>)}</div>
            <input type="text" value={what} maxLength={80} onChange={(e) => setWhat(e.target.value)} placeholder="Or type it: mac and cheese, banana…" aria-label="What she ate" className="mt-2 h-11 w-full rounded-xl px-3 text-sm" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}`, background: "#fff" }} /></div>}
      <div className="mt-3 flex flex-wrap items-center gap-1.5"><span className="mr-1 text-[13px] font-bold" style={{ color: C.muted }}>When?</span>{AGO.map(([l, m]) => <Chip key={m} on={ago === m} onClick={() => setAgo(m)}>{l}</Chip>)}</div>
      <div className="mt-4"><Btn2 kind="duck" onClick={add}>Add it and set the timer</Btn2></div>
    </Panel>

    {coming.length > 0 && <Panel>
      <p className="ph text-lg font-extrabold">What to expect</p>
      <ul className="mt-2 space-y-2">{coming.slice(0, 4).map((s) => <li key={s.id} className="flex gap-2 text-sm leading-snug"><span>🚽</span><span>{sitText(s)}</span></li>)}</ul>
    </Panel>}

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
