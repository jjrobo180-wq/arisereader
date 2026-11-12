// Arise To Duo's first-run setup (Nov 2026): full-screen pages that actually set the app up, before the
// tour. Pick a look, pick goals, tell it your day (a routine of repeating reminders is made from it), then
// pick your first apps. It always draws in day mode (on the page body, outside the hub's night mode and
// theme), each page fits on one screen, and nothing slides sideways. It respects Free's 3 apps: the
// routine's AI Reminders counts as one, and building with AI is offered only on Unlimited.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Apple, ArrowLeft, Check, Dumbbell, Loader2, Moon, NotebookPen, Sparkles, UtensilsCrossed, Wallet, type LucideIcon } from "lucide-react";
import { HUB_THEMES } from "@shared/appThemes";
import { setTheme, type AnyLayout } from "@shared/hubLayout";
import { PLUGIN_COUNT_LABEL, setLifePlugin, type Plugin } from "@shared/pluginStore";
import { PLAN_FOCUSES, builtinPlan, cleanLifePlan, cleanPlanRequest, type LifePlan, type PlanFocus, type PlanRequest } from "@shared/lifePlan";
import type { Family } from "@shared/familyHub";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { BACKDROP_REFRESH, sendBackdrop } from "@/lib/nativeBackdrop";
import { lockPageScroll } from "@/lib/scrollLock";
import { markSeen } from "@/lib/seenOnce";

/** Day mode, whatever the hub looks like: the page body can carry a theme's classes (so pop-ups match the
 *  hub), and their rules read these variables, so setting them here keeps every page of setup light. */
const SYSTEM_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif";
const SETUP_STYLE = {
  fontFamily: SYSTEM_FONT, colorScheme: "light", background: "#ffffff", color: "#111018",
  "--an-card": "#ffffff", "--an-card2": "#f4f3f8", "--an-ink": "#111018", "--an-muted": "#8e8ba0", "--an-line": "rgba(17,16,24,.1)",
  "--an-bg": "#ffffff", "--an-radius": "16px", "--an-serif": SYSTEM_FONT, "--an-font": SYSTEM_FONT, "--an-accent": "#5b4fe0",
  "--an-violet": "#5b4fe0", "--an-violet-ink": "#3f35c9", "--an-violet-soft": "#f4f2ff", "--an-on-accent": "#ffffff", "--an-edge": "rgba(17,16,24,.1)",
  "--an-border": "rgba(17,16,24,.1)", "--an-coral": "#e0465f", "--an-shadow": "none",
} as CSSProperties;

// v2: the new setup (day mode, one screen, app descriptions) goes out once to every To Duo account,
// including people who finished the first one.
const DONE_KEY = (id: number | string) => `arise-duo-setup-v2:${id}`;
export const duoSetupDone = (id: number | string) => { try { return localStorage.getItem(DONE_KEY(id)) === "1"; } catch { return true; } };
/** This device learns the account already did setup elsewhere (lib/seenOnce.ts). */
export const rememberDuoSetupDone = (id: number | string) => { try { localStorage.setItem(DONE_KEY(id), "1"); } catch { /* asked again next time */ } };

/** Twelve looks to start from; the rest are in Customize. */
const STARTER_THEMES = ["classic", "studio", "bloom", "frost", "aurora", "zen", "tide", "grove", "glass", "cassette", "vinyl", "console"];
/** Everyday apps most people want first, in this order. */
const STARTER_APPS: { id: string; icon: LucideIcon }[] = [
  { id: "life-healthlite", icon: Apple }, { id: "life-moneyhub", icon: Wallet },
  { id: "life-ai-meal-plan", icon: UtensilsCrossed }, { id: "life-inspire", icon: NotebookPen },
  { id: "life-ai-workout-plan", icon: Dumbbell }, { id: "life-sleep-studio", icon: Moon },
];
/** How many favorites the step shows: the list above, topped up with the Plugin Gallery's featured ones
 *  (so the step is never empty if a plugin above is renamed or retired). */
