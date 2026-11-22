// Cooked: My maxes and Workout templates.
// My maxes: the most they've lifted on each exercise (weight and reps, most reps, or longest hold),
// updated by hand whenever they test it, with the history and the weights to train at from it. Their
// logged workouts count too (shared/fitMaxes.ts).
// Workout templates: workouts they build (or save from one they did) with the sets, reps, weights and
// rest they want, started again in one tap.
import { useMemo, useState } from "react";
import { ChevronRight, ClipboardList, Copy, History, Pencil, Play, Plus, Trash2, Trophy } from "lucide-react";
import { CATALOG_BY_ID, dayKey, fromKg, toKg, uid, type FitData, type Routine, type RoutineItem, type Units, type Workout } from "@shared/fit";
import { maxRows, maxTimeline, percentOf, strength, type MaxEntry, type MaxRow } from "@shared/fitMaxes";
import type { LibraryExercise, Update } from "./fitStore";
import { Btn, C, Card, Chips, Sheet, Spark, Title, display, inputCls, inputStyle } from "./fitUi";
import { Library, planned, startWorkout, type Active } from "./FitTrain";

const w1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 });
const shortDate = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.slice(0, 4) === String(new Date().getFullYear()) ? undefined : "numeric" });
const clockSecs = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`);

/** "225 lb × 1", "185 lb × 5", "32 reps", "2:30 hold". */
export function maxLabel(m: Pick<MaxEntry, "kg" | "reps" | "secs">, units: Units): string {
  if (m.secs) return `${clockSecs(m.secs)} hold`;
  if (m.kg <= 0) return `${m.reps} reps`;
  return `${w1(fromKg(m.kg, units))} ${units} × ${m.reps}`;
}

/** What a row shows: the max they entered, or their best logged set when that's stronger. */
export function rowLabel(r: MaxRow, units: Units): string {
  if (r.source === "logged" && r.logged) return `${w1(r.logged.weight)} ${units} × ${r.logged.reps}`;
  return r.best ? maxLabel(r.best, units) : "";
}

/** The My maxes button: how many lifts have a max (entered or logged) and the newest. */
export function maxSummary(data: FitData): string {
  const rows = maxRows(data.maxes ?? [], data.workouts, data.profile.units);
  if (!rows.length) return "Log a workout or add one";
  return `${rows.length} lift${rows.length === 1 ? "" : "s"} · ${rows[0].name} ${rowLabel(rows[0], data.profile.units)}`;
}

type Kind = "weight" | "reps" | "time";
const kindOf = (exId: string, m?: MaxEntry): Kind => (m ? (m.secs ? "time" : m.kg > 0 ? "weight" : "reps") : CATALOG_BY_ID.get(exId)?.timed ? "time" : CATALOG_BY_ID.get(exId)?.equipment === "bodyweight" ? "reps" : "weight");

/** A tiny line of a max going up, for the list. */
function MiniLine({ values }: { values: number[] }) {
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1, w = 300, h = 28;
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((v - lo) / span) * (h - 6)).toFixed(1)}`).join(" ");
  return <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-full" preserveAspectRatio="none"><path d={d} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ stroke: C.lime }} /></svg>;
}

function NumberField({ label, value, set, suffix, testId }: { label: string; value: string; set: (v: string) => void; suffix?: string; testId?: string }) {
  return <label className="block text-[12px] font-semibold" style={{ color: C.dim }}>{label}
    <span className="relative mt-1 block">
      <input inputMode="decimal" value={value} onChange={(e) => set(e.target.value.replace(/[^\d.]/g, "").slice(0, 7))} data-testid={testId}
        className="h-14 w-full rounded-[12px] px-3 text-center text-[22px] font-bold tabular-nums outline-none focus:ring-2" style={inputStyle} />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: C.dim }}>{suffix}</span>}
    </span>
  </label>;
}

