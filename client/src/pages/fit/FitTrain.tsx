// Arise Fit training: the exercise library, the live workout (sets, rest timer, records, what to lift
// next time), programs, routines and history.
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Clock3, Dumbbell, Flame, History, Minus, Play, PlayCircle, Plus, Search, Timer, Trash2, Trophy } from "lucide-react";
import {
  CATALOG, CATALOG_BY_ID, PROGRAMS, PROGRAM_BY_ID, e1rm, fromKg, lastTime, newRecords, nextProgramDay, nextTime, plates, records, repRange, uid,
  type FitData, type FitExercise, type Program, type Routine, type Units, type Workout,
} from "@shared/fit";
import { videoFor } from "@shared/fitVideos";
import { SESSION_BY_ID, nextC25K, sessionMins, sessionsIn, type Session, type SessionCategory } from "@shared/fitSessions";
import { BodyMap } from "./FitBody";
import { SessionPlayer } from "./FitSession";
import { OutdoorHub } from "./FitRun";
import { FormCheck } from "./FitForm";
import { saveToHealth } from "./fitNative";
import type { LibraryExercise, Update } from "./fitStore";
import { CoverCard, VideoPlayer, VideoThumb } from "./FitVideo";
import { Btn, C, Card, Chips, Sheet, Spark, Title, fmtDur, fmtNum, glowBg, inputCls, inputStyle, display, stagger } from "./fitUi";

export const libraryFallback = (): LibraryExercise[] => CATALOG.map((e) => ({ ...e, images: [], source: "arise" as const }));
const MUSCLES = ["all", "chest", "back", "shoulders", "biceps", "triceps", "abs", "quads", "hamstrings", "glutes", "calves", "full body", "cardio"] as const;
const EQUIP = ["any", "barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "band"] as const;
const ACTIVE = "arise-fit-active";

/** The exercise's photos, cross-fading between positions so the movement shows. */
export function Demo({ ex, size = "lg" }: { ex: LibraryExercise; size?: "sm" | "lg" }) {
  const [i, setI] = useState(0);
  const video = size === "sm" && !!videoFor(ex.id);
  useEffect(() => {
    if (video || ex.images.length < 2 || size === "sm") return;
    const t = window.setInterval(() => setI((x) => (x + 1) % ex.images.length), 1100);
    return () => window.clearInterval(t);
  }, [ex.images.length, size]);
  if (video) return <VideoThumb exId={ex.id} />;
  const box = size === "sm" ? "h-14 w-14 rounded-[10px]" : "aspect-[4/3] w-full rounded-[14px]";
  if (!ex.images.length) return <div className={`${box} grid shrink-0 place-items-center`} style={{ background: `linear-gradient(150deg, ${C.card2}, #24243a)` }} aria-hidden>
    <Dumbbell className={size === "sm" ? "h-6 w-6" : "h-14 w-14"} style={{ color: C.lime }} />
  </div>;
  return <div className={`${box} relative shrink-0 overflow-hidden bg-white`} aria-label={`${ex.name} demonstration`} role="img">
    {ex.images.map((im, k) => <img key={im.url} src={im.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain transition-opacity duration-500" style={{ opacity: k === i ? 1 : 0 }} />)}
  </div>;
}

export function ExerciseDetail({ ex, data, onClose, onAdd }: { ex: LibraryExercise; data: FitData; onClose: () => void; onAdd?: () => void }) {
  const u = data.profile.units;
  const history = useMemo(() => data.workouts.filter((w) => w.exercises.some((e) => e.exId === ex.id)).map((w) => {
    const e = w.exercises.find((x) => x.exId === ex.id)!;
    return { date: w.date, best: Math.max(0, ...e.sets.filter((s) => s.done && !s.warm).map((s) => e1rm(s.weight, s.reps))), sets: e.sets.filter((s) => s.done) };
  }), [data.workouts, ex.id]);
  const rec = records(data.workouts).get(ex.id);
  return <Sheet title={ex.name} onClose={onClose} testId="fit-exercise">
    {videoFor(ex.id) ? <VideoPlayer exId={ex.id} /> : <Demo ex={ex} />}
    {!videoFor(ex.id) && ex.images[0] && <p className="mt-2 text-[11px]" style={{ color: C.dim }}>Photos: {[...new Set(ex.images.map((i) => i.credit))].join(", ")} · {ex.images[0].license} · via wger.de</p>}
    <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
      <span className="rounded-full px-3 py-1 font-semibold capitalize" style={{ background: C.card2, color: C.lime }}>{ex.muscle}</span>
      {ex.also.map((m) => <span key={m} className="rounded-full px-3 py-1 capitalize" style={{ background: C.card2 }}>{m}</span>)}
      <span className="rounded-full px-3 py-1 capitalize" style={{ background: C.card2 }}>{ex.equipment}</span>
    </div>
    {ex.cues.length > 0 && <><Title>How to do it</Title><Card><ol className="space-y-2.5">{ex.cues.map((c, k) => <li key={k} className="flex gap-3 text-[15px] leading-snug"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold" style={{ background: C.lime, color: "#0b0b0c" }}>{k + 1}</span>{c}</li>)}</ol></Card></>}
    {rec && <><Title>Your records</Title><div className="grid grid-cols-3 gap-2">
      <Card className="!p-3"><p className="text-[11px]" style={{ color: C.dim }}>Est. 1-rep max</p><p className="text-[20px] font-bold">{fmtNum(rec.e1rm)}<span className="text-[12px]" style={{ color: C.dim }}> {u}</span></p></Card>
      <Card className="!p-3"><p className="text-[11px]" style={{ color: C.dim }}>Heaviest</p><p className="text-[20px] font-bold">{fmtNum(rec.weight)}<span className="text-[12px]" style={{ color: C.dim }}> ×{rec.reps}</span></p></Card>
      <Card className="!p-3"><p className="text-[11px]" style={{ color: C.dim }}>Best volume</p><p className="text-[20px] font-bold">{fmtNum(rec.volume)}</p></Card>
    </div></>}
    {history.length > 1 && <><Title>Progress</Title><Card><Spark points={history.filter((h) => h.best).map((h) => ({ x: h.date.slice(5, 10), y: h.best }))} label={(y) => `${Math.round(y)} ${u}`} /></Card></>}
    {history.length > 0 && <><Title>History</Title><div className="space-y-2">{history.slice(-8).reverse().map((h) => <Card key={h.date} className="!p-3">
      <p className="text-[13px] font-semibold">{new Date(h.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p>
      <p className="mt-0.5 text-[13px]" style={{ color: C.dim }}>{h.sets.map((s) => `${fmtNum(s.weight)}×${s.reps}`).join("  ·  ")}</p>
    </Card>)}</div></>}
    {onAdd && <div className="sticky bottom-0 mt-6 pb-2 pt-3" style={{ background: C.bg }}><Btn onClick={onAdd} className="w-full" testId="fit-exercise-add"><Plus className="h-5 w-5" />Add to workout</Btn></div>}
  </Sheet>;
}

export function Library({ list, data, onClose, onPick, title = "Exercises" }: { list: LibraryExercise[]; data: FitData; onClose: () => void; onPick?: (e: LibraryExercise) => void; title?: string }) {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<(typeof MUSCLES)[number]>("all");
  const [equip, setEquip] = useState<(typeof EQUIP)[number]>("any");
  const [videosOnly, setVideosOnly] = useState(false);
  const [open, setOpen] = useState<LibraryExercise | null>(null);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return list.filter((e) => (muscle === "all" || e.muscle === muscle || e.also.includes(muscle as never)) && (equip === "any" || e.equipment === equip) && (!t || e.name.toLowerCase().includes(t)) && (!videosOnly || !!videoFor(e.id)))
      .sort((a, b) => Number(b.source === "arise") - Number(a.source === "arise") || a.name.localeCompare(b.name)).slice(0, 300);
  }, [list, q, muscle, equip, videosOnly]);
  return <Sheet title={title} onClose={onClose} testId="fit-library">
    <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: C.dim }} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${list.length} exercises`} className={`${inputCls} pl-10`} style={inputStyle} data-testid="fit-library-search" /></div>
    <div className="mt-3 space-y-2">
      <Chips label="Muscle" value={muscle} onChange={setMuscle} items={MUSCLES.map((m) => ({ id: m, label: m === "all" ? "All muscles" : m[0].toUpperCase() + m.slice(1) }))} />
      <Chips label="Equipment" value={equip} onChange={setEquip} items={EQUIP.map((m) => ({ id: m, label: m === "any" ? "Any equipment" : m[0].toUpperCase() + m.slice(1) }))} />
    </div>
    <div className="mb-2 mt-3 flex items-center justify-between">
      <p className="text-[12px]" style={{ color: C.dim }}>{shown.length === 300 ? "300+" : shown.length} exercises</p>
      <button type="button" onClick={() => setVideosOnly((v) => !v)} aria-pressed={videosOnly} className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold" style={videosOnly ? { background: C.lime, color: "#0b0b0c" } : { background: C.card, color: C.text }} data-testid="fit-videos-only"><PlayCircle className="h-4 w-4" />With video</button>
    </div>
    <ul className="space-y-2">{shown.map((e) => <li key={e.id}>
      <div className="flex items-center gap-3 rounded-[12px] p-2" style={{ background: C.card }}>
        <button type="button" onClick={() => setOpen(e)} className="flex min-w-0 flex-1 items-center gap-3 text-left" data-testid={`fit-ex-${e.id}`}>
          <Demo ex={e} size="sm" />
          <span className="min-w-0"><span className="block truncate text-[15px] font-semibold">{e.name}</span><span className="block truncate text-[12px] capitalize" style={{ color: C.dim }}>{e.muscle} · {e.equipment}</span>{videoFor(e.id) && <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold" style={{ color: C.lime }}><PlayCircle className="h-3 w-3" />How-to video</span>}</span>
        </button>
        {onPick && <button type="button" onClick={() => onPick(e)} aria-label={`Add ${e.name}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: C.lime, color: "#0b0b0c" }}><Plus className="h-5 w-5" /></button>}
      </div>
    </li>)}</ul>
    {open && <ExerciseDetail ex={open} data={data} onClose={() => setOpen(null)} onAdd={onPick ? () => { onPick(open); setOpen(null); } : undefined} />}
  </Sheet>;
}

