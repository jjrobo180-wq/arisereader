// The header shortcut: a small ⚡ button that opens whatever the person chose (shared/hubShortcut.ts).
// Tap it to go. Press and hold it (or right-click on a computer) to change what it opens. Until something
// is chosen, tapping it opens the chooser. Used in both hubs; each passes in its own menu.
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Globe, Search, Trash2, X, Zap } from "lucide-react";
import { shortcutTarget, shortcutUrl, type HubShortcut } from "@shared/hubShortcut";

export type ShortcutChoice = { id: string; label: string; icon?: ReactNode; onClick: () => void };

const HOLD_MS = 550;

export default function HeaderShortcut({ shortcut, choices, onChange, say, className = "" }: {
  shortcut: HubShortcut | undefined;
  /** Everything in this hub's menu that the button could open. */
  choices: ShortcutChoice[];
  onChange: (next: HubShortcut | undefined) => void;
  say?: (message: string) => void;
  className?: string;
}) {
  const [picking, setPicking] = useState(false);
  const hold = useRef<{ timer: number; fired: boolean } | null>(null);
  const target = shortcutTarget(shortcut, choices);
  const go = () => {
    if (!target) { setPicking(true); return; }
    if ("url" in target) window.open(target.url, "_blank", "noopener,noreferrer");
    else target.item.onClick();
  };
  const startHold = () => {
    const h = { timer: 0, fired: false };
    h.timer = window.setTimeout(() => { h.fired = true; setPicking(true); try { navigator.vibrate?.(12); } catch { /* fine without it */ } }, HOLD_MS);
    hold.current = h;
  };
  const endHold = () => { if (hold.current) window.clearTimeout(hold.current.timer); };
  const label = shortcut ? shortcut.label : "Shortcut";
  const icon = target && "item" in target && target.item.icon ? target.item.icon : null;

  return <>
    <button type="button"
      onPointerDown={startHold} onPointerUp={endHold} onPointerLeave={endHold} onPointerCancel={endHold}
      onClick={() => { const fired = hold.current?.fired; hold.current = null; if (!fired) go(); }}
      onContextMenu={(e) => { e.preventDefault(); endHold(); setPicking(true); }}
      aria-label={shortcut ? `Shortcut: open ${shortcut.label}. Press and hold to change it.` : "Set up your shortcut button"}
      title={shortcut ? `${shortcut.label} · hold or right-click to change` : "Choose what this button opens"}
      className={`inline-flex h-11 min-w-11 select-none items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-bold transition [-webkit-touch-callout:none] ${shortcut ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100" : "border-dashed border-slate-300 bg-white text-slate-500 hover:bg-slate-50"} ${className}`}
      data-testid="header-shortcut">
      <span className="relative inline-flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4">{icon ?? <Zap className="fill-current" />}</span>
      <span className="hidden max-w-[9rem] truncate xl:inline">{label}</span>
    </button>
    {/* Rendered on the page itself, not inside the header: the header's blur makes it the frame for anything
        "fixed" inside it, which squeezed this pop-up into the header's height. */}
    {picking && createPortal(<ShortcutPicker shortcut={shortcut} choices={choices} onClose={() => setPicking(false)}
      onPick={(next) => { onChange(next); setPicking(false); say?.(next ? `Your ⚡ shortcut now opens ${next.label}. Hold it to change.` : "Shortcut removed"); }} />, document.body)}
  </>;
}

function ShortcutPicker({ shortcut, choices, onPick, onClose }: { shortcut: HubShortcut | undefined; choices: ShortcutChoice[]; onPick: (next: HubShortcut | undefined) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState(shortcut?.kind === "url" ? shortcut.url : "");
  const [urlLabel, setUrlLabel] = useState(shortcut?.kind === "url" ? shortcut.label : "");
  const [bad, setBad] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const q = query.trim().toLowerCase();
  // One entry per id (a hub can list the same thing in two places), in menu order.
  const list = useMemo(() => { const seen = new Set<string>(); return choices.filter((c) => !seen.has(c.id) && !!seen.add(c.id) && (!q || c.label.toLowerCase().includes(q))); }, [choices, q]);
  const saveUrl = (e: FormEvent) => {
    e.preventDefault();
    const clean = shortcutUrl(url);
    if (!clean) { setBad(true); return; }
    onPick({ kind: "url", url: clean, label: urlLabel.trim().slice(0, 40) || new URL(clean).hostname.replace(/^www\./, "") });
  };
  return <div className="fixed inset-0 kb-sheet z-[95] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-labelledby="shortcut-title" onClick={(e) => e.stopPropagation()}
      className="flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[1.75rem] bg-white text-slate-800 shadow-2xl sm:rounded-[1.75rem]" data-testid="shortcut-picker">
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 pb-4 pt-5">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Zap size={18} className="fill-current" /></span>
        <div className="min-w-0 flex-1">
          <h2 id="shortcut-title" className="text-lg font-black tracking-tight text-slate-900">Your shortcut button</h2>
          <p className="text-sm text-slate-500">Pick what the ⚡ in the header opens. Press and hold it any time to change.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X size={18} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your sections and apps" aria-label="Search" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-amber-400 focus:bg-white" />
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2" data-testid="shortcut-choices">{list.map((c) => {
          const on = shortcut?.kind === "open" && shortcut.id === c.id;
          return <li key={c.id}><button type="button" onClick={() => onPick({ kind: "open", id: c.id, label: c.label.slice(0, 40) })} aria-pressed={on}
            className={`flex min-h-12 w-full items-center gap-2.5 rounded-xl border px-3 text-left text-sm font-semibold transition [&_svg]:h-4 [&_svg]:w-4 ${on ? "border-amber-400 bg-amber-50 text-amber-900" : "border-slate-200 hover:bg-slate-50"}`}>
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">{c.icon ?? <Zap />}</span>
            <span className="min-w-0 flex-1 truncate">{c.label}</span>{on && <Check size={15} className="shrink-0 text-amber-700" />}
          </button></li>;
        })}</ul>
        {!list.length && <p className="mt-3 text-sm text-slate-500">Nothing matches “{query}”.</p>}
        <form onSubmit={saveUrl} className="mt-5 rounded-2xl bg-slate-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-800"><Globe size={15} /> Or a website</p>
          <div className="mt-2 grid grid-cols-1 gap-2">
            <input value={url} onChange={(e) => { setUrl(e.target.value); setBad(false); }} placeholder="Address (like classroom.google.com)" aria-label="Web address" inputMode="url" autoCapitalize="none" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-400" />
            <input value={urlLabel} onChange={(e) => setUrlLabel(e.target.value)} maxLength={40} placeholder="Name (optional)" aria-label="Name" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-400" />
          </div>
          {bad && <p className="mt-2 text-xs font-semibold text-rose-600">That doesn't look like a web address.</p>}
          <button type="submit" disabled={!url.trim()} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-40">Use this website</button>
        </form>
      </div>
      {shortcut && <div className="border-t border-slate-100 px-5 py-3">
        <button type="button" onClick={() => onPick(undefined)} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-rose-600 hover:bg-rose-50"><Trash2 size={15} /> Remove shortcut</button>
      </div>}
    </div>
  </div>;
}