const STARTER_COUNT = 8;
/** Quick starts: each one is a handful of the planner's focuses. */
const PRESETS: { id: string; name: string; blurb: string; focuses: PlanFocus[] }[] = [
  { id: "life", name: "A better life", blurb: "Sleep, food, movement and calm", focuses: ["sleep", "eat", "move", "calm", "water", "family"] },
  { id: "success", name: "More success", blurb: "Focus, learning and money", focuses: ["organized", "career", "read", "money", "move", "sleep"] },
  { id: "fit", name: "Get fit", blurb: "Workouts, water and good food", focuses: ["move", "weight", "eat", "water", "sleep"] },
  { id: "calm", name: "Calm & rest", blurb: "Quiet time, sleep and family", focuses: ["calm", "sleep", "family", "read"] },
  { id: "family", name: "Family first", blurb: "Kids, partner and dinners together", focuses: ["family", "kids", "partner", "cook", "organized"] },
  { id: "mind", name: "Mind & mood", blurb: "Gratitude, journaling, less phone", focuses: ["gratitude", "journal", "screens", "calm", "outside"] },
  { id: "mornings", name: "Productive days", blurb: "Mornings, focus and big goals", focuses: ["mornings", "organized", "career", "goals", "sleep"] },
  { id: "health", name: "Health habits", blurb: "Meds, stretching, water and sleep", focuses: ["meds", "stretch", "water", "sleep", "eat"] },
  { id: "home", name: "Home & money", blurb: "A calm home and a budget that works", focuses: ["home", "money", "cook", "organized"] },
  { id: "me", name: "Me time", blurb: "Self-care, friends and creativity", focuses: ["selfcare", "friends", "create", "read", "outside"] },
];
/** Faith isn't offered in setup; it's still in AI Reminders for anyone who wants it. */
const FOCUSES = PLAN_FOCUSES.filter((f) => f.id !== "faith");
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const STEPS = ["theme", "goals", "day", "apps", "done"] as const;
type StepId = (typeof STEPS)[number];