// ——— The live workout ——————————————————————————————————————————————————————————————————————————

type Active = { id: string; name: string; started: number; programId?: string; dayId?: string; exercises: FitExercise[] };
export const readActive = (): Active | null => { try { return JSON.parse(localStorage.getItem(ACTIVE) || "null"); } catch { return null; } };
const saveActive = (a: Active | null) => { try { if (a) localStorage.setItem(ACTIVE, JSON.stringify(a)); else localStorage.removeItem(ACTIVE); } catch { /* kept in memory */ } };

/** A new workout's exercises, with last time's weights filled in (and the suggested weight). */
export function planned(data: FitData, items: { exId: string; name?: string; sets: number; reps: string; rest: number }[], list: LibraryExercise[]): FitExercise[] {
  return items.map((it) => {
    const ex = list.find((e) => e.id === it.exId) ?? CATALOG_BY_ID.get(it.exId);
    const last = lastTime(data.workouts, it.exId);
    const sug = nextTime(last, it.reps, data.profile.units, !!ex?.lower);
    const { hi, secs } = repRange(it.reps);
    return { exId: it.exId, name: it.name || ex?.name || it.exId, rest: it.rest, target: it.reps,
      sets: Array.from({ length: it.sets }, () => ({ reps: secs ? secs : hi === 99 ? 0 : hi, weight: sug?.weight ?? 0, done: false })) };
  });
}

export function startWorkout(a: Omit<Active, "id" | "started">): Active { const w = { ...a, id: uid(), started: Date.now() }; saveActive(w); return w; }

