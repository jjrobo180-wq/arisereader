// Arise Fit's body map: a front and back figure with every trainable muscle group drawn as its own
// shape. Tap one and the exercises for it appear underneath (with their how-to videos), plus a
// one-tap workout built for that muscle.
import { useMemo, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { CATALOG_BY_ID, type Muscle } from "@shared/fit";
import { videoFor } from "@shared/fitVideos";
import type { LibraryExercise } from "./fitStore";
import { Btn, C, Chips, Sheet, display, stagger } from "./fitUi";
import { VideoThumb } from "./FitVideo";

export type BodyPart = Extract<Muscle, "chest" | "back" | "shoulders" | "biceps" | "triceps" | "forearms" | "abs" | "quads" | "hamstrings" | "glutes" | "calves">;

/** Each muscle's outline on the left half of the figure (the right half is drawn as its mirror). */
const FRONT: { part: BodyPart; d: string }[] = [
  { part: "back", d: "M93 58 L79 70 L92 73 Z" },
  { part: "shoulders", d: "M76 70 C63 72 55 82 55 96 C58 104 64 106 70 104 C72 92 76 83 85 76 Z" },
  { part: "chest", d: "M87 76 C80 80 75 92 75 104 C81 116 94 118 99 112 L99 78 C95 75 91 75 87 76 Z" },
  { part: "biceps", d: "M57 106 C51 117 49 132 51 145 C56 149 62 147 66 141 C68 128 68 115 66 107 C62 109 59 108 57 106 Z" },
  { part: "forearms", d: "M50 151 C45 166 41 185 41 200 C45 204 50 204 52 200 C58 185 63 168 66 148 C60 152 55 153 50 151 Z" },
  { part: "abs", d: "M77 119 C75 137 77 160 82 183 L87 185 L87 121 C84 119 80 118 77 119 Z" },
  { part: "abs", d: "M89 121 H99 V136 H89 Z M89 139 H99 V154 H89 Z M89 157 H99 V172 H89 Z M89 175 H99 V196 C95 196 91 192 89 186 Z" },
  { part: "quads", d: "M81 202 C72 230 70 262 74 291 C80 299 90 299 96 291 C99 265 99 232 98 207 C92 199 87 198 81 202 Z" },
  { part: "calves", d: "M77 306 C73 330 73 360 77 391 C81 395 86 395 88 391 C92 362 94 332 92 306 C86 302 81 302 77 306 Z" },
];
const BACK: { part: BodyPart; d: string }[] = [
  { part: "back", d: "M100 58 L86 66 L75 74 L90 84 L100 112 Z" },
  { part: "shoulders", d: "M74 72 C62 74 55 84 55 97 C58 104 64 106 70 104 C72 93 75 85 82 79 Z" },
  { part: "back", d: "M79 88 C75 105 77 127 85 146 C91 156 96 160 99 160 L99 116 L90 90 Z" },
  { part: "back", d: "M89 163 C89 175 91 186 93 194 L99 196 L99 165 Z" },
  { part: "triceps", d: "M57 106 C51 117 49 132 51 145 C56 149 62 147 66 141 C68 128 68 115 66 107 C62 109 59 108 57 106 Z" },
  { part: "forearms", d: "M50 151 C45 166 41 185 41 200 C45 204 50 204 52 200 C58 185 63 168 66 148 C60 152 55 153 50 151 Z" },
  { part: "glutes", d: "M81 197 C74 211 76 230 86 238 C94 242 99 238 99 230 L99 201 C92 196 87 195 81 197 Z" },
  { part: "hamstrings", d: "M79 245 C73 266 73 287 77 301 C83 307 92 305 96 297 C98 280 98 261 97 247 C90 243 85 242 79 245 Z" },
  { part: "calves", d: "M77 314 C71 330 71 350 77 368 C81 384 88 384 90 368 C94 350 94 330 90 314 C86 308 81 308 77 314 Z" },
];
/** The body underneath the muscles (left half), so the figure reads as a person. */
const SILHOUETTE = "M100 12 C88 12 82 22 82 34 C82 46 88 54 92 58 L92 64 C84 68 70 68 60 74 C50 80 48 94 48 104 C44 124 42 140 42 150 C36 170 32 188 33 204 C31 216 36 226 44 226 C52 224 54 212 54 204 C60 186 66 168 70 150 C72 140 74 128 75 120 C75 150 76 176 78 196 C70 228 66 262 70 296 C66 330 66 362 70 396 C68 410 72 418 82 418 C90 418 92 410 90 396 C94 362 96 330 96 304 C98 270 99 240 100 214 Z";

const NAMES: Record<BodyPart, string> = { chest: "Chest", back: "Back & traps", shoulders: "Shoulders", biceps: "Biceps", triceps: "Triceps", forearms: "Forearms", abs: "Abs & obliques", quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes", calves: "Calves" };
const EQUIP = ["any", "barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "band"] as const;

function Figure({ shapes, picked, onPick, label }: { shapes: typeof FRONT; picked: BodyPart | null; onPick: (p: BodyPart) => void; label: string }) {
  const fill = (p: BodyPart) => (p === picked ? "url(#fitMuscleOn)" : "url(#fitMuscle)");
  const shape = (s: (typeof FRONT)[number], k: string, mirror: boolean) => <path key={k} d={s.d} transform={mirror ? "translate(200 0) scale(-1 1)" : undefined}
    fill={fill(s.part)} stroke={s.part === picked ? "#ffb08a" : "#3b3f45"} strokeWidth={s.part === picked ? 1.4 : 1} strokeLinejoin="round"
    className="cursor-pointer transition-[fill,stroke] duration-300" onClick={() => onPick(s.part)} role="button" aria-label={NAMES[s.part]} aria-pressed={s.part === picked} />;
  return <figure className="m-0 flex min-w-0 flex-1 flex-col items-center">
    <svg viewBox="20 4 160 424" className="h-[340px] w-full max-w-[170px]" role="group" aria-label={`${label} of the body`}>
      <defs>
        <linearGradient id="fitMuscle" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3a3e44" /><stop offset="1" stopColor="#24272b" /></linearGradient>
        <linearGradient id="fitMuscleOn" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ff7a3d" /><stop offset="1" stopColor="#d9400c" /></linearGradient>
        <filter id="fitGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3.5" /></filter>
      </defs>
      <path d={SILHOUETTE} fill="#16181b" stroke="#2a2d32" />
      <path d={SILHOUETTE} transform="translate(200 0) scale(-1 1)" fill="#16181b" stroke="#2a2d32" />
      <ellipse cx="100" cy="34" rx="15" ry="19" fill="#1f2226" />
      {picked && shapes.filter((s) => s.part === picked).map((s, i) => <g key={`g${i}`} filter="url(#fitGlow)" opacity=".55" pointerEvents="none"><path d={s.d} fill="#ff5a1f" /><path d={s.d} transform="translate(200 0) scale(-1 1)" fill="#ff5a1f" /></g>)}
      {shapes.map((s, i) => shape(s, `l${i}`, false))}
      {shapes.map((s, i) => shape(s, `r${i}`, true))}
    </svg>
    <figcaption className="mt-1 text-[13px] tracking-[.14em]" style={{ ...display, fontWeight: 700, color: C.dim }}>{label}</figcaption>
  </figure>;
}

export function BodyMap({ list, onClose, onOpen, onStart }: { list: LibraryExercise[]; onClose: () => void; onOpen: (e: LibraryExercise) => void; onStart: (name: string, items: { exId: string; sets: number; reps: string; rest: number }[]) => void }) {
  const [picked, setPicked] = useState<BodyPart | null>(null);
  const [equip, setEquip] = useState<(typeof EQUIP)[number]>("any");
  const exercises = useMemo(() => !picked ? [] : list
    .filter((e) => (e.muscle === picked || e.also.includes(picked)) && (equip === "any" || e.equipment === equip))
    .sort((a, b) => Number(b.muscle === picked) - Number(a.muscle === picked) || Number(!!videoFor(b.id)) - Number(!!videoFor(a.id)) || Number(b.source === "arise") - Number(a.source === "arise") || a.name.localeCompare(b.name))
    .slice(0, 60), [list, picked, equip]);
  // A quick session: the best four main movers for the muscle, compounds first.
  const quick = exercises.filter((e) => e.muscle === picked && e.source === "arise" && !CATALOG_BY_ID.get(e.id)?.timed).slice(0, 4);
  return <Sheet title="Body map" onClose={onClose} testId="fit-body-map" right={picked ? <button type="button" onClick={() => setPicked(null)} aria-label="Clear" className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card }}><RotateCcw className="h-5 w-5" /></button> : undefined}>
    <p className="mt-1 text-center text-[14px]" style={{ color: C.dim }}>Tap a muscle to see what trains it.</p>
    <div className="mt-2 flex gap-2"><Figure shapes={FRONT} picked={picked} onPick={setPicked} label="Front" /><Figure shapes={BACK} picked={picked} onPick={setPicked} label="Back" /></div>
    <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {(Object.keys(NAMES) as BodyPart[]).map((p) => <button key={p} type="button" onClick={() => setPicked(p)} aria-pressed={picked === p} className="h-9 shrink-0 rounded-[8px] px-3 text-[14px] uppercase tracking-[.06em]" style={{ fontFamily: display.fontFamily, fontWeight: 800, transition: "background .2s, color .2s", ...(picked === p ? { background: C.lime, color: "#0b0b0c" } : { background: C.card, color: C.text }) }} data-testid={`fit-body-${p}`}>{NAMES[p]}</button>)}
    </div>
    {picked && <div key={picked} className="fit-in mt-5" data-testid="fit-body-results">
      <div className="flex items-end justify-between px-1">
        <div><p className="text-[30px] leading-none" style={display}>{NAMES[picked]}</p><p className="mt-1 text-[13px]" style={{ color: C.dim }}>{exercises.length} exercises</p></div>
        {quick.length >= 2 && <Btn className="!min-h-10" onClick={() => onStart(`${NAMES[picked]} blast`, quick.map((e) => ({ exId: e.id, sets: 3, reps: e.equipment === "bodyweight" ? "10-15" : "8-12", rest: 90 })))} testId="fit-body-start"><Play className="h-4 w-4" />Train it</Btn>}
      </div>
      <div className="mt-3"><Chips label="Equipment" value={equip} onChange={setEquip} items={EQUIP.map((m) => ({ id: m, label: m === "any" ? "Any equipment" : m[0].toUpperCase() + m.slice(1) }))} /></div>
      <ul className="mt-3 space-y-2">{exercises.map((e, k) => <li key={`${picked}-${equip}-${e.id}`} className="fit-slide" style={stagger(Math.min(k, 10), 0.07)}><button type="button" onClick={() => onOpen(e)} className="flex w-full items-center gap-3 rounded-[12px] p-2.5 text-left active:scale-[.98] transition-transform" style={{ background: C.card }} data-testid={`fit-body-ex-${e.id}`}>
        {videoFor(e.id) ? <VideoThumb exId={e.id} /> : <span className="grid h-14 w-[88px] shrink-0 place-items-center rounded-[8px]" style={{ background: C.card2, color: C.dim }}>—</span>}
        <span className="min-w-0"><span className="block truncate text-[15px] font-semibold">{e.name}</span><span className="block truncate text-[12px] capitalize" style={{ color: C.dim }}>{e.muscle === picked ? "Main mover" : `Also works ${picked}`} · {e.equipment}</span></span>
      </button></li>)}</ul>
      {!exercises.length && <p className="mt-4 text-center text-[14px]" style={{ color: C.dim }}>Nothing with that equipment. Try another.</p>}
    </div>}
  </Sheet>;
}
