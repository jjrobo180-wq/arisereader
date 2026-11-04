// Arise To Duo's first-run setup (Nov 2026): before the tour, a short set of full-screen pages that
// actually set the app up: pick a theme, pick your first apps (the popular ~20 of 500+), and build a
// daily routine of recurring reminders (presets, or the AI Reminders planner) from when you sleep and
// work. Everything it does uses the app's own pieces: the hub theme (shared/appThemes.ts), plugins
// (shared/pluginStore.ts) and the life plan that AI Reminders already sends notifications from.
import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Loader2, Sparkles } from "lucide-react";
import { HUB_THEMES } from "@shared/appThemes";
import { setTheme, type AnyLayout } from "@shared/hubLayout";
import { isAddable, setLifePlugin, type Plugin } from "@shared/pluginStore";
import { PLAN_FOCUSES, builtinPlan, cleanLifePlan, cleanPlanRequest, clock12, type PlanFocus, type PlanRequest } from "@shared/lifePlan";
import type { Family } from "@shared/familyHub";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";

const DONE_KEY = (id: number | string) => `arise-duo-setup-v1:${id}`;
export const duoSetupDone = (id: number | string) => { try { return localStorage.getItem(DONE_KEY(id)) === "1"; } catch { return true; } };

/** Quick starts: each one is a handful of the planner's focuses. */
const PRESETS: { id: string; name: string; blurb: string; focuses: PlanFocus[] }[] = [
  { id: "life", name: "A better overall life", blurb: "Sleep, food, movement, calm and family, every day", focuses: ["sleep", "eat", "move", "calm", "water", "family"] },
  { id: "success", name: "A more successful life", blurb: "Focus, learning, money and habits that compound", focuses: ["organized", "career", "read", "money", "move", "sleep"] },
  { id: "fit", name: "Get fit", blurb: "Workouts, water, good food and recovery", focuses: ["move", "weight", "eat", "water", "sleep"] },
  { id: "calm", name: "Calm & faith", blurb: "Quiet time, prayer, gratitude and rest", focuses: ["faith", "calm", "sleep", "family"] },
];
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const STEPS = ["theme", "apps", "routine", "done"] as const;
type StepId = (typeof STEPS)[number];