/** Add or update a max. */
function MaxEditor({ data, list, start, onSave, onClose }: { data: FitData; list: LibraryExercise[]; start?: { exId: string; name: string; last?: MaxEntry; weight?: number; reps?: number }; onSave: (m: MaxEntry) => void; onClose: () => void }) {
  const units = data.profile.units;
  const [ex, setEx] = useState<{ exId: string; name: string } | null>(start ? { exId: start.exId, name: start.name } : null);
  const [picking, setPicking] = useState(!start);
  const [kind, setKind] = useState<Kind>(start ? kindOf(start.exId, start.last) : "weight");
  const [weight, setWeight] = useState(start?.weight ? w1(start.weight) : start?.last && start.last.kg > 0 ? w1(fromKg(start.last.kg, units)) : "");
  const [reps, setReps] = useState(String(start?.reps ?? start?.last?.reps ?? (kind === "weight" ? 1 : "")) || "");
  const [mins, setMins] = useState(start?.last?.secs ? String(Math.floor(start.last.secs / 60)) : "");
  const [secs, setSecs] = useState(start?.last?.secs ? String(start.last.secs % 60) : "");
  const [date, setDate] = useState(dayKey());
  const [note, setNote] = useState("");
  const w = Number(weight) || 0, r = Math.round(Number(reps) || 0), t = (Number(mins) || 0) * 60 + (Number(secs) || 0);
  const ok = !!ex && (kind === "weight" ? w > 0 && r > 0 : kind === "reps" ? r > 0 : t > 0);
  const est = kind === "weight" && w > 0 && r > 1 ? strength({ kg: w, reps: r }) : 0;
  const save = () => {
    if (!ok || !ex) return;
    onSave({ id: uid(), exId: ex.exId, name: ex.name, kg: kind === "weight" ? toKg(w, units) : 0, reps: kind === "time" ? 0 : r, ...(kind === "time" ? { secs: t } : {}), date, ...(note.trim() ? { note: note.trim().slice(0, 200) } : {}) });
  };
  return <Sheet title={start?.last ? "Update max" : "Add a max"} onClose={onClose} testId="fit-max-editor" right={<Btn className="!min-h-10" disabled={!ok} onClick={save} testId="fit-max-save">Save</Btn>}>
    <button type="button" onClick={() => setPicking(true)} className="mt-2 flex w-full items-center gap-3 rounded-[14px] p-3 text-left" style={{ background: C.card, boxShadow: `inset 0 0 0 1px ${C.line}` }} data-testid="fit-max-exercise">
      <Trophy className="h-6 w-6 shrink-0" style={{ color: C.lime }} />
      <span className="min-w-0 flex-1"><span className="block text-[12px] font-semibold" style={{ color: C.dim }}>Exercise</span><span className="block truncate text-[17px] font-semibold">{ex?.name ?? "Pick an exercise"}</span></span>
      <ChevronRight className="h-5 w-5" style={{ color: C.dim }} />
    </button>
    <div className="mt-4"><Chips label="What kind of max" value={kind} onChange={(k) => { setKind(k); if (k === "weight" && !reps) setReps("1"); }}
      items={[{ id: "weight", label: "Weight × reps" }, { id: "reps", label: "Most reps" }, { id: "time", label: "Longest hold" }]} /></div>
    <div className="mt-4 grid grid-cols-2 gap-3">
      {kind === "weight" && <><NumberField label="Weight" value={weight} set={setWeight} suffix={units} testId="fit-max-weight" /><NumberField label="Reps" value={reps} set={setReps} testId="fit-max-reps" /></>}
      {kind === "reps" && <div className="col-span-2"><NumberField label="Reps in one set" value={reps} set={setReps} testId="fit-max-reps" /></div>}
      {kind === "time" && <><NumberField label="Minutes" value={mins} set={setMins} /><NumberField label="Seconds" value={secs} set={setSecs} /></>}
    </div>
    {est > 0 && <p className="mt-2 px-1 text-[13px]" style={{ color: C.dim }}>That's about <b style={{ color: C.text }}>{w1(est)} {units}</b> for one rep.</p>}
    <label className="mt-4 block text-[12px] font-semibold" style={{ color: C.dim }}>Date
      <input type="date" value={date} max={dayKey()} onChange={(e) => setDate(e.target.value || dayKey())} className={`${inputCls} mt-1`} style={inputStyle} /></label>
    <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Note (optional), e.g. belt, paused, test day" aria-label="Note" className={`${inputCls} mt-3`} style={inputStyle} />
    {picking && <Library list={list} data={data} title="Pick an exercise" onClose={() => { setPicking(false); if (!ex) onClose(); }}
      onPick={(e) => { setEx({ exId: e.id, name: e.name }); setKind(kindOf(e.id)); setPicking(false); }} />}
  </Sheet>;
}

function MaxDetail({ row, data, onUpdate, onDelete, onClose }: { row: MaxRow; data: FitData; onUpdate: () => void; onDelete: (id: string) => void; onClose: () => void }) {
  const units = data.profile.units;
  const best = row.best;
  const timed = !!best?.secs, reps = !!best && best.kg <= 0 && !best.secs;
  const unit = (y: number) => (timed ? clockSecs(Math.round(y)) : reps ? `${Math.round(y)} reps` : `${w1(y)} ${units}`);
  const line = useMemo(() => maxTimeline(row.exId, data.maxes ?? [], data.workouts, units), [row.exId, data.maxes, data.workouts, units]);
  const pts = line.points;
  return <Sheet title={row.name} onClose={onClose} testId="fit-max-detail" tall footer={<Btn className="w-full" onClick={onUpdate} testId="fit-max-update"><Pencil className="h-5 w-5" />{best ? "Update max" : "Save as my max"}</Btn>}>
    <Card className="mt-2 !p-5 text-center">
      <p className="text-[12px] font-bold uppercase tracking-[.14em]" style={{ color: C.lime }}>{row.source === "logged" ? "Your best, from your workouts" : "Your max"}</p>
      <p className="mt-1 text-[34px] leading-none" style={display} data-testid="fit-max-headline">{rowLabel(row, units)}</p>
      {row.oneRm > 0 && <p className="mt-2 text-[14px]" style={{ color: C.steel }}>About {w1(row.oneRm)} {units} for one rep · {shortDate(row.date)}</p>}
      {line.gain > 0 && <p className="mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-bold" style={{ background: C.emberSoft, color: C.lime }} data-testid="fit-max-gain">Up {timed || reps ? unit(line.gain) : `${Math.round(line.gain)} ${units}`} since {shortDate(pts[0].date)}</p>}
    </Card>
    <Title>Max over time</Title>
    <Card testId="fit-max-chart">{pts.length > 1
      ? <><Spark points={pts.map((p) => ({ x: shortDate(p.date), y: p.best }))} label={unit} />
        <p className="mt-2 text-[12px]" style={{ color: C.dim }}>Your best so far ({timed ? "longest hold" : reps ? "most reps" : "estimated one-rep max"}), from {pts.length} days of workouts and maxes. It updates itself after every workout.</p></>
      : <p className="py-4 text-center text-[13px]" style={{ color: C.dim }}>Log this exercise in a workout or two and your max shows up here as a chart.</p>}</Card>
    {pts.length > 2 && <><Title>Each workout</Title><Card><Spark points={pts.map((p) => ({ x: shortDate(p.date), y: p.day }))} label={unit} color={C.steel} /></Card></>}
    {row.oneRm > 0 && <><Title>Train from it</Title>
      <Card className="!p-1.5"><div className="grid grid-cols-4 gap-1 text-center" data-testid="fit-max-percents">
        {[50, 60, 65, 70, 75, 80, 85, 90].map((p) => <div key={p} className="rounded-[10px] py-2" style={{ background: C.card2 }}>
          <p className="text-[11px] font-semibold" style={{ color: C.dim }}>{p}%</p><p className="text-[16px] font-bold tabular-nums">{w1(percentOf(row.oneRm, p, units))}</p></div>)}
      </div></Card>
      <p className="mt-1.5 px-1 text-[12px]" style={{ color: C.dim }}>In {units}, rounded to the plates.</p></>}
    {row.logged && <><Title>Best logged set</Title><Card className="!p-3"><p className="text-[15px] font-semibold">{w1(row.logged.weight)} {units} × {row.logged.reps}</p><p className="text-[12px]" style={{ color: C.dim }}>{shortDate(row.logged.date)}</p></Card></>}
    {row.history.length > 0 && <><Title>Maxes you entered</Title>
    <Card className="!p-1.5"><ul>{row.history.map((m, k) => <li key={m.id} className="flex items-center gap-3 px-2 py-2.5" style={k ? { borderTop: `1px solid ${C.line}` } : undefined}>
      <History className="h-4 w-4 shrink-0" style={{ color: C.dim }} />
      <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold tabular-nums">{maxLabel(m, units)}</span><span className="block truncate text-[12px]" style={{ color: C.dim }}>{shortDate(m.date)}{m.note ? ` · ${m.note}` : ""}</span></span>
      <button type="button" aria-label="Delete this entry" onClick={() => { if (window.confirm("Delete this entry?")) onDelete(m.id); }} className="grid h-10 w-10 place-items-center" style={{ color: C.dim }}><Trash2 className="h-4 w-4" /></button>
    </li>)}</ul></Card></>}
  </Sheet>;
}

export function MaxesApp({ inline, data, update, list, say, onClose }: { inline?: boolean; data: FitData; update: Update; list: LibraryExercise[]; say: (m: string) => void; onClose: () => void }) {
  const units = data.profile.units;
  const entries = data.maxes ?? [];
  const rows = useMemo(() => maxRows(entries, data.workouts, units), [entries, data.workouts, units]);
  const [edit, setEdit] = useState<Parameters<typeof MaxEditor>[0]["start"] | null | false>(false);
  const [open, setOpen] = useState<string | null>(null);
  const row = rows.find((r) => r.exId === open) ?? null;
  const save = (m: MaxEntry) => {
    const before = rows.find((r) => r.exId === m.exId);
    update((d) => ({ ...d, maxes: [...(d.maxes ?? []), m] }));
    setEdit(false);
    const was = before ? (before.best ? strength(before.best) : 0) : 0;
    say(before && m.kg > 0 && fromKg(strength(m), units) > before.oneRm + 0.01 ? `New max on ${m.name}!` : was && strength(m) > was ? `New max on ${m.name}!` : "Max saved.");
  };
  const remove = (id: string) => update((d) => ({ ...d, maxes: (d.maxes ?? []).filter((m) => m.id !== id) }));
  return <Sheet inline={inline} tall title="My maxes" onClose={onClose} testId="fit-app-maxes" right={<Btn className="!min-h-10" onClick={() => setEdit(null)} testId="fit-max-add"><Plus className="h-4 w-4" />Add</Btn>}>
    {rows.length ? <><p className="mt-1 px-1 text-[13px]" style={{ color: C.dim }}>Every lift you log counts. Your maxes and charts update themselves after each workout.</p>
      <div className="mt-2 grid grid-cols-1 gap-2" data-testid="fit-max-list">{rows.map((r) => { const t = maxTimeline(r.exId, entries, data.workouts, units); return <Card key={r.exId} onClick={() => setOpen(r.exId)} className="!p-3" testId={`fit-max-${r.exId}`}>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]" style={{ background: C.emberSoft, color: C.lime }}><Trophy className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-semibold">{r.name}</span>
          <span className="block truncate text-[13px] tabular-nums" style={{ color: C.dim }}>{r.source === "logged" ? "From a workout" : "Entered"} · {shortDate(r.date)}</span></span>
        <span className="shrink-0 text-right"><span className="block text-[18px] font-bold tabular-nums" style={display}>{rowLabel(r, units)}</span>
          {t.gain > 0 && r.best?.kg !== 0 && <span className="block text-[12px] font-bold tabular-nums" style={{ color: C.lime }}>+{Math.round(t.gain)} {units}</span>}</span>
      </div>
      {t.points.length > 2 && <div className="mt-2" aria-hidden><MiniLine values={t.points.map((p) => p.best)} /></div>}
    </Card>; })}</div></>
      : <Card className="mt-2 !p-5 text-center"><Trophy className="mx-auto h-8 w-8" style={{ color: C.lime }} /><p className="mt-2 text-[17px] font-semibold">Your maxes live here</p>
        <p className="mt-1 text-[14px]" style={{ color: C.dim }}>Log a workout and your best lifts show up here by themselves, with a chart of how they go up. You can also add a max you tested.</p>
        <Btn className="mt-4 w-full" onClick={() => setEdit(null)}><Plus className="h-5 w-5" />Add a max</Btn></Card>}
    {edit !== false && <MaxEditor data={data} list={list} start={edit ?? undefined} onSave={save} onClose={() => setEdit(false)} />}
    {row && <MaxDetail row={row} data={data} onClose={() => setOpen(null)} onDelete={(id) => { remove(id); if (row.history.length <= 1) setOpen(null); }}
      onUpdate={() => setEdit(row.best && row.source === "entered" ? { exId: row.exId, name: row.name, last: row.best } : { exId: row.exId, name: row.name, weight: row.logged?.weight, reps: row.logged?.reps })} />}
  </Sheet>;
}

