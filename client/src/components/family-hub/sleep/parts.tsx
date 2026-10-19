// Arise LifeHub · Sleep: the small pieces every tab is built from.
import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown, Star, X } from "lucide-react";
import { toolById, type SleepTool } from "@shared/sleepContent";
import { useSleep } from "./context";

/** A titled part of a tab. The heading is the only label; no eyebrows. */
export function Section({ title, intro, children, action }: { title: string; intro?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return <section className="mt-10 first:mt-6">
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 max-w-2xl">
        <h2 className="sl-heading">{title}</h2>
        {intro && <p className="mt-1.5 text-[0.9375rem] text-[var(--sl-hush)]">{intro}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>;
}

/** Why something helps, and where that comes from. */
export function Why({ why, source }: { why: string; source?: string }) {
  return <p className="sl-small mt-2 text-[var(--sl-hush)]">{why}{source && <span className="sl-faint"> Source: {source}.</span>}</p>;
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="sl-small inline-flex items-center rounded-full border border-[var(--sl-line)] px-2 py-0.5 text-[var(--sl-faint)]">{children}</span>;
}

/** One tool as a row: name, what it is, and a Start button. "Why it works" opens beneath. */
export function ToolRow({ tool, label = "Start", onStart, children }: { tool: SleepTool; label?: string; onStart?: () => void; children?: ReactNode }) {
  const { launch, isFav, toggleFav } = useSleep();
  const [open, setOpen] = useState(false);
  const whyId = useId();
  const fav = isFav(tool.id);
  return <li className="sl-tool">
    <div className="min-w-0">
      <p className="text-[1.0625rem] font-semibold leading-snug text-[var(--sl-parchment)]">{tool.name}</p>
      <p className="mt-1 text-[0.9375rem] text-[var(--sl-hush)]">{tool.blurb}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {tool.minutes ? <Tag>{tool.minutes} min</Tag> : null}
        {tool.eyesClosed && <Tag>Eyes closed</Tag>}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={whyId} className="sl-small inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[var(--sl-faint)] hover:text-[var(--sl-parchment)]">
          Why it works <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>
      {open && <div id={whyId}><Why why={tool.why} source={tool.source} /></div>}
      {children}
    </div>
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => toggleFav(tool.id)} aria-pressed={fav} aria-label={fav ? `Remove ${tool.name} from favorites` : `Add ${tool.name} to favorites`} className="sl-btn sl-ghost sl-icon">
        <Star size={18} className={fav ? "fill-[var(--sl-ember)] text-[var(--sl-ember)]" : ""} aria-hidden />
      </button>
      <button type="button" onClick={onStart ?? (() => launch(tool.id))} className="sl-btn sl-quiet">{label}</button>
    </div>
  </li>;
}

/** A tool row by id, for lists made of ids. Faith content is left out when it's off. */
export function ToolRowById({ id, label }: { id: string; label?: string }) {
  const { faith } = useSleep();
  const tool = toolById(id);
  if (!tool || (tool.faith && !faith)) return null;
  return <ToolRow tool={tool} label={label} />;
}

/** A dark sheet over the app: from the bottom on a phone, centered on a computer. */
export function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return <div className="fixed inset-0 z-[540] flex items-end justify-center bg-black/70 sm:items-center sm:p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={title} className={`sl-sheet max-h-[92dvh] text-[var(--sl-hush)] w-full overflow-y-auto overscroll-contain !rounded-b-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:!rounded-[1.4rem] sm:p-7 ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="sl-title">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="sl-btn sl-ghost sl-icon -mr-2 -mt-1"><X size={20} aria-hidden /></button>
      </div>
      {children}
    </div>
  </div>;
}

/** An on/off switch in the night palette. */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-[var(--sl-ember)]" : "bg-[var(--sl-line)]"}`}>
    <span className={`absolute top-1 h-5 w-5 rounded-full bg-[var(--sl-parchment)] transition-all ${on ? "left-6" : "left-1"}`} />
  </button>;
}

/** A row of choices where exactly one is picked. */
export function Choices<T extends string | number>({ value, options, onChange, label }: { value: T; options: readonly { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
    {options.map((o) => <button key={String(o.id)} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className="sl-chip">{o.label}</button>)}
  </div>;
}

/** A level slider, 0 to 1. */
export function Level({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return <input type="range" min={0} max={100} step={1} value={Math.round(value * 100)} aria-label={label}
    onChange={(e) => onChange(Number(e.target.value) / 100)} className="sl-range" style={{ ["--fill" as string]: `${Math.round(value * 100)}%` }} />;
}