export function LiveWorkout({ active, setActive, data, update, list, say }: { active: Active; setActive: (a: Active | null) => void; data: FitData; update: Update; list: LibraryExercise[]; say: (m: string) => void }) {
  const u: Units = data.profile.units;
  const [now, setNow] = useState(Date.now());
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<LibraryExercise | null>(null);
  const [plateFor, setPlateFor] = useState<number | null>(null);
  const [done, setDone] = useState<null | { w: Workout; prs: ReturnType<typeof newRecords> }>(null);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 500); return () => window.clearInterval(t); }, []);
  const set = (fn: (a: Active) => Active) => { const n = fn(active); saveActive(n); setActive(n); };
  const left = rest ? Math.max(0, Math.ceil((rest.until - now) / 1000)) : 0;
  const buzzed = useRef(false);
  useEffect(() => { if (rest && left === 0 && !buzzed.current) { buzzed.current = true; navigator.vibrate?.([200, 100, 200]); say("Rest's over. Next set!"); } if (left > 0) buzzed.current = false; }, [left, rest, say]);

  const edit = (ei: number, si: number, patch: Partial<FitExercise["sets"][number]>) => set((a) => ({ ...a, exercises: a.exercises.map((e, k) => k !== ei ? e : { ...e, sets: e.sets.map((s, j) => j !== si ? s : { ...s, ...patch }) }) }));
  const tick = (ei: number, si: number) => {
    const s = active.exercises[ei].sets[si];
    edit(ei, si, { done: !s.done });
    if (!s.done) { const secs = active.exercises[ei].rest ?? 90; if (secs > 0) setRest({ until: Date.now() + secs * 1000, total: secs }); navigator.vibrate?.(30); }
  };
  const finish = () => {
    const exercises = active.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) })).filter((e) => e.sets.length);
    if (!exercises.length) { if (window.confirm("No sets are checked off. Discard this workout?")) { saveActive(null); setActive(null); } return; }
    const w: Workout = { id: active.id, date: new Date(active.started).toISOString(), name: active.name, ...(active.programId ? { programId: active.programId, dayId: active.dayId } : {}), secs: Math.round((Date.now() - active.started) / 1000), exercises };
    const prs = newRecords(data.workouts, w);
    saveToHealth("calories", Math.round((w.secs / 60) * 6), new Date(active.started));
    update((d) => ({ ...d, workouts: [...d.workouts, w], ...(d.program && active.programId === d.program.id && active.dayId ? { program: { ...d.program, done: [...d.program.done, `${active.dayId}@${w.date.slice(0, 10)}`] } } : {}) }));
    saveActive(null); setDone({ w, prs });
  };
  if (done) {
    const vol = done.w.exercises.reduce((t, e) => t + e.sets.reduce((x, s) => x + s.reps * s.weight, 0), 0);
    const top = done.prs[0];
    return <div className="fixed inset-0 z-[80] flex flex-col overflow-y-auto px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))]" style={{ background: glowBg, color: C.text }} role="dialog" aria-modal="true" aria-label="Workout complete" data-testid="fit-summary">
      <div className="flex min-h-[62vh] flex-col items-center justify-center text-center">
        <div className="fit-pop grid h-[104px] w-[104px] place-items-center rounded-full" style={{ background: C.lime, boxShadow: "0 0 60px rgba(255,90,31,.5)" }}><Trophy className="h-[52px] w-[52px]" style={{ color: "#0b0b0c" }} /></div>
        <h2 className="fit-in mt-6 text-[56px] leading-none" style={{ ...display, animationDelay: ".2s" }}>Done.</h2>
        <p className="fit-in mt-2 text-[15px]" style={{ color: C.steel, animationDelay: ".3s" }}>{top ? `New record: ${top.name} ${fmtNum(top.value)} ${u}` : done.w.name}</p>
        <div className="mt-6 grid w-full grid-cols-3 gap-2 text-center">
          <Card className="!p-3" style={stagger(0, 0, 0.4)}><p className="text-[26px] leading-none tabular-nums" style={display}>{fmtDur(done.w.secs)}</p><p className="mt-1 text-[11px] uppercase" style={{ color: C.dim }}>Time</p></Card>
          <Card className="!p-3" style={stagger(0, 0, 0.48)}><p className="text-[26px] leading-none tabular-nums" style={display}>{fmtNum(vol)}</p><p className="mt-1 text-[11px] uppercase" style={{ color: C.dim }}>{u} lifted</p></Card>
          <Card className="!p-3" style={stagger(0, 0, 0.56)}><p className="text-[26px] leading-none tabular-nums" style={display}>{done.w.exercises.reduce((t, e) => t + e.sets.length, 0)}</p><p className="mt-1 text-[11px] uppercase" style={{ color: C.dim }}>Sets</p></Card>
        </div>
      </div>
      {done.prs.length > 0 && <><Title>New records</Title><div className="space-y-2">{done.prs.map((p, k) => <Card key={p.exId + p.kind} className="flex items-center gap-3 !p-3" style={stagger(k, 0.08, 0.6)}><Trophy className="h-6 w-6" style={{ color: C.orange }} />
        <div><p className="font-semibold">{p.name}</p><p className="text-[13px]" style={{ color: C.dim }}>{p.kind === "e1rm" ? `Est. 1-rep max ${fmtNum(p.value)} ${u}` : p.kind === "weight" ? `Heaviest ${fmtNum(p.value)} ${u}` : `Most volume ${fmtNum(p.value)} ${u}`}</p></div></Card>)}</div></>}
      <Btn onClick={() => setActive(null)} className="mt-8 w-full !min-h-[52px] !text-[19px]" testId="fit-summary-done">Back to today</Btn>
    </div>;
  }
  const allSets = active.exercises.reduce((t, e) => t + e.sets.length, 0);
  const doneSets = active.exercises.reduce((t, e) => t + e.sets.filter((s) => s.done).length, 0);
  return <div className="fit-sheet fixed inset-0 z-[70] flex flex-col" style={{ background: glowBg, backgroundColor: C.bg, color: C.text }} data-testid="fit-live">
    <div className="shrink-0 px-4 pb-2 pt-[max(10px,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1"><input value={active.name} onChange={(e) => set((a) => ({ ...a, name: e.target.value.slice(0, 80) }))} aria-label="Workout name" className="w-full bg-transparent text-[30px] leading-none outline-none" style={display} />
          <p className="mt-1 flex items-center gap-1 text-[13px] tabular-nums" style={{ color: C.dim }}><Clock3 className="h-3.5 w-3.5" />{fmtDur((now - active.started) / 1000)} · {doneSets} of {allSets} sets</p></div>
        <Btn onClick={finish} testId="fit-finish">Finish</Btn>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.08)" }}><div className="h-full rounded-full" style={{ width: `${allSets ? (doneSets / allSets) * 100 : 0}%`, background: C.lime, transition: "width .4s ease" }} /></div>
    </div>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-40">
      {active.exercises.map((e, ei) => {
        const ex = list.find((x) => x.id === e.exId) ?? libraryFallback().find((x) => x.id === e.exId);
        const last = lastTime(data.workouts, e.exId);
        const sug = nextTime(last, e.target || "8-12", u, !!ex?.lower);
        const timed = !!ex && (CATALOG_BY_ID.get(e.exId)?.timed || repRange(e.target || "").secs);
        return <Card key={ei} className="!p-3" style={stagger(ei, 0.07, 0.1)}>
          <div className="flex items-start gap-3">
            {ex && <button type="button" onClick={() => setDetail(ex)} aria-label={`How to do ${e.name}`}><Demo ex={ex} size="sm" /></button>}
            <div className="min-w-0 flex-1"><p className="text-[20px] leading-tight" style={{ ...display, color: C.lime }}>{e.name}</p>
              {e.target && <p className="text-[12px]" style={{ color: C.dim }}>Target {e.target}{timed ? "" : " reps"} · rest {e.rest ?? 90}s</p>}
              {sug && <p className="mt-0.5 text-[12px]" style={{ color: C.text }}>{sug.why}</p>}
              {ex && videoFor(ex.id) && <button type="button" onClick={() => setDetail(ex)} className="mt-1.5 flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold" style={{ background: "rgba(255,90,31,.12)", color: C.lime }} data-testid={`fit-live-video-${ei}`}><PlayCircle className="h-3.5 w-3.5" />Watch form</button>}</div>
            <button type="button" onClick={() => set((a) => ({ ...a, exercises: a.exercises.filter((_, k) => k !== ei) }))} aria-label={`Remove ${e.name}`} className="grid h-9 w-9 place-items-center rounded-full" style={{ color: C.dim }}><Trash2 className="h-4 w-4" /></button>
          </div>
          <div className="mt-3 grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2.75rem] items-center gap-1.5 text-center text-[11px] font-semibold uppercase" style={{ color: C.dim }}>
            <span>Set</span><span>Last</span><span>{timed ? "Secs" : u}</span><span>{timed ? "" : "Reps"}</span><span />
          </div>
          {e.sets.map((s, si) => {
            const prev = last?.sets.filter((x) => !x.warm)[si];
            return <div key={si} className="mt-1.5 grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2.75rem] items-center gap-1.5 rounded-[10px] px-0.5 py-0.5 transition-colors duration-300" style={{ background: s.done ? "rgba(255,90,31,.14)" : "transparent" }}>
              <button type="button" onClick={() => edit(ei, si, { warm: !s.warm })} className="text-center text-[14px] font-bold" style={{ color: s.warm ? C.orange : C.text }} aria-label={s.warm ? "Warm-up set" : `Set ${si + 1}`}>{s.warm ? "W" : si + 1}</button>
              <span className="truncate text-center text-[13px]" style={{ color: C.dim }}>{prev ? (timed ? `${prev.reps}s` : `${fmtNum(prev.weight)}×${prev.reps}`) : "—"}</span>
              {timed ? <input inputMode="numeric" value={s.reps || ""} onChange={(ev) => edit(ei, si, { reps: Number(ev.target.value.replace(/\D/g, "")) || 0 })} aria-label="Seconds" className="h-11 w-full min-w-0 rounded-[10px] text-center text-[17px] font-semibold outline-none" style={inputStyle} />
                : <input inputMode="decimal" value={s.weight || ""} placeholder="0" onChange={(ev) => edit(ei, si, { weight: Number(ev.target.value.replace(/[^\d.]/g, "")) || 0 })} onDoubleClick={() => setPlateFor(s.weight)} aria-label={`Weight in ${u}`} className="h-11 w-full min-w-0 rounded-[10px] text-center text-[17px] font-semibold outline-none" style={inputStyle} />}
              {timed ? <span /> : <input inputMode="numeric" value={s.reps || ""} placeholder="0" onChange={(ev) => edit(ei, si, { reps: Number(ev.target.value.replace(/\D/g, "")) || 0 })} aria-label="Reps" className="h-11 w-full min-w-0 rounded-[10px] text-center text-[17px] font-semibold outline-none" style={inputStyle} />}
              <button type="button" onClick={() => tick(ei, si)} aria-label={s.done ? "Mark not done" : "Mark done"} aria-pressed={s.done} data-testid={`fit-set-${ei}-${si}`}
                className="grid h-11 w-11 place-items-center rounded-[10px] transition-colors duration-200" style={s.done ? { background: C.lime, color: "#0b0b0c" } : { background: C.card2, color: C.dim }}><Check key={s.done ? "on" : "off"} className={`h-5 w-5 ${s.done ? "fit-tick" : ""}`} strokeWidth={3} /></button>
            </div>;
          })}
          <div className="mt-2 flex gap-2">
            <Btn kind="soft" className="flex-1 !min-h-10 text-[14px]" onClick={() => set((a) => ({ ...a, exercises: a.exercises.map((x, k) => k !== ei ? x : { ...x, sets: [...x.sets, { ...(x.sets[x.sets.length - 1] ?? { reps: 10, weight: 0 }), done: false, warm: false }] }) }))}><Plus className="h-4 w-4" />Add set</Btn>
            {e.sets.length > 1 && <Btn kind="soft" className="!min-h-10 text-[14px]" onClick={() => set((a) => ({ ...a, exercises: a.exercises.map((x, k) => k !== ei ? x : { ...x, sets: x.sets.slice(0, -1) }) }))}><Minus className="h-4 w-4" /></Btn>}
            {!timed && <Btn kind="soft" className="!min-h-10 text-[14px]" onClick={() => setPlateFor(Math.max(...e.sets.map((x) => x.weight), 0))}>Plates</Btn>}
          </div>
        </Card>;
      })}
      <Btn kind="soft" onClick={() => setAdding(true)} className="w-full" testId="fit-add-exercise"><Plus className="h-5 w-5" />Add exercise</Btn>
      <button type="button" onClick={() => { if (window.confirm("Discard this workout? Nothing will be saved.")) { saveActive(null); setActive(null); } }} className="h-12 w-full text-[15px] font-semibold" style={{ color: C.red }}>Discard workout</button>
    </div>
    {rest && left > 0 && <div className="fit-up fixed inset-x-3 z-[75] rounded-[16px] p-3.5" style={{ bottom: "max(16px, env(safe-area-inset-bottom))", background: C.card2, boxShadow: "0 -10px 40px rgba(0,0,0,.6)" }} data-testid="fit-rest">
      <div className="flex items-center gap-3"><Timer className="h-6 w-6" style={{ color: C.lime }} />
        <div className="min-w-0 flex-1"><p className="text-[12px] uppercase" style={{ color: C.dim }}>Rest</p><p className="text-[34px] leading-none tabular-nums" style={display}>{fmtDur(left)}</p></div>
        <Btn kind="soft" className="!min-h-10" onClick={() => setRest((r) => r && { ...r, until: r.until - 15000 })}>−15</Btn>
        <Btn kind="soft" className="!min-h-10" onClick={() => setRest((r) => r && { ...r, until: r.until + 15000, total: r.total + 15 })}>+15</Btn>
        <Btn className="!min-h-10" onClick={() => setRest(null)}>Skip</Btn></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.1)" }}><div className="h-full rounded-full" style={{ width: `${(left / rest.total) * 100}%`, background: C.lime, transition: "width 1s linear" }} /></div>
    </div>}
    {adding && <Library list={list} data={data} title="Add exercise" onClose={() => setAdding(false)} onPick={(ex) => { set((a) => ({ ...a, exercises: [...a.exercises, ...planned(data, [{ exId: ex.id, name: ex.name, sets: 3, reps: ex.equipment === "bodyweight" ? "10-15" : "8-12", rest: 90 }], list)] })); setAdding(false); }} />}
    {detail && <ExerciseDetail ex={detail} data={data} onClose={() => setDetail(null)} />}
    {plateFor !== null && <PlateSheet units={u} start={plateFor} onClose={() => setPlateFor(null)} />}
  </div>;
}