// ——— Workout templates ————————————————————————————————————————————————————————————————————————————

/** A template from a workout they did: the same exercises, sets, reps and top weight, ready to reuse. */
export function templateFrom(w: Workout): Routine {
  return {
    id: uid(), name: w.name.slice(0, 60) || "My workout",
    exercises: w.exercises.filter((e) => e.sets.length).slice(0, 30).map((e): RoutineItem => {
      const work = e.sets.filter((s) => !s.warm);
      const top = Math.max(0, ...work.map((s) => s.weight));
      const reps = e.target || String(Math.max(1, ...work.map((s) => s.reps)));
      return { id: uid(), exId: e.exId, name: e.name, sets: Math.max(1, Math.min(20, work.length || e.sets.length)), reps: reps.slice(0, 12), rest: e.rest ?? 90, ...(top > 0 ? { weight: top } : {}), ...(e.note ? { note: e.note.slice(0, 120) } : {}) };
    }),
  };
}

const num = (v: string, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) && v !== "" ? Math.max(lo, Math.min(hi, n)) : d; };

export function TemplateEditor({ routine, list, data, onSave, onClose, onDelete }: { routine: Routine; list: LibraryExercise[]; data: FitData; onSave: (r: Routine) => void; onClose: () => void; onDelete?: () => void }) {
  const [r, setR] = useState(routine);
  const [adding, setAdding] = useState(false);
  const units = data.profile.units;
  const set = (i: number, patch: Partial<RoutineItem>) => setR((x) => ({ ...x, exercises: x.exercises.map((e, k) => (k === i ? { ...e, ...patch } : e)) }));
  const move = (i: number, by: number) => setR((x) => { const l = [...x.exercises]; const j = i + by; if (j < 0 || j >= l.length) return x; [l[i], l[j]] = [l[j], l[i]]; return { ...x, exercises: l }; });
  const cell = "mt-1 h-11 w-full rounded-[10px] text-center text-[17px] font-semibold tabular-nums outline-none";
  return <Sheet title={routine.exercises.length ? "Edit template" : "New template"} onClose={onClose} testId="fit-template-editor" right={<Btn className="!min-h-10" disabled={!r.exercises.length || !r.name.trim()} onClick={() => onSave({ ...r, name: r.name.trim() })} testId="fit-template-save">Save</Btn>}>
    <input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value.slice(0, 60) })} placeholder="Template name, e.g. Push day" aria-label="Template name" className={`${inputCls} mt-2`} style={inputStyle} data-testid="fit-template-name" />
    <textarea value={r.note ?? ""} onChange={(e) => setR({ ...r, note: e.target.value.slice(0, 300) || undefined })} rows={2} placeholder="Notes (optional): warm-up, supersets, how to progress" aria-label="Template notes"
      className="mt-2 w-full resize-none rounded-[12px] px-3 py-2.5 text-[15px] outline-none focus:ring-2" style={inputStyle} />
    <div className="mt-4 space-y-2">{r.exercises.map((e, i) => <Card key={e.id ?? i} className="!p-3">
      <div className="flex items-center gap-1">
        <p className="min-w-0 flex-1 truncate font-semibold">{i + 1}. {e.name}</p>
        <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-9 w-9 place-items-center disabled:opacity-30" style={{ color: C.dim }}>↑</button>
        <button type="button" aria-label="Move down" disabled={i === r.exercises.length - 1} onClick={() => move(i, 1)} className="grid h-9 w-9 place-items-center disabled:opacity-30" style={{ color: C.dim }}>↓</button>
        <button type="button" aria-label="Remove" onClick={() => setR({ ...r, exercises: r.exercises.filter((_, k) => k !== i) })} className="grid h-9 w-9 place-items-center" style={{ color: C.dim }}><Trash2 className="h-4 w-4" /></button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-[12px]" style={{ color: C.dim }}>
        <label>Sets<input inputMode="numeric" value={e.sets} onChange={(ev) => set(i, { sets: num(ev.target.value, 1, 20, 1) })} className={cell} style={inputStyle} /></label>
        <label>Reps<input value={e.reps} onChange={(ev) => set(i, { reps: ev.target.value.slice(0, 12) })} placeholder="8-12" className={cell} style={inputStyle} /></label>
        <label>{units}<input inputMode="decimal" value={e.weight ?? ""} placeholder="auto" onChange={(ev) => { const v = ev.target.value.replace(/[^\d.]/g, ""); set(i, { weight: v ? num(v, 0, 2000, 0) || undefined : undefined }); }} className={cell} style={inputStyle} data-testid={`fit-template-weight-${i}`} /></label>
        <label>Rest (s)<input inputMode="numeric" value={e.rest} onChange={(ev) => set(i, { rest: num(ev.target.value, 0, 900, 0) })} className={cell} style={inputStyle} /></label>
      </div>
      <input value={e.note ?? ""} onChange={(ev) => set(i, { note: ev.target.value.slice(0, 120) || undefined })} placeholder="Note (optional), e.g. pause at the bottom" aria-label={`Note for ${e.name}`}
        className="mt-2 h-10 w-full rounded-[10px] px-3 text-[14px] outline-none" style={inputStyle} />
    </Card>)}</div>
    <p className="mt-2 px-1 text-[12px]" style={{ color: C.dim }}>Leave the weight on auto and Cooked fills in what to lift from last time or from your max.</p>
    <Btn kind="soft" className="mt-3 w-full" onClick={() => setAdding(true)} testId="fit-template-add-ex"><Plus className="h-5 w-5" />Add exercise</Btn>
    {onDelete && <button type="button" onClick={() => { if (window.confirm(`Delete “${routine.name}”?`)) onDelete(); }} className="mt-6 h-12 w-full text-[15px] font-semibold" style={{ color: C.red }}>Delete template</button>}
    {adding && <Library list={list} data={data} title="Add exercise" onClose={() => setAdding(false)} onPick={(ex) => { setR((x) => ({ ...x, exercises: [...x.exercises, { id: uid(), exId: ex.id, name: ex.name, sets: 3, reps: "8-12", rest: 90 }] })); setAdding(false); }} />}
  </Sheet>;
}

