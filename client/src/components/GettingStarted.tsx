// The Getting started page: an app in LifeHub's and WorkHub's menu (removable like any other).
// Pick who you are (parent, teacher, student, just me), tick off the first few steps, and read
// short cards on every main feature and on making the hub your own. The words are in
// shared/gettingStarted.ts. What you picked and ticked is remembered on this device.
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronDown, GraduationCap, Lightbulb, Paintbrush, Rocket, Sparkles, Trash2, User, Users } from "lucide-react";
import { GUIDES, guideFor, type GuideRole, type GuideTopic } from "@shared/gettingStarted";

const ROLE_ICON: Record<GuideRole, typeof User> = { parent: Users, teacher: GraduationCap, student: Sparkles, personal: User };

type Saved = { role?: GuideRole; done?: Partial<Record<GuideRole, string[]>> };
const keyFor = (hub: string) => `arise-getting-started:${hub}`;
function load(hub: string): Saved { try { return JSON.parse(localStorage.getItem(keyFor(hub)) || "{}") || {}; } catch { return {}; } }
function store(hub: string, s: Saved) { try { localStorage.setItem(keyFor(hub), JSON.stringify(s)); } catch { /* just not remembered */ } }

export type GettingStartedProps = {
  hub: "life" | "work";
  /** The guide to show first (from the account's role). */
  startRole: GuideRole;
  /** Opens a place in the hub; returns false when this hub has no such place (then no button shows). */
  canOpen: (target: string) => boolean;
  onOpen: (target: string) => void;
  /** Takes the page out of the menu (it can be added back from the App Store). */
  onRemove: () => void;
};

