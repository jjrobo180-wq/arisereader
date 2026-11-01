// Today's workout, built for you (like Fitbod): it trains your freshest muscle group with the equipment
// and time you have (shared/fitRecovery.ts). Swap any exercise, shuffle the whole thing, or change the
// time, equipment or focus. The day's plan stays put until you change it or finish it.
import { useMemo, useState } from "react";
import { ArrowLeftRight, Check, Clock3, Dumbbell, Play, Shuffle, SlidersHorizontal } from "lucide-react";
import { CATALOG_BY_ID, dayKey, type FitData } from "@shared/fit";
import { EQUIP_LABEL, FOCUS_LABEL, PART_NAME, alternatives, generateWorkout, prescription, recovery, type Equip, type Focus, type GenItem, type GenWorkout } from "@shared/fitRecovery";
import type { LibraryExercise } from "./fitStore";
import { planned, startWorkout } from "./FitTrain";
import { Art, type ArtKind } from "./fitArt";
import { recColor } from "./FitBody";
import { Btn, C, Sheet, Title, cardStyle, display, haptic, stagger } from "./fitUi";

type Opts = { equip: Equip; mins: number; focus: Focus | "auto" };
const OPTS_KEY = "arise-fit-smart-options";
const PLAN_KEY = "arise-fit-smart-plan";
const read = <T,>(k: string, d: T): T => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v ?? d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full */ } };
const FOCUS_ART: Record<Focus, ArtKind> = { push: "push", pull: "pull", legs: "legs", upper: "muscle", full: "full" };

