// Pieces shared by Arise Sheets, Docs and Slides: menus, toolbar buttons, colour pickers, dialogs.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronRight, X } from "lucide-react";

// ─── Floating panels ────────────────────────────────────────────────────────

/** A panel that floats under (or beside) the element it was opened from, kept on screen. */
export function Floating({ anchor, onClose, children, side = "below", className = "" }: { anchor: HTMLElement | DOMRect | null; onClose: () => void; children: ReactNode; side?: "below" | "right"; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const a = anchor instanceof HTMLElement ? anchor.getBoundingClientRect() : anchor;
    const w = ref.current.offsetWidth, h = ref.current.offsetHeight;
    let left = side === "right" ? a.right - 2 : a.left, top = side === "right" ? a.top - 6 : a.bottom + 4;
    if (left + w > window.innerWidth - 8) left = side === "right" ? Math.max(8, a.left - w + 2) : Math.max(8, window.innerWidth - w - 8);
    if (top + h > window.innerHeight - 8) top = side === "right" ? Math.max(8, window.innerHeight - h - 8) : Math.max(8, a.top - h - 4);
    if (top < 8) top = 8;
    setPos({ left, top });
  }, [anchor, side]);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (anchor instanceof HTMLElement && anchor.contains(t)) return;
      if ((t as HTMLElement).closest?.("[data-office-float]")) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    const t = window.setTimeout(() => document.addEventListener("pointerdown", down), 0);
    document.addEventListener("keydown", key, true);
    return () => { window.clearTimeout(t); document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key, true); };
  }, [anchor, onClose]);
  return createPortal(
    <div ref={ref} data-office-float="" className={`fixed z-[1000] max-h-[80vh] overflow-auto rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl ${className}`} style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}>{children}</div>,
    document.body,
  );
}

// ─── Menus ──────────────────────────────────────────────────────────────────

export type MenuItem =
  | { sep: true }
  | { label: string; onClick?: () => void; keys?: string; icon?: ReactNode; checked?: boolean; disabled?: boolean; sub?: MenuItem[]; danger?: boolean; hint?: string; testId?: string }
  | { heading: string };

