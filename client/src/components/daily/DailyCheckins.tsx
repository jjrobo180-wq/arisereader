// Daily check-ins drawn as rows of LifeHub's task list (data: useDailyCheckins.ts, rules: shared/dailyCheckins.ts).
// A check-in row looks like a to-do: a circle, a title and one line under it, with the plugin it comes from.
// Tapping the row opens it right there in the list to do the thing: type what you ate (Arise's AI works out the
// calories) or snap a photo of it, log a workout, add water, weigh in, take or skip a dose, tick a routine's steps,
// or check off what someone asked for. Nothing opens over the list, and everything is saved to the plugin.
import { useRef, useState, type ReactNode } from "react";
import { BellOff, Camera, Check, ChevronRight, Droplets, Dumbbell, ListChecks, Loader2, Minus, Moon, Pill, Plus, Repeat, Scale, Settings2, Timer, Users, Utensils, X } from "lucide-react";
import { estimateMeal, shrinkPhoto } from "@/lib/foodLookup";
import { NativeSheet, SheetGroup, SheetRow, SheetSwitch } from "@/components/NativeSheet";
import { SOURCE_NAMES, WORKOUT_TYPES, clock12, type Checkin, type CheckinKind, type FoodIn } from "@shared/dailyCheckins";
import type { FoundFood } from "@shared/foodLookup";
import type { DailyApi } from "./useDailyCheckins";

const ICON: Record<CheckinKind, typeof Utensils> = { meal: Utensils, workout: Dumbbell, water: Droplets, weight: Scale, sleep: Moon, fast: Timer, med: Pill, pill: Pill, habit: Repeat, routine: ListChecks, acct: Users };
const TINT: Record<CheckinKind, string> = { meal: "#f97316", workout: "#6e5ae0", water: "#0ea5e9", weight: "#14b8a6", sleep: "#6366f1", fast: "#f59e0b", med: "#ec4899", pill: "#ec4899", habit: "#22c55e", routine: "#0d9488", acct: "#0d9488" };
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const pill = "inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-semibold transition active:scale-[.97] disabled:opacity-50";
const primary = `${pill} bg-[#6e5ae0] text-white`;
const soft = `${pill} bg-[#f2f2f7] text-slate-800 dark:bg-white/10 dark:text-white`;
const input = "min-h-11 w-full min-w-0 rounded-xl bg-[#f2f2f7] px-3 text-[16px] text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-[#6e5ae0]/40 dark:bg-white/10 dark:text-white";