/** The day's plan: built once, then kept (with any swaps) until the options change or it's shuffled. */
function usePlan(data: FitData) {
  const [opts, setOptsState] = useState<Opts>(() => read<Opts>(OPTS_KEY, { equip: "gym", mins: 45, focus: "auto" }));
  const [saved, setSaved] = useState<{ day: string; seed: number; key: string; items?: GenItem[] } | null>(() => read(PLAN_KEY, null));
  const today = dayKey();
  const key = `${opts.equip}|${opts.mins}|${opts.focus}|${data.profile.goal}`;
  const seed = saved && saved.day === today && saved.key === key ? saved.seed : Number(today.replace(/-/g, ""));
  const base = useMemo(() => generateWorkout(data, { ...opts, goal: data.profile.goal, seed }), [data.workouts, data.profile.goal, opts, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const plan: GenWorkout = saved && saved.day === today && saved.key === key && saved.items?.length ? { ...base, items: saved.items } : base;
  const keep = (next: { seed?: number; items?: GenItem[] }) => { const s = { day: today, key, seed: next.seed ?? seed, items: next.items }; setSaved(s); write(PLAN_KEY, s); };
  const setOpts = (o: Opts) => { setOptsState(o); write(OPTS_KEY, o); };
  return { plan, opts, setOpts, shuffle: () => keep({ seed: Math.floor(Math.random() * 1e9) }), setItems: (items: GenItem[]) => keep({ items }) };
}

export function SmartWorkoutCard({ data, list, onStart, testId = "fit-smart" }: { data: FitData; list: LibraryExercise[]; onStart: (a: ReturnType<typeof startWorkout>) => void; testId?: string }) {
  const { plan, opts, setOpts, shuffle, setItems } = usePlan(data);
  const [options, setOptions] = useState(false);
  const rec = useMemo(() => recovery(data.workouts), [data.workouts]);
  const doneToday = data.workouts.some((w) => w.programId === "smart" && w.dayId === dayKey());
  const u = data.profile.units;
  const sets = useMemo(() => planned(data, plan.items, list), [data, plan.items, list]);
  const swap = (i: number) => {
    haptic("light");
    const it = plan.items[i];
    const alt = alternatives(it.exId, opts.equip, plan.items.map((x) => x.exId), data.workouts)[0];
    if (!alt) return;
    const next = [...plan.items];
    next[i] = { ...it, exId: alt.id, name: alt.name, ...prescription(data.profile.goal, alt, i === 0) };
    setItems(next);
  };
  const start = () => { haptic("medium"); onStart(startWorkout({ name: plan.title, programId: "smart", dayId: dayKey(), exercises: sets })); };
  return <div className="fit-in overflow-hidden rounded-[18px]" style={cardStyle} data-testid={testId}>
    <Art kind={FOCUS_ART[plan.focus]} className="h-[128px]">
      <span className="absolute inset-x-4 bottom-3.5 text-white">
        <span className="block text-[12px] tracking-[.16em] opacity-90" style={display}>{doneToday ? "Done today · build another" : "Today's workout · built for you"}</span>
        <span className="block text-[34px] leading-[.95]" style={display}>{plan.title}</span>
        <span className="block text-[13px] font-semibold opacity-90">{plan.muscles.slice(0, 4).map((p) => PART_NAME[p]).join(" · ")}</span>
      </span>
    </Art>
    <div className="p-4 pt-3">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        <button type="button" onClick={() => setOptions(true)} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold" style={{ background: C.card2 }} data-testid={`${testId}-options`}><Clock3 className="h-4 w-4" />{opts.mins} min</button>
        <button type="button" onClick={() => setOptions(true)} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold" style={{ background: C.card2 }}><Dumbbell className="h-4 w-4" />{EQUIP_LABEL[opts.equip]}</button>
        <button type="button" onClick={() => setOptions(true)} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold" style={{ background: C.card2 }}><SlidersHorizontal className="h-4 w-4" />{opts.focus === "auto" ? "Auto focus" : FOCUS_LABEL[opts.focus]}</button>
        <button type="button" onClick={() => { haptic("light"); shuffle(); }} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold" style={{ background: C.card2 }} data-testid={`${testId}-shuffle`}><Shuffle className="h-4 w-4" />Shuffle</button>
      </div>
      {plan.why && <p className="mt-2 px-0.5 text-[13px] leading-snug" style={{ color: C.dim }}>{plan.why} About {plan.mins} min.</p>}
      <ol className="mt-2">{plan.items.map((it, i) => {
        const w = sets[i]?.sets[0]?.weight ?? 0;
        const timed = /s$/.test(it.reps) || CATALOG_BY_ID.get(it.exId)?.timed;
        return <li key={`${it.exId}-${i}`} className="fit-slide flex items-center gap-3 py-2.5" style={{ ...stagger(i, 0.04), ...(i ? { borderTop: `1px solid ${C.line}` } : {}) }}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[16px]" style={{ ...display, background: C.tint, color: C.lime }}>{i + 1}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-semibold">{it.name}</span>
            <span className="flex items-center gap-1.5 text-[12px]" style={{ color: C.dim }}><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: recColor(rec[it.muscle].pct) }} />{PART_NAME[it.muscle]} · {it.sets} × {it.reps}{!timed && w ? ` · ${w} ${u}` : ""}</span></span>
          <button type="button" onClick={() => swap(i)} aria-label={`Swap ${it.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: C.card2 }} data-testid={`${testId}-swap-${i}`}><ArrowLeftRight className="h-4 w-4" /></button>
        </li>;
      })}</ol>
      {!plan.items.length && <p className="py-4 text-center text-[14px]" style={{ color: C.dim }}>Nothing fits that equipment. Try another option.</p>}
      <Btn className="mt-2 w-full !min-h-[52px] !text-[19px]" disabled={!plan.items.length} onClick={start} testId={`${testId}-start`}><Play className="h-5 w-5" fill="currentColor" />Start workout</Btn>
    </div>
    {options && <OptionsSheet opts={opts} onClose={() => setOptions(false)} onChange={(o) => { setOpts(o); haptic("light"); }} />}
  </div>;
}

function OptionsSheet({ opts, onChange, onClose }: { opts: Opts; onChange: (o: Opts) => void; onClose: () => void }) {
  const pill = (on: boolean) => (on ? { background: C.lime, color: "#0b0b0c" } : { background: C.card, color: C.text, boxShadow: `inset 0 0 0 1px ${C.line}` });
  return <Sheet title="Workout options" onClose={onClose} testId="fit-smart-sheet">
    <Title>Time</Title>
    <div className="grid grid-cols-4 gap-2">{[30, 45, 60, 75].map((m) => <button key={m} type="button" onClick={() => onChange({ ...opts, mins: m })} className="h-14 rounded-[12px] text-[20px]" style={{ ...display, ...pill(opts.mins === m) }}>{m}<span className="ml-0.5 text-[12px]">min</span></button>)}</div>
    <Title>Equipment</Title>
    <div className="grid grid-cols-3 gap-2">{(Object.keys(EQUIP_LABEL) as Equip[]).map((e) => <button key={e} type="button" onClick={() => onChange({ ...opts, equip: e })} className="h-14 rounded-[12px] text-[14px] font-semibold" style={pill(opts.equip === e)} data-testid={`fit-smart-equip-${e}`}>{EQUIP_LABEL[e]}</button>)}</div>
    <Title>Focus</Title>
    <div className="grid grid-cols-3 gap-2">{(["auto", "push", "pull", "legs", "upper", "full"] as const).map((f) => <button key={f} type="button" onClick={() => onChange({ ...opts, focus: f })} className="h-14 rounded-[12px] text-[14px] font-semibold" style={pill(opts.focus === f)}>{f === "auto" ? "Auto" : FOCUS_LABEL[f]}</button>)}</div>
    <p className="mt-3 px-1 text-[13px]" style={{ color: C.dim }}>Auto trains whichever group is most recovered: push (chest, shoulders, triceps), pull (back, biceps) or legs.</p>
    <Btn className="mt-6 w-full" onClick={onClose}><Check className="h-5 w-5" />Done</Btn>
  </Sheet>;
}
