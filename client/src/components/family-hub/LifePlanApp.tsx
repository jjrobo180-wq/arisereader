// AI Reminders (LifeHub section "lifeplan"): ask what life someone is driving toward, build a full reminder
// schedule around their day with the AI (or the built-in planner), lay out the plan and the science behind
// it, then run it: today's reminders with Done, Snooze and Skip, and phone reminders through LifeHub's
// notifications. The plan and its logic live in shared/lifePlan.ts.
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Bell, BellOff, Check, ChevronDown, Clock, ExternalLink, Loader2, Plus, RefreshCw, SkipForward, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { isOn, type FamilySection } from "@shared/familyHub";
import {
  PLAN_AREAS, PLAN_FOCUSES, PLAN_OPENS, SNOOZE_CHOICES, builtinPlan, clock12, cleanLifePlan, cleanPlanRequest, fromMinutes, markReminder, snoozeReminder,
  todayItems, toMinutes, weekScore, type LifePlan, type PlanArea, type PlanFocus, type PlanOpens, type PlanReminder, type PlanRequest,
} from "@shared/lifePlan";
import { SECTION_INFO } from "./Members";
import { Empty, PageHead, Panel, danger, inputClass, plain, primary, soft, type SectionProps } from "./ui";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const partOfDay = (m: number) => (m < 12 * 60 ? "Morning" : m < 17 * 60 ? "Afternoon" : "Evening");
const daysLabel = (d: number[]) => d.length === 7 ? "Every day" : d.join() === "1,2,3,4,5" ? "Weekdays" : d.join() === "0,6" ? "Weekends" : d.map((x) => DAY_NAMES[x].slice(0, 3)).join(", ");
/** Where the hub leaves a reminder to show when a phone notification was tapped (see AriseTodo). */
export const PLAN_FOCUS_KEY = "arise_lifeplan_focus";

type Props = SectionProps & { go: (section: FamilySection) => void; openStore: () => void };

export default function LifePlanApp(props: Props) {
  const { family } = props;
  const plan = family.lifePlan;
  const [draft, setDraft] = useState<LifePlan | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  if (draft) return <Review {...props} draft={draft} setDraft={setDraft} onDone={() => { setDraft(null); setRebuilding(false); }} />;
  if (!plan || rebuilding) return <Builder {...props} start={plan} onBuilt={setDraft} onCancel={plan ? () => setRebuilding(false) : undefined} />;
  return <Running {...props} plan={plan} onRebuild={() => setRebuilding(true)} />;
}

// ─── 1. Ask ──────────────────────────────────────────────────────────────────

