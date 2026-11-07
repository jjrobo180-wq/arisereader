// Before the first set: your readiness score, Ready Mode (an optional switch that fits the workout to
// how ready you are, and says why), an offer to warm up with a matched stretch, and a quick check-in on
// food and caffeine with tips. See shared/fitReadyMode.ts.
import { useMemo, useState } from "react";
import { Coffee, Flame, Play, Sparkles, StretchHorizontal, Utensils, X } from "lucide-react";
import type { FitData, FitExercise } from "@shared/fit";
import { SESSION_BY_ID } from "@shared/fitSessions";
import { checkInTips, readyPlan, warmupFor, type CheckIn, type Fueled, type Stim } from "@shared/fitReadyMode";
import { Btn, C, Card, display, haptic, numFont } from "./fitUi";
import { SessionPlayer } from "./FitSession";

const KEY = "arise-fit-ready-mode";
export const readyModeOn = () => { try { return localStorage.getItem(KEY) === "on"; } catch { return false; } };
const setReadyMode = (on: boolean) => { try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* fine */ } };
const colorOf = (n: number) => (n >= 80 ? "#22c55e" : n >= 60 ? "#84cc16" : n >= 40 ? "#f59e0b" : "#ef4444");

function Pills<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string][] }) {
  return <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>{items.map(([id, label]) =>
    <button key={id} type="button" onClick={() => { onChange(id); haptic("light"); }} aria-pressed={value === id} className="min-h-[42px] rounded-[12px] px-1 text-[13.5px] font-semibold" style={value === id ? { background: C.lime, color: C.ink } : { background: C.card2 }}>{label}</button>)}</div>;
}

