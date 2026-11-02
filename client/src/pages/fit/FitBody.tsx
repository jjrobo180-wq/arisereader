// Arise Fit's body map, the way Fitbod shows it: a front and back figure with every muscle drawn
// (bodyShapes.ts), colored by how recovered it is from your last week of workouts (green fresh, amber
// recovering, red sore; shared/fitRecovery.ts). Tap a muscle, or a row in the list, to see what trains
// it (with how-to videos) and start a quick workout for it.
import { useMemo, useState } from "react";
import { ChevronRight, Play, RotateCcw } from "lucide-react";
import { CATALOG_BY_ID, type FitData } from "@shared/fit";
import { BODY_PARTS, PART_NAME, recovery, recoveryLevel, type BodyPart, type Recovery } from "@shared/fitRecovery";
import { videoFor } from "@shared/fitVideos";
import type { LibraryExercise } from "./fitStore";
import { BACK, BACK_LINES, FRONT, FRONT_LINES, SILHOUETTE, type Shape } from "./bodyShapes";
import { Btn, C, Card, Chips, Sheet, Title, display, stagger } from "./fitUi";
import { VideoThumb } from "./FitVideo";

export type { BodyPart };
/** Recovery colors (Apple's system green, orange and red). */
export const REC_COLOR = { fresh: "#30c75a", recovering: "#ff9f0a", sore: "#ff453a" } as const;
export const recColor = (pct: number) => REC_COLOR[recoveryLevel(pct)];
const EQUIP = ["any", "barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "band"] as const;
const ago = (iso?: string) => { if (!iso) return "Not this week"; const d = Math.floor((Date.now() - Date.parse(iso)) / 864e5); return d <= 0 ? "Trained today" : d === 1 ? "Trained yesterday" : `Trained ${d} days ago`; };

/** One figure, front or back. `fill` colors each muscle; `picked` is shown in orange. */
export function BodyFigure({ side, fill, picked, onPick, className = "", label }: { side: "front" | "back"; fill: (p: BodyPart) => string; picked?: BodyPart | null; onPick?: (p: BodyPart) => void; className?: string; label?: string }) {
  const shapes = side === "front" ? FRONT : BACK;
  const lines = side === "front" ? FRONT_LINES : BACK_LINES;
  const mirror = "translate(200 0) scale(-1 1)";
  const muscle = (s: Shape, k: string, flip: boolean) => {
    const on = picked === s.part;
    return <path key={k} d={s.d} transform={flip ? mirror : undefined} strokeWidth={1.6} strokeLinejoin="round"
      style={{ fill: on ? C.lime : fill(s.part), stroke: C.gap, opacity: picked && !on ? 0.55 : 1, transition: "fill .25s ease, opacity .25s ease", cursor: onPick ? "pointer" : undefined }}
      onClick={onPick ? () => onPick(s.part) : undefined} role={onPick ? "button" : undefined} aria-label={onPick ? PART_NAME[s.part] : undefined} aria-pressed={onPick ? on : undefined} />;
  };
  return <figure className={`m-0 flex h-full min-w-0 flex-1 flex-col items-center ${className}`}>
    <svg viewBox="22 6 156 444" className="min-h-0 w-full flex-1" role="group" aria-label={`${side === "front" ? "Front" : "Back"} of the body`}>
      <path d={SILHOUETTE} style={{ fill: C.body }} />
      <path d={SILHOUETTE} transform={mirror} style={{ fill: C.body }} />
      <ellipse cx="100" cy="33" rx="16" ry="21" style={{ fill: C.body }} />
      {picked && shapes.filter((s) => s.part === picked).map((s, i) => <g key={`glow${i}`} style={{ filter: "blur(4px)" }} opacity=".55" pointerEvents="none"><path d={s.d} fill="#ff5a1f" /><path d={s.d} transform={mirror} fill="#ff5a1f" /></g>)}
      {shapes.map((s, i) => muscle(s, `l${i}`, false))}
      {shapes.map((s, i) => muscle(s, `r${i}`, true))}
      {lines.map((d, i) => <g key={`d${i}`} pointerEvents="none" opacity=".75"><path d={d} fill="none" strokeWidth={1.1} strokeLinecap="round" style={{ stroke: C.gap }} /><path d={d} transform={mirror} fill="none" strokeWidth={1.1} strokeLinecap="round" style={{ stroke: C.gap }} /></g>)}
    </svg>
    {label && <figcaption className="mt-1 text-[12px] tracking-[.16em]" style={{ ...display, color: C.dim }}>{label}</figcaption>}
  </figure>;
}

/** Both figures, small, colored by recovery (Today's recovery card). */
export function MiniBody({ rec, height = 150 }: { rec: Recovery; height?: number }) {
  return <div className="flex shrink-0 gap-0.5" style={{ height, width: height * 0.74 }} aria-hidden>
    <BodyFigure side="front" fill={(p) => recColor(rec[p].pct)} />
    <BodyFigure side="back" fill={(p) => recColor(rec[p].pct)} />
  </div>;
}

export function Legend() {
  return <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12px] font-semibold" style={{ color: C.dim }}>
    {([["fresh", "Fresh"], ["recovering", "Recovering"], ["sore", "Needs rest"]] as const).map(([k, l]) => <span key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: REC_COLOR[k] }} />{l}</span>)}
  </div>;
}

