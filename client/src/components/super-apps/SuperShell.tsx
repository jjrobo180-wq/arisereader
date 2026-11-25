// The frame Cooked, Cooked PT, Arise Notes and Podster share inside Arise To Duo: To Duo's own heading, its
// row of pages (a tab bar in To Duo's look), a settings
// button that picks which pages show, and the page below. Each app's pages are in shared/superApps.ts.
import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import "./super-shell.css";
import { SuperHeadExtra } from "./superHeadExtra";
export { SuperHeadExtra };
import { Check, Settings2, SlidersHorizontal, X } from "lucide-react";
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

/** To Duo's heading for the app (Nov 25, 2026: one slim row, so the app itself starts near the top): its icon and
 *  name, To Duo's extras, and its settings button. Colours come from the hub's look (super-shell.css). */
export function SuperHead({ app, onSettings, settingsLabel, right }: { app: SuperApp; onSettings?: () => void; settingsLabel?: string; right?: ReactNode }) {
  const Icon = superIcon(app.icon);
  const extra = useContext(SuperHeadExtra);
  return <header className="sx-head" data-testid={`super-head-${app.id}`} title={app.tagline}>
    <span className="sx-head-icon" style={{ background: `linear-gradient(145deg, ${app.color}, ${app.color}cc)` }}><Icon size={18} /></span>
    <h1 className="sx-head-name">{app.name}</h1>
    <span className="sx-head-right">
      {extra && <span className="sx-head-extra">{extra}</span>}
      {right}
      {onSettings && <button type="button" onClick={onSettings} aria-label={settingsLabel ?? `${app.name} settings`} data-testid={`super-settings-${app.id}`} className="sx-icon-btn"><Settings2 size={17} /></button>}
    </span>
  </header>;
}

/** The row of pages as a segmented control in To Duo's look: the open page lifts out on a card in the accent
 *  colour, a number on a page for something waiting there. `onEdit` adds Edit at the end (Health & Fitness's tabs).
 *  The open page is kept in view when there are more than fit. */
export function PageStrip({ app, pages, current, onPick, badges, onEdit }: { app: SuperApp; pages: string[]; current: string; onPick: (id: string) => void; badges?: Record<string, number>; onEdit?: () => void }) {
  const label = (id: string) => app.pages.find((p) => p.id === id)?.label ?? id;
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => { row.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [current]);
  return <div className="sx-tabs" data-testid={`super-tabbar-${app.id}`}>
    <div ref={row} className="sx-tabs-row no-scrollbar" role="tablist" aria-label={`${app.name} pages`} data-testid={`super-strip-${app.id}`}>
      {pages.map((id) => {
        const on = id === current, n = badges?.[id] ?? 0;
        const Icon = superIcon(app.pages.find((p) => p.id === id)?.icon ?? "");
        return <button key={id} type="button" role="tab" aria-selected={on} onClick={() => onPick(id)} data-testid={`super-page-${app.id}-${id}`} className="sx-tab">
          <Icon size={15} />{label(id)}
          {n > 0 && <span className="sx-badge">{n}</span>}
        </button>;
      })}
    </div>
    {onEdit && <button type="button" onClick={onEdit} className="sx-edit" data-testid={`super-edit-${app.id}`}><SlidersHorizontal size={15} />Edit</button>}
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
