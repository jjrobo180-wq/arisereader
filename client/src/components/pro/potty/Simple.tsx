// Simple: the whole routine on one screen. Tap Peed or Pooped (the time is taken from the clock, or type it if you forgot),
// or add what she ate or drank, and the reminder is set for the next sit, with an estimate of
// when to expect the pee or poop. When it rings, snooze it until she goes.
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { phoneState, sendPottyTest, turnOnPhone, type PushPhase } from "@/lib/pottyPush";
import { isNativeApp } from "@/lib/nativeApp";
import { useTick, fmtDuration } from "../kit";
import { AGO_CHOICES, DRINK_TYPES, JUST_NOW, clockOf, dayOf, isPeeEvent, isPoopEvent, comingText, mlToOz, minutesAfter, nextRing, ozToMl, planSits, resolveWhen, whenText, type DrinkType, type Entry, type Kind, type When } from "@shared/pro/potty";
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

const nowClock = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

/** "When did it happen?" Just now by default; a parent who forgot to tap (or lost the phone) can say how long ago or type the time. */
function WhenRow({ when, setWhen, now, label }: { when: When; setWhen: (w: When) => void; now: number; label: string }) {
  const typed = when.mode === "time";
  const result = resolveWhen(when, now);
  return <div>
    <div className="flex flex-wrap items-center gap-1.5"><span className="mr-1 text-[13px] font-bold" style={{ color: C.muted }}>{label}</span>
      {AGO_CHOICES.map(([l, m]) => <Chip key={m} on={!typed && when.mode === "ago" && when.ago === m} onClick={() => setWhen({ mode: "ago", ago: m })}>{l}</Chip>)}
      <Chip on={typed} onClick={() => setWhen(typed ? JUST_NOW : { mode: "time", time: nowClock(), yesterday: false })}>🕐 Type a time</Chip></div>
    {when.mode === "time" && <div className="mt-2 flex flex-wrap items-center gap-2">
      <input type="time" value={when.time} onChange={(e) => setWhen({ ...when, time: e.target.value })} aria-label="Time it happened" className="h-11 rounded-xl px-3 text-base font-bold" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}`, background: "#fff" }} />
      <Chip on={!when.yesterday} onClick={() => setWhen({ ...when, yesterday: false })}>Today</Chip>
      <Chip on={when.yesterday} onClick={() => setWhen({ ...when, yesterday: true })}>Yesterday</Chip>
      {result.ok ? <span className="text-[13px] font-bold" style={{ color: C.muted }}>{whenText(result.at, now)}</span>
        : <span role="alert" className="w-full text-[13px] font-bold text-red-700">{result.error}</span>}
    </div>}
  </div>;
}

/** Turns on phone notifications for the timer: a notification when it rings, even with the app closed. */
function PhoneNotify() {
  const { token } = useAuth();
  const { data, set } = usePotty();
  const [phase, setPhase] = useState<PushPhase>("checking");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => { let live = true; void phoneState(token).then((p) => { if (live) setPhase(p); }); return () => { live = false; }; }, [token]);
  const on = data.notify && phase === "on";
  const turnOn = async () => {
    setBusy(true); setNote("");
    try { const p = await turnOnPhone(token); setPhase(p); if (p === "on") set((d) => ({ ...d, notify: true })); } catch (e) { setNote(e instanceof Error ? e.message : "Couldn't turn that on. Try again."); }
    setBusy(false);
  };
  const test = async () => {
    setBusy(true); setNote("");
    try { await sendPottyTest(token); setNote("Test sent. It should arrive in a few seconds."); } catch (e) { setNote(e instanceof Error ? e.message : "Couldn't send the test."); }
    setBusy(false);
  };
  const blocker: Partial<Record<PushPhase, string>> = {
    install: "On iPhone, first add this app to your Home Screen: tap Share, then Add to Home Screen. Open it from there, then turn this on.",
    blocked: "Notifications are blocked for this site. Allow them in your phone's settings for this app or browser, then come back here.",
    unsupported: isNativeApp() ? "Notifications aren't in this version of the app yet. Update Arise To Duo from the App Store, then try again." : "This browser can't show notifications. Try Chrome or Safari, or the app on your Home Screen.",
    unavailable: "Phone notifications aren't set up on the server yet.",
  };
  return <Panel>
    <p className="ph text-lg font-extrabold">🔔 Notify my phone</p>
    <p className="mt-1 text-[13px] leading-snug" style={{ color: C.muted }}>When the timer is up, a notification comes to your phone, even if this app is closed or the screen is off. If you don't tap Peed or Pooped, it reminds you twice more.</p>
    {blocker[phase] ? <p className="mt-3 rounded-xl px-3 py-2 text-sm font-bold" style={{ background: C.duckSoft }}>{blocker[phase]}</p>
      : <div className="mt-3 flex flex-wrap items-center gap-2">
        {on ? <>
          <span className="rounded-full px-3.5 py-2 text-sm font-extrabold" style={{ background: C.duckSoft }}>✓ On for this phone</span>
          <Btn2 kind="plain" onClick={test}>{busy ? "Sending…" : "Send a test"}</Btn2>
          <Btn2 kind="plain" onClick={() => set((d) => ({ ...d, notify: false }))}>Turn off</Btn2>
        </> : <Btn2 kind="duck" onClick={turnOn}>{busy ? "Turning on…" : phase === "checking" ? "Checking…" : "Turn on notifications"}</Btn2>}
      </div>}
    {note && <p role="status" className="mt-2 text-[13px] font-bold" style={{ color: C.muted }}>{note}</p>}
    {on && <p className="mt-2 text-[13px] leading-snug" style={{ color: C.muted }}>While the timer runs you'll also see a "timer running" notification with the time it rings. Phones can't show a live countdown in a notification, so open the app to watch the seconds.</p>}
  </Panel>;
}

export default function Simple() {
  const { data, set, kid, log, startTimer, interval, putKid } = usePotty();
  useTick(true, 1000);
  const [where, setWhere] = useState<Where>("potty");
  const [last, setLast] = useState<{ kind: Kind; at: number; text: string } | null>(null);
  const [pick, setPick] = useState<Pick>("bottle");
  const [ml, setMl] = useState<number | undefined>();
  const [foods, setFoods] = useState<string[]>([]);
  const [what, setWhat] = useState("");
  const [markWhen, setMarkWhen] = useState<When>(JUST_NOW);
  const [addWhen, setAddWhen] = useState<When>(JUST_NOW);
  const units = data.units;
  const now = Date.now();
  const timer = data.timer && data.timer.kid === kid.id ? data.timer : null;
  const mine = data.logs.filter((x) => x.kid === kid.id && dayOf(x.at) === dayOf(now));
  const lastPeeAt = mine.filter((x) => isPeeEvent(x.kind)).reduce((m, x) => Math.max(m, x.at), 0), lastPoopAt = mine.filter((x) => isPoopEvent(x.kind)).reduce((m, x) => Math.max(m, x.at), 0);

  /** Sets the reminder for whichever comes first: the regular trip or a planned sit. */
  const arm = (fake: Entry) => {
    const t = Date.now(), r = nextRing([...data.logs, fake], kid, interval, t);
    // A planned sit is already counted from when it happened; the regular gap counts from the event too, so a late entry rings sooner.
    const minutes = r.sit ? r.minutes : minutesAfter(r.minutes, fake.at, t);
    startTimer(minutes);
    return { at: t + minutes * 60_000, sit: r.sit, due: r.due };
  };
  /** The banner is short on purpose: what to do first and when the timer rings. The reasons live in "What to expect" below, built from the same plan. */
  const savedText = (at: number, r: ReturnType<typeof arm>) =>
    `Saved at ${whenText(at, Date.now())}. ${r.due ? "Sit on the toilet now. " : ""}${r.sit ? `${r.due ? "Then the" : "The"} timer rings at ${clockOf(r.sit.at)}.` : `Timer set for ${clockOf(r.at)}.`}`;
  const markAt = resolveWhen(markWhen, now), addAt = resolveWhen(addWhen, now);
  const mark = (w: "pee" | "poop") => {
    const when = resolveWhen(markWhen, Date.now());
    if (!when.ok) return;
    const kind = KIND[where][w], at = when.at;
    log(kind, { at });
    const r = arm({ id: "tmp", kid: kid.id, at, kind });
    setLast({ kind, at, text: savedText(at, r) });
    setMarkWhen(JUST_NOW);
  };
  const isDrink = pick !== "meal" && pick !== "snack";
  const add = () => {
    const when = resolveWhen(addWhen, Date.now());
    if (!when.ok) return;
    const at = when.at;
    const kind: Kind = isDrink ? "drink" : "food";
    const note = [...foods, what.trim()].filter(Boolean).join(", ") || undefined;
    const extra: Partial<Entry> = isDrink ? { at, drink: pick as DrinkType, ml } : { at, size: pick as "meal" | "snack", note };
    log(kind, extra);
    const r = arm({ id: "tmp", kid: kid.id, at, kind, ...extra });
    setLast({ kind, at, text: savedText(at, r) });
    setMl(undefined); setFoods([]); setWhat(""); setAddWhen(JUST_NOW);
  };
  const plan = planSits(data.logs, kid, now);
  const coming = comingText(plan);
  const dueNow = plan.some((s) => s.state === "due");
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
        {dueNow && <p className="mt-2 rounded-xl bg-white/15 px-3 py-2 text-base font-extrabold" style={{ color: C.duck }}>🚽 Sit her on the toilet now. Next timer:</p>}
        <p className="ph mt-2 text-6xl font-extrabold tabular-nums" style={{ color: C.duck }}>{fmtDuration(left)}</p>
        <p className="mt-1 text-lg font-bold">at {clockOf(timer.endAt)}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5"><span className="mr-1 text-[13px] text-white/60">Snooze</span>{SNOOZE.map((m) => <button key={m} type="button" onClick={() => startTimer(m)} className="rounded-full bg-white/15 px-3.5 py-2 text-sm font-bold text-white">{m} min</button>)}
          <button type="button" onClick={() => set((d) => ({ ...d, timer: null }))} className="rounded-full px-3.5 py-2 text-sm font-bold text-white/60">Stop</button></div>
      </> : <p className="mt-3 text-lg font-bold leading-snug">Tap Peed or Pooped below when {kid.name} goes, or add what she ate or drank. I'll set the timer.</p>}
    </Panel>

    <div className="flex flex-wrap justify-center gap-1.5">{WHERE.map(([id, l]) => <Chip key={id} on={where === id} onClick={() => setWhere(id)}>{l}</Chip>)}</div>

    <WhenRow when={markWhen} setWhen={setMarkWhen} now={now} label="When?" />

    <div className="flex gap-3">
      <button type="button" disabled={!markAt.ok} onClick={() => mark("pee")} className={`${big} disabled:opacity-40`} style={{ background: C.pee, color: "#fff" }}><span className="text-5xl">💧</span>Peed</button>
      <button type="button" disabled={!markAt.ok} onClick={() => mark("poop")} className={`${big} disabled:opacity-40`} style={{ background: C.poop, color: "#fff" }}><span className="text-5xl">💩</span>Pooped</button>
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
      <div className="mt-3"><WhenRow when={addWhen} setWhen={setAddWhen} now={now} label="When?" /></div>
      <div className="mt-4"><Btn2 kind="duck" onClick={add} disabled={!addAt.ok}>Add it and set the timer</Btn2></div>
    </Panel>

    {coming.length > 0 && <Panel>
      <p className="ph text-lg font-extrabold">What to expect, in order</p>
      <ol className="mt-2 space-y-2">{coming.slice(0, 4).map((t, i) => <li key={i} className="flex gap-2 text-sm leading-snug"><span>{i === 0 ? "🚽" : "➡️"}</span><span className={i === 0 ? "font-bold" : undefined}>{t}</span></li>)}</ol>
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
      <p className="mt-3 text-[13px] leading-snug" style={{ color: C.muted }}>Auto uses {kid.name}'s own usual gap once there are enough pees logged. When the timer rings, tap Snooze and it rings again until you mark a pee or poop. {data.notify ? "Phone notifications are on, so it can ring with the app closed." : "Keep this page open on your phone so it can ring, or turn on phone notifications below."}</p>
    </Panel>

    <PhoneNotify />
  </div>;
}
