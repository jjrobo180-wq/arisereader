// The search box for a whole hub: opens from the header's search button, Ctrl/⌘ K, or "/". Type to find any
// section, plugin or saved thing, use the arrow keys, and press Enter (or tap) to go straight to it.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as KeyEvent, type ReactNode } from "react";
import { CornerDownLeft, Search, X } from "lucide-react";
import { APP_KINDS, STORE_KIND, groupResults, searchHub, type SearchEntry } from "@shared/hubSearch";

/** One thing search can find. Apps show their icon (and colour) like on a phone. */
export type HubSearchEntry = SearchEntry & { open: () => void; icon?: ReactNode; color?: string };

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
  const [opened, setOpened] = useState<string[]>([]);
  const box = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const typed = q.trim();
  const found = useMemo(() => (typed ? searchHub(entries, typed, 80) : []), [entries, typed]);
  // Like iPhone: the best match on top, then Apps, then each kind of saved thing, App Store last.
  const { top, groups } = useMemo(() => groupResults(found), [found]);
  const PER = 4;
  const shownGroups = groups.map((g) => ({ ...g, all: g.items.length, items: opened.includes(g.label) ? g.items : g.items.slice(0, PER) }));
  const flat = [...(top ? [top] : []), ...shownGroups.flatMap((g) => g.items)];
  // Before typing: the apps, as a grid of icons.
  const apps = useMemo(() => entries.filter((e) => (APP_KINDS as readonly string[]).includes(e.kind)), [entries]);
  useEffect(() => { setAt(0); setOpened([]); }, [typed]);
  useEffect(() => {
    box.current?.focus();
    const { overflow } = document.body.style; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, []);
  useEffect(() => { list.current?.querySelector(`[data-i="${at}"]`)?.scrollIntoView({ block: "nearest" }); }, [at]);
  const go = (e?: HubSearchEntry) => { if (!e) return; onClose(); e.open(); };
  const key = (e: KeyEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") { e.preventDefault(); setAt((i) => Math.min(flat.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAt((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); go(flat[at]); }
  };
  const iconBox = (e: HubSearchEntry, big = false) => <span className={`inline-flex shrink-0 items-center justify-center rounded-xl ${big ? "h-12 w-12 [&_svg]:h-6 [&_svg]:w-6" : "h-9 w-9 [&_svg]:h-[18px] [&_svg]:w-[18px]"} ${e.color ? "text-white" : "bg-slate-100 text-slate-600"}`} style={e.color ? { background: e.color } : undefined} aria-hidden>{e.icon ?? <Search />}</span>;
  let n = top ? 0 : -1;
  const row = (e: HubSearchEntry, i: number) => { const on = i === at;
    return <li key={`${e.kind}-${e.id}`} role="option" aria-selected={on} data-i={i}>
      <button type="button" onClick={() => go(e)} onMouseMove={() => setAt(i)} className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left ${on ? `${accent} text-white` : "hover:bg-slate-50"}`}>
        {(e.icon || (APP_KINDS as readonly string[]).includes(e.kind) || e.kind === STORE_KIND) && iconBox(e)}
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{e.title}</span>{e.sub && <span className={`block truncate text-xs ${on ? "text-white/75" : "text-slate-500"}`}>{e.sub}</span>}</span>
        {e.kind === STORE_KIND && <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${on ? "bg-white/20" : "bg-slate-100 text-slate-700"}`}>Get</span>}
        {on && e.kind !== STORE_KIND && <CornerDownLeft className="h-4 w-4 shrink-0 opacity-80" />}
      </button>
    </li>; };
  return <div className="fixed inset-0 z-[690] flex items-start justify-center bg-slate-950/40 p-0 sm:p-4 sm:pt-[10vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={`Search ${hubName}`} data-testid="hub-search" className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[75vh] sm:max-w-2xl sm:rounded-3xl">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:p-3">
        <Search className="ml-1 h-5 w-5 shrink-0 text-slate-400" />
        <input ref={box} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder={`Search apps, notes, to-dos and more`} aria-label={`Search all of ${hubName}`} role="combobox" aria-expanded aria-controls="hub-search-list"
          className="min-h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400" />
        <button type="button" onClick={onClose} aria-label="Close search" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </div>
      <div ref={list} id="hub-search-list" role="listbox" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2" data-testid="hub-search-results">
        {!typed && <section>
          <p className="px-3 pb-2 pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Apps</p>
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-6" data-testid="hub-search-apps">{apps.slice(0, 24).map((e) => <button key={e.id} type="button" onClick={() => go(e)} className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl p-2 hover:bg-slate-50">
            {iconBox(e, true)}<span className="w-full truncate text-center text-[11px] font-semibold text-slate-700">{e.title}</span>
          </button>)}</div>
          <p className="px-3 pb-1 pt-4 text-xs text-slate-500">Type to search apps, to-dos, notes, events and everything else.</p>
        </section>}
        {typed && !found.length && <p className="px-3 py-10 text-center text-sm text-slate-500">Nothing matches “{typed}”. Try fewer letters.</p>}
        {top && <section data-testid="hub-search-top">
          <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Top hit</p>
          <button type="button" data-i={0} onClick={() => go(top)} onMouseMove={() => setAt(0)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ${at === 0 ? `${accent} text-white` : "bg-slate-50 hover:bg-slate-100"}`}>
            {iconBox(top, true)}
            <span className="min-w-0 flex-1"><span className="block truncate text-base font-bold">{top.title}</span><span className={`block truncate text-xs ${at === 0 ? "text-white/75" : "text-slate-500"}`}>{(APP_KINDS as readonly string[]).includes(top.kind) ? "App" : top.kind}{top.sub ? ` · ${top.sub}` : ""}</span></span>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${at === 0 ? "bg-white/20" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>{top.kind === STORE_KIND ? "Get" : "Open"}</span>
          </button>
        </section>}
        {shownGroups.map((g) => <section key={g.label} role="presentation" data-testid={`hub-search-group-${g.label}`}>
          <div className="flex items-baseline justify-between px-3 pb-1 pt-4"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{g.label}</p>
            {g.all > PER && <button type="button" onClick={() => setOpened((o) => (o.includes(g.label) ? o.filter((x) => x !== g.label) : [...o, g.label]))} className="text-xs font-bold text-slate-500 hover:text-slate-800">{opened.includes(g.label) ? "Show less" : `Show all ${g.all}`}</button>}</div>
          <ul role="presentation">{g.items.map((e) => { n++; return row(e, n); })}</ul>
        </section>)}
      </div>
      <p className="hidden border-t border-slate-100 px-4 py-2 text-xs text-slate-400 sm:block">↑ ↓ to move · Enter to open · Esc to close</p>
    </div>
  </div>;
}
