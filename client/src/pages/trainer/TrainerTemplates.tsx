// Arise Trainer: ready-made templates (shared/coachTemplates.ts), the AI workout and program builder (server/coach.ts,
// /trainer/ai/*), and the client invite link. Anything added goes into the trainer's own library as a copy they can change.
import { useEffect, useState } from "react";
import { Check, Copy, Dumbbell, Link2, Share2, Sparkles, Wand2 } from "lucide-react";
import type { CoachProgram, Library, PlanWorkout } from "@shared/coach";
import { TEMPLATE_PROGRAMS, TEMPLATE_WORKOUTS, type Equip, type Level, type TemplateProgram, type TemplateWorkout } from "@shared/coachTemplates";
import { coachApi, post } from "../coach/coachApi";
import { Btn, C, Card, Chips, Field, Sheet, Title, display, inputCls, inputStyle, stagger } from "../fit/fitUi";
import { newId } from "./TrainerBuilder";

const LEVELS: { id: Level | ""; label: string }[] = [{ id: "", label: "Any level" }, { id: "beginner", label: "Beginner" }, { id: "intermediate", label: "Intermediate" }, { id: "advanced", label: "Advanced" }];
const EQUIPS: { id: Equip | ""; label: string }[] = [{ id: "", label: "Any equipment" }, { id: "gym", label: "Full gym" }, { id: "dumbbells", label: "Dumbbells" }, { id: "home", label: "No equipment" }];
const EQUIP_LABEL: Record<Equip, string> = { gym: "Full gym", dumbbells: "Dumbbells", home: "No equipment" };

/** Copies a template into the library with fresh ids, so the trainer can add it twice and change their copy freely. */
export function addProgramToLibrary(lib: Library, t: { program: CoachProgram; workouts: PlanWorkout[] }): Library {
  const ids = new Map(t.workouts.map((w) => [w.id, newId()]));
  const workouts = t.workouts.map(({ id, ...w }) => ({ ...strip(w), id: ids.get(id)! }));
  const program: CoachProgram = { ...t.program, id: newId(), days: t.program.days.map((d) => ({ ...d, workoutId: ids.get(d.workoutId) ?? d.workoutId })) };
  return { ...lib, workouts: [...lib.workouts, ...workouts], programs: [...lib.programs, program] };
}
const strip = <T extends object>(w: T): PlanWorkout => { const { tags: _t, level: _l, equip: _e, ...rest } = w as T & Partial<TemplateWorkout>; return rest as unknown as PlanWorkout; };
export const addWorkoutToLibrary = (lib: Library, w: PlanWorkout): Library => ({ ...lib, workouts: [...lib.workouts, { ...strip(w), id: newId() }] });

