// The look shelf, used by Arise Notes (Settings > Appearance) and by To Duo and WorkHub (Customize):
// every look in its group, and a preview sheet that opens before anything changes.
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { LOOK_GROUPS, groupedLooks, type LookInfo } from "@shared/lookCatalog";

const LookPreview = lazy(() => import("./LookPreview"));

// Colors come from the page's look (or plain ones when there is none), set inline so no look's
// recoloring of shared class names can turn the names white-on-white or navy-on-black.
const C = { ink: "var(--an-ink, #0f172a)", muted: "var(--an-muted, #475569)", card: "var(--an-card, #ffffff)", line: "var(--an-line, rgba(15,23,42,.12))" };

/** A theme that is not a look (To Duo's Tile and Old Computer): shown in its own small group. */
export type PlainTheme = { id: string; name: string; blurb: string; swatch: string[] };

function Swatch({ colors, className = "h-12" }: { colors: string[]; className?: string }) {
  return <span className={`flex overflow-hidden rounded-[10px] ${className}`} style={{ boxShadow: `0 0 0 1px ${C.line}` }} aria-hidden>{colors.map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}</span>;
}

function Sheet({ info, plain, on, onUse, onClose, accent }: { info?: LookInfo; plain?: PlainTheme; on: boolean; onUse: () => void; onClose: () => void; accent: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); prev?.focus?.(); };
  }, [onClose]);
  const name = info?.name ?? plain!.name, blurb = info?.blurb ?? plain!.blurb, swatch = info?.swatch ?? plain!.swatch;
  const group = info ? LOOK_GROUPS.find((g) => g.id === info.group)?.name : "Special";
  return <div className="kb-sheet fixed inset-0 z-[90] flex items-end justify-center bg-black/55 sm:items-center" onClick={onClose} data-testid="look-sheet">
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${name} preview`} onClick={(e) => e.stopPropagation()}
      className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] shadow-2xl outline-none sm:rounded-[28px]" style={{ background: "#ffffff", color: "#0f172a" }} data-light-island="">
      <div className="flex items-start gap-3 px-5 pb-2 pt-5">
        <div className="min-w-0 flex-1">
          {group && <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: "#475569" }}>{group}</p>}
          <h3 className="mt-0.5 text-[24px] font-black leading-tight" style={{ color: "#0f172a" }}>{name}</h3>
          <p className="mt-1 text-[14px] leading-snug" style={{ color: "#475569" }}>{blurb}</p>
        </div>
        <button type="button" aria-label="Close preview" onClick={onClose} className="grid h-11 w-11 flex-none place-items-center rounded-full" style={{ background: "#f1f5f9", color: "#334155" }}><X className="h-5 w-5" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
        {info ? <Suspense fallback={<div className="grid h-60 place-items-center text-sm" style={{ color: "#475569" }}>Drawing the preview…</div>}><LookPreview look={info.look} /></Suspense>
          : <div className="py-3"><Swatch colors={swatch} className="h-24" /><p className="mt-3 text-[13px]" style={{ color: "#475569" }}>This one restyles the hub itself. Pick it to see it everywhere.</p></div>}
      </div>
      <div className="flex gap-2 border-t px-5 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={onClose} className="min-h-12 rounded-full border px-5 text-[15px] font-bold" style={{ borderColor: "#cbd5e1", color: "#334155", background: "#ffffff" }}>Not now</button>
        <button type="button" onClick={() => { onUse(); onClose(); }} disabled={on} className="min-h-12 flex-1 rounded-full px-5 text-[15px] font-black disabled:opacity-60" style={{ background: accent, color: "#ffffff" }} data-testid="look-use">{on ? "This is your look" : "Use this look"}</button>
      </div>
    </div>
  </div>;
}

export default function LookPicker({ current, onPick, plain = [], accent = "#5b4fe0", testPrefix = "look", hideClassic = false }: { current: string; onPick: (id: string) => void; plain?: PlainTheme[]; accent?: string; testPrefix?: string; hideClassic?: boolean }) {
  const groups = groupedLooks();
  const [open, setOpen] = useState<string | null>(null);
  const find = (id: string) => groups.flatMap((g) => g.items).find((l) => l.id === id);
  const openInfo = open ? find(open) : undefined, openPlain = open ? plain.find((p) => p.id === open) : undefined;
  const card = (id: string, name: string, blurb: string, swatch: string[]) => {
    const on = current === id;
    return <button key={id} type="button" aria-pressed={on} onClick={() => setOpen(id)} data-testid={`${testPrefix}-${id}`}
      className="flex min-w-0 flex-col rounded-2xl border p-2.5 text-left transition active:scale-[.98]" style={{ background: C.card, color: C.ink, borderColor: on ? accent : C.line, boxShadow: on ? `0 0 0 2px ${accent}` : undefined }}>
      <Swatch colors={swatch} />
      <span className="mt-2 flex items-center justify-between gap-1 text-[15px] font-bold leading-tight" style={{ color: C.ink }}>{name}{on && <Check className="h-4 w-4 shrink-0" style={{ color: accent }} strokeWidth={3} aria-label="Current" />}</span>
      <span className="mt-0.5 line-clamp-3 text-[12px] leading-snug" style={{ color: C.muted }}>{blurb}</span>
    </button>;
  };
  return <div className="space-y-6" data-testid={`${testPrefix}-picker`}>
    {groups.map(({ group, items }) => {
      const list = hideClassic ? items.filter((l) => l.id !== "classic") : items;
      if (!list.length) return null;
      return <section key={group.id} aria-labelledby={`${testPrefix}-g-${group.id}`}>
        <h3 id={`${testPrefix}-g-${group.id}`} className="text-[16px] font-black" style={{ color: C.ink }}>{group.name} <span className="text-[12px] font-semibold" style={{ color: C.muted }}>· {list.length}</span></h3>
        <p className="mb-2.5 text-[13px]" style={{ color: C.muted }}>{group.note}</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{list.map((l) => card(l.id, l.name, l.blurb, l.swatch))}</div>
      </section>;
    })}
    {plain.length > 0 && <section><h3 className="text-[16px] font-black" style={{ color: C.ink }}>Just for the hubs</h3><p className="mb-2.5 text-[13px]" style={{ color: C.muted }}>Whole-hub styles that change how Home is laid out.</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{plain.map((p) => card(p.id, p.name, p.blurb, p.swatch))}</div></section>}
    {(openInfo || openPlain) && <Sheet info={openInfo} plain={openPlain} on={current === open} accent={accent} onUse={() => onPick(open!)} onClose={() => setOpen(null)} />}
  </div>;
}