export default function GettingStarted({ hub, startRole, canOpen, onOpen, onRemove }: GettingStartedProps) {
  const [saved, setSaved] = useState<Saved>(() => load(hub));
  const role = saved.role ?? startRole;
  const guide = guideFor(role);
  const done = saved.done?.[role] ?? [];
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { setOpen(null); }, [role]);
  const save = (next: Saved) => { setSaved(next); store(hub, next); };
  const pick = (r: GuideRole) => save({ ...saved, role: r });
  const toggle = (id: string) => save({ ...saved, done: { ...saved.done, [role]: done.includes(id) ? done.filter((d) => d !== id) : [...done, id] } });
  const finished = guide.steps.filter((s) => done.includes(s.id)).length;
  const pct = Math.round((finished / Math.max(1, guide.steps.length)) * 100);
  // Full class names (not built from parts) so Tailwind keeps them.
  const accent = hub === "work" ? { text: "text-teal-700", bg: "bg-teal-600", soft: "bg-teal-50", hover: "hover:bg-teal-50", border: "border-teal-600" } : { text: "text-violet-700", bg: "bg-violet-600", soft: "bg-violet-50", hover: "hover:bg-violet-50", border: "border-violet-600" };
  const openBtn = (target?: string, label = "Open") => target && canOpen(target)
    ? <button type="button" onClick={() => onOpen(target)} className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-bold ${accent.text} ${accent.hover}`}>{label}<ArrowRight className="h-4 w-4" /></button>
    : null;

  const Topic = ({ t, icon }: { t: GuideTopic; icon?: boolean }) => {
    const id = `${role}-${t.id}`, on = open === id;
    return <li className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button type="button" onClick={() => setOpen(on ? null : id)} aria-expanded={on} aria-controls={`gs-${id}`} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left">
        {icon && <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accent.soft} ${accent.text}`}><Paintbrush className="h-4 w-4" /></span>}
        <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold text-slate-900">{t.title}</span><span className="block text-sm text-slate-500">{t.summary}</span></span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${on ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {on && <div id={`gs-${id}`} className="border-t border-slate-100 px-4 pb-4 pt-3">
        <ul className="space-y-2">{t.points.map((p, i) => <li key={i} className="flex gap-2.5 text-[15px] leading-6 text-slate-700"><span className={`mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full ${accent.bg}`} aria-hidden />{p}</li>)}</ul>
        {openBtn(t.open, `Go to ${t.title}`) && <div className="mt-3 -ml-3">{openBtn(t.open, `Go to ${t.title}`)}</div>}
      </div>}
    </li>;
  };

  const section = (icon: typeof User, title: string, sub?: string) => {
    const Icon = icon;
    return <div className="mb-3 flex items-end gap-3"><Icon className={`h-5 w-5 shrink-0 ${accent.text}`} aria-hidden /><div className="min-w-0"><h2 className="text-lg font-black text-slate-900">{title}</h2>{sub && <p className="text-sm text-slate-500">{sub}</p>}</div></div>;
  };

  const roles = useMemo(() => GUIDES.filter((g) => hub === "work" ? g.role !== "personal" : true), [hub]);

  return <div className="mx-auto w-full max-w-4xl space-y-8 pb-10" data-testid="getting-started">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className={`mb-1.5 text-xs font-extrabold uppercase tracking-[.2em] ${accent.text}`}>Getting started</p>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Welcome to {hub === "work" ? "WorkHub" : "LifeHub"}</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] leading-6 text-slate-600">Pick a guide, try the first few steps, and open any card to learn more. Remove this page whenever you're done.</p>
      </div>
    </header>

    <section aria-labelledby="gs-who">
      <h2 id="gs-who" className="mb-2 text-sm font-bold text-slate-700">Show me the guide for</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Choose a guide">
        {roles.map((g) => { const Icon = ROLE_ICON[g.role], on = g.role === role;
          return <button key={g.role} type="button" onClick={() => pick(g.role)} aria-pressed={on} data-testid={`gs-role-${g.role}`}
            className={`flex min-h-[72px] flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition ${on ? `${accent.border} ${accent.soft}` : "border-slate-200 bg-white hover:border-slate-300"}`}>
            <span className="flex items-center gap-2"><Icon className={`h-4 w-4 ${on ? accent.text : "text-slate-500"}`} /><span className="font-bold text-slate-900">{g.label}</span></span>
            <span className="text-xs leading-4 text-slate-500">{g.who}</span>
          </button>; })}
      </div>
    </section>

    <p className={`rounded-2xl ${accent.soft} p-4 text-[15px] leading-6 text-slate-800`}>{guide.intro}</p>

    <section aria-label="Your first few minutes">
      {section(Rocket, "Your first few minutes", `${finished} of ${guide.steps.length} done`)}
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Steps done" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className={`h-full rounded-full ${accent.bg} transition-[width]`} style={{ width: `${pct}%` }} /></div>
      <ol className="space-y-2">{guide.steps.map((s, i) => { const ok = done.includes(s.id);
        return <li key={s.id} className={`flex items-start gap-3 rounded-2xl border bg-white p-3 sm:p-4 ${ok ? "border-slate-200 opacity-80" : "border-slate-200"}`}>
          <button type="button" onClick={() => toggle(s.id)} aria-pressed={ok} aria-label={ok ? `Mark “${s.title}” not done` : `Mark “${s.title}” done`}
            className={`mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black ${ok ? `${accent.bg} border-transparent text-white` : "border-slate-300 text-slate-500"}`}>{ok ? <Check className="h-5 w-5" /> : i + 1}</button>
          <div className="min-w-0 flex-1 pt-1.5">
            <p className={`font-bold text-slate-900 ${ok ? "line-through decoration-slate-400" : ""}`}>{s.title}</p>
            <p className="mt-0.5 text-[15px] leading-6 text-slate-600">{s.body}</p>
            {openBtn(s.open) && <div className="-ml-3 mt-1 sm:hidden">{openBtn(s.open)}</div>}
          </div>
          <div className="hidden sm:block">{openBtn(s.open)}</div>
        </li>; })}</ol>
      {finished === guide.steps.length && <p className="mt-3 flex items-center gap-2 text-sm font-bold text-emerald-700"><Check className="h-4 w-4" /> All set. Nice work!</p>}
    </section>

    <section>
      {section(Sparkles, "What's here", "Tap a card to see how it works.")}
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">{guide.topics.map((t) => <Topic key={t.id} t={t} />)}</ul>
    </section>

    <section>
      {section(Paintbrush, "Make it yours", "Layout, look, apps, privacy and reminders.")}
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">{guide.customize.map((t) => <Topic key={t.id} t={t} icon />)}</ul>
    </section>

    <section>
      {section(Lightbulb, "Good to know")}
      <ul className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">{guide.tips.map((t, i) => <li key={i} className="flex gap-2.5 text-[15px] leading-6 text-slate-700"><Lightbulb className="mt-1 h-4 w-4 shrink-0 text-amber-500" aria-hidden />{t}</li>)}</ul>
    </section>

    <footer className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-slate-300 p-4 sm:flex-row sm:items-center">
      <p className="min-w-0 flex-1 text-sm text-slate-600">Done with this page? Remove it from your menu. You can add it back any time from the App Gallery.</p>
      <button type="button" onClick={onRemove} data-testid="gs-remove" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"><Trash2 className="h-4 w-4" /> Remove from menu</button>
    </footer>
  </div>;
}