export function TemplatesSheet({ lib, saveLib, onClose, say }: { lib: Library; saveLib: (l: Library) => void; onClose: () => void; say: (m: string) => void }) {
  const [kind, setKind] = useState<"programs" | "workouts">("programs");
  const [level, setLevel] = useState<Level | "">(""); const [equip, setEquip] = useState<Equip | "">("");
  const [open, setOpen] = useState<TemplateProgram | TemplateWorkout | null>(null);
  const fits = (x: { level: Level; equip: Equip }) => (!level || x.level === level) && (!equip || x.equip === equip);
  const programs = TEMPLATE_PROGRAMS.filter(fits), workouts = TEMPLATE_WORKOUTS.filter(fits);
  const added = (name: string) => lib.programs.some((p) => p.name === name) || lib.workouts.some((w) => w.name === name);
  return <Sheet title="Templates" onClose={onClose} testId="tr-templates">
    <p className="px-1 text-[13px]" style={{ color: C.dim }}>Ready-made by certified coaches. Add one and it becomes your own copy to change however you like.</p>
    <div className="mt-3"><Chips label="Kind" value={kind} onChange={setKind} items={[{ id: "programs", label: `Programs · ${TEMPLATE_PROGRAMS.length}` }, { id: "workouts", label: `Workouts · ${TEMPLATE_WORKOUTS.length}` }]} /></div>
    <div className="mt-2"><Chips label="Level" value={level} onChange={setLevel} items={LEVELS} /></div>
    <div className="mt-2"><Chips label="Equipment" value={equip} onChange={setEquip} items={EQUIPS} /></div>
    <div className="mt-3 space-y-2">
      {kind === "programs" ? programs.map((p, k) => <Card key={p.program.id} onClick={() => setOpen(p)} className="!p-3.5" style={stagger(Math.min(k, 8), 0.04)} testId={`tr-tpl-${p.program.id}`}>
        <div className="flex items-start gap-2"><p className="min-w-0 flex-1 text-[19px] leading-tight" style={display}>{p.program.name}</p>{added(p.program.name) && <Check className="h-5 w-5 shrink-0" style={{ color: C.lime }} />}</div>
        <p className="mt-1 text-[12px]" style={{ color: C.dim }}>{p.goal} · {p.program.weeks} weeks · {p.perWeek} days a week · {EQUIP_LABEL[p.equip]} · {p.level}</p>
        <p className="mt-1.5 text-[13px]" style={{ color: C.steel }}>{p.blurb}</p></Card>)
        : workouts.map((w, k) => <Card key={w.id} onClick={() => setOpen(w)} className="!p-3.5" style={stagger(Math.min(k, 8), 0.04)}>
          <div className="flex items-start gap-2"><p className="min-w-0 flex-1 text-[18px] leading-tight" style={display}>{w.name}</p>{added(w.name) && <Check className="h-5 w-5 shrink-0" style={{ color: C.lime }} />}</div>
          <p className="mt-1 text-[12px]" style={{ color: C.dim }}>{w.items.length} exercises · {w.mins} min · {EQUIP_LABEL[w.equip]} · {w.level}</p></Card>)}
      {(kind === "programs" ? programs : workouts).length === 0 && <p className="px-1 py-6 text-center text-[14px]" style={{ color: C.dim }}>Nothing matches. Try another level or equipment.</p>}
    </div>
    {open && <Sheet title={"program" in open ? open.program.name : open.name} onClose={() => setOpen(null)} testId="tr-tpl-preview">
      {"program" in open ? <>
        <p className="text-[14px]" style={{ color: C.steel }}>{open.blurb}</p>
        <p className="mt-1 text-[12px]" style={{ color: C.dim }}>{open.program.weeks} weeks · {open.perWeek} days a week · {open.workouts.length} workouts</p>
        {open.workouts.map((w) => <div key={w.id}><Title>{w.name}</Title><WorkoutLines w={w} /></div>)}
        <Btn className="mt-5 w-full" onClick={() => { saveLib(addProgramToLibrary(lib, open)); say(`${open.program.name} added to your library.`); setOpen(null); }} testId="tr-tpl-add">Add program and its {open.workouts.length} workouts</Btn>
      </> : <>
        {open.note && <p className="text-[14px]" style={{ color: C.steel }}>{open.note}</p>}
        <div className="mt-3"><WorkoutLines w={open} /></div>
        <Btn className="mt-5 w-full" onClick={() => { saveLib(addWorkoutToLibrary(lib, open)); say(`${open.name} added to your library.`); setOpen(null); }} testId="tr-tpl-add">Add to my library</Btn>
      </>}
    </Sheet>}
  </Sheet>;
}

export function WorkoutLines({ w }: { w: PlanWorkout }) {
  return <Card className="!p-2">{w.items.map((i, k) => <div key={k} className="flex items-center gap-3 px-2 py-2" style={k ? { borderTop: `1px solid ${C.line}` } : undefined}>
    <Dumbbell className="h-4 w-4 shrink-0" style={{ color: C.dim }} /><span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{i.name}</span>{i.note && <span className="block truncate text-[12px]" style={{ color: C.dim }}>{i.note}</span>}</span>
    <span className="shrink-0 text-[13px]" style={{ color: C.steel }}>{i.sets} × {i.reps}{i.rest ? ` · ${i.rest}s` : ""}</span></div>)}</Card>;
}

const GOALS = ["Build muscle", "Lose fat", "Get stronger", "Get started", "Endurance", "Athletic performance", "Mobility and recovery", "Glutes and legs", "Seniors: strength and balance"];
type AiResult = { kind: "workout"; workout: PlanWorkout } | { kind: "program"; workouts: PlanWorkout[]; program: CoachProgram };