export function BodyMap({ data, list, onClose, onOpen, onStart }: { data: FitData; list: LibraryExercise[]; onClose: () => void; onOpen: (e: LibraryExercise) => void; onStart: (name: string, items: { exId: string; sets: number; reps: string; rest: number }[]) => void }) {
  const rec = useMemo(() => recovery(data.workouts, new Date(), (id) => list.find((e) => e.id === id) ?? CATALOG_BY_ID.get(id)), [data.workouts, list]);
  const [picked, setPicked] = useState<BodyPart | null>(null);
  const [equip, setEquip] = useState<(typeof EQUIP)[number]>("any");
  const pick = (p: BodyPart) => setPicked((x) => (x === p ? null : p));
  const exercises = useMemo(() => !picked ? [] : list
    .filter((e) => (e.muscle === picked || e.also.includes(picked)) && (equip === "any" || e.equipment === equip))
    .sort((a, b) => Number(b.muscle === picked) - Number(a.muscle === picked) || Number(!!videoFor(b.id)) - Number(!!videoFor(a.id)) || Number(b.source === "arise") - Number(a.source === "arise") || a.name.localeCompare(b.name))
    .slice(0, 60), [list, picked, equip]);
  // A quick session: the best four main movers for the muscle, compounds first.
  const quick = exercises.filter((e) => e.muscle === picked && e.source === "arise" && !CATALOG_BY_ID.get(e.id)?.timed).slice(0, 4);
  const ready = BODY_PARTS.filter((p) => rec[p].pct >= 85);
  const ordered = [...BODY_PARTS].sort((a, b) => rec[a].pct - rec[b].pct);
  return <Sheet title="Muscle recovery" onClose={onClose} testId="fit-body-map" right={picked ? <button type="button" onClick={() => setPicked(null)} aria-label="Clear" className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card }}><RotateCcw className="h-5 w-5" /></button> : undefined}>
    <Card className="!px-3 !pb-3 !pt-2">
      <div className="flex h-[330px] gap-1"><BodyFigure side="front" label="Front" fill={(p) => recColor(rec[p].pct)} picked={picked} onPick={pick} /><BodyFigure side="back" label="Back" fill={(p) => recColor(rec[p].pct)} picked={picked} onPick={pick} /></div>
      <div className="mt-2"><Legend /></div>
    </Card>
    {!picked && <p className="mt-3 px-1 text-[13px]" style={{ color: C.dim }}>{ready.length === BODY_PARTS.length ? "Every muscle is fresh. Tap one to see what trains it." : `Ready to train: ${ready.map((p) => PART_NAME[p]).join(", ") || "nothing yet, rest up"}. Tap a muscle to see what trains it.`}</p>}
    {picked && <div key={picked} className="fit-in mt-4" data-testid="fit-body-results">
      <div className="flex items-end justify-between gap-2 px-1">
        <div className="min-w-0"><p className="text-[30px] leading-none" style={display}>{PART_NAME[picked]}</p>
          <p className="mt-1 text-[13px]" style={{ color: C.dim }}><span style={{ color: recColor(rec[picked].pct), fontWeight: 700 }}>{rec[picked].pct}% recovered</span> · {ago(rec[picked].last)}</p></div>
        {quick.length >= 2 && <Btn className="!min-h-10 shrink-0 !px-3 !text-[15px]" onClick={() => onStart(`${PART_NAME[picked]} blast`, quick.map((e) => ({ exId: e.id, sets: 3, reps: e.equipment === "bodyweight" ? "10-15" : "8-12", rest: 90 })))} testId="fit-body-start"><Play className="h-4 w-4" fill="currentColor" />Train it</Btn>}
      </div>
      <div className="mt-3"><Chips label="Equipment" value={equip} onChange={setEquip} items={EQUIP.map((m) => ({ id: m, label: m === "any" ? "Any equipment" : m[0].toUpperCase() + m.slice(1) }))} /></div>
      <ul className="mt-3 space-y-2">{exercises.map((e, k) => <li key={`${picked}-${equip}-${e.id}`} className="fit-slide" style={stagger(Math.min(k, 10), 0.05)}><button type="button" onClick={() => onOpen(e)} className="flex w-full items-center gap-3 rounded-[14px] p-2.5 text-left transition-transform active:scale-[.98]" style={{ background: C.card, boxShadow: `inset 0 0 0 1px ${C.line}` }} data-testid={`fit-body-ex-${e.id}`}>
        {videoFor(e.id) ? <VideoThumb exId={e.id} className="h-14 w-[84px] rounded-[10px]" /> : <span className="grid h-14 w-[84px] shrink-0 place-items-center rounded-[10px] text-[11px] font-semibold uppercase" style={{ background: C.card2, color: C.dim }}>{e.equipment}</span>}
        <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold">{e.name}</span><span className="block truncate text-[12px] capitalize" style={{ color: C.dim }}>{e.muscle === picked ? "Main mover" : `Also works ${picked}`} · {e.equipment}</span></span>
        <ChevronRight className="h-4 w-4 shrink-0" style={{ color: C.dim }} />
      </button></li>)}</ul>
      {!exercises.length && <p className="mt-4 text-center text-[14px]" style={{ color: C.dim }}>Nothing with that equipment. Try another.</p>}
    </div>}
    <Title>All muscles</Title>
    <Card className="!p-1.5">{ordered.map((p, k) => <button key={p} type="button" onClick={() => pick(p)} aria-pressed={picked === p} className="flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-left" style={{ ...(k ? { borderTop: `1px solid ${C.line}` } : {}), ...(picked === p ? { background: C.tint } : {}) }} data-testid={`fit-body-${p}`}>
      <span className="w-24 shrink-0 text-[15px] font-semibold">{PART_NAME[p]}</span>
      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: C.track }}><span className="fit-bar block h-full rounded-full" style={{ width: `${rec[p].pct}%`, background: recColor(rec[p].pct), ...stagger(k, 0.04) }} /></span>
      <span className="w-11 text-right text-[15px] tabular-nums" style={display}>{rec[p].pct}%</span>
    </button>)}</Card>
    <p className="mt-3 px-1 text-[12px] leading-relaxed" style={{ color: C.dim }}>Recovery comes from the sets you logged this past week: a muscle you trained hard takes two to three days to be fresh again, and bigger muscles take longer than small ones.</p>
  </Sheet>;
}