export function ReadyCheck({ data, name, exercises, onStart, onSkip }: { data: FitData; name: string; exercises: FitExercise[]; onStart: (exercises: FitExercise[], check: CheckIn) => void; onSkip: () => void }) {
  const plan = useMemo(() => readyPlan(data, exercises), [data, exercises]);
  const [adapt, setAdapt] = useState(readyModeOn);
  const [food, setFood] = useState<Fueled>("snack");
  const [stim, setStim] = useState<Stim>("none");
  const [stretched, setStretched] = useState(false);
  const [warming, setWarming] = useState(false);
  const warm = SESSION_BY_ID.get(warmupFor(exercises));
  const R = 52, c = 2 * Math.PI * R, col = colorOf(plan.score);
  const go = () => { haptic("success"); onStart(adapt ? plan.exercises : exercises, { food, stim, stretched, ready: plan.score, adapted: adapt }); };
  return <div className="fit-up fixed inset-0 z-[76] overflow-y-auto px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(14px,var(--sat,env(safe-area-inset-top,0px)))]" style={{ background: C.bg, color: C.text }} role="dialog" aria-label="Before you start" data-testid="fit-ready-check">
    <div className="flex items-center justify-between">
      <p className="text-[13px] font-semibold uppercase tracking-[.14em]" style={{ color: C.dim }}>Before you start</p>
      <button type="button" onClick={onSkip} aria-label="Skip the check-in" className="grid h-10 w-10 place-items-center rounded-full" style={{ background: C.card2 }}><X className="h-5 w-5" /></button>
    </div>
    <p className="mt-1 truncate text-[30px] leading-tight" style={display}>{name}</p>

    {/* Readiness */}
    <Card className="mt-3 flex items-center gap-4 !p-4" testId="fit-ready-score">
      <span className="relative grid shrink-0 place-items-center" style={{ width: 120, height: 120 }}>
        <svg width="120" height="120" className="-rotate-90" aria-hidden><circle cx="60" cy="60" r={R} fill="none" strokeWidth="10" style={{ stroke: C.track }} />
          <circle cx="60" cy="60" r={R} fill="none" strokeWidth="10" strokeLinecap="round" style={{ stroke: col, strokeDasharray: c, strokeDashoffset: c * (1 - plan.score / 100), transition: "stroke-dashoffset 1s" }} /></svg>
        <span className="absolute text-center"><span className="block text-[38px] leading-none" style={{ ...numFont, fontWeight: 700 }}>{plan.score}</span><span className="text-[11px]" style={{ color: C.dim }}>of 100</span></span>
      </span>
      <div className="min-w-0"><p className="text-[22px] leading-tight" style={{ ...display, color: col }}>{plan.word}</p>
        <ul className="mt-1 space-y-1 text-[13px] leading-snug" style={{ color: C.dim }}>{plan.why.slice(0, 3).map((w) => <li key={w}>{w}</li>)}</ul></div>
    </Card>

    {/* Ready Mode */}
    <Card className="mt-3 !p-4" testId="fit-ready-mode">
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 shrink-0" style={{ color: C.lime }} />
        <div className="min-w-0 flex-1"><p className="text-[18px] leading-tight" style={display}>Ready Mode</p><p className="text-[13px]" style={{ color: C.dim }}>Fits today's weights, sets and rest to your readiness. Optional.</p></div>
        <button type="button" role="switch" aria-checked={adapt} aria-label="Ready Mode" onClick={() => { const v = !adapt; setAdapt(v); setReadyMode(v); haptic("light"); }} className="relative h-8 w-14 shrink-0 rounded-full transition-colors" style={{ background: adapt ? C.lime : C.track }} data-testid="fit-ready-toggle">
          <span className="absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all" style={{ left: adapt ? 28 : 4 }} /></button>
      </div>
      <div className="mt-3 rounded-[12px] p-3" style={{ background: C.card2, opacity: adapt ? 1 : 0.6 }}>
        <p className="text-[14px] font-bold">{plan.headline}</p>
        <ul className="mt-1.5 space-y-1 text-[13px] leading-snug">{plan.changes.map((x) => <li key={x} className="flex gap-2"><span aria-hidden style={{ color: C.lime }}>•</span><span>{x}</span></li>)}</ul>
        {!adapt && <p className="mt-2 text-[12px]" style={{ color: C.dim }}>Off: you'll do the workout exactly as planned. Turn it on to use these changes.</p>}
      </div>
    </Card>

    {/* Warm-up */}
    {warm && <Card className="mt-3 !p-4" testId="fit-ready-warmup">
      <div className="flex items-center gap-3"><StretchHorizontal className="h-6 w-6 shrink-0" style={{ color: C.lime }} />
        <div className="min-w-0 flex-1"><p className="text-[16px] font-bold">{stretched ? "Warm-up done" : "Want a warm-up stretch first?"}</p><p className="text-[13px]" style={{ color: C.dim }}>{warm.name}: picked for today's muscles, about {Math.round(warm.phases.reduce((a, p) => a + p.secs, 0) / 60)} min.</p></div>
        {!stretched && <Btn kind="soft" className="!min-h-10 !px-3" onClick={() => setWarming(true)}><Play className="h-4 w-4" />Start</Btn>}</div>
    </Card>}

    {/* Food and caffeine */}
    <Card className="mt-3 space-y-3 !p-4" testId="fit-ready-fuel">
      <div><p className="mb-1.5 flex items-center gap-2 text-[14px] font-bold"><Utensils className="h-4 w-4" style={{ color: C.lime }} />Have you eaten?</p>
        <Pills value={food} onChange={setFood} items={[["meal", "A meal"], ["snack", "A snack"], ["fasted", "Nothing"]]} /></div>
      <div><p className="mb-1.5 flex items-center gap-2 text-[14px] font-bold"><Coffee className="h-4 w-4" style={{ color: C.lime }} />Any caffeine?</p>
        <Pills value={stim} onChange={setStim} items={[["none", "None"], ["coffee", "Coffee"], ["preworkout", "Pre-workout"]]} /></div>
      <ul className="space-y-1 text-[13px] leading-snug" style={{ color: C.dim }}>{checkInTips({ food, stim }).map((t) => <li key={t}>{t}</li>)}</ul>
    </Card>

    <Btn className="mt-4 w-full !min-h-[56px] !text-[19px]" onClick={go} testId="fit-ready-start"><Flame className="h-5 w-5" />Start workout</Btn>
    <p className="mt-2 text-center text-[11.5px]" style={{ color: C.dim }}>Readiness is a guide from your sleep and recent training, not a medical measure.</p>
    {warming && warm && <SessionPlayer session={warm} onClose={() => setWarming(false)} onDone={() => { setWarming(false); setStretched(true); }} />}
  </div>;
}