/** The AI builder: describe the client and what you want; it drafts from Cooked's catalog, you review, then save or edit. */
export function AiBuilderSheet({ token, lib, saveLib, onClose, say, only, onWorkout, clientName }: {
  token: string | null; lib: Library; saveLib: (l: Library) => void; onClose: () => void; say: (m: string) => void;
  /** Just a workout (from a client's calendar), handed back instead of only saved. */ only?: "workout"; onWorkout?: (w: PlanWorkout) => void; clientName?: string;
}) {
  const [kind, setKind] = useState<"workout" | "program">(only ?? "program");
  const [goal, setGoal] = useState(GOALS[0]); const [level, setLevel] = useState<Level>("intermediate"); const [equip, setEquip] = useState<Equip>("gym");
  const [minutes, setMinutes] = useState(45); const [perWeek, setPerWeek] = useState(3); const [weeks, setWeeks] = useState(6);
  const [focus, setFocus] = useState(""); const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [result, setResult] = useState<AiResult | null>(null);
  const go = async () => {
    setBusy(true); setErr(""); setResult(null);
    const body = { goal, level, equip, minutes, focus, notes, perWeek, weeks };
    try {
      if (kind === "workout") { const r = await post<{ workout: PlanWorkout }>(token, "/trainer/ai/workout", body); setResult({ kind: "workout", workout: r.workout }); }
      else { const r = await post<{ workouts: PlanWorkout[]; program: CoachProgram }>(token, "/trainer/ai/program", body); setResult({ kind: "program", ...r }); }
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  const save = () => {
    if (!result) return;
    if (result.kind === "workout") { const next = addWorkoutToLibrary(lib, result.workout); saveLib(next); onWorkout?.(next.workouts[next.workouts.length - 1]); say(`${result.workout.name} saved to your library.`); }
    else { saveLib(addProgramToLibrary(lib, result)); say(`${result.program.name} saved with its ${result.workouts.length} workouts.`); }
    onClose();
  };
  const num = (v: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number(v.replace(/\D/g, "")) || lo));
  return <Sheet title={clientName ? `AI workout for ${clientName}` : "Build with AI"} onClose={onClose} testId="tr-ai">
    {!result ? <div className="space-y-4">
      {!only && <Chips label="Build" value={kind} onChange={setKind} items={[{ id: "program", label: "A program" }, { id: "workout", label: "One workout" }]} />}
      <Field label="Goal"><div className="flex flex-wrap gap-1.5">{GOALS.map((g) => <button key={g} type="button" onClick={() => setGoal(g)} className="h-9 rounded-full px-3 text-[13px] font-semibold" style={goal === g ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card2 }}>{g}</button>)}</div></Field>
      <Field label="Level"><Chips label="Level" value={level} onChange={setLevel} items={LEVELS.filter((l) => l.id).map((l) => ({ id: l.id as Level, label: l.label }))} /></Field>
      <Field label="Equipment"><Chips label="Equipment" value={equip} onChange={setEquip} items={EQUIPS.filter((e) => e.id).map((e) => ({ id: e.id as Equip, label: e.label }))} /></Field>
      <div className={`grid gap-2 ${kind === "program" ? "grid-cols-3" : "grid-cols-1"}`}>
        <Field label="Minutes"><input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(num(e.target.value, 10, 120))} className={inputCls} style={inputStyle} /></Field>
        {kind === "program" && <><Field label="Days / week"><input inputMode="numeric" value={perWeek} onChange={(e) => setPerWeek(num(e.target.value, 1, 6))} className={inputCls} style={inputStyle} /></Field>
          <Field label="Weeks"><input inputMode="numeric" value={weeks} onChange={(e) => setWeeks(num(e.target.value, 1, 16))} className={inputCls} style={inputStyle} /></Field></>}
      </div>
      <Field label="Focus (optional)"><input value={focus} onChange={(e) => setFocus(e.target.value.slice(0, 120))} placeholder="Upper body, posterior chain, 5k prep…" className={inputCls} style={inputStyle} /></Field>
      <Field label="Injuries, limits, preferences (optional)"><textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 400))} rows={3} placeholder="Bad left knee, no overhead pressing, loves kettlebells…" className="w-full rounded-[12px] p-3 text-[17px] outline-none" style={inputStyle} /></Field>
      {err && <p className="text-[14px]" style={{ color: C.red }}>{err}</p>}
      <Btn className="w-full" disabled={busy} onClick={go} testId="tr-ai-go"><Sparkles className="h-5 w-5" />{busy ? "Building…" : kind === "program" ? "Build the program" : "Build the workout"}</Btn>
      <p className="px-1 text-[12px]" style={{ color: C.dim }}>It only uses exercises from Cooked's catalog, so each one has a demo for your client. Always review before you send it.</p>
    </div> : <div>
      {result.kind === "workout" ? <><p className="text-[24px] leading-none" style={display}>{result.workout.name}</p>{result.workout.note && <p className="mt-1.5 text-[14px]" style={{ color: C.steel }}>{result.workout.note}</p>}<div className="mt-3"><WorkoutLines w={result.workout} /></div></>
        : <><p className="text-[24px] leading-none" style={display}>{result.program.name}</p>{result.program.note && <p className="mt-1.5 text-[14px]" style={{ color: C.steel }}>{result.program.note}</p>}
          <p className="mt-1 text-[12px]" style={{ color: C.dim }}>{result.program.weeks} weeks · {result.program.days.length} sessions</p>
          {result.workouts.map((w) => <div key={w.id}><Title>{w.name}</Title><WorkoutLines w={w} /></div>)}</>}
      <div className="mt-5 grid grid-cols-2 gap-2"><Btn kind="soft" onClick={() => setResult(null)}><Wand2 className="h-4 w-4" />Try again</Btn><Btn onClick={save} testId="tr-ai-save">{onWorkout ? "Use it" : "Save"}</Btn></div>
      <p className="mt-2 px-1 text-[12px]" style={{ color: C.dim }}>Saved copies open in your library, where you can change any set, rep or exercise.</p>
    </div>}
  </Sheet>;
}

