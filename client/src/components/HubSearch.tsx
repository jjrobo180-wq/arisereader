// The search box for a whole hub: opens from the header's search button, Ctrl/⌘ K, or "/". Type to find any
// section, plugin or saved thing, use the arrow keys, and press Enter (or tap) to go straight to it.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as KeyEvent } from "react";
import { CornerDownLeft, Search, X } from "lucide-react";
import { searchHub, type SearchEntry } from "@shared/hubSearch";

export type HubSearchEntry = SearchEntry & { open: () => void };

/** The header button, with the keyboard shortcut wired up. */
export function HubSearchButton({ onOpen, className = "" }: { onOpen: () => void; className?: string }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) { e.preventDefault(); onOpen(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onOpen]);
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return <button type="button" onClick={onOpen} aria-label="Search everything" title={`Search (${mac ? "⌘" : "Ctrl"} K)`} data-testid="hub-search-open"
    className={`inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-500 hover:bg-slate-50 ${className}`}>
    <Search className="h-4 w-4" /><span className="hidden w-36 text-left xl:inline">Search</span><kbd className="hidden rounded-md border border-slate-200 px-1.5 text-[11px] font-semibold xl:inline">{mac ? "⌘" : "Ctrl"} K</kbd>
  </button>;
}

export function HubSearch({ entries, onClose, hubName, accent = "bg-slate-950" }: { entries: HubSearchEntry[]; onClose: () => void; hubName: string; accent?: string }) {
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const box = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const found = useMemo(() => (q.trim() ? searchHub(entries, q, 40) : entries.filter((e) => e.kind === "Section").slice(0, 14)), [entries, q]);
  useEffect(() => { setAt(0); }, [q]);
  useEffect(() => {
    box.current?.focus();
    const { overflow } = document.body.style; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, []);
  useEffect(() => { list.current?.querySelector(`[data-i="${at}"]`)?.scrollIntoView({ block: "nearest" }); }, [at]);
  const go = (e?: HubSearchEntry) => { if (!e) return; onClose(); e.open(); };
  const key = (e: KeyEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") { e.preventDefault(); setAt((i) => Math.min(found.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAt((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); go(found[at]); }
  };
  // Group results by kind, keeping the best-first order inside each group.
  const kinds = [...new Set(found.map((e) => e.kind))];
  let n = -1;
  return <div className="fixed inset-0 z-[690] flex items-start justify-center bg-slate-950/40 p-0 sm:p-4 sm:pt-[10vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={`Search ${hubName}`} data-testid="hub-search" className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[75vh] sm:max-w-2xl sm:rounded-3xl">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:p-3">
        <Search className="ml-1 h-5 w-5 shrink-0 text-slate-400" />
        <input ref={box} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder={`Search all of ${hubName}…`} aria-label={`Search all of ${hubName}`} role="combobox" aria-expanded aria-controls="hub-search-list"
          className="min-h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400" />
        <button type="button" onClick={onClose} aria-label="Close search" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </div>
      <ul ref={list} id="hub-search-list" role="listbox" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {!found.length && <li className="px-3 py-10 text-center text-sm text-slate-500">Nothing matches “{q.trim()}”. Try fewer letters.</li>}
        {!q.trim() && found.length > 0 && <li className="px-3 pb-1 pt-2 text-xs text-slate-500">Type to search students, to-dos, notes, events and more.</li>}
        {kinds.map((k) => <li key={k} role="presentation">
          <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">{k}</p>
          <ul role="presentation">{found.filter((e) => e.kind === k).map((e) => { n++; const i = n, on = i === at;
            return <li key={`${e.kind}-${e.id}`} role="option" aria-selected={on} data-i={i}>
              <button type="button" onClick={() => go(e)} onMouseMove={() => setAt(i)} className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${on ? `${accent} text-white` : "hover:bg-slate-50"}`}>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{e.title}</span>{e.sub && <span className={`block truncate text-xs ${on ? "text-white/75" : "text-slate-500"}`}>{e.sub}</span>}</span>
                {on && <CornerDownLeft className="h-4 w-4 shrink-0 opacity-80" />}
              </button>
            </li>; })}</ul>
        </li>)}
      </ul>
      <p className="hidden border-t border-slate-100 px-4 py-2 text-xs text-slate-400 sm:block">↑ ↓ to move · Enter to open · Esc to close</p>
    </div>
  </div>;
}