/** One check-in as a row of the list. `open` is which row is opened (only one at a time). */
export function CheckinRow({ c, d, open, setOpen, dark = false }: { c: Checkin; d: DailyApi; open: string | null; setOpen: (id: string | null) => void; dark?: boolean }) {
  const Icon = ICON[c.kind];
  const isOpen = open === c.id;
  const tap = () => setOpen(isOpen ? null : c.id);
  const tick = () => { if (d.toggle(c) === "open") setOpen(c.id); };
  const late = !c.done && !!c.time && c.time < nowHm();
  return (
    <li className={`${dark ? "border-t border-white/10" : "border-t border-slate-100 dark:border-white/10"} first:border-t-0`} data-testid="checkin-row" data-checkin={c.id}>
      <div className="flex items-center gap-3 px-4 py-3">
        <label className="relative flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition"
          style={c.done ? { background: "#6e5ae0", borderColor: "#6e5ae0", color: "#fff" } : { borderColor: late ? "#e0a3a3" : dark ? "#5b587a" : "#c9c5dc", color: "transparent" }}>
          <input type="checkbox" className="absolute inset-0 cursor-pointer opacity-0" aria-label={`Done: ${c.title}`} checked={c.done} onChange={tick} data-testid="checkin-tick" />
          <Check className="h-[14px] w-[14px]" />
        </label>
        <button type="button" onClick={tap} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left" data-testid="checkin-open">
          <span className="min-w-0 flex-1">
            <span className={`flex items-center gap-1.5 text-[16px] font-semibold leading-snug ${c.done ? "text-slate-400 line-through" : dark ? "text-white" : "text-slate-900 dark:text-white"}`}>
              <Icon className="h-4 w-4 shrink-0" style={{ color: c.done ? "#94a3b8" : TINT[c.kind] }} aria-hidden="true" /><span className="truncate">{c.title}</span>
            </span>
            <span className={`mt-0.5 block truncate text-[13px] ${dark ? "text-white/60" : "text-slate-500 dark:text-white/60"}`}>
              <span className={late ? "font-semibold text-red-600" : ""}>{c.time ? `${late ? "Late · " : ""}${clock12(c.time)} · ` : ""}</span>{c.detail}
            </span>
            {c.progress && !c.done && <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10" aria-hidden="true"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, (c.progress.now / Math.max(1, c.progress.goal)) * 100)}%`, background: TINT[c.kind] }} /></span>}
          </span>
          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${dark ? "bg-white/10 text-white/70" : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/60"}`}>{SOURCE_NAMES[c.source]}</span>
          <ChevronRight className={`h-4 w-4 shrink-0 text-slate-300 transition ${isOpen ? "rotate-90" : ""}`} aria-hidden="true" />
        </button>
      </div>
      {isOpen && <div className={`mx-3 mb-3 rounded-2xl p-3 ${dark ? "bg-white/5" : "bg-[#f8f7fd] dark:bg-white/5"}`} data-testid={`checkin-panel-${c.kind}`}><Panel c={c} d={d} close={() => setOpen(null)} /></div>}
    </li>
  );
}
const nowHm = () => { const n = new Date(); return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`; };

function OpenIn({ c, d, label }: { c: Checkin; d: DailyApi; label?: string }) {
  return <button type="button" onClick={() => d.open(c)} className="inline-flex min-h-10 items-center gap-1 px-1 text-[14px] font-semibold text-[#6e5ae0]">{label || `Open ${SOURCE_NAMES[c.source]}`}<ChevronRight className="h-4 w-4" /></button>;
}

function Panel({ c, d, close }: { c: Checkin; d: DailyApi; close: () => void }) {
  switch (c.kind) {
    case "meal": return <MealPanel c={c} d={d} />;
    case "workout": return <WorkoutPanel c={c} d={d} close={close} />;
    case "water": return <WaterPanel c={c} d={d} />;
    case "weight": return <WeightPanel c={c} d={d} close={close} />;
    case "med": case "pill": return <DosePanel c={c} d={d} close={close} />;
    case "routine": return <RoutinePanel c={c} d={d} />;
    case "acct": return <AcctPanel c={c} d={d} close={close} />;
    default: return <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={c.done ? soft : primary} onClick={() => { d.toggle(c); close(); }}>{c.done ? "Not done" : "Mark done"}</button>
      <OpenIn c={c} d={d} />
    </div>;
  }
}

/** What you ate: typed ("2 eggs and toast") or a photo; Arise's AI estimates it, you look it over, it goes in Cooked. */
function MealPanel({ c, d }: { c: Checkin; d: DailyApi }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<FoundFood[] | null>(null);
  const [err, setErr] = useState("");
  const photo = useRef<HTMLInputElement>(null);
  const logged = d.fit.foods.filter((f) => f.date === d.date && f.meal === c.meal);
  const recent = d.fit.recentFoods.filter((r) => !logged.some((l) => l.name === r.name)).slice(0, 8);
  const ask = async (words: string, image: string | null) => {
    setBusy(true); setErr(""); setFound(null);
    try { const foods = await estimateMeal(d.token, words, image); if (foods.length) setFound(foods); else setErr("Nothing came back. Add it without calories, or try other words."); }
    catch (e: any) { setErr(e?.message || "That couldn't be worked out right now."); }
    finally { setBusy(false); }
  };
  const add = (foods: FoodIn[]) => { d.logMeal(c, foods); setText(""); setFound(null); setErr(""); };
  const asFood = (f: FoundFood): FoodIn => ({ name: f.brand ? `${f.name} (${f.brand})` : f.name, kcal: f.calories, p: f.protein, c: f.carbs, f: f.fat, serving: f.serving });
  return <div className="space-y-3">
    {logged.length > 0 && <ul className="space-y-1" aria-label={`${c.title} so far`}>{logged.map((f) => (
      <li key={f.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 dark:bg-white/10"><span className="min-w-0 flex-1 truncate text-[15px] font-medium">{f.name}</span><span className="text-[13px] tabular-nums text-slate-500">{fmt(f.kcal * f.servings)} cal</span>
        <button type="button" onClick={() => d.removeFood(f.id)} aria-label={`Take ${f.name} off`} className="-mr-1 grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></li>
    ))}</ul>}
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void ask(text.trim(), null); }}>
      <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder={`What did you have for ${c.title.toLowerCase()}?`} aria-label={`What you had for ${c.title.toLowerCase()}`} className={input} data-testid="checkin-meal-text" />
      <button type="button" onClick={() => photo.current?.click()} aria-label="Take a photo of it" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f2f2f7] text-slate-700 dark:bg-white/10 dark:text-white"><Camera className="h-5 w-5" /></button>
      <button type="submit" disabled={!text.trim() || busy} className={primary} data-testid="checkin-meal-go">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log"}</button>
      <input ref={photo} type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { void ask(text.trim(), await shrinkPhoto(f)); } catch (x: any) { setErr(x?.message || "That photo couldn't be opened."); } }} />
    </form>
    {busy && <p className="text-[13px] text-slate-500" role="status">Working out the calories…</p>}
    {found && <div className="rounded-xl bg-white p-2 dark:bg-white/10" data-testid="checkin-meal-found">
      <ul>{found.map((f, i) => <li key={`${i}-${f.name}`} className="flex items-center gap-2 px-1 py-1.5 text-[15px]"><span className="min-w-0 flex-1 truncate">{f.name}{f.serving ? <span className="text-slate-500"> · {f.serving}</span> : null}</span><span className="tabular-nums text-slate-500">{fmt(f.calories)} cal</span></li>)}</ul>
      <div className="mt-1 flex flex-wrap gap-2 px-1 pb-1"><button type="button" className={primary} onClick={() => add(found.map(asFood))} data-testid="checkin-meal-add">Add {found.length > 1 ? `all ${found.length}` : "it"} · {fmt(found.reduce((n, f) => n + f.calories, 0))} cal</button><button type="button" className={soft} onClick={() => setFound(null)}>Cancel</button></div>
    </div>}
    {err && <div className="flex flex-wrap items-center gap-2"><p className="text-[13px] text-rose-700" role="alert">{err}</p>{text.trim() && <button type="button" className={soft} onClick={() => add([{ name: text.trim(), kcal: 0 }])}>Add without calories</button>}</div>}
    {!found && recent.length > 0 && <div><p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Again</p>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">{recent.map((r) => <button key={r.name} type="button" onClick={() => add([{ ...r, servings: r.servings }])} className={`${soft} max-w-[14rem]`}><Plus className="h-3.5 w-3.5" /><span className="truncate">{r.name}</span></button>)}</div></div>}
    <div className="flex flex-wrap items-center justify-between gap-2">{!c.done && <button type="button" className="min-h-10 text-[14px] font-semibold text-slate-500" onClick={() => d.toggle(c)}>I ate, skip logging</button>}<OpenIn c={c} d={d} label="Search foods in Cooked" /></div>
  </div>;
}

function WorkoutPanel({ c, d, close }: { c: Checkin; d: DailyApi; close: () => void }) {
  const [type, setType] = useState<string>("Walk");
  const [mins, setMins] = useState(30);
  const routines = d.fit.routines.slice(0, 4);
  return <div className="space-y-3">
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="radiogroup" aria-label="Kind of workout">{WORKOUT_TYPES.map((t) => <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)} className={type === t ? primary : soft}>{t}</button>)}</div>
    <div className="flex items-center gap-2">
      <button type="button" className="grid h-11 w-11 place-items-center rounded-xl bg-[#f2f2f7] dark:bg-white/10" onClick={() => setMins((m) => Math.max(5, m - 5))} aria-label="5 minutes less"><Minus className="h-4 w-4" /></button>
      <p className="min-w-24 text-center text-[20px] font-bold tabular-nums" aria-live="polite">{mins} min</p>
      <button type="button" className="grid h-11 w-11 place-items-center rounded-xl bg-[#f2f2f7] dark:bg-white/10" onClick={() => setMins((m) => Math.min(300, m + 5))} aria-label="5 minutes more"><Plus className="h-4 w-4" /></button>
      <button type="button" className={`${primary} ml-auto`} onClick={() => { d.logWorkout(type, mins); close(); }} data-testid="checkin-workout-log">Log it</button>
    </div>
    {routines.length > 0 && <div><p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Start one of yours in Cooked</p><div className="flex flex-wrap gap-1.5">{routines.map((r) => <button key={r.id} type="button" className={soft} onClick={() => d.open(c)}>{r.name}</button>)}</div></div>}
    <div className="flex flex-wrap items-center justify-between gap-2">{!c.done && <button type="button" className="min-h-10 text-[14px] font-semibold text-slate-500" onClick={() => { d.toggle(c); close(); }}>Rest day</button>}<OpenIn c={c} d={d} label="Train in Cooked" /></div>
  </div>;
}

function WaterPanel({ c, d }: { c: Checkin; d: DailyApi }) {
  const p = c.progress!;
  return <div className="space-y-3">
    <div className="h-2.5 overflow-hidden rounded-full bg-white dark:bg-white/10"><div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${Math.min(100, (p.now / Math.max(1, p.goal)) * 100)}%` }} /></div>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={primary} onClick={() => d.addWater(250)} data-testid="checkin-water-add">+ 1 cup <span className="opacity-75">250 ml</span></button>
      <button type="button" className={soft} onClick={() => d.addWater(500)}>+ 500 ml</button>
      {p.now > 0 && <button type="button" className={soft} onClick={() => d.addWater(-250)} aria-label="Take a cup off"><Minus className="h-4 w-4" /></button>}
    </div>
    <p className="text-[13px] text-slate-500">{fmt(p.now)} of {fmt(p.goal)} ml{p.now < p.goal ? ` · ${fmt(p.goal - p.now)} to go` : " · goal reached"}</p>
  </div>;
}

