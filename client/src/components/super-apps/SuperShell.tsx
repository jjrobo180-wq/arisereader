// The frame Cooked, Cooked PT, Arise Notes and Podster share inside Arise To Do: To Do's own heading, its
// row of pages (a tab bar in To Do's look), a settings
// button that picks which pages show, and the page below. Each app's pages are in shared/superApps.ts.
import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import "./super-shell.css";
import { NativeSheet, SheetGroup, SheetRow, SheetSwitch } from "@/components/NativeSheet";
import { SuperHeadExtra } from "./superHeadExtra";
export { SuperHeadExtra };
import { Settings2, SlidersHorizontal } from "lucide-react";
import { superPagesFor, type SuperApp } from "@shared/superApps";
import type { Family } from "@shared/familyHub";

import { superIcon } from "./superIcons";

/** The pages an app shows (the person's pick, or its defaults) and a way to change them. */
export function useSuperPages(app: SuperApp, family: Family, setFamily: (update: (f: Family) => Family) => void) {
  const pages = superPagesFor(app, family.superPages?.[app.id]);
  const save = (ids: string[]) => setFamily((f) => ({ ...f, superPages: { ...(f.superPages ?? {}), [app.id]: superPagesFor(app, ids) } }));
  return { pages, save };
}

/** To Do's heading for the app (Nov 25, 2026): one slim row with no logo, so the app starts at the top. On a wide
 *  screen the page tabs sit in the same row; on a phone they go just under the name. Colours come from the hub's look
 *  (super-shell.css). A screen that isn't one of the picked pages still shows in the tabs where it belongs. */
export function SuperHead({ app, onSettings, settingsLabel, right, tabs }: { app: SuperApp; onSettings?: () => void; settingsLabel?: string; right?: ReactNode; tabs?: ReactNode }) {
  const extra = useContext(SuperHeadExtra);
  return <header className="sx-head" data-testid={`super-head-${app.id}`} title={app.tagline}>
    <h1 className="sx-head-name">{app.name}</h1>
    {tabs && <div className="sx-head-tabs">{tabs}</div>}
    <span className="sx-head-right">
      {extra && <span className="sx-head-extra">{extra}</span>}
      {right}
      {onSettings && <button type="button" onClick={onSettings} aria-label={settingsLabel ?? `${app.name} settings`} data-testid={`super-settings-${app.id}`} className="sx-icon-btn"><Settings2 size={17} /></button>}
    </span>
  </header>;
}

/** The row of pages as a segmented control in To Do's look: the open page lifts out on a card in the accent
 *  colour, a number on a page for something waiting there. `onEdit` adds Edit at the end (Health & Fitness's tabs).
 *  The open page is kept in view when there are more than fit. */
export function PageStrip({ app, pages, current, onPick, badges, dots, onEdit }: { app: SuperApp; pages: string[]; current: string; onPick: (id: string) => void; badges?: Record<string, number>; dots?: Record<string, boolean>; onEdit?: () => void }) {
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
          {!n && dots?.[id] && <span className="sx-dot" aria-label="Something to track" data-testid={`super-dot-${app.id}-${id}`} />}
        </button>;
      })}
    </div>
    {onEdit && <button type="button" onClick={onEdit} className="sx-edit" data-testid={`super-edit-${app.id}`}><SlidersHorizontal size={15} />Edit</button>}
  </div>;
}

/** "Edit Tabs" (Nov 25, 2026): the app's pages switched on and off in To Do's own sheet, the same one Health &
 *  Fitness uses. Each switch saves at once; what's left out stays, one switch away. */
export function PagePicker({ app, pages, onSave, onClose }: { app: SuperApp; pages: string[]; onSave: (ids: string[]) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<Set<string>>(() => new Set(pages));
  const flip = (id: string, on: boolean) => setDraft((d) => { const n = new Set(d); if (on) n.add(id); else n.delete(id); onSave(app.pages.map((p) => p.id).filter((x) => n.has(x))); return n; });
  return <NativeSheet title="Edit Tabs" onClose={onClose} cancelLabel="" doneLabel="Done" testId={`super-picker-${app.id}`}>
    <SheetGroup caption={`${app.name} tabs`} note="Turn a tab off and nothing in it is lost; turn it back on any time.">
      {app.pages.map((p) => {
        const fixed = app.fixed.includes(p.id), on = fixed || draft.has(p.id);
        const Icon = superIcon(p.icon);
        return <SheetRow key={p.id} icon={<Icon />} color={app.color} label={p.label} sub={fixed ? "Always on" : p.detail} testId={`super-pick-${app.id}-${p.id}`}
          right={<SheetSwitch on={on} disabled={fixed} label={`Show ${p.label}`} onChange={(v) => flip(p.id, v)} />} />;
      })}
    </SheetGroup>
  </NativeSheet>;
}

/** While a page loads (each app's screens arrive the first time they're opened). */
export function SuperLoading({ label }: { label: string }) {
  return <div className="grid min-h-[40vh] place-items-center" role="status" aria-live="polite">
    <span className="flex flex-col items-center gap-3 text-sm font-semibold text-slate-500">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-violet-200 border-t-violet-600" />{label}
    </span>
  </div>;
}