export default function DuoSetup({ userId, layout, setLayout, plugins, setFamily, onClose }: {
  userId: number | string;
  layout: AnyLayout; setLayout: (l: any) => void;
  /** Every plugin LifeHub can add (pluginsFor("life", …)). */
  plugins: Plugin[]; setFamily: (fn: (f: Family) => Family) => void; onClose: () => void;
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
  const [made, setMade] = useState<"" | "ai" | "preset">("");
  const step: StepId = STEPS[i];

  // The popular ones first (featured), then the rest in the store's order, 20 in all.
  const top = useMemo(() => {
    const ok = plugins.filter((p) => isAddable(p) && p.id !== "life-lifeplan");
    return [...ok.filter((p) => p.featured), ...ok.filter((p) => !p.featured)].slice(0, 20);
  }, [plugins]);
  const total = plugins.filter(isAddable).length;

  const finish = () => { try { localStorage.setItem(DONE_KEY(userId), "1"); } catch { /* shown again next time */ } onClose(); };
  const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  const next = () => { if (step === "apps") applyApps(); if (i >= STEPS.length - 1) finish(); else setI(i + 1); };
  const applyApps = () => {
    if (!picked.length) return;
    const chosen = plugins.filter((p) => picked.includes(p.id));
    setFamily((f) => chosen.reduce((acc, p) => setLifePlugin(acc, p, true), f));
  };

  const request = (): PlanRequest => cleanPlanRequest({
    vision, focuses, wake, bed, workDays,
    busy: [{ label: "Work", from: workFrom, to: workTo, days: workDays }],
  });
  const save = (plan: ReturnType<typeof builtinPlan>, how: "ai" | "preset") => {
    const lifeplan = plugins.find((p) => p.id === "life-lifeplan");
    setFamily((f) => { const withApp = lifeplan ? setLifePlugin(f, lifeplan, true) : f; return { ...withApp, lifePlan: plan }; });
    setMade(how); setNote("");
  };
  const build = async (useAi: boolean) => {
    if (busy || (!focuses.length && !vision.trim())) return;
    setBusy(true); setNote("");
    const req = request();
    try {
      if (useAi) {
        const res = await fetch(`${API_BASE}/api/life-plan/build`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(req) });
        const body: any = await res.json().catch(() => null);
        const built = res.ok ? cleanLifePlan(body?.plan) : undefined;
        if (built) { save({ ...built, madeBy: "ai" } as any, "ai"); return; }
        setNote("The AI is busy, so your routine was built from the preset instead.");
      }
      save(builtinPlan(req), "preset");
    } catch {
      save(builtinPlan(req), "preset");
      setNote("No connection to the AI, so your routine was built from the preset instead.");
    } finally { setBusy(false); }
  };

  const font = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif" };
  const head = (title: string, sub: ReactNode) => <div className="text-center">
    <h1 className="text-[28px] font-bold leading-tight tracking-[-.02em] [text-wrap:balance]">{title}</h1>
    <p className="mx-auto mt-2 max-w-[21rem] text-[15px] leading-snug text-[#6b6879] [text-wrap:balance]">{sub}</p>
  </div>;
  const chip = (on: boolean) => `inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold transition active:scale-95 ${on ? "border-[#5b4fe0] bg-[#5b4fe0] text-white" : "border-black/10 bg-white text-[#111018]"}`;
  const field = "mt-1 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-[16px] font-semibold text-[#111018]";

  return <div className="fixed inset-0 z-[710] flex flex-col bg-white pb-[max(16px,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] text-[#111018]" style={font} role="dialog" aria-modal="true" aria-label="Set up Arise To Duo" data-testid="duo-setup">
    <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between px-3">
        {i > 0 && step !== "done" ? <button type="button" onClick={() => setI(i - 1)} className="grid h-11 w-11 place-items-center rounded-full text-[#6b6879]" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button> : <span className="h-11 w-11" />}
        <div className="flex gap-1.5" aria-label={`Step ${i + 1} of ${STEPS.length}`}>{STEPS.map((s, k) => <span key={s} className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-[#111018]" : "w-1.5 bg-black/15"}`} />)}</div>
        {step !== "done" ? <button type="button" onClick={finish} className="h-11 px-2 text-[16px] font-medium text-[#6b6879]" data-testid="duo-setup-skip">Skip</button> : <span className="h-11 w-11" />}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-2" key={step}>
        {step === "theme" && <>
          {head("Pick your look", <>Arise To Duo is the only app with themes like this. <b className="font-semibold text-[#111018]">New themes arrive every month</b>, and you can change yours any time in Customize.</>)}
          <div role="radiogroup" aria-label="Theme" className="mt-5 grid grid-cols-2 gap-2.5">
            {HUB_THEMES.map((t) => { const on = (layout.theme || "classic") === t.id; return <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => setLayout(setTheme(layout, t.id))} data-testid={`setup-theme-${t.id}`}
              className={`rounded-2xl border p-2.5 text-left transition active:scale-[.98] ${on ? "border-[#5b4fe0] bg-[#f4f2ff] ring-2 ring-[#5b4fe0]/30" : "border-black/10 bg-white"}`}>
              <span className="flex h-10 overflow-hidden rounded-lg ring-1 ring-black/5" aria-hidden>{t.swatch.map((c, k) => <span key={k} className="flex-1" style={{ background: c }} />)}</span>
              <span className="mt-2 flex items-center justify-between gap-1 text-[14px] font-bold leading-tight">{t.name}{on && <Check className="h-4 w-4 text-[#5b4fe0]" strokeWidth={3} />}</span>
              <span className="block text-[11.5px] leading-snug text-[#6b6879]">{t.tagline}</span>
            </button>; })}
          </div>
        </>}

        {step === "apps" && <>
          {head("Choose your first apps", <>Here are the 20 most popular. There are <b className="font-semibold text-[#111018]">{total > 500 ? `${total}` : "500+"} apps</b> in the App Gallery whenever you want more.</>)}
          <div className="mt-5 grid grid-cols-2 gap-2.5" data-testid="setup-apps">
            {top.map((p) => { const on = picked.includes(p.id); return <button key={p.id} type="button" aria-pressed={on} onClick={() => setPicked(toggle(picked, p.id))} data-testid={`setup-app-${p.id}`}
              className={`flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition active:scale-[.98] ${on ? "border-[#5b4fe0] bg-[#f4f2ff]" : "border-black/10 bg-white"}`}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[15px] font-black text-white" style={{ background: p.color }} aria-hidden>{p.name.slice(0, 1)}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-bold leading-tight">{p.name}</span><span className="block truncate text-[11.5px] text-[#6b6879]">{p.category}</span></span>
              {on && <Check className="h-4 w-4 shrink-0 text-[#5b4fe0]" strokeWidth={3} />}
            </button>; })}
          </div>
        </>}

        {step === "routine" && <>
          {head("Build your routine", "Pick a goal, tell us your day, and your reminders are set up to repeat and notify you.")}
          <p className="mb-2 mt-5 text-[13px] font-bold uppercase tracking-wide text-[#6b6879]">Start with a preset</p>
          <div className="space-y-2" data-testid="setup-presets">{PRESETS.map((p) => { const on = p.focuses.every((f) => focuses.includes(f)); return <button key={p.id} type="button" aria-pressed={on} onClick={() => setFocuses(on ? focuses.filter((f) => !p.focuses.includes(f)) : [...new Set([...focuses, ...p.focuses])])} data-testid={`setup-preset-${p.id}`}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[.99] ${on ? "border-[#5b4fe0] bg-[#f4f2ff]" : "border-black/10 bg-white"}`}>
            <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold">{p.name}</span><span className="block text-[12.5px] text-[#6b6879]">{p.blurb}</span></span>
            {on && <Check className="h-5 w-5 shrink-0 text-[#5b4fe0]" strokeWidth={3} />}
          </button>; })}</div>
          <p className="mb-2 mt-5 text-[13px] font-bold uppercase tracking-wide text-[#6b6879]">What to build in</p>
          <div className="flex flex-wrap gap-2" data-testid="setup-focuses">{PLAN_FOCUSES.map((f) => <button key={f.id} type="button" aria-pressed={focuses.includes(f.id)} onClick={() => setFocuses(toggle(focuses, f.id))} className={chip(focuses.includes(f.id))}><span aria-hidden>{f.emoji}</span>{f.label}</button>)}</div>
          <p className="mb-2 mt-5 text-[13px] font-bold uppercase tracking-wide text-[#6b6879]">Your day</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[12px] font-bold text-[#6b6879]">I wake up<input type="time" value={wake} onChange={(e) => setWake(e.target.value)} className={field} /></label>
            <label className="text-[12px] font-bold text-[#6b6879]">I go to bed<input type="time" value={bed} onChange={(e) => setBed(e.target.value)} className={field} /></label>
            <label className="text-[12px] font-bold text-[#6b6879]">Work starts<input type="time" value={workFrom} onChange={(e) => setWorkFrom(e.target.value)} className={field} /></label>
            <label className="text-[12px] font-bold text-[#6b6879]">Work ends<input type="time" value={workTo} onChange={(e) => setWorkTo(e.target.value)} className={field} /></label>
          </div>
          <div className="mt-3 flex gap-1" role="group" aria-label="Work days">{DAYS.map((l, d) => <button key={d} type="button" aria-pressed={workDays.includes(d)} onClick={() => setWorkDays(toggle(workDays, d).sort())} className={`h-10 flex-1 rounded-xl text-[14px] font-bold ${workDays.includes(d) ? "bg-[#111018] text-white" : "bg-[#f1f0f7] text-[#6b6879]"}`}>{l}</button>)}</div>
          <textarea value={vision} onChange={(e) => setVision(e.target.value)} maxLength={600} rows={3} placeholder="Optional: tell the AI about the life you want, in your own words." aria-label="The life you want" className="mt-4 w-full rounded-xl border border-black/10 p-3 text-[15px]" data-testid="setup-vision" />
          {made ? <p role="status" className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-[14px] font-semibold text-emerald-800" data-testid="setup-built"><Check className="mr-1 inline h-4 w-4" strokeWidth={3} />Your routine is ready: reminders from {clock12(wake)} to {clock12(bed)}, repeating every day.{note && <span className="mt-1 block font-normal text-emerald-900">{note}</span>}</p>
            : <div className="mt-4 space-y-2">
              <button type="button" disabled={busy || (!focuses.length && !vision.trim())} onClick={() => void build(true)} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#5b4fe0] text-[16px] font-semibold text-white disabled:opacity-50" data-testid="setup-build-ai">{busy ? <><Loader2 className="h-5 w-5 animate-spin" />Building…</> : <><Sparkles className="h-5 w-5" />Build my routine with AI</>}</button>
              <button type="button" disabled={busy || !focuses.length} onClick={() => void build(false)} className="h-11 w-full rounded-2xl bg-[#f1f0f7] text-[15px] font-semibold text-[#3f35c9] disabled:opacity-50" data-testid="setup-build-preset">Use the preset without AI</button>
              {note && <p role="status" className="px-1 text-[13px] text-[#6b6879]">{note}</p>}
            </div>}
        </>}

        {step === "done" && <div className="flex min-h-full flex-col items-center justify-center text-center">
          <span className="grid h-20 w-20 place-items-center rounded-[22px] bg-[#111018] text-white"><Check className="h-10 w-10" strokeWidth={3} /></span>
          <h1 className="mt-6 text-[30px] font-bold leading-tight tracking-[-.02em]">You're set up</h1>
          <p className="mt-3 max-w-[21rem] text-[16px] leading-[1.45] text-[#6b6879]">{picked.length ? `${picked.length} ${picked.length === 1 ? "app is" : "apps are"} added. ` : ""}{made ? "Your routine reminders will notify you. " : ""}Find hundreds more apps in the App Gallery, and new themes every month. Arise To Duo is on the App Store, so your friends and family can get it too.</p>
        </div>}
      </div>

      <div className="shrink-0 px-5 pt-3">
        <button type="button" onClick={next} className="flex h-[54px] w-full items-center justify-center rounded-2xl bg-[#111018] text-[17px] font-semibold text-white active:opacity-85" data-testid="duo-setup-next">
          {step === "done" ? "Show me around" : step === "apps" && picked.length ? `Add ${picked.length} and continue` : step === "routine" && !made ? "Skip for now" : "Continue"}
        </button>
      </div>
    </div>
  </div>;
}