/** The trainer's invite link: share it and a client is connected the moment they open it in Cooked. */
export function InviteSheet({ token, onClose }: { token: string | null; onClose: () => void }) {
  const [inv, setInv] = useState<{ url: string } | null>(null); const [err, setErr] = useState(""); const [copied, setCopied] = useState(false);
  useEffect(() => { void coachApi<{ url: string; code: string }>(token, "/trainer/invite").then(setInv).catch((e) => setErr(e.message)); }, [token]);
  const share = async () => {
    if (!inv) return;
    const text = `Train with me on Cooked. Open this link to connect: ${inv.url}`;
    try { if (navigator.share) { await navigator.share({ title: "Train with me", text, url: inv.url }); return; } } catch { /* fall back to copying */ }
    try { await navigator.clipboard.writeText(inv.url); setCopied(true); } catch { setErr("Couldn't copy on this device. Press and hold the link to copy it."); }
  };
  return <Sheet title="Invite a client" onClose={onClose} testId="tr-invite-sheet">
    <p className="text-[14px]" style={{ color: C.steel }}>Send this link by text, email or Instagram. When your client opens it in Cooked, they choose what to share and you're connected right away. No client limit.</p>
    <Card className="mt-4 !p-3.5"><div className="flex items-center gap-2"><Link2 className="h-5 w-5 shrink-0" style={{ color: C.lime }} /><p className="min-w-0 flex-1 select-all break-all text-[13px] font-semibold" data-testid="tr-invite-url">{inv?.url ?? (err || "Making your link…")}</p></div></Card>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <Btn kind="soft" disabled={!inv} onClick={async () => { if (!inv) return; try { await navigator.clipboard.writeText(inv.url); setCopied(true); } catch { setErr("Couldn't copy on this device."); } }}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy"}</Btn>
      <Btn disabled={!inv} onClick={share}><Share2 className="h-4 w-4" />Share</Btn></div>
    {err && <p className="mt-2 text-[13px]" style={{ color: C.red }}>{err}</p>}
    <p className="mt-4 px-1 text-[12px]" style={{ color: C.dim }}>The same link works for everyone you coach. You don't need a directory listing to coach people you invite.</p>
  </Sheet>;
}