/** Start a template: its workout, with weights filled in, and it moves to the top as last used. */
export function startTemplate(r: Routine, data: FitData, list: LibraryExercise[], update: Update): Active {
  update((d) => ({ ...d, routines: d.routines.map((x) => (x.id === r.id ? { ...x, used: dayKey(), uses: (x.uses ?? 0) + 1 } : x)) }));
  return startWorkout({ name: r.name, routineId: r.id, exercises: planned(data, r.exercises, list) });
}

export function TemplatesApp({ inline, data, update, list, say, onStart, onClose }: { inline?: boolean; data: FitData; update: Update; list: LibraryExercise[]; say: (m: string) => void; onStart: (a: Active) => void; onClose: () => void }) {
  const [edit, setEdit] = useState<Routine | null>(null);
  const [fromPast, setFromPast] = useState(false);
  const units = data.profile.units;
  const sorted = [...data.routines].sort((a, b) => (b.used ?? "").localeCompare(a.used ?? ""));
  const saveTemplate = (r: Routine) => { update((d) => ({ ...d, routines: d.routines.some((x) => x.id === r.id) ? d.routines.map((x) => (x.id === r.id ? r : x)) : [...d.routines, r] })); setEdit(null); say("Template saved."); };
  const recent = data.workouts.filter((w) => w.exercises.some((e) => e.sets.length)).slice(-15).reverse();
  return <Sheet inline={inline} tall title="Workout templates" onClose={onClose} testId="fit-app-templates" right={<Btn className="!min-h-10" onClick={() => setEdit({ id: uid(), name: "", exercises: [] })} testId="fit-template-new"><Plus className="h-4 w-4" />New</Btn>}>
    {sorted.length ? <div className="mt-2 grid grid-cols-1 gap-2" data-testid="fit-template-list">{sorted.map((r) => <Card key={r.id} className="min-w-0 !p-3" testId={`fit-template-${r.id}`}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setEdit(r)} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[16px] font-semibold">{r.name}</span>
          <span className="block truncate text-[13px]" style={{ color: C.dim }}>{r.exercises.length} exercises · {r.exercises.reduce((t, e) => t + e.sets, 0)} sets{r.used ? ` · last ${shortDate(r.used)}` : ""}</span>
          <span className="mt-0.5 block truncate text-[12px]" style={{ color: C.steel }}>{planned(data, r.exercises, list).map((e) => `${e.name}${e.sets[0]?.weight ? ` ${w1(e.sets[0].weight)}` : ""}`).join(" · ")}</span>
        </button>
        <button type="button" aria-label={`Copy ${r.name}`} onClick={() => saveTemplate({ ...r, id: uid(), name: `${r.name} (copy)`.slice(0, 60), used: undefined, uses: undefined })} className="grid h-10 w-10 place-items-center rounded-full" style={{ color: C.dim }}><Copy className="h-4 w-4" /></button>
        <Btn className="!min-h-11 !px-4" onClick={() => onStart(startTemplate(r, data, list, update))} testId={`fit-template-start-${r.id}`}><Play className="h-4 w-4" />Start</Btn>
      </div>
    </Card>)}</div>
      : <Card className="mt-2 !p-5 text-center"><ClipboardList className="mx-auto h-8 w-8" style={{ color: C.lime }} /><p className="mt-2 text-[17px] font-semibold">Build your own workouts</p>
        <p className="mt-1 text-[14px]" style={{ color: C.dim }}>Pick the exercises, sets, reps, weights and rest you want, save it, and start it again in one tap.</p>
        <Btn className="mt-4 w-full" onClick={() => setEdit({ id: uid(), name: "", exercises: [] })}><Plus className="h-5 w-5" />New template</Btn></Card>}
    {recent.length > 0 && <Btn kind="soft" className="mt-3 w-full" onClick={() => setFromPast(true)} testId="fit-template-from-past"><History className="h-5 w-5" />Save a past workout as a template</Btn>}
    {edit && <TemplateEditor routine={edit} list={list} data={data} onClose={() => setEdit(null)} onSave={saveTemplate}
      onDelete={data.routines.some((x) => x.id === edit.id) ? () => { update((d) => ({ ...d, routines: d.routines.filter((x) => x.id !== edit.id) })); setEdit(null); say("Template deleted."); } : undefined} />}
    {fromPast && <Sheet title="Pick a workout" onClose={() => setFromPast(false)}>
      <div className="mt-2 grid gap-2">{recent.map((w) => <Card key={w.id} onClick={() => { setFromPast(false); setEdit(templateFrom(w)); }} className="!p-3">
        <p className="truncate font-semibold">{w.name}</p>
        <p className="truncate text-[13px]" style={{ color: C.dim }}>{new Date(w.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {w.exercises.map((e) => e.name).join(", ")}</p>
        <p className="truncate text-[12px]" style={{ color: C.steel }}>{w.exercises.slice(0, 3).map((e) => { const top = Math.max(0, ...e.sets.map((s) => s.weight)); return top ? `${e.name} ${w1(top)} ${units}` : e.name; }).join(" · ")}</p>
      </Card>)}</div>
    </Sheet>}
  </Sheet>;
}