function PlateSheet({ units, start, onClose }: { units: Units; start: number; onClose: () => void }) {
  const [total, setTotal] = useState(start || (units === "kg" ? 60 : 135));
  const p = plates(total, units);
  const COLORS: Record<number, string> = { 45: "#ff4d4d", 25: "#ff4d4d", 35: "#ffcc33", 20: "#5aa9ff", 15: "#ffcc33", 10: "#4ade80", 5: "#f4f4f7", 2.5: "#9a9aa8", 1.25: "#9a9aa8" };
  return <Sheet title="Plate calculator" onClose={onClose}>
    <input inputMode="decimal" value={total || ""} onChange={(e) => setTotal(Number(e.target.value.replace(/[^\d.]/g, "")) || 0)} aria-label={`Total weight in ${units}`} className={`${inputCls} mt-2 text-center !text-[28px] font-bold`} style={inputStyle} />
    <p className="mt-2 text-center text-[13px]" style={{ color: C.dim }}>Bar {units === "kg" ? 20 : 45} {units}. Each side:</p>
    <div className="mt-6 flex h-40 items-center justify-center gap-1">
      <div className="h-3 w-16 rounded-l" style={{ background: "#777" }} />
      {p.plates.map((w, i) => <div key={i} className="grid place-items-center rounded-[4px] text-[11px] font-bold" style={{ width: 22, height: 40 + Math.min(100, w * (units === "kg" ? 4 : 2.2)), background: COLORS[w] ?? "#ccc", color: "#111" }}>{w}</div>)}
    </div>
    {p.left > 0 && <p className="text-center text-[13px]" style={{ color: C.orange }}>{p.left} {units} can't be made with standard plates.</p>}
  </Sheet>;
}

// ——— Programs and routines ————————————————————————————————————————————————————————————————————

/** The exercise whose video stands for a program (its first day's first lift). */
export const programCover = (p: Program) => p.days[0]?.items.find((i) => videoFor(i.exId))?.exId;

export function ProgramDetail({ p, data, update, onClose, onStartDay, list }: { p: Program; data: FitData; update: Update; onClose: () => void; onStartDay: () => void; list: LibraryExercise[] }) {
  const on = data.program?.id === p.id;
  const [watch, setWatch] = useState<LibraryExercise | null>(null);
  const find = (id: string) => list.find((e) => e.id === id) ?? libraryFallback().find((e) => e.id === id);
  const name = (id: string) => find(id)?.name ?? CATALOG_BY_ID.get(id)?.name ?? id;
  const videos = new Set(p.days.flatMap((d) => d.items.map((i) => i.exId)).filter((id) => videoFor(id))).size;
  return <Sheet title={p.name} onClose={onClose} testId="fit-program">
    <CoverCard exId={programCover(p)} tall className="!p-5">
      <span className="text-[12px] font-bold uppercase tracking-[.14em]" style={{ color: C.lime }}>{p.level} · {p.goal}</span>
      <span className="mt-1 block text-[26px] font-extrabold leading-tight tracking-tight" style={display}>{p.name}</span>
      <span className="mt-2 block text-[14px] leading-snug" style={{ color: "#d6d6de" }}>{p.blurb}</span>
    </CoverCard>
    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
      {([[p.daysPerWeek, "days / wk"], [p.weeks, "weeks"], [videos, "videos"], [p.days.length, "workouts"]] as const).map(([n, l]) => <Card key={l} className="!px-1 !py-3"><p className="text-[20px] font-bold">{n}</p><p className="text-[11px]" style={{ color: C.dim }}>{l}</p></Card>)}
    </div>
    <p className="mt-2 px-1 text-[12px]" style={{ color: C.dim }}>Equipment: {p.equipment}</p>
    {p.days.map((d) => <div key={d.id}><Title>{d.name}</Title><Card className="!p-1.5"><ul>{d.items.map((it, k) => { const ex = find(it.exId); return <li key={k} style={k ? { borderTop: `1px solid ${C.line}` } : undefined}>
      <button type="button" disabled={!ex} onClick={() => ex && setWatch(ex)} className="flex w-full items-center gap-3 rounded-[10px] px-1.5 py-2 text-left active:bg-white/[.03]" data-testid={`fit-program-ex-${it.exId}`}>
        {videoFor(it.exId) ? <VideoThumb exId={it.exId} className="h-12 w-[76px] rounded-[10px]" /> : <span className="grid h-12 w-[76px] shrink-0 place-items-center rounded-[10px]" style={{ background: C.card2 }}><Dumbbell className="h-5 w-5" style={{ color: C.lime }} /></span>}
        <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium">{name(it.exId)}</span><span className="block text-[12px] tabular-nums" style={{ color: C.dim }}>{it.sets} × {it.reps} · rest {it.rest}s</span></span>
        <ChevronRight className="h-4 w-4 shrink-0" style={{ color: C.dim }} />
      </button></li>; })}</ul></Card></div>)}
    {watch && <ExerciseDetail ex={watch} data={data} onClose={() => setWatch(null)} />}
    <div className="sticky bottom-0 mt-6 space-y-2 pb-2 pt-3" style={{ background: C.bg }}>
      {on ? <><Btn onClick={onStartDay} className="w-full" testId="fit-program-next"><Play className="h-5 w-5" />Start next workout</Btn>
        <Btn kind="danger" className="w-full" onClick={() => { if (window.confirm(`Stop ${p.name}? Your workouts stay in your history.`)) update((x) => ({ ...x, program: undefined })); }}>Stop this program</Btn></>
        : <Btn onClick={() => { update((x) => ({ ...x, program: { id: p.id, started: new Date().toISOString(), done: [] } })); }} className="w-full" testId="fit-program-start">{data.program ? "Switch to this program" : "Start this program"}</Btn>}
    </div>
  </Sheet>;
}

export function RoutineEditor({ routine, list, data, onSave, onClose, onDelete }: { routine: Routine; list: LibraryExercise[]; data: FitData; onSave: (r: Routine) => void; onClose: () => void; onDelete?: () => void }) {
  const [r, setR] = useState(routine);
  const [adding, setAdding] = useState(false);
  return <Sheet title={routine.exercises.length ? "Edit routine" : "New routine"} onClose={onClose} right={<Btn className="!min-h-10" disabled={!r.exercises.length || !r.name.trim()} onClick={() => onSave(r)}>Save</Btn>}>
    <input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value.slice(0, 60) })} placeholder="Routine name" aria-label="Routine name" className={`${inputCls} mt-2`} style={inputStyle} />
    <div className="mt-4 space-y-2">{r.exercises.map((e, i) => <Card key={i} className="!p-3"><div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate font-semibold">{e.name}</p>
      <button type="button" aria-label="Remove" onClick={() => setR({ ...r, exercises: r.exercises.filter((_, k) => k !== i) })} className="grid h-9 w-9 place-items-center" style={{ color: C.dim }}><Trash2 className="h-4 w-4" /></button></div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]" style={{ color: C.dim }}>
        <label>Sets<input inputMode="numeric" value={e.sets} onChange={(ev) => setR({ ...r, exercises: r.exercises.map((x, k) => k === i ? { ...x, sets: Math.max(1, Math.min(20, Number(ev.target.value) || 1)) } : x) })} className="mt-1 h-11 w-full rounded-[10px] text-center text-[17px] font-semibold outline-none" style={inputStyle} /></label>
        <label>Reps<input value={e.reps} onChange={(ev) => setR({ ...r, exercises: r.exercises.map((x, k) => k === i ? { ...x, reps: ev.target.value.slice(0, 12) } : x) })} className="mt-1 h-11 w-full rounded-[10px] text-center text-[17px] font-semibold outline-none" style={inputStyle} /></label>
        <label>Rest (s)<input inputMode="numeric" value={e.rest} onChange={(ev) => setR({ ...r, exercises: r.exercises.map((x, k) => k === i ? { ...x, rest: Math.max(0, Math.min(900, Number(ev.target.value) || 0)) } : x) })} className="mt-1 h-11 w-full rounded-[10px] text-center text-[17px] font-semibold outline-none" style={inputStyle} /></label>
      </div></Card>)}</div>
    <Btn kind="soft" className="mt-3 w-full" onClick={() => setAdding(true)}><Plus className="h-5 w-5" />Add exercise</Btn>
    {onDelete && <button type="button" onClick={onDelete} className="mt-6 h-12 w-full text-[15px] font-semibold" style={{ color: C.red }}>Delete routine</button>}
    {adding && <Library list={list} data={data} title="Add exercise" onClose={() => setAdding(false)} onPick={(ex) => { setR((x) => ({ ...x, exercises: [...x.exercises, { exId: ex.id, name: ex.name, sets: 3, reps: "8-12", rest: 90 }] })); setAdding(false); }} />}
  </Sheet>;
}