function WeightPanel({ c, d, close }: { c: Checkin; d: DailyApi; close: () => void }) {
  const lb = d.fit.profile.units === "lb";
  const [v, setV] = useState("");
  return <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); const n = Number(v); if (n > 0) { d.logWeight(n); close(); } }}>
    <input type="number" inputMode="decimal" step="0.1" min="20" max="900" value={v} onChange={(e) => setV(e.target.value)} placeholder={lb ? "Weight in lb" : "Weight in kg"} aria-label={`Today's weight in ${lb ? "pounds" : "kilograms"}`} className={input} />
    <button type="submit" disabled={!(Number(v) > 0)} className={primary}>Log</button>
    <OpenIn c={c} d={d} label="Chart" />
  </form>;
}

function DosePanel({ c, d, close }: { c: Checkin; d: DailyApi; close: () => void }) {
  return <div className="flex flex-wrap items-center gap-2">
    {c.done ? <button type="button" className={soft} onClick={() => { d.dose(c, null); close(); }}>Undo</button> : <>
      <button type="button" className={primary} onClick={() => { d.dose(c, "taken"); close(); }} data-testid="checkin-dose-taken">Taken</button>
      <button type="button" className={soft} onClick={() => { d.dose(c, "skipped"); close(); }}>Skip</button></>}
    <OpenIn c={c} d={d} />
  </div>;
}