export function MenuList({ items, onDone }: { items: MenuItem[]; onDone: () => void }) {
  const [open, setOpen] = useState<{ i: number; el: HTMLElement } | null>(null);
  return <div className="min-w-[230px] py-1.5 text-[13px]" role="menu">
    {items.map((it, i) => {
      if ("sep" in it) return <div key={i} className="my-1 border-t border-slate-100" />;
      if ("heading" in it) return <div key={i} className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{it.heading}</div>;
      return <button key={i} type="button" role="menuitem" disabled={it.disabled} data-testid={it.testId}
        onMouseEnter={(e) => setOpen(it.sub ? { i, el: e.currentTarget } : null)}
        onClick={(e) => { if (it.sub) { setOpen(open?.i === i ? null : { i, el: e.currentTarget }); return; } it.onClick?.(); onDone(); }}
        className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-100 disabled:opacity-40 ${it.danger ? "text-rose-600" : "text-slate-800"}`}>
        <span className="flex w-4 shrink-0 justify-center text-slate-500">{it.checked ? <Check size={14} /> : it.icon}</span>
        <span className="flex-1">{it.label}{it.hint && <span className="ml-2 text-xs text-slate-400">{it.hint}</span>}</span>
        {it.keys && <span className="pl-4 text-xs text-slate-400">{it.keys}</span>}
        {it.sub && <ChevronRight size={14} className="text-slate-400" />}
        {it.sub && open?.i === i && <Floating anchor={open.el} side="right" onClose={() => setOpen(null)}><MenuList items={it.sub} onDone={onDone} /></Floating>}
      </button>;
    })}
  </div>;
}

/** File · Edit · View · Insert · Format · Data … across the top. */
export function MenuBar({ menus }: { menus: { label: string; items: () => MenuItem[] }[] }) {
  const [open, setOpen] = useState<{ i: number; el: HTMLElement } | null>(null);
  return <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto text-[13px]" role="menubar">
    {menus.map((m, i) => <button key={m.label} type="button" data-testid={`menu-${m.label.toLowerCase()}`}
      onClick={(e) => setOpen(open?.i === i ? null : { i, el: e.currentTarget })}
      onMouseEnter={(e) => { if (open && open.i !== i) setOpen({ i, el: e.currentTarget }); }}
      className={`shrink-0 rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100 ${open?.i === i ? "bg-slate-200" : ""}`}>{m.label}</button>)}
    {open && <Floating anchor={open.el} onClose={() => setOpen(null)}><MenuList items={menus[open.i].items()} onDone={() => setOpen(null)} /></Floating>}
  </div>;
}

/** A button that opens a menu or panel under itself. */
export function DropButton({ label, title, children, className = "", testId, wide }: { label: ReactNode; title: string; children: (close: () => void) => ReactNode; className?: string; testId?: string; wide?: boolean }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  return <>
    <button type="button" title={title} aria-label={title} data-testid={testId} onClick={(e) => setEl(el ? null : e.currentTarget)}
      className={`inline-flex h-8 shrink-0 items-center gap-0.5 rounded-md px-1.5 text-slate-700 hover:bg-slate-100 ${el ? "bg-slate-200" : ""} ${className}`}>
      {label}<ChevronDown size={12} className="text-slate-400" />
    </button>
    {el && <Floating anchor={el} onClose={() => setEl(null)} className={wide ? "w-[300px]" : ""}>{children(() => setEl(null))}</Floating>}
  </>;
}

export function Tool({ title, onClick, active, children, disabled, testId, keys }: { title: string; onClick: () => void; active?: boolean; children: ReactNode; disabled?: boolean; testId?: string; keys?: string }) {
  return <button type="button" title={keys ? `${title} (${keys})` : title} aria-label={title} aria-pressed={active} disabled={disabled} data-testid={testId}
    onMouseDown={(e) => e.preventDefault()} onClick={onClick}
    className={`inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md px-1 text-slate-700 hover:bg-slate-100 disabled:opacity-35 ${active ? "bg-sky-100 text-sky-800" : ""}`}>{children}</button>;
}
export const ToolSep = () => <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" />;

// ─── Colours ────────────────────────────────────────────────────────────────

export const PALETTE = [
  ["#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff"],
  ["#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff", "#9900ff", "#ff00ff"],
  ["#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#cfe2f3", "#d9d2e9", "#ead1dc"],
  ["#dd7e6b", "#ea9999", "#f9cb9c", "#ffe599", "#b6d7a8", "#a2c4c9", "#a4c2f4", "#9fc5e8", "#b4a7d6", "#d5a6bd"],
  ["#cc4125", "#e06666", "#f6b26b", "#ffd966", "#93c47d", "#76a5af", "#6d9eeb", "#6fa8dc", "#8e7cc3", "#c27ba0"],
  ["#a61c00", "#cc0000", "#e69138", "#f1c232", "#6aa84f", "#45818e", "#3c78d8", "#3d85c6", "#674ea7", "#a64d79"],
  ["#85200c", "#990000", "#b45f06", "#bf9000", "#38761d", "#134f5c", "#1155cc", "#0b5394", "#351c75", "#741b47"],
  ["#5b0f00", "#660000", "#783f04", "#7f6000", "#274e13", "#0c343d", "#1c4587", "#073763", "#20124d", "#4c1130"],
];

export function ColorGrid({ value, onPick, resetLabel = "Reset" }: { value?: string; onPick: (c: string | undefined) => void; resetLabel?: string }) {
  const [custom, setCustom] = useState(value || "#1d4ed8");
  return <div className="w-[248px] p-3">
    <button type="button" onClick={() => onPick(undefined)} className="mb-2 flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-[13px] text-slate-700 hover:bg-slate-100"><span className="h-4 w-4 rounded border border-slate-300 bg-[linear-gradient(135deg,#fff_45%,#ef4444_45%,#ef4444_55%,#fff_55%)]" />{resetLabel}</button>
    <div className="grid grid-cols-10 gap-1">
      {PALETTE.flat().map((c) => <button key={c} type="button" title={c} aria-label={c} onClick={() => onPick(c)}
        className={`h-5 w-5 rounded-full border ${value?.toLowerCase() === c ? "ring-2 ring-sky-500 ring-offset-1" : "border-slate-200"}`} style={{ background: c }} />)}
    </div>
    <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2 text-[12px] text-slate-600">
      <input type="color" value={custom} onChange={(e) => setCustom(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-slate-200" aria-label="Custom colour" />
      <input value={custom} onChange={(e) => setCustom(e.target.value)} className="h-7 w-20 rounded border border-slate-200 px-1.5 font-mono text-xs" aria-label="Colour code" />
      <button type="button" onClick={() => /^#[0-9a-f]{6}$/i.test(custom) && onPick(custom.toLowerCase())} className="ml-auto rounded-md bg-slate-900 px-2 py-1 text-xs font-bold text-white">Use</button>
    </div>
  </div>;
}

// ─── Dialogs ────────────────────────────────────────────────────────────────

export function Dialog({ title, onClose, children, footer, wide, testId }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; testId?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", k, true);
    return () => document.removeEventListener("keydown", k, true);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[900] flex items-end justify-center bg-slate-900/40 p-0 text-slate-900 sm:items-center sm:p-4" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }} data-office-float="">
      <div role="dialog" aria-label={title} data-testid={testId} className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-md"}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-base font-black">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4 text-sm">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export const btn = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-bold";
export const btnPrimary = `${btn} bg-slate-900 text-white hover:bg-slate-800`;
export const btnGhost = `${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
export const field = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100";

export function Label({ text, children }: { text: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">{text}</span>{children}</label>;
}

/** Picks a file from the device. */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

export function downloadBlob(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "file";
