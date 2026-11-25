// One Health & Fitness tab inside Arise To Duo (Nov 25, 2026): a calm row of the tab's parts at the top, then the
// part that's open. Parts with a page of their own show here; the tools (camera, sleep sounds, coach...) open over
// it, marked with an arrow. Which tabs and parts show is set in Edit (FitTabsEditor.tsx); shared/fitGroups.ts.
import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight, CalendarRange, ShoppingCart, type LucideIcon } from "lucide-react";
import { INLINE_PARTS, type FitGroup, type FitPart, type FitPartId } from "@shared/fitGroups";
import { APP_ICONS } from "./FitApps";
import { C } from "./fitUi";

const EXTRA_ICONS: Record<string, LucideIcon> = { CalendarRange, ShoppingCart };
const iconOf = (name: string): LucideIcon | null => APP_ICONS[name] ?? EXTRA_ICONS[name] ?? null;

export function FitGroupPage({ group, parts, current, onPick, onTool, render }: {
  group: FitGroup; parts: FitPart[]; current: FitPartId; onPick: (id: FitPartId) => void; onTool: (id: FitPartId) => void; render: (id: FitPartId) => ReactNode;
}) {
  const pages = parts.filter((p) => INLINE_PARTS.has(p.id));
  const tools = parts.filter((p) => !INLINE_PARTS.has(p.id));
  const open = pages.some((p) => p.id === current) ? current : pages[0]?.id;
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => { row.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [open]);
  const chip = (p: FitPart, tool: boolean) => {
    const I = iconOf(p.icon), on = !tool && p.id === open;
    return <button key={p.id} type="button" role={tool ? undefined : "tab"} aria-selected={tool ? undefined : on} title={p.detail}
      onClick={() => (tool ? onTool(p.id) : onPick(p.id))} data-testid={`fit-part-${p.id}`}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold transition active:scale-[0.97]"
      style={on ? { background: C.text, color: C.bg } : { background: C.card2, color: C.dim }}>
      {I && <I className="h-4 w-4" />}{p.label}{tool && <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />}
    </button>;
  };
  return <section data-testid={`fit-group-${group.id}`}>
    {parts.length > 1 && <div ref={row} role="tablist" aria-label={group.label} className="no-scrollbar -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
      {pages.map((p) => chip(p, false))}
      {tools.length > 0 && pages.length > 0 && <span aria-hidden className="mx-1 my-2 w-px shrink-0" style={{ background: C.line }} />}
      {tools.map((p) => chip(p, true))}
    </div>}
    {open ? <div key={open} className="fit-in">{render(open)}</div>
      : <p className="py-10 text-center text-[14px]" style={{ color: C.dim }}>Tap one above to open it.</p>}
  </section>;
}
