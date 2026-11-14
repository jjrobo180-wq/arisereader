// The frame Cooked, Cooked PT, Arise Notes and Podster share inside Arise To Duo: To Duo's own heading, its
// row of pages (the same pills as Health Lite or Kitchen, components/family-hub/BundleApp.tsx), a settings
// button that picks which pages show, and the page below. Each app's pages are in shared/superApps.ts.
import { useState, type ReactNode } from "react";
import { Check, Settings2, X } from "lucide-react";
import { superPagesFor, type SuperApp } from "@shared/superApps";
import type { Family } from "@shared/familyHub";
import { Modal, plain, primary } from "@/components/family-hub/ui";
import { superIcon } from "./superIcons";

/** The pages an app shows (the person's pick, or its defaults) and a way to change them. */
export function useSuperPages(app: SuperApp, family: Family, setFamily: (update: (f: Family) => Family) => void) {
  const pages = superPagesFor(app, family.superPages?.[app.id]);
  const save = (ids: string[]) => setFamily((f) => ({ ...f, superPages: { ...(f.superPages ?? {}), [app.id]: superPagesFor(app, ids) } }));
  return { pages, save };
}

/** To Duo's heading for the app: its name, what it is, and its settings button. */
export function SuperHead({ app, onSettings, settingsLabel, right }: { app: SuperApp; onSettings?: () => void; settingsLabel?: string; right?: ReactNode }) {
  const Icon = superIcon(app.icon);
  return <header className="mb-3 flex items-center gap-3" data-testid={`super-head-${app.id}`}>
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-sm" style={{ background: `linear-gradient(145deg, ${app.color}, ${app.color}cc)` }}><Icon size={24} /></span>
    <div className="min-w-0 flex-1">
      <h1 className="truncate text-2xl font-black tracking-tight text-[#232139] dark:text-white sm:text-3xl">{app.name}<span className="text-[#7866e1]">.</span></h1>
      <p className="truncate text-sm font-medium text-slate-500">{app.tagline}</p>
    </div>
    {right}
    {onSettings && <button type="button" onClick={onSettings} aria-label={settingsLabel ?? `${app.name} settings`} data-testid={`super-settings-${app.id}`}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><Settings2 size={18} /></button>}
  </header>;
}

/** The row of pages: one pill each, the open one dark. A number on a pill is something waiting there. */
export function PageStrip({ app, pages, current, onPick, badges }: { app: SuperApp; pages: string[]; current: string; onPick: (id: string) => void; badges?: Record<string, number> }) {
  const label = (id: string) => app.pages.find((p) => p.id === id)?.label ?? id;
  return <div className="no-scrollbar -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label={`${app.name} pages`} data-testid={`super-strip-${app.id}`}>
    {pages.map((id) => {
      const on = id === current, n = badges?.[id] ?? 0;
      const Icon = superIcon(app.pages.find((p) => p.id === id)?.icon ?? "");
      return <button key={id} type="button" role="tab" aria-selected={on} onClick={() => onPick(id)} data-testid={`super-page-${app.id}-${id}`}
        className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold transition ${on ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
        <Icon size={15} />{label(id)}
        {n > 0 && <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] ${on ? "bg-white text-slate-900" : "bg-[#6e5ae0] text-white"}`}>{n}</span>}
      </button>;
    })}
  </div>;
}

/** "Pick your pages": the app's pages to switch on and off, in To Duo's own box. */
export function PagePicker({ app, pages, onSave, onClose }: { app: SuperApp; pages: string[]; onSave: (ids: string[]) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<Set<string>>(() => new Set(pages));
  return <Modal title={`Pick your ${app.name} pages`} eyebrow={app.name} onClose={onClose}>
    <p className="mb-4 text-sm text-slate-500">Choose what shows in {app.name}'s row of pages. Everything you leave out stays, and you can add it back any time.</p>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid={`super-picker-${app.id}`}>
      {app.pages.map((p) => {
        const fixed = app.fixed.includes(p.id), on = fixed || draft.has(p.id);
        const Icon = superIcon(p.icon);
        return <button key={p.id} type="button" aria-pressed={on} disabled={fixed} onClick={() => setDraft((d) => { const n = new Set(d); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })}
          className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition disabled:cursor-default ${on ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${on ? "bg-[#6e5ae0] text-white" : "border-2 border-slate-300 text-transparent"}`}><Check size={14} /></span>
          <Icon size={18} className="shrink-0 text-slate-500" />
          <span className="min-w-0"><span className="block text-sm font-bold text-slate-800">{p.label}{fixed ? " · always on" : ""}</span>{p.detail && <span className="block text-xs text-slate-500">{p.detail}</span>}</span>
        </button>;
      })}
    </div>
    <div className="mt-6 flex gap-2">
      <button type="button" onClick={onClose} className={`${plain} flex-1`}><X size={16} />Cancel</button>
      <button type="button" onClick={() => { onSave([...draft]); onClose(); }} className={`${primary} flex-1`} data-testid={`super-picker-save-${app.id}`}>Done</button>
    </div>
  </Modal>;
}

/** While a page loads (each app's screens arrive the first time they're opened). */
export function SuperLoading({ label }: { label: string }) {
  return <div className="grid min-h-[40vh] place-items-center" role="status" aria-live="polite">
    <span className="flex flex-col items-center gap-3 text-sm font-semibold text-slate-500">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-violet-200 border-t-violet-600" />{label}
    </span>
  </div>;
}