const TYPES: { id: SessionCategory | "body" | "outdoor" | "form"; label: string; sub: string; cover: string }[] = [
  { id: "body", label: "Body map", sub: "Tap a muscle, train it", cover: "bench-press" },
  { id: "outdoor", label: "Run & trails", sub: "GPS map · US trails", cover: "jump-rope" },
  { id: "form", label: "AI form check", sub: "Camera coaching", cover: "back-squat" },
  { id: "hiit", label: "HIIT treadmill", sub: "Sprints, hills, Tabata", cover: "run" },
  { id: "c25k", label: "Couch to 5K", sub: "9 weeks to 30 minutes", cover: "walk-incline" },
  { id: "yoga", label: "Yoga", sub: "Mobility and recovery", cover: "worlds-greatest" },
  { id: "meditation", label: "Meditation", sub: "Breathing and focus", cover: "childs-pose" },
];
const CAT_TITLE: Record<SessionCategory, string> = { hiit: "HIIT treadmill", c25k: "Couch to 5K", yoga: "Yoga", meditation: "Meditation" };

/** A list of guided sessions in one category (Couch to 5K shows its 9 weeks with what's done). */
function SessionList({ cat, data, onClose, onPlay }: { cat: SessionCategory; data: FitData; onClose: () => void; onPlay: (s: Session) => void }) {
  const done = new Set(data.workouts.filter((w) => w.dayId && SESSION_BY_ID.has(w.dayId)).map((w) => w.dayId!));
  const list = sessionsIn(cat);
  const next = cat === "c25k" ? nextC25K(done) : undefined;
  return <Sheet title={CAT_TITLE[cat]} onClose={onClose} testId={`fit-sessions-${cat}`}>
    {cat === "c25k" && <CoverCard exId="run" tall className="mt-1 !p-5">
      <span className="text-[12px] tracking-[.16em]" style={{ ...display, fontWeight: 700, color: C.lime }}>{done.size ? `${list.filter((x) => done.has(x.id)).length} of ${list.length} runs done` : "Start from zero"}</span>
      <span className="mt-1 block text-[28px] leading-none" style={display}>{next ? next.name : "You ran a 5K."}</span>
      <span className="mt-1 block text-[14px]" style={{ color: "#d6d6de" }}>{next ? `${next.blurb} About ${sessionMins(next)} minutes.` : "Keep going: three 30-minute runs a week."}</span>
      {next && <Btn className="mt-4 w-full" onClick={() => onPlay(next)} testId="fit-c25k-next"><Play className="h-5 w-5" />Start this run</Btn>}
    </CoverCard>}
    {cat === "hiit" && <p className="mt-1 px-1 text-[14px]" style={{ color: C.dim }}>The app calls out every speed and incline change. Set the treadmill as it tells you.</p>}
    <div className="mt-3 space-y-2">{list.map((x) => <Card key={x.id} onClick={() => onPlay(x)} className="!p-4" testId={`fit-session-${x.id}`}>
      <div className="flex items-center gap-3">
        {cat === "c25k" ? <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] text-[18px]" style={{ ...display, ...(done.has(x.id) ? { background: C.lime, color: "#0b0b0c" } : { background: C.card2 }) }}>{done.has(x.id) ? <Check className="h-5 w-5" strokeWidth={3} /> : `${x.week}.${x.day}`}</span>
          : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] text-[18px] tabular-nums" style={{ ...display, background: C.card2, color: C.lime }}>{sessionMins(x)}′</span>}
        <div className="min-w-0 flex-1"><p className="truncate text-[19px] leading-tight" style={display}>{x.name}</p><p className="line-clamp-2 text-[13px] leading-snug" style={{ color: C.dim }}>{x.blurb}</p></div>
        <span className="shrink-0 text-right text-[11px] uppercase tracking-[.08em]" style={{ color: C.dim }}>{cat === "c25k" ? `${sessionMins(x)} min` : x.level}</span>
      </div>
    </Card>)}</div>
  </Sheet>;
}