export default function DuoSetup({ userId, layout, setLayout, plugins, setFamily, unlimited, room, lifeplanOn, onClose }: {
  userId: number | string;
  layout: AnyLayout; setLayout: (l: any) => void;
  /** Every plugin LifeHub can add (pluginsFor("life", …)). */
  plugins: Plugin[]; setFamily: (fn: (f: Family) => Family) => void;
  /** On Unlimited: every app and AI. */ unlimited: boolean;
  /** How many more apps a free account can add right now (ignored on Unlimited). */ room: number;
  /** AI Reminders is already on (then the routine takes no extra app). */ lifeplanOn: boolean;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [focuses, setFocuses] = useState<PlanFocus[]>([]);
  const [wake, setWake] = useState("07:00");
  const [bed, setBed] = useState("22:30");
  const [workFrom, setWorkFrom] = useState("09:00");
  const [workTo, setWorkTo] = useState("17:00");
  const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [vision, setVision] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [made, setMade] = useState(false);
  const step: StepId = STEPS[i];

  // Day mode while it's open: the strips behind the clock and Home indicator go white too.
  useEffect(() => { sendBackdrop("#ffffff"); return () => { window.dispatchEvent(new Event(BACKDROP_REFRESH)); }; }, []);

  const byId = useMemo(() => new Map(plugins.map((p) => [p.id, p])), [plugins]);
  const starters = useMemo(() => {
    const out = STARTER_APPS.map((a) => ({ ...a, p: byId.get(a.id) })).filter((a): a is { id: string; icon: LucideIcon; p: Plugin } => !!a.p);
    for (const p of plugins) {
      if (out.length >= STARTER_COUNT) break;
      if (p.featured && p.category !== "Arise apps" && !out.some((a) => a.id === p.id)) out.push({ id: p.id, icon: Sparkles, p });
    }
    return out;
  }, [byId, plugins]);
  const themes = STARTER_THEMES.map((id) => HUB_THEMES.find((t) => t.id === id)).filter((t): t is (typeof HUB_THEMES)[number] => !!t);
  const routineSlot = made && !lifeplanOn ? 1 : 0;
  const canPick = unlimited ? Infinity : Math.max(0, room - routineSlot);
  const routineBlocked = !unlimited && !lifeplanOn && room <= 0;

  const finish = () => { try { localStorage.setItem(DONE_KEY(userId), "1"); } catch { /* shown again next time */ } markSeen("setup"); onClose(); };
  const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  const back = () => setI((x) => Math.max(0, x - 1));
  const next = () => {
    if (step === "apps" && picked.length) {
      const chosen = picked.map((id) => byId.get(id)).filter((p): p is Plugin => !!p);
      setFamily((f) => chosen.reduce((acc, p) => setLifePlugin(acc, p, true), f));
    }
    if (i >= STEPS.length - 1) finish(); else setI(i + 1);
  };

  const request = (): PlanRequest => cleanPlanRequest({ vision, focuses, wake, bed, workDays, busy: [{ label: "Work", from: workFrom, to: workTo, days: workDays }] });
  const save = (plan: LifePlan) => {
    const lifeplan = byId.get("life-lifeplan");
    setFamily((f) => { const withApp = lifeplan ? setLifePlugin(f, lifeplan, true) : f; return { ...withApp, lifePlan: plan }; });
    setMade(true);
  };
  const build = async (useAi: boolean) => {
    if (busy || routineBlocked || (!focuses.length && !vision.trim())) return;
    setBusy(true); setNote("");
    const req = request();
    try {
      if (useAi) {
        const res = await fetch(`${API_BASE}/api/life-plan/build`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(req) });
        const body: any = await res.json().catch(() => null);
        const built = res.ok ? cleanLifePlan(body?.plan) : undefined;
        if (built) { save({ ...built, madeBy: "ai" } as LifePlan); return; }
        setNote("The AI is busy, so your routine was made from your choices instead.");
      }
      save(builtinPlan(req));
    } catch {
      save(builtinPlan(req));
      setNote("Couldn't reach the AI, so your routine was made from your choices instead.");
    } finally { setBusy(false); }
  };

  const head = (title: string, sub: ReactNode) => <div className="text-center">
    <h1 className="text-[26px] font-bold leading-tight tracking-[-.02em] text-[#111018] [text-wrap:balance]">{title}</h1>
    <p className="mx-auto mt-1.5 max-w-[22rem] text-[14.5px] leading-snug text-[#5d5a6b] [text-wrap:balance]">{sub}</p>
  </div>;
  const label = (t: string) => <p className="mb-2 mt-4 px-1 text-[12px] font-bold uppercase tracking-wide text-[#77748a]">{t}</p>;
  const timeRow = (name: string, value: string, set: (v: string) => void, last = false) => <label className={`flex min-h-[50px] items-center justify-between gap-3 px-4 ${last ? "" : "border-b border-black/[.06]"}`}>
    <span className="text-[16px] text-[#111018]">{name}</span>
    <input type="time" value={value} onChange={(e) => e.target.value && set(e.target.value)} className="duo-time" aria-label={name} />
  </label>;

  // What the big button at the bottom says and does on each page.
  const primary: { text: string; run: () => void; disabled?: boolean } =
    step === "day" && !made ? { text: "Skip the routine", run: next }
    : step === "apps" ? { text: picked.length ? `Add ${picked.length} ${picked.length === 1 ? "plugin" : "plugins"}` : "Skip for now", run: next }
    : step === "done" ? { text: "Show me around", run: next }
    : { text: "Continue", run: next };

  // The app behind the setup must not move: lock its scrolling (iPhone scrolls the page behind a
  // fixed screen otherwise) and put it back exactly where it was after.
  useEffect(() => {
    return lockPageScroll({ fixed: true });
  }, []);
  const page = <div data-backdrop-hold className="fixed inset-0 z-[9000] flex flex-col overflow-hidden bg-white pb-[max(14px,env(safe-area-inset-bottom))] pt-[var(--sat,env(safe-area-inset-top,0px))] text-[#111018] [color-scheme:light]"
    style={SETUP_STYLE} data-light-island role="dialog" aria-modal="true" aria-label="Set up Arise To Duo" data-testid="duo-setup">
    <style>{`
      .duo-time { -webkit-appearance: none; appearance: none; display: block; box-sizing: border-box; width: 7.25rem; min-width: 0; height: 36px; padding: 0 10px; border: 0; border-radius: 10px; background: #ebeaf2; color: #111018; font: 600 16px/36px -apple-system, BlinkMacSystemFont, system-ui, sans-serif; text-align: center; }
      .duo-time::-webkit-date-and-time-value { text-align: center; }
      .duo-time::-webkit-calendar-picker-indicator { display: none; }
    `}</style>
    <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between px-3">
        {i > 0 && step !== "done" ? <button type="button" onClick={back} className="grid h-11 w-11 place-items-center rounded-full text-[#5d5a6b] active:bg-black/5" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button> : <span className="h-11 w-11" />}
        <div className="flex gap-1.5" aria-label={`Step ${i + 1} of ${STEPS.length}`}>{STEPS.map((s, k) => <span key={s} className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-[#111018]" : "w-1.5 bg-black/15"}`} />)}</div>
        {step !== "done" ? <button type="button" onClick={finish} className="h-11 w-11 text-[15px] font-medium text-[#5d5a6b]" data-testid="duo-setup-skip">Skip</button> : <span className="h-11 w-11" />}
      </div>

      {/* Only up and down, never sideways; each page is laid out to fit without scrolling. */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pb-3 pt-1" key={step}>
        {step === "theme" && <>
          {head("Pick your look", <>Arise To Duo is the only app with themes like these. <b className="font-semibold text-[#111018]">New ones arrive every month</b>, and you can change yours any time.</>)}
          <div role="radiogroup" aria-label="Theme" className="mt-5 grid grid-cols-2 gap-2.5">
            {themes.map((t) => { const on = (layout.theme || "classic") === t.id; return <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => setLayout(setTheme(layout, t.id))} data-testid={`setup-theme-${t.id}`}
              className={`min-w-0 rounded-2xl border p-2.5 text-left transition active:scale-[.98] ${on ? "border-[#5b4fe0] bg-[#f4f2ff] ring-2 ring-[#5b4fe0]/25" : "border-black/10 bg-white"}`}>
              <span className="flex h-12 overflow-hidden rounded-[10px] ring-1 ring-black/5" aria-hidden>{t.swatch.map((c, k) => <span key={k} className="flex-1" style={{ background: c }} />)}</span>
              <span className="mt-2 flex items-center justify-between gap-1 text-[15px] font-bold leading-tight">{t.name}{on && <Check className="h-4 w-4 shrink-0 text-[#5b4fe0]" strokeWidth={3} />}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-[#5d5a6b]">{t.tagline}</span>
            </button>; })}
          </div>
          <p className="mt-3 text-center text-[13px] text-[#77748a]">{HUB_THEMES.length - themes.length} more in ⋯ → Customize</p>
        </>}

        {step === "goals" && <>
          {head("What do you want more of?", "Pick a starting point, then add or remove anything. Your reminders are built around it.")}
          <div className="mt-4 grid grid-cols-2 gap-2" data-testid="setup-presets">{PRESETS.map((p) => { const on = p.focuses.every((f) => focuses.includes(f)); return <button key={p.id} type="button" aria-pressed={on} onClick={() => setFocuses(on ? focuses.filter((f) => !p.focuses.includes(f)) : [...new Set([...focuses, ...p.focuses])])} data-testid={`setup-preset-${p.id}`}
            className={`min-w-0 rounded-2xl border px-3 py-2.5 text-left transition active:scale-[.98] ${on ? "border-[#5b4fe0] bg-[#f4f2ff]" : "border-black/10 bg-white"}`}>
            <span className="flex items-center justify-between gap-1 text-[15px] font-bold leading-tight">{p.name}{on && <Check className="h-4 w-4 shrink-0 text-[#5b4fe0]" strokeWidth={3} />}</span>
            <span className="mt-0.5 block text-[12px] leading-snug text-[#5d5a6b]">{p.blurb}</span>
          </button>; })}</div>
          {label("Build in")}
          <div className="flex flex-wrap gap-2" data-testid="setup-focuses">{FOCUSES.map((f) => { const on = focuses.includes(f.id); return <button key={f.id} type="button" aria-pressed={on} onClick={() => setFocuses(toggle(focuses, f.id))}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13.5px] font-semibold transition active:scale-95 ${on ? "border-[#5b4fe0] bg-[#5b4fe0] text-white" : "border-black/10 bg-white text-[#111018]"}`}>{f.label}</button>; })}</div>
        </>}

        {step === "day" && <>
          {head("Tell us your day", "Reminders go off at the right times, every day, as notifications.")}
          <div className="mt-4 overflow-hidden rounded-2xl bg-[#f4f3f8]">
            {timeRow("Wake up", wake, setWake)}
            {timeRow("Bedtime", bed, setBed)}
            {timeRow("Work starts", workFrom, setWorkFrom)}
            {timeRow("Work ends", workTo, setWorkTo, true)}
          </div>
          {label("Work days")}
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Work days">{DAYS.map((l, d) => { const on = workDays.includes(d); return <button key={d} type="button" aria-pressed={on} aria-label={DAY_NAMES[d]} onClick={() => setWorkDays(toggle(workDays, d).sort())}
            className={`h-10 min-w-0 rounded-xl text-[14px] font-bold ${on ? "bg-[#111018] text-white" : "bg-[#f4f3f8] text-[#77748a]"}`}>{l}</button>; })}</div>
          {made ? <p role="status" tabIndex={-1} className="mt-5 rounded-2xl border-0 bg-emerald-50 px-4 py-3 outline-none ring-0 [-webkit-tap-highlight-color:transparent] text-[14px] font-semibold text-emerald-800" data-testid="setup-built"><Check className="mr-1 inline h-4 w-4" strokeWidth={3} />Your routine is ready. Reminders repeat every day.{note && <span className="mt-1 block font-normal text-emerald-900">{note}</span>}</p>
            : routineBlocked ? <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-[14px] text-amber-900">Your free plan's 3 plugins are in use, and the routine needs one. Unlimited makes room for everything.</p>
            : !focuses.length ? <p className="mt-5 text-center text-[13.5px] text-[#77748a]">Go back and pick at least one goal to build a routine.</p>
            : <div className="mt-5 space-y-2">
              <button type="button" disabled={busy} onClick={() => void build(false)} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#5b4fe0] text-[16px] font-semibold text-white disabled:opacity-60" data-testid="setup-build">
                {busy ? <><Loader2 className="h-5 w-5 animate-spin" />Building…</> : "Make my routine"}
              </button>
              {!unlimited && <p className="text-center text-[12.5px] text-[#77748a]">Uses 1 of your 3 free plugins (Reminders).</p>}
              {note && <p role="status" className="px-1 text-[13px] text-[#5d5a6b]">{note}</p>}
            </div>}
        </>}

        {step === "apps" && <>
          {head("Choose your first plugins", <>Here are favorites to start with. There are <b className="font-semibold text-[#111018]">{PLUGIN_COUNT_LABEL} plugins</b> in the Plugin Gallery whenever you want more.</>)}
          {!unlimited && <p className="mt-3 rounded-xl bg-[#f4f2ff] px-3 py-2 text-center text-[12.5px] text-[#3f35c9]" data-testid="setup-free-note">{canPick > 0 ? `Free includes 3 plugins. Pick up to ${canPick} now.` : "Your 3 free plugins are in use."} Unlimited unlocks all of them.</p>}
          <div className="mt-3 grid grid-cols-2 gap-2" data-testid="setup-apps">
            {starters.map(({ id, icon: Icon, p }) => { const on = picked.includes(id); const full = !on && picked.length >= canPick; return <button key={id} type="button" aria-pressed={on} disabled={full} onClick={() => setPicked(toggle(picked, id))} data-testid={`setup-app-${id}`}
              className={`flex min-w-0 items-start gap-2.5 rounded-2xl border p-2.5 text-left transition active:scale-[.98] disabled:opacity-40 ${on ? "border-[#5b4fe0] bg-[#f4f2ff]" : "border-black/10 bg-white"}`}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${p.color}18`, color: p.color }} aria-hidden="true"><Icon className="h-[21px] w-[21px]" strokeWidth={2} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-1 text-[14px] font-bold leading-tight">{p.name}{on && <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#5b4fe0]" strokeWidth={3} />}</span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-[#5d5a6b]">{p.tagline}</span>
              </span>
            </button>; })}
          </div>
        </>}

        {step === "done" && <div className="flex min-h-full flex-col items-center justify-center text-center">
          <span className="grid h-20 w-20 place-items-center rounded-[22px] bg-[#111018] text-white"><Check className="h-10 w-10" strokeWidth={3} /></span>
          <h1 className="mt-6 text-[28px] font-bold leading-tight tracking-[-.02em]">You're all set</h1>
          <p className="mt-3 max-w-[21rem] text-[15.5px] leading-[1.45] text-[#5d5a6b]">{picked.length ? `${picked.length} ${picked.length === 1 ? "plugin is" : "plugins are"} added. ` : ""}{made ? "Your routine reminders will notify you. " : ""}New themes arrive every month, and hundreds more apps are in the Plugin Gallery.</p>
        </div>}
      </div>

      <div className="shrink-0 px-5 pt-2">
        <button type="button" onClick={primary.run} disabled={primary.disabled} className={`flex h-[52px] w-full items-center justify-center rounded-2xl text-[16px] font-semibold active:opacity-85 ${step === "day" && !made ? "bg-transparent text-[#5d5a6b]" : "bg-[#111018] text-white"}`} data-testid="duo-setup-next">{primary.text}</button>
      </div>
    </div>
  </div>;
  // On the page body, outside the hub, so the hub's night mode and theme never restyle it.
  return createPortal(page, document.body);
}