function Builder({ family, say, start, onBuilt, onCancel }: Props & { start?: LifePlan; onBuilt: (p: LifePlan) => void; onCancel?: () => void }) {
  const { token } = useAuth();
  const [vision, setVision] = useState(start?.vision ?? "");
  const [focuses, setFocuses] = useState<PlanFocus[]>([]);
  const [wake, setWake] = useState(start?.wake ?? "07:00");
  const [bed, setBed] = useState(start?.bed ?? "22:30");
  const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const request: PlanRequest = cleanPlanRequest({ vision, focuses, wake, bed, workDays });
  const ready = !!vision.trim() || focuses.length > 0;
  const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  const offline = (why: string) => { onBuilt(builtinPlan(request)); setProblem(""); say(why); };

  const build = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!ready || busy) return;
    setBusy(true); setProblem("");
    try {
      const res = await fetch(`${API_BASE}/api/life-plan/build`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ ...request, today: new Date().toISOString().slice(0, 10) }) });
      const body: any = await res.json().catch(() => null);
      const built = res.ok ? cleanLifePlan(body?.plan) : undefined;
      if (built) { onBuilt({ ...built, madeBy: "ai" }); return; }
      // No AI left this month, the AI is off or busy, or its answer was unusable: show why, and offer the built-in planner.
      setProblem(body?.message || "The AI couldn't build your plan right now.");
    } catch {
      setProblem("Couldn't reach the AI. Check your connection.");
    } finally { setBusy(false); }
  };

  return <div className="space-y-6">
    <PageHead eyebrow="AI Reminders" title="What kind of life are you driving toward?" blurb="Say it in your own words. AI turns it into a full schedule of reminders that fits your day, and shows you the science of why each one helps."
      action={onCancel && <button type="button" onClick={onCancel} className={plain + " min-h-11"}>Back to my plan</button>} />
    <form onSubmit={build} className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <Panel title="In your words">
          <textarea value={vision} onChange={(e) => setVision(e.target.value)} maxLength={600} rows={4} className={inputClass + " py-3 leading-6"} data-testid="plan-vision"
            placeholder="For example: I want to be closer to God, have more energy for my kids, eat better and actually get to the gym. I'm always tired and my evenings are a blur." aria-label="The life you want" />
          <p className="mt-2 text-xs text-slate-500">The more you share (what's hard right now, what a good day looks like), the better your plan.</p>
        </Panel>
        <Panel title="What matters most?">
          <div className="flex flex-wrap gap-2" data-testid="plan-focuses">{PLAN_FOCUSES.map((f) => { const on = focuses.includes(f.id); return <button key={f.id} type="button" onClick={() => setFocuses(toggle(focuses, f.id))} aria-pressed={on}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold transition ${on ? "border-violet-500 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-violet-300"}`}><span aria-hidden>{f.emoji}</span>{f.label}</button>; })}</div>
        </Panel>
      </div>
      <div className="space-y-6">
        <Panel title="Your day">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-bold text-slate-500">I wake up<input type="time" value={wake} onChange={(e) => setWake(e.target.value)} className={inputClass + " mt-1"} /></label>
            <label className="text-xs font-bold text-slate-500">I go to bed<input type="time" value={bed} onChange={(e) => setBed(e.target.value)} className={inputClass + " mt-1"} /></label>
          </div>
          <p className="mb-1.5 mt-4 text-xs font-bold text-slate-500">Work or school days</p>
          <div className="flex gap-1">{DAY_LETTERS.map((l, d) => { const on = workDays.includes(d); return <button key={d} type="button" onClick={() => setWorkDays(toggle(workDays, d).sort())} aria-pressed={on} aria-label={DAY_NAMES[d]}
            className={`h-10 flex-1 rounded-xl text-sm font-bold ${on ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}>{l}</button>; })}</div>
        </Panel>
        <div className="space-y-2 rounded-[1.5rem] bg-gradient-to-br from-[#2d2555] to-[#6d5ce7] p-5 text-white">
          <button type="submit" disabled={!ready || busy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 text-base font-extrabold text-[#3b2f8f] shadow-sm disabled:opacity-60" data-testid="plan-build">
            {busy ? <><Loader2 size={18} className="animate-spin" /> Building your plan…</> : <><Sparkles size={18} /> Build my plan with AI</>}
          </button>
          <button type="button" disabled={!ready || busy} onClick={() => offline("Plan made with the built-in planner")} className="w-full text-center text-xs font-semibold text-violet-100 underline decoration-violet-300/60 underline-offset-4 disabled:opacity-50" data-testid="plan-build-builtin">Or build it without AI</button>
          {busy && <p className="text-center text-xs text-violet-100">Looking at your day and the research… this takes about 20 seconds.</p>}
        </div>
        {problem && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          <p className="font-semibold">{problem}</p>
          <button type="button" onClick={() => offline("Plan made with the built-in planner")} className={soft + " mt-3 w-full"}><Wand2 size={15} /> Use the built-in planner instead</button>
        </div>}
        {!ready && <p className="text-center text-xs text-slate-400">Write a sentence or pick at least one thing that matters.</p>}
        {family.lifePlan && <p className="text-center text-xs text-slate-400">Building a new plan replaces your current one when you start it.</p>}
      </div>
    </form>
  </div>;
}

// ─── 2. Review the plan, then start it ───────────────────────────────────────

function Review({ family, setFamily, say, draft, setDraft, onDone }: Props & { draft: LifePlan; setDraft: (p: LifePlan | null) => void; onDone: () => void }) {
  const on = draft.reminders.filter((r) => !r.off).length;
  const begin = () => {
    // A rebuilt plan keeps nothing from the old one's log, since its reminders are new.
    setFamily((f) => ({ ...f, lifePlan: { ...draft, on: true, log: {}, snoozed: {}, createdAt: new Date().toISOString() } }));
    say(`Your plan is on: ${on} reminders.`);
    onDone();
  };
  return <div className="space-y-6">
    <PageHead eyebrow="AI Reminders · your plan" title="This is your life plan" blurb={draft.madeBy === "ai" ? "Built by AI from what you told it. Change anything, then start it." : "Made with the built-in planner. Change anything, then start it."} />
    <PlanOverview plan={draft} />
    <Panel title={`Your reminders · ${on} on`}>
      <ReminderEditor plan={draft} setPlan={(p) => setDraft(p)} family={family} />
    </Panel>
    <div className="sticky bottom-3 z-10 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
      <button type="button" onClick={begin} disabled={!on} className={primary + " min-h-12 flex-1 text-base"} data-testid="plan-start"><Bell size={18} /> Start my reminders</button>
      <button type="button" onClick={() => setDraft(null)} className={plain + " min-h-12"}>Start over</button>
    </div>
  </div>;
}

/** The "this is your life" overview: their vision, the plan in plain words, and the pillars. */
function PlanOverview({ plan }: { plan: LifePlan }) {
  return <div className="space-y-4">
    <div className="rounded-[1.75rem] bg-gradient-to-br from-[#2d2555] via-[#4b3fa0] to-[#6d5ce7] p-6 text-white shadow-[0_18px_40px_#4b3fa033] sm:p-8" data-testid="plan-overview">
      <p className="text-xs font-extrabold uppercase tracking-[.18em] text-violet-200">The life you're building</p>
      <p className="mt-2 text-xl font-black leading-snug sm:text-2xl">“{plan.vision}”</p>
      <div className="mt-5 space-y-3 text-[15px] leading-7 text-violet-50">{plan.summary.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}</div>
    </div>
    {plan.pillars.length > 0 && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{plan.pillars.map((p, i) => <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="flex items-center gap-2 text-sm font-black text-slate-900"><span className="text-xl" aria-hidden>{PLAN_AREAS[p.area].emoji}</span>{p.title}</p>
      <p className="mt-1.5 text-sm leading-6 text-slate-600">{p.why}</p>
    </div>)}</div>}
    <p className="text-[11px] leading-5 text-slate-400">Reminders help you build habits; they aren't medical advice. For health conditions, medicines or big diet changes, check with your doctor.</p>
  </div>;
}

/** Every reminder, grouped by time of day: switch on or off, change the time or days, delete, or add your own. */
function ReminderEditor({ plan, setPlan, family }: { plan: LifePlan; setPlan: (p: LifePlan) => void; family: SectionProps["family"] }) {
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const edit = (id: string, patch: Partial<PlanReminder>) => setPlan({ ...plan, reminders: plan.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)).sort((a, z) => a.time.localeCompare(z.time)) });
  const remove = (id: string) => setPlan({ ...plan, reminders: plan.reminders.filter((r) => r.id !== id) });
  const groups = ["Morning", "Afternoon", "Evening"].map((g) => ({ g, list: plan.reminders.filter((r) => partOfDay(toMinutes(r.time) ?? 0) === g) })).filter((x) => x.list.length);
  return <div className="space-y-5" data-testid="plan-editor">
    {groups.map(({ g, list }) => <section key={g}>
      <h3 className="mb-2 text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">{g}</h3>
      <ul className="space-y-2">{list.map((r) => { const expanded = open === r.id; return <li key={r.id} className={`rounded-2xl border ${r.off ? "border-slate-100 bg-slate-50 opacity-60" : "border-slate-200 bg-white"}`}>
        <div className="flex items-start gap-3 p-3">
          <span className="mt-0.5 text-xl" aria-hidden>{r.emoji}</span>
          <button type="button" onClick={() => setOpen(expanded ? null : r.id)} className="min-w-0 flex-1 text-left" aria-expanded={expanded}>
            <span className="block text-sm font-extrabold text-slate-900">{r.title}</span>
            <span className="mt-0.5 block text-xs text-slate-500">{clock12(r.time)} · {daysLabel(r.days)}{r.opens ? ` · opens ${SECTION_INFO[r.opens]?.label ?? PLAN_OPENS[r.opens]}` : ""}</span>
            {r.why && <span className={`mt-1.5 block text-xs leading-5 text-slate-600 ${expanded ? "" : "line-clamp-2"}`}><span className="font-bold text-violet-700">Why: </span>{r.why}</span>}
          </button>
          <label className="relative inline-flex cursor-pointer items-center" title={r.off ? "Off" : "On"}>
            <input type="checkbox" checked={!r.off} onChange={(e) => edit(r.id, { off: e.target.checked ? undefined : true })} className="peer sr-only" aria-label={`${r.title} on`} />
            <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-violet-600 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
          </label>
        </div>
        {expanded && <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-3">
          <input type="time" value={r.time} onChange={(e) => { const m = toMinutes(e.target.value); if (m !== null) edit(r.id, { time: fromMinutes(m) }); }} className={inputClass + " w-32"} aria-label="Time" />
          <div className="flex gap-1">{DAY_LETTERS.map((l, d) => { const onDay = r.days.includes(d); return <button key={d} type="button" aria-pressed={onDay} aria-label={DAY_NAMES[d]} onClick={() => { const next = onDay ? r.days.filter((x) => x !== d) : [...r.days, d].sort(); if (next.length) edit(r.id, { days: next }); }}
            className={`h-9 w-9 rounded-lg text-xs font-bold ${onDay ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}>{l}</button>; })}</div>
          <button type="button" onClick={() => remove(r.id)} className={danger + " ml-auto"} aria-label={`Delete ${r.title}`}><Trash2 size={15} /></button>
        </div>}
      </li>; })}</ul>
    </section>)}
    {!plan.reminders.length && <Empty icon={<Clock />} title="No reminders yet">Add your own below.</Empty>}
    {adding ? <AddReminder family={family} onAdd={(r) => { setPlan({ ...plan, reminders: [...plan.reminders, { ...r, id: `u${Date.now().toString(36)}` }].sort((a, z) => a.time.localeCompare(z.time)) }); setAdding(false); }} onCancel={() => setAdding(false)} />
      : <button type="button" onClick={() => setAdding(true)} className={soft + " w-full"}><Plus size={16} /> Add your own reminder</button>}
  </div>;
}

function AddReminder({ onAdd, onCancel }: { family: SectionProps["family"]; onAdd: (r: Omit<PlanReminder, "id">) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("08:00");
  const [area, setArea] = useState<PlanArea>("mind");
  const [opens, setOpens] = useState<PlanOpens | "">("");
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const m = toMinutes(time);
    if (!title.trim() || m === null || !days.length) return;
    onAdd({ title: title.trim().slice(0, 80), emoji: PLAN_AREAS[area].emoji, time: fromMinutes(m), days, area, why: "", ...(opens ? { opens } : {}) });
  };
  return <form onSubmit={submit} className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/50 p-4" data-testid="plan-add">
    <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="What to do (Take my vitamins)" className={inputClass} aria-label="Reminder" />
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} aria-label="Time" />
      <select value={area} onChange={(e) => setArea(e.target.value as PlanArea)} className={inputClass} aria-label="Area">{(Object.keys(PLAN_AREAS) as PlanArea[]).map((a) => <option key={a} value={a}>{PLAN_AREAS[a].emoji} {PLAN_AREAS[a].label}</option>)}</select>
      <select value={opens} onChange={(e) => setOpens(e.target.value as PlanOpens | "")} className={inputClass} aria-label="Opens"><option value="">Opens nothing</option>{(Object.keys(PLAN_OPENS) as PlanOpens[]).map((o) => <option key={o} value={o}>Opens {SECTION_INFO[o]?.label ?? PLAN_OPENS[o]}</option>)}</select>
    </div>
    <div className="flex gap-1">{DAY_LETTERS.map((l, d) => { const on = days.includes(d); return <button key={d} type="button" aria-pressed={on} aria-label={DAY_NAMES[d]} onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d].sort())}
      className={`h-10 flex-1 rounded-xl text-sm font-bold ${on ? "bg-slate-900 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>{l}</button>; })}</div>
    <div className="flex gap-2"><button type="submit" className={primary + " flex-1"} disabled={!title.trim() || !days.length}>Add reminder</button><button type="button" onClick={onCancel} className={plain}>Cancel</button></div>
  </form>;
}

// ─── 3. Running: today, the plan, and the schedule ───────────────────────────

function Running({ family, setFamily, today, say, go, openStore, plan, onRebuild }: Props & { plan: LifePlan; onRebuild: () => void }) {
  const [tab, setTab] = useState<"today" | "plan" | "schedule">("today");
  const [minutes, setMinutes] = useState(nowMinutes);
  const [focus, setFocus] = useState<string | null>(() => { try { const f = sessionStorage.getItem(PLAN_FOCUS_KEY); sessionStorage.removeItem(PLAN_FOCUS_KEY); return f; } catch { return null; } });
  const [snoozing, setSnoozing] = useState<string | null>(null);
  const focusRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => { const t = window.setInterval(() => setMinutes(nowMinutes()), 30_000); return () => window.clearInterval(t); }, []);
  // A tapped phone notification lands here: show today's list, with that reminder picked out.
  useEffect(() => {
    const pick = () => { try { const f = sessionStorage.getItem(PLAN_FOCUS_KEY); if (f) { sessionStorage.removeItem(PLAN_FOCUS_KEY); setFocus(f); setTab("today"); } } catch { /* fine */ } };
    window.addEventListener("arise-lifeplan-focus", pick);
    return () => window.removeEventListener("arise-lifeplan-focus", pick);
  }, []);
  useEffect(() => { if (focus && tab === "today") focusRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [focus, tab]);

  const setPlan = (update: (p: LifePlan) => LifePlan) => setFamily((f) => (f.lifePlan ? { ...f, lifePlan: update(f.lifePlan) } : f));
  const items = useMemo(() => todayItems(plan, today, minutes), [plan, today, minutes]);
  const doneCount = items.filter((i) => i.state === "done").length;
  const week = weekScore(plan, today);
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  const tabBtn = (id: typeof tab, label: string) => <button type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`min-h-11 flex-1 rounded-xl px-3 text-sm font-bold transition ${tab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{label}</button>;

  return <div className="space-y-6">
    <PageHead eyebrow="AI Reminders" title="Your day, on purpose" blurb={`“${plan.vision.length > 120 ? plan.vision.slice(0, 117) + "…" : plan.vision}”`}
      action={<button type="button" onClick={() => setPlan((p) => ({ ...p, on: !p.on }))} aria-pressed={plan.on} className={(plan.on ? soft : plain) + " min-h-11"} data-testid="plan-phone-toggle">{plan.on ? <><Bell size={16} /> Phone reminders on</> : <><BellOff size={16} /> Phone reminders off</>}</button>} />
    {plan.on && <p className="-mt-3 text-xs text-slate-500">Reminders reach your phone when notifications are on for this device. <button type="button" onClick={() => go("notifications")} className="font-bold text-violet-700 hover:underline">Check notifications</button></p>}

    <div className="grid grid-cols-3 gap-3">
      <Stat label="Today" value={`${doneCount}/${items.length}`} />
      <Stat label="This week" value={week.total ? `${Math.round((week.done / week.total) * 100)}%` : "—"} />
      <Stat label="Reminders" value={String(plan.reminders.filter((r) => !r.off).length)} />
    </div>

    <div role="tablist" className="flex gap-1 rounded-2xl bg-slate-100 p-1">{tabBtn("today", "Today")}{tabBtn("plan", "My plan")}{tabBtn("schedule", "Schedule")}</div>

    {tab === "today" && <div className="space-y-3" data-testid="plan-today">
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all" style={{ width: `${pct}%` }} /></div>
      {items.length ? <ul className="space-y-2">{items.map((it) => {
        const isFocus = focus === it.id;
        const opensOn = it.opens && isOn(it.opens, family);
        const finished = it.state === "done" || it.state === "skip";
        return <li key={it.id} ref={isFocus ? focusRef : undefined} className={`rounded-2xl border p-3 transition ${isFocus ? "border-violet-400 ring-4 ring-violet-100" : finished ? "border-slate-100 bg-slate-50" : it.state === "due" && minutes - it.at < 45 ? "border-amber-200 bg-amber-50/60" : "border-slate-200 bg-white"}`} data-testid={`plan-item-${it.id}`}>
          <div className="flex items-start gap-3">
            <span className="w-14 shrink-0 pt-0.5 text-xs font-bold text-slate-500 sm:w-16">{clock12(fromMinutes(it.at))}</span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-extrabold ${finished ? "text-slate-400 line-through" : "text-slate-900"}`}><span className="mr-1.5" aria-hidden>{it.emoji}</span>{it.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{it.state === "done" ? "Done ✓" : it.state === "skip" ? "Skipped today" : it.state === "snoozed" ? `Snoozed until ${clock12(fromMinutes(it.at))}` : it.state === "due" ? (minutes - it.at < 45 ? "Now" : "Earlier today") : "Later today"}{it.why && !finished ? ` · ${it.why.split(/(?<=[.!?])\s/)[0]}` : ""}</p>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:pl-[4.75rem]">
            {finished
              ? <button type="button" onClick={() => setPlan((p) => markReminder(p, it.id, today, null))} className={plain + " min-h-9 text-xs"}><RefreshCw size={13} /> Undo</button>
              : <>
                <button type="button" onClick={() => { setPlan((p) => markReminder(p, it.id, today, "done")); setFocus(null); say(`Nice. ${it.title} done.`); }} className={primary + " min-h-9 text-xs"} data-testid={`plan-done-${it.id}`}><Check size={14} /> Done</button>
                <div className="relative">
                  <button type="button" onClick={() => setSnoozing(snoozing === it.id ? null : it.id)} aria-expanded={snoozing === it.id} className={plain + " min-h-9 text-xs"} data-testid={`plan-snooze-${it.id}`}><Clock size={13} /> Snooze <ChevronDown size={12} /></button>
                  {snoozing === it.id && <div role="menu" className="absolute left-0 top-[calc(100%+4px)] z-20 w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">{SNOOZE_CHOICES.map((c) => <button key={c.minutes} type="button" role="menuitem"
                    onClick={() => { setPlan((p) => snoozeReminder(p, it.id, today, nowMinutes(), c.minutes)); setSnoozing(null); setFocus(null); say(`Snoozed for ${c.label}. We'll remind you again.`); }}
                    className="flex min-h-9 w-full items-center rounded-lg px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">{c.label}</button>)}</div>}
                </div>
                <button type="button" onClick={() => { setPlan((p) => markReminder(p, it.id, today, "skip")); setFocus(null); }} className={plain + " min-h-9 text-xs"}><SkipForward size={13} /> Skip</button>
              </>}
            {it.opens && (opensOn
              ? <button type="button" onClick={() => go(it.opens!)} className={soft + " min-h-9 text-xs"}><ExternalLink size={13} /> Open {SECTION_INFO[it.opens]?.label ?? PLAN_OPENS[it.opens]}</button>
              : <button type="button" onClick={openStore} className="min-h-9 rounded-xl px-2 text-xs font-semibold text-violet-700 hover:underline">Get {SECTION_INFO[it.opens]?.label ?? PLAN_OPENS[it.opens]} in the App Store</button>)}
          </div>
        </li>;
      })}</ul> : <Empty icon={<Sparkles />} title="Nothing on today">Enjoy the rest. Your next reminders are on the Schedule tab.</Empty>}
      {items.length > 0 && doneCount === items.length && <p className="rounded-2xl bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-800">Everything done today. That's how a life changes: one ordinary day at a time. 🎉</p>}
    </div>}

    {tab === "plan" && <div className="space-y-4">
      <PlanOverview plan={plan} />
      <button type="button" onClick={onRebuild} className={plain + " w-full"} data-testid="plan-rebuild"><Wand2 size={16} /> Rebuild my plan</button>
    </div>}

    {tab === "schedule" && <Panel title="Your reminders">
      <ReminderEditor plan={plan} setPlan={(next) => setPlan(() => next)} family={family} />
      <button type="button" onClick={() => { if (window.confirm("Delete your whole plan and its reminders?")) { setFamily((f) => { const { lifePlan: _gone, ...rest } = f; return rest; }); say("Plan deleted"); } }} className={danger + " mt-5 w-full"}><Trash2 size={15} /> Delete my plan</button>
    </Panel>}
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center"><p className="text-2xl font-black text-slate-900">{value}</p><p className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-400">{label}</p></div>;
}