/** The rows of form videos on the Train tab. */
const FORM_GROUPS = [
  { id: "big", label: "The big lifts", ids: ["back-squat", "bench-press", "deadlift", "ohp", "barbell-row", "pull-up", "rdl", "hip-thrust"] },
  { id: "home", label: "At home", ids: ["push-up", "bodyweight-squat", "glute-bridge", "plank", "inverted-row", "pike-push-up", "lunge", "burpee", "dead-bug"] },
  { id: "dumbbell", label: "Dumbbells", ids: ["db-bench", "db-row", "goblet-squat", "db-shoulder-press", "db-rdl", "lateral-raise", "db-curl", "bulgarian-split-squat"] },
  { id: "core", label: "Core", ids: ["plank", "side-plank", "dead-bug", "hanging-leg-raise", "ab-wheel", "cable-crunch", "russian-twist", "bicycle-crunch"] },
  { id: "cardio", label: "Cardio", ids: ["rower", "run", "walk-incline", "bike", "jump-rope", "stairs", "kb-swing", "elliptical"] },
  { id: "mobility", label: "Mobility", ids: ["worlds-greatest", "hip-flexor-stretch", "hamstring-stretch", "cat-cow", "childs-pose"] },
] as const;

export function TrainTab({ data, update, list, onStart, say }: { data: FitData; update: Update; list: LibraryExercise[]; onStart: (a: Active) => void; say: (m: string) => void }) {
  const [lib, setLib] = useState(false);
  const [prog, setProg] = useState<Program | null>(null);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [past, setPast] = useState<Workout | null>(null);
  const [watch, setWatch] = useState<LibraryExercise | null>(null);
  const [group, setGroup] = useState<(typeof FORM_GROUPS)[number]["id"]>("big");
  const [body, setBody] = useState(false);
  const [cat, setCat] = useState<SessionCategory | null>(null);
  const [playing, setPlaying] = useState<Session | null>(null);
  const [outdoor, setOutdoor] = useState(false);
  const [form, setForm] = useState(false);
  const saveSession = (x: Session, secs: number) => {
    saveToHealth("calories", Math.round((secs / 60) * ({ hiit: 11, c25k: 9, yoga: 3.5, meditation: 0 } as const)[x.category]), new Date(Date.now() - secs * 1000));
    update((d) => ({ ...d, workouts: [...d.workouts, { id: uid(), date: new Date().toISOString(), name: x.name, programId: x.category === "c25k" ? "c25k" : `session-${x.category}`, dayId: x.id, secs, exercises: [] }] }));
    setPlaying(null); say("Saved to your history.");
  };
  const find = (id: string) => list.find((e) => e.id === id) ?? libraryFallback().find((e) => e.id === id);
  const active = data.program ? PROGRAM_BY_ID.get(data.program.id) : undefined;
  const next = active && data.program ? nextProgramDay(active, data.program.done) : null;
  const startDay = () => { if (!active || !next) return; onStart(startWorkout({ name: `${active.name}: ${next.day.name}`, programId: active.id, dayId: next.day.id, exercises: planned(data, next.day.items, list) })); setProg(null); };
  return <div>
    {active && next ? <CoverCard exId={next.day.items.find((i) => videoFor(i.exId))?.exId} tall className="fit-shine !p-5" testId="fit-next-program">
      <span className="text-[12px] font-bold uppercase tracking-[.14em]" style={{ color: C.lime }}>{active.name} · Week {next.week}</span>
      <span className="mt-1 block text-[26px] font-extrabold tracking-tight" style={display}>{next.day.name}</span>
      <span className="mt-1 block text-[14px]" style={{ color: "#d6d6de" }}>{next.day.items.length} exercises · about {Math.round(next.day.items.reduce((t, i) => t + i.sets * (i.rest + 45), 0) / 60)} min</span>
      <Btn onClick={startDay} className="relative z-[1] mt-4 w-full" testId="fit-start-program-day"><Play className="h-5 w-5" />Start workout</Btn>
    </CoverCard> : <CoverCard exId="back-squat" tall className="!p-5">
      <span className="text-[12px] font-bold uppercase tracking-[.14em]" style={{ color: C.lime }}>{PROGRAMS.length} programs · every exercise on video</span>
      <span className="mt-1 block text-[24px] font-extrabold tracking-tight" style={display}>Pick a program</span>
      <span className="mt-1 block text-[14px]" style={{ color: "#d6d6de" }}>A plan tells you exactly what to lift each day, shows you how, and says when to add weight.</span>
    </CoverCard>}
    <Title>Train by type</Title>
    <div className="grid grid-cols-2 gap-2" data-testid="fit-types">{TYPES.map((t, k) => <CoverCard key={t.id} exId={t.cover} onClick={() => (t.id === "body" ? setBody(true) : t.id === "outdoor" ? setOutdoor(true) : t.id === "form" ? setForm(true) : setCat(t.id))} className={`fit-in !min-h-[118px] !p-3 ${k === 0 ? "col-span-2" : ""}`} style={stagger(k, 0.05)} testId={`fit-type-${t.id}`}>
      <span className="block text-[22px] leading-none" style={display}>{t.label}</span>
      <span className="mt-1 block text-[12px]" style={{ color: "#c9c9d4" }}>{t.sub}</span>
    </CoverCard>)}</div>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <Btn kind="soft" onClick={() => onStart(startWorkout({ name: "Workout", exercises: [] }))} testId="fit-empty-workout"><Plus className="h-5 w-5" />Empty workout</Btn>
      <Btn kind="soft" onClick={() => setLib(true)} testId="fit-open-library"><Search className="h-5 w-5" />Exercises</Btn>
    </div>
    <Title>Programs</Title>
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">{PROGRAMS.map((p) => <CoverCard key={p.id} exId={programCover(p)} onClick={() => setProg(p)} className={`!w-[250px] shrink-0 snap-start ${data.program?.id === p.id ? "!ring-2 !ring-[#ff5a1f]" : ""}`} tall testId={`fit-program-${p.id}`}>
      <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em]" style={{ color: C.lime }}>{p.level}{data.program?.id === p.id && <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: C.lime, color: "#0b0b0c" }}>Current</span>}</span>
      <span className="mt-1 block text-[18px] font-bold leading-tight">{p.name}</span>
      <span className="mt-1 line-clamp-2 block text-[13px] leading-snug" style={{ color: "#c9c9d4" }}>{p.blurb}</span>
      <span className="mt-2 block text-[12px] font-semibold" style={{ color: "#c9c9d4" }}>{p.daysPerWeek}×/week · {p.weeks} wk · {p.equipment}</span>
    </CoverCard>)}</div>
    <Title right={<button type="button" onClick={() => setLib(true)} className="text-[14px] font-semibold" style={{ color: C.lime }}>See all</button>}>Form videos</Title>
    <Chips label="Video group" value={group} onChange={setGroup} items={FORM_GROUPS.map((g) => ({ id: g.id, label: g.label }))} />
    <div className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" data-testid="fit-form-videos">{FORM_GROUPS.find((g) => g.id === group)!.ids.filter((id) => videoFor(id) && find(id)).map((id) => <button key={id} type="button" onClick={() => setWatch(find(id)!)} className="w-[180px] shrink-0 snap-start text-left active:scale-[.98]" data-testid={`fit-form-${id}`}>
      <VideoThumb exId={id} className="aspect-video w-full rounded-[12px]" />
      <span className="mt-2 block truncate px-0.5 text-[14px] font-semibold">{find(id)!.name}</span>
      <span className="block truncate px-0.5 text-[12px] capitalize" style={{ color: C.dim }}>{find(id)!.muscle} · {find(id)!.equipment}</span>
    </button>)}</div>
    <Title right={<button type="button" onClick={() => setRoutine({ id: uid(), name: "", exercises: [] })} className="text-[14px] font-semibold" style={{ color: C.lime }} data-testid="fit-new-routine">New</button>}>My routines</Title>
    {data.routines.length ? <div className="space-y-2">{data.routines.map((r) => <Card key={r.id} className="flex items-center gap-3 !p-3">
      <button type="button" onClick={() => setRoutine(r)} className="min-w-0 flex-1 text-left"><p className="truncate font-semibold">{r.name}</p><p className="truncate text-[13px]" style={{ color: C.dim }}>{r.exercises.map((e) => e.name).join(", ")}</p></button>
      <Btn className="!min-h-10" onClick={() => onStart(startWorkout({ name: r.name, exercises: planned(data, r.exercises, list) }))}><Play className="h-4 w-4" /></Btn>
    </Card>)}</div> : <p className="px-1 text-[14px]" style={{ color: C.dim }}>Save the workouts you do often, and start them in one tap.</p>}
    <Title>History</Title>
    {data.workouts.length ? <div className="space-y-2">{data.workouts.slice(-20).reverse().map((w) => <Card key={w.id} onClick={() => (w.dayId && SESSION_BY_ID.has(w.dayId) && !w.exercises.length ? setPlaying(SESSION_BY_ID.get(w.dayId)!) : setPast(w))} className="!p-3">
      <div className="flex items-center gap-3"><History className="h-5 w-5 shrink-0" style={{ color: C.dim }} />
        <div className="min-w-0 flex-1"><p className="truncate font-semibold">{w.name}</p><p className="text-[13px]" style={{ color: C.dim }}>{new Date(w.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {fmtDur(w.secs)} · {w.exercises.length ? `${w.exercises.length} exercises` : w.programId === "c25k" ? "Couch to 5K" : w.programId?.startsWith("session-") ? CAT_TITLE[w.programId.slice(8) as SessionCategory] ?? "Guided" : "Workout"}</p></div>
        <ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div></Card>)}</div>
      : <p className="px-1 text-[14px]" style={{ color: C.dim }}>Your finished workouts show up here.</p>}
    {lib && <Library list={list} data={data} onClose={() => setLib(false)} />}
    {watch && <ExerciseDetail ex={watch} data={data} onClose={() => setWatch(null)} />}
    {body && <BodyMap list={list} onClose={() => setBody(false)} onOpen={setWatch} onStart={(name, items) => { setBody(false); onStart(startWorkout({ name, exercises: planned(data, items, list) })); }} />}
    {outdoor && <OutdoorHub data={data} update={update} say={say} onClose={() => setOutdoor(false)} />}
    {form && <FormCheck onClose={() => setForm(false)} />}
    {cat && <SessionList cat={cat} data={data} onClose={() => setCat(null)} onPlay={setPlaying} />}
    {playing && <SessionPlayer session={playing} onClose={() => setPlaying(null)} onDone={(secs) => saveSession(playing, secs)} />}
    {prog && <ProgramDetail p={prog} data={data} update={update} list={list} onClose={() => setProg(null)} onStartDay={startDay} />}
    {routine && <RoutineEditor routine={routine} list={list} data={data} onClose={() => setRoutine(null)}
      onSave={(r) => { update((d) => ({ ...d, routines: d.routines.some((x) => x.id === r.id) ? d.routines.map((x) => (x.id === r.id ? r : x)) : [...d.routines, r] })); setRoutine(null); say("Routine saved."); }}
      onDelete={data.routines.some((x) => x.id === routine.id) ? () => { update((d) => ({ ...d, routines: d.routines.filter((x) => x.id !== routine.id) })); setRoutine(null); } : undefined} />}
    {past && <Sheet title={past.name} onClose={() => setPast(null)}>
      <p className="mt-1 text-center text-[13px]" style={{ color: C.dim }}>{new Date(past.date).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })} · {fmtDur(past.secs)}</p>
      <div className="mt-4 space-y-2">{past.exercises.map((e, i) => <Card key={i} className="!p-3"><p className="font-semibold" style={{ color: C.lime }}>{e.name}</p>
        <p className="mt-1 text-[14px]" style={{ color: C.dim }}>{e.sets.map((s) => `${fmtNum(s.weight)} ${data.profile.units} × ${s.reps}`).join("  ·  ")}</p></Card>)}</div>
      <Btn kind="soft" className="mt-4 w-full" onClick={() => { onStart(startWorkout({ name: past.name, exercises: past.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: false })) })) })); setPast(null); }}><Flame className="h-5 w-5" />Do this workout again</Btn>
      <button type="button" onClick={() => { if (window.confirm("Delete this workout from your history?")) { update((d) => ({ ...d, workouts: d.workouts.filter((x) => x.id !== past.id) })); setPast(null); } }} className="mt-4 h-12 w-full text-[15px] font-semibold" style={{ color: C.red }}>Delete workout</button>
    </Sheet>}
  </div>;
}
export { fromKg };