function RoutinePanel({ c, d }: { c: Checkin; d: DailyApi }) {
  const r = d.family.routines.find((x) => x.id === c.ref);
  if (!r) return null;
  const doneSteps = r.doneDate === d.date ? r.doneSteps : [];
  return <div className="space-y-1">
    {r.steps.map((st) => { const on = doneSteps.includes(st.id); return (
      <label key={st.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-white px-3 dark:bg-white/10">
        <input type="checkbox" checked={on} onChange={() => d.routineStep(c, st.id, !on)} className="h-5 w-5 accent-[#6e5ae0]" /><span className={`text-[15px] ${on ? "text-slate-400 line-through" : ""}`}>{st.text}</span>
      </label>); })}
    {!r.steps.length && <p className="text-[13px] text-slate-500">No steps yet.</p>}
    <OpenIn c={c} d={d} />
  </div>;
}

function AcctPanel({ c, d, close }: { c: Checkin; d: DailyApi; close: () => void }) {
  return <div className="flex flex-wrap items-center gap-2">
    {!c.done && c.quick && <button type="button" className={primary} onClick={() => { d.toggle(c); close(); }}>Mark done</button>}
    {!c.done && !c.quick && <button type="button" className={primary} onClick={() => d.open(c)}>Do it in Accountability</button>}
    <OpenIn c={c} d={d} />
  </div>;
}

/* ---------------- settings ---------------- */

const TIMED: CheckinKind[] = ["meal", "workout", "weight", "sleep", "habit", "routine", "water", "fast"];
const EXTRAS: { id: string; label: string; sub: string }[] = [
  { id: "cooked:snack", label: "Snack", sub: "A snack row each day" },
  { id: "cooked:weight", label: "Weigh in", sub: "A weigh-in row each day" },
  { id: "cooked:sleep", label: "Sleep", sub: "Log last night's sleep each morning" },
];

/** Which check-ins show, their times and which ones remind, laid out like iPhone Settings. */
export function DailySettingsSheet({ d, onClose }: { d: DailyApi; onClose: () => void }) {
  const s = d.settings;
  const set = d.setSettings;
  const toggleIn = (key: "off" | "mute" | "extra", id: string, on: boolean) => set((x) => ({ ...x, [key]: on ? [...new Set([...x[key], id])] : x[key].filter((y) => y !== id) }));
  const bySource = new Map<string, Checkin[]>();
  for (const c of d.all) { const k = SOURCE_NAMES[c.source]; bySource.set(k, [...(bySource.get(k) || []), c]); }
  return <NativeSheet title="Check-ins" onClose={onClose} cancelLabel="" doneLabel="Done" testId="daily-settings">
    <SheetGroup note="Your plugins' daily things (meals, workouts, water, medicines, habits, routines and what someone asked you to do) sit in your task list, and tick themselves when you do them anywhere.">
      <SheetRow icon={<ListChecks />} color="#6e5ae0" label="Show in Tasks" right={<SheetSwitch on={s.on} label="Show check-ins in Tasks" onChange={(on) => set((x) => ({ ...x, on }))} testId="daily-on" />} />
      <SheetRow icon={<BellOff />} color="#ff3b30" label="Remind me" sub={s.remind ? "At each check-in's time, until it's done" : undefined} right={<SheetSwitch on={s.remind} label="Remind me" onChange={(remind) => set((x) => ({ ...x, remind }))} testId="daily-remind" />} />
    </SheetGroup>
    {s.on && <>
      <SheetGroup caption="Add more">{EXTRAS.map((e) => <SheetRow key={e.id} label={e.label} sub={e.sub} right={<SheetSwitch on={s.extra.includes(e.id)} label={e.label} onChange={(on) => toggleIn("extra", e.id, on)} />} />)}</SheetGroup>
      {[...bySource.entries()].map(([source, list]) => (
        <SheetGroup key={source} caption={source}>{list.map((c) => {
          const Icon = ICON[c.kind];
          const canTime = TIMED.includes(c.kind);
          return <SheetRow key={c.id} icon={<Icon />} color={TINT[c.kind]} label={c.title}
            right={<span className="flex items-center gap-2">
              {canTime && <input type="time" aria-label={`Time for ${c.title}`} value={s.times[c.id] || c.time || ""} onChange={(e) => set((x) => { const times = { ...x.times }; if (e.target.value) times[c.id] = e.target.value; else delete times[c.id]; return { ...x, times }; })} className="min-h-9 w-[6.5rem] rounded-lg bg-[#f2f2f7] px-2 text-[15px] outline-none dark:bg-white/10" />}
              {s.remind && c.time && canTime && c.kind !== "water" && <button type="button" aria-pressed={!s.mute.includes(c.id)} aria-label={`${s.mute.includes(c.id) ? "Turn on" : "Turn off"} the reminder for ${c.title}`} onClick={() => toggleIn("mute", c.id, !s.mute.includes(c.id))} className={`grid h-9 w-9 place-items-center rounded-lg ${s.mute.includes(c.id) ? "text-slate-300" : "text-[#6e5ae0]"}`}>{s.mute.includes(c.id) ? <BellOff className="h-4 w-4" /> : <BellIcon />}</button>}
              <SheetSwitch on={!s.off.includes(c.id)} label={`Show ${c.title}`} onChange={(on) => toggleIn("off", c.id, !on)} />
            </span>} />;
        })}</SheetGroup>
      ))}
      {!d.all.length && <SheetGroup note="Add Cooked, Habits, Routines, Pills or Accountability from the Plugin Gallery, and their daily things show up here."><SheetRow label="Nothing to check in yet" /></SheetGroup>}
    </>}
  </NativeSheet>;
}
const BellIcon = () => <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;

/** For looks that don't mix check-ins into their own sections: one card of them, above or below the to-dos. */
export function DailySection({ d, dark = false, header }: { d: DailyApi; dark?: boolean; header?: ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  if (!d.settings.on) return null;
  return <section className={`overflow-hidden rounded-3xl ${dark ? "bg-white/5" : "bg-white shadow-[0_1px_3px_#1d1b330f] ring-1 ring-slate-100 dark:bg-[#151325] dark:ring-white/10"}`} aria-label="Your day" data-testid="daily-section">
    <div className="flex items-center gap-2 px-4 pt-3">
      <h3 className={`text-[13px] font-extrabold ${dark ? "text-white/60" : "text-slate-500"}`}>{header ?? "Your day"} <span className="tabular-nums">· {d.done} of {d.total}</span></h3>
      <DailySettingsButton d={d} open={settings} setOpen={setSettings} dark={dark} />
    </div>
    {d.items.length ? <ul>{d.items.map((c) => <CheckinRow key={c.id} c={c} d={d} open={open} setOpen={setOpen} dark={dark} />)}</ul>
      : <p className={`px-4 pb-4 pt-2 text-[14px] ${dark ? "text-white/60" : "text-slate-500"}`}>Nothing to check in today.</p>}
  </section>;
}

export function DailySettingsButton({ d, open, setOpen, dark = false }: { d: DailyApi; open: boolean; setOpen: (o: boolean) => void; dark?: boolean }) {
  return <>
    <button type="button" onClick={() => setOpen(true)} className={`ml-auto inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 text-[13px] font-bold ${dark ? "text-white/70 hover:bg-white/10" : "text-[#5b47d6] hover:bg-[#f4f2ff]"}`} data-testid="daily-settings-open"><Settings2 className="h-4 w-4" />Check-ins</button>
    {open && <DailySettingsSheet d={d} onClose={() => setOpen(false)} />}
  </>;
}
